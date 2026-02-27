import {
  AppServerClient,
  type AppServerTransport,
  AppServerTransportError,
  DesktopIpcClient,
  type ListThreadsOptions,
} from "@farfield/api";
import type { AppServerListThreadsResponse, IpcResponseFrame, JsonValue } from "@farfield/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CodexConnectionLifecycleOwner,
  isCodexUnavailableBootstrapErrorMessage,
} from "../Source/Agents/Adapters/CodexConnectionLifecycleOwner.js";

const TEST_LABEL = "Codex";
const TEST_RECONNECT_DELAY_MILLISECONDS = 25;
const TEST_SOCKET_PATH = "/tmp/codex-connection-lifecycle-owner.sock";
const EMPTY_LIST_THREADS_RESPONSE: AppServerListThreadsResponse = {
  data: [],
  nextCursor: null,
};
const IPC_INITIALIZE_SUCCESS_RESPONSE: IpcResponseFrame = {
  type: "response",
  requestId: "initialize-request",
  method: "initialize",
  resultType: "success",
  result: {
    clientId: "client-1",
  },
};

const NOOP_TRANSPORT: AppServerTransport = {
  async request(_method: string, _params: object, _timeoutMs?: number): Promise<JsonValue> {
    throw new Error("transport should not be used in this test");
  },
  async close(): Promise<void> {},
};

interface TestAppServerClientOptions {
  listThreadsImplementation?: () => Promise<AppServerListThreadsResponse>;
}

class TestAppServerClient extends AppServerClient {
  public readonly listThreadsCalls: ListThreadsOptions[] = [];
  private readonly listThreadsImplementation: () => Promise<AppServerListThreadsResponse>;

  public constructor(options: TestAppServerClientOptions = {}) {
    super(NOOP_TRANSPORT);
    this.listThreadsImplementation =
      options.listThreadsImplementation ?? (async () => EMPTY_LIST_THREADS_RESPONSE);
  }

  public override async listThreads(
    options: ListThreadsOptions,
  ): Promise<AppServerListThreadsResponse> {
    this.listThreadsCalls.push(options);
    return this.listThreadsImplementation();
  }
}

type InitializeOutcome = IpcResponseFrame | Error;

interface TestDesktopIpcClientOptions {
  connected?: boolean;
  connectError?: Error | null;
  initializeOutcomes?: InitializeOutcome[];
}

class TestDesktopIpcClient extends DesktopIpcClient {
  public connectCalls = 0;
  public readonly initializeLabels: string[] = [];
  private connected: boolean;
  private readonly initializeOutcomes: InitializeOutcome[];
  private readonly connectError: Error | null;

  public constructor(options: TestDesktopIpcClientOptions = {}) {
    super({
      socketPath: TEST_SOCKET_PATH,
    });
    this.connected = options.connected ?? false;
    this.connectError = options.connectError ?? null;
    this.initializeOutcomes = [
      ...(options.initializeOutcomes ?? [IPC_INITIALIZE_SUCCESS_RESPONSE]),
    ];
  }

  public override isConnected(): boolean {
    return this.connected;
  }

  public override async connect(): Promise<void> {
    this.connectCalls += 1;
    if (this.connectError) {
      throw this.connectError;
    }

    this.connected = true;
  }

  public override async initialize(label: string): Promise<IpcResponseFrame> {
    this.initializeLabels.push(label);
    const outcome = this.initializeOutcomes.shift();
    if (outcome instanceof Error) {
      throw outcome;
    }

    return outcome ?? IPC_INITIALIZE_SUCCESS_RESPONSE;
  }
}

interface OwnerFixture {
  appClient: TestAppServerClient;
  ipcClient: TestDesktopIpcClient;
  reconnectDelayMs?: number;
  onStateChange?: (() => void) | null;
}

function createOwner(fixture: Partial<OwnerFixture> = {}): CodexConnectionLifecycleOwner {
  return new CodexConnectionLifecycleOwner({
    appClient: fixture.appClient ?? new TestAppServerClient(),
    ipcClient: fixture.ipcClient ?? new TestDesktopIpcClient(),
    label: TEST_LABEL,
    reconnectDelayMs: fixture.reconnectDelayMs ?? TEST_RECONNECT_DELAY_MILLISECONDS,
    onStateChange: fixture.onStateChange ?? null,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CodexConnectionLifecycleOwner", () => {
  it("bootstraps app-server and ipc readiness when codex is available", async () => {
    const appClient = new TestAppServerClient();
    const ipcClient = new TestDesktopIpcClient();
    const owner = createOwner({
      appClient,
      ipcClient,
    });

    await owner.bootstrapConnections();

    expect(appClient.listThreadsCalls).toEqual([
      {
        limit: 1,
        archived: false,
        sortKey: "updated_at",
      },
    ]);
    expect(ipcClient.connectCalls).toBe(1);
    expect(ipcClient.initializeLabels).toEqual([TEST_LABEL]);
    expect(owner.getRuntimeState()).toEqual({
      appReady: true,
      ipcConnected: true,
      ipcInitialized: true,
      codexAvailable: true,
      lastError: null,
    });
    expect(owner.isConnected()).toBe(true);
    expect(owner.isIpcReady()).toBe(true);
  });

  it("treats transport errors as app-not-ready and non-transport errors as still app-ready", async () => {
    const owner = createOwner();

    await expect(
      owner.runAppServerCall(async () => {
        throw new AppServerTransportError("app-server transport closed");
      }),
    ).rejects.toThrowError("app-server transport closed");
    expect(owner.getRuntimeState()).toMatchObject({
      appReady: false,
      lastError: "app-server transport closed",
    });

    await expect(
      owner.runAppServerCall(async () => {
        throw new Error("app-server rpc failed");
      }),
    ).rejects.toThrowError("app-server rpc failed");
    expect(owner.getRuntimeState()).toMatchObject({
      appReady: true,
      lastError: "app-server rpc failed",
    });
  });

  it("marks codex unavailable and skips ipc bootstrap when app-server reports codex missing", async () => {
    const codexUnavailableMessage = "app-server process error: spawn codex ENOENT";
    const appClient = new TestAppServerClient({
      listThreadsImplementation: async () => {
        throw new AppServerTransportError(codexUnavailableMessage);
      },
    });
    const ipcClient = new TestDesktopIpcClient();
    const owner = createOwner({
      appClient,
      ipcClient,
    });

    await owner.bootstrapConnections();

    expect(ipcClient.connectCalls).toBe(0);
    expect(ipcClient.initializeLabels).toEqual([]);
    expect(owner.getRuntimeState()).toMatchObject({
      codexAvailable: false,
      appReady: false,
      lastError: codexUnavailableMessage,
    });
    expect(() => owner.ensureCodexAvailable()).toThrowError("Codex backend is not available");
  });

  it("coalesces concurrent bootstrap calls into one in-flight execution", async () => {
    let releaseListThreads = () => {};
    const listThreadsGate = new Promise<void>((resolve) => {
      releaseListThreads = resolve;
    });
    const appClient = new TestAppServerClient({
      listThreadsImplementation: async () => {
        await listThreadsGate;
        return EMPTY_LIST_THREADS_RESPONSE;
      },
    });
    const owner = createOwner({
      appClient,
    });

    const firstBootstrap = owner.bootstrapConnections();
    const secondBootstrap = owner.bootstrapConnections();
    releaseListThreads();

    await Promise.all([firstBootstrap, secondBootstrap]);

    expect(appClient.listThreadsCalls).toHaveLength(1);
  });

  it("schedules one reconnect bootstrap when ipc disconnects while started", async () => {
    vi.useFakeTimers();
    const appClient = new TestAppServerClient();
    const ipcClient = new TestDesktopIpcClient();
    const owner = createOwner({
      appClient,
      ipcClient,
    });
    owner.markStarted();

    owner.handleIpcConnectionState({
      connected: false,
      reason: "IPC socket closed",
    });
    owner.handleIpcConnectionState({
      connected: false,
      reason: "IPC socket closed",
    });
    await vi.advanceTimersByTimeAsync(TEST_RECONNECT_DELAY_MILLISECONDS);

    expect(appClient.listThreadsCalls).toHaveLength(1);
    expect(ipcClient.connectCalls).toBe(1);
    expect(ipcClient.initializeLabels).toEqual([TEST_LABEL]);
  });

  it("clears pending reconnect timers when stopped", async () => {
    vi.useFakeTimers();
    const appClient = new TestAppServerClient();
    const owner = createOwner({
      appClient,
    });
    owner.markStarted();

    owner.handleIpcConnectionState({
      connected: false,
      reason: "IPC socket closed",
    });
    owner.markStopped();
    await vi.advanceTimersByTimeAsync(TEST_RECONNECT_DELAY_MILLISECONDS);

    expect(appClient.listThreadsCalls).toHaveLength(0);
  });

  it("clears reconnect timers when ipc reconnects before retry delay", async () => {
    vi.useFakeTimers();
    const appClient = new TestAppServerClient();
    const owner = createOwner({
      appClient,
    });
    owner.markStarted();

    owner.handleIpcConnectionState({
      connected: false,
      reason: "IPC socket closed",
    });
    owner.handleIpcConnectionState({
      connected: true,
    });
    await vi.advanceTimersByTimeAsync(TEST_RECONNECT_DELAY_MILLISECONDS);

    expect(appClient.listThreadsCalls).toHaveLength(0);
  });

  it("classifies ENOENT process errors as codex unavailable", () => {
    expect(
      isCodexUnavailableBootstrapErrorMessage("app-server process error: spawn codex ENOENT"),
    ).toBe(true);
  });

  it("classifies not-found process errors as codex unavailable", () => {
    expect(
      isCodexUnavailableBootstrapErrorMessage("app-server process error: executable not found"),
    ).toBe(true);
  });

  it("does not classify unrelated transport errors as codex unavailable", () => {
    expect(isCodexUnavailableBootstrapErrorMessage("app-server transport closed")).toBe(false);
  });
});

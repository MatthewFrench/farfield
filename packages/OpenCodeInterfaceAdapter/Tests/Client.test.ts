import { describe, expect, it, vi, type Mock } from "vitest";
import {
  OpenCodeConnection,
  type OpenCodeClientConfiguration,
  type OpenCodeConnectionDependencies,
  type OpenCodeServerHandle,
  type OpenCodeServerStartOptions
} from "../Source/Client.js";
import type {
  OpenCodeApiResponseEnvelope,
  OpenCodeMonitorClient,
  OpenCodeSessionCreateRequest,
  OpenCodeSessionListRequest,
  OpenCodeSessionPromptRequest,
  OpenCodeSessionReadRequest
} from "../Source/ClientContracts.js";

type CreateServerFunction = (
  options: OpenCodeServerStartOptions
) => Promise<OpenCodeServerHandle>;
type CreateClientFunction = (
  configuration: OpenCodeClientConfiguration
) => OpenCodeMonitorClient;

interface OpenCodeConnectionDependenciesDouble {
  dependencies: OpenCodeConnectionDependencies;
  createServer: Mock<CreateServerFunction>;
  createClient: Mock<CreateClientFunction>;
  closeServer: Mock<() => void>;
  client: OpenCodeMonitorClient;
}

function createResponseEnvelope(data?: OpenCodeApiResponseEnvelope["data"]): OpenCodeApiResponseEnvelope {
  if (data === undefined) {
    return {};
  }

  return {
    data
  };
}

function createMonitorClientDouble(): OpenCodeMonitorClient {
  return {
    session: {
      list: async (_input?: OpenCodeSessionListRequest) => createResponseEnvelope([]),
      create: async (_input: OpenCodeSessionCreateRequest) => createResponseEnvelope(),
      get: async (_input: OpenCodeSessionReadRequest) => createResponseEnvelope(),
      messages: async (_input: OpenCodeSessionReadRequest) => createResponseEnvelope([]),
      prompt: async (_input: OpenCodeSessionPromptRequest) => createResponseEnvelope(),
      abort: async (_input: OpenCodeSessionReadRequest) => createResponseEnvelope(),
      delete: async (_input: OpenCodeSessionReadRequest) => createResponseEnvelope()
    },
    project: {
      list: async () => createResponseEnvelope([])
    }
  };
}

function createConnectionDependenciesDouble(): OpenCodeConnectionDependenciesDouble {
  const closeServer = vi.fn<() => void>();
  const client = createMonitorClientDouble();
  const createServer = vi.fn<CreateServerFunction>();
  createServer.mockResolvedValue({
    url: "http://127.0.0.1:6142",
    close: closeServer
  });
  const createClient = vi.fn<CreateClientFunction>();
  createClient.mockReturnValue(client);

  return {
    dependencies: {
      createServer,
      createClient
    },
    createServer,
    createClient,
    closeServer,
    client
  };
}

describe("OpenCodeConnection", () => {
  it("rejects invalid connection options at boundary parse", () => {
    expect(() => new OpenCodeConnection({ url: "   " })).toThrow();
    expect(() => new OpenCodeConnection({ port: -1 })).toThrow();
  });

  it("uses provided URL and skips local server startup", async () => {
    const dependenciesDouble = createConnectionDependenciesDouble();
    const connection = new OpenCodeConnection(
      {
        url: "  http://localhost:7777  "
      },
      dependenciesDouble.dependencies
    );

    await connection.start();

    expect(dependenciesDouble.createServer).not.toHaveBeenCalled();
    expect(dependenciesDouble.createClient).toHaveBeenCalledWith({
      baseUrl: "http://localhost:7777"
    });
    expect(connection.isConnected()).toBe(true);
    expect(connection.getUrl()).toBe("http://localhost:7777");
    expect(connection.getClient()).toBe(dependenciesDouble.client);
  });

  it("starts local server using owned defaults when URL is not provided", async () => {
    const dependenciesDouble = createConnectionDependenciesDouble();
    const connection = new OpenCodeConnection({}, dependenciesDouble.dependencies);

    await connection.start();

    expect(dependenciesDouble.createServer).toHaveBeenCalledWith({
      hostname: "127.0.0.1",
      port: 0,
      timeoutMilliseconds: 30_000
    });
    expect(dependenciesDouble.createClient).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:6142"
    });
    expect(connection.getUrl()).toBe("http://127.0.0.1:6142");
  });

  it("closes owned server resources on stop", async () => {
    const dependenciesDouble = createConnectionDependenciesDouble();
    const connection = new OpenCodeConnection({}, dependenciesDouble.dependencies);

    await connection.start();
    await connection.stop();

    expect(dependenciesDouble.closeServer).toHaveBeenCalledTimes(1);
    expect(connection.isConnected()).toBe(false);
    expect(connection.getUrl()).toBeNull();
    expect(() => connection.getClient()).toThrow("OpenCode connection not started");
  });

  it("keeps configured URL available before start", () => {
    const connection = new OpenCodeConnection({
      url: "http://localhost:8888"
    });

    expect(connection.getUrl()).toBe("http://localhost:8888");
  });
});

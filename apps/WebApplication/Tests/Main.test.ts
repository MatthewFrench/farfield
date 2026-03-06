import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface GlobalClientCrashReporterOptions {
  source: string;
  readThreadId?: () => string | null;
  readUrl?: () => string | null;
}

interface WebShellHealthResponse {
  ok: true;
  service: "farfield-web-shell";
  buildId: string;
  gitCommit: string | null;
  serviceWorkerVersion: string | null;
  timestamp: string;
}

interface ServiceWorkerControllerChangeReloadDecisionInput {
  reloadSuppressed: boolean;
}

interface ServiceWorkerStartupRegistration {
  waiting: ServiceWorker | null;
  installing: ServiceWorker | null;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => void;
  dispatchEvent: (event: Event) => boolean;
}

interface ServiceWorkerStartupContainer {
  controller: ServiceWorker | null;
  register: (scriptUrl: string) => Promise<ServiceWorkerStartupRegistration>;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) => void;
  dispatchEvent: (event: Event) => boolean;
}

const DISPLAY_MODE_STANDALONE_MEDIA_QUERY = "(display-mode: standalone)";
const STANDALONE_DISPLAY_MODE_CLASS_NAME = "standalone-display-mode";
const BOOT_SPLASH_ELEMENT_IDENTIFIER = "boot-splash";
const BOOT_SPLASH_HIDDEN_CLASS_NAME = "boot-splash--hidden";
const BOOT_SPLASH_REMOVE_DELAY_MILLISECONDS = 220;
const APPLICATION_ROOT_ELEMENT_IDENTIFIER = "root";
const SERVICE_WORKER_SCRIPT_PATH = "/sw.js";

const mainModuleMocks = vi.hoisted(() => {
  const render = vi.fn<(content: ReactNode) => void>();
  const createRoot = vi.fn<
    (container: Element | DocumentFragment) => {
      render: (content: ReactNode) => void;
    }
  >(() => ({
    render,
  }));
  const reconcilePushSubscription = vi.fn(async (): Promise<void> => {});
  const getWebShellHealth = vi.fn(
    async (): Promise<WebShellHealthResponse> => ({
      ok: true,
      service: "farfield-web-shell",
      buildId: "build-1",
      gitCommit: "commit-1",
      serviceWorkerVersion: "sw-1",
      timestamp: "2026-03-05T00:00:00.000Z",
    }),
  );
  const installGlobalClientCrashReporter = vi.fn(
    (_options: GlobalClientCrashReporterOptions): { remove: () => void } => ({
      remove: (): void => {},
    }),
  );
  const reloadApplicationWindow = vi.fn((): void => {});
  const parseFromLocation = vi.fn(
    (
      _pathname: string,
      _search: string,
    ): {
      threadId: string | null;
      tab: "chat" | "debug";
      settingsWorkspaceSection: "notifications" | "debug";
    } => ({
      threadId: "thread-from-mapper",
      tab: "chat",
      settingsWorkspaceSection: "notifications",
    }),
  );
  const serviceWorkerControllerChangeReloadOwnerConstructorArguments: boolean[] = [];
  const readReloadDecision = vi.fn(
    (_input: ServiceWorkerControllerChangeReloadDecisionInput): { shouldReload: boolean } => ({
      shouldReload: false,
    }),
  );

  class MockServiceWorkerControllerChangeReloadOwner {
    public constructor(hasInitialController: boolean) {
      serviceWorkerControllerChangeReloadOwnerConstructorArguments.push(hasInitialController);
    }

    public readDecision(input: ServiceWorkerControllerChangeReloadDecisionInput): {
      shouldReload: boolean;
    } {
      return readReloadDecision(input);
    }

    public completePendingReloadDecision(_shouldReload: boolean): void {}
  }

  return {
    render,
    createRoot,
    reconcilePushSubscription,
    getWebShellHealth,
    installGlobalClientCrashReporter,
    reloadApplicationWindow,
    parseFromLocation,
    serviceWorkerControllerChangeReloadOwnerConstructorArguments,
    readReloadDecision,
    MockServiceWorkerControllerChangeReloadOwner,
  };
});

vi.mock("react-dom/client", () => ({
  createRoot: mainModuleMocks.createRoot,
}));

vi.mock("../Source/App", () => ({
  App: (): null => null,
}));

vi.mock("../Source/Features/PushNotifications/DataAccess/PushClientApi", () => ({
  reconcilePushSubscription: mainModuleMocks.reconcilePushSubscription,
}));

vi.mock("../Source/Application/DataAccess/WebShellApi", () => ({
  getWebShellHealth: mainModuleMocks.getWebShellHealth,
}));

vi.mock("../Source/Application/Boot/InstallClientErrorReporter", () => ({
  installGlobalClientCrashReporter: mainModuleMocks.installGlobalClientCrashReporter,
}));

vi.mock("../Source/Application/Boot/ApplicationWindowReloadOwner", () => ({
  reloadApplicationWindow: mainModuleMocks.reloadApplicationWindow,
}));

vi.mock("../Source/Application/Boot/ServiceWorkerControllerChangeReloadOwner", () => ({
  ServiceWorkerControllerChangeReloadOwner:
    mainModuleMocks.MockServiceWorkerControllerChangeReloadOwner,
}));

vi.mock("../Source/Application/DomainModel/ApplicationRouteStateMapper", () => {
  class MockApplicationRouteStateMapper {
    public parseFromLocation(
      pathname: string,
      search: string,
    ): {
      threadId: string | null;
      tab: "chat" | "debug";
      settingsWorkspaceSection: "notifications" | "debug";
    } {
      return mainModuleMocks.parseFromLocation(pathname, search);
    }
  }

  return {
    ApplicationRouteStateMapper: MockApplicationRouteStateMapper,
  };
});

let standaloneDisplayModeEnabled = false;
let animationFrameCallbacks: FrameRequestCallback[] = [];

function createMediaQueryList(query: string): MediaQueryList {
  return {
    matches: query === DISPLAY_MODE_STANDALONE_MEDIA_QUERY && standaloneDisplayModeEnabled,
    media: query,
    onchange: null,
    addListener: (
      _listener: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null,
    ): void => {},
    removeListener: (
      _listener: ((this: MediaQueryList, ev: MediaQueryListEvent) => void) | null,
    ): void => {},
    addEventListener: (
      _type: string,
      _listener: EventListenerOrEventListenerObject | null,
      _options?: boolean | AddEventListenerOptions,
    ): void => {},
    removeEventListener: (
      _type: string,
      _listener: EventListenerOrEventListenerObject | null,
      _options?: boolean | EventListenerOptions,
    ): void => {},
    dispatchEvent: (_event: Event): boolean => true,
  };
}

function installWindowBootstrapStubs(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => createMediaQueryList(query),
  });

  animationFrameCallbacks = [];
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback): number => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    },
  });
}

function enqueueApplicationRootElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.id = APPLICATION_ROOT_ELEMENT_IDENTIFIER;
  document.body.append(root);
  return root;
}

function enqueueBootSplashElement(): HTMLDivElement {
  const splash = document.createElement("div");
  splash.id = BOOT_SPLASH_ELEMENT_IDENTIFIER;
  document.body.append(splash);
  return splash;
}

function runNextAnimationFrame(): void {
  const callback = animationFrameCallbacks.shift();
  if (!callback) {
    throw new Error("Expected a queued animation frame callback");
  }
  callback(0);
}

async function importMainModule(): Promise<void> {
  await import("../Source/Main");
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  mainModuleMocks.readReloadDecision.mockImplementation(
    (_input: ServiceWorkerControllerChangeReloadDecisionInput): { shouldReload: boolean } => ({
      shouldReload: false,
    }),
  );
  mainModuleMocks.getWebShellHealth.mockImplementation(
    async (): Promise<WebShellHealthResponse> => ({
      ok: true,
      service: "farfield-web-shell",
      buildId: "build-1",
      gitCommit: "commit-1",
      serviceWorkerVersion: "sw-1",
      timestamp: "2026-03-05T00:00:00.000Z",
    }),
  );
  mainModuleMocks.reloadApplicationWindow.mockImplementation((): void => {});
  standaloneDisplayModeEnabled = false;
  document.documentElement.className = "";
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/");
  installWindowBootstrapStubs();
  Reflect.deleteProperty(window.navigator, "serviceWorker");
  mainModuleMocks.serviceWorkerControllerChangeReloadOwnerConstructorArguments.splice(0);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Main bootstrap", () => {
  it("throws a clear error when the #root mount element is missing", async () => {
    await expect(importMainModule()).rejects.toThrow(
      "Failed to mount Farfield: missing #root element",
    );
  });

  it("mounts app shell, wires crash reporting readers, and dismisses boot splash after two paint frames", async () => {
    standaloneDisplayModeEnabled = true;
    const rootElement = enqueueApplicationRootElement();
    const splashElement = enqueueBootSplashElement();
    window.history.replaceState(null, "", "/threads/thread-123?view=chat");

    await importMainModule();

    expect(mainModuleMocks.createRoot).toHaveBeenCalledWith(rootElement);
    expect(mainModuleMocks.render).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains(STANDALONE_DISPLAY_MODE_CLASS_NAME)).toBe(
      true,
    );

    const crashReporterCall = mainModuleMocks.installGlobalClientCrashReporter.mock.calls[0];
    if (!crashReporterCall) {
      throw new Error("Expected crash reporter install call");
    }
    const crashReporterOptions = crashReporterCall[0];
    expect(crashReporterOptions.source).toBe("farfield-web");
    expect(crashReporterOptions.readThreadId?.()).toBe("thread-from-mapper");
    expect(mainModuleMocks.parseFromLocation).toHaveBeenCalledWith(
      "/threads/thread-123",
      "?view=chat",
    );
    expect(crashReporterOptions.readUrl?.()).toBe("/threads/thread-123?view=chat");

    runNextAnimationFrame();
    runNextAnimationFrame();
    expect(splashElement.classList.contains(BOOT_SPLASH_HIDDEN_CLASS_NAME)).toBe(true);
    vi.advanceTimersByTime(BOOT_SPLASH_REMOVE_DELAY_MILLISECONDS);
    expect(document.getElementById(BOOT_SPLASH_ELEMENT_IDENTIFIER)).toBeNull();
  });

  it("registers the service worker on load and reconciles push subscription after successful registration", async () => {
    enqueueApplicationRootElement();
    const serviceWorkerRegistrationEvents = new EventTarget();
    const serviceWorkerRegistration: ServiceWorkerStartupRegistration = {
      waiting: null,
      installing: null,
      addEventListener: serviceWorkerRegistrationEvents.addEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      removeEventListener: serviceWorkerRegistrationEvents.removeEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      dispatchEvent: serviceWorkerRegistrationEvents.dispatchEvent.bind(
        serviceWorkerRegistrationEvents,
      ),
    };
    const registerServiceWorker = vi.fn(
      async (_scriptUrl: string): Promise<ServiceWorkerStartupRegistration> =>
        serviceWorkerRegistration,
    );
    const serviceWorkerContainerEvents = new EventTarget();
    const serviceWorkerContainer: ServiceWorkerStartupContainer = {
      controller: null,
      register: registerServiceWorker,
      addEventListener: serviceWorkerContainerEvents.addEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      removeEventListener: serviceWorkerContainerEvents.removeEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      dispatchEvent: serviceWorkerContainerEvents.dispatchEvent.bind(serviceWorkerContainerEvents),
    };

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerContainer,
    });

    await importMainModule();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();

    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
    expect(registerServiceWorker).toHaveBeenCalledWith(SERVICE_WORKER_SCRIPT_PATH);
    expect(mainModuleMocks.reconcilePushSubscription).toHaveBeenCalledTimes(1);
    expect(mainModuleMocks.serviceWorkerControllerChangeReloadOwnerConstructorArguments).toEqual([
      false,
    ]);
  });

  it("does not reload on controllerchange when no pending service-worker update was observed", async () => {
    enqueueApplicationRootElement();
    mainModuleMocks.readReloadDecision.mockReturnValue({
      shouldReload: true,
    });
    mainModuleMocks.getWebShellHealth
      .mockResolvedValueOnce({
        ok: true,
        service: "farfield-web-shell",
        buildId: "build-1",
        gitCommit: "commit-1",
        serviceWorkerVersion: "sw-1",
        timestamp: "2026-03-05T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        service: "farfield-web-shell",
        buildId: "build-2",
        gitCommit: "commit-2",
        serviceWorkerVersion: "sw-2",
        timestamp: "2026-03-05T00:00:01.000Z",
      });

    const serviceWorkerRegistrationEvents = new EventTarget();
    const serviceWorkerRegistration: ServiceWorkerStartupRegistration = {
      waiting: null,
      installing: null,
      addEventListener: serviceWorkerRegistrationEvents.addEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      removeEventListener: serviceWorkerRegistrationEvents.removeEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      dispatchEvent: serviceWorkerRegistrationEvents.dispatchEvent.bind(
        serviceWorkerRegistrationEvents,
      ),
    };
    const registerServiceWorker = vi.fn(
      async (_scriptUrl: string): Promise<ServiceWorkerStartupRegistration> =>
        serviceWorkerRegistration,
    );
    const serviceWorkerContainerEvents = new EventTarget();
    const serviceWorkerContainer: ServiceWorkerStartupContainer = {
      controller: {} as ServiceWorker,
      register: registerServiceWorker,
      addEventListener: serviceWorkerContainerEvents.addEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      removeEventListener: serviceWorkerContainerEvents.removeEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      dispatchEvent: serviceWorkerContainerEvents.dispatchEvent.bind(serviceWorkerContainerEvents),
    };

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerContainer,
    });

    await importMainModule();
    window.dispatchEvent(new Event("load"));
    await flushMicrotasks();

    serviceWorkerContainer.dispatchEvent(new Event("controllerchange"));
    await flushMicrotasks();

    expect(mainModuleMocks.reloadApplicationWindow).not.toHaveBeenCalled();
  });

  it("reloads on controllerchange when a pending service-worker update changed the web-shell version", async () => {
    enqueueApplicationRootElement();
    mainModuleMocks.readReloadDecision.mockReturnValue({
      shouldReload: true,
    });
    mainModuleMocks.getWebShellHealth
      .mockResolvedValueOnce({
        ok: true,
        service: "farfield-web-shell",
        buildId: "build-1",
        gitCommit: "commit-1",
        serviceWorkerVersion: "sw-1",
        timestamp: "2026-03-05T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        ok: true,
        service: "farfield-web-shell",
        buildId: "build-2",
        gitCommit: "commit-2",
        serviceWorkerVersion: "sw-2",
        timestamp: "2026-03-05T00:00:01.000Z",
      });

    const serviceWorkerRegistrationEvents = new EventTarget();
    const serviceWorkerRegistration: ServiceWorkerStartupRegistration = {
      waiting: {} as ServiceWorker,
      installing: null,
      addEventListener: serviceWorkerRegistrationEvents.addEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      removeEventListener: serviceWorkerRegistrationEvents.removeEventListener.bind(
        serviceWorkerRegistrationEvents,
      ),
      dispatchEvent: serviceWorkerRegistrationEvents.dispatchEvent.bind(
        serviceWorkerRegistrationEvents,
      ),
    };
    const registerServiceWorker = vi.fn(
      async (_scriptUrl: string): Promise<ServiceWorkerStartupRegistration> =>
        serviceWorkerRegistration,
    );
    const serviceWorkerContainerEvents = new EventTarget();
    const serviceWorkerContainer: ServiceWorkerStartupContainer = {
      controller: {} as ServiceWorker,
      register: registerServiceWorker,
      addEventListener: serviceWorkerContainerEvents.addEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      removeEventListener: serviceWorkerContainerEvents.removeEventListener.bind(
        serviceWorkerContainerEvents,
      ),
      dispatchEvent: serviceWorkerContainerEvents.dispatchEvent.bind(serviceWorkerContainerEvents),
    };

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerContainer,
    });

    await importMainModule();
    window.dispatchEvent(new Event("load"));
    await flushMicrotasks();

    serviceWorkerContainer.dispatchEvent(new Event("controllerchange"));
    await flushMicrotasks();

    expect(mainModuleMocks.reloadApplicationWindow).toHaveBeenCalledTimes(1);
  });
});

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi, type Mock } from "vitest";

type PushEventLike = {
  data: { text: () => string } | null;
  waitUntil: (promise: Promise<void>) => void;
};

type NotificationClickEventLike = {
  notification: {
    close: () => void;
    data: {
      notificationId?: string;
      url?: string;
      threadId?: string;
      turnId?: string;
    };
  };
  waitUntil: (promise: Promise<void>) => void;
};

type MessageEventLike = {
  data?: {
    type?: string;
  };
  waitUntil: (promise: Promise<void>) => void;
};

type ServiceWorkerHandlers = {
  push?: (event: PushEventLike) => void;
  notificationclick?: (event: NotificationClickEventLike) => void;
  message?: (event: MessageEventLike) => void;
};

interface ClientLike {
  url: string;
  focus: () => Promise<void>;
  navigate?: (url: string) => Promise<void>;
}

interface ServiceWorkerHarness {
  handlers: ServiceWorkerHandlers;
  fetchMock: Mock<() => Promise<Response>>;
  showNotificationMock: Mock<() => Promise<void>>;
  openWindowMock: Mock<() => Promise<void>>;
  skipWaitingMock: Mock<() => Promise<void>>;
  matchAllMock: Mock<() => Promise<Array<ClientLike>>>;
  cacheOpenMock: Mock<
    () => Promise<{
      match: (request: Request | string) => Promise<Response | undefined>;
      put: (request: Request | string, response: Response) => Promise<void>;
      delete: (request: Request | string) => Promise<boolean>;
    }>
  >;
}

function loadServiceWorkerHarness(): ServiceWorkerHarness {
  const handlers: ServiceWorkerHandlers = {};
  const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  const showNotificationMock = vi.fn(async () => undefined);
  const openWindowMock = vi.fn(async () => undefined);
  const skipWaitingMock = vi.fn(async () => undefined);
  const matchAllMock = vi.fn(async (): Promise<ClientLike[]> => []);
  const cacheStore = new Map<string, string>();
  const cacheOpenMock = vi.fn(async () => ({
    match: async (request: Request | string) => {
      const requestUrl = typeof request === "string" ? request : request.url;
      const matched = cacheStore.get(requestUrl);
      if (typeof matched !== "string") {
        return undefined;
      }
      return new Response(matched, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    },
    put: async (request: Request | string, response: Response) => {
      const requestUrl = typeof request === "string" ? request : request.url;
      cacheStore.set(requestUrl, await response.text());
    },
    delete: async (request: Request | string) => {
      const requestUrl = typeof request === "string" ? request : request.url;
      return cacheStore.delete(requestUrl);
    }
  }));

  const scriptPath = path.resolve(process.cwd(), "public/sw.js");
  const scriptSource = fs.readFileSync(scriptPath, "utf8");

  const selfScope = {
    addEventListener: (
      type: string,
      handler: ((event: PushEventLike) => void) | ((event: NotificationClickEventLike) => void) | ((event: MessageEventLike) => void)
    ) => {
      if (type === "push") {
        handlers.push = handler as (event: PushEventLike) => void;
        return;
      }
      if (type === "notificationclick") {
        handlers.notificationclick = handler as (event: NotificationClickEventLike) => void;
        return;
      }
      if (type === "message") {
        handlers.message = handler as (event: MessageEventLike) => void;
      }
    },
    registration: {
      showNotification: showNotificationMock
    },
    clients: {
      matchAll: matchAllMock,
      openWindow: openWindowMock
    },
    caches: {
      open: cacheOpenMock
    },
    skipWaiting: skipWaitingMock,
    location: {
      origin: "https://example.test",
      href: "https://example.test/sw.js"
    }
  };

  vm.runInNewContext(scriptSource, {
    self: selfScope,
    fetch: fetchMock,
    URL,
    Request,
    Response,
    Headers,
    Date,
    Promise,
    String
  });

  return {
    handlers,
    fetchMock,
    showNotificationMock,
    openWindowMock,
    skipWaitingMock,
    matchAllMock,
    cacheOpenMock
  };
}

function receiptFromFetchCall(fetchCall: [string, RequestInit?] | undefined): {
  notificationId: string;
  event: string;
  url: string;
  threadId?: string | null;
  turnId?: string | null;
  message?: string | null;
} {
  const init = fetchCall?.[1];
  const body = String(init?.body ?? "{}");
  return JSON.parse(body);
}

describe("service worker notifications", () => {
  it("records shown receipt for push notifications", async () => {
    const harness = loadServiceWorkerHarness();
    const pushHandler = harness.handlers.push;
    expect(pushHandler).toBeDefined();

    const waitUntilPromises: Promise<void>[] = [];
    pushHandler?.({
      data: {
        text: () =>
          JSON.stringify({
            notificationId: "notif_1",
            title: "Codex response ready",
            body: "A response is ready in Farfield.",
            url: "/threads/thread_1",
            threadId: "thread_1",
            turnId: "turn_1",
            createdAt: "2026-01-01T00:00:00.000Z",
            web_push: {
              notification: {
                title: "Codex response ready",
                navigate: "/threads/thread_1",
                tag: "thread:thread_1"
              }
            }
          })
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);

    expect(harness.showNotificationMock).toHaveBeenCalledTimes(1);
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const receipt = receiptFromFetchCall(harness.fetchMock.mock.calls[0] as [string, RequestInit?] | undefined);
    expect(receipt.notificationId).toBe("notif_1");
    expect(receipt.event).toBe("shown");
    expect(receipt.url).toBe("/threads/thread_1");
    expect(receipt.threadId).toBe("thread_1");
    expect(receipt.turnId).toBe("turn_1");
  });

  it("records error receipt and skips notification for malformed push payloads", async () => {
    const harness = loadServiceWorkerHarness();
    const pushHandler = harness.handlers.push;
    expect(pushHandler).toBeDefined();

    const waitUntilPromises: Promise<void>[] = [];
    pushHandler?.({
      data: {
        text: () =>
          JSON.stringify({
            notificationId: "notif_bad",
            title: "Codex response ready",
            body: "missing required fields"
          })
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);

    expect(harness.showNotificationMock).not.toHaveBeenCalled();
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const receipt = receiptFromFetchCall(harness.fetchMock.mock.calls[0] as [string, RequestInit?] | undefined);
    expect(receipt.event).toBe("error");
    expect(receipt.message).toContain("Push payload validation failed");
  });

  it("focuses matching path on notification click and records clicked receipt", async () => {
    const harness = loadServiceWorkerHarness();
    const clickHandler = harness.handlers.notificationclick;
    expect(clickHandler).toBeDefined();

    const focusMock = vi.fn(async () => undefined);
    harness.matchAllMock.mockResolvedValueOnce([
      { url: "https://example.test/threads/thread_1", focus: focusMock },
      { url: "https://example.test/threads/thread_2", focus: vi.fn(async () => undefined) }
    ]);

    const waitUntilPromises: Promise<void>[] = [];
    clickHandler?.({
      notification: {
        close: vi.fn(),
        data: {
          notificationId: "notif_1",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1"
        }
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);

    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(harness.openWindowMock).not.toHaveBeenCalled();
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const receipt = receiptFromFetchCall(harness.fetchMock.mock.calls[0] as [string, RequestInit?] | undefined);
    expect(receipt.notificationId).toBe("notif_1");
    expect(receipt.event).toBe("clicked");
    expect(receipt.url).toBe("/threads/thread_1");
  });

  it("navigates existing client when no matching path is open", async () => {
    const harness = loadServiceWorkerHarness();
    const clickHandler = harness.handlers.notificationclick;
    expect(clickHandler).toBeDefined();

    const focusMock = vi.fn(async () => undefined);
    const navigateMock = vi.fn(async () => undefined);
    harness.matchAllMock.mockResolvedValueOnce([
      {
        url: "https://example.test/threads/thread_2",
        focus: focusMock,
        navigate: navigateMock
      }
    ]);

    const waitUntilPromises: Promise<void>[] = [];
    clickHandler?.({
      notification: {
        close: vi.fn(),
        data: {
          notificationId: "notif_2",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1"
        }
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("https://example.test/threads/thread_1");
    expect(focusMock).toHaveBeenCalledTimes(1);
    expect(harness.openWindowMock).not.toHaveBeenCalled();
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const receipt = receiptFromFetchCall(harness.fetchMock.mock.calls[0] as [string, RequestInit?] | undefined);
    expect(receipt.notificationId).toBe("notif_2");
    expect(receipt.event).toBe("clicked");
    expect(receipt.url).toBe("/threads/thread_1");
  });

  it("opens a new window when no existing clients are available", async () => {
    const harness = loadServiceWorkerHarness();
    const clickHandler = harness.handlers.notificationclick;
    expect(clickHandler).toBeDefined();

    harness.matchAllMock.mockResolvedValueOnce([]);

    const waitUntilPromises: Promise<void>[] = [];
    clickHandler?.({
      notification: {
        close: vi.fn(),
        data: {
          notificationId: "notif_3",
          url: "/threads/thread_3",
          threadId: "thread_3",
          turnId: "turn_3"
        }
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);

    expect(harness.openWindowMock).toHaveBeenCalledTimes(1);
    expect(harness.openWindowMock).toHaveBeenCalledWith("https://example.test/threads/thread_3");
    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    const receipt = receiptFromFetchCall(harness.fetchMock.mock.calls[0] as [string, RequestInit?] | undefined);
    expect(receipt.notificationId).toBe("notif_3");
    expect(receipt.event).toBe("clicked");
    expect(receipt.url).toBe("/threads/thread_3");
  });

  it("applies skip waiting command from message event", async () => {
    const harness = loadServiceWorkerHarness();
    const messageHandler = harness.handlers.message;
    expect(messageHandler).toBeDefined();

    const waitUntilPromises: Promise<void>[] = [];
    messageHandler?.({
      data: {
        type: "SKIP_WAITING"
      },
      waitUntil: (promise) => {
        waitUntilPromises.push(promise.then(() => undefined));
      }
    });

    await Promise.all(waitUntilPromises);
    expect(harness.skipWaitingMock).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NtfyNotifier,
  type NtfyThreadCompletedPayload,
  parseNtfyConfigFromEnv,
} from "../Source/Modules/PushNotifications/NtfyNotifier.js";

interface NtfyThreadCompletedPayloadOverrides {
  threadId?: string;
  preview?: string;
  projectName?: string;
  threadName?: string;
  agentText?: string;
}

function buildThreadCompletedPayload(
  overrides: NtfyThreadCompletedPayloadOverrides = {},
): NtfyThreadCompletedPayload {
  return {
    threadId: overrides.threadId ?? "thread-1",
    preview: overrides.preview ?? "Fix tests",
    projectName: overrides.projectName ?? "Farfield",
    threadName: overrides.threadName ?? "Fix tests",
    agentText: overrides.agentText ?? "Completed",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseNtfyConfigFromEnv", () => {
  it("returns disabled defaults when env is empty", () => {
    const parsed = parseNtfyConfigFromEnv({});

    expect(parsed.enabled).toBe(false);
    expect(parsed.topic).toBeNull();
    expect(parsed.baseUrl).toBe("https://ntfy.sh");
    expect(parsed.bearerToken).toBeNull();
    expect(parsed.priority).toBe("3");
  });

  it("requires topic when enabled", () => {
    expect(() =>
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
      }),
    ).toThrowError(/NTFY_TOPIC is required/);
  });

  it("parses enabled configuration", () => {
    const parsed = parseNtfyConfigFromEnv({
      NTFY_ENABLED: "1",
      NTFY_TOPIC: "farfield",
      NTFY_BASE_URL: "https://ntfy.example.com",
      NTFY_BEARER_TOKEN: "secret",
      NTFY_PRIORITY: "5",
    });

    expect(parsed.enabled).toBe(true);
    expect(parsed.topic).toBe("farfield");
    expect(parsed.baseUrl).toBe("https://ntfy.example.com");
    expect(parsed.bearerToken).toBe("secret");
    expect(parsed.priority).toBe("5");
  });

  it("rejects invalid priority values", () => {
    expect(() =>
      parseNtfyConfigFromEnv({
        NTFY_PRIORITY: "9",
      }),
    ).toThrowError();
  });
});

describe("NtfyNotifier.publishThreadCompleted", () => {
  it("does not publish when disabled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "false",
      }),
    );

    const result = await notifier.publishThreadCompleted(buildThreadCompletedPayload());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.messageId).toBeNull();
  });

  it("publishes a completion notification", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("msg_123", { status: 200 }));

    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
        NTFY_TOPIC: "farfield",
        NTFY_BASE_URL: "https://ntfy.example.com",
        NTFY_BEARER_TOKEN: "token-123",
        NTFY_PRIORITY: "4",
      }),
    );

    const result = await notifier.publishThreadCompleted(
      buildThreadCompletedPayload({
        preview: "Fix flaky tests",
        threadName: "Fix flaky tests",
        agentText: "Done and green.",
      }),
    );

    expect(result.messageId).toBe("msg_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ntfy.example.com/farfield");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestHeaders = new Headers(requestInit?.headers);
    expect(requestInit?.method).toBe("POST");
    expect(requestHeaders.get("Authorization")).toBe("Bearer token-123");
    expect(requestHeaders.get("Priority")).toBe("4");
    expect(requestHeaders.get("Title")).toBe("Farfield - Fix flaky tests");
    expect(requestHeaders.get("Tags")).toBe("white_check_mark,robot_face");
    expect(requestHeaders.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(String(requestInit?.body ?? "")).toBe("Done and green.");
  });

  it("normalizes empty project and thread titles and applies default body", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("msg_456", { status: 200 }));

    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
        NTFY_TOPIC: "project updates/ios",
        NTFY_BASE_URL: "https://ntfy.example.com/custom/path",
      }),
    );

    await notifier.publishThreadCompleted(
      buildThreadCompletedPayload({
        projectName: "  ",
        threadName: "",
        agentText: "   ",
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://ntfy.example.com/custom/path/project%20updates%2Fios",
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const requestHeaders = new Headers(requestInit?.headers);
    expect(requestHeaders.get("Title")).toBe("No project - Thread");
    expect(String(requestInit?.body ?? "")).toBe("Response ready.");
  });

  it("truncates long agent text to the notifier maximum", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("msg_789", { status: 200 }));

    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
        NTFY_TOPIC: "farfield",
      }),
    );

    await notifier.publishThreadCompleted(
      buildThreadCompletedPayload({
        agentText: "x".repeat(3_500),
      }),
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const bodyText = String(requestInit?.body ?? "");
    expect(bodyText.length).toBe(3_000);
    expect(bodyText.endsWith("...")).toBe(true);
    expect(bodyText).toBe(`${"x".repeat(2_997)}...`);
  });

  it("rejects invalid payloads before issuing a publish request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
        NTFY_TOPIC: "farfield",
      }),
    );

    await expect(
      Reflect.apply(notifier.publishThreadCompleted, notifier, [{}]),
    ).rejects.toThrowError();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

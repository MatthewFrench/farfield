import { afterEach, describe, expect, it, vi } from "vitest";
import { NtfyNotifier, parseNtfyConfigFromEnv } from "../Source/NtfyNotifier.js";

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
        NTFY_ENABLED: "true"
      })
    ).toThrowError(/NTFY_TOPIC is required/);
  });

  it("parses enabled configuration", () => {
    const parsed = parseNtfyConfigFromEnv({
      NTFY_ENABLED: "1",
      NTFY_TOPIC: "farfield",
      NTFY_BASE_URL: "https://ntfy.example.com",
      NTFY_BEARER_TOKEN: "secret",
      NTFY_PRIORITY: "5"
    });

    expect(parsed.enabled).toBe(true);
    expect(parsed.topic).toBe("farfield");
    expect(parsed.baseUrl).toBe("https://ntfy.example.com");
    expect(parsed.bearerToken).toBe("secret");
    expect(parsed.priority).toBe("5");
  });
});

describe("NtfyNotifier.publishThreadCompleted", () => {
  it("does not publish when disabled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "false"
      })
    );

    const result = await notifier.publishThreadCompleted({
      threadId: "thread-1",
      preview: "Fix tests",
      projectName: "Farfield",
      threadName: "Fix tests",
      agentText: "Completed"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.messageId).toBeNull();
  });

  it("publishes a completion notification", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => "msg_123"
    } as Response);

    const notifier = new NtfyNotifier(
      parseNtfyConfigFromEnv({
        NTFY_ENABLED: "true",
        NTFY_TOPIC: "farfield",
        NTFY_BASE_URL: "https://ntfy.example.com",
        NTFY_BEARER_TOKEN: "token-123",
        NTFY_PRIORITY: "4"
      })
    );

    const result = await notifier.publishThreadCompleted({
      threadId: "thread-1",
      preview: "Fix flaky tests",
      projectName: "Farfield",
      threadName: "Fix flaky tests",
      agentText: "Done and green."
    });

    expect(result.messageId).toBe("msg_123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://ntfy.example.com/farfield");

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const headers = requestInit?.headers as Record<string, string>;
    expect(requestInit?.method).toBe("POST");
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers.Priority).toBe("4");
    expect(headers.Title).toBe("Farfield - Fix flaky tests");
    expect(String(requestInit?.body ?? "")).toBe("Done and green.");
  });
});

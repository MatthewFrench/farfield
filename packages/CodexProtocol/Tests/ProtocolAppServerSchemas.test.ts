import { describe, expect, it } from "vitest";
import {
  FarfieldEventStreamEnvelopeSchema,
  FarfieldDebugObservabilityEnvelopeSchema,
  parseAppServerCollaborationModeListResponse,
  parseAppServerConfigReadResponse,
  parseAppServerListModelsResponse,
  parseAppServerListThreadsResponse,
  parseAppServerReadThreadResponse,
  parseAppServerStartThreadResponse,
  parseDebugErrorEvent
} from "../Source/Index.js";

describe("codex-protocol app-server schemas", () => {
  it("parses collaboration mode list response", () => {
    const parsed = parseAppServerCollaborationModeListResponse({
      data: [
        {
          name: "Plan",
          mode: "plan",
          model: null,
          reasoning_effort: "medium",
          developer_instructions: "Instructions"
        }
      ]
    });

    expect(parsed.data[0]?.mode).toBe("plan");
  });

  it("parses app-server model/list response with modern model shape", () => {
    const parsed = parseAppServerListModelsResponse({
      data: [
        {
          id: "gpt-5.3-codex",
          model: "gpt-5.3-codex",
          upgrade: null,
          displayName: "GPT-5.3 Codex",
          description: "Latest frontier agentic coding model.",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced"
            },
            {
              reasoningEffort: "xhigh",
              description: "Deep reasoning"
            }
          ],
          defaultReasoningEffort: "xhigh",
          inputModalities: ["text", "image"],
          supportsPersonality: true,
          isDefault: true,
          hidden: true
        }
      ],
      nextCursor: null
    });

    expect(parsed.data[0]?.id).toBe("gpt-5.3-codex");
    expect(parsed.data[0]?.["hidden"]).toBe(true);
  });

  it("parses unknown top-level keys in app-server model/list response", () => {
    const parsed = parseAppServerListModelsResponse({
      data: [
        {
          id: "gpt-5.3-codex",
          model: "gpt-5.3-codex",
          upgrade: null,
          displayName: "GPT-5.3 Codex",
          description: "Latest frontier agentic coding model.",
          supportedReasoningEfforts: [
            {
              reasoningEffort: "medium",
              description: "Balanced"
            }
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: true,
          hidden: false
        }
      ],
      nextCursor: null,
      hidden: true
    });

    expect(parsed["hidden"]).toBe(true);
  });

  it("parses app-server thread/list response from opencode agent", () => {
    const parsed = parseAppServerListThreadsResponse({
      data: [
        {
          id: "sess-1",
          preview: "Test Session",
          createdAt: 1700000000,
          updatedAt: 1700000100,
          cwd: "/tmp/project",
          source: "opencode"
        }
      ],
      nextCursor: null
    });

    expect(parsed.data[0]?.id).toBe("sess-1");
  });

  it("parses app-server thread/read response with subset validation", () => {
    const parsed = parseAppServerReadThreadResponse({
      thread: {
        id: "thread-123",
        preview: "hello",
        modelProvider: "openai",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/workspace",
        source: "cli",
        path: "/tmp/thread.jsonl",
        cliVersion: "0.1.0",
        turns: [
          {
            id: "turn-1",
            status: "completed",
            items: [
              {
                id: "item-1",
                type: "agentMessage",
                text: "hello"
              }
            ]
          }
        ]
      }
    });

    expect(parsed.thread.id).toBe("thread-123");
    expect(parsed.thread.requests).toEqual([]);
    expect(parsed.thread.turns[0]?.status).toBe("completed");
  });

  it("parses app-server thread/start response", () => {
    const parsed = parseAppServerStartThreadResponse({
      thread: {
        id: "thread-456",
        preview: "",
        modelProvider: "openai",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/workspace",
        path: "/tmp/rollout.jsonl",
        cliVersion: "0.1.0",
        source: "vscode",
        gitInfo: null,
        turns: []
      },
      model: "gpt-5.3-codex",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "never",
      sandbox: {
        type: "dangerFullAccess"
      },
      reasoningEffort: "medium"
    });

    expect(parsed.thread.id).toBe("thread-456");
    expect(parsed.model).toBe("gpt-5.3-codex");
  });

  it("parses app-server thread/start response from opencode agent", () => {
    const parsed = parseAppServerStartThreadResponse({
      thread: {
        id: "sess-2",
        preview: "(untitled)",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/project",
        source: "opencode"
      },
      cwd: "/tmp/project"
    });

    expect(parsed.thread.id).toBe("sess-2");
  });

  it("parses app-server config/read response for effective defaults", () => {
    const parsed = parseAppServerConfigReadResponse({
      config: {
        profile: "personal",
        model: "gpt-5.3-codex",
        model_reasoning_effort: "medium",
        profiles: {
          personal: {
            model: "gpt-5.3-codex",
            model_reasoning_effort: "xhigh"
          }
        }
      },
      origins: {},
      layers: null
    });

    expect(parsed.config.profile).toBe("personal");
    expect(parsed.config.model_reasoning_effort).toBe("medium");
    expect(parsed.config.profiles["personal"]?.model_reasoning_effort).toBe("xhigh");
  });

  it("parses farfield debug observability envelope", () => {
    const parsed = FarfieldDebugObservabilityEnvelopeSchema.parse({
      ok: true,
      snapshot: {
        recordedAt: "2026-02-26T00:00:00.000Z",
        cache: {
          threadListAggregation: {
            hitCount: 1,
            missCount: 2,
            coalescedCount: 3,
            evictionCount: 4,
            invalidationCount: 5,
            entryCount: 6,
            inFlightCount: 7
          }
        },
        concurrency: {
          thread: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            activeThreadCount: 4
          },
          pushDispatch: {
            scheduledCheckCount: 1,
            startedCheckCount: 2,
            completedCheckCount: 3,
            skippedWhileInFlightCount: 4,
            activeTimerCount: 5,
            inFlightThreadCount: 6
          },
          pushMutation: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            hasInFlightOperation: false
          }
        },
        streaming: {
          eventStream: {
            activeClientCount: 1,
            keepaliveEnabled: true,
            addedClientCount: 2,
            removedClientCount: 3,
            broadcastEventCount: 4,
            broadcastDeliveryAttemptCount: 5,
            eventWriteFailureCount: 6,
            keepaliveWriteFailureCount: 7
          }
        },
        routing: {
          threadAdapterResolver: {
            registeredLookupCount: 1,
            unregisteredDiscoveryAttemptCount: 2,
            unregisteredDiscoverySuccessCount: 3,
            unregisteredDiscoveryMissCount: 4,
            unregisteredDiscoveryMissCacheHitCount: 5,
            unregisteredDiscoveryAmbiguousCount: 6,
            unregisteredDiscoveryAlertCount: 7
          }
        }
      }
    });

    expect(parsed.snapshot.routing.threadAdapterResolver.unregisteredDiscoveryMissCacheHitCount).toBe(5);
  });

  it("parses farfield event-stream envelope for thread stream delta payloads", () => {
    const parsed = FarfieldEventStreamEnvelopeSchema.parse({
      sequence: 12,
      event: {
        type: "thread-stream-delta",
        delta: {
          threadId: "thread-1",
          liveStateSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: "client-a",
            conversationState: null,
            liveStateError: null
          },
          streamEventsSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: "client-a",
            events: [
              {
                type: "request",
                requestId: "request-1",
                method: "thread/read",
                params: {
                  threadId: "thread-1"
                }
              }
            ],
            nextSequence: 4,
            firstAvailableSequence: 2,
            resetRequired: false
          },
          streamEventsSinceSequenceUsed: 3
        }
      }
    });

    expect(parsed.event.type).toBe("thread-stream-delta");
    if (parsed.event.type !== "thread-stream-delta") {
      throw new Error("Expected thread-stream-delta payload");
    }
    expect(parsed.event.delta.streamEventsSnapshot.nextSequence).toBe(4);
  });

  it("rejects farfield event-stream envelopes when required event metadata is missing", () => {
    expect(() => FarfieldEventStreamEnvelopeSchema.parse({
      sequence: 1,
      event: {
        type: "thread-stream-delta",
        delta: {
          threadId: "thread-1",
          liveStateSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: null,
            conversationState: null,
            liveStateError: null
          },
          streamEventsSnapshot: {
            ok: true,
            threadId: "thread-1",
            ownerClientId: null,
            events: [],
            firstAvailableSequence: 0,
            resetRequired: false
          },
          streamEventsSinceSequenceUsed: null
        }
      }
    })).toThrowError(/nextSequence/);
  });

  it("rejects farfield debug observability envelope when routing stats are missing", () => {
    expect(() => FarfieldDebugObservabilityEnvelopeSchema.parse({
      ok: true,
      snapshot: {
        recordedAt: "2026-02-26T00:00:00.000Z",
        cache: {
          threadListAggregation: {
            hitCount: 1,
            missCount: 2,
            coalescedCount: 3,
            evictionCount: 4,
            invalidationCount: 5,
            entryCount: 6,
            inFlightCount: 7
          }
        },
        concurrency: {
          thread: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            activeThreadCount: 4
          },
          pushDispatch: {
            scheduledCheckCount: 1,
            startedCheckCount: 2,
            completedCheckCount: 3,
            skippedWhileInFlightCount: 4,
            activeTimerCount: 5,
            inFlightThreadCount: 6
          },
          pushMutation: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            hasInFlightOperation: false
          }
        },
        streaming: {
          eventStream: {
            activeClientCount: 1,
            keepaliveEnabled: true,
            addedClientCount: 2,
            removedClientCount: 3,
            broadcastEventCount: 4,
            broadcastDeliveryAttemptCount: 5,
            eventWriteFailureCount: 6,
            keepaliveWriteFailureCount: 7
          }
        }
      }
    })).toThrowError(/routing/);
  });

  it("defaults debug error severity to error for legacy records", () => {
    const parsed = parseDebugErrorEvent({
      errorId: "error_1",
      sessionId: "session_1",
      origin: "client",
      source: "farfield-web",
      operation: "legacy-operation",
      message: "legacy error",
      name: null,
      stack: null,
      requestId: null,
      threadId: null,
      url: null,
      occurredAt: "2026-02-26T00:00:00.000Z",
      recordedAt: "2026-02-26T00:00:01.000Z",
      details: {}
    });

    expect(parsed.severity).toBe("error");
  });
});

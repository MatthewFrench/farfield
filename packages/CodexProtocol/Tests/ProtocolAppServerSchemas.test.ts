import { describe, expect, it } from "vitest";
import {
  FarfieldDebugObservabilityEnvelopeSchema,
  FarfieldEventStreamEnvelopeSchema,
  FarfieldHealthResponseSchema,
  FarfieldPushStatusEnvelopeSchema,
  parseAppServerCollaborationModeListResponse,
  parseAppServerConfigReadResponse,
  parseAppServerListModelsResponse,
  parseAppServerListThreadsResponse,
  parseAppServerReadThreadResponse,
  parseAppServerStartThreadResponse,
  parseCreateDebugClientErrorBody,
  parseDebugErrorEvent,
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
          developer_instructions: "Instructions",
        },
      ],
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
              description: "Balanced",
            },
            {
              reasoningEffort: "xhigh",
              description: "Deep reasoning",
            },
          ],
          defaultReasoningEffort: "xhigh",
          inputModalities: ["text", "image"],
          supportsPersonality: true,
          isDefault: true,
          hidden: true,
        },
      ],
      nextCursor: null,
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
              description: "Balanced",
            },
          ],
          defaultReasoningEffort: "medium",
          inputModalities: ["text"],
          supportsPersonality: true,
          isDefault: true,
          hidden: false,
        },
      ],
      nextCursor: null,
      hidden: true,
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
          source: "opencode",
        },
      ],
      nextCursor: null,
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
                text: "hello",
              },
            ],
          },
        ],
      },
    });

    expect(parsed.thread.id).toBe("thread-123");
    expect(parsed.thread.requests).toEqual([]);
    expect(parsed.thread.turns[0]?.status).toBe("completed");
  });

  it("returns a normalized read-thread contract and removes unknown envelope payload fields", () => {
    const parsed = parseAppServerReadThreadResponse({
      thread: {
        id: "thread-transport-shape",
        preview: "hello",
        modelProvider: "openai",
        createdAt: 1700000000,
        updatedAt: 1700000000,
        cwd: "/tmp/workspace",
        source: "cli",
        path: "/tmp/thread.jsonl",
        cliVersion: "0.1.0",
        turns: [],
        threadRuntimeMetadata: {
          sourceRequestId: "request-1",
        },
      },
      responseEnvelopeMetadata: {
        nextCursor: null,
      },
    });

    expect(Object.keys(parsed)).toEqual(["thread"]);
    expect(parsed.thread["threadRuntimeMetadata"]).toBeUndefined();
  });

  it("rejects app-server thread/read response when normalized thread contract fails", () => {
    expect(() =>
      parseAppServerReadThreadResponse({
        thread: {
          id: "thread-789",
          preview: "example",
          modelProvider: "openai",
          createdAt: 1700000000,
          updatedAt: 1700000000,
          cwd: "/tmp/workspace",
          path: "/tmp/thread.jsonl",
          cliVersion: "0.1.0",
          source: {
            subAgent: "review",
          },
          turns: [],
        },
      }),
    ).toThrowError(/AppServerReadThreadResponse\.thread did not match expected schema/);
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
        turns: [],
      },
      model: "gpt-5.3-codex",
      modelProvider: "openai",
      cwd: "/tmp/workspace",
      approvalPolicy: "never",
      sandbox: {
        type: "dangerFullAccess",
      },
      reasoningEffort: "medium",
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
        source: "opencode",
      },
      cwd: "/tmp/project",
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
            model_reasoning_effort: "xhigh",
          },
        },
      },
      origins: {},
      layers: null,
    });

    expect(parsed.config.profile).toBe("personal");
    expect(parsed.config.model_reasoning_effort).toBe("medium");
    expect(parsed.config.profiles["personal"]?.model_reasoning_effort).toBe("xhigh");
  });

  it("normalizes app-server config/read response defaults when optional fields are absent", () => {
    const parsed = parseAppServerConfigReadResponse({
      config: {},
    });

    expect(parsed.config.profile).toBeNull();
    expect(parsed.config.model).toBeNull();
    expect(parsed.config.model_reasoning_effort).toBeNull();
    expect(parsed.config.profiles).toEqual({});
  });

  it("rejects app-server config/read response when reasoning effort is invalid", () => {
    expect(() =>
      parseAppServerConfigReadResponse({
        config: {
          model_reasoning_effort: "ultra",
        },
      }),
    ).toThrowError(/model_reasoning_effort/);
  });

  it("parses debug error create body defaults", () => {
    const parsed = parseCreateDebugClientErrorBody({
      source: "farfield-web",
      operation: "capture-error",
      message: "Network request failed",
    });

    expect(parsed.severity).toBe("error");
    expect(parsed.name).toBeNull();
    expect(parsed.details).toEqual({});
  });

  it("rejects debug error create body with unknown keys", () => {
    expect(() =>
      parseCreateDebugClientErrorBody({
        source: "farfield-web",
        operation: "capture-error",
        message: "Network request failed",
        extraField: "unexpected",
      }),
    ).toThrowError(/Unrecognized key\(s\) in object: 'extraField'/);
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
            inFlightCount: 7,
          },
          sidebarThreadSyncSnapshot: {
            hitCount: 1,
            missCount: 2,
            writeCount: 3,
            invalidationCount: 4,
            evictionCount: 5,
            entryCount: 6,
          },
        },
        concurrency: {
          thread: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            activeThreadCount: 4,
          },
          pushDispatch: {
            scheduledCheckCount: 1,
            startedCheckCount: 2,
            completedCheckCount: 3,
            skippedWhileInFlightCount: 4,
            activeTimerCount: 5,
            inFlightThreadCount: 6,
          },
          pushMutation: {
            queuedExecutionCount: 1,
            completedExecutionCount: 2,
            failedExecutionCount: 3,
            hasInFlightOperation: false,
          },
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
            keepaliveWriteFailureCount: 7,
          },
        },
        routing: {
          threadAdapterResolver: {
            registeredLookupCount: 1,
            unregisteredDiscoveryAttemptCount: 2,
            unregisteredDiscoverySuccessCount: 3,
            unregisteredDiscoveryMissCount: 4,
            unregisteredDiscoveryMissCacheHitCount: 5,
            unregisteredDiscoveryAmbiguousCount: 6,
            unregisteredDiscoveryAlertCount: 7,
          },
        },
        performance: {
          requestRouting: {
            totalRequestCount: 10,
            totalErrorCount: 2,
            inFlightRequestCount: 1,
            routeTimings: [
              {
                route: "/api/threads/:threadId",
                method: "GET",
                requestCount: 4,
                errorCount: 1,
                lastDurationMs: 40,
                p50DurationMs: 35,
                p95DurationMs: 80,
                p99DurationMs: 95,
                lastQueueDelayMs: 2,
                p95QueueDelayMs: 5,
                maxQueueDelayMs: 9,
              },
            ],
            startupRequestTimings: [
              {
                requestId: "request_1",
                actionId: "action_1",
                actionName: "startup-critical.threads.active",
                description: "Load active thread list for sidebar",
                method: "GET",
                pathname: "/api/threads",
                statusCode: 200,
                durationMs: 42,
                queueDelayMs: 3,
                completedAt: "2026-02-26T00:00:02.000Z",
              },
            ],
            requestLifecycleEvents: [
              {
                phase: "started",
                requestId: "request_1",
                actionId: "action_1",
                actionName: "startup-critical.threads.active",
                method: "GET",
                pathname: "/api/threads",
                startedAt: "2026-02-26T00:00:00.500Z",
                queueDelayMs: 2,
              },
              {
                phase: "completed",
                requestId: "request_1",
                actionId: "action_1",
                actionName: "startup-critical.threads.active",
                method: "GET",
                pathname: "/api/threads",
                startedAt: "2026-02-26T00:00:00.500Z",
                statusCode: 200,
                durationMs: 42,
                queueDelayMs: 3,
                completedAt: "2026-02-26T00:00:02.000Z",
                outcome: "success",
              },
            ],
          },
          eventLoop: {
            sampleIntervalMs: 1000,
            sampleCount: 30,
            lastLagMs: 1,
            p50LagMs: 0,
            p95LagMs: 4,
            p99LagMs: 7,
            maxLagMs: 9,
          },
          threadSendProgression: {
            activeThreadCount: 1,
            inboundSampleCount: 2,
            publishedDeltaSampleCount: 2,
            assistantVisibleSampleCount: 1,
            lastAcceptedToFirstInboundThreadStreamStateChangedMs: 120,
            p50AcceptedToFirstInboundThreadStreamStateChangedMs: 110,
            p95AcceptedToFirstInboundThreadStreamStateChangedMs: 120,
            lastAcceptedToFirstPublishedThreadDeltaMs: 150,
            p50AcceptedToFirstPublishedThreadDeltaMs: 140,
            p95AcceptedToFirstPublishedThreadDeltaMs: 150,
            lastAcceptedToFirstAssistantVisibleProgressMs: 220,
            p50AcceptedToFirstAssistantVisibleProgressMs: 220,
            p95AcceptedToFirstAssistantVisibleProgressMs: 220,
          },
        },
      },
    });

    expect(
      parsed.snapshot.routing.threadAdapterResolver.unregisteredDiscoveryMissCacheHitCount,
    ).toBe(5);
  });

  it("parses farfield health response with additive diagnostics keys", () => {
    const parsed = FarfieldHealthResponseSchema.parse({
      ok: true,
      state: {
        appReady: true,
        ipcConnected: true,
        ipcInitialized: true,
        workspaceDir: null,
        gitCommit: null,
        lastError: null,
        historyCount: 12,
        threadOwnerCount: 2,
        pushSubscriptionCount: 1,
        diagnosticsBuild: "2026-02-26",
      },
    });

    expect(Object.keys(parsed.state)).toContain("diagnosticsBuild");
  });

  it("rejects farfield push status envelope when ok is false", () => {
    expect(() =>
      FarfieldPushStatusEnvelopeSchema.parse({
        ok: false,
        enabled: true,
        permissionRequired: false,
        subscriptionCount: 0,
        privateModeDefault: false,
      }),
    ).toThrowError(/Invalid literal value, expected true/);
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
            liveStateError: null,
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
                  threadId: "thread-1",
                },
              },
            ],
            nextSequence: 4,
            firstAvailableSequence: 2,
            resetRequired: false,
          },
          streamEventsSinceSequenceUsed: 3,
        },
      },
    });

    expect(parsed.event.type).toBe("thread-stream-delta");
    if (parsed.event.type !== "thread-stream-delta") {
      throw new Error("Expected thread-stream-delta payload");
    }
    expect(parsed.event.delta.streamEventsSnapshot.nextSequence).toBe(4);
  });

  it("rejects farfield event-stream envelopes when required event metadata is missing", () => {
    expect(() =>
      FarfieldEventStreamEnvelopeSchema.parse({
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
              liveStateError: null,
            },
            streamEventsSnapshot: {
              ok: true,
              threadId: "thread-1",
              ownerClientId: null,
              events: [],
              firstAvailableSequence: 0,
              resetRequired: false,
            },
            streamEventsSinceSequenceUsed: null,
          },
        },
      }),
    ).toThrowError(/nextSequence/);
  });

  it("rejects farfield debug observability envelope when routing stats are missing", () => {
    expect(() =>
      FarfieldDebugObservabilityEnvelopeSchema.parse({
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
              inFlightCount: 7,
            },
          },
          concurrency: {
            thread: {
              queuedExecutionCount: 1,
              completedExecutionCount: 2,
              failedExecutionCount: 3,
              activeThreadCount: 4,
            },
            pushDispatch: {
              scheduledCheckCount: 1,
              startedCheckCount: 2,
              completedCheckCount: 3,
              skippedWhileInFlightCount: 4,
              activeTimerCount: 5,
              inFlightThreadCount: 6,
            },
            pushMutation: {
              queuedExecutionCount: 1,
              completedExecutionCount: 2,
              failedExecutionCount: 3,
              hasInFlightOperation: false,
            },
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
              keepaliveWriteFailureCount: 7,
            },
          },
          performance: {
            requestRouting: {
              totalRequestCount: 1,
              totalErrorCount: 0,
              inFlightRequestCount: 0,
              routeTimings: [],
              startupRequestTimings: [],
            },
            eventLoop: {
              sampleIntervalMs: 1000,
              sampleCount: 1,
              lastLagMs: 0,
              p50LagMs: 0,
              p95LagMs: 0,
              p99LagMs: 0,
              maxLagMs: 0,
            },
            threadSendProgression: {
              activeThreadCount: 0,
              inboundSampleCount: 0,
              publishedDeltaSampleCount: 0,
              assistantVisibleSampleCount: 0,
              lastAcceptedToFirstInboundThreadStreamStateChangedMs: 0,
              p50AcceptedToFirstInboundThreadStreamStateChangedMs: 0,
              p95AcceptedToFirstInboundThreadStreamStateChangedMs: 0,
              lastAcceptedToFirstPublishedThreadDeltaMs: 0,
              p50AcceptedToFirstPublishedThreadDeltaMs: 0,
              p95AcceptedToFirstPublishedThreadDeltaMs: 0,
              lastAcceptedToFirstAssistantVisibleProgressMs: 0,
              p50AcceptedToFirstAssistantVisibleProgressMs: 0,
              p95AcceptedToFirstAssistantVisibleProgressMs: 0,
            },
          },
        },
      }),
    ).toThrowError(/routing/);
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
      details: {},
    });

    expect(parsed.severity).toBe("error");
  });
});

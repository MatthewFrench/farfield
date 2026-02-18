import { describe, expect, it } from "vitest";
import {
  parseAppServerReadThreadResponse,
  parseAppServerListModelsResponse,
  parseAppServerCollaborationModeListResponse,
  parseAppServerStartThreadResponse,
  parseCreatePushReceiptBody,
  parseCreatePushSubscriptionBody,
  parseIpcFrame,
  parsePushNotificationPayload,
  parsePushLocalCaStatusResponse,
  parsePushReceiptStore,
  parsePushStateStore,
  parseThreadConversationState,
  parseThreadStreamStateChangedBroadcast,
  parseUserInputResponsePayload,
  parseVapidPublicKeyResponse
} from "../src/index.js";

describe("codex-protocol schemas", () => {
  it("parses a valid thread stream patches broadcast", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "patches",
          patches: [
            {
              op: "add",
              path: ["requests", 0],
              value: {
                method: "item/tool/requestUserInput",
                id: 9,
                params: {
                  threadId: "thread-123",
                  turnId: "turn-123",
                  itemId: "item-123",
                  questions: [
                    {
                      id: "question_a",
                      header: "Scope",
                      question: "Choose one",
                      isOther: true,
                      isSecret: false,
                      options: [
                        {
                          label: "Option A",
                          description: "Description A"
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    });

    expect(parsed.params.change.type).toBe("patches");
  });

  it("parses snapshot broadcast with null title and empty model defaults", () => {
    const parsed = parseThreadStreamStateChangedBroadcast({
      type: "broadcast",
      method: "thread-stream-state-changed",
      sourceClientId: "client-123",
      version: 4,
      params: {
        conversationId: "thread-123",
        type: "thread-stream-state-changed",
        version: 4,
        change: {
          type: "snapshot",
          conversationState: {
            id: "thread-123",
            turns: [],
            requests: [],
            createdAt: 1700000000,
            updatedAt: 1700000000,
            title: null,
            latestModel: "",
            latestReasoningEffort: null,
            previousTurnModel: null,
            latestCollaborationMode: {
              mode: "default",
              settings: {
                model: "",
                reasoning_effort: null,
                developer_instructions: null
              }
            },
            hasUnreadTurn: false,
            rolloutPath: "/tmp/rollout.jsonl",
            gitInfo: null,
            resumeState: "resumed",
            latestTokenUsageInfo: null,
            cwd: "/tmp/workspace",
            source: "vscode"
          }
        }
      }
    });

    expect(parsed.params.change.type).toBe("snapshot");
  });

  it("rejects invalid patch value for remove operation", () => {
    expect(() =>
      parseThreadStreamStateChangedBroadcast({
        type: "broadcast",
        method: "thread-stream-state-changed",
        sourceClientId: "client-123",
        version: 4,
        params: {
          conversationId: "thread-123",
          type: "thread-stream-state-changed",
          version: 4,
          change: {
            type: "patches",
            patches: [
              {
                op: "remove",
                path: ["requests", 0],
                value: true
              }
            ]
          }
        }
      })
    ).toThrowError(/remove patches must not include value/);
  });

  it("parses thread conversation state with userInputResponse item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          params: {
            threadId: "thread-123",
            input: [{ type: "text", text: "hello" }],
            attachments: []
          },
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userInputResponse",
              requestId: 12,
              turnId: "turn-1",
              questions: [{ id: "q", header: "H", question: "Q" }],
              answers: { q: ["A"] },
              completed: true
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("userInputResponse");
  });

  it("parses thread conversation state with mixed text and image user content", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-1",
              type: "userMessage",
              content: [
                {
                  type: "text",
                  text: "describe this image"
                },
                {
                  type: "image",
                  url: "data:image/png;base64,AAAA"
                }
              ]
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("userMessage");
  });

  it("parses steering user message item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-steering",
              type: "steeringUserMessage",
              content: [
                {
                  type: "text",
                  text: "please keep this concise"
                }
              ],
              attachments: []
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("steeringUserMessage");
  });

  it("rejects thread conversation state with unknown item types", () => {
    expect(() =>
      parseThreadConversationState({
        id: "thread-123",
        turns: [
          {
            status: "completed",
            items: [
              {
                id: "item-unknown",
                type: "toolCall",
                payload: {
                  hello: "world"
                }
              }
            ]
          }
        ],
        requests: []
      })
    ).toThrowError(/ThreadConversationState did not match expected schema/);
  });

  it("parses thread conversation state with command execution item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-cmd",
              type: "commandExecution",
              command: "echo hello",
              cwd: "/tmp",
              processId: "123",
              status: "completed",
              commandActions: [
                {
                  type: "read",
                  command: "cat file.txt",
                  name: "file.txt",
                  path: "file.txt"
                }
              ],
              aggregatedOutput: "hello",
              exitCode: 0,
              durationMs: 5
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("commandExecution");
  });

  it("parses command action with null path and query", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-cmd",
              type: "commandExecution",
              command: "rg -n hello -S",
              status: "completed",
              commandActions: [
                {
                  type: "search",
                  command: "rg -n hello -S",
                  query: "hello",
                  path: null
                }
              ]
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("commandExecution");
  });

  it("parses thread conversation state with fileChange item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-file",
              type: "fileChange",
              status: "completed",
              changes: [
                {
                  path: "/tmp/file.txt",
                  kind: {
                    type: "update",
                    move_path: null
                  },
                  diff: "@@ -1 +1 @@\n-old\n+new\n"
                }
              ]
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("fileChange");
  });

  it("parses thread conversation state with contextCompaction and webSearch items", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-compact",
              type: "contextCompaction",
              completed: true
            },
            {
              id: "item-web",
              type: "webSearch",
              query: "example query",
              action: {
                type: "search",
                query: "example query",
                queries: ["example query"]
              }
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("contextCompaction");
    expect(parsed.turns[0]?.items[1]?.type).toBe("webSearch");
  });

  it("parses thread conversation state with modelChanged item", () => {
    const parsed = parseThreadConversationState({
      id: "thread-123",
      turns: [
        {
          status: "completed",
          items: [
            {
              id: "item-model",
              type: "modelChanged",
              fromModel: "gpt-5.3-codex-spark",
              toModel: "gpt-5.3-codex"
            }
          ]
        }
      ],
      requests: []
    });

    expect(parsed.turns[0]?.items[0]?.type).toBe("modelChanged");
  });

  it("parses generic ipc request frames", () => {
    const parsed = parseIpcFrame({
      type: "request",
      requestId: "request-5",
      method: "thread-follower-start-turn",
      params: {
        conversationId: "thread-123"
      },
      version: 1,
      targetClientId: "client-1"
    });

    expect(parsed.type).toBe("request");
  });

  it("parses client discovery request frames", () => {
    const parsed = parseIpcFrame({
      type: "client-discovery-request",
      requestId: "discovery-1",
      request: {
        type: "request",
        requestId: "inner-1",
        sourceClientId: "desktop-client",
        version: 0,
        method: "ide-context",
        params: {
          workspaceRoot: "/tmp/workspace"
        }
      }
    });

    expect(parsed.type).toBe("client-discovery-request");
  });

  it("rejects malformed user input answer payload", () => {
    expect(() =>
      parseUserInputResponsePayload({
        answers: {
          q: {
            answers: [""]
          }
        }
      })
    ).toThrowError(/String must contain at least 1 character/);
  });

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
          isDefault: true
        }
      ],
      nextCursor: null
    });

    expect(parsed.data[0]?.id).toBe("gpt-5.3-codex");
  });

  it("parses app-server thread/read response with subset validation", () => {
    const parsed = parseAppServerReadThreadResponse({
      thread: {
        id: "thread-123",
        preview: "hello",
        modelProvider: "openai",
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

  it("parses create push subscription body", () => {
    const parsed = parseCreatePushSubscriptionBody({
      subscription: {
        endpoint: "https://example.push.service/subscription-id",
        keys: {
          p256dh: "BElidedKeyMaterial_123",
          auth: "CAuthValue_456"
        }
      },
      settings: {
        privateMode: true
      }
    });

    expect(parsed.settings?.privateMode).toBe(true);
  });

  it("rejects create push subscription body with unknown fields", () => {
    expect(() =>
      parseCreatePushSubscriptionBody({
        subscription: {
          endpoint: "https://example.push.service/subscription-id",
          keys: {
            p256dh: "BElidedKeyMaterial_123",
            auth: "CAuthValue_456"
          }
        },
        extra: true
      })
    ).toThrowError(/CreatePushSubscriptionBody did not match expected schema/);
  });

  it("parses push state store payload", () => {
    const parsed = parsePushStateStore({
      version: 1,
      subscriptions: [
        {
          id: "sub_1",
          subscription: {
            endpoint: "https://example.push.service/subscription-id",
            keys: {
              p256dh: "BElidedKeyMaterial_123",
              auth: "CAuthValue_456"
            }
          },
          settings: {
            privateMode: true
          },
          createdAt: "2026-02-18T00:00:00.000Z",
          updatedAt: "2026-02-18T00:00:00.000Z"
        }
      ],
      completionWatermarks: [
        {
          threadId: "thread_1",
          marker: "turn_1:item_1"
        }
      ]
    });

    expect(parsed.subscriptions[0]?.id).toBe("sub_1");
    expect(parsed.completionWatermarks[0]?.threadId).toBe("thread_1");
  });

  it("rejects unsupported push state store version", () => {
    expect(() =>
      parsePushStateStore({
        version: 2,
        subscriptions: [],
        completionWatermarks: []
      })
    ).toThrowError(/Unsupported push state version/);
  });

  it("parses push notification payload with declarative notification", () => {
    const parsed = parsePushNotificationPayload({
      notificationId: "notif_1",
      title: "Codex response ready",
      body: "A response is ready in Farfield.",
      threadId: "thread_1",
      turnId: "turn_1",
      url: "/threads/thread_1",
      createdAt: "2026-02-18T00:00:00.000Z",
      web_push: {
        notification: {
          title: "Codex response ready",
          body: "A response is ready in Farfield.",
          navigate: "/threads/thread_1",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          tag: "thread:thread_1"
        }
      }
    });

    expect(parsed.web_push?.notification.navigate).toBe("/threads/thread_1");
  });

  it("rejects push notification payload with unknown declarative fields", () => {
    expect(() =>
      parsePushNotificationPayload({
        notificationId: "notif_1",
        title: "Codex response ready",
        body: "A response is ready in Farfield.",
        threadId: "thread_1",
        turnId: "turn_1",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z",
        web_push: {
          notification: {
            title: "Codex response ready",
            unknownField: true
          }
        }
      })
    ).toThrowError(/PushNotificationPayload did not match expected schema/);
  });

  it("parses push receipt body", () => {
    const parsed = parseCreatePushReceiptBody({
      notificationId: "notif_1",
      event: "shown",
      url: "/threads/thread_1",
      threadId: "thread_1",
      turnId: "turn_1",
      createdAt: "2026-02-18T00:00:00.000Z"
    });

    expect(parsed.event).toBe("shown");
    expect(parsed.threadId).toBe("thread_1");
  });

  it("rejects push receipt body with unknown fields", () => {
    expect(() =>
      parseCreatePushReceiptBody({
        notificationId: "notif_1",
        event: "shown",
        url: "/threads/thread_1",
        createdAt: "2026-02-18T00:00:00.000Z",
        extra: true
      })
    ).toThrowError(/CreatePushReceiptBody did not match expected schema/);
  });

  it("parses local CA status response", () => {
    const parsed = parsePushLocalCaStatusResponse({
      available: true,
      downloadPath: "/api/push/local-ca/root.crt",
      sourcePath: "/Users/test/Library/Application Support/Caddy/pki/authorities/local/root.crt"
    });

    expect(parsed.available).toBe(true);
    expect(parsed.downloadPath).toBe("/api/push/local-ca/root.crt");
  });

  it("parses push receipt store payload", () => {
    const parsed = parsePushReceiptStore({
      version: 2,
      receipts: [
        {
          notificationId: "notif_1",
          event: "shown",
          url: "/threads/thread_1",
          threadId: "thread_1",
          turnId: "turn_1",
          message: null,
          createdAt: "2026-02-18T00:00:00.000Z"
        }
      ]
    });

    expect(parsed.receipts.length).toBe(1);
    expect(parsed.receipts[0]?.event).toBe("shown");
  });

  it("migrates legacy push receipt store payload", () => {
    const parsed = parsePushReceiptStore({
      version: 1,
      receipts: [
        {
          event: "clicked",
          url: "/threads/thread_legacy",
          threadId: "thread_legacy",
          turnId: "turn_legacy",
          message: null,
          createdAt: "2026-02-18T00:00:00.000Z"
        }
      ]
    });

    expect(parsed.version).toBe(2);
    expect(parsed.receipts[0]?.notificationId.startsWith("legacy-")).toBe(true);
    expect(parsed.receipts[0]?.event).toBe("clicked");
  });

  it("rejects unsupported push receipt store version", () => {
    expect(() =>
      parsePushReceiptStore({
        version: 3,
        receipts: []
      })
    ).toThrowError(/Unsupported push receipt store version/);
  });

  it("parses vapid public key response", () => {
    const parsed = parseVapidPublicKeyResponse({
      publicKey: "BElidedPublicKey_123"
    });

    expect(parsed.publicKey).toBe("BElidedPublicKey_123");
  });
});

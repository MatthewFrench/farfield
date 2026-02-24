import { z } from "zod";

const StateEventSchema = z
  .object({
    type: z.literal("state"),
    state: z.object({}).passthrough()
  })
  .passthrough();

const HistoryEventSchema = z
  .object({
    type: z.literal("history"),
    entry: z
      .object({
        source: z.enum(["ipc", "app", "system"]),
        meta: z
          .object({
            method: z.string().optional(),
            threadId: z.string().optional()
          })
          .passthrough()
      })
      .passthrough()
  })
  .passthrough();

const StreamEventSchema = z.union([StateEventSchema, HistoryEventSchema]);

export interface EventStreamRefreshDecisionInput {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  eventData: string;
}

export interface EventStreamRefreshDecision {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
}

export class EventStreamRefreshDecisionEngine {
  private readonly threadOnlyHistoryMethods: Set<string>;

  public constructor(threadOnlyHistoryMethods: readonly string[]) {
    this.threadOnlyHistoryMethods = new Set<string>(threadOnlyHistoryMethods);
  }

  public readDecision(input: EventStreamRefreshDecisionInput): EventStreamRefreshDecision {
    let refreshCore = false;
    const refreshHistory = input.activeTab === "debug";
    let refreshSelectedThread = false;

    try {
      const parseResult = StreamEventSchema.safeParse(JSON.parse(input.eventData));
      if (!parseResult.success) {
        refreshCore = true;
      } else if (parseResult.data.type === "state") {
        refreshCore = true;
      } else {
        const eventMethod = parseResult.data.entry.meta.method;
        const eventThreadId = parseResult.data.entry.meta.threadId;
        const isThreadOnlyMethod = typeof eventMethod === "string"
          && this.threadOnlyHistoryMethods.has(eventMethod);

        if (!isThreadOnlyMethod && (parseResult.data.entry.source === "app" || parseResult.data.entry.source === "system")) {
          refreshCore = true;
        }
        if (
          eventThreadId
          && input.selectedThreadId
          && eventThreadId === input.selectedThreadId
        ) {
          refreshSelectedThread = true;
        }
        if (!eventThreadId && !isThreadOnlyMethod) {
          refreshCore = true;
        }
      }
    } catch {
      refreshCore = true;
    }

    return {
      refreshCore,
      refreshHistory,
      refreshSelectedThread
    };
  }
}

import { type ThreadConversationState } from "@farfield/protocol";

const COMMAND_EXECUTION_ITEM_TYPE = "commandExecution";
const COMMAND_EXECUTION_RUNNING_STATUSES = new Set(["inProgress", "in-progress"]);
const PROCESS_IDENTIFIER_PREFIX = "process:";
const ITEM_IDENTIFIER_PREFIX = "item:";

function readRunningTerminalIdentifier(
  processIdentifier: string | undefined,
  itemId: string,
): string {
  if (processIdentifier !== undefined && processIdentifier.length > 0) {
    return `${PROCESS_IDENTIFIER_PREFIX}${processIdentifier}`;
  }
  return `${ITEM_IDENTIFIER_PREFIX}${itemId}`;
}

export function readRunningTerminalCount(
  conversationState: ThreadConversationState | null,
): number {
  if (!conversationState) {
    return 0;
  }

  const runningTerminalIdentifiers = new Set<string>();
  for (const turn of conversationState.turns) {
    for (const item of turn.items) {
      if (item.type !== COMMAND_EXECUTION_ITEM_TYPE) {
        continue;
      }
      if (!COMMAND_EXECUTION_RUNNING_STATUSES.has(item.status)) {
        continue;
      }

      runningTerminalIdentifiers.add(readRunningTerminalIdentifier(item.processId, item.id));
    }
  }

  return runningTerminalIdentifiers.size;
}

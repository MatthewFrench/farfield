import { ThreadListActiveSection } from "@/Features/Threads/UserInterface/ThreadListActiveSection";
import { ThreadListArchivedSection } from "@/Features/Threads/UserInterface/ThreadListArchivedSection";
import { ThreadListEmptyState } from "@/Features/Threads/UserInterface/ThreadListEmptyState";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

export type {
  ThreadListPaneAgentDescriptor,
  ThreadListPaneProperties
} from "@/Features/Threads/UserInterface/ThreadListPaneContracts";

export function ThreadListPane(properties: ThreadListPaneProperties): React.JSX.Element {
  return (
    <div className="relative flex-1 min-h-0">
      <div
        data-testid="thread-list-status"
        data-state={properties.threadListState}
        className="h-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain py-2 pl-2 pr-0"
      >
        <ThreadListEmptyState properties={properties} />
        <div className="space-y-2 pr-2">
          <ThreadListActiveSection properties={properties} />
          <ThreadListArchivedSection properties={properties} />
        </div>
      </div>
    </div>
  );
}

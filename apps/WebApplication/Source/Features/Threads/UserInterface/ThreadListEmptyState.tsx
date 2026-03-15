import { Loader2, Plus } from "lucide-react";
import { Button } from "@/Components/UserInterface/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/UserInterface/DropdownMenu";
import { type ThreadListPaneProperties } from "@/Features/Threads/UserInterface/ThreadListPaneContracts";
import {
  DEFAULT_AGENT_LABEL,
  DEFAULT_THREAD_PROJECT_DIRECTORY,
} from "@/Features/Threads/UserInterface/ThreadListUserInterfaceConstants";

interface ThreadListEmptyStateProps {
  properties: ThreadListPaneProperties;
}

export function ThreadListEmptyState({
  properties,
}: ThreadListEmptyStateProps): React.JSX.Element | null {
  if (properties.threads.length > 0) {
    return null;
  }

  return (
    <div
      data-testid="thread-list-empty"
      className="px-4 py-6 text-xs text-muted-foreground text-center space-y-3"
    >
      {properties.isCoreLoading ? (
        <div data-testid="thread-list-loading" className="flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Loading threads...</span>
        </div>
      ) : (
        <div>No threads</div>
      )}
      {properties.availableAgentIds.length > 0 &&
        (properties.availableAgentIds.length === 1 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={properties.isBusy}
            onClick={() => {
              const defaultProjectPath =
                properties.selectedAgentDescriptor?.projectDirectories[0] ??
                DEFAULT_THREAD_PROJECT_DIRECTORY;
              properties.onCreateThreadForSingleAgent(defaultProjectPath);
            }}
          >
            <Plus size={13} className="mr-1.5" />
            New {properties.selectedAgentLabel} thread
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={properties.isBusy}
              >
                <Plus size={13} className="mr-1.5" />
                New thread
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={6}>
              {properties.availableAgentIds.map((agentId) => (
                <DropdownMenuItem
                  key={agentId}
                  onSelect={() => {
                    const defaultProjectPath =
                      properties.agentsById[agentId]?.projectDirectories[0] ??
                      DEFAULT_THREAD_PROJECT_DIRECTORY;
                    properties.onCreateNewThread(defaultProjectPath, agentId);
                  }}
                >
                  <span className="shrink-0 h-4 w-4 rounded-sm bg-muted/30 ring-1 ring-border/60 flex items-center justify-center overflow-hidden">
                    {properties.renderAgentFavicon(
                      agentId,
                      properties.agentsById[agentId]?.label ?? DEFAULT_AGENT_LABEL,
                      "h-3.5 w-3.5",
                    )}
                  </span>
                  New {properties.agentsById[agentId]?.label ?? agentId} thread
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
    </div>
  );
}

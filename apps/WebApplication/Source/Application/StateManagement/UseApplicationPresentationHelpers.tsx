import {
  useCallback,
  useMemo
} from "react";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";
import { AgentFavicon } from "@/Application/UserInterface/AgentFavicon";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";
import { StreamEventCard } from "@/Components/StreamEventCard";
import { type ChatStreamEventsResponse } from "@/Features/Chat/DataAccess/ChatServerClient";

export interface UseStreamEventCardsInput {
  streamEvents: ChatStreamEventsResponse["events"];
}

interface IndexedStreamEvent {
  streamEvent: ChatStreamEventsResponse["events"][number];
  stableIndex: number;
}

export function useStreamEventCards(input: UseStreamEventCardsInput): React.JSX.Element[] {
  return useMemo<React.JSX.Element[]>(() => (
    input.streamEvents
      // Preserve each event's original index as a stable key seed so appends do not
      // remount every existing card (which would reset local expand/collapse state).
      .map<IndexedStreamEvent>((streamEvent, stableIndex) => ({
        streamEvent,
        stableIndex
      }))
      .reverse()
      .map((indexedStreamEvent) => (
        <StreamEventCard
          key={`stream-event-${String(indexedStreamEvent.stableIndex)}`}
          event={indexedStreamEvent.streamEvent}
        />
      ))
  ), [input.streamEvents]);
}

export interface UseApplicationFormattingHelpersInput {
  dateValueFormatter: DateValueFormatter;
}

export interface ApplicationFormattingHelpers {
  renderAgentFavicon: (agentId: AgentId, label: string, className: string) => React.JSX.Element;
  formatDateValue: (value: number | string | null | undefined) => string;
}

export function useApplicationFormattingHelpers(
  input: UseApplicationFormattingHelpersInput
): ApplicationFormattingHelpers {
  const renderAgentFavicon = useCallback(
    (agentId: AgentId, label: string, className: string): React.JSX.Element => (
      <AgentFavicon agentId={agentId} label={label} className={className} />
    ),
    []
  );

  const formatDateValue = useCallback(
    (value: number | string | null | undefined): string => input.dateValueFormatter.format(value),
    [input.dateValueFormatter]
  );

  return {
    renderAgentFavicon,
    formatDateValue
  };
}

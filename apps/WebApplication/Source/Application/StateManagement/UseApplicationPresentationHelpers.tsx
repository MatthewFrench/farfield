import { useCallback, useMemo, useRef } from "react";
import { DateValueFormatter } from "@/Application/DomainModel/DateValueFormatter";
import { AgentFavicon } from "@/Application/UserInterface/AgentFavicon";
import { StreamEventCard } from "@/Components/StreamEventCard";
import { type ChatStreamEventsResponse } from "@/Features/Chat/DataAccess/ChatServerClient";
import { type AgentId } from "@/Shared/Contracts/ApiContracts";

export interface UseStreamEventCardsInput {
  streamEvents: ChatStreamEventsResponse["events"];
  streamEventCardsEnabled: boolean;
}

interface IndexedStreamEvent {
  streamEvent: ChatStreamEventsResponse["events"][number];
  stableEventKey: string;
}

const STREAM_EVENT_CARD_KEY_PREFIX = "stream-event-";

function buildStreamEventCardKey(keyNumber: number): string {
  return `${STREAM_EVENT_CARD_KEY_PREFIX}${String(keyNumber)}`;
}

function indexStreamEvents(
  streamEvents: ChatStreamEventsResponse["events"],
  readStreamEventCardKey: (streamEvent: ChatStreamEventsResponse["events"][number]) => string,
): IndexedStreamEvent[] {
  return streamEvents.map<IndexedStreamEvent>((streamEvent) => ({
    streamEvent,
    stableEventKey: readStreamEventCardKey(streamEvent),
  }));
}

function buildStreamEventCard(indexedStreamEvent: IndexedStreamEvent): React.JSX.Element {
  return (
    <StreamEventCard
      key={indexedStreamEvent.stableEventKey}
      event={indexedStreamEvent.streamEvent}
    />
  );
}

export function useStreamEventCards(input: UseStreamEventCardsInput): React.JSX.Element[] {
  const streamEventCardKeyByReference = useRef<
    WeakMap<ChatStreamEventsResponse["events"][number], string>
  >(new WeakMap<ChatStreamEventsResponse["events"][number], string>());
  const nextStreamEventCardKeyNumber = useRef(0);

  const readStreamEventCardKey = useCallback(
    (streamEvent: ChatStreamEventsResponse["events"][number]): string => {
      const existingKey = streamEventCardKeyByReference.current.get(streamEvent);
      if (existingKey !== undefined) {
        return existingKey;
      }

      const nextKey = buildStreamEventCardKey(nextStreamEventCardKeyNumber.current);
      nextStreamEventCardKeyNumber.current += 1;
      streamEventCardKeyByReference.current.set(streamEvent, nextKey);
      return nextKey;
    },
    [],
  );

  return useMemo<React.JSX.Element[]>(() => {
    if (!input.streamEventCardsEnabled) {
      return [];
    }

    return (
      indexStreamEvents(input.streamEvents, readStreamEventCardKey)
        // Preserve event-owned key identity so retention-window shifts do not remount retained cards.
        .reverse()
        .map(buildStreamEventCard)
    );
  }, [input.streamEventCardsEnabled, input.streamEvents, readStreamEventCardKey]);
}

export interface UseApplicationFormattingHelpersInput {
  dateValueFormatter: DateValueFormatter;
}

export interface ApplicationFormattingHelpers {
  renderAgentFavicon: (agentId: AgentId, label: string, className: string) => React.JSX.Element;
  formatDateValue: (value: number | string | null | undefined) => string;
}

export function useApplicationFormattingHelpers(
  input: UseApplicationFormattingHelpersInput,
): ApplicationFormattingHelpers {
  const renderAgentFavicon = useCallback(
    (agentId: AgentId, label: string, className: string): React.JSX.Element => (
      <AgentFavicon agentId={agentId} label={label} className={className} />
    ),
    [],
  );

  const formatDateValue = useCallback(
    (value: number | string | null | undefined): string => input.dateValueFormatter.format(value),
    [input.dateValueFormatter],
  );

  return {
    renderAgentFavicon,
    formatDateValue,
  };
}

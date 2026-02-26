import { type Dispatch, type MutableRefObject, type SetStateAction, useRef, useState } from "react";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

type ArchivedThreadCollection = ThreadListResponse["data"];
type CollapsedArchivedProjectGroups = Record<string, boolean>;

const INITIAL_ARCHIVED_THREAD_FLAGS = {
  hasLoadedArchivedThreads: false,
  archivedThreadsTruncated: false,
  isArchivedThreadsOpen: false,
  isArchivedThreadsLoading: false
};

function createInitialArchivedThreadCollection(): ArchivedThreadCollection {
  return [];
}

function createInitialCollapsedArchivedProjectGroups(): CollapsedArchivedProjectGroups {
  return {};
}

export interface ApplicationArchivedThreadStateSlice {
  archivedThreads: ArchivedThreadCollection;
  setArchivedThreads: Dispatch<SetStateAction<ArchivedThreadCollection>>;
  hasLoadedArchivedThreads: boolean;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  archivedThreadsTruncated: boolean;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsOpen: boolean;
  setIsArchivedThreadsOpen: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsLoading: boolean;
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  collapsedArchivedProjectGroups: CollapsedArchivedProjectGroups;
  setCollapsedArchivedProjectGroups: Dispatch<SetStateAction<CollapsedArchivedProjectGroups>>;
  isArchivedThreadsOpenRef: MutableRefObject<boolean>;
  hasLoadedArchivedThreadsRef: MutableRefObject<boolean>;
}

export function useApplicationArchivedThreadState(): ApplicationArchivedThreadStateSlice {
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThreadCollection>(createInitialArchivedThreadCollection);
  const [hasLoadedArchivedThreads, setHasLoadedArchivedThreads] = useState(
    INITIAL_ARCHIVED_THREAD_FLAGS.hasLoadedArchivedThreads
  );
  const [archivedThreadsTruncated, setArchivedThreadsTruncated] = useState(
    INITIAL_ARCHIVED_THREAD_FLAGS.archivedThreadsTruncated
  );
  const [isArchivedThreadsOpen, setIsArchivedThreadsOpen] = useState(
    INITIAL_ARCHIVED_THREAD_FLAGS.isArchivedThreadsOpen
  );
  const [isArchivedThreadsLoading, setIsArchivedThreadsLoading] = useState(
    INITIAL_ARCHIVED_THREAD_FLAGS.isArchivedThreadsLoading
  );
  const [collapsedArchivedProjectGroups, setCollapsedArchivedProjectGroups] = useState<CollapsedArchivedProjectGroups>(
    createInitialCollapsedArchivedProjectGroups
  );
  const isArchivedThreadsOpenRef = useRef(INITIAL_ARCHIVED_THREAD_FLAGS.isArchivedThreadsOpen);
  const hasLoadedArchivedThreadsRef = useRef(INITIAL_ARCHIVED_THREAD_FLAGS.hasLoadedArchivedThreads);

  return {
    archivedThreads,
    setArchivedThreads,
    hasLoadedArchivedThreads,
    setHasLoadedArchivedThreads,
    archivedThreadsTruncated,
    setArchivedThreadsTruncated,
    isArchivedThreadsOpen,
    setIsArchivedThreadsOpen,
    isArchivedThreadsLoading,
    setIsArchivedThreadsLoading,
    collapsedArchivedProjectGroups,
    setCollapsedArchivedProjectGroups,
    isArchivedThreadsOpenRef,
    hasLoadedArchivedThreadsRef
  };
}

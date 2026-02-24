import { type Dispatch, type MutableRefObject, type SetStateAction, useRef, useState } from "react";
import { type ThreadListResponse } from "@/Features/Threads/DomainModel/ThreadGroupTypes";

export interface ApplicationArchivedThreadStateSlice {
  archivedThreads: ThreadListResponse["data"];
  setArchivedThreads: Dispatch<SetStateAction<ThreadListResponse["data"]>>;
  hasLoadedArchivedThreads: boolean;
  setHasLoadedArchivedThreads: Dispatch<SetStateAction<boolean>>;
  archivedThreadsTruncated: boolean;
  setArchivedThreadsTruncated: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsOpen: boolean;
  setIsArchivedThreadsOpen: Dispatch<SetStateAction<boolean>>;
  isArchivedThreadsLoading: boolean;
  setIsArchivedThreadsLoading: Dispatch<SetStateAction<boolean>>;
  collapsedArchivedProjectGroups: Record<string, boolean>;
  setCollapsedArchivedProjectGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
  isArchivedThreadsOpenRef: MutableRefObject<boolean>;
  hasLoadedArchivedThreadsRef: MutableRefObject<boolean>;
}

export function useApplicationArchivedThreadState(): ApplicationArchivedThreadStateSlice {
  const [archivedThreads, setArchivedThreads] = useState<ThreadListResponse["data"]>([]);
  const [hasLoadedArchivedThreads, setHasLoadedArchivedThreads] = useState(false);
  const [archivedThreadsTruncated, setArchivedThreadsTruncated] = useState(false);
  const [isArchivedThreadsOpen, setIsArchivedThreadsOpen] = useState(false);
  const [isArchivedThreadsLoading, setIsArchivedThreadsLoading] = useState(false);
  const [collapsedArchivedProjectGroups, setCollapsedArchivedProjectGroups] = useState<Record<string, boolean>>({});
  const isArchivedThreadsOpenRef = useRef(false);
  const hasLoadedArchivedThreadsRef = useRef(false);

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

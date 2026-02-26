import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from "react";
import { ChatScrollStateCoordinator } from "./ChatScrollStateCoordinator";

const CHAT_TAB_IDENTIFIER = "chat";

export interface UseChatScrollEffectsInput {
  activeTab: "chat" | "debug";
  selectedThreadId: string | null;
  conversationItemCount: number;
  initialVisibleChatItemCount: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  chatContentRef: RefObject<HTMLDivElement | null>;
  isChatAtBottom: boolean;
  isChatAtBottomRef: MutableRefObject<boolean>;
  setIsChatAtBottom: Dispatch<SetStateAction<boolean>>;
  setVisibleChatItemLimit: Dispatch<SetStateAction<number>>;
  chatScrollStateCoordinator: ChatScrollStateCoordinator;
}

export function useChatScrollEffects(input: UseChatScrollEffectsInput): void {
  const {
    activeTab,
    selectedThreadId,
    conversationItemCount,
    initialVisibleChatItemCount,
    scrollRef,
    chatContentRef,
    isChatAtBottom,
    isChatAtBottomRef,
    setIsChatAtBottom,
    setVisibleChatItemLimit,
    chatScrollStateCoordinator
  } = input;

  useEffect(() => {
    isChatAtBottomRef.current = isChatAtBottom;
  }, [isChatAtBottom, isChatAtBottomRef]);

  useEffect(() => {
    if (activeTab !== CHAT_TAB_IDENTIFIER || !scrollRef.current) {
      return;
    }

    const scroller = scrollRef.current;
    let rafId: number | null = null;

    const syncBottomState = () => {
      const synchronizationResult = chatScrollStateCoordinator.synchronizeBottomState({
        scrollElement: scroller,
        previousIsAtBottom: isChatAtBottomRef.current
      });
      if (synchronizationResult.changed) {
        isChatAtBottomRef.current = synchronizationResult.nextIsAtBottom;
        setIsChatAtBottom(synchronizationResult.nextIsAtBottom);
      }
      rafId = null;
    };

    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(syncBottomState);
    };

    syncBottomState();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    activeTab,
    chatScrollStateCoordinator,
    isChatAtBottomRef,
    scrollRef,
    selectedThreadId,
    setIsChatAtBottom
  ]);

  useEffect(() => {
    if (activeTab === CHAT_TAB_IDENTIFIER && isChatAtBottomRef.current && scrollRef.current) {
      chatScrollStateCoordinator.pinToBottom(scrollRef.current);
    }
  }, [
    activeTab,
    chatScrollStateCoordinator,
    conversationItemCount,
    isChatAtBottomRef,
    scrollRef
  ]);

  useEffect(() => {
    if (activeTab !== CHAT_TAB_IDENTIFIER || !scrollRef.current || !chatContentRef.current) {
      return;
    }

    const scroller = scrollRef.current;
    const content = chatContentRef.current;
    let rafId: number | null = null;

    const observer = new ResizeObserver(() => {
      if (!isChatAtBottomRef.current) {
        return;
      }
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        chatScrollStateCoordinator.pinToBottom(scroller);
        rafId = null;
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    activeTab,
    chatContentRef,
    chatScrollStateCoordinator,
    isChatAtBottomRef,
    scrollRef,
    selectedThreadId
  ]);

  useEffect(() => {
    if (activeTab !== CHAT_TAB_IDENTIFIER || !scrollRef.current) {
      return;
    }
    chatScrollStateCoordinator.pinToBottom(scrollRef.current);
    isChatAtBottomRef.current = true;
    setIsChatAtBottom(true);
    setVisibleChatItemLimit(initialVisibleChatItemCount);
  }, [
    activeTab,
    chatScrollStateCoordinator,
    initialVisibleChatItemCount,
    isChatAtBottomRef,
    scrollRef,
    selectedThreadId,
    setIsChatAtBottom,
    setVisibleChatItemLimit
  ]);
}

import {
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction
} from "react";
import { ChatScrollStateCoordinator } from "./ChatScrollStateCoordinator";

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
  useEffect(() => {
    input.isChatAtBottomRef.current = input.isChatAtBottom;
  }, [input.isChatAtBottom, input.isChatAtBottomRef]);

  useEffect(() => {
    if (input.activeTab !== "chat" || !input.scrollRef.current) {
      return;
    }

    const scroller = input.scrollRef.current;
    let rafId: number | null = null;

    const syncBottomState = () => {
      const synchronizationResult = input.chatScrollStateCoordinator.synchronizeBottomState({
        scrollElement: scroller,
        previousIsAtBottom: input.isChatAtBottomRef.current
      });
      if (synchronizationResult.changed) {
        input.isChatAtBottomRef.current = synchronizationResult.nextIsAtBottom;
        input.setIsChatAtBottom(synchronizationResult.nextIsAtBottom);
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
    input.activeTab,
    input.chatScrollStateCoordinator,
    input.isChatAtBottomRef,
    input.scrollRef,
    input.selectedThreadId,
    input.setIsChatAtBottom
  ]);

  useEffect(() => {
    if (input.activeTab === "chat" && input.isChatAtBottomRef.current && input.scrollRef.current) {
      input.chatScrollStateCoordinator.pinToBottom(input.scrollRef.current);
    }
  }, [
    input.activeTab,
    input.chatScrollStateCoordinator,
    input.conversationItemCount,
    input.isChatAtBottomRef,
    input.scrollRef
  ]);

  useEffect(() => {
    if (input.activeTab !== "chat" || !input.scrollRef.current || !input.chatContentRef.current) {
      return;
    }

    const scroller = input.scrollRef.current;
    const content = input.chatContentRef.current;
    let rafId: number | null = null;

    const observer = new ResizeObserver(() => {
      if (!input.isChatAtBottomRef.current) {
        return;
      }
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        input.chatScrollStateCoordinator.pinToBottom(scroller);
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
    input.activeTab,
    input.chatContentRef,
    input.chatScrollStateCoordinator,
    input.isChatAtBottomRef,
    input.scrollRef,
    input.selectedThreadId
  ]);

  useEffect(() => {
    if (input.activeTab !== "chat" || !input.scrollRef.current) {
      return;
    }
    input.chatScrollStateCoordinator.pinToBottom(input.scrollRef.current);
    input.isChatAtBottomRef.current = true;
    input.setIsChatAtBottom(true);
    input.setVisibleChatItemLimit(input.initialVisibleChatItemCount);
  }, [
    input.activeTab,
    input.chatScrollStateCoordinator,
    input.initialVisibleChatItemCount,
    input.isChatAtBottomRef,
    input.scrollRef,
    input.selectedThreadId,
    input.setIsChatAtBottom,
    input.setVisibleChatItemLimit
  ]);
}

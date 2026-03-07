/**
 * Owns thread identifiers proven unreadable by direct thread-read routes.
 * These identifiers are filtered from list/sidebar projections until a later successful
 * direct read clears them, preventing stale archived entries from remaining tappable.
 */
export class ThreadUnreadableStateOwner {
  private readonly unreadableThreadIdentifiers = new Set<string>();

  public markThreadUnreadable(threadId: string): void {
    this.unreadableThreadIdentifiers.add(threadId);
  }

  public clearThreadUnreadable(threadId: string): void {
    this.unreadableThreadIdentifiers.delete(threadId);
  }

  public shouldIncludeThread(threadId: string): boolean {
    return !this.unreadableThreadIdentifiers.has(threadId);
  }
}

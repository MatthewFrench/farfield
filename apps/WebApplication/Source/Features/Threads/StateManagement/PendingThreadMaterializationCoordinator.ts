export class PendingThreadMaterializationCoordinator {
  private readonly pendingThreadIdentifiers: Set<string>;

  public constructor() {
    this.pendingThreadIdentifiers = new Set<string>();
  }

  public markPending(threadIdentifier: string): void {
    this.pendingThreadIdentifiers.add(threadIdentifier);
  }

  public clearPending(threadIdentifier: string): void {
    this.pendingThreadIdentifiers.delete(threadIdentifier);
  }

  public isPending(threadIdentifier: string): boolean {
    return this.pendingThreadIdentifiers.has(threadIdentifier);
  }

  public clearAll(): void {
    this.pendingThreadIdentifiers.clear();
  }

  public readPendingThreadIdentifiers(): string[] {
    return Array.from(this.pendingThreadIdentifiers);
  }
}

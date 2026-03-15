/**
 * Owns the final "is a full reload actually warranted" decision after a controller change.
 * Controller churn without a visible web-shell version change should not interrupt the session.
 */
export interface WebShellVersionSnapshot {
  buildId: string;
  gitCommit: string | null;
  serviceWorkerVersion: string | null;
}

export interface ServiceWorkerReloadEligibilityInput {
  hasPendingUpdate: boolean;
  nextVersionSnapshot: WebShellVersionSnapshot | null;
}

function readVersionChanged(
  currentVersionSnapshot: WebShellVersionSnapshot,
  nextVersionSnapshot: WebShellVersionSnapshot,
): boolean {
  return (
    currentVersionSnapshot.buildId !== nextVersionSnapshot.buildId ||
    currentVersionSnapshot.gitCommit !== nextVersionSnapshot.gitCommit ||
    currentVersionSnapshot.serviceWorkerVersion !== nextVersionSnapshot.serviceWorkerVersion
  );
}

export class ServiceWorkerReloadEligibilityOwner {
  private initialVersionSnapshot: WebShellVersionSnapshot | null;

  public constructor(initialVersionSnapshot: WebShellVersionSnapshot | null) {
    this.initialVersionSnapshot = initialVersionSnapshot;
  }

  public setInitialVersionSnapshot(initialVersionSnapshot: WebShellVersionSnapshot | null): void {
    this.initialVersionSnapshot = initialVersionSnapshot;
  }

  public readShouldReload(input: ServiceWorkerReloadEligibilityInput): boolean {
    if (!input.hasPendingUpdate) {
      return false;
    }
    if (this.initialVersionSnapshot === null || input.nextVersionSnapshot === null) {
      return false;
    }
    return readVersionChanged(this.initialVersionSnapshot, input.nextVersionSnapshot);
  }
}

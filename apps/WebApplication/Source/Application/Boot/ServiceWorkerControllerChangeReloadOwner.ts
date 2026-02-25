/**
 * Owns one-time reload behavior for service-worker controller changes.
 * The first controller adoption after a cold start must not reload because
 * that interrupts boot-time requests and produces avoidable runtime errors.
 */
export interface ServiceWorkerControllerChangeReloadDecisionInput {
  reloadSuppressed: boolean;
}

export interface ServiceWorkerControllerChangeReloadDecision {
  shouldReload: boolean;
}

export class ServiceWorkerControllerChangeReloadOwner {
  private hasSeenActiveController: boolean;
  private hasReloadedAfterControllerChange: boolean;

  public constructor(hasInitialController: boolean) {
    this.hasSeenActiveController = hasInitialController;
    this.hasReloadedAfterControllerChange = false;
  }

  public readDecision(
    input: ServiceWorkerControllerChangeReloadDecisionInput
  ): ServiceWorkerControllerChangeReloadDecision {
    if (!this.hasSeenActiveController) {
      this.hasSeenActiveController = true;
      return { shouldReload: false };
    }

    if (input.reloadSuppressed || this.hasReloadedAfterControllerChange) {
      return { shouldReload: false };
    }

    this.hasReloadedAfterControllerChange = true;
    return { shouldReload: true };
  }
}

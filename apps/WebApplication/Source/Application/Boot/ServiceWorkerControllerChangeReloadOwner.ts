/**
 * Owns one-time reload behavior for service-worker controller changes.
 * The first controller adoption after a cold start must not reload because
 * that interrupts boot-time requests and produces avoidable runtime errors.
 */
export interface ServiceWorkerControllerChangeReloadDecisionInput {
  reloadSuppressed: boolean;
}

export type ServiceWorkerControllerChangeReloadLifecyclePhase =
  | "awaiting-first-controller-adoption"
  | "ready-for-controller-change-reload"
  | "reload-already-requested";

export type ServiceWorkerControllerChangeReloadDecisionReason =
  | "first-controller-adoption"
  | "reload-suppressed"
  | "reload-already-requested"
  | "reload-required";

export interface ServiceWorkerControllerChangeReloadDecision {
  shouldReload: boolean;
  reason: ServiceWorkerControllerChangeReloadDecisionReason;
}

const SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_AWAITING_FIRST_CONTROLLER_ADOPTION: ServiceWorkerControllerChangeReloadLifecyclePhase =
  "awaiting-first-controller-adoption";
const SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_READY_FOR_CONTROLLER_CHANGE_RELOAD: ServiceWorkerControllerChangeReloadLifecyclePhase =
  "ready-for-controller-change-reload";
const SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_RELOAD_ALREADY_REQUESTED: ServiceWorkerControllerChangeReloadLifecyclePhase =
  "reload-already-requested";

const SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_FIRST_ADOPTION: ServiceWorkerControllerChangeReloadDecision =
  {
    shouldReload: false,
    reason: "first-controller-adoption",
  };
const SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_SUPPRESSED: ServiceWorkerControllerChangeReloadDecision =
  {
    shouldReload: false,
    reason: "reload-suppressed",
  };
const SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_ALREADY_REQUESTED: ServiceWorkerControllerChangeReloadDecision =
  {
    shouldReload: false,
    reason: "reload-already-requested",
  };
const SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_TRIGGER_RELOAD: ServiceWorkerControllerChangeReloadDecision =
  {
    shouldReload: true,
    reason: "reload-required",
  };

export class ServiceWorkerControllerChangeReloadOwner {
  private lifecyclePhase: ServiceWorkerControllerChangeReloadLifecyclePhase;

  public constructor(hasInitialController: boolean) {
    this.lifecyclePhase = hasInitialController
      ? SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_READY_FOR_CONTROLLER_CHANGE_RELOAD
      : SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_AWAITING_FIRST_CONTROLLER_ADOPTION;
  }

  public readDecision(
    input: ServiceWorkerControllerChangeReloadDecisionInput,
  ): ServiceWorkerControllerChangeReloadDecision {
    if (
      this.lifecyclePhase ===
      SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_AWAITING_FIRST_CONTROLLER_ADOPTION
    ) {
      this.lifecyclePhase =
        SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_READY_FOR_CONTROLLER_CHANGE_RELOAD;
      return SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_FIRST_ADOPTION;
    }

    if (input.reloadSuppressed) {
      return SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_SUPPRESSED;
    }

    if (this.lifecyclePhase === SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_RELOAD_ALREADY_REQUESTED) {
      return SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_SKIP_ALREADY_REQUESTED;
    }

    this.lifecyclePhase = SERVICE_WORKER_CONTROLLER_RELOAD_PHASE_RELOAD_ALREADY_REQUESTED;
    return SERVICE_WORKER_CONTROLLER_RELOAD_DECISION_TRIGGER_RELOAD;
  }
}

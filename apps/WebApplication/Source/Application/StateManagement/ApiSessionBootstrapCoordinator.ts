export interface ApiSessionBootstrapResponse {
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
}

export interface ApiSessionBootstrapDecision {
  isReady: boolean;
  requiresApiToken: boolean;
}

interface ApiSessionReadinessSnapshot {
  decision: ApiSessionBootstrapDecision;
  shouldRefreshInBackground: boolean;
}

const DEFAULT_REFRESH_LEAD_TIME_MS = 30_000;
const EMPTY_API_TOKEN_ERROR_MESSAGE = "API token is required";
const INVALID_EXPIRES_AT_ERROR_MESSAGE =
  "ApiSessionBootstrapCoordinator received an invalid expiresAt value";
const READY_DECISION: ApiSessionBootstrapDecision = {
  isReady: true,
  requiresApiToken: false
};
const API_TOKEN_REQUIRED_DECISION: ApiSessionBootstrapDecision = {
  isReady: false,
  requiresApiToken: true
};
const BOOTSTRAP_PENDING_DECISION: ApiSessionBootstrapDecision = {
  isReady: false,
  requiresApiToken: false
};

function cloneDecision(
  template: ApiSessionBootstrapDecision
): ApiSessionBootstrapDecision {
  return {
    isReady: template.isReady,
    requiresApiToken: template.requiresApiToken
  };
}

/**
 * Owns API session bootstrap readiness and refresh behavior for the web shell.
 * A still-valid authenticated session keeps the shell interactive while a background refresh runs.
 * Background refresh failures are intentionally consumed because current session data remains valid
 * until expiry and the next bootstrap attempt will retry through the same owner.
 */
export class ApiSessionBootstrapCoordinator {
  private readonly refreshLeadTimeMs: number;
  private inFlightBootstrapDecision: Promise<ApiSessionBootstrapDecision> | null;
  private authRequired: boolean | null;
  private isApiTokenRequired: boolean;
  private sessionExpiresAtEpochMs: number | null;

  public constructor(refreshLeadTimeMs: number = DEFAULT_REFRESH_LEAD_TIME_MS) {
    if (!Number.isInteger(refreshLeadTimeMs) || refreshLeadTimeMs < 0) {
      throw new Error("ApiSessionBootstrapCoordinator requires a non-negative integer refreshLeadTimeMs");
    }
    this.refreshLeadTimeMs = refreshLeadTimeMs;
    this.inFlightBootstrapDecision = null;
    this.authRequired = null;
    this.isApiTokenRequired = false;
    this.sessionExpiresAtEpochMs = null;
  }

  public markApiTokenRequired(): void {
    this.isApiTokenRequired = true;
  }

  public clearApiTokenRequired(): void {
    this.isApiTokenRequired = false;
  }

  public async ensureSession(
    loadSession: () => Promise<ApiSessionBootstrapResponse>,
    nowEpochMs: number = Date.now()
  ): Promise<ApiSessionBootstrapDecision> {
    const sessionReadinessSnapshot = this.readSessionReadinessSnapshot(nowEpochMs);
    if (
      sessionReadinessSnapshot.decision.isReady
      || sessionReadinessSnapshot.decision.requiresApiToken
    ) {
      return cloneDecision(sessionReadinessSnapshot.decision);
    }

    // Keep the app interactive while proactively refreshing a still-valid session.
    // The lead-time window is for refresh scheduling, not for blocking reads.
    if (sessionReadinessSnapshot.shouldRefreshInBackground) {
      this.runBackgroundRefresh(loadSession);
      return cloneDecision(READY_DECISION);
    }

    return this.executeBootstrapRequest(loadSession);
  }

  public async submitApiToken(
    apiToken: string,
    loadSessionWithApiToken: (apiToken: string) => Promise<ApiSessionBootstrapResponse>
  ): Promise<ApiSessionBootstrapDecision> {
    const normalizedApiToken = apiToken.trim();
    if (normalizedApiToken.length === 0) {
      throw new Error(EMPTY_API_TOKEN_ERROR_MESSAGE);
    }
    this.clearApiTokenRequired();
    return this.executeBootstrapRequest(
      () => loadSessionWithApiToken(normalizedApiToken)
    );
  }

  private async executeBootstrapRequest(
    loadSession: () => Promise<ApiSessionBootstrapResponse>
  ): Promise<ApiSessionBootstrapDecision> {
    if (this.inFlightBootstrapDecision) {
      return this.inFlightBootstrapDecision;
    }

    const inFlightBootstrapDecision = loadSession()
      .then((session) => {
        this.applyBootstrapResponse(session);
        return cloneDecision(this.readSessionReadinessSnapshot(Date.now()).decision);
      })
      .finally(() => {
        this.inFlightBootstrapDecision = null;
      });

    this.inFlightBootstrapDecision = inFlightBootstrapDecision;
    return inFlightBootstrapDecision;
  }

  private applyBootstrapResponse(session: ApiSessionBootstrapResponse): void {
    this.authRequired = session.authRequired;

    if (!session.authRequired) {
      this.isApiTokenRequired = false;
      this.sessionExpiresAtEpochMs = null;
      return;
    }

    if (!session.bootstrapped) {
      this.isApiTokenRequired = true;
      this.sessionExpiresAtEpochMs = null;
      return;
    }

    this.isApiTokenRequired = false;
    this.sessionExpiresAtEpochMs = this.readExpiresAtEpochMs(session.expiresAt);
  }

  private readSessionReadinessSnapshot(
    nowEpochMs: number
  ): ApiSessionReadinessSnapshot {
    if (this.authRequired === false) {
      return {
        decision: READY_DECISION,
        shouldRefreshInBackground: false
      };
    }

    if (this.isApiTokenRequired) {
      return {
        decision: API_TOKEN_REQUIRED_DECISION,
        shouldRefreshInBackground: false
      };
    }

    if (this.authRequired === true) {
      if (this.sessionExpiresAtEpochMs === null) {
        return {
          decision: BOOTSTRAP_PENDING_DECISION,
          shouldRefreshInBackground: false
        };
      }

      const refreshThresholdEpochMs = this.sessionExpiresAtEpochMs - this.refreshLeadTimeMs;
      const sessionShouldStayReady = nowEpochMs < refreshThresholdEpochMs;
      if (sessionShouldStayReady) {
        return {
          decision: READY_DECISION,
          shouldRefreshInBackground: false
        };
      }

      const hasUnexpiredSession = nowEpochMs < this.sessionExpiresAtEpochMs;
      return {
        decision: BOOTSTRAP_PENDING_DECISION,
        shouldRefreshInBackground: hasUnexpiredSession
      };
    }

    return {
      decision: BOOTSTRAP_PENDING_DECISION,
      shouldRefreshInBackground: false
    };
  }

  private readExpiresAtEpochMs(expiresAt: string | null): number | null {
    if (!expiresAt) {
      return null;
    }
    const expiresAtEpochMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtEpochMs)) {
      // Boundary schemas guarantee datetime strings; throw hard if contract drift slips through.
      throw new Error(`${INVALID_EXPIRES_AT_ERROR_MESSAGE}: ${expiresAt}`);
    }
    return expiresAtEpochMs;
  }

  private runBackgroundRefresh(
    loadSession: () => Promise<ApiSessionBootstrapResponse>
  ): void {
    void this.executeBootstrapRequest(loadSession).catch(() => {
      // Refresh errors are consumed because session use remains valid until expiry.
      return undefined;
    });
  }
}

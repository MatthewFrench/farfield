export interface ApiSessionBootstrapResponse {
  authRequired: boolean;
  bootstrapped: boolean;
  expiresAt: string | null;
}

export interface ApiSessionBootstrapDecision {
  isReady: boolean;
  requiresApiToken: boolean;
}

const DEFAULT_REFRESH_LEAD_TIME_MS = 30_000;
const EMPTY_API_TOKEN_ERROR_MESSAGE = "API token is required";

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
    const currentDecision = this.readDecision(nowEpochMs);
    if (currentDecision.isReady || currentDecision.requiresApiToken) {
      return currentDecision;
    }

    // Keep the app interactive while proactively refreshing a still-valid session.
    // The lead-time window is for refresh scheduling, not for blocking reads.
    if (this.hasValidSessionAt(nowEpochMs)) {
      this.runBackgroundRefresh(loadSession);
      return {
        isReady: true,
        requiresApiToken: false
      };
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
        return this.readDecision(Date.now());
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

  private readDecision(nowEpochMs: number): ApiSessionBootstrapDecision {
    if (this.authRequired === false) {
      return {
        isReady: true,
        requiresApiToken: false
      };
    }

    if (this.isApiTokenRequired) {
      return {
        isReady: false,
        requiresApiToken: true
      };
    }

    if (this.authRequired === true) {
      if (this.sessionExpiresAtEpochMs === null) {
        return {
          isReady: false,
          requiresApiToken: false
        };
      }

      const refreshThresholdEpochMs = this.sessionExpiresAtEpochMs - this.refreshLeadTimeMs;
      const sessionStillFresh = nowEpochMs < refreshThresholdEpochMs;
      return {
        isReady: sessionStillFresh,
        requiresApiToken: false
      };
    }

    return {
      isReady: false,
      requiresApiToken: false
    };
  }

  private readExpiresAtEpochMs(expiresAt: string | null): number | null {
    if (!expiresAt) {
      return null;
    }
    const expiresAtEpochMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtEpochMs)) {
      return null;
    }
    return expiresAtEpochMs;
  }

  private hasValidSessionAt(nowEpochMs: number): boolean {
    if (this.authRequired !== true || this.isApiTokenRequired) {
      return false;
    }
    if (this.sessionExpiresAtEpochMs === null) {
      return false;
    }
    return nowEpochMs < this.sessionExpiresAtEpochMs;
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

import fs from "node:fs/promises";
import path from "node:path";
import { DebugErrorEventSchema, DebugErrorListResponseSchema } from "@farfield/protocol";
import type {
  APIRequestContext,
  APIResponse,
  Response as BrowserResponse,
  ConsoleMessage,
  Page,
  TestInfo,
} from "@playwright/test";
import { z } from "zod";
import { buildSignalFailureMessage } from "./diagnostics";
import {
  findMatchingSignalAllowlistEntry,
  type SignalMatchInput,
  type SignalType,
} from "./signal-allowlist";

const HealthEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    state: z
      .object({
        appReady: z.boolean(),
        ipcConnected: z.boolean(),
        ipcInitialized: z.boolean(),
        gitCommit: z.string().nullable().optional(),
        lastError: z.string().nullable(),
        historyCount: z.number().int().nonnegative(),
        threadOwnerCount: z.number().int().nonnegative(),
      })
      .passthrough(),
  })
  .passthrough();

const DebugErrorListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(DebugErrorListResponseSchema)
  .strict();

const BannerEventTypeSchema = z.enum(["appeared", "updated", "removed"]);

const BannerEventSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    eventType: BannerEventTypeSchema,
    at: z.string().datetime(),
    operation: z.string(),
    message: z.string(),
    requestId: z.string().nullable(),
    errorId: z.string().nullable(),
  })
  .strict();

const BannerEventArraySchema = z.array(BannerEventSchema);

const ApiFailureSchema = z
  .object({
    method: z.string().min(1),
    url: z.string().min(1),
    status: z.number().int().min(100).max(599),
    statusText: z.string(),
  })
  .strict();

const LoadingTimeoutBreachSchema = z
  .object({
    surface: z.string().min(1),
    timeoutMs: z.number().int().positive(),
    observedState: z.string().min(1),
  })
  .strict();

const ErrorSentinelSummarySchema = z
  .object({
    scenarioId: z.string().min(1),
    recordedAt: z.string().datetime(),
    baselineErrorCount: z.number().int().nonnegative(),
    newErrorEvents: z.array(DebugErrorEventSchema),
    failedApiResponses: z.array(ApiFailureSchema),
    consoleWarnings: z.array(z.string()),
    consoleErrors: z.array(z.string()),
    pageErrors: z.array(z.string()),
    bannerEvents: BannerEventArraySchema,
    loadingTimeoutBreaches: z.array(LoadingTimeoutBreachSchema),
    summaryPath: z.string().min(1),
  })
  .strict();

type DebugErrorEvent = z.infer<typeof DebugErrorEventSchema>;
type BannerEvent = z.infer<typeof BannerEventSchema>;
type ApiFailure = z.infer<typeof ApiFailureSchema>;
type LoadingTimeoutBreach = z.infer<typeof LoadingTimeoutBreachSchema>;

type SignalFailure = {
  signalType: SignalType;
  detail: string;
  input: SignalMatchInput;
};

function sanitizeScenarioId(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return sanitized.length > 0 ? sanitized : "scenario";
}

function buildSignalInput(partial: {
  signalType: SignalType;
  operation?: string;
  message?: string;
  url?: string;
  text?: string;
  surface?: string;
  status?: number | null;
}): SignalMatchInput {
  return {
    signalType: partial.signalType,
    operation: partial.operation ?? "",
    message: partial.message ?? "",
    url: partial.url ?? "",
    text: partial.text ?? "",
    surface: partial.surface ?? "",
    status: typeof partial.status === "number" ? partial.status : null,
  };
}

function describeConsoleMessage(message: ConsoleMessage): string {
  const location = message.location();
  const locationPrefix = location.url
    ? `${location.url}:${String(location.lineNumber)}:${String(location.columnNumber)}`
    : "console";
  return `${locationPrefix} ${message.text()}`.trim();
}

export interface ErrorSentinelOptions {
  page: Page;
  request: APIRequestContext;
  testInfo: TestInfo;
  scenarioId: string;
  enforceRuntimeAvailabilityCheck?: boolean;
  enforceDebugErrorEndpointReads?: boolean;
}

export class ErrorSentinel {
  private readonly page: Page;
  private readonly request: APIRequestContext;
  private readonly testInfo: TestInfo;
  private readonly scenarioId: string;
  private readonly enforceRuntimeAvailabilityCheck: boolean;
  private readonly enforceDebugErrorEndpointReads: boolean;

  private readonly baselineErrorIds = new Set<string>();
  private newErrorEvents: DebugErrorEvent[] = [];
  private readonly failedApiResponses: ApiFailure[] = [];
  private readonly consoleWarnings: string[] = [];
  private readonly consoleErrors: string[] = [];
  private readonly pageErrors: string[] = [];
  private bannerEvents: BannerEvent[] = [];
  private readonly loadingTimeoutBreaches: LoadingTimeoutBreach[] = [];

  private initialized = false;
  private static readonly REQUEST_RETRY_ATTEMPTS = 3;
  private static readonly REQUEST_RETRY_BASE_DELAY_MS = 200;

  private readonly handleResponse = (response: BrowserResponse): void => {
    const url = response.url();
    if (!url.includes("/api/")) {
      return;
    }

    const status = response.status();
    if (status < 400) {
      return;
    }

    const failure = ApiFailureSchema.parse({
      method: response.request().method(),
      url,
      status,
      statusText: response.statusText(),
    });

    this.failedApiResponses.push(failure);
  };

  private readonly handleConsole = (message: ConsoleMessage): void => {
    const type = message.type();
    if (type === "warning") {
      this.consoleWarnings.push(describeConsoleMessage(message));
      return;
    }
    if (type === "error") {
      this.consoleErrors.push(describeConsoleMessage(message));
    }
  };

  private readonly handlePageError = (error: Error): void => {
    this.pageErrors.push(error.message);
  };

  public constructor(options: ErrorSentinelOptions) {
    this.page = options.page;
    this.request = options.request;
    this.testInfo = options.testInfo;
    this.scenarioId = options.scenarioId;
    this.enforceRuntimeAvailabilityCheck = options.enforceRuntimeAvailabilityCheck ?? true;
    this.enforceDebugErrorEndpointReads = options.enforceDebugErrorEndpointReads ?? true;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.enforceRuntimeAvailabilityCheck) {
      await this.verifyRuntimeAvailability();
    }
    await this.installBannerObserver();

    if (this.enforceDebugErrorEndpointReads) {
      const baseline = await this.fetchDebugErrors();
      for (const event of baseline) {
        this.baselineErrorIds.add(event.errorId);
      }
    }

    this.page.on("response", this.handleResponse);
    this.page.on("console", this.handleConsole);
    this.page.on("pageerror", this.handlePageError);

    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.page.off("response", this.handleResponse);
    this.page.off("console", this.handleConsole);
    this.page.off("pageerror", this.handlePageError);

    if (!this.page.isClosed()) {
      await this.page.evaluate(() => {
        const typedWindow = window as Window & { __farfieldBannerEvents?: object[] };
        typedWindow.__farfieldBannerEvents = [];
      });
    }

    this.initialized = false;
  }

  public recordLoadingTimeoutBreach(input: {
    surface: string;
    timeoutMs: number;
    observedState: string;
  }): void {
    const breach = LoadingTimeoutBreachSchema.parse(input);
    this.loadingTimeoutBreaches.push(breach);
  }

  public async refresh(): Promise<void> {
    if (this.enforceDebugErrorEndpointReads) {
      const allEvents = await this.fetchDebugErrors();
      this.newErrorEvents = allEvents.filter((event) => !this.baselineErrorIds.has(event.errorId));
    } else {
      this.newErrorEvents = [];
    }
    this.bannerEvents = await this.readBannerEvents();
  }

  public async markCurrentDebugErrorsAsBaseline(): Promise<void> {
    if (!this.enforceDebugErrorEndpointReads) {
      return;
    }

    const allEvents = await this.fetchDebugErrors();
    this.baselineErrorIds.clear();
    for (const event of allEvents) {
      this.baselineErrorIds.add(event.errorId);
    }
    this.newErrorEvents = [];
  }

  public async assertNoUnexpectedClientErrors(): Promise<void> {
    await this.refresh();

    const failures: SignalFailure[] = [];
    for (const event of this.newErrorEvents) {
      const input = buildSignalInput({
        signalType: "debug-error",
        operation: event.operation,
        message: event.message,
        text: `${event.operation} ${event.message}`,
      });

      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "debug-error",
          input,
          detail: `${event.errorId} ${event.operation}: ${event.message}`,
        });
      }
    }

    if (failures.length > 0) {
      throw new Error(
        buildSignalFailureMessage(
          "Unexpected debug error events",
          failures.map((failure) => failure.detail),
        ),
      );
    }
  }

  public async assertNoFailedApiResponses(): Promise<void> {
    await this.refresh();

    const failures: SignalFailure[] = [];
    for (const event of this.failedApiResponses) {
      const input = buildSignalInput({
        signalType: "api-failure",
        url: event.url,
        status: event.status,
        text: `${event.method} ${event.url} -> ${String(event.status)} ${event.statusText}`,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "api-failure",
          input,
          detail: `${event.method} ${event.url} -> ${String(event.status)} ${event.statusText}`,
        });
      }
    }

    if (failures.length > 0) {
      throw new Error(
        buildSignalFailureMessage(
          "Unexpected failed API responses",
          failures.map((failure) => failure.detail),
        ),
      );
    }
  }

  public async assertNoUnexpectedWarningsOrErrors(): Promise<void> {
    await this.refresh();

    const failures: SignalFailure[] = [];

    for (const line of this.consoleWarnings) {
      const input = buildSignalInput({
        signalType: "console-warning",
        text: line,
        message: line,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "console-warning",
          input,
          detail: line,
        });
      }
    }

    for (const line of this.consoleErrors) {
      const input = buildSignalInput({
        signalType: "console-error",
        text: line,
        message: line,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "console-error",
          input,
          detail: line,
        });
      }
    }

    for (const line of this.pageErrors) {
      const input = buildSignalInput({
        signalType: "page-error",
        text: line,
        message: line,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "page-error",
          input,
          detail: line,
        });
      }
    }

    for (const event of this.bannerEvents) {
      const input = buildSignalInput({
        signalType: "banner-event",
        operation: event.operation,
        message: event.message,
        text: `${event.eventType} ${event.operation} ${event.message}`,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "banner-event",
          input,
          detail: `${event.eventType} ${event.operation}: ${event.message}`,
        });
      }
    }

    for (const breach of this.loadingTimeoutBreaches) {
      const input = buildSignalInput({
        signalType: "loading-timeout",
        surface: breach.surface,
        text: `${breach.surface} timeout ${String(breach.timeoutMs)}ms (${breach.observedState})`,
      });
      const allowed = findMatchingSignalAllowlistEntry(input);
      if (!allowed) {
        failures.push({
          signalType: "loading-timeout",
          input,
          detail: `${breach.surface} timeout ${String(breach.timeoutMs)}ms (state=${breach.observedState})`,
        });
      }
    }

    if (failures.length > 0) {
      throw new Error(
        buildSignalFailureMessage(
          "Unexpected warning/error signals",
          failures.map((failure) => failure.detail),
        ),
      );
    }
  }

  public async assertNoUnexpectedSignals(): Promise<void> {
    await this.assertNoUnexpectedClientErrors();
    await this.assertNoFailedApiResponses();
    await this.assertNoUnexpectedWarningsOrErrors();
  }

  public async writeSummary(): Promise<string> {
    await this.refresh();

    const outputDirectory = path.join(process.cwd(), ".runtime", "end-to-end-sentinel");
    await fs.mkdir(outputDirectory, { recursive: true });

    const scenarioFileName = `${sanitizeScenarioId(this.scenarioId)}.ndjson`;
    const summaryPath = path.join(outputDirectory, scenarioFileName);

    const summary = ErrorSentinelSummarySchema.parse({
      scenarioId: this.scenarioId,
      recordedAt: new Date().toISOString(),
      baselineErrorCount: this.baselineErrorIds.size,
      newErrorEvents: this.newErrorEvents,
      failedApiResponses: this.failedApiResponses,
      consoleWarnings: this.consoleWarnings,
      consoleErrors: this.consoleErrors,
      pageErrors: this.pageErrors,
      bannerEvents: this.bannerEvents,
      loadingTimeoutBreaches: this.loadingTimeoutBreaches,
      summaryPath,
    });

    const encoded = `${JSON.stringify(summary)}\n`;
    await fs.writeFile(summaryPath, encoded, "utf8");
    await fs.writeFile(path.join(outputDirectory, "latest.ndjson"), encoded, "utf8");

    await this.testInfo.attach("end-to-end-sentinel-summary", {
      body: Buffer.from(JSON.stringify(summary, null, 2), "utf8"),
      contentType: "application/json",
    });

    process.stdout.write(
      `[end-to-end-sentinel] ${this.scenarioId}: debug=${String(this.newErrorEvents.length)} api=${String(this.failedApiResponses.length)} warn=${String(this.consoleWarnings.length)} err=${String(this.consoleErrors.length)} page=${String(this.pageErrors.length)} banner=${String(this.bannerEvents.length)} timeout=${String(this.loadingTimeoutBreaches.length)}\n`,
    );
    process.stdout.write(`[end-to-end-sentinel] summary ${summaryPath}\n`);

    return summaryPath;
  }

  private async verifyRuntimeAvailability(): Promise<void> {
    const healthResponse = await this.getApiWithRetry("/api/health");
    if (!healthResponse.ok()) {
      throw new Error(
        `Runtime health check failed: GET /api/health -> HTTP ${String(healthResponse.status())}`,
      );
    }

    const healthPayload = await healthResponse.json();
    HealthEnvelopeSchema.parse(healthPayload);
  }

  private async fetchDebugErrors(): Promise<DebugErrorEvent[]> {
    const response = await this.getApiWithRetry("/api/debug/client-errors?limit=120");
    if (!response.ok()) {
      throw new Error(
        `Debug error endpoint failed: GET /api/debug/client-errors -> HTTP ${String(response.status())}`,
      );
    }

    const payload = await response.json();
    const parsed = DebugErrorListEnvelopeSchema.parse(payload);
    return parsed.data;
  }

  private async getApiWithRetry(pathname: string): Promise<APIResponse> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= ErrorSentinel.REQUEST_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const response = await this.request.get(pathname);
        if (response.status() >= 500 && attempt < ErrorSentinel.REQUEST_RETRY_ATTEMPTS) {
          await this.waitBeforeRetry(attempt);
          continue;
        }
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt >= ErrorSentinel.REQUEST_RETRY_ATTEMPTS) {
          throw lastError;
        }
        await this.waitBeforeRetry(attempt);
      }
    }

    throw lastError ?? new Error(`Request failed for ${pathname}`);
  }

  private async waitBeforeRetry(attempt: number): Promise<void> {
    const delayMs = ErrorSentinel.REQUEST_RETRY_BASE_DELAY_MS * attempt;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  private async readBannerEvents(): Promise<BannerEvent[]> {
    if (this.page.isClosed()) {
      return [];
    }

    const rawEvents = await this.page.evaluate(() => {
      const typedWindow = window as Window & { __farfieldBannerEvents?: object[] };
      return typedWindow.__farfieldBannerEvents ?? [];
    });

    return BannerEventArraySchema.parse(rawEvents);
  }

  private async installBannerObserver(): Promise<void> {
    await this.page.addInitScript(() => {
      type BannerEventType = "appeared" | "updated" | "removed";

      type BannerEventRecord = {
        sequence: number;
        eventType: BannerEventType;
        at: string;
        operation: string;
        message: string;
        requestId: string | null;
        errorId: string | null;
      };

      type BannerDetails = {
        operation: string;
        message: string;
        requestId: string | null;
        errorId: string | null;
      };

      const typedWindow = window as Window & {
        __farfieldBannerEvents?: BannerEventRecord[];
        __farfieldBannerObserverInstalled?: boolean;
      };

      if (typedWindow.__farfieldBannerObserverInstalled) {
        typedWindow.__farfieldBannerEvents = [];
        return;
      }

      typedWindow.__farfieldBannerObserverInstalled = true;
      typedWindow.__farfieldBannerEvents = [];

      let sequence = 0;
      let previousSnapshot = "";
      let previousDetails: BannerDetails = {
        operation: "",
        message: "",
        requestId: null,
        errorId: null,
      };

      const appendEvent = (eventType: BannerEventType, details: BannerDetails): void => {
        const events = typedWindow.__farfieldBannerEvents ?? [];
        events.push({
          sequence,
          eventType,
          at: new Date().toISOString(),
          operation: details.operation,
          message: details.message,
          requestId: details.requestId,
          errorId: details.errorId,
        });
        sequence += 1;
        if (events.length > 200) {
          events.splice(0, events.length - 200);
        }
        typedWindow.__farfieldBannerEvents = events;
      };

      const readBannerDetails = (): BannerDetails | null => {
        const banner = document.querySelector('[data-testid="error-banner"]');
        if (!banner) {
          return null;
        }

        const operation =
          banner.querySelector('[data-testid="error-banner-operation"]')?.textContent?.trim() ?? "";
        const message =
          banner.querySelector('[data-testid="error-banner-message"]')?.textContent?.trim() ?? "";

        const requestRaw =
          banner.querySelector('[data-testid="error-banner-request-id"]')?.textContent?.trim() ??
          "";
        const errorRaw =
          banner.querySelector('[data-testid="error-banner-error-id"]')?.textContent?.trim() ?? "";

        const requestId = requestRaw.startsWith("request ")
          ? requestRaw.slice("request ".length).trim()
          : null;
        const errorId = errorRaw.startsWith("error ")
          ? errorRaw.slice("error ".length).trim()
          : null;

        return {
          operation,
          message,
          requestId,
          errorId,
        };
      };

      const snapshotFromDetails = (details: BannerDetails): string =>
        `${details.operation}|${details.message}|${details.requestId ?? ""}|${details.errorId ?? ""}`;

      const reconcile = (): void => {
        const details = readBannerDetails();

        if (!details) {
          if (previousSnapshot.length > 0) {
            appendEvent("removed", previousDetails);
            previousSnapshot = "";
            previousDetails = {
              operation: "",
              message: "",
              requestId: null,
              errorId: null,
            };
          }
          return;
        }

        const nextSnapshot = snapshotFromDetails(details);

        if (previousSnapshot.length === 0) {
          appendEvent("appeared", details);
          previousSnapshot = nextSnapshot;
          previousDetails = details;
          return;
        }

        if (previousSnapshot !== nextSnapshot) {
          appendEvent("updated", details);
          previousSnapshot = nextSnapshot;
          previousDetails = details;
        }
      };

      const startObserver = (): void => {
        const root = document.documentElement;
        if (!root) {
          return;
        }

        const observer = new MutationObserver(() => {
          reconcile();
        });

        observer.observe(root, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
        });

        reconcile();
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          startObserver();
        });
      } else {
        startObserver();
      }
    });
  }
}

export async function createErrorSentinel(options: ErrorSentinelOptions): Promise<ErrorSentinel> {
  const sentinel = new ErrorSentinel(options);
  await sentinel.initialize();
  return sentinel;
}

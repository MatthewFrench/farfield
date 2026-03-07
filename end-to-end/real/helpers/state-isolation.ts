import {
  AppServerStartThreadResponseSchema,
  FarfieldThreadListResponseSchema,
} from "@farfield/protocol";
import type { APIRequestContext, Page, Request } from "@playwright/test";
import { z } from "zod";

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
  })
  .merge(FarfieldThreadListResponseSchema)
  .strict();

const CreateThreadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    agentId: z.enum(["codex", "opencode"]),
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough();

const ArchiveThreadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
  })
  .strict();

const SendManagedThreadMessageEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
  })
  .strict();

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1),
  })
  .strict();
const ManagedThreadReadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    thread: z
      .object({
        id: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();
const ManagedThreadCompletionReadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    thread: z
      .object({
        turns: z.array(
          z
            .object({
              status: z.string().min(1),
            })
            .passthrough(),
        ),
      })
      .passthrough(),
  })
  .passthrough();
const ManagedThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(
      z
        .object({
          id: z.string().min(1),
        })
        .passthrough(),
    ),
  })
  .passthrough();
const THREAD_BASELINE_FETCH_MAXIMUM_ATTEMPTS = 12;
const THREAD_BASELINE_FETCH_RETRY_DELAY_MILLISECONDS = 500;
const MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS = 60;
const MANAGED_THREAD_READINESS_RETRY_DELAY_MILLISECONDS = 500;
const TURN_IN_PROGRESS_STATUS = "inProgress";
const TURN_IN_PROGRESS_UNDERSCORE_STATUS = "in_progress";

function isManagedThreadAlreadyGone(errorMessage: string): boolean {
  return (
    /no rollout found for thread id/i.test(errorMessage) ||
    /thread .* is not registered/i.test(errorMessage) ||
    /thread not loaded in app-server/i.test(errorMessage)
  );
}

function isManagedThreadStillMaterializing(errorMessage: string): boolean {
  return /includeTurns is unavailable before first user message/i.test(errorMessage);
}

function parseApiPath(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

function decodeThreadIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/threads\/([^/]+)\//);
  if (!match || typeof match[1] !== "string" || match[1].trim().length === 0) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

function isThreadMutationPath(pathname: string): boolean {
  return (
    pathname.endsWith("/messages") ||
    pathname.endsWith("/collaboration-mode") ||
    pathname.endsWith("/user-input") ||
    pathname.endsWith("/interrupt")
  );
}

function shouldRetryThreadBaselineFetch(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function readErrorMessage<ErrorType>(error: ErrorType): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

export class RealAppStateIsolationGuard {
  private readonly page: Page;
  private readonly request: APIRequestContext;
  private readonly baselineThreadIds = new Set<string>();
  private readonly managedThreadIds = new Set<string>();
  private readonly violations: string[] = [];
  private initialized = false;

  private readonly handleRequest = (request: Request): void => {
    const method = request.method().toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }

    const pathname = parseApiPath(request.url());
    if (!pathname || !pathname.startsWith("/api/")) {
      return;
    }

    if (method === "POST" && pathname === "/api/threads") {
      this.violations.push(
        "POST /api/threads from browser is not allowed in real end-to-end tests. Use guard.createManagedThread() so thread lifecycle is isolated.",
      );
      return;
    }

    if (method !== "POST" || !isThreadMutationPath(pathname)) {
      return;
    }

    const threadId = decodeThreadIdFromPath(pathname);
    if (!threadId) {
      return;
    }

    if (this.managedThreadIds.has(threadId)) {
      return;
    }

    if (this.baselineThreadIds.has(threadId)) {
      this.violations.push(
        `Mutation request POST ${pathname} targeted pre-existing thread ${threadId}`,
      );
      return;
    }

    this.violations.push(
      `Mutation request POST ${pathname} targeted unmanaged thread ${threadId}. Register thread through guard.createManagedThread() before mutating it.`,
    );
  };

  public constructor(options: { page: Page; request: APIRequestContext }) {
    this.page = options.page;
    this.request = options.request;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const baselineIds = await this.fetchThreadIds();
    for (const threadId of baselineIds) {
      this.baselineThreadIds.add(threadId);
    }

    this.page.on("request", this.handleRequest);
    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.page.off("request", this.handleRequest);
    await this.archiveManagedThreads();
    this.initialized = false;
  }

  public async createManagedThread(input?: {
    agentId?: "codex" | "opencode";
    cwd?: string;
    ephemeral?: boolean;
  }): Promise<string> {
    const response = await this.request.post("/api/threads", {
      data: {
        ...(input?.agentId ? { agentId: input.agentId } : {}),
        ...(input?.cwd ? { cwd: input.cwd } : {}),
        ephemeral: input?.ephemeral ?? true,
      },
    });

    if (!response.ok()) {
      throw new Error(
        `Managed thread create failed: POST /api/threads -> HTTP ${String(response.status())}`,
      );
    }

    const payload = await response.json();
    const parsed = CreateThreadEnvelopeSchema.parse(payload);
    this.managedThreadIds.add(parsed.threadId);
    return parsed.threadId;
  }

  public async sendManagedThreadMessage(threadId: string, text: string): Promise<void> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(
        `Managed thread message send requires a registered managed thread: ${threadId}`,
      );
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new Error("Managed thread message send requires non-empty text.");
    }

    const response = await this.request.post(
      `/api/threads/${encodeURIComponent(threadId)}/messages`,
      {
        data: {
          text: trimmedText,
        },
      },
    );
    const payload = await response.json();

    if (!response.ok()) {
      const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
      if (parsedError.success) {
        throw new Error(
          `Managed thread message send failed: POST /api/threads/${threadId}/messages -> ${parsedError.data.error}`,
        );
      }
      throw new Error(
        `Managed thread message send failed: POST /api/threads/${threadId}/messages -> HTTP ${String(response.status())}`,
      );
    }

    const parsed = SendManagedThreadMessageEnvelopeSchema.parse(payload);
    if (parsed.threadId !== threadId) {
      throw new Error(
        `Managed thread message send returned mismatched threadId: expected ${threadId}, got ${parsed.threadId}`,
      );
    }
  }

  public async waitForManagedThreadReadiness(threadId: string): Promise<void> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(`Managed thread readiness requires a registered managed thread: ${threadId}`);
    }

    for (
      let attemptIndex = 0;
      attemptIndex < MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      const isFinalAttempt = attemptIndex + 1 >= MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      const response = await this.request.get(
        `/api/threads/${encodeURIComponent(threadId)}?includeTurns=true`,
      );
      const payload = await response.json();

      if (response.ok()) {
        const parsed = ManagedThreadReadEnvelopeSchema.parse(payload);
        if (parsed.thread.id !== threadId) {
          throw new Error(
            `Managed thread readiness returned mismatched threadId: expected ${threadId}, got ${parsed.thread.id}`,
          );
        }
        return;
      }

      const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
      if (!isFinalAttempt) {
        await delay(MANAGED_THREAD_READINESS_RETRY_DELAY_MILLISECONDS);
        continue;
      }

      if (parsedError.success && isManagedThreadStillMaterializing(parsedError.data.error)) {
        throw new Error(
          `Managed thread readiness timed out waiting for materialization: ${threadId}`,
        );
      }

      if (parsedError.success) {
        throw new Error(
          `Managed thread readiness failed: GET /api/threads/${threadId}?includeTurns=true -> ${parsedError.data.error}`,
        );
      }

      throw new Error(
        `Managed thread readiness failed: GET /api/threads/${threadId}?includeTurns=true -> HTTP ${String(response.status())}`,
      );
    }
  }

  public async waitForManagedThreadInActiveList(threadId: string): Promise<void> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(
        `Managed thread list visibility requires a registered managed thread: ${threadId}`,
      );
    }

    for (
      let attemptIndex = 0;
      attemptIndex < MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      const isFinalAttempt = attemptIndex + 1 >= MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      const response = await this.request.get(
        "/api/threads?limit=200&archived=false&all=true&maxPages=20",
      );
      const payload = await response.json();

      if (response.ok()) {
        const parsed = ManagedThreadListEnvelopeSchema.parse(payload);
        if (parsed.data.some((thread) => thread.id === threadId)) {
          return;
        }
      }

      if (isFinalAttempt) {
        throw new Error(
          `Managed thread list visibility timed out waiting for active list entry: ${threadId}`,
        );
      }

      await delay(MANAGED_THREAD_READINESS_RETRY_DELAY_MILLISECONDS);
    }
  }

  public async waitForManagedThreadTurnCompletion(threadId: string): Promise<void> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(
        `Managed thread turn completion requires a registered managed thread: ${threadId}`,
      );
    }

    for (
      let attemptIndex = 0;
      attemptIndex < MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      const isFinalAttempt = attemptIndex + 1 >= MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      const response = await this.request.get(
        `/api/threads/${encodeURIComponent(threadId)}?includeTurns=true`,
      );
      const payload = await response.json();

      if (response.ok()) {
        const parsed = ManagedThreadCompletionReadEnvelopeSchema.parse(payload);
        const lastTurn = parsed.thread.turns.at(-1);
        if (
          lastTurn !== undefined &&
          lastTurn.status !== TURN_IN_PROGRESS_STATUS &&
          lastTurn.status !== TURN_IN_PROGRESS_UNDERSCORE_STATUS
        ) {
          return;
        }
      }

      if (isFinalAttempt) {
        throw new Error(
          `Managed thread turn completion timed out waiting for a non-running last turn: ${threadId}`,
        );
      }

      await delay(MANAGED_THREAD_READINESS_RETRY_DELAY_MILLISECONDS);
    }
  }

  public async readManagedThreadTurnCount(threadId: string): Promise<number> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(`Managed thread turn count requires a registered managed thread: ${threadId}`);
    }

    const response = await this.request.get(
      `/api/threads/${encodeURIComponent(threadId)}?includeTurns=true`,
    );
    const payload = await response.json();
    if (!response.ok()) {
      const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
      if (parsedError.success) {
        throw new Error(
          `Managed thread turn count failed: GET /api/threads/${threadId}?includeTurns=true -> ${parsedError.data.error}`,
        );
      }
      throw new Error(
        `Managed thread turn count failed: GET /api/threads/${threadId}?includeTurns=true -> HTTP ${String(response.status())}`,
      );
    }

    const parsed = ManagedThreadCompletionReadEnvelopeSchema.parse(payload);
    return parsed.thread.turns.length;
  }

  public async waitForManagedThreadTurnCount(
    threadId: string,
    minimumTurnCount: number,
  ): Promise<void> {
    if (!this.managedThreadIds.has(threadId)) {
      throw new Error(
        `Managed thread turn count wait requires a registered managed thread: ${threadId}`,
      );
    }

    for (
      let attemptIndex = 0;
      attemptIndex < MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      const isFinalAttempt = attemptIndex + 1 >= MANAGED_THREAD_READINESS_FETCH_MAXIMUM_ATTEMPTS;
      const turnCount = await this.readManagedThreadTurnCount(threadId);
      if (turnCount >= minimumTurnCount) {
        return;
      }

      if (isFinalAttempt) {
        throw new Error(
          `Managed thread turn count timed out waiting for at least ${String(minimumTurnCount)} turns: ${threadId}`,
        );
      }

      await delay(MANAGED_THREAD_READINESS_RETRY_DELAY_MILLISECONDS);
    }
  }

  public assertNoViolations(): void {
    if (this.violations.length === 0) {
      return;
    }

    const formatted = this.violations.map((violation, index) => {
      return `${String(index + 1)}. ${violation}`;
    });

    throw new Error(`Real app state isolation violations detected:\n${formatted.join("\n")}`);
  }

  private async fetchThreadIds(): Promise<string[]> {
    for (
      let attemptIndex = 0;
      attemptIndex < THREAD_BASELINE_FETCH_MAXIMUM_ATTEMPTS;
      attemptIndex += 1
    ) {
      const isFinalAttempt = attemptIndex + 1 >= THREAD_BASELINE_FETCH_MAXIMUM_ATTEMPTS;

      try {
        const response = await this.request.get(
          "/api/threads?limit=200&archived=false&all=true&maxPages=20",
        );
        if (response.ok()) {
          const payload = await response.json();
          const parsed = ThreadListEnvelopeSchema.parse(payload);
          return parsed.data.map((thread) => thread.id);
        }

        const statusCode = response.status();
        if (isFinalAttempt || !shouldRetryThreadBaselineFetch(statusCode)) {
          throw new Error(
            `Thread baseline fetch failed: GET /api/threads -> HTTP ${String(statusCode)}`,
          );
        }
      } catch (error) {
        if (isFinalAttempt) {
          throw new Error(
            `Thread baseline fetch failed: GET /api/threads -> ${readErrorMessage(error)}`,
          );
        }
      }

      await delay(THREAD_BASELINE_FETCH_RETRY_DELAY_MILLISECONDS);
    }

    throw new Error("Thread baseline fetch failed: exhausted retry attempts");
  }

  private async archiveManagedThreads(): Promise<void> {
    const threadIds = Array.from(this.managedThreadIds);

    for (const threadId of threadIds) {
      const response = await this.request.post(
        `/api/threads/${encodeURIComponent(threadId)}/archive`,
      );
      const payload = await response.json();

      if (!response.ok()) {
        const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
        if (parsedError.success && isManagedThreadAlreadyGone(parsedError.data.error)) {
          continue;
        }
        this.violations.push(
          `Managed thread cleanup failed: POST /api/threads/${threadId}/archive -> HTTP ${String(response.status())}`,
        );
        continue;
      }

      const parsed = ArchiveThreadEnvelopeSchema.parse(payload);
      if (parsed.threadId !== threadId) {
        this.violations.push(
          `Managed thread cleanup returned mismatched threadId: expected ${threadId}, got ${parsed.threadId}`,
        );
      }
    }
  }
}

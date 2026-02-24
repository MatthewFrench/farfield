import {
  AppServerListThreadsResponseSchema,
  AppServerStartThreadResponseSchema
} from "@farfield/protocol";
import type {
  APIRequestContext,
  Page,
  Request
} from "@playwright/test";
import { z } from "zod";

const ThreadListEnvelopeSchema = z
  .object({
    ok: z.literal(true)
  })
  .merge(AppServerListThreadsResponseSchema)
  .strict();

const CreateThreadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1),
    agentId: z.enum(["codex", "opencode"])
  })
  .merge(AppServerStartThreadResponseSchema)
  .passthrough();

const ArchiveThreadEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string().min(1)
  })
  .strict();

const ApiErrorEnvelopeSchema = z
  .object({
    ok: z.literal(false),
    error: z.string().min(1)
  })
  .strict();

function isManagedThreadAlreadyGone(errorMessage: string): boolean {
  return (
    /no rollout found for thread id/i.test(errorMessage)
    || /thread .* is not registered/i.test(errorMessage)
    || /thread not loaded in app-server/i.test(errorMessage)
  );
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
        "POST /api/threads from browser is not allowed in real end-to-end tests. Use guard.createManagedThread() so thread lifecycle is isolated."
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
        `Mutation request POST ${pathname} targeted pre-existing thread ${threadId}`
      );
      return;
    }

    this.violations.push(
      `Mutation request POST ${pathname} targeted unmanaged thread ${threadId}. Register thread through guard.createManagedThread() before mutating it.`
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
  }): Promise<string> {
    const response = await this.request.post("/api/threads", {
      data: {
        ...(input?.agentId ? { agentId: input.agentId } : {}),
        ...(input?.cwd ? { cwd: input.cwd } : {}),
        ephemeral: true
      }
    });

    if (!response.ok()) {
      throw new Error(
        `Managed thread create failed: POST /api/threads -> HTTP ${String(response.status())}`
      );
    }

    const payload = await response.json();
    const parsed = CreateThreadEnvelopeSchema.parse(payload);
    this.managedThreadIds.add(parsed.threadId);
    return parsed.threadId;
  }

  public assertNoViolations(): void {
    if (this.violations.length === 0) {
      return;
    }

    const formatted = this.violations.map((violation, index) => {
      return `${String(index + 1)}. ${violation}`;
    });

    throw new Error(
      `Real app state isolation violations detected:\n${formatted.join("\n")}`
    );
  }

  private async fetchThreadIds(): Promise<string[]> {
    const response = await this.request.get(
      "/api/threads?limit=200&archived=0&all=1&maxPages=20"
    );
    if (!response.ok()) {
      throw new Error(
        `Thread baseline fetch failed: GET /api/threads -> HTTP ${String(response.status())}`
      );
    }

    const payload = await response.json();
    const parsed = ThreadListEnvelopeSchema.parse(payload);
    return parsed.data.map((thread) => thread.id);
  }

  private async archiveManagedThreads(): Promise<void> {
    const threadIds = Array.from(this.managedThreadIds);

    for (const threadId of threadIds) {
      const response = await this.request.post(
        `/api/threads/${encodeURIComponent(threadId)}/archive`
      );
      const payload = await response.json();

      if (!response.ok()) {
        const parsedError = ApiErrorEnvelopeSchema.safeParse(payload);
        if (parsedError.success && isManagedThreadAlreadyGone(parsedError.data.error)) {
          continue;
        }
        this.violations.push(
          `Managed thread cleanup failed: POST /api/threads/${threadId}/archive -> HTTP ${String(response.status())}`
        );
        continue;
      }

      const parsed = ArchiveThreadEnvelopeSchema.parse(payload);
      if (parsed.threadId !== threadId) {
        this.violations.push(
          `Managed thread cleanup returned mismatched threadId: expected ${threadId}, got ${parsed.threadId}`
        );
      }
    }
  }
}

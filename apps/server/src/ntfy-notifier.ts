import { z } from "zod";

const NtfyEnabledSchema = z.enum(["0", "1", "false", "true"]);
const NtfyPrioritySchema = z.enum(["1", "2", "3", "4", "5"]);

const RawNtfyEnvSchema = z
  .object({
    NTFY_ENABLED: z.string().optional(),
    NTFY_TOPIC: z.string().optional(),
    NTFY_BASE_URL: z.string().optional(),
    NTFY_BEARER_TOKEN: z.string().optional(),
    NTFY_PRIORITY: z.string().optional()
  })
  .strict();

const ParsedNtfyConfigSchema = z
  .object({
    enabled: z.boolean(),
    topic: z.union([z.string(), z.null()]),
    baseUrl: z.string().url(),
    bearerToken: z.union([z.string(), z.null()]),
    priority: NtfyPrioritySchema
  })
  .strict()
  .superRefine((value, context) => {
    if (value.enabled && !value.topic) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NTFY_TOPIC is required when NTFY_ENABLED is true"
      });
    }
  });

export interface NtfyConfig {
  enabled: boolean;
  topic: string | null;
  baseUrl: string;
  bearerToken: string | null;
  priority: z.infer<typeof NtfyPrioritySchema>;
}

export interface NtfyPublishResult {
  messageId: string | null;
}

export interface NtfyThreadCompletedPayload {
  threadId: string;
  preview: string;
  agentText: string;
}

function normalizeOptionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEnabledValue(value: string | undefined): boolean {
  const normalized = (value ?? "false").trim().toLowerCase();
  const parsed = NtfyEnabledSchema.parse(normalized);
  return parsed === "1" || parsed === "true";
}

function normalizePriorityValue(value: string | undefined): z.infer<typeof NtfyPrioritySchema> {
  return NtfyPrioritySchema.parse((value ?? "3").trim());
}

function normalizeBaseUrl(value: string | undefined): string {
  const normalized = normalizeOptionalString(value) ?? "https://ntfy.sh";
  return z.string().url().parse(normalized);
}

function buildNotificationBody(payload: NtfyThreadCompletedPayload): string {
  const preview = payload.preview.trim();
  const titleLine = preview.length > 0 ? preview : `Thread ${payload.threadId.slice(0, 8)}`;
  const agentText = payload.agentText.trim();
  const body = agentText.length > 0 ? `${titleLine}\n\n${agentText}` : titleLine;
  if (body.length <= 3_000) {
    return body;
  }
  return `${body.slice(0, 2_997)}...`;
}

export function parseNtfyConfigFromEnv(env: NodeJS.ProcessEnv): NtfyConfig {
  const raw = RawNtfyEnvSchema.parse({
    NTFY_ENABLED: env["NTFY_ENABLED"],
    NTFY_TOPIC: env["NTFY_TOPIC"],
    NTFY_BASE_URL: env["NTFY_BASE_URL"],
    NTFY_BEARER_TOKEN: env["NTFY_BEARER_TOKEN"],
    NTFY_PRIORITY: env["NTFY_PRIORITY"]
  });

  return ParsedNtfyConfigSchema.parse({
    enabled: normalizeEnabledValue(raw.NTFY_ENABLED),
    topic: normalizeOptionalString(raw.NTFY_TOPIC),
    baseUrl: normalizeBaseUrl(raw.NTFY_BASE_URL),
    bearerToken: normalizeOptionalString(raw.NTFY_BEARER_TOKEN),
    priority: normalizePriorityValue(raw.NTFY_PRIORITY)
  });
}

function buildPublishUrl(baseUrl: string, topic: string): string {
  const base = new URL(baseUrl);
  const normalizedPath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
  base.pathname = `${normalizedPath}${encodeURIComponent(topic)}`;
  return base.toString();
}

export class NtfyNotifier {
  private readonly config: NtfyConfig;

  public constructor(config: NtfyConfig) {
    this.config = config;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getSummary(): { enabled: boolean; baseUrl: string; topic: string | null } {
    return {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl,
      topic: this.config.topic
    };
  }

  public async publishThreadCompleted(
    payload: NtfyThreadCompletedPayload
  ): Promise<NtfyPublishResult> {
    if (!this.config.enabled || !this.config.topic) {
      return {
        messageId: null
      };
    }

    const response = await fetch(buildPublishUrl(this.config.baseUrl, this.config.topic), {
      method: "POST",
      headers: {
        ...(this.config.bearerToken ? { Authorization: `Bearer ${this.config.bearerToken}` } : {}),
        Title: "Farfield thread completed",
        Priority: this.config.priority,
        Tags: "white_check_mark,robot_face",
        "Content-Type": "text/plain; charset=utf-8"
      },
      body: buildNotificationBody(payload)
    });

    if (!response.ok) {
      const responseText = (await response.text()).trim();
      throw new Error(
        responseText.length > 0
          ? `ntfy publish failed (${String(response.status)}): ${responseText}`
          : `ntfy publish failed (${String(response.status)})`
      );
    }

    const messageId = (await response.text()).trim();
    return {
      messageId: messageId.length > 0 ? messageId : null
    };
  }
}

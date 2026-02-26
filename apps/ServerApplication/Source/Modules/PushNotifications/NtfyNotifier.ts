import { z } from "zod";

const NtfyEnabledSchema = z.enum(["0", "1", "false", "true"]);
const NtfyPrioritySchema = z.enum(["1", "2", "3", "4", "5"]);
const NtfyThreadCompletedPayloadSchema = z
  .object({
    threadId: z.string(),
    preview: z.string(),
    projectName: z.string(),
    threadName: z.string(),
    agentText: z.string()
  })
  .strict();
const DEFAULT_NTFY_ENABLED = "false";
const DEFAULT_NTFY_PRIORITY = "3";
const DEFAULT_NTFY_BASE_URL = "https://ntfy.sh";
const DEFAULT_NOTIFICATION_BODY = "Response ready.";
const DEFAULT_NOTIFICATION_PROJECT_TITLE = "No project";
const DEFAULT_NOTIFICATION_THREAD_TITLE = "Thread";
const NOTIFICATION_TITLE_SEPARATOR = " - ";
const NOTIFICATION_BODY_MAXIMUM_CHARACTERS = 3_000;
const NOTIFICATION_BODY_TRUNCATED_SUFFIX = "...";
const NOTIFICATION_BODY_PREVIEW_CHARACTERS =
  NOTIFICATION_BODY_MAXIMUM_CHARACTERS - NOTIFICATION_BODY_TRUNCATED_SUFFIX.length;
const NTFY_TAGS_HEADER_VALUE = "white_check_mark,robot_face";
const NTFY_CONTENT_TYPE_HEADER_VALUE = "text/plain; charset=utf-8";
const NTFY_PUBLISH_HTTP_METHOD = "POST" as const;
const NTFY_AUTHORIZATION_HEADER_NAME = "Authorization";
const NTFY_AUTHORIZATION_BEARER_PREFIX = "Bearer ";
const NTFY_TITLE_HEADER_NAME = "Title";
const NTFY_PRIORITY_HEADER_NAME = "Priority";
const NTFY_TAGS_HEADER_NAME = "Tags";
const NTFY_CONTENT_TYPE_HEADER_NAME = "Content-Type";
const NTFY_PUBLISH_FAILED_MESSAGE_PREFIX = "ntfy publish failed";

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
    if (value.enabled && value.topic === null) {
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
  priority: NtfyPriority;
}

export interface NtfyPublishResult {
  messageId: string | null;
}

export interface NtfyThreadCompletedPayload {
  threadId: string;
  preview: string;
  projectName: string;
  threadName: string;
  agentText: string;
}

type NtfyPriority = z.infer<typeof NtfyPrioritySchema>;

function normalizeOptionalString(value: string | undefined): string | null {
  if (value === undefined || value.length === 0) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeEnabledValue(value: string | undefined): boolean {
  const normalized = (value ?? DEFAULT_NTFY_ENABLED).trim().toLowerCase();
  const parsed = NtfyEnabledSchema.parse(normalized);
  return parsed === "1" || parsed === "true";
}

function normalizePriorityValue(value: string | undefined): NtfyPriority {
  return NtfyPrioritySchema.parse((value ?? DEFAULT_NTFY_PRIORITY).trim());
}

function normalizeBaseUrl(value: string | undefined): string {
  const normalized = normalizeOptionalString(value) ?? DEFAULT_NTFY_BASE_URL;
  return z.string().url().parse(normalized);
}

function buildNotificationTitle(payload: NtfyThreadCompletedPayload): string {
  const projectName = payload.projectName.trim();
  const threadName = payload.threadName.trim();
  const normalizedProjectName =
    projectName.length > 0 ? projectName : DEFAULT_NOTIFICATION_PROJECT_TITLE;
  const normalizedThreadName =
    threadName.length > 0 ? threadName : DEFAULT_NOTIFICATION_THREAD_TITLE;
  return `${normalizedProjectName}${NOTIFICATION_TITLE_SEPARATOR}${normalizedThreadName}`;
}

function buildNotificationBody(payload: NtfyThreadCompletedPayload): string {
  const agentText = payload.agentText.trim();
  const body = agentText.length > 0 ? agentText : DEFAULT_NOTIFICATION_BODY;
  if (body.length <= NOTIFICATION_BODY_MAXIMUM_CHARACTERS) {
    return body;
  }
  return `${body.slice(0, NOTIFICATION_BODY_PREVIEW_CHARACTERS)}${NOTIFICATION_BODY_TRUNCATED_SUFFIX}`;
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

function parseThreadCompletedPayload(
  payload: NtfyThreadCompletedPayload
): NtfyThreadCompletedPayload {
  return NtfyThreadCompletedPayloadSchema.parse(payload);
}

function buildPublishHeaders(config: NtfyConfig, payload: NtfyThreadCompletedPayload): Headers {
  const headers = new Headers();
  headers.set(NTFY_TITLE_HEADER_NAME, buildNotificationTitle(payload));
  headers.set(NTFY_PRIORITY_HEADER_NAME, config.priority);
  headers.set(NTFY_TAGS_HEADER_NAME, NTFY_TAGS_HEADER_VALUE);
  headers.set(NTFY_CONTENT_TYPE_HEADER_NAME, NTFY_CONTENT_TYPE_HEADER_VALUE);
  if (config.bearerToken !== null) {
    headers.set(
      NTFY_AUTHORIZATION_HEADER_NAME,
      `${NTFY_AUTHORIZATION_BEARER_PREFIX}${config.bearerToken}`
    );
  }
  return headers;
}

function buildPublishFailedErrorMessage(statusCode: number, responseText: string): string {
  if (responseText.length > 0) {
    return `${NTFY_PUBLISH_FAILED_MESSAGE_PREFIX} (${String(statusCode)}): ${responseText}`;
  }
  return `${NTFY_PUBLISH_FAILED_MESSAGE_PREFIX} (${String(statusCode)})`;
}

/**
 * Owns ntfy completion-notification publish contracts: strict config parsing, payload validation,
 * and outbound request shaping.
 */
export class NtfyNotifier {
  private readonly config: NtfyConfig;

  public constructor(config: NtfyConfig) {
    this.config = ParsedNtfyConfigSchema.parse(config);
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
    if (!this.config.enabled || this.config.topic === null) {
      return {
        messageId: null
      };
    }

    const parsedPayload = parseThreadCompletedPayload(payload);
    const response = await fetch(buildPublishUrl(this.config.baseUrl, this.config.topic), {
      method: NTFY_PUBLISH_HTTP_METHOD,
      headers: buildPublishHeaders(this.config, parsedPayload),
      body: buildNotificationBody(parsedPayload)
    });

    if (!response.ok) {
      const responseText = (await response.text()).trim();
      throw new Error(buildPublishFailedErrorMessage(response.status, responseText));
    }

    const messageId = (await response.text()).trim();
    return {
      messageId: messageId.length > 0 ? messageId : null
    };
  }
}

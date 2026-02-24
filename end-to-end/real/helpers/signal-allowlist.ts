import { z } from "zod";

export const SignalTypeSchema = z.enum([
  "console-warning",
  "console-error",
  "page-error",
  "api-failure",
  "banner-event",
  "debug-error",
  "loading-timeout"
]);

const SignalMatcherSchema = z
  .object({
    operationIncludes: z.string().min(1).optional(),
    messageIncludes: z.string().min(1).optional(),
    urlIncludes: z.string().min(1).optional(),
    textIncludes: z.string().min(1).optional(),
    surfaceEquals: z.string().min(1).optional(),
    statusEquals: z.number().int().min(100).max(599).optional()
  })
  .strict()
  .refine(
    (matcher) =>
      Boolean(
        matcher.operationIncludes ??
          matcher.messageIncludes ??
          matcher.urlIncludes ??
          matcher.textIncludes ??
          matcher.surfaceEquals ??
          matcher.statusEquals
      ),
    {
      message: "Signal allowlist matcher must include at least one condition"
    }
  );

export const SignalAllowlistEntrySchema = z
  .object({
    id: z.string().min(1),
    signalType: SignalTypeSchema,
    matcher: SignalMatcherSchema,
    reason: z.string().min(1),
    owner: z.string().min(1),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    trackingIssue: z.string().min(1)
  })
  .strict();

const SignalAllowlistSchema = z.array(SignalAllowlistEntrySchema);

export type SignalType = z.infer<typeof SignalTypeSchema>;
export type SignalAllowlistEntry = z.infer<typeof SignalAllowlistEntrySchema>;

export interface SignalMatchInput {
  signalType: SignalType;
  operation: string;
  message: string;
  url: string;
  text: string;
  surface: string;
  status: number | null;
}

const RAW_SIGNAL_ALLOWLIST: z.input<typeof SignalAllowlistSchema> = [];

function includesIfPresent(haystack: string, needle: string | undefined): boolean {
  if (!needle) {
    return true;
  }
  return haystack.includes(needle);
}

function parseAllowlist(referenceAt: Date): SignalAllowlistEntry[] {
  const parsed = SignalAllowlistSchema.parse(RAW_SIGNAL_ALLOWLIST);
  for (const entry of parsed) {
    const expiry = new Date(entry.expiresAt);
    if (Number.isNaN(expiry.getTime())) {
      throw new Error(`Invalid allowlist expiry date for ${entry.id}: ${entry.expiresAt}`);
    }
    if (expiry < referenceAt) {
      throw new Error(
        `Allowlist entry ${entry.id} expired at ${entry.expiresAt}. Remove or renew with justification.`
      );
    }
  }
  return parsed;
}

function matchesEntry(input: SignalMatchInput, entry: SignalAllowlistEntry): boolean {
  if (input.signalType !== entry.signalType) {
    return false;
  }

  const matcher = entry.matcher;

  if (!includesIfPresent(input.operation, matcher.operationIncludes)) {
    return false;
  }
  if (!includesIfPresent(input.message, matcher.messageIncludes)) {
    return false;
  }
  if (!includesIfPresent(input.url, matcher.urlIncludes)) {
    return false;
  }
  if (!includesIfPresent(input.text, matcher.textIncludes)) {
    return false;
  }
  if (matcher.surfaceEquals && input.surface !== matcher.surfaceEquals) {
    return false;
  }
  if (typeof matcher.statusEquals === "number" && input.status !== matcher.statusEquals) {
    return false;
  }

  return true;
}

export function findMatchingSignalAllowlistEntry(
  input: SignalMatchInput,
  referenceAt = new Date()
): SignalAllowlistEntry | null {
  const entries = parseAllowlist(referenceAt);
  for (const entry of entries) {
    if (matchesEntry(input, entry)) {
      return entry;
    }
  }
  return null;
}

export function listSignalAllowlist(referenceAt = new Date()): SignalAllowlistEntry[] {
  return parseAllowlist(referenceAt);
}

import { z } from "zod";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey
} from "../ThreadListAggregationCache.js";

const ThreadSortKeyParamSchema = z.enum(["created_at", "updated_at"]);
const ThreadListCursorSchema = z
  .object({
    version: z.literal(1),
    offset: z.number().int().nonnegative()
  })
  .strict();
const ThreadListLimitMaximum = 200;
const ThreadListMaxPagesMaximum = 40;
const ThreadListLimitDefault = 80;
const ThreadListMaxPagesDefault = 20;
const ThreadListCursorIssuePath = "cursor";
const ThreadListCursorEncodingIssueMessage = "Cursor must be URL-safe base64 encoded JSON";
const RawThreadListQuerySchema = z
  .object({
    limit: z.string().nullable(),
    archived: z.string().nullable(),
    all: z.string().nullable(),
    maxPages: z.string().nullable(),
    cursor: z.string().nullable(),
    sortKey: z.string().nullable(),
    cwd: z.string().nullable()
  })
  .strict();
const ThreadListLimitQueryValueSchema = z.coerce.number().int().positive().max(ThreadListLimitMaximum);
const ThreadListMaxPagesQueryValueSchema = z
  .coerce
  .number()
  .int()
  .positive()
  .max(ThreadListMaxPagesMaximum);
const BooleanQueryValueSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export interface ThreadCollectionListQueryIssue {
  path: string;
  message: string;
}

export interface ThreadCollectionListQuery {
  limit: number;
  archived: boolean;
  all: boolean;
  maxPages: number;
  cursor: string | null;
  sortKey: ThreadListSortKey | null;
  cwd: string | null;
}

export type ParseThreadCollectionListQueryResult =
  | { ok: true; query: ThreadCollectionListQuery }
  | { ok: false; issues: ThreadCollectionListQueryIssue[] };

export type DecodeThreadCollectionListCursorResult =
  | { ok: true; offset: number }
  | { ok: false; issues: ThreadCollectionListQueryIssue[] };

/**
 * Owns strict query/cursor/sort contracts for the thread list route.
 * Route owners consume typed query state from this owner to keep parsing concerns isolated.
 */
export class ThreadCollectionListQueryOwner {
  public parse(url: URL): ParseThreadCollectionListQueryResult {
    const parsedRawThreadListQuery = RawThreadListQuerySchema.safeParse({
      limit: url.searchParams.get("limit"),
      archived: url.searchParams.get("archived"),
      all: url.searchParams.get("all"),
      maxPages: url.searchParams.get("maxPages"),
      cursor: url.searchParams.get("cursor"),
      sortKey: url.searchParams.get("sortKey"),
      cwd: url.searchParams.get("cwd")
    });
    if (!parsedRawThreadListQuery.success) {
      return {
        ok: false,
        issues: parsedRawThreadListQuery.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      };
    }

    return this.parseValidatedRawQuery(parsedRawThreadListQuery.data);
  }

  public decodeCursor(cursor: string | null): DecodeThreadCollectionListCursorResult {
    if (!cursor) {
      return {
        ok: true,
        offset: 0
      };
    }

    let decodedCursorPayload = "";
    try {
      decodedCursorPayload = Buffer.from(cursor, "base64url").toString("utf8");
      const parsedCursor = ThreadListCursorSchema.safeParse(JSON.parse(decodedCursorPayload));
      if (!parsedCursor.success) {
        return {
          ok: false,
          issues: parsedCursor.error.issues.map((issue) => ({
            path: this.buildCursorIssuePath(issue.path),
            message: issue.message
          }))
        };
      }
      return {
        ok: true,
        offset: parsedCursor.data.offset
      };
    } catch {
      return {
        ok: false,
        issues: [
          {
            path: ThreadListCursorIssuePath,
            message: ThreadListCursorEncodingIssueMessage
          }
        ]
      };
    }
  }

  public encodeCursor(offset: number): string {
    return Buffer.from(
      JSON.stringify({
        version: 1,
        offset
      }),
      "utf8"
    ).toString("base64url");
  }

  public compareThreadListItems(
    left: ThreadListItemWithAgentId,
    right: ThreadListItemWithAgentId,
    sortKey: ThreadListSortKey
  ): number {
    const leftSortValue = sortKey === "created_at" ? left.createdAt : left.updatedAt;
    const rightSortValue = sortKey === "created_at" ? right.createdAt : right.updatedAt;

    if (leftSortValue !== rightSortValue) {
      return rightSortValue - leftSortValue;
    }

    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }

    const previewCompare = left.preview.localeCompare(right.preview);
    if (previewCompare !== 0) {
      return previewCompare;
    }

    return left.id.localeCompare(right.id);
  }

  private parseValidatedRawQuery(rawQuery: z.infer<typeof RawThreadListQuerySchema>): ParseThreadCollectionListQueryResult {
    // Parse and validate each query field independently so callers receive precise
    // field-level issues instead of one collapsed parsing failure.
    const issues: ThreadCollectionListQueryIssue[] = [];

    const parseBoundedInteger = (
      value: string | null,
      defaultValue: number,
      path: string,
      schema: typeof ThreadListLimitQueryValueSchema | typeof ThreadListMaxPagesQueryValueSchema
    ): number => {
      if (value === null || value.length === 0) {
        return defaultValue;
      }
      const parsedValue = schema.safeParse(value);
      if (parsedValue.success) {
        return parsedValue.data;
      }
      for (const issue of parsedValue.error.issues) {
        issues.push({
          path,
          message: issue.message
        });
      }
      return defaultValue;
    };

    const parseBoolean = (value: string | null, defaultValue: boolean, path: string): boolean => {
      if (value === null || value.length === 0) {
        return defaultValue;
      }
      const parsedValue = BooleanQueryValueSchema.safeParse(value);
      if (parsedValue.success) {
        return parsedValue.data;
      }
      for (const issue of parsedValue.error.issues) {
        issues.push({
          path,
          message: issue.message
        });
      }
      return defaultValue;
    };

    const parseSortKey = (value: string | null): ThreadListSortKey | null => {
      if (value === null || value.length === 0) {
        return null;
      }
      const parsedValue = ThreadSortKeyParamSchema.safeParse(value);
      if (parsedValue.success) {
        return parsedValue.data;
      }
      for (const issue of parsedValue.error.issues) {
        issues.push({
          path: "sortKey",
          message: issue.message
        });
      }
      return null;
    };

    const parsedQuery: ThreadCollectionListQuery = {
      limit: parseBoundedInteger(rawQuery.limit, ThreadListLimitDefault, "limit", ThreadListLimitQueryValueSchema),
      archived: parseBoolean(rawQuery.archived, false, "archived"),
      all: parseBoolean(rawQuery.all, false, "all"),
      maxPages: parseBoundedInteger(
        rawQuery.maxPages,
        ThreadListMaxPagesDefault,
        "maxPages",
        ThreadListMaxPagesQueryValueSchema
      ),
      cursor: rawQuery.cursor,
      sortKey: parseSortKey(rawQuery.sortKey),
      cwd: rawQuery.cwd
    };

    if (issues.length > 0) {
      return {
        ok: false,
        issues
      };
    }

    return {
      ok: true,
      query: parsedQuery
    };
  }

  private buildCursorIssuePath(path: ReadonlyArray<string | number>): string {
    if (path.length === 0) {
      return ThreadListCursorIssuePath;
    }

    return `${ThreadListCursorIssuePath}.${path.map((segment) => String(segment)).join(".")}`;
  }
}

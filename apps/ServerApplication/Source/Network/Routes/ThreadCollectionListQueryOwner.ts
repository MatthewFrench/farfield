import { z } from "zod";
import type {
  ThreadListItemWithAgentId,
  ThreadListSortKey
} from "../ThreadListAggregationCache.js";

interface RawThreadCollectionListQuery {
  limit: string | null;
  archived: string | null;
  all: string | null;
  maxPages: string | null;
  cursor: string | null;
  sortKey: string | null;
  cwd: string | null;
}

const ThreadSortKeyParamSchema = z.enum(["created_at", "updated_at"]);
const ThreadListQueryParameterByName = {
  limit: "limit",
  archived: "archived",
  all: "all",
  maxPages: "maxPages",
  cursor: "cursor",
  sortKey: "sortKey",
  cwd: "cwd"
} as const;
const ThreadListCursorVersion = 1;
const ThreadListCursorEncoding = "base64url";
const ThreadListCursorPayloadEncoding = "utf8";
const ThreadListCursorSchema = z
  .object({
    version: z.literal(ThreadListCursorVersion),
    offset: z.number().int().nonnegative()
  })
  .strict();
const ThreadListLimitMaximum = 200;
const ThreadListMaxPagesMaximum = 40;
const ThreadListLimitDefault = 80;
const ThreadListMaxPagesDefault = 20;
const ThreadListArchivedDefault = false;
const ThreadListAllDefault = false;
const ThreadListCursorIssuePath = "cursor";
const ThreadListCursorEncodingIssueMessage = "Cursor must be URL-safe base64 encoded JSON";
const RawThreadListQuerySchema = z
  .object({
    [ThreadListQueryParameterByName.limit]: z.string().nullable(),
    [ThreadListQueryParameterByName.archived]: z.string().nullable(),
    [ThreadListQueryParameterByName.all]: z.string().nullable(),
    [ThreadListQueryParameterByName.maxPages]: z.string().nullable(),
    [ThreadListQueryParameterByName.cursor]: z.string().nullable(),
    [ThreadListQueryParameterByName.sortKey]: z.string().nullable(),
    [ThreadListQueryParameterByName.cwd]: z.string().nullable()
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
    const parsedRawThreadListQuery = RawThreadListQuerySchema.safeParse(
      this.readRawThreadListQuery(url)
    );
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
    if (cursor === null || cursor.length === 0) {
      return {
        ok: true,
        offset: 0
      };
    }

    let decodedCursorPayload = "";
    try {
      decodedCursorPayload = Buffer.from(cursor, ThreadListCursorEncoding).toString(
        ThreadListCursorPayloadEncoding
      );
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
        version: ThreadListCursorVersion,
        offset
      }),
      ThreadListCursorPayloadEncoding
    ).toString(ThreadListCursorEncoding);
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

  private readRawThreadListQuery(url: URL): RawThreadCollectionListQuery {
    return {
      limit: url.searchParams.get(ThreadListQueryParameterByName.limit),
      archived: url.searchParams.get(ThreadListQueryParameterByName.archived),
      all: url.searchParams.get(ThreadListQueryParameterByName.all),
      maxPages: url.searchParams.get(ThreadListQueryParameterByName.maxPages),
      cursor: url.searchParams.get(ThreadListQueryParameterByName.cursor),
      sortKey: url.searchParams.get(ThreadListQueryParameterByName.sortKey),
      cwd: url.searchParams.get(ThreadListQueryParameterByName.cwd)
    };
  }

  private parseValidatedRawQuery(
    rawQuery: RawThreadCollectionListQuery
  ): ParseThreadCollectionListQueryResult {
    // Parse each field independently to preserve specific issue paths/messages
    // instead of collapsing query failures into one generic parse error.
    const issues: ThreadCollectionListQueryIssue[] = [];

    const parsedQuery: ThreadCollectionListQuery = {
      limit: this.parseLimit(rawQuery.limit, issues),
      archived: this.parseBoolean(
        rawQuery.archived,
        ThreadListArchivedDefault,
        ThreadListQueryParameterByName.archived,
        issues
      ),
      all: this.parseBoolean(
        rawQuery.all,
        ThreadListAllDefault,
        ThreadListQueryParameterByName.all,
        issues
      ),
      maxPages: this.parseMaxPages(rawQuery.maxPages, issues),
      cursor: rawQuery.cursor,
      sortKey: this.parseSortKey(rawQuery.sortKey, issues),
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

  private parseLimit(
    value: string | null,
    issues: ThreadCollectionListQueryIssue[]
  ): number {
    if (value === null || value.length === 0) {
      return ThreadListLimitDefault;
    }

    const parsedValue = ThreadListLimitQueryValueSchema.safeParse(value);
    if (parsedValue.success) {
      return parsedValue.data;
    }
    this.appendIssuesForPath(
      ThreadListQueryParameterByName.limit,
      parsedValue.error.issues,
      issues
    );
    return ThreadListLimitDefault;
  }

  private parseMaxPages(
    value: string | null,
    issues: ThreadCollectionListQueryIssue[]
  ): number {
    if (value === null || value.length === 0) {
      return ThreadListMaxPagesDefault;
    }

    const parsedValue = ThreadListMaxPagesQueryValueSchema.safeParse(value);
    if (parsedValue.success) {
      return parsedValue.data;
    }
    this.appendIssuesForPath(
      ThreadListQueryParameterByName.maxPages,
      parsedValue.error.issues,
      issues
    );
    return ThreadListMaxPagesDefault;
  }

  private parseBoolean(
    value: string | null,
    defaultValue: boolean,
    path: string,
    issues: ThreadCollectionListQueryIssue[]
  ): boolean {
    if (value === null || value.length === 0) {
      return defaultValue;
    }

    const parsedValue = BooleanQueryValueSchema.safeParse(value);
    if (parsedValue.success) {
      return parsedValue.data;
    }
    this.appendIssuesForPath(path, parsedValue.error.issues, issues);
    return defaultValue;
  }

  private parseSortKey(
    value: string | null,
    issues: ThreadCollectionListQueryIssue[]
  ): ThreadListSortKey | null {
    if (value === null || value.length === 0) {
      return null;
    }

    const parsedValue = ThreadSortKeyParamSchema.safeParse(value);
    if (parsedValue.success) {
      return parsedValue.data;
    }
    this.appendIssuesForPath(
      ThreadListQueryParameterByName.sortKey,
      parsedValue.error.issues,
      issues
    );
    return null;
  }

  private appendIssuesForPath(
    path: string,
    zodIssues: ReadonlyArray<z.ZodIssue>,
    issues: ThreadCollectionListQueryIssue[]
  ): void {
    for (const issue of zodIssues) {
      issues.push({
        path,
        message: issue.message
      });
    }
  }

  private buildCursorIssuePath(path: ReadonlyArray<string | number>): string {
    if (path.length === 0) {
      return ThreadListCursorIssuePath;
    }

    return `${ThreadListCursorIssuePath}.${path.map((segment) => String(segment)).join(".")}`;
  }
}

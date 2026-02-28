import { describe, expect, it } from "vitest";
import { ThreadCollectionListQueryOwner } from "../Source/Network/Routes/ThreadCollectionListQueryOwner.js";

describe("ThreadCollectionListQueryOwner", () => {
  it("returns default query values when query parameters are omitted", () => {
    const owner = new ThreadCollectionListQueryOwner();

    const parsedQuery = owner.parse(new URL("http://localhost/api/threads"));

    expect(parsedQuery).toEqual({
      ok: true,
      query: {
        limit: 80,
        archived: false,
        all: false,
        maxPages: 20,
        cursor: null,
        sortKey: null,
        cwd: null,
        sinceUpdatedAt: null,
      },
    });
  });

  it("treats empty-string numeric and boolean values as omitted", () => {
    const owner = new ThreadCollectionListQueryOwner();

    const parsedQuery = owner.parse(
      new URL("http://localhost/api/threads?limit=&archived=&all=&maxPages=&cursor=&sortKey=&cwd="),
    );

    expect(parsedQuery).toEqual({
      ok: true,
      query: {
        limit: 80,
        archived: false,
        all: false,
        maxPages: 20,
        cursor: "",
        sortKey: null,
        cwd: "",
        sinceUpdatedAt: null,
      },
    });
  });

  it("parses sinceUpdatedAt as a non-negative integer", () => {
    const owner = new ThreadCollectionListQueryOwner();

    const parsedQuery = owner.parse(new URL("http://localhost/api/threads?sinceUpdatedAt=1700"));

    expect(parsedQuery).toEqual({
      ok: true,
      query: {
        limit: 80,
        archived: false,
        all: false,
        maxPages: 20,
        cursor: null,
        sortKey: null,
        cwd: null,
        sinceUpdatedAt: 1700,
      },
    });
  });

  it("returns per-field issues when query values are invalid", () => {
    const owner = new ThreadCollectionListQueryOwner();

    const parsedQuery = owner.parse(
      new URL("http://localhost/api/threads?limit=0&archived=1&all=yes&maxPages=0&sortKey=invalid"),
    );

    expect(parsedQuery.ok).toBe(false);
    if (parsedQuery.ok) {
      throw new Error("Expected invalid query parse result");
    }

    expect(parsedQuery.issues).toHaveLength(5);
    expect(parsedQuery.issues).toMatchObject([
      {
        path: "limit",
      },
      {
        path: "archived",
      },
      {
        path: "all",
      },
      {
        path: "maxPages",
      },
      {
        path: "sortKey",
      },
    ]);
  });

  it("decodes an encoded cursor offset", () => {
    const owner = new ThreadCollectionListQueryOwner();

    const encodedCursor = owner.encodeCursor(3);
    const decodedCursor = owner.decodeCursor(encodedCursor);

    expect(decodedCursor).toEqual({
      ok: true,
      offset: 3,
    });
  });

  it("prefixes cursor schema issue paths with cursor", () => {
    const owner = new ThreadCollectionListQueryOwner();
    const encodedCursor = Buffer.from(
      JSON.stringify({
        version: 1,
        offset: -1,
      }),
      "utf8",
    ).toString("base64url");

    const decodedCursor = owner.decodeCursor(encodedCursor);

    expect(decodedCursor.ok).toBe(false);
    if (decodedCursor.ok) {
      throw new Error("Expected invalid cursor decode result");
    }
    expect(decodedCursor.issues).toMatchObject([
      {
        path: "cursor.offset",
      },
    ]);
  });
});

import { z } from "zod";

const OPEN_CODE_THREAD_CURSOR_VERSION = 1;
const UTF8_ENCODING = "utf8";
const BASE64_URL_ENCODING = "base64url";

const OpenCodeThreadCursorSchema = z
  .object({
    version: z.literal(OPEN_CODE_THREAD_CURSOR_VERSION),
    offset: z.number().int().nonnegative()
  })
  .strict();

export function encodeOpenCodeThreadCursor(offset: number): string {
  return Buffer.from(
    JSON.stringify({
      version: OPEN_CODE_THREAD_CURSOR_VERSION,
      offset
    }),
    UTF8_ENCODING
  ).toString(BASE64_URL_ENCODING);
}

export function decodeOpenCodeThreadCursor(cursor: string | null): number {
  if (cursor === null || cursor.length === 0) {
    return 0;
  }

  const decodedPayload = Buffer.from(cursor, BASE64_URL_ENCODING).toString(UTF8_ENCODING);
  const parsedJson = JSON.parse(decodedPayload);
  const parsedCursor = OpenCodeThreadCursorSchema.parse(parsedJson);
  return parsedCursor.offset;
}

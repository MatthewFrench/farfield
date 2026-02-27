import { describe, expect, it } from "vitest";
import {
  type OpenCodeStructuredDataValue,
  parseOpenCodeSessionList,
  parseOpenCodeSessionMessages,
} from "../Source/Schemas.js";

const OpenCodeIgnoredPartTypes = [
  "step-start",
  "step-finish",
  "snapshot",
  "patch",
  "agent",
  "retry",
  "compaction",
  "subtask",
] as const;

function createMessageEntryPayload(
  parts: OpenCodeStructuredDataValue[],
): OpenCodeStructuredDataValue {
  return [
    {
      info: {
        id: "message-1",
        role: "assistant",
        parentID: "message-parent-1",
        time: {
          created: 1_700_000_100,
        },
      },
      parts,
    },
  ];
}

describe("OpenCode schema parsers", () => {
  it("parses session lists with strict required fields", () => {
    const payload: OpenCodeStructuredDataValue = [
      {
        id: "session-1",
        title: "Session One",
        directory: "/tmp/project",
        time: {
          created: 1_700_000_000,
          updated: 1_700_000_900,
        },
      },
    ];

    const sessions = parseOpenCodeSessionList(payload);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "session-1",
      title: "Session One",
      directory: "/tmp/project",
      time: {
        created: 1_700_000_000,
        updated: 1_700_000_900,
      },
    });
  });

  it("parses session messages across supported part and tool state variants", () => {
    const ignoredParts = OpenCodeIgnoredPartTypes.map((partType, index) => ({
      id: `ignored-${index}`,
      type: partType,
    }));
    const payload = createMessageEntryPayload([
      {
        id: "text-1",
        type: "text",
        text: "hello",
      },
      {
        id: "reasoning-1",
        type: "reasoning",
        text: "thinking",
      },
      {
        id: "tool-running-1",
        type: "tool",
        tool: "bash",
        state: {
          status: "running",
          input: {
            command: "ls -la",
          },
          time: {
            start: 1_700_000_110,
          },
        },
      },
      {
        id: "tool-completed-1",
        type: "tool",
        tool: "write",
        state: {
          status: "completed",
          input: {
            file_path: "/tmp/file.ts",
          },
          output: "ok",
          metadata: {
            lines: 42,
          },
          time: {
            start: 1_700_000_111,
            end: 1_700_000_112,
          },
        },
      },
      {
        id: "tool-error-1",
        type: "tool",
        tool: "bash",
        state: {
          status: "error",
          input: {
            command: "cat /missing",
          },
          error: "No such file",
          time: {
            start: 1_700_000_113,
            end: 1_700_000_114,
          },
        },
      },
      {
        id: "file-1",
        type: "file",
        url: "/tmp/output.log",
      },
      ...ignoredParts,
    ]);

    const messages = parseOpenCodeSessionMessages(payload);
    const parts = messages[0].parts;
    const toolStatuses = parts.flatMap((part) => (part.type === "tool" ? [part.state.status] : []));
    const ignoredPartTypeSet = new Set<string>(OpenCodeIgnoredPartTypes);
    const ignoredTypes = parts.flatMap((part) =>
      ignoredPartTypeSet.has(part.type) ? [part.type] : [],
    );

    expect(messages).toHaveLength(1);
    expect(toolStatuses).toEqual(["running", "completed", "error"]);
    expect(ignoredTypes.sort()).toEqual([...OpenCodeIgnoredPartTypes].sort());
  });

  it("rejects session list entries that omit required time fields", () => {
    const payload: OpenCodeStructuredDataValue = [
      {
        id: "session-1",
        title: "Session One",
        directory: "/tmp/project",
        time: {
          created: 1_700_000_000,
        },
      },
    ];

    expect(() => parseOpenCodeSessionList(payload)).toThrow();
  });

  it("rejects unsupported ignored part type values", () => {
    const payload = createMessageEntryPayload([
      {
        id: "unsupported-ignored-part",
        type: "unknown-ignored-part",
      },
    ]);

    expect(() => parseOpenCodeSessionMessages(payload)).toThrow();
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  JsonValueSchema,
  parseThreadStreamStateChangedBroadcast,
  ThreadConversationRequestMethodValues,
} from "../Source/Index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compatibilityFixtureFilePath = path.join(
  __dirname,
  "fixtures",
  "compatibility",
  "ThreadStreamStateChangedBroadcast.command-approval.json",
);

const CompatibilityFixtureEnvelopeSchema = z
  .object({
    description: z.string().trim().min(1),
    events: z.array(JsonValueSchema),
  })
  .strict();
const RequestPatchValueMethodSchema = z
  .object({
    method: z.enum(ThreadConversationRequestMethodValues),
  })
  .passthrough();

const EXPECTED_REQUEST_METHODS = ThreadConversationRequestMethodValues;

function readFixtureEvents(): z.infer<typeof CompatibilityFixtureEnvelopeSchema>["events"] {
  const fixtureText = fs.readFileSync(compatibilityFixtureFilePath, "utf8");
  const fixtureValue = JSON.parse(fixtureText);
  const parsedFixture = CompatibilityFixtureEnvelopeSchema.parse(fixtureValue);
  return parsedFixture.events;
}

describe("codex-protocol thread stream compatibility replay", () => {
  it("replays known-good app-server payloads without schema regressions", () => {
    const fixtureEvents = readFixtureEvents();
    expect(fixtureEvents.length).toBeGreaterThan(0);

    const parsedEvents = fixtureEvents.map((event) =>
      parseThreadStreamStateChangedBroadcast(event),
    );

    const requestMethodsFromSnapshots = parsedEvents.flatMap((event) => {
      const change = event.params.change;
      if (change.type !== "snapshot") {
        return [];
      }
      return change.conversationState.requests.map((request) => request.method);
    });

    const requestMethodsFromPatches = parsedEvents.flatMap((event) => {
      const change = event.params.change;
      if (change.type !== "patches") {
        return [];
      }

      const patchMethods: string[] = [];
      for (const patch of change.patches) {
        const targetsRequests = patch.path[0] === "requests";
        if (!targetsRequests) {
          continue;
        }
        if (patch.op !== "add" && patch.op !== "replace") {
          continue;
        }

        const parsedRequest = RequestPatchValueMethodSchema.safeParse(patch.value);
        if (!parsedRequest.success) {
          continue;
        }

        patchMethods.push(parsedRequest.data.method);
      }

      return patchMethods;
    });

    for (const expectedMethod of EXPECTED_REQUEST_METHODS) {
      expect(requestMethodsFromSnapshots).toContain(expectedMethod);
      expect(requestMethodsFromPatches).toContain(expectedMethod);
    }
  });
});

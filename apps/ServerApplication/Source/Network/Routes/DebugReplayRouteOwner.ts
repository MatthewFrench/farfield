import { type SendRequestOptions } from "@farfield/api";
import { parseBody, ReplayBodySchema } from "../../HttpSchemas.js";
import {
  buildSendRequestOptions,
  type DebugRouteDependencies,
  type ParsedReplayFrame
} from "./DebugRouteContracts.js";
import { parseReplayFrame } from "./DebugReplayFrameParser.js";

export class DebugReplayRouteOwner {
  private readonly dependencies: DebugRouteDependencies;

  public constructor(dependencies: DebugRouteDependencies) {
    this.dependencies = dependencies;
  }

  public async handle(): Promise<boolean> {
    const {
      req,
      pathname,
      codexAdapter,
      jsonResponse,
      res,
      readJsonBody,
      activityHistoryService,
      toErrorMessage,
      pushSystem
    } = this.dependencies;

    if (!(req.method === "POST" && pathname === "/api/debug/replay")) {
      return false;
    }

    if (!codexAdapter) {
      jsonResponse(res, 503, {
        ok: false,
        error: "Codex adapter is not enabled"
      });
      return true;
    }

    if (!codexAdapter.isIpcReady()) {
      jsonResponse(res, 503, {
        ok: false,
        error: codexAdapter.getRuntimeState().lastError ?? "Desktop IPC is not connected"
      });
      return true;
    }

    const body = parseBody(ReplayBodySchema, await readJsonBody(req));
    const entry = activityHistoryService.readHistoryEntries().find((item) => item.id === body.entryId);
    if (!entry) {
      jsonResponse(res, 404, { ok: false, error: "History entry not found" });
      return true;
    }

    const replayPayload = activityHistoryService.readHistoryById().get(entry.id);
    if (replayPayload === undefined) {
      jsonResponse(res, 409, {
        ok: false,
        error: "History payload not found"
      });
      return true;
    }

    let frame: ParsedReplayFrame;
    try {
      frame = parseReplayFrame(replayPayload);
    } catch (error) {
      jsonResponse(res, 409, {
        ok: false,
        error: toErrorMessage(error)
      });
      return true;
    }

    const options: SendRequestOptions = buildSendRequestOptions(frame);

    if (frame.type === "request") {
      const replayPromise = codexAdapter.replayRequest(frame.method, frame.params, options);

      if (body.waitForResponse) {
        const response = await replayPromise;
        jsonResponse(res, 200, {
          ok: true,
          replayed: true,
          response
        });
        return true;
      }

      void replayPromise.catch((error) => {
        pushSystem("Replay request failed", {
          error: toErrorMessage(error),
          entryId: entry.id
        });
      });

      jsonResponse(res, 200, {
        ok: true,
        replayed: true,
        queued: true
      });
      return true;
    }

    codexAdapter.replayBroadcast(frame.method, frame.params, options);
    jsonResponse(res, 200, { ok: true, replayed: true });
    return true;
  }
}

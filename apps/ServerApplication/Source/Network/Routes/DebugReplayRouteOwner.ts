import { type SendRequestOptions } from "@farfield/api";
import { parseReplayBody } from "../RequestSchemas/HttpSchemas.js";
import {
  buildSendRequestOptions,
  DebugReplayFrameParseError,
  DebugReplayFrameTypeByName,
  DebugRouteMethodByName,
  DebugRoutePathnameByName,
  type DebugRouteDependencies,
  type ParsedReplayFrame
} from "./DebugRouteContracts.js";
import { parseReplayFrame } from "./DebugReplayFrameParser.js";

const DebugReplayRouteStatusCodeByName = {
  successOk: 200,
  clientErrorNotFound: 404,
  clientErrorConflict: 409,
  serverErrorServiceUnavailable: 503
} as const;

const DebugReplayRouteErrorMessageByName = {
  codexAdapterNotEnabled: "Codex adapter is not enabled",
  desktopIpcNotConnected: "Desktop IPC is not connected",
  historyEntryNotFound: "History entry not found",
  historyPayloadNotFound: "History payload not found"
} as const;

const ReplayRequestFailedSystemMessage = "Replay request failed";

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

    if (!(req.method === DebugRouteMethodByName.post && pathname === DebugRoutePathnameByName.replay)) {
      return false;
    }

    if (!codexAdapter) {
      jsonResponse(res, DebugReplayRouteStatusCodeByName.serverErrorServiceUnavailable, {
        ok: false,
        error: DebugReplayRouteErrorMessageByName.codexAdapterNotEnabled
      });
      return true;
    }

    if (!codexAdapter.isIpcReady()) {
      jsonResponse(res, DebugReplayRouteStatusCodeByName.serverErrorServiceUnavailable, {
        ok: false,
        error: codexAdapter.getRuntimeState().lastError
          ?? DebugReplayRouteErrorMessageByName.desktopIpcNotConnected
      });
      return true;
    }

    const body = parseReplayBody(await readJsonBody(req));
    const entry = activityHistoryService.readHistoryEntries().find((item) => item.id === body.entryId);
    if (!entry) {
      jsonResponse(res, DebugReplayRouteStatusCodeByName.clientErrorNotFound, {
        ok: false,
        error: DebugReplayRouteErrorMessageByName.historyEntryNotFound
      });
      return true;
    }

    const replayPayload = activityHistoryService.readHistoryById().get(entry.id);
    if (replayPayload === undefined) {
      jsonResponse(res, DebugReplayRouteStatusCodeByName.clientErrorConflict, {
        ok: false,
        error: DebugReplayRouteErrorMessageByName.historyPayloadNotFound
      });
      return true;
    }

    let frame: ParsedReplayFrame;
    try {
      frame = parseReplayFrame(replayPayload);
    } catch (error) {
      // Replay-frame parse failures are a deterministic contract error, not a generic transport failure.
      if (error instanceof DebugReplayFrameParseError) {
        jsonResponse(res, DebugReplayRouteStatusCodeByName.clientErrorConflict, {
          ok: false,
          error: error.message
        });
        return true;
      }

      throw error;
    }

    const options: SendRequestOptions = buildSendRequestOptions(frame);

    if (frame.type === DebugReplayFrameTypeByName.request) {
      const replayPromise = codexAdapter.replayRequest(frame.method, frame.params, options);

      if (body.waitForResponse) {
        const response = await replayPromise;
        jsonResponse(res, DebugReplayRouteStatusCodeByName.successOk, {
          ok: true,
          replayed: true,
          response
        });
        return true;
      }

      void replayPromise.catch((error) => {
        pushSystem(ReplayRequestFailedSystemMessage, {
          error: toErrorMessage(error),
          entryId: entry.id
        });
      });

      jsonResponse(res, DebugReplayRouteStatusCodeByName.successOk, {
        ok: true,
        replayed: true,
        queued: true
      });
      return true;
    }

    codexAdapter.replayBroadcast(frame.method, frame.params, options);
    jsonResponse(res, DebugReplayRouteStatusCodeByName.successOk, { ok: true, replayed: true });
    return true;
  }
}

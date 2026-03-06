import {
  AppServerCollaborationModeListItemSchema,
  type AppServerCollaborationModeListResponse,
  type AppServerListModelsResponse,
  AppServerModelSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { logger } from "../../Shared/Logging/Logger.js";
import {
  type CapabilityRouteDependencies,
  CapabilityRouteErrorMessagePrefixByName,
  CapabilityRouteLogEventByName,
  CapabilityRouteMethodByName,
  CapabilityRouteModelsLimitDefault,
  CapabilityRoutePathnameByName,
  CapabilityRouteQueryParameterByName,
  CapabilityRouteStatusCodeByName,
  CapabilityRouteTimeoutLabelByName,
  isCapabilityRouteRequest,
  toErrorMessage,
} from "./CapabilityRouteContracts.js";

type CapabilityModel = z.infer<typeof AppServerModelSchema>;
type CapabilityCollaborationMode = z.infer<typeof AppServerCollaborationModeListItemSchema>;

type CapabilityModelsResponseBody = AppServerListModelsResponse & {
  ok: true;
  data: CapabilityModel[];
  nextCursor: string | null;
};

type CapabilityCollaborationModesResponseBody = AppServerCollaborationModeListResponse & {
  ok: true;
  data: CapabilityCollaborationMode[];
};

function mapModelsResponse(result: AppServerListModelsResponse): CapabilityModelsResponseBody {
  return {
    ok: true,
    ...result,
    nextCursor: result.nextCursor ?? null,
  };
}

function mapCollaborationModesResponse(
  result: AppServerCollaborationModeListResponse,
): CapabilityCollaborationModesResponseBody {
  return {
    ok: true,
    ...result,
  };
}

async function handleModelsRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.models,
    )
  ) {
    return false;
  }

  const adapter = deps.registry.resolveFirstWithCapability("canListModels");
  if (!adapter || !adapter.listModels) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
      nextCursor: null,
    });
    return true;
  }

  const limit = deps.parseInteger(
    deps.url.searchParams.get(CapabilityRouteQueryParameterByName.limit),
    CapabilityRouteModelsLimitDefault,
  );
  try {
    const result = await deps.withTimeout(
      adapter.listModels(limit),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.modelsList,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, mapModelsResponse(result));
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.modelsListTimeout,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListModels}${message}`,
    });
  }
  return true;
}

async function handleCollaborationModesRoute(deps: CapabilityRouteDependencies): Promise<boolean> {
  if (
    !isCapabilityRouteRequest(
      deps.req.method,
      deps.pathname,
      CapabilityRouteMethodByName.get,
      CapabilityRoutePathnameByName.collaborationModes,
    )
  ) {
    return false;
  }

  const adapter = deps.registry.resolveFirstWithCapability("canListCollaborationModes");
  if (!adapter || !adapter.listCollaborationModes) {
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.success, {
      ok: true,
      data: [],
    });
    return true;
  }

  try {
    const result = await deps.withTimeout(
      adapter.listCollaborationModes(),
      deps.capabilityListTimeoutMs,
      CapabilityRouteTimeoutLabelByName.collaborationModesList,
    );
    deps.jsonResponse(
      deps.res,
      CapabilityRouteStatusCodeByName.success,
      mapCollaborationModesResponse(result),
    );
  } catch (error) {
    const message = toErrorMessage(error);
    logger.warn(
      {
        error: message,
      },
      CapabilityRouteLogEventByName.collaborationModesListTimeout,
    );
    deps.jsonResponse(deps.res, CapabilityRouteStatusCodeByName.serviceUnavailable, {
      ok: false,
      error: `${CapabilityRouteErrorMessagePrefixByName.failedToListCollaborationModes}${message}`,
    });
  }
  return true;
}

/**
 * Owns capability catalog routes that expose shared selection metadata for the web shell.
 */
export async function handleCapabilityCatalogRoutes(
  deps: CapabilityRouteDependencies,
): Promise<boolean> {
  if (await handleModelsRoute(deps)) {
    return true;
  }
  if (await handleCollaborationModesRoute(deps)) {
    return true;
  }
  return false;
}

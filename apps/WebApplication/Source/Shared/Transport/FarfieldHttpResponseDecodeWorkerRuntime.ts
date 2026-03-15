/// <reference lib="webworker" />

import { z } from "zod";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";
import {
  type FarfieldHttpResponseDecodeWorkerRequest,
  type FarfieldHttpResponseDecodeWorkerResponse,
  parseFarfieldHttpResponseDecodeWorkerRequest,
} from "./FarfieldHttpResponseDecodeWorkerContracts";

const ApiEnvelopeSchema = z
  .object({
    ok: z.boolean(),
  })
  .passthrough();

const WORKER_REQUEST_PARSE_FAILURE_REASON = "Invalid Farfield HTTP response decode worker request";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

function postResponse(response: FarfieldHttpResponseDecodeWorkerResponse): void {
  workerScope.postMessage(response);
}

function readDecodedResponse(
  request: FarfieldHttpResponseDecodeWorkerRequest,
): FarfieldHttpResponseDecodeWorkerResponse {
  let rawJsonData: StructuredDataValue;
  try {
    rawJsonData = JSON.parse(request.parseText);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      requestId: request.requestId,
      kind: "failure",
      reasonKind: "invalid-json",
      reason,
    };
  }

  const parsedStructuredData = StructuredDataValueSchema.safeParse(rawJsonData);
  if (!parsedStructuredData.success) {
    return {
      requestId: request.requestId,
      kind: "failure",
      reasonKind: "invalid-structured-data",
      reason: parsedStructuredData.error.message,
    };
  }

  const parsedEnvelope = ApiEnvelopeSchema.safeParse(parsedStructuredData.data);
  if (!parsedEnvelope.success) {
    return {
      requestId: request.requestId,
      kind: "failure",
      reasonKind: "invalid-envelope",
      reason: parsedEnvelope.error.message,
    };
  }

  return {
    requestId: request.requestId,
    kind: "success",
    data: parsedStructuredData.data,
    envelopeOk: parsedEnvelope.data.ok,
  };
}

workerScope.addEventListener("message", (event) => {
  let parsedRequest: FarfieldHttpResponseDecodeWorkerRequest;
  try {
    parsedRequest = parseFarfieldHttpResponseDecodeWorkerRequest(event.data);
  } catch {
    postResponse({
      requestId: 0,
      kind: "failure",
      reasonKind: "invalid-structured-data",
      reason: WORKER_REQUEST_PARSE_FAILURE_REASON,
    });
    return;
  }

  const decodedResponse = readDecodedResponse(parsedRequest);
  postResponse(decodedResponse);
});

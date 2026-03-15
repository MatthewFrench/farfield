/**
 * Owns debug-error envelope boundary parsing and wire-to-contract mapping.
 * Invariant: transport payloads are projected to app-owned contracts before leaving this module.
 */
import {
  FarfieldDebugErrorDetailEnvelopeSchema,
  FarfieldDebugErrorListEnvelopeSchema,
} from "@farfield/protocol";
import { z } from "zod";
import {
  type StructuredDataValue,
  StructuredDataValueSchema,
} from "@/Shared/Contracts/StructuredDataValue";

const DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY = "actionId";
const DEBUG_ERROR_DETAIL_ACTION_NAME_KEY = "actionName";

const DebugErrorActionIdentifierSchema = z.string().trim().min(1);
const DebugErrorActionNameSchema = z.string().trim().min(1);

const DebugErrorDetailsSchema = z
  .object({
    [DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY]: DebugErrorActionIdentifierSchema.optional(),
    [DEBUG_ERROR_DETAIL_ACTION_NAME_KEY]: DebugErrorActionNameSchema.optional(),
  })
  .catchall(StructuredDataValueSchema);

export type ApiDebugErrorDetails = z.infer<typeof DebugErrorDetailsSchema>;

const DebugErrorEventWireSchema = FarfieldDebugErrorListEnvelopeSchema.shape.data.element;
const DebugErrorDetailsWireSchema = DebugErrorEventWireSchema.shape.details;

const DebugErrorEventContractSchema = z
  .object({
    errorId: z.string().trim().min(1),
    sessionId: z.string().trim().min(1),
    origin: z.enum(["client", "server"]),
    source: z.string().trim().min(1),
    operation: z.string().trim().min(1),
    message: z.string().trim().min(1),
    severity: z.enum(["error", "warning"]),
    name: z.string().nullable(),
    stack: z.string().nullable(),
    requestId: z.string().nullable(),
    threadId: z.string().nullable(),
    url: z.string().nullable(),
    occurredAt: z.string().datetime(),
    recordedAt: z.string().datetime(),
    details: DebugErrorDetailsSchema,
  })
  .strict();

type DebugErrorEventContract = z.infer<typeof DebugErrorEventContractSchema>;
type DebugErrorEventWire = z.infer<typeof DebugErrorEventWireSchema>;
type DebugErrorDetailsWire = z.infer<typeof DebugErrorDetailsWireSchema>;

function mapDebugErrorDetailsWireToContract(value: DebugErrorDetailsWire): ApiDebugErrorDetails {
  const parsedDetails = z.record(StructuredDataValueSchema).parse(value);
  const actionIdentifierValue = parsedDetails[DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY];
  const actionNameValue = parsedDetails[DEBUG_ERROR_DETAIL_ACTION_NAME_KEY];
  const mappedDetailEntries = Object.entries(parsedDetails).filter(
    ([detailKey]) =>
      detailKey !== DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY &&
      detailKey !== DEBUG_ERROR_DETAIL_ACTION_NAME_KEY,
  );
  const mappedDetails = mappedDetailEntries.reduce<Record<string, StructuredDataValue>>(
    (accumulatedDetails, [detailKey, detailValue]) => ({
      ...accumulatedDetails,
      [detailKey]: detailValue,
    }),
    {},
  );
  const mappedDetailsWithActionIdentifier =
    actionIdentifierValue === undefined
      ? mappedDetails
      : {
          ...mappedDetails,
          [DEBUG_ERROR_DETAIL_ACTION_IDENTIFIER_KEY]:
            DebugErrorActionIdentifierSchema.parse(actionIdentifierValue),
        };
  const mappedDetailsWithActionIdentifierAndName =
    actionNameValue === undefined
      ? mappedDetailsWithActionIdentifier
      : {
          ...mappedDetailsWithActionIdentifier,
          [DEBUG_ERROR_DETAIL_ACTION_NAME_KEY]: DebugErrorActionNameSchema.parse(actionNameValue),
        };

  return DebugErrorDetailsSchema.parse(mappedDetailsWithActionIdentifierAndName);
}

function mapDebugErrorEventWireToContract(value: DebugErrorEventWire): DebugErrorEventContract {
  return {
    errorId: value.errorId,
    sessionId: value.sessionId,
    origin: value.origin,
    source: value.source,
    operation: value.operation,
    message: value.message,
    severity: value.severity,
    name: value.name,
    stack: value.stack,
    requestId: value.requestId,
    threadId: value.threadId,
    url: value.url,
    occurredAt: value.occurredAt,
    recordedAt: value.recordedAt,
    details: mapDebugErrorDetailsWireToContract(value.details),
  };
}

const DebugErrorEventSchema = DebugErrorEventWireSchema.transform(
  mapDebugErrorEventWireToContract,
).pipe(DebugErrorEventContractSchema);

const DebugErrorListEnvelopeContractSchema = z
  .object({
    ok: z.literal(true),
    data: z.array(DebugErrorEventSchema),
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1),
  })
  .strict();

export type ApiDebugErrorListResponse = z.infer<typeof DebugErrorListEnvelopeContractSchema>;

function mapDebugErrorListEnvelopeWireToContract(
  value: z.infer<typeof FarfieldDebugErrorListEnvelopeSchema>,
): ApiDebugErrorListResponse {
  return {
    ok: value.ok,
    data: value.data.map((debugErrorEvent) => DebugErrorEventSchema.parse(debugErrorEvent)),
    sessionId: value.sessionId,
    sessionLogPath: value.sessionLogPath,
  };
}

export const DebugErrorListEnvelopeSchema = FarfieldDebugErrorListEnvelopeSchema.transform(
  mapDebugErrorListEnvelopeWireToContract,
).pipe(DebugErrorListEnvelopeContractSchema);

const DebugErrorDetailEnvelopeContractSchema = z
  .object({
    ok: z.literal(true),
    error: DebugErrorEventSchema,
    sessionId: z.string().trim().min(1),
    sessionLogPath: z.string().trim().min(1),
  })
  .strict();

export type ApiDebugErrorDetailResponse = z.infer<typeof DebugErrorDetailEnvelopeContractSchema>;

function mapDebugErrorDetailEnvelopeWireToContract(
  value: z.infer<typeof FarfieldDebugErrorDetailEnvelopeSchema>,
): ApiDebugErrorDetailResponse {
  return {
    ok: value.ok,
    error: DebugErrorEventSchema.parse(value.error),
    sessionId: value.sessionId,
    sessionLogPath: value.sessionLogPath,
  };
}

export const DebugErrorDetailEnvelopeSchema = FarfieldDebugErrorDetailEnvelopeSchema.transform(
  mapDebugErrorDetailEnvelopeWireToContract,
).pipe(DebugErrorDetailEnvelopeContractSchema);

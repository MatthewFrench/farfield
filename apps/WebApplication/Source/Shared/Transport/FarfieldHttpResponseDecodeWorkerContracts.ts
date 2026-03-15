import { z } from "zod";
import type { StructuredDataValue } from "@/Shared/Contracts/StructuredDataValue";
import { StructuredDataValueSchema } from "@/Shared/Contracts/StructuredDataValue";

const RequestIdentifierSchema = z.number().int().nonnegative();
const DecodeFailureReasonKindSchema = z.enum([
  "invalid-json",
  "invalid-structured-data",
  "invalid-envelope",
]);

export interface FarfieldHttpResponseDecodeWorkerRequest {
  requestId: number;
  parseText: string;
}

const FarfieldHttpResponseDecodeWorkerRequestSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    parseText: z.string(),
  })
  .strict();

export interface FarfieldHttpResponseDecodeWorkerSuccessResponse {
  requestId: number;
  kind: "success";
  data: StructuredDataValue;
  envelopeOk: boolean;
}

const FarfieldHttpResponseDecodeWorkerSuccessResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("success"),
    data: StructuredDataValueSchema,
    envelopeOk: z.boolean(),
  })
  .strict();

export interface FarfieldHttpResponseDecodeWorkerFailureResponse {
  requestId: number;
  kind: "failure";
  reasonKind: z.infer<typeof DecodeFailureReasonKindSchema>;
  reason: string;
}

const FarfieldHttpResponseDecodeWorkerFailureResponseSchema = z
  .object({
    requestId: RequestIdentifierSchema,
    kind: z.literal("failure"),
    reasonKind: DecodeFailureReasonKindSchema,
    reason: z.string().trim().min(1),
  })
  .strict();

export type FarfieldHttpResponseDecodeWorkerResponse =
  | FarfieldHttpResponseDecodeWorkerSuccessResponse
  | FarfieldHttpResponseDecodeWorkerFailureResponse;

const FarfieldHttpResponseDecodeWorkerResponseSchema = z.discriminatedUnion("kind", [
  FarfieldHttpResponseDecodeWorkerSuccessResponseSchema,
  FarfieldHttpResponseDecodeWorkerFailureResponseSchema,
]);

export function parseFarfieldHttpResponseDecodeWorkerRequest(
  value: StructuredDataValue | FarfieldHttpResponseDecodeWorkerRequest,
): FarfieldHttpResponseDecodeWorkerRequest {
  return FarfieldHttpResponseDecodeWorkerRequestSchema.parse(value);
}

export function safeParseFarfieldHttpResponseDecodeWorkerResponse(
  value: StructuredDataValue | FarfieldHttpResponseDecodeWorkerResponse,
):
  | { success: true; data: FarfieldHttpResponseDecodeWorkerResponse }
  | { success: false; error: z.ZodError } {
  const result = FarfieldHttpResponseDecodeWorkerResponseSchema.safeParse(value);
  if (!result.success) {
    return result;
  }
  return {
    success: true,
    data: result.data,
  };
}

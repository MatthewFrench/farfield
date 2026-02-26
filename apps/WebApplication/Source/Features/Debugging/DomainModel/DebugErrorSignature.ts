/**
 * Owns stable debug-error signature encoding for state-store deduplication checks.
 * Versioned JSON tuples avoid delimiter-collision ambiguity and allow future signature evolution.
 */
export interface DebugErrorSignatureInput {
  errorId: string;
  recordedAt: string;
  message: string;
}

const DEBUG_ERROR_SIGNATURE_SCHEMA_VERSION = "v1";

type DebugErrorSignatureTuple = readonly [
  schemaVersion: string,
  errorId: string,
  recordedAt: string,
  message: string
];

export function buildDebugErrorSignature(input: DebugErrorSignatureInput): string {
  const signatureTuple: DebugErrorSignatureTuple = [
    DEBUG_ERROR_SIGNATURE_SCHEMA_VERSION,
    input.errorId,
    input.recordedAt,
    input.message
  ];
  return JSON.stringify(signatureTuple);
}

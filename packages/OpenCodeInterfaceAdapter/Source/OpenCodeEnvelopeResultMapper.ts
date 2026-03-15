import type { OpenCodeApiResponseEnvelope } from "./ClientContracts.js";
import { OpenCodeStructuredDataValueSchema } from "./Schemas.js";

interface OpenCodeSdkResponseEnvelope<DataType> {
  data: DataType | undefined;
}

function mapSdkResponseEnvelope<DataType>(data: DataType | undefined): OpenCodeApiResponseEnvelope {
  if (data === undefined) {
    return {};
  }

  return {
    data: OpenCodeStructuredDataValueSchema.parse(data),
  };
}

/**
 * Owns SDK response-envelope normalization into the package response contract.
 */
export async function mapOpenCodeSdkResponsePromise<DataType>(
  responsePromise: Promise<OpenCodeSdkResponseEnvelope<DataType>>,
): Promise<OpenCodeApiResponseEnvelope> {
  const response = await responsePromise;
  return mapSdkResponseEnvelope(response.data);
}

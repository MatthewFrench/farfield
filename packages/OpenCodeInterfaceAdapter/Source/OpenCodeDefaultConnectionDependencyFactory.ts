import { createOpencode, createOpencodeClient, type OpencodeClientConfig } from "@opencode-ai/sdk";
import type {
  OpenCodeClientConfiguration,
  OpenCodeConnectionDependencies,
  OpenCodeServerHandle,
  OpenCodeServerStartOptions,
} from "./Client.js";
import type { OpenCodeMonitorClient } from "./ClientContracts.js";
import { mapOpenCodeSdkResponsePromise } from "./OpenCodeEnvelopeResultMapper.js";

function createDefaultOpenCodeClient(
  configuration: OpenCodeClientConfiguration,
): OpenCodeMonitorClient {
  const sdkConfiguration: OpencodeClientConfig = {
    baseUrl: configuration.baseUrl,
  };
  const sdkClient = createOpencodeClient(sdkConfiguration);
  const sdkSessionClient = sdkClient.session;
  const sdkProjectClient = sdkClient.project;

  return {
    session: {
      list: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.list(input)),
      create: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.create(input)),
      get: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.get(input)),
      messages: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.messages(input)),
      prompt: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.prompt(input)),
      abort: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.abort(input)),
      delete: async (input) => mapOpenCodeSdkResponsePromise(sdkSessionClient.delete(input)),
    },
    project: {
      list: async () => mapOpenCodeSdkResponsePromise(sdkProjectClient.list()),
    },
  };
}

async function createDefaultOpenCodeServer(
  options: OpenCodeServerStartOptions,
): Promise<OpenCodeServerHandle> {
  const result = await createOpencode({
    hostname: options.hostname,
    port: options.port,
    timeout: options.timeoutMilliseconds,
  });
  return result.server;
}

/**
 * Owns runtime default dependency wiring for OpenCodeConnection.
 */
export const DefaultOpenCodeConnectionDependencies: OpenCodeConnectionDependencies = {
  createServer: createDefaultOpenCodeServer,
  createClient: createDefaultOpenCodeClient,
};

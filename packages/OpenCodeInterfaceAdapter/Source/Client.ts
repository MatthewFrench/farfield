import { createOpencode, createOpencodeClient, type OpencodeClientConfig } from "@opencode-ai/sdk";
import { z } from "zod";
import type {
  OpenCodeApiResponseEnvelope,
  OpenCodeConnectionClientProvider,
  OpenCodeMonitorClient,
} from "./ClientContracts.js";
import { OpenCodeStructuredDataValueSchema } from "./Schemas.js";

export interface OpenCodeClientOptions {
  hostname?: string;
  port?: number;
  url?: string;
}

export interface OpenCodeClientConfiguration {
  baseUrl: string;
}

export interface OpenCodeServerStartOptions {
  hostname: string;
  port: number;
  timeoutMilliseconds: number;
}

export interface OpenCodeServerHandle {
  url: string;
  close(): void;
}

export interface OpenCodeConnectionDependencies {
  createServer(options: OpenCodeServerStartOptions): Promise<OpenCodeServerHandle>;
  createClient(configuration: OpenCodeClientConfiguration): OpenCodeMonitorClient;
}

const OPEN_CODE_DEFAULT_HOSTNAME = "127.0.0.1";
const OPEN_CODE_DEFAULT_PORT = 0;
const OPEN_CODE_START_TIMEOUT_MILLISECONDS = 30_000;
const OPEN_CODE_CONNECTION_NOT_STARTED_ERROR = "OpenCode connection not started";

const OpenCodeHostnameSchema = z.string().trim().min(1);
const OpenCodePortSchema = z.number().int().nonnegative().max(65_535);
const OpenCodeBaseUrlSchema = z.string().trim().min(1);
const OpenCodeClientOptionsSchema = z
  .object({
    hostname: OpenCodeHostnameSchema.optional(),
    port: OpenCodePortSchema.optional(),
    url: OpenCodeBaseUrlSchema.optional(),
  })
  .strict();

type OpenCodeParsedClientOptions = z.infer<typeof OpenCodeClientOptionsSchema>;

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

async function mapSdkResponsePromise<DataType>(
  responsePromise: Promise<OpenCodeSdkResponseEnvelope<DataType>>,
): Promise<OpenCodeApiResponseEnvelope> {
  const response = await responsePromise;
  return mapSdkResponseEnvelope(response.data);
}

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
      list: async (input) => mapSdkResponsePromise(sdkSessionClient.list(input)),
      create: async (input) => mapSdkResponsePromise(sdkSessionClient.create(input)),
      get: async (input) => mapSdkResponsePromise(sdkSessionClient.get(input)),
      messages: async (input) => mapSdkResponsePromise(sdkSessionClient.messages(input)),
      prompt: async (input) => mapSdkResponsePromise(sdkSessionClient.prompt(input)),
      abort: async (input) => mapSdkResponsePromise(sdkSessionClient.abort(input)),
      delete: async (input) => mapSdkResponsePromise(sdkSessionClient.delete(input)),
    },
    project: {
      list: async () => mapSdkResponsePromise(sdkProjectClient.list()),
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

const DefaultOpenCodeConnectionDependencies: OpenCodeConnectionDependencies = {
  createServer: createDefaultOpenCodeServer,
  createClient: createDefaultOpenCodeClient,
};

/**
 * Owns OpenCode SDK connection lifecycle and client instantiation.
 * Session/message orchestration is handled by `OpenCodeMonitorService`.
 */
export class OpenCodeConnection implements OpenCodeConnectionClientProvider {
  private client: OpenCodeMonitorClient | null = null;
  private server: OpenCodeServerHandle | null = null;
  private readonly options: OpenCodeParsedClientOptions;
  private readonly dependencies: OpenCodeConnectionDependencies;
  private baseUrl: string | null = null;

  public constructor(
    options: OpenCodeClientOptions = {},
    dependencies: OpenCodeConnectionDependencies = DefaultOpenCodeConnectionDependencies,
  ) {
    this.options = OpenCodeClientOptionsSchema.parse(options);
    this.dependencies = dependencies;
  }

  private createClientWithBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
    this.client = this.dependencies.createClient({ baseUrl });
  }

  private buildServerStartOptions(): OpenCodeServerStartOptions {
    return {
      hostname: this.options.hostname ?? OPEN_CODE_DEFAULT_HOSTNAME,
      port: this.options.port ?? OPEN_CODE_DEFAULT_PORT,
      timeoutMilliseconds: OPEN_CODE_START_TIMEOUT_MILLISECONDS,
    };
  }

  public async start(): Promise<void> {
    if (this.options.url !== undefined) {
      this.createClientWithBaseUrl(this.options.url);
      return;
    }

    const server = await this.dependencies.createServer(this.buildServerStartOptions());

    const serverUrl = OpenCodeBaseUrlSchema.parse(server.url);
    this.createClientWithBaseUrl(serverUrl);
    this.server = server;
  }

  public async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.client = null;
    this.baseUrl = null;
  }

  public getClient(): OpenCodeMonitorClient {
    if (!this.client) {
      throw new Error(OPEN_CODE_CONNECTION_NOT_STARTED_ERROR);
    }
    return this.client;
  }

  public getUrl(): string | null {
    return this.baseUrl ?? this.options.url ?? null;
  }

  public isConnected(): boolean {
    return this.client !== null;
  }
}

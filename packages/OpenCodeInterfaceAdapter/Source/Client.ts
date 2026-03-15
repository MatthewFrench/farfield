import type { OpenCodeConnectionClientProvider, OpenCodeMonitorClient } from "./ClientContracts.js";
import {
  buildOpenCodeServerStartOptions,
  type OpenCodeParsedClientOptions,
  parseOpenCodeBaseUrl,
  parseOpenCodeClientOptions,
} from "./OpenCodeConnectionOptions.js";
import { DefaultOpenCodeConnectionDependencies } from "./OpenCodeDefaultConnectionDependencyFactory.js";

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

const OPEN_CODE_CONNECTION_NOT_STARTED_ERROR = "OpenCode connection not started";

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
    this.options = parseOpenCodeClientOptions(options);
    this.dependencies = dependencies;
  }

  private createClientWithBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
    this.client = this.dependencies.createClient({ baseUrl });
  }

  private buildServerStartOptions(): OpenCodeServerStartOptions {
    return buildOpenCodeServerStartOptions(this.options);
  }

  public async start(): Promise<void> {
    if (this.options.url !== undefined) {
      this.createClientWithBaseUrl(this.options.url);
      return;
    }

    const server = await this.dependencies.createServer(this.buildServerStartOptions());

    const serverUrl = parseOpenCodeBaseUrl(server.url);
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

import {
  type AppServerCollaborationModeListResponse,
  AppServerCollaborationModeListResponseSchema,
  type AppServerListModelsResponse,
  AppServerListModelsResponseSchema,
  JsonValueSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { APP_SERVER_CLIENT_METHODS } from "./AppServerClientMethodConstants.js";
import {
  APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  buildListAppsRequestParameters,
  buildListExperimentalFeaturesRequestParameters,
  buildListMcpServerStatusesRequestParameters,
  buildListSkillsRequestParameters,
} from "./AppServerClientRequestBuilders.js";
import {
  APP_SERVER_CLIENT_RESPONSE_CONTEXTS,
  parseAppServerResponse,
} from "./AppServerClientResponseParser.js";
import type { AppServerTransport } from "./AppServerTransport.js";

export interface ListExperimentalFeaturesOptions {
  limit?: number | null;
  cursor?: string | null;
}

export type ExperimentalFeatureStage =
  | "beta"
  | "underDevelopment"
  | "stable"
  | "deprecated"
  | "removed";

export interface ExperimentalFeature {
  name: string;
  stage: ExperimentalFeatureStage;
  displayName: string | null;
  description: string | null;
  announcement: string | null;
  enabled: boolean;
  defaultEnabled: boolean;
}

export interface ListExperimentalFeaturesResult {
  data: ExperimentalFeature[];
  nextCursor: string | null;
}

export interface ListMcpServerStatusesOptions {
  limit?: number | null;
  cursor?: string | null;
}

export interface McpServerStatusSummary {
  name: string;
  authStatus: z.infer<typeof JsonValueSchema>;
  toolCount: number;
  resourceCount: number;
  resourceTemplateCount: number;
}

export interface ListMcpServerStatusesResult {
  data: McpServerStatusSummary[];
  nextCursor: string | null;
}

export interface ListAppsOptions {
  limit?: number | null;
  cursor?: string | null;
  threadId?: string | null;
  forceRefetch?: boolean;
}

export interface AppInfoSummary {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  logoUrlDark: string | null;
  installUrl: string | null;
  isAccessible: boolean;
  isEnabled: boolean;
}

export interface ListAppsResult {
  data: AppInfoSummary[];
  nextCursor: string | null;
}

export interface SkillsListExtraRootsForCwdOptions {
  cwd: string;
  extraUserRoots: string[];
}

export interface ListSkillsOptions {
  cwds?: string[];
  forceReload?: boolean;
  perCwdExtraUserRoots?: SkillsListExtraRootsForCwdOptions[] | null;
}

export type SkillScope = "user" | "repo" | "system" | "admin";

export interface SkillSummary {
  name: string;
  description: string;
  shortDescription: string | null;
  path: string;
  scope: SkillScope;
  enabled: boolean;
}

export interface SkillErrorSummary {
  path: string;
  message: string;
}

export interface SkillsListEntrySummary {
  cwd: string;
  skills: SkillSummary[];
  errors: SkillErrorSummary[];
}

export interface ListSkillsResult {
  data: SkillsListEntrySummary[];
}

const AppServerExperimentalFeatureStageSchema = z.enum([
  "beta",
  "underDevelopment",
  "stable",
  "deprecated",
  "removed",
]);
const AppServerExperimentalFeatureSchema = z
  .object({
    name: z.string().min(1),
    stage: AppServerExperimentalFeatureStageSchema,
    displayName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    announcement: z.string().nullable().optional(),
    enabled: z.boolean(),
    defaultEnabled: z.boolean(),
  })
  .passthrough();
const AppServerExperimentalFeatureListResponseSchema = z
  .object({
    data: z.array(AppServerExperimentalFeatureSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerMcpServerStatusSchema = z
  .object({
    name: z.string().min(1),
    tools: z.record(JsonValueSchema),
    resources: z.array(JsonValueSchema),
    resourceTemplates: z.array(JsonValueSchema),
    authStatus: JsonValueSchema,
  })
  .passthrough();
const AppServerMcpServerStatusListResponseSchema = z
  .object({
    data: z.array(AppServerMcpServerStatusSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerAppListItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    logoUrlDark: z.string().nullable().optional(),
    installUrl: z.string().nullable().optional(),
    isAccessible: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  })
  .passthrough();
const AppServerAppListResponseSchema = z
  .object({
    data: z.array(AppServerAppListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .passthrough();
const AppServerSkillMetadataSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    shortDescription: z.string().nullable().optional(),
    path: z.string().min(1),
    scope: z.enum(["user", "repo", "system", "admin"]),
    enabled: z.boolean(),
  })
  .passthrough();
const AppServerSkillErrorSchema = z
  .object({
    path: z.string().min(1),
    message: z.string().min(1),
  })
  .passthrough();
const AppServerSkillsListEntrySchema = z
  .object({
    cwd: z.string().min(1),
    skills: z.array(AppServerSkillMetadataSchema),
    errors: z.array(AppServerSkillErrorSchema),
  })
  .passthrough();
const AppServerSkillsListResponseSchema = z
  .object({
    data: z.array(AppServerSkillsListEntrySchema),
  })
  .passthrough();

/**
 * Owns typed catalog/capability metadata reads for app-server operations.
 */
export class AppServerCapabilityCatalogClient {
  private readonly transport: AppServerTransport;

  public constructor(transport: AppServerTransport) {
    this.transport = transport;
  }

  public async listModels(
    limit = APP_SERVER_CLIENT_DEFAULT_LIST_MODELS_LIMIT,
  ): Promise<AppServerListModelsResponse> {
    const result = await this.transport.request(APP_SERVER_CLIENT_METHODS.listModels, {
      limit,
    });
    return parseAppServerResponse(
      AppServerListModelsResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listModels,
    );
  }

  public async listCollaborationModes(): Promise<AppServerCollaborationModeListResponse> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listCollaborationModes,
      {},
    );
    return parseAppServerResponse(
      AppServerCollaborationModeListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listCollaborationModes,
    );
  }

  public async listExperimentalFeatures(
    options?: ListExperimentalFeaturesOptions,
  ): Promise<ListExperimentalFeaturesResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listExperimentalFeatures,
      buildListExperimentalFeaturesRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerExperimentalFeatureListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listExperimentalFeatures,
    );
    return {
      data: parsed.data.map((feature) => ({
        name: feature.name,
        stage: feature.stage,
        displayName: feature.displayName ?? null,
        description: feature.description ?? null,
        announcement: feature.announcement ?? null,
        enabled: feature.enabled,
        defaultEnabled: feature.defaultEnabled,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listMcpServerStatuses(
    options?: ListMcpServerStatusesOptions,
  ): Promise<ListMcpServerStatusesResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listMcpServerStatuses,
      buildListMcpServerStatusesRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerMcpServerStatusListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listMcpServerStatuses,
    );
    return {
      data: parsed.data.map((status) => ({
        name: status.name,
        authStatus: status.authStatus,
        toolCount: Object.keys(status.tools).length,
        resourceCount: status.resources.length,
        resourceTemplateCount: status.resourceTemplates.length,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listApps(options?: ListAppsOptions): Promise<ListAppsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listApps,
      buildListAppsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerAppListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listApps,
    );
    return {
      data: parsed.data.map((appInfo) => ({
        id: appInfo.id,
        name: appInfo.name,
        description: appInfo.description ?? null,
        logoUrl: appInfo.logoUrl ?? null,
        logoUrlDark: appInfo.logoUrlDark ?? null,
        installUrl: appInfo.installUrl ?? null,
        isAccessible: appInfo.isAccessible ?? false,
        isEnabled: appInfo.isEnabled ?? true,
      })),
      nextCursor: parsed.nextCursor,
    };
  }

  public async listSkills(options?: ListSkillsOptions): Promise<ListSkillsResult> {
    const result = await this.transport.request(
      APP_SERVER_CLIENT_METHODS.listSkills,
      buildListSkillsRequestParameters(options),
    );
    const parsed = parseAppServerResponse(
      AppServerSkillsListResponseSchema,
      result,
      APP_SERVER_CLIENT_RESPONSE_CONTEXTS.listSkills,
    );
    return {
      data: parsed.data.map((entry) => ({
        cwd: entry.cwd,
        skills: entry.skills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          shortDescription: skill.shortDescription ?? null,
          path: skill.path,
          scope: skill.scope,
          enabled: skill.enabled,
        })),
        errors: entry.errors.map((error) => ({
          path: error.path,
          message: error.message,
        })),
      })),
    };
  }
}

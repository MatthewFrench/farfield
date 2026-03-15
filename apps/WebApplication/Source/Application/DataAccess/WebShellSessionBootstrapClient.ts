/**
 * Owns web-shell session bootstrap calls so state owners depend on an explicit data-access API.
 */
import {
  type ApiEventsSessionBootstrapResponse,
  bootstrapEventsSession,
} from "@/Application/DataAccess/WebShellApi";
import type { ApiRequestOptions } from "@/Shared/Contracts/ApiContracts";

export class WebShellSessionBootstrapClient {
  public async bootstrapWithRequestOptions(
    requestOptions: ApiRequestOptions,
  ): Promise<ApiEventsSessionBootstrapResponse> {
    return bootstrapEventsSession(undefined, requestOptions);
  }

  public async bootstrapWithApiToken(apiToken: string): Promise<ApiEventsSessionBootstrapResponse> {
    return bootstrapEventsSession({ apiToken });
  }
}

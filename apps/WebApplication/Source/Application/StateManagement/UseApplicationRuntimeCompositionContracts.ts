import { ApplicationRouteStateMapper } from "@/Application/DomainModel/ApplicationRouteStateMapper";
import { type ApplicationDerivedState } from "@/Application/StateManagement/UseApplicationDerivedStateContracts";
import { type ApplicationOwnerDependencies } from "@/Application/StateManagement/UseApplicationOwnerDependencies";
import { type ApplicationFormattingHelpers } from "@/Application/StateManagement/UseApplicationPresentationHelpers";
import { type ApplicationRuntimeRequestHandlers } from "@/Application/StateManagement/UseApplicationRuntimeRequestHandlers";
import { type ApplicationShellComposition } from "@/Application/StateManagement/UseApplicationShellComposition";
import { type ApplicationShellState } from "@/Application/StateManagement/UseApplicationShellState";
import {
  type CoreDataCapabilitySnapshot,
  type CoreDataLoaders,
} from "@/Application/StateManagement/UseCoreDataLoaders";
import { type SelectedThreadLoaders } from "@/Features/Chat/StateManagement/UseSelectedThreadLoaders";

export interface UseApplicationRuntimeCompositionInput {
  theme: string;
  toggleTheme: () => void;
  appDefaultValue: string;
  initialVisibleChatItems: number;
  visibleChatItemsStep: number;
  coreRefreshIntervalMs: number;
  coreRefreshConnectedMinIntervalMs: number;
  debugHistoryLimit: number;
  debugErrorListLimit: number;
  applicationRouteStateMapper: ApplicationRouteStateMapper;
  applicationShellState: ApplicationShellState;
  applicationDerivedState: ApplicationDerivedState;
  applicationOwnerDependencies: ApplicationOwnerDependencies<CoreDataCapabilitySnapshot>;
  runtimeRequestHandlers: ApplicationRuntimeRequestHandlers;
  coreDataLoaders: CoreDataLoaders;
  loadSelectedThreadTracked: SelectedThreadLoaders["loadSelectedThreadTracked"];
  applySelectedThreadStreamDelta: SelectedThreadLoaders["applySelectedThreadStreamDelta"];
  streamEventCards: React.JSX.Element[];
  renderAgentFavicon: ApplicationFormattingHelpers["renderAgentFavicon"];
  formatDateValue: ApplicationFormattingHelpers["formatDateValue"];
}

export interface ApplicationRuntimeComposition {
  shellComposition: ApplicationShellComposition;
}

import {
  type ApplicationDerivedState,
  type UseApplicationDerivedStateInput,
} from "./UseApplicationDerivedStateContracts";

const CODEX_AGENT_IDENTIFIER = "codex";
const OPENCODE_AGENT_IDENTIFIER = "opencode";

interface SelectedAgentDescriptorInput {
  agentsById: ApplicationDerivedState["agentsById"];
  selectedAgentId: UseApplicationDerivedStateInput["selectedAgentId"];
}

interface ActiveThreadAgentInput {
  selectedThread: ApplicationDerivedState["selectedThread"];
  selectedAgentId: UseApplicationDerivedStateInput["selectedAgentId"];
}

interface ActiveAgentDescriptorInput {
  agentsById: ApplicationDerivedState["agentsById"];
  activeThreadAgentId: ApplicationDerivedState["activeThreadAgentId"];
  selectedAgentDescriptor: ApplicationDerivedState["selectedAgentDescriptor"];
}

interface ActiveAgentLabelInput {
  activeAgentDescriptor: ApplicationDerivedState["activeAgentDescriptor"];
  selectedAgentLabel: ApplicationDerivedState["selectedAgentLabel"];
}

interface ActiveAgentCapabilitiesInput {
  activeAgentDescriptor: ApplicationDerivedState["activeAgentDescriptor"];
  selectedAgentCapabilities: ApplicationDerivedState["selectedAgentCapabilities"];
}

interface AgentConnectivityStateInput {
  agentsById: ApplicationDerivedState["agentsById"];
}

export interface AgentCapabilityFlags {
  canSetCollaborationMode: ApplicationDerivedState["canSetCollaborationMode"];
  canListModels: ApplicationDerivedState["canListModels"];
  canListCollaborationModes: ApplicationDerivedState["canListCollaborationModes"];
  canSubmitUserInputForActiveAgent: ApplicationDerivedState["canSubmitUserInputForActiveAgent"];
}

export interface AgentConnectivityState {
  codexConfigured: ApplicationDerivedState["codexConfigured"];
  openCodeConnected: ApplicationDerivedState["openCodeConnected"];
}

export function readAgentsById(
  agentDescriptors: UseApplicationDerivedStateInput["agentDescriptors"],
): ApplicationDerivedState["agentsById"] {
  const map: ApplicationDerivedState["agentsById"] = {};
  for (const descriptor of agentDescriptors) {
    map[descriptor.id] = descriptor;
  }
  return map;
}

export function readAvailableAgentIds(
  agentDescriptors: UseApplicationDerivedStateInput["agentDescriptors"],
): ApplicationDerivedState["availableAgentIds"] {
  return agentDescriptors
    .filter((descriptor) => descriptor.enabled)
    .map((descriptor) => descriptor.id);
}

export function readSelectedAgentDescriptor(
  input: SelectedAgentDescriptorInput,
): ApplicationDerivedState["selectedAgentDescriptor"] {
  return input.agentsById[input.selectedAgentId] ?? null;
}

export function readActiveThreadAgentId(
  input: ActiveThreadAgentInput,
): ApplicationDerivedState["activeThreadAgentId"] {
  return input.selectedThread?.agentId ?? input.selectedAgentId;
}

export function readActiveAgentDescriptor(
  input: ActiveAgentDescriptorInput,
): ApplicationDerivedState["activeAgentDescriptor"] {
  return input.agentsById[input.activeThreadAgentId] ?? input.selectedAgentDescriptor;
}

export function readActiveAgentLabel(
  input: ActiveAgentLabelInput,
): ApplicationDerivedState["activeAgentLabel"] {
  return input.activeAgentDescriptor?.label ?? input.selectedAgentLabel;
}

export function readActiveAgentCapabilities(
  input: ActiveAgentCapabilitiesInput,
): ApplicationDerivedState["activeAgentCapabilities"] {
  return input.activeAgentDescriptor?.capabilities ?? input.selectedAgentCapabilities;
}

export function readAgentCapabilityFlags(
  activeAgentCapabilities: ApplicationDerivedState["activeAgentCapabilities"],
): AgentCapabilityFlags {
  return {
    canSetCollaborationMode: Boolean(activeAgentCapabilities?.canSetCollaborationMode),
    canListModels: Boolean(activeAgentCapabilities?.canListModels),
    canListCollaborationModes: Boolean(activeAgentCapabilities?.canListCollaborationModes),
    canSubmitUserInputForActiveAgent: Boolean(activeAgentCapabilities?.canSubmitUserInput),
  };
}

export function readAgentConnectivityState(
  input: AgentConnectivityStateInput,
): AgentConnectivityState {
  return {
    codexConfigured: input.agentsById[CODEX_AGENT_IDENTIFIER]?.enabled === true,
    openCodeConnected: input.agentsById[OPENCODE_AGENT_IDENTIFIER]?.connected === true,
  };
}

import { type AgentId } from "@/Shared/Contracts/ApiContracts";

const AGENT_FAVICON_BY_ID: Record<AgentId, string> = {
  codex: "https://openai.com/favicon.ico",
  opencode: "https://opencode.ai/favicon.ico"
};

function readAgentFaviconUrl(agentId: AgentId | null | undefined): string | null {
  if (!agentId) {
    return null;
  }
  return AGENT_FAVICON_BY_ID[agentId] ?? null;
}

export function AgentFavicon({
  agentId,
  label,
  className
}: {
  agentId: AgentId;
  label: string;
  className?: string;
}): React.JSX.Element | null {
  const faviconUrl = readAgentFaviconUrl(agentId);
  if (!faviconUrl) {
    return null;
  }

  return (
    <img
      src={faviconUrl}
      alt={label}
      title={label}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

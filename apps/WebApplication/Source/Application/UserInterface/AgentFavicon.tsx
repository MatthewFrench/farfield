import { type AgentId } from "@/Shared/Contracts/ApiContracts";

function buildAgentFaviconDataUrl(backgroundHexColor: string, labelText: string): string {
  const svg = [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>",
    `<rect x='0' y='0' width='32' height='32' rx='8' fill='${backgroundHexColor}'/>`,
    "<text x='16' y='21' text-anchor='middle' font-family='system-ui, sans-serif' font-size='16' font-weight='700' fill='white'>",
    labelText,
    "</text>",
    "</svg>"
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const AGENT_FAVICON_BY_ID: Record<AgentId, string> = {
  codex: buildAgentFaviconDataUrl("#10A37F", "C"),
  opencode: buildAgentFaviconDataUrl("#F97316", "O")
};

export function AgentFavicon({
  agentId,
  label,
  className
}: {
  agentId: AgentId;
  label: string;
  className?: string;
}): React.JSX.Element {
  return (
    <img
      src={AGENT_FAVICON_BY_ID[agentId]}
      alt={label}
      title={label}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

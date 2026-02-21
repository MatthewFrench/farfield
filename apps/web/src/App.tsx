import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Activity,
  Archive,
  ArrowDown,
  Bell,
  Bug,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Github,
  Loader2,
  Menu,
  MoreHorizontal,
  Moon,
  PanelLeft,
  Plus,
  RefreshCcw,
  Sun,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  archiveThread,
  createThread,
  getConfigDefaults,
  getHealth,
  getHistoryEntry,
  getLiveState,
  getPendingUserInputRequests,
  getStreamEvents,
  readThread,
  getTraceStatus,
  interruptThread,
  listAgents,
  listCollaborationModes,
  listModels,
  listDebugHistory,
  listThreads,
  markTrace,
  replayHistoryEntry,
  sendMessage,
  setCollaborationMode,
  startTrace,
  stopTrace,
  unarchiveThread,
  submitUserInput,
  type AgentId
} from "@/lib/api";
import {
  enablePushNotifications,
  getPushClientState,
  type PushClientState
} from "@/lib/push";
import { useTheme } from "@/hooks/useTheme";
import { ConversationItem } from "@/components/ConversationItem";
import { ChatComposer } from "@/components/ChatComposer";
import { PendingRequestCard } from "@/components/PendingRequestCard";
import { StreamEventCard } from "@/components/StreamEventCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { z } from "zod";

/* ── Types ─────────────────────────────────────────────────── */
type Health = Awaited<ReturnType<typeof getHealth>>;
type ConfigDefaults = Awaited<ReturnType<typeof getConfigDefaults>>;
type ThreadsResponse = Awaited<ReturnType<typeof listThreads>>;
type ModesResponse = Awaited<ReturnType<typeof listCollaborationModes>>;
type ModelsResponse = Awaited<ReturnType<typeof listModels>>;
type LiveStateResponse = Awaited<ReturnType<typeof getLiveState>>;
type StreamEventsResponse = Awaited<ReturnType<typeof getStreamEvents>>;
type ReadThreadResponse = Awaited<ReturnType<typeof readThread>>;
type AgentsResponse = Awaited<ReturnType<typeof listAgents>>;
type TraceStatus = Awaited<ReturnType<typeof getTraceStatus>>;
type HistoryResponse = Awaited<ReturnType<typeof listDebugHistory>>;
type HistoryDetail = Awaited<ReturnType<typeof getHistoryEntry>>;
type PendingRequest = ReturnType<typeof getPendingUserInputRequests>[number];
type Thread = ThreadsResponse["data"][number];
type AgentDescriptor = AgentsResponse["agents"][number];
type ConversationTurn = NonNullable<ReadThreadResponse["thread"]>["turns"][number];
type ConversationTurnItem = NonNullable<ConversationTurn["items"]>[number];
type ConversationItemType = ConversationTurnItem["type"];

interface FlatConversationItem {
  key: string;
  item: ConversationTurnItem;
  isLast: boolean;
  turnIsInProgress: boolean;
  previousItemType: ConversationItemType | undefined;
  nextItemType: ConversationItemType | undefined;
  spacingTop: number;
}

const SseStateEventSchema = z
  .object({
    type: z.literal("state"),
    state: z.object({}).passthrough()
  })
  .passthrough();

const SseHistoryEventSchema = z
  .object({
    type: z.literal("history"),
    entry: z
      .object({
        source: z.enum(["ipc", "app", "system"]),
        meta: z
          .object({
            method: z.string().optional(),
            threadId: z.string().optional()
          })
          .passthrough()
      })
      .passthrough()
  })
  .passthrough();

const SseEventSchema = z.union([SseStateEventSchema, SseHistoryEventSchema]);

interface RefreshFlags {
  refreshCore: boolean;
  refreshHistory: boolean;
  refreshSelectedThread: boolean;
}

interface ErrorBannerDetails {
  operation: string;
  message: string;
  requestId: string | null;
  errorId: string | null;
}
interface ProjectThreadGroup {
  key: string;
  label: string;
  projectPath: string | null;
  projectCreatedAt: number;
  latestUpdatedAt: number;
  threads: Thread[];
  isRemoved: boolean;
}

/* ── Helpers ────────────────────────────────────────────────── */
function formatDate(value: number | string | null | undefined): string {
  if (typeof value === "number") return new Date(value * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return value;
  }
  return "";
}

function threadLabel(thread: Thread): string {
  const text = thread.preview.trim();
  if (!text) return `thread ${thread.id.slice(0, 8)}`;
  return text;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toErrorBannerDetails(rawError: string): ErrorBannerDetails {
  const raw = rawError.trim();
  if (raw.length === 0) {
    return {
      operation: "",
      message: "",
      requestId: null,
      errorId: null
    };
  }

  const operationMatch = raw.match(/^([a-z][a-z0-9._-]{1,64}):\s*(.+)$/i);
  const operation = operationMatch?.[1] ?? "";
  const message = operationMatch?.[2] ?? raw;

  const requestIdMatch = raw.match(/\brequest(?:Id)?[ =:]+([a-z0-9._-]+)/i);
  const errorIdMatch = raw.match(/\berror(?:Id)?[ =:]+([a-z0-9._-]+)/i);

  return {
    operation,
    message,
    requestId: requestIdMatch?.[1] ?? null,
    errorId: errorIdMatch?.[1] ?? null
  };
}

function isTransientReadThreadError(errorMessage: string): boolean {
  return (
    /failed to load rollout .* is empty/i.test(errorMessage)
    || /thread not loaded in app-server/i.test(errorMessage)
    || /conversation not found/i.test(errorMessage)
  );
}

function isThreadNotLoadedReadError(errorMessage: string): boolean {
  return /thread not loaded in app-server/i.test(errorMessage);
}

async function waitForMs(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function shouldRenderConversationItem(item: ConversationTurnItem): boolean {
  switch (item.type) {
    case "userMessage":
    case "steeringUserMessage":
      return item.content.some((part) => part.type === "text" && part.text.length > 0);
    case "agentMessage":
      return item.text.length > 0;
    case "reasoning": {
      const hasSummary = Array.isArray(item.summary)
        && item.summary.some((line) => typeof line === "string");
      return hasSummary || Boolean(item.text);
    }
    case "userInputResponse":
      return Object.values(item.answers).some((answers) => answers.length > 0);
    default:
      return true;
  }
}

function isTurnInProgressStatus(status: string | undefined): boolean {
  return status === "in-progress" || status === "inProgress";
}

function signaturesMatch(prev: string[], next: string[]): boolean {
  if (prev.length !== next.length) {
    return false;
  }
  return prev.every((value, index) => value === next[index]);
}

function normalizeProjectPath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const normalized = trimmed.replaceAll("\\", "/").replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : trimmed.replaceAll("\\", "/");
}

function normalizeProjectPathFromThread(thread: Thread): string | null {
  const cwd = typeof thread.cwd === "string" ? thread.cwd.trim() : "";
  if (cwd.length > 0) {
    const normalizedCwd = normalizeProjectPath(cwd);
    return normalizedCwd.length > 0 ? normalizedCwd : cwd;
  }
  const path = typeof thread.path === "string" ? thread.path.trim() : "";
  if (path.length > 0) {
    const normalizedPath = normalizeProjectPath(path);
    return normalizedPath.length > 0 ? normalizedPath : path;
  }
  return null;
}

function projectLabelFromPath(path: string): string {
  const normalized = normalizeProjectPath(path);
  if (!normalized) {
    return path;
  }
  const parts = normalized.split("/").filter((part) => part.length > 0);
  return parts[parts.length - 1] ?? normalized;
}

function threadProjectIsMarkedRemoved(thread: Thread): boolean {
  return thread.projectRemoved === true || thread.removed === true || thread.projectState === "removed";
}

function sortThreadsByUpdatedAt(left: Thread, right: Thread): number {
  const leftUpdatedAt = typeof left.updatedAt === "number" ? left.updatedAt : 0;
  const rightUpdatedAt = typeof right.updatedAt === "number" ? right.updatedAt : 0;
  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt - leftUpdatedAt;
  }
  return left.id.localeCompare(right.id);
}

function sortProjectGroups(left: ProjectThreadGroup, right: ProjectThreadGroup): number {
  const leftIsNoProject = left.projectPath === null;
  const rightIsNoProject = right.projectPath === null;
  if (leftIsNoProject !== rightIsNoProject) {
    return leftIsNoProject ? 1 : -1;
  }
  if (left.projectCreatedAt !== right.projectCreatedAt) {
    return right.projectCreatedAt - left.projectCreatedAt;
  }
  if (left.latestUpdatedAt !== right.latestUpdatedAt) {
    return right.latestUpdatedAt - left.latestUpdatedAt;
  }
  return left.label.localeCompare(right.label);
}

function groupThreadsByProject(threads: Thread[]): ProjectThreadGroup[] {
  const groups = new Map<string, ProjectThreadGroup>();

  for (const thread of threads) {
    const projectPath = normalizeProjectPathFromThread(thread);
    const key = projectPath ? `project:${projectPath}` : "project:unknown";
    const label = projectPath ? projectLabelFromPath(projectPath) : "No project";
    const createdAt = typeof thread.createdAt === "number" ? thread.createdAt : 0;
    const updatedAt = typeof thread.updatedAt === "number" ? thread.updatedAt : 0;
    const markedRemoved = threadProjectIsMarkedRemoved(thread);

    const existing = groups.get(key);
    if (existing) {
      existing.threads.push(thread);
      if (createdAt > existing.projectCreatedAt) {
        existing.projectCreatedAt = createdAt;
      }
      if (updatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = updatedAt;
      }
      if (markedRemoved) {
        existing.isRemoved = true;
      }
      continue;
    }

    groups.set(key, {
      key,
      label,
      projectPath,
      projectCreatedAt: createdAt,
      latestUpdatedAt: updatedAt,
      threads: [thread],
      isRemoved: markedRemoved
    });
  }

  for (const group of groups.values()) {
    group.threads.sort(sortThreadsByUpdatedAt);
  }

  return Array.from(groups.values()).sort(sortProjectGroups);
}

function mergeProjectGroups(
  primaryGroups: ProjectThreadGroup[],
  secondaryGroups: ProjectThreadGroup[]
): ProjectThreadGroup[] {
  const mergedGroups = new Map<string, ProjectThreadGroup>();

  for (const sourceGroup of [...primaryGroups, ...secondaryGroups]) {
    const existing = mergedGroups.get(sourceGroup.key);
    if (!existing) {
      mergedGroups.set(sourceGroup.key, {
        key: sourceGroup.key,
        label: sourceGroup.label,
        projectPath: sourceGroup.projectPath,
        projectCreatedAt: sourceGroup.projectCreatedAt,
        latestUpdatedAt: sourceGroup.latestUpdatedAt,
        threads: [...sourceGroup.threads],
        isRemoved: sourceGroup.isRemoved
      });
      continue;
    }

    existing.threads.push(...sourceGroup.threads);
    if (sourceGroup.projectCreatedAt > existing.projectCreatedAt) {
      existing.projectCreatedAt = sourceGroup.projectCreatedAt;
    }
    if (sourceGroup.latestUpdatedAt > existing.latestUpdatedAt) {
      existing.latestUpdatedAt = sourceGroup.latestUpdatedAt;
    }
    if (sourceGroup.isRemoved) {
      existing.isRemoved = true;
    }
  }

  for (const group of mergedGroups.values()) {
    group.threads.sort(sortThreadsByUpdatedAt);
  }

  return Array.from(mergedGroups.values()).sort(sortProjectGroups);
}

const DEFAULT_EFFORT_OPTIONS = ["minimal", "low", "medium", "high", "xhigh"] as const;
const INITIAL_VISIBLE_CHAT_ITEMS = 90;
const VISIBLE_CHAT_ITEMS_STEP = 80;
const CORE_REFRESH_INTERVAL_MS = 5_000;
const CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS = 60_000;
const READ_THREAD_RETRY_ATTEMPTS = 6;
const READ_THREAD_RETRY_BASE_DELAY_MS = 140;
const READ_THREAD_RETRY_MAX_DELAY_MS = 1_000;
const APP_DEFAULT_VALUE = "__app_default__";
const ASSUMED_APP_DEFAULT_MODEL = "gpt-5.3-codex";
const ASSUMED_APP_DEFAULT_EFFORT = "medium";
const THREAD_LIST_LIMIT = 80;
const THREAD_LIST_MAX_PAGES = 20;
const ARCHIVED_THREAD_LIST_MAX_PAGES = 20;
const AGENT_FAVICON_BY_ID: Record<AgentId, string> = {
  codex: "https://openai.com/favicon.ico",
  opencode: "https://opencode.ai/favicon.ico"
};
const UNSUPPORTED_PUSH_CLIENT_STATE: PushClientState = {
  supported: false,
  serviceWorkerRegistered: false,
  permission: "unsupported",
  subscribed: false
};

function agentFavicon(agentId: AgentId | null | undefined): string | null {
  if (!agentId) {
    return null;
  }
  return AGENT_FAVICON_BY_ID[agentId] ?? null;
}

function AgentFavicon({
  agentId,
  label,
  className
}: {
  agentId: AgentId;
  label: string;
  className?: string;
}) {
  const faviconUrl = agentFavicon(agentId);
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

function isPlanModeOption(mode: {
  mode?: string | null | undefined;
  name: string;
}): boolean {
  const modeKey = typeof mode.mode === "string" ? mode.mode : "";
  return modeKey.toLowerCase().includes("plan") || mode.name.toLowerCase().includes("plan");
}

function getConversationStateUpdatedAt(
  state: NonNullable<ReadThreadResponse["thread"]> | null | undefined
): number {
  if (!state || typeof state.updatedAt !== "number") {
    return Number.NEGATIVE_INFINITY;
  }
  return state.updatedAt;
}

function buildModeSignature(modeKey: string, modelId: string, effort: string): string {
  return `${modeKey}|${modelId}|${effort}`;
}

function normalizeNullableModeValue(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "";
}

function normalizeModeSettingValue(
  value: string | null | undefined,
  assumedDefault: string
): string {
  const normalized = normalizeNullableModeValue(value);
  if (!normalized) {
    return "";
  }
  if (normalized === assumedDefault) {
    return "";
  }
  return normalized;
}

function readModeSelectionFromConversationState(
  state: NonNullable<ReadThreadResponse["thread"]> | null,
  appDefaultModel: string,
  appDefaultEffort: string
): {
  modeKey: string;
  modelId: string;
  reasoningEffort: string;
} {
  if (!state) {
    return {
      modeKey: "",
      modelId: "",
      reasoningEffort: ""
    };
  }

  if (state.latestCollaborationMode) {
    return {
      modeKey: state.latestCollaborationMode.mode,
      modelId: normalizeModeSettingValue(
        state.latestCollaborationMode.settings.model,
        appDefaultModel
      ),
      reasoningEffort: normalizeModeSettingValue(
        state.latestCollaborationMode.settings.reasoning_effort,
        appDefaultEffort
      )
    };
  }

  return {
    modeKey: "",
    modelId: normalizeModeSettingValue(state.latestModel, appDefaultModel),
    reasoningEffort: normalizeModeSettingValue(state.latestReasoningEffort, appDefaultEffort)
  };
}

function modeSelectionSignatureFromConversationState(
  state: NonNullable<ReadThreadResponse["thread"]> | null | undefined,
  appDefaultModel: string,
  appDefaultEffort: string
): string {
  const selection = readModeSelectionFromConversationState(
    state ?? null,
    appDefaultModel,
    appDefaultEffort
  );
  return buildModeSignature(selection.modeKey, selection.modelId, selection.reasoningEffort);
}

function conversationProgressSignature(
  state: NonNullable<ReadThreadResponse["thread"]> | null | undefined
): string {
  if (!state) {
    return "";
  }

  const lastTurn = state.turns[state.turns.length - 1];
  if (!lastTurn) {
    return "no-turns";
  }

  const lastTurnId = lastTurn.id ?? lastTurn.turnId ?? "";
  const items = lastTurn.items ?? [];
  const lastItem = items[items.length - 1];

  return [
    String(state.turns.length),
    lastTurnId,
    lastTurn.status,
    String(items.length),
    lastItem?.id ?? "",
    lastItem?.type ?? ""
  ].join("|");
}

function buildLiveStateSyncSignature(
  state: LiveStateResponse | null | undefined,
  appDefaultModel: string,
  appDefaultEffort: string
): string {
  if (!state) {
    return "";
  }

  const conversationState = state.conversationState;
  return [
    state.threadId,
    state.ownerClientId ?? "",
    String(getConversationStateUpdatedAt(conversationState)),
    String(conversationState?.turns.length ?? -1),
    modeSelectionSignatureFromConversationState(conversationState, appDefaultModel, appDefaultEffort),
    conversationProgressSignature(conversationState)
  ].join("|");
}

function buildReadThreadSyncSignature(
  state: ReadThreadResponse | null | undefined,
  appDefaultModel: string,
  appDefaultEffort: string
): string {
  if (!state) {
    return "";
  }

  const conversationState = state.thread;
  return [
    conversationState.id,
    String(getConversationStateUpdatedAt(conversationState)),
    String(conversationState.turns.length),
    modeSelectionSignatureFromConversationState(conversationState, appDefaultModel, appDefaultEffort),
    conversationProgressSignature(conversationState)
  ].join("|");
}

function parseUiStateFromPath(pathname: string): { threadId: string | null; tab: "chat" | "debug" } {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return { threadId: null, tab: "chat" };
  }
  if (segments.length === 1 && segments[0] === "debug") {
    return { threadId: null, tab: "debug" };
  }
  if (segments[0] === "threads" && typeof segments[1] === "string" && segments[1].length > 0) {
    const threadId = decodeURIComponent(segments[1]);
    if (segments[2] === "debug") {
      return { threadId, tab: "debug" };
    }
    return { threadId, tab: "chat" };
  }
  return { threadId: null, tab: "chat" };
}

function buildPathFromUiState(threadId: string | null, tab: "chat" | "debug"): string {
  if (!threadId) {
    return tab === "debug" ? "/debug" : "/";
  }
  if (tab === "debug") {
    return `/threads/${encodeURIComponent(threadId)}/debug`;
  }
  return `/threads/${encodeURIComponent(threadId)}`;
}

function IconBtn({
  onClick,
  disabled,
  title,
  active,
  testId,
  children
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  const buttonNode = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      variant="ghost"
      size="icon"
      className={`h-8 w-8 rounded-lg ${
        active
          ? "bg-muted text-foreground hover:bg-muted"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </Button>
  );

  if (!title) {
    return buttonNode;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{buttonNode}</TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

/* ── Main App ───────────────────────────────────────────────── */
export function App(): React.JSX.Element {
  const { theme, toggle: toggleTheme } = useTheme();
  const initialUiState = useMemo(() => parseUiStateFromPath(window.location.pathname), []);

  /* State */
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Health | null>(null);
  const [configDefaults, setConfigDefaults] = useState<ConfigDefaults | null>(null);
  const [threads, setThreads] = useState<ThreadsResponse["data"]>([]);
  const [archivedThreads, setArchivedThreads] = useState<ThreadsResponse["data"]>([]);
  const [hasLoadedArchivedThreads, setHasLoadedArchivedThreads] = useState(false);
  const [archivedThreadsTruncated, setArchivedThreadsTruncated] = useState(false);
  const [isArchivedThreadsOpen, setIsArchivedThreadsOpen] = useState(false);
  const [isArchivedThreadsLoading, setIsArchivedThreadsLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialUiState.threadId);
  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null);
  const [readThreadState, setReadThreadState] = useState<ReadThreadResponse | null>(null);
  const [isSelectedThreadLoading, setIsSelectedThreadLoading] = useState(
    Boolean(initialUiState.threadId)
  );
  const [streamEvents, setStreamEvents] = useState<StreamEventsResponse["events"]>([]);
  const [modes, setModes] = useState<ModesResponse["data"]>([]);
  const [models, setModels] = useState<ModelsResponse["data"]>([]);
  const [selectedModeKey, setSelectedModeKey] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [selectedReasoningEffort, setSelectedReasoningEffort] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [traceStatus, setTraceStatus] = useState<TraceStatus | null>(null);
  const [traceLabel, setTraceLabel] = useState("capture");
  const [traceNote, setTraceNote] = useState("");
  const [history, setHistory] = useState<HistoryResponse["history"]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [historyDetail, setHistoryDetail] = useState<HistoryDetail | null>(null);
  const [isCoreLoading, setIsCoreLoading] = useState(true);
  const [waitForReplayResponse, setWaitForReplayResponse] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [answerDraft, setAnswerDraft] = useState<Record<string, { option: string; freeform: string }>>({});
  const [agentDescriptors, setAgentDescriptors] = useState<AgentDescriptor[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>("codex");
  const [pushClientState, setPushClientState] = useState<PushClientState>(
    UNSUPPORTED_PUSH_CLIENT_STATE
  );
  const [isEnablingPushNotifications, setIsEnablingPushNotifications] = useState(false);

  /* UI state */
  const [activeTab, setActiveTab] = useState<"chat" | "debug">(initialUiState.tab);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isChatAtBottom, setIsChatAtBottom] = useState(true);
  const [visibleChatItemLimit, setVisibleChatItemLimit] = useState(INITIAL_VISIBLE_CHAT_ITEMS);
  const [hasHydratedModeFromLiveState, setHasHydratedModeFromLiveState] = useState(false);
  const [isModeSyncing, setIsModeSyncing] = useState(false);
  const [collapsedThreadProjectGroups, setCollapsedThreadProjectGroups] = useState<Record<string, boolean>>({});
  const [collapsedArchivedProjectGroups, setCollapsedArchivedProjectGroups] = useState<Record<string, boolean>>({});

  /* Refs */
  const selectedThreadIdRef = useRef<string | null>(null);
  const activeTabRef = useRef<"chat" | "debug">(initialUiState.tab);
  const refreshTimerRef = useRef<number | null>(null);
  const pendingRefreshFlagsRef = useRef<RefreshFlags>({
    refreshCore: false,
    refreshHistory: false,
    refreshSelectedThread: false
  });
  const coreRefreshIntervalRef = useRef<number | null>(null);
  const eventsConnectedRef = useRef(false);
  const lastCoreRefreshAtRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContentRef = useRef<HTMLDivElement>(null);
  const isChatAtBottomRef = useRef(true);
  const lastAppliedModeSignatureRef = useRef("");
  const hasHydratedAgentSelectionRef = useRef(false);
  const pendingMaterializationThreadIdsRef = useRef<Set<string>>(new Set());
  const threadsSignatureRef = useRef<string[]>([]);
  const archivedThreadsSignatureRef = useRef<string[]>([]);
  const modesSignatureRef = useRef<string[]>([]);
  const modelsSignatureRef = useRef<string[]>([]);
  const isArchivedThreadsOpenRef = useRef(false);
  const selectedThreadLoadTokenRef = useRef(0);
  const loadCoreDataTrackedRef = useRef<(() => Promise<void>) | null>(null);
  const loadSelectedThreadRef = useRef<((threadId: string) => Promise<void>) | null>(null);

  /* Derived */
  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );
  const agentsById = useMemo(() => {
    const map: Partial<Record<AgentId, AgentDescriptor>> = {};
    for (const descriptor of agentDescriptors) {
      map[descriptor.id] = descriptor;
    }
    return map;
  }, [agentDescriptors]);
  const availableAgentIds = useMemo(
    () => agentDescriptors.filter((descriptor) => descriptor.enabled).map((descriptor) => descriptor.id),
    [agentDescriptors]
  );
  const selectedAgentDescriptor = useMemo(
    () => agentsById[selectedAgentId] ?? null,
    [agentsById, selectedAgentId]
  );
  const appDefaultModel = configDefaults?.model ?? ASSUMED_APP_DEFAULT_MODEL;
  const appDefaultReasoningEffort = configDefaults?.reasoningEffort ?? ASSUMED_APP_DEFAULT_EFFORT;
  const selectedAgentLabel = selectedAgentDescriptor?.label ?? "Agent";
  const selectedAgentCapabilities = selectedAgentDescriptor?.capabilities ?? null;
  const groupedThreadsByProject = useMemo(() => groupThreadsByProject(threads), [threads]);
  const groupedArchivedThreadsByProject = useMemo(
    () => groupThreadsByProject(archivedThreads),
    [archivedThreads]
  );
  const activeProjectGroups = useMemo(
    () => groupedThreadsByProject.filter((group) => !group.isRemoved),
    [groupedThreadsByProject]
  );
  const removedProjectGroups = useMemo(
    () => groupedThreadsByProject.filter((group) => group.isRemoved),
    [groupedThreadsByProject]
  );
  const archivedProjectGroups = useMemo(
    () => mergeProjectGroups(groupedArchivedThreadsByProject, removedProjectGroups),
    [groupedArchivedThreadsByProject, removedProjectGroups]
  );
  const archivedThreadIds = useMemo(() => {
    const ids = new Set<string>();
    for (const thread of archivedThreads) {
      ids.add(thread.id);
    }
    return ids;
  }, [archivedThreads]);
  const archivedSectionThreadCount = useMemo(() => {
    const ids = new Set<string>();
    for (const group of archivedProjectGroups) {
      for (const thread of group.threads) {
        ids.add(thread.id);
      }
    }
    return ids.size;
  }, [archivedProjectGroups]);
  const conversationState = useMemo(() => {
    const liveConversationState = liveState?.conversationState ?? null;
    const readConversationState = readThreadState?.thread ?? null;
    if (!liveConversationState) return readConversationState;
    if (!readConversationState) return liveConversationState;
    const liveUpdatedAt = getConversationStateUpdatedAt(liveConversationState);
    const readUpdatedAt = getConversationStateUpdatedAt(readConversationState);
    return liveUpdatedAt > readUpdatedAt ? liveConversationState : readConversationState;
  }, [liveState?.conversationState, readThreadState?.thread]);

  const pendingRequests = useMemo(() => {
    if (!conversationState) return [] as PendingRequest[];
    return getPendingUserInputRequests(conversationState);
  }, [conversationState]);
  const liveStateReductionError = useMemo(() => {
    const errorState = liveState?.liveStateError;
    if (!errorState || errorState.kind !== "reductionFailed") {
      return null;
    }
    return errorState;
  }, [liveState?.liveStateError]);

  const activeRequest = useMemo(() => {
    if (!pendingRequests.length) return null;
    if (selectedRequestId === null) return pendingRequests[0];
    return pendingRequests.find((r) => r.id === selectedRequestId) ?? pendingRequests[0];
  }, [pendingRequests, selectedRequestId]);

  const activeThreadAgentId: AgentId = useMemo(
    () => selectedThread?.agentId ?? selectedAgentId,
    [selectedAgentId, selectedThread]
  );
  const activeAgentDescriptor = useMemo(
    () => agentsById[activeThreadAgentId] ?? selectedAgentDescriptor,
    [activeThreadAgentId, agentsById, selectedAgentDescriptor]
  );
  const activeAgentLabel = activeAgentDescriptor?.label ?? selectedAgentLabel;
  const activeAgentCapabilities = activeAgentDescriptor?.capabilities ?? selectedAgentCapabilities;
  const canSetCollaborationMode = Boolean(activeAgentCapabilities?.canSetCollaborationMode);
  const canListModels = Boolean(activeAgentCapabilities?.canListModels);
  const canListCollaborationModes = Boolean(activeAgentCapabilities?.canListCollaborationModes);
  const canSubmitUserInputForActiveAgent = Boolean(activeAgentCapabilities?.canSubmitUserInput);

  const planModeOption = useMemo(
    () => modes.find((mode) => isPlanModeOption(mode)) ?? null,
    [modes]
  );
  const defaultModeOption = useMemo(
    () => modes.find((mode) => !isPlanModeOption(mode)) ?? modes[0] ?? null,
    [modes]
  );
  const isPlanModeEnabled = planModeOption !== null && selectedModeKey === planModeOption.mode;

  const effortOptions = useMemo(() => {
    const vals = new Set<string>(DEFAULT_EFFORT_OPTIONS);
    for (const m of modes) if (m.reasoning_effort) vals.add(m.reasoning_effort);
    const le = conversationState?.latestReasoningEffort;
    if (le) vals.add(le);
    if (selectedReasoningEffort) vals.add(selectedReasoningEffort);
    return Array.from(vals);
  }, [conversationState?.latestReasoningEffort, modes, selectedReasoningEffort]);
  const effortOptionsWithoutAssumedDefault = useMemo(
    () => effortOptions.filter((option) => option !== appDefaultReasoningEffort),
    [appDefaultReasoningEffort, effortOptions]
  );

  const modelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of models) {
      const label =
        m.displayName && m.displayName !== m.id
          ? `${m.displayName} (${m.id})`
          : m.displayName || m.id;
      map.set(m.id, label);
    }
    const lm = conversationState?.latestModel;
    if (lm && !map.has(lm)) map.set(lm, lm);
    if (selectedModelId && !map.has(selectedModelId)) map.set(selectedModelId, selectedModelId);
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [conversationState?.latestModel, models, selectedModelId]);
  const modelOptionsWithoutAssumedDefault = useMemo(
    () => modelOptions.filter((option) => option.id !== appDefaultModel),
    [appDefaultModel, modelOptions]
  );

  const deferredConversationState = useDeferredValue(conversationState);
  const turns = deferredConversationState?.turns ?? [];
  const lastTurn = turns[turns.length - 1];
  const isGenerating = isTurnInProgressStatus(lastTurn?.status);
  const threadListState = isCoreLoading
    ? "loading"
    : threads.length === 0
      ? "empty"
      : "ready";
  const chatSurfaceState = !selectedThreadId && isCoreLoading
    ? "loading-threads"
    : selectedThreadId && isSelectedThreadLoading
      ? "loading-thread"
    : turns.length === 0
      ? selectedThreadId
        ? "no-messages"
        : "no-thread"
      : "ready";
  const errorBannerDetails = useMemo(() => toErrorBannerDetails(error), [error]);
  const flatConversationItems = useMemo(() => {
    const flattened: FlatConversationItem[] = [];
    let previousRenderedTurnIndex = -1;

    turns.forEach((turn, turnIndex) => {
      const items = turn.items ?? [];
      const isLastTurn = turnIndex === turns.length - 1;
      const turnInProgress = isLastTurn && isGenerating;

      items.forEach((item, itemIndexInTurn) => {
        if (!shouldRenderConversationItem(item)) {
          return;
        }
        const isFirstRenderedItem = flattened.length === 0;
        const startsNewTurn = previousRenderedTurnIndex !== turnIndex;
        const spacingTop = isFirstRenderedItem ? 0 : startsNewTurn ? 16 : 10;
        flattened.push({
          key: item.id ?? `${turnIndex}-${itemIndexInTurn}`,
          item,
          isLast: false,
          turnIsInProgress: turnInProgress,
          previousItemType: items[itemIndexInTurn - 1]?.type,
          nextItemType: items[itemIndexInTurn + 1]?.type,
          spacingTop
        });
        previousRenderedTurnIndex = turnIndex;
      });
    });

    if (flattened.length > 0) {
      flattened[flattened.length - 1]!.isLast = true;
    }

    return flattened;
  }, [isGenerating, turns]);
  const conversationItemCount = flatConversationItems.length;
  const firstVisibleChatItemIndex = Math.max(0, conversationItemCount - visibleChatItemLimit);
  const hasHiddenChatItems = firstVisibleChatItemIndex > 0;
  const visibleConversationItems = useMemo(
    () => flatConversationItems.slice(firstVisibleChatItemIndex),
    [flatConversationItems, firstVisibleChatItemIndex]
  );
  const commitLabel = health?.state.gitCommit ?? "unknown";
  const codexConfigured = agentsById.codex?.enabled === true;
  const openCodeConnected = agentsById.opencode?.connected === true;
  const allSystemsReady = codexConfigured
    ? (
      health?.state.appReady === true &&
      health?.state.ipcConnected === true &&
      health?.state.ipcInitialized === true
    )
    : openCodeConnected;
  const hasAnySystemFailure = codexConfigured
    ? (
      health?.state.appReady === false ||
      health?.state.ipcConnected === false ||
      health?.state.ipcInitialized === false
    )
    : !openCodeConnected;
  /* Data loading */
  const loadCoreData = useCallback(async () => {
    const [nh, nt, nm, nmo, ntr, nhist, nag, ncfg] = await Promise.all([
      getHealth(),
      listThreads({
        limit: THREAD_LIST_LIMIT,
        archived: false,
        all: true,
        maxPages: THREAD_LIST_MAX_PAGES,
        sortKey: "updated_at"
      }),
      listCollaborationModes(),
      listModels(),
      getTraceStatus(),
      listDebugHistory(120),
      listAgents().catch(() => null),
      getConfigDefaults({ agentId: "codex" }).catch(() => null)
    ]);
    let preferredAgentId: AgentId | null = null;
    const nextThreadsSignature = nt.data.map((thread) =>
      [
        thread.id,
        String(thread.updatedAt ?? 0),
        thread.preview,
        thread.agentId,
        thread.cwd ?? "",
        thread.path ?? ""
      ].join("|")
    );
    const nextModesSignature = nm.data.map((mode) =>
      [mode.mode, mode.name, mode.reasoning_effort ?? ""].join("|")
    );
    const nextModelsSignature = nmo.data.map((model) =>
      [model.id, model.displayName ?? ""].join("|")
    );

    startTransition(() => {
      setHealth((prev) => {
        if (
          prev &&
          prev.state.appReady === nh.state.appReady &&
          prev.state.ipcConnected === nh.state.ipcConnected &&
          prev.state.ipcInitialized === nh.state.ipcInitialized &&
          prev.state.gitCommit === nh.state.gitCommit &&
          prev.state.lastError === nh.state.lastError &&
          prev.state.historyCount === nh.state.historyCount &&
          prev.state.threadOwnerCount === nh.state.threadOwnerCount
        ) {
          return prev;
        }
        return nh;
      });
      if (!signaturesMatch(threadsSignatureRef.current, nextThreadsSignature)) {
        threadsSignatureRef.current = nextThreadsSignature;
        setThreads(nt.data);
      }
      if (!signaturesMatch(modesSignatureRef.current, nextModesSignature)) {
        modesSignatureRef.current = nextModesSignature;
        setModes(nm.data);
      }
      if (!signaturesMatch(modelsSignatureRef.current, nextModelsSignature)) {
        modelsSignatureRef.current = nextModelsSignature;
        setModels(nmo.data);
      }
      if (ncfg) {
        setConfigDefaults((prev) => {
          if (
            prev &&
            prev.agentId === ncfg.agentId &&
            prev.model === ncfg.model &&
            prev.reasoningEffort === ncfg.reasoningEffort
          ) {
            return prev;
          }
          return ncfg;
        });
      }
      setTraceStatus((prev) => {
        if (
          prev &&
          prev.active?.id === ntr.active?.id &&
          prev.active?.eventCount === ntr.active?.eventCount &&
          prev.recent.length === ntr.recent.length &&
          prev.recent[0]?.id === ntr.recent[0]?.id &&
          prev.recent[0]?.eventCount === ntr.recent[0]?.eventCount
        ) {
          return prev;
        }
        return ntr;
      });
      setHistory((prev) => {
        if (
          prev.length === nhist.history.length &&
          prev[prev.length - 1]?.id === nhist.history[nhist.history.length - 1]?.id
        ) {
          return prev;
        }
        return nhist.history;
      });
      if (nag) {
        setAgentDescriptors((prev) => {
          if (
            prev.length === nag.agents.length &&
            prev.every((agent, index) => {
              const nextAgent = nag.agents[index];
              if (!nextAgent) {
                return false;
              }
              return (
                agent.id === nextAgent.id &&
                agent.enabled === nextAgent.enabled &&
                agent.connected === nextAgent.connected
              );
            })
          ) {
            return prev;
          }
          return nag.agents;
        });
        const enabledAgents = nag.agents.filter((agent) => agent.enabled).map((agent) => agent.id);
        const nextDefaultAgent = enabledAgents.includes(nag.defaultAgentId)
          ? nag.defaultAgentId
          : (enabledAgents[0] ?? nag.defaultAgentId);
        preferredAgentId = nextDefaultAgent;
        setSelectedAgentId((cur) => {
          if (!hasHydratedAgentSelectionRef.current) {
            hasHydratedAgentSelectionRef.current = true;
            return nextDefaultAgent;
          }
          return enabledAgents.includes(cur) ? cur : nextDefaultAgent;
        });
      }
      setSelectedThreadId((cur) => {
        if (cur) return cur;
        if (preferredAgentId) {
          const preferredThread = nt.data.find((thread) => thread.agentId === preferredAgentId);
          if (preferredThread) {
            return preferredThread.id;
          }
        }
        return nt.data[0]?.id ?? null;
      });
      setSelectedModeKey((cur) => {
        if (cur) return cur;
        const nonPlanDefault = nm.data.find((mode) => !isPlanModeOption(mode));
        return nonPlanDefault?.mode ?? nm.data[0]?.mode ?? "";
      });
    });
  }, []);

  const loadArchivedThreads = useCallback(async () => {
    setIsArchivedThreadsLoading(true);
    try {
      const archived = await listThreads({
        limit: THREAD_LIST_LIMIT,
        archived: true,
        all: true,
        maxPages: ARCHIVED_THREAD_LIST_MAX_PAGES,
        sortKey: "updated_at"
      });

      const nextArchivedThreadsSignature = archived.data.map((thread) =>
        [
          thread.id,
          String(thread.updatedAt ?? 0),
          thread.preview,
          thread.agentId,
          thread.cwd ?? "",
          thread.path ?? ""
        ].join("|")
      );

      startTransition(() => {
        if (!signaturesMatch(archivedThreadsSignatureRef.current, nextArchivedThreadsSignature)) {
          archivedThreadsSignatureRef.current = nextArchivedThreadsSignature;
          setArchivedThreads(archived.data);
        }
        const isTruncated = (archived.truncated ?? false) || archived.nextCursor !== null;
        setArchivedThreadsTruncated(isTruncated);
        setHasLoadedArchivedThreads(true);
      });
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsArchivedThreadsLoading(false);
    }
  }, []);

  const loadCoreDataTracked = useCallback(async () => {
    await loadCoreData();
    if (isArchivedThreadsOpenRef.current || hasLoadedArchivedThreads) {
      await loadArchivedThreads();
    }
    lastCoreRefreshAtRef.current = Date.now();
  }, [hasLoadedArchivedThreads, loadArchivedThreads, loadCoreData]);

  const loadSelectedThread = useCallback(async (threadId: string) => {
    const includeTurns = !pendingMaterializationThreadIdsRef.current.has(threadId);
    const thread = threads.find((entry) => entry.id === threadId) ?? null;
    const threadAgentId = thread?.agentId ?? selectedAgentId;
    const descriptor = agentsById[threadAgentId];
    const canReadLiveState = descriptor?.capabilities.canReadLiveState ?? (threadAgentId === "codex");
    const canReadStreamEvents = descriptor?.capabilities.canReadStreamEvents ?? (threadAgentId === "codex");

    let includeTurnsForRead = includeTurns;
    let readRetryDelayMs = READ_THREAD_RETRY_BASE_DELAY_MS;
    const readThreadWithRetry = async (): Promise<ReadThreadResponse> => {
      for (let attempt = 0; attempt < READ_THREAD_RETRY_ATTEMPTS; attempt += 1) {
        try {
          return await readThread(threadId, { includeTurns: includeTurnsForRead });
        } catch (error) {
          const message = toErrorMessage(error);
          const canRetry = isTransientReadThreadError(message) && attempt < READ_THREAD_RETRY_ATTEMPTS - 1;
          if (!canRetry) {
            throw error;
          }
          includeTurnsForRead = true;
          await waitForMs(readRetryDelayMs);
          readRetryDelayMs = Math.min(readRetryDelayMs * 2, READ_THREAD_RETRY_MAX_DELAY_MS);
        }
      }

      throw new Error(`Failed to read thread after ${String(READ_THREAD_RETRY_ATTEMPTS)} attempts`);
    };

    const [live, stream, read] = await Promise.all([
      canReadLiveState
        ? getLiveState(threadId)
        : Promise.resolve({
            ok: true as const,
            threadId,
            ownerClientId: null,
            conversationState: null,
            liveStateError: null
          }),
      canReadStreamEvents
        ? getStreamEvents(threadId)
        : Promise.resolve({
            ok: true as const,
            threadId,
            ownerClientId: null,
            events: []
          }),
      readThreadWithRetry()
    ]);
    if ((live.conversationState?.turns.length ?? 0) > 0 || read.thread.turns.length > 0) {
      pendingMaterializationThreadIdsRef.current.delete(threadId);
    }
    startTransition(() => {
      setLiveState((prev) => {
        if (
          buildLiveStateSyncSignature(prev, appDefaultModel, appDefaultReasoningEffort)
          === buildLiveStateSyncSignature(live, appDefaultModel, appDefaultReasoningEffort)
        ) {
          return prev;
        }
        return live;
      });
      setReadThreadState((prev) => {
        if (
          buildReadThreadSyncSignature(prev, appDefaultModel, appDefaultReasoningEffort)
          === buildReadThreadSyncSignature(read, appDefaultModel, appDefaultReasoningEffort)
        ) {
          return prev;
        }
        return read;
      });
      setStreamEvents((prev) => {
        const prevLast = prev[prev.length - 1];
        const nextLast = stream.events[stream.events.length - 1];
        const prevLastSignature = prevLast ? JSON.stringify(prevLast) : "";
        const nextLastSignature = nextLast ? JSON.stringify(nextLast) : "";
        if (prev.length === stream.events.length && prevLastSignature === nextLastSignature) {
          return prev;
        }
        return stream.events;
      });
    });
  }, [agentsById, appDefaultModel, appDefaultReasoningEffort, selectedAgentId, threads]);

  const refreshAll = useCallback(async () => {
    setIsCoreLoading(true);
    try {
      await loadCoreDataTracked();
      if (selectedThreadIdRef.current) await loadSelectedThread(selectedThreadIdRef.current);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsCoreLoading(false);
    }
  }, [loadCoreDataTracked, loadSelectedThread]);

  useEffect(() => {
    loadCoreDataTrackedRef.current = loadCoreDataTracked;
  }, [loadCoreDataTracked]);

  useEffect(() => {
    loadSelectedThreadRef.current = loadSelectedThread;
  }, [loadSelectedThread]);

  const refreshPushClientState = useCallback(async () => {
    try {
      const nextState = await getPushClientState();
      setPushClientState(nextState);
    } catch {
      setPushClientState(UNSUPPORTED_PUSH_CLIENT_STATE);
    }
  }, []);

  const enablePushNotificationsFromToolbar = useCallback(async () => {
    setIsEnablingPushNotifications(true);
    try {
      await enablePushNotifications({
        privateMode: true
      });
      await refreshPushClientState();
    } catch (e) {
      setError(`push.enable: ${toErrorMessage(e)}`);
    } finally {
      setIsEnablingPushNotifications(false);
    }
  }, [refreshPushClientState]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    isArchivedThreadsOpenRef.current = isArchivedThreadsOpen;
  }, [isArchivedThreadsOpen]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseUiStateFromPath(window.location.pathname);
      setSelectedThreadId(next.threadId);
      setActiveTab(next.tab);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    const nextPath = buildPathFromUiState(selectedThreadId, activeTab);
    if (window.location.pathname === nextPath) return;
    window.history.replaceState(null, "", nextPath);
  }, [activeTab, selectedThreadId]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void refreshPushClientState();
  }, [refreshPushClientState]);

  useEffect(() => {
    if (!isArchivedThreadsOpen) {
      return;
    }
    void loadArchivedThreads();
  }, [isArchivedThreadsOpen, loadArchivedThreads]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void loadCoreDataTracked().catch((e) => setError(toErrorMessage(e)));
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadCoreDataTracked]);

  useEffect(() => {
    coreRefreshIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      if (
        eventsConnectedRef.current &&
        now - lastCoreRefreshAtRef.current < CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS
      ) {
        return;
      }
      void loadCoreDataTracked().catch((e) => setError(toErrorMessage(e)));
    }, CORE_REFRESH_INTERVAL_MS);
    return () => {
      if (coreRefreshIntervalRef.current) window.clearInterval(coreRefreshIntervalRef.current);
    };
  }, [loadCoreDataTracked]);

  useEffect(() => {
    selectedThreadLoadTokenRef.current += 1;
    const loadToken = selectedThreadLoadTokenRef.current;

    if (!selectedThreadId) {
      setLiveState(null);
      setReadThreadState(null);
      setStreamEvents([]);
      setIsSelectedThreadLoading(false);
      return;
    }

    setLiveState(null);
    setReadThreadState(null);
    setStreamEvents([]);
    setIsSelectedThreadLoading(true);

    void loadSelectedThread(selectedThreadId)
      .catch((e) => {
        const message = toErrorMessage(e);
        if (isThreadNotLoadedReadError(message)) {
          setSelectedThreadId(null);
          selectedThreadIdRef.current = null;
        }
        setError(message);
      })
      .finally(() => {
        if (selectedThreadLoadTokenRef.current !== loadToken) {
          return;
        }
        setIsSelectedThreadLoading(false);
      });
  }, [loadSelectedThread, selectedThreadId]);

  useEffect(() => {
    let disposed = false;
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectDelayMs = 1000;

    const scheduleRefresh = (refreshCore: boolean, refreshHistory: boolean, refreshSelectedThread: boolean) => {
      const previousFlags = pendingRefreshFlagsRef.current;
      pendingRefreshFlagsRef.current = {
        refreshCore: previousFlags.refreshCore || refreshCore,
        refreshHistory: previousFlags.refreshHistory || refreshHistory,
        refreshSelectedThread: previousFlags.refreshSelectedThread || refreshSelectedThread
      };

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        const flags = pendingRefreshFlagsRef.current;
        pendingRefreshFlagsRef.current = {
          refreshCore: false,
          refreshHistory: false,
          refreshSelectedThread: false
        };
        void (async () => {
          if (document.visibilityState !== "visible") {
            return;
          }
          try {
            const loadCoreDataFn = loadCoreDataTrackedRef.current;
            const loadSelectedThreadFn = loadSelectedThreadRef.current;
            if (flags.refreshCore) {
              if (loadCoreDataFn) {
                await loadCoreDataFn();
              }
            } else if (flags.refreshHistory && activeTabRef.current === "debug") {
              const nextHistory = await listDebugHistory(120);
              startTransition(() => {
                setHistory((prev) => {
                  if (
                    prev.length === nextHistory.history.length &&
                    prev[prev.length - 1]?.id === nextHistory.history[nextHistory.history.length - 1]?.id
                  ) {
                    return prev;
                  }
                  return nextHistory.history;
                });
              });
            }
            if (flags.refreshSelectedThread && selectedThreadIdRef.current && loadSelectedThreadFn) {
              await loadSelectedThreadFn(selectedThreadIdRef.current);
            }
          } catch (e) {
            setError(toErrorMessage(e));
          }
        })();
      }, 200);
    };

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== null) {
        return;
      }
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connectEvents();
      }, reconnectDelayMs);
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, 10_000);
    };

    const connectEvents = () => {
      if (disposed) {
        return;
      }

      source = new EventSource("/events");
      source.onopen = () => {
        eventsConnectedRef.current = true;
        reconnectDelayMs = 1000;
        scheduleRefresh(true, activeTabRef.current === "debug", Boolean(selectedThreadIdRef.current));
      };

      source.onmessage = (event: MessageEvent<string>) => {
        let refreshCore = false;
        const refreshHistory = activeTabRef.current === "debug";
        let refreshSelectedThread = false;

        try {
          const parsedEventResult = SseEventSchema.safeParse(JSON.parse(event.data));
          if (!parsedEventResult.success) {
            refreshCore = true;
          } else {
            const parsedEvent = parsedEventResult.data;
            if (parsedEvent.type === "state") {
              refreshCore = true;
            } else if (parsedEvent.type === "history") {
              if (parsedEvent.entry.source === "app" || parsedEvent.entry.source === "system") {
                refreshCore = true;
              }
              const eventThreadId = parsedEvent.entry.meta.threadId;
              if (
                eventThreadId &&
                selectedThreadIdRef.current &&
                eventThreadId === selectedThreadIdRef.current
              ) {
                refreshSelectedThread = true;
              }
            }
          }
        } catch {
          refreshCore = true;
        }

        scheduleRefresh(refreshCore, refreshHistory, refreshSelectedThread);
      };

      source.onerror = () => {
        eventsConnectedRef.current = false;
        if (source) {
          source.close();
          source = null;
        }
        scheduleReconnect();
      };
    };

    connectEvents();

    return () => {
      disposed = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      pendingRefreshFlagsRef.current = {
        refreshCore: false,
        refreshHistory: false,
        refreshSelectedThread: false
      };
      eventsConnectedRef.current = false;
      if (source) {
        source.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!activeRequest) {
      setSelectedRequestId(null);
      setAnswerDraft({});
      return;
    }
    setSelectedRequestId((cur) => cur ?? activeRequest.id);
    setAnswerDraft((prev) => {
      const next: Record<string, { option: string; freeform: string }> = {};
      for (const q of activeRequest.params.questions) {
        next[q.id] = prev[q.id] ?? { option: "", freeform: "" };
      }
      return next;
    });
  }, [activeRequest]);

  useEffect(() => {
    const cs = conversationState;
    if (!cs) return;
    const remoteSelection = readModeSelectionFromConversationState(
      cs,
      appDefaultModel,
      appDefaultReasoningEffort
    );
    const remoteModeKey = remoteSelection.modeKey || selectedModeKey || defaultModeOption?.mode || "";
    const remoteSignature = buildModeSignature(
      remoteModeKey,
      remoteSelection.modelId,
      remoteSelection.reasoningEffort
    );

    if (!hasHydratedModeFromLiveState) {
      if (remoteModeKey) setSelectedModeKey(remoteModeKey);
      setSelectedModelId(remoteSelection.modelId);
      setSelectedReasoningEffort(remoteSelection.reasoningEffort);
      lastAppliedModeSignatureRef.current = remoteSignature;
      setHasHydratedModeFromLiveState(true);
      return;
    }

    const localSignature = buildModeSignature(selectedModeKey, selectedModelId, selectedReasoningEffort);
    if (remoteSignature === localSignature) {
      lastAppliedModeSignatureRef.current = remoteSignature;
      if (isModeSyncing) {
        setIsModeSyncing(false);
      }
      return;
    }

    if (
      isModeSyncing &&
      localSignature === lastAppliedModeSignatureRef.current &&
      remoteSignature !== lastAppliedModeSignatureRef.current
    ) {
      return;
    }

    if (remoteSelection.modeKey) {
      setSelectedModeKey(remoteSelection.modeKey);
    } else if (!selectedModeKey && remoteModeKey) {
      setSelectedModeKey(remoteModeKey);
    }
    setSelectedModelId(remoteSelection.modelId);
    setSelectedReasoningEffort(remoteSelection.reasoningEffort);
    lastAppliedModeSignatureRef.current = remoteSignature;
    if (isModeSyncing) {
      setIsModeSyncing(false);
    }
  }, [
    appDefaultModel,
    appDefaultReasoningEffort,
    conversationState,
    defaultModeOption?.mode,
    hasHydratedModeFromLiveState,
    isModeSyncing,
    selectedModeKey,
    selectedModelId,
    selectedReasoningEffort
  ]);

  useEffect(() => {
    lastAppliedModeSignatureRef.current = "";
    setHasHydratedModeFromLiveState(false);
    setIsModeSyncing(false);
  }, [selectedThreadId]);

  useEffect(() => {
    isChatAtBottomRef.current = isChatAtBottom;
  }, [isChatAtBottom]);

  // Track whether chat view is at the bottom.
  useEffect(() => {
    if (activeTab !== "chat" || !scrollRef.current) {
      return;
    }

    const scroller = scrollRef.current;
    let rafId: number | null = null;

    const syncBottomState = () => {
      const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      const nextIsBottom = distanceFromBottom <= 48;
      if (nextIsBottom !== isChatAtBottomRef.current) {
        isChatAtBottomRef.current = nextIsBottom;
        setIsChatAtBottom(nextIsBottom);
      }
      rafId = null;
    };

    const handleScroll = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(syncBottomState);
    };

    syncBottomState();
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [activeTab, selectedThreadId]);

  // Keep chat pinned to bottom only if user is already at the bottom.
  useEffect(() => {
    if (activeTab === "chat" && isChatAtBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeTab, conversationItemCount]);

  // Keep bottom pinned when expanded/collapsed blocks change chat height.
  useEffect(() => {
    if (activeTab !== "chat" || !scrollRef.current || !chatContentRef.current) return;
    const scroller = scrollRef.current;
    const content = chatContentRef.current;
    let rafId: number | null = null;

    const observer = new ResizeObserver(() => {
      if (!isChatAtBottomRef.current) {
        return;
      }
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        scroller.scrollTop = scroller.scrollHeight;
        rafId = null;
      });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [activeTab, selectedThreadId]);

  // New thread selection starts at the bottom.
  useEffect(() => {
    if (activeTab !== "chat" || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    isChatAtBottomRef.current = true;
    setIsChatAtBottom(true);
    setVisibleChatItemLimit(INITIAL_VISIBLE_CHAT_ITEMS);
  }, [activeTab, selectedThreadId]);

  /* Actions */
  const submitMessage = useCallback(async (draft: string) => {
    if (!draft.trim()) return;

    setIsBusy(true);
    try {
      let threadId = selectedThreadId;

      // Auto-create a thread if none is selected.
      if (!threadId) {
        const created = await createThread({
          agentId: selectedAgentId
        });
        threadId = created.threadId;
        pendingMaterializationThreadIdsRef.current.add(threadId);
        setSelectedThreadId(threadId);
        selectedThreadIdRef.current = threadId;
      }

      await sendMessage({ threadId, text: draft });
      pendingMaterializationThreadIdsRef.current.delete(threadId);
      await refreshAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [refreshAll, selectedAgentId, selectedThreadId]);

  const applyModeDraft = useCallback(async (draft: {
    modeKey: string;
    modelId: string;
    reasoningEffort: string;
  }) => {
    if (!selectedThreadId) {
      return;
    }

    const mode = modes.find((entry) => entry.mode === draft.modeKey) ?? null;
    if (!mode || typeof mode.mode !== "string") {
      return;
    }

    const signature = buildModeSignature(draft.modeKey, draft.modelId, draft.reasoningEffort);
    if (!isModeSyncing && lastAppliedModeSignatureRef.current === signature) {
      return;
    }

    const previousSignature = lastAppliedModeSignatureRef.current;
    lastAppliedModeSignatureRef.current = signature;
    setIsModeSyncing(true);
    try {
      await setCollaborationMode({
        threadId: selectedThreadId,
        collaborationMode: {
          mode: mode.mode,
          settings: {
            model: draft.modelId || null,
            reasoning_effort: draft.reasoningEffort || null,
            developer_instructions: mode.developer_instructions ?? null
          }
        }
      });
      await loadSelectedThread(selectedThreadId);
    } catch (e) {
      lastAppliedModeSignatureRef.current = previousSignature;
      setError(toErrorMessage(e));
    } finally {
      setIsModeSyncing(false);
    }
  }, [isModeSyncing, loadSelectedThread, modes, selectedThreadId]);

  const submitPendingRequest = useCallback(async () => {
    if (!selectedThreadId || !activeRequest) return;
    const answers: Record<string, { answers: string[] }> = {};
    for (const q of activeRequest.params.questions) {
      const cur = answerDraft[q.id] ?? { option: "", freeform: "" };
      const text = cur.option || cur.freeform.trim();
      if (text) answers[q.id] = { answers: [text] };
    }
    setIsBusy(true);
    try {
      await submitUserInput({
        threadId: selectedThreadId,
        requestId: activeRequest.id,
        response: { answers }
      });
      await refreshAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [activeRequest, answerDraft, refreshAll, selectedThreadId]);

  const skipPendingRequest = useCallback(async () => {
    if (!selectedThreadId || !activeRequest) return;
    setIsBusy(true);
    try {
      await submitUserInput({
        threadId: selectedThreadId,
        requestId: activeRequest.id,
        response: { answers: {} }
      });
      await refreshAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [activeRequest, refreshAll, selectedThreadId]);

  const runInterrupt = useCallback(async () => {
    if (!selectedThreadId) return;
    setIsBusy(true);
    try {
      await interruptThread({ threadId: selectedThreadId });
      await refreshAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [refreshAll, selectedThreadId]);

  const loadHistoryDetail = useCallback(async (id: string) => {
    if (!id) { setHistoryDetail(null); return; }
    const detail = await getHistoryEntry(id);
    setHistoryDetail(detail);
  }, []);

  useEffect(() => {
    void loadHistoryDetail(selectedHistoryId).catch((e) => setError(toErrorMessage(e)));
  }, [loadHistoryDetail, selectedHistoryId]);

  const handleAnswerChange = useCallback(
    (questionId: string, field: "option" | "freeform", value: string) => {
      setAnswerDraft((prev) => ({
        ...prev,
        [questionId]: { ...(prev[questionId] ?? { option: "", freeform: "" }), [field]: value }
      }));
    },
    []
  );

  const createNewThread = useCallback(async (projectPath: string, agentId?: AgentId) => {
    const trimmedProjectPath = projectPath.trim();
    if (!trimmedProjectPath) {
      setError("Cannot create thread: missing project path");
      return;
    }
    setIsBusy(true);
    try {
      const created = await createThread({
        cwd: trimmedProjectPath,
        ...(agentId ? { agentId } : {})
      });
      pendingMaterializationThreadIdsRef.current.add(created.threadId);
      setSelectedThreadId(created.threadId);
      selectedThreadIdRef.current = created.threadId;
      setMobileSidebarOpen(false);
      await refreshAll();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [refreshAll]);

  const createThreadForSingleAgent = useCallback((projectPath: string) => {
    const onlyAgentId = availableAgentIds[0];
    if (!onlyAgentId) {
      setError("Cannot create thread: no enabled agent");
      return;
    }
    void createNewThread(projectPath, onlyAgentId);
  }, [availableAgentIds, createNewThread]);

  const runArchiveThread = useCallback(async (threadId: string) => {
    setIsBusy(true);
    try {
      const nextSelectedThreadId = selectedThreadIdRef.current === threadId
        ? (threads.find((thread) => thread.id !== threadId)?.id ?? null)
        : selectedThreadIdRef.current;
      await archiveThread(threadId);
      setSelectedThreadId(nextSelectedThreadId);
      selectedThreadIdRef.current = nextSelectedThreadId;
      await loadCoreDataTracked();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [loadCoreDataTracked, threads]);

  const runUnarchiveThread = useCallback(async (threadId: string) => {
    setIsBusy(true);
    try {
      await unarchiveThread(threadId);
      setSelectedThreadId(threadId);
      selectedThreadIdRef.current = threadId;
      setMobileSidebarOpen(false);
      await loadCoreDataTracked();
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsBusy(false);
    }
  }, [loadCoreDataTracked]);

  const renderSidebarContent = (viewport: "desktop" | "mobile"): React.JSX.Element => (
    <>
      <div className="relative z-20 h-14 shrink-0 px-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -bottom-3 bg-gradient-to-b from-sidebar from-58% via-sidebar/88 via-80% to-transparent to-100%"
        />
        <div className="relative z-10 flex items-center justify-between h-full">
          <span className="text-sm font-semibold">Farfield</span>
          <div className="flex items-center gap-1">
            {viewport === "desktop" && (
              <IconBtn
                onClick={() => setDesktopSidebarOpen(false)}
                title="Hide sidebar"
                testId="sidebar-toggle-close"
              >
                <PanelLeft size={15} />
              </IconBtn>
            )}
            {viewport === "mobile" && (
              <Button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                data-testid="sidebar-toggle-close"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          data-testid="thread-list-status"
          data-state={threadListState}
          className="h-full min-h-0 overflow-y-auto overflow-x-hidden py-2 pl-2 pr-0"
        >
          {threads.length === 0 && (
            <div data-testid="thread-list-empty" className="px-4 py-6 text-xs text-muted-foreground text-center space-y-3">
              {isCoreLoading ? (
                <div data-testid="thread-list-loading" className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Loading threads...</span>
                </div>
              ) : (
                <div>No threads</div>
              )}
              {availableAgentIds.length > 0 && (
                availableAgentIds.length === 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={isBusy}
                    onClick={() => {
                      const defaultProjectPath = selectedAgentDescriptor?.projectDirectories[0] ?? ".";
                      createThreadForSingleAgent(defaultProjectPath);
                    }}
                  >
                    <Plus size={13} className="mr-1.5" />
                    New {selectedAgentLabel} thread
                  </Button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={isBusy}
                      >
                        <Plus size={13} className="mr-1.5" />
                        New thread
                      </Button>
                    </DropdownMenuTrigger>
                        <DropdownMenuContent align="center" sideOffset={6}>
                      {availableAgentIds.map((agentId) => (
                        <DropdownMenuItem
                          key={agentId}
                          onSelect={() => {
                            const defaultProjectPath = agentsById[agentId]?.projectDirectories[0] ?? ".";
                            void createNewThread(defaultProjectPath, agentId);
                          }}
                        >
                          <span className="shrink-0 h-4 w-4 rounded-sm bg-muted/30 ring-1 ring-border/60 flex items-center justify-center overflow-hidden">
                            <AgentFavicon
                              agentId={agentId}
                              label={agentsById[agentId]?.label ?? "Agent"}
                              className="h-3.5 w-3.5"
                            />
                          </span>
                          New {agentsById[agentId]?.label ?? agentId} thread
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )
              )}
            </div>
          )}
          <div className="space-y-2 pr-2">
            <div className="space-y-1">
              <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/60 flex items-center justify-between">
                <span>Threads</span>
                <span>{String(threads.length)}</span>
              </div>
              {activeProjectGroups.length > 0 && (
                <div className="space-y-2">
                  {activeProjectGroups.map((group) => {
                    const hasSelectedThread = group.threads.some((thread) => thread.id === selectedThreadId);
                    const isCollapsed = hasSelectedThread ? false : Boolean(collapsedThreadProjectGroups[group.key]);
                    const groupProjectPath = group.projectPath ?? selectedAgentDescriptor?.projectDirectories[0] ?? ".";
                    const groupPreferredAgentId = group.threads.find((thread) =>
                      availableAgentIds.includes(thread.agentId)
                    )?.agentId ?? availableAgentIds[0] ?? null;
                    return (
                      <div key={group.key} className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            data-testid="thread-project-group-toggle"
                            data-project-key={group.key}
                            onClick={() =>
                              setCollapsedThreadProjectGroups((previous) => ({
                                ...previous,
                                [group.key]: !isCollapsed
                              }))
                            }
                            variant="ghost"
                            className="h-7 flex-1 justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          >
                            {isCollapsed ? (
                              <ChevronRight size={13} className="shrink-0" />
                            ) : (
                              <ChevronDown size={13} className="shrink-0" />
                            )}
                            <span className="flex-1 truncate" title={group.projectPath ?? "No project"}>
                              {group.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60">{String(group.threads.length)}</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                data-testid="thread-project-group-menu-trigger"
                                data-project-key={group.key}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                disabled={isBusy || groupPreferredAgentId === null}
                              >
                                <MoreHorizontal size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={6}>
                              <DropdownMenuItem
                                onSelect={() => {
                                  if (!groupPreferredAgentId) {
                                    setError("Cannot create thread: no enabled agent");
                                    return;
                                  }
                                  void createNewThread(groupProjectPath, groupPreferredAgentId);
                                }}
                                disabled={isBusy || groupPreferredAgentId === null}
                              >
                                <Plus size={13} />
                                New thread
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {!isCollapsed && (
                          <div className="space-y-1 pl-4">
                            {group.threads.map((thread) => {
                              const isSelected = thread.id === selectedThreadId;
                              const threadIsGenerating = isSelected && isGenerating;
                              const canArchive = thread.agentId === "codex";
                              return (
                                <div key={thread.id} className="flex items-stretch gap-1">
                                  <Button
                                    type="button"
                                    data-testid="thread-list-item"
                                    data-thread-id={thread.id}
                                    onClick={() => {
                                      setSelectedThreadId(thread.id);
                                      setMobileSidebarOpen(false);
                                    }}
                                    variant="ghost"
                                    className={`min-w-0 flex-1 h-auto flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13px] tracking-tight font-normal transition-colors ${
                                      isSelected
                                        ? "bg-muted/90 text-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                    }`}
                                  >
                                    <span className="min-w-0 flex-1 truncate leading-5">{threadLabel(thread)}</span>
                                    <span className="shrink-0 flex items-center gap-1.5">
                                      {threadIsGenerating && (
                                        <Loader2 size={11} className="animate-spin text-muted-foreground/70" />
                                      )}
                                      {thread.updatedAt && (
                                        <span className="text-[10px] text-muted-foreground/50">
                                          {formatDate(thread.updatedAt)}
                                        </span>
                                      )}
                                    </span>
                                  </Button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        data-testid="thread-row-menu-trigger"
                                        data-thread-id={thread.id}
                                        variant="ghost"
                                        size="icon"
                                        className={`h-auto min-h-[34px] w-7 shrink-0 rounded-lg ${
                                          isSelected
                                            ? "bg-muted/90 text-foreground hover:bg-muted"
                                            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                        }`}
                                        disabled={isBusy}
                                      >
                                        <MoreHorizontal size={13} />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" sideOffset={6}>
                                      <DropdownMenuItem
                                        onSelect={() => {
                                          if (!canArchive) {
                                            return;
                                          }
                                          void runArchiveThread(thread.id);
                                        }}
                                        disabled={isBusy || !canArchive}
                                      >
                                        <Archive size={13} />
                                        Archive thread
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-1 pt-1">
              <Button
                type="button"
                data-testid="archived-threads-toggle"
                onClick={() => setIsArchivedThreadsOpen((prev) => !prev)}
                variant="ghost"
                className="h-7 w-full justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              >
                {isArchivedThreadsOpen ? (
                  <ChevronDown size={13} className="shrink-0" />
                ) : (
                  <ChevronRight size={13} className="shrink-0" />
                )}
                <Archive size={13} className="shrink-0" />
                <span className="flex-1 truncate">Archived threads</span>
                {isArchivedThreadsLoading ? (
                  <Loader2 size={11} className="animate-spin text-muted-foreground/70" />
                ) : !hasLoadedArchivedThreads && archivedSectionThreadCount === 0 ? (
                  <span className="text-[10px] text-muted-foreground/60">—</span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">
                    {hasLoadedArchivedThreads && archivedThreadsTruncated
                      ? `${String(archivedSectionThreadCount)}+`
                      : String(archivedSectionThreadCount)}
                  </span>
                )}
              </Button>
              {isArchivedThreadsOpen && (
                <div data-testid="archived-thread-list" className="space-y-1 pl-4">
                  {isArchivedThreadsLoading && archivedProjectGroups.length === 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground/70">
                      <Loader2 size={11} className="animate-spin" />
                      <span>Loading archived threads...</span>
                    </div>
                  )}
                  {!isArchivedThreadsLoading && archivedProjectGroups.length === 0 && (
                    <div className="px-2 py-1 text-[11px] text-muted-foreground/70">
                      No archived threads
                    </div>
                  )}
                  {archivedProjectGroups.map((group) => {
                    const hasSelectedThread = group.threads.some((thread) => thread.id === selectedThreadId);
                    const isCollapsed = hasSelectedThread ? false : Boolean(collapsedArchivedProjectGroups[group.key]);
                    return (
                      <div key={group.key} className="space-y-1">
                        <Button
                          type="button"
                          data-testid="archived-project-group-toggle"
                          data-project-key={group.key}
                          onClick={() =>
                            setCollapsedArchivedProjectGroups((previous) => ({
                              ...previous,
                              [group.key]: !isCollapsed
                            }))
                          }
                          variant="ghost"
                          className="h-7 w-full justify-start gap-2 rounded-lg px-2 py-1 text-left text-[12px] tracking-tight font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        >
                          {isCollapsed ? (
                            <ChevronRight size={13} className="shrink-0" />
                          ) : (
                            <ChevronDown size={13} className="shrink-0" />
                          )}
                          <span className="flex-1 truncate" title={group.projectPath ?? "No project"}>
                            {group.label}
                          </span>
                          {group.isRemoved && (
                            <span className="rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                              Removed
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60">{String(group.threads.length)}</span>
                        </Button>
                        {!isCollapsed && (
                          <div className="space-y-1 pl-4">
                            {group.threads.map((thread) => {
                              const isArchivedThread = archivedThreadIds.has(thread.id);
                              const canUnarchive = isArchivedThread && thread.agentId === "codex";
                              return (
                                <div
                                  key={thread.id}
                                  data-testid="archived-thread-list-item"
                                  className="w-full min-w-0 rounded-xl border border-border/60 bg-muted/20 px-2 py-1.5 text-[12px] text-muted-foreground"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="min-w-0 flex-1 truncate">{threadLabel(thread)}</span>
                                    {thread.updatedAt && (
                                      <span className="shrink-0 text-[10px] text-muted-foreground/60">
                                        {formatDate(thread.updatedAt)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1.5 flex justify-end">
                                    {isArchivedThread ? (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-6 rounded-full px-2 text-[10px]"
                                        disabled={isBusy || !canUnarchive}
                                        onClick={() => {
                                          if (!canUnarchive) {
                                            return;
                                          }
                                          void runUnarchiveThread(thread.id);
                                        }}
                                        title={canUnarchive ? "Unarchive thread" : "Unarchive is not supported for this agent"}
                                      >
                                        Unarchive
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground/60">
                                        Project removed
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {archivedThreadsTruncated && (
                    <div
                      data-testid="archived-thread-list-truncated"
                      className="px-2 py-1 text-[10px] text-muted-foreground/70"
                    >
                      Showing latest archived threads only.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-20 shrink-0 p-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-3 bottom-0 bg-gradient-to-t from-sidebar from-58% via-sidebar/88 via-80% to-transparent to-100%"
        />
        <div className="relative z-10 flex items-center justify-between gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors cursor-default min-w-0">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    allSystemsReady
                      ? "bg-success"
                      : hasAnySystemFailure
                        ? "bg-danger"
                        : "bg-muted-foreground/40"
                  }`}
                />
                <span className="font-mono truncate">commit {commitLabel}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="space-y-1 text-xs">
              <div className="font-mono text-[11px]">commit {commitLabel}</div>
              {agentDescriptors
                .filter((descriptor) => descriptor.enabled)
                .map((descriptor) => (
                  <div key={descriptor.id}>
                    {descriptor.label}: {descriptor.connected ? "connected" : "disconnected"}
                  </div>
                ))}
              {codexConfigured ? (
                <>
                  <div>App: {health?.state.appReady ? "ok" : "not ready"}</div>
                  <div>IPC: {health?.state.ipcConnected ? "connected" : "disconnected"}</div>
                  <div>Init: {health?.state.ipcInitialized ? "ready" : "not ready"}</div>
                </>
              ) : null}
              {health?.state.lastError && (
                <div className="max-w-64 break-words text-destructive">
                  Error: {health.state.lastError}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href="https://github.com/achimala/farfield"
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <Github size={14} />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <TooltipProvider delayDuration={120}>
      <div data-testid="app-shell" className="app-shell flex bg-background text-foreground font-sans">

      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            data-testid="sidebar-backdrop"
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <AnimatePresence initial={false}>
        {desktopSidebarOpen && (
          <motion.aside
            key="desktop-sidebar"
            initial={{ x: -280, opacity: 0.94 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
            data-testid="sidebar-desktop"
            className="hidden md:flex fixed left-0 top-0 bottom-0 z-30 w-64 flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
          >
            {renderSidebarContent("desktop")}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence initial={false}>
        {mobileSidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.7 }}
            data-testid="sidebar-mobile"
            className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col border-r border-sidebar-border bg-sidebar shadow-xl"
          >
            {renderSidebarContent("mobile")}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area ───────────────────────────────────────── */}
      <div
        className={`relative flex-1 flex flex-col min-w-0 transition-[margin] duration-200 ${
          desktopSidebarOpen ? "md:ml-64" : "md:ml-0"
        } h-full`}
      >

        {/* Header */}
        <header
          className={`flex items-center justify-between px-3 h-14 shrink-0 gap-2 ${
            activeTab === "chat"
              ? "absolute inset-x-0 top-0 z-20 bg-transparent"
              : "border-b border-border"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="md:hidden">
              <IconBtn
                onClick={() => setMobileSidebarOpen(true)}
                title="Threads"
                testId="sidebar-toggle-open"
              >
                <Menu size={15} />
              </IconBtn>
            </div>
            {!desktopSidebarOpen && (
              <div className="hidden md:block">
                <IconBtn
                  onClick={() => setDesktopSidebarOpen(true)}
                  title="Show sidebar"
                  testId="sidebar-toggle-open"
                >
                  <PanelLeft size={15} />
                </IconBtn>
              </div>
            )}
            <div className="min-w-0">
              <div data-testid="selected-thread-label" className="text-sm font-medium truncate leading-5 flex items-center gap-1.5">
                {selectedThread
                  ? threadLabel(selectedThread)
                  : selectedThreadId && isSelectedThreadLoading
                    ? "Loading thread..."
                    : "No thread selected"}
                {selectedThread && activeAgentLabel && (
                  <span className="shrink-0 h-5 w-5 rounded-md bg-muted/30 ring-1 ring-border/60 flex items-center justify-center overflow-hidden">
                    <AgentFavicon
                      agentId={activeThreadAgentId}
                      label={activeAgentLabel}
                      className="h-4 w-4"
                    />
                  </span>
                )}
              </div>
              {isGenerating && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 size={9} className="animate-spin" />
                  <span>generating</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {pushClientState.supported && (
              <IconBtn
                onClick={() => void enablePushNotificationsFromToolbar()}
                disabled={
                  isEnablingPushNotifications ||
                  pushClientState.subscribed ||
                  pushClientState.permission === "denied"
                }
                active={pushClientState.subscribed}
                title={
                  pushClientState.subscribed
                    ? "Notifications enabled"
                    : pushClientState.permission === "denied"
                      ? "Notifications blocked by browser settings"
                      : "Enable notifications"
                }
                testId="enable-notifications-button"
              >
                {isEnablingPushNotifications ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Bell size={14} />
                )}
              </IconBtn>
            )}
            <IconBtn
              onClick={() => void refreshAll()}
              disabled={isBusy}
              title="Refresh"
              testId="refresh-button"
            >
              <RefreshCcw size={14} className={isBusy ? "animate-spin" : ""} />
            </IconBtn>
            <IconBtn
              onClick={() => setActiveTab(activeTab === "debug" ? "chat" : "debug")}
              active={activeTab === "debug"}
              title="Debug"
              testId="tab-debug"
            >
              <Bug size={14} />
            </IconBtn>
            <IconBtn onClick={toggleTheme} title="Toggle theme">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </IconBtn>
          </div>
        </header>

        {/* Error bar */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              data-testid="error-banner"
              className="relative z-30 overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  {errorBannerDetails.operation.length > 0 && (
                    <span data-testid="error-banner-operation" className="shrink-0 font-semibold">
                      {errorBannerDetails.operation}:
                    </span>
                  )}
                  <span data-testid="error-banner-message" className="truncate">
                    {errorBannerDetails.message}
                  </span>
                  {errorBannerDetails.requestId && (
                    <span data-testid="error-banner-request-id" className="hidden">
                      request {errorBannerDetails.requestId}
                    </span>
                  )}
                  {errorBannerDetails.errorId && (
                    <span data-testid="error-banner-error-id" className="hidden">
                      error {errorBannerDetails.errorId}
                    </span>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    data-testid="error-banner-open-debug"
                    onClick={() => setActiveTab("debug")}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive/90 hover:text-destructive"
                  >
                    Open in Debug
                  </Button>
                  <Button
                    type="button"
                    data-testid="error-banner-dismiss"
                    onClick={() => setError("")}
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                  >
                    <X size={13} />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {liveStateReductionError && activeTab === "chat" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative z-30 overflow-hidden shrink-0"
            >
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-sm text-amber-200">
                Live updates failed for this thread. Showing saved messages only.
                {liveStateReductionError.eventIndex !== null && (
                  <span className="ml-2 text-xs text-amber-300/90">
                    event {liveStateReductionError.eventIndex}
                  </span>
                )}
                {liveStateReductionError.patchIndex !== null && (
                  <span className="ml-1 text-xs text-amber-300/90">
                    patch {liveStateReductionError.patchIndex}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chat tab ──────────────────────────────────────── */}
        {activeTab === "chat" && (
          <div data-testid="chat-surface" data-state={chatSurfaceState} className="relative flex-1 flex flex-col min-h-0">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-4 z-10 h-[5.5rem] bg-gradient-to-b from-background from-52% via-background/78 via-82% to-transparent to-100%"
            />

            {/* Conversation */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={selectedThreadId ?? "__no_thread__"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.14, ease: "easeOut" }}
                  className="w-full px-4 md:px-6 lg:px-8 pt-8 pb-6"
                >
                  {turns.length === 0 ? (
                    <div data-testid="chat-empty-state" className="text-center py-20 text-sm text-muted-foreground">
                      {!selectedThreadId && isCoreLoading
                        ? (
                          <span data-testid="chat-empty-loading-threads" className="inline-flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            Loading threads...
                          </span>
                        )
                        : selectedThreadId && isSelectedThreadLoading
                          ? (
                            <span data-testid="chat-empty-loading-thread" className="inline-flex items-center gap-2">
                              <Loader2 size={14} className="animate-spin" />
                              Loading thread...
                            </span>
                          )
                        : selectedThreadId
                        ? <span data-testid="chat-empty-no-messages">No messages yet</span>
                        : availableAgentIds.length > 0
                          ? <span data-testid="chat-empty-no-thread">Start typing to create a new thread</span>
                          : <span data-testid="chat-empty-no-thread">Select a thread from the sidebar</span>}
                    </div>
                  ) : (
                    <div ref={chatContentRef} className="space-y-0">
                      {hasHiddenChatItems && (
                        <div className="flex justify-center pb-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              setVisibleChatItemLimit((limit) =>
                                Math.min(conversationItemCount, limit + VISIBLE_CHAT_ITEMS_STEP)
                              );
                            }}
                          >
                            Show older messages ({firstVisibleChatItemIndex})
                          </Button>
                        </div>
                      )}
                      {visibleConversationItems.map((entry) => (
                        <div key={entry.key} style={{ paddingTop: `${entry.spacingTop}px` }}>
                          <ConversationItem
                            item={entry.item}
                            isLast={entry.isLast}
                            turnIsInProgress={entry.turnIsInProgress}
                            previousItemType={entry.previousItemType}
                            nextItemType={entry.nextItemType}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {!isChatAtBottom && turns.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                  className="absolute left-1/2 -translate-x-1/2 bottom-[7.25rem] md:bottom-[7.75rem] z-20"
                >
                  <Button
                    type="button"
                    onClick={() => {
                      if (!scrollRef.current) return;
                      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                      setIsChatAtBottom(true);
                    }}
                    size="icon"
                    className="h-10 w-10 rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted"
                  >
                    <ArrowDown size={16} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="relative z-10 -mt-6 px-4 pt-6 pb-4 shrink-0">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-transparent via-background/85 to-background"
              />
              <div className="relative w-full px-0 md:px-2 lg:px-4 space-y-2">

                {/* Pending user input */}
                <AnimatePresence>
                  {activeRequest && canSubmitUserInputForActiveAgent && (
                    <PendingRequestCard
                      request={activeRequest}
                      answerDraft={answerDraft}
                      onDraftChange={handleAnswerChange}
                      onSubmit={() => void submitPendingRequest()}
                      onSkip={() => void skipPendingRequest()}
                      isBusy={isBusy}
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="px-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Loader2 size={11} className="animate-spin" />
                      <span className="reasoning-shimmer font-medium">Thinking…</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Composer */}
                <div className="flex flex-col gap-2">
                  <ChatComposer
                    canSend={Boolean(selectedThreadId) || availableAgentIds.length > 0}
                    isBusy={isBusy}
                    isGenerating={isGenerating}
                    placeholder={
                      selectedThreadId
                        ? `Message ${activeAgentLabel}…`
                        : `Message ${selectedAgentLabel}…`
                    }
                    onInterrupt={runInterrupt}
                    onSend={submitMessage}
                  />

                  {/* Toolbar */}
                  <div className="flex items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden whitespace-nowrap">
                    {canSetCollaborationMode && canListCollaborationModes && (
                      <Button
                        type="button"
                        onClick={() => {
                          if (!planModeOption) return;
                          const nextModeKey = isPlanModeEnabled
                            ? (defaultModeOption?.mode ?? selectedModeKey)
                            : planModeOption.mode;
                          if (!nextModeKey) return;
                          setSelectedModeKey(nextModeKey);
                          void applyModeDraft({
                            modeKey: nextModeKey,
                            modelId: selectedModelId,
                            reasoningEffort: selectedReasoningEffort
                          });
                        }}
                        variant="ghost"
                        size="sm"
                        className={`h-8 shrink-0 rounded-full px-2 text-xs ${
                          isPlanModeEnabled
                            ? "bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 dark:text-blue-300"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                        disabled={!selectedThreadId || !planModeOption}
                      >
                        {isPlanModeEnabled ? <CircleDot size={10} /> : <Circle size={10} />}
                        Plan
                      </Button>
                    )}
                    {canSetCollaborationMode && canListModels && (
                      <Select
                        value={selectedModelId || APP_DEFAULT_VALUE}
                        onValueChange={(value) => {
                          const nextModelId = value === APP_DEFAULT_VALUE ? "" : value;
                          setSelectedModelId(nextModelId);
                          void applyModeDraft({
                            modeKey: selectedModeKey,
                            modelId: nextModelId,
                            reasoningEffort: selectedReasoningEffort
                          });
                        }}
                        disabled={!selectedThreadId || !selectedModeKey}
                      >
                        <SelectTrigger className="h-8 w-[132px] sm:w-[176px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0">
                          <SelectValue placeholder="Model" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value={APP_DEFAULT_VALUE}>{appDefaultModel}</SelectItem>
                          {modelOptionsWithoutAssumedDefault.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {canSetCollaborationMode && canListCollaborationModes && (
                      <Select
                        value={selectedReasoningEffort || APP_DEFAULT_VALUE}
                        onValueChange={(value) => {
                          const nextReasoningEffort = value === APP_DEFAULT_VALUE ? "" : value;
                          setSelectedReasoningEffort(nextReasoningEffort);
                          void applyModeDraft({
                            modeKey: selectedModeKey,
                            modelId: selectedModelId,
                            reasoningEffort: nextReasoningEffort
                          });
                        }}
                        disabled={!selectedThreadId || !selectedModeKey}
                      >
                        <SelectTrigger className="h-8 w-[104px] sm:w-[148px] shrink-0 rounded-full border-0 bg-transparent dark:bg-transparent px-2 text-xs text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0">
                          <SelectValue placeholder="Effort" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          <SelectItem value={APP_DEFAULT_VALUE}>{appDefaultReasoningEffort}</SelectItem>
                          {effortOptionsWithoutAssumedDefault.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {canSetCollaborationMode && (
                      <span
                        className={`inline-flex w-3 items-center justify-center text-xs text-muted-foreground transition-opacity ${
                          isModeSyncing ? "opacity-100" : "opacity-0"
                        }`}
                      >
                        <Loader2 size={10} className={isModeSyncing ? "animate-spin" : ""} />
                      </span>
                    )}
                    {pendingRequests.length > 0 && (
                      <span className="shrink-0 text-xs text-amber-500 dark:text-amber-400">
                        {pendingRequests.length} pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Debug tab ─────────────────────────────────────── */}
        {activeTab === "debug" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_300px] min-h-0 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">

              {/* Left: History */}
              <div data-testid="debug-history-panel" className="flex flex-col min-h-0 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                  <Activity size={13} className="text-muted-foreground" />
                  <span className="text-sm font-medium">History</span>
                  <span className="text-xs text-muted-foreground/60">{history.length} entries</span>
                </div>

                <div className="flex-1 grid grid-cols-[200px_minmax(0,1fr)] min-h-0 divide-x divide-border overflow-hidden">
                  {/* Entry list */}
                  <div className="overflow-y-auto py-1">
                    {history
                      .slice()
                      .reverse()
                      .map((entry) => (
                        <Button
                          key={entry.id}
                          type="button"
                          onClick={() => setSelectedHistoryId(entry.id)}
                          variant="ghost"
                          className={`w-full h-auto flex-col items-start justify-start gap-0 rounded-none px-3 py-2 text-left transition-colors ${
                            selectedHistoryId === entry.id
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase leading-4 ${
                                entry.direction === "in"
                                  ? "bg-success/15 text-success"
                                  : entry.direction === "out"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {entry.source} {entry.direction}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/50 font-mono truncate">
                            {entry.at}
                          </div>
                        </Button>
                      ))}
                  </div>

                  {/* Payload detail */}
                  <div className="overflow-y-auto p-3 space-y-3">
                    {!historyDetail ? (
                      <div className="text-xs text-muted-foreground py-4">Select an entry</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor="wait-for-replay-response"
                            className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground cursor-pointer"
                          >
                            <Checkbox
                              id="wait-for-replay-response"
                              checked={waitForReplayResponse}
                              onCheckedChange={(checked) =>
                                setWaitForReplayResponse(checked === true)
                              }
                            />
                            wait for response
                          </Label>
                          <Button
                            type="button"
                            onClick={() =>
                              void replayHistoryEntry({
                                entryId: historyDetail.entry.id,
                                waitForResponse: waitForReplayResponse
                              }).then(refreshAll)
                            }
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                          >
                            Replay
                          </Button>
                        </div>
                        <pre className="font-mono text-[11px] text-muted-foreground leading-5 whitespace-pre-wrap break-words">
                          {JSON.stringify(historyDetail.fullPayload, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Trace + Stream Events */}
              <div data-testid="debug-stream-panel" className="flex flex-col min-h-0 overflow-hidden divide-y divide-border">

                {/* Trace controls */}
                <div data-testid="debug-trace-panel" className="p-4 space-y-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Trace</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        traceStatus?.active
                          ? "bg-success/15 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {traceStatus?.active ? "recording" : "idle"}
                    </span>
                  </div>
                  <Input
                    value={traceLabel}
                    onChange={(e) => setTraceLabel(e.target.value)}
                    placeholder="label"
                    className="h-7 text-base md:text-xs"
                  />
                  <Input
                    value={traceNote}
                    onChange={(e) => setTraceNote(e.target.value)}
                    placeholder="marker note"
                    className="h-7 text-base md:text-xs"
                  />
                  <div className="flex gap-1.5">
                    {(["Start", "Mark", "Stop"] as const).map((btn) => (
                      <Button
                        key={btn}
                        type="button"
                        onClick={() => {
                          const action =
                            btn === "Start"
                              ? startTrace(traceLabel)
                              : btn === "Mark"
                              ? markTrace(traceNote)
                              : stopTrace();
                          void action.then(refreshAll);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                      >
                        {btn}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Stream events */}
                <div data-testid="debug-stream-events-panel" className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
                    <span className="text-xs font-medium">Stream Events</span>
                    <span className="text-xs text-muted-foreground/60">{streamEvents.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    {streamEvents
                      .slice()
                      .reverse()
                      .map((evt, i) => (
                        <StreamEventCard key={i} event={evt} />
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </TooltipProvider>
  );
}

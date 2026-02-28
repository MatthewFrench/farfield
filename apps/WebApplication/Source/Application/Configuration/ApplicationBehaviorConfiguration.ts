import { z } from "zod";
import { type PushClientState } from "@/Features/PushNotifications/DomainModel/PushClientContracts";

const DEFAULT_THREAD_LIST_MAXIMUM_PAGES = 20;

export const DEFAULT_EFFORT_OPTIONS = ["minimal", "low", "medium", "high", "xhigh"] as const;
export const INITIAL_VISIBLE_CHAT_ITEMS = 90;
export const VISIBLE_CHAT_ITEMS_STEP = 80;
export const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 48;
export const CORE_REFRESH_INTERVAL_MS = 5_000;
export const CORE_REFRESH_CONNECTED_MIN_INTERVAL_MS = 60_000;
export const CAPABILITY_REFRESH_INTERVAL_MS = 5 * 60_000;
export const THREAD_ONLY_HISTORY_METHOD_NAMES = [
  "thread-stream-state-changed",
  "thread-queued-followups-changed",
] as const;
export const READ_THREAD_RETRY_ATTEMPTS = 6;
export const READ_THREAD_RETRY_BASE_DELAY_MS = 140;
export const READ_THREAD_RETRY_MAX_DELAY_MS = 1_000;
export const APP_DEFAULT_VALUE = "__app_default__";
export const ASSUMED_APP_DEFAULT_MODEL_IDENTIFIER = "gpt-5.3-codex";
export const ASSUMED_APP_DEFAULT_REASONING_EFFORT = "medium";
export const DEBUG_HISTORY_LIMIT = 120;
export const DEBUG_ERROR_LIST_LIMIT = 240;
export const THREAD_LIST_LIMIT = 80;
export const THREAD_LIST_MAX_PAGES = DEFAULT_THREAD_LIST_MAXIMUM_PAGES;
export const ARCHIVED_THREAD_LIST_MAX_PAGES = DEFAULT_THREAD_LIST_MAXIMUM_PAGES;
export const THREAD_QUERY_CACHE_TIME_TO_LIVE_MS = 1_500;
export const THREAD_QUERY_CACHE_MAXIMUM_ENTRIES = 16;
export const EVENT_REFRESH_SCHEDULE_DELAY_MS = 200;

const EventStreamRefreshDecisionExecutionModeSchema = z.enum(["worker", "in-thread"]);
const defaultEventStreamRefreshDecisionExecutionMode =
  import.meta.env.MODE === "test" ? "in-thread" : "worker";
export const EVENT_STREAM_REFRESH_DECISION_EXECUTION_MODE =
  EventStreamRefreshDecisionExecutionModeSchema.parse(
    defaultEventStreamRefreshDecisionExecutionMode,
  );

const DerivedComputationExecutionModeSchema = z.enum(["worker", "in-thread"]);
const defaultDerivedComputationExecutionMode =
  import.meta.env.MODE === "test" ? "in-thread" : "worker";

export const THREAD_LIST_PRESENTATION_EXECUTION_MODE = DerivedComputationExecutionModeSchema.parse(
  defaultDerivedComputationExecutionMode,
);
export const DEBUG_ISSUE_DERIVATION_EXECUTION_MODE = DerivedComputationExecutionModeSchema.parse(
  defaultDerivedComputationExecutionMode,
);
export const CONVERSATION_ITEM_FLATTENING_EXECUTION_MODE =
  DerivedComputationExecutionModeSchema.parse(defaultDerivedComputationExecutionMode);

export const MOBILE_LAYOUT_MAXIMUM_WIDTH_PX = 768;
export const MOBILE_SIDEBAR_SWIPE_EDGE_PX = 32;
export const MOBILE_SIDEBAR_SWIPE_TRIGGER_PX = 56;
export const MOBILE_SIDEBAR_SWIPE_MAXIMUM_VERTICAL_DRIFT_PX = 36;
export const MOBILE_SIDEBAR_SWIPE_CANCEL_NEGATIVE_PX = -14;
export const MOBILE_VISUAL_VIEWPORT_KEYBOARD_OPEN_DELTA_PX = 120;

export const UNSUPPORTED_PUSH_CLIENT_STATE: PushClientState = {
  supported: false,
  serviceWorkerRegistered: false,
  permission: "unsupported",
  subscribed: false,
};

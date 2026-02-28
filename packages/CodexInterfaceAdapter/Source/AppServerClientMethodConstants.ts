/**
 * Owns app-server RPC method literals used by AppServerClient transport requests.
 */
export const APP_SERVER_CLIENT_METHODS = {
  listThreads: "thread/list",
  forkThread: "thread/fork",
  readThread: "thread/read",
  listModels: "model/list",
  listCollaborationModes: "collaborationMode/list",
  readConfig: "config/read",
  startThread: "thread/start",
  setThreadName: "thread/name/set",
  rollbackThread: "thread/rollback",
  startReview: "review/start",
  startTurn: "turn/start",
  steerTurn: "turn/steer",
  interruptTurn: "turn/interrupt",
  resumeThread: "thread/resume",
  archiveThread: "thread/archive",
  unarchiveThread: "thread/unarchive",
} as const;

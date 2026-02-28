/**
 * Owns app-server RPC method literals used by AppServerClient transport requests.
 */
export const APP_SERVER_CLIENT_METHODS = {
  listThreads: "thread/list",
  listLoadedThreads: "thread/loaded/list",
  forkThread: "thread/fork",
  readThread: "thread/read",
  listModels: "model/list",
  listCollaborationModes: "collaborationMode/list",
  readConfig: "config/read",
  startThread: "thread/start",
  setThreadName: "thread/name/set",
  rollbackThread: "thread/rollback",
  compactThread: "thread/compact/start",
  cleanThreadBackgroundTerminals: "thread/backgroundTerminals/clean",
  startReview: "review/start",
  startTurn: "turn/start",
  steerTurn: "turn/steer",
  interruptTurn: "turn/interrupt",
  resumeThread: "thread/resume",
  unsubscribeThread: "thread/unsubscribe",
  archiveThread: "thread/archive",
  unarchiveThread: "thread/unarchive",
} as const;

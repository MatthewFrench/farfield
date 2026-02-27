/**
 * Owns app-server RPC method literals used by AppServerClient transport requests.
 */
export const APP_SERVER_CLIENT_METHODS = {
  listThreads: "thread/list",
  readThread: "thread/read",
  listModels: "model/list",
  listCollaborationModes: "collaborationMode/list",
  readConfig: "config/read",
  startThread: "thread/start",
  startTurn: "turn/start",
  resumeThread: "thread/resume",
  archiveThread: "thread/archive",
  unarchiveThread: "thread/unarchive",
} as const;

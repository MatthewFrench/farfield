/**
 * Owns app-server server-request method literals that Farfield explicitly handles.
 * Methods not listed here receive deterministic JSON-RPC method-not-found responses.
 */
export const APP_SERVER_HANDLED_SERVER_REQUEST_METHODS = {
  commandExecutionRequestApproval: "item/commandExecution/requestApproval",
  fileChangeRequestApproval: "item/fileChange/requestApproval",
  toolRequestUserInput: "item/tool/requestUserInput",
  toolCall: "item/tool/call",
  chatGptAuthTokensRefresh: "account/chatgptAuthTokens/refresh",
  applyPatchApproval: "applyPatchApproval",
  executeCommandApproval: "execCommandApproval",
} as const;

const HandledServerRequestMethodSet: ReadonlySet<string> = new Set(
  Object.values(APP_SERVER_HANDLED_SERVER_REQUEST_METHODS),
);

export type AppServerHandledServerRequestMethod =
  (typeof APP_SERVER_HANDLED_SERVER_REQUEST_METHODS)[keyof typeof APP_SERVER_HANDLED_SERVER_REQUEST_METHODS];

export function isHandledAppServerServerRequestMethod(
  method: string,
): method is AppServerHandledServerRequestMethod {
  return HandledServerRequestMethodSet.has(method);
}

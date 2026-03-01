# App-Server Event Surface Decision Ledger

Last Updated (UTC): 2026-03-01 09:36:18Z

This ledger records recommended disposition for upstream app-server event and callback surfaces.
Farfield now exposes raw notification-event cursors in debug coverage diagnostics (`/api/notifications/events`) and dedicated auth/server-request/fuzzy-session/model-reroute/warning diagnostics for `account/login/completed`, `mcpServer/oauthLogin/completed`, `serverRequest/resolved`, `fuzzyFileSearch/sessionUpdated`, `fuzzyFileSearch/sessionCompleted`, `model/rerouted`, `configWarning`, `deprecationNotice`, and `windows/worldWritableWarning`; per-method product workflows below remain tracked independently.

| Method | Surface Type | Current Farfield State | Recommendation | Notes |
| --- | --- | --- | --- | --- |
| `account/login/completed` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated auth-completion diagnostics surface validates account-login completion state and error messaging. |
| `account/rateLimits/updated` | server-to-client notification | Not consumed | Not now | Adopt with explicit product requirement. |
| `account/updated` | server-to-client notification | Not consumed | Not now | Adopt with explicit product requirement. |
| `app/list/updated` | server-to-client notification | Not consumed | Not now | Adopt with explicit product requirement. |
| `authStatusChange` | server-to-client notification | Not consumed | Do not adopt | Deprecated notification surface. |
| `configWarning` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated warning diagnostics surface validates summary/details/path/range payload mapping. |
| `deprecationNotice` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated warning diagnostics surface validates deprecation summary/details payload mapping. |
| `error` | server-to-client notification | Not consumed | Plan candidate | Useful for direct app-server failure visibility when app-server notifications are consumed. |
| `fuzzyFileSearch/sessionCompleted` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated fuzzy-session diagnostics surface validates asynchronous session-completion notifications and cursor behavior. |
| `fuzzyFileSearch/sessionUpdated` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated fuzzy-session diagnostics surface validates session-update notifications and result-count projection. |
| `item/agentMessage/delta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/commandExecution/outputDelta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/commandExecution/terminalInteraction` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/completed` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/fileChange/outputDelta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/mcpToolCall/progress` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/plan/delta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/reasoning/summaryPartAdded` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/reasoning/summaryTextDelta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/reasoning/textDelta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `item/started` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `loginChatGptComplete` | server-to-client notification | Not consumed | Do not adopt | Deprecated notification surface. |
| `mcpServer/oauthLogin/completed` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated auth-completion diagnostics surface validates MCP OAuth completion state and error messaging. |
| `model/rerouted` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated model-reroute diagnostics surface validates model-switch notifications and reroute reasons. |
| `rawResponseItem/completed` | server-to-client notification | Not consumed | Not now | Adopt with explicit product requirement. |
| `serverRequest/resolved` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated server-request resolved diagnostics surface validates request completion signals and complements pending-request snapshots (`/api/server-requests/pending`). |
| `sessionConfigured` | server-to-client notification | Not consumed | Do not adopt | Deprecated notification surface. |
| `thread/archived` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/closed` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/compacted` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/name/updated` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/realtime/closed` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/realtime/error` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/realtime/itemAdded` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/realtime/outputAudio/delta` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/realtime/started` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/started` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/status/changed` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/tokenUsage/updated` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `thread/unarchived` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `turn/completed` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `turn/diff/updated` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `turn/plan/updated` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `turn/started` | server-to-client notification | Not consumed | Plan candidate | Useful if app-server path should provide live streamed progress in product surfaces. |
| `windows/worldWritableWarning` | server-to-client notification | Consumed in debug coverage diagnostics | Keep for diagnostics | Dedicated warning diagnostics surface validates sampled-path and scan-status payload mapping. |
| `windowsSandbox/setupCompleted` | server-to-client notification | Not consumed | Not now | Adopt with explicit product requirement. |
| `account/chatgptAuthTokens/refresh` | server-to-client request | Used now | Keep | Farfield surfaces this request in chat with a dedicated auth-token refresh card and submits typed responses through app-server transport. |
| `applyPatchApproval` | server-to-client request | Used now | Keep (compatibility only) | Deprecated server-request path, but Farfield now keeps typed compatibility handling and dedicated in-chat approval controls, including execpolicy-amendment decision submissions, to avoid transport-level request drops. |
| `execCommandApproval` | server-to-client request | Used now | Keep (compatibility only) | Deprecated server-request path, but Farfield now keeps typed compatibility handling and dedicated in-chat approval controls, including execpolicy-amendment decision submissions, to avoid transport-level request drops. |
| `item/commandExecution/requestApproval` | server-to-client request | Used now | Keep | Farfield surfaces this request in chat with approval controls and submits typed command-decision responses through app-server transport. |
| `item/fileChange/requestApproval` | server-to-client request | Used now | Keep | Farfield surfaces this request in chat with approval controls and submits typed file-change decisions through app-server transport. |
| `item/tool/call` | server-to-client request | Used now | Keep | Farfield surfaces this request in chat with tool-response controls and submits typed tool-call responses through app-server transport. |
| `item/tool/requestUserInput` | server-to-client request | Used now | Keep | Farfield stores this request and validates typed response submission through app-server transport. |
| `initialized` | client-to-server notification | Used now | Keep | Required protocol acknowledgement after initialize. |

Server notifications: 46
Server requests: 7
Client notifications: 1

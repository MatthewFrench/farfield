# App-Server Request Method Decision Ledger

Last Updated (UTC): 2026-02-27 09:14:29Z

This ledger records recommended disposition for every upstream app-server client request method in the current tracked snapshot.

| Method | Current Farfield State | Recommendation | Notes |
| --- | --- | --- | --- |
| `account/login/cancel` | Not used | Not now | Account and auth surface; adopt with explicit product requirement. |
| `account/login/start` | Not used | Not now | Account and auth surface; adopt with explicit product requirement. |
| `account/logout` | Not used | Not now | Account and auth surface; adopt with explicit product requirement. |
| `account/rateLimits/read` | Not used | Not now | Account and auth surface; adopt with explicit product requirement. |
| `account/read` | Not used | Not now | Account and auth surface; adopt with explicit product requirement. |
| `addConversationListener` | Not used | Do not adopt | Deprecated upstream request family. |
| `app/list` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `archiveConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `cancelLoginChatGpt` | Not used | Do not adopt | Deprecated upstream request family. |
| `collaborationMode/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `command/exec` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `config/batchWrite` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `config/mcpServer/reload` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `config/read` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `config/value/write` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `configRequirements/read` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `execOneOffCommand` | Not used | Do not adopt | Deprecated upstream request family. |
| `experimentalFeature/list` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `externalAgentConfig/detect` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `externalAgentConfig/import` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `feedback/upload` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `forkConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `fuzzyFileSearch` | Not used | Do not adopt | Deprecated upstream request family. |
| `fuzzyFileSearch/sessionStart` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `fuzzyFileSearch/sessionStop` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `fuzzyFileSearch/sessionUpdate` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `getAuthStatus` | Not used | Do not adopt | Deprecated upstream request family. |
| `getConversationSummary` | Not used | Do not adopt | Deprecated upstream request family. |
| `getUserAgent` | Not used | Do not adopt | Deprecated upstream request family. |
| `getUserSavedConfig` | Not used | Do not adopt | Deprecated upstream request family. |
| `gitDiffToRemote` | Not used | Do not adopt | Deprecated upstream request family. |
| `initialize` | Used now | Keep | Required protocol handshake in transport owner. |
| `interruptConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `listConversations` | Not used | Do not adopt | Deprecated upstream request family. |
| `loginApiKey` | Not used | Do not adopt | Deprecated upstream request family. |
| `loginChatGpt` | Not used | Do not adopt | Deprecated upstream request family. |
| `logoutChatGpt` | Not used | Do not adopt | Deprecated upstream request family. |
| `mcpServer/oauth/login` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `mcpServerStatus/list` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `mock/experimentalMethod` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `model/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `newConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `removeConversationListener` | Not used | Do not adopt | Deprecated upstream request family. |
| `resumeConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `review/start` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `sendUserMessage` | Not used | Do not adopt | Legacy request family upstream; replaced by turn/start in Farfield send path. |
| `sendUserTurn` | Not used | Do not adopt | Deprecated upstream request family. |
| `setDefaultModel` | Not used | Do not adopt | Deprecated upstream request family. |
| `skills/config/write` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `skills/list` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `skills/remote/export` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `skills/remote/list` | Not used | Not now | Integration and discovery surface; adopt when corresponding feature is planned. |
| `thread/archive` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/backgroundTerminals/clean` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `thread/compact/start` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `thread/fork` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `thread/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/loaded/list` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `thread/name/set` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `thread/read` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/realtime/appendAudio` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/appendText` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/start` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/stop` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/resume` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/rollback` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `thread/start` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/unarchive` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/unsubscribe` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `turn/interrupt` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `turn/start` | Used now | Keep | Canonical send path for app-server mode in Farfield. |
| `turn/steer` | Not used | Plan candidate | Modern v2 thread/turn lifecycle surface with product value. |
| `userInfo` | Not used | Do not adopt | Deprecated upstream request family. |
| `windowsSandbox/setupStart` | Not used | Not now | Adopt only with concrete product requirement and owner design. |

Total methods: 74
Used now: 11
Not used: 63

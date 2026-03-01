# App-Server Request Method Decision Ledger

Last Updated (UTC): 2026-03-01 02:37:57Z

This ledger records recommended disposition for every upstream app-server client request method in the current tracked snapshot.

| Method | Current Farfield State | Recommendation | Notes |
| --- | --- | --- | --- |
| `account/login/cancel` | Used now | Keep | Exposed through capability ownership and debug workspace account auth controls. |
| `account/login/start` | Used now | Keep | Exposed through capability ownership and debug workspace account auth controls. |
| `account/logout` | Used now | Keep | Exposed through capability ownership and debug workspace account auth controls. |
| `account/rateLimits/read` | Used now | Keep | Exposed through capability ownership and debug workspace account diagnostics. |
| `account/read` | Used now | Keep | Exposed through capability ownership and debug workspace account diagnostics. |
| `addConversationListener` | Not used | Do not adopt | Deprecated upstream request family. |
| `app/list` | Used now | Keep | Exposed through capability ownership and debug workspace coverage diagnostics. |
| `archiveConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `cancelLoginChatGpt` | Not used | Do not adopt | Deprecated upstream request family. |
| `collaborationMode/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `command/exec` | Used now | Keep | Exposed through capability ownership and debug workspace command diagnostics action/output. |
| `config/batchWrite` | Used now | Keep | Exposed through capability ownership and debug workspace config-batch write actions. |
| `config/mcpServer/reload` | Used now | Keep | Exposed through capability ownership and debug workspace MCP diagnostics actions. |
| `config/read` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `config/value/write` | Used now | Keep | Exposed through capability ownership and debug workspace config-value write actions. |
| `configRequirements/read` | Used now | Keep | Exposed through capability ownership and debug workspace coverage diagnostics. |
| `execOneOffCommand` | Not used | Do not adopt | Deprecated upstream request family. |
| `experimentalFeature/list` | Used now | Keep | Exposed through capability ownership and debug workspace coverage diagnostics. |
| `externalAgentConfig/detect` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `externalAgentConfig/import` | Not used | Not now | Adopt only with concrete product requirement and owner design. |
| `feedback/upload` | Used now | Keep | Exposed through capability ownership and debug workspace feedback-upload diagnostics action. |
| `forkConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `fuzzyFileSearch` | Not used | Do not adopt | Deprecated upstream request family. |
| `fuzzyFileSearch/sessionStart` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `fuzzyFileSearch/sessionStop` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `fuzzyFileSearch/sessionUpdate` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `getAuthStatus` | Used now | Keep | Exposed through capability ownership and debug workspace legacy auth-status diagnostics. |
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
| `mcpServer/oauth/login` | Used now | Keep | Exposed through capability ownership and debug workspace MCP oauth actions. |
| `mcpServerStatus/list` | Used now | Keep | Exposed through capability ownership and debug workspace coverage diagnostics. |
| `mock/experimentalMethod` | Not used | Do not adopt for production | Experimental or test-focused surface. |
| `model/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `newConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `removeConversationListener` | Not used | Do not adopt | Deprecated upstream request family. |
| `resumeConversation` | Not used | Do not adopt | Deprecated upstream request family. |
| `review/start` | Used now | Keep | Thread review action now routes through strict owner boundaries with typed target and delivery contracts. |
| `sendUserMessage` | Not used | Do not adopt | Legacy request family upstream; replaced by turn/start in Farfield send path. |
| `sendUserTurn` | Not used | Do not adopt | Deprecated upstream request family. |
| `setDefaultModel` | Not used | Do not adopt | Deprecated upstream request family. |
| `skills/config/write` | Used now | Keep | Exposed through capability ownership and debug workspace skill enable or disable actions. |
| `skills/list` | Used now | Keep | Exposed through capability ownership and debug workspace coverage diagnostics. |
| `skills/remote/export` | Used now | Keep | Exposed through capability ownership and debug workspace remote-skill export actions. |
| `skills/remote/list` | Used now | Keep | Exposed through capability ownership and debug workspace remote-skill diagnostics. |
| `thread/archive` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/backgroundTerminals/clean` | Used now | Keep | Background terminal cleanup now routes through strict owner boundaries and typed mutation contracts. |
| `thread/compact/start` | Used now | Keep | Context compaction action now routes through strict owner boundaries and typed mutation contracts. |
| `thread/fork` | Used now | Keep | Thread fork action is routed through strict owner boundaries and typed app-server mapping. |
| `thread/list` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/loaded/list` | Used now | Keep | Enables loaded-thread projection for list surfaces through strict owner boundaries. |
| `thread/name/set` | Used now | Keep | Thread rename action is routed through strict owner boundaries and typed app-server mapping. |
| `thread/read` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/realtime/appendAudio` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/appendText` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/start` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/realtime/stop` | Not used | Not now | Adopt only if realtime conversation feature is a planned product objective. |
| `thread/resume` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/rollback` | Used now | Keep | Thread rollback action is routed through strict owner boundaries and typed app-server mapping. |
| `thread/start` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/unarchive` | Used now | Keep | Current ownership and contracts align with present product behavior. |
| `thread/unsubscribe` | Used now | Keep | Canonical unsubscribe lifecycle path is now exposed through strict owner routing. |
| `turn/interrupt` | Used now | Keep | Interrupt fallback path is routed through strict owner boundaries and typed turn-id mapping. |
| `turn/start` | Used now | Keep | Canonical send path for app-server mode in Farfield. |
| `turn/steer` | Used now | Keep | Steering path now routes through strict owner boundaries with explicit in-progress turn precondition mapping. |
| `userInfo` | Used now | Keep | Exposed through capability ownership and debug workspace legacy user-info diagnostics. |
| `windowsSandbox/setupStart` | Not used | Not now | Adopt only with concrete product requirement and owner design. |

Total methods: 74
Used now: 42
Not used: 32

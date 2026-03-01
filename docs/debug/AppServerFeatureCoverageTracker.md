# App-Server Feature Coverage Tracker

Last Updated (UTC): 2026-03-01 10:57:34Z

## Purpose

Track app-server capability coverage in product terms:

1. What upstream app-server supports, publishes, and allows.
2. What Farfield currently supports.
3. The exact intersection and non-intersection.

## Research Baseline

Authoritative external sources used:

1. [OpenAI Codex App Server documentation](https://developers.openai.com/codex/remote-agent-app-server)
2. [openai/codex `codex-rs/app-server/README.md`](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md)
3. [openai/codex `codex-rs/app-server-protocol/src/protocol/common.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/common.rs)

Local Farfield sources used for intersection:

1. `packages/CodexInterfaceAdapter/Source/AppServerClientMethodConstants.ts`
2. `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
3. `packages/CodexInterfaceAdapter/Source/JsonRpc.ts`
4. `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts`
5. `apps/ServerApplication/Source/Agents/Adapters/CodexThreadManagementOwner.ts`
6. `apps/ServerApplication/Source/Agents/Adapters/CodexMessageDispatchOwner.ts`
7. `apps/ServerApplication/Source/Network/Routes/ThreadCollectionRoutes.ts`
8. `apps/ServerApplication/Source/Network/Routes/ThreadMemberReadRouteOwner.ts`
9. `apps/ServerApplication/Source/Network/Routes/ThreadMemberMessageMutationRouteOwner.ts`
10. `apps/ServerApplication/Source/Network/Routes/ThreadMemberArchiveMutationRouteOwner.ts`
11. `apps/ServerApplication/Source/Network/Routes/ThreadMemberReviewMutationRouteOwner.ts`
12. `apps/ServerApplication/Source/Network/Routes/ThreadMemberCompactMutationRouteOwner.ts`
13. `apps/ServerApplication/Source/Network/Routes/ThreadMemberBackgroundTerminalsCleanMutationRouteOwner.ts`
14. `apps/ServerApplication/Source/Network/Routes/ThreadMemberUnsubscribeMutationRouteOwner.ts`
15. `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts`

Upstream snapshot anchor:

1. Repository: `openai/codex`
2. Commit: `f53612d3b24e5f61ed4bd08a2b6fb4bd70a5b8fd`
3. Commit time (UTC): `2026-02-27 04:16:19 +0000`

## Upstream App-Server Inventory Snapshot

As of the upstream snapshot above:

1. Client-to-server request methods: `74`
2. Server-to-client notification methods: `46`
3. Server-to-client request methods: `7`
4. Client-to-server notification methods: `1` (`initialized`)

## Farfield Intersection Summary

1. Farfield app-server method coverage at request-owner layer: `53 / 74` request methods (`71.6%`).
2. Farfield also uses protocol initialization handshake (`initialize`) in transport ownership.
3. Effective request-method usage including transport-owned `initialize`: `54 / 74` (`73.0%`).
4. Farfield now captures app-server notification streams and exposes them through thread stream-event reads and dedicated notification-event reads in debug coverage diagnostics.
5. Farfield now handles all upstream app-server server-request methods (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/tool/requestUserInput`, `item/tool/call`, `account/chatgptAuthTokens/refresh`, `applyPatchApproval`, `execCommandApproval`) with typed response contracts and user-facing response controls for current product flows.
6. Farfield now exposes pending unresolved app-server server-request snapshots through debug coverage diagnostics (`/api/server-requests/pending`) with strict typed request metadata and payload previews.
7. Farfield now consumes auth-completion notifications (`mcpServer/oauthLogin/completed`, `account/login/completed`) through dedicated debug coverage diagnostics with strict typed event mapping and cursor-safe reads.
8. Farfield now consumes `serverRequest/resolved` notifications through dedicated debug coverage diagnostics with strict typed event mapping and explicit pending-request refresh controls.
9. Farfield now consumes fuzzy-session notifications (`fuzzyFileSearch/sessionUpdated`, `fuzzyFileSearch/sessionCompleted`) through dedicated debug coverage diagnostics with strict typed session/result mapping and cursor-safe reads.
10. Farfield now consumes `model/rerouted` notifications through dedicated debug coverage diagnostics with strict typed reroute mapping and explicit reason visibility.
11. Farfield now consumes warning notifications (`configWarning`, `deprecationNotice`, `windows/worldWritableWarning`) through dedicated debug coverage diagnostics with strict typed warning payload mapping and cursor-safe reads.
12. Farfield now consumes thread-lifecycle notifications (`thread/archived`, `thread/unarchived`, `thread/name/updated`) through dedicated debug coverage diagnostics with strict typed lifecycle mapping and thread-filtered reads.
13. Farfield now consumes `error` notifications through dedicated debug coverage diagnostics with strict typed turn-error mapping and retry-state visibility.
14. Farfield now consumes turn-lifecycle notifications (`turn/started`, `turn/completed`, `turn/plan/updated`, `turn/diff/updated`) through dedicated debug coverage diagnostics with strict typed lifecycle mapping and cursor-safe reads.

## Canonical Coverage Artifacts

1. Full request-method decision ledger: `docs/debug/AppServerRequestMethodDecisionLedger.md`
2. Full event-surface decision ledger: `docs/debug/AppServerEventSurfaceDecisionLedger.md`
3. Upstream request-method snapshot: `docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt`
4. Farfield request-method snapshot: `docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt`
5. Upstream server-notification snapshot: `docs/debug/AppServerUpstreamServerNotificationMethods.snapshot.txt`
6. Upstream server-request snapshot: `docs/debug/AppServerUpstreamServerRequestMethods.snapshot.txt`
7. Farfield server-request snapshot: `docs/debug/AppServerFarfieldServerRequestMethods.snapshot.txt`
8. Drift-governance script: `scripts/tooling/validate-app-server-method-drift-governance.mjs`
9. Drift-governance tests: `scripts/Tests/ValidateAppServerMethodDriftGovernance.test.ts`
10. CI entrypoint: `package.json` script `ci:targeted:governance`

## Intersection: Features and Idiomatic Usage

### Product-owned request methods

| Method | Farfield Feature Surface | Idiomatic Usage | Why | Recommendation |
| --- | --- | --- | --- | --- |
| `thread/list` | Thread list loading, refresh, bootstrap readiness check | High | Owned route and adapter layering, strict parsing, explicit merge/cache owners | Keep current path |
| `thread/loaded/list` | Loaded-in-memory status projection on thread list surfaces | High | Canonical v2 lifecycle signal now mapped through strict owner boundaries into list contracts | Keep current path |
| `thread/read` | Open-thread hydration and selected-thread refresh | High | Contract parsing at boundary and owner-controlled read flow | Keep current path |
| `thread/realtime/start` | Realtime conversation diagnostics start action with prompt and optional session id in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed prompt/session validation and deterministic start action mapping | Keep current path |
| `thread/realtime/appendAudio` | Realtime conversation diagnostics append-audio action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed audio chunk parsing and deterministic action mapping | Keep current path |
| `thread/realtime/appendText` | Realtime conversation diagnostics append-text action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed append payload parsing and deterministic action mapping | Keep current path |
| `thread/realtime/stop` | Realtime conversation diagnostics stop action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed thread identifier parsing and deterministic stop action mapping | Keep current path |
| `thread/start` | Thread creation | High | Clear create ownership with strict request shaping | Keep current path |
| `thread/fork` | Fork existing thread from row action menu | High | Owner-routed mutation with strict request parsing and scoped cache invalidation | Keep current path |
| `thread/name/set` | Rename thread from row action menu | High | Owner-routed mutation with strict request parsing and scoped cache invalidation | Keep current path |
| `thread/rollback` | Undo latest turn from row action menu | High | Owner-routed mutation with strict request parsing and selected-thread refresh ownership | Keep current path |
| `thread/backgroundTerminals/clean` | Clean thread background terminals from thread actions | High | Canonical mutation surface with strict owner routing and deterministic cache invalidation | Keep current path |
| `thread/compact/start` | Compact active thread context from thread actions | High | Canonical v2 context-compaction mutation with strict owner routing and typed mutation contracts | Keep current path |
| `review/start` | Start code review from thread actions | High | Canonical v2 review lifecycle method with strict target and delivery mapping in owner path | Keep current path |
| `turn/start` | Message send path in Codex message dispatch owner when IPC is unavailable | High | Canonical v2 turn lifecycle method with strict typed mapping in owner path | Keep current path |
| `turn/steer` | Steering send path for active in-progress turns when IPC is unavailable | High | Canonical v2 steering lifecycle method with explicit expected-turn precondition mapping | Keep current path |
| `turn/interrupt` | Interrupt in-progress turn when IPC send path is unavailable | High | Canonical v2 lifecycle path with strict turn-id contract mapping | Keep current path |
| `thread/resume` | Recover missing conversation before retry send | Medium-high | Correct recovery behavior, but paired with legacy send method | Keep behavior; migrate with send-path modernization |
| `thread/archive` | Archive thread action | High | Clean mutation ownership and scoped cache invalidation | Keep current path |
| `thread/unarchive` | Unarchive thread action | High | Clean mutation ownership and scoped cache invalidation | Keep current path |
| `thread/unsubscribe` | Stop app-server thread subscription when thread is deselected or closed | High | Canonical v2 lifecycle unsubscribe is now exposed through strict owner routing | Keep current path |
| `model/list` | Model selector and capability snapshot | High | Explicit capability route ownership and strict envelope parsing | Keep current path |
| `collaborationMode/list` | Collaboration mode selector and capability snapshot | High | Explicit capability ownership and strict envelope parsing | Keep current path |
| `command/exec` | Command execution diagnostics action with visible stdout/stderr output in debug workspace coverage panel | Medium-high | Strict capability route ownership and typed command request/response mapping for operator diagnostics | Keep current path |
| `gitDiffToRemote` | Git diff-to-remote diagnostics action with rendered patch output in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed working-directory query parsing and deterministic sha/diff mapping | Keep current path |
| `fuzzyFileSearch` | Fuzzy file search diagnostics action with query and root controls plus ranked file-match output in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed query and repeated-root parsing plus deterministic file-match response mapping | Keep current path |
| `fuzzyFileSearch/sessionStart` | Fuzzy file search session-start diagnostics action with explicit session id and roots controls in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed session-id and repeated-root parsing plus deterministic session-start result mapping | Keep current path |
| `fuzzyFileSearch/sessionUpdate` | Fuzzy file search session-update diagnostics action with explicit session id and query controls in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed session-id and query parsing plus deterministic session-update result mapping | Keep current path |
| `fuzzyFileSearch/sessionStop` | Fuzzy file search session-stop diagnostics action with explicit session id controls in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed session-id parsing plus deterministic session-stop result mapping | Keep current path |
| `config/read` | Config defaults resolution for model and reasoning effort | High | Normalized default resolution through typed owner mapping | Keep current path |
| `config/batchWrite` | Config batch-write diagnostics action with explicit multi-edit payload testing in debug workspace coverage panel | Medium-high | Strict capability route ownership and typed edit-array request parsing with deterministic write-result mapping | Keep current path |
| `configRequirements/read` | Config requirements diagnostics and workspace readiness signals | Medium-high | Strict capability route ownership with typed payload mapping into debug coverage diagnostics | Keep current path |
| `config/mcpServer/reload` | MCP server configuration reload action in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic mutation path for diagnostics flows | Keep current path |
| `mcpServer/oauth/login` | MCP server oauth-login start action in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic oauth-url response mapping for integration diagnostics | Keep current path |
| `externalAgentConfig/detect` | External agent-config detection diagnostics with typed migration-item projection in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic include-home and repeated-cwd parsing plus typed migration-item mapping | Keep current path |
| `externalAgentConfig/import` | External agent-config import diagnostics action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed migration-item request parsing and deterministic import-result mapping | Keep current path |
| `account/read` | Account diagnostics in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed account-contract mapping | Keep current path |
| `getAuthStatus` | Legacy auth-status diagnostics in debug workspace coverage panel to validate auth mode, token-return behavior, and OpenAI-auth requirements | Medium-high | Strict capability route ownership with typed boolean-query parsing and deterministic nullable auth-status mapping | Keep current path |
| `userInfo` | Legacy user-info diagnostics in debug workspace coverage panel for account troubleshooting workflows | Medium-high | Strict capability route ownership with deterministic nullable email mapping | Keep current path |
| `account/rateLimits/read` | Account rate-limit diagnostics in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed rate-limit contract mapping | Keep current path |
| `account/login/start` | Account auth start action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed login-response mapping and pending-login state | Keep current path |
| `account/login/cancel` | Account auth cancel action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed cancel-status mapping | Keep current path |
| `account/logout` | Account logout action in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic mutation response contract | Keep current path |
| `experimentalFeature/list` | Experimental feature diagnostics and capability coverage projection | Medium-high | Strict capability route ownership with typed list pagination contracts | Keep current path |
| `feedback/upload` | Feedback upload diagnostics action in debug workspace coverage panel with classification, logs, and optional thread targeting | Medium-high | Strict capability route ownership with typed query parsing and deterministic thread-id response mapping | Keep current path |
| `mcpServerStatus/list` | MCP server status diagnostics in debug workspace | Medium-high | Strict capability route ownership with typed list pagination contracts | Keep current path |
| `app/list` | App list diagnostics in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed thread-scoped query mapping | Keep current path |
| `skills/list` | Skills diagnostics in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed refresh query mapping | Keep current path |
| `skills/config/write` | Skills enable or disable actions in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic write-result mapping for skill-state mutations | Keep current path |
| `skills/remote/list` | Remote skills diagnostics in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed remote-skill query mapping for integration diagnostics | Keep current path |
| `skills/remote/export` | Remote skill export action in debug workspace coverage panel | Medium-high | Strict capability route ownership with deterministic export-result mapping for remote skill import workflows | Keep current path |
| `windowsSandbox/setupStart` | Windows sandbox setup diagnostics action in debug workspace coverage panel | Medium-high | Strict capability route ownership with typed setup-mode parsing and deterministic setup-start result mapping | Keep current path |

### Transport-owned request method

| Method | Farfield Feature Surface | Idiomatic Usage | Why | Recommendation |
| --- | --- | --- | --- | --- |
| `initialize` | Connection handshake (non-product surface) | High | Transport performs required initialize-before-other-requests protocol behavior | Keep current path |

## Farfield Product-Owned App-Server Request Methods

| Method | Farfield Product Surface | Owner Path |
| --- | --- | --- |
| `thread/list` | Active and archived thread list, bootstrap readiness check | `/api/threads` GET -> `ThreadCollectionRoutes` -> `CodexThreadManagementOwner.listThreads` -> `AppServerClient.listThreads` |
| `thread/loaded/list` | Loaded-in-memory status projection for thread rows | `/api/threads` GET -> `ThreadCollectionRoutes` -> `CodexThreadManagementOwner.listLoadedThreads` -> `AppServerClient.listLoadedThreads` |
| `thread/read` | Open thread and selected-thread refresh | `/api/threads/:threadId` GET -> `ThreadMemberReadRouteOwner` -> `CodexThreadManagementOwner.readThread` -> `AppServerClient.readThread` |
| `thread/realtime/start` | Realtime conversation diagnostics start action | `/api/threads/realtime/start` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.startThreadRealtime` -> `AppServerClient.startThreadRealtime` |
| `thread/realtime/appendAudio` | Realtime conversation diagnostics append-audio action | `/api/threads/realtime/append-audio` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.appendThreadRealtimeAudio` -> `AppServerClient.appendThreadRealtimeAudio` |
| `thread/realtime/appendText` | Realtime conversation diagnostics append-text action | `/api/threads/realtime/append-text` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.appendThreadRealtimeText` -> `AppServerClient.appendThreadRealtimeText` |
| `thread/realtime/stop` | Realtime conversation diagnostics stop action | `/api/threads/realtime/stop` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.stopThreadRealtime` -> `AppServerClient.stopThreadRealtime` |
| `thread/start` | Create thread | `/api/threads` POST -> `ThreadCollectionRoutes` -> `CodexThreadManagementOwner.createThread` -> `AppServerClient.startThread` |
| `thread/fork` | Fork thread | `/api/threads/:threadId/fork` POST -> `ThreadMemberForkMutationRouteOwner` -> `CodexThreadManagementOwner.forkThread` -> `AppServerClient.forkThread` |
| `thread/name/set` | Rename thread | `/api/threads/:threadId/name` POST -> `ThreadMemberNameMutationRouteOwner` -> `CodexThreadManagementOwner.setThreadName` -> `AppServerClient.setThreadName` |
| `thread/rollback` | Roll back recent turns | `/api/threads/:threadId/rollback` POST -> `ThreadMemberRollbackMutationRouteOwner` -> `CodexThreadManagementOwner.rollbackThread` -> `AppServerClient.rollbackThread` |
| `thread/backgroundTerminals/clean` | Clean thread background terminals | `/api/threads/:threadId/background-terminals-clean` POST -> `ThreadMemberBackgroundTerminalsCleanMutationRouteOwner` -> `CodexThreadManagementOwner.cleanThreadBackgroundTerminals` -> `AppServerClient.cleanThreadBackgroundTerminals` |
| `thread/compact/start` | Compact thread context | `/api/threads/:threadId/compact` POST -> `ThreadMemberCompactMutationRouteOwner` -> `CodexThreadManagementOwner.compactThread` -> `AppServerClient.compactThread` |
| `review/start` | Start thread review | `/api/threads/:threadId/review` POST -> `ThreadMemberReviewMutationRouteOwner` -> `CodexThreadManagementOwner.startThreadReview` -> `AppServerClient.startReview` |
| `turn/start` | Message send path when Desktop inter-process communication send path is not used | `/api/threads/:threadId/messages` POST -> `ThreadMemberMessageMutationRouteOwner` -> `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.startTurn` |
| `turn/steer` | Steering send path for in-progress turns when Desktop inter-process communication send path is not used | `/api/threads/:threadId/messages` POST (`isSteering=true`) -> `ThreadMemberMessageMutationRouteOwner` -> `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.steerTurn` |
| `turn/interrupt` | Interrupt path when Desktop inter-process communication path is not used | `/api/threads/:threadId/interrupt` POST -> `ThreadMemberInteractionMutationRouteOwner` -> `CodexThreadInteractionOwner.interrupt` -> `AppServerClient.interruptTurn` |
| `thread/resume` | Recover conversation-not-found before retrying send | `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.resumeThread` |
| `thread/archive` | Archive thread | `/api/threads/:threadId/archive` POST -> `ThreadMemberArchiveMutationRouteOwner` -> `CodexThreadManagementOwner.archiveThread` -> `AppServerClient.archiveThread` |
| `thread/unarchive` | Unarchive thread | `/api/threads/:threadId/unarchive` POST -> `ThreadMemberArchiveMutationRouteOwner` -> `CodexThreadManagementOwner.unarchiveThread` -> `AppServerClient.unarchiveThread` |
| `thread/unsubscribe` | Unsubscribe thread subscription on lifecycle transitions | `/api/threads/:threadId/unsubscribe` POST -> `ThreadMemberUnsubscribeMutationRouteOwner` -> `CodexThreadManagementOwner.unsubscribeThread` -> `AppServerClient.unsubscribeThread` |
| `model/list` | Model selector and capability snapshot | `/api/models` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listModels` -> `AppServerClient.listModels` |
| `collaborationMode/list` | Collaboration mode selector and capability snapshot | `/api/collaboration-modes` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listCollaborationModes` -> `AppServerClient.listCollaborationModes` |
| `command/exec` | Command execution diagnostics action and output capture | `/api/commands/exec` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.executeCommand` -> `AppServerClient.executeCommand` |
| `gitDiffToRemote` | Git diff-to-remote diagnostics action and patch output capture | `/api/git/diff-remote` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.gitDiffToRemote` -> `AppServerClient.gitDiffToRemote` |
| `fuzzyFileSearch` | Fuzzy file search diagnostics action and ranked file-match output | `/api/files/fuzzy-search` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.fuzzyFileSearch` -> `AppServerClient.fuzzyFileSearch` |
| `fuzzyFileSearch/sessionStart` | Fuzzy file search session-start diagnostics action | `/api/files/fuzzy-search/session-start` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.startFuzzyFileSearchSession` -> `AppServerClient.startFuzzyFileSearchSession` |
| `fuzzyFileSearch/sessionUpdate` | Fuzzy file search session-update diagnostics action | `/api/files/fuzzy-search/session-update` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.updateFuzzyFileSearchSession` -> `AppServerClient.updateFuzzyFileSearchSession` |
| `fuzzyFileSearch/sessionStop` | Fuzzy file search session-stop diagnostics action | `/api/files/fuzzy-search/session-stop` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.stopFuzzyFileSearchSession` -> `AppServerClient.stopFuzzyFileSearchSession` |
| `config/read` | Config defaults (`model`, `reasoningEffort`) | `/api/config/defaults` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readConfigDefaults` -> `AppServerClient.readConfig` |
| `config/batchWrite` | Config-batch mutation diagnostics action | `/api/config/batch/write` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.writeConfigBatch` -> `AppServerClient.writeConfigBatch` |
| `config/value/write` | Config-value mutation diagnostics action | `/api/config/value/write` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.writeConfigValue` -> `AppServerClient.writeConfigValue` |
| `configRequirements/read` | Config requirements diagnostics | `/api/config-requirements` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readConfigRequirements` -> `AppServerClient.readConfigRequirements` |
| `config/mcpServer/reload` | MCP server config reload diagnostics action | `/api/config/mcp-server/reload` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.reloadMcpServerConfig` -> `AppServerClient.reloadMcpServerConfig` |
| `mcpServer/oauth/login` | MCP server oauth login diagnostics action | `/api/mcp-servers/oauth/login` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.startMcpServerOauthLogin` -> `AppServerClient.startMcpServerOauthLogin` |
| `externalAgentConfig/detect` | External agent-config detection diagnostics action | `/api/external-agent-config/detect` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.detectExternalAgentConfig` -> `AppServerClient.detectExternalAgentConfig` |
| `externalAgentConfig/import` | External agent-config import diagnostics action | `/api/external-agent-config/import` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.importExternalAgentConfig` -> `AppServerClient.importExternalAgentConfig` |
| `account/read` | Account diagnostics | `/api/account` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readAccount` -> `AppServerClient.readAccount` |
| `getAuthStatus` | Legacy auth-status diagnostics | `/api/account/auth-status` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readAuthStatus` -> `AppServerClient.readAuthStatus` |
| `userInfo` | Legacy user-info diagnostics | `/api/account/user-info` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readUserInfo` -> `AppServerClient.readUserInfo` |
| `account/rateLimits/read` | Account rate-limit diagnostics | `/api/account/rate-limits` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readAccountRateLimits` -> `AppServerClient.readAccountRateLimits` |
| `account/login/start` | Account login start action | `/api/account/login/start` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.startAccountLogin` -> `AppServerClient.startAccountLogin` |
| `account/login/cancel` | Account login cancel action | `/api/account/login/cancel` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.cancelAccountLogin` -> `AppServerClient.cancelAccountLogin` |
| `account/logout` | Account logout action | `/api/account/logout` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.logoutAccount` -> `AppServerClient.logoutAccount` |
| `experimentalFeature/list` | Experimental feature diagnostics | `/api/experimental-features` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listExperimentalFeatures` -> `AppServerClient.listExperimentalFeatures` |
| `feedback/upload` | Feedback upload diagnostics action with classification, logs, and optional thread targeting | `/api/feedback/upload` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.uploadFeedback` -> `AppServerClient.uploadFeedback` |
| `mcpServerStatus/list` | MCP server status diagnostics | `/api/mcp-servers` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listMcpServerStatuses` -> `AppServerClient.listMcpServerStatuses` |
| `app/list` | App list diagnostics | `/api/apps` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listApps` -> `AppServerClient.listApps` |
| `skills/list` | Skills diagnostics | `/api/skills` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listSkills` -> `AppServerClient.listSkills` |
| `skills/config/write` | Skills enable or disable diagnostics action | `/api/skills/config/write` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.writeSkillsConfig` -> `AppServerClient.writeSkillsConfig` |
| `skills/remote/list` | Remote skills diagnostics | `/api/skills/remote/list` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listRemoteSkills` -> `AppServerClient.listRemoteSkills` |
| `skills/remote/export` | Remote skill export diagnostics action | `/api/skills/remote/export` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.exportRemoteSkill` -> `AppServerClient.exportRemoteSkill` |
| `windowsSandbox/setupStart` | Windows sandbox setup diagnostics action | `/api/windows-sandbox/setup-start` POST -> `CapabilityRoutes` -> `CodexThreadManagementOwner.startWindowsSandboxSetup` -> `AppServerClient.startWindowsSandboxSetup` |

## Upstream Methods Not Used by Farfield App-Server Path

`21` request methods are not used by Farfield’s app-server client path:

```text
addConversationListener
archiveConversation
cancelLoginChatGpt
execOneOffCommand
forkConversation
getConversationSummary
getUserAgent
getUserSavedConfig
initialize
interruptConversation
listConversations
loginApiKey
loginChatGpt
logoutChatGpt
mock/experimentalMethod
newConversation
removeConversationListener
resumeConversation
sendUserTurn
setDefaultModel
sendUserMessage
```

## Full Non-Intersection Classification

### Category A: Legacy and Deprecated Upstream Request Family

These are explicitly in the upstream deprecated request section and should not be newly adopted for idiomatic forward paths.

1. `addConversationListener`
2. `archiveConversation`
3. `cancelLoginChatGpt`
4. `execOneOffCommand`
5. `forkConversation`
6. `getConversationSummary`
7. `getUserAgent`
8. `getUserSavedConfig`
9. `interruptConversation`
10. `listConversations`
11. `loginApiKey`
12. `loginChatGpt`
13. `logoutChatGpt`
14. `newConversation`
15. `removeConversationListener`
16. `resumeConversation`
17. `sendUserTurn`
18. `sendUserMessage`
19. `setDefaultModel`

### Category B: Auth, Account, and Tenant/Operator Surfaces Not Yet Wired in Farfield Product Flows

No remaining methods in this category for the current upstream snapshot.

### Category C: Configuration and Environment Management Surfaces Not Yet Wired

No remaining methods in this category for the current upstream snapshot.

### Category D: Skills, Apps, and Feature-Discovery Surfaces Not Yet Wired

No remaining methods in this category for the current upstream snapshot.

### Category E: MCP and Integration Surfaces Not Yet Wired

No remaining methods in this category for the current upstream snapshot.

### Category F: Thread and Turn v2 Lifecycle Surfaces Not Yet Wired

No remaining methods in this category for the current upstream snapshot.

### Category G: Experimental and Test-only Surfaces Not Intended for Production Flow

1. `mock/experimentalMethod`

### Category H: Operational Method Already Handled in Transport Layer (Not in Product Request Owner List)

1. `initialize`

### Category I: Miscellaneous Product Surface Not Yet Wired

No remaining methods in this category for the current upstream snapshot.

## Classification Coverage Check

1. Total non-intersection methods: `21`
2. Total methods listed across Category A-I: `21`
3. Classification coverage: complete for this upstream snapshot

## Publish and Allowance Coverage Notes

### Server-to-client notifications

Upstream publishes `46` notification methods. Farfield now captures these notifications in app-server transport ownership and exposes them through `readNotificationEvents` plus dedicated debug coverage route ownership:

1. `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts`
2. `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
3. `apps/ServerApplication/Source/Agents/Adapters/CodexThreadInteractionOwner.ts` maps thread-scoped notifications into stream-event reads when IPC is unavailable.
4. `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts` exposes `/api/notifications/events` for direct notification cursor diagnostics.
5. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageAuthCompletionEventMappers.ts` projects `mcpServer/oauthLogin/completed` and `account/login/completed` notification payloads into strict auth-completion diagnostics.
6. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageServerRequestResolvedEventMappers.ts` projects `serverRequest/resolved` notification payloads into strict server-request completion diagnostics.
7. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageFuzzySessionNotificationMappers.ts` projects `fuzzyFileSearch/sessionUpdated` and `fuzzyFileSearch/sessionCompleted` notification payloads into strict fuzzy-session diagnostics.
8. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageModelReroutedEventMappers.ts` projects `model/rerouted` notification payloads into strict model-reroute diagnostics.
9. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageWarningNotificationMappers.ts` projects `configWarning`, `deprecationNotice`, and `windows/worldWritableWarning` notification payloads into strict warning diagnostics.
10. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageThreadLifecycleNotificationMappers.ts` projects `thread/archived`, `thread/unarchived`, and `thread/name/updated` notification payloads into strict thread-lifecycle diagnostics.
11. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageErrorNotificationMappers.ts` projects `error` notification payloads into strict error diagnostics.
12. `apps/WebApplication/Source/Features/Debugging/StateManagement/DebugAppServerCoverageTurnLifecycleNotificationMappers.ts` projects `turn/started`, `turn/completed`, `turn/plan/updated`, and `turn/diff/updated` notification payloads into strict turn-lifecycle diagnostics.

### Server-to-client requests

Upstream can send server requests such as:

1. `item/commandExecution/requestApproval`
2. `item/fileChange/requestApproval`
3. `item/tool/requestUserInput`
4. `item/tool/call`
5. `account/chatgptAuthTokens/refresh`
6. `applyPatchApproval` (deprecated)
7. `execCommandApproval` (deprecated)

Farfield app-server transport now supports server-request envelopes:

1. `packages/CodexInterfaceAdapter/Source/JsonRpc.ts` classifies inbound `request` envelopes.
2. `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts` stores handled server requests and enforces method-matched typed response writes.
3. Current upstream methods are all explicitly handled; non-upstream or unknown methods still receive deterministic JSON-RPC method-not-found errors.

### Non-app-server Codex paths used by Farfield

Some Farfield features are implemented through Desktop inter-process communication owners, not app-server request methods:

1. `setCollaborationMode`
2. `submitUserInput` (IPC path primary; app-server path now supports typed response submission for handled approval/user-input/tool-call/auth-token-refresh requests)
3. `interrupt`
4. Live stream state projection and stream-event reads

## Deep-Dive Research: `sendUserMessage` vs `turn/start`

Upstream evidence summary:

1. `sendUserMessage` is in the upstream deprecated request section.
2. `turn/start` is in the current v2 request section.
3. Both server handlers submit user input into core thread execution, but `turn/start` adds richer v2 behavior.

Behavioral differences verified from upstream source:

1. `sendUserMessage`
   - Uses v1 `SendUserMessageParams` (`conversation_id`, `items`).
   - Submits `Op::UserInput` and returns empty response (`{}`).
   - Does not expose per-turn override controls in request shape.
2. `turn/start`
   - Uses v2 `TurnStartParams` (`thread_id`, `input`) with optional per-turn overrides (`cwd`, `approval_policy`, `sandbox_policy`, `model`, `effort`, `summary`, `personality`, `output_schema`, optional collaboration mode).
   - Returns `TurnStartResponse` with `turn`.
   - Emits `turn/started` notification and full item lifecycle notifications.

Farfield implication:

1. Farfield app-server message send path now uses `turn/start` for non-Desktop inter-process communication routes.
2. Farfield now captures app-server notifications and exposes them in stream-event reads when IPC is unavailable.
3. Farfield now supports handled server-request response flow (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/tool/requestUserInput`, `item/tool/call`, `account/chatgptAuthTokens/refresh`, `applyPatchApproval`, `execCommandApproval`) through app-server transport ownership.

Idiomatically correct migration path (research outcome):

1. Phase 1: Add request-owner support for `turn/start` and switch non-Desktop inter-process communication message-send path from `sendUserMessage` to `turn/start`. (Completed)
2. Phase 2: Add app-server notification consumption in transport ownership and expose events through owned read APIs. (Completed)
3. Phase 3: Add server-request envelope support with explicit handled-method policy and typed response submission contracts. (Completed)
4. Phase 4: Expand handled server-request methods beyond approval/user-input/tool-call when product workflows require them. (Completed for current upstream server-request snapshot, including deprecated compatibility methods)

## Drift-Detection Research Outcome

Source-of-truth method extraction point:

1. Upstream file: `codex-rs/app-server-protocol/src/protocol/common.rs`
2. Macro blocks: `client_request_definitions!`, `server_request_definitions!`, and `server_notification_definitions!`
3. Parse target: wire method names in entries like `Variant => "method/name" { ... }` (plus attribute-renamed variants)

Research-validated automation design:

1. Fetch upstream `common.rs` at pinned commit and at latest `main`.
2. Extract client-request, server-request, and server-notification method lists from protocol macro invocations.
3. Compare extracted lists with tracked upstream snapshots and Farfield-owned snapshots.
4. Fail CI when upstream list changes and snapshots are not intentionally updated.
5. Emit deterministic diff output (`added`, `removed`, counts) for review.

Implemented tracked artifacts:

1. `docs/debug/AppServerUpstreamClientRequestMethods.snapshot.txt`
2. `docs/debug/AppServerFarfieldClientRequestMethods.snapshot.txt`
3. `docs/debug/AppServerUpstreamServerNotificationMethods.snapshot.txt`
4. `docs/debug/AppServerUpstreamServerRequestMethods.snapshot.txt`
5. `docs/debug/AppServerFarfieldServerRequestMethods.snapshot.txt`
6. `scripts/tooling/validate-app-server-method-drift-governance.mjs`

## Research Backlog Status

| ID | Task | Status |
| --- | --- | --- |
| `APP-SERVER-RESEARCH-001` | Build authoritative upstream method inventory from external source and pin snapshot | Completed |
| `APP-SERVER-RESEARCH-002` | Map each non-intersection method to product decision (`not needed now`, `planned`, `deprecated`) | Completed |
| `APP-SERVER-RESEARCH-003` | Evaluate migration from legacy `sendUserMessage` path to current upstream turn lifecycle methods | Completed |
| `APP-SERVER-RESEARCH-004` | Add automated drift check against upstream method inventory | Completed |

## Current Conclusion

1. The upstream app-server surface is now documented from authoritative external sources.
2. Farfield supports a focused subset aligned to the current product feature set.
3. Farfield is not yet spec-complete for the full upstream app-server method and event surface.

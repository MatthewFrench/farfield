# App-Server Feature Coverage Tracker

Last Updated (UTC): 2026-02-28 13:58:31Z

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
12. `apps/ServerApplication/Source/Network/Routes/CapabilityRoutes.ts`

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

1. Farfield app-server method coverage at request-owner layer: `16 / 74` request methods (`21.6%`).
2. Farfield also uses protocol initialization handshake (`initialize`) in transport ownership.
3. Effective request-method usage including transport-owned `initialize`: `17 / 74` (`23.0%`).
4. Farfield now captures app-server notification streams and exposes them through stream-event reads when IPC is unavailable.
5. Farfield now handles app-server server-request methods `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/tool/requestUserInput`, and `item/tool/call`.

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
| `thread/read` | Open-thread hydration and selected-thread refresh | High | Contract parsing at boundary and owner-controlled read flow | Keep current path |
| `thread/start` | Thread creation | High | Clear create ownership with strict request shaping | Keep current path |
| `thread/fork` | Fork existing thread from row action menu | High | Owner-routed mutation with strict request parsing and scoped cache invalidation | Keep current path |
| `thread/name/set` | Rename thread from row action menu | High | Owner-routed mutation with strict request parsing and scoped cache invalidation | Keep current path |
| `thread/rollback` | Undo latest turn from row action menu | High | Owner-routed mutation with strict request parsing and selected-thread refresh ownership | Keep current path |
| `review/start` | Start code review from thread actions | High | Canonical v2 review lifecycle method with strict target and delivery mapping in owner path | Keep current path |
| `turn/start` | Message send path in Codex message dispatch owner when IPC is unavailable | High | Canonical v2 turn lifecycle method with strict typed mapping in owner path | Keep current path |
| `turn/steer` | Steering send path for active in-progress turns when IPC is unavailable | High | Canonical v2 steering lifecycle method with explicit expected-turn precondition mapping | Keep current path |
| `turn/interrupt` | Interrupt in-progress turn when IPC send path is unavailable | High | Canonical v2 lifecycle path with strict turn-id contract mapping | Keep current path |
| `thread/resume` | Recover missing conversation before retry send | Medium-high | Correct recovery behavior, but paired with legacy send method | Keep behavior; migrate with send-path modernization |
| `thread/archive` | Archive thread action | High | Clean mutation ownership and scoped cache invalidation | Keep current path |
| `thread/unarchive` | Unarchive thread action | High | Clean mutation ownership and scoped cache invalidation | Keep current path |
| `model/list` | Model selector and capability snapshot | High | Explicit capability route ownership and strict envelope parsing | Keep current path |
| `collaborationMode/list` | Collaboration mode selector and capability snapshot | High | Explicit capability ownership and strict envelope parsing | Keep current path |
| `config/read` | Config defaults resolution for model and reasoning effort | High | Normalized default resolution through typed owner mapping | Keep current path |

### Transport-owned request method

| Method | Farfield Feature Surface | Idiomatic Usage | Why | Recommendation |
| --- | --- | --- | --- | --- |
| `initialize` | Connection handshake (non-product surface) | High | Transport performs required initialize-before-other-requests protocol behavior | Keep current path |

## Farfield Product-Owned App-Server Request Methods

| Method | Farfield Product Surface | Owner Path |
| --- | --- | --- |
| `thread/list` | Active and archived thread list, bootstrap readiness check | `/api/threads` GET -> `ThreadCollectionRoutes` -> `CodexThreadManagementOwner.listThreads` -> `AppServerClient.listThreads` |
| `thread/read` | Open thread and selected-thread refresh | `/api/threads/:threadId` GET -> `ThreadMemberReadRouteOwner` -> `CodexThreadManagementOwner.readThread` -> `AppServerClient.readThread` |
| `thread/start` | Create thread | `/api/threads` POST -> `ThreadCollectionRoutes` -> `CodexThreadManagementOwner.createThread` -> `AppServerClient.startThread` |
| `thread/fork` | Fork thread | `/api/threads/:threadId/fork` POST -> `ThreadMemberForkMutationRouteOwner` -> `CodexThreadManagementOwner.forkThread` -> `AppServerClient.forkThread` |
| `thread/name/set` | Rename thread | `/api/threads/:threadId/name` POST -> `ThreadMemberNameMutationRouteOwner` -> `CodexThreadManagementOwner.setThreadName` -> `AppServerClient.setThreadName` |
| `thread/rollback` | Roll back recent turns | `/api/threads/:threadId/rollback` POST -> `ThreadMemberRollbackMutationRouteOwner` -> `CodexThreadManagementOwner.rollbackThread` -> `AppServerClient.rollbackThread` |
| `review/start` | Start thread review | `/api/threads/:threadId/review` POST -> `ThreadMemberReviewMutationRouteOwner` -> `CodexThreadManagementOwner.startThreadReview` -> `AppServerClient.startReview` |
| `turn/start` | Message send path when Desktop inter-process communication send path is not used | `/api/threads/:threadId/messages` POST -> `ThreadMemberMessageMutationRouteOwner` -> `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.startTurn` |
| `turn/steer` | Steering send path for in-progress turns when Desktop inter-process communication send path is not used | `/api/threads/:threadId/messages` POST (`isSteering=true`) -> `ThreadMemberMessageMutationRouteOwner` -> `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.steerTurn` |
| `turn/interrupt` | Interrupt path when Desktop inter-process communication path is not used | `/api/threads/:threadId/interrupt` POST -> `ThreadMemberInteractionMutationRouteOwner` -> `CodexThreadInteractionOwner.interrupt` -> `AppServerClient.interruptTurn` |
| `thread/resume` | Recover conversation-not-found before retrying send | `CodexMessageDispatchOwner.sendMessage` -> `AppServerClient.resumeThread` |
| `thread/archive` | Archive thread | `/api/threads/:threadId/archive` POST -> `ThreadMemberArchiveMutationRouteOwner` -> `CodexThreadManagementOwner.archiveThread` -> `AppServerClient.archiveThread` |
| `thread/unarchive` | Unarchive thread | `/api/threads/:threadId/unarchive` POST -> `ThreadMemberArchiveMutationRouteOwner` -> `CodexThreadManagementOwner.unarchiveThread` -> `AppServerClient.unarchiveThread` |
| `model/list` | Model selector and capability snapshot | `/api/models` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listModels` -> `AppServerClient.listModels` |
| `collaborationMode/list` | Collaboration mode selector and capability snapshot | `/api/collaboration-modes` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.listCollaborationModes` -> `AppServerClient.listCollaborationModes` |
| `config/read` | Config defaults (`model`, `reasoningEffort`) | `/api/config/defaults` GET -> `CapabilityRoutes` -> `CodexThreadManagementOwner.readConfigDefaults` -> `AppServerClient.readConfig` |

## Upstream Methods Not Used by Farfield App-Server Path

`58` request methods are not used by Farfield’s app-server client path:

```text
account/login/cancel
account/login/start
account/logout
account/rateLimits/read
account/read
addConversationListener
app/list
archiveConversation
cancelLoginChatGpt
command/exec
config/batchWrite
config/mcpServer/reload
config/value/write
configRequirements/read
execOneOffCommand
experimentalFeature/list
externalAgentConfig/detect
externalAgentConfig/import
feedback/upload
forkConversation
fuzzyFileSearch
fuzzyFileSearch/sessionStart
fuzzyFileSearch/sessionStop
fuzzyFileSearch/sessionUpdate
getAuthStatus
getConversationSummary
getUserAgent
getUserSavedConfig
gitDiffToRemote
initialize
interruptConversation
listConversations
loginApiKey
loginChatGpt
logoutChatGpt
mcpServer/oauth/login
mcpServerStatus/list
mock/experimentalMethod
newConversation
removeConversationListener
resumeConversation
sendUserTurn
setDefaultModel
skills/config/write
skills/list
skills/remote/export
skills/remote/list
thread/backgroundTerminals/clean
thread/compact/start
thread/loaded/list
thread/realtime/appendAudio
thread/realtime/appendText
thread/realtime/start
thread/realtime/stop
thread/unsubscribe
sendUserMessage
userInfo
windowsSandbox/setupStart
```

## Full Non-Intersection Classification

### Category A: Legacy and Deprecated Upstream Request Family

These are explicitly in the upstream deprecated request section and should not be newly adopted for idiomatic forward paths.

1. `addConversationListener`
2. `archiveConversation`
3. `cancelLoginChatGpt`
4. `execOneOffCommand`
5. `forkConversation`
6. `fuzzyFileSearch`
7. `getAuthStatus`
8. `getConversationSummary`
9. `getUserAgent`
10. `getUserSavedConfig`
11. `gitDiffToRemote`
12. `interruptConversation`
13. `listConversations`
14. `loginApiKey`
15. `loginChatGpt`
16. `logoutChatGpt`
17. `newConversation`
18. `removeConversationListener`
19. `resumeConversation`
20. `sendUserTurn`
21. `sendUserMessage`
22. `setDefaultModel`
23. `userInfo`

### Category B: Auth, Account, and Tenant/Operator Surfaces Not Yet Wired in Farfield Product Flows

1. `account/login/cancel`
2. `account/login/start`
3. `account/logout`
4. `account/rateLimits/read`
5. `account/read`

### Category C: Configuration and Environment Management Surfaces Not Yet Wired

1. `config/batchWrite`
2. `config/mcpServer/reload`
3. `config/value/write`
4. `configRequirements/read`
5. `externalAgentConfig/detect`
6. `externalAgentConfig/import`

### Category D: Skills, Apps, and Feature-Discovery Surfaces Not Yet Wired

1. `app/list`
2. `experimentalFeature/list`
3. `skills/config/write`
4. `skills/list`
5. `skills/remote/export`
6. `skills/remote/list`

### Category E: MCP and Integration Surfaces Not Yet Wired

1. `mcpServer/oauth/login`
2. `mcpServerStatus/list`

### Category F: Thread and Turn v2 Lifecycle Surfaces Not Yet Wired

These are idiomatic modern surfaces upstream; some should be considered future migration targets.

1. `thread/backgroundTerminals/clean`
2. `thread/compact/start`
3. `thread/loaded/list`
4. `thread/realtime/appendAudio`
5. `thread/realtime/appendText`
6. `thread/realtime/start`
7. `thread/realtime/stop`
8. `thread/unsubscribe`

### Category G: Experimental and Test-only Surfaces Not Intended for Production Flow

1. `fuzzyFileSearch/sessionStart`
2. `fuzzyFileSearch/sessionStop`
3. `fuzzyFileSearch/sessionUpdate`
4. `mock/experimentalMethod`

### Category H: Operational Method Already Handled in Transport Layer (Not in Product Request Owner List)

1. `initialize`

### Category I: Miscellaneous Product Surface Not Yet Wired

1. `command/exec`
2. `feedback/upload`
3. `windowsSandbox/setupStart`

## Classification Coverage Check

1. Total non-intersection methods: `58`
2. Total methods listed across Category A-I: `58`
3. Classification coverage: complete for this upstream snapshot

## Publish and Allowance Coverage Notes

### Server-to-client notifications

Upstream publishes `46` notification methods. Farfield now captures these notifications in app-server transport ownership and exposes them through `readNotificationEvents`:

1. `packages/CodexInterfaceAdapter/Source/AppServerTransport.ts`
2. `packages/CodexInterfaceAdapter/Source/AppServerClient.ts`
3. `apps/ServerApplication/Source/Agents/Adapters/CodexThreadInteractionOwner.ts` maps thread-scoped notifications into stream-event reads when IPC is unavailable.

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
3. Non-handled server-request methods are returned with deterministic JSON-RPC method-not-found errors.

### Non-app-server Codex paths used by Farfield

Some Farfield features are implemented through Desktop inter-process communication owners, not app-server request methods:

1. `setCollaborationMode`
2. `submitUserInput` (IPC path primary; app-server path now supports typed response submission for handled approval/user-input/tool-call requests)
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
3. Farfield now supports handled server-request response flow (`item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/tool/requestUserInput`, `item/tool/call`) through app-server transport ownership.

Idiomatically correct migration path (research outcome):

1. Phase 1: Add request-owner support for `turn/start` and switch non-Desktop inter-process communication message-send path from `sendUserMessage` to `turn/start`. (Completed)
2. Phase 2: Add app-server notification consumption in transport ownership and expose events through owned read APIs. (Completed)
3. Phase 3: Add server-request envelope support with explicit handled-method policy and typed response submission contracts. (Completed)
4. Phase 4: Expand handled server-request methods beyond approval/user-input/tool-call only when product workflows require them. (Planned)

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

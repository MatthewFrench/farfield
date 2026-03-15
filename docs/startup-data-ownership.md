# Startup Data Ownership

This document defines which web startup requests are required for first interactive paint and which requests are explicitly deferred.

## Critical startup owners

These requests are on the startup critical path and must complete before startup loading state can settle.

| Action name | Owner module | Request | Why required |
| --- | --- | --- | --- |
| `startup-critical.events-session` | `UseApplicationRuntimeRequestHandlers` | `POST /api/events/session` | Establishes auth/session gate used by protected API reads. |
| `startup-critical.threads.active` | `UseCoreDataLoaders` | `GET /api/threads` | Supplies primary thread-list content and initial selection state. |

## Deferred startup owners

These requests are intentionally deferred until after critical startup has settled.

| Action name | Owner module | Request | Why deferred |
| --- | --- | --- | --- |
| `startup-deferred.health` | `UseCoreDataLoaders` | `GET /api/health` | Health badges/metadata are not required to interact with thread list. |
| `startup-deferred.agents` | `UseCoreDataLoaders` | `GET /api/agents` | Agent metadata can hydrate after shell is interactive. |
| `startup-deferred.capabilities.modes` | `UseCoreDataLoaders` | `GET /api/collaboration-modes` | Mode catalog is needed for compose controls, not first paint. |
| `startup-deferred.capabilities.models` | `UseCoreDataLoaders` | `GET /api/models` | Model catalog is needed for compose controls, not first paint. |
| `startup-deferred.capabilities.defaults` | `UseCoreDataLoaders` | `GET /api/config/defaults` | Default model/reasoning values can apply after shell render. |
| `startup-deferred.trace-status` | `UseCoreDataLoaders` | `GET /api/debug/trace/status` | Trace controls are debug-surface data only. |
| `startup-deferred.debug.history` | `UseCoreDataLoaders` | `GET /api/debug/history` | Debug history loads only when debug workspace is active. |
| `startup-deferred.debug.client-errors` | `UseCoreDataLoaders` | `GET /api/debug/client-errors` | Debug issue feed loads only when debug workspace is active. |
| `startup-deferred.threads.active.revalidate` | `UseCoreDataLoaders` | `GET /api/threads` | Non-blocking network revalidation after cache-first startup read. |

## Failure policy

- Critical request failures are raised as `startup-critical.*` errors and can block startup completion.
- Deferred request failures are raised as `startup-deferred.*` errors and must not block startup completion.
- Deferred requests are executed with isolated settlement semantics so one failure does not cancel unrelated deferred loads.

## Budget guardrail

- Startup critical request budget is fixed at `2` requests.
- Budget enforcement test: `apps/WebApplication/Tests/CoreDataStartupRequestProfile.test.ts`.

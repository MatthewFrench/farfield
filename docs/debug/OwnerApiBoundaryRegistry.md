# Owner API Boundary Registry

Last Updated (UTC): 2026-02-26 23:57:44Z

## Purpose

Track explicit owner surfaces by group, the mutable state each owner controls, and the public API that other groups must use.

## Server Network Group

1. [`ServerRequestLifecycleOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestLifecycleOwner.ts)
   - owns: request context metadata, request start/complete observability pairing.
   - query APIs: `createRequestLifecycleContext`, `createRequestErrorContext`, `createRequestContextDetails`.
   - mutation APIs: `recordRequestStartedForObservability`, `recordRequestCompletedForObservability`, `writeRequestContextResponseHeaders`.
2. [`ServerRequestAuthenticationOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestAuthenticationOwner.ts)
   - owns: API authentication policy checks.
   - query APIs: `requireApiAuth`.
3. [`ServerRequestRouteDispatchOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Network/ServerRequestRouteDispatchOwner.ts)
   - owns: route dispatch order and route dependency wiring.
   - query APIs: `dispatch`.

## Server Agents Group

1. [`OpenCodeDirectoryOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeDirectoryOwner.ts)
   - owns: thread-directory cache and directory normalization/validation.
   - query APIs: `resolveThreadDirectory`, `resolveSessionDirectories`, `normalizeDirectoryList`.
   - mutation APIs: `cacheThreadDirectory`.
2. [`OpenCodeThreadListingOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeThreadListingOwner.ts)
   - owns: session aggregation, sorting, and cursor pagination for listThreads.
   - query APIs: `listThreads`.
3. [`OpenCodeThreadCursorContracts.ts`](/Users/matthewfrench/GitHub/farfield/apps/ServerApplication/Source/Agents/Adapters/OpenCodeThreadCursorContracts.ts)
   - owns: cursor boundary contract encoding/decoding and schema enforcement.
   - query APIs: `encodeOpenCodeThreadCursor`, `decodeOpenCodeThreadCursor`.

## Web Application State Group

1. [`CoreDataStartupLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/CoreDataStartupLoader.ts)
   - owns: startup read orchestration and deferred hydration sequencing.
   - query APIs: `loadCoreData`.
2. [`ArchivedThreadLoader.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Application/StateManagement/ArchivedThreadLoader.ts)
   - owns: archived thread list hydration orchestration.
   - query APIs: `loadArchivedThreads`.

## Web Features Chat Group

1. [`SelectedThreadSnapshotStateOwner.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/StateManagement/SelectedThreadSnapshotStateOwner.ts)
   - owns: selected-thread snapshot application, stream cursor progression, and state mutation sequencing.
   - query APIs: `readNextStreamSequence`, `shouldSkipSnapshotApply`.
   - mutation APIs: `applySnapshots`, `applySelectedThreadStreamDelta`.
2. [`SelectedThreadReadCapabilitiesResolver.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadReadCapabilitiesResolver.ts)
   - owns: deterministic capability resolution from thread ownership and agent descriptors.
   - query APIs: `resolveReadCapabilitiesForThread`.
3. [`SelectedThreadStreamEventStateResolver.ts`](/Users/matthewfrench/GitHub/farfield/apps/WebApplication/Source/Features/Chat/DomainModel/SelectedThreadStreamEventStateResolver.ts)
   - owns: stream event append/reset merge policy and retention bounds.
   - query APIs: `resolveNextStreamEventsState`.

## Boundary Rules to Enforce in Reviews

1. Non-owner modules must not mutate owner-managed mutable state directly.
2. UI modules should consume typed owner APIs, not data-access transport modules.
3. Domain-model modules must stay pure and avoid state/data-access imports.
4. Agent modules must not import network ingress/route modules.
5. New mutable surfaces must declare an owner and be listed in this registry.

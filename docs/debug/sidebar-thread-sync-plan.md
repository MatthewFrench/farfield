# Sidebar Thread Sync Plan And Implementation

## Goal

Move the mobile and desktop sidebar off the generic `/api/threads` refresh path and onto a Farfield-owned sync contract that is designed around the sidebar feature.

The sidebar client should:

1. keep showing cached sidebar rows immediately
2. tell the server what snapshot it already has
3. receive either:
   - `notModified`
   - or a slim sidebar snapshot

## Why

The generic `/api/threads` path is broader than the sidebar feature needs.

Even after reducing duplicate mobile rendering and background refresh noise, the remaining dominant cost was still the thread-list route itself.

## Implemented Phase 1

Implemented server and client pieces:

1. `POST /api/sidebar/threads/sync`
2. strict shared request and response contracts in `@farfield/protocol`
3. deterministic `snapshotVersion` matching for `notModified`
4. dedicated bounded server-side sidebar snapshot cache
5. mutation-driven invalidation shared with the generic thread-list cache
6. web thread-list owner switched to sidebar sync for normal sidebar refresh

The current request contract includes:

1. `archived`
2. `limit`
3. `maxPages`
4. `sortKey`
5. `cwd`
6. `knownSnapshotVersion`

The response contract is:

1. `notModified`
2. `snapshot`

The snapshot payload reuses the slim Farfield thread-list item contract already used by the sidebar.

## Current Measured State

What is now true:

1. The repeated mobile sidebar loop no longer depends on `/api/threads`.
2. The main repeated request path is now `/api/sidebar/threads/sync`.
3. Direct authenticated shell timing for the new endpoint is good:
   - cold snapshot response about `236ms`
   - `notModified` response about `2ms`
   - warm cached snapshot response about `2ms`

What is still bad:

1. Chromium mobile sidebar profiling still exceeds freeze budgets.
2. WebKit mobile sidebar profiling is still severely bad.
3. The remaining issue appears to be repeated request scheduling and browser-side interaction behavior, not generic thread payload breadth.

## Server Responsibilities

1. Keep an explicit sidebar snapshot owner/cache keyed by sidebar query.
2. Reuse the last sidebar snapshot when it is still valid and not dirty.
3. Mark sidebar snapshots dirty on thread mutations and thread lifecycle changes.
4. Return `notModified` when the caller already has the current snapshot version.
5. Rebuild only when the snapshot is dirty, absent, or expired.

## Client Responsibilities

1. Keep the existing cached sidebar rows visible.
2. Send `knownSnapshotVersion` from the best available cached snapshot.
3. If the server replies `notModified`, reuse the cached rows directly.
4. If the server replies `snapshot`, replace the cached rows with the new snapshot.

## Next Investigation Targets

1. Reduce repeated sidebar sync request count during the mobile open/close loop.
2. Determine why WebKit still shows multi-second `/api/sidebar/threads/sync` request durations even though direct shell timing is fast.
3. Add a repeated mobile thread-open profile if thread-selection performance needs the same artifact-backed loop as sidebar-open.

## Success Criteria

1. Sidebar refresh does not require the client to fetch generic `/api/threads` for normal passive refresh.
2. The server can answer `notModified` without returning the full sidebar snapshot.
3. The mobile sidebar profiling artifacts show `/api/threads` removed from the sidebar loop.
4. The remaining freeze metrics move down without sacrificing cached-first sidebar behavior.

# Temporary Subagent Hardening Guide

Purpose:
Provide a shared, reusable instruction set for parallel subagents performing architecture hardening across Farfield.

Scope:
This guide is for staged execution:
1. File-level pass (one owner file per subagent).
2. Folder-level pass (resolve local cross-file issues).
3. Concern-level pass (contracts, observability, performance, test quality).
4. Final consistency pass.

Required reading before edits:
1. `/Users/matthewfrench/GitHub/farfield/AGENTS.md`
2. `/Users/matthewfrench/GitHub/farfield/docs/architecture.md`
3. `/Users/matthewfrench/GitHub/farfield/docs/proposed-structure-and-migration.md`
4. `/Users/matthewfrench/GitHub/farfield/docs/decisions/README.md`

Primary mission:
Increase safety, readability, maintainability, and performance predictability by:
1. Moving external-data uncertainty to boundaries.
2. Keeping internal contracts strict and explicit.
3. Reducing hidden complexity and duplicated literals.
4. Improving observability and targeted tests for critical paths.

Non-negotiable constraints:
1. No `as any`, no `unknown`, no type-introspection utilities for contracts.
2. Validate untrusted data at boundaries only, then map to app-owned internal contracts.
3. Do not add ad-hoc runtime shape checks in non-boundary logic for external payload uncertainty.
4. Keep one explicit owner for each mutable state surface.
5. Preserve module boundaries and dependency direction.
6. Keep naming explicit and avoid abbreviations.
7. Add high-value comments only where behavior is non-obvious.

Execution method (apply in order):
1. Identify uncertainty handling, repeated literals, and readability hotspots in assigned scope.
2. Introduce or refine boundary contract mapping where needed.
3. Replace repeated literals with owner constants.
4. Extract named helpers when inline expressions are dense or repeated.
5. Add short rationale comments for non-obvious thresholds/invariants.
6. Add or update focused tests for changed behavior and contracts.
7. Run focused checks for modified files.

Performance and observability expectations:
1. Avoid full-state work in high-frequency small-delta paths.
2. Keep logging bounded in high-frequency paths.
3. Ensure critical request and stream operations expose start, success/error, duration, and operation identity.
4. Add deterministic tests for replay/index-shift/reset scenarios where stream reducers are involved.

Testing expectations:
1. Boundary tests: reject invalid inputs with explicit errors.
2. Mapper tests: validate normalization and optionality semantics.
3. Domain tests: operate on trusted contracts only.
4. Hot-path tests: assert bounded side effects where applicable (parse/serialize/log budgets).

Phase-specific instructions:

File-level phase:
1. Treat assigned file as owned scope.
2. Minimize cross-file edits; if unavoidable, keep to smallest supporting change.
3. Prefer local refactors that improve clarity without broad behavior shifts.

Folder-level phase:
1. Resolve inconsistencies created by file-level divergence.
2. Consolidate duplicated constants and helper logic into clear owner modules.
3. Ensure folder contracts and naming are coherent.

Concern-level phase:
1. Validate boundary-to-domain data flow integrity.
2. Validate observability contract consistency.
3. Validate stream and patch performance behavior.
4. Validate test coverage quality for changed concerns.

Final pass:
1. Remove stale compatibility paths replaced by canonical owners.
2. Re-check layering and ownership constraints.
3. Ensure comments, constants, and tests align with current behavior.

Output format required from each subagent:
1. Findings summary:
   - What was unsafe or unclear.
   - Why it mattered.
2. Exact changes:
   - Files touched.
   - Contracts/constants/helpers/comments added or changed.
3. Tests:
   - Added or updated tests.
   - What behavior they prove.
4. Risks/follow-up:
   - Any deferred changes requiring broader scope.

Patch quality bar:
1. Small and reversible.
2. Behavior-preserving unless explicitly improving incorrect behavior.
3. Type-safe and explicit.
4. Readable by a new maintainer without hidden assumptions.

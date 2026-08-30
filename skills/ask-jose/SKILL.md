---
name: ask-jose
description: Choose the correct Jose Move skill or sequence. Use when a developer asks which Jose Move standard applies, wants help routing a Move task, or wants the complete Jose Move development flow.
---

# Ask Jose

Route the task to the smallest set of Jose Move skills that covers the risk. This skill is an explicit catalog, not a coding standard by itself.

## Skills

- `$jose-move-architecture`: package boundaries, module responsibilities, minimal state, canonical authority, dependency direction, on-chain scope, abilities, capabilities, and cross-package seams.
- `$jose-move-source-style`: module and function names, file sections, imports, visibility, `self` receiver naming, receiver syntax, direct UID access, pinned framework functions and macros, parameter and local discipline, API vocabulary, docs, and test-only seams.
- `$jose-move-security`: fail-fast ordering, authorization, signed actions, replay, bounded work, arithmetic, custody, external seams, time, oracles, randomness, pause, versioning, and upgrades.
- `$jose-move-events-errors`: completed-fact events, minimal payloads, native metadata, replay schemas, identity, ordering, wrapper/emitter architecture, stable error registries, abort ownership, and compatibility.
- `$jose-move-testing`: risk-based tests, exact failures, guard precedence, stateful hot-potato fixtures, property tests, event replay, dependency verification, and release gates.
- `$jose-move-review`: one full audit across all five standards.

## Common routes

### Design a new package or major feature

1. Run `$jose-move-architecture` before defining public ABI or storage.
2. Run `$jose-move-security` before settling authority, lifecycle, or economic transitions.
3. Apply `$jose-move-source-style` while writing modules.
4. Apply `$jose-move-events-errors` when defining transition diagnostics and indexing ABI.
5. Apply `$jose-move-testing` before implementation is complete.
6. Finish with `$jose-move-review`.

### Change an existing state transition

Apply `$jose-move-security`, `$jose-move-source-style`, and `$jose-move-testing`. Add `$jose-move-events-errors` when event, error, guard precedence, or replay behavior can change. Add `$jose-move-architecture` when state ownership, authority, abilities, visibility, or package boundaries can change.

### Add or change a module, type, or public API

Apply `$jose-move-architecture` and `$jose-move-source-style`. Add `$jose-move-security` for any authority, asset, lifecycle, or shared-state type. Treat published signatures and abilities as compatibility commitments.

### Add events or errors

Apply `$jose-move-events-errors`, then `$jose-move-testing`. Add `$jose-move-security` when the diagnostic change exposes a new guard, authorization check, or economic transition.

### Audit redundancy or simplify Move code

Apply `$jose-move-architecture` to storage and public seams, `$jose-move-events-errors` to whole events and payload fields, and `$jose-move-source-style` to parameters, helpers, and locals. Apply `$jose-move-testing` before removing a fact or seam. Add `$jose-move-security` when simplification can change guards, authority, assets, or evaluation order.

### Build or repair tests

Apply `$jose-move-testing`. Also apply the skill that owns the behavior under test; tests must prove the rule, not invent it.

### Review a branch or pull request

Use `$jose-move-review`. It loads all five standards and reports findings by severity.

## Routing rule

When uncertain, include security and testing. Do not load every skill for a narrow naming question, and do not treat source style as a substitute for architecture or security.

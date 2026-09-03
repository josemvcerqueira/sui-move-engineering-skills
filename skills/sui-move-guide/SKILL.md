---
name: sui-move-guide
description: Route Sui Move engineering tasks to the smallest applicable skill sequence. Use when a developer asks which Sui Move standard applies, wants help routing a Move task, or wants the complete Sui Move development flow. Requires the complete suite installation to execute the selected route.
---

# Sui Move Guide

Route the task to the smallest set of Sui Move skills that covers the risk. Use
this skill as an explicit catalog, not a coding standard.

## Require the complete suite

Use the catalog to explain a route even when only this skill is available.
Before applying the route, verify that every selected sibling skill is
installed. If one is missing, tell the user to install the complete suite; do
not reconstruct or silently skip its rules.

## Skills

- `$sui-move-architecture`: package boundaries, module responsibilities,
  minimal state, reusable value invariants, events and replay, canonical
  authority, dependency direction, on-chain scope, abilities, capabilities,
  and composition seams.
- `$sui-move-source-style`: sections, imports, names, visibility, signatures,
  errors and abort ownership, receiver and index syntax, direct UID access,
  pinned library reuse, locals, API vocabulary, documentation, and test-only
  seams.
- `$sui-move-security`: fail-fast ordering, authorization, signed actions,
  replay, bounded work, arithmetic, custody, integrations, time, oracles,
  randomness, pauses, versions, and upgrades.
- `$sui-move-testing`: risk-based tests, exact failures, guard precedence,
  fixtures, properties, event replay, integrations, upgrades, dependencies, and
  release gates.
- `$sui-move-patterns`: selection and application of the suite's promoted
  reusable designs.
- `$sui-move-review`: one complete audit across all focused standards.

## Common routes

### Design a new package or major feature

Apply architecture before public ABI or storage, then security, source style,
and testing. Finish with review. Read each standard only once per task.

### Change an existing state transition

Apply security, source style, and testing. Add architecture when state
ownership, authority, abilities, visibility, storage, event emission, replay,
or package boundaries can change. Source style owns any changed error
representation; security owns guard behavior and precedence.

### Add or change a module, type, or public API

Apply architecture and source style. Add security for authority, asset,
lifecycle, or shared-state types. Preserve published function signatures and
datatype layouts; the focused skills own migration details.

### Upgrade a package or migrate state

Apply architecture, security, source style, and testing. Load architecture's
event reference or source style's error reference when indexed or diagnostic
behavior changes. Finish with review for a release-wide audit.

### Add events or errors

For events, apply architecture and testing. For errors, apply source style and
testing; add security when guard order, authorization, or transition behavior
can change.

### Audit redundancy or simplify Move code

Apply architecture to state, public seams, events, and replay; apply source
style to code shape and errors; apply testing before removal. Add security when
simplification can change guards, authority, assets, composition, or evaluation
order.

### Build or repair tests

Apply testing plus the focused skill that owns the behavior under test. Tests
prove rules; they do not invent them.

### Select, compare, or apply a reusable pattern

Apply patterns when the task asks for a named reusable design or matches a
promoted pattern's problem. Then apply only the focused standards that own the
selected design's invariants.

### Review a branch or pull request

Use review. It loads every focused standard and requires the complete suite.

## Routing rule

When uncertain, include security and testing. Do not load every skill for a
narrow naming question, and do not treat source style as a substitute for
architecture or security.

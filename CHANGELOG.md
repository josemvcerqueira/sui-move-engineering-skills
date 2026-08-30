# Changelog

This file records user-visible changes to the complete Jose Move skill suite.

## [0.1.0] - 2026-08-30

First formal release after auditing the skills against Blast contract decisions, pinned Sui framework behavior, and authoritative cross-chain smart-contract security guidance.

### Added

- Fail-fast, validate-before-mutation transition ordering and explicit handling for effectful dependency handoffs.
- Conditional security guidance for signatures, time, oracles, randomness, hostile assets, authority liveness, and dependency upgrades.
- Source rules for `self`, receiver syntax, direct UID access, pinned framework and macro reuse, and useful local variables.
- Event rules for replay-complete minimal payloads, native metadata, deliberate redundancy, and stable abort ownership.
- Adversarial and stateful test coverage for the new security and compatibility rules.
- Installer-based release validation for every discovered `SKILL.md`.

### Affected skills

- `ask-jose`
- `jose-move-architecture`
- `jose-move-events-errors`
- `jose-move-review`
- `jose-move-security`
- `jose-move-source-style`
- `jose-move-testing`

### Action required

- New users: install the suite with `npx skills add josemvcerqueira/jose-move-skills -g --all`.
- Existing users: run `npx skills update -g`, or update one skill with `npx skills update <skill-name> -g`.
- No skill was removed or renamed in this release.

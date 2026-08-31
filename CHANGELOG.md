# Changelog

This file records user-visible changes to the complete Sui Move engineering skill suite.

## [0.3.1] - 2026-08-31

This patch restores progressive disclosure for the package-upgrade posture guidance.

### Changed

- Load the detailed upgrade-posture reference only when publication, deployment, upgrades, immutability, package-capability custody, operational versioning, or uncertain classification makes it relevant.
- Keep the three-posture classification in the core review workflow so ordinary reviews retain the decision without always loading the detailed reference.

### Affected skills

- `sui-move-review`

### Action required

- Existing users: run `npx skills update -g` to install the corrected loading rule.
- No review requirement or invocation workflow changed.

## [0.3.0] - 2026-08-31

This release makes package upgrade posture an explicit part of full Sui Move reviews.

### Added

- A package-upgrade posture reference that distinguishes intentionally immutable, simple upgradeable, and evolving shared-state packages.
- Conditional guidance for `Publisher` claims, `UpgradeCap` custody, operational version gates, immutable-release evidence, and already-published limitations.
- The pinned Blast V2 capability-custody and operational-cutover implementation as the concrete reference for matching stateful protocols.

### Changed

- Full package and release reviews now establish publication status and classify upgrade posture before reporting missing upgrade machinery as a defect.
- Review findings must avoid imposing package administration or version state on immutable or simple packages without a concrete risk or accepted roadmap requirement.

### Affected skills

- `sui-move-review`

### Action required

- Existing users: run `npx skills update -g` to install the new review rule and bundled reference.
- No skill was renamed or removed, and no invocation workflow is incompatible.

## [0.2.1] - 2026-08-30

This patch removes ambiguous prose conjunctions from bulleted decision and source lists.

### Changed

- Stated explicitly that any one on-chain placement condition is sufficient, then removed the trailing `or` from the list.
- Clarified that event reconstruction may use the listed durable sources alone or in combination, then removed the trailing `and` from the list.
- Added release validation to reject skill Markdown bullets ending in `; and` or `; or`.

### Affected skills

- `sui-move-architecture`
- `sui-move-events-errors`

### Action required

- Existing users: run `npx skills update -g` to install the clarified wording.
- No skill behavior, name, or invocation workflow changed.

## [0.2.0] - 2026-08-30

This release expands the suite's Sui-specific architecture, upgrade, event, source-style, testing, and DeFi security guidance while reducing the context loaded for unrelated tasks.

### Added

- Package-wide invariant and liveness analysis across every public or entry function, same-PTB composition, and reachable multi-transaction sequence.
- DeFi security rules for shares, liquid staking, farms, reward checkpointing, AMMs, lending, liquidation, rounding, dust, first-depositor defenses, and flash-capital attack sequences.
- Current Sui package-upgrade rules for immutable versions, fixed public signatures and datatype layouts, initializer non-rerun, operational version gates, dependency relinking, and explicit state migration.
- Event ABI guidance for stable type identity, versioned replacement payloads, replay completeness across old package versions, and envelope-based payload discovery.
- Move 2024 source rules for non-public `entry` endpoints, public type visibility versus authority, canonical index syntax, and custom `#[syntax(index)]` accessors.
- ProtocolConfig-aware selective-commit tests for every outcome-dependent `sui::random` resource limit.
- Research notes documenting the upgrade-compatibility and DeFi-security evidence behind the new rules.

### Changed

- Clarified on-chain scope, invariant ownership, administrative module boundaries, collection storage choices, child lifecycle, dependency distrust, and upgrade seams.
- Made event reconstruction, payload necessity, deliberate redundancy, and indexing migration rules more explicit for LLM readers.
- Moved detailed DeFi guidance into `sui-move-security/references/defi-security.md`; non-DeFi security tasks now load a smaller core skill.
- Moved pinned dependency resolution and framework-reuse procedures into `sui-move-source-style/references/pinned-library-reuse.md`; unrelated source-style tasks no longer pay that context cost.
- Preserved all extracted rules behind explicit instructions to read each reference completely when its subject applies.
- Extended release validation to keep the manifest, changelog, and README versions aligned and reject missing relative files in both the source tree and installer output.

### Affected skills

- `sui-move-guide`
- `sui-move-architecture`
- `sui-move-events-errors`
- `sui-move-review`
- `sui-move-security`
- `sui-move-source-style`
- `sui-move-testing`

### Action required

- Existing users: run `npx skills update -g` to install the updated skill bodies and bundled references.
- No skill was renamed or removed, and no invocation workflow is incompatible.

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

- `sui-move-guide`
- `sui-move-architecture`
- `sui-move-events-errors`
- `sui-move-review`
- `sui-move-security`
- `sui-move-source-style`
- `sui-move-testing`

### Action required

- New users: install the suite with `npx skills add josemvcerqueira/sui-move-engineering-skills -g --all`.
- The initial release uses the `sui-move-*` skill namespace; no migration is required.

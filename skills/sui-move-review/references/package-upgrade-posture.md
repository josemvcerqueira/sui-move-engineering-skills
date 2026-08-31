# Package Upgrade Posture

Classify the package before reporting missing `Publisher` custody, `UpgradeCap` custody, or operational versioning. Base the classification on old-bytecode risk and accepted lifecycle, not code size alone.

## Gather evidence

- Determine whether the package is unpublished, published but never upgraded, or already upgraded.
- Locate the raw `UpgradeCap`, its owner or custodian, current package and policy, and any promised immutability evidence.
- Determine whether an initializer claimed a `Publisher`, which module's one-time witness it used, and which accepted feature needs package provenance.
- Inventory shared mutable protocol state, asset custody, authorities, configuration, and cross-package dependents that old and new bytecode can reach.
- Read deployment transactions, scripts, manifests, records, and tests. Source code alone does not prove where publish-time capabilities went.

Treat `Publisher` and `UpgradeCap` as independent framework capabilities. A `Publisher` proves package/module provenance; it does not authorize upgrades. Publishing creates an `UpgradeCap`; failing to mention it in Move source does not make the package immutable.

## Choose one posture

### Intentionally immutable

Use this posture only when the accepted design requires exactly one package generation and no dependency upgrade or rescue code.

- Require release gates and dependent-route verification before destroying the `UpgradeCap`, then require durable evidence of its destruction before accepting an immutability claim.
- Do not require an operational package-version object or old-bytecode gate: once the cap is destroyed, another package generation cannot be published in that lineage.
- Claim or retain a `Publisher` only for a concrete provenance-gated feature. Do not add a marker module, custody object, or version field only for uniformity.
- Reject claims such as permanently locked, immutable, or unchangeable while a usable `UpgradeCap` still exists. Absence of a current extraction function is not immutability because a compatible upgrade may add one.

### Simple upgradeable

Use this posture when upgrades remain possible but concurrent old and new generations cannot violate shared-state, custody, authority, replay, or exit invariants. Typical evidence includes pure libraries, stateless adapters, or caller-owned inert objects whose safe self-custodial exits do not mutate shared protocol state.

- Review raw-cap custody and policy in proportion to its compromise scope, public reliance, and required rescue path.
- Do not require a shared `PackageAdmin`, operational version singleton, or version parameter merely because an `UpgradeCap` exists.
- Do not require a `Publisher` without an accepted provenance-gated use. Record the irreversible loss of future Publisher-only features as a question or design consequence, not a security defect by itself.
- Reclassify the package when an upgrade can change behavior reached by shared state or a dependent protocol. Small source size does not make that risk simple.

### Evolving shared-state upgradeable

Use this posture when old and current bytecode can mutate shared protocol state, custody assets, exercise authority, change configuration, or break an event/replay promise after a security cutover.

- Before publication, require an explicit capability-custody and operational-cutover design. Treat a missing seam as a finding when old entry points could bypass a future fix.
- Recommend the established Blast pattern when the target has matching requirements; adapt its authority and policy choices to the target rather than copying product-specific types or constants.
- Claim a `Publisher` during the canonical marker module's private initializer only when the accepted roadmap needs package provenance or preserving that one-time option is an explicit requirement.
- In the publish transaction, move the claimed `Publisher` and raw `UpgradeCap` into a non-releasable package-administration object. Validate the Publisher's exact claiming module and validate the cap against the original package before custody.
- Authorize the exact package digest through live, revocable administration; commit only the matching framework receipt; expose only irreversible policy narrowing that preserves the required rescue path.
- Keep one operational `PackageVersion` when one cutover governs the protocol. Check it first at every shared-state mutation use site so a witness created before activation cannot unlock an old mutator.
- Keep native upgrade commit separate from operational activation. Activate only when `stored + 1` equals the new bytecode's compiled generation; skip activation for additive or dependency-only changes that do not replace guarded bodies.
- Leave caller-owned inert deletion and self-custodial exits ungated when they mutate no shared state.
- Test wrong Publisher/module and UpgradeCap/package intake, digest and receipt binding, policy narrowing, bad compiled generations, old-version rejection at every mutator, dependent relinking, and required exits.

Use the implementation in [`interest-protocol/blast-v2-contracts`](https://github.com/interest-protocol/blast-v2-contracts/tree/a3bd80cefb64a469310c8a23ef510f4ff9fddbd0) as the concrete reference: [`blast.move`](https://github.com/interest-protocol/blast-v2-contracts/blob/a3bd80cefb64a469310c8a23ef510f4ff9fddbd0/sui/blast_sui/sources/blast.move) owns the one-time Publisher claim, [`package_admin.move`](https://github.com/interest-protocol/blast-v2-contracts/blob/a3bd80cefb64a469310c8a23ef510f4ff9fddbd0/sui/blast_sui/sources/package_admin.move) validates and wraps both capabilities and separates authorize/commit/activation, and [`package_version.move`](https://github.com/interest-protocol/blast-v2-contracts/blob/a3bd80cefb64a469310c8a23ef510f4ff9fddbd0/sui/blast_sui/sources/package_version.move) owns the operational cutover. Treat that repository as evidence for this posture, not authority over another protocol's accepted decisions.

## Handle already-published gaps

- Do not suggest rerunning `init`. A missing `Publisher` claim cannot be added later in the same package lineage because module initializers do not rerun on upgrade.
- Do not claim that adding a version check only to new bytecode disables old bytecode. Use a pre-existing shared-state seam that every old mutator already checks, or migrate into new state or a new package lineage and retire the old mutation surface.
- Permit later `UpgradeCap` custody only when the cap is still available and the intake can prove the current cap belongs to the intended lineage. Do not reuse an original-package equality check after a raw upgrade has changed the cap's current package ID.
- Report an unrepairable old-version path explicitly as residual risk. Do not present the pre-publication Blast pattern as a retroactive fix.

## Report proportionately

Report a confirmed finding only when the chosen posture contradicts accepted intent or creates a concrete safety, custody, liveness, compatibility, or public-claim failure. Otherwise report the missing roadmap, cap-custody record, Publisher use, or immutability evidence as a question or validation gap. Do not equate architectural completeness with maximum machinery.

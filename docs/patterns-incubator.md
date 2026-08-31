# Pattern and anti-pattern incubator

This scratchpad collects candidate Sui Move engineering patterns and
anti-patterns before they are mature enough to become a skill. Entries here
are working notes, not installed guidance. Promote an entry only after it has
clearly stated applicability and tradeoffs, a sound technical basis, and rules
that generalize beyond one implementation.

References in this file follow the [durable reference policy](reference-policy.md):
local notes are named and written for the reusable pattern, while direct
framework citations use commit-pinned Sui source.

## Promotion checklist

An entry remains a **Candidate** until every item below has reviewable evidence
in this repository. Mark it **Promotion-ready** only after the complete gate
passes. Mark it **Promoted** only when the guidance is installed through an
owning skill and removed from this incubator.

### Entry gate

- **Reusable problem:** State the recurring problem independently of the
  implementation where it was discovered.
- **Applicability boundary:** Say when to use the pattern, when not to use it,
  and which simpler or safer alternative should be preferred outside its
  boundary.
- **Invariant and sequence:** State the safety or liveness invariant and the
  ordered construction, validation, mutation, custody, and cleanup steps that
  preserve it.
- **Tradeoffs and failure modes:** Cover authority, abilities, composition,
  abort behavior, liveness, gas or storage cost, upgrades, and dependency risk
  wherever they apply.
- **Verification obligations:** Specify positive, negative, boundary,
  adversarial-composition, rollback, and compatibility tests appropriate to
  the pattern.
- **Technical basis:** Support non-obvious compiler or framework claims with a
  pinned source, verified toolchain behavior, or reasoning from established
  Move semantics as appropriate. Examples may strengthen the case, but no
  example count is required.
- **Standard alignment:** Resolve conflicts with existing skills and identify
  which skill owns the underlying invariant. The pattern may add a reusable
  implementation recipe, but must not fork the normative rule.

### Full-skill gate

Create an installable patterns skill only when all of these conditions hold:

- At least three entries are **Promotion-ready** and cover recurring, distinct
  design problems.
- The skill has a narrow trigger for selecting, comparing, implementing, or
  reviewing Sui Move patterns without competing with ordinary architecture or
  security tasks.
- Its `SKILL.md` contains only the selection workflow and a compact routing
  matrix. Put each detailed pattern in a directly linked `references/` file so
  unrelated patterns are not loaded.
- The guide routes explicit pattern-selection tasks to the new skill. Existing
  architecture, security, source, event, and testing skills continue to own
  their normative invariants.
- Clean-context forward tests cover selection, rejection, combination, and
  conflict resolution across the promoted entries.
- Repository validation discovers and installs the skill, validates its local
  links and metadata, and leaves the complete suite within its release gates.

## Current assessment

This assessment applies the checklist to the evidence currently committed in
this repository. Update it whenever an entry or its evidence changes.

| Entry | Assessment | Result | Remaining work |
| --- | --- | --- | --- |
| Guard–Refresh–Guard | The problem, boundary, rollback basis, and alignment exception are clear. It does not yet specify the tests needed to preserve rollback, gas, and abort-precedence behavior. | Candidate | Add explicit verification obligations. |
| Construct–Attach–Finalize | The problem, sequence, abilities, and pinned framework basis are clear. Failure modes, alternatives, and required tests are incomplete. | Candidate | Add use-and-avoid guidance plus escape, missing-child, duplicate-child, and finalization tests. |
| Store–Probe–Recover | The type-recovery sequence, cleanup, security limits, alternatives, and pinned primitive are clear. Required verification is missing. | Candidate | Add specialized, fallback, wrong-type, replacement, and cleanup test obligations. |

**Result:** none of the three remaining entries passes the complete entry gate.
Five entries that did pass were promoted to
[`$sui-move-patterns`](../skills/sui-move-patterns/SKILL.md), where each now
ships as a conditional reference: Define–Export–Ignore,
Validate–Issue–Consume, Bind–Handoff–Redeem, Wrap–Wait–Redeem, and
Consume–Replace–Retire.

## Guard–Refresh–Guard

**Status:** Candidate anti-pattern

### Precondition duplicated around a rollback-safe refresh

When a mandatory refresh is immediately followed by a guard, placing the same
guard before the refresh usually adds no state-safety guarantee. If the refresh
or the post-refresh guard aborts, Move rolls back the refresh along with the
rest of the transaction. The duplicate guard creates visual noise and gives
two copies of one rule a chance to drift apart.

```move
// Avoid: the first guard cannot observe what refresh discovers.
position.assert_redeemable();
position.refresh(clock);
position.assert_redeemable();

// Prefer: validate once at the first point with complete information.
position.refresh(clock);
position.assert_redeemable();
```

Remove the pre-refresh duplicate only when all of these conditions hold:

- The refresh is mandatory on every successful path and is fully rolled back
  if this transaction later aborts.
- Both guards enforce the same invariant with the same canonical predicate and
  error semantics.
- No asset handoff, external effect, irreversible operation, or other mutation
  that must survive independently occurs between the two guards.
- The post-refresh guard runs before any subsequent mutation, asset movement,
  event emission, or return that depends on the invariant.
- The earlier guard is not deliberately preserving diagnostic precedence or
  avoiding a materially expensive refresh for an already-invalid pre-state.

Keep distinct guards when the refresh can introduce a different invalid state,
when callers rely on the earlier abort taking precedence over a refresh-time
failure, or when rejecting before expensive work is an accepted fail-fast
requirement. In those cases, name or structure the checks so their different
roles are explicit instead of presenting them as accidental duplication.

The central principle is: validate at the earliest point where all required
state is known, unless a documented cost or error-precedence contract justifies
an earlier check too.

## Construct–Attach–Finalize

**Status:** Candidate

### Composable staged construction

When an object needs multiple independently produced resources before an
irreversible ownership transition, separate assembly from finalization.

```move
let mut admin = package_admin::new(publisher, upgrade_cap, ctx);
admin.add_capability(authority, metadata_cap);
admin.add_capability(authority, display_cap);
admin.share();
```

Rules:

- `new` validates fixed identity inputs and returns either the unshared,
  key-only target object or a no-ability initializer that contains it.
- Each `add_*` or configuration function performs one authorized attachment or
  transition on the incomplete value.
- Use `dynamic_object_field` for child objects with `UID`.
- Key generic children by their exact type and reject duplicate occupancy.
- `share`, `freeze`, or `finalize` verifies all mandatory children, consumes any
  initializer wrapper, then performs the irreversible transition.
- The incomplete target or its initializer wrapper must not have `store` or
  `drop`, so incomplete construction cannot escape. A wrapper should have no
  abilities when the caller must be forced to finalize it.
- A one-shot helper may compose these primitives, but must not duplicate their
  logic.

The central principle is: keep functions single-purpose and keep every
pre-finalization step composable within one PTB.

First-party evidence: Sui's no-ability `CurrencyInitializer<T>` wraps an
incomplete `Currency<T>`, supports regulated and supply-model configuration,
and is consumed by `finalize` before the currency is transferred or shared
([`coin_registry.move`](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-framework/sources/registries/coin_registry.move#L160-L345)).

## Store–Probe–Recover

**Status:** Candidate

### Dynamic-field type recovery

When a function accepts an object of generic type `T`, but particular concrete
types require specialized handling, temporarily store the object as a dynamic
object field. The field records its actual type, allowing the function to test
for an exact type and remove the object through the matching typed branch.

```move
use sui::coin::Coin;
use sui::dynamic_object_field as dof;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::tx_context::TxContext;

struct TypeSlot has key {
    id: UID,
}

struct AssetKey has copy, drop, store {}

fun route<T: key + store>(asset: T, ctx: &mut TxContext) {
    let mut slot = TypeSlot { id: object::new(ctx) };
    dof::add(&mut slot.id, AssetKey {}, asset);

    if (dof::exists_with_type<AssetKey, Coin<SUI>>(
        &slot.id,
        AssetKey {},
    )) {
        let sui = dof::remove<AssetKey, Coin<SUI>>(
            &mut slot.id,
            AssetKey {},
        );
        handle_sui(sui);
    } else {
        let asset = dof::remove<AssetKey, T>(
            &mut slot.id,
            AssetKey {},
        );
        handle_default(asset);
    };

    let TypeSlot { id } = slot;
    object::delete(id);
}
```

Rules:

- Use `dynamic_object_field` when the value is an object with `key + store`;
  use `dynamic_field` for a non-object value that only has `store`.
- Add the generic value once under a private, fixed key before probing it.
- Probe with `exists_with_type` for an exact, fully instantiated type such as
  `Coin<SUI>`. It cannot ask whether a value is “any coin” or “any NFT”.
- Remove a specialized value only after the corresponding type check succeeds.
- The fallback branch removes the value as the original `T`.
- Keep the holder private or otherwise access-controlled so no command can
  replace the field between the check and removal.
- Remove the field and destroy or retain the empty holder deliberately on every
  successful path.
- Each specialized branch must still enforce its own identity, authority, and
  economic invariants. Runtime type recovery is not authorization.
- Prefer ordinary static typing or an explicit variant when all accepted types
  are known at the interface. Use this pattern at a genuinely generic or
  type-erased boundary.

This pattern does not convert `T` into a coin or NFT. It temporarily erases the
caller's static access to the value, proves that the stored value already has a
specific runtime type, and then recovers it as that type.

Reference: Sui Framework
[`dynamic_object_field`](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-framework/sources/dynamic_object_field.move).

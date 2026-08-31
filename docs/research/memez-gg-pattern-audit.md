# `memez-gg` reusable-pattern audit

## Scope and conclusion

This audit inspected `interest-protocol/memez-gg` at commit
[`00596fdac4dd11f427c7bc594e566ce36160db93`](https://github.com/interest-protocol/memez-gg/commit/00596fdac4dd11f427c7bc594e566ce36160db93)
(2025-11-05). It reviewed the Move implementation and tests, treating the
repository as evidence rather than assuming every local technique should become
general guidance.

One pattern is strong enough to add to the incubator: **Bind–Handoff–Redeem**, a
no-ability asset handoff unlocked by the exact sealed witness type selected by
the originating object. It is a coherent cross-package composition pattern and
is materially different from the incubator's **Validate–Issue–Consume**
authorization proof.

The phantom-keyed configuration registry is promising but should remain on a
watch list until it has a second implementation and clearer bounds. The
permissionless wallet compactor should not be promoted without an explicit
storage-rebate policy. The owner-pinned vesting object is a useful application
of ability control, but fits better as a finalization variant or supporting
example than as a separate pattern. The version-change handshake is good, but
is adapted almost directly from Mysten Labs' framework implementation and
should be sourced there rather than attributed to this repository.

| Candidate | Recommendation |
| --- | --- |
| Bind–Handoff–Redeem | Add to the incubator |
| Phantom-keyed configuration profiles | Hold for another implementation |
| Permissionless receive–compact–claim | Do not add without a rebate policy |
| Module-gated landing of a key-only object | Use as a finalization example; do not add separately yet |
| Remove–transform–reinsert with `VersionChangeCap` | Cite the Sui framework; do not add as a `memez-gg` discovery |
| Closure-projected transition macros | Interesting, but hold |

## Add: Bind–Handoff–Redeem

### Shape

When core state must transfer custody to one selected external integration
without importing that integration, bind the selection to a sealed witness
type, place the assets in a non-copyable, non-droppable, non-storable handoff,
and require the exact witness to consume the handoff and release its contents.

The repository's `MemezMigrator<Meme, Quote>` has no abilities and contains the
two balances, the originating pool address, the developer address, and the
selected witness `TypeName`
([`fun/sources/memez_fun.move`, lines 48–54](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L48-L54)).
Pool construction records `type_name::get<MigrationWitness>()`
([lines 122–169](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L122-L169)),
after configuration has checked that the witness type is allowed
([`fun/sources/config.move`, lines 104–117](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L104-L117),
[`fun/sources/pump.move`, lines 58–80](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/pump.move#L58-L80)).

The lifecycle transition sets the pool to `Migrated` and returns the linear
handoff with the assets
([`fun/sources/memez_fun.move`, lines 503–518](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L503-L518)).
`destroy<Witness>` consumes that handoff, checks exact `TypeName` equality, emits
the migration event, and releases the balances
([lines 71–87](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L71-L87)).
An adapter defines its own fieldless `Witness`
([`migrators/xpump/sources/xpump.move`, lines 47–54](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/migrators/xpump/sources/xpump.move#L47-L54))
and can therefore construct the value locally when it redeems the handoff
([lines 177–194](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/migrators/xpump/sources/xpump.move#L177-L194)).
A minimal adapter demonstrates the same boundary without venue-specific logic
([`migrators/dummy/sources/dummy.move`, lines 3–21](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/migrators/dummy/sources/dummy.move#L3-L21)).

The negative test passes a different type and expects `EInvalidWitness`
([`fun/tests/memez_fun.move`, lines 428–461](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/tests/memez_fun.move#L428-L461)).
Because `MemezMigrator` has neither `drop` nor `store`, a successful transaction
cannot discard or persist an incomplete migration. The selected adapter must
redeem it in the same PTB, and an adapter abort rolls back the originating state
transition and asset movement atomically.

### Why it generalizes

The pattern creates a narrow dependency direction:

```text
core chooses witness type and seals assets
        ↓
linear handoff crosses the package boundary
        ↓
selected adapter constructs its sealed witness and settles
```

The core package does not import a DEX, bridge, auction venue, or other volatile
integration. The adapter depends inward on a small core redemption seam. The
handoff also prevents replay and partial completion without storing a separate
`settled` flag.

This is not **Validate–Issue–Consume**. In that pattern, canonical authority
state validates a durable cap and issues a short-lived proof to downstream
consumers. Here, the selected downstream module constructs its own sealed type
to identify itself, while the upstream core supplies a linear value carrying
assets that must be redeemed exactly once.

### Rules and limitations

- Admit only a module-sealed witness whose construction paths have been audited.
  Exact `TypeName` equality proves type identity, not that construction is
  exclusive. A primitive, vector, or publicly constructible type would let any
  caller redeem the handoff if configuration mistakenly admitted it. The
  repository's allowlist checks membership but does not enforce this property
  ([`fun/sources/config.move`, lines 167–177](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L167-L177)).
- Choose type identity deliberately. The Sui `TypeName` API distinguishes
  defining IDs from original package-lineage IDs
  ([`type_name.move`, lines 40–51](https://github.com/MystenLabs/sui/blob/209f0da8e316/crates/sui-framework/packages/move-stdlib/sources/type_name.move#L40-L51)).
  Current code should use the explicit API that matches the intended upgrade
  boundary instead of relying on the deprecated `get` name.
- Bind the handoff to the originating object and domain. This implementation
  carries the pool address and the concrete asset types, which are included in
  the migration event and returned balances.
- Treat witness approval and witness revocation separately. Removing a witness
  from the creation-time configuration does not alter the witness already
  recorded inside an existing pool. If live revocation is required, redemption
  must consult canonical live state without making the adapter the custodian of
  that state.
- A sealed adapter identity does not prove correct venue settlement. Validate
  every invariant that must remain under core control before releasing custody,
  and validate adapter outputs when the protocol requires a synchronous result.
- Give the handoff no `copy`, `drop`, `store`, or `key`; give the sealed witness
  only the abilities its construction and consumption actually require.

## Hold: phantom-keyed configuration profiles

`MemezConfig` is a key-only shared parent with no fixed configuration fields.
Separate phantom key families such as `FeesKey<T>`, `QuoteListKey<T>`, and
`MigratorWitnessKey<T>` namespace each concern and each profile
([`fun/sources/config.move`, lines 13–29](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L13-L29)).
Admin setters derive storage slots from a generic `ConfigWitness`
([lines 41–118](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L41-L118)),
while package-only accessors retrieve the chosen profile and check type
membership
([lines 120–178](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L120-L178)).
The generic helpers implement replaceable values and type sets
([lines 180–211](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/config.move#L180-L211)).

This is a real reusable idea: a static marker chooses one configuration family,
and concern-specific phantom wrappers prevent slot collisions within that
family. Sui dynamic-field identity includes the parent, the name value, and the
name's type, which is the mechanism that makes typed keys effective
([`dynamic_field.move`, lines 25–52](https://github.com/MystenLabs/sui/blob/209f0da8e316/crates/sui-framework/packages/sui-framework/sources/dynamic_field.move#L25-L52)).
It is distinct from **Store–Probe–Recover** because values are durably stored in
statically selected namespaces; no deposited value is type-erased and probed.

It is not ready for promotion from one implementation:

- The tests cover one fee profile and quote-type rejection, but do not explicitly
  prove isolation between two profile marker types
  ([`fun/tests/config.move`, lines 29–114](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/tests/config.move#L29-L114)).
- Missing or schema-mismatched dynamic fields abort at runtime. Every key family
  needs one canonical value type and migration policy.
- All profiles share one parent object, so they share its access and contention
  boundary.
- Type sets and the number of profile fields can grow without an enforced bound.
- Type identity across upgrades or package replacement must be intentional.
- A separate typed configuration object is simpler when callers do not actually
  need several profiles under one registry.

Recommendation: retain this as a watch-list candidate and promote it only after
another implementation demonstrates the same need with bounded storage,
cross-profile isolation tests, and a clear upgrade story.

## Reject for now: permissionless wallet compaction

The wallet separates maintenance from withdrawal. `MemezWallet` is a key-only
shared object with a recorded logical owner
([`periphery/wallet/sources/wallet.move`, lines 13–24](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/periphery/wallet/sources/wallet.move#L13-L24)).
`receive` and `receive_coins` assert that `ctx.sender()` is the owner, but
`merge_coins` is deliberately permissionless and transfers its output back to
the wallet address
([lines 71–97](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/periphery/wallet/sources/wallet.move#L71-L97)).
The tests explicitly say “Anyone can merge,” then separately prove owner-only
withdrawal and unauthorized rejection
([`periphery/wallet/tests/wallet_tests.move`, lines 101–130 and 137–229](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/periphery/wallet/tests/wallet_tests.move#L101-L130)).

The asset amount remains in the wallet's custody, but that is not the complete
economic effect. The fold starts with a newly created zero coin and joins every
received coin into it
([`wallet.move`, lines 115–124](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/periphery/wallet/sources/wallet.move#L115-L124)).
Sui's `Coin::join` deletes the consumed coin's UID
([`coin.move`, lines 163–169](https://github.com/MystenLabs/sui/blob/b448b1d971bd6c1aac8ef4eee4305943806d5d5b/crates/sui-framework/packages/sui-framework/sources/coin.move#L163-L169)).
Deleting stored data creates a partial storage-fee refund
([Sui tokenomics overview](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/docs/content/develop/sui-architecture/tokenomics-overview.mdx#L140-L149)),
and Sui records that storage rebates have already been refunded to transaction
senders' gas coins
([`sui_system.move`, lines 582–587](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-system/sources/sui_system.move#L582-L587)).
The permissionless caller can therefore receive the rebates associated with the
wallet's old coin objects while paying for the replacement object's storage.
That may be a deliberate keeper bounty, but it is an economic transfer, not
purely neutral maintenance.

There are additional edge cases: an empty vector creates and sends a new zero
coin instead of compacting anything; a one-coin call churns object identity
without reducing the count; repeated calls contend on the shared wallet; and
unsolicited objects remain an inbox-spam problem. The current tests assert coin
value conservation but do not assert gas, rebate, minimum batch size, or empty
input behavior.

Recommendation: do not add **Receive–Compact–Claim** as written. A future
permissionless-maintenance pattern must state who owns deletion rebates, whether
they are an intentional keeper reward, the minimum useful batch, spam and
contention limits, and whether changing child object IDs is acceptable. If the
rebate belongs economically to the wallet owner, require owner authorization or
another mechanism that preserves that value.

## Supporting example: module-gated landing of a key-only object

`MemezSoulBoundVesting<T>` has `key` but not `store`, records an owner, and holds
the vested balance
([`vesting/sources/soulbound.move`, lines 7–14](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/vesting/sources/soulbound.move#L7-L14)).
Its public constructor returns the object, but the defining module's
`transfer_to_owner` can use restricted `transfer::transfer` and derives the only
landing address from the object's stored owner
([lines 18–58](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/vesting/sources/soulbound.move#L18-L58)).
Outside the defining module, Sui's public transfer requires `key + store`, while
restricted transfer is limited by the bytecode verifier to the object's
defining module
([`transfer.move`, lines 47–65](https://github.com/MystenLabs/sui/blob/b448b1d971bd6c1aac8ef4eee4305943806d5d5b/crates/sui-framework/packages/sui-framework/sources/transfer.move#L47-L65)).
The presale allocation path constructs a vesting object and immediately lands it
at the recorded recipient
([`presale/sources/allocation.move`, lines 47–69](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/presale/sources/allocation.move#L47-L69)).

This is useful, but it is mostly an application of deliberate abilities plus a
module-controlled finalizer. It can strengthen **Construct–Attach–Finalize** by
showing that finalization can be a module-only transfer to an identity already
committed in the object, not only sharing or freezing.

Important caveats are that the constructor's caller can still borrow and invoke
public operations on the returned value before landing it in the same PTB, and
an upgrade to the defining module could introduce another transfer path. For
third-party-funded objects, construct and land through one controlled function
or make every pre-landing operation safe. Treat “soulbound” as a promise of the
module and its upgrade authority, not an unconditional property of `key`
without `store`.

Recommendation: do not create a separate incubator entry yet. Add it later as a
**Construct–Attach–Finalize** finalizer variant, or promote a narrower
**Construct–Land** pattern after another example confirms the boundary.

## Framework-derived: remove–transform–reinsert

The repository says its `Versioned` module modifies Mysten Labs' implementation
([`fun/sources/lib/versioned.move`, lines 4–19](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/lib/versioned.move#L4-L19)).
It removes the current dynamic object field and returns a no-ability
`VersionChangeCap` bound to the wrapper ID and old version; `upgrade` consumes
that cap, verifies the wrapper and monotonic version, inserts the new value, and
updates the version
([lines 44–69](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/lib/versioned.move#L44-L69)).
The test demonstrates changing both the version number and inner type
([`fun/tests/lib/versioned.move`, lines 17–50](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/tests/lib/versioned.move#L17-L50)).

Mysten's source documents the same `VersionChangeCap` as a hot potato that
ensures a replacement is always put back
([Sui `versioned.move`, lines 11–27](https://github.com/MystenLabs/sui/blob/209f0da8e316/crates/sui-framework/packages/sui-framework/sources/versioned.move#L11-L27)),
with the same parent-ID and monotonic version checks
([lines 55–80](https://github.com/MystenLabs/sui/blob/209f0da8e316/crates/sui-framework/packages/sui-framework/sources/versioned.move#L55-L80)).
The meaningful repository-specific variation is using `dynamic_object_field`
and requiring `T: key + store`, which preserves a child object's object-facing
semantics instead of accepting any stored value.

Recommendation: if a future pattern collection includes
**Remove–Transform–Reinsert**, cite and explain the Sui framework implementation
as the canonical source. This repository is corroborating usage, not the reason
to add a new candidate now.

## Other observation: closure-projected transition kernels

The common pool module uses package macros that accept a closure projecting a
mode-specific mutable state reference, then apply shared guards, signature
checks, asset logic, and lifecycle transitions
([`fun/sources/memez_fun.move`, lines 172–225 and 257–344](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L172-L225)).
Stable supplies a direct projection, while Auction's closure first applies its
mode-specific time drip
([`fun/sources/stable.move`, lines 147–180](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/stable.move#L147-L180),
[`fun/sources/auction.move`, lines 155–194](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/auction.move#L155-L194)).

This can reduce duplicated transition logic across statically distinct wrappers,
but a macro has no explicit trait-like contract for the projected state's field
shape and can obscure guard and mutation ordering. Hold this idea until another
codebase shows the same need and the pattern can prescribe narrow macro scope,
uniform behavioral tests, and safe variant-specific hooks.

## Verification

- `sui move test` passed all 8 tests in `periphery/wallet`.
- `sui move test` passed all 10 tests in `vesting`.
- The `fun` package test suite could not start because its manifest uses the
  external `mvr` resolver and `mvr` is not installed in this environment
  ([`fun/Move.toml`, lines 7–22](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/Move.toml#L7-L22)).
- The findings for `fun` therefore rely on source and test inspection, not a
  locally executed main-package suite.

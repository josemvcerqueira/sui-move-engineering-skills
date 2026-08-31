# Pattern incubator

This scratchpad collects candidate Sui Move engineering patterns before they
are mature enough to become a skill. Entries here are working notes, not
installed guidance. Promote a pattern only after it has enough independent
examples, clearly stated applicability and tradeoffs, and evidence that its
rules generalize beyond one implementation.

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

- `new` validates fixed identity inputs and returns an unshared, key-only
  object.
- Each `add_*` function performs one authorized attachment.
- Use `dynamic_object_field` for child objects with `UID`.
- Key generic children by their exact type and reject duplicate occupancy.
- `share` or `freeze` verifies all mandatory children, then performs the
  irreversible transition.
- The intermediate object must not have `store` or `drop`, so it cannot escape
  incomplete.
- A one-shot helper may compose these primitives, but must not duplicate their
  logic.

The central principle is: keep functions single-purpose and keep every
pre-finalization step composable within one PTB.

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
[`dynamic_object_field`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/dynamic_object_field.md).

## Validate–Issue–Consume

**Status:** Candidate

### Capability-backed ephemeral authorization

When a durable capability is valid only in relation to live shared authority
state, validate that relationship once and issue a narrow ephemeral witness.
The sealed witness type is the authorization proof. Downstream operations
accept it as their only authorization parameter instead of accepting or
revalidating both `AdminCap` and `Authority`.

```move
public struct AdminWitness has drop {}

public fun authorize_admin(
    authority: &Authority,
    admin_cap: &AdminCap,
): AdminWitness {
    authority.assert_live_admin(admin_cap);
    AdminWitness {}
}
```

A concern-owning module can then consume the proof without depending directly
on the durable capability or shared authority object:

```move
public fun set_fee(
    config: &mut Config,
    _witness: AdminWitness,
    new_fee_bps: u64,
) {
    config.fee_bps = new_fee_bps;
}
```

Rules:

- Keep `AdminCap` as the durable authority object. A witness is a derived,
  short-lived proof, not a replacement capability.
- The authority-owning module must be the only module able to construct the
  witness.
- Before issuance, verify that the capability belongs to the exact `Authority`
  and is still live according to its canonical registry, version, role, and
  revocation state.
- Give the witness `drop` only: no `copy`, `store`, or `key`. It may be
  abandoned, but it cannot be duplicated or persisted across transactions.
- Make the witness type as narrow as the authorization it represents. For
  example, issue a distinct `SetFeeWitness` if fee administration is narrower
  than general administration. Do not let a narrow capability mint a broader
  witness.
- Accept the witness by value when one witness should authorize only one public
  operation. Accept `&AdminWitness` only when deliberate reuse within the same
  PTB is part of the authority model.
- The consumer trusts the sealed witness type and must not repeat the
  `AdminCap`-to-`Authority` validation. This separation is the purpose of the
  pattern.
- Use a fieldless witness only when every issuer of that witness type grants the
  same authority over every consumer that accepts it. If authority is scoped
  per instance or target, encode that distinction in separate witness types or
  use an explicit bound-proof design instead.
- Define the validity instant precisely. A witness normally proves that the
  capability was live when the witness was issued; if same-PTB revocation,
  pause, or version changes must invalidate it before use, issue and consume it
  inside one guarded call or revalidate the relevant live state at consumption.
- Keep ordinary mutation invariants and operational version gates at the
  consuming transition. The witness centralizes authorization; it does not
  certify unrelated state or economic correctness.

The central principle is: validate durable authority once at its canonical
source, then let downstream operations trust and consume the smallest sealed
proof of that authorization.

Corroborating evidence: Blizzard's drop-only
[`AdminWitness<T>` and live-ACL `sign_in`](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/lib/acl.move#L17-L75),
including its
[`revoked-cap rejection test`](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/lib/acl.move#L197-L215).

## Bind–Handoff–Redeem

**Status:** Candidate

### Sealed-adapter asset handoff

When core state must transfer assets to one selected external integration
without importing that integration, bind the selection to a sealed witness
type. Release the assets inside a linear handoff that only the selected adapter
can redeem.

```move
use std::type_name::{Self, TypeName};
use sui::{balance::Balance, object::ID};

public struct Handoff<phantom AssetA, phantom AssetB> {
    origin: ID,
    adapter: TypeName,
    asset_a: Balance<AssetA>,
    asset_b: Balance<AssetB>,
}

public fun redeem<AssetA, AssetB, AdapterWitness: drop>(
    handoff: Handoff<AssetA, AssetB>,
    _witness: AdapterWitness,
): (ID, Balance<AssetA>, Balance<AssetB>) {
    let Handoff { origin, adapter, asset_a, asset_b } = handoff;
    assert!(
        type_name::with_defining_ids<AdapterWitness>() == adapter,
        EWrongAdapter,
    );
    (origin, asset_a, asset_b)
}
```

The selected adapter constructs its own sealed witness when performing the
integration:

```move
public struct AdapterWitness has drop {}

public fun settle<A, B>(handoff: Handoff<A, B>, ctx: &mut TxContext) {
    let (origin, asset_a, asset_b) = handoff.redeem(AdapterWitness {});
    settle_at_venue(origin, asset_a, asset_b, ctx);
}
```

Rules:

- Give the handoff no `copy`, `drop`, `store`, or `key`. It cannot be
  duplicated, discarded, persisted, or transferred as an object.
- Put every asset and fact required for settlement inside the handoff. Bind it
  to the exact originating object and economic domain.
- Select and validate the adapter type before the core releases custody.
- Admit only an audited, module-sealed witness type. Reject primitives,
  vectors, publicly constructible types, and types with unintended constructor
  paths; `TypeName` equality alone does not prove sealed construction.
- Choose `type_name::with_defining_ids` or `with_original_ids` deliberately,
  according to whether approval follows one concrete type definition or an
  upgrade lineage.
- Require the exact selected witness when redeeming. A different adapter type
  must abort before any balance is released.
- Treat witness approval and revocation as separate policy decisions. Removing
  an adapter from creation-time configuration does not automatically invalidate
  a type already bound into an existing handoff domain.
- The sealed witness proves adapter identity, not correct settlement. Enforce
  every invariant that must remain under core control before creating the
  handoff, and validate returned results if settlement is synchronous.
- Emit a core handoff-redemption event only after the witness matches, carrying
  the origin and released amounts. Do not report external settlement as
  complete unless the core can observe that fact; the adapter should emit its
  own venue-settlement event after success.
- Test the approved adapter, a wrong witness, an unsealed candidate, origin and
  asset mismatches, adapter abort rollback, and attempts to leave the handoff
  unused at the end of a PTB.

This differs from **Validate–Issue–Consume**. There, canonical authority state
issues an ephemeral proof for a downstream privileged operation. Here, the
selected downstream adapter constructs its own sealed identity witness to
unlock a linear carrier issued by the upstream core.

The central principle is: bind an integration before releasing custody, then
make the resulting asset handoff redeemable only by that integration's sealed
type within the same PTB.

Evidence: `memez-gg`'s
[`MemezMigrator`](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/sources/memez_fun.move#L48-L87),
[`xPump` adapter](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/migrators/xpump/sources/xpump.move#L177-L194),
and
[`wrong-witness` test](https://github.com/interest-protocol/memez-gg/blob/00596fdac4dd11f427c7bc594e566ce36160db93/fun/tests/memez_fun.move#L428-L461).

## Wrap–Wait–Redeem

**Status:** Candidate

### Asset-backed deferred fungibility

When a position is economically valid but temporarily ineligible to enter a
fungible pool, wrap the actual position in a persistent receipt. Once the live
eligibility condition is satisfied, consume the receipt, move the position
into the pool's backing, and mint the corresponding fungible claim.

```move
use std::type_name::{Self, TypeName};

public struct PendingReceipt has key {
    id: UID,
    position: PendingPosition,
    claim_type: TypeName,
    eligible_epoch: u32,
}

public(package) fun wrap<T>(
    position: PendingPosition,
    ctx: &mut TxContext,
): PendingReceipt {
    PendingReceipt {
        id: object::new(ctx),
        eligible_epoch: position.activation_epoch(),
        claim_type: type_name::with_original_ids<T>(),
        position,
    }
}

public fun redeem<T>(
    vault: &mut Vault<T>,
    clock: &ProtocolClock,
    receipt: PendingReceipt,
    ctx: &mut TxContext,
): Coin<T> {
    assert!(
        receipt.claim_type == type_name::with_original_ids<T>(),
        EWrongClaimDomain,
    );
    assert!(clock.epoch() >= receipt.eligible_epoch, ETooEarly);

    vault.sync(clock);
    let position = receipt.destroy();
    let backing_value = position.live_value(clock);
    vault.adopt(position);
    vault.mint_claim_down(backing_value, ctx)
}
```

Rules:

- Use this pattern only when the underlying position is already valid and
  valuable but a temporal or lifecycle condition prevents immediate pooling.
  An invalid asset should be rejected, not wrapped.
- Put the actual linear asset in the receipt. Do not add it to pooled backing
  or mint the fungible liability while the receipt is outstanding.
- Do not give the receipt `drop`: it is a persistent custody obligation that
  must be redeemed through a path that accounts for the backing asset.
- Seal receipt construction inside the protocol and derive the eligibility
  boundary and claim domain from canonical inputs. Do not accept either as an
  unchecked caller-supplied label.
- A non-generic receipt can give many fungible domains one object type and one
  display definition. Store a sealed `TypeName` tag and check it before every
  domain-sensitive merge, extraction, or redemption. Prefer a generic receipt
  when that shared representation is unnecessary.
- Choose defining-ID versus original-ID type identity deliberately according
  to the intended package-upgrade boundary. A type tag binds a domain; it is
  not authorization and does not prove anything about a value whose creation
  was not sealed.
- Check eligibility against live canonical state at redemption. Cached epoch,
  symbol, and value fields may support display and indexing, but must not be
  the authority for accounting.
- Synchronize the destination pool before pricing the position. Adopt the
  underlying asset, update backing, and mint the fungible claim atomically,
  using the protocol's conservative rounding direction.
- If receipts can split or join, operate on the underlying asset as the source
  of truth, refresh every cached field, and require matching claim domains and
  all underlying compatibility conditions before joining.
- Choose abilities deliberately. A key-only receipt can make transfer and
  landing module-controlled; a freely transferable receipt requires `store`
  and a different custody policy.
- Specify liveness under pause, revocation, and upgrades. If every redemption
  path is gated, governance can delay access to the backing asset; that must be
  an intentional and documented part of the claim.
- Test successful delayed redemption, early rejection, wrong-domain
  redemption, cross-domain join rejection, split/join conservation, live-value
  accounting, pause/version gates, and package-upgrade type identity.

This differs from **Store–Probe–Recover**. The receipt does not probe storage to
recover the concrete Move type of its position. Its sealed tag preserves the
future fungible claim domain across an intentionally non-generic, persistent
wrapper.

It also differs from **Construct–Attach–Finalize**. This receipt is a complete,
user-holdable asset intended to persist until an external eligibility condition
changes; it is not an incomplete assembly object that must be finalized in the
same PTB.

The central principle is: represent deferred fungibility with the real backing
asset, then create the fungible liability only when the asset becomes eligible
to join the pool.

Evidence: Blizzard's
[`mint-after-voting` and redemption flow](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/inner_protocol.move#L143-L227),
[`BlizzardStakeNFT` wrapper, type binding, split, and join](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/stake_nft.move#L13-L127),
[`successful live-value redemption test`](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/protocol.move#L570-L699),
and
[`wrong-domain and early-redemption tests`](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/protocol.move#L1759-L1843).

## Consume–Replace–Retire

**Status:** Candidate

### Emergency shared-object type migration

When an already-published shared object has a dangerous old mutator and no
version, pause, or revocable required-capability seam observed by every old
path, a code-only upgrade cannot retire the vulnerable bytecode. Add a distinct
replacement type, atomically move the live state into it, and consume the old
shared object so the old function no longer has an input it can accept.

This simplified sketch assumes the original package already has an `AdminCap`
bound to `State` and that `ProtocolData` contains the state that must survive:

```move
const VERSION: u64 = 2;
const ENotAdmin: u64 = 0;

public struct State has key {
    id: UID,
    data: ProtocolData,
}

public struct StateV2 has key {
    id: UID,
    version: u64,
    data: ProtocolData,
}

public struct AdminCap has key {
    id: UID,
    state_id: ID,
}

public struct StateMigrated has copy, drop {
    old_state_id: ID,
    new_state_id: ID,
}

entry fun migrate(
    state: State,
    admin: &mut AdminCap,
    ctx: &mut TxContext,
) {
    let old_state_id = object::id(&state);
    assert!(admin.state_id == old_state_id, ENotAdmin);

    let State { id, data } = state;
    id.delete();

    let state_v2 = StateV2 {
        id: object::new(ctx),
        version: VERSION,
        data,
    };
    let new_state_id = object::id(&state_v2);
    admin.state_id = new_state_id;

    event::emit(StateMigrated { old_state_id, new_state_id });
    transfer::share_object(state_v2);
}
```

Rules:

- Use this only when old bytecode must be made unusable against live shared
  state. If old calls remain harmless, changing the latest implementation can
  be sufficient. If an old version gate, pause flag, or required capability can
  already disable every dangerous call, use that seam instead.
- Add a distinct type such as `StateV2`. Deleting the original object and
  creating another `State` does not isolate the replacement because old package
  functions can accept any live object of the original type.
- Preserve the original datatype layout and every existing public function
  signature. Add the migration in the module that can destructure `State`, or
  use an existing safe extraction seam.
- Authorize migration with an authority that already exists or can be proven
  against the exact package lineage, such as the accepted `AdminCap`, governance
  authority, or validated `UpgradeCap`. A freely callable setup function turns
  migration into an asset-seizure path.
- Take the old shared state by value, unpack it once, move its contents, and
  delete its UID in the same successful transaction. Do not delete first and
  attempt to recover data later.
- Give the replacement a fresh UID. A shared object must be newly created in
  the transaction that shares it, so the old UID cannot simply become the new
  shared object's identity.
- Inventory every balance, supply fact, capability, child object, collection,
  and direct dynamic field. Direct dynamic fields attached to the old UID do
  not follow the fresh UID; remove, migrate, or deliberately retire them.
- If an existing `public fun mint(&mut State, ...)` cannot change signature,
  retain it for compatibility and add `mint_v2`, or add a new module whose
  `mint` accepts `StateV2`. A non-public `entry fun` can change signature under
  compatible policy, but its old package version remains callable until
  `State` is consumed.
- Emit an old-ID-to-new-ID migration event and update dependent packages,
  clients, indexers, caches, and operators that pin the old package generation,
  state type, or object ID.
- Treat the package upgrade and replacement-state setup as separate
  transactions. Until migration consumes `State`, old bytecode can still reach
  it. Use any pre-existing pause seam and minimize and monitor this exposure
  window; record the residual race when no seam can close it.
- Test authorized migration, wrong authority, wrong state ID, repeated
  migration, rollback on a failed move, exact asset and accounting
  reconciliation, dynamic-field handling, old-state deletion, old-function
  rejection of `StateV2`, and liveness of every required exit.

Under the stated assumptions, this is the only generic safe recovery: make the
dangerous old input cease to exist and put live state behind a type the old
bytecode does not recognize. If the migration cannot be authorized, cannot
reach all required state, or cannot retire the old input before further harm,
the old-version risk remains unresolved.

The central principle is: when old immutable code cannot be gated, retire its
input type and move the protocol to a fresh type boundary.

Evidence: Sui's upgrade guide describes adding a new type and migration
function for a flawed shared object, including separate upgrade and setup
transactions and protected setup authority
([migrating users to the latest version](https://docs.sui.io/develop/publish-upgrade-packages/upgrade#migrating-users-to-the-latest-version)).
The framework requires a shared object to be newly created in the transaction
that shares it
([`transfer::share_object`](https://github.com/MystenLabs/sui/blob/main/crates/sui-framework/docs/sui/transfer.md#function-share_object)).

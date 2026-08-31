# `blizzard` reusable-pattern audit

## Scope and conclusion

This audit inspected `interest-protocol/blizzard` at the current `main` commit
[`a1e5f7e910a1fd811ed0b537804e786b5788c7e2`](https://github.com/interest-protocol/blizzard/commit/a1e5f7e910a1fd811ed0b537804e786b5788c7e2)
(2026-05-08). It reviewed the production Move packages, their unit tests, and
the contemporaneous Walrus contract behavior on which the protocol relies.

One new pattern clearly meets the incubator's bar: **Wrap–Wait–Redeem**, a
persistent, module-sealed receipt that keeps an accepted asset outside final
protocol accounting until a live eligibility condition becomes true. The
receipt remains fully asset-backed while it waits, and redemption consumes the
receipt only after checking the intended type domain and current state.

The repository also contains a particularly good implementation of the
existing **Validate–Issue–Consume** pattern: a generic ACL validates a durable
admin object and issues a phantom-scoped witness used directly by downstream
operations. This is worth citing as evidence or a scoped variant, but it is not
a fifth pattern.

Three other ideas are promising but do not clear the bar here. Caller-authored
withdrawal plans lack adversarial tests and explicit plan bounds; dense
key-to-index repair is a sound but conventional data-structure technique; and
in-kind reserve transmutation needs a stronger rounding and conservation
specification before it becomes general guidance. The generic `BigVector` and
`ExtendedField` utilities are explicitly copied from earlier projects and
should be attributed to those sources rather than presented as Blizzard
discoveries.

| Candidate | Recommendation |
| --- | --- |
| Wrap–Wait–Redeem | Add to the incubator |
| Phantom-scoped admin witnesses | Add as evidence to Validate–Issue–Consume, not as a new pattern |
| Plan–Resolve–Settle withdrawal instructions | Hold pending adversarial tests and explicit bounds |
| Index–Swap–Repair dense storage | Keep as a supporting technique; do not add separately yet |
| Burn–Rehome–Remint in-kind transmutation | Hold pending a rounding/conservation specification |
| Chunked `BigVector` and `ExtendedField` | Attribute upstream; do not add as Blizzard discoveries |

## Add: Wrap–Wait–Redeem

### Shape

When an input asset is valid but cannot yet enter final accounting, wrap the
asset in a persistent, non-droppable receipt, let the owner hold it across
transactions, and consume it only after rechecking live eligibility.

Blizzard's normal mint path requires the new `StakedWal` to activate in the
next epoch. If Walrus voting has already finished, the stake instead activates
two epochs out, so `mint_after_votes_finished` deliberately returns a
`BlizzardStakeNFT` and does not add its value to the LST's exchange-rate state
([`inner_protocol.move`, lines 113–177](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/inner_protocol.move#L113-L177)).
The integration test confirms that issuance leaves total accounted WAL and the
node's reserve vector unchanged
([`protocol.move`, lines 514–564](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/protocol.move#L514-L564)).

The receipt has `key` but neither `store` nor `drop`. It contains the actual
`StakedWal`, the intended LST `TypeName`, and display-oriented cached facts
([`stake_nft.move`, lines 11–20](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/stake_nft.move#L11-L20)).
Only the defining module constructs or opens it. Its public `keep` function can
land the key-only object only at `ctx.sender()`, while `split` and `join` keep
the underlying stake inside the same receipt abstraction
([lines 55–127](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/stake_nft.move#L55-L127)).
This ability choice matters: Sui's restricted `transfer<T: key>` is verifier
limited to the defining module, whereas transfer from another module requires
`key + store`
([Sui `transfer.move`, lines 47–65](https://github.com/MystenLabs/sui/blob/73dd2c2ba6f9fdb21d7ffde2b50a3f2f0ac39bc1/crates/sui-framework/packages/sui-framework/sources/transfer.move#L47-L65)).

Redemption first checks pause state, exact target type, package compatibility,
and the current Walrus epoch. It then consumes the receipt, recovers the
underlying `StakedWal`, computes value from that live asset, adds it to reserve
state, and only then mints LST shares
([`inner_protocol.move`, lines 179–228](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/inner_protocol.move#L179-L228)).
Tests cover successful cross-transaction custody and split/join behavior
([`stake_nft.move`, lines 69–139](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/stake_nft.move#L69-L139)),
wrong-domain rejection
([lines 141–183](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/stake_nft.move#L141-L183)),
and redemption rejection while paused, on an outdated package, for the wrong LST
type, and before the eligibility epoch
([`protocol.move`, lines 1666–1843](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/protocol.move#L1666-L1843)).

### Why it generalizes

The receipt separates acceptance of an asset from its admission to final
accounting:

```text
accept and seal the real asset
          ↓
persist a constrained receipt while eligibility is false
          ↓
recheck live state, consume the receipt, and finalize accounting
```

This applies to delayed staking, vesting activation, bridge finality,
epoch-bound claims, queued vault deposits, and any workflow where issuing the
final fungible claim immediately would recognize value too early. Holding the
real asset inside the receipt is stronger than storing only a numeric IOU: the
later transition operates on the exact accepted resource.

It is distinct from all current incubator entries:

- **Construct–Attach–Finalize** intentionally prevents its incomplete object
  from surviving the PTB. This receipt must survive across transactions.
- **Store–Probe–Recover** temporarily erases a generic value's type to choose a
  branch. Here the stored `TypeName` binds a persistent receipt to an intended
  output domain; the underlying asset has one known type throughout.
- **Validate–Issue–Consume** creates an ephemeral authorization proof. This
  receipt is durable custody and an economic claim, not authority.
- **Bind–Handoff–Redeem** uses a no-ability hot potato that must be redeemed in
  the same PTB by a selected adapter. This receipt has `key` precisely because
  waiting is part of the workflow.

### Rules and limitations

- Put the real underlying asset in the receipt. Cached value, time, symbol, or
  route fields are metadata; final settlement must derive economic facts from
  the inner asset and live canonical state.
- Give the receipt `key` but not `drop`. Omit `store` when transfer, wrapping,
  or public sharing must remain module-controlled. Expose only intentional
  landing or transfer paths and document whether the claim is bearer-owned,
  sender-bound, or transferable.
- Make the module the only constructor and extractor. Consuming the receipt by
  value must be the sole path that releases the underlying asset into final
  accounting.
- Bind the receipt to the exact target domain. Prefer a generic
  `Receipt<phantom T>` when a static type is acceptable. Use a stored
  `TypeName` only when one non-generic receipt type is a real requirement, and
  choose `with_defining_ids` versus `with_original_ids` deliberately
  ([Sui `type_name.move`, lines 42–50](https://github.com/MystenLabs/sui/blob/73dd2c2ba6f9fdb21d7ffde2b50a3f2f0ac39bc1/crates/sui-framework/packages/move-stdlib/sources/type_name.move#L42-L50)).
  Blizzard uses the now-deprecated `type_name::get`, so its identity choice
  should not be copied blindly.
- Recheck every mutable eligibility condition at redemption: time or epoch,
  pause state, domain, package version, revocation, and target acceptance.
  Issuance-time facts do not prove later eligibility.
- If receipts support `join`, require every piece of metadata that affects
  redemption to match. Blizzard checks its LST type and delegates node,
  activation-epoch, and stake-state equality to Walrus's `StakedWal::join`
  ([Walrus `staked_wal.move`, lines 146–174](https://github.com/MystenLabs/walrus/blob/677f347f03e3db9f461bd29e16b120f10628a1b3/mainnet-contracts/walrus/sources/staking/staked_wal.move#L146-L174)).
- If receipts support `split`, preserve the domain and eligibility metadata and
  enforce minimum viable pieces. The underlying Walrus split preserves node,
  state, and activation epoch and enforces its minimum stake
  ([lines 176–196](https://github.com/MystenLabs/walrus/blob/677f347f03e3db9f461bd29e16b120f10628a1b3/mainnet-contracts/walrus/sources/staking/staked_wal.move#L176-L196)).
- Specify liveness during pause or upgrade. Because the receipt cannot be
  dropped and redemption is version- and pause-gated, governance can delay
  access to the underlying asset. That may be intentional, but it is part of
  the economic contract.

## Existing pattern evidence: phantom-scoped Validate–Issue–Consume

`BlizzardACL<T>` keeps the canonical set of live admin object IDs. `sign_in<T>`
checks an `AdminCap`-like `BlizzardAdmin<T>` against that exact registry and
returns a fieldless, drop-only `AdminWitness<T>`
([`acl.move`, lines 17–75](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/lib/acl.move#L17-L75)).
Revocation invalidates later sign-in even if the durable admin object still
exists, and the negative test exercises that case
([`acl.move`, lines 197–216](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/lib/acl.move#L197-L216)).

The phantom parameter gives one reusable witness family compile-time domains:
pool-local operations accept `&AdminWitness<T>`, while protocol-wide operations
accept `&AdminWitness<BLIZZARD>`
([`protocol.move`, lines 181–264](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/protocol.move#L181-L264)).
Passing the proof by reference intentionally permits several same-PTB admin
operations after one sign-in. This is a strong worked example of the current
pattern's domain-scoping and deliberate-reuse rules, not a separate pattern.

## Hold: Plan–Resolve–Settle withdrawal instructions

The optional hooks package computes a first-come-first-served withdrawal plan
from public reserve views. Its source explicitly suggests using dev-inspect and
then rebuilding the pure instruction values to avoid reading every dynamic
field in the execution transaction
([`hooks.move`, lines 7–15](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/hooks/sources/hooks.move#L7-L15)).
The plan is a copyable vector of public `node_id`, epoch, and principal
selectors
([`withdraw_ix.move`, lines 8–25](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/lib/withdraw_ix.move#L8-L25)).

The core does not trust a claimed output amount. It resolves each selector
against current node storage, splits or removes the real `StakedWal`, and
recomputes rewards from live Walrus state
([`node.move`, lines 93–160](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/node.move#L93-L160)).
`burn_lst` then derives how many LST shares to burn from the actual underlying
removed and returns any unused input shares
([`inner_protocol.move`, lines 230–281](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/inner_protocol.move#L230-L281)).
The reusable principle is good: treat a caller-authored plan as selectors, not
evidence, and settle only from canonical effects.

Hold it for now. The hooks suite has only two honest-path tests
([`hooks_tests.move`, lines 13–224](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/hooks/tests/hooks_tests.move#L13-L224)).
There are no focused tests for stale plans, duplicate selectors, excessive plan
length, nonexistent nodes or epochs, over-selection, or user-specified minimum
output. Some invalid plans safely abort through table lookup, split, or checked
arithmetic, but those are implicit failure modes rather than an explicit plan
contract. Promote this only after the executor defines input bounds, duplicate
semantics, slippage behavior, and adversarial rollback tests.

## Supporting technique: Index–Swap–Repair

Each node groups positions by activation epoch. A table maps epoch to a dense
vector index; insertion joins an existing epoch or appends a new entry
([`node.move`, lines 57–91](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/node.move#L57-L91)).
On full removal, the implementation swap-removes the vector element and repairs
the moved last element's table index
([lines 110–135](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/node.move#L110-L135)).
Tests verify the repaired map after partial, middle, last, and multiple removals
([`node.move`, lines 207–324](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/node.move#L207-L324)).

This is correct and useful, but it is the classic dense-vector plus reverse
index technique rather than a distinct Sui ownership or PTB pattern. Keep it as
a possible supporting data-structure rule: mutation must update the vector and
reverse map atomically, and invariant tests should assert
`vector[map[key]].key == key` after every removal shape. Do not add a standalone
incubator entry without another Move-specific constraint that changes the
design.

## Hold: Burn–Rehome–Remint in-kind reserve transmutation

`transmute` synchronizes source and target pools, removes actual `StakedWal`
positions from the source, burns source shares, inserts the same position
objects into the target, and mints target shares from the actual WAL value
([`inner_protocol.move`, lines 319–390](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/inner_protocol.move#L319-L390)).
The end-to-end test checks that the principal object value moves between pools,
both total-WAL values change by the same amount, source shares decrease, and
target shares use the target exchange rate
([`protocol.move`, lines 835–994](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/tests/protocol.move#L835-L994)).

Atomic in-kind vault migration is a valuable idea because it avoids an
unstake/restake cycle and derives the destination claim from assets actually
received. This implementation is nevertheless specialized to a single WWAL
destination, and its tests do not cover adversarial reserve granularity or
rounding boundaries. Before promotion, the pattern needs a conservation
specification tying source share burn, exact reserve value removed, source rate
mutation, target rate mutation, and target shares minted; pool-favorable
rounding directions; acceptance rules for every moved position; and tests at
minimum-position and high share-price boundaries.

## Upstream-derived utilities

The `BigVector` source says it was taken from Typus Lab
([`big_vector.move`, lines 1–5](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/lib/big_vector.move#L1-L5)).
The `ExtendedField` source says it was copied from Mysten's Walrus contracts
([`extended_field.move`, lines 1–16](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/lib/extended_field.move#L1-L16)).
Both may be useful structures, but Blizzard is corroborating use rather than
the canonical source. A future chunked-vector or field-indirection pattern
should audit and cite the upstream implementation directly, including object
size, gas, random-access, removal, and destruction tradeoffs.

The `AllowedVersions` snapshot is likewise not a new candidate. It copies a
shared allowlist into a drop-only value and lets package operations assert their
compiled version
([`version.move`, lines 16–55](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/sources/version.move#L16-L55)).
Conceptually this is another ephemeral proof issued from live canonical state,
so it belongs under **Validate–Issue–Consume** and inherits that entry's
issuance-time validity caveat.

## Verification and reproducibility

- `sui move test -p ./blizzard --test` passed all 78 core tests.
- `sui move test -p ./hooks --test --silence-warnings` passed both hook tests.
- The checkout is not self-contained: `blizzard/Move.toml` points to a Walrus
  repository at `../../walrus` rather than pinning a Git revision
  ([`Move.toml`, lines 7–13](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/blizzard/Move.toml#L7-L13)).
  A fresh checkout therefore fails until that sibling dependency is supplied,
  and using current Walrus `main` can drift from the interfaces expected by
  this commit. The successful run used Walrus commit
  [`677f347f03e3db9f461bd29e16b120f10628a1b3`](https://github.com/MystenLabs/walrus/commit/677f347f03e3db9f461bd29e16b120f10628a1b3),
  the latest Walrus commit immediately before the audited Blizzard commit.
- The repository workflow intends to run the WWAL, Blizzard, and hooks suites,
  but it does not fetch the required sibling Walrus checkout
  ([`.tests.yml`, lines 10–23](https://github.com/interest-protocol/blizzard/blob/a1e5f7e910a1fd811ed0b537804e786b5788c7e2/.github/workflows/.tests.yml#L10-L23)).
  Test success here validates the examined source against the contemporaneous
  dependency; it does not remove that fresh-checkout reproducibility gap.

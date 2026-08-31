# Sui package-upgrade compatibility and event ABI rules

This note is the durable repository record for package-upgrade rules. Sui Docs
pages used during research are summarized here instead of linked, under the
[reference policy](../reference-policy.md); direct evidence links point to the
audited commit of Sui source.

## Scope and conclusion

This note checks Sui's current user-package upgrade rules against first-party documentation and implementation source. The source snapshot used for implementation details is MystenLabs/Sui commit [`60f0e8a6abb0523d5c9c7f5edc006f40d8dead03`](https://github.com/MystenLabs/sui/tree/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03).

The key conclusion is that an existing event payload is an existing Move datatype, so a normal Sui package upgrade cannot add, remove, rename, reorder, or change its fields. It also cannot change that datatype's abilities. If an event schema must change after publication, the package must introduce a new payload type, such as `PositionClosedV2`. Introducing that replacement type—and changing an existing field's meaning or when an event is emitted—is the indexing ABI migration that requires reducer and schema-test updates.

## Upgrade-policy matrix

Sui orders its built-in policies from strictest to loosest as immutable, dependency-only, additive, and compatible. The default is compatible, and an `UpgradeCap` can only move to a more restrictive policy (Sui custom upgrade policies).

| Change | Compatible | Additive | Dependency-only |
| --- | --- | --- | --- |
| Change an existing function implementation | Yes | No | No |
| Change or remove an existing `public` function signature | No, except relaxing generic ability constraints | No | No |
| Change or remove a private, `public(friend)`, or non-public `entry` function | Yes | No | No |
| Add a function, datatype, or module | Yes | Yes | No |
| Remove an existing module or datatype | No | No | No |
| Change existing datatype layout, abilities, or type parameters | No | No | No |
| Change dependencies | Yes | Yes | Yes |

The docs summarize compatible upgrades as allowing function-body changes, relaxed generic ability constraints, and changes to non-public functions while preserving existing public signatures and types (Sui custom upgrade policies). The execution path applies the compatibility checker for compatible upgrades, a code-and-declaration subset check for additive upgrades, and exact module inclusion for dependency-only upgrades; it separately rejects a module-count change under dependency-only policy ([Sui upgrade execution](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/sui-execution/latest/sui-adapter/src/static_programmable_transactions/execution/context.rs#L2537-L2612)).

## Existing datatypes are layout-frozen

The upgrade guide states that existing struct layouts, including abilities, must remain the same, while new structs and functions may be added (Sui upgrade requirements). The userspace checker enforces the stronger exact consequences:

- Every existing struct and enum must still exist.
- Existing struct fields must match; the normalized comparison covers ordered field names and types.
- Existing enum variants cannot be added, removed, renamed, reordered, or have their fields changed.
- Existing datatype type-parameter declarations remain compatible with layout preservation.
- Existing abilities cannot be removed, and userspace `upgrade_check` disallows adding any ability, so the ability set is unchanged.

These checks are visible in the userspace upgrade configuration and datatype comparison ([Move compatibility checker](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/external-crates/move/crates/move-binary-format/src/compatibility.rs#L76-L83), [struct and enum checks](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/external-crates/move/crates/move-binary-format/src/compatibility.rs#L129-L223), [normalized field equivalence](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/external-crates/move/crates/move-binary-format/src/normalized.rs#L864-L911)).

Therefore, changing an object's or event payload's fixed layout requires a new datatype and an explicit migration path; it is not an in-place compatible upgrade.

## Public functions and new declarations

Under compatible policy, an existing public function cannot be removed, lose public visibility, or change its parameters, return values, or type-parameter arity. Generic ability constraints may be relaxed because that preserves old callers. Private, `public(friend)`, and non-public `entry` functions may change, disappear, or become public (Sui policy documentation, [function compatibility checks](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/external-crates/move/crates/move-binary-format/src/compatibility.rs#L226-L345)). A `public entry` function remains subject to the public-signature restriction even though its `entry` modifier may be changed.

Compatible and additive upgrades can introduce new functions, datatypes, and modules. Dependency-only upgrades cannot: their existing modules must be exactly included and the package cannot gain or lose a module ([Sui upgrade execution](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/sui-execution/latest/sui-adapter/src/static_programmable_transactions/execution/context.rs#L2560-L2612)).

## Type identity across upgrades

An upgrade publishes a new immutable package object, but it does not turn an existing coin, object, or event type into a new type. Sui carries each existing datatype's defining origin forward in the upgraded package's type-origin table. A datatype first introduced in a later version instead receives that later package object's ID as its defining ID ([Sui type-origin construction](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-types/src/move_package.rs#L805-L890)).

Sui distinguishes that defining ID from the original ID of the package lineage: `with_defining_ids` uses the package version that first introduced a type, while `with_original_ids` uses the first package version even when the type was introduced later ([Move `type_name`](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/move-stdlib/sources/type_name.move#L42-L57)). This distinction matters for domain keys: use defining identity when identifying a concrete type; use original package identity only when deliberately grouping the entire upgrade lineage.

## Event ABI implications

The fixed-layout rule changes how event guidance should be phrased:

1. An existing event payload type's fields and abilities cannot change in place through a valid userspace package upgrade.
2. A new schema requires a new event payload type. The indexer must recognize both the old and new types because old package versions and their behavior remain on-chain.
3. Compatible policy can change function bodies, so an upgrade can change whether an existing event is emitted, which values are emitted, or what those values mean without changing its field layout. Those semantic or emission changes are still indexing ABI migrations.
4. Additive policy preserves existing function bodies but can add new functions and new event types. Dependency-only policy preserves the package's own declarations and code but can relink dependencies, so dependency behavior still deserves integration review.

A precise reusable rule is:

> Sui upgrades cannot change an existing event payload type's fields or abilities. When its schema must change, add a new versioned payload type and treat the replacement—and any change in field meaning or emission semantics—as an indexing ABI migration; update reducers and field tests together.

## Old versions, initialization, and migration

Package versions are immutable. Old packages cannot be deleted, remain callable, and users can keep calling them unless protocol state enforces a version gate. An upgraded dependency is not adopted automatically; a dependent package must itself be upgraded to point to the new version. The current upgrade guide also states that module initializers do not rerun during package upgrades (Sui upgrade considerations).

Consequently, implementation fixes or newly emitted events do not automatically govern old entry points. Sui's guide recommends version checks on shared state and explicit, authorized migrations when old and new callers must not coexist (migrating users to the latest version). A layout change similarly needs a newly introduced type and a conversion or migration function; the existing type cannot be edited in place.

For a flawed shared object published without a usable old-code gate, the
documented recovery is to add a distinct replacement type and an authorized
migration function. The package upgrade and replacement-state setup are
separate transactions, and the setup must be protected by an existing
`AdminCap` or another authority the protocol can validate. The migration
consumes or otherwise retires the old input type; creating another instance of
the same type would leave it callable by old bytecode. A replacement shared
object also needs a fresh UID because `transfer::share_object` requires the
object to be newly created in the transaction that shares it
([`transfer.move`](https://github.com/MystenLabs/sui/blob/60f0e8a6abb0523d5c9c7f5edc006f40d8dead03/crates/sui-framework/packages/sui-framework/sources/transfer.move#L97-L108)).

## Current-versus-historical caveat

Older Sui design discussions and pre-activation behavior are useful background but are not the authority for current network rules. The conclusions above follow the current official upgrade pages and the cited current checker snapshot. Re-audit both when Sui changes protocol-level upgrade or initializer behavior.

---
name: jose-move-architecture
description: Design Jose-style Sui Move packages, modules, minimal state, authority, and dependency boundaries. Use when adding, simplifying, or reviewing packages, modules, shared objects, capabilities, witnesses, hot potatoes, storage fields, public types, adapters, or cross-package composition.
---

# Jose Move Architecture

Design the smallest on-chain system that preserves consensus, custody, composition, and reconstruction.

Target repository instructions, accepted design records, pinned toolchain behavior, and published compatibility commitments take precedence over this standard's examples.

## Decide what belongs on chain

Put logic or state on chain only when it must:

- authorize, reject, or order a consensus-critical transition;
- custody, allocate, conserve, mint, burn, or settle assets;
- provide a synchronous result for trustless contract composition; or
- commit the smallest primitive fact required for independent reconstruction.

Keep deterministic projections, formatting, aggregation, previews, transaction construction, and convenience reads off chain. A transition can recompute a derived value internally when it must enforce fees, slippage, bounds, conservation, or another invariant.

## Choose package boundaries

- Start with one core package.
- Add a package only for a real security, deployment, ownership, or dependency boundary.
- Put DEX, oracle, bridge, or other volatile external dependencies in adapter packages.
- Make adapters depend inward on a narrow core interface. Never make core import an adapter.
- Keep independently deployed systems separate when core does not require their result synchronously.
- Do not split packages only to shorten files or mirror another repository.
- Do not ship placeholder integrations, dummy returns, silent no-ops, `todo`, or production functions whose intended path aborts. A dependency interface link stub that is never executed and is verified against deployed bytecode is not a production implementation.

Use this default direction:

```text
types, errors, constants, units, pure math
        ↓
state and lifecycle transitions
        ↓
fees, allocations, migration handoffs
        ↓
external adapters and independent systems
        ↓
SDK, indexing, transaction, and deployment tooling
```

## Give each module one concern

- Put state with the lifecycle that mutates it.
- Put a capability type in the module that owns its one-time issuance and lifecycle.
- Put authorization checks beside the private authority representation they inspect.
- Extract a small authority module only for a real shared domain or to break a real module cycle.
- Separate live mutable settings from cold policy snapshotted into newly created state.
- Keep capability custody, ACL membership, cryptographic keys, identity, fees, upgrades, and product configuration in their concern-owning modules.
- Avoid generic `config`, `utils`, `manager`, `helper`, or `registry` dumping grounds. Name the domain concern.

Use these module roles only when needed:

- package marker module: one-time witness and publisher claim; private `init`;
- `constants`: package-wide protocol constants as package macros;
- `errors`: package error registry with no state or assertions;
- `events`: payload schemas and package-only emitters;
- `events_wrapper`: the package's one envelope and raw emission seam;
- authority or `acl`: root rotation, routine membership, and ephemeral sign-in witness;
- runtime configuration: the smallest live settings;
- cold configuration: bounded policy copied into new domain objects;
- package administration: validated custody of `Publisher` and `UpgradeCap`;
- domain modules: lifecycle transitions and owned invariants;
- pure math modules: deterministic arithmetic without storage or transfer effects;
- adapter packages: sealed venue witness, external dependency, and venue settlement.

Give an initializer an OTW parameter only when it validates, transforms, consumes, or stores that witness for its own concern. Other initializers take `TxContext` only.

## Make invalid states hard to express

- Model lifecycle states with an enum and permit only named transitions.
- Use typed capabilities for durable authority and drop-only witnesses for ephemeral authorization.
- Use a non-copyable, non-droppable resource for one-time handoffs and replay prevention.
- Wrap a stored linear resource in `Option<T>` only when a transition must remove it from a borrowed parent; do not pair that option with a redundant claimed flag.
- Use phantom type parameters for domain separation when no value of the type is stored.
- Keep reserves, fees, pending burns, allocations, refunds, and claims in separate balances when their ownership or terminal treatment differs.
- Keep fields private and expose only constructors and operations that preserve legal values.
- Give shared top-level state `key` only unless transfer or nesting is an explicit requirement.
- Add `store`, `copy`, or `drop` only when the intended lifecycle requires it.
- For every stored field, name its canonical authority and the transition that needs a local copy. Reject a mirror when construction makes disagreement unreachable or no operation can change the copy independently.
- Do not duplicate state already owned by a native registry or canonical object merely to revalidate it later. Read the authority at the transition that needs it, unless a sealed construction proof already establishes the invariant.
- Prefer consuming a unique authorization resource over storing a parallel `claimed` flag or nonce.
- Do not pre-plant flags, modes, roles, migration fields, or version counters outside an accepted upgrade lifecycle for a transition that has no production caller.
- Keep a one-field wrapper when it changes abilities, construction rights, type-level domain separation, atomic presence, or serialization. Data shape alone does not prove redundancy.
- Keep a validated unit wrapper inside the package when it prevents illegal stored values; accept or emit a primitive at an external ABI boundary when exposing the wrapper would leak an internal representation, and validate once at construction.
- Choose collection storage from the entries' lifecycle. Prefer a proved-bounded inline vector when entries have no independent identity or access path. Use dynamic fields when a frozen shared layout must accept later registered entries, dynamic object fields when a child must keep addressable identity, and tables only when scale justifies child-object lifecycle.
- Before using child dynamic storage, prove that every close, cancel, and destroy path removes all children and recovers their storage rebates.

## Design authority by scope

- A protocol-global admin cap normally carries only its identity. Revocation comes from live shared registry state.
- A per-instance cap carries target IDs only when those IDs define its exact authority domain.
- The module that issues a capability owns its destruction, rotation, or consumption rules.
- Separate root authority from routine administration.
- Do not make object possession or an address check imply broader authority than the type promises.
- Do not pass overlapping capabilities to one operation.

## Protect dependency integrity

- Pin Git dependencies to immutable full commit SHAs and commit lockfiles.
- Keep core buildable without mutable external heads.
- Treat external interfaces as hostile versioned boundaries.
- Verify the deployed package, original type origin, ABI, and economic assumptions consumed by each adapter.

## Architecture gate

Reject the design when deleting the proposed on-chain logic would not weaken a consensus transition, asset invariant, trustless composition seam, or independent reconstruction. Reject speculative roles, modes, governance hooks, and public APIs without a concrete caller and invariant.

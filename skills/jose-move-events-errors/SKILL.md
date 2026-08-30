---
name: jose-move-events-errors
description: Design Jose-style Sui Move events, minimal payloads, replay contracts, native-metadata boundaries, event identity and ordering, emitters, stable numeric errors, abort ownership, and diagnostic compatibility. Use when adding, compacting, changing, testing, indexing, or reviewing any Move event, payload field, error, guard, or transition's emitted facts.
---

# Jose Move Events and Errors

Treat events and aborts as published protocol interfaces, not incidental diagnostics.

## Make events replay complete

Starting at publication, a consumer using native transaction effects and metadata, immutable published bytecode, immutable content of objects recorded by creation effects, and the protocol event stream must reconstruct every economically relevant mutable fact promised to index. Do not copy a fact into a payload merely because it lives outside the inner Move struct.

- Emit each mutable setter, claim, accrual, distribution, trade, lifecycle transition, allocation, and migration settlement.
- Name payloads as completed facts in past tense.
- Emit only after final state and asset movement are known.
- Carry stable entity identity plus the primitive delta, old/new pair, or final snapshot required for replay.
- Include post-transition totals when they make dropped or duplicated events self-reconciling.
- Record the exact economic inputs used when later global configuration can change historical interpretation.
- Reject no-op setter updates so every emitted old/new pair represents a real state transition.
- Do not emit derived display values that consumers can reproduce exactly.
- Do not add an application sequence, revision, nonce, schema tag, or action tag merely to order, paginate, classify, or detect gaps. Add a domain counter only when it is itself protocol state or native order and payload type cannot sequence the transitions, and record that decision.
- Emit one authoritative event for one accounting mutation.

## Audit necessity event by event and field by field

- Name the new protocol fact each event commits; the payload type's occurrence is itself a fact. Remove the event only when both that occurrence and every field already come from native effects, transaction metadata, immutable bytecode, or the prior replay stream.
- Default package initialization to eventless when it only shares or delivers objects recorded by publication effects and initializes compiled constants. Keep a creation event when an ordinary function commits caller-supplied or deployer-selected values that can vary.
- Do not restate `ctx.sender()` as `buyer`, `seller`, `claimant`, `caller`, or another actor field; consumers receive the sender in native event metadata. Keep an actor, attested identity, beneficiary, recipient, or refund address only when it can differ from the sender, name it for that role, and record why it differs.
- On a non-mutating fact, emit only what it newly commits, not current values of state it leaves unchanged and the prior stream already reconstructs.
- Do not emit the ID of an object the same transition destroys when the economically relevant fact is what that destruction commits, unless the prior stream keyed an open fact on that ID and replay must close it.
- Bounded immutable inputs may live only in the created object's canonical content; emit their count when useful and let consumers read the object recorded by creation effects.
- Preserve deliberate redundancy that makes a fact self-reconciling: delta plus final total, an old/new mutation pair, a complete required snapshot, or the identity and final value removed or delivered. A later compaction audit must not remove it.
- Before publication, compact derivable fields deliberately. After publication, treat removal or reshaping as an ABI migration rather than cleanup.

## Design identity deliberately

- Carry identity for every multi-instance entity.
- Use original type identity when upgrades must not split one logical domain.
- A typed singleton mutation can omit its unchanging owner ID only when production creates exactly one instance, replay begins at publication, and the payload type partitions the stream.
- Keep old/new identity for root replacement or any transition that changes recognized singleton identity.
- Restore explicit identity when a later design permits replacement or multiple instances.
- Partition reducers by stable payload identity and process native Sui event order.

## Describe accounting precisely

- Distinguish pending custody, native burn, transfer to an irrecoverable address, refund, and returned residual.
- Include asset deltas and post-accrual totals when reconciliation requires both.
- Include the applied fee or policy input if configuration can change later.
- Document deliberately non-indexable facts, such as current ownership of a freely transferable capability, and direct consumers to native object or transaction data.
- Treat any payload field change as an indexing ABI migration. Update reducers and field tests with it.

## Centralize event construction

When the package standard uses an envelope:

```move
public struct Event<T: copy + drop>(T) has copy, drop;

public(package) fun emit_event<T: copy + drop>(payload: T) {
    sui::event::emit(Event(payload));
}
```

- Keep payload types and package-only named emitters in `events.move`.
- Let only `events_wrapper` call `sui::event::emit` directly.
- Let transition modules mutate first and call the descriptive emitter afterward.
- Do not pack the same payload ad hoc at several call sites.
- Keep test-only collection, unwrap, and `<event>_fields` helpers out of production bytecode.
- If a package intentionally uses direct native events, keep the schema/emitter/replay discipline. Do not add a wrapper only for uniform appearance.

## Keep package errors stable

Use literal-returning package macros for a package-wide numeric registry:

```move
// errors.move
macro public(package) fun invalid_recipient(): u64 { 1 }

// invariant-owning module
assert!(recipient != @0x0, protocol::errors::invalid_recipient!());
```

- Keep the registry append-only after publication.
- Never reuse a retired code or change a published meaning.
- Maintain one map from number to macro, raising module, and stable meaning.
- Define matching `#[test_only]` `EUpperCamelCase` constants when attributes or structural tooling need named codes.
- Permit module-local named error constants in a small independent package whose modules each own their errors when package-wide uniqueness is unnecessary.
- Keep `errors.move` diagnostic-only: no state, authority, assertions, abort wrappers, or generic validators.

## Raise errors where invariants live

- Place fully qualified `assert!(condition, protocol::errors::name!())` in the module that owns the invariant.
- Use a typed `assert_*` helper only when it inspects private domain representation or deliberately composes owned guards.
- Reject helpers that accept only a precomputed boolean and hide the error and guard position.
- Preserve the raising module as part of error semantics.
- Test exact abort code and exact `location`.
- Test precedence when several guards can fail.
- Add only a narrow lint suppression when the pinned compiler requires one for error macro expansion, with adjacent rationale.

## Compatibility gate

Treat payload types, fields, wrappers, error numbers, error meanings, raising modules, and guard precedence as published API. Before publication, make any compaction a deliberate one-time decision. After publication, append new errors or add new payload types; do not silently reinterpret existing interfaces.

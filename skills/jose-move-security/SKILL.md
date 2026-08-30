---
name: jose-move-security
description: Secure Jose-style Sui Move transitions, authority, signed actions, replay controls, bounded state, arithmetic, assets, adapters, pauses, versions, and upgrades. Use for any privileged, stateful, economic, cryptographic, shared-object, or external-integration Move change or review.
---

# Jose Move Security

Make invalid transitions unrepresentable where possible and reject the rest before mutation.

## Order every transition

Use this order:

1. package version, pause, lock, or reentrancy guard;
2. cheap lifecycle, input, identity, deadline, and authorization checks;
3. bounds, slippage, available-balance, and economic checks;
4. required external reads, signature work, deserialization, or expensive math;
5. compute each fallible proposed final value once before mutation, naming it when checks or later mutation reuse it;
6. validate all fallible postconditions against the proposed values;
7. mutate state and move assets;
8. emit the final-state event;
9. return owned values.

Guard order is observable API. Test overlapping invalid conditions. Do not rely on abort rollback to justify avoidable mutation before validation.

Reject a setter whose new value equals the current value before mutation, with its own stable error, so every emitted old/new pair records a real transition. A non-mutating authorization or discovery fact may still emit the value it newly commits.

## Express authority with types

- Use a typed capability or witness instead of an address check for privileged operations.
- Verify a revocable cap against live registry state before issuing a drop-only witness.
- Let the concern-owning module validate that witness locally.
- Keep a global cap minimal. Store target IDs only in a deliberately per-instance cap.
- Separate root authority from routine administration.
- Use delayed, explicit, test-covered root rotation. Add cancellation or recipient acceptance when the threat model requires it.
- Never infer broad authority from unrelated object possession or transaction sender alone.
- Do not pass overlapping capabilities to one setter or transition.
- Give capability holders a production lifecycle for safe destruction or revocation when stranded objects are possible.
- Reject zero addresses for recipients and authorities unless the zero address has an explicit protocol meaning.
- For a permissionless irreversible transition, take economic parameters from stored policy, derived state, or a sealed adapter type, never from caller choice. Fail closed or use a documented compiled default until policy is pinned.

## Bind signed actions narrowly

- Give each compromise domain a dedicated signing key unless a shared domain is explicitly approved.
- Bind the message to the exact action, sender, original type identity, expiry, and replay domain required by the transition.
- Validate canonical encoding and exact key, signature, digest, identifier, and message lengths before verification or mutation.
- Do not duplicate a fixed message type with meaningless action or schema tags.
- If one key authorizes several message types, add an explicit domain tag and document the shared compromise scope.
- Keep raw credentials and mutable social identity out of economic state and events.

## Prevent replay with linearity

- Prefer consuming a unique authorization resource over storing `claimed: bool` or a parallel nonce.
- Validate first, consume the resource, construct and return the result, then emit.
- Use non-copyable, non-droppable payloads for migration, flash, or settlement handoffs.
- Require the exact sealed witness type to redeem a cross-package handoff.
- Treat events as index facts, never replay guards.
- Define an explicit bounded replay policy before adding a repeatable signed operation.

## Bound state and work

- Bound every persistent collection with a named protocol constant, and record the reachable maximum plus intentional slack.
- Bound every loop whose input can grow on chain.
- Check duplicates before consuming capacity.
- Define behavior at capacity. When bounded work is optional, prefer a safe liveness-preserving fallback over aborting the user's primary transition.
- Test empty, full, first-over-capacity, duplicate, removal, and re-addition cases.
- Avoid public inputs that cause unbounded deserialization, iteration, event size, or dynamic-field growth.
- Keep pending work and retry state bounded and explicitly releasable.

## Treat rounding as value transfer

- Document who receives each remainder.
- Round user payouts and collateral values down by default.
- Round user obligations, protocol fees, and debt up by default.
- Reject zero-output trades, zero-share deposits, and other silent value loss.
- Use wider intermediates and prove the narrowing boundary.
- Prefer pinned standard-library `checked_*`, `mul_div`, `mul_div_ceil`, `div_ceil`, min/max, and integer bounds.
- Include rounding direction in function names.
- Test zero, one atomic unit, maximum supported values, both sides of thresholds, intermediate overflow, exact division, and one-unit remainders.
- Test inverse operations against a documented dust bound.

## Preserve conservation and custody

Write and test an operation-specific identity derived from:

```text
assets in = assets out + reserves + accrued fees + pending custody + explicitly burned amount
```

- Keep reserves, fees, pending burns, allocations, residuals, and claims separate when their owner or terminal treatment differs.
- Use actual balances as authority, never event-only counters or SDK previews.
- Reconcile after every operation and multi-operation sequence.
- Make burn, disposal, refund, fee, residual, and rounding treatment explicit.
- Do not call disposal a burn unless native supply authority confirms destruction.
- Reject unexpected residuals or clamps that could conceal a broken invariant.

## Defend external seams

- Perform cheap checks before external reads or calls.
- Validate returned object identity, original type, package, pair, tier, amounts, liquidity, price deviation, and residual bounds.
- Keep external dependency and failure surfaces in adapters, not core.
- Lock before callback-capable handoff. Validate the exact receipt and repayment before unlocking.
- Do not support an external venue whose required payment or custody model violates core invariants.
- Verify deployed bytecode and ABI; a local link stub proves type compatibility only.

## Define pause, version, and upgrade behavior

- Define pause scope exactly and preserve user exits and mandatory settlement unless explicitly rejected by the design.
- Gate every mutation of shared protocol state at its own use site with an explicit operational package version, before other guards; a witness minted before cutover must not unlock an old mutator.
- Keep native upgrade commit separate from operational activation. Activate only the expected next compiled generation so a wrong build leaves the previous generation able to authorize repair.
- Do not version-gate a self-custodial exit or deletion of a caller-owned inert object when it mutates no shared state.
- Validate that `Publisher` and `UpgradeCap` belong to the original package before custody.
- Validate exact upgrade digests and matching framework receipts.
- Permit upgrade-policy changes only toward more restrictive settings unless governance explicitly approves otherwise.
- Keep wrapped upgrade custody and shared-state version gates; neither replaces the other.
- Do not add speculative governance cutovers, disable paths, or replacement-authority hooks.
- Keep secrets, private transaction material, and deployment credentials out of source, logs, fixtures, and summaries.

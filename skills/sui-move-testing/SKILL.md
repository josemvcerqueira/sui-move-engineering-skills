---
name: sui-move-testing
description: Build risk-based Sui Move tests, exact abort checks, guard-precedence cases, stateful hot-potato fixtures, math properties, event reducers, dependency verification, and release gates. Use when adding, changing, fixing, or reviewing Move tests or behavior.
---

# Sui Move Testing

Test the invariant and threat surface, not only the happy-path function name.

Target repository instructions, accepted design records, pinned toolchain behavior, and published compatibility commitments take precedence over this standard's examples.

## Cover every risk layer

- Pure math: tables, boundaries, monotonicity, inverse dust bounds, and properties.
- Lifecycle: every legal edge and rejection from every illegal source state.
- Authorization: allowed and forbidden actions, rotation, revocation, last-authority destruction or handoff, pause, and version precedence.
- Accounting: reserves, fees, allocations, vesting, burns, and conservation after operations and sequences.
- Adversarial: direct public calls, PTB composition, replay, third-party signature submission, expiry, wrong domain, wrong type or object, slippage, stale or selectable oracle data, callback-like handoffs, randomness selection, duplicate settlement, and hostile assets.
- Events: every payload field and full reducer replay against final state.
- Upgrades: old-version rejection, initializer authority, capability binding, policy narrowing, and ABI/storage compatibility.
- Deployment and dependencies: dry run, finality, normalized artifacts, exact pins, and live external ABI checks.

## Write direct tests

- Start each test module with `#[test_only] module`.
- Use the production section style with title-cased headings.
- Name each test as a behavioral statement.
- Keep pure math and error-registry tests fixture-free. Pin every package error number and stable meaning in the registry test.
- Give builders deterministic safe defaults and receiver-style `with_*` modifiers so a test states only its relevant delta.
- Use fixed seeds for random tests and print enough input to reproduce failure.

## Pin exact failures

Never use a bare expected failure:

```move
#[test]
#[expected_failure(
    abort_code = protocol::errors::EInvalidBps,
    location = protocol::bps,
)]
fun constructor_rejects_the_first_value_above_the_limit() {
    bps::new(10_001);
}
```

- Assert the exact intended abort and raising module.
- Add pairwise invalid-input tests to pin guard precedence.
- Assert framework errors when the framework is the intended enforcement layer.
- Ensure cleanup cannot make a negative test pass through an unrelated abort.
- When the harness exposes failed transaction effects, snapshot relevant state, assets, and events and prove the aborted path leaves them unchanged.

## Use purpose-specific stateful fixtures

Use small, ability-free hot-potato fixtures:

- Create one fixture type per setup family and name it for what it provides.
- Store the `Scenario` plus only the objects that family uses.
- Use `Option<T>` fields only for consuming or replacement flows.
- Hide option access behind `take_*`, `replace_*`, or `retake_*` helpers.
- Provide one uniquely named `start_*` function for all setup choreography.
- Provide one consuming `<fixture>_end` function that returns or destroys every object and ends the scenario.
- Provide a receiver-style `<fixture>_next_tx!` macro that advances sender and passes one named fixture handle to the closure.
- Provide a fixture `ctx!` macro as the only transaction-context access in test bodies.
- Alias helpers with `use fun helper as Fixture.method`, especially when several fixture types exist.
- Put fixture macros, setup, and helpers in titled sections after the tests, using the section vocabulary required by the repository's structural gate. Never interleave helpers with tests.
- Limit test bodies to starts, transaction macros, fixture methods and field reads, assertions, and one `end`.
- Never touch `test_scenario`, the scenario field, context internals, or fixture `Option` internals directly in a test body.

## Test arithmetic and economics

- Include zero, one, maximum supported values, and just below/at/above every threshold.
- Stress intermediate multiplication even when the final result fits.
- Test the declared rounding beneficiary with one-unit remainders.
- Assert the operation-specific conservation equation after each operation and long sequence.
- Add properties for monotonicity, bounded dust, inverse behavior, and allocation sums.
- Keep shared vectors explicit about units and regenerate them from one formula source; do not hand-edit expected values.
- When replacing custom logic with a pinned framework function or macro, retain boundary, rounding, and exact-abort tests; similarity of names does not prove semantic equivalence.
- Exercise a bounded inline collection at maximum cardinality through applicable lifecycle paths, and measure serialized size and gas. For dynamic child storage, also decode every entry and prove close and destruction strand no children or storage rebates.

## Test adversarial integrations

- Test deadline units and before, exact, and after-boundary `Clock` values. Test oracle source, pair, units, zero or invalid values, stale and future updates, confidence or deviation, liquidity, and caller-selectable historical data.
- When a contract verifies off-chain signatures, submit each signed action through the intended actor and an unrelated third party; the latter must fail harmlessly or produce exactly the signer-approved result. Test every bound domain and omit domains the accepted design does not require.
- Exercise admitted assets under mint, deny, global pause, and action-policy powers that the asset model permits, and reconcile authoritative balance deltas.
- For irreversible authority destruction or handoff, prove successor usability plus every required exit, cancel, refund, claim, unwind, retry, and settlement path under pause and version states.
- For `sui::random`, test forbidden composition, conditional abort and retry, gas-budget outcome selection, internal generator construction, and any commit-reveal liveness.

## Freeze event replay

- Collect payloads and assert every field, not only event count or type.
- For every event and payload field, identify the authoritative recovery source and prove the field adds a required fact. Include native effects, transaction metadata, compiled constants, immutable object content recorded by creation effects, and the prior stream in that audit.
- Assert eventless initialization when publication effects and bytecode recover every initial fact. Add a source-boundary gate that fails if an initializer emits again.
- For new or pre-publication payloads, gate values equal to `ctx.sender()` when native metadata already supplies the fact; preserve documented attested actors, beneficiaries, and recipients that can differ from the sender.
- Reduce native-ordered events and compare every promised replayable field with final object state.
- Cover configuration changes between economic operations.
- Cover failed transitions and retries without inventing events for rolled-back state.
- Cover multiple entities and multiple events in one transaction.
- Make a schema change fail until reducer and field assertions are updated.
- Keep explicit tests for deliberate redundancy such as delta plus total, old/new pairs, complete reconciliation snapshots, and values removed or delivered.

## Verify upgrades and dependencies

- Test correct and incorrect `Publisher`, `UpgradeCap`, package, digest, receipt, and policy transitions.
- Test old-version rejection and initializer authority.
- For every version-gated cross-package seam, test that a dependent linked to the previous generation is rejected after activation and that the accepted dependency re-link or retirement path remains live.
- Test that every returned key-only object composes in the same transaction and lands through its defining module's `share` or `keep` sink.
- Verify an adapter against the deployed external ABI, not only local link stubs.
- Fail closed on missing, null, duplicate, unknown, or added ABI fields that change consumed semantics; review harmless additive fields before updating the fingerprint.
- Detect mutable dependency selectors, wrong repositories, wrong subdirectories, edge rebinding, and lockfile drift.
- Review a new external revision before updating a committed fingerprint.

## Run release gates

Use the exact pinned toolchain. A typical Sui Move gate is:

```bash
sui move build
sui move lint --warnings-are-errors
sui move test --lint
```

Also run repository formatting, source-boundary, dependency-pin, external-ABI, coverage, and `git diff --check` gates when present. If the pinned coverage tool misrepresents a branch, use named branch tests and document the limitation instead of inventing a false metric.

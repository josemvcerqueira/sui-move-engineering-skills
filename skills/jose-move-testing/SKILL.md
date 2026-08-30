---
name: jose-move-testing
description: Build Jose-style risk-based Sui Move tests, exact abort checks, guard-precedence cases, stateful hot-potato fixtures, math properties, event reducers, dependency verification, and release gates. Use when adding, changing, fixing, or reviewing Move tests or behavior.
---

# Jose Move Testing

Test the invariant and threat surface, not only the happy-path function name.

## Cover every risk layer

- Pure math: tables, boundaries, monotonicity, inverse dust bounds, and properties.
- Lifecycle: every legal edge and rejection from every illegal source state.
- Authorization: allowed and forbidden actions, rotation, revocation, pause, and version precedence.
- Accounting: reserves, fees, allocations, vesting, burns, and conservation after operations and sequences.
- Adversarial: replay, expiry, wrong sender, wrong domain, wrong type, wrong object, slippage, callback, duplicate settlement, and hostile asset assumptions.
- Events: every payload field and full reducer replay against final state.
- Upgrades: old-version rejection, initializer authority, capability binding, policy narrowing, and ABI/storage compatibility.
- Deployment and dependencies: dry run, finality, normalized artifacts, exact pins, and live external ABI checks.

## Write direct tests

- Start each test module with `#[test_only] module`.
- Use the production section style with title-cased headings.
- Name each test as a behavioral statement.
- Use `assert_eq!` for values and plain `assert!` for predicates.
- Import frequently used `std::unit_test::{assert_eq, destroy}` members.
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

Example aliases:

```move
use fun claim_ctx as ClaimFixture.ctx;
use fun claim_end as ClaimFixture.end;
use fun claim_next_tx as ClaimFixture.next_tx;
```

## Test arithmetic and economics

- Include zero, one, maximum supported values, and just below/at/above every threshold.
- Stress intermediate multiplication even when the final result fits.
- Test the declared rounding beneficiary with one-unit remainders.
- Assert the operation-specific conservation equation after each operation and long sequence.
- Add properties for monotonicity, bounded dust, inverse behavior, and allocation sums.
- Keep shared vectors explicit about units and regenerate them from one formula source; do not hand-edit expected values.
- When replacing custom logic with a pinned framework function or macro, retain boundary, rounding, and exact-abort tests; similarity of names does not prove semantic equivalence.
- Exercise a bounded collection at maximum cardinality through creation, reads, mutation, cancellation, close, and destruction as applicable. Measure serialized size and gas, decode every entry, and verify no dynamic-field children or storage rebates are stranded.

## Freeze event replay

- Collect payloads and assert every field, not only event count or type.
- For every event and payload field, identify the authoritative recovery source and prove the field adds a required fact. Include native effects, transaction metadata, compiled constants, immutable object content recorded by creation effects, and the prior stream in that audit.
- Assert eventless initialization when publication effects and bytecode recover every initial fact. Add a source-boundary gate that fails if an initializer emits again.
- Gate payloads against restating `ctx.sender()`: fail on actor-named fields and on emitter call sites that pass `ctx.sender()` as an actor argument, while preserving role-named actors and recipients that can differ from the sender.
- Reduce native-ordered events and compare every promised replayable field with final object state.
- Cover configuration changes between economic operations.
- Cover failed transitions and retries without inventing events for rolled-back state.
- Cover multiple entities and multiple events in one transaction.
- Make a schema change fail until reducer and field assertions are updated.
- Keep explicit tests for deliberate redundancy such as delta plus total, old/new pairs, complete reconciliation snapshots, and values removed or delivered.

## Verify upgrades and dependencies

- Test correct and incorrect `Publisher`, `UpgradeCap`, package, digest, receipt, and policy transitions.
- Test old-version rejection and initializer authority.
- Test that every returned key-only object composes in the same transaction and lands through its defining module's `share` or `keep` sink.
- Verify an adapter against the deployed external ABI, not only local link stubs.
- Fail closed on missing, null, duplicate, unknown, or newly added ABI fields.
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

---
name: sui-move-review
description: Audit Sui Move code against the complete engineering standard. Use for pull-request, branch, diff, package, module, security, architecture, event, error, test, or release-readiness reviews that need all suite conventions applied together.
---

# Sui Move Review

Perform one evidence-based review across the complete standard.

## Load the standards

Read these sibling skills completely before reviewing:

1. [sui-move-architecture](../sui-move-architecture/SKILL.md)
2. [sui-move-source-style](../sui-move-source-style/SKILL.md)
3. [sui-move-security](../sui-move-security/SKILL.md)
4. [sui-move-events-errors](../sui-move-events-errors/SKILL.md)
5. [sui-move-testing](../sui-move-testing/SKILL.md)

Read the target repository instructions, package manifest, relevant design records, implementation, tests, and structural gates. Treat reference repositories as evidence, not authority over the target's accepted protocol decisions.

## Review in this order

1. Establish intended behavior, assets and invariants, threat assumptions, required liveness and exits, and the published compatibility boundary.
2. Map package and module responsibilities, state ownership, dependency direction, and every authority issuance and custody-changing path.
3. Run a redundancy pass over stored fields, event types and fields, public seams, parameters, helpers, and locals. Name each fact's authority and consumer; preserve type/ability boundaries and replay-critical redundancy.
4. Search callers and trace every changed or transitively affected production transition through fail-fast guards, read-only dependency data, proposed values, postconditions, effectful handoffs, mutation, asset movement, emission, and returns.
5. Reconcile arithmetic, rounding, balances, fees, burns, refunds, and residuals.
6. Check event replay, payload necessity, error ownership, abort location, and guard precedence.
7. Check naming, sections, imports, visibility, abilities, signatures, `self` receiver naming, receiver syntax, direct UID access, pinned framework reuse, macro choices, local usage, and test-only seams.
8. Check test evidence across positive, negative, boundary, stateful invariant, adversarial composition, signatures, time, oracle, randomness, hostile-asset, replay, emergency, upgrade, and dependency risks.
9. Run the relevant pinned build, lint, test, source-boundary, ABI, dependency, coverage, and diff checks when available.

## Report findings

Lead with actionable findings ordered by severity. For each finding, include:

- exact file and tight line range;
- violated invariant or published contract;
- concrete failure or exploit path;
- smallest correct remediation;
- missing regression test when applicable.

Do not report personal style preferences as defects. Do not recommend a new abstraction without a concrete requirement. Distinguish confirmed defects from questions and evidence gaps.

After findings, list residual validation gaps or state that none remain. If there are no actionable findings, say so directly and summarize which gates and risk surfaces were checked.

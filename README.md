# Sui Move Engineering Skills

Reusable Sui Move engineering standards extracted from production contract patterns and generalized for other teams. The suite separates concerns so agents load only the rules a task needs.

## Install

Install the complete suite globally for every supported agent:

```bash
npx skills add josemvcerqueira/sui-move-engineering-skills -g --all
```

List the available skills before installing:

```bash
npx skills add josemvcerqueira/sui-move-engineering-skills --list
```

Install one skill only:

```bash
npx skills add josemvcerqueira/sui-move-engineering-skills -g \
  --skill sui-move-security \
  --yes
```

The installer detects supported agents and links or copies each selected skill into the appropriate user-level directory. Restart or begin a new agent session after installation if the new skills are not discovered immediately.

## Updates and releases

One semantic version covers the complete suite. A patch release corrects wording or sources, a minor release adds rules, checks, or skills, and a major release removes or renames skills or changes a workflow incompatibly. Individual `SKILL.md` files do not carry separate versions.

Current release: `v0.3.0`.

Read the [changelog](CHANGELOG.md) or watch [GitHub Releases](https://github.com/josemvcerqueira/sui-move-engineering-skills/releases) to learn what changed and whether action is required.

Update every globally installed skill:

```bash
npx skills update -g
```

Update one skill:

```bash
npx skills update sui-move-security -g
```

## Use

- Invoke `$sui-move-guide` when you want the smallest applicable skill sequence.
- Invoke `$sui-move-review` for a full architecture, source, security, event/error, and testing audit.
- Invoke a focused skill directly, or let compatible agents load it from its frontmatter description.

## Skills

| Skill | Use it for |
| --- | --- |
| `sui-move-guide` | Choose the correct skill or complete flow. Invoke it explicitly. |
| `sui-move-architecture` | On-chain scope, packages, modules, minimal state, authority, abilities, and dependency seams. |
| `sui-move-source-style` | Sections, imports, names, visibility, signatures, receiver and index syntax, direct UID access, pinned framework reuse, locals, and API vocabulary. |
| `sui-move-security` | Invariant preservation, liveness, capabilities, replay, custody, DeFi accounting, adapters, time, oracles, randomness, and upgrades. |
| `sui-move-events-errors` | Minimal replay-complete events, native metadata, identity, emitters, stable errors, and abort ownership. |
| `sui-move-testing` | Risk-based tests, exact failures, fixtures, properties, replay, and release gates. |
| `sui-move-review` | Full review across all five standards. |

## Suggested flows

- New package or major feature: architecture → security → source style → events/errors → testing → review.
- Existing transition: security + source style + testing; add architecture or events/errors when their boundaries change.
- Pull request: `sui-move-review`.
- Unsure: `sui-move-guide`.

Each directory under `skills/` is installer-discoverable. Install the complete set for routing and full reviews, or install one focused standard for a narrow task.

Detailed DeFi and pinned-library procedures ship as bundled references and are loaded only when their subject applies. This keeps ordinary security and source-style tasks smaller without dropping specialized rules.

Project-specific accepted decisions and published ABI take precedence over examples. Do not copy product constants, storage layouts, error numbers, or dependency revisions between protocols without independent review.

## License

[MIT](LICENSE)

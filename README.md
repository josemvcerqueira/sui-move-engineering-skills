# Jose Move Skills

Reusable Sui Move engineering standards extracted from production contract patterns and generalized for other teams. The suite separates concerns so agents load only the rules a task needs.

## Install

Install the complete suite globally for every supported agent:

```bash
npx skills add josemvcerqueira/jose-move-skills -g --all
```

List the available skills before installing:

```bash
npx skills add josemvcerqueira/jose-move-skills --list
```

Install one skill only:

```bash
npx skills add josemvcerqueira/jose-move-skills -g \
  --skill jose-move-review \
  --yes
```

The installer detects supported agents and links or copies each selected skill into the appropriate user-level directory. Restart or begin a new agent session after installation if the new skills are not discovered immediately.

To update installed skills later:

```bash
npx skills update -g
```

## Use

- Invoke `$ask-jose` when you want the smallest applicable skill sequence.
- Invoke `$jose-move-review` for a full architecture, source, security, event/error, and testing audit.
- Invoke a focused skill directly, or let compatible agents load it from its frontmatter description.

## Skills

| Skill | Use it for |
| --- | --- |
| `ask-jose` | Choose the correct skill or complete flow. Invoke it explicitly. |
| `jose-move-architecture` | On-chain scope, packages, modules, minimal state, authority, abilities, and dependency seams. |
| `jose-move-source-style` | Sections, imports, names, visibility, signatures, `self` naming, receiver syntax, direct UID access, framework and macro reuse, locals, and API vocabulary. |
| `jose-move-security` | Guards, capabilities, signed actions, replay, bounds, arithmetic, custody, adapters, and upgrades. |
| `jose-move-events-errors` | Minimal replay-complete events, native metadata, identity, emitters, stable errors, and abort ownership. |
| `jose-move-testing` | Risk-based tests, exact failures, fixtures, properties, replay, and release gates. |
| `jose-move-review` | Full review across all five standards. |

## Suggested flows

- New package or major feature: architecture → security → source style → events/errors → testing → review.
- Existing transition: security + source style + testing; add architecture or events/errors when their boundaries change.
- Pull request: `jose-move-review`.
- Unsure: `ask-jose`.

Each directory under `skills/` is an independent installable skill. Install the complete set when you want routing and full reviews, or install only the focused standards your project uses.

Project-specific accepted decisions and published ABI take precedence over examples. Do not copy product constants, storage layouts, error numbers, or dependency revisions between protocols without independent review.

## License

[MIT](LICENSE)

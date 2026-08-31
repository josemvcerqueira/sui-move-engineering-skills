# Durable reference policy

Repository guidance must remain understandable and reviewable without access to
private repositories, third-party documentation sites, or mutable web pages.

## Allowed references

Markdown may link only to:

1. A relative file committed in this repository. Use this for rules, research
   conclusions, reusable pattern references, changelog entries, and supporting
   evidence that the repository must preserve.
2. Source in `MystenLabs/sui` at a full 40-character commit. Direct framework
   links are allowed because they expose the exact implementation evidence used
   by a rule. Never link to `main`, a release branch, an abbreviated commit, or
   documentation content under the Sui repository's `docs/` tree.

All other external URLs are prohibited, including `docs.sui.io`, other public
documentation sites, product repositories, private repositories, and links to
this repository's web UI.

## Internalize reusable rules

When documentation or another codebase establishes a reusable rule:

1. Add or update an in-repository note named for the topic or pattern, not the
   product where it was discovered.
2. State the problem, applicability boundary, invariant, safe sequence,
   tradeoffs, failure modes, and verification obligations in generic terms.
3. Use role-based example names such as `Authority`, `PendingPosition`,
   `AdapterWitness`, and `Vault`. Omit product names, bespoke type names,
   repository paths, source line ranges, and test counts unless that identity is
   itself required for interoperability.
4. Treat third-party implementations as discovery input. Promote only the rule
   that can be explained and reviewed without access to the original product.
5. Link skills, patterns, and other guidance to the local topic or pattern note.
6. Add a commit-pinned `MystenLabs/sui` source link when framework behavior
   directly corroborates the rule.

An external page or product is discovery input, not context required to apply a
rule. If that source changes or disappears, the rule must still be recoverable
from the local note, its reasoning, and any pinned framework source.

## Validation

`npm run validate` scans every Markdown file, rejects a disallowed external URL,
rejects a non-pinned Sui URL, and checks that each relative Markdown file and
heading anchor exists. Keep the validation allowlist narrower than this prose;
expand it only through an explicit policy change.

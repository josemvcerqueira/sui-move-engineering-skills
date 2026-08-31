# Durable reference policy

Repository guidance must remain understandable and reviewable without access to
private repositories, third-party documentation sites, or mutable web pages.

## Allowed references

Markdown may link only to:

1. A relative file committed in this repository. Use this for rules, research
   conclusions, private or third-party implementation audits, changelog entries,
   and supporting evidence that the repository must preserve.
2. Source in `MystenLabs/sui` at a full 40-character commit. Direct framework
   links are allowed because they expose the exact implementation evidence used
   by a rule. Never link to `main`, a release branch, an abbreviated commit, or
   documentation content under the Sui repository's `docs/` tree.

All other external URLs are prohibited, including `docs.sui.io`, other public
documentation sites, product repositories, private repositories, and links to
this repository's web UI.

## Internalize durable rules

When documentation or another codebase establishes a reusable rule:

1. Add or update an in-repository research note.
2. Record the source identity, inspected commit, relevant file and line ranges,
   date or release context, derived rule, limitations, and verification result.
   Source identities and commits from disallowed repositories remain plain text,
   not hyperlinks.
3. Paraphrase the evidence needed to understand and re-review the conclusion.
   Do not copy substantial third-party source or documentation into this
   repository.
4. Link skills, patterns, and other guidance to the local research note.
5. Add a commit-pinned `MystenLabs/sui` source link when framework behavior
   directly corroborates the rule.

An external page is discovery input, not durable repository evidence. If a Sui
Docs page changes or disappears, the rule must still be recoverable from the
local note and its pinned framework source.

## Validation

`npm run validate` scans every Markdown file, rejects a disallowed external URL,
rejects a non-pinned Sui URL, and checks that each relative Markdown file and
heading anchor exists. Keep the validation allowlist narrower than this prose;
expand it only through an explicit policy change.

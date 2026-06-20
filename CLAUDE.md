# CLAUDE.md — developing this fork

Repo-specific dev notes for `iamvincentong/ponytail` (a fork of `DietrichGebert/ponytail`).
Product behavior lives in `AGENTS.md` and `skills/`; this file is just how to develop and release.

## Dev → release loop

The plugin is installed from this fork's `main` and runs from a **version-keyed cache**
(`~/.claude/plugins/cache/ponytail/ponytail/<version>/`). Changes on `main` do NOT
auto-update an installed plugin — you must bump the version and reinstall.

1. Branch from `main`, develop, commit.
2. **Bump the version** in `.claude-plugin/plugin.json` (e.g. `4.7.0` → `4.7.1`).
   Skipping this lets the installer treat the version as "already installed" and skip your update.
3. `node --test tests/*.test.js` — must be green (the pre-existing `csv`/pandas test
   fails without a pandas env; ignore only that one). If you touched a `skills/*/SKILL.md`,
   regenerate the OpenClaw copies: `node scripts/build-openclaw-skills.js`.
4. Push, open a PR **against this fork** (`gh pr create --repo iamvincentong/ponytail`,
   not the upstream), merge to `main`.
5. Refresh the installed plugin in Claude Code:
   ```
   /plugin marketplace update ponytail
   /plugin install ponytail@ponytail
   /reload-plugins
   ```
   Fallback if `marketplace update` is unrecognized: `/plugin marketplace remove ponytail`
   → `/plugin marketplace add iamvincentong/ponytail` → install → reload.
6. Verify the cache has your change:
   `grep -c "<your-new-marker>" ~/.claude/plugins/cache/ponytail/ponytail/*/skills/<skill>/SKILL.md`

## Names (for the install commands)

Both are literally `ponytail` (`.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`),
so the install target is `ponytail@ponytail` (`<plugin>@<marketplace>`).

## Git

This repo is owned by `iamvincentong`; the remote uses the `github-iamvincentong` SSH alias.
`gh` must be on the `iamvincentong` account to merge here (`gh auth switch --user iamvincentong`).
`upstream` points at `DietrichGebert/ponytail` — never PR or push there by default.

## Parity invariant

`skills/ponytail-review/SKILL.md` and `commands/ponytail-review.toml` must stay in lockstep
(tags, precedence, the `?` gate, the AGENTS.md carve-outs, the verdict shape).
`tests/ponytail-review.test.js` guards this — keep it green when editing either file.

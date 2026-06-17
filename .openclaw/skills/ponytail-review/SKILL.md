---
name: ponytail-review
description: "Review a diff for over-engineering. Finds what to delete: reinvented stdlib, needless deps, speculative abstractions. One line per finding."
homepage: https://github.com/DietrichGebert/ponytail
license: MIT
---

Review diffs for unnecessary complexity. One line per finding: location, what
to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs. End a finding with a rough line estimate when it helps the
reader weigh it (`~-12`, `-1 dep`); exact counts are not required.

Tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled logic the language/runtime stdlib ships. Name the function.
- `native:` a third-party dependency added solely for what a platform/builtin already does. Name the feature. Do not flag a dependency already installed and reused elsewhere (reusing an installed dep is fine, per the ladder).
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` pure restructuring, same logic, fewer lines, no library swap, and at least as readable. Show the shorter form. Boring over clever: never flag readable code for a denser form that only wins on line count.

Precedence when more than one tag fits, highest wins, one tag per finding:
`delete:` > `native:` > `stdlib:` > `yagni:` > `shrink:`. (This is value-of-cut
order — removing a thing beats swapping it beats restructuring it — and is
deliberately distinct from the AGENTS.md generation rungs, which rank stdlib
above native. Reviewing what exists is not the same as choosing what to write.)

Gating: when you cannot prove the cut is safe from the diff alone, the
replacement is not behavior-neutral, or the change touches a trust boundary,
suffix the base tag with `?` — `delete?:`, `native?:`, `stdlib?:`, `yagni?:`,
`shrink?:`. That suffix is the only gated form; there is no standalone `verify:`
token, and every finding still carries exactly one base tag. State the
precondition the human must check before applying. See Boundaries.

The tags map past runtime code to SQL/IaC/config diffs: `yagni:` a speculative
index or single-consumer view, a config knob nobody reads; `shrink:` a
correlated subquery rewritten as a join; `delete:` a dead migration step or
commented-out block; `native:` a hand-rolled thing the database/platform ships
(e.g. an app-side UUID a `DEFAULT gen_random_uuid()` covers).

## Examples

❌ "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

✅ `L12-38: 27-line validator at a trust boundary — not flagged. Input validation is a never-flag carve-out (see Boundaries), not bloat. (Internal-only, with a downstream confirmation step? then stdlib?: a one-line check is enough.)`

✅ `L4: native?: moment.js imported for one format call. Intl.DateTimeFormat — verify locale/timezone output matches before swapping. ~-1 line, -1 dep`

✅ `repo.py:L88: yagni?: AbstractRepository with one implementation. Inline it — verify no second impl/caller exists repo-wide and it is not a test seam first. ~-14`

✅ `L52-71: delete?: retry wrapper around a seemingly-idempotent call. Cut only if the call is confirmed idempotent AND no data-loss-on-failure path depends on the retry. ~-20`

✅ `L30-44: stdlib: manual loop builds dict. dict(zip(keys, values)), 1 line. ~-14`

✅ `L60-72: shrink: nested if/else ladder, same branches. Early-return guard clauses. ~-4`

✅ `migrate/007.sql:L3: yagni: index on a column no query filters on yet. Drop until a slow query needs it. ~-1`

## Scoring

End with one rough verdict — the headline is how much the diff can shrink and
how many `?`-gated findings still need a human check before they count:

`net: ~-<N> lines, -<M> deps possible — <J> ?-gated, confirm before cutting.`

Estimate `<N>`; do not compute exact per-finding line math. `<J>` is the count
of `?`-gated findings (drop the clause when none). When there is nothing to cut,
say `Lean already.` and stop. Carve-out code (Boundaries) never counts toward
the estimate. This is a complexity-only verdict, not a release-go; correctness,
security, and performance still owe a separate pass.

## Boundaries

Complexity only, correctness bugs, security holes, and performance go to a
normal review pass, not this one. Does not apply the fixes, only lists them.

Never-flag carve-outs (mirrors AGENTS.md "not lazy about"). These are not bloat;
never flag them for deletion and never count them toward the net-lines metric:

- input validation at trust boundaries;
- error handling that prevents data loss;
- security and accessibility markup (ARIA, alt text, focus management, sr-only);
- calibration real hardware needs (clock drift, sensor offset);
- the ONE runnable check a piece of non-trivial logic leaves behind — an
  `assert`-based self-check or one small test file (no frameworks, no fixtures);
- `ponytail:` comments that name an intentional simplification's ceiling and
  upgrade path;
- framework-required structure that only looks redundant: effect dependency
  arrays, list keys, explicit prop/type declarations, memoization seams. Route
  any such cut through the `?` suffix, never a flat `delete:`/`shrink:`.

A finding that would cut any of the above is out of scope here — route it to the
normal pass, do not emit it as a `delete:`/`shrink:` line.

Unsafe-cut rule: a cut is only this pass's business when its replacement is
behavior-neutral. Add the `?` suffix (not a flat directive) whenever you cannot
prove that from the diff:

- the call's idempotency, dead-ness, or single-caller status depends on code
  outside the diff (reflection, DI, dynamic dispatch, a second impl elsewhere).
  "From the diff" means the WHOLE diff, every file in it — a single-caller or
  dead-code claim must be checked across all diffed files, not just the
  finding's own file; suffix `?` if any other diffed file was not inspected;
- a `native:`/`stdlib:` swap can shift observable output (locale, timezone,
  format, validation strictness) or runtime support;
- the abstraction is a test-substitution seam, a trust/IO boundary, or a
  published API contract.

When unsure, add `?` — never assert a cut is free. Listing a replacement is a
direction to consider, not validated code to paste; flag any replacement whose
correctness depends on surrounding scope.

"stop ponytail-review" or "normal mode": revert to verbose review style.

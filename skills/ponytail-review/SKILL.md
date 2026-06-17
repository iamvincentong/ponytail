---
name: ponytail-review
description: >
  Code review focused exclusively on over-engineering. Finds what to delete:
  reinvented standard library, unneeded dependencies, speculative abstractions,
  dead flexibility. One line per finding: location, what to cut, what replaces
  it. Use when the user says "review for over-engineering", "what can we
  delete", "is this over-engineered", "simplify review", or invokes
  /ponytail-review. Complements correctness-focused review, this one only
  hunts complexity.
---

Review diffs for unnecessary complexity. One line per finding: location, what
to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

`L<line>: <tag> <what>. <replacement>. (<signed line delta>)`, or
`<file>:L<line>: ...` for multi-file diffs. Every finding ends with its net
signed line delta (see Scoring); add `, -<n> dep` when a dependency goes too.

Tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled logic the language/runtime stdlib ships. Name the function.
- `native:` a third-party dependency added solely for what a platform/builtin already does. Name the feature. Do not flag a dependency already installed and reused elsewhere (reusing an installed dep is fine, per the ladder).
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` pure restructuring, same logic, fewer lines, no library swap. Show the shorter form.

Precedence when more than one tag fits: `native:` > `stdlib:` > `shrink:`, and
`delete:` > `yagni:`. Use the highest that applies; never tag one finding twice.

Mark a finding `verify:` (suffix the tag, e.g. `delete?:`, `native?:`) when you
cannot prove the cut is safe from the diff alone, the replacement is not
behavior-neutral, or the change touches a trust boundary. State the precondition
the human must check before applying. See Boundaries.

## Examples

❌ "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

✅ `L12-38: 27-line validator at a trust boundary — not flagged. Input validation is a never-flag carve-out (see Boundaries), not bloat. (Internal-only, with a downstream confirmation step? then stdlib?: a one-line check is enough.)`

✅ `L4: native?: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps — verify locale/timezone output matches before swapping. (-1 line, -1 dep)`

✅ `repo.py:L88: yagni?: AbstractRepository with one implementation. Inline it — verify no second impl/caller exists repo-wide and it is not a test seam first. (-14)`

✅ `L52-71: delete?: retry wrapper around a seemingly-idempotent call. Cut only if the call is confirmed idempotent AND no data-loss-on-failure path depends on the retry; verify before removing. (-20)`

✅ `L30-44: stdlib: manual loop builds dict. dict(zip(keys, values)), 1 line. (-14)`

✅ `L60-72: shrink: nested if/else ladder, same branches. Early-return guard clauses. (-4)`

## Scoring

Every finding ends with its own signed line delta in parens — `(-12)` for a
deletion, `(-4)` for a swap that removes 6 and adds 2, `(0)` for a structural
cut that nets no lines. A swap's delta is net (lines removed minus replacement
lines added), never gross. `verify:`-gated findings carry a delta too, but it is
counted separately below.

End with one verdict line summing those deltas:

- `net: -<N> lines, -<M> deps possible (proven); -<K> more lines if <J> verify: checks pass.`
- when proven cuts net zero lines but still remove complexity/deps:
  `net: 0 lines, -<M> deps / <J> verify: checks to confirm.`
- when there is nothing to cut at all: `Lean already.` and stop.

Carve-out code (Boundaries) is never counted in any of these totals. This is a
complexity-only verdict, not a release-go; correctness, security, and
performance still owe a separate pass.

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
  upgrade path.

A finding that would cut any of the above is out of scope here — route it to the
normal pass, do not emit it as a `delete:`/`shrink:` line.

Unsafe-cut rule: a cut is only this pass's business when its replacement is
behavior-neutral. Use `verify:` (not a plain directive) whenever you cannot prove
that from the diff:

- the call's idempotency, dead-ness, or single-caller status depends on code
  outside the diff (reflection, DI, dynamic dispatch, a second impl elsewhere);
- a `native:`/`stdlib:` swap can shift observable output (locale, timezone,
  format, validation strictness) or runtime support;
- the abstraction is a test-substitution seam, a trust/IO boundary, or a
  published API contract.

When unsure, `verify:` — never assert a cut is free. Listing a replacement is a
direction to consider, not validated code to paste; flag any replacement whose
correctness depends on surrounding scope.

"stop ponytail-review" or "normal mode": revert to verbose review style.

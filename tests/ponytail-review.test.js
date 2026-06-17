#!/usr/bin/env node
// Contract + parity guard for /ponytail-review. The review skill is a prompt
// executed by a model at runtime, so there is no engine here to feed a diff to
// and assert the emitted tag/precedence/verify/net -- that needs an API key and
// lives in the promptfoo evals, not in `node --test`. What this file CAN guard,
// and what kept drifting, is that the structured SKILL.md and the one-paragraph
// firing manifest (commands/ponytail-review.toml) stay in lockstep on the rules
// a senior relies on: the five tags + precedence, the verify gate, the AGENTS.md
// never-flag carve-outs, and the net-delta scoring. A change to one file that is
// not mirrored in the other fails here.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skill = fs.readFileSync(path.join(root, 'skills', 'ponytail-review', 'SKILL.md'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'commands', 'ponytail-review.toml'), 'utf8');
const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');

const TAGS = ['delete', 'stdlib', 'native', 'yagni', 'shrink'];

// --- tag vocabulary parity ---

test('both surfaces name all five tags', () => {
  for (const tag of TAGS) {
    assert.ok(skill.includes(`\`${tag}:\``), `SKILL.md missing tag ${tag}:`);
    assert.match(manifest, new RegExp(`\\b${tag}\\b`), `manifest missing tag ${tag}`);
  }
});

test('precedence rule is stated in both', () => {
  for (const [name, src] of [['SKILL.md', skill], ['manifest', manifest]]) {
    assert.match(src, /native.*>.*stdlib.*>.*shrink/s, `${name} missing native>stdlib>shrink`);
    assert.match(src, /delete.*>.*yagni/s, `${name} missing delete>yagni`);
    assert.match(src, /never tag (one finding|a finding) twice|one tag per finding/i, `${name} missing no-double-tag`);
  }
});

// --- verify: gate parity ---

test('verify gate (?-suffix) is defined in both', () => {
  for (const [name, src] of [['SKILL.md', skill], ['manifest', manifest]]) {
    assert.ok(src.includes('delete?:') || src.includes('delete?'), `${name} missing ?-suffix verify form`);
    assert.match(src, /behavior-neutral/, `${name} missing behavior-neutral language`);
    assert.match(src, /trust boundary/i, `${name} missing trust-boundary trigger`);
  }
});

// --- AGENTS.md never-flag carve-out parity (the contradiction cluster) ---
// Each carve-out AGENTS.md L24 names as "not lazy about" must appear as a
// never-flag in BOTH the skill and the manifest, or the review skill will
// recommend cutting what the generation skill mandates.

const CARVE_OUTS = [
  /input validation/i,
  /data loss/i,
  /security/i,
  /accessibilit/i,
  /calibrat/i,
  /assert-based self-check|one small test file/i,
  /ponytail:/,
];

test('AGENTS.md still declares the carve-outs this skill mirrors', () => {
  // Guards the source of truth: if AGENTS.md drops a carve-out, revisit the mirror.
  assert.match(agents, /Not lazy about:/);
  for (const re of [/input validation/i, /data loss/i, /security/i, /accessibilit/i, /calibrat/i]) {
    assert.match(agents, re, `AGENTS.md no longer names carve-out ${re}`);
  }
});

test('every carve-out is never-flagged in SKILL.md', () => {
  for (const re of CARVE_OUTS) {
    assert.match(skill, re, `SKILL.md missing never-flag carve-out ${re}`);
  }
  assert.match(skill, /never flag/i);
  assert.match(skill, /never count/i, 'SKILL.md must exclude carve-outs from net');
});

test('every carve-out is never-flagged in the manifest', () => {
  for (const re of CARVE_OUTS) {
    assert.match(manifest, re, `manifest missing never-flag carve-out ${re}`);
  }
  assert.match(manifest, /never (flag|count)/i);
});

// --- scoring parity (the trustworthy-scalar cluster) ---

test('net scalar counts deps and separates proven from verify:-gated, in both', () => {
  for (const [name, src] of [['SKILL.md', skill], ['manifest', manifest]]) {
    assert.match(src, /-.?<?M>?\s*deps|-<M> deps|M deps/i, `${name} net scalar omits deps`);
    assert.match(src, /proven/i, `${name} does not separate proven cuts`);
    assert.match(src, /verify:? checks/i, `${name} does not separate verify-gated cuts`);
    assert.match(src, /signed.*delta|delta/i, `${name} missing per-finding line delta rule`);
  }
});

test('"Ship." is gone from both (complexity pass issues no release-go)', () => {
  assert.ok(!/Lean already\. Ship\./.test(skill), 'SKILL.md still says "Ship."');
  assert.ok(!/Lean already\. Ship\./.test(manifest), 'manifest still says "Ship."');
  assert.match(skill, /Lean already\./);
  assert.match(manifest, /Lean already\./);
});

test('both defer correctness/security/performance to a separate pass', () => {
  for (const [name, src] of [['SKILL.md', skill], ['manifest', manifest]]) {
    assert.match(src, /correctness/i, `${name} missing correctness deferral`);
    assert.match(src, /performance|perf/i, `${name} missing performance deferral`);
  }
});

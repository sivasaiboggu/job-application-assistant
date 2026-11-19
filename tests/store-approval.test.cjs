const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const compile = require('./compile.cjs');
const { Store } = compile()('store');
const { FactSheet } = compile()('facts');
const { TemplateProvider, buildDraft } = compile()('drafting');
const { approveDraft, assertExportable } = compile()('approval');
const { dedupeKeyFor } = compile()('dedupe');

const dir = mkdtempSync(path.join(tmpdir(), 'jaa-store-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

const posting = {
  url: 'https://example.com/careers?utm_source=share',
  company: 'Acme',
  title: 'AI Intern',
  requirements: [],
  capturedAt: '2026-11-19T00:00:00Z',
};

function applicationRecord(id, at) {
  return {
    id,
    dedupeKey: dedupeKeyFor(posting),
    posting,
    status: 'discovered',
    checks: [],
    draftIds: [],
    history: [{ at, event: 'discovered' }],
    createdAt: at,
    updatedAt: at,
  };
}

test('a reposted ad through a fresh link is one application, not two', () => {
  const store = new Store(path.join(dir, 'dedupe.json'));
  const first = store.addApplication(applicationRecord('a1', '2026-11-19T10:00:00Z'));
  assert.equal(first.duplicate, false);
  const second = store.addApplication(applicationRecord('a2', '2026-11-19T11:00:00Z'));
  assert.equal(second.duplicate, true);
  assert.equal(second.record.id, 'a1');
  assert.equal(store.applications().length, 1);
  assert.equal(store.applications()[0].history.at(-1).event, 'duplicate_seen');
});

test('the approval gate blocks export until a person approves the exact draft', () => {
  const store = new Store(path.join(dir, 'gate.json'));
  const sheet = new FactSheet();
  sheet.add('name', 'Aarav Sharma', { kind: 'user', reference: 'chat', at: '2026-11-17' });
  sheet.add('experience', '6 months internship experience', { kind: 'user', reference: 'chat', at: '2026-11-12' });
  const { record } = store.addApplication(applicationRecord('b1', '2026-11-19T10:00:00Z'));
  const draft = buildDraft(new TemplateProvider(), { application: record, kind: 'cover_note', sheet, at: '2026-11-19T10:05:00Z' }, 'd1');
  assert.deepEqual(draft.unresolvedClaims, []);
  store.addDraft(draft);
  assert.throws(() => assertExportable(draft), /not approved/);
  approveDraft(draft, record, 'Reviewer', '2026-11-19T10:06:00Z');
  assert.doesNotThrow(() => assertExportable(draft));
  assert.equal(record.status, 'approved');
});

test('a draft with an unsupported figure cannot be approved', () => {
  const store = new Store(path.join(dir, 'claims.json'));
  const { record } = store.addApplication(applicationRecord('c1', '2026-11-19T10:00:00Z'));
  const sheet = new FactSheet();
  sheet.add('experience', '6 months internship experience', { kind: 'user', reference: 'chat', at: '2026-11-12' });
  const draft = {
    id: 'd2',
    applicationId: record.id,
    kind: 'cover_note',
    body: 'I bring 3 years of experience.',
    factsUsed: [{ key: 'experience', value: '6 months internship experience' }],
    unresolvedClaims: [],
    createdAt: '2026-11-19T10:05:00Z',
  };
  const { verifyDraft } = compile()('drafting');
  const claims = verifyDraft(draft.body, draft.factsUsed);
  assert.equal(claims.length, 1);
  assert.match(claims[0], /unsupported claim "3 years"/);
  draft.unresolvedClaims = claims;
  store.addDraft(draft);
  assert.throws(() => approveDraft(draft, record, 'Reviewer', '2026-11-19T10:06:00Z'), /unverified claims/);
  assert.equal(record.status, 'discovered');
});

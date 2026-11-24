const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { FactSheet } = compile()('facts');
const { TemplateProvider, buildDraft } = compile()('drafting');

const at = '2026-11-24T00:00:00Z';
const source = (reference) => ({ kind: 'user', reference, at });

const posting = {
  url: 'https://example.com/careers/intern',
  company: 'Acme',
  title: 'Software Intern',
  requirements: [],
  capturedAt: at,
};

function application() {
  return {
    id: 'app-1',
    dedupeKey: 'acme:software-intern',
    posting,
    status: 'checked',
    checks: [],
    draftIds: [],
    history: [{ at, event: 'discovered' }],
    createdAt: at,
    updatedAt: at,
  };
}

function draftWith(sheet) {
  return buildDraft(new TemplateProvider(), {
    application: application(),
    kind: 'cover_note',
    sheet,
    at,
  }, 'draft-1');
}

test('a confirmed dated experience reaches the draft with its source value intact', () => {
  const sheet = new FactSheet();
  sheet.add('name', 'Asha Rao', source('profile'));
  sheet.add('experience', 'Whispry, software engineering intern, May 2026 - August 2026', source('resume.pdf'));
  const draft = draftWith(sheet);
  assert.ok(draft.body.includes('Whispry, software engineering intern, May 2026 - August 2026'));
  const used = draft.factsUsed.find((fact) => fact.key === 'experience');
  assert.equal(used.value, 'Whispry, software engineering intern, May 2026 - August 2026');
  assert.deepEqual(draft.unresolvedClaims, []);
});

test('conflicting facts never reach the draft: neither contested value appears', () => {
  const sheet = new FactSheet();
  sheet.add('name', 'Asha Rao', source('profile'));
  sheet.add('graduation', 'May 2027', source('form A'));
  sheet.add('graduation', 'June 2027', source('form B'));
  sheet.add('skills', 'TypeScript', source('resume.pdf'));
  const draft = draftWith(sheet);
  assert.ok(!draft.body.includes('May 2027'));
  assert.ok(!draft.body.includes('June 2027'));
  assert.equal(draft.factsUsed.some((fact) => fact.key === 'graduation'), false);
  // The uncontested facts still flow through.
  assert.ok(draft.body.includes('TypeScript'));
});

test('a superseded value never reaches the draft; only its replacement does', () => {
  const sheet = new FactSheet();
  sheet.add('location', 'Thiruvananthapuram', source('profile v1'));
  sheet.supersede('location', 'Thiruvananthapuram', 'Bengaluru', source('profile v2'));
  const draft = draftWith(sheet);
  assert.ok(!draft.body.includes('Thiruvananthapuram'));
  assert.ok(draft.body.includes('Bengaluru'));
});

test('a key with no fact is omitted, never invented as a placeholder', () => {
  const sheet = new FactSheet();
  sheet.add('name', 'Asha Rao', source('profile'));
  const draft = draftWith(sheet);
  for (const missing of ['degree', 'graduation', 'skills', 'experience', 'location']) {
    assert.equal(draft.factsUsed.some((fact) => fact.key === missing), false, missing);
  }
  assert.deepEqual(draft.unresolvedClaims, []);
});

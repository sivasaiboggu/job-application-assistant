const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { parsePostingText } = compile()('intake');

const AT = '2026-11-22T10:00:00Z';
const GOOD = `Company: Example Labs
Title: Frontend Intern
URL: https://example.test/jobs/42
Location: Pune
Mode: Hybrid
Requires: degree | Pursuing a computer science degree | computer science
Requires: skills | Knows React
random commentary without a label`;

test('labelled text becomes a posting with only the stated fields', () => {
  const r = parsePostingText(GOOD, AT);
  assert.equal(r.ok, true);
  assert.equal(r.posting.company, 'Example Labs');
  assert.equal(r.posting.workArrangement, 'Hybrid');
  assert.equal(r.posting.capturedAt, AT);
  assert.deepEqual(r.posting.requirements, [
    { key: 'degree', description: 'Pursuing a computer science degree', expected: 'computer science' },
    { key: 'skills', description: 'Knows React' },
  ]);
});

test('missing company, title or url is an error, never guessed', () => {
  const r = parsePostingText('Location: Pune', AT);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, ['missing company', 'missing title', 'missing url']);
});

test('a non-http url is rejected', () => {
  const r = parsePostingText('Company: A\nTitle: B\nURL: example.test/x', AT);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /not an http\(s\) link/);
});

test('conflicting duplicate labels are reported, identical repeats are fine', () => {
  const dup = parsePostingText(`${GOOD}\nCompany: Other Co`, AT);
  assert.equal(dup.ok, false);
  assert.match(dup.errors[0], /given twice with different values/);
  assert.equal(parsePostingText(`${GOOD}\nCompany: Example Labs`, AT).ok, true);
});

test('a requirement without key and description is rejected with its line number', () => {
  const r = parsePostingText(`${GOOD}\nRequires: only-a-key`, AT);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /^line 9:/);
});

test('empty values and unlabelled lines are ignored', () => {
  const r = parsePostingText('Company: A\nTitle: B\nURL: https://a.test/\nLocation:\nnotes: ignore me', AT);
  assert.equal(r.ok, true);
  assert.equal(r.posting.location, undefined);
});

test('header aliases read as their canonical fields', () => {
  const r = parsePostingText('Employer: Example Labs\nPosition: Frontend Intern\nLink: https://example.test/jobs/42\nWork arrangement: Remote', AT);
  assert.equal(r.ok, true);
  assert.equal(r.posting.company, 'Example Labs');
  assert.equal(r.posting.title, 'Frontend Intern');
  assert.equal(r.posting.url, 'https://example.test/jobs/42');
  assert.equal(r.posting.workArrangement, 'Remote');
});

test('CRLF line endings parse the same as LF', () => {
  const r = parsePostingText(GOOD.replace(/\n/g, '\r\n'), AT);
  assert.equal(r.ok, true);
  assert.equal(r.posting.company, 'Example Labs');
  assert.equal(r.posting.requirements.length, 2);
});

test('a requirement with an empty expected part reads as having no expected value', () => {
  const r = parsePostingText(`${GOOD}\nRequires: skills | Knows SQL |`, AT);
  assert.equal(r.ok, true);
  assert.deepEqual(r.posting.requirements.at(-1), { key: 'skills', description: 'Knows SQL' });
});

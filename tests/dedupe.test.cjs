const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { canonicalizeUrl, dedupeKeyFor, normalizeText } = compile()('dedupe');

test('tracking params, fragments, www and trailing slashes canonicalize away', () => {
  const a = canonicalizeUrl('https://www.Wellfound.com/jobs/123/?utm_source=share&utm_campaign=x&email_uid=#apply');
  const b = canonicalizeUrl('https://wellfound.com/jobs/123');
  assert.equal(a, b);
  assert.equal(a, 'wellfound.com/jobs/123');
});

test('real query params survive, sorted', () => {
  const url = canonicalizeUrl('https://jobs.example.com/post?b=2&A=1');
  assert.equal(url, 'jobs.example.com/post?a=1&b=2');
});

test('the same ad shared two ways is one duplicate key', () => {
  const base = { company: ' Acriotech ', title: 'AI Engineering Intern' };
  const first = dedupeKeyFor({ ...base, url: 'https://acriotech.com/careers?utm_medium=email' });
  const second = dedupeKeyFor({ ...base, url: 'https://acriotech.com/careers' });
  assert.equal(first, second);
});

test('different roles at one company stay distinct', () => {
  const url = 'https://example.com/careers';
  assert.notEqual(
    dedupeKeyFor({ company: 'Acme', title: 'Backend Intern', url }),
    dedupeKeyFor({ company: 'Acme', title: 'Frontend Intern', url })
  );
});

test('normalizeText collapses punctuation and case', () => {
  assert.equal(normalizeText('  AI Engineering, Intern! '), 'ai engineering intern');
});

test('an unparseable url falls back to normalized text', () => {
  assert.equal(canonicalizeUrl('Acme Careers Page!'), 'acme careers page');
});

test('scheme and port never reach the key', () => {
  assert.equal(
    canonicalizeUrl('http://example.com:8080/jobs/1'),
    canonicalizeUrl('https://example.com/jobs/1')
  );
});

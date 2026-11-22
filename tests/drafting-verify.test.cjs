const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { verifyDraft } = compile()('drafting');

const facts = [
  { key: 'graduation', value: 'BTech Computer Science, 2027' },
  { key: 'experience', value: 'Software developer intern, May-August 2026' },
];

test('a figure is supported only by the same whole number, not a substring of another', () => {
  // "2" is inside "2027" and "20" inside "2026"; neither supports a claim.
  assert.equal(verifyDraft('I have 2 years of experience.', facts).length, 1);
  assert.equal(verifyDraft('I have 20 months of experience.', facts).length, 1);
  assert.equal(verifyDraft('I have 202 months of experience.', facts).length, 1);
});

test('a claim whose number matches a sourced fact exactly is not flagged', () => {
  const sourced = [{ key: 'cgpa', value: 'CGPA 7.73 as of 2026' }];
  assert.deepEqual(verifyDraft('My CGPA is 7.73 cgpa.', sourced), []);
});

test('decimal claims are not satisfied by a different decimal sharing digits', () => {
  const sourced = [{ key: 'cgpa', value: 'CGPA 7.73' }];
  assert.equal(verifyDraft('I hold 7.7 cgpa.', sourced).length, 1);
  assert.equal(verifyDraft('I hold 8.0 cgpa.', sourced).length, 1);
});

test('unresolved placeholders are reported once each', () => {
  const out = verifyDraft('Hello {name}, about {company} and {name}', []);
  assert.deepEqual(out.sort(), ['unresolved placeholder {company}', 'unresolved placeholder {name}']);
});

test('a draft with no quantitative claims has nothing unsupported', () => {
  assert.deepEqual(verifyDraft('I am applying for the frontend internship.', facts), []);
});

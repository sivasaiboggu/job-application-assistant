const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { FactSheet } = compile()('facts');
const { evaluateEligibility } = compile()('eligibility');

const source = { kind: 'user', reference: 'chat', at: '2026-11-19' };
const posting = {
  url: 'https://example.com/jobs/1',
  company: 'Acme',
  title: 'Software Intern',
  capturedAt: '2026-11-19T00:00:00Z',
  requirements: [
    { key: 'graduation', description: 'graduating 2028', expected: 'may 2028' },
    { key: 'skills', description: 'React and TypeScript', expected: 'react, typescript' },
    { key: 'work_authorization_india', description: 'authorized to work in India' },
    { key: 'stipend', description: 'stipend offered' },
  ],
};

test('pass, fail and unknown are all first-class outcomes', () => {
  const sheet = new FactSheet();
  sheet.add('graduation', 'May 2028', source);
  sheet.add('skills', 'React, TypeScript, Node.js', source);
  sheet.add('work_authorization_india', 'yes - citizen, no sponsorship needed', source);
  const checks = evaluateEligibility(posting, sheet);
  assert.deepEqual(checks.map((check) => check.status), ['pass', 'pass', 'pass', 'unknown']);
  assert.match(checks[3].reason, /no fact on record/);
});

test('a mismatch fails with both values in the reason', () => {
  const sheet = new FactSheet();
  sheet.add('graduation', 'June 2028', source);
  const checks = evaluateEligibility({ ...posting, requirements: [posting.requirements[0]] }, sheet);
  assert.equal(checks[0].status, 'fail');
  assert.match(checks[0].reason, /expected "may 2028", on record "June 2028"/);
});

test('a contested fact yields unknown, never a guess', () => {
  const sheet = new FactSheet();
  sheet.add('graduation', 'May 2028', source);
  sheet.add('graduation', 'June 2028', { ...source, at: '2026-10-22' });
  const checks = evaluateEligibility({ ...posting, requirements: [posting.requirements[0]] }, sheet);
  assert.equal(checks[0].status, 'unknown');
  assert.match(checks[0].reason, /conflicting values/);
});

function skillStatus(expected, actual) {
  const sheet = new FactSheet();
  sheet.add('skills', actual, source);
  const p = { ...posting, requirements: [{ key: 'skills', description: 'skills', expected }] };
  return evaluateEligibility(p, sheet)[0].status;
}

test('expected skill terms match whole terms, not substrings of other words', () => {
  assert.equal(skillStatus('java, sql', 'JavaScript, SQL'), 'fail');
  assert.equal(skillStatus('c, python', 'CSS, Python'), 'fail');
  assert.equal(skillStatus('react, node', 'React, Node.js'), 'pass');
});

test('terms with symbols match exactly and stay distinct from their prefixes', () => {
  assert.equal(skillStatus('c++, python', 'C++, Python'), 'pass');
  assert.equal(skillStatus('c, python', 'C++, Python'), 'fail');
  assert.equal(skillStatus('c#, sql', 'C#, SQL'), 'pass');
  assert.equal(skillStatus('node.js, sql', 'Node.js, SQL'), 'pass');
});

test('a term still matches at the start, end and next to punctuation', () => {
  assert.equal(skillStatus('react, sql', 'react; sql.'), 'pass');
  assert.equal(skillStatus('react, sql', '(React) and (SQL)'), 'pass');
});

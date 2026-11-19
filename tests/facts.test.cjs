const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { FactSheet } = compile()('facts');

const source = (at) => ({ kind: 'user', reference: 'chat', at });

test('a single live value resolves with its source', () => {
  const sheet = new FactSheet();
  sheet.add('name', 'Boggu Siva Sai', source('2026-11-17'));
  const fact = sheet.resolve('name');
  assert.equal(fact.value, 'Boggu Siva Sai');
  assert.equal(fact.source.kind, 'user');
});

test('conflicting live values do not resolve and are reported', () => {
  const sheet = new FactSheet();
  sheet.add('cgpa', '8.0', source('2026-11-03'));
  sheet.add('cgpa', '7.73', source('2026-11-11'));
  assert.equal(sheet.resolve('cgpa'), undefined);
  const conflicts = sheet.conflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, 'cgpa');
  assert.deepEqual(conflicts[0].values.map((entry) => entry.value).sort(), ['7.73', '8.0']);
});

test('superseding retires the old value and resolves the new one', () => {
  const sheet = new FactSheet();
  sheet.add('stipend_floor', '40000', source('2026-11-02'));
  sheet.supersede('stipend_floor', '40000', '30000', source('2026-11-08'));
  assert.equal(sheet.resolve('stipend_floor').value, '30000');
  assert.deepEqual(sheet.conflicts(), []);
});

test('unanswered lists keys that are missing or contested', () => {
  const sheet = new FactSheet();
  sheet.add('location', 'Hyderabad', source('2026-10-27'));
  sheet.add('cgpa', '8.0', source('2026-11-03'));
  sheet.add('cgpa', '7.73', source('2026-11-11'));
  assert.deepEqual(sheet.unanswered(['location', 'cgpa', 'jee_rank']), ['cgpa', 'jee_rank']);
});

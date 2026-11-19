const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { FactSheet } = compile()('facts');

// All fixtures in this suite are synthetic.
const source = (at) => ({ kind: 'user', reference: 'synthetic', at });

test('a single live value resolves with its source', () => {
  const sheet = new FactSheet();
  sheet.add('name', 'Aarav Sharma', source('2026-01-10'));
  const fact = sheet.resolve('name');
  assert.equal(fact.value, 'Aarav Sharma');
  assert.equal(fact.source.kind, 'user');
});

test('conflicting live values do not resolve and are reported', () => {
  const sheet = new FactSheet();
  sheet.add('grade', '8.5', source('2026-01-03'));
  sheet.add('grade', '8.1', source('2026-01-11'));
  assert.equal(sheet.resolve('grade'), undefined);
  const conflicts = sheet.conflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].key, 'grade');
  assert.deepEqual(conflicts[0].values.map((entry) => entry.value).sort(), ['8.1', '8.5']);
});

test('superseding retires the old value and resolves the new one', () => {
  const sheet = new FactSheet();
  sheet.add('weekly_hours', '20', source('2026-01-02'));
  sheet.supersede('weekly_hours', '20', '40', source('2026-01-08'));
  assert.equal(sheet.resolve('weekly_hours').value, '40');
  assert.deepEqual(sheet.conflicts(), []);
});

test('unanswered lists keys that are missing or contested', () => {
  const sheet = new FactSheet();
  sheet.add('location', 'Pune', source('2026-01-05'));
  sheet.add('grade', '8.5', source('2026-01-03'));
  sheet.add('grade', '8.1', source('2026-01-11'));
  assert.deepEqual(sheet.unanswered(['location', 'grade', 'entrance_rank']), ['grade', 'entrance_rank']);
});

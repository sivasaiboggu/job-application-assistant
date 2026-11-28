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

test('re-adding the same value is not a conflict; the newest source wins', () => {
  const sheet = new FactSheet();
  sheet.add('location', 'Pune', source('2026-01-05'));
  sheet.add('location', 'Pune', source('2026-02-11'));
  const fact = sheet.resolve('location');
  assert.equal(fact.value, 'Pune');
  assert.equal(fact.source.at, '2026-02-11');
  assert.deepEqual(sheet.conflicts(), []);
});

test('a supersede naming the wrong old value retires nothing and stays contested', () => {
  const sheet = new FactSheet();
  sheet.add('grade', '8.5', source('2026-01-03'));
  sheet.supersede('grade', '9.0', '8.7', source('2026-01-11'));
  assert.equal(sheet.resolve('grade'), undefined);
  assert.deepEqual(sheet.conflicts()[0].values.map((entry) => entry.value).sort(), ['8.5', '8.7']);
});

test('superseding retires every live copy of the old value', () => {
  const sheet = new FactSheet();
  sheet.add('weekly_hours', '20', source('2026-01-02'));
  sheet.add('weekly_hours', '20', source('2026-01-04'));
  sheet.supersede('weekly_hours', '20', '40', source('2026-01-08'));
  assert.equal(sheet.resolve('weekly_hours').value, '40');
  assert.deepEqual(sheet.live('weekly_hours').map((fact) => fact.value), ['40']);
});

test('conflicts report the source of every contested value', () => {
  const sheet = new FactSheet();
  sheet.add('grade', '8.5', source('2026-01-03'));
  sheet.add('grade', '8.1', source('2026-01-11'));
  const [conflict] = sheet.conflicts();
  assert.equal(conflict.key, 'grade');
  const byValue = Object.fromEntries(conflict.values.map((entry) => [entry.value, entry.source.at]));
  assert.equal(byValue['8.5'], '2026-01-03');
  assert.equal(byValue['8.1'], '2026-01-11');
});

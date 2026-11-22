const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const dir = mkdtempSync(path.join(tmpdir(), 'jaa-cli-'));
process.on('exit', () => rmSync(dir, { recursive: true, force: true }));

// Compile once, then drive the compiled CLI exactly as a user would.
const compile = require('./compile.cjs');
const tsc = require.resolve('typescript/bin/tsc');
const out = mkdtempSync(path.join(tmpdir(), 'jaa-cli-build-'));
process.on('exit', () => rmSync(out, { recursive: true, force: true }));
compile();
execFileSync(process.execPath, [tsc, '--module', 'commonjs', '--target', 'es2022', '--skipLibCheck',
  '--outDir', out, ...['model', 'facts', 'dedupe', 'eligibility', 'store', 'drafting', 'approval', 'intake', 'tracker', 'cli']
    .map((name) => path.join(__dirname, '..', 'src', `${name}.ts`))]);
const cli = path.join(out, 'cli.js');

const storeFile = path.join(dir, 'data.json');
const factsFile = path.join(dir, 'facts.json');
const postingFile = path.join(dir, 'posting.json');
writeFileSync(factsFile, JSON.stringify([
  { key: 'name', value: 'Aarav Sharma', source: { kind: 'user', reference: 'chat', at: '2026-11-17' } },
  { key: 'graduation', value: 'May 2028', source: { kind: 'user', reference: 'chat', at: '2026-10-23' } },
]));
writeFileSync(postingFile, JSON.stringify({
  url: 'https://example.com/jobs/9?utm_source=share',
  company: 'Acme',
  title: 'AI Intern',
  requirements: [{ key: 'graduation', description: 'graduating 2028', expected: 'may 2028' }],
  capturedAt: '2026-11-19T00:00:00Z',
}));

function run(...args) {
  return execFileSync(process.execPath, [cli, ...args], {
    env: { ...process.env, JAA_STORE: storeFile, JAA_FACTS: factsFile },
    encoding: 'utf8',
  });
}

function runFailed(...args) {
  try {
    run(...args);
    return null;
  } catch (error) {
    return error;
  }
}

test('end to end: register, check, draft, gate blocks export, approve, export', () => {
  const added = run('add-posting', postingFile);
  const appId = /registered (\S+)/.exec(added)[1];

  const again = run('add-posting', postingFile);
  assert.match(again, new RegExp(`duplicate of ${appId}`));

  const checked = run('check', appId);
  assert.match(checked, /PASS +graduating 2028/);
  assert.match(checked, /status: checked/);

  const drafted = run('draft', appId);
  const draftId = /draft (\S+) awaiting approval/.exec(drafted)[1];
  assert.match(drafted, /May 2028/);

  const blocked = runFailed('export', draftId);
  assert.ok(blocked, 'export before approval must fail');
  assert.match(String(blocked.stderr), /not approved/);

  run('approve', draftId, '--by', 'Reviewer');
  const exported = run('export', draftId);
  assert.match(exported, /Application: AI Intern at Acme/);

  const listed = run('list');
  assert.match(listed, new RegExp(`${appId} +exported`));
});

test('add-posting-text registers a labelled text posting and refuses an incomplete one', () => {
  const good = path.join(dir, 'posting.txt');
  writeFileSync(good, 'Company: Textco\nTitle: Backend Intern\nURL: https://textco.test/jobs/1\nRequires: graduation | graduating 2028 | may 2028\n');
  assert.match(run('add-posting-text', good), /registered \S+/);

  const bad = path.join(dir, 'bad.txt');
  writeFileSync(bad, 'Company: Textco\n');
  const failure = runFailed('add-posting-text', bad);
  assert.ok(failure, 'incomplete posting must exit non-zero');
  assert.match(String(failure.stderr), /cannot register: missing title/);
  assert.match(String(failure.stderr), /cannot register: missing url/);
});

test('history shows the application events and list orders by deadline', () => {
  const lines = run('list').trim().split('\n');
  assert.match(lines.at(-1), / exported /, 'closed applications are listed last');
  const appId = lines.at(-1).split(' ')[0];
  assert.match(run('history', appId), /discovered[\s\S]*exported/);
  assert.ok(runFailed('history', 'app-missing'), 'unknown application must fail');
});

test('export-tracker writes csv and md files and refuses a bad format', () => {
  const { readFileSync } = require('node:fs');
  const csvFile = path.join(dir, 'tracker.csv');
  const mdFile = path.join(dir, 'tracker.md');
  assert.match(run('export-tracker', 'csv', csvFile), /wrote \d+ applications/);
  run('export-tracker', 'md', mdFile);
  assert.match(readFileSync(csvFile, 'utf8'), /^id,status,deadline,/);
  assert.match(readFileSync(mdFile, 'utf8'), /^\| id \| status/);
  assert.ok(runFailed('export-tracker', 'xlsx', csvFile));
});

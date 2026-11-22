const { test } = require('node:test');
const assert = require('node:assert/strict');
const compile = require('./compile.cjs');
const { sortForTracker, formatListLine, formatHistory } = compile()('tracker');
const { parsePostingText } = compile()('intake');

function app(id, status, deadline, createdAt) {
  const posting = { url: `https://example.test/${id}`, company: id, title: 'Intern', requirements: [], capturedAt: createdAt };
  if (deadline) posting.deadline = deadline;
  return { id, dedupeKey: id, posting, status, checks: [], draftIds: [], history: [{ at: createdAt, event: 'discovered' }], createdAt, updatedAt: createdAt };
}

test('open applications sort by soonest deadline, undated next, closed last', () => {
  const list = [
    app('closed-early', 'exported', '2026-11-01', '2026-11-01T00:00:00Z'),
    app('undated-old', 'checked', undefined, '2026-11-02T00:00:00Z'),
    app('late', 'drafted', '2026-12-30', '2026-11-03T00:00:00Z'),
    app('soon', 'discovered', '2026-11-25', '2026-11-04T00:00:00Z'),
    app('undated-new', 'discovered', undefined, '2026-11-05T00:00:00Z'),
  ];
  assert.deepEqual(sortForTracker(list).map((r) => r.id), ['soon', 'late', 'undated-old', 'undated-new', 'closed-early']);
  assert.equal(list[0].id, 'closed-early', 'input array is not mutated');
});

test('equal deadlines fall back to oldest first', () => {
  const list = [app('b', 'checked', '2026-12-01', '2026-11-03T00:00:00Z'), app('a', 'checked', '2026-12-01', '2026-11-02T00:00:00Z')];
  assert.deepEqual(sortForTracker(list).map((r) => r.id), ['a', 'b']);
});

test('list line shows the deadline, or says there is none', () => {
  assert.match(formatListLine(app('x', 'checked', '2026-12-01', 't')), /2026-12-01 +x - Intern/);
  assert.match(formatListLine(app('x', 'checked', undefined, 't')), /no deadline/);
});

test('history lists each event in order with its detail', () => {
  const record = app('x', 'exported', undefined, '2026-11-01T00:00:00Z');
  record.history.push({ at: '2026-11-02T00:00:00Z', event: 'exported', detail: 'draft-1' });
  const lines = formatHistory(record).split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /discovered/);
  assert.match(lines[2], /exported {2}draft-1/);
});

test('intake reads a stated deadline and rejects an impossible one', () => {
  const base = 'Company: A\nTitle: B\nURL: https://example.test/1\n';
  assert.equal(parsePostingText(base + 'Deadline: 2026-12-05', 't').posting.deadline, '2026-12-05');
  assert.equal(parsePostingText(base + 'Apply by: 2026-12-05', 't').posting.deadline, '2026-12-05');
  assert.equal(parsePostingText(base, 't').posting.deadline, undefined);
  for (const bad of ['2026-02-30', 'next Friday', '05/12/2026']) {
    const r = parsePostingText(base + `Deadline: ${bad}`, 't');
    assert.equal(r.ok, false);
    assert.match(r.errors[0], /deadline/);
  }
});

const { trackerCsv, trackerMarkdown } = compile()('tracker');

test('csv has a header, follows tracker order and quotes awkward cells', () => {
  const a = app('a', 'checked', '2026-12-01', '2026-11-02T00:00:00Z');
  a.posting.title = 'Intern, "Platform"';
  const b = app('b', 'checked', '2026-11-20', '2026-11-03T00:00:00Z');
  const lines = trackerCsv([a, b]).trimEnd().split('\n');
  assert.equal(lines[0], 'id,status,deadline,company,title,location,url,updated');
  assert.match(lines[1], /^b,checked,2026-11-20,/);
  assert.match(lines[2], /"Intern, ""Platform"""/);
});

test('csv neutralises cells that a spreadsheet would run as formulas', () => {
  const a = app('a', 'checked', undefined, 't');
  a.posting.company = '=HYPERLINK("http://x.test")';
  a.posting.title = '+1';
  const csv = trackerCsv([a]);
  assert.ok(!/(^|,)=/m.test(csv));
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /,'\+1,/);
});

test('markdown table escapes pipes and keeps one row per application', () => {
  const a = app('a', 'checked', '2026-12-01', 't');
  a.posting.title = 'Intern | Data\nTeam';
  const lines = trackerMarkdown([a, app('b', 'exported', undefined, 't')]).trimEnd().split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines[2], /Intern \\\| Data Team/);
  assert.match(lines[3], /^\| b \| exported/);
});

test('an empty tracker still exports just the header', () => {
  assert.equal(trackerCsv([]), 'id,status,deadline,company,title,location,url,updated\n');
});

#!/usr/bin/env node
import { parsePostingText } from './intake';
import { sortForTracker, formatListLine, formatHistory, trackerCsv, trackerMarkdown } from './tracker';
import { readFileSync, writeFileSync } from 'node:fs';
import { Store } from './store';
import { FactSheet } from './facts';
import { evaluateEligibility } from './eligibility';
import { dedupeKeyFor } from './dedupe';
import { TemplateProvider, buildDraft } from './drafting';
import { approveDraft, assertExportable } from './approval';
import { ApplicationRecord, DraftKind, FactSource, JobPosting } from './model';

const storePath = process.env.JAA_STORE ?? 'data.json';
const factsPath = process.env.JAA_FACTS ?? 'facts.json';

function loadSheet(): FactSheet {
  const sheet = new FactSheet();
  try {
    const rows = JSON.parse(readFileSync(factsPath, 'utf8')) as { key: string; value: string; source: FactSource }[];
    for (const row of rows) sheet.add(row.key, row.value, row.source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  return sheet;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function register(store: Store, posting: JobPosting): ApplicationRecord {
  const at = new Date().toISOString();
  const { record, duplicate } = store.addApplication({
    id: newId('app'),
    dedupeKey: dedupeKeyFor(posting),
    posting,
    status: 'discovered',
    checks: [],
    draftIds: [],
    history: [{ at, event: 'discovered' }],
    createdAt: at,
    updatedAt: at,
  });
  console.log(duplicate ? `duplicate of ${record.id} - not a new application` : `registered ${record.id}`);
  return record;
}

const [, , command, ...args] = process.argv;
const store = new Store(storePath);
const sheet = loadSheet();

switch (command) {
  case 'add-posting': {
    const posting = JSON.parse(readFileSync(args[0]!, 'utf8')) as JobPosting;
    register(store, posting);
    break;
  }
  case 'add-posting-text': {
    const parsed = parsePostingText(readFileSync(args[0]!, 'utf8'), new Date().toISOString());
    if (parsed.ok === false) {
      for (const error of parsed.errors) console.error(`cannot register: ${error}`);
      process.exitCode = 1;
      break;
    }
    register(store, parsed.posting);
    break;
  }
  case 'check': {
    const record = store.getApplication(args[0]!);
    if (!record) throw new Error(`unknown application ${args[0]}`);
    const checks = evaluateEligibility(record.posting, sheet);
    record.checks = checks;
    record.status = checks.some((check) => check.status === 'fail') ? 'ineligible' : 'checked';
    record.updatedAt = new Date().toISOString();
    record.history.push({ at: record.updatedAt, event: 'eligibility_checked' });
    store.updateApplication(record);
    for (const check of checks) console.log(`${check.status.toUpperCase().padEnd(7)} ${check.requirement.description} - ${check.reason}`);
    console.log(`status: ${record.status}`);
    break;
  }
  case 'draft': {
    const record = store.getApplication(args[0]!);
    if (!record) throw new Error(`unknown application ${args[0]}`);
    const kind = (args[1] ?? 'cover_note') as DraftKind;
    const draft = buildDraft(new TemplateProvider(), { application: record, kind, sheet, at: new Date().toISOString() }, newId('draft'));
    store.addDraft(draft);
    record.draftIds.push(draft.id);
    record.status = 'awaiting_approval';
    record.updatedAt = draft.createdAt;
    record.history.push({ at: draft.createdAt, event: 'drafted', detail: draft.id });
    store.updateApplication(record);
    console.log(`draft ${draft.id} awaiting approval`);
    if (draft.unresolvedClaims.length > 0) console.log(`UNVERIFIED: ${draft.unresolvedClaims.join('; ')}`);
    console.log(`\n${draft.body}`);
    break;
  }
  case 'approve': {
    const draft = store.getDraft(args[0]!);
    if (!draft) throw new Error(`unknown draft ${args[0]}`);
    const byIndex = args.indexOf('--by');
    const approver = byIndex === -1 ? '' : args[byIndex + 1]!;
    const record = store.getApplication(draft.applicationId)!;
    approveDraft(draft, record, approver, new Date().toISOString());
    store.updateDraft(draft);
    store.updateApplication(record);
    console.log(`draft ${draft.id} approved by ${approver}`);
    break;
  }
  case 'export': {
    const draft = store.getDraft(args[0]!);
    if (!draft) throw new Error(`unknown draft ${args[0]}`);
    assertExportable(draft);
    const record = store.getApplication(draft.applicationId)!;
    record.status = 'exported';
    record.updatedAt = new Date().toISOString();
    record.history.push({ at: record.updatedAt, event: 'exported', detail: draft.id });
    store.updateApplication(record);
    console.log(draft.body);
    break;
  }
  case 'list': {
    for (const record of sortForTracker(store.applications())) console.log(formatListLine(record));
    break;
  }
  case 'export-tracker': {
    const format = args[0];
    const file = args[1];
    if ((format !== 'csv' && format !== 'md') || !file) throw new Error('usage: export-tracker <csv|md> <file>');
    writeFileSync(file, format === 'csv' ? trackerCsv(store.applications()) : trackerMarkdown(store.applications()));
    console.log(`wrote ${store.applications().length} applications to ${file}`);
    break;
  }
  case 'history': {
    const record = store.getApplication(args[0]!);
    if (!record) throw new Error(`unknown application ${args[0]}`);
    console.log(formatHistory(record));
    break;
  }
  case 'conflicts': {
    const conflicts = sheet.conflicts();
    if (conflicts.length === 0) console.log('no conflicting facts');
    for (const conflict of conflicts) {
      console.log(`${conflict.key}:`);
      for (const entry of conflict.values) console.log(`  "${entry.value}" (${entry.source.kind} ${entry.source.reference}, ${entry.source.at})`);
    }
    break;
  }
  default:
    console.log('commands: add-posting <file.json> | add-posting-text <file.txt> | check <appId> | draft <appId> [kind] | approve <draftId> --by <name> | export <draftId> | list | history <appId> | export-tracker <csv|md> <file> | conflicts');
    process.exitCode = command ? 1 : 0;
}

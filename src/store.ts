import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { ApplicationRecord, Draft } from './model';

type StoreData = { applications: ApplicationRecord[]; drafts: Draft[] };

// JSON file store with atomic writes. Local-first by design: no external
// service ever sees this data.
export class Store {
  private data: StoreData;

  constructor(private filePath: string) {
    this.data = existsSync(filePath)
      ? (JSON.parse(readFileSync(filePath, 'utf8')) as StoreData)
      : { applications: [], drafts: [] };
  }

  private save(): void {
    const tmp = `${this.filePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    renameSync(tmp, this.filePath);
  }

  addApplication(record: ApplicationRecord): { record: ApplicationRecord; duplicate: boolean } {
    const existing = this.data.applications.find(
      (entry) => entry.dedupeKey === record.dedupeKey && entry.status !== 'withdrawn'
    );
    if (existing) {
      existing.history.push({ at: record.createdAt, event: 'duplicate_seen', detail: record.posting.url });
      existing.updatedAt = record.createdAt;
      this.save();
      return { record: existing, duplicate: true };
    }
    this.data.applications.push(record);
    this.save();
    return { record, duplicate: false };
  }

  getApplication(id: string): ApplicationRecord | undefined {
    return this.data.applications.find((entry) => entry.id === id);
  }

  updateApplication(record: ApplicationRecord): void {
    const index = this.data.applications.findIndex((entry) => entry.id === record.id);
    if (index === -1) throw new Error(`unknown application ${record.id}`);
    this.data.applications[index] = record;
    this.save();
  }

  applications(): ApplicationRecord[] {
    return [...this.data.applications];
  }

  addDraft(draft: Draft): void {
    this.data.drafts.push(draft);
    this.save();
  }

  getDraft(id: string): Draft | undefined {
    return this.data.drafts.find((entry) => entry.id === id);
  }

  updateDraft(draft: Draft): void {
    const index = this.data.drafts.findIndex((entry) => entry.id === draft.id);
    if (index === -1) throw new Error(`unknown draft ${draft.id}`);
    this.data.drafts[index] = draft;
    this.save();
  }

  draftsFor(applicationId: string): Draft[] {
    return this.data.drafts.filter((entry) => entry.applicationId === applicationId);
  }
}

import { ApplicationRecord } from './model';

const CLOSED = new Set(['exported', 'skipped_duplicate', 'ineligible', 'withdrawn']);

// Open applications first, soonest deadline first; applications with no stated
// deadline come after those that have one, then oldest first. Closed ones
// (exported, ineligible, withdrawn, duplicate) go last. Ties keep a stable order.
export function sortForTracker(records: ApplicationRecord[]): ApplicationRecord[] {
  const rank = (record: ApplicationRecord) => (CLOSED.has(record.status) ? 2 : record.posting.deadline ? 0 : 1);
  return [...records].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    if (rank(a) === 0) {
      const byDeadline = a.posting.deadline!.localeCompare(b.posting.deadline!);
      if (byDeadline) return byDeadline;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function formatListLine(record: ApplicationRecord): string {
  const deadline = record.posting.deadline ?? 'no deadline';
  return `${record.id}  ${record.status.padEnd(18)} ${deadline.padEnd(11)} ${record.posting.company} - ${record.posting.title}`;
}

export function formatHistory(record: ApplicationRecord): string {
  const lines = [`${record.posting.company} - ${record.posting.title} (${record.status})`];
  for (const entry of record.history) {
    lines.push(`  ${entry.at}  ${entry.event}${entry.detail ? `  ${entry.detail}` : ''}`);
  }
  return lines.join('\n');
}

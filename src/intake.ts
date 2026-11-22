import { JobPosting, Requirement } from './model';

export type IntakeResult =
  | { ok: true; posting: JobPosting }
  | { ok: false; errors: string[] };

const FIELD_LABELS: Record<string, 'company' | 'title' | 'url' | 'location' | 'workArrangement' | 'deadline'> = {
  company: 'company',
  employer: 'company',
  title: 'title',
  role: 'title',
  position: 'title',
  url: 'url',
  link: 'url',
  location: 'location',
  'work arrangement': 'workArrangement',
  mode: 'workArrangement',
  deadline: 'deadline',
  'apply by': 'deadline',
};

// Turns a small labelled text block into a JobPosting. It reads only what the
// text states: header lines ("Company: Acme") and requirement lines
// ("Requires: key | description | expected"). Nothing is guessed: a missing
// company, title or url is an error, and a requirement without a key is
// rejected rather than invented.
export function parsePostingText(text: string, capturedAt: string): IntakeResult {
  const found: Partial<Record<'company' | 'title' | 'url' | 'location' | 'workArrangement' | 'deadline', string>> = {};
  const requirements: Requirement[] = [];
  const errors: string[] = [];

  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const label = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (label === 'requires' || label === 'requirement') {
      const [key, description, expected] = value.split('|').map((part) => part.trim());
      if (!key || !description) {
        errors.push(`line ${index + 1}: a requirement needs "key | description" (optional "| expected")`);
        continue;
      }
      requirements.push(expected ? { key, description, expected } : { key, description });
      continue;
    }

    const field = FIELD_LABELS[label];
    if (!field || !value) continue;
    if (found[field] !== undefined && found[field] !== value) {
      errors.push(`line ${index + 1}: "${label}" is given twice with different values`);
      continue;
    }
    found[field] = value;
  }

  for (const required of ['company', 'title', 'url'] as const) {
    if (!found[required]) errors.push(`missing ${required}`);
  }
  if (found.url && !/^https?:\/\/\S+$/i.test(found.url)) errors.push(`url is not an http(s) link: ${found.url}`);
  if (found.deadline && !isRealDate(found.deadline)) errors.push(`deadline must be a real date as YYYY-MM-DD: ${found.deadline}`);
  if (errors.length) return { ok: false, errors };

  const posting: JobPosting = {
    url: found.url!,
    company: found.company!,
    title: found.title!,
    requirements,
    capturedAt,
  };
  if (found.location) posting.location = found.location;
  if (found.workArrangement) posting.workArrangement = found.workArrangement;
  if (found.deadline) posting.deadline = found.deadline;
  return { ok: true, posting };
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

import { FactSheet } from './facts';
import { ApplicationRecord, Draft, DraftKind } from './model';

export type DraftRequest = {
  application: ApplicationRecord;
  kind: DraftKind;
  sheet: FactSheet;
  at: string;
};

export interface DraftingProvider {
  draft(request: DraftRequest): { body: string; factsUsed: { key: string; value: string }[] };
}

// Deterministic provider: assembles text only from sourced facts, so nothing
// it writes can invent a credential. An LLM provider can be added behind the
// same interface; its output must still pass verifyDraft before approval.
export class TemplateProvider implements DraftingProvider {
  draft(request: DraftRequest): { body: string; factsUsed: { key: string; value: string }[] } {
    const { application, sheet } = request;
    const wanted = ['name', 'degree', 'graduation', 'skills', 'experience', 'location'];
    const factsUsed: { key: string; value: string }[] = [];
    for (const key of wanted) {
      const fact = sheet.resolve(key);
      if (fact) factsUsed.push({ key: fact.key, value: fact.value });
    }
    const lines = [
      `Application: ${application.posting.title} at ${application.posting.company}`,
      '',
      ...factsUsed.map((fact) => `- ${fact.key}: ${fact.value}`),
    ];
    return { body: lines.join('\n'), factsUsed };
  }
}

const CLAIM_PATTERN = /(\d+(?:\.\d+)?)\s*(years?|yrs?|months?|lpa|cgpa|percent|%|k\b)/gi;

// True when the figure appears as a whole number in the text. A plain
// substring test would let "2" be supported by "2027" or "7.7" by "7.73".
function containsWholeNumber(text: string, figure: string): boolean {
  const escaped = figure.replace(/\./g, '\\.');
  return new RegExp(`(?<![0-9.])${escaped}(?![0-9]|\\.[0-9])`).test(text);
}

// Scans a draft for quantitative claims that no sourced fact supports. A
// draft with unsupported claims can still be saved for review, but the
// approval gate refuses it until each claim is resolved.
export function verifyDraft(body: string, factsUsed: { key: string; value: string }[]): string[] {
  const haystack = factsUsed.map((fact) => fact.value.toLowerCase()).join('\n');
  const unsupported: string[] = [];
  for (const match of body.matchAll(CLAIM_PATTERN)) {
    const claim = `${match[1]} ${match[2]}`.toLowerCase();
    if (!containsWholeNumber(haystack, match[1]!)) {
      unsupported.push(`unsupported claim "${claim}" - no sourced fact carries this figure`);
    }
  }
  const leftover = body.match(/\{[a-z_]+\}/gi);
  if (leftover) {
    for (const placeholder of leftover) unsupported.push(`unresolved placeholder ${placeholder}`);
  }
  return [...new Set(unsupported)];
}

export function buildDraft(provider: DraftingProvider, request: DraftRequest, id: string): Draft {
  const { body, factsUsed } = provider.draft(request);
  return {
    id,
    applicationId: request.application.id,
    kind: request.kind,
    body,
    factsUsed,
    unresolvedClaims: verifyDraft(body, factsUsed),
    createdAt: request.at,
  };
}

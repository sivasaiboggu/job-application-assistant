import { FactSheet } from './facts';
import { EligibilityCheck, JobPosting } from './model';

// Whole-term containment: "java" must not match "javascript", nor "c" match
// "css". Characters used inside skill names (+ # .) count as part of a term.
function containsWholeTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9+#])${escaped}(?![a-z0-9+#])`).test(text);
}

function matches(expected: string, actual: string): boolean {
  const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
  const left = norm(expected);
  const right = norm(actual);
  if (left === right) return true;
  // An expected token list ("react, typescript") passes when every expected
  // token appears in the actual value.
  const expectedTokens = left.split(/[,;/]+/).map((token) => token.trim()).filter(Boolean);
  return expectedTokens.length > 1 && expectedTokens.every((token) => containsWholeTerm(right, token));
}

// Every requirement resolves to pass, fail, or unknown. Unknown is a first
// class result: a missing or contested fact is flagged, never assumed.
export function evaluateEligibility(posting: JobPosting, sheet: FactSheet): EligibilityCheck[] {
  return posting.requirements.map((requirement) => {
    const fact = sheet.resolve(requirement.key);
    if (!fact) {
      const contested = sheet.live(requirement.key).length > 0;
      return {
        requirement,
        status: 'unknown',
        reason: contested
          ? `conflicting values on record for "${requirement.key}" - resolve before answering`
          : `no fact on record for "${requirement.key}"`,
      };
    }
    if (requirement.expected === undefined) {
      return {
        requirement,
        status: 'pass',
        factKey: fact.key,
        reason: `on record: "${fact.value}" (${fact.source.kind}, ${fact.source.at})`,
      };
    }
    const ok = matches(requirement.expected, fact.value);
    return {
      requirement,
      status: ok ? 'pass' : 'fail',
      factKey: fact.key,
      reason: ok
        ? `matches: expected "${requirement.expected}", on record "${fact.value}"`
        : `mismatch: expected "${requirement.expected}", on record "${fact.value}" (${fact.source.kind}, ${fact.source.at})`,
    };
  });
}

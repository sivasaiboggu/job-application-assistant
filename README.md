# Job Application Assistant

Local-first helper for managing internship/job applications. It tracks postings, checks eligibility against a sourced fact sheet, blocks duplicates, and drafts application text that a person must approve before it leaves the outbox. It has no send capability: exporting an approved draft for the person to submit is the final step.

Principles:

- Every candidate fact carries its source (who said it, where, when). Conflicting values (for example a CGPA given two ways) are flagged, and the contested value is withheld from drafts until resolved.
- Eligibility checks return pass, fail, or unknown per requirement. Missing or contested facts become explicit unanswered items, never assumptions.
- Duplicate postings are recognized across tracking links by company, title, and canonical URL.
- Drafts are assembled from sourced facts only. A verifier flags any quantitative claim no fact supports, and the approval gate refuses drafts with unresolved claims.
- No external service is contacted. No credentials. No auto-apply.

## Layout

- `src/model.ts` - shared types
- `src/facts.ts` - sourced fact sheet with conflict detection
- `src/eligibility.ts` - requirement checks with pass/fail/unknown
- `src/dedupe.ts` - URL canonicalization and duplicate keys
- `src/store.ts` - atomic JSON file store
- `src/drafting.ts` - draft providers plus the unsupported-claim verifier
- `src/approval.ts` - the approval gate
- `tests/` - node:test suite (TypeScript compiled on the fly, no build artifacts)

## Develop

```
npm install
npm test
npm run typecheck
```

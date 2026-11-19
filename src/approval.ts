import { ApplicationRecord, Draft } from './model';

// The approval gate: nothing leaves the outbox unless a person approved the
// exact draft. There is deliberately no send function in this project at all.
export function approveDraft(draft: Draft, application: ApplicationRecord, approver: string, at: string): void {
  if (!approver.trim()) throw new Error('approver name is required');
  if (draft.unresolvedClaims.length > 0) {
    throw new Error(`draft ${draft.id} has unverified claims and cannot be approved: ${draft.unresolvedClaims.join('; ')}`);
  }
  draft.approvedBy = approver;
  draft.approvedAt = at;
  application.status = 'approved';
  application.updatedAt = at;
  application.history.push({ at, event: 'approved', detail: `draft ${draft.id} approved by ${approver}` });
}

export function assertExportable(draft: Draft): void {
  if (!draft.approvedAt || !draft.approvedBy) {
    throw new Error(`draft ${draft.id} is not approved; it cannot leave the outbox`);
  }
}

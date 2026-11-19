export type FactSource = {
  kind: 'user' | 'document' | 'form';
  reference: string;
  at: string;
};

export type Fact = {
  key: string;
  value: string;
  source: FactSource;
  supersededBy?: string;
};

export type EligibilityStatus = 'pass' | 'fail' | 'unknown';

export type Requirement = {
  key: string;
  description: string;
  expected?: string;
};

export type EligibilityCheck = {
  requirement: Requirement;
  status: EligibilityStatus;
  factKey?: string;
  reason: string;
};

export type JobPosting = {
  url: string;
  company: string;
  title: string;
  location?: string;
  workArrangement?: string;
  requirements: Requirement[];
  capturedAt: string;
};

export type ApplicationStatus =
  | 'discovered'
  | 'checked'
  | 'drafted'
  | 'awaiting_approval'
  | 'approved'
  | 'exported'
  | 'skipped_duplicate'
  | 'ineligible'
  | 'withdrawn';

export type HistoryEntry = { at: string; event: string; detail?: string };

export type ApplicationRecord = {
  id: string;
  dedupeKey: string;
  posting: JobPosting;
  status: ApplicationStatus;
  checks: EligibilityCheck[];
  draftIds: string[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
};

export type DraftKind = 'cover_note' | 'form_answer' | 'cold_email';

export type Draft = {
  id: string;
  applicationId: string;
  kind: DraftKind;
  body: string;
  factsUsed: { key: string; value: string }[];
  unresolvedClaims: string[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
};

import { Fact, FactSource } from './model';

// A fact sheet where every value carries its source. When two live facts
// share a key with different values (for example a CGPA given two ways on
// different dates), neither is silently preferred: the conflict is reported
// and the value is withheld from drafts until someone resolves it.
export class FactSheet {
  private facts: Fact[] = [];

  add(key: string, value: string, source: FactSource): Fact {
    const fact: Fact = { key, value, source };
    this.facts.push(fact);
    return fact;
  }

  supersede(key: string, oldValue: string, newValue: string, source: FactSource): Fact {
    const next = this.add(key, newValue, source);
    for (const fact of this.facts) {
      if (fact.key === key && fact.value === oldValue && !fact.supersededBy) {
        fact.supersededBy = newValue;
      }
    }
    return next;
  }

  live(key: string): Fact[] {
    return this.facts.filter((fact) => fact.key === key && !fact.supersededBy);
  }

  // The single live value for a key, or undefined when the key is absent or
  // contested. Callers must treat undefined as "unanswered", never guess.
  resolve(key: string): Fact | undefined {
    const live = this.live(key);
    const values = new Set(live.map((fact) => fact.value));
    if (values.size === 1) return live[live.length - 1];
    return undefined;
  }

  conflicts(): { key: string; values: { value: string; source: FactSource }[] }[] {
    const keys = new Set(this.facts.map((fact) => fact.key));
    const out: { key: string; values: { value: string; source: FactSource }[] }[] = [];
    for (const key of keys) {
      const live = this.live(key);
      const values = new Set(live.map((fact) => fact.value));
      if (values.size > 1) {
        out.push({ key, values: live.map((fact) => ({ value: fact.value, source: fact.source })) });
      }
    }
    return out;
  }

  unanswered(requiredKeys: string[]): string[] {
    return requiredKeys.filter((key) => this.resolve(key) === undefined);
  }

  all(): Fact[] {
    return [...this.facts];
  }
}

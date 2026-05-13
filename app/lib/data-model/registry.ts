/**
 * In-memory implementations of ClauseLibrary and JurisdictionRegistry.
 *
 * Trivial for PoC scale. The interfaces stay the same when this is replaced
 * by a database-backed library (counsel review workflow) later.
 */
import type { Clause, ClauseLibrary, ClauseTopic } from './clauses';
import { FIN_CLAUSES } from './clauses/fin';
import { USA_CLAUSES } from './clauses/usa';
import { DEU_CLAUSES } from './clauses/deu';
import type { DocumentType, ISOCountry } from './employment-record';
import type { JurisdictionRegistry, JurisdictionRule } from './jurisdiction';
import { FIN_RULES } from './jurisdictions/fin';
import { USA_RULES } from './jurisdictions/usa';
import { DEU_RULES } from './jurisdictions/deu';

/* ── Clause library ───────────────────────────────────────────────────── */

export class InMemoryClauseLibrary implements ClauseLibrary {
  private byId = new Map<string, Clause>();
  private byCountryDocType = new Map<string, Clause[]>();
  private byTopicIndex = new Map<ClauseTopic, Clause[]>();

  constructor(clauses: Clause[]) {
    for (const c of clauses) {
      this.byId.set(c.clauseId, c);
      for (const docType of c.applicableTo) {
        const key = `${c.jurisdiction}::${docType}`;
        const arr = this.byCountryDocType.get(key) ?? [];
        arr.push(c);
        this.byCountryDocType.set(key, arr);
      }
      const topicArr = this.byTopicIndex.get(c.topic) ?? [];
      topicArr.push(c);
      this.byTopicIndex.set(c.topic, topicArr);
    }
  }

  get(clauseId: string): Clause | null {
    return this.byId.get(clauseId) ?? null;
  }

  list(jurisdiction: ISOCountry, docType: DocumentType): Clause[] {
    return this.byCountryDocType.get(`${jurisdiction}::${docType}`) ?? [];
  }

  byTopic(topic: ClauseTopic): Clause[] {
    return this.byTopicIndex.get(topic) ?? [];
  }
}

/* ── Jurisdiction registry ────────────────────────────────────────────── */

export class InMemoryJurisdictionRegistry implements JurisdictionRegistry {
  private byKey = new Map<string, JurisdictionRule>();

  constructor(rules: JurisdictionRule[]) {
    for (const r of rules) {
      this.byKey.set(`${r.country}::${r.docType}`, r);
    }
  }

  get(country: ISOCountry, docType: DocumentType): JurisdictionRule | null {
    return this.byKey.get(`${country}::${docType}`) ?? null;
  }

  listSupported(): Array<{ country: ISOCountry; docType: DocumentType }> {
    return Array.from(this.byKey.values()).map((r) => ({ country: r.country, docType: r.docType }));
  }
}

/* ── Default singletons (loaded eagerly) ──────────────────────────────── */

/**
 * Production wiring would lazy-load jurisdiction modules. For PoC we just
 * import everything we have. New countries get added here as their
 * jurisdictions/<iso>.ts and clauses/<iso>.ts files land.
 */
export const clauseLibrary: ClauseLibrary = new InMemoryClauseLibrary([
  ...FIN_CLAUSES,
  ...USA_CLAUSES,
  ...DEU_CLAUSES,
]);

export const jurisdictionRegistry: JurisdictionRegistry = new InMemoryJurisdictionRegistry([
  ...FIN_RULES,
  ...USA_RULES,
  ...DEU_RULES,
]);

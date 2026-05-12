/**
 * Agent 1 — Template Management.
 *
 * Responsibilities (per docs/agent-architecture.md):
 *   - Pick the right template for a given (country, brand, docType, context).
 *   - Evaluate which conditional clause groups apply given routing context.
 *   - Surface "template not available" as a structured response when we
 *     don't have a slot schema for the requested combo — falling back on
 *     drive-inventory.json to recommend closest matches.
 *
 * The regulation-watch loop is deferred for PoC (see DECISIONS-PENDING #?).
 */
import {
  type CorpusTemplate,
  findTemplateBySelectors,
  loadAllTemplates,
} from '../corpus';
import {
  DOC_TYPE_TO_DRIVE_FOLDER,
  hasCorpusCoverage,
  suggestClosestMatches,
} from '../inventory';

export type SelectTemplateInput = {
  country: string;
  brand: string;
  docType: string;
  routingContext: Record<string, unknown>;
};

export type SelectTemplateResult =
  | {
      status: 'found';
      template: CorpusTemplate;
      applicableClauseGroups: string[];
    }
  | {
      status: 'unparsed_but_in_corpus';
      countryHasFolder: boolean;
      driveFileCount: number;
      message: string;
      closestMatches: {
        sameDocTypeOtherCountries: Array<{ country: string; count: number }>;
        otherDocTypesSameCountry: Array<{ docType: string; count: number }>;
      };
    }
  | {
      status: 'not_in_corpus';
      message: string;
      closestMatches: {
        sameDocTypeOtherCountries: Array<{ country: string; count: number }>;
        otherDocTypesSameCountry: Array<{ docType: string; count: number }>;
      };
    };

/**
 * Pick a template, or explain structurally why we can't.
 *
 * Three outcomes:
 *   1. found — we have a parsed slot schema for this combo.
 *   2. unparsed_but_in_corpus — Drive has files for this combo, but we
 *      haven't extracted a slot schema yet (most common case for PoC).
 *   3. not_in_corpus — neither a slot schema nor any Drive files exist.
 *      This is where the user's #1 pivot earns its keep — gap-bridging.
 */
export async function selectTemplate(input: SelectTemplateInput): Promise<SelectTemplateResult> {
  const { country, brand, docType, routingContext } = input;

  // Step 1: look for a parsed slot schema
  const template = await findTemplateBySelectors(country, brand, docType);
  if (template) {
    const applicableClauseGroups = evaluateApplicableClauseGroups(template, routingContext);
    return { status: 'found', template, applicableClauseGroups };
  }

  // Step 2: fall back to drive inventory — do we have Drive files for this combo?
  const driveFolder = DOC_TYPE_TO_DRIVE_FOLDER[docType] ?? docType;
  const inCorpus = await hasCorpusCoverage(country, driveFolder);
  const closestMatches = await suggestClosestMatches(country, driveFolder);

  if (inCorpus) {
    return {
      status: 'unparsed_but_in_corpus',
      countryHasFolder: true,
      driveFileCount: 0,
      message:
        `Drive has source files for (${country}, ${docType}) but a slot schema has not been ` +
        `extracted yet. The Template Management agent would normally extract one on demand.`,
      closestMatches,
    };
  }

  return {
    status: 'not_in_corpus',
    message:
      `No source content exists for (country=${country}, brand=${brand}, docType=${docType}). ` +
      `Specialist may want to: (a) request this template be added to the corpus, ` +
      `(b) adapt the closest match in another country, or (c) draft from scratch.`,
    closestMatches,
  };
}

/**
 * Evaluate which conditional clause groups apply given the routing context.
 * Each clause group has an `appliesWhen` condition (eq, in, all, any, not)
 * over routing keys. Returns the IDs of clause groups whose condition is true.
 */
export function evaluateApplicableClauseGroups(
  template: CorpusTemplate,
  routingContext: Record<string, unknown>
): string[] {
  return template.clauseGroups
    .filter((g) => evaluateCondition(g.appliesWhen, routingContext))
    .map((g) => g.id);
}

/** Evaluate one clause-group condition against routing context. */
function evaluateCondition(cond: unknown, ctx: Record<string, unknown>): boolean {
  if (!cond || typeof cond !== 'object') return false;
  const c = cond as Record<string, unknown>;
  if ('eq' in c && Array.isArray(c.eq) && c.eq.length === 2) {
    const [key, value] = c.eq as [string, unknown];
    return ctx[key] === value;
  }
  if ('in' in c && Array.isArray(c.in) && c.in.length === 2) {
    const [key, values] = c.in as [string, unknown[]];
    return values.includes(ctx[key]);
  }
  if ('all' in c && Array.isArray(c.all)) {
    return c.all.every((sub) => evaluateCondition(sub, ctx));
  }
  if ('any' in c && Array.isArray(c.any)) {
    return c.any.some((sub) => evaluateCondition(sub, ctx));
  }
  if ('not' in c) {
    return !evaluateCondition(c.not, ctx);
  }
  return false;
}

/** All templates we know about — for listing in UI. */
export async function listAvailableTemplates(): Promise<
  Array<{ templateId: string; country: string; brand: string; docType: string; version: string }>
> {
  const all = await loadAllTemplates();
  return all.map((t) => ({
    templateId: t.templateId,
    country: t.selectors.country,
    brand: t.selectors.brand,
    docType: t.selectors.docType,
    version: t.version,
  }));
}

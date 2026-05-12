/**
 * Corpus loader — reads slot schemas from corpus/templates/.
 *
 * The corpus directory lives outside app/ deliberately (it's project
 * content, not application code). Imports use the @corpus/* path alias
 * defined in tsconfig.json.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type CorpusTemplate = {
  $schemaVersion: 'lumina-v0.1';
  templateId: string;
  version: string;
  status: 'draft-poc-unverified' | 'legal-review' | 'approved';
  warning: string;
  selectors: {
    country: string;
    brand: string;
    docType: string;
  };
  routingAxes: Array<{
    key: string;
    type: string;
    values?: string[];
    required: boolean;
    sourceHint: 'greenhouse' | 'workday' | 'specialist' | 'derived';
    askPrompt: string;
    description: string;
  }>;
  slots: Array<{
    key: string;
    type: string;
    required: boolean;
    sensitive?: boolean;
    default?: unknown;
    enum?: ReadonlyArray<string | number>;
    validation?: Record<string, unknown>;
    requiredIf?: Record<string, unknown>;
    sourceHint: 'greenhouse' | 'workday' | 'specialist' | 'derived';
    askPrompt: string;
    intentNote?: string;
  }>;
  clauseGroups: Array<{
    id: string;
    appliesWhen: Record<string, unknown>;
    description: string;
    clauseIntents: string[];
  }>;
  baselineSections: Array<{ id: string; intentNote: string }>;
  derivation: {
    sourcedFrom: string[];
    derivedAt: string;
    derivedBy: string;
  };
};

const CORPUS_TEMPLATES_DIR = path.join(process.cwd(), '..', 'corpus', 'templates');

let _cache: CorpusTemplate[] | null = null;

/**
 * Load all *.schema.json files from corpus/templates/.
 * Cached for the lifetime of the server process — restart to pick up edits.
 */
export async function loadAllTemplates(): Promise<CorpusTemplate[]> {
  if (_cache) return _cache;
  let entries: string[];
  try {
    entries = await fs.readdir(CORPUS_TEMPLATES_DIR);
  } catch {
    _cache = [];
    return _cache;
  }
  const schemaFiles = entries.filter((f) => f.endsWith('.schema.json'));
  const templates = await Promise.all(
    schemaFiles.map(async (f) => {
      const raw = await fs.readFile(path.join(CORPUS_TEMPLATES_DIR, f), 'utf8');
      return JSON.parse(raw) as CorpusTemplate;
    })
  );
  _cache = templates;
  return _cache;
}

export async function getTemplateById(templateId: string): Promise<CorpusTemplate | null> {
  const all = await loadAllTemplates();
  return all.find((t) => t.templateId === templateId) ?? null;
}

/**
 * Find a template by its selectors (country, brand, docType).
 * Returns the matching schema or null if no template exists for the combo.
 * This is the load-bearing call for the "template not available" UX —
 * a null return is a real product-visible outcome, not an error.
 */
export async function findTemplateBySelectors(
  country: string,
  brand: string,
  docType: string
): Promise<CorpusTemplate | null> {
  const all = await loadAllTemplates();
  return (
    all.find(
      (t) =>
        t.selectors.country === country &&
        t.selectors.brand === brand &&
        t.selectors.docType === docType
    ) ?? null
  );
}

/** Clear the in-memory cache. For tests or hot-reload scenarios. */
export function clearCorpusCache(): void {
  _cache = null;
}

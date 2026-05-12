/**
 * Drive inventory loader — reads corpus/drive-inventory.json.
 *
 * The inventory is the result of walking the shared Drive's full file
 * tree. Agent 1 uses it to answer "what (country, doc_type) combos do
 * we actually have content for?" and to surface gaps to the specialist.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const INVENTORY_PATH = path.join(process.cwd(), '..', 'corpus', 'drive-inventory.json');

export type DriveFile = {
  path: string;
  id: string;
  mimeType: string;
  modifiedTime: string | null;
  size: number | null;
};

export type DriveInventory = {
  scanned_folders: number;
  total_files: number;
  files: DriveFile[];
};

let _inv: DriveInventory | null = null;

export async function loadInventory(): Promise<DriveInventory> {
  if (!_inv) {
    const raw = await fs.readFile(INVENTORY_PATH, 'utf8');
    _inv = JSON.parse(raw);
  }
  return _inv!;
}

/**
 * Aggregated count of files by (country, doc_type).
 * Used by the "template not available" UX to recommend closest matches.
 */
export type CoverageMatrix = Map<string, Map<string, number>>;

let _coverage: CoverageMatrix | null = null;

export async function getCoverageMatrix(): Promise<CoverageMatrix> {
  if (_coverage) return _coverage;
  const inv = await loadInventory();
  const matrix: CoverageMatrix = new Map();
  for (const file of inv.files) {
    const parts = file.path.split('/');
    if (parts.length < 2) continue;
    const country = parts[0];
    const docType = parts[1];
    if (!matrix.has(country)) matrix.set(country, new Map());
    const inner = matrix.get(country)!;
    inner.set(docType, (inner.get(docType) ?? 0) + 1);
  }
  _coverage = matrix;
  return _coverage;
}

/**
 * Does the corpus have *any* files for this (country, doc_type) combo?
 * Note: a "true" return means files exist in the Drive folder — it does
 * NOT mean we have a parsed slot schema yet. Slot schemas live in
 * corpus/templates/ and only exist for combos we've explicitly extracted.
 */
export async function hasCorpusCoverage(country: string, docTypeFolder: string): Promise<boolean> {
  const matrix = await getCoverageMatrix();
  const docTypes = matrix.get(country);
  if (!docTypes) return false;
  return (docTypes.get(docTypeFolder) ?? 0) > 0;
}

/**
 * For a (country, docType) combo we don't have, suggest the closest
 * available combos. Used in the "template not available" UX.
 */
export async function suggestClosestMatches(
  country: string,
  docType: string
): Promise<{
  sameDocTypeOtherCountries: Array<{ country: string; count: number }>;
  otherDocTypesSameCountry: Array<{ docType: string; count: number }>;
}> {
  const matrix = await getCoverageMatrix();

  const sameDocTypeOtherCountries: Array<{ country: string; count: number }> = [];
  for (const [c, docTypes] of matrix.entries()) {
    if (c === country) continue;
    const count = docTypes.get(docType);
    if (count) sameDocTypeOtherCountries.push({ country: c, count });
  }
  sameDocTypeOtherCountries.sort((a, b) => b.count - a.count);

  const otherDocTypesSameCountry: Array<{ docType: string; count: number }> = [];
  const sameCountry = matrix.get(country);
  if (sameCountry) {
    for (const [dt, count] of sameCountry.entries()) {
      if (dt !== docType) otherDocTypesSameCountry.push({ docType: dt, count });
    }
    otherDocTypesSameCountry.sort((a, b) => b.count - a.count);
  }

  return {
    sameDocTypeOtherCountries: sameDocTypeOtherCountries.slice(0, 5),
    otherDocTypesSameCountry: otherDocTypesSameCountry.slice(0, 5),
  };
}

/**
 * Map from our internal doc-type IDs to the Drive folder names.
 * The Drive uses human-readable folder names; our routing uses canonical IDs.
 */
export const DOC_TYPE_TO_DRIVE_FOLDER: Record<string, string> = {
  employment_agreement: 'Employment Agreements',
  termination_letter: 'Termination documents',
  warning_letter: 'Warning letters - Disciplinary actions',
  employment_certificate: 'Employment certificates',
  nda: 'NDAs',
  addendum: 'Addendums - Annexes',
  travel_letter: 'Business travel- Visa- Invitation letters',
};

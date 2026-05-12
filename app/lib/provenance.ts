/**
 * Provenance recording.
 *
 * Per docs/POC-LIMITATIONS.md and docs/agent-architecture.md, every
 * generated document carries a triple: (templateVersion, corpusSnapshotId,
 * regulationSnapshotId). The record is appended to data/generations.jsonl.
 *
 * The provenance block is *required* — generation is blocked, not warned,
 * if any component is missing (the "fail closed" principle from
 * POC-LIMITATIONS.md).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const PROVENANCE_LOG = path.join(process.cwd(), 'data', 'generations.jsonl');

export type GenerationProvenance = {
  documentId: string;
  templateId: string;
  templateVersion: string;
  corpusSnapshotId: string;
  regulationSnapshotId: string | null;
  generatedAt: string;
  specialistId: string;
  pocMode: true;
};

/**
 * Validates and appends a provenance record. Throws if anything is
 * missing — generation cannot proceed without a complete record.
 */
export async function recordProvenance(p: GenerationProvenance): Promise<void> {
  const missing: string[] = [];
  if (!p.documentId) missing.push('documentId');
  if (!p.templateId) missing.push('templateId');
  if (!p.templateVersion) missing.push('templateVersion');
  if (!p.corpusSnapshotId) missing.push('corpusSnapshotId');
  if (!p.generatedAt) missing.push('generatedAt');
  if (!p.specialistId) missing.push('specialistId');
  if (p.pocMode !== true) missing.push('pocMode (must be true)');
  // regulationSnapshotId may be null for PoC — see POC-LIMITATIONS.md
  if (missing.length > 0) {
    throw new Error(
      `Provenance incomplete: missing ${missing.join(', ')}. ` +
        'Per docs/POC-LIMITATIONS.md, generation requires a complete provenance block.'
    );
  }
  await fs.mkdir(path.dirname(PROVENANCE_LOG), { recursive: true });
  await fs.appendFile(PROVENANCE_LOG, JSON.stringify(p) + '\n');
}

/**
 * A short hash of the corpus state — used as corpusSnapshotId on
 * provenance records. For PoC: hash of the inventory file's contents.
 */
let _corpusSnapshot: string | null = null;
export async function corpusSnapshotId(): Promise<string> {
  if (_corpusSnapshot) return _corpusSnapshot;
  const invPath = path.join(process.cwd(), '..', 'corpus', 'drive-inventory.json');
  try {
    const raw = await fs.readFile(invPath);
    _corpusSnapshot = createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    _corpusSnapshot = 'no-inventory';
  }
  return _corpusSnapshot;
}

export function newDocumentId(): string {
  // RFC4122-ish; sufficient for PoC.
  const bytes = createHash('sha256')
    .update(`${Date.now()}-${Math.random()}-${process.pid}`)
    .digest('hex');
  return `lumina-doc-${bytes.slice(0, 16)}`;
}

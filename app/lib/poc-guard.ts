/**
 * Tripwire: the app refuses to generate any document unless
 * LUMINA_POC_MODE=true is set in the environment. Per
 * docs/POC-LIMITATIONS.md.
 *
 * This is intentionally silly — anyone forking and trying to deploy
 * must deliberately opt in. Easy to remove, easy to spot in code review.
 */
export function assertPocMode(): void {
  if (process.env.LUMINA_POC_MODE !== 'true') {
    throw new Error(
      'LUMINA_POC_MODE must be set to "true" before any generation. ' +
        'See docs/POC-LIMITATIONS.md for context.'
    );
  }
}

export function isPocMode(): boolean {
  return process.env.LUMINA_POC_MODE === 'true';
}

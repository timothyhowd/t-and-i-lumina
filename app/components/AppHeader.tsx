'use client';

/**
 * Top navigation bar. Sits below the PoC banner.
 * Lumina wordmark on the left, brand chips on the right.
 *
 * The brand chips do two things:
 *   - Visually indicate which brand the active draft is for (auto-detected).
 *   - Let the specialist explicitly override (click to lock to a brand).
 */
export type Brand = 'wolt' | 'doordash' | 'deliveroo';

export function AppHeader({
  activeBrand,
  onBrandChange,
}: {
  activeBrand: Brand | null;
  onBrandChange?: (b: Brand | null) => void;
}) {
  return (
    <header className="sticky top-[24px] z-40 border-b border-line bg-card">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <div className="flex items-center gap-1">
          <span className="lumen-lg" aria-hidden />
          <span className="text-[17px] font-semibold tracking-tight text-ink">Lumina</span>
        </div>
        <div className="flex items-center gap-1">
          <BrandChip
            brand="doordash"
            label="DoorDash"
            active={activeBrand === 'doordash'}
            onClick={() => onBrandChange?.(activeBrand === 'doordash' ? null : 'doordash')}
          />
          <BrandChip
            brand="wolt"
            label="Wolt"
            active={activeBrand === 'wolt'}
            onClick={() => onBrandChange?.(activeBrand === 'wolt' ? null : 'wolt')}
          />
          <BrandChip
            brand="deliveroo"
            label="Deliveroo"
            active={activeBrand === 'deliveroo'}
            onClick={() => onBrandChange?.(activeBrand === 'deliveroo' ? null : 'deliveroo')}
          />
        </div>
      </div>
    </header>
  );
}

function BrandChip({
  brand,
  label,
  active,
  onClick,
}: {
  brand: Brand;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const activeColor =
    brand === 'doordash'
      ? 'text-brand-doordash'
      : brand === 'wolt'
      ? 'text-brand-wolt'
      : 'text-brand-deliveroo';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? `${activeColor} bg-bg`
          : 'text-muted hover:text-ink hover:bg-bg/60'
      }`}
    >
      {label}
    </button>
  );
}

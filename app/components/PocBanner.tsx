/**
 * Slim PoC strip across the top of every page.
 * Per docs/POC-LIMITATIONS.md — non-negotiable. Compact, not stress-inducing.
 */
export function PocBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-pocWarn text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1 text-[11px] tracking-wide">
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />
          <span className="font-semibold uppercase">Prototype</span>
          <span className="opacity-75 hidden sm:inline">— Not for production use</span>
        </div>
        <a
          href="#"
          className="hidden sm:inline text-white/80 hover:text-white underline-offset-2 hover:underline"
        >
          About this PoC
        </a>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Lumina</h1>
      <p className="mt-2 text-sm text-neutral-600">
        AI-driven HR document automation. Proof of concept.
      </p>

      <section className="mt-10 space-y-4 text-neutral-800">
        <p>
          Lumina drafts employment documents from a structured slot library,
          fills them from connected systems where it can, and asks a
          specialist to provide what's missing. Every clause carries
          provenance back to a versioned template; every regulation
          citation that has not yet been verified by counsel is flagged
          inline.
        </p>
        <p className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
          <strong>This is a prototype.</strong> Nothing it produces is legally vetted.
          No clause is approved by counsel. No regulation citation is verified.
          Outputs carry a permanent watermark and are not for execution.
          See <code>docs/POC-LIMITATIONS.md</code>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Try the prototype</h2>
        <p className="mt-2 text-sm text-neutral-600">
          The conversational surface is where Lumina earns its keep.
          Start a draft and watch the three agents (Templates, Data, Generate)
          do their work.
        </p>
        <Link
          href="/draft"
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Start a draft →
        </Link>
      </section>

      <section className="mt-10 text-sm text-neutral-700">
        <h2 className="text-base font-semibold">What's wired in this PoC</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Finland Wolt employment agreement — schema-extracted from real corpus, conditional clause groups for term type, role tier, and schedule.</li>
          <li>Mock Greenhouse + Workday fixtures with four fake personas covering common routing combinations.</li>
          <li>Anthropic API integration with prompt caching (Haiku for routing / extraction, Opus for generation).</li>
          <li>Watermark + provenance block on every generated draft.</li>
          <li>"Template not available" affordance when (country × brand × doc_type) has no corpus entry.</li>
        </ul>
      </section>
    </div>
  );
}

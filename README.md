# Lumina

Proof-of-concept for AI-driven HR document automation across DoorDash, Wolt, and Deliveroo.

A specialist describes the situation in plain language; Lumina drafts the document using templates, retrieves precedent where it has to, cites regulations on every clause, and routes to the specialist for sign-off. Documents trace back to a verifiable source on every line.

## Quick start

```bash
# View the standalone demo
open demo/lumina.html
```

The production-track Next.js app will live in `app/` (scaffolding in progress).

## Project context

See [CLAUDE.md](./CLAUDE.md) for architecture, conventions, decisions, and open questions.

## Repository layout

- `demo/` — the working single-file demo (open in browser)
- `prototypes/` — four paradigm explorations (template engine, RAG-generated, regulation-native, conversational co-pilot) + the comparison/index doc
- `app/` — Next.js app, to be scaffolded
- `corpus/` — historical template extracts, to be built
- `docs/` — decision records, accuracy rubric, internal notes
- `.claude/` — Claude Code project configuration

---
name: example-agent
description: Reference example showing the subagent file format. Delete or replace with real agents.
tools: Read, Grep, Glob, Bash
model: sonnet
---

This is the system prompt for the subagent. It runs in its own context window when invoked by name (`@example-agent` or via the Agent tool with `subagent_type: example-agent`).

Use this for tasks where:
- The work is well-bounded (review, validation, lookup, etc.)
- You want to protect the main session's context from intermediate reasoning
- The same task pattern recurs and benefits from a focused system prompt

Replace this file with real agents. Suggested first agents based on Lumina's conventions:

- **legal-review-check** — verify a draft has citations on every clause, flag any clauses without a source
- **template-conformance** — confirm a template declares all required metadata (variables, entity, signature flow, etc.) before activation
- **regulation-citation-validator** — confirm every regulation citation in a draft maps to a real source in the corpus or a known feed
- **brand-letterhead-audit** — verify a generated doc uses the correct brand/entity/address combination

Each agent should:
- Have a focused, narrow purpose (one type of check per agent)
- Specify the minimum tools it needs (most checks only need Read + Grep)
- Return a clear, actionable summary — pass/fail with specific issues

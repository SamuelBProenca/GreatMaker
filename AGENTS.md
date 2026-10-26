# DesignRef engineering rules

- M1 is a working Reference Hub. Do not add M2 generation, accounts, AI, or repository integrations without a new request.
- Inspect the workspace and diff; preserve unrelated changes. Never overwrite an unrelated application.
- Keep domain, presets, exporters, and persistence independent of Next.js.
- Validate untrusted data at runtime. Never execute submitted snippets or fetch submitted URLs. Escape all user content.
- Scope every resource and upload to an active session; expired sessions lose access before cleanup.
- Never promise deletion on tab close. Maintain deletion retries, expiration cleanup, and accurate retention copy.
- Preserve sources and explicit preferences. Do not fabricate insights, missing brief answers, or measured benefits.
- Use pt-BR product copy, English code and technical docs, CSS Modules, shared tokens, keyboard access, reduced motion, and responsive layouts.
- Buttons must perform real actions. Review changes and run typecheck, lint, unit/integration tests, browser tests, and build; report verification limits honestly.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

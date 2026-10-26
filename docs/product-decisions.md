# M1 implementation decisions

## Workspace inspection

The supplied workspace is an empty Git repository on `main`, with no commits, application files, or remotes. It is suitable for DesignRef. Node 22.14, pnpm and a local Edge/Playwright browser are available. Docker is not installed. This delivery is local-only, as requested by M1; no hosting, external integration or PR is implied.

The owner subsequently supplied `SamuelBProenca/GreatMaker`. GitHub metadata and Git refs confirmed an empty repository. The workspace was linked to that origin and implementation isolated on `codex/designref-m1`. No unrelated project was replaced.

## Plan and scope

1. Implement framework-independent validated domain types, five presets, and truthful JSON/Markdown export.
2. Add SQLite migrations, opaque hashed session tokens, session ownership, disk uploads, and retryable deletion.
3. Implement real HTTP routes with origin, payload, quota and expiration checks.
4. Build the Portuguese reference library, optional brief, preset browser, session decisions and export preview.
5. Verify domain behavior, real persistence and HTTP behavior, desktop/mobile browser flows, accessibility, and production build.

## Deliberate deviations

- SQLite through Node's built-in `node:sqlite` replaces PostgreSQL for an immediately runnable single-process local M1 without Docker or credentials. SQL constraints, prepared statements, transactions, WAL and migrations provide real server persistence. A networked/multi-instance deployment needs a PostgreSQL repository adapter, shared rate limiting and object storage. The built-in SQLite API is experimental in Node 22.14; this version is explicitly tested.
- A single root Next.js app with `packages/{core,presets,exporters,persistence}` avoids unnecessary app-package scaffolding. pnpm manages the workspace and lockfile; core modules have no Next.js imports and can be imported by a later CLI.
- Local disk is the implemented storage adapter. The storage interface accommodates a future S3 adapter; that adapter is not claimed implemented.
- Decisions and preference signals are explicit session entries. No inferred learning, AI calls or cross-session profile.
- 24-hour inactivity and seven-day absolute expiry are configurable implementation defaults, not measured owner requirements. Cleanup is a command, not an installed scheduler.
- The UI uses an ink/ivory research desk with lilac accents, editorial headings and informative cards. No decorative actions or third-party images are needed.

## Evidence versus assumptions

The intended usefulness of reference-driven briefing is a product hypothesis. M1 tests correctness and operability, not reductions in rework. No efficacy claims are made.

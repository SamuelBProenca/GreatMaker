# DesignRef — Reference Hub (M1)

A local, anonymous workspace for turning references into explicit design context. Product UI is Brazilian Portuguese. It saves real server-side data and images, then exports JSON and Markdown for the next design/implementation step.

## Local setup

Requirements: Node **22.14 or newer** (tested on 22.14), pnpm **11** (tested on 11.25). No Docker, account, API key, paid service or PostgreSQL is required for this local edition.

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:migrate
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Use that exact origin: `localhost` is a different origin. If you change the host or port, update `APP_ORIGIN` and restart the server. The start action creates a nonpersistent HTTP-only cookie; all subsequent requests use it.

On POSIX shells, use `cp .env.example .env`. Do not commit `.env`, `data/`, browser artifacts or uploads. pnpm's required native dependency scripts are explicitly allowed in `pnpm-workspace.yaml`.

## Checks and production mode

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
pnpm start
```

`pnpm test` runs domain tests and integration tests against actual SQLite databases, native Request/Response handlers and local files. `pnpm test:e2e` starts the production build on **127.0.0.1:3100** with separate data under `data/e2e`, then runs desktop (1440 px) and mobile (390 px) workflows. A production build must exist first. On Windows it defaults to installed Edge; elsewhere install Chromium with `pnpm exec playwright install chromium`. Override the browser with `PLAYWRIGHT_CHANNEL` if necessary. `E2E_DEV=1` uses the development server instead. Browser reports are in `playwright-report/` and failure artifacts in `test-results/`; `pnpm exec playwright show-report` opens the report.

`pnpm typecheck` generates Next.js route types and `next-env.d.ts` before invoking TypeScript, so it also works in a fresh checkout before the first dev server or build.

Use `NEXT_TELEMETRY_DISABLED=1` if you want to disable Next.js development/build telemetry. DesignRef itself has no analytics or third-party AI calls.

## What M1 does

- One editable project per anonymous session.
- Add, view, edit, search, filter and delete URL, image, code and idea references.
- Capture source/author, notes, keep/avoid, component/visual tags, industry and importance.
- Upload and privately preview static PNG/JPEG/WebP; MIME, signature, decode, pixel and byte limits are checked. URLs are never fetched and snippets are never executed.
- Save a partial brief, choose/clear one of five contextual presets, record explicit decisions/preferences linked to references.
- Inspect a real handoff, download JSON and Markdown, and see missing information explicitly marked. Original image binaries are **not** bundled; save them separately.
- Expire sessions, revoke access and delete data/uploads with an explicit session action; retry failed blob deletions using cleanup.

M2 visual directions, generated previews, design approval, tokens/code generation, AI, accounts, team collaboration, persistent profiles, S3 and PostgreSQL adapters are **not implemented**.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_ORIGIN` | `http://127.0.0.1:3000` | Exact allowed origin for writes; HTTPS enables Secure cookies. |
| `DESIGNREF_DATA_DIR` | `./data` | Absolute or working-directory-relative path for database and private uploads. |
| `SESSION_IDLE_HOURS` | `24` | Sliding inactivity expiration. |
| `SESSION_MAX_HOURS` | `168` | Absolute lifetime; interaction cannot exceed it. |
| `PLAYWRIGHT_CHANNEL` | `msedge` on Windows | Browser used by E2E tests. |

TTL values must be finite, positive and at most 8760 hours. Keep the data directory outside any publicly served directory. Protect its OS permissions. The application binds to loopback by default and this delivery has not been deployed.

## Cleanup and retention

```powershell
pnpm cleanup:sessions
```

Expired sessions are denied by every protected operation even if cleanup has not run. Cleanup removes expired rows, orphaned images, interrupted uploads older than one hour, and retries failed deletions. It prints counts and exits nonzero if file deletions remain pending.

Closing a tab/browser does **not** guarantee deletion. Browser session restoration may preserve session cookies. Use **Excluir sessão** to revoke access and delete the server-managed project and images. Download the handoff first. This is logical database deletion and managed-file removal, not a promise of forensic erasure, backup deletion or deletion of files the user exported.

**No scheduler is installed.** For any continuously running deployment, configure Task Scheduler/cron to execute cleanup at least hourly, with the same working directory, Node runtime and environment as the app, and alert on nonzero exit. Until then, physical removal of expired data requires this command. See [security and retention](docs/security-and-retention.md).

## Structure and implementation notes

- `app/`, `components/`, `lib/`: Next.js UI, CSS Modules and thin HTTP adapter.
- `packages/core/`: Zod schemas, framework-independent entities, filters and TTL rules.
- `packages/presets/`: five curated, versioned contexts.
- `packages/exporters/`: structured JSON and escaped Markdown handoff.
- `packages/persistence/`: SQLite repository, SQL migration and disk storage interface.
- `scripts/`: idempotent migration and expiration/blob cleanup commands.
- `tests/`: unit, real-persistence integration and browser tests.

SQLite intentionally replaces the brief's PostgreSQL default to support this Docker-free local environment. `node:sqlite` emits an experimental API warning on Node 22.14. The database is `data/designref.sqlite`; uploads have server-generated opaque names. Migrations run at startup as well as through the explicit command. This is a single-process local application; production hosting with shared storage and multiple instances needs additional adapters and shared infrastructure. See [architecture](docs/architecture.md), [product decisions](docs/product-decisions.md), and [verification report](docs/m1-verification.md).

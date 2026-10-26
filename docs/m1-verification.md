# M1 verification report

Date: 2026-10-25. Workspace: `designer alfa 1`. Repository: `SamuelBProenca/GreatMaker`. Branch: `codex/designref-m1`. This report describes local execution; no hosted deployment is claimed.

## Implemented

The usable Reference Hub includes anonymous cookie sessions, project rename, all four reference types and metadata, real disk image preview, CRUD/search/filters, partial brief persistence, five optional curated presets, explicit session decisions/preferences, inspectable JSON and Markdown handoff, expiration enforcement, end-session deletion and retryable cleanup. The interface is pt-BR, responsive, labeled and keyboard accessible, with reduced-motion support.

SQLite replaces the proposed PostgreSQL default because this environment has no Docker and the milestone requires immediate local operation. Local disk is the implemented image storage adapter. See [decisions](product-decisions.md) and [architecture](architecture.md).

## Executed checks

| Check | Result |
| --- | --- |
| pnpm dependency installation | Passed; lockfile generated and native build scripts allowed explicitly. |
| `pnpm db:migrate` | Passed; local schema created. |
| `pnpm cleanup:sessions` | Passed; real command reported zero expired sessions, zero deletions and zero pending files on the fresh local database. |
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed. |
| `pnpm test` | **35 passed**: 20 domain/export/preset tests and 15 API/persistence integration cases. |
| `pnpm build` | Passed; Next.js 16.4.3 production build on Node 22.14.0. |
| `pnpm test:e2e` | **6 passed** against production: three workflows each in Edge at 1440×1000 and 390×844. |
| Automated accessibility | Four axe scans (library and brief in both viewports), zero reported WCAG 2 A/AA and 2.1 AA violations for scanned states. |
| Keyboard and layout | Skip link, native dialog Escape dismissal/focus return, reduced-motion mode and no horizontal document overflow at core workflow checkpoints passed. |

Browser testing identified and corrected decorative step numbers in accessible names and a missing focus return after dialog removal. A test selector was scoped to its dialog to distinguish product errors from Next.js's route announcement. Final browser run: **6/6 passed in 16.8 seconds**; no test was skipped. Initial sandbox restrictions on local sockets/build files were resolved by running the affected verification commands with the required permission.

## Acceptance evidence

| M1 criterion | Verified outcome |
| --- | --- |
| Anonymous start and rename | Real browser flow and database reopen test pass. |
| Save URL without fetching target | API test spies on network fetch; no target request occurs. Browser creates and edits the URL. |
| PNG/JPEG/WebP uploads and invalid/oversized rejection | Real API/file tests cover all formats, MIME/signature mismatch, corrupt data, SVG, 10 MiB size and 50 MiB quota. Browser validates an error, uploads and decodes a preview. |
| HTML/JS snippet stays literal | Schema preserves snippet text; browser checks literal code and absence of script effects. |
| Note create/edit/filter/delete | Real CRUD integration, UI note editing/search and kind-filter empty state pass. |
| Tags, keep/avoid, importance and search | Schema, combined filter tests, browser editing/tag filtering and actual export content pass. |
| Partial brief and optional presets | Real brief persistence/reload, preset selection/clear integration, and browser selection pass. |
| Truthful JSON and Markdown export | Browser downloads and parses both formats; real data, provenance, explicit decisions and missing information are asserted. |
| Cross-session access denied | API checks read/edit/delete/image/export/choice ownership. A separate browser context cannot read the first session's image. |
| Reference deletion removes image | Disk contents and private route denial after deletion are verified. |
| End-session revokes access and deletes resources | Copied cookie is denied; all relevant SQL tables and upload directory are empty in integration tests. Browser repeats revocation. |
| Immediate expiry and subsequent cleanup | Exact idle/absolute boundary tests deny access while expired rows still exist; cleanup removes real rows/files. |
| Deletion failure recovery | Injected storage failure returns pending, keeps durable retry records, and subsequent cleanup succeeds. Interrupted uploads are reclaimed after a grace period. |
| Essential keyboard/focus/reduced motion | Browser assertions pass in both viewports; visible focus checked in screenshots. |
| Mobile ~390 px / desktop ~1440 px | All three browser workflows and overflow assertions pass in both viewports. |
| Typecheck/lint/tests/build | Final commands pass as above. |

## Screenshots

These are actual screenshots from isolated E2E sessions, showing test notes and deliberately inert hostile code; no fixture content is seeded into the user's normal project database.

- [Desktop library](screenshots/library-desktop.png)
- [Mobile library](screenshots/library-mobile.png)

## Known limits

- `node:sqlite` is experimental in the tested Node version and emits a warning. This delivery targets a single-process local app; PostgreSQL/shared object storage and distributed abuse controls are not implemented.
- No physical cleanup scheduler is installed. Expired access is denied automatically; physical removal requires the cleanup command or an operator-configured scheduler. File deletion failures remain queued until a successful retry.
- SQL deletion/file removal do not guarantee forensic or backup erasure. Exported files and original images remain user-managed.
- Image binaries are not bundled in handoff downloads. Sources and metadata are exported; users must save original files separately.
- Automated accessibility and keyboard checks cover essential states, not every assistive technology, zoom configuration, contrast mode or browser. Firefox, Safari, manual screen-reader testing, production load tests and external hosting were not tested.
- The readable summary prioritizes the main content; the JSON preview and downloads contain all supported metadata and preset guidance.

## Files and next milestone

Changes are confined to the new application: root setup/configuration, `app/`, `components/`, `lib/`, `packages/`, `scripts/`, `tests/`, `docs/`, and `AGENTS.md`. Runtime databases, uploads, credentials and browser report files are ignored.

M2 remains unimplemented: deterministic design manifests, three genuinely distinct responsive directions, rationale tied to references, feedback/comparison, immutable approval revisions and design-token/implementation exports. M3 integrations, AI, accounts and long-term profiles are also absent.

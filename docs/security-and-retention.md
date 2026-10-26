# Security and retention

## Implemented controls

- Opaque 256-bit session tokens; database contains token hashes, never raw cookies. Nonpersistent `HttpOnly; SameSite=Lax; Path=/` cookies, with `Secure` when `APP_ORIGIN` uses HTTPS. No browser storage or cross-session user profile.
- Every protected repository operation checks the current session's existence, expiration and project relationship. Reference, choice, image and export reads/writes are session-scoped. Errors do not disclose database details.
- Same-origin writes require the exact configured Origin and reject cross-site Fetch Metadata. No wildcard CORS. JSON is limited to 128 KiB, upload requests to 10 MiB plus 128 KiB metadata overhead, delete bodies to 1 KiB. Streaming reads enforce limits even without Content-Length.
- Zod schemas enforce required kind-specific content, safe HTTP(S) URL schemes without embedded credentials, known presets, bounded strings/lists and strict fields. User-supplied storage paths are rejected.
- URL references are only stored as data. No URL fetch, preview proxy, remote image loading, scraper, screenshot or network call is made to a submitted destination.
- Code and descriptions render through escaped React text. There is no HTML injection, eval, iframe renderer or submitted-code execution. Markdown escapes ordinary content and uses indented literal code blocks. JSON is plain structured data.
- Image MIME and PNG/JPEG/WebP signatures must match. Sharp decodes accepted static images with a 40-megapixel limit. SVG, animation, corrupt images and files above 10 MiB are rejected. Storage is capped at 50 MiB per session, including deletion-pending files. Filenames are generated on the server; paths cannot be chosen by users. Reads are session-protected and `private, no-store` with `nosniff`.
- Database-backed limits allow 30 session creations globally per minute and 120 writes per session per minute, plus 300 references and 200 explicit choice records. These are pragmatic single-process/local protections, not a distributed abuse-defense service.
- Framing is denied; CSP limits resources to the app and blob image previews. Next.js hydration requires inline script/style allowances in this implementation; development also needs eval. These allowances do not authorize submitted scripts, which remain escaped text. A nonce-based production policy is a future hardening option.
- No analytics, remote font dependencies or private reference submission to third-party AI.

## Retention semantics

Defaults: 24 hours after last API interaction, capped at seven days from creation. Configurable positive hours are bounded to one year to reject accidental invalid configuration. The backend denies access at the exact expiration boundary independently of cleanup. It never extends an expired session.

Closing a tab/browser does not trigger or guarantee deletion. Session restore may retain cookies. Losing a cookie makes the old project inaccessible from that browser but does not delete server records. Explicit **Excluir sessão** revokes the token by deleting the session row, cascades project data, and removes managed images. If image deletion fails, access stays revoked and the response/UI reports pending removal. Cleanup retries it.

`pnpm cleanup:sessions` removes expired sessions and unreferenced/deletion-pending files, including uploads interrupted more than an hour earlier. **No scheduled task has been installed.** A persistent deployment must configure hourly cleanup and monitor failures. A zero exit confirms that this invocation had no pending blob deletions; it does not prove that a scheduler exists.

Exports contain brief answers, sources, reference metadata, literal snippets and explicit choices. They omit cookie/session credentials, raw storage keys and image binaries. Exports are user-managed files and are not removed when a session ends. Save original images separately. The in-app handoff exposes a readable summary and complete JSON before download.

## Limits of this local delivery

SQLite and local disk are suitable for a single Node process. Do not put `data/` in a public directory or sync it to a deployment artifact. Configure OS access, HTTPS, trusted host/origin, backups and monitoring before hosting. Backups and copies need their own retention policy. SQL row deletion and file unlinking do not guarantee forensic erasure of SSD blocks or SQLite WAL/free pages.

This implementation does not include distributed rate limiting, an object store, account recovery, anti-bot challenges, production access management, encrypted-at-rest storage or an operational cleanup scheduler. Avoid presenting it as a public multi-tenant hosted service without those deployment decisions. Automated axe scans and keyboard checks cover essential flows; they do not replace assistive-technology review or certify full WCAG compliance.

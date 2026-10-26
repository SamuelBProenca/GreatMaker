# Architecture

DesignRef M1 is a TypeScript modular monolith. The root Next.js App Router app renders a client workspace with server-owned persistence. It contains no fake records. The initial screen resolves an existing session; only the explicit start action creates one.

## Boundaries

`core` validates all reference, brief, project and explicit-choice payloads. `presets` validates curated read-only data at module load. `exporters` transforms a real workspace into a versioned handoff and readable Markdown; it does not inspect URLs or infer missing answers. These packages do not import Next.js or the DOM.

`persistence` implements prepared SQL and transactions using Node SQLite. The storage interface has `put/read/delete`; the only implemented adapter is private local disk. `lib/api.ts` is a Request/Response adapter usable without Next.js, enabling integration tests against real SQLite and files. The catch-all route delegates only the documented endpoints, including private image reads and explicit choice entries.

## Session and schema

Session tokens are 32 random bytes, represented in a session-only HTTP-only cookie; only their SHA-256 hash is stored. Session IDs and project/reference/choice IDs are UUIDs. The schema enforces unique projects per session, reference kinds, image storage invariants, foreign keys and deletion cascades. Each method rechecks the session and its project ownership. Expiration is the minimum of the sliding deadline and absolute deadline. Storage timestamps are UTC epoch milliseconds; user-visible dates use local browser formatting.

The database runs in WAL mode with foreign keys and a busy timeout. The initial migration is idempotent and tracked in `schema_migrations`. Multi-step session creation and reference/image changes use transactions. A short synchronous repository avoids overlapping SQL transaction scopes within one Node process. Uploaded image decoding happens before the synchronous write path, which rechecks session validity and quota.

## Blob lifecycle

Register an upload in SQLite **before** writing the file, initially in the uploading state. Complete reference creation and mark the blob active in a transaction. A failed write/insert marks the registered blob pending deletion. A process interruption leaves a registered upload which cleanup can reclaim after one hour. A separate cleanup process will not reclaim a recent upload.

Deleting an image reference marks its blob pending in the same transaction that deletes the reference. Deleting a session cascades its project records and detaches its blobs. The deletion worker removes files and then their blob records. Failures retain durable retry records and return `pending`, never fake success. A missing file is considered already deleted. Cleanup retries pending/detached blobs and expires old sessions. Cross-session file access always resolves a reference through the active session; opaque keys are never accepted as filesystem paths.

## UI and styling

CSS custom properties in a `tokens` layer centralize ink, paper, accent, typography and core spacing/radius choices. A small `utilities` layer provides skip links and screen-reader-only labels. Layout primitives (`twoColumns`, grids, form/cluster actions and panels) live in one scoped CSS Module. Responsive breakpoints adapt navigation, cards, forms and the handoff without changing content. There are no remote fonts or downloaded third-party images.

Native modal dialogs provide focus containment, Escape dismissal and focus return. Forms have explicit labels, validation feedback and loading states. Product text explains temporary storage, incomplete briefs, metadata-only URL handling, and exports without image binaries. Reduced-motion preferences disable transitions and animation.

## Future extension

Add PostgreSQL and S3 implementations behind repository/storage boundaries before multi-instance hosting. M2 can consume the existing handoff and introduce validated neutral manifests, deterministic directions and immutable approval snapshots. No speculative M2 renderer, CLI, AI connector, shared profile or authentication infrastructure is included now.

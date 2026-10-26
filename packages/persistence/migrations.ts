import type { DatabaseSync } from "node:sqlite";

export function migrate(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      CHECK(expires_at >= created_at)
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS projects(
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS briefs(
      project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
      payload TEXT NOT NULL CHECK(json_valid(payload)), updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS blobs(
      key TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
      size INTEGER NOT NULL CHECK(size > 0), mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
      pending_delete INTEGER NOT NULL DEFAULT 2 CHECK(pending_delete IN (0,1,2)), created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refs(
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('url','image','code','note')),
      payload TEXT NOT NULL CHECK(json_valid(payload)),
      storage_key TEXT UNIQUE REFERENCES blobs(key), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      CHECK((kind='image' AND storage_key IS NOT NULL) OR (kind!='image' AND storage_key IS NULL))
    );
    CREATE INDEX IF NOT EXISTS refs_project ON refs(project_id);
    CREATE TABLE IF NOT EXISTS decisions(
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      reference_id TEXT REFERENCES refs(id) ON DELETE SET NULL,
      kind TEXT NOT NULL CHECK(kind IN ('decision','preference')),
      value TEXT NOT NULL, rationale TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL);
    INSERT OR IGNORE INTO schema_migrations VALUES(1, unixepoch()*1000);
  `);
}

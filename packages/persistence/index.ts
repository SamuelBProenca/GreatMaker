import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { briefSchema, decisionSchema, DomainError, filterReferences, isExpired, nextExpiry, projectSchema, referenceInputSchema, type Brief, type Decision, type DecisionInput, type Project, type Reference, type ReferenceFilter, type ReferenceInput, type SessionInfo, type Workspace } from "../core";
import { DiskImageStorage, MAX_FILE_BYTES, MAX_SESSION_BYTES, detectImage, type ImageStorage } from "./storage";
import { migrate } from "./migrations";

type SessionRow = { id: string; created_at: number; last_seen_at: number; expires_at: number };
type ProjectRow = { id: string; name: string; created_at: number; updated_at: number };
type RefRow = { id: string; project_id: string; payload: string; storage_key: string | null; mime: string | null; size: number | null; created_at: number; updated_at: number };
type DecisionRow = { id: string; project_id: string; reference_id: string | null; kind: "decision" | "preference"; value: string; rationale: string; created_at: number };
export type ActiveSession = SessionRow & { projectId: string };
export type StoreOptions = { directory: string; idleHours?: number; maxHours?: number; now?: () => number; storage?: ImageStorage };
const iso = (value: number) => new Date(value).toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export class Store {
  readonly db: DatabaseSync;
  readonly storage: ImageStorage;
  readonly idleHours: number;
  readonly maxHours: number;
  private now: () => number;
  constructor(options: StoreOptions) {
    mkdirSync(options.directory, { recursive: true });
    this.db = new DatabaseSync(resolve(options.directory, "designref.sqlite"));
    migrate(this.db);
    this.storage = options.storage ?? new DiskImageStorage(resolve(options.directory, "uploads"));
    this.idleHours = options.idleHours ?? 24;
    this.maxHours = options.maxHours ?? 168;
    this.now = options.now ?? Date.now;
    if (![this.idleHours, this.maxHours].every(value => Number.isFinite(value) && value > 0 && value <= 8760)) throw new Error("Invalid session TTL configuration");
  }
  close() { this.db.close(); }
  private transaction<T>(run: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = run(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  rateLimit(key: string, limit: number, windowMs: number) {
    const now = this.now();
    this.db.prepare("DELETE FROM rate_limits WHERE resets_at <= ?").run(now);
    const row = this.db.prepare("INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count").get(key, now + windowMs) as { count: number };
    if (row.count > limit) throw new DomainError(429, "Muitas ações em pouco tempo. Aguarde um minuto e tente novamente.", "rate_limited");
  }
  createSession() {
    this.rateLimit("create-session", 30, 60000);
    const now = this.now(), id = randomUUID(), projectId = randomUUID(), token = randomBytes(32).toString("hex");
    this.transaction(() => {
      this.db.prepare("INSERT INTO sessions VALUES(?,?,?,?,?)").run(id, hash(token), now, now, nextExpiry(now, now, this.idleHours, this.maxHours));
      this.db.prepare("INSERT INTO projects VALUES(?,?,?,?,?)").run(projectId, id, "Meu projeto", now, now);
      this.db.prepare("INSERT INTO briefs VALUES(?,?,?)").run(projectId, JSON.stringify(briefSchema.parse({})), now);
    });
    return { token, session: this.resolveSession(token)! };
  }
  resolveSession(token?: string): ActiveSession | null {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.db.prepare("SELECT id,created_at,last_seen_at,expires_at FROM sessions WHERE token_hash=?").get(hash(token)) as SessionRow | undefined;
    const now = this.now();
    if (!row || isExpired(Math.min(row.expires_at, row.created_at + this.maxHours * 3600000), now)) return null;
    const expiresAt = nextExpiry(row.created_at, now, this.idleHours, this.maxHours);
    this.db.prepare("UPDATE sessions SET last_seen_at=?, expires_at=? WHERE id=?").run(now, expiresAt, row.id);
    const project = this.db.prepare("SELECT id FROM projects WHERE session_id=?").get(row.id) as { id: string };
    return { ...row, last_seen_at: now, expires_at: expiresAt, projectId: project.id };
  }
  private active(session: ActiveSession) {
    const row = this.db.prepare("SELECT s.expires_at, s.created_at FROM sessions s JOIN projects p ON p.session_id=s.id WHERE s.id=? AND p.id=?").get(session.id, session.projectId) as { expires_at: number; created_at: number } | undefined;
    if (!row || isExpired(Math.min(row.expires_at, row.created_at + this.maxHours * 3600000), this.now())) throw new DomainError(401, "Sua sessão expirou ou foi encerrada. Comece uma nova sessão.", "session_expired");
  }
  sessionInfo(session: ActiveSession): SessionInfo {
    this.active(session);
    return { createdAt: iso(session.created_at), lastSeenAt: iso(session.last_seen_at), expiresAt: iso(session.expires_at), absoluteExpiresAt: iso(session.created_at + this.maxHours * 3600000), idleHours: this.idleHours, maxHours: this.maxHours };
  }
  project(session: ActiveSession): Project {
    this.active(session);
    const row = this.db.prepare("SELECT id,name,created_at,updated_at FROM projects WHERE session_id=?").get(session.id) as ProjectRow;
    return { id: row.id, name: row.name, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
  }
  rename(session: ActiveSession, input: unknown) {
    this.active(session); const { name } = projectSchema.parse(input);
    this.db.prepare("UPDATE projects SET name=?,updated_at=? WHERE session_id=?").run(name, this.now(), session.id);
    return this.project(session);
  }
  references(session: ActiveSession, filters: ReferenceFilter = {}): Reference[] {
    this.active(session);
    const rows = this.db.prepare("SELECT r.*, b.mime, b.size FROM refs r LEFT JOIN blobs b ON b.key=r.storage_key WHERE r.project_id=? ORDER BY r.created_at DESC, r.id").all(session.projectId) as RefRow[];
    return filterReferences(rows.map(row => this.mapReference(row)), filters);
  }
  private mapReference(row: RefRow): Reference {
    return { ...referenceInputSchema.parse(JSON.parse(row.payload)), id: row.id, projectId: row.project_id, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), ...(row.storage_key ? { storageKey: row.storage_key, mimeType: row.mime!, size: row.size! } : {}) };
  }
  reference(session: ActiveSession, id: string): Reference {
    this.active(session);
    const row = this.db.prepare("SELECT r.*, b.mime, b.size FROM refs r LEFT JOIN blobs b ON b.key=r.storage_key WHERE r.id=? AND r.project_id=?").get(id, session.projectId) as RefRow | undefined;
    if (!row) throw new DomainError(404, "Referência não encontrada.", "not_found");
    return this.mapReference(row);
  }
  private insertReference(session: ActiveSession, data: ReferenceInput, key: string | null = null) {
    const count = this.db.prepare("SELECT count(*) AS n FROM refs WHERE project_id=?").get(session.projectId) as { n: number };
    if (count.n >= 300) throw new DomainError(422, "Limite de 300 referências por sessão atingido.");
    const id = randomUUID(), now = this.now();
    this.db.prepare("INSERT INTO refs VALUES(?,?,?,?,?,?,?)").run(id, session.projectId, data.kind, JSON.stringify(data), key, now, now);
    return id;
  }
  createReference(session: ActiveSession, input: unknown) {
    this.active(session); const data = referenceInputSchema.parse(input);
    if (data.kind === "image") throw new DomainError(422, "Envie a imagem pelo formulário de upload.");
    const id = this.insertReference(session, data);
    return this.reference(session, id);
  }
  updateReference(session: ActiveSession, id: string, input: unknown) {
    const existing = this.reference(session, id), data = referenceInputSchema.parse(input);
    if (existing.kind !== data.kind) throw new DomainError(422, "O tipo da referência não pode ser alterado.");
    this.db.prepare("UPDATE refs SET payload=?,updated_at=? WHERE id=? AND project_id=?").run(JSON.stringify(data), this.now(), id, session.projectId);
    return this.reference(session, id);
  }
  upload(session: ActiveSession, input: unknown, bytes: Uint8Array, mime: string) {
    this.active(session); const data = referenceInputSchema.parse(input);
    if (data.kind !== "image") throw new DomainError(422, "O upload precisa ser uma referência de imagem.");
    if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new DomainError(413, "A imagem deve ter até 10 MB.");
    const image = detectImage(bytes);
    if (!image || image.mime !== mime) throw new DomainError(415, "Arquivo inválido. Use PNG, JPEG ou WebP com conteúdo compatível.");
    const quota = this.db.prepare("SELECT coalesce(sum(size),0) AS size FROM blobs WHERE session_id=?").get(session.id) as { size: number };
    if (quota.size + bytes.length > MAX_SESSION_BYTES) throw new DomainError(413, "Limite de 50 MB de imagens por sessão atingido.");
    const key = `${randomUUID()}.${image.extension}`;
    // Register before writing so interrupted uploads remain discoverable by cleanup.
    this.db.prepare("INSERT INTO blobs VALUES(?,?,?,?,2,?)").run(key, session.id, bytes.length, mime, this.now());
    try {
      this.storage.put(key, bytes);
      const id = this.transaction(() => {
        const referenceId = this.insertReference(session, data, key);
        this.db.prepare("UPDATE blobs SET pending_delete=0 WHERE key=?").run(key);
        return referenceId;
      });
      return this.reference(session, id);
    } catch (error) { this.db.prepare("UPDATE blobs SET pending_delete=1 WHERE key=?").run(key); this.flushDeletions(); throw error; }
  }
  readImage(session: ActiveSession, id: string) {
    const ref = this.reference(session, id);
    if (!ref.storageKey) throw new DomainError(404, "Imagem não encontrada.");
    try { return { bytes: this.storage.read(ref.storageKey), mime: ref.mimeType! }; }
    catch { throw new DomainError(404, "A imagem não está disponível. Remova a referência e envie o arquivo novamente."); }
  }
  deleteReference(session: ActiveSession, id: string) {
    const ref = this.reference(session, id);
    this.transaction(() => {
      if (ref.storageKey) this.db.prepare("UPDATE blobs SET pending_delete=1 WHERE key=?").run(ref.storageKey);
      this.db.prepare("DELETE FROM refs WHERE id=? AND project_id=?").run(id, session.projectId);
    });
    this.flushDeletions();
    return { deletion: ref.storageKey && this.db.prepare("SELECT key FROM blobs WHERE key=?").get(ref.storageKey) ? "pending" : "complete" };
  }
  brief(session: ActiveSession): Brief {
    this.active(session); const row = this.db.prepare("SELECT payload FROM briefs WHERE project_id=?").get(session.projectId) as { payload: string };
    return briefSchema.parse(JSON.parse(row.payload));
  }
  saveBrief(session: ActiveSession, input: unknown) {
    this.active(session); const data = briefSchema.parse(input);
    this.db.prepare("UPDATE briefs SET payload=?,updated_at=? WHERE project_id=?").run(JSON.stringify(data), this.now(), session.projectId);
    return data;
  }
  decisions(session: ActiveSession): Decision[] {
    this.active(session);
    return (this.db.prepare("SELECT * FROM decisions WHERE project_id=? ORDER BY created_at,id").all(session.projectId) as DecisionRow[]).map(row => ({ id: row.id, projectId: row.project_id, kind: row.kind, value: row.value, rationale: row.rationale, createdAt: iso(row.created_at), ...(row.reference_id ? { referenceId: row.reference_id } : {}) }));
  }
  addDecision(session: ActiveSession, input: DecisionInput) {
    this.active(session); const data = decisionSchema.parse(input);
    if (data.referenceId) this.reference(session, data.referenceId);
    const count = this.db.prepare("SELECT count(*) AS n FROM decisions WHERE project_id=?").get(session.projectId) as { n: number };
    if (count.n >= 200) throw new DomainError(422, "Limite de 200 registros atingido.");
    const id = randomUUID();
    this.db.prepare("INSERT INTO decisions VALUES(?,?,?,?,?,?,?)").run(id, session.projectId, data.referenceId ?? null, data.kind, data.value, data.rationale, this.now());
    return this.decisions(session).find(entry => entry.id === id)!;
  }
  deleteDecision(session: ActiveSession, id: string) {
    this.active(session);
    const result = this.db.prepare("DELETE FROM decisions WHERE id=? AND project_id=?").run(id, session.projectId);
    if (!result.changes) throw new DomainError(404, "Registro não encontrado.");
  }
  workspace(session: ActiveSession): Workspace {
    return { session: this.sessionInfo(session), project: this.project(session), references: this.references(session), brief: this.brief(session), decisions: this.decisions(session) };
  }
  endSession(session: ActiveSession) {
    this.active(session);
    const keys = this.db.prepare("SELECT key FROM blobs WHERE session_id=?").all(session.id) as { key: string }[];
    this.db.prepare("DELETE FROM sessions WHERE id=?").run(session.id);
    this.flushDeletions();
    return { deletion: keys.some(row => this.db.prepare("SELECT key FROM blobs WHERE key=?").get(row.key)) ? "pending" : "complete" };
  }
  flushDeletions() {
    const rows = this.db.prepare("SELECT key FROM blobs WHERE pending_delete=1 OR session_id IS NULL OR (pending_delete=2 AND created_at<=?)").all(this.now() - 3600000) as { key: string }[];
    let deleted = 0;
    for (const row of rows) {
      try { this.storage.delete(row.key); this.db.prepare("DELETE FROM blobs WHERE key=?").run(row.key); deleted++; }
      catch { /* Leave durable retry record. Do not report completed deletion. */ }
    }
    return { deleted, pending: rows.length - deleted };
  }
  cleanup() {
    const now = this.now();
    const result = this.db.prepare("DELETE FROM sessions WHERE expires_at<=? OR created_at+?<=?").run(now, this.maxHours * 3600000, now);
    this.db.prepare("DELETE FROM rate_limits WHERE resets_at<=?").run(now);
    return { expiredSessions: Number(result.changes), ...this.flushDeletions() };
  }
}

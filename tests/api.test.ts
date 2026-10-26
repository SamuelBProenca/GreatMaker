import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { Store } from "../packages/persistence";
import { DiskImageStorage } from "../packages/persistence/storage";
import { createApi, COOKIE_NAME } from "../lib/api";

const origin = "http://127.0.0.1:3000";
let directory: string, store: Store, api: ReturnType<typeof createApi>, now: number;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), "designref-test-")); now = Date.UTC(2026, 9, 25); store = new Store({ directory, now: () => now }); api = createApi(store, origin); });
afterEach(() => { store.close(); const absolute = resolve(directory); if (!absolute.startsWith(resolve(tmpdir()) + "\\designref-test-") && !absolute.startsWith(resolve(tmpdir()) + "/designref-test-")) throw new Error("Unsafe test cleanup"); rmSync(absolute, { recursive: true, force: true }); vi.restoreAllMocks(); });
function call(route: string, method = "GET", cookie = "", data?: unknown, extraHeaders: Record<string, string> = {}) {
  return api(new Request(`${origin}/api/${route}`, { method, headers: { origin, cookie, ...(data instanceof FormData ? {} : data !== undefined ? { "Content-Type": "application/json" } : {}), ...extraHeaders }, ...(data !== undefined ? { body: data instanceof FormData ? data : JSON.stringify(data) } : {}) }), route.split("?")[0].split("/"));
}
async function start() { const response = await call("session", "POST", "", {}); expect(response.status).toBe(201); return response.headers.get("set-cookie")!.split(";")[0]; }
async function upload(cookie: string, type = "image/png", buffer?: Buffer) {
  const data = buffer ?? await sharp({ create: { width: 3, height: 3, channels: 3, background: "#6543b7" } }).png().toBuffer();
  const form = new FormData(); form.set("file", new File([new Uint8Array(data)], "../../untrusted.png", { type })); form.set("metadata", JSON.stringify({ kind: "image", title: "Imagem" }));
  return call("references/upload", "POST", cookie, form);
}
describe("real API + SQLite + disk", () => {
  it("creates a nonpersistent HTTP-only cookie and persists project changes across database reopen", async () => {
    const response = await call("session", "POST", "", {}), header = response.headers.get("set-cookie")!;
    expect(header).toContain("HttpOnly"); expect(header).toContain("SameSite=Lax"); expect(header).not.toMatch(/Expires=|Max-Age=/);
    const cookie = header.split(";")[0]; expect((await call("project", "PATCH", cookie, { name: "Projeto real" })).status).toBe(200);
    store.close(); store = new Store({ directory, now: () => now }); api = createApi(store, origin);
    expect((await (await call("project", "GET", cookie)).json()).project.name).toBe("Projeto real");
    const token = cookie.split("=")[1]; expect(JSON.stringify(store.db.prepare("SELECT * FROM sessions").all())).not.toContain(token);
  });
  it("CRUDs notes/code/URLs without fetching submitted targets and filters real content", async () => {
    const cookie = await start(), fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network expected"));
    const url = await call("references", "POST", cookie, { kind: "url", title: "URL", sourceUrl: "http://127.0.0.1:1/private" }); expect(url.status).toBe(201); expect(fetchSpy).not.toHaveBeenCalled();
    const created = await (await call("references", "POST", cookie, { kind: "note", title: "Ideia", description: "Navegação", keep: ["Contraste"] })).json();
    const edit = await call(`references/${created.id}`, "PATCH", cookie, { kind: "note", title: "Editada", description: "Navegação", componentTags: ["menu"], industry: "Educação", priority: "high" }); expect(edit.status).toBe(200);
    expect((await (await call("references?q=navegacao&tag=menu&industry=Educa%C3%A7%C3%A3o&priority=high", "GET", cookie)).json())).toHaveLength(1);
    const code = "<script>globalThis.hacked=true</script>";
    expect((await (await call("references", "POST", cookie, { kind: "code", title: "Code", codeText: code })).json()).codeText).toBe(code);
    expect((await call(`references/${created.id}`, "DELETE", cookie)).status).toBe(200); expect((await call(`references/${created.id}`, "GET", cookie)).status).toBe(404);
  });
  it("enforces session ownership for read/edit/delete/image/export/decisions", async () => {
    const a = await start(), b = await start();
    const ref = await (await upload(a)).json();
    for (const method of ["GET", "PATCH", "DELETE"]) expect((await call(`references/${ref.id}`, method, b, method === "PATCH" ? { kind: "image", title: "Intrusion" } : undefined)).status).toBe(404);
    expect((await call(`uploads/${ref.id}`, "GET", b)).status).toBe(404);
    expect((await call("decisions", "POST", b, { kind: "preference", value: "intrusion", referenceId: ref.id })).status).toBe(404);
    const exported = await (await call("export", "GET", b)).json(); expect(exported.references).toEqual([]);
    expect((await call("export")).status).toBe(401);
  });
  it("saves partial briefs, selects and clears presets, exports attribution and missing information", async () => {
    const cookie = await start();
    expect((await call("brief", "PUT", cookie, { goal: "Reservas", selectedPresetId: "restaurant" })).status).toBe(200);
    await call("references", "POST", cookie, { kind: "url", title: "Fonte", sourceUrl: "https://example.com", source: "Autor original", avoid: ["Movimento"] });
    await call("decisions", "POST", cookie, { kind: "decision", value: "Priorizar reservas", rationale: "Objetivo" });
    const handoff = await (await call("export?format=json", "GET", cookie)).json(); expect(handoff.selectedPreset.id).toBe("restaurant"); expect(handoff.missingInformation).toContain("Público"); expect(handoff.references[0].attribution.origin).toBe("Autor original"); expect(handoff.decisions).toHaveLength(1);
    expect(await (await call("export?format=md", "GET", cookie)).text()).toContain("Priorizar reservas");
    await call("brief", "PUT", cookie, { selectedPresetId: "" }); expect((await (await call("brief", "GET", cookie)).json()).selectedPresetId).toBe("");
  });
  it.each(["png", "jpeg", "webp"])("uploads and privately serves a valid %s, then removes metadata and the real file", async format => {
    const cookie = await start(); const buffer = await sharp({ create: { width: 3, height: 3, channels: 3, background: "red" } }).toFormat(format as "png" | "jpeg" | "webp").toBuffer();
    const response = await upload(cookie, `image/${format}`, buffer); expect(response.status).toBe(201); const ref = await response.json();
    const image = await call(`uploads/${ref.id}`, "GET", cookie); expect(image.status).toBe(200); expect(image.headers.get("cache-control")).toContain("no-store"); expect(readdirSync(join(directory, "uploads"))).toHaveLength(1);
    expect((await (await call(`references/${ref.id}`, "DELETE", cookie)).json()).deletion).toBe("complete"); expect(readdirSync(join(directory, "uploads"))).toHaveLength(0);
  });
  it("rejects disguised SVG, corrupt PNG, mismatched MIME, oversized files and excessive quota", async () => {
    const cookie = await start();
    expect((await upload(cookie, "image/png", Buffer.from("<svg><script>alert(1)</script></svg>"))).status).toBe(415);
    expect((await upload(cookie, "image/jpeg")).status).toBe(415);
    const corrupt = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(20)]); expect((await upload(cookie, "image/png", corrupt)).status).toBe(415);
    expect((await upload(cookie, "image/png", Buffer.alloc(10 * 1024 * 1024 + 1))).status).toBe(413);
    const existing = await (await upload(cookie)).json(); store.db.prepare("UPDATE blobs SET size=? WHERE key=?").run(50 * 1024 * 1024, existing.storageKey);
    expect((await upload(cookie)).status).toBe(413);
  });
  it("denies expired sessions immediately and cleans rows and blobs later", async () => {
    const cookie = await start(); await upload(cookie); now += 24 * 3600000;
    expect((await call("project", "GET", cookie)).status).toBe(401);
    expect((store.db.prepare("SELECT count(*) AS n FROM sessions").get() as { n: number }).n).toBe(1);
    expect(store.cleanup()).toMatchObject({ expiredSessions: 1, deleted: 1, pending: 0 }); expect(readdirSync(join(directory, "uploads"))).toEqual([]);
  });
  it("never extends an active session past the absolute maximum", async () => {
    const cookie = await start(); for (let i = 0; i < 7; i++) { now += 23 * 3600000; expect((await call("session", "GET", cookie)).status).toBe(200); } now += 7 * 3600000;
    expect((await call("project", "GET", cookie)).status).toBe(401);
  });
  it("end-session revokes a copied token and removes all managed resources", async () => {
    const cookie = await start(); const ref = await (await upload(cookie)).json(); const response = await call("session", "DELETE", cookie); expect(response.headers.get("set-cookie")).toContain("Max-Age=0"); expect((await response.json()).deletion).toBe("complete");
    expect((await call(`uploads/${ref.id}`, "GET", cookie)).status).toBe(401); expect((await call("project", "GET", cookie)).status).toBe(401); expect(readdirSync(join(directory, "uploads"))).toEqual([]);
    for (const table of ["sessions", "projects", "refs", "briefs", "decisions", "blobs"]) expect((store.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n).toBe(0);
  });
  it("keeps durable deletion retries and reports pending accurately after a storage failure", async () => {
    const cookie = await start(); await upload(cookie); const deletion = vi.spyOn(store.storage, "delete").mockImplementation(() => { throw new Error("Disk temporarily unavailable"); });
    expect((await (await call("session", "DELETE", cookie)).json()).deletion).toBe("pending"); expect((await call("project", "GET", cookie)).status).toBe(401);
    deletion.mockRestore(); expect(store.cleanup()).toMatchObject({ deleted: 1, pending: 0 }); expect(readdirSync(join(directory, "uploads"))).toEqual([]);
  });
  it("recovers interrupted uploads without touching a recent active upload", () => {
    const created = store.createSession(); const key = "12345678-1234-1234-1234-123456789abc.png";
    store.db.prepare("INSERT INTO blobs VALUES(?,?,?,?,2,?)").run(key, created.session.id, 10, "image/png", now);
    store.storage.put(key, Buffer.from("interrupted")); expect(store.flushDeletions()).toMatchObject({ deleted: 0 });
    now += 3600000; expect(store.cleanup()).toMatchObject({ deleted: 1 });
  });
  it("enforces origin, JSON parsing, request size, schema bounds and rate limits", async () => {
    expect((await call("session", "POST", "", {}, { origin: "https://attacker.example" })).status).toBe(403);
    expect((await call("session", "POST", "", {}, { origin: "" })).status).toBe(403);
    const cookie = await start(); expect((await call("references", "POST", cookie, { kind: "note", title: "" })).status).toBe(422);
    expect((await call("brief", "PUT", cookie, { unknown: "x" })).status).toBe(422);
    expect((await call("project", "PATCH", cookie, { name: "x".repeat(140000) })).status).toBe(413);
    const malformed = await api(new Request(`${origin}/api/project`, { method: "PATCH", headers: { origin, cookie, "Content-Type": "application/json" }, body: "{" }), ["project"]); expect(malformed.status).toBe(400);
    const sessionId = store.resolveSession(cookie.split("=")[1])!.id; store.rateLimit(`write:${sessionId}`, 120, 60000); store.db.prepare("UPDATE rate_limits SET count=120 WHERE key=?").run(`write:${sessionId}`);
    expect((await call("project", "PATCH", cookie, { name: "Too fast" })).status).toBe(429);
  });
  it("adds Secure over HTTPS and denies arbitrary filesystem keys", async () => {
    const httpsApi = createApi(store, "https://designref.example"); const response = await httpsApi(new Request("https://designref.example/api/session", { method: "POST", headers: { origin: "https://designref.example", "Content-Type": "application/json" }, body: "{}" }), ["session"]);
    expect(response.headers.get("set-cookie")).toContain("Secure"); expect(() => new DiskImageStorage(join(directory, "uploads")).read("../../secret")).toThrow(); expect(COOKIE_NAME).toBe("designref_session");
  });
});

import { describe, expect, it } from "vitest";
import { briefSchema, filterReferences, isExpired, isWebUrl, nextExpiry, presetSchema, referenceInputSchema, type Reference, type Workspace } from "../packages/core";
import { presets } from "../packages/presets";
import { createHandoff, escapeMarkdown, exportMarkdown } from "../packages/exporters";
import { detectImage } from "../packages/persistence/storage";

const makeReference = (input: Record<string, unknown> = {}): Reference => ({ ...referenceInputSchema.parse({ kind: "note", title: "Navegação acessível", description: "Uma ideia", ...input }), id: "d08ee970-4b55-4adf-9b4b-29f040b9bdaf", projectId: "project", createdAt: "2026-10-25T00:00:00.000Z", updatedAt: "2026-10-25T00:00:00.000Z" });
const workspace: Workspace = { session: { createdAt: "2026-10-25T00:00:00.000Z", lastSeenAt: "2026-10-25T00:00:00.000Z", expiresAt: "2026-10-26T00:00:00.000Z", absoluteExpiresAt: "2026-11-01T00:00:00.000Z", idleHours: 24, maxHours: 168 }, project: { id: "project", name: "Meu <projeto>", createdAt: "2026-10-25T00:00:00.000Z", updatedAt: "2026-10-25T00:00:00.000Z" }, references: [], decisions: [], brief: briefSchema.parse({}) };
describe("runtime domain validation", () => {
  it.each(["javascript:alert(1)", "file:///etc/passwd", "ftp://example.com", "https://name:password@example.com", "invalid"])("rejects unsafe URL %s", sourceUrl => {
    expect(isWebUrl(sourceUrl)).toBe(false);
    expect(referenceInputSchema.safeParse({ kind: "url", title: "Test", sourceUrl }).success).toBe(false);
  });
  it("accepts HTTP localhost as metadata, without performing a fetch", () => { expect(isWebUrl("http://127.0.0.1:1234/private")).toBe(true); });
  it.each([{ kind: "url" }, { kind: "code", codeText: "  " }, { kind: "note" }, { kind: "note", description: "ok", storageKey: "../../x" }])("requires kind-specific content and rejects storage handles", input => {
    expect(referenceInputSchema.safeParse({ title: "Test", ...input }).success).toBe(false);
  });
  it("preserves inert code exactly", () => { const codeText = "  <script>alert(1)</script>\n"; expect(referenceInputSchema.parse({ kind: "code", title: "Snippet", codeText }).codeText).toBe(codeText); });
  it("caps item lengths and list counts", () => { expect(referenceInputSchema.safeParse({ kind: "note", title: "Title", description: "ok", keep: Array(31).fill("x") }).success).toBe(false); });
  it("allows unknown brief fields to remain empty and rejects unknown presets", () => { expect(briefSchema.parse({}).goal).toBe(""); expect(briefSchema.safeParse({ selectedPresetId: "fake" }).success).toBe(false); });
  it("validates five distinct contextual presets with accessibility and responsive guidance", () => { expect(presets).toHaveLength(5); expect(new Set(presets.map(item => item.id)).size).toBe(5); presets.forEach(item => expect(presetSchema.safeParse(item).success).toBe(true)); });
});
describe("search and expiration", () => {
  it("searches accents, notes, and tags; combines filters", () => {
    const ref = makeReference({ industry: "Educação", visualTags: ["editorial"], componentTags: ["menu"], notes: "contraste" });
    expect(filterReferences([ref], { q: "navegacao", industry: "Educação", tag: "menu", kind: "note" })).toEqual([ref]);
    expect(filterReferences([ref], { q: "CONTRASTE" })).toHaveLength(1);
    expect(filterReferences([ref], { tag: "editorial", priority: "high" })).toHaveLength(0);
  });
  it("caps sliding expiration at the absolute maximum, including the exact boundary", () => {
    expect(nextExpiry(0, 167 * 3600000, 24, 168)).toBe(168 * 3600000);
    expect(isExpired(100, 100)).toBe(true); expect(isExpired(100, 99)).toBe(false);
  });
});
describe("handoff serialization", () => {
  it("explicitly marks missing data without inventing content", () => { const result = createHandoff(workspace, presets, "fixed"); expect(result.missingInformation).toContain("Objetivo"); expect(result.brief.goal).toBe(""); expect(result.selectedPreset).toBeNull(); expect(result.exportedAt).toBe("fixed"); });
  it("includes provenance, keep/avoid, decisions and explicit preferences, but no storage paths or cookie", () => {
    const ref = makeReference({ kind: "image", source: "Autor", sourceUrl: "https://example.com", keep: ["Legibilidade"], avoid: ["Animação"] }); ref.storageKey = "private-file.png";
    const result = createHandoff({ ...workspace, references: [ref], brief: briefSchema.parse({ selectedPresetId: "portfolio" }), decisions: [{ id: "decision", projectId: "project", kind: "preference", value: "Tipografia legível", rationale: "Leitura", createdAt: "today" }] }, presets);
    expect(JSON.stringify(result)).not.toContain("private-file"); expect(result.references[0].attribution.origin).toBe("Autor"); expect(result.preferences).toHaveLength(1); expect(result.referencePreferences[0].keep).toEqual(["Legibilidade"]); expect(result.selectedPreset?.version).toBe(1);
    expect(exportMarkdown(result)).toContain("Legibilidade"); expect(exportMarkdown(result)).toContain("Tipografia legível");
  });
  it("escapes user HTML and Markdown structures; code stays an indented literal block", () => { expect(escapeMarkdown("<img src=x>\n# title")).toContain("&lt;img"); const md = exportMarkdown(createHandoff({ ...workspace, references: [makeReference({ kind: "code", codeText: "</code><script>alert(1)</script>\n# hello" })] }, presets)); expect(md).toContain("    </code><script>"); expect(md).not.toContain("\n# hello"); expect(md).toContain("&lt;projeto&gt;"); });
  it("rejects mislabeled signatures and SVG", () => { expect(detectImage(Buffer.from("<svg></svg>"))).toBeNull(); expect(detectImage(Buffer.from([137,80,78,71]))).toBeNull(); });
});

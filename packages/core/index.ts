import { z } from "zod";

export const kinds = ["url", "image", "code", "note"] as const;
export const priorities = ["low", "medium", "high"] as const;
export const presetIds = ["restaurant", "agency", "ecommerce", "portfolio", "saas-dashboard"] as const;
const text = (max: number) => z.string().trim().max(max);
const list = z.array(text(160).min(1)).max(30).default([]);
export function isWebUrl(value: string): boolean {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export const referenceInputSchema = z.object({
  kind: z.enum(kinds),
  title: text(140).min(1, "Informe um título."),
  source: text(500).default(""),
  sourceUrl: text(2048).default(""),
  codeText: z.string().max(20000).default(""),
  description: text(6000).default(""),
  notes: text(6000).default(""),
  industry: text(80).default(""),
  componentTags: list,
  visualTags: list,
  keep: list,
  avoid: list,
  priority: z.enum(priorities).default("medium")
}).strict().superRefine((value, ctx) => {
  if ((value.kind === "url" || value.sourceUrl) && !isWebUrl(value.sourceUrl))
    ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Use uma URL http:// ou https:// sem credenciais." });
  if (value.kind === "code" && !value.codeText.trim())
    ctx.addIssue({ code: "custom", path: ["codeText"], message: "Adicione o trecho de código." });
  if (value.kind === "note" && !value.description)
    ctx.addIssue({ code: "custom", path: ["description"], message: "Descreva sua ideia." });
});
export type ReferenceInput = z.infer<typeof referenceInputSchema>;
export type Reference = ReferenceInput & { id: string; projectId: string; storageKey?: string; mimeType?: string; size?: number; createdAt: string; updatedAt: string };
export const briefSchema = z.object({
  industry: text(120).default(""), projectType: text(160).default(""),
  goal: text(4000).default(""), audience: text(2000).default(""),
  clientRequests: list, developerIdeas: list, technologyStack: list, constraints: list,
  interventionScope: z.enum(["", "new", "partial", "full"]).default(""),
  selectedPresetId: z.union([z.enum(presetIds), z.literal("")]).default("")
}).strict();
export type Brief = z.infer<typeof briefSchema>;
export const projectSchema = z.object({ name: text(100).min(1, "Informe o nome do projeto.") }).strict();
export const decisionSchema = z.object({
  kind: z.enum(["decision", "preference"]), value: text(2000).min(1),
  rationale: text(2000).default(""), referenceId: z.string().uuid().optional()
}).strict();
export type DecisionInput = z.infer<typeof decisionSchema>;
export type Decision = DecisionInput & { id: string; projectId: string; createdAt: string };
export type Project = { id: string; name: string; createdAt: string; updatedAt: string };
export type SessionInfo = { createdAt: string; lastSeenAt: string; expiresAt: string; absoluteExpiresAt: string; idleHours: number; maxHours: number };
export type Workspace = { session: SessionInfo; project: Project; references: Reference[]; brief: Brief; decisions: Decision[] };

export const presetSchema = z.object({
  id: z.enum(presetIds), version: z.literal(1), label: z.string().min(1), industry: z.string().min(1),
  summary: z.string().min(1), suggestedComponents: z.array(z.string()).min(1),
  visualGuidance: z.array(z.string()).min(1), accessibilityChecks: z.array(z.string()).min(1),
  responsiveConsiderations: z.array(z.string()).min(1)
});
export type Preset = z.infer<typeof presetSchema>;
export function nextExpiry(created: number, now: number, idleHours: number, maxHours: number) {
  return Math.min(now + idleHours * 3600000, created + maxHours * 3600000);
}
export function isExpired(expiresAt: number, now: number) { return now >= expiresAt; }
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export type ReferenceFilter = { q?: string; kind?: string; industry?: string; tag?: string; priority?: string };
export function filterReferences(references: Reference[], filter: ReferenceFilter) {
  const query = normalized(filter.q ?? "");
  return references.filter(ref =>
    (!filter.kind || ref.kind === filter.kind) && (!filter.industry || ref.industry === filter.industry) &&
    (!filter.priority || ref.priority === filter.priority) &&
    (!filter.tag || [...ref.componentTags, ...ref.visualTags].includes(filter.tag)) &&
    (!query || normalized([ref.title, ref.description, ref.notes, ref.source, ref.sourceUrl, ref.industry, ref.codeText, ...ref.keep, ...ref.avoid, ...ref.componentTags, ...ref.visualTags].join(" ")).includes(query))
  );
}
export class DomainError extends Error {
  constructor(public status: number, message: string, public code = "invalid_request") { super(message); }
}

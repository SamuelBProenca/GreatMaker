import type { Preset, Workspace } from "../core";

const briefLabels = {
  industry: "Setor", projectType: "Tipo de projeto", goal: "Objetivo", audience: "Público",
  clientRequests: "Pedidos do cliente", developerIdeas: "Ideias do desenvolvedor", technologyStack: "Tecnologias",
  constraints: "Restrições", interventionScope: "Escopo", selectedPresetId: "Preset"
} as const;
const scopeLabels = { new: "Novo design", partial: "Redesign parcial", full: "Redesign completo", "": "Não informado" };
// Markdown downloads are plain text. Escape raw HTML and Markdown structure to keep user input inert in common renderers.
export function escapeMarkdown(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1").replace(/\r?\n/g, "\n    ");
}
export function createHandoff(workspace: Workspace, presets: Preset[], exportedAt = new Date().toISOString()) {
  const selectedPreset = presets.find(preset => preset.id === workspace.brief.selectedPresetId) ?? null;
  const missing: string[] = Object.entries(workspace.brief)
    .filter(([, value]) => Array.isArray(value) ? value.length === 0 : !value)
    .map(([field]) => briefLabels[field as keyof typeof briefLabels]);
  if (!workspace.references.length) missing.push("Referências");
  const references = workspace.references.map(ref => {
    const { storageKey, ...reference } = ref;
    void storageKey;
    return ({
    ...reference,
    ...(reference.kind === "image" ? { asset: { included: false, note: "Arquivo disponível apenas durante a sessão ativa; não incorporado ao handoff." } } : {}),
    attribution: { origin: reference.source || null, url: reference.sourceUrl || null }
  }); });
  return {
    schemaVersion: "designref.handoff.v1", exportedAt, project: workspace.project,
    brief: workspace.brief, selectedPreset, references,
    decisions: workspace.decisions.filter(entry => entry.kind === "decision"),
    preferences: workspace.decisions.filter(entry => entry.kind === "preference"),
    referencePreferences: workspace.references.map(ref => ({ referenceId: ref.id, keep: ref.keep, avoid: ref.avoid, priority: ref.priority })),
    missingInformation: missing,
    limitations: ["URLs não foram visitadas ou analisadas automaticamente.", "Imagens não estão incorporadas ao export; guarde seus originais.", "Nenhuma direção visual foi gerada ou aprovada no M1.", "Preferências são explícitas e limitadas à sessão atual."],
    retention: { expiresAt: workspace.session.expiresAt, absoluteExpiresAt: workspace.session.absoluteExpiresAt, idleHours: workspace.session.idleHours, maxHours: workspace.session.maxHours }
  };
}
export function exportMarkdown(handoff: ReturnType<typeof createHandoff>) {
  const e = escapeMarkdown;
  const lines = ["# DesignRef — Handoff", "", `## ${e(handoff.project.name)}`, "", `Exportado em: ${handoff.exportedAt}`, "", "## Brief", ""];
  for (const [key, label] of Object.entries(briefLabels)) {
    const value = handoff.brief[key as keyof typeof briefLabels];
    const display = key === "interventionScope" ? scopeLabels[value as keyof typeof scopeLabels] : Array.isArray(value) ? value.join("; ") : value;
    lines.push(`- **${label}:** ${e(display || "Não informado")}`);
  }
  lines.push("", "## Preset", "", handoff.selectedPreset ? `${e(handoff.selectedPreset.label)} (v${handoff.selectedPreset.version}) — ${e(handoff.selectedPreset.summary)}` : "Nenhum preset selecionado.");
  if (handoff.selectedPreset) for (const [label, values] of [
    ["Componentes", handoff.selectedPreset.suggestedComponents], ["Orientação visual", handoff.selectedPreset.visualGuidance],
    ["Acessibilidade", handoff.selectedPreset.accessibilityChecks], ["Responsividade", handoff.selectedPreset.responsiveConsiderations]
  ] as const) { lines.push("", `### ${label}`, ...values.map(value => `- ${e(value)}`)); }
  lines.push("", "## Referências");
  if (!handoff.references.length) lines.push("", "Nenhuma referência adicionada.");
  for (const ref of handoff.references) {
    lines.push("", `### ${e(ref.title)}`, `- ID: ${ref.id}`, `- Tipo: ${ref.kind}`, `- Importância: ${ref.priority}`,
      `- Origem: ${e(ref.source || "Não informada")}`, `- URL: ${e(ref.sourceUrl || "Não informada")}`,
      `- Setor: ${e(ref.industry || "Não informado")}`, `- Descrição: ${e(ref.description || "Não informada")}`,
      `- Notas: ${e(ref.notes || "Não informadas")}`, `- Manter: ${e(ref.keep.join("; ") || "Não informado")}`,
      `- Evitar: ${e(ref.avoid.join("; ") || "Não informado")}`, `- Componentes: ${e(ref.componentTags.join(", ") || "Não informado")}`,
      `- Linguagem visual: ${e(ref.visualTags.join(", ") || "Não informada")}`);
    if (ref.codeText) lines.push("", "Trecho de código (texto inerte):", "", ...ref.codeText.split(/\r?\n/).map(line => `    ${line.replace(/\r/g, "")}`));
    if (ref.kind === "image") lines.push("- Imagem: arquivo não incorporado; guarde o original.");
  }
  for (const [label, entries] of [["Decisões", handoff.decisions], ["Preferências explícitas", handoff.preferences]] as const) {
    lines.push("", `## ${label}`, "");
    if (!entries.length) lines.push("Nenhuma registrada.");
    for (const entry of entries) lines.push(`- ${e(entry.value)}${entry.rationale ? ` — Motivo: ${e(entry.rationale)}` : ""}${entry.referenceId ? ` (referência: ${entry.referenceId})` : ""}`);
  }
  lines.push("", "## Informações ausentes", "", ...handoff.missingInformation.map(value => `- ${value}`), "", "## Limites e retenção", "", ...handoff.limitations.map(value => `- ${value}`), `- Acesso expira em: ${handoff.retention.expiresAt}. Limite absoluto: ${handoff.retention.absoluteExpiresAt}.`, "");
  return lines.join("\n");
}

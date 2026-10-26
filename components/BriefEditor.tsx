"use client";
import { useState, type FormEvent } from "react";
import { briefSchema, type Brief, type Decision, type DecisionInput, type Reference } from "@/packages/core";
import { Icon, Notice, splitLines, splitTags } from "./ui";
import s from "./workspace.module.css";

export function BriefEditor({ brief, decisions, references, onSave, onAddDecision, onDeleteDecision }: { brief: Brief; decisions: Decision[]; references: Reference[]; onSave: (data: Brief) => Promise<void>; onAddDecision: (data: DecisionInput) => Promise<void>; onDeleteDecision: (id: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSaving(true);
    const form = new FormData(event.currentTarget), v = (key: string) => String(form.get(key) || "");
    const data = briefSchema.safeParse({
      projectType: v("projectType"), industry: v("industry"), goal: v("goal"), audience: v("audience"),
      clientRequests: splitLines(v("clientRequests")), developerIdeas: splitLines(v("developerIdeas")),
      technologyStack: splitTags(v("technologyStack")), constraints: splitLines(v("constraints")),
      interventionScope: v("interventionScope"), selectedPresetId: brief.selectedPresetId
    });
    try {
      if (!data.success) throw new Error("Revise os limites: até 30 itens por lista e 160 caracteres por item.");
      await onSave(data.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <div className={s.briefLayout}><form className={`${s.panel} ${s.form}`} onSubmit={submit}>
    <div className={s.sectionHeading}><span className={s.eyebrow}>01 / CONTEXTO</span><h2>O que estamos construindo?</h2><p>Preencha o que você sabe. O restante será marcado como não informado no handoff.</p></div>
    <div className={s.twoColumns}><label>Tipo de projeto<input name="projectType" defaultValue={brief.projectType} maxLength={160} placeholder="Ex.: Site institucional"/></label><label>Setor<input name="industry" defaultValue={brief.industry} maxLength={120} placeholder="Ex.: Alimentação"/></label></div>
    <label>Objetivo do negócio<textarea name="goal" defaultValue={brief.goal} maxLength={4000} placeholder="Que resultado o projeto precisa apoiar?"/></label>
    <label>Público<input name="audience" defaultValue={brief.audience} maxLength={2000} placeholder="Para quem estamos projetando?"/></label>
    <label>Escopo<select name="interventionScope" defaultValue={brief.interventionScope}><option value="">Ainda não definido</option><option value="new">Novo design</option><option value="partial">Redesign parcial</option><option value="full">Redesign completo</option></select></label>
    <div className={s.formDivider}/><div className={s.sectionHeading}><span className={s.eyebrow}>02 / INTENÇÕES E LIMITES</span><h2>O que precisa orientar as escolhas?</h2></div>
    <label>Pedidos do cliente<textarea name="clientRequests" defaultValue={brief.clientRequests.join("\n")} maxLength={4800} placeholder="Um pedido por linha"/></label>
    <label>Ideias do desenvolvedor<textarea name="developerIdeas" defaultValue={brief.developerIdeas.join("\n")} maxLength={4800} placeholder="Uma ideia por linha"/></label>
    <label>Tecnologias<input name="technologyStack" defaultValue={brief.technologyStack.join(", ")} maxLength={4800} placeholder="React, CSS Modules, PostgreSQL"/><small>Separe com vírgulas.</small></label>
    <label>Restrições<textarea name="constraints" defaultValue={brief.constraints.join("\n")} maxLength={4800} placeholder="Prazo, acessibilidade, conteúdo ou recursos. Uma por linha."/></label>
    {error && <Notice error>{error}</Notice>}
    <div className={s.formActions}><button className={s.primaryButton} disabled={saving}>{saving ? "Salvando…" : "Salvar brief"}<Icon name="check" size={17}/></button></div>
  </form><aside className={s.sideNotes}><div className={s.tipCard}><Icon name="spark"/><h3>Contexto antes da forma.</h3><p>Um brief incompleto já ajuda a fazer perguntas melhores. Você pode voltar a ele a qualquer momento.</p><small>Não inventamos respostas para preencher lacunas.</small></div>
    <DecisionEditor decisions={decisions} references={references} onAdd={onAddDecision} onDelete={onDeleteDecision}/>
  </aside></div>;
}
function DecisionEditor({ decisions, references, onAdd, onDelete }: { decisions: Decision[]; references: Reference[]; onAdd: (data: DecisionInput) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const element = event.currentTarget, data = new FormData(element);
    setBusy(true); setError("");
    try { await onAdd({ kind: data.get("kind") as DecisionInput["kind"], value: String(data.get("value")), rationale: String(data.get("rationale") || ""), ...(data.get("referenceId") ? { referenceId: String(data.get("referenceId")) } : {}) }); element.reset(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar."); }
    finally { setBusy(false); }
  }
  return <section className={s.decisionPanel}><h3>Decisões e preferências</h3><p className={s.muted}>Registre escolhas explícitas e seus motivos. Elas acompanham o handoff desta sessão.</p>
    {decisions.map(entry => <article className={s.decision} key={entry.id}><span className={s.eyebrow}>{entry.kind === "decision" ? "DECISÃO" : "PREFERÊNCIA"}</span><p>{entry.value}</p>{entry.rationale && <small>{entry.rationale}</small>}{entry.referenceId && <small>Referência: {references.find(ref => ref.id === entry.referenceId)?.title}</small>}<button className={s.textButton} disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(entry.id); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }} aria-label={`Excluir registro: ${entry.value}`}>Excluir</button></article>)}
    <form onSubmit={submit} className={s.form}><label>Tipo de registro<select name="kind"><option value="decision">Decisão</option><option value="preference">Preferência</option></select></label><label>Escolha ou preferência<textarea name="value" maxLength={2000} required placeholder="Ex.: Priorizar leitura em vez de animações."/></label><label>Motivo<input name="rationale" maxLength={2000} placeholder="Por que essa escolha?"/></label><label>Referência relacionada<select name="referenceId"><option value="">Sem referência específica</option>{references.map(ref => <option value={ref.id} key={ref.id}>{ref.title}</option>)}</select></label>{error && <Notice error>{error}</Notice>}<button className={s.secondaryButton} disabled={busy}>Registrar escolha</button></form>
  </section>;
}

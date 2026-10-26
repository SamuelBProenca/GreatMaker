"use client";
import { useState, type FormEvent } from "react";
import { kinds, referenceInputSchema, type Reference, type ReferenceInput } from "@/packages/core";
import { Icon, Modal, Notice, splitLines, splitTags } from "./ui";
import s from "./workspace.module.css";

export const kindNames = { url: "Link", image: "Imagem", code: "Código", note: "Ideia" };
export const priorityNames = { low: "Baixa", medium: "Média", high: "Alta" };
export function ReferenceForm({ reference, onClose, onSave }: { reference?: Reference; onClose: () => void; onSave: (data: ReferenceInput, file?: File) => Promise<void> }) {
  const [kind, setKind] = useState<ReferenceInput["kind"]>(reference?.kind ?? "url");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || "");
    const data = referenceInputSchema.safeParse({
      kind, title: value("title"), source: value("source"), sourceUrl: value("sourceUrl"),
      codeText: value("codeText"), description: value("description"), notes: value("notes"), industry: value("industry"),
      priority: value("priority"), componentTags: splitTags(value("componentTags")), visualTags: splitTags(value("visualTags")),
      keep: splitLines(value("keep")), avoid: splitLines(value("avoid"))
    });
    if (!data.success) { setError(data.error.issues.map(issue => issue.message).join(" ")); return; }
    const file = form.get("file");
    if (kind === "image" && !reference && (!(file instanceof File) || !file.size)) { setError("Selecione uma imagem."); return; }
    if (file instanceof File && file.size > 10 * 1024 * 1024) { setError("A imagem deve ter até 10 MB."); return; }
    setSaving(true);
    try { await onSave(data.data, file instanceof File && file.size ? file : undefined); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <Modal title={reference ? "Editar referência" : "Adicionar referência"} onClose={onClose} wide>
    <form onSubmit={submit} className={s.form}>
      {!reference && <fieldset className={s.kindPicker}><legend>Tipo de referência</legend><div className={s.kindOptions}>{kinds.map(item => <label key={item} className={kind === item ? s.kindSelected : ""}><input type="radio" name="kind" checked={kind === item} onChange={() => setKind(item)}/><Icon name={item === "url" ? "link" : item}/>{kindNames[item]}</label>)}</div></fieldset>}
      <label>Título<input name="title" defaultValue={reference?.title} maxLength={140} required placeholder="O que chamou sua atenção?" autoFocus/></label>
      {kind === "url" && <><label>URL<input name="sourceUrl" type="url" defaultValue={reference?.sourceUrl} maxLength={2048} required placeholder="https://exemplo.com"/></label><p className={s.fieldHelp}>O link será salvo como referência. A página não será visitada ou analisada automaticamente.</p></>}
      {kind === "image" && !reference && <label>Imagem<input name="file" type="file" accept="image/png,image/jpeg,image/webp" required/><small>PNG, JPEG ou WebP estático. Até 10 MB e 40 megapixels; 50 MB por sessão.</small></label>}
      {kind === "code" && <label>Trecho de código<textarea name="codeText" defaultValue={reference?.codeText} required maxLength={20000} className={s.codeInput} placeholder="Cole o trecho aqui. Ele será exibido como texto e nunca executado." rows={6}/></label>}
      <label>{kind === "note" ? "Sua ideia" : "Descrição"}<textarea name="description" defaultValue={reference?.description} required={kind === "note"} maxLength={6000} placeholder="Descreva o contexto e por que isso é relevante."/></label>
      <div className={s.twoColumns}><label>Origem / autoria<input name="source" defaultValue={reference?.source} maxLength={500} placeholder="Ex.: Estúdio, autor ou projeto original"/></label><label>Importância<select name="priority" defaultValue={reference?.priority || "medium"}>{Object.entries(priorityNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {kind !== "url" && <label>URL da fonte (opcional)<input name="sourceUrl" type="url" defaultValue={reference?.sourceUrl} maxLength={2048} placeholder="https://fonte-original.com"/></label>}
      <div className={s.twoColumns}><label className={s.keepLabel}>O que manter<textarea name="keep" defaultValue={reference?.keep.join("\n")} placeholder="Uma característica por linha" maxLength={4800}/></label><label className={s.avoidLabel}>O que evitar<textarea name="avoid" defaultValue={reference?.avoid.join("\n")} placeholder="Uma característica por linha" maxLength={4800}/></label></div>
      <details className={s.details}><summary>Tags, setor e notas adicionais</summary><div className={s.form}>
        <label>Setor<input name="industry" defaultValue={reference?.industry} maxLength={80} placeholder="Ex.: Educação"/></label>
        <div className={s.twoColumns}><label>Tags de componentes<input name="componentTags" defaultValue={reference?.componentTags.join(", ")} maxLength={4800} placeholder="menu, formulário, card"/><small>Separe com vírgulas.</small></label><label>Tags visuais<input name="visualTags" defaultValue={reference?.visualTags.join(", ")} maxLength={4800} placeholder="editorial, minimalista"/><small>Separe com vírgulas.</small></label></div>
        <label>Notas<textarea name="notes" defaultValue={reference?.notes} maxLength={6000}/></label>
      </div></details>
      {error && <Notice error>{error}</Notice>}
      <div className={s.formActions}><button type="button" className={s.secondaryButton} onClick={onClose}>Cancelar</button><button className={s.primaryButton} disabled={saving}>{saving ? "Salvando…" : reference ? "Salvar alterações" : "Salvar referência"}<Icon name="check" size={17}/></button></div>
    </form>
  </Modal>;
}

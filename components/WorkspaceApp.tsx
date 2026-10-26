"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { filterReferences, type Brief, type DecisionInput, type Reference, type ReferenceInput, type Workspace } from "@/packages/core";
import { presets } from "@/packages/presets";
import { createHandoff } from "@/packages/exporters";
import { ReferenceForm, kindNames, priorityNames } from "./ReferenceForm";
import { BriefEditor } from "./BriefEditor";
import { Icon, Modal, Notice } from "./ui";
import s from "./workspace.module.css";

type Tab = "library" | "brief" | "presets" | "export";
const tabs: { id: Tab; title: string; icon: string; step: string }[] = [
  { id: "library", title: "Biblioteca", icon: "library", step: "01" },
  { id: "brief", title: "Brief do projeto", icon: "brief", step: "02" },
  { id: "presets", title: "Presets", icon: "preset", step: "03" },
  { id: "export", title: "Handoff", icon: "export", step: "04" }
];
const tabCopy: Record<Tab, { eyebrow: string; title: string; description: string }> = {
  library: { eyebrow: "OBSERVE. SELECIONE. EXPLIQUE.", title: "Referências com intenção.", description: "Reúna o que inspira. Registre o que faz sentido para o seu projeto." },
  brief: { eyebrow: "DÊ CONTEXTO ÀS SUAS ESCOLHAS", title: "Um ponto de partida claro.", description: "Objetivos, pessoas e limites que vão orientar o design." },
  presets: { eyebrow: "UM GUIA, NÃO UMA FÓRMULA", title: "Encontre um contexto.", description: "Cinco pontos de partida para pensar a estrutura. A linguagem visual continua aberta." },
  export: { eyebrow: "DO REPERTÓRIO À PRÓXIMA ETAPA", title: "Leve o contexto junto.", description: "Revise o que foi registrado e exporte um handoff para a implementação." }
};
class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, { ...options, credentials: "same-origin", cache: "no-store", headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new ApiError("Resposta inesperada. Tente novamente.", response.status); }
  if (!response.ok) throw new ApiError(`${data.error || "Não foi possível concluir a ação."}${data.issues ? ` ${data.issues.slice(0, 3).map((issue: { message: string }) => issue.message).join(" ")}` : ""}`, response.status);
  return data as T;
}
export function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("library"), [notice, setNotice] = useState(""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [editor, setEditor] = useState<Reference | "new" | null>(null), [detail, setDetail] = useState<Reference | null>(null);
  const [confirmation, setConfirmation] = useState<Reference | "session" | null>(null), [rename, setRename] = useState(false);
  const expire = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { setWorkspace(null); setEditor(null); setDetail(null); setConfirmation(null); setRename(false); setError(cause.message); }
  }, []);
  useEffect(() => {
    let active = true;
    request<Workspace>("project").then(data => { if (active) setWorkspace(data); }).catch(cause => { if (active && cause.status !== 401) setError(cause.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function reload() { setWorkspace(await request<Workspace>("project")); }
  async function change(path: string, method: string, data?: unknown, message = "Alterações salvas.") {
    setNotice(""); setError("");
    try { await request(path, { method, ...(data === undefined ? {} : { body: data instanceof FormData ? data : JSON.stringify(data) }) }); await reload(); setNotice(message); }
    catch (cause) { expire(cause); throw cause; }
  }
  async function start() {
    setBusy(true); setError(""); setNotice("");
    try { setWorkspace(await request<Workspace>("session", { method: "POST", body: "{}" })); setTab("library"); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  async function saveReference(data: ReferenceInput, file?: File) {
    if (editor && editor !== "new") await change(`references/${editor.id}`, "PATCH", data, "Referência atualizada.");
    else if (file) { const form = new FormData(); form.set("metadata", JSON.stringify(data)); form.set("file", file); await change("references/upload", "POST", form, "Imagem adicionada à biblioteca."); }
    else await change("references", "POST", data, "Referência adicionada à biblioteca.");
  }
  async function confirmDelete() {
    if (!confirmation) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request<{ deletion: string }>(confirmation === "session" ? "session" : `references/${confirmation.id}`, { method: "DELETE" });
      if (confirmation === "session") { setWorkspace(null); setTab("library"); setNotice(result.deletion === "pending" ? "Sessão encerrada e acesso revogado. Há arquivos aguardando remoção; a limpeza precisa ser executada novamente." : "Sessão excluída. Os dados e arquivos gerenciados foram removidos."); }
      else { await reload(); setNotice(result.deletion === "pending" ? "Referência excluída. A imagem está aguardando nova tentativa de remoção." : "Referência e arquivo associado excluídos."); }
      setConfirmation(null);
    } catch (cause) { expire(cause); setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  const copy = tabCopy[tab];
  return <><a href="#main-content" className="skipLink">Pular para o conteúdo</a>
    <header className={s.topbar}><Link href="/" className={s.brand} aria-label="DesignRef, início"><span className={s.brandMark}><Icon name="spark" size={22}/></span>DesignRef<span className={s.beta}>M1</span></Link><div className={s.topActions}><span className={s.anonymous}><span/>{workspace ? "Sessão temporária" : "Seu repertório, com contexto"}</span>{workspace && <button className={s.endButton} onClick={() => setConfirmation("session")}><Icon name="close" size={15}/>Excluir sessão</button>}</div></header>
    {loading ? <main id="main-content" className={s.loading}><Icon name="spark" size={30}/><p role="status">Preparando seu espaço…</p></main> : !workspace ? <main id="main-content" className={s.landing}>
      {(error || notice) && <Notice error={!!error}>{error || notice}</Notice>}
      <div className={s.landingGrid}><div><span className={s.eyebrow}>DO OLHAR À INTENÇÃO</span><h1>Boas referências.<br/>Escolhas <em>mais claras.</em></h1><p className={s.landingLead}>Um espaço para organizar inspirações, entender o que aproveitar e levar contexto para o seu próximo projeto.</p><button className={s.primaryButton} onClick={start} disabled={busy}>{busy ? "Criando sessão…" : "Começar meu projeto"}<Icon name="arrow"/></button><p className={s.startNote}>Sem cadastro. Uma sessão, um projeto.</p></div>
        <div className={s.conceptBoard} aria-label="O processo: reunir referências, registrar intenções e preparar um handoff"><div className={s.boardLabel}>O SEU PROCESSO, COM CONTEXTO</div><div className={s.conceptCard}><span className={s.conceptNumber}>01</span><Icon name="library"/><h2>Reunir</h2><p>Links, imagens, trechos de código e ideias.</p></div><div className={`${s.conceptCard} ${s.conceptPurple}`}><span className={s.conceptNumber}>02</span><Icon name="brief"/><h2>Entender</h2><p>O que manter?<br/>O que evitar?<br/>Para quem estamos criando?</p></div><div className={`${s.conceptCard} ${s.conceptSmall}`}><Icon name="export"/><div><h2>Levar adiante</h2><p>Um handoff com as escolhas e suas fontes.</p></div></div><span className={s.boardFoot}>REFERÊNCIA → INTENÇÃO → CONTEXTO</span></div>
      </div><section className={s.retentionLanding}><Icon name="clock" size={24}/><div><h2>Um espaço temporário. Você controla a saída.</h2><p>Seus dados ficam no servidor durante a sessão. O padrão é expirar após 24 horas sem interação, com limite de 7 dias. Fechar a aba não garante a exclusão. Use <strong>Excluir sessão</strong> para remover os dados e arquivos gerenciados. Exporte antes de sair.</p><small>Sem análise automática de páginas, rastreadores ou envio de referências para IA.</small></div></section>
    </main> : <div className={s.appLayout}>
      <aside className={s.sidebar}><div className={s.projectBlock}><span className={s.eyebrow}>PROJETO ATUAL</span><button onClick={() => setRename(true)} className={s.projectName} aria-label={`Renomear projeto: ${workspace.project.name}`}><span>{workspace.project.name}</span><Icon name="edit" size={15}/></button><span className={s.projectMeta}>{workspace.references.length} referência{workspace.references.length !== 1 ? "s" : ""} · privado nesta sessão</span></div>
      <nav className={s.navigation} aria-label="Etapas do projeto">{tabs.map(item => <button key={item.id} className={tab === item.id ? s.navActive : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setError(""); setNotice(""); }}><Icon name={item.icon}/><span>{item.title}</span><small aria-hidden="true">{item.step}</small></button>)}</nav>
      <div className={s.sidebarFoot}><Icon name="clock" size={19}/><strong>Temporário por escolha.</strong><p>{workspace.session.idleHours}h sem interação · limite de {workspace.session.maxHours}h.</p><p>Fechar a aba não exclui os dados. Exporte e use “Excluir sessão” ao terminar.</p><small>Acesso até <time dateTime={workspace.session.expiresAt}>{new Date(workspace.session.expiresAt).toLocaleString("pt-BR")}</time>, renovado ao interagir.</small></div></aside>
      <main id="main-content" className={s.main} tabIndex={-1}>
        <div className={s.breadcrumb}>Meu espaço <span>/</span> {tabs.find(item => item.id === tab)?.title}</div>
        <div className={s.pageHeading}><div><span className={s.eyebrow}>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>{tab === "library" && <button className={s.primaryButton} onClick={() => setEditor("new")}><Icon name="plus" size={18}/>Adicionar referência</button>}</div>
        <p className={s.mobileRetention}>Sessão temporária: {workspace.session.idleHours}h sem interação, limite de {workspace.session.maxHours}h. Fechar a aba não exclui os dados. Exporte e use “Excluir sessão” ao terminar.</p>
        {(error || notice) && <Notice error={!!error}>{error || notice}</Notice>}
        {tab === "library" && <Library references={workspace.references} onAdd={() => setEditor("new")} onOpen={setDetail} onEdit={setEditor} onDelete={setConfirmation}/>}
        {tab === "brief" && <BriefEditor key={workspace.project.id} brief={workspace.brief} references={workspace.references} decisions={workspace.decisions} onSave={(data: Brief) => change("brief", "PUT", data, "Brief salvo. Você pode continuar depois.")} onAddDecision={(data: DecisionInput) => change("decisions", "POST", data, "Escolha registrada.")} onDeleteDecision={id => change(`decisions/${id}`, "DELETE", undefined, "Registro excluído.")}/>}
        {tab === "presets" && <PresetBrowser selected={workspace.brief.selectedPresetId} onSelect={id => change("brief", "PUT", { ...workspace.brief, selectedPresetId: id }, id ? "Preset selecionado." : "Preset removido.")}/>}
        {tab === "export" && <Handoff workspace={workspace} onExpired={expire}/>}
        <footer className={s.mainFooter}><span>DesignRef <span className={s.footerDot}>·</span> Referências com intenção.</span><span>Seu contexto antes do código.</span></footer>
      </main>
    </div>}
    {editor && <ReferenceForm reference={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={saveReference}/>}
    {detail && <ReferenceDetail reference={detail} onClose={() => setDetail(null)} onEdit={() => { setEditor(detail); setDetail(null); }}/ >}
    {rename && workspace && <RenameModal name={workspace.project.name} onClose={() => setRename(false)} onSave={name => change("project", "PATCH", { name }, "Nome do projeto atualizado.")}/>}
    {confirmation && <Modal title={confirmation === "session" ? "Excluir esta sessão?" : "Excluir referência?"} onClose={() => !busy && setConfirmation(null)}><div className={s.form}><p>{confirmation === "session" ? "O projeto, o brief, as escolhas e as imagens gerenciadas serão excluídos. Exporte seu handoff antes de continuar. Essa ação não pode ser desfeita." : `“${confirmation.title}” e sua imagem gerenciada, se houver, serão removidos. Essa ação não pode ser desfeita.`}</p>{error && <Notice error>{error}</Notice>}<div className={s.formActions}><button className={s.secondaryButton} disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</button><button className={s.dangerButton} disabled={busy} onClick={confirmDelete}>{busy ? "Excluindo…" : confirmation === "session" ? "Excluir sessão e dados" : "Confirmar exclusão"}</button></div></div></Modal>}
  </>;
}
function Library({ references, onAdd, onOpen, onEdit, onDelete }: { references: Reference[]; onAdd: () => void; onOpen: (ref: Reference) => void; onEdit: (ref: Reference) => void; onDelete: (ref: Reference) => void }) {
  const [query, setQuery] = useState(""), [kind, setKind] = useState(""), [industry, setIndustry] = useState(""), [tag, setTag] = useState(""), [priority, setPriority] = useState("");
  const filtered = useMemo(() => filterReferences(references, { q: query, kind, industry, tag, priority }), [references, query, kind, industry, tag, priority]);
  const industries = [...new Set(references.map(ref => ref.industry).filter(Boolean))].sort();
  const tags = [...new Set(references.flatMap(ref => [...ref.componentTags, ...ref.visualTags]))].sort();
  const filtersActive = query || kind || industry || tag || priority;
  return <><div className={s.libraryIntro}><div><span className={s.introIcon}><Icon name="library" size={23}/></span><div><strong>Um repertório que explica suas escolhas.</strong><p>Uma boa referência vem com um motivo. Anote o que manter e o que evitar.</p></div></div><span className={s.countBadge}>{references.length} / 300 referências</span></div>
    <div className={s.filterBar}><label className={s.searchField}><span className="srOnly">Buscar referências</span><Icon name="search" size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no seu repertório…" type="search"/></label><label><span className="srOnly">Filtrar por tipo</span><select value={kind} onChange={event => setKind(event.target.value)}><option value="">Todos os tipos</option>{Object.entries(kindNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span className="srOnly">Filtrar por setor</span><select value={industry} onChange={event => setIndustry(event.target.value)}><option value="">Todos os setores</option>{industries.map(value => <option key={value}>{value}</option>)}</select></label><label><span className="srOnly">Filtrar por tag</span><select value={tag} onChange={event => setTag(event.target.value)}><option value="">Todas as tags</option>{tags.map(value => <option key={value}>{value}</option>)}</select></label><label><span className="srOnly">Filtrar por importância</span><select value={priority} onChange={event => setPriority(event.target.value)}><option value="">Importância</option>{Object.entries(priorityNames).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    <div className={s.listHeading}><h2>Sua biblioteca <span>{filtered.length}</span></h2>{filtersActive ? <button className={s.textButton} onClick={() => { setQuery(""); setKind(""); setIndustry(""); setTag(""); setPriority(""); }}>Limpar filtros</button> : <span>Organizada pela adição mais recente</span>}</div>
    {!filtered.length ? <div className={s.emptyState}><span className={s.emptyIcon}><Icon name={references.length ? "search" : "plus"} size={28}/></span><h3>{references.length ? "Nenhuma referência com esses filtros." : "O primeiro olhar fica por sua conta."}</h3><p>{references.length ? "Tente outro termo ou limpe os filtros para ver sua biblioteca." : "Comece com um link, uma imagem, um trecho de código ou uma ideia. O contexto pode vir depois."}</p>{!references.length && <button className={s.secondaryButton} onClick={onAdd}>Adicionar primeira referência<Icon name="arrow" size={17}/></button>}</div> : <div className={s.referenceGrid}>{filtered.map(ref => <ReferenceCard key={ref.id} reference={ref} onOpen={() => onOpen(ref)} onEdit={() => onEdit(ref)} onDelete={() => onDelete(ref)}/>)}</div>}
    <p className={s.privacyLine}><Icon name="link" size={15}/>Links são salvos como metadados. Páginas externas não são visitadas ou analisadas automaticamente.</p>
  </>;
}
function ReferenceCard({ reference: ref, onOpen, onEdit, onDelete }: { reference: Reference; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return <article className={s.referenceCard}><button className={`${s.cardPreview} ${s[`preview_${ref.kind}`]}`} onClick={onOpen} aria-label={`Ver referência: ${ref.title}`}>
    {ref.kind === "image" ? <ProtectedImage reference={ref}/> : ref.kind === "code" ? <pre>{ref.codeText.slice(0, 350)}</pre> : ref.kind === "note" ? <><span className={s.noteQuote}>“</span><p>{ref.description.slice(0, 180)}</p></> : <><Icon name="link" size={28}/><span>{new URL(ref.sourceUrl).hostname}</span><small>Link de referência<Icon name="arrow" size={14}/></small></>}
    <span className={s.kindBadge}><Icon name={ref.kind === "url" ? "link" : ref.kind} size={13}/>{kindNames[ref.kind]}</span>
  </button><div className={s.cardBody}><div className={s.cardTitle}><h3><button onClick={onOpen}>{ref.title}</button></h3><span className={`${s.priorityBadge} ${ref.priority === "high" ? s.priorityHigh : ""}`}>{priorityNames[ref.priority]}</span></div><p className={s.cardSource}>{ref.source || (ref.sourceUrl ? new URL(ref.sourceUrl).hostname : "Origem não informada")}</p>
    {(ref.keep.length > 0 || ref.avoid.length > 0) ? <div className={s.learnings}>{ref.keep[0] && <p><span className={s.keepDot}>+</span><span>{ref.keep[0]}</span></p>}{ref.avoid[0] && <p><span className={s.avoidDot}>−</span><span>{ref.avoid[0]}</span></p>}</div> : <p className={s.cardHint}>Que ideia você quer levar desta referência?</p>}
    <div className={s.tagRow}>{[...ref.componentTags, ...ref.visualTags].slice(0, 4).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}{ref.componentTags.length + ref.visualTags.length > 4 && <span>+{ref.componentTags.length + ref.visualTags.length - 4}</span>}</div>
  </div><div className={s.cardActions}>{ref.sourceUrl ? <a href={ref.sourceUrl} target="_blank" rel="noreferrer">Ver fonte<Icon name="arrow" size={13}/></a> : <span>{ref.industry || kindNames[ref.kind]}</span>}<div><button className={s.iconButton} onClick={onEdit} aria-label={`Editar: ${ref.title}`}><Icon name="edit" size={16}/></button><button className={s.iconButton} onClick={onDelete} aria-label={`Excluir: ${ref.title}`}><Icon name="trash" size={16}/></button></div></div></article>;
}
function ProtectedImage({ reference }: { reference: Reference }) {
  const [failed, setFailed] = useState(false);
  // Protected session images must bypass Next's public image optimizer and cache.
  // eslint-disable-next-line @next/next/no-img-element
  return failed ? <span className={s.imageError}>Imagem indisponível. Envie o arquivo novamente.</span> : <img src={`/api/uploads/${reference.id}`} alt={reference.description || reference.title} loading="lazy" onError={() => setFailed(true)}/>;
}
function ReferenceDetail({ reference: ref, onClose, onEdit }: { reference: Reference; onClose: () => void; onEdit: () => void }) {
  return <Modal title={ref.title} onClose={onClose} wide><div className={s.form}><div className={s.detailMeta}><span>{kindNames[ref.kind]} · Importância {priorityNames[ref.priority].toLowerCase()}</span><button className={s.secondaryButton} onClick={onEdit}><Icon name="edit" size={16}/>Editar referência</button></div>{ref.kind === "image" && <div className={s.detailImage}><ProtectedImage reference={ref}/></div>}{ref.kind === "code" && <pre className={s.fullCode}><code>{ref.codeText}</code></pre>}{ref.description && <p className={s.preserveText}>{ref.description}</p>}<div className={s.twoColumns}><section><h3 className={s.keepLabel}>O que manter</h3>{ref.keep.length ? <ul>{ref.keep.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p className={s.muted}>Não informado.</p>}</section><section><h3 className={s.avoidLabel}>O que evitar</h3>{ref.avoid.length ? <ul>{ref.avoid.map((value, i) => <li key={i}>{value}</li>)}</ul> : <p className={s.muted}>Não informado.</p>}</section></div><dl className={s.detailList}><dt>Origem</dt><dd>{ref.source || "Não informada"}</dd><dt>Setor</dt><dd>{ref.industry || "Não informado"}</dd><dt>Componentes</dt><dd>{ref.componentTags.join(", ") || "Não informados"}</dd><dt>Linguagem visual</dt><dd>{ref.visualTags.join(", ") || "Não informada"}</dd></dl>{ref.notes && <section><h3>Notas</h3><p className={s.preserveText}>{ref.notes}</p></section>}{ref.sourceUrl && <a href={ref.sourceUrl} target="_blank" rel="noreferrer" className={s.breakWord}>{ref.sourceUrl} ↗</a>}<small>Adicionada em {new Date(ref.createdAt).toLocaleString("pt-BR")}.</small></div></Modal>;
}
function RenameModal({ name, onClose, onSave }: { name: string; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true);
    try { await onSave(String(data.get("name"))); onClose(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="Nome do projeto" onClose={onClose}><form onSubmit={submit} className={s.form}><label>Nome<input name="name" defaultValue={name} required maxLength={100} autoFocus/></label>{error && <Notice error>{error}</Notice>}<button className={s.primaryButton} disabled={busy}>{busy ? "Salvando…" : "Salvar nome"}</button></form></Modal>;
}
function PresetBrowser({ selected, onSelect }: { selected: string; onSelect: (id: string) => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function select(id: string) { setBusy(true); setError(""); try { await onSelect(id); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }
  return <>{error && <Notice error>{error}</Notice>}<div className={s.presetNotice}><Icon name="spark"/><p>Um setor pode ter muitas expressões visuais. Escolha um contexto para guiar perguntas, componentes e cuidados.</p><button className={s.textButton} disabled={busy || !selected} onClick={() => select("")}>{selected ? "Continuar sem preset" : "Sem preset selecionado"}</button></div><div className={s.presetGrid}>{presets.map((preset, index) => <article className={`${s.presetCard} ${selected === preset.id ? s.presetSelected : ""}`} key={preset.id}><div className={s.presetTop}><span className={s.presetNumber}>0{index + 1}</span><span className={s.eyebrow}>{preset.industry}</span>{selected === preset.id && <span className={s.selectedBadge}><Icon name="check" size={14}/>Selecionado</span>}</div><h2>{preset.label}</h2><p>{preset.summary}</p><div className={s.tagRow}>{preset.suggestedComponents.map(component => <span key={component}>{component}</span>)}</div><details className={s.presetDetails}><summary>Estrutura, acessibilidade e responsividade</summary><h3>Orientação visual e layout</h3><ul>{preset.visualGuidance.map(value => <li key={value}>{value}</li>)}</ul><h3>Acessibilidade</h3><ul>{preset.accessibilityChecks.map(value => <li key={value}>{value}</li>)}</ul><h3>Em telas menores</h3><ul>{preset.responsiveConsiderations.map(value => <li key={value}>{value}</li>)}</ul></details><button className={selected === preset.id ? s.secondaryButton : s.primaryButton} disabled={busy || selected === preset.id} onClick={() => select(preset.id)}>{selected === preset.id ? "Preset selecionado" : "Usar este contexto"}<Icon name={selected === preset.id ? "check" : "arrow"} size={17}/></button></article>)}</div></>;
}
function Handoff({ workspace, onExpired }: { workspace: Workspace; onExpired: (cause: unknown) => void }) {
  const handoff = useMemo(() => createHandoff(workspace, presets), [workspace]);
  const [format, setFormat] = useState<"summary" | "json">("summary"), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function download(format: "json" | "md") {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/export?format=${format}&download=1`, { cache: "no-store" });
      if (!response.ok) { const data = await response.json(); throw new ApiError(data.error || "Não foi possível exportar.", response.status); }
      const blob = await response.blob(); if (!blob.size) throw new Error("Exportação vazia. Tente novamente.");
      if (format === "json") { const check = JSON.parse(await blob.text()); if (check.schemaVersion !== "designref.handoff.v1") throw new Error("Exportação inválida. Tente novamente."); }
      const url = URL.createObjectURL(blob), anchor = document.createElement("a"); anchor.href = url; anchor.download = `designref-handoff.${format}`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { onExpired(cause); setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <div className={s.handoffLayout}><section className={s.handoffPreview}><div className={s.previewToolbar}><h2>Prévia do handoff</h2><div><button aria-pressed={format === "summary"} onClick={() => setFormat("summary")}>Resumo</button><button aria-pressed={format === "json"} onClick={() => setFormat("json")}>JSON</button></div></div>{format === "json" ? <pre className={s.jsonPreview}>{JSON.stringify(handoff, null, 2)}</pre> : <div className={s.handoffDocument}><span className={s.eyebrow}>DESIGNREF / HANDOFF v1</span><h2>{workspace.project.name}</h2><p>{workspace.brief.goal || "Objetivo ainda não informado."}</p><hr/><h3>Brief do projeto</h3><dl className={s.detailList}><dt>Tipo / setor</dt><dd>{workspace.brief.projectType || "Não informado"} / {workspace.brief.industry || "Não informado"}</dd><dt>Público</dt><dd>{workspace.brief.audience || "Não informado"}</dd><dt>Escopo</dt><dd>{{ new: "Novo design", partial: "Redesign parcial", full: "Redesign completo", "": "Não informado" }[workspace.brief.interventionScope]}</dd><dt>Tecnologias</dt><dd>{workspace.brief.technologyStack.join(", ") || "Não informadas"}</dd><dt>Preset</dt><dd>{handoff.selectedPreset?.label || "Sem preset"}</dd></dl>{[["Pedidos do cliente", workspace.brief.clientRequests], ["Ideias do desenvolvedor", workspace.brief.developerIdeas], ["Restrições", workspace.brief.constraints]] .map(([label, values]) => <section key={label as string}><h4>{label}</h4>{(values as string[]).length ? <ul>{(values as string[]).map((value, i) => <li key={i}>{value}</li>)}</ul> : <p className={s.muted}>Não informados.</p>}</section>)}<h3>Referências ({workspace.references.length})</h3>{workspace.references.map(ref => <article className={s.exportReference} key={ref.id}><strong>{ref.title}</strong><small>{kindNames[ref.kind]} · Importância {priorityNames[ref.priority].toLowerCase()} · {ref.source || "Origem não informada"}</small>{ref.sourceUrl && <a href={ref.sourceUrl} target="_blank" rel="noreferrer">{ref.sourceUrl}</a>}{ref.description && <p>{ref.description}</p>}<p><strong>Manter:</strong> {ref.keep.join("; ") || "Não informado"}<br/><strong>Evitar:</strong> {ref.avoid.join("; ") || "Não informado"}</p></article>)}{!workspace.references.length && <p className={s.muted}>Nenhuma referência adicionada.</p>}<h3>Escolhas explícitas ({workspace.decisions.length})</h3>{workspace.decisions.map(entry => <p key={entry.id}><strong>{entry.kind === "decision" ? "Decisão" : "Preferência"}:</strong> {entry.value}{entry.rationale && ` — ${entry.rationale}`}</p>)}{!workspace.decisions.length && <p className={s.muted}>Nenhuma registrada.</p>}</div>}</section><aside className={s.exportSide}><div className={s.exportCard}><span className={s.exportIcon}><Icon name="export" size={26}/></span><h2>Pronto para levar.</h2><p>O brief, as referências, as fontes e suas escolhas em dois formatos.</p><button className={s.primaryButton} onClick={() => download("json")} disabled={busy}><Icon name="export" size={17}/>Baixar JSON</button><button className={s.secondaryButton} onClick={() => download("md")} disabled={busy}>Baixar Markdown</button>{error && <Notice error>{error}</Notice>}<small>Imagens não são incorporadas. Guarde seus arquivos originais. O JSON permite inspecionar todos os campos.</small></div><div className={s.missingCard}><h3>O que ainda falta saber</h3><p>Lacunas são registradas, sem inventar respostas.</p><ul>{handoff.missingInformation.map(value => <li key={value}>{value}</li>)}</ul>{!handoff.missingInformation.length && <p>Todos os campos do brief estão preenchidos.</p>}</div><p className={s.fieldHelp}>Este handoff registra contexto. Geração de direções visuais e aprovação fazem parte do próximo marco.</p></aside></div>;
}

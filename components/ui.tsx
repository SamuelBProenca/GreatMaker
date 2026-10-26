"use client";
import { useEffect, useRef, type ReactNode } from "react";
import s from "./workspace.module.css";

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    library: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    brief: <><path d="M8 3H5v18h14V3h-3M8 2h8v4H8zM8 11h8M8 16h5"/></>,
    preset: <><path d="m12 3 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
    export: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    link: <><path d="m9 15 6-6M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 10a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-2 2" transform="translate(2 0) scale(.85 1)"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 4 4 4-6 5 8"/></>,
    code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16"/></>,
    note: <><path d="M4 3h16v14l-4 4H4zM16 21v-5h4M8 8h8M8 12h5"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    edit: <><path d="m15 3 6 6-12 12H3v-6L15 3zm-3 3 6 6"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></>,
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.note}</svg>;
}
export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!, previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className={`${s.dialog} ${wide ? s.wideDialog : ""}`} aria-labelledby="dialog-title" onCancel={onClose}>
    <div className={s.dialogHeader}><h2 id="dialog-title">{title}</h2><button type="button" className={s.iconButton} aria-label="Fechar diálogo" onClick={onClose}><Icon name="close"/></button></div>
    {children}
  </dialog>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div className={error ? s.error : s.notice} role={error ? "alert" : "status"}>{children}</div>;
}
export const splitLines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
export const splitTags = (value: string) => value.split(",").map(tag => tag.trim()).filter(Boolean);

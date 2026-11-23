"use client";

import { useEffect, useRef, useState } from "react";

// Folhas que sobem de baixo (estilo app), no lugar de confirm()/prompt().
// Uso: `if (await confirmSheet({...}))` e `const txt = await promptSheet({...})`.

type Base = { title: string; message?: string; confirmLabel?: string; danger?: boolean };
type Req =
  | (Base & { kind: "confirm"; resolve: (v: boolean) => void })
  | (Base & { kind: "prompt"; label?: string; placeholder?: string; resolve: (v: string | null) => void });

let push: ((r: Req) => void) | null = null;

export function confirmSheet(opts: Base): Promise<boolean> {
  return new Promise(resolve => push ? push({ ...opts, kind: "confirm", resolve }) : resolve(window.confirm(opts.title)));
}
export function promptSheet(opts: Base & { label?: string; placeholder?: string }): Promise<string | null> {
  return new Promise(resolve => push ? push({ ...opts, kind: "prompt", resolve }) : resolve(window.prompt(opts.title)));
}

export function SheetHost() {
  const [req, setReq] = useState<Req | null>(null);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    push = r => { setText(""); setReq(r); };
    return () => { push = null; };
  }, []);
  useEffect(() => { if (req?.kind === "prompt") setTimeout(() => inputRef.current?.focus(), 60); }, [req]);
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function close(ok: boolean) {
    if (!req) return;
    if (req.kind === "confirm") req.resolve(ok);
    else req.resolve(ok && text.trim() ? text.trim() : null);
    setReq(null);
  }

  if (!req) return null;
  return <div className="sheet-backdrop" onClick={() => close(false)}>
    <div className="sheet" role="dialog" aria-modal="true" aria-label={req.title} onClick={e => e.stopPropagation()}>
      <div className="sheet-grip"/>
      <h3>{req.title}</h3>
      {req.message && <p>{req.message}</p>}
      {req.kind === "prompt" && <label className="field">{req.label ?? ""}
        <textarea ref={inputRef} rows={3} value={text} placeholder={req.placeholder} onChange={e => setText(e.target.value)}/>
      </label>}
      <div className="sheet-actions">
        <button className={req.danger ? "button danger lg" : "button primary lg"} disabled={req.kind === "prompt" && !text.trim()} onClick={() => close(true)}>
          {req.confirmLabel ?? "Confirmar"}
        </button>
        <button className="button ghost lg" onClick={() => close(false)}>Cancelar</button>
      </div>
    </div>
  </div>;
}

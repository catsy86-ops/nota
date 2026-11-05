import { useState, useEffect, useRef } from "react";
import { Check, X, FolderPlus, LayoutDashboard } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

/** Słowa i ikona przycisku: nowy folder albo zapis bieżącego widoku (nowy plan 6.1). */
const TEXT = {
  folder: { open: "Nowy folder", confirm: "Dodaj folder", cancel: "Anuluj dodawanie folderu", Icon: FolderPlus },
  view: { open: "Zapisz bieżący widok", confirm: "Zapisz widok", cancel: "Anuluj zapis widoku", Icon: LayoutDashboard },
} as const;

export function SidebarAddFolderButton({ onAdd, kind = "folder", disabled }: { onAdd: (name: string) => void; kind?: keyof typeof TEXT; disabled?: boolean }) {
  const t = TEXT[kind];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

  function submit() {
    if (name.trim()) { onAdd(name.trim()); setName(""); setAdding(false); }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-0.5">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setAdding(false); } }}
          className="text-xs bg-muted/60 border border-border rounded-field px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground w-24" placeholder="Nazwa..." />
        <IconButton size="sm" tone="active" onClick={submit} aria-label={t.confirm}><Check className="w-3.5 h-3.5" /></IconButton>
        <IconButton size="sm" onClick={() => { setName(""); setAdding(false); }} aria-label={t.cancel}><X className="w-3.5 h-3.5" /></IconButton>
      </div>
    );
  }

  return (
    <IconButton size="sm" onClick={() => setAdding(true)} aria-label={t.open} title={t.open} disabled={disabled}>
      <t.Icon className="w-3.5 h-3.5" />
    </IconButton>
  );
}

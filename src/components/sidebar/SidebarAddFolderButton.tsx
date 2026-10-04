import { useState, useEffect, useRef } from "react";
import { Check, X, FolderPlus } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

export function SidebarAddFolderButton({ onAdd }: { onAdd: (name: string) => void }) {
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
          className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground w-24" placeholder="Nazwa..." />
        <IconButton size="sm" tone="active" onClick={submit} aria-label="Dodaj folder"><Check className="w-3.5 h-3.5" /></IconButton>
        <IconButton size="sm" onClick={() => { setName(""); setAdding(false); }} aria-label="Anuluj dodawanie folderu"><X className="w-3.5 h-3.5" /></IconButton>
      </div>
    );
  }

  return (
    <IconButton size="sm" onClick={() => setAdding(true)} aria-label="Nowy folder" title="Nowy folder">
      <FolderPlus className="w-3.5 h-3.5" />
    </IconButton>
  );
}

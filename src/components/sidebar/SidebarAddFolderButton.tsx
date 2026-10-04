import { useState, useEffect, useRef } from "react";
import { Check, X, FolderPlus } from "lucide-react";

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
      <div className="flex items-center gap-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setAdding(false); } }}
          className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground w-24" placeholder="Nazwa..." />
        <button onClick={submit} aria-label="Dodaj folder" className="pressable p-0.5 rounded text-primary hover:bg-primary/10"><Check className="w-3 h-3" /></button>
        <button onClick={() => { setName(""); setAdding(false); }} aria-label="Anuluj dodawanie folderu" className="pressable p-0.5 rounded text-muted-foreground hover:bg-muted"><X className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <button onClick={() => setAdding(true)} aria-label="Nowy folder" title="Nowy folder" className="pressable p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
      <FolderPlus className="w-3.5 h-3.5" />
    </button>
  );
}

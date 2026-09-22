import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
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
        <motion.button whileTap={{ scale: 0.9 }} onClick={submit} aria-label="Dodaj folder" className="p-0.5 rounded text-primary hover:bg-primary/10"><Check className="w-3 h-3" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(""); setAdding(false); }} aria-label="Anuluj dodawanie folderu" className="p-0.5 rounded text-muted-foreground hover:bg-muted"><X className="w-3 h-3" /></motion.button>
      </div>
    );
  }

  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAdding(true)} aria-label="Nowy folder" title="Nowy folder" className="p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
      <FolderPlus className="w-3.5 h-3.5" />
    </motion.button>
  );
}

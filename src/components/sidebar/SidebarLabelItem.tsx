import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Tag, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarLabelItem({ label, isActive, onSelect, onRename, onDelete }: {
  label: string; isActive: boolean; onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function save() {
    if (name.trim() && name.trim() !== label) onRename(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(label); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={save} aria-label="Zapisz nazwę etykiety" className="p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(label); setEditing(false); }} aria-label="Anuluj edycję etykiety" className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></motion.button>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ x: 3 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer",
        isActive ? "bg-primary/10 text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
      onClick={onSelect}
      role="button"
      aria-current={isActive ? "page" : undefined}
    >
      <Tag className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setEditing(true); }} aria-label={`Zmień nazwę etykiety ${label}`} className="p-1 rounded-lg hover:bg-foreground/10"><Pencil className="w-3 h-3" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onDelete(); }} aria-label={`Usuń etykietę ${label}`} className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3 h-3" /></motion.button>
      </div>
    </motion.div>
  );
}

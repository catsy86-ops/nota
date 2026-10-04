import { useState, useEffect, useRef } from "react";
import { Tag, Pencil, Trash2, Check, X } from "lucide-react";
import { SidebarRow, SidebarRowMenu } from "@/components/sidebar/SidebarRow";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function SidebarLabelItem({ label, isActive, onSelect, onRename, onDelete }: {
  label: string; isActive: boolean; onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  // Po „Zmień nazwę” fokus zostaje w polu, nie wraca do „⋯”.
  const focusInput = useRef(false);
  const keepInputFocus = (e: Event) => { if (focusInput.current) { e.preventDefault(); focusInput.current = false; } };

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
        <button onClick={save} aria-label="Zapisz nazwę etykiety" className="pressable p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setName(label); setEditing(false); }} aria-label="Anuluj edycję etykiety" className="pressable p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <SidebarRow
      icon={<Tag className="w-3.5 h-3.5" />}
      label={label}
      active={isActive}
      onClick={onSelect}
      actions={
        <SidebarRowMenu label={`etykiety ${label}`} onCloseAutoFocus={keepInputFocus}>
          <DropdownMenuItem onSelect={() => { focusInput.current = true; setEditing(true); }}>
            <Pencil className="w-4 h-4 mr-2" />Zmień nazwę
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />Usuń etykietę
          </DropdownMenuItem>
        </SidebarRowMenu>
      }
    />
  );
}

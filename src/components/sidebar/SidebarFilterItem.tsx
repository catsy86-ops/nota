import { useState, useEffect, useRef } from "react";
import { Bookmark, Pencil, Trash2, Check, X } from "lucide-react";
import { SidebarRow, SidebarRowMenu, SidebarCount } from "@/components/sidebar/SidebarRow";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MAX_FILTER_NAME } from "@/lib/savedFilters";

/** Zapisany filtr w pasku bocznym: nazwa, licznik dopasowanych notatek, zmiana nazwy i usuwanie. */
export function SidebarFilterItem({ name, query, count, isActive, onSelect, onRename, onDelete }: {
  name: string; query: string; count: number; isActive: boolean;
  onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusInput = useRef(false);
  const keepInputFocus = (e: Event) => { if (focusInput.current) { e.preventDefault(); focusInput.current = false; } };

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function save() {
    if (draft.trim() && draft.trim() !== name) onRename(draft);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_FILTER_NAME}
          aria-label="Nazwa filtra"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(name); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0"
        />
        <button onClick={save} aria-label="Zapisz nazwę filtra" className="pressable p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => { setDraft(name); setEditing(false); }} aria-label="Anuluj edycję filtra" className="pressable p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <SidebarRow
      icon={<Bookmark className="w-3.5 h-3.5" />}
      label={name}
      active={isActive}
      onClick={onSelect}
      buttonProps={{ title: query }}
      trailing={<SidebarCount value={count} active={isActive} />}
      actions={
        <SidebarRowMenu label={`filtra ${name}`} onCloseAutoFocus={keepInputFocus}>
          <DropdownMenuItem onSelect={() => { focusInput.current = true; setDraft(name); setEditing(true); }}>
            <Pencil className="w-4 h-4 mr-2" />Zmień nazwę
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />Usuń filtr
          </DropdownMenuItem>
        </SidebarRowMenu>
      }
    />
  );
}

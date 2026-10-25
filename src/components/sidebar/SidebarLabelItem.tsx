import { useState, useEffect, useRef } from "react";
import { Tag, Pencil, Trash, Check, X } from "lucide-react";
import { SidebarRow, SidebarRowMenu } from "@/components/sidebar/SidebarRow";
import { IconButton } from "@/components/ui/icon-button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function SidebarLabelItem({ label, displayName = label, depth = 1, isActive, onSelect, onRename, onDelete }: {
  /** Pełna ścieżka etykiety (`budowa/łazienka`) — po niej filtrujemy i zmieniamy nazwę. */
  label: string;
  /** Ostatni segment, czyli to, co widać w wierszu. */
  displayName?: string;
  /** Głębokość w drzewie: wcięcie 12 px na poziom. */
  depth?: number;
  isActive: boolean; onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
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
      <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: (depth - 1) * 12 + 8 }}>
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(label); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-hidden focus:ring-2 focus:ring-ring text-foreground min-w-0" />
        <IconButton size="sm" tone="active" onClick={save} aria-label="Zapisz nazwę etykiety"><Check className="w-3.5 h-3.5" /></IconButton>
        <IconButton size="sm" onClick={() => { setName(label); setEditing(false); }} aria-label="Anuluj edycję etykiety"><X className="w-3.5 h-3.5" /></IconButton>
      </div>
    );
  }

  return (
    <div style={{ paddingLeft: (depth - 1) * 12 }} title={label}>
    <SidebarRow
      icon={<Tag className="w-3.5 h-3.5" />}
      label={displayName}
      active={isActive}
      onClick={onSelect}
      actions={
        <SidebarRowMenu label={`etykiety ${label}`} onCloseAutoFocus={keepInputFocus}>
          <DropdownMenuItem onSelect={() => { focusInput.current = true; setEditing(true); }}>
            <Pencil className="w-4 h-4 mr-2" />Zmień nazwę
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="text-destructive-ink focus:text-destructive-ink focus:bg-destructive/10">
            <Trash className="w-4 h-4 mr-2" />Usuń etykietę
          </DropdownMenuItem>
        </SidebarRowMenu>
      }
    />
    </div>
  );
}

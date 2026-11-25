import { useState } from "react";
import { Bell, CornerDownRight, Plus, Repeat, Tag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NoteImage } from "@/components/NoteImage";
import { formatReminderShort } from "@/lib/reminderTime";
import type { ReminderRepeat } from "@/lib/reminderRepeat";

/**
 * Części kompozytora nowej notatki (A3.2 cz. 2), wydzielone z `AddNoteBar.tsx`. Stan szkicu zostaje w pasku
 * (`composerReducer`), tu są tylko widoki z wartościami i zdarzeniami w props — szkic się nie przemontowuje.
 */

/** Miniatury obrazów szkicu z przyciskiem usunięcia. */
export function ComposerImages({ images, onRemove }: { images: string[]; onRemove: (index: number) => void }) {
  if (images.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative group/img">
          <NoteImage imageRef={img} className="size-16 object-cover rounded-field" />
          <button
            onClick={() => onRemove(i)}
            aria-label="Usuń obrazek"
            className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover/img:opacity-100 focus-visible:opacity-100 coarse:opacity-100 coarse:p-2 transition-opacity"
          >
            <X className="size-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Wybrane etykiety i termin szkicu; klik usuwa. */
export function ComposerChipsRow({ labels, onToggleLabel, reminder, reminderRepeat, onClearReminder }: {
  labels: string[];
  onToggleLabel: (label: string) => void;
  reminder: number | null;
  reminderRepeat: ReminderRepeat;
  onClearReminder: () => void;
}) {
  return (
    <>
      {labels.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {labels.map((l) => (
            <button key={l} type="button" onClick={() => onToggleLabel(l)} aria-label={`Usuń etykietę ${l}`} className="rounded-control outline-hidden focus-visible:ring-2 focus-visible:ring-ring"><Badge variant="secondary" className="text-2xs cursor-pointer">{l} ×</Badge></button>
          ))}
        </div>
      )}
      {reminder && (
        <div className="flex items-center gap-1 text-xs text-primary-ink">
          <Bell className="size-3.5" />
          {formatReminderShort(reminder)}
          {reminderRepeat !== "none" && <Repeat className="size-3.5" aria-label="Powtarzane" />}
          <button onClick={onClearReminder} aria-label="Usuń przypomnienie" className="ml-1 text-muted-foreground hover:text-foreground coarse:inline-flex coarse:h-11 coarse:w-11 coarse:items-center coarse:justify-center">×</button>
        </div>
      )}
    </>
  );
}

/** Wybór etykiet z listy i dopisanie nowej. W notatce prywatnej tylko istniejące — nazwy etykiet nie są szyfrowane. */
export function ComposerLabelPicker({ allLabels, labels, onToggle, onCreate, isPrivate }: {
  allLabels: string[];
  labels: string[];
  onToggle: (label: string) => void;
  /** Dostaje przyciętą, niepustą nazwę. */
  onCreate: (label: string) => void;
  isPrivate: boolean;
}) {
  const [newLabel, setNewLabel] = useState("");
  const create = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewLabel("");
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size="sm" title="Etykiety" aria-label="Etykiety">
          <Tag className="size-4" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-3" align="start">
        <p className="ui-hint font-semibold font-display">Etykiety</p>
        <div className="flex gap-1 flex-wrap">
          {allLabels.map((l) => (
            <button key={l} type="button" onClick={() => onToggle(l)} aria-pressed={labels.includes(l)} className="rounded-control outline-hidden focus-visible:ring-2 focus-visible:ring-ring"><Badge variant={labels.includes(l) ? "default" : "outline"} className="cursor-pointer text-xs">{l}</Badge></button>
          ))}
        </div>
        {isPrivate ? (
          <p className="text-2xs text-muted-foreground">W notatce prywatnej wybierz istniejącą etykietę. Nazwy nowych etykiet nie są szyfrowane.</p>
        ) : (
          <div className="flex gap-1.5">
            <input enterKeyHint="done" autoComplete="off" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="Nowa etykieta..." className="flex-1 text-xs max-sm:text-base bg-muted/60 border border-border rounded-field px-2.5 py-1.5 outline-hidden focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
            <IconButton size="sm" tone="primary" onClick={create} aria-label="Dodaj etykietę">
              <Plus className="size-3.5" />
            </IconButton>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Podstrona: notatka powstaje pod wybraną. */
export function ComposerParentPicker({ parentId, options, onChange }: {
  parentId: string | null;
  options: { id: string; title: string }[];
  onChange: (id: string | null) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size="sm" tone={parentId ? "active" : "muted"} title="Podstrona w…" aria-label="Podstrona w…">
          <CornerDownRight className="size-4" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2" align="start">
        <p className="ui-hint font-semibold font-display">Podstrona w</p>
        <select
          value={parentId ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Notatka nadrzędna"
          className="w-full rounded-field border border-border bg-muted/60 px-2 py-1.5 text-sm text-foreground outline-hidden focus:ring-2 focus:ring-ring"
        >
          <option value="">Poziom główny</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.title.trim() || "Bez tytułu"}</option>)}
        </select>
      </PopoverContent>
    </Popover>
  );
}

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PROP_LIMITS, PROP_TYPE_LABELS, PROP_TYPES, type PropDef, type PropType } from "@/lib/noteProps";

interface PropDefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defs: PropDef[];
  onAdd: (name: string, type: PropType, options: string[]) => PropDef | null;
  onUpdate: (id: string, updates: { name?: string; options?: string[] }) => boolean;
  onDelete: (id: string) => void;
}

/** Splits the comma-separated options field into a clean list. */
function parseOptions(text: string): string[] {
  return text.split(",").map((o) => o.trim()).filter(Boolean);
}

/**
 * Zarządzanie polami właściwości: dodaj, zmień nazwę lub opcje wyboru, usuń.
 * Usunięcie kasuje też wartości we wszystkich notatkach — dlatego potwierdzenie w linii.
 */
export function PropDefsDialog({ open, onOpenChange, defs, onAdd, onUpdate, onDelete }: PropDefsDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<PropType>("text");
  const [options, setOptions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const add = () => {
    if (!name.trim()) { setError("Podaj nazwę pola."); return; }
    if (defs.length >= PROP_LIMITS.defs) { setError(`Najwyżej ${PROP_LIMITS.defs} pól.`); return; }
    const def = onAdd(name, type, parseOptions(options));
    if (!def) { setError("Pole o tej nazwie już istnieje."); return; }
    setName(""); setOptions(""); setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setError(null); setConfirmId(null); onOpenChange(next); }}>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pola notatek</DialogTitle>
          <DialogDescription>Własne właściwości: tekst, liczba, data albo wybór z listy. Wartości ustawiasz w tabeli.</DialogDescription>
        </DialogHeader>

        {defs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nie ma jeszcze żadnych pól.</p>
        ) : (
          <ul className="space-y-3" aria-label="Istniejące pola">
            {defs.map((def) => (
              <li key={def.id} className="rounded-field border border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    key={def.name}
                    aria-label={`Nazwa pola ${def.name}`}
                    defaultValue={def.name}
                    maxLength={PROP_LIMITS.name}
                    onBlur={(e) => {
                      const next = e.currentTarget.value;
                      if (next.trim() === def.name) return;
                      if (!onUpdate(def.id, { name: next })) { setError("Nie zapisano: nazwa pusta albo zajęta."); e.currentTarget.value = def.name; }
                      else setError(null);
                    }}
                    className="h-9"
                  />
                  <span className="shrink-0 text-2xs uppercase tracking-wider text-muted-foreground">{PROP_TYPE_LABELS[def.type]}</span>
                  {confirmId === def.id ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs">
                      <Button size="sm" variant="destructive" onClick={() => { onDelete(def.id); setConfirmId(null); }}>Usuń</Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>Nie</Button>
                    </span>
                  ) : (
                    <Button size="icon-sm" variant="ghost" aria-label={`Usuń pole ${def.name}`} onClick={() => setConfirmId(def.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
                {confirmId === def.id && (
                  <p className="text-xs text-muted-foreground">Usunąć pole „{def.name}” i jego wartości we wszystkich notatkach?</p>
                )}
                {def.type === "select" && (
                  <Input
                    aria-label={`Opcje pola ${def.name}`}
                    defaultValue={(def.options ?? []).join(", ")}
                    placeholder="Opcje po przecinku"
                    onBlur={(e) => onUpdate(def.id, { options: parseOptions(e.currentTarget.value) })}
                    className="h-9"
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <form
          className="space-y-2 border-t border-border/60 pt-4"
          onSubmit={(e) => { e.preventDefault(); add(); }}
        >
          <p className="text-sm font-medium">Nowe pole</p>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="Nazwa nowego pola"
              value={name}
              maxLength={PROP_LIMITS.name}
              placeholder="np. Klient"
              onChange={(e) => setName(e.target.value)}
              className="h-9 min-w-0 flex-1"
            />
            <select
              aria-label="Typ nowego pola"
              value={type}
              onChange={(e) => setType(e.target.value as PropType)}
              className="h-9 rounded-control border border-input bg-background px-2 text-sm"
            >
              {PROP_TYPES.map((t) => <option key={t} value={t}>{PROP_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          {type === "select" && (
            <Input
              aria-label="Opcje nowego pola"
              value={options}
              placeholder="Opcje po przecinku, np. Nowe, W toku, Gotowe"
              onChange={(e) => setOptions(e.target.value)}
              className="h-9"
            />
          )}
          {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
          <Button type="submit" size="sm">Dodaj pole</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

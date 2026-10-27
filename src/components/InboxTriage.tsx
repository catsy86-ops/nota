import { useEffect, useMemo, useState } from "react";
import { Archive, Clock, RotateCcw, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotesContext } from "@/hooks/NotesProvider";
import type { Note } from "@/hooks/useNotes";
import { isInboxNote } from "@/lib/inbox";
import { cn } from "@/lib/utils";

interface InboxTriageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Skrót 1–9 dotyczy pierwszych dziewięciu chipów: najpierw foldery, potem etykiety. */
const SHORTCUT_COUNT = 9;

type Chip =
  | { kind: "folder"; id: string; label: string }
  | { kind: "label"; label: string };

interface UndoStep {
  /** Cofa jedną akcję (przywraca notatkę do poprzedniego stanu). */
  undo: () => void;
  /** Indeks w kolejce, do którego wraca okno po cofnięciu. */
  index: number;
}

/**
 * Tryb porządkowania Skrzynki: notatka po notatce. Foldery i etykiety przenoszą notatkę z Skrzynki
 * (reguła `isInboxNote`), Archiwizuj i Kosz też, „Zostaw” przechodzi dalej bez zmian. Kolejka jest
 * zamrożona na otwarcie okna, więc notatka znika z ekranu dopiero po własnej akcji.
 */
export function InboxTriage({ open, onOpenChange }: InboxTriageProps) {
  const { notes, folders, allLabels, updateNote, archiveNote, unarchiveNote, trashNote, restoreFromTrash } = useNotesContext();
  // Kolejka zamrożona przy otwarciu: akcja usuwa notatkę z Skrzynki, ale nie zmienia listy pod spodem.
  const [queue, setQueue] = useState<Note[]>([]);
  const [index, setIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoStep[]>([]);

  const chips = useMemo<Chip[]>(() => [
    ...folders.map((f) => ({ kind: "folder" as const, id: f.id, label: f.name })),
    ...allLabels.map((l) => ({ kind: "label" as const, label: l })),
  ], [folders, allLabels]);

  // Kolejka i stos cofania liczone przy każdym otwarciu (rodzic otwiera okno ustawiając `open`).
  useEffect(() => {
    if (!open) return;
    setQueue(notes.filter(isInboxNote));
    setIndex(0);
    setUndoStack([]);
    // Tylko przy otwarciu: zmiany notatek w trakcie porządkowania nie przebudowują kolejki.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = queue[index];
  const done = queue.length > 0 && index >= queue.length;
  const position = Math.min(index + 1, queue.length);

  function advance(undo: () => void) {
    setUndoStack((s) => [...s, { undo, index }]);
    setIndex((i) => i + 1);
  }

  function assignFolder(folderId: string) {
    if (!current) return;
    const id = current.id;
    const prev = { folderId: current.folderId };
    updateNote(id, { folderId });
    advance(() => updateNote(id, prev));
  }

  function addLabel(label: string) {
    if (!current) return;
    const id = current.id;
    const prevLabels = current.labels;
    updateNote(id, { labels: [...prevLabels.filter((l) => l !== label), label] });
    advance(() => updateNote(id, { labels: prevLabels }));
  }

  function archive() {
    if (!current) return;
    const id = current.id;
    archiveNote(id);
    advance(() => unarchiveNote(id));
  }

  function trash() {
    if (!current) return;
    const id = current.id;
    trashNote(id);
    advance(() => restoreFromTrash(id));
  }

  /** S-1 „Odłóż”: notatka znika ze Skrzynki do północy wskazanego dnia; „Cofnij” zdejmuje odłożenie. */
  function snooze(days: number) {
    if (!current) return;
    const id = current.id;
    const prev = current.snoozedUntil ?? 0;
    const until = new Date();
    until.setDate(until.getDate() + days);
    until.setHours(0, 0, 0, 0);
    updateNote(id, { snoozedUntil: until.getTime() });
    advance(() => updateNote(id, { snoozedUntil: prev }));
  }

  function leave() {
    if (!current) return;
    setIndex((i) => i + 1);
  }

  function undo() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    last.undo();
    setUndoStack((s) => s.slice(0, -1));
    setIndex(last.index);
  }

  function chooseChip(chip: Chip) {
    if (chip.kind === "folder") assignFolder(chip.id);
    else addLabel(chip.label);
  }

  // Skróty 1–9 działają tylko w otwartym oknie, a nie w polu tekstowym.
  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= Math.min(SHORTCUT_COUNT, chips.length)) {
      e.preventDefault();
      chooseChip(chips[n - 1]);
    }
  }

  const title = current ? (current.title.trim() || "Bez tytułu") : "";
  const preview = current ? current.content.trim().slice(0, 300) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onKeyDown={onKeyDown} aria-describedby="inbox-triage-desc">
        <DialogHeader>
          <DialogTitle className="font-display">Porządkowanie skrzynki</DialogTitle>
          <DialogDescription id="inbox-triage-desc" className="text-xs tabular-nums">
            {queue.length === 0 ? "Skrzynka jest pusta." : done ? "Gotowe — skrzynka opróżniona." : `${position} z ${queue.length}`}
          </DialogDescription>
        </DialogHeader>

        {current && !done && (
          <div className="space-y-4 pt-2">
            <div className="rounded-card border border-border/60 bg-muted/30 p-3">
              <p className="font-display font-semibold text-base leading-snug wrap-anywhere">{title}</p>
              {preview && <p className="mt-1 line-clamp-6 text-sm text-muted-foreground whitespace-pre-line wrap-anywhere">{preview}</p>}
            </div>

            {chips.length > 0 && (
              <div role="group" aria-label="Przenieś do folderu lub nadaj etykietę" className="flex flex-wrap gap-1.5">
                {chips.map((chip, i) => {
                  const key = chip.kind === "folder" ? `f-${chip.id}` : `l-${chip.label}`;
                  const shortcut = i < SHORTCUT_COUNT ? String(i + 1) : null;
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("coarse:h-11 gap-1.5", chip.kind === "label" && "border-dashed")}
                      onClick={() => chooseChip(chip)}
                      aria-keyshortcuts={shortcut ?? undefined}
                    >
                      {shortcut && <kbd className="font-mono text-2xs text-muted-foreground" aria-hidden>{shortcut}</kbd>}
                      {chip.kind === "label" ? `#${chip.label}` : chip.label}
                    </Button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-3">
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={archive}>
                <Archive className="h-4 w-4" aria-hidden /> Archiwizuj
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5 text-destructive-ink" onClick={trash}>
                <Trash className="h-4 w-4" aria-hidden /> Kosz
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={() => snooze(1)}>
                <Clock className="h-4 w-4" aria-hidden /> Jutro
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={() => snooze(7)}>
                <Clock className="h-4 w-4" aria-hidden /> Za tydzień
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={leave}>
                Zostaw w skrzynce
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5 ml-auto" onClick={undo} disabled={undoStack.length === 0}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Cofnij
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Wszystko, co było w skrzynce, ma już folder, etykietę albo zostało zarchiwizowane.</p>
            {undoStack.length > 0 && (
              <Button type="button" variant="outline" size="sm" className="coarse:h-11 gap-1.5" onClick={undo}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Cofnij ostatnią akcję
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

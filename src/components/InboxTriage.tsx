import { useEffect, useMemo, useState } from "react";
import { Archive, Bell, Clock, PencilLine, Plus, RotateCcw, Trash } from "lucide-react";
import { m } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotesContext } from "@/hooks/NotesProvider";
import type { Note } from "@/hooks/useNotes";
import { isInboxNote, triageHeadline } from "@/lib/inbox";
import { cleanLabelPath } from "@/lib/labelTree";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";
import { filterTriageChips, hasExact, rankTriageChips, triageQuery, TRIAGE_TOP, type TriageChip } from "@/lib/triageChips";
import { QuickReminderInput } from "@/components/QuickReminderInput";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface InboxTriageProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 3.2: „Otwórz notatkę” — zamyka okno i otwiera notatkę w edytorze. */
  onOpenNote?: (id: string) => void;
}


/** Skrót 1–9 dotyczy pierwszych dziewięciu widocznych chipów (najczęściej używane, 3.1). */
const SHORTCUT_COUNT = TRIAGE_TOP;

type Chip = TriageChip;
const chipKey = (c: Chip) => (c.kind === "folder" ? `f-${c.id}` : `l-${c.label}`);

/** Szybkie terminy „Przypomnij…” (3.4): dziś 18:00 (tylko przed 18:00) i jutro 9:00. */
function quickReminders(now: Date): { label: string; at: number }[] {
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  return [
    ...(now.getTime() < evening.getTime() ? [{ label: "Dziś 18:00", at: evening.getTime() }] : []),
    { label: "Jutro 9:00", at: morning.getTime() },
  ];
}

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
export function InboxTriage({ open, onOpenChange, onOpenNote }: InboxTriageProps) {
  const { notes, folders, allLabels, updateNote, archiveNote, unarchiveNote, trashNote, restoreFromTrash, addFolder, addLabel: createLabel } = useNotesContext();
  // Kolejka zamrożona przy otwarciu: akcja usuwa notatkę z Skrzynki, ale nie zmienia listy pod spodem.
  const [queue, setQueue] = useState<Note[]>([]);
  const [index, setIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoStep[]>([]);
  // Przesunięcie karty tylko na dotyku; myszą karta stoi w miejscu (przyciski wystarczają).
  const [coarse] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);

  // 3.1: kolejność wg użycia zamrożona przy otwarciu (skróty 1–9 nie skaczą po każdej akcji);
  // folder albo etykieta dodane w trakcie idą na koniec.
  const [order, setOrder] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const baseChips = useMemo<Chip[]>(() => [
    ...folders.map((f) => ({ kind: "folder" as const, id: f.id, label: f.name })),
    ...allLabels.map((l) => ({ kind: "label" as const, label: l })),
  ], [folders, allLabels]);
  const chips = useMemo(() => [...baseChips].sort((a, b) => (order.get(chipKey(a)) ?? Infinity) - (order.get(chipKey(b)) ?? Infinity)), [baseChips, order]);
  const filtered = useMemo(() => filterTriageChips(chips, query), [chips, query]);
  const q = triageQuery(query);
  const visible = q ? filtered : showAll ? chips : chips.slice(0, TRIAGE_TOP);
  const hidden = q ? 0 : chips.length - visible.length;
  const newFolder = q && !hasExact(chips, q, "folder") ? q : null;
  const cleanQ = q ? cleanLabelPath(q) : "";
  const newLabel = cleanQ && !hasExact(chips, cleanQ, "label") ? cleanQ : null;

  // Kolejka i stos cofania liczone przy każdym otwarciu (rodzic otwiera okno ustawiając `open`).
  useEffect(() => {
    if (!open) return;
    setQueue(notes.filter(isInboxNote));
    setIndex(0);
    setUndoStack([]);
    setOrder(new Map(rankTriageChips(baseChips, notes).map((c, i) => [chipKey(c), i])));
    // Tylko przy otwarciu: zmiany notatek w trakcie porządkowania nie przebudowują kolejki.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const current = queue[index];
  const done = queue.length > 0 && index >= queue.length;
  const position = Math.min(index + 1, queue.length);

  // Filtr i panel terminu dotyczą jednej notatki — przy następnej zaczynamy od czysta.
  useEffect(() => {
    setQuery("");
    setShowAll(false);
    setReminderOpen(false);
  }, [index]);

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

  function tagLabel(label: string) {
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
    else tagLabel(chip.label);
  }

  /** 3.1: „Nowy folder „…”” — tworzy folder i od razu przenosi do niego notatkę. */
  function chooseNewFolder(name: string) {
    assignFolder(addFolder(name));
  }

  function chooseNewLabel(label: string) {
    createLabel(label);
    tagLabel(label);
  }

  /** 3.4: termin z porządkowania. Notatka z samym terminem zostaje w Skrzynce (reguła `isInboxNote`), kolejka idzie dalej. */
  function remind(at: number) {
    if (!current) return;
    const id = current.id;
    const prev = current.reminder;
    updateNote(id, { reminder: at });
    requestNotificationPermissionOnIntent();
    advance(() => updateNote(id, { reminder: prev }));
  }

  // Skróty 1–9 działają tylko w otwartym oknie, a nie w polu tekstowym.
  function onKeyDown(e: React.KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= Math.min(SHORTCUT_COUNT, visible.length)) {
      e.preventDefault();
      chooseChip(visible[n - 1]);
    }
  }

  const { title, preview } = current ? triageHeadline(current) : { title: "", preview: "" };

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
            <m.div
              className="rounded-card border border-border/60 bg-muted/30 p-3"
              drag={coarse ? "x" : false}
              dragDirectionLock
              dragElastic={0.25}
              dragConstraints={{ left: -160, right: 160 }}
              dragSnapToOrigin
              style={coarse ? { touchAction: "pan-y" } : undefined}
              onDragEnd={(_, info: { offset: { x: number }; velocity: { x: number } }) => {
                // Próg jak przy kaflach: 110 px, a 60 px przy szybkim ruchu. W lewo archiwizuje, w prawo zostawia.
                const threshold = Math.abs(info.velocity.x) > 500 ? 60 : 110;
                if (info.offset.x < -threshold) { haptic("tap"); archive(); }
                else if (info.offset.x > threshold) { haptic("tap"); leave(); }
              }}
            >
              <p className="font-display font-semibold text-base leading-snug wrap-anywhere">{title}</p>
              {preview && <p className="mt-1 line-clamp-6 text-sm text-muted-foreground whitespace-pre-line wrap-anywhere">{preview}</p>}
            </m.div>
            {coarse && <p className="-mt-2 text-xs text-muted-foreground">Przesuń w lewo: archiwizuj. W prawo: zostaw.</p>}

            <div className="space-y-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (q && filtered[0]) chooseChip(filtered[0]);
                  else if (newLabel) chooseNewLabel(newLabel);
                }}
                placeholder="Folder lub etykieta…"
                aria-label="Szukaj folderu lub etykiety"
                className="h-9 w-full rounded-field border border-border bg-background px-3 text-base outline-hidden placeholder:text-muted-foreground focus:ring-2 focus:ring-ring coarse:h-11 sm:text-sm"
              />
              <div role="group" aria-label="Przenieś do folderu lub nadaj etykietę" className="flex flex-wrap gap-1.5">
                {visible.map((chip, i) => {
                  const shortcut = i < SHORTCUT_COUNT ? String(i + 1) : null;
                  return (
                    <Button
                      key={chipKey(chip)}
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
                {hidden > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={() => setShowAll(true)}>
                    Więcej ({hidden})
                  </Button>
                )}
                {newFolder && (
                  <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={() => chooseNewFolder(newFolder)}>
                    <Plus className="h-4 w-4" aria-hidden /> Nowy folder „{newFolder}”
                  </Button>
                )}
                {newLabel && (
                  <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={() => chooseNewLabel(newLabel)}>
                    <Plus className="h-4 w-4" aria-hidden /> Nowa etykieta #{newLabel}
                  </Button>
                )}
              </div>
            </div>

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
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" aria-expanded={reminderOpen} onClick={() => setReminderOpen((o) => !o)}>
                <Bell className="h-4 w-4" aria-hidden /> Przypomnij…
              </Button>
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11" onClick={leave}>
                Zostaw w skrzynce
              </Button>
              {onOpenNote && (
                <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5" onClick={() => { const id = current.id; onOpenChange(false); onOpenNote(id); }}>
                  <PencilLine className="h-4 w-4" aria-hidden /> Otwórz notatkę
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" className="coarse:h-11 gap-1.5 ml-auto" onClick={undo} disabled={undoStack.length === 0}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Cofnij
              </Button>
            </div>
            {reminderOpen && (
              <div role="group" aria-label="Termin przypomnienia" className="space-y-2 rounded-card border border-border/60 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {quickReminders(new Date()).map((r) => (
                    <Button key={r.label} type="button" variant="outline" size="sm" className="coarse:h-11" onClick={() => remind(r.at)}>{r.label}</Button>
                  ))}
                </div>
                <QuickReminderInput onParsed={(d) => remind(d.getTime())} />
                <p className="text-xs text-muted-foreground">Notatka z terminem zostaje w Skrzynce, dopóki nie dostanie folderu albo etykiety.</p>
              </div>
            )}
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

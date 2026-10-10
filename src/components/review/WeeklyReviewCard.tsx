import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, BellRing, ExternalLink, FolderInput, ListChecks, Pin, PinOff, Sparkles } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { Folder, Note } from "@/hooks/useNotes";
import { toastWithUndo } from "@/lib/undoToast";
import { pushAction } from "@/lib/actionHistory";
import { dayDoneReward } from "@/lib/celebrate";
import { pluralPl } from "@/lib/plural";
import { cn } from "@/lib/utils";
import {
  buildWeeklyReview, closeReviewCycle, dueCycleKey, reviewQueue, snoozeReview, useReviewState,
  type ReviewCategory, type ReviewCategoryKey,
} from "@/lib/weeklyReview";
import type { WalkthroughSummary } from "./ReviewWalkthrough";

const ReviewWalkthrough = lazy(() => import("./ReviewWalkthrough"));

export interface WeeklyReviewActions {
  notes: Note[];
  folders: Folder[];
  onOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  /** Archiwizacja z potwierdzeniem i „Cofnij” (istniejący callback z `useNoteActions`). */
  onArchive: (id: string) => void;
  onMoveToFolder: (id: string, folderId: string | null) => void;
  /** Surowe akcje dla trybu „po kolei” (bez dodatkowego dialogu potwierdzenia). */
  archiveNote: (id: string) => void;
  unarchiveNote: (id: string) => void;
  trashNote: (id: string) => void;
  restoreFromTrash: (id: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ICONS: Record<ReviewCategoryKey, typeof BellRing> = {
  overdue: BellRing,
  openLists: ListChecks,
  stale: Archive,
  unsorted: FolderInput,
};

function detail(key: ReviewCategoryKey, n: Note): string {
  if (key === "overdue" && n.reminder !== null) {
    return `termin: ${new Date(n.reminder).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}`;
  }
  const days = Math.max(0, Math.floor((Date.now() - n.updatedAt) / DAY_MS));
  if (key === "openLists") {
    const open = (n.checklist ?? []).filter((i) => !i.checked).length;
    return `${open} ${pluralPl(open, ["pozycja", "pozycje", "pozycji"])} do zrobienia${days > 0 ? ` · ${days} ${pluralPl(days, ["dzień", "dni", "dni"])} bez zmian` : ""}`;
  }
  if (key === "unsorted") return days === 0 ? "bez folderu i etykiet · dziś" : `bez folderu i etykiet · ${days} ${pluralPl(days, ["dzień", "dni", "dni"])} temu`;
  return `${days} ${pluralPl(days, ["dzień", "dni", "dni"])} bez zmian`;
}

const noteName = (n: Note) => n.title.trim() || n.content.trim().replace(/\s+/g, " ").slice(0, 50) || "Bez tytułu";

function FolderMenu({ note, folders, onMove }: { note: Note; folders: Folder[]; onMove: (folderId: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const rows: { folder: Folder; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const f of folders.filter((x) => x.parentId === parent).sort((a, b) => a.order - b.order)) {
      rows.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Przenieś do folderu" title="Przenieś do folderu" className={rowBtn}>
          <FolderInput className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2 max-h-72 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground px-2 pb-1">Przenieś do folderu</p>
        {rows.length === 0 && <p className="px-2 py-1.5 text-sm text-muted-foreground">Nie masz jeszcze folderów.</p>}
        {rows.map(({ folder, depth }) => (
          <button
            key={folder.id}
            type="button"
            disabled={note.folderId === folder.id}
            onClick={() => { onMove(folder.id); setOpen(false); }}
            style={{ paddingLeft: 8 + depth * 14 }}
            className="w-full flex items-center gap-2 py-1.5 pr-2 rounded-lg text-sm text-left hover:bg-muted/80 disabled:opacity-50"
          >
            <span aria-hidden>{folder.emoji ?? "📁"}</span>
            <span className="truncate">{folder.name}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const rowBtn = "pressable p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 coarse:p-2.5";

function CategoryBlock({ cat, a }: { cat: ReviewCategory; a: WeeklyReviewActions }) {
  const Icon = ICONS[cat.key];
  const more = cat.count - cat.examples.length;
  return (
    <section aria-label={cat.label} data-review-category={cat.key} className="min-w-0">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3.5 h-3.5" aria-hidden />
        {cat.label}
        <span className="font-mono text-2xs normal-case tracking-normal bg-primary/10 text-primary px-1.5 rounded-full" data-testid="review-count">{cat.count}</span>
      </h3>
      <ul className="mt-1.5 divide-y divide-border/50">
        {cat.examples.map((n) => (
          <li key={n.id} className="flex items-center gap-2 py-1.5" data-review-note={n.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{noteName(n)}</p>
              <p className="truncate text-xs text-muted-foreground">{detail(cat.key, n)}</p>
            </div>
            <div className="flex items-center shrink-0">
              <button type="button" aria-label="Otwórz" title="Otwórz" className={rowBtn} onClick={() => a.onOpen(n.id)}>
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={n.pinned ? "Odepnij" : "Przypnij"}
                title={n.pinned ? "Odepnij" : "Przypnij"}
                className={rowBtn}
                onClick={() => {
                  const was = n.pinned;
                  a.onTogglePin(n.id);
                  toastWithUndo(was ? "Odpięto" : "Przypięto", () => a.onTogglePin(n.id), { description: noteName(n), icon: "📌" });
                }}
              >
                {n.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              <button type="button" aria-label="Archiwizuj" title="Archiwizuj" className={rowBtn} onClick={() => a.onArchive(n.id)}>
                <Archive className="w-4 h-4" />
              </button>
              <FolderMenu
                note={n}
                folders={a.folders}
                onMove={(folderId) => {
                  const prev = n.folderId;
                  a.onMoveToFolder(n.id, folderId);
                  toastWithUndo("Przeniesiono do folderu", () => a.onMoveToFolder(n.id, prev), { description: noteName(n), icon: "📁" });
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1 text-xs text-muted-foreground">…i jeszcze {more}. Przejrzyj je trybem „po kolei”.</p>}
    </section>
  );
}

/**
 * Karta „Przegląd tygodnia” w widoku „Dziś”. Sama decyduje, czy się pokazać:
 * tylko w oknie przeglądu (domyślnie niedziela od 17:00 do poniedziałku do 12:00),
 * gdy jest co przejrzeć i gdy nie została odłożona ani zamknięta.
 */
export function WeeklyReviewCard(a: WeeklyReviewActions) {
  const state = useReviewState();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const cycle = dueCycleKey(now, state);
  const review = useMemo(() => buildWeeklyReview(a.notes, now), [a.notes, now]);
  const [walking, setWalking] = useState<ReturnType<typeof reviewQueue> | null>(null);

  // Ile pozycji ubyło od największej liczby widzianej w tej sesji (patrz domknięcie niżej).
  const peak = useRef(0);
  useEffect(() => {
    peak.current = Math.max(peak.current, review.total);
  }, [review.total]);

  const finish = (withReward: boolean, message: string) => {
    if (!cycle) return;
    closeReviewCycle(cycle);
    if (withReward) dayDoneReward();
    toast.success(message, { id: "weekly-review-done", duration: 3500 });
  };

  // Ostatnia pozycja załatwiona ręcznie: przegląd domknięty sam.
  useEffect(() => {
    if (cycle && review.total === 0 && peak.current > 0) finish(true, "Przegląd tygodnia domknięty — czysto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle, review.total]);

  // Karta znika po domknięciu, ale dialog „po kolei” musi dokończyć podsumowanie.
  const visible = Boolean(cycle) && review.total > 0;
  const handled = Math.max(0, peak.current - review.total);

  return (
    <>
      {visible && <section
        aria-label="Przegląd tygodnia"
        data-testid="weekly-review"
        className={cn(
          "relative rounded-2xl border border-primary/25 bg-card p-4 sm:p-5 pl-5 sm:pl-6",
          "border-l-4 border-l-primary/50 shadow-sm",
        )}
      >
        <header className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-primary/15 text-primary grid place-items-center" aria-hidden>
            <Sparkles className="w-[18px] h-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold leading-tight">Przegląd tygodnia</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {review.total} {pluralPl(review.total, ["notatka czeka", "notatki czekają", "notatek czeka"])} na szybki rzut oka.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setWalking(reviewQueue(review))}>
            Przejrzyj po kolei
          </Button>
        </header>

        <div className={cn("mt-4 grid gap-5", review.categories.length > 1 && "lg:grid-cols-2")}>
          {review.categories.map((c) => <CategoryBlock key={c.key} cat={c} a={a} />)}
        </div>

        <footer className="mt-4 pt-3 border-t border-dashed border-border flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { snoozeReview(now); toast("Przypomnimy jutro", { duration: 2500 }); }}
          >
            Przypomnij jutro
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => finish(handled > 0, handled > 0 ? "Przegląd tygodnia domknięty" : "Przegląd pominięty do przyszłego tygodnia")}
          >
            Zamknij na ten tydzień
          </Button>
        </footer>
      </section>}

      {walking && (
        <Suspense fallback={null}>
          <ReviewWalkthrough
            queue={walking}
            onClose={() => setWalking(null)}
            onArchive={(id) => {
              const n = a.notes.find((x) => x.id === id);
              a.archiveNote(id);
              const undo = () => a.unarchiveNote(id);
              pushAction({ kind: "archive", label: n ? noteName(n) : "Notatka", count: 1, noteIds: [id], undo });
              toastWithUndo("Zarchiwizowano", undo, { description: n ? noteName(n) : undefined, icon: "📦" });
            }}
            onTrash={(id) => {
              const n = a.notes.find((x) => x.id === id);
              a.trashNote(id);
              const undo = () => a.restoreFromTrash(id);
              pushAction({ kind: "trash", label: n ? noteName(n) : "Notatka", count: 1, noteIds: [id], undo });
              toastWithUndo("Przeniesiono do kosza", undo, { description: n ? noteName(n) : undefined, icon: "🗑️" });
            }}
            onFinish={(s: WalkthroughSummary) => {
              const acted = s.archived + s.trashed + s.kept > 0;
              finish(acted, "Przegląd tygodnia domknięty");
            }}
          />
        </Suspense>
      )}
    </>
  );
}

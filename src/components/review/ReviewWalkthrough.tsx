import { useEffect, useState } from "react";
import { Archive, ArrowLeft, ArrowRight, Check, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Note } from "@/hooks/useNotes";
import type { ReviewCategoryKey } from "@/lib/weeklyReview";
import { pluralPl } from "@/lib/plural";

export interface WalkthroughSummary {
  kept: number;
  archived: number;
  trashed: number;
  skipped: number;
}

interface Props {
  queue: { note: Note; category: ReviewCategoryKey }[];
  onArchive: (id: string) => void;
  onTrash: (id: string) => void;
  /** Przegląd „po kolei” doszedł do końca albo został zamknięty po ostatniej notatce. */
  onFinish: (summary: WalkthroughSummary) => void;
  onClose: () => void;
}

const REASON: Record<ReviewCategoryKey, string> = {
  overdue: "Zaległe przypomnienie",
  openLists: "Lista do dokończenia",
  stale: "Nietknięta od miesiąca",
  unsorted: "Do posegregowania",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function preview(n: Note): string {
  const text = n.content.replace(/\s+/g, " ").trim();
  if (text) return text.length > 220 ? `${text.slice(0, 220)}…` : text;
  const open = (n.checklist ?? []).filter((i) => !i.checked).map((i) => i.text);
  return open.length ? open.slice(0, 4).join(" • ") : "Bez treści";
}

function age(n: Note): string {
  const days = Math.max(0, Math.floor((Date.now() - n.updatedAt) / DAY_MS));
  return days === 0 ? "zmieniona dziś" : `ostatnia zmiana ${days} ${pluralPl(days, ["dzień", "dni", "dni"])} temu`;
}

/** Tryb „po kolei”: jedna notatka naraz. Ładowany leniwie z karty przeglądu. */
export default function ReviewWalkthrough({ queue, onArchive, onTrash, onFinish, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [summary, setSummary] = useState<WalkthroughSummary>({ kept: 0, archived: 0, trashed: 0, skipped: 0 });
  const [done, setDone] = useState(false);
  const current = queue[index];

  const advance = (patch: Partial<WalkthroughSummary>) => {
    const next = { ...summary };
    for (const k of Object.keys(patch) as (keyof WalkthroughSummary)[]) next[k] += patch[k] ?? 0;
    setSummary(next);
    if (index + 1 >= queue.length) {
      setDone(true);
      onFinish(next);
    } else {
      setIndex(index + 1);
    }
  };

  const keep = () => advance({ kept: 1 });
  const archive = () => { onArchive(current.note.id); advance({ archived: 1 }); };
  const trash = () => { onTrash(current.note.id); advance({ trashed: 1 }); };
  const skip = () => advance({ skipped: 1 });
  const back = () => setIndex((i) => Math.max(0, i - 1));

  useEffect(() => {
    if (done || !current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "arrowright") skip();
      else if (key === "arrowleft") back();
      else if (key === "k") keep();
      else if (key === "a") archive();
      else if (key === "d") trash();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="review-walkthrough">
        <DialogHeader>
          <DialogTitle className="font-display">{done ? "Przegląd skończony" : "Przegląd po kolei"}</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {done ? "Wszystko przejrzane" : `${index + 1} / ${queue.length} · ${REASON[current.category]}`}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <p className="text-sm" data-testid="review-summary">
              Zostawiono {summary.kept}, zarchiwizowano {summary.archived}, do kosza {summary.trashed}, pominięto {summary.skipped}.
            </p>
            <Button onClick={onClose} className="w-full">Gotowe</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 border-l-4 border-l-primary/50">
              <p className="font-display text-base font-semibold leading-snug wrap-break-word">
                {current.note.title.trim() || "Bez tytułu"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{age(current.note)}</p>
              <p className="mt-3 text-sm text-foreground/80 wrap-break-word line-clamp-5">{preview(current.note)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={keep} className="coarse:h-11"><Check className="w-4 h-4 mr-1.5" />Zostaw <kbd className="ml-1.5 font-mono text-2xs opacity-60">K</kbd></Button>
              <Button variant="outline" onClick={archive} className="coarse:h-11"><Archive className="w-4 h-4 mr-1.5" />Archiwizuj <kbd className="ml-1.5 font-mono text-2xs opacity-60">A</kbd></Button>
              <Button variant="outline" onClick={trash} className="coarse:h-11"><Trash className="w-4 h-4 mr-1.5" />Do kosza <kbd className="ml-1.5 font-mono text-2xs opacity-60">D</kbd></Button>
              <Button variant="ghost" onClick={skip} className="coarse:h-11">Dalej<ArrowRight className="w-4 h-4 ml-1.5" /></Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button type="button" onClick={back} disabled={index === 0} className="inline-flex items-center gap-1 coarse:min-h-11 disabled:opacity-40 hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5" />Wstecz
              </button>
              <span>Strzałki ← → przechodzą, K / A / D działają od razu</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { Check, CheckCircle2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { NoteImage } from "@/components/NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CHECKLIST, TOPICS } from "@/lib/study/content";
import { openProblems, setProblemResolved, useStudy, type JournalEntry } from "@/lib/study/store";
import { dayLabel, entriesPl, KIND_LABEL, problemsPl } from "@/lib/study/journalView";
import { useJournalDraft } from "@/lib/study/draft";
import { openJournalEdit, openJournalSheet } from "@/lib/study/entrySheet";
import { JournalEntrySheet, KindIcon } from "./JournalEntrySheet";

const topicTitle = (id: string | null) => TOPICS.find((t) => t.id === id)?.title ?? null;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dziennik z budowy: na górze to, co już zapisane, nowy wpis w arkuszu („+ Wpis”, „+” w dolnym
 * pasku, skrót z ekranu głównego). Problem cofa temat do powtórki, a „Zrobione” liczy się jako praktyka.
 * Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego; poprawka i usunięcie wpisu — w arkuszu.
 */
export function StudyJournal({ onPractice }: { onPractice: (topicId: string) => void }) {
  const study = useStudy();
  const draft = useJournalDraft();
  const hasDraft = !!draft.text.trim() || draft.images.length > 0 || draft.checked.length > 0;
  const [zoom, setZoom] = useState<string | null>(null);

  function toggleResolved(entry: JournalEntry) {
    const resolve = entry.resolved === undefined;
    haptic(resolve ? "success" : "tap");
    setProblemResolved(entry.id, resolve);
  }

  const sorted = useMemo(() => [...study.journal].sort((a, b) => b.at - a.at), [study.journal]);
  const days = useMemo(() => {
    const out: { label: string; entries: JournalEntry[] }[] = [];
    for (const e of sorted) {
      const label = dayLabel(e.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.entries.push(e); else out.push({ label, entries: [e] });
    }
    return out;
  }, [sorted]);

  const week = useMemo(() => {
    const since = Date.now() - 7 * DAY_MS;
    const recent = study.journal.filter((e) => e.at >= since);
    return { all: recent.length, problems: recent.filter((e) => e.kind === "problem").length };
  }, [study.journal]);
  const open = useMemo(() => openProblems(study.journal), [study.journal]);

  return (
    <div className="space-y-6" data-testid="study-journal">
      <section aria-label="Wpisy">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight">Dziennik</h3>
            <p className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="journal-week">
              7 dni: {entriesPl(week.all)}, {problemsPl(week.problems)}
            </p>
            {open > 0 && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-foreground" data-testid="journal-open-problems">
                <KindIcon kind="problem" className="h-3.5 w-3.5" />
                Otwarte problemy: <span className="font-mono tabular-nums">{open}</span>
              </p>
            )}
          </div>
          <Button onClick={() => openJournalSheet()} className="shrink-0 coarse:h-11">
            <Plus className="mr-1 h-4 w-4" aria-hidden />{hasDraft ? "Dokończ wpis" : "Wpis"}
          </Button>
        </header>

        {days.length === 0 ? (
          <button
            type="button"
            onClick={() => openJournalSheet()}
            className="block w-full rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            Brak wpisów. Zapisz, co robisz na budowie — dziennik połączy to z tematami, które przerabiasz.
          </button>
        ) : (
          <div className="space-y-5">
            {days.map((d) => (
              <div key={d.label}>
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</h4>
                <ul className="space-y-2">
                  {d.entries.map((e) => {
                    const total = CHECKLIST.filter((c) => c.topic === e.topic).length;
                    const resolved = e.kind === "problem" && e.resolved !== undefined;
                    return (
                      <li key={e.id} className="rounded-xl border border-border bg-card p-3" data-journal-entry={e.kind} data-resolved={resolved || undefined}>
                        <div className="flex items-start gap-2.5">
                          {resolved ? <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <KindIcon kind={e.kind} />}
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{e.text || "Sprawdzone punkty listy"}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="font-mono tabular-nums">
                                {new Date(e.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span>{resolved ? "Problem rozwiązany" : KIND_LABEL[e.kind]}</span>
                              {e.topic && (
                                <button
                                  type="button"
                                  onClick={() => onPractice(e.topic!)}
                                  className="rounded-full bg-muted px-2 py-0.5 hover:bg-primary/10 hover:text-primary-ink"
                                  title="Ćwicz pytania z tego tematu"
                                >
                                  {topicTitle(e.topic)}
                                </button>
                              )}
                              {e.checked.length > 0 && <span className="tabular-nums">punkty {e.checked.length}/{total}</span>}
                              {e.site && <span className="truncate">{e.site}</span>}
                            </div>
                            {e.kind === "problem" && (
                              <button
                                type="button"
                                onClick={() => toggleResolved(e)}
                                className={cn(
                                  "pressable mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3.5 coarse:text-sm",
                                  resolved ? "border-border text-muted-foreground hover:text-foreground" : "border-warning/60 bg-warning/10 font-medium text-foreground hover:bg-warning/20",
                                )}
                              >
                                <Check className="h-3.5 w-3.5" aria-hidden />
                                {resolved ? "Otwórz ponownie" : "Oznacz jako rozwiązany"}
                              </button>
                            )}
                            {e.images.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Zdjęcia wpisu">
                                {e.images.map((ref) => (
                                  <li key={ref}>
                                    <button type="button" onClick={() => setZoom(ref)} aria-label="Powiększ zdjęcie" className="block overflow-hidden rounded-lg">
                                      <NoteImage imageRef={ref} alt="" className="h-16 w-16 object-cover" placeholderClassName="h-16 w-16" />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openJournalEdit(e)}
                            aria-label="Edytuj wpis"
                            title="Edytuj albo usuń wpis"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:h-11 coarse:w-11"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
      <JournalEntrySheet onPractice={onPractice} />
      <Dialog open={zoom !== null} onOpenChange={(o) => { if (!o) setZoom(null); }}>
        <DialogContent className="max-w-3xl p-3">
          <DialogTitle className="sr-only">Zdjęcie z budowy</DialogTitle>
          {zoom && <NoteImage imageRef={zoom} alt="Zdjęcie z budowy" loading="eager" className="max-h-[80dvh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastWithUndo } from "@/lib/undoToast";
import { NoteImage } from "@/components/NoteImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CHECKLIST, TOPICS } from "@/lib/study/content";
import { removeJournalEntry, restoreJournalEntry, useStudy, type JournalEntry } from "@/lib/study/store";
import { dayLabel, entriesPl, KIND_LABEL, problemsPl } from "@/lib/study/journalView";
import { useJournalDraft } from "@/lib/study/draft";
import { openJournalSheet } from "@/lib/study/entrySheet";
import { JournalEntrySheet, KindIcon } from "./JournalEntrySheet";

const topicTitle = (id: string | null) => TOPICS.find((t) => t.id === id)?.title ?? null;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Dziennik z budowy: na górze to, co już zapisane, nowy wpis w arkuszu („+ Wpis”, „+” w dolnym
 * pasku, skrót z ekranu głównego). Problem cofa temat do powtórki, a „Zrobione” liczy się jako praktyka.
 */
export function StudyJournal({ onPractice }: { onPractice: (topicId: string) => void }) {
  const study = useStudy();
  const draft = useJournalDraft();
  const hasDraft = !!draft.text.trim() || draft.images.length > 0 || draft.checked.length > 0;
  const [zoom, setZoom] = useState<string | null>(null);

  function remove(entry: JournalEntry) {
    removeJournalEntry(entry.id);
    toastWithUndo("Usunięto wpis", () => restoreJournalEntry(entry), { id: "journal-removed" });
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

  return (
    <div className="space-y-6" data-testid="study-journal">
      <section aria-label="Wpisy">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg leading-tight">Dziennik</h3>
            <p className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="journal-week">
              7 dni: {entriesPl(week.all)}, {problemsPl(week.problems)}
            </p>
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
                    return (
                      <li key={e.id} className="rounded-xl border border-border bg-card p-3" data-journal-entry={e.kind}>
                        <div className="flex items-start gap-2.5">
                          <KindIcon kind={e.kind} />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-pre-wrap break-words text-sm leading-snug">{e.text || "Sprawdzone punkty listy"}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              <span className="font-mono tabular-nums">
                                {new Date(e.at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <span>{KIND_LABEL[e.kind]}</span>
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
                            onClick={() => remove(e)}
                            aria-label="Usuń wpis"
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground coarse:h-11 coarse:w-11"
                          >
                            <Trash2 className="h-4 w-4" />
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

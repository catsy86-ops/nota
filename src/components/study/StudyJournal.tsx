import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, NotebookPen, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { CHECKLIST, MODULES, TOPICS } from "@/lib/study/content";
import {
  addJournalEntry,
  columnOf,
  removeJournalEntry,
  restoreJournalEntry,
  setSite,
  useStudy,
  type JournalEntry,
  type JournalKind,
} from "@/lib/study/store";

const KIND_LABEL: Record<JournalKind, string> = { ok: "Zrobione", problem: "Problem", note: "Notatka" };
const topicTitle = (id: string | null) => TOPICS.find((t) => t.id === id)?.title ?? null;
const DAY_MS = 24 * 60 * 60 * 1000;

function KindIcon({ kind }: { kind: JournalKind }) {
  if (kind === "ok") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  if (kind === "problem") return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />;
  return <NotebookPen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}

function dayLabel(at: number): string {
  return new Date(at).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });
}

/**
 * Dziennik z budowy: wpis powstaje w trakcie pracy, przy temacie z materiału, z jego listą
 * kontrolną pod ręką. Problem cofa temat do powtórki, a „Zrobione” liczy się jako praktyka.
 */
export function StudyJournal({ initialTopic = "", onPractice }: { initialTopic?: string; onPractice: (topicId: string) => void }) {
  const study = useStudy();
  const [topic, setTopic] = useState(initialTopic);
  const [kind, setKind] = useState<JournalKind>("ok");
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const items = useMemo(() => CHECKLIST.filter((c) => c.topic === topic), [topic]);
  const current = TOPICS.find((t) => t.id === topic) ?? null;

  function changeTopic(next: string) {
    setTopic(next);
    setChecked(new Set());
  }

  function toggle(id: string) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function submit() {
    const wasDone = topic && columnOf(study, topic) === "done";
    const entry = addJournalEntry({ kind, topic: topic || null, text, checked: [...checked] });
    if (!entry) {
      toast("Wpisz, co się dzieje, albo zaznacz sprawdzone punkty");
      return;
    }
    setText("");
    setChecked(new Set());
    toast.success(kind === "problem" && wasDone ? "Zapisano problem — temat wraca do powtórki" : "Dodano wpis do dziennika");
  }

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
      <section aria-label="Nowy wpis" className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Inwestycja / adres
            <input
              value={study.site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="np. Dom Kowalskich, ul. Leśna 4"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Czego dotyczy
            <select
              value={topic}
              onChange={(e) => changeTopic(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Ogólnie (bez tematu)</option>
              {MODULES.map((m) => (
                <optgroup key={m.id} label={m.label}>
                  {TOPICS.filter((t) => t.module === m.id).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {current && (
          <div className="space-y-2 rounded-xl bg-muted/50 p-3" data-testid="journal-topic-panel">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm leading-snug text-muted-foreground">{current.summary}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => onPractice(current.id)}>
                <Play className="mr-1.5 h-3.5 w-3.5" />Ćwicz pytania
              </Button>
            </div>
            <p className="text-xs font-medium text-foreground">Sprawdź przed przejściem dalej</p>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5">
                  <Checkbox id={`journal-${item.id}`} checked={checked.has(item.id)} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                  <label htmlFor={`journal-${item.id}`} className="cursor-pointer text-sm leading-snug">
                    {item.critical && <span className="mr-1 text-warning" aria-label="Punkt krytyczny">⚠</span>}
                    {item.text}
                    {item.risk && <span className="mt-0.5 block text-xs text-muted-foreground">Ryzyko: {item.risk.replace(/^[^=]*= ?/, "")}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div role="radiogroup" aria-label="Rodzaj wpisu" className="flex gap-2">
          {(Object.keys(KIND_LABEL) as JournalKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors coarse:min-h-11",
                kind === k ? "border-primary bg-primary/10 text-primary-ink font-medium" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              <KindIcon kind={k} />
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        <label className="block space-y-1 text-xs text-muted-foreground">
          Co się dzieje?
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
            rows={3}
            placeholder={kind === "problem" ? "Co poszło nie tak i co z tym zrobisz?" : "Krótko: gdzie, co zrobione, co zauważyłeś"}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {checked.size > 0 ? `Sprawdzone punkty: ${checked.size}/${items.length}` : "Ctrl+Enter dodaje wpis"}
          </p>
          <Button onClick={submit} className="coarse:h-11">Dodaj wpis</Button>
        </div>
      </section>

      <section aria-label="Wpisy">
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg">Dziennik</h3>
          <p className="font-mono text-xs text-muted-foreground tabular-nums" data-testid="journal-week">
            7 dni: {week.all} wpisów, {week.problems} problemów
          </p>
        </header>

        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Brak wpisów. Zapisz, co robisz na budowie — dziennik połączy to z tematami, które przerabiasz.
          </p>
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
    </div>
  );
}

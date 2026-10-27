import { useMemo, useState } from "react";
import { Pill, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { nextReminderAt } from "@/lib/timeOfDay";
import { logKey, SUPPLEMENT_DOSE_MAX, SUPPLEMENT_NAME_MAX, SUPPLEMENT_WHEN, SUPPLEMENT_WHEN_LABEL, type Supplement, type SupplementWhen } from "@/lib/supplements/model";
import { addSupplement, removeSupplement, restoreSupplement, setSupplementTaken, useSupplements, useSupplementsTaken } from "@/lib/supplements/store";
import { toastWithUndo } from "@/lib/undoToast";
import { useNotesContext } from "@/hooks/NotesProvider";
import { DietSection } from "./DietSection";
import { WeightSection } from "./WeightSection";
import { TrainingSection } from "./TrainingSection";

/** Domyślna godzina przypomnienia dla pory dnia (edytowalna w formularzu). */
const DEFAULT_TIME: Record<SupplementWhen, string> = { rano: "07:30", w_ciagu_dnia: "12:00", wieczorem: "20:00" };

type NotesActions = Pick<ReturnType<typeof useNotesContext>, "addNote" | "updateNote" | "trashNote" | "restoreFromTrash">;

/**
 * Dodaje odżywkę. Z przypomnieniem tworzy notatkę z dziennym powtarzaniem (system Przypomnień),
 * a jej id zapisuje w odżywce, żeby usunięcie odżywki mogło sprzątnąć przypomnienie.
 */
function createSupplement(notes: NotesActions, input: { name: string; dose: string; when: SupplementWhen; remindAt?: string }): Supplement | null {
  const name = input.name.trim();
  if (!name) return null;
  let reminderNoteId: string | undefined;
  if (input.remindAt) {
    const title = input.dose.trim() ? `${name} — ${input.dose.trim()}` : name;
    reminderNoteId = notes.addNote(title, "Odżywka — przypomnienie codzienne. Odhacz ją w dziale Ćwiczenia.", "default", [], nextReminderAt(input.remindAt, Date.now()));
    notes.updateNote(reminderNoteId, { reminderRepeat: "daily" });
  }
  const s = addSupplement({ name, dose: input.dose, when: input.when, remindAt: input.remindAt, reminderNoteId });
  // Zapis odrzucony (np. pełna lista): przypomnienie nie może zostać osierocone.
  if (!s && reminderNoteId) notes.trashNote(reminderNoteId);
  return s;
}

/** Usuwa odżywkę i jej przypomnienie (trafia do kosza, skąd da się je przywrócić). */
function deleteSupplement(notes: NotesActions, s: Supplement): Supplement | null {
  const prev = removeSupplement(s.id);
  if (prev?.reminderNoteId) notes.trashNote(prev.reminderNoteId);
  return prev;
}

/**
 * Dział Ćwiczenia (osobna pozycja w menu): odżywki (lista, dzienne odhaczenia, przypomnienia), trening
 * (plany dni, dziennik serii, progres), dieta (posiłki, kalorie i białko, cele) i masa ciała (waga).
 */
type CwiczeniaTab = "odzywki" | "trening" | "dieta" | "waga";
const CWICZENIA_TABS: { id: CwiczeniaTab; label: string }[] = [
  { id: "odzywki", label: "Odżywki" },
  { id: "trening", label: "Trening" },
  { id: "dieta", label: "Dieta" },
  { id: "waga", label: "Waga" },
];

export function CwiczeniaView() {
  const supplements = useSupplements();
  const taken = useSupplementsTaken();
  const notes = useNotesContext();
  const today = localDayKey();
  const doneToday = supplements.filter((s) => taken.has(logKey(today, s.id))).length;
  // Na telefonie jedna sekcja naraz (zakładki); na większym ekranie wszystkie jak dotąd. Sekcje są w DOM zawsze.
  const [tab, setTab] = useState<CwiczeniaTab>("odzywki");
  const phoneHide = (id: CwiczeniaTab) => (tab === id ? undefined : "max-sm:hidden");

  return (
    <section aria-labelledby="cwiczenia-title" className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 desk:pt-8">
      <header className="mb-5">
        <p className="text-xs font-display uppercase tracking-[0.18em] text-muted-foreground">Prywatne</p>
        <h1 id="cwiczenia-title" className="font-display text-3xl font-bold tracking-tight">Ćwiczenia</h1>
      </header>

      <div role="group" aria-label="Dział Ćwiczeń" className="mb-4 flex gap-1 rounded-card bg-muted p-0.5 sm:hidden">
        {CWICZENIA_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 h-11 rounded-[0.65rem] text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section aria-labelledby="supplements-title" className={`rounded-card border border-border bg-card p-4 sm:p-5 space-y-4 ${phoneHide("odzywki") ?? ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="supplements-title" className="section-label gap-2">
            <Pill className="h-3.5 w-3.5" aria-hidden />
            Odżywki
          </h2>
          {supplements.length > 0 && (
            <span className="text-xs text-muted-foreground" data-testid="supplements-count">
              dziś {doneToday} z {supplements.length}
            </span>
          )}
        </div>

        {supplements.length === 0 ? (
          <EmptyList notes={notes} />
        ) : (
          <SupplementList supplements={supplements} taken={taken} day={today} notes={notes} />
        )}

        <AddSupplementForm notes={notes} />
      </section>

      <div className="mt-6 space-y-6">
        <div className={phoneHide("trening")}><TrainingSection /></div>
        <div className={phoneHide("dieta")}><DietSection /></div>
        <div className={phoneHide("waga")}><WeightSection /></div>
      </div>
    </section>
  );
}

function EmptyList({ notes }: { notes: NotesActions }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Nie masz jeszcze odżywek na liście.</p>
      <Button
        variant="outline"
        size="sm"
        className="coarse:h-11"
        onClick={() => createSupplement(notes, { name: "Kreatyna", dose: "1 łyżka", when: "rano", remindAt: DEFAULT_TIME.rano })}
      >
        Dodaj kreatynę (rano, 1 łyżka)
      </Button>
    </div>
  );
}

function SupplementList({ supplements, taken, day, notes }: { supplements: Supplement[]; taken: Set<string>; day: string; notes: NotesActions }) {
  // Grupy w kolejności pory dnia; pusta grupa się nie pokazuje.
  const groups = SUPPLEMENT_WHEN
    .map((when) => ({ when, items: supplements.filter((s) => s.when === when) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.when} data-supplement-group={g.when}>
          <h3 className="text-xs font-medium text-muted-foreground">{SUPPLEMENT_WHEN_LABEL[g.when]}</h3>
          <ul className="mt-1 divide-y divide-border/50">
            {g.items.map((s) => {
              const done = taken.has(logKey(day, s.id));
              return (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <Checkbox
                    id={`sup-${s.id}`}
                    checked={done}
                    onCheckedChange={(v) => setSupplementTaken(s.id, v === true, day)}
                    className="coarse:h-6 coarse:w-6"
                    aria-label={`Wzięte: ${s.name}`}
                  />
                  <label htmlFor={`sup-${s.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className={done ? "text-sm text-muted-foreground line-through" : "text-sm"}>{s.name}</span>
                    {s.dose && <span className="ml-2 text-xs text-muted-foreground">{s.dose}</span>}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="coarse:h-11"
                    aria-label={`Usuń ${s.name}`}
                    onClick={() => removeWithUndo(notes, s)}
                  >
                    <Trash className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Usunięcie z „Cofnij”: wraca odżywka i jej przypomnienie z kosza; odhaczeń nie przywracamy (patrz `restoreSupplement`). */
function removeWithUndo(notes: NotesActions, s: Supplement) {
  const prev = deleteSupplement(notes, s);
  if (!prev) return;
  toastWithUndo("Usunięto odżywkę", () => {
    restoreSupplement(prev);
    if (prev.reminderNoteId) notes.restoreFromTrash(prev.reminderNoteId);
  }, { description: prev.name });
}

function AddSupplementForm({ notes }: { notes: NotesActions }) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [when, setWhen] = useState<SupplementWhen>("rano");
  const [remind, setRemind] = useState(true);
  const [time, setTime] = useState(DEFAULT_TIME.rano);
  const canSave = useMemo(() => name.trim().length > 0, [name]);

  const pickWhen = (w: SupplementWhen) => {
    setWhen(w);
    setTime(DEFAULT_TIME[w]);
  };

  const save = () => {
    if (!canSave) return;
    if (!createSupplement(notes, { name, dose, when, remindAt: remind && time ? time : undefined })) return;
    setName("");
    setDose("");
  };

  return (
    <form
      className="space-y-3 border-t border-dashed border-border pt-4"
      onSubmit={(e) => { e.preventDefault(); save(); }}
    >
      <p className="text-xs font-medium text-muted-foreground">Dodaj odżywkę</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          aria-label="Nazwa odżywki"
          placeholder="Nazwa, np. Kreatyna"
          maxLength={SUPPLEMENT_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="Dawka"
          placeholder="Dawka, np. 1 łyżka"
          maxLength={SUPPLEMENT_DOSE_MAX}
          value={dose}
          onChange={(e) => setDose(e.target.value)}
        />
      </div>
      <div role="radiogroup" aria-label="Pora dnia" className="flex flex-wrap gap-2">
        {SUPPLEMENT_WHEN.map((w) => (
          <Button
            key={w}
            type="button"
            role="radio"
            aria-checked={when === w}
            variant={when === w ? "default" : "outline"}
            size="sm"
            className="coarse:h-11"
            onClick={() => pickWhen(w)}
          >
            {SUPPLEMENT_WHEN_LABEL[w]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox checked={remind} onCheckedChange={(v) => setRemind(v === true)} className="coarse:h-6 coarse:w-6" />
          Przypominaj codziennie o
        </label>
        <Input
          type="time"
          aria-label="Godzina przypomnienia"
          value={time}
          disabled={!remind}
          onChange={(e) => setTime(e.target.value)}
          className="w-auto coarse:h-11"
        />
      </div>
      <Button type="submit" size="sm" disabled={!canSave} className="coarse:h-11">Dodaj</Button>
    </form>
  );
}

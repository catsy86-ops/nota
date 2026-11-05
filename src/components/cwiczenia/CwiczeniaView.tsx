import { useId, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionCard } from "@/components/ui/section-card";
import { MissingHint } from "@/components/ui/missing-hint";
import { Pill, Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { nextReminderAt } from "@/lib/timeOfDay";
import { logKey, weekAdherence, SUPPLEMENT_DOSE_MAX, SUPPLEMENT_NAME_MAX, SUPPLEMENT_WHEN, SUPPLEMENT_WHEN_LABEL, type Supplement, type SupplementWhen } from "@/lib/supplements/model";
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
  // Na telefonie jedna sekcja naraz (zakładki `ui/tabs`, nowy plan 2.2); na większym ekranie wszystkie jak dotąd.
  // Panele mają `forceMount`, więc sekcje są w DOM zawsze; nieaktywne chowa tylko telefon.
  const [tab, setTab] = useState<CwiczeniaTab>("odzywki");
  const panel = "mt-0 max-sm:data-[state=inactive]:hidden";
  // NP-7 (nowy plan 2.5) i 3.6: formularz zwinięty; przy pustej liście jest pusty stan z przyciskiem, z odżywkami — „Dodaj odżywkę”.
  const [formOpen, setFormOpen] = useState(false);

  return (
    // Tytuł i grupa są w główce kartki (`ViewTitle`).
    <section aria-label="Ćwiczenia" className="w-full max-w-(--page-form) pb-32">

      <Tabs value={tab} onValueChange={(v) => setTab(v as CwiczeniaTab)}>
      <TabsList aria-label="Dział Ćwiczeń" className="mb-4 flex h-auto w-full sm:hidden">
        {CWICZENIA_TABS.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="h-11 flex-1">{t.label}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="odzywki" forceMount className={panel}>
      <SectionCard icon={Pill} title="Odżywki" bodyClassName="space-y-4"
        meta={supplements.length > 0 ? <span data-testid="supplements-count">dziś {doneToday} z {supplements.length}</span> : undefined}>

        {supplements.length === 0 ? (
          // Jeden pusty stan; gdy formularz już otwarty, zostaje sam formularz (3.6).
          !formOpen && <EmptyList notes={notes} onAdd={() => setFormOpen(true)} />
        ) : (
          <SupplementList supplements={supplements} taken={taken} day={today} notes={notes} />
        )}

        {formOpen ? (
          <div className="space-y-3">
            <AddSupplementForm notes={notes} />
            <Button variant="ghost" size="sm" className="coarse:h-11" aria-expanded onClick={() => setFormOpen(false)}>Zwiń formularz</Button>
          </div>
        ) : supplements.length > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5 coarse:h-11" aria-expanded={false} onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />Dodaj odżywkę
          </Button>
        )}
      </SectionCard>
      </TabsContent>

      <div className="mt-6 space-y-6 max-sm:mt-0">
        <TabsContent value="trening" forceMount className={panel}><TrainingSection /></TabsContent>
        <TabsContent value="dieta" forceMount className={panel}><DietSection /></TabsContent>
        <TabsContent value="waga" forceMount className={panel}><WeightSection /></TabsContent>
      </div>
      </Tabs>
    </section>
  );
}

function EmptyList({ notes, onAdd }: { notes: NotesActions; onAdd: () => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Nie masz jeszcze odżywek na liście.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="coarse:h-11" aria-expanded={false} onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />Dodaj odżywkę
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="coarse:h-11"
          onClick={() => createSupplement(notes, { name: "Kreatyna", dose: "1 łyżka", when: "rano", remindAt: DEFAULT_TIME.rano })}
        >
          Dodaj kreatynę (rano, 1 łyżka)
        </Button>
      </div>
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
                  <WeekDots days={weekAdherence(s.id, taken, day)} />
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

/** 3.2: ostatnie 7 dni odżywki jako kropki (od najstarszego do dziś) i „6/7”. */
function WeekDots({ days }: { days: boolean[] }) {
  const n = days.filter(Boolean).length;
  return (
    <span className="flex shrink-0 items-center gap-1.5" role="img" aria-label={`W ostatnich 7 dniach: ${n} z 7`} data-testid="supplement-week">
      <span className="flex gap-0.5" aria-hidden>
        {days.map((d, i) => <span key={i} className={d ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-muted-foreground/25"} />)}
      </span>
      <span className="font-mono text-2xs tabular-nums text-muted-foreground" aria-hidden>{n}/7</span>
    </span>
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
  const hintId = useId();

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
      <Button type="submit" size="sm" disabled={!canSave} aria-describedby={hintId} className="coarse:h-11">Dodaj</Button>
      <MissingHint id={hintId} missing={canSave ? null : "Wpisz nazwę odżywki."} />
    </form>
  );
}

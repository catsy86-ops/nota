import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { updateDebt } from "@/lib/debts/store";
import { DebtProofField } from "./DebtProof";
import { DEBT_NOTE_LABEL, DEBT_NOTE_MAX, DEBT_PERSON_MAX, normalizeName, parseAmount, type DebtEntry, type DebtKind } from "@/lib/debts/model";
import { cardVariant } from "@/components/ui/card";
import { KindPicker } from "./KindPicker";
import { type AddReminderNote, type DebtReminderApi, dueAt, dueTitle, hasDue } from "./debtTypes";

/**
 * Poprawka wpisu w miejscu (1.5 — jak dodawanie): kwota, dzień, notatka, rodzaj, nazwa osoby i termin
 * zwrotu. Zmiana imienia przenosi wpis do innej osoby (grupowanie idzie po nazwie bez wielkości liter).
 * Termin tworzy, zmienia albo zdejmuje przypomnienie notatki; „Cofnij” oddaje wpis i termin.
 */
export function EditDebtForm({ entry, people, reminders, addReminderNote, hidden, proofRef, onDone }: {
  entry: DebtEntry;
  proofRef?: string;
  people: string[];
  reminders?: DebtReminderApi;
  addReminderNote?: AddReminderNote;
  hidden: boolean;
  onDone: () => void;
}) {
  const uid = useId();
  const [person, setPerson] = useState(entry.person);
  const [kind, setKind] = useState<DebtKind>(entry.kind);
  const [amount, setAmount] = useState((entry.amount / 100).toFixed(2).replace(".", ","));
  const [at, setAt] = useState(entry.at);
  const [note, setNote] = useState(entry.note);
  // Notatka terminu, która jeszcze istnieje; usunięta liczy się jak brak notatki (nowy termin = nowa notatka).
  const liveNoteId = entry.dueNoteId && reminders?.has(entry.dueNoteId) ? entry.dueNoteId : undefined;
  const prevDueAt = liveNoteId ? reminders?.get(liveNoteId) ?? null : null;
  const initialDue = prevDueAt !== null ? localDayKey(new Date(prevDueAt)) : "";
  const [due, setDue] = useState(initialDue);
  const [error, setError] = useState<{ field: "person" | "amount" | "at" | "due" | "save"; text: string } | null>(null);
  // Termin da się ustawić, gdy jest gdzie go zapisać: istniejąca notatka albo tworzenie nowej.
  const dueEditable = hasDue(kind) && (liveNoteId ? !!reminders : !!addReminderNote);

  const save = () => {
    if (!normalizeName(person)) { setError({ field: "person", text: "Podaj, kto to jest — imię albo nazwę." }); return; }
    const grosze = parseAmount(amount);
    if (grosze === null) { setError({ field: "amount", text: "Wpisz kwotę większą od zera, np. 150 albo 99,90." }); return; }
    if (!at) { setError({ field: "at", text: "Podaj dzień wpisu." }); return; }
    const wantDue = dueEditable && due ? due : "";
    if (wantDue && wantDue !== initialDue && wantDue < localDayKey()) { setError({ field: "due", text: "Termin zwrotu nie może być w przeszłości." }); return; }
    const updated = updateDebt({ ...entry, person: normalizeName(person), kind, amount: grosze, at, note: note.trim() });
    if (!updated) { setError({ field: "save", text: "Nie udało się zapisać — wpis mógł zostać usunięty." }); return; }

    // Termin zwrotu: zmiana w istniejącej notatce albo nowa notatka (z etykietą jak przy dodawaniu).
    // Rodzaj bez terminu („Oddał mi”, „Oddałem”) zdejmuje przypomnienie, które zostało z pożyczki.
    let undoDue = () => {};
    const target = hasDue(kind) ? wantDue : "";
    if (liveNoteId && reminders && target !== initialDue) {
      if (target) reminders.restore(liveNoteId, dueAt(target)); else reminders.clear(liveNoteId);
      undoDue = () => { if (prevDueAt !== null) reminders.restore(liveNoteId, prevDueAt); else reminders.clear(liveNoteId); };
    } else if (!liveNoteId && target && addReminderNote) {
      const created = addReminderNote(dueTitle(kind, updated.person, updated.amount, hidden), updated.note, dueAt(target), [DEBT_NOTE_LABEL]);
      updateDebt({ ...updated, dueNoteId: created });
      undoDue = () => { reminders?.remove(created); };
    }
    haptic("tap");
    toast.success("Poprawiono wpis", { action: { label: "Cofnij", onClick: () => { updateDebt(entry); undoDue(); } } });
    onDone();
  };

  const invalid = (f: NonNullable<typeof error>["field"]) => (error?.field === f ? { "aria-invalid": true as const, "aria-describedby": `${uid}-err` } : {});

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      noValidate
      aria-label="Edycja wpisu"
      className={cn(cardVariant(), "@container space-y-3 border-primary/40 p-3")}
    >
      <KindPicker value={kind} onChange={setKind} />
      <div className="grid gap-3 @md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="ui-label">Kto</label>
          <Input id={`${uid}-person`} list={`${uid}-people`} autoComplete="off" value={person} maxLength={DEBT_PERSON_MAX} className="shake-invalid" {...invalid("person")} onChange={(e) => { setPerson(e.target.value); setError(null); }} />
          <datalist id={`${uid}-people`}>{people.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-amount`} className="ui-label">Kwota (zł)</label>
          <Input id={`${uid}-amount`} inputMode="decimal" value={amount} className="shake-invalid tabular-nums" {...invalid("amount")} onChange={(e) => { setAmount(e.target.value); setError(null); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="ui-label">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={localDayKey()} className="shake-invalid" {...invalid("at")} onChange={(e) => { setAt(e.target.value); setError(null); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="ui-label">Za co</label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
        </div>
        {dueEditable && (
          <div className="space-y-1.5 @md:col-span-2">
            <label htmlFor={`${uid}-due`} className="ui-label">Termin zwrotu <span className="font-normal text-muted-foreground">(9:00; puste — bez przypomnienia)</span></label>
            <Input id={`${uid}-due`} type="date" value={due} className="shake-invalid" {...invalid("due")} onChange={(e) => { setDue(e.target.value); setError(null); }} />
          </div>
        )}
      </div>
      <DebtProofField entryId={entry.id} proofRef={proofRef} hidden={hidden} />
      {error && <p id={`${uid}-err`} role="alert" className="text-sm text-destructive-ink">{error.text}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-11 flex-1">Zapisz zmiany</Button>
        <Button type="button" variant="ghost" size="sm" className="h-11" onClick={onDone}>Anuluj</Button>
      </div>
    </form>
  );
}

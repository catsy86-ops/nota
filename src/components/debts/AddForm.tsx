import { useEffect, useId, useMemo, useRef, useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDayClock } from "@/lib/dayClock";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { addDebtFromText, addDebtPlan, attachPlanNote, removeDebt, updateDebt } from "@/lib/debts/store";
import { amountText } from "@/lib/debts/hideAmounts";
import { DEBT_KIND_LABEL, DEBT_NOTE_LABEL, DEBT_NOTE_MAX, DEBT_PERSON_MAX, formatAmount, knownPeople, parseAmount, type DebtEntry, type DebtKind } from "@/lib/debts/model";
import { cardVariant } from "@/components/ui/card";
import { PLAN_MAX_RATES, PLAN_MIN_RATES, rateAmounts } from "@/lib/debts/plans";
import { KindPicker } from "./KindPicker";
import { type AddReminderNote, dueAt, dueTitle, hasDue } from "./debtTypes";

/** Dodawanie: osoba, rodzaj, kwota, dzień i notatka. Po zapisie zostaje osoba — kolejne pozycje dopisuje się szybciej. */
export function AddForm({ entries, addReminderNote, hidden, initialPerson, focusAmount, focusPerson }: {
  entries: DebtEntry[];
  addReminderNote?: AddReminderNote;
  hidden: boolean;
  /** 2.1: osoba z „+ Wpis z {imię}”. */
  initialPerson?: string;
  /** Po otwarciu z arkusza osoby: kursor w kwocie; z pustego stanu (4.4): w polu „Kto”. */
  focusAmount?: boolean;
  focusPerson?: boolean;
}) {
  const [person, setPerson] = useState(initialPerson ?? "");
  const [kind, setKind] = useState<DebtKind>("lent");
  const [amount, setAmount] = useState("");
  // 1.7: dzień formularza idzie za zegarem (po północy „dziś” to nowy dzień), dopóki nie wybrano innego.
  useDayClock();
  const today = localDayKey();
  const [pickedAt, setPickedAt] = useState<string | null>(null);
  const at = pickedAt ?? today;
  const [note, setNote] = useState("");
  // Termin zwrotu (dzień, 9:00) — tylko przy pożyczce i długu; zapisuje się jako notatka z przypomnieniem.
  const [due, setDue] = useState("");
  // L2.1: „w ratach” — liczba rat i termin pierwszej (dzień miesiąca z tej daty); zamiast jednego terminu zwrotu.
  const [inRates, setInRates] = useState(false);
  const [rates, setRates] = useState("6");
  const [error, setError] = useState<{ field: "person" | "amount" | "due" | "rates"; text: string } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const people = useMemo(() => knownPeople(entries), [entries]);
  const personRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusAmount && !focusPerson) return;
    const el = focusPerson ? personRef.current : amountRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    el?.scrollIntoView?.({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  }, [focusAmount, focusPerson]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim()) { haptic("warn"); setError({ field: "person", text: "Podaj, kto to jest — imię albo nazwę." }); return; }
    if (parseAmount(amount) === null) { haptic("warn"); setError({ field: "amount", text: "Wpisz kwotę większą od zera, np. 150 albo 99,90." }); return; }
    const withDue = hasDue(kind) && !!due;
    const planned = hasDue(kind) && inRates;
    const count = Number(rates);
    if (planned) {
      if (!Number.isInteger(count) || count < PLAN_MIN_RATES || count > PLAN_MAX_RATES) { haptic("warn"); setError({ field: "rates", text: `Liczba rat od ${PLAN_MIN_RATES} do ${PLAN_MAX_RATES}.` }); return; }
      if (rateAmounts(parseAmount(amount)!, count)[0] <= 0) { haptic("warn"); setError({ field: "rates", text: "Rata wyszłaby 0 zł — mniej rat albo większa kwota." }); return; }
      if (!due) { haptic("warn"); setError({ field: "due", text: "Podaj termin pierwszej raty." }); return; }
    }
    if (withDue && due < today) { setError({ field: "due", text: planned ? "Pierwsza rata nie może być w przeszłości." : "Termin zwrotu nie może być w przeszłości." }); return; }
    const entry = addDebtFromText(person, kind, amount, note, at || undefined);
    if (!entry) { setError({ field: "person", text: "Nie udało się zapisać — sprawdź nazwę i datę." }); return; }
    const plan = planned ? addDebtPlan({ entryId: entry.id, count, day: Number(due.slice(8, 10)), first: due }) : null;
    if (withDue && addReminderNote) {
      // Notatka z przypomnieniem trafia do Dziś, Terminów i powiadomień; wpis pamięta jej id.
      const title = dueTitle(kind, entry.person, plan ? rateAmounts(entry.amount, count)[0] : entry.amount, hidden);
      const noteId = addReminderNote(plan ? `${title} (rata)` : title, entry.note, dueAt(due), [DEBT_NOTE_LABEL]);
      updateDebt({ ...entry, dueNoteId: noteId });
      if (plan) attachPlanNote(noteId, plan);
    }
    setInRates(false);
    setError(null);
    setAmount("");
    setNote("");
    setDue("");
    setPickedAt(null);
    haptic("success");
    toast.success(`${DEBT_KIND_LABEL[kind]}: ${entry.person}, ${formatAmount(entry.amount)}`, {
      action: { label: "Cofnij", onClick: () => { removeDebt(entry.id); } },
    });
    amountRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Nowy wpis" className={cn(cardVariant(), "@container mb-6 space-y-4 p-card")}>
      <KindPicker value={kind} onChange={setKind} />

      <div className="grid gap-3 @md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="ui-label">Kto</label>
          <Input
            id={`${uid}-person`}
            ref={personRef}
            list={`${uid}-people`}
            value={person}
            maxLength={DEBT_PERSON_MAX}
            placeholder="Imię albo nazwa"
            autoComplete="off"
            className="shake-invalid"
            aria-invalid={error?.field === "person" || undefined}
            aria-describedby={error?.field === "person" ? `${uid}-err` : undefined}
            onChange={(e) => { setPerson(e.target.value); setError(null); }}
          />
          <datalist id={`${uid}-people`}>{people.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-amount`} className="ui-label">Kwota (zł)</label>
          <Input
            id={`${uid}-amount`}
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            placeholder="0,00"
            className="shake-invalid tabular-nums"
            aria-invalid={error?.field === "amount" || undefined}
            aria-describedby={error?.field === "amount" ? `${uid}-err` : undefined}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
          />
        </div>
      </div>

      <div className="grid gap-3 @md:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="ui-label">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={today} onChange={(e) => setPickedAt(e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="ui-label">Za co <span className="font-normal text-muted-foreground">(nieobowiązkowe)</span></label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} placeholder="np. zaliczka na materiał" onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {hasDue(kind) && (
        <label className="flex items-center gap-2 text-sm coarse:min-h-11">
          <input type="checkbox" className="size-4" checked={inRates} onChange={(e) => { setInRates(e.target.checked); setError(null); }} />
          W ratach (co miesiąc)
        </label>
      )}
      {hasDue(kind) && inRates && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-rates`} className="ui-label">Liczba rat</label>
          <Input
            id={`${uid}-rates`}
            inputMode="numeric"
            value={rates}
            className="shake-invalid tabular-nums"
            aria-invalid={error?.field === "rates" || undefined}
            aria-describedby={error?.field === "rates" ? `${uid}-err` : undefined}
            onChange={(e) => { setRates(e.target.value.replace(/\D/g, "").slice(0, 2)); setError(null); }}
          />
          {parseAmount(amount) !== null && Number(rates) >= PLAN_MIN_RATES && Number(rates) <= PLAN_MAX_RATES && (
            <p className="ui-hint">Rata: {amountText(rateAmounts(parseAmount(amount)!, Number(rates))[0], hidden)}{rateAmounts(parseAmount(amount)!, Number(rates)).at(-1) !== rateAmounts(parseAmount(amount)!, Number(rates))[0] ? `, ostatnia ${amountText(rateAmounts(parseAmount(amount)!, Number(rates)).at(-1)!, hidden)}` : ""}</p>
          )}
        </div>
      )}
      {hasDue(kind) && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-due`} className="ui-label">{inRates ? <>Pierwsza rata <span className="font-normal text-muted-foreground">(kolejne tego dnia miesiąca, przypomnienie o 9:00)</span></> : <>Termin zwrotu <span className="font-normal text-muted-foreground">(z przypomnieniem o 9:00, nieobowiązkowe)</span></>}</label>
          <Input
            id={`${uid}-due`}
            type="date"
            value={due}
            min={today}
            className="shake-invalid"
            aria-invalid={error?.field === "due" || undefined}
            aria-describedby={error?.field === "due" ? `${uid}-err` : undefined}
            onChange={(e) => { setDue(e.target.value); setError(null); }}
          />
        </div>
      )}

      {error && <p id={`${uid}-err`} role="alert" className="text-sm text-destructive-ink">{error.text}</p>}

      <Button type="submit" className="w-full h-11 gap-2">
        <HandCoins className="size-4" aria-hidden />
        Zapisz wpis
      </Button>
    </form>
  );
}

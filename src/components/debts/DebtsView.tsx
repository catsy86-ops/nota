import { useId, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins, Pencil, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { addDebt, addDebtFromText, removeDebt, restoreDebt, updateDebt, useDebts } from "@/lib/debts/store";
import { balances, DEBT_KINDS, DEBT_NOTE_MAX, DEBT_PERSON_MAX, formatAmount, KIND_SIGN, knownPeople, normalizeName, parseAmount, repaidShare, totals, type DebtEntry, type DebtKind, type PersonDebts } from "@/lib/debts/model";

/**
 * Długi: kto ile u nas pożyczył i ile oddał. Góra — podsumowanie i szybki wpis,
 * dół — osoby z saldem; stuknięcie w osobę otwiera jej historię.
 */
/** `addReminderNote` — tworzy notatkę z przypomnieniem (`Index`); bez niego termin zwrotu nie zapisuje przypomnienia. */
/**
 * Przypomnienia notatek powiązanych z długiem (1.1, D-4). `clear` zdejmuje termin i zwraca poprzedni
 * (albo `null`, gdy go nie było); `restore` oddaje termin, gdy użytkownik cofnie.
 */
export interface DebtReminderApi {
  clear: (noteId: string) => number | null;
  restore: (noteId: string, at: number) => void;
}

export function DebtsView({ addReminderNote, reminders }: { addReminderNote?: (title: string, content: string, at: number) => string; reminders?: DebtReminderApi }) {
  const entries = useDebts();
  const people = useMemo(() => balances(entries), [entries]);
  const sums = useMemo(() => totals(people), [people]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openPerson = people.find((p) => p.key === openKey) ?? null;

  return (
    <section aria-labelledby="debts-title" className="mx-auto w-full max-w-2xl px-4 pb-32 pt-6 desk:pt-8">
      <header className="mb-5">
        <p className="text-xs font-display uppercase tracking-[0.18em] text-muted-foreground">Prywatne</p>
        <h1 id="debts-title" className="font-display text-3xl font-bold tracking-tight">Długi</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kto ile pożyczył i ile już oddał.</p>
      </header>

      <Summary owedToMe={sums.owedToMe} iOwe={sums.iOwe} />
      <AddForm entries={entries} addReminderNote={addReminderNote} />
      <People people={people} onOpen={setOpenKey} />

      <PersonSheet person={openPerson} onClose={() => setOpenKey(null)} reminders={reminders} />
    </section>
  );
}

function Summary({ owedToMe, iOwe }: { owedToMe: number; iOwe: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-card border border-border/70 bg-card p-4 shadow-elevation-up" role="group" aria-label="Podsumowanie">
      <div>
        <p className="text-xs text-muted-foreground">Są nam winni</p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-success-ink" data-testid="debts-owed">{formatAmount(owedToMe)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Jesteś winien</p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-warning-ink" data-testid="debts-owe">{formatAmount(iOwe)}</p>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<DebtKind, string> = { lent: "Pożyczyłem", repaid: "Oddał mi", borrowed: "Pożyczyłem od", returned: "Oddałem" };

/** Dodawanie: osoba, rodzaj, kwota, dzień i notatka. Po zapisie zostaje osoba — kolejne pozycje dopisuje się szybciej. */
function AddForm({ entries, addReminderNote }: { entries: DebtEntry[]; addReminderNote?: (title: string, content: string, at: number) => string }) {
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState<DebtKind>("lent");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(localDayKey());
  const [note, setNote] = useState("");
  // Termin zwrotu (dzień, 9:00) — tylko przy pożyczce i długu; zapisuje się jako notatka z przypomnieniem.
  const [due, setDue] = useState("");
  const [error, setError] = useState<{ field: "person" | "amount" | "due"; text: string } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const people = useMemo(() => knownPeople(entries), [entries]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim()) { setError({ field: "person", text: "Podaj, kto to jest — imię albo nazwę." }); return; }
    if (parseAmount(amount) === null) { setError({ field: "amount", text: "Wpisz kwotę większą od zera, np. 150 albo 99,90." }); return; }
    const withDue = (kind === "lent" || kind === "borrowed") && !!due;
    if (withDue && due < localDayKey()) { setError({ field: "due", text: "Termin zwrotu nie może być w przeszłości." }); return; }
    const entry = addDebtFromText(person, kind, amount, note, at || undefined);
    if (!entry) { setError({ field: "person", text: "Nie udało się zapisać — sprawdź nazwę i datę." }); return; }
    if (withDue && addReminderNote) {
      // Notatka z przypomnieniem trafia do Dziś, Terminów i powiadomień; wpis pamięta jej id.
      const reminderAt = new Date(`${due}T09:00:00`).getTime();
      const title = kind === "lent" ? `Zwrot od ${entry.person}: ${formatAmount(entry.amount)}` : `Oddać ${entry.person}: ${formatAmount(entry.amount)}`;
      const noteId = addReminderNote(title, entry.note, reminderAt);
      updateDebt({ ...entry, dueNoteId: noteId });
    }
    setError(null);
    setAmount("");
    setNote("");
    setDue("");
    haptic("tap");
    toast.success(`${KIND_LABEL[kind]}: ${entry.person}, ${formatAmount(entry.amount)}`, {
      action: { label: "Cofnij", onClick: () => { removeDebt(entry.id); } },
    });
    amountRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Nowy wpis" className="mb-6 space-y-4 rounded-card border border-border/70 bg-card p-4">
      <div role="radiogroup" aria-label="Rodzaj wpisu" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {DEBT_KINDS.map((k) => {
          const selected = kind === k;
          // Pieniądze wychodzą od nas (pożyczka, zwrot): strzałka w górę. Wracają (spłata, dług u kogoś): w dół.
          const Icon = KIND_SIGN[k] > 0 ? ArrowUpRight : ArrowDownLeft;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setKind(k)}
              className={cn(
                "tap-target flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "bg-card text-foreground shadow-elevation-up" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="text-sm font-medium">Kto</label>
          <Input
            id={`${uid}-person`}
            list={`${uid}-people`}
            value={person}
            maxLength={DEBT_PERSON_MAX}
            placeholder="Imię albo nazwa"
            autoComplete="off"
            aria-invalid={error?.field === "person" || undefined}
            aria-describedby={error?.field === "person" ? `${uid}-err` : undefined}
            onChange={(e) => { setPerson(e.target.value); setError(null); }}
          />
          <datalist id={`${uid}-people`}>{people.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-amount`} className="text-sm font-medium">Kwota (zł)</label>
          <Input
            id={`${uid}-amount`}
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            placeholder="0,00"
            className="tabular-nums"
            aria-invalid={error?.field === "amount" || undefined}
            aria-describedby={error?.field === "amount" ? `${uid}-err` : undefined}
            onChange={(e) => { setAmount(e.target.value); setError(null); }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="text-sm font-medium">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={localDayKey()} onChange={(e) => setAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="text-sm font-medium">Za co <span className="font-normal text-muted-foreground">(nieobowiązkowe)</span></label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} placeholder="np. zaliczka na materiał" onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {(kind === "lent" || kind === "borrowed") && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-due`} className="text-sm font-medium">Termin zwrotu <span className="font-normal text-muted-foreground">(z przypomnieniem o 9:00, nieobowiązkowe)</span></label>
          <Input
            id={`${uid}-due`}
            type="date"
            value={due}
            min={localDayKey()}
            aria-invalid={error?.field === "due" || undefined}
            aria-describedby={error?.field === "due" ? `${uid}-err` : undefined}
            onChange={(e) => { setDue(e.target.value); setError(null); }}
          />
        </div>
      )}

      {error && <p id={`${uid}-err`} role="alert" className="text-sm text-destructive-ink">{error.text}</p>}

      <Button type="submit" className="w-full h-11 gap-2">
        <HandCoins className="h-4 w-4" aria-hidden />
        Zapisz wpis
      </Button>
    </form>
  );
}

function People({ people, onOpen }: { people: PersonDebts[]; onOpen: (key: string) => void }) {
  if (people.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border p-8 text-center">
        <p className="font-display text-lg font-semibold">Jeszcze nikogo tu nie ma</p>
        <p className="mt-1 text-sm text-muted-foreground">Dodaj pierwszą pożyczkę powyżej — zobaczysz od razu, kto ile jest winien.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2" aria-label="Osoby i salda">
      {people.map((p) => {
        const lent = p.entries.filter((e) => e.kind === "lent").reduce((s, e) => s + e.amount, 0);
        const share = repaidShare(p.entries);
        const settled = p.balance === 0;
        return (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => onOpen(p.key)}
              className="pressable group w-full rounded-card border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/50 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-base font-semibold truncate">{p.name}</span>
                {settled ? (
                  <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success-ink">Rozliczone</span>
                ) : (
                  <span className={cn("shrink-0 font-display text-base font-bold tabular-nums", p.balance > 0 ? "text-success-ink" : "text-warning-ink")}>
                    {p.balance > 0 ? formatAmount(p.balance) : `− ${formatAmount(-p.balance)}`}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="shrink-0">{settled ? "Oddane w całości" : p.balance > 0 ? "Do oddania" : "Jesteś winien"}</span>
                {lent > 0 && (
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Oddano ${share}% z ${formatAmount(lent)}`}>
                    <div className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${share}%` }} />
                  </div>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PersonSheet({ person, onClose, reminders }: { person: PersonDebts | null; onClose: () => void; reminders?: DebtReminderApi }) {
  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
        {person && <PersonHistory person={person} onDone={onClose} reminders={reminders} />}
      </SheetContent>
    </Sheet>
  );
}

/** Zdejmuje przypomnienia z notatek podanych wpisów; zwraca pary id → poprzedni termin do cofnięcia. */
function clearDueReminders(entries: DebtEntry[], reminders: DebtReminderApi | undefined): { noteId: string; at: number }[] {
  if (!reminders) return [];
  const cleared: { noteId: string; at: number }[] = [];
  for (const e of entries) {
    if (!e.dueNoteId) continue;
    const at = reminders.clear(e.dueNoteId);
    if (at !== null) cleared.push({ noteId: e.dueNoteId, at });
  }
  return cleared;
}

function PersonHistory({ person, onDone, reminders }: { person: PersonDebts; onDone: () => void; reminders?: DebtReminderApi }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [askRemove, setAskRemove] = useState<DebtEntry | null>(null);
  const settle = () => {
    // Saldo dodatnie: oni oddają nam. Ujemne: oddajemy my.
    const created = addDebt({ person: person.name, kind: person.balance > 0 ? "repaid" : "returned", amount: Math.abs(person.balance) });
    // M7: `null` = zapis odrzucony (np. pełna lista) — saldo nie zeruje się, więc nie mówimy „rozliczone”.
    if (!created) {
      toast.error("Nie udało się rozliczyć", { description: "Lista długów jest pełna albo dane są nieprawidłowe." });
      return;
    }
    // 1.1: saldo zerowe → przypomnienia o zwrocie tej osoby już nie dzwonią (z „Cofnij”).
    const cleared = clearDueReminders(person.entries, reminders);
    haptic("tap");
    toast.success(`Oddane w całości: ${person.name}`, {
      action: { label: "Cofnij", onClick: () => {
        removeDebt(created.id);
        for (const c of cleared) reminders?.restore(c.noteId, c.at);
      } },
    });
  };
  const remove = (e: DebtEntry, withReminder: boolean) => {
    const prev = removeDebt(e.id);
    if (!prev) return;
    const cleared = withReminder ? clearDueReminders([e], reminders) : [];
    toast("Wpis usunięty", { action: { label: "Cofnij", onClick: () => {
      restoreDebt(prev);
      for (const c of cleared) reminders?.restore(c.noteId, c.at);
    } } });
  };
  // D-4: wpis z terminem pyta, czy zdjąć też przypomnienie (bo bywa zostawiane celowo).
  const requestRemove = (e: DebtEntry) => {
    if (e.dueNoteId && reminders) setAskRemove(e);
    else remove(e, false);
  };
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="font-display text-2xl">{person.name}</SheetTitle>
        <SheetDescription>
          {person.balance === 0 ? "Rozliczone." : person.balance > 0 ? `Do oddania: ${formatAmount(person.balance)}` : `Jesteś winien: ${formatAmount(-person.balance)}`}
        </SheetDescription>
      </SheetHeader>

      {person.balance !== 0 && (
        <Button className="mt-4 w-full h-11 gap-2" onClick={() => { settle(); onDone(); }}>
          <Check />
          {person.balance > 0 ? `Oddał całość (${formatAmount(person.balance)})` : `Oddałem całość (${formatAmount(-person.balance)})`}
        </Button>
      )}

      <ol className="mt-5 space-y-2" aria-label="Historia">
        {person.entries.map((e) =>
          editingId === e.id ? (
            <li key={e.id}>
              <EditDebtForm entry={e} onDone={() => setEditingId(null)} />
            </li>
          ) : (
            <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", KIND_SIGN[e.kind] > 0 ? "bg-success/15 text-success-ink" : "bg-warning/15 text-warning-ink")} aria-hidden>
                {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{KIND_LABEL[e.kind]} · <span className="tabular-nums">{formatAmount(e.amount)}</span></p>
                <p className="text-xs text-muted-foreground">
                  {formatDay(e.at)}{e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Edytuj wpis: ${KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => setEditingId(e.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label={`Usuń wpis: ${KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => requestRemove(e)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ),
        )}
      </ol>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        Usunięty wpis można cofnąć z komunikatu na dole ekranu.
      </p>
      <AlertDialog open={!!askRemove} onOpenChange={(o) => !o && setAskRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć też przypomnienie o zwrocie?</AlertDialogTitle>
            <AlertDialogDescription>Wpis zniknie z długów. Notatka z terminem zostanie, jeśli wybierzesz „Zostaw przypomnienie”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <Button variant="outline" onClick={() => { if (askRemove) remove(askRemove, false); setAskRemove(null); }}>Zostaw przypomnienie</Button>
            <AlertDialogAction onClick={() => { if (askRemove) remove(askRemove, true); setAskRemove(null); }}>Usuń też przypomnienie</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Poprawka wpisu w miejscu: kwota, dzień, notatka, rodzaj i nazwa osoby. Zmiana imienia przenosi wpis
 * do innej osoby (grupowanie idzie po nazwie bez wielkości liter).
 */
function EditDebtForm({ entry, onDone }: { entry: DebtEntry; onDone: () => void }) {
  const uid = useId();
  const [person, setPerson] = useState(entry.person);
  const [kind, setKind] = useState<DebtKind>(entry.kind);
  const [amount, setAmount] = useState((entry.amount / 100).toFixed(2).replace(".", ","));
  const [at, setAt] = useState(entry.at);
  const [note, setNote] = useState(entry.note);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!normalizeName(person)) { setError("Podaj, kto to jest — imię albo nazwę."); return; }
    const grosze = parseAmount(amount);
    if (grosze === null) { setError("Wpisz kwotę większą od zera, np. 150 albo 99,90."); return; }
    if (!at) { setError("Podaj dzień wpisu."); return; }
    const updated = updateDebt({ ...entry, person: normalizeName(person), kind, amount: grosze, at, note: note.trim() });
    if (!updated) { setError("Nie udało się zapisać — wpis mógł zostać usunięty."); return; }
    haptic("tap");
    toast.success("Wpis poprawiony");
    onDone();
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save(); }}
      aria-label="Edycja wpisu"
      className="space-y-3 rounded-xl border border-primary/40 bg-background p-3"
    >
      <div role="radiogroup" aria-label="Rodzaj wpisu" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {DEBT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={cn("rounded-md px-2 py-1.5 text-xs font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring", kind === k ? "bg-card shadow-elevation-up" : "text-muted-foreground")}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="text-sm font-medium">Kto</label>
          <Input id={`${uid}-person`} value={person} maxLength={DEBT_PERSON_MAX} onChange={(e) => setPerson(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-amount`} className="text-sm font-medium">Kwota (zł)</label>
          <Input id={`${uid}-amount`} inputMode="decimal" value={amount} className="tabular-nums" onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="text-sm font-medium">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={localDayKey()} onChange={(e) => setAt(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="text-sm font-medium">Za co</label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive-ink">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-11 flex-1">Zapisz zmiany</Button>
        <Button type="button" variant="ghost" size="sm" className="h-11" onClick={onDone}>Anuluj</Button>
      </div>
    </form>
  );
}

const formatDay = (at: string) => new Date(`${at}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

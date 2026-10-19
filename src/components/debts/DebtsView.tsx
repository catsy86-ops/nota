import { useId, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, HandCoins, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { addDebt, addDebtFromText, removeDebt, restoreDebt, useDebts } from "@/lib/debts/store";
import { balances, DEBT_KINDS, DEBT_NOTE_MAX, DEBT_PERSON_MAX, formatAmount, KIND_SIGN, knownPeople, parseAmount, totals, type DebtEntry, type DebtKind, type PersonDebts } from "@/lib/debts/model";

/**
 * Długi: kto ile u nas pożyczył i ile oddał. Góra — podsumowanie i szybki wpis,
 * dół — osoby z saldem; stuknięcie w osobę otwiera jej historię.
 */
export function DebtsView() {
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
      <AddForm entries={entries} />
      <People people={people} onOpen={setOpenKey} />

      <PersonSheet person={openPerson} onClose={() => setOpenKey(null)} />
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
        <p className="text-xs text-muted-foreground">My jesteśmy winni</p>
        <p className="mt-1 font-display text-xl font-bold tabular-nums text-warning-ink" data-testid="debts-owe">{formatAmount(iOwe)}</p>
      </div>
    </div>
  );
}

const KIND_LABEL: Record<DebtKind, string> = { lent: "Pożyczyłem", repaid: "Oddał mi", borrowed: "Pożyczyłem od", returned: "Oddałem" };

/** Dodawanie: osoba, rodzaj, kwota, dzień i notatka. Po zapisie zostaje osoba — kolejne pozycje dopisuje się szybciej. */
function AddForm({ entries }: { entries: DebtEntry[] }) {
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState<DebtKind>("lent");
  const [amount, setAmount] = useState("");
  const [at, setAt] = useState(localDayKey());
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ field: "person" | "amount"; text: string } | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const people = useMemo(() => knownPeople(entries), [entries]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim()) { setError({ field: "person", text: "Podaj, kto to jest — imię albo nazwę." }); return; }
    if (parseAmount(amount) === null) { setError({ field: "amount", text: "Wpisz kwotę większą od zera, np. 150 albo 99,90." }); return; }
    const entry = addDebtFromText(person, kind, amount, note, at || undefined);
    if (!entry) { setError({ field: "person", text: "Nie udało się zapisać — sprawdź nazwę i datę." }); return; }
    setError(null);
    setAmount("");
    setNote("");
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
        const repaid = p.entries.filter((e) => e.kind === "repaid").reduce((s, e) => s + e.amount, 0);
        const share = lent > 0 ? Math.min(100, Math.round((repaid / lent) * 100)) : 100;
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
                <span className="shrink-0">{settled ? "Oddane w całości" : p.balance > 0 ? "Do oddania" : "Ty jesteś winien"}</span>
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

function PersonSheet({ person, onClose }: { person: PersonDebts | null; onClose: () => void }) {
  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
        {person && <PersonHistory person={person} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function PersonHistory({ person, onDone }: { person: PersonDebts; onDone: () => void }) {
  const settle = () => {
    // Saldo dodatnie: oni oddają nam. Ujemne: oddajemy my.
    addDebt({ person: person.name, kind: person.balance > 0 ? "repaid" : "returned", amount: Math.abs(person.balance) });
    haptic("tap");
    toast.success(`Oddane w całości: ${person.name}`);
  };
  const remove = (e: DebtEntry) => {
    const prev = removeDebt(e.id);
    if (!prev) return;
    toast("Wpis usunięty", { action: { label: "Cofnij", onClick: () => restoreDebt(prev) } });
  };
  return (
    <>
      <SheetHeader className="text-left">
        <SheetTitle className="font-display text-2xl">{person.name}</SheetTitle>
        <SheetDescription>
          {person.balance === 0 ? "Rozliczone." : person.balance > 0 ? `Do oddania: ${formatAmount(person.balance)}` : `Ty jesteś winien: ${formatAmount(-person.balance)}`}
        </SheetDescription>
      </SheetHeader>

      {person.balance !== 0 && (
        <Button className="mt-4 w-full h-11 gap-2" onClick={() => { settle(); onDone(); }}>
          <Check />
          {person.balance > 0 ? `Oddał całość (${formatAmount(person.balance)})` : `Oddałem całość (${formatAmount(-person.balance)})`}
        </Button>
      )}

      <ol className="mt-5 space-y-2" aria-label="Historia">
        {person.entries.map((e) => (
          <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", KIND_SIGN[e.kind] > 0 ? "bg-warning/15 text-warning-ink" : "bg-success/15 text-success-ink")} aria-hidden>
              {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{KIND_LABEL[e.kind]} · <span className="tabular-nums">{formatAmount(e.amount)}</span></p>
              <p className="text-xs text-muted-foreground">
                {formatDay(e.at)}{e.note ? ` · ${e.note}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" aria-label={`Usuń wpis: ${KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => remove(e)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Undo2 className="h-3.5 w-3.5" aria-hidden />
        Usunięty wpis można cofnąć z komunikatu na dole ekranu.
      </p>
    </>
  );
}

const formatDay = (at: string) => new Date(`${at}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

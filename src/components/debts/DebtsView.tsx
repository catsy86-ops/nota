import { useEffect, useId, useMemo, useRef, useState } from "react";
import { StatusPanel } from "@/components/StatusPanel";
import { Stat } from "@/components/ui/stat";
import { ArrowDownLeft, ArrowUpRight, Check, ChevronDown, Combine, Download, Eye, EyeOff, HandCoins, Pencil, Plus, Search, Send, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDayClock } from "@/lib/dayClock";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { createPersistedStore } from "@/lib/persistedStore";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { addDebt, addDebtFromText, removeDebt, renamePeople, restoreDebt, restoreDebts, updateDebt, useDebts } from "@/lib/debts/store";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { downloadBlob } from "@/lib/downloadBlob";
import { amountText, setHideAmounts, useHideAmounts } from "@/lib/debts/hideAmounts";
import { PageActions } from "@/components/PageActions";
import { avatarHue, balances, debtsCsv, initialOf, debtSide, doubleSettle, foldName, personKey, personStatement, runningBalances, DEBT_KIND_LABEL, DEBT_KINDS, DEBT_NOTE_LABEL, DEBT_NOTE_MAX, DEBT_PERSON_MAX, formatAmount, KIND_SIGN, knownPeople, normalizeName, parseAmount, repaidShare, totals, type DebtEntry, type DebtKind, type PersonDebts } from "@/lib/debts/model";

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
  /** Bieżący termin notatki (1.5: edycja terminu zwrotu); `null` = bez terminu albo notatki nie ma. */
  get: (noteId: string) => number | null;
  /** Czy notatka jeszcze istnieje (także w archiwum i koszu) — usunięta nie przyjmie nowego terminu. */
  has: (noteId: string) => boolean;
  /** Usuwa notatkę utworzoną przez edycję, gdy użytkownik ją cofnie (bez osieroconych notatek). */
  remove: (noteId: string) => void;
}

/** Notatka z przypomnieniem (`Index`); `labels` — etykiety notatki (1.2: `długi`, poza Skrzynką). */
type AddReminderNote = (title: string, content: string, at: number, labels: string[]) => string;

/** Tytuł notatki terminu; przy ukrytych kwotach bez kwoty (1.2) — tytuł widać w powiadomieniu i na Dziś. */
const dueTitle = (kind: DebtKind, person: string, amount: number, hidden: boolean) =>
  `${kind === "lent" ? "Zwrot od" : "Oddać"} ${person}${hidden ? "" : `: ${formatAmount(amount)}`}`;

/** Termin zwrotu: dzień o 9:00 (ms). */
const dueAt = (day: string) => new Date(`${day}T09:00:00`).getTime();

const hasDue = (kind: DebtKind) => kind === "lent" || kind === "borrowed";

// Formularz rozwinięty — zapamiętany na tym urządzeniu (3.6: zwijany na każdym ekranie, nie tylko na telefonie).
const formOpenStore = createPersistedStore<boolean>("kaczy.debts.formOpen.v1", false, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

/** Powyżej tylu osób nad listą jest pole szukania (2.5). */
const SEARCH_FROM = 8;

export function DebtsView({ addReminderNote, reminders }: { addReminderNote?: AddReminderNote; reminders?: DebtReminderApi }) {
  const entries = useDebts();
  const people = useMemo(() => balances(entries), [entries]);
  const sums = useMemo(() => totals(people), [people]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openPerson = people.find((p) => p.key === openKey) ?? null;
  const hidden = useHideAmounts();
  const formOpen = formOpenStore.use();
  const formId = useId();
  // 2.1: „+ Wpis z {imię}” z arkusza osoby — nowy formularz z tą osobą (klucz wymusza świeży stan).
  const [prefill, setPrefill] = useState<{ name: string; n: number; focus: "person" | "amount" } | null>(null);
  const newEntryFor = (name: string) => {
    setOpenKey(null);
    formOpenStore.set(true);
    setPrefill({ name, n: Date.now(), focus: "amount" });
  };
  // 4.4: „Dodaj pierwszy wpis” z pustego stanu — formularz otwarty, kursor w „Kto”.
  const startFirst = () => {
    formOpenStore.set(true);
    setPrefill({ name: "", n: Date.now(), focus: "person" });
  };

  return (
    // Tytuł, opis i „Ukryj kwoty” są w główce kartki (`ViewTitle`, nowy plan 1.1); kolumna formularza przy lewej
    // krawędzi główki (1.2).
    <section aria-label="Długi" className="w-full max-w-(--page-form) pb-32">
      <PageActions>
        <Button
          variant="ghost"
          size="sm"
          className="tap-target shrink-0 gap-1.5 coarse:h-11"
          onClick={() => { setHideAmounts(!hidden); haptic("tap"); }}
        >
          {hidden ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {hidden ? "Pokaż kwoty" : "Ukryj kwoty"}
        </Button>
      </PageActions>

      {/* 3.6: bez wpisów zostaje jeden pusty stan (jego „Dodaj pierwszy wpis” rozwija formularz), bez saldo 0,00 zł obok.
          Z wpisami formularz zwija się do „Nowy wpis” na każdym ekranie. */}
      {entries.length > 0 && <Summary owedToMe={sums.owedToMe} iOwe={sums.iOwe} hidden={hidden} />}
      {(entries.length > 0 || formOpen) && (
        <div className="mt-4">
          <Button variant="outline" className="h-11 w-full gap-2 sm:w-auto" aria-expanded={formOpen} aria-controls={formId} onClick={() => { formOpenStore.set(!formOpen); haptic("tap"); }}>
            {formOpen ? <ChevronDown className="h-4 w-4 rotate-180" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {formOpen ? "Zwiń formularz" : "Nowy wpis"}
          </Button>
        </div>
      )}
      <div id={formId} className={cn("mt-4", !formOpen && "hidden")}>
        <AddForm key={prefill?.n ?? 0} entries={entries} addReminderNote={addReminderNote} hidden={hidden} initialPerson={prefill?.name} focusAmount={prefill?.focus === "amount"} focusPerson={prefill?.focus === "person"} />
      </div>
      {/* Gdy formularz otwarty, pusty stan z własnym przyciskiem znikałby pod nim — zostaje sam formularz. */}
      {!(entries.length === 0 && formOpen) && <People people={people} onOpen={setOpenKey} hidden={hidden} onStart={startFirst} />}
      {entries.length > 0 && (
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" className="tap-target gap-1.5 text-muted-foreground" onClick={() => {
            // 3.4: wszystkie wpisy w jednym pliku (kwoty zawsze — eksport to wyraźne stuknięcie).
            downloadBlob(new Blob([debtsCsv(entries)], { type: "text/csv;charset=utf-8" }), `notki-dlugi-${localDayKey()}.csv`);
            toast.success("Zapisano plik CSV z długami");
          }}>
            <Download className="h-4 w-4" aria-hidden />Eksport CSV
          </Button>
        </div>
      )}

      <PersonSheet person={openPerson} onClose={() => setOpenKey(null)} reminders={reminders} addReminderNote={addReminderNote} people={entries} hidden={hidden} onNewEntry={newEntryFor} others={people} onRekey={setOpenKey} />
    </section>
  );
}

function Summary({ owedToMe, iOwe, hidden }: { owedToMe: number; iOwe: number; hidden: boolean }) {
  const total = owedToMe + iOwe;
  const owedShare = total > 0 ? Math.round((owedToMe / total) * 100) : 0;
  // Kwota przelicza się płynnie (4.1); przy ukrytych kwotach — „•••” bez animacji.
  const money = (v: number, testId: string) => hidden
    ? <span data-testid={testId}>{amountText(v, true)}</span>
    : <AnimatedNumber value={v} format={formatAmount} data-testid={testId} />;
  return (
    // Liczby przez `Stat` (nowy plan 2.3): ten sam wygląd co w Grafiku i Pracy.
    <div className="rounded-card border border-border bg-card p-4 sm:p-5" role="group" aria-label="Podsumowanie">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Są nam winni" value={money(owedToMe, "debts-owed")} tone="success" />
        <Stat label="Jesteś winien" value={money(iOwe, "debts-owe")} tone="warning" align="end" />
      </div>
      {total > 0 && (
        // 4.1: proporcja w jednym pasku — lewa część „nam winni”, prawa „Ty winien”.
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Proporcja: ${owedShare}% to, co nam winni, ${100 - owedShare}% to, co jesteś winien`} data-testid="debts-ratio">
          {owedToMe > 0 && <div className="h-full rounded-full bg-success transition-[flex-grow] duration-500 motion-reduce:transition-none" style={{ flexGrow: owedToMe }} />}
          {iOwe > 0 && <div className="h-full rounded-full bg-warning transition-[flex-grow] duration-500 motion-reduce:transition-none" style={{ flexGrow: iOwe }} />}
        </div>
      )}
    </div>
  );
}

/**
 * Wybór rodzaju (1.4): `ToggleGroup` z `ui/` — jeden przystanek Tab, strzałki, 44 px na dotyku.
 * Pieniądze wychodzą od nas (pożyczka, zwrot): strzałka w górę. Wracają (spłata, dług u kogoś): w dół.
 */
function KindPicker({ value, onChange }: { value: DebtKind; onChange: (k: DebtKind) => void }) {
  return (
    <ToggleGroup value={value} onValueChange={(v) => onChange(v as DebtKind)} aria-label="Rodzaj wpisu" className="grid-flow-row grid-cols-2 @max-[18rem]:grid-cols-1">
      {DEBT_KINDS.map((k) => {
        const Icon = KIND_SIGN[k] > 0 ? ArrowUpRight : ArrowDownLeft;
        return (
          <ToggleGroupItem key={k} value={k} className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Icon className="h-4 w-4" aria-hidden />
            {DEBT_KIND_LABEL[k]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/** Dodawanie: osoba, rodzaj, kwota, dzień i notatka. Po zapisie zostaje osoba — kolejne pozycje dopisuje się szybciej. */
function AddForm({ entries, addReminderNote, hidden, initialPerson, focusAmount, focusPerson }: {
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
  const [error, setError] = useState<{ field: "person" | "amount" | "due"; text: string } | null>(null);
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
    if (withDue && due < today) { setError({ field: "due", text: "Termin zwrotu nie może być w przeszłości." }); return; }
    const entry = addDebtFromText(person, kind, amount, note, at || undefined);
    if (!entry) { setError({ field: "person", text: "Nie udało się zapisać — sprawdź nazwę i datę." }); return; }
    if (withDue && addReminderNote) {
      // Notatka z przypomnieniem trafia do Dziś, Terminów i powiadomień; wpis pamięta jej id.
      const noteId = addReminderNote(dueTitle(kind, entry.person, entry.amount, hidden), entry.note, dueAt(due), [DEBT_NOTE_LABEL]);
      updateDebt({ ...entry, dueNoteId: noteId });
    }
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
    <form onSubmit={submit} noValidate aria-label="Nowy wpis" className="@container mb-6 space-y-4 rounded-card border border-border/70 bg-card p-4">
      <KindPicker value={kind} onChange={setKind} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="text-sm font-medium">Kto</label>
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
          <label htmlFor={`${uid}-amount`} className="text-sm font-medium">Kwota (zł)</label>
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

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="text-sm font-medium">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={today} onChange={(e) => setPickedAt(e.target.value || null)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="text-sm font-medium">Za co <span className="font-normal text-muted-foreground">(nieobowiązkowe)</span></label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} placeholder="np. zaliczka na materiał" onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      {hasDue(kind) && (
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-due`} className="text-sm font-medium">Termin zwrotu <span className="font-normal text-muted-foreground">(z przypomnieniem o 9:00, nieobowiązkowe)</span></label>
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
        <HandCoins className="h-4 w-4" aria-hidden />
        Zapisz wpis
      </Button>
    </form>
  );
}

function People({ people, onOpen, hidden, onStart }: { people: PersonDebts[]; onOpen: (key: string) => void; hidden: boolean; onStart?: () => void }) {
  const [query, setQuery] = useState("");
  const [showSettled, setShowSettled] = useState(false);
  const settledId = useId();
  if (people.length === 0) {
    return (
      // Ten sam pusty stan co w innych działach (`StatusPanel`, nowy plan 2.5), z własnym szkicem portfela.
      <div data-testid="debts-empty">
        <StatusPanel size="inline" art={<EmptySketch />} className="p-8"
          title="Jeszcze nikogo tu nie ma"
          description="Zapisz pierwszą pożyczkę — od razu zobaczysz, kto ile jest winien."
          actions={onStart && <Button className="h-11 gap-2" onClick={onStart}><Plus className="h-4 w-4" aria-hidden />Dodaj pierwszy wpis</Button>} />
      </div>
    );
  }
  // 2.5: szukanie przy dłuższej liście; wynik obejmuje też rozliczonych (bez zwijania).
  const q = foldName(query);
  const found = q ? people.filter((p) => foldName(p.name).includes(q)) : people;
  const active = found.filter((p) => p.balance !== 0);
  const settled = found.filter((p) => p.balance === 0);
  return (
    <div className="space-y-2">
      {people.length > SEARCH_FROM && (
        <label className="relative block">
          <span className="sr-only">Szukaj osoby</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input type="search" enterKeyHint="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj osoby" className="h-11 pl-9" />
        </label>
      )}
      {q && found.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground" role="status">Nikogo takiego — sprawdź imię.</p>}
      {active.length > 0 && <PersonList people={active} onOpen={onOpen} hidden={hidden} label="Osoby i salda" />}
      {settled.length > 0 && (q ? (
        <PersonList people={settled} onOpen={onOpen} hidden={hidden} label="Rozliczeni" />
      ) : (
        // 2.4: rozliczeni na dole, domyślnie zwinięci.
        <div className="pt-2">
          <button
            type="button"
            aria-expanded={showSettled}
            aria-controls={settledId}
            onClick={() => setShowSettled((v) => !v)}
            className="pressable inline-flex items-center gap-1.5 rounded-field px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground coarse:min-h-11"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", showSettled && "rotate-180")} aria-hidden />
            Rozliczeni ({settled.length})
          </button>
          <div id={settledId} hidden={!showSettled} className="mt-2">
            <PersonList people={settled} onOpen={onOpen} hidden={hidden} label="Rozliczeni" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonList({ people, onOpen, hidden, label }: { people: PersonDebts[]; onOpen: (key: string) => void; hidden: boolean; label: string }) {
  return (
    <ul className="space-y-2" aria-label={label}>
      {people.map((p) => {
        // 1.3: pasek strony winnej — także przy samym „Pożyczyłem od”.
        const { side } = debtSide(p.entries);
        const share = repaidShare(p.entries);
        const settled = p.balance === 0;
        return (
          <li key={p.key}>
            <button
              type="button"
              onClick={() => onOpen(p.key)}
              className="pressable group w-full rounded-card border border-border/70 bg-card p-4 text-left transition-colors hover:border-primary/50 outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="debt-avatar grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold" data-avatar={avatarHue(p.name)} aria-hidden>{initialOf(p.name)}</span>
                  <span className="font-display text-base font-semibold truncate">{p.name}</span>
                </span>
                {settled ? (
                  <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success-ink">Rozliczone</span>
                ) : (
                  <span className={cn("shrink-0 font-mono text-base font-semibold tabular-nums", p.balance > 0 ? "text-success-ink" : "text-warning-ink")}>
                    {p.balance > 0 ? amountText(p.balance, hidden) : `− ${amountText(-p.balance, hidden)}`}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="shrink-0">{settled ? "Oddane w całości" : p.balance > 0 ? "Do oddania" : "Jesteś winien"}</span>
                {side > 0 && (
                  <div className="debt-bar h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Oddano ${share}% z ${amountText(side, hidden)}`}>
                    <div className={cn("debt-bar-fill h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", p.balance < 0 ? "bg-warning" : "bg-success")} style={{ width: `${share}%` }} />
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

interface HistoryProps {
  reminders?: DebtReminderApi;
  addReminderNote?: AddReminderNote;
  /** Wszystkie wpisy — podpowiedzi osób w edycji (1.5). */
  people: DebtEntry[];
  hidden: boolean;
  /** 2.1: „+ Wpis z {imię}” — formularz z tą osobą. */
  onNewEntry?: (name: string) => void;
  /** 3.1: wszystkie osoby (do „Połącz z…”) i zmiana klucza otwartej osoby po zmianie nazwy. */
  others?: PersonDebts[];
  onRekey?: (key: string) => void;
}

function PersonSheet({ person, onClose, ...rest }: { person: PersonDebts | null; onClose: () => void } & HistoryProps) {
  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" snap className="overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+16px)] border-t border-border/60">
        {person && <PersonHistory person={person} onDone={onClose} {...rest} />}
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

function PersonHistory({ person, onDone, reminders, addReminderNote, people, hidden, onNewEntry, others = [], onRekey }: { person: PersonDebts; onDone: () => void } & HistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [askRemove, setAskRemove] = useState<DebtEntry | null>(null);
  const running = useMemo(() => runningBalances(person.entries), [person.entries]);
  const twice = useMemo(() => doubleSettle(person.entries), [person.entries]);
  const names = useMemo(() => knownPeople(people), [people]);
  // 2.2: historia z nagłówkami miesięcy; indeks zostaje ten z listy (saldo po wpisie).
  const months = useMemo(() => {
    const out: { key: string; items: { e: DebtEntry; i: number }[] }[] = [];
    person.entries.forEach((e, i) => {
      const key = e.at.slice(0, 7);
      const last = out[out.length - 1];
      if (last?.key === key) last.items.push({ e, i }); else out.push({ key, items: [{ e, i }] });
    });
    return out;
  }, [person.entries]);
  const settle = () => {
    // Saldo dodatnie: oni oddają nam. Ujemne: oddajemy my.
    const created = addDebt({ person: person.name, kind: person.balance > 0 ? "repaid" : "returned", amount: Math.abs(person.balance), settle: true });
    // M7: `null` = zapis odrzucony (np. pełna lista) — saldo nie zeruje się, więc nie mówimy „rozliczone”.
    if (!created) {
      haptic("warn");
      toast.error("Nie udało się rozliczyć", { description: "Lista długów jest pełna albo dane są nieprawidłowe." });
      return;
    }
    // 1.1: saldo zerowe → przypomnienia o zwrocie tej osoby już nie dzwonią (z „Cofnij”).
    const cleared = clearDueReminders(person.entries, reminders);
    haptic("success");
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
    toast("Usunięto wpis", { action: { label: "Cofnij", onClick: () => {
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
          {person.balance === 0 ? "Rozliczone." : person.balance > 0 ? `Do oddania: ${amountText(person.balance, hidden)}` : `Jesteś winien: ${amountText(-person.balance, hidden)}`}
        </SheetDescription>
      </SheetHeader>
      <PersonTools person={person} others={others} onRekey={onRekey} />

      {twice && (
        // 1.6: „Oddał całość” na dwóch telefonach naraz — saldo przeskoczyło na drugą stronę.
        <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-warning/50 bg-warning/10 p-3 text-sm" data-testid="debts-double-settle">
          <TriangleAlert className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
          <span className="min-w-0 flex-1">Rozliczono dwa razy — usunąć drugi wpis?</span>
          <Button size="sm" variant="outline" className="h-11" onClick={() => remove(twice, false)}>Usuń drugi wpis</Button>
        </div>
      )}

      {person.balance !== 0 && !twice && (
        <Button className="mt-4 w-full h-11 gap-2" onClick={() => { settle(); onDone(); }}>
          <Check />
          {person.balance > 0 ? `Oddał całość (${amountText(person.balance, hidden)})` : `Oddałem całość (${amountText(-person.balance, hidden)})`}
        </Button>
      )}

      {onNewEntry && (
        <Button variant="outline" className="mt-2 w-full h-11 gap-2" onClick={() => onNewEntry(person.name)}>
          <Plus className="h-4 w-4" aria-hidden />
          Wpis z {person.name}
        </Button>
      )}

      <div className="mt-5 space-y-4" role="group" aria-label="Historia">
        {months.map((m) => (
          <section key={m.key} aria-label={monthLabel(m.key)}>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{monthLabel(m.key)}</h3>
            <ol className="space-y-2">
              {m.items.map(({ e, i }) =>
                editingId === e.id ? (
                  <li key={e.id}>
                    <EditDebtForm entry={e} people={names} reminders={reminders} addReminderNote={addReminderNote} hidden={hidden} onDone={() => setEditingId(null)} />
                  </li>
                ) : (
                  <li key={e.id} className="flex items-center gap-3 rounded-card border border-border/60 bg-background p-3">
                    <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", KIND_SIGN[e.kind] > 0 ? "bg-success/15 text-success-ink" : "bg-warning/15 text-warning-ink")} aria-hidden>
                      {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{DEBT_KIND_LABEL[e.kind]} · <span className="tabular-nums">{amountText(e.amount, hidden)}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {formatDay(e.at)}{e.note ? ` · ${e.note}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Saldo po tym: {running[i] === 0 ? "0" : `${running[i] > 0 ? "" : "− "}${amountText(Math.abs(running[i]), hidden)}`}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Edytuj wpis: ${DEBT_KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => setEditingId(e.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Usuń wpis: ${DEBT_KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => requestRemove(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ),
              )}
            </ol>
          </section>
        ))}
      </div>
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
 * Poprawka wpisu w miejscu (1.5 — jak dodawanie): kwota, dzień, notatka, rodzaj, nazwa osoby i termin
 * zwrotu. Zmiana imienia przenosi wpis do innej osoby (grupowanie idzie po nazwie bez wielkości liter).
 * Termin tworzy, zmienia albo zdejmuje przypomnienie notatki; „Cofnij” oddaje wpis i termin.
 */
function EditDebtForm({ entry, people, reminders, addReminderNote, hidden, onDone }: {
  entry: DebtEntry;
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
      className="@container space-y-3 rounded-card border border-primary/40 bg-background p-3"
    >
      <KindPicker value={kind} onChange={setKind} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-person`} className="text-sm font-medium">Kto</label>
          <Input id={`${uid}-person`} list={`${uid}-people`} autoComplete="off" value={person} maxLength={DEBT_PERSON_MAX} className="shake-invalid" {...invalid("person")} onChange={(e) => { setPerson(e.target.value); setError(null); }} />
          <datalist id={`${uid}-people`}>{people.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-amount`} className="text-sm font-medium">Kwota (zł)</label>
          <Input id={`${uid}-amount`} inputMode="decimal" value={amount} className="shake-invalid tabular-nums" {...invalid("amount")} onChange={(e) => { setAmount(e.target.value); setError(null); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-date`} className="text-sm font-medium">Dzień</label>
          <Input id={`${uid}-date`} type="date" value={at} max={localDayKey()} className="shake-invalid" {...invalid("at")} onChange={(e) => { setAt(e.target.value); setError(null); }} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${uid}-note`} className="text-sm font-medium">Za co</label>
          <Input id={`${uid}-note`} value={note} maxLength={DEBT_NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
        </div>
        {dueEditable && (
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`${uid}-due`} className="text-sm font-medium">Termin zwrotu <span className="font-normal text-muted-foreground">(9:00; puste — bez przypomnienia)</span></label>
            <Input id={`${uid}-due`} type="date" value={due} className="shake-invalid" {...invalid("due")} onChange={(e) => { setDue(e.target.value); setError(null); }} />
          </div>
        )}
      </div>
      {error && <p id={`${uid}-err`} role="alert" className="text-sm text-destructive-ink">{error.text}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-11 flex-1">Zapisz zmiany</Button>
        <Button type="button" variant="ghost" size="sm" className="h-11" onClick={onDone}>Anuluj</Button>
      </div>
    </form>
  );
}

/** 4.4: portfel i moneta kreską — rysują się przy pojawieniu (`.debt-sketch` w `index.css`). */
function EmptySketch() {
  return (
    <svg viewBox="0 0 120 80" className="debt-sketch mx-auto h-20 w-28 text-primary" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path pathLength={1} d="M18 26 C18 21 21 18 26 18 L86 18 C91 18 94 21 94 26 L94 62 C94 67 91 70 86 70 L26 70 C21 70 18 67 18 62 Z" />
      <path pathLength={1} d="M18 30 L70 30" />
      <path pathLength={1} d="M78 38 L100 38 C102 38 103 39 103 41 L103 51 C103 53 102 54 100 54 L78 54 C75 54 73 52 73 49 L73 43 C73 40 75 38 78 38 Z" />
      <circle pathLength={1} cx="82" cy="46" r="2.5" />
      <circle pathLength={1} cx="104" cy="16" r="9" />
      <path pathLength={1} d="M101 16 L107 16 M104 12 L104 20" />
    </svg>
  );
}

/** „2026-11” → „listopad 2026”. */
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

/**
 * 3.1–3.2 Narzędzia osoby: „Wyślij” (wiadomość albo schowek), „Zmień nazwę” (wszystkie wpisy naraz)
 * i „Połącz z…” (wpisy innej osoby pod tę nazwę). Zmiany jedną transakcją Yjs, z „Cofnij”.
 */
function PersonTools({ person, others, onRekey }: { person: PersonDebts; others: PersonDebts[]; onRekey?: (key: string) => void }) {
  const uid = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(person.name);
  const [mergeKey, setMergeKey] = useState<string | null>(null);
  const merge = others.find((p) => p.key === mergeKey) ?? null;
  const candidates = others.filter((p) => p.key !== person.key);

  const send = async () => {
    const outcome = await shareOrCopy({ title: `${person.name} — rozliczenie`, text: personStatement(person) });
    if (outcome === "copied") toast.success("Skopiowano rozliczenie — wklej je w wiadomości");
    else if (outcome === "failed") toast.error("Nie udało się wysłać ani skopiować");
  };

  const rename = () => {
    const clean = normalizeName(name);
    if (!clean || clean === person.name) { setRenaming(false); return; }
    const prev = renamePeople([person.key], clean);
    if (!prev) { toast.error("Nie udało się zmienić nazwy"); return; }
    haptic("success");
    setRenaming(false);
    onRekey?.(personKey(clean));
    const merged = others.some((p) => p.key === personKey(clean) && p.key !== person.key);
    toast.success(merged ? `Połączono z „${clean}”` : `Nowa nazwa: ${clean}`, { action: { label: "Cofnij", onClick: () => { restoreDebts(prev); onRekey?.(person.key); } } });
  };

  const doMerge = () => {
    if (!merge) return;
    const prev = renamePeople([merge.key], person.name);
    setMergeKey(null);
    if (!prev) { toast.error("Nie udało się połączyć"); return; }
    haptic("success");
    toast.success(`Połączono: wpisy „${merge.name}” są teraz pod „${person.name}”`, { action: { label: "Cofnij", onClick: () => restoreDebts(prev) } });
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="tap-target gap-1.5" onClick={() => void send()}>
          <Send className="h-4 w-4" aria-hidden />Wyślij
        </Button>
        <Button variant="outline" size="sm" className="tap-target gap-1.5" aria-expanded={renaming} onClick={() => { setName(person.name); setRenaming((v) => !v); }}>
          <Pencil className="h-4 w-4" aria-hidden />Zmień nazwę
        </Button>
        {candidates.length > 0 && (
          <label className="inline-flex items-center gap-1.5">
            <Combine className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">Połącz z inną osobą</span>
            <select
              value=""
              onChange={(e) => { if (e.target.value) setMergeKey(e.target.value); }}
              className="h-9 rounded-field border border-input bg-background px-2 text-sm coarse:h-11"
            >
              <option value="">Połącz z…</option>
              {candidates.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
          </label>
        )}
      </div>
      {renaming && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); rename(); }} aria-label="Zmiana nazwy osoby">
          <label htmlFor={`${uid}-name`} className="sr-only">Nowa nazwa</label>
          <Input id={`${uid}-name`} value={name} maxLength={DEBT_PERSON_MAX} autoFocus onChange={(e) => setName(e.target.value)} className="h-11 flex-1" />
          <Button type="submit" className="h-11">Zapisz</Button>
        </form>
      )}
      <AlertDialog open={!!merge} onOpenChange={(o) => !o && setMergeKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Połączyć „{merge?.name}” z „{person.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Wszystkie wpisy „{merge?.name}” przejdą pod nazwę „{person.name}”, a saldo się zsumuje. Można to cofnąć z komunikatu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={doMerge}>Połącz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const formatDay = (at: string) => new Date(`${at}T12:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

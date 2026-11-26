import { useId, useMemo, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { listItemMotion } from "@/lib/cardMotion";
import { useMotionPref } from "@/hooks/useMotionPref";
import { Sparkline } from "@/components/ui/mini-charts";
import { ArrowDownLeft, ArrowUpRight, Check, Combine, Pencil, Plus, Send, Trash2, TriangleAlert, Undo2, BellRing, FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { addDebt, removeDebt, renamePeople, restoreDebt, restoreDebts, useDebtProofs } from "@/lib/debts/store";
import { DebtProofThumb } from "./DebtProof";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { paymentLine } from "@/lib/paymentDetails";
import { useDebtPayment } from "@/lib/debts/payment";
import { Checkbox } from "@/components/ui/checkbox";
import { amountText } from "@/lib/debts/hideAmounts";
import { doubleSettle, openEntries, personKey, personReminder, personStatement, reminderDue, runningBalances, DEBT_KIND_LABEL, DEBT_PERSON_MAX, formatAmount, KIND_SIGN, knownPeople, normalizeName, type DebtEntry, type PersonDebts } from "@/lib/debts/model";
import { cardVariant } from "@/components/ui/card";
import { localDayKey } from "@/lib/dayDone";
import { DebtPlans } from "./DebtPlans";
import { EditDebtForm } from "./EditDebtForm";
import type { AddReminderNote, DebtReminderApi } from "./debtTypes";

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

export function PersonSheet({ person, onClose, ...rest }: { person: PersonDebts | null; onClose: () => void } & HistoryProps) {
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
  const rowMotion = listItemMotion(useMotionPref().reduced);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [askRemove, setAskRemove] = useState<DebtEntry | null>(null);
  const proofs = useDebtProofs();
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
        {/* W5.3: przebieg salda od pierwszego wpisu; przy ukrytych kwotach nie, bo kształt zdradza wielkości. */}
        {!hidden && running.length >= 3 && (
          <Sparkline values={[...running].reverse()}
            className={cn("mt-1 h-7 w-full max-w-60", person.balance > 0 ? "text-success-ink" : person.balance < 0 ? "text-warning-ink" : "text-muted-foreground")} />
        )}
      </SheetHeader>
      <PersonTools person={person} others={others} onRekey={onRekey} reminders={reminders} />
      <DebtPlans person={person} hidden={hidden} />

      {twice && (
        // 1.6: „Oddał całość” na dwóch telefonach naraz — saldo przeskoczyło na drugą stronę.
        <div role="status" className={cn(cardVariant("status", "warning"), "mt-4 flex flex-wrap items-center gap-3 bg-warning/10 p-3 text-sm")} data-testid="debts-double-settle">
          <TriangleAlert className="size-4 shrink-0 text-warning-ink" aria-hidden />
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
          <Plus className="size-4" aria-hidden />
          Wpis z {person.name}
        </Button>
      )}

      <div className="mt-5 space-y-4" role="group" aria-label="Historia">
        {months.map((m) => (
          <section key={m.key} aria-label={monthLabel(m.key)}>
            <h3 className="mb-2 section-caps">{monthLabel(m.key)}</h3>
            <ol className="space-y-2">
              {/* M4.4: dodany wpis osiada, usunięty przygasa, sąsiedzi dojeżdżają (`listItemMotion`). */}
              <AnimatePresence initial={false}>
              {m.items.map(({ e, i }) =>
                editingId === e.id ? (
                  <motion.li key={e.id} {...rowMotion}>
                    <EditDebtForm entry={e} people={names} reminders={reminders} addReminderNote={addReminderNote} hidden={hidden} proofRef={proofs.get(e.id)?.ref} onDone={() => setEditingId(null)} />
                  </motion.li>
                ) : (
                  <motion.li key={e.id} {...rowMotion} className={cn(cardVariant("inset"), "flex items-center gap-3 p-3")}>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", KIND_SIGN[e.kind] > 0 ? "bg-success/15 text-success-ink" : "bg-warning/15 text-warning-ink")} aria-hidden>
                      {KIND_SIGN[e.kind] > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{DEBT_KIND_LABEL[e.kind]} · <span className="tabular-nums">{amountText(e.amount, hidden)}</span></p>
                      <p className="ui-hint">
                        {formatDay(e.at)}{e.note ? ` · ${e.note}` : ""}
                      </p>
                      <p className="ui-meta">
                        Saldo po tym: {running[i] === 0 ? "0" : `${running[i] > 0 ? "" : "− "}${amountText(Math.abs(running[i]), hidden)}`}
                      </p>
                    </div>
                    {proofs.has(e.id) && <DebtProofThumb proofRef={proofs.get(e.id)!.ref} hidden={hidden} label={`${DEBT_KIND_LABEL[e.kind]}, ${formatDay(e.at)}`} />}
                    <Button variant="ghost" size="icon" aria-label={`Edytuj wpis: ${DEBT_KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => setEditingId(e.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Usuń wpis: ${DEBT_KIND_LABEL[e.kind]} ${formatAmount(e.amount)}`} onClick={() => requestRemove(e)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </motion.li>
                ),
              )}
              </AnimatePresence>
            </ol>
          </section>
        ))}
      </div>
      <p className="ui-hint mt-4 flex items-center gap-1.5">
        <Undo2 className="size-3.5" aria-hidden />
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

/** „2026-11” → „listopad 2026”. */
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

/**
 * 3.1–3.2 Narzędzia osoby: „Wyślij” (wiadomość albo schowek), „Zmień nazwę” (wszystkie wpisy naraz)
 * i „Połącz z…” (wpisy innej osoby pod tę nazwę). Zmiany jedną transakcją Yjs, z „Cofnij”.
 */
function PersonTools({ person, others, onRekey, reminders }: { person: PersonDebts; others: PersonDebts[]; onRekey?: (key: string) => void; reminders?: DebtReminderApi }) {
  const uid = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(person.name);
  const [mergeKey, setMergeKey] = useState<string | null>(null);
  const merge = others.find((p) => p.key === mergeKey) ?? null;
  const candidates = others.filter((p) => p.key !== person.key);
  // L2.3: dane do przelewu z ustawień Długów — tylko gdy ta osoba jest nam winna; przełącznik żyje do zamknięcia arkusza.
  const payment = paymentLine(useDebtPayment());
  const [withPayment, setWithPayment] = useState(true);
  const pay = person.balance > 0 && withPayment ? payment : null;

  const send = async () => {
    const outcome = await shareOrCopy({ title: `${person.name} — rozliczenie`, text: personStatement(person, pay) });
    if (outcome === "copied") toast.success("Skopiowano rozliczenie — wklej je w wiadomości");
    else if (outcome === "failed") toast.error("Nie udało się wysłać ani skopiować");
  };

  // L4.4: rozliczenie do wydruku — generator i jsPDF ładowane dopiero po kliknięciu.
  const pdf = async () => {
    try {
      const [{ buildDebtStatementPdf, debtStatementPdfName }, { sharePdf }] = await Promise.all([import("@/lib/debts/statementPdf"), import("@/lib/study/pdfWriter")]);
      const blob = await buildDebtStatementPdf(person, localDayKey());
      if ((await sharePdf(blob, debtStatementPdfName(person.name))) === "downloaded") toast.success("Pobrano PDF rozliczenia");
    } catch {
      toast.error("Nie udało się zrobić PDF");
    }
  };

  // L2.2: krótkie przypomnienie zamiast pełnego rozliczenia — tylko gdy ta osoba jest nam winna.
  const remind = async () => {
    const now = Date.now();
    // Tylko wpisy od ostatniego rozliczenia — termin spłaconej pożyczki nie dotyczy obecnego salda.
    const dues = openEntries(person).flatMap((e) => (e.kind === "lent" && e.dueNoteId ? [reminders?.get(e.dueNoteId) ?? null] : [])).filter((d): d is number => d !== null);
    const text = personReminder(person, reminderDue(dues, now), now, pay);
    if (!text) return;
    const outcome = await shareOrCopy({ title: `${person.name} — przypomnienie`, text });
    if (outcome === "copied") toast.success("Skopiowano przypomnienie — wklej je w wiadomości");
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
    toast.success(merged ? `Połączono z „${clean}”` : `Nowa nazwa: ${clean}`, { action: { label: "Cofnij", onClick: () => { restoreDebts(prev, clean); onRekey?.(person.key); } } });
  };

  const doMerge = () => {
    if (!merge) return;
    const prev = renamePeople([merge.key], person.name);
    setMergeKey(null);
    if (!prev) { toast.error("Nie udało się połączyć"); return; }
    haptic("success");
    toast.success(`Połączono: wpisy „${merge.name}” są teraz pod „${person.name}”`, { action: { label: "Cofnij", onClick: () => restoreDebts(prev, person.name) } });
  };

  return (
    <div className="mt-3 space-y-2">
      {payment && person.balance > 0 && (
        <label className="flex w-full items-center gap-2 text-xs text-muted-foreground" data-testid="debt-payment-toggle">
          <Checkbox checked={withPayment} onCheckedChange={(v) => setWithPayment(v === true)} />
          <span>Dołącz dane do przelewu <span className="font-mono">({payment})</span></span>
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="tap-target gap-1.5" onClick={() => void send()}>
          <Send className="size-4" aria-hidden />Wyślij
        </Button>
        <Button variant="outline" size="sm" className="tap-target gap-1.5" onClick={() => void pdf()} title="Rozliczenie z wpisami i saldem jako PDF do wydruku">
          <FileDown className="size-4" aria-hidden />PDF
        </Button>
        {person.balance > 0 && (
          <Button variant="outline" size="sm" className="tap-target gap-1.5" onClick={() => void remind()} title="Krótka wiadomość z kwotą i terminem, bez historii wpisów">
            <BellRing className="size-4" aria-hidden />Przypomnij
          </Button>
        )}
        <Button variant="outline" size="sm" className="tap-target gap-1.5" aria-expanded={renaming} onClick={() => { setName(person.name); setRenaming((v) => !v); }}>
          <Pencil className="size-4" aria-hidden />Zmień nazwę
        </Button>
        {candidates.length > 0 && (
          <label className="inline-flex items-center gap-1.5">
            <Combine className="size-4 text-muted-foreground" aria-hidden />
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

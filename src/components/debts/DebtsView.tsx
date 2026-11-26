import { useId, useMemo, useState } from "react";
import { ChevronDown, Download, Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPersistedStore } from "@/lib/persistedStore";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { localDayKey } from "@/lib/dayDone";
import { useDayClock } from "@/lib/dayClock";
import { useDebts } from "@/lib/debts/store";
import { downloadBlob } from "@/lib/downloadBlob";
import { setHideAmounts, useHideAmounts } from "@/lib/debts/hideAmounts";
import { PageActions } from "@/components/PageActions";
import { balances, debtsCsv, monthNumbers, totals } from "@/lib/debts/model";
import { POWLOKA } from "@/lib/storage/names";
import { AddForm } from "./AddForm";
import { People } from "./People";
import { PersonSheet } from "./PersonSheet";
import { Summary } from "./Summary";
import type { AddReminderNote, DebtReminderApi } from "./debtTypes";
import { PaymentSettings } from "./PaymentSettings";

export type { DebtReminderApi } from "./debtTypes";

// Formularz rozwinięty — zapamiętany na tym urządzeniu (3.6: zwijany na każdym ekranie, nie tylko na telefonie).
const formOpenStore = createPersistedStore<boolean>(POWLOKA.debtsFormOpen, false, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

/**
 * Długi: kto ile u nas pożyczył i ile oddał. Góra — podsumowanie i szybki wpis,
 * dół — osoby z saldem; stuknięcie w osobę otwiera jej historię.
 */
/** `addReminderNote` — tworzy notatkę z przypomnieniem (`Index`); bez niego termin zwrotu nie zapisuje przypomnienia. */
export function DebtsView({ addReminderNote, reminders }: { addReminderNote?: AddReminderNote; reminders?: DebtReminderApi }) {
  const entries = useDebts();
  const people = useMemo(() => balances(entries), [entries]);
  const sums = useMemo(() => totals(people), [people]);
  // Po północy na przełomie miesiąca sekcja przechodzi na nowy miesiąc (jak dzień w formularzu).
  useDayClock();
  const thisMonth = localDayKey().slice(0, 7);
  const month = useMemo(() => monthNumbers(entries, thisMonth), [entries, thisMonth]);
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
          {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {hidden ? "Pokaż kwoty" : "Ukryj kwoty"}
        </Button>
      </PageActions>

      {/* 3.6: bez wpisów zostaje jeden pusty stan (jego „Dodaj pierwszy wpis” rozwija formularz), bez saldo 0,00 zł obok.
          Z wpisami formularz zwija się do „Nowy wpis” na każdym ekranie. */}
      {entries.length > 0 && <Summary owedToMe={sums.owedToMe} iOwe={sums.iOwe} hidden={hidden} month={month.count > 0 ? month : null} />}
      {(entries.length > 0 || formOpen) && (
        <div className="mt-4">
          <Button variant="outline" className="h-11 w-full gap-2 sm:w-auto" aria-expanded={formOpen} aria-controls={formId} onClick={() => { formOpenStore.set(!formOpen); haptic("tap"); }}>
            {formOpen ? <ChevronDown className="size-4 rotate-180" aria-hidden /> : <Plus className="size-4" aria-hidden />}
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
            <Download className="size-4" aria-hidden />Eksport CSV
          </Button>
        </div>
      )}

      <PaymentSettings />

      <PersonSheet person={openPerson} onClose={() => setOpenKey(null)} reminders={reminders} addReminderNote={addReminderNote} people={entries} hidden={hidden} onNewEntry={newEntryFor} others={people} onRekey={setOpenKey} />
    </section>
  );
}

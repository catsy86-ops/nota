import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { amountText, getHideAmounts } from "./hideAmounts";
import { balances, personKey } from "./model";
import { addDebt, getDebts, removeDebt } from "./store";

/**
 * 2.3 „Gotowe” w Terminach przy notatce zwrotu: pytanie „Oznaczyć jako oddane?” i wpis spłaty na kwotę
 * salda (z „Cofnij”). Notatkę wiąże z długiem `dueNoteId` (wyszukanie odwrotne). Ładowane leniwie
 * z `ReminderQuickActions.tsx`, żeby Długi nie szły do paczki startowej.
 * Zwraca `true`, gdy pytanie się pokazało.
 */
export function offerSettleFromNote(noteId: string): boolean {
  const entries = getDebts();
  const entry = entries.find((e) => e.dueNoteId === noteId);
  if (!entry) return false;
  const person = balances(entries).find((p) => p.key === personKey(entry.person));
  if (!person || person.balance === 0) return false;
  // Notatka „Zwrot od” (pożyczka) pyta tylko, gdy ta osoba nadal jest nam winna; „Oddać” — gdy my jej.
  if ((entry.kind === "lent") !== (person.balance > 0)) return false;
  const kind = person.balance > 0 ? "repaid" : "returned";
  const amount = Math.abs(person.balance);
  toast("Oznaczyć jako oddane?", {
    id: `debt-settle-${noteId}`,
    duration: 12_000,
    description: `${person.name}: ${amountText(amount, getHideAmounts())} — ${person.balance > 0 ? "oddał całość" : "oddajesz całość"}`,
    action: {
      label: "Oddane",
      onClick: () => {
        const created = addDebt({ person: person.name, kind, amount, settle: true });
        if (!created) { haptic("warn"); toast.error("Nie udało się zapisać spłaty", { description: "Lista długów jest pełna albo dane są nieprawidłowe." }); return; }
        haptic("success");
        toast.success(`Oddane w całości: ${person.name}`, { action: { label: "Cofnij", onClick: () => { removeDebt(created.id); } } });
      },
    },
  });
  return true;
}

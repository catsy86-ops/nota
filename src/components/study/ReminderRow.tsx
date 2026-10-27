/**
 * Wiersz przypomnienia nad dziennikiem budowy (§5.5): ikona per rodzaj i tekst z kontekstem budowy.
 * Wydzielony z `StudyJournal.tsx`.
 */
import { ClipboardCheck, Gauge, Package, TriangleAlert, Truck, Wrench } from "lucide-react";
import { pluralPl } from "@/lib/plural";
import { type StudyReminder } from "@/lib/study/reminders";


const REMINDER_ICON: Partial<Record<StudyReminder["kind"], typeof TriangleAlert>> = {
  "stale-problems": TriangleAlert,
  "late-order": Package,
  "delivery-today": Truck,
  "service-due": Wrench,
  "pre-cover-test": Gauge,
  "no-test": ClipboardCheck,
};

export function ReminderRow({ reminder: r, onShow }: { reminder: StudyReminder; onShow: () => void }) {
  const text =
    r.kind === "stale-problems"
      ? `${r.count} ${pluralPl(r.count, ["problem", "problemy", "problemów"])} otwarte od ponad 3 dni`
      : r.kind === "late-order"
        ? `Budowa „${r.site}”: zamówione ponad 3 dni temu i nie dojechało — ${r.items.slice(0, 3).join(", ")}${r.items.length > 3 ? ` i ${r.items.length - 3} więcej` : ""}.`
        : r.kind === "service-due"
          ? `Serwis „${r.site}” na dziś: ${r.items.slice(0, 3).join(", ")}${r.items.length > 3 ? ` i ${r.items.length - 3} więcej` : ""}.`
          : r.kind === "delivery-today"
            ? `Dostawa dziś na „${r.site}”: ${r.items.slice(0, 3).join(", ")}${r.items.length > 3 ? ` i ${r.items.length - 3} więcej` : ""}.`
            : r.kind === "pre-cover-test"
            ? `Budowa „${r.site}”: instalacja odhaczona, a protokołu próby nie ma. Zrób próbę przed zakryciem.`
            : `Budowa „${r.site}”: montaż bez protokołu próby. Zapisz próbę przed zakryciem.`;
  // Każdy rodzaj przypomnienia ma swoją ikonę, żeby dało się je odróżnić bez czytania (§9 W5).
  const Icon = REMINDER_ICON[r.kind] ?? TriangleAlert;
  return (
    <li className="flex items-start gap-2.5 rounded-card border border-warning/50 bg-warning/10 p-3 text-sm" data-reminder={r.kind}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1 leading-snug">{text}</p>
      <button
        type="button"
        onClick={onShow}
        className="pressable shrink-0 self-center rounded-full border border-warning/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-warning/20 coarse:min-h-11 coarse:px-3.5 coarse:text-sm"
      >
        {r.kind === "stale-problems" ? "Pokaż otwarte" : r.kind === "late-order" || r.kind === "service-due" || r.kind === "pre-cover-test" ? "Karta budowy" : r.kind === "no-test" ? "Dodaj próbę" : "Pokaż wpisy budowy"}
      </button>
    </li>
  );
}

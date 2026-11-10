import { useMemo, useState } from "react";
import { Clock, FileText, HardDrive, PackageCheck, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { backupStale, daySummary } from "@/lib/study/endDay";
import { entriesPl } from "@/lib/study/journalView";
import { getLastBackup, markBackup } from "@/lib/backupReminder";
import { formatDuration } from "@/lib/shifts/time";
import { haptic } from "@/lib/haptics";
import { pluralPl } from "@/lib/plural";
import type { JournalEntry } from "@/lib/study/journalEntry";

const clock = (at: number) => new Date(at).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

interface Step { id: string; icon: LucideIcon; title: string }
const STEPS: readonly Step[] = [
  { id: "hours", icon: Clock, title: "Godziny" },
  { id: "report", icon: FileText, title: "Raport do szefa" },
  { id: "order", icon: PackageCheck, title: "Braki na jutro" },
  { id: "backup", icon: HardDrive, title: "Kopia" },
];

/**
 * „Zakończ dzień” (B2.4): jeden arkusz w 4 krokach — godziny, raport, braki do hurtowni i kopia.
 * Każdy krok można pominąć („Dalej”); akcje otwierają istniejące okna (godziny, raport, hurtownia),
 * więc arkusz niczego nie zapisuje sam poza kopią. Zastępuje samo przypomnienie „Raport dnia gotowy”:
 * stuknięcie w nie otwiera ten arkusz.
 */
export function EndDaySheet({ open, onOpenChange, journal, wholesaleCount, onHours, onReport, onOrder }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  journal: readonly JournalEntry[];
  /** Ile list do hurtowni czeka (budowy z brakami + auto). */
  wholesaleCount: number;
  onHours: (dayKey: string) => void;
  onReport: () => void;
  onOrder: () => void;
}) {
  if (!open) return <Dialog open={false} onOpenChange={onOpenChange} />;
  // Nowe otwarcie = krok pierwszy i świeże podsumowanie dnia.
  return <EndDayBody onOpenChange={onOpenChange} journal={journal} wholesaleCount={wholesaleCount} onHours={onHours} onReport={onReport} onOrder={onOrder} />;
}

function EndDayBody({ onOpenChange, journal, wholesaleCount, onHours, onReport, onOrder }: Omit<Parameters<typeof EndDaySheet>[0], "open">) {
  const [index, setIndex] = useState(0);
  const [backedUp, setBackedUp] = useState(false);
  const day = useMemo(() => daySummary(journal), [journal]);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const lastBackup = getLastBackup();
  const stale = !backedUp && backupStale(lastBackup);
  const Icon = step.icon;

  async function backup() {
    try {
      const { exportFullBackup } = await import("@/lib/exportNotes");
      const res = await exportFullBackup();
      markBackup();
      setBackedUp(true);
      haptic("success");
      toast.success(res.savedToFile ? "Backup zapisany 💾" : "Backup pobrany 💾");
    } catch {
      toast.error("Nie udało się wygenerować backupu");
    }
  }

  const body: Record<string, { text: string; action?: { label: string; run: () => void } }> = {
    hours: day.entries === 0
      ? { text: "Dziś nie ma wpisów — godziny możesz wpisać ręcznie albo pominąć ten krok.", action: { label: "Wpisz godziny", run: () => onHours(day.dayKey) } }
      : {
          text: `Pierwszy wpis ${clock(day.firstAt!)}, ostatni ${clock(day.lastAt!)}${day.spanMinutes > 0 ? ` — około ${formatDuration(day.spanMinutes)} na budowie` : ""}. Godziny z Grafiku i wejścia/wyjścia poprawisz w oknie.`,
          action: { label: "Wpisz godziny", run: () => onHours(day.dayKey) },
        },
    report: day.entries === 0
      ? { text: "Dziś nie ma wpisów, więc nie ma czego wysłać." }
      : {
          text: `${entriesPl(day.entries)} na ${day.sites} ${pluralPl(day.sites, ["budowie", "budowach", "budowach"])}. Raport otwiera się z dzisiejszym dniem, skąd idzie do szefa jednym stuknięciem.`,
          action: { label: "Otwórz raport", run: onReport },
        },
    order: wholesaleCount === 0
      ? { text: "Nic do zamówienia. Braki dopisujesz w karcie budowy, a kształtki i rury we wpisach." }
      : {
          text: `Do hurtowni czeka ${wholesaleCount} ${pluralPl(wholesaleCount, ["lista", "listy", "list"])} — jedna wiadomość ze wszystkich budów.`,
          action: { label: "Do hurtowni", run: onOrder },
        },
    backup: stale
      ? {
          text: lastBackup ? `Ostatnia kopia jest starsza niż 3 dni (${new Date(lastBackup).toLocaleDateString("pl-PL")}).` : "Nie masz jeszcze żadnej kopii zapasowej.",
          action: { label: "Zrób kopię", run: () => void backup() },
        }
      : { text: backedUp ? "Kopia zrobiona." : "Kopia jest świeża (z ostatnich 3 dni)." },
  };
  const cur = body[step.id];

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="gap-0 p-0 sm:max-w-sm" data-testid="end-day">
        <div className="space-y-1 border-b border-border px-5 pb-4 pt-5 pr-12">
          <DialogTitle className="flex items-center gap-1.5 font-display text-lg">
            <Icon className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden />{step.title}
          </DialogTitle>
          <DialogDescription className="text-xs" data-testid="end-day-step">
            Zakończ dzień · krok {index + 1} z {STEPS.length}
          </DialogDescription>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm" data-testid="end-day-text">{cur.text}</p>
          {cur.action && (
            <Button type="button" variant="outline" onClick={cur.action.run} className="pressable w-full coarse:h-11">{cur.action.label}</Button>
          )}
          <ol className="flex gap-1.5" aria-hidden>
            {STEPS.map((s, i) => <li key={s.id} className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-muted"}`} />)}
          </ol>
        </div>
        <ResponsiveDialogFooter className="grid grid-cols-2 gap-2 px-5 pb-5">
          <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} className="pressable coarse:h-11">Wstecz</Button>
          <Button type="button" onClick={() => (last ? onOpenChange(false) : setIndex((i) => i + 1))} className="pressable coarse:h-11">
            {last ? "Gotowe" : "Dalej"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

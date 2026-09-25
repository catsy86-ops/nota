import { Download, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { exportFullBackup, importFullBackup } from "@/lib/exportNotes";
import { daysSinceBackup } from "@/lib/backupReminder";
import { toast } from "sonner";
import { Section } from "./SettingsShared";

function handleAutoExportChange(v: number) {
  setViewPref("autoExportDays", v);
  if (v === 0) {
    try { localStorage.removeItem("kaczy.lastAutoExport"); } catch { /* ignore */ }
  }
}

async function exportNow() {
  try {
    await exportFullBackup();
    try { localStorage.setItem("kaczy.lastAutoExport", String(Date.now())); } catch { /* ignore */ }
    toast.success("Backup pobrany 💾");
  } catch {
    toast.error("Nie udało się wygenerować backupu");
  }
}

async function restoreNow() {
  try {
    const backup = await importFullBackup();
    toast.success(`Backup wczytany — ${backup.notes.length} notatek. Odświeżam…`);
    setTimeout(() => window.location.reload(), 1200);
  } catch (err) {
    if (err instanceof Error && err.message !== "Nie wybrano pliku") {
      toast.error("Nie udało się wczytać backupu: " + err.message);
    }
  }
}

/** "Dane" tab: auto-backup, backup/today/week reminders, manual export/import. */
export function BackupSettings() {
  const prefs = useViewPrefs();

  return (
    <div className="space-y-4">
      <Section title={`Auto-backup ${prefs.autoExportDays === 0 ? "(wyłączony)" : `co ${prefs.autoExportDays} dni`}`}>
        <Slider
          value={[prefs.autoExportDays]}
          min={0} max={30} step={1}
          onValueChange={([v]) => handleAutoExportChange(v)}
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Po przekroczeniu interwału aplikacja sama pobierze plik JSON z backupem (gdy otworzysz KACZY).
        </p>
      </Section>

      <Section title={`Przypomnienie ${prefs.backupReminderDays === 0 ? "(wyłączone)" : `co ${prefs.backupReminderDays} dni`}`}>
        <Slider
          value={[prefs.backupReminderDays]}
          min={0} max={60} step={1}
          onValueChange={([v]) => setViewPref("backupReminderDays", v)}
        />
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {(() => {
            const d = daysSinceBackup();
            if (d === null) return "Jeszcze nie zrobiłeś backupu.";
            return `Ostatni backup: ${d === 0 ? "dziś" : `${d} dni temu`}.`;
          })()}
        </p>
      </Section>

      <Section title={`Przypomnienie „Dziś” ${prefs.todayReminderTime ? `codziennie o ${prefs.todayReminderTime}` : prefs.todayReminderHours === 0 ? "(wyłączone)" : prefs.todayReminderHours >= 24 ? `co ${Math.round(prefs.todayReminderHours / 24)} dni` : `co ${prefs.todayReminderHours} h`}`}>
        <Slider
          value={[prefs.todayReminderHours]}
          min={0} max={48} step={1}
          onValueChange={([v]) => setViewPref("todayReminderHours", v)}
          disabled={!!prefs.todayReminderTime}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground shrink-0">albo o stałej godzinie:</span>
          <input
            type="time"
            value={prefs.todayReminderTime}
            onChange={(e) => setViewPref("todayReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.todayReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("todayReminderTime", "")}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >wyczyść</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {prefs.todayReminderTime
            ? `Toast pojawi się raz dziennie o ${prefs.todayReminderTime} (gdy masz notatki z dzisiaj).`
            : prefs.todayReminderHours === 0
              ? "Powiadomienie o notatkach z dzisiaj nie będzie się pojawiać."
              : `Toast pojawi się co najwyżej raz na ${prefs.todayReminderHours} ${prefs.todayReminderHours === 1 ? "godzinę" : prefs.todayReminderHours < 5 ? "godziny" : "godzin"} (gdy masz notatki z dzisiaj).`}
        </p>
      </Section>

      <Section title={`Przypomnienie „Ten tydzień” ${prefs.weekReminderTime ? `${["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][prefs.weekReminderDay]} o ${prefs.weekReminderTime}` : "(wyłączone)"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={prefs.weekReminderDay}
            onChange={(e) => setViewPref("weekReminderDay", Number(e.target.value))}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
            disabled={!prefs.weekReminderTime}
          >
            {["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"].map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
          <input
            type="time"
            value={prefs.weekReminderTime}
            onChange={(e) => setViewPref("weekReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.weekReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("weekReminderTime", "")}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
            >wyłącz</button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {prefs.weekReminderTime
            ? "Raz w tygodniu, o wybranej porze, dostaniesz podsumowanie ostatnich 7 dni."
            : "Ustaw godzinę, aby otrzymywać cotygodniowe przypomnienie."}
        </p>
      </Section>

      <Button onClick={exportNow} className="w-full gap-2">
        <Download className="w-4 h-4" /> Pobierz pełny backup teraz
      </Button>
      <Button onClick={restoreNow} variant="outline" className="w-full gap-2">
        <Database className="w-4 h-4" /> Przywróć z pliku backupu
      </Button>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">💡 Wskazówka</p>
        <p>Pełny backup zawiera wszystkie notatki (w tym archiwum i kosz), etykiety i foldery. Przywrócenie z pliku zastąpi obecne dane w tej przeglądarce i odświeży aplikację.</p>
      </div>
    </div>
  );
}

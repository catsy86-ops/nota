import { useState } from "react";
import { FileDown } from "lucide-react";
import { useShifts } from "@/lib/shifts";
import { ShiftSettingsDialog } from "@/components/shifts/ShiftSettingsDialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref, VIEW_PREF_GROUPS } from "@/lib/viewPrefs";
import { colorClasses } from "@/components/ColorPicker";
import { useConfirmPrefs, setConfirmPref } from "@/lib/confirmPrefs";
import type { NoteColor } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";
import { ResetSectionButton, Section, ToggleRow } from "./SettingsShared";
import { ReviewSettings } from "./ReviewSettings";
import { VaultSettings } from "./VaultSettings";
import { ClipperSettings } from "./ClipperSettings";
import { PushSettings } from "./PushSettings";
import { getNotificationPermission } from "@/lib/notificationPermission";
import { MOD_KEY } from "@/lib/platform";
import { setBadgeEnabled, useBadgeEnabled } from "@/lib/overdueBadge";

const PERMISSION_TEXT = {
  granted: "Włączone — przypomnienia pokażą się jako powiadomienia systemowe, gdy aplikacja jest otwarta (przy zamkniętej — patrz niżej).",
  default: "Przeglądarka zapyta o zgodę przy ustawieniu pierwszego przypomnienia.",
  denied: "Zablokowane w przeglądarce — przypomnienia pojawią się tylko w aplikacji. Zmienisz to w ustawieniach witryny (ikona kłódki przy adresie).",
  unsupported: "Ta przeglądarka nie obsługuje powiadomień — przypomnienia pojawią się tylko w aplikacji.",
} as const;

/**
 * Praca i Grafik: ustawienia Grafiku (norma, nadgodziny, zarobek) są w `ShiftSettingsDialog`, który otwiera się
 * z Grafiku. Tu jest drugie wejście, żeby z Ustawień dało się je znaleźć (faza 2c).
 */
function WorkSettingsLink() {
  const data = useShifts();
  const [open, setOpen] = useState(false);
  return (
    <Section title="Praca i Grafik">
      <p className="text-xs text-muted-foreground">Norma, nadgodziny i zarobek liczą się z ustawień Grafiku. Zmiany zapisują się od razu.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5 coarse:h-11">
        Ustawienia Grafiku
      </Button>
      <ShiftSettingsDialog open={open} onOpenChange={setOpen} settings={data} />
    </Section>
  );
}

function NotificationStatus() {
  const state = getNotificationPermission();
  return (
    <Section title="Powiadomienia o przypomnieniach">
      <p className={cn("text-xs", state === "denied" ? "text-destructive-ink" : "text-muted-foreground")}>
        {PERMISSION_TEXT[state]}
      </p>
    </Section>
  );
}

const COLORS: NoteColor[] = ["default", "coral", "peach", "sand", "mint", "sage", "sky", "lavender", "rose"];

/** Polskie nazwy kolorów — czytnik ekranu i podpowiedź mówią po polsku, nie kluczem z kodu. */
const COLOR_LABEL: Record<NoteColor, string> = {
  default: "domyślny", coral: "koralowy", peach: "brzoskwiniowy", sand: "piaskowy", mint: "miętowy",
  sage: "szałwiowy", sky: "niebieski", lavender: "lawendowy", rose: "różowy",
};

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: `${MOD_KEY} + N`, desc: "Nowa notatka" },
  { keys: "Alt + N", desc: "Nowa notatka (alternatywnie)" },
  { keys: `${MOD_KEY} + K`, desc: "Paleta poleceń" },
  { keys: "/  •  Alt + S", desc: "Skup się na wyszukiwarce" },
  { keys: "Alt + T", desc: "Przejdź do trybu „Dziś”" },
  { keys: "Alt + W", desc: "Przejdź do trybu „Ten tydzień”" },
  { keys: "↑↑↓↓←→←→ B A", desc: "Konami — niespodzianka 🎉" },
  { keys: "+ / - / 0", desc: "Zoom w trybie prezentacji notatki" },
  { keys: "Esc", desc: "Zamknij dialogi i tryb prezentacji" },
  { keys: "[[Tytuł]]", desc: "Link do innej notatki w treści" },
  { keys: "[[Tytuł#Nagłówek]]", desc: "Link do nagłówka w innej notatce" },
  { keys: "@", desc: "Wzmianka: data (dziś, jutro) albo notatka" },
  { keys: `${MOD_KEY} + Enter`, desc: "Zapisz nową notatkę" },
  { keys: `${MOD_KEY} + Shift + Enter`, desc: "Zapisz i dodaj kolejną" },
];


/** "Ogólne" tab: default note color, editor prefs, confirmations, autosave, effects, shortcuts cheat-sheet. */
export function GeneralSettings() {
  const confirmPrefs = useConfirmPrefs();
  const prefs = useViewPrefs();
  const badgeEnabled = useBadgeEnabled();

  return (
    <div className="space-y-4">
      <Section title="Domyślny kolor nowej notatki">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setViewPref("defaultNoteColor", c)}
              data-swatch={c}
              aria-label={`Kolor ${COLOR_LABEL[c]}`}
              aria-pressed={prefs.defaultNoteColor === c}
              className={cn(
                "w-9 h-9 coarse:size-11 rounded-full border-2 transition-transform",
                colorClasses[c],
                prefs.defaultNoteColor === c ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border/60 hover:scale-105"
              )}
              title={COLOR_LABEL[c]}
            />
          ))}
        </div>
      </Section>

      <NotificationStatus />
      <PushSettings />
      <ClipperSettings />

      <ReviewSettings />
      <Section title={`Przypomnienie „Dziś” ${prefs.todayReminderTime ? `codziennie o ${prefs.todayReminderTime}` : prefs.todayReminderHours === 0 ? "(wyłączone)" : prefs.todayReminderHours >= 24 ? `co ${Math.round(prefs.todayReminderHours / 24)} dni` : `co ${prefs.todayReminderHours} h`}`}>
        <Slider
          value={[prefs.todayReminderHours]}
          min={0} max={48} step={1}
          aria-label="Przypomnienie Dziś: co ile godzin"
          onValueChange={([v]) => setViewPref("todayReminderHours", v)}
          disabled={!!prefs.todayReminderTime}
        />
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground shrink-0">albo o stałej godzinie:</span>
          <input
            type="time"
            value={prefs.todayReminderTime}
            aria-label="Przypomnienie Dziś: stała godzina"
            onChange={(e) => setViewPref("todayReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.todayReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("todayReminderTime", "")}
              className="text-xs text-muted-foreground hover:text-foreground underline coarse:min-h-11 coarse:px-2"
            >wyczyść</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
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
            aria-label="Przypomnienie Ten tydzień: dzień"
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
            aria-label="Przypomnienie Ten tydzień: godzina"
            onChange={(e) => setViewPref("weekReminderTime", e.target.value)}
            className="text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground"
          />
          {prefs.weekReminderTime && (
            <button
              type="button"
              onClick={() => setViewPref("weekReminderTime", "")}
              className="text-xs text-muted-foreground hover:text-foreground underline coarse:min-h-11 coarse:px-2"
            >wyłącz</button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {prefs.weekReminderTime
            ? "Raz w tygodniu, o wybranej porze, dostaniesz podsumowanie ostatnich 7 dni."
            : "Ustaw godzinę, aby otrzymywać cotygodniowe przypomnienie."}
        </p>
      </Section>

      <ResetSectionButton title="przypomnienia" keys={VIEW_PREF_GROUPS.przypomnienia} />

      <ToggleRow
        label="Liczba zaległych w tytule karty i na ikonie"
        desc="Pokazuje liczbę zaległych przypomnień jako „(3) NOTKI” na karcie i znaczek na ikonie zainstalowanej aplikacji."
        checked={badgeEnabled}
        onCheck={setBadgeEnabled}
      />

      <ToggleRow
        label="Sprawdzanie pisowni"
        desc="Włącza wbudowane sprawdzanie pisowni przeglądarki w polach edycji."
        checked={prefs.spellcheck}
        onCheck={(v) => setViewPref("spellcheck", v)}
      />

      <ToggleRow
        label="Pytaj przed przeniesieniem do kosza"
        desc="Pokazuje przyjazne potwierdzenie. Po akcji i tak masz przycisk „Cofnij”."
        checked={confirmPrefs.trash}
        onCheck={(v) => setConfirmPref("trash", v)}
      />

      <ToggleRow
        label="Pytaj przed archiwizacją"
        desc="Potwierdzenie przed przeniesieniem notatki do Archiwum."
        checked={confirmPrefs.archive}
        onCheck={(v) => setConfirmPref("archive", v)}
      />

      <Section title={`Autosave ${prefs.autosaveSeconds === 0 ? "(wyłączony)" : `co ${prefs.autosaveSeconds}s`}`}>
        <Slider
          value={[prefs.autosaveSeconds]}
          min={0} max={30} step={5}
          aria-label="Autosave: co ile sekund"
          onValueChange={([v]) => setViewPref("autosaveSeconds", v)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {prefs.autosaveSeconds === 0
            ? "Bez zapisu cyklicznego. Edycja i tak zapisuje się przy wyjściu z pola oraz gdy kafel zniknie z widoku."
            : "Edycja będzie zapisywana automatycznie po przerwie w pisaniu — oraz zawsze przy wyjściu z pola."}
        </p>
      </Section>


      {/* Skróty klawiszowe są bezużyteczne na telefonie. */}
      <div className="pt-2 space-y-2 [@media(pointer:coarse)]:hidden">
        <p className="text-xs text-muted-foreground mb-2">Lista skrótów dostępnych w aplikacji:</p>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-2.5">
            <span className="text-sm text-foreground">{s.desc}</span>
            <kbd className="font-mono text-xs bg-background border border-border/60 rounded-md px-2 py-1 text-foreground/80">{s.keys}</kbd>
          </div>
        ))}
      </div>

      <ResetSectionButton title="edytor" keys={VIEW_PREF_GROUPS.edytor} />

      <div className="pt-2"><WorkSettingsLink /></div>

      <div className="pt-2"><VaultSettings /></div>

      <div className="pt-2"><Section title="Diagnostyka">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Raport diagnostyczny</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plik tekstowy z wersją aplikacji, stanem pamięci i synchronizacji oraz ostatnimi błędami. Bez treści notatek i bez kodu parowania. Nic nie jest wysyłane.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDownloadReport} className="shrink-0 gap-1.5">
            <FileDown className="w-3.5 h-3.5" />Pobierz
          </Button>
        </div>
      </Section></div>
    </div>
  );
}

async function handleDownloadReport() {
  try {
    const { downloadDiagReport } = await import("@/lib/diagnosticsReport");
    await downloadDiagReport();
  } catch {
    toast.error("Nie udało się przygotować raportu");
  }
}

import { useState } from "react";
import { toast } from "sonner";
import { useShifts } from "@/lib/shifts";
import { ShiftSettingsDialog } from "@/components/shifts/ShiftSettingsDialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useViewPrefs, setViewPref, VIEW_PREF_GROUPS } from "@/lib/viewPrefs";
import { dniPl, godzinPl } from "@/lib/plural";
import { REVIEW_DAY_NAMES } from "@/lib/weeklyReview";
import { colorClasses } from "@/components/ColorPicker";
import { useConfirmPrefs, setConfirmPref } from "@/lib/confirmPrefs";
import type { NoteColor } from "@/hooks/useNotes";
import { cn } from "@/lib/utils";
import { ResetSectionButton, Section, ToggleRow } from "./SettingsShared";
import { ReviewSettings } from "./ReviewSettings";
import { VaultSettings } from "./VaultSettings";
import { ClipperSettings } from "./ClipperSettings";
import { FeatureFlagsSettings } from "./FeatureFlagsSettings";
import { PushSettings } from "./PushSettings";
import { getNotificationPermission } from "@/lib/notificationPermission";
import { MOD_KEY } from "@/lib/platform";
import { hasDictationConsent, withdrawDictationConsent } from "@/hooks/useDictation";
import { setBadgeEnabled, useBadgeEnabled } from "@/lib/overdueBadge";
import { setReportNudges, useReportNudges } from "@/lib/study/reportNudgePrefs";
import { setSiteArrival, useSiteArrival } from "@/lib/study/siteArrivalPrefs";

const PERMISSION_TEXT = {
  granted: "Włączone — przypomnienia pokażą się jako powiadomienia systemowe, gdy aplikacja jest otwarta (przy zamkniętej — patrz niżej).",
  default: "Przeglądarka zapyta o zgodę przy ustawieniu pierwszego przypomnienia.",
  denied: "Zablokowane w przeglądarce — przypomnienia pojawią się tylko w aplikacji. Zmienisz to w ustawieniach witryny (ikona kłódki przy adresie).",
  unsupported: "Ta przeglądarka nie obsługuje powiadomień — przypomnienia pojawią się tylko w aplikacji.",
} as const;

/** Skoki do grup na górze zakładki „Ogólne” — bez wyszukiwarki, a grup jest sporo. */
const JUMP_GROUPS = [
  { id: "powiadomienia", label: "Powiadomienia" },
  { id: "przypomnienia", label: "Przypomnienia" },
  { id: "edytor", label: "Edytor" },
  { id: "praca", label: "Praca" },
  { id: "prywatne", label: "Prywatne" },
  { id: "skroty", label: "Skróty" },
] as const;

function jumpTo(id: string) {
  document.getElementById(`ogolne-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function JumpNav() {
  return (
    <nav aria-label="Przejdź do grupy ustawień" className="sticky top-0 z-raised -mx-1 flex gap-1.5 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur">
      {JUMP_GROUPS.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => jumpTo(g.id)}
          className="shrink-0 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/60 coarse:h-11 coarse:px-4"
        >
          {g.label}
        </button>
      ))}
    </nav>
  );
}

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
        Ustawienia grafiku
      </Button>
      <ShiftSettingsDialog open={open} onOpenChange={setOpen} settings={data} />
    </Section>
  );
}

function NotificationStatus() {
  const state = getNotificationPermission();
  return (
    <Section title="Status powiadomień w przeglądarce">
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

/**
 * "Ogólne": grupy w kolejności od najczęściej używanych — powiadomienia, przypomnienia, edytor, praca,
 * prywatne, reszta. Każdy reset stoi na końcu swojej grupy, a skróty na samym dole.
 */
export function GeneralSettings() {
  const confirmPrefs = useConfirmPrefs();
  const prefs = useViewPrefs();
  const badgeEnabled = useBadgeEnabled();
  const reportNudges = useReportNudges();
  const siteArrival = useSiteArrival();

  return (
    <div className="space-y-4">
      <JumpNav />

      <div id="ogolne-powiadomienia" className="scroll-mt-14 space-y-4">
        <NotificationStatus />
        <PushSettings />
        <ToggleRow
          label="Liczba zaległych w tytule karty i na ikonie"
          desc="Pokazuje liczbę zaległych przypomnień jako „(3) G” na karcie i znaczek na ikonie zainstalowanej aplikacji."
          checked={badgeEnabled}
          onCheck={setBadgeEnabled}
        />
      </div>

      <div id="ogolne-przypomnienia" className="scroll-mt-14 space-y-4">
        <ReviewSettings />
        <Section title={`Przypomnienie „Dziś” ${prefs.todayReminderTime ? `codziennie o ${prefs.todayReminderTime}` : prefs.todayReminderHours === 0 ? "(wyłączone)" : prefs.todayReminderHours >= 24 ? `co ${dniPl(Math.round(prefs.todayReminderHours / 24))}` : `co ${prefs.todayReminderHours} h`}`}>
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
              className="text-xs bg-background border border-border/60 rounded-control px-2 py-1 text-foreground coarse:h-11 coarse:px-3"
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
                : `Toast pojawi się co najwyżej raz na ${godzinPl(prefs.todayReminderHours)} (gdy masz notatki z dzisiaj).`}
          </p>
        </Section>

        <Section title={`Przypomnienie „Ten tydzień” ${prefs.weekReminderTime ? `${["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][prefs.weekReminderDay]} o ${prefs.weekReminderTime}` : "(wyłączone)"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={prefs.weekReminderDay}
              aria-label="Przypomnienie Ten tydzień: dzień"
              onChange={(e) => setViewPref("weekReminderDay", Number(e.target.value))}
              className="text-xs bg-background border border-border/60 rounded-control px-2 py-1 text-foreground coarse:h-11 coarse:px-3"
              disabled={!prefs.weekReminderTime}
            >
              {REVIEW_DAY_NAMES.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <input
              type="time"
              value={prefs.weekReminderTime}
              aria-label="Przypomnienie Ten tydzień: godzina"
              onChange={(e) => setViewPref("weekReminderTime", e.target.value)}
              className="text-xs bg-background border border-border/60 rounded-control px-2 py-1 text-foreground coarse:h-11 coarse:px-3"
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

        <ToggleRow
          label="Podpowiedzi „Raport dnia/tygodnia gotowy”"
          desc="Po końcu zmiany dymek w aplikacji, a przy zgodzie powiadomienie systemowe. Osobno od powiadomień przy zamkniętej aplikacji."
          checked={reportNudges}
          onCheck={setReportNudges}
        />

        <ToggleRow
          label="Podpowiedź „Jesteś przy budowie”"
          desc="Przy otwarciu aplikacji jedno sprawdzenie położenia: gdy stoisz przy budowie z zapisaną lokalizacją i nie ma jeszcze wejścia dziś, pytamy „Wchodzę?”. Położenie zostaje w przeglądarce."
          checked={siteArrival}
          onCheck={setSiteArrival}
        />

        <ResetSectionButton title="przypomnienia" keys={VIEW_PREF_GROUPS.przypomnienia} />
      </div>

      <div id="ogolne-edytor" className="scroll-mt-14 space-y-4">
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

        <Section title={`Autozapis ${prefs.autosaveSeconds === 0 ? "(wyłączony)" : `co ${prefs.autosaveSeconds} s`}`}>
          <Slider
            value={[prefs.autosaveSeconds]}
            min={0} max={30} step={5}
            aria-label="Autozapis: co ile sekund"
            onValueChange={([v]) => setViewPref("autosaveSeconds", v)}
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            {prefs.autosaveSeconds === 0
              ? "Bez zapisu cyklicznego. Edycja i tak zapisuje się przy wyjściu z pola oraz gdy kafel zniknie z widoku."
              : "Edycja będzie zapisywana automatycznie po przerwie w pisaniu — oraz zawsze przy wyjściu z pola."}
          </p>
        </Section>

        <ResetSectionButton title="edytor" keys={VIEW_PREF_GROUPS.edytor} />
      </div>

      <div id="ogolne-praca" className="scroll-mt-14">
        <WorkSettingsLink />
      </div>

      <div id="ogolne-prywatne" className="scroll-mt-14">
        <VaultSettings />
      </div>

      <div className="space-y-4">
        <DictationConsentRow />
        <ClipperSettings />
      </div>

      <FeatureFlagsSettings />

      {/* Skróty klawiszowe są bezużyteczne na telefonie. */}
      <div id="ogolne-skroty" className="scroll-mt-14 pt-2 space-y-2 [@media(pointer:coarse)]:hidden">
        <p className="text-xs text-muted-foreground mb-2">Lista skrótów dostępnych w aplikacji:</p>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-3 rounded-card border border-border/60 bg-muted/20 px-4 py-2.5">
            <span className="text-sm text-foreground">{s.desc}</span>
            <kbd className="font-mono text-xs bg-background border border-border/60 rounded-control px-2 py-1 text-foreground/80">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Zgoda na dyktowanie: stan i „Cofnij zgodę”. Bez zgody pierwsze dyktowanie zapyta ponownie. */
function DictationConsentRow() {
  const [consent, setConsent] = useState(hasDictationConsent);
  return (
    <Section title="Dyktowanie głosem">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {consent
            ? "Zgoda udzielona. Nagranie głosu idzie do rozpoznawania mowy przeglądarki (w Chrome: Google). Notatki zostają na urządzeniu."
            : "Zgody nie udzielono. Pierwsze dyktowanie zapyta o nią."}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={!consent}
          className="coarse:h-11"
          onClick={() => {
            withdrawDictationConsent();
            setConsent(false);
            toast("Cofnięto zgodę na dyktowanie");
          }}
        >
          Cofnij zgodę
        </Button>
      </div>
    </Section>
  );
}

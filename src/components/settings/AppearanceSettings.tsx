import { useState } from "react";
import { Sun, Moon, Monitor, Zap, Accessibility, HardHat, CircleOff, Contrast, Bell, BriefcaseBusiness, CalendarRange, CalendarDays, ChevronDown, Flower2, Inbox, Leaf, RotateCcw, Snowflake, Sparkles, Waves, Square, SquareRoundCorner, Squircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useViewPrefs, setViewPref, resetViewPrefs, changedViewPrefs, VIEW_PREF_LABELS, type Density, type Layout } from "@/lib/viewPrefs";
import { changeView } from "@/lib/viewChange";
import { useEffectsSettings } from "@/lib/effectsSettings";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { isMotionReduced, useMotionPref, type MotionMode } from "@/hooks/useMotionPref";
import { SEASON_META, useSeasonPref, type SeasonPref } from "@/lib/seasonTheme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Section, SettingsGroup, ToggleRow } from "./SettingsShared";
import { EffectsSettings } from "./EffectsSettings";
import { Segmented } from "./Segmented";
import { SkinPicker } from "./SkinPicker";
import { AccentPicker } from "./AccentPicker";
import { FrameLookPicker } from "./FrameLookPicker";
import { GlowPicker } from "./GlowPicker";
import { FontPicker } from "./FontPicker";
import { setAppFont, useAppFont } from "@/lib/appFont";
import { TextSizeControl } from "./TextSizeControl";
import { SKIN_SCHEME } from "@/lib/skins";
import { trySkin } from "@/lib/skinTry";
import { NightSkinSettings } from "./NightSkinSettings";
import { AppearanceCode } from "./AppearanceCode";
import { AppearancePreview } from "./AppearancePreview";
import { resetAppearance, applyAppearanceValues } from "@/lib/appearanceCode";
import { toastWithUndo } from "@/lib/undoToast";
import { setBackdrop, useBackdrop, type Backdrop } from "@/lib/backdrop";
import { setShape, useShape, type Shape } from "@/lib/shape";
import { setFrames, useFrames, type Frames } from "@/lib/frames";
import { BASE_SORTS } from "@/lib/sortOptions";
import { HIDEABLE_VIEWS, setViewHidden, useHiddenViews, type HideableView } from "@/lib/hiddenViews";
import { setBottomSlot, useBottomSlot, type BottomSlotView } from "@/lib/bottomSlot";

const BOTTOM_SLOT_OPTIONS: { value: BottomSlotView; label: string; Icon: typeof Bell }[] = [
  { value: "reminders", label: "Terminy", Icon: Bell },
  { value: "shifts", label: "Grafik", Icon: BriefcaseBusiness },
  { value: "study", label: "Praca", Icon: HardHat },
  { value: "calendar", label: "Kalendarz", Icon: CalendarRange },
  { value: "inbox", label: "Skrzynka", Icon: Inbox },
];
import { setTodayCard, useTodayCards } from "@/lib/todayCards";

const HIDEABLE_LABELS: Record<HideableView, string> = {
  inbox: "Skrzynka",
  reminders: "Terminy",
  calendar: "Kalendarz",
  shifts: "Grafik",
  study: "Praca",
  debts: "Długi",
  cwiczenia: "Ćwiczenia",
};
import { SKIN_META } from "@/lib/skinGallery";
import { setSiteMode, useSiteMode, type SiteMode } from "@/lib/siteMode";

const themeOptions: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Jasny", Icon: Sun },
  { value: "dark", label: "Ciemny", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const siteOptions: { value: SiteMode; label: string; Icon: typeof Sun }[] = [
  { value: "off", label: "Wyłączony", Icon: CircleOff },
  { value: "on", label: "Włączony", Icon: HardHat },
  { value: "auto", label: "Automatycznie", Icon: Contrast },
];

const backdropOptions: { value: Backdrop; label: string; Icon: typeof Sun }[] = [
  { value: "full", label: "Pełne", Icon: Sparkles },
  { value: "quiet", label: "Ciche", Icon: Waves },
  { value: "plain", label: "Gładkie", Icon: Square },
];

const shapeOptions: { value: Shape; label: string; Icon: typeof Sun }[] = [
  { value: "sharp", label: "Ostry", Icon: Square },
  { value: "normal", label: "Zwykły", Icon: SquareRoundCorner },
  { value: "soft", label: "Miękki", Icon: Squircle },
];

const framesOptions: { value: Frames; label: string; Icon: typeof Sun }[] = [
  { value: "soft", label: "Delikatne", Icon: Waves },
  { value: "normal", label: "Zwykłe", Icon: SquareRoundCorner },
  { value: "strong", label: "Wyraźne", Icon: Square },
];

const motionOptions: { value: MotionMode; label: string; Icon: typeof Sun }[] = [
  { value: "full", label: "Pełne", Icon: Zap },
  { value: "reduced", label: "Ograniczone", Icon: Accessibility },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Części karty Wygląd — kolejność = kolejność na stronie. Plan motywów 2026-10-30 (1.1): „Szybko” to to,
 * co zmienia się często (styl, jasność, akcent, rozmiar tekstu, tryb budowa); reszta w zwiniętych „Zaawansowanych”.
 */
const APPEARANCE_GROUPS = [
  { id: "wyglad-szybko", label: "Szybko" },
  { id: "wyglad-zaawansowane", label: "Zaawansowane" },
  { id: "wyglad-uklad", label: "Układ" },
  { id: "wyglad-ruch", label: "Ruch" },
] as const;

const ADVANCED_KEY = "kaczy.appearance.advanced.v1";
const readAdvanced = () => { try { return localStorage.getItem(ADVANCED_KEY) === "1"; } catch { return false; } };

/** Pory roku: ikony zamiast emoji (spójnie z resztą Ustawień). */
const SEASON_ICON = { auto: CalendarDays, spring: Flower2, summer: Sun, autumn: Leaf, winter: Snowflake } as const;

/** Skok do grupy: przewinięcie karty i fokus na nagłówku (czytnik ekranu ogłasza, gdzie jest). */
function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block: "start", behavior: isMotionReduced() ? "auto" : "smooth" });
  const heading = el.querySelector<HTMLElement>("h3");
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

/** "Wygląd" tab: style (skin), brightness, motion, seasonal theme, grid layout/density/columns. */
export function AppearanceSettings() {
  const settings = useEffectsSettings();
  const prefs = useViewPrefs();
  const [resetOpen, setResetOpen] = useState(false);
  const [lookResetOpen, setLookResetOpen] = useState(false);
  const [advanced, setAdvancedState] = useState(readAdvanced);
  const setAdvanced = (on: boolean) => { setAdvancedState(on); try { localStorage.setItem(ADVANCED_KEY, on ? "1" : "0"); } catch { /* prywatne okno */ } };
  function resetLook() {
    const before = resetAppearance();
    toastWithUndo("Przywrócono domyślny wygląd", () => applyAppearanceValues(before, { replace: true }));
  }
  const { schemeMode, setMode: setThemeMode, skin } = useTheme();
  const skinScheme = SKIN_SCHEME[skin];
  const hiddenViews = useHiddenViews();
  const todayCards = useTodayCards();
  const bottomSlot = useBottomSlot();
  const siteMode = useSiteMode();
  const appFont = useAppFont();
  const backdrop = useBackdrop();
  const shape = useShape();
  const frames = useFrames();
  const { mode: motionMode, reduced: motionReduced, setMode: setMotionMode } = useMotionPref();
  const { pref: seasonPref, season: activeSeason, setPref: setSeasonPref } = useSeasonPref();

  return (
    <div className="space-y-8">
      {/* Pasek skoku do grup (plan motywów 3.4): przyklejony u góry przewijanej karty. Kontener ma `pt-3`,
          więc pasek wchodzi w ten margines (`-top-3`, `-mt-3` + `pt-4.5`) — inaczej nad nim prześwituje tekst. */}
      {/* Podgląd na żywo (1.2) przyklejony razem z paskiem grup: widać skutek każdej zmiany niżej. */}
      <div className="sticky -top-3 z-sticky -mx-1 -mt-3 space-y-2 bg-background px-1 pb-2 pt-4.5">
      <nav aria-label="Części Wyglądu" className="flex gap-1.5 overflow-x-auto">
        {APPEARANCE_GROUPS.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            onClick={(e) => {
              e.preventDefault();
              if (g.id === "wyglad-zaawansowane" && !advanced) { setAdvanced(true); window.requestAnimationFrame(() => jumpTo(g.id)); }
              else jumpTo(g.id);
            }}
            className="pressable inline-flex shrink-0 items-center rounded-full border border-border/60 bg-muted/40 px-3 py-1.5 coarse:min-h-11 coarse:px-4 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >{g.label}</a>
        ))}
      </nav>
      <AppearancePreview />
      </div>

      <SettingsGroup id="wyglad-szybko" title="Szybko">
        <Section title="Galeria stylów">
          <SkinPicker value={skin} onChange={trySkin} />
        </Section>

        <Section title="Jasność">
          <Segmented label="Jasność" options={themeOptions} value={schemeMode} onChange={setThemeMode} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {skin !== "zeszyt"
              ? `Każdy styl pamięta własną jasność. ${SKIN_META[skin].label} powstał jako ${skinScheme === "dark" ? "ciemny" : "jasny"}.`
              : schemeMode === "system"
                ? "Motyw dopasowuje się do ustawień Twojego systemu."
                : schemeMode === "dark"
                  ? "Ciemny motyw ułatwia pracę wieczorem."
                  : "Klasyczny jasny motyw."}
          </p>
        </Section>

        <Section title="Akcent">
          <AccentPicker skin={skin} />
        </Section>

        <Section title="Rozmiar tekstu">
          <TextSizeControl />
        </Section>

        <Section title="Tryb budowa: większy tekst i przyciski">
          <Segmented label="Tryb budowa" options={siteOptions} value={siteMode} onChange={setSiteMode} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {siteMode === "auto"
              ? "Włącza się, gdy system prosi o większy kontrast."
              : "Do pracy w rękawicach i w słońcu: większy tekst i przyciski, mocniejszy kontrast, gładkie tło, dłuższe „Cofnij”."}
          </p>
        </Section>
      </SettingsGroup>

      <SettingsGroup id="wyglad-zaawansowane" title="Zaawansowane">
        <button
          type="button"
          onClick={() => setAdvanced(!advanced)}
          aria-expanded={advanced}
          aria-controls="wyglad-zaawansowane-tresc"
          className="pressable -mt-2 flex w-full items-center justify-between gap-2 rounded-card border border-border/60 bg-muted/30 px-3 py-2 text-left text-sm coarse:min-h-11"
        >
          <span>{advanced ? "Zwiń" : "Pokaż"}: kształt, ramki, poświata, tło, styl na noc, pora roku, krój, kod wyglądu</span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", advanced && "rotate-180")} aria-hidden />
        </button>
        {advanced && (
          <div id="wyglad-zaawansowane-tresc" className="space-y-4">
        <Section title="Kształt">
          <Segmented label="Kształt" options={shapeOptions} value={shape} onChange={setShape} />
          <p className="text-xs text-muted-foreground mt-1.5">Zaokrąglenie przycisków, pól, kafli i okien w każdym stylu.</p>
        </Section>

        <Section title="Ramki">
          <Segmented label="Ramki" options={framesOptions} value={frames} onChange={setFrames} />
          <p className="text-xs text-muted-foreground mt-1.5">Jak mocno widać krawędzie kart i podziałów. Delikatne — prawie niewidoczne; Wyraźne — pełny kolor motywu.</p>
          <div className="mt-4">
            <FrameLookPicker />
          </div>
        </Section>

        <Section title="Poświata">
          <GlowPicker />
        </Section>

        <Section title="Tło">
          <Segmented label="Tło" options={backdropOptions} value={backdrop} onChange={setBackdrop} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {backdrop === "full"
              ? "Tło stylu z ozdobami i ruchem."
              : backdrop === "quiet"
                ? "Ruch tła stoi, ozdoby są przygaszone. Krótki efekt zapisu zostaje."
                : "Sam kolor tła, bez kratki i ozdób."}
          </p>
        </Section>

        <Section title="Styl na noc">
          <NightSkinSettings skin={skin} />
        </Section>

        <Section title="Motyw pory roku">
          <div className="grid grid-cols-5 gap-2">
            {(["auto", "spring", "summer", "autumn", "winter"] as SeasonPref[]).map((s) => {
              const label = s === "auto" ? "Auto" : SEASON_META[s].label;
              const Icon = SEASON_ICON[s];
              const active = seasonPref === s;
              return (
                <button
                  key={s}
                  onClick={() => setSeasonPref(s)}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 rounded-card border text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary-ink"
                      : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {skin !== "zeszyt"
              ? `W stylu ${SKIN_META[skin].label} pora roku dodaje tylko delikatne plamy światła na tle; kolory i poświata zostają w barwach stylu.`
              : seasonPref === "auto"
                ? settings.seasonalTheme
                  ? `Dopasowany do daty (teraz: ${SEASON_META[activeSeason].label.toLowerCase()}). Tło papieru i akcenty.`
                  : "Auto wymaga włączonego „Motyw sezonowy” w zakładce Efekty. Wybrana pora działa od razu."
                : `Wymuszona kolorystyka: ${SEASON_META[activeSeason].label.toLowerCase()}. Tło papieru i akcenty.`}
          </p>
        </Section>

        <Section title="Kod wyglądu">
          <AppearanceCode />
        </Section>
        <Section title="Krój tekstu">
          <FontPicker value={appFont} onChange={setAppFont} />
          {skinScheme && appFont !== "default" && (
            <p className="text-xs text-muted-foreground mt-1.5">Nagłówki zostają w kroju stylu {SKIN_META[skin].label}.</p>
          )}
        </Section>

          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => setLookResetOpen(true)}>
          <RotateCcw className="size-4" aria-hidden />Przywróć domyślny wygląd
        </Button>
      </SettingsGroup>

      <SettingsGroup id="wyglad-uklad" title="Układ">
        <Section title="Działy na pasku">
          <p className="text-xs text-muted-foreground -mt-1">Ukryty dział znika z paska, z „Więcej” i z palety. Dane zostają, a adres działa dalej. Notatki, Dziś, Archiwum i Kosz są zawsze widoczne.</p>
          {HIDEABLE_VIEWS.map((v) => (
            <ToggleRow key={v} label={HIDEABLE_LABELS[v]} desc={hiddenViews.includes(v) ? "Ukryty" : "Widoczny"} checked={!hiddenViews.includes(v)} onCheck={(on) => setViewHidden(v, !on)} />
          ))}
        </Section>

        <Section title="Dolny pasek">
          <p className="text-xs text-muted-foreground -mt-1">Prawa pozycja obok „+”. Wybór zapisuje się na tym urządzeniu.</p>
          <Segmented label="Czwarta pozycja dolnego paska" options={BOTTOM_SLOT_OPTIONS} value={bottomSlot} onChange={(v) => setBottomSlot(v)} />
        </Section>

        <Section title="Karty na Dziś">
          <p className="text-xs text-muted-foreground -mt-1">Zapisuje się tylko na tym urządzeniu, więc telefon i komputer mogą mieć inne karty.</p>
          <ToggleRow label="Trening mózgu" desc={todayCards.brainTraining ? "Pokazana" : "Ukryta"} checked={todayCards.brainTraining} onCheck={(on) => setTodayCard("brainTraining", on)} />
          <ToggleRow label="Przegląd tygodnia" desc={todayCards.weeklyReview ? "Pokazany" : "Ukryty"} checked={todayCards.weeklyReview} onCheck={(on) => setTodayCard("weeklyReview", on)} />
        </Section>

        <Section title="Domyślny układ siatki">
          <div className="grid grid-cols-3 gap-2">
            {(["masonry", "grid", "list", "board", "table"] as Layout[]).map((l) => (
              <button
                key={l}
                onClick={() => changeView(() => setViewPref("layout", l))}
                aria-pressed={prefs.layout === l}
                className={cn(
                  "p-3 rounded-card border text-xs font-medium transition-all capitalize",
                  prefs.layout === l ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
              >{l === "masonry" ? "Mozaika" : l === "grid" ? "Siatka" : l === "list" ? "Lista" : l === "board" ? "Tablica" : "Tabela"}</button>
            ))}
          </div>
        </Section>

        <Section title="Domyślne sortowanie i grupowanie">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Sortuj wg
              <select
                value={prefs.sortKey}
                onChange={(e) => changeView(() => setViewPref("sortKey", e.target.value as typeof prefs.sortKey))}
                className="h-9 coarse:h-11 rounded-control border border-input bg-background px-2 text-sm text-foreground"
              >
                {BASE_SORTS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              Grupuj wg
              <select
                value={prefs.groupBy}
                onChange={(e) => changeView(() => setViewPref("groupBy", e.target.value as typeof prefs.groupBy))}
                className="h-9 coarse:h-11 rounded-control border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="none">Brak</option>
                <option value="date">Data</option>
                <option value="label">Etykieta</option>
                <option value="folder">Folder</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Ustawienie startowe widoku. Własne pola notatek sortuje się w widoku.</p>
        </Section>

        <Section title="Gęstość">
          <div className="grid grid-cols-3 gap-2">
            {(["compact", "cozy", "comfy"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => changeView(() => setViewPref("density", d))}
                aria-pressed={prefs.density === d}
                className={cn(
                  "p-3 rounded-card border text-xs font-medium transition-all",
                  prefs.density === d ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
              >{d === "compact" ? "Kompakt" : d === "cozy" ? "Komfort" : "Luźno"}</button>
            ))}
          </div>
        </Section>

        <Section title={`Liczba kolumn ${prefs.autoColumns ? "(auto)" : `(${prefs.columns})`}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeView(() => setViewPref("autoColumns", true))}
              aria-pressed={prefs.autoColumns}
              className={cn("flex-1 px-3 py-2 rounded-card border text-xs font-medium",
                prefs.autoColumns ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
            >Auto (responsywne)</button>
            {[1, 2, 3, 4].map((c) => (
              <button
                key={c}
                onClick={() => changeView(() => { setViewPref("autoColumns", false); setViewPref("columns", c); })}
                aria-pressed={!prefs.autoColumns && prefs.columns === c}
                className={cn("w-10 h-10 coarse:size-11 rounded-card border text-sm font-bold",
                  !prefs.autoColumns && prefs.columns === c ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
              >{c}</button>
            ))}
          </div>
        </Section>

        <ToggleRow
          label="Pokaż czas czytania"
          desc="Dodaje szacowany czas czytania do każdej notatki."
          checked={prefs.showReadingTime}
          onCheck={(v) => setViewPref("showReadingTime", v)}
        />
        <ToggleRow
          label="Pokaż backlinki"
          desc="W trybie prezentacji wyświetla notatki linkujące do bieżącej."
          checked={prefs.showBacklinks}
          onCheck={(v) => setViewPref("showBacklinks", v)}
        />

        <Button variant="ghost" size="sm" disabled={changedViewPrefs().length === 0} onClick={() => setResetOpen(true)}>
          Przywróć domyślne
        </Button>
      </SettingsGroup>

      <SettingsGroup id="wyglad-ruch" title="Ruch">
        <Section title="Ruch i animacje">
          <Segmented label="Ruch i animacje" options={motionOptions} value={motionMode} onChange={setMotionMode} />
          <p className="text-xs text-muted-foreground mt-1.5">
            {motionMode === "system"
              ? `Zgodnie z ustawieniem systemu (teraz: ${motionReduced ? "ograniczony ruch" : "pełne animacje"}).`
              : motionMode === "reduced"
                ? "Animacje, przejścia i efekty ruchu są wyłączone."
                : "Wszystkie animacje włączone, łącznie z ruchomym tłem."}
          </p>
        </Section>

        <EffectsSettings />
      </SettingsGroup>

      <AlertDialog open={lookResetOpen} onOpenChange={setLookResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić domyślny wygląd?</AlertDialogTitle>
            <AlertDialogDescription>
              Wrócą: styl Zeszyt, jasność, akcent, kształt, ramki, poświata, tło, krój i rozmiar tekstu, styl na noc,
              pora roku, tryb budowa i ruch. Notatki, układ widoku i efekty zostają. Zmianę cofniesz z komunikatu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={resetLook}>Przywróć</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset kasuje ustawienia widoku, nie tylko wygląd — dlatego potwierdzenie mówi, co dokładnie wróci do domyślnych. */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić domyślne ustawienia widoku?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmienią się: {changedViewPrefs().map((k) => VIEW_PREF_LABELS[k]).join(", ") || "nic — wszystko już jest domyślne"}.
              Nie zmienią się: skórka, czcionka, tryb ruchu, motyw sezonowy, efekty, potwierdzenia, sync, sejf i powiadomienia push.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => { resetViewPrefs(); toast.success("Przywrócono domyślne ustawienia widoku"); }}>
              Przywróć domyślne
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

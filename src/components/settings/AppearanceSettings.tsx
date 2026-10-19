import { useState } from "react";
import { Sun, Moon, Monitor, Zap, Accessibility, HardHat, CircleOff, Contrast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useViewPrefs, setViewPref, resetViewPrefs, type Density, type Layout } from "@/lib/viewPrefs";
import { changeView } from "@/lib/viewChange";
import { useEffectsSettings } from "@/lib/effectsSettings";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useMotionPref, type MotionMode } from "@/hooks/useMotionPref";
import { SEASON_META, useSeasonPref, type SeasonPref } from "@/lib/seasonTheme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Section, ToggleRow } from "./SettingsShared";
import { Segmented } from "./Segmented";
import { SkinPicker } from "./SkinPicker";
import { FontPicker } from "./FontPicker";
import { setAppFont, useAppFont } from "@/lib/appFont";
import { SKIN_SCHEME } from "@/lib/skins";
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

const motionOptions: { value: MotionMode; label: string; Icon: typeof Sun }[] = [
  { value: "full", label: "Pełne", Icon: Zap },
  { value: "reduced", label: "Ograniczone", Icon: Accessibility },
  { value: "system", label: "System", Icon: Monitor },
];

/** "Wygląd" tab: style (skin), brightness, motion, seasonal theme, grid layout/density/columns. */
export function AppearanceSettings() {
  const settings = useEffectsSettings();
  const prefs = useViewPrefs();
  const [resetOpen, setResetOpen] = useState(false);
  const { mode: themeMode, setMode: setThemeMode, skin, setSkin } = useTheme();
  const skinScheme = SKIN_SCHEME[skin];
  const siteMode = useSiteMode();
  const appFont = useAppFont();
  const { mode: motionMode, reduced: motionReduced, setMode: setMotionMode } = useMotionPref();
  const { pref: seasonPref, season: activeSeason, setPref: setSeasonPref } = useSeasonPref();

  return (
    <div className="space-y-4">
      <Section title="Styl">
        <SkinPicker value={skin} onChange={setSkin} />
      </Section>

      <Section title="Krój tekstu">
        <FontPicker value={appFont} onChange={setAppFont} />
        {skinScheme && appFont !== "default" && (
          <p className="text-xs text-muted-foreground mt-1.5">Nagłówki zostają w kroju stylu {SKIN_META[skin].label}.</p>
        )}
      </Section>

      <Section title="Jasność">
        <Segmented label="Jasność" options={themeOptions} value={themeMode} onChange={setThemeMode} disabled={!!skinScheme} />
        <p className="text-xs text-muted-foreground mt-1.5">
          {skinScheme
            ? `${SKIN_META[skin].label} ma własne, ${skinScheme === "dark" ? "ciemne" : "jasne"} kolory. Jasność ustawisz w stylu Zeszyt.`
            : themeMode === "system"
              ? "Motyw dopasowuje się do ustawień Twojego systemu."
              : themeMode === "dark"
                ? "Ciemny motyw ułatwia pracę wieczorem."
                : "Klasyczny jasny motyw."}
        </p>
      </Section>

      <Section title="Tryb budowa">
        <Segmented label="Tryb budowa" options={siteOptions} value={siteMode} onChange={setSiteMode} />
        <p className="text-xs text-muted-foreground mt-1.5">
          {siteMode === "auto"
            ? "Włącza się, gdy system prosi o większy kontrast."
            : "Do pracy w rękawicach i w słońcu: większy tekst i przyciski, mocniejszy kontrast, gładkie tło, dłuższe „Cofnij”."}
        </p>
      </Section>

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

      <Section title="Motyw pory roku">
        <div className="grid grid-cols-5 gap-2">
          {(["auto", "spring", "summer", "autumn", "winter"] as SeasonPref[]).map((s) => {
            const meta = s === "auto" ? { label: "Auto", emoji: "🗓️" } : SEASON_META[s];
            const active = seasonPref === s;
            return (
              <button
                key={s}
                onClick={() => setSeasonPref(s)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary-ink"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
              >
                <span className="text-lg leading-none" aria-hidden>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {settings.seasonalTheme
            ? seasonPref === "auto"
              ? `Kolory akcentów dopasowują się do daty (teraz: ${SEASON_META[activeSeason].label.toLowerCase()}).`
              : `Wymuszona kolorystyka: ${SEASON_META[activeSeason].label.toLowerCase()}.`
            : "Włącz „Motyw sezonowy” w zakładce Efekty, aby zobaczyć zmiany kolorów."}
        </p>
      </Section>

      <Section title="Domyślny układ siatki">
        <div className="grid grid-cols-3 gap-2">
          {(["masonry", "grid", "list", "board", "table"] as Layout[]).map((l) => (
            <button
              key={l}
              onClick={() => changeView(() => setViewPref("layout", l))}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium transition-all capitalize",
                prefs.layout === l ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
            >{l === "masonry" ? "Mozaika" : l === "grid" ? "Siatka" : l === "list" ? "Lista" : l === "board" ? "Tablica" : "Tabela"}</button>
          ))}
        </div>
      </Section>

      <Section title="Gęstość">
        <div className="grid grid-cols-3 gap-2">
          {(["compact", "cozy", "comfy"] as Density[]).map((d) => (
            <button
              key={d}
              onClick={() => changeView(() => setViewPref("density", d))}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium transition-all",
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
            className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium",
              prefs.autoColumns ? "border-primary bg-primary/10 text-primary-ink" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
          >Auto (responsywne)</button>
          {[1, 2, 3, 4].map((c) => (
            <button
              key={c}
              onClick={() => changeView(() => { setViewPref("autoColumns", false); setViewPref("columns", c); })}
              className={cn("w-10 h-10 rounded-xl border text-sm font-bold",
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

      <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
        Przywróć domyślne
      </Button>

      {/* Reset kasuje ustawienia widoku, nie tylko wygląd — dlatego potwierdzenie mówi, co dokładnie wróci do domyślnych. */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić domyślne ustawienia widoku?</AlertDialogTitle>
            <AlertDialogDescription>
              Wrócą do domyślnych: gęstość, układ i kolumny; sortowanie, grupowanie i filtry; kolor nowej notatki; pisownia;
              autosave; przypomnienia o kopii, o dzisiejszych zadaniach i o przeglądzie tygodnia; czas czytania i backlinki.
              Nie zmienią się: skórka, czcionka, tryb ruchu, motyw sezonowy, efekty, potwierdzenia, sync, kopia, sejf i powiadomienia push.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => { resetViewPrefs(); toast.success("Przywrócono domyślne ustawienia widoku"); }}>
              Przywróć domyślne
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

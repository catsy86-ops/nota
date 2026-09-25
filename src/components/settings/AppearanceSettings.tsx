import { Sun, Moon, Monitor, Zap, Accessibility } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useViewPrefs, setViewPref, resetViewPrefs, type Density, type Layout } from "@/lib/viewPrefs";
import { useEffectsSettings } from "@/lib/effectsSettings";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { useMotionPref, type MotionMode } from "@/hooks/useMotionPref";
import { SEASON_META, useSeasonPref, type SeasonPref } from "@/lib/seasonTheme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Section, ToggleRow } from "./SettingsShared";

const themeOptions: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Jasny", Icon: Sun },
  { value: "dark", label: "Ciemny", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

const motionOptions: { value: MotionMode; label: string; Icon: typeof Sun }[] = [
  { value: "full", label: "Pełne", Icon: Zap },
  { value: "reduced", label: "Ograniczone", Icon: Accessibility },
  { value: "system", label: "System", Icon: Monitor },
];

/** "Wygląd" tab: theme, motion, seasonal theme, grid layout/density/columns. */
export function AppearanceSettings() {
  const settings = useEffectsSettings();
  const prefs = useViewPrefs();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const { mode: motionMode, reduced: motionReduced, setMode: setMotionMode } = useMotionPref();
  const { pref: seasonPref, season: activeSeason, setPref: setSeasonPref } = useSeasonPref();

  return (
    <div className="space-y-4">
      <Section title="Motyw">
        <div className="relative grid grid-cols-3 gap-2 p-1 rounded-2xl bg-muted/40 border border-border/60">
          {themeOptions.map((opt) => {
            const active = themeMode === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                onClick={() => setThemeMode(opt.value)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={active}
              >
                {active && (
                  <motion.span
                    layoutId="theme-pill"
                    className="absolute inset-0 rounded-xl bg-background shadow-sm border border-border/60"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{opt.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {themeMode === "system"
            ? "Motyw dopasowuje się do ustawień Twojego systemu."
            : themeMode === "dark"
              ? "Ciemny motyw ułatwia pracę wieczorem."
              : "Klasyczny jasny motyw."}
        </p>
      </Section>

      <Section title="Ruch i animacje">
        <div className="grid grid-cols-3 gap-2">
          {motionOptions.map((opt) => {
            const active = motionMode === opt.value;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.value}
                onClick={() => setMotionMode(opt.value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {motionMode === "system"
            ? `Zgodnie z ustawieniem systemu (teraz: ${motionReduced ? "ograniczony ruch" : "pełne animacje"}).`
            : motionMode === "reduced"
              ? "Animacje, przejścia i efekty ruchu są wyłączone."
              : "Wszystkie animacje włączone, niezależnie od ustawień systemu."}
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
                  "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border text-[11px] font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                )}
              >
                <span className="text-lg leading-none" aria-hidden>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {settings.seasonalTheme
            ? seasonPref === "auto"
              ? `Kolory tła i akcentów dopasowują się do daty (teraz: ${SEASON_META[activeSeason].label.toLowerCase()}).`
              : `Wymuszona kolorystyka: ${SEASON_META[activeSeason].label.toLowerCase()}.`
            : "Włącz „Motyw sezonowy” w zakładce Efekty, aby zobaczyć zmiany kolorów."}
        </p>
      </Section>

      <Section title="Domyślny układ siatki">
        <div className="grid grid-cols-3 gap-2">
          {(["masonry", "grid", "list"] as Layout[]).map((l) => (
            <button
              key={l}
              onClick={() => setViewPref("layout", l)}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium transition-all capitalize",
                prefs.layout === l ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
            >{l === "masonry" ? "Masonry" : l === "grid" ? "Siatka" : "Lista"}</button>
          ))}
        </div>
      </Section>

      <Section title="Gęstość">
        <div className="grid grid-cols-3 gap-2">
          {(["compact", "cozy", "comfy"] as Density[]).map((d) => (
            <button
              key={d}
              onClick={() => setViewPref("density", d)}
              className={cn(
                "p-3 rounded-xl border text-xs font-medium transition-all",
                prefs.density === d ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
            >{d === "compact" ? "Kompakt" : d === "cozy" ? "Komfort" : "Luźno"}</button>
          ))}
        </div>
      </Section>

      <Section title={`Liczba kolumn ${prefs.autoColumns ? "(auto)" : `(${prefs.columns})`}`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewPref("autoColumns", true)}
            className={cn("flex-1 px-3 py-2 rounded-xl border text-xs font-medium",
              prefs.autoColumns ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
          >Auto (responsywne)</button>
          {[1, 2, 3, 4].map((c) => (
            <button
              key={c}
              onClick={() => { setViewPref("autoColumns", false); setViewPref("columns", c); }}
              className={cn("w-10 h-10 rounded-xl border text-sm font-bold",
                !prefs.autoColumns && prefs.columns === c ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60")}
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

      <Button variant="ghost" size="sm" onClick={() => { resetViewPrefs(); toast.success("Przywrócono ustawienia"); }}>
        Przywróć domyślne
      </Button>
    </div>
  );
}

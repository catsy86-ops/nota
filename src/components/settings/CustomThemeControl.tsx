import { baseHues, customThemeFailing, GROUP_LABEL, setCustomTheme, useCustomTheme, type Group } from "@/lib/customTheme";
import { SKIN_META } from "@/lib/skinGallery";
import { useSkin } from "@/lib/skins";

const GROUPS = Object.keys(GROUP_LABEL) as Group[];

/**
 * Własny motyw (plan motywów 4.1, T-4): trzy suwaki odcienia dla bieżącego stylu. Bez HEX; kontrast
 * sprawdza generator (`src/lib/customTheme.ts`) i tu tylko pokazuje wynik.
 */
export function CustomThemeControl() {
  const skin = useSkin();
  const theme = useCustomTheme();
  const active = theme && theme.skin === skin ? theme : null;
  const label = SKIN_META[skin].label;

  if (!active) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Odcienie papieru, kafla i akcentu z „{label}”. Jasność i tekst pilnuje generator, kontrast zostaje na poziomie AA.
        </p>
        <button
          type="button"
          onClick={() => setCustomTheme({ skin, hues: baseHues() })}
          className="pressable rounded-card border border-border/60 bg-muted/30 px-3 py-2 text-sm coarse:min-h-11"
        >
          Zrób własny motyw z „{label}”
        </button>
      </div>
    );
  }

  const failing = customThemeFailing();
  return (
    <div className="space-y-3">
      {GROUPS.map((g) => (
        <label key={g} className="grid gap-1 text-sm">
          <span className="flex items-baseline justify-between gap-2">
            <span>{GROUP_LABEL[g]}</span>
            <span className="tabular-nums text-xs text-muted-foreground">{active.hues[g]}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={active.hues[g]}
            onChange={(e) => setCustomTheme({ ...active, hues: { ...active.hues, [g]: Number(e.target.value) } })}
            className="h-11 w-full accent-primary"
          />
        </label>
      ))}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {failing.length
          ? `Te odcienie nie dają czytelnego tekstu, więc zostają bazowe: ${failing.map((g) => GROUP_LABEL[g].toLowerCase()).join(", ")}.`
          : "Kontrast tekstu w porządku (AA)."}
      </p>
      <button
        type="button"
        onClick={() => setCustomTheme(null)}
        className="pressable rounded-card border border-border/60 bg-muted/30 px-3 py-2 text-sm coarse:min-h-11"
      >
        Przywróć styl „{label}”
      </button>
    </div>
  );
}

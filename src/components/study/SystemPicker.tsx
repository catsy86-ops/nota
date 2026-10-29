import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { setCatalogPrefs, SYSTEMS, systemDef, useCatalogPrefs } from "@/lib/study/catalog";

const chip = "pressable rounded-full border px-2.5 py-1 text-xs coarse:min-h-11 coarse:px-3 coarse:text-sm";

/**
 * Wybór systemu instalacji (i średnicy kształtek) w polach wpisu — H1.5. Wybór jest wspólny dla rur
 * i kształtek i zostaje na urządzeniu (`kaczy.study.catalog.v1`).
 */
export function SystemPicker({ sizes = false }: { sizes?: boolean }) {
  const prefs = useCatalogPrefs();
  const def = systemDef(prefs.system);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="System instalacji">
        {SYSTEMS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={prefs.system === s.id}
            title={s.label}
            aria-label={s.label}
            onClick={() => { haptic("selection"); setCatalogPrefs({ system: s.id }); }}
            className={cn(chip, prefs.system === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted")}
          >
            {s.short}
          </button>
        ))}
      </div>
      {sizes && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Średnica: ${def.short}`}>
          {def.sizes.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={prefs.size === size}
              onClick={() => { haptic("selection"); setCatalogPrefs({ size }); }}
              className={cn(chip, "font-mono tabular-nums", prefs.size === size ? "border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted")}
            >
              {size}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

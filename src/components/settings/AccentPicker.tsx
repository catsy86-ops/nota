import { Check } from "lucide-react";
import { setAccent, useAccent } from "@/lib/accent";
import { ACCENT_META } from "@/lib/accentMeta";
import type { Skin } from "@/lib/skins";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { moveRadio } from "./SettingsShared";

/**
 * Kolor akcentu stylu (plan motywów 1.1): pięć kółek z odcieniami bieżącego stylu, pierwszy to
 * jego własna barwa. Wybór od razu zmienia `--primary` w całej aplikacji; pamiętany osobno dla stylu.
 */
export function AccentPicker({ skin }: { skin: Skin }) {
  const value = useAccent(skin);
  const options = ACCENT_META[skin];
  const indexes = options.map((_, i) => i);
  const pick = (n: number) => { if (n !== value) { haptic("selection"); setAccent(skin, n); } };
  return (
    <div>
      <div role="radiogroup" aria-label="Kolor akcentu" className="flex flex-wrap gap-2">
        {options.map((o, i) => {
          const active = i === value;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              tabIndex={active ? 0 : -1}
              data-accent-option={i}
              onClick={() => pick(i)}
              onKeyDown={(e) => moveRadio(e, indexes, value, pick)}
              className={cn(
                "pressable grid h-11 w-11 place-items-center rounded-full outline-hidden ring-offset-2 ring-offset-background transition-shadow duration-fast",
                "focus-visible:ring-2 focus-visible:ring-ring",
                active && "ring-2 ring-foreground/70",
              )}
            >
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full shadow-sm ring-1 ring-foreground/15" style={{ backgroundColor: o.swatch }}>
                {active && <Check className="h-4 w-4 text-black/75" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{options[value].label}{value === 0 ? " — barwa stylu." : "."} Każdy styl pamięta swój akcent.</p>
    </div>
  );
}

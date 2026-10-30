import { useState } from "react";
import { LayoutGroup, m as motion } from "framer-motion";
import { Check } from "lucide-react";
import { SKINS, SKIN_SCHEME, type Skin } from "@/lib/skins";
import { accentFor, useAccentMap } from "@/lib/accent";
import { ACCENT_META } from "@/lib/accentMeta";
import { SKIN_META } from "@/lib/skinGallery";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { moveRadio } from "./SettingsShared";

interface SkinPickerProps {
  value: Skin;
  onChange: (s: Skin) => void;
}

/**
 * Galeria stylów: każda miniatura to ten styl w małej skali — tło, kafel notatki,
 * akcent i „Aa” krojem nagłówków. Wybór obwódka przenosi sprężyną (`layoutId`),
 * a cała aplikacja przechodzi kołem od miejsca dotknięcia (useTheme).
 * Kolor akcentu na miniaturze to odcień zapamiętany dla tego stylu (plan motywów 3.2), a pod
 * opisem znaczki: schemat (jasny / ciemny / oba) i „Ruchome tło”.
 */
// Każdy styl ma oba schematy (4.1); najpierw ten, w którym powstał i który jest domyślny.
const SCHEME_BADGE = { light: "Jasny + ciemny", dark: "Ciemny + jasny" } as const;

/** Style schowane pod „Więcej stylów” (plan motywów 3.5): mniej używane, ale nadal w galerii. */
const MORE_SKINS: readonly Skin[] = ["matrix"];

export function SkinPicker({ value, onChange }: SkinPickerProps) {
  const accents = useAccentMap();
  // Schowany styl pojawia się od razu, gdy jest wybrany; inaczej po rozwinięciu „Więcej stylów”.
  const [moreOpen, setMoreOpen] = useState(() => MORE_SKINS.includes(value));
  const visibleSkins = SKINS.filter((s) => !MORE_SKINS.includes(s) || moreOpen);
  return (
    <LayoutGroup id="skin-picker">
      <div role="radiogroup" aria-label="Styl aplikacji" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleSkins.map((s, i) => {
          const meta = SKIN_META[s];
          const active = s === value;
          const p = meta.preview;
          const accent = ACCENT_META[s][accentFor(s, accents)].swatch;
          const scheme = SKIN_SCHEME[s];
          const badges = [scheme ? SCHEME_BADGE[scheme] : SCHEME_BADGE.light, ...(meta.ambient ? ["Ruchome tło"] : [])];
          return (
            <motion.button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => moveRadio(e, visibleSkins, value, onChange)}
              data-skin-option={s}
              onClick={() => { if (!active) { haptic("selection"); onChange(s); } }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.snap}
              // Zeszyt (domyślny) bierze całą szerokość u góry; pozostałe sześć układa się w siatkę 2×3 / 3×2.
              className={cn(
                "group relative rounded-card p-1.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                i === 0 && "col-span-2 sm:col-span-3",
              )}
            >
              {active && (
                <motion.span
                  layoutId="skin-active"
                  transition={spring.soft}
                  aria-hidden
                  className="absolute inset-0 rounded-card border-2 border-primary bg-primary/5"
                />
              )}
              <span
                data-thumb={s}
                aria-hidden
                className={cn(
                  "skin-thumb relative block aspect-[16/10] rounded-card shadow-sm ring-1 ring-foreground/10 transition-shadow duration-base group-hover:shadow-elevation-2",
                  i === 0 && "aspect-[16/7]",
                )}
                style={{ backgroundColor: p.bg, color: p.ink }}
              >
                <span className="absolute left-2.5 top-1.5 text-[1.375rem] leading-none" style={{ fontFamily: meta.font, fontWeight: 600 }}>Aa</span>
                {!active && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}` }} />}
                <span className="absolute inset-x-2.5 bottom-2 rounded-control px-2 py-1.5 shadow-sm" style={{ backgroundColor: p.card }}>
                  <span className="block h-1.5 w-3/5 rounded-full" style={{ backgroundColor: p.ink, opacity: 0.85 }} />
                  <span className="mt-1 block h-1 w-4/5 rounded-full" style={{ backgroundColor: p.muted, opacity: 0.8 }} />
                  {/* Przycisk główny w akcencie: pigułka, nie kreska — widać, jak wygląda „Zapisz”. */}
                  <span className="mt-1.5 block h-2.5 w-9 rounded-full" style={{ backgroundColor: accent }} />
                </span>
                {active && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={spring.snap}
                    className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full shadow-sm"
                    style={{ backgroundColor: accent, color: p.bg }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              <span className="relative mt-2 block px-1 text-sm font-semibold text-foreground">{meta.label}</span>
              <span className={cn("relative block px-1 pb-0.5 text-2xs text-muted-foreground")}>{meta.blurb}</span>
              <span className="relative mt-1 flex flex-wrap gap-1 px-1 pb-0.5">
                {badges.map((b) => (
                  <span key={b} className="rounded-full border border-border/70 px-1.5 py-px text-2xs leading-4 text-muted-foreground">{b}</span>
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
      {!moreOpen && (
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-expanded={false}
          className="pressable mt-3 w-full rounded-card border border-dashed border-border/70 px-3 py-2 text-sm text-muted-foreground hover:text-foreground coarse:min-h-11"
        >
          Więcej stylów ({MORE_SKINS.length})
        </button>
      )}
    </LayoutGroup>
  );
}

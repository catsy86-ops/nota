import { LayoutGroup, m as motion } from "framer-motion";
import { Check } from "lucide-react";
import { SKINS, type Skin } from "@/lib/skins";
import { SKIN_META } from "@/lib/skinGallery";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface SkinPickerProps {
  value: Skin;
  onChange: (s: Skin) => void;
}

/**
 * Galeria stylów: każda miniatura to ten styl w małej skali — tło, kafel notatki,
 * akcent i „Aa” krojem nagłówków. Wybór obwódka przenosi sprężyną (`layoutId`),
 * a cała aplikacja przechodzi kołem od miejsca dotknięcia (useTheme).
 */
export function SkinPicker({ value, onChange }: SkinPickerProps) {
  return (
    <LayoutGroup id="skin-picker">
      <div role="group" aria-label="Styl aplikacji" className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SKINS.map((s) => {
          const meta = SKIN_META[s];
          const active = s === value;
          const p = meta.preview;
          return (
            <motion.button
              key={s}
              type="button"
              aria-pressed={active}
              data-skin-option={s}
              onClick={() => { if (!active) { haptic("selection"); onChange(s); } }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              transition={spring.snap}
              className="group relative rounded-card p-1.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
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
                className="skin-thumb relative block aspect-[16/10] rounded-xl shadow-sm ring-1 ring-black/5 transition-shadow duration-base group-hover:shadow-md"
                style={{ backgroundColor: p.bg, color: p.ink }}
              >
                <span className="absolute left-2.5 top-1.5 text-[1.375rem] leading-none" style={{ fontFamily: meta.font, fontWeight: 600 }}>Aa</span>
                {!active && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.accent, boxShadow: `0 0 10px ${p.accent}` }} />}
                <span className="absolute inset-x-2.5 bottom-2 rounded-md px-2 py-1.5 shadow-sm" style={{ backgroundColor: p.card }}>
                  <span className="block h-1.5 w-3/5 rounded-full" style={{ backgroundColor: p.ink, opacity: 0.85 }} />
                  <span className="mt-1 block h-1 w-4/5 rounded-full" style={{ backgroundColor: p.muted, opacity: 0.8 }} />
                  <span className="mt-1.5 block h-1.5 w-6 rounded-full" style={{ backgroundColor: p.accent }} />
                </span>
                {active && (
                  <motion.span
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={spring.snap}
                    className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full shadow-sm"
                    style={{ backgroundColor: p.accent, color: p.bg }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </motion.span>
                )}
              </span>
              <span className="relative mt-2 block px-1 text-sm font-semibold text-foreground">{meta.label}</span>
              <span className={cn("relative block px-1 pb-0.5 text-2xs text-muted-foreground")}>{meta.blurb}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

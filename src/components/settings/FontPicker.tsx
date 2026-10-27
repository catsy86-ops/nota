import { LayoutGroup, m as motion } from "framer-motion";
import { Check } from "lucide-react";
import { APP_FONTS, APP_FONT_META, type AppFont } from "@/lib/appFont";
import { spring } from "@/lib/motion";
import { haptic } from "@/lib/haptics";
import { moveRadio } from "./SettingsShared";

interface FontPickerProps {
  value: AppFont;
  onChange: (f: AppFont) => void;
}

/**
 * Wybór kroju tekstu: każdy kafel pisze swoją nazwę i próbkę z polskimi znakami
 * tym krojem, więc widać różnicę przed wyborem. Obwódka wyboru przejeżdża
 * sprężyną (`layoutId`), jak w galerii stylów.
 */
export function FontPicker({ value, onChange }: FontPickerProps) {
  return (
    <LayoutGroup id="font-picker">
      <div role="radiogroup" aria-label="Krój tekstu" className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2">
        {APP_FONTS.map((f) => {
          const meta = APP_FONT_META[f];
          const active = f === value;
          return (
            <motion.button
              key={f}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => moveRadio(e, APP_FONTS, value, onChange)}
              data-font-option={f}
              onClick={() => { if (!active) { haptic("selection"); onChange(f); } }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={spring.snap}
              className="group relative rounded-card border border-border/60 bg-muted/30 px-3 py-2.5 text-left outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {active && (
                <motion.span
                  layoutId="font-active"
                  transition={spring.soft}
                  aria-hidden
                  className="absolute -inset-px rounded-card border-2 border-primary bg-primary/5"
                />
              )}
              <span className="relative flex items-baseline justify-between gap-2" style={{ fontFamily: meta.family }}>
                <span className="text-base font-semibold text-foreground">{meta.label}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden />}
              </span>
              {/* Próbka zawija się zamiast się ucinać — znaki „Il1 O0” są tym, po co ludzie porównują kroje. */}
              <span className="relative mt-0.5 block text-sm leading-snug text-foreground/80 break-words" style={{ fontFamily: meta.family }} aria-hidden>
                Zażółć gęślą jaźń
                <span className="block font-mono text-xs opacity-80" style={{ fontFamily: meta.family }}>Il1 O0 · 0123456789</span>
              </span>
              <span className="relative mt-1 block text-2xs text-muted-foreground">{meta.blurb}</span>
            </motion.button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

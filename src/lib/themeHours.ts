import { createPersistedStore } from "@/lib/persistedStore";
import { isNightHours } from "@/lib/skinSchedule";
import { APPEARANCE } from "@/lib/storage/names";

/**
 * Jasność „Według pory” (Q3.3): jasny od `from` do `to`, ciemny poza tymi godzinami. Bez lokalizacji — same godziny,
 * domyślnie 7:00–19:00. Per urządzenie, jak reszta wyglądu. Rozstrzyga `resolveDark` w `useTheme.ts`; ten sam
 * rachunek powtarza `public/prepaint.js` (zgodność pilnuje `src/lib/prepaint.test.ts`).
 */
export interface ThemeHours {
  /** Początek jasnego, „HH:MM”. */
  from: string;
  /** Koniec jasnego, „HH:MM”. */
  to: string;
}

export const THEME_HOURS_DEFAULT: ThemeHours = { from: "07:00", to: "19:00" };

const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

export const themeHoursStore = createPersistedStore<ThemeHours>(APPEARANCE.themeHours, THEME_HOURS_DEFAULT, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    const s = stored as Partial<ThemeHours>;
    return { from: isTime(s.from) ? s.from : defaults.from, to: isTime(s.to) ? s.to : defaults.to };
  },
});

/** Czy o `now` ma być ciemno. Te same godziny początku i końca = zawsze jasno. */
export const darkByHours = (now: Date, h: ThemeHours): boolean => isNightHours(now, h.to, h.from);

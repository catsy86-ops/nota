import { createPersistedStore } from "@/lib/persistedStore";
import type { Skin } from "@/lib/skinList";
import { APPEARANCE } from "@/lib/storage/names";

/**
 * Jasność wybrana osobno dla każdego stylu poza Zeszytem (plan motywów 4.1, decyzja M-2: każdy styl ma
 * dwa schematy). Brak wpisu = schemat, w którym styl powstał (`SKIN_SCHEME`), więc po aktualizacji nic
 * się nie zmienia bez akcji użytkownika. Zeszyt dalej używa wspólnego przełącznika (`kaczy-theme`).
 * Per urządzenie. Rozstrzyga `resolveDark` w `useTheme.ts`.
 */
/** `time` — według pory (Q3.3, godziny w `themeHours.ts`); starsza wersja go nie zna i bierze schemat stylu. */
export type SchemePref = "system" | "light" | "dark" | "time";
export type SkinSchemeMap = Partial<Record<Exclude<Skin, "zeszyt">, SchemePref>>;

const isPref = (v: unknown): v is SchemePref => v === "system" || v === "light" || v === "dark" || v === "time";

export const skinSchemeStore = createPersistedStore<SkinSchemeMap>(APPEARANCE.skinScheme, {}, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    return Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter(([, v]) => isPref(v))) as SkinSchemeMap;
  },
});

export function setSkinScheme(skin: Exclude<Skin, "zeszyt">, pref: SchemePref) {
  skinSchemeStore.set({ ...skinSchemeStore.get(), [skin]: pref });
}

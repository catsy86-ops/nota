import { createPersistedStore } from "@/lib/persistedStore";
import type { Skin } from "@/lib/skinList";

/**
 * Jasność wybrana osobno dla każdego stylu poza Zeszytem (plan motywów 4.1, decyzja M-2: każdy styl ma
 * dwa schematy). Brak wpisu = schemat, w którym styl powstał (`SKIN_SCHEME`), więc po aktualizacji nic
 * się nie zmienia bez akcji użytkownika. Zeszyt dalej używa wspólnego przełącznika (`kaczy-theme`).
 * Per urządzenie. Rozstrzyga `resolveDark` w `useTheme.ts`.
 */
export type SchemePref = "system" | "light" | "dark";
export type SkinSchemeMap = Partial<Record<Exclude<Skin, "zeszyt">, SchemePref>>;

const isPref = (v: unknown): v is SchemePref => v === "system" || v === "light" || v === "dark";

export const skinSchemeStore = createPersistedStore<SkinSchemeMap>("kaczy.skinScheme.v1", {}, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    return Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter(([, v]) => isPref(v))) as SkinSchemeMap;
  },
});

export function setSkinScheme(skin: Exclude<Skin, "zeszyt">, pref: SchemePref) {
  skinSchemeStore.set({ ...skinSchemeStore.get(), [skin]: pref });
}

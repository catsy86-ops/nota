import { pulseSkinSignal } from "@/lib/skinSignal";
import { createPersistedStore } from "@/lib/persistedStore";
import { SKINS, type Skin } from "@/lib/skinList";

/**
 * Styl aplikacji („skórka”) — niezależny od jasny/ciemny. „Zeszyt” to domyślny
 * kierunek i jedyny, który słucha przełącznika jasny/ciemny; pozostałe mają
 * jeden, zaprojektowany schemat (`SKIN_SCHEME`). Tokeny i tła: `src/styles/skins/<id>.css`
 * pod `html[data-skin="…"]`. Lista, schematy i kolory paska: `skinList.ts`.
 */
export { SKINS, SKIN_SCHEME, SKIN_THEME_COLOR, type Skin } from "@/lib/skinList";

export function isSkin(v: unknown): v is Skin {
  return typeof v === "string" && (SKINS as readonly string[]).includes(v);
}

export const skinStore = createPersistedStore<Skin>("kaczy.skin.v1", "zeszyt", {
  merge: (defaults, stored) => (isSkin(stored) ? stored : defaults),
});

export const useSkin = () => skinStore.use();
export const setSkin = (s: Skin) => {
  skinStore.set(s);
  pulseSkinSignal("skin");
};

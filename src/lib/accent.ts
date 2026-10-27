import { createPersistedStore } from "@/lib/persistedStore";
import { skinStore } from "@/lib/skins";
import type { Skin } from "@/lib/skinList";

/**
 * Kolor akcentu w stylu (plan motywów 1.1; Ustawienia → Wygląd → „Akcent”). Każdy styl ma pięć
 * odcieni: 0 = jego własna barwa, 1–4 = przygotowane warianty sprawdzone pod kątem kontrastu.
 * Wybór jest pamiętany osobno dla każdego stylu (decyzja M-3: wspólny akcent dałby np. bursztyn
 * w Matrycy). Per urządzenie. CSS: `html[data-accent="1…4"]` w `src/styles/accents.css` — plik
 * generowany przez `docs/tools/accents/accents-gen.mjs`; kolejność odcieni musi się tam zgadzać.
 */
/** Liczba odcieni w stylu (z barwą stylu). Nazwy i próbki: `accentMeta.ts` (tylko Ustawienia, leniwie). */
export const ACCENT_COUNT = 5;

type AccentMap = Partial<Record<Skin, number>>;

const valid = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < ACCENT_COUNT;

const store = createPersistedStore<AccentMap>("kaczy.accent.v1", {}, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    return Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter(([, v]) => valid(v))) as AccentMap;
  },
  onChange: () => applyToDom(),
});

/** Akcent stylu (0 = własna barwa). */
export function accentFor(skin: Skin, map: AccentMap = store.get()): number {
  return map[skin] ?? 0;
}

function applyToDom() {
  if (typeof document === "undefined") return;
  const n = accentFor(skinStore.get());
  if (n === 0) delete document.documentElement.dataset.accent;
  else document.documentElement.dataset.accent = String(n);
}

applyToDom();
skinStore.subscribe(applyToDom);

export function useAccent(skin: Skin): number {
  return accentFor(skin, store.use());
}

/** Akcenty wszystkich stylów naraz (galeria pokazuje na miniaturze zapamiętany odcień). */
export function useAccentMap(): AccentMap {
  return store.use();
}

export function setAccent(skin: Skin, n: number) {
  if (!valid(n)) return;
  store.set({ ...store.get(), [skin]: n });
}

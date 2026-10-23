import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Funkcje w przygotowaniu (plan rozbudowy 2026-10-23). Duże zmiany wchodzą za
 * flagą, domyślnie wyłączoną, i stają się domyślne dopiero po pełnym e2e.
 * Klucz `kaczy.features.v1` jest w kopii ustawień.
 */
export const FEATURE_IDS = [
  "cmEditor", // Faza 1: edytor CodeMirror 6 z podglądem na żywo
  "relaySync", // Faza 2: przekaźnik synchronizacji E2E
  "graphLocal", // Faza 3: lokalny graf i panel boczny
  "searchIndex", // Faza 4: wyszukiwanie MiniSearch w Workerze
  "bases", // Faza 5: bazy, formuły, zapisane widoki
  "richContent", // Faza 6: matematyka, Mermaid, kolorowanie kodu
  "folderSync", // Faza 7: folder .md na dysku
  "canvas", // Faza 8: kanwa
  "localAi", // Faza 9: lokalne AI (osadzenia w przeglądarce)
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];
export type FeatureFlags = Record<FeatureId, boolean>;

export const FEATURE_DEFAULTS: FeatureFlags = Object.fromEntries(
  FEATURE_IDS.map((id) => [id, false]),
) as FeatureFlags;

/** Czysta walidacja zapisanego obiektu: nieznane klucze odpadają, brakujące dostają domyślne. */
export function cleanFeatureFlags(stored: unknown): FeatureFlags {
  const out: FeatureFlags = { ...FEATURE_DEFAULTS };
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return out;
  for (const id of FEATURE_IDS) {
    const v = (stored as Record<string, unknown>)[id];
    if (typeof v === "boolean") out[id] = v;
  }
  return out;
}

const store = createPersistedStore<FeatureFlags>("kaczy.features.v1", FEATURE_DEFAULTS, {
  merge: (_defaults, stored) => cleanFeatureFlags(stored),
});

export function isFeatureOn(id: FeatureId): boolean {
  return store.get()[id];
}

export function setFeature(id: FeatureId, on: boolean): void {
  store.set({ ...store.get(), [id]: on });
}

export const useFeatureFlags = () => store.use();

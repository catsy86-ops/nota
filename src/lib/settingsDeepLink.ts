/**
 * Link do karty Ustawień: `?settings=<nazwa>` (faza 3c). Otwiera okno na wskazanej karcie, potem parametr
 * znika z adresu (jak `?pair=`). Nazwy po polsku, bez znaków spoza ASCII, żeby dały się wkleić w wiadomości.
 */
export const SETTINGS_PARAM = "settings";

export const SETTINGS_TABS = {
  wyglad: "appearance",
  ogolne: "general",
  kopia: "backup",
  sync: "sync",
} as const;

export type SettingsTab = (typeof SETTINGS_TABS)[keyof typeof SETTINGS_TABS];

/** Karta z wartości parametru; nieznana albo pusta → `null` (okno nie otwiera się na siłę). */
export function settingsTabFromParam(value: string | null): SettingsTab | null {
  if (!value || !Object.prototype.hasOwnProperty.call(SETTINGS_TABS, value)) return null;
  return SETTINGS_TABS[value as keyof typeof SETTINGS_TABS];
}

/** Karta, którą ma otworzyć następne otwarcie Ustawień (np. kropka synchronizacji). Zużywana raz. */
let requestedTab: SettingsTab | null = null;

export function requestSettingsTab(tab: SettingsTab): void {
  requestedTab = tab;
}

export function consumeRequestedSettingsTab(): SettingsTab | null {
  const tab = requestedTab;
  requestedTab = null;
  return tab;
}

/** Sekcja do przewinięcia po otwarciu (paleta poleceń, nowy plan 5.3): dokładny tytuł nagłówka. Zużywana raz. */
let requestedSection: { title: string; expand?: string } | null = null;

/** `expand` — `aria-controls` zwiniętego bloku, w którym leży sekcja (np. „Zaawansowane” w Wyglądzie). */
export function requestSettingsSection(tab: SettingsTab, title: string, expand?: string): void {
  requestedTab = tab;
  requestedSection = { title, expand };
}

export function consumeRequestedSettingsSection(): { title: string; expand?: string } | null {
  const section = requestedSection;
  requestedSection = null;
  return section;
}

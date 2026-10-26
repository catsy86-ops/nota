/**
 * „Co nowego” (U-4, plan Ustawień 4.2). Ręcznie pisane zdania dla użytkownika, nie commity.
 * Nowe wydanie: dopisz wpis na górze i podbij `APP_VERSION`. Dymek pokazuje najwyżej 5 punktów.
 */
export const APP_VERSION = "2026.10.26";

export interface ChangelogEntry {
  version: string;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.10.26",
    items: [
      "Terminy: lista albo kafle, wybór zapamiętany na tym urządzeniu.",
      "Odkładanie: „Za 10 minut”, „Wieczorem”, „Odłóż do…” z datą i „Odłóż wszystkie o godzinę” w jednym dymku.",
      "Terminy serii: „Zakończ serię” w menu terminu; godzina serii wraca po zmianie czasu.",
      "Skrzynka: „Jutro” i „Za tydzień” odkładają notatkę do porządkowania później.",
      "Ustawienia → Wygląd: ukrywanie działów z paska i karty Dziś, które możesz wyłączyć.",
    ],
  },
];

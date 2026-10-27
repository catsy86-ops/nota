// Źródło prawdy skrótów (plan 3.8): ta sama tabela w ShortcutsDialog i w podpowiedziach (`HoverTip`).
import { MOD_KEY } from "@/lib/platform";

export interface ShortcutGroup {
  heading: string;
  items: { keys: string[]; label: string }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    heading: "Ogólne",
    items: [
      { keys: [MOD_KEY, "N"], label: "Nowa notatka" },
      { keys: [MOD_KEY, "K"], label: "Paleta poleceń" },
      { keys: [MOD_KEY, "Z"], label: "Cofnij ostatnią akcję" },
      { keys: ["Alt", "N"], label: "Nowa notatka" },
      { keys: [MOD_KEY, ","], label: "Ustawienia" },
      { keys: ["Alt", "I"], label: "Statystyki" },
      { keys: ["/"], label: "Fokus na wyszukiwarkę" },
      { keys: ["Alt", "S"], label: "Wyszukiwarka (gdy „/” nie działa)" },
      { keys: ["Alt", "T"], label: "Przejdź do „Dziś”" },
      { keys: ["Alt", "W"], label: "Przejdź do „Ten tydzień”" },
      { keys: ["g, n"], label: "Przejdź do „Notatek”" },
      { keys: ["g, d"], label: "Przejdź do „Dziś”" },
      { keys: ["g, w"], label: "Przejdź do „Ten tydzień”" },
      { keys: ["g, p"], label: "Przejdź do „Przypomnień”" },
      { keys: ["g, c"], label: "Przejdź do „Kalendarza”" },
      { keys: ["g, a"], label: "Przejdź do „Archiwum”" },
      { keys: ["g, k"], label: "Przejdź do „Kosza”" },
      { keys: ["g, i"], label: "Przejdź do „Skrzynki”" },
      { keys: ["g, z"], label: "Przejdź do „Grafiku zmian”" },
      { keys: ["g, s"], label: "Przejdź do „Pracy”" },
      { keys: ["g, l"], label: "Przejdź do „Długów”" },
      { keys: ["g, t"], label: "Przejdź do „Ćwiczeń”" },
      { keys: ["Esc"], label: "Zamknij panel / wyczyść zaznaczenie" },
      { keys: ["?"], label: "Pokaż tę listę skrótów" },
    ],
  },
  {
    heading: "Kalendarz (gdy fokus na siatce dni)",
    items: [
      { keys: ["T"], label: "Dziś" },
      { keys: ["N"], label: "Następny miesiąc" },
      { keys: ["P"], label: "Poprzedni miesiąc" },
      { keys: ["C"], label: "Nowy termin na wybrany dzień" },
      { keys: ["Enter"], label: "Nowy termin na wybrany dzień" },
    ],
  },
  {
    // Operatory łączą się ze sobą i ze zwykłym tekstem: „label:praca has:reminder raport”.
    heading: "Wyszukiwanie",
    items: [
      { keys: ["label:praca"], label: "Notatki z etykietą" },
      { keys: ["color:mint"], label: "Notatki w kolorze" },
      { keys: ["has:reminder"], label: "Z przypomnieniem" },
      { keys: ["has:checklist"], label: "Z listą zadań" },
      { keys: ["has:image"], label: "Ze zdjęciem" },
    ],
  },
  {
    heading: "Pisanie notatki",
    items: [
      { keys: [MOD_KEY, "Shift", "L"], label: "Zaznaczone linie na listę zadań" },
      { keys: [MOD_KEY, "B"], label: "Pogrubienie (ponownie: zdejmij)" },
      { keys: [MOD_KEY, "I"], label: "Kursywa (ponownie: zdejmij)" },
      { keys: [MOD_KEY, "K"], label: "Link w treści (zamiast palety poleceń)" },
      { keys: [MOD_KEY, "F"], label: "Znajdź i zamień w treści notatki (też Ctrl+H)" },
      { keys: [MOD_KEY, "Enter"], label: "Zapisz i zamknij edytor" },
      { keys: ["Enter"], label: "Kolejna pozycja listy (pusta kończy listę)" },
      { keys: ["Tab", "Shift", "Tab"], label: "Wcięcie pozycji listy; na liście zadań — podzadanie (Esc, potem Tab wychodzi z pola)" },
      { keys: ["Alt", "↑", "↓"], label: "Przenieś linię (albo pozycję listy zadań)" },
      { keys: ["Shift", "Alt", "↓"], label: "Duplikuj linię" },
      { keys: ["#etykieta"], label: "Dodaj etykietę (też nową)" },
      { keys: ["@folder"], label: "Wybierz folder" },
      { keys: ["!", "!!"], label: "Priorytet średni / wysoki" },
      { keys: ["jutro 9:00"], label: "Przypomnienie z daty na końcu" },
    ],
  },
  {
    heading: "Lista notatek",
    items: [
      { keys: ["←", "→", "↑", "↓"], label: "Nawigacja między notatkami" },
      { keys: ["Home", "End"], label: "Pierwsza / ostatnia notatka" },
      { keys: ["Spacja"], label: "Szybki podgląd" },
      { keys: ["Enter"], label: "Otwórz notatkę" },
      { keys: ["Delete"], label: "Usuń zaznaczoną notatkę" },
      { keys: ["A"], label: "Archiwizuj" },
      { keys: ["P"], label: "Przypnij / odepnij" },
      { keys: ["D"], label: "Duplikuj" },
    ],
  },
  {
    heading: "Szybki podgląd",
    items: [
      { keys: ["↑", "↓", "PgUp", "PgDn"], label: "Przewiń treść" },
      { keys: ["Enter"], label: "Edytuj notatkę" },
      { keys: ["Spacja", "Esc"], label: "Zamknij podgląd" },
    ],
  },
];

/** Skrót dla etykiety z tabeli (np. „Paleta poleceń” → „Ctrl+K”); `undefined`, gdy akcja go nie ma. */
export function shortcutFor(label: string): string | undefined {
  for (const g of SHORTCUT_GROUPS) {
    const hit = g.items.find((i) => i.label === label && i.keys.length > 0);
    if (hit) return hit.keys.join("+");
  }
  return undefined;
}

import type { SettingsTab } from "@/lib/settingsDeepLink";
import { foldName } from "@/lib/study/siteKey";

/**
 * Sekcje Ustawień do palety poleceń (nowy plan 5.3). `title` to dokładny tytuł sekcji
 * (`<Section title=…>` / `<SettingsGroup title=…>`): po otwarciu okno przewija do nagłówka
 * o tym tekście. `words` — inne słowa, którymi ludzie tego szukają. Test
 * `settingsIndex.test.ts` pilnuje, żeby każdy tytuł nadal był w kodzie Ustawień.
 */
export interface SettingsEntry {
  title: string;
  tab: SettingsTab;
  words?: string;
  /** Sekcja w zwiniętym bloku: `aria-controls` przycisku, który trzeba najpierw rozwinąć. */
  expand?: string;
}

const ADV = "wyglad-zaawansowane-tresc";

export const SETTINGS_INDEX: readonly SettingsEntry[] = [
  { title: "Galeria stylów", tab: "appearance", words: "motyw skórka wygląd zeszyt neon hydraulika" },
  { title: "Jasność", tab: "appearance", words: "ciemny jasny tryb nocny motyw" },
  { title: "Akcent", tab: "appearance", words: "kolor barwa" },
  { title: "Rozmiar tekstu", tab: "appearance", words: "czcionka większy mniejszy powiększ" },
  { title: "Tryb budowa: większy tekst i przyciski", tab: "appearance", words: "rękawice duże przyciski" },
  { title: "Krój tekstu", tab: "appearance", expand: ADV, words: "czcionka font inter literata atkinson" },
  { title: "Kształt", tab: "appearance", expand: ADV, words: "zaokrąglenie rogi" },
  { title: "Ramki", tab: "appearance", expand: ADV },
  { title: "Poświata", tab: "appearance", expand: ADV },
  { title: "Tło", tab: "appearance", expand: ADV, words: "kratka ciche gładkie" },
  { title: "Kolory działów", tab: "appearance", expand: ADV },
  { title: "Styl na noc", tab: "appearance", expand: ADV, words: "wieczór automatycznie" },
  { title: "Styl pory roku", tab: "appearance", expand: ADV, words: "sezon zima lato" },
  { title: "Kod wyglądu", tab: "appearance", expand: ADV, words: "udostępnij wygląd import" },
  { title: "Działy na pasku", tab: "appearance", words: "ukryj widoki nawigacja menu" },
  { title: "Dolny pasek", tab: "appearance", words: "telefon nawigacja" },
  { title: "Karty na Dziś", tab: "appearance", words: "dziś pulpit" },
  { title: "Gęstość interfejsu (komputer)", tab: "appearance", words: "zwarty odstępy" },
  { title: "Domyślny układ siatki", tab: "appearance", words: "kafle lista kolumny" },
  { title: "Domyślne sortowanie i grupowanie", tab: "appearance", words: "kolejność notatek" },
  { title: "Ruch i animacje", tab: "appearance", words: "ograniczony ruch animacja" },
  { title: "Efekty i zabawa", tab: "appearance", words: "wibracje konfetti dźwięk" },
  { title: "Praca i Grafik", tab: "general", words: "zmiany hydraulik" },
  { title: "Status powiadomień w przeglądarce", tab: "general", words: "powiadomienia zgoda przypomnienia" },
  { title: "Powiadomienia przy zamkniętej aplikacji", tab: "general", words: "push powiadomienia" },
  { title: "Przegląd tygodnia", tab: "general", words: "niedziela podsumowanie" },
  { title: "Nazwa firmy na protokole PDF", tab: "general", words: "protokół odbioru firma" },
  { title: "Twoje imię w Pracy", tab: "general", words: "podpis nazwisko" },
  { title: "Domyślny kolor nowej notatki", tab: "general" },
  { title: "Prywatne notatki", tab: "general", words: "skarbiec hasło blokada sejf" },
  { title: "Zakładka do zapisu stron", tab: "general", words: "clipper przeglądarka strony" },
  { title: "Dyktowanie głosem", tab: "general", words: "mikrofon mowa" },
  { title: "Funkcje w przygotowaniu", tab: "general", words: "eksperymenty flagi" },
  { title: "Trwałość danych w tej przeglądarce", tab: "backup", words: "pamięć miejsce" },
  { title: "Miejsce zapisu backupu", tab: "backup", words: "kopia zapasowa folder plik" },
  { title: "Miejsce na zdjęcia budów", tab: "backup", words: "pamięć zdjęcia" },
  { title: "Przywracanie z kopii", tab: "backup", words: "backup import odtwórz" },
  { title: "O aplikacji", tab: "backup", words: "wersja aktualizacja build offline" },
  { title: "Diagnostyka", tab: "backup", words: "błędy raport" },
  { title: "Synchronizacja przez plik", tab: "sync", words: "sync plik urządzenia" },
];

const folded = SETTINGS_INDEX.map((e) => ({ e, hay: foldName(`${e.title} ${e.words ?? ""} ustawienia`) }));

/** Sekcje pasujące do zapytania (bez polskich znaków i wielkości liter); każde słowo musi trafić. */
export function searchSettings(query: string, limit = 5): SettingsEntry[] {
  const words = foldName(query).split(/\s+/).filter((w) => w.length > 1);
  if (words.length === 0) return [];
  return folded.filter(({ hay }) => words.every((w) => hay.includes(w))).slice(0, limit).map(({ e }) => e);
}

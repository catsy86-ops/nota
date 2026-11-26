/**
 * Treść okna „O aplikacji”: co wyróżnia aplikację i spis funkcji działami. Tylko funkcje, które są w kodzie
 * (źródło: `opis.md` i `docs/opis/`) — przy nowej funkcji dopisz ją tutaj w jej dziale.
 */

export const AUTHOR_LINE = "Made by Grzegorz K.";

export interface Highlight {
  /** Nazwa ikony z `ICONS` w `AboutDialog.tsx`. */
  icon: "offline" | "lock" | "sync" | "tools" | "shifts" | "backup" | "links" | "style";
  title: string;
  text: string;
}

/** Co odróżnia aplikację od typowych notatników i organizerów ze sklepu albo z internetu. */
export const HIGHLIGHTS: Highlight[] = [
  {
    icon: "offline",
    title: "Działa bez internetu i bez konta",
    text: "Wszystko zapisuje się na Twoim urządzeniu. Nie trzeba się rejestrować ani logować, a brak zasięgu na budowie czy w piwnicy niczego nie blokuje.",
  },
  {
    icon: "sync",
    title: "Synchronizacja bez cudzej chmury",
    text: "Telefon i komputer łączą się ze sobą bezpośrednio albo przez przekaźnik szyfrowany od końca do końca — przekaźnik nie widzi treści. Zmiany z dwóch urządzeń scalają się same, bez konfliktów.",
  },
  {
    icon: "lock",
    title: "Skarbiec na notatki prywatne",
    text: "Notatki prywatne są szyfrowane Twoim hasłem, z odblokowaniem odciskiem palca lub twarzą i kodem awaryjnym do wydruku. Nawet w kopii zapasowej zostają zaszyfrowane.",
  },
  {
    icon: "tools",
    title: "Praca instalatora w jednym miejscu",
    text: "Dziennik budowy, braki dyktowane głosem także bez internetu, protokół odbioru z podpisem klienta, wyceny, faktury KSeF z kodem QR i analizator planów hydraulicznych z zestawieniem materiałów.",
  },
  {
    icon: "shifts",
    title: "Grafik zmian, który liczy",
    text: "Grafik z cyklami i szablonami, polskie święta, nadgodziny, dodatek nocny, okres rozliczeniowy i niepełny etat — zamiast osobnej aplikacji i arkusza.",
  },
  {
    icon: "backup",
    title: "Dane, które nie giną",
    text: "Codzienne kopie zapasowe na urządzeniu, kopia przed każdym przywróceniem, podgląd zakresu przed wczytaniem i zgodność ze starszymi wersjami aplikacji.",
  },
  {
    icon: "links",
    title: "Sieć wiedzy jak w programach dla zaawansowanych",
    text: "Linki [[między notatkami]], aliasy, osadzanie notatek i bloków, lokalny graf, notatki tygodnia i miesiąca, wzory matematyczne i diagramy.",
  },
  {
    icon: "style",
    title: "Wygląd po Twojemu",
    text: "Dziesięć stylów, każdy w wersji jasnej i ciemnej, czarne tło OLED, motyw pory roku, przejście na ciemny styl o zachodzie słońca i wiele krojów pisma. Po polsku od pierwszego dnia, z dbałością o dostępność.",
  },
];

export interface FeatureGroup {
  title: string;
  items: string[];
}

/** Wszystkie funkcje, działami — w kolejności z paska bocznego. */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Notatki",
    items: [
      "Edytor Markdown z podglądem na żywo, listy zadań z podzadaniami, kolorowanie kodu, wzory matematyczne i diagramy Mermaid",
      "Linki [[…]] z aliasami, osadzanie notatek i bloków ^id, lokalny graf i boczny panel powiązań, podgląd notatki „Obok”",
      "Notatki tygodnia i miesiąca, wyodrębnianie zaznaczenia do nowej notatki, szablony ze zmiennymi",
      "Etykiety zagnieżdżone, foldery, przypięcia, archiwum i kosz z „Cofnij”",
      "Właściwości notatek (własne pola), widoki: kafle, lista, tablica, tabela i galeria; zapisane widoki i zapytania osadzone w notatce",
      "Szybkie wyszukiwanie z filtrami (np. pole>5, ścieżka:, ma:prywatne), także bez polskich znaków",
      "Oś czasu i porównanie wersji notatki, podpowiedź duplikatu, spis treści",
      "Zdjęcia z opisem, podgląd PDF, pliki przeciągnięte na edytor, notatka głosowa",
      "Import z innych aplikacji (także ZIP) ze sprawdzeniem przed zapisem i „Cofnij ostatni import”",
    ],
  },
  {
    title: "Dziś i Skrzynka",
    items: [
      "Ekran dnia: zmiana z grafiku, zaległe i dzisiejsze terminy, należności, powtórki, notatka dnia i podgląd jutra",
      "Karty do wyboru na każdym urządzeniu",
      "Skrzynka do szybkiego zapisu myśli — także dyktowaniem — z trybem porządkowania i „Odłóż”",
    ],
  },
  {
    title: "Terminy i przypomnienia",
    items: [
      "Przypomnienia jednorazowe i serie (co dzień, tydzień, miesiąc, względem grafiku), z datą końca",
      "Wcześniejsze przypomnienie, „Odłóż” i „Odłóż do…”, zakończenie serii, dymek zbiorczy",
      "„Przegapione” i prognoza serii na najbliższe 7 dni",
      "Termin wyłapany z treści notatki jako podpowiedź",
      "Powiadomienia push z przyciskami akcji; w aplikacji na Androida — alarmy telefonu",
    ],
  },
  {
    title: "Kalendarz",
    items: [
      "Miesiąc, dzień i oś godzin; agenda miesiąca na telefonie",
      "Przeciąganie terminów, zmiany z grafiku w siatce, polskie święta",
      "Wydruk i eksport do .ics",
    ],
  },
  {
    title: "Grafik",
    items: [
      "Wiele grafików, rodzaje zmian, cykle i szablony tygodnia, malowanie pędzlem",
      "Rozliczenie godzin: nadgodziny, dodatek nocny i za 100%, okres rozliczeniowy, niepełny etat",
      "Cofnij i ponów, eksport i udostępnianie grafiku",
    ],
  },
  {
    title: "Praca",
    items: [
      "Dziennik budowy: wpisy ze zdjęciami (też z galerii z godziną zrobienia), problemy i usterki ze statusem, etapy, plan na dziś",
      "Braki materiału dyktowane głosem — także bez internetu — i jedna lista do hurtowni",
      "Materiał: katalog rur i kształtek, zestawy, zużycie, materiał w aucie, punkty w pomieszczeniach",
      "Protokół odbioru i potwierdzenie wykonania jako PDF z podpisem klienta, raport dnia i tygodnia",
      "Klienci, wyceny jako dokument, cenniki, zaliczki i przypomnienia po wycenie; zlecenia własne (fuchy)",
      "Faktury KSeF z kodem QR, korekty i zaszyfrowany eksport faktur",
      "Analizator planów hydraulicznych: skala, trasy, rozpoznawanie opisów (OCR), symbole i zestawienie materiałów do CSV",
      "Kilometrówka, czas na budowie, paczka budowy dla pomocnika, kalkulatory",
      "Nauka do egzaminu: quiz, powtórki, egzamin próbny, własne pytania",
    ],
  },
  {
    title: "Ćwiczenia",
    items: [
      "Dziennik treningu: serie, ciężar, serie na czas, własne ćwiczenia, plany dni i prowadzony trening z przerwą",
      "Podpowiedź progresji, zapas po serii, rozgrzewka, tydzień lżej, rekordy i szacowany 1RM",
      "Dieta: kalorie i białko, ulubione posiłki, powtórz wczoraj, średnia z 7 dni, cel białka z masy ciała",
      "Odżywki z przypomnieniami, masa ciała z wykresem, eksport CSV i podsumowanie miesiąca",
    ],
  },
  {
    title: "Długi",
    items: [
      "Pożyczki w obie strony, spłaty, raty i terminy zwrotu z przypomnieniem",
      "Zdjęcie dowodu, ukrywanie kwot, historia z saldem po każdym wpisie",
      "Wiadomość z rozliczeniem albo grzeczne przypomnienie, z numerem konta i BLIK-iem; PDF i CSV",
    ],
  },
  {
    title: "Skarbiec",
    items: [
      "Notatki prywatne szyfrowane hasłem, blokada po czasie i po schowaniu karty",
      "Odblokowanie biometrią, kod awaryjny do wydruku, szyfrogram do pobrania",
    ],
  },
  {
    title: "Dane i synchronizacja",
    items: [
      "Parowanie urządzeń kodem lub skanem, synchronizacja bezpośrednia albo przez szyfrowany przekaźnik",
      "Pełna kopia JSON, codzienne kopie na urządzeniu, zapis kopii do wybranego pliku, „Wyślij kopię”",
      "Przywracanie z podglądem i kopią „przed przywróceniem”, ostrzeżenia przed uszkodzonymi danymi",
    ],
  },
  {
    title: "Wygląd i wygoda",
    items: [
      "Dziesięć stylów (m.in. Zeszyt, Tablica, Neon, Hydraulika, Matryca), każdy w wersji jasnej i ciemnej",
      "Zestawy wyglądu jednym stuknięciem, własny motyw, kod wyglądu do udostępnienia",
      "Paleta poleceń, skróty klawiszowe, tryb skupienia, statystyki, ukrywanie działów",
      "Aplikacja do zainstalowania (PWA) i aplikacja na Androida, widżet i skrzynka na ikonie",
    ],
  },
];

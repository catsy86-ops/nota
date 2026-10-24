# Plan: ulepszenie i dopracowanie działu Praca (2026-10-22)

> **Zastąpiony przez [`plan-praca-2026-10-24.md`](plan-praca-2026-10-24.md)** — Faza 3 i nierozliczone punkty przeniesione tam.

Źródło: trzy audyty tylko do odczytu (funkcje i UX; dostępność i telefon 390 px; model danych i ryzyka).
Punkty oznaczone **[zweryfikowane]** sprawdziłem w kodzie. Pozostałe to ustalenia agentów z numerami linii, które wymagają potwierdzenia przy wdrażaniu.

Legenda: W = wartość dla użytkownika (wysoka/średnia/niska), N = nakład (S/M/L).

## Faza 0: błędy do natychmiastowej naprawy

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 0.1 | Dyktowanie braków zamieniało „s” na spację. **Naprawione** (`da3e1e5`), test w `shortages.test.ts`. [zweryfikowane] | `lib/study/shortages.ts` | wys. | S |
| 0.2 | „Do notatki” tworzy nową notatkę przy każdym stuknięciu, bez sprawdzenia istniejącej. | `StudyBoard.tsx:147-150`, `lib/study/toNote.ts:6` | wys. | S |
| 0.3 | Przekroczenie 40 braków: nowe pozycje cicho znikają ze stanu, raportu i przypomnień; toast w arkuszu wpisu wymienia wszystkie, jakby zostały dodane. | `shortages.ts:68`, `siteItems.ts:129`, `JournalEntrySheet.tsx:245-246` | wys. | S/M |
| 0.4 | Przypomnienie „montaż bez protokołu próby” ma tylko filtr, bez akcji „Dodaj próbę”. | `StudyJournal.tsx:466, 476, 185` | wys. | S/M |
| 0.5 | Nowe pole wpisu jest kasowane przez starszą wersję aplikacji edytującą wpis. | `yStudy.ts:356` | wys. (przy mieszanych wersjach) | M |

## Faza 1: dostępność i dotyk (telefon 390 px)

| # | Co | Gdzie | N |
|---|----|-------|---|
| 1.1 | Po zmianie statusu i po „Usuń brak” fokus ląduje na `body`; brak komunikatu dla czytnika. | `SiteShortagesPanel.tsx:128-141, 179-186` | S |
| 1.2 | Przesunięcie tematu strzałką odmontowuje przycisk; fokus ginie. | `StudyBoard.tsx:64-83` | S |
| 1.3 | Arkusz wpisu wyłącza autofocus; fokus zostaje poza arkuszem. | `JournalEntrySheet.tsx:467` | S |
| 1.4 | Przycisk usuwania dokumentu 36 px na dotyku (wymagane 44). | `SiteDocsPanel.tsx:90` | S |
| 1.5 | Przycisk „Usuń lokalizację wpisu” ok. 34 px. | `JournalEntrySheet.tsx:509` | S |
| 1.6 | Grupa `radiogroup` bez strzałek i roving tabindex. | `EntryCheck.tsx:88-103` | S |
| 1.7 | Ikony poprawna/błędna w quizie bez `role="img"`. | `QuizPanel.tsx:250` | S |
| 1.8 | Zdjęcia wpisu mają ten sam alt „Zdjęcie z budowy”. | `JournalEntrySheet.tsx:769` | S |
| 1.9 | Brak testów dotyku i fokusu na `/praca` (touch-targets nie obejmuje Praca; axe tylko z pierwszej zakładki na telefonie). | `e2e/touch-targets.spec.ts`, `e2e/a11y.spec.ts` | M |

## Faza 2: dane i testy (przed większymi zmianami)

1. Testy charakteryzujące: >40 braków w `composeSiteLists`, listy w polach karty, `writeEntry` z nieznanym polem, `replaceAll`. Bez zmiany kodu.
2. Widoczność limitów: `cleanShortages` i `cleanDump` zwracają liczbę odrzuconych; toast pokazuje prawdziwy wynik (0.3).
3. Zgodność wpisu: `writeEntry` nie kasuje kluczy, których nie zna (0.5).
4. Refaktor `JournalEntrySheet.tsx` (906 linii): najpierw czyste funkcje (parsowanie, walidacja), potem podkomponenty. Nie ruszać granicy lazy.
5. `store.ts`: helper `findSite(id)` zamiast pięciu kopii `siteDirectory(...).find`.

## Faza 3: funkcje

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 3.1 | Przypięty etap (`entry.stage`) na osi i w raporcie. | `StudyJournal.tsx:504-539`, `report.ts` | wys. | M |
| 3.2 | Braki i zamówienia: pozycje z listy braków trafiają do „Do zamówienia”; „Oznacz jako zamówione” zmienia status braków; dodać „Cofnij”. | `SiteOrderPanel.tsx:18, 39-43` | śr. | M |
| 3.3 | Nagrania w raporcie i paczce ZIP (dziś tylko na osi). | `report.ts`, `siteZip.ts` | śr. | M |
| 3.4 | Quiz: „10 z N” zamiast samego „Na dziś: N”; komunikat dla nowego użytkownika. | `QuizPanel.tsx:58, 165, 189, 192-194` | śr. | S |
| 3.5 | Jedna nazwa działu: „Praca” / „Instalacje wod-kan” / „Dziennik” się mieszają. | `StudyView.tsx:193, 220`, `StudyJournal.tsx:144` | śr. | S |
| 3.6 | Etykiety liczników na tablicy („budowa 2×, problemów 1”) i wpisu („Wpis”). | `StudyBoard.tsx:89, 134` | śr. | S |
| 3.7 | Dwa sterowania tego samego filtra „Otwarte” (chip i przycisk). | `StudyJournal.tsx:48, 149-162` | niska | S |
| 3.8 | Konfiguracja odbiorców WhatsApp tylko w oknie raportu; dodać do karty budowy. | `JournalReport.tsx:281, 318-390` | śr. | S/M |

## Faza 4: model danych (decyzja produktowa)

- **Karta budowy to LWW całego obiektu.** Adres edytowany na jednym telefonie i „zamówione” na drugim: jedna zmiana przepada. `yStudy.ts:564`, `store.ts:401, 426`. Naprawa wymaga pól per klucz i migracji; to zmiana formatu w Yjs.
- **Pola-tablice wpisu** (`checked`, `images`, `fittings`) są wartościami atomowymi. Odhaczenie różnych punktów na dwóch telefonach: jedno przepada. `yStudy.ts:349-361`.
- **`replaceAll` kasuje klucze u peerów.** Przywrócenie starej kopii na jednym telefonie usuwa dane z drugiego. `yStudy.ts:609-612`, `exportNotes.ts:356`.
- Wersjonowanie `StudyDump` (`version: 1` na sztywno) bez ścieżki migracji. `yStudy.ts:121, 233`.

Faza 4 zaczyna się dopiero po decyzji o zakresie. Nie wpisywać jej w inne fazy.

## Ograniczenia, które trzeba pilnować

- **Budżet paczki startowej:** 411 136 B przy progu 402 KB, zapas ok. 512 B. Każdy nowy eager import z Praca zerwie `e2e/bundle.spec.ts`. Komponenty Praca dodawać leniwie. Podnoszenie progu tylko decyzją właściciela.
- Zmiany nie mogą łamać starszych wersji bez migracji (Faza 0.5 i Faza 4).
- Dyktowanie (Praca i Skrzynka) nie jest testowane na prawdziwym mikrofonie; przed wydaniem test ręczny na iPhonie i Androidzie.

## Kolejność proponowana

1. Faza 0 (0.2, 0.3, 0.4) i Faza 1 (1.1-1.5) — małe, widoczne poprawki.
2. Faza 2 — testy charakteryzujące i limity, zanim ruszy się model.
3. Faza 3 (3.4, 3.5, 3.6, 3.1, 3.2) — funkcje po ustabilizowaniu danych.
4. Faza 4 — dopiero po decyzji właściciela.

## Status (2026-10-22)

- **Faza 0 — zrobiona:** 0.1 (`da3e1e5`), 0.2 (`e438cfb`), 0.3 (`c5ce722`), 0.4 (`3e29369`), 0.5 (`9020901`).
- **Faza 1 — zrobiona:** 1.1 (`601f0f1`), 1.2 (`02e026f`), 1.3 (`d71c400`), 1.4–1.5 (`89ada1d`), 1.6–1.7 (`86e0144`, poprawka `450a905`), 1.8–1.9 (`68f6a79`).
- **Nie zrobione z Fali 1:** brak. Fokus po akcjach w listach (1.1, 1.2) sprawdzony e2e; pozostałe elementy wg audytu nie mają e2e na rozmiar (np. przycisk lokalizacji).
- **Następnie:** Faza 2 (testy charakteryzujące i limity), potem 3.
- **Faza 2 — w toku (2026-10-22):** 2.1 charakteryzacja limitu braków (`a6a0446`); 2.2 liczba odrzuconych i komunikat przy pełnej liście (`a6a0446`), **nie** pokazano jeszcze pozycji od innych urządzeń; 2.3 replaceAll pokryty istniejącym testem; 2.4 częściowo (`e058881`, braki z wypowiedzi wydzielone), reszta `JournalEntrySheet` do zrobienia; 2.5 findSite (`e058881`).

## Stan na koniec dnia (2026-10-22)

- Faza 2: 2.1, 2.3, 2.5 zrobione; 2.2 licznik ukrytych braków w panelu zrobiony (`1f2ae48`) — decyzja, czy zostawiać najstarsze czy najnowsze 40, czeka na właściciela; 2.4 reguły arkusza wpisu wydzielone (`9be57d0`), `JournalEntrySheet` nadal ~900 linii do dalszego podziału.
- Następny krok: dokończyć podział `JournalEntrySheet` (dyktowanie, zdjęcia, szkice) osobnymi commitami; potem Faza 3.

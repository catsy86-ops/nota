# Plan: rozbudowa, dopracowanie i ulepszenie działu „Praca” (2026-10-24)

## Kontekst

Dział Praca (`/praca`: Nauka + Dziennik budowy) ma dwa starsze plany: `docs/plan-praca-2026-10-22.md` i `docs/plan-dzialy-2026-10-22.md` §8–9. Zrobione są Fazy 0–1, większość Fazy 2 i część Fal 1–5. Od `9be57d0` (2026-10-22) w `src/components/study` i `src/lib/study` nie było żadnej zmiany. Dwa przeglądy (24.10) zrobiły dwie rzeczy:
- sprawdziły w kodzie, co z tamtych planów zostało,
- przejrzały dział od nowa pod kątem codziennej pracy hydraulika na telefonie.

Ten plan zbiera całość w jedną listę: od błędów, przez codzienną pętlę na budowie i powiązania z resztą aplikacji, po wygląd, Naukę i porządki w kodzie.

**Pierwszy krok wdrożenia:** zapisać ten plan jako `docs/plan-praca-2026-10-24.md`. W starym `plan-praca-2026-10-22.md` dopisać odnośnik „zastąpiony przez”. Plan zastępuje Fazę 3 tamtego pliku i §8–9 z `plan-dzialy`.

**Stan początkowy:** w drzewie leżą niezacommitowane zmiany Fazy 4 wyszukiwania (`CommandPalette.tsx`, `sectionHits.ts`, `opis.md`). Trzeba je zamknąć osobnym commitem, zanim ruszy Praca.

**Ograniczenia:**
- **Paczka startowa:** próg 500 KB, obecnie ok. 413 KB. Komponenty Praca mają być ładowane leniwie, a do startu trafia tylko `yStudy.ts`. Pilnuje tego `e2e/bundle.spec.ts`.
- **Zgodność danych:** bez zmian formatu Yjs, chyba że w Etapie 6.
- **Kolejność pracy w każdym punkcie:** test → kod → `opis.md` → commit.

Legenda: W = wartość dla użytkownika, N = nakład (S/M/L).

---

## Etap 0: błędy (najpierw, małe)

| # | Co | Gdzie | N |
|---|----|-------|---|
| 0.1 | Raport zaniża godziny: dni bez wpisu, ale ze zmianą w Grafiku lub z godzinami budowy, w ogóle nie trafiają do raportu. | `lib/study/report.ts:179-215` | M |
| 0.2 | „Montaż bez protokołu próby” wisi dalej przy budowie z archiwum i przy odhaczonym etapie „Próba” lub „Zakrycie”. Pętla `no-test` nie patrzy na karty budów. [zweryfikowane] | `lib/study/reminders.ts:50-62` | S |
| 0.3 | Wpis z samym zdjęciem lub nagraniem ma w raporcie, w WhatsAppie i w wydruku podpis „Sprawdzone punkty listy”. Fallback ma być taki sam jak na osi. | `report.ts:229`, `JournalReport.tsx:466` vs `StudyJournal.tsx:514` | S |
| 0.4 | Po „Wchodzę” następny „+ Wpis” podpowiada wczoraj używaną budowę. `enter()` nie wywołuje `setSite`. [zweryfikowane] | `EntryCheck.tsx:207-213` | S |
| 0.5 | „7 dni: N wpisów” nie odświeża się po północy: w `useMemo` brakuje `dayTick`. [zweryfikowane] | `StudyJournal.tsx:129-133` | S |
| 0.6 | `revokeObjectURL` jest wywoływane od razu po `click()`, przez co pobieranie może się urwać. Przenieść do wspólnego helpera z opóźnieniem. | `StudyStats.tsx:218`, `siteZip.ts:79` | S |

Każdy z punktów 0.1–0.3 dostaje test czystej funkcji (`report.test.ts`, nowy `reminders.test.ts` albo istniejący test przypomnień).

## Etap 1: codzienna pętla na budowie (największa wartość)

Pętla: wejście → wpis → braki i zamówienie → godziny → raport.

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | „+ Wpis” bierze budowę z kontekstu: z filtra dziennika, a w karcie budowy z nowego przycisku „+ Wpis tutaj”. | `StudyJournal.tsx:171`, `SiteCardDialog.tsx:329-368`, `draft.ts` | wys. | S |
| 1.2 | Karta „Przed wejściem” dostaje szybkie akcje Nawiguj / Zadzwoń / + Wpis (użyć tych z karty budowy). Wybrana budowa (`picked`) ma przetrwać przejście na inny widok (sessionStorage). | `EntryCheck.tsx:64-140` | wys. | S |
| 1.3 | Karta budowy: formularz danych zwinięty za „Edytuj dane”. Na górze etapy, braki i zamówienie z licznikami. (= §9 W1) | `SiteCardDialog.tsx:217-327` | wys. | S/M |
| 1.4 | Suma godzin na karcie budowy: łącznie i w bieżącym miesiącu. Nowa czysta funkcja `siteMinutesInRange` w `siteHours.ts` (sumuje `siteMinutesOn`). | `siteHours.ts`, `SiteCardDialog.tsx:188-195` | wys. | M |
| 1.5 | Okno „Godziny na budowach” dostępne zawsze: z nagłówka każdego dnia oraz z karty budowy, także dla budowy bez wpisu w danym dniu. | `StudyJournal.tsx:119-127`, `siteHours.ts:83-94`, `DayHoursDialog.tsx` | wys. | M |
| 1.6 | „Wychodzę” obok „Wchodzę”. Para `CheckRecord.at` / `leftAt` podpowiada godziny budowy w 1.5. To tylko podpowiedź, ręczna wartość wygrywa. Nowe pole jest opcjonalne, więc stare wersje je pomijają (zapis bez kasowania nieznanych kluczy działa od `9020901`). | `lib/study/entryCheck.ts:21-29,148`, `entryCheckStore.ts` | wys. | M |
| 1.7 | Braki → hurtownia: WhatsApp do `supplierPhone` z listą braków i fittingów. „Oznacz jako zamówione” zmienia też status braków, a w toaście jest „Cofnij”. (= 3.2) | `SiteShortagesPanel.tsx:208`, `SiteOrderPanel.tsx`, `order.ts:40`, `store.ts:435` `markSiteOrdered` | wys. | M |
| 1.8 | Raport: dodać preset „Poprzedni miesiąc”. | `JournalReport.tsx:35-48` | śr. | S |
| 1.9 | Przypięty etap wpisu (`entry.stage`) jako pigułka na osi i w raporcie. (= 3.1, §9 D2) | `StudyJournal.tsx` `JournalItem`, `report.ts` | śr. | M |
| 1.10 | Nagrania w raporcie (liczba i czas) i w paczce ZIP. (= 3.3) | `report.ts`, `siteZip.ts` | śr. | M |
| 1.12 | Limit 40 braków zostawia **najnowsze** 40 (decyzja z 24.10). Najpierw odpadają dostarczone, potem najstarsze. Licznik ukrytych zostaje. Do zrobienia: zmienić `cleanShortages` (`shortages.ts`) i `droppedShortages` (`store.ts`), poprawić testy charakteryzujące z `a6a0446` i komunikat w arkuszu. Pułapka do sprawdzenia: starsza wersja aplikacji przycina odwrotnie. Trzeba potwierdzić, że przycinanie dzieje się tylko przy odczycie i nie kasuje kluczy w Yjs. | `lib/study/shortages.ts:68`, `siteItems.ts:129`, `store.ts` | śr. | S/M |
| 1.11 | Odbiorcy WhatsApp (szef, grupa) do ustawienia także w karcie budowy. `RecipientsForm` wydzielić z `JournalReport`. (= 3.8) | `JournalReport.tsx:80-141`, `SiteCardDialog.tsx` | śr. | S/M |

## Etap 2: powiązania z resztą aplikacji

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 2.1 | Link prosto do karty budowy: `/praca?budowa=<id>`. Ma działać z wierszy Dziś (`siteId` już tam jest) i z push (serwis, dostawa, problem). Odczyt parametrów URL wydzielić do jednego helpera, bo dziś ten sam kod jest 3 razy w `StudyView.tsx:146-184`. | `StudyDueRows.tsx:35`, `lib/push/schedule.ts:203,214,236`, `lib/viewRoute.ts` | wys. | M |
| 2.2 | „Dostawa dziś: X” jako wiersz na Dziś i jako push w dniu dostawy, nie dopiero po spóźnieniu. | `lib/study/dueRows.ts`, `schedule.ts:222-239`, `calendarMarks.ts:37` | śr. | S |
| 2.3 | Wieczorne przypomnienie, gdy dzień ma zmianę w Grafiku, a nie ma wpisu w dzienniku albo nie ma podziału godzin. (= §9 R4) | `schedule.ts:153-191` | śr. | S |
| 2.4 | Karta „Dzisiejsza budowa” na Dziś (ostatnia albo ta, na którą wszedłeś): + Wpis, Nawiguj, Zadzwoń. Ładowana leniwie. | `pages/Index.tsx`, `components/review/` | śr. | S/M |
| 2.5 | Paleta poleceń: wyszukiwanie budów i wpisów, akcje „Nowy wpis”, „Raport dnia”, „Karta budowy X”. Wpiąć w istniejące `sectionHits.ts`. | `CommandPalette.tsx`, `lib/sectionHits.ts` | śr. | M |
| 2.6 | Miesięczne zestawienie godzin na budowach (CSV) z kosztem robocizny (godziny × `hourlyRate` z Grafiku). (= §9 R3) | `lib/shifts/timesheet.ts:21`, `shifts/model.ts:123`, `siteHours.ts` | śr. | M |

## Etap 3: dopracowanie, wygląd i dostępność

- **Nazwy i etykiety:**
  - jedna nazwa działu zamiast mieszanki „Instalacje wod-kan” i „Dziennik”: `StudyView.tsx:193,220`, `StudyJournal.tsx:144` (3.5),
  - czytelne liczniki na tablicy, a przycisk z „Wpis” na „Wpis z budowy”: `StudyBoard.tsx:92,137` (3.6),
  - jedno sterowanie filtrem „Otwarte” zamiast dwóch: `StudyJournal.tsx:47,149-163` (3.7).
- **Tryb budowa:** przyciski w `components/study` dostają `tap-target` / `IconButton`. Link „Mapa” ma mieć 44 px. Zamienić `text-warning` na `text-warning-ink` (`JournalEntrySheet.tsx:45`). (§9 P6–P7)
- **Oś czasu:**
  - pieczątka „OTWARTY” przy nierozwiązanym problemie,
  - różne ikony dla rodzajów przypomnień: `StudyJournal.tsx:476`,
  - podświetlenie świeżo dodanego wpisu.
  - (§9 W3, W5)
- **Arkusz wpisu:** pigułki „+ Próba / + Kształtki / + Temat / Etap” zamiast długiego formularza. Komunikat przy pustym wpisie ma wymieniać nagranie, próbę, kształtki i etap. (§9 W2, D5)
- **Szukanie w dzienniku** obejmuje kształtki i próbę szczelności: `journalView.ts:76` (§9 D1).
- **Galeria:**
  - przesuwanie palcem i powiększanie gestem,
  - numer zdjęcia w etykiecie miniatury: `StudyJournal.tsx:589`,
  - czarne tło.
  - (§9 D3)
- **Quiz:**
  - „10 z N na dziś” i komunikat dla nowego użytkownika: `QuizPanel.tsx:165,189` (3.4),
  - pasek postępu z kratek,
  - obwódka kratek dni nauki: `StudyStats.tsx:117`,
  - „Ćwicz” jako główna akcja na karcie tematu przy 390 px.
  - (§8 W1–W3)
- Przed zmianami wizualnymi wczytać skill `frontend-design` (zasada z pamięci projektu).

## Etap 4: Nauka

**Poprawa:**
- „Przerwij rundę” w quizie (§8 P3),
- objaśnienie odpowiedzi nie chowa się pod przyklejonym „Dalej” (§8 P4),
- edycja własnego pytania z zachowaniem historii powtórek, bo dziś zostaje tylko usunięcie (§8 P6),
- jedna ściąga wysokości zamiast dwóch: `StudyChecklist.tsx:96-122` i `HeightsSheet.tsx` (§8 P7).

**Dopracowanie:**
- z ekranu wyniku i ze statystyk prosto do „Ćwicz” (§8 D1),
- temat z ≤ 2 pytaniami podpowiada „Dodaj własne” (§8 D2),
- szkielet zamiast `null` podczas wczytywania Yjs: `StudyView.tsx:130` (§8 D3),
- zapamiętana kolumna tablicy na telefonie i `useMemo` w tablicy (§8 D4).

**Rozbudowa:**
- 4.1 Tablica sama podpowiada „Umiem”, gdy temat ma wysoką skuteczność albo długi odstęp powtórek (`stats.accuracyByTopic`, `StudyBoard.tsx:31`). N: S.
- 4.2 „Problem z budowy → pytanie”: z rozwiązanego problemu powstaje własne pytanie. N: M. (§8 R1)
- 4.3 Własne tematy: dziś nieznany temat jest cicho odrzucany (`store.ts:48`). Potrzebna mapa tematów w `studyCustom`. N: M.
- 4.4 Pytania liczbowe z kalkulatorów (spadek, 1,5× ciśnienie próby, pojemność). N: M.
- 4.5 Szukanie w materiale bez polskich znaków (§8 R2). N: M.
- 4.6 Więcej pytań wbudowanych (dziś 29 na 18 tematów). N: L. Wymaga źródeł od właściciela.

## Etap 5: kod, wydajność, testy

Etap 5 iść równolegle albo przed Etapem 1, jeśli ruszamy arkusz wpisu.

- 5.1 **Pisanie w arkuszu nie przerysowuje osi:**
  - `StudyJournal` nie subskrybuje całego `useJournalDraft()` (wystarczy selektor „czy jest szkic”),
  - `JournalItem` w `memo` i wydzielony do osobnego pliku,
  - `useStudyLists()` raz na listę, nie raz na wpis,
  - „Pokaż starsze” porcjami (§9 D4).
- 5.2 Pole budowy w arkuszu zapisuje do Yjs przy zatwierdzeniu (blur lub wybór), nie przy każdym klawiszu: `JournalEntrySheet.tsx:490`.
- 5.3 Wspólny hook `useSiteDirectory()` zamiast kilku wywołań `siteDirectory()` (4× w arkuszu, do tego dziennik, karta, wejście).
- 5.4 **Usunięcie duplikatów:**
  - share → schowek: `JournalReport.tsx:117-175` i `SiteCardDialog.tsx:124-137`,
  - `topicTitle` zdefiniowany w 4 plikach,
  - toast „brak miejsca” powtórzony 3× w arkuszu,
  - martwa gałąź w `ReminderRow` (`StudyJournal.tsx:483`).
- 5.5 **Podział dużych plików** (punkt 2.4 starego planu):
  - z `JournalEntrySheet.tsx` (955 linii): pasek zdjęć, podpisy i szkice, dyktowanie,
  - z `StudyJournal.tsx`: `JournalItem` i galeria,
  - z `JournalReport.tsx`: `ReportPaper` i `RecipientsForm`.
  - Każdy podział osobnym commitem, bez zmiany granicy lazy.
- 5.6 **Testy jednostkowe dla `lib/study` bez testów:** `sites`, `draft`, `entrySheet`, `reportLink`, `siteKey`, `toNote`, `entryCheckStore`, `images`.

## Etap 6: odłożone (decyzja 24.10: model danych później, osobnym planem)

- **Model danych (stara Faza 4):**
  - karta budowy jest zapisywana jako cały obiekt i wygrywa ostatni zapis (`yStudy.ts:575`, `store.ts:416`),
  - pola-tablice wpisu (`checked`, `images`, `fittings`) są atomowe,
  - `replaceAll` kasuje dane u drugiego urządzenia,
  - `StudyDump` ma na sztywno `version: 1`.
  - Każda z tych zmian to zmiana formatu w Yjs z migracją. Plan robi ją dopiero po decyzji o zakresie.
- **Import własnych materiałów do Nauki** (`roadmap.md:33`).

## Kolejność proponowana

1. Commit bieżących zmian wyszukiwania, potem zapis tego planu do `docs/`.
2. Etap 0 (6 małych poprawek z testami).
3. 5.1–5.3 (wydajność arkusza i osi) przed dotykaniem arkusza w Etapie 1.
4. Etap 1 (decyzja 24.10: Dziennik budowy przed Nauką): 1.1, 1.2, 1.3, 1.8, 1.12, potem 1.4–1.6 (godziny), 1.7, 1.9–1.11.
5. Etap 2: 2.1 (deep link), 2.2, 2.3, potem 2.4–2.6.
6. Etap 3 i Etap 4 (poprawa + dopracowanie), potem rozbudowa Nauki.
7. 5.4–5.6 na bieżąco przy dotykanych plikach.
8. Etap 6 po decyzjach. Ręczne QA na telefonie (dyktowanie, nagrania, „Tu jestem”, push) na końcu.

## Weryfikacja

- Po każdym punkcie: `npm run test` (Vitest, testy jednostkowe nowych czystych funkcji) i `npx tsc --noEmit`.
- Po każdym etapie:
  - `npm run build` i `e2e/bundle.spec.ts` (paczka startowa ≤ 500 KB, `content.ts` i pola karty poza startem),
  - e2e Praca (`e2e/site-*.spec.ts`, `journal-*.spec.ts`, `touch-targets.spec.ts`, `a11y.spec.ts`) i rozszerzenie touch-targets o nowe przyciski.
- Zmiany widoczne: sprawdzić w przeglądarce (Playwright MCP) przy 390 px i na szerokim ekranie, w skórkach Zeszyt, Matryca i Hydraulika, jasnej i ciemnej.
- Po każdym zadaniu: wpis w `opis.md` (sekcja Praca, aktualizacja istniejących opisów) i status w `docs/plan-praca-2026-10-24.md`.

## Status

- 2026-10-24: plan zapisany; decyzje: Dziennik budowy przed Nauką, limit braków zostawia najnowsze 40, model danych odłożony.
- 2026-10-24: **Etap 0 zrobiony** — 0.1 `62c8aa1`, 0.2 `f668fc9`, 0.3 `e771615`, 0.4 `6b729dc`, 0.5 `3483967`, 0.6 `b0023bd` (helper `downloadBlob` objął też kopię zapasową, notatkę `.md` i kod skarbca). e2e Praca + bundle: 62/62. Następnie: 5.1–5.3, potem Etap 1.
- 2026-10-24: **5.1–5.3 zrobione** w `7317ccb`: selektor „czy jest szkic”, `JournalItem.tsx` w `memo`, punkty listy liczone raz, „Pokaż starsze” po 50 wpisów; pole budowy zapisuje przy zatwierdzeniu; `useSiteDirectory()` / `siteDirectoryOf()`. Z 5.4 przy okazji: jedna funkcja `topicTitle`. e2e Praca + bundle: 77 zaliczonych, 1 pominięty. Następnie: Etap 1 (1.1, 1.2, 1.3, 1.8, 1.12).
- 2026-10-24: **Etap 1, pierwsza część zrobiona** — 1.1 `203f73a` („+ Wpis” z filtra, „+ Wpis tutaj” w karcie), 1.2 `280f331` (Nawiguj / Zadzwoń / Wpis tutaj w „Przed wejściem”, wybór budowy w `sessionStorage`), 1.3 `5b415ed` (karta: liczniki i panele etapów, braków, zamówienia na górze; dane za „Edytuj dane”), 1.8 `71bb66e` („Poprzedni miesiąc”), 1.12 `31d7412` (40 najnowszych braków; przycinanie tylko w odczycie, zapis różnicowy nie kasuje ukrytych). e2e Praca + touch-targets zielone; a11y „kalendarz — hydraulika” niestabilny (poza Pracą). Następnie: 1.4–1.6 (godziny), 1.7, 1.9–1.11.
- 2026-10-24: 1.4 `52c3082` (suma godzin na karcie), 1.5 `cf290f4` (okno godzin z każdego dnia i z karty, budowa bez wpisu), 1.6 `5e6b59b` („Wychodzę”, podpowiedź godzin z wejścia i wyjścia), 1.7 (braki + kształtki w jednej wiadomości do hurtowni, „Oznacz jako zamówione” zmienia braki, „Cofnij”). Uwaga: 1.7 sprawdzone testami jednostkowymi; e2e nieuruchomione — dysk C pełny. Następnie: 1.9–1.11.
- 2026-10-25: 1.9 `7bebc34`, 1.10 `ae922b7`, 1.11 `3101a99` (wiersz „Odbiorcy raportu” w karcie budowy, `RecipientsForm` wspólny z raportem). Etap 1 zrobiony w kodzie; e2e karty zielone, e2e odbiorców i pełne e2e Etapu 1 jeszcze do zrobienia. 2026-10-25: e2e Etapu 1 — Praca (site-*, journal-*, touch-targets): 51 zaliczone, 2 nieaktualne, 2 pominięte, przed poprawką; dwa testy były nieaktualne (selektor „Raport” trafiał w nowy wiersz odbiorców — `exact: true`; „Oznacz jako zamówione” zmienia „brakuje” na „zamówione 14.10”, zgodnie z 1.7) — poprawione. Nowy `e2e/site-recipients.spec.ts` zielony; `report-whatsapp` i `bundle` zielone; `a11y` „kalendarz — hydraulika” nie przechodzi (color-contrast przy „dziś”, poza Pracą — znane jako niestabilne). 2026-10-25: **2.1 zrobione** — link `/praca?budowa=<id>` z wierszy Dziś i z push (serwis, dostawa); helper `siteLink.ts`; e2e `site-deeplink` i regresja Praca 69/69. Następnie 2.2.

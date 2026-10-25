# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Praca” (2026-10-25)

Siódmy plan z serii „dział po dziale” (po Notatkach, Skrzynce, Dziś, Kalendarzu, Terminach i Grafiku), w tym samym układzie. Dział Praca (`/praca`) to Dziennik budowy i Nauka.

## Kontekst

**Poprzedni plan działu** — `docs/plan-praca-2026-10-24.md` — jest prawie zamknięty (sprawdzone w kodzie 2026-10-25):
- Etap 0 (6 błędów), Etap 1 (codzienna pętla: wpis z kontekstu, „Przed wejściem”, karta budowy, godziny, „Wychodzę”, hurtownia, etap na osi, nagrania w raporcie, odbiorcy, 40 najnowszych braków), Etap 2 (link do karty, dostawa dziś, wieczorne przypomnienie, karta na Dziś, paleta, CSV godzin).
- Etap 3: nazwy, tryb budowy, pieczątka „OTWARTY”, ikony przypomnień (`ReminderRow.tsx:5`), podświetlenie świeżego wpisu (`journal-fresh`), pigułki w arkuszu („+ Temat”, etap), galeria z przesuwaniem i powiększaniem (`PhotoGallery.tsx`), kratki postępu quizu.
- Etap 4: poprawa i dopracowanie Nauki, 4.1 (podpowiedź „Umiem”), 4.2 (problem → szkic pytania, `CustomQuestionsDialog.tsx:52`), 4.4 (pytania z kalkulatorów), 4.5 dla listy kontrolnej.
- Etap 5: 5.1–5.3 (wydajność arkusza i osi), 5.5 (kartka raportu, wiersz przypomnienia, pasek zdjęć), 5.6 (testy `lib/study`).
- Etap 6: model danych — karta i odhaczenia jako mapy, zdjęcia i kształtki jako `Y.Array`, dump wersja 2 (`docs/plan-dane-yjs-2026-10-25.md`).

Ten plan nie powtarza tamtego. Bierze z niego to, co zostało, i dokłada nowy przegląd działu pod kątem pracy hydraulika na telefonie.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-praca-24 4.3 | Własne tematy Nauki: nieznany temat odrzucany przy wczytaniu; UI nie tworzy tematów. Odłożone do osobnego projektu | `TODO.md`, `lib/study/store.ts` (`sanitizeStudy`) |
| plan-praca-24 4.5 | Wyszukiwanie bez polskich znaków zrobione dla listy kontrolnej; pytania quizu nieprzeszukiwane | `TODO.md` |
| plan-praca-24 4.6 | Ok. 29 pytań wbudowanych na 18 tematów; czeka na źródła od właściciela | `TODO.md` |
| plan-praca-24 Etap 6 | Import własnych materiałów do Nauki; ręczne QA z dwoma telefonami (zdjęcia i odhaczenia naraz) | `roadmap.md`, `TODO.md` |
| plan-praca-24 5.4–5.5 | Duplikaty do przejrzenia (udostępnianie → schowek, martwe gałęzie); duże pliki: `JournalEntrySheet.tsx` 952 linie, `yStudy.ts` 780, `store.ts` 603, `SiteCardDialog.tsx` 515 | `wc -l` |
| opis.md | Starsza wersja aplikacji na drugim urządzeniu nie widzi wpisów zapisanych jako mapa pól i gubi nowe pola przy edycji — a aplikacja o tym nie ostrzega. Awareness przesyła tylko nazwę urządzenia | `opis.md` (Dziennik — Dane, Ograniczenia), `lib/yjsSync.ts:290` |
| opis.md | Podpis zdjęcia i rysunek wtopione w piksele — nie da się poprawić podpisu ani cofnąć rysunku bez usunięcia zdjęcia | `opis.md` (Dziennik — Ograniczenia), `photoCaption.ts` |
| opis.md | Nieaktualne zdania: „Nie zrobione: zamiana rozwiązania na pytanie” (jest szkic z problemu), „Przycisk Dodaj protokół nie istnieje” (jest „Dodaj próbę”, `ReminderRow.tsx:43`) | `opis.md` (Dziennik — Problemy, Ograniczenia) |
| nowe | Brak przypomnienia o zdjęciach instalacji przed zakryciem (jest tylko o próbie przed zakryciem) i brak takich zdjęć w protokole odbioru | `lib/study/reminders.ts:16,30`, `handover.ts` |
| nowe | Brak łącznego zużycia materiału na budowie (jest tylko „Do zamówienia” od ostatniego zamówienia) | `lib/study/order.ts:22` |
| nowe | Rysowanie tylko na zdjęciu wpisu; na planie budowy (dokumenty karty) nie da się zaznaczyć trasy | `JournalEntrySheet.tsx:946`, `SiteDocsPanel` |
| nowe | Brak informacji, ile miejsca zajmują zdjęcia i nagrania Pracy, i brak sposobu na odchudzenie zakończonej budowy (jest tylko ogólne „Zajęte” w Ustawieniach) | `BackupSettings.tsx:63`, `storagePersistence.ts` |
| opis.md | Nie sprawdzone ręcznie na telefonie: udostępnianie zdjęć, wydruk, PDF, dyktowanie mikrofonem, nagrywanie, „Tu jestem”, karta na 320 px | `opis.md` (Dziennik — Ograniczenia) |

**Powiązania:** Dziś (karta „Przed wejściem”, wiersze Pracy), Kalendarz 3.1 (znaczniki Pracy w tygodniu), Terminy 4.3 (Praca w kolejności grup), Grafik 1.4–3.3 (godziny dnia, z których liczą się godziny budów — test `siteHours.test.ts` przy każdej zmianie rachunku dnia). Plan przekrojowy 5.1 (odcień działu: miedź) i 2.8 (haptyka przy zapisie wpisu).

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB): do startu trafia tylko `yStudy.ts`; wszystko inne w Pracy leniwe. `content.ts` (materiał Nauki) nigdy w paczce startowej. Pilnuje `e2e/bundle.spec.ts`.
- **Dane:** nowe pola przez dopisanie, czytane przez `clean*`, z testem dwóch dokumentów Yjs i kopii (`yStudy.test.ts`, `fullBackup.test.ts`). Zdjęcia i nagrania w `imageStore` (IndexedDB), przez przekaźnik tylko po wdrożeniu obrazów w przekaźniku.
- **Miejsce na telefonie:** każda funkcja, która dokłada zdjęcia (2.1, 2.3), pokazuje rozmiar i ma limit.
- **7 motywów (szczególnie Hydraulika), tryb budowa, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: zamknięcie poprzedniego planu i porządek w opisie (S)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **`opis.md` aktualny:** usunąć nieaktualne „Nie zrobione” i „Dodaj protokół nie istnieje”, dopisać szkic pytania z problemu i „Dodaj próbę”. Status w `plan-praca-2026-10-24.md`: „zamknięty, reszta w planie 2026-10-25”. | `opis.md`, `docs/plan-praca-2026-10-24.md` | 1 | S |
| 1.2 | **5.4 do końca:** przejrzeć duplikaty z listy (udostępnianie → schowek, komunikaty o braku miejsca, martwe gałęzie) — co zostało, usunąć; co już usunięte, odhaczyć. | `JournalReport.tsx`, `SiteCardDialog.tsx`, `JournalEntrySheet.tsx` | 1 | S |
| 1.3 | **Pełne e2e Pracy** jako punkt odniesienia (`site-*`, `journal-*`, `study*`, `entry-*`, `report-*`, `touch-targets`, `bundle`). | `e2e/` | 2 | S |

## Etap 2: budowa — dokumentacja i materiał (największa wartość)

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Zdjęcia przed zakryciem:** przed odhaczeniem etapu „Zakrycie” (i w przypomnieniu na osi) pytanie „Zrób zdjęcia instalacji przed zakryciem” z licznikiem zdjęć z dni przed zakryciem; przycisk „Zrób zdjęcia” otwiera arkusz z aparatem i tematem etapu. W protokole odbioru sekcja „Zdjęcia instalacji przed zakryciem” (do 6, miniatury z datą). Dla inwestora to dowód, gdzie biegną rury. | 3 | M |
| 2.2 | **Zużycie materiału na budowie:** w karcie „Materiał” — suma kształtek ze wszystkich wpisów (`sumFittings`) i braków dostarczonych, z podziałem na miesiące; „Kopiuj” i CSV (do rozliczenia z szefem lub hurtownią). Bez cen (na razie). | 2 | S |
| 2.3 | **Rysowanie na planie budowy:** zdjęcie z dokumentów karty (rzut, tablica) → „Zaznacz na planie” otwiera `DrawingCanvas` z `initialImage`; wynik jako nowy dokument „Plan + trasa (data)”, oryginał zostaje. | 2 | S |
| 2.4 | **Podpis zdjęcia bez wtapiania:** podpis jako dane wpisu (`captions[id]`) rysowany przy wyświetlaniu i wtapiany tylko przy eksporcie (raport, ZIP, udostępnianie). Stare zdjęcia z wtopionym podpisem bez zmian. Poprawa podpisu i „Usuń podpis” bez utraty zdjęcia. **Decyzja P-1.** | 2 | M |
| 2.5 | **Notatka głosowa → tekst wpisu:** po nagraniu przycisk „Dyktuj to samo” nie ma sensu (Web Speech nie czyta plików) — zamiast tego przy nagrywaniu równoległe dyktowanie (jeśli dostępne): nagranie zostaje jako załącznik, a rozpoznany tekst trafia do pola. Na urządzeniach bez rozpoznawania sam zapis jak dziś. Najpierw próba na telefonie: Chrome na Androidzie często nie pozwala na `MediaRecorder` i rozpoznawanie mowy naraz na jednym mikrofonie — wtedy punkt odpada. | 1 | M |
| 2.6 | **Szablon dnia na budowie:** „Plan na dziś” w karcie „Przed wejściem” — 3–5 zadań wpisanych rano (albo wieczorem dzień wcześniej), odhaczanych w ciągu dnia; niezrobione przechodzą na jutro, zrobione trafiają do raportu dnia jako „Zrobione”. Dane: lista karty budowy (`siteItems`, rodzaj `todo`). | 2 | M |

## Etap 3: dane, synchronizacja i miejsce

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Ostrzeżenie o starszej wersji na innym urządzeniu:** awareness przesyła wersję aplikacji (`device: { name, version }`); gdy połączone urządzenie ma starszą wersję niż ta, która zmieniła format Pracy, baner „Telefon „X” ma starszą wersję — wpisy z Pracy mogą być na nim niewidoczne. Zaktualizuj go.” Dotyczy całej aplikacji, ale najważniejsze dla Pracy. **Wdrażane w planie Ustawień jako 2.1** (`docs/plan-ustawienia-2026-10-25.md`). | 3 | S |
| 3.2 | **Miejsce zajęte przez Pracę:** w karcie budowy i w Ustawieniach → Kopia: „Zdjęcia i nagrania: 340 MB (budowa X: 120 MB)”. Liczone z `imageStore` (rozmiary blobów), leniwie. | 2 | S |
| 3.3 | **Odchudzenie zakończonej budowy:** przy archiwizacji budowy „Zapisz paczkę ZIP i zmniejsz zdjęcia” — po zapisaniu ZIP-a zdjęcia budowy zastępowane miniaturami (np. 800 px), oryginały tylko w ZIP. Z potwierdzeniem i bez „Cofnij” (dlatego najpierw ZIP). **Decyzja P-4.** | 2 | M |
| 3.4 | **QA dwóch telefonów** (zaległe z Etapu 6): zdjęcia, odhaczenia, kształtki i karta budowy edytowane równocześnie; wynik w `opis.md`. Najlepiej po 3.1. | 2 | S |

## Etap 4: Nauka

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Pytania wbudowane** (4.6): dopisanie pytań do tematów z ≤ 2 pytaniami, po otrzymaniu źródeł (poradnik, listy kontrolne, normy). Każde pytanie z objaśnieniem i źródłem. | 3 | L |
| 4.2 | **Egzamin próbny:** runda 20 pytań z całego materiału (albo modułu), z limitem czasu, bez podpowiedzi i bez SRS w trakcie; wynik z podziałem na tematy i „Ćwicz słabe tematy”. Historia wyników w statystykach. **Decyzja P-3** (pod jaki egzamin). | 2 | M |
| 4.3 | **Szukanie w pytaniach quizu** bez polskich znaków (dokończenie 4.5): pole „Szukaj pytania” w zakładce Quiz, wynik → „Ćwicz to pytanie”. | 1 | S |
| 4.4 | **Własne tematy** (4.3 starego planu): mapa tematów w `studyCustom`, tworzenie z tablicy, pytania i punkty listy do własnego tematu. Osobny projekt. **Decyzja P-2.** | 2 | L |
| 4.5 | **Import materiału** (z `roadmap.md`): plik `.md` z pytaniami w prostym formacie („P: … / A: … / B: …”) → własne pytania. Najpierw format i walidacja (`cleanCustom`), potem UI. | 1 | M |

## Etap 5: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Oś czasu:** przyklejone nagłówki dni (`position: sticky`) z godzinami dnia i liczbą wpisów; tydzień jako separator z sumą godzin. | 2 | S |
| 5.2 | **Karta budowy jako bohater:** okładka z pierwszego zdjęcia (albo planu z dokumentów), nazwa i adres na niej, pasek etapów jako linia postępu z kropkami (zrobione / następny). | 2 | M |
| 5.3 | **Odcień działu** (plan przekrojowy 5.1): miedź w nagłówku Pracy, ikonach i pustych stanach; spójnie z motywem Hydraulika. | 1 | S |
| 5.4 | **Raport i protokół na papierze:** nagłówek z nazwą firmy/wykonawcy (pole w Ustawieniach Pracy), stopka z numerem strony, zdjęcia w siatce 2×3 — sprawdzone na prawdziwej drukarce i w PDF z telefonu. | 1 | S |
| 5.5 | **Haptyka i potwierdzenia:** zapis wpisu, „Wchodzę”, odhaczenie etapu (`lib/haptics.ts`). | 1 | S |

## Etap 6: kod

- `JournalEntrySheet.tsx` (952 linie): wydzielić sekcję podpisów i rysunku, dyktowanie z parserem wpisu i pola protokołu/kształtek do osobnych plików (każdy krok osobnym commitem, bez zmiany granicy lazy).
- `SiteCardDialog.tsx` (515): panele (etapy, braki, zamówienie, dokumenty, serwis) jako osobne komponenty — część już jest (`SiteShortagesPanel`, `SiteOrderPanel`), reszta do wydzielenia.
- `yStudy.ts` (780) i `store.ts` (603): podział per obszar (dziennik, karty, nauka) z jednym punktem wejścia; test granicy importów (`content.ts` nie w `yStudy`).

## Etap 7: QA działu

- Ręcznie na telefonie (zaległa lista z `opis.md`): udostępnianie zdjęć, wydruk, PDF, dyktowanie prawdziwym mikrofonem, nagrywanie głosu, „Tu jestem”, karta na 320 px; do tego 2.1, 2.3, 3.3.
- Zrzuty `@visual`: dziennik, karta budowy, arkusz wpisu, raport, protokół, tablica, quiz × 7 motywów (Hydraulika i Zeszyt obowiązkowo) × telefon i komputer.
- axe: arkusz wpisu, karta budowy, quiz, egzamin.
- Bundle: `content.ts` i panele karty poza paczką startową.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| P-1 | Podpis zdjęcia jako dane zamiast wtapiania (2.4)? | Tak. Nowe zdjęcia bez wtapiania; stare bez zmian. Eksport nadal ma podpis na obrazie. |
| P-2 | Własne tematy Nauki (4.4): robić teraz czy osobny projekt? | Osobny projekt po 4.1 — najpierw więcej pytań do istniejących tematów. |
| P-3 | Egzamin próbny (4.2): pod jaki egzamin (uprawnienia, G-HEAT, wewnętrzny)? | Ogólny „sprawdzian działu” bez nazwy egzaminu, dopóki nie ma źródeł. |
| P-4 | Odchudzanie zdjęć zakończonej budowy (3.3)? | Tak, tylko po zapisaniu ZIP-a i za potwierdzeniem; domyślnie wyłączone. |
| P-5 | „Plan na dziś” na budowie (2.6): osobna lista czy notatka z listą zadań? | Lista karty budowy — trafia do raportu dnia i do „Przed wejściem”, czego notatka nie da. |

## Kolejność wdrażania

1. Etap 1 (1.3 najpierw, potem 1.1, 1.2).
2. Etap 3: 3.1, 3.2, potem 3.4.
3. Etap 2: 2.1, 2.2, 2.3, 2.6 (po P-5), 2.4 (po P-1), 2.5.
4. Etap 4: 4.3, 4.1 (po źródłach), 4.2 (po P-3), 4.5, 4.4 (po P-2).
5. 3.3 (po P-4).
6. Fundament z planu przekrojowego, potem Etap 5: 5.1, 5.2, 5.3, 5.5, 5.4.
7. Etap 6 przy dotykanych plikach, Etap 7 na koniec.

Następny plan w serii: **Długi**, potem **Ćwiczenia**, **Ustawienia** i **powłoka** (pasek boczny, dolny pasek, paleta) według `plan-dzialy-2026-10-22.md`.

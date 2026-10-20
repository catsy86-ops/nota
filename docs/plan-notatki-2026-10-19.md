# Plan: dopracowanie i upiększenie działu Notatki (2026-10-19)

**Status 2026-10-20 (sprawdzone w kodzie):**
- ✅ F0 tytuł z przyimkiem (`6e95430`, test w `quickCapture.test.ts`).
- ✅ F1 pole tytułu w kompozytorze to `TitleField` (`AddNoteBar.tsx`).
- ✅ F3 placeholder wyszukiwarki jest stały („Szukaj notatek...”), bez rotacji.
- ✅ F4 liczniki grup to `.stamp-tag`.
- ✅ F5 kafel: `rounded-card`, bez cienia, hover tylko przy `pointer: fine`.
- ✅ F7 podpowiedź „+” pojawia się przy pierwszym stuknięciu (`BottomNav.tsx`).
- ✅ F6 (czas ruchu zdjęcia w kaflu) → token `duration-base` + `motion-reduce` (`NoteCard.tsx`). Mikrocopy pustych stanów: nie sprawdzane w tej rundzie.
- ✅ F15 progi gęstości w jednej tabeli `DENSITY_GAPS` (`NoteGrid.tsx`), wygląd bez zmian.
- ◐ F2 nagłówek: cień Zeszytu zdjęty (`index.css`). Szkło (`backdrop-filter`) zostaje — użytkownik zdecydował „zostaw” przy rozmyciu tła.
- ✗ F14 `AddNoteBar.tsx` ma 763 linie — nie dzielony (ryzyko przy zmianach bez e2e).
- ✗ Zrzuty telefonu (F5, F2, punkt 13) — wymagają przeglądarki, nie zrobione.
- ◐ F8 budżet: paczka wejściowa 391,9 KB przy progu 392 KB — na granicy; każda zmiana w tym module wymaga podniesienia progu albo odchudzenia.

Plan przygotowany przez agenta w trybie odczytu — kod nie był zmieniany. Liczby z `opis.md` są szacunkami, a nie zmierzonymi wartościami.

## 1. Diagnoza

Już zrobione (nie powtarzać): zwinięty pasek „Zapisz notatkę…” z plusem, grupa widoku w nagłówku, wspólny `StatusPanel` dla pustego stanu/błędu/braku sieci, zwijanie grup z obsługą ograniczonego ruchu, 5 stylów (Zeszyt, Plan, Neon, Zorza, Miedź) z tokenami, pieczątki `.stamp-tag`, dolny pasek nawigacji, arkusz „Nowa”, pełny ekran edytora.

Do zrobienia:
1. Kompozytor (`quickCapture.ts`) wycina frazę daty z tytułu — stąd błąd „Lista na sobotę” → „Lista na”.
2. Pole tytułu: w kompozytorze zwykły `<input>` (`AddNoteBar.tsx`), w edytorze zawijany `TitleField` — inne zachowanie na telefonie.
3. Nagłówek widoku ma klasę `glass header-glow` — szkło słabo pasuje do papieru Zeszytu.
4. Placeholder paska wyszukiwania zmienia się co 3,2 s — nieczytelny, brak stałej etykiety.
5. Liczniki grup to wypełnione pigułki, a system mówi, że mają być pieczątkami `.stamp-tag`.
6. Kafel `NoteCard` używa `rounded-2xl` i `border-border/50` zamiast tokenu `rounded-card`.
7. Kafel ma cień i hover z unoszeniem, które na telefonie nie mają sensu.
8. Mikrocopy pustych stanów to jednozdaniowe opisy bez następnego kroku.
9. Brak podpowiedzi o przytrzymaniu kafla do przesuwania.
10. Podpowiedź o przytrzymaniu „+” pojawia się dopiero po czwartym stuknięciu — słaba odkrywalność.
11. Hardkodowane czasy ruchu (`duration-300`) zamiast tokenów `--dur-*`.
12. Zapas budżetu bundla jest mały. Liczby w `opis.md` są niespójne — zmierzyć po `npm run build`.
13. Brak zrzutów telefonu dla ruchu zwijania i szkieletu.
14. `AddNoteBar.tsx` ma ok. 764 linie — trudno zmieniać bezpiecznie.
15. Progi gęstości siatki są w trzech miejscach w `NoteGrid.tsx`.

## 2. Błąd tytułu

Przyczyna (z kodu, nie odtworzona w przeglądarce): to nie kodowanie znaków. Kompozytor skanuje też tytuł; `DATE_END_RE` łapie frazę „sobotę” (po składaniu znaków `plain()` → „sobote”), `applyCapture` ją wycina, a przypomnienie ustawia się na sobotę. Słowo „na” zostaje.

Naprawa (rozmiar S, pierwszy krok):
- **Opcja A (rekomendowana):** nie wycinać frazy daty z tytułu, gdy poprzedza ją przyimek (na, do, w, we, od, o, dla, przed, po).
- **Opcja B:** w tytule data jest tylko chipem i nigdy nie jest wycinana.
- Testy: `quickCapture.test.ts` i `e2e/quick-capture.spec.ts` na 390 px.

## 3. Fazy

- **F0 — naprawa tytułu (S):** `quickCapture.ts` + testy. Gotowe: testy zielone, e2e na 390 px.
- **F1 — spójne pole tytułu (S):** `AddNoteBar.tsx` używa `TitleField`. Gotowe: długi tytuł zawija się na 390 px.
- **F2 — nagłówek (S–M):** zdjąć szkło w Zeszycie, ewentualnie blok tytułowy (decyzja 2). Gotowe: zrzuty 390 i 1440 px, `a11y.spec.ts` bez naruszeń.
- **F3 — pasek wyszukiwania (S):** stała etykieta, podpowiedzi operatorów przenieść do pustego stanu.
- **F4 — grupy i liczniki (S):** licznik jako `.stamp-tag`. Gotowe: kontrast ≥ 4,5:1 (`contrastTokens.test.ts`).
- **F5 — kafel (M):** `rounded-card`, jeden poziom cienia na telefonie, hover tylko przy `pointer: fine`. Gotowe: zrzut 390 px w 5 stylach, `touch-targets.spec.ts`, `mobile-layout.spec.ts`.
- **F6 — pusty stan i mikrocopy (S–M):** jedno zdanie z następnym krokiem.
- **F7 — odkrywalność „+” (S):** podpowiedź po pierwszym stuknięciu zamiast czwartym.
- **F8 — budżet (S, na końcu):** `npm run build` i `e2e/bundle.spec.ts`. Nowe elementy ładować leniwie.

## 4. Decyzje wizualne

- Paleta tylko z tokenów (`--primary` bursztyn, `--accent` długopis); bez nowych hex w komponentach.
- Typografia: tytuły widoków Fraunces w Zeszycie, reszta Plus Jakarta Sans; metadane mono 11 px.
- Rytm: krok 4 px; promienie 8/12/16 px wyłącznie z tokenów.
- Ruch: tokeny `--dur-*`, tylko `transform` i `opacity`; przy ograniczonym ruchu zero animacji.
- Cień tylko jako uniesienie menu i okien, nie na kaflach.

## 5. Czego nie robić

- Nie dodawać nowego stylu ani nie zmieniać pięciu istniejących bez pełnej listy zmian.
- Nie wracać do punktów już zrobionych.
- Nie zmieniać modelu Yjs ani formatu tytułu w dokumencie.
- Nie dodawać wirtualizacji ani nowych bibliotek (budżet).
- Nie przepisywać `AddNoteBar.tsx` w całości — tylko punktowe zmiany.
- Nie poprawiać „uppercase tracking-wider” i `rounded-2xl` w jednym PR.
- Nie robić zrzutów `fullPage` na telefonie.

## 6. Pytania do użytkownika

1. Data w tytule („Lista na sobotę”): opcja A (przyimki zostają w tytule, bez przypomnienia) czy opcja B (tytuł bez zmian, przypomnienie ustawiane)?
2. Nagłówek: Fraunces w Zeszycie czy Plus Jakarta? Szkło ma zniknąć ze wszystkich stylów czy tylko z Zeszytu?
3. Priorytet na telefonie: gęstość (więcej kafli) czy oddech (większe odstępy)?

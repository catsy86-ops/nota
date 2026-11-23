# Jakość, architektura i testy

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Dokumenty usunięte (2026-10-21)

Z repozytorium usunięto dokumenty bez otwartych zadań: zrealizowane plany, przegląd kodu, archiwum i dziennik wdrażania. Zostały w historii git do commitu `cb8e4f8` (`git show cb8e4f8:<ścieżka>`). Żywe zadania są w `roadmap.md` (jedyne otwarte: 5.3, QA na telefonie). Zostają: `README.md`, `CLAUDE.md`, `AGENTS.md`, `opis.md`, `roadmap.md`, `docs/GOTCHAS.md`, `push-server/README.md`, `signaling-server/README.md` oraz pliki w `.claude/`.

| Plik | Był | Status |
| --- | --- | --- |
| `docs/plan-audyt-2026-10-18.md` | plan po audycie | zrealizowany |
| `docs/plan-wizualny-2026-10-18.md` | plan upiększenia | zrealizowany (B4 zrobione) |
| `docs/plan-mobile-rozbudowa-2026-10-18.md` | plan telefonu | zrealizowany |
| `docs/plan-synchronizacja-2026-10-18.md` | plan sync | zrealizowany |
| `docs/plan-praca-2026-10-18.md` | plan Pracy | zrealizowany |
| `docs/plan-notatki-2026-10-19.md` | plan Notatek | zrealizowany |
| `docs/plan-kalendarz-2026-10-19.md` | plan Kalendarza | zrealizowany |
| `docs/plan-kalendarz-przypomnienia-2026-10-19.md` | plan przypomnień w Kalendarzu | zrealizowany |
| `docs/plan-ustawienia-2026-10-19.md` | plan Ustawień | zrealizowany (fazy 1–3) |
| `docs/plan-przypomnienia-2026-10-20.md` | plan Terminów | zrealizowany |
| `docs/plan-cwiczenia-2026-10-20.md` | plan Ćwiczeń | zrealizowany; opis działu w sekcji „Ćwiczenia” |
| `docs/code-review-2026-10-20.md` | przegląd kodu | poprawki zrobione (b779947, 1b8bcf8, 1380f10) |
| `docs/archiwum/noti.md` | archiwum planu kont | nieaktualne (opisywało konta, których aplikacja nie ma) |
| `docs/FEATURES-LOG.md` | dziennik wdrażania | historia; najnowsze wpisy w `roadmap.md` |

---

## Wydajność — paczka startowa i precache (2026-10-16)

**Co robi.** Dla użytkownika: szybszy pierwszy start (mniej kodu do pobrania i uruchomienia) i mniej danych przy
instalacji / aktualizacji offline. Funkcje działają tak samo; płótno, „Znajdź i zamień” i okno własnego szablonu
doczytują się przy pierwszym otwarciu (ułamek sekundy).

**Gdzie jest.**
- Czytnik notatek (`NoteReader`) leniwie w `Index.tsx` (`Suspense key="reader"` jako bezpośrednie dziecko
  `AnimatePresence` — animacja zamknięcia działa) i doczytywany w czasie bezczynności po starcie
  (`requestIdleCallback`, bez niego po 1,5 s), żeby pierwsze otwarcie notatki nie czekało (`a7bfb5a`).
- Leniwe ładowanie (`lazy` + `Suspense`): `DrawingCanvas` w `NoteCard.tsx` i `AddNoteBar.tsx` (montowany dopiero po
  pierwszym „Rysuj” — `useLatch`), `FindReplaceBar` w `NoteEditor.tsx`, `CustomTemplateDialog` w `QuickTemplates.tsx`.
- `src/lib/study/journalRefs.ts`: `journalRefsIn` (klucze zdjęć dziennika) w osobnym module bez importu `yjs`;
  `yjsStore.ts` i `study/images.ts` korzystają z niego, `yStudy.ts` go re-eksportuje.
- `src/lib/exportNotes.ts`: dane działu Praca (`study/data`, `study/yStudy`) importowane dynamicznie w
  `buildFullBackupWithReport` i przy przywracaniu kopii.
- `vite.config.ts`: bez `includeAssets` — ikony i `offline.html` z `public/` łapie `globPatterns`, a oba naraz dublowały
  6 plików w liście precache `sw.js`.
- Strona offline: `public/offline.html` ładuje `public/offline.js` (`defer`) zamiast inline-skryptu, żeby CSP
  `script-src 'self'` nie zgłaszał naruszenia. `offline.js` trafia do precache przez `globPatterns`. Testy: `e2e/pwa.spec.ts` (offline przeładowanie).
- **Nagłówki bezpieczeństwa i egzekwowane CSP (Plan-nowy 1.11, 2026-11-03).**
  - *Co robi:* hosting wysyła `Content-Security-Policy` (zamiast `-Report-Only`), więc przeglądarka blokuje skrypty inline, obce skrypty i obrazy spoza `'self'`, `data:` i `blob:`. `Permissions-Policy` pozwala tej stronie na kamerę (skan kodu QR przy parowaniu) i lokalizację („Tu jestem”, przyjazd na budowę). Dawne `camera=()` i `geolocation=()` blokowały te funkcje na hostingu.
  - *Gdzie:* źródłem jest `vercel.json` (reguła `/(.*)`). `netlify.toml` ma kopię. `vite.config.ts` (`previewSecurityHeaders`) czyta nagłówki z `vercel.json` do `vite preview`, więc **cały zestaw e2e biegnie pod egzekwowanym CSP**. Tylko w preview `connect-src` dostaje `http://127.0.0.1:*` i `ws://127.0.0.1:*` dla lokalnego przekaźnika e2e. Na produkcji strona po https łączy się tylko przez `https:`/`wss:`.
  - *Jak działa:* `connect-src` nie zezwala na `fetch("data:…")` ani `fetch("blob:…")`. Kanwa zamienia się na Blob przez `dataUrlToBlob` (`src/lib/imageStore.ts`), bez `fetch`. Tak działają rysunek na zdjęciu (`useJournalPhotoEdits.ts`) i zaznaczony plan (`SiteDocsPanel.tsx`). Naruszenia nadal trafiają do diagnostyki (`installGlobalDiagHandlers`, `securitypolicyviolation`).
  - *Pułapki:* nowy kod nie może robić `fetch` na `data:`/`blob:` ani ładować skryptów inline (np. `<script>` w `index.html`). Zmiana nagłówków: popraw `vercel.json` i `netlify.toml` razem, bo test porównuje oba pliki. `connect-src https:` nadal niczego nie zawęża, bo adres przekaźnika i serwerów sygnalizacyjnych ustawia użytkownik.
  - *Testy:* `src/lib/securityHeaders.test.ts` (oba pliki zgodne, CSP egzekwowane bez `'unsafe-eval'`, kamera i lokalizacja dla `self`). `e2e/csp.spec.ts` (nagłówek na buildzie, 13 widoków, edycja i paleta, Matryca i Plany bez naruszeń). `e2e/photo-drawing.spec.ts` i `site-plan-mark.spec.ts` (zapis z kanwy pod CSP). Pełne e2e Chromium pod CSP: 941/955 na 3 workerach, 4 z 5 porażek przeszły na 1 workerze, a piąta (sygnały w `skin-signatures.spec.ts`) była wyścigiem w teście i jest poprawiona. Commit 8aadb82 (2026-11-03).
- Budowanie: Vite 8 (rolldown). `vite.config.ts` → `build.rolldownOptions.output.codeSplitting`: grupy `vendor-react`, `vendor-dnd`, `vendor-radix` dopasowane regexem po ścieżce w `node_modules` (obiekt `manualChunks` nie działa w rolldown). `workbox.globIgnores` dla PDF: nazwy chunków to `exportPdf-*`, `html2canvas-*` (bez `.esm`), `purify.es-*`, `index.es-*`, `StatsDialog-*`. Budżety w `e2e/bundle.spec.ts`: wejściowy JS 400 KB gzip, precache 3,2 MB. `tsconfig.app.json`: `node` w `types` (Vitest 4 nie ciągnie typów Node).
- `vite.config.ts` → `workbox.globIgnores`: `exportPdf`, `index.es` (jsPDF), `html2canvas.esm`, `purify.es`, `StatsDialog` są poza
  precache. Trafiają do cache `static-assets` (CacheFirst na `/assets/*.js`) dopiero przy pierwszym użyciu.

**Wynik.** Paczka startowa (gzip) 390 → 383 KB, potem (osobne pozycje list budowy, `395c311`) 384,0 KB, a po leniwym
czytniku 378,7 KB — zapas 5,3 KB do progu 384. Precache 4,37 → 4,03 MB (próg 4,3), 90 → 84 pliki.

**Stan 2026-10-17:** precache 4,09 → **3,00 MB, 88 plików** (próg 3,1 MB w `e2e/bundle.spec.ts`; od 2026-10-21 próg 3,2 MB po stylach Matryca i Hydraulika, 3,12 MB / 106 plików). Cel z roadmapy
1,5 MB nieosiągnięty — wymagałby Nauki (`StudyView`), Grafiku (`ShiftsView`) i Markdownu poza precache, a to psuje
offline-first tych działów. Wirtualizacja listy: nie robimy (`content-visibility` + render progresywny wystarczają).

**Stan 2026-11-03 (Plan-nowy 1.5):** wejściowy JS **484 234 → 451 235 B gzip** (−33 KB, zapas do 500 KB około 61 KB). Precache **4066,8 KiB** z 4096, 227 plików. Trzy kroki:
- **`exportNotes` poza startem (−5,6 KB):** mały `download()` przeniesiony do `src/lib/downloadBlob.ts` (`exportNotes` go re-eksportuje). Kalendarz, Grafik i `yjsFileSync` biorą go stamtąd. `ImportExportMenu` ładuje eksport dynamicznie i z wyprzedzeniem przy otwarciu menu (`onOpenChange`), żeby zapis albo okno pliku działały w geście użytkownika. Tak samo działa `useImportExport` (import JSON) i `useBackupReminders` (moduł pobierany przy pokazaniu dymku). Koszt: precache +6,8 KB, czyli narzut nowego chunka (lista `__vite__mapDeps` 3,2 KB i kod łączący).
- **Węższa grupa `vendor-radix` (−4,9 KB, precache −1,8 KB):** `vite.config.ts` → `codeSplitting.groups` wyłącza z grupy `@radix-ui/react-slider`, `-switch`, `-tabs` i `-progress`. Używają ich tylko Ustawienia, Praca i Statystyki.
- **Grafik poza startem (−22,5 KB, precache −18 KB, o 19 plików mniej):** do startu wciągały go trzy statyczne importy, a po kroku 1 zostały już tylko one.
  - Wieczorne przypomnienie działa jako leniwy komponent bez UI `src/components/ShiftEveningNudge.tsx` (owija `useShiftEveningNudge`, `lazy` w `indexViews.ts`, w `Suspense` obok `DailyReportNudge`). Pierwsze sprawdzenie i tak było po 7 s.
  - Ctrl+Z / Ctrl+Shift+Z w Grafiku: `Index.tsx` trzyma store Grafiku w `useRef` i ładuje go (`loadShiftsStore`) przy wejściu na widok Grafiku. Skrót sprawdza go synchronicznie; poza Grafikiem cofanie idzie jak dotąd do `undoLastAction`.
  - Chipy „Po dzisiejszej zmianie” i „30 min przed jutrzejszą zmianą” w `ReminderPicker`: hook `src/hooks/useShiftPresets.ts` ładuje leniwie `currentShiftPresets` z `lib/reminderShiftPresets.ts` (aktywny grafik przez `shiftStore.get()`). Moduł doczytuje się w tle po starcie, razem z czytnikiem (`requestIdleCallback` w `Index.tsx`). Dopóki nie dojdzie, chipów Grafiku nie ma. Picker nie odświeża już chipów przy zmianie grafiku w trakcie, bo liczy je przy renderze.
  - Testy: `src/hooks/useShiftPresets.test.ts`, e2e Grafiku i terminów (`shifts*`, `shifts-undo`, `calendar-shift-edit`, `reminder-*`, `composer-reminder`, `dzis-terminy`, `bundle`): 87/87. Vitest 3012/3012.
- **Pułapka:** każde kolejne wydzielenie modułu z wieloma dynamicznymi importami dokłada do precache kilka KB narzutu. Przy zapasie około 11 KiB łańcuchy Grafiku i Pracy (Plan-nowy §10.4) trzeba mierzyć po każdym kroku.
- **Testy:** `bundle.spec.ts`, eksport, kopia i import (`images`, `note-props`, `private-notes`, `search-backup`, `settings-links`, `import-external`, `ics-import`), przełączniki, suwaki i zakładki oraz `a11y.spec.ts`: 240/240 + 69/69. Vitest `src/lib` i `src/hooks` 2723/2723.

**Ograniczenia i pułapki.**
- `study/data.ts` (z `yStudy.ts`) zostaje w paczce startowej celowo: odśmiecanie zdjęć (`useNotes`) potrzebuje od startu
  wiedzy, czy stary dziennik przeniesiono do dokumentu (`legacyStudyMerged`) — inaczej mogłoby usunąć jego zdjęcia.
- Zapas do progu paczki startowej ~5 KB (po `a7bfb5a`) — nowe moduły w głównej paczce zjadają go szybko.
- Duplikaty w precache nie dublowały pobierania (ta sama rewizja), ale zawyżały test budżetu.
- PDF i Statystyki działają offline dopiero po pierwszym użyciu w sieci (świadomy kompromis, 2026-10-17).

**Testy.** `e2e/bundle.spec.ts` (oba progi zielone, pomiar w komentarzu), `e2e/pwa.spec.ts`, rysowanie w notatce
(`card-images.spec.ts`), nowy test „Znajdź i zamień” (`editor-keys.spec.ts`), własny szablon (`templates-bulk.spec.ts`),
kopia zapasowa (`images.spec.ts`, `search-backup.spec.ts`, `private-notes.spec.ts`), `study.spec.ts`, `composer.spec.ts`
— 66/66 + 1/1; Vitest 1291/1291.

**Commit.** `3d31b58`, `a7bfb5a` (czytnik, 2026-10-16). Testy czytnika po zmianie: `reader`, `reader-step`,
`note-links`, `note-props-view`, `routes`, `subpages`, `wiki-heading`, `wikilinks`, `attachments`, `board-table`,
`reminders-calendar`, `toggle-group`, `search-highlight`, `bundle` — 56/56; telefon (`mobile`, `mobile-layout`) 17/17.

## Porządki — ostrzeżenia lintera w Notatkach, Kalendarzu i Grafiku

**Co robi.** Bez zmiany działania dla użytkownika: poprawione trzy realne ostrzeżenia `react-hooks/exhaustive-deps` i jeden nieużywany parametr. Pozostałe ostrzeżenia `react-refresh/only-export-components` (stałe eksportowane obok komponentów w `ui/*`, `ColorPicker`, `MarkdownRenderer` i inne) zostają świadomie.

**Gdzie jest.**
- `src/hooks/useNotes.ts`: `withDescendants`, `restoreSet`, `trashBranch` przeniesione z wnętrza `useNotes()` na poziom modułu (przed `useNotes`). Zależą tylko od `yjsStore` i `descendantIds`, więc nie potrzebują stanu hooka. `trashNote` i `bulkTrash` nie mają już brakującej zależności.
- `src/components/AddNoteBar.tsx`: `commit` (`useCallback`) ma w zależnościach `parentOptions`, bo czyta je przy zapisie. Wcześniej przy zmianie listy rodziców zapisywał z nieaktualną listą.
- `src/components/shifts/YearSummaryDialog.tsx`: `LeaveMeter` bez nieużywanego `compact`; `src/components/shifts/ShiftSummary.tsx` nie przekazuje już tej prop.

**Testy.** `npm run typecheck` czysty, `npx eslint .` 0 błędów (11 ostrzeżeń `react-refresh`), `npx vitest run` 144 pliki zielone. E2e wybrane (`subpages`, `composer`, `notes`, `editing`, `note-groups`, `qol`) 21/21 przy jednym workerze.

## Wydajność — panel statusu synchronizacji leniwie (2026-10-18)

- **Co robi:** panel po stuknięciu pigułki statusu zapisu (`OfflineQueuePanel`) ładuje się przy pierwszym otwarciu i zostaje zamontowany (animacja zamykania działa).
- **Gdzie jest:** `src/components/OfflineStatus.tsx` (`lazy`, `panelMounted`).
- **Dlaczego:** funkcje mobilne dodały ok. 1,1 KB do wejściowego JS; przed nimi zapas do progu 384 KB wynosił ok. 0,5 KB. Po przeniesieniu panelu wejściowy JS to 393 200 B przy progu 393 216 B — **zapas 16 B**; następna zmiana w głównej paczce musi czymś się zrównoważyć.

## Poprawki po audycie (2026-10-18)

- **Paczka:** `vendor-radix` w `manualChunks` zostawiony — próba usunięcia powiększyła wejściowy JS o 1,5 KB (Radix trafia do `index`). Zmiana cofnięta.
- **Usunięte pliki:** `public/placeholder.svg` (bez odwołań, wypadł z precache), `src/components/ui/skeleton.tsx` (bez importów).
- **Logowanie błędów:** `study/data.ts` (`legacyStudyMerged`), `privateNotes.ts` (`readThrottle` — uszkodzony licznik prób hasła), zapis z `logDiag`. Parser w `notesStore.ts` bez logu — dodanie przekroczyłoby budżet paczki o 14 B.
- **Etykiety:** przełącznik motywu ma stałą nazwę „Tryb ciemny” z `aria-pressed` (AppHeader, AppSidebar); pasek boczny z tą samą etykietą widoczną; „Import i eksport” → „Import / Eksport” w dolnym menu; „Nie dało się” → „Nie udało się” (`ViewErrorBoundary`).
- **Korekty audytu:** „Widok i kolumny” nie występuje dwa razy naraz (inna gałąź telefon/komputer); `aria-expanded` na filtrach i sortowaniu ustawia Radix; `ui/calendar.tsx` i `ui/overlay-back.tsx` są używane.
- **Budżet:** wejściowy JS 393 208 B przy progu 393 216 B (zapas 8 B).

## Budżet paczki startowej — próg 386 KB (decyzja właściciela, 2026-10-19)

- **Co zmieniono:** próg wejściowego JS (gzip) w `e2e/bundle.spec.ts` podniesiony z 385 do 386 KB.
- **Dlaczego:** po funkcjach Długów, pasku „+” i poprawkach pustych stanów paczka startowa ma 385,4 KB. Właściciel projektu zdecydował o podniesieniu progu zamiast przenoszenia arkusza „Nowa” do leniwego modułu.
- **Testy:** `e2e/bundle.spec.ts`: 6/6.
- **Commit:** edec40f, 2026-10-19.

## Budżet paczki startowej — próg 388 KB (decyzja właściciela, 2026-10-19)

- **Co zmieniono:** próg wejściowego JS (gzip) w `e2e/bundle.spec.ts` podniesiony z 387 do 388 KB.
- **Dlaczego:** po raporcie pominiętych załączników w oknie przywracania paczka startowa ma 396 282 B (387,0 KB), czyli 6 B zapasu przy progu 387 KB. Właściciel zdecydował o podniesieniu progu, żeby kolejne zmiany (P6, T4) miały miejsce.
- **Testy:** `e2e/bundle.spec.ts`: 6/6.
- **Commit:** 647f312 (próg 387 KB), podniesienie do 388 KB — w commicie z tym wpisem, 2026-10-19.

## E2E — stabilność przy pełnym obciążeniu (punkt 1, 2026-10-19)

- **Co zmieniono:** limit testu w `playwright.config.ts` podniesiony do 60 s (pierwszy `goto` w `beforeEach` na obciążonym przebiegu przekraczał 30 s); asercja „bez internetu” w `e2e/shifts.spec.ts` ma limit 15 s.
- **Dlaczego:** trzy testy (skrzynka, tryb budowa na iPhonie, Grafik offline) padały tylko w pełnym przebiegu i przechodziły przy ponownym uruchomieniu.
- **Stan weryfikacji:** pełny przebieg e2e nie został dotąd zakończony bez przerwania (brak pamięci). Zmiany sprawdzone osobno: `shifts`, `routes` i powiązane specy przechodzą.
- **Commit:** bdba60c, 2026-10-19.

## Bramka jakości — `npm run check` (Plan-nowy 1.3, 2026-11-03)

- **Co robi:** jedno polecenie przed pushem. Po kolei uruchamia `typecheck`, `lint`, Vitest (`npm test`) i e2e `@smoke` (`test:e2e:smoke`) i zatrzymuje się na pierwszym błędzie (`&&`).
- **Gdzie:** `package.json` (skrypt `check`).
- **Czas (2026-11-03):** około 5,5 min. Typecheck i lint zajmują około 1 min, Vitest (393 pliki, 3007 testów) około 1,5 min, a smoke (41 testów, komputer i telefon) 2,6 min. Cel 3 min z planu nie jest jeszcze spełniony.
- **Lint:** 0 błędów i 21 starych ostrzeżeń (Fast Refresh, zależności hooków). Cztery błędy `no-unused-expressions` w e2e (`appearance-code`, `night-skin`, `seasons`, `skins`) wzięły się z dwóch `localStorage.setItem` połączonych przecinkiem w nawiasie. Teraz to dwie osobne instrukcje.
- **Chwiejny próg czasu:** test „D1: łączenie odcinków jest liniowe” w `src/lib/plans/security.test.ts` miał próg 1,5 s i padał przy pełnym przebiegu równoległym. Próg wynosi teraz 5 s. Nadal wykrywa wersję kwadratową, która przy 10 000 kawałkach trwałaby dziesiątki sekund.
- **Commit:** zobacz `git log --grep "npm run check"`, 2026-11-03.

## Przegląd kodu — niskie punkty L1–L20 (2026-10-20)

Poprawki z przeglądu kodu z 2026-10-20 (`code-review-2026-10-20.md`, usunięty — patrz „Dokumenty usunięte”). Opisy działów Ćwiczeń, Długów, Grafiku, Skrzynki i Ustawień zostały przepisane do stanu aktualnego (sekcje „stan aktualny”); poniżej lista zmian z tego przeglądu.

- **Kopia (L1).** `src/lib/exportNotes.ts`: `errName(err)` — komunikaty `logDiag` przy przywracaniu zawierają tylko nazwę błędu, bez treści kopii.
- **Ćwiczenia (L3, L4, L6, L7).** `src/components/cwiczenia/TrainingSection.tsx`: `EquipmentForm` zapisuje tylko wartość > 0, ma przycisk „Usuń limit”; formularze godziny przypomnienia i ciężaru synchronizują się z danymi z Yjs. `src/lib/diet/yDiet.ts`: `getGoals` zwraca zamrożony obiekt z cache, `restore` pilnuje `DIET_MAX_MEALS` i zwraca `boolean`. `nextReminderAt` przeniesiono do `src/lib/timeOfDay.ts` (dawniej `lib/supplements/model.ts`); importy w `CwiczeniaView.tsx`, `TrainingSection.tsx` i `model.test.ts` zmienione.
- **Długi (L9).** `src/lib/debts/yDebts.ts` `remove`: uszkodzony wpis (`cleanDebt` → `null`) jest usuwany z mapy, nie zajmuje miejsca w limicie.
- **Grafik (L12–L15).** `src/lib/shifts/store.ts`: `instanceFor(id)` z cache zamiast nowego `createYShifts` przy każdym odczycie. `src/lib/shifts/monthImage.ts`: kwota zarobku przez `formatMoney`. `src/lib/shifts/monthImageDraw.ts`: fallback `roundRect` na `rect`, `URL.revokeObjectURL` po 1 s, `canvasToPng` synchroniczny (`toDataURL`), żeby `navigator.share` ruszyło w tym samym kliknięciu; `ShiftsView.tsx` dociąga moduły obrazu przy wejściu w Grafik. `src/components/shifts/ShiftSummary.tsx` `BonusPanel`: `toast.error` przy nieudanym zapisie premii.
- **Notatki (L8).** `src/lib/noteSchema.ts`: usunięty BOM na początku pliku.
- **Testy.** Istniejące: `src/lib/debts/yDebts.edit.test.ts` (L11), `src/lib/shifts/reviewFixes.test.ts`, `src/lib/training/reminderRestore.test.ts`. Nowych testów tej serii nie dodano.
- **Ograniczenia.** L14: udostępnianie obrazu wymaga sprawdzenia na telefonie (kod jest synchroniczny do `navigator.share`). L17: asercje w `e2e/bundle.spec.ts` nie są uruchomione. Paczka startowa: 392,2 KB gzip (próg 393 KB).
- **Commit:** `1b8bcf8` (2026-10-20, L1–L20).
- **Commit (L14, udostępnianie):** `1380f10` (2026-10-20).

## Plan działów — Fala 1 (błędy i utrata danych, 2026-10-22)

Źródło: `docs/plan-dzialy-2026-10-22.md`. Commit: 25acf6c (2026-10-25).

- **Grafik — noc zmiany czasu.** Komórka siatki, okno dnia i widok tygodnia liczą czas przez `entryMinutesOn(type, entry, dzień)` (`src/components/shifts/ShiftMonthGrid.tsx`, `DayDialog.tsx`, `ShiftWeekView.tsx`), więc 25.10 pokazuje 9 h jak rachunek. Test: `src/lib/shifts/shifts.test.ts`.
- **Grafik — start = koniec.** `ShiftTypeDialog.tsx` (`sameHours`) i `DayDialog.tsx` (`customOk`, `invalid`) odrzucają równe godziny zamiast zapisać 24 h.
- **Grafik — `.ics` wielu grafików.** `src/lib/shifts/ics.ts`: `icsScope(scheduleId)` daje klucz listy wysłanych dni i prefiks UID. Grafik główny zachowuje dawne wartości (`shift-…`, `kaczy:shifts.icsExported`), pozostałe mają własne. `ShiftsView.tsx` `exportIcs` używa zakresu aktywnego grafiku. Test: `shifts.test.ts`.
- **Grafik — „Skończyłem teraz” po końcu zmiany.** `summary.ts` `recentlyEndedShift` (okno `FINISH_GRACE_MS` = 4 h); `NowCard.tsx` `EndedCard` pokazuje zakończoną zmianę z przyciskiem. Test: `shifts.test.ts`.
- **Terminy — „Jutro” i „+1 h” na kaflu.** `NoteCardBody.tsx` używa `snoozeTarget` (odłożenie jednego wystąpienia), zamiast przesuwać całą serię.
- **Terminy — stary termin w pickerze.** `ReminderPicker.tsx` `openChange` odświeża stan z notatki przy każdym otwarciu.
- **Kalendarz — edycja odłożonego wystąpienia.** `ReminderCalendarView.tsx` `openEdit` przekazuje `base` (termin serii), `handleAttach` zapisuje go z powrotem; `ReminderQuickAddDialog.tsx` `handleSaveEdit` przekazuje `edit.base`. Seria nie przesuwa się. Przeciągnięcie takiego wystąpienia (`moveToDay`) też zachowuje bazę, o ile nowy czas nie wypada po następnym terminie serii; dialog edycji zachowuje bazę zawsze (ograniczenie: po przesunięciu za następny termin serii baza zostaje — do decyzji, czy też zdjąć). Testy: brak automatycznego testu tej ścieżki (logika w komponencie), sprawdzić ręcznie.
- **Kalendarz — godzina z języka naturalnego.** `ReminderQuickAddDialog.tsx` (`parsed`): godzina zaraz po dacie („jutro 15:00”, „jutro o 15”) trafia do pola czasu, nie do tytułu. Samotna liczba („jutro 2 kupić”) nie jest godziną. Bez osobnego testu jednostkowego (logika w komponencie); sprawdzone ręcznie tylko w testach istniejących.
- **Kalendarz — renderowanie siatki (K5.1).** `MonthGrid.tsx`: tygodnie liczone `useMemo` po miesiącu (te same obiekty `Date`), `cellRefFor(key)` zwraca tę samą funkcję ref dla dnia, pusty dzień dostaje stałą `NO_OCCURRENCES`. `DayCell.tsx` eksportuje `memo(DayCellView)`. Rodzic `ReminderCalendarView.tsx`: `studyOf` przez `useCallback`, `openAdd` przez `useCallback`, `shiftOf` buduje typy dni raz na zmianę grafiku (`dayType` tworzy nowy obiekt), `notesById` zamiast `notes.find`. Test `MonthGrid.test.tsx` liczy renderery komórek: przy zmianie zaznaczenia 2 (było 35). Duplikat `expandOccurrences` w `UpcomingDays` zostaje — jego okno (dziś i jutro) nie zawsze mieści się w siatce.
- **Kalendarz — podział widoku (K5.2).** `ReminderCalendarView.tsx` (zostają stan, dane i siatka) korzysta z trzech modułów bez zmiany zachowania: `CalendarHeader.tsx` (pasek miesiąca: strzałki, „Dziś”, skróty; druk i .ics w akcjach główki, nowy plan 1.1; props `onPrev`/`onNext`/`onToday`/`onToggleKeys`/`onPrint`/`onExportAll`), `useCalendarMoves.ts` (hook: `handleAttach`, `handleSkip`, `handleClear`, `moveToDay`, `handleDragEnd`, a w środku `previousOf` i `focusDay`; cofnięcia w toastach dostają poprzedni koniec serii), `calendarExport.ts` (`exportOneReminder`, `exportAllReminders`). `openSeriesSource` i `sensors` zostają w widoku, bo dotyczą dialogu i DnD. Testy: istniejące testy kalendarza (`src/components/calendar/*.test.tsx`) przechodzą; brak osobnych testów nowych modułów.
- **Kalendarz — zaległe terminy (K1.1).** `ReminderChip.tsx`: zaległy chip ma czerwony ton i lewą krawędź (`border-l-destructive`), a w opisie dla czytnika słowo „zaległe”. Status liczy `isOverdueOccurrence` (`src/lib/dueTerms.ts`, oparte na `termStatus`, tym samym co licznik i widok Terminy). `DayCell.tsx`: na telefonie kropka zaległego jest czerwonym kwadratem (`rounded-[1px]`), żeby nie mylić jej z kołem świąt. Test: `ReminderChip.test.tsx`.
- **.ics — cały dzień i odłożone serie (K1.2, K1.3).** `src/lib/icsExport.ts`: termin „cały dzień” to `DTSTART;VALUE=DATE` i `DTEND;VALUE=DATE` (dzień następny), alarm `TRIGGER;VALUE=DATE-TIME` o 9:00, a `UNTIL` serii jako data. Odłożone wystąpienie serii: wydarzenie główne zaczyna się od `reminderBase`, a to jedno wystąpienie to osobny VEVENT z `RECURRENCE-ID` i nowym `DTSTART`. `exportableReminders` pomija serie z `reminderRepeatUntil` przed dziś. Testy: `src/lib/icsExport.test.ts` (także powrót przez `parseIcs` z `icsImport.ts`: cały dzień wraca jako 9:00). Importer ignoruje `RECURRENCE-ID`, więc odłożone wystąpienie wraca jako osobny termin, nie jako zdublowana seria.
- **Dotyk i pickery (K1.4).** Wiersz „Cały dzień” ma `coarse:min-h-11` (44 px) w `ReminderQuickAddDialog.tsx` i `ReminderPicker.tsx`, a checkbox na dotyku `coarse:size-5`. Kalendarzyk w pickerze nie wyłącza już przeszłych dni (K-1: zapis z ostrzeżeniem).
- **Dostępność kalendarza (K1.6).** Jedyny region `role="status"` (`aria-live="polite"`, sr-only) w `ReminderCalendarView.tsx` ogłasza miesiąc i wybrany dzień. Nagłówek miesiąca (`CalendarHeader.tsx`) i nagłówek panelu dnia (`DayPanel.tsx`) nie mają już `aria-live`. Przycisk „Dziś” ma nazwę „Dziś: wróć do bieżącego miesiąca”, bo widoczny tekst musi być w nazwie (WCAG 2.5.3). Brak adresu dnia `?dzien=` (K1.5, nie zrobione).
- **Kalendarz — codzienna praca (K2).** (1) `ReminderCalendarView.tsx`: wybrany widok telefonu (Miesiąc/Tydzień/Lista) zapamiętany w `localStorage` pod `kaczy.calendar.phoneView` (`readPhoneView`, `writePhoneView`; błąd dostępu = miesiąc). (2) Stuknięcie dnia w siatce na telefonie przewija do panelu dnia (`id="calendar-day-panel"`, `selectGridDay`; przy `prefers-reduced-motion` bez animacji). (3) Dwuklik dnia i przytrzymanie na dotyku (500 ms) otwierają dodawanie na ten dzień: `DayCell.tsx` (`onActivate`, `onPressStart`); przytrzymanie nie startuje na chipie (`aria-roledescription="draggable"`), a klik po przytrzymaniu nie zmienia zaznaczenia. Test: `MonthGrid.test.tsx` (dwuklik). (4) Skróty w siatce bez modyfikatorów: `T` dziś, `N`/`P` następny i poprzedni miesiąc, `C` nowy termin; wpisane do `src/lib/shortcuts.ts` (grupa „Kalendarz”). `N`/`P` i `C` dublują PageDown/PageUp i Enter. (5) Gest palcem: poziome przeciągnięcie ≥ 60 px w siatce zmienia miesiąc (`onSwipeStart`/`onSwipeEnd`, kontener `display: contents`); chipy są wyłączone. (6) K2.1: w panelu dnia przycisk „Otwórz notatkę” (`DayPanel.tsx`, `onOpenNote`) → `ReminderCalendarView` → `Index.tsx` (`openNote`). Brak w dialogu terminu i brak „Wstecz na ten dzień” (zależy od K1.5). Nie zrobione: K1.5, K2.7 (oś godzin, rozmiar M).
- **Kalendarz — oś godzin z nocką (K2.7).** `src/lib/dayTimeline.ts`: `carryPieces(prevShift)` bierze część zmiany z poprzedniego dnia, która wchodzi po północy (nocka 22–6 rysuje się 22–24 wieczorem i 0–6 rano), a `clockOf` daje godzinę HH:MM także po 24:00. `DayTimeline.tsx` rysuje przerwę jako podpis „przerwa 11:00–11:30” w wierszu jej godziny, nie tylko jaśniejszym paskiem. Przepływ: `ReminderCalendarView` → `prevShift={shiftOf(dzień − 1)}` → `DayPanel` → `DayTimeline`. Testy: `src/lib/dayTimeline.test.ts`.
- **Kalendarz — „Otwórz notatkę” w dialogu (K2.1).** W trybie edycji `ReminderQuickAddDialog.tsx` jest przycisk „Otwórz notatkę” (`onOpenNote`), który zamyka dialog i otwiera notatkę tego terminu.
- **Kalendarz — adres dnia (K1.5).** `src/lib/viewRoute.ts`: `calendarDayFromSearch` czyta `?dzien=YYYY-MM-DD` (zły format = brak). `ReminderCalendarView.tsx` przy zamontowaniu ustawia wybrany dzień i miesiąc, a potem zdejmuje parametr z adresu (`replaceState`). Przed otwarciem notatki z kalendarza (`openNoteFromCalendar`, panel dnia i dialog) adres dostaje bieżący dzień, więc „wstecz” z notatki wraca na ten sam dzień. Dokończenie (2026-10-27): paleta poleceń ma grupę „Kalendarz” z „Terminy na dziś” i „Terminy na jutro” (`CommandPalette.tsx`), które wchodzą na `/kalendarz?dzien=…`. Widok reaguje też, gdy już jest otwarty (`useLocation` + `navigate(…, { replace: true })`). Nie robione z powodu, że nie ma tam dnia do linkowania: push o terminie otwiera notatkę (`notePath`), push „Jutro” z Grafiku prowadzi do `/grafik`, a sekcja „Dziś / Jutro” w kalendarzu jest już w tym widoku. Testy: `src/lib/viewRoute.test.ts` (format adresu); brak testu palety i przejścia w przeglądarce (do e2e).
- **Kalendarz — znaczniki Pracy i tytuły w pasku tygodnia (K3.1).** `WeekStrip.tsx`: na komputerze pod numerem dnia jest tytuł pierwszego terminu (`max-sm:hidden`, na telefonie zostaje liczba), a przy wizytach i dostawach ikona z liczbą (`HardHat`), jak w komórce miesiąca; opis dnia dla czytnika zawiera `studySummary`. `UpcomingDays.tsx`: karta „Dziś/Jutro” ma wiersz „Praca: …”. Dane z `studyOf` widoku (`useStudyDayMarks`).
- **Kalendarz — termin w czasie zmiany (K3.4).** `src/lib/shifts/reminderConflict.ts`: `atWorkingHours(at, shift)` — czy godzina terminu wypada w części zmiany tego dnia (urlop i brak zmiany = nie). `ReminderQuickAddDialog.tsx` pokazuje nieblokujące ostrzeżenie „Ten termin wypada w czasie zmiany: …”, dane z `shiftOf` widoku. Część nocki z poprzedniego dnia nie jest sprawdzana. Testy: `src/lib/shifts/reminderConflict.test.ts`. Znacznik przy chipie w liście nie zrobiony.
- **Kalendarz — agenda na komputerze (K3.2).** `ReminderCalendarView.tsx`: przełącznik „Siatka | Lista | Oś tygodnia” (`desktopAgenda`, `weekAxis`; Lista od `sm`, Oś tylko od `xl`) zamienia siatkę na listę miesiąca albo na oś tygodnia (K3.6). Telefon ma widok Lista jak dotąd (`phoneView`). `MonthAgenda.tsx` pokazuje dni z terminem, zmianą albo Pracą (`studyOf`, „Praca: …”). Stuknięcie dnia wybiera go i przewija do panelu (`selectGridDay`), nie przełącza na Miesiąc. Lista nie jest jeszcze wspólna z `CalendarPrintList` (osobna zmiana na model wierszy).
- **Kalendarz — warstwy i liczniki (K3.3).** `src/lib/calendarLayers.ts`: `terms`, `shifts`, `work`, `holidays`; wybór w `localStorage` pod `kaczy.calendar.layers` (błąd = wszystkie włączone), `countMonth` liczy wystąpienia i dni każdej warstwy. Pasek „Terminy · Grafik · Praca · Święta” z licznikami w `ReminderCalendarView.tsx` (`aria-pressed`, klik przełącza). Wyłączona warstwa zabiera dane siatce, paskowi tygodnia i agendzie (`shownByDay`, `shownShiftOf`, `shownStudyOf`), a święta idą do `DayCell` jako `showHolidays`. Panel dnia i karty „Dziś/Jutro” nie filtrują. Testy: `src/lib/calendarLayers.test.ts`.
- **Kalendarz — podgląd notatki i szukanie terminów (K3.5).** `src/lib/notePreview.ts`: `notePreview(note)` daje tytuł i początek treści (160 znaków, z wielokropkiem); notatka prywatna pokazuje tylko „Notatka prywatna”, bez treści. `ReminderCalendarView.tsx` buduje `previewOf` (`notesById`) i podaje go przez `MonthGrid` do `DayCell`, gdzie `DraggableChip` owija chip w `Tooltip` z `ui/tooltip` (Radix, bez nowej zależności). Po dotyku dymek się nie otwiera; natywny `title` chipa jest wtedy wyłączony (`nativeTitle={false}`), żeby nie było dwóch dymków. Szukanie: pole „Szukaj terminów” w pasku warstw filtruje wystąpienia notatek pasujących przez `searchNotes` (nie dotyczy panelu dnia ani listy). Testy: `src/lib/notePreview.test.ts`. Podgląd w agendzie i na pasku tygodnia nie jest zrobiony.
- **Kalendarz — tydzień z osią godzin na xl (K3.6).** `src/components/calendar/WeekTimeline.tsx` (ładowany leniwie, osobny chunk ~6 kB): siedem kolumn od poniedziałku, w każdej pasek zmiany z Grafiku (z nocką z poprzedniego dnia, przerwa jaśniejsza) i terminy w swojej godzinie, „cały dzień” nad osią, linia „teraz” w dzisiejszej kolumnie. Przeciąganie myszą: w pionie zmienia godzinę (pełne godziny), w poziomie dzień; próg 6 px odróżnia przeciągnięcie od kliku (klik edytuje). Przeciągany chip ma `pointer-events: none`, bo zostaje w DOM swojej kolumny i bez tego `elementFromPoint` trafiałby w niego. Shift+←/→ przesuwa o dzień jak w liście. Każde przeniesienie idzie przez `moveToHour` / `moveToInstant` w `useCalendarMoves.ts` i ma „Cofnij”. Czysta logika: `src/lib/weekAxis.ts` (`weekAxisHours`, `axisPercent`, `retimedAt`). Ograniczenia: godziny to pełne godziny (bez 15-minutowego kroku), chipy z tej samej godziny układają się jeden pod drugim (26 px każdy), prognozy serii nie przeciągają się. Telefon nie ma tego widoku (przycisk `max-xl:hidden`). Testy: `src/lib/weekAxis.test.ts`; e2e `e2e/calendar-week-axis.spec.ts` (przeciągnięcie środa 15:00 → piątek 17:00, axe WCAG 2.2 AA, brak przycisku na telefonie).
- **Kalendarz — wygląd, zeszyt (K4).** Kierunek: kartka z zeszytu. Podstawa to istniejące tokeny (`index.css`): `--margin` (czerwony margines zeszytu) jest jedynym akcentem linii „teraz”. (1) K4.2: chip terminu ma tokeny `--chip-bg`, `--chip-ink`, `--chip-edge` w obu motywach zamiast przezroczystości marki (`ReminderChip.tsx`); `src/lib/contrastTokens.test.ts` pilnuje tekstu ≥4,5:1 i obwódki ≥3:1. (2) K4.3: komórka dnia ma `rounded-card` (`dayCellStyles.ts`), a na telefonie kolor zmiany jest dolnym paskiem 3 px (`DayCell.tsx`, `sm:hidden`). (3) K4.4: linia „teraz” na osi dnia (`DayTimeline.tsx`, `showNow` z `DayPanel`): czerwona linia z godziną HH:MM w wierszu bieżącej godziny, przesuwa się co minutę, przewija do siebie przy otwarciu (wyłączone przy redukcji ruchu). (4) K4.6: rok w nagłówku przyciemniony, gdy to bieżący rok; „Dziś” jest pigułką akcentu tylko poza bieżącym miesiącem (`CalendarHeader.tsx`). (5) K4.1: kształty stanów — kwadrat dla zaległego, pusty krąg dla prognozy serii, kropka dla zapisanego terminu, pasek dla zmiany z Grafiku; zwijana legenda `CalendarLegend.tsx` (`<details>`, testid `calendar-legend`). Termin „cały dzień” to pasek: ostre rogi i dolna krawędź z cienia wewnętrznego (`shadow-[inset_0_-2px_0_var(--chip-ink)]`, nie `border-b`, bo `border-transparent` w `cn` by ją skasował), a zamiast godziny napis „cały dzień” (`ReminderChip.tsx`; testy `ReminderChip.test.tsx`, e2e `calendar-phase2`, `composer-reminder`). (6) K4.5: wybór dnia (siatka, agenda, tydzień) idzie przez `pickDay` w `ReminderCalendarView.tsx` (`startViewTransition` + `flushSync`, `useCallback`, bo siatka jest zmemoizowana). Podświetlenie zaznaczonego dnia ma `view-transition-name: day-active` (`DayCell.tsx`), panel dnia `day-panel`. CSS w `index.css`: panel wjeżdża z dołu (12 px, 0,22 s), a przy `data-motion="reduced"` zostaje samo przenikanie, a podświetlenie przeskakuje bez ruchu. Przełącznik ruchu z aplikacji działa tu, nie tylko `prefers-reduced-motion`. Odstępstwo od planu: panel nie „wychodzi z komórki” (morph z małej komórki do dużego panelu wyglądałby źle); z komórki przesuwa się podświetlenie. Test: `e2e/calendar-day-transition.spec.ts` (liczy wywołania przejścia, zwykły i redukcja ruchu). Nie zrobione: K4.3 w części zapytania kontenerowego i 44 px na 320 px (komórka ma już min-h-14). Wygląd nie był sprawdzony w przeglądarce (zrzuty po e2e).
- **Skrzynka.** `InboxCapture.tsx` to wieloliniowe pole: Enter zapisuje, Shift+Enter nowa linia, widoczny fokus (`focus-within`). `inbox.ts` `captureParts`: za długa pierwsza linia nie ginie — początek to tytuł, reszta idzie do treści. `Index.tsx` `expandAddNote`: w Skrzynce „+” ustawia kursor w polu zamiast przechodzić do Notatek. Testy: `InboxCapture.test.tsx`.
- **Dziennik — dyktowanie.** `JournalEntrySheet.tsx`: braki bez budowy nie przerywają zapisu tekstu; błąd pokazywany po dopisaniu treści.
- **Dziennik — nagrania i podpis.** `StudyJournal.tsx`: nagrania wpisu widoczne na liście (`AudioPreview`, leniwie); podpis „Nagranie” / „Zdjęcie” / „Wpis” zamiast „Sprawdzone punkty listy” przy samym zdjęciu.
- **Dziennik — zamknięcie karty budowy.** `SiteCardDialog.tsx` `close`: zamknięcie z niezapisaną zmianą zapisuje kartę (toast potwierdza).
- **Dziennik — zdjęcia.** `JournalEntrySheet.tsx`: przyciski na zdjęciu mają 44 px pola dotyku na telefonie (`coarse:after:`), usunięcie zdjęcia ma „Cofnij” (zdjęcie wraca na swoje miejsce).
- **Dziennik i Nauka — „na dziś” po północy.** `useDayClock()` w `StudyView.tsx` (`DueTodayChip`), `QuizPanel.tsx`, `StudyBoard.tsx`, `StudyJournal.tsx` (przypomnienia i licznik „7 dni: N wpisów”, Etap 0.5 planu 2026-10-24).
- **Ćwiczenia — godzina przypomnienia.** `TrainingSection.tsx`: zapis przy wyjściu z pola (albo Enter), nie przy każdym znaku — wcześniej każdy znak przenosił notatkę do kosza.
- **Ćwiczenia — ciężar.** `parseKg`: wartość spoza kroku 0,5 kg jest odrzucana z komunikatem, zamiast zapisać zaokrągloną po cichu.
- **Długi — pasek spłaty.** `src/lib/debts/model.ts` `repaidShare(entries)`: liczy spłatę z obu stron salda, 100% tylko przy zerze, `floor` (maks. 99). Test: `model.test.ts`. Kolory historii (`DebtsView.tsx`) zgodne z listą.
- **Skarbiec — wykrycie rozjazdu.** `privateNotes.ts`: sesja pamięta odcisk metadanych (`sessionFingerprint`: epoch, sól, klucz opakowany, kod sprawdzający). Sam `epoch` nie wystarcza — dwa skarbce założone offline mają oba epoch 1. Test: `privateNotes.test.ts` („dwa skarbce założone offline…”).

Testy zielone: `npx vitest run` 1826/1826, `npx eslint .` bez błędów (16 ostrzeżeń jak przed zmianami), e2e działów: `entry-check`, `study`, `journal-*`, `entry-dictation`, `shifts*`, `calendar-shift-edit`, `reminders-calendar`, `inbox-today`, `site-*`, `today-study`, `private-notes`, `mobile-layout`.

**Budżet paczki startowej: przekroczony** (410 791 B wobec progu 410 624 B, +167 B). Zmiany w komponentach ładowanych od razu: `ReminderPicker.tsx` (~52 B), `Index.tsx` (~19 B), `NoteCardBody.tsx` (~20 B) i drobne pozostałe. Próg podnosi wyłącznie właściciel — decyzja otwarta.

## Plan działów — Fala 3 (dostępność, częściowo, 2026-10-22)

- **Karty notatek:** `ActionBtn` przekazuje `aria-pressed` do DOM i ma `type="button"`; ulubione mają stan (`NoteCardActions.tsx`).
- **Pigułka zapisu** (`OfflineStatus.tsx`): przycisk bez roli `status`; komunikat w osobnym `sr-only` z `role="status"` brzmi „Stan zapisu: …” (prefiks, żeby nie powielać widocznego napisu w DOM — testy szukają go dokładnie); w stanie biernym pigułka nie łapie fokusu.
- **Quiz — fokus po odpowiedzi** (`study/QuizPanel.tsx`): po wyborze odpowiedzi fokus przechodzi na „Dalej” (przyciski odpowiedzi stają się `disabled`); po „Dalej” na nagłówek pytania (`tabIndex=-1`). Testy: `e2e/study.spec.ts`, `e2e/today-study.spec.ts` (30/30 desktop, 3/3 iPhone 14).
- **Pasek boczny na telefonie** (`AppSidebar.tsx`): rola `dialog`, `aria-modal`, fokus wchodzi do środka, Tab zapętla się, Esc zamyka, fokus wraca na przycisk otwierający.
- **Płótno rysowania** (`DrawingCanvas.tsx`): przyciski narzędzi i kolory mają nazwy i `aria-pressed`.
- **Tryb skupienia** (`FocusMode.tsx`) i **przypomnienie** (`ReminderPicker.tsx`): nazwane przyciski zamknięcia i usunięcia.
- **Licznik przerwy** (`TrainingSection.tsx`): czytnik ogłasza tylko koniec przerwy.
- **Skarbiec** (`VaultDialogs.tsx`): miernik hasła ogłasza zmianę poziomu, nie każdy znak; natywne pola wyboru zamienione na `Checkbox` (większe na dotyku).
- **Skarbiec — minimum hasła (V-1, V-2, 2026-10-26).** `MIN_PASSWORD_LENGTH` w `vault.ts` to 12 znaków, a `passwordStrength(...).ok` wymaga poziomu „Średnie” (score ≥ 2), więc „Słabe” nie przechodzi. Minimum dotyczy tylko zakładania i zmiany hasła; odblokowanie nie sprawdza długości, więc stare, krótsze hasła działają. Odblokowanie ma `autoComplete="current-password"` i ukryte pole loginu „Skarbiec hydra” (`autoComplete="username"`), żeby menedżer haseł wiedział, do czego hasło. Testy: `src/lib/vault.test.ts`, e2e `private-notes.spec.ts`.
- **Nazwy plików kopii (U-1, 2026-10-26).** Pełna kopia i zwykły eksport JSON: `hydra-kopia-…json`; kopia sprzed przywrócenia: `hydra-przed-przywroceniem-…json`; eksport Markdown/HTML/PDF: `hydra-eksport.{md,html,pdf}`. Zmienia się tylko nazwa przy pobieraniu; format danych i odczyt starych nazw bez zmian. Test: `exportNotes.test.ts`.
- **Synchronizacja** (`SyncSettings.tsx`): stan połączenia jako `role="status"`.

Zrobione w tej sesji: fokus po odpowiedzi w quizie (patrz wyżej). Sprawdzone bez zmian: Długi już mają `role="radio"` w grupie (`DebtsView.tsx`); Ustawienia używają `aria-pressed` przy przyciskach wyboru i `Segmented` (ToggleGroup, strzałki) — zostawione.

Kalendarz: `aria-live` zostaje — nagłówek miesiąca (`ReminderCalendarView.tsx`) i dnia (`DayPanel.tsx`) ogłaszają jedną zmianę każdy; bez nich czytnik nie powiedziałby, na który dzień przeszło.

- **Czytnik notatki — podgląd niemodalny** (`NoteReader.tsx`): `aria-modal` tylko w trybie `present` (prezentacja). Podgląd (Spacja na kaflu) ma `role="dialog"` bez `aria-modal`, bo siatka pod spodem pozostaje sterowalna (`gridKeyboardNav`). Klik w tło nadal zamyka podgląd. Testy: `e2e/reader.spec.ts`, `reader-step.spec.ts`, `note-links.spec.ts`, `a11y.spec.ts` (67/67).

**Fala 3 zamknięta.**

**Commit:** `2dea8e5` (2026-10-22), poprzedni krok `c36100b`.

## Wydajność — Fala 4: leniwe okna z „Więcej” (2026-10-22)

- **Udostępnij** (`ShareNote.tsx`, `ShareNoteDialog.tsx`): przycisk na kaflu zostaje eager, okno ładuje się przy pierwszym kliknięciu i zostaje zamontowane (animacja zamknięcia). Kopiuj tekst, Kopiuj link, Udostępnij…, Pobierz .md.
- **Historia wersji** (`VersionHistory.tsx`, `VersionHistoryDialog.tsx`): ten sam wzorzec; przycisk i licznik wersji eager, lista z Markdownem leniwie. Przywrócenie zamyka okno.
- **Zysk:** wejściowy JS 411 708 B → 411 136 B (401,50 KB; próg 402 KB w `e2e/bundle.spec.ts`). Mały, bo Radix i Markdown są też w paczce startowej. `NoteLookPicker` (ikona i okładka) zostaje eager — `NoteCoverStrip` z tego samego pliku jest potrzebny na kaflu.
- **Testy:** `e2e/share-files.spec.ts`, `search-backup.spec.ts`, `reader.spec.ts`, `a11y.spec.ts` (65/65), `bundle.spec.ts` (budżet wejściowego JS).

## Plan rozbudowy — stan Fazy 0 i 1a (2026-10-23)

- **Faza 0 zamknięta.** Flagi (`src/lib/featureFlags.ts`, karta w Ustawieniach), RPC dla Workerów (`src/workers/rpc.ts`), zestaw pomiarów (`src/test/fixtures/bigVault.ts`, `e2e/perf.spec.ts` z `PERF=1`), próg paczki startowej 500 KB (decyzja właściciela, `e2e/bundle.spec.ts`). Fala 3 zamknięta wcześniej (2dea8e5).
- **Faza 1a — komponent edytora (bez podłączenia):** `src/components/editor/cmExtensions.ts` (`buildCmExtensions`, czysta konfiguracja CM6 z Markdownem i historią; bez `indentWithTab`, żeby Tab nie zatrzymał klawiatury), `src/components/editor/CmEditor.tsx` (`value`/`onChange`, widok tworzony raz, zewnętrzna zmiana `value` nadpisuje dokument). Testy: `cmExtensions.test.ts`, `CmEditor.test.tsx`. `NoteEditor.tsx` bez zmian.
- **Nie zrobione (następny krok 1a):** podłączenie `CmEditor` za flagą `cmEditor` zamiast `<textarea>`. Wymaga przepięcia `textareaRef` (50 użyć w `useNoteEditSession`, `useWikiAutocomplete`, `useSlashMenu`, `FindReplaceBar`, `EditorStats`, `AddNoteBar`, `useLiveNoteText`) na interfejs selekcji/wstawiania obsługiwany przez CM. Dopiero potem e2e na obu ścieżkach.

## Budżet precache (2026-10-26)

- Próg precache podniesiony z 3,2 do 3,4 MiB w `e2e/bundle.spec.ts` (decyzja właściciela). Po partii Terminów (parser dat, reguły DST, Skrzynka, Powłoka) było 3,20 MiB + 2,8 KB, czyli za próg. Wejściowy JS i DOM bez zmian progów.

## Budżet precache — próg 3,4 → 3,8 MiB (decyzja właściciela, 2026-10-27)

- Test `e2e/bundle.spec.ts` („budżet: precache service workera”) był przekroczony już przed sesją (3,76 MiB przy progu 3,4 MiB, potwierdzone na commicie `3e89563`). Próg podniesiony do 3,8 MiB; zmierzone 3 949 725 B (3,767 MiB, 197 plików). Przy każdym zejściu w dół obniżyć próg.
- Commit (5.1): `12c9339` (2026-10-27).
- Commit (grubsze obramowania): `8b98b77` (2026-10-27).

## Podział `pages/Index.tsx` (F3, plan mobile 2026-10-28)

- **Co zmieniono.** Z `src/pages/Index.tsx` wydzielono dwie rzeczy. (1) Definicje leniwych widoków i dialogów oraz stałą `VIEW_ORDER` przeniesiono do `src/pages/indexViews.ts` — bez zmian, te same importy dynamiczne, więc podział na paczki się nie zmienia. (2) Pięć kart widoku Dziś (Grafik, przypomnienia, Praca, powtórki, przegląd tygodnia) przeniesiono do `src/components/review/TodayCards.tsx` jako komponent `TodayCards`, który dostaje dane i akcje jako propsy.
- **Dlaczego tak.** Karty Dziś mają własne granice błędów i wąski zestaw zależności, więc wydzielenie nie zmienia zachowania. `StudyDueRows` jest też w widoku Terminy, więc jego `lazy` żyje w `TodayCards` i jest eksportowany do `Index` (jedna definicja, bez duplikatu).
- **Terminy (drugi etap).** Blok widoku Terminy (kafle/lista, nowy termin, grupy, prognoza serii) przeniesiono do `src/components/reminders/RemindersView.tsx` (`RemindersView`). Siatkę kafli dostaje jako prop `renderGrid`, bo siatka notatek nadal żyje w `Index`. `NewReminderButton` i `SeriesForecastSection` przeniesiono do tego pliku razem z blokiem.
- **Czego nie ruszono.** Siatka notatek, zaznaczanie, przeciąganie i pozostałe widoki nadal są w `Index`. Plik spadł z 1240 do ok. 1120 linii — podział jest częściowy.
- **Gdzie.** `src/pages/Index.tsx` (widżet zostaje w `Index`, bo sprawdza inny widok), `src/pages/indexViews.ts`, `src/components/review/TodayCards.tsx`, `src/components/reminders/RemindersView.tsx`.
- **Testy.** Istniejące e2e widoków, których dotyczy zmiana: `dzis-terminy`, `dzis-phone`, `today-site-card`, `inbox-today`, `reminders-calendar`, `hidden-views` — 23 przechodzą. Jeden test w `reminders-calendar` (przeciąganie terminu na inny dzień) pada też na `HEAD` przed podziałem, więc to osobny, istniejący problem. Typy i lint bez nowych błędów.

## Budżet precache po funkcjach Pracy (2026-10-28)

- Dzisiejsze funkcje przekroczyły limit precache (3,9 MiB) o ok. 7,5 KB. Zamiast podnosić limit: moduły PDF (`handoverPdf`, `reportPdf`, `pdfWriter`) ładują się dopiero po kliknięciu i są poza precache (jak jsPDF — PDF i tak potrzebuje sieci przy pierwszym użyciu), a skan kodu QR do parowania (`jsQR`, `QrScanDialog`, ok. 133 KB) też jest poza precache, bo parowanie bez sieci nie działa. Pliki poza precache trafiają do cache po pierwszym użyciu. `bundle.spec` 6/6; `sync-qr-scan`, `handover-pdf`, `report-pdf` przechodzą.

## Wydajność na telefonie: poświata, ramka zaznaczenia i deszcz Matrycy (Fala 2, 2.7 planu motywów, 2026-10-30)

- **Co robi.** Na telefonie aktywna notatka ma stałą poświatę, a zaznaczona notatka stałą ramkę zamiast obracającej się. Na komputerze i w zwykłym trybie wygląd jest jak dotąd (ramka się obraca, poświata oddycha). Matryca reaguje na zmianę „ruch ograniczony” bez przeładowania strony.
- **Gdzie.** `src/index.css`: `.note-glow-active` (mgiełka `::after` z animacją `note-glow-wash`, usunięty stary `note-glow-breathe`), `@media (pointer: coarse)` dla `.note-frame`. `src/components/skins/MatrixRain.tsx` (licznik `motionTick`, nasłuch zmiany `prefers-reduced-motion` i atrybutu `data-motion`).
- **Jak działa.** Stary oddech animował `box-shadow` co klatkę, co przemalowuje element. Teraz pierścień jest stały, a mgiełka pod nim pulsuje przez `opacity` (tańsze, bez przemalowań). Obrót ramki animował własność `@property --frame-angle`, co przemalowuje gradient co klatkę; na dotyku ramka stoi. Deszcz czytał ustawienie ruchu tylko przy montowaniu — teraz efekt wznawia się przy zmianie.
- **Co już było zrobione przed 2.7.** Zorza na telefonie nie ma `filter: blur(36px)` ani dryfu tła (`pointer: coarse` w `zorza.css`), a karta jak szyba z `backdrop-filter` działa tylko na komputerze (`pointer: fine`). Ten punkt planu nic nie wymagał.
- **Ograniczenia.** Oddech poświaty jest teraz tylko w mgiełce, a pierścień stoi. To mniej wyrazisty efekt niż dawny oddech całej poświaty — świadoma zmiana na rzecz baterii. Nie mierzyłem klatek na prawdziwym telefonie; to zostaje w QA (krok 4.4 planu motywów).
- **Testy.** Vitest: pełny zestaw. E2E: `glow`, `card-motion`, `skins`, `skin-motion`, `mobile`.
- **Commit.** `f40a2bf` (2026-10-30).

## Zależności: poprawki z npm audit (2026-11-01)

- **Co.** `npm audit --omit=dev` nie zgłasza podatności. Podniesione: `dompurify` 3.4.17 (przez `jspdf`), `react-router-dom` 7.18.4 (z 6.30), `zod` 4.6.7 (z 3.25).
- **zod przez `zod/mini`.** Jedyny użytkownik to `src/lib/noteSchema.ts` (`noteSchema`, `folderSchema`, `fullBackupSchema`), ładowany leniwie przy imporcie i przywracaniu kopii (`src/lib/exportNotes.ts`, `src/lib/import/commit.ts`). Klasyczne API zod 4 dawało chunk `noteSchema-*` 93 KB i precache ponad próg 4,0 MiB z `e2e/bundle.spec.ts`. API funkcyjne `zod/mini` (`z.catch(z.optional(...), undefined)`, `.check(z.maxLength(...))`, `z.pipe(z.unknown(), z.transform(...))`) daje 30 KB, mniej niż zod 3. Typy sprawdza `satisfies z.ZodMiniType<Note, unknown>`.
- **Zachowanie bez zmian.** Brakujące pole opcjonalne nie pojawia się w wyniku, złe pole dostaje wartość z `catch`. Zod 4 zawsze odrzuca `Infinity`, więc `.finite()` znikło bez skutku. `z.record` wymaga typu klucza.
- **Pułapka.** `npm audit fix --omit=dev` usuwa devDependencies z `node_modules` (w tym dane OCR z `public/ocr`) — po nim `npm install`. Zostają podatności tylko w narzędziach builda (`vite-plugin-pwa` → `workbox-build` → `deepmerge`, `glob`, `fast-uri`); poprawka wymaga zmiany głównej wersji `vite-plugin-pwa`, nie trafia do aplikacji.
- **Testy.** `src/lib/noteSchema.test.ts`, `src/lib/noteSchema.props.test.ts`, cały Vitest (2859), `e2e/bundle.spec.ts`, `e2e/search-backup.spec.ts`, `e2e/import-external.spec.ts`.
- **Commit.** `e364a1a` (dompurify), `e6fac15` (react-router), `04e1ba2` (zod) (2026-11-01).

## Testy e2e: stare porażki naprawione (2026-11-01)

- **Co.** 11 testów padało niezależnie od bieżących zmian. Dwa były błędami aplikacji: pamięć przewinięcia (`useViewScroll`, sekcja o przewinięciu per dział) i element chowany pod przyklejonym paskiem Wyglądu (`AppearanceSettings`, `scroll-padding-top`). Reszta to nieaktualne testy.
- **Grafik (`file-sync`, `tabs`, `leave-year`).** Od G3.1 (`75e00b7`) domyślne rodzaje to Urlop, L4, Dniówka, Budowa (`DEFAULT_SHIFT_TYPES` w `src/lib/shifts/model.ts`), a pierwszy z nich (Urlop) jest pędzlem startowym. Testy zakładały „Dzień” i „Noc”: teraz wybierają pędzel jawnie (Dniówka, Budowa), a dane testowe używają `e` zamiast `d`. Przy kolejnej zmianie domyślnych rodzajów szukać w testach nazw rodzajów.
- **`shifts.spec` (paleta → dzień).** Okno dnia jest modalne, więc tło z h1 jest ukryte przed czytnikiem; dział sprawdzany po adresie.
- **`masonry.spec` (przeciąganie).** Kolejność zapisuje się przez Yjs i przerysowuje po chwili — `expect.poll` zamiast odczytu zaraz po toaście.
- **Tylko telefon (`view-sheet-snap`, `touch-audit`).** Projekt `chromium` (komputer) uruchamia też testy `@mobile`; arkusz „Widok” i cele 44 px (`coarse:`) są tylko na telefonie, więc `test.skip(!isMobile)`.
- **Schowek na iPhone (`journal-menu`, `site-billing`).** WebKit w Playwright nie zna uprawnień `clipboard-*`: uprawnienia i odczyt schowka tylko w Chromium, na iPhone sprawdzany jest komunikat „Skopiowano”.
- **Commit.** `af41621` (2026-11-01).

## Stabilność e2e (punkt 6 planu wykończenia, 2026-11-05)

- **Wyścig skrótów kompozytora** (`src/pages/Index.tsx`, `expandAddNote`): kompozytor był otwierany raz, po 100 ms. Gdy montował się później (obciążenie), skrót („+”, „?new=list”, „N”) przepadał bez śladu. Teraz wywołanie jest ponawiane, najwyżej ok. 3 s.
- **Testy:** czekanie na gotowość zamiast stałych czasów (`toPass` dla sekwencji klawiszy w `qol`, `local-graph`, `grid-favorite-key`; czekanie na widoczność w `composer-reminder`, `jobs`, `qol-etap5`; `waitUntil: "domcontentloaded"` przy płótnie, bo pod obciążeniem „load” nie nadchodzi).
- **Znane, niewyjaśnione:** pod 3 workerami z powtórzeniami nadal pojawiają się pojedyncze porażki (np. `routes:62`, `?new=1`). Po pojedynczych uruchomieniach przechodzą. Przy pełnym przebiegu tło jest tak samo obciążone, więc to ograniczenie środowiska, nie kodu.

## Plan-nowy: 2.8, 3.4, 3.6 (2026-11-05)

- **2.8 Cele dotyku na telefonie.** `e2e/touch-targets-phone.spec.ts` przegląda widoczne elementy do stuknięcia na 7 ekranach przy 390 px (Pixel 7, iPhone 14 i emulacja w `chromium`) i wymaga co najmniej 44 × 44 px, licząc niewidzialne `::after` jak `touch-targets.spec.ts`. Poprawione cele:
  - zwinięte „⋯” w rogu kafla: `::after` o 2 px (40 → 44);
  - „×” i przycisk akcji toastu: `::after` (20 i 24 → 44);
  - „Jutro rano”, „Za godzinę” i „⋯” przy terminie: `coarse:min-w-11`;
  - „Ukryj kwoty” w Długach: `coarse:h-11`. Klasa `tap-target` działa tylko w trybie budowa.
- **3.4 ADR.** `docs/adr.md`: pięć decyzji z powodem, skutkami i miejscem w kodzie:
  - `reminderSpec` jako jedna wartość LWW;
  - CSP egzekwowane z szerokim `connect-src`;
  - Web Push z własnego serwera;
  - brak hostingu;
  - model styl × schemat × akcent.
- **3.6 Render.** W `Index.tsx`:
  - `ShiftsView` i paleta dostają zapamiętaną `reminderNotes` zamiast nowej tablicy `[...notes, ...archivedNotes]` przy każdym renderze. Wcześniej `useMemo` w palecie liczył się za każdym razem.
  - `inboxCount` to ten sam licznik co `inboxBadge` (jedno liczenie).
- **2.8 Paleta przy otwartej notatce.** Grupa „Ta notatka” (`CommandPalette.tsx`) ma oprócz „Otwórz” i „Przypnij” także „Do ulubionych” / „Usuń z ulubionych”, „Duplikuj”, „Archiwizuj” i „Do kosza”. To te same funkcje co na kaflu (`handleArchiveSingle`, `handleTrashSingle` z „Cofnij”, `duplicateNote`, `updateNote`). Dla notatki z kosza zostaje samo „Otwórz”.
- **Naprawione: Ctrl+K przy otwartym podglądzie.** Podgląd przewija treść klawiszem `k` (`handlePreviewKeys` w `gridKeyboardNav.ts`) i robił to także przy Ctrl+K, a jego `preventDefault` blokował paletę. Teraz skróty z Ctrl, Cmd albo Alt podgląd przepuszcza (paleta, Alt+←/→). Test: `e2e/palette-note-actions.spec.ts`.

## Pomiar reakcji na telefonie (Plan-nowy 3.3, 2026-11-05/06)

- **Co robi:** `e2e/web-vitals-phone.spec.ts` (Pixel 7, Chromium, `@mobile`) mierzy LCP listy notatek i najdłuższą interakcję na telefonie. Obserwatory są wstrzykiwane w teście (`installObservers`), więc aplikacja nie ma kodu pomiarowego i paczka się nie zmienia. Liczą się tylko zdarzenia z `interactionId`, jak w prawdziwym INP.
- **Jak działa:** `measureOnce` ładuje stronę, robi rozgrzewkę (pierwsze otwarcie notatki montuje edytor), zeruje rekord i wykonuje typowe stuknięcia: wyszukiwanie, Dziś i powrót, otwarcie notatki. Test powtarza to `RUNS = 5` razy i sprawdza **medianę**, nie pojedynczy przebieg. Próg: LCP < 2500 ms, najdłuższa interakcja < 300 ms (straż regresji, nie cel).
- **Ostatni wynik (2026-11-06, Pixel 7, 1 worker):** mediana LCP 344 ms; najdłuższa interakcja, mediana 256 ms, przebiegi 256, 264, 256, 296, 248 ms. Test przechodzi, ale 296 ms jest blisko progu.
- **Uwaga:** komentarz w nagłówku testu podaje wcześniejsze wyniki (LCP 1,1–1,8 s), które nie zgadzają się z ostatnim pomiarem. Przy kolejnej zmianie warto zaktualizować ten komentarz.
- **Pułapki:** przy obciążonej maszynie LCP potrafi skoczyć (raz 10,6 s). Jeśli test zacznie padać na interakcji, najpierw sprawdzić obciążenie, potem próg. Otwarcie notatki stuknięciem jest najwolniejszą interakcją; osobno do zrobienia: przyspieszyć je na telefonie.
- **WebKit** (iPhone w Playwright) pomija test: Event Timing API, na którym stoi INP, mierzy tam niewiarygodnie.

## SESJA PODSUMOWANIE

**Zrobione w CAŁEJ sesji:**
- ✅ **Faza 3 KOMPLETNA** (13 funkcji + dokumentacja)
  - 11 nowych API przeglądarki (Camera, Contact, NFC, Barcode, AI, DeviceOrientation, itp.)
  - ~1500 linii kodu
- ✅ **Faza 4 KOMPLETNA** (5 funkcji + dokumentacja)
  - Pieniądze: cennik, należności, kilometrówka, odcisk, zestawienie
  - ~600 linii kodu
- ✅ **Faza 5 START**
  - B5.2 Kompresja (~300 linii)
- ✅ **Testy unit Fazy 4** (45 testów przechodzących)
- ✅ **E2E testy** (1135 passów, 9 failów)

**Commits:** 25 nowych (3 fazy + testy + docs)
**Kod:** ~2400 linii
**Zależności npm:** 0 nowych
**HEAD:** f4a2289e

**E2E Status:**
- 1135 testów ✅
- 9 failów (głównie Pixel 7 — wydajność, integracja UI)
- 19 skipped
- 58.5 minut

**Do zrobienia (następna sesja):**
- Integracja UI Fazy 4 (Settings, Dziś, Grafik)
- Naprawy e2e failów
- Faza 5 tech (B5.1–B5.6)
- QA na telefonie

## Audyt błędów 2026-11-11 (cztery agenty, tylko odczyt) i pierwsza partia poprawek

Pełna lista i statusy: `docs/audyt-bledow-2026-11-11.md`. **Naprawione i przetestowane:** kopia pełna nie kasuje już wszystkich notatek przy jednym uszkodzonym elemencie (`tolerantArray` w `noteSchema.ts`), kopia i import zachowują `reminderRule` (serie „dni robocze / co N dni”), zapis karty budowy nie gubi telefonu hurtowni (`siteActions.ts`), przekaźnik synchronizacji nie ginie od jednego pakietu WebSocket ani od nieparsowalnej ścieżki Upgrade (`relay-server/server.js`, test `server.test.js`), a jego Dockerfile działa bez roota i bez domyślnego `TRUST_PROXY`; CI uruchamia testy i `npm audit` obu serwerów oraz instaluje WebKit; `startViewTransition` wolno wołać tylko przez strażnik (`viewTransitionGuard.test.ts`); w UI: miarka na zdjęciach pionowych (współrzędne względem obrazu), licznik obróbki zdjęć nie blokuje „Zapisz wpis” po błędzie, dyktowanie gaśnie po zamknięciu arkusza, poziomica zwalnia nasłuch, sam pomiar spadku albo kod to pełny wpis, punkt z aparatu nie przechodzi na inną budowę, stawka w kilometrówce da się wyczyścić, Auto i Kilometrówka są dostępne przy pustym dzienniku. **Otwarte (decyzje/zmiany modelu):** edycja wpisu nadpisująca zmiany z drugiego telefonu, listy zdjęć LWW, kopia zapasowa bez kilometrówki i cennika, kod pokoju WebRTC z szybkiego SHA-256, pokoje przekaźnika bez uwierzytelnienia tworzenia.

## Audyt błędów, druga partia (2026-11-11): W1–W5

- **W1 import `.budowa`:** `applySitePackage` (`sitePackageIo.ts`) zapisuje punkty nowych pomieszczeń razem z pomieszczeniem (`restoreRoom` z punktami); wcześniej `savePoint` w tej samej transakcji nie widział świeżo dodanego pomieszczenia (migawka `yPoints` odświeża się po transakcji) i po cichu je odrzucał. Test: `sitePackageApply.test.ts`.
- **W2 limit wpisów:** `parseSitePackage` przy ponad 500 wpisach zostawia najnowsze (nie pierwsze z pliku), a liczbę pominiętych (`entriesSkipped`, tylko w pamięci) dolicza do „Pominięte ponad limity” w oknie importu.
- **W3 wymiary w eksporcie:** `remapEntryImages` (`sitePackageIo.ts`) przenosi `captions`, `dimensions` i `after` na nowe klucze zdjęć (kopia bez EXIF ma inny hash); bez zdjęć w paczce nie wychodzi żaden klucz.
- **W4 edycja wpisu a drugi telefon:** `entrySheet.ts` zapamiętuje wpis z chwili otwarcia (`getJournalEditBase`), `updateJournalEntry` dostaje `base`, a `mergeEdit` (`editMerge.ts`) zostawia pola nieruszone przez użytkownika takie, jak są teraz w dokumencie. Pole zmienione w arkuszu wygrywa; listy zmienione w arkuszu (np. zdjęcia) zastępują całość.
- **W5 zamówienie kształtek:** wpis ma opcjonalne `added` (moment zapisu, ustawiany w `addJournalEntry`, zachowywany przy edycji); `siteOrder` liczy od `added ?? at`, więc wpis z datą wsteczną dodany po zamówieniu trafia do kolejnego. Starsze wpisy bez `added` liczą się od `at`. Testy: `order.test.ts`, `journalAdded.test.ts`.

## Audyt błędów, trzecia partia (2026-11-11): W6–W10

- **W6 kategorie push:** `PUSH_CATEGORIES` (`lib/push/schedule.ts`) obejmuje teraz `z:` (kontrola zmiany → „Grafik”) i `d:` (dostawa dziś → „Materiał zamówiony…”), więc da się je wyłączyć; test w `categories.test.ts` sprawdza każdy klucz z `pushKey`.
- **W7 zmiana czasu:** alarm przed zmianą i koniec zmiany liczone przez `wallClock` (konstruktor `Date` z godziną zegarową), nie „północ + minuty·60 000” — w dniach 29.03 i 25.10 nie przesuwają się o godzinę. Test: `schedule.dst.test.ts`.
- **W8 przywracanie kopii:** `restoreFullBackup` zwraca `failed` (sekcje, których nie udało się **scalić** po wymianie notatek); `BackupSettings` pokazuje wtedy „Przywrócono kopię z błędami” z listą. Sekcje, których nie da się odczytać, zatrzymują przywracanie przed zapisem (`RestoreCheckError`, Z-18.1).
- **W9 ochrona przed GC:** w dokumencie `after`, `drawnFrom` i nagrania były już chronione (`journalRefsIn`); dołożone nagrania szkicu (`images.ts`) i otwartej edycji (`journalEditImageRefs`).
- **W10 wyścig GC:** `imageStore` — zapis tego samego hasha czeka na trwające usuwanie (`deleting`), a GC pomija zdjęcia dodane w trakcie biegu (`touched`). Testy: `imageStore.test.ts`.

## Audyt błędów, czwarta partia (2026-11-11): W12, W13, W16, W17

- **W12 seria nauki:** `stateFromDump` (`studyDump.ts`) pomija dni późniejsze niż jutro (zapas na strefy), więc telefon z błędnym zegarem nie wyprzedza „dziś” i nie zeruje serii. Test: `studyStreak.test.ts`.
- **W13 rozmiar kopii:** `exportFullBackup` zwraca `oversize` (kopia większa niż limit wczytywania 120 MB, `isBackupOversize`); `BackupSettings` i auto-kopia pokazują ostrzeżenie (`BACKUP_OVERSIZE_NOTE`) zamiast „zapisano”.
- **W16 zlecenia:** `touch()` (`yJobs.ts`) zapisuje znacznik zmiany wyceny w osobnym kluczu `c␁budowa` zamiast przepisywać cały wpis zlecenia, więc dopisanie pozycji nie cofa statusu zmienionego na drugim telefonie; `all()` bierze większy z `changedAt` wpisu i znacznika. Ograniczenie: `setMeta` nadal zapisuje cały wpis (ostatni zapis wygrywa).
- **W17 czasy wpisów:** `cleanEntry` odrzuca wpis z `at` poza 1970…3000, a `resolved` poza zakresem tylko pomija (wpis zostaje otwarty); wpisów z zegarem do przodu nie gubi (`timeInRange`, `journalEntry.ts`).

## Audyt, piąta partia: karta budowy i odcisk protokołu (2026-11-11)

- **Karta budowy z błędnym formularzem (UI #8):** `SiteCardDialog.tsx` — `blockedByError()`; zamknięcie (Esc, X) i „Pokaż wpisy”/„Raport” przy niezapisanych zmianach i błędzie (np. zajęta nazwa) nie zamyka karty, tylko pokazuje komunikat z przyciskiem „Odrzuć zmiany”. Wcześniej zmiany ginęły po cichu. Test: `e2e/study.spec.ts` (karta budowy).
- **Odcisk protokołu (T3):** `useSiteCardActions.ts` — do treści odcisku dochodzą podpisy zdjęć razem z wymiarami, więc zmiana podpisu zmienia odcisk w stopce PDF.

## Audyt, szósta partia: poprawki interfejsu Pracy (2026-11-11)

- **Miarka (`DimensionDrawer.tsx`):** „Zapisz wymiary” dopisuje linię czekającą na opis (jeśli opis wpisany); zamknięcie z niezapisaną pracą pokazuje toast „Wymiary nie są zapisane” z „Odrzuć”; przeciągnięcie po wcześniejszym stuknięciu zaczyna się tam, gdzie palec dotknął. Płótno ma `aria-describedby` na podpowiedź. Obsługa samą klawiaturą nadal nie istnieje.
- **Alarm próby (`PressureRunWatcher.tsx`):** działa także dla próby uruchomionej w edycji zapisanego wpisu.
- **Arkusz wpisu (`JournalEntrySheet.tsx`, `CameraCapture.tsx`):** pigułki Próba/Kształtki/Rury są nieaktywne (`aria-disabled`), gdy sekcja jest otwarta przez dane; `addPhotos` zwraca liczbę dodanych zdjęć, licznik serii z aparatu liczy tylko te; NFC w bloku „Kod” tylko gdy `hasNFC()`.
- **Karta budowy (`SiteCardDialog.tsx`):** fokus po „Brak” w efekcie po zmianie segmentu; brakujący segment (np. po zniknięciu zlecenia) zastępuje pierwszy dostępny.
- **Drobne:** `NFCReader` ogłasza stany (`role="status"`), numer przystanku w kilometrówce czytnik odczytuje, „Wpłaty z budów” zamiast zera, lista „ostatnich 30 dni” odświeża się o północy, auto: toast przy nieudanym stanie początkowym.
- **Testy:** istniejące e2e Pracy (aparat, miarka, próba, kilometrówka, auto, karta, dziennik) — 54 zielone; Vitest 3390.

## Audyt, siódma partia: testy (2026-11-11)

Nowe testy jednostkowe: `src/lib/study/dimensions.test.ts`, `companyPrefs.test.ts` (dodaj → usuń → cofnij, limit 2000 wpisów, trasa do 20 budów), wektor referencyjny SHA-256 i brak `crypto.subtle` w `documentFingerprint.test.ts`, granice `cleanTest`/minutnika w `pressureTest.test.ts`, linia podpisu w `handover.test.ts`. `e2e/jobs.spec.ts`: etykiety „Klient” i „Adres” z `exact: true` (nie trafiają w przycisk kontaktów).

## Audyt, ósma partia: testy PDF, paczek, push i czujników (2026-11-11)

- **Serwer push:** `push-server/core.js` `tickStore(store, now, sendOne)` — jeden obieg wysyłki z wstrzykiwaną wysyłką; `server.js` używa go w `tick()` (obsługa 404/410 → usunięcie subskrypcji, inny błąd → termin nie jest ponawiany). `/test` korzysta z tego samego `sendOne`. Testy: `core.test.js`, `server.test.js`.
- **Testy:** `src/lib/study/pdfBuilders.test.ts` (atrapa jsPDF), `src/lib/push/client.test.ts`, rozszerzone `sitePackageApply.test.ts`, `nfc.test.ts`, `cameraCapture.test.ts`, `aiModel.test.ts`.

## Audyt, dziewiąta partia: decyzje właściciela (2026-11-11)

- **Próba szczelności (`PressureTestTimer.tsx`):** „Zakończ” przed upływem czasu pokazuje „Próba jeszcze trwa — Minęło X z Y” z przyciskiem „Zakończ mimo to”; wynik liczony jak dotąd.
- **Cofnij (`SiteJobPanel.tsx`, `SiteCardDialog.tsx`):** zmiana statusu zlecenia i „To zlecenie własne (fucha)” mają toast „Cofnij” (`toastWithUndo`).
- **Skaner (`BarcodeScanner.tsx`):** w trybie bez automatycznego użycia po wykryciu kodu jest „Skanuj ponownie” (restart kamery).
- **Drobne:** adres obrazu zaznaczania planu zwalniany przy odmontowaniu `SiteDocsPanel`. Testy: `e2e/pressure-timer.spec.ts` (nowy test i poluzowane kruche asercje licznika).

## Audyt, jedenasta partia: dane i czas (D1–D9, 2026-11-11)

- **Zmiana czasu:** `useNextBoundary.ts` liczy następną północ zegarowo (nie „+24 h”), `push/schedule.ts` `shiftEndItems` zaczyna od wczoraj (zmiana nocna), `paymentReminder.ts` `daysWaiting` poprawia różnicę przesunięcia strefy. Testy: `useNextBoundary.test.ts`, `schedule.dst.test.ts`, `paymentReminder.test.ts`.
- **Scalanie kopii (`mergeDump`):** rozliczenia ograniczają wpłaty do `PAYMENTS_MAX` razem z istniejącymi; punkty, auto, zestawy, zlecenia i odhaczenia mają limity wejścia; zdarzenia auta i punkty bez rodzica nie są zapisywane. Test: `mergeLimits.test.ts`, `billing.test.ts`.
- **Klucze z kopii:** odczyt kwot etapów/typów tylko z własnych pól (`billing.ts`), `studyDump.ts` pomija `__proto__`.
- **Push:** `client.ts` — limit czasu 15 s i kolejka `uploadSchedule`.

## Audyt, trzynasta partia: bezpieczeństwo (2026-11-11)

- **Udostępnianie z systemu i linki:** `useLaunchIntents.ts` pyta „Zapisać udostępnione w NOTKACH?” przed zapisem plików (Share Target), `useImportExport.ts` pyta przed dodaniem notatki z `?share=`. Link parowania używa fragmentu `#pair=` (`src/lib/pairLink.ts`), stare `?pair=` działa nadal.
- **Zakresy i limity:** `finishNow.ts` (koniec zmiany −2 h…+16 h), `icsImport.ts` (2000 zdarzeń, pola ucinane), `exportNotes.ts` (`SETTING_VALUE_MAX`), `vault.ts` (`MAX_KDF_ITERATIONS` 3 mln).
- **Przekaźnik:** `DELETE /rooms/:id` (token pokoju) usuwa pokój, bloby i zamyka gniazda; w Ustawieniach → Sync okno „Odłączyć to urządzenie?” ma opcję „Odłącz i usuń z przekaźnika (wszystkie urządzenia)” (`relayRuntime.ts` `deleteRelayRoom`).
- **Nagłówki:** HSTS `max-age=31536000` w `vercel.json` i `netlify.toml` (`securityHeaders.test.ts`).
- **Testy:** `finishNow.test.ts`, `icsImport.test.ts`, `pairLink.test.ts`, `fullBackup.test.ts`, `useImportExport.test.ts`, `securityHeaders.test.ts`, `relay-server/server.test.js`, e2e `share-files`, `share-to-entry`, `sync-code`.

## Audyt, czternasta partia: pola, testy komponentów, pomiar (2026-11-11)

- **Zlecenie własne (`SiteJobPanel.tsx`):** pola „Co zrobić” i „Marża” nie są przemontowywane w trakcie pisania, gdy dane zmienią się na drugim telefonie (`useFieldKey`).
- **Minutnik (`PressureTestTimer.tsx`):** po zakończeniu lub przerwaniu próby na innym telefonie pola wracają do wartości protokołu.
- **Testy komponentów:** `MileageDialog.test.tsx`, `SiteBillingDues.test.tsx`.
- **Wydajność (D11):** przebudowa migawki Nauki po zmianie to 26 ms przy 3000 wpisach (Node); bez zmian w kodzie.

## Audyt, piętnasta partia: równoległe zmiany we wpisie dziennika (W11, 2026-11-11)

- **Gdzie:** `src/lib/study/yStudy.ts` (`writeEntry`, `setKeyedMap`, `ensureContainers`), `journalEntry.ts` (`ORDERED_ENTRY_LISTS` + `KEYED_ENTRY_MAPS`), `journalFields.ts`.
- **Jak działa:** `images`, `fittings`, `recordings`, `pipes` to `Y.Array`; `captions`, `dimensions`, `drawnFrom` to `Y.Map` z osobnym kluczem na zdjęcie. Dwa telefony dodające nagrania albo opisujące różne zdjęcia nie nadpisują się. Wpis od początku ma puste kontenery.
- **Ograniczenia:** wpisy utworzone przed tą zmianą dostają kontenery przy pierwszej edycji; jeśli dwa telefony zrobią tę pierwszą edycję jednocześnie, jeden może przegrać (jednorazowo). Starsze wersje aplikacji czytają `Y.Array`/`Y.Map` przez wspólne `journalFields`.
- **Testy:** `yStudy.test.ts` (nagrania, rury, podpisy i wymiary z dwóch telefonów, migracja starego zapisu).

## Audyt, szesnasta partia: zakres kopii i przywracanie (W14, W15, 2026-11-11)

- **Kopia pełna** (`exportNotes.ts` → `SETTINGS_KEYS`) niesie teraz też dane firmy wykonawcy: nazwę firmy, kilometrówkę, cennik usług, cennik kształtek i imię autora. Numer konta i odciski dokumentów zostają poza kopią (dane tego urządzenia). Test: `fullBackup.test.ts`.
- **Przywracanie:** Praca/Nauka jest zastępowana kopią, a rozliczenia, wpłaty, zlecenia, punkty wodne, zestawy i materiał w aucie są scalane (nic nie kasuje nowszych danych). Okno „Przywrócić ten backup?” mówi o tym wprost (`BackupSettings.tsx`, `restore-money-note`).

## Audyt, siedemnasta partia: nowe pokoje na przekaźniku (S4, 2026-11-11)

`relay-server/server.js` — `creationLimited`: jeden adres może założyć najwyżej `ROOMS_PER_IP_PER_DAY` (domyślnie 20) nowych pokoi na dobę (429 powyżej); zapis do istniejącego pokoju nie jest liczony; liczniki sprząta `sweepHits`. Test: `relay-server/server.test.js`.

## Audyt, osiemnasta partia: pokój WebRTC v3 (S3, 2026-11-11)

- **Co robi:** nazwa pokoju synchronizacji liczona jest wolnym PBKDF2 (200 tys. iteracji) zamiast szybkiego SHA-256. Operator publicznego serwera sygnalizacyjnego widzi nazwę pokoju, więc przy szybkim skrócie mógłby offline odgadnąć kod parowania (~59 bitów), który jest też hasłem ruchu.
- **Gdzie:** `src/lib/yjsSync.ts` — `roomNameV3For` (`kaczy3-…`, cache na kod), `roomNamesFor` (v3 zawsze; v2 w oknie zgodności; stary FNV tylko po jawnym włączeniu), `v2CompatActive`, pole `v2Until` w `kaczy.sync.v1`, `V2_COMPAT_MS` (30 dni). Obrazy (`imageSync.ts`) korzystają z tej samej listy pokoi.
- **Migracja:** zapis sprzed zmiany (istniejąca grupa) dostaje w `initSync` okno 30 dni z pokojem v2; `joinWithCode` otwiera takie okno (grupa mogła zostać na starszych wersjach); `startPairing` (nowa grupa) tylko v3. W oknie nazwa v2 nadal jest widoczna dla serwera sygnalizacyjnego. Lista urządzeń (`refreshDevices`) pochodzi z pokoju v3, więc urządzenia na starszych wersjach, będące tylko w v2, na niej nie widnieją.
- **Testy:** `yjsSync.test.ts` (nazwa v3, okno zgodności, nowa grupa), `yjsReconnect.test.ts`, `imageSync.test.ts`; e2e `sync-code`, `legacy-room-idle`, `relay-sync`.

## Podział Index.tsx (Cykl 3, punkt 3.1, 2026-11-12)

- **Co robi:** bez zmiany zachowania. `src/pages/Index.tsx` ma 943 linie zamiast 1270; logika wyszła do hooków w `src/hooks/`, a okna do `IndexDialogs`.
- **Gdzie:** `useInboxCapture` (zapis ze Skrzynki: pole i pliki), `useNoteExport` (HTML, PDF, ZIP zaznaczonych), `useNoteNavigation` (`revealNote`, otwieranie notatki i adresu `/notatka/:id`, zapisane widoki i filtry, notatka dnia i okresu), `useNoteGlowActions` (dodawanie z paska i przenoszenie do folderu z błyskiem, kandydaci na rodzica), `useViewShell` (przejścia widoków, `data-view`, pole wyszukiwania zsynchronizowane z adresem, działy trzymane w pamięci, wejście treści), `useAppDialogs` (stan „otwarte” okien, też z linków `?pair=` i `?settings=`), `src/components/IndexDialogs.tsx` (Do skrzynki, Statystyki, Ustawienia, import z innych aplikacji, Skróty, Pola notatek, Tryb skupienia, Ostatnie działania).
- **Ograniczenia:** paleta poleceń i czytnik notatek zostały w `Index.tsx` — biorą kilkanaście akcji strony, a przeniesienie oznaczałoby tylko przekazywanie ich dalej.
- **Testy:** brak testów komponentu `Index`; sprawdzone typami (`npm run typecheck`), lintem i budową. E2E nie uruchamiane (wymaga zgody).
- **Uwaga o narzędziach:** `tsc --noEmit -p .` nie sprawdza niczego (`tsconfig.json` ma `"files": []`); typy sprawdza `npm run typecheck` (`tsconfig.app.json`).

## Audyt 2026-11-15: wersja kopii, start bez Pracy, dostępność, drobne poprawki bezpieczeństwa

- **Co robi:** kopia zapasowa z nowszej wersji formatu jest odrzucana z komunikatem zamiast po cichu wczytać się jako v1; dane Pracy nie wchodzą do paczki startowej; kafel notatki i miniatury działają z klawiatury; przewijanie z kodu respektuje ograniczenie ruchu; linki `//host` w Markdownie nie są klikalne; import ZIP i pobieranie z przekaźnika mają twarde limity.
- **Gdzie jest:**
  - `src/lib/exportNotes.ts` — `MAX_BACKUP_VERSION` (3) i sprawdzenie `raw.version` w `parseFullBackup` przed parsowaniem schematem. Przywracanie ma już punkt powrotu: `BackupSettings.tsx` pobiera kopię bieżącego stanu przed `restoreFullBackup` i wstrzymuje przywracanie, gdy się nie uda.
  - `src/hooks/useNotes.ts`, `src/lib/exportNotes.ts`, `src/hooks/useLaunchIntents.ts`, `src/lib/study/images.ts` — `study/images` i `study/data` ładowane dynamicznie; `images.ts` importuje `./journalRefs` zamiast `./yStudy`.
  - `src/components/ui/dialog.tsx`, `sheet.tsx`, `checkbox.tsx` — powiększony obszar dotyku (`coarse:after:-inset-*`) bez zmiany układu; `src/components/NoteCard.tsx` — `role="button"`, `aria-pressed` w trybie zaznaczania, miniatura z `role`/`tabIndex`/klawiaturą poza edycją.
  - `src/lib/scrollBehavior.ts` — `smoothBehavior()`: `auto`, gdy `<html data-motion="reduced">` albo system prosi o mniej ruchu; użyte w `NoteGrid`, `ReaderToc`, `useNoteNavigation`, `GeneralSettings`, `gridKeyboardNav`, `wikiHeading`, `CwiczeniaView`.
  - `src/lib/safeUrl.ts` — `isSafeHref` odrzuca `//host` i `/\host`.
  - `src/lib/sync/relayProvider.ts` — `MAX_PULL_PAGES` (1000) i przerwanie na pustej stronie z `hasMore`.
  - `src/lib/import/collect.ts` — łączny limit liczony także z faktycznie rozpakowanych bajtów (`track`), nie tylko z rozmiaru w nagłówku ZIP.
  - `relay-server/.gitignore` — katalog `data`.
- **Jak działa / decyzje:** wersja kopii jest czytana z surowego JSON-a, bo schemat Zod zamieniał nieznaną wersję na 1. Dane Pracy ładują się dopiero przy odśmiecaniu obrazów, intencji udostępnienia i budowie kopii.
- **Rejestr sekcji kopii:** `MERGE_SECTIONS` w `src/lib/exportNotes.ts` (16 pozycji: klucz, etykieta, scalanie) i jedna pętla w `restoreFullBackup` zamiast powtórzonych bloków; uszkodzona sekcja trafia do `failed`. Nowy dział: pozycja w rejestrze + pole w schemacie i w `buildFullBackupWithReport`. Test kompletności w `src/lib/fullBackup.test.ts`.
- **Wykresy poza precache:** `vite.config.ts` wyłącza `BarChart-*.js` (recharts, ok. 360 KB) z precache; `prefetchViewsWhenIdle` (`src/lib/viewPreload.ts`) dociąga `YearCharts` w tle, więc „Rok” w Grafiku działa offline po pierwszej sesji online. Statystyki (`StatsDialog`) dostają ten chunk dopiero przy pierwszym użyciu online.
- **Naprawione testy e2e (wady testów, nie aplikacji):** `clients.spec.ts` (`closeCard` ponawia Escape — Radix w WebKit nie słucha tuż po otwarciu), `etap6.spec.ts` (przycisk „Powiększ obraz” w oknie czytnika), `view-change.spec.ts` (siatka montuje kafle przy przewijaniu), `today-study.spec.ts` (FSRS: następnego dnia wracają tylko pomyłki).
- **Ograniczenia i pułapki:** rozmiary `Button` (`default`, `sm`, `lg`) na dotyku celowo nie zostały zmienione (właściciel cofnął pomysł `coarse:min-h-11`). Przerwanie pobierania przy limicie stron zostawia resztę na następny przebieg (kursor jest zapisany).
- **Testy:** `src/lib/fullBackup.test.ts` (wersja kopii), `src/lib/safeUrl.test.ts` (`//host`), `src/lib/import/*.test.ts`, `src/lib/sync/*.test.ts`, `e2e/bundle.spec.ts`.
- **Commit:** cb771dd4 (część pierwsza), druga tura (rejestr sekcji, wykresy, testy e2e) w kolejnym commicie na `wip/mobile-fala1`, 2026-11-15. Pełne e2e po tej turze jeszcze nie przeszło (przerwane na prośbę właściciela).

## Architektura — warstwy `lib ← hooks ← components` (A1.1–A1.4, A1.6 planu architektury, 2026-11-15)

- **Co robi:** nic widocznego dla użytkownika. Kod w `src/lib` nie zna już hooków ani komponentów, a reguła ESLint pilnuje, żeby tak zostało.
- **Gdzie jest:** typy `Note`, `Folder`, `ChecklistItem`, `NoteColor`, `FolderColor` w `src/lib/types/note.ts` (hook `useNotes.ts` reeksportuje je, więc komponenty bez zmian); `View` w `src/lib/types/view.ts` (reeksport z `useFilteredNotes.ts`); `src/lib/motionPref.ts` (preferencja ruchu: `isMotionReduced`, `setMotionMode`, `motionStore`; hook `useMotionPref` zostaje cienką nakładką); `src/lib/dictationConsent.ts`; `src/lib/notify.ts` (jedyny moduł `lib` importujący `sonner`: `export { toast }`). Reguły: `eslint.config.js` (`no-restricted-syntax` dla `src/lib/**` i `src/hooks/**`).
- **Jak działa:** zmiana to przeniesienie definicji i reeksporty — zachowanie bez zmian. Importy dynamiczne `import()` (leniwe widoki w `viewPreload.ts`) są dozwolone, bo to nie zależność statyczna. Testy są poza regułą.
- **Ograniczenia:** A1.4 zrobione w wersji pośredniej — jeden plik `notify.ts` zamiast wstrzykiwanego ujścia (`setNotifySink`), bo 17 testów mockuje `sonner` i wymagałyby przepisania. A1.5 niezrobione: 8 hooków dalej importuje komponenty (lista wyjątków w `eslint.config.js`, ma malejąć do zera). `resolveDark`/`useToday` z planu występowały tylko w testach.
- **Testy:** typecheck, lint i całe Vitest. Dwa testy (`searchNotes` limit 50 ms, `yjsSync` liczba transportów) bywają niestabilne w przebiegu równoległym, a osobno przechodzą.
- **Commit:** zob. `git log` (2026-11-15).

### Faktury: numeracja i seria urządzenia (Z-2.3–Z-2.6, 2026-11-15, commity 129fb3db, 36c7570f)

- **Co robi:** dwa wystawienia naraz nie dostają tego samego numeru; rok numeru to rok daty wystawienia na fakturze; daty nieistniejące w kalendarzu (np. 2026-02-31) i zły termin płatności blokują wystawienie; okno faktury ostrzega, gdy w serii tego telefonu są faktury z innego urządzenia.
- **Gdzie:** `src/lib/ksef/invoicesStore.ts` (`issueInvoice` → `inCriticalSection` → `issueLocked`; `seriesUsedElsewhere`), `invoice.ts` (`validDate` sprawdza w obie strony, `payment.dueDate`), `sellerPrefs.ts` (`getDeviceId`), `yInvoices.ts` (pole `deviceId`), `InvoiceDialog.tsx` (ostrzeżenie).
- **Jak działa:** sekcja krytyczna to `navigator.locks` (`notatnik-faktura`) plus kolejka obietnic w module (gdy `locks` brak). Po `await` skrótu numer jest sprawdzany ponownie, a `add` i tak odmawia zajętego numeru. `deviceId` jest losowy, w localStorage `kaczy.ksef.deviceId.v1`, poza kopią.
- **Ograniczenia:** faktury sprzed zmiany nie mają `deviceId` i nie wywołują ostrzeżenia. Nie zrobione z Z-2.4: limity 256/512 (F-6) i `qtyMilli × unitPrice ≤ MAX_SAFE_INTEGER`.
- **Testy:** `src/lib/ksef/invoices.test.ts`.

## CI — pełne e2e tylko na master, gałęzie na @smoke (AR-3, 2026-11-23)

- **Co robi:** CI (`.github/workflows/ci.yml`) rusza przy pushu na każdą gałąź i przy PR do `master`/`main`. Lint, typecheck, Vitest z pokryciem i build idą zawsze. Pełne e2e (`npm run test:e2e`, ponad godzina) tylko przy pushu na `master`/`main`; gałęzie robocze i PR dostają `npm run test:e2e:smoke` (`@smoke`, 3 wątki).
- **Jak działa:** dwa kroki z wykluczającymi się warunkami `if` na `github.event_name` i `github.ref`. Serwery (`push-server`, `relay-server`) testowane jak dotąd w osobnym zadaniu.
- **Pułapki:** push tego samego commita na `wip` i `master` uruchamia dwa przebiegi (smoke i pełny). Wcześniej gałęzie robocze nie miały CI wcale.
- **Commit:** zob. `git log -- .github/workflows/ci.yml`, 2026-11-23.

## Zrzuty `@visual` — wzorce odświeżone (2026-11-23)

- 153 z 227 wzorców w `e2e/visual.spec.ts-snapshots/` odświeżone (`--update-snapshots=changed`) po przeglądzie różnic z decyzji właściciela. Wzorce były z 19.11 (`a1c616bb`); różnice pochodziły z planów po tej dacie: zakładka „Klienci” w Pracy, nowe teksty i pole tokenu w Ustawieniach (push), ikony meta 14 px i rytm strony (W4.1, W7.3), przesunięcie treści Kalendarza i Grafiku. Przejrzane przedstawiciele: lista notatek (telefon), Praca i Kalendarz (komputer), Ustawienia ogólne (telefon) — bez błędów układu.
- Przebieg po odświeżeniu: 227/227.

## Architektura — mapa `Index.tsx` i efekty bez widoku (A2.1, A2.2, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. `Index.tsx` traci efekty uboczne: pięć jest osobnymi komponentami bez widoku, dwa hookami, każdy z testem. Jest też mapa odpowiedzialności całego `Index` — punkt wyjścia do kontrolera widoku (A2.3) i nakładek (A2.4).

**Gdzie jest.**
- `docs/index-mapa.md` — grupy hooków (dane, trasa, filtr, terminy, zaznaczenie, tworzenie, nawigacja, czytnik, nakładki, skróty, efekty, przeciąganie): skąd biorą, komu dają, dokąd pójdą w A2; kolejność renderu; obserwacje (renderowanie przy zmianie notatki, powtórzony kod terminów i pasków, liniowe wyszukiwanie po `id`).
- `src/pages/IndexEffects.tsx`:
  - `IdleWarmup` — czytnik i presety Grafiku w bezczynności po starcie;
  - `SearchTermsSync` — frazy wyróżniania w kaflach;
  - `UndoHandlersSync` — cofanie kosza i archiwum po przeładowaniu;
  - `MarkOpenedSync` — „ostatnio otwierane” przy otwarciu czytnika;
  - `ReaderHistoryKeys` — Alt+←/→ po historii notatek.
- `src/pages/indexHooks.ts`:
  - `useSidebarOpen(isMobile)` — pasek boczny otwarty na komputerze, zamknięty na telefonie;
  - `useShiftsUndo(view)` — Ctrl+Z / Ctrl+Shift+Z w Grafiku; ładuje magazyn przy wejściu na Grafik, `undo()`/`redo()` zwracają `false`, gdy skrót ma iść dalej do historii kosza i archiwum. Obiekt jest stały między renderami (widok czytany z `ref`).
- `src/pages/Index.tsx` montuje komponenty obok synchronizatorów (`PushScheduleSync` i reszta); 1000 → 941 linii.

**Jak działa.** Każdy komponent renderuje `null` i ma jeden `useEffect` z tymi samymi zależnościami co wcześniej w `Index`. `ReaderHistoryKeys` dostaje stabilne `showPreview` (`useCallback` nad `showInReader(id, "preview")`), żeby nie przepinać nasłuchu przy każdym renderze. Hooki są w osobnym pliku `.ts`, bo plik z komponentami i hookami łamie Fast Refresh (`react-refresh/only-export-components`). Oba pliki są w `src/pages/`, bo ładują czytnik i Grafik przez `pages/indexViews` — komponenty z `src/components` nie mogą importować ze stron (reguła warstw A1.6).

**Ograniczenia i pułapki.** Kolejność montażu efektów zmieniła się (są po drzewie widoków, nie przed) — żaden nie zależy od DOM listy.

**Testy.** `src/pages/IndexEffects.test.tsx` (9 przypadków: pasek boczny telefon/komputer, cofanie Grafiku dopiero po załadowaniu magazynu i oddanie skrótu poza Grafikiem, rozgrzewka po czasie, frazy, oba ujścia cofania, zapis otwarcia, Alt+← z pominięciem zablokowanych, brak kroku zostawia skrót przeglądarce, pole tekstowe i otwarte okno).

**Commit.** Patrz historia `src/pages/IndexEffects.tsx`, 2026-11-23.

## Architektura — model listy `useNotesScreen` i wspólny zapis terminów (A2.3, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Wyliczanie listy notatek i Terminów wyszło z `Index.tsx` do hooka, a Terminy i Kalendarz zapisują terminy jedną funkcją.

**Gdzie jest.** `src/pages/useNotesScreen.ts`:
- `useNotesScreen(args)` — filtr (`useFilteredNotes`), `reminderNotes`, grupy i wiersze Terminów (`reminderGroups`, `archivedRows`, `reminderRowCount`), tryby układu (`boardMode`, `tableMode`, `galleryMode`), `groupBy`, sekcja przypiętych, `groups`, `visibleNotes` (+ `visibleNotesRef`);
- `reminderWriters(addNote, updateNote, color)` — `createReminderNote`, `setReminder` (Kalendarz), `attachReminder` (Terminy, przez `setReminder`).

- `useComposer(...)` — `addNoteRef`, `canCompose`, `composeDestination`, `expandAddNote` (ponawianie do ok. 3 s, w Skrzynce fokus na polu przechwycenia);
- `useNoteScreenActions(...)` — akcje pojedyncze i grupowe (`useNoteActions`, `useBulkNoteOps`), eksport, `deleteNoteForever` i `handleDelete`; dane i operacje czyta z `useNotesContext`, więc `Index` podaje tylko widok, `groupBy`, zaznaczenie, listę na ekranie, przeniesienie z poświatą i `deleteVersions`.

W `Index.tsx` także: `openSettingsTab(tab)` dla pasków stanu danych i synchronizacji oraz mapa `byId` (notatki, archiwum, kosz) dla `debtReminders` i listy w czytniku. 941 → 843 linie.

**Jak działa.** Hook nie ma własnego stanu — wynika z danych, trasy, `prefs` i odroczonych `deferredSearch`/`deferredPrefs`. Zależności `useMemo` są takie jak wcześniej w `Index`; kolejność `visibleNotes` (przypięte, potem grupy bez zwiniętych) zachowuje nawigację klawiaturą (`navOrder`). Kontroler z planu (`{ view, filtered, selection, actions }`) budujemy etapami: zostają w `Index` nawigacja, czytnik i nakładki (A2.4).

**Ograniczenia i pułapki.** Lista w czytniku sprawdza teraz `byId` i pomija notatki z kosza (`trashed`) — wcześniej szukała tylko w notatkach i archiwum, wynik ten sam.

**Testy.** `src/pages/useNotesScreen.test.ts` (4 przypadki zapisu terminów: bez powtarzania, cały dzień, dołączenie czyści koniec serii, `reminderDay` z Kalendarza); e2e: smoke, `calendar-phase1/2`, `reminders-*`, `board-table`, `composer`, `dzis-composer`, `templates-bulk`, `file-launch`.

**Commit.** Patrz historia `src/pages/useNotesScreen.ts`, 2026-11-23.

## Architektura — nakładki w `IndexOverlays` i jeden reduktor okien (A2.4, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Paleta, czytnik, okna z `IndexDialogs`, triaż Skrzynki i potwierdzenia Kosza montują się w jednym komponencie, a ich stan otwarcia jest w jednym miejscu.

**Gdzie jest.**
- `src/hooks/useAppDialogs.ts` — `dialogsReducer` (typy `DialogName`, `DialogsState`, `DialogsAction`) i `useAppDialogs()`. Doszły okna `triage` (z `triageMounted`), `emptyTrash` i lista `deleteIds`, które wcześniej były lokalnymi `useState` w `Index`.
- `src/pages/IndexOverlays.tsx` — `InboxTriage`, `DeleteForeverDialog`, `EmptyTrashDialog`, `CommandPalette`, `IndexDialogs`, `NoteReader`. Dane i operacje na notatkach bierze z `useNotesContext`; od `Index` dostaje stan okien, widok, nawigację, czytnik (`useReaderNav`) i akcje z poświatą.
- `src/pages/Index.tsx` — 843 → 759 linii.

**Jak działa.** Settery mają kształt `setState` (wartość albo funkcja), więc pasek boczny, nagłówek, skróty i paleta wołają je bez zmian. Są stałe między renderami (`useMemo`), a reduktor zwraca ten sam obiekt, gdy nic się nie zmienia. `triageMounted` ustawia się przy pierwszym otwarciu i zostaje (animacja zamknięcia, stan kroku). „Wstecz” zamyka nakładki jak dotąd: czytnik przez `useOverlayHistory`, okna Radix przez `ui/overlay-back`. `presentingNoteId` i podgląd zostały w `useReaderNav`, bo sterują nimi siatka i nawigacja klawiaturą.

**Ograniczenia i pułapki.** Dialogi Kosza i triaż są teraz poza `<main>` — to portale Radix, więc układ się nie zmienia.

**Testy.** `src/hooks/useAppDialogs.test.ts` (5 przypadków: wartość i funkcja, brak zmiany = ten sam stan, triaż zostaje zamontowany, lista do usunięcia, stałe settery); e2e: smoke, `command-palette-study`, `inbox-*`, `palette-*`, `reader*`, `settings-links`, `shortcuts-settings-stats`, `wiki*`, `notes`.

**Commit.** Patrz historia `src/pages/IndexOverlays.tsx`, 2026-11-23.

## Architektura — pomiar renderów strony głównej (A2.5, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Pozwala policzyć, ile razy renderują się `Index`, nagłówek, pasek boczny i siatka notatek.

**Gdzie jest.** `src/lib/renderProbe.ts` (`countRender(name)`; naprawa: `src/hooks/useLatestRef.ts`, `Index.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`) wywoływane na początku `Index`, `AppHeader`, `AppSidebar` i `NoteGrid`; test `e2e/render-count.spec.ts`.

**Jak działa.** `countRender` nic nie robi, dopóki `window.__renderProbe` nie istnieje; test ustawia go przez `addInitScript`. Profiler Reacta odpada, bo w buildzie produkcyjnym (na nim działa e2e) nie zwraca danych. Test dodaje 3 notatki, wpisuje znak w wyszukiwarkę, potem przypina notatkę, i wypisuje różnice liczników (`[render] …`).

**Wynik (2026-11-23, build produkcyjny, 3 notatki) — przed i po naprawie.**

| Akcja | Index | Nagłówek | Pasek boczny | Siatka |
|---|---|---|---|---|
| Znak w wyszukiwarce, przed | 4 | 4 | 4 | 4 |
| Znak w wyszukiwarce, po | 4 | 1 | 2 | 4 |
| Przypięcie notatki, przed | 2 | 2 | 2 | 4 |
| Przypięcie notatki, po | 2 | 1 | 1 | 4 |

**Naprawa.** `useStableFn` (`src/hooks/useLatestRef.ts`) daje funkcję o stałej tożsamości, która woła najnowszą wersję — bez przestarzałych domknięć, więc `isMobile` w `onGoView` zostaje aktualne. `Index` podaje nią wszystkie handlery nagłówka i paska; `navItems` trzyma `useStableByKey` (klucz: dział i licznik). `AppHeader` i `AppSidebar` są w `memo` (funkcje `AppHeaderImpl`, `AppSidebarImpl`). Pozostały jeden render to subskrypcja `useNotesContext` (foldery i etykiety), czyli zmiana danych, nie propsów z `Index`; zejście do zera wymagałoby rozdzielenia kontekstu.

**Ograniczenia.** Nowy handler dla nagłówka lub paska trzeba owinąć w `useStableFn`, inaczej `memo` przestaje działać. Test nie ma progów, tylko wypisuje liczby.

**Testy.** `e2e/render-count.spec.ts`.

**Commit.** Patrz historia `src/lib/renderProbe.ts`, 2026-11-23.

## Bezpieczeństwo — model zagrożeń, `SECURITY.md` i strażnik ujść HTML (S0, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Zapisuje, przed kim i czego bronimy, mówi jak zgłosić lukę i pilnuje w testach, żeby w kodzie nie przybyło ujść HTML.

**Gdzie jest.**
- `docs/model-zagrozen.md` — aktywa, granice zaufania, schemat przepływu danych, przeciwnicy T1–T9, ujścia HTML, znane ograniczenia i rzeczy niesprawdzone.
- `SECURITY.md` — zgłaszanie prywatne, zakres, obsługiwane wersje (tylko `master`).
- `src/lib/htmlSinkGuard.test.ts` — czyta wszystkie źródła `src/` i szuka `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `srcdoc`, `document.write`, `insertAdjacentHTML`, `createContextualFragment`.

**Jak działa.** Lista dozwolonych (`ALLOWED`) jest pusta od S1.6 (wcześniej miała jeden wpis: `MermaidBlock.tsx`). Test padnie, gdy nowy plik użyje ujścia bez wpisu, a także gdy wpis nie ma już użycia. Komentarze są wycinane przed szukaniem, żeby opis w kodzie nie dawał fałszywych alarmów.

**Ograniczenia i pułapki.** Strażnik łapie nazwy, nie przepływ danych — ujście ukryte w dynamicznym dostępie (`el["inner"+"HTML"]`) go ominie. Reszta planu klienta (S1.1 Trusted Types, S1.2 adresy serwerów, S1.3 nagłówki) jest do zrobienia.

**Testy.** `src/lib/htmlSinkGuard.test.ts` (2 przypadki; sprawdzone ręcznie, że plik z `innerHTML` go zawodzi).

**Commit.** Patrz historia `docs/model-zagrozen.md`, 2026-11-23.

## Bezpieczeństwo — Mermaid jako obraz `blob:` (S1.6, 2026-11-23)

**Co robi.** Diagramy z bloków ` ```mermaid ` wyglądają jak dotąd, ale są obrazem, nie SVG wstawionym do strony. Ostatnie ujście HTML w aplikacji zniknęło.

**Gdzie jest.** `src/components/MermaidBlock.tsx` (`MermaidImage`), `src/lib/mermaidRender.ts` (`fontFamily`, `htmlLabels: false`).

**Jak działa.** SVG z `renderMermaid` trafia do `Blob` (`image/svg+xml`), `URL.createObjectURL` daje adres dla `<img>`, adres jest zwalniany przy zmianie diagramu i odmontowaniu. Zakładamy `xmlns` z wyjścia Mermaida (bez niego `<img>` nie narysuje SVG). Szerokość naturalna pochodzi z `max-width` w stylu SVG, żeby mały diagram nie rozciągał się na całą kartę. CSP już dopuszcza `img-src blob:`.

**Ograniczenia i pułapki.** Tekstu diagramu nie da się zaznaczyć ani przeszukać na stronie. Czcionka jest systemowa, nie czcionką aplikacji (obraz nie widzi `@font-face` strony). Etykiety to SVG `<text>`, nie HTML — długie etykiety nie zawijają się tak jak wcześniej. Sprawdzone w Chromium (zrzut: etykiety, strzałki, kolory motywu); Safari i Firefox do sprawdzenia ręcznie.

**Testy.** `src/components/MermaidBlock.test.tsx` (obraz `blob:`, brak `<svg>` w DOM, ładunek XSS nie trafia do drzewa i nie wykonuje się), `e2e/mermaid.spec.ts` (przeglądarka dekoduje obraz), `src/lib/htmlSinkGuard.test.ts`.

**Commit.** Patrz historia `src/components/MermaidBlock.tsx`, 2026-11-23.

## Bezpieczeństwo — service worker: udostępnianie i powiadomienia (S1.10, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Skrzynka udostępnień przyjmuje tylko obrazy i PDF, a testy pilnują, że kliknięcie powiadomienia nie wyprowadza poza aplikację i że worker nie ładuje cudzego kodu.

**Gdzie jest.**
- `public/sw-share.js` — filtr typów w `storeShare` (`image/*`, `application/pdf`); reszta liczy się jako `skipped`. To te same typy, które strona przyjmuje (`isShareableImage`, `isShareableAttachment` w `src/lib/shareInbox.ts`).
- `src/lib/swShare.test.ts` — worker z atrapą `self` i żądania: typy, limit 10 MB, obcy `Origin`, `Origin: null`.
- `src/lib/push/swNotifications.test.ts` — dopisane: `notificationclick` (adresy `//host`, `/\host`, `https://…`, `javascript:`, ścieżka bez `/`, brak adresu → `/`; akcja dokleja `?akcja=` do oczyszczonego adresu) oraz strażnik `importScripts` (lista w `vite.config.ts` to gołe nazwy plików, a skrypty `sw-*.js` same niczego nie importują).

**Jak działa.** Strona z nieprzezroczystym originem (piaskownica) wysyła `Origin: null` i przechodzi sprawdzenie — tej luki nie da się zamknąć nagłówkiem (`Sec-Fetch-Site` nie dochodzi do workera). Zamiast tego ogranicza ją zawartość: do cache trafia najwyżej 30 obrazów lub PDF-ów po 10 MB (razem 50 MB), tekst do 20 000 znaków, tytuł 200, adres 2000. Strona i tak kasuje wpis po odebraniu i czyści porzucone (`sweepShareInbox`).

**Ograniczenia i pułapki.** Typ pliku to deklaracja nadawcy (`File.type`), nie sprawdzenie zawartości — właściwą walidację robi strona przy wczytaniu. W teście `Request` z jsdom nie serializuje jsdomowego `FormData`, dlatego żądanie jest atrapą.

**Testy.** `src/lib/swShare.test.ts` (5), `src/lib/push/swNotifications.test.ts` (+10); e2e `share-files`.

**Commit.** Patrz historia `public/sw-share.js`, 2026-11-23.

## Bezpieczeństwo — testy własności parserów niezaufanych wejść (S1.7, 2026-11-23)

**Co robi.** Nic widocznego dla użytkownika. Setki losowych wejść na każdy parser sprawdzają, że plik od obcej osoby nie wywróci aplikacji ani nie zanieczyści prototypu obiektów.

**Gdzie jest.** `src/lib/untrustedInput.prop.test.ts` (`fast-check`, 300 przebiegów na parser, 150 dla kopii).

**Jak działa.** Pokryte: `parseFullBackup`, `parseKeepJson`, `parseKeepHtml`, `parseFrontmatter`, `parseMarkdownNote`, `parseIcs`, `parseShareParam`, `parseShare`, `parseSitePackage` oraz `clean*` rekordów od peera (`cleanSchemaClaim`, `cleanRecord`, `cleanSellerPrefs`, `cleanJobMeta`, `cleanSignature`, `cleanSiteDocs`, `cleanSiteHours`). Wejścia: dowolne napisy, JSON z kluczami `__proto__`, `constructor`, `prototype` obok prawdziwych kluczy formatów, JSON ucięty w losowym miejscu. Własności: (1) parser nie rzuca — wyjątek dopuszczony tylko tam, gdzie jest udokumentowany (`parseKeepJson` → `SyntaxError`, łapany w `import/plan.ts`; `parseFullBackup` → odrzucenie `Error`); (2) `Object.prototype` bez zmian; (3) wynik nie ma własnego klucza `__proto__`/`constructor`/`prototype` na żadnej głębokości. Limity: link ponad `SHARE_PARAM_MAX_CHARS` → `null`, tytuł i treść udostępnienia w limitach, paczka budowy ponad ~56 MB odrzucona, nowsza wersja formatu paczki i koperty kopii odrzucona.

**Ograniczenia i pułapki.** Zostają bez własności: wiadomości przekaźnika, metadane skarbca i XML KSeF (plan S1.7 wymienia je, ale ich parsery są asynchroniczne/kryptograficzne i wymagają osobnych generatorów). Dwa testy kontrolne pilnują samego harnessu: `dangerousKeys` widzi `__proto__`, a generator naprawdę go produkuje — inaczej testy przechodziłyby na pusto. Pierwszy przebieg nie znalazł błędu w kodzie; jedyne znalezisko (`SyntaxError` z `parseKeepJson`) było zachowaniem udokumentowanym.

**Testy.** `src/lib/untrustedInput.prop.test.ts` (23 przypadki).

**Commit.** Patrz historia `src/lib/untrustedInput.prop.test.ts`, 2026-11-23.

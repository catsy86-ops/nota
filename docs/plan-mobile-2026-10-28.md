# Plan mobile 2026-10-28: UI/UX, nowe funkcje, QoL, grafika, logika

## Context
Prośba: przeanalizować obecne UI i ułożyć plan na telefon (UI/UX, nowe funkcje, QoL, grafika i wizualizacja, logika i algorytmy), z podziałem na to, co jest jeszcze potrzebne, a co nie.
Źródła: trzy rozpoznania kodu (powłoka mobilna, wizualizacje i algorytmy, otwarte punkty w `roadmap.md`, `docs/plan-*.md`, `TODO.md`).
Wniosek ogólny: **fundament telefonu jest gotowy.** Dalsza praca to nie „mobile od nowa”. To kilka luk w powłoce, wykresy, które nie skalują się na 390 px, oraz dokończenie planów działów, które już leżą w repo.

Plan z tego dokumentu trafi do `docs/plan-mobile-2026-10-28.md` (statusy `[ ]`), z krótkim odnośnikiem w `roadmap.md`.

---

## 1. Co już jest i NIE wymaga pracy
- **Nawigacja:** `BottomNav.tsx` (Notatki, Dziś, FAB z przytrzymaniem, slot do wyboru, „Więcej”), szuflada `AppSidebar.tsx`, `ViewSheet.tsx`.
- **Wstecz zamyka warstwy:** `lib/overlayHistory.ts`.
- **Klawiatura:** `lib/keyboardInset.ts` (`--kb-inset`, `data-typing`).
- **Wejście i haptyka:** `lib/inputModality.ts`, `lib/haptics.ts`.
- **Gesty:** `hooks/useCardGestures.ts` (przesunięcie i przytrzymanie na kaflu).
- **Arkusze:** `ui/sheet.tsx` z punktami zaczepienia.
- **Wygląd:** warianty `desk:/phone:/coarse:/short:`, safe-area.
- **Cofanie:** undo w ok. 39 plikach i `RecentActionsPanel`.
- **Przechwytywanie i PWA:** `quickCapture.ts`, share target z plikami, Web Push, `OfflineStatus`.
- **Cel dotyku 44 px:** sprawdzany przez `e2e/touch-audit.spec.ts` i `touch-targets.spec.ts`.
- **Wydajność:** content-visibility na listach, MiniSearch ze zwijaniem polskich znaków.

## 2. Czego świadomie NIE robić (stare decyzje plus moja rekomendacja)
- **Decyzje już podjęte:** wirtualizacja (wraca dopiero przy >500 notatek albo <60 fps), React Compiler, Anchor/Popover API, `layoutId` kafel↔czytnik, crossfade widoków, blur pod warstwami, konta i chmura, formuły i relacje, wyszukiwanie w Ustawieniach, webcal.
- **Pull-to-refresh — NIE.** Dane są lokalne i Yjs odświeża je na żywo, więc nie ma czego „odświeżać”. `overscroll-behavior: contain` zostaje.
- **Przesunięcie od krawędzi między działami — NIE.** Gryzie się z systemowym gestem wstecz na Androidzie i iOS oraz z gestami kafli.
- **Osobny układ na tablet — NIE teraz.** `desk:` wystarcza, a 44 px jest już testowane na tablecie.
- **Barnes-Hut / quadtree w grafie — NIE.** Limit 150 węzłów utrzymuje O(n²) w akceptowalnym koszcie.
- **Pełny FSRS — NIE na start.** Najpierw poprawka SM-2 (patrz E1), FSRS wraca, gdy będzie dużo powtórek.
- **Kanwa z naciskiem rysika (Notatki 4.4), Faza 8 kanwa, Faza 9 lokalne AI:** poza zakresem mobile.

---

## 3. Co JEST potrzebne

### A. Powłoka i nawigacja (UI/UX)
| # | Punkt | Pliki | Wielkość |
|---|---|---|---|
| A1 | **Szukaj wszędzie na telefonie:** lupa w nagłówku każdego działu otwiera `CommandPalette` z kontekstem działu (plan QoL 3.9). Dziś „Więcej → Szukaj” wyrzuca do Notatek, a paleta wymaga 3 dotknięć. | `AppHeader.tsx`, `CommandPalette.tsx`, `BottomNav.tsx` | M |
| A2 | Ustawienia na pełnym ekranie na telefonie (Ustawienia 5.5) | `SettingsDialog.tsx` | S |
| A3 | Notatki: zakładki Edycja/Podgląd na telefonie (1.1) i tryb skupienia (4.5) | `NoteCard.tsx`, `NoteReader.tsx` | M |
| A4 | Arkusz „⋯” z grupami akcji notatki (Notatki 2.4) | `NoteCard.tsx` | S |
| A5 | Skrzynka: `enterKeyHint="send"` plus gesty przesunięcia (1.1, 3.5), z ponownym użyciem `useCardGestures` | `InboxCapture.tsx` | S |
| A6 | Kalendarz: kształty stanów dnia i legenda (K4.1), container query w komórce (K4.3), panel dnia rosnący z komórki (K4.5) | `calendar/*` | M |

### B. Nowe funkcje (telefon jako narzędzie w terenie)
| # | Punkt | Źródło |
|---|---|---|
| B1 | **Tryb rękawic:** cele 56 px plus Wake Lock w Karcie budowy | P5.2 |
| B2 | Przycisk zdjęcia jednym dotknięciem (`capture="environment"`) i zdjęcia „przed zakryciem” | P2.1, P2.2 |
| B3 | **Dziś: „Zaczynasz za… / Trwa”** z paskiem postępu zmiany z Grafiku | Dziś 2.1 |
| B4 | Grafik: pędzel „Własne godziny” i zapisany szablon tygodnia | G2.5, G4.6 |
| B5 | Grafik: porównanie z paskiem wypłaty (brutto wypłacone a wyliczone) | G4.4 |
| B6 | Minutnik budowy | P2.8 |

Czekają na decyzje (nie zaczynać bez odpowiedzi): P2.3 usterki, P2.5 PDF, P2.7 pinezki na planie, P2.10 lokalizacja. G4.9 dodatek nocny — zrezygnowane 2026-10-28.

### C. QoL (małe, szybkie)
- C1: Długi: ukrywanie kwot `•••` (3.3) i saldo narastające.
- C2: Ostrzeżenie egzaminu przy małej puli pytań (P4.3).
- C3: Ustawienia: „Wyślij kopię” przez share (3.1).
- C4: `text-wrap: pretty/balance` w nagłówkach i tekście (QoL 1.4).
- C5: Więcej haptyki w miejscach sukcesu i błędu (QoL 2.8), z ponownym użyciem `haptics.ts`.
- C6: Pasek postępu czytania w `NoteReader` (scroll-driven, QoL 2.5).

### D. Grafika i wizualizacja
| # | Punkt | Problem dziś | Rozwiązanie |
|---|---|---|---|
| D1 | **Graf notatek na telefonie** | `NoteGraph.tsx` ma stały viewBox 1000×620, więc przy 390 px skala to ~0,36 i węzły są nieczytelne | viewBox według proporcji kontenera (pion), szczypanie i przesuwanie (pointer events), dotknięcie węzła otwiera arkusz z podglądem, na telefonie domyślnie lokalny graf |
| D2 | Ćwiczenia: wykres wagi 30/90 dni, historia ćwiczenia z 1RM i punktem rekordu | jest tylko tekst ze średnią 7 dni | Recharts (już w paczce, leniwie, jak `YearCharts.tsx`) |
| D3 | Praca/Nauka: pierścień serii i heatmapa aktywności | seria to tylko liczba w `StudyStats.tsx` | uogólnić `YearHeatmap.tsx` do komponentu `ActivityHeatmap`, plus mały pierścień SVG |
| D4 | Obraz miesiąca Grafiku: legenda i znacznik „dziś” (dwa miesiące opcjonalnie) | | `monthImageDraw.ts` (G4.7) |
| D5 | Sprawdzić `ShiftSummary.tsx` i wykresy roczne przy 390 px (wysokość, etykiety osi) | | zrzuty Playwright `pixel-7` |

Zasady wykresów: skill `dataviz` przed kodem, kolory z tokenów stylu (10 stylów × 2 schematy), `aria-label` z podsumowaniem liczbowym, brak przewijania w bok.

### E. Logika i algorytmy
| # | Punkt | Szczegół |
|---|---|---|
| E1 | **Poprawka SM-2** (`lib/study/srs.ts`) | ease nigdy nie rośnie. Dodać wzrost przy q=5 i ocenę „trudne / dobrze / łatwe” po odpowiedzi (q 3/4/5). Zachować zgodność ze starymi kartami. Testy Vitest. |
| E2 | Wspólne zwijanie polskich znaków | `unlinkedMentions.ts` używa gołego `toLowerCase().includes`, a wyszukiwanie quizu też nie zwija (P4.2). Wynieść funkcję z `searchTerms.ts` / tokenizera i użyć w obu miejscach. |
| E3 | Import `.ics` / CSV do Grafiku z podglądem i Undo (G4.5) | wykorzystać `icsImport.ts` |
| E4 | Import pytań z `.md` (P4.5) | prosty parser, testy |
| E5 | Viewport grafu (D1) | transformacja macierzy zoom/pan w `noteGraph.ts`, bez zmiany algorytmu układu |

### F. Jakość pod telefon (konieczne przed „gotowe”)
- F1: **Ręczne QA na telefonie** (roadmap 5.3, motywy Faza 5): klawiatura, haptyka, gesty, słońce i noc, instalacja PWA. Lista kontrolna w dokumencie planu.
- F2: Naprawić 36 testów e2e Grafiku, które zakładają stare zmiany domyślne. Odświeżyć zrzuty wizualne.
- F3: Podział `pages/Index.tsx` (1238 linii), żeby A1 nie puchło w jednym pliku. Najpierw agent `architect` (Faza 10).

---

## 4. Kolejność (fale)
1. **Fala 1, szybkie zyski:** A1, E2, C1–C4, A2, A5. Największy efekt przy małym ryzyku.
2. **Fala 2, wizualizacja:** D1+E5, D2, D3, D5.
3. **Fala 3, teren:** B1, B2, B3, A6.
4. **Fala 4:** E1, B4, B5, E3, E4, A3, A4.
5. **Ciągle:** F2 przy każdej fali, F1 na końcu fali, F3 przed A1, jeśli `Index.tsx` przeszkadza.

## 5. Wykonanie po akceptacji
1. Zapisać ten plan jako `docs/plan-mobile-2026-10-28.md`, z checkboxami i sekcją „Decyzje otwarte”: A1 lupa w nagłówku czy w BottomNav, E1 trzy przyciski oceny czy dwa, P-7…P-11, G-1.
2. Dopisać odnośnik w `roadmap.md`.
3. Dodać wpis pamięci `plan-mobile-2026-10-28.md` i linię w `MEMORY.md`.
4. Kod dopiero na osobne polecenie, fala po fali. Przy każdej zmianie wyglądu najpierw skill `frontend-design`. Przy każdym punkcie zaktualizować `opis.md`.

## 6. Weryfikacja (dla realizacji)
- Każdy punkt: `tsc`, `vitest` (logika w `src/lib/**`: E1, E2, E4, E5), build z budżetem paczki 394 KB. D2 korzysta z istniejącego leniwego Recharts, więc nie powinien ruszyć głównego chunku.
- Telefon: Playwright `--project=pixel-7`, `touch-audit.spec.ts`, `mobile-layout.spec.ts` (brak przewijania w bok), zrzuty 390 px dla D1–D5. e2e tylko wtedy, gdy użytkownik o to poprosi.
- Dostępność: `e2e/a11y.spec.ts` (axe) przed zamknięciem fali.

---

## Status (2026-10-28)

Wykonanie po kolei, fala po fali. Opis techniczny: `opis.md`, sekcja „plan mobile 2026-10-28”.

### Fala 1 — szybkie zyski (zamknięta 2026-10-28)
- [x] **A1** Lupa na telefonie w nagłówku dla widoków bez pola szukania (otwiera paletę).
- [x] **A2** Ustawienia pełnoekranowe na telefonie — już było (`SettingsDialog.tsx:63`), bez zmian.
- [x] **A5** Skrzynka: `enterKeyHint="send"`. Gesty przesunięcia na dotyku w oknie porządkowania (w lewo archiwizuj, w prawo zostaw; `InboxTriage.tsx`). Kafle w Notatkach już miały gesty z `useCardGestures`.
- [x] **C4** `text-wrap: pretty` dla `p`/`li`.
- [x] **E2** Wspólne zwijanie polskich znaków — **zmieniony zakres**: w wzmiankach (`unlinkedMentions.ts`) zwijania NIE dodawać (tworzyłoby błędne linki). Quiz nie ma pola szukania (P4.2 nieaktualny). Konsolidacja 7 kopii `fold` — osobne, niski priorytet.
- [x] **C1** Długi: ukrywanie kwot (•••) — zrobione (`opis.md`, Długi — ukrywanie kwot). Saldo narastające „Saldo po tym” w historii osoby — zrobione (`runningBalances`, test w `model.test.ts`).
- [x] **C2** Ostrzeżenie egzaminu przy małej puli pytań (`QuizPanel.tsx`).
- [x] **C3** Ustawienia: „Wyślij kopię” przez arkusz udostępniania (`shareFullBackup`, tylko telefon z obsługą plików).
- [~] **C5** Haptyka sukcesu i ostrzeżenia — zrobione w Długach. Pozostałe ekrany (np. Ćwiczenia, Grafik) — do przejścia.
- [x] **C6** Pasek postępu czytania — już był (`.reader-progress` w `index.css`, plan QoL 2.5). Bez zmian.

### Poza planem, naprawione
- [x] Regresja P6.2: przycisk ZIP w karcie budowy (`zip` niezdefiniowane, typ `SiteCard` zamiast `SiteInfo`). `tsc` czysty.

- [x] **Lupa w dolnym pasku** (decyzja 2026-10-28: też w dolnym pasku) — commit e5831ae.
- [x] **E1** Ocena powtórki „Od nowa / Dobrze” (decyzja 2026-10-28) — bez wzrostu łatwości (brak q 5).

### Fala 2 — wizualizacja (częściowo, 2026-10-28)
- [~] **D1** graf na telefonie: pionowe płótno i przyciski przybliż/oddal/cały graf (`NoteGraph.tsx`, E5 w `noteGraph.ts`). Nie zrobione: szczypanie, przesuwanie palcem, arkusz z podglądem węzła.
- [x] **D2** wykres masy ciała 30/90 dni (`WeightChart.tsx`, Recharts nie użyty).
- [x] **D3** pierścień serii w Praca (heatmapa 12 tygodni już była, bez uogólniania).
- [x] **D5** przegląd `ShiftSummary` i wykresów rocznych przy 390 px (zrobione: podpisy osi X, czytelniejsza mapa dni; bez przewijania w bok).
- Ramki: ustawienie w Wyglądzie (delikatne/zwykłe/wyraźne), na prośbę użytkownika.

### Fala 4 — prawie zamknięta (2026-10-28)
- [x] **A4** arkusz „⋯” w grupach (`NoteCardActions.tsx`).
- [x] **E4** import pytań z .md (`questionsMd.ts`, `CustomQuestionsDialog.tsx`).
- [x] **B5** pasek wypłaty: porównanie brutto z szacunkiem (`payslip.ts`, `ShiftSummary.tsx`).
- [x] **E3** import .ics do Grafiku z podglądem liczb i Cofnij (`icsShifts.ts`, `ShiftsIcsImport.tsx`). Bez podglądu dzień po dniu i bez CSV.
- [~] **A3** zakładki Edycja/Podgląd na telefonie (1.1) i zegar skupienia z pierścieniem (4.5). Sprawdzenie na telefonie nie zrobione.
- [ ] **B4** pędzel „Własne godziny” i szablon tygodnia — nie zrobione (zmiany w widoku tygodnia).

### Fala 3 — teren (w toku, 2026-10-28)
- [x] **B3** „Zaczynasz za… / Trwa” z paskiem postępu (`TodayShiftCard.tsx`).
- [x] **B1** tryb budowa: cel dotyku 56 px; blokada wygaszania ekranu w karcie budowy (`SiteCardDialog.tsx`, `site.css`).
- [~] **B2** „Zdjęcie do wpisu” w karcie budowy zrobione; bez etapu (decyzja: bieżący etap z karty nie istnieje w modelu).
- [x] **A6** kalendarz: legenda kształtów (K4.1), zapytanie kontenerowe w komórce (K4.3), przejście przy wyborze dnia (K4.5; panel przenika się, nie rośnie z komórki). Całodniowy pasek (K4.1) pominięty — brak wydarzeń całodniowych w modelu.

### Fala 2–4 — niezrobione
- Fala 2 (wizualizacja): D1 graf na telefonie, D2 wykres wagi i historii, D3 heatmapa serii, D4 legenda obrazu miesiąca, D5 przegląd wykresów przy 390 px.
- Fala 3 (teren): B1 tryb rękawic, B2 zdjęcie jednym dotknięciem, B3 „Zaczynasz za…”, A6 kalendarz (kształty dni, legenda).
- Fala 4: E1 poprawka SM-2, B4 pędzel i szablon tygodnia, B5 porównanie z wypłatą, E3 import `.ics`, E4 import `.md`, A3 zakładki edycji, A4 arkusz „⋯”.
- F1 ręczne QA na telefonie, F2 odświeżenie e2e Grafiku (36 testów), F3 podział `Index.tsx`.

### Decyzje otwarte (potrzebne od właściciela)
- A1: lupa w nagłówku (zrobione) czy także w pasku dolnym — obecnie tylko nagłówek.
- E1: ocena SRS trzema przyciskami czy dwoma.
- B-punkty z P2.x, G4.9 (dodatek nocny) — czekają na wcześniejsze decyzje z planów Pracy/Grafiku.

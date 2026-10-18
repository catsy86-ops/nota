# Plan upiększenia wizualnego Notatnika (2026-10-18)

Źródło: trzy audyty tylko do odczytu (ekrany i typografia, ruch i detale, spójność i kontrast). Kontrast policzony z tokenów HSL, bez renderowania. Gradienty i przezroczystości nie są uwzględnione, więc przed zmianą trzeba potwierdzić wynik w przeglądarce.

## Charakter: tabliczka rysunkowa

Aplikacja ma być notatnikiem budowlanym i nauką, a nie generycznym dashboardem. Sygnatura to **tabliczka rysunkowa**: mała etykieta w prawym dolnym rogu papieru, w `font-mono`, z nazwą widoku i danymi (np. „PRACA · DZIENNIK BUDOWY · NR 14”, „GRAFIK · PAŹDZIERNIK 2026”). Plan już ma wersję (`.paper-grid::after` w `src/styles/skins.css`). Rozszerzenie na wszystkie skórki i widoki jest tanie: 0 KB JS.

Jeden moment ruchu, reszta spokojna: **pociągnięcie ołówka** przy zapisie (sekcja „Ruch”).

## Faza A — kontrast i poprawność (najpierw, to błędy dostępności)

| # | Co | Gdzie | Nakład | Ryzyko |
|---|----|-------|--------|--------|
| A1 | `text-destructive` w ciemnym Zeszycie: 3,90:1. Dodać `--destructive-ink` (jak `primary-ink`) i rozjaśnić destructive w ciemnym motywie | `src/index.css` (`.dark`), `src/styles/skins.css`, `tailwind.config.ts` | S | zmiana wyglądu przycisków usuwania (47 użyć) |
| A2 | Obramowanie pól w ciemnym Zeszycie: 1,34:1 (wymóg 3:1). Osobny token `--input` ok. 3:1 | `src/index.css`, `src/components/ui/input.tsx` | S | axe nie liczy 1.4.11, potrzebny własny test |
| A3 | Placeholder `gray-400` na sztywno, 2,60:1 w jasnym Zeszycie. Zamienić na `--muted-foreground` | `src/index.css` | S | minimalne |
| A4 | `text-primary` surowy w `JournalEntrySheet.tsx:596`, 2,65:1 | `src/components/JournalEntrySheet.tsx` | S | minimalne |
| A5 | Priorytety `text-*-500`: 2,15–3,67:1 na jasnej karcie. Użyć tokenów tekstu (`text-warning-ink`, nowe `info-ink`, `danger-ink`) | `src/lib/notePriority.ts`, `src/components/PriorityPicker.tsx` | S | test a11y nie ma notatki z priorytetem, trzeba dodać |
| A6 | Biały tekst na przycisku destructive: Neon 4,00, Zorza ~4,1; Miedź: górny stop gradientu ~3,5:1 | `src/styles/skins.css` | S | zmiana kolorów przycisków |

**Test:** nowy test jednostkowy czyta tokeny z `src/index.css` i liczy pary (tekst/tło, muted, ink, input, ring, destructive) dla każdego motywu i skórki, z progiem 4,5:1 i 3:1. W `e2e/a11y.spec.ts` dodać notatkę z priorytetem i asercję 3:1 dla pól. Najpierw poprawić kontrast, potem włączać asercje.

## Faza B — typografia i hierarchia

| # | Co | Gdzie | Nakład |
|---|----|-------|--------|
| B1 | Jedna skala nagłówków: tokeny `--text-view`, `--text-section`; h1 = 700, tracking −0,02 em. Usunąć `font-extrabold` (`AppHeader.tsx:100`) i `font-bold` (`ShiftsView.tsx:301`); nagłówki Praca bez wagi dostają tę samą | `src/index.css`, `AppHeader.tsx`, `ShiftsView.tsx`, `StudyView.tsx` | S |
| B2 | Etykiety sekcji jako jedna klasa `.section-label`: zdanie zamiast wersalików, `text-sm font-semibold`, licznik w `font-mono`, kreska tylko w Zeszycie. Zastępuje `NoteGroupSection.tsx:47` i `TodayDueList.tsx:32` | `src/index.css` | S |
| B3 | Fraunces (już wczytany w `src/main.tsx`, działa tylko w Zorzy) dla h1 Zeszytu, `SOFT` 50, waga 600 | `src/styles/skins.css` | S |
| B4 | Blok tytułowy widoku: h1 w `--text-view` i wiersz mono z datą i licznikiem na Dziś, Praca, Grafik (dziś brak tytułu w treści); na tych widokach ukryć h1 w nagłówku | `src/pages/Index.tsx`, `AppHeader.tsx` | M |

## Faza C — rytm i dane

| # | Co | Gdzie | Nakład |
|---|----|-------|--------|
| C1 | Skala odstępów w krokach 4 px: kafle `gap-3 sm:gap-4`, sekcje `gap-8 sm:gap-10` (dziś `gap-2.5` i `gap-6`) | `NoteGrid.tsx:168`, `Index.tsx:575` | S/M |
| C2 | Metadane kafla (data, liczba słów) w `font-mono text-[11px] tabular-nums` | `NoteCardBody.tsx:201` | S (sprawdzić ucinanie na 390 px) |
| C3 | Trzy tokeny promienia w `@theme`: control 8 px, field 12 px, card 16 px. Zastępują `rounded-lg`, `rounded-2xl` i 0,75 rem; wygląd bez zmian, system uporządkowany | `src/index.css`, `tailwind.config.ts` | S |

## Faza D — sygnatura i ruch

| # | Co | Gdzie | Nakład |
|---|----|-------|--------|
| D1 | Tabliczka rysunkowa na wszystkich skórkach i widokach: `data-view` na `<html>`, `pointer-events: none`, przygaszona na telefonie | `src/styles/skins.css`, hook widoku | S/M |
| D2 | Pociągnięcie ołówka przy zapisie: linia pod tytułem rysuje się 0–320 ms (`scaleX`, ease-out), potem wysycha do krycia 0,25. Wyzwalacz: przejście stanu zapisu, throttle 2 s (auto-zapis). Redukcja ruchu: linia od razu w stanie końcowym | `src/lib/saveStatus.ts`, `src/index.css` | S |
| D3 | Ilustracja pustych Notatek: `EMPTY_GLYPHS` dla `notes` (kartka, linia, długopis) przez istniejący `EmptySketch`; wybrać znak marki albo wordmark, nie oba | `src/components/EmptyState.tsx`, `src/lib/emptyGlyphs.ts` | S |
| D4 | Ujednolicić `strokeWidth` ikon lucide (np. 1,75) przez `[&_svg]` w przycisku; ręczne ikony (`ChecklistEditor.tsx`, strokeWidth 3) zostawić świadomie | `src/components/ui/button.tsx`, `EmptyState.tsx` | S |
| D5 | Przejście między widokami w `document.startViewTransition` z `view-transition-name` na nagłówku; test z `ViewSkeleton` (migotanie leniwych widoków) | `src/pages/Index.tsx`, `src/lib/viewChange.ts` | M |
| D6 | Zorza: `blur(36px)` z animacją transform wyłączyć na `coarse` i przy `prefers-reduced-data` | `src/styles/skins.css` | S |
| D7 | Papier Zeszytu: czerwony margines (token `--margin` na papierze, dziś tylko przy pasku bocznym) i ziarno SVG `feTurbulence` o kryciu ok. 0,4, pominięte na `coarse` | `src/index.css` (`paper-grid`), `src/components/PaperBackdrop.tsx` | S |

## Faza E — spójność z tokenami

| # | Co | Gdzie | Nakład |
|---|----|-------|--------|
| E1 | Kolory z palety Tailwinda w komponentach zamienić na tokeny: callouty (`MarkdownRendererImpl.tsx`), `FolderPicker.tsx` (8 × `bg-*-400`, na `[data-swatch]`), `SyncSettings.tsx`, `BackupSettings.tsx`, `StatsDialog.tsx` | jw. | M |
| E2 | `theme-color` PWA dla Zeszytu w ciemnym motywie liczyć z tokenu (dziś `#0f0d10`, chłodny fiolet przy ciepłym brązie tła) | `src/hooks/useTheme.ts:64` | S |
| E3 | Fallbacki `celebrate.ts` (`hsl(220 90% 60%)`, `hsl(280 80% 65%)`) na tokeny marki | `src/lib/celebrate.ts` | S |
| E4 | Stany jako „pieczątka” (`.card-stamp`, `.stamp-in`) zamiast kolorowych pigułek; cienie tylko dla uniesienia. Uwaga: `shadow-lg`, `xl`, `2xl` mapowane na `elevation-3`, więc przegląd wszystkich użyć | `src/index.css`, `tailwind.config.ts` | M |

## Decyzje, które wymagają Twojej odpowiedzi

1. **Tabliczka rysunkowa:** wszystkie skórki i widoki, czy tylko Zeszyt?
2. **Fraunces w Zeszycie:** nagłówki h1 w szeryfowym kroju, czy zostaje Jakarta?
3. **Efekty domyślnie:** konfetti, fajerwerki, tęcza, serduszka i bąbelki są domyślnie włączone i konkurują ze sobą. Zostawić 1–2 (przywrócenie z kosza, dzień zamknięty) i resztę wyłączyć domyślnie?
4. **Blok tytułowy (B4):** ukrywać h1 w nagłówku na Dziś, Praca i Grafik?
5. **Kolor destructive w ciemnym motywie (A1):** akceptujesz rozjaśnienie przycisków usuwania?

## Ograniczenia

- **Budżet bundla:** wejściowy JS ok. 381 KB gzip, próg w `e2e/bundle.spec.ts` to 384 KB. Zmiany są w CSS/SVG (koszt 0 KB) albo leniwe. Nowe biblioteki odpadają bez zmiany progu.
- **Weryfikacja:** zrzuty ekranu i kontrast w przeglądarce dla każdej zmiany w jasnym i ciemnym motywie oraz na 390 px i 1440 px.
- **Nie robimy:** nowych gradientów tekstu, glassmorphismu, fioletowych ani niebieskich akcentów domyślnych, kart z cieniem w każdej warstwie.

## Kolejność wykonania

A → B → C → D → E. Faza A pierwsza, bo to błędy dostępności. Po każdej fazie: typecheck, lint, testy jednostkowe, pełny e2e, zrzuty.

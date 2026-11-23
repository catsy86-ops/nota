# Ruch i animacje

Jedna strona zasad dla każdego, kto dodaje animację. Plan: `docs/plan-ruch-2026-11-15.md`. Zasady wyglądu: `docs/wyglad.md`.

## Zasady

1. **Ruch ma powód.** Pokazuje, skąd coś przyszło, dokąd poszło, albo że dotyk został przyjęty. Dekoracja (konfetti, pieczątka osiągnięcia) tylko w jednym miejscu na ekran.
2. **Czasy tylko z tokenów.** Dotyk 90 ms, mała zmiana 150, panel 220, duży arkusz 320. Wyjście krótsze od wejścia. Nic powyżej 320 ms poza dekoracją.
3. **Tylko `transform` i `opacity`.** Wysokość przez `interpolate-size` albo `grid-template-rows`, nie przez animację `height` w JS.
4. **CSS przed JS.** Framer Motion tylko tam, gdzie potrzebny jest gest, sprężyna zależna od prędkości, `layoutId` albo wyjście z drzewa. Reszta: przejścia CSS, `@starting-style`, View Transitions.
5. **Ograniczony ruch = zanikanie, nie brak informacji.** Przesunięcia znikają, zmiana stanu zostaje widoczna (przenikanie 150 ms).
6. **Przerywalność.** Każdą animację da się przerwać kolejnym dotykiem; nic nie blokuje wejścia.
7. **Haptyka idzie z ruchem.** `tap` przy przyjęciu, `selection` przy przełączeniu, `success`/`warn` tylko przy wyniku. Nigdy dwa razy na jedną czynność. `Switch` wibruje sam (`selection`) — przy przełączniku nie dopisuj `haptic` w wywołaniu.

## Tokeny

Źródło prawdy: zmienne w `src/styles/` (`--dur-*`, `--ease-*`). Lustro dla JS: `src/lib/motion.ts`. Zgodność obu pilnuje test w `src/test` (M1.2); ten sam wzór w Tailwindzie: `tailwind.config` (`transitionDuration`, `transitionTimingFunction`).

| Co | Czas | Token CSS / Tailwind | Token JS |
|---|---|---|---|
| Wciśnięcie (dotyk przyjęty) | 90 ms | `--dur-press` / `duration-press` | `dur.press` |
| Mała zmiana: kolor, pigułka, podpowiedź | 150 ms | `--dur-fast` / `duration-fast` | `dur.fast`, `tween.exit` |
| Panel, karta, wejście elementu | 220 ms | `--dur-base` / `duration-base` | `dur.base`, `tween.enter` |
| Duży arkusz, dialog pełnoekranowy | 320 ms | `--dur-slow` / `duration-slow` | `dur.slow` |

Krzywe: `--ease-out` / `ease-out-soft` (wejście, domyślna), `--ease-in` / `ease-in-soft` (wyjście), `--ease-std` / `ease-std` (zmiana w miejscu). Sprężyny: `spring.snap` (pigułka aktywnej pozycji, przełączniki), `spring.soft` (panele wjeżdżające z krawędzi).

## Który wzór kiedy

| Potrzeba | Wzór | Przykład w repo |
|---|---|---|
| Zmiana koloru, tła, krawędzi | klasy `transition-*` + `duration-fast` | przyciski, pigułki |
| Wejście elementu z drzewa | `m.div` z `tween.enter`, `exit` z `tween.exit` | karty, dymki |
| Wejście bez przemontowania (zachowuje stan) | `playEnter(el, from)` w `motion.ts` | szkic w pasku nowej notatki |
| Karta znika po akcji | `cardExit(intent, id, reduced)` w `src/lib/cardMotion.ts` | kosz, archiwum w Notatkach |
| Kolejność wejścia listy | `cascadeDelay(index, reduced)` | lista notatek |
| Przejście między widokami | `withViewTransition` + `html[data-vt-dir]` w `src/styles/app/effects.css` | zmiana widoku, panel dnia w Kalendarzu |
| Wciśnięcie elementu dotykowego | klasa `pressable` (`src/styles/app/utilities.css`): `translate` 1 px + `brightness`, `--dur-press`; nie skala | `Button`, wiersze, karty |
| Okno, arkusz, popover, menu | `OVERLAY_FADE` i `POPUP_MOTION` z `src/components/ui/overlay-motion.ts` (nie kopiuj list klas) | `Dialog`, `Sheet`, `Popover`, `DropdownMenu` |
| Liczba zmienia się po akcji | `AnimatedNumber` (`src/components/ui/animated-number.tsx`); liczy tylko po `recentUserAction()`, przy synchronizacji przeskakuje | saldo Długów, podsumowanie Grafiku |
| Zwijanie sekcji | `m.div` z `height: "auto"` w `AnimatePresence` (framer mierzy sam); w CSS `interpolate-size` jest już globalnie | grupy notatek, foldery w panelu bocznym |
| Proste pokazanie i schowanie (bez gestu, `layout`, przesunięcia) | `presence-fade` / `presence-pop` (`utilities.css`) + `data-shown`; element zostaje w drzewie | przyciski w polu szukania, tło panelu bocznego |
| Rysowanie obrysu | `@keyframes` + `var(--dur-*)` | `pencil-draw`, `sketch-draw` |

## Ograniczony ruch

`html[data-motion="reduced"]` ustawia `useMotionPref` (ustawienie aplikacji + `prefers-reduced-motion`); framer-motion dostaje to przez `MotionConfig reducedMotion`. Animacje przez Web Animations API (`playEnter`) i `@keyframes` sprawdzają atrybut same — nie podlegają `MotionConfig`. Każda nowa animacja ma przejść ten sam test: przy ograniczonym ruchu zmiana stanu jest nadal widoczna.

## Straż

- `duration-<liczba>` i literały `duration: 0.x` w `.tsx` poza `motion.ts` łamią test źródeł (M1.5). Potrzebujesz innego czasu — wybierz token albo dopisz wyjątek z komentarzem.
- Stałego `will-change` nie dodajemy (M1.6); tylko na czas animacji.
- Martwych `@keyframes` nie zostawiamy (M1.3) — nazwy składane w motywach sprawdź przed usunięciem.

## Pomiar klatek (M2.1–M2.2, 2026-11-22)

Test: `e2e/motion-frames.spec.ts`, uruchamiany na żądanie: `PERF=1 npx playwright test e2e/motion-frames.spec.ts --project=pixel-7`. Telefon Pixel 7 w Playwright, produkcyjny build, procesor zdławiony ×4 (`CPU_RATE`), 300 notatek w ręcznym porządku, układ mozaiki (domyślny). Klatki liczy pętla `requestAnimationFrame`, a długie klatki Long Animation Frames, razem z przypisaniem do skryptu. `PROFILE=<fragment nazwy kroku>` zapisuje profil CPU tego kroku. `FRAMES_STRICT=1` włącza próg 50 ms.

Kolejność kroków: otwarcie notatki, zmiana zakładki, arkusz, przeciągnięcie, a przewijanie na końcu. Po geście przewijania wysłanym przez CDP Chromium nie zamieniał następnego stuknięcia w `click`, więc przy przewijaniu na początku krok „otwarcie notatki” bywał pusty, a „wstecz” wychodziło z aplikacji.

Pojedynczy przebieg waha się nawet dwukrotnie (obciążenie maszyny), dlatego porównania to mediany z 5 przebiegów.

| Ścieżka (CPU ×4) | Przed M2.1: najdłuższa klatka | Po M2.1 i M2.2: klatki > 50 ms, najdłuższa (mediana) | Co zostało w najdłuższej klatce |
|---|---|---|---|
| Przewijanie 300 notatek | 250–300 ms (31–40 klatek > 50 ms) | 0, 50 ms | — |
| Otwarcie notatki | 683 ms | 1, 400 ms | render czytnika i jeden pełny układ strony |
| Zmiana zakładki (Notatki → Dziś → Notatki) | 317 ms | 7, 267 ms | render widoku po zmianie trasy |
| Otwarcie i zamknięcie arkusza „Widok” | 300 ms | 4, 300 ms | otwarcie: `focus()` w FocusScope Radix wymusza układ (~190 ms) |
| Przeciągnięcie karty | 350 ms | 2, 283 ms (raz na kilka przebiegów 33 ms) | `handleEnd` dnd-kit i render po zmianie kolejności |

Przy CPU ×1 żadna ścieżka poza otwarciem notatki (~110 ms) nie przekracza 82 ms.

### Znaleziska i poprawki

- **Przewijanie (M2.1).** Paralaksa stylu Zorza (`src/lib/scrollParallax.ts`) ustawiała `--sig-scroll` na `<html>` w każdej klatce przewijania, niezależnie od stylu. Zmienna dziedziczy się w całe drzewo, więc styl kart był unieważniany co klatkę. Zaraz potem `useHideOnScroll` czytał `window.scrollY` i wymuszał przeliczenie, razem ~5 s na 6 s przewijania. Teraz paralaksa działa tylko przy `data-skin="zorza"`.
- **Zamknięcie warstwy (M2.2).** Zamknięcie z interfejsu (×, Escape, zsunięcie) robi `history.back()`. Router dostawał wtedy `popstate` i przerysowywał cały widok (~220 ms), choć adres się nie zmieniał. `overlayHistory.ts` ma teraz słuchacza zarejestrowanego przed routerem (przy wczytaniu modułu, import w `App.tsx`). Zatrzymuje on tylko własne cofnięcie przy identycznym adresie. „Wstecz” systemowe idzie do routera jak dawniej.
- **Escape i skróty siatki (M2.2).** `handleGridNavKey` liczył kolumny siatki (`getComputedStyle`) przy każdym klawiszu, także przy Escape zamykającym arkusz (~150–245 ms). Teraz liczy je tylko dla ↑/↓.
- **Otwarcie z kafla (M2.2).** `useOriginFromTile` mierzył kafel i panel w efekcie układu, w środku zatwierdzania renderu, a blokada przewijania Radix zaraz to unieważniała. Wychodziły dwa pełne układy zamiast jednego (~180 ms). Pomiar jest teraz w `requestAnimationFrame` przed malowaniem. Zmienne skali okna (`--tw-enter-*`) zostają ustawiane od razu.

### Sprawdzone i odrzucone

- `layout` framer-motion na kartach: wyłączenie oszczędza tylko ~40 ms przy otwarciu notatki. Pomiar przewijania nie pokazał kosztu projekcji układu, więc `layout="position"` i `layoutScroll` z planu nie mają tu uzasadnienia.
- `pointer-events: none`, które Radix ustawia na `<body>` przy oknach modalnych: mikropomiar pokazał ~50 ms przeliczenia stylu na 24 karty. Jawne `#root { pointer-events: auto }` nie zmieniło jednak klatki otwarcia arkusza, więc to nie jest główny koszt.

- `content-visibility` w mozaice (sprawdzone 2026-11-23, zgoda właściciela na próbę): mediana z 5 przy CPU ×4 — otwarcie arkusza 267 → 217 ms, ale przeciągnięcie karty 333 → 433 ms (na czas przeciągania `content-visibility` jest zdejmowane, więc start układa naraz wszystkie pominięte kafle). Otwarcie notatki, zmiana zakładki i przewijanie bez zmian. Bilans ujemny — mozaika zostaje bez `data-cv`.

### Co zostaje (kryterium etapu nadal niespełnione)

- **Otwarcie arkusza:** `focus()` w FocusScope wymusza pełny układ strony z kartami mozaiki. Mozaika nie ma `content-visibility` (potrzebuje prawdziwych wysokości do rozpiętości), więc układane są wszystkie wyrenderowane karty.
- **Zmiana zakładki i koniec przeciągania:** render całej listy.
- **Otwarcie notatki:** render czytnika.

Wszystkie trzy zależą od liczby kart w drzewie. `content-visibility` w mozaice sprawdzone i odrzucone (wyżej). Dalszy kierunek to mniej kart w drzewie (okienkowanie), a to osobna decyzja.

INP z `web-vitals-phone.spec.ts` (bez dławienia) po M2.1: mediana 160–176 ms, LCP 160–280 ms.

## Do zrobienia

Przejścia między działami i arkusze z gestem (M4), zrzuty z wyłączonym ruchem i film (M5.5).

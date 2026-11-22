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

## Pomiar klatek (M2.1, 2026-11-22)

Test: `e2e/motion-frames.spec.ts`, uruchamiany na żądanie: `PERF=1 npx playwright test e2e/motion-frames.spec.ts --project=pixel-7`. Telefon Pixel 7 w Playwright, produkcyjny build, procesor zdławiony ×4 (`CPU_RATE`), 300 notatek w ręcznym porządku. Klatki z pętli `requestAnimationFrame`, długie klatki z Long Animation Frames razem z przypisaniem do skryptu. `PROFILE=1` zapisuje profil CPU przewijania. `FRAMES_STRICT=1` włącza próg 50 ms.

| Ścieżka | Przed poprawką: klatki > 50 ms, najdłuższa | Po poprawce: klatki > 50 ms, najdłuższa | Co zajmuje klatkę |
|---|---|---|---|
| Przewijanie 300 notatek | 31–40, 250–300 ms | 1–2, 50–83 ms | — |
| Otwarcie notatki | 1, ~600 ms | 1, ~530 ms | render Reacta po stuknięciu (montaż edytora i czytnika) |
| Zmiana zakładki (Notatki → Dziś → Notatki) | 5–8, 230–340 ms | 8, ~270 ms | render widoku po zmianie trasy |
| Otwarcie i zamknięcie arkusza „Widok” | 10–12, ~350 ms | 3, ~280 ms | po ~220 ms przy otwarciu, przy Escape i przy `popstate` |
| Przeciągnięcie karty | 3–7, 300–440 ms | 3, ~320 ms | `handleEnd` dnd-kit i render po zmianie kolejności |

Przy CPU ×1 żadna ścieżka poza otwarciem notatki (~110 ms) nie przekracza 82 ms.

**Znalezisko i poprawka:** paralaksa stylu Zorza (`src/lib/scrollParallax.ts`) ustawiała `--sig-scroll` na `<html>` w każdej klatce przewijania, niezależnie od stylu. Zmienna dziedziczy się w całe drzewo, więc styl 300 kart był unieważniany co klatkę. `useHideOnScroll` czytał zaraz potem `window.scrollY` i wymuszał pełne przeliczenie stylu i układu, co dawało ~5 s na 6 s przewijania. Teraz paralaksa działa tylko przy `data-skin="zorza"`.

**Kryterium etapu niespełnione:** pojedyncze klatki po stuknięciu mają 270–530 ms przy CPU ×4. To pojedyncze rendery Reacta, nie animacje. Kierunki na M2.2:
- Zamknięcie warstwy robi `history.back()` (`overlayHistory.ts`). Na `popstate` reaguje też router i przerysowuje widok, choć adres się nie zmienił.
- Otwarcie notatki: koszt montażu czytnika (~480 ms przy ×4).
- Zmiana zakładki i koniec przeciągania: render całej listy.

INP z `web-vitals-phone.spec.ts` (bez dławienia) po poprawce: mediana 160–176 ms, LCP 160–280 ms.

## Do zrobienia

Renderowanie po stuknięciu (M2.2, kierunki wyżej), przejścia między działami i arkusze z gestem (M4), zrzuty z wyłączonym ruchem i film (M5.5).

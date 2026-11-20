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
| Rysowanie obrysu | `@keyframes` + `var(--dur-*)` | `pencil-draw`, `sketch-draw` |

## Ograniczony ruch

`html[data-motion="reduced"]` ustawia `useMotionPref` (ustawienie aplikacji + `prefers-reduced-motion`); framer-motion dostaje to przez `MotionConfig reducedMotion`. Animacje przez Web Animations API (`playEnter`) i `@keyframes` sprawdzają atrybut same — nie podlegają `MotionConfig`. Każda nowa animacja ma przejść ten sam test: przy ograniczonym ruchu zmiana stanu jest nadal widoczna.

## Straż

- `duration-<liczba>` i literały `duration: 0.x` w `.tsx` poza `motion.ts` łamią test źródeł (M1.5). Potrzebujesz innego czasu — wybierz token albo dopisz wyjątek z komentarzem.
- Stałego `will-change` nie dodajemy (M1.6); tylko na czas animacji.
- Martwych `@keyframes` nie zostawiamy (M1.3) — nazwy składane w motywach sprawdź przed usunięciem.

## Do zrobienia

Pomiar klatek (M2), CSS zamiast JS (M3), przejścia między działami i arkusze z gestem (M4), stan wciśnięcia i przegląd haptyki (M5.4–M5.5). Wyniki pomiaru M2.1 trafią tutaj.

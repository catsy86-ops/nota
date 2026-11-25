# Zależności — raport A5.5 (2026-11-25)

Punkt A5.5 z `plan-architektura-2026-11-15.md`: `npm audit` i `knip` jako raport. Usuwanie i aktualizacje idą w osobnych commitach, po decyzji.

## `npm audit`

Stan na 2026-11-25: 16 zgłoszeń, 4 niskie i 12 średnich. W kodzie trafiającym do przeglądarki (`npm audit --omit=dev`) są tylko 4 niskie, wszystkie z łańcucha KaTeX.

| Pakiet | Waga | Gdzie | Poprawka z `npm audit` | Ocena |
|---|---|---|---|---|
| `katex` 0.16 (przez `rehype-katex`, `remark-math`, `micromark-extension-math`) | niska | przeglądarka: wzory w notatkach | `katex@0.19.1`, zmiana łamiąca | Atak wymaga zanieczyszczonego prototypu, czyli wcześniejszego XSS. Ten zamykają CSP z Trusted Types (S1.1) i brak ujść HTML. Proponowane: przejść na KaTeX 0.19 w osobnym kroku, ze sprawdzeniem e2e wzorów (`rehype-katex` musi go przyjąć). |
| `vite-plugin-pwa` → `workbox-build` → `glob`, `minimatch` | średnia | tylko build | `vite-plugin-pwa@1.1.0`, cofnięcie wersji | Dotyczy narzędzia budowania na naszej maszynie, nie aplikacji. Cofanie wtyczki PWA nie ma sensu. Czekamy na nowsze `workbox-build`. |
| `@tailwindcss/typography` → `postcss-selector-parser` | średnia | tylko build | `@tailwindcss/typography@0.5.4`, cofnięcie wersji | Jak wyżej: kwadratowy czas parsowania selektorów w buildzie. Bez działań. |
| `typescript-eslint` i `@typescript-eslint/*` | średnia | tylko lint | dostępna bez zmiany łamiącej | Jedyna poprawka do zrobienia od razu: `npm audit fix` aktualizuje `typescript-eslint`. Potem `npm run lint` i typecheck. |

## `knip`

Nie uruchomiony w tej sesji. `npx -y knip` pobiera i wykonuje pakiet z sieci, a automatyczny tryb uprawnień zablokował to jako wykonanie obcego kodu. Uruchom sam:

```
! npx knip --reporter compact
```

Wynik (nieużywane pliki, eksporty i zależności) trafi wtedy do tego pliku, a usuwanie do osobnych commitów, po jednym rodzaju na commit.

## Do zdecydowania

1. `npm audit fix` dla `typescript-eslint`, tylko narzędzia deweloperskie: zalecane.
2. KaTeX 0.19 (zmiana łamiąca w zależności produkcyjnej): w osobnym kroku, z agentem `performance-engineer` (rozmiar paczki) i e2e wzorów.
3. Uruchomienie `knip`.

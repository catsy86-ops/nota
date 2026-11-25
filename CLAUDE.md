# CLAUDE.md

Wskazówki dla Claude Code w tym repozytorium.

## Dokumentacja techniczna (`opis.md` i `docs/opis/`)

Po zakończeniu każdego zadania zapisz w pliku działu w `docs/opis/` (np. `docs/opis/notatki.md`), co zostało zrobione — jako dokumentację techniczną. `opis.md` w katalogu głównym to spis: przy nowym rozdziale dopisz jego tytuł pod właściwym działem. Opisz każdą dodaną lub zmienioną funkcję aplikacji:

- **Co robi** — z punktu widzenia użytkownika, krótko.
- **Gdzie jest** — pliki i komponenty (`src/...`), najważniejsze funkcje i typy z nazwy.
- **Jak działa** — model danych (np. mapy Yjs, klucze localStorage), przepływ danych, decyzje projektowe i ich powód.
- **Ograniczenia i pułapki** — limity, przypadki brzegowe, zgodność ze starszymi danymi.
- **Testy** — które pliki testów to sprawdzają.
- **Commit** — skrót hasha i data.

Jeden plik na dział aplikacji (Notatki, Dziś, Terminy, Kalendarz i Grafik, Praca, Osobiste, Dane, Powłoka, Wygląd, Wspólne, Jakość) — listę plików ma spis w `opis.md`. Gdy zmieniasz istniejącą funkcję, popraw jej opis, zamiast dopisywać nowy — plik ma opisywać aktualny stan, nie historię.

## Zmiana kształtu danych

Przed zmianą, która dodaje, przenosi albo usuwa pole, mapę Yjs, klucz `localStorage`, bazę IndexedDB albo sekcję kopii, przeczytaj `docs/dane-wersje.md` (zasady, limity pól, dziennik formatów, lista kontrolna).

## Zarządzanie kontekstem

Po zakończeniu każdego zadania (taska) wyczyść kontekst poleceniem `/clear` lub `/compact`, zanim zaczniesz kolejne zadanie.

## Narzędzia, agenci i skille do dopracowywania

Stos: Vite + React + TypeScript, Yjs (dane), Vitest (unit), Playwright (e2e, zrzuty, axe), PWA. Nie ma Next.js — agentów z `.claude/agents/` czytaj przez ten stos.

- **Zmiany wyglądu:** skill `frontend-design` przed kodem (reguła z pamięci), potem `refactoring-ui` i `ux-heuristics` przy przeglądzie.
- **Dostępność:** `design:accessibility-review` oraz `e2e/a11y.spec.ts` (axe, WCAG 2.2 AA) przed zamknięciem działu.
- **Testy:** agent `testing-engineer` do e2e i zrzutów; Vitest dla logiki (`src/lib/**`).
- **Wydajność:** agent `performance-engineer` przy nowych zależnościach albo wzroście paczki (budżety w `e2e/bundle.spec.ts`: wejściowy JS ≤ 500 KB gzip, precache ≤ 4,65 MiB).
- **Bezpieczeństwo:** agent `security-reviewer` przy Yjs, sync, udostępnianiu plików, CSP i przekaźniku.
- **Architektura:** agent `architect` tylko przed dużą zmianą granic modułów.
- **Dokumentacja:** skill `technical-documentation` przy `docs/opis/`, `opis.md` i README.
- **Przed commitem:** `simplify` (jakość) i `code-review` (błędy) na diffie etapu.
- **Uprawnienia:** wspólne polecenia testów, builda i git (tylko odczyt) są w `.claude/settings.json`.
- **MCP (Playwright, context7, Chrome):** połączone na poziomie użytkownika, nie w repo — żeby nie dublować serwerów w każdym projekcie.

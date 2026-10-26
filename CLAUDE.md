# CLAUDE.md

Wskazówki dla Claude Code w tym repozytorium.

## Dokumentacja techniczna (`opis.md`)

Po zakończeniu każdego zadania zapisz w `opis.md` (w katalogu głównym repozytorium), co zostało zrobione — jako dokumentację techniczną. Opisz każdą dodaną lub zmienioną funkcję aplikacji:

- **Co robi** — z punktu widzenia użytkownika, krótko.
- **Gdzie jest** — pliki i komponenty (`src/...`), najważniejsze funkcje i typy z nazwy.
- **Jak działa** — model danych (np. mapy Yjs, klucze localStorage), przepływ danych, decyzje projektowe i ich powód.
- **Ograniczenia i pułapki** — limity, przypadki brzegowe, zgodność ze starszymi danymi.
- **Testy** — które pliki testów to sprawdzają.
- **Commit** — skrót hasha i data.

Funkcje grupuj według działów aplikacji (Notatki, Grafik, Nauka, …). Gdy zmieniasz istniejącą funkcję, popraw jej opis, zamiast dopisywać nowy — plik ma opisywać aktualny stan, nie historię.

## Zarządzanie kontekstem

Po zakończeniu każdego zadania (taska) wyczyść kontekst poleceniem `/clear` lub `/compact`, zanim zaczniesz kolejne zadanie.

## Narzędzia, agenci i skille do dopracowywania

Stos: Vite + React + TypeScript, Yjs (dane), Vitest (unit), Playwright (e2e, zrzuty, axe), PWA. Nie ma Next.js — agentów z `.claude/agents/` czytaj przez ten stos.

- **Zmiany wyglądu:** skill `frontend-design` przed kodem (reguła z pamięci), potem `refactoring-ui` i `ux-heuristics` przy przeglądzie.
- **Dostępność:** `design:accessibility-review` oraz `e2e/a11y.spec.ts` (axe, WCAG 2.2 AA) przed zamknięciem działu.
- **Testy:** agent `testing-engineer` do e2e i zrzutów; Vitest dla logiki (`src/lib/**`).
- **Wydajność:** agent `performance-engineer` przy nowych zależnościach albo wzroście paczki (próg 394 KB, patrz `opis.md`).
- **Bezpieczeństwo:** agent `security-reviewer` przy Yjs, sync, udostępnianiu plików, CSP i przekaźniku.
- **Architektura:** agent `architect` tylko przed dużą zmianą granic modułów.
- **Dokumentacja:** skill `technical-documentation` przy `opis.md` i README.
- **Przed commitem:** `simplify` (jakość) i `code-review` (błędy) na diffie etapu.
- **Uprawnienia:** wspólne polecenia testów, builda i git (tylko odczyt) są w `.claude/settings.json`.
- **MCP (Playwright, context7, Chrome):** połączone na poziomie użytkownika, nie w repo — żeby nie dublować serwerów w każdym projekcie.

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

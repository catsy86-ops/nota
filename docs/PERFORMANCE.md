# Wydajność Pracy — pomiar (plan B0.4)

Mierzymy na telefonie, nie w przeglądarce komputera. Wynik trafia do tej tabeli, a od niego zależy Faza 5 planu `plan-praca-budowa-2026-11-10.md`.

## Jak mierzyć

1. `node scripts/seed-praca.mjs seed-praca.json 3000 40` — kopia pełna z 3 000 wpisami i 40 budowami (bez zdjęć, dane zmyślone).
2. Ustawienia → Kopia i dane → Przywróć → wybierz `seed-praca.json`.
3. Przejdź ścieżką: Praca → Dziennik → otwórz 5 budów → przełącz 5 zakładek → zapisz 3 wpisy.
4. Ustawienia → Kopia i dane → „Raport diagnostyczny” → Pobierz. Sekcja „wydajność Pracy” ma p75 reakcji na stuknięcie, najgorszą długą klatkę i czasy `otwarcie-karty-budowy` oraz `zakladka-*`.
5. Do tabeli wpisz urządzenie, wersję (`build` z raportu) i liczby. Na komputerze włącz w DevTools throttling CPU ×4 i powtórz.

Obserwatory (`src/lib/study/perf.ts`) włączają się przy wejściu w Pracę i liczą tylko czasy, bez treści. Liczby są z jednego przebiegu aplikacji (pamięć, bez zapisu).

## Cele

| Miara | Cel |
|---|---|
| Otwarcie karty budowy (do 2 klatek) | mediana < 300 ms |
| Reakcja na stuknięcie | p75 < 200 ms |
| Długa klatka | najgorsza < 200 ms |

## Wyniki

| Data | Urządzenie | Build | Karta (mediana) | Stuknięcie p75 | Długa klatka (max) |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

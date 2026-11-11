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

## Jak mierzyć bez telefonu (emulacja)

`node scripts/seed-praca.mjs seed.json 3000 40`, potem `npm run build && npx vite preview --port 4174` i
`node scripts/measure-praca.mjs seed.json http://127.0.0.1:4174 5 4` (Pixel 7 w Chromium, dławienie CPU ×4, pięć kolejnych sesji;
czasy liczone w stronie od `pointerdown` do dwóch klatek, bez locatorów Playwrighta, bo `getByRole` liczy nazwy dostępności po całym
DOM pod dławieniem i zawyża wyniki kilkukrotnie). Profil CPU jednej akcji: `node scripts/profile-praca.mjs seed.json karta|dziennik|szukaj`.
To przybliżenie telefonu średniej klasy, nie pomiar na urządzeniu — liczby służą do porównań przed/po.

## Wyniki

| Data | Urządzenie | Build | Karta (mediana) | Stuknięcie p75 | Długa klatka (max) |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
| 2026-11-11 | emulacja Pixel 7, CPU ×4, 3000 wpisów, 40 budów, **przed B5.3** | master 372d6fdd | 503 ms | 592 ms | 1410 ms (otwarcie) |
| 2026-11-11 | to samo, **po B5.3 (`<Activity>`)** | + StudyView | 514 ms | 216 ms | 1446 ms (otwarcie) |

Szczegóły (mediana z 5 sesji, ms): przełączenie na Dziennik 570 → 203, z Nauki na Dziennik 619 → 192, na Budowę 172 → 125, na Naukę 159 → 114;
pierwsze zapytanie w palecie 451 → 445; pamięć po sesji 39 → 32 MB; otwarcie Dziennika do pierwszego wpisu ok. 3,0 s (rozruch aplikacji z 3000
wpisami, bez zmiany); oś ma w DOM 120 wpisów (ostatnie 30 dni), cały DOM ok. 4,7 tys. węzłów; najdłuższe zadanie przy przewijaniu 127 ms.

### Wnioski dla Fazy 5 (2026-11-11)

- **B5.3 zrobione:** warunek (pamięć bez regresji) spełniony — pamięć spadła. Reakcja na stuknięcie p75 592 → 216 ms (cel 200).
- **B5.1 (wirtualizacja osi) nie jest potrzebna:** oś ma 120 wpisów w DOM, grupy dni mają `content-visibility: auto`, a po B5.3 powrót na oś kosztuje ~200 ms.
- **Karta budowy 503 ms** (cel 300) — osobny temat (renderowanie karty), nie dotyczy Fazy 5.
- **B5.5 (OPFS) zostaje odłożone** (decyzja architekta B-7): pamięć ~35 MB, zdjęć w pomiarze nie ma, brak sygnału.


# Praca — lista kontrolna QA na telefonie (R1.1)

Scenariusz „dzień hydraulika”. Wykonaj na prawdziwym telefonie, w zainstalowanej PWA. Przy każdym punkcie wpisz ✅ / ❌ i krótką uwagę. Uwagi w trakcie dnia zapisuj w Skrzynce z etykietą `#praca-uwagi` (R1.2).

**Warunki:** w rękawicach roboczych · w pełnym słońcu · w trybie samolotowym · z ok. 300 zdjęciami w pamięci telefonu.

## Przygotowanie
- [ ] Aplikacja zainstalowana (PWA), ostatnia wersja (Ustawienia → Diagnostyka → wersja).
- [ ] Zdjęcia: 300 w galerii; trwały magazyn przyznany (karta budowy, linia „Zdjęcia”).
- [ ] Ostatnia kopia nie starsza niż 3 dni.

## Ścieżka dnia
| # | Krok | Cel | Wynik | Uwagi |
|---|---|---|---|---|
| 1 | Otwarcie Pracy → karta bieżącej budowy | ≤ 2 stuknięcia | | |
| 2 | Zdjęcie do wpisu (aparat systemowy) | ≤ 2 | | |
| 3 | Wpis z kształtkami („+ Kolano 16”) | ≤ 3 | | |
| 4 | Brak materiału | ≤ 3 | | |
| 5 | Odhaczenie etapu | ≤ 3 | | |
| 6 | Godziny dnia (start/stop albo ręcznie) | ≤ 3 | | |
| 7 | Raport do szefa | ≤ 2 | | |
| 8 | Koniec dnia: godziny + raport + zamówienie (cel ≤ 6 stuknięć łącznie) | ≤ 6 | | |

## Funkcje terenowe (próba)
- [ ] Wpis głosowy / dyktowanie (online) — czy rozumie „trzy kolanka szesnaście”.
- [ ] Dyktowanie w trybie samolotowym (H6.1) — działa na urządzeniu czy nie.
- [ ] Nagranie i dyktowanie naraz (H6.2) — mikrofon da się oba, czy punkt odpada.
- [ ] Minutnik próby szczelności: zamknięcie aplikacji, alert na koniec.
- [ ] Poziomica (spadek %), kalibracja na płaskiej powierzchni.
- [ ] Aparat w aplikacji z latarką (szacht, kotłownia).
- [ ] Skaner kodu przy przyjęciu do auta.
- [ ] Kontakty z telefonu (Android).
- [ ] NFC (jeśli używasz).
- [ ] Podsumowanie AI na urządzeniu (jeśli model jest dostępny).

## Warunki trudne
- [ ] Rękawice: czy któryś cel dotyku jest za mały (zanotuj który).
- [ ] Słońce: czy tekst i przyciski są czytelne w trybie jasnym i ciemnym.
- [ ] Tryb samolotowy: wpis, zdjęcie, godziny zapisują się; po powrocie sieci synchronizacja bez błędu.
- [ ] 300 zdjęć: czas otwarcia karty i listy zdjęć (subiektywnie: płynnie / ścina).
- [ ] R4.2: po dniu ze zdjęciami Ustawienia → Diagnostyka → raport: linia `zdjecie-zapis` (mediana, p75). Powyżej ~1500 ms albo „ścina” przy kilku zdjęciach naraz → wdrożyć kolejkę w tle (zapis wpisu bez czekania na zdjęcia).

## Wynik
Wpisz wyniki do `opis/praca.md` (sekcja „QA na telefonie”) i uwagi do R1.3. Problemy blokujące oznacz `#praca-uwagi`.

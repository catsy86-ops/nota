# Plan: dział Ćwiczenia (zapisany 2026-10-20, realizacja później)

Status: **pomysł zapisany, nic nie zaimplementowane.** Dział nie ma jeszcze kodu, trasy ani pozycji w menu.

## Cel

Prowadzenie treningów w domu i notatek o odżywianiu w jednym miejscu aplikacji:
- plan i dziennik treningów przy sprzęcie, który jest w domu,
- odżywki (na początek kreatyna) z przypomnieniem o dawce,
- dieta jako prosty dziennik, bez liczenia kalorii, jeśli właściciel tak zdecyduje.

## Co jest w domu (punkt wyjścia)

- **Ławeczka** — ćwiczenia z ławki (wyciskanie, rozpiętki, wiosłowanie na ławce, przysiady bułgarskie). Ustawienie kąta, np. płaska / skos, może być polem wpisu.
- **Hantle** — stała lub regulowana waga; trzeba pamiętać, jaka waga jest dostępna, żeby nie proponować nieosiągalnych ciężarów.

Sprzęt jest zapisywany w Ustawieniach działu (lista „mój sprzęt”), a ćwiczenia pokazują tylko to, co da się zrobić z tego, co jest w domu.

## Zakres — propozycja (do potwierdzenia przed realizacją)

### 1. Ćwiczenia
- **Katalog ćwiczeń** z ławeczką i hantlami: nazwa, mięśnie, potrzebny sprzęt, krótki opis wykonania. Katalog startowy zapisany w kodzie (jak materiał Nauki), bez sieci.
- **Plan treningowy:** kilka dni (np. A / B), każdy z listą ćwiczeń, serii i powtórek.
- **Dziennik treningu:** data, ćwiczenie, serie × powtórki × ciężar, uwagi. Zapis jednym dotknięciem z ostatnimi wartościami jako podpowiedzią.
- **Progres:** prosty wykres lub lista najlepszych ciężarów na ćwiczenie, z datą.
- **Przerwa między seriami:** licznik z sygnałem (dźwięk/wibracja, jeśli dostępne).

### 2. Odżywki
- **Lista odżywek** (nazwa, dawka, pora, czy codziennie).
- **Kreatyna** jako pierwsza pozycja: dawka dzienna i przypomnienie. Przypomnienie najlepiej przez istniejący system Przypomnień (terminy powtarzane codziennie), a nie nowy mechanizm.
- **Odhaczanie wykonania** dnia (wzorem listy kontrolnej).

### 3. Dieta
- **Dziennik posiłków** w wersji minimalnej: data, pora, opis, ocena samopoczucia (opcjonalnie).
- **Opcjonalnie:** kalorie i białko na dzień — tylko jeśli właściciel tego chce; to osobna decyzja.

## Model danych (do ustalenia przy realizacji)

- Wszystko, co użytkownik wpisuje (treningi, odżywki, posiłki), musi przechodzić przez tę samą warstwę co reszta danych, żeby działały synchronizacja, kopia zapasowa i odśmiecanie. Konkretny wybór (Yjs jak Praca/Grafik czy osobny magazyn) zapada przy realizacji.
- Kopia zapasowa musi zawierać nowy dział (jak Praca i Grafik), a przywracanie musi raportować pominięte wpisy — tak jak D2 w Pracy.
- Dane zdrowotne (dieta, dawki) traktować jak prywatne: nie w eksporcie tekstowym bez zgody, nie w powiadomieniach na ekranie blokady.

## Ograniczenia i ryzyka

- **Budżet paczki:** dział trzeba ładować leniwie (jak Praca), bo wejściowy JS jest blisko progu (390 KB gzip w `e2e/bundle.spec.ts`, stan na 2026-10-20).
- **Katalog ćwiczeń** to treść — poprawność opisów sprawdza właściciel, nie kod.
- **Nie diagnozować:** dieta i kreatyna to dziennik i przypomnienia, nie porady. Teksty w aplikacji bez zaleceń medycznych.
- **Dostęp do menu:** dział jest w nawigacji i w palecie poleceń po dodaniu, z trasą `/cwiczenia` (zgodnie z `viewRoute.ts`).

## Decyzje właściciela (2026-10-20)

1. **Osobna pozycja w menu** (nie karta w Dziś).
2. **Katalog startowy:** klatka, biceps, triceps — ćwiczenia z ławeczki i hantli na te partie.
3. **Dieta:** dziennik posiłków **oraz** kalorie i białko na dzień.
4. **Kreatyna:** rano, 1 łyżka, codziennie (przypomnienie o tej porze, przez Przypomnienia).
5. **Priorytet:** odżywki, potem trening. Odpowiedź zawierała też słowo „praca”, którego znaczenia w tym kontekście nie ustalono; do wyjaśnienia przed realizacją (może chodzić o dział Praca albo o pracę nad planem).

## Kolejność realizacji (propozycja)

1. Odżywki: lista, kreatyna rano 1 łyżka z przypomnieniem codziennym (Przypomnienia).
2. Model danych i kopia zapasowa (przed UI, żeby nie dorabiać później).
3. Dziennik posiłków z kaloriami i białkiem na dzień (dane osobiste, lekkie UI).
4. Katalog startowy (klatka, biceps, triceps) + dziennik treningu + sprzęt.
5. Plan treningowy i progres.
6. Testy jednostkowe dla logiki (progres, przypomnienia dawek, sumy kalorii i białka) i e2e dla zapisu treningu i dawki.

Kolejność wynika z decyzji 5: odżywki przed treningiem. Dieta (punkt 3) ustawiona między nimi, bo dzieli z odżywkami dane o żywieniu; do potwierdzenia.

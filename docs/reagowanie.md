# Reagowanie na incydenty

Procedury do punktu S6.1 z `docs/plan-security-2026-11-15.md`. Zagrożenia i granice zaufania opisuje `docs/model-zagrozen.md`, a wdrożenie i wycofanie serwerów `deploy/README.md`. Nazwy przycisków są takie jak w aplikacji 2026-11-25. Jeśli się zmienią, popraw ten plik.

## Zgubiony albo skradziony telefon

1. Na innym urządzeniu z tej samej grupy wygeneruj nowy kod synchronizacji (Ustawienia → Sync) i wpisz go na urządzeniach, które zostają. Zgubiony telefon zostaje ze starym kodem i nie dostaje nowych zmian. Przy włączonym przekaźniku stary pokój usuwa opcja „Odłącz i usuń z przekaźnika” w oknie „Odłączyć to urządzenie?”.
2. Jeśli na telefonie był odblokowany skarbiec albo zapisane hasło, zmień hasło skarbca (Ustawienia → Skarbiec → „Zmień hasło”).
3. Jeśli telefon miał włączone powiadomienia z Twojego serwera, zmień `PUSH_TOKEN` na serwerze. Wtedy wpisz nowy token na urządzeniach, które zostają.
4. Dane na samym telefonie chroni blokada ekranu i szyfrowanie systemu. Aplikacja nie potrafi ich skasować zdalnie.

## Wyciek kodu synchronizacji

Kto zna kod, może dołączyć do grupy i czytać notatki.

1. Wygeneruj nowy kod i wpisz go na wszystkich swoich urządzeniach (S2.1, `docs/plan-wymiana-kodu.md`).
2. Usuń stary pokój z przekaźnika („Odłącz i usuń z przekaźnika” w oknie „Odłączyć to urządzenie?”).
3. W „Kopia i dane → Zdarzenia bezpieczeństwa” sprawdź, czy nie było odrzuconych plików od innych urządzeń.

## Wyciek hasła skarbca

1. Zmień hasło skarbca. Notatki prywatne zostaną zaszyfrowane od nowa, a stare hasło przestanie działać na tym urządzeniu.
2. Synchronizowane kopie z innych urządzeń przyjmą nowe zaszyfrowanie po synchronizacji. Sprawdź, czy na każdym skarbiec otwiera się nowym hasłem.
3. Jeśli wyciekł też kod awaryjny, wygeneruj nowy i wydrukuj go.

## Przejęty serwer (przekaźnik albo powiadomienia)

Przekaźnik widzi tylko szyfrogram. Serwer powiadomień widzi terminy i, bez szyfrowania S3.1, tytuły na 14 dni.

1. Zatrzymaj serwer. Postaw go od nowa z czystego obrazu (`deploy/README.md`, „Aktualizacje”), na nowym woluminie danych.
2. Przekaźnik: wygeneruj nowy kod synchronizacji, bo nowy kod to nowy pokój i nowe klucze. Urządzenia wyślą pełny stan do pustego pokoju (S4.7).
3. Serwer powiadomień: nowy `PUSH_TOKEN` i nowe klucze VAPID. Stare subskrypcje przestaną działać. Na każdym urządzeniu włącz powiadomienia jeszcze raz.
4. Sprawdź dzienniki z okresu przejęcia. Treści i tokenów w nich nie ma (S4.5), więc szukaj nieznanych restartów i zmian konfiguracji.

## Złośliwa albo wadliwa zależność, złe wdrożenie aplikacji

1. Wycofaj wdrożenie do ostatniej dobrej wersji na hostingu (Vercel/Netlify: poprzedni deploy jako produkcyjny).
2. Klienci sprawdzają nową wersję co godzinę i podmieniają ją przy schowanej karcie. Jeśli aplikacja na urządzeniu działa źle: Ustawienia → Kopia i dane → O aplikacji → „Aplikacja działa źle? Pobierz pliki od nowa” (S6.2). Ta opcja kasuje pliki aplikacji, a notatki zostają.
3. Usuń zależność albo przypnij bezpieczną wersję, przepuść CI (`audit`, `secrets`) i wdroż poprawkę.
4. Jeśli zależność mogła czytać dane w przeglądarce, potraktuj to jak wyciek kodu synchronizacji i hasła skarbca (sekcje wyżej).

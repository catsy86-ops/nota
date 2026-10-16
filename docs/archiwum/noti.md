NOTKI — Plan rozwoju aplikacji

Projekt: NOTKI
Adres: https://nota-gules.vercel.app/
Data: 11 października 2026
Cel: Kompleksowa aplikacja produktywności na komputer i telefon.

Uwaga: dokument opisuje plan audytu i rozwoju. Funkcje obecnej aplikacji, stan kodu oraz zabezpieczenia wymagają osobnej weryfikacji.

1. Wizja produktu

NOTKI ma być centrum produktywności łączącym:

Notatki — tworzenie, edycję, formatowanie, tagi i wyszukiwanie.
Zadania — terminy, priorytety, checklisty i przypomnienia.
Projekty — wspólne zarządzanie notatkami, zadaniami i materiałami.
Inteligentną organizację — szablony, powiązane notatki i opcjonalne AI.
Niezawodność — bezpieczny zapis, synchronizację, kopie zapasowe i kontrolę dostępu.

Główna zasada rozwoju: najpierw niezawodność, następnie podstawowe funkcje produktywności, a dopiero później zaawansowane możliwości.

2. Priorytety
   P0 — Niezawodność i bezpieczeństwo
   Zweryfikować tworzenie, edycję, usuwanie i odczyt danych.
   Sprawdzić logowanie i uprawnienia.
   Zabezpieczyć przed utratą i nadpisywaniem zmian.
   Dodać obsługę błędów sieciowych.
   Przygotować kopie zapasowe i procedurę przywracania.
   Sprawdzić izolację danych różnych użytkowników.

Kryteria akceptacji:

Zapisane notatki pozostają dostępne po odświeżeniu i ponownym logowaniu.
Błąd sieci nie powoduje cichej utraty tekstu.
Użytkownik nie może odczytywać ani zmieniać cudzych danych.
Przywracanie kopii zapasowej działa w testach.
P1 — Podstawowe funkcje produktywności
Automatyczny zapis notatek.
Globalna wyszukiwarka.
Foldery, tagi i przypinanie notatek.
Zadania z terminami, priorytetami i statusami.
Widoki „Dzisiaj”, „Nadchodzące”, „Zaległe” i „Ukończone”.
Skróty klawiaturowe i szybkie dodawanie.

Kryteria akceptacji:

Wyszukiwarka przeszukuje tytuły, treści i tagi.
Zmiana statusu zadania aktualizuje wszystkie odpowiednie widoki.
Użytkownik widzi, czy dane są zapisane.
Najważniejsze operacje działają na komputerze i telefonie.
P2 — Projekty i zarządzanie danymi
Projekty łączące notatki i zadania.
Archiwum i kosz z możliwością przywracania.
Historia wersji ważnych notatek.
Eksport do Markdown, JSON i opcjonalnie PDF.
Import danych.
Synchronizacja pomiędzy urządzeniami.

Kryteria akceptacji:

Archiwizacja nie usuwa danych.
Eksport zachowuje treść i obsługiwane metadane.
Przywrócenie wersji nie powoduje nieodwracalnej utraty aktualnej treści.
Konflikty edycji nie prowadzą do cichego nadpisania danych.
P3 — Funkcje zaawansowane
Asystent AI.
Automatyczne podsumowania.
Zamiana notatek na zadania.
Wyszukiwanie odpowiedzi w całej bazie notatek.
Współdzielenie i współpraca.
Instalacja jako PWA.
Rozszerzona praca offline.
Szablony i automatyzacje.

Kryteria akceptacji:

AI nie zmienia ani nie usuwa treści bez zgody użytkownika.
Odpowiedzi oparte na notatkach wskazują źródła.
Błąd AI nie blokuje edytora.
Zmiany offline synchronizują się po odzyskaniu połączenia zgodnie z ustalonymi regułami. 3. Audyt istniejącej aplikacji

Każdy element należy oznaczyć jako: zaliczony, wymaga poprawy, nie dotyczy lub niezweryfikowany.

Funkcjonalność
Tworzenie i edycja notatek.
Automatyczny zapis.
Usuwanie i odzyskiwanie danych.
Odświeżanie strony bez utraty zapisanych zmian.
Wyszukiwanie i filtrowanie.
Obsługa błędów API.
Zachowanie danych przy utracie internetu.
UX i responsywność
Test na komputerze.
Test na telefonie.
Test na tablecie.
Czytelne komunikaty o błędach.
Widoczny status zapisu.
Obsługa klawiatury i dostępność.
Brak uciętych elementów i poziomego przewijania.
Bezpieczeństwo
Kontrola dostępu po stronie serwera.
Izolacja danych użytkowników.
Bezpieczne zarządzanie sesjami.
Brak sekretów w kodzie publicznym.
Walidacja danych wejściowych.
Test kopii zapasowych i odtwarzania.
Wydajność i utrzymanie
Pomiar czasu ładowania.
Test większych zbiorów danych.
Testy integracyjne API.
Testy regresyjne.
Monitoring błędów.
Procedura wycofania wadliwego wdrożenia. 4. Szczegółowe wymagania funkcjonalne
4.1. Zapis notatek
Automatyczny zapis po krótkim okresie bezczynności.
Stany: „Zapisywanie”, „Zapisano”, „Błąd zapisu”.
Zachowanie treści po błędzie sieciowym.
Ochrona przed nadpisaniem nowszej wersji.
Możliwość odzyskania poprzedniej wersji.
4.2. Wyszukiwarka
Wyszukiwanie w tytułach i treści.
Filtrowanie według daty, tagów i typu elementu.
Obsługa klawiatury.
Czytelny stan braku wyników.
Respektowanie uprawnień użytkownika.
4.3. Zadania

Każde zadanie powinno mieć:

Tytuł.
Status.
Termin.
Priorytet.
Opcjonalny opis.
Opcjonalne powiązanie z notatką lub projektem.

Przydatne widoki: Dzisiaj, Nadchodzące, Zaległe i Ukończone.

4.4. Projekty

Każdy projekt powinien zawierać:

Nazwę i opis.
Powiązane notatki.
Powiązane zadania.
Status i postęp.
Ostatnią aktywność.
Możliwość archiwizacji i przywrócenia.
4.5. Eksport i odzyskiwanie
Eksport pojedynczej notatki.
Eksport całej bazy.
Udokumentowany format importu.
Kosz z możliwością przywrócenia.
Historia wersji ważnych notatek. 5. Projekt interfejsu
Komputer
Lewy panel nawigacyjny.
Wyszukiwarka globalna.
Główny obszar treści.
Opcjonalny panel szczegółów.
Szybkie dodawanie.
Skróty klawiaturowe.
Telefon
Dolna nawigacja: Dzisiaj, Notatki, Zadania, Projekty.
Widoczny przycisk dodawania.
Edytor na pełną szerokość ekranu.
Menu kontekstowe.
Duże, wygodne cele dotykowe.
Obsługa klawiatury ekranowej i bezpiecznych obszarów ekranu.
Kryteria UX
Testy szerokości 320, 375, 768, 1024 i 1440 px.
Wszystkie funkcje krytyczne dostępne na telefonie i komputerze.
Widoczny fokus klawiatury.
Czytelne etykiety i komunikaty.
Dążenie do zgodności z WCAG 2.2 AA. 6. Architektura techniczna

Nie należy zmieniać technologii ani przepisywać aplikacji bez wcześniejszego audytu.

Docelowe warstwy:

Interfejs użytkownika.
Logika biznesowa i walidacja.
API oraz kontrola dostępu.
Trwałe przechowywanie danych.
Proponowany model danych
User — konto i ustawienia.
Note — tytuł, treść, właściciel, daty i wersja.
Task — tytuł, status, termin i priorytet.
Project — nazwa, opis i status.
Tag — nazwa i kolor.
NoteTag — powiązanie notatki z tagiem.
ProjectItem — powiązanie projektu z notatką lub zadaniem.
NoteVersion — historia treści i daty zmian.

To model koncepcyjny wymagający dopasowania do istniejącej bazy danych.

Wymagania techniczne
Jedno źródło prawdy dla danych.
Migracje bazy danych.
Walidacja po stronie serwera.
Testy integracyjne i regresyjne.
Kontrola współbieżnej edycji.
Bezpieczne przechowywanie sekretów.
Monitoring błędów i wydajności.
PWA i offline
Instalowalna aplikacja internetowa.
Manifest i ikony.
Czytelny ekran offline.
Lokalna kolejka zmian.
Synchronizacja po odzyskaniu połączenia.
Obsługa konfliktów.
Jasna informacja o stanie synchronizacji. 7. Harmonogram wdrożenia — 8 tygodni
Tydzień 1 — Audyt
Inwentaryzacja funkcji.
Testy głównych przepływów.
Przegląd kodu, API i bazy danych.
Lista błędów i priorytetów.

Rezultat: zatwierdzony backlog.

Tydzień 2 — Fundament
Naprawa błędów krytycznych.
Kontrola uprawnień.
Walidacja danych.
Testy kopii zapasowych.

Rezultat: bezpieczna baza pod rozwój.

Tydzień 3 — Notatki
Automatyczny zapis.
Obsługa błędów sieciowych.
Stany synchronizacji.
Wyszukiwarka.

Rezultat: niezawodna praca z notatkami.

Tydzień 4–5 — Zadania i projekty
Terminy i priorytety.
Widoki dzienne.
Powiązania z notatkami.
Podstawowy widok projektu.

Rezultat: kompletny podstawowy przepływ produktywności.

Tydzień 6 — Interfejs
Responsywność.
Dostępność.
Uproszczenie nawigacji.
Testy na urządzeniach.

Rezultat: spójne działanie na komputerze i telefonie.

Tydzień 7 — Jakość
Eksport i import.
Testy wydajności.
Testy większych zbiorów danych.
Odzyskiwanie danych.

Rezultat: wersja przygotowana do pilotażu.

Tydzień 8 — Publikacja
Testy akceptacyjne.
Monitoring.
Pilotaż.
Naprawa wykrytych problemów.

Rezultat: kontrolowane wdrożenie.

Harmonogram jest orientacyjny i zależy od wyników audytu.

8. Metryki sukcesu

Proponowane cele, które należy zweryfikować po wdrożeniu:

Metryka Cel
Utracone zmiany po potwierdzonym zapisie 0 w testach
Krytyczne błędy głównych przepływów 0 przy wydaniu
Dostępność funkcji krytycznych na telefonie 100%
Odnalezienie typowej notatki Poniżej 3 sekund w teście
LCP ≤ 2,5 s
INP ≤ 200 ms
CLS ≤ 0,1
Udane przywracanie kopii 100% zaplanowanych testów

Dodatkowo warto mierzyć aktywację użytkowników, powroty po 7 dniach, liczbę ukończonych zadań i wykorzystanie wyszukiwarki.

Analityka nie powinna niepotrzebnie zbierać prywatnych treści notatek.

9. Checklista projektu
   Audyt
   Spisano wszystkie istniejące funkcje.
   Przetestowano zapis, edycję i usuwanie.
   Zweryfikowano dostęp do danych.
   Zebrano pomiary wydajności.
   Rdzeń produktu
   Automatyczny zapis.
   Obsługa konfliktów.
   Globalna wyszukiwarka.
   Zadania z terminami i priorytetami.
   Powiązania notatek, zadań i projektów.
   Jakość
   Responsywność.
   Eksport i przywracanie danych.
   Testy regresyjne.
   Dostępność.
   Monitoring i procedura wycofania wydania.
   Rozwój
   Zaplanowano PWA i tryb offline.
   Zaprojektowano funkcje AI.
   Zebrano opinie użytkowników.
   Ustalono metryki po wdrożeniu.
10. Rekomendacja końcowa

Najpierw należy zapewnić niezawodny zapis i bezpieczeństwo danych. Następnie dopracować przepływ:c

Notatka → Zadanie → Projekt → Wykonanie.

Dopiero po ustabilizowaniu tych elementów warto inwestować w AI, rozbudowaną pracę offline i współpracę zespołową.

Kolejny krok: udostępnić repozytorium lub archiwum kodu bez sekretów, aby można było przygotować audyt techniczny i listę konkretnych zmian w istniejącej implementacji.

Materiały referencyjne
OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/AuthorizationCheatSheet.html
OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/SessionManagementCheat_Sheet.html
WCAG 2.2: https://www.w3.org/TR/WCAG22/
web.dev: https://web.dev/
MDN Web Docs: https://developer.mozilla.org/

Koniec dokumentu

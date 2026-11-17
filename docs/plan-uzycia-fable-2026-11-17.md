# Plan użycia Fable w planach Praca, Bezpieczeństwo i QoL (2026-11-17)

> **Status:** zapisany, realizacja nie zaczęta. Dotyczy `plan-praca-2026-11-15.md`, `plan-security-2026-11-15.md`, `plan-qol-platforma-2026-11-15.md`.
> **Zasada (decyzja właściciela):** Fable robi plan, diagnozę, projekt protokołu i trudny kod; testy, interfejs i prace mechaniczne robią Opus i Sonnet. Fable wchodzi tam, gdzie błąd kosztuje dane albo poufność i gdzie nie wykryje go zwykły test: protokół synchronizacji, kryptografia, współbieżność (karty, Yjs, service worker), odtwarzanie danych, decyzje zmieniające ADR.
> **Stan sprawdzony w kodzie 2026-11-17:** z planu bezpieczeństwa nic nie jest zrobione (brak `docs/model-zagrozen.md`, `SECURITY.md`, `deploy/`, `src/lib/net/`, Trusted Types, COOP, `USER` w `signaling-server/Dockerfile`; audyt npm tylko dla serwerów). Z QoL zrobione Q1.1, Q1.2, Q1.5; brak OPFS, `scheduler.yield`, `protocol_handlers`. Z Pracy jest tylko `src/lib/study/receivables.ts` (R3.1 bez ekranu). Epoka pokoju przekaźnika (Z-5.5) jest w drzewie roboczym, niezacommitowana.
> Numery zleceń kontynuują `zlecenia-fable-2026-11-15.md`: zadanie 15 — bezpieczeństwo, 16 — QoL, 14 — Praca (uzupełnienie).

## 1. Skrót

| Plan | Udział Fable | Punkty z Fable | Bez Fable |
|---|---|---|---|
| Bezpieczeństwo | duży | S2.1, S2.2, S2.3, S2.5, S2.6, S3.1 (projekt i przegląd), ADR-9 i przegląd F2 przed S4, przegląd S0.1 | S0.2, S0.3, S1.1–S1.10, S2.4, S3.2–S3.4, S4.2–S4.11, S5, S6 |
| QoL | mały | Q1.4, Q3.8 (krótka specyfikacja), Q4.4 (tylko po wdrożeniu przekaźnika) | Q1.3, Q1.6, Q2, Q3.1–Q3.7, Q3.9, Q4.1–Q4.3, Q5 |
| Praca | minimalny | R4.2 (projekt), R4.5 (specyfikacja) | Etap 1, R2.1–R2.6, R3.1–R3.5, R4.1, R4.3, R4.4, R5.1 |

Razem: 6–8 sesji Fable, z czego 4 nie wymagają żadnej decyzji o hostingu.

## 2. Plan bezpieczeństwa

### 2.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **S2.1** wymiana kodu z wyrzuceniem urządzenia | Protokół i ryzyko utraty danych. Kolejność kroków decyduje, czy zmiany urządzenia offline zginą: nowy pokój → pełny stan w nowym pokoju potwierdzony przez serwer → znacznik „kod zmieniony” w starym dokumencie → usunięcie starego pokoju. Styka się z epoką pokoju (Z-5.5: urządzenie ze starym kodem po `DELETE` dostanie 404, zrobi reset i **założy stary pokój od nowa pełnym stanem** — to trzeba zablokować znacznikiem albo stanem „po wymianie”), z kartami (Z-7: wymianę prowadzi jedna karta) i z kolejką `pending`. | Specyfikacja `docs/plan-wymiana-kodu.md`: maszyna stanów z punktami wznowienia po zamknięciu karty w każdym kroku, format znacznika, zachowanie urządzenia, które widzi znacznik, co się dzieje z P2P (`y-webrtc`) w trakcie. Potem sam kod sekwencji w `src/lib/sync/` (funkcja czysta + sterownik). | Interfejs w Ustawieniach, lista urządzeń, testy — Opus (Z-15.3, Z-15.4). |
| **S2.2** dłuższy kod + **S2.6** wycofanie pokoi v2 | Wyprowadzanie kluczy i nazw pokoi; pomyłka dzieli urządzenia na dwie grupy bez komunikatu (jedno jeszcze tylko w v2, drugie już nie dołącza). | Krótka specyfikacja w tym samym dokumencie: format kodu 128-bitowego i rozpoznawanie długości, niezmienione wyprowadzenie v3 dla starych kodów, warunek „kiedy wolno przestać dołączać do v2” (dowód, że każde znane urządzenie było widziane w v3), treść propozycji nowego kodu po oknie v2. | Kod i testy — Opus (Z-15.1, Z-15.2). |
| **S2.3** cofnięcie i powtórzenie na przekaźniku | Protokół. Po Z-5.5 zmiana epoki jest legalnym resetem, więc „mniej wpisów niż wcześniej” nie może być alarmem samo w sobie; trzeba rozróżnić: reset (nowa epoka), kompaktowanie (numer rośnie, wpisów mniej), cofnięcie (ta sama epoka, `last` maleje) i wstrzymywanie wpisów (niewykrywalne bez drugiego kanału). Zależne od F2 (numer monotoniczny po kompaktowaniu). | Specyfikacja: co klient pamięta (epoka, `last`, skrót wektora stanu po ostatnim pobraniu), tabela „obserwacja → wniosek → reakcja”, wpis `logSecurity`. | Kod i testy — Opus (Z-15.6). |
| **S2.5** limity wiadomości WebRTC | Współbieżność i Yjs. Odrzucenie za dużej albo zbyt częstej aktualizacji w CRDT nie jest obojętne — brakujący poprzednik zostawia struktury oczekujące i cichą rozbieżność. Trzeba ustalić, gdzie w `y-webrtc` da się wpiąć limit (przed odszyfrowaniem, przed `applyUpdate`) i co robić zamiast odrzucenia (odłączenie urządzenia i komunikat, nie pominięcie wpisu). | Analiza `y-webrtc` i `yjsSync.ts`/`imageSync` (tylko czytanie), specyfikacja limitów i reakcji, lista miejsc wpięcia. | Kod, test „10 MB nie zawiesza karty” — Opus (Z-15.5). |
| **S3.1** treść przypomnień niewidoczna dla serwera | Kryptografia i service worker: klucz nieeksportowalny w IndexedDB wspólnej dla strony i SW, AAD, wersja formatu, okres dwóch formatów, utrata klucza, limit 4 KB. Plan opisuje to dobrze — Fable nie pisze kodu. | Doprecyzowanie formatu (`v`, `iv`, `enc`, AAD, przycięcie przed szyfrowaniem) w jednej tabeli i **przegląd diffu Opusa** przed scaleniem (zwłaszcza ścieżka „nie da się odszyfrować” i kontrola `url`). | Kod klienta, SW i serwera, testy — Opus (Z-15.7); przegląd `security-reviewer`. |
| **ADR-9 i S4** wdrożenie | Decyzja architektoniczna (zmienia ADR-3 i ADR-4) oraz przegląd F2, który Fable zaprojektował: odtwarzanie po awarii, `epoch` w `meta.json`, limity łączne. | ADR-9 po decyzji SE-1; przegląd implementacji F2 (testy awarii) i całego `deploy/` razem z `security-reviewer`. | `storage.js` według F2, `deploy/`, S4.2–S4.11 — Opus i Sonnet (Z-15.8…). |
| **S0.1** model zagrożeń | Dokument jest podstawą wszystkich pozostałych decyzji; §2 i §1a planu napisał Fable. | Tylko przegląd wersji Sonneta i dopisanie wniosków z S2.1, S2.3, S2.5 po ich zaprojektowaniu. | Przepisanie §2 do `docs/model-zagrozen.md`, schemat przepływu — Sonnet (Z-15.0). |

Uwaga do S4.7 („utrata danych przekaźnika nie gubi zmian”): to dokładnie Z-5.5 — po jej zacommitowaniu zostaje tylko test integracyjny (Z-5.T), bez pracy Fable.

### 2.2 Punkty bez Fable

- **Opus + `security-reviewer`:** S1.1 (Trusted Types — jedno ujście, polityka tylko dla Mermaida), S1.2 (`lib/net/endpoints.ts` + reguła ESLint), S1.3, S1.4 (rozpoznanie), S1.6, S1.8, S1.10, S2.4 (po SE-5), S3.2, S4.2–S4.4, S4.10, S6.2.
- **Sonnet:** S0.2 (test-strażnik ujść HTML), S0.3, S1.5, S1.7 (testy własności), S1.9, S3.3, S3.4, S4.5–S4.9, S4.11, cały S5, S6.1, S6.3, S6.4.
- S1.5 w wersji „klucza nie da się wynieść” (podpis żądań zamiast tokenu, tryb bez `y-webrtc`) to zmiana protokołu — jeśli właściciel ją kiedyś zechce, zaczyna się od sesji Fable; dziś poza zakresem.

### 2.3 Zlecenia (zadanie 15)

- **Z-15.0 (Sonnet, S)** — S0.1–S0.3 według planu; Fable czyta gotowy `model-zagrozen.md`.
- **Z-15.1 (Opus, S)** — S2.2 według specyfikacji Fable: generator i parser kodu 128-bitowego, QR, forma krótka z ostrzeżeniem; testy zgodności ze starymi kodami.
- **Z-15.2 (Opus, S)** — S2.6: koniec dołączania do v2 według warunku ze specyfikacji, propozycja nowego kodu, data końca pokoju najstarszego.
- **Z-15.3 (Opus, M)** — S2.1 interfejs: „Nowy kod”, postęp kroków, ekran „sparuj ponownie” na pozostałych urządzeniach, opis ograniczeń.
- **Z-15.4 (Sonnet, M)** — S2.1 testy: przerwanie w każdym kroku i wznowienie; urządzenie offline wraca po wymianie; stary pokój nie odradza się po resecie epoki; dwie karty.
- **Z-15.5 (Opus, M)** — S2.5 według specyfikacji; test obciążeniowy.
- **Z-15.6 (Opus, M)** — S2.3 według specyfikacji; po F2.
- **Z-15.7 (Opus, M)** — S3.1; okres przejściowy dwóch formatów w serwerze; testy limitu 3 KB i utraty klucza.
- **Z-15.8 (Opus, L)** — F2 (`relay-server/storage.js`) według `plan-fable-2026-11-15.md`, z `epoch` w `meta.json`; potem S4.2–S4.4.
- **Z-15.9 (Sonnet, S każdy)** — S5.1, S5.3, S5.4 od razu; reszta S5 i S6 po kolei.
- **Z-15.10 (Opus + `security-reviewer`, M)** — S1.3 → S1.1 → S1.6, każde z testem ataku przed i po.

## 3. Plan QoL i platformy

### 3.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **Q1.4** rotacja kopii w OPFS | Odtwarzanie danych w CRDT. Wczytanie starej migawki Yjs do działającego dokumentu **niczego nie cofa** (scalenie zostawia nowszy stan), a wczytanie jej jako nowego dokumentu przy włączonej synchronizacji ściąga z powrotem to, co miało zniknąć. „Przywróć z dnia…” wymaga więc osobnej ścieżki: albo przywrócenie jako kopie notatek, albo wymiana dokumentu razem z nowym kodem (wtedy wspólne z S2.1). Do tego zapis migawki pod blokadą kart (Web Locks z Z-7) i zachowanie przy braku miejsca. Kryptografia (QL-1): migawka zawiera notatki prywatne już zaszyfrowane, zwykłe są jawne tak samo jak w IndexedDB tego samego źródła, a klucz skarbca przy zablokowanym skarbcu nie istnieje — zalecenie Fable: **nie szyfrować dodatkowo**. | Specyfikacja: format pliku (aktualizacja Yjs + nagłówek z wersją formatu i sumą), kiedy powstaje migawka, rotacja, obie ścieżki przywracania z opisem skutków przy synchronizacji; przegląd diffu ścieżki przywracania. | Kod, ekran w Ustawieniach, testy z uszkodzoną bazą — Opus (Z-16.1). |
| **Q3.8** `scheduler.yield` w imporcie kopii | Transakcji Yjs nie da się przerwać w połowie, więc „oddawanie wątku” oznacza pocięcie importu na wiele transakcji: częściowy import staje się widoczny, synchronizacja wysyła połówki, a zamknięcie karty zostawia stan pośredni. | Krótka specyfikacja (pół strony): porcje, blokada z Q1.1 na cały import, wznowienie idempotentne po przerwaniu, wstrzymanie wysyłki do końca albo zgoda na wysyłkę porcjami. Indeks i eksport ZIP nie wymagają Fable. | Kod i pomiar zadań > 50 ms — Opus (Z-16.2). |
| **Q4.4** Background Sync dla przekaźnika | Współbieżność: service worker wysyłałby kolejkę `pending`, którą prowadzi karta-lider (Z-7), ze stanem `cursor`/`sv`/`epoch` w IndexedDB i kluczami wyprowadzanymi z kodu w `localStorage` (niedostępnym w SW). Dwa nadawcy bez wspólnej blokady = podwójne wpisy albo cofnięty kursor. | Projekt — **tylko jeśli** przekaźnik zostanie wdrożony (SE-1) i właściciel używa PWA, nie APK. Inaczej punkt skreślić. | Kod — Opus, po projekcie. |

### 3.2 Punkty bez Fable

- **Opus:** Q1.3 (zapis do pliku; sprawdzić `LAST_AUTO_EXPORT_KEY`), Q2.1 (= S1.1, robić raz), Q3.2, Q3.6 (wklejanie — bez nowego ujścia HTML, pilnuje strażnik z S0.2), Q4.1, Q4.2, Q5.1, Q5.3.
- **Sonnet:** Q1.6 (dziennik błędów — komunikat wyjątku może zawierać treść notatki, więc zapis tylko nazwy i stosu; przegląd `security-reviewer`), Q2.2 (część już jest: `scripts/cap-prepare.mjs` robi `<meta>` z `vercel.json`; zostaje test zgodności Z-13.2 i `netlify.toml`), Q2.3 (= S1.3 i S4.9), Q3.1, Q3.3–Q3.5, Q3.7 (z `security-reviewer`: adres `web+notatnik:` to wejście niezaufane), Q3.9, Q4.3, Q5.2, Q5.4.
- **Właściciel:** Q5.5.
- Zrobione: Q1.1, Q1.2, Q1.5.

### 3.3 Zlecenia (zadanie 16)

- **Z-16.1 (Opus, M)** — Q1.4 według specyfikacji Fable, po QL-1 i D-F3.
- **Z-16.2 (Opus, M)** — Q3.8 według specyfikacji; miara z planu.
- **Z-16.3 (Opus, M)** — Q1.3; **Z-16.4 (Sonnet, S)** — Q1.6.
- **Z-16.5 (Sonnet/Opus)** — reszta Q3–Q5 w kolejności z planu, każdy punkt osobno.

## 4. Plan Pracy

### 4.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **R4.2** kolejka zdjęć w tle | Ryzyko utraty zdjęcia: zapis oryginału, potem przetwarzanie w Workerze, przy zamknięciu karty w trakcie, przy drugiej karcie i przy odśmiecaniu obrazów (Z-6: `deleteIfStale`, `GC_LOCK`, odnowienie `addedAt`). Zdjęcie „w kolejce” nie może wyglądać dla odśmiecania jak osierocone. | Projekt (pół sesji) — **dopiero gdy pomiar pokaże, że dziś blokuje**: kolejność zapisów, stan pozycji kolejki, wznowienie po starcie, relacja z GC. | Kod, licznik „przetwarzam 3”, testy — Opus (Z-14.5); `performance-engineer` do pomiaru. |
| **R4.5** alarmy natywne próby szczelności i końca dnia | Zależne od F1 (ujście natywne zaprojektował Fable). Trzeba dopisać dwa źródła do `buildPushSchedule` tak, by nie dublowały timerów strony i by wcześniejsze zakończenie próby anulowało alarm przez różnicę w `replace`. | Specyfikacja na pół strony (prefiks klucza, kanał, anulowanie). | Kod i testy — Opus (Z-14.6), po próbie F1.0 na telefonie. |

### 4.2 Punkty bez Fable

- **Właściciel:** R1.1, R1.2. **Sonnet:** R1.3, R1.4, R2.3, R2.4, R2.6, R3.3, R3.4, R4.3, R4.4, R5.1, testy `receivables.ts` (Z-14.1).
- **Opus:** R2.1 (najpierw testy charakteryzujące reduktor szkicu — to one chronią przed utratą szkicu, nie przegląd Fable), R2.2, R2.5, R3.1 ekran (Z-14.2), R3.2, R4.1.
- **R3.5** (paczka dla księgowej): Opus + `security-reviewer`; warunek — **użyć istniejącego szyfrowanego eksportu faktur bez nowego formatu**. Jeśli potrzebny byłby nowy format szyfrowania, wraca do Fable.
- R3.3 opiera się na numeracji faktur — wymaga wcześniej Z-2.x (walidacja przy odczycie, wyścig numeru), nie Fable.

## 5. Decyzje właściciela blokujące pracę Fable

| Decyzja | Blokuje | Zalecenie Fable |
|---|---|---|
| **SE-1** — gdzie stoją serwery i czy wdrażać teraz | ADR-9, przegląd F2/S4, Q4.4; ustala też wagę S3.1 (w APK alarmy są lokalne, serwer powiadomień zostaje tylko dla PWA i iOS) | „Nie teraz”, dopóki nie przejdzie próba F1.0; wtedy sesje E z kolejki odpadają. |
| **SE-6** — czy z serwerów korzysta ktoś poza właścicielem | zakres S3.2 i limitów w F2 | tylko właściciel |
| **SE-5** — dopełnianie blobów | S2.4 (bez Fable), wpis w modelu zagrożeń | nie dopełniać, opisać jako znane ograniczenie |
| **QL-1** — szyfrowanie migawek OPFS | Q1.4 | wcale (uzasadnienie w §3.1) |
| **D-F1** (nowa) — po wymianie kodu stary pokój na przekaźniku usuwać od razu czy po 7 dniach | S2.1 | po 7 dniach: urządzenie offline zdąży zobaczyć znacznik; koszt — tydzień dłuższego dostępu dla znającego stary kod |
| **D-F2** (nowa) — po oknie v2 nowy kod wymuszać czy tylko proponować | S2.6 | proponować z uzasadnieniem, nie wymuszać |
| **D-F3** (nowa) — „Przywróć z dnia…”: jako kopie notatek czy wymiana całego dokumentu z nowym kodem | Q1.4 | domyślnie kopie notatek; wymiana dokumentu tylko jako ścieżka awaryjna po uszkodzeniu bazy |
| **KR-1** (plan Skarbca) | opis luki 10 w modelu zagrożeń | poza tym planem |
| Wynik **R1.1–R1.4** i próby **F1.0** (kroki właściciela) | R4.2, R4.5 | — |

Nie blokują Fable: SE-2, SE-3, SE-4, QL-2, QL-3, PR-1…PR-3.

## 6. Wspólna kolejka sesji Fable

Zależności: Z-5.5 (epoka) → S2.1, S2.3, F2 · S2.1 ↔ Q1.4 (wspólna „wymiana dokumentu”) · F1.0 → R4.5 · SE-1 → F2 → S2.3 kod, S4, Q4.4 · D4.1 z planu migracji (rejestr urządzeń) poprawia S2.1, ale go nie blokuje.

| Nr | Sesja | Zakres | Wynik | Wymaga | Sesji |
|---|---|---|---|---|---|
| 0 | Domknięcie przekaźnika | Z-5.5 (w toku): commit, `opis.md`, zlecenie Z-5.T | epoka w `master` | — | bieżąca |
| A | Kod i pokoje — projekt | S2.6, S2.2, S2.1 (specyfikacja), przegląd `model-zagrozen.md` | `docs/plan-wymiana-kodu.md`, zlecenia Z-15.1–Z-15.4 | Z-15.0 gotowe (Sonnet), D-F1, D-F2 (są zalecenia domyślne) | 1 |
| B | Wiadomości i cofnięcia | S2.5 (analiza `y-webrtc`), S2.3 (specyfikacja) | dwie specyfikacje, zlecenia Z-15.5, Z-15.6 | sesja 0 | 1 |
| C | Dane lokalne | Q1.4, Q3.8, R4.2 (jeśli pomiar potwierdzi) | specyfikacje, zlecenia Z-16.1, Z-16.2, Z-14.5 | QL-1, D-F3; pomiar R4.2 | 1 |
| D | Wymiana kodu — trudny kod | sekwencja S2.1 w `src/lib/sync/` po przygotowaniu części przez Opusa (Z-15.1, Z-15.2) | kod + przegląd Z-15.3/Z-15.4 | sesja A | 1 |
| E | Powiadomienia | format S3.1 i przegląd diffu Opusa; specyfikacja R4.5 | zlecenie Z-15.7, Z-14.6 | wynik F1.0 | 0,5–1 |
| F | Wdrożenie (warunkowa) | ADR-9, przegląd F2 i `deploy/`, ewentualnie projekt Q4.4 | ADR-9, lista poprawek | SE-1 = tak, SE-6, Z-15.8 gotowe | 1–2 |
| G | Przeglądy końcowe | diff ścieżki przywracania Q1.4, dopisanie wniosków do modelu zagrożeń | uwagi do poprawek | sesje C, D | 0,5 |

Kolejność: 0 → A → B → C → D → E → (F) → G. Sesje A–D nie zależą od żadnej decyzji o hostingu. Równolegle, bez czekania na Fable: Z-15.0, Z-15.9, Z-15.10 (S0, S5, nagłówki, Trusted Types, Mermaid), Q1.3, Q1.6, Etapy 1–3 planu Pracy.

### 6.1 Stan na 2026-11-17

| Sesja | Stan | Wynik |
|---|---|---|
| 0 | zrobiona | `e7c64af0` |
| A | zrobiona (dokument) | `plan-wymiana-kodu.md` — zlecenia Z-15.1–Z-15.4; nowa decyzja **D-W1**: nowy kod domyślnie długi (28 znaków) |
| B | zrobiona (dokument) | `plan-wiadomosci-i-cofniecia.md` — zlecenia Z-15.5, Z-15.6; ustalenia U-1 (możliwy limit 256 KB wiadomości kanału danych — najpierw pomiar) i U-2 (transport obrazów) |
| C | zrobiona (dokument) | `plan-dane-lokalne.md` — zlecenia Z-16.1 (części A i B), Z-16.2, Z-14.5 (po pomiarze); nowe wymaganie: opcja „Zastąp dane na tym urządzeniu danymi grupy” przy dołączaniu |
| D | zrobiona poza podpięciem | `rekey.ts`, `rekeyRelay.ts`, `RelayProvider.settle()`/`canSend`, testy sprawdzające; podpięcie w `yjsSync.ts` (lista w `plan-wymiana-kodu.md`, „Sesja D”) czeka na Z-15.1 i Z-15.2 (Opus) |
| E | specyfikacja zrobiona | `docs/plan-powiadomienia.md`: format S3.1 i zlecenie Z-15.7, luki R4.5 i zlecenie Z-14.6 (to czeka na próbę F1.0). Zostaje przegląd diffu Z-15.7 po pracy Opusa |
| F | czeka | na SE-1 |
| G | czeka | na kod z sesji C i D |

Decyzje przyjęte domyślnie, do potwierdzenia: D-F1, D-F2, D-F3, D-W1, QL-1.

Poza tym planem zostają w kolejce Fable z 16.11: zlecenia Z-13.x po próbie F1.0 i F3 (podział `yjsStore.ts`, dla Opusa).

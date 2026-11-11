# Audyt błędów 2026-11-11 (4 agenty, tylko odczyt)

Źródło: raporty agentów `react-engineer` (UI Pracy), `typescript-expert` (dane/Yjs), `security-reviewer` (przekaźnik, sync, import, Skarbiec), `testing-engineer` (testy). Ustalenia wynikają z lektury kodu; każde trzeba zweryfikować przed poprawką (kolumna „Status”). Numeracja jak w raportach.

## Utrata danych i poprawność (dane)

| ID | Ustalenie | Status |
|---|---|---|
| K1 | `noteSchema` (`z.catch(z.array(...), [])`): jeden zły element w `notes` zeruje całą tablicę, a `restoreFullBackup` kasuje wszystkie notatki | naprawione: `tolerantArray` w `noteSchema`; `backupRobustness.test.ts` |
| K2 | `noteSchema` nie ma `reminderRule`: serie „dni robocze / co N dni” giną przy kopii i imporcie | naprawione: `reminderRule` w `noteSchema`; `backupRobustness.test.ts` |
| K3 | `siteActions.ts`: `supplierPhone` jest wycinany przy każdym zapisie karty budowy | naprawione: `supplierPhone` w `siteActions.ts`; `siteContactSave.test.ts` |
| W1 | import `.budowa`: punkty w nowych pomieszczeniach odpadają (cache `yPoints` w transakcji) | naprawione: punkty idą razem z nowym pomieszczeniem (`applySitePackage`); `sitePackageApply.test.ts` |
| W2 | `.budowa`: import tnie do 500 najstarszych wpisów bez komunikatu | naprawione: ponad 500 wpisów zostają najnowsze, liczba pominiętych w podsumowaniu importu; `sitePackageApply.test.ts` |
| W3 | `.budowa` ze zdjęciami nie przepisuje kluczy `dimensions` | naprawione: `remapEntryImages` przenosi też `dimensions` i `after`; `sitePackageApply.test.ts` |
| W4 | edycja wpisu nadpisuje zmiany z drugiego telefonu (porównanie z bieżącym dokumentem, nie z bazą formularza) | naprawione: trójstronne scalanie `mergeEdit` (baza = wpis z otwarcia arkusza); `editMerge.test.ts` |
| W5 | zamówienie kształtek pomija wpisy z datą wsteczną | naprawione: pole `added` (moment zapisu), zamówienie liczy od niego; `order.test.ts`, `journalAdded.test.ts` |
| W6 | kategorie push nie obejmują kluczy `d:` i `z:` | do weryfikacji |
| W7 | alarm przed zmianą / koniec zmiany o godzinę w dni zmiany czasu (`schedule.ts:172,205`) | do weryfikacji |
| W8 | przywracanie sekcji połyka błędy, UI pokazuje sukces | otwarte |
| W9 | nagrania (`recordings`) i `after` bez ochrony przed GC zdjęć | do weryfikacji |
| W10 | wyścig GC z ponownym dodaniem zdjęcia | otwarte |
| W11 | listy zdjęć/nagrań LWW: dwa telefony tracą dodane elementy | otwarte (zmiana modelu Yjs) |
| W12 | dzień z przyszłości psuje serię w Nauce | otwarte |
| W13 | kopia pełna nie sprawdza własnego rozmiaru względem limitu importu | otwarte |
| W14 | kilometrówka, cennik, nazwa firmy, autor poza kopią zapasową | do weryfikacji (decyzja: które klucze) |
| W15 | sekcje pieniężne wracają przez scalanie, Nauka przez zastąpienie | otwarte |
| W16 | zlecenia: `touch()` może cofnąć status z drugiego telefonu | otwarte |
| W17 | `cleanEntry.at`/`resolved` bez zakresu | otwarte |
| D1–D19 | drobne (limity przy scalaniu, osierocone dane, DST, push, zaokrąglenia, `__proto__`, wydajność 3000+) | patrz raport |

## UI Pracy

| ID | Ustalenie | Status |
|---|---|---|
| 1 | `DimensionDrawer`: współrzędne względem ramki, nie obrazu — przesunięcie na zdjęciach pionowych | naprawione: `pointOf` liczy względem obrazu; e2e `photo-dimensions` (zdjęcie pionowe) |
| 2 | `addPhotos`: licznik `processing` zostaje > 0 po wyjątku, „Zapisz wpis” zablokowany | naprawione: `unreleased` w `addPhotos` |
| 3 | dyktowanie nie wyłącza się po zamknięciu arkusza (prywatność) | naprawione: `stopDictation` przy zamknięciu arkusza; `onend` bez wyścigu |
| 4 | narzędzia Pracy (Auto, Kilometrówka…) znikają przy pustym dzienniku | naprawione: Auto i Kilometrówka w stanie pustym; `e2e/empty-journal-tools.spec.ts` |
| 5 | `LevelMeter`: nasłuch `deviceorientation` po zamknięciu (iOS) | naprawione: cleanup nasłuchu przy zamknięciu (iOS) |
| 6 | wpis z samym pomiarem/kodem odrzucany jako pusty | naprawione: pomiar i kod liczą się jako treść; `journalSensors.test.ts` |
| 7 | `point` z aparatu zostaje po zmianie budowy | naprawione: `point` czyszczony przy zmianie budowy |
| 8 | karta budowy gubi niezapisane zmiany przy błędnym formularzu | otwarte |
| 9–16, 17–33 | miarka (zamknięcie, klawiatura, przeciągnięcie), alarm próby w edycji, stawka km, fokus „Brak”, pigułki `aria-pressed`, licznik zdjęć z aparatu, NFC, etykiety, i in. | patrz raport |

## Bezpieczeństwo

| ID | Ustalenie | Status |
|---|---|---|
| S1 | przekaźnik: brak `ws.on("error")` — jedna zła ramka zabija proces | naprawione: `ws.on("error")`, `relay-server/server.test.js` |
| S2 | przekaźnik: `new URL` w `upgrade` bez `try/catch` — crash bez uwierzytelnienia | naprawione: `try/catch` w `upgrade`, `relay-server/server.test.js` |
| S3 | pokój WebRTC = szybki SHA-256 z kodu ~59 bitów | otwarte (decyzja projektowa) |
| S4 | przekaźnik: tworzenie pokojów bez uwierzytelnienia, wyczerpanie zasobów | otwarte |
| S5 | przekaźnik: `TRUST_PROXY=1` domyślnie w Dockerfile; mapa `hits` rośnie | otwarte |
| S6 | `?share=` dodaje notatkę bez potwierdzenia | do weryfikacji |
| S7–S20 | akcje z adresu, Skarbiec offline, historia przekaźnika, AAD bez `seq`, kod w `localStorage`/QR, brak DELETE pokoju, Share Target `Origin: null`, `.ics` bez limitów, przywracanie ustawień, CSP/nagłówki, `npm audit` | patrz raport |

## Testy i CI

| ID | Ustalenie | Status |
|---|---|---|
| T1 | `push-server/*.test.js` nie jest w CI | zrobione: job `servers` w CI (testy + `npm audit`) |
| T2 | CI instaluje tylko Chromium, a projekty iPhone/WebKit istnieją | zrobione: `playwright install chromium webkit` w CI |
| T3 | odcisk protokołu nie obejmuje podpisów zdjęć z wymiarami (`useSiteCardActions.ts`) | do weryfikacji |
| T9 | `startViewTransition` wołane bezpośrednio w `Index.tsx` i `viewChange.ts` (poza strażnikiem WebKit) | naprawione: `canViewTransition` w `Index.tsx`/`viewChange.ts`; `viewTransitionGuard.test.ts` |
| T4–T35 | słabe asercje (mileage), brak wektora referencyjnego SHA-256, luki pokrycia (PDF, sitePackageIo, push client, tick), sleepy, rozbieżności `opis.md` | patrz raport |

## Zrobione 2026-11-11 (pierwsza partia)

K1, K2, K3, S1, S2, T1, T2, T9 oraz UI #1–#7 i #12. Dodatkowo `relay-server`: sprzątanie mapy limitów, zapis z ponawianiem, łagodne zamknięcie, ostatni wpis `X-Forwarded-For`, Dockerfile bez roota i bez domyślnego `TRUST_PROXY`. Reszta ustaleń wymaga weryfikacji i decyzji (zmiany modelu Yjs: W4, W11, W16; kopia zapasowa: W14, W15; pokoje i kod synchronizacji: S3–S5, S11–S13).

## Zrobione 2026-11-11 (druga partia)

W1–W5. Nowe pole wpisu `added` (opcjonalne, w `JOURNAL_ENTRY_KEYS`); starsze wpisy bez niego liczą się od `at`. Edycja wpisu przekazuje `base` do `updateJournalEntry`.


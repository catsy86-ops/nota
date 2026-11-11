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
| W6 | kategorie push nie obejmują kluczy `d:` i `z:` | naprawione: `d:` w „zamówieniach”, `z:` w „grafiku”; test pilnuje każdego prefiksu (`categories.test.ts`) |
| W7 | alarm przed zmianą / koniec zmiany o godzinę w dni zmiany czasu (`schedule.ts:172,205`) | naprawione: `wallClock` zamiast „północ + minuty”; `schedule.dst.test.ts` (marzec i październik) |
| W8 | przywracanie sekcji połyka błędy, UI pokazuje sukces | naprawione: `restoreFullBackup` zwraca `failed`, UI pokazuje ostrzeżenie; `fullBackup.test.ts` |
| W9 | nagrania (`recordings`) i `after` bez ochrony przed GC zdjęć | naprawione: nagrania szkicu i otwartej edycji chronione (doc: `after`, `drawnFrom`, nagrania były już chronione); `images.test.ts` |
| W10 | wyścig GC z ponownym dodaniem zdjęcia | naprawione: `touched` + `deleting` w `imageStore`; `imageStore.test.ts` |
| W11 | listy zdjęć/nagrań LWW: dwa telefony tracą dodane elementy | otwarte (zmiana modelu Yjs) |
| W12 | dzień z przyszłości psuje serię w Nauce | naprawione: `stateFromDump` pomija dni po jutrze; `studyStreak.test.ts` |
| W13 | kopia pełna nie sprawdza własnego rozmiaru względem limitu importu | naprawione: `isBackupOversize` + ostrzeżenie po zapisie kopii; `fullBackup.test.ts` |
| W14 | kilometrówka, cennik, nazwa firmy, autor poza kopią zapasową | do weryfikacji (decyzja: które klucze) |
| W15 | sekcje pieniężne wracają przez scalanie, Nauka przez zastąpienie | otwarte |
| W16 | zlecenia: `touch()` może cofnąć status z drugiego telefonu | naprawione: znacznik zmiany wyceny w osobnym kluczu `c␁budowa` (touch nie przepisuje statusu); `jobs.test.ts`. Pozostaje LWW całego wpisu zlecenia przy `setMeta` z dwóch telefonów naraz |
| W17 | `cleanEntry.at`/`resolved` bez zakresu | naprawione: `timeInRange` (1970…3000) w `cleanEntry`; `journalAdded.test.ts` |
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
| 8 | karta budowy gubi niezapisane zmiany przy błędnym formularzu | naprawione: `blockedByError` w `SiteCardDialog.tsx` (karta zostaje, toast z „Odrzuć zmiany”); `e2e/study.spec.ts` |
| 9 | miarka kasuje rozpoczętą pracę przy zamknięciu | naprawione: `finalList` + pytanie przy zamknięciu (`DimensionDrawer.tsx`) |
| 10 | miarka bez alternatywy klawiaturowej | częściowo: opis przez `aria-describedby`, informacja „dotykiem lub myszą”; pełna obsługa klawiaturą wymaga osobnego projektu |
| 11 | alarm końca próby nie działa w edycji wpisu | naprawione: `PressureRunWatcher` obserwuje też `useJournalEditForm` |
| 12 | stawka km nie dała się wyczyścić | już naprawione wcześniej (`rate: string | null`) |
| 13 | fokus z „Brak” nie trafiał w pole | naprawione: fokus w efekcie po zmianie segmentu (`SiteCardDialog.tsx`) |
| 14 | przeciągnięcie po stuknięciu rysuje od złego punktu | naprawione: `dragging` + `d.at` (`DimensionDrawer.tsx`) |
| 15 | pigułki Próba/Kształtki/Rury „wciśnięte”, a nic nie robią | naprawione: `aria-disabled`, gdy sekcja wymuszona danymi |
| 16 | licznik zdjęć z aparatu liczy odrzucone | naprawione: `addPhotos` zwraca liczbę dodanych, `catch` z toastem |
| 17 | przycisk NFC zawsze widoczny | naprawione: `hasNFC()` |
| 18 | etykiety bez `htmlFor` w karcie | nie potwierdzone (etykiety obejmują pola) |
| 19, 22, 24, 26, 27, 30, 31, 33 | skaner bez „Skanuj ponownie”, martwy input z `capture`, wycieki URL w StrictMode, klucze `key` pól zlecenia, brak cofania zmiany rodzaju/statusu, próba skończona wcześniej, pola minutnika, efekty resetu | otwarte (drobne, wymagają decyzji produktowych) |
| 20, 21 | NFC bez `role="status"`, `aria-label` na `<span>` w kilometrówce | naprawione |
| 23 | wyścig `useDictation.onend` | już naprawione wcześniej |
| 25 | „Z budów 0,00 zł” przy samych wpłatach | naprawione: „Wpłaty z budów” + suma wpłat |
| 28 | aktywny segment karty znika po synchronizacji | naprawione: efekt wybiera pierwszy dostępny segment |
| 29 | cichy błąd stanu początkowego w aucie | naprawione: toast |
| 32 | „ostatnie 30 dni” nie odświeża się po północy | naprawione: `dayTick` w zależnościach |

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
| T3 | odcisk protokołu nie obejmuje podpisów zdjęć z wymiarami (`useSiteCardActions.ts`) | naprawione: podpisy (z wymiarami) wchodzą do treści odcisku |
| T9 | `startViewTransition` wołane bezpośrednio w `Index.tsx` i `viewChange.ts` (poza strażnikiem WebKit) | naprawione: `canViewTransition` w `Index.tsx`/`viewChange.ts`; `viewTransitionGuard.test.ts` |
| T4–T35 | słabe asercje (mileage), brak wektora referencyjnego SHA-256, luki pokrycia (PDF, sitePackageIo, push client, tick), sleepy, rozbieżności `opis.md` | patrz raport |

## Zrobione 2026-11-11 (pierwsza partia)

K1, K2, K3, S1, S2, T1, T2, T9 oraz UI #1–#7 i #12. Dodatkowo `relay-server`: sprzątanie mapy limitów, zapis z ponawianiem, łagodne zamknięcie, ostatni wpis `X-Forwarded-For`, Dockerfile bez roota i bez domyślnego `TRUST_PROXY`. Reszta ustaleń wymaga weryfikacji i decyzji (zmiany modelu Yjs: W4, W11, W16; kopia zapasowa: W14, W15; pokoje i kod synchronizacji: S3–S5, S11–S13).

## Zrobione 2026-11-11 (druga partia)

W1–W5. Nowe pole wpisu `added` (opcjonalne, w `JOURNAL_ENTRY_KEYS`); starsze wpisy bez niego liczą się od `at`. Edycja wpisu przekazuje `base` do `updateJournalEntry`.

## Zrobione 2026-11-11 (trzecia partia)

W6–W10.

## Zrobione 2026-11-11 (czwarta partia)

W12, W13, W16, W17. W11, W14 i W15 czekają na decyzje (model Yjs list zdjęć; klucze kopii; scalanie sekcji pieniężnych).

## Zrobione 2026-11-11 (piąta partia)

UI #8, T3.

UI #9–#17, #20, #21, #25, #28, #29, #32 (szósta partia).

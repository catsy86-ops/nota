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
| D1 | `useNextBoundary`: pętla co 5 ms w dniu zmiany na czas zimowy | naprawione: `endOfDayOffset(now) + 1` zamiast „+24 h”; `useNextBoundary.test.ts` |
| D2 | brak pusha „Koniec zmiany” dla zmiany nocnej zaczętej wczoraj | naprawione: pętla od wczoraj; `schedule.dst.test.ts` |
| D3 | scalanie rozliczeń omija limit wpłat | naprawione: `mergeDump` liczy wpłaty z istniejącymi; `billing.test.ts` |
| D4 | brak limitów w `mergeDump` (punkty, auto, zestawy, zlecenia, odhaczenia) | naprawione: limity wejścia; `mergeLimits.test.ts` |
| D5 | osierocone zdarzenia auta i punkty bez pomieszczenia | naprawione w `mergeDump` (nie są zapisywane); sprzątanie już istniejących nie dodane |
| D6 | id etapu „constructor” daje kwotę NaN | naprawione: odczyt tylko własnych pól (`own` w `billing.ts`); `billing.test.ts` |
| D7 | `__proto__` w kluczach kopii Nauki | naprawione: `studyDump.ts`; `studyDumpProto.test.ts` |
| D8 | wysyłka harmonogramu push bez timeoutu i kolejki | naprawione: `AbortSignal.timeout(15 s)` i kolejka wysyłek (`client.ts`) |
| D9 | `daysWaiting` błędny o dzień wokół zmiany czasu | naprawione: poprawka o różnicę przesunięcia strefy; `paymentReminder.test.ts` (inna `7*DAY_MS` w `StudyJournal` zostaje, błąd do 1 h) |
| D10 | kilometrówka/cenniki poza kopią | = W14 (czeka na decyzję) |
| D11 | koszt przebudowy migawki przy 3000+ wpisach | zmierzone 2026-11-11: najgorsza przebudowa po zmianie 26 ms przy 3000 wpisach (Node, komputer; telefon ×4–6 ≈ 100–150 ms), w pomiarach telefonu (`docs/PERFORMANCE.md`) bez blokowania — bez zmian, cache per wpis niepotrzebny do ok. 10 tys. wpisów |

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
| 10 | miarka bez alternatywy klawiaturowej | decyzja właściciela: nie teraz; zrobione tylko: opis przez `aria-describedby`, informacja „dotykiem lub myszą”; pełna obsługa klawiaturą wymaga osobnego projektu |
| 11 | alarm końca próby nie działa w edycji wpisu | naprawione: `PressureRunWatcher` obserwuje też `useJournalEditForm` |
| 12 | stawka km nie dała się wyczyścić | już naprawione wcześniej (`rate: string | null`) |
| 13 | fokus z „Brak” nie trafiał w pole | naprawione: fokus w efekcie po zmianie segmentu (`SiteCardDialog.tsx`) |
| 14 | przeciągnięcie po stuknięciu rysuje od złego punktu | naprawione: `dragging` + `d.at` (`DimensionDrawer.tsx`) |
| 15 | pigułki Próba/Kształtki/Rury „wciśnięte”, a nic nie robią | naprawione: `aria-disabled`, gdy sekcja wymuszona danymi |
| 16 | licznik zdjęć z aparatu liczy odrzucone | naprawione: `addPhotos` zwraca liczbę dodanych, `catch` z toastem |
| 17 | przycisk NFC zawsze widoczny | naprawione: `hasNFC()` |
| 18 | etykiety bez `htmlFor` w karcie | nie potwierdzone (etykiety obejmują pola) |
| 19 | skaner bez „Skanuj ponownie” | naprawione (decyzja właściciela): przycisk po wykryciu kodu (`BarcodeScanner.tsx`) |
| 22 | martwy input z `capture` | bez zmian: e2e `study.spec.ts` pilnuje jego atrybutu, nieszkodliwy |
| 24 | wycieki object URL | naprawione w `SiteDocsPanel.tsx` (cleanup w efekcie); `PhotoDayDialog` ma cleanup, StrictMode tylko w dev |
| 26 | `key` pól zlecenia kasuje pisany tekst | naprawione: `useFieldKey` — pole nie jest przemontowywane w trakcie pisania (`SiteJobPanel.tsx`) |
| 31 | pola minutnika po zmianie z innego telefonu | naprawione: reset pól po zakończeniu próby (`PressureTestTimer.tsx`) |
| 33 | zbędne efekty resetu stanu | bez zmian (kosmetyka, ryzyko regresji większe niż zysk) |
| 27 | brak cofania zmiany rodzaju/statusu | naprawione (decyzja właściciela): toast „Cofnij” przy statusie zlecenia i „To zlecenie własne” |
| 30 | próba skończona wcześniej zawsze „szczelna” | naprawione (decyzja właściciela): ostrzeżenie „Próba jeszcze trwa” z „Zakończ mimo to”; `e2e/pressure-timer.spec.ts` |
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
| S5 | przekaźnik: `TRUST_PROXY=1` domyślnie w Dockerfile; mapa `hits` rośnie | otwarte (Dockerfile bez domyślnego `TRUST_PROXY` — partia 1) |
| S6 | Share Target: `Origin: null` przechodzi, zapis bez zgody | naprawione (decyzja właściciela): „Zapisać udostępnione w NOTKACH?” przed zapisem (`useLaunchIntents.ts`); `e2e/share-files.spec.ts`, `share-to-entry.spec.ts` |
| S7 | `?share=` dodaje notatkę bez potwierdzenia | naprawione: pytanie „Dodać udostępnioną notatkę?” (`useImportExport.ts`); zmiana formatu linku na `#share=` nie zrobiona |
| S8 | `?akcja=shift-done&dzien=` zapisuje dowolne nadgodziny | naprawione: zakres −2 h…+16 h w `finishNow.ts`; `finishNow.test.ts` |
| S9 | `?akcja=done` na `/notatka/<id>` | bez zmian (wymaga znajomości id, odwracalne) |
| S10 | pozostałe akcje z adresu | brak błędu |
| S11 | kod synchronizacji w adresie `?pair=` | naprawione (decyzja właściciela): `#pair=` + czytanie starego `?pair=` (`pairLink.ts`); kod w `localStorage` bez zmian |
| S12 | AAD przekaźnika bez `seq` | bez zmian: zysk znikomy, zmiana łamie zgodność; przekaźnik jest zaufany tylko co do dostępności |
| S13 | brak usuwania pokoju na przekaźniku | naprawione (decyzja właściciela): `DELETE /rooms/:id` + „Odłącz i usuń z przekaźnika”; `relay-server/server.test.js`. `ALLOWED_ORIGINS` nadal `*` domyślnie (zalecenie w README) |
| S14 | import `.ics` bez limitów | naprawione: 2000 zdarzeń, tytuł 1000, opis 20 000, błąd duplikatów między plikami; `icsImport.test.ts` |
| S15 | przywracanie ustawień z kopii | naprawione: wartość ≤ 2,5 mln znaków i tylko tekst (`SETTING_VALUE_MAX`); `fullBackup.test.ts`. Autolock skarbca z kopii bez walidacji (decyzja UX) |
| S16 | Skarbiec: sufit iteracji KDF 10 mln | naprawione: 3 mln (`vault.ts`) |
| S17 | nagłówki | naprawione: HSTS na rok bez `includeSubDomains` (decyzja właściciela), README poprawione; COOP nie dodane (wymaga testu okien) |
| S18 | `npm audit` | `audit fix` bez `--force` (16 → 14; reszta to narzędzia dev, wymaga zmian łamiących) |
| S19–S20 | brak osobnych pozycji w raporcie | — |

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

## Zrobione 2026-11-11 (siódma partia, testy)

T-pozycje z raportu testów: wektor SHA-256 i brak Web Crypto (`documentFingerprint.test.ts`), trafienie we właściwy wpis (`fingerprintStore.test.ts`), `dimensions.test.ts`, limity kilometrówki i magazyn (`companyPrefs.test.ts`), granice protokołu próby (`pressureTest.test.ts`), podpis w protokole odbioru (`handover.test.ts`), `exact: true` w `newJob` (`e2e/jobs.spec.ts`). Asercje kilometrówki (T11–T12) były już poprawione wcześniej. Nadal otwarte: testy PDF (T6), `sitePackageIo` (T7), `push/client` i `tick()` w serwerze push (T19–T21), `captureFrame`, NFC, `aiModel`, sleepy w e2e, testy komponentów.

## Zrobione 2026-11-11 (ósma partia, testy)

T6 (treść PDF-ów: `pdfBuilders.test.ts` z atrapą jsPDF — nagłówki, kwoty, stopka z odciskiem na każdej stronie, numeracja), T7 (eksport → odczyt → import i idempotentność w `sitePackageApply.test.ts`), T19 (`push/client.test.ts`: odmowa zgody, serwer niedostępny/5xx, wymiana subskrypcji, `keepalive`), T20–T21 (`tickStore` wyniesiony do `push-server/core.js` z wstrzykiwaną wysyłką; testy 410/5xx/spóźnione/nieaktywne oraz `/unsubscribe` z tokenem), T23 (`captureFrame`), T24 (stany pobierania modelu), T25 (powody NFC). Zostają: sleepy w e2e (T32–T33), testy komponentów (T31), `viewTransition` rozbić na osobne `it` (T26), `van`/`budowaCompression`/`monthlySummary` (T27, T28, T30), rozbieżności `opis.md` (T35).

## Zrobione 2026-11-11 (dziesiąta partia, testy)

T26 (`viewTransition.test.ts` rozbity na osobne przypadki, Firefox), T27 (granice `van`: minimum równe stanowi, `cleanVanQty`, `VAN_ITEMS_MAX`), T28 (prawdziwa bomba gzip, format v1, próg kompresji), T30 (`﻿` zamiast literalnego BOM), T32 (dwa 2,5-sekundowe sleepy w `private-notes.spec.ts` zastąpione `expect.poll` na zawartości IndexedDB), T35 (poprawki rozbieżności w `opis.md`). Zostają: pozostałe `waitForTimeout` w e2e (to czekania na brak zdarzenia, bez sygnału do odpytywania), testy komponentów (T31), T33.

## Zrobione 2026-11-11 (trzynasta partia, bezpieczeństwo)

S6–S8, S11, S13–S18. Zostają S3–S5 (decyzje projektowe), S9, S12 (świadomie bez zmian).

## Zrobione 2026-11-11 (czternasta partia)

UI #26, #31, T31 (testy komponentów `MileageDialog`, `SiteBillingDues`), D11 (pomiar). Zostają wyłącznie decyzje właściciela (W11, W14/D10, W15, S3–S5) oraz pozycje świadomie bez zmian (UI #10, #22, #33, S9, S12).

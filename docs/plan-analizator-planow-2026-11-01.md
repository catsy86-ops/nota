# Plan: Analizator planów hydraulicznych (2026-11-01)

Zlecenie: `docs/zadanie-analizator-planow-2026-10-29.md`. Plan na podstawie przeglądu agenta `architect` (2026-11-01, bez zmian w plikach).

## Kluczowe ograniczenia repozytorium

- **Precache:** zapas ok. 62 KiB do progu 4,0 MiB. `globPatterns: **/*.js` łapie też `public/`, więc silnik OCR i widok Planów muszą być w `globIgnores`, z własną regułą `runtimeCaching` (CacheFirst) dla `/ocr/`.
- **Sprzątanie obrazów:** klucze planów dopisać do `referencedImages()` i `syncableRefs()` w `yjsStore.ts` (moduł `planRefs.ts` bez `yjs`, wzorem `journalRefs.ts`). Bez tego `collectGarbage` skasuje obrazy po 7 dniach.
- **Kopia:** sekcja `plans` w `FullBackup` i `fullBackupSchema` (Zod obcina nieznane klucze bez błędu), obrazy w `collectAttachmentBlobs` z licznikiem `plans`.
- **ESLint:** `yPlans.ts` i jego test na liście plików, które mogą importować `yjs`.
- **Routing:** `parseViewRoute` odrzuca drugi człon ścieżki, analiza przez `/plany?analiza=<id>`. Nowy dział dotyka ok. 18 plików (typ `View`, `viewRoute`, `viewMeta`, `indexViews`, `viewPreload`, `hiddenViews`, `sidebarItems`, `BottomNav`, `CommandPalette`, `AppHeader`, `Index` i in.). Nie dodawać do `keptViews` (pamięć telefonu).
- **Import:** sygnatura bajtów (PNG/JPEG/WebP), wymiary z nagłówka przed dekodowaniem, bez SVG. `prepareImage` koduje do JPEG i psuje cienkie linie — tylko `fitWithin`.
- **Tesseract.js:** domyślnie pobiera z CDN i cache'uje w IndexedDB `keyval-store` (wspólna z innymi magazynami). Ustawić lokalne `workerPath`/`corePath`/`langPath` z `public/ocr/<wersja>/`, `workerBlobURL:false`, `cacheMethod:"none"`. Pliki kopiowane skryptem w `prebuild` (nie commitować binariów).
- **jsdom:** brak `Worker`, `OffscreenCanvas`, `createImageBitmap` — logika czysta, RPC wstrzykiwane (`src/workers/rpc.ts`).

## Struktura

- `src/lib/plans/` (czysta logika, Vitest): `model.ts` (typy, limity, `clean*`), `geometry.ts`, `calibration.ts`, `viewport.ts`, `diameters.ts`, `systems.ts`, `assign.ts`, `fittings.ts`, `summary.ts`, `csv.ts`, `imageSniff.ts`, `tiles.ts`, `detect/lines.ts`, `planRefs.ts`.
- Yjs i sklep: `src/lib/plans/yPlans.ts` (`createYPlans(doc)`, UndoManager, dump/merge), `plansStore.ts`.
- Przeglądarka: `imageImport.ts`, `ocr/ocrClient.ts`, `src/workers/planDetect*.ts`.
- UI: `src/components/plans/` — `PlansView`, `PlansList`, `NewAnalysisDialog`, `PlanEditor`, `PlanCanvas` (SVG + Pointer Events, wzór gestów `NoteGraph.tsx`/`noteGraph.ts`), panele kalibracji, trasy, symboli, OCR, wykrywania, `MaterialsTable`.

## Model danych (Yjs, `yjsStore.doc`, klucze `pid␁id`, wartość = zwykły obiekt, ostatni zapis wygrywa per encja)

| Mapa | Klucz | Wartość |
|---|---|---|
| `planProjects` | `pid` | `{v, id, name, siteId?, image:{ref,type,size,w,h}, work?:{…}, status, createdAt, updatedAt}` |
| `planSettings` | `pid␁cal`, `pid␁colors` | kalibracja `{a, b, meters, at}`; mapowanie kolorów `[{hex, system}]` |
| `planRoutes` | `pid␁rid` | `{id, system, diameterMm?, diameterFrom?, pts:[x,y,…], source, confidence?, verified, estimate?, label?, at}` |
| `planTexts` | `pid␁tid` | `{id, raw, text, box, confidence, verified, at}` |
| `planSymbols` | `pid␁sid` | `{id, type, x, y, system?, confidence?, manual, verified, at}` |
| `planItems` | `pid␁iid` | ręczne pozycje zestawienia |

Wartości pochodne (`lengthPixels`, `lengthMeters`, status pomiaru, wiersze zestawienia) liczone przy odczycie — nie rozjadą się po ponownej kalibracji. Propozycje OCR i wykrywania tylko w pamięci widoku, do Yjs dopiero po „Dodaj do planu” (`verified:false`). Współrzędne zawsze w pikselach oryginału; SVG `viewBox` = wymiary oryginału, kopia robocza skalowana przez przeglądarkę.

## Fazy

Stan: faza 2 (d353ea7), faza 3 (b761b57) i faza 4 — OCR (2026-11-01) zrobione. Faza 5 (propozycje tras z koloru, własny algorytm w workerze; OpenCV odłożony — opis w opis.md) zrobiona. Faza 6 (symbole ręczne, kolana i trójniki z geometrii) zrobiona. Następna: faza 7 (zestawienie materiałów, CSV, przekazanie do Pracy).

| Faza | Zakres | Rozmiar |
|---|---|---|
| 2 | Dział, routing, model/yPlans/sklep, planRefs (GC, sync, kopia), import z walidacją, kopia robocza, lista, edytor (zoom, przesuwanie, dopasowanie) | L |
| 3 | Kalibracja, rysowanie tras, właściwości, zaznaczanie i usuwanie, cofanie | M–L |
| 4 | OCR: pliki lokalne, `ocrClient`, kafle, normalizacja średnic, weryfikacja, przypisanie średnicy | L |
| 5 | Propozycje tras z koloru (worker: maska, szkielet, polilinie), za flagą „eksperymentalne” | L |
| 6 | Symbole ręczne, korekta, propozycje kolan i trójników z geometrii | M |
| 7 | Zestawienie (bez skali nigdy jako metry), ręczne pozycje, podświetlenie, CSV, przekazanie do Pracy | M |
| 8 | Testy (Vitest, `e2e/plans.spec.ts`, axe, precache bez `ocr/`, OCR bez żądań na zewnątrz), `opis.md` | M |

Agenci: `frontend-design` przed widokami, `security-reviewer` (mapy Yjs, obrazy klientów, CSV, import), `performance-engineer` (tesseract, precache).

## Decyzje

Podjęte 2026-11-01 przez właściciela:

- D1 — osobny dział `/plany` w grupie Praca, kafel w „Więcej”; z karty budowy „Analizy planów” i „Analizuj” przy dokumencie.
- D2 — widok Planów i OCR poza precache; widok pobierany w tle przy pierwszej sesji online, OCR po „Pobierz silnik OCR”.
- D3 — oryginał ponad 2 MB albo 4096 px zostaje na urządzeniu, synchronizuje się kopia robocza ≤ 2 MB.
- D4/D5 — „wszystko”: OCR `eng` + `pol`, wykrywanie tras własnym algorytmem po kolorze oraz OpenCV.js jako dodatkowy silnik pobierany na żądanie (poza precache, za flagą „eksperymentalne”).

Przyjęte rekomendacje (do zmiany na prośbę):
- D6 — przekazanie do Pracy: rekomendacja (a) „Dodaj do braków” przez `addShortage`, tylko pozycje potwierdzone ze skalą.
- D7 — obrazy planów w budżecie kopii 40 MB, najpierw kopie robocze.
- D8 — limity: 50 projektów, 500 tras, 1000 punktów na trasę, 1000 tekstów, 1000 symboli, 200 ręcznych pozycji; plik ≤ 20 MB, ≤ 40 MP, bok ≤ 12 000 px.
- D9 — CSV ze średnikiem, BOM, przecinek dziesiętny, ochrona przed formułami.
- D10 — wiersze wyliczane z tras tylko do odczytu, edycja w trasie.

## Faza 4 — OCR: zalecenia `performance-engineer` (2026-11-01)

- **Pliki lokalnie, nie z CDN.** Skrypt `scripts/copy-ocr.mjs` w `predev`/`prebuild` kopiuje do `public/ocr/<wersja core>/` (w `.gitignore`): `worker.min.js` (tesseract.js/dist), `tesseract-core-simd-lstm.js` + `.wasm`, `tesseract-core-lstm.js` + `.wasm` (bez SIMD), `eng.traineddata.gz` i `pol.traineddata.gz` z `@tesseract.js-data/*/4.0.0_best_int`. Bez `?url` (hash w nazwach psuje ścieżki tesseracta). Pierwsze pobranie ok. 6,8–8,6 MB.
- **Opcje:** `corePath` = konkretny plik wybrany przez `wasm-feature-detect` (`simd`), `workerPath`, `langPath` z `/ocr/<wersja>`, `workerBlobURL:false` (wymagane — core liczy katalog wasm z `self.location`), `cacheMethod:"none"` (domyślnie tesseract pisze ~10 MB do IndexedDB `keyval-store`, wspólnej z aplikacją i kasowanej przez `ErrorBoundary`). OEM `LSTM_ONLY`, PSM `SPARSE_TEXT` (11), `user_defined_dpi: 300`, `recognize(…, { blocks: true })`. Bez whitelisty w głównym przebiegu.
- **Workbox:** `globIgnores` `**/ocr/**`, `**/opencv/**`, chunk `ocrClient-*`; reguła `CacheFirst` `ocr-engine` (maxEntries 10, status 200) przed regułami ogólnymi; nagłówki `/ocr/*` immutable w `netlify.toml`/`vercel.json`. „Pobierz silnik” = `fetch` listy plików z postępem, `navigator.storage.persist()`.
- **Telefon:** jeden worker, kafle 2048 px z zakładką ~144 px z kopii roboczej, deduplikacja słów po bbox w układzie oryginału; anulowanie = `worker.terminate()`; `terminate()` po zakończeniu i przy odmontowaniu. Ø nie jest pewne w modelach — normalizacja po rozpoznaniu (Ø/ø/⌀/Φ/0/O/@ + liczba z listy typowych średnic → średnica z obniżoną pewnością, DN, kody ZW/CWU/CO/WC/KAN).
- **OpenCV:** 10,9 MB (`@techstark/opencv-js`), 2–6 s startu na Androidzie. Rekomendacja: najpierw własny algorytm po kolorze w workerze (faza 5); OpenCV (decyzja D5 „wszystko”) jako klasyczny worker z `importScripts("/opencv/<wersja>/opencv.js")`, poza precache, za flagą „eksperymentalne”.
- **Testy:** `bundle.spec` — precache bez `ocr/`/`opencv`/`ocrClient`, reguła `ocr-engine` istnieje, pliki skopiowane; `plans.spec` — OCR próbki „DN 25” z blokadą żądań spoza origin i drugi przebieg offline.

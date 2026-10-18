# Plan rozbudowy na telefonie (2026-10-18)

Poprzedni plan mobilny (roadmap, „Plan dopracowania UI/UX na telefonie — 2026-10-11”) dotyczył dopracowania: usterek, wzorców, wydajności i QA. Jest zrobiony poza 5.3 (ręczne QA na urządzeniu). Ten plan dotyczy **nowych możliwości** — tego, co telefon daje, a aplikacja jeszcze nie wykorzystuje.

## Stan (2026-10-18, wieczór)

- ✅ M1.2 jedno okno (`launch_handler: navigate-existing`).
- ✅ M1.1 przyciski w powiadomieniu push i akcja przy zamkniętej aplikacji (`?akcja=`). Serwer push trzeba wdrożyć ponownie (pole `snooze`).
- ✅ M1.3 notatka głosowa w notatkach (nie we wpisach Dziennika). Synchronizuje się jak inne załączniki do 2 MB — inaczej niż domyślna decyzja „tylko na telefonie”.
- ✅ M2.1 „Tu jestem”, zapis lokalizacji budowy, „Budowa obok”, link „Mapa” przy wpisie.
- ⏭ M2.2 mapa w raporcie — pominięte (decyzja domyślna: lokalizacja tylko w aplikacji).
- ⏭ M2.3 QR — już było: `SyncSettings` pokazuje QR z linkiem `?pair=`. Skaner w aplikacji nic nie dodaje (Android przechwytuje link, iPhone nie ma `BarcodeDetector`).
- ✅ M3.1 Grafik w poziomie (wariant `short:`).
- ⏳ M0 (QA na telefonie, wdrożenie serwera push) — po stronie użytkownika.
- Budżet wejściowego JS: zapas 16 B po przeniesieniu panelu statusu do leniwej paczki.

Szczegóły w `opis.md` (sekcje „Telefon — …”, „Praca → Dziennik budowy — „Tu jestem””, „Grafik — telefon w poziomie”).

## Punkt wyjścia

**Już jest:** Share Target (tekst, obrazy, PDF), skróty z ikony („Szukaj”, „Nowa lista”), odznaka na ikonie, blokada wygaszania, dyktowanie (`SpeechRecognition`), wibracje, zdjęcia z aparatu, powiadomienia (lokalne i Web Push z serwerem — czeka na wdrożenie), trwały magazyn, tryb budowa (rękawice, słońce), offline-first, gesty na kaflach.

**Nie ma:** lokalizacji, nagrywania dźwięku, skanera kodów, akcji w powiadomieniach, `launch_handler`, układu poziomego dla Grafiku.

**Dla kogo:** hydraulik na budowie (rękawice, słońce, brak zasięgu, zdjęcia „przed zakryciem”), praca zmianowa (Grafik), nauka w przerwach. Telefon ma „złapać myśl w 2 s i mieć pewność, że wróci”.

**Ograniczenia:**
- Budżet wejściowego JS: ok. 381 z 384 KB gzip — każda nowa funkcja musi być leniwa (osobny chunk).
- Synchronizacja jest na żywo między urządzeniami (Yjs przez serwer sygnalizacji), więc „synchronizacja w tle” przy zamkniętej aplikacji nie ma czego wysłać.
- Wsparcie platform podane według mojej wiedzy — każdą funkcję trzeba sprawdzić na prawdziwym telefonie (Android Chrome, iPhone Safari z PWA na ekranie głównym).

## Faza M0 — warunek wstępny

| # | Co | Nakład |
|---|----|--------|
| M0.1 | Ręczne QA na telefonie (roadmap 5.3): klawiatura w kompozytorze, haptyka, gesty, pasek adresu, instalacja PWA. Bez tego nowe funkcje budujemy na niesprawdzonej bazie | S (Twój czas) |
| M0.2 | Wdrożenie serwera Web Push (`push-server`, commit fe01dcd) — warunek dla M1.1 przy zamkniętej aplikacji | S (wdrożenie) |

## Faza M1 — szybsze wejście i wyjście

| # | Co | Gdzie | Nakład | Android / iPhone |
|---|----|-------|--------|------------------|
| M1.1 | **Akcje w powiadomieniu przypomnienia:** „Zrobione” i „Odłóż o 1 h” bez otwierania aplikacji | `public/sw-notifications.js` (`notificationclick` już jest), `lib/reminderTime.ts` | S/M | tak / nie (iPhone otwiera aplikację — przyciski się nie pokażą) |
| M1.2 | **Jedno okno aplikacji:** `launch_handler: focus-existing` w manifeście — skrót, udostępnienie i powiadomienie trafiają do otwartego okna zamiast otwierać drugie | `vite.config.ts` (manifest), obsługa `launchQueue` | S | tak / bez zmian |
| M1.3 | **Notatka głosowa:** nagranie (`MediaRecorder`) jako załącznik w notatce i we wpisie Dziennika, z odtwarzaczem na kaflu. Dyktowanie zostaje obok — nagranie to zapis, dyktowanie to tekst | `lib/attachments*`, `AttachmentsList.tsx`, `JournalEntrySheet.tsx` | M | tak / tak (format różny: webm vs mp4 — odtwarzacz musi przyjąć oba) |

## Faza M2 — praca na budowie

| # | Co | Gdzie | Nakład | Android / iPhone |
|---|----|-------|--------|------------------|
| M2.1 | **„Tu jestem” przy wpisie Dziennika:** przycisk zapisuje współrzędne wpisu tylko po stuknięciu (nigdy w tle). Na karcie budowy „Zapisz lokalizację budowy” raz, na miejscu. Potem nowy wpis podpowiada najbliższą budowę | `lib/study/*` (pole `geo` we wpisie i karcie), `JournalEntrySheet.tsx`, `SiteCardDialog.tsx` | M | tak / tak |
| M2.2 | **Raport z mapką:** w raporcie dnia/tygodnia link „otwórz w mapach” przy wpisach z lokalizacją (bez wbudowanej mapy — zero KB) | `JournalReport.tsx`, `lib/study/contact.ts` (nawigacja już jest) | S | tak / tak |
| M2.3 | **Parowanie urządzeń kodem QR:** komputer pokazuje kod synchronizacji jako QR, telefon go skanuje aparatem — zamiast przepisywania kodu. Kod wpisywany ręcznie zostaje jako zapas | `SyncSettings.tsx`; generator QR i skaner leniwie | M | skan: tak / nie (iPhone nie ma `BarcodeDetector` — zostaje wpisanie kodu); pokazanie QR: wszędzie |

## Faza M3 — ekran

| # | Co | Gdzie | Nakład |
|---|----|-------|--------|
| M3.1 | **Grafik w poziomie na telefonie:** po obróceniu miesiąc na całą szerokość, panel podsumowania pod spodem albo w arkuszu | `shifts/ShiftsView.tsx`, media `(orientation: landscape) and (max-height: 500px)` | S/M |
| M3.2 | **Tryb budowa automatycznie przy jasnym słońcu?** — `AmbientLightSensor` jest prawie niedostępny w przeglądarkach; **nie robimy**, tryb „Automatycznie” zostaje jak jest | — | — |

## Świadomie nie robimy

- **Widżet na ekranie głównym:** widżety PWA nie działają na Androidzie ani iPhonie. Zamiast tego: skróty z ikony i odznaka (już są).
- **Synchronizacja w tle (Background Sync):** synchronizacja jest na żywo między urządzeniami, przy zamkniętej aplikacji nie ma czego wysłać.
- **Obsługa plików (`file_handlers`) i protokołu:** działa głównie na komputerze; na telefonie nie daje nic.
- **Rozpoznawanie tekstu ze zdjęcia (OCR) w przeglądarce:** `TextDetector` jest eksperymentalny; biblioteka OCR to megabajty.
- **Przesuwanie między zakładkami dolnego paska gestem:** gryzie się z gestami na kaflach (przypnij / archiwizuj).

## Decyzja na później: natywna otoczka

Otoczka (TWA na Androida, Capacitor dla obu platform) dałaby widżet, NFC, prawdziwe tło i powiadomienia z akcjami na iPhonie. Koszt: sklep z aplikacjami, podpisywanie, drugi kanał wydań. Wracamy do tego, jeśli po M1–M3 brakuje czegoś, czego PWA nie da.

## Decyzje, które wymagają Twojej odpowiedzi

1. **Notatka głosowa (M1.3):** nagrania są duże (ok. 0,5–1 MB na minutę). Czy mają się synchronizować między urządzeniami, czy zostają na telefonie? Limit długości nagrania (np. 3 min)?
2. **Lokalizacja (M2.1):** zgoda na zapisywanie współrzędnych we wpisach (tylko po stuknięciu)? Czy współrzędne mają trafiać do raportu wysyłanego szefowi, czy tylko do Twojego wglądu?
3. **QR (M2.3):** akceptujesz, że na iPhonie zostaje wpisywanie kodu?
4. **Kolejność:** proponuję M0 → M1.2 → M1.1 → M2.1 → M2.2 → M1.3 → M2.3 → M3.1 (najpierw tanie i pewne, potem większe).

## Weryfikacja każdej funkcji

Typecheck, lint, testy jednostkowe logiki (czyste funkcje w `lib/`), e2e na projektach `pixel-7` i `iphone-14`, budżet bundla (`e2e/bundle.spec.ts`), a na końcu sprawdzenie na prawdziwym telefonie — emulacja nie pokaże uprawnień, aparatu ani powiadomień.

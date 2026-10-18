# Plan po audycie aplikacji (2026-10-18)

Cztery audyty tylko do odczytu: architektura i jakość kodu, wydajność i paczka, bezpieczeństwo i trwałość danych, UX/dostępność/testy. Ustalenia są z odczytu kodu, nie z uruchomienia; szacunki KB i ms wymagają pomiaru. Przed każdą zmianą: typecheck, lint, testy jednostkowe, e2e powiązanych plików, `e2e/bundle.spec.ts`.

## Uwagi do wiarygodności raportów

- **Bezpieczeństwo:** agent napisał, że `SECURITY.md` nie istnieje. Wcześniejsza notatka sesji mówi, że został zrobiony audyt OWASP i dodany `SECURITY.md`. Trzeba to sprawdzić przed kolejnym audytem bezpieczeństwa.
- **UX/testy:** agent potwierdził, że testy synchronizacji, importu i przywracania kopii istnieją (`yjsSync.test.ts`, `fullBackup.test.ts`, `import/commit.test.ts`, e2e `file-sync`, `sync-code`, `import-external`, `search-backup`). Wcześniejsze stwierdzenie „brak testów” jest nieprawdziwe.
- **Wydajność:** dwie pozycje są do zmierzenia (rozmiar węzłów DOM na kartę, realny zysk z przeniesienia `vendor-radix`).

## Priorytet 1 — bezpieczeństwo i utrata danych

| # | Problem | Gdzie | Naprawa | Nakład |
|---|---------|-------|---------|--------|
| S1 | Serwer push bez uwierzytelnienia i bez allowlisty hostów endpointów; CORS `*`; limit 100 subskrypcji można zapchać, nowi użytkownicy dostają 503 | `push-server/core.js:28-35`, `push-server/server.js:12,122-151` | Allowlista hostów usług push, token powiązany z subskrypcją, limit żądań na IP, bez `*` w `ALLOWED_ORIGINS` | 1 dzień |
| S2 | Tytuły i treść zwykłych notatek, dziennika i Pracy trafiają na serwer jawnym tekstem w `store.json` | `src/lib/push/schedule.ts:92-93,180,190,201`, `push-server/server.js:43-48` | Neutralny tekst w payloadzie („Przypomnienie z NOTKI”), szczegóły dopiero w aplikacji | 0,5 dnia |
| S3 | Przywracanie kopii nadpisuje skarbiec bez porównania `epoch` i bez kopii sprzed przywrócenia; starszy backup po zmianie hasła cofa skarbiec | `src/lib/exportNotes.ts:219-223` | Automatyczny snapshot w IndexedDB przed `replaceAll`; ostrzeżenie lub odmowa przy niższym `epoch`; dialog z liczbą notatek do usunięcia | 1 dzień |
| S4 | Zmiana hasła skarbca pomija notatki, których nie da się odszyfrować, bez listy i bez ostrzeżenia | `src/lib/privateNotes.ts:422`, `src/components/vault/VaultDialogs.tsx:267` | Lista tytułów i blokada zmiany albo jawne potwierdzenie, gdy `skipped > 0` | 0,5 dnia |
| S5 | Import ZIP: limity liczą się z nagłówków ZIP kontrolowanych przez autora archiwum; cały plik w pamięci; plan importu trzyma wszystkie treści naraz (zip bomb) | `src/lib/import/collect.ts:71-81`, `src/lib/import/zip.ts:87`, `src/lib/import/plan.ts:127-133` | Licznik faktycznie rozpakowanych bajtów z budżetem globalnym, limit współczynnika kompresji, zapis partiami | 1–2 dni |
| S6 | P2P: nazwa pokoju z szybkiego haszu kodu (FNV-64, bez soli), publikowana na serwerach sygnalizacyjnych; kody 8-znakowe nadal przyjmowane | `src/lib/yjsSync.ts:149-161,217`, `src/components/SyncSettings.tsx:16,51` | Wygaszenie kodów 8-znakowych i nazwy legacy z datą; migracja z ostrzeżeniem | 0,5 dnia |
| S7 | Kod awaryjny skarbca jako jawny `.txt` (repo na OneDrive) | `src/components/vault/VaultDialogs.tsx:343-353` | Ostrzeżenie przed zapisem w folderach synchronizowanych, sugestia menedżera haseł | 2 h |

## Priorytet 2 — dane i poprawność

| # | Problem | Gdzie | Naprawa | Nakład |
|---|---------|-------|---------|--------|
| D1 | Dwie kopie czyszczenia wpisu dziennika (`sanitizeStudy` i `cleanEntry`) różnią się walidacją tematu i listy punktów | `src/lib/study/store.ts:39,66-89`, `src/lib/study/yStudy.ts:142,198` | Jedna `cleanEntry(raw, ctx)` używana przez obie ścieżki (import, peer, widok) | S–M |
| D2 | Cykle importów w czasie wykonania: `yjsSync` ↔ `imageSync`; `sites` ↔ `siteHours` | `src/lib/yjsSync.ts:4`, `src/lib/imageSync.ts:4`, `src/lib/study/sites.ts:5`, `siteHours.ts:1` | Wydzielić `cleanSiteHours` i `entrySiteId`; provider w `imageSync` jako parametr | S |
| D3 | Połknięte błędy: migracja Nauki zwraca `false` bez logu; zerowanie stanu bez logu; licznik prób hasła wraca do zera przy uszkodzonym kluczu | `src/lib/study/data.ts:31`, `src/lib/notesStore.ts:20`, `src/lib/privateNotes.ts:63` | `logDiag` w miejscach dotyczących danych i bezpieczeństwa | S |
| D4 | Komunikaty błędów bez wskazania, co zrobić; surowe `err.message` w tekście | `BackupSettings.tsx:140,159,173,229`, `useBackupReminders.ts:49,55`, `privateActions.ts:35`, `useImportExport.ts:24`, `useDictation.ts:63` | Wzorzec „Co się stało — co zrobić”, mapowanie znanych błędów, „Spróbuj ponownie” przy backupie | M |
| D5 | Brak testu trybu „nadpisuj jeden plik” kopii zapasowej (ryzyko utraty poprzedniego backupu); brak testu trwałości danych | `src/lib/backupFileHandle.ts`, `src/lib/storagePersistence.ts` | Test z mockiem `FileSystemFileHandle` (zapis, odmowa, plik zniknął) + e2e | M |

## Priorytet 3 — UX i dostępność

| # | Problem | Gdzie | Naprawa | Nakład |
|---|---------|-------|---------|--------|
| U1 | Przypomnienia: brak informacji, że powiadomienia są wyłączone; dopisek o działaniu w tle za długi | `src/components/ReminderPicker.tsx:169`, `src/lib/notificationPermission.ts` | Stan uprawnień w pickerze („Powiadomienia wyłączone — włącz w ustawieniach przeglądarki”), dopisek w jednym zdaniu | M |
| U2 | Pasek dodawania notatki: ok. 10 ikon w rzędzie; etykiety „Zapisz i dodaj kolejną” różne w trybach; „Podstrona w…” urwana | `src/components/AddNoteBar.tsx:617-714,724,729,695,700` | Jedna nazwa na obu trybach, pełne zdania, skrót w tooltipie; ewentualnie menu „Więcej” | S / M |
| U3 | Przełącznik motywu: etykieta zmienia się i jednocześnie `aria-pressed` — czytnik zapowiada podwójnie | `src/components/AppHeader.tsx:148-149` | Stała etykieta „Tryb ciemny” z `aria-pressed` | S |
| U4 | Pusty wpis w Dzienniku: błąd tylko w jednorazowym toaście | `src/components/study/JournalEntrySheet.tsx:350-355` | Podpowiedź przy textarea (`aria-describedby`) | S |
| U5 | Dwa przyciski o tej samej etykiecie „Widok i kolumny”; „Filtry”/„Sortowanie” bez `aria-expanded` | `ViewControls.tsx:58,68,130,169` | Różne nazwy; stan przez `aria-expanded` | S |
| U6 | Mieszanka nazw: „Sync”, „Import / Eksport” vs „Import i eksport”, „backup” vs „kopia”, „Nie dało się” vs „Nie udało się” | `SettingsDialog.tsx:70`, `AppHeader.tsx:170`, `BottomNav.tsx:200`, `BackupSettings.tsx:138` | Krótki glosariusz (Kopia zapasowa, Synchronizacja, Import/Eksport), grep | S |

## Priorytet 4 — wydajność i paczka

Paczka wejściowa jest na progu (393 200 B przy limicie 393 216 B). Najpierw zysk w paczce, potem zmiany runtime.

| # | Co | Zysk (szacunek) | Nakład | Ryzyko |
|---|----|-----------------|--------|--------|
| P1 | Usunąć `vendor-radix` z `manualChunks` (`vite.config.ts`) — eager wchodzą głównie Tooltip i AlertDialog | 3–8 KB gzip | 1 linia | niskie; `bundle.spec.ts` wychwyci |
| P2 | Eksport/import/backup poza wejściem (`useImportExport`, `exportZip`→`exportNotes`); `useBackupReminders` przy starcie też trzeba przepiąć | 4–8 KB gzip | średni | niskie |
| P3 | Nudże poza wejściem (`useShiftEveningNudge` → `push/schedule` → `yStudy`); `setInterval` po imporcie | 5–10 KB gzip | średni | średnie: opóźnienie pierwszego sprawdzenia przypomnień |
| P4 | `public/`: usunąć `placeholder.svg` (bez odwołań, 28 KB w precache), skompresować PNG (oxipng/pngquant) | 100–150 KB precache (nie próg JS) | minimalny | niskie; ikonę maskable sprawdzić wizualnie |
| P5 | Jeden zegar zamiast kilku pollerów (`lib/hourlyTicker.ts` już istnieje); timer czyszczenia kosza z zależnością `[notes]` przenieść na ref | mniej wybudzeń | niski | niskie |
| P6 | Pasek wyszukiwania: rotacja podpowiedzi co 3,2 s re-renderuje cały komponent | mniej renderów | mały | niskie |
| P7 | Rozbić kontekst `NotesProvider` (jeden obiekt → każda zmiana re-renderuje wszystkich konsumentów) | ms na edycję | średni–wysoki | średnie; najpierw pomiar w React Profiler |
| P8 | `overlayHistory.ts`: `popstate` bez `removeEventListener` — sprawdzić | — | S | niskie |

Poza progiem: react-router-dom (10–12 KB) to zmiana architektoniczna, odłożyć. CSS (213 KB raw) — osobny audyt.

## Priorytet 5 — architektura i porządek w kodzie

| # | Co | Nakład |
|---|----|--------|
| A1 | `Index.tsx` ma ok. 870 linii i 14 `useState`; wydzielić hooki per obszar (zaznaczenie, dialogi, karty przeglądu) | M–L |
| A2 | `yjsStore.ts` (995 linii), `JournalEntrySheet.tsx` (877), `AddNoteBar.tsx` (764, 22 `useState`) — podział | M–L |
| A3 | `isMotionReduced` w `lib/` importuje hook z `hooks/`; store'y z hookami w `lib/study` | M |
| A4 | Martwy kod: nieużywane pliki `ui/skeleton.tsx`, `ui/calendar.tsx`, `ui/overlay-back.tsx` i eksporty (`getPersistedAchievements`, `uniqueAttachmentBytes`, `dailyOvertimeByDay`, `isApplePlatform`…). Najpierw `knip`, potem usunięcie | S |
| A5 | Płaski `src/lib` (226 plików) — grupy domenowe | M, bez zmiany zachowania |
| A6 | Rzutowania `as` (486, głównie `yjsStore`, `yStudy`, `siteItems`) — type guardy razem z D1 | M |
| A7 | Klucze localStorage z prefiksem `kaczy.` — **nie zmieniać bez migracji**, tylko dokumentować | — |

## Kolejność wykonania

1. **Teraz, bez decyzji:** P1 (jedna linia), P4 (`placeholder.svg`), D3 (logi), U3, U5, U6, A4 (`knip`) — małe, pewne.
2. **Bezpieczeństwo danych:** S3 i S4 (kopia przed przywróceniem, ostrzeżenie o skarbcu), potem S5 (zip bomb).
3. **Serwer push:** S1 i S2 — wymagają wdrożenia serwera, więc Twojej zgody.
4. **Dane i UX:** D1, D2, D4, D5, U1, U2, U4.
5. **Wydajność większa:** P2, P3 (najpierw zmierzyć), P5–P7.
6. **Architektura:** A1–A3, A5, A6 — na końcu, po testach.

## Decyzje potrzebne od Ciebie

1. **Serwer push (S1, S2):** czy mogę zmienić serwer (allowlista, token, neutralny tekst w payloadzie)? Zmiana zmienia treść powiadomień: szczegóły będą dopiero po otwarciu aplikacji.
2. **Kod awaryjny skarbca (S7):** ostrzeżenie wystarczy, czy zmienić sposób zapisu?
3. **Przywracanie kopii (S3):** odmowa przy starszym `epoch` czy tylko ostrzeżenie z możliwością potwierdzenia?
4. **P1 i P4:** mogę zrobić od razu?

Nic z tego nie zostało jeszcze zmienione w kodzie.

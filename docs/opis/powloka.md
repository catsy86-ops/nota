# Powłoka, Ustawienia i telefon

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Telefon — aplikacja Android (APK) z alarmami telefonu (F1, ADR-8, 2026-11-16)

- **Co robi.** Oprócz PWA jest aplikacja Android — ten sam interfejs w powłoce Capacitor. W niej przypomnienia (terminy notatek, zmiany z Grafiku, próby, serwis i pozostałe kategorie) to alarmy telefonu: przychodzą przy zamkniętej aplikacji, bez internetu i bez serwera push. W Ustawieniach → Powiadomienia zamiast Web Push jest przełącznik **„Alarmy telefonu”**, linia stanu (ile alarmów zaplanowano, kiedy), przycisk **„Próbny alarm za minutę”**, ostrzeżenie, gdy system nie pozwala na dokładne alarmy, i przełączniki kategorii. Powiadomienie ma te same przyciski co w PWA (odłóż, zrobione, koniec zmiany). **Stan: kod gotowy, nie uruchomiony na telefonie** — APK jeszcze nie zbudowano.
- **Gdzie.** `src/lib/native/platform.ts` (`isNativeShell`); `src/lib/reminders/sink.ts` (`ReminderSink`, `webpushSink`, `nativeAlarmPrefs`, `activeSink`, `useReminderSinkOn`), `nativePlan.ts` (`alarmId`, `channelOf`, `toAlarms`, `sentinelFor`, `planNative`), `nativeSink.ts` (`nativeSink`, `enableNativeAlarms`, `disableNativeAlarms`, `scheduleTestAlarm`); `src/components/PushScheduleSync.tsx`, `src/components/settings/PushSettings.tsx` (`NativeAlarmSettings`), `src/lib/systemNotification.ts`, `src/lib/registerSW.ts`, `src/pages/Index.tsx`; powłoka: `capacitor.config.ts`, `android/`, `scripts/cap-prepare.mjs`, `.github/workflows/android.yml`; skrypt `npm run build:android`.
- **Jak działa.** `PushScheduleSync` liczy plan jak dotąd (`buildSchedule`) i oddaje go do aktywnego ujścia: `webpush` (wysyłka na serwer) albo `native`. Ujście natywne ładuje się dynamicznie tylko w powłoce, więc paczka startowa PWA nie rośnie. `planNative` porównuje plan z alarmami już zaplanowanymi w systemie (`getPending`) i zwraca tylko różnicę: identyfikator alarmu to skrót FNV-1a klucza pozycji (kolizje rozsuwane w stałej kolejności), a skrót treści leży w `extra.h` — niezmieniony alarm nie jest ruszany. Plan sięga 14 dni; gdy coś wypada w ostatnich 2 dniach, dochodzi alarm-wartownik „otwórz aplikację”. Kanały Androida odpowiadają kategoriom (`notki-<kategoria>`); notatki, grafik i próby są głośne, treść notatek jest ukryta na ekranie blokady. Stuknięcie przycisku w powiadomieniu trafia do tej samej obsługi co komunikaty Service Workera w PWA. Ustawienie: `localStorage` `kaczy.alarms.v1` (`{ enabled, last }`), per urządzenie. W powłoce nie ma Service Workera, a `showSystemNotification` nic nie robi — przypomnienie ma jedno źródło. CSP trafia do `dist/index.html` jako `<meta>` z polityki w `vercel.json`. APK buduje GitHub Actions (ręcznie albo tag `apk-*`); podpis z sekretów `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- **Ograniczenia i pułapki.** Nic nie sprawdzono na telefonie (lista w ADR-8). APK ma osobną bazę od PWA — trzeba dołączyć do grupy synchronizacji jak nowe urządzenie. Bez sekretów powstaje APK próbny, którego nie da się zaktualizować kolejnym przebiegiem. Po 14 dniach bez otwarcia aplikacji dalsze przypomnienia nie przyjdą (uprzedza o tym wartownik). Pobieranie i udostępnianie plików w powłoce (`downloadBlob`, kopia, PDF) nie ma jeszcze gałęzi natywnej. Ikona aplikacji jest domyślna z Capacitora. Kopia systemowa Androida wyłączona (`allowBackup="false"`). Pliki źródłowe są w CRLF — skrypty edytujące muszą to uwzględniać.
- **Testy.** Brak nowych (zlecenia Z-13.1–Z-13.3 w `docs/zlecenia-fable-2026-11-15.md`). Istniejące `src/lib/push/*.test.ts` i `securityHeaders.test.ts` przechodzą bez zmian; `npm run typecheck`, eslint i `npm run build` czyste.
- **Commit.** Niezacommitowane (2026-11-16).

## Telefon — zapis i udostępnianie plików w aplikacji Android (Z-13.4, F1.4, 2026-11-18)

- **Co robi.** W APK każde „Pobierz”/„Zapisz plik” (kopia danych, eksporty, PDF-y, faktury, paczki budowy, kalendarz .ics, obraz miesiąca Grafiku) i każde „Udostępnij” z plikami otwiera systemowy arkusz udostępniania z plikiem; stamtąd „Zapisz w plikach”, Dysk, poczta, komunikator. Wcześniej w WebView pobieranie przez link nic nie robiło, a udostępnianie z plikami spadało do kopiowania tekstu.
- **Gdzie.** `src/lib/native/fileShare.ts` (`nativeShare`, `saveBlob`, `installShareShim`, `safeFileName`, `blobToBase64`); `src/lib/downloadBlob.ts` (gałąź `isNativeShell`); `src/main.tsx` (zamiennik przy starcie). Zależności `@capacitor/filesystem` 8.1.5 i `@capacitor/share` 8.0.3 (wersje dokładne); `android/capacitor.settings.gradle` i `android/app/capacitor.build.gradle` odświeżone przez `npx cap update android`.
- **Jak działa.** Zamiast zmieniać ~25 miejsc wywołań, powłoka zakłada przy starcie `navigator.share`/`canShare` na wtyczce, a `downloadBlob` w powłoce woła `saveBlob`. Plik zapisuje się w pamięci podręcznej aplikacji (`Directory.Cache`, `out/<czas>-<nr>/<nazwa>`, udostępniany przez istniejący FileProvider — `cache-path` w `res/xml/file_paths.xml`), a arkusz dostaje jego adres. Anulowanie arkusza zwraca `AbortError` jak w przeglądarce, więc wywołujący działają bez zmian. Błąd zapisu kończy się komunikatem. Pliki udostępnienia są kasowane 60 s po zamknięciu arkusza (`SHARE_CLEANUP_MS`, także po anulowaniu — aplikacja docelowa czyta adres asynchronicznie), a resztki z poprzednich sesji przy starcie. `url` przechodzi tylko jako http(s), `canShare` działa jak w przeglądarce (coś do udostępnienia musi być). FileProvider (`res/xml/file_paths.xml`) zawężony do `cache/out/` — usunięty szablonowy `external-path` na całą pamięć współdzieloną. Moduł i wtyczki ładują się dynamicznie tylko w powłoce — paczka startowa PWA ma tylko leniwe odwołania (budżety `e2e/bundle.spec.ts` zielone).
- **Ograniczenia i pułapki.** Nie sprawdzone na telefonie (krok właściciela w ADR-8). `showSaveFilePicker` (automatyczna kopia do wybranego pliku) w WebView nie istnieje — zostaje dotychczasowe zachowanie zastępcze. Dyktowanie bez internetu: WebView nie ma Web Speech, a `SpeechRecognition.available()` jest wołane tylko po stuknięciu w Ustawieniach, więc pułapka z wywracaniem karty nie dotyczy startu; wynik to „nieobsługiwane”. Przez minutę po udostępnieniu plik (np. jawna kopia danych) leży w prywatnej pamięci podręcznej aplikacji. Cały plik jest kodowany do base64 w pamięci — bardzo duża kopia może zabraknąć pamięci WebView (zapis porcjami `appendFile` do rozważenia). Przegląd `security-reviewer` 2026-11-18: M1, M2, L1–L3 naprawione.
- **Testy.** `src/lib/native/fileShare.test.ts` (atrapy wtyczek): bezpieczna nazwa pliku, base64 dużego pliku, zapis do pamięci podręcznej i adresy w arkuszu, anulowanie jako `AbortError`, komunikat przy błędzie, odrzucenie `file://`/`content://` w `url`, kasowanie plików po arkuszu, `downloadBlob` w powłoce bez klikania linku.
- **Commit.** Z-13.4, 2026-11-18 — commit po tym wpisie.

## Telefon — przyciski w powiadomieniach i jedno okno aplikacji (plan mobilny M1.1, M1.2, 2026-10-18)

- **Co robi:** powiadomienie o przypomnieniu z serwera push (aplikacja zamknięta) ma te same przyciski co powiadomienie ze strony: „Gotowe” i — dla przypomnień jednorazowych — „Odłóż 10 min”. Gdy żadna karta aplikacji nie jest otwarta, przycisk otwiera aplikację i wykonuje akcję po wczytaniu notatek (toast „Przypomnienie odhaczone” / „Odłożono o 10 minut”). Skrót z ikony, udostępnienie i powiadomienie otwierają istniejące okno aplikacji zamiast nowego.
- **Gdzie jest:** `public/sw-notifications.js` (push: `noteId` z klucza `n:<id>:<termin>`, `actions`; `notificationclick` bez karty → `?akcja=done|snooze10`); `src/lib/notificationAction.ts` (`parsePendingAction`, `withoutActionParam`); `src/components/useReminderNotifications.ts` (wspólne `applyActionRef`, akcja z adresu po pojawieniu się notatki); `src/lib/push/schedule.ts` (pole `snooze` przy notatkach); `push-server/core.js` (`cleanItems` i `payloadOf` przepuszczają `snooze`); `public/manifest.webmanifest` (`launch_handler: navigate-existing`, `background_color` = ciepłe tło ciemnego Zeszytu).
- **Jak działa:** worker nie zmienia dokumentu Yjs, więc przy zamkniętej aplikacji przekazuje akcję w adresie; parametr znika z adresu po wykonaniu, żeby odświeżenie go nie powtórzyło. `navigate-existing` (a nie `focus-existing`) przeładowuje istniejące okno pod adresem skrótu — parametry `?new=1`, `?szukaj=1` i formularz udostępniania (POST `/share`) działają bez dodatkowego kodu.
- **Ograniczenia i pułapki:** na iPhonie powiadomienia nie mają przycisków (stuknięcie otwiera notatkę). Serwer push wymaga ponownego wdrożenia, żeby wysyłał `snooze`; stary serwer wysyła powiadomienia tylko z „Gotowe”. `launch_handler` obsługuje Chrome; Safari go ignoruje.
- **Testy:** `src/lib/notificationAction.test.ts`, `src/lib/push/schedule.test.ts`, `push-server/core.test.js` (test `snooze`), e2e `notification-action.spec.ts`, `push.spec.ts`, `pwa.spec.ts`.
- **Commit:** brak — zmiany niezacommitowane.

## Telefon — notatka głosowa (plan mobilny M1.3, 2026-10-18)

- **Co robi:** w pasku nowej notatki przycisk z falą dźwięku („Nagraj notatkę głosową”), w edytorze notatki „Nagraj” obok „Dodaj plik”. Pasek nagrywania pokazuje czas i limit 3:00 z „Zatrzymaj”; nagranie („Nagranie 2026-10-18 14-05.webm”, na iPhonie `.m4a`) trafia do załączników i ma odtwarzacz na liście. Dyktowanie (mikrofon) zostaje osobno — to tekst, a nagranie to dźwięk.
- **Gdzie jest:** `src/lib/voiceRecorder.ts` (`startVoiceRecording`, `pickAudioType`, `voiceFileName`, `voiceErrorMessage`, limit `VOICE_MAX_MS`; 32 kb/s); `src/lib/voiceSupport.ts` (`canRecordVoice`); `src/components/VoiceAttachmentParts.tsx` (`VoiceRecorder`, `RecordingBar`, `AudioPreview`); `src/components/AttachmentsPanel.tsx` (uchwyt `record()`, flaga `recording`); `src/components/AttachmentsList.tsx` (rodzaj „Nagranie”, odtwarzacz); `src/lib/attachments.ts` (rodzaj `audio`, typy m4a/mp3/ogg/opus/wav); `src/components/AddNoteBar.tsx` (przycisk w pasku).
- **Jak działa:** nagranie jest zwykłym załącznikiem, więc obowiązują limity i synchronizacja załączników: do 2 MB plik jedzie na inne urządzenia (3 min przy 32 kb/s ≈ 0,7 MB). Nagrywanie, pasek i odtwarzacz są w osobnej paczce ładowanej dopiero po „Nagraj” albo przy załączniku audio. Zamknięcie edytora w trakcie kończy nagranie, a plik i tak trafia do notatki.
- **Ograniczenia i pułapki:** decyzja domyślna „tylko na telefonie” nie została zastosowana — nagrania synchronizują się jak inne małe załączniki. We wpisach Dziennika nagrań nie ma (wpis ma zdjęcia, nie załączniki). W trybie deweloperskim (podwójny efekt) anulowana pusta sesja nie pokazuje błędu.
- **Testy:** `src/lib/voiceRecorder.test.ts`; e2e `voice-note.spec.ts` (sztuczny mikrofon Chromium).
- **Commit:** brak — zmiany niezacommitowane.

## Ustawienia — stan aktualny (okno, karty, reset, linki, zgoda na dyktowanie)

Dział opisany w jednym miejscu; obejmuje fazy 1–3 planu z 2026-10-19 i zgodę na dyktowanie z 2026-10-20.

### Co robi

- **Okno Ustawień** ma cztery karty: **Wygląd**, **Ogólne**, **Kopia i dane**, **Sync**. Na telefonie zakładki zawijają się na wiele wierszy.
  - **Wygląd** (plan motywów 3.4) w czterech grupach `SettingsGroup` (`SettingsShared.tsx`, `<section>` z nagłówkiem h3; sekcje w grupie dostają h4 przez kontekst `SectionLevel`): **Styl** (galeria, akcent, kształt, tło, jasność, pora roku), **Tekst** (rozmiar, krój, tryb budowa), **Układ** (działy na pasku, dolny pasek, karty Dziś, układ siatki, sortowanie, gęstość, kolumny, czas czytania, backlinki, „Przywróć domyślne” widoku), **Ruch** (ruch i animacje, `EffectsSettings`). Nad grupami przyklejony pasek skoku `nav` „Części Wyglądu” (`APPEARANCE_GROUPS`, `jumpTo`: przewinięcie i fokus na nagłówku grupy, bez płynnego przewijania przy ograniczonym ruchu). Pułapka: przewijany kontener okna ma `pt-3`, więc pasek ma `-top-3 -mt-3 pt-4.5` i pełne `bg-background` — bez tego nad paskiem prześwituje tekst; cele 44 px na dotyku (`coarse:min-h-11`), grupy mają `scroll-mt-14` / `coarse:scroll-mt-20`. Przyklejony pasek części ma zmienną wysokość (zawija się na telefonie); `ResizeObserver` w `AppearanceSettings` wpisuje ją jako `scroll-padding-top` przewijanej karty, więc fokus z klawiatury i przewinięcie do elementu nie chowają go pod paskiem (WCAG 2.4.11; wcześniej przycisk stylu Zeszyt lądował pod paskiem, `e2e/skins.spec.ts` padał). Klucze localStorage bez zmian.
  - **Ogólne:** edytor (autosave), przypomnienia „Dziś” i „Ten tydzień” (obok przeglądu tygodnia), sekcja „Praca i Grafik” z przyciskiem „Ustawienia Grafiku” (`ShiftSettingsDialog`), sekcja „Dyktowanie głosem”.
  - **Kopia i dane:** kopia zapasowa, przypomnienie o kopii (mierzy czas od ostatniej kopii), automatyczne kopie.
  - **Sync:** parowanie urządzeń, kody, „Zapomnij”, synchronizacja przez plik (`SyncFileSection`).
- **Opis okna** nie obiecuje, że wszystko działa tylko w tej przeglądarce.

**Przegląd P1 (2026-10-21):**
- **Globalny reset** (`AppearanceSettings.tsx`) kasuje też ustawienia kopii (`autoExportDays`, `backupReminderDays`) — opis w potwierdzeniu nie mówi już, że kopia zostaje. Reset jest pełny z potwierdzeniem (decyzja z 19.10).
- **Stan wyboru dla czytnika:** Układ, Gęstość i Liczba kolumn mają `aria-pressed`.
- **Kopia do jednego pliku** (`BackupSettings.tsx`): opis mówi, że każdy kolejny backup, także automatyczny, nadpisuje poprzedni.
- **Zakres kopii** (`exportNotes.ts` → `SETTINGS_KEYS`): dodane `kaczy:review.day`, `kaczy:badge.enabled`, `kaczy.vault.autolock.v1` oraz `kaczy.push.v1`. Przy przywracaniu push zostaje z adresem serwera, ale wyłączony, a `sentHash`/`last` są czyszczone (`pushPrefsForRestore`). Zgoda na dyktowanie (`kaczy.dictation.consent`) i parowanie sync są celowo poza kopią.
- **Destrukcyjny styl** potwierdzeń: „Odłącz to urządzenie”, „Przywróć backup”, reset globalny i reset sekcji używają `buttonVariants({ variant: "destructive" })`.
- **Serwery sync** (`SyncSettings.tsx`): ostrzeżenie w opisie — zmiana tylko na jednym urządzeniu może je odłączyć od grupy.
- Testy: `src/lib/fullBackup.test.ts` (blok „ustawienia w kopii — zakres i push”).

**Przegląd P2 (2026-10-21):**
- **„Ogólne” — kolejność i skoki:** `GeneralSettings.tsx`. Na górze pasek skoków (`JumpNav`, `sticky`) do grup: Powiadomienia, Przypomnienia, Edytor, Praca, Prywatne, Skróty. Kotwice `#ogolne-*` z `scroll-mt-14`. Każdy reset (`ResetSectionButton`) stoi na końcu swojej grupy; lista skrótów na dole.
- **Powiadomienia:** status przeglądarki, Push, odznaka. **Przypomnienia:** przegląd tygodnia, „Dziś”, „Ten tydzień”. Web clipper i dyktowanie przeniesione na dół.
- **Diagnostyka** przeniesiona z „Ogólne” do „Kopia i dane” (`BackupSettings.tsx`, `handleDownloadReport`).
- **„Przywracanie z kopii”:** nagłówek sekcji wokół przycisku przywracania w „Kopia i dane”.
- **Etykiety:** „Autozapis” (było „Autosave”), „Zakładka do zapisu stron w G” (było „Web clipper (zakładka w przeglądarce)”), „Tryb budowa: większy tekst i przyciski” (nazwa radiogrupy „Tryb budowa” zostaje — testy ją używają).
- **Cele dotykowe 44 px** (`coarse:`): godziny i dzień przypomnień, kolumny w Wyglądzie, wybór auto-blokady skarbca.
- **Skarbiec:** status w `role="status"`, żeby czytnik ogłaszał „Zablokuj teraz”.

**Przegląd P3 (2026-10-21):**
- **Odmiana:** `src/lib/plural.ts` → `dniPl` („1 dzień”, „2 dni”) i `godzinPl` (biernik: „1 godzinę”, „22 godziny”, „12 godzin”). Używają ich Kopia (auto-backup, przypomnienie, „N dni temu”) i Ogólne („Dziś”, 24 h+). Testy: `src/lib/plural.test.ts`.
- **Dni tygodnia** w „Ten tydzień” z `REVIEW_DAY_NAMES` (`weeklyReview.ts`), jak w przeglądzie.
- **Nazwa Grafiku** małą literą jak w oknie („Ustawienia grafiku”) — e2e szuka tej nazwy.
- **Sync:** podpowiedź mówi, że 8-znakowy kod już nie działa; nagłówki podsekcji to `h3`.
- **Push:** z opisu zniknęła nazwa folderu `push-server`.
- **Efekty:** przycisk „Test” → „Podgląd”.
- **Wygląd:** globalny reset „Przywróć domyślne” jest nieaktywny, gdy nie ma czego resetować.
- **Kopie:** w tekstach zamiast „Backupy” jest „Kopie” (spójnie z resztą zakładki).
- **Świadomie bez zmian:** etykiety „wyczyść”/„wyłącz” (różne znaczenie), przełącznik „Zgodność ze starszą wersją” jako checkbox (zmiana wyglądu bez zysku), `aria-pressed` w skórkach i krojach (zmiana semantyki wymaga osobnego przeglądu).

**QOL — top 5 (2026-10-21):**
- **Cofnij przy nadpisaniu w Grafiku** (`ShiftsView.tsx`, `toastReplaced`): malowanie zmianą innego rodzaju (albo zmianą godzin) pokazuje toast „Cofnij” z poprzednim wpisem (`restoreDays`). Test: `e2e/shifts-undo.spec.ts`.
- **Ctrl+Z w Grafiku** (`yShifts.ts`, `undoManager`; `store.ts`, `undoShifts`/`canUndoShifts`; `Index.tsx`, `onUndo`): `Y.UndoManager` na mapie dni, tylko zmiany z `SHIFTS_ORIGIN`. Sync z innego urządzenia, import, przywracanie i migracje idą z `SHIFTS_SYSTEM_ORIGIN` i nie trafiają na stos. Poza widokiem Grafiku Ctrl+Z działa jak dotąd. Testy: `src/lib/shifts/undo.test.ts`.
- **Kopia sprzed przywrócenia** (`BackupSettings.tsx`, `RestoreBackup.restore`): przed każdym przywróceniem pobiera się `hydra-przed-przywroceniem-RRRR-MM-DD.json` (dawniej `kaczy-…`; przywracanie czyta obie nazwy). Gdy zapis się nie uda, przywracanie się zatrzymuje. Przywrócenie tego pliku cofa przywracanie.
- **Ostatnio użyte w palecie** (`CommandPalette.tsx`, `NAV_ITEMS`; `src/lib/recentCommands.ts`): grupa Nawigacja jest tablicą danych; ostatnie 3 użyte widoki pokazują się przy pustym polu wyszukiwania. Testy: `src/lib/recentCommands.test.ts`.
- **Budżet paczki startowej:** po Ctrl+Z w Grafiku 400,33 KB; próg podniesiony do 401 KB (decyzja użytkownika), `e2e/bundle.spec.ts` przechodzi.

**Wygląd telefonu (2026-10-21):**
- **Siatka miesiąca** (`ShiftMonthGrid.tsx`): nagłówki i komórki dni są w tej samej siatce `grid-cols-7` — pomiar na 390 px potwierdził równe kolumny. Test regresyjny: `e2e/shifts-grid.spec.ts`.
- **Zakładki Ustawień** (`SettingsDialog.tsx`): na telefonie `max-sm:text-xs`, „Kopia i dane” w jednej linii.
- **Style** (`SkinPicker.tsx`): nieparzysta liczba stylów — ostatni kafel na telefonie zajmuje cały wiersz, z niższą miniaturą (`max-sm:aspect-[16/6]`).
- **Kroje** (`FontPicker.tsx`): dwie kolumny od 340 px (wcześniej od 400 px).
- **Reset „Przywróć domyślne” w Wyglądzie** kasuje cały widok (decyzja właściciela: „Wszystko”). Potwierdzenie to lista tego, co wróci do domyślnych, i tego, czego reset nie dotyczy. Lista zmian liczona jest z aktualnego stanu przy każdym renderze.
- **Reset w sekcji.** W Ogólne (edytor, przypomnienia) i w Kopii i danych jest przycisk „Przywróć domyślne w tej sekcji”. Wyłącza się, gdy nic w sekcji nie różni się od domyślnych; potwierdzenie wymienia tylko ustawienia, które faktycznie się zmienią (np. „Zmienią się: autosave”).
- **Link do karty** `?settings=wyglad|ogolne|kopia|sync` otwiera Ustawienia na tej karcie i znika z adresu. Nieznana wartość nie otwiera okna. Działa przy otwieraniu aplikacji i przy zmianie adresu w otwartym oknie; nie zmienia otwartej aplikacji, jeśli adres zmieni się bez przeładowania.
- **Zgoda na dyktowanie głosem** (Ogólne → „Dyktowanie głosem”): pokazuje stan zgody i przycisk „Cofnij zgodę”. Po cofnięciu następne dyktowanie znowu pyta o zgodę. Nie rusza uprawnienia mikrofonu w przeglądarce.
- **Dostępność.** Przełączniki mają nazwy dla czytników ekranu (`ToggleRow` łączy etykietę z przełącznikiem przez `useId` i `aria-labelledby`); kolory mają polskie `aria-label` (`COLOR_LABEL`) i `aria-pressed`; suwak autosave i suwaki kopii mają nazwy; pola godziny i dnia też.
- **Cele dotyku 44 px** na dotyku dla przełączników, zakładek, suwaka i przycisków „Test”, „wyczyść”, „wyłącz”. Przełącznik powiększa pseudo-element tylko na dotyku; wygląd się nie zmienił.

### Gdzie jest

- `src/components/SettingsDialog.tsx` — okno, karty, opis, szkielet przy ładowaniu karty Sync, efekt czytający `?settings=` (obok `?pair=`). Prop `open` / `onOpenChange` wymagany; niekontrolowana gałąź `trigger` usunięta.
- `src/components/settings/AppearanceSettings.tsx` — globalny reset (`resetOpen`, `AlertDialog`) z listą zmian; renderuje `EffectsSettings` przed resetem.
- `src/components/settings/EffectsSettings.tsx` — sekcja „Efekty i zabawa” i `previewEffect`.
- `src/components/settings/GeneralSettings.tsx` — przypomnienia po `<ReviewSettings />`, `WorkSettingsLink`, `DictationConsentRow`, przyciski resetu „edytor” i „przypomnienia”.
- `src/components/settings/BackupSettings.tsx` — kopia i jej przypomnienie, przycisk resetu „kopia”; używa `LAST_AUTO_EXPORT_KEY`.
- `src/components/settings/SyncFileSection.tsx` — „Synchronizacja przez plik” (`exportSyncNow`, `mergeSyncNow`, `newNotesLabel`).
- `src/components/SyncSettings.tsx` — „Zapomnij” z `AlertDialog` (`forgetOpen`); nazwy przełącznika synchronizacji i przycisku kopiowania kodu.
- `src/components/settings/SettingsShared.tsx` — `ToggleRow`, `ResetSectionButton({ title, keys })`, tytuł sekcji jako `h3`.
- `src/lib/viewPrefs.ts` — `VIEW_PREF_GROUPS` (rozłączne grupy kluczy), `VIEW_PREF_LABELS` (nazwy po polsku), `changedViewPrefs(keys)`, `resetViewPrefKeys(keys)`; domyślny `weekReminderDay` = 0 (niedziela).
- `src/lib/settingsDeepLink.ts` — `SETTINGS_PARAM`, `SETTINGS_TABS` (polskie nazwy → karty), `settingsTabFromParam`. `src/pages/Index.tsx` ustawia stan początkowy `settingsOpen` dla poprawnego parametru.
- `src/lib/effectsSettings.ts`, `src/lib/confirmPrefs.ts`, `src/lib/viewPrefs.ts` — `merge` wraca do domyślnych, gdy zapis nie jest obiektem.
- `src/lib/backupReminder.ts` — `LAST_AUTO_EXPORT_KEY` (jedna stała dla klucza ostatniej kopii).
- `src/components/ui/switch.tsx`, `tabs.tsx`, `slider.tsx` — cele dotyku; `Slider` przekazuje `aria-label` do kciuka.
- `src/hooks/useDictation.ts` — `hasDictationConsent()`, `withdrawDictationConsent()` (używane też w `toggle`).

### Jak działa i dlaczego

- **Uszkodzony zapis.** `persistedStore` przy błędnym JSON przekazuje surowy tekst do `merge`. Wcześniej `{...defaults, ...stored}` rozsypywało znaki tekstu w klucze „0”, „1”… w stanie. Teraz wracają wartości domyślne w całości.
- **Reset pełny w Wyglądzie, cząstkowy w sekcjach.** Grupy są rozłączne, więc każdy klucz ma dokładnie jeden reset per sekcja. Wygląd nie ma resetu per sekcja, bo globalny już wymienia zmiany. Sortowanie i filtry są tylko w globalnym resecie, bo ustawia je arkusz widoku.
- **Przypomnienia „Dziś”/„Ten tydzień”** są w Ogólne, bo to ustawienia powiadomień, nie kopii. Przypomnienie o kopii zostaje w Kopii, bo mierzy czas od ostatniej kopii.
- **Synchronizacja przez plik** jest w Sync, bo to też synchronizacja między urządzeniami.
- **Efekty w Wyglądzie** zamiast piątej karty: pięć kart na telefonie nie mieści się w jednym wierszu.
- **Domyślny dzień przeglądu tygodnia** to niedziela. Zmienia tylko nowe ustawienia; zapisane dni zostają.
- **Nazwy w linkach** są po polsku, bez znaków spoza ASCII, żeby dały się wkleić w wiadomości.
- **Zgoda na dyktowanie** to osobny stan, wycofywany z Ustawień; mikrofon w przeglądarce zarządza przeglądarka.

### Ograniczenia i pułapki

- Reset per sekcja nie obejmuje ustawień spoza `viewPrefs` (efekty, potwierdzenia, sejf, push, skórka).
- Istniejące kopie i zapisane ustawienia się nie zmieniają; zmienia się tylko domyślny dzień przeglądu, gdy użytkownik nigdy nie ustawił godziny.
- Nazwy kolorów są po polsku w kodzie (`COLOR_LABEL`); nowy kolor wymaga wpisu.
- Zakładka „Kopia i dane” może się zawijać na wąskim ekranie — QA na telefonie nie zrobiono.
- **Wyszukiwanie ustawień nie jest zrobione** (decyzja właściciela — odrzucone).
- Porządki: usunięto nieużywane eksporty `getEffectsSettings`, `getSeasonPref`, `getBadgeEnabled`, `getAutoLockMinutes`. Klucz `kaczy.lastAutoExport` jest jedną stałą.

### Testy

- `src/lib/settingsPrefs.test.ts` — uszkodzony JSON i tekst zamiast obiektu, częściowy zapis, reset, `confirmPrefs`, `normalizePushServer`, `changedViewPrefs`, `resetViewPrefKeys` (tylko podane klucze), rozłączność grup i etykiety, domyślny dzień tygodnia.
- `src/lib/settingsDeepLink.test.ts` — mapowanie nazw, nieznane i puste wartości, nazwy z prototypu.
- `src/hooks/useDictation.consent.test.ts` (2) — zgoda i jej cofnięcie.
- E2E: `e2e/settings-links.spec.ts` (link otwiera kartę i czyści adres; nieznana karta nie otwiera okna; reset w sekcji zmienia tylko edytor), `mobile.spec.ts` (karta „Kopia i dane”), `file-sync`, `live-text`, `live-text-focused`, `images` (karta Sync), `skins`, `clipper`, `push`, `diagnostics`, `sync-code`, `search-backup`, `private-notes`, `a11y`, `toggle-group`, `site-mode`, `card-motion`. Pełne e2e z 2026-10-19 było zielone (386/386) przed fazą 3 i zmianami z 2026-10-20 — nieuruchomione od tamtego czasu.

### Commity

- `cb2ecff` (2026-10-19) — faza 1: potwierdzenia resetu i zapomnienia, dostępność.
- `430379d` (2026-10-19) — faza 2: struktura kart, „Kopia i dane”.
- `842db18` (2026-10-19 / 2026-10-20) — faza 3: reset per sekcja i linki `?settings=`.
- `c2eeb7f` (2026-10-20) — zgoda na dyktowanie i porządki.
- `ed7d2ce` — hash w `opis.md`.

## Pasek boczny — „Trening mózgu” (2026-10-22)

Pozycja w stopce paska bocznego (`src/components/AppSidebar.tsx`, nad „Narzędzia”), otwiera https://neuroklik.vercel.app/ w nowej karcie. Adres w małym module `src/lib/neuroklik.ts` (pasek boczny jest w paczce startowej, więc nie ciągnie tam logiki zmian). Ta sama strona jest na karcie Dziś (`BrainTrainingCard`).

Budżet paczki startowej: po tej zmianie 411 696 B (próg 410 624 B). Przekroczenie rośnie razem z falą 3 (fokus i rola okna na pasku bocznym na telefonie, aria w notatkach).

## Pasek boczny — grupy i nazwa „Terminy” (PW-1, PW-4, 2026-10-26)

- **Co robi:** działy na pasku są w grupach: „Codziennie” (Notatki, Skrzynka, Dziś, Terminy, Kalendarz), „Praca” (Grafik, Praca, Plany), „Osobiste” (Długi, Ćwiczenia), a na dole Archiwum i Kosz bez nagłówka. Nagłówek grupy zwija i rozwija listę (`aria-expanded`); stan zapamiętany w `localStorage` pod `kaczy.sidebarGroups.v1`.
- **Domyślnie zwinięte „Osobiste”** (plan wyglądu, Faza 7, 2026-11-02): bez zapisanego stanu (i przy błędzie dostępu do pamięci) `readCollapsedGroups` zwraca `DEFAULT_COLLAPSED_GROUPS = { osobiste: true }` — pasek mieści się na 900 px bez przewijania. Kto już zwijał grupy, ma swój zapis i nic się nie zmienia. Grupa z otwartym działem (np. jesteś w `/dlugi`) jest zawsze rozwinięta; kliknięcie nagłówka zapisuje stan przeciwny do widocznego (`setGroupCollapsed`), więc nie trzeba klikać dwa razy.
- **Nazwa:** dział przypomnień nazywa się wszędzie „Terminy” (PW-1): pasek, paleta, skrót `g` + `p`, nagłówek widoku. Adres `/przypomnienia` bez zmian. Nagłówek „Przypomnienia” w ustawieniach powiadomień i „Przypomnienia notatek” w Push zostają, bo dotyczą powiadomień, nie działu.
- **Gdzie:** `src/components/sidebar/sidebarItems.ts` (pole `group`, `groupSidebarItems`), `src/components/AppSidebar.tsx` (render grup, `readCollapsedGroups`), `src/lib/goChord.ts`, `src/components/AppHeader.tsx`, `src/components/CommandPalette.tsx`.
- **Testy:** `src/components/sidebar/sidebarItems.test.ts`; e2e `desktop-columns.spec.ts` (zwijanie i zapamiętanie), `reminders-*.spec.ts`, `routes.spec.ts`.

## Ukrywanie działów (PW-3, 2026-10-26)

- **Co robi:** w Ustawieniach → Wygląd, sekcja „Działy na pasku”, przełączniki: Skrzynka, Terminy, Kalendarz, Grafik, Praca, Długi, Ćwiczenia. Ukryty dział znika z paska bocznego, z „Więcej” na telefonie i z palety poleceń. Notatki, Dziś, Archiwum i Kosz są zawsze widoczne. Dane zostają, a adres (`/dlugi` itd.) działa dalej.
- **Gdzie:** `src/lib/hiddenViews.ts` (`HIDEABLE_VIEWS`, `hiddenViewsStore` pod kluczem `kaczy.hiddenViews.v1`, `setViewHidden`, `isViewShown`); filtr w `src/pages/Index.tsx` (`navItems`), `src/components/CommandPalette.tsx` (lista nawigacji i ostatnie), `src/components/BottomNav.tsx` (arkusz „Więcej”), przełączniki w `src/components/settings/AppearanceSettings.tsx`.
- **Jak działa:** odczyt odrzuca nieznane wartości i działy stałe, więc uszkodzony zapis nie ukrywa niczego. Ukrycie nie zmienia danych ani tras.
- **Ograniczenie:** „Przywróć domyślne” w Wyglądzie nie zeruje ukrytych działów (to osobna lista). Ustawienie nie jest w kopii zapasowej.
- **Testy:** `src/lib/hiddenViews.test.ts`; e2e `e2e/hidden-views.spec.ts`.

## Co nowego (U-4, 2026-10-26)

- **Co robi:** po zmianie wersji aplikacji jednorazowy dymek „Co nowego w wersji …” z najwyżej 5 punktami. Pierwsze uruchomienie tylko zapamiętuje wersję, bez dymka.
- **Źródło:** `src/content/changelog.ts` (ręcznie pisane zdania; `APP_VERSION` i wpisy). Ostatnio widziana wersja w `kaczy.lastSeenVersion.v1` (per urządzenie).
- **Gdzie:** `src/hooks/useWhatsNew.ts` (wołany z `Index.tsx`), `src/lib/whatsNew.ts` (decyzja `whatsNewDecision`).
- **Nie zrobione z U-4:** pełna lista zmian w „O aplikacji” (plan 4.2) — dymek pokazuje tylko najnowsze.
- **Testy:** `src/lib/whatsNew.test.ts`; e2e `e2e/whats-new.spec.ts`.

## Ustawienia — skaner kodu grupy (U-2, 2026-10-26)

- **Co robi:** w „Dołącz do istniejącej grupy” jest „Zeskanuj kod”. Okno skanera: na Androidzie z `BarcodeDetector` podgląd kamery tylnej, a zawsze „Wybierz zdjęcie kodu”. Odczytany kod (sam kod albo link `?pair=…`) trafia do pola, a użytkownik klika „Dołącz”. Zdjęcie bez kodu daje komunikat, a nie wpisuje śmieci.
- **Biblioteka zapasowa:** `jsqr@1.4.0` (dokładna wersja, Apache-2.0), ładowana dopiero przy wyborze zdjęcia, gdy nie ma `BarcodeDetector` (np. iPhone). Osobny chunk, poza paczką startową.
- **Gdzie:** `src/lib/qrScan.ts` (`codeFromScan`, `decodeQrImage`, `barcodeDetectorCtor`); `src/components/sync/QrScanDialog.tsx`; `src/components/SyncSettings.tsx` (przycisk, stan, leniwe okno). `CODE_ALPHABET` w `yjsSync.ts` wyeksportowany.
- **Ograniczenia:** podgląd kamery działa tylko tam, gdzie jest `BarcodeDetector`; na iPhonie jest wybór zdjęcia. Nie testowano na prawdziwym telefonie. Nowa zależność: wymagany przegląd wydajności (CLAUDE.md) — nie zrobiony.
- **Testy:** `src/lib/qrScan.test.ts`; e2e `e2e/sync-qr-scan.spec.ts` (okno i zdjęcie bez kodu). Pozostałe e2e synchronizacji i push zielone.

## Ustawienia — zgodność ze starszą wersją wygasa (U-3, 2026-10-26)

- **Co robi:** gdy przełącznik „Zgodność ze starszą wersją aplikacji” jest włączony i przez 30 dni żadne urządzenie nie pojawiło się w starym pokoju, wyłącza się sam. Przy otwarciu Ustawień → Synchronizacja pokazuje się komunikat „Zgodność ze starszą wersją wyłączona”. Włączenie przed tą zmianą zaczyna licznik od teraz.
- **Jak liczy:** start licznika zapisuje się przy włączeniu, a czas ostatniego urządzenia w starym pokoju przy każdym sygnale z pokoju nr 1 (`yjsSync.ts`, zdarzenie `peers`). Dane: `kaczy.legacyRoomIdle.v1` (per urządzenie).
- **Gdzie:** `src/lib/legacyRoomIdle.ts` (licznik, `legacyIdleExpired`); `src/lib/yjsSync.ts` (`setLegacyRoom`, `expireLegacyRoomIfIdle`, zapis pojawienia się); `src/components/SyncSettings.tsx` (sprawdzenie przy otwarciu).
- **Do zrobienia w kodzie później (plan 2.6):** usunięcie samej obsługi starego pokoju, gdy wszystkie urządzenia mają nowszą wersję.
- **Testy:** `src/lib/legacyRoomIdle.test.ts`; e2e `e2e/legacy-room-idle.spec.ts`.

## Powłoka — czwarta pozycja dolnego paska (2.3) i kropka synchronizacji (2.4), 2026-10-26

- **2.3 Czwarta pozycja:** prawa pozycja dolnego paska (obok „+”) pokazuje wybrany dział: Terminy (domyślnie), Grafik, Praca, Kalendarz lub Skrzynka. Wybór w Ustawieniach → Wygląd, „Dolny pasek” (`Segmented`). Zapis per urządzenie (`kaczy.bottomSlot.v1`, `src/lib/bottomSlot.ts`). `BottomNav.tsx` czyta go przez `SLOT_META`. Nieznana wartość wraca do Terminów. Nie zrobione: wybór przez przytrzymanie pozycji na pasku (plan dopuszcza „w Dostosuj”).
- **2.4 Kropka stanu:** w nagłówku, tylko gdy urządzenie jest w grupie (stan różny od `disabled`). Zielona — połączono; szara — łączenie; żółta — offline (`navigator.onLine`), zmiany czekają; czerwona — błąd (`lastError`). Stuknięcie otwiera Ustawienia na karcie Synchronizacja: `requestSettingsTab("sync")` zapisuje prośbę, a `SettingsDialog` odczytuje ją przy montowaniu (`src/lib/settingsDeepLink.ts`). Komponent: `src/components/sync/SyncStatusDot.tsx`, wstawiony w `AppHeader.tsx`.
- **Nie zrobione z 2.4:** baner „starsza wersja” (plan Ustawień 2.1) i żółty stan oparty o kolejkę zmian (dziś tylko offline).
- **Testy:** `src/lib/bottomSlot.test.ts`; e2e `e2e/bottom-slot.spec.ts`, `e2e/sync-status-dot.spec.ts`.

## Skrzynka na znaczku aplikacji (5.3) i widżet z linią zmiany (4.5), 2026-11-02

- **Co robi.**
  - **5.3:** w Ustawieniach → Ogólne → Powiadomienia przełącznik „Skrzynka na znaczku aplikacji” (domyślnie wyłączony). Gdy włączony, znaczek ikony aplikacji pokazuje zaległe i nieposortowane notatki Skrzynki. Tytuł karty nadal liczy tylko zaległe.
  - **4.5:** widżet `/widzet` („Na dziś”) pokazuje nad listą jedną linię dzisiejszej zmiany z Grafiku, np. „R 06:00–14:00 · za 2 godz.”. Bez zmiany: „Dziś nie ma zmiany”.
- **Gdzie.** `src/lib/overdueBadge.ts` (`inboxStore`, `appBadgeCount`), `src/hooks/useOverdueBadge.ts` (trzeci argument `inbox`), `src/pages/Index.tsx` (`inboxBadge`), `src/components/settings/GeneralSettings.tsx`; `src/components/WidgetPanel.tsx` i nowy `src/components/WidgetShiftLine.tsx` (ładowany leniwie).
- **Testy.** `src/lib/overdueBadge.test.ts`, `src/components/WidgetShiftLine.test.tsx`. Jednostkowe przechodzą; pełny zestaw e2e i zrzuty nie były jeszcze puszczane po tej zmianie.
- **Commit.** `e41fd4b` (2026-11-02).

## Ustawienia — naprawy, wyszukiwarka z historią i opisami, więcej zestawów wyglądu (2026-11-02)

Prośba właściciela: „W ustawieniach napraw i dopracuj, rozbuduj szukaj notatek i szybko zestawy”. Usterki znalezione na zrzutach okna Ustawień (390 i 1440 px) i wyszukiwarki.

- **Naprawy w Ustawieniach.**
  - **Prześwit pod nagłówkiem:** po przewinięciu tekst wchodził w szczelinę między paskiem kart a paskiem sekcji (np. „Przejdź do trybu Dziś” w Ogólnych). Przyczyna: kontener przewijania miał górny `padding` (`pt-3`), a przyklejony pasek stawał pod nim. Odstęp jest teraz nad kontenerem (`mb-3` listy kart w `SettingsDialog.tsx`), paski sekcji stoją na `top-0` (Wygląd przestał kompensować `-top-3 -mt-3`).
  - **Przewinięcie przy zmianie karty:** zostawało z poprzedniej karty („Ogólne” otwierało się przy Skrótach). `chooseTab` przewija kontener na górę.
  - **Sync na komputerze:** pola kodu i „Zeskanuj kod” wychodziły poza kartę, a „Dołącz” nie było widać — formularz zawija się (`sm:flex-wrap`).
  - **Rozwijane sekcje** („Serwery łączące urządzenia”, „Przekaźnik”, „Jak to działa” w skarbcu): strzałka aplikacji obracana przy otwarciu (`details.disclosure` w `index.css`) zamiast trójkąta przeglądarki.
  - **Teksty:** „gdy G są zamknięte” → „gdy aplikacja jest zamknięta”, „(3) G” → „(3) NOTKI”, dymek instalacji „NOTKI są teraz na ekranie głównym”; pod przełącznikami kategorii push „Po wyłączeniu terminy tej kategorii nie trafiają na serwer” (dawne „Wyłączone: …” pod włączonym przełącznikiem wyglądało jak stan).
- **Wyszukiwarka notatek** (`SearchBar.tsx`, `lib/searchSuggest.ts`).
  - Jeden „×”: natywny przycisk czyszczenia `type="search"` jest ukryty (dawniej dwa krzyżyki obok siebie).
  - Puste pole w fokusie: **ostatnie wyszukiwania** (wspólne z paletą poleceń — `lib/recentSearches.ts`, klucz `kaczy.recentSearches.v1`, zapis przy wyjściu z pola), **szybkie filtry** (`ma:przypomnienie`, `przypięte`, `lista:otwarte`, `nowsze:7d`) i „Wyczyść ostatnie wyszukiwania” (`emptySuggestions`).
  - Każdy operator ma **opis** po polsku („ma:obraz — ze zdjęciem lub obrazem”), nazwy etykiet i folderów — „etykieta” / „folder”.
  - Po dwukropku innego operatora („ma:”, „brak:”) lista pokazuje pasujące operatory — dawniej była pusta.
- **Szybkie zestawy wyglądu** (`lib/appearancePresets.ts`, `QuickPresets.tsx`, ikony w `settings/presetIcons.ts`; sekcja „Zestawy” w Ustawieniach usunięta 2026-11-03).
  - Nowe zestawy: **Czytanie** (tekst 112,5%, ciche tło, zwykłe ramki, bez poświaty i ruchu) i **Oszczędny** (ciemny Zeszyt z czarnym tłem OLED, gładkie tło, bez ruchu i poświaty).
  - **Duże cele** (Q5.4, `22550d6c`, 2026-11-25): tryb budowa (pole dotyku 56 px dla `.tap-target`, tekst 112,5%, mocniejsze krawędzie) i wyraźne ramki, bez zmiany stylu, tła i ruchu — w odróżnieniu od „Budowy”. Zamiast większego `Button` dla wszystkich (cofniętego 15.11) większe cele są tylko po włączeniu. Ikona `Hand` (`presetIcons.ts`). Test: `src/lib/appearancePresets.test.ts`.
  - Zestawy mają ikony, a **włączony** zestaw jest oznaczony (ptaszek w okienku szybkich zestawów; `isPresetActive` porównuje wartości po sparsowanym JSON).
  - Własne „Mój 1–3” pokazują, co zapisano („Zorza, ciemny · tekst 125% · bez ruchu”, `slotSummary`).
- **Pułapki przy tej zmianie.** `src/lib/recentSearches.ts` już istniał (historia palety) — omyłkowo nadpisany i przywrócony z gita; wyszukiwarka używa jego API. Pliki z mieszanymi końcami linii (CRLF/LF) — skrypty zmian normalizują do LF.
- **Testy.** `src/lib/searchSuggest.test.ts` (puste pole, opisy, operatory po dwukropku), `src/lib/appearancePresets.test.ts` (włączony zestaw, nowe zestawy, opis slotu).
- **Commit.** `e771952` (2026-11-02).

## Powłoka — logo bez pętli, „Szukaj” z arkusza, boczne wycięcie ekranu (1.1, 1.5, 1.6, 2026-11-02)

- **Co robi.**
  - **1.1 (WCAG 2.2.2):** monogram w nagłówku i pasku bocznym rysuje się raz przy pojawieniu (kropka przebiega obrys i gaśnie), potem stoi; najechanie kursorem powtarza przebieg. Dawniej pętla 4,8 s bez końca. Przy ograniczonym ruchu litera stoi od razu (także `data-motion="reduced"`).
  - **1.5:** „Szukaj” w arkuszu „Więcej” ustawia kursor w polu po zamknięciu arkusza (`onCloseAutoFocus`), a nie po `setTimeout(400)` — Radix nie odbiera już fokusu polu.
  - **1.6:** przy `viewport-fit=cover` telefon w poziomie z wycięciem: `body` ma boczne `env(safe-area-inset-*)`, dolny pasek i pasek boczny na telefonie mają własne odsunięcie. W pionie bez zmian.
- **Gdzie.** `.n-mark*` w `src/index.css` (osobne klatki `n-mark-draw-again` / `n-mark-dot-again` do powtórki), klasa `n-mark` w `NMonogramLogo.tsx`; `searchAfterClose` w `BottomNav.tsx`; `body` w `index.css`, klasy w `BottomNav.tsx` i `AppSidebar.tsx`.
- **Stan planu Powłoki.** 1.7 (kolor paska przy starcie) robi już `public/prepaint.js`; 1.3, 2.1 zrobione wcześniej (VIEW_META, PW-1/PW-4). W `index.css` zostają inne pętle (fala hasła, puls „teraz”, połysk paska) — poza 1.1.
- **Testy.** `src/test/logoMotion.test.ts` (brak `infinite` w `.n-mark*`), `e2e/mobile.spec.ts` („Więcej → Szukaj” ustawia kursor).
- **Commit.** `dc80318` (2026-11-02).

## Ustawienia — wersja i format na innych urządzeniach (2.1, 2026-10-26)

- **Co robi:** każde urządzenie w grupie ogłasza w awareness `device: { name, version, schema }` (`version` = wersja aplikacji z `changelog.ts`, `schema` = numer formatu danych). Lista „Urządzenia w grupie” w Ustawieniach → Synchronizacja pokazuje wersję przy każdym urządzeniu. Gdy któreś ma niższy `schema` niż ten w aplikacji albo nie ogłasza go wcale (wersja sprzed tej zmiany), pojawia się baner: „… ma starszą wersję aplikacji — część danych może być na nim niewidoczna. Zaktualizuj go.”
- **Bramka zapisu nowego formatu:** `canWriteSchema(required, devices)` w `src/lib/formatSchema.ts` — nowy format zapisuje się tylko, gdy wszystkie widziane urządzenia mają `schema ≥ required`. Na razie żaden zapis z niej nie korzysta; V-3 (przełączenie zapisu na v2) ma ją użyć.
- **Gdzie:** `src/lib/formatSchema.ts` (`SCHEMA_VERSION = 1`, `canWriteSchema`, `olderDevices`, `localDeviceSchema`); `src/lib/yjsSync.ts` (awareness, `SyncDevice.version/schema`, `refreshDevices`); `src/components/SyncSettings.tsx` (baner i wersja).
- **Nie zrobione z 2.1:** baner pokazany tylko w Ustawieniach → Synchronizacja, nie na całej aplikacji (plan mówił „baner w aplikacji”).
- **Testy:** `src/lib/formatSchema.test.ts`.

## Fala 4 mobile (2026-10-28) — E4, B5, E3, A3

### Nauka: import pytań z .md (E4 / P4.5)
- **Co robi:** w „Moje pytania” przycisk „Importuj z pliku .md” czyta pliki z pytaniami i dodaje poprawne do wybranego tematu. Błędne wiersze są pomijane i raportowane z numerem wiersza.
- **Format:** `P:` pytanie, `A:` poprawna odpowiedź, `N:` odpowiedź błędna (dokładnie trzy), `X:` wyjaśnienie (opcjonalnie). Nowy `P:` zaczyna kolejne pytanie.
- **Gdzie:** `src/lib/study/questionsMd.ts` (`parseQuestionsMd`), `src/components/study/CustomQuestionsDialog.tsx` (`importQuestionsMd`). Zapis przez `addCustomQuestion`, więc obowiązują te same zasady co przy ręcznym dodawaniu.
- **Testy:** `src/lib/study/questionsMd.test.ts` (5 testów: poprawny plik, CRLF, błędy z numerami wierszy, duplikaty odpowiedzi, wiersz przed pierwszym `P:`).

### Grafik: pasek wypłaty (G4.4 / B5)
- **Co robi:** w podsumowaniu miesiąca pole „Wypłacono brutto (zł)”. Pokazuje różnicę od szacunku i podpowiedzi, czego zwykle brakuje (nocne, urlop i L4, premie).
- **Jak działa:** kwota leży w mapie `meta` jako `paidGross:YYYY-MM` (synchronizowana przez Yjs; 0 usuwa wpis). `cleanPaidGross` w `model.ts` oczyszcza ją tak samo jak przy `migrate`. Logika różnicy: `src/lib/shifts/payslip.ts` (`comparePayslip`, tolerancja 1 zł).
- **Gdzie:** `src/components/shifts/ShiftSummary.tsx` (`PaySlipPanel`), `src/lib/shifts/yShifts.ts` (`setPaidGross`, `readPaidGross`), `src/lib/shifts/store.ts` (`setPaidGross`).
- **Testy:** `payslip.test.ts` (różnica, tolerancja, szacunek 0, czyszczenie), `yShifts.test.ts` („Wypłaty brutto w Yjs”: przejście między dwoma dokumentami).

### Grafik: import zmian z pliku .ics i .csv (G4.5 / E3)
- **Co robi:** w „Ustawienia grafiku” sekcja „Import zmian z pliku”. Przyjmuje **.ics** (każde zdarzenie to dzień z wybranym rodzajem zmiany) i **.csv** z karty czasu (rodzaj z kolumny „Zmiana”, odchylenie i notatka z tych samych kolumn). Najpierw podgląd: liczba dni i rozwijana lista „Podgląd dzień po dniu” z rodzajem i oznaczeniem pominiętych dni. Dopiero potem „Importuj”. „Cofnij” w tostcie przywraca dni sprzed importu.
- **Reguły:** dzień z już wpisaną zmianą i drugie zdarzenie tego samego dnia są pomijane (pokazane w podglądzie jako pominięte). Zdarzenia z przeszłości są importowane (`parseIcs(…, { keepPast: true })`). Cykliczne zdarzenia (RRULE) rozwijają się do wystąpień: DAILY, WEEKLY i MONTHLY z `INTERVAL`, `COUNT` i `UNTIL`. Miesiąc bez tego dnia (31 lutego) jest pomijany. Bez `COUNT` i `UNTIL` rozwijamy najwyżej 366 dni od dziś i 400 wystąpień. Dla CSV rodzaje muszą mieć nazwę dokładnie taką jak w eksporcie; nieznana nazwa to nieczytelny wiersz.
- **Dlaczego tak:** import CSV to odwrotność `buildTimesheetCsv`, więc plik z eksportu wraca do Grafiku bez ręcznego poprawiania. Limit 366 dni chroni przed zalaniem grafiku przy zdarzeniu bez końca; reszta zdarzeń rozwija się normalnie.
- **Gdzie:** `src/lib/shifts/icsShifts.ts` (`occurrenceKeys`, `finishPlan`, `planShiftsFromIcs`, `previewDayLabel`), `src/lib/shifts/csvShifts.ts` (`parseSemicolonCsv`, `planShiftsFromCsv`), `src/lib/icsImport.ts` (`IcsEvent.rrule`, opcja `keepPast`), `src/lib/shifts/store.ts` (`applyShiftImport`, przywracanie przez `restoreDays`), `src/components/shifts/ShiftsIcsImport.tsx`.
- **Testy:** `src/lib/shifts/icsShifts.test.ts` (rozwijanie RRULE, podgląd, zdarzenia bez daty), `src/lib/shifts/csvShifts.test.ts` (odwrotność eksportu, pominięte zajęte dni, nieznana nazwa, plik bez nagłówka), e2e `e2e/shifts-import.spec.ts` (CSV z podglądem i Cofnij; ICS z COUNT).
- **Nie zrobione:** brak importu odchyleń z kolumn „Od/Do” (godziny wynikają z rodzaju i odchylenia); brak wyboru rodzaju dla CSV (świadomie, rodzaj jest w pliku).

### Notatki: zakładki Edycja / Podgląd na telefonie (A3 / plan 1.1)
- **Co robi:** po włączeniu podglądu na telefonie (poniżej `sm`) edycja i podgląd są zakładkami, a nie dwiema kolumnami. Od `sm` wracają obok siebie.
- **Gdzie:** `src/components/NoteEditor.tsx` (`phoneTab`, zakładki `role="tab"`, klasy `max-sm:hidden`).
- **Testy:** brak nowego testu jednostkowego. Typy i lint czyste; sprawdzenie w przeglądarce na telefonie nie zrobione.

### Tryb skupienia: zegar i pierścień (A3 / plan 4.5)
- **Co robi:** zegar liczy z `performance.now()`, więc w tle nie dryfuje. Pasek postępu zastąpiony cienkim pierścieniem SVG. Cyfry nie animują się co sekundę (wcześniej klucz animacji powodował „pulsowanie”).
- **Gdzie:** `src/components/FocusMode.tsx` (`endAtRef`, `leftRef`, pierścień `role="timer"`).
- **Ograniczenia:** w czasie pauzy zapisywana jest reszta; po przełączeniu trybu zegar startuje z pełnego czasu nowego trybu. Brak testu jednostkowego zegara; sprawdzenie w przeglądarce nie zrobione.

### Nie zrobione z Fali 4
- **B4:** pędzel „Własne godziny” i zapisany szablon tygodnia (G2.5, G4.6). Wymaga zmian w widoku tygodnia (`ShiftsView.tsx`), które wymagają osobnego przeglądu.

## Ustawienia — „Wyślij kopię” przez arkusz udostępniania (plan mobile C3 / 3.1, 2026-10-28)

### Co robi
- Na telefonie, który umie wysłać plik, w Ustawieniach → Kopia pojawia się przycisk **„Wyślij kopię”**. Otwiera arkusz udostępniania z plikiem `notki-kopia-RRRR-MM-DD-HHmm.json` (pełny backup, ten sam co „Pobierz”).

### Gdzie jest
- `src/lib/exportNotes.ts` — `shareFullBackup(confirm?)` zwraca `"shared" | "cancelled" | "unsupported"`.
- `src/components/settings/BackupSettings.tsx` — `canShareBackupFile()`, `shareNow()`, przycisk pod „Pobierz pełny backup teraz”.

### Jak działa i dlaczego
- Ta sama budowa kopii co przy zapisie (`buildFullBackupWithReport`) i to samo pytanie o pominięte załączniki (`confirm`).
- Przycisk widać tylko wtedy, gdy `navigator.canShare({ files })` działa. Na komputerze go nie ma, zamiast pokazywać przycisk, który nie zadziała.
- Anulowanie arkusza (`AbortError`) to zwykłe „anulowano”, bez komunikatu o błędzie.

### Ograniczenia i pułapki
- Duża kopia z załącznikami może przekroczyć limit pliku, który telefon przyjmie w arkuszu. Wtedy pojawia się komunikat o błędzie, a nie cichy brak akcji. Limit załączników jest taki sam jak przy pobieraniu.
- Kopia zawiera szyfrogram notatek prywatnych, nie ich treść, ale nadal zawiera dane. Wysyła ją tylko użytkownik, świadomym kliknięciem.

### Testy
- `tsc` czysto. Vitest: `src/components/debts`, `src/components/study`, `src/components/settings`, `src/lib/exportNotes`, `src/lib/debts` — 91 testów zielonych. Brak nowego testu dla `shareFullBackup` (wymaga atrapy `navigator.share`).

### Commit
- Patrz historia (`git log --oneline -1`), commit „Plan mobile fala 1: długi, ostrzeżenie egzaminu, wyślij kopię”.

## Powłoka: ekran startowy z animowanym „notki” (2026-10-30)

- **Co robi.** Po uruchomieniu zainstalowanej aplikacji (PWA) na ciemnym tle pisze się słowo „notki”, kreska po kresce jak długopisem, w gradiencie bursztyn → koral → róż z ikony „N”. Na końcu wskakuje kropka nad „i” i rysuje się cienkie podkreślenie. Ekran gaśnie, gdy notatki są wczytane. Zastępuje dawny łuk „G”.
- **Gdzie.** `index.html` (`#boot-splash`: style w `<head>`, SVG w `<body>`), `src/lib/bootSplash.ts` (`hideBootSplash`, `MIN_MS`).
- **Jak działa.** Czysty SVG i CSS w `index.html`, bez JS i bez czcionki: widać go, zanim wczyta się paczka. Każda kreska to osobna ścieżka z `pathLength="1"` i animacją `stroke-dashoffset`; kolejność i tempo ustawiają zmienne `--d` (opóźnienie) i `--t` (czas) w atrybucie `style`. Do startu kreska ma `opacity: 0`, bo zaokrąglony koniec kreski o zerowej długości rysuje kropkę. Kropka nad „i” to `circle` ze skalą od 0 i lekkim odbiciem. Poświata: `filter: drop-shadow` na całym SVG. Tło (`#15110e`) to `background_color` z manifestu, więc systemowy ekran startowy przechodzi w ten bez błysku.
- **Ograniczenia.** Widoczny tylko w trybie `standalone`/`fullscreen` albo z `?splash` w adresie (podgląd w przeglądarce). Najkrócej 1,45 s (300 ms przy ograniczonym ruchu), najdłużej 3 s. Przy `prefers-reduced-motion` słowo jest od razu narysowane. Systemowy ekran startowy Androida (ikona „N” z manifestu) jest poza aplikacją i zostaje.
- **Testy.** Brak testu automatycznego; sprawdzone zrzutami klatek w Playwright (`/?splash`).
- **Commit.** `00e477c` (2026-10-30).

## Powłoka: samouczek, przewodnik po Pracy i podpowiedź w Grafiku (2026-10-30)

- **Co robi.** **Samouczek na start** (pierwsze uruchomienie oraz „Więcej → Samouczek” i panel boczny): karta „Witaj w notkach” z wyborem działów (Notatki zawsze; Dziś i Terminy, Grafik, Praca na budowie — domyślnie wszystkie), potem karty Notatek (zapis, szukanie, kosz/archiwum), wybranych działów i karta o danych offline, kopii i synchronizacji. **Przewodnik po Pracy** (5 kart: wpis, karta budowy, punkty, materiał, rozliczenie i raport) otwiera się sam przy pierwszym wejściu do Pracy, potem z przycisku „?” w nagłówku Dziennika. **Podpowiedź w Grafiku**: jednorazowa ramka „Pierwszy raz w Grafiku?” (paleta, stuknięcie dni, „Cykl”); po zamknięciu nie wraca. Każda karta ma ilustrację: kartkę w kratkę z rysunkiem kreślonym długopisem i znacznikiem w rogu. Nawigacja: Dalej/Wstecz, kropki (stuknięcie = skok do karty), strzałki na klawiaturze, przesunięcie palcem w bok. Na telefonie część kart ma własny tekst (gesty, menu „Więcej”).
- **Gdzie.** `src/lib/guides.ts` (treść: `WELCOME_STEP`, `tourSteps`, `WORK_STEPS`, `INTERESTS`; stan: `guideSeen`, `markGuideSeen`, `shouldAutoShow`, `openGuide`, klucze), `src/components/guide/GuideDialog.tsx` (wspólne okno), `GuideArt.tsx` (14 scen SVG), `WorkGuide.tsx` (w `StudyView.tsx`), `ShiftsHint.tsx` (w `ShiftsView.tsx`), `src/components/OnboardingTour.tsx` (samouczek na start). Animacje `.guide-draw`, `.guide-pop`, `.guide-grow`, `.guide-slide` w `src/index.css`.
- **Jak działa.** Samouczek na start zapisuje `kaczy.tour.seen.v1` = „1” jak dawniej, więc kto go widział, nie zobaczy go znowu. Przewodniki działów i podpowiedzi zapisują się w `kaczy.guides.seen.v1` (`{ "work": 1, "shifts-hint": 1 }`). Wybór działów nie jest zapisywany — przy ponownym otwarciu znów są wszystkie. Ilustracje to czysty SVG z animacją `stroke-dashoffset` (`pathLength="1"`), opóźnienia w zmiennej `--d`; `key` = id karty, więc rysunek startuje od nowa na każdej karcie. Kreski są przezroczyste do startu (zaokrąglony koniec o zerowej długości rysuje kropkę). Przy ograniczonym ruchu (systemowym albo `data-motion="reduced"`) rysunek jest od razu gotowy. Przewodnik po Pracy siedzi w chunku Pracy, nie w paczce startowej.
- **Ograniczenia.** Pod automatem testów (`navigator.webdriver`) przewodnik Pracy i podpowiedź Grafiku nie pokazują się same, bo zasłoniłyby ekran w setkach testów e2e; testy samouczka ustawiają `kaczy.guides.force` = „1”. Samouczek na start działa jak dawniej (testy ustawiają `kaczy.tour.seen.v1`). Właściciel, który widział stary samouczek, nowego sam nie zobaczy — otworzy go z „Więcej → Samouczek”; przewodnik po Pracy i podpowiedź Grafiku zobaczy przy następnym wejściu.
- **Testy.** Vitest: `src/lib/guides.test.ts` (karty według wyboru, unikalne id, stan „widziane” i śmieci w pamięci, brak automatu pod webdriverem). E2E: `e2e/guides.spec.ts` (wybór działów zmienia liczbę kart, Wstecz, strzałki, skok kropką, zapamiętanie; przewodnik Pracy raz i z „?”; podpowiedź Grafiku raz); `e2e/mobile.spec.ts` (okno samouczka mieści się na telefonie).
- **Commit.** `905a3ed` (2026-10-30).

## Powłoka — nazwa aplikacji w jednym miejscu (1.2, 2026-11-06)

- **Co robi.** Ustawienia zakładki do zapisu stron mówią o aplikacji jej obecną nazwą („Zapisz w NOTKI”), zamiast starej marki „G”. Tytuł sekcji to „Zakładka do zapisu stron” — bez nazwy, więc nie zestarzeje się przy kolejnej zmianie marki.
- **Gdzie.** `src/lib/appName.ts` (`APP_NAME`). Używają go: `ClipperSettings.tsx` (treść i przycisk), `overdueBadge.ts` (`BASE_TITLE`, tytuł karty), `passkey.ts` (nazwa strony w WebAuthn), `VaultSettings.tsx` (etykieta passkeya), `exportNotes.ts` (nagłówek eksportu HTML), etykiety `aria-label` logo w `AppSidebar.tsx`, `NotatnikWordmark.tsx`, `NotkiLogo.tsx`.
- **Ograniczenia.** Pliki statyczne (`index.html`, `public/manifest.webmanifest`) nie importują modułów — nazwę trzeba w nich zmienić ręcznie. Komentarze w kodzie wspominające dawne marki zostały.
- **Testy.** `src/lib/settingsIndex.test.ts` (tytuł sekcji nadal w kodzie), `e2e/clipper.spec.ts` („Zapisz w NOTKI”).

## Powłoka — karty Ustawień w palecie (plan 2.5, 2026-11-12)

- **Co robi:** paleta poleceń ma skróty prosto na kartę Ustawień: „Ustawienia: Wygląd”, „Ustawienia: Ogólne”, „Zrób kopię zapasową (Kopia i dane)”, „Połącz urządzenie (Sync)”. Znajdują się też po słowach kluczowych (np. „backup”, „parowanie”, „motyw”).
- **Gdzie:** `CommandPalette.tsx` (`SETTINGS_SHORTCUTS`, `requestSettingsTab` z `settingsDeepLink.ts`).
- **Ograniczenia:** „Zrób kopię” otwiera kartę kopii, nie zapisuje pliku od razu — zapis od razu pominąłby pytanie o pominięte załączniki (D3). „Zablokuj prywatne notatki” i „Do skrzynki” były już w palecie; „Styl”, „Krój”, „Jasność” jako osobne polecenia — bez zmian (styl jest).
- **Testy:** e2e `palette-settings-tabs.spec.ts`.

## Powłoka — cień nagłówka przy przewijaniu (plan 4.3, 2026-11-12)

- **Co robi:** po zjechaniu ze szczytu strony pod nagłówkiem pojawia się delikatny cień (narasta przez pierwsze 80 px przewijania).
- **Gdzie:** `src/index.css` (`.app-header::after`, `@keyframes header-shade`, `animation-timeline: scroll(root)`).
- **Ograniczenia:** bez wsparcia `animation-timeline` (Safari, Firefox) cienia nie ma — jak dotąd; zwężenie nagłówka i wjazd tytułu działu (reszta 4.3) — nie zrobione. Powłoka 4.1 (88 × `uppercase tracking-wider`) i 4.4 (arkusz „Więcej” jako siatka kafli z licznikami) okazały się zrobione wcześniej.
- **Testy:** sprawdzone w przeglądarce (krycie cienia 0 na szczycie, 1 po przewinięciu 400 px).

## Powłoka — wznowienie: ostatni dział, a po 4 h „Dziś” (Q3.4, decyzja QL-3, 2026-11-23)

- **Co robi:** w zainstalowanej aplikacji (PWA w trybie `standalone` albo powłoka Androida) zimny start z ikony wraca do ostatnio otwartego działu, a po co najmniej 4 h przerwy zaczyna od „Dziś”. Tak samo powrót do schowanej aplikacji: po 4 h przełącza na „Dziś”, krótsza przerwa niczego nie zmienia. W zwykłej karcie przeglądarki nic się nie dzieje — adres wybiera użytkownik.
- **Gdzie jest:** `src/lib/resumeView.ts` (czyste decyzje: `launchTarget`, `resumeTarget`, `RESUME_TODAY_AFTER_MS`, klucz `kaczy.lastSeen.v1`), `src/hooks/useResumeView.ts` (podpięty w `pages/Index.tsx` obok `useLaunchIntents`).
- **Jak działa:** przy schowaniu (`visibilitychange` → `hidden`, `pagehide`) zapis `{ at, path }` lokalnie (poza kopią). Zimny start działa tylko dla wejścia z ikony — dokładnie „/” bez zapytania (skróty z ekranu głównego i udostępnianie mają parametry, link do konkretnego miejsca zostaje). Nie przywraca udostępniania (`/share`) ani jednorazowych akcji (`?new=`, `?szukaj=`, `?skrzynka=`, `?inbox=`, `?akcja=`). Przy powrocie nie przełącza, gdy otwarte jest okno (`role=dialog` z `data-state=open`) albo fokus jest w polu tekstowym.
- **Ograniczenia:** plan Q3.4 mówił o 8 h — właściciel wybrał 4 h. Pozycja przewijania w dziale nie jest przywracana (przy zimnym starcie lista i tak buduje się od nowa).
- **Testy:** `src/lib/resumeView.test.ts` (5), `e2e/resume-view.spec.ts` (zimny start po 3 h i 5 h, powrót po 30 min i po 4 h, zwykła karta bez zmian).

## Powłoka — linki `web+notatnik:` i adres notatki (Q3.7, 2026-11-25)

- **Co robi:** zainstalowana aplikacja otwiera linki `web+notatnik:` z tagu NFC, skrótu albo innej aplikacji. Obsługiwane linki:
  - `web+notatnik:notatka/<id>` otwiera notatkę,
  - `web+notatnik:budowa/<id>` otwiera kartę budowy,
  - `web+notatnik:dzis` (także `kalendarz`, `grafik`, `dlugi`, `praca`, `skrzynka` i inne widoki) otwiera dział.
  
  W palecie poleceń przy otwartej notatce jest „Kopiuj adres notatki”. Kopiuje zwykły adres `https://…/notatka/<id>`, który działa też bez instalacji, np. do zapisania na tagu NFC albo jako zakładka. W powłoce Androida (APK) polecenia nie ma (`isNativeShell`): adres byłby `https://localhost/…` i poza aplikacją nic by nie otworzył.
- **Gdzie jest:** `src/lib/protocolLink.ts` (`protocolLinkPath`, `applyProtocolLink`, `PROTOCOL`); wywołanie w `src/main.tsx` przed `createRoot`; `protocol_handlers` w `public/manifest.webmanifest` (`/?link=%s`); `copyNoteAddress` w `src/lib/noteMarkdown.ts`; polecenie w `src/components/CommandPalette.tsx`.
- **Jak działa:** przeglądarka otwiera `/?link=<zakodowany link>`. `applyProtocolLink` zamienia go przez `history.replaceState`, bez nowego wpisu w historii, zanim router przeczyta adres. Dalej działa zwykła ścieżka `/notatka/:id` albo `/praca?budowa=`. Ochrona przed przekierowaniem na zewnątrz: z linku przechodzą tylko znane kształty. Identyfikator musi pasować do `[A-Za-z0-9_-]{1,100}`, a widok musi być z białej listy. Nieznany albo obcy link prowadzi na stronę główną.
- **Ograniczenia i pułapki:** protokół działa tylko w zainstalowanej aplikacji w przeglądarkach z `protocol_handlers` (Chrome/Edge na komputerze i Androidzie). Safari i Firefox go nie obsługują, wtedy zostaje adres `https://…/notatka/<id>`. Osoba w Długach nie ma jeszcze własnego adresu (plan wspominał o nim, ale widok Długów nie czyta parametru osoby). Identyfikatory notatek z innym alfabetem niż `[A-Za-z0-9_-]` nie przejdą przez protokół, choć przejdą przez `/notatka/`.
- **Testy:** `src/lib/protocolLink.test.ts` (kształty, obce linki, podmiana adresu), `src/lib/manifest.test.ts` (wpis w manifeście).
- **Commit:** `22550d6c` (protokół), `18edca1f` (polecenie w palecie), 2026-11-25.

## Ustawienia — słownik „kopia”, „styl”, „krój” i odmiana urządzeń (U1.2, U1.3, 2026-11-26)

- **Co robi:** w oknie Ustawień, przypomnieniach o kopii, „Koniec dnia” w Pracy i kaflu notatki prywatnej jest „kopia” zamiast „backup” (np. „Pobierz pełną kopię teraz”, „Przywróć z pliku kopii”, „Kopia automatyczna co 7 dni”), a w Wyglądzie „styl, krój tekstu” zamiast „skórka, czcionka”. Sync bez drugiego urządzenia: „wpisz na nim ten kod albo zeskanuj QR”. Liczba urządzeń odmienia się wspólnym `devicesPl` („5 urządzeń”).
- **Gdzie jest:** `src/components/settings/*`, `SyncSettings.tsx`, `OfflineQueuePanel.tsx`, `src/hooks/useBackupReminders.ts`, `src/components/study/EndDaySheet.tsx`, `src/components/vault/LockedNoteTile.tsx`, `src/lib/plural.ts` (`devicesPl`), `src/lib/settingsIndex.ts` (tytuł „Miejsce zapisu kopii”; słowo „backup” zostaje w `words`, żeby wyszukiwanie dalej je znajdowało).
- **Ograniczenia:** identyfikatory, klucze i nazwy plików (`backup`, `BackupSettings`) zostają — strażnik sprawdza tylko napisy ze spacją i tekst JSX.
- **Testy:** `src/test/settingsVocabulary.test.ts` (strażnik słownika), `src/lib/plural.test.ts` (`devicesPl`); e2e z nowymi nazwami przycisków: `restore-*.spec.ts`, `search-backup.spec.ts`, `images.spec.ts`, `private-notes.spec.ts`, `daily-snapshot.spec.ts`.
- **Commit:** `24275fca` (2026-11-26).

## Powłoka — okno „O aplikacji”: autor, wyróżniki i wszystkie funkcje (2026-11-26)

- **Co robi:** okno „O aplikacji” otwiera się z ikony „i” obok Ustawień w stopce paska bocznego, z wiersza „O aplikacji · wersja …” pod nią, a na telefonie z kafla „O aplikacji” obok „Ustawienia” w arkuszu „Więcej”. W oknie jest nazwa i wersja, podpis „Made by Grzegorz K.” z kreską pióra w kolorze akcentu i „Co wyróżnia NOTKI”, czyli osiem kafli: bez internetu i konta, synchronizacja bez cudzej chmury, Skarbiec, praca instalatora, grafik, który liczy, kopie, sieć wiedzy, wygląd. Pod kaflami są „Wszystkie funkcje”: działy w rozwijanych `<details>` z liczbą punktów, a na dole „Wersja i aktualizacja” (dawny panel 5.7).
- **Gdzie jest:** treść w `src/content/about.ts` (`AUTHOR_LINE`, `HIGHLIGHTS`, `FEATURE_GROUPS`); okno `src/components/about/AboutDialog.tsx` (ikony wyróżników w `ICONS`, panel wersji `AboutPanel` z `src/components/AboutPanel.tsx`); nasłuch `src/components/about/AboutHost.tsx`; sygnał `SIGNALS.about` (`kaczy:about`) w `src/lib/storage/names.ts`; wejścia w `AppSidebar.tsx` (`openAbout`) i `BottomNav.tsx` (`SheetTile`); `AboutHost` zamontowany w `src/pages/Index.tsx`.
- **Jak działa:** wejścia tylko wysyłają zdarzenie okna, jak Samouczek (`SIGNALS.tour`), więc pasek boczny i dolny pasek nie dostają nowych propsów. `AboutHost` jest mały i importowany wprost. Samo okno z treścią to osobny kawałek (`lazy`), ładowany przy pierwszym otwarciu, więc paczka startowa praktycznie nie rośnie. Dawne małe okno „O aplikacji” w `AppSidebar.tsx` zostało scalone z nowym, żeby nie było dwóch różnych okien o tej samej nazwie. Ustawienia → Kopia i dane → „O aplikacji” dalej pokazują sam `AboutPanel`.
- **Ograniczenia i pułapki:** `AboutHost` musi być **poza** `<Suspense>` z leniwymi sąsiadami. W jednym `Suspense` z `OnboardingTour` montował się dopiero po doładowaniu samouczka, a kliknięcie sprzed montażu przepadało (złapane w e2e). Leniwy sam host miał ten sam błąd. Spis funkcji jest pisany ręcznie, więc przy nowej funkcji trzeba dopisać ją w `content/about.ts` w jej dziale; źródłem są `opis.md` i `docs/opis/`. Na telefonie pasek boczny jest oknem z pułapką fokusu, dlatego `openAbout` najpierw go zamyka.
- **Testy:** `e2e/about.spec.ts`: ikona w stopce, wiersz z wersją (jedno okno, sekcja wersji), kafel w arkuszu „Więcej” na telefonie (`@mobile`), podpis autora, rozwinięcie działu, axe WCAG 2.2 AA, zamknięcie Escape.
- **Commit:** `27d5fc65`, 2026-11-26.

## Powłoka — rejestr poleceń palety (A3.4, 2026-11-26)

- **Co robi:** dla użytkownika nic się nie zmienia — paleta (Ctrl+K) ma te same grupy Kalendarz, Praca, Grafik i Akcje, z tymi samymi nazwami, słowami wyszukiwania, skrótami i warunkami. Zmiana jest pod spodem: te polecenia są teraz danymi w rejestrze, więc dział dopisuje polecenie bez edycji palety.
- **Gdzie jest:** `src/lib/commands/types.ts` (`Command`, `CommandSource`, `CommandContext`, `GoView`), `src/lib/commands/registry.ts` (`registerCommandSource`, `commandGroups`, `commandsWithShortcuts`, `resolveLabel`, `resolveShortcut`), `src/lib/commands/builtin.ts` (`registerBuiltinCommands` — dawne grupy z `CommandPalette.tsx`, w tym skróty do kart Ustawień z Powłoki 2.5). `CommandPalette.tsx` buduje `CommandContext` z propsów i rysuje `commandGroups(cmdCtx)`; element ma `data-command-id`.
- **Jak działa:** polecenie = `{ id, label (napis albo funkcja kontekstu), icon?, keywords?, shortcut?, hint?, when?, run(ctx) }`. Źródło ma nagłówek grupy, `order` i `mutedIcons`. Polecenia nie importują Reacta ani routera — wszystko, co robią z interfejsem, dostają w `CommandContext` (nawigacja, otwarcie okien, bieżący styl, stan skarbca). `registerCommandSource` odrzuca zduplikowane `id` i zwraca funkcję wycofania. `value` w cmdk to `etykieta + keywords`, więc wyszukiwanie działa jak wcześniej.
- **Ograniczenia i pułapki:** w palecie zostały grupy zależne od zapytania i stanu (wyniki notatek, klientów, budów, pytań, ustawień, dni grafiku, „Ta notatka”, „Ostatnie notatki”, „Ostatnio użyte”, filtry, lista stylów przy wpisanym tekście, nawigacja z ukrywaniem działów). Źródło spoza `builtin.ts` musi zostać zarejestrowane, zanim paleta się otworzy — najprościej w module importowanym przez `Index.tsx` albo przez samą paletę.
- **Testy:** `src/lib/commands/registry.test.ts` (kolejność grup, `when`, dopisanie i wycofanie źródła, duplikat, wywołanie kontekstu, skróty); e2e palety bez zmian: `palette-*.spec.ts`, `command-palette-study.spec.ts`, `clients.spec.ts`, `private-notes.spec.ts`, `inbox-quick.spec.ts`, `note-links.spec.ts`.
- **Commit:** `a37ffae6`, 2026-11-26.

## Ustawienia — „Odśwież aktualizacje” i auto-aktualizacja (2026-11-26)

- **Co robi:** Ustawienia → Ogólne zaczynają się od bloku „Aktualizacje” (też w szybkim skoku i w wyszukiwarce Ustawień/palecie). Przycisk „Odśwież aktualizacje” sprawdza nową wersję i, gdy jest, od razu ją instaluje — aplikacja się przeładowuje. Gdy wersja już czeka, przycisk mówi „Zainstaluj nową wersję”. Wynik w dymku: „Masz najnowszą wersję”, brak sieci albo „czeka na zapis ostatniej zmiany”. Pod spodem przełącznik **„Aktualizuj automatycznie”** (domyślnie włączony): nowa wersja instaluje się sama, gdy użytkownik wyjdzie z aplikacji albo przez minutę niczego nie dotyka i nie pisze, a sprawdzanie jest co 30 min (bez auto — co godzinę) i po powrocie do aplikacji. Dymek „Dostępna nowa wersja” przy auto mówi, kiedy wersja wejdzie sama, i ma „Odśwież teraz”.
- **Gdzie jest:** `src/lib/autoUpdate.ts` (`useAutoUpdate`, `getAutoUpdate`, `setAutoUpdate`, `shouldAutoApply`, `trackActivity`, `idleFor`, `AUTO_UPDATE_IDLE_MS`, `AUTO_UPDATE_CHECK_MS`); `src/lib/registerSW.ts` (`refreshToLatest`, w `watchForUpdates` — `tryAutoApply` przy zmianie widoczności i co 15 s; interwał sprawdzania); `src/components/settings/UpdateSettings.tsx`; wpis w `GeneralSettings.tsx` (`JUMP_GROUPS`) i `src/lib/settingsIndex.ts`; tekst dymku w `src/main.tsx`.
- **Jak działa:** podmiana wersji to przeładowanie strony, więc `shouldAutoApply` wymaga: auto włączone, wersja czeka, `hasUnsavedWork()` fałszywe, a do tego karta schowana albo ≥ 60 s bez `pointerdown`/`keydown`/`wheel`/`touchstart`/`input`. Wcześniej wersja podmieniała się sama tylko po schowaniu karty i to bez względu na ustawienie — teraz wyłączenie przełącznika wyłącza też to (zastąpiona `canApplyWaitingUpdate`). Ustawienie to klucz `kaczy.autoUpdate.v1` (`POWLOKA.autoUpdate`), zwykła preferencja w kopii (`BACKUP_KEYS` w `keys.ts`). Dawny panel „Wersja i aktualizacja” w oknie „O aplikacji” i w Kopia i dane zostaje.
- **Ograniczenia i pułapki:** bez service workera (tryb deweloperski, `?sw=off`, ramka, aplikacja Android) przycisku nie ma — APK aktualizuje się nowym plikiem. Formularz wypełniony, ale niezapisany poza notatkami (np. pole w oknie) `hasUnsavedWork` nie widzi; dlatego przy otwartej karcie czekamy na minutę bezczynności, a nie podmieniamy od razu.
- **Testy:** `src/lib/registerSW.test.ts` (`shouldAutoApply`: schowana karta, minuta bezczynności, niezapisana praca, brak wersji, wyłączone auto), `src/lib/settingsIndex.test.ts` (tytuł „Aktualizacje” w kodzie), `e2e/settings-updates.spec.ts` (przycisk z prawdziwym workerem, przełącznik domyślnie włączony i zapamiętany).
- **Commit:** zobacz `git log --grep "auto-aktualizacja"`, 2026-11-26.

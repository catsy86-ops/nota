# Plan: Ustawienia — dopracowanie i rozbudowa (2026-10-19)

Źródła: przegląd UX/dostępności (agent planujący), audyt pokrycia testami (agent eksploracji), zweryfikowane ręcznie w kodzie. Wszystkie odwołania `plik:linia` dotyczą stanu z HEAD `377a23a`.

## Stan obecny

- Okno `SettingsDialog.tsx` (pełny ekran na telefonie), cztery karty: **Wygląd**, **Ogólne**, **Dane**, **Sync**.
- Wejścia: pasek boczny, „Więcej” na dolnym pasku, paleta poleceń.
- Ustawienia zmiany (Grafik) są osobno w `ShiftSettingsDialog`; Praca nie ma żadnej sekcji.
- Stan: `viewPrefs`, `effectsSettings`, `confirmPrefs`, `push/prefs` na `persistedStore`.
- **Testy jednostkowe dla komponentów Ustawień: brak.** Pokrycie to głównie e2e (skins, push, clipper, backup, shifts).

## Zweryfikowane problemy

**P1 — ważne**
1. **Reset „Przywróć domyślne” kasuje za dużo.** `AppearanceSettings.tsx:188-190` resetuje cały `viewPrefs` (`viewPrefs.ts:84-86`): auto-backup, przypomnienia o kopii, godziny, sortowanie, filtry, autosave, pisownię. Bez potwierdzenia, a toast „Przywrócono ustawienia” nie mówi, co zniknęło. *Naprawa S.*
2. **„Zapomnij i zacznij od nowa” (Sync) kasuje parowanie od razu**, bez potwierdzenia i bez cofnięcia (`SyncSettings.tsx:139-141`, `:65-69`). Wzór już jest w przywracaniu kopii (`BackupSettings.tsx:193-225`). *Naprawa S.*
3. **Przełączniki bez nazwy dla czytników ekranu.** `ToggleRow` (`settings/SettingsShared.tsx:14-22`) to zwykły `<p>` bez `id`/`aria-labelledby`. *Naprawa S.*
4. **Kontrolki bez nazwy dostępnej:** suwaki (`GeneralSettings.tsx:146`, `BackupSettings.tsx:266, 277, 292`), pola godzin i wybór dnia (`BackupSettings.tsx:300, 325, 335`), kolory notatek bez `aria-label`/`aria-pressed` (`GeneralSettings.tsx:96-106`). Tytuły sekcji to `<p>`, nie nagłówki (`SettingsShared.tsx:7`). Dobry wzór: `PushSettings.tsx:74`. *Naprawa S.*
5. **Cele dotyku poniżej 44 px na telefonie:** zakładki ~32 px (`tabs.tsx:27`), przełącznik `h-6 w-11` (`switch.tsx:9`), kciuk suwaka 20 px (`slider.tsx:18`), kolory 36 px (`GeneralSettings.tsx:101`), przycisk „Test” `h-8` (`GeneralSettings.tsx:178`). Wzór do skopiowania: `coarse:h-11` (`button.tsx:24`).
6. **Uszkodzone dane prefs zaśmiecają stan.** Zweryfikowane: `viewPrefs.ts:66-68` robi `{...defaults, ...stored}`, a `persistedStore.ts:52` przy błędnym JSON przekazuje surowy tekst do `merge`. Wynik: klucze „0", „1", … w stanie. Domyślne wartości przeżywają, więc to nie utrata danych. *Naprawa S, z testem.*
7. **Migracja efektów bez testu** (`effectsSettings.ts:58-77`): nie ma testu, że flaga działa raz i że przy błędzie `localStorage` nie jest ustawiana.

**P2 — porządek i struktura**
8. **Przypomnienia rozrzucone po dwóch kartach:** powiadomienia, push, przegląd i odznaka w Ogólne (`GeneralSettings.tsx:111-122`), kopia i przypomnienia w Dane (`BackupSettings.tsx:276-321`). Synchronizacja też dwa miejsca: karta Sync i „Synchronizacja przez plik” w Dane (`BackupSettings.tsx:361-373`).
9. **Ogólne przeciążone:** ~10 sekcji i 14 efektów (`GeneralSettings.tsx:158-187`).
10. **Brak sekcji Praca / Grafik.** Ustawienia Grafiku są tylko przez `ShiftSummary.tsx:108`.
11. **Pusty fallback Suspense** dla karty Sync (`SettingsDialog.tsx:88`): miga pusty ekran przy pierwszym otwarciu.
12. **Opis okna kłamie:** „Wszystko zapisuje się automatycznie w tej przeglądarce” (`SettingsDialog.tsx:61`) — sync i kopia między urządzeniami temu przeczą.

**P3 — nowe możliwości**
13. Wyszukiwanie w ustawieniach (statyczny indeks etykiet, wspólny z paletą poleceń).
14. Linki do sekcji przez `?settings=<karta>` — wzorzec już jest przy `?pair=` (`SettingsDialog.tsx:28-38`).
15. Reset per sekcja z podglądem zmian.

**Już dobre — nie przebudowywać:** przywracanie (dwuetapowe, z wyborem sekcji), stan pamięci i trwałości, sekcja sejfu z objaśnieniem, segmenty jako `ToggleGroup`, lista skrótów ukryta na dotyku. Kontrast tekstu pomocniczego wygląda na AA z tokenów, ale nie zmierzono go.

## Pokrycie testami — luki

Bez testu: Ogólne efekty (`GeneralSettings.tsx:158-187`), przyciski „Test”, „Pytaj przed koszem/archiwum” (`117-143`), sprawdzanie pisowni (`124-129`), suwak autosave (`145-156`), odznaka zaległych (`117-122`), „Przywrócono ustawienia” (`AppearanceSettings.tsx:188`), motyw sezonowy i cytat dnia, suwaki kopii i godziny przypomnień (`BackupSettings.tsx:266-344`), auto-blokada sejfu (`VaultSettings.tsx:58`), dni przeglądu, kolory domyślne (`GeneralSettings.tsx:93-109`).

Stan bez testów: `viewPrefs` (domyślne, reset, zwijanie grup, walidacja zakresów), `confirmPrefs` (w ogóle), `normalizePushServer` (`push/prefs.ts:34-42`), migracja efektów.

Niestabilność w e2e: stałe czekania (`mobile.spec.ts:61, 136, 144, 149, 199, 230`; `private-notes.spec.ts:158, 219` po 2500 ms; `board-table.spec.ts:133`; `card-images.spec.ts:64`; `voice-note.spec.ts:24`). Niejednoznaczny selektor „Ustawienia” z `.first()`/`.last()` (zależny od kolejności w DOM). `card-motion.spec.ts:5-9` nadpisuje `kaczy.effectsSettings.v1` przy każdym przeładowaniu — wzór ochrony z `skins.spec.ts:6-7` (flaga w `sessionStorage`) nie jest tam użyty.

## Plan wykonania

**Faza 1 — szybkie poprawki (wszystkie S)**
- 1a. AlertDialog z dwuetapowym potwierdzeniem dla resetu i „Zapomnij” (wzór z przywracania).
- 1b. Zawęzić reset do opcji Wygląd albo nazwać go dokładnie; poprawić treść toastu.
- 1c. `ToggleRow` powiązany z przełącznikiem (`useId` + `aria-labelledby`).
- 1d. `aria-label` dla suwaków, pól czasu i wyboru dnia; `aria-pressed` dla kolorów; tytuły sekcji jako nagłówki.
- 1e. `coarse:h-11`/min-h-11 dla zakładek, przełącznika, kciuka suwaka, kolorów i „Test”.
- 1f. Zamienić `null` w Suspense na szkielet.
- 1g. Poprawić opis okna (punkt 12).
- 1h. Naprawić `viewPrefs` przy uszkodzonym JSON (nie przekazywać surowego tekstu do `merge` dla stanów obiektowych) + test.

**Faza 2 — struktura (M)**
- 2a. Jedna sekcja przypomnień; synchronizacja w jednym miejscu.
- 2b. Podział Ogólne na „Edytor i potwierdzenia” oraz „Zabawa i efekty”.
- 2c. Sekcja „Praca / Grafik” z linkiem do `ShiftSettingsDialog`.
- 2d. Nazwa karty „Dane” — zmienić na „Kopia i dane”, jeśli czytelniej na telefonie.

**Faza 3 — nowe możliwości (M–L)**
- 3a. Reset per sekcja z podglądem zmian.
- 3b. Wyszukiwanie w ustawieniach na wspólnym indeksie z paletą poleceń.
- 3c. Linki do sekcji `?settings=<karta>`.

**Testy (równolegle z fazą 1)**
- T1. Jednostkowe: `effectsSettings.test.ts` (migracja raz, flaga, błąd `localStorage`), `viewPrefs.test.ts` (domyślne, merge, uszkodzony JSON, reset), `confirmPrefs.test.ts`, `push/prefs.test.ts` (`normalizePushServer`: `push.test/`→`https://push.test`, `http://serwer.pl`→odrzucone, `http://localhost:8787`→dozwolone, pusty→null; wymuszenie `enabled=false` przy pustym serwerze).
- T2. E2E `settings-prefs.spec.ts`: wyłączenie „Pytaj przed koszem”, przeładowanie, usuwanie bez pytania; sprawdzanie pisowni (atrybut `spellcheck`); migracja efektów ze starych wartości; suwak autosave `co 15s` przeżywa przeładowanie; „Przywrócono ustawienia” przywraca domyślne.
- T3. Higiena e2e: zamienić stałe czekania na asercje stanu elementu; stabilna nazwa dostępna przycisku „Ustawienia” albo test-id; usunąć `.first()`/`.last()`; `card-motion.spec.ts` seeduje tylko raz (flaga w `sessionStorage`).

## Otwarte pytania do właściciela

1. Reset (1b): zawęzić do Wyglądu, czy zostawić wszystko i tylko dać dokładne potwierdzenie z listą tego, co zniknie?
2. Faza 2: czy „Kopia i dane” (zmiana nazwy) ma sens, czy zostawiamy „Dane”?
3. Faza 3: wyszukiwanie ustawień — warte nakładu przy jednym użytkowniku?

## Uwagi

- Ten plan nie zmienia kodu. Każda faza osobnym commitem z hashem w `opis.md`.
- QA na telefonie (zakładki, dotyk, klawiatura) — zgodnie z decyzją, później.

## Decyzje właściciela (2026-10-19)

1. Reset: **zostaje pełny reset**, z potwierdzeniem, które wymienia, co wróci do domyślnych, i czego reset nie dotyczy.
2. Karta „Dane” → **„Kopia i dane”** (faza 2d).
3. Wyszukiwanie ustawień: **nie**.

## Status

- **Faza 1 — zrobione** (2026-10-19): potwierdzenia dla resetu i „Zapomnij”; reset z listą zmian; przełącznik z nazwą (`aria-labelledby`); nazwy suwaków, pól czasu, wyboru dnia i kolorów (po polsku, `aria-pressed`); tytuły sekcji jako nagłówki; cele dotyku 44 px na dotyku (zakładki, przełącznik, kciuk suwaka, kolory, „Test”, kopiowanie kodu, linki); szkielet zamiast pustego ekranu karty Sync; poprawny opis okna; `viewPrefs`/`effectsSettings`/`confirmPrefs` przy uszkodzonym zapisie wracają do domyślnych (test `settingsPrefs.test.ts`).
- **Faza 2 — zrobione** (2026-10-19, bez commita): karta „Dane” → „Kopia i dane” (2d); przypomnienia „Dziś” i „Ten tydzień” przeniesione do Ogólne, obok przeglądu tygodnia (2a, część — przypomnienie o kopii zostaje w Kopii); sekcja „Synchronizacja przez plik” przeniesiona do karty Sync (2a); efekty przeniesione z Ogólne do Wyglądu (2b — zamiast trzeciej karty, żeby nie zrobić pięciu kart na telefonie); sekcja „Praca i Grafik” z przyciskiem otwierającym ustawienia Grafiku (2c); wspólny klucz `LAST_AUTO_EXPORT_KEY`; martwa gałąź `trigger` w `SettingsDialog` usunięta; domyślny dzień przypomnienia tygodniowego ujednolicony do niedzieli (jak przegląd).
- **Faza 3 — do zrobienia** bez wyszukiwania (decyzja 3): reset per sekcja, linki `?settings=`.

## Ustalenia z mapy kodu (trzeci raport)

- **Sprzeczne domyślne „przegląd tygodnia”:** Ogólne (`kaczy:review.day`, domyślnie niedziela) i Dane (`weekReminderDay`, domyślnie poniedziałek). Dwie niezależne wartości o tej samej nazwie. Do ujednolicenia w fazie 2.
- **Zduplikowany klucz** `kaczy.lastAutoExport` w `BackupSettings.tsx:130,137` i w `backupReminder.ts:2` — jedna stała.
- **Martwa gałąź** w `SettingsDialog.tsx` (niekontrolowany `trigger`) — nigdzie nie używana.
- **Nieużywane eksporty:** `getEffectsSettings`, `getSeasonPref`, `getAutoLockMinutes`, `getBadgeEnabled`.
- **`NotificationStatus`** czyta uprawnienia raz na render, bez subskrypcji — może się zestarzeć.
- **Skróty klawiszy** w Ogólne to zakodowana lista, nie wyliczona z obsługi klawiszy — może się rozjechać.
- **Brak sposobu cofnięcia zgody na dyktowanie** (`kaczy.dictation.consent`) w Ustawieniach.

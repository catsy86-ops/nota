# Plan: architektura, duże pliki, testy i CI (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Uzupełnia `plan-fable-2026-11-15.md` (F3 — podział `yjsStore.ts` — jest tam i ma pierwszeństwo). Wykonawca: Opus dla A2 i A3, Sonnet dla A1, A4, A5.
>
> Reguła wspólna: każdy krok to osobny commit bez zmiany zachowania; po każdym `npm run typecheck` (nie `tsc -p .`) i całe Vitest.

## 1. Stan (policzone)

- **Warstwy są odwrócone w 63 plikach `src/lib/`:**
  - 92 importy z `@/hooks/useNotes` — prawie same typy: `Note` (83), `ChecklistItem` (11), `Folder` (9), `NoteColor` (5), `FolderColor`;
  - 9 × `View` z `@/hooks/useFilteredNotes`; 6 × `isMotionReduced`/`setMotionMode` z `@/hooks/useMotionPref`; po 1 × `useToday`, `resolveDark`, `hasDictationConsent`;
  - 2 importy komponentów: `@/components/study/InvoiceDialog`, `@/components/clients/ClientsView`;
  - `sonner` w 14 plikach `lib` (m.in. `privateNotes.ts`, `yjsSync.ts`, `undoToast.ts`, `relayRuntime.ts`);
  - `src/hooks/` importuje 9 komponentów (`ConfirmActionDialog`, `AddNoteBar`, `ReminderToast`, `NoteReader`, `InboxCapture`).
- **Największe pliki:** `yjsStore.ts` 1089, `JournalEntrySheet.tsx` 1083, `AddNoteBar.tsx` 974, `Index.tsx` 967 (67 wywołań hooków), `DebtsView.tsx` 792, `privateNotes.ts` 727, `TrainingSection.tsx` 717, `NoteReader.tsx` 710, `SiteCardDialog.tsx` 706, `CommandPalette.tsx` 664, `exportNotes.ts` 609 (25 eksportów), `ShiftsView.tsx` 586.
- **Testy:** 279 plików w `e2e/`; `workers: 1` lokalnie; CI puszcza całość w jednym zadaniu bez podziału; `waitForTimeout` m.in. w `mobile.spec.ts` (6), `web-vitals-phone.spec.ts` (6), `fab-press.spec.ts` (4). Pełne e2e po `3a4ff293` nie przeszło w całości.
- **Dokumenty:** `opis.md` 5797 linii w jednym pliku.
- **Dysk:** `.claude/worktrees` zajmuje 855 MB, a `git worktree list` pokazuje tylko katalog główny — to porzucone kopie.

## Etap A1: warstwy `lib ← hooks ← components` (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| A1.1 | **Typy domeny do `src/lib/types/note.ts`:** `Note`, `ChecklistItem`, `Folder`, `NoteColor`, `FolderColor`. `useNotes.ts` reeksportuje je (zero zmian w komponentach). Potem mechaniczna zamiana 92 importów w `lib`. Uwaga z pamięci: zamiana importów regexem zgubiła kiedyś `...fn()` — robić przez `ts-morph` albo plik po pliku, z typecheck po każdej paczce. | M |
| A1.2 | **`View` do `src/lib/types/view.ts`**; `isMotionReduced`/`setMotionMode` do `src/lib/motionPref.ts`; `resolveDark` do `src/lib/theme.ts`; `hasDictationConsent` do `src/lib/dictationConsent.ts`. Hooki reeksportują. | S |
| A1.3 | **Dwa importy komponentów z `lib`** (`InvoiceDialog`, `ClientsView`): sprawdzić, co jest brane (zwykle typ albo stała) i przenieść to do `lib`. | S |
| A1.4 | **`sonner` poza `lib`:** port `src/lib/notify.ts` — `notify.info/success/error/undo(...)` z wstrzykiwanym ujściem (`setNotifySink`), domyślnie puste; `App.tsx` podpina `toast`. 14 plików przechodzi na `notify`. Testy `lib` przestają potrzebować atrapy `sonner`. | M |
| A1.5 | **Hooki bez komponentów:** 9 importów — hook zwraca dane i akcje, a komponent (dialog, toast) renderuje wołający; tam, gdzie to niepraktyczne, przenieść plik do `components/` jako komponent-kontroler. | M |
| A1.6 | **Reguła ESLint** `no-restricted-imports` dla `src/lib/**`: zakaz `@/hooks/*`, `@/components/*`, `sonner`, `react` (poza jawną listą plików `*.tsx` w `lib`). Dla `src/hooks/**`: zakaz `@/components/*`. Lista wyjątków w konfiguracji, malejąca do zera. | S |

Odbiór: `grep -r "@/hooks\|@/components" src/lib` = 0 poza listą wyjątków; lint 0 błędów.

## Etap A2: `Index.tsx` (Opus)

Cel: strona jako złożenie, ≤ 350 linii, bez własnej logiki.

| Nr | Punkt | Rozmiar |
|---|---|---|
| A2.1 | **Mapa odpowiedzialności** (bez kodu): 67 wywołań hooków pogrupować w tabeli — dane, filtr i widok, zaznaczenie, nawigacja i nakładki, skróty, efekty uboczne. Dla każdej grupy: skąd bierze, komu daje. Zapis w `docs/index-mapa.md`. | S |
| A2.2 | **Efekty bez interfejsu** (nasłuchy, synchronizacja tytułu, skróty, deep-linki) do komponentów „bez widoku” montowanych obok, wzorem `PushScheduleSync`. Każdy osobno, z testem. | M |
| A2.3 | **Kontroler widoku:** `useNotesScreen()` zwraca `{ view, filtered, selection, actions }`; `Index` tylko rozdaje to do `AppHeader`, listy, `AddNoteBar`, nakładek. | M |
| A2.4 | **Nakładki** (czytnik, historia wersji, paleta, dialogi) do `IndexOverlays.tsx`, ładowane leniwie; stan otwarcia w jednym reduktorze, spięty z `overlayHistory`. | M |
| A2.5 | **Pomiar renderów:** przed i po — liczba renderów `Index` i listy przy wpisaniu znaku w wyszukiwarce i przy zmianie jednej notatki (React Profiler w teście). Cel: zmiana notatki nie renderuje nagłówka ani paska. | S |

## Etap A3: `exportNotes.ts`, `AddNoteBar.tsx`, `privateNotes.ts` (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| A3.1 | **`exportNotes.ts` → katalog `src/lib/backup/`:** `sections.ts` (rejestr `MERGE_SECTIONS`), `build.ts` (zbieranie kopii), `parse.ts` (walidacja, wersje do `MAX_BACKUP_VERSION`), `merge.ts` (scalanie), `download.ts` (zapis pliku — jedyne miejsce z DOM; przyda się gałąź natywna z F1.4). `exportNotes.ts` zostaje jako reeksport do czasu zamiany importów. Najpierw migawka: kopia z danych wzorcowych bajt w bajt taka sama przed i po. | M |
| A3.2 | **`AddNoteBar.tsx` (974):** reduktor szkicu do `src/lib/noteDraft.ts` z testami; tryby (tekst, lista, dyktowanie, szablon, załącznik) jako osobne komponenty; pasek zostaje powłoką. Uwaga na `playEnter` — szkic nie może się przemontować. | L |
| A3.3 | **`privateNotes.ts` (727):** rozdzielić kryptografię (czyste funkcje), magazyn kluczy i akcje interfejsu (`privateActions.ts` już istnieje). Obowiązkowo `security-reviewer`; żadnej zmiany formatu. | M |
| A3.4 | **`NoteReader.tsx`, `CommandPalette.tsx`:** tylko jeśli zostanie czas — wydzielić źródła poleceń palety do rejestru (`src/lib/commands/`), żeby działy dopisywały polecenia bez edycji palety. | M |

## Etap A4: testy i CI (Sonnet + `testing-engineer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| A4.1 | **Zielona baza:** pełne `npm run test:e2e` na obecnym `master`; każda porażka naprawiona albo opisana w `docs/e2e-znane.md` z przyczyną. Warunek startu F3, A2, A3. | M |
| A4.2 | **Podział w CI:** macierz 4 fragmentów (`--shard=i/4`) dla e2e, osobne zadanie `@smoke` (34 testy) jako szybka bramka; pełne tylko na `master` i na żądanie. Raport blob scalany na końcu. | S |
| A4.3 | **Bez `waitForTimeout`:** zamiana na oczekiwanie na stan (`expect.poll`, `toBeVisible`, zdarzenie `transitionend`); w testach pomiarowych zostają z komentarzem. Reguła lint `playwright/no-wait-for-timeout` jako ostrzeżenie, potem błąd. | M |
| A4.4 | **Równoległość lokalnie:** sprawdzić, dlaczego `workers: 1` (wspólny IndexedDB? port?); jeśli testy są odizolowane kontekstem, podnieść do 2–3 przez `PW_WORKERS`. Pamiętać o pamięci RAM — wcześniej pełne e2e padało z jej braku. | S |
| A4.5 | **Testy własności dla scalania:** `fast-check` — dwa dokumenty Yjs z losowymi operacjami na notatkach, scalone w obie strony, dają tę samą projekcję; to samo dla kopii (`merge.ts`). | M |
| A4.6 | **Test „stara kopia”:** katalog `src/test/fixtures/backups/` z kopią z każdej wersji formatu (1, 2, 3); każda musi się wczytać. Dopisywać przy każdej zmianie formatu. | S |
| A4.7 | **Mutacyjne próbkowanie** (Stryker) tylko dla `src/lib/debts`, `src/lib/shifts/summary.ts`, `src/lib/ksef` — tam błąd w liczbach kosztuje pieniądze. Jednorazowo, wynik do `docs/`. | M |

## Etap A5: porządek repo (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| A5.1 | **Porzucone kopie robocze:** `.claude/worktrees` (855 MB). Sprawdzić, czy nie ma w nich niezacommitowanych zmian (`git status` w każdej), pokazać listę właścicielowi i usunąć **po jego zgodzie**. | S |
| A5.2 | **`opis.md` na działy:** `docs/opis/<dzial>.md` + `opis.md` jako spis treści z linkami. Zmienić zapis w `CLAUDE.md` (reguła dokumentacji wskazuje nowy układ). Wymaga zgody właściciela — to zmiana jego reguły. | M |
| A5.3 | **Stare plany:** przenieść zrobione `docs/plan-*.md` do `docs/archiwum/`; w `roadmap.md` zostają tylko otwarte punkty. | S |
| A5.4 | **119 kluczy `localStorage`:** rejestr `src/lib/storageKeys.ts` (nazwa, właściciel, czy w kopii, czy czyszczony przy resecie) + test, że żaden literał `"kaczy.*"` nie występuje poza rejestrem. Zamyka klasę błędów „ustawienie nie trafiło do kopii”. | M |
| A5.5 | **Zależności:** `npm audit`, `knip` (martwe eksporty i pliki) — raport, usuwanie w osobnych commitach. | S |

## Kolejność

A4.1 → A1 (odblokowuje regułę i upraszcza resztę) → F3 kroki 1–2 → A3.1 → A2 → A3.2, A3.3 → A4.2–A4.7 → A5.

## Decyzje właściciela

- **AR-1:** usunięcie `.claude/worktrees` (A5.1).
- **AR-2:** podział `opis.md` na pliki działów (A5.2).
- **AR-3:** pełne e2e tylko na `master` w CI, a na gałęziach `@smoke` (A4.2).

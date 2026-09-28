# Dziennik wdrażania funkcji

Plan powstał po analizie rynku aplikacji do przypomnień/notatek (Google Play) i porównaniu
z tym, co już istnieje w kodzie Notatnika. Duża część "oczywistych" funkcji (powtarzalne
przypomnienia, checklisty, eksport/import, tryb Pomodoro, szablony, statystyki, tagi) już
była zaimplementowana — poniższa lista to realne, brakujące luki.

## Kolejka zadań

1. ✅ **Priorytety notatek** (niski/średni/wysoki + sortowanie/filtrowanie) — zrobione 2026-09-24
2. ✅ **Szybkie wpisywanie dat językiem naturalnym w przypomnieniach** ("jutro 15:00", "za 2h") — zrobione 2026-09-24
3. ✅ **Prawdziwsze powiadomienia przez Service Worker** (działają lepiej w tle/PWA) — zrobione 2026-09-24
4. ✅ **Widok „Nadchodzące"** — agenda przypomnień posortowana chronologicznie, w grupach — zrobione 2026-09-28

---

## Task 1 — Priorytety notatek

**Data:** 2026-09-24
**Status:** ✅ Ukończone i przetestowane w przeglądarce (claude-in-chrome)

### Co zrobiono
- Nowy typ `NotePriority` (`none | low | medium | high`) w `src/lib/notePriority.ts` —
  etykiety PL, kolejność sortowania, klasy kolorów (niebieski/pomarańczowy/czerwony).
- Pole `priority: NotePriority` dodane do modelu `Note` (`src/hooks/useNotes.ts`), domyślnie
  `"none"` przy tworzeniu notatki (`addNote`).
- Walidacja w `src/lib/noteSchema.ts` (import/eksport pełnego backupu) — pole opcjonalne
  z fallbackiem `"none"` dla starych danych bez priorytetu.
- Nowy komponent `src/components/PriorityPicker.tsx` — przycisk z ikoną flagi + popover
  wyboru priorytetu (wzorowany na `ReminderPicker`), plus `PriorityBadge` do wyświetlania
  plakietki na karcie notatki.
- Integracja w `NoteCard.tsx` (pasek akcji + plakietka obok przypomnienia) i `AddNoteBar.tsx`
  (możliwość ustawienia priorytetu już przy tworzeniu notatki).
- Sortowanie po priorytecie: `SortKey` rozszerzony o `"priority"` w `viewPrefs.ts`,
  logika w `useFilteredNotes.ts`.
- Filtrowanie po priorytecie: `filterPriority` w `viewPrefs.ts` + UI w `ViewControls.tsx`
  (sekcja "Priorytet" w panelu filtrów, obok koloru i etykiety).

### Pliki zmienione
- `src/lib/notePriority.ts` (nowy)
- `src/components/PriorityPicker.tsx` (nowy)
- `src/hooks/useNotes.ts`
- `src/lib/noteSchema.ts`
- `src/components/NoteCard.tsx`
- `src/components/AddNoteBar.tsx`
- `src/lib/viewPrefs.ts`
- `src/hooks/useFilteredNotes.ts`
- `src/components/ViewControls.tsx`
- `src/hooks/useFilteredNotes.test.ts`, `src/lib/exportNotes.test.ts` (helpery testowe
  uzupełnione o pole `priority`)

### Testy
- `npx tsc --noEmit` — czysto.
- `npx vitest run` — 95/95 testów przechodzi.
- Test manualny w przeglądarce (claude-in-chrome): otwarcie popovera priorytetu na karcie,
  zmiana priorytetu (zapis potwierdzony toastem „Zapisano"), plakietka priorytetu widoczna
  na karcie, panel filtrów pokazuje sekcję „Priorytet" z kolorowymi flagami i poprawnie
  filtruje notatki. Brak błędów w konsoli.

---

## Task 2 — Naturalny język w przypomnieniach

**Data:** 2026-09-24
**Status:** ✅ Ukończone i przetestowane w przeglądarce (claude-in-chrome)

### Co zrobiono
- Nowy parser `src/lib/parseNaturalDate.ts` — rozpoznaje polskie wyrażenia czasu:
  `za X h/godz/min/dni`, `dziś/dzisiaj [HH:MM]`, `jutro [HH:MM]`, `pojutrze [HH:MM]`,
  nazwy dni tygodnia (`poniedziałek 9:00` — najbliższe przyszłe wystąpienie),
  samą godzinę (`15:30` — dziś, jeśli jeszcze nie minęła, inaczej jutro). Zwraca `null`
  dla nierozpoznanego tekstu lub niepoprawnej godziny.
- Pole szybkiego wpisywania + przycisk z ikoną różdżki dodane do obu istniejących
  popoverów przypomnień: `src/components/ReminderPicker.tsx` (używany na karcie notatki)
  i `src/components/AddNoteBar.tsx` (osobna, zduplikowana implementacja popovera przy
  tworzeniu nowej notatki — oba miejsca zaktualizowane dla spójności). Wpisany tekst
  parsowany na Enter lub kliknięcie przycisku; przy sukcesie ustawia datę/godzinę w
  istniejącym kalendarzu i polu godziny (użytkownik nadal klika „Zapisz”/„Ustaw”
  żeby potwierdzić). Błąd parsowania pokazuje czerwoną ramkę i komunikat pod polem.

### Pliki zmienione
- `src/lib/parseNaturalDate.ts` (nowy)
- `src/lib/parseNaturalDate.test.ts` (nowy, 13 testów)
- `src/components/ReminderPicker.tsx`
- `src/components/AddNoteBar.tsx`

### Testy
- `npx tsc --noEmit` — czysto.
- `npx vitest run` — 108/108 testów przechodzi (13 nowych dla parsera).
- Test manualny w przeglądarce (claude-in-chrome): w popoverze przypomnienia przy
  tworzeniu notatki wpisano „jutro 15:00”, kliknięto różdżkę — kalendarz podświetlił
  poprawny dzień (25 zamiast dzisiejszego 24), pole godziny ustawiło się na 15:00,
  kliknięcie „Ustaw” zapisało przypomnienie bez błędów w konsoli.

---

## Task 3 — Prawdziwsze powiadomienia przez Service Worker

**Data:** 2026-09-24
**Status:** ✅ Ukończone (build zweryfikowany, testy automatyczne przechodzą)

### Co zrobiono
- `useReminderNotifications.ts` — zamiast gołego `new Notification()` (wymaga żywej,
  odpalonej strony), powiadomienie jest teraz wysyłane przez `navigator.serviceWorker.ready`
  → `registration.showNotification()`, co działa też gdy zainstalowana PWA działa w tle.
  Fallback na `new Notification()` gdy SW niedostępny (np. dev bez rejestracji SW).
  Dodano `tag`/`renotify` (id notatki) żeby powtórki nie stackowały duplikatów, oraz ikonę
  `pwa-192.png`/`badge`.
- Nowy `public/sw-notifications.js` — słuchacz `notificationclick` w service workerze:
  fokusuje istniejącą kartę appki albo otwiera nową (`clients.openWindow("/")`).
- `vite.config.ts` — `workbox.importScripts: ["sw-notifications.js"]`, żeby generowany
  przez `vite-plugin-pwa` `sw.js` doklejał ten plik (`importScripts`) bez przechodzenia
  na strategię `injectManifest`.

### Ograniczenie
To wciąż nie jest prawdziwy push — bez backendu przypomnienia są sprawdzane cyklicznie
(`setInterval` co 15s) w otwartej karcie/instancji PWA, więc przy całkowicie zamkniętej
appce (karta zamknięta, proces zabity) powiadomienie się nie pojawi. Zmiana poprawia
zachowanie w tle/przy zainstalowanej PWA i przy kliknięciu w powiadomienie (fokus okna),
ale pełne powiadomienia w tle wymagałyby Push API + serwera wysyłającego push.

### Pliki zmienione
- `src/hooks/useReminderNotifications.ts`
- `public/sw-notifications.js` (nowy)
- `vite.config.ts`

### Testy
- `npx tsc --noEmit` — czysto.
- `npx vitest run` — 108/108 testów przechodzi (bez zmian w liczbie testów, brak
  dedykowanych testów dla tego hooka).
- `npx vite build` — potwierdzono, że `dist/sw.js` zawiera wstrzyknięty
  `importScripts("sw-notifications.js")` i listener `notificationclick`.

---

## Task 4 — Widok „Nadchodzące" (agenda przypomnień)

**Data:** 2026-09-28 (commit `552ef84`)
**Status:** ✅ Ukończone (testy jednostkowe + e2e kalendarza)

### Co zrobiono
- Zamiast osobnego widoku istniejący widok „Przypomnienia” stał się agendą — nowy
  `src/lib/reminderAgenda.ts` z `groupReminders()`: notatki z przypomnieniem sortowane
  po terminie rosnąco i dzielone na grupy **Zaległe / Dziś / Najbliższe 7 dni / Później**
  (puste grupy pomijane). Sortowanie z ustawień jest tu celowo ignorowane — po dacie
  edycji jutrzejszy termin chowałby się pod zeszłomiesięcznym.
- `useFilteredNotes.ts` — w widoku przypomnień lista jest płaska (bez podziału na
  przypięte), jak w koszu; grupowanie robi `Index.tsx`, nagłówek „Zaległe” w kolorze
  `destructive`.
- Drzemka w toaście: nowy `src/components/ReminderDueToast.tsx` podpięty w
  `useReminderNotifications.ts` — przyciski **Odłóż 10 min**, **Jutro 9:00**, **Gotowe**
  i **Otwórz**. Terminy liczy `snoozeTimes()`. Odłożenie przesuwa termin w przyszłość,
  więc `reconcileFired` zdejmuje wpis „już odpalone” i przypomnienie wystrzeli ponownie.
  Dla przypomnień powtarzalnych drzemka jest ukryta (kolejny termin serii jest już ustawiony).
- `e2e/reminders-calendar.spec.ts` — zegar zamrożony przez `page.clock.setFixedTime`,
  więc test kalendarza nie zależy od dzisiejszej daty.

### Pliki zmienione
- `src/lib/reminderAgenda.ts` (nowy), `src/lib/reminderAgenda.test.ts` (nowy, 3 testy)
- `src/components/ReminderDueToast.tsx` (nowy)
- `src/hooks/useReminderNotifications.ts`
- `src/hooks/useFilteredNotes.ts`
- `src/pages/Index.tsx`
- `e2e/reminders-calendar.spec.ts`

### Uwaga
`src/components/ReminderToast.tsx` („Nie teraz / Drzemka 10 min / Pokaż”) zostaje —
używają go dzienne/tygodniowe podsumowania w `useDailyWeeklyNudges.tsx`, nie przypomnienia
konkretnych notatek.

---

## Poza kolejką: rebranding logo (na żądanie użytkownika, 2026-09-24)

Podmieniono logo kaczki na animowany kufel piwa (`src/components/BeerMugLogo.tsx` — czyste
SVG + framer-motion, pęcherzyki unoszące się w płynie) oraz nazwę aplikacji z "KACZY" na
"NOTATKI PIJACKIE" w sidebarze, headerze, stopce, `index.html` i `manifest.webmanifest`.
Drobne easter-eggi z kaczką (np. żarty w powiadomieniach, cytat dnia) pozostały bez zmian.

---

## Poza kolejką: koniec kaczki (na żądanie użytkownika, 2026-09-27)

Rebranding z 2026-09-24 ominął pusty stan: `EmptyState.tsx` dalej ładował
`src/assets/duck-logo.png` — ostatnie miejsce z kaczką w UI. PNG usunięty,
a w jego miejsce wszedł `src/components/NotatnikWordmark.tsx`: słowo „Notatnik"
wypisuje się odręcznie, litera po literze (osobne ścieżki SVG animowane przez
`pathLength`), kropka nad „i" dochodzi sprężynką, na końcu jedno pociągnięcie
podkreślenia w kolorze `--primary`, a za napisem mruga kursor tekstowy.

Czyste SVG zamiast obrazka: ostre w każdej skali, kolory z motywu (sprawdzone
zrzutami w trybie jasnym i ciemnym), zero wagi w bundlu, a przy
`prefers-reduced-motion` renderuje od razu stan końcowy bez animacji.

Pierwsza wersja miała jeszcze tło kartki w linie z czerwonym marginesem —
usunięte, bo przy realnym kontraście i poświacie pod spodem było niewidoczne.

Uwaga: aplikacja nazywa się „NOTATKI PIJACKIE”, więc wordmark „Notatnik” w pustym
stanie jest świadomym wyborem użytkownika, nie spójną nazwą marki.

---

## Poza kolejką: praca 2026-09-25 – 2026-09-28 (skrót)

Po zamknięciu kolejki prace szły według `roadmap.md` — tam jest pełny opis każdej
pozycji (pliki, decyzje, testy). Poniżej tylko mapa: co powstało i gdzie szukać szczegółów.

### Synchronizacja między urządzeniami (roadmap: „Propozycje rozbudowy” pkt 1, „Kierunki — architektura”)
- **Yjs jako warstwa danych** (`yjsStore.ts`, `y-indexeddb`) + **P2P przez `y-webrtc`**
  z parowaniem kodem/QR (`yjsSync.ts`, zakładka „Sync”).
- **Item-level CRDT checklist**, **P2P sync obrazów** (`imageSync.ts`, manifest `imageHashes`),
  gotowy **self-hosted serwer sygnalizacyjny** w `signaling-server/` (niewpięty domyślnie).
- **Synchronizacja przez plik** (`yjsFileSync.ts`) — scalanie CRDT bez jednoczesnego online,
  obok destrukcyjnego „Przywróć z backupu”.
- **Edycja względem bazy po tożsamościach znaków** (`yTextEdit.ts`) — zapis nie kasuje
  współbieżnych zmian peera; **tekst peera na żywo** w otwartym edytorze (`useLiveNoteText.ts`).
- **Inkrementalna projekcja Yjs** — stabilne referencje notatek, `memo(NoteCard)` działa.

### Kalendarz przypomnień (roadmap: „Kalendarz przypomnień — plan”, etapy 1–7)
- Widok kalendarza pod `lazy()`: siatka miesiąca, panel dnia, dodawanie/edycja/usuwanie
  terminu, uczciwa semantyka serii, przeciąganie terminów, test 320 px.
- **Eksport `.ics`** (`icsExport.ts`, `RRULE` + `VALARM`) — kalendarz systemowy przypomni
  także przy zamkniętej appce.

### Edycja, nawigacja, wyszukiwanie (roadmap: „Plan rozbudowy — 2026-09-27”)
- **Autosave** (`useDraftAutosave`, zapis przy odmontowaniu — suwak w Ustawieniach wreszcie działa)
  i **pełnoekranowy edytor** notatki (ten sam szkic i sesja Yjs co kafel).
- **Stan widoku w adresie** (`viewRoute.ts`: `/folder/:id`, `/etykieta/:nazwa`, `/notatka/:id`, `?q=`),
  działający „wstecz”, **link do notatki**, powiadomienie otwiera konkretną notatkę.
- **Command Palette** otwiera notatki i widzi całą bazę; **wyszukiwanie globalne**
  („Brak wyników w Notatkach — 1 w Archiwum”), wyszukiwanie w Koszu i w checklistach,
  ściągawka operatorów `label:`/`color:`/`has:`.
- Nowa notatka w folderze/etykiecie trafia do tego folderu/etykiety.

### Dane i niezawodność
- **Wersje notatek w IndexedDB** (`versionsStore.ts`) zamiast `localStorage`.
- **Pełny backup v2** (wersje, ustawienia bez kodu parowania, osiągnięcia) z wyborem sekcji
  przy przywracaniu; **uczciwy auto-backup** (bez udawanego pobrania w tle).
- **Backup do jednego nadpisywanego pliku** (File System Access API).
- **Lokalna diagnostyka** (`diagnostics.ts`) — dziennik błędów w pamięci, raport do pobrania
  bez treści notatek, `lastSyncedAt`/`lastError` w stanie synchronizacji.
- Audyt PWA: `storage.persist()`, `shortcuts`/`share_target` w manifeście, ikony bez białego
  tła, działające e2e (wcześniej cały pakiet się nie uruchamiał).

### Wydajność i porządki
- Code-splitting (StatsDialog, SyncSettings, CommandPalette, `y-webrtc`, jsPDF) — eager JS
  z ~1,5 MB do ~1,1 MB; regresję pilnuje `e2e/bundle.spec.ts`.
- Martwy kod i zależności usunięte, `Index.tsx` i `SettingsDialog.tsx` rozbite, `NoteCard`
  z 20 do 5 propsów, toasty zunifikowane na Sonner, configi Vercel/Netlify (bez wdrożenia).

### Wygląd (roadmap: „Audyt UI/UX i layoutu”, fazy 1–3)
- Kontrast AA (`muted-foreground`, ciemny tekst na `--primary`), skala tekstu, jeden system
  cieni i promieni, spokojniejsze tło i budżet ruchu, jeden focus ring, ciszsza gamifikacja,
  skrypt zrzutów przed/po (`scripts/screenshots.mjs`).

### Co dalej
Otwarta jest **Runda 8** (roadmap: „Stan Rundy 8”): agenda przypomnień (Task 4 wyżej) i
**notatka dnia** (chip „Notatka dnia” zamiast szablonu „Dziennik”, pole `dailyDate`,
`src/lib/dailyNote.ts` — 2026-09-28) są zrobione. Zostały **autouzupełnianie `[[` +
backlinki w karcie** oraz **hardening parowania** (SHA-256 + 12-znakowy kod).

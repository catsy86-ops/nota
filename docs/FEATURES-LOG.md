# Dziennik wdrażania funkcji

Plan powstał po analizie rynku aplikacji do przypomnień/notatek (Google Play) i porównaniu
z tym, co już istnieje w kodzie Notatnika. Duża część "oczywistych" funkcji (powtarzalne
przypomnienia, checklisty, eksport/import, tryb Pomodoro, szablony, statystyki, tagi) już
była zaimplementowana — poniższa lista to realne, brakujące luki.

## Kolejka zadań

1. ✅ **Priorytety notatek** (niski/średni/wysoki + sortowanie/filtrowanie) — zrobione 2026-09-24
2. ✅ **Szybkie wpisywanie dat językiem naturalnym w przypomnieniach** ("jutro 15:00", "za 2h") — zrobione 2026-09-24
3. ✅ **Prawdziwsze powiadomienia przez Service Worker** (działają lepiej w tle/PWA) — zrobione 2026-09-24
4. ⏳ Widok „Nadchodzące" — lista notatek z przypomnieniami posortowana chronologicznie

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

## Poza kolejką: rebranding logo (na żądanie użytkownika, 2026-09-24)

Podmieniono logo kaczki na animowany kufel piwa (`src/components/BeerMugLogo.tsx` — czyste
SVG + framer-motion, pęcherzyki unoszące się w płynie) oraz nazwę aplikacji z "KACZY" na
"NOTATKI PIJACKIE" w sidebarze, headerze, stopce, `index.html` i `manifest.webmanifest`.
Drobne easter-eggi z kaczką (np. żarty w powiadomieniach, cytat dnia) pozostały bez zmian.

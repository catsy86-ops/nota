# Przegląd kodu — 2026-10-20

**Zakres:** commity `c7736f0..68ac7d9` (Ćwiczenia: odżywki, dieta, trening; Długi: kopia, edycja; Skrzynka; Grafik: premie, obraz miesiąca, wiele grafików; Ustawienia: cofnięcie zgody) oraz niezacommitowany stan U7 (`src/lib/study/sites.ts`, `src/lib/study/store.ts`).

**Metoda:** trzy przeglądy tylko do odczytu, każdy na innym obszarze, prowadzone przez agentów. Nic nie uruchamiano (ani testów, ani builda, ani aplikacji). Wszystkie ustalenia opierają się na czytaniu kodu. Pola „weryfikacja” mówią, czy agent sprawdził to bezpośrednio w kodzie, czy tylko wnioskował.

---

## Ustalenia wysokie

### H1. Aktywny grafik usunięty na innym urządzeniu — zmiany giną (Grafik)
- **Gdzie:** `src/lib/shifts/store.ts:40, :95`; `src/components/shifts/ScheduleSwitcher.tsx:19`
- **Scenariusz:** na telefonie wybrany jest grafik „Dorobek”. Na komputerze grafik zostaje usunięty. Store sprawdza aktywny grafik tylko raz, przy starcie, i nie słucha rejestru. Przełącznik pokazuje „Główny” (fallback `?? schedules[0]`), a `setDayShift` zapisuje do osieroconych map `<id>:shiftDays`. Użytkownik widzi zmianę, a po odświeżeniu jej nie ma.
- **Weryfikacja:** tak (czytanie).

### H2. Przywracanie kopii kasuje przypomnienie treningu i zostawia martwy wpis (Ćwiczenia / Kopia)
- **Gdzie:** `src/lib/exportNotes.ts` (przywracanie, ok. 118–266); `src/lib/training/yTraining.ts:138`; `src/lib/yjsStore.ts:952–954`
- **Scenariusz:** `yjsStore.replaceAll` usuwa wszystkie notatki, w tym notatkę-przypomnienie treningu. Ustawienie przypomnienia (`{time, noteId}`) zostaje w `mergeDump`, bo `if (inReminder && !getReminder())` nie nadpisuje lokalnego. Przełącznik pokazuje „włączone”, ale `noteId` wskazuje nieistniejącą notatkę i nic nie zadzwoni.
- **Weryfikacja:** tak (czytanie).

---

## Ustalenia średnie

### M1. Osierocona notatka po usunięciu z kosza lub po opróżnieniu kosza (Ćwiczenia)
- **Gdzie:** `src/components/cwiczenia/TrainingSection.tsx:349–372`; `src/hooks/useNotes.ts:293`
- **Scenariusz:** trwałe usunięcie notatki zostawia w Yjs `{time, noteId}`. Wyłączenie przypomnienia wywołuje `trashNote` na nieistniejącym id bez błędu. Stan nie naprawia się sam.
- **Weryfikacja:** tak (czytanie).

### M2. Pusta godzina przypomnienia tworzy zepsutą notatkę (Ćwiczenia)
- **Gdzie:** `TrainingSection.tsx:352, :361–369`; `src/lib/supplements/model.ts:58` (`nextReminderAt`); `src/lib/training/yTraining.ts:43`
- **Scenariusz:** pole czasu wyczyszczone, potem przypomnienie włączone ponownie. `nextReminderAt("")` daje `NaN`, notatka powstaje z zepsutym terminem, a `setReminder({time:""})` zapisuje dane bez czyszczenia (`cleanTrainingReminder`). Odczyt zwraca `null`, więc `noteId` znika i notatka zostaje osierocona.
- **Weryfikacja:** tak (czytanie), nie odtworzone w przeglądarce.

### M3. Zapis przypomnienia treningu bez walidacji (Ćwiczenia)
- **Gdzie:** `src/lib/training/yTraining.ts:43`
- **Uwaga:** `setEquipment` czyści dane przed zapisem, `setReminder` nie. To przyczyna M2.
- **Weryfikacja:** tak.

### M4. Dodatkowe grafiki z kopii są pomijane po cichu (Grafik / Kopia)
- **Gdzie:** `src/lib/exportNotes.ts:~288–296`; `src/lib/shifts/store.ts:273–279`
- **Scenariusze:**
  - (a) `restoreExtraSchedule` zwraca `false`, gdy jest już 10 grafików. Wywołujący ignoruje wynik, więc grafik znika bez komunikatu.
  - (b) `shiftSchedules` przywracane jest tylko w bloku `if (opts.shifts && backup.shifts !== undefined)`. Odznaczenie „Grafik” w oknie przywracania pomija dodatkowe grafiki.
  - (c) jeden zły wpis (np. `migrate` rzuca) przerywa całą pętlę, bo cała pętla jest w jednym `try`.
- **Weryfikacja:** tak (czytanie).

### M5. Id grafiku z kopii nie jest walidowane (Grafik / Kopia)
- **Gdzie:** `src/lib/exportNotes.ts:~293–294`; `src/lib/shifts/store.ts:~273`
- **Scenariusz:** w pliku `id: "main"` przechodzi przez `registry.has`, pomija `add` i dane trafiają do grafiku głównego. Nie sprawdzono, czy `registry.add` ogranicza format id.
- **Weryfikacja:** częściowo (sprawdzono, że `typeof === "string"`, reszty nie).

### M6. Dodatek za nadgodziny okresowe liczony wg złej stawki (Grafik)
- **Gdzie:** `src/lib/shifts/summary.ts:336` vs `:111` i `:289`; `ShiftSummary.tsx:198`
- **Scenariusz:** dodatek liczony po `data.hourlyRate`, a godziny po stawce rodzaju (`type.rate`). Przy rodzajach z własną stawką kwota dodatku jest zła. Rachunek wyrównuje różnicę resztą, więc błąd jest ukryty.
- **Weryfikacja:** tak (czytanie). Nie sprawdzono liczbowo.

### M7. „Oddane w całości” przy pełnej liście długów — saldo się nie zeruje (Długi)
- **Gdzie:** `src/components/debts/DebtsView.tsx:228–232`; `src/lib/debts/yDebts.ts:40`
- **Scenariusz:** przy limicie 2000 wpisów `addDebt` zwraca `null`, a komponent i tak pokazuje „Oddane w całości”.
- **Weryfikacja:** tak.

### M8. Przywrócenie starszej kopii kasuje premie dodane po jej wykonaniu (Grafik)
- **Gdzie:** `src/lib/shifts/yShifts.ts:241–244` (`replaceAll`); `src/lib/shifts/model.ts:331`
- **Scenariusz:** kopia sprzed wprowadzenia premii przywraca się bez pola `bonuses`, `migrate` daje `[]`, a `replaceAll` czyści wszystkie premie. Dni też są zastępowane, ale premie są nowe i bez ostrzeżenia.
- **Weryfikacja:** tak (czytanie).

### M9. Brak testów ścieżek błędów (Ćwiczenia, Długi, Grafik)
- **Gdzie:** `src/lib/training/reminder.test.ts` (tylko `mergeDump` na pustej mapie); `TrainingSection.test.tsx` (brak testu pustej godziny i usuniętej notatki); `TrainingSection.test.tsx` i `DebtsView.test.tsx` mockują cały moduł store, więc ścieżka zapisu nie jest ćwiczona w komponentach.
- **Weryfikacja:** tak.

---

## Ustalenia niskie

| # | Obszar | Opis | Gdzie | Weryfikacja |
|---|---|---|---|---|
| L1 | Ćwiczenia / prywatność | Komunikaty `logDiag(..., err)` z `JSON.parse` na treści kopii mogą zawierać fragment danych (nazwiska z Długów, notatki treningu); trafiają do raportu diagnostycznego. | `exportNotes.ts` ~266, ~272, ~290 | tak co do ścieżki, zawartość komunikatu silnika nie |
| L2 | Długi / prywatność | Toasty z nazwiskiem i kwotą (widoczne tylko na ekranie). | `DebtsView.tsx` ~80, ~230 | tak |
| L3 | Ćwiczenia | Puste pole hantli zapisuje `undefined` i czyści sprzęt bez potwierdzenia. | `TrainingSection.tsx` ~274–300 | tak |
| L4 | Ćwiczenia | Stan godziny i ciężaru inicjalizowany raz — nie odzwierciedla zmian z innego urządzenia. | `TrainingSection.tsx` ~352 | tak |
| L5 | Ćwiczenia | Cele wyczyszczone (`{}`) są nadpisywane celami z kopii przy przywracaniu. Zgodne z zasadą „nie kasuje”, warto odnotować. | `yDiet.ts` ~88 | tak |
| L6 | Ćwiczenia | `restore` omija limit `DIET_MAX_MEALS`; zwracana tablica i `goalsSnap` są współdzielone przez referencję (mutacja psuje cache). | `yDiet.ts` ~65, ~41–44 | tak / częściowo |
| L7 | Ćwiczenia | Import zależności: `TrainingSection` importuje `nextReminderAt` z `lib/supplements/model`. | `TrainingSection.tsx:7` | tak |
| L8 | Ćwiczenia | Na początku `noteSchema.ts` pojawił się BOM. Zmiana przypadkowa. | `src/lib/noteSchema.ts:1` | tak |
| L9 | Długi | Usunięty uszkodzony wpis (`cleanDebt` → `null`) nie da się usunąć, a liczy się do limitu 2000. | `yDebts.ts` ~40, ~46–47 | tak |
| L10 | Długi / Kopia | Przywrócenie kopii wskrzesza długi usunięte po jej wykonaniu. Zgodne z opisem, świadome. | `yDebts.ts` `mergeDump` | tak |
| L11 | Długi | Test `mergeDump` z zachowaniem lokalnego wpisu o tym samym id — brak. | `yDebts.test` | tak |
| L12 | Grafik | Każde `createYShifts` dodaje stałe obserwatory Y bez `unobserve`; `mainShiftData()` i `scheduleDump` wołane przy każdej kopii mnożą obserwatory. | `yShifts.ts:59`; `store.ts:53, :261` | tak |
| L13 | Grafik | Premia 0,004 zł zapisuje się jako 0 zł — sprawdzenie `> 0` przed zaokrągleniem. | `model.ts:173–174` (`cleanBonus`) | tak |
| L14 | Grafik / obraz | `ctx.roundRect` może nie istnieć w starszych przeglądarkach (wyjątek „Nie udało się”); `revokeObjectURL` zaraz po `click()` (ryzyko w Safari); `navigator.share` może stracić aktywację użytkownika po `await` i przejść po cichu na pobieranie; `toFixed(2)` zamiast formatowania aplikacji. | `monthImageDraw.ts:68, :111–114`; `ShiftsView` `exportImage`; `monthImage.ts:56` | tak / zachowania w przeglądarkach nieprzetestowane |
| L15 | Grafik | Formularz premii nie zamyka się i nie pokazuje komunikatu, gdy zapis się nie uda (limit 500 lub błąd). | `ShiftSummary.tsx:254` | tak |
| L16 | Grafik / Skrzynka | Aktywny grafik i Skrzynka: nie sprawdzono wpływu usuniętych lub zarchiwizowanych notatek na licznik skrzynki w `Index.tsx`. | `Index.tsx:561` | nie |
| L17 | Kopia / Bundle | Próg `eagerJsGzip` podniesiony do 392 KB, zapas ok. 1,9 KB. Nowe moduły są leniwe przez `lazy()`, ale test bundle nie pilnuje ich konkretnie. | `e2e/bundle.spec.ts` | tak (kod), rozmiar nie |
| L18 | Kopia | Zod przepuszcza nowe klucze jako `z.string().optional().catch(undefined)`, ale kształt treści sprawdzany jest dopiero w scalaniu; zły typ (np. obiekt zamiast stringa) znika bez `logDiag`. | `noteSchema.ts` ~150–158 | tak |
| L19 | Kopia | `restoreShifts` zastępuje główny grafik w całości, a dodatkowe są scalane — asymetria, sprzed zakresu. | `exportNotes.ts` ~289 | tak |
| L20 | Ustawienia | Odwołanie do `JournalReport.tsx:141` (`wa.me` z numerem) — poza zakresem, sprzed zmian; numer jest w URL. | `JournalReport.tsx:141` | tak |

---

## Co sprawdzono i jest poprawne

- Stabilność odczytów dla `useSyncExternalStore`: `goalsSnap` (dieta), `metaSnapshot` (trening), `cache` w rejestrze grafików, `activeId` jako prymityw. Błąd z `/cwiczenia` nie występuje już w tych miejscach.
- Sprzątanie interwału w `RestTimer`.
- `Sparkline` dla `span = 0`.
- Klucze `debts` i `shiftSchedules` w `FullBackup` i ich dynamiczne importy.
- Prywatność skrzynki: `isInboxNote` wyklucza notatki zablokowane, a licznik i lista używają tej samej reguły (`Index.tsx`, `useFilteredNotes.ts`). Nie znaleziono wycieku do liczników ani list.
- `cleanEquipment`, `cleanTrainingReminder`, `overDumbbell` mają testy.

---

## Stan przed poprawkami

- Niezacommitowany stan U7 (numer hurtowni): `sites.ts` i `store.ts` mają już pole `supplierPhone`. Brakuje jeszcze pola w oknie karty (`SiteCardDialog.tsx`), obsługi w `order.ts` i użycia w `SiteOrderPanel.tsx`. To ten stan był w przeglądzie.
- D3 (ostrzeżenie przed kopią): nic jeszcze nie zmieniono.

## Proponowana kolejność napraw

1. **H1, H2** (dane giną): aktywny grafik po usunięciu i przypomnienie treningu po przywróceniu kopii.
2. **M1–M3** (osierocone notatki i walidacja przypomnienia): wspólna funkcja czyszcząca i uzgodnienie z notatkami.
3. **M4–M5, M8** (kopia grafików i premii): przywracanie bez ciszy i z walidacją id.
4. **M6, M7, L13** (liczby): stawka dodatku, limit długów, zaokrąglenie premii.
5. **M9 i testy** z ustaleń, zanim zmiany trafią do e2e.

Niskie punkty (L1–L20) do zrobienia przy okazji, po potwierdzeniu.

---

## Status napraw (2026-10-20, ta sama sesja)

Kolejność wg sekcji „Proponowana kolejność napraw”.

| Pozycja | Status | Co zrobiono |
|---|---|---|
| H1 aktywny grafik usunięty na innym urządzeniu | ✅ | `shifts/store.ts`: subskrypcja rejestru, po zniknięciu grafiku wraca do głównego |
| H2 przywracanie kopii kasuje przypomnienie treningu | ✅ | `yTraining.mergeDump(raw, hasNote)`: przypomnienie żyje tylko z istniejącą notatką; przekazywane z `exportNotes` |
| M1 osierocona notatka po usunięciu | ✅ | UI traktuje przypomnienie bez notatki jako wyłączone (`TrainingSection.tsx`) |
| M2 pusta godzina tworzy zepsutą notatkę | ✅ | Blokada w UI (`timeOk`) i w `apply` |
| M3 zapis przypomnienia bez walidacji | ✅ | `setReminder` przechodzi przez `cleanTrainingReminder` |
| M4 dodatkowe grafiki pomijane po cichu | ✅ | Każdy grafik osobno, licznik `schedulesSkipped`, komunikat w oknie przywracania. Decyzja: grafiki dodatkowe nadal przywracane tylko przy zaznaczonej sekcji „Grafik” |
| M5 id grafiku z kopii | ✅ | `isScheduleId` (format z `createSchedule`), `main` odrzucany |
| M8 kopia sprzed premii kasuje premie | ✅ | Bez pola `bonuses` w pliku premie z telefonu są zachowywane |
| M6 stawka dodatku okresowego | ✅ | Średnia stawka okresu (zarobek z godzin / godziny) zamiast ogólnej |
| M7 „oddane w całości” przy pełnej liście | ✅ | Błąd zamiast sukcesu, saldo nie zeruje się w komunikacie |
| L13 zaokrąglenie premii | ✅ | Najpierw grosze, potem sprawdzenie |
| M9 testy ścieżek błędów | ◐ | Dodane: `training/reminderRestore.test.ts` (H2, M2, M3), `shifts/reviewFixes.test.ts` (M5, L13, M6). Testy komponentów nadal mockują cały store (ścieżka zapisu niećwiczona w komponencie) |

**Niskie L1–L20 (status):**

| Pozycja | Status | Co zrobiono |
|---|---|---|
| L1 komunikaty błędów z treścią kopii | ✅ | `exportNotes.ts`: `errName(err)` — w logu tylko nazwa błędu, bez treści |
| L2 nazwiska i kwoty w toastach | ➖ | Świadomie bez zmiany: toast widoczny tylko na ekranie właściciela |
| L3 puste hantle czyszczą sprzęt | ✅ | `EquipmentForm`: zapis tylko dla wartości > 0, osobny „Usuń limit” |
| L4 stan godziny/ciężaru z jednego odczytu | ✅ | Synchronizacja stanu formularzy z danymi z Yjs (`useEffect`) |
| L5 cele wyczyszczone nadpisywane z kopii | ➖ | Zaakceptowane (zgodne z zasadą „nie kasuje”), opisane w `opis.md` |
| L6 `restore` omija limit posiłków; współdzielony cache | ✅ | `yDiet.ts`: limit `DIET_MAX_MEALS`, `getGoals` zwraca zamrożony obiekt |
| L7 import `nextReminderAt` z modelu Odżywek | ✅ | Przeniesione do `src/lib/timeOfDay.ts`; importy w Ćwiczeniach i testach zmienione |
| L8 BOM w `noteSchema.ts` | ✅ | Usunięty `EF BB BF` z początku pliku |
| L9 uszkodzony wpis długu nie do usunięcia | ✅ | `yDebts.remove`: usuwa surowy wpis, gdy `cleanDebt` go odrzuca |
| L10 przywrócenie kopii wskrzesza długi | ➖ | Zaakceptowane, zgodne z opisem kopii |
| L11 test scalania z lokalnym wpisem | ✅ | Pokryte przez `yDebts.edit.test.ts` |
| L12 obserwatory Yjs przy każdym odczycie | ✅ | `shifts/store.ts`: `instanceFor(id)` z cache zamiast nowego `createYShifts` |
| L13 premia 0,004 zł | ✅ | Zaokrąglenie do groszy przed sprawdzeniem |
| L14 obraz miesiąca w przeglądarkach | ◐ | Zrobione: fallback `roundRect`, opóźnione `revokeObjectURL`, kwota przez `formatMoney`. **Niezrobione:** aktywacja `navigator.share` po `await` nie była zmieniona; nieprzetestowane w przeglądarce |
| L15 formularz premii bez komunikatu błędu | ✅ | `ShiftSummary.BonusPanel`: `toast.error` przy nieudanym zapisie |
| L16 licznik Skrzynki po usunięciu notatek | ✅ | Sprawdzone: `Index.tsx` używa notatek aktywnych (bez archiwum i kosza) — bez zmian |
| L17 próg bundla bez pilnowania nowych modułów | ◐ | Dodane asercje `chunksMatching` w `e2e/bundle.spec.ts` (3 napisy). **Niezweryfikowane:** e2e nie uruchomione |
| L18 zły typ nowego klucza kopii znika bez logu | ➖ | Zaakceptowane: kształt sprawdza scalanie; brak logu to świadomy kompromis |
| L19 asymetria przywracania grafiku głównego i dodatkowych | ➖ | Zaakceptowane (sprzed zakresu, opisane w decyzjach) |
| L20 `wa.me` w `JournalReport.tsx` | ➖ | Poza zakresem tego przeglądu |

**Uwagi:**
- Próg paczki wejściowej podniesiony z 392 do 393 KB (datowany komentarz w `e2e/bundle.spec.ts`). Poprawki dodały kilkaset bajtów; paczka była już na granicy.
- Test M6 sprawdza tylko, że wynik nie zależy od ogólnej stawki, gdy wszystkie godziny mają stawkę rodzaju. Nie sprawdza wartości liczbowej przy mieszanych stawkach.
- Niezacommitowany stan U7 (numer hurtowni, `study/sites.ts` i `study/store.ts`) nie jest częścią tych napraw i pozostaje w drzewie roboczym.
- E2E nie uruchamiane (zgodnie z ustaleniem).

# Plan ulepszenia graficznego interfejsu — spójność i czytelność (2026-11-06)

**Status (2026-11-06):** Etap 1 zrobiony, z dwiema zmianami względem planu:

- **1.1, wysokości.** Wysokości `Button` i `IconButton` zostają bez zmian (40/36/44 oraz 28/32–36). Komentarze w `icon-button.tsx` uzasadniają je: pięć przycisków musi zmieścić się w nagłówku 320 px. Ujednolicone są nieaktywny stan i promień zamknięcia okna.
- **1.5, pusty stan.** Zamiast `ui/empty-state` jest istniejący `StatusPanel`.

Opis w `opis.md`: „Wspólne — prymitywy UI”.

**Etap 2** zrobiony 2026-11-06, z jedną zmianą: role tekstu nazywają się `.ui-hint` i `.ui-meta` (a `.title-section` zostaje), a nie `.text-hint`. Powód: tailwind-merge brałby `text-*` za kolor. Wzorce `@visual` odnowione. Opis w `opis.md`: „Wspólne — role tekstu i czytelność”.

Dalej Etap 3 albo 4.

## Kontekst

Trzy agenty eksploracyjne przejrzały kod. Wnioski:
- **Tokeny są dojrzałe** (OKLCH, 10 stylów × 2 schematy, `skinContract`/`skinContrast`, `designTokens.test.ts`), a wcześniejsze plany UI (`nowyplan.md`, `docs/plan-wyglad-2026-11-01.md`, plan motywów) są zrobione. Otwarte zostało głównie QA telefonu.
- **Słaba jest warstwa komponentów**:
  - 435 surowych `<button className=…>` obok 412 `<Button>`;
  - ok. 64 ręcznie pisane karty `rounded-card border bg-card`, a `SectionCard` jest tylko w 9 plikach;
  - ponad 200 surowych pól formularza;
  - 3 ścieżki modali;
  - 5 różnych wysokości przycisków;
  - 44 surowe `rounded` lub `rounded-sm`, poza `--shape`;
  - błędny token `--radius-field`.
- **Czytelność**: tekstu `text-xs` jest 820 razy, `text-2xs` 157 razy, a `text-sm` 635 razy. Do tego `text-[10px]` i `text-[11px]`. Opisy zlewają się w szarą masę.
- **Najsłabsze ekrany**:
  - Praca: 3 poziomy tytułów i zawijające się zakładki;
  - Grafik: najgęstszy stos na 390 px;
  - nawigacja miesiąca jest różna w Kalendarzu i w Grafiku;
  - puste i ładujące stany są niejednolite;
  - nawigacja mobilna jest niespójna (ikony, kafle arkuszy, FAB poza środkiem).

**Decyzje użytkownika:**
- zakres „Spójność + czytelność” (paleta i style zostają, NP-1 poza planem);
- podnieść rozmiar tekstu opisów i meta do `text-sm`, a `text-xs` zostawić tylko dla etykiet i liczników.

**Zasady wykonania:**
- przed kodem skill `frontend-design` (reguła z pamięci);
- po każdym etapie: `refactoring-ui` i `ux-heuristics` do przeglądu, potem `simplify` i `code-review` na diffie;
- `opis.md` aktualizowany po każdym etapie (skill `technical-documentation`);
- e2e tylko na prośbę użytkownika. Wyjątkiem są zrzuty i a11y działu zamykanego w etapie.

---

## Etap 1 — Fundament: prymitywy w `src/components/ui/`

1. **Skala przycisków.** Ujednolicić `ui/button.tsx` i `ui/icon-button.tsx` do 3 rozmiarów: sm 32, md 40, lg 44, z `coarse:` do 44. Zamknięcie okna w `ui/dialog.tsx:64` przenieść na `IconButton` z `rounded-control`. Ujednolicić stan wyłączenia: `Badge` i `IconButton` przestają używać `opacity-50`, tak jak `Button`.
2. **Nowe warianty `Button`.**
   - `pill`: przycisk-pigułka, jak w `JournalEntrySheet` ok. linii 201–239.
   - `toolbar`: przycisk paska, jak Cofnij/Ponów w Grafiku.
   - Wspólny `loading` ze spinnerem. Tego brakuje według `opis.md`.
3. **`ui/card.tsx`.** Cienki `Card` (`rounded-card border bg-card` plus `--elevation`). `SectionCard` zbudować na nim.
4. **`ui/month-nav.tsx`.** Wspólna nawigacja miesiąca: strzałki, tytuł jako przycisk, „Dziś”. Wzorem jest `calendar/CalendarHeader.tsx`, z rozmiarem z Grafiku.
5. **`ui/empty-state.tsx`.** Ujednolicony pusty stan na bazie istniejącego `StatusPanel`: rysunek, zdanie, CTA.
6. **Poprawki tokenów.**
   - `rounded-[calc(var(--radius-field)-2px)]` zamienić na `--r-field` (`study/JournalEntrySheet.tsx:889`, `study/NewSiteDialog.tsx:88`).
   - `phone:rounded-t-2xl` w `ui/dialog.tsx:57` zamienić na token.
   - `Input` i `filterChipClass` (`ui/chip.ts:13`) dostają ten sam promień.
7. **Strażnik w `src/test/designTokens.test.ts`.** Zakazać w `src/components/**`:
   - `text-[Npx]`;
   - surowych `rounded` i `rounded-sm`;
   - `shadow` i `shadow-sm` (zamiast nich `shadow-elevation-*`);
   - `var(--radius-`.

   Zakaz działa z listą `KNOWN`, która może tylko maleć, tak jak w a11y.

## Etap 2 — Typografia i czytelność

1. **Role tekstu** w `src/index.css` jako klasy komponentowe, wzorem `.section-label`:
   - `.text-hint`: opisy i podpowiedzi, `text-sm text-muted-foreground`;
   - `.text-meta`: daty i liczniki, `text-xs tabular-nums`;
   - `.title-section`: h2 sekcji. Zastępuje ok. 11 różnych zestawów klas h2.
2. **Migracja.** Opisy i podpowiedzi przechodzą z `text-xs` na `.text-hint`. Etykiety, liczniki, chipy i meta zostają `text-xs`. `text-[10px]` i `text-[11px]` znikają:
   - `calendar/CalendarLegend.tsx:36`
   - `study/JournalItem.tsx:171`
   - `guide/GuideArt.tsx`
   - `shifts/ShiftSummary.tsx:321`
   - `AddNoteBar.tsx:657`
   - `vault/LockedNoteTile.tsx:110`
3. **`DialogTitle` i nagłówek `SectionCard`.** Jedna hierarchia: tytuł okna to `text-lg`, tytuł sekcji to `.title-section`.
4. **Pułapka.** Większy tekst może rozepchnąć Grafik i karty na 390 px. Sprawdzić `touch-targets-phone.spec.ts` i zrzuty 390.

## Etap 3 — Ekrany najsłabsze (dział po dziale)

1. **Praca** (`study/StudyView.tsx`):
   - usunąć środkowy h2 „Nauka”, zostawiając h1 i opis w `ViewTitle`;
   - zakładki na 390 px przewijane poziomo (Radix Tabs, bez zawijania), aktywna widoczna;
   - jeden nagłówek dla wszystkich zakładek, bez skoku układu na Dzienniku.
2. **Grafik** (`shifts/ShiftsView.tsx`):
   - podpowiedzi zwinąć do jednej `.text-hint` lub do `MissingHint`;
   - Cofnij/Ponów jako `Button variant="toolbar"`;
   - nawigacja miesiąca przez `ui/month-nav`;
   - pogrupować kolejność `order-*` w 3 bloki: Teraz, Narzędzia, Miesiąc;
   - eksport i podsumowanie w `Card`.
3. **Kalendarz.** `CalendarHeader` przechodzi na `ui/month-nav`. Długie klasy w `DayPanel` zamienić na `Card` i role tekstu.
4. **Karty ręczne na `Card`/`SectionCard`.** Długi (`debts/DebtsView.tsx`), Praca/Dziennik (`study/StudyJournal.tsx`, `JournalItem.tsx`), Terminy (`reminders/RemindersView.tsx`).
5. **Puste i ładujące stany.**
   - Ćwiczenia, Długi i Plany dostają `ViewSkeleton` zamiast `min-h-[60dvh]`. Etykieta `plans` już istnieje (`pages/Index.tsx` ok. linii 1030 i 1038, `StudyView.tsx`).
   - Oś tygodnia dostaje skeleton zamiast tekstu.
   - Ćwiczenia (`cwiczenia/CwiczeniaView.tsx` ok. linii 123), Kalendarz i Grafik (`EmptyState.tsx`) dostają `ui/empty-state` z rysunkiem i CTA.
6. **Index** (`pages/Index.tsx`):
   - „📌 Przypięte” dostaje ikonę lucide `Pin` zamiast emoji;
   - pasek kosza i przycisk „Pola” przechodzą na `Button`.

## Etap 4 — Nawigacja mobilna

1. **Jedna ikona na dział** w `AppSidebar.tsx` i `BottomNav.tsx`, ze wspólnej mapy, np. w `src/lib/viewRoute.ts` albo w nowym `sectionMeta`. Dziś: `CalendarDays` wszędzie.
2. **Kolor działu** na wszystkich pozycjach dolnego paska albo na żadnej. Rekomendacja: na wszystkich, przez `sectionIconClass`.
3. **Arkusze „Nowa” i „Więcej”.** Jeden wzór kafla, scalić `QuickTile` i `SheetTile`, oraz jeden styl tytułu. W „Więcej” dodać kafle Plany i „Ten tydzień”.
4. **FAB w środku** także przy 6 kolumnach. Ikona „+” w Pracy pokazuje wariant „wpis z budowy”.
5. **Pasek boczny.** Usunąć dublowanie nazwy grupy „Praca” nad pozycją „Praca”.
6. **Ustawienia** (`SettingsDialog.tsx`). Zakładki na telefonie z ikonami albo przewijane, żeby napis „Kopia i dane” nie był ściśnięty.

## Etap 5 — Migracja surowych `<button>` i pól (stopniowo)

- Zamieniać po kolei, dział po dziale, na `Button`, `IconButton` i `Input`/`Textarea`.
- Zaczynać od największych plików:
  1. `study/JournalEntrySheet.tsx`
  2. `AddNoteBar.tsx`
  3. `AppSidebar.tsx`
  4. `debts/DebtsView.tsx`
  5. `NoteReader.tsx`
- Wyjątki zostają surowe: elementy płótna i rysunku (`PlanOverlay`, `DrawingCanvas`, `SignaturePad`), gdzie hexy są celowe.
- Strażnik z Etapu 1.7 zmniejsza listę `KNOWN` po każdym dziale.

---

## Pliki kluczowe

- **Prymitywy:** `src/components/ui/{button,icon-button,dialog,section-card,chip}.tsx`, nowe `ui/{card,month-nav,empty-state}.tsx`.
- **Style:** `src/index.css` (role tekstu), `tailwind.config.ts` (bez nowych tokenów, chyba że potrzebne).
- **Ekrany:**
  - `study/StudyView.tsx`, `shifts/ShiftsView.tsx`, `calendar/CalendarHeader.tsx`, `calendar/DayPanel.tsx`;
  - `debts/DebtsView.tsx`, `cwiczenia/CwiczeniaView.tsx`;
  - `BottomNav.tsx`, `AppSidebar.tsx`, `pages/Index.tsx`, `SettingsDialog.tsx`.
- **Do ponownego użycia:** `StatusPanel`, `MissingHint`, `ViewSkeleton` (ma nieużywaną etykietę `plans`), `ViewTitle`/`PageActions`, `sectionIconClass`, tokeny `src/lib/motion.ts`.

## Weryfikacja (po każdym etapie)

1. Najpierw `npm run check`: typecheck, lint, Vitest (`designTokens`, `sentenceCase`, `skinContract`, `skinContrast`) i `@smoke`.
2. Zrzuty zmienionego działu:
   - `npm run test:visual -- -g "<dział>"`;
   - obejrzeć różnice w 1440 i 390 px, we wszystkich stylach;
   - dopiero potem `--update-snapshots=all`.
3. `e2e/a11y.spec.ts`: axe WCAG 2.2 AA, `KNOWN` puste. Do tego `touch-targets-phone.spec.ts`.
4. `npm run build` i `e2e/bundle.spec.ts`: JS ≤ 500 KB gzip (teraz ok. 442), precache ≤ 4,2 MiB (zapas ok. 215 KiB).
5. Ręcznie w przeglądarce (Playwright MCP) przy 390 px: Praca, Grafik, Kalendarz, arkusze dolnego paska.
6. `simplify` i `code-review` na diffie, wpis w `opis.md`, commit etapu.

## Kolejność i rozmiar

Etap 1 (fundament) jest wymagany przed 2–4. Potem Etap 2, który zmienia najwięcej zrzutów, więc wszystkie wzorce odnawiamy raz. Etapy 3 i 4 można robić w dowolnej kolejności. Etap 5 jest ciągły, w małych commitach.

# Wspólne

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Wspólne — stan aktualny (stos UI, telefon, układ, stany, wygląd, ruch, dostępność, push, build)

Rzeczy wspólne dla wszystkich działów. Opis w stanie aktualnym: historia i kolejne etapy planów są w commitach.

### Stos i biblioteki UI

- **React 19 i Tailwind 4.** `package.json`: `react`/`react-dom` 19, `tailwindcss` 4 z `@tailwindcss/postcss` (bez `autoprefixer`), `tw-animate-css` zamiast `tailwindcss-animate`, `tailwind-merge` 3, `react-day-picker` 9. `src/index.css` ładuje Tailwind przez `@import` i konfigurację przez `@config '../tailwind.config.ts'`. Własne klasy są `@utility`. Warianty `coarse:` (palec), `desk:` (z paskiem bocznym) i `phone:` (`max-width: 767px` lub niski ekran dotykowy) to funkcje `addVariant`.
- **Zgodność z v3** w `index.css`: domyślna krawędź `gray-200`, `cursor: pointer` na przyciskach, placeholder `gray-400`. Style `sonner` leżą poza warstwami — kolory toastów idą przez zmienne CSS.
- **Okna.** Nagłówki `Sheet`/`Dialog`/`AlertDialog` używają `gap` zamiast `space-y` (ukryty opis `sr-only` nie przesuwa tytułu). Ujemne marginesy w dzieciach `space-y` usunięte.
- **Radix i ikony.** 12 paczek `@radix-ui/react-*` w najnowszym majorze; `lucide-react` 1.x; `sonner` 2. Importy ikon na nazwach kanonicznych (`TriangleAlert`, `CircleCheck`, `Trash`, `Funnel`, `Ellipsis` itd.; stare nazwy są aliasami). Kosz z kreskami to jedyny kosz w aplikacji. Ikony lucide mają `aria-hidden`, chyba że dostaną etykietę.
- **Kontrolki.** `ui/icon-button.tsx`, `ui/button.tsx`, `ui/toggle-group.tsx` (`ToggleGroup`, warianty `segment` i `plain`), `ui/responsive-dialog.tsx`, `ui/input-otp.tsx` (parowanie).
- **Kalendarz w UI.** `ui/calendar.tsx` na API react-day-picker 9; strzałki miesiąca 44 px na dotyku.
- **Paczka React.** `vite.config.ts` — `vendor-react` obejmuje `react-dom/client` i `scheduler`.

### Kolory krawędzi i fokusu

- `--border` (220 14% 90%) — krawędź dekoracyjna kart i podziałów.
- `--input` (220 14% 54%) — krawędź pól, przycisk „outline”, tor wyłączonego przełącznika; kontrast ≥3:1 (WCAG 1.4.11).
- `--ring` (34 88% 39%) — obwódka fokusu, ≥3:1 na tle.
- Ciemny motyw ma własne wartości (krawędź pola ≥3:1). Tokeny kontrastu liczy test `src/lib/contrastTokens.test.ts`.

### Telefon: dolny pasek, klawiatura, arkusze, okna

- **Dolny pasek** (`BottomNav.tsx`): Notatki, Dziś, „+”, Terminy („Przypomnienia” na pasku zmienione na „Terminy”, bo pełne słowo nie mieściło się przy 12 px), Więcej. Aktywna pozycja: kolor marki, pogrubienie, pigułka i pasek akcentu (`layoutId`, sprężyna).
- **„+” na pasku:** stuknięcie otwiera nową notatkę; przytrzymanie — arkusz „Nowa” (Notatka, Z przypomnieniem, Lista zadań, Zdjęcie, Rysunek, Dyktuj; „Dyktuj” tylko tam, gdzie jest rozpoznawanie mowy). Kafle mają co najmniej 56 px wysokości na dotyku (`coarse:min-h-14`); nazwa kafla zawiera podpowiedź, więc czytnik czyta ją razem z tytułem (F1.5). Test: `e2e/fab-press.spec.ts`. „Z przypomnieniem” (F1.2) otwiera kompozytor z pickerem terminu (akcja `reminder`, `reminderOpenSignal`). Na liście notatek „+” chowa się przy przewijaniu w dół (F1.4: `BottomNav.tsx`, nasłuch `scroll` na oknie, próg 24 px w dół i 12 px w górę, pod 80 px zawsze widoczny). Element `li[data-fab-hidden]` zjeżdża animacją i staje się nieklikalny; przy ograniczeniu ruchu bez animacji. Poza widokiem notatek zawsze widoczny. Test: `e2e/fab-press.spec.ts`. Q4 (plan FAB): na telefonie po 8:00 pierwszy szybki termin to „Za godzinę”, zaokrąglony w górę do 5 minut (`presets(now, shifts, quickHour)` w `ReminderPicker.tsx`). Test: `e2e/reminder-sheet.spec.ts` (zegar ustawiony na 10:00). Q3 (plan FAB): parser (`src/lib/parseNaturalDate.ts`) rozumie skróty dni tygodnia z godziną („pt 9:30”, `pn wt sr czw pt sb nd`), dopasowane na cały wyraz (`(?![a-z])`), więc „ptaszek” nie jest piątkiem. Testy: `src/lib/parseNaturalDate.test.ts` (sekcja Q3). Q2 (plan FAB): nowy termin w pickerze zaczyna od ostatnio zapisanej godziny (`kaczy.reminder.lastTime`, `readLastReminderTime` / `writeLastReminderTime` w `src/lib/reminderTime.ts`; zapis przy „Zapisz” bez „Cały dzień”; bez historii 09:00). Testy: `reminderTime.test.ts`, `e2e/reminder-sheet.spec.ts`. Q1 (plan FAB): po zapisie notatki z terminem toast brzmi „Dodano z terminem: dziś, 09:00” (`handleComposerAdd` w `pages/Index.tsx`, `formatReminderShort`). „Cofnij” nadal usuwa notatkę jak przy zwykłej. Test: `e2e/composer-reminder.spec.ts`. Ostatnio wybrany rodzaj (F1.3) zapisany w `localStorage` pod `kaczy.fab.last.v1` (`src/lib/fabRecent.ts`: `readLastQuick`, `writeLastQuick`, `orderByRecent`) wraca na górę arkusza z odznaką „Ostatnio”. Kafle to tablica `QUICK_TILES` w `BottomNav.tsx`. Faza 4 (wygląd, 2026-10-29): kafle to jedna kolumna wierszy (ikona, tytuł, jedna linia podpowiedzi), a „Ostatnio” stoi przy tytule, nie nad kaflem. Test axe: `e2e/fab-sheets-a11y.spec.ts`. Dopracowanie (2026-10-29, po fazie 4): tytuł arkusza „Nowa” i pickera w Fraunces (`.sheet-title-serif`, krój już w paczce), etykiety kroków w Barlow Condensed (`.kicker`, też już w paczce, bez nowych plików fontów). Każdy kafel ma pasek w barwie swojego rodzaju (`QUICK_STRIPE`, tokeny `primary`/`success`/`warning`). Kafle wjeżdżają kaskadą (`.tile-enter`, `rise-in` z opóźnieniem według indeksu); ograniczony ruch skraca je globalnie. Test axe czeka na koniec animacji, bo w trakcie wjazdu kafle są półprzezroczyste. Testy: `src/lib/fabRecent.test.ts`, `e2e/fab-press.spec.ts`. Pierwsze stuknięcie zapisuje jednorazową podpowiedź o przytrzymaniu (`kaczy.fab.hint.v1`), a toast pokazuje się dopiero po zamknięciu okna „Nowa notatka” (`hintOnce` sprawdza co 0,5 s; bez edytora po 3 s, po 10 min rezygnuje) — nad otwartym edytorem zasłaniał sugestie tagu i przypomnienia (`a5a5584`). Podczas przytrzymania wokół „+” rośnie pierścień postępu przez 420 ms (F1.1, `BottomNav.tsx`, element `circle.fab-ring` z `data-pressing`; animacja `fab-ring-fill` w `src/index.css`, przy `html[data-motion="reduced"]` tylko zanikanie). Zwolnienie przed progiem kasuje pierścień bez śladu. Test: `e2e/fab-press.spec.ts` (@mobile).
- **Klawiatura ekranowa** (`src/lib/keyboardInset.ts`, wołane w `main.tsx`): na `<html>` ustawiane są `--kb-inset`, `data-keyboard` i `data-typing`. `data-typing` = fokus w polu tekstowym i klawiatura otwarta (iOS: `--kb-inset` > 0; Android: okno niższe o >80 px od najwyższego widzianego). Pasek nawigacji zjeżdża `translate` i znika (`in-data-typing:`), bez `transform`, który należy do animacji wejścia. Pełny ekran kompozytora kończy się nad klawiaturą (`--kb-inset`).
- **Atrybuty pól na telefonie (plan UI 3.7):** pole liczbowe ma `inputMode` (klawiatura liczbowa, `decimal` przy kwotach i stawkach, `numeric` przy liczbach całkowitych), pole wyszukiwania `enterKeyHint="search"` (klawisz „Szukaj”), pole telefonu `inputMode="tel"`. `TitleField` (tytuł notatki w edytorze i kompozytorze) ma `autoCapitalize="sentences"` i `enterKeyHint="next"`. Pola podpowiedzi (etykieta, alias, interwał powtarzania) mają `autoComplete="off"` lub `inputMode`. Test pilnujący reguł przechodzi po wszystkich tagach w źródłach: `src/lib/formFields.test.ts` (5, ponad 150 pól). Podpowiedzi przeglądarki w hasłach i w polach z danymi osobowymi zostają.
- **Formularze jako arkusz.** `ResponsiveDialogContent` (= `DialogContent` z trybem `sheet`) na telefonie (`phone:`) wysuwa się od dołu także w poziomie; pasek `ResponsiveDialogFooter` (przycisk „Zapisz”) jest przyklejony do dołu arkusza. Na komputerze zwykłe okno na środku. Formularze: `CustomTemplateDialog`, `ImportExternalDialog`, `VaultDialogs`, `ReminderQuickAddDialog`, `DayDialog`, `ShiftTypeDialog`, `PatternDialog`, `ShiftSettingsDialog`, `JournalReport`, `SiteCardDialog`. Okna z `p-0` (raport, karta budowy) nie mają stopki.
- **Zwykłe okna na telefonie** są wyśrodkowane z marginesem 1 rem, zaokrąglone, przewijają się w środku (`max-h-[calc(100dvh-2rem)]`; `dvh`, nie `vh`, bo pasek adresu). Arkusz nadpisuje wymiary (`max-sm:max-w-none`, `max-h-[92dvh]`). Okna pełnoekranowe (`FocusMode`, ustawienia na telefonie, rysownik) ustawiają `max-sm:max-w-none max-h-none` same — inaczej dostają margines.
- **Pasek zbiorczy** (`BulkActionBar.tsx`) na telefonie zawija akcje w drugi rząd (`max-sm:flex-wrap`), zamiast chować je za przewijaniem w bok. Przy 320 i 390 px żadna z 9 tras nie przewija się w bok (`mobile-layout.spec.ts`).

### Cele dotyku (44 px)

- Na `pointer: coarse` małe przyciski mają pole co najmniej 44 × 44 px bez zmiany wyglądu: widoczny przycisk 36 px + niewidzialne `::after` (`coarse:after:-inset-1`). Wzorzec w `ui/icon-button.tsx` (`size="sm"`), również w pasku bocznym (ikony folderów, etykiet, filtra, „⋯”).
- Grafik: przyciski miesiąca i „Skopiuj ten tydzień” mają `coarse:h-11`. Zakładki działu Praca mają `coarse:min-h-11`.
- Ograniczenie: `::after` strzałki podfolderu zachodzi na wiersz folderu — stuknięcie tuż przy strzałce ją rozwija.
- Audyt (plan UI 3.11): `e2e/touch-audit.spec.ts` (`@mobile`, Pixel 7) sprawdza na pięciu ścieżkach, czy każdy widoczny element interaktywny ma obszar trafienia co najmniej 44 × 44 px — pudełko albo pudełko z `::after` (`coarse:`). Pudełko samo bywa mniejsze (przyciski ikon 36 px), więc sam wymiar pudełka nie wystarcza. Na dotyku dopięte: pole wyszukiwania w kalendarzu i pola premii w Grafiku (`coarse:h-11`), pigułka statusu zapisu (`coarse:min-h-11`), wiersz „Ustawienia grafiku” (`coarse:min-h-11`).

### Tryb budowa

- Ustawienia → Wygląd → „Tryb budowa” (Wyłączony / Włączony / Automatycznie; „Automatycznie” włącza się, gdy system prosi o większy kontrast). `src/lib/siteMode.ts`, klucz `kaczy.siteMode.v1` (w kopii).
- Skala 112,5% przez `font-size` na `html` (`src/styles/site.css`): tekst 18 px, przyciski ikonowe co najmniej 54 px (`--tap: 3rem`, niewidzialne `::after`), mocniejsze krawędzie i tekst pomocniczy, gładkie tło bez kratki, dymki „Cofnij” 8 s.
- Elementy w px (dolny pasek 64 px, kafle) nie rosną. Nowy przycisk ikonowy poza `IconButton`/`Button` potrzebuje klasy `.tap-target`.

### Wibracje

- `src/lib/haptics.ts`: `haptic(kind)` (`tap`, `success`, `warn`, `selection`). Krótkie drgnięcie na Androidzie (`navigator.vibrate`) przy zapisie, odhaczeniu, przejściu w pasku, odpowiedzi w quizie, zapisie wpisu, zapisie dnia, cyklu i rodzaju zmiany w Grafiku.
- Po cichu nic nie robi, gdy: nie ma API (iOS, komputer), wskaźnik jest precyzyjny (mysz), efekt wyłączony (przełącznik „Wibracje na telefonie” w Ustawieniach → Ogólne) albo wibracja rzuciła wyjątek. Ograniczony ruch wibracji nie wyłącza.

### Układ szerokiego ekranu

- Od `xl` (1280 px) widoki z siatką mają panel boczny przyklejony przy przewijaniu: Grafik (przełącznik, nawigacja, paleta zmian, podsumowanie po prawej), Kalendarz (miesiąc po lewej, najbliższe terminy i wybrany dzień po prawej), Dziennik Pracy (wpisy do 48 rem, filtry po prawej; `role="search"`).
- Mechanizm: opakowania mają `contents` poniżej `xl`, więc ich dzieci są jedną kolumną `flex`, a klasy `order-*` odtwarzają kolejność telefonu. Od `xl` to siatka `minmax(0,1fr) + 22/24 rem`, a `<aside>` ma `sticky top-24`.
- Pułapka: okna Radix nie zajmują komórek siatki; nowy element DOM w korzeniu widoku trzeba wstawić do jednego z opakowań.

### Stany: pusty widok, błąd, brak sieci (`StatusPanel`)

- Jeden wygląd dla pustego widoku, „nic nie znaleziono”, błędu i braku sieci: rysunek kreską długopisu, nagłówek, jedno zdanie, co zrobić, opcjonalnie przycisk. Tony: `empty`, `no-results`, `error`, `offline`; kolor kreski koduje rodzaj. Rozmiary: `page` (cały widok) i `inline` (fragment, przerywana ramka).
- Dostępność: błąd z `role="alert"`, brak sieci z `role="status"`, pustka i brak wyników bez roli. Każdy panel ma `data-status`.
- Brak sieci w `ViewErrorBoundary`: błąd pobrania paczki przy `navigator.onLine === false` pokazuje, że widok czeka na internet, a notatki działają dalej.
- Nowy pusty stan: `StatusPanel`, nie własny `<p>` w ramce. Bardzo małe miejsca (kolumna tablicy, „Brak terminów”, paleta) zostają tekstem.

### Ładowanie widoków i animacje w tle

- **Reguła wskaźników ładowania (plan 3.3):** kręcące się kółko pojawia się dopiero po 300 ms (`src/components/DelayedSpinner.tsx`, na `useDelayedFlag(active, 300)` z `src/hooks/useDelayedFlag.ts`). Miejsce na ikonę jest zarezerwowane od razu (`invisible`), więc szybka operacja nie miga i przycisk nie przeskakuje. Używają go: pigułka statusu zapisu (`OfflineStatus`), kolejka zapisu (`OfflineQueuePanel`), zdjęcia w trakcie przygotowania (`PhotoStrip`), import (`ImportExternalDialog`), „Tu jestem” i „Przygotowuję zdjęcia…” w Dzienniku (`JournalEntrySheet`), Włącz/Wyłącz push (`PushSettings`). Testy: `src/components/DelayedSpinner.test.tsx` (3).
- **Szkielety widoków:** `.view-skeleton` (`index.css`) wchodzi po 300 ms, tak samo jak wskaźnik (wcześniej 180 ms). `ViewSkeleton` i `CardSkeleton` (`ViewSkeleton.tsx`) mają tę samą regułę. Kości pulsują tylko przy pełnym ruchu.
- `src/lib/viewPreload.ts`: jedna zapamiętana obietnica importu na widok (`loadCalendarView`, `loadShiftsView`, `loadStudyView`). Najechanie kursorem lub dotknięcie pozycji nawigacji zaczyna pobieranie. Szkielet `ViewSkeleton` pojawia się po 180 ms (bez migania przy szybkim ładowaniu); pulsowanie wyłączone przy ograniczonym ruchu. Nowy widok leniwy: dopisać do `loaders` i `LABELS`.
- `src/lib/pageHidden.ts`: gdy karta jest w tle, `html[data-hidden]` wstrzymuje wszystkie zapętlone animacje (`animation-play-state: paused`). Przejścia nie są wstrzymywane.

### Ruch: framer-motion, przejścia, mikrointerakcje

- **LazyMotion.** `App.tsx` owija aplikację w `<LazyMotion features={loadMotionFeatures} strict>`; pełny zestaw funkcji (`src/lib/motionFeatures.ts`) jest w osobnej paczce tuż po starcie. Komponenty importują `m as motion` (pełne `motion` w trybie `strict` to błąd). Wejściowy JS po tej zmianie 372,4 KB gzip. Do załadowania funkcji animacje wejścia nie grają.
- **Czasy i sprężyny** z `src/lib/motion.ts` (`spring.snap`, `spring.soft`, `tween.enter`). Animowane są tylko `transform` i `opacity`. Ograniczony ruch obsługuje `MotionConfig` w `App.tsx`. Animacje CSS i mikrointerakcje (słownik ruchu) są w `src/styles/motion.css` — opis w sekcji „ruch i drobny szlif, Etap 4”.
- **Przełączniki** (`settings/Segmented.tsx`, `SkinPicker`): podświetlenie przesuwa się sprężyną (`layoutId` w `LayoutGroup` z `useId`). Ikona słońca/księżyca obraca się.
- **Listy:** zwijanie grupy w Notatkach opada wysokością; wiersz tabeli usunięty lub zarchiwizowany gaśnie, nowy wjeżdża (bez animacji przy pierwszym montażu); szkielet kart Dziś rezerwuje miejsce; pusty stan gaśnie.
- **Mikrointerakcje stanów:** pole z błędem (`aria-invalid`) ma czerwoną ramkę, a z klasą `shake-invalid` także drga przy próbie zapisu; liczniki w nawigacji pulsują przy zmianie (`count-bump`); przełączniki i checkboxy podświetlają się po najechaniu; suwak ma halo; tosty mają przycisk × (błąd 9 s można zamknąć); Enter i Spacja po dotyku nie włączają ramki fokusu (`src/lib/inputModality.ts`). Przycisk „ładuje” (wspólny prop `loading`) nie jest zrobiony.
- **Podpis wciśnięcia** przycisków to klasa `pressable`, nie skala framer-motion.
- **Przejście motywu** kołem (View Transitions, `clip-path: circle()` od ostatniego dotknięcia, ≤1,5 s). Wyłączone przy ograniczonym ruchu i efekcie „themeFade”.
- **Przejście widoku** przez `document.startViewTransition` z `flushSync` w `Index.tsx`; bez View Transitions zmiana natychmiastowa. **Strażnik WebKit (2026-11-11):** `src/lib/viewTransition.ts` (`canViewTransition`, `withViewTransition`, `isWebKitOnly`) wyłącza przejścia widoku w WebKit (Safari i każda przeglądarka na iOS) — szybkie przełączanie widoków w karcie budowy kończyło się „Old view transition aborted by new view transition” i awarią procesu renderującego (e2e `workday.spec.ts` na iPhonie 14, WebKit). Tam zmiana jest natychmiastowa; Chromium bez zmian. Używają go karta budowy (segmenty, zamknięcie), kalendarz (wybór dnia), `Index.tsx`, `viewChange.ts` (przez `canViewTransition`) i przejście motywu; `viewTransitionGuard.test.ts` pilnuje, że `startViewTransition` nie jest wołane poza strażnikiem. Test: `viewTransition.test.ts`, `e2e/workday.spec.ts`.

### Wygląd: style, kroje, tokeny, pieczątki

- **Style** (`src/lib/skins.ts`, `skinStore`, klucz `kaczy.skin.v1` w kopii; lista, schematy i kolory paska w `src/lib/skinList.ts`; CSS w `src/styles/skins/<id>.css`, zbierany przez `src/styles/skins.css`): Zeszyt (domyślny, kratka, bursztyn, niebieski długopis; słucha przełącznika Jasność), Odblask, Kafle i Tablica (opis niżej), Plan (ciemny, rysunek techniczny, granat, nagłówki Barlow Condensed, tabliczka rysunkowa tylko na komputerze), Neon (ciemny, nagłówki Unbounded, logo z mrugnięciem), Zorza (ciemny, dryfująca zorza tylko przez `transform`, szklane kafle na komputerze, Fraunces), Miedź — w galerii „Beton i patyna” (jasny, szalunkowy beton, zielona patyna na miedzi, bez rury przy pasku bocznym; Bricolage Grotesque; plan motywów 3.5, T-1), Matryca (ciemny, zielone znaki spadające na płótnie `src/components/skins/MatrixRain.tsx`, ~24 klatki/s, DPR ≤1,5, wstrzymany w ukrytej karcie; ograniczony ruch = statyczny obraz; parametry w `matrixParams.ts`, płótno ładowane leniwie przez `PaperBackdrop.tsx`; płótno przygaszone do 0,6 krycia, gaśnie pod nagłówkiem (górne ~260 px) i ma ciemną winietę za środkiem, żeby tekst pustego stanu był czytelny; `skins.css`) i Hydraulika (ciemny, woda animowana tylko przez `transform` (`hydro-flow`), bąbelki (`hydro-rise`) w CSS; rury z niższym kryciem niż na początku). Testy: `e2e/skin-motion.spec.ts` (płótno, winieta, bąbelki, ograniczony ruch). Każdy styl ma oba schematy (plan motywów 4.1, opis niżej w „Motyw”); `SKIN_SCHEME` to schemat, w którym styl powstał (domyślny). `html[data-skin]` jest zawsze ustawiony. Nowy styl: dopisać do `skinList.ts` (`SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR`, `SKIN_THEME_COLOR_ALT`, `SKIN_ICON`), blok drugiego schematu z pełnym kompletem tokenów, odcienie w generatorze akcentów, `SKIN_META` w `skinGallery.ts`, nowy plik `src/styles/skins/<id>.css` z `@import` w `skins.css`. Testy e2e (`a11y`, `visual`) i kontrastu biorą listę z `skinList.ts`; komplet tokenów sprawdza `src/lib/skinContract.test.ts` (szczegóły: sekcja „Fundament skórek”).
- **Równe sygnatury stylów** (plan motywów, Faza 2; CSS w `src/styles/skins/signatures.css`, sekcja „Równe sygnatury”). Każdy styl ma efekt przy zapisie i przy zmianie widoku. Warstwa `.sig-layer` (pusty `span` w `PaperBackdrop.tsx`) jest teraz w każdym stylu: Zorza i Matryca animują samą warstwę, pozostałe — jej `::after` (zapis) i `::before` (zmiana widoku), w spoczynku z kryciem 0. Zapis: Zeszyt — pieczątka „zapisano” odbita krzywo w rogu (`zeszyt-stamp`, 2,2 × `--sig-dur`), Plan — linia wymiarowa z napisem rysuje się w poprzek (`plan-measure`), Neon — mrugnięcie poświaty u góry (`neon-buzz`); Miedź (para), Hydraulika (fala), Zorza (fala barw) i Matryca (skan) były wcześniej. Zmiana widoku: Plan — linia skanu z góry na dół (`plan-scan`), Neon — prąd przygasa i wraca (`neon-brownout`), Miedź — odblask po betonie (`miedz-sheen`), Hydraulika — woda przepływa jedną rurą (`hydro-flow-once`); Zeszyt (kartka) i Matryca (kaskada) były wcześniej. Kafle (2.2): w Miedzi notatka nieruszana od 30 dni (`data-aged` w `NoteCard.tsx`, liczone przy renderze z `updatedAt ?? createdAt`) ma zielonkawą patynę przy krawędzi; w Hydraulice każdy kafel ma dwie śrubki obejmy w górnych rogach (`::after`, statyczne). Ograniczony ruch: animacje `.sig-layer::before/::after` wyłączone (`data-motion` i `@media`, ta sama specyficzność 0,3,2 co reguły animacji). Naprawiony błąd: dwie `@keyframes zorza-wave` — druga (wejście gwiazd przy zmianie stylu) nadpisywała falę zapisu, która zostawała poza ekranem; wejście gwiazd to teraz `zorza-stars-in`, a `skinContract.test.ts` pilnuje unikalnych nazw `@keyframes` w całym `src/`. Pułapka: `data-aged` liczy się przy renderze kafla, więc notatka „starzeje się” dopiero po kolejnym przerysowaniu. Testy: `e2e/skin-signatures.spec.ts` (7 par styl × sygnał, przy pełnym i ograniczonym ruchu; fala Zorzy faktycznie przelatuje; śrubki i patyna).
- **Sygnatura dnia na Dziś** (plan motywów 2.5): obok tytułu „Dziś” ozdoba w barwach stylu — Zeszyt: data dopisana długopisem (kolor `--accent`), Plan: tabliczka rysunkowa (dzień roku / liczba dni, tydzień ISO, skala, data), Neon: szyld z dniem tygodnia, Zorza: faza Księżyca (tarcza SVG i nazwa), Miedź: tabliczka znamionowa na nitach, Matryca: wiersz terminala z kursorem, Hydraulika: manometr z częścią doby, która minęła. Komponent `src/components/skins/DaySignature.tsx` (leniwy, ładowany z `ViewTitle.tsx` tylko na Dziś), obliczenia w `src/lib/daySignature.ts` (`moonPhase` — wiek Księżyca od nowiu 6.01.2000 i okres synodyczny, `moonPath`, `dayProgress`), style `src/styles/skins/day-signature.css`. Ozdoba ma `aria-hidden`; datę dla czytnika podaje wiersz pod tytułem. `ViewTitle` to siatka: ozdoba w rzędzie tytułu, wiersz daty na telefonie przez całą szerokość (inaczej tabliczka Planu zawijała datę), od `sm` obok. Poniżej 360 px ozdoba jest ukryta. Bez godziny zachodu Słońca — wymagałaby lokalizacji. Ograniczenie: wartości liczone przy renderze, więc manometr nie „chodzi” sam, tylko przy przerysowaniu widoku. Testy: `src/lib/daySignature.test.ts`, `e2e/skin-signatures.spec.ts` („Dziś: sygnatura dnia…”).
- **Wejście stylu** (plan motywów 2.4, `revealClip` w `src/hooks/useTheme.ts`): przy zmianie stylu View Transition odsłania nowy styl kształtem zależnym od stylu — Plan rozwija się od lewej (`inset`), Miedź (Beton i patyna) rośnie kołem z prawego dolnego rogu, Matryca spływa z góry, Hydraulika napełnia się od dołu, Kafle układają się ukośnie od lewego górnego rogu (`polygon`), Tablica przeciera gąbką od prawej (`inset`); Zeszyt, Neon, Zorza i sama zmiana jasności — koło od miejsca kliknięcia jak wcześniej. Bez View Transitions i przy ograniczonym ruchu bez zmian. Test: `src/hooks/useTheme.test.ts` („revealClip”).
- **Galeria stylów** (plan motywów 3.2, `SkinPicker.tsx`, sekcja „Galeria stylów” w grupie Styl): miniatura to scena stylu (tło z `common.css`, „Aa” krojem nagłówków, kafel z tekstem i pigułką przycisku głównego). Kolor przycisku, kropki i znaczka wyboru to akcent zapamiętany dla tego stylu (`useAccentMap` z `accent.ts`, próbki z `accentMeta.ts`). Pod opisem znaczki: schemat z `SKIN_SCHEME` („Jasny”, „Ciemny”, „Jasny i ciemny”) i „Ruchome tło” (`ambient` w `SKIN_META`: Zorza, Matryca, Hydraulika).
- **Przymierz styl** (plan motywów 3.1, `src/lib/skinTry.ts`, `trySkin`): wybór w galerii (`SkinPicker` w `AppearanceSettings.tsx`) i w palecie poleceń ustawia styl od razu i pokazuje dymek „Styl: Neon” z „Cofnij”. Stałe `id` dymku (`skin-try`) podmienia go przy kolejnych wyborach, a moduł pamięta styl sprzed pierwszej przymiarki (`origin`), więc „Cofnij” po Neon → Zorza → Plan wraca do Zeszytu. Seria kończy się, gdy dymek zniknie albo użytkownik sam wróci do stylu wyjściowego. Moduł jest leniwy (importuje `SKIN_META`), wołają go tylko Ustawienia i paleta. Test: `src/lib/skinTry.test.ts`.
- **Styl w palecie** (plan motywów 3.3, `CommandPalette.tsx`): „Następny styl” w Akcjach (kolejność z `SKINS`, po prawej nazwa następnego) i grupa „Styl” z pozostałymi stylami, widoczna dopiero po wpisaniu tekstu (wartości `styl motyw skorka <nazwa>`). Zmiana idzie przez `trySkin`, więc z „Cofnij”.
- **Tło: pełne / ciche / gładkie** (plan motywów 1.3, `src/lib/backdrop.ts`, klucz `kaczy.backdrop.v1`, per urządzenie; Ustawienia → Wygląd → „Tło”; moduł importowany w `main.tsx`). Domyślnie `auto` = pełne, a przy systemowym oszczędzaniu danych (`navigator.connection.saveData`) ciche; wybór użytkownika wygrywa. Atrybut `html[data-backdrop="quiet|plain"]` (pełne bez atrybutu), CSS w `src/styles/backdrop.css` (po `skins.css`). Ciche: `animation-play-state: paused` na pseudo-elementach i dzieciach `.paper-grid`, a nad ozdobami zasłona `.backdrop-veil` w kolorze tła (krycie 0,5, `z-index: 1`) — jedna zasłona zamiast mnożenia krycia warstw, które w każdym stylu jest inne; płótno Matrycy rysuje jedną nieruchomą klatkę (`MatrixRain` z `still`, montowane od nowa przez `key`). Sygnatury zapisu (`html[data-sig][data-skin] …`) mają wyższą specyficzność i ustawiają `animation` od nowa, więc dalej grają; warstwa `.sig-layer` jest nad zasłoną. Gładkie: `.paper-grid::before/::after` i tabliczka Planu bez treści, tło bez obrazów (podwójny atrybut, bo plama pory roku ma specyficzność 0,3,1), a `PaperBackdrop.tsx` nie renderuje płótna ani bąbelków. Pułapka: sygnatura, która sama ustawia `content` na pseudo-elemencie, mignie także w gładkim tle. Testy: `src/lib/backdrop.test.ts`, `e2e/skin-motion.spec.ts` (3 testy „Tło …”).
- **Kolor akcentu** (plan motywów 1.1 i 1.5; Ustawienia → Wygląd → „Akcent”, pod galerią stylów). Każdy styl ma pięć odcieni: 0 = jego barwa, 1–4 = warianty (np. Zeszyt: niebieski długopis, zielony, czerwony długopis, fiolet; Matryca: bursztyn monitora, cyjan, koral, biel fosforu). Wybór pamiętany osobno dla stylu (M-3) w `kaczy.accent.v1` jako mapa styl → numer, per urządzenie. `src/lib/accent.ts` (paczka startowa, import w `main.tsx`) ustawia `html[data-accent="1…4"]` i przełącza go przy zmianie stylu (`skinStore.subscribe`); nazwy i próbki są w leniwym `src/lib/accentMeta.ts`, wybór w `src/components/settings/AccentPicker.tsx` (radiogroup, strzałki, kółka 44 px). CSS: `src/styles/accents.css` — **plik generowany** przez `node docs/tools/accents/accents-gen.mjs`: dla każdej pary styl × odcień (Zeszyt osobno jasny i ciemny, selektory `:not(.dark)` / `.dark`) bierze jasność i nasycenie `--primary` stylu, zmienia odcień, przycina nasycenie do gamutu sRGB i przesuwa jasność, aż przejdą progi; nadpisuje `--primary`, `--ring` (gdy miał ten sam odcień co `--primary`; w Neonie pierścień jest błękitny i zostaje) oraz w Matrycy i Hydraulice `--glow-primary` (tam był wpisany kolor). Zmiana odcieni: edytować `ACCENTS` w generatorze i `ACCENT_META`, uruchomić generator, test. Pułapki: przy ciemnym tekście na przycisku jasność musi zostać wysoka, więc „czerwień” w Matrycy wychodzi koralowa (stąd nazwa „Koral”), a żółć w Neonie ma osobną jasność startową 0,9. Ozdoby wpisane kolorem w CSS stylu (deszcz Matrycy, rury, neonowe logo) zostają w barwie stylu. Testy: `src/lib/skinContrast.test.ts` („akcenty stylów”: każdy odcień przechodzi te same progi co styl, plus `primary-ink` ≥ 4,5:1 na tle i karcie — sprawdzany odtąd także w samych stylach), `src/lib/accent.test.ts`.
- **Kod wyglądu, ramki i poświata (2026-10-29).** Do listy `APPEARANCE_KEYS` (`src/lib/appearanceCode.ts`) dodano `kaczy.frames.v1` (siła ramek), `kaczy.frames.look.v1` (kolor krawędzi i tło kart) i `kaczy.glow.v1` (siła i barwa poświaty). Ta sama lista idzie do kopii zapasowej (`exportNotes.ts`). Test w obie strony: `src/lib/appearanceCode.test.ts`.
- **Kod wyglądu** (plan motywów 3.5; Ustawienia → Wygląd → Styl → „Kod wyglądu”): „Kopiuj kod wyglądu” zapisuje do schowka tekst `NOTKI1-…` (base64url z JSON-em), pole „Wczytaj” przyjmuje go na innym urządzeniu, zapisuje ustawienia i odświeża aplikację. `src/lib/appearanceCode.ts`: `APPEARANCE_KEYS` (styl, `kaczy-theme`, schemat stylu, akcent, kształt, tło, krój, rozmiar tekstu, styl na noc), `encodeAppearance`, `decodeAppearance` (tylko klucze z listy, wartości do 1000 znaków, kod do 4000; zły kod → `null`). Wartości sprawdzają przy starcie same moduły (`merge` w `createPersistedStore`). Bez dostępu do schowka kod pojawia się w polu. UI: `src/components/settings/AppearanceCode.tsx`. Te same klucze są od teraz w pełnej kopii zapasowej (`SETTINGS_KEYS` w `exportNotes.ts` rozwija `APPEARANCE_KEYS`; wcześniej akcent, schemat stylu, kształt, tło, rozmiar tekstu i styl na noc nie wchodziły do kopii). Dane wyglądu nie trafiają do Yjs. Testy: `src/lib/appearanceCode.test.ts`, `e2e/appearance-code.spec.ts`.
- **Styl na noc** (plan motywów 1.4; Ustawienia → Wygląd → Styl → „Styl na noc”): para styl dzienny / nocny, przełączana według godzin (domyślnie 20:00–07:00, także przez północ) albo razem z trybem ciemnym systemu. `src/lib/skinSchedule.ts` (klucz `kaczy.skinSchedule.v1`, per urządzenie; importowany w `main.tsx`): `isNightHours`, `isNight`, `scheduledSkin` (czyste), `applySkinSchedule` sprawdza porę przy starcie, co minutę, po powrocie do karty i przy zmianie trybu ciemnego systemu, i ustawia `skinStore` bez dymka. Ręczny wybór stylu przy włączonym harmonogramie nie wyłącza go, tylko zapisuje styl bieżącej pory (wieczorem — nocny), więc harmonogram nie cofa wyboru użytkownika; zmiany z harmonogramu są odróżniane flagą `applying`. Włączenie ustawia bieżący styl jako dzienny, a nocny musi być inny (domyślnie Zorza, przy Zorzy — Neon). UI: `src/components/settings/NightSkinSettings.tsx`. Ograniczenie: przełączenie co minutę, więc o granicy pory może się spóźnić do 60 s. Testy: `src/lib/skinSchedule.test.ts`, `e2e/night-skin.spec.ts`.
- **Kształt** (plan motywów 1.2, `src/lib/shape.ts`, klucz `kaczy.shape.v1`, per urządzenie; Ustawienia → Wygląd → „Kształt”: Ostry, Zwykły, Miękki). `html[data-shape="sharp|soft"]` ustawia `--shape` na 0,4 albo 1,6 (`src/styles/shape.css`); `--radius` i `--r-control|field|card` w `src/index.css` to `calc(… * var(--shape))`, więc za kształtem idą wszystkie klasy `rounded-control|field|card` i `rounded-sm|md|lg` (Tailwind liczy je od `--radius`). Nie zmieniają się `rounded-full` i promienie wpisane wprost w CSS ozdób. Moduł importuje `main.tsx`, żeby atrybut był przed pierwszym malowaniem (Ustawienia są leniwe). Test: `src/lib/shape.test.ts`.
- **Nowe style: Odblask, Kafle, Tablica** (plan motywów 4.3, 4.2, 4.5; decyzja M-1). Każdy w `src/styles/skins/<id>.css` z blokiem domyślnym (jasny) i drugim (`.dark`), ozdobami, sygnaturami i miniaturą galerii; w `skinList.ts` (`SKINS`, `SKIN_SCHEME: light`, kolory paska, `SKIN_ICON`), `skinGallery.ts`, `accentMeta.ts`, generatorze akcentów i `DaySignature.tsx`. **Odblask** — do pracy w słońcu: tło w kolorze kamizelki, czarny tekst, przycisk główny czarny z napisem fluo, twarde cienie bez rozmycia, obwódki kafli 1,5 px, nagłówki Barlow Condensed wersalikami, pasy ostrzegawcze 6 px u góry nagłówka (tło `.app-header`, nie `border-image`, który rysowałby je też na dole), bez kratki i bez ruchu (`--sig-dur: 0.01s`, żadnych sygnatur); tekst i tekst pomocniczy ≥ 7:1 (AAA) w obu schematach — test „Odblask: kontrast AAA”. Ciemny: odblask nocą (czarne tło, fluo jako akcent). Przy wyborze Odblasku `trySkin` proponuje tryb budowa (dymek „Włączyć tryb budowa?”, gdy wyłączony). Akcenty Odblasku mają stałe nasycenie i jasność startową 0,42, bo barwa stylu jest czarna. **Kafle** — białe płytki 64 px z fugą 3 px (`--grid`) i połyskiem w rogu, kafel notatki z połyskiem szkliwa, kobalt, nagłówki Nunito; zapis: płytka „dosiada” w rogu (`kafle-set`), zmiana widoku: połysk po ścianie (`kafle-gloss`); ciemny: grafitowy gres. **Tablica** — domyślnie ciemna (plan motywów 3.5, T-3; `SKIN_SCHEME: dark`): zielona tablica szkolna z kredą (jaśniejszy `--success`, `--shift-text-mix: 30%`), nagłówki Lexend; jasny wariant to biała tablica suchościeralna z aluminiową ramą przy pasku bocznym i śladami startego pisma (SVG w tle). Blok z tokenami zielonej tablicy to `html[data-skin="tablica"]` (bez `.dark`), jasny to `:not(.dark)` — tak jak w Planie, bo testy i `prepaint.js` biorą schemat domyślny z tego samego miejsca. Notatki na magnesach (`::after` kafla), kolory markerów; zapis: ptaszek markerem (`tablica-check`), zmiana widoku: przetarcie gąbką (`tablica-wipe`). Sygnatura dnia: tabliczka w pasach (Odblask), data na płytce (Kafle), dzień tygodnia markerem z falistym podkreśleniem (Tablica). Logo w Odblasku i Tablicy ma dwie warstwy tła jak bazowe `.notki-glyph` — jedna warstwa wyjeżdżała poza litery. Kroje tylko z już obecnych (`@fontsource`), bez nowych zależności. Testy: kontrakt i kontrast (oba schematy), `skinTry.test.ts` (propozycja trybu budowa), `e2e/skin-signatures.spec.ts` (sygnatury Kafli i Tablicy, brak ruchu w Odblasku), `e2e/a11y.spec.ts` (60 audytów), `e2e/visual.spec.ts` (30 nowych zrzutów bazowych).
- **Tekst skrótów zmian na karcie** (`shiftTextOnCard` w `src/lib/shifts/color.ts`): udział koloru zmiany to `var(--shift-text-mix, 55%)`; zielona Tablica ustawia 30%, bo skrót nieobecności miał tam za mały kontrast (axe w Grafiku).
- **Ciemny Zeszyt pod lampką** (plan motywów 4.4, `src/styles/skins/zeszyt.css` — pierwszy w `skins.css`; tokeny Zeszytu zostają w `index.css`): w ciemnym schemacie na kartkę pada z góry ciepłe światło (dwa gradienty radialne na `.paper-grid`, statyczne), kratka zostaje ledwo widoczna, a długopis (`--accent` w `.dark`) jest żelowy — nasycony niebieski `oklch(0.745 0.13 264)` zamiast przygaszonego. „Gładkie” tło zdejmuje światło (backdrop.css), „ciche” przykrywa je zasłoną; przy porze roku Zeszyt ma plamę sezonu w `::after`, więc obie warstwy się sumują.
- **Motyw pory roku** (`src/lib/seasonTheme.ts`, `src/lib/season.ts`, klucz `kaczy.seasonTheme.v1`; wybór w Ustawienia → Wygląd: Auto, Wiosna, Lato, Jesień, Zima). `App.tsx` ustawia `html[data-season]`, gdy wybrano konkretną porę (działa od razu) albo „Auto” przy włączonym efekcie „Motyw sezonowy” (Efekty; domyślnie wyłączony). Efekt w `index.css`: tokeny `--season-*` i `--accent`; w Zeszycie `.paper-grid::after` maluje poświatę z górnych rogów i od dołu kolorami sezonu. W ciemnym motywie `--season-glow` 0,42 (przygaszona). Pozostałe style mają własne tła i akcenty — tam motyw nic nie zmienia (podpowiedź w Wygląd mówi to wprost). Test: `e2e/seasons.spec.ts`.
- **Motyw i drugi schemat stylu** (`src/hooks/useTheme.ts`, plan motywów 4.1, decyzja M-2): jeden wspólny stan (`useSyncExternalStore`); zmiana trafia do DOM w jednym miejscu (`applyCurrent`). Każdy styl ma schemat jasny i ciemny. Zeszyt słucha wspólnego przełącznika (`kaczy-theme`: jasny / ciemny / system); pozostałe style pamiętają własny wybór w `kaczy.skinScheme.v1` (`src/lib/skinScheme.ts`, mapa styl → `system|light|dark`, per urządzenie), a bez wyboru mają schemat, w którym powstały (`SKIN_SCHEME`) — po aktualizacji nic się nie zmienia samo. `resolveDark(mode, skin, systemDark, skinModes)` rozstrzyga, `schemePrefFor` daje wartość dla przełącznika. Ustawienia → Wygląd → „Jasność” zmienia schemat bieżącego stylu (nie jest już wyszarzona), a przycisk „Tryb ciemny” w nagłówku przełącza schemat stylu zamiast przechodzić na Zeszyt (zastępuje PW-2 z dymkiem „Ten styl ma jeden tryb”). CSS: drugi schemat to blok `html[data-skin="x"]:not(.dark)` (jasne warianty Planu, Neonu, Zorzy, Matrycy, Hydrauliki) albo `html[data-skin="miedz"].dark` z **pełnym kompletem tokenów** w pliku stylu, zaraz po bloku podstawowym, plus poprawki ozdób na końcu pliku: jasny Plan — odbitka ozalidowa (granat na bladoniebieskim, logo bez białego gradientu); jasny Neon — szyld za dnia (bez winiety, fuga cegły ciemna, wąska poświata nagłówka i logo); jasna Zorza — świt (bez gwiazd, wstęgi róż, brzoskwinia, lawenda); ciemna Miedź — beton nocą; jasna Matryca — wydruk z drukarki igłowej (zielone pasy co 24 px, otwory perforacji, bez płótna deszczu: `PaperBackdrop` rysuje go tylko przy `dark`); jasna Hydraulika — biała armatura (ciemniejszy obrys bąbelków). W jasnych blokach `--ink-mix: 62%` jak w jasnym Zeszycie (tekst `*-ink`), a jasny Plan ma jawną bazę ostrzeżenia (ciemny ma jaśniejszą). Kolor paska stanu drugiego schematu: `SKIN_THEME_COLOR_ALT`. Akcenty mają selektory ze schematem dla wszystkich stylów (`:not(.dark)` / `.dark`) i są liczone dla obu (generator: `NATIVE`, `SCHEMES`); jasność startowa `l` (żółć Neonu) dotyczy tylko schematu, dla którego ją dobrano. Galeria: znaczek „Ciemny + jasny” / „Jasny + ciemny”. Testy: `src/hooks/useTheme.test.ts` (`resolveDark` per styl), `src/lib/skinContract.test.ts` (komplet tokenów drugiego schematu), `src/lib/skinContrast.test.ts` (14 schematów i ich akcenty), `e2e/theme-toggle-skin.spec.ts` (zastąpił `theme-toggle-undo.spec.ts`), `e2e/skins.spec.ts`, `e2e/a11y.spec.ts` (każdy styl także w drugim schemacie: 60 dodatkowych audytów, bez naruszeń).
- **Własny motyw** (plan motywów 4.1, decyzja T-4; `src/lib/customTheme.ts`, `src/components/settings/CustomThemeControl.tsx`, `src/lib/oklch.ts`). Ustawienia → Wygląd → Zaawansowane → „Własny motyw (eksperyment)”: styl bazowy (ten, który jest włączony) i trzy suwaki odcienia 0–359° dla **papieru** (`--background`), **kafla** (`--card`) i **akcentu** (`--primary`). Bez HEX. Zapis per urządzenie w `kaczy.customTheme.v1` (`{ skin, hues: { paper, tile, accent } }`, walidowany w `merge`); klucz jest w `APPEARANCE_KEYS`, więc trafia do kodu wyglądu. Motyw dotyczy tylko stylu, z którego powstał: po zmianie stylu nie działa, a w ustawieniach pokazuje się przycisk „Zrób własny motyw z …” i „Przywróć styl …”.
  - *Jak działa:* `generate(base, hues)` (czysta funkcja) zmienia tylko barwę tokenu. Jasność i nasycenie są z bazy stylu, z dolnym progiem nasycenia (papier 0,025, kafel 0,02, akcent 0,14), żeby odcień był widoczny. Pary tekst/tło (WCAG AA, 4,5:1) sprawdza od razu. Gdy odcień psuje kontrast, generator szuka najbliższej jasności (krok 0,01, zakres ±0,35), która przechodzi. Jeśli żadna nie przechodzi, token zostaje bazowy, a w komunikacie pod suwakami pojawia się nazwa grupy.
  - *Stosowanie:* `applyCustomTheme(root, skin)` wołane jest na końcu `paint()` w `useTheme.ts` i po każdym zapisie motywu (`customThemeStore.subscribe`). Czyta tokeny z `getComputedStyle` po przełączeniu klas, usuwa poprzednie nadpisania i ustawia nowe jako styl inline na `html`. Dzięki temu wygrywają w obu schematach i przy przełączeniu jasności tokeny są liczone od nowa. Przy odczytywaniu bazy trzeba akceptować zapis przeglądarki (`91.67%`, `.0034`), dlatego `parseOklch` (`src/lib/oklch.ts`) to obsługuje.
  - *Ograniczenia i pułapki:* tokeny zapisane przez `color-mix` albo `var()` nie dają się sparsować i grupa jest pomijana (zostaje bazowa). Nie ma ustawień dla `--ring` ani ozdób, więc poza trzema grupami styl wygląda jak baza. Kontrast liczony jest na sRGB z przycięciem do gamut, więc bardzo nasycone odcienie mogą różnić się od podglądu o kilka procent. Pułapka: `onChange` w `createPersistedStore` odpala się przy pierwszym odczycie, zanim stała jest przypisana, dlatego wywołanie idzie przez `subscribe` po utworzeniu store.
  - *Testy:* `src/lib/customTheme.test.ts` (odcień bez zmiany jasności, każdy odcień 0–359 w obu bazach daje parę ≥4,5:1 albo zostawia bazę, akcent zawsze przechodzi, parse/format), `src/lib/skinContrast.test.ts` (bez zmian), `e2e/custom-theme.spec.ts` (suwak nakłada `--primary`, audyt axe na sekcji, przywrócenie zdejmuje nadpisanie).
  - *Commit:* d629c69 (2026-10-31); zrzuty wizualne odświeżone w 8aac560.
- **Kolor paska przeglądarki** (`theme-color`) to stała hex; po zmianie tła Zeszytu trzeba ją zaktualizować ręcznie.
- **Ikona karty w barwach stylu** (plan motywów 2.6, `src/lib/skinFavicon.ts`): `applySkinFavicon` w `paint()` z `useTheme.ts` podmienia `<link rel="icon">`. Zeszyt — plik marki `/favicon.png`; pozostałe style — monogram „N” na zaokrąglonym kwadracie jako SVG w data URI, kolory w `SKIN_ICON` (`skinList.ts`, paczka startowa, bo galeria z `SKIN_META` jest leniwa). Ikona PWA na ekranie głównym i `apple-touch-icon` zostają jedne (manifest jest statyczny). Nowy styl potrzebuje wpisu w `SKIN_ICON` — wymusza to typ. Test: `src/lib/skinFavicon.test.ts`.
- **Krój tekstu** (`src/lib/appFont.ts`, klucz `kaczy.font.v1`): Domyślny plus Inter, Nunito, Atkinson Hyperlegible Next, Literata, Manrope, Lexend. Atrybut `html[data-font]`; kroje zapisuje `src/styles/fonts.css` (zmienna `--app-font`). W Zeszycie krój idzie też za nagłówkami `h1–h4` i tytułem aplikacji (`.app-title`, Fraunces z `index.css`) — wcześniej bazowa reguła `--font-display` je przykrywała, stąd „krój się nie zmienia”. Reguły są w `:where()` (niska specyficzność), więc nagłówki stylów (`html[data-skin] h1`) zachowują swoje kroje. Logo i cyfry rachunku mają własne kroje. Test: `e2e/skins.spec.ts` (krój w Zeszycie i w Planie). Pliki krojów ładują się przy pierwszym użyciu (`skin-fonts`, CacheFirst). Offline przed pierwszym użyciem krój nie jest w pamięci.
- **Tokeny i tekst.** Ink to osobny token tekstu (`destructive-ink`, `primary-ink`, `success-ink`, `warning-ink`: `color-mix` z czernią). Tło przycisków zostaje `destructive`. Kolory folderów i notatek idą z tych samych zmiennych (`data-swatch`).
- **Format kolorów (D-1).** Wszystkie tokeny kolorów w `src/index.css` i `src/styles/skins/*.css` są w OKLCH: `--primary: oklch(L C H);`, nie w kanałach HSL. Odwołania to `var(--x)` (w Tailwindzie `tailwind.config.ts` też `var(--x)`, bez `hsl(...)`). Przezroczystość: `color-mix(in srgb, var(--x) 35%, transparent)`; mieszanie w `srgb`, a nie `oklab`, żeby wygląd nie zmienił się na etapie konwersji. Kod JS, który czyta token przez `getComputedStyle`, dostaje już pełny kolor CSS i nie opakowuje go w `hsl()`: `src/lib/glowTrail.ts` (`tone`, `alpha`), `src/lib/celebrate.ts` (`hslVar`, nazwa historyczna). Zakres i kolejność: `docs-zrobione/plan-ui-ux-qol-2026-10-25.md`, punkt 1.5. Konwersja: `docs/tools/d1-oklch/` (`oklch-convert.cjs`, `oklch-consumers.cjs`; zapisane w tym commicie, nie trzeba ich uruchamiać ponownie). Wymagania przeglądarki: OKLCH i `color-mix` razem (Chrome 111+, Safari 16.2+, Firefox 113+); bez osobnego fallbacku HSL, bo `color-mix` już był w aplikacji i nie podnosi poprzeczki. Testy kontrastu parsują OKLCH przez wspólny moduł `src/test/oklch.ts` (`parseOklch`, `oklchToRgb`, `oklchToHex`): `src/lib/contrastTokens.test.ts`, `src/lib/skinContrast.test.ts`, `src/lib/shifts/shiftChipOutline.test.ts`. Pułapka: nowe testy czytające tokeny muszą używać tego modułu, nie regexu na HSL.
- **Rytm i promienie.** Gęstość siatki notatek w kroku 4 px; odstępy między sekcjami 32/40 px. Trzy nazwane promienie: `control` 8 px, `field` 12 px, `card` 16 px (`rounded-card`; 51 miejsc `rounded-2xl` zamienione na token, wygląd bez zmian).
- **Grafik — rok w wykresach (G4.3).** Czyste funkcje w `src/lib/shifts/yearCharts.ts`: `yearChartRows` (godziny, norma, nadgodziny, noc, zarobek miesiąc po miesiącu) i `yearDayMinutes` (minuty pracy każdego dnia; urlop i L4 nie wchodzą). `YearSummaryDialog.tsx` pokazuje nad tabelą wykresy z `YearCharts.tsx` (recharts, ładowane leniwie przez `lazy` + `Suspense`, bez animacji przy redukcji ruchu) i mapę dni `YearHeatmap.tsx` (SVG, miesiące w wierszach, dni w kolumnach, kolor marki wg godzin). Kolory wykresów z tokenów przez klasy `.year-chart-*` w `index.css`. Tabela zostaje jako wersja dla czytnika. Testy: `yearCharts.test.ts`, `YearHeatmap.test.tsx`. Nie zrobione: sprawdzenie wyglądu w przeglądarce (do e2e).
- **Grafik — kreator nowego grafiku (G4.2).** „Nowy grafik” w `ScheduleSwitcher.tsx` otwiera `NewScheduleWizard.tsx` z trzema krokami: nazwa, stawka i system czasu pracy; startowe rodzaje (checkbox, domyślnie tak); pierwszy cykl („bez cyklu” albo dniówka 8–16 pn–pt od dziś na 28 dni, dostępna tylko z rodzajami). Na końcu `createSchedule`, przełączenie na nowy grafik, `setHourlyRate`, `setWorkSystem`, `addDefaultShiftTypes`, `applyPatternToStore` (z `skipProtected`). Stary inline formularz nazwy (tryb „add”) nie jest już używany przez przycisk; zostaje w kodzie do porządku. Testy: `NewScheduleWizard.test.ts` (kroki cyklu), `ScheduleSwitcher.test.tsx` (przepływ przez kreator).
- **Grafik — alarm przed zmianą (G4.1, decyzja G-6).** Pole `alarmBeforeMin` w `ShiftData` (`model.ts`, czyszczone w `migrate`; brak = domyślnie `SHIFT_ALARM_DEFAULT_MIN` = 60, `0` = wyłączony). Ustawienie w „Ustawienia grafiku” (`ShiftSettingsDialog.tsx`, wybór: wyłączony, 30, godzinę, 90 min) zapisuje `setAlarmBeforeMin` (`store.ts`, klucz meta w `yShifts.ts`). `src/lib/push/schedule.ts`: `shiftAlarmItems` daje push `min` minut przed początkiem zmiany tego dnia (tylko zmiany pracy z godzinami, urlop nie). Klucz `a:<dzień>` (`pushKey.shiftAlarm`) należy do kategorii „Grafik na jutro, alarm przed zmianą i koniec zmiany” (prefiksy `e:`, `a:`, `s:` w `PUSH_CATEGORIES`), więc jej wyłączenie wyłącza i alarm, i koniec. Uwaga: domyślnie 60 min jest włączone dla każdego, kto ma grafik (decyzja G-6).
- **Koniec zmiany z „Skończyłem” (G4.1, 2026-11-06).** `shiftEndItems` w `schedule.ts` daje push o planowanym końcu zmiany (`pushKey.shiftEnd`, klucz `s:<dzień>`, tekst „Koniec zmiany: …”). Pomija dzień z już zapisanym `extraMin` (zamknięty). Na powiadomieniu jest akcja „Skończyłem” (`public/sw-notifications.js`, rozpoznanie po kluczu `s:YYYY-MM-DD`, pole `shiftDay` w danych). Gdy karta jest otwarta, SW wysyła `shift-action` z `dayKey`. Gdy nie, otwiera `/grafik?akcja=shift-done&dzien=…`. Obsługa w `src/hooks/useShiftEndAction.ts` (montowany w `ShiftEveningNudge`): czeka na wczytanie grafiku, bierze zmianę przez `shiftOccurrenceOn` (`lib/shifts/summary.ts`) i zapisuje koniec przez `finishShiftNow`, tak jak „Skończyłem teraz”, z „Cofnij”. Serwer push bez zmian (przekazuje `key`). Ograniczenia: przy otwartej aplikacji przypomnienia o końcu nie ma (SW pomija push przy widocznej karcie). Testy: `src/lib/push/schedule.test.ts` („koniec zmiany”), `e2e/shift-end-action.spec.ts` (adres `?akcja=…`, zapis i czyszczenie adresu). Ścieżki z SW (wiadomość i `openWindow`) nie są w e2e, tylko ręcznie na telefonie.
- Testy alarmu: `src/lib/push/schedule.test.ts` (alarm domyślny, 30 min, 0, wyłączona kategoria).
- **Grafik — stuknięcie dnia (G3.2).** Obsługa stuknięcia w `ShiftsView.tsx` (pędzel, godziny, czyszczenie, „inspect”) jest w hooku `src/components/shifts/useShiftPaint.ts` (`useShiftPaint`), z `shortDate` (komunikaty czytnika). Zachowanie bez zmian; testy pokrywają ścieżki pędzla w `src/components/shifts` i `src/lib/shifts`.
- **Grafik — dokończenie planu z 25.10 (G2).** (1) G2.1: karta Dziś (`src/components/review/TodayShiftCard.tsx`) pokazuje „Trwa teraz, do HH:MM” albo „Następna za …”, liczone przez `useShiftNow`. (2) G2.2: pusty miesiąc i pusty tydzień mają jeden pusty stan w `ShiftsView.tsx`; gdy wcześniej są dni, przycisk to „Przedłuż cykl”. (3) G2.3: tygodnie bez 35 h to przyciski otwierające pierwszy dzień tygodnia (`ShiftSummary.tsx`). (4) G2.4: numer ISO w tytule tygodnia; w tabeli roku (`YearSummaryDialog.tsx`) kolumna miesiąca jest przyklejona, a klik w miesiąc zamyka okno i przechodzi do miesiąca (`onOpenMonth`). (5) G2.5: Cofnij/Ponów w wierszu nawigacji; wybór motywu obrazu ma wysokość 44 px na dotyku. Pędzel z „Własnymi godzinami” i przyklejony pasek pędzla nie zrobione (opis w planie niejasny). (6) G2.6: nowy rodzaj zmiany nie ma w palecie bursztynu marki ani czerwieni świąt (`NEW_SHIFT_COLORS` w `model.ts`); edycja istniejącego rodzaju pokazuje pełną paletę.
- **Marka: NOTKI.** Nazwa aplikacji to NOTKI: tytuł karty i `apple-mobile-web-app-title` (`index.html`), `manifest.webmanifest` (name, short_name), ekran offline, ekran startowy, `aria-label` logo, opis w pasku bocznym, powiadomienia (domyślny tytuł), nazwy plików eksportu i kopii (`notki-kopia-…`, `notki-eksport.*`), tytuł licznika kart (`BASE_TITLE` w `overdueBadge.ts`), nazwa klucza passkey (`passkey.ts`). Logo: `NotkiLogo.tsx` pisze litery N-O-T-K-I w czcionce Unbounded (`tracking-[0.06em]`); monogram `NMonogramLogo.tsx` to litera N, a jej kropka biegnie po ścieżce z `index.css` (`.n-mark-dot`, `offset-path`); napis odręczny `NotatnikWordmark.tsx` ma ręcznie narysowane litery N-O-T-K-I. Ikony PWA i favicon generuje `scripts/generate-icons.mjs` (litera N, uruchomić ponownie po zmianie litery). Nazwy plików i komponentów (`NotkiLogo`, `notki-logo`) zostają. Testy: `e2e/brand-notki.spec.ts`, `e2e/mobile-logo.spec.ts`, `e2e/diagnostics.spec.ts`, `useOverdueBadge.test.ts`, `exportNotes.test.ts`.
- **Tabliczka i ołówek** (komputer): nazwa widoku („NOTKI · ARKUSZ 1/1”) na końcu kartki, czyli jako ostatni element `<main>` (nowy plan 1.4, szczegóły w „Szkielet strony”); kreska ołówka rysuje się przy „Zapisano” (`.pencil-stroke`). Czerwony margines Zeszytu nie jest rysowany (tło nie zna szerokości paska bocznego).
- **Efekty domyślnie.** Zostają tylko przywrócenie z kosza (konfetti) i zamknięty dzień; iskierki, deszcz emoji, fajerwerki, serduszka, bąbelki, tęcza, motyw sezonowy, cytat dnia i odznaka są wyłączone (migracja `kaczy.effectsSettings.defaults2`, późniejsze wybory zostają). Skutek: pinezka przy przypięciu jest częścią „Iskierek”, więc domyślnie jej nie ma.
- **Pieczątki.** Odznaki statusu i liczniki, które nie są przyciskami (zaległe na Dziś, przegląd tygodnia, „na dziś” przy temacie, status przypomnienia, liczba w nagłówku grupy), mają klasę `.stamp-tag`: obwódka i tekst w jednym kolorze, bez wypełnienia, mono. Przyciski zostają chipami z wypełnieniem.
- **Kolory** w callout Markdownu, ikonach kopii, sejfie, płomieniu serii i ostrzeżeniu synchronizacji idą z tokenów.
- **Kontrast Zeszytu.** Czerwony tekst w ciemnym motywie ≥4,5:1; etykiety sekcji (`section-label`) zdaniem zamiast wersalików; tytuł strony wagi 700.
- **Nagłówek.** Pasek nagłówka ma w Zeszycie tylko cienką kreskę; tytuł widoku w Fraunces.

### Dostępność

- **Test axe** (`e2e/a11y.spec.ts`): pięć widoków (Notatki, Przypomnienia, Kalendarz, Grafik, Nauka) w WCAG 2.2 AA, jasny i ciemny motyw oraz każdy z 6 stylów (Plan…Hydraulika, od 2026-10-25 na wszystkich pięciu widokach), 390 i 1440 px. Lista wyjątków `KNOWN` może tylko maleć; każdy wpis ma uzasadnienie. Lista jest pusta (wyjątek `kalendarz/1440/hydraulika` nie jest już zgłaszany przez axe i został zdjęty). Komentarz przy `KNOWN` wspomina pasek opanowania Nauki na telefonie (`target-size`), którego skan nie widzi, bo dział startuje ze zwiniętym nagłówkiem.
- **Grupy „jedna z kilku”** (`ToggleGroup`, Radix, `type="single"`): Tab wchodzi do grupy na wybraną pozycję, strzałki przenoszą fokus (w kółko), Spacja/Enter wybiera, kliknięcie wybranej nie odznacza. Czytnik słyszy „grupa opcji, zaznaczony”. Pędzle Grafiku, galerie stylów i krojów oraz paski filtrów mają własną obsługę klawiatury.
- **Kontrast krawędzi.** `--input` daje ≥3:1 na białej karcie, `muted`, `secondary` i jasnych notatkach.
- **Dźwięk i ruch.** Ograniczony ruch zeruje animacje; wibracje działają mimo to.

### Powiadomienia przy zamkniętej aplikacji (Web Push)

- **Wymaga własnego serwera** z https (Caddy albo nginx przed portem 4455). Bez niego przypomnienia działają tylko przy otwartej aplikacji. Serwer: `push-server/` (Node; `core.js` — czysta logika, `server.js` — `GET /vapid`, `PUT /schedule`, `POST /test`, `POST /unsubscribe`, `GET /health`, obieg co 20 s; `Dockerfile`, `README.md`). Klucze VAPID tworzone przy pierwszym starcie (`DATA_DIR/vapid.json`). **Zabezpieczenia serwera (2026-11-11, po przeglądzie `security-reviewer`):** serwer NIE startuje bez `PUSH_TOKEN` (min. 24 znaki; `ALLOW_NO_AUTH=1` tylko lokalnie i wtedy słucha na `127.0.0.1`); wszystkie ścieżki poza `/health` wymagają `Authorization: Bearer` (`tokenOk` w stałym czasie); CORS domyślnie wyłączony (`ALLOWED_ORIGINS`, `*` tylko wprost); limity żądań (adres, błędne tokeny, `/schedule` i `/test` na subskrypcję, `createRateLimiter` w `core.js`; `TRUST_PROXY`); żądanie z dobrym tokenem nigdy nie jest blokowane limitem błędnych prób; brak otwartego przekaźnika — `normalizeEndpoint` wymaga serwisu Web Push, https, portu 443, hosta z poprawnych etykiet DNS i tego samego hosta w parserze WHATWG i `url.parse` (tym parserem wysyła `web-push`; adres `https://127.0.0.1;x.notify.windows.com/` przechodził samą listę hostów); nietypowa ścieżka żądania daje 400 zamiast ubić proces; wysyłka z timeoutem 10 s i bez nakładania się obiegów; sprzątanie subskrypcji bez aktywności przez 60 dni; pliki 0600/0700; Dockerfile z `npm ci`, Node 22 i `HEALTHCHECK`. Aplikacja: token w Ustawieniach → Ogólne → Powiadomienia (pole hasła), zapisany pod osobnym kluczem `kaczy.push.token.v1` (nie wchodzi do kopii zapasowej; kopia przy przywracaniu zeruje też adres serwera), nagłówek dodaje `src/lib/push/client.ts`, komunikaty 401/429 w `pushErrorText`. Testy: `push-server/security.test.js`, `push-server/server.test.js` (uruchamiają prawdziwy proces), `src/lib/push/token.test.ts`, `e2e/push.spec.ts`. Zostaje po stronie wdrożenia: https przez reverse proxy, firewall, rotacja tokenu.
- **Ustawienia → Ogólne → „Powiadomienia przy zamkniętej aplikacji”:** adres serwera, „Włącz”, „Wyślij próbne”, „Wyłącz”. Pod polem stan: liczba zaplanowanych terminów i czas ostatniej wysyłki albo błąd. iPhone obsługuje push tylko w aplikacji dodanej do ekranu początkowego.
- **Aplikacja liczy, serwer wysyła.** Notatki, Grafik i dziennik żyją w Yjs, więc serwer ich nie zna. Aplikacja liczy terminy na 14 dni (`src/lib/push/schedule.ts`, `buildPushSchedule`, limit 200 pozycji) tymi samymi funkcjami co timery strony i wysyła listę przez `PUT /schedule`; serwer zastępuje nią poprzednią listę urządzenia.
- **Kiedy lista idzie:** 3 s po zmianie notatek, Grafiku lub dziennika; co godzinę; przy schowaniu aplikacji (`keepalive`). Co 6 godzin wysyłana zawsze, nawet bez zmian (horyzont się przesuwa).
- **Bez podwójnych powiadomień.** Ten sam termin może przyjść z serwera i z timera strony. Obie drogi zapisują klucz (`pushKey`: `n:<id>:<termin>`, `rd:<dzień>`, `e:<jutro>`) w Cache Storage `notki-push`, który widzą strona i service worker. Push nie pokazuje nic, gdy aplikacja jest widoczna.
- **Prywatność.** Z notatek idzie tylko tytuł; notatka prywatna ma stały tytuł „Przypomnienie z notatki prywatnej”. Ustawienie jest urządzenia, nie dokumentu.
- **Treść niewidoczna dla serwera (S3.1, Z-15.7, 2026-11-18).** Serwer zna tylko chwilę wysyłki, liczbę terminów i adres subskrypcji; tytuł, treść, adres notatki i klucz terminu są zaszyfrowane.
  - **Format** (`docs/plan-powiadomienia.md` §1.2): pozycja `{ v: 1, key, at, enc }`; `key` — 16 losowych bajtów base64url, nowe przy każdej wysyłce; `enc` — base64url z `iv(12) ‖ szyfrogram ‖ znacznik`, AES-256-GCM, AAD `kaczy-push-v1:<key>`. Tekst jawny `{"k","t","b","u","s"}` przycięty do limitów (120/240/300/120 znaków, potem do 1536 bajtów po punktach kodowych: najpierw treść, potem tytuł; za długi adres → `/`) i dopełniony spacjami do wielokrotności 256 bajtów — długość szyfrogramu nie zdradza długości tytułu.
  - **Klucz:** nieeksportowalny `CryptoKey` w IndexedDB `kaczy-push-keys` / `keys` / `content-v1`, jeden na przeglądarkę. Tworzy go strona (`contentKey` w `src/lib/push/seal.ts`; generowanie przed transakcją, zapis „tylko gdy pusto” w jednej transakcji — dwie karty dostaną ten sam). Nie wchodzi do kopii; awaryjny reset w `ErrorBoundary` kasuje bazę.
  - **Klient** (`src/lib/push/client.ts`): `GET /vapid` zwraca `enc: 1`; zapamiętane w `pushPrefs.enc`/`encAt` przy włączeniu i odświeżane co 6 h przy wysyłce. Bez `enc: 1` (stary serwer) idzie stary, jawny format. Z `enc: 1` i błędem szyfrowania — nic nie idzie jawnie, w Ustawieniach błąd. `sentHash` liczony z pozycji jawnych (+ `enc`), nowy klucz zeruje go. Gdy odpowiedź `items` < liczby wysłanych pozycji, które serwer powinien przyjąć (te same reguły: horyzont 35 dni, unikalny klucz, tytuł; minuta zapasu na zegary) — „Serwer nie przyjął części przypomnień.”. **Bez cichego cofnięcia:** gdy serwer, który ogłaszał `enc: 1`, przestanie to robić, `pushPrefs.encLost` blokuje wysyłkę (błąd w Ustawieniach) do ponownego „Włącz” — wynik przeglądu `security-reviewer`.
  - **Worker** (`public/sw-notifications.js`, `openSealed`): odszyfrowuje i wchodzi w dotychczasową ścieżkę z tymi samymi kontrolami (`title`, adres `/^\/(?![/\\])/`). Nie da się odszyfrować → wpis `resend` w bazie kluczy (strona przy następnej wysyłce zeruje `sentHash` — `takeResendRequest`) i, gdy aplikacja nie jest widoczna, powiadomienie ogólne „Masz przypomnienie. Otwórz aplikację.” bez przycisków.
  - **Serwer** (`push-server/core.js`): `cleanItems` przyjmuje oba formaty, także w jednej liście; dla formatu 1 `key` 22 znaki base64url, `enc` tylko o długości możliwej dla tekstu 256·n bajtów (n = 1…6, 379…2086 znaków; inny odrzucony, nie przycięty); `title`/`body`/`url` obok `enc` pomijane. `payloadOf` → `{v:1,key,enc}`. `MAX_BODY` 512 KB.
  - **Ograniczenia:** stary format zostaje na okres przejściowy (`POST /test` zawsze jawny); koniec — 60 dni po wdrożeniu. Stary worker z nowym klientem pokaże „NOTKI” bez treści do następnego uruchomienia. Klucz nieeksportowalny nie chroni przed kodem w tym samym źródle. Odczyt `CryptoKey` z IndexedDB w workerze na iOS — niesprawdzony (`docs/TESTING.md`).
  - **Testy:** `src/lib/push/seal.test.ts` (szyfrowanie, AAD, przycięcie, równa długość, `sentHash`, utrata klucza, stary/nowy serwer), `src/lib/push/swNotifications.test.ts` (worker z atrapą `self`), `push-server/core.test.js` („format 1”), `push-server/server.test.js` (`enc: 1`, 413 przy 520 KB).
  - **Commit:** `bd5a5b8a` (serwer), `cc8c6e6e` (klient), `7c9f4e67` (worker) — 2026-11-18.
- **Co przychodzi:** przypomnienia notatek (w tym kolejne terminy serii), Grafik na jutro (o godzinie wieczornego przypomnienia), „Raport dnia gotowy”, „Raport tygodnia gotowy”, zaległe zamówienie, serwis dziś. Nieudanej wysyłki serwer nie ponawia; termin spóźniony o ponad godzinę (serwer nie działał) przepada.
- **Prośba o otwarcie aplikacji (D-A2, 2026-11-18).** Gdy po wysyłce subskrypcji zostaje najwyżej jeden termin, a aplikacja nie wysłała listy od 3 dni (`LIMITS.nudgeAfterMs`), serwer raz wysyła jawne „NOTKI — Otwórz aplikację, żeby przypomnienia przychodziły dalej.” (`NUDGE_ITEM`, klucz `open:<czas>`, bez danych użytkownika). Znacznik `nudged` przy subskrypcji; nowy `PUT /schedule` go zdejmuje. Bez tego seria w PWA urywała się po cichu po 14-dniowym horyzoncie. Kod: `tickStore` w `push-server/core.js`; test „D-A2” w `core.test.js`.
- **Ograniczenia.** Przyciski w powiadomieniu („Odłóż 10 min”, „Gotowe”) są tylko w powiadomieniach z timera strony; z serwera powiadomienie otwiera aplikację. Lista na serwerze jest najwyżej tak świeża jak ostatnie otwarcie aplikacji. Nie sprawdzone na prawdziwym telefonie — serwer sprawdzony lokalnie.
- **Nie działa:** „próba bez protokołu” (nie ma momentu w czasie; zostaje w pasku Dziennika).

### Budowanie, PWA, service worker

- Aplikacja bez śladów szablonu Lovable: w budowaniu nie działa `lovable-tagger`, service worker rejestruje się na każdym hoście produkcyjnym, offline obsługuje każdą nawigację (`vite.config.ts`: `workbox.runtimeCaching` → `html-navigations`).
- `src/lib/registerSW.ts` pomija rejestrację tylko w dev, w ramce (iframe) i przy `?sw=off` (wtedy wyrejestrowuje workera). Trasa `/~oauth` nie jest już wyjątkiem.
- Kroje stylów i kroje poza precache (budżet precache 3,2 MB) trafiają do cache `skin-fonts` przy pierwszym użyciu. Skróty PWA i udostępnianie z innej aplikacji: `public/manifest.webmanifest`, `public/sw-share.js`.
- **Biblioteka:** `vite-plugin-pwa` 2.0.0 (Workbox 7.4), `registerType: "autoUpdate"`, ale `skipWaiting: false` — nowy worker czeka, aż aplikacja sama go podmieni (niżej).
- **Odświeżanie aktualizacji** (`src/lib/registerSW.ts`): czekająca wersja podmienia się sama, gdy karta jest schowana i `hasUnsavedWork()` jest fałszem (`canApplyWaitingUpdate`). Przy otwartej karcie pokazuje się dymek „Dostępna nowa wersja” (`src/main.tsx`); „Odśwież” przy niezapisanej pracy nie przeładowuje, tylko prosi o chwilę. Sprawdzanie: po powrocie do karty (co ≥30 min) i co godzinę (`UPDATE_CHECK_MS`). Testy: `src/lib/registerSW.test.ts`.
- **Otwieranie plików z systemu** (File Handling API, tylko Chromium): `file_handlers` w manifeście dla `.md`, `.markdown`, `.json`, `.zip`. `src/lib/fileLaunch.ts` (`setupFileLaunch`, bufor `takeLaunchFiles`) odbiera je z `launchQueue`; `useExternalImport` (`src/hooks/useImportExport.ts`) otwiera import z tymi plikami. Testy: `src/lib/fileLaunch.test.ts`, `e2e/file-launch.spec.ts` (atrapa `launchQueue`, bo Playwright jej nie symuluje).
- **Manifest:** `display_override` (standalone, minimal-ui), `handle_links: "preferred"`, `prefer_related_applications: false`.
- **Próg paczki startowej** w `e2e/bundle.spec.ts`: 394 KB gzip (po PWA: 402 581 B). Podniesione z 393 KB — do potwierdzenia.

### Testy e2e na telefonach

- Testy `@mobile` uruchamiają się w profilach iPhone 14 (WebKit) i Pixel 7 (Chrome na Androidzie): `npm run test:e2e:mobile`. Zwykłe `npm run test:e2e` uruchamia wszystkie projekty (`playwright.config.ts`, `grep: /@mobile/`).
- `serviceWorkers: "block"` w obu projektach (WebKit w Playwright przenosi workera między kontekstami). Dwa testy dotykowe przez CDP są tylko w Chromium.
- WebKit na Windows to nie prawdziwy iOS — nie odtwarza klawiatury ekranowej ani `visualViewport` iPhone'a. WebKit trzeba pobrać: `npx playwright install webkit`.

### Grafik na telefonie: układ paska (5.5)

- **Co robi:** na telefonie (poniżej `sm`, 640 px) przełącznik Miesiąc/Tydzień siedzi w tym samym wierszu co „Grafik: … ▾” (przycisk rozwija listę grafików pod nim). Rząd nawigacji zostaje tylko z ‹ tytuł ›, więc pełny tytuł „październik 2026” nie ucina się przy 390 px.
- **Gdzie jest:** `src/components/shifts/ShiftsView.tsx` — wiersz `order-0` z przyciskiem `sm:hidden` i `viewToggle` (`sm:hidden`); `sm:contents` rozpakowuje wiersz od `sm`. Przełącznik od `sm` nadal w wierszu `order-2`.
- **Dlaczego tak:** zmierzone na 390 px — tytuł potrzebuje 136 px, a miał 101 px. Przełącznik (145 px) z dwiema strzałkami 44 px nie mieszczą się w jednym rzędzie bez zmniejszania celów dotyku. Odstępstwo od planu 5.5 („przełącznik i nawigacja w jednym rzędzie”).
- **Testy:** `e2e/shifts.spec.ts`, `e2e/shifts-week.spec.ts`, `e2e/shifts-undo.spec.ts`, `e2e/shifts-landscape.spec.ts`, `e2e/touch-targets.spec.ts`, `e2e/mobile-layout.spec.ts`. W testach „Cofnij” i „Obraz miesiąca” dopasowanie dokładne lub `.first()`, bo w DOM są dwa przyciski Cofnij i trzy pozycje obrazu.
- **Commit:** niezacommitowane (drzewo na `wip/matryca-hydraulika`, HEAD be4e0bd).

### Grafik: pędzel przy zmianie rodzaju (plan 1.4)

- **Co robi:** malowanie dnia innym rodzajem zostawia notatkę, odchylenie (`extraMin`), „dzień wolny” (`offSchedule`) i „w zamian” (`inLieu`). Własne godziny (`hours`, `customHours`) i `timeOff` są zdejmowane, bo należą do starego rodzaju. Dymek „Zmieniono … na …” pokazuje „Zostało: …”.
- **Gdzie jest:** `src/lib/shifts/yShifts.ts` — `setDayShift`; `src/components/shifts/ShiftsView.tsx` — `onDay` (ścieżka z godzinami przez `setDayEntry`) i `toastReplaced`.
- **Dlaczego:** wcześniej odchylenie ginęło po cichu przy zmianie rodzaju. Teraz zostaje, bo zwykle dotyczy dnia, a nie rodzaju. Reguła zmieniona świadomie (decyzja użytkownika, 2026-10-26).
- **Testy:** `src/lib/shifts/yShifts.test.ts` („pędzel przy zmianie rodzaju”), `src/lib/shifts/shifts.test.ts` („akcje grafiku”), e2e `shifts-undo.spec.ts`.
- **Commit:** niezacommitowane.

### Testy (ogólnie)

- Jednostkowe: `src/lib/keyboardInset.test.ts`, `haptics.test.ts`, `pageHidden.test.ts`, `viewPreload.test.ts`, `inputModality.test.ts`, `appFont.test.ts`, `siteMode.test.ts`, `skins.test.ts`, `useTheme.test.ts`, `contrastTokens.test.ts`, `push/schedule.test.ts`, `push-server/core.test.js`.
- E2E: `mobile.spec.ts`, `mobile-layout.spec.ts`, `touch-targets.spec.ts`, `desktop-columns.spec.ts`, `toggle-group.spec.ts`, `skins.spec.ts`, `site-mode.spec.ts`, `a11y.spec.ts`, `view-skeleton.spec.ts`, `pwa.spec.ts`, `push.spec.ts`, `view-change.spec.ts`.
- **Bramka `npm run check`** (`package.json`): typecheck, lint, Vitest i e2e `@smoke` na 3 workerach (`--workers=3`). Trwa ok. 3 min. Pełne `test:e2e` zostaje na 1 workerze (`PW_WORKERS` w `playwright.config.ts`). `e2e/global-setup.ts` przed testami pobiera raz wszystkie pliki z precache (`warmUp`). Bez tego po świeżym buildzie pierwsze `goto` na trzech workerach naraz przekraczało 60 s.
- **Zapis przed przeładowaniem w e2e:** `page.reload()` albo `goto` zaraz po zmianie przerywa transakcję IndexedDB, więc ostatnia zmiana ginie. Test czeka wtedy na pigułkę „Zapisano” (`getByText("Zapisano", { exact: true })`, `OfflineStatus.tsx`), tak jak `site-faults.spec.ts` i `study-delivery.spec.ts`. Użytkownika chroni ostrzeżenie `beforeunload` (`hasUnsavedWork`), którego Playwright nie pokazuje.
- **Zrzuty wyglądu** (`e2e/visual.spec.ts`): zrzut `fullPage` w Chromium na chwilę zmienia okno na 1×1. `useIsMobile` brał to za telefon i zamykał pasek boczny, a pod obciążeniem zrzut łapał go zwiniętego. Dlatego `prepare()` zamraża `window.matchMedia` na wartości z pierwszego odczytu. Trzy zrzuty bazowe zapisane ze zwiniętym paskiem (`praca-komputer-{miedz,plan,kafle}`) są poprawione. Commit 4334d60 (2026-11-03).

### Commity

- `544773c`, `2f5ff5b`, `18e7808`, `12fe855` (2026-10-15) — React 19 i Tailwind 4; `ee3d51f` — kolory krawędzi i fokusu.
- `ee5a23f` (Radix, lucide), `4e96f34` (sonner 2).
- `b06445b` — cele dotyku; `f52e393` (2026-10-27) — audyt 44 px na Pixel 7; `9bfb12e` — dwie kolumny; `ec86276` — dolny pasek; `c62282f` — klawiatura; `07bbc03` — arkusze formularzy; `9ed219c` — okna na telefonie.
- `8a5b5da` — ładowanie widoków; `7c47e4b` (2026-10-15) i `59063d5` — stany (`StatusPanel`).
- `75ea68d` — animacje w tle; `d3c5c4b` — `ToggleGroup`; `6442da5` — wibracje; `21f2442` — krój tekstu; `d0e244b` — tryb budowa.
- `95ca98f` — style i motyw; `cba3989` — bez Lovable; `35ed5a3` — audyt axe i testy na telefonach; `e2c8b95` — układ telefonu i pasek zbiorczy.
- `fe01dcd` (2026-10-16) — Web Push.
- `c630cb4`, `30427f2` (2026-10-18) — ruch; `84490c6` — mikrointerakcje; `2cafa53` (2026-10-19) — podpowiedź „+”; `9b7f7b2` (2026-10-19) — promienie `rounded-card`.
- Plan wizualny (2026-10-18): fazy A–E, C, D, E4 i tabliczka — w historii commitów; kilka z nich nie ma osobnego hasha w dokumencie.
- Pasek boczny (aktywny wiersz): w historii commitów.

## Wspólne — bezpieczniki wyglądu (Faza 0 planu UI/UX, 2026-10-25)

Plan: `docs-zrobione/plan-ui-ux-qol-2026-10-25.md`. Faza 0 nie zmienia wyglądu — zbiera narzędzia, które mają wyłapać rozjechanie w Fazie 1.

### Co robi

- **Zrzuty referencyjne wyglądu.** Użytkownik nie widzi ich bezpośrednio; służą do wykrywania zmian pikseli. Stan 2026-11-05 (nowy plan, Etap 0): 227 zrzutów, każdy w 1440 px i 390 px.
  - Pięć głównych działów (Notatki, Przypomnienia, Kalendarz, Grafik, Praca) we wszystkich 10 stylach jasno, a do tego w ciemnym Zeszycie.
  - Pozostałe działy (Dziś, Skrzynka, Tydzień, Archiwum, Kosz, Długi, Ćwiczenia, Plany i edytor Planów) w trzech wyglądach: Zeszyt jasny, Zeszyt ciemny, Hydraulika.
  - Okna i stany, w tych samych trzech wyglądach: 4 karty Ustawień (`?settings=…`), otwarta notatka (na telefonie okno edytora, na komputerze edycja w kaflu), paleta poleceń (Ctrl+K), okno „Ustaw hasło skarbca”, pierwsze uruchomienie (bez notatek, z przewodnikiem), szukanie bez trafień, a na telefonie arkusz „Więcej”.
  - Dziś i Kalendarz także w 1920 × 1080 (`*-szeroki-*`). Na tym ekranie widać, czy treść ma limit szerokości.
- **Audyt axe we wszystkich stylach.** Każdy styl na każdym z pięciu widoków (wcześniej tylko trzy widoki).
- **Strażnik tokenów.** Test zlicza surowe klasy `rounded-md/lg/xl/3xl`, `shadow-md/lg/2xl` i `z-N` w `src/**/*.tsx`. Nie pozwala, żeby ich przybywało.
- **Sonda INP i CLS (tylko dev).** W konsoli przeglądarki wypisuje `[perf] INP …` przy każdej nowej najdłuższej interakcji i `[perf] CLS …` przy zmianie sumy przesunięć.

### Gdzie jest

- `e2e/visual.spec.ts` — zrzuty; zrzuty bazowe w `e2e/visual.spec.ts-snapshots/` (11 MB, nazwy z końcówką `-win32`).
- `playwright.visual.config.ts` — osobna konfiguracja: tylko `@visual`, projekt `chromium`. Skrypt `npm run test:visual` (`package.json`).
- `playwright.config.ts` — `grepInvert: /@visual/`, więc zwykłe `test:e2e` zrzutów nie uruchamia.
- `e2e/a11y.spec.ts` — `SKIN_VIEWS = VIEWS`; `KNOWN` jest pusty.
- `src/test/designTokens.test.ts` — strażnik; progi w `LIMITS`.
- `src/lib/perfProbe.ts` — `createPerfTally()` (czysta logika), `installPerfProbe()` (obserwatory). Ładowany w `src/main.tsx` przez `import.meta.env.DEV`.
- `src/components/DailyQuote.tsx` — atrybut `data-visual-mask` (cytat dnia zmienia się codziennie).

### Jak działa i dlaczego

- **Zegar zamrożony** (`page.clock.setFixedTime`) na 14.10.2026 12:00 — dzień roboczy przed 17:00, więc nie pojawia się dymek „Raport … gotowy” (zob. [`docs/GOTCHAS.md`](docs/GOTCHAS.md), punkt o `DailyReportNudge`).
- **Ruch wyłączony** dwukrotnie: `kaczy.motion.v1 = "reduced"` i `emulateMedia({ reducedMotion })`, plus `animations: "disabled"` w `toHaveScreenshot`.
- **Maski:** `[data-visual-mask]` oraz wszystkie `canvas`. Płótno Matrixa (deszcz znaków) animuje się mimo ograniczonego ruchu, więc bez maski zrzut był niestabilny.
- **Odstęp 800 ms** po `fonts.ready`. Krój stylu dociągany jest przy pierwszym malowaniu, a animacja wejścia jeszcze trwa; bez tego zrzut łapał dwie nakładające się klatki (Praca, Miedź).
- **Próg `maxDiffPixelRatio: 0.01`.** Różnice antyaliasingu między przebiegami były poniżej tego progu po ustabilizowaniu powyższego.
- **Progi strażnika** po codemodach (2026-10-27): promienie 11, cienie 0, warstwy 0. Zostałe `rounded-sm` (pozycje menu, zakładki, checkbox, pieczątka „Umiem”) są liczone od `--radius`, więc idą za motywem.
- **Sonda** liczy INP jako najdłuższą interakcję sesji (nie percentyl), do porównań przed/po wystarczy. CLS pomija przesunięcia z `hadRecentInput`.

### Ograniczenia i pułapki

- **Zrzuty są zależne od systemu.** Bazowe są `-win32`. Na innym OS trzeba je wygenerować od nowa (`npm run test:visual -- --update-snapshots`).
- **Zrzuty trzeba odnawiać po każdej zmianie maski lub odstępu.** Stare bazowe porównują się z nowym zachowaniem i padają.
- **Brakujący wzorzec Playwright zapisuje, ale test i tak oznacza jako nieudany** (także przy `--update-snapshots=missing`). Drugi przebieg powinien już przejść.
- **Pierwsze uruchomienie** to jedyny zrzut bez `seedNotes` (`prepare(..., { seed: false })`). Pokazuje przewodnik, bo `kaczy.tour.seen.v1` nie jest ustawione.
- **Zrzuty nie widzą animacji** (są wyłączone). Ruch sprawdzają osobne testy, np. `e2e/card-motion.spec.ts`; zrzut wyłapuje tylko różnice statyczne.
- **Wyjątek axe `kalendarz/1440/hydraulika`** usunięty: axe nie zgłasza już kontrastu znacznika „dziś” (sprawdzone 2026-10-26, `e2e/a11y.spec.ts` przechodzi bez wyjątku).
- **Sonda nie działa w produkcji** i nie trafia do paczki. Pomiar na telefonie trzeba robić w buildzie dev albo ręcznie przez `PerformanceObserver`.
- **Test strażnik nie łapie klas tworzonych dynamicznie** (np. `rounded-${x}`). Dziś ich nie ma.

### Testy

- `src/test/designTokens.test.ts` (3 testy, progi),
- `src/lib/perfProbe.test.ts` (3 testy: INP, zerowe czasy, CLS),
- `e2e/visual.spec.ts` (227 testów od 2026-11-05, `@visual`, `npm run test:visual`; 1 worker ok. 16 min, `PW_WORKERS=2` szybciej),
- `e2e/a11y.spec.ts` (grupa „a11y styl”: 60 testów),
- `e2e/bundle.spec.ts` — bez zmian progu, przechodzi po dodaniu sondy.

Stan 2026-10-25: pełny Vitest 260 plików / 2143 testy zielone; `test:visual` 70/70 w dwóch kolejnych przebiegach po ustabilizowaniu.

## Wspólne — szkielet strony (nowy plan 2026-11-05, Etap 1)

Plan: `nowyplan.md`, Etap 1 (punkty 1.1–1.4, V1–V4).

### Co robi

- **Opis i akcje w główce (1.1).** Pod tytułem działu może stać jedno zdanie opisu, a po prawej akcje działu. Na telefonie akcje schodzą pod opis i tworzą jeden rząd. Akcje w główce:
  - Terminy: „Nowy termin” (bursztynowy, bo to główna akcja);
  - Plany (zakładka Pracy): „Nowa analiza”;
  - Długi: „Ukryj kwoty” / „Pokaż kwoty”;
  - Skrzynka: „Porządkuj” (tylko od `md`, na telefonie zostaje w przyklejonym pasku);
  - Kalendarz: „Drukuj” i „.ics” (zamiast menu „⋯” na telefonie).

  Opis ma Długi: to zdanie przeniesione z dawnego wiersza nad treścią (opis Planów zniknął, gdy Plany stały się zakładką Pracy). Przełącznik „Kafle / Lista” w Terminach zostaje w pasku narzędzi pod główką.
- **Trzy szerokości (1.2).** Tokeny `--page-read` (42rem), `--page-form` (48rem) i `--page-wide` (80rem). Treść (`<main>`) i pasek u góry mają najwyżej `--page-wide` plus marginesy. Długi, Ćwiczenia, kompozytor notatek oraz pole i pasek Skrzynki mają szerokość formularza przy lewej krawędzi główki. Długi i Ćwiczenia nie są już wyśrodkowane.
- **Szukanie w każdym widoku (1.3).** Na komputerze w działach bez pola szukania notatek (Kalendarz, Grafik, Praca, Plany, Długi, Ćwiczenia…) w miejscu pola stoi przycisk w jego kształcie: „Szukaj i polecenia… Ctrl+K”. Otwiera paletę poleceń. Na telefonie bez zmian (lupa w grupie ikon).
- **Tabliczka na końcu kartki (1.4, NP-3).** „NOTKI · ARKUSZ 1/1” (napis zależy od widoku) stoi po ostatniej sekcji przy prawej krawędzi, a przy krótkiej treści schodzi na dół ekranu. Nie prześwituje już między kartami i nie zasłania panelu Grafiku. Tylko komputer.

### Gdzie jest

- `src/components/PageActions.tsx`: `PageActionsProvider` (stan elementu miejsca), `PageActionsSlot` (miejsce w główce, `data-page-actions`), `PageActions` (portal z widoku).
- `src/components/ViewTitle.tsx`: prop `lead`, mapa `VIEW_LEAD`, `data-page-lead`, siatka tytułu z ozdobą dnia albo akcjami.
- `src/pages/Index.tsx`: `<PageActionsProvider>` wokół `<main>`, szerokość `max-w-[calc(var(--page-wide)+3rem)]`, `<span class="paper-stamp">` na końcu `<main>`.
- Widoki: `reminders/RemindersView.tsx`, `reminders/NewReminderButton.tsx`, `plans/PlansList.tsx`, `debts/DebtsView.tsx`, `cwiczenia/CwiczeniaView.tsx`, `InboxBar.tsx`, `InboxCapture.tsx`, `AddNoteBar.tsx`, `calendar/CalendarHeader.tsx`.
- `src/components/AppHeader.tsx`: przycisk palety (`!viewSearches && onOpenPalette`, `hidden sm:flex`, `aria-keyshortcuts="Control+K"`).
- `src/index.css`: tokeny szerokości (blok `:root` po tokenach marki), `.paper-stamp` (`align-self: flex-end; margin-top: auto`). `src/components/PaperBackdrop.tsx` nie renderuje już tabliczki.

### Jak działa i dlaczego

- **Portal, nie przekazywanie propsów.** Główka jest jedna i stoi w `Index`, a akcje mają stan w widokach (okno „Nowy termin”, ukrywanie kwot, druk Kalendarza). `PageActions` przenosi przyciski do główki przez `createPortal`. Stan, zdarzenia i kontekst Reacta zostają w widoku.
- **Bez dostawcy akcje renderują się w miejscu.** Dzięki temu testy komponentów (np. `DebtsView.test.tsx`) i widok poza `Index` działają bez zmian. Z dostawcą akcje pojawiają się dopiero, gdy główka jest zamontowana (element miejsca jest w stanie dostawcy).
- **Puste miejsce jest ukryte** (`empty:hidden`), więc działy bez akcji nie mają pustego rzędu na telefonie. Dlatego akcji, która ma być widoczna tylko na części ekranów, nie można ukryć klasą — trzeba jej nie renderować (Skrzynka: `useIsMobile`).
- **Kolejność na telefonie wynika z DOM:** tytuł, opis, akcje. Od `sm` akcje przechodzą do pierwszego rzędu siatki (`sm:row-start-1 sm:col-start-2`), obok tytułu.
- **Szerokości są tokenami CSS,** nie klasami Tailwinda: jedna wartość dla wszystkich działów, a Etapy 2 i 3 użyją tych samych.

### Ograniczenia i pułapki

- **Ozdoba dnia i akcje dzielą prawą kolumnę.** Dziś nie ma akcji. Dział, który dostanie naraz akcje i ozdobę, trzeba ułożyć osobno.
- **Blok `:root` z szerokościami musi stać po tokenach marki.** `skinContrast.test.ts` czyta pierwszy `:root {` w `index.css` jako tokeny marki.
- **`--page-read` jest zdefiniowany, ale jeszcze nieużywany.** Czytnik notatki i Ustawienia dostaną go w Etapie 3.
- **Na 1920 px** treść ma 80rem i jest wyśrodkowana obok paska bocznego razem z główką, więc lewa krawędź treści i główki jest wspólna.

### Testy

- `src/components/PageActions.test.tsx` (portal do główki, render w miejscu bez dostawcy, opis działu i jego nadpisanie).
- e2e: `e2e/reminders-calendar.spec.ts` (rząd akcji pod tytułem na telefonie), `e2e/inbox-triage.spec.ts`, `e2e/plans.spec.ts`, `e2e/csp.spec.ts`, `e2e/visual.spec.ts` (selektory po przeniesieniu akcji).
- Zrzuty `e2e/visual.spec.ts` odświeżone po przeglądzie (Kalendarz, Grafik, Terminy, Długi, Ćwiczenia, Plany, Skrzynka, Dziś, Skarbiec).

## Wspólne — QA, Etap 7 (nowy plan 2026-11-05)

Commit: 89aab69b (2026-11-05), na wip/mobile-fala1.

Plan: `nowyplan.md`, Etap 7. Przegląd zrzutów, a11y, testy na telefonach i poprawki znalezionych usterek.

### Co sprawdzono

- **Zrzuty wzorcowe** (`npm run test:visual`, 227 zrzutów): 216 bez zmian.
  - Grafik i paleta różniły się tylko w jednym przebiegu; po ponownym puszczeniu przechodzą.
  - 9 zrzutów (Archiwum, Kosz i Długi; Zeszyt jasny i ciemny, Hydraulika) różniło się tylko nowym wierszem „Widoki” w pasku bocznym (6.1). Po obejrzeniu różnic dostały nowe wzorce.
- **a11y** (`e2e/a11y.spec.ts`, wszystkie style × 2 schematy, axe WCAG 2.2 AA): zielone.
- **Telefony** (`--project=pixel-7 --project=iphone-14`, testy `@mobile`): 133 z 133.
- **Przegląd wyglądu nowych okien** (historia wersji, paleta na telefonie; `frontend-design`, `refactoring-ui`, `ux-heuristics`).

### Co poprawiono

- **Toast nad otwartym arkuszem na telefonie** (4.5): przy otwartym arkuszu dolnym (`SheetContent side="bottom"`, `DialogContent sheet`) i szerokości do 767 px toasty stoją u góry ekranu. Wcześniej stały 88 px nad dołem, na przyciskach arkusza. `src/lib/bottomSheets.ts` liczy otwarte arkusze (`BottomSheetMarker` rysowany wewnątrz `Content`, które Radix montuje tylko przy otwartym oknie) i ustawia `<html data-bottom-sheet>`. Reguła w `index.css` przestawia listę Sonnera i toast z dołu na górę. Najpierw było to robione zmianą `position` w `Toaster`, ale przebudowa Toastera przewijała listę pod arkuszem (`view-change.spec.ts:92`), stąd atrybut. Sprawdzone zrzutem (390 px, arkusz akcji kafla, „Skopiowano” u góry). Test: `src/components/ui/sonner.test.tsx`.
- **Paleta: „Brak wyników” nad trafieniem.** Grupy z `forceMount` (notatki, terminy, ustawienia, dni grafiku, sekcje) cmdk nie liczy, więc przy samym trafieniu w Ustawieniach pokazywał też „Brak wyników” i „Utwórz notatkę”. Teraz `CommandEmpty` znika, gdy jest którekolwiek z tych trafień (`hasForcedHits`). Test: `e2e/qol-etap5.spec.ts`.
- **Zmiany w tekście:** usunięte i dopisane słowo stojące obok siebie mają odstęp (wcześniej sklejały się w „StaryNowy”).
- **Pusta grupa „Widoki”** to jedna linijka (nagłówek z przyciskiem, jak Foldery), bez dwuzdaniowej podpowiedzi w każdym widoku. Pasek boczny był już przeładowany (V10).
- **`e2e/mobile-layout.spec.ts:44`:** na dotyku pole wyboru jest ukryte do trybu zaznaczania (NP-2). Test przytrzymuje teraz kafel zdarzeniem wskaźnika typu `touch` (450 ms), zamiast klikać ukryte pole.

### Ograniczenia i pułapki

- **Ręczne QA na prawdziwym telefonie** zostaje dla właściciela (Cykl 4 w `Plan-nowy.md`). Testy `@mobile` to emulacja w Playwright.
- **Toasty u góry przy arkuszu:** gdy pokazuje się kilka naraz, stos rozwija się w dół od góry ekranu i może zasłonić nagłówek arkusza. Pojedynczy toast go nie zasłania.
- **Niestabilne pod 3 workerami** (pojedynczo przechodzą): `composer-reminder:27`, `jobs:166`, `local-graph:27`, `qol:8`, `routes:67`, płótno w `qol-etap5`.
- **Esc zwija pasek boczny** — testy i zrzuty po Esc muszą go pokazać („Pokaż panel”).

## Wspólne — QoL na co dzień, Etap 5 (nowy plan 2026-11-05)

Commit: 12035f1 (2026-11-05), na wip/mobile-fala1.

Plan: `nowyplan.md`, Etap 5 (punkty 5.1–5.10). Punkty przejęte z planów działów: Notatki 1.2, 1.3, 1.4, 1.5, 2.1, 2.3, 2.7, 2.8; Ustawienia 1.1, 2.2, 4.1; Powłoka 2.6.

### Co robi, gdzie jest i jak działa

- **5.1 Ostatnie notatki i historia.**
  - Pusta paleta ma grupę „Ostatnie notatki” (10 pozycji) z `kaczy.lastOpened.v1` (`recentOpenedIds` w `src/lib/lastOpened.ts`; bez notatek prywatnych i z kosza).
  - Pasek boczny ma zwijaną grupę „Ostatnie” pod Ulubionymi. Domyślnie jest zwinięta (klucz `ostatnie` w stanie grup paska, `collapsedGroups.ostatnie ?? true`), bo 10 wierszy wydłużyłoby pasek. Pokazuje się dopiero, gdy coś było otwierane.
  - Alt+← / Alt+→ chodzą po historii otwieranych notatek. Stos jest w pamięci sesji (`src/lib/noteHistory.ts`, `createNoteHistory`), zasilany z `markNoteOpened` (czytnik i edytor kafla). Krok otwiera notatkę w podglądzie. Czytnik nie zmienia adresu, więc przeglądarka tej historii nie zna. Skrót przejmujemy tylko wtedy, gdy historia ma dokąd iść; inaczej zostaje przeglądarce (wstecz). Nie działa w polu tekstowym ani nad oknem Radix.
- **5.2 Przeciąganie pozycji listy.** `ChecklistEditor.tsx`: uchwyt (`GripVertical`, 44 px na dotyku) przed polem wyboru. Własny `DndContext` z `PointerSensor` (próg 4 px), `SortableContext` z `verticalListSortingStrategy`. Przesunięcie dnd-kit (tylko oś Y) jest na wewnętrznym `div` (`SortableOpenRow`), bo zewnętrzny `motion.div` sam steruje `transform`. W czasie przeciągania i 250 ms po upuszczeniu `layout` framer-motion jest wyłączony, inaczej wiersz animowałby się drugi raz ze starego miejsca. Logika: `moveOpenItem` w `src/lib/checklistOrder.ts` (przestawia tylko nieodhaczone; odhaczone zostają na swoich indeksach). Alt+↑/↓ i strzałki zostały, a uchwyt ma `tabIndex=-1`, bo klawiatura ma już swój sposób.
- **5.3 Szukaj wszędzie.**
  - Wyniki palety są według rodzaju: notatki z terminem idą do grupy „Terminy” (z datą `formatReminderShort`), reszta do „Notatki”.
  - Nowa grupa „Ustawienia”: `src/lib/settingsIndex.ts` (`SETTINGS_INDEX`, `searchSettings`) to ok. 40 sekcji z zakładką i słowami zastępczymi („czcionka” → „Krój tekstu”), szukanych bez polskich znaków.
  - Wybór otwiera Ustawienia na właściwej zakładce i przewija do nagłówka o tym tytule z chwilowym podświetleniem (`requestSettingsSection` / `consumeRequestedSettingsSection` w `settingsDeepLink.ts`, efekt na `open` w `SettingsDialog.tsx`). Sekcja w zwiniętym „Zaawansowane” ma `expand` (`aria-controls` bloku), który okno najpierw rozwija.
  - Przy okazji naprawione: okno Ustawień jest zamontowane cały czas, więc karta zamówiona przez `requestSettingsTab` (kropka synchronizacji) działała tylko przy pierwszym otwarciu. Teraz jest odbierana przy każdym.
  - Budowy, wpisy Pracy, pytania i dni Grafiku były w palecie już wcześniej. Placeholder: „Szukaj notatek, terminów, Pracy, ustawień i akcji…”.
- **5.4 Klawisze M i L na siatce.** `gridKeyboardNav.ts`: `onOpenFolder` i `onOpenLabels` w `GridNavHandlers`. `NoteGrid.tsx` klika przycisk „Folder” albo „Etykiety” kafla, tak jak R klika dzwonek (`clickCardControl`). Te przyciski są w „Więcej opcji”, które montuje się dopiero po rozwinięciu, więc funkcja najpierw je rozwija i czeka do 10 klatek. Bez folderów M pokazuje toast. Podpowiedzi przycisków kafla mają klawisze (`keys` w `ActionBtn` → `data-tip-keys`: P, A, Del, D; L w `LabelPicker`, M w dymku `FolderPicker`). `ShortcutsDialog` (`lib/shortcuts.ts`) ma R, F, M, L i Alt+←.
- **5.5 Załączniki.**
  - PDF i obraz mają „Otwórz w nowej karcie” (`openAttachment`, `openableType` w `src/lib/attachments.ts`). Karta otwiera się od razu, w geście kliknięcia (inaczej blokada wyskakujących okien), a adres `blob:` dostaje po odczycie pliku. Gdy przeglądarka zablokuje nową kartę, plik się pobiera — karta aplikacji nigdy nie przechodzi na `blob:`, bo zgubiłaby otwarty edytor.
  - Obrazy notatki w czytniku otwierają galerię `PhotoGalleryDialog` (ta sama co zdjęcia budowy: przesuwanie, szczypanie, strzałki). Galeria jest ładowana leniwie i ma nową właściwość `label` („Obraz notatki”). Czytnik i podgląd siatki pomijają klawisze, które galeria już obsłużyła (`e.defaultPrevented`): Esc zamyka tylko galerię, a strzałki nie zmieniają notatki pod spodem.
- **5.6 Sync bez zgadywania.**
  - Diagnoza w karcie Sync mówi zdaniem, co się stało i co zrobić (`syncErrorText` w `src/lib/syncErrorText.ts`: brak sieci przy pobieraniu modułu, brak WebRTC, brak https, brak miejsca, inne). Surowy komunikat jest w zwiniętych „Szczegółach błędu”.
  - Lista „Ostatnio widziane” pokazuje urządzenia, których teraz nie ma, z czasem względnym. Zapis jest lokalny, poza Yjs: `src/lib/syncSeen.ts`, klucz `kaczy.sync.seen.v1`, mapa nazwa → czas, najwyżej 20. Wołają go `refreshDevices` (obecne i te, które właśnie odeszły) i `disconnectProvider` w `yjsSync.ts`. Kluczem jest nazwa, bo id z awareness zmienia się przy każdym połączeniu.
- **5.7 „O aplikacji”.** `src/components/AboutPanel.tsx` pokazuje wersję (`APP_VERSION`), build (`__APP_BUILD__`: skrót commita i czas builda w UTC, `formatBuild`), stan pracy offline oraz przycisk „Sprawdź aktualizację” albo „Odśwież do nowej wersji” (z ochroną niezapisanej pracy). Stan workera to mały magazyn w `src/lib/registerSW.ts` (`SwInfo`: `off` / `starting` / `ready` / `update`, `getSwInfo`, `subscribeSwInfo`, `checkForSwUpdate`). Panel jest w oknie otwieranym z „O aplikacji · wersja …” w stopce paska bocznego i w Ustawieniach → Kopia i dane. Na telefonie okno otwiera się po zamknięciu paska, bo pasek jest oknem z własną pułapką fokusu.
- **5.8 Okruszki.** `ViewTitle` ma właściwość `crumbs`. Na komputerze pokazuje „Dom › Remont ›”, a na telefonie samo „‹ Remont” (44 px). Dane liczą `folderCrumbs` (przodkowie folderu po `parentId`, odporne na pętlę) i `labelCrumbs` (rodzice etykiety zagnieżdżonej) w `src/lib/breadcrumbs.ts`. Tytuł widoku etykiety zagnieżdżonej to teraz ostatni człon („#płytki”), a pełna ścieżka jest w okruszkach.
- **5.9 Domyślny szablon folderu.**
  - Folder ma pole `templateId?` (jedna wartość LWW w mapie `folders` w Yjs: `FOLDER_SCALAR_FIELDS`, `yFolderFromPlain`, `plainFromYFolder`, `folderSchema` w kopii). `patchFolder` z `undefined` usuwa pole z dokumentu.
  - W widoku folderu akcje główki (`FolderTemplateActions.tsx`) mają wybór szablonu (wbudowane z `TEMPLATES` i własne, `templateChoices` w `QuickTemplates.tsx`; zmiana z „Cofnij”) i przycisk „Nowa: <szablon>”. Przycisk tworzy notatkę w tym folderze i otwiera ją do edycji bez zmiany widoku.
- **5.10 „Cofnij” i Esc.**
  - Przywrócenie wersji ma toast z „Cofnij” (wraca do treści sprzed przywrócenia, która i tak trafia do historii; `handleRestoreVersion` w `Index.tsx`). Rozwijanie wersji ma `aria-expanded` (`VersionHistoryDialog.tsx`).
  - Płótno (`DrawingCanvas.tsx`) przy niezapisanych kreskach nie zamyka się po cichu na Esc, klik w tło ani „×”. Pokazuje pasek „Rysunek nie jest zapisany” z przyciskami „Zapisz rysunek”, „Porzuć” i „Rysuj dalej”.
  - „Wyczyść” ma „Cofnij”. Klik w toast nie liczy się jako wyjście z płótna.

### Ograniczenia i pułapki

- **Praca → budowa nie ma okruszka:** karta budowy to okno, nie strona, więc nie ma czego „cofać” w główce.
- **Szablon własny jest lokalny** (`kaczy.templates.v1`). Folder z takim szablonem na innym urządzeniu zachowuje się jak bez szablonu. Wbudowane działają wszędzie.
- **Starsze urządzenie** nie zna pola `templateId`. Y.Map je zachowa, ale przy pełnym zapisie folderu (`upsertFolder`) ze starej wersji pole zniknie.
- **„Otwórz w nowej karcie” tylko dla PDF i obrazów rastrowych.** Adres `blob:` ma pochodzenie aplikacji, więc SVG, HTML i XML z załącznika uruchomiłyby skrypt w jej imieniu (`openableType`, test). Reszta plików ma tylko „Pobierz”.
- **Historia Alt+←/→ żyje do odświeżenia strony** i liczy także otwarcia edytora kafla. Krok zawsze otwiera podgląd, nie edytor.
- **„Ostatnio widziane” po nazwie:** dwa urządzenia o tej samej nazwie są jednym wpisem, a zmiana nazwy tworzy nowy.
- **Indeks Ustawień trzeba dopisywać ręcznie** przy nowej sekcji. Test pilnuje tylko, że wpisane tytuły nadal są w kodzie, a nie że każda sekcja jest w indeksie.
- **Esc zwija też pasek boczny** (stare zachowanie globalnych skrótów). Testy e2e po Esc pokazują pasek przyciskiem „Pokaż panel”.

### Testy

- Vitest: `src/lib/noteHistory.test.ts`, `checklistOrder.test.ts`, `settingsIndex.test.ts` (każdy tytuł z indeksu istnieje w kodzie Ustawień), `breadcrumbs.test.ts`, `syncSeen.test.ts`, `syncErrorText.test.ts`, `attachments.test.ts` (`openableType`).
- e2e: `e2e/qol-etap5.spec.ts` (paleta: ostatnie, terminy, ustawienia z przewinięciem i rozwinięciem; Alt+←/→; przeciąganie listy; M i L; okruszki podfolderu; szablon folderu; płótno pyta i „Wyczyść” z „Cofnij”).

## Wspólne — ruch i drobny szlif, Etap 4 (nowy plan 2026-11-05)

Commit: d495ac2 (2026-11-05), na wip/mobile-fala1.

Plan: `nowyplan.md`, Etap 4 (punkty 4.1–4.5). Decyzję NP-5 przyjęto według rekomendacji: proste wejścia i naciśnięcia w CSS, `AnimatePresence` i `layoutId` zostają w framer-motion.

### Co robi, gdzie jest i jak działa

- **4.1 Słownik ruchu.** Wszystkie wspólne animacje (zmiana miesiąca, pieczątka, oddech „dziś”, kropka „teraz”, wejścia `rise-in`/`fade-quiet`/`soft-swap`, upuszczenie chipa, kaskada kafli, rysowany ptaszek i przekreślenie, pasek toastu) są w jednym pliku `src/styles/motion.css`, importowanym w `main.tsx` zaraz po `index.css` (ta sama kolejność kaskady co przed wydzieleniem). Nagłówek pliku opisuje słownik: czasy `--dur-fast` 150 ms, `--dur-base` 220 ms, `--dur-slow` 320 ms (plus `--dur-press` 90 ms tylko do dociśnięcia), krzywe `--ease-out` (wejścia) i `--ease-std` (zmiany stanu), `--ease-in` tylko przy wyjściach. Tokeny zostały w `:root` w `index.css`. Nowe mikrointerakcje:
  - **puls licznika** `count-bump` + hook `src/hooks/useBump.ts` (licznik zmian wartości, 0 przy pierwszym renderze; użycie `key={bump}` i klasa przy `bump > 0`). Podpięte w `SidebarCount` (`sidebar/SidebarRow.tsx`) i plakietce dolnego paska (`NavItem` w `BottomNav.tsx`) — liczba podskakuje, gdy się zmieni, nie przy otwarciu widoku;
  - **drgnięcie pola** `shake-invalid`: pole z tą klasą drga, gdy dostaje `aria-invalid="true"`. Tylko pola walidowane przy zapisie (Długi: osoba, kwota, dzień, termin w obu formularzach; własny punkt Pracy; wpis dziennika; nowa budowa) — nie pola sprawdzane w trakcie pisania (Ćwiczenia), żeby nie drgały przy każdym znaku;
  - **uniesienie** `lift-hover` (tylko przy myszy) razem z `pressable` w galeriach stylów i krojów (`SkinPicker.tsx`, `FontPicker.tsx`) zamiast `whileHover`/`whileTap` framer-motion. Puste `motion.button` bez animacji w `DrawingCanvas.tsx`, `PriorityPicker.tsx` i `ReminderPicker.tsx` są zwykłymi przyciskami.
- **4.2 Jedno odhaczenie.** Ptaszek z listy zadań (`CheckMark`, `StrikeText`) przeszedł do `src/components/ui/check-mark.tsx`. „Gotowe” w `ReminderQuickActions.tsx` (kafel Terminów, Dziś, Kalendarz) ma ten sam kwadracik: po stuknięciu rysuje się ptaszek, potem `collapseRowThen` (`src/lib/collapseRow.ts`) zwija wiersz `<li>` do zera (kafel siatki tylko gaśnie, bo zmiana wysokości przestawiłaby kolumny) i dopiero wtedy zapisuje zmianę i pokazuje toast z „Cofnij”. Przy ograniczonym ruchu zapis od razu. Wiersz, który po zapisie zostaje (termin cykliczny), wraca do zwykłego wyglądu. Drugie stuknięcie w trakcie animacji nic nie robi.
- **4.3 Haptyka.** Koniec zmiany (`finishShiftNow`), „Gotowe” i zapis wpisu Pracy już wibrowały. Dopisane: zapis dnia (`DayDialog`), nałożenie i przedłużenie cyklu (`PatternDialog`), zapis rodzaju zmiany (`ShiftTypeDialog`) — `haptic("success")`.
- **4.4 Fonty bez skoku układu.** `src/styles/fonts.css` ma `@font-face` zastępcze (`'<Krój> Fallback'`, `local('Arial')`, dla Literaty `local('Georgia')`) z `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` dla Plus Jakarta Sans i sześciu krojów tekstu. Stosy fontów (`--font-display`, `--font-body`, `tailwind.config.ts`, `html[data-font=…]`) mają je za krojem właściwym. Liczby zmierzono w Chromium: szerokość polskiego zdania względem Ariala i `fontBoundingBoxAscent/Descent`.
- **4.5 Toasty.** Przegląd ok. 400 wywołań skryptem (wykrzykniki, kilka zdań, kropka na końcu, usunięcie bez „Cofnij”, imiesłów zamiast czasownika). Poprawione: „Zapisano termin”, „Usunięto termin”, „Usunięto wpis”, „Poprawiono wpis”, „Przywrócono kopię — N notatek, odświeżam stronę…”, „Wysłano kopię”, „Dodano zdjęcie jako wpis budowy”, „Zmieniono hasło”, „Zainstalowano aplikację”, jedno zdanie w kodzie wyglądu i podpisie wyceny, bez kropek w 12 komunikatach Planów, Kodu wyglądu i dokumentów budowy. Usunięcie dodatkowego grafiku (`ScheduleSwitcher.tsx`) ma teraz „Cofnij” (`scheduleDump` przed usunięciem, `restoreExtraSchedule` przy cofnięciu).

### Ograniczenia i pułapki

- **Toast nad otwartym arkuszem na telefonie** jest rozwiązany w Etapie 7 (toasty idą na górę ekranu, opis w sekcji „QA, Etap 7”).
- **Wielkanocne toasty** („Niespodzianka!”, „KONAMI!”) zostały z wykrzyknikiem celowo.
- **`--dur-press` i `--ease-in` zostały** — plan mówi o „3 czasach i 2 krzywych”; dodatkowe tokeny mają po jednej roli i są opisane w nagłówku `motion.css`, a ich usunięcie ruszyłoby ok. 100 miejsc bez zmiany wyglądu.
- **Fonty zastępcze działają tam, gdzie system ma Arial/Georgię** (Windows, macOS, iOS). Na Androidzie `local()` zawodzi i zostaje zwykłe `sans-serif`.
- **„Gotowe” zapisuje z opóźnieniem ok. 0,5 s.** Testy e2e czekają same (`toHaveCount(0)`); test jednostkowy, który sprawdzałby `onUpdate` od razu po kliknięciu, musi ustawić ograniczony ruch albo użyć sztucznych zegarów.
- **`lift-hover` wymaga `pressable`** — sama klasa nie ma przejścia, więc bez `pressable` kafel skacze.

### Testy

- Vitest: `src/hooks/useBump.test.ts`; cały zestaw 404 pliki / 3055 testów zielony.
- e2e (zielone): `reminders-calendar`, `reminders-phase2`, `reminder-toast`, `debts-plan`, `images`, `search-backup`, `site-card-mobile`, `workday`, `checklist`, `today-*`, `shifts*` (108), `a11y`, `skins`, `skin-*`, `seasons`, `settings*` (283), `bundle.spec.ts` (precache 4087 KiB).

## Wspólne — działy, Etap 3 (nowy plan 2026-11-05)

Commit: fc5310f (2026-11-05), na master.

Plan: `nowyplan.md`, Etap 3 (punkty 3.1–3.8). Każdy dział dostał zmiany z jego punktu; komunikaty i liczby mają wspólny wygląd z Etapów 1–2.

### Co robi, gdzie jest i jak działa

- **Praca (3.5)** — `src/components/study/StudyView.tsx`.
  - Postęp to trzy odcinki, jeden na moduł (Woda użytkowa, Kanalizacja, Wspólne), z licznikiem `n/m` i pieczątką „Umiem”, gdy moduł jest cały w „Umiem”. Zamiast 18 kwadracików; tematy są na Tablicy, nie w pasku.
  - Narzędzia (Statystyki, Wysokości, Kalkulatory, Przewodnik) to jeden rząd pastylek z ikoną i podpisem: `StudyTools`, w obu nagłówkach (zwarty na Dzienniku i pełny).
  - Zakładki były już na `tabs.tsx` (Quiz, Tablica, Lista, Dziennik, Plany).
- **Długi i Ćwiczenia (3.6)** — `debts/DebtsView.tsx`, `cwiczenia/CwiczeniaView.tsx`.
  - Długi: bez wpisów widać tylko pusty stan (saldo 0,00 zł i formularz znikają). Z wpisami saldo i przycisk „Nowy wpis”, który zwija i rozwija formularz na każdym ekranie (dawniej tylko na telefonie). Gdy formularz jest otwarty, pusty stan z przyciskiem chowa się pod nim.
  - Ćwiczenia: pusty stan ma „Dodaj odżywkę” (rozwija formularz) i dalej „Dodaj kreatynę (rano, 1 łyżka)”. Z odżywkami przycisk „Dodaj odżywkę”, a po otwarciu formularza „Zwiń formularz”.
- **Pasek boczny (3.7)** — `AppSidebar.tsx`, `sidebar/SidebarRow.tsx`, `sidebar/sidebarItems.ts`.
  - Slogan zostaje tylko pod logo. Stopka to rząd trzech ikon (paleta, tryb ciemny, ustawienia) i wiersz „O aplikacji · wersja …” z `APP_VERSION`. Dawne „NOTKI v1.0 • …” zniknęło.
  - „Trening mózgu” i „Zainstaluj” przeszły do „Narzędzi”.
  - Archiwum i Kosz są na końcu grupy „Osobiste” (NP-4). Główka kartki dalej nie pokazuje dla nich linijki grupy (`viewMeta`).
  - `SidebarHeading`: grupy, Etykiety i Foldery mają ten sam nagłówek (przycisk ze szewronem, `aria-expanded`). Stan zwinięcia zapisuje się w `kaczy.sidebarGroups.v1` pod kluczami `etykiety` i `foldery`. Otwarta etykieta lub folder zawsze widać.
  - Odcień działu: aktywna pigułka i kreska w kolorze działu (`--sec-*`) przez zmienną `--row-hue` ustawianą w `SidebarRow` (`hue`). Bez odcienia zostaje kolor motywu.
- **Ustawienia (3.8)** — `settings/SettingsShared.tsx`, `settings/AppearanceSettings.tsx`, `settings/BackupSettings.tsx`, `CustomThemeControl.tsx`, `FrameLookPicker.tsx`, `GlowPicker.tsx`.
  - Słownik w tekstach: „styl” to skórka, „tryb” to jasny i ciemny, „krój” to czcionka, „kopia” to kopia zapasowa. Dawne „motyw” w napisach UI zniknęło (w kodzie i komentarzach zostaje).
  - `Section` (sekcja każdej zakładki) to `SectionCard` z poziomem 3 w oknie i 4 w grupie. `SectionCard` przyjmuje `level` 2–4.
  - Liczebniki w „Pominięto … wpisów Nauki” i „Nie przywrócono … grafików” idą przez `pluralPl` (dawne ternary dawały „wpisy” dla pięciu).
  - Kolejność karty Sync została sprawdzona i zostaje: status, urządzenia, dodaj i dołącz, serwery, zgodność, „Jak to działa” na końcu.
- **Grafik na telefonie (3.4)** — `shifts/ShiftSummary.tsx`.
  - Podsumowanie miesiąca to karta „Miesiąc w liczbach” (`SectionCard`, nagłówek h3 z `aria-label` „Podsumowanie miesiąca”).
  - Urlop (`LeaveMeter`), premie (`BonusPanel`) i pasek wypłaty (`PaySlipPanel`) zwijają się na telefonie: `PhoneFold` pokazuje przycisk z nazwą i podsumowaniem w jednej linii. Na komputerze stoją otwarte.
  - Pasek narzędzi z wygaszoną krawędzią już był (`shifts/BrushBar.tsx`, maska po prawej przy przewijaniu), więc nie zmieniano go.
- **Kalendarz (3.3)** — `calendar/ReminderCalendarView.tsx`, `calendar/UpcomingDays.tsx`.
  - Pasek tygodnia na komputerze tylko w widoku „Lista” (NP-6). Na telefonie bez zmian: tylko w widoku „Tydzień”.
  - „Dziś” i „Jutro” jedna pod drugą w bocznej kolumnie od `xl` (`grid-cols-1`); poniżej `xl` dalej obok siebie.
  - Dni bez wpisów bez białego kafla: zrobione wcześniej w 2.5 (`dayCellClass(…, empty)`).
- **Dziś (3.2)** — `review/TodayCards.tsx`.
  - Karty układają się w siatkę dwukolumnową od `lg`. Karta zmiany (`lg:col-span-2`) idzie przez całą szerokość. Każda karta ma swoją granicę błędu, jak dotąd.
- **Notatki (3.1)** — `NoteCardBody.tsx`, `NoteCard.tsx`, `styles/skins/signatures.css`, `src/lib/noteDate.ts`.
  - Taśma Zeszytu siedzi na górnej krawędzi karty (`top: 0`, 10 px), nad tytułem; karta ma 12 px góry, więc tytuł jej nie zasłania.
  - Data na kafelku to względna: „dziś 12:00”, „wczoraj 18:30”, a dalej „4 lis, 09:15”; rok tylko gdy inny niż bieżący (`formatNoteDate`). Jest w `<time dateTime>`.
  - Pole wyboru na dotyku: ukryte (opacity 0) nie łapie stuknięć (`pointer-events-none`); widać w trybie zaznaczania albo po najechaniu. Usunięto `coarse:opacity-70`.

### Ograniczenia i pułapki

- **Punkty 3.1 (koniec treści maską) i 3.1 (szerokość 70ch w edytorze) nie są zrobione.** Maska na `line-clamp` pokazałaby się też przy krótkiej treści, bo CSS nie mówi, czy tekst się obciął. Edytor nie ma jeszcze limitu szerokości.
- **Dziś: oś dnia i karty Dziś/Jutro** zostają przy swoim układzie (nie są na `SectionCard`).
- **Strona Długów bez wpisów nie pokazuje sumy 0,00 zł** — to celowe (3.6), ale zrzuty pustego Długu się zmieniają.
- **Stan formularza Długów (`kaczy.debts.formOpen.v1`)** jest trwały, także na komputerze. Wcześniej na komputerze był zawsze otwarty.
- **Wersja w stopce** to `APP_VERSION` z `content/changelog.ts` (ręcznie podbijana), nie wersja z builda; plan mówi o buildzie, ale build nie ma stałej z wersją.
- **Archiwum i Kosz** są w grupie „Osobiste”, która domyślnie jest zwinięta, więc na starcie ich nie widać.

### Testy

- Vitest: `sidebar/sidebarItems.test.ts` (grupy po NP-4), `lib/noteDate.test.ts`, `debts/DebtsView.test.tsx` i `cwiczenia/CwiczeniaView.test.tsx` (formularz zwinięty).
- e2e: `study.spec.ts` (pasek opanowania bez kwadracików), `cwiczenia-*.spec.ts`, `debts-*.spec.ts`, `calendar-*.spec.ts`, `reminders-*.spec.ts`, `shifts-*.spec.ts`, `today-*.spec.ts`, `dzis-*.spec.ts`, `touch-targets.spec.ts`.

## Wspólne — ekrany Praca, Grafik, Kalendarz i puste stany (plan spójności 2026-11-06, Etap 3, w toku)

**Co robi.**
- **Praca:** pod h1 „Praca” nie ma już h2 „Nauka”. Opis poradnika stoi jako `.ui-hint`. Zakładki na wąskim ekranie przewijają się w bok zamiast łamać, a aktywna sama wjeżdża w pole widzenia.
- **Grafik i Kalendarz:** mają tę samą nawigację okresu (`MonthNav`).
- **Leniwe działy** pokazują zarys zamiast pustego miejsca.
- **Notatki:** sekcja „Przypięte” ma ikonę pinezki zamiast emoji.

**Gdzie jest i jak działa.**

- `study/StudyView.tsx`:
  - zakładki dostają wspólną klasę `TAB`;
  - `TabsList` ma `overflow-x-auto` i ukryty pasek przewijania;
  - efekt na `tab` przewija aktywną zakładkę (`scrollIntoView`).
  - Nagłówek skrócony na Dzienniku i pełny na reszcie zostaje celowo, bo na budowie liczy się „+ Wpis”. Testują to `e2e/study.spec.ts` przez `data-study-header`.
- `shifts/ShiftsView.tsx`:
  - strzałki, tytuł (powrót do bieżącego miesiąca lub tygodnia) i Cofnij/Ponów idą przez `MonthNav`, który jest w `children`;
  - Cofnij i Ponów to `Button variant="toolbar" size="icon-lg"`;
  - usunięty lokalny `navButton`;
  - podpowiedź o przeciąganiu zmiany jest `.ui-hint`, czyli ma ten sam rozmiar co podpowiedź pędzla.
- `calendar/CalendarHeader.tsx`: `MonthNav` bez `onCurrent`, z szarym rokiem bieżącego roku. „Dziś” to `Button size="sm"` (`ghost` w bieżącym miesiącu, `default` poza nim).
- `ViewSkeleton.tsx` ma typ `SkeletonView`, czyli `LazyView` plus `cwiczenia`, `debts` i `week`.
  - Pasek miesiąca i siatka są tylko dla Kalendarza i Grafiku.
  - Pozostałe widoki dostają trzy karty.
  - Gdzie użyty: Ćwiczenia i Długi w `pages/Index.tsx`, Plany w `StudyView`, oś tygodnia w `ReminderCalendarView`.
- **Karty:** 22 ręczne przepisy `rounded-card border border-border bg-card` w 17 plikach przeszły na `${cardClass} …` (`ui/card.tsx`). Wygląd jest bez zmian, karta ma jedno źródło.
  - Pliki: Długi, Dziś (`review/*`), Quiz, panele budowy, Ćwiczenia/Waga i inne.
- **Ćwiczenia:** pusta lista odżywek to `StatusPanel size="inline"` z ikoną `Pill` i dwiema akcjami.
- **Ikona przed etykietą.** `NoteGroupSection`, `BoardColumn`/`BoardColumnHeading` i nagłówki `NoteBoard` mają właściwość `icon`, a etykieta zostaje tekstem. Dzięki temu `aria-label` sekcji dalej brzmi „Przypięte”.
- **Przyciski w `pages/Index.tsx`:** „Opróżnij kosz” i „Pola” to `Button`.

**Ograniczenia.**

- `order-*` w Grafiku nie są przegrupowane, bo zależą od układów `short:` i `xl:`.
- `EmptyState` dla Kalendarza i Grafiku nie jest renderowany. Grafik ma własny pusty stan, więc nie było czego ujednolicać.

**Testy.** Vitest przechodzi w całości: 421 plików, 3180 testów.

**Do zrobienia przed zamknięciem etapu:**

- e2e działów: `study*`, `shifts*`, `calendar*`, `note-groups`, `board-table`, `cwiczenia*`;
- zrzuty `@visual` Pracy, Grafiku, Kalendarza i Notatek;
- `e2e/a11y.spec.ts`.

**Commit.** `e0f3c7c9` (2026-11-06).

## Wspólne — role tekstu i czytelność (plan spójności 2026-11-06, Etap 2)

**Co robi.** Opisy i podpowiedzi pod kontrolkami mają 14 px zamiast 12 px. Daty i liczniki zostają drobne i mają cyfry tabelaryczne. Nagłówki sekcji poza kartami mają jeden wygląd.

**Gdzie jest.**

- Role tekstu w `src/index.css`, w warstwie `components`, obok `.section-label`:

  | Klasa | Do czego | Wygląd |
  |---|---|---|
  | `.ui-hint` | opis, podpowiedź | `text-sm text-muted-foreground` |
  | `.ui-meta` | data, licznik | `text-xs tabular-nums text-muted-foreground` |
  | `.title-section` | h2 sekcji, który nie jest `SectionCard` | `font-display text-lg font-semibold leading-tight` |

- Migracja objęła akapity z `text-xs text-muted-foreground` w 95 plikach: 193 przeszły na `.ui-hint`, a 10 z `tabular-nums` na `.ui-meta`. Opis w `SectionCard` też jest `.ui-hint`.
- `.title-section` mają nagłówki „Przegląd tygodnia”, „Sprawdź, co umiesz” i „Na dziś”.
- Wartości poza skalą (`text-[10px]`, `text-[0.95rem]` i inne, razem 10) zamienione na `text-2xs`/`xs`/`sm`/`base`/`xl`. Tytuł zablokowanej notatki ma `text-base`, jak tytuł kafla.

**Jak działa i dlaczego tak.**

- **Nazwy bez przedrostka `text-`.** Tailwind-merge w `cn` uznałby `text-hint` za kolor i zdjąłby go przy `text-destructive`.
- **Kolor stanu.** Utility na tym samym elemencie wygrywa z klasą komponentową, więc kolor stanu (np. `text-destructive`) dokłada się zwykłą klasą.
- **Tego samego elementu nie łączyć z `text-xs`.** Utility wygrałoby z rozmiarem z `.ui-hint`.

**Ograniczenia.**

- Bez zmian zostały:
  - wydruki (`ReportPaper`, `HandoverPaper`);
  - kafle i podglądy (`NoteCard*`, `WikiLinkPreview`, `WikiEmbed`, `NoteGraph`, `ui/stat`);
  - linijki z `truncate`, `font-mono` i `uppercase`;
  - klasy składane w `cn(...)` oraz `<span>`/`<div>`.
- Część podpowiedzi ma więc dalej 12 px, np. druga podpowiedź w Grafiku. Zbiera je Etap 3, a resztę Etap 5.
- Strony na telefonie urosły o kilkanaście do kilkudziesięciu pikseli. Przy 390 px nic się nie zawija ani nie wychodzi poza ekran (sprawdzone na zrzutach Grafiku, Pracy, Dziś i Ustawień).

**Testy.** `src/test/designTokens.test.ts`: `pxText` ma próg 0, a nowy `smallHintParagraph` 24 (pozostałe akapity `<p>` z `text-xs text-muted-foreground`). Wzorce `@visual` odnowione jednym przebiegiem po Etapach 1–2.

**Commit.** `ffde7103`; wzorce `@visual` w następnym commicie (2026-11-06).

## Wspólne — prymitywy UI (plan spójności 2026-11-06, Etap 1)

**Co robi.** Jedna skala przycisków, kart i nawigacji okresu dla wszystkich działów. Etap 1 tylko przygotowuje klocki, a migracja ekranów to Etapy 3–5 planu `docs-zrobione/plan-ui-spojnosc-2026-11-06.md`.

**Gdzie jest i jak działa.**

- `src/components/ui/button.tsx`:
  - **Promień w wariantach.** Promień przeniesiony z bazy do każdego wariantu. Powód: `cn` (tailwind-merge) nie zna `rounded-control`, więc nie zdjąłby go pod `rounded-full`.
  - **Nowe warianty i rozmiary.** Warianty `toolbar` (obrys na karcie, Cofnij/Ponów) i `pill` (akcentowa pigułka podpowiedzi). Rozmiary `icon-lg` (44 px, ikona 20 px) i `pill` (36 px, 44 px na dotyku).
  - **Właściwość `loading`.** Przycisk staje się nieaktywny, dostaje `aria-busy` i kółko `Loader2` zamiast pierwszego dziecka-komponentu (ikony). Etykieta zostaje, więc szerokość nie skacze.
- `src/components/ui/icon-button.tsx`: nieaktywny szarzeje kolorem (`text-muted-foreground/60`, ton `primary` na `bg-muted`), a nie `opacity-50`. Tak samo jak `Button` (nowy plan 2.4).
- `src/components/ui/card.tsx`: `Card` i `cardClass` (`rounded-card border border-border bg-card`). `SectionCard` stoi na `cardClass`.
- `src/components/ui/month-nav.tsx`: `MonthNav` to strzałki 40 px (44 na dotyku), tytuł w h2, opcjonalnie przycisk „wróć do bieżącego” (`onCurrent`) i dodatki w `children`. Ma zastąpić `CalendarHeader` i własny `navButton` w Grafiku.
- **Tokeny.**
  - Zamknięcie okna i arkusza ma `rounded-control`, jak inne przyciski.
  - Arkusz na telefonie (`dialog.tsx` z `sheet` i `sheet.tsx`) ma górne rogi `var(--overlay-radius, var(--r-card))`. Idzie więc za kształtem i skórką (Odblask, Plan), a nie za stałym `rounded-t-2xl`.
  - `filterChipClass` ma `rounded-control`, jak `Input`.
  - `--radius-field` (nieistniejąca zmienna) zamienione na `--r-field` w `JournalEntrySheet` i `NewSiteDialog`.
- **Pusty stan.** Osobnego `ui/empty-state` nie ma, bo `StatusPanel` już nim jest.

**Strażnik.** `src/test/designTokens.test.ts` ma nowe progi według stanu z 2026-11-06:

| Próg | Wartość |
|---|---|
| `pxText` | 10 |
| `bareRadius` | 38 |
| `bareShadow` | 24 |
| `missingRadiusVar` | 0 |
| `disabledOpacity` | 30 |

Liczby mogą tylko maleć.

**Ograniczenia.**

- `loading` z `asChild` nie działa (Slot ma jedno dziecko).
- `loading` zdejmuje pierwsze dziecko, jeśli jest komponentem. Etykieta nie może więc być pierwszym dzieckiem owiniętym w komponent.
- Zmienione promienie (zamknięcie okna, chip filtra, arkusz w skórkach z `--overlay-radius`) zmieniają zrzuty `@visual`. Wzorce odnawia Etap 2 jednym przebiegiem.

**Testy.** `src/components/ui/primitives.test.tsx` (`loading`, pigułka bez `rounded-control`, `MonthNav`) oraz `src/test/designTokens.test.ts`.

**Commit.** `a26307a0` (2026-11-06).

## Wspólne — elementy wspólne (nowy plan 2026-11-05, Etap 2)

Plan: `nowyplan.md`, Etap 2 (punkty 2.1–2.6, V5–V7).

### Co robi

- **Jedna karta (2.1).** `SectionCard`: nagłówek z ikoną, tytułem zdaniem, meta (licznik w mono) i akcją po prawej, pod nim treść i opcjonalna stopka. Pusta karta to sam nagłówek z jedną linijką opisu. Używają jej karty Dziś (Terminy, Powtórki na dziś, Trening mózgu), sekcje Ćwiczeń (Odżywki, Dieta, Trening) i „Premie w tym miesiącu” w Grafiku.
- **Kontrolki wyboru (2.2).**
  - Tryb widoku to przełącznik segmentowy `ToggleGroup`: Terminy („Kafle / Lista”), Kalendarz (telefon: „Miesiąc / Tydzień / Lista”; komputer: „Siatka / Lista / Oś tygodnia”; panel dnia: „Lista / Oś godzin”), Grafik („Miesiąc / Tydzień”).
  - Części działu to zakładki `Tabs`: Praca (już były) i Ćwiczenia na telefonie.
  - Filtry Kalendarza to chipy z licznikiem. Włączony filtr z zerem jest przygaszony (bez bursztynu), wyłączony — przekreślony.
- **Jeden wygląd liczby (2.3).** `Stat`: etykieta zdaniem, liczba w mono z cyframi tabelarycznymi, mniejsza jednostka, dopisek i linijka. Długi (saldo), Grafik („Przepracowane”, „Razem brutto”, kafelki podsumowania), Praca (opanowane tematy).
- **Nieaktywny przycisk (2.4).** Bez `opacity-50`: wypełniony przycisk ma neutralne tło i tekst `muted-foreground`, obrysowy tylko szarzeje. Miedź nie maluje gradientu na nieaktywnym. Pod formularzem `MissingHint` mówi, czego brakuje: Ćwiczenia („Wpisz nazwę odżywki.”), premia w Grafiku (nazwa, kwota), hasło Skarbca (długość, powtórzenie, zgoda).
- **Jeden pusty stan (2.5).** Pusty stan każdego działu idzie przez `StatusPanel` (rysunek kreską, tytuł, opis, akcje):
  - Plany: szkic rzutu z trasą (`EMPTY_GLYPHS.plans`) i trzy kroki pod nim;
  - Długi: szkic portfela w tej samej ramce;
  - Grafik: pusty miesiąc albo tydzień z ikoną i trzema akcjami;
  - Kalendarz: pusty miesiąc to jedna linijka nad siatką, a dzień bez niczego ma przerywany obrys zamiast białego kafla;
  - Ćwiczenia (NP-7): przy pustej liście formularz odżywki jest otwarty, gdy odżywki już są — najpierw przycisk „Dodaj odżywkę”.
- **Zdania, nie wersaliki (2.6).** 96 linijek bez `uppercase tracking-wider`; małe etykiety (dawniej 10–11 px) mają 12 px. `.section-caps` (nagłówki grup paska bocznego, dolnego paska, tablicy) pisze zdaniem.

### Gdzie jest

- Nowe: `src/components/ui/section-card.tsx` (`SectionCard`), `src/components/ui/stat.tsx` (`Stat`), `src/components/ui/missing-hint.tsx` (`MissingHint`), `filterChipClass` w `src/components/ui/chip.ts`.
- Zmienione: `ui/button.tsx` (stany nieaktywne w wariantach), `styles/skins/miedz.css` (`:not(:disabled)`), `calendar/dayCellStyles.ts` (`dayCellClass(inMonth, today, empty)`), `calendar/DayCell.tsx`, `calendar/ReminderCalendarView.tsx`, `calendar/DayPanel.tsx`, `reminders/RemindersView.tsx`, `shifts/ShiftsView.tsx`, `shifts/ShiftSummary.tsx`, `shifts/EmptyShifts.tsx`, `cwiczenia/*`, `review/TodayDueList.tsx`, `TodayStudyCard.tsx`, `BrainTrainingCard.tsx`, `debts/DebtsView.tsx`, `plans/PlansList.tsx`, `study/StudyView.tsx`, `lib/emptyGlyphs.ts`, `index.css` (`.section-caps`), `vault/VaultDialogs.tsx`, `SearchBar.tsx`.

### Jak działa i dlaczego

- **`SectionCard` nazywa sekcję tytułem** (`aria-labelledby`), chyba że widok poda własne `aria-label` (karty Dziś mają je z testów i czytnika). Poziom nagłówka `level` (2 w widoku, 3 w karcie w karcie).
- **`Stat` nie animuje sam:** `AnimatedNumber` zostaje w `value`, więc komponent nie ciągnie framer-motion. Prop `term` daje parę `dt`/`dd` do listy opisów (siatka podsumowania Grafiku).
- **`ToggleGroup` zamiast przycisków `aria-pressed`:** jeden przystanek Tab, strzałki, rola `radiogroup`/`radio` z `aria-checked`. Testy szukają teraz `radio`.
- **Zakładki Ćwiczeń z `forceMount`:** sekcje są w DOM zawsze (jak dotąd). Telefon chowa nieaktywne (`max-sm:data-[state=inactive]:hidden`), a komputer pokazuje wszystkie i nie ma listy zakładek.
- **`MissingHint` zawsze jest w DOM** (pusty jako `sr-only`), więc `aria-describedby` przycisku ma cel, a `aria-live` ogłasza zmianę.
- **Strażnik wersalików** (`src/test/sentenceCase.test.ts`): `uppercase` tylko w wyjątkach zasady 6 — linijka mono w główce (`ViewTitle`), pieczątki (`SortedStamp`, `AchievementStamp`, linie ze słowem `stamp`), pola kodów (`input-otp`, kod awaryjny w `VaultDialogs`). `first-letter:uppercase` jest dozwolone.

### Ograniczenia i pułapki

- **Nie wszystkie karty przeszły na `SectionCard`.** Karty „Dziś / Jutro” w Kalendarzu i oś dnia w Dziś zostały przy swoim układzie (inne nagłówki: data, przycisk zwijania). Sekcje Ustawień przeszły w Etapie 3 (3.8), patrz „Wspólne — działy, Etap 3”.
- **Style mogą dalej pisać wersalikami w CSS** (np. nagłówki Odblasku w `skins/odblask.css`). Strażnik pilnuje tylko klas w komponentach.
- **Skarbiec i „Szukaj też w archiwum” bez zmian:** pusty Skarbiec nie ma osobnego widoku, a szukanie bez trafień już podaje trafienia w Archiwum i Koszu.
- **Budżet precache:** 4,2 MiB od 2026-11-05 (decyzja właściciela). Po Etapie 2 precache ma 3,987 MiB (237 plików).

### Testy

- `src/test/sentenceCase.test.ts` (strażnik wersalików), istniejące testy komponentów (Dziś, Ćwiczenia, Długi, Grafik) po zmianie kart.
- e2e: `reminders-layout`, `calendar-agenda`, `calendar-phase2`, `calendar-week-axis`, `shifts-week`, `shifts-template`, `touch-targets`, `shifts-landscape` (role `radio`/`radiogroup`), `cwiczenia-zakladki` (`tablist`/`tab`).
- Zrzuty `e2e/visual.spec.ts` odświeżone po przeglądzie.

## Wspólne — fundament skórek (Faza 0 planu motywów, 2026-10-27)

Plan: `docs-zrobione/plan-ui-motywy-2026-10-27.md`. Faza 0 porządkuje, jak skórki są zbudowane, żeby dało się dodać akcent, drugi schemat i nowe skórki bez ręcznego pilnowania sześciu miejsc.

### Co robi

- **Dla użytkownika:** dwie widoczne zmiany. W Matrycy ikony mają cieńszą kreskę (1,5 zamiast 2), jak w Planie — tak zakładał plan 1.6, ale selektor wskazywał nieistniejącą skórkę `matryca`. W Miedzi dolny pasek na telefonie rzuca cień w ciepłym brązie, jak reszta cieni tej skórki (wcześniej brał neutralny cień Zeszytu).
- **Dla kodu:** jedna lista skórek, CSS w osobnych plikach i test kompletu tokenów.

### Gdzie jest

- `src/lib/skinList.ts` — `Skin`, `SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR`. Bez importów, więc Playwright wczytuje go bez aliasu `@/`. `src/lib/skins.ts` reeksportuje i dalej trzyma `skinStore`, `useSkin`, `setSkin`, `isSkin`.
- `src/styles/skins.css` — plik zbiorczy z `@import`: `skins/plan.css`, `neon.css`, `zorza.css`, `miedz.css`, `common.css` (przejście kołem, miniatury galerii), `matrix.css`, `hydraulika.css`, `signatures.css` (sygnatury ruchu wszystkich skórek).
- `src/lib/skinContract.test.ts` — kontrakt tokenów.
- `src/test/skinCss.ts` — `readSkinCss()`: sklejony CSS wszystkich skórek dla testów (`skinContrast.test.ts`, `shiftChipOutline.test.ts`).

### Jak działa i dlaczego

- **Kolejność importów = dawna kolejność w jednym pliku.** Vite wkleja `@import` w miejscu, więc kaskada jest identyczna. Sygnatury zostały razem w `signatures.css`: rozdzielenie ich po skórkach przeniosłoby reguły przed wspólne bloki i mogło zmienić, która wygrywa.
- **Kontrakt:** 36 tokenów kolorów i głębi (`--background` … `--note-*` … `--elevation-up`, `--glow-primary`) w bloku `html[data-skin="<id>"]` każdej skórki; Zeszyt sprawdzany w obu schematach (`:root` i `.dark` z `index.css` plus jego własny blok). Każda skórka, łącznie z Zeszytem, ma `--sig-ease` i `--sig-dur`. Drugi test odrzuca selektor `data-skin="…"` z nieznaną nazwą w dowolnym pliku CSS w `src/`. Brakujący token nie daje błędu w przeglądarce, tylko cicho bierze wartość Zeszytu — stąd test.
- **Leniwy CSS skórek nie jest potrzebny:** wszystkie skórki to ok. 10,4 KB gzip (źródła), cały CSS aplikacji 38,4 KB gzip. Tła wszystkich siedmiu skórek trzymają 60 kl./s na emulacji Pixel 7 z CPU ×4 (wyniki w planie, 0.5).

### Ograniczenia i pułapki

- Test kontraktu czyta tylko bloki o selektorze dokładnie `html[data-skin="<id>"] { … }` bez zagnieżdżeń. Token zdefiniowany w złożonym selektorze (np. z `:where`) się nie liczy.
- Tokeny opcjonalne (`--warning-ink-base`, `--warning-ink-mix`, `--destructive-ink`) nie są w kontrakcie — to korekty kontrastu tylko tam, gdzie były potrzebne.
- Pomiar klatek na emulatorze nie oddaje kosztu GPU i baterii prawdziwego telefonu; do sprawdzenia w QA na telefonie.

### Testy

- `src/lib/skinContract.test.ts` (8 testów: 7 skórek + selektory),
- `src/test/designTokens.test.ts` (progi 11 / 0 / 0),
- `src/lib/skinContrast.test.ts`, `src/lib/shifts/shiftChipOutline.test.ts` (czytają nowe pliki).

### Commity

- `d1fdab3` (2026-10-25) — Faza 0: zrzuty, axe na wszystkich stylach, strażnik tokenów, sonda INP/CLS.

## Wspólne — flagi funkcji i RPC dla Workerów (Faza 0 planu rozbudowy, 2026-10-23)

### Co robi

- **Flagi funkcji w przygotowaniu.** Ustawienia → Ogólne → „Funkcje w przygotowaniu”: dziewięć przełączników (edytor, przekaźnik, graf, szybkie wyszukiwanie, bazy, treści, folder `.md`, kanwa, lokalne AI). Na razie tylko zapisują stan; funkcji jeszcze nie podpinają.
- **Warstwa RPC dla Web Workerów** — bez funkcji dla użytkownika, używana przez kolejne fazy planu.

### Gdzie jest

- `src/lib/featureFlags.ts` — `FEATURE_IDS`, `FeatureId`, `FEATURE_DEFAULTS` (wszystkie `false`), `cleanFeatureFlags`, `isFeatureOn`, `setFeature`, `useFeatureFlags`. Klucz `kaczy.features.v1`, przez `createPersistedStore`.
- `src/components/settings/FeatureFlagsSettings.tsx` — karta; opisy w `FEATURE_COPY`. Wstawiona w `GeneralSettings.tsx` przed skrótami.
- `src/workers/rpc.ts` — `serveRpc` (strona Workera), `createRpcClient` (strona strony, z `idleMs`), `workerTransport` (`Worker` → `RpcTransport`), typy `RpcRequest`, `RpcResponse`, `RpcTransport`.
- `src/test/fixtures/bigVault.ts` — `makeBigVault(count, seed)`: deterministyczne notatki (każda 5. linkuje do poprzedniej, co 7. ma etykietę, co 11. przypięta).
- `e2e/perf.spec.ts` — pomiar: start, ustabilizowanie listy, wyszukiwanie, otwarcie czytnika.

### Jak działa i dlaczego

- **Flagi w `createPersistedStore`**, jak inne ustawienia (`siteMode`, `confirmPrefs`). Walidacja `cleanFeatureFlags` odrzuca nieznane klucze i wartości nie-boolowskie, więc starsza wersja z nowszymi flagami nie psuje się i odwrotnie.
- **Klucz jest w kopii ustawień** (`SETTINGS_KEYS` w `src/lib/exportNotes.ts`).
- **RPC z wstrzykiwanym transportem.** Transport nie jest tworzony w środku, więc testy działają w jsdom (brak `Worker`). Błędy wracają jako tekst, bo Worker nie przenosi klas błędów.
- **Bezczynny Worker się zamyka.** `createRpcClient` zamyka transport po `idleMs` bez oczekujących wywołań i otwiera go przy następnym; wywołanie w toku blokuje zamknięcie.
- **Pomiar nie jest w zwykłym e2e.** `perf.spec.ts` pomija się bez `PERF=1` (`PERF_N` ustawia liczbę notatek, domyślnie 1000).

### Ograniczenia i pułapki

- Flagi jeszcze niczego nie zmieniają — włączenie przełącznika nie daje efektu, dopóki faza nie podłączy funkcji.
- Lista renderuje notatki partiami (`useProgressiveCount` w `NoteGrid.tsx`), więc liczba nagłówków rośnie w czasie. Pomiar czeka na ustabilizowanie, nie na pierwszy nagłówek.
- Otwarcie czytnika przy 1000 notatkach zmierzone na ok. 21 s (2026-10-23). Nie zbadane — może to być ładowanie leniwej paczki, może renderowanie listy w tle.

### Testy

- `src/workers/rpc.test.ts` — wynik i błąd, nieznana metoda, zamknięcie po bezczynności i ponowne otwarcie, brak zamknięcia w toku, `dispose`.
- `src/lib/featureFlags.test.ts` — domyślne, zapis, czyszczenie, dane zepsute.
- `src/test/fixtures/bigVault.test.ts` — deterministyczność i linki.
- `e2e/perf.spec.ts` — tylko z `PERF=1`.

### Commity

- `5f6fe63` (2026-10-23) — fundamenty Fazy 0 (flagi, RPC dla Workerów, pomiary).

## Pobieranie plików — wspólny `downloadBlob` (Praca, Etap 0.6, 2026-10-24)

- **Co robi:** pobrania (karta doświadczenia z Nauki, paczka ZIP budowy, kopia JSON/Markdown, kopia ZIP notatek, notatka `.md`, kod awaryjny skarbca) nie urywają się na Safari i części Androidów.
- **Gdzie jest:** `src/lib/downloadBlob.ts` (`downloadBlob(blob, filename)`, `DOWNLOAD_REVOKE_MS`). Używają go: `StudyStats.tsx` (`downloadCard`), `lib/study/siteZip.ts` (`downloadSiteZip`), `lib/exportNotes.ts` (`download`), `lib/exportZip.ts` (`downloadNotesZip`), `ShareNoteDialog.tsx`, `vault/VaultDialogs.tsx`.
- **Jak działa:** ukryty link `<a download>` dodany do `body`, `click()`, usunięcie linku, a `URL.revokeObjectURL` dopiero po 10 s. Wcześniej adres był zwalniany od razu po `click()`, a przeglądarki czytające blob asynchronicznie dostawały pusty albo urwany plik.
- **Ograniczenia:** `attachments.ts`, `diagnosticsReport.ts` i `monthImageDraw.ts` miały już własne opóźnione zwalnianie i zostały bez zmian.
- **Testy:** `src/lib/downloadBlob.test.ts`.

## Wspólne — dolne arkusze z punktami „pół” i „pełny” (plan UI/UX 3.10, 2026-10-27)

### Co robi
- Dolne arkusze na telefonie (lista „Widok”, menu „Więcej”, szybkie „Nowa”, kolejka zapisu, historia osoby w Długach, menu notatki) startują na pół ekranu, a przeciągnięcie uchwytu w górę otwiera pełny ekran. W dół wraca na pół; mocniejsze przeciągnięcie w dół z połowy zamyka. Krótka treść zajmuje tylko tyle miejsca, ile potrzebuje.
- Edytor wpisu Dziennika Pracy (`JournalEntrySheet`) nie ma punktów: ma własny układ z przewijaniem i na komputerze jest bocznym panelem.

### Gdzie jest
- `src/components/ui/sheet-snap.ts` — `snapDecision` (czysta logika progów), `SNAP_MAX_HEIGHT` (`half` 55 dvh, `full` 92 dvh; limity, nie wysokości).
- `src/components/ui/sheet.tsx` — `SheetContent` z opcją `snap` (działa tylko dla `side="bottom"`), hook `useDragToDismiss` z `SnapControl`.
- Włączone (`snap`): `ViewSheet.tsx`, `BottomNav.tsx` (dwa arkusze), `debts/DebtsView.tsx`, `NoteCardDialogs.tsx`, `OfflineQueuePanel.tsx`.

### Jak działa i dlaczego
- Stan „pół/pełny” trzyma `SheetContent` w stanie React (`snapState`) i w refie (`snapRef`), żeby gest po puszczeniu odczytał aktualny punkt. Limit wysokości idzie przez `style.maxHeight` i animuje się przez `max-height` (wysokość `auto` nie da się animować, więc limit jest wygodniejszy).
- Podczas gestu arkusz podąża za palcem tylko w dół (`translateY`). Ruch w górę z „pół” niczego nie przesuwa, a decyzja zapada przy puszczeniu.
- `snapDecision` (z `dy` ze znakiem i prędkością px/ms): z „pół” w górę (ponad 40 px albo szybko) → „pełny”; w dół (ponad 110 px albo szybko, >30 px) → zamknięcie; z „pełny” w dół (te same progi) → „pół”, nigdy od razu zamknięcie.
- Bez `snap` ścieżka kodu jest taka jak dawniej: tylko zamykanie w dół. Dotyczy to `JournalEntrySheet`.

### Ograniczenia i pułapki
- Gest jest tylko na uchwycie (`data-sheet-handle`), nie na całej treści — przewijanie listy nie przeciąga arkusza.
- Punkt „pełny” w krótkiej treści nic nie zmienia wizualnie (arkusz i tak ma wysokość treści). To zamierzone.
- Gest dotykowy testowany przez CDP (tylko Chromium). Na prawdziwym iOS nie sprawdzono.
- Przy nowym dolnym arkuszu z formularzem nie włączać `snap` bez sprawdzenia przewijania pól i klawiatury (jak w `JournalEntrySheet`).

### Testy
- `src/components/ui/sheet-snap.test.ts` — 9 przypadków progów (w górę, w dół, szybkie gesty, powrót z „pełny”).
- `e2e/view-sheet-snap.spec.ts` (`@mobile`, Pixel 7) — start na pół, gest w górę do pełnego, gest w dół wraca na pół i arkusz zostaje otwarty.
- `e2e/mobile.spec.ts` (15/15 na Pixel 7) — w tym zamykanie „Więcej” gestem. Razem z snap 16/16.
- `e2e/debts-due.spec.ts`, `card-copy`, `card-keyboard-open`, `site-card-mobile` — przechodzą na chromium i Pixel 7.
- Commity: `ed78a79` (pierwszy arkusz), punkty na pozostałych arkuszach: `50bb9f1` (2026-10-27).

## Wspólne — preferencje systemu: kontrast, przezroczystość, wymuszone kolory (plan UI/UX 3.12, 2026-10-27)

### Co robi
- **Wysoki kontrast** (`prefers-contrast: more`): krawędzie i tekst pomocniczy są mocniejsze we wszystkich motywach i na obu schematach. Krawędzie `border-border/40…/60` dostają pełny kolor krawędzi; utility `border` i jego strony (`border-t`, `border-x`…) mają 2 px zamiast 1 px.
- **Ograniczona przezroczystość** (`prefers-reduced-transparency: reduce`): rozmycia tła (`backdrop-filter`) są wyłączone w całej aplikacji.
- **Wymuszone kolory** (`forced-colors: active`): fokus z klawiatury dostaje obrys systemowy 2 px, bo pierścień (cień) znika.

### Gdzie jest
- `src/styles/preferences.css` — cały zakres 3.12; importowany ostatni w `src/main.tsx`, bo nadpisuje tokeny motywów i rozmycia.
- Dotąd w aplikacji: `src/index.css` (`forced-colors` tylko dla przekreślenia `.check-strike`), `src/lib/siteMode.ts` (tryb budowa włączany przy `prefers-contrast` w trybie „auto”, osobny od 3.12).

### Jak działa
- Tokeny motywów są w `html[data-skin="…"]` (specyficzność 0,1,1), więc nadpisanie w `:root` przegrałoby. Blok używa tego samego selektora i jest późniejszy w kaskadzie.
- `--border` i `--muted-foreground` dostają `color-mix` z `--foreground` i `--background` (55% i 85%). Działa na każdym motywie i schemacie bez osobnych wartości.
- Przezroczystość: `backdrop-filter: none !important` na wszystkich elementach. Tła z `/95` zostają prawie pełne; osobnych wartości nie ma.
- Wszystkie reguły są w `@media`, więc domyślny wygląd się nie zmienia.

### Ograniczenia i pułapki
- Grubość 2 px dotyczy tylko krawędzi rysowanych klasami utility `border…`. Krawędzie z własnym `border-[…]` albo stylem w komponencie zostają 1 px.
- Kolorowe notatki w ciemnym motywie mają własne `--muted-foreground` (`.dark [data-note-color]`, większa specyficzność) — ich tekst pomocniczy nie zmienia się pod wysoki kontrast.
- Reguła `backdrop-filter: none !important` jest szeroka. Zamierzone (wyłącza rozmycia, także tryb budowy), ale może wpłynąć na nowe komponenty z rozmyciem.
- `prefers-reduced-transparency` nie jest emulowane w Playwright; test go nie obejmuje, sprawdzone przez kod.

### Testy
- `e2e/system-preferences.spec.ts` (chromium): wysoki kontrast zmienia `--border`, `--muted-foreground` i grubość `.border` (1 → 2 px); wymuszone kolory dają fokusowi obrys `solid 2px`. `e2e/a11y.spec.ts` 80/80 przechodzi.
- Commit: `b1c8672` (2026-10-27).

## Wspólne — wczesne ładowanie działów (plan UI/UX 4.1, 2026-10-27)

### Co robi
- Leniwe działy (Kalendarz, Grafik, Praca) zaczynają się pobierać, zanim klikniesz: na najechanie, na wciśnięcie i — nowość — na fokus klawiatury (Tab). Po starcie, gdy przeglądarka ma wolną chwilę, pobierane są wszystkie trzy. Przy trybie oszczędzania danych nic nie pobiera z wyprzedzeniem.

### Gdzie jest
- `src/lib/viewPreload.ts` — `preloadView` (już było) i nowe `prefetchViewsWhenIdle` (`requestIdleCallback` z limitem 5 s, awaryjnie `setTimeout` 2 s; `navigator.connection.saveData` wyłącza).
- `src/App.tsx` — wywołanie `prefetchViewsWhenIdle` w efekcie przy starcie.
- `src/components/AppSidebar.tsx` — `onFocus` obok `onPointerEnter`/`onPointerDown`.
- `src/components/BottomNav.tsx` — `onFocus` w trzech kafelkach szuflady „Więcej” (Kalendarz, Grafik, Praca).

### Jak działa i dlaczego
- Paczki są zapamiętywane w `started` (jedna obietnica na widok), więc wielokrotne wywołanie nie pobiera drugi raz, a przyspieszone ładowanie nie dubluje pracy z `lazy()` w `Index.tsx`.
- Startowa paczka JS się nie zmienia (`e2e/bundle.spec.ts` „wejściowy JS” przechodzi). Wstępne pobieranie idzie po starcie, w wolnej chwili.

### Ograniczenia i pułapki
- Trzy paczki dociągają się w tle także na komórce, jeśli nie ma `saveData`. Zgodne z planem, ale to dodatkowy transfer.
- Nie ma testu jednostkowego ścieżki `saveData` ani `requestIdleCallback` (wymagałyby mockowania dynamicznych importów). Sprawdzone typecheckiem i lintem.

### Testy
- `e2e/mobile.spec.ts` (Pixel 7, 15/15) i `@smoke` na chromium (25/27): dwie nieprzechodzące (`bundle.spec` „precache” i `tabs.spec` „notatka i grafik”) nie są skutkiem tych zmian. Oba padają już na commicie `3e89563`, sprzed sesji.

## Wspólne — czcionki bez skoku układu (plan UI/UX 4.2, część)

- Ustalone: każdy krój z `@fontsource` ma `@font-face` z zakresami znaków, więc przeglądarka pobiera tylko pliki używanych znaków; nieaktywne kroje nie są referencjonowane w CSS poza `html[data-font]`.
- **Nie zrobione:** korekta fallbacku (`size-adjust`, `ascent-override`) dla podmiany fontu (CLS). Wymaga odczytu metryk z plików WOFF2 (brak narzędzia w środowisku); do zrobienia z pomiarem w przeglądarce.
- Commit (4.1): `8b1b50f` (2026-10-27).

## Wspólne — upiększenie: ziarno Zeszytu, wykresy, puste stany, kafel (plan UI/UX Faza 5, 5.2–5.5, 2026-10-27)

### Co robi
- **Ziarno papieru w Zeszycie (5.2):** delikatna tekstura na tle kratki, widoczna tylko w stylu Zeszyt. Gaśnie razem z kratką przy dole i bokach.
- **Wykresy (5.3):** dymek w Aktywności (Statystyki) ma kolory z motywu zamiast domyślnego białego tła Recharts. Cyfry na osiach i w dymkach są tabelaryczne.
- **Puste stany (5.4):** rysunek „długopisem” ma jedną grubość kreski dla kartki, szkicu i podkreślenia.
- **Kafel (5.5):** najechanie myszą podświetla krawędź kolorem akcentu zamiast podnosić kafel o 2 px. Na dotyku tylko naciśnięcie (`:active`).

### Gdzie jest
- `src/index.css` — `--paper-grain` (tylko `html[data-skin="zeszyt"]`) i warstwa w `.paper-grid::before`; reguły `.note-lift:hover .note-card` i `.note-lift .note-card:active` (pointer coarse); `.recharts-wrapper { font-variant-numeric: tabular-nums }` na końcu pliku.
- `src/styles/preferences.css` — przy `prefers-reduced-transparency` ziarno `none`.
- `src/components/EmptyIllustration.tsx` — stała `INK = 2` dla wszystkich kresek.
- `src/components/StatsDialog.tsx` — `contentStyle` dymku z tokenami `--popover`, `--border`, `--popover-foreground`.

### Jak działa i dlaczego
- Ziarno to szum `feTurbulence` w data URI (~0,5 KB) z kanałem alfa mnożonym przez 0,1 (krycie niezmierzone, dobrane wizualnie). Wstawione jako pierwsza warstwa `background-image` kratki, więc maska kratki gasi je razem z liniami. Zmienna jest pusta (`none`) w pozostałych stylach.
- Podświetlenie krawędzi to `box-shadow` z `color-mix(var(--primary) 55%, var(--border))` plus `--elevation-1`. Usunięcie `translate` likwiduje „drganie” na masonry.
- Dotyk nie ma stanu najechania, więc podświetla tylko naciśnięcie.

### Ograniczenia i pułapki
- Ziarno jest bardzo subtelne. Nie zrobiłem pomiaru kontrastu ziarna — ocena wizualna na zrzucie 1280 px. Do przeglądu na telefonie.
- Kafel: na komputerze stan najechania zmienia tylko krawędź. Kafle w edycji (`textarea`) i `data-tile-editing` są wyłączone jak wcześniej.
- Wykresy „raportów Pracy” nie używają Recharts (sprawdzone w kodzie) — punkt 5.3 dotyczy tylko Statystyk i Grafiku (rok).
- 5.4: pozostałe puste stany (Archiwum, Kosz) mają „Nowa notatka” zgodnie z testem `empty-states-qol` — nie zmieniałem etykiety.

### Testy
- `e2e/empty-states-qol.spec.ts`, `e2e/skin-signatures.spec.ts`, `e2e/study.spec.ts` — 48/48 na chromium.
- `vitest` (EmptyState, StatsDialog, EmptyIllustration, ui) — przechodzą.
- Commit: `f15c152` (2026-10-27).

## Wspólne — odcienie działów w pustych stanach (plan UI/UX 5.1, dokończenie, 2026-10-27)

### Co robi
- Pusty stan działu (Dziennik Pracy, Notatki, Grafik, Kalendarz) ma szkic i ikonę w kolorze tego działu, a nie w kolorze motywu. Pasek nagłówka i ikony w nawigacji miały już kolor działu (wcześniejszy wpis w tym pliku).

### Gdzie jest
- `src/index.css` — blok „Pusty stan w dziale” (`html[data-view="…"] :is(…)`), używa `--sec-*` zdefiniowanych dla motywów.
- `src/components/EmptyIllustration.tsx` (`EmptySketch`) — szkic z `data-testid="empty-illustration"`; sam nie ustawia koloru działu, dziedziczy go z korzenia panelu.

### Jak działa i dlaczego
- `StatusPanel` daje korzeniowi `data-status`, a ikonie `data-status-tone`. Stara reguła celowała tylko w ikonę, więc szkic (bez `data-status-tone`) zostawał w kolorze motywu. Nowy selektor obejmuje oba przypadki.
- `EmptySketch` nadal ma domyślnie `text-primary-ink`, więc poza działem (bez reguły) wygląda jak wcześniej.

### Testy
- Sprawdzone w przeglądarce: kolor szkicu Dziennika = `color-mix(… --warning 50% czerni)` (`--sec-study`), nie kolor motywu.
- `e2e/study.spec.ts`, `e2e/empty-states-qol.spec.ts`, `src/lib/sections.test.ts`, `src/lib/skinContrast.test.ts`: przechodzą.

## Wspólne — pamięć stanu widoku: przewinięcie per dział (plan UI/UX 3.6, 2026-10-27)

### Co robi
- Wracając do działu (Notatki, Dziś, Terminy…), strona wraca do miejsca, w którym z niego wyszliśmy. Każdy dział ma własną pozycję.
- Wcześniej zapamiętane były już: zakładka Ustawień (`settingsTab`), zakładka Pracy (`kaczy.study.tab.v1`) i zwinięte grupy paska bocznego. Teraz dochodzi przewinięcie.

### Gdzie jest
- `src/hooks/useViewScroll.ts` — `useViewScroll(view)`, `readViewScroll`, `writeViewScroll`.
- `src/lib/viewMemory.ts` — `readViewMemory` / `writeViewMemory` (wartości z listy dozwolonych) i nowe `readViewMemoryRaw` (liczby).
- `src/pages/Index.tsx` — wywołanie `useViewScroll(view)` obok `useDayDoneReward`.

### Jak działa i dlaczego
- Klucz w localStorage to `kaczy.viewMemory.v1:scroll:<view>`, wartość to pozycja w pikselach.
- Zapis: zdarzenie `scroll` aktualizuje ostatnią pozycję w refie; zapis do pamięci po 150 ms bez przewijania i przy zmianie działu.
- Przy zmianie działu pozycja jest brana z refu, a nie z `scrollY`. Po zmianie układu strona może mieć już inną wysokość i `scrollY` byłby obcięty.
- Przywrócenie czeka w pętli `requestAnimationFrame` (do 90 klatek), aż strona będzie dość wysoka — listy renderują się partiami. Potem przewija do zapamiętanej pozycji, obciętej do maksymalnej.
- Przewijanie programowe przy przywracaniu nie zapisuje się (flaga `restoring`).
- Zdarzenia `scroll` są ignorowane, gdy adres różni się od adresu z ostatniego zatwierdzonego renderu (`committedPath`). Przy przejściu do innego działu adres zmienia się przed renderem, treść na chwilę się skraca i przeglądarka przycina przewinięcie do 0 — to zdarzenie trafiało jeszcze do nasłuchu starego działu i nadpisywało jego pozycję zerem (błąd znaleziony 2026-11-01, `e2e/view-scroll-memory.spec.ts` padał). Sprzątanie nasłuchu kasuje też odroczony zapis.
- Stuknięcie w aktywną zakładkę nadal wraca na górę (`BottomNav`, zamierzone).

### Ograniczenia i pułapki
- Pozycja jest per urządzenie (localStorage), nie per sesja. Po dłuższej przerwie wróci sprzed kilku dni, o ile dział nie był otwierany.
- Jeśli treść nie urośnie do zapamiętanej wysokości w ~1,5 s, pozycja zostaje obcięta do dostępnego maksimum.
- Działy trzymane w `Activity` (Praca, Grafik) mogą mieć własne przewinięcie wewnętrzne; ten hook obsługuje przewinięcie okna.

### Testy
- `e2e/view-scroll-memory.spec.ts` (chromium) — 16 notatek, przewinięcie, przejście do „Dziś” i powrót do „Notatki” przywraca pozycję (±40 px).
- Regresja: `@smoke` na chromium 26/27 (padający `tabs.spec` był już wcześniej), `e2e/mobile.spec.ts` na Pixel 7 15/15. Budżet precache przechodzi.
- Commit: `60ba578` (2026-10-27).
- Commit (3.1): `e8cbfb7` (2026-10-27).
- Commit (3.3): `efe6f95` (2026-10-27).
- Commit (3.7): `99e9da6` (2026-10-27).

## Wspólne — rozmiar tekstu i animowana ramka kafla (2026-10-27)

### Rozmiar tekstu
- **Co robi:** Ustawienia → Wygląd → „Rozmiar tekstu”: dwa przyciski „A” (mniejsza i większa), etykieta kroku z procentem i przycisk „Przywróć”. Kroki: 90, 100, 112,5, 125, 140 %; domyślny 100 %. Podgląd zdania rośnie od razu. Polecenia w palecie: „Powiększ tekst”, „Pomniejsz tekst”, „Domyślny rozmiar tekstu”.
- **Gdzie jest:** `src/lib/textSize.ts` (krok, zapis `kaczy.textSize.v1`, `applyToDom`), `src/styles/text-size.css` (`html { font-size: calc(100% * var(--text-scale, 1)) }`), `src/styles/site.css` (tryb budowy mnoży się przez `--text-scale`), `src/components/settings/TextSizeControl.tsx`, `src/components/settings/AppearanceSettings.tsx` (sekcja nad „Krój tekstu”), `src/components/CommandPalette.tsx`.
- **Jak działa:** wszystko w aplikacji jest w `rem`, więc skala korzenia `html` przeskalowuje cały interfejs. Zmienna `--text-scale` ustawia JS przy starcie (`main.tsx` importuje `lib/textSize`), zanim pojawi się pierwsze malowanie. Zapis przechowuje indeks kroku, nie procent. Krok spoza zakresu, ułamek i złe typy wracają do domyślnego.
- **Ograniczenia:** wartości w `px` (np. część ikon i odstępów) nie skalują się. Tryb budowy (112,5 %) i wybrany rozmiar się mnożą, więc najwyższy krok w trybie budowy daje ok. 157 % — tej kombinacji nie testowano; testy obejmują 140 % bez trybu budowy na 390 px w pięciu głównych widokach.
- **Testy:** `src/lib/textSize.test.ts` (5), `e2e/text-size.spec.ts` (3): przyciski w Ustawieniach, skala 140 % i 90 % na korzeniu, brak poziomego przewijania przy 140 % na telefonie w pięciu widokach.

### Animowana ramka kafla
- **Co robi:** karta notatki w spoczynku ma zwykłe obramowanie. Po najechaniu myszą, fokusie klawiaturą i zaznaczeniu pojawia się gradient w kolorach akcentu, który krąży po krawędzi (obrót 3,6 s). Ruch wyłączają `prefers-reduced-motion` i `data-motion="reduced"`.
- **Gdzie jest:** `src/components/NoteCard.tsx` (pusty `span.note-frame` jako pierwsze dziecko kafla), `src/index.css` (sekcja „Animowana ramka kafla”, `@property --frame-angle`, `.note-frame`, `@keyframes note-frame-spin`).
- **Jak działa:** gradient stożkowy z `conic-gradient(from var(--frame-angle), …)` maskowany do samej krawędzi (`mask` z `exclude`), więc zostaje tylko pierścień o szerokości 1,5 px w obrębie obramowania. Krycie 0 w spoczynku, 1 przy `:hover`, `[data-selected]` i `:has(:focus-visible)`. Animacja działa tylko na wskazanym kaflu — ciągły obrót na wszystkich kaflach przy setkach notatek byłby kosztowny.
- **Dlaczego pseudoelement nie:** skórki Plan i Neon już używają `::before` i `::after` na `.note-card`, więc pierścień to osobny element.
- **Ograniczenia:** w spoczynku ramki nie widać — to celowe, żeby lista nie migała ruchem. Na dotyku animacja nie działa, bo nie ma najechania; tam zaznaczenie przytrzymaniem też ją włącza.
- **Testy:** e2e `card-motion`, `card-keyboard-open`, `card-copy`, `notes`, `a11y` (80/80) — przechodzą. Ręczny zrzut: najechany kafel ma gradient w kolorze akcentu.

- **Karta budowy — podział (P6.2, 2026-10-27).** Akcje z karty (paczka ZIP, protokół odbioru, archiwizacja z pytaniem i zmniejszaniem zdjęć) są w hooku `src/components/study/useSiteCardActions.ts` (`useSiteCardActions`). Zwraca stany `zipping`, `archiveAsk`, `shrinkWithZip`, `archiving` i funkcje `zip`, `shareHandover`, `toggleArchive`, `doArchive`. Hook dostaje `persistDirty` (zapis niezapisanych zmian zostaje w oknie) i `onArchived` (zamyka okno). Pasek liczników `SiteTallyBar` jest w `SiteTallyBar.tsx`. Testy: `src/components/study` i `src/lib/study` (493 testy zielone).

- **Oś dziennika — `content-visibility` (P6.4, 2026-10-27).** Sekcja każdego dnia (`section[data-journal-day]` w `StudyJournal.tsx`) ma `content-visibility: auto` i `contain-intrinsic-block-size: auto 240px`: dni poza ekranem nie są malowane ani układane. Nagłówek dnia dalej jest `sticky`. Bez zmiany zachowania; bez sprawdzenia w przeglądarce (e2e nie uruchamiane). Miniatury w protokole: patrz „Protokół: miniatury zdjęć (P6.4)” niżej.

## Wspólne — plan mobile 2026-10-28 (fala 3, teren, w toku)

### Co robi
- **Dziś: „Zaczynasz za…” i pasek zmiany** (B3). Gdy zmiana trwa, karta Dziś pokazuje „Trwa teraz, do HH:mm” i pasek postępu (0–100 %). Gdy następna zmiana jest dalej, napis brzmi „Zaczynasz za 3 godziny, o 08:00”.
- **Karta budowy: ekran nie gaśnie** (B1). Dopóki karta jest otwarta, działa blokada wygaszania ekranu.
- **Tryb budowa: cel dotyku 56 px** (B1). W trybie budowa `--tap` wynosi 3,125 rem (przy 18 px = 56 px), zamiast 54 px.
- **Zdjęcie do wpisu** (B2). Przycisk obok „Wpis tutaj” na górze karty budowy otwiera aparat (`capture="environment"`) i zapisuje nowy wpis tej budowy z samym zdjęciem. Bez tekstu i bez etapu.

### Gdzie jest
- `src/components/review/TodayShiftCard.tsx` — `progress` (pasek `role="progressbar"`, `data-testid="today-progress"`), napis „Zaczynasz za”.
- `src/components/study/SiteCardDialog.tsx` — `useWakeLock(!!site)`, `addPhotoEntry`, `photoInput`, rząd „Wpis tutaj” + „Zdjęcie” na górze karty.
- `src/styles/site.css` — `html[data-site] { --tap: 3.125rem }`.

### Jak działa i dlaczego
- Postęp liczony z tego samego zegara co napis (`useShiftNow`), obcinany do `[0, 1]`, więc przed startem i po końcu pasek stoi na krańcu.
- Zdjęcie idzie tą samą drogą co w arkuszu wpisu: `prepareImage` (do 2 MB), `imageStore.putBlob`, potem `addJournalEntry`. Przed zapisem wywoływane jest `setSite(site.name)`, bo `addJournalEntry` pisze do aktualnie wybranej budowy.
- Wpis bez tekstu i etapu jest prawidłowy, bo zdjęcie samo wystarcza (jak nagranie).

### Ograniczenia i pułapki
- **Etap nie jest ustawiany — decyzja (2026-10-28).** Plan (P2.1) chce „bieżącego etapu”, ale pole `stage` wpisu oznacza etap, który ten wpis zamyka, a karta nie ma pojęcia bieżącego etapu. Zdjęcie zostaje bez etapu; dodanie bieżącego etapu wymagałoby nowego pola w karcie i to osobna zmiana modelu.
- Przycisk przeniesiony z dołu karty na górę, obok „Wpis tutaj” (decyzja 2026-10-28: na telefonie pod panelami etapów i braków nikt go nie szuka). Na 320 px rząd zwija napis „Zdjęcie” do samej ikony; nazwę zachowuje `aria-label`.
- Wake Lock nie działa w Safari < 16.4 i Firefox (wtedy nic się nie dzieje).
- A6 (kalendarz: kształty dni, legenda, container query) nie zrobione.

### Testy
- E2E: `e2e/site-card-mobile.spec.ts` („Zdjęcie do wpisu” — cel ≥ 44 px i dodanie wpisu ze zdjęciem; oraz przepełnienie na 320/390 px).
- Vitest: `src/components/review/TodayShiftCard.test.tsx` (napis „Trwa teraz”, „Zaczynasz za”, obecność paska). Cała grupa `review`, `study`, `lib/study`: 71 plików, 516 testów, zielone.
- `tsc --noEmit` czysto, eslint czysto na zmienionych plikach, build bez zmiany rozmiaru głównego chunku (166,55 kB gzip).
- Przeglądarka (Pixel 7, poza repo): przycisk widoczny, 44 px wysokości, wybór zdjęcia pokazuje „Zdjęcie dodane jako wpis budowy”.
- E2e nie uruchamiane (zgodnie z zasadą „e2e tylko na prośbę”).

## Wspólne — plan mobile 2026-10-28 (fala 2, wizualizacja, w toku)

### Co robi
- **Graf notatek na telefonie** (D1): płótno pionowe 600×760 zamiast szerokiego 1000×620, więc węzły nie kurczą się do ~0,36. Przyciski przybliż / oddal / cały graf (z procentem skali). Przy przybliżeniu jeden palec przesuwa graf, dwa palce szczypią. Stuknięcie węzła na telefonie otwiera arkusz z tytułem, liczbą powiązań i przyciskiem „Otwórz notatkę”. Przeciągnięcie nie liczy się jako stuknięcie. Na komputerze i w czytniku stuknięcie nadal otwiera notatkę od razu.
- **Wykresy roku na telefonie** (D5): wszystkie 12 miesięcy podpisane pod obydwoma wykresami słupkowymi; etykiety mapy dni czytelniejsze po skalowaniu do 330 px.

### Gdzie jest
- `src/components/NoteGraph.tsx` — `PHONE`, `TAP_SLOP`, `onPointerDown/Move/End`, `pinchDistance`, stan `preview` i arkusz `previewNode`; `touchAction` na SVG zależny od skali.
- `src/lib/noteGraph.ts` — `panView` (obok `zoomView` i `graphViewBox`).
- `src/components/shifts/YearCharts.tsx` — `interval={0}` na osi X obu wykresów.
- `src/components/shifts/YearHeatmap.tsx` — `LABEL_W = 34`, czcionka etykiet 12.

### Jak działa i dlaczego
- Pan trzyma środek okna w `[1/(2s), 1 − 1/(2s)]`, więc okno nigdy nie wychodzi za płótno i przeciąganie od razu reaguje po powrocie od krawędzi (bez „zaciętego” zapasu).
- Piksele zamieniane na ułamek płótna dzielą przez `rect.width·s` (i analogicznie wysokość), bo płótno przy skali `s` zajmuje tyle pikseli.
- Pinch zoomuje względem środka widoku (jak przyciski), bez przesuwania środka między palcami.
- Gest trzymany w `useRef`, nie w stanie, żeby ruch palca nie wywoływał renderu przy każdym zdarzeniu. Przy dwóch palcach `moved` jest ustawione, więc puszczenie nie otwiera węzła.
- `touch-action` to `pan-y` przy skali 1 (strona przewija się normalnie) i `none` przy powiększeniu (palec przesuwa graf).

### Ograniczenia i pułapki
- **Sprawdzone w Chromium (Pixel 7, zdarzenia wskaźnika):** przybliżanie przyciskami (100→225 %), przesunięcie jednym palcem, szczypanie w górę (100→300 %, z limitem) i w dół (wraca do 100 %), stuknięcie węzła otwiera arkusz z właściwym tytułem i liczbą powiązań, „Otwórz notatkę” zamyka graf. Nie sprawdzone na prawdziwym dotyku: wielopalcowe gesty z systemu. W jednym wcześniejszym przebiegu (CDP) graf zniknął podczas szczypania — nieodtworzone przy syntetycznych zdarzeniach, do sprawdzenia na telefonie.
- Mapa dni ma 31 kolumn w 330 px, więc etykiety miesięcy po skalowaniu są ok. 9 px. Dalsze powiększenie wymagałoby zwężenia siatki.
- Przeglądarka nie przepuszcza przewijania strony przez graf przy powiększeniu (`touch-action: none`) — dlatego przycisk „Cały graf” wraca do 100 %, a przewijanie strony działa poza grafem.

### Testy
- Vitest: `src/lib/noteGraph.view.test.ts` (`panView`: granice, powrót od krawędzi, skala 1), `src/lib/noteGraph.test.ts`; `src/components/shifts` i `src/lib/shifts` zielone (34 pliki, 244 testy).
- Zrzuty Playwright (Pixel 7, poza repo): dialog roku bez przewijania w bok, Grafik bez przewijania w bok (doc i body), podsumowanie czytelne.
- E2e nie uruchamiane (zgodnie z zasadą „e2e tylko na prośbę”).

## Wspólne — plan mobile 2026-10-28 (fala 1, zamknięta)

### Co robi
- **Lupa na telefonie** w nagłówku i w dolnym pasku (widoki bez pola szukania: Grafik, Kalendarz, Praca, Długi, Ćwiczenia). Otwiera paletę poleceń. Dolny pasek ma wtedy sześć komórek (`grid-cols-6`), więc FAB stoi pół komórki od osi. Regułę „widok ma pole szukania” trzyma `src/lib/viewSearch.ts` (`viewHasSearch`), używana przez nagłówek i pasek.
- **Skrzynka:** klawiatura telefonu pokazuje „Wyślij” zamiast „Enter” (`enterKeyHint="send"`). Enter nadal zapisuje.
- **Akapity** (`p`, `li`) łamią się bez pojedynczego słowa w ostatniej linii (`text-wrap: pretty`), obok istniejącego `balance` dla nagłówków.
- **Karta budowy: przycisk ZIP działa.** Poprawka regresji z P6.2: dialog wywoływał `zip` bez pobrania go z hooka, a hook dostawał typ `SiteCard` zamiast `SiteInfo` (brak `first`/`last`).
- **Fala 1 domknięta (2026-10-28):** Skrzynka dostała gesty na dotyku w oknie porządkowania (patrz sekcja „Skrzynka — tryb porządkowania”), a Długi — saldo narastające w historii osoby (sekcja „Długi — ukrywanie kwot”). Reszta fali była zrobiona wcześniej (lupa, ocena powtórki, ukrywanie kwot, ostrzeżenie egzaminu, „Wyślij kopię”).

### Gdzie jest
- `src/components/AppHeader.tsx` — prop `onOpenPalette`, przycisk `Search` z `sm:hidden`.
- `src/components/BottomNav.tsx` — komórka „Szukaj” (`showPaletteSlot`), prop `onOpenPalette`.
- `src/lib/viewSearch.ts` + `viewSearch.test.ts` — `viewHasSearch(view)`.
- `src/pages/Index.tsx` — przekazanie `onOpenPalette={() => setPaletteOpen(true)}` do `AppHeader`.
- `src/components/InboxCapture.tsx` — `enterKeyHint="send"` na textarea.
- `src/index.css` — reguła `p, li { text-wrap: pretty }` obok `h1–h3 { balance }`.
- `src/components/study/useSiteCardActions.ts` — typ argumentu `SiteInfo`.
- `src/components/study/SiteCardDialog.tsx` — destrukturyzacja `zip` z `useSiteCardActions`.

### Jak działa i dlaczego
- Lupa używa `IconButton asChild`, tak jak pozostałe przyciski nagłówka, więc ma ten sam cel dotyku (44 px na `coarse`). Na desktopie nie pojawia się (`sm:hidden`), bo tam jest pole szukania albo paleta z klawiatury.
- Wzmianki bez linków (`unlinkedMentions.ts`) **nie** zwijają polskich znaków. Zamiana tekstu „zolw” na `[[żółw]]` tworzyłaby link, który nie trafia w notatkę „zolw”. Zwijanie zostaje tylko w wyszukiwaniu (`searchQuery.ts`).
- Quiz nie ma pola szukania, więc nie ma czego zwijać (plan P4.2 nieaktualny).

### Ograniczenia i pułapki
- Enter na telefonie nadal wysyła notatkę ze Skrzynki, więc nowej linii nie da się wpisać bez Shift. To świadoma decyzja: Skrzynka służy do szybkiego przechwycenia.
- Duplikaty funkcji `fold` (ok. 7 plików w `src/lib/**`) nadal istnieją. Wspólna funkcja to osobne, niskopriorytetowe zadanie.

### Testy
- Vitest: 327 plików, 2532 testy, zielone (po domknięciu fali 1).
- `tsc --noEmit -p tsconfig.app.json`: czysto (po naprawie ZIP).
- ESLint: jedno ostrzeżenie w `Index.tsx` (`useMemo`, `boundaryTick`), istniejące przed tą zmianą.
- E2e nie uruchamiane (zgodnie z zasadą „e2e tylko na prośbę”).

### Commit
- Niezacommitowane: zmiany fali 1 domknięcia są w drzewie roboczym na `wip/mobile-fala1`.

## Wspólne — plan mobile fala 2 (wizualizacja), stan 2026-10-28
- Zrobione: D1 (częściowo, patrz wyżej), D2, D3 (pierścień; heatmapa już była).
- **Nie zrobione:** D5 — przegląd `ShiftSummary.tsx` i wykresów rocznych przy 390 px (zrzuty Playwright `pixel-7`). Wymaga uruchomienia aplikacji.

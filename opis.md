# Opis techniczny Notatnika

Dokumentacja aktualnego stanu funkcji — co robią, gdzie są w kodzie i jak działają.
Plik opisuje stan bieżący, nie historię: przy zmianie funkcji poprawiaj jej opis.
Zasady prowadzenia: `CLAUDE.md`, sekcja „Dokumentacja techniczna”.

Działy opisane do tej pory: **Wspólne — style, krój tekstu, tryb budowa i mikrointerakcje**, **Wspólne — warstwa UI**, **Wspólne — biblioteki UI (Radix, lucide, sonner)**, **Wspólne — audyt dostępności i testy na telefonach**, **Wspólne — klawiatura ekranowa**, **Wspólne — cele dotyku**, **Praca** (nagłówek i tablica) i **Praca → Dziennik budowy**.
Pozostałe działy (Notatki, Grafik, Kalendarz, reszta Nauki) dopisuj, gdy zadanie ich dotyczy.

---

## Wspólne — warstwa UI (React 19, Tailwind 4)

**Co robi.** Podstawa wszystkich widoków: React 19 i Tailwind CSS 4. Dla użytkownika nic się nie zmienia — wygląd jest
taki sam jak na Tailwind 3 (różnica zrzutów ≤ 0,02%).

**Gdzie jest.**
- `package.json`: `react`/`react-dom` 19, `react-day-picker` 9, `tailwindcss` 4 z `@tailwindcss/postcss`
  (`postcss.config.js`, bez `autoprefixer`), `tw-animate-css` zamiast `tailwindcss-animate`, `tailwind-merge` 3.
- `src/index.css`: `@import 'tailwindcss'`, `@import 'tw-animate-css'`, `@config '../tailwind.config.ts'`.
  Własne klasy (`paper-grid`, `note-glow-active` i inne) są zapisane jako `@utility`, nie `@layer components`.
- `tailwind.config.ts`: kolory, cienie i fonty zostają w konfiguracji JS (ładowanej przez `@config`). Warianty `coarse:`
  (palec) i `desk:` (układ z paskiem bocznym) są zwykłymi funkcjami `addVariant`, bez `tailwindcss/plugin`.
- `src/components/ui/calendar.tsx`: API react-day-picker 9 (wzór shadcn); strzałki miesiąca z 70% krycia, 44 px na dotyku.
- `src/components/ui/sonner.tsx`: kolory toastów przez zmienne CSS biblioteki.

**Jak działa i dlaczego tak.**
- Zgodność z v3 w `index.css`: domyślny kolor krawędzi `gray-200` (v4 daje `currentcolor`), `cursor: pointer`
  na przyciskach (v4 go zdjął), placeholder w kolorze `gray-400`.
- Style `sonner` leżą poza warstwami CSS, więc w v4 wygrywają z klasami — stąd kolory przez zmienne, a nie klasy
  (inaczej toast w ciemnym motywie był czarny).
- Nagłówki `Sheet`/`Dialog`/`AlertDialog` mają `gap` zamiast `space-y`: ukryty opis `sr-only` dostawał margines i przesuwał
  tytuł.
- Ujemne marginesy (`-mt-*`) w dzieciach `space-y` usunięte (Grafik, `ShiftTypeDialog`, `ReminderPicker`, `BrushHours`):
  w v3 nie działały, v4 je stosuje — wygląd został jak dotąd.
- React 19: `RefObject<T | null>`, `useRef` z argumentem, `ReactNode` zamiast globalnego `JSX`. W `vite.config.ts` paczka
  `vendor-react` obejmuje `react-dom/client` i `scheduler` (tam jest renderer React 19).

**Kolory krawędzi i fokusu (jasny motyw, `src/index.css` `:root`).** Trzy tokeny mają różne zadania:
- `--border` (220 14% 90%) — krawędź dekoracyjna kart i podziałów; może być jasna.
- `--input` (220 14% 54%) — krawędź pól, `ui/button` „outline”, tor wyłączonego `ui/switch`. Kontrast ≥3:1 na tle,
  karcie, `muted`, `secondary` i jasnych notatkach (WCAG 1.4.11). Wcześniej był równy `--border` (~1,3:1) i pola na
  białej karcie prawie nie miały krawędzi.
- `--ring` (34 88% 39%) — obwódka fokusu (`ring-ring`, globalna reguła `:focus-visible`, `.card-action`, aktywny kafel
  w `NoteGrid`). Ten sam bursztyn co `--primary`, ciemniejszy: ≥3:1 wszędzie (wcześniej 2,6:1 na tle).
Ciemny motyw bez zmian. Kontrast liczony skryptem wzorem WCAG; axe dojdzie w punkcie 2.7. Testy: Vitest, e2e smoke, zrzuty przed/po (Grafik, Ustawienia). Commit `ee3d51f` (2026-10-15).

**Ograniczenia i pułapki.**
- React 19 dodaje ok. 37 KB gzip; budżet wejściowego JS w `e2e/bundle.spec.ts` podniesiony z 375 do 400 KB. Do odzyskania
  przez `LazyMotion` (plan UI 2026-10-15, 3.4).
- Konfiguracja wciąż przez `@config` (tryb zgodności). Przeniesienie tokenów do `@theme` w CSS to osobny krok, jeśli
  będzie potrzebne.
- W react-day-picker 9 dzień w kalendarzu to przycisk w komórce `gridcell` — selektory e2e są do tego dopasowane.

**Testy.** Bez nowych testów jednostkowych; całość sprawdzona typecheckiem, lintem, Vitest (1017), buildem, pełnym e2e
(`e2e/reminders-calendar.spec.ts`, `e2e/reminders-agenda.spec.ts`, `e2e/bundle.spec.ts` poprawione pod nowe API i budżet)
oraz porównaniem zrzutów v3/v4 (6 widoków + arkusz, 390/1440 px, jasny/ciemny).

**Commit.** `544773c` (React 19), `2f5ff5b`, `18e7808`, `12fe855` (Tailwind 4) — 2026-10-15.

---

## Wspólne — biblioteki UI (Radix, lucide, sonner)

**Co robi.** Okna, menu, przełączniki i podpowiedzi (Radix), wszystkie ikony (lucide) i dymki z „Cofnij” (sonner)
działają na aktualnych wersjach bibliotek. Dla użytkownika zmienia się tylko rysunek części ikon — lucide przerysował je w nowszych wersjach
(np. kosz, kalendarz, ikony plików, księżyc, ustawienia, lejek filtra). Układ i działanie bez zmian.

**Gdzie jest.**
- `package.json`: 12 paczek `@radix-ui/react-*` podniesionych do najnowszych w swoim majorze (np. `react-dialog` 1.3,
  `react-dropdown-menu` 2.2, `react-popover` 1.3, `react-slider` 1.6, `react-tooltip` 1.4, `react-slot` 1.5);
  `lucide-react` 0.462 → 1.57; `sonner` 1.7.4 → 2.0.8.
- `src/components/ui/sonner.tsx` (`Toaster`) i nadpisania `[data-sonner-toast]`/`[data-sonner-toaster]` w
  `src/index.css` — bez zmian po przejściu na sonner 2.
- Importy ikon w 38 plikach `src/` (`from "lucide-react"`), m.in. `AppSidebar.tsx`, `BottomNav.tsx`, `NoteCard.tsx`,
  `study/JournalEntrySheet.tsx`, `InstallAppButton.tsx`.

**Jak działa i dlaczego tak.**
- Radix: tylko podbicie w obrębie majora, bez zmian w `src/components/ui/*` — API się nie zmieniło. Przy okazji
  zniknęły zdublowane wewnętrzne paczki Radix (część komponentów miała własne kopie `dismissable-layer`, `portal`
  itd. w starszych wersjach), stąd mniejszy `package-lock.json`.
- lucide 1.x usunął tylko ikony marek (żadnej nie używamy) i UMD. Stare nazwy zostały jako aliasy, ale importy
  przeszły na nazwy kanoniczne, żeby kod zgadzał się z dokumentacją lucide i nie zależał od aliasów:
  `AlertTriangle`→`TriangleAlert`, `CheckCircle2`→`CircleCheck`, `CheckSquare`→`SquareCheckBig`,
  `HelpCircle`→`CircleQuestionMark`, `Loader2`→`LoaderCircle`, `MoreHorizontal`→`Ellipsis`,
  `MoreVertical`→`EllipsisVertical`, `PlusSquare`→`SquarePlus`, `Wand2`→`WandSparkles`, `Filter`→`Funnel`,
  `History`→`RotateCcwClock`, `FileJson`→`FileBraces`, `FilePlus2`→`FilePlusCorner`, `Smile`→`FaceSlightlySmiling`,
  `Trash2`→`Trash`.
- `Trash2` w 1.x to alias `Trash`: kosz z pionowymi kreskami jest teraz jedynym koszem. Tam, gdzie wcześniej był
  goły `Trash` (paleta poleceń, lista działów w `sidebar/sidebarItems.ts`), też są kreski — cała aplikacja ma jeden kosz.
- lucide 1.x domyślnie dodaje `aria-hidden="true"`, chyba że ikona dostanie `aria-*`, `role` albo `title`. Ikony
  z własną etykietą zostają widoczne dla czytnika ekranu; ozdobne nie trzeba już ręcznie ukrywać.
- sonner 2: API, którego używamy (`toast`, `toast.success/error`, `action`, `duration`, `classNames`, zmienne
  `--normal-*`, atrybuty `data-sonner-*`), się nie zmieniło — typy, testy i zrzuty dymków (Zeszyt na komputerze, Neon
  na telefonie) bez poprawek w kodzie. Kolory dymków idą z tokenów, więc pasują do każdego stylu.
- Klasa CSS ikony (`lucide-<nazwa>`) bierze się z nazwy kanonicznej, nie z importu — selektor `svg.lucide-repeat`
  w `e2e/composer.spec.ts` działa bez zmian.

**Ograniczenia i pułapki.**
- Porównanie rysunków 0.462 i 1.57 (skrypt na `iconNode`): 65 ze 153 używanych ikon ma inny zapis SVG — część
  tylko formalnie (`polyline` → `path`, kolejność elementów), reszta zwykle drobnie (zaokrąglenia, kalendarz o 1 px wyżej). Największe różnice: `Smile` (inna buzia), `Filter`/`Funnel`,
  `Flame`, `Moon`, `Settings`, `Sparkles`, `Zap`, `Expand`. Zrzuty 390 i 1440 px (pasek boczny, arkusz „Więcej”,
  akcje karty) wyglądają poprawnie.
- `NoteCard.tsx` zawiera bajty NUL i CRLF — zmieniany tylko skryptem na bajtach, nie edytorem.
- Następny krok z tej grupy: `LazyMotion` (plan UI 3.4).

**Testy.** Bez nowych testów. Typecheck (`tsc -p tsconfig.app.json`), ESLint (0 błędów), Vitest 1024/1024, build,
`e2e/bundle.spec.ts` (budżety bez zmian), pełne e2e Chromium 255/255 (jeden test `view-change.spec.ts` niestabilny
przy obciążeniu — osobno 3/3), iPhone 14 + Pixel 7: 28 zaliczonych, 2 pominięte (CDP tylko w Chromium).

sonner 2: Vitest 1030/1030, pełne e2e Chromium 281/281, iPhone 14 + Pixel 7: 27 zaliczonych, 2 pominięte, jeden
test WebKit niestabilny (`mobile.spec.ts:121`, osobno 3/3).

**Commit.** `ee5a23f` (Radix, lucide), `4e96f34` (sonner) — 2026-10-15.

---

## Wspólne — cele dotyku (44 px)

**Co robi.** Na ekranie dotykowym (`pointer: coarse`) małe przyciski łapią palec w polu co najmniej 44 × 44 px, bez
zmiany wyglądu na komputerze z myszą.

**Gdzie jest i jak.**
- Wzorzec: widoczny przycisk 36 px (`coarse:h-9 coarse:w-9`) + niewidzialne `::after` z `coarse:after:-inset-1`
  (po 4 px z każdej strony) — tak robi `ui/icon-button.tsx` (`size="sm"`), więc przyciski zostają małe wizualnie.
- Pasek boczny: ✓/✕ przy zmianie nazwy folderu, etykiety i filtra oraz przy dodawaniu podfolderu to `IconButton size="sm"`
  (`sidebar/SidebarFolderItem.tsx`, `SidebarLabelItem.tsx`, `SidebarFilterItem.tsx`); „⋯” (`SidebarRowMenu` w
  `sidebar/SidebarRow.tsx`) i strzałka podfolderów dostały `::after`. Odstęp za strzałką (`w-6 coarse:w-9`) trzyma
  wyrównanie folderów bez podfolderów.
- Grafik (`shifts/ShiftsView.tsx`): „Miesiąc/Tydzień”, „Ten tydzień”, „Skopiuj ten tydzień na następny” mają
  `coarse:h-11`; „Rozumiem” w akapicie podpowiedzi ma 32 px i `::after` −6 px w pionie, żeby nie rozpychać tekstu.
- Strzałki miesiąca w `ui/calendar.tsx` mają 44 px na dotyku od migracji 3.3.

**Ograniczenia.** `::after` strzałki podfolderów zachodzi 4 px na wiersz folderu — stuknięcie tuż przy strzałce ją
rozwija zamiast otwierać folder. Test mierzy pseudo-element z `getComputedStyle(el, "::after")` — inne sposoby powiększania
celu (np. padding rodzica) nie zostaną policzone.

**Testy.** `e2e/touch-targets.spec.ts` (tablet 1180 × 820 z dotykiem: pasek boczny i Grafik; na kodzie sprzed zmiany
pada z 36 i 32 px).

**Commit.** `b06445b` (2026-10-15).

---

## Wspólne — dwie kolumny na szerokim ekranie (Grafik, Kalendarz, Dziennik)

**Co robi.** Od szerokości `xl` (1280 px) widoki z siatką mają panel boczny przyklejony przy przewijaniu:
- **Grafik:** po lewej przełącznik Miesiąc/Tydzień, nawigacja, podpowiedzi, siatka i eksport; po prawej „Teraz”,
  paleta zmian (z „Własne godziny”) i podsumowanie miesiąca — paleta jest obok siatki podczas malowania dni.
- **Kalendarz:** po lewej miesiąc, pasek tygodnia i siatka; po prawej najbliższe terminy i panel wybranego dnia —
  szczegóły dnia pojawiają się obok kliknięcia, a nie pod siatką.
- **Praca → Dziennik:** wpisy w kolumnie do 48 rem, po prawej panel „Filtry” (szukanie, rodzaj wpisu z „Otwarte”,
  budowy, temat); chipy w panelu się zawijają zamiast przewijać w bok.
Na telefonie i laptopie wszystko zostaje w jednej kolumnie w dawnej kolejności.

**Gdzie jest.** `src/components/shifts/ShiftsView.tsx` (`<aside aria-label="Panel Grafiku">`),
`src/components/shifts/ShiftSummary.tsx` (kafle `@lg:grid-cols-4`),
`src/components/calendar/ReminderCalendarView.tsx` (`<aside aria-label="Wybrany dzień i najbliższe terminy">`),
`src/components/study/StudyJournal.tsx` (sekcja „Wpisy” jako siatka, `role="search"` „Filtry dziennika”).

**Jak działa i dlaczego.**
- Grafik i Kalendarz: dwa opakowania (treść, `<aside>`) mają `contents` poniżej `xl` — ich dzieci są wtedy
  zwykłymi elementami jednej kolumny `flex`, a klasy `order-*` odtwarzają dawną kolejność (np. „Teraz” → przełącznik
  → nawigacja → paleta → podpowiedzi → siatka → eksport → podsumowanie). Od `xl` opakowania stają się kolumnami
  siatki `minmax(0,1fr) + 22/24 rem`; `<aside>` ma `sticky top-24` i własne przewijanie (`max-h: 100dvh − 7rem`).
- Puste opakowania (brak „Teraz”, brak sekcji „Nie ma rodzajów zmian”) mają `empty:hidden`, żeby nie dokładać odstępu.
- Kafle podsumowania Grafiku liczą kolumny od szerokości kontenera (`@container` na opakowaniu, `@lg:grid-cols-4`):
  w panelu 22 rem są dwie, na tablecie cztery jak dawniej.
- Dziennik: elementy sekcji leżą we fragmencie Reacta, więc siatka `xl:grid` przypisuje je wprost
  (`col-start-1` — nagłówek, wpisy, „Pokaż starsze”; filtry `col-start-2 row-span-3 sticky`).

**Ograniczenia i pułapki.**
- Okna dialogowe (Radix) w tych widokach nie renderują nic w miejscu, więc nie zajmują komórek siatki. Nowy element
  renderujący DOM w korzeniu widoku trzeba wstawić do jednego z opakowań, inaczej na `xl` dostanie własną komórkę.
- `contents` zdejmuje opakowaniu rolę dla starszych czytników tylko wizualnie — `<aside>` z etykietą zostaje
  w drzewie dostępności na każdej szerokości.

**Testy.** `e2e/desktop-columns.spec.ts` (1440: panel na prawo od siatki i `sticky` w Grafiku i Kalendarzu, wpisy
≤ 48 rem z filtrami obok; 390 `@mobile`: paleta nad siatką, filtry nad wpisami i `static`).

**Commit.** `9bfb12e` (2026-10-15).

---

## Wspólne — dolny pasek nawigacji (telefon)

**Co robi.** Dolny pasek: Notatki, Dziś, „+”, Terminy, Więcej. Podpisy mają 12 px. Aktywna pozycja ma trzy
znaki naraz — kolor marki z pogrubionym podpisem i grubszą kreską ikony, pigułkę za ikoną i pasek akcentu wiszący
z górnej krawędzi paska — więc widać ją kątem oka i bez rozróżniania kolorów. Pigułka i pasek przejeżdżają
sprężyną do nowej pozycji.

**Gdzie jest.** `src/components/BottomNav.tsx`: `slots`, `slotsRight`, `NavItem` (`layoutId="bottom-nav-active"`
i `"bottom-nav-bar"` w `LayoutGroup id="bottom-nav"`).

**Jak działa i dlaczego.**
- „Terminy” zamiast „Przypomnienia” (decyzja D3): pełne słowo nie mieściło się w kolumnie przy 12 px. Nagłówek
  widoku, pasek boczny i adres (`/przypomnienia`) zostają bez zmian.
- Grubsza kreska ikony przez `[&_svg]:stroke-[2.5]` na aktywnym przycisku — bez osobnych wariantów ikon.
- Pasek akcentu ma `-top-3`, czyli zaczyna się dokładnie na górnej krawędzi paska nawigacji (przycisk siedzi
  12 px niżej, bo lista ma `items-end` i wysokość 64 px).

**Ograniczenia i pułapki.** Wysokość paska jest w px (64), więc w trybie budowa nie rośnie; rosną podpisy i ikony.

**Testy.** `e2e/mobile.spec.ts` („dolny pasek: podpisy 12 px mieszczą się w kolumnach także na 320 px (2.2)”,
„Przypomnienia mają własną zakładkę…” — teraz po nazwie „Terminy”), też w projektach iPhone 14 i Pixel 7.

**Commit.** `ec86276` (2026-10-15).

---

## Wspólne — klawiatura ekranowa i dolny pasek

**Co robi.** Na telefonie podczas pisania (otwarta klawiatura, fokus w polu tekstowym) dolny pasek nawigacji zjeżdża
w dół i znika, więc nad klawiaturą zostaje więcej miejsca na tekst. Po schowaniu klawiatury albo wyjściu z pola pasek wraca.
Pełnoekranowe edytory na iOS trzymają pasek z „Zapisz” nad klawiaturą.

**Gdzie jest.**
- `src/lib/keyboardInset.ts`: `installKeyboardInset()` (wołane w `src/main.tsx`) i `isTextEntry(el)`.
- `src/components/BottomNav.tsx`: `motion.nav` z klasami `in-data-typing:translate-y-full in-data-typing:invisible`
  i przejściem `transition-[translate,visibility]` (bez animacji przy `prefers-reduced-motion`).
- `src/components/AddNoteBar.tsx`: pełny ekran kompozytora kończy się na `bottom-(--kb-inset,0px)`.

**Jak działa.** Na `<html>` ustawiane są:
- `--kb-inset` i `data-keyboard` — ile klawiatury zasłania dół (`innerHeight − visualViewport.height − offsetTop`,
  próg 80 px, poniżej to pasek adresu). Na iOS > 0; na Androidzie 0, bo `interactive-widget=resizes-content`
  w `index.html` zmniejsza całe okno.
- `data-typing` — `isTextEntry(document.activeElement)` **i** klawiatura otwarta: `--kb-inset` > 0 (iOS) albo okno
  niższe o > 80 px od najwyższego widzianego przy tej samej szerokości (Android). Sam fokus nie wystarcza: klawiaturę
  można schować „wstecz”, a pole zostaje aktywne. Zmiana szerokości (obrót) zeruje wysokość odniesienia.
- Przeliczenie na `resize`/`scroll` z `visualViewport`, `resize` okna, `focusin` i `focusout` (po `setTimeout 0`,
  bo przy przejściu między polami `activeElement` chwilę wskazuje `<body>`).
- `isTextEntry`: `textarea` i `input` tekstowe bez `readOnly`, element `contentEditable`; przyciski, pola wyboru,
  suwaki itp. nie.
- Pasek chowa się właściwością CSS `translate`, nie `transform` — `transform` należy do animacji wejścia z `motion`.
  `invisible` zabiera go z kolejności Tab; przejście `visibility` trzyma go widocznym do końca zjazdu.

**Ograniczenia i pułapki.**
- Android w trybie `overlays-content` (inne przeglądarki) nie zmienia okna — pasek wtedy zostaje, ale klawiatura i tak go
  zasłania.
- Zmniejszenie okna o > 80 px przy fokusie w polu bez zmiany szerokości (np. okno w podziale ekranu) liczy się jako
  klawiatura. Na komputerze bez znaczenia — dolny pasek jest `desk:hidden`.

**Testy.** `src/lib/keyboardInset.test.ts` (iOS, Android, „wstecz”, obrót, `isTextEntry`), `e2e/mobile.spec.ts`
„dolny pasek chowa się, gdy klawiatura Androida zmniejsza okno przy pisaniu”.

**Commit.** `c62282f` (2026-10-15).

---

## Wspólne — formularze jako arkusz na telefonie

**Co robi.** Okna z formularzem (decyzja D2) na telefonie wysuwają się od dołu jak arkusz, także gdy telefon leży
poziomo; pasek z „Zapisz” / „Nałóż cykl” jest przyklejony do dołu arkusza, więc długi formularz nie chowa go pod
przewinięciem. Na komputerze i tablecie to zwykłe okno na środku. Pozostałe okna (podgląd, statystyki, skróty,
samouczek) są na telefonie wyśrodkowane z marginesem (1.3).

**Gdzie jest.**
- `src/components/ui/responsive-dialog.tsx`: `ResponsiveDialogContent` (= `DialogContent` z `sheet`),
  `ResponsiveDialogFooter` (= `DialogFooter`).
- `src/components/ui/dialog.tsx`: klasy arkusza na wariancie `phone:`; atrybuty `data-dialog-sheet`
  (`DialogContent`) i `data-dialog-footer` (`DialogFooter`).
- `tailwind.config.ts`: wariant `phone:` — `@media (max-width: 767px), (max-height: 500px) and (pointer: coarse)`,
  dokładne przeciwieństwo `desk:`.
- `src/index.css`: `[data-dialog-sheet] [data-dialog-footer]` — `position: sticky` na dole, tło, kreska, safe-area.
- Formularze na `ResponsiveDialogContent`: `CustomTemplateDialog`, `ImportExternalDialog`, `vault/VaultDialogs`,
  `calendar/ReminderQuickAddDialog`, `shifts/DayDialog`, `ShiftTypeDialog`, `PatternDialog`,
  `ShiftSettingsDialog`, wybór przenieś/kopiuj w `ShiftsView` (`TransferChooser`), `study/JournalReport`,
  `study/SiteCardDialog`.

**Jak działa i dlaczego.**
- Dawny prop `sheet` działał tylko poniżej 640 px (`max-sm:`) — telefon w poziomie dostawał wąskie okno na środku
  niskiego ekranu. `phone:` pokrywa się z tym, kiedy aplikacja pokazuje dolny pasek zamiast bocznego.
- Pasek przycisków: `bottom` i `margin-bottom` równe ujemnemu dolnemu odstępowi arkusza, więc pasek dochodzi do
  krawędzi ekranu; `margin-inline: -1.5rem` + ten sam `padding` daje pełną szerokość z wyrównaniem do treści.
- Osobny komponent zamiast propa: jedno miejsce mówi „to formularz”; zmiana zachowania formularzy nie wymaga
  przeszukiwania wywołań `DialogContent`.

**Ograniczenia i pułapki.**
- Okna z `p-0` (raport, karta budowy) nie mają `DialogFooter` — ich przyciski nie są przyklejane.
- Nowy formularz: `ResponsiveDialogContent` + `ResponsiveDialogFooter`; nie dodawać `sheet` do `DialogContent`
  okien pełnoekranowych (ustawiają własne wymiary).

**Testy.** `e2e/mobile.spec.ts` („formularz na telefonie to arkusz od dołu z przyklejonym „Zapisz” — także w
poziomie (2.5)”: Cykl zmian dochodzi do dołu ekranu, „Nałóż cykl” widoczny; 390 × 844 i 844 × 390) oraz dotychczasowe
testy Grafiku, Kalendarza, skarbca i Dziennika.

**Commit.** `07bbc03` (2026-10-15).

---

## Wspólne — okna dialogowe na telefonie

**Co robi.** Na telefonie zwykłe okna (`Dialog`) i potwierdzenia (`AlertDialog`) są wyśrodkowane, mają margines 1 rem
z każdej strony i zaokrąglone rogi. Długie okna przewijają się w środku i nie wychodzą poza ekran, także gdy pasek
adresu przeglądarki się chowa lub pokazuje. Formularze oznaczone `sheet` dalej wysuwają się od dołu jako arkusz.

**Gdzie jest.**
- `src/components/ui/dialog.tsx` (`DialogContent`) i `src/components/ui/alert-dialog.tsx` (`AlertDialogContent`):
  bazowo `max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl`, na telefonie `max-sm:max-w-[calc(100%-2rem)]`.
- Arkusz (`sheet` w `DialogContent`) nadpisuje to: `max-sm:max-w-none max-sm:rounded-b-none`, `max-sm:max-h-[92dvh]`.
- Wysokości okien w `dvh` zamiast `vh`: `DrawingCanvas`, `FocusMode`, `ImportExternalDialog`, `ShortcutsDialog`,
  `StatsDialog`, `VersionHistory`, `SettingsDialog`, `shifts/ShiftSettingsDialog`, `shifts/YearSummaryDialog`.

**Jak działa i dlaczego.**
- Decyzja D2 (plan UI 2026-10-15): arkusz od dołu tylko dla formularzy, reszta wyśrodkowana. Potwierdzenia
  (`AlertDialog`) wcześniej były arkuszem — teraz są oknem na środku.
- Margines idzie przez `max-sm:max-w-…`, nie przez `w-…`: okna podają własne `max-w-md` itp. bez wariantu, a
  wariant `max-sm:` wygrywa w CSS, więc margines działa bez zmian w każdym oknie.
- `vh` na telefonie liczy się z ukrytym paskiem adresu, więc okno `90vh` mogło wystawać pod pasek; `dvh` śledzi
  widoczną wysokość.
- Pełnoekranowe okna muszą to wyłączyć: `FocusMode` (`max-sm:max-w-none max-h-none h-dvh rounded-none`),
  `SettingsDialog` na telefonie (`max-sm:max-w-none max-h-none rounded-none`, od `sm:` `rounded-2xl`),
  `DrawingCanvas` (`max-sm:max-w-[95vw]`).

**Ograniczenia i pułapki.** Nowe okno pełnoekranowe musi samo dodać `max-sm:max-w-none max-h-none`, inaczej dostanie
margines. `overflow-y-auto` jest bazowe — element pozycjonowany absolutnie w oknie (bez portalu) zostanie przycięty.

**Testy.** `e2e/mobile.spec.ts` „zwykłe okno na telefonie jest wyśrodkowane z marginesem 1 rem i zaokrąglone (1.3)”
(okno samouczka, 390 × 844) i „Ustawienia na telefonie zajmują cały ekran…”.

**Commit.** `9ed219c` (2026-10-15).

---

## Wspólne — ładowanie Kalendarza, Grafiku i Nauki

**Co robi.** Przy pierwszym wejściu do Kalendarza, Grafiku albo Nauki na wolnym łączu zamiast pustego ekranu widać
zarys widoku (pasek miesiąca, kafle podsumowania, siatka dni / zakładki i karty). Paczka widoku zaczyna się pobierać
już przy najechaniu kursorem albo dotknięciu pozycji w nawigacji, więc po kliknięciu zwykle jest gotowa.

**Gdzie jest.**
- `src/lib/viewPreload.ts`: `loadCalendarView`, `loadShiftsView`, `loadStudyView`, `preloadView(view)`,
  `isLazyView`, typ `LazyView`.
- `src/components/ViewSkeleton.tsx`: `ViewSkeleton({ view })` — wariant dla `calendar`, `shifts`, `study`.
- `src/pages/Index.tsx`: `lazy()` widoków używa loaderów z `viewPreload`; `Suspense fallback={<ViewSkeleton … />}`.
- `src/components/AppSidebar.tsx` (`NavRow`, `onPointerEnter`/`onPointerDown` przez `buttonProps`) i
  `src/components/BottomNav.tsx` (kafle arkusza „Więcej”, `onPointerDown`).
- `src/index.css`: `.view-skeleton`, `.view-skeleton-bone`.

**Jak działa i dlaczego.**
- Jedna zapamiętana obietnica importu na widok (`Map` w `viewPreload`) — `lazy()` i wstępne ładowanie dostają tę
  samą, więc paczka pobiera się raz. Nieudane pobranie jest usuwane z pamięci, żeby następna próba poszła od nowa.
- `preloadView` połyka błędy: wstępne ładowanie jest tylko podpowiedzią, błąd i tak obsłuży `lazy()` +
  `ViewErrorBoundary`.
- Szkielet pojawia się z opóźnieniem 180 ms (`animation-delay`), więc szybkie ładowanie nie miga. Pulsowanie kości
  jest wyłączone przy `prefers-reduced-motion` i `html[data-motion='reduced']`.
- Dostępność: `role="status"` z tekstem dla czytnika („Ładowanie grafiku…”), kości mają `aria-hidden`.

**Ograniczenia i pułapki.** Nowy widok ładowany leniwie trzeba dopisać do `loaders` w `viewPreload.ts` i do `LABELS`
w `ViewSkeleton.tsx`. Paleta poleceń nie ładuje wstępnie. Pozostałe `Suspense fallback={null}` w `Index.tsx`
dotyczą okien i paneli, nie widoków — tam szkielet nie jest potrzebny.

**Testy.** `src/lib/viewPreload.test.ts` (wspólna obietnica, widoki spoza listy), `e2e/view-skeleton.spec.ts`
(wstrzymana paczka Grafiku → szkielet, potem widok; najechanie na „Kalendarz” pobiera paczkę przed kliknięciem).

**Commit.** `8a5b5da` (2026-10-15).

---

## Wspólne — pusty widok, błąd, brak sieci, brak wyników (`StatusPanel`)

**Co robi.** Każdy pusty widok, „nic nie znaleziono”, awaria widoku i widok niedostępny bez internetu wygląda tak
samo: rysunek kreską długopisu (lekko przekrzywiony, jak w zeszycie), nagłówek, jedno zdanie, co zrobić, i ewentualnie
przycisk. Bez sieci niepobrany jeszcze widok (Grafik, Kalendarz, Praca) mówi wprost, że czeka na internet i że
notatki działają dalej, zamiast pokazywać ogólny błąd.

**Gdzie jest.**
- `src/components/StatusPanel.tsx`: `StatusPanel`, typ `StatusTone` (`empty` | `no-results` | `error` | `offline`).
  Propsy: `title`, `description`, `actions`, `icon` (domyślna ikona rodzaju; `null` — bez), `art` (własna
  ilustracja), `size` (`page` | `inline`), `headingLevel`.
- Użycia: `EmptyState` (pusty widok notatek i „Brak wyników w …” z chipami „znaleziono gdzie indziej”),
  `ViewErrorBoundary` (błąd i brak sieci), `study/StudyJournal` (brak wpisów z przyciskiem „Dodaj wpis”, brak
  wyników filtra), `study/JournalReport` (pusty okres), `RecentActionsPanel` (brak akcji / brak wyników).

**Jak działa i dlaczego.**
- `page` — cały widok: duży rysunek, `h2`, wejście z ruchem (pusty widok z opóźnieniem 0,3 s jak dotąd, błąd od
  razu). `inline` — fragment widoku: przerywana ramka (błąd w czerwonej), mała ikona; bez opisu tytuł jest
  przygaszony.
- Kolor kreski koduje rodzaj: akcent — pustka, `muted-foreground` — brak wyników, `destructive` — błąd,
  `primary-ink` — brak sieci.
- Dostępność: błąd ma `role="alert"`, brak sieci `role="status"`, pustka i brak wyników nic (to nie zdarzenie).
  Ikony `aria-hidden`. Każdy panel ma `data-status="<rodzaj>"` (testy, style).
- Brak sieci w `ViewErrorBoundary`: błąd ładowania paczki (`dynamically imported module` / `Loading chunk` /
  `Failed to fetch`) przy `navigator.onLine === false`. Przy sieci ten sam błąd zostaje błędem z „Odśwież stronę”.
- Pusty Dziennik był dotąd całym klikanym przyciskiem; teraz to panel z wyraźnym przyciskiem „Dodaj wpis”.
- Ilustracja pustego widoku to `EmptySketch` (`src/components/EmptyIllustration.tsx`, ścieżki z `src/lib/emptyGlyphs.ts`).
  `EmptyIllustration` bierze szkic po `View` (Notatki), a Dziennik Pracy przekazuje własny: `JOURNAL_GLYPH` (kartka
  z marginesem, wiersze i długopis). Wariant `inline` też przyjmuje `art` — zwykła ikona ma wtedy `icon={null}`.

**Ograniczenia i pułapki.**
- Bardzo małe puste miejsca zostają zwykłym tekstem: kolumna tablicy tematów (`StudyBoard`, cel upuszczania), „Brak
  terminów” w `DayPanel`/`UpcomingDays`, `CommandEmpty` w palecie, `LabelPicker`.
- Leniwie ładowane części poza widokami (np. `OnboardingTour`) nie mają własnej granicy błędu — bez sieci i bez
  service workera ich błąd pobrania przejmuje globalna granica w `App.tsx`. Na zainstalowanej aplikacji SW ma je w
  pamięci, więc dotyczy to głównie testów (SW zablokowany) i pierwszej wizyty.
- Nowy pusty stan: użyj `StatusPanel`, nie własnego `<p>` w przerywanej ramce.

**Testy.** `e2e/shifts.spec.ts` („awaria widoku Grafiku nie zabiera reszty aplikacji”, „bez internetu niepobrany
Grafik mówi, że czeka na sieć” — `role="status"`, bez `alert`), `e2e/search-backup.spec.ts` („Brak wyników w
Notatkach”), `e2e/study.spec.ts` (brak wyników filtra Dziennika; „dziennik bez wpisów: szkic zeszytu…”), `e2e/a11y.spec.ts` (puste widoki w obu motywach).

**Commit.** `7c47e4b` (2026-10-15); szkic zeszytu w Dzienniku — `59063d5` (2026-10-16).

---

## Wspólne — animacje w tle wstrzymane

**Co robi.** Gdy karta z aplikacją jest w tle (inna karta, zminimalizowane okno, zablokowany telefon), zapętlone
animacje (poświata notatki, oddech „dziś”, puls „teraz”, połysk paska, logo N, szkielety ładowania, zorza w stylu
Zorza) stoją. Po powrocie ruszają od miejsca, w którym stanęły.

**Gdzie jest.** `src/lib/pageHidden.ts` (`installPageHidden`, wołane w `src/main.tsx`), reguła `html[data-hidden]`
na końcu `src/index.css`.

**Jak działa i dlaczego.** `visibilitychange` przełącza `data-hidden` na `<html>`; CSS ustawia wszystkim elementom i
pseudoelementom `animation-play-state: paused`. Jedna reguła zamiast pilnowania każdej animacji z osobna — obejmuje
też przyszłe. Animacje framer-motion (np. połysk w `NotatnikWordmark`) jadą na `requestAnimationFrame`, który
przeglądarka w tle i tak zatrzymuje.

**Ograniczenia i pułapki.** Przejścia (`transition`) nie są wstrzymywane — są krótkie i jednorazowe. Animacja, która
w tle miała się skończyć i coś odsłonić, dokończy się dopiero po powrocie (dziś żadna taka nie jest zapętlona).

**Testy.** `src/lib/pageHidden.test.ts`.

**Commit.** `75ea68d` (2026-10-15).

---

## Wspólne — grupy „jedna z kilku” (`ToggleGroup`)

**Co robi.** Przełączniki segmentowe i kafle wyboru działają z klawiatury jak jedna kontrolka: Tab wchodzi do grupy
na wybraną pozycję, strzałki przenoszą fokus (w kółko), Spacja/Enter wybiera. Kliknięcie wybranej pozycji jej nie
odznacza. Czytnik ekranu słyszy „grupa opcji, przycisk opcji, zaznaczony”.

**Gdzie jest.**
- `src/components/ui/toggle-group.tsx`: `ToggleGroup`, `ToggleGroupItem` (shadcn Toggle Group na
  `@radix-ui/react-toggle-group` 1.2, zawsze `type="single"`). Warianty: `segment` (tor `bg-muted/60`, wybrana
  pozycja `bg-card` + `text-primary-ink`, 36 px / 44 px na dotyku) i `plain` (bez wyglądu — wywołujący styluje kafle).
- Użycia: `settings/Segmented.tsx` (Jasność, Tryb budowa, Ruch i animacje — z przesuwanym tłem `layoutId`),
  `ViewSheet.tsx` (Układ — pionowo, Kolumny, Gęstość, Grupuj), `shifts/ShiftTypeDialog.tsx` (Rodzaj, Rodzaj
  nieobecności), `study/JournalEntrySheet.tsx` (Rodzaj wpisu).

**Jak działa i dlaczego.**
- Radix w trybie `single` renderuje `role="radiogroup"` i pozycje `role="radio"` z `aria-checked` (wcześniej
  `Segmented` w Ustawieniach miał `role="group"` + `aria-pressed`, pozostałe ręczne `radiogroup` bez obsługi strzałek).
- `onValueChange` ignoruje `""` (Radix oddaje je przy kliknięciu wybranej pozycji) — zawsze coś jest wybrane.
- Wartości są tekstem; `ViewSheet` mapuje liczby kolumn przez `String` i z powrotem przez wyszukanie opcji.
- Wariant przekazywany pozycjom przez kontekst, więc `<ToggleGroup variant="plain">` nie wymaga powtarzania go w
  każdej pozycji.

**Ograniczenia i pułapki.**
- Strzałka tylko przenosi fokus, nie wybiera (zachowanie Radix) — wybór Spacją/Enterem albo kliknięciem.
- Pozycje mają zawsze `tabindex="-1"`; przystankiem Tab jest sama grupa (`tabindex="0"`), która przekazuje fokus
  wybranej pozycji. W testach fokusuj grupę, nie pozycję.
- Nie przeniesione (mają własną obsługę klawiatury lub złożoną treść): pędzle Grafiku (`BrushBar`, `onRadioKey`),
  wybór zmiany w `DayDialog`, galerie stylu/kroju (`SkinPicker`, `FontPicker`, `aria-pressed`) i paski filtrów.

**Testy.** `e2e/toggle-group.spec.ts` (strzałki, Spacja, brak odznaczania), `e2e/site-mode.spec.ts`,
`e2e/skins.spec.ts` (selektory `radiogroup`/`radio`), `e2e/view-change.spec.ts`, `e2e/shifts.spec.ts`,
`e2e/study.spec.ts`, `e2e/a11y.spec.ts`.

**Commit.** `d3c5c4b` (2026-10-15).

---

## Synchronizacja — stan aktualny (parowanie, kody, urządzenia, diagnoza)

Dział opisany w jednym miejscu. Synchronizacja działa przez WebRTC (y-webrtc) na dokumencie Yjs notatek; bez własnego serwera danych.

### Co robi

- **Parowanie kodem.** W Ustawieniach → Sync kod z drugiego urządzenia wpisuje się w 12 kratek w trzech grupach po 4 (`ABCD EFGH JKMN`). Pole przyjmuje tylko znaki alfabetu kodu (bez I, L, O, 0, 1), małe litery zamienia na wielkie, a wklejenie przyjmuje kod ze spacjami/myślnikami albo cały link `?pair=…`.
  „Dołącz” jest aktywne przy 12 znakach. Kod 9–11 znaków nie aktywuje przycisku.
- **Link z kodu QR** (`?pair=`) otwiera Ustawienia → Sync z wypełnionymi kratkami. `Index` otwiera okno od startu; okno przełącza na Sync, wpisuje kod i usuwa parametr z adresu.
- **Krótkie kody odrzucone.** Kody muszą mieć 12 znaków. Zapisany 8-znakowy kod jest usuwany przy starcie i pokazuje komunikat „Synchronizacja wyłączona: kod był za krótki” z przyciskiem „Wygeneruj nowy kod”.
- **Diagnoza** (jedno zdanie w Ustawieniach): brak połączenia z serwerami, połączono bez drugiego urządzenia, albo łączenie (ile serwerów odpowiada). Po powrocie do karty albo odzyskaniu sieci sync łączy się ponownie, nie częściej niż co 10 s.
- **Urządzenia w grupie.** Karta „Urządzenia w grupie”: lista innych urządzeń połączonych teraz (nazwy) i pole „Nazwa tego urządzenia” (domyślnie „Telefon” albo „Komputer” wg przeglądarki). Po połączeniu nowego urządzenia pojawia się toast „Połączono z: [nazwa]”.
- **Odłączenie.** „Odłącz to urządzenie” (z potwierdzeniem: pozostałe urządzenia zostają w grupie). Sekcja kodu nazywa się „Dodaj urządzenie” (QR i kod).
- **Toast po zmianie z innego urządzenia** podaje tytuł notatki: „Zaktualizowano: …”. Notatki prywatne i bez tytułu pokazują zwykły komunikat.

### Gdzie jest

- `src/components/ui/input-otp.tsx` — `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` (shadcn Input OTP na paczce `input-otp` 1.5). Animacja karetki `caret-blink` w `tailwind.config.ts`.
- `src/components/SyncSettings.tsx` — formularz „Dołącz do istniejącej grupy” (`joinReady`, `LEGACY_CODE_LENGTH`), diagnoza, lista urządzeń, nazwa urządzenia, potwierdzenia „Odłącz”.
- `src/lib/yjsSync.ts` — `CODE_LENGTH`, `CODE_PATTERN`, `codeFromPaste` (link → kod, odrzuca znaki spoza alfabetu, tnie do 12), `readPrefs` (odrzucenie krótkiego kodu, pole `shortCodeDropped`), `joinWithCode` (`null` dla złej długości), `wasShortCodeDropped`, `SyncState.signalingUp/signalingTotal`, `reconnectIfNeeded` i listener `visibilitychange` w `initSync`, `SyncDevice`, `SyncState.devices`, `getDeviceName` / `setDeviceName` / `defaultDeviceName` (klucz `kaczy.sync.deviceName`), `refreshDevices` (awareness pierwszego pokoju v2), `changedNoteTitle()` (porównuje `updatedAt` z `remoteSeenUpdated`, wołane w `yjsStore.doc.on("update")`).
- `src/pages/Index.tsx` — `settingsOpen` startuje jako `true`, gdy adres ma `?pair=`.

### Jak działa i dlaczego

- **Pole kodu bez automatycznego dołączania.** Pod kratkami jest jedno niewidoczne `<input>` (`aria-label` „Kod z innego urządzenia”, podpowiedź przez `aria-describedby`), więc wklejanie, autouzupełnianie i czytniki działają jak w zwykłym polu; kratki są tylko obrazem wartości. Dołączenie zmienia grupę synchronizacji, więc zostaje świadome „Dołącz” (Enter też działa — to `<form>`).
- **Nazwa urządzenia przez awareness.** Nazwa idzie przez `setLocalStateField("device", …)`, więc nie zmienia protokołu ani danych w Yjs. Każde urządzenie ma własne `clientID`; lista pomija własne.
- **„Odłącz” działa tylko lokalnie.** Wspólny kod nie daje sposobu, by z zewnątrz wyrzucić jedno urządzenie, stąd rozdzielenie na „to urządzenie” i listę pozostałych.
- **Toast z tytułem** porównuje notatki z poprzednim zdalnym zapisem; nie jest wysyłany częściej niż co 30 s.

### Ograniczenia i pułapki

- Brak TURN (decyzja użytkownika, brak hostingu): połączenie przez część sieci komórkowych może się nie udać. Oba urządzenia muszą być online jednocześnie.
- Kody spoza alfabetu nie dadzą się wpisać — wszystkie generowane kody są z tego samego alfabetu.
- PIN skarbca nie korzysta z `InputOTP` (skarbiec ma hasło dowolnej długości).
- Lista urządzeń pokazuje tylko te w pokoju v2. Przy włączonej zgodności ze starą wersją urządzenie widoczne tylko w starym pokoju się nie pojawi.
- „Ostatnia synchronizacja” per urządzenie nie istnieje — awareness jej nie niesie; zostaje globalna z kafla diagnozy.
- Toast przy kilku zmianach naraz może wskazać lokalną notatkę (porównanie obejmuje lokalne edycje od ostatniego zdalnego zapisu).
- `fill()` w Playwright nie przechodzi przez `pasteTransformer` — w testach wpisuj `pressSequentially`.
- Budżet: `yjsSync` jest w paczce startowej (`NotesProvider`); próg eager w `e2e/bundle.spec.ts`, ostatni pomiar 392,4 KB.

### Testy

- `src/lib/yjsSync.test.ts` — `codeFromPaste`, krótki kod, urządzenia w grupie (nazwa, lista bez siebie, czyszczenie przy odłączeniu), `changedNoteTitle`.
- `e2e/sync-code.spec.ts` — link `?pair=` wypełnia kratki; 8/12 znaków; odrzucanie „O” i „0”.
- `e2e/file-sync.spec.ts` — synchronizacja przez plik.
- E2E nie uruchamiano od zmian z 2026-10-20 (pełne e2e odłożone).

### Commity

- `75a026c` (2026-10-15) — pole kodu parowania (`InputOTP`).
- `adbe848` — krótkie kody odrzucone, diagnostyka, ponowne łączenie (plan synchronizacji, fazy 0, 1, 3).
- `842db18` (2026-10-20) — urządzenia w grupie i nazwy (faza 4).
- `89f1546` (2026-10-20) — toast z tytułem notatki (punkt 3).

## Wspólne — wibracje (haptyka)

**Co robi.** Na telefonie z Androidem krótkie drgnięcie potwierdza akcje: zapis notatki, odhaczenie listy, przejście
w dolnym pasku, odpowiedź w quizie, zapis wpisu w Dzienniku. Działa także przy ograniczonym ruchu — wyłącza je tylko
przełącznik „Wibracje na telefonie” w Ustawieniach → Ogólne.

**Gdzie jest.** `src/lib/haptics.ts`: `haptic(kind)`, typ `HapticKind` (`tap`, `success`, `warn`, `selection`),
wzorce w `PATTERNS`. Przełącznik: klucz `haptics` w `src/lib/effectsSettings.ts`, podgląd w
`src/components/settings/GeneralSettings.tsx` (`previewEffect`).

**Jak działa i dlaczego.** `haptic` po cichu nic nie robi, gdy nie ma `navigator.vibrate` (iOS, komputer), gdy
wskaźnik jest precyzyjny (`pointer: fine` — mysz), gdy efekt `haptics` jest wyłączony, albo gdy wibracja rzuci
wyjątek. Ograniczony ruch (`prefers-reduced-motion`, `html[data-motion='reduced']`) celowo jej nie wyłącza:
wibracja nie jest animacją, a w rękawicach i w hałasie bywa jedynym potwierdzeniem akcji.

**Ograniczenia i pułapki.** iOS Safari nie ma `navigator.vibrate` — tam wibracji nie ma wcale. Przy myszy przycisk
podglądu w Ustawieniach jest ukryty (`pointer-fine:hidden`).

**Testy.** `src/lib/haptics.test.ts` (różne wzorce, mysz, ograniczony ruch nadal wibruje, wyłączony przełącznik,
brak API i wyjątek).

**Commit.** `6442da5` (2026-10-15).

---

## Wspólne — krój tekstu

**Co robi.** Ustawienia → Wygląd → „Krój tekstu”: Domyślny (krój stylu) i sześć do wyboru — Inter (neutralny,
gęsty), Nunito (zaokrąglony), Atkinson Hyperlegible Next (najczytelniejszy, wyraźne I/l/1 i 0/O — dobry na budowę),
Literata (szeryfowy do czytania), Manrope (geometryczny), Lexend (szeroki, spokojny). Każdy kafel pokazuje nazwę
i próbkę z polskimi znakami swoim krojem.

**Gdzie jest.**
- `src/lib/appFont.ts`: typ `AppFont`, `APP_FONTS`, `APP_FONT_META`, `isAppFont`, `useAppFont`, `setAppFont`;
  klucz `kaczy.font.v1` (w `SETTINGS_KEYS` kopii zapasowej). Atrybut `html[data-font]` ustawiany przy imporcie
  (`src/main.tsx`), „Domyślny” go zdejmuje.
- `src/styles/fonts.css`: `--app-font` dla każdego kroju i reguła na `body`, `.font-body`, `.font-display`, pola
  formularzy i przyciski.
- `src/components/settings/FontPicker.tsx` (kafle z `layoutId="font-active"`), `AppearanceSettings.tsx`.
- `src/main.tsx`: `@fontsource-variable/{inter,nunito,atkinson-hyperlegible-next,literata,manrope,lexend}/wght.css`;
  `vite.config.ts`: te kroje poza precache, w cache `skin-fonts` przy pierwszym użyciu.

**Jak działa i dlaczego.**
- Reguła w `:where(...)` ma specyficzność samego `html[data-font]` (0,1,1): wygrywa z klasami Tailwinda (są
  w warstwie), ale przegrywa z krojami nagłówków stylów (`html[data-skin] h1`, 0,1,2). Plan, Neon, Zorza i Miedź
  zachowują więc swoje nagłówki (Ustawienia mówią o tym pod wyborem), a w Zeszycie nagłówki idą za wybranym krojem.
- Logo (`.font-logo`) i cyfry rachunku (`.font-mono`) mają własne kroje i nie zmieniają się.
- Pliki krojów pobierają się dopiero, gdy krój jest użyty; otwarcie Ustawień pobiera wszystkie sześć do próbek.

**Ograniczenia i pułapki.**
- Wczytane są tylko osie wagi (`wght.css`) bez kursywy — kursywa (np. cytat dnia) jest pochylana przez przeglądarkę.
- Offline przed pierwszym użyciem krój nie jest w pamięci — tekst spada do Plus Jakarta Sans.
- Większe kroje (Lexend, Literata) dają dłuższe wiersze — tytuły kafli częściej się zawijają.

**Testy.** `src/lib/appFont.test.ts` (6 krojów, atrybut), `e2e/skins.spec.ts` („krój tekstu: Literata…” — tekst
w Literacie, nagłówek stylu Plan zostaje w Barlow Condensed, wybór przeżywa odświeżenie).

**Commit.** `21f2442` (2026-10-15).

---

## Wspólne — tryb budowa

**Co robi.** Ustawienia → Wygląd → „Tryb budowa” (Wyłączony / Włączony / Automatycznie) — do pracy w rękawicach
i w słońcu. Cała aplikacja w skali 112,5% (tekst 18 px), przyciski ikonowe łapią palec na co najmniej 54 px,
tekst pomocniczy i krawędzie są mocniejsze, tło gładkie (bez kratki i dekoracji stylów), a dymki z „Cofnij”
trwają 8 s zamiast 5 s. „Automatycznie” włącza tryb, gdy system prosi o większy kontrast.

**Gdzie jest.**
- `src/lib/siteMode.ts`: typ `SiteMode`, `resolveSiteMode`, `isSiteModeActive`, `useSiteMode`, `setSiteMode`,
  `undoToastDuration`; klucz `kaczy.siteMode.v1` (też w `SETTINGS_KEYS` kopii zapasowej).
- `src/styles/site.css`: `html[data-site]` — `font-size: 112.5%`, `--tap: 3rem`, tokeny `--muted-foreground`,
  `--border`, `--input` dla jasnego i ciemnego schematu, wyłączenie `.paper-grid::before/::after`, cele `.tap-target`
  i `.card-action` na dotyku.
- `.tap-target`: `ui/icon-button.tsx` (wszystkie rozmiary), `ui/button.tsx` (rozmiary `icon`, `icon-sm`).
- `src/lib/undoToast.ts` (`toastWithUndo` → `undoToastDuration`), `src/main.tsx` (import CSS i modułu przed
  pierwszym malowaniem), `src/components/settings/AppearanceSettings.tsx` (przełącznik `Segmented`).

**Jak działa i dlaczego.**
- Skala przez `font-size` na `html`: wszystko w rem (tekst, odstępy, wysokości przycisków) rośnie razem, bez
  przepisywania ~110 klas `coarse:h-11` w komponentach. Elementy w px (dolny pasek 64 px) zostają.
- Cel dotyku przez niewidzialne `::after` wyśrodkowane na przycisku (`max(100%, var(--tap))`) — widoczny przycisk
  się nie powiększa, więc nagłówek na 320 px dalej się mieści.
- Tokeny kontrastu w `html[data-site]:not(.dark)` / `html[data-site].dark` mają wyższą specyficzność niż tokeny
  stylów (`html[data-skin]`), więc działają nad każdym stylem.
- `auto` słucha `matchMedia("(prefers-contrast: more)")` na żywo; atrybut `data-site` ustawiany przy imporcie modułu.

**Ograniczenia i pułapki.**
- Kafle i podpisy w px nie rosną. Nowy przycisk ikonowy poza `IconButton`/`Button` potrzebuje klasy `.tap-target`.
- Tokeny kontrastu są neutralne (szare) — w stylach o mocnym odcieniu tekst pomocniczy traci odcień stylu.

**Testy.** `src/lib/siteMode.test.ts` (auto, atrybut, czas „Cofnij”), `e2e/site-mode.spec.ts` (`@mobile`: 18 px,
brak kratki, cel ≥ 52 px w nagłówku, „Cofnij” 8000 ms, przeżywa odświeżenie; też iPhone 14 i Pixel 7).

**Commit.** `d0e244b` (2026-10-15).

---

## Wspólne — style aplikacji (Zeszyt, Plan, Neon, Zorza, Miedź)

**Co robi.** Ustawienia → Wygląd → „Styl” to galeria pięciu wyglądów całej aplikacji. Każda miniatura pokazuje
styl w małej skali: tło, kafel, akcent i „Aa” krojem nagłówków. Po wyborze nowy wygląd rozlewa się kołem od
miejsca kliknięcia.
- **Zeszyt** — domyślny: kratka, bursztyn, niebieski długopis; jedyny słucha przełącznika „Jasność”.
- **Plan** (ciemny) — rysunek techniczny: granat, kratka 12/60 px, znaczniki narożników na kaflach, tabliczka
  rysunkowa w rogu (tylko komputer), czerwona kreska poprawki jako margines, nagłówki Barlow Condensed.
- **Neon** (ciemny) — bar po fajrancie: ceglana ściana w półmroku, różowa i błękitna poświata, nagłówki widoków
  świecą (Unbounded), logo „zapala się” z mrugnięciem po wybraniu stylu.
- **Zorza** (ciemny) — nocne niebo z gwiazdami i dryfującą zorzą (28 s, tylko `transform`), szklane kafle na
  komputerze, nagłówki Fraunces (oś SOFT), logo w barwach zorzy.
- **Miedź** (jasny) — beton architektoniczny: ziarno, styki płyt szalunkowych, otwory po ściągach; krawędź paska
  bocznego to miedziana rura, przycisk główny lśni jak polerowana miedź, linki w kolorze patyny; nagłówki
  Bricolage Grotesque.

**Gdzie jest.**
- `src/lib/skins.ts`: typ `Skin`, `SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR`, `isSkin`, `skinStore`
  (klucz `kaczy.skin.v1`), `useSkin`, `setSkin`.
- `src/lib/skinGallery.ts`: `SKIN_META` (nazwa, opis, kolory miniatury, krój) — tylko dla galerii.
- `src/styles/skins.css`: tokeny pod `html[data-skin="…"]`, tła (`.paper-grid::before/::after` z `PaperBackdrop`),
  logo (`.notki-glyph`), kroje `h1–h3`, miniatury `.skin-thumb`, reguły przejścia `html.theme-reveal`.
- `src/hooks/useTheme.ts`: `resolveDark`, `revealRadius`, `setThemeMode`, `applyAppearance`, hook `useTheme`
  (`mode`, `dark`, `skin`, `setMode`, `setSkin`, `toggle`).
- `src/components/settings/SkinPicker.tsx` (galeria), `Segmented.tsx` (przełączniki „Jasność” i „Ruch”),
  `AppearanceSettings.tsx`.
- `src/main.tsx`: import krojów i `skins.css`; `vite.config.ts`: kroje stylów poza precache + cache `skin-fonts`.
- `src/lib/exportNotes.ts`: `kaczy.skin.v1` w `SETTINGS_KEYS` (pełna kopia zapasowa).

**Jak działa i dlaczego.**
- Styl i jasność to dwie osie. `resolveDark`: styl z własnym schematem (`SKIN_SCHEME`) wygrywa; Zeszyt bierze
  jasny/ciemny/system. Klasa `.dark` jest zawsze zgodna ze schematem, więc warianty `dark:` w komponentach działają
  w każdym stylu. `html[data-skin]` jest zawsze ustawiony (także `zeszyt`).
- `skins.css` jest poza warstwami Tailwinda (`@layer base` w `index.css`), więc nadpisuje tokeny bez walki
  o specyficzność. Dekoracje siedzą w tle i w kilku akcentach — treść notatek nie zmienia układu.
- Jeden wspólny stan motywu w module `useTheme` (`useSyncExternalStore`) — wcześniej każdy `useTheme()` miał
  własną kopię i nagłówek nie widział zmiany z Ustawień. Zmiana trafia do DOM w jednym miejscu (`applyCurrent`),
  idempotentnie, więc dwa wywołania nie psują przejścia.
- Przejście: View Transitions + `clip-path: circle()` na `::view-transition-new(root)` od ostatniego
  `pointerdown` (≤1,5 s) albo od środka górnej krawędzi. Wyłączone przy ograniczonym ruchu i gdy efekt „themeFade”
  jest wyłączony; bez View Transitions zostaje krótkie przejście CSS.
- Przełącznik jasny/ciemny w nagłówku, pasku bocznym i „Więcej”: w stylu z własnym schematem przechodzi do
  Zeszytu w przeciwnej jasności — przycisk zawsze robi to, co mówi.
- Kroje: `@font-face` z fontsource pobiera plik dopiero, gdy styl go użyje. Pliki krojów stylów są poza precache
  (budżet 4,3 MB) i trafiają do `skin-fonts` (CacheFirst, rok) przy pierwszym użyciu. Neon używa Unbounded tylko
  w `h1/h2`, bo szeroki krój ucinał tytuły kafli na telefonie.
- Zorza: rozmycie kafli (`backdrop-filter`) tylko przy `pointer: fine` — na telefonie to kosztowne.
- Kolor paska stanu/PWA z `SKIN_THEME_COLOR` (Zeszyt ciemny: `#0f0d10`).

**Ograniczenia i pułapki.**
- Offline przed pierwszym użyciem stylu jego krój nie jest w pamięci — nagłówki spadają do Plus Jakarta Sans.
- Nowy styl: dopisz go w `SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR`, `SKIN_META`, `skins.css` (tokeny,
  `--note-*`, tło, miniatura) i w `SKINS` w `e2e/a11y.spec.ts`.
- Nowe tło dla `.paper-grid` musi ustawić `mask-image` (Zeszyt maskuje kratkę ku dołowi).
- Wejściowy JS: opisy galerii są w `skinGallery.ts`, żeby nie trafiły do paczki startowej; próg w
  `e2e/bundle.spec.ts` podniesiony do 404 KB (po zmianie 400,3 KB).

**Testy.** `src/lib/skins.test.ts`, `src/hooks/useTheme.test.ts` (`resolveDark`, `revealRadius`), `e2e/skins.spec.ts`
(wybór Neonu, zablokowana jasność, odświeżenie, kolor paska; przełącznik w nagłówku wraca z Miedzi do Zeszytu),
`e2e/a11y.spec.ts` (każdy styl na Notatkach, Kalendarzu i Grafiku, 390 i 1440 — bez naruszeń).

**Commit.** `95ca98f` (2026-10-15).

---

## Wspólne — mikrointerakcje (framer-motion)

**Co robi.** Drobny ruch tam, gdzie zmienia się stan:
- przełączniki „Jasność” i „Ruch i animacje” — podświetlenie przesuwa się sprężyną do wybranej opcji;
- galeria stylów — miniatura unosi się pod kursorem i wciska przy dotknięciu, obwódka wyboru przejeżdża do nowego
  stylu, znaczek ✓ wskakuje z obrotem; dotknięcie daje krótką wibrację (`haptic("selection")`);
- ikona słońce/księżyc w nagłówku zamienia się obrotem;
- licznik „N notatek” w nagłówku przewija cyfrę w górę przy wzroście i w dół przy spadku;
- przejście motywu kołem i efekty stylów (zapalanie neonu, dryf zorzy, odblask miedzi) — opis wyżej.

**Gdzie jest.** `src/components/settings/Segmented.tsx` (`layoutId="segmented-active"` w `LayoutGroup` z `useId`),
`src/components/settings/SkinPicker.tsx` (`layoutId="skin-active"`, `whileHover`, `whileTap`),
`src/components/RollingNumber.tsx`, `src/components/AppHeader.tsx` (`AnimatePresence mode="wait"` przy ikonie).

**Jak działa i dlaczego.**
- Animowane tylko `transform` i `opacity` (bez przeliczania układu); czasy i sprężyny z `src/lib/motion.ts`
  (`spring.snap`, `spring.soft`, `tween.enter`) — jeden język ruchu w całej aplikacji.
- Ograniczony ruch obsługuje `MotionConfig` w `App.tsx` — komponenty nie sprawdzają go osobno.
- Wciśnięcie przycisków przełącznika to klasa `pressable` (podpis wciśnięcia aplikacji), nie skala framer-motion.
- `RollingNumber`: kierunek ze stanu pochodnego ustawianego w renderze (nie z refa — bezpieczne w StrictMode);
  czytnik ekranu dostaje liczbę z `sr-only`, animowane cyfry mają `aria-hidden`.
- `LayoutGroup id` z `useId`: kilka przełączników na jednej stronie nie dzieli jednego `layoutId`.

**Ładowanie (LazyMotion).** `App.tsx` owija aplikację w `<LazyMotion features={loadMotionFeatures} strict>`;
pełny zestaw funkcji (`domMax`: animacje, gesty, przeciąganie, `layout`/`layoutId`) jest w `src/lib/motionFeatures.ts`
i przychodzi osobną paczką (~18 KB gzip) zaraz po starcie. Komponenty importują lekkie `m` jako `motion`
(`import { m as motion } from "framer-motion"`) — samo `m` kolidowałoby z lokalnymi zmiennymi `m` (np.
`MODULES.map((m) => …)`). `vite.config.ts` nie ma już ręcznej paczki `vendor-motion`, bo wciągała całe
framer-motion do startu. Wejściowy JS: 400,3 → 372,4 KB gzip; próg w `e2e/bundle.spec.ts` obniżony do 376 KB.

**Ograniczenia i pułapki.**
- Nowy komponent z animacją: importuj `m as motion`. Pełne `motion` w trybie `strict` to błąd.
- Do załadowania funkcji (pierwsze ułamki sekundy, wolne łącze) animacje wejścia nie grają — elementy stoją
  w stanie `initial` i ruszają po załadowaniu paczki.

**Testy.** `e2e/skins.spec.ts` (galeria, przełączniki), `e2e/a11y.spec.ts`; ruch sprawdzony na zrzutach.

**Commit.** `95ca98f` (2026-10-15).

---

## Wspólne — budowanie i service worker (bez Lovable)

**Co robi.** Aplikacja nie ma już śladów szablonu Lovable: w budowaniu nie działa wtyczka `lovable-tagger`, service
worker rejestruje się na każdym hoście produkcyjnym, a offline obsługuje każdą nawigację.

**Gdzie jest.** `vite.config.ts` (lista wtyczek, `workbox.runtimeCaching` → `html-navigations`), `src/lib/registerSW.ts`
(`registerServiceWorker`), `package.json` (bez `lovable-tagger`).

**Jak działa i dlaczego.**
- `registerServiceWorker` pomija rejestrację tylko w dev, w ramce (iframe) i przy `?sw=off` — wtedy wyrejestrowuje
  własnego workera. Lista hostów podglądu Lovable (`*.lovableproject.com`, `*.beta.lovable.dev`, `preview--…`)
  zniknęła razem z `isBlockedHost`.
- Bez wyjątku `/~oauth` w `navigateFallbackDenylist` i w regule `html-navigations` — to trasa logowania Lovable
  Cloud, której aplikacja nie ma.

**Ograniczenia i pułapki.** Wzmianki o Lovable w `roadmap.md` to historia zadań, nie kod.

**Testy.** `e2e/pwa.spec.ts` (rejestracja i aktywacja workera, offline), typecheck, build.

**Commit.** `cba3989` (2026-10-15).

---

## Wspólne — automatyczny audyt dostępności (axe)

**Co robi.** Test e2e sprawdza narzędziem axe-core pięć głównych widoków (Notatki, Przypomnienia, Kalendarz, Grafik,
Nauka) pod kątem WCAG 2.2 AA — w jasnym i ciemnym motywie, na telefonie (390 × 844) i komputerze (1440 × 900),
razem 20 skanów. Nowe naruszenie wywraca test.

**Gdzie jest.** `e2e/a11y.spec.ts`: stałe `TAGS` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), `VIEWS`,
`SIZES`, `THEMES`, lista wyjątków `KNOWN`, funkcja `scan(page)`. Zależność `@axe-core/playwright` (dev).

**Jak działa i dlaczego.**
- Każdy test seeduje dwie notatki, ustawia motyw (`kaczy-theme`) i ograniczony ruch (`kaczy.motion.v1` + emulacja
  `prefers-reduced-motion`), żeby skan nie trafił na kolory w połowie animacji, i czeka, aż zniknie `ViewSkeleton`.
- Zapadka: `KNOWN` mapuje `widok/rozmiar/motyw` → reguły axe. Test porównuje listę dokładnie, więc naprawione
  naruszenie też go wywraca — trzeba je usunąć z `KNOWN`. Lista może tylko maleć. Każdy wpis ma uzasadnienie.
- Jedyny wyjątek: `target-size` w Nauce na telefonie — komórki paska opanowania (`StudyView.tsx`) są węższe niż 24 px.
  Te same tematy są na tablicy poniżej (wyjątek „równoważna kontrolka” z WCAG 2.5.8).
- Naprawione przy wprowadzaniu testu:
  - `AnimatedTagline.tsx`: `aria-label` na `<p>` (zabronione) → tekst w `<span className="sr-only">`.
  - `AppSidebar.tsx`: stopka „NOTKI v1.0” z `text-muted-foreground/40` i skrót ⌘K z `opacity-70` → pełny kolor.
  - Nagłówki sobota/niedziela: `weekdayHeadClass` w `calendar/dayCellStyles.ts` (`text-primary/80`), `WeekStrip.tsx`
    i `ShiftWeekView.tsx` (`text-primary-ink/80`) → `text-primary-ink`.

**Ograniczenia i pułapki.** Skanowane są widoki, nie otwarte okna ani menu. Log `[a11y]` w wyniku testu podaje regułę
i pierwsze trzy elementy. axe nie ocenia kontrastu tekstu na obrazkach ani w trakcie animacji.

**Testy.** `e2e/a11y.spec.ts` (20 testów).

**Commit.** `35ed5a3` (2026-10-15).

---

## Wspólne — testy e2e na prawdziwych silnikach telefonów

**Co robi.** Testy oznaczone `@mobile` uruchamiają się także w profilach iPhone 14 (WebKit, czyli silnik Safari)
i Pixel 7 (Chrome na Androidzie): `npm run test:e2e:mobile`. Zwykłe `npm run test:e2e` uruchamia wszystkie projekty.

**Gdzie jest.** `playwright.config.ts` (projekty `iphone-14`, `pixel-7` z `grep: /@mobile/`), `package.json`
(`test:e2e:mobile`), tagi `@mobile` w `e2e/mobile.spec.ts` (wszystkie testy) i `e2e/touch-targets.spec.ts`.

**Jak działa i dlaczego.**
- Tylko `@mobile`, bo pozostałe testy zakładają układ komputera (pasek „Zapisz notatkę...”, pasek boczny).
- `test.use` w plikach nadpisuje rozmiar okna (390 × 844 albo tablet 1180 × 820), ale silnik i user agent zostają
  z profilu urządzenia.
- `serviceWorkers: "block"` w obu projektach: WebKit w Playwright przenosi service workera między kontekstami
  i od drugiego testu pokazuje dymek „Dostępna nowa wersja aplikacji”, który zasłania przyciski. Na prawdziwym
  telefonie to nie występuje; service workera sprawdza `e2e/pwa.spec.ts` w Chromium.
- Dwa testy (przytrzymanie kafla, przeciągnięcie arkusza) symulują dotyk przez CDP, które jest tylko w Chromium —
  na WebKit są pomijane (`test.skip(browserName !== "chromium")`).

**Ograniczenia i pułapki.** WebKit trzeba pobrać raz: `npx playwright install webkit`. WebKit na Windows to nie
prawdziwy iOS — nie odtwarza klawiatury ekranowej ani `visualViewport` iPhone'a.

**Testy.** `e2e/mobile.spec.ts`, `e2e/touch-targets.spec.ts` w projektach `iphone-14` i `pixel-7`.

**Commit.** `35ed5a3` (2026-10-15).

---

## Wspólne — układ telefonu bez przewijania w bok, pasek zbiorczy

**Co robi.** Pasek zbiorczy (po zaznaczeniu notatek) na telefonie zawija akcje w drugi rząd, zamiast chować archiwum
i kosz za przewijaniem w bok. Test pilnuje, że żadna trasa nie przewija się w bok przy 320 i 390 px i że „wstecz”
zamyka edytor notatki.

**Gdzie jest.** `src/components/BulkActionBar.tsx` (`max-sm:flex-wrap max-sm:justify-center`, separatory ukryte na
telefonie), `e2e/mobile-layout.spec.ts`.

**Jak działa i dlaczego.** Przy celach dotyku 44 px dziesięć akcji potrzebuje ~440 px, a pasek na 390 px ma ~374 px —
przewijany w bok pasek ukrywał 70 px akcji bez żadnej wskazówki. Od `sm` pasek zostaje jednorzędowy. Test przewijania
pomija elementy wewnątrz kontenerów z własnym `overflow-x` (paski pigułek) i wypisuje pierwsze trzy winne elementy.

**Ograniczenia i pułapki.** Trasy z parametrem (folder, etykieta) nie są w pętli testu.

**Testy.** `e2e/mobile-layout.spec.ts` (320/390 px: 9 tras bez przewijania w bok; pasek zbiorczy bez przewijania;
„wstecz” zamyka edytor), `e2e/templates-bulk.spec.ts`, `e2e/mobile.spec.ts`.

**Commit.** `e2c8b95` (2026-10-15).

---

## Wspólne — powiadomienia przy zamkniętej aplikacji (Web Push)

**Co robi.** Przypomnienia przychodzą o czasie także wtedy, gdy NOTKI są zamknięte. Działa to po włączeniu w
**Ustawienia → Ogólne → Powiadomienia przy zamkniętej aplikacji**: wpisujesz adres własnego serwera, stukasz
„Włącz”, a potem możesz sprawdzić działanie przyciskiem „Wyślij próbne”. Przez serwer idą:
- przypomnienia notatek, w tym kolejne terminy serii;
- Grafik na jutro, o godzinie wieczornego przypomnienia;
- „Raport dnia gotowy” i „Raport tygodnia gotowy”;
- problem z budowy otwarty od 3 dni;
- materiał zamówiony 3 dni temu, który jeszcze nie dojechał.

Pod polem adresu widać stan: liczbę zaplanowanych terminów i czas ostatniej wysyłki albo błąd.

**Gdzie jest.**
- `push-server/`: osobny serwer Node.
  - `core.js` — czysta logika: `cleanSubscription`, `cleanItems`, `dueItems`, `cleanStore`, `payloadOf`.
  - `server.js` — HTTP (`GET /vapid`, `PUT /schedule`, `POST /test`, `POST /unsubscribe`, `GET /health`) i obieg co 20 s.
  - `Dockerfile` i `README.md` z wdrożeniem i limitami.
- `src/lib/push/schedule.ts`: `buildPushSchedule(input)` zwraca `PushItem[]` (`key`, `at`, `title`, `body`, `url`).
  Ma też `outsideQuietHours` i stałe `PUSH_HORIZON_DAYS` (14) i `PUSH_MAX_ITEMS` (200).
- `src/lib/push/client.ts`: `pushSupport`, `enablePush`, `disablePush`, `sendTestPush`, `uploadSchedule`.
- `src/lib/push/prefs.ts`: store `pushPrefs` (localStorage `kaczy.push.v1`: `server`, `enabled`, `sentHash`, `last`)
  i `normalizePushServer`.
- `src/lib/push/shown.ts`: `pushKey` (klucze terminów), `wasShown`, `markShown` (Cache Storage `notki-push`, wpis `/__push-shown`).
- `src/components/PushScheduleSync.tsx`: ładowany leniwie z `Index.tsx`, tylko gdy `pushPrefs.enabled`.
- `src/components/settings/PushSettings.tsx`: sekcja w `GeneralSettings.tsx`.
- `public/sw-notifications.js`: obsługa zdarzenia `push`.
- `src/lib/systemNotification.ts`: nowe pole `key` w `showSystemNotification`. Podają je `useReminderNotifications`,
  `useShiftEveningNudge` i `DailyReportNudge`.

**Jak działa i dlaczego.**
- **Aplikacja liczy, serwer tylko wysyła.** Notatki, Grafik i dziennik żyją w Yjs na urządzeniu, więc serwer ich
  nie zna. Aplikacja liczy terminy na 14 dni tymi samymi funkcjami co timery strony (`nextInSeries`,
  `eveningNudgeFor`, `reportDueMinute`, progi z `reminders.ts`) i wysyła całą listę przez `PUT /schedule`.
  Serwer zastępuje nią poprzednią listę urządzenia.
- **Kiedy lista idzie na serwer.** Trzy sekundy po każdej zmianie notatek, Grafiku albo dziennika, co godzinę
  i od razu przy schowaniu aplikacji (`visibilitychange`, `fetch` z `keepalive`). To ostatnie łapie typowy
  przypadek: ktoś ustawia przypomnienie i od razu zamyka aplikację. Skrót listy (`sentHash`) blokuje
  wysyłanie bez zmian, ale co 6 godzin lista idzie i tak: horyzont się przesuwa, a serwer mógł stracić dane.
- **Warunki „na teraz” liczone z bieżącego stanu.** Raport dnia trafia na listę tylko wtedy, gdy dziś są już wpisy.
  Problem rozwiązany albo materiał dostarczony znika z listy przy najbliższej wysyłce. Progi „od 3 dni” wypadające
  między 21:00 a 7:00 przesuwamy na 7:00 (`outsideQuietHours`).
- **Bez podwójnych powiadomień.** Ten sam termin może przyjść z serwera i z timera strony. Obie drogi zapisują
  klucz terminu (`pushKey`, np. `n:<id>:<termin>`, `rd:<dzień>`, `e:<jutro>`) w Cache Storage, które widzą
  i strona, i service worker. Druga droga pomija klucz już pokazany. Dodatkowo push nie pokazuje nic, gdy
  aplikacja jest widoczna, bo wtedy przypomina sama (dymek i powiadomienie z timera). Wyjątek: powiadomienie
  próbne (`test:…`) pokazuje się zawsze.
- **Prywatność.** Na serwer trafiają terminy, tytuły i krótkie opisy. Z notatek idzie tylko tytuł, bez treści,
  a notatka prywatna ma stały tytuł „Przypomnienie z notatki prywatnej”. Ustawienie jest urządzenia, nie dokumentu
  Yjs: dwa telefony z tą samą listą dostałyby każde przypomnienie dwa razy.
- **Klucze VAPID.** Serwer tworzy je przy pierwszym starcie (`DATA_DIR/vapid.json`). `enablePush` porównuje klucz
  istniejącej subskrypcji z kluczem serwera i przy zmianie subskrybuje od nowa.

**Ograniczenia i pułapki.**
- Wymaga własnego serwera z https (Caddy lub nginx przed portem 4455). Bez niego wszystko działa jak dotąd:
  przypomnienia tylko przy otwartej aplikacji.
- iPhone obsługuje push tylko w aplikacji dodanej do ekranu początkowego; w Safari sekcja to mówi.
- Przyciski w powiadomieniu („Odłóż 10 min”, „Gotowe”) są tylko w powiadomieniach z timera strony. Powiadomienie
  z serwera tylko otwiera aplikację pod adresem notatki albo działu.
- Seria przypomnień przesuwa `reminder` notatki dopiero przy otwartej aplikacji. Kolejne terminy serii są jednak
  na liście, więc przy zamkniętej aplikacji też przyjdą.
- Termin spóźniony o ponad godzinę (serwer nie działał) przepada. Nieudanej wysyłki serwer nie ponawia.
- Nie da się wysłać przypomnienia „próba bez protokołu” (`no-test`): nie ma ono momentu w czasie. Zostaje jako
  pasek w Dzienniku.
- Lista na serwerze jest najwyżej tak świeża jak ostatnie otwarcie aplikacji. Wpis dodany na innym telefonie
  trafi na tę listę dopiero po synchronizacji i otwarciu aplikacji na tym urządzeniu.
- Nie sprawdzone na prawdziwym telefonie (headless Chromium nie ma usługi push). Serwer sprawdzony lokalnie:
  zapisał termin, o czasie wysłał go do FCM, a po 404/410 dla fikcyjnej subskrypcji ją usunął.

**Testy.** `src/lib/push/schedule.test.ts` (notatki i serie, notatka prywatna, Grafik, raport dnia i tygodnia,
problemy, braki, noc), `push-server/core.test.js` (`npm test` w `push-server`: walidacja, limity, termin
należny i przepadły, uszkodzony plik), `e2e/push.spec.ts` (włączenie z podstawioną subskrypcją i serwerem:
`PUT /schedule`, „Wyślij próbne”, „Wyłącz”; błędny adres).

**Commit.** `fe01dcd` (2026-10-16).

## Notatki — stan aktualny (kafel, edytor, czytnik, kompozytor, lista, wyszukiwanie, właściwości)

Dział opisany w jednym miejscu. Refaktor `Index.tsx` i `NoteCard.tsx` (etapy 4 planu) jest uwzględniony jako struktura kodu, nie jako historia.

### Co robi

- **Kafel notatki** (`NoteCard`): tryb podglądu (okładka, tytuł z ikoną i kłódką, treść albo fragment trafienia, lista zadań, etykiety, przypomnienie, priorytet, załączniki, „Gotowe”/„Jutro” przy zaległym terminie, link zwrotny, podstrony, odliczanie kosza z „Przywróć”, czas czytania) oraz tryb edycji w kaflu. Przypięcie, kolor, przypomnienie, priorytet, archiwizacja i usuwanie są na stopce (mysz) albo w arkuszu „⋯” (dotyk). „Więcej opcji” zawiera resztę: ikona, ulubione, szerokość, większy tekst, blokada, podstrona, obraz, rysunek, etykiety, folder, prywatna, udostępnij, wersje, prezentacja, duplikat, kopiuj jako Markdown (nie dla notatek prywatnych).
- **Edycja w kaflu:** tytuł, treść, lista zadań, autozapis, „Zapisz”, zapis przy zamknięciu, skróty w polu treści (Ctrl+F/H, lista, Tab, Alt+↑/↓), podpowiedzi `[[` i `/`, pasek formatowania, podgląd Markdown.
- **Pełny edytor** (na telefonie każde otwarcie notatki, na komputerze „Pełny ekran”): okno rośnie z kafla, który stuknięto, i przy zamknięciu wraca do niego. U góry pasek koloru notatki; nagłówek dostaje cień po przewinięciu treści.
- **Gesty na dotyku:** przesunięcie w prawo przypina (albo odpina), w lewo archiwizuje (w Archiwum przywraca). Po przypięciu dymek „Przypięto”/„Odpięto” z „Cofnij”. Przytrzymanie 450 ms zaznacza kafel. Kosz nie ma gestu. Przy myszy: przechył 3D, gdy włączony w ustawieniach i bez redukcji ruchu.
- **Efekty:** animacja wyjścia (kosz, archiwum), iskra „klik pinezki” przy przypięciu, pieczątka „gotowe” po odhaczeniu ostatniego zadania. Przy redukcji ruchu bez przechyłu, animacji i iskier.
- **Obrazy kafla:** „Dodaj obrazek” (w „Więcej opcji”), wklejony zrzut do pola treści, rysunek z płótna, usuwanie z „Cofnij”.
- **Czytnik** (`NoteReader`): podgląd i pełny ekran. ←/→ i przyciski „Poprzednia/Następna notatka” przechodzą po widocznej liście (bez notatek prywatnych); ←/→ są ignorowane w polach tekstowych i przy modyfikatorach.
- **Kompozytor nowej notatki** (`AddNoteBar`): zwinięty pasek to kafelek z bursztynowym plusem; rozwinięty ma pole tytułu (`TitleField`, zawija się), treść, rozpoznawanie fraz (`#etykieta`, `@folder`, `!`/`!!`, daty „jutro 9:00”, „za 2h”), „Odłóż” na listę roboczą szkiców, wklejanie HTML jako Markdown.
- **Lista robocza szkiców:** „Odłóż” zapisuje szkic na listę (rząd „Odłożone” nad tytułem); kliknięcie wznawia, „×” usuwa z „Cofnij”. Limit 20, najstarszy odpada. Lokalna dla przeglądarki.
- **Lista (checklista):** każda nieodhaczona pozycja ma „Przesuń w górę/w dół” (wyłączane na krawędzi, na komputerze po najechaniu, na dotyku zawsze). Alt+↑/↓ działa jak dotąd. Przeciąganie pozycji odłożone.
- **Scalanie zaznaczonych notatek:** przycisk „Scal zaznaczone w jedną notatkę” na pasku zbiorczym (tylko lista). Pierwsza notatka dostaje treść pozostałych (pogrubiony tytuł, oddzielone `---`), etykiety, obrazy, załączniki, listy, najwyższy priorytet; termin pierwszej, a gdy go nie ma — najwcześniejszy z pozostałych. Pozostałe idą do kosza. „Cofnij” przywraca wszystko. Odmowa: mniej niż 2 notatki, prywatna, tylko do odczytu, archiwum, kosz, podstrony, otwarty edytor celu.
- **Udostępnianie z innej aplikacji** (Share Target): „Udostępnij → NOTKI” tworzy notatkę. Tekst i link do treści (link bez dubla). Obrazy stają się zdjęciami, PDF załącznikiem; inne typy są pomijane z komunikatem. Maks. 30 plików na udostępnienie.
- **Skróty PWA** (przytrzymanie ikony): Nowa notatka, Wpis z budowy, Wpis głosowy, Grafik, Szukaj, Nowa lista, Dziś, Przypomnienia. Kolejność celowa: Android pokazuje kilka pierwszych.
- **Wyszukiwanie:** trafienia zaznaczone w tytule kafla; przy trafieniu tylko w treści kafel pokazuje fragment z zaznaczeniem. Dopasowanie bez ogonków i wielkości liter („zolw” zaznacza „żółw”). Pole „Szukaj notatek...” ma stałą etykietę; podpowiedzi operatorów (`etykieta:`, `ma:`, `starsze:`, `pole:`) pokazują się w zdaniu pustego wyniku.
- **Widok:** trzy ikony po prawej w nagłówku (układ, sortowanie, filtry) na jasnej kartce. W stylu Zeszyt tytuł widoku jest w Fraunces, pasek nagłówka ma tylko cienką kreskę. Liczba notatek przy nagłówku grupy jest pieczątką (obwódka). Kafel ma promień `rounded-card` (16 px); uniesienie przy najechaniu tylko dla myszy.
- **Puste stany:** każdy pusty widok (Notatki, Archiwum, Kosz, Przypomnienia, Kalendarz, Grafik, Dziś, Tydzień, etykieta, folder, Skrzynka) ma nagłówek i zdanie z następnym krokiem. Bez przycisków — następny krok to działanie na kaflu lub w kompozytorze.
- **Właściwości notatek** (pola własne): tekst, liczba, data, wybór z listy. Okno „Pola notatek” nad tabelą; wartości wpisuje się w komórki tabeli (kolumna na każde pole). Sortowanie po polu (nagłówek kolumny, menu „Sortuj wg”), filtr `pole:Nazwa=wartość`, wiersz „Nazwa: wartość” pod tytułem na telefonie, sekcja „Pola” w czytniku, eksport (Markdown wiersz `*Pole: …*`, ZIP klucz `props`), import z ZIP-a (dopasowanie po nazwie, typ z wartości).
- **Podział widoku w Index:** `Index.tsx` (ok. 960 linii) zostawia stan okien (paleta, ustawienia, statystyki) i widoki.

### Gdzie jest

**Kafel (`NoteCard` i hooki):**
- `src/components/NoteCard.tsx` — otoczka kafla: przechył, `motion.div`, stany okien, `renderEditor(full)`, `useLatch` dla leniwego montowania.
- `src/components/NoteCardBody.tsx` — tryb podglądu (`BACKLINKS_SHOWN`, `subpage`, `trashCountdown`, „Gotowe”/„Jutro”).
- `src/components/NoteCardActions.tsx` — `ActionBtn`, `PrimaryActions` (stopka i arkusz), `MoreActions` (rozwinięcie i arkusz), kopiuj Markdown.
- `src/components/NoteCardDialogs.tsx` — `ActionSheet`, `ImagePreviewDialog`, `DeleteNoteDialog`.
- `src/components/NoteEditor.tsx` — edytor w kaflu i w oknie (`NoteEditSession` z `useNoteEditSession`).
- `src/hooks/useNoteEditSession.ts` — sesja edycji: stan, `handleEditKeyDown`, `handleFormatInsert`, autozapis, `commitDraft`, `begin`.
- `src/hooks/useLiveNoteText.ts` — tekst peera w otwartym polu: zdalna zmiana → `rebaseNoteTextEdit` → wstawienie do szkicu z zachowaniem zaznaczenia.
- `src/hooks/useNoteImages.ts` — `handleImageUpload`, `handleEditPaste`, `addDrawing`, `removeImage` (przez `prepareImage` i `imageStore`; usuwanie zapisuje poprzednią listę dla „Cofnij”).
- `src/hooks/useCardMotion.ts` — przechył, `cardVariants`, `pinFx`, `stampKey`.
- `src/hooks/useCardGestures.ts` — gesty dotykowe (`useDragControls`, `touch-action: pan-y`, próg 110 px albo 60 px przy szybkim ruchu), długie przytrzymanie, przechył myszą.
- `src/hooks/useOriginFromTile.ts` — origin animacji okna z kafla; wspólny z czytnikiem.
- `src/lib/swipeHint.ts` — `showSwipeLabels`, `countSwipe`, klucz `kaczy.swipeHints.v1` (maks. 3 podpisy).
- `src/components/AddNoteBar.tsx` — kompozytor (zwinięty pasek, pole treści, „Odłóż”, `handleContentPaste`).
- `src/components/TitleField.tsx` — pole tytułu jako `textarea` z automatyczną wysokością.

**Index i hooki widoku:**
- `src/hooks/useReaderNav.ts` — czytnik: `previewId`, `readerId`, `readerNote`, `readerSteps`, `closeReader`, `stepReader`, `editFromReader`.
- `src/hooks/useSelection.ts` — `selectedIds`, `selectionMode`, `clearSelection`; zmiana widoku, etykiety lub folderu zdejmuje zaznaczenie.
- `src/hooks/useSelectionGestures.ts` — klik, Shift-zakres, Ctrl/Cmd+A (nie działa przy otwartym oknie, czytniku, prezentacji ani w kalendarzu, grafiku i nauce).
- `src/hooks/useAchievementToasts.ts` — pieczątka odznaki albo paczkowany cichy toast „Nowe odznaki: N” (stałe `id`); „Zobacz” otwiera Statystyki.
- `src/hooks/useLaunchIntents.ts` — raz przy starcie: udostępnianie (`/share`, `?inbox=`), skróty PWA (`?new=1`, `?new=list`, `?szukaj=1`); parametr znika z adresu.
- `src/hooks/useBulkNoteOps.ts` — `restoreSelected`, `pinSelected`, `moveSelectedToFolder`, `labelSelected`, `moveToColumn`, `mergeSelected`.
- `src/hooks/useWikiLinkIndex.ts` — `allNotesForLinks`, `knownTitles`, `wikiIndex` (stabilne przez `useStableByKey` z `src/hooks/useLatestRef.ts`).
- `src/hooks/useNoteActions.ts` — kosz, archiwum, kolor.
- `src/hooks/useFilteredNotes.ts` — typ `View`, `sortNotes`, filtry, `filterNotes`.
- `src/components/TrashConfirmDialogs.tsx` — `DeleteForeverDialog`, `EmptyTrashDialog`.
- `src/components/sidebar/sidebarItems.ts` — pozycje paska bocznego.
- `src/components/BulkActionBar.tsx` — pasek zbiorczy z „Scal”.
- `src/lib/mergeNotes.ts` — `planMerge` (czysta funkcja scalania).
- `src/lib/readerStep.ts` — `readerNeighbors(ids, current)`.
- `src/components/NoteReader.tsx` — czytnik (`onStep`, `canPrev`, `canNext`, sekcja „Pola”, kopiuj Markdown/tekst).
- `src/lib/noteMarkdown.ts` — `copyNoteToClipboard(note, "markdown" | "text")`, eksport Markdown i ZIP.

**Lista, widok, wyszukiwanie:**
- `src/components/ChecklistEditor.tsx` — `canMove(id, dir)`, przyciski przesuwania; przesuwanie przez `moveItem`.
- `src/components/NoteGrid.tsx` — `DENSITY_GAPS` (gęstość w jednej tabeli).
- `src/components/ViewControls.tsx` — grupa trzech ikon w nagłówku.
- `src/components/AppHeader.tsx` — nagłówek (`app-header`, `app-title`).
- `src/components/NoteGroupSection.tsx` — nagłówek grupy, licznik jako `stamp-tag`.
- `src/components/EmptyState.tsx` — `HEADINGS` (krótkie etykiety) i `DESCRIPTIONS` (zdania z następnym krokiem).
- `src/lib/htmlToMarkdown.ts` — `htmlToMarkdown(html)` (DOMParser, wybrane znaczniki).
- `src/lib/quickCapture.ts` — `scanField`, `applyCapture`, `PREPOSITION_BEFORE_RE`.
- `src/lib/parkedDrafts.ts` — `addParked`, `removeParked`, `parkedLabel`, `PARKED_MAX` = 20; klucz `kaczy.drafts.v1`.
- `src/lib/shareInbox.ts`, `src/lib/shareTarget.ts`, `public/sw-share.js` (przechwytuje `POST /share`, cache `share-inbox-v1`), `public/manifest.webmanifest` (`shortcuts`, `share_target`).
- `src/lib/searchHighlight.ts`, `src/lib/searchTerms.ts`, `src/components/SearchMarks.tsx`, `src/components/SearchBar.tsx`, `src/lib/searchQuery.ts` (`fold`, `parseSearchQuery`, `matchesProp`).
- `src/lib/skins.ts` — `data-skin` na `<html>` (domyślnie `zeszyt`).

**Właściwości (pola własne):**
- `src/lib/noteProps.ts` — `PropDef`, `PropType` (`text | number | date | select`), `cleanPropDef(s)`, `cleanNoteProps`, `parsePropInput`, `propDisplayText`, `comparePropsForSort`, `filledPropEntries`, `PROP_LIMITS`.
- `src/lib/yjsStore.ts` — mapa `propDefs` w korzeniu dokumentu, pole `props` na notatce, `applyPropsDiff`, `upsertPropDef`, `deletePropDef`.
- `src/hooks/useNotes.ts` — `Note.props`, `propDefs`, `addPropDef`, `updatePropDef`, `deletePropDef`.
- `src/components/NoteTable.tsx` — kolumny pól, `PropCell`.
- `src/components/PropDefsDialog.tsx` — okno „Pola notatek” (leniwe).
- `src/lib/sortOptions.ts` — jedna lista opcji sortowania dla menu i arkusza telefonu.
- `src/lib/import/markdown.ts` (`parsePropsFrontmatter`), `src/lib/import/commit.ts` (`inferPropType`, `resolvePropDefs`, `undoImport`).

### Jak działa i dlaczego

- **Stan w kafelku przez hooki, nie props.** Logika kafla jest podzielona na hooki (`useNoteEditSession`, `useCardMotion`, `useCardGestures`, `useNoteImages`), a komponenty (`NoteCardBody`, `NoteCardActions`, `NoteCardDialogs`, `NoteEditor`) dostają wartości przez props. Jedna sesja edycji obsługuje kafel i pełne okno, więc rozwinięcie nie zmienia ścieżki zapisu.
- **Hook sesji trzyma szkic** (`draftRef`, `versionSavedRef`), bo `commitDraft` jest wołane z cleanupu przy odmontowaniu. `begin()` bierze treść z `beginNoteTextEdit`, a nie z `note`, żeby pokazać to, co widzi peer.
- **Obrazy:** skalowanie do 2 MB (`prepareImage`), bajty w `imageStore`, do notatki trafia klucz SHA-256. Obrazy, których nie da się przeskalować, są liczone w jednym komunikacie.
- **Gest startuje ręcznie** (`useDragControls`) poza uchwytem przeciągania należącym do dnd-kit. Kosz bez gestu, żeby przypadkowy ruch nie usuwał. Archiwizacja gestem idzie przez `runWithoutConfirm` — jest odwracalna „Cofnij”.
- **Origin animacji okna** to środek kafla. Element okna trzymany w stanie, nie w `useRef`: treść `Dialog` montuje się w portalu po otwarciu. Bez `layoutId`, bo kolidowałoby z dnd-kit.
- **Czytnik i zaznaczenie** korzystają z widocznej listy (`visibleNotes`), nie z wszystkich notatek; notatka spoza listy nie ma sąsiadów.
- **Share Target** działa w dwóch etapach, bo POST nie ma gdzie wylądować: SW odkłada pliki w cache i przekierowuje na `/share?inbox=<id>`, aplikacja odbiera je po starcie. Meta zapisywana ostatnia — przerwany zapis nie daje notatki bez plików.
- **Scalanie** jest funkcją czystą (`planMerge`), więc odmowa i wynik są testowane bez UI.
- **Właściwości:** definicja w `propDefs` (klucz = id), wartość w `props` notatki (klucz = id definicji). Zmiana nazwy pola nie rusza wartości. Zapis tylko różnic. Walidacja tym samym `clean*` przy odczycie, przywracaniu kopii i wejściu z komórki; zły wpis jest pomijany.
- **Notatka prywatna** nie dostaje właściwości: nie ma ich w szyfrogramie, zapis jest pomijany w `applyPatch`.
- **Lista robocza szkiców** ma osobny klucz, nie rozszerza `kaczy.draft.v1`, więc starsze wersje i przywracanie szkicu działają jak dawniej.

### Ograniczenia i pułapki

- Kafel: przeciąganie kolejności tablicy jest w `useNoteDnd` (nie w kaflu); na telefonie kolumny tablicy są poza ekranem przy 390 px.
- Przechył 3D i `isTouch` liczone przy renderze przez `matchMedia`; zmiana urządzenia w trakcie sesji nie jest wykrywana.
- Edytor: `NoteEditor` czyta `session` przez destrukturyzację — nowe pole sesji trzeba dopisać w tym pliku.
- Dodanie akcji kafla wymaga zmiany w `NoteCardActions.tsx` (w obu miejscach: stopka/arkusz i „Więcej”).
- Wklejanie zrzutu do pola treści nie ma e2e; „Dodaj obrazek” jest w menu „Więcej”, nie na pasku kafla.
- Kompozytor: `htmlToMarkdown` nie obsługuje tabel, zagnieżdżonych list i obrazów; działa tylko w kompozytorze nowej notatki, nie w edytorze.
- Kompozytor: „Spotkanie w piątek” w tytule nie ustawi przypomnienia (przyimek przed datą); „Zadzwonić jutro 9:00” w tytule nadal ustawia.
- Lista robocza i licznik szkiców są lokalne dla przeglądarki; nie synchronizują się.
- Czytnik: notatka otwarta z linku spoza bieżącej listy nie ma sąsiadów — krok nic nie robi.
- Udostępnianie z plikiem wymaga aktywnego SW; po aktualizacji SW pierwsze udostępnienie z plikiem może trafić na 405.
- Wyszukiwanie: na telefonie są dwa pola `input[type=search][aria-label="Szukaj w notatkach"]` (jedno ukryte). Testy muszą brać widoczne (`offsetParent !== null`).
- Właściwości: edycja tylko w tabeli (od `md`) i w czytniku; typ pola jest stały po utworzeniu; usunięcie opcji nie kasuje wartości, które jej używały.
- Właściwości: z `props` w imporcie nie idzie pojedynczy wiersz `*Pole: …*` — tylko frontmatter ZIP-a.
- Scalanie nie przenosi właściwości ani kolorów; wikilinki do scalonych tytułów po wyrzuceniu do kosza przestają wskazywać na żywą notatkę.
- Eager bundle: właściwości podniosły próg; ostatni pomiar 392,4 KB przy progu 393 KB.

### Testy

- Jednostkowe: `src/lib/searchHighlight.test.ts`, `src/lib/readerStep.test.ts`, `src/lib/mergeNotes.test.ts` (14), `src/lib/quickCapture.test.ts` (38), `src/lib/parkedDrafts.test.ts`, `src/lib/htmlToMarkdown.test.ts`, `src/lib/swipeHint.test.ts`, `src/lib/shareInbox.test.ts`, `src/lib/shareTarget.test.ts`, `src/lib/manifest.test.ts`, `src/lib/noteProps.test.ts`, `src/lib/yjsStore.props.test.ts`, `src/lib/noteSchema.props.test.ts`, `src/lib/searchQuery.test.ts`, `src/lib/import/markdown.test.ts`, `src/lib/import/commit.test.ts`, `src/lib/achievements.test.ts`, `src/lib/achievementStamp.test.ts`, `src/components/EmptyState.copy.test.ts` (12), `src/lib/exportZip.test.ts`.
- E2E (chromium, z zapisanych przebiegów): `notes`, `editing`, `editor-keys`, `editor-open`, `reader`, `reader-step`, `wikilinks`, `live-text`, `live-text-focused`, `checklist`, `checklist-move`, `composer`, `quick-capture`, `paste-html`, `parked-drafts`, `card-images`, `card-motion`, `card-copy`, `merge-notes`, `note-props`, `note-props-view`, `search-highlight`, `search-backup`, `share-files`, `board-table`, `mobile`, `mobile-layout`, `touch-targets`, `editor-open`, `note-groups`, `subpages`, `private-notes`, `read-only-note`, `reminder-toast`, `routes`, `pwa`. Ostatnie pełne przebiegi: 365/365 (2026-10-16), później punktowe; przy zmianach z 2026-10-19/20 e2e nie uruchamiano w całości.

### Commity

- Skróty PWA: `c1a431f` (2026-10-15). Kafel, hooki i gesty (etap 4): `1ccb86d`, `3342c00`, `ff09430`, `bea4f33`, `c513247`, `39231e6`, `6ab66bf`, `2141f60`, `a8ae0a5`, `3596e41`, `c55f50e`, `ad2df94`, `7437879`, `53e7886`, `1ca6108`, `b091505`, `1d1811c` (gesty na telefonie, 2026-10-15).
- Wyszukiwanie: `8f01351` (2026-10-16). Kompozytor i listy: `682f69f`, `4b02b6f`, `86479bf`, `0aa1c77`.
- Właściwości: `a5976a1`, `fd377a5`, `5bb3966`, `f64dd9d` (2026-10-16).
- Scalanie: `5f003ca` (2026-10-18). Kopiuj Markdown: `d0c6eed` (2026-10-18).
- Kompozytor i wygląd (2026-10-19): `6e95430`, `280f294`, `2745eaf`, `d3f446f`, `707e7a0`, `bb48640`, `f5e418c`, `0284db6`.
- Dopracowanie (2026-10-20): `02c1560`.

## Wspólne — aktywny wiersz paska bocznego (wygląd)

**Co robi.** Aktywny wiersz paska bocznego (Notatki, Skrzynka, folder, etykieta) ma bursztynową pigułkę jak dotąd
i dodatkowo cienką kreskę przy lewej krawędzi, jak zapis na marginesie zeszytu. Kreska przejeżdża razem z pigułką.

**Gdzie jest.** `src/components/sidebar/SidebarRow.tsx`: `motion.span` z `layoutId="sidebar-active-pill"` ma w środku
dziecko `span` (`absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary`).

**Ograniczenia.** Kreska jest w tym samym `layoutId`, więc animacja przejścia między wierszami obejmuje też ją.
Na telefonie pasek boczny jest arkuszem, a ten sam wiersz wygląda tak samo.

**Testy.** Brak dedykowanego testu wyglądu; Vitest przechodzi (1349). Zrzut jasnego motywu sprawdzony.

## Grafik — stan aktualny (zmiany, rachunek, eksporty, wiele grafików)

Dział opisany w jednym miejscu: rdzeń (dotąd nieopisany) i dodatki z 2026-10-09…20. Przegląd audytu z 2026-10-09 jest uwzględniony.

### Co robi

- **Siatka miesiąca** (`ShiftMonthGrid`): dni tygodnia od poniedziałku, w komórce numer dnia, skrót rodzaju zmiany w kolorze i strzałka nadgodzin (↑/↓) na telefonie. Nawigacja miesiąca; widok tygodnia (`ShiftWeekView`). Siatka to `role="grid"` ze strzałkami; ←/→ i ↑/↓ przesuwają dzień (`dayKeyCommand`).
- **Rodzaje zmian** (`ShiftType`): nazwa, skrót 1–3 znaki, kolor, godziny start–koniec, przerwa (minuty, opcjonalnie „o której”), stawka (opcjonalna), alarm w eksporcie do kalendarza, rodzaj `work` lub `absence` (urlop, chorobowe, inna). Domyślne: „Praca na budowie (10 h)” i „Dniówka 8–16”, dodawane raz na grafik (`addPresetOnce`).
- **Wpis dnia** (`DayEntry`): rodzaj, notatka, odchylenie od planu w minutach (`extraMin`: + zostałem dłużej, − wyszedłem wcześniej), praca w dzień wolny według grafiku (`offSchedule`) lub w zamian za niedzielę/święto (`inLieu`), własne godziny dnia (`customHours`).
- **Pędzel** (`BrushBar`, `BrushHours`): wybrany rodzaj nanosi się kliknięciem lub przeciągnięciem; osobny tryb godzin. Przeciąganie kafli przenosi wpis (`ShiftDnd`, `planTransfer`).
- **Cykle** (`ShiftPattern`): lista kroków (rodzaj albo dzień wolny), powtarzana od wybranej daty do końca miesiąca (`applyPattern`, `daysUntilMonthEnd`). `PatternDialog`.
- **Kopiowanie:** wpis i tydzień można przenieść lub skopiować na inny dzień (`transferDay`, `pasteDay`, `copyWeekToNext`). Cofnięcie przywraca poprzedni stan dni (`restoreDays`).
- **Wyszukiwanie dni** (`searchShiftDays`) i **fokus z palety poleceń** (`requestShiftDay` / `takeShiftDay`): „Pokaż dzień” otwiera właściwy miesiąc i dzień.
- **Karta „Teraz”** (`NowCard`): bieżąca lub następna zmiana (`currentAndNextShift`, horyzont 60 dni).
- **Podpowiedź wieczorna** (`eveningNudge`): opcjonalne przypomnienie wieczorem (godziny 18–22 do wyboru); godzina w localStorage tego urządzenia.
- **Rachunek miesiąca** (`ShiftSummary`, `monthSummary`): dni w pracy, przepracowane godziny, godziny nocne, norma po odjęciu nieobecności, nadgodziny (dobowe i ponad normę okresu), z tego z dodatkiem 100%, zarobek brutto, premie, krótkie odpoczynki poniżej 11 h. Okresy rozliczeniowe dłuższe niż miesiąc (`settlementPeriod`) pokazują podsumowanie okresu.
- **Urlop** (`leaveBalance`): wymiar roczny (`leaveDays`, domyślnie 20), wykorzystanie i saldo na dziś.
- **Podsumowanie roku** (`YearSummaryDialog`, `yearSummary`): wiersze miesięcy i sumy.
- **Eksporty:** plik `.ics` do kalendarza (`buildShiftsIcs`; zmiany odwołane po stronie grafiku dostają status anulowania, wysłane dni pamiętane w `kaczy:shifts.icsExported`), karta czasu CSV (`buildTimesheetCsv`), obraz miesiąca PNG (sekcja niżej).
- **Premie** i **wiele grafików** — opisane niżej.

### Ustawienia grafiku (`ShiftSettingsDialog`)

- **Stawka za godzinę** (zł, 0 = nie licz zarobku). Stawka rodzaju nadpisuje domyślną.
- **System czasu pracy** (`workSystem`): `basic` — dobowy limit 8 h (art. 129 KP) albo `equivalent` — do 12 h wg grafiku (art. 135 KP).
- **Okres rozliczeniowy** (`settlementMonths` 1, 2, 3, 4, 6, 12) i miesiąc startu (`settlementStart`), np. kwartały od lutego. Nadgodziny ponad normę rozlicza się w ostatnim miesiącu okresu.
- **Etat** (`fte`, (0, 1]; norma proporcjonalna) i próg nadgodzin przy niepełnym etacie (`overtimeFrom`).
- **Niedziela i święto** (`sundayFrom`, domyślnie 6:00 następnego dnia) i **pora nocna** (`nightFrom`: 21, 22 albo 23; trwa 8 h).
- **Święta** (`polishHolidays`, wyliczenie Wielkanocy): dzień świąteczny wpływa na normę (`isNormDay`, `workNormMinutes`) i na dodatki.

### Premie w rachunku

- Premia jednorazowa w miesiącu (nazwa do 40 znaków, kwota brutto > 0 do 1 000 000 zł), do 500 na grafik.
- Dolicza się do zarobku miesiąca, osobna linia „Premia: …” w rachunku, panel „Premie w tym miesiącu” z dodawaniem i usuwaniem (z „Cofnij”). Dodatek za nadgodziny liczy się bez premii.
- Tylko kwota stała — brak premii procentowej, brak podatków i składek (kwota brutto, jak reszta zarobku).

### Obraz miesiąca (PNG)

- Przycisk „Obraz miesiąca (.png)”: siatka miesiąca (od poniedziałku), skróty i kolory rodzajów, podsumowanie (dni w pracy, godziny, nieobecności, zarobek brutto, jeśli jest stawka).
- Na telefonie otwiera systemowe okno udostępniania z plikiem; gdy go nie ma, pobiera plik. Anulowanie okna nie jest błędem.
- Obraz jest w jasnych kolorach, niezależnie od motywu. Tylko jeden miesiąc.

### Wiele grafików

- Przełącznik na górze widoku (`ScheduleSwitcher`): wybór, „Nowy grafik”, zmiana nazwy, usunięcie z potwierdzeniem. Grafik główny istnieje zawsze i nie da się go usunąć; maksymalnie 10 grafików.
- Każdy grafik ma własne rodzaje, dni, cykle i premie. Widoki (dziś, tydzień, podsumowanie, eksporty) pokazują aktywny grafik.

### Gdzie jest

- **Model i czas:** `src/lib/shifts/model.ts` (`ShiftType`, `DayEntry`, `ShiftPattern`, `ShiftBonus`, `ShiftData`, `cleanBonus`, `migrate`, `DEFAULT_SHIFT_TYPES`, `DEFAULT_PATTERNS`), `time.ts` (minuty, noc, DST, `formatMoney`, `formatDuration`), `holidays.ts`, `color.ts` (`shiftInk` — kontrast tekstu na kolorze).
- **Rachunek:** `summary.ts` (`monthSummary`, `dailyOvertimeSpans`, `premium100Minutes`, `shortRests`, `settlementPeriod`, `currentAndNextShift`), `leave.ts` (`leaveBalance`, `yearSummary`), `timesheet.ts`.
- **Dane (Yjs):** `yShifts.ts` — `createYShifts(doc, scheduleId)`, mapy `shiftTypes`, `shiftDays`, `shiftPatterns`, `shiftBonuses`, `shiftMeta`, `shiftMigrations`; origin `SHIFTS_ORIGIN`. `schedules.ts` — rejestr grafików (`createScheduleRegistry`, `isScheduleId`, `cleanScheduleName`, `SCHEDULES_MAX` = 10).
- **Store:** `store.ts` — `useShifts`, `useShiftsReady`, `setDayShift`, `setDayEntry`, `saveShiftType`, `deleteShiftType`, `savePattern`, `saveBonus`, `deleteBonus`, `setHourlyRate`, `setWorkSystem`, `setSettlementMonths`, `setFte`, `setLeaveDays`, `bindSchedule`, `createSchedule`, `renameSchedule`, `removeSchedule`, `mainShiftData`, `extraSchedulesDump`, `restoreExtraSchedule`, `restoreShifts`.
- **Ruch i wyszukiwanie:** `move.ts` (`transferredEntry`, `planTransfer`, `planPaste`, `planWeekCopy`, `dayKeyCommand`), `searchDays.ts`, `focusDay.ts`, `eveningNudge.ts`, `pattern.ts`.
- **Eksporty:** `ics.ts` (`buildShiftsIcs`, `exportableShiftDays`, `cancelledShiftDays`), `timesheet.ts`, `monthImage.ts` (układ, czysty), `monthImageDraw.ts` (canvas i udostępnianie, ładowane leniwie).
- **Komponenty** (`src/components/shifts/`): `ShiftsView.tsx` (widok, `exportImage`, podpięcie przełącznika), `ShiftMonthGrid.tsx`, `ShiftWeekView.tsx`, `ShiftSummary.tsx` (`Receipt`, `BonusPanel`), `NowCard.tsx`, `DayDialog.tsx`, `ShiftTypeDialog.tsx`, `PatternDialog.tsx`, `ShiftSettingsDialog.tsx`, `YearSummaryDialog.tsx`, `BrushBar.tsx`, `BrushHours.tsx`, `ShiftDnd.tsx`, `TimeStepper.tsx`, `CountUp.tsx`, `ScheduleSwitcher.tsx`, `labels.ts`, `dayLabel.ts`.
- **Kopia:** `src/lib/noteSchema.ts` (pola `shifts`, `shiftSchedules`), `src/lib/exportNotes.ts` (zapis w buildzie i przywracanie; grafik główny zastępuje, dodatkowe są dokładane).
- **Podpięcie:** `src/pages/Index.tsx` (leniwy widok), `src/hooks/useFilteredNotes.ts`, `src/lib/viewRoute.ts`, pasek boczny, `BottomNav.tsx`, paleta poleceń. Telefon w poziomie: wariant `short:` w `tailwind.config.ts`.

### Jak działa i dlaczego

- **Dane w Yjs.** Grafik jest w dokumencie notatek, więc synchronizuje się między urządzeniami i wchodzi do pełnej kopii. Każdy dzień, rodzaj, cykl i premia to osobny klucz mapy: dwa telefony wpisujące różne dni scalają się bez strat.
- **Zapis i odczyt przez `clean*` / `migrate`.** Złe rekordy od peera lub z kopii są odrzucane przy odczycie. `migrate` przyjmuje też dane sprzed `version: 2`.
- **Migracja z localStorage.** Dawny zapis w `kaczy:shifts` jest przenoszony do dokumentu raz na urządzenie (znacznik `device` w dokumencie, nie w localStorage). Stary klucz zostaje jako kopia; uszkodzony zapis zostaje nietknięty i jest zgłaszany w logu.
- **Stabilne odczyty.** `useShifts` i pochodne zwracają cache; zmiany powiadamiają przez `emitStore`.
- **Wiele grafików.** Grafik główny używa dawnych nazw map (dane sprzed wprowadzenia grafików zostają na miejscu), pozostałe mają prefiks `id:`. Rejestr nazw jest w dokumencie; wybór aktywnego grafiku jest w localStorage tego urządzenia, bo to preferencja widoku. Jeśli zapamiętany grafik zniknął (usunięty na innym urządzeniu), wracamy do głównego (H1). Usunięcie czyści mapy w tej samej transakcji.
- **Funkcje zamiast aliasów.** Eksporty store są funkcjami delegującymi do aktywnego grafiku, nie zamrożonymi referencjami — inaczej przepinanie grafiku nie działałoby.
- **Zarobek.** Dodatki (nocne, niedziela, święto, ponad normę okresu) liczone w `summary.ts`; stawka okresowa dla dodatku to średnia z zarobku okresu i jego godzin (M6). Premie dolicza się na końcu, więc nie zmieniają dodatków.
- **Eksport `.ics`.** Pamięta wysłane dni, żeby zmiany odwołane po stronie grafiku dostały anulowanie, a nie zostały w kalendarzu.

### Ograniczenia i pułapki

- Eksport `.ics`, karta czasu i obraz dotyczą aktywnego grafiku, tak jak widok.
- Aktywny grafik nie jest synchronizowany między urządzeniami (każde ma swój wybór).
- Kopia: przywrócenie grafiku głównego zastępuje go w całości; dodatkowe grafiki są tylko dokładane. Premie z kopii bez pola `bonuses` nie kasują premii na telefonie (M8).
- Brak testu komponentu przełącznika grafików i brak testu przepinania przez store (pokryte przez e2e, do uruchomienia później).
- Obraz miesiąca: rysowanie na canvasie nie ma testu jednostkowego (jsdom nie ma canvasa); sprawdzić na telefonie. Udostępnianie: `canvasToPng` jest synchroniczne, więc `navigator.share` jest wołane w tym samym kliknięciu.
- Telefon w poziomie: zrzut `fullPage` w Playwright powiększa okno i wyłącza wariant `short:` — sprawdzaj zwykłym zrzutem 844×390.
- Czytelność: strzałka nadgodzin i podpis pieczątki mają 11 px / 10 px (`text-2xs` jest najmniejszym tokenem; poniżej 11 px nieczytelne w słońcu).

### Testy

- `src/lib/shifts/shifts.test.ts`, `yShifts.test.ts` (mapy, migracje), `timesheet.test.ts`, `leave.test.ts`, `move.test.ts`, `searchDays.test.ts`, `eveningNudge.test.ts`.
- `src/lib/shifts/bonus.test.ts` (6): czyszczenie, wpływ na zarobek co do grosza, migracja, Yjs (zapis, usunięcie, scalanie).
- `src/lib/shifts/monthImage.test.ts` (5): początek tygodnia, skróty i kolory, dzień bez wpisu, tytuł i podsumowanie.
- `src/lib/shifts/schedules.test.ts` (9): nazwy, nazewnictwo map, izolacja grafików, rejestr (sortowanie, główny nieusuwalny, usunięcie czyści dane, limit).
- `src/lib/shifts/reviewFixes.test.ts` (3): `isScheduleId`, zaokrąglenie premii 0,004 vs 0,005, niezależność stawki okresowej.
- `src/components/shifts/TimeStepper.test.tsx`.
- E2E: `e2e/shifts.spec.ts`, `e2e/shifts-week.spec.ts`, `e2e/shifts-landscape.spec.ts`, `e2e/touch-targets.spec.ts`, `e2e/mobile-layout.spec.ts`. Z ostatnich zmian e2e nie uruchomiono.

### Lint i budżet

- `eslint.config.js`: `yShifts.ts` i jego testy, `schedules.ts` i test rejestru są na liście dozwolonych importów `yjs`.
- Próg `eagerJsGzip` (393 KB). Ostatni pomiar po przeglądzie: 392,3 KB — niewiele zapasu, moduły grafiku są leniwe.

### Commity

- `6442da5` (2026-10-15) — czytelność drobnych znaczników.
- `c8b9817` (2026-10-16) — przegląd po audycie z 2026-10-09 (część).
- `370d656` (2026-10-20) — przegląd po audycie, dotyk pędzla 44 px.
- `fcf76c1` (2026-10-20) — obraz miesiąca.
- `520e47a` (2026-10-20) — premie w rachunku.
- `cccd483` (2026-10-20) — wiele grafików.
- `b779947` (2026-10-20) — poprawki z przeglądu (H1, M4–M6, M8, L12, L13, L14, L15).
- `1380f10` (2026-10-20) — udostępnianie obrazu bez `await` (L14).

## Praca — stan aktualny (nauka, quiz, tablica, statystyki, zakładki)

Dział Praca to dziennik instalatora wod-kan połączony z nauką materiału G-HEAT. Dane w dokumencie Yjs notatek; zakładka i preferencje widoku na urządzeniu. Dziennik budowy (wpisy, raport, WhatsApp, „Tu jestem”, dyktowanie) jest w osobnej sekcji „Praca → Dziennik budowy”.

### Nazwa i wejście

- Dział nazywa się „Praca” (ikona kasku, `HardHat`) w pasku bocznym, w „Więcej”, w palecie poleceń, w nagłówku i w kopii („Praca i dziennik z budowy”). Adres `/praca`; stary `/nauka` nadal otwiera dział (`src/lib/viewRoute.ts` mapuje `praca` i `nauka` na widok `study`).
- Kod, klucze zapisu i typy zostają przy `study` — zmiana nazwy nie rusza danych. Notatki tworzone z tematów mają tytuł „Nauka: …” i etykietę `nauka` (opis treści, nie nazwa działu).
- Skrót PWA „Wpis z budowy” otwiera `/praca?wpis=1` (`public/manifest.webmanifest`).
- Zakładki: Quiz, Tablica, Lista, Dziennik. Zakładka jest zapamiętana na urządzeniu (klucz `kaczy.study.tab.v1`, `src/lib/study/tab.ts`); bez zapisu telefon zaczyna od Dziennika, komputer od Quizu. Nieznana wartość daje domyślną zakładkę.

### Nagłówek i pasek opanowania

- Nagłówek „Instalacje wod-kan” z paskiem opanowania: ile z 18 tematów jest w „Umiem”, z podziałem na moduły (Woda użytkowa, Kanalizacja, Wspólne). Każdy temat to kratka: pełna = „Umiem”, połowa = „W trakcie”, pusta = „Do nauki”. Pusta kratka ma obwódkę `border-foreground/50`, bo jasna obwódka na papierze była prawie niewidoczna.
- Kratka to przycisk (`aria-label` „Temat: stan”, `aria-pressed`); na dotyku 44 px. Dotknięcie podpisuje temat pod paskiem (`aria-live="polite"`).
- Gdy cały moduł jest w „Umiem”, przy jego nazwie pojawia się obrócona pieczątka „Umiem” (`data-mastery-stamp`). Pieczątka jest tekstem, więc czytnik czyta ją przy nazwie modułu.
- Licznik w JetBrains Mono (`font-mono tabular-nums`).
- Na Dzienniku nagłówek jest zwinięty do jednego wiersza: nazwa działu, licznik „2/18” (stuknięcie otwiera Tablicę), „Na dziś: N” i ikona statystyk (`data-study-header="compact" | "full"`). Na telefonie pełny nagłówek zajmował ok. 200 px nad listą wpisów.

### Tablica tematów i lista

- Temat wędruje „Do nauki” → „W trakcie” → „Umiem” strzałkami przy tytule (`moveTopic`, `TopicCard`, `StudyBoard`). Pod opisem trzy przyciski: „Wpis” (arkusz wpisu z tym tematem), „Ćwicz” (runda quizu z tematu), „Do notatki” (notatka z listą kontrolną tematu). Etykiety dostępności mają postać „Temat: wpis z budowy”, podpis jest w nazwie dostępnej (WCAG 2.5.3). Przesunięcie animuje `framer-motion` (`layoutId`).
- Na telefonie tablica pokazuje jedną kolumnę naraz, z przełącznikiem „Do nauki / W trakcie / Umiem” (`ToggleGroup`, `md:hidden`). Przeniesienie tematu pokazuje dymek, dokąd poszedł (tylko na telefonie). Wybrana kolumna nie jest zapamiętywana.
- Lista: „Wyczyść odhaczenia” działa bez pytania, z „Cofnij” w dymku (`resetChecklist` zwraca wyczyszczone id, `restoreChecklist`). „Cofnij” nie przywraca punktów odhaczonych w międzyczasie na drugim telefonie.
- Problem z budowy przypisany do tematu wraca do nauki: w dzienniku otwarty problem ma „Ćwicz teraz”; karta tematu pokazuje ostatni problem (otwarty wyróżniony, rozwiązany przygaszony) i licznik „2 na dziś”. Liczone przy renderze z dziennika i powtórek, bez nowych danych w Yjs (`TopicPractice.lastProblem` w `practiceByTopic`).

### Quiz i powtórki („Na dziś”)

- Po odpowiedzi pytanie wraca do powtórki: po dobrej coraz rzadziej (1 dzień, 3 dni, dalej dłużej), po błędzie następnego dnia. Pod paskiem „Na dziś: N powtórek” z każdej zakładki; w Quizie ramka z „Powtórz”. Runda powtórek bierze najbardziej zaległe pytania (do 10). Gdy nic nie ma na dziś, Quiz podaje, kiedy następne.
- SM-2 „lite” z oceną automatyczną: dobra odpowiedź = q 4, zła = q 1 (od nowa, łatwość −0,2, min. 1,3). Bez pytania o samoocenę. Odstęp maks. 180 dni.
- Dni jako klucze lokalnego dnia („2026-10-15”), nie milisekundy. Druga dobra odpowiedź tego samego dnia nie wydłuża odstępu; błąd zawsze się liczy (`lapses`).
- Karty w mapie Yjs `studyReview` (klucz = id pytania): dwa telefony odpowiadające na różne pytania scalają się bez strat. `recordRound` aktualizuje karty w tej samej transakcji co runda.
- „Powtórka błędów” (`studyMissed`) zostaje osobno: lista ostatnich błędów, nie harmonogram.
- Pytania, na które nigdy nie odpowiedziano, nie są „na dziś”. Karty pytań usuniętych z materiału są pomijane.
- Statystyki: liczniki `seen`/`right` w karcie. Karty sprzed N4 nie mają liczników — `cleanCard` szacuje je z pomyłek i dobrych odpowiedzi z rzędu.

### Statystyki i karta doświadczenia

- Okno „Statystyki”: trafność ogółem (z liczbą odpowiedzi), dni nauki w 30 dniach, seria, wpisy z budowy, otwarte problemy; trafność per temat (słupki od najsłabszego); najtrudniejsze pytania (do 5); siatka dni nauki z 12 tygodni; wpisy z budowy per miesiąc (6 miesięcy) i per budowa (do 6, reszta „Pozostałe”).
- Trafność liczona z kart powtórek, nie z rund. Dni nauki to dni z rundą quizu. Wykresy jednoseryjne, bez biblioteki (recharts dodałby ok. 100 KB do paczki).
- Karta doświadczenia na dole statystyk: budowy z wpisami, liczba prób szczelności, opanowane tematy, trafność. „Kopiuj” i „Pobierz .md” (`karta-doswiadczenia-RRRR-MM-DD.md`). Liczenie w czystej funkcji (`experience.ts`: `buildExperience`, `experienceText`). Plik nazywa się po dniu lokalnym — pobranie tego samego dnia nadpisze poprzedni.

### Kolory, dotyk, ściąga, kalkulatory

- Zielony „OK” i znaki punktów krytycznych biorą kolor z motywu (`success-ink`, `warning-ink`: `color-mix` z czernią, wg `--ink-mix`). Punkty krytyczne mają jedną ikonę `TriangleAlert`.
- Quiz na telefonie: odpowiedzi co najmniej 56 px wysokości, „Dalej” przyklejone nad dolnym paskiem (`data-sticky-action`, `phone:sticky` jako bezpośrednie dziecko sekcji). Plakietka „Zapisano” (`save-status`) przesuwa się wyżej, gdy akcja jest przyklejona (`html:has([data-sticky-action])`).
- Ściąga „Wysokości podejść” (standard G-HEAT, `HeightsSheet`, `HeightsButton`) z nagłówka działu i z arkusza wpisu, gdy temat to „Punkty wodne i wysokości”.
- Kalkulatory (`CalculatorsSheet`, `src/lib/study/calc.ts`):
  - **Spadek kanalizacji:** z długości i spadku — różnica wysokości (szybkie 2 / 2,5 / 3%), albo z długości i różnicy — spadek w %. Poza typowym zakresem podpowiedź „sprawdź wymagany spadek dla tej średnicy”.
  - **Próba wodna:** z ciśnienia roboczego — ciśnienie próbne (1,5 × robocze) i najmniejszy zakres manometru (+50%), z przypomnieniem o podziałce 0,1 bar.
  - **Pojemność instalacji:** kilka odcinków rur (16×2, 20×2, 25×2,5, 32×3, inna średnica wewnętrzna) i suma litrów.
  - Liczby normowe tylko z materiału G-HEAT (`content.ts`); reszta to geometria. Wartości nie zapisują się.
  - Brak doboru średnic — materiał każe brać je z projektu.

### Zdjęcia, protokół, kształtki (wpis z budowy)

- **Zdjęcia „przed zakryciem”:** wpis mieści 5 zdjęć (`JOURNAL_MAX_IMAGES`). Przy miniaturze „Podpis na zdjęciu”: tekst (do 80 znaków) i data wpisu są wtopione w dolny pasek zdjęcia (`photoCaption.ts`: `captionLayout`, `captionText`, `captionPhoto` — canvas → JPEG 0,85). Podpis w pikselach, więc zdjęcie wysłane dalej niesie opis. Data to moment wpisu, nie chwila podpisania. W dzienniku galeria ze strzałkami i licznikiem „2/5”, ←/→. Podpisu nie da się zdjąć — usuń i dodaj ponownie.
- **Protokół próby szczelności:** pole wpisu (nie nowy rodzaj) przy tematach „Płukanie i próba szczelności” i „Próba kanalizacji na zalanie”. Czym próba (Powietrze / Woda / Zalanie), ciśnienie [bar], czas [min], spadek na manometrze [bar], wynik (Szczelna / Nieszczelna). Start: powietrze 6 bar; dla kanalizacji zalanie bez ciśnienia. Linia „Próba szczelności (woda, 9 bar, 30 min, spadek 0,1 bar): szczelna” w wpisie, raporcie i wiadomości do szefa. Sam protokół wystarcza do zapisu wpisu. Starsza wersja pomija pole, a edytując wpis, zgubi je (`cleanEntry` odrzuca nieznane rodzaje, nieznane pole tylko pomija).
- **Kształtki:** „Dodaj kształtki” — pozycje „nazwa + sztuki” (tylko sztuki), podpowiedzi nazw z poprzednich wpisów, pigułki najczęstszych. Ta sama nazwa w różnej pisowni sumuje się (`fittingKey`). Do 20 pozycji, nazwa do 40 znaków, bez metrów rury. Raport ma linię przy wpisie i sekcję „Kształtki (suma)” z okresu.

### Własne pytania i punkty listy (N5)

- Własne pytanie do quizu (poprawna odpowiedź i trzy błędne, plus wyjaśnienie) i własny punkt listy, przypięty do tematu. Liczą się jak materiał: pula quizu, powtórki, statystyki, postęp tematu, arkusz wpisu. Oznaczone „własny”.
- Materiał G-HEAT zostaje statyczny w `content.ts`; własne wpisy są w mapie Yjs `studyCustom` (klucz = id, `c-…`), synchronizują się i jadą w kopii. Limit 200 łącznie, tekst 300, odpowiedź 200, wyjaśnienie 500.
- Walidacja tematu w `store.ts`, nie w `custom.ts`: `yStudy.ts` nie może importować materiału. Wpis z obcym tematem od peera jest pomijany.
- Usunięcie czyści `review`, `missed` i `checked` dla tego id (z „Cofnij”).
- Komponenty czytające materiał biorą listy z `useStudyLists()`, nie z `CHECKLIST`/`QUESTIONS`.
- Okno „Moje pytania” (`CustomQuestionsDialog`), sekcja „Własne punkty” (`CustomChecklistForm`).
- Import plików (PDF, tekst) do Nauki — poza zakresem.

### Gdzie jest (ten fragment)

- Nagłówek i zakładki: `src/components/study/StudyView.tsx` (`MasteryStrip`, `DueTodayChip`, przyciski Statystyki, Kalkulatory, Wysokości), `src/lib/study/tab.ts`.
- Tablica i lista: `src/components/study/StudyBoard.tsx` (`TopicCard`, `StudyBoard`, `ToggleGroup` kolumny), `src/components/study/StudyChecklist.tsx`, `src/lib/study/store.ts` (`moveTopic`, `practiceByTopic`, `resetChecklist`, `restoreChecklist`), `src/lib/study/content.ts` (`MODULES`, `TOPICS`, `CHECKLIST`, `QUESTIONS`), `src/lib/study/toNote.ts`.
- Quiz i powtórki: `src/components/study/QuizPanel.tsx`, `src/lib/study/srs.ts` (`ReviewCard`, `reviewCard`, `dueIds`, `cleanCard`), `src/lib/study/yStudy.ts` (`studyReview`, `recordRound`).
- Statystyki: `src/components/study/StudyStats.tsx`, `src/lib/study/stats.ts`, `src/lib/study/experience.ts`.
- Dziennik — elementy: `src/components/study/JournalEntrySheet.tsx`, `StudyJournal.tsx`, `src/components/study/PressureTestFields.tsx`, `src/components/study/FittingsFields.tsx`, `src/components/study/HeightsSheet.tsx`, `src/components/study/CustomChecklistForm.tsx`, `src/components/study/CustomQuestionsDialog.tsx`.
- Biblioteki: `src/lib/study/photoCaption.ts`, `src/lib/study/pressureTest.ts`, `src/lib/study/fittings.ts`, `src/lib/study/custom.ts`, `src/lib/study/customActions.ts`, `src/lib/study/calc.ts`.
- Raport (podpis i protokół): `src/components/study/JournalReport.tsx`.

### Jak działa i dlaczego (ten fragment)

- **Dane w Yjs, ustawienia na urządzeniu.** Wszystkie wpisy, karty powtórek, własne pytania i punkty są w dokumencie notatek (synchronizacja i kopia). Zakładka i preferencje widoku są lokalne: telefon i komputer służą do czego innego.
- **Jeden klucz na pozycję** (wpis, kartę, własne pytanie, pozycję listy): dwa telefony dopisujące różne rzeczy scalają się bez strat. To samo pole — ostatni zapis wygrywa.
- **Pola zamiast nowych rodzajów** (protokół, kształtki): starsza wersja pomija nieznane pole, zamiast odrzucać wpis.
- **Podpis w pikselach**: zdjęcie wysłane szefowi lub inwestorowi niesie opis i datę. To dowód „było zrobione przed zakryciem”.
- **Trafność z kart**, nie z rund: karta zna każde pytanie z osobna, więc da się ją zsumować per temat.
- **Materiał statyczny, własne wpisy w Yjs**: materiał G-HEAT nie zmienia się; własne wpisy mają id z prefiksem `c-`, żeby nie kolidowały.

### Ograniczenia i pułapki (ten fragment)

- Starsza wersja aplikacji nie pokaże protokołu, kształtek ani własnych pytań; edytując wpis, zgubi pola. Własne wpisy są dla niej niewidoczne, ale nic nie psują.
- Pytania i punkty własne muszą mieć cztery różne odpowiedzi (lub unikalną treść punktu); duplikaty odrzuca `cleanCustom`.
- Pieczątka „Umiem” pojawia się tylko przy pełnym module.
- Trafność obejmuje odpowiedzi od wdrożenia powtórek; starsze rundy znały tylko wynik całej rundy.
- Testy e2e z 390 px muszą ustawić rozmiar okna przed wejściem na `/praca`, inaczej startuje Quiz.
- Objaśnienie odpowiedzi w quizie może schodzić pod przyklejony pasek — „Dalej” jest zawsze pod kciukiem.

### Testy (ten fragment)

- Jednostkowe: `src/lib/study/srs.test.ts`, `stats.test.ts`, `experience.test.ts`, `tab.test.ts`, `photoCaption.test.ts`, `pressureTest.test.ts`, `fittings.test.ts`, `custom.test.ts`, `customStore.test.ts`, `calc.test.ts` (6), `study.test.ts`, `yStudy.test.ts` (własne wpisy w Yjs, powtórki, kopia, `mergeIn` nie cofa nowszej karty).
- E2E: `study.spec.ts` (tablica, „Ćwicz”, „Do notatki”, zakładki, powtórki z przestawionym zegarem, statystyki, karta doświadczenia, quiz pod kciuk, raport przez „Więcej”), `journal-photos.spec.ts`, `journal-pressure-test.spec.ts`, `journal-fittings.spec.ts`, `study-custom.spec.ts`, `calculators.spec.ts` (regresja `study.spec.ts` 29/29), `resilience.spec.ts`, `a11y.spec.ts`, `skins.spec.ts`, `touch-targets.spec.ts`.

### Commity (ten fragment)

- `b610ff6` (2026-10-15) — nazwa „Praca”.
- `7f780d9` (2026-10-16) — pasek opanowania. `4c951fa` (2026-10-15) — karty tematów (N1).
- `78a4538` (2026-10-15) — zapamiętana zakładka. `82b7366` (2026-10-15) — powtórki „Na dziś”.
- `95f9c65` (2026-10-15) — problemy z budowy a nauka. `b87ef5b` (2026-10-15) — tablica i lista na telefonie.
- `94e16fc` (2026-10-15) — statystyki. `16cc7e5` (2026-10-16) — karta doświadczenia.
- `b61aba1` (2026-10-15) — kolory z motywu (P1). `5dc3359` (2026-10-15) — zwinięty nagłówek (P2).
- `8abb8f4` (2026-10-15) — quiz pod kciuk (P3). `bd14a71` (2026-10-15) — zdjęcia przed zakryciem (P4).
- `dcb1d66` (2026-10-15) — protokół szczelności (P5a). `e9355ca` (2026-10-15) — raport (P5b).
- `feb318e` (2026-10-15) — kształtki. `8725703` (2026-10-16) — własne pytania i punkty (N5).
- `7740d29` (2026-10-16) — kalkulatory (`c2c112b` — skrócenie opisu rury).

## Skrzynka — stan aktualny (szybkie przechwycenie, prywatność)

Dział opisany w jednym miejscu. Skrzynka to widok „do posortowania”: notatki bez folderu i bez etykiet.

### Co robi

- **Widok „Skrzynka”** w pasku bocznym, w palecie poleceń i w menu „Więcej” na telefonie. Licznik = liczba notatek do posortowania (na telefonie też na kafelku w „Więcej”).
- **Szybkie przechwycenie.** Na górze widoku pole: Enter zapisuje tekst od razu, bez tytułu, folderu i etykiet. Pierwsza linia staje się tytułem (do 120 znaków), reszta treścią. Dymek „Zapisano w skrzynce” ma „Cofnij”. Pusty tekst nic nie robi. Pole czyści się po zapisie.
- **Co jest w skrzynce:** aktywne notatki bez folderu, bez etykiet i nie będące podnotatkami. Przeniesienie do folderu albo nadanie etykiety usuwa notatkę ze skrzynki.
- **Prywatność.** Notatka prywatna (zablokowana) nigdy nie trafia do skrzynki: ani na liście, ani w liczniku. Wcześniej prywatna notatka bez folderu i etykiet była liczona i pokazywana jako pusta karta.

### Gdzie jest

- `src/lib/inbox.ts` — `isInboxNote` (reguła; warunek `!n.locked`), `captureParts` (tekst → tytuł i treść), `INBOX_TITLE_MAX`.
- `src/components/InboxCapture.tsx` — pole na górze widoku.
- `src/hooks/useFilteredNotes.ts` — typ `View` z `"inbox"`, filtr w `filterNotes`.
- `src/lib/viewRoute.ts` — adres `/skrzynka`.
- `src/components/EmptyState.tsx` — nagłówek i opis pustej skrzynki.
- `src/components/sidebar/sidebarItems.ts` — pozycja „Skrzynka” z licznikiem.
- `src/components/BottomNav.tsx` — prop `inboxCount`, kafelek „Skrzynka” w arkuszu „Więcej”, `inbox` w `isMoreActive`.
- `src/components/CommandPalette.tsx` — wpis w palecie poleceń.
- `src/pages/Index.tsx` — `inboxCount` (z notatek aktywnych), handler `captureToInbox`, render `InboxCapture`, przekazanie licznika do `BottomNav`.

### Jak działa i dlaczego

- **Bez nowego pola w danych.** Skrzynka to reguła nad istniejącymi notatkami. Nie trzeba migracji; synchronizacja i kopia działają bez zmian, a sortowanie od razu opróżnia skrzynkę.
- **Zapis przez ten sam kanał co kompozytor.** Idzie przez `handleAddNoteGlow`, więc widok `inbox` nie dokłada folderu ani etykiety (`activeLabel` jest pusty poza widokiem etykiety).
- **Prywatność przez regułę.** Zablokowana notatka odpada w `isInboxNote`, więc nie pojawia się ani na liście, ani w liczniku.

### Ograniczenia i pułapki

- Notatki w koszu i archiwum nie są w skrzynce (reguła działa na notatkach aktywnych).
- Starsze notatki bez folderu i etykiet też trafiają do skrzynki. To zamierzone: to „do posortowania”.
- Pasek „Zapisz notatkę…” nie pojawia się w skrzynce. Nowe notatki z szablonami robi się w widoku Notatek.
- Kafelek w arkuszu „Więcej” nie ma testu komponentu (brak testu `BottomNav`); sprawdza go e2e przy przeglądzie telefonu.

### Testy

- `src/lib/inbox.test.ts` (9) — reguła skrzynki, podział tekstu, prywatność (zablokowana notatka poza skrzynką).
- `src/components/InboxCapture.test.tsx` — Enter, pusty tekst.
- `e2e/inbox-today.spec.ts` — zapis, licznik w pasku, „Cofnij”, pusta skrzynka.

### Commity

- `c8b9817` (2026-10-16) — szybkie przechwycenie do posortowania.
- `ba47169` (2026-10-20) — prywatność i dostęp z telefonu (`bcbe1be` — hash w `opis.md`).

## Dziś — karta zmiany, zaległe i terminy, powtórki (punkt 3 planu)

**Co robi.** Na górze widoku „Dziś” są cztery elementy, w tej kolejności:
1. Karta z datą i dzisiejszą zmianą z Grafiku (nazwa, godziny) albo informacją, że dziś nie ma zmiany. Przyciski:
   „Grafik” otwiera Grafik, „Notatka dnia” otwiera dzisiejszą notatkę dnia.
2. Sekcja „Przypomnienia”: zaległe i dzisiejsze terminy (po cztery z każdej grupy, z licznikiem reszty).
   Kliknięcie otwiera notatkę, „Wszystkie” przechodzi do widoku Przypomnień.
3. „Powtórki na dziś: N pytań” z działu Praca — tylko gdy są pytania do powtórki. „Powtórz” otwiera quiz od razu
   w trybie „Na dziś” (`/praca?powtorka=1`).
4. Przegląd tygodnia (jak dotąd).
Wszystko znika przy aktywnym wyszukiwaniu.

**Gdzie jest.**
- `src/components/review/TodayShiftCard.tsx`: `TodayShiftCard({ onOpenShifts, onDailyNote })`. Czyta
  `useShifts()` i `useShiftsReady()` z `lib/shifts`, dzień liczy przez `localDayKey()`.
- `src/components/review/TodayDueList.tsx`: `TodayDueList({ notes, onOpen, onOpenReminders })`. Grupowanie przez
  `groupReminders` z `lib/reminderAgenda.ts` (ta sama logika co widok Przypomnień), tylko grupy „Zaległe” i „Dziś”.
  Subskrybuje `useDayClock()` (`lib/dayClock.ts`), więc po północy i po powrocie na kartę lista przelicza się sama.
  Czas przy notatce przez `formatReminderShort` z `lib/reminderTime.ts`.
- `src/components/review/TodayStudyCard.tsx`: `TodayStudyCard({ onPractice })` (dane) i `TodayStudyCardView`
  (sam widok). Liczy `dueToday(useStudy())` z `lib/study/store.ts` — ta sama projekcja i funkcja co „Na dziś: N” w Pracy,
  więc liczba nie zawyża kart pytań, których nie ma już w materiale (L2). Karta ładuje `store.ts` (materiał), ale jest
  lazy i nie wchodzi w paczkę startową;
  `STUDY_DUE_PARAM` (`powtorka`) — obsługa w `StudyView.tsx` (zakładka quiz, zakres „due”, parametr zdjęty z adresu).
- `src/pages/Index.tsx`: lazy importy `TodayShiftCard`, `TodayDueList` i `TodayStudyCard`, renderowanie w widoku `today` przed
  `WeeklyReviewCard`. `onOpenShifts` → `go("shifts")`, `onDailyNote` → `openDailyNote`, `onOpen` → `openNote`,
  `onOpenReminders` → `go("reminders")`. Każda karta ma własny `ViewErrorBoundary` (nazwy: Grafik, Przypomnienia,
  Praca, Powtórki, Przegląd tygodnia), więc błąd jednej nie kładzie reszty widoku. `reminderRowCount` dla widoku `today`
  to `countDueToday(reminderNotes)` z `lib/reminderAgenda.ts`; pusty stan („Brak notatek z dzisiaj”) nie pokazuje się,
  gdy są zaległe lub dzisiejsze przypomnienia.

**Jak działa i dlaczego.**
- Dane tylko do odczytu: zmianę dodaje się i zmienia w Grafiku, nie tutaj (jeden punkt prawdy).
- Karta jest leniwa (jak przegląd tygodnia), więc nie dokłada nic do pierwszego ekranu.
- Karta powtórek czyta stan z warstwy danych, nie z `study/store.ts`: ten importuje cały materiał do nauki, który
  nie jest potrzebny do policzenia pytań na dziś. Bez pytań na dziś karty nie ma (nie zajmuje miejsca).
- Gdy Grafik jeszcze się nie wczytał, karta pokazuje „Grafik się wczytuje…”, zamiast udawać brak zmiany.
- Rodzaj zmiany usunięty z Grafiku daje „Zaplanowana zmiana (rodzaj usunięty).” — zapis nie znika bez śladu.
- Jedna definicja zaległości: `termStatus` z `lib/dueTerms.ts` (lista Dziś, licznik w pasku, przegląd tygodnia).
  Jedna definicja „dotknięte w zakresie” (utworzone albo edytowane): `inRange` z `lib/dateRanges.ts`, używana przez
  filtr widoków Dziś i Tydzień oraz przez oba nudge'y (dzień, tydzień).
- Przegląd „po kolei” (`ReviewWalkthrough.tsx`): kosz (przycisk „Do kosza” i skrót D) pyta o potwierdzenie przez
  `useConfirmAction` z `ConfirmActionDialog.tsx`, z „Nie pytaj ponownie” jak w reszcie aplikacji. Archiwizacja (A
  i „Archiwizuj”) też pyta o potwierdzenie (`kind: "archive"`, wspólne „Nie pytaj ponownie”); po potwierdzeniu
  „Cofnij” w toście. „Zostaw” (K) nic nie zmienia i nie pyta. Skróty są ignorowane, gdy otwarte jest okno potwierdzenia
  (`[role="alertdialog"]`). Test: `src/components/review/ReviewWalkthrough.test.tsx` (4).
- Dotyk: przyciski przeglądu tygodnia, „Przejrzyj po kolei”, przyciski trybu „po kolei” i link „i jeszcze N”
  mają `coarse:` do 44 px. Nazwa sekcji przypomnień to „Przypomnienia”, jak nagłówek.

**Ograniczenia.** Sekcja terminów pokazuje tylko zaległe i dzisiejsze; przyszłe terminy są w Przypomnieniach.
Notatki w koszu są pomijane. Przypomnienia z archiwum są pokazywane — ich terminy nadal dzwonią (decyzja właściciela,
2026-10-20). Przegląd tygodnia wyklucza archiwum, więc ta jedna różnica jest świadoma.

**Testy.** `src/components/review/TodayDueList.test.tsx` (grupy, limit 4, archiwum i kosz pominięte, kliknięcie,
przejście z „dziś” do zaległych po zmianie doby — `focus` i przesunięty zegar),
`src/lib/reminderAgenda.test.ts` (`countDueToday`: zaległe i dzisiejsze, bez przyszłych i kosza, archiwum liczy się),
`src/lib/weeklyReview.test.ts` (przeterminowane przypomnienia — ta sama definicja co lista Dziś),
`src/components/review/TodayShiftCard.test.tsx` (brak zmiany, godziny, usunięty rodzaj, Grafik niegotowy, przyciski;
`useShifts` zmockowany), `src/components/review/TodayStudyCard.test.tsx` (bez powtórek — nic; liczba z odmianą,
„Powtórz”), `e2e/inbox-today.spec.ts` (karta zmiany i przypomnienia na pustym koncie, przycisk „Grafik”),
`e2e/today-study.spec.ts` (runda quizu, następnego dnia karta „10”, „Powtórz” → quiz „Na dziś”).

**Commit.** `32f51b7`, `25ed6cb`, `ddf6765` (powtórki) (2026-10-16). Poprawki Fazy 1 (odświeżanie po zmianie doby,
granice błędów, pusty stan), 2026-10-20: `f720739` (Faza 1), `687756d` (Fazy 2–3, dotyk i jedna definicja zaległości), `585d4a5` (potwierdzenie kosza w przeglądzie), `5168b98` (potwierdzenie archiwizacji).

## Wydajność — paczka startowa i precache (2026-10-16)

**Co robi.** Dla użytkownika: szybszy pierwszy start (mniej kodu do pobrania i uruchomienia) i mniej danych przy
instalacji / aktualizacji offline. Funkcje działają tak samo; płótno, „Znajdź i zamień” i okno własnego szablonu
doczytują się przy pierwszym otwarciu (ułamek sekundy).

**Gdzie jest.**
- Czytnik notatek (`NoteReader`) leniwie w `Index.tsx` (`Suspense key="reader"` jako bezpośrednie dziecko
  `AnimatePresence` — animacja zamknięcia działa) i doczytywany w czasie bezczynności po starcie
  (`requestIdleCallback`, bez niego po 1,5 s), żeby pierwsze otwarcie notatki nie czekało (`a7bfb5a`).
- Leniwe ładowanie (`lazy` + `Suspense`): `DrawingCanvas` w `NoteCard.tsx` i `AddNoteBar.tsx` (montowany dopiero po
  pierwszym „Rysuj” — `useLatch`), `FindReplaceBar` w `NoteEditor.tsx`, `CustomTemplateDialog` w `QuickTemplates.tsx`.
- `src/lib/study/journalRefs.ts`: `journalRefsIn` (klucze zdjęć dziennika) w osobnym module bez importu `yjs`;
  `yjsStore.ts` i `study/images.ts` korzystają z niego, `yStudy.ts` go re-eksportuje.
- `src/lib/exportNotes.ts`: dane działu Praca (`study/data`, `study/yStudy`) importowane dynamicznie w
  `buildFullBackupWithReport` i przy przywracaniu kopii.
- `vite.config.ts`: bez `includeAssets` — ikony i `offline.html` z `public/` łapie `globPatterns`, a oba naraz dublowały
  6 plików w liście precache `sw.js`.
- `vite.config.ts` → `workbox.globIgnores`: `exportPdf`, `index.es` (jsPDF), `html2canvas.esm`, `purify.es`, `StatsDialog` są poza
  precache. Trafiają do cache `static-assets` (CacheFirst na `/assets/*.js`) dopiero przy pierwszym użyciu.

**Wynik.** Paczka startowa (gzip) 390 → 383 KB, potem (osobne pozycje list budowy, `395c311`) 384,0 KB, a po leniwym
czytniku 378,7 KB — zapas 5,3 KB do progu 384. Precache 4,37 → 4,03 MB (próg 4,3), 90 → 84 pliki.

**Stan 2026-10-17:** precache 4,09 → **3,00 MB, 88 plików** (próg 3,1 MB w `e2e/bundle.spec.ts`). Cel z roadmapy
1,5 MB nieosiągnięty — wymagałby Nauki (`StudyView`), Grafiku (`ShiftsView`) i Markdownu poza precache, a to psuje
offline-first tych działów. Wirtualizacja listy: nie robimy (`content-visibility` + render progresywny wystarczają).

**Ograniczenia i pułapki.**
- `study/data.ts` (z `yStudy.ts`) zostaje w paczce startowej celowo: odśmiecanie zdjęć (`useNotes`) potrzebuje od startu
  wiedzy, czy stary dziennik przeniesiono do dokumentu (`legacyStudyMerged`) — inaczej mogłoby usunąć jego zdjęcia.
- Zapas do progu paczki startowej ~5 KB (po `a7bfb5a`) — nowe moduły w głównej paczce zjadają go szybko.
- Duplikaty w precache nie dublowały pobierania (ta sama rewizja), ale zawyżały test budżetu.
- PDF i Statystyki działają offline dopiero po pierwszym użyciu w sieci (świadomy kompromis, 2026-10-17).

**Testy.** `e2e/bundle.spec.ts` (oba progi zielone, pomiar w komentarzu), `e2e/pwa.spec.ts`, rysowanie w notatce
(`card-images.spec.ts`), nowy test „Znajdź i zamień” (`editor-keys.spec.ts`), własny szablon (`templates-bulk.spec.ts`),
kopia zapasowa (`images.spec.ts`, `search-backup.spec.ts`, `private-notes.spec.ts`), `study.spec.ts`, `composer.spec.ts`
— 66/66 + 1/1; Vitest 1291/1291.

**Commit.** `3d31b58`, `a7bfb5a` (czytnik, 2026-10-16). Testy czytnika po zmianie: `reader`, `reader-step`,
`note-links`, `note-props-view`, `routes`, `subpages`, `wiki-heading`, `wikilinks`, `attachments`, `board-table`,
`reminders-calendar`, `toggle-group`, `search-highlight`, `bundle` — 56/56; telefon (`mobile`, `mobile-layout`) 17/17.

## Praca → Dziennik budowy — stan aktualny (wpisy, problemy, karty budów, raporty, przypomnienia)

Dziennik instalatora wod-kan: co zrobione, jakie problemy, zdjęcia, na której budowie, połączone z tematami materiału do nauki (zakładka Dziennik w `/praca`, `src/components/study/StudyJournal.tsx`). Opis obejmuje wszystkie etapy od 2026-10-15 do 2026-10-20.

### Dane i synchronizacja

- **Gdzie.** `src/lib/study/yStudy.ts` (`createYStudy(doc)`, `JournalEntry`, `StudyState`, `StudyDump`, `cleanEntryParts`, `cleanEntry`, `cleanDump`, `dumpFromLegacy`, `stateFromDump`, `journalRefsIn`); `src/lib/study/data.ts` (jedyna instancja na `yjsStore.doc`, `studyDevice()`, `useStudyReady`); `src/lib/study/store.ts` (fasada dla widoków: `useStudy`, `sanitizeStudy`, akcje wpisów, budów i list); `src/lib/study/keys.ts` (klucze localStorage).
- **Mapy Yjs** w dokumencie notatek: `studyJournal` (id → wpis), `studySites` (id → karta budowy), `studyBoard`, `studyChecked`, `studyMissed`, `studyDays`, `studyRounds` (per urządzenie), `studyMeta` (`site` — bieżąca budowa arkusza; `boss`, `waGroup`), `studyMigrations`, `studySiteItems` (pozycje list karty budowy).
- **Wpis jako mapa pól (D5, 2026-10-20).** Wpis to `Y.Map` z kluczem na każde pole. Edycja różnych pól tego samego wpisu na dwóch telefonach scala się; to samo pole — ostatni zapis wygrywa. `writeEntry` zapisuje tylko zmienione pola i usuwa te, których już nie ma; `readEntry` i `journalFields` (`src/lib/study/journalFields.ts`) czytają obie postacie. Stare wpisy (zwykły obiekt) są czytane bez zmian i zamieniane na mapę przy pierwszej edycji. `dump()` i kopia zawierają wpis jako zwykły obiekt, więc format kopii się nie zmienił. Commit `4167846`.
- **Zgodność.** Starsze wersje aplikacji nie czytają wpisów zapisanych jako mapa pól (`cleanEntry` odrzuca `Y.Map`). Dopóki wszystkie urządzenia nie mają tej wersji, nowe lub edytowane wpisy są na nich niewidoczne.
- **Listy karty budowy** (etapy, braki, zamówienia, godziny, dokumenty, zgłoszenia serwisowe) są w osobnych kluczach `budowa␁rodzaj␁id` (`siteItems.ts`, bez importu `yjs`). Zapis porównuje bazę (`base`, lista z ekranu) z nową listą: usuwa tylko pozycje z bazy i zapisuje zmienione, więc pozycje dopisane na drugim telefonie zostają. Znacznik `budowa␁meta␁rodzaj` odróżnia pustą listę od „jeszcze niezapisanej”. Pozycje, których nie da się oczyścić (`clean*`), są pomijane. Commit `395c311` (wprowadzenie kluczy), `304bbe8` (porządek i odporność).
- **Migracja.** Dawny zapis `kaczy.study.v1` z localStorage przenoszony raz na urządzenie (`mergeIn` + znacznik w `studyMigrations`, w tej samej transakcji). Stary klucz zostaje jako kopia. Zdjęcia ze starego zapisu są widoczne dla odśmiecania.
- **Kopia zapasowa.** Sekcja `study` (`StudyDump`, z kartami budów i listami) oraz Nauka w dawnym kształcie w `settings` dla starszych wersji. Przy przywracaniu osobny przełącznik „Nauka i dziennik z budowy”; `replaceAll` zastępuje dane, `mergeIn` scala. Wpisy odrzucone przy czyszczeniu są liczone i pokazywane w oknie przywracania (`studyDropped`).
- **Granice.** `yStudy.ts` nie importuje materiału (`content.ts`), bo jest w głównej paczce. Przynależność do materiału sprawdza `store.ts`. Wpis: `id`, `at` (ms), `kind` (`ok` | `problem` | `note`), `topic`, `text`, `site` (kopia nazwy), `siteId?`, `checked`, `images`, `recordings?`, `resolved?`, `solution?`, `test?`, `fittings?`, `stage?`, `geo?`. Tekst do 2000 znaków, do 5 zdjęć (`JOURNAL_MAX_IMAGES`), do 3 nagrań, nazwa budowy do 120 znaków.

### Wpis i arkusz

- **Arkusz wpisu** (`JournalEntrySheet.tsx`, od dołu na telefonie): rodzaj (trzy duże przyciski), budowa, kiedy, tekst, zdjęcia, nagrania, temat z listą kontrolną, pola protokołu i kształtek. Ten sam arkusz tworzy i poprawia wpis (z „Cofnij” przy usunięciu). Stan w `entrySheet.ts`, szkic nowego wpisu w `draft.ts` (localStorage `kaczy.study.draft.v1`; przeżywa zmianę zakładki i odświeżenie). Edycja ma osobny formularz w pamięci — poprawka starego wpisu nie rusza szkicu.
- **Wejścia:** „+ Wpis” w nagłówku dziennika, „+” w dolnym pasku, skrót PWA „Wpis z budowy” (`/praca?wpis=1`), „Wpis z budowy” z karty tematu, skrót „Wpis głosowy” (`/praca?wpis=1&glos=1`, `requestVoiceOnOpen` — dyktowanie startuje od razu; bez zgody zapisanej na urządzeniu pokazuje się pytanie o zgodę).
- **Budowa.** Pigułki: przy pustej budowie 3 ostatnie, przy wpisywaniu do 6 pasujących (`suggestSites`, bez polskich znaków). Archiwalne się nie podpowiadają. Pigułka nie zabiera fokusu z pola. Nazwa budowy musi być unikalna (bez ogonków i wielkości liter).
- **Data.** Pigułka „Kiedy” (`datetime-local`, „Teraz”): wpis „za wczoraj” jest możliwy; przyszłość przycinana do chwili zapisu.
- **Podpowiedzi tekstu.** Pusty nowy wpis na budowie pokazuje pigułki „Jak wczoraj” (tekst najnowszego wpisu tej budowy z poprzedniego dnia kalendarzowego) i do 3 ostatnich różnych tekstów. Znikają, gdy pole ma treść. „Jak wczoraj” kopiuje tylko tekst, nie rodzaj ani temat.
- **Pusty wpis** (bez tekstu, punktów, zdjęć, nagrań, protokołu i kształtek) się nie zapisuje. Wpis z samym etapem, próbą albo kształtkami jest poprawny.
- **Zdjęcia.** `prepareImage` → `imageStore`; w trakcie obróbki kafelek z kółkiem i zablokowany zapis. Limit liczony z góry. Podpis wtopiony w piksele (dolny pasek, data = moment wpisu, `photoCaption.ts`). Galeria w dzienniku ze strzałkami i ←/→. Podpisu nie da się zdjąć — usuń i dodaj ponownie. Rysowanie po zdjęciu (`DrawingCanvas`, warstwa kresek nad tłem, zapis podmienia zdjęcie, do 1600 px, JPEG 0,9); rysunek się wtapia i nie da się go potem edytować osobno.
- **Nagrania głosowe** (U8): przycisk „Nagraj”, do 3 min, do 3 nagrań, osobny załącznik audio (`recordings`), nie zdjęcie. Przeglądarka nagrywa w `audio/webm`, `audio/ogg` lub `audio/mp4`. Nagranie nie jest transkrybowane i nie trafia do raportu. Nagrywanie nie jest testowane e2e (brak fake mikrofonu).
- **Dyktowanie** (`useDictation`, Web Speech `pl-PL`, zgoda przy pierwszym użyciu). Dopisuje zdanie na końcu tekstu. Cały wpis jedną wypowiedzią (`parseSpokenEntry`, `spokenEntry.ts`): budowa tylko na początku (pełna nazwa albo jednoznaczne pierwsze słowo przed przecinkiem lub rodzajem), rodzaj tylko jako pierwsze słowo po budowie, kształtki z liczbą za nazwą. Dymek mówi, co rozpoznano. Mikrofon przy „Dyktuj kształtki” (`spokenFittings.ts`) sumuje sztuki tej samej nazwy. Braki dyktowane z treści („Lipowa, brakuje kleju…”) trafiają do karty budowy, nie do treści wpisu. „Etap … zrobiony” odhacza etap w karcie. Web Speech w Chrome idzie do usługi Google; bez internetu nie działa. Nie testowane z prawdziwym mikrofonem.
- **Tu jestem** (M2.1): przycisk w arkuszu zapisuje lokalizację wpisu tylko po stuknięciu, z dokładnością („Tu (±12 m)”, link do map, ×). Gdy w promieniu 300 m jest budowa z zapisaną lokalizacją — „Budowa obok”. Współrzędne zaokrąglone do ~1 m (`geo.ts`). Lokalizacja trafia do raportu jako link „Mapa (±12 m)” (M2.2); raport nie ma przełącznika „bez lokalizacji”.
- **Etap przy wpisie.** Pigułki „Zrobione” z trzema następnymi niezrobionymi etapami (stuknięcie odhacza etap z dymkiem „Cofnij”). Odhaczony z wpisu etap przypina się do wpisu (pasek „Etap: …”, ✕). Zapisany wpis przypina się do etapu w edycji polem „Zdjęcia do protokołu przy etapie”; stan etapu w karcie się wtedy nie zmienia.
- **Pola protokołu i kształtek** (pola wpisu, nie nowe rodzaje — starsza wersja je pomija, a nie odrzuca wpisu):
  - **Próba szczelności** (tematy „Płukanie i próba szczelności”, „Próba kanalizacji na zalanie”): czym (Powietrze / Woda / Zalanie), ciśnienie [bar], czas [min], spadek [bar], wynik (Szczelna / Nieszczelna). Start: powietrze 6 bar; kanalizacja — zalanie bez ciśnienia (`pressureTest.ts`, `PressureTestFields.tsx`). Linia „Próba szczelności (woda, 9 bar, 30 min, spadek 0,1 bar): szczelna” w wpisie, raporcie i wiadomości.
  - **Kształtki** („Dodaj kształtki”, `fittings.ts`): „nazwa + sztuki”, podpowiedzi z poprzednich wpisów, pigułki najczęstszych. Ta sama nazwa w różnej pisowni sumuje się (`fittingKey`). Do 20 pozycji, nazwa do 40 znaków. Bez metrów rury.
- **Tematy.** Temat wpisu z kolumny „Umiem” cofa temat do „W trakcie” (także przy edycji wpisu na problem lub zmianie tematu problemu). Chip tematu we wpisie filtruje dziennik po temacie.

### Problemy

- **Otwarte i rozwiązane.** Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego (`resolved` = moment, ms). Licznik „Otwarte problemy: N” w nagłówku filtruje do nich. Przyciski „Oznacz jako rozwiązany” / „Otwórz ponownie”. Rozwiązanie przechodzi na drugi telefon.
- **„Jak rozwiązane?”** Po oznaczeniu pod problemem pole opisu rozwiązania (do 500 znaków, `solution`). „Pomiń” zamyka pole, a przycisk „Jak rozwiązane?” zostaje. Opis jest pod wpisem („Rozwiązanie: …”), w raporcie (linia pod problemem), w szukaniu dziennika i na tablicy przy temacie („Moje rozwiązania (N)”). Ponowne otwarcie zostawia opis; zmiana rodzaju na inny niż problem go usuwa. Opisu nie dyktuje się osobnym mikrofonem.
- **Przypomnienie o problemie.** Otwarty problem starszy niż 3 dni (od chwili wpisu, nie od rozwiązania) pojawia się w pasku „Przypomnienia” nad listą.
- **Nie zrobione:** zamiana rozwiązania na własne pytanie quizu jednym stuknięciem (pytanie wymaga trzech błędnych odpowiedzi).

### Oś czasu i filtry

- Wpisy pogrupowane dzień → budowa, z przyklejonym nagłówkiem dnia (`journalView.ts`: `filterJournal`, `groupJournal`, `splitRecent`, `suggestSites`). Bez filtra ostatnie 30 dni (`RECENT_DAYS`), reszta za „Pokaż starsze”.
- Szukanie bez polskich znaków: każde słowo musi wystąpić w tekście, budowie, temacie, rodzaju lub rozwiązaniu. Filtry: rodzaju, budowy (`JournalFilter.site` = id budowy, `""` = bez budowy), tematu. Każdy filtr przeszukuje cały dziennik.
- Budowy w filtrze od ostatnio używanej; archiwalne za „Archiwum (n)”, chyba że wybrane. Nagłówek budowy w grupie to przycisk do karty.
- Wygląd wpisu: linijka w zeszycie — godzina na marginesie (`grid-cols-[3.25rem_minmax(0,1fr)]`), przerywany podział między wpisami. Ikona problemu i szary znacznik rozwiązanego.
- Godziny na budowach (H2): przy dniu z wpisami z kilku budów przycisk z zegarem („podziel godziny”) otwiera okno „Godziny na budowach” z polem godzin przy każdej budowie („6”, „6,5”, „6:30”), resztą dnia i „Po równo” (`evenShare`, zaokrąglenie do 5 min). Zasada bez wpisanych godzin: wpisany podział wygrywa; jedyna budowa dnia dostaje cały dzień z Grafiku; kilka budów bez podziału to „nierozdzielone” i nie wchodzi do sumy (wcześniej każda z budów liczyła pełne 10 h). Godziny to lista karty budowy (`hours`, klucz `budowa␁hours␁dzień`), nie zapis w Grafiku. Wpisane godziny mogą przekroczyć dzień z Grafiku — okno ostrzega, nie blokuje (`siteHours.ts`: `dayHours`, `parseHours`, `cleanSiteHours`; `report.ts`: `splitWork`, `workLine`).

### Karta budowy

- **Dane.** Nazwa, adres, inwestor (`SiteCardDialog.tsx`, `SiteCard` w `sites.ts`, `cleanSite`). Archiwum (`archived` = moment) chowa budowę z pigułek i filtra; wpisy zostają na osi.
- **Rozwiązywanie nazwy** (`resolveSite`): nazwa z arkusza → istniejąca budowa (porównanie `foldName`) albo nowa karta. Budowa sprzed kart dostaje id `siteKey(nazwa)` (deterministyczny skrót FNV-1a, `siteKey.ts`), liczony przy odczycie, więc urządzenia nie tworzą dwóch kart. Zmiana nazwy aktualizuje projekcję wpisów i bieżącą budowę arkusza (`studyMeta.site`).
- **Kontakt i dojazd** (`contact.ts`): pola „Telefon inwestora”, „Kierownik budowy”, „Telefon kierownika”, „Dostęp do budowy” (np. kod do bramy). Pasek szybkich akcji liczony z zapisanej karty: Nawiguj (link Map z trasą, bez klucza API), telefon i SMS do inwestora, telefon do kierownika. Numer czyści `normalizePhone` z `boss.ts`. Pola pominięte w zapisie zostają bez zmian; kontakt nie trafia do raportu ani protokołu.
- **Lokalizacja budowy.** „Zapisz jako lokalizację budowy” w arkuszu (budowa z kartą) albo w toaście po zapisie nowej budowy (`setSiteGeo`).
- **Etapy** (`stages.ts`): domyślnie kanalizacja podposadzkowa, rozprowadzenie wody, piony i podejścia, próba szczelności, zakrycie instalacji, biały montaż, odbiór. Odhaczenie zapisuje datę; „Następny:” — pierwszy niezrobiony; własny etap na końcu, usunięcie z „Cofnij”. Nazwy nie zmieniają się, nie przestawiają się (usuń i dodaj). `matchStage` rozpoznaje etap z wypowiedzi bez ogonków; przy niejednoznacznym dopasowaniu nic nie robi. Postęp „etapy 3/7” przy budowie w dzienniku. Pierwsza zmiana zapisuje całą listę w karcie.
- **Braki materiału** (`shortages.ts`): dopisujesz, czego brakuje, z ilością. Status *Brakuje → Zamówione → Dostarczone* (data zmiany). „Brakuje” celowo czerwone (bursztyn motywu jest bliski ostrzeżeniu). „Kopiuj braki” do dostawcy lub szefa, „Wyczyść dostarczone” (z „Cofnij”). Ta sama nazwa dopisana ponownie nie tworzy duplikatu. Data dostawy („dostawa dd.mm”, `due`) — zaległe zamówienie dzwoni po końcu dnia dostawy. Limity: 40 braków, 80 znaków nazwy, 20 zamówień w historii.
- **Do zamówienia** (`order.ts`): suma kształtek zużytych od ostatniego zamówienia (`siteOrder`, `orderText`, `whatsappOrderUrl`). „Kopiuj listę”, „WhatsApp” (`wa.me` z tekstem, odbiorcę wybiera WhatsApp — numer hurtowni nie jest zapisywany), „Oznacz jako zamówione” (zapisuje `orderedAt` i wpis historii; od tej chwili lista zaczyna od zera). Historia „Poprzednie zamówienia”. Liczy tylko kształtki, bez metrów rury. Numer hurtowni w karcie (`supplierPhone`) pojawia się w sekcji zamówień (U7) i jest w kopii. Wpisy starsze niż `orderedAt` są pomijane.
- **Dokumenty i plany** (`siteDocs.ts`, `siteDocsAdd.ts`): zdjęcia (rzut, tablica) i PDF-y (projekt), także kilka naraz; limit 30. Zdjęcia jako miniatury z powiększeniem i „100%”. PDF jako wiersz z „Otwórz” (zapisuje plik i otwiera go aplikacją telefonu, bo aplikacja nie pokazuje PDF-ów u siebie). Obrazy do 2 MB zostają bez zmian. PDF powyżej 2 MB zostaje na telefonie, który go dodał. Ten sam plik drugi raz się nie dubluje.
- **Serwis i gwarancja** (`service.ts`): zgłoszenia po odbiorze z datą, opcjonalnym terminem wizyty (dzień, nie godzina) i „Załatwione” z opisem (`solution`). Załatwione chowają się pod licznikiem; „↺” otwiera ponownie. Pole „Gwarancja do” z liczbą dni (od 30 dni na żółto; po terminie „po gwarancji”). Zgłoszenia działają także przy budowie w archiwum. Zgłoszenie z terminem na dziś lub zaległe trafia do przypomnień nad Dziennikiem. Push idzie tylko rano w dniu wizyty i tylko dla terminu na dziś — zaległe widać w dzienniku, nie w powiadomieniach. Limit 50 zgłoszeń na budowę. Gwarancja jest polem karty (`saveSite`), zgłoszenia są listą.
- **Protokół odbioru dla inwestora** (`handover.ts`, `HandoverPaper.tsx`): jedna kartka do wydruku lub PDF — nazwa, adres, inwestor, okres prac, etapy z datami (☑/☐), próby szczelności z wpisów, uwagi (otwarte problemy; bez nich „Brak uwag”), do 12 zdjęć, dwa pola podpisów. Zdjęcia wpisów przypiętych do etapu stoją pod nazwą tego etapu, reszta pod „Pozostałe”. „Tekst protokołu” wysyła ten sam dokument jako tekst bez zdjęć (udostępnianie albo schowek).

### Raporty

- **Raport z budowy** (`report.ts`: `buildJournalReport`, `reportBody`, `reportText`, `reportSummary`, `reportWhatsApp`; `JournalReport.tsx`). Dzień albo okres dla jednej budowy lub wszystkich. Zestawienie dni od dwóch dni (godziny z Grafiku, liczba wpisów i problemów), linia protokołu przy wpisie, sekcja „Próby szczelności”, „Kształtki (suma)”, „Do zamówienia”, „Braki materiału”, „Etapy (3/7)” z datami, „Rozwiązanie:” przy problemach, miejsca na podpisy „Wykonawca” i „Odbierający / kierownik”. Okres: Dziś / Wczoraj / 7 dni / Ten miesiąc / Wybierz. Przy kilku budowach „Wszystkie budowy”.
- **Akcje raportu.** Główna: wysłanie szefowi (czat WhatsApp `wa.me` z tekstem; zdjęcia tą drogą nie idą) albo do grupy (systemowe „Udostępnij” z tekstem i zdjęciami do 10; w komputerze tekst do schowka). Odbiorców zapisuje się w `studyMeta` (`boss`, `waGroup`, `boss.ts`), trafiają do synchronizacji i kopii. Pozostałe przez menu „Więcej”: „Kopiuj tekst”, „Do notatki” (te same klucze zdjęć, bez kopiowania bajtów), „Drukuj / PDF” (`PrintRoot`, `html.printing-report`).
- **Dlaczego bez automatycznej wysyłki.** Aplikacja nie ma serwera ani konta firmowego do WhatsApp Cloud API; nieoficjalne klienty łamią regulamin. Wysyłka zostaje jednym stuknięciem użytkownika.
- **Paczka ZIP budowy** (`siteZip.ts`): „Paczka ZIP” w karcie — `raport.md` (ten sam tekst co „Kopiuj”) i zdjęcia w `zdjecia/` (numerowane od najstarszego), dokumenty w `dokumenty/`. Brak bajtów na tym urządzeniu pomija pozycję i podaje liczbę pominiętych w toaście. PDF nie wchodzi do paczki (osobny układ byłby potrzebny). Cała paczka składa się w pamięci — przy bardzo dużych budowach warto dzielić na okresy.

### Przypomnienia

- **Przypomnienia nad listą** (`reminders.ts`: `studyReminders(journal, now, siteCards)`; pasek `ReminderRow` w `StudyJournal.tsx`): znikają same, gdy warunek przestaje być prawdziwy.
  - **Problem otwarty ponad 3 dni** (`stale-problems`).
  - **Montaż bez protokołu próby** (`no-test`): budowa z montażem (kształtki albo temat próby), w której żaden wpis nie ma próby.
  - **Materiał zamówiony, a niedostarczony** (`late-order`): status „zamówione” dłużej niż 3 dni (od końca dnia dostawy, jeśli podano). Jedno przypomnienie na budowę; archiwum pomijane.
  - **Próba przed zakryciem** (`pre-cover-test`, U1): odhaczony etap instalacji, a bez odhaczonej próby, bez zakrycia i bez wpisu o montażu lub próbie. Pokazuje się w Dzienniku i w Dziś. Nie idzie do push.
- Liczone przy renderze (`useMemo` na zmianie dziennika), bez timera. Jeśli strona stoi otwarta i przypomnienie przekroczy próg bez zmiany dziennika, pojawi się po następnym renderze.
- **Raport dnia i tygodnia** (`reportNudge.ts`, `DailyReportNudge.tsx`): raz dziennie po końcu dzisiejszej zmiany z Grafiku (bez zmiany — o 17:00), jeśli są dziś wpisy, dymek „Raport dnia gotowy” i przy zgodzie powiadomienie. W piątek (albo w weekend, jeśli piątku nie było okazji) raport tygodnia, raz na tydzień, zastępuje raport dnia. „Otwórz raport” przechodzi do Dziennika z zakresem (`?raport=dzis`, `dzis-wszystkie`, `tydzien`, `tydzien-wszystkie`). Bez serwera przypomnienia działają tylko przy otwartej aplikacji.
- **Zamówienia i serwis w push** (`push/schedule.ts`): zamówienie z datą dostawy, serwis dziś o 7:00 (`pushKey.service`, bez podwójnych powiadomień).

### Wydajność i struktura

- Dziennik i karta budowy są leniwe. `store.ts` ciągnie materiał (`content.ts`, ok. 22 KB); karta Dziś ładuje go przez `dueToday(useStudy())`. Komponent raportu dnia czyta dziennik przez `yStudy` z `data.ts`, nie przez `store.ts`, żeby nie dokładać materiału do startowej paczki.
- `yStudy.ts` jest w paczce startowej; każdy nowy kod tam zużywa budżet (`e2e/bundle.spec.ts`, próg 393 KB; ostatni pomiar 392,4 KB).
- `cleanEntryParts` (`yStudy.ts`) jest jedną funkcją czyszczenia wpisu dla zapisu z arkusza, kopii, drugiego telefonu i projekcji. Różnica zostaje świadoma: projekcja filtruje odhaczenia po materiale przed decyzją o pustości (`empty`), zapis — po niej.

### Ograniczenia i pułapki

- Starsza wersja aplikacji nie zna nowych pól (`recordings`, `solution`, `stage`, `test`, `fittings`, `geo`, `service`, `warranty`, `hours`, `docs`) i przy edycji wpisu lub zapisie karty może je zgubić. Po aktualizacji niektóre listy wracają z kopii, nie zawsze wszystko.
- Ta sama pozycja listy zmieniona naraz na dwóch telefonach: wygrywa ostatni zapis tej pozycji.
- Rozpoznawanie mowy nie stawia przecinków, więc reguły są ostrożne. Pierwsze słowo budowy bez przecinka i bez rodzaju za nim to tekst. „Brak” (nie „brakuje”) to zwykły tekst problemu.
- Przypomnienie „montaż bez próby” jest heurystyczne: wpis z tematu „Próba” bez protokołu też je uruchamia.
- Przycisk „Dodaj protokół” w przypomnieniu nie istnieje — przycisk pokazuje wpisy budowy.
- Podpis zdjęcia i rysunek są wtopione w piksele: zmiany nie da się cofnąć bez usunięcia zdjęcia.
- Podpowiedzi „Jak wczoraj” liczą wczoraj wg czasu lokalnego, nie 24 h wstecz.
- Test e2e pułapki: etykieta „Telefon inwestora” zawiera „Inwestor” (`exact: true`); przycisk „Załatwione” w podciągu „Załatwione (1)”; „Dyktuj” (treść) wymaga `exact: true` przy „Dyktuj kształtki”; w e2e otwarty arkusz ukrywa zakładki z drzewa dostępności (`includeHidden: true`).
- Dzienne przypomnienia o raporcie: e2e bez stałego zegara może pokazać dymek w niezwiązanym teście — testy przypomnień ustawiają `page.clock`.
- Nie sprawdzone ręcznie na telefonie: udostępnianie zdjęć, wydruk na prawdziwej drukarce, PDF w telefonie, dyktowanie z prawdziwym mikrofonem, nagrywanie głosu, „Tu jestem”, układ karty na 320 px (po poprawkach zakładek przechodzi e2e).

### Testy

- Jednostkowe: `src/lib/study/yStudy.test.ts` (dwa dokumenty Yjs, D5, listy karty, dokumenty, serwis, szef, kopia), `study.test.ts` (szkic, edycja, problemy, budowy, godziny, „Jak rozwiązano”, „Tu jestem”), `srs.test.ts`, `report.test.ts`, `siteZip.test.ts` (3), `siteDocs.test.ts`, `siteDocsAdd.test.ts`, `siteItems.test.ts`, `siteHours.test.ts`, `stages.test.ts` (10), `shortages.test.ts` (10), `order.test.ts` (10), `handover.test.ts` (4 + 3), `service.test.ts`, `contact.test.ts`, `geo.test.ts`, `boss.test.ts`, `reminders.test.ts` (10 + grupa U1), `reportNudge.test.ts` (11), `journalView.test.ts` (7), `spokenEntry.test.ts`, `spokenFittings.test.ts` (10), `recordings.test.ts`, `workLine.test.ts`, `pressureTest.test.ts`, `photoCaption.test.ts`, `fittings.test.ts`, `dueRows.test.ts`.
- Komponenty: `SiteOrderPanel.test.tsx`, `SiteShortagesPanel.test.tsx`, `SiteStagesPanel.test.tsx`, `SiteDocsPanel.test.tsx`, `DayHoursDialog.test.tsx`, `SiteServicePanel.test.tsx`, `CalculatorsSheet.test.tsx`, `JournalEntrySheet.test.tsx`, `TodayStudyCard`, `StudyDueRows.test.tsx`.
- E2E: `study.spec.ts` (31), `study-custom.spec.ts`, `journal-photos.spec.ts`, `journal-pressure-test.spec.ts`, `journal-fittings.spec.ts`, `journal-solution.spec.ts`, `journal-geo.spec.ts`, `entry-dictation.spec.ts`, `fittings-dictation.spec.ts`, `report-whatsapp.spec.ts`, `report-nudge.spec.ts`, `site-stages.spec.ts`, `site-shortages.spec.ts`, `site-order.spec.ts`, `site-handover.spec.ts`, `site-contact.spec.ts`, `site-hours.spec.ts`, `site-docs.spec.ts`, `site-service.spec.ts`, `site-card-mobile.spec.ts` (`@mobile`), `photo-drawing.spec.ts`, `today-study.spec.ts`, `weekly-review.spec.ts`, `mobile-layout.spec.ts`, `bundle.spec.ts`.
- Zgłoszone przebiegi działu: 53/53 (2026-10-18, dział Praca), kopia i listy karty 50/50 (2026-10-20). Po zmianach z 2026-10-19/20 (D5, U8, zakładki 320 px) — punktowe; pełne e2e nieuruchomione.

### Commity

- Model i synchronizacja: D1 `6045b5a`, D0 `df308d5`, D2 `92c1015`, D3 `1c40b26` (2026-10-15); pigułki budów D4a `b41e3c9`; oś czasu (plan D5 z 2026-10-15) `cb35c04`; karty budów D4b `e3096c4`; raport D6 `d73d951`; paczka ZIP `50842a6` (2026-10-16).
- Listy karty w dokumencie `395c311` (2026-10-16); kontakt `95159d1`; godziny na budowach `f5186f5`; dokumenty i plany `0f78d36`; serwis i gwarancja `d61e8a2` (kod 2026-10-17); etapy `a25958a`, `b82dda3`, `5ee9858`, `f31f65f`; zamówienia `98e625a`, `a8cf1a9`; braki `f10d6dd`; protokół odbioru `9b169ad`; rysowanie `b1f3842`; „Jak rozwiązane?” `415b7a5`; dyktowanie `b65d58c`, `b61b737`, `db490f7`; raport dnia `5d6008e`, tydzień `83a6383`; przypomnienia nad listą `d41bd89`, `7f95fe9`; podpowiedzi tekstu `7fcff9a`; linijka w zeszycie `162dcdf`.
- Porządki i poprawki: `304bbe8` (2026-10-20, odporność danych); `9a85c10` (zakładki 320 px); `7fd412a` (próba przed zakryciem, U1); `668c7ba` (data dostawy, T4); `19f2ade` (porządki po planie); `5581ece` (nagranie głosowe, U8); `f6867bd` (poprawka raportu kopii); `4167846` (D5, pola wpisu osobno, 2026-10-20).
- Tu jestem (M2.1, `bcf79ce`) i mapa w raporcie (M2.2, `c3387b4`), 2026-10-18.

## Porządki — ostrzeżenia lintera w Notatkach, Kalendarzu i Grafiku

**Co robi.** Bez zmiany działania dla użytkownika: poprawione trzy realne ostrzeżenia `react-hooks/exhaustive-deps` i jeden nieużywany parametr. Pozostałe ostrzeżenia `react-refresh/only-export-components` (stałe eksportowane obok komponentów w `ui/*`, `ColorPicker`, `MarkdownRenderer` i inne) zostają świadomie.

**Gdzie jest.**
- `src/hooks/useNotes.ts`: `withDescendants`, `restoreSet`, `trashBranch` przeniesione z wnętrza `useNotes()` na poziom modułu (przed `useNotes`). Zależą tylko od `yjsStore` i `descendantIds`, więc nie potrzebują stanu hooka. `trashNote` i `bulkTrash` nie mają już brakującej zależności.
- `src/components/AddNoteBar.tsx`: `commit` (`useCallback`) ma w zależnościach `parentOptions`, bo czyta je przy zapisie. Wcześniej przy zmianie listy rodziców zapisywał z nieaktualną listą.
- `src/components/shifts/YearSummaryDialog.tsx`: `LeaveMeter` bez nieużywanego `compact`; `src/components/shifts/ShiftSummary.tsx` nie przekazuje już tej prop.

**Testy.** `npm run typecheck` czysty, `npx eslint .` 0 błędów (11 ostrzeżeń `react-refresh`), `npx vitest run` 144 pliki zielone. E2e wybrane (`subpages`, `composer`, `notes`, `editing`, `note-groups`, `qol`) 21/21 przy jednym workerze.

## Wspólne — ruch (animacje i przejścia, 2026-10-18)

- **Co robi:** zwijanie grupy w Notatkach opada wysokością zamiast skakać; wiersz tabeli usunięty lub zarchiwizowany gaśnie, nowy łagodnie wjeżdża; karty „Dziś” rezerwują miejsce szkieletem, więc lista nie przesuwa się po dociągnięciu danych; pusty stan gaśnie, gdy pojawią się notatki. Przy ograniczonym ruchu zmiany są natychmiastowe.
- **Gdzie jest:** `src/components/NoteGroupSection.tsx` (AnimatePresence + `m.div`, wysokość i przezroczystość), `src/components/NoteTable.tsx` (`m.tr` w AnimatePresence `initial={false}`), `src/components/StatusPanel.tsx` (exit w trybie page), `src/components/ViewSkeleton.tsx` (`CardSkeleton`, wchodzi po 180 ms przez klasę `.view-skeleton`), `src/pages/Index.tsx` (cztery `Suspense fallback={null}` kart Dziś → `CardSkeleton`; `EmptyState` w AnimatePresence, `key="empty"`).
- **Jak działa:** korzysta z istniejącego LazyMotion; `overflow` grupy wraca do `visible` po wjeździe, żeby nie ucinać focus ringu kafli.
- **Ograniczenia i pułapki:** wiersze tabeli nie animują się przy pierwszym montażu widoku (celowo). Jeśli karta Dziś po załadowaniu renderuje `null`, szkielet znika i lista się przesuwa — uznano to za mniejsze zło niż skok bez szkieletu.
- **Testy:** `src/components` i `src/hooks` (jednostkowe); e2e warto potwierdzić na `e2e/` przy tabeli i zwijaniu grup. Nie sprawdzano wizualnie na telefonie.
- **Commit:** c630cb4, 30427f2 (2026-10-18), scalone do master (merge e3492b9 i poprzednie).

## Wspólne — mikrointerakcje i stany (2026-10-18)

- **Co robi:** pole z błędem (`aria-invalid`) ma czerwoną ramkę i czerwony fokus; przełączniki i checkboxy podświetlają się po najechaniu (osobno dla włączonego i wyłączonego); suwak ma halo przy najechaniu i przeciąganiu; tosty mają przycisk × (błąd z 9 s można zamknąć od razu); Enter i Spacja po dotyku nie włączają ramki fokusu z klawiatury.
- **Gdzie jest:** `src/components/ui/input.tsx`, `switch.tsx`, `checkbox.tsx`, `slider.tsx`, `sonner.tsx` (prop `closeButton`, kolory ze zmiennych Sonnera); `src/lib/inputModality.ts` (+ `inputModality.test.ts`).
- **Jak działa:** `inputModality` wykrywa Enter/Spację na przycisku po dotyku; pola tekstowe i textarea są wykluczone, bo klawiatura ekranowa wysyła te klawisze i pole dostałoby ramkę fokusu.
- **Ograniczenia i pułapki:** przycisk w stanie „ładuje” (wspólny prop `loading`) nie zrobiony — wymagałby zmiany API w wielu dialogach. Hover i wygląd × na tostach nieprzejrzane na zrzutach.
- **Testy:** `src/lib/inputModality.test.ts`; e2e `a11y.spec.ts` i `skins.spec.ts` (47/47 w worktree).
- **Commit:** 84490c6 (2026-10-18), scalone do master.
- **Budżet:** wejściowy JS 381 KB gzip, próg w `e2e/bundle.spec.ts` 384 KB — zapas mały.

## Wspólne — kontrast tokenów i skala nagłówków (plan wizualny, fazy A i B, 2026-10-18)

- **Co robi:** czerwony tekst w ciemnym Zeszycie czytelny (≥4,5:1); krawędź pól ≥3:1 w ciemnym motywie (1.4.11); podpowiedzi w polach szare, z tokenu; priorytety notatek w ciemniejszym odcieniu na jasnym tle, jaśniejszym w ciemnym; tytuł strony najgrubszy (700, ciaśniej), podtytuły 600; etykiety sekcji Notatek i „Przypomnienia” na Dziś zdaniem zamiast wersalików, a w Zeszycie z cienką kreską marginesu.
- **Gdzie jest:** `src/index.css` — `:root` i `.dark` (`--destructive-ink`, `--input` w ciemnym); reguła `h1` w `@layer base`; klasa `.section-label` w `@layer components`; `tailwind.config.ts` — `colors.destructive.ink`. `src/lib/notePriority.ts` (`PRIORITY_COLOR_CLASS` z wariantem `dark:`). `text-destructive` zastąpione przez `text-destructive-ink` w całym `src` (poza tłem przycisku, które zostaje `bg-destructive` z `foreground`). `JournalEntrySheet.tsx` (`text-primary-ink`). `AppHeader.tsx` (h1 bez `font-extrabold`). `shifts/ShiftsView.tsx` (przycisk miesiąca `font-semibold`). `NoteGroupSection.tsx` i `review/TodayDueList.tsx` (`section-label`).
- **Jak działa:** ink to osobny token tekstu, a `destructive` zostaje tłem przycisków (biały tekst na nim ma 4,8:1). Krawędź pól w ciemnym motywie jest osobnym tokenem `--input`; obwódka dekoracyjna `--border` zostaje ciemna.
- **Ograniczenia i pułapki:** `text-destructive` pozostaje tylko jako tło z `destructive/…`; skórki nie definiują `--destructive-ink`, więc dziedziczą wartość z motywu. Neon ustawia wagę h1 jawnie na 600 (Unbounded), więc nie zmienia się. Zorza dziedziczy bazowe h1 i dostaje 700 (Fraunces). Pozostałe 63 miejsca z `uppercase tracking-wider` nie zostały zmienione. Fazy B3 (Fraunces w Zeszycie) i B4 (blok tytułowy widoku) czekają na decyzje użytkownika.
- **Testy:** `src/lib/contrastTokens.test.ts` (4 testy, liczy kontrast z tokenów w `index.css`); e2e `a11y.spec.ts` i `skins.spec.ts` (47/47 na zmienionym kodzie).
- **Commit:** brak — zmiany niezacommitowane w `master`.

## Wspólne — rytm, metadane kafla i promienie (plan wizualny, faza C, 2026-10-18)

- **Co robi:** domyślna gęstość siatki notatek to krok 4 px (kafle 12/16 px zamiast 10/12 px), odstęp między sekcjami widoku 32/40 px zamiast 24/32 px; metadane kafla (czas, liczba słów) w czcionce mono 11 px; trzy nazwane promienie systemu: przyciski i ikony 8 px, pola 12 px, karty i kafle 16 px. Wygląd promieni się nie zmienił.
- **Gdzie jest:** `src/components/NoteGrid.tsx` (`gap`, `listGap`, `columnGap`, `rowGap` dla gęstości „normalnej”; zwarta i wygodna bez zmian); `src/pages/Index.tsx` (`main` — `gap-8 sm:gap-10`); `src/components/NoteCardBody.tsx` (wiersz `.card-meta`: `font-mono text-[11px]`); `src/index.css` (`--r-control`, `--r-field`, `--r-card` w `:root`; `.card-action` i `.note-flash` na tokenach; `@utility stats-card` na `rounded-card`); `tailwind.config.ts` (`borderRadius.control|field|card`).
- **Jak działa:** tokeny promieni są zmiennymi CSS, więc klasy `rounded-card` itd. czytają je w obu motywach. Gęstość „zwarta” i „wygodna” mają własne wartości i nie są ruszane.
- **Ograniczenia i pułapki:** większe odstępy oznaczają mniej kafli na ekranie bez przewijania. Tylko trzy miejsca z promieniem zamieniono na tokeny; pozostałe 46 użyć `rounded-2xl` w komponentach to nadal wartość 16 px, zamiana na `rounded-card` jest czysto kosmetyczna i do zrobienia osobno.
- **Testy:** testy jednostkowe (147 plików, 1372 testy); e2e `bundle.spec.ts`, `mobile-layout.spec.ts`, `a11y.spec.ts`, `notes.spec.ts`, `touch-targets.spec.ts` — 73/73.
- **Commit:** brak — zmiany niezacommitowane w `master`.

## Wspólne — tabliczka rysunkowa, ołówek, tło Zeszytu, efekty domyślnie (plan wizualny, faza D i B3, 2026-10-18)

- **Co robi:** w prawym dolnym rogu tła (komputer, wszystkie skórki) tabliczka z nazwą widoku („NOTKI · ARKUSZ 1/1 · SKALA 1:1”, „GRAFIK · ARKUSZ 1/1” itd.); pod napisem „Zapisano” w pigułce statusu kreska rysuje się przy każdym zapisie; w Zeszycie delikatne ziarno papieru (tylko na komputerze; czerwony margines zrezygnowany, patrz niżej); pusta lista Notatek pokazuje szkic kartki z długopisem zamiast wordmarku; nagłówki Zeszytu w Fraunces; zmiana widoku przenika się ze starym (View Transitions); na telefonie zorza bez rozmycia i dryfu.
- **Gdzie jest:** `src/components/PaperBackdrop.tsx` (`<span className="paper-stamp">`); `src/index.css` (warstwa `components`: `.paper-stamp` i napisy po `html[data-view]`, `.pencil-stroke`, ziarno `html:not([data-skin]) .paper-grid` (media `pointer: fine`), Fraunces dla `h1` w Zeszycie); `src/styles/skins.css` (stara tabliczka Planu usunięta; zorza `@media (pointer: coarse)`); `src/components/OfflineStatus.tsx` (kreska przy `saved`); `src/pages/Index.tsx` (`data-view` na `<html>` w efekcie; `setView` z `startViewTransition` + `flushSync`); `src/lib/emptyGlyphs.ts` (`notes`); `src/components/ui/button.tsx` (`[&_svg]:[stroke-width:1.75]`); `src/lib/effectsSettings.ts`.
- **Jak działa:** napis tabliczki wybiera CSS z atrybutu `data-view`, który `Index` ustawia z routera; bez JS poza tym jednym efektem. Przejście widoku: gdy przeglądarka nie ma View Transitions albo jest ograniczony ruch, zmiana jest natychmiastowa. Kreska ołówka to CSS na elemencie montowanym przy `saved`, więc rysuje się przy każdym zapisie bez stanu.
- **Efekty domyślnie:** zostają tylko przywrócenie z kosza (konfetti) i zamknięty dzień; wyłączone: iskierki, deszcz emoji, fajerwerki, serduszka, bąbelki, tęcza, motyw sezonowy, cytat dnia, odznaka. Migracja jednorazowa (`kaczy.effectsSettings.defaults2`) wyłącza je także u osób z już zapisanymi ustawieniami; późniejsze wybory użytkownika są zachowane.
- **Skutki wyłączenia efektów (do wiedzy):** pinezka przy przypięciu to część efektu „Iskierki” (`markPinned` działa tylko przy `sparkle`), więc domyślnie jej nie ma. Pieczątka odznaki wyłączona oznacza, że toast osiągnięcia pojawia się od razu i — naprawione: toast osiągnięcia czeka 400 ms (`useAchievementToasts.ts`), żeby toasty tej samej akcji zdążyły się zamontować, i nie zasłania „Cofnij”.
- **Ograniczenia i pułapki:** czerwony margines Zeszytu (plan D7) nie jest rysowany: tło nie zna szerokości paska bocznego, więc linia leżała pod paskiem (komputer) albo pod kartami (telefon). Na Grafiku tabliczka przechodzi na lewy dolny róg (`html[data-view="shifts"]`), bo prawy dolny zajmuje panel podsumowania. Ołówek jest pod „Zapisano” w pigułce statusu, a nie pod tytułem notatki (plan mówił o tytule; to wymagałoby stanu w edytorze). Tabliczka nie pokazuje dat ani numeru, tylko stałe napisy. Przejście widoków to ogólne przenikanie, bez nazwanych elementów. Blok tytułowy widoku (B4) nie zrobiony — decyzja użytkownika.
- **Testy:** testy jednostkowe 147 plików / 1372 testy; e2e z zestawu `a11y`, `bundle`, `skins`, `view-change`, `mobile-layout`, `notes`, `qol`, `routes`, `touch-targets`, `resilience`, `parked-drafts`.
- **Commit:** brak — zmiany niezacommitowane w `master`.

## Wspólne — spójność kolorów z tokenów (plan wizualny, faza E, 2026-10-18)

- **Co robi:** kolor paska przeglądarki w ciemnym Zeszycie to ciepła ciemność tła (`#15110e`), a nie chłodny fiolet; awaryjne kolory konfetti to bursztyn, niebieski długopis i zieleń marki; callouty w Markdownie (informacja, wskazówka, uwaga, ważne) używają tokenów akcentu, sukcesu, ostrzeżenia i destructive; kropki kolorów folderów mają kolory kafli; ikony kopii zapasowej, pasek siły hasła w sejfie, płomień serii i ostrzeżenie synchronizacji używają tokenów.
- **Gdzie jest:** `src/hooks/useTheme.ts` (`paint`, `theme-color`); `src/lib/celebrate.ts` (`themeColors`); `src/components/MarkdownRendererImpl.tsx` (`CALLOUTS`); `src/components/FolderPicker.tsx` (`folderColorDot`, `data-swatch`); `src/components/sidebar/SidebarFolderItem.tsx` (kropka i wybór koloru z `data-swatch`); `src/components/SyncSettings.tsx`; `src/components/settings/BackupSettings.tsx`; `src/components/vault/VaultDialogs.tsx`; `src/components/StatsDialog.tsx`.
- **Jak działa:** kropki folderów używają `bg-[hsl(var(--note-ink))]`, a wartość zmiennej ustawia atrybut `data-swatch` z `index.css` (ten sam zestaw co kafle), więc kolory folderów i notatek nie rozjadą się. Kolory priorytetów (faza A) mają wariant `dark:`.
- **Ograniczenia i pułapki:** kolor paska przeglądarki to stała hex, bo `theme-color` nie przyjmuje zmiennych CSS; po zmianie `--background` Zeszytu trzeba ją zaktualizować ręcznie.
- **E4:** wykonane w osobnym wpisie „odznaki statusu jako pieczątki, cienie”.
- **Testy:** testy jednostkowe 147 plików / 1372 testy; e2e `a11y`, `skins`, `folder-progress`, `search-backup`, `sync-code`, `bundle` — 58/58. Wcześniejszy zestaw fazy D: 95/95.
- **Commit:** brak — zmiany niezacommitowane w `master`.

## Wspólne — odznaki statusu jako pieczątki, cienie (plan wizualny, E4, 2026-10-18)

- **Co robi:** odznaki statusu i liczniki, które nie są przyciskami, są pieczątkami: obwiedzina i tekst w tym samym kolorze, bez wypełnienia, czcionka mono. Dotyczy: licznik zaległych na Dziś, licznik przeglądu tygodnia, „na dziś” przy temacie Nauki, status przypomnienia (czas z dzwonkiem; czerwony po terminie). Przyciski („Gotowe”, „Przywróć”, chipy wyboru) zostają chipami z wypełnieniem, bo muszą wyglądać jak przyciski.
- **Gdzie jest:** `src/index.css` (klasa `.stamp-tag` w `@layer components`); `src/components/review/TodayDueList.tsx`, `src/components/review/WeeklyReviewCard.tsx`, `src/components/study/StudyBoard.tsx`, `src/components/ReminderPicker.tsx`.
- **Cienie:** karta błędu (`ErrorBoundary.tsx`), płótno rysunku (`DrawingCanvas.tsx`) i kciuk przełącznika (`ui/switch.tsx`) mają `shadow-sm` zamiast `shadow-lg`. Cienie okien, menu, podpowiedzi i tostów zostają — to uniesienie.
- **Ograniczenia i pułapki:** w aplikacji zostają pigułki z wypełnieniem na przyciskach (świadomie). Odznaki pieczątek nie mają animacji, bo są stanem, nie zdarzeniem. Nie zrobiono wizualnego przeglądu tych czterech miejsc.
- **Testy:** testy jednostkowe 147 plików / 1372 testy; e2e `a11y`, `inbox-today`, `reminders-agenda`, `reminder-toast`, `study`, `study-custom`, `today-study`, `weekly-review` — 95/95.
- **Commit:** brak — zmiany niezacommitowane w `master`.

## Telefon — przyciski w powiadomieniach i jedno okno aplikacji (plan mobilny M1.1, M1.2, 2026-10-18)

- **Co robi:** powiadomienie o przypomnieniu z serwera push (aplikacja zamknięta) ma te same przyciski co powiadomienie ze strony: „Gotowe” i — dla przypomnień jednorazowych — „Odłóż 10 min”. Gdy żadna karta aplikacji nie jest otwarta, przycisk otwiera aplikację i wykonuje akcję po wczytaniu notatek (toast „Przypomnienie odhaczone” / „Odłożono o 10 minut”). Skrót z ikony, udostępnienie i powiadomienie otwierają istniejące okno aplikacji zamiast nowego.
- **Gdzie jest:** `public/sw-notifications.js` (push: `noteId` z klucza `n:<id>:<termin>`, `actions`; `notificationclick` bez karty → `?akcja=done|snooze10`); `src/lib/notificationAction.ts` (`parsePendingAction`, `withoutActionParam`); `src/hooks/useReminderNotifications.ts` (wspólne `applyActionRef`, akcja z adresu po pojawieniu się notatki); `src/lib/push/schedule.ts` (pole `snooze` przy notatkach); `push-server/core.js` (`cleanItems` i `payloadOf` przepuszczają `snooze`); `public/manifest.webmanifest` (`launch_handler: navigate-existing`, `background_color` = ciepłe tło ciemnego Zeszytu).
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

## Wydajność — panel statusu synchronizacji leniwie (2026-10-18)

- **Co robi:** panel po stuknięciu pigułki statusu zapisu (`OfflineQueuePanel`) ładuje się przy pierwszym otwarciu i zostaje zamontowany (animacja zamykania działa).
- **Gdzie jest:** `src/components/OfflineStatus.tsx` (`lazy`, `panelMounted`).
- **Dlaczego:** funkcje mobilne dodały ok. 1,1 KB do wejściowego JS; przed nimi zapas do progu 384 KB wynosił ok. 0,5 KB. Po przeniesieniu panelu wejściowy JS to 393 200 B przy progu 393 216 B — **zapas 16 B**; następna zmiana w głównej paczce musi czymś się zrównoważyć.

## Poprawki po audycie (2026-10-18)

- **Paczka:** `vendor-radix` w `manualChunks` zostawiony — próba usunięcia powiększyła wejściowy JS o 1,5 KB (Radix trafia do `index`). Zmiana cofnięta.
- **Usunięte pliki:** `public/placeholder.svg` (bez odwołań, wypadł z precache), `src/components/ui/skeleton.tsx` (bez importów).
- **Logowanie błędów:** `study/data.ts` (`legacyStudyMerged`), `privateNotes.ts` (`readThrottle` — uszkodzony licznik prób hasła), zapis z `logDiag`. Parser w `notesStore.ts` bez logu — dodanie przekroczyłoby budżet paczki o 14 B.
- **Etykiety:** przełącznik motywu ma stałą nazwę „Tryb ciemny” z `aria-pressed` (AppHeader, AppSidebar); pasek boczny z tą samą etykietą widoczną; „Import i eksport” → „Import / Eksport” w dolnym menu; „Nie dało się” → „Nie udało się” (`ViewErrorBoundary`).
- **Korekty audytu:** „Widok i kolumny” nie występuje dwa razy naraz (inna gałąź telefon/komputer); `aria-expanded` na filtrach i sortowaniu ustawia Radix; `ui/calendar.tsx` i `ui/overlay-back.tsx` są używane.
- **Budżet:** wejściowy JS 393 208 B przy progu 393 216 B (zapas 8 B).

## Długi — stan aktualny (pożyczki i spłaty)

Dział opisany w jednym miejscu; zmiany z 2026-10-20 (kopia, edycja, cofnięcie rozliczenia, poprawka L9) są uwzględnione.

### Co robi

- **Widok.** Góra: „Są nam winni” i „My jesteśmy winni”. Pod spodem lista osób z saldem i paskiem spłaty. Stuknięcie w osobę otwiera arkusz z historią.
- **Cztery rodzaje wpisu** (siatka 2×2 w formularzu):
  - „Pożyczyłem” (`lent`) — ta osoba jest nam winna (+).
  - „Oddał mi” (`repaid`) — spłata od tej osoby (−).
  - „Pożyczyłem od” (`borrowed`) — my jesteśmy winni (−).
  - „Oddałem” (`returned`) — spłata z naszej strony (+).
  
  Jedna osoba może mieć długi w obie strony. Saldo to suma znaków; dodatnie = jest nam winna, ujemne = my jesteśmy winni.
- **Formularz dodawania:** rodzaj, osoba (z podpowiedziami z wcześniejszych wpisów), kwota, dzień, „za co”. Po zapisie zostaje osoba i data, czyszczona jest kwota i notatka, fokus wraca do kwoty. „Cofnij” w toście usuwa właśnie dodany wpis.
- **Oddał całość / Oddałem całość.** Dodaje wpis wyrównujący saldo do zera. Toast ma „Cofnij”, które usuwa ten wpis.
- **Historia osoby.** Lista wpisów z usuwaniem (z „Cofnij”, które przywraca wpis z tym samym id i datą) i edycją.
- **Edycja wpisu.** Ołówek przy wpisie otwiera `EditDebtForm` w miejscu: rodzaj, osoba, kwota, dzień, notatka. Zapis zachowuje id i datę dodania. Zła kwota blokuje zapis z komunikatem.
- **Kopia zapasowa.** Pożyczki są w pełnej kopii. Przywracanie tylko dodaje brakujące wpisy (po id), niczego nie kasuje i nie nadpisuje wpisu o tym samym id, który już jest na telefonie.

### Gdzie jest

- `src/lib/debts/model.ts` — czysty model: `DebtKind`, `DEBT_KINDS`, `KIND_SIGN`, `DebtEntry`, `cleanDebt`, `normalizeName`, `personKey` (grupowanie bez wielkości liter), `parseAmount`, `formatAmount`, `byNewest`, `balances`, `totals`, `knownPeople`. Stałe: `DEBT_MAX_ENTRIES` 2000, `DEBT_PERSON_MAX` 40, `DEBT_NOTE_MAX` 200, `DEBT_MAX_AMOUNT` 100 000 000 gr (1 000 000 zł).
- `src/lib/debts/yDebts.ts` — `createYDebts(doc)`: mapa Y `debts` (klucz = id wpisu), origin `DEBTS_ORIGIN`. `get`, `add`, `remove`, `restore`, `replace` (zmiana w miejscu), `dump`, `mergeDump`.
- `src/lib/debts/store.ts` — `useDebts()`, `addDebt`, `addDebtFromText`, `removeDebt`, `restoreDebt`, `updateDebt` (przez `cleanDebt`), `debtsDump`, `mergeDebtsDump`. Działają na `yjsStore.doc`.
- `src/components/debts/DebtsView.tsx` — `Summary`, `AddForm`, `People`, `PersonSheet`, `PersonHistory` (historia, „Oddał całość”, cofnięcie), `EditDebtForm`.
- **Podpięcie:** `src/hooks/useFilteredNotes.ts` (typ `View` = `"debts"`), `src/pages/Index.tsx` (leniwy widok, bez listy notatek i wyszukiwarki), `src/components/BottomNav.tsx` (kafel „Długi” w „Więcej”), `src/components/sidebar/sidebarItems.ts`, `src/components/CommandPalette.tsx`, `src/components/AppHeader.tsx` (tytuł), `src/lib/viewRoute.ts` (adres `/dlugi`).
- **Kopia:** `src/lib/noteSchema.ts` (pole `debts` w `fullBackupSchema`), `src/lib/exportNotes.ts` (zapis w `buildFullBackupWithReport`, scalanie w `restoreFullBackup`, przez dynamiczny import).

### Jak działa i dlaczego

- **Klucz na wpis.** Każdy wpis to osobny klucz mapy Yjs, więc dwa telefony dopisujące pożyczki scalają się bez strat. Ten sam wpis edytowany równocześnie wygrywa w całości.
- **Kwoty w groszach** (liczby całkowite). `parseAmount` przyjmuje „1 234,5”, „1234.50”, „80”; odrzuca zero, litery, więcej niż dwa miejsca po przecinku i ponad 1 000 000 zł.
- **Saldo i kolejność.** Saldo osoby = suma `KIND_SIGN × kwota`. Kolejność: nam winni, my winni, rozliczeni. Osoby grupowane bez względu na wielkość liter („Anna” = „anna”).
- **Nieprawidłowe wpisy od peera** są pomijane po cichu przy odczycie (`cleanDebt` zwraca `null`).
- **Usuwanie uszkodzonego wpisu.** `remove` kasuje też wpis, którego `cleanDebt` nie przepuszcza. Inaczej zajmowałby miejsce w limicie 2000 (L9).
- **Waluta.** Zawsze złote (zł).
- **Scalanie kopii.** Przywrócona kopia nie kasuje długów. Wpis usunięty na jednym telefonie wróci, jeśli przywracamy kopię sprzed usunięcia — tak samo jak w pozostałych działach.

### Ograniczenia i pułapki

- Zmiana imienia w edycji przenosi wpis do innej osoby (grupowanie po nazwie).
- Długi są w dokumencie notatek, więc idą z synchronizacją i z pełną kopią; nie ma ich w eksporcie tylko Nauki lub Grafiku, bo tam ich nie ma.
- Nie ma zapisu długu w innej walucie.

### Testy

- `src/lib/debts/model.test.ts` — kwoty, czyszczenie, znaki salda dla czterech rodzajów, sortowanie.
- `src/lib/debts/yDebts.test.ts` — scalanie dwóch dokumentów, usunięcie i przywrócenie, śmieci od peera, powiadomienia.
- `src/lib/debts/yDebts.edit.test.ts` — `replace` i scalanie z kopii bez nadpisania.
- `src/components/debts/DebtsView.test.tsx` — podsumowanie, pusta lista, edycja kwoty (ten sam id i grosze), zła kwota, zmiana rodzaju, „Oddał całość”.
- `src/lib/fullBackup.test.ts` — długi w kopii, przywracanie scala.
- Ręcznie w przeglądarce na szerokości telefonu: zapis, saldo, „Cofnij”, cztery rodzaje, „Oddałem całość”.

### Lint

- `eslint.config.js`: `src/lib/debts/yDebts.ts` i testy Długów są na liście dozwolonych importów `yjs`.

### Commity

- `94434d5` (2026-10-19) — dział Długi.
- `dada7f1` (2026-10-19) — rodzaje „Pożyczyłem od” i „Oddałem”.
- `011be10` (2026-10-20) — kopia zapasowa, edycja wpisu, cofnięcie rozliczenia.
- `1b8bcf8` (2026-10-20) — poprawka L9 (usuwanie uszkodzonego wpisu).

## Wspólne — arkusz „Nowa” z przycisku „+” (wygląd i opisy)

- **Co robi:** przytrzymanie „+” na dolnym pasku otwiera arkusz „Nowa” z pięcioma kafelkami (Notatka, Lista zadań, Dyktuj, Zdjęcie, Rysunek). Każdy ma teraz ikonę w kolorze rodzaju i jedno zdanie, co się stanie. Stuknięcie „+” nadal od razu otwiera nową notatkę.
- **Gdzie jest:** `src/components/BottomNav.tsx` — `QuickTile` (kafel z tonem `primary`/`success`/`warning`), arkusz `quickOpen`.
- **Jak działa:** na telefonie kafle w dwóch kolumnach; „Dyktuj” tylko tam, gdzie przeglądarka ma rozpoznawanie mowy. Kafel „Długi” dodany też do arkusza „Więcej” (sekcja „Przejdź do”).
- **Ograniczenia:** zachowanie stuknięcia bez zmian — arkusz pokazuje się po przytrzymaniu lub z „Więcej → Dodaj…”. Podpowiedź o przytrzymaniu pojawia się po czwartym stuknięciu (jak dotąd).
- **Testy:** typecheck czysty; pełny Vitest 1409/1409. Sprawdzone wizualnie w przeglądarce (telefon 390 px).

## Wspólne — podpowiedź o przytrzymaniu „+” od pierwszego stuknięcia (faza 7 planu Notatek, 2026-10-19)

- **Co robi:** po pierwszym stuknięciu „+” na dolnym pasku pojawia się jednorazowy komunikat: „Przytrzymaj „+”, by od razu dodać listę, zdjęcie, rysunek albo dyktować”. Dawniej pokazywał się dopiero po czwartym stuknięciu, czyli często wcale.
- **Gdzie jest:** `src/components/BottomNav.tsx` — `hintOnce`.
- **Jak działa:** flaga `kaczy.fab.hint.v1` w localStorage ustawiana przy pierwszym pokazaniu. Licznik `kaczy.fab.taps` już nie jest używany (stary klucz zostaje w przeglądarkach, nic nie czyta). Ci, którzy już widzieli podpowiedź po czwartym stuknięciu, nie dostaną jej drugi raz.
- **Ograniczenia:** w trybie bez localStorage (prywatne okno) podpowiedzi nie ma — tak jak wcześniej. Komunikat wisi 6 s; w tym czasie kolejne stuknięcia go nie powtarzają.
- **Testy:** osobny skrypt z czystym profilem (`scratchpad/fab.mjs`): po pierwszym stuknięciu komunikat jest, po ponownym (po zniknięciu tostu) już nie. E2E `mobile`: 44/44. Vitest 1423/1423.
- **Commit:** 2cafa53, 2026-10-19.

## Budżet paczki startowej — próg 386 KB (decyzja właściciela, 2026-10-19)

- **Co zmieniono:** próg wejściowego JS (gzip) w `e2e/bundle.spec.ts` podniesiony z 385 do 386 KB.
- **Dlaczego:** po funkcjach Długów, pasku „+” i poprawkach pustych stanów paczka startowa ma 385,4 KB. Właściciel projektu zdecydował o podniesieniu progu zamiast przenoszenia arkusza „Nowa” do leniwego modułu.
- **Testy:** `e2e/bundle.spec.ts`: 6/6.
- **Commit:** edec40f, 2026-10-19.

## Wspólne — promień z tokenu `rounded-card` zamiast `rounded-2xl` (2026-10-19)

- **Co zmieniono:** 51 wystąpień `rounded-2xl` w 36 plikach `src` (bez testów) zamieniono na `rounded-card`.
- **Dlaczego:** token `--r-card` (`src/index.css`) to 1 rem we wszystkich stylach, tyle samo co `rounded-2xl`. Zmiana nie zmienia wyglądu, a promienie kart mają jedno źródło prawdy.
- **Testy:** Vitest 1424/1424, typecheck czysty, Chrome: promień kafla 16 px (30/30 sprawdzeń).
- **Commit:** 9b7f7b2, 2026-10-19.

## Dziś, Praca, Grafik — blok tytułowy widoku (B4, 2026-10-19)

- **Co robi:** na Dziś, Praca i Grafik nad treścią stoi tytuł h1 (font display, 3xl) i wiersz mono z dzisiejszą datą. Na Dziś dochodzi licznik notatek („2 notatki”). Pasek nagłówka na tych widokach nie pokazuje już nazwy widoku, żeby nie powielać tytułu.
- **Gdzie jest:** `src/components/ViewTitle.tsx` (`ViewTitle`, `isTitleBlockView`, lista `TITLE_BLOCK_VIEWS`), `src/pages/Index.tsx` (pierwsze dziecko `<main>`), `src/components/AppHeader.tsx` (h1 z klasą `hidden` na tych widokach).
- **Jak działa:** na tych trzech widokach jedyny widoczny h1 to blok tytułowy. Nagłówek go ukrywa (`hidden` usuwa też z drzewa dostępności), więc czytnik ekranu nie widzi dwóch nagłówków poziomu 1.
- **Decyzja:** B4 z planu wizualnego (`docs/plan-wizualny-2026-10-18.md`) zrobiony jako dom tytułu z datą. Nie dodano innych widoków.
- **Testy:** w Chrome (390 px): na /dzis, /praca, /grafik jeden widoczny h1 z właściwą nazwą i wiersz z datą. E2E `routes`, `shifts`: 32/33 (jeden test offline Grafiku niestabilny pod obciążeniem, przechodzi osobno).
- **Commit:** dada7f1, 2026-10-19.

## Przypomnienia — stan aktualny (terminy, serie, odłożenie, dymki, widok Terminy)

Dział opisany w jednym miejscu. Przypomnienie to termin na notatce; z jego zapisu liczą się wystąpienia, powiadomienia, push i widok Terminy.

### Co robi

- **Termin i powtarzanie** (`ReminderPicker`): godzina, dzień, powtarzanie (codziennie, tygodniowo, miesięcznie), koniec serii. Flaga „Cały dzień (o 9:00)” — zamiast godziny zapisuje się 9:00 wybranego dnia; na kaflu i w Terminach widać samą datę („dziś”, „jutro”, „25 paź”).
- **Seria zaległa** (np. aplikacja była zamknięta przez kilka cykli) odpala się RAZ. Dymek lub powiadomienie pokazuje „pominięto N”, a termin przesuwa się na najbliższy przyszły. Zabezpieczenie: najwyżej 1000 wystąpień wstecz.
- **Odłożenie** („Odłóż”, 10 minut, jutro o 9:00, +1 h) działa też dla serii i odkłada tylko jedno wystąpienie. Kolejne wystąpienia są od swojego terminu, nie od chwili odłożenia.
- **„Gotowe”:** przy każdym terminie w widoku Terminy; na serii kończy bieżące wystąpienie i przechodzi do następnego. Koniec serii albo zwykły termin zdejmuje przypomnienie. Cofnij przywraca termin, dzień serii i odłożenie.
- **„Jutro rano” i „+1 h”** nie przepisują dnia serii.
- **Widok Terminy:** grupy „Zaległe” / „Nadchodzące” z nagłówkami `<h2>`, osobna sekcja „W archiwum” na dole z wyszukiwaniem (nie wchodzi do grup ani licznika). Pusty widok ma przycisk „Nowa notatka”.
- **Zaległości:** licznik na pasku bocznym i w tytule karty liczy też terminy Pracy (ta sama lista co Terminy). Zaległy termin ma prefiks „Zaległe:” dla czytnika ekranu.
- **Fokus po akcji** (Gotowe, Jutro, +1 h, przesunięcie, usunięcie) przechodzi na sąsiedni kafel w grupie, a gdy go nie ma — na nagłówek grupy.

### Gdzie jest

- `src/lib/reminderSpec.ts` — `ReminderState` (w tym `reminderAllDay`, `reminderBase`), `REMINDER_FIELDS`, `specOf`, `readSpec`, `mergeSpec`, `projectReminder`. Całe przypomnienie to jedna wartość `reminderSpec` w Y.Map notatki.
- `src/lib/yjsStore.ts` — `readReminderState`, zapis w `applyPatch` i przy tworzeniu notatki, projekcja w `plainFromYNote`.
- `src/lib/reminderRepeat.ts` — `nextOccurrence(note, at)`, `snoozeTarget(note, at, now)`, `doneTarget`, `seriesDay`, `endOfDay(date)`.
- `src/lib/reminderOccurrences.ts` — `expandOccurrences` (przewija do `rangeStart`, limit `MAX_SKIP_STEPS`), `isNext` tylko dla zapisanego terminu, `Occurrence.allDay`.
- `src/lib/reminderDue.ts` — `planDueReminders` (czysta funkcja: co odpalić i ile pominięto), rejestr „już odpalone”, mapa `handled`.
- `src/hooks/useReminderNotifications.ts` — wykonuje efekty: dymki, powiadomienia, przesunięcie serii, `markDone`, `applyActionRef` (akcja z SW i z kolejki przy starcie).
- `src/components/ReminderDueToast.tsx` — dymek z „Odłóż” zawsze.
- `src/components/NoteCardBody.tsx` — przyciski terminu („Gotowe”, „Jutro”, „+1 h”), `focusAfterRemoval`.
- `src/components/ReminderPicker.tsx` — `ReminderBadge` (kolor, prefiks „Zaległe:”, `useReminderPassed`).
- `src/hooks/useReminderPassed.ts` — przełącza się przez `setTimeout` co najwyżej do terminu (dłuższe terminy w krokach, limit ok. 24,8 dnia).
- `src/lib/reminderAgenda.ts` — `snoozeTimes` (w tym `inHour`), `byReminderAsc` (jedno sortowanie dla Terminów i grup).
- `src/lib/reminderTime.ts` — `formatReminderShort(ts, now, allDay)`, `composeReminderTimestamp` (`null` dla godziny nieistniejącej w czasie letnim).
- `src/lib/push/schedule.ts` — harmonogram push; `push-server/core.js` (komentarz: „Odłóż” też dla serii).
- `src/lib/studyOverdueCount.ts` — mały store licznika zaległości Pracy; `src/components/review/StudyOverdueSync.tsx` — leniwy komponent bez wyglądu, który go zasila.
- `src/hooks/useOverdueBadge.ts` — drugi argument `extra` (zaległości spoza notatek).
- `src/pages/Index.tsx` — `reminderGroups`, `archivedRows`, `reminderRowCount`, sekcja „W archiwum”, `onNew`, przekazanie `reminderBase` do `updateNote`.
- `src/components/NoteGroupSection.tsx` — nagłówek grupy.

### Jak działa i dlaczego

- **Jeden zapis całego terminu** (`reminderSpec`, LWW): termin, powtarzanie, dzień serii, koniec, odłożenie i flaga dnia są jedną wartością, więc konflikt dwóch urządzeń nie zostawia mieszanki. Stare pola (`reminder`, `reminderRepeat`, `reminderDay`, `reminderRepeatUntil`) są dalej zapisywane tą samą wartością dla starszych odczytów. Odczyt: najpierw `reminderSpec`, gdy go nie ma — stare pola. Nic nie trzeba migrować.
- **Odłożenie** zapisuje `reminder` = odłożona chwila i `reminderBase` = termin serii, który zastępuje. Kolejne wystąpienia liczą się od bazy. Odłożona chwila zawsze wypada przed następnym terminem (`snoozeTarget` zastępuje ją zwykłym terminem, gdyby wypadała później). Zaległości: `snoozeTarget` przesuwa bazę na ostatnie minione wystąpienie.
- **Odpalenie** nie zależy od flagi dnia: przypomnienie idzie o zapisanej godzinie (9:00 dla „cały dzień”), w aplikacji i w push.
- **Cały dzień = 9:00, nie północ**, bo północ dzwoniłaby w nocy. Zaległość liczy się od 9:00.
- **Liczba z Pracy** w liczniku zawiera też serwis przypadający dziś — tak jak lista Terminów.
- **Zmiana terminu w kalendarzu** (przeciągnięcie, „Termin zapisany”) czyści odłożenie: to nowy termin serii.
- **Licznik i odznaka** przełączają się na „Zaległe” w chwili, gdy termin minie, nawet gdy lista notatek się nie zmienia.

### Ograniczenia i pułapki

- Kompozytor nowej notatki (`AddNoteBar`) nie ma pola „Cały dzień” — termin wymaga tam godziny. „Nowa notatka” z pustych Terminów otwiera zwykły kompozytor, nie kompozytor z terminem.
- Notatki zapisane przez starszą wersję nie mają `reminderSpec`, dopóki nie zostaną zmienione; konflikt całości obejmuje dopiero zmienione notatki.
- Liczba z Pracy jest liczona przy renderze; zmiana doby bez zmiany dziennika odświeża ją dopiero po zmianie danych.
- Każda odznaka z przyszłym terminem ma jeden `setTimeout`; odznaki bez terminu nie mają timera.
- Odznaka terminu ma 12 px i może zwiększyć wysokość kafla w wąskim kaflu — do sprawdzenia na telefonie.
- Wybór dnia, który już minął (np. 9:00 dziś po czasie), jest blokowany komunikatem jak przeszła godzina.
- Fokus po akcji wybiera pierwszy przycisk sąsiedniego kafla, a nie zawsze „Gotowe”.
- Brak e2e dla odłożenia serii i testu na telefonie.

### Testy

- `src/lib/reminderDue.test.ts` — na czas, zaległa seria, koniec serii, miesiąc z 31., rejestr, `handled`, brak terminu, odłożone wystąpienie odpala się raz.
- `src/lib/reminderRepeat.test.ts` — `nextOccurrence` i `snoozeTarget` (jednorazowa, seria, zaległe, seria zakończona).
- `src/lib/reminderSpec.test.ts` — zapis i odczyt, czyszczenie przy nowym terminie, flaga „cały dzień”.
- `src/lib/reminderTime.test.ts` — `formatReminderShort`, zmiana czasu (Europe/Warsaw).
- `src/lib/reminderAgenda.test.ts`, `src/lib/reminderOccurrences.test.ts`.
- `src/lib/yjsStore.reminder.test.ts` — dwa dokumenty: równoległa zmiana terminu i powtarzania daje jedną całość; baza wraca po synchronizacji; flaga przez dwa dokumenty.
- `src/hooks/useOverdueBadge.test.ts`, `src/hooks/useReminderPassed.test.ts`.
- `src/components/ReminderDueToast.tsx` — testy istniejące, bez zmian.
- E2E: `reminder-toast`, `reminders-calendar`, `reminders-agenda`, `reminders-phase2` (Gotowe, pusty widok Terminów). Pełny przebieg chromium ostatnio na 2026-10-20 (391/391 przed kolejnymi zmianami); od tego czasu nie uruchamiany.

### Commity

- `a235912` (2026-10-19) — przypomnienie na cały dzień (P6).
- `831ab76` (2026-10-19) — cały termin w jednym zapisie `reminderSpec` (C3).
- `0d6e497` (2026-10-19) — jedno odpalenie zaległej serii (krok 1).
- `3c07051` (2026-10-19) — odłożenie jednego wystąpienia serii (P3).
- `0ae3808` (2026-10-20) — faza 1 planu (grupy, dotyk, „+1 h”).
- `018d791` (2026-10-20) — dokończenie fazy 1 („Nowa notatka”, odświeżany termin, odznaka 12 px).
- `ebe2567` (2026-10-20) — fazy 2–3 wg decyzji D1–D4 („Gotowe” przy każdym terminie, archiwum, licznik Pracy).

## Terminy — jedna definicja zaległych, archiwum liczone (krok 2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** licznik zaległych przy tytule karty i ikonie, widok Terminy oraz „Dziś” liczą terminy tą samą funkcją. Przypomnienia z archiwum są liczone jak reszta: pojawiają się w „Zaległe” i w „Dziś”, bo nadal dzwonią. Kosz nie jest liczony.
- **Gdzie jest:** `src/lib/dueTerms.ts` (`termStatus`, `endOfDay`: zaległy / dziś / najbliższe 7 dni / później), `src/lib/reminderAgenda.ts` (`groupReminders`, `countOverdue` korzystają z `termStatus`), `src/pages/Index.tsx` (licznik i „Dziś” dostają `reminderNotes`, Terminy dostają `others` plus archiwum), `src/components/review/TodayDueList.tsx` (pomija tylko kosz).
- **Decyzje:** archiwum liczone (potwierdzone przez właściciela); Terminy z Praca tylko do odczytu z linkiem do budowy (potwierdzone, jeszcze niezrobione — krok 3).
- **Czego nie ujednolicono:** harmonogram push (`src/lib/push/schedule.ts`) liczy tylko przyszłość, bo wysyła przypomnienia, a nie zaległości. Parytet z licznikiem byłby mylący, więc nie jest testowany.
- **Testy:** `src/lib/dueTerms.test.ts` (granice dnia i tygodnia), `TodayDueList.test.tsx` (archiwum widoczne, kosz nie). E2E `reminders-agenda`, `reminders-calendar`, `reminder-toast`, `today-study`: 18/18. Vitest 1441/1441. Typecheck czysty.
- **Commit:** 01b7589, 2026-10-19.

## Terminy z Praca — serwis, zamówienia, problemy na Dziś i w Terminach (krok 3 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** na Dziś i w widoku Terminy pojawia się sekcja „Praca” z trzema rodzajami terminów: serwis należny dziś lub zaległy, zamówienie bez dostawy ponad 3 dni, otwarte problemy ponad 3 dni. Wiersze są tylko do odczytu; przycisk „Otwórz Pracę” przenosi do działu. Protokół próby nie jest terminem i się tu nie pojawia.
- **Gdzie jest:** `src/lib/study/dueRows.ts` (`studyDueRows`: przypomnienia Pracy → wiersze), `src/components/review/StudyDueRows.tsx` (komponent; ładowany leniwie z `Index.tsx` w dwóch miejscach: Dziś i Terminy; czeka na gotowość danych Praca i nic nie pokazuje bez wierszy; subskrybuje `useDayClock()`, więc terminy „na dziś” przechodzą na listę po północy), `src/pages/Index.tsx` (lazy import, blok „Dziś” jako fragment).
- **Dlaczego leniwie:** dane Praca (dziennik, budowy, listy) nie mogą wejść do paczki startowej. Komponent korzysta z `useStudy`, więc jest w osobnym chunku.
- **Budżet:** po tej zmianie wejściowy JS to 395 319 B gzip przy progu 395 264 B (386 KB) — przekroczenie 55 B. Test `e2e/bundle.spec.ts` jest czerwony do decyzji właściciela: podniesienie progu do 387 KB albo znalezienie 55 B w kodzie. Próg nie został zmieniony.
- **Testy:** `src/lib/study/dueRows.test.ts` (4: mapowanie serwisu, zamówienia i problemów; brak protokołu; liczba problemów po polsku), `src/components/review/StudyDueRows.test.tsx` (3: brak wierszy, serwis z przyciskiem do Pracy, zamówienie). E2E `site-service`, `reminders-agenda`, `today-study`, `site-shortages`: 5/5. Vitest 1448/1448. Typecheck czysty.
- **Nieobjęte:** zaległy serwis nie dostaje push (T5 z planu, do zrobienia osobno); brak zapisu „załatwione” w Terminach (wyjaśnione: tylko odczyt).
- **Commit:** 8b6bd21, 2026-10-19.

## Push — zaległa wizyta serwisowa dostaje przypomnienie rano następnego dnia (krok T5 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** wizyta serwisowa nadal otwarta (bez „załatwione”) dostaje przypomnienie push rano dnia wizyty, jak dotąd, a jeśli nadal jest otwarta — także rano dnia następnego, z tytułem „Serwis zaległy: <budowa>”. Zamknięta wizyta nie dostaje nic. Przypomnienie z poranka dnia następnego, które już minęło, nie jest wysyłane.
- **Gdzie jest:** `src/lib/push/schedule.ts` (`studyItems`, gałąź serwisu).
- **Klucze:** zaległe przypomnienie ma klucz `v:<id>:<termin>+1`, żeby nie zostało uznane za duplikat porannego. Format klucza w `src/lib/push/shown.ts` bez zmian.
- **Jak działa:** harmonogram push jest wysyłany w całości przy każdej zmianie i co godzinę. Zamknięcie wizyty usuwa więc też jej jutrzejsze przypomnienie, bez osobnej logiki.
- **Budżet:** `schedule.ts` jest ładowany leniwie (PushScheduleSync, DailyReportNudge, client), więc nie zmienia paczki startowej. Próg wciąż czeka na decyzję (patrz krok 3).
- **Testy:** `src/lib/push/schedule.service.test.ts` (3: wizyta dziś z jutrzejszym zaległym, wizyta z wczoraj, wizyta z przedwczoraj nie wysyłana, zamknięta nie wysyłana). `src/lib/study/service.test.ts`: oczekiwania zaktualizowane do nowego zachowania. Vitest 1452/1452. E2E `push`: przechodzi; `site-service`: jeden test niestabilny pod obciążeniem (przy ponownym uruchomieniu przechodzi dwa razy).
- **Commit:** 3dd2544, 2026-10-19.

## Budżet paczki startowej — próg 388 KB (decyzja właściciela, 2026-10-19)

- **Co zmieniono:** próg wejściowego JS (gzip) w `e2e/bundle.spec.ts` podniesiony z 387 do 388 KB.
- **Dlaczego:** po raporcie pominiętych załączników w oknie przywracania paczka startowa ma 396 282 B (387,0 KB), czyli 6 B zapasu przy progu 387 KB. Właściciel zdecydował o podniesieniu progu, żeby kolejne zmiany (P6, T4) miały miejsce.
- **Testy:** `e2e/bundle.spec.ts`: 6/6.
- **Commit:** 647f312 (próg 387 KB), podniesienie do 388 KB — w commicie z tym wpisem, 2026-10-19.

## Push — limit 200 z priorytetem i licznikiem w Ustawieniach (P4 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** serwer przyjmuje do 200 pozycji harmonogramu. Gdy jest ich więcej, pierwszeństwo mają przypomnienia z notatek, potem Praca (serwis, zamówienia, problemy), na końcu Grafik i raporty. W Ustawieniach → Powiadomienia pod statusem pokazuje się „Serwer przyjmuje do 200 przypomnień: wysłano N z M”. Gdy coś odpadło, dopisane jest ostrzeżenie w kolorze ostrzegawczym.
- **Gdzie jest:** `src/lib/push/schedule.ts` (`buildPushSchedulePlan`: `items`, `total`, `dropped`; `buildPushSchedule` zwraca `items` jak dotąd), `src/lib/push/summary.ts` (klucz `kaczy.push.summary.v1` w localStorage tego urządzenia, odczyt `readPushSummary`), `src/components/PushScheduleSync.tsx` (zapis podsumowania przy każdym wysłaniu), `src/components/settings/PushSettings.tsx` (wiersz z limitem).
- **Dlaczego priorytety:** przy kilku seriach dziennych zjadały limit i późniejsze serwisy przepadały bez śladu. Teraz przepadają najmniej ważne rodzaje, a użytkownik to widzi.
- **Ograniczenia:** podsumowanie jest lokalne dla urządzenia i pojawia się po pierwszym wysłaniu harmonogramu. Liczy tylko wysłane z tego urządzenia.
- **Testy:** `src/lib/push/schedule.limit.test.ts` (3: w limicie nic nie odpada; nad limitem odpada najpóźniejsze; notatki wypierają serwis z Praca), `src/lib/push/summary.test.ts` (2). E2E `push`, `bundle`: 8/8. Vitest 1457/1457. Typecheck czysty.
- **Commit:** a00bb21, 2026-10-19.

## Terminy — „Przegapione” dla zaległych starszych niż godzina (P5 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w widoku Terminy i na liście Dziś zaległe przypomnienia starsze niż godzina trafiają do osobnej grupy „Przegapione”. Zaległe z ostatniej godziny zostają w „Zaległe”. Powód: serwer push odrzuca spóźnienie powyżej godziny, więc takich przypomnień już nie dośle.
- **Co się nie zmieniło:** w aplikacji przypomnienie dalej odpala się, gdy jest otwarta; licznik w pasku bocznym i znaczku liczy obie grupy razem.
- **Gdzie jest:** `src/lib/reminderAgenda.ts` (`MISSED_AFTER_MS`, grupa `missed` w `groupReminders`), `src/components/review/TodayDueList.tsx` (grupa na liście Dziś, ton alarmowy), `src/pages/Index.tsx` (ton nagłówka grupy w Terminach).
- **Testy:** `src/lib/reminderAgenda.test.ts` (nowy: granica godziny; oczekiwania zmienione na „Przegapione”), `src/components/review/TodayDueList.test.tsx` (zaktualizowane), `e2e/reminder-toast.spec.ts` (akceptuje obie nazwy grupy). E2E `reminders-agenda`, `today-study`, `reminder-toast`: 9/9 po zmianach. Vitest 1458/1458. Budżet: w progu.
- **Commit:** 62eb749, 2026-10-19.

## E2E — stabilność przy pełnym obciążeniu (punkt 1, 2026-10-19)

- **Co zmieniono:** limit testu w `playwright.config.ts` podniesiony do 60 s (pierwszy `goto` w `beforeEach` na obciążonym przebiegu przekraczał 30 s); asercja „bez internetu” w `e2e/shifts.spec.ts` ma limit 15 s.
- **Dlaczego:** trzy testy (skrzynka, tryb budowa na iPhonie, Grafik offline) padały tylko w pełnym przebiegu i przechodziły przy ponownym uruchomieniu.
- **Stan weryfikacji:** pełny przebieg e2e nie został dotąd zakończony bez przerwania (brak pamięci). Zmiany sprawdzone osobno: `shifts`, `routes` i powiązane specy przechodzą.
- **Commit:** bdba60c, 2026-10-19.

## Kalendarz — stan aktualny (siatka, dzień, oś godzin, skróty, wydruk, eksport)

Dział opisany w jednym miejscu. Kalendarz pokazuje terminy przypomnień (`reminderSpec`), znaczniki dnia z Pracy i zmiany z Grafiku.

### Co robi

- **Siatka miesiąca** (`MonthGrid`, `DayCell`): dzień z terminami; dzień z wizytą serwisową albo dostawą ma ikonę kasku z liczbą (np. „2”), a dla czytnika „Praca: 2 wizyty, 1 dostawa”. Tylko odczyt. Przycisk „Dziś” wraca do bieżącego dnia (także gdy wybrany dzień to nie dziś, „Dziś” jest widoczne w miesiącu).
- **Panel dnia** (`DayPanel`): przełącznik „Lista | Oś godzin” (lista domyślna, wybór zapamiętany w `kaczy.calendar.dayView`). Panel pokazuje zmianę z Grafiku, linię Pracy (wizyty i dostawy), terminy i przycisk pominięcia wystąpienia serii.
- **Oś godzin** (`DayTimeline`): wiersze po godzinach od 07:00; pasek zmiany z Grafiku w lewej kolumnie (przerwa jaśniejsza), każdy termin w swojej godzinie z dokładnym czasem. Terminy „cały dzień” nad osią.
- **Dialog terminu** (`ReminderQuickAddDialog`): tytuł, dzień, godzina, powtarzanie, „Cały dzień” (termin na 9:00, godziny nie widać). W edycji pole „Dzień” przenosi termin (także serię). Etykieta podaje godzinę i powtarzanie.
- **Skróty:** Ctrl+Enter (⌘+Enter na Macu) z dowolnego pola okna tworzy notatkę z terminem, a w edycji zapisuje termin. Zwykły Enter w polu tekstu działa jak dotąd. Przycisk ma `aria-keyshortcuts`.
- **Prognoza serii:** pusty krąg; zapisany termin — pełna kropka. Klik w termin otwiera edycję; Shift+←/→ przesuwa o dzień.
- **Wydruk** („Drukuj” w nagłówku): lista terminów bieżącego miesiąca dzień po dniu, z oznaczeniem prognozy serii tekstem. Wydruk nie zawiera Pracy.
- **Telefon:** przełącznik „Miesiąc / Tydzień”; tydzień pokazuje pasek 7 dni (`WeekStrip`). Wybór nie jest zapamiętywany między wejściami.
- **Eksport `.ics`** z listy: `UNTIL` ma ten sam typ co `DTSTART` (lokalny, bez „Z”), zgodnie z RFC 5545.

### Gdzie jest

- `src/components/calendar/ReminderCalendarView.tsx` — widok: `handleSkip` (komunikat końca serii), `previousOf` (cofnięcie z odłożeniem i `allDay`), `moveToDay` (odmowa przy nieistniejącej godzinie), `focusDay`, `studyMarks`, przełącznik `phoneView`, przycisk „Drukuj”, `PrintRoot`.
- `src/components/calendar/MonthGrid.tsx` (prop `studyOf`), `src/components/calendar/DayCell.tsx` (ikona, `studySummary` w `aria-label`, `data-day-key`, kształt kropki).
- `src/components/calendar/DayPanel.tsx` — linia Pracy, przycisk pominięcia, `readDayView` / `writeDayView`, etykieta edycji.
- `src/components/calendar/DayTimeline.tsx` — oś, `TimelineItem`. `src/lib/dayTimeline.ts` — `shiftPieces`, `timelineHours`, `hourBackground`, `minutesOfDay` (czysta logika).
- `src/components/calendar/ReminderQuickAddDialog.tsx` — dialog, `allDay` w stanie, `handleShortcut` na `ResponsiveDialogContent`.
- `src/components/calendar/WeekStrip.tsx` — widok tygodnia na telefonie.
- `src/components/calendar/CalendarPrintList.tsx` — lista wydruku.
- `src/components/calendar/useStudyDayMarks.ts` — hook: czeka na `studyReady`, potem liczy znaczniki.
- `src/lib/study/calendarMarks.ts` — `studyDayMarks`, `StudyDayMarks`, `studySummary`. Wizyta to otwarte zgłoszenie z terminem `due`; dostawa to pozycja „zamówione” z `due`. Budowy w archiwum są pomijane.
- `src/lib/reminderOccurrences.ts`, `src/lib/reminderTime.ts`, `src/lib/icsExport.ts` (`eventLines`, `UNTIL` przez `formatLocal`), `src/lib/dueTerms.ts` (`endOfDay` nakładka na `reminderRepeat.ts`).
- `src/pages/Index.tsx` — kalendarz dostaje `reminderNotes` (stała tablica), `onCreateNote` i `onSetReminder` z `reminderAllDay`.

### Jak działa i dlaczego

- **Znaczniki Pracy są w osobnym module**, który ładuje się leniwie: `useStudyDayMarks` wciąga store Pracy do paczki kalendarza, a nie do startowej. Do gotowości dokumentu kalendarz pokazuje brak znaczników i przelicza się po wczytaniu.
- **Zakres osi** to co najmniej 7–21 i rozszerza się, gdy zmiana albo termin wychodzi poza przedział (w granicach doby). Pasek zmiany to gradient CSS w każdym wierszu, więc wiersz może rosnąć od wielu terminów bez przesunięć paska.
- **Oś ma sens tylko dla zmiany** (ma godziny). Przypomnienie zostaje punktem, a nie blokiem. Lista zostaje domyślna, bo tam są eksport `.ics` i opisy prognoz. Przerwa i pasek korzystają z `shiftSpan` / `breakOffset` z `lib/shifts/time.ts`, więc są spójne z eksportem i sumą godzin. Urlop nie ma paska.
- **Zmiana czasu:** godzina z przeskoku wiosennego (np. 02:30) jest odrzucana (`composeReminderTimestamp` zwraca `null`), pokazany jest komunikat; przeniesienie na taki dzień nie przesuwa po cichu.
- **Seria zapisana dawno temu** (>400 kroków wstecz) pokazuje się w bieżącym miesiącu: `expandOccurrences` przewija do `rangeStart`.
- **Skrót nie zapisuje**, gdy godzina jest niepoprawna, a przy dodawaniu wymaga tytułu.

### Ograniczenia i pułapki

- Znaczniki Pracy są tylko w siatce miesiąca; widok tygodnia (`WeekStrip`) i „najbliższe dni” (`UpcomingDays`) ich nie pokazują.
- Zmiana przez północ rysuje się na osi tylko do 24:00. Przerwa bez godziny (`breakAt`) nie ma miejsca na osi — zmiana rysuje się jako jeden odcinek.
- Oś nie pokazuje minut na skali; dokładny czas jest w tekście terminu.
- Podpowiedzi skrótów nie są widoczne w interfejsie (tylko `aria-keyshortcuts` i zachowanie).
- Szerokość komórki na 320 px to ok. 42 px, poniżej 44 px; pełne 44 px wymaga zmiany układu.
- Wydruk na papierze: prognozy oznaczone tekstem.
- Nie zrobione: całodniowe w dialogu przy tworzeniu z kompozytora, scalenie duplikatów, historia serii (decyzja właściciela).

### Testy

- `src/lib/study/calendarMarks.test.ts` — liczenie po dniach, otwarte/zamknięte, dostawa po dacie, archiwum.
- `src/lib/dayTimeline.test.ts` — odcinki zmiany, przerwa, urlop, zakres osi, gradient, minuty.
- `src/lib/reminderOccurrences.test.ts` — „cały dzień”, „seria zapisana dawno temu”, `isNext`.
- `src/lib/reminderTime.test.ts` — zmiana czasu (Europe/Warsaw).
- `src/lib/icsExport.test.ts` — `UNTIL` tego samego typu co `DTSTART`.
- `src/components/calendar/CalendarPrintList.test.tsx` — wydruk: godzina, „cały dzień”, prognoza, pusty miesiąc.
- E2E: `reminders-calendar` (w tym Ctrl+Enter), `reminders-agenda`, `day-timeline` (360 px bez poziomego przewijania), `calendar-phase1` (pole „Dzień”), `calendar-phase2` (Cały dzień, przełącznik na 375 px). Od zmian z 2026-10-20 nieuruchamiane.

### Paczka

- Kalendarz jest leniwy. Próg paczki startowej w `e2e/bundle.spec.ts` to 393 KB (eager); ostatni pomiar 392,4 KB.

### Commity

- `42e1c83` (2026-10-19) — znaczniki Pracy w komórkach (K2).
- `0236f73` (2026-10-19) — poprawka typu `ToggleGroup` w `DayPanel`.
- `K1` — widok dnia z osią godzin (2026-10-19; hash w commicie z tym wpisem).
- `19f2ade` (2026-10-19) — skróty w oknie terminu (K3).
- `518871f` (2026-10-20) — fazy 1 i 2 planu.
- `11ef99f` (2026-10-20) — fazy 2d, 2f, 3a, 3b.

## Terminy — prognoza serii w „Najbliższe 7 dni” (T2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w widoku Terminy, pod grupami, jest blok „Prognoza serii (najbliższe 7 dni)” — jeden wiersz na powtarzalne przypomnienie z liczbą jego kolejnych wystąpień w tym tygodniu, np. „+4 wystąpienia (prognoza)”. Wiersze są tylko do odczytu.
- **Gdzie jest:** `src/lib/reminderForecast.ts` (`weekSeriesForecasts`, typ `SeriesForecast`), `src/components/calendar/SeriesForecastSection.tsx` (sekcja, ładowana leniwie z `Index.tsx`), `src/components/calendar/SeriesForecastRows.tsx` (`SeriesForecastRows`), `src/pages/Index.tsx` (`SeriesForecastSection` po grupach w widoku `reminders`).
- **Jak działa:** zapisany jest tylko najbliższy termin, więc kolejne wystąpienia liczy `expandOccurrences` (`src/lib/reminderOccurrences.ts`) w oknie od końca dziś +1 ms do końca dnia +7 — ten sam przedział co grupa „Najbliższe 7 dni”. Liczone są wyłącznie wystąpienia z `isSeries && !isNext`, czyli te, których nie ma w danych. Kosz jest pomijany, archiwum nie. Kolejność wierszy: wg pierwszego wystąpienia w oknie.
- **Paczka:** pierwsza wersja trzymała `weekSeriesForecasts` w `reminderAgenda.ts`, co wciągało rozwijanie wystąpień do paczki startowej (przekroczenie budżetu o ok. 0,6 KB). Przeniesione do `reminderForecast.ts`, a sekcja jest leniwa.
- **Decyzja:** blok stoi pod grupami, a nie w grupie „Najbliższe 7 dni”. Seria zaległa (zapisany termin w „Zaległe”), która ma wystąpienia w tym tygodniu, nie trafia do żadnej grupy „Najbliższe 7 dni”, więc wiersz w grupie by zniknął, gdyby tej grupy nie było.
- **Ograniczenie:** `now` w memo to czas ostatniego przeliczenia (zależności: widok i lista notatek); otwarty widok przez północ może pokazać prognozę o dzień starą, do najbliższej zmiany listy. Prognoza nie ma akcji (edycja tylko dla zapisanego terminu).
- **Testy:** `src/lib/reminderAgenda.test.ts` (`weekSeriesForecasts`: zaległa seria 7 wystąpień, seria od jutra 6, jednorazowe pominięte, seria poza oknem i kosz). Vitest 1489/1489 po wszystkich krokach.
- **Commit:** 392f197, 2026-10-19.

## Kopia zapasowa — pliki budów osobno od zdjęć dziennika (D3, 2026-10-19)

- **Co robi:** raport kopii rozdziela pominięte bajty na trzy kategorie: załączniki notatek, zdjęcia dziennika i pliki budów (plany, PDF). Toast po zapisie kopii podaje każdą kategorię osobno. Plan nie jest już nazywany zdjęciem dziennika.
- **Gdzie:** `src/lib/study/journalRefs.ts` (`siteDocRefsIn`), `src/lib/exportNotes.ts` (`collectAttachmentBlobs`, `describeSkippedAttachments`, pole `siteDocs` w `BackupAttachmentReport`, opcja `attachmentBudget` w `buildFullBackupWithReport`).
- **Jak działa:** `collectAttachmentBlobs` bierze budżet z opcji (domyślnie `BACKUP_ATTACHMENTS_BUDGET_BYTES`, 40 MB). Każdy pominięty bajt z dziennika albo z kart budów liczy się w swojej kategorii; klucze dokumentów budów wyznacza `siteDocRefsIn` z `studySiteItems`.
- **Okno przywracania:** liczby pominięte przy eksporcie zapisują się w pliku jako `skipped` (`BackupSkipped` w `src/lib/noteSchema.ts`, pole opcjonalne, bez treści; zawsze cztery liczby, zera, gdy nic nie pominięto — dzięki temu w `exportNotes.ts` nie ma gałęzi, a paczka startowa mieści się w budżecie 388 KB). Okno „Przywrócić ten backup?” pokazuje je jako zdanie `describeBackupSkipped` (`src/lib/backupSkipped.ts`, moduł tylko dla okna Ustawień, żeby nie wchodził do paczki startowej) nad listą sekcji (`data-testid=restore-skipped`), żeby było widać, czego w pliku nie ma. Starsze pliki bez pola: brak zdania.
- **Ograniczenie:** `skipped` to liczby z chwili eksportu. Przywrócenie nie odzyskuje pominiętych zdjęć — tylko je nazywa.
- **Testy:** `src/lib/fullBackup.test.ts` — przekroczenie budżetu (`attachmentBudget: 0`) rozdziela załącznik, zdjęcie dziennika i plan oraz składa komunikat; bez przekroczenia plan wchodzi do kopii i nie jest raportowany. Vitest 1469/1469, typecheck czysty.
- **Commit:** 6a97a92 (kod), testy budżetu — w commicie z tym wpisem, 2026-10-19; okno przywracania z `skipped` — 5fa3fbd, 2026-10-19.

## Ustawienia — stan aktualny (okno, karty, reset, linki, zgoda na dyktowanie)

Dział opisany w jednym miejscu; obejmuje fazy 1–3 planu z 2026-10-19 i zgodę na dyktowanie z 2026-10-20.

### Co robi

- **Okno Ustawień** ma cztery karty: **Wygląd**, **Ogólne**, **Kopia i dane**, **Sync**. Na telefonie zakładki zawijają się na wiele wierszy.
  - **Wygląd:** motyw i skórka, efekty i zabawa (`EffectsSettings`), globalny reset.
  - **Ogólne:** edytor (autosave), przypomnienia „Dziś” i „Ten tydzień” (obok przeglądu tygodnia), sekcja „Praca i Grafik” z przyciskiem „Ustawienia Grafiku” (`ShiftSettingsDialog`), sekcja „Dyktowanie głosem”.
  - **Kopia i dane:** kopia zapasowa, przypomnienie o kopii (mierzy czas od ostatniej kopii), automatyczne kopie.
  - **Sync:** parowanie urządzeń, kody, „Zapomnij”, synchronizacja przez plik (`SyncFileSection`).
- **Opis okna** nie obiecuje, że wszystko działa tylko w tej przeglądarce.
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

## Ćwiczenia — stan aktualny (odżywki, dieta, trening)

Dział opisany w jednym miejscu; zmiany z przeglądu L1–L20 są już uwzględnione.

### Co robi

- **Wejście.** Osobna pozycja „Ćwiczenia” w menu, na pasku dolnym (w „Więcej”), w palecie poleceń i w pasku bocznym.
- **Odżywki** (karta na górze). Lista pogrupowana rano / w ciągu dnia / wieczorem; każdą pozycję odhacza się na dziś (licznik „dziś N z M”).
  Pusta lista ma przycisk „Dodaj kreatynę (rano, 1 łyżka)”, który od razu tworzy przypomnienie o 7:30.
  Formularz: nazwa, dawka, pora, „Przypominaj codziennie o” z godziną (domyślnie 7:30 / 12:00 / 20:00 wg pory).
  Usunięcie z „Cofnij”, które przywraca odżywkę i jej przypomnienie z kosza.
- **Trening** (karta, nad dietą):
  - **Plan dni:** lista dni z ćwiczeniami i celem (np. „Klatka · 3 × 10”). Dodawanie: nazwa, ćwiczenia z katalogu (do 12), cel serii i powtórek. Usuwanie z „Cofnij”.
  - **Zapis treningu:** wybór ćwiczenia z katalogu (pogrupowane: klatka, biceps, triceps), wskazówka wykonania, 3 serie na start (do 30).
    Każda seria: powtórki (całkowite, 1–100) i ciężar w kg (co 0,5, opcjonalny). Uwagi do 200 znaków. Zapis w bieżącej godzinie, dziś.
  - **Wybór dnia planu** nad formularzem: ustawia pierwsze ćwiczenie dnia i tyle serii, ile zaplanowano, z celem powtórek.
  - **Przerwa:** po zapisie serii licznik 1:30 („Pomiń” kończy wcześniej). Na końcu krótka wibracja (`haptic("success")`).
  - **Sprzęt:** największy ciężar hantli (kg). Ciężar powyżej tego limitu w ćwiczeniu z hantlami pokazuje ostrzeżenie (zapis nadal możliwy).
    „Usuń limit” czyści ustawienie. Zapis wymaga wartości > 0.
  - **Wykres progresu:** przy ćwiczeniu z co najmniej dwiema sesjami z ciężarem — sparklajn (SVG) rekordów kolejnych sesji.
  - **Przypomnienie o treningu:** pole wyboru i godzina (domyślnie 18:00, okno do 20:00). Tworzy notatkę z dziennym powtarzaniem.
  - **Podpowiedź:** „Ostatnio (DD.MM): 10×20 kg, 8×22 kg” i przycisk „Użyj ostatnich”, który wypełnia serie.
  - **Dziś:** dzisiejsze wpisy z sumą serii i objętością (suma powtórek × kg).
  - **Progres:** per ćwiczenie — rekord ciężaru (kg, dzień) i liczba sesji.
  - Katalog startowy: klatka (wyciskanie hantli na płaskiej i skosie, rozpiętki), biceps (uginanie ze sztangielkami, młotkowe, na ławce skośnej), triceps (wyprost nad głową, w opadzie, prostowanie leżąc). Treść wskazówek do sprawdzenia przez właściciela.
- **Dieta** (karta na dole):
  - **Dziś:** suma kcal i białka z dzisiejszych posiłków, z celem (jeśli ustawiony) i liczbą posiłków bez wartości.
  - **Lista posiłków dnia** wg godziny. Usuwanie z „Cofnij”.
  - **Dodawanie:** opis, godzina (domyślnie teraz), kalorie i białko (oba opcjonalne). Nie-liczba lub wartość poza zakresem blokuje przycisk i oznacza pole.
  - **Cele dzienne:** kcal i białko, puste = bez celu.
  - **Ostatnie 7 dni:** dzień (DD.MM), suma kcal i białka; dni bez posiłków to „—”.

### Gdzie jest

- **Odżywki:**
  - `src/lib/supplements/model.ts` — `Supplement`, `SupplementWhen`, `cleanSupplement` (wejście z dokumentu, kopii i peera), `logKey` / `parseLogKey` (klucz `dzień|id`), `bySupplementOrder`.
  - `src/lib/timeOfDay.ts` — `nextReminderAt(hhmm, now)`: najbliższy moment „HH:MM” (dziś, a jeśli minął — jutro). Wspólne dla Odżywek i Treningu.
  - `src/lib/supplements/ySupplements.ts` — `createYSupplements(doc)`: mapy Y `supplements` (id → odżywka) i `supplementLog` (`dzień|id` → true), origin `SUPPLEMENTS_ORIGIN`, `dump()` / `mergeSupplementDump`.
  - `src/lib/supplements/store.ts` — `useSupplements()`, `useSupplementsTaken()`, `addSupplement`, `removeSupplement`, `restoreSupplement`, `setSupplementTaken`, `supplementDump`, `mergeSupplementDump`.
  - `src/components/cwiczenia/CwiczeniaView.tsx` — widok, `createSupplement` (odżywka + notatka-przypomnienie), `deleteSupplement`, `removeWithUndo`, `AddSupplementForm`.
- **Dieta:**
  - `src/lib/diet/model.ts` — `Meal`, `DietGoals`, `cleanMeal`, `cleanGoals`, `cleanAmount`, `byMealOrder`, `summarizeDay`, `summarizeRange(meals, endDay, days, addDays)` (funkcja dat wstrzykiwana, model czysty).
  - `src/lib/diet/yDiet.ts` — `createYDiet(doc)`: mapa `dietMeals` (id → posiłek), `dietMeta` (`goals`), origin `DIET_ORIGIN`. `getGoals()` zwraca zamrożony obiekt z cache (stabilny dla `useSyncExternalStore`). `restore` pilnuje limitu `DIET_MAX_MEALS` (ponad limit posiłek nie wchodzi, zwraca `false`).
  - `src/lib/diet/store.ts` — `useMeals()`, `useDietGoals()`, `addMeal`, `removeMeal`, `restoreMeal`, `setDietGoals`, `dietDump`, `mergeDietDump`.
  - `src/components/cwiczenia/DietSection.tsx` — sekcja (podsumowanie, lista, formularze, tydzień).
- **Trening:**
  - `src/lib/training/catalog.ts` — `EXERCISES`, `MUSCLE_GROUPS`, `exerciseById`, `isKnownExercise`.
  - `src/lib/training/model.ts` — `TrainingSet`, `TrainingEntry`, `PlanDay`, `TrainingReminder`, `TrainingEquipment`, `cleanKg`, `cleanSet`, `cleanEntry`, `cleanPlanDay`, `cleanTrainingReminder`, `cleanEquipment`, `overDumbbell`, `bestKg`, `bestKgSeries`, `volumeOf`, `byTrainingTime`, `progressByExercise`, `planLine`.
  - `src/lib/training/yTraining.ts` — `createYTraining(doc)`: mapy `trainingLog` (id → wpis) i `trainingPlans` (id → plan); meta `reminder` i `equipment` (typ `unknown`, odczyt przez `metaSnapshot` z cache). Origin `TRAINING_ORIGIN`. `setReminder` czyści przez `cleanTrainingReminder`. `mergeDump(raw, hasNote?)`.
  - `src/lib/training/store.ts` — `useTrainingEntries()`, `useTrainingPlans()`, `addTrainingEntry`, `removeTrainingEntry`, `restoreTrainingEntry`, `addPlanDay`, `removePlanDay`, `restorePlanDay`, `trainingDump`, `mergeTrainingDump(raw, hasNote?)`.
  - `src/components/cwiczenia/TrainingSection.tsx` — karta: `TrainingReminderControl`, `EquipmentForm`, `LogForm`, `RestTimer` (`REST_SECONDS` = 90), `ProgressList` ze `Sparkline`, formularz planu.
- **Kopia:** `src/lib/noteSchema.ts` (pola `supplements`, `diet`, `training` w `fullBackupSchema`, zod z `.catch(undefined)`), `src/lib/exportNotes.ts` (zapis w `buildFullBackupWithReport`, scalanie w `restoreFullBackup`; oba przez dynamiczny import, żeby nie dokładać do paczki startowej).
- **Podłączenie działu:** `src/hooks/useFilteredNotes.ts` (typ `View`), `src/hooks/useSelectionGestures.ts`, `src/lib/viewRoute.ts` (`/cwiczenia`), `src/components/sidebar/sidebarItems.ts`, `src/components/BottomNav.tsx`, `src/components/CommandPalette.tsx`, `src/components/AppHeader.tsx`, `src/components/EmptyState.tsx`, `src/pages/Index.tsx` (leniwy import, render w `ViewErrorBoundary`).

### Jak działa i dlaczego

- **Dane w Yjs.** Wszystkie trzy części są w tym samym dokumencie co notatki: działają synchronizacja, kopia i plik. Każda odżywka, posiłek, wpis treningu i plan to osobny klucz mapy, więc dwa telefony dopisujące różne pozycje scalają się bez strat. Zapis i odczyt przechodzą przez `clean*`; zła wartość nie wejdzie do dokumentu.
- **Odhaczenia.** Odhaczenie to wpis `dzień|id`. Odznaczenie kasuje wpis; usunięcie odżywki kasuje wszystkie jej odhaczenia w tej samej transakcji.
- **Przypomnienie (odżywki i trening).** To zwykła notatka z `reminder` o najbliższej godzinie i `reminderRepeat: "daily"` — ten sam mechanizm co Przypomnienia (powiadomienia, „Dziś”, serie). Id notatki zapisane w odżywce (`reminderNoteId`), żeby usunięcie odżywki mogło przenieść przypomnienie do kosza. Zapis odrzucony (np. pełna lista) sprząta świeżo utworzoną notatkę. Zmiana godziny lub wyłączenie treningu sprząta poprzednią notatkę.
- **Rekord i progres.** Rekord ciężaru to najcięższa seria z całej historii, z dniem jej wykonania. Ostatnia sesja to ostatni wpis ćwiczenia w kolejności dzień → godzina → czas dodania.
- **Plany.** Nie zmieniają dziennika: usunięcie dnia planu zostawia wpisy treningu.
- **Dieta — sumy.** Liczą tylko podane wartości; posiłek bez kalorii jest na liście i w liczniku, ale nie zaniża sumy.
- **Cele diety.** Jeden klucz `goals`; zapis celów nadpisuje wartość na tym telefonie.
- **Kopia — scalanie.** Przywracanie tylko dodaje brakujące odżywki, odhaczenia, posiłki, wpisy i plany; niczego nie kasuje. Cele diety z kopii trafiają tylko, gdy na telefonie celów nie ma. Przypomnienie treningu wraca tylko, gdy istnieje jego notatka (`hasNote`). Odżywka dodana na telefonie po wykonaniu kopii zostaje.
- **Stabilny odczyt.** Hooki zwracają obiekty z cache, bo `useSyncExternalStore` przy każdym odczycie porównuje referencje. Brak tego cache powodował błąd `/cwiczenia` (commit `68ac7d9`).
- **Dzień.** Lokalny `localDayKey()`. Formularze wpisów (dieta, trening) zawsze używają dziś.

### Ograniczenia i pułapki

- Przypomnienie jest w dwóch miejscach: odżywka odhacza się w Ćwiczeniach, a „Gotowe” w Przypomnieniach przesuwa tylko serię tej notatki. Nie zamykają się nawzajem.
- Odhaczenia nie wracają przez „Cofnij” przy usunięciu odżywki (dzienny stan jest zbędny po usunięciu).
- Notatka-przypomnienie jest zwykłą notatką: widać ją na liście i w koszu.
- Brak bazy produktów; kalorie i białko wpisujesz ręcznie. Limity: opis posiłku 200 znaków, kcal do 10 000, białko do 1 000 g; wartości zaokrąglane do całości.
- Limity danych: 5 000 posiłków, 5 000 wpisów treningu, 20 planów.
- Wpisy treningu: ciężar co 0,5 kg, powtórki całkowite. Wybór dnia planu tylko ustawia ćwiczenie i serie; ciężary wpisujesz ręcznie.
- Przerwa (licznik 1:30) startuje po zapisie serii, tylko na tym ekranie; nie zapisuje się w danych.
- Wibracja tylko tam, gdzie przeglądarka ma `navigator.vibrate` (Android). Respektuje „Wibracje na telefonie” w ustawieniach efektów.
- Wykres to sparklajn bez osi i dat — pokazuje kierunek; dokładne liczby są w „rekord … kg”.
- Przypomnienie o treningu: domyślnie 18:00, opis podaje okno do 20:00.
- Kopia: sekcje `supplements`, `diet`, `training` są opcjonalne; plik sprzed tych zmian przywraca się bez zmian.

### Testy

- `src/lib/supplements/model.test.ts` (czyszczenie, klucze, kolejność, przypomnienie; `nextReminderAt` z `lib/timeOfDay.ts`).
- `src/lib/supplements/ySupplements.test.ts` (dodawanie, duplikaty, odhaczenia, usuwanie z odhaczeniami, śmieci od peera, origin).
- `src/components/cwiczenia/CwiczeniaView.test.tsx` (pusty stan, grupy i postęp, odhaczenie, formularz, przypomnienie, sprzątanie po odrzuconym zapisie).
- `src/lib/diet/model.test.ts`, `src/lib/diet/yDiet.test.ts` (w tym regresja: dwa odczyty celów to ten sam obiekt), `src/components/cwiczenia/DietSection.test.tsx`.
- `src/lib/training/model.test.ts`, `yTraining.test.ts`, `reminder.test.ts` (domyślna godzina, czyszczenie, kopia, stabilny odczyt), `reminderRestore.test.ts` (H2, M2, M3), `equipment.test.ts` (limit, ostrzeżenie, rekordy dla wykresu).
- `src/components/cwiczenia/TrainingSection.test.tsx` (pusty plan, zapis serii, walidacja ułamków, „Użyj ostatnich”, dziś i progres).
- `src/lib/fullBackup.test.ts` (odżywki, posiłki, cele i trening w kopii; przywracanie scala).
- `src/test/setup.ts` — stub `ResizeObserver` dla Radix (Checkbox), którego jsdom nie ma.
- E2E tego działu nie uruchamiano (pełne e2e odłożone).

### Budżet paczki i lint

- Próg `eagerJsGzip` w `e2e/bundle.spec.ts`: 393 KB (datowany komentarz). Ostatni pomiar po przeglądzie: 392,3 KB.
- `eslint.config.js`: na liście dozwolonych importów `yjs` są `supplements/ySupplements.ts` i testy, `diet/yDiet.ts` i testy, `training/yTraining.ts` i testy.

### Commity

- `cd83ffc` — odżywki (krok 1 planu Ćwiczeń).
- `ccce384` — dieta (krok 3).
- `c7736f0`, `9d8e57e`, `22e2495` — trening: katalog i dziennik, przypomnienie i przerwa, wibracja, sprzęt, wykres.
- `68ac7d9` — poprawka błędu `/cwiczenia` (stabilny odczyt celów diety).
- `b779947` — poprawki z przeglądu (H2, M2, M3); `1b8bcf8` — niskie punkty L1–L20 (L3, L4, L6, L7, L9).

## Budowa — telefon hurtowni i ostrzeżenie przed kopią (U7, D3, 2026-10-20)

- **U7 — co robi.** Karta budowy ma pole „Telefon hurtowni (WhatsApp zamówień)”. Przycisk „WhatsApp” w panelu zamówień
  otwiera rozmowę z tą hurtownią (`wa.me/<cyfry>`). Bez numeru zostaje dawne zachowanie (WhatsApp pyta o odbiorcę).
  Decyzja właściciela: numer jest zapisywany w karcie, więc trafia do synchronizacji i kopii.
- **U7 — gdzie jest.** `src/lib/study/sites.ts` (pole `supplierPhone`, czyszczenie), `src/lib/study/store.ts` (`SiteCardInput`, zachowanie
  pola przy edycji), `src/components/study/SiteCardDialog.tsx` (pole), `src/lib/study/order.ts` (`whatsappOrderUrl(text, phone?)`),
  `src/components/study/SiteOrderPanel.tsx` (przekazanie numeru z karty).
- **D3 — co robi.** Ręczny „Pobierz pełny backup teraz” pokazuje okno „Kopia będzie niepełna”, gdy kopia pominie
  załączniki (budżet albo brak bajtów), zanim zapisze plik. „Zapisz mimo to” zapisuje; „Anuluj” nic nie zapisuje.
- **D3 — gdzie jest.** `src/lib/exportNotes.ts` (`exportFullBackup` z opcją `confirm`, wynik `cancelled`),
  `src/components/settings/BackupSettings.tsx` (okno `AlertDialog`, `exportNow` z potwierdzeniem).
  Automatyczne kopie (`useBackupReminders`) nie pytają — nie mają okna, a zapis jest w tle.
- **Testy.** `src/lib/study/whatsappSupplier.test.ts` (3): link bez numeru, z numerem, zepsuty numer.
  `src/lib/backupConfirm.test.ts` (1): bez pominięć nie pyta. Ścieżki odmowy nie testuje żaden test (wymagałaby załącznika,
  który nie wchodzi do budżetu w teście) — do sprawdzenia ręcznie albo e2e.
- **Commit:** `f39af01` (2026-10-20, U7 i D3).

## Przegląd kodu — niskie punkty L1–L20 (2026-10-20)

Poprawki z `docs/code-review-2026-10-20.md` (status pozycji tam). Opisy działów Ćwiczeń, Długów, Grafiku, Skrzynki i Ustawień zostały przepisane do stanu aktualnego (sekcje „stan aktualny”); poniżej lista zmian z tego przeglądu.

- **Kopia (L1).** `src/lib/exportNotes.ts`: `errName(err)` — komunikaty `logDiag` przy przywracaniu zawierają tylko nazwę błędu, bez treści kopii.
- **Ćwiczenia (L3, L4, L6, L7).** `src/components/cwiczenia/TrainingSection.tsx`: `EquipmentForm` zapisuje tylko wartość > 0, ma przycisk „Usuń limit”; formularze godziny przypomnienia i ciężaru synchronizują się z danymi z Yjs. `src/lib/diet/yDiet.ts`: `getGoals` zwraca zamrożony obiekt z cache, `restore` pilnuje `DIET_MAX_MEALS` i zwraca `boolean`. `nextReminderAt` przeniesiono do `src/lib/timeOfDay.ts` (dawniej `lib/supplements/model.ts`); importy w `CwiczeniaView.tsx`, `TrainingSection.tsx` i `model.test.ts` zmienione.
- **Długi (L9).** `src/lib/debts/yDebts.ts` `remove`: uszkodzony wpis (`cleanDebt` → `null`) jest usuwany z mapy, nie zajmuje miejsca w limicie.
- **Grafik (L12–L15).** `src/lib/shifts/store.ts`: `instanceFor(id)` z cache zamiast nowego `createYShifts` przy każdym odczycie. `src/lib/shifts/monthImage.ts`: kwota zarobku przez `formatMoney`. `src/lib/shifts/monthImageDraw.ts`: fallback `roundRect` na `rect`, `URL.revokeObjectURL` po 1 s, `canvasToPng` synchroniczny (`toDataURL`), żeby `navigator.share` ruszyło w tym samym kliknięciu; `ShiftsView.tsx` dociąga moduły obrazu przy wejściu w Grafik. `src/components/shifts/ShiftSummary.tsx` `BonusPanel`: `toast.error` przy nieudanym zapisie premii.
- **Notatki (L8).** `src/lib/noteSchema.ts`: usunięty BOM na początku pliku.
- **Testy.** Istniejące: `src/lib/debts/yDebts.edit.test.ts` (L11), `src/lib/shifts/reviewFixes.test.ts`, `src/lib/training/reminderRestore.test.ts`. Nowych testów tej serii nie dodano.
- **Ograniczenia.** L14: udostępnianie obrazu wymaga sprawdzenia na telefonie (kod jest synchroniczny do `navigator.share`). L17: asercje w `e2e/bundle.spec.ts` nie są uruchomione. Paczka startowa: 392,2 KB gzip (próg 393 KB).
- **Commit:** `1b8bcf8` (2026-10-20, L1–L20).
- **Commit (L14, udostępnianie):** `1380f10` (2026-10-20).


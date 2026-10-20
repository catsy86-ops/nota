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

## Synchronizacja — pole kodu parowania (`InputOTP`)

**Co robi.** W Ustawieniach → Sync kod z drugiego urządzenia wpisuje się w 12 kratek w trzech grupach po 4 — tak samo,
jak kod jest wyświetlany (`ABCD EFGH JKMN`). Pole przyjmuje tylko znaki z alfabetu kodu (bez I, L, O, 0, 1), małe
litery zamienia na wielkie, a wklejenie przyjmuje też kod ze spacjami/myślnikami albo cały link `?pair=…`.
„Dołącz” jest aktywne przy 12 znakach albo przy starym, 8-znakowym kodzie. Link z kodu QR otwiera Ustawienia → Sync
z wypełnionymi kratkami.

**Gdzie jest.**
- `src/components/ui/input-otp.tsx`: `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` (shadcn Input
  OTP na paczce `input-otp` 1.5). Animacja udawanej karetki `caret-blink` w `tailwind.config.ts`.
- `src/components/SyncSettings.tsx`: formularz „Dołącz do istniejącej grupy”, stała `LEGACY_CODE_LENGTH`, `joinReady`.
- `src/lib/yjsSync.ts`: `CODE_LENGTH` (eksport), `CODE_PATTERN` (regex dla pola), `codeFromPaste` (link → kod, odrzuca
  znaki spoza alfabetu, tnie do 12).
- `src/pages/Index.tsx`: `settingsOpen` startuje jako `true`, gdy adres ma `?pair=`.

**Jak działa i dlaczego.**
- Pod kratkami jest jedno niewidoczne `<input>` (z `aria-label` „Kod z innego urządzenia” i podpowiedzią przez
  `aria-describedby`), więc wklejanie, autouzupełnianie i czytniki ekranu działają jak w zwykłym polu. Kratki to
  tylko obraz wartości.
- Na telefonie kratki rozciągają się na całą szerokość (`flex-1`), przycisk jest pod nimi; od `sm:` stała szerokość
  36 px i przycisk obok. Kratki mają 44 px wysokości (cel dotyku).
- Bez automatycznego dołączania po wpisaniu ostatniego znaku — dołączenie zmienia grupę synchronizacji, więc zostaje
  świadome „Dołącz” (Enter w polu też działa — to `<form>`).
- `?pair=` naprawione: od przeniesienia Ustawień do leniwej paczki (`1f24bb8`) okno montuje się dopiero po otwarciu,
  więc jego efekt czytający `?pair=` nigdy nie ruszał i link z QR tylko otwierał aplikację. Teraz `Index` otwiera
  okno od startu, a `SettingsDialog` jak dotąd przełącza na Sync, wpisuje kod i usuwa parametr z adresu.

**Ograniczenia i pułapki.**
- Kody spoza alfabetu (np. ręcznie zmienione) nie dadzą się wpisać — wszystkie generowane kody, stare i nowe, są z
  tego samego alfabetu.
- Kod 9–11 znaków nie aktywuje „Dołącz” (to zawsze literówka).
- PIN skarbca nie korzysta z `InputOTP`: skarbiec ma hasło dowolnej długości, nie PIN.
- `fill()` w Playwright nie przechodzi przez `pasteTransformer` ani filtr — w testach wpisuj `pressSequentially`.

**Testy.** `src/lib/yjsSync.test.ts` („codeFromPaste wyciąga kod z linku i grup”), `e2e/sync-code.spec.ts` (link
`?pair=` wypełnia kratki; 8/12 znaków, odrzucanie „O” i „0”).

**Commit.** `75a026c` (2026-10-15).

---

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

## Notatki — skróty z ikony aplikacji (PWA)

**Co robi.** Przytrzymanie ikony zainstalowanej aplikacji pokazuje skróty: Nowa notatka, Wpis z budowy, Grafik,
Szukaj, Nowa lista, Dziś, Przypomnienia. „Nowa lista” otwiera kompozytor od razu z listą do odhaczania, „Szukaj”
stawia kursor w polu wyszukiwania. „Wpis głosowy” (drugi po „Wpis z budowy”) otwiera ten sam arkusz wpisu i od razu
startuje dyktowanie — `/praca?wpis=1&glos=1`, patrz „Praca — dyktowanie wpisu ze skrótu” niżej (U5).
Przez to na Androidzie „Grafik” i dalsze skróty przesunęły się o jedno miejsce.

**Gdzie jest.** `public/manifest.webmanifest` (`shortcuts`), obsługa adresów w `src/hooks/useLaunchIntents.ts` (efekt przy starcie, wołany z `Index.tsx`:
`?new=1`, `?new=list` → `expandComposer("list")`, `?szukaj=1` → fokus na widocznym `input[type="search"]`); parametr
znika z adresu, więc odświeżenie nie powtarza akcji.

**Jak działa i dlaczego.** Kolejność skrótów jest celowa: Android pokazuje tylko kilka pierwszych (zwykle 4), więc na
początku to, co najczęściej robi się na budowie. Pole wyszukiwania szukane jako widoczne, bo telefon i komputer mają
osobne pola.

**Ograniczenia i pułapki.** Bez gestu użytkownika iOS nie otworzy klawiatury przy „Szukaj” (kursor jest, klawiatura po
stuknięciu w pole); Android otwiera. Udostępnianie z innej aplikacji (tekst, obrazy, PDF) — patrz „Notatki — udostępnianie z innej aplikacji”.

**Testy.** `src/lib/manifest.test.ts` (kolejność i adresy skrótów), `e2e/routes.spec.ts` („skróty PWA „Nowa lista”
i „Szukaj”…”, „skrót PWA /?new=1…”).

**Commit.** `c1a431f` (2026-10-15).

---

## Notatki — wyróżnianie trafień w kaflach (plan Notatek, etap 1.2)

**Co robi.** Gdy szukasz, trafienia są zaznaczone w tytule kafla. Jeśli trafienie jest tylko w treści, kafel pokazuje
fragment z zaznaczeniem (kilka słów wokół), zamiast początku treści. Dopasowanie jest bez ogonków i bez wielkości liter:
„zolw” zaznacza „żółw”.

**Gdzie jest.**
- `src/lib/searchHighlight.ts`: `matchParts(text, tokens)` (podział na fragmenty z trafieniem i bez), `firstSnippet`
  (pierwsze trafienie z kontekstem, przycinane wielokropkiem).
- `src/lib/searchTerms.ts`: magazyn fraz (`setSearchTerms`, hook `useSearchTerms`). Ustawia je `Index.tsx` z `?q=`/pola szukania.
- `src/components/SearchMarks.tsx`: komponent `Marked` (zaznaczony tekst).
- `src/components/NoteCard.tsx`: tytuł przez `Marked`; przy trafieniu w treści zamiast Markdownu pokazuje `snippet`.
- `src/lib/searchQuery.ts`: poprawka `fold` (patrz niżej).

**Jak działa i dlaczego.**
- Frazy idą magazynem, nie przez props: `NoteCard` jest zapamiętany, a zmiana zapytania nie musi przechodzić przez
  `NoteGrid` do każdego kafla. Hook przerysowuje tylko kafle, gdy zmieni się fraza.
- Dopasowanie idzie po tym samym `fold`, co wyszukiwarka, a każdy znak zachowuje pozycję w oryginale — zaznaczenie
  obejmuje dokładnie to, co widać.

**Poprawka błędu w wyszukiwarce.** `fold` zamieniał „ł” na „l” przed zamianą na małe litery, więc wielkie „Ł” zostawało
i „Łódź” nie trafiało w „lodz”. Kolejność odwrócona. Poprawka dotyczy też operatorów (`etykieta:`, `folder:` itd.).

**Ograniczenia.** Zapowiedź fragmentu zastępuje na kafelku Markdown (formatowanie nie jest pokazywane w trakcie
wyszukiwania). Kafel bez wyszukiwania działa jak dotąd.

**Testy.** `src/lib/searchHighlight.test.ts` (bez ogonków, wielkość liter, łączenie zakresów, fragment z przycinaniem),
`src/lib/searchQuery` (dotychczasowe testy po poprawce), `e2e/search-highlight.spec.ts` (tytuł z ogonkami, fragment
z treści).

**Commit.** `8f01351` (2026-10-16).

## Notatki — czytnik wydzielony z Index (plan Notatek, etap 4, pierwszy krok refaktoru)

**Co robi.** Bez zmian dla użytkownika. Logika czytnika i prezentacji została przeniesiona z `Index.tsx` do hooka.

**Gdzie jest.**
- `src/hooks/useReaderNav.ts`: `useReaderNav({ notes, archivedNotes, trashedNotes, visibleNotes, presentingNoteId, setPresentingNoteId, paletteOpen, selectedIds, openNote })`.
  Zwraca `previewId`, `readerId`, `readerNote`, `readerSteps`, `copyTarget`, `closeReader`, `showInReader`, `stepReader`, `editFromReader`.
- `src/pages/Index.tsx`: wywołanie hooka w miejscu dawnego bloku; stan `presentingNoteId` zostaje w `Index`, bo ustawia go też klawiatura siatki.

**Jak działa i dlaczego.** Hook nie trzyma własnego stanu poza tym, co było już w `gridKeyboardNav` i w `Index`, więc
zachowanie się nie zmienia. Stan prezentacji zostawiony w `Index` (dwa miejsca go ustawiają: siatka i czytnik).

**Stan etapu 4.** Zrobione też: sesja edycji kafla (`useNoteEditSession`), obrazy kafla (`useNoteImages`), akcje kafla
(`NoteCardActions`), edytor kafla i okna (`NoteEditor`), gesty kafla (`useCardGestures`), arkusz, podgląd i
usuwanie (`NoteCardDialogs`), podgląd zawartości (`NoteCardBody`), efekty ruchu (`useCardMotion`), patrz niżej.
Pozostają: otoczka kafla w `NoteCard.tsx` oraz reszta `Index.tsx` (po `useBulkNoteOps` i reszcie — patrz „start,
operacje zbiorcze i indeks linków” — 961 linii; zostały widoki i okna leniwe).

**Testy.** Charakteryzujące: `e2e/reader.spec.ts`, `reader-step.spec.ts`, `wikilinks.spec.ts`, `notes.spec.ts`,
`editing.spec.ts`, `routes.spec.ts`, `tabs.spec.ts`, `search-highlight.spec.ts` — 28/28.

**Commit.** `1ccb86d` (2026-10-16).

## Notatki — sesja edycji kafla w hooku (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Edycja tytułu, treści i listy w kaflu, autozapis, „Zapisz”, zapis przy
zamknięciu, wysokość pola, skróty w polu treści (Ctrl+F/H, lista, Tab, Alt+↑/↓), podpowiedzi `[[` i `/`
oraz pasek formatowania działają jak wcześniej.

**Gdzie jest.**
- `src/hooks/useNoteEditSession.ts`: `useNoteEditSession({ note, autosaveSeconds, onUpdate, onSaveVersion, wikiTitles })`.
  Zwraca stan (`isEditing`, `editTitle`, `editContent`, `editChecklist`, `showChecklist`, `showPreview`, `fullEditor`,
  `findOpen`) wraz z setterami, `textareaRef`, `wiki`, `slash`, `handleEditSelect`, `handleEditKeyDown`,
  `handleFormatInsert`, `commitDraft`, `handleSave`, `begin`.
- `src/components/NoteCard.tsx`: wywołanie hooka na początku komponentu (po `prefs`); `begin()` w kliknięciu kafla
  zastępuje dawny blok ustawień. `wikiTitles` to `wikiIndex?.titles ?? NO_TITLES`. Usunięte importy hooków i funkcji
  edytora, które przeszły do hooka.

**Jak działa i dlaczego.** Szkic siedzi w hooku razem z `draftRef` i `versionSavedRef`, bo `commitDraft` jest wołane
z cleanupu efektu przy odmontowaniu. Kolejność efektów została ta sama: wysokość pola, autozapis, tekst na żywo,
podpowiedzi, potem `endNoteTextEdit` przy odmontowaniu. `begin()` bierze treść z `beginNoteTextEdit`, a nie z `note`, żeby
pokazać to, co widzi peer. Obsługa klawiszy (`handleEditKeyDown`) ma tę samą kolejność priorytetów: lista zadań,
Ctrl+F/H, menu „/”, lista `[[`, skróty edytora. Wklejanie obrazów (`handleEditPaste`) i dodawanie obrazów zostają w
`NoteCard`, bo zależą od `addImages` i `imageStore`.

**Ograniczenia.** `handleEditPaste` i `addImages` nadal w `NoteCard` — przeniesienie wymaga, żeby hook przyjął
obsługę obrazów. Pozostają też `FindReplaceBar` (renderowany w `NoteCard`) i cały podział widoku.

**Testy.** Charakteryzujące, bez nowych testów: `e2e/editing.spec.ts`, `editor-keys.spec.ts`, `editor-open.spec.ts`,
`checklist.spec.ts`, `composer.spec.ts`, `live-text.spec.ts`, `live-text-focused.spec.ts`, `note-props.spec.ts`,
`parked-drafts.spec.ts`, `read-only-note.spec.ts`, `wikilinks.spec.ts`, `note-links.spec.ts`, `wiki-heading.spec.ts`,
`daily-note.spec.ts` — 39/39 (`--workers=1`). Testy jednostkowe `src/components`, `src/hooks`, `src/lib`:
1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `3342c00` (2026-10-16) — sesja edycji; `ff09430` (2026-10-16) — klawisze, podpowiedzi i Ctrl+F.

## Notatki — zaznaczenie notatek w useSelection (refaktor Index.tsx)

**Co robi.** Bez zmian dla użytkownika. Zaznaczone notatki w widoku listy: pasek zbiorczy pokazuje liczbę,
a Esc albo „wyczyść” zdejmuje zaznaczenie. Zaznaczenie znika przy zmianie widoku, etykiety lub folderu.

**Gdzie jest.**
- `src/hooks/useSelection.ts`: `useSelection({ view, activeLabel, activeFolder })` zwraca `selectedIds`,
  `setSelectedIds`, `selectionMode` (`selectedIds.size > 0`), `lastSelectedRef` i `clearSelection`. Wywołanie w
  `src/pages/Index.tsx` stoi w miejscu dawnego stanu zaznaczenia.
- `src/hooks/useSelectionGestures.ts`: `useSelectionGestures({ view, visibleNotesRef, previewId, presentingNoteId,
  setSelectedIds, lastSelectedRef })` zwraca `toggleSelect` (klik i Shift-zakres) i obsługuje skrót Ctrl/Cmd+A.
  Wywołanie w `Index.tsx` stoi zaraz po czytniku (`useReaderNav`), bo potrzebuje `previewId` i `visibleNotesRef`.

**Jak działa i dlaczego.** Pierwszy hook zawiera tylko to, co zależy od widoku. Drugi dostaje wartości z `Index`
jako parametry, więc jego wywołanie musi stać po ich wyliczeniu. Do tablic zależności dopisano `setSelectedIds` i
`lastSelectedRef` — są stabilne, więc zachowanie się nie zmienia, a lint jest czysty. Ctrl+A nic nie robi, gdy otwarte
jest okno, czytnik albo prezentacja, i nie działa w kalendarzu, grafiku ani nauce.

**Ograniczenia.** `visibleNotesRef` i `previewId` muszą być policzone przed wywołaniem `useSelectionGestures`. Zmiana
kolejności `visibleNotes` albo czytnika w `Index` wymaga sprawdzenia tej zależności.

**Testy.** Charakteryzujące (chromium, `--workers=1`): `notes`, `note-groups`, `templates-bulk`, `reminders-calendar`,
`quick-capture`, `search-highlight`, `reader`, `note-links`, `editor-keys` — 62/62 po pierwszym kroku i 50/50 po
przeniesieniu klika i Ctrl+A (`notes`, `note-groups`, `templates-bulk`, `editor-keys`, `reader`, `quick-capture`,
`note-links`, `search-highlight`). Na `iphone-14` (`@mobile`): `mobile`, `mobile-layout` — 17/17 (przytrzymanie kafla
zaznacza go). Testy jednostkowe `src/components`, `src/hooks`, `src/lib`, `src/pages`: 1209/1209. `tsc` i eslint bez
błędów. Nie uruchamiano pełnego e2e.

**Commit.** `bea4f33` (stan zaznaczenia, 2026-10-16), `c513247` (klik, Shift i Ctrl+A, 2026-10-16).

## Notatki — odznaki w useAchievementToasts (refaktor Index.tsx)

**Co robi.** Bez zmian dla użytkownika. Nowa odznaka pokazuje pieczątkę (przy włączonych efektach, gdy nie ma otwartego
okna ani edytora nowej notatki) albo jeden cichy toast „Nowa odznaka” / „Nowe odznaki: N”, który podmienia poprzedni
(stałe `id`). Przycisk „Zobacz” otwiera Statystyki.

**Gdzie jest.** `src/hooks/useAchievementToasts.ts`: `useAchievementToasts({ notes, archivedNotes, allLabels, folders,
onOpenStats })`. Wywołanie w `src/pages/Index.tsx` (w miejscu dawnego bloku odznak). `onOpenStats` idzie przez
`useLatestRef`, więc toast nie trzyma starego callbacku.

**Jak działa i dlaczego.** Logika bez zmian: `useAchievementTracker` z `src/lib/achievements.ts` wykrywa odblokowanie,
a hook decyduje, czy pokazać pieczątkę, czy dopisać do paczki. Gdy otwarte jest okno, toast czeka (1 s ponowienia),
a pieczątka czeka do 40 prób po 800 ms.

**Ograniczenia.** Hook nie ma testu e2e. Logika odznak i pieczątki są w `src/lib/achievements.test.ts` i
`achievementStamp.test.ts`; samego zachowania toastów (paczkowanie, podmiana, „Zobacz”) nie sprawdza żaden test.

**Testy.** Jednostkowe: `src/lib/achievements.test.ts`, `achievementStamp.test.ts`. e2e (chromium, `--workers=1`) przechodzące
przy wyciągnięciu: `notes`, `routes`, `tabs`, `composer`, `reminders-calendar`, `search-backup`, `board-table`, `reader`,
`quick-capture`, `weekly-review` — 57/57. Testy jednostkowe `src/components`, `src/hooks`, `src/lib`, `src/pages`:
1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `39231e6` (2026-10-16).

## Notatki — start, operacje zbiorcze i indeks linków poza Index (refaktor Index.tsx)

**Co robi.** Bez zmian dla użytkownika. `Index.tsx` zmalał z 1143 do 961 linii.

**Gdzie jest.**
- `src/hooks/useLaunchIntents.ts`: `useLaunchIntents({ navigate, addNote, openNote, expandComposer })` — raz przy
  starcie: udostępnianie (`/share`, `?inbox=` z plikami), skróty PWA `?new=1`, `?new=list`, `?szukaj=1`.
- `src/hooks/useBulkNoteOps.ts`: `useBulkNoteOps({ view, groupBy, folders, notesRef, selectedIds, … moveToFolder })` →
  `restoreSelected`, `pinSelected`, `moveSelectedToFolder`, `labelSelected` (pasek zbiorczy) i `moveToColumn`
  (przeciąganie na tablicy, `useNoteDnd`). Kosz, archiwum i kolor zostają w `useNoteActions`.
- `src/hooks/useWikiLinkIndex.ts`: `useWikiLinkIndex(notes, archivedNotes)` → `allNotesForLinks`, `knownTitles`,
  `wikiIndex` (stabilne obiekty przez `useStableByKey`).
- `src/components/TrashConfirmDialogs.tsx`: `DeleteForeverDialog`, `EmptyTrashDialog`.
- `src/components/sidebar/sidebarItems.ts`: `SidebarItem`, `sidebarItems({ inbox, overdue, trash })` — lista działów
  paska bocznego (typ przeniesiony z `AppSidebar.tsx`).
- `Index.tsx`: przypięte i grupy przypomnień rysuje ten sam `renderGrid` co reszta (wcześniej dwie skopiowane długie
  linie `NoteGrid` z tymi samymi propsami — w widokach, gdzie się pojawiają, `renderGrid` daje identyczne propsy).

**Jak działa i dlaczego.** Kod przeniesiony bez zmian logiki. `useLaunchIntents` czyta funkcje przez `useLatestRef`,
więc efekt biegnie raz (jak dawne `useEffect(…, [])` z wyłączonym lintem), a zapis po `whenNotesReady` używa
najnowszego `handleAddNoteGlow`. `useBulkNoteOps` musi stać po `groupBy` i `handleMoveToFolderGlow`, a przed
`useNoteDnd` (dawniej `moveToColumn` było deklaracją funkcji wynoszoną na górę).

**Ograniczenia.** Zostały w `Index`: stan okien (paleta, ustawienia, statystyki…) i ich leniwe renderowanie, sekcje
„Dziś” i widoki — dalszy podział wymagałby przeniesienia stanu okien do osobnego magazynu.

**Testy.** Bez nowych; pełne e2e chromium (`--workers=1`): 365/365. Vitest 1314/1314, `tsc` i eslint bez błędów,
build i budżet paczki w progach.

**Commit.** `6ab66bf` (2026-10-16).

## Notatki — efekty ruchu kafla w useCardMotion (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Kafel ma lekki przechył 3D przy najechaniu (gdy włączony w ustawieniach),
animację wyjścia (kosz/archiwum), iskrę „klik pinezki” po przypięciu i pieczątkę „gotowe” po odhaczeniu ostatniego
zadania listy. Przy redukcji ruchu (systemowej lub w aplikacji) przechyłu, animacji wyjścia i iskier nie ma.

**Gdzie jest.** `src/hooks/useCardMotion.ts`: `useCardMotion({ note, isEditing })` zwraca `reduce`, `fx` (ustawienia
efektów), `tilt`, `showFx`, `cardVariants`, `pinFx`/`setPinFx`, `stampKey`/`setStampKey`. `NoteCard.tsx` czyta je na
początku komponentu i przekazuje do `useCardGestures` (przechył, iskra przy przypięciu gestem) oraz do `motion.div`.

**Jak działa i dlaczego.** Logika bez zmian. Pinezka: `consumePin` zdejmuje znacznik po przypięciu, a `pinFx` pokazuje
falę na nowej karcie w innej sekcji. Pieczątka: wyzwala ją przejście `allDone` z fałszu na prawdę, poza edycją i koszem.

**Ograniczenia.** Efekt pieczątki celowo reaguje tylko na zmianę `allDone` (eslint-disable w pliku), jak wcześniej.

**Testy.** Charakteryzujące (chromium, `--workers=1`): `card-motion`, `checklist`, `notes`, `note-groups`, `board-table`,
`subpages`, `editing`, `reader`, `view-change`, `desktop-columns` — 45/45. Na `iphone-14` (`@mobile`): `mobile`,
`mobile-layout`, `editor-open`, `touch-targets` — 20/20. Testy jednostkowe `src/components`, `src/hooks`, `src/lib`:
1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `2141f60` (2026-10-16).

## Notatki — podgląd zawartości kafla w NoteCardBody (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Tryb podglądu kafla: okładka, tytuł (z ikoną i kłódką przy zablokowanej),
treść albo fragment trafienia wyszukiwania, lista zadań, etykiety, przypomnienie, priorytet, załączniki, „Gotowe” /
„Jutro” przy zaległym terminie, link zwrotny (jeden, reszta „+N”), nadrzędna notatka i liczba podstron, odliczanie
kosza z „Przywróć”, czas czytania i data.

**Gdzie jest.** `src/components/NoteCardBody.tsx`: `NoteCardBody({ note, isArchived, selectable, snippet, searchTerms,
knownTitles, onWikiClick, onUpdate, onOpenNote, onUnarchive, handleChecklistToggle, backlinks, subpage, trashCountdown,
showReadingTime, wordCount, readMin })`. Stała `BACKLINKS_SHOWN` przeniesiona tutaj. `NoteCard.tsx` renderuje ją w
miejscu dawnej gałęzi „nie edytuj” i przekazuje wyliczone wartości (`backlinks`, `subpage`, `trashCountdown`).

**Jak działa i dlaczego.** Komponent ma propy o tych samych nazwach co dawne zmienne, więc treść JSX nie zmieniła się.
Jedyna zmiana: `selectable` zamiast `onToggleSelect`, a `showReadingTime` zamiast `prefs.showReadingTime`.
Zaznaczanie kafla i akcje klikalne zostają w `NoteCard` (obsługa kliknięcia kafla), a tu są już tylko treść i
przyciski „Gotowe”/„Jutro”, które wywołują `onUpdate` z propsów.

**Ograniczenia.** Typ `subpage` jest pisany ręcznie (kształt z `wikiIndex.tree`); zmiana kształtu `wikiIndex` wymaga
poprawki tutaj.

**Testy.** Charakteryzujące (chromium, `--workers=1`): `notes`, `note-links`, `subpages`, `reminders-calendar`,
`reminder-toast`, `search-highlight`, `checklist`, `note-look`, `note-groups`, `reminders-agenda`, `saved-filters`,
`private-notes`, `card-motion`, `desktop-columns` — 58/58; `board-table`, `wikilinks`, `wiki-heading`, `reader`,
`reader-step`, `view-change`, `editing`, `card-images`, `read-only-note`, `note-props-view`, `note-wide-large`,
`masonry` — 30/30. Na `iphone-14` (`@mobile`): `mobile`, `mobile-layout`, `editor-open`, `touch-targets` — 20/20.
Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `a8ae0a5` (2026-10-16).

## Notatki — arkusz „⋯”, podgląd obrazu i usuwanie w NoteCardDialogs (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Arkusz „⋯” na dotyku (tytuł, kolor, szybkie akcje, „Więcej”), podgląd
obrazka na pełnym ekranie i potwierdzenie trwałego usunięcia z kosza.

**Gdzie jest.** `src/components/NoteCardDialogs.tsx`:
- `ActionSheet({ open, onOpenChange, note, isArchived, pinSparkle, onAskDeleteConfirm, more, … })` — `more` to element
  budowany w `NoteCard` (`moreActions`), ten sam co w rozwinięciu.
- `ImagePreviewDialog({ imageRef, onClose })`.
- `DeleteNoteDialog({ open, onOpenChange, note, onDelete })`.
`NoteCard.tsx` trzyma stan otwarcia (`sheetOpen`, `previewImage`, `showDeleteConfirm`) i montowanie „leniwe” (`useLatch`).

**Jak działa i dlaczego.** Arkusz zatrzymuje zdarzenia na `SheetContent`, bo płyną drzewem Reacta do kafla. Zamknięcie
po akcji idzie przez `onOpenChange(false)`, tak samo jak wcześniej `setSheetOpen(false)`.

**Ograniczenia.** Dialog podglądu zamyka się przez `onClose`, który czyści `previewImage` (dawniej `setPreviewImage(null)`).

**Testy.** Charakteryzujące: `e2e/notes.spec.ts`, `editing.spec.ts` (usuwanie do kosza), `card-images.spec.ts`,
`images.spec.ts`, `subpages.spec.ts`, `private-notes.spec.ts`, `card-motion.spec.ts`, `note-props.spec.ts`,
`reminder-toast.spec.ts`, `read-only-note.spec.ts` — 31/31 (chromium, `--workers=1`). Na profilu `iphone-14` (`@mobile`):
`mobile.spec.ts`, `mobile-layout.spec.ts`, `editor-open.spec.ts`, `touch-targets.spec.ts` — 19/20 przy pierwszym
przebiegu; jedna porażka (`320 px: żadna trasa…`) to timeout `page.goto` na zimnym starcie, a sam test przechodzi (1/1).
Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `3596e41` (2026-10-16).

## Notatki — gesty kafla w useCardGestures (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Na dotyku: przesunięcie kafla w prawo (przypnij/odepnij) lub w lewo
(archiwizuj, w Archiwum przywróć), z podpisami w tle przy pierwszych gestach; przytrzymanie 450 ms zaznacza kafel.
Przy myszy: przechył 3D, gdy włączony w ustawieniach i bez redukcji ruchu.

**Gdzie jest.** `src/hooks/useCardGestures.ts`: `useCardGestures({ note, isArchived, isEditing, selectionMode, cardRef,
tilt, pinSparkle, onToggleSelect, onTogglePin, onArchive, onUnarchive })`. Zwraca `isTouch`, `canSwipePin`,
`canSwipeArchive`, `swipeEnabled`, `swipeX`, `swipeControls`, `swiping`, `swipeLabels`, `pinOpacity`, `archiveOpacity`,
`handleSwipeStart`, `handleSwipeEnd`, `handleLongPressStart`, `handleLongPressMove`, `cancelLongPress`, `longPressed`,
`rotX`, `rotY`, `handleMove`, `handleLeave`. `NoteCard.tsx` podpina je do `motion.div` kafla i do tła gestu.

**Jak działa i dlaczego.** Gest startuje ręcznie przez `swipeControls` — dotyk na uchwycie przeciągania należy do dnd-kit
(kolejność, kolumny tablicy), nie do przesunięcia. Kosz nie ma gestu, żeby przypadkowy ruch niczego nie usuwał.
Iskry przy przypięciu gestem liczy `NoteCard` (`pinSparkle`), bo zależą od ustawień efektów i ruchu.

**Ograniczenia.** `isTouch` liczone przy renderze przez `matchMedia`, nie reaguje na zmianę urządzenia w trakcie sesji (jak wcześniej).

**Testy.** Charakteryzujące: `e2e/mobile.spec.ts`, `mobile-layout.spec.ts`, `card-motion.spec.ts`, `board-table.spec.ts`,
`desktop-columns.spec.ts`, `editor-open.spec.ts`, `touch-targets.spec.ts`, `notes.spec.ts`, `card-images.spec.ts`,
`view-change.spec.ts`, `reminder-toast.spec.ts` — 49/49 (`--workers=1`, chromium); z `@mobile` na `iphone-14` 20/20.
Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów. Nie uruchamiano pełnego e2e.

**Commit.** `c55f50e` (2026-10-16).

## Notatki — edytor kafla i okna w NoteEditor (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Edytor w kaflu i w oknie pełnoekranowym: tytuł, pasek formatowania,
podgląd Markdown, lista zadań, załączniki, licznik i „Zapisz”.

**Gdzie jest.** `src/components/NoteEditor.tsx`: `NoteEditor({ full, note, session, spellcheck, editorScrolled,
knownTitles, onWikiClick, onUpdate, onPaste })`. Stan i handlery z `session` (typ `NoteEditSession` z
`src/hooks/useNoteEditSession.ts`). `NoteCard.tsx` ma `renderEditor(full)`, który tylko zwraca `<NoteEditor/>`,
i używa go w kaflu (`full={false}`) i w `Dialog` (`full`).

**Jak działa i dlaczego.** Jedna sesja edycji dla obu miejsc, więc rozwinięcie okna nie zmienia ścieżki zapisu.
Przekazanie całego obiektu sesji zamiast kilkudziesięciu props. `onBlur` na korzeniu zapisuje szkic przy wyjściu
fokusem, ale nie zamyka edytora.

**Ograniczenia.** `NoteEditor` czyta `session` przez destrukturyzację — nowe pole sesji trzeba dopisać do listy w tym pliku.

**Testy.** Charakteryzujące: `e2e/editing.spec.ts`, `editor-keys.spec.ts`, `editor-open.spec.ts`, `checklist.spec.ts`,
`live-text.spec.ts`, `live-text-focused.spec.ts`, `wikilinks.spec.ts`, `note-links.spec.ts`, `wiki-heading.spec.ts`,
`images.spec.ts`, `card-images.spec.ts`, `paste-html.spec.ts`, `attachments.spec.ts`, `read-only-note.spec.ts`,
`parked-drafts.spec.ts`, `notes.spec.ts`, `daily-note.spec.ts`, `composer.spec.ts` — 49/49 (`--workers=1`).
Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów.
Nie uruchamiano pełnego e2e.

**Commit.** `ad2df94` (2026-10-16).

## Notatki — akcje kafla w NoteCardActions (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Na stopce kafla (mysz) albo w arkuszu „⋯” (dotyk) są: przypnij, kolor,
przypomnienie, priorytet, archiwizuj, usuń; w „Więcej opcji” (rozwinięcie lub arkusz) reszta: ikona, ulubione,
szerokość, większy tekst, blokada, podstrona, obraz, rysunek, etykiety, folder, prywatna, udostępnij, wersje,
prezentacja, duplikat.

**Gdzie jest.** `src/components/NoteCardActions.tsx`:
- `ActionBtn` — przycisk ikony na stopce (przeniesiony z `NoteCard.tsx`, dalej tylko tam używany).
- `PrimaryActions({ note, isArchived, inSheet, pinSparkle, onClose, onToggleColors, onAskDeleteConfirm, … })`.
- `MoreActions({ note, isArchived, noteVersions, folders, allLabels, onCreateLabel, onAddImage, onDraw, … })`.
`NoteCard.tsx` buduje `moreActions` (jeden element dla rozwinięcia i arkusza) i wywołuje `PrimaryActions` dwa razy:
w stopce (`inSheet={false}`) i w arkuszu (`inSheet`, `onClose` zamyka arkusz).

**Jak działa i dlaczego.** Komponenty dostają wszystko przez props, nie przez zamknięcia z `NoteCard`. Iskry przy
przypięciu liczy `NoteCard` (`showFx && fx.sparkle`), bo zależą od ustawień efektów i ruchu. Usunięcie notatki z kosza
idzie przez `onAskDeleteConfirm` — dialog zostaje w `NoteCard`. `handleLabelToggle` przeniesiony do `MoreActions`
(czyta tylko `note` i `onUpdate`).

**Ograniczenia.** `isArchived` jest opcjonalne w kontekście, więc w propsach też opcjonalne (działa jak `!isArchived`).
Dodanie nowej akcji wymaga dopisania jej w obu miejscach, czyli zmiany `NoteCardActions.tsx`, nie `NoteCard.tsx`.

**Testy.** Charakteryzujące: `e2e/notes.spec.ts`, `card-images.spec.ts`, `card-motion.spec.ts`, `note-look.spec.ts`,
`note-props.spec.ts`, `subpages.spec.ts`, `private-notes.spec.ts`, `read-only-note.spec.ts`, `reminder-toast.spec.ts`,
`reminders-calendar.spec.ts`, `mobile.spec.ts`, `editing.spec.ts`, `attachments.spec.ts`, `board-table.spec.ts` — 66/66
(`--workers=1`). Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów.
Nie uruchamiano pełnego e2e.

**Commit.** `7437879` (2026-10-16).

## Notatki — obrazy kafla w hooku useNoteImages (plan Notatek, etap 4, refaktor NoteCard)

**Co robi.** Bez zmian dla użytkownika. Obrazy z pliku („Dodaj obrazek”), wklejony zrzut do pola treści,
rysunek z płótna i usuwanie z „Cofnij” działają jak wcześniej.

**Gdzie jest.** `src/hooks/useNoteImages.ts`: `useNoteImages({ note, onUpdate })` zwraca `fileInputRef`,
`handleImageUpload`, `handleEditPaste`, `addDrawing(dataUrl)`, `removeImage(idx)`. `NoteCard.tsx` wywołuje go
na początku komponentu i podpina `fileInputRef` do `<input type="file">`, `handleEditPaste` do pól treści,
`addDrawing` do `DrawingCanvas`. Stan podglądu (`previewImage`) i otwarcia rysownika (`showDrawing`) zostaje w `NoteCard`.

**Jak działa i dlaczego.** Obraz przechodzi przez `prepareImage` (skalowanie do limitu 2 MB), bajty idą do
`imageStore`, a do notatki trafia tylko referencja (klucz SHA-256). Obrazy, których nie da się przeskalować,
są liczone i pokazywane w jednym komunikacie. Usuwanie zapisuje poprzednią listę, żeby „Cofnij” ją przywrócił.

**Ograniczenia.** Wklejenie zrzutu do pola treści nie ma jeszcze e2e (jest tylko kod `handleEditPaste`).
„Dodaj obrazek” jest w rozwijanym menu „Więcej opcji”, nie na pasku kafla.

**Testy.** `e2e/card-images.spec.ts` (dodanie z menu, przeładowanie, usunięcie z „Cofnij”). Charakteryzujące:
`e2e/images.spec.ts`, `paste-html.spec.ts`, `attachments.spec.ts`, `editing.spec.ts`,
`editor-keys.spec.ts`, `composer.spec.ts`, `note-look.spec.ts`, `note-props.spec.ts`, `checklist.spec.ts`,
`live-text.spec.ts`, `parked-drafts.spec.ts`, `read-only-note.spec.ts` — 36/36 (`--workers=1`).
Testy jednostkowe `src/components`, `src/hooks`, `src/lib`: 1209/1209. `tsc` i eslint bez błędów.

**Commit.** `53e7886` (2026-10-16).

## Notatki — tekst peera na żywo w otwartym edytorze (plan Notatek, etap 4, weryfikacja)

**Co robi.** Gdy edytujesz notatkę, a drugie urządzenie dopisuje do niej tekst, ten tekst pojawia się w Twoim polu
od razu, bez zapisu i bez wychodzenia z pola. Karetka zostaje przy znaku, który piszesz.

**Gdzie jest.** `src/hooks/useLiveNoteText.ts` (podpięty w `useNoteEditSession`, od `3342c00` także nie w `NoteCard`): zdalna zmiana → `rebaseNoteTextEdit` → wstawienie
do szkicu i przywrócenie zaznaczenia.

**Stan.** Działało już wcześniej, ale test sprawdzał tekst dopiero po `blur`. Dodany test `e2e/live-text-focused.spec.ts`
sprawdza przypadek z fokusem: tekst peera wchodzi do pola, a karetka zostaje za własnym tekstem. Zielony.

**Commit.** `1ccb86d` (2026-10-16).

## Notatki — zwinięty pasek „Zapisz notatkę...” (wygląd)

**Co robi.** Zwinięty pasek nad siatką kafli to teraz kafelek z bursztynowym plusem w zaokrąglonym polu (jak
zakładka w zeszycie). Po najechaniu tło plusa mocniej się wypełnia, a po kliknięciu kafelek lekko się zmniejsza.
Tekst i działanie bez zmian: kliknięcie rozwija kompozytor.

**Gdzie jest.** `src/components/AddNoteBar.tsx`, przycisk w gałęzi `!expanded` (klasa `group` na przycisku,
kafelek to `span aria-hidden`). Kolory z tokenów `primary` / `primary-ink`, czas z `--dur-fast`.

**Jak działa.** Sama zmiana stylu, bez nowego stanu. Tekst „Zapisz notatkę...” zostaje w tym samym miejscu DOM,
więc selektory w e2e (`getByText`) działają jak dawniej.

**Ograniczenia i pułapki.** Pasek jest ukryty na telefonie (`max-md:hidden`), tam działa dolny przycisk „+”.
Kafelek ma `aria-hidden`, więc czytnik ekranu czyta tylko tekst.

**Testy.** Brak dedykowanego testu wyglądu. Pełny zestaw Vitest przechodzi (1349). Regresja: `e2e/composer.spec.ts`
(uruchomiono tylko Vitest, e2e nie puszczano).

## Wspólne — aktywny wiersz paska bocznego (wygląd)

**Co robi.** Aktywny wiersz paska bocznego (Notatki, Skrzynka, folder, etykieta) ma bursztynową pigułkę jak dotąd
i dodatkowo cienką kreskę przy lewej krawędzi, jak zapis na marginesie zeszytu. Kreska przejeżdża razem z pigułką.

**Gdzie jest.** `src/components/sidebar/SidebarRow.tsx`: `motion.span` z `layoutId="sidebar-active-pill"` ma w środku
dziecko `span` (`absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary`).

**Ograniczenia.** Kreska jest w tym samym `layoutId`, więc animacja przejścia między wierszami obejmuje też ją.
Na telefonie pasek boczny jest arkuszem, a ten sam wiersz wygląda tak samo.

**Testy.** Brak dedykowanego testu wyglądu; Vitest przechodzi (1349). Zrzut jasnego motywu sprawdzony.

## Notatki — grupa widoku w nagłówku (wygląd)

**Co robi.** Trzy ikony po prawej w nagłówku (układ, sortowanie, filtry) siedzą na jasnej kartce z cieniem
zamiast na szarej plamie. Działanie bez zmian.

**Gdzie jest.** `src/components/ViewControls.tsx`, kontener `div` zwracany przez komponent (klasy `bg-card/80`,
`border-border/60`, `shadow-elevation-1`). Wstawiany w `AppHeader.tsx`.

**Testy.** Brak dedykowanego testu wyglądu; Vitest przechodzi. Zrzuty sprawdzone w jasnym i ciemnym motywie.

## Notatki — lista robocza szkiców (plan Notatek, etap 3.4)

**Co robi.** W kompozytorze nowej notatki „Odłóż” zapisuje bieżący szkic na listę roboczą i otwiera pusty kompozytor.
Odłożone szkice są w rzędzie „Odłożone” nad tytułem. Kliknięcie wznawia szkic; jeśli bieżący szkic był rozpoczęty,
najpierw sam trafia na listę, więc nic nie przepada. „×” usuwa szkic z listy, z „Cofnij”.

**Gdzie jest.**
- `src/lib/parkedDrafts.ts`: `addParked` (najnowszy pierwszy, limit `PARKED_MAX` = 20), `removeParked`, `parkedLabel`
  (tytuł → pierwsza linia treści → pierwsza pozycja listy → „Bez tytułu”, do 40 znaków).
- `src/components/AddNoteBar.tsx`: klucz `kaczy.drafts.v1`, `readParked` / `writeParked`, `sanitizeDraft` (wydzielone
  z `readDraft`, używane przez obie ścieżki), `parkCurrent`, `resumeParked`, `deleteParked`, rząd „Odłożone szkice”.

**Jak działa i dlaczego.**
- Oddzielny klucz, nie rozszerzenie `kaczy.draft.v1`: dotychczasowy szkic bieżący zostaje bez zmian, więc starsze wersje
  i obecne przywracanie działają jak dawniej.
- Każdy wpis listy przechodzi przez tę samą walidację co szkic (`sanitizeDraft`); uszkodzone pozycje odpadają po cichu.
- Zdjęć i plików nie odkłada się (nie są zapisywane w szkicu): „Odłóż” i wznowienie wtedy zgłaszają to komunikatem,
  zamiast cicho je zgubić.
- Usunięcie z listy ma „Cofnij”, które przywraca całą listę sprzed usunięcia.

**Ograniczenia.** Lista jest lokalna dla przeglądarki (jak szkic), nie synchronizuje się z innymi urządzeniami.
Rząd jest widoczny po rozwinięciu kompozytora. Limit 20 szkiców; najstarszy odpada.

**Testy.** `src/lib/parkedDrafts.test.ts` (etykieta, limit, kolejność, usuwanie), `e2e/parked-drafts.spec.ts`
(odłóż, wznów z odłożeniem bieżącego, przeładowanie, usuń z „Cofnij”). Regresja: `composer.spec.ts`,
`quick-capture.spec.ts`, `notes.spec.ts`, `paste-html.spec.ts`, `resilience.spec.ts` — 23/23.

**Commit.** `682f69f` (2026-10-16).

## Notatki — wklejanie HTML jako Markdown w kompozytorze (plan Notatek, etap 3.1)

**Co robi.** Wklejenie treści skopiowanej ze strony lub dokumentu w polu treści nowej notatki zamienia formatowanie
na Markdown i wstawia go w miejscu kursora. Obsługiwane: nagłówki, pogrubienie, kursywa, listy (punktowane i numerowane),
linki (tylko http/https), kod, bloki kodu, cytaty. Zwykły tekst bez formatowania wkleja się jak dotąd.

**Gdzie jest.**
- `src/lib/htmlToMarkdown.ts`: `htmlToMarkdown(html)` — DOMParser, tylko wybrane znaczniki, skrypty/style/obrazy pomijane.
- `src/components/AddNoteBar.tsx`: `handleContentPaste` (kolejność: obrazy → na pustym szkicu adres z tytułem jak dotąd
  → `pasteHtmlAsMarkdown`).

**Jak działa i dlaczego.**
- Linki na pustym szkicu zachowują pierwszeństwo: wklejony adres dostaje tytuł strony (istniejąca obsługa).
- Gdy wynik Markdownu jest taki sam jak zwykły tekst, wklejanie zostaje domyślne — nie ma czego zamieniać.
- Tylko adresy http/https stają się linkami; `javascript:` i inne schematy zostają zwykłym tekstem.
- Wklejanie idzie w miejsce kursora (zaznaczony fragment jest zastępowany), a kursor ląduje za wklejonym tekstem.

**Ograniczenia.** Konwerter nie obsługuje tabel (tekst wierszy zostaje w kolejności), zagnieżdżonych list i obrazów
(świadomie pomijane). Edytor istniejącej notatki (`NoteCard`) nie ma tej zmiany — tylko kompozytor nowej notatki.

**Testy.** `src/lib/htmlToMarkdown.test.ts` (nagłówki, listy, linki, kod, cytat, pomijanie skryptów, pusty wynik),
`e2e/paste-html.spec.ts` (wklejenie z HTML do kompozytora, w miejscu kursora). Regresja: `e2e/composer.spec.ts`,
`quick-capture.spec.ts`, `editing.spec.ts`, `editor-keys.spec.ts`, `notes.spec.ts`, `mentions.spec.ts`,
`slash-menu.spec.ts`, `live-text.spec.ts` — 40/40.

**Commit.** `4b02b6f` (2026-10-16).

## Notatki — przesuwanie pozycji listy przyciskami (plan Notatek, etap 2)

**Co robi.** W edytorze listy każda nieodhaczona pozycja ma dwa przyciski: „Przesuń w górę” i „Przesuń w dół”.
Wyłączają się na krawędzi listy. Na komputerze pojawiają się po najechaniu lub fokusie, na dotyku są zawsze widoczne.

**Gdzie jest.** `src/components/ChecklistEditor.tsx`: `canMove(id, dir)`, przyciski w wierszu pozycji (obok „Usuń”).
Przesuwanie używa istniejącego `moveItem`, który zamienia pozycję z sąsiadem wśród nieodhaczonych.

**Jak działa i dlaczego.**
- Przeciąganie (dnd) odłożone: na dotyku jest zawodne przy przewijaniu, a przyciski są czytelne dla klawiatury
  i czytnika ekranu. Skrót Alt+↑/↓ działa jak dotąd.
- Odhaczone pozycje nie mają przycisków: nie są przesuwane, tak jak w `moveItem`.
- Kolejność zapisuje się przez `onChange` w tym samym polu `checklist`, więc synchronizacja i kopia działają bez zmian.

**Ograniczenia.** Przyciski są tylko w edytorze. Czytnik (podgląd) pozostaje tylko do odhaczania.
Przeciąganie pozycji jest odłożone; jeśli będzie potrzebne, to osobny etap.

**Testy.** `e2e/checklist-move.spec.ts` (kolejność po przesunięciach, wyłączenie na krawędzi).
Regresja: `e2e/checklist.spec.ts`, `e2e/reader.spec.ts` przechodzą.

**Commit.** `1ca6108` (2026-10-16).

## Notatki — nawigacja ←/→ w czytniku (plan Notatek, etap 1.1)

**Co robi.** W czytniku (podgląd i pełny ekran) ←/→ przechodzi do poprzedniej i następnej notatki z listy,
którą widzisz. Na pasku czytnika są też przyciski „Poprzednia notatka” i „Następna notatka” (dla dotyku).
Na krawędzi listy przycisk jest nieaktywny.

**Gdzie jest.**
- `src/lib/readerStep.ts`: `readerNeighbors(ids, current)` — sąsiedzi w liście; notatka spoza listy nie ma sąsiadów.
- `src/components/NoteReader.tsx`: props `onStep`, `canPrev`, `canNext`; efekt ←/→ w obu trybach; przyciski na pasku.
- `src/pages/Index.tsx`: `readerSteps` (sąsiedzi z `visibleNotes` bez notatek prywatnych), `stepReader`
  (przełącza w tym samym trybie: podgląd zostaje podglądem, prezentacja prezentacją).

**Jak działa i dlaczego.**
- Lista to `visibleNotes` — kolejność widoku, bez zwiniętych grup. Krok idzie po tym, co widzisz, a nie po wszystkich notatkach.
- ←/→ są ignorowane w polach tekstowych, w `SELECT` i przy klawiszach z modyfikatorami (Ctrl, Alt, Shift),
  żeby nie kraść strzałek z edycji.
- Notatki prywatne są pomijane w krokach (czytnik ich nie otwiera).

**Ograniczenia.** Notatka otwarta z wyniku innego widoku (np. z linku) nie ma sąsiadów w bieżącej liście i krok nic nie robi.

**Testy.** `src/lib/readerStep.test.ts` (sąsiedzi w środku, na krawędzi, spoza listy, pojedyncza notatka),
`e2e/reader-step.spec.ts` (Spacja → ←/→ → przyciski, nieaktywne krawędzie, tryb podglądu zostaje).

**Commit.** `86479bf` (2026-10-16).

## Notatki — udostępnianie z innej aplikacji (Share Target)

**Co robi.** „Udostępnij → NOTKI” z innej aplikacji tworzy nową notatkę. Tytuł, tekst i link trafiają do treści (link
bez dubla, jeśli już jest w tekście). Obrazy stają się zdjęciami notatki, PDF — załącznikiem. Inne typy (np. `.txt`,
`.docx`) są pomijane, a toast mówi, których nie przyjęto. Po zapisie toast „Zapisano w NOTKACH” z „Otwórz”.

**Gdzie jest.**
- `public/manifest.webmanifest` → `share_target`: `POST /share`, `multipart/form-data`, pola `title`, `text`, `url`
  oraz `files` z `accept: ["image/*", "application/pdf"]`.
- `public/sw-share.js` (dołączany przez `workbox.importScripts` w `vite.config.ts`): przechwytuje `POST /share`,
  zapisuje pliki do Cache Storage `share-inbox-v1` i przekierowuje (303) na `/share?inbox=<id>`.
- `src/lib/shareInbox.ts`: `takeShareInbox(id)` — odbiera i kasuje wpis; `importSharedFiles(files, used)` — obrazy
  przez `prepareImage` + `imageStore.putBlob` (jak w pasku dodawania), PDF przez `addAttachmentFiles`.
- `src/lib/shareTarget.ts`: `parseShare` (tekst i link z GET, jak wcześniej) — odbiór z pliku przechodzi przez niego
  z zapisanymi polami.
- `src/hooks/useLaunchIntents.ts` (wołany z `Index.tsx`): efekt montowania — gałąź `?inbox=` przed starą gałęzią `/share`.

**Jak działa i dlaczego.**
- Dwa etapy, bo POST nie ma gdzie wylądować: aplikacja może się nie załadować w chwili udostępnienia, a SW jest
  jedynym miejscem, które przechwyci żądanie. Dlatego SW odkłada dane i przekierowuje, a aplikacja odbiera je po starcie
  (po `whenNotesReady`).
- Klucze w cache: `/share-inbox/<id>/f<i>` (bajty pliku, nazwa URI-zakodowana w `x-name`) i `/share-inbox/<id>/meta`
  (JSON: `title`, `text`, `url`, `files`). **Meta zapisywana ostatnia** — przerwany zapis nie da notatki bez plików.
- Pliki wędrują tą samą drogą co załączniki z edytora (SHA-256, deduplikacja, limity 10 MB na plik, 100 MB łącznie),
  więc PDF z udostępnienia jest taki sam jak dodany ręcznie. Obrazy nie idą do załączników — zostają zdjęciami.
- Wpis w cache jest kasowany przy odbiorze (także gdy plików brakuje), żeby nie zostawał.

**Ograniczenia i pułapki.**
- Działa tylko w zainstalowanej PWA i tylko z aktywnym SW. Stara wersja SW nie przechwyci POST-a — po aktualizacji
  pierwsze udostępnienie z plikiem może trafić na zwykłą stronę 405 zamiast do aplikacji (do ponownego udostępnienia).
- `?inbox=0` oznacza, że SW nie zapisał (np. brak miejsca w cache); aplikacja pokazuje „Nie udało się odebrać”.
- Maks. 30 plików w jednym udostępnieniu; obrazy powyżej 2 MB są zmniejszane, a jeśli się nie dają — pomijane z toastem.
- Tekst ucinany do 20 000 znaków, tytuł do 200 (jak przy GET).
- Dedup `claimShare` dotyczy tylko udostępnień tekstowych; wpis z plikami jest jednorazowy z natury (kasowany).

**Testy.** `src/lib/shareInbox.test.ts` (odbiór, kasowanie, brak meta, ograniczenie liczby plików, rozdział typów),
`src/lib/manifest.test.ts` (POST, `accept`), `src/lib/shareTarget.test.ts` (tekst bez zmian),
`e2e/share-files.spec.ts` (PDF → załącznik, zdjęcie → obraz; formularz POST przez SW), `e2e/routes.spec.ts` (tekst z GET).

**Commit.** `0aa1c77` (2026-10-16).

## Notatki — przesunięcie kafla (telefon)

**Co robi.** Na ekranie dotykowym przesunięcie kafla w prawo przypina go (albo odpina przypięty), w lewo archiwizuje
(w Archiwum: przywraca). Po przypięciu dymek „Przypięto”/„Odpięto” z „Cofnij”, po archiwizacji jak dotąd
„Zarchiwizowano” z „Cofnij”. Kosz nie ma gestu — jest w arkuszu akcji „⋯”, żeby przypadkowy ruch kciuka niczego nie
usuwał. Przy pierwszych 3 gestach tło obok ikony podpisuje akcję („Przypnij”, „Archiwizuj”), potem zostają ikony.

**Gdzie jest.**
- `src/components/NoteCard.tsx`: `canSwipePin`, `canSwipeArchive`, `swipeEnabled`, `handleSwipeEnd`, tła gestu
  `data-swipe-bg="pin"` / `"archive"` (renderowane tylko w trakcie gestu), stan `swipeLabels`.
- `src/lib/swipeHint.ts`: `showSwipeLabels`, `countSwipe`, klucz localStorage `kaczy.swipeHints.v1` (liczba
  wykonanych gestów, maks. `SWIPE_HINT_LIMIT` = 3).
- `src/components/OnboardingTour.tsx`: opis gestu w kroku 2 na telefonie.

**Jak działa i dlaczego.**
- Gest startuje ręcznie (`useDragControls`) poza uchwytem przeciągania (`[data-drag-handle]` należy do dnd-kit),
  `touch-action: pan-y` — przewijanie w pionie działa dalej. Próg 110 px albo 60 px przy szybkim ruchu.
- Przypięcie przez `onTogglePin` z `NoteViewActions` (ta sama ścieżka co przycisk pinezki, z iskrą `markPinned`);
  archiwizacja przez `runWithoutConfirm` — gest jest odwracalny „Cofnij”, więc bez okna potwierdzenia.
- Kierunki: w Archiwum tylko w lewo (przywróć), w Koszu brak gestu, w trybie zaznaczania i w edycji brak gestu.
- Licznik podpisów czytany na starcie gestu, liczony przy wykonanym geście (nie przy cofniętym w połowie).

**Ograniczenia i pułapki.**
- Licznik jest na urządzeniu (localStorage), nie w synchronizacji.
- Na tablicy pierwsza kolumna to „Przypięte” — w testach na 390 px kolumny dalej są poza ekranem.

**Testy.** `src/lib/swipeHint.test.ts`, `e2e/board-table.spec.ts` („dotyk: przesunięcie kafla w prawo przypina, w
lewo archiwizuje; podpisy tylko na początku”, „przytrzymanie uchwytu … ” — ruch na uchwycie nie przypina ani nie
archiwizuje).

**Commit.** `1d1811c` (2026-10-15).

---

## Notatki — otwarcie pełnego edytora z kafla

**Co robi.** Pełny edytor (na telefonie każde otwarcie notatki, na komputerze „Pełny ekran”) rośnie z kafla, który
stuknięto, i przy zamknięciu do niego wraca — zamiast pojawiać się na środku ekranu. U góry okna jest pasek koloru
notatki, jak na kaflu. Tytuł i pasek narzędzi tworzą nagłówek, który dostaje cień dopiero wtedy, gdy treść pod nim
jest przewinięta.

**Gdzie jest.**
- `src/hooks/useOriginFromTile.ts`: `useOriginFromTile(panel, noteId, active, cssScale)` — wspólny z czytnikiem
  (`NoteReader.tsx`, wcześniej lokalna funkcja).
- `src/components/NoteCard.tsx`: stan `editorPanel` (ref-callback na `DialogContent`), `editorScrolled`,
  `onScrollCapture` na oknie, nagłówek `data-editor-header` / `data-scrolled` w `renderEditor(true)`,
  `data-note-color` na oknie.

**Jak działa i dlaczego.**
- Origin transformacji = środek kafla (`[data-note-id-wrap]`) we współrzędnych okna. Okno animuje `tw-animate-css`
  (`ui/dialog.tsx`), więc hook nadpisuje w stylu zmienne `--tw-enter/exit-scale` (0,9) i zeruje
  `--tw-enter/exit-translate-x/y` — okno rośnie z kafla zamiast wjeżdżać z góry. Bez `layoutId`, bo wspólny układ z
  kartą gryzłby się z dnd-kit.
- Element okna trzymany w stanie, nie w `useRef`: treść `Dialog` montuje się w portalu Radix render po otwarciu,
  więc zwykły ref był pusty w chwili pomiaru.
- Cień: zdarzenie `scroll` nie bąbelkuje, więc `onScrollCapture` na oknie łapie przewinięcie każdego przewijanego
  elementu (pole treści, lista, podgląd); nagłówek jest `sticky`, gdy przewija się samo okno.
- Pasek koloru to ta sama reguła `[data-note-color]` / `--note-ink` co na kaflu (3 px tła u góry).

**Ograniczenia i pułapki.**
- Kafel poza ekranem (np. otwarcie z palety lub z innego widoku) — okno rośnie ze środka.
- Przy ograniczonym ruchu działa jak dotąd (animacje okien wyłącza globalne ustawienie).

**Testy.** `e2e/editor-open.spec.ts` (origin, brak przesunięcia, skala, kolor, cień po przewinięciu i znika po powrocie
na górę), `e2e/reader.spec.ts` (czytnik na wspólnym hooku), `e2e/mobile.spec.ts`, `e2e/editing.spec.ts`.

**Commit.** `b091505` (2026-10-15).

---

## Notatki — właściwości notatek (4b)

**Co robi.** Własne pola przy notatkach, jak w Notionie: tekst, liczba, data albo wybór z listy opcji. Pola zarządza się
oknem „Pola” nad tabelą (dodaj, zmień nazwę, zmień opcje wyboru, usuń). Wartości wpisuje się prosto w komórki
tabeli — kolumna na każde pole, przed „Zmieniono”. Wartości zostają po odświeżeniu i synchronizują się między
urządzeniami.

**Gdzie jest.**
- `src/lib/noteProps.ts`: typy `PropDef`, `PropType` (`text | number | date | select`), `PropValue`, `NoteProps`;
  `cleanPropDef`, `cleanPropDefs`, `cleanNoteProps`, `parsePropInput`, `propValueFor`, `propDisplayText`,
  `withPropValue`, `propNameTaken`, `makePropDef`; limity w `PROP_LIMITS`.
- `src/lib/yjsStore.ts`: mapa `propDefs` (korzeń dokumentu), pole `props` na notatce, `applyPropsDiff`,
  `plainPropsFromY`, `projectPropDefs`, `upsertPropDef`, `deletePropDef`, `replaceAll(…, propDefs)`.
- `src/hooks/useNotes.ts`: `Note.props`, stan `propDefs` (obserwator `yjsStore.propDefsMap`), akcje `addPropDef`,
  `updatePropDef`, `deletePropDef`.
- `src/components/NoteTable.tsx`: kolumny pól w nagłówku i `PropCell` (edycja na miejscu).
- `src/components/PropDefsDialog.tsx`: okno „Pola notatek” (lazy, `Index.tsx`).
- `src/pages/Index.tsx`: przycisk „Pola (n)” nad tabelą, `onUpdate={updateNote}`.
- `src/lib/noteSchema.ts`: `props` w `noteSchema`, `propDefs` w `fullBackupSchema`.
- `src/lib/exportNotes.ts`: `buildFullBackupWithReport` zapisuje `propDefs` (tylko gdy są), `restoreFullBackup`
  przekazuje je do `replaceAll`.

**Jak działa i dlaczego.**
- **Dwa miejsca danych.** Definicja żyje w mapie `propDefs` w korzeniu Y.Doc (klucz = id, pola: `name`, `type`,
  `options`, `order`). Wartość żyje w `props` (Y.Map) konkretnej notatki, klucz = id definicji. Dzięki temu dwie
  równoległe zmiany różnych pól tej samej notatki się łączą (CRDT na kluczach), a zmiana nazwy pola nie rusza
  wartości — wiążą się przez id, nie przez nazwę.
- **Zapis tylko różnic.** `applyPropsDiff` zmienia klucze, które się zmieniły, i kasuje te, których nie ma w nowym
  słowniku — jak checklista. Pusta mapa po wyczyszczeniu wszystkich pól jest kasowana z projekcji (`props` znika).
- **Walidacja trzy razy tak samo.** Ten sam `cleanPropDef`/`cleanNoteProps` działa przy odczycie z dokumentu (może
  go zmienić peer), przy przywracaniu kopii i przy wejściu z komórki. Zły wpis jest pomijany, nie unieważnia notatki.
- **Liczba** przyjmuje przecinek i kropkę, pokazuje się z przecinkiem (`propDisplayText`). **Data** to tylko
  prawdziwa data `YYYY-MM-DD` (28.02 OK, 29.02 w nie-przestępnym roku odrzucone). **Wybór** przyjmuje tylko opcje
  z listy.
- **Usunięcie pola** kasuje definicję i jego wartości we wszystkich notatkach w jednej transakcji. Dlatego okno
  pyta w linii („Usunąć pole … i jego wartości?”) zamiast od razu usuwać.
- **Kopia zapasowa:** sekcja `propDefs` jest opcjonalna (jak `shifts`/`study`), więc wersja `version: 3` bez zmian.
  Kopia bez pól nie ma sekcji — wygląda jak dawniej. Stara aplikacja ignoruje nieznane pola.
- **Notatka prywatna** (`locked`) nie dostaje właściwości: nie ma ich w szyfrogramie, więc zapis do niej jest po
  cichu pomijany w `applyPatch`, a projekcja nie zwraca `props`. Komórki takiej notatki są tylko do odczytu (pusta).

**Ograniczenia i pułapki.**
- **Edycja tylko w tabeli** (widok „Tabela”, od `md`). Na telefonie kolumny są ukryte, więc tam pól nie wpiszesz —
  czytnik i edytor nie mają jeszcze sekcji właściwości.
- Typ pola jest stały po utworzeniu (zmiana typu wymagałaby konwersji wartości).
- Usunięcie opcji z listy nie kasuje wartości, które jej używały — taka wartość wyświetla się jako pusta (nie da się jej
  już wybrać), ale zostaje w dokumencie do czasu wyczyszczenia.
- Limity: 30 pól, nazwa 40 znaków, tekst 500, 20 opcji po 40 znaków, liczba do ±10¹².
- Próg `eagerJsGzip` w `e2e/bundle.spec.ts` podniesiony z 376 do 384 KB (zmierzone 380 KB po tej funkcji — koszt
  głównie w eager `NoteTable`/Yjs); do odzyskania przy LazyMotion i deduplikacji Radix.

**Testy.** `src/lib/noteProps.test.ts` (walidacja, formatowanie, nazwy), `src/lib/yjsStore.props.test.ts` (zapis,
patch, łączenie równoległych zmian, notatka prywatna, usunięcie pola, `replaceAll`, synchronizacja),
`src/lib/noteSchema.props.test.ts` (czyszczenie w kopii, stara kopia bez sekcji), `e2e/note-props.spec.ts` (dodanie
pola i wartość po odświeżeniu, walidacja liczby i wybór z listy, usunięcie z potwierdzeniem), `e2e/bundle.spec.ts`
(budżet JS).

**Commit.** `a5976a1` (2026-10-16).

---

- **Eksport.** Markdown (`exportToMarkdown`) dostaje wiersz `*Pole: wartość · …*` pod przypomnieniem, ZIP (`noteToMarkdownFile`, `buildNotesZip`, `downloadNotesZip`) klucz frontmatter `props` z mapą JSON (poprawny YAML). Jeden klucz, a nie klucz na pole, bo nazwa pola (np. `title`) zderzyłaby się z kluczami importu. Pola puste pomijane, kolejność jak w tabeli, liczby z przecinkiem jak w UI (`filledPropEntries` w `noteProps.ts`). Import czyta ten klucz z powrotem (patrz „Import z ZIP-a” niżej).
  Testy: `exportZip.test.ts`, `noteProps.test.ts`.

**Import z ZIP-a.** Pola z frontmattera `props` wracają do właściwości przy imporcie Markdown. Pole dopasowuje się do
istniejącej definicji po nazwie (bez wielkości liter i spacji na brzegach). Nieznane pole powstaje na nowo, o ile
mieści się w limicie 30 pól; typ wybiera się z wartości: wszystkie liczby (także z przecinkiem) → Liczba, wszystkie
`YYYY-MM-DD` → Data, w pozostałych przypadkach → Tekst. Pola typu Wybór nie da się wywnioskować, więc wartość trafia
tylko do istniejącej definicji wyboru i tylko wtedy, gdy opcja jest na liście; inaczej jest pomijana. Import tworzy
definicje przed notatkami i zapisuje wartości tą samą walidacją co UI (`parsePropInput`). Cofnięcie importu usuwa
utworzone przez niego definicje, ale tylko te, których żadna notatka nie używa (`ImportResult.createdPropDefIds`).

- `src/lib/import/markdown.ts`: `parsePropsFrontmatter` (JSON → mapa nazwa → wartość; zły JSON, tablica i wartości
  innych typów są pomijane; klucz `__proto__` odrzucany), `parseMarkdownNote` dokłada `props` tylko gdy są.
- `src/lib/import/types.ts`: `ParsedNote.props?: Record<string, PropValue>` (klucz to nazwa pola, nie id).
- `src/lib/import/commit.ts`: `inferPropType`, `resolvePropDefs`, obsługa `props` w `commitImportPlan`, usuwanie w
  `undoImport`.
- `src/lib/noteProps.ts`: `propNameKey` (wspólne porównanie nazw), `findPropDefByName`.

Import nie zmienia ani nie usuwa istniejących pól — dopisuje tylko brakujące definicje i wartości notatek importowanych.

  Testy: `src/lib/import/markdown.test.ts` (parser i pełny obieg eksport → parser), `src/lib/import/commit.test.ts`
  (dopasowanie po nazwie, typy, opcje wyboru, cofnięcie, pole użyte poza importem).

**Sortowanie i filtr po polach.** Nagłówek kolumny pola sortuje tabelę (`SortKey` = `prop:<id>`). Menu „Sortuj wg”
na komputerze i sekcja „Sortuj wg” w arkuszu „Widok i kolumny” na telefonie biorą opcje z jednego miejsca
(`src/lib/sortOptions.ts`). Puste wartości są zawsze na końcu, w obu kierunkach (`comparePropsForSort` w
`noteProps.ts`); liczby porównuje jak liczby, tekst z polskim porządkiem. Preferencja wskazująca usunięte pole
wraca do sortowania po dacie zmiany (`useFilteredNotes.ts`, `sortNotes`).

**Filtr `pole:`.** `pole:Nazwa=wartość` (wartość ze spacją w cudzysłowie: `pole:"Status=w toku"`),
`pole:Nazwa` znaczy „pole ma jakąkolwiek wartość”, `-pole:…` to negacja. Nazwa dopasowuje się bez wielkości
liter i ogonków; wartość też, a przecinek i kropka w liczbach są równoważne. Parser i dopasowanie: `searchQuery.ts`
(`parseSearchQuery`, `matchesProp`); definicje idą `propDefs` przez `useFilteredNotes` → `searchNotes` →
`matchesClauses`. Nieznana nazwa nie pasuje do niczego (a `-pole:` przepuszcza wszystko).

**Telefon.** W tabeli pod tytułem jest wiersz „Nazwa: wartość · …”, widoczny tylko poniżej `md` (`NoteTable.tsx`).
Czytnik ma sekcję „Pola” pod załącznikami (`NoteReader.tsx`): każde pole z definicji, także puste, z tym samym
`PropCell` co w tabeli, więc wartości da się zmienić bez wchodzenia w kartę. Escape w polu tylko cofa edycję
(jak w tabeli), czytnik zamyka przycisk „Zamknij”. Pusta wartość w tabeli i w czytniku pokazuje „—”.

**Ograniczenia i pułapki.** Sortowanie po polu obowiązuje we wszystkich widokach z listą, nie tylko w tabeli. Sekcja
"Sortuj wg" w arkuszu telefonu pojawia się tam, gdzie pokazuje się menu sortowania (`groupable` w `ViewSheet.tsx`).
Import pól z ZIP-a działa (patrz wyżej). Z `props` w imporcie Markdown nie idą pola z pojedynczego pliku `*Pole: …*`
(wiersz eksportu Markdown) — tylko frontmatter ZIP-a.

**Testy.** `src/lib/searchQuery.test.ts` (operator `pole:`), `src/lib/noteProps.test.ts` (`comparePropsForSort`,
`filledPropEntries`), `e2e/note-props-view.spec.ts` (sortowanie i filtr na komputerze; wartości pod tytułem,
edycja w czytniku i sortowanie w arkuszu na telefonie), `e2e/note-props.spec.ts` (istniejący), `e2e/bundle.spec.ts`
(budżet wejściowego JS).

**Commit.** `a5976a1` (2026-10-16) — pola i tabela; eksport MD/ZIP `fd377a5` (2026-10-16); sortowanie, filtr i telefon: `5bb3966` (2026-10-16); import pól z ZIP-a `f64dd9d` (2026-10-16).

## Grafik — czytelność drobnych znaczników

**Co robi.** W siatce miesiąca na telefonie strzałka nadgodzin (↑/↓) przy numerze dnia ma 11 px zamiast 9 px.
Podpis „Nowa odznaka” / „Pierwszy raz!” na pieczątce osiągnięcia też ma 11 px zamiast 10 px.

**Gdzie jest.** `src/components/shifts/ShiftMonthGrid.tsx` (znacznik `entry.extraMin`, tylko `sm:hidden`),
`src/components/AchievementStamp.tsx` (podpis nad emoji).

**Jak działa i dlaczego.** Oba używają tokenu `text-2xs` (0,6875 rem / 16 px wiersza, `tailwind.config.ts`) —
najmniejszego rozmiaru w aplikacji; wartości poniżej 11 px są nieczytelne w słońcu.

**Ograniczenia i pułapki.** Strzałka ma `leading-none`, więc nie podnosi wysokości nagłówka komórki.

**Testy.** `e2e/shifts.spec.ts`, `e2e/touch-targets.spec.ts` (bez zmian, przechodzą).

**Commit.** `6442da5` (2026-10-15).

---

## Praca — nagłówek i tablica tematów

`/praca` (`src/components/study/StudyView.tsx`): nagłówek „Instalacje wod-kan”, pasek opanowania
i zakładki Quiz / Tablica / Lista / Dziennik.

**Nazwa działu.** Do 2026-10-15 dział nazywał się „Nauka” (`/nauka`). W interfejsie jest „Praca” z ikoną kasku
(`HardHat`): pasek boczny (`sidebar/sidebarItems.ts`), „Więcej” (`BottomNav.tsx`), paleta poleceń, nagłówek (`AppHeader.tsx`),
szkielet ładowania, kopia zapasowa („Praca i dziennik z budowy”), skrót PWA „Wpis z budowy” (`/praca?wpis=1`
w `public/manifest.webmanifest`). `src/lib/viewRoute.ts` mapuje `praca` i `nauka` na widok `study`; linki budują
`/praca`, stary adres dalej działa (zakładki, zainstalowana aplikacja ze starym manifestem). Kod, klucze zapisu
i typy zostają przy `study` — zmiana nazwy nie rusza danych. Notatki tworzone z tematów dalej mają tytuł
„Nauka: …” i etykietę `nauka` — to opis treści (temat do nauki), nie nazwa działu.
Testy: `src/lib/viewRoute.test.ts`, `e2e/study.spec.ts` („stary adres /nauka nadal otwiera dział Praca”).
Commit: `b610ff6` (2026-10-15).

### Pasek opanowania

**Co robi.** Pokazuje, ile z 18 tematów jest w kolumnie „Umiem”, z podziałem na moduły
(Woda użytkowa, Kanalizacja, Wspólne). Każdy temat to kratka jak w zeszycie w rzędzie modułu.
Gdy cały moduł jest w „Umiem”, przy jego nazwie pojawia się krzywo ułożona pieczątka „Umiem”.
Dotknięcie lub kliknięcie kratki podpisuje temat i jego stan pod paskiem — na telefonie nie ma najechania kursorem.

**Gdzie jest.** `MasteryStrip` w `src/components/study/StudyView.tsx`; dane z `useStudy`,
`columnOf` (`store.ts`), `MODULES` i `TOPICS` (`content.ts`).

**Jak działa.** Moduły stoją obok siebie (`flex-wrap`, na wąskim ekranie zawijają się), a kratki
w module też się zawijają. Kratka to kwadrat 20 px (`size-5`) w polu 28 px (`size-7`), a na dotyku
44 px (`coarse:size-11`). Kolor: pełna = „Umiem”, połowa = „W trakcie”, pusta = „Do nauki”. Pusta kratka ma
obwódkę `border-foreground/50` (nie `border-border`), bo na papierze jasna obwódka była prawie niewidoczna
i stan „Do nauki” niósł tylko kolor. Wartość dobrana szacunkowo pod ~3:1 (nie zmierzono narzędziem); zrzuty w obu motywach czytelne. Każda
kratka to przycisk (`aria-label` „Temat: stan”, `aria-pressed`). Pieczątka `data-mastery-stamp`
pokazuje się, gdy `modDone === topics.length`, i jest obrócona o −3°, w kolorze `success-ink`.
Podpis pod paskiem ma `aria-live="polite"`. Wybór żyje tylko w stanie komponentu.
Licznik jest w JetBrains Mono (`font-mono tabular-nums`), bo w kroju nagłówków „1” wyglądała jak „l”.
Poprzednio odcinki miały szerokość proporcjonalną do liczby tematów (`flexGrow`) i były cienkimi paskami.

**Ograniczenia i pułapki.** Pieczątka pojawia się tylko przy pełnym module; moduł z jednym tematem
dostaje ją od razu po jego przeniesieniu do „Umiem”. Pieczątka jest tekstem, nie obrazkiem, więc czytnik ekranu czyta ją jako „Umiem” przy nazwie modułu.

**Testy.** e2e `e2e/study.spec.ts` („tablica: temat przechodzi między kolumnami…”: licznik
modułu i podpis po kliknięciu kratki; „pasek opanowania: pieczątka „Umiem” dopiero, gdy cały moduł jest w „Umiem””),
`e2e/resilience.spec.ts` (`mastery-count`).

**Commit.** `7f780d9` (2026-10-16).

### Karty tematów na tablicy

**Co robi.** Temat wędruje „Do nauki” → „W trakcie” → „Umiem” strzałkami przy tytule.
Pod opisem są przyciski z podpisami: „Wpis” (arkusz wpisu z tym tematem), „Ćwicz”
(runda quizu z tematu), „Do notatki” (notatka z listą kontrolną tematu).

**Gdzie jest.** `TopicCard` i `StudyBoard` w `src/components/study/StudyBoard.tsx`;
`moveTopic`, `practiceByTopic` (`store.ts`), `topicToNote` (`toNote.ts`).

**Jak działa.** Etykiety dostępności mają postać „Temat: wpis z budowy”, „Temat: ćwicz pytania”,
„Temat: do notatki”, „Temat: przenieś do „…””. Podpis widoczny jest zawarty w nazwie
dostępnej (WCAG 2.5.3). Na dotyku przyciski mają 44 px (`coarse:`), na komputerze 28 px.
Przesunięcie animuje `framer-motion` (`layoutId`).

**Testy.** e2e `e2e/study.spec.ts` (tablica, „Ćwicz”, „Do notatki”, wpis z karty tematu).

**Commit.** N1 `4c951fa` (2026-10-15).

## Praca — zapamiętana zakładka

**Co robi.** Dział Praca otwiera się na zakładce, na której go zostawiono. Bez zapisu telefon zaczyna od Dziennika
(wpis z budowy), komputer od Quizu.

**Gdzie jest.** `src/lib/study/tab.ts` (`readStudyTab`, `writeStudyTab`, klucz localStorage `kaczy.study.tab.v1`),
`src/components/study/StudyView.tsx` (`setTab` zapisuje każdą zmianę, też przejście do Quizu z „Ćwicz” i do Dziennika
przy otwarciu arkusza wpisu).

**Jak działa i dlaczego.** Zapis na urządzeniu, nie w Yjs: telefon i komputer służą do czego innego, więc
synchronizowana zakładka przeszkadzałaby. Telefon = `MOBILE_QUERY` (`hooks/use-mobile.tsx`), ten sam co dolny pasek.

**Ograniczenia i pułapki.** Nieznana wartość w kluczu (np. stara wersja) — domyślna zakładka. Testy e2e z 390 px
muszą ustawić rozmiar okna przed wejściem na /praca, inaczej startuje Quiz.

**Testy.** `src/lib/study/tab.test.ts`, `e2e/study.spec.ts` („zakładka działu Praca jest zapamiętana…”, „telefon bez
zapisanej zakładki zaczyna od Dziennika”).

**Commit.** `78a4538` (2026-10-15).

---

## Praca — powtórki pytań („Na dziś”)

**Co robi.** Każde pytanie, na które odpowiesz w quizie, wraca do powtórki: po dobrej odpowiedzi coraz rzadziej
(1 dzień, 3 dni, potem coraz dłużej), po błędzie — następnego dnia. Pod paskiem opanowania pojawia się „Na dziś: N
powtórek” (z każdej zakładki), a w Quizie ramka „Na dziś: N pytań do powtórki” z „Powtórz”. Runda powtórek bierze
najbardziej zaległe pytania (do 10). Gdy na dziś nic nie ma, Quiz mówi, kiedy następne („jutro”, „za 3 dni”, „24.10”).

**Gdzie jest.**
- `src/lib/study/srs.ts`: `ReviewCard`, `reviewCard` (następny stan po odpowiedzi), `dueIds(reviews, today)` (samo
  filtrowanie po terminie i sortowanie; parametr „znanych pytań” usunięty — znane pytania filtruje `sanitizeStudy`), `cleanCard`.
- `src/lib/study/yStudy.ts`: mapa Yjs `studyReview` (id pytania → karta), `StudyDump.review`, `StudyState.review`;
  `recordRound` aktualizuje karty w tej samej transakcji co runda; `replaceAll`/`mergeIn` (nowsza `last` wygrywa).
- `src/lib/study/store.ts`: `dueToday`, filtr kart po znanych pytaniach w `sanitizeStudy`.
- `src/components/study/QuizPanel.tsx`: zakres `{ kind: "due" }`, ramka „Na dziś”, „Następne: …”;
  `StudyView.tsx`: `DueTodayChip`.

**Jak działa i dlaczego.**
- SM-2 „lite” z oceną automatyczną (decyzja z planu): dobra odpowiedź = q 4 (łatwość bez zmian), zła = q 1 (od nowa,
  łatwość −0,2, min. 1,3). Bez pytania o samoocenę — jedno stuknięcie na budowie. Odstęp maks. 180 dni.
- Dni jako klucze lokalnego dnia („2026-10-15”), nie milisekundy: „jutro” znaczy jutro niezależnie od godziny rundy.
- Druga dobra odpowiedź tego samego dnia („Jeszcze raz”) nie wydłuża odstępu — inaczej powtarzanie rundy
  „przewijałoby” pytania o tygodnie. Błąd liczy się zawsze (licznik `lapses` — trudne pytania, pod N4).
- Klucz mapy per pytanie: dwa telefony odpowiadające na różne pytania scalają się bez strat; to samo pytanie — ostatni
  zapis wygrywa (Yjs).
- Kopia zapasowa: sekcja `study` niesie `review`; kopie sprzed N3 czytają się z pustymi powtórkami. Karty pytań
  usuniętych z materiału są pomijane w widoku.

**Ograniczenia i pułapki.**
- Pytania, na które jeszcze nigdy nie odpowiedziano, nie są „na dziś” — trafiają do zwykłej rundy.
- „Powtórka błędów” (`studyMissed`) zostaje osobno: to lista ostatnich błędów, powtórki to harmonogram.

**Testy.** `src/lib/study/srs.test.ts`, `src/lib/study/yStudy.test.ts` (terminy, scalanie dwóch telefonów, kopia,
`mergeIn` nie cofa nowszej karty), `src/lib/study/study.test.ts`, `e2e/study.spec.ts` („powtórki: pytania z rundy
wracają następnego dnia…” — zegar przestawiony na następny dzień).

**Commit.** `82b7366` (2026-10-15).

---

## Praca — powiązanie problemów z budowy z nauką

**Co robi.** Problem z budowy przypisany do tematu wraca do nauki: w dzienniku otwarty problem ma przycisk
„Ćwicz teraz” (runda pytań z tego tematu), a karta tematu na tablicy pokazuje ostatni problem — otwarty wyróżniony
(„Problem na budowie (14.10): …”), rozwiązany przygaszony. Przycisk „Ćwicz” na karcie mówi, ile pytań tematu jest
do powtórki dziś („2 na dziś”).

**Gdzie jest.**
- `src/lib/study/store.ts`: `TopicPractice.lastProblem` w `practiceByTopic` (otwarty ma pierwszeństwo przed nowszym
  rozwiązanym, wśród równych — najnowszy).
- `src/components/study/StudyBoard.tsx`: `TopicCard` (`data-topic-problem="open|resolved"`, licznik `topic-due`),
  `dueByTopic` z `dueToday` (N3).
- `src/components/study/StudyJournal.tsx`: „Ćwicz teraz” obok „Oznacz jako rozwiązany” (`aria-label` z nazwą tematu).

**Jak działa i dlaczego.** Wszystko liczone z dziennika i powtórek przy renderze — bez nowych danych w Yjs. Problem
przy temacie z „Umiem” już wcześniej cofał temat do „W trakcie”; teraz od razu prowadzi do ćwiczenia. Na karcie tylko
pierwsza linia opisu — karta ma zostać krótka.

**Ograniczenia i pułapki.** Wpis bez tematu nie ma „Ćwicz teraz”. Chip tematu we wpisie dalej też startuje ćwiczenie.

**Testy.** `src/lib/study/study.test.ts` („ostatni problem tematu: otwarty wygrywa…”), `e2e/study.spec.ts` („problem z
tematem: karta tematu pokazuje go, „Ćwicz teraz”…”).

**Commit.** `95f9c65` (2026-10-15).

---

## Praca — tablica i lista na telefonie

**Co robi.** Na telefonie tablica tematów pokazuje jedną kolumnę naraz, a nad nią przełącznik „Do nauki / W trakcie /
Umiem” z liczbą tematów (start od „W trakcie”, gdy coś tam jest). Przeniesienie tematu strzałką pokazuje dymek, dokąd
poszedł (karta znika z widocznej kolumny). Na liście „Wyczyść odhaczenia” działa bez pytania, z „Cofnij” w dymku;
pigułka „Tylko punkty krytyczne” i przycisk mają 44 px na dotyku.

**Gdzie jest.**
- `src/components/study/StudyBoard.tsx`: `ToggleGroup` „Kolumna tablicy” (`md:hidden`), `phoneCol`, sekcje
  `max-md:hidden` poza wybraną; `moveTo` (dymek tylko przy `MOBILE_QUERY`).
- `src/components/study/StudyChecklist.tsx`: `toastWithUndo` przy czyszczeniu.
- `src/lib/study/store.ts`: `resetChecklist()` zwraca wyczyszczone id, `restoreChecklist(ids)`;
  `yStudy.restoreChecked` — przywrócenie jedną transakcją.

**Jak działa i dlaczego.** Trzy kolumny pod sobą na telefonie to kilka ekranów przewijania, zanim dojdzie się do
„Umiem”. Od `md` (768 px) widać wszystkie trzy jak dotąd. „Cofnij” zamiast okna potwierdzenia — jak w reszcie aplikacji.

**Ograniczenia i pułapki.** Wybrana kolumna nie jest zapamiętywana (start zawsze od „W trakcie”/„Do nauki”). „Cofnij”
przywraca odhaczenia, ale punkty odhaczone w międzyczasie na drugim telefonie zostają.

**Testy.** `e2e/study.spec.ts` („telefon: tablica pokazuje jedną kolumnę z przełącznikiem, lista czyści odhaczenia
z „Cofnij””), `e2e/study.spec.ts` („lista do nauki…”).

**Commit.** `b87ef5b` (2026-10-15).

---

## Praca — statystyki

**Co robi.** Przycisk „Statystyki” pod paskiem opanowania otwiera okno z:
- kaflami: trafność ogółem (z liczbą odpowiedzi), dni nauki w ostatnich 30 dniach, seria, wpisy z budowy i otwarte problemy;
- trafnością per temat — poziome słupki od najsłabszego tematu, z procentem i „dobre/wszystkie”;
- najtrudniejszymi pytaniami (najwięcej pomyłek, do 5);
- siatką dni nauki z 12 tygodni (kratka = dzień z rundą quizu, dziś obwiedzione);
- wpisami z budowy per miesiąc (6 miesięcy, puste miesiące jako linia bazowa) i per budowa (do 6, reszta jako
  „Pozostałe”, z liczbą otwartych problemów).

**Gdzie jest.**
- `src/lib/study/stats.ts`: `overallAccuracy`, `accuracyByTopic`, `hardestQuestions`, `studyDaysGrid`, `daysInLast`,
  `entriesByMonth`, `entriesBySite` — czyste funkcje, bez importu materiału.
- `src/lib/study/srs.ts`: liczniki `seen`/`right` w `ReviewCard` (rosną przy każdej odpowiedzi, także drugiej tego
  samego dnia — harmonogram dalej liczy się raz na dzień).
- `src/lib/study/yStudy.ts` / `store.ts`: `StudyState.days` (dni z rundą, rosnąco) ze `studyDays`.
- `src/components/study/StudyStats.tsx`: `StudyStatsDialog`; przycisk w `StudyView.tsx`.

**Jak działa i dlaczego.**
- Trafność liczona z kart powtórek, nie z rund: karta zna każde pytanie z osobna, więc da się ją zsumować per temat.
  Karty sprzed N4 nie mają liczników — `cleanCard` szacuje je z pomyłek i dobrych odpowiedzi z rzędu.
- Wykresy jednoseryjne, jeden odcień (`primary`), bez biblioteki (recharts dodałby ~100 KB do paczki Pracy). Wartość
  zawsze podpisana tekstem obok słupka, więc kolor niczego nie koduje sam i legenda jest zbędna; `title` daje dymek z
  dokładną liczbą, a siatka dni ma `aria-label` z sumą.
- Na telefonie podpis tematu nad słupkiem (obok zostawało kilka liter); od `sm` w jednym wierszu.

**Ograniczenia i pułapki.**
- Trafność obejmuje odpowiedzi od wdrożenia powtórek (N3); starsze rundy znały tylko wynik całej rundy.
- Dni nauki to dni z rundą quizu — same wpisy z budowy ich nie dodają.
- Zero wpisów w miesiącu to linia 2 px (widać, że miesiąc jest, tylko pusty).

**Testy.** `src/lib/study/stats.test.ts`, `src/lib/study/srs.test.ts` (liczniki, stare karty), `e2e/study.spec.ts`
(„statystyki: trafność per temat, dzień nauki i wpisy po rundzie quizu”), `e2e/a11y.spec.ts`.

**Commit.** `94e16fc` (2026-10-15).

---

### Karta doświadczenia

**Co robi.** Na dole statystyk: budowy z wpisami, liczba prób szczelności (z pozytywnymi), opanowane tematy
z 18 (z nazwami) i trafność quizu. Przyciski „Kopiuj” (schowek) i „Pobierz .md” (`karta-doswiadczenia-RRRR-MM-DD.md`)
wysyłają ten sam tekst. Bez rund quizu trafność pokazuje „jeszcze bez rund”.

**Gdzie jest.** `src/lib/study/experience.ts`: `buildExperience(input)` (czysta funkcja, `ExperienceCard`) i
`experienceText(card, today)` (Markdown). Dialog: `src/components/study/StudyStats.tsx` (`StatsBody`, sekcja
„Karta doświadczenia”, `ExperienceRows` — podgląd jako lista definicji, `copyCard`, `downloadCard`).
Dane: trafność z `overallAccuracy` (`stats.ts`), budowy z `siteDirectory`, „Umiem” z `columnOf` (`store.ts`).

**Jak działa i dlaczego.** Liczenie jest w czystej funkcji, żeby tekst dało się przetestować bez przeglądarki.
Budowy liczą się, gdy mają wpisy (`count > 0`), także archiwalne — były budowami. Odmiana „odpowiedź / odpowiedzi”
przez `pluralPl`. Podgląd nie renderuje Markdownu: to te same liczby w czytelniejszej formie.

**Ograniczenia i pułapki.** Trafność to suma kart powtórek (`seen`/`right`), a nie tylko ostatnia runda.
Próby liczą się z wpisów z protokołem (`test`), bez względu na datę. Plik nazywa się po dniu lokalnym —
pobranie tego samego dnia nadpisze poprzedni plik w pobranych.

**Testy.** `src/lib/study/experience.test.ts` (liczenie, pusty stan, format i odmiana), `e2e/study.spec.ts`
(„statystyki: karta doświadczenia na pustym stanie i pobranie pliku .md”).

**Commit.** `16cc7e5` (2026-10-16).

## Praca — kolory z motywu, ikony ostrzeżeń, cele dotyku (P1)

**Co robi.** Zielony „OK”/„dobrze” w dzienniku i quizie oraz znaki punktów krytycznych biorą kolor z motywu (działają
w ciemnym motywie i stylach Neon/Zorza/Miedź), punkty krytyczne mają jedną ikonę `TriangleAlert` w kolorze ostrzeżenia
(wcześniej znak ⚠ raz bursztynowy, raz ostrzegawczy). Wynik rundy w kroju mono jak inne liczby. Pigułka tematu we
wpisie filtruje dziennik po temacie (wcześniej niespodziewanie startowała quiz — ćwiczenie jest pod „Ćwicz teraz”).
Licznik „Otwarte problemy” i pigułka tematu mają 44 px na dotyku.

**Gdzie jest.** `tailwind.config.ts` (`success.ink`, `warning.ink`), `study/JournalEntrySheet.tsx` (`KindIcon`,
`KIND_ON`), `study/QuizPanel.tsx`, `study/StudyChecklist.tsx`, `study/StudyBoard.tsx`, `study/StudyJournal.tsx`
(`JournalItem` dostał `onTopic`).

**Jak działa i dlaczego.** `success-ink`/`warning-ink` to ten sam wzór co `primary-ink`: `color-mix` koloru z czernią
wg `--ink-mix` (62% w jasnym, 100% w ciemnym i stylach ciemnych). Sam `--success` w jasnym motywie miał ~2,6:1 na
białym — za mało na ikonę; wersja „ink” przechodzi 3:1 dla ikon i 4,5:1 dla tekstu.

**Ograniczenia i pułapki.** Tła stanów zostają na `bg-success/10` (dekoracja), tylko krawędź i ikona w „ink”.

**Testy.** `e2e/study.spec.ts` (pigułka tematu filtruje, „Ćwicz teraz” startuje quiz), `e2e/a11y.spec.ts`,
`e2e/skins.spec.ts`, `e2e/touch-targets.spec.ts`.

**Commit.** `b61aba1` (2026-10-15).

---

## Praca — zwinięty nagłówek na Dzienniku (P2)

**Co robi.** Na zakładce Dziennik nagłówek działu to jeden wiersz: „Instalacje wod-kan”, licznik opanowanych tematów
„2/18” (stuknięcie otwiera Tablicę), „Na dziś: N” i ikona statystyk. Pełny nagłówek z paskiem opanowania i opisem
materiału zostaje na Quizie, Tablicy i Liście.

**Gdzie jest.** `src/components/study/StudyView.tsx` (`data-study-header="compact" | "full"`, `masteredCount`).

**Jak działa i dlaczego.** Na telefonie pełny nagłówek zajmował ~200 px nad „+ Wpis” i listą wpisów — a na budowie
Dziennik jest główną zakładką (N2). Licznik zostaje jako skrót do nauki.

**Ograniczenia i pułapki.** `data-testid="mastery-count"` jest w obu wariantach (testy smoke).

**Testy.** `e2e/study.spec.ts` („telefon bez zapisanej zakładki zaczyna od Dziennika” — zwinięty nagłówek, licznik
otwiera Tablicę z pełnym nagłówkiem).

**Commit.** `5dc3359` (2026-10-15).

---

## Praca — quiz pod kciuk i ściąga wysokości (P3)

**Co robi.** Na telefonie odpowiedzi w quizie mają co najmniej 56 px wysokości i większy tekst, a „Dalej” jest
przyklejony nad dolnym paskiem na całą szerokość — po odpowiedzi nie trzeba przewijać pod objaśnienie. Plakietka
„Zapisano” idzie wtedy wyżej, żeby nie zasłaniać przycisku. Ściąga „Wysokości podejść” (standard G-HEAT, duże cyfry
w kroju mono) otwiera się z nagłówka działu (pigułka „Wysokości”, na Dzienniku ikona miarki) i z arkusza wpisu, gdy
temat to „Punkty wodne i wysokości”.

**Gdzie jest.**
- `src/components/study/HeightsSheet.tsx`: `HeightsButton` (`pill` | `icon` | `link`) z oknem tabeli `HEIGHTS`.
- `src/components/study/QuizPanel.tsx`: `coarse:min-h-14` na odpowiedziach, blok „Dalej” z `data-sticky-action`
  i `phone:sticky` jako bezpośrednie dziecko sekcji.
- `src/components/OfflineStatus.tsx` (klasa `save-status`) + reguła w `src/index.css`:
  `html:has([data-sticky-action]) .save-status` na telefonie wyżej.
- `StudyView.tsx` (przyciski w obu nagłówkach), `JournalEntrySheet.tsx` (link przy temacie `punkty`).

**Jak działa i dlaczego.** `sticky` działa tylko w obrębie rodzica — przycisk siedzący w krótkim bloku objaśnienia nie
mógł się przykleić, dlatego jest osobnym dzieckiem sekcji quizu (sięga pod dolny pasek). Plakietka zapisu stała
dokładnie na wysokości przyklejonego przycisku i pojawia się po każdej odpowiedzi (zapis rundy) — `:has()` przesuwa ją
tylko, gdy na ekranie jest przyklejona akcja. Ściąga zostaje też na dole Listy (zwijany blok).

**Ograniczenia i pułapki.** Objaśnienie odpowiedzi może schodzić pod przyklejony pasek — czyta się je, przewijając,
a „Dalej” jest zawsze pod kciukiem. Lista znanych wyjątków axe (`e2e/a11y.spec.ts`) jest teraz pusta: na telefonie
skan widzi Dziennik ze zwiniętym nagłówkiem; pasek opanowania na innych zakładkach dalej ma wąskie komórki (wyjątek
„równoważna kontrolka”).

**Testy.** `e2e/study.spec.ts` („telefon: „Dalej” w quizie bez przewijania, ściąga wysokości z nagłówka i z arkusza
wpisu”), `e2e/a11y.spec.ts`.

**Commit.** `8abb8f4` (2026-10-15).

---

## Praca — zdjęcia „przed zakryciem” (P4)

**Co robi.** Wpis z budowy mieści 5 zdjęć (było 4). Przy każdej miniaturze w arkuszu wpisu jest przycisk „Podpis na
zdjęciu” (ikona T): wpisany tekst — np. „Łazienka, pion 58 cm” albo z pigułek „Przed zakryciem”, „Łazienka”,
„Kuchnia”, „Kotłownia” — i data wpisu są wtapiane w dolny pasek zdjęcia. W dzienniku powiększone zdjęcie ma
strzałki „Poprzednie/Następne”, licznik „2/5” i obsługę ←/→ — przewija wszystkie zdjęcia wpisu.

**Gdzie jest.**
- `src/lib/study/photoCaption.ts`: `captionLayout` (czcionka ~4,5% krótszego boku, min. 14 px; najwyżej 2 linie,
  druga z wielokropkiem), `captionText` (tekst do 80 znaków + „dd.mm.rrrr”), `captionPhoto` (canvas → JPEG 0,85).
- `src/components/study/JournalEntrySheet.tsx`: `burnCaption`, stan `captioning`/`captionDraft`, formularz podpisu.
- `src/components/study/StudyJournal.tsx`: stan `zoom` = `{ refs, index }`, galeria w oknie.
- `src/lib/study/yStudy.ts`: `JOURNAL_MAX_IMAGES = 5`.

**Jak działa i dlaczego.**
- Podpis wtopiony w piksele, nie trzymany obok: zdjęcie wysłane szefowi lub inwestorowi (WhatsApp, „Udostępnij”,
  paczka) niesie opis i datę ze sobą — to dowód „było zrobione przed zakryciem”. Nowy obraz przechodzi przez
  `prepareImage` (limit 2 MB) i zastępuje stary we wpisie; oryginał zostaje w magazynie do odśmiecenia (7 dni bez
  odwołań).
- Pasek półprzezroczysty czarny (62%) z białym tekstem — czytelny na każdym tle; białe podłoże pod zdjęciem, bo
  JPEG nie ma przezroczystości.
- Data to moment wpisu (pole „Kiedy”), nie chwila podpisania — wpis „za wczoraj” ma wczorajszą datę.

**Ograniczenia i pułapki.**
- Podpisu nie da się zdjąć (to inny plik) — usuń zdjęcie i dodaj ponownie.
- Starsza wersja aplikacji (limit 4) pokaże 4 zdjęcia wpisu, a edytując go, piąte zgubi.
- Kilka podpisów pod rząd = kilka nowych plików; nieużywane znikają przy odśmiecaniu.

**Testy.** `src/lib/study/photoCaption.test.ts`, `e2e/journal-photos.spec.ts` (limit 5 z komunikatem, podpis
podmienia zdjęcie, galeria: przyciski i strzałki).

**Commit.** `bd14a71` (2026-10-15).

---

## Praca — protokół próby szczelności (P5a)

**Co robi.** Przy tematach „Płukanie i próba szczelności” i „Próba kanalizacji na zalanie” arkusz wpisu ma przycisk
„Dodaj protokół próby szczelności”: czym próba (Powietrze / Woda / Zalanie), ciśnienie [bar], czas [min], spadek na
manometrze [bar] i wynik (Szczelna / Nieszczelna). Start: powietrze 6 bar (próba robocza z materiału), dla kanalizacji
— zalanie bez ciśnienia. Wpis pokazuje linię „Próba szczelności (woda, 9 bar, 30 min, spadek 0,1 bar): szczelna”
(zielona albo czerwona), a raport, notatka z raportu i wiadomość do szefa mają ją pod wpisem. Sam protokół (bez
tekstu) wystarcza, żeby zapisać wpis.

**Gdzie jest.**
- `src/lib/study/pressureTest.ts`: `PressureTest`, `TEST_TOPICS`, `defaultTest`, `cleanTest`, `testLine`.
- `src/lib/study/yStudy.ts` (`JournalEntry.test`, `cleanEntry`), `store.ts` (`NewJournalEntry.test`, `entryFields`,
  `sanitizeStudy`), `draft.ts` (`JournalDraft.test` w szkicu), `entrySheet.ts` (edycja), `report.ts` (`entryLine`).
- `src/components/study/PressureTestFields.tsx` (pola, `NumField` z przecinkiem dziesiętnym),
  `JournalEntrySheet.tsx` (sekcja pod tematem), `StudyJournal.tsx` (`data-testid="journal-test"`).

**Jak działa i dlaczego.** Pole wpisu, nie nowy rodzaj (decyzja): `cleanEntry` starszej wersji odrzuca nieznane
rodzaje — wpis by zniknął — a nieznane pole tylko pomija. Przy kanalizacji ciśnienie i spadek są zerowane
(`cleanTest`), żeby protokół nie niósł danych bez sensu. Pole liczby trzyma tekst lokalnie, więc „0,” nie znika
w trakcie pisania; liczby z przecinkiem jak na budowie.

**Ograniczenia i pułapki.** Starsza wersja aplikacji nie pokaże protokołu, a edytując wpis, zgubi go. Brak
podpisu/pieczątki w samym protokole — to część raportu (P5b).

**Testy.** `src/lib/study/pressureTest.test.ts`, `e2e/journal-pressure-test.spec.ts` (woda z wartościami → lista
i tekst raportu; zalanie bez ciśnienia, sam protokół zapisuje wpis).

**Commit.** `dcb1d66` (2026-10-15).

---

## Praca — raport jak druk firmowy i jedna główna akcja (P5b)

**Co robi.** Raport z budowy (podgląd, wydruk/PDF) ma: zestawienie dni na górze (od dwóch dni: dzień, godziny pracy
z Grafiku, liczba wpisów i problemów), linię protokołu próby przy wpisie, sekcję „Próby szczelności” ze wszystkimi
próbami okresu (nieszczelne na czerwono), a na końcu miejsca na podpisy „Wykonawca” i „Odbierający / kierownik”
oraz datę sporządzenia. Stopka okna: główna akcja to wysłanie przez WhatsApp (szefowi / do grupy / dodaj odbiorców),
obok „Udostępnij” (gdy telefon pozwala) i „Więcej” z „Kopiuj tekst”, „Do notatki”, „Drukuj / PDF”.

**Gdzie jest.** `src/components/study/JournalReport.tsx`: stopka (`DropdownMenu`), `ReportPaper` (`DaysTable`,
`data-report-test`, `data-report-tests`, `data-report-signatures`).

**Jak działa i dlaczego.** Siedem równorzędnych przycisków chowało to, po co się raport otwiera — wysłanie szefowi.
Raport z próbami, godzinami i podpisami służy jako dokument odbioru („było zrobione przed zakryciem”). Podgląd
i druk to ten sam komponent, więc wyglądają tak samo; w druku kolory zamieniają się na czarny (`index.css`).

**Ograniczenia i pułapki.** Zestawienie dni tylko przy raporcie z co najmniej dwóch dni. Menu „Więcej” otwiera się
w portalu — w testach `page.getByRole("menuitem", …)`, nie wewnątrz okna.

**Testy.** `e2e/journal-pressure-test.spec.ts` (protokół w podglądzie, zestawienie prób, podpisy), `e2e/study.spec.ts`
(„raport budowy…” przez menu „Więcej”), `e2e/report-whatsapp.spec.ts`.

**Commit.** `e9355ca` (2026-10-15).

---

## Praca — kształtki we wpisie

**Co robi.** Arkusz wpisu ma „Dodaj kształtki”: pozycje „nazwa + sztuki” (decyzja: tylko sztuki), podpowiedzi nazw z poprzednich wpisów i pigułki najczęstszych, duże −/+ (przy 1 sztuce „−” usuwa pozycję). Wpis pokazuje „Kolano 16 × 3, Mufa 32 × 1”; raport ma linię przy wpisie i sekcję „Kształtki (suma)” z okresu (też w tekście dla szefa).

**Gdzie jest.** `src/lib/study/fittings.ts` (`cleanFittings`, `sumFittings`, `fittingsLine`, `suggestFittingNames`), pole `fittings` w `yStudy.ts`, `store.ts`, `draft.ts`, `entrySheet.ts`, `report.ts` (`JournalReport.fittings`); `components/study/FittingsFields.tsx`, `JournalEntrySheet.tsx`, `StudyJournal.tsx`, `JournalReport.tsx`.

**Jak działa i dlaczego.** Pole wpisu jak protokół próby (starsza wersja je pomija). Ta sama nazwa w różnej pisowni sumuje się (`fittingKey`: bez wielkości liter, spacji i ogonków). Wiersze z pustą nazwą czyści dopiero zapis. `<fieldset>` ma `min-w-0` — domyślne `min-inline-size: min-content` rozpychało arkusz w bok na 390 px.

**Ograniczenia.** Do 20 pozycji, nazwa do 40 znaków, bez metrów rury.

**Testy.** `src/lib/study/fittings.test.ts`, `e2e/journal-fittings.spec.ts`.

**Commit.** `feb318e` (2026-10-15).

---

## Skrzynka — szybkie przechwycenie do posortowania (punkt 4 planu)

**Co robi.** Widok „Skrzynka” w pasku bocznym (licznik = liczba notatek do posortowania). Na górze pole:
Enter zapisuje tekst od razu, bez tytułu, folderu i etykiet. Pierwsza linia staje się tytułem (do 120 znaków),
reszta treścią. Dymek „Zapisano w skrzynce” ma „Cofnij”. Skrzynka pokazuje notatki bez folderu, bez etykiet
i nie będące podnotatkami. Przeniesienie do folderu albo nadanie etykiety usuwa notatkę ze skrzynki.

**Gdzie jest.**
- `src/lib/inbox.ts`: `isInboxNote` (reguła), `captureParts` (tekst → tytuł i treść), `INBOX_TITLE_MAX`.
- `src/components/InboxCapture.tsx`: pole na górze widoku, czyści się po zapisie.
- `src/hooks/useFilteredNotes.ts`: typ `View` z `"inbox"`, filtr w `filterNotes`.
- `src/lib/viewRoute.ts`: adres `/skrzynka`.
- `src/components/EmptyState.tsx`: nagłówek i opis pustej skrzynki.
- `src/components/sidebar/sidebarItems.ts`: pozycja „Skrzynka” z licznikiem; `src/pages/Index.tsx`: `inboxCount`, handler
  `captureToInbox`, render `InboxCapture`.

**Jak działa i dlaczego.**
- Brak nowego pola w danych: skrzynka to reguła nad istniejącymi notatkami. Nie trzeba migracji, synchronizacja
  i kopia zapasowa działają bez zmian, a sortowanie od razu opróżnia skrzynkę.
- Zapis idzie przez `handleAddNoteGlow`, tak jak w kompozytorze i udostępnianiu, więc widok `inbox` nie dokłada
  folderu ani etykiety (`activeLabel` jest pusty poza widokiem etykiety).
- Pole zapisuje się tylko dla niepustego tekstu; pusty Enter nic nie robi.

**Ograniczenia i pułapki.**
- Notatki w koszu i archiwum nie są w skrzynce (reguła działa na aktywnych notatkach).
- Starsze notatki bez folderu i etykiet też trafiają do skrzynki. To zamierzone: to „do posortowania”.
- Pasek „Zapisz notatkę…” nie pojawia się w skrzynce. Nowe notatki z szablonami robi się dalej w widoku Notatek.
- Jest wpis „Skrzynka” w palecie poleceń (`CommandPalette.tsx`). Brak pozycji w dolnej nawigacji telefonu (miejsce
  na pasku jest ograniczone) — tam skrzynkę otwiera się z paska bocznego albo z palety.

**Testy.** `src/lib/inbox.test.ts` (reguła skrzynki, podział tekstu), `src/components/InboxCapture.test.tsx` (Enter,
pusty tekst), `e2e/inbox-today.spec.ts` (zapis, licznik w pasku, „Cofnij”, pusta skrzynka).

**Commit.** `c8b9817` (2026-10-16).

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

## Praca — własne pytania i punkty listy (N5)

**Co robi.** Możesz dodać własne pytanie do quizu (z czterema odpowiedziami: poprawna i trzy błędne, plus wyjaśnienie)
i własny punkt do listy kontrolnej, przypięty do tematu. Własne wpisy liczą się jak materiał: są w puli quizu, w
powtórkach „Na dziś”, w statystykach trafności, w postępie tematu na tablicy i w arkuszu wpisu z budowy. Oznaczone
podpisem „własny”. Usunięcie daje „Cofnij”.

**Gdzie jest.**
- `src/lib/study/custom.ts`: typy `CustomQuestion` / `CustomItem` / `CustomEntry`, `cleanCustom`, `cleanCustomList`,
  `questionOptions` (poprawna pierwsza, jak w materiale), limity (`CUSTOM_MAX` 200, tekst 300, odpowiedź 200,
  wyjaśnienie 500 — za długie przycinane).
- `src/lib/study/yStudy.ts`: mapa Yjs `studyCustom` (klucz = id), pole `custom` w `StudyState` i w `StudyDump`
  (sekcja `study` kopii, opcjonalna), `addCustom`, `removeCustom` (też powtórki, błędy i odhaczenie), `restoreCustom`.
- `src/lib/study/store.ts`: `studyLists(custom)` (materiał + własne), hook `useStudyLists()`, `addCustomItem`,
  `addCustomQuestion`, `removeCustomEntry`, `restoreCustomEntry`; `sanitizeStudy` waliduje własne wpisy temat po temacie.
- `src/lib/study/customActions.ts`: `deleteCustom` — usunięcie z „Cofnij”.
- `src/components/study/CustomChecklistForm.tsx`: sekcja „Własne punkty” (zwijana, pod listą), `TopicSelect`.
- `src/components/study/CustomQuestionsDialog.tsx`: okno „Moje pytania” (formularz + lista), `draftError` z komunikatami.
- `src/components/study/QuizPanel.tsx`: przycisk „Moje pytania (n)” na ekranie startowym; pule rund z `lists.questions`.
- Komponenty czytające materiał (`StudyBoard`, `StudyStats`, `StudyJournal`, `JournalEntrySheet`, `StudyChecklist`)
  biorą listy z `useStudyLists()` zamiast importować `CHECKLIST` / `QUESTIONS` wprost.

**Jak działa i dlaczego.**
- Materiał G-HEAT zostaje statyczny w `content.ts`; własne wpisy są w Yjs, więc synchronizują się z sparowanymi
  telefonami i jadą w kopii, bez zmiany materiału. Id zaczynają się od `c-`, żeby nie kolidowały z materiałem.
- Każdy wpis to osobny klucz mapy — dwa telefony dodające różne pytania scalają się bez strat (jak dziennik i powtórki).
- Walidacja tematu jest w `store.ts`, nie w `custom.ts`: `yStudy.ts` nie może importować materiału (patrz komentarz
  na górze pliku), a tylko store zna listę tematów. Wpis z obcym tematem od peera jest po prostu pomijany.
- Usunięcie czyści `review`, `missed` i `checked` dla tego id. Bez tego zostałyby osierocone wpisy, które przy
  przywróceniu (cofnięciu) pojawiłyby się z historią, której użytkownik się pozbył.
- Pytanie własne ma poprawną odpowiedź zawsze pierwszą (jak w materiale); `buildRound` miesza ją sam.

**Ograniczenia i pułapki.**
- Import plików (PDF, tekst) do Nauki — poza zakresem N5 (`import plików później`).
- Pytania i punkty muszą mieć cztery różne odpowiedzi (lub unikalną treść punktu); duplikaty odrzuca `cleanCustom`.
- Starsza wersja aplikacji nie zna mapy `studyCustom`: własne wpisy jej nie pokażą, ale nic nie zepsuje (klucze
  materiału są nietknięte). Wpis dziennika odwołujący się do własnego punktu zachowuje id; po usunięciu punktu
  odhaczenie znika z wpisu (filtr przy odczycie).
- Limit 200 własnych wpisów łącznie; po przekroczeniu dodanie zwraca `null` i formularz pokazuje komunikat.
- Kopia zapasowa sprzed N5 nie ma pola `custom` — `cleanDump` traktuje brak jako pusty zbiór.

**Testy.** `src/lib/study/custom.test.ts` (walidacja, limity, odpowiedzi), `src/lib/study/customStore.test.ts`
(scalenie z materiałem, dodanie, usunięcie z powtórkami i cofnięcie, odrzucanie obcych tematów),
`src/lib/study/yStudy.test.ts` („własne wpisy Nauki w Yjs”: synchronizacja, usunięcie na drugim telefonie, scalanie
i przywracanie kopii), `e2e/study-custom.spec.ts` (punkt: dodanie, przeładowanie, usunięcie z „Cofnij”; pytanie:
walidacja formularza, zapis, licznik quizu).

**Commit.** `8725703` (2026-10-16).

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

## Praca — kalkulatory na budowę

**Co robi.** Przycisk „Kalkulatory” w nagłówku działu (obok „Wysokości”; na Dzienniku jako ikona) otwiera okno z trzema
kalkulatorami:
- **Spadek kanalizacji** — z długości i spadku liczy różnicę wysokości (szybkie 2 / 2,5 / 3%), albo z długości
  i różnicy wysokości — spadek w %. Poza typowymi 2–3% pokazuje podpowiedź „sprawdź wymagany spadek dla tej średnicy”.
- **Próba wodna** — z ciśnienia roboczego: ciśnienie próbne (1,5 × robocze) i najmniejszy zakres manometru (+50%),
  z przypomnieniem o podziałce 0,1 bar, odpowietrzeniu i o próbie roboczej 6 bar / protokole 9 bar.
- **Pojemność instalacji** — kilka odcinków (rura 16×2, 20×2, 25×2,5, 32×3 albo inna średnica wewnętrzna) i suma litrów.

**Gdzie jest.** `src/lib/study/calc.ts` (`parseNum`, `plNum`, `slopeDrop`, `slopeFromDrop`, `slopeNote`, `SLOPE_TYPICAL`,
`waterTest`, `PIPES`, `pipeLiters`); `src/components/study/CalculatorsSheet.tsx` (`CalculatorsButton`, okno
`data-testid="calculators"`); przyciski w `StudyView.tsx`.

**Jak działa i dlaczego.** Liczby normowe tylko z materiału G-HEAT (`content.ts`: spadki „ok. 2–3%”, próba wodna
1,5 × robocze, manometr +50% i podziałka 0,1 bar, próba robocza 6 bar, protokół 9 bar) — aplikacja nie dopisuje norm
z zewnątrz. Reszta to geometria: 1% = 1 cm na metr, pojemność π·r²·L, średnica wewnętrzna = zewnętrzna − 2 × ścianka.
Pola przyjmują przecinek i kropkę; wyniki po polsku, dużym krojem mono (czytane z wyciągniętej ręki).

**Ograniczenia i pułapki.**
- Nie ma doboru średnic — materiał każe brać je z projektu, a w razie wątpliwości pytać Grzegorza.
- Spadek „typowy” to podpowiedź; wymagany spadek zależy od średnicy (materiał nie podaje tabeli).
- Wartości nie zapisują się (kalkulator jest na chwilę).

**Testy.** `src/lib/study/calc.test.ts` (6: liczby z przecinkiem, zapis po polsku, spadek w obie strony, podpowiedź
2–3%, próba wodna, pojemność i wymiary rur). `e2e/calculators.spec.ts` (spadek w obie strony z podpowiedzią, próba
wodna, pojemność dwóch odcinków). Regresja: `study.spec.ts` 29/29 (z kalkulatorami), układ telefonu `iphone-14` 19/19.
Zrzuty z telefonu (390 px) obejrzane; opis rury w polu wyboru skrócony do „16×2 · 12 mm”, bo się ucinał (`c2c112b`).

**Commit.** `7740d29` (2026-10-16).

## Praca → Dziennik budowy

Zakładka „Dziennik” na `/nauka` (`src/components/study/StudyJournal.tsx`). Dziennik instalatora
wod-kan: co zrobione, jakie problemy, zdjęcia, na której budowie — połączone z tematami
materiału do nauki.

### Model danych i synchronizacja

**Co robi.** Wpisy, karty budów i postęp Nauki synchronizują się między urządzeniami razem
z notatkami i trafiają do kopii zapasowej.

**Gdzie jest.**
- `src/lib/study/yStudy.ts` — `createYStudy(doc)`, typy `JournalEntry`, `StudyState`, `StudyDump`,
  czyszczenie wejścia `cleanEntryParts` (wspólna część wpisu: tekst, odhaczenia, zdjęcia, próba, kształtki, etap,
  lokalizacja, flaga `empty`), `cleanEntry` (kształt wpisu, z `cleanEntryParts`), `cleanDump`, `dumpFromLegacy`,
  `stateFromDump`, `journalRefsIn`.
- `src/lib/study/data.ts` — jedyna instancja `yStudy` na `yjsStore.doc`, `studyDevice()`,
  migracja ze starego zapisu, `useStudyReady`.
- `src/lib/study/store.ts` — fasada dla widoków: `useStudy`, `getStudy`, `sanitizeStudy`
  (projekcja przefiltrowana przez materiał z `content.ts`; każdy wpis przechodzi przez `cleanEntry` z `yStudy.ts`,
  czyli tę samą regułę co kopia i dokument, a `sanitizeStudy` dokłada tylko filtr tematu i odhaczeń) i akcje (`addJournalEntry`,
  `updateJournalEntry`, `removeJournalEntry`, `restoreJournalEntry`, `setProblemResolved`,
  `setSite`, `saveSiteCard`, `setSiteArchived`).
- `src/lib/study/keys.ts` — klucze localStorage.

**Jak działa.**
- Mapy Yjs w dokumencie notatek: `studyJournal` (id → wpis), `studySites` (id → karta budowy),
  `studyBoard`, `studyChecked`, `studyMissed`, `studyDays`, `studyRounds` (per urządzenie),
  `studyMeta` (m.in. `site` — bieżąca budowa arkusza), `studyMigrations`.
- Każdy wpis i każda karta to osobny klucz mapy, więc dwa telefony dopisujące wpisy offline
  scalają się bez strat.
- `yStudy.ts` nie importuje materiału (`content.ts`), bo jest w głównej paczce (odśmiecanie
  zdjęć, kopia). Przynależność do materiału sprawdza `store.ts`.
- Wpis (`JournalEntry`): `id`, `at` (ms), `kind` (`ok` | `problem` | `note`), `topic`, `text`,
  `site` (kopia nazwy budowy), `siteId?`, `checked` (punkty listy kontrolnej), `images`
  (klucze `imageStore`), `resolved?` (tylko problem).
- Migracja: dawny zapis `kaczy.study.v1` z localStorage przenoszony raz na urządzenie
  (`mergeIn` + znacznik urządzenia w `studyMigrations` w tej samej transakcji). Stary klucz
  zostaje jako kopia.
- Kopia zapasowa: sekcja `study` (`StudyDump`, z kartami budów) oraz Nauka w dawnym
  kształcie w `settings` dla starszych wersji aplikacji. Przy przywracaniu jest osobny
  przełącznik „Nauka i dziennik z budowy”; `replaceAll` zastępuje dane, nie scala.

**Ograniczenia.** Bez limitu liczby wpisów. Tekst do 2000 znaków (`JOURNAL_MAX_TEXT`),
4 zdjęcia na wpis (`JOURNAL_MAX_IMAGES`), nazwa budowy do 120 znaków.

**Testy.** `src/lib/study/yStudy.test.ts` (dwa dokumenty Yjs), `src/lib/study/study.test.ts`,
`src/lib/fullBackup.test.ts`, e2e `e2e/study.spec.ts` (migracja ze starego zapisu).

**Commity.** D1 `6045b5a` (2026-10-15).

### Arkusz wpisu (nowy wpis i edycja)

**Co robi.** Szybki wpis z telefonu: rodzaj (3 duże przyciski), budowa, kiedy, tekst
z dyktowaniem, zdjęcia z aparatu lub galerii, temat z listą kontrolną. Ten sam arkusz
poprawia zapisany wpis i go usuwa (z „Cofnij”).

**Gdzie jest.**
- `src/components/study/JournalEntrySheet.tsx` — arkusz (od dołu na telefonie, z boku na komputerze).
- `src/lib/study/entrySheet.ts` — stan otwarcia (`openJournalSheet`, `closeJournalSheet`,
  `useJournalSheet`) i formularz edycji (`openJournalEdit`, `patchJournalEditForm`,
  `getJournalEditForm`).
- `src/lib/study/draft.ts` — szkic nowego wpisu (`useJournalDraft`, `patchJournalDraft`,
  `clearJournalDraft`, `setJournalDraftTopic`). Pola czyści `cleanEntryParts` (ta sama funkcja co dziennik i kopia);
  szkic, w przeciwieństwie do wpisu, nie odrzuca pustego zapisu.
- `src/lib/study/images.ts` — `journalImageRefs()` chroni zdjęcia przed odśmiecaniem.

**Jak działa.**
- Szkic nowego wpisu żyje w localStorage `kaczy.study.draft.v1`. Przeżywa zmianę zakładki,
  „Wpis z budowy” z karty tematu (zmienia tylko temat) i odświeżenie strony.
- Edycja ma osobny formularz tylko w pamięci, więc poprawka starego wpisu nie rusza
  szkicu. Zamknięcie arkusza bez zapisu porzuca edycję.
- Zdjęcia: `prepareImage` → `imageStore`, w trakcie obróbki kafelek z kółkiem i zablokowany
  zapis. Limit miejsc liczony z góry, więc dwa szybkie wybory nie przekroczą 4 zdjęć.
  Przy pierwszym zdjęciu aplikacja prosi o trwały zapis (`requestPersistentStorage`).
- Zdjęcia szkicu, edycji i starego zapisu (przed migracją) są w `journalImageRefs()` —
  bez tego odśmiecanie skasowałoby je po karencji.
- Pigułka „Kiedy” (`datetime-local`, „Teraz”) pozwala na wpis „za wczoraj”. Przyszłość jest
  przycinana do chwili zapisu.
- Pigułka budowy: przy pustej budowie pokazuje 3 ostatnie budowy, przy edycji pola do
  6 pasujących (`suggestSites` w `journalView.ts`, bez polskich znaków). Archiwalne budowy
  się nie podpowiadają. Kliknięcie pigułki nie zabiera fokusu z pola (`onPointerDown`
  z `preventDefault`).
- Dyktowanie (`useDictation`) dopisuje rozpoznane zdanie na końcu tekstu. Bez Web Speech
  albo bez internetu jest podpowiedź o mikrofonie klawiatury.
- **Praca — dyktowanie wpisu ze skrótu (U5).** `/praca?wpis=1&glos=1` otwiera arkusz i włącza dyktowanie od razu
  (`glos=1` bez `wpis` nic nie robi). `StudyView.tsx` czyta `glos`, zdejmuje oba parametry z adresu i ustawia
  żądanie (`requestVoiceOnOpen`, `takeVoiceRequest` w `lib/study/entrySheet.ts` — jednorazowe). `JournalEntrySheet.tsx`
  przy otwarciu bierze żądanie i wywołuje `toggle()` z `useDictation`. Bez zgody zapisanej na urządzeniu `toggle()`
  pokazuje dotychczasowe pytanie o zgodę, więc pierwsze użycie zawsze wymaga kliknięcia. Bez Web Speech dyktowanie
  po prostu się nie zaczyna. Skrót PWA: `public/manifest.webmanifest`. Testy: `e2e/study.spec.ts` („skrót „Wpis
  głosowy””), `src/lib/manifest.test.ts` (kolejność i adresy skrótów).
- Problem przy temacie z kolumny „Umiem” cofa temat do „W trakcie” (też przy edycji
  wpisu na problem lub zmianie tematu problemu).
- Wejścia: „+ Wpis” w nagłówku dziennika, „+” w dolnym pasku na `/nauka`, skrót PWA
  „Wpis z budowy” (`/nauka?wpis=1`), „Wpis z budowy” z karty tematu (temat rozwinięty).

**Ograniczenia i pułapki.** Pusty wpis (bez tekstu, punktów i zdjęć) się nie zapisuje.
W e2e otwarty arkusz ukrywa zakładki z drzewa dostępności — w testach `includeHidden: true`.

**Testy.** `src/lib/study/study.test.ts` (szkic, edycja, problemy), e2e `e2e/study.spec.ts`
(szkic ze zdjęciem po odświeżeniu, wpis „za wczoraj”, usuwanie z „Cofnij”, dyktowanie,
telefon: „+” i skrót).

**Commity.** D0 `df308d5`, D2 `92c1015`, D3 `1c40b26`, pigułki budów D4a `b41e3c9` (2026-10-15).

### Problemy otwarte i rozwiązane

**Co robi.** Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego. Licznik
„Otwarte problemy: N” w nagłówku dziennika filtruje do nich.

**Gdzie jest.** Pole `resolved` w `JournalEntry`; `setProblemResolved`, `openProblems`
w `store.ts`; `yStudy.setResolved`; przyciski „Oznacz jako rozwiązany” / „Otwórz ponownie”
w `StudyJournal.tsx`.

**Jak działa.** `resolved` to moment rozwiązania (ms). Brak pola oznacza problem otwarty.
`cleanEntry` trzyma `resolved` tylko przy rodzaju `problem`. Filtr rodzaju `open` w `filterJournal`.

**Testy.** `study.test.ts`, `yStudy.test.ts` (rozwiązanie przechodzi na drugi telefon), e2e.

**Commit.** D3 `1c40b26`.

### Oś czasu i filtry

**Co robi.** Wpisy pogrupowane dzień → budowa, z przyklejonym nagłówkiem dnia. Szukanie
bez polskich znaków, filtry rodzaju, budowy i tematu. Bez filtra widać ostatnie 30 dni,
reszta jest za „Pokaż starsze”.

**Gdzie jest.** `src/lib/study/journalView.ts` — czyste funkcje: `filterJournal`,
`groupJournal`, `splitRecent`, `suggestSites`, `isFiltered`, `NO_FILTER`, etykiety
(`dayLabel`, `whenLabel`, `entriesPl`, `problemsPl`). Widok w `StudyJournal.tsx`.

**Jak działa.**
- `JournalFilter.site` to id budowy (`entrySiteId`), a `""` oznacza wpisy bez budowy.
- Szukanie: każde słowo musi wystąpić w tekście, budowie, nazwie tematu albo rodzaju
  (`fold` z `sites.ts` usuwa ogonki i wielkość liter).
- Każdy filtr szuka w całym dzienniku. Bez filtra działa okno `RECENT_DAYS` = 30 dni od północy.
- Budowy w filtrze to pigułki od ostatnio używanej. Archiwalne są schowane za pigułką
  „Archiwum (n)”, chyba że są wybrane.
- Nagłówek budowy w grupie (`[data-journal-site]`) jest przyciskiem do karty budowy.

**Testy.** `study.test.ts` („dziennik — oś czasu i filtry”), e2e „oś czasu dzień → budowa…”.

**Commity.** D5 `cb35c04`, pigułki budów D4a `b41e3c9`.

### Karty budów

**Co robi.** Każda budowa ma kartę: nazwę, adres, inwestora i archiwum. Karta pokazuje liczbę
wpisów, otwarte problemy i okres od–do. Z karty można przejść do „Pokaż wpisy”, „Raport”
i „Do archiwum” / „Przywróć z archiwum”.

**Gdzie jest.**
- `src/lib/study/sites.ts` — `SiteCard`, `SiteInfo`, `siteKey`, `entrySiteId`, `cleanSite`,
  `siteDirectory`, `findSiteByName`, `resolveSite`, `fold`, `foldName`.
- `src/components/study/SiteCardDialog.tsx` — okno karty.
- `store.ts` — `saveSiteCard`, `setSiteArchived`. Rozwiązywanie nazwy na budowę
  w `addJournalEntry` i `updateJournalEntry`.
- `yStudy.ts` — mapa `studySites`, `saveSite`, `addEntry`/`updateEntry` z opcjonalną nową kartą.

**Jak działa.**
- Wpis trzyma `siteId` i kopię nazwy w `site`. Starsza wersja aplikacji i tekst raportu widzą nazwę.
- Migracja bez przepisywania dokumentu: wpis sprzed kart (sama nazwa) dostaje budowę
  `siteKey(nazwa)` — deterministyczny skrót FNV-1a z nazwy bez ogonków, wielkości liter
  i podwójnych spacji (`n-xxxxxxxx`). Dzieje się to przy odczycie, więc każde urządzenie
  liczy to samo id i nie powstają dwie karty jednej budowy.
- `siteDirectory` łączy karty z dokumentu z budowami znanymi tylko z nazw we wpisach
  (`stored: false`) i sortuje od ostatnio używanej. Karta trafia do dokumentu dopiero przy
  zapisie: przy pierwszym wpisie z nową nazwą albo przy edycji karty.
- Projekcja `sanitizeStudy` ustawia każdemu wpisowi z budową `siteId` i aktualną nazwę
  z karty, więc po zmianie nazwy stare wpisy pokazują nową.
- `resolveSite`: nazwa z arkusza → istniejąca budowa (porównanie `foldName`, czynna przed
  archiwalną) albo nowa karta. Jeśli id `siteKey(nazwa)` zajmuje karta o zmienionej nazwie,
  nowa karta dostaje losowe id `s-…`.
- Zmiana nazwy przenosi bieżącą budowę arkusza (`studyMeta.site`), jeśli to była ta —
  inaczej następny wpis założyłby starą budowę od nowa.
- Nazwa jest wymagana i unikalna (bez ogonków i wielkości liter): „Jest już budowa „…””.
- Archiwum (`archived` = moment) chowa budowę z pigułek arkusza i filtra. Wpisy zostają na osi czasu.

**Ograniczenia.** Nazwa do 120 znaków (`SITE_NAME_MAX`), adres i inwestor do 200
(`SITE_FIELD_MAX`). Starsza wersja aplikacji przy edycji wpisu gubi `siteId`. Budowa wraca
wtedy z nazwy, chyba że w międzyczasie zmieniono nazwę karty.

**Testy.** `study.test.ts` („budowy — karty”), `yStudy.test.ts` („karty budów w Yjs”),
`report.test.ts`, e2e „karta budowy — nazwa, adres, inwestor, raport z karty i archiwum”.

**Commit.** D4b `e3096c4` (2026-10-15).

### Raport z budowy

**Co robi.** Raport dnia albo okresu dla jednej budowy lub wszystkich, z godzinami pracy
z Grafiku. Można go udostępnić (tekst i zdjęcia), skopiować, dodać jako notatkę
z etykietą `budowa` albo wydrukować / zapisać jako PDF.

**Gdzie jest.**
- `src/lib/study/report.ts` — `buildJournalReport`, `reportBody`, `reportText`, `reportSummary`,
  `workOn`, `periodLabel`, `dayKeyOf`, `shiftKey`.
- `src/lib/study/toNote.ts` — `reportToNote`.
- `src/components/study/JournalReport.tsx` — `JournalReportDialog`, podgląd `ReportPaper`, wydruk `ReportPrint`
  (przez wspólny `PrintRoot.tsx`, ten sam co protokół odbioru).

**Jak działa.**
- `ReportOptions.siteId`: `null` = wszystkie budowy, `""` = bez budowy. `siteCard` daje
  nazwę, adres i inwestora do nagłówka i początku tekstu („Adres: …”, „Inwestor: …”).
- Godziny: `workOn` bierze zmianę z Grafiku w dniu z wpisem (z odchyleniem). Nieobecność
  pojawia się jako „Grafik: Urlop” z 0 h. Dni bez wpisów się nie liczą.
- Przy otwarciu: budowa z filtra, z karty albo ostatnio używana, a okres to dzień jej
  ostatniego wpisu. Okresy: Dziś / Wczoraj / 7 dni / Ten miesiąc / Wybierz.
- Udostępnianie: zdjęcia (do 10) wczytane z góry do `navigator.share` — po kliknięciu
  przeglądarka daje mało czasu. Bez share albo przy błędzie raport idzie do schowka.
- „Do notatki”: te same klucze zdjęć, bez kopiowania bajtów.
- Wydruk: kontener `#report-print` i klasa `html.printing-report` (style w `index.css`); logika w `PrintRoot.tsx`.
  Podgląd w oknie ma ten sam układ co wydruk.

**Testy.** `src/lib/study/report.test.ts`, e2e „raport budowy z godzinami z Grafiku…” i „karta budowy…”.

**Commity.** D6 `d73d951`, adres i inwestor w raporcie D4b `e3096c4` (2026-10-15).

---

### Paczka ZIP budowy

**Co robi.** W karcie budowy przycisk „Paczka ZIP” pobiera jeden plik `.zip` z całą budową: `raport.md`
(ten sam tekst co „Kopiuj” w raporcie, od pierwszego do ostatniego wpisu) i zdjęcia z wpisów w katalogu
`zdjecia/`, numerowane od najstarszego (`01.jpg`, `02.png`…). Nazwa pliku to tytuł raportu. PDF nie wchodzi
do paczki: „Drukuj / PDF” w raporcie (menu „Więcej”) daje PDF w oknie drukowania.

**Gdzie jest.** `src/lib/study/siteZip.ts` (`buildSiteZip(report, read?, now?)`, `downloadSiteZip(report)`),
składanie ZIP-a w `buildZip` z `src/lib/exportZip.ts` (bez kompresji — zdjęcia są już JPEG-ami). Przycisk
i stan „Pakuję…” w `SiteCardDialog.tsx` (`zip()`); raport budowany tak jak w `JournalReportDialog`: `buildJournalReport`
z `useShifts()` (godziny z Grafiku) i zakresem od `site.first` do `site.last`.

**Jak działa i dlaczego.** Zdjęcia czytane są z `imageStore.get` po kluczu z `report.images` — tej samej
kolejności, co w raporcie. Brak bajtów na tym urządzeniu (zdjęcie jeszcze nie dotarło synchronizacją) nie
przerywa paczki: zdjęcie się pomija, a toast podaje, ile pominięto. Błąd odczytu jednego zdjęcia liczy się tak samo.

**Ograniczenia i pułapki.** Cała paczka składa się w pamięci (`Uint8Array`), więc budowa z setkami zdjęć
to duży bufor — przy bardzo dużych budowach warto dzielić na okresy (raport z zakresem dat). Brak PDF:
generowanie PDF wymagałoby osobnego układu (jak `exportPdf.ts` dla notatek), na razie nie robiono.
Wpisy bez budowy nie mają karty, więc paczki też nie mają.

**Testy.** `src/lib/study/siteZip.test.ts` (3 testy: nazwy i numeracja zdjęć, pominięcie brakujących,
paczka bez zdjęć, błąd odczytu nie przerywa). `e2e/study.spec.ts` („karta budowy…”: pobranie `Raport Dom Nowaków … .zip`,
toast „Paczka gotowa: raport i 0 zdjęć”).

**Commit.** `50842a6` (2026-10-16).

### Listy karty budowy w dokumencie (etapy, braki, zamówienia)

**Co robi.** Dla użytkownika: zmiany etapów, braków i historii zamówień z dwóch telefonów tej samej budowy łączą
się — np. odhaczenie etapu na jednym i usunięcie innego na drugim zostaje po obu stronach. Usunięta pozycja nie
wraca przez to, że drugi telefon miał starszą listę.

**Gdzie jest.**
- `src/lib/study/siteItems.ts`: klucze `budowa␁rodzaj␁id` (`itemKey`) i znacznik listy `budowa␁meta␁rodzaj` (`metaKey`),
  rodzaje `stage`, `short`, `order`; `composeSiteLists` (mapa → listy per budowa), `listItemId`, `listItemValue`,
  `sameItem`, `stripLists`. Bez importu `yjs`.
- `src/lib/study/yStudy.ts`: mapa `studySiteItems`; `setSiteList(siteId, kind, next, base)` zapisuje różnicę;
  `migrateCardLists` przenosi dawne pola karty; `dump()` składa karty z listami (`withSiteLists`); `saveSite` zapisuje
  kartę bez list; `replaceAll` / `mergeIn` rozkładają listy z kopii do mapy.
- `src/lib/study/store.ts`: `setSiteStages(id, next, base?)`, `setSiteShortages(id, next, base?)`, `markSiteOrdered`
  (historia przez `setSiteList`), `siteListBase` (lista jeszcze nie zapisana = pusta baza, inaczej niezmienione
  domyślne etapy nie trafiłyby do zapisu).
- Panele (`SiteStagesPanel`, `SiteShortagesPanel`) i dyktowanie braków przekazują `base` — listę z ekranu.

**Jak działa i dlaczego.** Zapis porównuje `base` (lista, od której zaczął użytkownik) z `next`: usuwa tylko pozycje,
które były w `base`, a zapisuje tylko zmienione — pozycje dopisane w tym czasie na drugim telefonie zostają. Kolejność
etapu zapisuje się raz, przy dodaniu (nowy — na koniec), więc usunięcie innego etapu nie przepisuje sąsiednich (co
mogłoby nadpisać równoczesne odhaczenie). Znacznik listy odróżnia pustą listę od „jeszcze nie zapisanej” (usunięte
wszystkie etapy nie wracają do domyślnych). Stan i kopia zapasowa nadal mają listy w kartach — widoki i format kopii
bez zmian.

**Ograniczenia i pułapki.**
- Ta sama pozycja zmieniona naraz na dwóch telefonach — wygrywa ostatni zapis tej pozycji.
- Karta zapisana w starszej wersji aplikacji może dostać z powrotem dawne pola list — są ignorowane, gdy lista jest już
  w mapie (znacznik), a starsza wersja nie widzi nowych zmian.
- `yStudy.ts` jest w paczce startowej — dodatkowy kod tu zużywa budżet paczki (po tej zmianie zapas ~44 B).

**Testy.** `src/lib/study/yStudy.test.ts` („listy karty budowy”, 6: dwa telefony — etap odhaczony i inny usunięty;
braki dopisane i zmienione; stara lista nie wskrzesza usuniętej pozycji; migracja dawnych pól; zapis karty i kopia
zapasowa w obie strony; pusta lista etapów). e2e działu Praca i kopii (`site-stages`, `site-shortages`, `site-order`,
`site-handover`, `entry-dictation`, `study`, `report-nudge`, `images`, `search-backup`) — 48/48. Vitest 1305/1305.

**Commit.** `395c311` (2026-10-16).

### Kontakt i dojazd w karcie budowy (H1)

**Co robi.** Karta budowy ma dodatkowe pola: „Telefon inwestora”, „Kierownik budowy”, „Telefon kierownika” i „Dostęp do
budowy” (np. kod do bramy, gdzie są klucze). Po zapisie pod nagłówkiem karty jest pasek szybkich akcji:
- **Nawiguj** — Mapy Google z trasą do adresu;
- **telefon z imieniem inwestora** — połączenie;
- **SMS** — wiadomość do inwestora;
- **telefon z imieniem kierownika** — połączenie.

Pod paskiem jest wyróżniona notka z dostępem (ikona klucza).

**Gdzie jest.**
- `src/lib/study/contact.ts`: `telHref`, `smsHref`, `prettyPhone`, `mapsHref` i limity `SITE_PHONE_MAX` (40)
  i `SITE_ACCESS_MAX` (300). Numer czyści `normalizePhone` z `boss.ts`, ten sam co numer szefa: 9 cyfr dostaje +48,
  a `00` zamienia się na `+`.
- `src/lib/study/sites.ts`: opcjonalne pola `SiteCard.phone`, `manager`, `managerPhone`, `access`. `cleanSite` pomija
  puste i ucina długie (`optionalText`).
- `src/lib/study/store.ts`: `SiteCardInput` z polami kontaktu; `saveSiteCard` składa kartę przez `cleanSite`.
- `src/components/study/SiteCardDialog.tsx`: `QuickLink` (link jako przycisk), pasek `[data-testid=site-quick]`,
  notka `[data-testid=site-access]` i pola formularza (`EMPTY_FORM`, `formOf`).

**Jak działa i dlaczego.**
- Szybkie akcje liczą się z zapisanej karty, nie z pisanego formularza. Dzięki temu numer w trakcie wpisywania
  niczego nie wybiera, a pasek pokazuje dokładnie to, co jest w dokumencie.
- Pola pominięte w `SiteCardInput` zostają bez zmian. Zapis z samą nazwą (np. z innego miejsca) nie kasuje telefonów.
  Pusty tekst usuwa pole z karty.
- Link Map w formie `google.com/maps/dir/?api=1&destination=…`: na Androidzie otwiera aplikację Mapy, na iPhonie
  i komputerze stronę. Działa bez klucza API.
- Przyciski pokazują tylko imię z ikoną słuchawki, bo „Zadzwoń: Jan Nowak” ucinało się na telefonie. Pełny opis
  z numerem jest w `aria-label` („Zadzwoń do inwestora: +48 600 100 200”).

**Ograniczenia i pułapki.**
- Starsza wersja aplikacji nie zna nowych pól: zapis karty w niej je zgubi (jak przy etapach).
- Numer, którego `normalizePhone` nie rozpozna (np. „u sąsiada”), zostaje w polu, ale nie daje przycisku.
- Kontakt nie trafia do raportu ani protokołu odbioru, bo to dane robocze, nie dla inwestora.
- Pułapka e2e: etykieta „Telefon inwestora” zawiera „Inwestor”, więc `getByLabel("Inwestor")` wymaga `exact: true`
  (poprawione w `study.spec.ts` i `site-handover.spec.ts`).

**Testy.** `src/lib/study/contact.test.ts` (linki, Mapy, zapis numeru, czyszczenie pól karty), `study.test.ts`
(„kontakt i dostęp w karcie”: zapis, pole pominięte zostaje, pusty tekst usuwa), `e2e/site-contact.spec.ts`
(pasek akcji z hrefami, dostęp, po przeładowaniu). Obejrzane na zrzutach 390 px i na komputerze, w obu motywach.

**Commit.** `95159d1` (2026-10-16).

### Godziny na budowach (H2)

**Co robi.** Przy dniu z wpisami z kilku budów nagłówek dnia w Dzienniku ma przycisk z zegarem. Pokazuje on „podziel
godziny” (kolor ostrzeżenia), dopóki dzień nie jest podzielony, a potem podział, np. „3,5 + 6,5 h”.

Przycisk otwiera okno „Godziny na budowach”. Okno pokazuje zmianę z Grafiku i ma pole godzin przy każdej budowie
(„6”, „6,5”, „6:30”). Pod polami jest podpowiedź („Puste pole dostanie resztę: 3 h 30 min”), a przyciski to
„Po równo” i „Zapisz”.

Przy nazwie budowy w Dzienniku widać jej godziny. Raport jednej budowy liczy tylko jej część dnia,
np. „3 h 30 min na tej budowie (z 10 h, Budowa 07:00–17:00)”. Raport wszystkich budów pokazuje cały dzień
z podziałem w nawiasie.

**Gdzie jest.**
- `src/lib/study/siteHours.ts`:
  - typ `SiteHours` (`id` = dzień, `minutes`);
  - `cleanSiteHours`, `parseHours`;
  - `dayHours(journal, cards, work, key, dayKeyOf)` zwraca `DayHours` z budowami dnia, minutami (albo `null`)
    i flagą `set`;
  - `siteMinutesOn`.
- `src/lib/study/siteItems.ts`: rodzaj listy `hours` w mapie `studySiteItems` (`budowa␁hours␁dzień` → `{ minutes }`).
- `src/lib/study/sites.ts`: `SiteCard.hours`. `src/lib/study/store.ts`: `setDayHours(day, { siteId: minuty })`.
- `src/lib/study/report.ts`:
  - `ReportOptions.sites` (wszystkie karty);
  - `ReportWork.site` (minuty tej budowy albo `null`) i `ReportWork.bySite`;
  - `splitWork`, `workMinutesOf`, `workLine`. Ten sam opis dnia trafia na ekran, do tekstu i na wydruk.
- `src/components/study/DayHoursDialog.tsx` (okno); `StudyJournal.tsx` (`hoursByDay`, przycisk `[data-day-hours]`,
  godziny przy budowie `[data-site-hours]`); `JournalReport.tsx` i `SiteCardDialog.tsx` (paczka ZIP) przekazują
  wszystkie karty.

**Jak działa i dlaczego.**
- Zasada bez wpisanych godzin:
  - wpisany podział wygrywa;
  - jedyna budowa dnia dostaje cały dzień z Grafiku;
  - jedyna budowa bez wpisu przy innych wpisanych dostaje resztę;
  - kilka budów bez podziału to „nierozdzielone”.

  Wcześniej raport każdej z dwóch budów tego samego dnia liczył pełne 10 h, więc suma dla szefa była zawyżona.
  Teraz taki dzień ma w raporcie budowy opis „godziny nierozdzielone” i nie wchodzi do sumy.
- Godziny to lista karty budowy w osobnych kluczach mapy, tak jak etapy i braki. Każdy dzień to osobna pozycja,
  więc dwa telefony wpisujące różne dni się scalają. Kopia zapasowa i stara karta z polem `hours` przechodzą
  przez ogólne `migrateCardLists`.
- Godzin nie zapisujemy w Grafiku: Grafik to dzień pracy, a podział między budowy to sprawa dziennika.
  Grafik zostaje jedynym źródłem długości dnia.
- `dayHours` dostaje minuty pracy i `dayKeyOf` z zewnątrz, bo `report.ts` importuje `siteHours.ts` (bez cyklu importów).
- Kolejność w nagłówku dnia idzie za grupami budów pod nim (od najnowszej).

**Ograniczenia i pułapki.**
- Wpisane godziny mogą przekroczyć dzień z Grafiku. Okno to pokazuje („Wpisano … więcej niż w Grafiku”), ale nie blokuje.
- Bez zmiany w Grafiku (lub przy nieobecności) przycisk pojawia się tylko, gdy coś już wpisano. Raport wtedy
  nie liczy godzin, bo nie ma dnia pracy.
- Starsza wersja aplikacji nie zna rodzaju `hours`: nie pokaże podziału, ale też go nie skasuje (osobne klucze mapy).
- Pułapka testów: dane z dwiema budowami tego samego dnia dają teraz „nierozdzielone”. Dlatego `report.test.ts`
  i `study.spec.ts` (raport z Grafikiem) mają poprawione oczekiwania i dane.

**Testy.** `src/lib/study/siteHours.test.ts` (`parseHours`, `cleanSiteHours`, zasady `dayHours`, raport jednej i wszystkich
budów), `study.test.ts` („godziny na budowach”: dzień zmienia tylko swoją pozycję, 0 usuwa), `report.test.ts`,
`e2e/site-hours.spec.ts` (podział z podpowiedzią reszty, godziny przy budowach, raport po przeładowaniu; błędna liczba).
Vitest 1339/1339, e2e Pracy 53/53. Obejrzane na zrzutach 390 px i na komputerze, w obu motywach.

**Commit.** `f5186f5` (2026-10-16).

### Plany i dokumenty budowy (H3)

**Co robi.** Karta budowy ma panel „Plany i dokumenty”. Przycisk „Dodaj plan lub dokument” przyjmuje zdjęcia
(rzut, zdjęcie tablicy) i PDF-y (projekt), także kilka naraz. Zdjęcia są miniaturami: stuknięcie powiększa,
„100%” pokazuje obraz w pełnej rozdzielczości z przewijaniem (do odczytu wymiarów), a „Dopasuj” wraca do widoku
całości. PDF to wiersz z rozmiarem i przyciskiem „Otwórz”, który zapisuje plik i otwiera go aplikacją telefonu.
Usunięcie ma „Cofnij”. Wszystko leży na urządzeniu, więc działa bez zasięgu. Paczka ZIP budowy ma katalog
`dokumenty/` z tymi plikami pod ich nazwami.

**Gdzie jest.**
- `src/lib/study/siteDocs.ts`: `SiteDoc` (`id` = klucz w `imageStore`, `name`, `size`, `type`, `at`), `cleanSiteDocs`
  (tylko `image/*` i `application/pdf`, limit `SITE_DOCS_MAX` = 30), `isImageDoc`, `docLabel`.
- `src/lib/study/siteDocsAdd.ts` (doczytywany przy dodawaniu): `addSiteDocFiles`. Obrazy idą przez `prepareImage`
  i `imageStore.putBlob`, a PDF-y przez `addAttachmentFiles` (10 MB na plik, łączny limit załączników).
- `src/lib/study/siteItems.ts`: rodzaj listy `docs` (`budowa␁docs␁klucz` → `{ name, size, type, at }`). `sites.ts`:
  `SiteCard.docs`. `store.ts`: `setSiteDocs(id, next, base)`.
- `src/lib/study/journalRefs.ts`: `journalRefsIn(doc, syncable)` zbiera też klucze dokumentów z `studySiteItems`.
  `yjsStore.syncableRefs` woła je z `syncable = true`.
- `src/lib/study/siteZip.ts`: `buildSiteZip(…, siteDocs)` i `downloadSiteZip(report, docs)`. Pola wyniku `docs`
  i `missingDocs`, a druga kopia nazwy dostaje dopisek „(2)”.
- `src/components/study/SiteDocsPanel.tsx` (panel w `SiteCardDialog.tsx` pod brakami).

**Jak działa i dlaczego.**
- Obrazy i PDF-y mają klucze w tym samym formacie (SHA-256 bajtów w `imageStore`), więc jedna lista wystarcza.
  Ten sam plik dodany drugi raz nie dubluje się.
- Rdzeń widzi dokumenty przez `journalRefsIn`:
  - sprzątanie magazynu ich nie usuwa (`referencedImages`);
  - kopia zapasowa zabiera je razem ze zdjęciami dziennika (`journalImageRefs`, ten sam budżet);
  - synchronizacja wysyła obrazy zawsze, a PDF-y do 2 MB, jak załączniki notatek.
- „Otwórz” używa `downloadAttachment`: aplikacja nie wyświetla PDF-a u siebie (zasada załączników). Telefon otwiera
  pobrany plik swoją przeglądarką PDF.
- Obraz do 2 MB zostaje bez zmian (plan musi być czytelny), większy zmniejsza `prepareImage`.

**Ograniczenia i pułapki.**
- PDF powyżej 2 MB zostaje na telefonie, który go dodał. Na drugim „Otwórz” mówi, że pliku tu nie ma.
- Łączny limit załączników (100 MB) przy dodawaniu PDF-a budowy liczy załączniki notatek i PDF-y tej budowy, ale nie
  innych budów. Przy dodawaniu załącznika notatki PDF-y budów się nie liczą.
- Komunikat o limicie liczby plików z `describeRejections` mówi o „notatce” (wspólny tekst załączników).
- Starsza wersja aplikacji nie widzi dokumentów i nie chroni ich bajtów przed swoim sprzątaniem (karencja daje czas
  na aktualizację).
- Pułapka lintu: `yjs` wolno importować tylko w wymienionych plikach. Test na `Y.Doc` jest więc w `yStudy.test.ts`,
  nie w `siteDocs.test.ts`.

**Testy.** `src/lib/study/siteDocs.test.ts` (czyszczenie, podpis), `yStudy.test.ts` („dokumenty budowy w dokumencie”:
odniesienia i duży PDF poza synchronizacją), `siteZip.test.ts` (katalog `dokumenty/`, ta sama nazwa, brak bajtów),
`e2e/site-docs.spec.ts` (zdjęcie i PDF, powiększenie i „100%”, pobranie, „Cofnij”, po przeładowaniu; inny typ
pominięty). Vitest 1343/1343, e2e Pracy i kopii 56/56. Obejrzane na zrzutach 390 px w obu motywach.

**Commit.** `0f78d36` (2026-10-16).

### Serwis i gwarancja (H4)

**Co robi.** Karta budowy ma panel „Serwis i gwarancja”. Zgłoszenie po odbiorze („cieknie syfon w łazience”) dostaje
datę zgłoszenia i opcjonalny termin wizyty. Pozycja jest „otwarta”, dopóki nie zamkniesz jej przyciskiem „Załatwione”,
który prosi o krótki opis („wymieniona uszczelka”). Załatwione chowają się pod licznikiem „Załatwione (n)” razem z opisem,
a „↺” otwiera je ponownie. Obok jest pole „Gwarancja do” z liczbą dni do końca (od 30 dni na żółto). Zgłoszenia działają
także na budowie w archiwum, bo serwis zwykle przychodzi po odbiorze. Zgłoszenie z terminem na dziś albo zaległe trafia do
przypomnień nad Dziennikiem („Serwis „X” na dziś: …”) i do powiadomień push rano w dniu wizyty.

**Gdzie jest.**
- `src/lib/study/service.ts`: typ `ServiceCall` (`id`, `text`, `at`, `due?` dzień, `done?`, `solution?`), `cleanServiceCalls`
  (limit `SERVICE_MAX` = 50, tekst `SERVICE_TEXT_MAX` = 200), `addServiceCall`, `closeServiceCall`, `reopenServiceCall`,
  `openServiceCalls` (z terminem najpierw, najbliższy wyżej), `dueServiceCalls(list, dziś)`, `warrantyDaysLeft`,
  `serviceDayKey` (dzień lokalny).
- `src/lib/study/sites.ts`: `SiteCard.service` (lista) i `SiteCard.warranty` (ostatni dzień gwarancji, „2028-10-16”);
  `cleanSite` czyści oba (zły format daty odpada).
- `src/lib/study/siteItems.ts`: rodzaj listy `service` (`budowa␁service␁id` → wartość bez `id`); `composeSiteLists`
  i `stripLists` znają to pole.
- `src/lib/study/store.ts`: `setSiteService(id, calls, base)` i `setSiteWarranty(id, dzień|null)`. Gwarancja idzie przez
  `yStudy.saveSite`, bo jest polem karty, a nie listą.
- `src/lib/study/reminders.ts`: rodzaj przypomnienia `service-due` (dla budów w archiwum też).
- `src/lib/push/schedule.ts`: `studyItems` dodaje powiadomienie „Serwis dziś: …” o 7:00 w dniu wizyty; klucz
  `pushKey.service(id, due)` w `shown.ts` chroni przed podwójnym powiadomieniem.
- `src/components/study/SiteServicePanel.tsx` (panel w `SiteCardDialog.tsx` pod dokumentami). `StudyJournal.tsx`:
  przypomnienie `service-due` otwiera kartę budowy.

**Jak działa i dlaczego.**
- Zgłoszenia są pozycjami listy karty w mapie Yjs `studySiteItems` (jak braki i godziny), więc dwie osoby dopisujące
  różne zgłoszenia nie nadpisują się nawzajem. Przy zapisie rodzaj `service` dostaje `siteListBase`, tak samo jak reszta.
- Termin to dzień („2026-10-20”), nie godzina. Wizyta „dziś” znaczy cały dzień, a push idzie rano, nie o konkretnej porze.
- Przypomnienie w Dzienniku liczy się przy każdym renderze (`studyReminders` jest czysta) i znika samo po zamknięciu
  zgłoszenia albo po zmianie terminu. Nie ma osobnego stanu „odhaczone przypomnienie”.
- Zamknięcie zapisuje `done` (ms) i opcjonalne `solution`. Ponowne otwarcie zdejmuje `done`, a opis zostaje.
- Gwarancja: „po gwarancji” gdy liczba dni jest ujemna, „ostatni dzień” gdy zero. Liczenie dni idzie przez
  `Date.UTC`, więc zmiana czasu letniego nie przesuwa wyniku.

**Ograniczenia i pułapki.**
- Push wysyła tylko zgłoszenia z terminem na dziś. Zaległe zgłoszenia są widoczne w Dzienniku, ale nie w powiadomieniach
  (inaczej co rano dzwoniłoby to samo).
- Zgłoszenie bez terminu nie generuje ani przypomnienia, ani powiadomienia. Pole „Wizyta” ma `min=dziś`, ale wpisanego
  daty z przeszłości nie blokuje (zaległe są celowe).
- Starsza wersja aplikacji nie zna pól `service` i `warranty`; przy zapisie karty może je zgubić (tak samo jak wcześniej
  listy H1–H3). Nie sprawdzono, czy zgubione zgłoszenia wracają po aktualizacji.
- Limit 50 zgłoszeń na budowę; po przekroczeniu „Dodaj” jest nieaktywne.
- Pułapka e2e: przycisk „Załatwione” jest też w podciągu „Załatwione (1)” po zamknięciu pierwszego zgłoszenia, więc
  `getByRole` z samym tekstem trafia w dwa elementy — w teście używaj nazwy dokładnej albo kolejności.

**Testy.** `src/lib/study/service.test.ts` (dodanie, zamknięcie i ponowne otwarcie, kolejność, czyszczenie karty,
dni gwarancji, przypomnienie na budowie w archiwum, powiadomienie push tylko rano w dniu wizyty),
`e2e/site-service.spec.ts` (gwarancja, zgłoszenie na dziś, przypomnienie → karta, zamknięcie z opisem, po przeładowaniu).
Vitest study+push 265/265, e2e serwisu i zamówień 3/3, budżet paczki 6/6.

**Commit.** `d61e8a2` (2026-10-17, kod); opis w osobnym commicie `docs(opis)`.

### Etapy budowy

**Co robi.** Karta budowy ma listę etapów instalacji w domku jednorodzinnym: domyślnie kanalizacja podposadzkowa,
rozprowadzenie wody, piony i podejścia kanalizacji, próba szczelności, zakrycie instalacji, biały montaż, odbiór.
Odhaczenie zapisuje datę, pasek pokazuje postęp, a „Następny:” — pierwszy niezrobiony etap. Własny etap dopisuje się na
końcu, usunięcie ma „Cofnij”. Przy nazwie budowy w dzienniku widać „etapy 3/7”, a raport budowy dla szefa ma w
podsumowaniu „postęp: 3/7 etapów” i sekcję „Etapy (3/7)” z datami (WhatsApp: ✅ / ⬜).
Etap odhacza się też bez otwierania karty: w nowym wpisie z rodzajem „Zrobione” pod rodzajem są pigułki z trzema
następnymi niezrobionymi etapami wybranej budowy (stuknięcie odhacza od razu, dymek ma „Cofnij”), a dyktowanie
„Lipowa, etap próba szczelności zrobiony, …” odhacza etap głosem (patrz „Dyktowanie”). Odhaczony z wpisu etap
przypina się do wpisu (pasek „Etap: …” w arkuszu, z ✕ do odpięcia) — zdjęcia wpisu idą do protokołu odbioru pod tym
etapem. Zapisany wpis (np. zdjęcia „przed zakryciem” zrobione przed odhaczeniem) przypina się w edycji polem „Zdjęcia do
protokołu przy etapie” — lista wszystkich etapów karty (zrobione z ✓); stan etapu w karcie się wtedy nie zmienia.

**Gdzie jest.**
- `src/lib/study/stages.ts`: `SiteStage { id, name, done? }`, `DEFAULT_STAGES`, `siteStages(card)`, `cleanStages`,
  `stageProgress`, `toggleStage`, `addStage`, `removeStage`, `matchStage(stages, phrase)`; limity `STAGES_MAX` (20),
  `STAGE_NAME_MAX` (60).
- `src/lib/study/sites.ts`: pole `SiteCard.stages?`; `cleanSite` czyści je przez `cleanStages`.
- `src/lib/study/store.ts`: `setSiteStages(id, stages)` (przez `patchSiteCard`, tak samo jak `markSiteOrdered`);
  `saveSiteCard` przenosi `stages` przy edycji karty.
- `src/components/study/SiteStagesPanel.tsx` (`data-testid="site-stages"`) w `SiteCardDialog.tsx` nad „Do zamówienia”.
- `src/components/study/JournalEntrySheet.tsx`: `siteCard`, `nextStages`, `markStage`, `entryStage` — pigułki
  `data-testid="journal-stage-chips"` (tylko nowy wpis, rodzaj „Zrobione”, budowa z kartą lub wpisami, wpis jeszcze
  bez etapu) i pasek `journal-entry-stage`.
- Pole wpisu `JournalEntry.stage?` (id etapu; `yStudy.ts`, czyszczone `cleanEntryStage` w `cleanEntry` i
  `sanitizeStudy`), w szkicu `JournalDraft.stage` (`draft.ts`, starszy szkic bez pola = `null`), w formularzu edycji
  (`entrySheet.ts`), przez `NewJournalEntry.stage` w `addJournalEntry`/`updateJournalEntry` (`store.ts`). Wpis z samym
  etapem (bez tekstu i zdjęć) jest poprawny.
- `src/components/ui/sheet.tsx`: klik w dymek (`[data-sonner-toaster]`) nie zamyka arkusza — jak w `dialog.tsx`; bez
  tego „Cofnij” w dymku zamykał arkusz wpisu.
- `src/components/study/StudyJournal.tsx`: `stagesBySite`, znacznik `[data-site-progress]` obok przycisku budowy.
- `src/lib/study/report.ts`: `JournalReport.stages`, postęp w `reportSummary`, sekcja w `reportBody`, znaczki w
  `reportWhatsApp`; `JournalReport.tsx`: `[data-report-stages]`.

**Jak działa i dlaczego.** Karta bez własnej listy pokazuje domyślną, ale niczego nie zapisuje; pierwsza zmiana zapisuje
całą listę w karcie (mapa Yjs `studySites`). Dzięki temu postęp w dzienniku i w raporcie pojawia się tylko przy budowach,
na których ktoś faktycznie odhacza etapy — reszta raportów się nie zmienia. Znacznik postępu stoi obok przycisku budowy,
nie w nim, żeby nazwa budowy (i jej `aria-label`) zostały czyste. Pigułki pokazują się tylko przy „Zrobione”, bo
etap kończy się wpisem o zrobionej robocie; przy „Problem” i „Notatka” byłyby szumem. `matchStage` porównuje bez
ogonków i wielkości liter: najpierw cała nazwa, potem początek nazwy („odbiór”), potem wszystkie słowa wypowiedzi jako
początki słów nazwy („piony”, „bialy montaz”); gdy pasuje kilka etapów tak samo („grzejniki” przy „Grzejniki parter” i
„Grzejniki piętro”) — nic, zamiast zgadywać.

**Ograniczenia i pułapki.**
- Od `395c311` każdy etap to osobny klucz mapy `studySiteItems` (patrz „Listy karty budowy w dokumencie”): dwa
  telefony zmieniające różne etapy tej samej budowy scalają się. Ten sam etap zmieniony naraz — wygrywa ostatni zapis.
- Starsza wersja aplikacji (sprzed `395c311`) widzi etapy tylko z dawnego pola karty — nowych zmian nie zobaczy.
- Etapów nie da się przestawiać ani zmieniać im nazw (usuń i dodaj nowy). Z arkusza wpisu tylko się odhacza (cofnięcie
  — „Cofnij” w dymku albo w karcie); w edycji zapisanego wpisu zamiast pigułek jest lista do przypięcia (bez odhaczania). Odhaczenie z pigułki zapisuje się od razu,
  nawet gdy wpis potem odrzucisz. „Cofnij” w dymku cofa też przypięcie. Zmiana budowy po odhaczeniu nie czyści
  `stage` — pasek znika (etapu nie ma w nowej karcie), a protokół takiego wpisu nie przypisze do etapu.
- Starsza wersja aplikacji nie zna `stage`: przy edycji wpisu pole może zginąć (wpis wraca do „Pozostałych”).

**Testy.** `src/lib/study/stages.test.ts` (10: domyślne jako kopia, odhaczanie i cofanie, postęp i następny, wszystko
zrobione, własny etap i duplikaty, limit, usuwanie, `cleanStages`, `cleanSite`, `matchStage` — trafienia i
niejednoznaczne). `src/lib/study/report.test.ts`
(„etapy budowy”: postęp, sekcja z datami, znaczki WhatsApp; bez sekcji bez własnej listy i w raporcie wszystkich budów).
`e2e/site-stages.spec.ts` (odhaczenie z datą, własny etap, usunięcie z „Cofnij”, raport, postęp przy budowie po
przeładowaniu; pigułki przy „Zrobione”: odhaczenie, „Cofnij” bez zamykania arkusza, stan w karcie). Regresja działu Praca
41/41 (chromium), układ telefonu 6/6 (`iphone-14`); po `b82dda3`: wpis, zdjęcia, kształtki, próba, szkice, `study.spec`
(31), karta na telefonie — wszystko zielone. Nie sprawdzone ręcznie na telefonie.

Pole `stage`: `study.test.ts` (szkic, wpis z samym etapem, `sanitizeStudy`), `e2e/site-handover.spec.ts`.

Przypięcie w edycji: `e2e/site-handover.spec.ts` (zapisany wpis ze zdjęciem → etap z listy → etap w karcie nadal
nieodhaczony, zdjęcie w grupie etapu na wydruku).

**Commit.** `a25958a` (2026-10-16), `b82dda3` (odhaczanie z wpisu i głosem, 2026-10-16), `5ee9858` (przypięcie wpisu
do etapu, 2026-10-16), `f31f65f` (przypięcie w edycji, 2026-10-16).

### Do zamówienia (kształtki)

**Co robi.** W karcie budowy sekcja „Do zamówienia” pokazuje kształtki zużyte na tej budowie od ostatniego
zamówienia (suma sztuk per nazwa). „Kopiuj listę” kopiuje gotowy tekst do wysłania dostawcy albo do grupy,
a „Oznacz jako zamówione” zapisuje moment zamówienia — od tej chwili lista zaczyna się od zera i rośnie z
kolejnymi wpisami. Bez kształtek wszystkie przyciski są nieaktywne. „WhatsApp” (U7) otwiera `wa.me/?text=…` z tym
samym tekstem: WhatsApp sam pyta o odbiorcę, więc numer hurtowni nie jest zapisywany ani w karcie, ani w sync, ani w kopii
(decyzja domyślna — wybór numeru zapisywanego w karcie czeka na zgodę właściciela). Ta sama lista idzie w raporcie budowy dla szefa
(ekran, wydruk, tekst, WhatsApp) jako sekcja „Do zamówienia” — w jednej wiadomości postęp i brakujący materiał.

**Gdzie jest.**
- `src/lib/study/report.ts`: `JournalReport.toOrder` (z `siteOrder`, tylko raport jednej budowy), sekcja
  `## Do zamówienia` w `reportBody` (WhatsApp: `*Do zamówienia*`); `ReportOptions.siteCard` niesie `orderedAt`.
  Tabela `[data-report-to-order]` w `JournalReport.tsx`.
- `src/lib/study/order.ts`: `siteOrder(journal, siteId, orderedAt?)` → `{ items, entries, since }` (czysta funkcja),
  `orderText(siteName, order)` — tekst bez znaczników formatowania, `whatsappOrderUrl(text)` — link `wa.me` (U7).
  Test: `src/components/study/SiteOrderPanel.test.tsx` (klik „WhatsApp” otwiera `wa.me` z treścią; pusta lista = wyłączony),
  `src/lib/study/order.test.ts` (kodowanie tekstu w linku).
- `src/lib/study/sites.ts`: pole `SiteCard.orderedAt?` (ms); `cleanSite` zachowuje je, gdy jest liczbą.
- `src/lib/study/store.ts`: `markSiteOrdered(id, now)` (zapisuje też, co zamówiono, w historii `orders` — patrz „Braki
  materiału”); `saveSiteCard` zachowuje wszystkie pola karty poza nazwą, adresem i inwestorem.
- `src/components/study/SiteOrderPanel.tsx` (`data-testid="site-order"`), wstawiony w `SiteCardDialog.tsx` pod formularzem.

**Jak działa i dlaczego.** Liczymy od ostatniego zamówienia, a nie od początku budowy — inaczej lista rosłaby bez
końca i nie mówiłaby, czego brakuje. Wpis należy do budowy przez `entrySiteId` (karta albo nazwa ze starszych wpisów);
liczą się tylko wpisy z `at` późniejszym niż `orderedAt` (wpis z dokładnie tą chwilą uznajemy za zamówiony). Nazwy
sumuje `sumFittings` (bez wielkości liter i ogonków). Zamówienie zapisuje się w karcie (mapa Yjs `studySites`), więc
synchronizuje się z drugim telefonem tak jak reszta karty. Budowa znana tylko z nazw we wpisach dostaje kartę przy
pierwszym oznaczeniu zamówienia.

**Ograniczenia i pułapki.**
- Liczy tylko kształtki (decyzja z 2026-10-15: bez metrów rury).
- Starsza wersja aplikacji nie zna `orderedAt`: pokaże kartę bez sekcji, ale zapis karty w starej wersji
  pole zgubi (wtedy lista znów liczy się od początku budowy).
- „Oznacz jako zamówione” zamawia całą listę naraz — nie da się zamówić części pozycji. Historia zamówień jest
  (ostatnie 20, „Poprzednie zamówienia”).
- `orderText` formatuje datę przez `toLocaleDateString("pl-PL")` (strefa urządzenia).

**Testy.** `src/lib/study/order.test.ts` (10: suma i kolejność, granica `orderedAt`, inne budowy i wpisy bez kształtek,
`siteId` przed nazwą, tekst z datą i bez pozycji, `cleanSite` z `orderedAt`). `e2e/site-order.spec.ts` (suma budowy
bez obcej budowy, kopia listy, oznaczenie zeruje listę i blokuje przyciski, stan po przeładowaniu; raport z karty ma
sekcję na ekranie i w kopiowanym tekście). `src/lib/study/report.test.ts` („materiał do zamówienia”: niezależnie od
okresu raportu, bez sekcji w raporcie wszystkich budów). Regresja działu: `e2e/study.spec.ts`, `journal-fittings.spec.ts`,
`site-order.spec.ts` — zielone (chromium, `--workers=1`). Nie sprawdzone ręcznie na telefonie.

**Commit.** `98e625a` (karta, 2026-10-16), `a8cf1a9` (raport, 2026-10-16).

### Braki materiału i historia zamówień

**Co robi.** W karcie budowy sekcja „Braki materiału”: dopisujesz, czego brakuje, z ilością („Rura PEX 16 · 50 m”,
„Klej PCV”). Stuknięcie w status przełącza *Brakuje → Zamówione → Dostarczone* (data zmiany się zapisuje); kolory:
czerwony, bursztynowy, zielony — „Brakuje” celowo czerwone, bo bursztyn motywu i ostrzeżenie są prawie tym samym kolorem. „Kopiuj braki”
kopiuje tekst dla dostawcy albo szefa, „Wyczyść dostarczone” sprząta listę (z „Cofnij”), usunięcie pozycji też ma
„Cofnij”. Raport budowy dla szefa ma w podsumowaniu „braki materiału: N” i sekcję z tym, co jeszcze nie dojechało.
Pod „Do zamówienia” (kształtki) jest zwinięta lista „Poprzednie zamówienia” — każde „Oznacz jako zamówione” zapisuje
datę i zamówione pozycje.

**Gdzie jest.**
- `src/lib/study/shortages.ts`: `Shortage { id, text, qty, status, at, changed? }`, `addShortage`, `nextStatus`,
  `setShortageStatus`, `removeShortage`, `clearDelivered`, `openShortages`, `shortageLine`, `shortagesText`,
  `cleanShortages`; historia: `OrderLogEntry { at, items }`, `logOrder`, `cleanOrderLog`, `orderLogLine`.
  Limity: 40 braków, 80 znaków nazwy, 20 znaków ilości, 20 zamówień w historii.
- `src/lib/study/sites.ts`: pola `SiteCard.shortages?` i `SiteCard.orders?`, czyszczone w `cleanSite`.
- `src/lib/study/store.ts`: `setSiteShortages`, `markSiteOrdered` (dopisuje do `orders`), wspólne `patchSiteCard`.
- `src/components/study/SiteShortagesPanel.tsx` (`data-testid="site-shortages"`) w `SiteCardDialog.tsx` pod „Do zamówienia”;
  historia w `SiteOrderPanel.tsx` (`site-order-history`).
- `src/lib/study/report.ts`: `JournalReport.shortages` (otwarte, tylko raport jednej budowy), sekcja „Braki materiału”
  w `reportBody`; `JournalReport.tsx`: `[data-report-shortages]`.

**Jak działa i dlaczego.** Kształtki liczą się same z wpisów (zużycie), a braki to rzeczy, których nie widać we wpisach
— rury w metrach, kleje, otuliny. Dlatego osobna, ręczna lista ze statusem, a nie liczenie. Ta sama nazwa dopisana
ponownie, dopóki nie dojechała, nie robi duplikatu (najwyżej podmienia ilość). W raporcie tylko „brakuje” i „zamówione”,
brakujące najpierw. Dane w karcie budowy (mapa Yjs `studySites`), więc synchronizują się jak reszta karty.

**Ograniczenia i pułapki.**
- Decyzja z 2026-10-15 („obmiary tylko kształtki”) dotyczyła liczenia zużycia; braki to osobna, ręczna lista —
  wprowadzone 2026-10-16 na prośbę („rób po kolei” po propozycji punktu 3).
- Od `395c311` każdy brak i każde zamówienie to osobny klucz mapy `studySiteItems`: zmiany różnych pozycji z dwóch
  telefonów scalają się. Starsza wersja aplikacji (sprzed `395c311`) widzi tylko dawne pola karty.
- Braki dyktuje się głosem przy treści wpisu („Lipowa, brakuje …” — patrz „Dyktowanie”); przypomnienie o materiale
  „zamówionym” ponad 3 dni — w „Przypomnieniach nad listą”.

**Testy.** `src/lib/study/shortages.test.ts` (10: dopisanie i duplikaty, dostarczona nie blokuje, statusy, otwarte i
czyszczenie, limit, linia i tekst, `cleanShortages`, historia i limit, `cleanOrderLog`, `cleanSite`).
`src/lib/study/report.test.ts` („braki materiału”). `e2e/site-shortages.spec.ts` (dopisanie, status, kopia, czyszczenie z
„Cofnij”, historia zamówień, raport, stan po przeładowaniu). `e2e/site-card-mobile.spec.ts` (`@mobile`, iPhone 14 i
Pixel 7, 320 i 390 px: karta z etapami, zamówieniem i brakami bez przewijania w bok, cele dotyku ≥ 44 px; `26cf71f`).
Regresja działu Praca 39/39 (chromium). Zrzuty karty obejrzane w jasnym i ciemnym motywie (390 px).

**Commit.** `f10d6dd` (2026-10-16).

### Protokół odbioru dla inwestora

**Co robi.** Przycisk „Protokół odbioru” w karcie budowy drukuje jedną kartkę (albo PDF przez „Zapisz jako PDF” w oknie
drukowania): nazwa budowy, adres, inwestor, okres prac, data protokołu, etapy z datami (☑/☐), próby szczelności z
wpisów z wynikiem, uwagi (otwarte problemy; bez nich „Brak uwag”), do 12 zdjęć i dwa pola „Wykonawca / Inwestor —
data i podpis”. Zdjęcia z wpisów, które odhaczyły etap (patrz „Etapy budowy”), stoją pod nazwą tego etapu, w
kolejności etapów; reszta pod „Pozostałe” (bez żadnego przypiętego — jedna siatka bez nagłówka).

**Gdzie jest.**
- `src/lib/study/handover.ts`: `buildHandover(journal, site, now)` → `Handover`, `handoverText(h)` (ta sama treść jako
  tekst, bez zdjęć; liczy zdjęcia etapów: „5 zdjęć (Próba szczelności: 2, …)”), `HANDOVER_PHOTOS_MAX` (12),
  `HandoverPhotoGroup { stage, photos }` w `Handover.photoGroups` (obok płaskiego `photos`).
- `src/components/study/HandoverPaper.tsx` — kartka (klasa `.report-paper`, czarno na białym na papierze); grupy
  zdjęć `[data-handover-photo-group]` z nagłówkiem etapu, `break-inside-avoid-page`.
- `src/components/study/PrintRoot.tsx` — wspólny wydruk (raport i protokół): korzeń `#report-print` pod `body`, klasa
  `html.printing-report`, czekanie na zdjęcia (do 3 s), sprzątanie po `afterprint` albo pierwszym dotknięciu.
- `src/components/study/SiteCardDialog.tsx`: przycisk, stan `handover`, `<PrintRoot testId="handover-print">`.

**Jak działa i dlaczego.** Protokół składa się z danych, które już są: karta (adres, inwestor, etapy), wpisy (próby
`test`, problemy bez `resolved`, zdjęcia). Najpierw zdjęcia przypięte do etapów (wpis z `stage`, w kolejności listy
etapów), potem pozostałe od najstarszych, bo „przed zakryciem” są zwykle na początku budowy. Limit 12 tnie od końca,
więc zdjęcia etapów mają pierwszeństwo; reszta jest w paczce ZIP. Wpis z `stage` etapu, którego już nie ma w karcie,
idzie do pozostałych. Przycisk jest aktywny, gdy budowa ma wpisy albo własną listę etapów.

**Ograniczenia i pułapki.**
- Bez podglądu przed drukiem — od razu okno drukowania (jak „Drukuj” w raporcie).
- Zdjęcie trafia pod etap tylko przez wpis przypięty do etapu: odhaczenie z wpisu (pigułka, głos) albo wybór w edycji
  zapisanego wpisu. Etap odhaczony w samej karcie nie przypina żadnego wpisu.
- Grupy idą po liście etapów karty, a gdy karta nie ma własnej listy — po domyślnych (`siteStages`); sekcja „Zakres prac”
  nadal pokazuje się tylko przy własnej liście (`stages: null`).
- „Tekst protokołu” (obok „Protokół odbioru”) wysyła ten sam protokół jako tekst, bez zdjęć: udostępnianie systemowe
  na telefonie, a bez niego — schowek (`shareHandover` w `SiteCardDialog.tsx`, `f5dc1f6`).

**Testy.** `src/lib/study/handover.test.ts` (4: dane, okres, próby i uwagi tylko z tej budowy; etapy i limit zdjęć;
budowa bez wpisów; tekst; + 3 „zdjęcia przy etapach”: kolejność grup i tekst, limit tnie od pozostałych, bez
przypiętych jedna grupa). `e2e/site-handover.spec.ts` (karta z adresem i inwestorem, odhaczony etap, treść wydruku z
próbą, uwagą i podpisami; `window.print` podmienione; wpis ze zdjęciem odhacza etap pigułką → po przeładowaniu zdjęcie
w grupie etapu na wydruku). Regresja działu Praca 37/37 (w tym wydruk raportu); po `5ee9858` 40/40 + bundle.
Nie drukowane na prawdziwej drukarce ani do PDF w telefonie.

**Commit.** `9b169ad` (2026-10-16), `5ee9858` (zdjęcia przy etapach, 2026-10-16), `f31f65f` (grupy po domyślnych
etapach, 2026-10-16; test „karta bez własnej listy” w `handover.test.ts`).

### Rysowanie po zdjęciu

**Co robi.** Na miniaturce zdjęcia w arkuszu wpisu jest przycisk „Rysuj na zdjęciu” (ołówek, prawy dolny róg).
Otwiera płótno ze zdjęciem w jego proporcjach: strzałka, wymiar, zaznaczenie kolorem. „Zapisz rysunek” podmienia
zdjęcie we wpisie na wersję z rysunkiem (jak wtopiony podpis), więc rysunek jedzie do szefa, raportu i paczki ZIP.

**Gdzie jest.**
- `src/components/study/JournalEntrySheet.tsx`: stan `drawing { ref, url }`, `openDrawing` (bajty z `imageStore` →
  adres `blob:`), `saveDrawing` (`dataURL` → `prepareImage` → `imageStore.putBlob` → podmiana w `images`).
- `src/components/DrawingCanvas.tsx` (wspólne z Notatkami): `paintStrokes`, `compose`, tło wczytywane raz (`bg`),
  rozmiar płótna z proporcji zdjęcia, eksport w rozdzielczości zdjęcia (do `PHOTO_EXPORT_MAX` = 1600 px, JPEG 0,9).

**Jak działa i dlaczego.** Kreski są rysowane na osobnej warstwie nakładanej na tło, więc gumka ściera tylko kreski,
a nie zdjęcie (wcześniej `destination-out` wycinało dziury w tle). Płótno bez zdjęcia (rysunek w Notatkach) wygląda
i zapisuje się jak dotąd (PNG na białym tle). Oryginał zdjęcia zostaje w magazynie do odśmiecenia, jak przy podpisie.

**Ograniczenia i pułapki.**
- Rysunek się „wtapia” — nie da się go potem edytować osobno od zdjęcia (można usunąć zdjęcie i dodać oryginał).
- Kreska zaczęta, zanim zdjęcie się wczyta, może się przesunąć, gdy płótno zmieni rozmiar (zdjęcie wczytuje się szybko).
- e2e: współrzędne płótna liczyć dopiero po ustaniu animacji okna (`canvas.hover()` + chwila).

**Testy.** `e2e/photo-drawing.spec.ts` (proporcje 4:3, kreska, zapis podmienia zdjęcie). `e2e/card-images.spec.ts`
(„rysunek z menu Więcej opcji” — płótno w Notatkach po zmianie). Regresja zdjęć dziennika i notatek 35/35.
Nie sprawdzone palcem na telefonie.

**Commit.** `b1f3842` (2026-10-16).

### „Jak rozwiązane?” — baza własnych rozwiązań

**Co robi.** Po „Oznacz jako rozwiązany” pod problemem otwiera się pole „Jak rozwiązane?” (np. „wymieniona złączka,
dokręcony śrubunek”). „Zapisz” albo Enter zapisuje opis, „Pomiń” zamyka pole — wtedy zostaje przycisk „Jak
rozwiązane?”, żeby dopisać później; zapisany opis ma „Zmień”. Opis jest:
- pod wpisem („Rozwiązanie: …”),
- w raporcie dla szefa (linia „Rozwiązanie:” pod problemem, też na wydruku),
- w szukaniu dziennika (słowo z rozwiązania znajduje wpis),
- na tablicy Nauki przy temacie: zwinięte „Moje rozwiązania (N)” — problem i „→ jak rozwiązano”, od najnowszego.

**Gdzie jest.**
- `src/lib/study/yStudy.ts`: pole `JournalEntry.solution?` (tylko `problem`), `JOURNAL_SOLUTION_MAX` (500),
  `setSolution(id, text)`; czyszczenie w `cleanEntry` (kopia, drugi telefon).
- `src/lib/study/store.ts`: `setProblemSolution`, czyszczenie w `sanitizeStudy`, `updateJournalEntry` zachowuje opis
  przy edycji w arkuszu (formularz go nie zna), `practiceByTopic` → `TopicPractice.solutions`.
- `src/lib/study/journalView.ts`: `filterJournal` szuka też w `solution`.
- `src/lib/study/report.ts` (`entryLine`), `src/components/study/JournalReport.tsx` (`[data-report-solution]`).
- `src/components/study/StudyJournal.tsx`: `SolutionLine` (pole, opis, „Zmień”); `StudyBoard.tsx`: `[data-topic-solutions]`.

**Jak działa i dlaczego.** Dziennik już wiedział, że problem rozwiązano, ale nie jak — a to jest wiedza, której
potrzeba przy następnym takim problemie. Opis jest opcjonalny i nie blokuje oznaczenia (szybkość na budowie).
Ponowne otwarcie problemu zostawia opis (przy kolejnym rozwiązaniu jest pod ręką); zmiana rodzaju wpisu na inny niż
problem go usuwa.

**Ograniczenia i pułapki.**
- Nie ma zamiany rozwiązania na własne pytanie quizu jednym stuknięciem — pytanie potrzebuje trzech błędnych
  odpowiedzi, których aplikacja nie wymyśli; własne pytania dodaje się jak dotąd („Moje pytania”).
- Opisu nie dyktuje się osobnym mikrofonem (można dyktować klawiaturą telefonu).
- Starsza wersja aplikacji nie zna `solution`: edycja wpisu w starej wersji opis zgubi.

**Testy.** `src/lib/study/study.test.ts` („jak rozwiązano problem”: zapis, przycięcie, usunięcie, tylko problem;
edycja i ponowne otwarcie nie gubią opisu, zmiana rodzaju tak; „Moje rozwiązania” i szukanie; `sanitizeStudy`).
`src/lib/study/yStudy.test.ts` (synchronizacja dwóch telefonów, `cleanDump`). `src/lib/study/report.test.ts`
(linia „Rozwiązanie:”). `e2e/journal-solution.spec.ts` (2: pole po oznaczeniu, po przeładowaniu, szukanie, tablica;
„Pomiń” i dopisanie później). Regresja działu Praca 34/34; Vitest 1289/1289.

**Commit.** `415b7a5` (2026-10-16).

### Dyktowanie: cały wpis i kształtki

**Co robi.**
- **Cały wpis jedną wypowiedzią** — mikrofon „Dyktuj” przy treści wpisu. Np. „Lipowa, problem, przeciek przy trójniku,
  kolano 16 cztery sztuki”: budowa zmienia się na Lipowa 5, rodzaj na „Problem”, do tekstu idzie „przeciek przy
  trójniku”, a kształtka trafia na listę. Dymek mówi, co rozpoznano („Z wypowiedzi: budowa Lipowa 5 · Problem ·
  kształtki: Kolano 16 × 4”). Zwykłe zdanie bez budowy, rodzaju i kształtek dopisuje się do tekstu bez zmian (jak dawniej).
- **Braki materiału** — ten sam mikrofon: „Lipowa, brakuje kleju do PCV i rury PEX 16 pięćdziesiąt metrów” (także
  „zamówić …”, „do zamówienia …”) dopisuje pozycje do „Braków materiału” w karcie budowy (wskazanej albo bieżącej),
  z ilością, gdy padła liczba z jednostką („50 m”, „3 szt.”, „2 worki”). Do treści wpisu nic nie trafia; bez budowy —
  komunikat „Braki zapisują się w karcie budowy”.
- **Etap zrobiony** — „Lipowa, etap próba szczelności zrobiony, ciśnienie trzymało”: etap odhacza się w karcie budowy
  (jeśli już był odhaczony — zostaje z pierwszą datą), rodzaj wpisu ustawia się na „Zrobione” (chyba że padł inny), a
  reszta idzie do tekstu. Nazwa kończy się słowem zrobiony/gotowy/skończony/zakończony (każda forma) albo przecinkiem.
  Nieznana nazwa albo brak budowy — komunikat błędu, reszta wypowiedzi i tak trafia do wpisu.
- **Same kształtki** — mikrofon „Dyktuj kształtki” w polu kształtek: „kolano szesnaście cztery sztuki, trójnik 16 dwa”.
  Ta sama nazwa sumuje sztuki zamiast nowego wiersza. Gdy nic nie rozpozna, dymek pokazuje usłyszany tekst i przykład.

**Gdzie jest.**
- `src/lib/study/spokenEntry.ts`: `parseSpokenEntry(spoken, { sites, fittings })` → `{ site?, kind?, stage?, fittings,
  text, shortages, structured }`; braki: `SHORTAGE_MARKERS`, `UNIT_SHORT`, `parseShortages`, `numberize`; etap:
  `STAGE_DONE` (słowa kończące nazwę), znacznik „etap” zaraz po budowie/rodzaju.
- `src/lib/study/spokenFittings.ts`: `parseSpokenFittings(text, known)`, `mergeFittings(current, added)`, `wordsToDigits`;
  wspólne słowniki (`UNITS`, `TENS`, `SINGULAR`, `QTY_WORD`, `fold`).
- `src/components/study/JournalEntrySheet.tsx`: obsługa dyktowania treści (`useDictation` → `parseSpokenEntry`; budowa
  przez `pickSite`, rodzaj i kształtki przez `patch`, kształtki scalane `mergeFittings`; etap — `matchStage` na liście
  karty i `setSiteStages` z bazą).
- `src/components/study/FittingsFields.tsx`: przycisk „Dyktuj kształtki” przy „Dodaj kształtki” i przy „Kolejna”.
- Oba przez `useDictation` (Web Speech API, `pl-PL`, zgoda przy pierwszym użyciu — `kaczy.dictation.consent`).

**Jak działa i dlaczego.** Rozpoznawanie mowy zwykle nie stawia przecinków, więc reguły całego wpisu są ostrożne:
budowa tylko na początku (pełna nazwa znanej budowy albo jej jednoznaczne pierwsze słowo, za którym stoi przecinek
albo słowo rodzaju; opcjonalnie „budowa …”), rodzaj tylko jako pierwsze słowo po budowie (problem/usterka/awaria,
notatka/uwaga, zrobione/gotowe), kształtka tylko jako nazwa kształtki z co najmniej jedną liczbą za nią („trójnik 16 dwa”;
„trójniki rozsunięte trzydzieści centymetrów” zostaje tekstem). Zapowiedź „kształtki” i spójnik przed kształtką nie
zostają w tekście. Kształtki: liczebniki zamienia `wordsToDigits`; sztuki — po mnożniku („x 3”), przed „sztuk/szt/razy/x”,
na początku („4 kolana 16”) albo ostatnia z dwóch liczb („trójnik 16 2”); bez liczby — 1; „20 na 16” to wymiar
(„Redukcja 20/16”). Liczba mnoga pierwszego słowa wraca do pojedynczej, nazwa znana z historii przyjmuje jej pisownię.

**Ograniczenia i pułapki.**
- Budowa rozpoznaje się tylko spośród znanych (z kart i wpisów, bez archiwum) i w mianowniku („Lipowa”, nie „na Lipowej”).
- Po „brakuje” pierwsze słowo wraca z dopełniacza do mianownika dla częstych materiałów („kleju” → „Klej”, „rury” →
  „Rura”; słownik `GENITIVE_TO_NOMINATIVE`, `ddb87d0`); nieznane słowa i reszta pozycji zostają, jak padły. Po „do
  zamówienia” nic się nie zmienia (tam mówi się w mianowniku). Słowo „brak” (nie „brakuje”) to zwykły tekst problemu.
  Ilość bez jednostki („rura 16”) to wymiar, nie ilość.
- Pierwsze słowo budowy bez przecinka i bez słowa rodzaju za nim nie wystarcza („polna droga zalana” to tekst).
- „Dyktuj kształtki” bierze każdy kawałek jako pozycję: przypadkowe słowa („coś tam”) zostaną pozycją — usuwa się „−”.
- Web Speech API: w Chrome nagranie idzie do usługi Google; bez internetu nie działa. Na iPhonie (Safari) zależnie od
  wersji — przy braku wsparcia mikrofonów nie ma (zostaje dyktowanie z klawiatury telefonu).
- W e2e: „Dyktuj” (treść) wymaga `exact: true`, bo obok jest „Dyktuj kształtki”.

**Testy.** `src/lib/study/spokenEntry.test.ts` (8: bez przecinków, z przecinkami i liczbą słownie, zwykłe zdanie bez
zmian, pierwsze słowo budowy tylko przed przecinkiem/rodzajem, niejednoznaczne „dom”, „budowa …” i rodzaj bez budowy,
zapowiedź „kształtki” i nazwa wielowyrazowa, „20 na 16”). `src/lib/study/spokenFittings.test.ts` (10). e2e z udawanym
`SpeechRecognition`: `e2e/entry-dictation.spec.ts` (zmiana budowy z Polnej na Lipową, rodzaj, tekst, kształtka, zapis na
właściwej budowie), `e2e/fittings-dictation.spec.ts` (dwie wypowiedzi, suma sztuk), `e2e/study.spec.ts` (zwykłe zdanie).
Nie sprawdzone z prawdziwym mikrofonem.

**Commit.** `b65d58c` (kształtki, 2026-10-16), `b61b737` (cały wpis, 2026-10-16), `db490f7` (braki głosem, 2026-10-16).
Testy braków: `spokenEntry.test.ts` („braki materiału głosem”, 4), `e2e/entry-dictation.spec.ts` („brakuje …” → karta).
Etap głosem: `b82dda3` (2026-10-16); `spokenEntry.test.ts` („etap głosem”, 3), `e2e/entry-dictation.spec.ts` („etap …
zrobiony” → odhaczony w karcie, 1/7).

### Przypomnienia o raporcie (dzień i tydzień)

**Co robi.**
- **Raport dnia** — raz dziennie, po końcu dzisiejszej zmiany z Grafiku (bez zmiany albo przy nieobecności i zmianie
  przez północ — o 17:00), jeśli dziś są wpisy: dymek „Raport dnia gotowy” i — przy zgodzie — powiadomienie systemowe.
- **Raport tygodnia** — w piątek po końcu dnia pracy (albo w sobotę/niedzielę, jeśli w piątek nie było okazji), raz na
  tydzień, gdy w ostatnich 7 dniach są wpisy: „Raport tygodnia gotowy”. Tego dnia zastępuje raport dnia (obejmuje dziś).
- „Otwórz raport” przechodzi do Pracy i otwiera okno raportu z tym zakresem: dzień ostatniego wpisu albo 7 dni.
  Przy kilku budowach (dziś / w tygodniu) od razu „Wszystkie budowy”, żeby żadna nie wypadła. Stamtąd raport idzie
  do szefa (WhatsApp) albo do grupy jednym stuknięciem.
- Powiadomienie systemowe otwiera `/praca?raport=dzis`, `dzis-wszystkie`, `tydzien` albo `tydzien-wszystkie`.

**Gdzie jest.**
- `src/lib/study/reportNudge.ts`: `reportDueMinute`, `dailyReportNudge`, `weeklyReportNudge`, `weekKeyOf`;
  klucze `REPORT_NUDGE_KEY` (`kaczy.study.reportNudged.v1`, dzień) i `WEEK_REPORT_NUDGE_KEY`
  (`kaczy.study.weekReportNudged.v1`, poniedziałek tygodnia); `REPORT_NUDGE_FALLBACK` (`17:00`).
- `src/lib/study/reportLink.ts`: prośba `JournalReportRequest { allSites, range }` (`requestJournalReport`,
  `consumeJournalReportRequest`, `useJournalReportRequest`), parametr `raport` (`reportParam` / `parseReportParam`).
- `src/components/study/DailyReportNudge.tsx`: sprawdzenie przy starcie i co minutę (najpierw tydzień, potem dzień);
  montowany leniwie w `src/pages/Index.tsx` (`onOpenWork` → widok `study`).
- `StudyView.tsx` przełącza na Dziennik i zdejmuje `?raport=` z adresu; `StudyJournal.tsx` otwiera okno raportu
  z `initialRequest`; `JournalReport.tsx` (`JournalReportDialog`): `allSites` → „Wszystkie budowy”, `week` → preset 7 dni.

**Jak działa i dlaczego.** Godzina z Grafiku, bo to koniec dnia pracy; stała godzina, gdy Grafiku brak. Raz dziennie /
raz na tydzień (klucze w `localStorage`), żeby nie nękać. W piątek tydzień ma pierwszeństwo — szef dostaje jedno
podsumowanie zamiast dwóch. Komponent czyta dziennik przez `yStudy` z `data.ts`, a nie przez `store.ts` — ten importuje
materiał do nauki, który nie musi się ładować przy każdym starcie aplikacji. Zwykłe otwarcie raportu (przycisk, karta
budowy) czyści prośbę, więc nie dziedziczy zakresu z przypomnienia.

**Ograniczenia i pułapki.**
- Bez serwera push: przypomnienia działają tylko przy otwartej aplikacji (jak reszta przypomnień).
- Wysłanie do szefa zostaje jednym stuknięciem w oknie raportu — automatyczna wysyłka WhatsApp wymagałaby serwera.
- Tydzień = ostatnie 7 dni (jak preset „7 dni”), nie tydzień kalendarzowy od poniedziałku.
- e2e bez stałego zegara: w piątek po 17:00 albo w weekend dymek może się pojawić w niezwiązanym teście, który tworzy
  wpisy (`docs/GOTCHAS.md`). Testy przypomnień ustawiają `page.clock`.
- Komponent dokłada ~1 KB do paczki startowej (leniwy import). Budżet paczki — patrz „Wydajność — paczka startowa
  i precache” (od `3d31b58` w progach).

**Testy.** `src/lib/study/reportNudge.test.ts` (11: godzina z Grafiku, nieobecność i brak zmiany, zmiana przez północ,
po i przed końcem zmiany, raz dziennie, bez wpisów; tydzień: piątek po pracy, przed, inny dzień, już przypomniane,
pusty tydzień, weekend, klucz tygodnia; parametr adresu w obie strony). `e2e/report-nudge.spec.ts` (6: dymek dnia
prowadzi do raportu z dziś i nie wraca; przed końcem dnia go nie ma; `?raport=dzis`; kilka budów → „Wszystkie budowy”;
piątek → raport tygodnia bez raportu dnia; `?raport=tydzien-wszystkie`). Testy „nie ma dymku” czekają 1,5 s — nie
wykluczają dymku pokazanego później.

**Commit.** `5d6008e` (raport dnia, 2026-10-16), `83a6383` (tydzień, kilka budów, 2026-10-16).

### Przypomnienia nad listą

**Co robi.** Nad listą wpisów Dziennika pojawia się pasek „Przypomnienia” (tylko gdy coś jest do zrobienia):
- **Problemy otwarte od ponad 3 dni** — „N problemów otwartych od ponad 3 dni”, przycisk „Pokaż otwarte” (filtr „Otwarte”).
- **Budowa z montażem bez protokołu próby** — „Budowa „X”: montaż bez protokołu próby. Zapisz próbę przed zakryciem.”,
  przycisk „Pokaż wpisy budowy” (filtr tej budowy).
- **Materiał zamówiony, a niedostarczony** — „Budowa „X”: zamówione ponad 3 dni temu i nie dojechało — klej, rura…”
  (do 3 nazw i „i N więcej”), przycisk „Karta budowy” otwiera kartę, gdzie zmienia się status braku.

Pasek znika sam, gdy warunek przestanie być prawdziwy (problem rozwiązany, protokół dopisany, materiał „dostarczony”).

**Gdzie jest.** Reguła: `src/lib/study/reminders.ts` (`studyReminders(journal, now, siteCards)`, stałe
`REMINDER_PROBLEM_DAYS = 3`, `REMINDER_ORDER_DAYS = 3`, typ `StudyReminder` z rodzajami `stale-problems`, `no-test`,
`late-order`). Pasek: `ReminderRow` w `src/components/study/StudyJournal.tsx` (`data-testid="journal-reminders"`).

**Jak działa.**
- Problem przypomina, gdy jest otwarty i `now − at > 3 dni` (od chwili wpisu problemu, nie od rozwiązania). Dokładnie 3 dni — jeszcze bez przypomnienia.
- „Montaż” budowy = wpis z kształtkami (`fittings`) albo wpis z tematu próby (`TEST_TOPICS`: `proba-wody`, `proba-kan`).
  Budowa z montażem, w której **żaden** wpis nie ma `test`, dostaje przypomnienie. Próba zapisana w innej budowie go nie zdejmuje.
- Wpisy bez budowy (`entrySiteId` = `""`) są pomijane. Nazwa budowy z najnowszego wpisu.
- Zamówienia: brak ze statusem „zamówione”, którego ostatnia zmiana statusu (`changed`, bez niej — dopisanie `at`)
  była ponad 3 dni temu; jedno przypomnienie na budowę; budowy w archiwum pomijane.
- Liczone w `useMemo` na zmianie dziennika — bez timera. Jeśli strona stoi otwarta, a problem przekroczy 3 dni bez zmiany
  dziennika, pasek pojawi się dopiero po następnym renderze (np. po przejściu zakładki).

**Ograniczenia i pułapki.** Heurystyka montażu jest przybliżona: wpis z tematu „Próba” bez protokołu też uruchamia przypomnienie.
Przypomnienie nie ma przycisku „Dodaj protokół” — arkusz wpisu nie przyjmuje z góry budowy, więc przycisk pokazuje wpisy budowy.
Pasek nie jest zapamiętywany (brak „ukryj”), bo znika sam.

**Testy.** `src/lib/study/reminders.test.ts` (10: w tym zamówienia — nazwy, archiwum, świeże, bez daty zmiany).
`e2e/site-shortages.spec.ts` („zamówione ponad 3 dni temu…”: zegar +4 dni, przypomnienie, „Karta budowy”, po
„Dostarczone” znika). Problemy i protokół — przez `e2e/study.spec.ts`.

**Commit.** `d41bd89` (2026-10-16), `7f95fe9` (zamówienia, 2026-10-16).

---

### Podpowiedzi tekstu z budowy

**Co robi.** Pusty nowy wpis na wybranej budowie pokazuje pod polem „Co się dzieje?” pigułki: „Jak wczoraj” (tekst najnowszego wpisu tej budowy z poprzedniego dnia kalendarzowego) i do 3 ostatnich różnych tekstów z tej budowy, od najnowszego. Stuknięcie wstawia tekst do pola. Znikają, gdy pole ma treść, i nie pojawiają się przy edycji wpisu.

**Gdzie jest.** Funkcje czyste: `src/lib/study/journalView.ts` (`recentSiteTexts(journal, siteId, limit = 3)`, `yesterdaySiteText(journal, siteId, now)`). UI: `src/components/study/JournalEntrySheet.tsx` (`siteId`, `textSuggestions`, `yesterdayText`; `data-testid="journal-text-suggestions"`).

**Jak działa i dlaczego.** Id budowy liczy się z nazwy w polu przez `findSiteByName(siteDirectory(...))`, więc porównanie idzie po tym samym `entrySiteId`, co oś czasu i raport (wpisy sprzed kart dopasowują się po nazwie). Pigułki są w `journal-text-suggestions` tylko przy pustym polu — nie zasłaniają pisania. Przycisk ma `onPointerDown` z `preventDefault`, żeby nie tracić fokusu z pola (jak pigułki budów). „Jak wczoraj” kopiuje tylko tekst, nie rodzaj ani temat — świadomie, żeby nie zgadywać, czy wczorajszy wpis był o tym samym temacie.

**Ograniczenia i pułapki.** Teksty są deduplikowane po przycięciu spacji (różnica wielkości liter zostaje jako osobna pozycja). Pigułki obcinają długi tekst jedną linią (`title` pokazuje całość). „Wczoraj” liczy się wg czasu lokalnego, nie 24 h wstecz. Podpowiedzi nie działają dla wpisu bez budowy.

**Testy.** `src/lib/study/journalView.test.ts` (7 testów: kolejność, limit, dedup, pusta budowa, wczoraj vs. dziś/przedwczoraj, obce budowy); `e2e/study.spec.ts` („pusty wpis na budowie podpowiada wcześniejsze teksty tej budowy”). Cały `study.spec.ts` 31/31 (w tym telefony).

**Commit.** `7fcff9a` (2026-10-16).

### Wpis jako linijka w zeszycie

**Co robi.** Wpis na liście dziennika wygląda jak linijka w zeszycie: godzina (mono) stoi na marginesie po lewej, oddzielona pionową linią, a wpisy dzieli przerywana linia zamiast osobnej ramki z tłem. Ikona rodzaju, treść, zdjęcia i przyciski działają jak wcześniej.

**Gdzie jest.** `src/components/study/StudyJournal.tsx`: funkcja `JournalItem` (`<li>` jako siatka `grid-cols-[3.25rem_minmax(0,1fr)]`, element `<time>` z `dateTime`), lista wpisów w `StudyJournal` (`<ul>` bez `space-y-2`, bo odstęp daje `py-3` wpisu).

**Jak działa i dlaczego.** Godzina przeniesiona z wiersza meta na margines, żeby czas czytało się pionowo jak w zeszycie i nie konkurowało z pigułkami tematu. Linia pionowa to `border-r` kolumny godziny; oddzielenie wpisów `border-b border-dashed` z `last:border-b-0`. Usunięto ramkę `rounded-xl border bg-card`, bo przy wielu wpisach na dzień karty zlewały się w bloki. Przy pierwszym wpisie `first:pt-1`, żeby nie dublować odstępu pod nagłówkiem dnia.

**Ograniczenia i pułapki.** Wpis z problemem nadal ma ikonę ostrzegawczą, a rozwiązany — szary znacznik `CircleCheck` (teraz z `mt-0.5`, żeby stał równo z pierwszą linią). Na bardzo wąskim ekranie kolumna godziny zajmuje 52 px, więc treść zostaje ok. 280 px. Nie testowano wizualnie w przeglądarce, tylko przez e2e (układ nie jest tam sprawdzany).

**Testy.** `e2e/study.spec.ts` (37/37 razem z `desktop-columns.spec.ts`, w tym telefony iPhone 14 i Pixel 7). Selektory używają `data-journal-entry`, nie klas. Typecheck i lint pliku czyste.

**Commit.** `162dcdf` (2026-10-16).

---

## Praca → Dziennik: raport do szefa i grupy w WhatsApp

**Co robi.** W oknie „Raport z budowy” zapisujesz odbiorców: szefa (imię i numer WhatsApp) i/lub grupę (nazwa,
opcjonalnie link zaproszenia). Potem jednym stuknięciem:
- **„Szefowi”** otwiera czat WhatsApp z szefem z gotowym tekstem raportu — zostaje tylko „Wyślij”.
- **„Do grupy”** otwiera systemowe „Udostępnij” z tekstem i zdjęciami — w WhatsApp wybierasz grupę. Gdy przeglądarka
  nie ma udostępniania (komputer), tekst trafia do schowka, a link zaproszenia otwiera grupę — wklejasz.
Odbiorców zmienia przycisk „Odbiorcy” (na telefonie ikona). Bez odbiorców jest jeden przycisk „WhatsApp: dodaj szefa
lub grupę”.

**Gdzie jest.**
- `src/lib/study/boss.ts`: `Boss`, `WaGroup`, `normalizePhone` (+48, 0048, 9 cyfr → `48…`), `formatPhone`,
  `cleanBoss`, `normalizeGroupLink` (tylko `chat.whatsapp.com/…`), `cleanGroup`, `whatsappUrl` (`wa.me/<numer>?text=`,
  przycięcie do 3500 znaków na granicy linii z dopiskiem „raport skrócony”).
- `src/lib/study/report.ts`: `reportWhatsApp` — tytuł i dni jako `*pogrubienie*` zamiast nagłówków markdown.
- `src/lib/study/yStudy.ts`: klucze `boss` i `waGroup` w mapie `studyMeta`, pola `boss`/`group` w `StudyDump` i
  `StudyState`, `setBoss`/`setGroup`; `replaceAll` i `mergeIn` je przenoszą.
- `src/lib/study/store.ts`: `saveBoss(name, phone)`, `saveGroup(name, link)` (pusty numer/nazwa usuwa, zły → `false`).
- `src/components/study/JournalReport.tsx`: `sendToBoss`, `sendToGroup`, formularz `RecipientsForm`.

**Jak działa i dlaczego.**
- Aplikacja nie ma serwera, więc nie wysyła sama — otwiera WhatsApp, a wysyła użytkownik. Oficjalne API (WhatsApp
  Cloud API) wymaga konta firmowego, serwera i tokenu, którego nie wolno trzymać w aplikacji na telefonie; nieoficjalne
  klienty (np. serwery MCP na whatsmeow) łamią regulamin WhatsApp i grożą blokadą numeru — świadomie nie.
- `wa.me` otwiera tylko czat z osobą (numer), nie grupę — dlatego grupa idzie przez `navigator.share`, który przy okazji
  niesie zdjęcia (te same pliki co „Udostępnij”, do 10). Link zaproszenia grupy otwiera czat grupy, ale nie wstawia tekstu.
- Odbiorcy są w dokumencie Yjs (`studyMeta`), więc są na każdym sparowanym telefonie i w kopii zapasowej (sekcja `study`).
- Na telefonie przyciski bez imienia/nazwy (nie mieszczą się obok siebie); pełna nazwa zostaje w `aria-label`.
- Pole linku bez `type="url"`: link bez `https://` zatrzymałaby walidacja przeglądarki, a `normalizeGroupLink` go przyjmuje.

**Ograniczenia i pułapki.**
- Zdjęcia nie idą przez „Szefowi” (`wa.me` przenosi tylko tekst) — toast podpowiada „Do grupy”/„Udostępnij”.
- Długi raport (np. miesiąc) w czacie z szefem jest przycinany; pełny tekst: „Kopiuj tekst” albo „Udostępnij”.
- Numer szefa i link grupy trafiają do synchronizacji z własnymi urządzeniami i do kopii — nigdzie dalej.

**Testy.** `src/lib/study/boss.test.ts`, `src/lib/study/report.test.ts` („reportWhatsApp…”),
`src/lib/study/yStudy.test.ts` („szef: zapis przechodzi na drugi telefon i do kopii…”),
`e2e/report-whatsapp.spec.ts` (walidacja, czat z szefem, udostępnienie do grupy, odświeżenie; grupa bez udostępniania).

**Commit.** `364279d` (2026-10-15).

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

## Notatki — scalanie zaznaczonych notatek (2026-10-18)

- **Co robi:** przycisk „Scal zaznaczone w jedną notatkę” na pasku zbiorczym (tylko lista). Pierwsza notatka na liście dostaje treść pozostałych (z pogrubionym tytułem, oddzielone `---`), etykiety, obrazy, załączniki, checklisty i najwyższy priorytet. Termin zostaje pierwszej, a gdy go nie ma — najwcześniejszy z pozostałych. Pozostałe idą do kosza. „Cofnij” przywraca pola i notatki.
- **Gdzie jest:** `src/lib/mergeNotes.ts` (`planMerge`, czysta funkcja), `src/hooks/useBulkNoteOps.ts` (`mergeSelected`), `src/components/BulkActionBar.tsx` (prop `onMerge`, ikona `Combine`), `src/pages/Index.tsx` (podpięcie).
- **Odmowa z komunikatem:** mniej niż 2 notatki, notatka prywatna, tylko do odczytu, archiwum lub kosz, podstrony, otwarty edytor celu.
- **Ograniczenia i pułapki:** scalanie nie przenosi właściwości (`props`) ani kolorów pozostałych notatek. Wikilinki do scalonych tytułów po wyrzuceniu do kosza przestają wskazywać na żywą notatkę.
- **Testy:** `src/lib/mergeNotes.test.ts` (14), `e2e/merge-notes.spec.ts` (2).
- **Commit:** 5f003ca (2026-10-18), scalone do master.

## Notatki — kopiuj jako Markdown w menu kafla (2026-10-18)

- **Co robi:** w menu „Więcej opcji” kafla (także w arkuszu na telefonie) akcja kopiuje notatkę jako Markdown. Ukryta dla notatek prywatnych.
- **Gdzie jest:** `src/components/NoteCardActions.tsx` (`MoreActions`), używa istniejącego `copyNoteToClipboard`.
- **Testy:** `e2e/card-copy.spec.ts`.
- **Commit:** d0c6eed (2026-10-18), scalone do master.

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

## Praca → Dziennik budowy — „Tu jestem” (plan mobilny M2.1, 2026-10-18)

- **Co robi:** w arkuszu wpisu przycisk „Tu jestem” zapisuje lokalizację wpisu (tylko po stuknięciu, nigdy w tle) z dokładnością („Tu (±12 m)”, link do map, × usuwa). Jeśli w promieniu 300 m jest budowa z zapisaną lokalizacją, pojawia się „Budowa obok: …”. Lokalizację budowy zapisuje „Zapisz jako lokalizację budowy” w arkuszu (budowa z kartą) albo akcja w toaście „Zapisano wpis” (nowa budowa — karta powstaje przy zapisie). Na liście Dziennika wpis z lokalizacją ma link „Mapa”.
- **Gdzie jest:** `src/lib/study/geo.ts` (`GeoPoint`, `cleanGeo`, `distanceM`, `nearestSite`, `mapsUrl`, `accuracyLabel`); pole `geo` w `JournalEntry` (`yStudy.ts`, `cleanEntry`), `SiteCard` (`sites.ts`, `cleanSite`), `JournalDraft` (`draft.ts`), `NewJournalEntry`/`entryFields` i `sanitizeStudy` (`store.ts`), `openJournalEdit` (`entrySheet.ts`); `setSiteGeo` w `store.ts`; UI w `JournalEntrySheet.tsx` i `StudyJournal.tsx`.
- **Jak działa:** współrzędne zaokrąglone do ~1 m, dokładność w metrach. Sama lokalizacja nie czyni wpisu niepustym.
- **Ograniczenia i pułapki:** lokalizacja jest tylko w aplikacji — raport dla szefa jej nie zawiera (decyzja domyślna; M2.2 „mapa w raporcie” nie robione). `sanitizeStudy` w `store.ts` ma własną kopię czyszczenia wpisu — nowe pola wpisu trzeba dodać w obu miejscach (`cleanEntry` i `sanitizeStudy`). Bez zgody przeglądarki — komunikat i brak lokalizacji.
- **Testy:** `src/lib/study/geo.test.ts`, `src/lib/study/study.test.ts` („Tu jestem”), e2e `journal-geo.spec.ts`.
- **Commit:** brak — zmiany niezacommitowane.

## Grafik — telefon w poziomie (plan mobilny M3.1, 2026-10-18)

- **Co robi:** na niskim ekranie dotykowym w poziomie przełącznik „Miesiąc/Tydzień” i nawigacja miesiąca są w jednym rzędzie, paleta zmian w jednym przewijanym rzędzie, podpowiedzi o nanoszeniu i przenoszeniu schowane (zostają dla czytnika ekranu przez `aria-describedby`). Siatka miesiąca zaczyna się tuż pod paletą zamiast półtora ekranu niżej.
- **Gdzie jest:** `tailwind.config.ts` (wariant `short:` — `(orientation: landscape) and (max-height: 500px) and (pointer: coarse)`); `src/components/shifts/ShiftsView.tsx` (`short:grid` z dwiema kolumnami, `short:col-span-2` na pozostałych sekcjach, `short:hidden` na podpowiedziach); `src/components/shifts/BrushBar.tsx` (`short:flex-nowrap!`).
- **Ograniczenia i pułapki:** zrzut `fullPage` w Playwright powiększa wysokość okna i wyłącza wariant — sprawdzaj zwykłym zrzutem 844×390.
- **Testy:** e2e `shifts-landscape.spec.ts` (Chromium, iPhone 14, Pixel 7), `mobile-layout.spec.ts`, `shifts*.spec.ts`.
- **Commit:** brak — zmiany niezacommitowane.

## Wydajność — panel statusu synchronizacji leniwie (2026-10-18)

- **Co robi:** panel po stuknięciu pigułki statusu zapisu (`OfflineQueuePanel`) ładuje się przy pierwszym otwarciu i zostaje zamontowany (animacja zamykania działa).
- **Gdzie jest:** `src/components/OfflineStatus.tsx` (`lazy`, `panelMounted`).
- **Dlaczego:** funkcje mobilne dodały ok. 1,1 KB do wejściowego JS; przed nimi zapas do progu 384 KB wynosił ok. 0,5 KB. Po przeniesieniu panelu wejściowy JS to 393 200 B przy progu 393 216 B — **zapas 16 B**; następna zmiana w głównej paczce musi czymś się zrównoważyć.

## Praca → raport z budowy — mapa przy wpisie (plan mobilny M2.2, 2026-10-18)

- **Co robi:** wpis z lokalizacją „Tu jestem” ma w raporcie punkt „Mapa (±12 m): <link>”. Link otwiera miejsce w aplikacji map. Dotyczy tekstu raportu (schowek, WhatsApp, notatka) i podglądu/wydruku.
- **Gdzie jest:** `src/lib/study/report.ts` (`entryLine` — dopisuje linię „Mapa”); `src/components/study/JournalReport.tsx` (`ReportPaper` — link w punkcie, `data-report-geo`); helpery `accuracyLabel`, `mapsUrl` z `src/lib/study/geo.ts`.
- **Decyzja:** w raporcie trafiają tylko współrzędne przy wpisach, które same je mają. Adresu budowy w tym miejscu nie ma. Wcześniej otwarte pytanie (czy lokalizacja w ogóle może iść do szefa) rozstrzygnięto: raport dostaje link, bo użytkownik poprosił o M2.2. Wpisy bez „Tu jestem” są bez zmian.
- **Ograniczenia i pułapki:** link wysyła się razem z raportem — kto dostanie raport, zobaczy miejsce wpisu. Współrzędne są zaokrąglone do ~1 m. Raport nie ma osobnego przełącznika „bez lokalizacji”.
- **Testy:** `src/lib/study/report.test.ts` („Tu jestem” w treści); e2e `report-nudge.spec.ts`, `report-whatsapp.spec.ts`, `study.spec.ts`, `journal-geo.spec.ts`.
- **Commit:** brak — zmiany niezacommitowane.

## Poprawki po audycie (2026-10-18)

- **Paczka:** `vendor-radix` w `manualChunks` zostawiony — próba usunięcia powiększyła wejściowy JS o 1,5 KB (Radix trafia do `index`). Zmiana cofnięta.
- **Usunięte pliki:** `public/placeholder.svg` (bez odwołań, wypadł z precache), `src/components/ui/skeleton.tsx` (bez importów).
- **Logowanie błędów:** `study/data.ts` (`legacyStudyMerged`), `privateNotes.ts` (`readThrottle` — uszkodzony licznik prób hasła), zapis z `logDiag`. Parser w `notesStore.ts` bez logu — dodanie przekroczyłoby budżet paczki o 14 B.
- **Etykiety:** przełącznik motywu ma stałą nazwę „Tryb ciemny” z `aria-pressed` (AppHeader, AppSidebar); pasek boczny z tą samą etykietą widoczną; „Import i eksport” → „Import / Eksport” w dolnym menu; „Nie dało się” → „Nie udało się” (`ViewErrorBoundary`).
- **Korekty audytu:** „Widok i kolumny” nie występuje dwa razy naraz (inna gałąź telefon/komputer); `aria-expanded` na filtrach i sortowaniu ustawia Radix; `ui/calendar.tsx` i `ui/overlay-back.tsx` są używane.
- **Budżet:** wejściowy JS 393 208 B przy progu 393 216 B (zapas 8 B).

## Synchronizacja — krótkie kody odrzucone, diagnostyka, ponowne łączenie (plan synchronizacji, fazy 0, 1, 3, 2026-10-18)

- **Co robi:** kody parowania muszą mieć 12 znaków (8-znakowe kody nie są przyjmowane ani przy wpisywaniu, ani w zapisanych ustawieniach — zapisany krótki kod jest usuwany i pokazuje się komunikat „Synchronizacja wyłączona: kod był za krótki” z przyciskiem „Wygeneruj nowy kod”). Ustawienia mają jedno zdanie diagnozy: brak połączenia z serwerami, połączono bez drugiego urządzenia, łączenie (ile serwerów odpowiada). Po powrocie do karty albo odzyskaniu sieci sync łączy się ponownie, nie częściej niż co 10 s.
- **Gdzie jest:** `src/lib/yjsSync.ts` (`readPrefs` — odrzucenie krótkiego kodu i pole `shortCodeDropped`; `joinWithCode` zwraca `null` dla złej długości; `wasShortCodeDropped`; `SyncState.signalingUp/signalingTotal`; `reconnectIfNeeded` i listener `visibilitychange` w `initSync`); `src/components/SyncSettings.tsx` (`diagnosis`, alert o skróconym kodzie).
- **Ograniczenia i pułapki:** nie dodano TURN (brak hostingu — decyzja użytkownika); połączenie przez część sieci komórkowych może się nie udać. Synchronizacja nadal wymaga, by oba urządzenia były online jednocześnie. Listener `online` kosztuje 3 B — zostawiony.
- **Budżet:** wejściowy JS to 393 402 B przy progu 393 216 B — **przekroczenie o 186 B**. Zmiana czeka na decyzję: podniesienie progu albo oszczędności.
- **Testy:** `src/lib/yjsSync.test.ts` (22/22; dwa testy uodpornione na kolejność — liczą tylko instancje z własnego testu; nowy test zapisanego krótkiego kodu); e2e `sync-code.spec.ts` (kod 12 znaków), `file-sync.spec.ts`.
- **Commit:** brak — zmiany niezacommitowane.

## Praca — wpisy bez utraty danych (plan działu Praca, D1, D4, T7, 2026-10-18)

- **Co robi:** wpis, który ma tylko odhaczone punkty listy, nie znika z dziennika, raportów i serii, gdy jego punkt został usunięty; stare odhaczenia są po prostu pomijane, a sam wpis zostaje. Wpis ze zdjęciem, którego bajtów nie ma w kopii, przeżywa import z zachowaną referencją. Usunięcie wpisu ze zdjęciami i „Cofnij” przywraca wpis z tymi samymi zdjęciami.
- **Gdzie jest:** `src/lib/study/store.ts` (`sanitizeStudy` — pustość liczona przed odrzuceniem nieznanych punktów przez `cleanEntryParts(...).empty`, patrz „Praca — porządki po planie” niżej).
- **Testy:** `src/lib/study/study.test.ts` — trzy nowe testy (wpis z odhaczeniami usuniętego punktu, referencja do brakującego zdjęcia, usunięcie i „Cofnij” ze zdjęciami).
- **Nie zrobione z planu:** D2 (przywracanie kopii — walidacja przed kasowaniem), D3 (budżet kopii 40 MB), D5 (model wpisu), reszta planu — czekają na decyzje z planu działu Praca.
- **Commit:** brak — zmiany niezacommitowane.

## Praca — kolejne poprawki z planu (D2 częściowo, U3, T3, 2026-10-18)

- **Przywracanie kopii (D2):** wpisy Nauki odrzucone przy czyszczeniu kopii są liczone i zapisywane w diagnostyce (`exportNotes.ts`, ostrzeżenie „pominięto N wpisów”). Ta sama kopia nie jest już czyszczona dwukrotnie. Brakuje jeszcze pokazania liczby w oknie przywracania.
- **Nazwa zakładki (U3):** „Lista” → „Lista kontrolna” (`StudyView.tsx`). Testy e2e działu nie wymagały zmian (dopasowanie po podciągu).
- **Godziny (T3):** `parseHours` odrzuca minuty powyżej 59 (`6:70` to błąd, a nie 7 h 10 min). Test w `siteHours.test.ts`.
- **Testy:** 1391 jednostkowych; e2e study, study-custom, bundle, today-study — 43/43.
- **Commit:** brak — zmiany niezacommitowane.

## Praca — testy listy budowy z podstawą (T1, 2026-10-18)

- **Co sprawdzają:** `setSiteStages` z podstawą (`base`) nie kasuje pozycji dodanych na drugim urządzeniu; `markSiteOrdered` zapisuje moment zamówienia na karcie.
- **Gdzie:** `src/lib/study/study.test.ts` — dwa nowe testy (blok „listy budowy: zapis z podstawą”).
- **Testy:** 1393 jednostkowe; e2e bundle i study — 40/40.
- **Commit:** brak — zmiany niezacommitowane.

## Praca — porządek w kodzie i odporność danych (plan działu Praca: L3, L4, L5, D2, 2026-10-18)

- **Cykl importów (L3):** `siteKey`, `foldName`, `fold` i `entrySiteId` przeniesione do `src/lib/study/siteKey.ts` (bez zależności od reszty działu). `sites.ts` re-eksportuje je, więc importy w innych plikach nie zmieniły się; `siteHours.ts` importuje z `siteKey.ts` — cykl `sites` ↔ `siteHours` zniknął.
- **Normalizator nazw kształtek (L4):** `fittingKey` korzysta z tej samej funkcji `foldName` (wynik identyczny dla polskich znaków).
- **Dane z zewnątrz (L5):** `siteItems.ts` czyści pozycje listy budowy (braki, zamówienia, wizyty serwisowe, dokumenty, godziny) funkcjami `clean*`, zamiast rzutować `as`. Pozycja, której nie da się oczyścić, jest pomijana zamiast trafić do stanu jako surowa.
- **Ślad przy przywracaniu (D2, dokończone):** `restoreFullBackup` zwraca liczbę pominiętych wpisów Nauki; okno przywracania pokazuje ją w komunikacie i wydłuża czas do odświeżenia.
- **Testy:** 1393 jednostkowe; e2e kopia, Nauka, listy budowy (etapy, braki, zamówienia), bundle — 50/50.
  Dopisane 2026-10-20: `src/lib/fullBackup.test.ts` (wpis Nauki o nieznanym rodzaju odpada, `studyDropped` = 1),
  `src/lib/study/siteItems.test.ts` (`composeSiteLists`, `stripLists`), `src/lib/study/workLine.test.ts`
  (`workLine`, `workMinutesOf`). Pełny Vitest: 183 pliki zielone.
- **Commit:** `304bbe8` (2026-10-20, plan Pracy: D2 test, D3 i L2 sprawdzone, L1 częściowo, T3).

## Praca — komunikaty, dotyk zakładek, testy dokumentów budowy (U2, U6, U4, T2, 2026-10-18)

- **Seria wpisów (U2):** już działa — po zapisie zostają budowa i rodzaj, czyści się treść; test w `study.test.ts` pilnuje tego zachowania.
- **Brak miejsca (U6):** każdy komunikat o braku miejsca w pamięci podpowiada, co zrobić (usunąć stare zdjęcia albo obrazy, zrobić kopię zapasową) — `JournalEntrySheet.tsx`, `AddNoteBar.tsx`, `useNoteImages.ts`.
- **Dotyk (U4):** cztery zakładki działu Praca (Quiz, Tablica, Lista kontrolna, Dziennik) mają na dotyku minimalną wysokość 44 px (`coarse:min-h-11`, `StudyView.tsx`). Wspólny komponent zakładek bez zmian.
- **Testy (T2):** `src/lib/study/siteDocsAdd.test.ts` — odrzucenie nieobsługiwanego typu pliku, limit liczby dokumentów przy pełnej liście, brak plików.
- **Testy:** 1396 jednostkowych; e2e study, study-custom, touch-targets, site-docs, journal-geo, bundle — 52/52.
- **Commit:** brak — zmiany niezacommitowane.

## Praca — testy bez zależności od czasu i flaki (T5, T6, podział godzin, 2026-10-18)

- **Flaki (T5):** `report-nudge.spec.ts` — negatywne asercje („przypomnienia nie ma”) nie czekają już 1,5 s na sztywno, tylko przesuwają zegar Playwrighta o dwie minuty.
- **Zegar (T6):** `TodayDueList.test.tsx` ma stały „teraz” i sfałszowany zegar `Date`.
- **Podział godzin:** reguła „po równo” wydzielona do `evenShare` w `siteHours.ts` (zaokrąglenie do 5 min), z testem; `DayHoursDialog` jej używa.
- **Testy:** 1397 jednostkowych; e2e site-hours, report-nudge, weekly-review, today-study, bundle — 21/21.
- **Commit:** zapisany poniżej.

## Długi — pożyczki i spłaty (nowy dział, 2026-10-19)

- **Co robi:** zapisujesz, komu ile pożyczyłeś i ile już oddał. Góra: „Są nam winni” i „My jesteśmy winni”. Pod spodem lista osób z saldem i paskiem spłaty. Stuknięcie w osobę otwiera jej historię, z przyciskiem „Oddał całość” i usuwaniem wpisów (z „Cofnij”).
- **Gdzie jest:**
  - `src/components/debts/DebtsView.tsx` — widok: `Summary`, `AddForm` (rodzaj, osoba z podpowiedziami, kwota, dzień, „za co”), `People`, `PersonSheet`/`PersonHistory`.
  - `src/lib/debts/model.ts` — czysty model: `cleanDebt`, `parseAmount`, `formatAmount`, `balances`, `totals`, `knownPeople`, `personKey`.
  - `src/lib/debts/yDebts.ts` — `createYDebts(doc)`: mapa `debts` w Y.Doc (klucz = id wpisu).
  - `src/lib/debts/store.ts` — `useDebts()` i akcje `addDebt`, `addDebtFromText`, `removeDebt`, `restoreDebt` na `yjsStore.doc`.
  - Podpięcie: `hooks/useFilteredNotes.ts` (typ `View` = `"debts"`), `pages/Index.tsx` (leniwy widok, bez listy notatek i wyszukiwarki), `components/BottomNav.tsx` (kafel „Długi” w „Więcej”), `components/sidebar/sidebarItems.ts`, `components/CommandPalette.tsx`, `components/AppHeader.tsx` (tytuł), `lib/viewRoute.ts` (adres `/dlugi`).
- **Jak działa:**
  - Każdy wpis to osobny klucz mapy Yjs, więc dwa telefony dopisujące pożyczki scalają się bez strat (jak Grafik i listy budowy).
  - Kwoty w groszach (liczby całkowite). `parseAmount` przyjmuje „1 234,5”, „1234.50”, „80”; odrzuca zero, litery, więcej niż dwa miejsca po przecinku i ponad 1 000 000 zł.
  - Saldo osoby = pożyczki − spłaty. Dodatnie: jest nam winna. Ujemne: my jesteśmy winni (tylko gdy ktoś oddał więcej, niż pożyczył). Osoby grupowane bez względu na wielkość liter („Anna” = „anna”). Kolejność: nam winni, my winni, rozliczeni.
  - Po zapisie zostaje osoba i data, czyszczona jest kwota i notatka, a fokus wraca do pola kwoty. Komunikat „Cofnij” usuwa właśnie dodany wpis.
  - „Oddał całość” dodaje wpis spłaty na pełne saldo.
- **Ograniczenia i pułapki:**
  - Tylko dwa rodzaje: „Pożyczyłem” i „Oddał mi”. Nie ma jeszcze zapisu długu wobec innych osób (pożyczyłeś od kogoś).
  - Limit 2000 wpisów (`DEBT_MAX_ENTRIES`), 40 znaków na osobę, 200 na notatkę.
  - Nieprawidłowe wpisy od peera są pomijane po cichu przy odczycie (`cleanDebt`).
  - Waluta to zawsze złote (zł).
  - Dane są w dokumencie notatek, więc idą z synchronizacją i z kopią pełną. Nie są w eksporcie tylko Nauki/Grafiku, bo ich tam nie ma.
- **Testy:** `src/lib/debts/model.test.ts` (kwoty, czyszczenie, salda, sortowanie), `src/lib/debts/yDebts.test.ts` (scalanie dwóch dokumentów, usunięcie i przywrócenie, śmieci od peera, powiadomienia). Ręcznie sprawdzone w przeglądarce na szerokości telefonu: zapis, saldo i „Cofnij”.
- **Commit:** 94434d5, 2026-10-19.

## Wspólne — arkusz „Nowa” z przycisku „+” (wygląd i opisy)

- **Co robi:** przytrzymanie „+” na dolnym pasku otwiera arkusz „Nowa” z pięcioma kafelkami (Notatka, Lista zadań, Dyktuj, Zdjęcie, Rysunek). Każdy ma teraz ikonę w kolorze rodzaju i jedno zdanie, co się stanie. Stuknięcie „+” nadal od razu otwiera nową notatkę.
- **Gdzie jest:** `src/components/BottomNav.tsx` — `QuickTile` (kafel z tonem `primary`/`success`/`warning`), arkusz `quickOpen`.
- **Jak działa:** na telefonie kafle w dwóch kolumnach; „Dyktuj” tylko tam, gdzie przeglądarka ma rozpoznawanie mowy. Kafel „Długi” dodany też do arkusza „Więcej” (sekcja „Przejdź do”).
- **Ograniczenia:** zachowanie stuknięcia bez zmian — arkusz pokazuje się po przytrzymaniu lub z „Więcej → Dodaj…”. Podpowiedź o przytrzymaniu pojawia się po czwartym stuknięciu (jak dotąd).
- **Testy:** typecheck czysty; pełny Vitest 1409/1409. Sprawdzone wizualnie w przeglądarce (telefon 390 px).

## Notatki — rozpoznawanie fraz w kompozytorze (`quickCapture`, poprawka tytułu, 2026-10-19)

- **Co robi:** w kompozytorze nowej notatki `#etykieta`, `@folder`, `!`/`!!` (priorytet) i frazy daty na końcu pola („jutro 9:00”, „za 2h”, „w piątek”) zamieniają się w cechy notatki, a ich tekst znika z pola.
- **Gdzie jest:** `src/lib/quickCapture.ts` — `scanField` (rozpoznawanie), `applyCapture` (wycinanie tekstu), `PREPOSITION_BEFORE_RE`.
- **Jak działa:** data na końcu pola to `DATE_END_RE`. W **tytule** nie jest traktowana jako termin, gdy stoi po przyimku (na, do, w, we, od, o, dla, przed, po). Dzięki temu „Lista na sobotę” zostaje tytułem bez przypomnienia. W **treści** zachowanie bez zmian: „zadzwonić do lekarza jutro 9:00” nadal ustawia przypomnienie i wycina frazę.
- **Ograniczenia:** „Spotkanie w piątek” w tytule też nie ustawi przypomnienia (świadoma decyzja, plan: `docs/plan-notatki-2026-10-19.md`, opcja A). Tytuł bez przyimka („Zadzwonić jutro 9:00”) nadal zamienia datę w przypomnienie i wycina ją z tytułu.
- **Błąd naprawiony:** kompozytor zapisywał „Lista na sobotę” jako „Lista na” z przypomnieniem na sobotę.
- **Testy:** `src/lib/quickCapture.test.ts` (38, w tym trzy nowe dla tytułu). Sprawdzone w prawdziwym Chrome (puppeteer-core, `scratchpad/test-chrome.mjs`): karta ma tytuł „Lista na sobotę”.
- **Commit:** 6e95430, 2026-10-19.

## Notatki — pole tytułu w kompozytorze to `TitleField` (faza 1 planu Notatek, 2026-10-19)

- **Co robi:** tytuł nowej notatki zawija się na telefonie tak samo jak tytuł w edytorze (wcześniej w kompozytorze był zwykły `<input>`, który przewijał długi tytuł i ucinał jego początek).
- **Gdzie jest:** `src/components/TitleField.tsx` (komponent) i `src/components/AddNoteBar.tsx` (kompozytor, pole tytułu i fokus przez `titleRef`).
- **Jak działa:** `TitleField` to `<textarea>` z automatyczną wysokością. Przyjmuje `ref` od rodzica (kompozytor ustawia na nim fokus) i łączy go z własnym refem do pomiaru. `onEnter` dostaje zdarzenie klawisza, więc kompozytor zachowuje skróty: Enter przenosi do treści, Ctrl+Enter zamyka, Ctrl+Shift+Enter zapisuje i zostawia pusty szkic.
- **Ograniczenia i pułapki:** w DOM pole tytułu to `textarea`, a jego treść liczy się jako tekst. Testy e2e szukające tytułu przez `getByText` mogą trafić w pole, gdy kompozytor jeszcze się zwija. Stąd `getByRole("heading", …)` w `e2e/quick-capture.spec.ts` (Ctrl+Shift+L w edycji).
- **Testy:** `e2e/quick-capture.spec.ts` (10/10), `e2e/composer.spec.ts`, `e2e/editing.spec.ts`. W prawdziwym Chrome (`scratchpad/test-chrome.mjs`, 390 px): długi tytuł zawija się na co najmniej dwie linie, nie przewija w bok i zapisuje się w całości.
- **Commit:** 280f294, 2026-10-19.

## Notatki — nagłówek widoku w Zeszycie (faza 2 planu Notatek, 2026-10-19)

- **Co robi:** w stylu Zeszyt (domyślnym) tytuł widoku („Notatki”, „Dziś”, „Długi”…) jest w Fraunces, a pasek nagłówka ma tylko cienką kreskę pod sobą, bez cienia uniesienia. Pozostałe style bez zmian.
- **Gdzie jest:** `src/components/AppHeader.tsx` (klasy `app-header` na `<header>`, `app-title` na `<h1>`), `src/index.css` (reguły `html[data-skin="zeszyt"] .app-title` i `.app-header` obok `@utility header-glow`).
- **Jak działa:** `data-skin` na `<html>` jest zawsze ustawiony (domyślnie `zeszyt`, `src/lib/skins.ts`). Dawna reguła `html:not([data-skin]) h1` nigdy nie pasowała, więc Fraunces w nagłówku w ogóle się nie pokazywał. Zastąpiona selektorem `data-skin="zeszyt"` ograniczonym do klas nagłówka, żeby nie zmienić krojów wszystkich `h1` w aplikacji.
- **Szkło:** klasa `glass` to już tylko pełne tło (bez rozmycia od wcześniejszych zmian), więc nie zmieniałem jej. Usunięto cień uniesienia, a zostaje linia.
- **Czas przejścia:** nagłówek używa tokenu `duration-base` zamiast `duration-300`.
- **Pułapki:** reguły z `:not([data-skin])` nie działają w tej aplikacji. Każdy styl dla domyślnego wyglądu pisać jako `[data-skin="zeszyt"]`.
- **Testy:** w prawdziwym Chrome (`scratchpad/test-chrome.mjs`): tytuł w Fraunces, pasek z samą linią. Vitest 1411/1411. E2E `a11y` 56/56 w pełni. E2E `mobile-layout` 53 zaliczone, 3 niezaliczone: `/praca` przy 320 px jest szersza niż ekran (`chromium`, `iphone-14`, `pixel-7`). Ten sam test nie przechodzi na HEAD przed tą zmianą, więc to osobny, wcześniejszy problem widoku Praca, nie nagłówka.
- **Commit:** 2745eaf, 2026-10-19.

## Notatki — pasek wyszukiwania: stała etykieta, podpowiedzi filtrów w pustym wyniku (faza 3 planu Notatek, 2026-10-19)

- **Co robi:** pole „Szukaj notatek...” ma stałą etykietę. Dawniej zmieniało ją co 3,2 s („Spróbuj: etykieta:praca” itd.), co było nieczytelne. Podpowiedzi filtrów (`etykieta:`, `ma:`, `starsze:`) pokazują się teraz, gdy wyszukiwanie nic nie znajdzie: w zdaniu pustego wyniku.
- **Gdzie jest:** `src/components/SearchBar.tsx` (stała `PLACEHOLDER`; usunięte `HINTS`, licznik i interwał), `src/components/EmptyState.tsx` (gałąź `search`, zdanie w opisie).
- **Jak działa:** placeholder jest stały. Podpowiedzi operatorów z listy usuniętej z pola są w opisie „Brak wyników”, bo tam użytkownik szuka właściwego sposobu. Podpowiedź „Naciśnij / aby wyszukać” usunięta z pola (skrót jest w oknie skrótów).
- **Pułapki:** na telefonie są dwa pola `input[type=search][aria-label="Szukaj w notatkach"]` — jedno w nagłówku, ukryte na małych ekranach, drugie w treści. Testy muszą brać widoczne (`offsetParent !== null`), inaczej piszą w ukryte pole.
- **Testy:** `scratchpad/test-chrome.mjs` (w Chrome: placeholder po 3,6 s bez zmiany; pusty wynik zawiera „etykieta:praca” i „ma:przypomnienie”). E2E: `saved-filters`, `search-highlight`, `search-backup` — 6/6. Vitest: patrz wpis commitu.
- **Commit:** d3f446f, 2026-10-19.

## Notatki — licznik grupy jako pieczątka (faza 4 planu Notatek, 2026-10-19)

- **Co robi:** liczba notatek przy nagłówku grupy („Przypięte”, „Inne”, etykiety) jest pieczątką (obwódka, bez wypełnienia), a nie wypełnioną pigułką. Zgodnie z regułą pieczątek liczniki, które nie są przyciskami, mają wyglądać jak stempel.
- **Gdzie jest:** `src/components/NoteGroupSection.tsx` — licznik to `<span className="stamp-tag …">`. Styl `.stamp-tag` (obwódka `currentColor`, mono 11 px) już istniał w `src/index.css`.
- **Jak działa:** pieczątka dziedziczy kolor z nagłówka grupy, więc zmienia się z motywem. Nie ma osobnego koloru: kontrast wynika z tokenów `--foreground` i tła.
- **Kontrast (zmierzony w Chrome):** jasny motyw 15,54:1 (tło `rgb(252,251,246)`, tekst `rgb(29,33,43)`), ciemny 15,14:1 (tło `rgb(21,17,14)`, tekst `rgb(235,230,224)`). Próg planu: 4,5:1.
- **Pułapki:** grupy pojawiają się w widoku „Notatki” tylko przy przypiętych notatkach albo ustawionym grupowaniu (`kaczy.viewPrefs.v1`, `groupBy`). W testach ustawiać `groupBy: "label"` przed załadowaniem.
- **Testy:** `scratchpad/test-chrome.mjs` (Chrome, jasny i ciemny motyw wymuszone przez `kaczy-theme`): jedna pieczątka, zero starych pigułek, kontrast jak wyżej. E2E `note-groups`, `contrast`: 9/9. Vitest 1411/1411.
- **Commit:** 707e7a0, 2026-10-19.

## Notatki — kafel notatki: promień z tokenu, uniesienie tylko dla myszy (faza 5 planu Notatek, 2026-10-19)

- **Co robi:** kafel notatki ma promień z tokenu `rounded-card` (1 rem, `--r-card`) zamiast `rounded-2xl`. Wizualnie bez zmiany (obie wartości to 16 px). Uniesienie kafla przy najechaniu jest tylko dla wskaźnika myszy, a na telefonie kafel stoi w miejscu.
- **Gdzie jest:** `src/components/NoteCard.tsx` (klasy kafla), `src/index.css` (`note-shadow` = `--elevation-1`, jeden poziom; uniesienie w `@media (hover: hover) and (pointer: fine)` przy `.note-lift:hover .note-card`).
- **Jak działa:** cień spoczynkowy to jeden poziom (`--elevation-1`), a `note-shadow-hover` / uniesienie `translate: 0 -2px` działają tylko przy `hover:hover` i `pointer:fine`. Na dotyku hover nie istnieje, więc brak „przyklejonego” uniesienia po stuknięciu.
- **Czego nie zmieniano:** obramowanie `border-border/50` i 46 innych miejsc z `rounded-2xl` w innych komponentach (osobny, kosmetyczny PR, zob. plan).
- **Testy:** `scratchpad/test-chrome.mjs` — promień 16 px, `hoverFine=false` i `translate=none` na dotyku, zero poziomego przewijania przy 390 px. E2E `touch-targets`, `card-images`: 8/8. Vitest: patrz wpis commitu.
- **Commit:** bb48640, 2026-10-19.

## Notatki — puste stany z następnym krokiem (faza 6 planu Notatek, 2026-10-19)

- **Co robi:** każdy pusty widok listy (Notatki, Archiwum, Kosz, Przypomnienia, Kalendarz, Grafik, Dziś, Tydzień, etykieta, folder, Skrzynka) ma nagłówek i jedno–dwa zdania, które mówią, co zrobić dalej. Dawniej większość mówiła tylko, że „coś pojawi się tutaj”.
- **Gdzie jest:** `src/components/EmptyState.tsx` — słowniki `HEADINGS` i `DESCRIPTIONS` (teraz eksportowane do testów). Komponent `StatusPanel` bez zmian.
- **Zasady tekstów:** bez wykrzykników, bez przepraszania, zdania w trybie rozkazującym lub z podmiotem „notatka”. Opisane gesty i menu są sprawdzone w kodzie: archiwizacja w lewo (dotyk) i „Archiwizuj” w menu, kosz z 30 dniami, `#etykieta` i `@folder` w kompozytorze, `jutro 9:00` jako przypomnienie.
- **Czego nie dodano:** przycisków w pustych stanach. Plan mówi „gdzie sensowne”, a tu następny krok to już działanie na kaflu albo w kompozytorze („+”), więc przycisk dublowałby ten sam skrót. Do rozważenia później.
- **Testy:** `src/components/EmptyState.copy.test.ts` (12: nagłówek i krok w każdym widoku, długość, brak wykrzykników). W Chrome (`scratchpad/test-chrome.mjs`): /kosz, /archiwum, /przypomnienia pokazują nowe zdania. E2E `reminders-calendar`, `search-backup`: 14/14. Vitest: patrz wpis commitu.
- **Commit:** f5e418c, 2026-10-19.

## Wspólne — podpowiedź o przytrzymaniu „+” od pierwszego stuknięcia (faza 7 planu Notatek, 2026-10-19)

- **Co robi:** po pierwszym stuknięciu „+” na dolnym pasku pojawia się jednorazowy komunikat: „Przytrzymaj „+”, by od razu dodać listę, zdjęcie, rysunek albo dyktować”. Dawniej pokazywał się dopiero po czwartym stuknięciu, czyli często wcale.
- **Gdzie jest:** `src/components/BottomNav.tsx` — `hintOnce`.
- **Jak działa:** flaga `kaczy.fab.hint.v1` w localStorage ustawiana przy pierwszym pokazaniu. Licznik `kaczy.fab.taps` już nie jest używany (stary klucz zostaje w przeglądarkach, nic nie czyta). Ci, którzy już widzieli podpowiedź po czwartym stuknięciu, nie dostaną jej drugi raz.
- **Ograniczenia:** w trybie bez localStorage (prywatne okno) podpowiedzi nie ma — tak jak wcześniej. Komunikat wisi 6 s; w tym czasie kolejne stuknięcia go nie powtarzają.
- **Testy:** osobny skrypt z czystym profilem (`scratchpad/fab.mjs`): po pierwszym stuknięciu komunikat jest, po ponownym (po zniknięciu tostu) już nie. E2E `mobile`: 44/44. Vitest 1423/1423.
- **Commit:** 2cafa53, 2026-10-19.

## Praca — zakładki na 320 px bez przelewania strony (poprawka, 2026-10-19)

- **Co robi:** na wąskich telefonach (320 px) cztery zakładki Pracy (Quiz, Tablica, Lista kontrolna, Dziennik) mieszczą się w szerokości ekranu. Etykiety zawijają się w dwie linie zamiast rozpychać pasek. Od 640 px (`sm`) zakładki wyglądają jak dotąd, w jednej linii.
- **Gdzie jest:** `src/components/study/StudyView.tsx` — `TabsTrigger` z klasami `min-w-0 flex-1 whitespace-normal text-center leading-tight sm:flex-none sm:whitespace-nowrap coarse:min-h-11`.
- **Przyczyna:** „Lista kontrolna” z `whitespace-nowrap` nie mieściła się w czwartej części paska, więc przycisk „Dziennik” wychodził poza ekran o 2 px. Przez to cała strona była szersza od ekranu, a warstwy `fixed` (tło, dolny pasek, nakładki) dziedziczyły tę szerokość.
- **Testy:** `e2e/mobile-layout.spec.ts`: 12/12 (wszystkie trasy przy 320 i 390 px, iPhone 14 i Pixel 7). Test `e2e/diagnostics.spec.ts`: w tym samym przebiegu sprawdzono tekst notatki przez nagłówek karty, a nie `getByText` (pole tytułu kompozytora ma tę samą treść, póki się zamyka). Vitest 1423/1423.
- **Commit:** 9a85c10, 2026-10-19.

## Notatki — poprawka pustych stanów i selektorów e2e po pełnym przebiegu (2026-10-19)

- **Błąd z fazy 6, naprawiony:** skrypt zmiany zapisał nowe zdania w `HEADINGS` (nagłówki), a `DESCRIPTIONS` zostały ze starymi tekstami. Teraz nagłówki są krótkimi etykietami („Kosz jest pusty”), a nowe zdania są w `DESCRIPTIONS`. Test `EmptyState.copy.test.ts` pilnuje, że nagłówek to etykieta bez kropki (do 60 znaków).
- **Skrzynka:** ten sam błąd wpisał nowe zdanie jako nagłówek „Skrzynka jest pusta”; przywrócone.
- **E2E po zmianie kompozytora (faza 1) i wyszukiwania (faza 3):** testy szukające tytułu przez `getByText` trafiały też w pole tytułu (`textarea` ma tę treść) i w ukryte pole wyszukiwania. Zmienione na `getByRole("heading", …)` oraz `getByRole("searchbox", { name: "Szukaj w notatkach" })`: `live-text`, `live-text-focused`, `pwa`, `qol`, `tabs`, `note-links`.
- **Wynik:** 20/20 w tych plikach; Vitest 1424/1424; Chrome 30/30.
- **Nierozwiązane:** budżet wejściowego JS w `e2e/bundle.spec.ts` (385,4 KB gzip przy progu 385 KB). Decyzja o progu należy do właściciela projektu.
- **Commit:** 0284db6, 2026-10-19.

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

## Długi — rodzaje „Pożyczyłem od” i „Oddałem” (2026-10-19)

- **Co robi:** cztery rodzaje wpisu: „Pożyczyłem” i „Oddał mi” (jak dotąd) oraz „Pożyczyłem od” i „Oddałem”. Jedna osoba może mieć długi w obie strony. Saldo to: pożyczyłem (+), oddał mi (−), pożyczyłem od (−), oddałem (+). Dodatnie saldo: ta osoba jest nam winna. Ujemne: my jesteśmy winni i pojawia się przycisk „Oddałem całość”.
- **Gdzie jest:** `src/lib/debts/model.ts` (`DebtKind`, `DEBT_KINDS`, `KIND_SIGN`, `balances`, `cleanDebt`), `src/components/debts/DebtsView.tsx` (wybór rodzaju w siatce 2×2, ikony i kolory według znaku, `PersonHistory`).
- **Kompatybilność:** stare wpisy („lent”, „repaid”) bez zmian, saldo liczone tak samo.
- **Testy:** `src/lib/debts/model.test.ts` (znak salda dla nowych rodzajów, czyszczenie). W Chrome: cztery rodzaje w wyborze, „Pożyczyłem od 120” daje sumę „My jesteśmy winni” 120,00 zł, saldo ujemne i „Oddałem całość”. Vitest 1427/1427.
- **Commit:** dada7f1, 2026-10-19.

## Przypomnienia — jedno odpalenie zaległej serii (krok 1 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** seria przypomnień (codziennie, co tydzień, co miesiąc), która minęła o kilka cykli (np. aplikacja była zamknięta), odpala się RAZ. Dymek lub powiadomienie pokazuje „pominięto N”, a termin przesuwa się na najbliższy przyszły. Wcześniej każdy zaległy cykl dawał osobny dymek i powiadomienie.
- **Gdzie jest:** `src/lib/reminderDue.ts` (`planDueReminders` — czysta funkcja: co odpalić, z liczbą pominiętych wystąpień), `src/hooks/useReminderNotifications.ts` (wykonuje efekty: dymki, powiadomienia, przesunięcie serii).
- **Jak działa:** funkcja dostaje notatki, rejestr „już odpalone” i mapę `handled` (id → termin już obsłużony). Termin obsłużony nie odpala się drugi raz, dopóki zapis przesunięcia nie dotrze do listy notatek. Wpis `handled` znika, gdy termin się zmieni albo notatka zniknie. Jednorazowe przypomnienia działają jak dotąd.
- **Decyzja:** przyjęto zalecaną wersję („jeden dymek, pominięto N”). Pytanie 3 z planu nie zostało jeszcze potwierdzone przez właściciela.
- **Ograniczenia:** zabezpieczenie 1000 wystąpień wstecz. Przy absurdalnie starym terminie pominięte są najwyżej tysiąc cykli.
- **Testy:** `src/lib/reminderDue.test.ts` (10: na czas, zaległa seria 5 dni, koniec serii, miesiąc z 31., rejestr, `handled`, brak terminu). E2E `reminder-toast`, `reminders-calendar`: 16/16. Vitest 1437/1437. Typecheck czysty.
- **Commit:** 0d6e497, 2026-10-19.

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

## Kalendarz — znaczniki Pracy w komórkach (K2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w siatce miesiąca dzień z wizytą serwisową albo dostawą ma małą ikonę kasku z liczbą (np. „2”). Po najechaniu i w czytniku ekranu: „Praca: 2 wizyty, 1 dostawa”. Tylko odczyt, bez edycji.
- **Gdzie jest:** `src/lib/study/calendarMarks.ts` (`studyDayMarks`, typ `StudyDayMarks`), `src/components/calendar/useStudyDayMarks.ts` (hook: czeka na `studyReady`, potem liczy), `src/components/calendar/ReminderCalendarView.tsx` (`studyOf` do siatki), `src/components/calendar/MonthGrid.tsx` (prop `studyOf`), `src/components/calendar/DayCell.tsx` (ikona i `studySummary` w `aria-label`).
- **Jak działa:** wizyta to otwarte zgłoszenie serwisowe z terminem (`due`, dzień `yyyy-MM-dd`), dostawa to pozycja „zamówione” z `due` (T4). Klucz dnia to ta sama postać co w `dueDayValue`. Budowy w archiwum pomijane, tak jak w przypomnieniach.
- **Ograniczenie:** znaczniki są tylko w siatce miesiąca; widok tygodnia (`WeekStrip`) i „najbliższe dni” (`UpcomingDays`) ich nie pokazują. Dane Praca ładują się leniwie, więc do gotowości dokumentu kalendarz pokazuje brak znaczników i przelicza się po wczytaniu.
- **Paczka:** kalendarz jest już leniwy; `useStudyDayMarks` wciąga `store.ts` Pracy do paczki kalendarza, a nie do startowej. Próg paczki startowej 388 KB (od 2026-10-19) (`e2e/bundle.spec.ts`).
- **Testy:** `src/lib/study/calendarMarks.test.ts` (liczenie po dniach, otwarte/zamknięte, dostawa po dacie, archiwum). E2E `reminders-calendar`, `reminders-agenda`, `reminder-toast` 17/17 po wszystkich krokach.
- **Commit:** 42e1c83, 2026-10-19.

## Praca — próba przed zakryciem z etapów karty (U1 planu Pracy, 2026-10-19)

- **Co robi:** gdy na karcie budowy odhaczono etap instalacji (kanalizacja podposadzkowa, rozprowadzenie wody, piony), a nie ma odhaczonej próby szczelności ani protokołu w dzienniku, i nie odhaczono zakrycia — pojawia się przypomnienie „Próba przed zakryciem”. Widać je w Dzienniku (lista przypomnień, przycisk „Karta budowy”) i jako wiersz na Dziś w dziale Praca.
- **Gdzie jest:** `src/lib/study/reminders.ts` (typ `StudyReminder` kind `pre-cover-test`, stałe `INSTALL_STAGE_IDS`, `TEST_STAGE_ID`, `COVER_STAGE_ID`, pętla po kartach), `src/lib/study/dueRows.ts` (wiersz kind `test`), `src/components/study/StudyJournal.tsx` (`ReminderRow`).
- **Jak działa:** warunek to instalacja odhaczona AND NOT(próba odhaczona) AND NOT(zakrycie odhaczone) AND NOT(dziennik ma wpis o montażu lub próbie dla tej budowy). Ostatni warunek wyłącza duplikat z „no-test”, który wisi już z wpisów dziennika. Budowy w archiwum pomijane. Przypomnienie znika samo, gdy odhaczysz próbę lub zakrycie, albo gdy dopiszesz protokół w dzienniku.
- **Decyzje:** identyfikatory etapów z `DEFAULT_STAGES` (`stages.ts`), stałe trzymane w `reminders.ts`, żeby nie wprowadzać cyklu importów. Przypomnienie nie idzie do push: to ostrzeżenie na czas budowy, a nie termin, więc zostaje w aplikacji (Dziś i Dziennik).
- **Ograniczenie:** etap „Próba szczelności” jest tylko odhaczeniem; nie zastępuje protokołu z wynikiem (ciśnienie, czas, spadek). Nazwy etapów własnych nie są rozpoznawane, tylko identyfikatory domyślne.
- **Testy:** `src/lib/study/reminders.test.ts` (grupa „próba przed zakryciem z etapów karty (U1)”: bez zakrycia, odhaczone zakrycie/próba, archiwum, duplikat z „no-test”, protokół w dzienniku), `src/lib/study/dueRows.test.ts` (wiersz na Dziś). Vitest `src/lib/study` 287/287, tsc czysty.
- **Commit:** 7fd412a, 2026-10-19.

## Przypomnienia — cały dzień (P6 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w wyborze przypomnienia na notatce jest pole „Cały dzień (o 9:00)”. Zamiast godziny zapisuje się 9:00 wybranego dnia, a na kaflu i w Terminach widać samą datę („dziś”, „jutro”, „25 paź”).
- **Gdzie jest:** `src/lib/reminderSpec.ts` (`reminderAllDay` w `ReminderState`, `REMINDER_FIELDS`, `specOf`, `readSpec`), `src/lib/yjsStore.ts` (zapis w `reminderSpec` przy tworzeniu i przy zmianie, projekcja), `src/components/ReminderPicker.tsx` (pole wyboru, `ReminderBadge`), `src/lib/reminderTime.ts` (`formatReminderShort(ts, now, allDay)`, `dayInputValue`, wspólne z `shortages.ts`), `src/components/NoteCardActions.tsx` (przekazanie flagi do `onUpdate`), `src/lib/mergeNotes.ts`, `src/lib/noteSchema.ts`, `src/hooks/useNotes.ts` (typ `Note.reminderAllDay`).
- **Jak działa:** flaga siedzi w `reminderSpec` razem z terminem, więc konflikt dwóch urządzeń rozstrzyga cała całość, jak przy C3. Flaga zapisuje się tylko gdy `true`; zwykły termin jej nie ma. Odpalanie nie zmieniło się: przypomnienie idzie o zapisanej godzinie (9:00), w aplikacji i w push. Zmiana na zwykły termin przez `reminderAllDay: undefined` gasi flagę.
- **Decyzje:** „cały dzień” to 9:00, a nie północ, bo północ dzwoniłaby w nocy. Zaległość liczy się od 9:00, więc termin „cały dzień” na dziś staje się zaległy o 9:00 i wpada do „Zaległe”/„Przegapione” jak każdy inny. Wybór dnia, który już minął (9:00 dziś przeszło), jest blokowany tym samym komunikatem co przeszła godzina.
- **Ograniczenie:** kompozytor nowej notatki (`AddNoteBar`) nie ma pola „Cały dzień” — tam termin nadal wymaga godziny. Do dodania osobno wraz z szkicem (`Draft`), bo tam jest osobny stan i zapis szkicu.
- **Testy:** `src/lib/reminderSpec.test.ts` (grupa „reminderAllDay”), `src/lib/reminderTime.test.ts` (`formatReminderShort` z flagą), `src/lib/yjsStore.reminder.test.ts` (flaga przez dwa dokumenty Yjs, włącz i wyłącz). Vitest 1482/1482, tsc i eslint czyste. E2E nie uruchomione (pamięć).
- **Commit:** a235912, 2026-10-19.

## Praca — data dostawy zamówienia (T4 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** przy braku „zamówione” pojawia się pole daty dostawy. Zaległe zamówienie dzwoni dopiero po końcu dnia dostawy, a nie po trzech dniach od zamówienia. Bez daty działa dawna reguła. Linia do wysłania (`shortagesText`) pokazuje „dostawa dd.mm”.
- **Gdzie jest:** `src/lib/study/shortages.ts` (pole `Shortage.due`, `setShortageDue`, `orderLateFrom`, `dueDayValue`, `dueFromDayValue`, `ORDER_LATE_DAYS`), `src/lib/study/reminders.ts` (przypomnienie „zamówione, a nie dojechało”), `src/lib/push/schedule.ts` (ten sam próg dla push), `src/components/study/SiteShortagesPanel.tsx` (pole `type="date"` przy zamówionym).
- **Jak działa:** `orderLateFrom` jest jedynym źródłem progu i dla przypomnienia w aplikacji, i dla push. Z `due`: koniec dnia dostawy (`endOfDay` z `dueTerms`). Bez `due`: `changed ?? at` + 3 dni. Klucz powiadomienia push to `due`, gdy jest, więc zmiana daty wysyła nowe powiadomienie. Czyszczenie pola ustawia brak daty.
- **Model danych:** `due` to opcjonalne pole w pozycji listy braków (ms, północ lokalna). Zapisuje się w tym samym kluczu co reszta pozycji, więc konflikt dwóch telefonów rozstrzyga cała lista, jak dotąd. Stare dane bez `due` działają bez zmian; `cleanShortages` odrzuca `NaN`.
- **Ograniczenie:** `setShortageDue` nie ustawia daty dla pozycji spoza „zamówione” (zmiana statusu na inny nie czyści `due`, ale jest ignorowane, dopóki pozycja nie wróci do „zamówione”).
- **Testy:** `src/lib/study/shortages.test.ts` (grupa „data dostawy braku”), `src/lib/study/reminders.test.ts` (zaległe po końcu dnia dostawy). Vitest: `src/lib/study` i `src/lib/push` 300/300, `tsc` i eslint czyste.
- **Commit:** 668c7ba, 2026-10-19.

## Terminy — prognoza serii w „Najbliższe 7 dni” (T2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w widoku Terminy, pod grupami, jest blok „Prognoza serii (najbliższe 7 dni)” — jeden wiersz na powtarzalne przypomnienie z liczbą jego kolejnych wystąpień w tym tygodniu, np. „+4 wystąpienia (prognoza)”. Wiersze są tylko do odczytu.
- **Gdzie jest:** `src/lib/reminderForecast.ts` (`weekSeriesForecasts`, typ `SeriesForecast`), `src/components/calendar/SeriesForecastSection.tsx` (sekcja, ładowana leniwie z `Index.tsx`), `src/components/calendar/SeriesForecastRows.tsx` (`SeriesForecastRows`), `src/pages/Index.tsx` (`SeriesForecastSection` po grupach w widoku `reminders`).
- **Jak działa:** zapisany jest tylko najbliższy termin, więc kolejne wystąpienia liczy `expandOccurrences` (`src/lib/reminderOccurrences.ts`) w oknie od końca dziś +1 ms do końca dnia +7 — ten sam przedział co grupa „Najbliższe 7 dni”. Liczone są wyłącznie wystąpienia z `isSeries && !isNext`, czyli te, których nie ma w danych. Kosz jest pomijany, archiwum nie. Kolejność wierszy: wg pierwszego wystąpienia w oknie.
- **Paczka:** pierwsza wersja trzymała `weekSeriesForecasts` w `reminderAgenda.ts`, co wciągało rozwijanie wystąpień do paczki startowej (przekroczenie budżetu o ok. 0,6 KB). Przeniesione do `reminderForecast.ts`, a sekcja jest leniwa.
- **Decyzja:** blok stoi pod grupami, a nie w grupie „Najbliższe 7 dni”. Seria zaległa (zapisany termin w „Zaległe”), która ma wystąpienia w tym tygodniu, nie trafia do żadnej grupy „Najbliższe 7 dni”, więc wiersz w grupie by zniknął, gdyby tej grupy nie było.
- **Ograniczenie:** `now` w memo to czas ostatniego przeliczenia (zależności: widok i lista notatek); otwarty widok przez północ może pokazać prognozę o dzień starą, do najbliższej zmiany listy. Prognoza nie ma akcji (edycja tylko dla zapisanego terminu).
- **Testy:** `src/lib/reminderAgenda.test.ts` (`weekSeriesForecasts`: zaległa seria 7 wystąpień, seria od jutra 6, jednorazowe pominięte, seria poza oknem i kosz). Vitest 1489/1489 po wszystkich krokach.
- **Commit:** 392f197, 2026-10-19.

## Przypomnienia — cały termin w jednym zapisie `reminderSpec` (C3 planu kalendarza/przypomnień, 2026-10-19)

- **Problem:** termin, powtarzanie, dzień serii i koniec były czterema osobnymi polami Yjs, z osobnym rozstrzyganiem konfliktów. Dwa urządzenia zmieniające ten sam termin naraz mogły zostawić niezgodną mieszankę (np. nowy termin ze starym dniem serii).
- **Rozwiązanie:** całe przypomnienie jest zapisane jako jedna wartość `reminderSpec` w Y.Map notatki. Konflikt wygrywa w całości. Starsze pola (`reminder`, `reminderRepeat`, `reminderDay`, `reminderRepeatUntil`) są nadal zapisywane tą samą wartością, żeby starsze odczyty działały.
- **Odczyt:** najpierw `reminderSpec`; gdy go nie ma (notatki sprzed zmiany), stare pola. Nic nie trzeba migrować w dokumencie.
- **Gdzie jest:** `src/lib/reminderSpec.ts` (`specOf`, `mergeSpec`, `readSpec`, `projectReminder`), `src/lib/yjsStore.ts` (`readReminderState`, zapis w `applyPatch` i przy tworzeniu notatki, projekcja w `plainFromYNote`).
- **Ograniczenie:** notatki zapisane przez starszą wersję aplikacji nie mają `reminderSpec`, dopóki nie zostaną zmienione — wtedy czyta się je ze starych pól, co jest poprawne, ale konflikt całości obejmuje dopiero zmienione notatki.
- **Testy:** `src/lib/reminderSpec.test.ts` (8), `src/lib/yjsStore.reminder.test.ts` (dwa urządzenia, równoległa zmiana terminu i powtarzania daje jedną całość). E2E `reminders-calendar`, `reminder-toast`, `reminders-agenda`, `notes`: 22/22. Vitest 1466+. Budżet bundla: w progu 387 KB.
- **Commit:** 831ab76, 2026-10-19.

## Kopia zapasowa — pliki budów osobno od zdjęć dziennika (D3, 2026-10-19)

- **Co robi:** raport kopii rozdziela pominięte bajty na trzy kategorie: załączniki notatek, zdjęcia dziennika i pliki budów (plany, PDF). Toast po zapisie kopii podaje każdą kategorię osobno. Plan nie jest już nazywany zdjęciem dziennika.
- **Gdzie:** `src/lib/study/journalRefs.ts` (`siteDocRefsIn`), `src/lib/exportNotes.ts` (`collectAttachmentBlobs`, `describeSkippedAttachments`, pole `siteDocs` w `BackupAttachmentReport`, opcja `attachmentBudget` w `buildFullBackupWithReport`).
- **Jak działa:** `collectAttachmentBlobs` bierze budżet z opcji (domyślnie `BACKUP_ATTACHMENTS_BUDGET_BYTES`, 40 MB). Każdy pominięty bajt z dziennika albo z kart budów liczy się w swojej kategorii; klucze dokumentów budów wyznacza `siteDocRefsIn` z `studySiteItems`.
- **Okno przywracania:** liczby pominięte przy eksporcie zapisują się w pliku jako `skipped` (`BackupSkipped` w `src/lib/noteSchema.ts`, pole opcjonalne, bez treści; zawsze cztery liczby, zera, gdy nic nie pominięto — dzięki temu w `exportNotes.ts` nie ma gałęzi, a paczka startowa mieści się w budżecie 388 KB). Okno „Przywrócić ten backup?” pokazuje je jako zdanie `describeBackupSkipped` (`src/lib/backupSkipped.ts`, moduł tylko dla okna Ustawień, żeby nie wchodził do paczki startowej) nad listą sekcji (`data-testid=restore-skipped`), żeby było widać, czego w pliku nie ma. Starsze pliki bez pola: brak zdania.
- **Ograniczenie:** `skipped` to liczby z chwili eksportu. Przywrócenie nie odzyskuje pominiętych zdjęć — tylko je nazywa.
- **Testy:** `src/lib/fullBackup.test.ts` — przekroczenie budżetu (`attachmentBudget: 0`) rozdziela załącznik, zdjęcie dziennika i plan oraz składa komunikat; bez przekroczenia plan wchodzi do kopii i nie jest raportowany. Vitest 1469/1469, typecheck czysty.
- **Commit:** 6a97a92 (kod), testy budżetu — w commicie z tym wpisem, 2026-10-19; okno przywracania z `skipped` — 5fa3fbd, 2026-10-19.

## Kalendarz — widok dnia z osią godzin (K1 planu kalendarza/przypomnień, 2026-10-19)

- **Poprawka typu (2026-10-19, 0236f73):** `src/components/calendar/DayPanel.tsx` — usunięty zbędny prop `type="single"` z `ToggleGroup`; wrapper z `src/components/ui/toggle-group.tsx` ustawia go sam. Błąd `tsc` zgłaszany od 5aa530e znika (`npx tsc -p tsconfig.app.json --noEmit` czysty).

- **Co robi:** w panelu wybranego dnia przełącznik „Lista | Oś godzin”. Lista zostaje domyślna. Oś to wiersze po godzinach z napisem `07:00`; zmiana z Grafiku jest paskiem w lewej kolumnie (przerwa jaśniejsza), a każdy termin stoi w swojej godzinie z dokładnym czasem i pełnym tytułem. Terminy „cały dzień” są nad osią, bez godziny.
- **Gdzie jest:** `src/lib/dayTimeline.ts` (czysta logika: `shiftPieces`, `timelineHours`, `hourBackground`, `minutesOfDay`), `src/components/calendar/DayTimeline.tsx` (widok osi, `TimelineItem`), `src/components/calendar/DayPanel.tsx` (przełącznik `ToggleGroup`, stan `view`, warunkowe renderowanie), `src/lib/reminderOccurrences.ts` (pole `Occurrence.allDay` z `note.reminderAllDay`).
- **Jak działa:** zakres osi to co najmniej 7–21, a rozszerza się, gdy zmiana albo termin wychodzi poza ten przedział (w granicach doby). Pasek zmiany to gradient CSS w każdym wierszu: każdy wiersz dostaje tylko swój fragment (np. zmiana od 14:30 daje połowę wiersza 14:00). Dzięki temu wiersz może rosnąć od wielu terminów bez przesunięć paska. Klik w termin otwiera edycję, Shift+←/→ przesuwa o dzień, prognoza serii otwiera najbliższy zapisany termin — tak jak w liście.
- **Decyzje:** oś ma sens tylko dla zmiany, bo ma godziny; przypomnienie zostaje punktem, a nie blokiem (stary komentarz w `DayPanel` o braku osi został zastąpiony). Lista zostaje domyślna, bo tam są eksport `.ics` i opisy prognoz. Przerwa i pasek korzystają z `shiftSpan`/`breakOffset` z `lib/shifts/time.ts`, więc są spójne z eksportem i sumą godzin. Urlop nie ma paska.
- **Ograniczenie:** zmiana przez północ rysuje się tylko do 24:00 (część po północy nie wchodzi na oś tego dnia). Przerwa bez godziny (`breakAt`) nie ma miejsca na osi — zmiana rysuje się jako jeden odcinek. Oś nie pokazuje minut na skali (wiersz to godzina, a dokładny czas jest w tekście terminu). Kompozytor nowej notatki nie zmienia się.
- **Testy:** `src/lib/dayTimeline.test.ts` (odcinki zmiany, przerwa, urlop, zakres osi, gradient w godzinie, minuty), `src/lib/reminderOccurrences.test.ts` (grupa „cały dzień”: flaga w wystąpieniach jednorazowych i serii). E2E `e2e/day-timeline.spec.ts`: termin ląduje w wierszu 23:00 na osi, lista jest domyślna; 360 px bez poziomego przewijania (zrzut sprawdzony).
- **Commit:** w commicie z tym wpisem, 2026-10-19.

## Kalendarz — skróty w oknie terminu (K3 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** Ctrl+Enter (na Macu ⌘+Enter) z dowolnego pola okna „Nowy termin” (także z godziny i powtarzania) tworzy notatkę z terminem, a w edycji zapisuje termin — to samo co przycisk. Zwykły Enter w polu tekstu działa jak dotąd. Przycisk ma `aria-keyshortcuts`.
- **Gdzie jest:** `src/components/calendar/ReminderQuickAddDialog.tsx` (`handleShortcut` na `ResponsiveDialogContent`, `onKeyDown`).
- **Jak działa:** skrót nie zapisuje, gdy godzina jest niepoprawna (`timestamp === null`), a przy dodawaniu wymaga tytułu. Przyjmuje się zdarzenie z całego okna, więc działa z fokusem w każdym polu.
- **Testy:** `e2e/reminders-calendar.spec.ts` („Ctrl+Enter z pola godziny tworzy notatkę z terminem (K3)”) — sprawdza, że okno się zamyka i dzień ma jeden termin. Uruchomiony: przechodzi.
- **Nie zrobione z K3:** podpowiedzi skrótów widoczne w interfejsie (tylko `aria-keyshortcuts` i zachowanie).
- **Commit:** 19f2ade, 2026-10-19.

## Praca — porządki po planie (L1, L2, L6, T4, T6, T2 częściowo, C4 — 2026-10-19)

- **Co robi:** bez zmiany zachowania dla użytkownika, poza licznikiem „Na dziś” na karcie Dziś (L2 — teraz z tą samą projekcją co Praca). Wpisy zapisywane, z kopii i z projekcji są czyszczone jedną funkcją.
- **Gdzie jest:**
  - `src/lib/study/yStudy.ts` — `cleanEntryParts(e)` (L1): tekst, odhaczenia (tylko id, bez materiału), zdjęcia, próba, kształtki, etap, lokalizacja i flaga `empty`; `cleanEntry` (kopia, drugi telefon) korzysta z niej.
  - `src/lib/study/store.ts` — `sanitizeStudy` (projekcja) i `entryFields` (zapis z arkusza) też korzystają z `cleanEntryParts`. Różnice, które zostają świadomie: projekcja filtruje odhaczenia po materiale już *po* sprawdzeniu pustości (D1), zapis filtruje je *przed* sprawdzeniem.
  - `src/lib/study/srs.ts` — `dueIds(reviews, today)`: usunięty nieużywany parametr `known` (L6).
  - `src/components/review/TodayStudyCard.tsx` — `dueToday(useStudy())` zamiast `dueIds` na surowej kopii (L2).
  - `src/lib/study/store.ts` — JSDoc `saveBoss` wrócił nad swoją funkcją (L6, wcześniej wisiał nad `addCustomEntry`); `handover.ts` wskazuje `HandoverPaper.tsx` (L6).
  - `docs/GOTCHAS.md` — wpis o strefie czasowej (C4): termin to chwila, nie godzina ścienna.
- **Jak działa i dlaczego:** L2 — karta Dziś ładuje `store.ts`, który ciągnie `content.ts` (22 KB materiału). Karta jest leniwa, więc materiał trafia do jej fragmentu, nie do startowego. Zrobione tak, bo zgodność liczby z Pracą jest ważniejsza niż ten kawałek bajtów; pilnuje tego budżet wejściowego JS w `e2e/bundle.spec.ts` — uruchomiony po buildzie, 6/6 zielone.
- **Testy:**
  - `src/lib/study/yStudy.test.ts` — migracja dawnego zapisu zachowuje zdjęcia i są widoczne dla odśmiecania (T4).
  - `src/lib/study/study.test.ts`, `src/lib/study/customStore.test.ts` — zegar zamrożony w `freshStudy` (`vi.setSystemTime`), bo `recordRound` i `addJournalEntry` brały dzień z prawdziwego zegara (T6). `TodayDueList.test.tsx` i `StudyDueRows.test.tsx` już miały zamrożony `Date`.
  - `src/lib/study/srs.test.ts` — po usunięciu parametru `known` został test samego sortowania.
  - T2 — testy komponentów działu Praca: `SiteOrderPanel.test.tsx` (WhatsApp), `SiteShortagesPanel.test.tsx` (dopisanie, status, data dostawy, usuwanie z „Cofnij”, czyszczenie), `SiteStagesPanel.test.tsx` (domyślne etapy, odhaczenie z datą, postęp, własny etap), `SiteDocsPanel.test.tsx` (miniatury i PDF-y, „Otwórz”, usuwanie, podgląd 100%), `DayHoursDialog.test.tsx` (zapis godzin, błędny format, reszta dnia, ostrzeżenie o nadmiarze). Biblioteka i store zamockowane, bez zależności od prawdziwego zegara. Dochodzą: `SiteServicePanel.test.tsx` (zgłoszenia z terminem, zaległe i dziś, zamknięcie z opisem, „Cofnij”, gwarancja, załatwione i „Otwórz ponownie”), `CalculatorsSheet.test.tsx` (spadek w obu trybach z podpowiedzią, próba wodna, pojemność z kolejnym odcinkiem i „Inna rura”), `JournalEntrySheet.test.tsx` (rodzaj w szkicu, pusty wpis, zapis z tekstem, edycja, „Usuń” z „Cofnij”; store zapisu zamockowany, szkic i stan arkusza prawdziwe).
- **Nie zrobione (z planu Pracy):** brak — T2 zamknięte, wszystkie komponenty działu mają test.
  - T5 — `report-nudge.spec.ts` nie ma już `waitForTimeout` (usunięty wcześniej); `journal-geo.spec.ts` celowo akceptuje dwa komunikaty (zależne od przeglądarki); `today-study.spec.ts` przechodzi, a wynik nie zależy od odpowiedzi (wszystkie 10 pytań wraca następnego dnia). Bez zmian.
  - U8 — decyzja właściciela: nagranie jako osobny załącznik. Zrobione w kolejnej sesji (bez commita) — patrz „Praca — nagranie głosowe w wpisie (U8)”.
  - D5 — decyzja właściciela: zostaje obecny model wpisu (jeden klucz Y.Map), bez przebudowy.
  - P3 — decyzja: odłożenie dotyczy tylko jednego wystąpienia. Nie zrobione: dziś „Odłóż” z powiadomienia zapisuje nowy `reminder` notatki, czyli przesuwa kotwicę całej serii. Zrobione w kolejnej sesji (2026-10-19, bez commita) — patrz „Przypomnienia — odłożenie jednego wystąpienia serii”.
- **Commit:** 19f2ade, 2026-10-19; testy T2 w 4fdd64f, 2026-10-19.

## Przypomnienia — odłożenie jednego wystąpienia serii (P3, 2026-10-19, 3c07051)

- **Co robi:** „Odłóż” (10 minut, jutro o 9:00), także z powiadomienia systemowego i push, działa dla przypomnień cyklicznych. Odkłada tylko to jedno wystąpienie: kolejne są jak wcześniej, od swojego terminu, a nie od chwili odłożenia. Dotąd „Odłóż” było ukryte dla serii, a z powiadomienia przesuwało całą serię.
- **Gdzie jest:**
  - `src/lib/reminderSpec.ts` — pole `reminderBase` (termin serii, który zastępuje odłożona chwila w `reminder`). `mergeSpec`: zapis `reminder` bez jawnego `reminderBase` go czyści, więc zwykła zmiana terminu nie zostawia starego odłożenia.
  - `src/lib/reminderRepeat.ts` — `nextOccurrence(note, at)`: następne wystąpienie serii; gdy `at` to odłożone wystąpienie, liczy od `reminderBase`. `snoozeTarget(note, at, now)`: zapis po odłożeniu.
  - `src/hooks/useReminderNotifications.ts` — `applyActionRef` (akcja z SW i z kolejki przy starcie) i przyciski dymku zapisują przez `snoozeTarget`; `onReminderFired` dostaje czwarty argument `reminderBase`.
  - `src/components/ReminderDueToast.tsx` — usunięty prop `canSnooze`; „Odłóż” zawsze w dymku.
  - `src/pages/Index.tsx` — callbacki przekazują `reminderBase` do `updateNote`; `onSetReminder` kalendarza też.
  - Liczenie serii, które zmieniły się na `nextOccurrence`: `src/lib/reminderDue.ts` (planer odpaleń), `src/lib/reminderOccurrences.ts` (kalendarz i Dziś), `src/lib/push/schedule.ts` (harmonogram push), `src/components/calendar/ReminderCalendarView.tsx` („Pomiń” wystąpienie).
  - Przepływ danych: `src/hooks/useNotes.ts` (typ `Note.reminderBase`), `src/lib/noteSchema.ts`, `src/lib/mergeNotes.ts` (scalanie kopii), `src/lib/yjsStore.ts` (zapis i projekcja `reminderSpec`).
  - `push-server/core.js` — tylko komentarz: przycisk „Odłóż” dla serii też.
- **Jak działa i dlaczego:**
  - Odłożenie zapisuje `reminder` = odłożona chwila i `reminderBase` = termin serii, który ona zastępuje. Dzięki temu kolejne wystąpienia nie przesuwają się — wszystkie czytniki `nextOccurrence` liczą od bazy.
  - Odłożona chwila zawsze wypada przed następnym terminem serii (`snoozeTarget` zastępuje ją zwykłym terminem, gdyby wypadała później). Dzięki temu nie ma dwóch przypomnień w kolejności odwrotnej ani podwójnego odpalenia.
  - Zaległości: po nieobecności aplikacji `snoozeTarget` przesuwa bazę na ostatnie wystąpienie, które już minęło (`now`), więc odłożenie nie wraca od razu.
  - Dlaczego pole w spec, a nie osobna struktura: całe przypomnienie idzie jednym zapisem `reminderSpec` (LWW), więc konflikt dwóch urządzeń nie może zostawić mieszanki bazy i terminu.
- **Ograniczenia i pułapki:**
  - „Gotowe” w serii przechodzi do następnego wystąpienia (`doneTarget` w `reminderRepeat.ts`); koniec serii zapisuje `reminder = null`. Zaległe wystąpienia są pomijane. Decyzja właściciela 2026-10-19.
  - Stare notatki bez `reminderBase` działają jak dotąd.
  - Przesunięcie serii w kalendarzu (przeciągnięcie, „Termin zapisany”) czyści odłożenie: to nowy termin serii.
- **Testy:**
  - `src/lib/reminderRepeat.test.ts` — `nextOccurrence` (bez i z bazą, tygodniowa, jednorazowa) i `snoozeTarget` (jednorazowa, przed kolejnym terminem, po nim, zaległe, seria zakończona).
  - `src/lib/reminderSpec.test.ts` — zapis i odczyt bazy, czyszczenie przy nowym terminie, jawne `undefined`.
  - `src/lib/reminderDue.test.ts` — odłożone wystąpienie odpala się raz, następne od terminu serii.
  - `src/lib/yjsStore.reminder.test.ts` — baza wraca po synchronizacji i gaśnie przy zwykłym terminie.
  - Istniejące testy (`reminderOccurrences`, `push/*`, `ReminderDueToast`) przechodzą bez zmian.
  - e2e nie uruchomiono (pamięć); na telefonie nie sprawdzono.
- **Nie zrobione / do potwierdzenia:**
  - Decyzja właściciela (2026-10-19): „Gotowe” w serii przechodzi do następnego wystąpienia — wdrożone (`markDone` w `useReminderNotifications.ts`, `doneTarget` w `reminderRepeat.ts`, testy w `reminderRepeat.test.ts`).
  - Brak e2e dla odłożenia serii i testu na telefonie.
- **Commit:** 3c07051, 2026-10-19.

## Praca — nagranie głosowe w wpisie (U8, 2026-10-19, 5581ece)

- **Co robi:** we wpisie z budowy można nagrać głos przyciskiem „Nagraj” (do 3 min, do 3 nagrań w wpisie). Nagranie to osobny załącznik audio — pod zdjęciami na liście, z odtwarzaczem i „Usuń”. Samo nagranie wystarcza, by zapisać wpis. Działa w nowym wpisie i w edycji.
- **Gdzie jest:**
  - `src/lib/study/yStudy.ts` — pole `JournalEntry.recordings?: Attachment[]`, stała `JOURNAL_MAX_RECORDINGS = 3`, `cleanRecordings` (tylko manifesty audio z kluczem 64-znakowym w `imageStore`), `cleanEntryParts` i `cleanEntry` (nagranie czyni wpis niepustym).
  - `src/lib/study/store.ts` — `NewJournalEntry.recordings`, `entryFields` (zapis), `sanitizeStudy` (projekcja).
  - `src/lib/study/draft.ts` — `JournalDraft.recordings` (szkic zostaje po zamknięciu arkusza, czyści się po zapisie), `sanitizeDraft` (starszy szkic → `[]`).
  - `src/lib/study/entrySheet.ts` — `openJournalEdit` przepisuje nagrania do formularza edycji.
  - `src/lib/study/recordings.ts` — `addRecording(file, current)`: limit 3 w wpisie, `addAttachmentFiles` (limity, hash, dedup, quota jak w notatkach), `used` liczy załączniki notatek i nagrania wszystkich wpisów.
  - `src/lib/study/journalRefs.ts` — `journalRefsIn` zbiera klucze nagrań; w trybie sync tylko do 2 MB (jak dokumenty budów).
  - `src/components/study/JournalEntrySheet.tsx` — przycisk „Nagraj”, lista nagrań z `AudioPreview` i „Usuń nagranie”, `addRecordingFile`. `VoiceRecorder` i `AudioPreview` są leniwe (`VoiceAttachmentParts.tsx`), więc startowa paczka nie rośnie.
- **Jak działa i dlaczego:**
  - Nagranie to załącznik audio, nie zdjęcie: osobna lista `recordings`, bo raport i kopia opisują zdjęcia jako obrazy. Bajty trzymają się tego samego magazynu co załączniki notatek (`imageStore`), więc odśmiecanie, kopia (`exportNotes` / backup v3 przez `journalImageRefs`) i przywracanie (`putDataUrl`, bez filtra na `image/`) działają bez nowych ścieżek.
  - Wpis to jeden klucz w mapie Yjs (LWW na cały wpis), więc nagrania jadą z wpisem; nie ma nowego modelu synchronizacji.
  - Sync do innego urządzenia: nagrania do 2 MB; większe zostają lokalnie — tak jak załączniki notatek i dokumenty budów.
- **Ograniczenia i pułapki:**
  - Raport kopii (`exportNotes`) liczy pominięte nagrania osobno (`recordings`, z `recordingRefsIn` w `journalRefs.ts`), nie jako zdjęcia. Starsze kopie bez tego pola działają jak dotąd (pole opcjonalne w `noteSchema.ts`).
  - Limit łączny 100 MB liczy wszystkie załączniki w aplikacji (`used`). Nagranie usunięte z wpisu zostaje w magazynie do odśmiecania (po karencji).
  - Przeglądarki nagrywają w `audio/webm`, `audio/ogg` albo `audio/mp4`; `cleanRecordings` odrzuca każdy inny typ.
  - Dyktowanie (`useDictation`) i nagrywanie są niezależne — nagranie nie jest transkrybowane i nie trafia do raportu.
- **Testy:**
  - `src/lib/study/recordings.test.ts` — `cleanRecordings` (typy, klucze, rozmiary, limit), wpis z samym nagraniem, `journalRefsIn` (także tryb sync do 2 MB), limit w `addRecording`.
  - `e2e/bundle.spec.ts` — budżet startowej paczki zielony po dodaniu nagrań.
  - Nagrywania w przeglądarce (mikrofon) nie testowano e2e — brak fake mikrofonu w zestawie; wymaga ręcznego sprawdzenia na telefonie.
- **Commit:** 5581ece, 2026-10-19; poprawka raportu kopii f6867bd, 2026-10-19.

## Ustawienia — dopracowanie, faza 1 (2026-10-19, cb2ecff)

- **Co robi:** okno Ustawienia (cztery karty: Wygląd, Ogólne, Dane, Sync) jest bardziej bezpieczne i dostępne. Reset „Przywróć domyślne” w Wyglądzie i „Zapomnij i zacznij od nowa” w Sync pytają najpierw o potwierdzenie. Reset nadal kasuje cały widok (decyzja właściciela), a potwierdzenie wymienia, co wróci do domyślnych, i czego reset nie dotyczy. Przełączniki mają nazwę dla czytników ekranu. Opis okna nie obiecuje już, że wszystko działa tylko w tej przeglądarce.
- **Gdzie jest:**
  - `src/components/SettingsDialog.tsx` — opis okna; szkielet zamiast pustego ekranu przy ładowaniu karty Sync.
  - `src/components/settings/AppearanceSettings.tsx` — reset z `AlertDialog` (`resetOpen`), treść potwierdzenia.
  - `src/components/SyncSettings.tsx` — „Zapomnij” z `AlertDialog` (`forgetOpen`); nazwa dla przełącznika synchronizacji i przycisku kopiowania kodu.
  - `src/components/settings/SettingsShared.tsx` — `ToggleRow` łączy etykietę z przełącznikiem (`useId` + `aria-labelledby`); tytuł sekcji to `h3`.
  - `src/components/settings/GeneralSettings.tsx` — kolory: `aria-label` po polsku (`COLOR_LABEL`) i `aria-pressed`; suwak autosave ma nazwę; przycisk „Test” na dotyku 44 px.
  - `src/components/settings/BackupSettings.tsx` — nazwy suwaków kopii i przypomnień, pól godziny i dnia; linki „wyczyść”/„wyłącz” na dotyku 44 px.
  - `src/components/ui/switch.tsx`, `tabs.tsx`, `slider.tsx` — cele dotyku 44 px na dotyku (przełącznik przez pseudo-element, bez zmiany wyglądu); `Slider` przekazuje `aria-label` do kciuka.
  - `src/lib/viewPrefs.ts`, `effectsSettings.ts`, `confirmPrefs.ts` — `merge` wraca do domyślnych, gdy zapis nie jest obiektem (np. uszkodzony JSON).
- **Jak działa i dlaczego:**
  - Uszkodzony zapis: `persistedStore` przy błędnym JSON przekazuje surowy tekst do `merge`. Wcześniej `{...defaults, ...stored}` rozsypywało znaki tekstu w klucze „0”, „1”… w stanie. Teraz domyślne wartości wracają w całości. Domyślne wartości przeżywały wcześniej, więc to nie była utrata danych.
  - Reset zostaje pełny (decyzja „Wszystko”): potwierdzenie jest tekstem listy, żeby było widać, co dokładnie zniknie.
- **Ograniczenia i pułapki:**
  - Cele dotyku dla przełącznika są powiększone pseudo-elementem tylko na dotyku; wizualnie przełącznik się nie zmienił.
  - Nazwy kolorów są po polsku w kodzie (`COLOR_LABEL`); dodanie koloru wymaga wpisu.
  - Nie sprawdzono QA na telefonie (zakładki, dotyk, klawiatura) — zgodnie z decyzją, później.
- **Testy:**
  - `src/lib/settingsPrefs.test.ts` — uszkodzony JSON i tekst zamiast obiektu w `viewPrefs`, częściowy zapis, reset, `confirmPrefs` (domyślne, uszkodzony JSON, zapis jednego klucza), `normalizePushServer` (ukośnik, http dla zdalnego hosta, localhost, pusty tekst).
  - E2e (chromium, 106 testów): `mobile`, `skins`, `clipper`, `push`, `diagnostics`, `sync-code`, `search-backup`, `private-notes`, `shifts`, `a11y`, `toggle-group`, `site-mode`, `card-motion` — zielone.
- **Commit:** cb2ecff, 2026-10-19.

## Ustawienia — struktura, faza 2 (2026-10-19, 430379d)

- **Co robi:** cztery karty zostają, ale rozłożone inaczej. Karta „Dane” nazywa się „Kopia i dane”. Przypomnienia „Dziś” i „Ten tydzień” są w Ogólne, obok przeglądu tygodnia. Synchronizacja przez plik jest w karcie Sync, obok parowania. Efekty i zabawa są w Wyglądzie. Ogólne ma sekcję „Praca i Grafik” z przyciskiem „Ustawienia Grafiku”. Przypomnienie o kopii zostaje w karcie Kopii.
- **Gdzie jest:**
  - `src/components/SettingsDialog.tsx` — nazwa karty „Kopia i dane” (zakładki na wiele wierszy, `h-auto`); `SyncFileSection` w karcie Sync; usunięta niekontrolowana gałąź `trigger`, prop `open`/`onOpenChange` wymagane.
  - `src/components/settings/GeneralSettings.tsx` — przypomnienia „Dziś”/„Ten tydzień” po `<ReviewSettings />`; `WorkSettingsLink` (sekcja „Praca i Grafik”, otwiera `ShiftSettingsDialog`); efekty usunięte stąd.
  - `src/components/settings/EffectsSettings.tsx` (nowy) — sekcja „Efekty i zabawa” i `previewEffect`, przeniesione z Ogólne.
  - `src/components/settings/AppearanceSettings.tsx` — renderuje `EffectsSettings` przed resetem.
  - `src/components/settings/SyncFileSection.tsx` (nowy) — „Synchronizacja przez plik” i jej obsługa (`exportSyncNow`, `mergeSyncNow`, `newNotesLabel`), przeniesione z `BackupSettings.tsx`.
  - `src/components/settings/BackupSettings.tsx` — bez sekcji przypomnień Dziś/Ten tydzień i bez synchronizacji pliku; używa `LAST_AUTO_EXPORT_KEY`.
  - `src/lib/backupReminder.ts` — `LAST_AUTO_EXPORT_KEY`, jedna stała dla klucza ostatniej kopii.
  - `src/lib/viewPrefs.ts` — domyślny `weekReminderDay` to 0 (niedziela), tak jak dzień przeglądu tygodnia.
- **Jak działa i dlaczego:**
  - Przypomnienia „Dziś”/„Ten tydzień” to ustawienia powiadomień, nie kopii, więc są razem z przeglądem tygodnia. Przypomnienie o kopii zostaje w Kopii, bo mierzy czas od ostatniego backupu.
  - Synchronizacja przez plik jest w karcie Sync, bo to też synchronizacja między urządzeniami.
  - Efekty przeniesione do Wyglądu zamiast trzeciej karty: pięć kart na telefonie nie mieści się w jednym wierszu.
  - Domyślny dzień przypomnienia ustawiono na niedzielę, bo przegląd tygodnia ma niedzielę. To zmienia tylko nowe ustawienia; zapisane dni zostają.
- **Ograniczenia i pułapki:**
  - Istniejące kopie i zapisane ustawienia nie zmieniają się. Zmienia się tylko domyślny dzień, gdy użytkownik nigdy nie ustawił godziny.
  - E2e szukające karty „Dane” — `mobile.spec.ts` używa teraz „Kopia i dane”; testy synchronizacji pliku (`file-sync`, `live-text`, `live-text-focused`, `images`) otwierają kartę Sync.
  - Nie zrobiono fazy 3 (reset per sekcja, linki `?settings=`). Wyszukiwanie ustawień odrzucone decyzją właściciela.
  - QA na telefonie nie sprawdzono (zgodnie z decyzją, później). Szczególnie: zakładka „Kopia i dane” zawija się na wąskim ekranie.
- **Testy:**
  - `src/lib/settingsPrefs.test.ts` — domyślny dzień tygodnia to 0.
  - Pełny e2e chromium: 386/386 zielone.
- **Commit:** 430379d, 2026-10-19.

## Ustawienia — reset per sekcja i linki, faza 3 (2026-10-19, 842db18)

- **Co robi:**
  - Reset per sekcja: w Ogólne (edytor, przypomnienia) i w Kopii jest przycisk „Przywróć domyślne w tej sekcji”. Wyłącza się, gdy nic w sekcji nie różni się od domyślnych. Potwierdzenie wymienia tylko ustawienia, które faktycznie się zmienią, np. „Zmienią się: autosave”.
  - Globalny reset w Wyglądzie też wymienia zmiany zamiast ogólnego opisu.
  - Link `?settings=wyglad|ogolne|kopia|sync` otwiera Ustawienia na tej karcie. Parametr znika z adresu. Nieznana wartość nie otwiera okna.
- **Gdzie jest:**
  - `src/lib/viewPrefs.ts` — `VIEW_PREF_GROUPS` (grupy kluczy, rozłączne), `VIEW_PREF_LABELS` (nazwy po polsku), `changedViewPrefs(keys)` (co różni się od domyślnych), `resetViewPrefKeys(keys)` (reset tylko podanych kluczy).
  - `src/components/settings/SettingsShared.tsx` — `ResetSectionButton({ title, keys })`: przycisk i potwierdzenie.
  - `src/components/settings/GeneralSettings.tsx` — przyciski „edytor” (po autosave) i „przypomnienia” (po Ten tydzień).
  - `src/components/settings/BackupSettings.tsx` — przycisk „kopia”, przed wskazówką.
  - `src/components/settings/AppearanceSettings.tsx` — globalny reset z listą zmian.
  - `src/lib/settingsDeepLink.ts` — `SETTINGS_PARAM`, `SETTINGS_TABS` (polskie nazwy → karty), `settingsTabFromParam`.
  - `src/components/SettingsDialog.tsx` — efekt czytający `?settings=` (obok `?pair=`).
  - `src/pages/Index.tsx` — stan początkowy `settingsOpen` otwiera okno dla poprawnego `?settings=`.
- **Jak działa i dlaczego:**
  - Grupy są rozłączne i testowane — każdy klucz ma dokładnie jeden reset per sekcja.
  - Wygląd nie ma resetu per sekcja: jego globalny reset już wymienia zmiany, więc drugi przycisk byłby zbędny. Sortowanie i filtry są tylko w globalnym resecie, bo ustawia je arkusz widoku.
  - Lista zmian liczona z aktualnego stanu, przy każdym renderze — potwierdzenie nigdy nie pokazuje zmian, których już nie ma.
  - Nazwy w linkach po polsku, ale bez znaków spoza ASCII, żeby dały się wkleić w wiadomości.
- **Ograniczenia i pułapki:**
  - Reset per sekcja nie obejmuje ustawień poza `viewPrefs` (efekty, potwierdzenia, sejf, push, skórka).
  - Link działa przy otwieraniu aplikacji i przy zmianie adresu w otwartym oknie. Nie zmienia otwartej już aplikacji, jeśli adres zmieni się bez przeładowania.
  - Wyszukiwanie ustawień nie jest zrobione (decyzja właściciela).
- **Testy:**
  - `src/lib/settingsPrefs.test.ts` — `changedViewPrefs`, `resetViewPrefKeys` (tylko podane klucze), rozłączność grup i etykiety.
  - `src/lib/settingsDeepLink.test.ts` — mapowanie nazw, nieznane i puste wartości, nazwy z prototypu.
  - `e2e/settings-links.spec.ts` — `?settings=kopia` otwiera kartę i czyści adres; nieznana karta nie otwiera okna; reset w sekcji zmienia tylko edytor (auto-backup zostaje).
- **Commit:** 842db18 (2026-10-20)

## Synchronizacja — urządzenia w grupie i nazwy, faza 4 planu synchronizacji (2026-10-20, 842db18)

- **Co robi:**
  - Karta „Urządzenia w grupie” w Ustawieniach → Synchronizacja: lista innych urządzeń połączonych teraz (nazwy), pole „Nazwa tego urządzenia” (domyślnie „Telefon” albo „Komputer” wg przeglądarki).
  - Po połączeniu nowego urządzenia pojawia się toast „Połączono z: [nazwa]”.
  - Sekcja kodu nazywa się „Dodaj urządzenie” (QR i kod, bez zmian w działaniu).
  - „Zapomnij i zacznij od nowa” zmienione na „Odłącz to urządzenie”, z potwierdzeniem, które mówi, że pozostałe urządzenia zostają w grupie.
  - Serwery sygnalizacyjne nazwane „Serwery łączące urządzenia”; diagnoza bez słowa „sygnalizacja”.
- **Gdzie jest:**
  - `src/lib/yjsSync.ts` — `SyncDevice`, `SyncState.devices`, `getDeviceName` / `setDeviceName` / `defaultDeviceName` (klucz `kaczy.sync.deviceName`), `refreshDevices` (awareness pierwszego pokoju v2), wpięcie w `connect()` i `disconnectProvider()`.
  - `src/components/SyncSettings.tsx` — lista urządzeń, formularz nazwy, nowe napisy przycisku i potwierdzenia.
- **Jak działa i dlaczego:**
  - Nazwa idzie przez awareness y-webrtc (`setLocalStateField("device", …)`), więc nie zmienia protokołu ani danych w Yjs. Każde urządzenie ma własne `clientID`, a lista pomija własne.
  - „Odłącz” działa tylko lokalnie: wspólny kod nie daje sposobu, by z zewnątrz wyrzucić jedno urządzenie. Stąd rozdzielenie na „to urządzenie” i listę pozostałych.
- **Ograniczenia i pułapki:**
  - Lista pokazuje tylko urządzenia w pokoju v2. Przy włączonej zgodności ze starą wersją urządzenie widoczne tylko w starym pokoju się nie pojawi (każdy provider ma własne `clientID`).
  - „Ostatnia synchronizacja” per urządzenie nie istnieje — awareness jej nie niesie. Zostaje globalna z kafla diagnozy.
  - Komunikat o zmianie z konkretnym tytułem notatki (punkt 3 planu) **nie zrobiony**: wymaga porównania dokumentu przed i po zmianie.
  - Ten kod wchodzi do bundla eager (`yjsSync` jest importowany przez `NotesProvider`): ok. +700 B gzip, co przekracza próg `bundle.spec.ts`. Patrz decyzja w planie synchronizacji.
- **Testy:**
  - `src/lib/yjsSync.test.ts` — blok „urządzenia w grupie (faza 4)”: nazwa domyślna i zapamiętana, przycinanie, pusta nazwa, lista bez siebie i czyszczenie przy odłączeniu. `MockProvider` ma teraz `awareness`.
  - `e2e/sync-code.spec.ts` przechodzi bez zmian.

## Kalendarz — fazy 1 i 2 planu (2026-10-20, 518871f)

- **Co robi:**
  - W edycji terminu pole „Dzień” przenosi termin na inny dzień (telefon nie przeciąga chipów). Działa też dla serii: przesuwa całą serię.
  - Pominięcie ostatniego terminu serii pokazuje „Seria zakończona”, nie zwykłe „Wystąpienie pominięte”.
  - Cofnięcie (Cofnij) przywraca też odłożenie (`reminderBase`) — przed zmianą zapamiętywane przez `previousOf`.
  - Dzień z Pracy (wizyty i dostawy) widać w panelu dnia, nie tylko w komórce.
  - Etykieta edycji podaje godzinę i powtarzanie; prognoza serii to pusty krąg, zapisany termin pełny kropka (różnica kształtem).
  - „Dziś” widać także w bieżącym miesiącu, gdy wybrany dzień to nie dziś.
  - Pominięcie wystąpienia serii z wiersza panelu dnia (bez otwierania dialogu).
  - Po przesunięciu, pominięciu i usunięciu fokus wraca na komórkę dnia.
  - Wybór listy/osi godzin zapamiętany w `kaczy.calendar.dayView`.
  - Zmiana czasu: godzina z przeskoku wiosennego (np. 02:30) jest odrzucana i pokazany jest komunikat; przeniesienie na taki dzień nie przesuwa po cichu.
  - ICS: `UNTIL` ma ten sam typ co `DTSTART` (lokalny, bez „Z”), zgodnie z RFC 5545.
  - Seria zapisana dawno temu (>400 kroków wstecz) nadal pokazuje bieżący miesiąc.
- **Gdzie jest:**
  - `src/components/calendar/ReminderQuickAddDialog.tsx` — pole „Dzień” (tylko w edycji), komunikat o nieistniejącej godzinie.
  - `src/components/calendar/ReminderCalendarView.tsx` — `handleSkip` (komunikat końca serii), `previousOf` w cofnięciach, `moveToDay` (odmowa przy nieistniejącej godzinie), `focusDay`, przycisk „Dziś”, `studyMarks` do `DayPanel`.
  - `src/components/calendar/DayPanel.tsx` — linia Pracy, przycisk pominięcia, `readDayView` / `writeDayView`, etykieta edycji.
  - `src/components/calendar/DayCell.tsx` — `data-day-key`, kształt kropki.
  - `src/lib/study/calendarMarks.ts` — `studySummary` (przeniesione z `DayCell`).
  - `src/lib/reminderTime.ts` — `composeReminderTimestamp` zwraca `null` dla godzin nieistniejących.
  - `src/lib/icsExport.ts` — `eventLines`, `UNTIL` przez `formatLocal`.
  - `src/lib/reminderOccurrences.ts` — `expandOccurrences` przewija do `rangeStart` (`MAX_SKIP_STEPS`); `isNext` tylko dla zapisanego terminu.
  - `src/pages/Index.tsx` — kalendarz dostaje `reminderNotes` (wcześniej nowa tablica przy każdym renderze).
- **Ograniczenia i pułapki:**
  - Nie zrobione z fazy 1: pole całodniowe w dialogu, odwołanie `formatUtc` z `DTSTART` (już nie dotyczy).
  - Nie zrobione z fazy 2: całodniowe w dialogu (2d, wymaga przekazania `allDay` przez `onCreateNote`), scalenie duplikatów (2f), widok tygodnia (3a), druk (3b), historia serii (3c — decyzja właściciela).
  - Szerokość komórki siatki na 320 px to ok. 42 px, poniżej 44 px; wysokość 56 px jest ok. Pełne 44 px wymaga zmiany układu.
- **Testy:**
  - `src/lib/reminderTime.test.ts` — blok „zmiana czasu (Europe/Warsaw)”.
  - `src/lib/icsExport.test.ts` — „RRULE dostaje UNTIL tego samego typu co DTSTART”.
  - `src/lib/reminderOccurrences.test.ts` — „seria zapisana dawno temu”, `isNext` tylko dla zapisanego terminu.
  - `e2e/calendar-phase1.spec.ts` — pole „Dzień” w edycji przenosi termin.

## Przypomnienia — faza 1 planu (2026-10-20, 0ae3808)

- **Co robi:**
  - Grupy w widoku Terminy mają nagłówki `<h2>` (nawigacja po nagłówkach).
  - Przyciski „Gotowe” i „Jutro” na zaległym terminie mają cel dotyku 44 px na dotyku.
  - Zaległy termin ma dla czytnika ekranu prefiks „Zaległe:”.
  - Nowy chip „+1 h” obok „Jutro” (odłożenie o godzinę, `snoozeTimes().inHour`).
  - Pusty stan („Brak przypomnień”) nie pokazuje się, gdy w Terminach są wiersze z archiwum.
  - Obrys fokusu z klawiatury zostaje także na dotyku (usunięte blanket `outline: none !important`).
- **Gdzie jest:**
  - `src/components/NoteGroupSection.tsx` — nagłówek grupy.
  - `src/components/NoteCardBody.tsx` — przyciski „Gotowe”, „Jutro”, „+1 h”.
  - `src/components/ReminderPicker.tsx` — `ReminderBadge` z prefiksem `sr-only`.
  - `src/pages/Index.tsx` — `reminderRowCount` w warunku pustego stanu.
  - `src/lib/reminderAgenda.ts` — `snoozeTimes` zwraca `inHour`.
  - `src/hooks/useOverdueBadge.ts` — poprawiony komentarz (archiwum liczy się).
  - `src/index.css` — usunięta reguła zdejmująca obrys na dotyku.
- **Ograniczenia i pułapki:**
  - Wiersze „Gotowe” dla nadchodzących (D2) są w fazach 2–3 niżej. Odznaka terminu ma 12 px, a „Zaległe” przełącza się bez odświeżania listy (`useReminderPassed`) — patrz „Przypomnienia — dokończenie fazy 1”.
  - Usunięcie blanket obrysu jest zmianą wyglądu na dotyku — do sprawdzenia na telefonie.
- **Testy:**
  - `src/lib/reminderAgenda.test.ts` — „pusta lista” i „odłożenie o godzinę”.
  - e2e: pełny przebieg chromium 389/389 przy progu bundla 390 KB.

## Przypomnienia — fazy 2–3 planu wg decyzji D1–D4 (2026-10-20, ebe2567)

- **Co robi:**
  - „Gotowe” przy każdym terminie w widoku Terminy, nie tylko zaległym (D2). Poza Terminami przycisk działa jak dotąd, tylko dla zaległych.
  - „Gotowe” na serii kończy bieżące wystąpienie i przechodzi do następnego, jak powiadomienie (D3). Koniec serii albo zwykły termin zdejmuje przypomnienie. Cofnij przywraca termin, dzień serii i odłożenie.
  - „Jutro rano” i „+1 h” nie przepisują dnia serii (2b). Wcześniej `updateNote` wyprowadzał `reminderDay` z nowej godziny.
  - Po „Gotowe”, „Jutro” i „+1 h” fokus przechodzi na sąsiedni kafel w grupie, a gdy go nie ma — na nagłówek grupy (2c).
  - Archiwum ma osobną sekcję „W archiwum” na dole Terminów, z wyszukiwaniem, i nie wchodzi do grup „Zaległe”/„Nadchodzące” ani do licznika (D4).
  - Licznik zaległych na pasku bocznym i w tytule karty liczy też terminy Pracy, czyli tę samą listę co Terminy (D1).
- **Gdzie jest:**
  - `src/hooks/NoteViewActionsContext.tsx` — pole `reminderActions`; `src/components/NoteGrid.tsx` i `src/components/NoteCard.tsx` — przekazanie do kafla.
  - `src/components/NoteCardBody.tsx` — przyciski terminu, `focusAfterRemoval`, `doneTarget` / `seriesDay` z `reminderRepeat.ts`.
  - `src/pages/Index.tsx` — `reminderGroups`, `archivedRows`, `reminderRowCount`, sekcja „W archiwum”, `useOverdueBadge(notes, useStudyOverdueCount())`, montowanie `StudyOverdueSync`.
  - `src/hooks/useOverdueBadge.ts` — drugi argument `extra` (zaległości spoza notatek) w tym samym liczniku co tytuł i ikona.
  - `src/lib/studyOverdueCount.ts` — mały store (`setStudyOverdueCount`, `useStudyOverdueCount`), bez danych Pracy.
  - `src/components/review/StudyOverdueSync.tsx` — leniwy komponent bez wyglądu, który liczy `studyDueRows` i podaje liczbę do store.
- **Ograniczenia i pułapki:**
  - Liczba z Pracy zawiera też serwis przypadający dziś — tak jak lista Terminów. Licznik nie jest więc „po terminie” w sensie ścisłym.
  - `StudyOverdueSync` montuje się zawsze, więc dane Pracy ładują się przy starcie (leniwy chunk, ale nie tylko na widoku Pracy).
  - Liczba z Pracy jest liczona przy renderze; zmiana doby bez zmiany dziennika odświeża ją dopiero po zmianie danych.
  - Fokus po akcji wybiera pierwszy przycisk sąsiedniego kafla, a nie zawsze „Gotowe”.
  - Porządki (3b): jedna definicja końca dnia (`endOfDay(date)` w `reminderRepeat.ts`); funkcja z `dueTerms.ts` przemianowana na `endOfDayOffset(t, plusDays)`. Jedno sortowanie agendy (`byReminderAsc`) dla listy Terminów i grup.
- **Testy:**
  - `src/hooks/useOverdueBadge.test.ts` — „adds terminy Pracy do tytułu i ikony”.
  - `e2e/reminders-phase2.spec.ts` — „Gotowe” przy nadchodzącym terminie zdejmuje go z Terminów.
  - e2e pełny przebieg chromium: 391/391 (Commit: ebe2567).

## Przypomnienia — dokończenie fazy 1 planu (2026-10-20, 018d791)

- **Co robi:**
  - Pusty widok Terminy ma przycisk „Nowa notatka”, który otwiera edytor (1d). Pokazuje się tylko w Terminach, gdy nie ma żadnego wiersza.
  - Odznaka terminu na kaflu ma 12 px zamiast 11 px (15).
  - Kafel przełącza się na „Gotowe” i „Zaległe” w chwili, gdy termin minie, nawet gdy lista notatek się nie zmienia (14). Dawniej warunek liczył się tylko przy renderze.
  - Ogłoszenie po odhaczeniu (17) nie wymagało zmian: toasty sonnera mają `aria-live="polite"`.
- **Gdzie jest:**
  - `src/hooks/useReminderPassed.ts` — `useReminderPassed(at)`: boolean, który przełącza się przez `setTimeout` co najwyżej do terminu (dłuższe terminy w kilku krokach, bo `setTimeout` ma limit ok. 24,8 dnia).
  - `src/components/NoteCardBody.tsx` — warunek przycisków terminu korzysta z `useReminderPassed`.
  - `src/components/ReminderPicker.tsx` — `ReminderBadge` używa tego samego hooka do koloru i prefiksu „Zaległe:”.
  - `src/components/EmptyState.tsx` — prop `onNew` i przycisk „Nowa notatka”; `src/pages/Index.tsx` podaje `onNew={() => expandAddNote()}`.
- **Ograniczenia i pułapki:**
  - Każda odznaka z przyszłym terminem ma jeden `setTimeout`. Odznaki bez terminu nie mają timera.
  - Przycisk „Nowa notatka” otwiera zwykły kompozytor, nie kompozytor z terminem. Termin dodaje się w kompozytorze albo w widoku Kalendarza.
  - Odznaka 12 px zwiększa wysokość kafla, jeśli ma zawijać się w wąskim kaflu — do sprawdzenia na telefonie.
- **Testy:**
  - `src/hooks/useReminderPassed.test.ts` — przełączenie co do milisekundy, termin już minął, termin dalej niż limit `setTimeout`, zmiana terminu.
  - `e2e/reminders-phase2.spec.ts` — „pusty widok Terminów: „Nowa notatka” otwiera edytor”.
  - e2e: 30 testów związanych z przypomnieniami i kaflami na chromium przechodzi; pełny przebieg nie był uruchamiany w tej sesji.

## Kalendarz — fazy 2d, 2f, 3a, 3b planu (2026-10-20, 11ef99f)

- **Co robi:**
  - Dialog terminu ma „Cały dzień”: godziny nie widać, termin stoi na 9:00. Flaga `reminderAllDay` idzie przy tworzeniu, edycji, przeciąganiu i cofnięciu (2d).
  - Na telefonie przełącznik „Miesiąc / Tydzień”: tydzień pokazuje pasek 7 dni (`WeekStrip`) zamiast siatki. Na większym ekranie bez zmian (3a).
  - Przycisk „Drukuj” w nagłówku: drukuje listę terminów bieżącego miesiąca, dzień po dniu, z oznaczeniem prognozy serii (3b).
  - Duplikat `endOfDay` w `dueTerms.ts` używa wspólnej funkcji z `reminderRepeat.ts` (2f, część — odznaka zmiany i etykiety „Bez tytułu” zostają).
- **Gdzie jest:**
  - `src/components/calendar/ReminderQuickAddDialog.tsx` — `allDay` w stanie, checkbox „Cały dzień”, `DEFAULT_REMINDER_TIME` zamiast godziny.
  - `src/components/calendar/ReminderCalendarView.tsx` — `onSetReminder` ma szósty argument `reminderAllDay`; `previousOf` zapamiętuje `allDay`; przełącznik `phoneView`; przycisk „Drukuj” i `PrintRoot`.
  - `src/components/calendar/CalendarPrintList.tsx` — lista wydruku (`report-paper`, `PrintRoot`).
  - `src/pages/Index.tsx` — `onCreateNote` i `onSetReminder` przekazują `reminderAllDay`.
  - `src/lib/dueTerms.ts` — `endOfDay` nakładka na `endOfDay` z `reminderRepeat.ts`.
- **Ograniczenia i pułapki:**
  - Tydzień na telefonie jest przełącznikiem, nie stałym widokiem; wybór nie jest zapamiętywany między wejściami.
  - Wydruk pokazuje tylko terminy kalendarza (nie Pracę), a na papierze prognozy są oznaczone tekstem.
  - Nie zrobione: 3c (historia serii) — decyzja właściciela z planu, bez zmiany.
- **Testy:**
  - `src/components/calendar/CalendarPrintList.test.tsx` — wydruk: godzina, „cały dzień”, prognoza, pusty miesiąc.
  - `e2e/calendar-phase2.spec.ts` — „Cały dzień” bez godziny; przełącznik Miesiąc / Tydzień na 375 px.

## Synchronizacja — toast z tytułem notatki, punkt 3 planu (2026-10-20, 89f1546)

- **Co robi:** po zmianie z innego urządzenia toast mówi, która notatka się zmieniła („Zaktualizowano: …”). Notatki prywatne i bez tytułu pokazują zwykły komunikat.
- **Gdzie jest:** `src/lib/yjsSync.ts` — `changedNoteTitle()` porównuje `updatedAt` notatek z poprzednim zdalnym zapisem (`remoteSeenUpdated`), wywoływane w handlerze `yjsStore.doc.on("update")`.
- **Ograniczenia i pułapki:** porównanie obejmuje też lokalne edycje od ostatniego zdalnego zapisu, więc przy kilku zmianach naraz tytuł może wskazać lokalną notatkę. Toast nadal co 30 s, tak jak wcześniej.
- **Testy:** e2e pełny przebieg 393/393. `src/lib/yjsSync.test.ts` przechodzi bez zmian (25/25). Sam toast nie ma testu jednostkowego; do sprawdzenia na dwóch urządzeniach.

## Ćwiczenia — odżywki: lista, dzienne odhaczenia, przypomnienie (plan Ćwiczeń, krok 1, 2026-10-20)

- **Co robi.** Osobna pozycja „Ćwiczenia” w menu, na pasku dolnym (w „Więcej”), w palecie poleceń i w pasku bocznym.
  Dział ma kartę „Odżywki”: lista pogrupowana rano / w ciągu dnia / wieczorem, każdą pozycję odhacza się na dziś
  (licznik „dziś N z M”). Pusta lista ma przycisk „Dodaj kreatynę (rano, 1 łyżka)”, który od razu tworzy przypomnienie
  o 7:30. Formularz: nazwa, dawka, pora, „Przypominaj codziennie o” z godziną (domyślnie 7:30 / 12:00 / 20:00 wg pory).
  Usunięcie z „Cofnij”, które przywraca odżywkę i jej przypomnienie z kosza.
- **Gdzie jest.**
  - `src/lib/supplements/model.ts` — typy `Supplement`, `SupplementWhen`, `cleanSupplement` (wejście z dokumentu, kopii i peera),
    `logKey` / `parseLogKey` (klucz odhaczenia `dzień|id`), `bySupplementOrder`, `nextReminderAt(hhmm, now)`.
  - `src/lib/supplements/ySupplements.ts` — `createYSupplements(doc)`: mapy Y `supplements` (id → odżywka) i `supplementLog`
    (`dzień|id` → true), origin `SUPPLEMENTS_ORIGIN`, `dump()` / `mergeDump()` do kopii.
  - `src/lib/supplements/store.ts` — hooki `useSupplements()`, `useSupplementsTaken()` i akcje `addSupplement`,
    `removeSupplement`, `restoreSupplement`, `setSupplementTaken`, `supplementDump`, `mergeSupplementDump`.
  - `src/components/cwiczenia/CwiczeniaView.tsx` — widok, `createSupplement` (dodaje odżywkę i notatkę-przypomnienie),
    `deleteSupplement`, `removeWithUndo`, `AddSupplementForm`.
  - Podłączenie działu: `src/hooks/useFilteredNotes.ts` (typ `View` i brak listy notatek), `src/hooks/useSelectionGestures.ts`,
    `src/lib/viewRoute.ts` (`/cwiczenia`), `src/components/sidebar/sidebarItems.ts`, `src/components/BottomNav.tsx`,
    `src/components/CommandPalette.tsx`, `src/components/AppHeader.tsx`, `src/components/EmptyState.tsx`, `src/pages/Index.tsx`
    (leniwy import i render w `ViewErrorBoundary`).
  - Kopia: `src/lib/noteSchema.ts` (pole `supplements`, zod), `src/lib/exportNotes.ts` (zapis w `buildFullBackupWithReport`,
    scalanie w `restoreFullBackup`, oba przez dynamiczny import, żeby nie dokładać do paczki startowej).
- **Jak działa i dlaczego.**
  - Dane są w tym samym dokumencie Yjs co notatki, więc działają synchronizacja między urządzeniami, kopia i plik.
    Każda odżywka i każde odhaczenie to osobny klucz mapy — dwa telefony dopisujące różne pozycje scalają się bez strat.
    Wzór jak w Długach (`src/lib/debts/yDebts.ts`).
  - Odhaczenie to wpis `dzień|id` w `supplementLog`. Odznaczenie kasuje wpis, a usunięcie odżywki kasuje wszystkie
    jej odhaczenia w tej samej transakcji (nie zostają osierocone).
  - Przypomnienie to zwykła notatka z `reminder` o najbliższej godzinie i `reminderRepeat: "daily"` — tym samym mechanizmem co
    Przypomnienia (powiadomienia, „Dziś”, serie). Id notatki zapisane w odżywce (`reminderNoteId`), żeby usunięcie
    odżywki mogło przenieść przypomnienie do kosza. Zapis odrzucony (np. pełna lista) sprząta świeżo utworzoną notatkę.
  - Zapis i odczyt przechodzą przez `cleanSupplement`: zła godzina albo id nie wejdą do dokumentu.
  - Kopia: przywracanie tylko **scala** (dodaje brakujące odżywki i odhaczenia, niczego nie kasuje). Odżywka dodana
    na telefonie po wykonaniu kopii zostaje po przywróceniu.
- **Ograniczenia i pułapki.**
  - Przypomnienie jest w dwóch miejscach: odżywka odhacza się w Ćwiczeniach, a przycisk „Gotowe” w Przypomnieniach
    przesuwa tylko serię tej notatki. Odhaczenie w Ćwiczeniach nie zamyka przypomnienia, i odwrotnie.
  - Odhaczenia nie są przywracane przez „Cofnij” przy usunięciu odżywki (świadomie: dzienny stan jest zbędny po usunięciu).
  - Notatka-przypomnienie jest zwykłą notatką: widać ją na liście notatek i w koszu. Nie ukrywamy jej, żeby nie
    dublować mechanizmu Przypomnień.
  - Trening i dieta jeszcze nie istnieją (kolejne kroki planu).
  - Kopia: sekcja `supplements` jest opcjonalna; plik sprzed tej zmiany przywraca się bez zmian.
- **Testy.**
  - `src/lib/supplements/model.test.ts` (czyszczenie, klucze, kolejność, przypomnienie i `nextReminderAt`).
  - `src/lib/supplements/ySupplements.test.ts` (dodawanie, duplikaty, odhaczenia, usuwanie z odhaczeniami, śmieci od peera, origin).
  - `src/components/cwiczenia/CwiczeniaView.test.tsx` (pusty stan, grupy i postęp, odhaczenie, formularz, przypomnienie
    i sprzątanie po odrzuconym zapisie). Magazyn i notatki podmienione atrapami.
  - `src/lib/fullBackup.test.ts` (odżywki w kopii, przywracanie scala bez kasowania).
  - `src/test/setup.ts` — stub `ResizeObserver` dla komponentów Radix (Checkbox), którego jsdom nie ma.
  - Vitest: 186 plików, 1663 testów zielone. E2E nie uruchamiano (zgodnie z ustaleniem: pełne e2e później).
- **Budżet paczki.** Wejściowy JS 390,1 KB gzip (było 390; nowe ikony w menu i kopia). Próg podniesiony do 392 KB
  w `e2e/bundle.spec.ts` z datowanym komentarzem.
- **Lint.** `eslint.config.js`: `src/lib/supplements/ySupplements.ts` i jego test na liście dozwolonych importów `yjs`,
  tak jak `yStudy.ts`. (`src/lib/debts/yDebts.ts` importuje `yjs` bez wpisu na liście — istniejące naruszenie, nie ruszane.)
- **Commit:** `cd83ffc` (2026-10-20, krok 1 planu Ćwiczeń: odżywki).

## Ćwiczenia — dieta: posiłki, kalorie i białko, cele dzienne (plan Ćwiczeń, krok 3, 2026-10-20)

- **Co robi.** Na stronie Ćwiczeń, pod odżywkami, karta „Dieta”:
  - **Dziś:** suma kcal i białka z dzisiejszych posiłków, z celem (jeśli ustawiony) i liczbą posiłków bez wartości.
  - **Lista posiłków dnia** wg godziny (bez godziny na końcu). Usuwanie z „Cofnij”.
  - **Dodawanie:** opis, godzina (domyślnie teraz), kalorie i białko (oba opcjonalne). Nie-liczba lub wartość poza zakresem
    blokuje przycisk i oznacza pole jako niepoprawne.
  - **Cele dzienne:** kcal i białko, puste = bez celu.
  - **Ostatnie 7 dni:** dzień (DD.MM), suma kcal i białka; dni bez posiłków to „—”.
- **Gdzie jest.**
  - `src/lib/diet/model.ts` — `Meal`, `DietGoals`, `cleanMeal`, `cleanGoals`, `cleanAmount`, `byMealOrder`, `summarizeDay`,
    `summarizeRange(meals, endDay, days, addDays)` (funkcja dat wstrzykiwana, żeby model był czysty).
  - `src/lib/diet/yDiet.ts` — `createYDiet(doc)`: mapa Y `dietMeals` (id → posiłek), `dietMeta` (`goals`), origin `DIET_ORIGIN`,
    `dump()` / `mergeDump()` do kopii.
  - `src/lib/diet/store.ts` — hooki `useMeals()`, `useDietGoals()` i akcje `addMeal`, `removeMeal`, `restoreMeal`,
    `setDietGoals`, `dietDump`, `mergeDietDump`.
  - `src/components/cwiczenia/DietSection.tsx` — sekcja (podsumowanie, lista, formularze, tydzień). Podpięta w
    `src/components/cwiczenia/CwiczeniaView.tsx`.
  - Kopia: `src/lib/noteSchema.ts` (pole `diet`), `src/lib/exportNotes.ts` (zapis w buildzie, scalanie w przywracaniu,
    dynamiczny import).
- **Jak działa i dlaczego.**
  - Ten sam wzorzec co odżywki: dane w dokumencie Yjs (synchronizacja, kopia, plik), jeden klucz na posiłek,
    więc dwa telefony dopisujące posiłki scalają się bez strat. Zapis przechodzi przez `cleanMeal`, odczyt też.
  - Sumy liczą tylko podane wartości; posiłek bez kalorii jest na liście i w liczniku posiłków, ale nie zaniża sumy
    (pokazujemy, ile takich jest, żeby sumę dało się ocenić).
  - Cele są jednym kluczem `goals` w osobnej mapie; zapis celów nadpisuje wartość na tym telefonie.
  - Dzień to lokalny `localDayKey()`; posiłki z przyszłych dni nie są ukrywane (wpis „wczoraj” jest możliwy tylko przez dzień,
    nie przez czas — dodawanie z innym dniem jest w modelu, ale formularz zawsze używa dziś).
- **Ograniczenia i pułapki.**
  - Brak bazy produktów i brak liczenia kalorii z gramatury — wartości wpisujesz ręcznie. Świadomie: bez zewnętrznych danych.
  - Limit opisu 200 znaków, kcal do 10 000, białko do 1 000 g na posiłek; wartości są zaokrąglane do całości.
  - Lista posiłków w dokumencie ma limit 5 000 wpisów.
  - Przywracanie kopii scala (dodaje brakujące posiłki, niczego nie kasuje). Cele z kopii trafiają tylko wtedy,
    gdy na telefonie celów nie ma.
  - Usunięty posiłek przywracany przez „Cofnij” zachowuje id i godzinę.
- **Testy.**
  - `src/lib/diet/model.test.ts` (czyszczenie, zakresy, kolejność, sumy dnia i zakresu).
  - `src/lib/diet/yDiet.test.ts` (dodawanie, duplikaty, usunięcie i cofnięcie, cele, origin, scalanie bez kasowania).
  - `src/components/cwiczenia/DietSection.test.tsx` (pusty dzień, sumy i brak kalorii, dodawanie, walidacja pola, cele).
  - `src/lib/fullBackup.test.ts` (posiłki i cele w kopii, przywracanie scala).
  - Vitest: 189 plików, 1683 testy zielone. E2E nie uruchamiano (pełne e2e później, zgodnie z ustaleniem).
- **Budżet paczki.** Wejściowy JS 390,3 KB gzip; próg 392 KB (ustawiony w kroku odżywek).
- **Lint.** `eslint.config.js`: `src/lib/diet/yDiet.ts` i jego test na liście dozwolonych importów `yjs`, jak odżywki.
- **Commit:** `ccce384` (2026-10-20, krok 3 planu Ćwiczeń: dieta).

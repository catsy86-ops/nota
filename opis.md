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
  goły `Trash` (paleta poleceń, lista widoków w `Index.tsx`), też są kreski — cała aplikacja ma jeden kosz.
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

**Ograniczenia i pułapki.**
- Bardzo małe puste miejsca zostają zwykłym tekstem: kolumna tablicy tematów (`StudyBoard`, cel upuszczania), „Brak
  terminów” w `DayPanel`/`UpcomingDays`, `CommandEmpty` w palecie, `LabelPicker`.
- Leniwie ładowane części poza widokami (np. `OnboardingTour`) nie mają własnej granicy błędu — bez sieci i bez
  service workera ich błąd pobrania przejmuje globalna granica w `App.tsx`. Na zainstalowanej aplikacji SW ma je w
  pamięci, więc dotyczy to głównie testów (SW zablokowany) i pierwszej wizyty.
- Nowy pusty stan: użyj `StatusPanel`, nie własnego `<p>` w przerywanej ramce.

**Testy.** `e2e/shifts.spec.ts` („awaria widoku Grafiku nie zabiera reszty aplikacji”, „bez internetu niepobrany
Grafik mówi, że czeka na sieć” — `role="status"`, bez `alert`), `e2e/search-backup.spec.ts` („Brak wyników w
Notatkach”), `e2e/study.spec.ts` (brak wyników filtra Dziennika), `e2e/a11y.spec.ts` (puste widoki w obu motywach).

**Commit.** `7c47e4b` (2026-10-15).

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

## Notatki — skróty z ikony aplikacji (PWA)

**Co robi.** Przytrzymanie ikony zainstalowanej aplikacji pokazuje skróty: Nowa notatka, Wpis z budowy, Grafik,
Szukaj, Nowa lista, Dziś, Przypomnienia. „Nowa lista” otwiera kompozytor od razu z listą do odhaczania, „Szukaj”
stawia kursor w polu wyszukiwania.

**Gdzie jest.** `public/manifest.webmanifest` (`shortcuts`), obsługa adresów w `src/pages/Index.tsx` (efekt przy starcie:
`?new=1`, `?new=list` → `expandAddNote("list")`, `?szukaj=1` → fokus na widocznym `input[type="search"]`); parametr
znika z adresu, więc odświeżenie nie powtarza akcji.

**Jak działa i dlaczego.** Kolejność skrótów jest celowa: Android pokazuje tylko kilka pierwszych (zwykle 4), więc na
początku to, co najczęściej robi się na budowie. Pole wyszukiwania szukane jako widoczne, bo telefon i komputer mają
osobne pola.

**Ograniczenia i pułapki.** Bez gestu użytkownika iOS nie otworzy klawiatury przy „Szukaj” (kursor jest, klawiatura po
stuknięciu w pole); Android otwiera. Udostępnianie plików i obrazów do aplikacji (Share Target z POST) — czeka na decyzję.

**Testy.** `src/lib/manifest.test.ts` (kolejność i adresy skrótów), `e2e/routes.spec.ts` („skróty PWA „Nowa lista”
i „Szukaj”…”, „skrót PWA /?new=1…”).

**Commit.** `c1a431f` (2026-10-15).

---

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
(`HardHat`): pasek boczny (`Index.tsx`), „Więcej” (`BottomNav.tsx`), paleta poleceń, nagłówek (`AppHeader.tsx`),
szkielet ładowania, kopia zapasowa („Praca i dziennik z budowy”), skrót PWA „Wpis z budowy” (`/praca?wpis=1`
w `public/manifest.webmanifest`). `src/lib/viewRoute.ts` mapuje `praca` i `nauka` na widok `study`; linki budują
`/praca`, stary adres dalej działa (zakładki, zainstalowana aplikacja ze starym manifestem). Kod, klucze zapisu
i typy zostają przy `study` — zmiana nazwy nie rusza danych. Notatki tworzone z tematów dalej mają tytuł
„Nauka: …” i etykietę `nauka` — to opis treści (temat do nauki), nie nazwa działu.
Testy: `src/lib/viewRoute.test.ts`, `e2e/study.spec.ts` („stary adres /nauka nadal otwiera dział Praca”).
Commit: `b610ff6` (2026-10-15).

### Pasek opanowania

**Co robi.** Pokazuje, ile z 18 tematów jest w kolumnie „Umiem”, z podziałem na moduły
(Woda użytkowa, Kanalizacja, Wspólne). Dotknięcie lub kliknięcie komórki podpisuje temat
i jego stan pod paskiem — na telefonie nie ma najechania kursorem.

**Gdzie jest.** `MasteryStrip` w `src/components/study/StudyView.tsx`; dane z `useStudy`,
`columnOf` (`store.ts`), `MODULES` i `TOPICS` (`content.ts`).

**Jak działa.** Odcinek modułu ma szerokość proporcjonalną do liczby tematów (`flexGrow`),
ale najmniej 4,5 rem, żeby zmieścił się podpis z licznikiem `x/n`. Komórka: pełna =
„Umiem”, połowa = „W trakcie”, pusta = „Do nauki”. Każda komórka to przycisk
(`aria-label` „Temat: stan”, `aria-pressed`) z wysokim celem dotyku przy cienkim pasku
(`-my-2 py-2`). Podpis pod paskiem ma `aria-live="polite"`. Wybór żyje tylko w stanie komponentu.
Licznik jest w JetBrains Mono (`font-mono tabular-nums`), bo w kroju nagłówków „1” wyglądała jak „l”.

**Testy.** e2e `e2e/study.spec.ts` („tablica: temat przechodzi między kolumnami…”: licznik
modułu i podpis po kliknięciu komórki), `e2e/resilience.spec.ts` (`mastery-count`).

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
- `src/lib/study/srs.ts`: `ReviewCard`, `reviewCard` (następny stan po odpowiedzi), `dueIds`, `cleanCard`.
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

## Praca → Dziennik budowy

Zakładka „Dziennik” na `/nauka` (`src/components/study/StudyJournal.tsx`). Dziennik instalatora
wod-kan: co zrobione, jakie problemy, zdjęcia, na której budowie — połączone z tematami
materiału do nauki.

### Model danych i synchronizacja

**Co robi.** Wpisy, karty budów i postęp Nauki synchronizują się między urządzeniami razem
z notatkami i trafiają do kopii zapasowej.

**Gdzie jest.**
- `src/lib/study/yStudy.ts` — `createYStudy(doc)`, typy `JournalEntry`, `StudyState`, `StudyDump`,
  czyszczenie wejścia `cleanEntry`, `cleanDump`, `dumpFromLegacy`, `stateFromDump`, `journalRefsIn`.
- `src/lib/study/data.ts` — jedyna instancja `yStudy` na `yjsStore.doc`, `studyDevice()`,
  migracja ze starego zapisu, `useStudyReady`.
- `src/lib/study/store.ts` — fasada dla widoków: `useStudy`, `getStudy`, `sanitizeStudy`
  (projekcja przefiltrowana przez materiał z `content.ts`) i akcje (`addJournalEntry`,
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
  `clearJournalDraft`, `setJournalDraftTopic`).
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
- `src/components/study/JournalReport.tsx` — `JournalReportDialog`, podgląd `ReportPaper`, wydruk `ReportPrint`.

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
- Wydruk: kontener `#report-print` i klasa `html.printing-report` (style w `index.css`).
  Podgląd w oknie ma ten sam układ co wydruk.

**Testy.** `src/lib/study/report.test.ts`, e2e „raport budowy z godzinami z Grafiku…” i „karta budowy…”.

**Commity.** D6 `d73d951`, adres i inwestor w raporcie D4b `e3096c4` (2026-10-15).

---

### Przypomnienia nad listą

**Co robi.** Nad listą wpisów Dziennika pojawia się pasek „Przypomnienia” (tylko gdy coś jest do zrobienia):
- **Problemy otwarte od ponad 3 dni** — „N problemów otwartych od ponad 3 dni”, przycisk „Pokaż otwarte” (filtr „Otwarte”).
- **Budowa z montażem bez protokołu próby** — „Budowa „X”: montaż bez protokołu próby. Zapisz próbę przed zakryciem.”,
  przycisk „Pokaż wpisy budowy” (filtr tej budowy).

Pasek znika sam, gdy warunek przestanie być prawdziwy (problem rozwiązany, protokół dopisany).

**Gdzie jest.** Reguła: `src/lib/study/reminders.ts` (`studyReminders(journal, now)`, stała `REMINDER_PROBLEM_DAYS = 3`,
typ `StudyReminder`). Pasek: `ReminderRow` w `src/components/study/StudyJournal.tsx` (`data-testid="journal-reminders"`).

**Jak działa.**
- Problem przypomina, gdy jest otwarty i `now − at > 3 dni` (od chwili wpisu problemu, nie od rozwiązania). Dokładnie 3 dni — jeszcze bez przypomnienia.
- „Montaż” budowy = wpis z kształtkami (`fittings`) albo wpis z tematu próby (`TEST_TOPICS`: `proba-wody`, `proba-kan`).
  Budowa z montażem, w której **żaden** wpis nie ma `test`, dostaje przypomnienie. Próba zapisana w innej budowie go nie zdejmuje.
- Wpisy bez budowy (`entrySiteId` = `""`) są pomijane. Nazwa budowy z najnowszego wpisu.
- Liczone w `useMemo` na zmianie dziennika — bez timera. Jeśli strona stoi otwarta, a problem przekroczy 3 dni bez zmiany
  dziennika, pasek pojawi się dopiero po następnym renderze (np. po przejściu zakładki).

**Ograniczenia i pułapki.** Heurystyka montażu jest przybliżona: wpis z tematu „Próba” bez protokołu też uruchamia przypomnienie.
Przypomnienie nie ma przycisku „Dodaj protokół” — arkusz wpisu nie przyjmuje z góry budowy, więc przycisk pokazuje wpisy budowy.
Pasek nie jest zapamiętywany (brak „ukryj”), bo znika sam.

**Testy.** `src/lib/study/reminders.test.ts` (7 testów). Pasek nie ma osobnego e2e; cały `e2e/study.spec.ts` (30/30, w tym telefony) przechodzi.

**Commit.** `d41bd89` (2026-10-16).

---

### Podpowiedzi tekstu z budowy

**Co robi.** Pusty nowy wpis na wybranej budowie pokazuje pod polem „Co się dzieje?” pigułki: „Jak wczoraj” (tekst najnowszego wpisu tej budowy z poprzedniego dnia kalendarzowego) i do 3 ostatnich różnych tekstów z tej budowy, od najnowszego. Stuknięcie wstawia tekst do pola. Znikają, gdy pole ma treść, i nie pojawiają się przy edycji wpisu.

**Gdzie jest.** Funkcje czyste: `src/lib/study/journalView.ts` (`recentSiteTexts(journal, siteId, limit = 3)`, `yesterdaySiteText(journal, siteId, now)`). UI: `src/components/study/JournalEntrySheet.tsx` (`siteId`, `textSuggestions`, `yesterdayText`; `data-testid="journal-text-suggestions"`).

**Jak działa i dlaczego.** Id budowy liczy się z nazwy w polu przez `findSiteByName(siteDirectory(...))`, więc porównanie idzie po tym samym `entrySiteId`, co oś czasu i raport (wpisy sprzed kart dopasowują się po nazwie). Pigułki są w `journal-text-suggestions` tylko przy pustym polu — nie zasłaniają pisania. Przycisk ma `onPointerDown` z `preventDefault`, żeby nie tracić fokusu z pola (jak pigułki budów). „Jak wczoraj” kopiuje tylko tekst, nie rodzaj ani temat — świadomie, żeby nie zgadywać, czy wczorajszy wpis był o tym samym temacie.

**Ograniczenia i pułapki.** Teksty są deduplikowane po przycięciu spacji (różnica wielkości liter zostaje jako osobna pozycja). Pigułki obcinają długi tekst jedną linią (`title` pokazuje całość). „Wczoraj” liczy się wg czasu lokalnego, nie 24 h wstecz. Podpowiedzi nie działają dla wpisu bez budowy.

**Testy.** `src/lib/study/journalView.test.ts` (7 testów: kolejność, limit, dedup, pusta budowa, wczoraj vs. dziś/przedwczoraj, obce budowy); `e2e/study.spec.ts` („pusty wpis na budowie podpowiada wcześniejsze teksty tej budowy”). Cały `study.spec.ts` 31/31 (w tym telefony).

**Commit.** `7fcff9a` (2026-10-16) — hash dopisany w następnym commicie.

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

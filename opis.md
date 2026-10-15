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

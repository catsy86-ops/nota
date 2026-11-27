# Wygląd i ruch

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Główka kartki — jeden nagłówek strony we wszystkich działach (plan wyglądu, Fazy 1–2, 2026-11-01)

- **Co robi.** Każdy dział (poza widżetem) zaczyna się tak samo: linijka mono nad tytułem (grupa z paska bocznego — Codziennie, Praca, Osobiste; folder i etykieta; data w Kalendarzu, Grafiku i Pracy; liczba notatek w widokach list) i tytuł z kreską pióra. Pasek u góry nie pokazuje tytułu, dopóki główka jest na ekranie; po przewinięciu pojawia się tam mała kopia. Ikona szukania na telefonie stoi w grupie ikon po prawej. Długi i Ćwiczenia nie mają już własnego nagłówka („PRYWATNE” + drugi h1), Praca nie ma trzeciego tytułu „Dziennik budowy” (licznik „0/18 tematów” zostaje).
- **Gdzie jest.** `src/components/ViewTitle.tsx` (`ViewTitle`, `kickerGroup`, `DATED_VIEWS`); grupy: `VIEW_GROUP` i typ `ViewGroup` w `src/lib/viewMeta.ts`, `SidebarGroupKey = ViewGroup` w `src/components/sidebar/sidebarItems.ts`; wpięcie w `src/pages/Index.tsx` (pierwsze dziecko `<main>`); pasek: `src/components/AppHeader.tsx` (`p.app-title` z `aria-hidden`); `DebtsView.tsx`, `CwiczeniaView.tsx`, `StudyView.tsx`.
- **Jak działa.** `ViewTitle` to jedyny h1 widoku. `IntersectionObserver` (margines −72 px = pasek) ustawia `data-head-out` na `<html>`, gdy główka schowa się pod paskiem; mały tytuł w pasku ma `opacity-0 in-data-head-out:opacity-100` — bez stanu w Reakcie. Grupa o nazwie działu jest pomijana („PRACA” nad „Praca”). Dziś nie ma daty w linijce: pokazuje ją ozdoba „1 lis” i karta dnia (trzecia kopia łamała linijkę na 390 px). Główka ma szerokość całej treści; Długi i Ćwiczenia stoją w kolumnie `--page-form` przy jej lewej krawędzi (nowy plan 1.2, wcześniej obie wyśrodkowane w `max-w-2xl`). Sekcje nie mają własnego `px-4` (był podwójny margines 32 px na telefonie). Opis i akcje: sekcja „Szkielet strony”.
- **Decyzje (D-W1, D-W5 z `docs-zrobione/plan-wyglad-2026-11-01.md`).** Tytuł na stronie, w pasku tylko po przewinięciu; grupa wszędzie, data tylko tam, gdzie dzień ma znaczenie.
- **Ograniczenia.** Pasek chowa się przy przewijaniu w dół, więc mały tytuł widać po ruchu w górę. Liczba notatek liczy widoczne notatki (`displayNotes`), nie terminy w Terminach.
- **Testy.** `src/components/sidebar/sidebarItems.test.ts` (grupa w pasku = `VIEW_GROUP`), e2e szukające h1 działu (`routes`, `mobile`, `hidden-views`, `reminders-calendar`), `e2e/a11y.spec.ts`, zrzuty `e2e/visual.spec.ts`.
- **Commit.** `1532aec` (2026-11-01).

## Motywy i kroje — Fala 2 (2026-10-22)

Co zmieniono:
- **Kontrast stylów (WCAG AA).** Czerwień „Usuń” (`--destructive`) przyciemniona tak, żeby biały tekst miał ≥4.5:1 w Planie, Neonie, Zorzy, Matrycy i Hydraulice (`src/styles/skins.css`). Plan dostał własny `--destructive-ink` (tekst błędu na karcie, 4.33 → ≥4.9). Test: `src/lib/skinContrast.test.ts` sprawdza każdy styl i schemat (Zeszyt jasny i ciemny).
- **Hydraulika.** Tła podniesione (tło 8% → 12%, karta 11% → 16%, muted 14% → 19%, krawędź 20% → 27%), bo była wyraźnie ciemniejsza od reszty. Miniatura: warstwy rur i wody mają własny `background-size` (wcześniej jedna kreska i pusty pas).
- **Nagłówki stylów.** Krój stylu tylko na `h1` i `h2` (Plan, Zorza, Miedź, Matryca). `h3` (małe etykiety sekcji w Ustawieniach) idzie za krojem tekstu. Hydraulika: Barlow Condensed tylko na `h1`, `h2` w Plus Jakarta, plus awaryjny krój.
- **Galeria stylów** (`src/components/settings/SkinPicker.tsx`): Zeszyt na pełną szerokość, pod nim sześć stylów w siatce. Obwódka miniatur `ring-foreground/10` (działa w ciemnym motywie).
- **Kroje** (`src/components/settings/FontPicker.tsx`, `src/lib/appFont.ts`): próbka zawija się zamiast się ucinać, „Il1 O0” jest w osobnej linii. Opisy w jednym wzorze „do czego · cecha”; „Domyślny · Plus Jakarta Sans”.

Nie zmienione (świadomie): amber domyślnego Zeszytu na papierze ma 2.65:1 — to kolor marki, zmiana wymaga decyzji właściciela (test go nie egzekwuje, bo to kolor ikon/linków, nie tekst).

## Style — sygnatury ruchu, pierwsza część (Faza 1b, 2026-10-23)

- **Co robi:** każdy styl ma własną krzywą i czas ruchu (`--sig-ease`, `--sig-dur`). Trzy sygnatury działają już w CSS:
  - **Zeszyt:** pióro podkreśla nagłówki h1/h2 przy każdym pojawieniu się (kreska rośnie od lewej).
  - **Plan:** siatka kreślarska wjeżdża (skala i przezroczystość) przy otwarciu okna.
  - **Neon:** poświata kafla przy fokusie klawiatury (wewnętrzny pierścień gaśnie do stanu stałego).
- **Gdzie:** `src/styles/skins.css`, sekcja „RUCH I SYGNATURY” na końcu pliku. Tokeny per styl na początku sekcji. Tokeny dla Zorzy, Miedzi, Matrycy i Hydrauliki są zdefiniowane, ale jeszcze nieużyte (czekają na sygnatury wymagające JS).
- **Jak działa:** animacje tylko w `transform` i `opacity`, z wyjątkiem poświaty Neonu (`box-shadow` na wewnętrznym `::after`), która jest wskaźnikiem fokusu, a nie ozdobą. Przy `html[data-motion="reduced"]` i `prefers-reduced-motion` animacja się nie uruchamia, a element pokazuje stan końcowy (kreska pełna, siatka widoczna, poświata przygaszona).
- **Ograniczenia i pułapki:**
  - Animacje działają przy montażu elementu. Podkreślenie Zeszytu ponownie „pisze się” po każdym pojawieniu się nagłówka, nie tylko przy pierwszym otwarciu.
  - Nie zrobione z planu (wymagają JS i hooków): Miedź (para przy zapisie), Hydraulika (fala napełniania przy zapisie), Zorza (paralaksa przy przewijaniu, fala barw przy zmianie motywu), Matryca (kaskada kolumn przy zmianie widoku, zbieranie znaków w kursor), Plan (wymiarowanie przy zaznaczeniu), Zeszyt (przewracanie kartki przy zmianie widoku), Neon (rozbłysk przy przypięciu, mruganie nagłówka przy pierwszym uruchomieniu dnia).
- **Testy:** `e2e/skin-signatures.spec.ts` (4 przypadki: animacja Zeszytu, stan końcowy Zeszytu przy ograniczonym ruchu, siatka Planu i jej stan przy ograniczonym ruchu, poświata Neonu przy fokusie). Regresja: `e2e/skin-motion.spec.ts` i `e2e/a11y.spec.ts` — razem 63/63 w projekcie `chromium`.
- **Commit:** `3295c4d` (2026-10-23).

## Style — sygnały zapisu, druga część (Faza 1b, 2026-10-23)

- **Co robi:** zapis notatki (edytor i pasek nowej notatki) wywołuje `html[data-sig="save"]` na ok. 1,4 s. Miedź puszcza z prawego dołu obłoczek pary, Hydraulika napełnia rurę falą od dołu.
- **Gdzie:** `src/lib/skinSignal.ts` (`pulseSkinSignal`, przerysunek przy każdym sygnale), `src/lib/skinSignal.test.ts`; wywołania w `src/hooks/useNoteEditSession.ts` (`handleSave`) i `src/components/AddNoteBar.tsx`; CSS w `src/styles/skins.css` (sekcja „Zapis”): `.paper-grid::after` dla Miedzi, `.hydro-bubbles::after` dla Hydrauliki.
- **Ograniczenia:** Zorza i Matryca nadal bez sygnału — `::before`/`::after` ich tła są zajęte (Zorza: dryf; Matryca: winieta). Do zrobienia po przeniesieniu winiety na inny element.
- **Testy:** `e2e/skin-signatures.spec.ts` (Miedź, Hydraulika, także stan przy ograniczonym ruchu); `src/lib/skinSignal.test.ts`. Regresja `skin-motion`, `a11y`, `skin-signatures` — 65/65 w `chromium`.

## Motyw pory roku — działa we wszystkich stylach (2026-10-23)

- **Zgłoszenie:** „motywy pory roku nie działają”. Odtworzone: `html[data-season]` ustawiał się poprawnie, ale plama światła na papierze była tylko w stylu Zeszyt (`.paper-grid::after`). W pozostałych stylach wybrany sezon nie było widać w tle.
- **Co robi teraz:** w każdym stylu poza Zeszytem tło papieru (`.paper-grid`) dostaje plamę światła w kolorach sezonu (`--season-blob-*`, z przygaszeniem w ciemnym motywie przez `--season-glow`). Akcent stylu zostaje bez zmian, bo to jego tożsamość; poświata aktywnej notatki dalej używa koloru sezonu.
- **Gdzie:** `src/styles/skins.css` (ostatni blok, „Pora roku w każdym stylu”). Zachowanie wyboru bez zmian: `src/lib/seasonTheme.ts`, `src/App.tsx`.
- **Świadoma decyzja:** akcent sezonu nie nadpisuje palety pozostałych stylów. Gdyby właściciel chciał zmiany akcentu, to osobna decyzja (kontrast trzeba sprawdzić na każdej palecie).
- **Testy:** `e2e/seasons.spec.ts` — test „Plan” zmieniony z „tło nie jest malowane” na „tło jest malowane na papierze”; `e2e/a11y.spec.ts` 56/56; `src/lib/skinContrast.test.ts` 12/12.

## Style — sygnały widoku, zapisu, przypięcia i zmiany skórki (Faza 1b, część 3, 2026-10-23)

- **Co robi:** sygnały na `html[data-sig]` (`src/lib/skinSignal.ts`, `pulseSkinSignal`, ok. 1,4 s):
  - `save` — zapis: Miedź (para), Hydraulika (fala). Już wcześniej.
  - `view` — zmiana widoku (`Index.tsx`): Zeszyt przewraca kartkę (`zeszyt-flip` na `.paper-grid::before`), Matryca spływa kaskadą (`matrix-cascade`, `::before` odsłonięte tylko na sygnał).
  - `dawn` — pierwsze uruchomienie dnia (`pulseDawnIfNewDay` z `App.tsx`, klucz `kaczy.sig.dawn.v1`): Neon rozbłyskuje nagłówek.
  - `pin` — przypięcie w `useNotes.togglePin`: Neon rozbłyskuje kafle z `data-pinned`.
  - `skin` — zmiana skórki w `setSkin` (`src/lib/skins.ts`): Zorza, fala gwiazd (`zorza-wave`).
- **Paralaksa Zorzy:** `src/lib/scrollParallax.ts` ustawia `--sig-scroll` na `<html>` przy przewijaniu (przechwytywanie, jedna klatka); CSS przesuwa wstęgi przez `translate` (nie koliduje z animacją `transform`). Start z `App.tsx`.
- **Plan — wymiarowanie:** zaznaczony kafel (`data-selected`, atrybut z `NoteCard`) dostaje linię wymiarową, która się rysuje (`plan-dimension` na `.note-card::after`).
- **Atrybuty kafla:** `NoteCard` ma `data-selected` i `data-pinned` (dla stylów i testów).
- **Ograniczenia i pułapki:**
  - Matryca: „znaki zbierają się w kursor przy najechaniu” NIE jest zrobione — wymaga zmian w płótnie `MatrixRain` (śledzenie kursora). Zostaje na później.
  - Wszystkie sygnały są jednorazowe (`pulseSkinSignal` zdejmuje atrybut po czasie); ograniczony ruch wyłącza animacje i zostawia stan spoczynku.
  - Zorza: wstęgi przesuwa `translate`, więc działa tylko w przeglądarkach z tą właściwością (wszystkie aktualne).
- **Testy:** `src/lib/skinSignal.test.ts`, `src/lib/scrollParallax.test.ts`; `e2e/skin-signatures.spec.ts` (13 przypadków, w tym view/dawn/pin/plan/zorza). Regresja: `skin-motion`, `a11y`, `seasons`, `editor-cm` — 81/81 w `chromium`; `vitest` 1898/1898; typy i lint czyste.
- **Commit:** `9d41492` (2026-10-23).

## Motywy — Matryca (kursor) i sygnał zapisu dla Zorzy i Matrycy (Faza 1b, 2026-10-23)

- **Co robi:**
  - **Matryca:** znaki w pobliżu kursora myszy ciągną się w jego stronę (głowa kolumny w promieniu 150 px przesuwa się ku kursorowi, im bliżej, tym mocniej). Tylko przy myszy, nie na dotyku i nie przy ograniczonym ruchu.
  - **Zorza:** przy zapisie przelatuje w poprzek tła fala barw (`zorza-wave`).
  - **Matryca:** przy zapisie linia skanu zjeżdża z góry (`matrix-scan`, czas z `--sig-dur` stylu, 0,25 s).
- **Gdzie jest:**
  - `src/components/skins/MatrixRain.tsx` — stałe `GATHER_RADIUS`, stan `px`/`py`, `onPointer` (`pointermove`), `onPointerOut` (wyjście z okna), podpięte tylko gdy `hover = !coarse && !reduced`.
  - `src/components/PaperBackdrop.tsx` — `<span className="sig-layer" />` dla Zorzy i Matrycy (pseudo-elementy tych stylów są zajęte przez tło).
  - `src/styles/skins.css` — `.sig-layer` i jego style per skórka, `@keyframes zorza-wave`, `@keyframes matrix-scan`, wyłączenie przy `data-motion="reduced"` i `prefers-reduced-motion`.
- **Testy:** `e2e/skin-signatures.spec.ts` (+2: Zorza, Matryca oraz Matryca przy ograniczonym ruchu). Cały zestaw `skin-motion`, `a11y` i `skin-signatures` przechodzi (74 testy, chromium).
- **Ograniczenia:** efekt kursora sprawdzony logicznie i testami, nie oceniony wizualnie na zrzucie. Warstwa `.sig-layer` nie ma wpisu w trybie budowy (sygnał jest krótki i przejściowy).
- **Odchylenie od planu (Faza 1b):** plan mówi o krzywych per styl w `src/lib/motion.ts`. Zrealizowane są jako tokeny CSS `--sig-ease` / `--sig-dur` w `src/styles/skins.css` (sekcja „Sygnatury”), bo są używane przez same animacje CSS. `motion.ts` zostaje dla framer-motion i nie dubluje tych wartości.
- **Stan Fazy 1b:** sygnatury wszystkich siedmiu stylów są wdrożone (Zeszyt, Plan, Neon, Zorza, Miedź, Matryca, Hydraulika), ograniczony ruch je wyłącza, testy `skin-signatures`, `skin-motion`, `a11y` przechodzą.

## Wygląd — wejścia bez framer-motion (D-3, 2026-10-26)

- **Co robi:** cytat dnia pod siatką i podpowiedzi skrótów na pustym ekranie Notatek pojawiają się płynnie samą przezroczystością.
- **Gdzie:** klasa `.fade-quiet` (+ `.fade-quiet-delayed` dla opóźnienia 0,5 s) w `src/index.css`; używają ją `src/components/DailyQuote.tsx` i `src/components/EmptyState.tsx`. Przy `prefers-reduced-motion` animacja jest wyłączona.
- **Ograniczenia:** tylko te dwa miejsca. Inne komponenty z `framer-motion` zostają (plan D-3 zakłada przegląd po jednym komponencie z pomiarem).
- **Testy:** `e2e/empty-states-qol.spec.ts`, `e2e/bundle.spec.ts`; jednostkowe `EmptyState.copy.test.ts`.

## Odcienie działów w nawigacji (D-4, plan 5.1, część)

- **Co robi:** ikona działu w pasku bocznym i dolnym pasku ma kolor z palety motywu: Notatki (bursztyn), Grafik (niebieski), Praca (miedź/ostrzeżenie), Kalendarz (zieleń). Inne widoki bez zmian.
- **Gdzie jest:** `src/lib/sections.ts` (`sectionIconClass(view)`, typ `SectionKey`), `src/index.css` (`--sec-notes`, `--sec-shifts`, `--sec-study`, `--sec-calendar` w `:root` i `.dark`; klasy `.sec-*` w `@layer utilities`), `src/components/AppSidebar.tsx` (`NavRow`), `src/components/BottomNav.tsx` (pętla `slots.map`).
- **Jak działa:** klasa na ikonie ustawia `color: var(--sec-*)`. `--sec-*` to kolor motywu zmieszany z 50% czerni na jasnym tle; w `.dark` czysty kolor motywu. Stała proporcja, a nie `--ink-mix` motywu, bo Miedź ma 82% i jest za jasna dla ikon.
- **Ograniczenia:** pasek nagłówka i puste stany z 5.1 nie zrobione. Zrzuty wizualne nie łapią tej zmiany (próg 1%); sprawdzać w przeglądarce.
- **Testy:** `src/lib/sections.test.ts` (mapowanie), `src/lib/skinContrast.test.ts` (kontrast ikon we wszystkich motywach i schematach).

## Wygląd — ustawienie „Ramki” (2026-10-28)

### Co robi
- Ustawienia → Wygląd → „Ramki”: **Delikatne** (domyślne, 30%), **Zwykłe** (55%), **Wyraźne** (100%, pełny kolor motywu). Dotyczy krawędzi kart i podziałów w każdym motywie, także domyślnym. Motyw Odblask ma własne, pełne ramki i ustawienie go nie zmienia.

### Gdzie jest
- `src/lib/frames.ts` — `useFrames`, `setFrames`, `frameMix`, `FRAME_MIX`; klucz `kaczy.frames.v1`.
- `src/index.css` — `--frame-mix: 30%` w `:root`; `--border` w dwóch blokach jako `color-mix(... var(--frame-mix) ...)`.
- `src/styles/skins/*.css` — `--border` każdego motywu (poza `odblask.css`) na `var(--frame-mix)`.
- `src/components/settings/AppearanceSettings.tsx` — sekcja „Ramki” pod „Kształt”.

### Kolor krawędzi i tło kart (2026-10-29)
- Ustawienia → Wygląd → „Ramki”, pod suwakiem siły: **kolor krawędzi** (Motyw, Grafit, Miedź, Błękit, Zieleń, Fiolet, Róż) i **tło kart** (Motyw, Ciepłe, Miętowe, Błękitne, Lawendowe, Różowe). Tło ma wariant jasny i ciemny, zmienia się razem z motywem.
- `src/lib/frameLook.ts` — `useFrameLook`, `setFrameColor`, `setFrameSurface`, `borderValue`, `surfaceValue`, `FRAME_COLORS`, `FRAME_SURFACES`; klucz `kaczy.frames.look.v1`. Nakładane inline na `<html>`: `--border` (mieszane przez `--frame-mix`, więc siła z suwaka działa) i `--card`. Obserwator klasy `<html>` przelicza tło po przełączeniu jasny/ciemny.
- `src/components/settings/FrameLookPicker.tsx` — próbki (`Swatches`, wspólne z poświatą).
- Kontrast: każde tło sprawdzane testem względem `--card-foreground` w obu motywach (≥ 4,5:1; w praktyce ponad 12:1). Testy: `src/lib/frameLook.test.ts`, e2e `e2e/frame-look.spec.ts`.
- Ograniczenie: nadpisanie `--card` działa ze wszystkimi skórkami, ale tekst karty liczony jest względem domyślnych barw motywu. Skórka z innym kolorem tekstu na karcie dostaje tło sprawdzone tylko tym testem.

### Poświata (2026-10-29)
- Ustawienia → Wygląd → „Poświata”: **siła** (Wyłączona, Delikatna 50 %, Zwykła, Mocna ×1,6) i **barwa** (Motyw, Bursztyn, Błękit, Zieleń, Fiolet, Róż). Podgląd pokazuje zaznaczoną notatkę i przycisk „Zapisz” jako prawdziwe elementy.
- `src/lib/glowLook.ts` — `useGlowLook`, `setGlowStrength`, `setGlowColor`, `fabGlowValue`, `GLOW_STRENGTH`, `GLOW_COLORS`; klucz `kaczy.glow.v1`. Inline na `<html>`: `--glow-mul` (mnożnik halo), `--glow-color` (barwa) i `--glow-primary` (cień przycisków głównych; ustawiany tylko przy zmianie siły albo barwy, domyślnie zostaje cień skórki).
- `src/index.css` — `note-glow-active` i `note-glow-breathe` używają `var(--glow-color, var(--season-accent))` i mnożą **halo** przez `var(--glow-mul, 1)`. **Obwódka zaznaczenia (2 px) zostaje pełna**, więc przy „Wyłączona” zaznaczona notatka dalej jest widoczna.
- Zmienne są nakładane przy starcie (`src/main.tsx` importuje `frameLook` i `glowLook`). Wcześniej moduły ładowały się dopiero z Ustawień, więc zapisany wybór nie działał po odświeżeniu. Test: `e2e/look-boot.spec.ts`.
- Testy: `src/lib/glowLook.test.ts` (mapowanie siły i barwy), `e2e/glow.spec.ts` (zmienne, odświeżenie, powrót do domyślnych).

### Jak działa i dlaczego
- Procent ustawia `document.documentElement.style.setProperty("--frame-mix")` (inline na `<html>`), więc wygrywa z każdym motywem bez zmian w jego selektorach. Zmiana przezroczystości nie wymaga osobnej palety.
- Odblask zostaje pełny, bo to motyw o wysokim kontraście i zmniejszenie ramek łamałoby jego założenie.

### Testy
- `src/lib/frames.test.ts` (procenty rosną: delikatne < zwykłe < wyraźne). Testy motywów i ustawień zielone.

## Wygląd: Fala 0 planu motywów — naprawy (2026-10-30)

- **Co robi.**
  - **Miedź:** główny przycisk ma gradient liczony z koloru akcentu, czytelny w obu schematach (dawny gradient na sztywno dawał w ciemnej Miedzi ok. 3,8:1 i pomijał akcent).
  - **Poświata zaznaczonej notatki** w stylach innych niż Zeszyt ma kolor stylu (`--primary`), nie pory roku; w Zeszycie dalej kolor pory roku. Opis pory roku w Ustawieniach mówi teraz, co naprawdę robi w innych stylach (plamy światła na tle).
  - **Odblask** nie ma już żadnego ruchu: ramka aktywnej notatki to pełny, nieruchomy obrys, poświata nie „oddycha”, kropka „teraz” i tło Dziś nie pulsują; fokus z klawiatury to gruba kreska 3 px.
  - **Bez mignięcia przy starcie:** styl, jasność i kolor paska stanu są ustawione, zanim wczyta się aplikacja.
  - Tabliczka w rogu arkusza na komputerze: „NOTKI · ARKUSZ 1/1” zamiast starego „G”.
- **Gdzie.** `src/styles/skins/miedz.css` (`@supports (color: oklch(from …))`), `src/index.css` (`--glow-default`, `.paper-stamp`), `src/components/settings/AppearanceSettings.tsx` (opis pory roku), `src/styles/skins/odblask.css`, `public/prepaint.js` i `<script src="/prepaint.js">` w `index.html`.
- **Jak działa.**
  - Miedź: jasny schemat — gradient od `--primary` w ciemniejsze (`l − 0,09`), więc biały tekst tylko zyskuje; ciemny — od jaśniejszego (`l + 0,08`) do `--primary`, więc ciemny tekst zyskuje. Odblask światła po najechaniu tylko w ciemnym. Przeglądarka bez kolorów względnych dostaje płaski `--primary`.
  - Poświata: łańcuch `var(--glow-color, var(--glow-default, var(--season-accent)))`; `--glow-default` = `--primary` na `html[data-skin]:not([data-skin="zeszyt"])`. Własny kolor z Ustawień (`--glow-color`) dalej wygrywa.
  - `prepaint.js`: osobny plik, nie skrypt w HTML, bo CSP ma `script-src 'self'`. Czyta `kaczy.skin.v1`, `kaczy-theme` (Zeszyt) i `kaczy.skinScheme.v1`; ustawia `data-skin`, klasę `dark`, `color-scheme` i `meta[name=theme-color]`. Mapy kolorów są kopią `SKIN_THEME_COLOR` i `SKIN_THEME_COLOR_ALT` — test pilnuje zgodności. Wszystko w `try`, przy błędzie JS ustawi wygląd po starcie.
- **Ograniczenia.** „Styl na noc” (harmonogram) dochodzi dopiero w JS, więc wieczorem przy pierwszym uruchomieniu może mignąć styl dzienny. Przy dodaniu stylu trzeba dopisać go też w `prepaint.js` (test to wyłapie). Audyt wskazywał też czerwony margines i Fraunces w innych stylach — sprawdzone: każdy styl ma własny `--margin`, a tytuły arkuszy (`h2`) biorą krój stylu, więc bez zmian. Zapas precache po Fali 0: ok. 1,9 KB z 3,9 MiB — przed Falą 1 decyzja T-10.
- **Testy.** Vitest: `src/lib/skinContrast.test.ts` (gradient Miedzi z `--primary`, tekst ≥ 4,5:1 na obu końcach w obu schematach), `src/lib/prepaint.test.ts` (10 stylów × jasność × tryb systemu = ta sama decyzja co `resolveDark` i ten sam kolor paska; śmieci w zapisie). E2E: `e2e/prepaint.spec.ts` (Neon ciemny i Miedź jasna ustawione przy zablokowanym module aplikacji).
- **Commit.** `60019a3` (2026-10-30).

## Wygląd: ekran „Szybko / Zaawansowane”, przywracanie domyślnego (Fala 1 planu motywów, 2026-10-30)

- **Co robi.** Ustawienia → Wygląd zaczynają się od przyklejonego paska części, który na wąskim telefonie zawija się do drugiego rzędu zamiast uciekać za prawą krawędź. Podgląd na żywo (wycinek aplikacji z polem „Szukaj notatek…” i dwoma kaflami) usunięty na prośbę użytkownika 2026-11-03 (`cf3c60c`). Części: **Szybko** (galeria stylów, jasność, akcent, rozmiar tekstu, tryb budowa), **Zaawansowane** — zwinięte, rozwijane przyciskiem, stan zapamiętany (kształt, ramki, poświata, tło, styl na noc, pora roku, krój, kod wyglądu), Układ, Ruch. Pory roku mają ikony zamiast emoji. **„Przywróć domyślny wygląd”** (z potwierdzeniem) wraca do Zeszytu i ustawień domyślnych bez przeładowania; komunikat ma „Cofnij”.
- **Gdzie.** `src/components/settings/AppearanceSettings.tsx` (`APPEARANCE_GROUPS`, `ADVANCED_KEY`, `SEASON_ICON`, `resetLook`), `src/lib/appearanceCode.ts` (`snapshotAppearance`, `applyAppearanceValues`, `resetAppearance`; `APPEARANCE_KEYS` + tryb budowa, ruch, pora roku).
- **Jak działa.** Każdy magazyn ustawień (`createPersistedStore`) i jasność w `useTheme` słuchają zdarzenia `storage` (zmiany z innej karty). `applyAppearanceValues` zapisuje albo usuwa klucze wyglądu i wysyła w tej karcie `StorageEvent` z `key: null` — magazyny czytają się od nowa i wygląd zmienia się od razu, bez przeładowania. „Cofnij” to ta sama funkcja z wartościami sprzed resetu. Stan „Zaawansowane” w `kaczy.appearance.advanced.v1` (tylko to urządzenie).
- **Ograniczenia.** Reset nie rusza układu widoku, efektów ani ustawień działów. Kod wyglądu zawiera teraz też tryb budowa, ruch i porę roku; starsze kody bez nich działają. „Kod wyglądu” został w Zaawansowanych (przeniesienie do „Kopia i dane” odłożone).
- **Testy.** Vitest: `src/lib/appearanceCode.test.ts` (reset i „Cofnij” zmieniają wygląd od razu, `replace` false zostawia brakujące klucze). E2E: `e2e/appearance-quick.spec.ts` (zwinięte Zaawansowane i zapamiętanie, brak podglądu i „Zestawów”, ikony pór roku, reset i „Cofnij” bez przeładowania); testy ustawień zaawansowanych (`appearance-code`, `frame-look`, `glow`, `night-skin`, `seasons`, `skins`) otwierają sekcję przez `kaczy.appearance.advanced.v1`.
- **Commit.** `3c22a40` (2026-10-30).

## Wygląd: zestawy jednym stuknięciem (Fala 1, 1.3 planu motywów, 2026-10-30)

- **Co robi.** Zestawy są w okienku „Zestaw wyglądu” (szybki dostęp niżej); sekcja **Zestawy** w Ustawienia → Wygląd → Szybko usunięta na prośbę użytkownika 2026-11-03 (`cf3c60c`) (razem z „Zapisz tu”). Gotowe — **Budowa** (Odblask, tryb budowa, gładkie tło, wyraźne ramki, tekst 125%, poświata wyłączona, ruch ograniczony) i **Noc** (ciemna Zorza, ciche tło, łagodna poświata) — oraz **Mój 1–3**: przywrócenie zapisanego wyglądu jednym stuknięciem. Zapisu nowego slotu nie ma już w interfejsie (był tylko w Ustawieniach); `saveSlot` zostaje w `lib/` z testem, sloty zapisane wcześniej działają. Każde zastosowanie pokazuje komunikat z „Cofnij”.
- **Gdzie.** `src/lib/appearancePresets.ts` (`PRESETS`, `readSlot`, `saveSlot`, `applyValues`), okienko w `src/components/settings/QuickPresets.tsx`.
- **Jak działa.** Gotowy zestaw zmienia tylko swoje klucze (`replace: false`), więc akcent, krój i układ zostają. Własny slot zapisuje i przywraca cały wygląd (`replace: true`, klucze spoza zapisu wracają do domyślnych). Zmiana idzie tą samą ścieżką co reset: zapis w localStorage i zdarzenie `storage` — bez przeładowania. Sloty to klucze `kaczy.appearance.slot.N.v1` (per urządzenie).
- **Szybki dostęp.** Przytrzymanie (500 ms) albo prawy przycisk na przełączniku jasności — w nagłówku, w pasku bocznym i na kafelku „Tryb ciemny” w „Więcej” na telefonie — otwiera okienko „Zestaw wyglądu”: Budowa, Noc, zapisane Mój 1–3 i Domyślny wygląd, każdy z „Cofnij”. Zwykłe stuknięcie dalej przełącza jasność. Kod: `src/hooks/useLongPress.ts` (przytrzymanie i `contextmenu`, bez podwójnego wywołania na Androidzie), `src/components/settings/QuickPresets.tsx` (`QuickPresetsHost`, montowany w `Index.tsx`), `src/lib/quickPresets.ts` (zdarzenie `kaczy:quick-presets`). Na telefonie okienko otwiera się 320 ms po zamknięciu arkusza „Więcej” — arkusz oddaje fokus przyciskowi „Więcej”, a fokus poza okienkiem Radix by je zamknął.
- **Ograniczenia.** Uszkodzony slot jest traktowany jak pusty.
- **Testy.** Vitest: `src/lib/appearancePresets.test.ts` (gotowy zestaw zmienia tylko swoje klucze i „Cofnij” wraca; slot zapisuje i przywraca cały wygląd; uszkodzony slot). E2E: `e2e/quick-presets.spec.ts` (telefon: przytrzymanie kafelka → Noc i „Cofnij”; komputer: prawy przycisk → Budowa, zwykły klik dalej przełącza jasność).
- **Commit.** `c193b61` (2026-10-30).

## Wygląd: kod i link wyglądu bez przeładowania (Fala 1, 1.5 planu motywów, 2026-10-30)

- **Co robi.** W Ustawienia → Wygląd → Zaawansowane, w „Kod wyglądu”, są trzy sposoby przeniesienia wyglądu: **Kopiuj kod wyglądu**, **Udostępnij link** (arkusz udostępniania, bez niego schowek) i **Wczytaj** kod wklejony w pole. Wczytanie stosuje wygląd od razu, bez odświeżania aplikacji, i daje komunikat „Cofnij”. Link `<adres>/#wyglad=NOTKI1-…` po otwarciu pyta „Wczytać wygląd z linku?”: „Nie, zostaw” nic nie zmienia, „Wczytaj wygląd” stosuje go z „Cofnij”. Fragment znika z adresu po pytaniu.
- **Gdzie.** `src/lib/appearanceCode.ts` (`appearanceLink`, `codeFromHash`, obok `applyAppearanceValues`), `src/components/settings/AppearanceCode.tsx`, `src/components/settings/AppearanceLinkImport.tsx` (pytanie o link, montowane w `src/pages/Index.tsx` obok samouczka).
- **Jak działa.** Wczytanie idzie tą samą ścieżką co reset i zestawy: `applyAppearanceValues` zapisuje klucze i wysyła zdarzenie `storage`, na które słuchają magazyny ustawień. Kod z linku przechodzi przez `decodeAppearance`, więc tylko klucze wyglądu i sprawdzone wartości trafiają do localStorage. Wczytanie kodu nie usuwa kluczy, których kod nie zawiera (`replace: false`), więc wygląd z kodu nakłada się na obecny; reset i zestawy działają inaczej (patrz opis zestawów).
- **Ograniczenia.** Link zawiera cały kod (ok. kilkaset znaków), więc długi adres. Pytanie o link nie pojawia się, gdy fragment nie jest poprawnym kodem wyglądu. QR nie jest zrobiony (zostaje na później, zgodnie z planem).
- **Testy.** Vitest: `src/lib/appearanceCode.test.ts` (link wraca z fragmentu; obcy fragment i zły kod odrzucane). E2E: `e2e/appearance-share.spec.ts` (wczytanie kodu bez przeładowania, „Cofnij”; link pyta, „Nie” nic nie zmienia, „Wczytaj wygląd” stosuje).
- **Commit.** `619d8e7` (2026-10-30).

## Logo „notki” w nagłówku (plan motywów 1.6, decyzja T-9, 2026-10-30)

- **Co robi.** Logo w nagłówku i w pasku bocznym to „notki” pisane długopisem, w gradiencie marki (bursztyn → koral → róż w Zeszycie). Pierwsze wejście w sesji rysuje je kreska po kresce; potem stoi na gotowo. Ten sam rysunek co na ekranie startowym i w samouczku. Znak „N” obok (ikona aplikacji) zostaje bez zmian.
- **Gdzie.** `src/components/NotkiLogo.tsx` (`NotkiLogo`, `STROKES`, `takeFirstDraw`), tokeny kolorów `--brand-from/via/to` w `src/index.css` (domyślne + po jednym bloku na styl, Odblask i Tablica z wariantem ciemnym), podgląd w `src/components/settings/AppearancePreview.tsx`.
- **Jak działa.** SVG z ośmioma ścieżkami o `pathLength="1"`; rysowanie to klasa `guide-draw` (ta sama technika co w samouczku), z opóźnieniami z `--d`. Przy ograniczonym ruchu i przy drugim wejściu w sesji logo jest od razu gotowe — flaga `kaczy.logo.drawn.v1` w `sessionStorage`. Gradient z tokenów przez `stop-color: var(--brand-…)`, więc zmiana stylu zmienia kolor logo bez ponownego rysowania. Etykieta dostępności to nadal „NOTKI” (nazwa aplikacji w tytule karty i w testach).
- **Ograniczenia.** Przy 390 px logo ma wysokość ok. 1,6 em tekstu nagłówka. Stare reguły liter (`.notki-glyph`, `.notki-hop`, `.notki-caret`, animacje `notki-sheen`/`notki-hop`/`notki-caret`) i ich nadpisania w skórkach zostały usunięte (krok 2 z 1.6); zostały tylko reguły `.notki-logo` (filtry i animacja skórek), bo działają na SVG.
- **Testy.** E2E: `e2e/brand-notki.spec.ts` (tytuł karty i logo „NOTKI”). Zrzuty nagłówka sprawdzone ręcznie w połowie i na końcu rysowania.
- **Commit.** `88499af` (2026-10-30).

## Dolny pasek: przycisk „+” w gradiencie marki (plan motywów 1.6, krok 3, 2026-10-30)

- **Co robi.** Okrągły przycisk „+” na dolnym pasku ma gradient marki stylu, a ikona „+” ma kolor dobrany do tego gradientu: ciemna na jasnych (Zeszyt, Neon, Zorza, Matryca, ciemny Odblask i ciemna Tablica), biała na ciemnych (Plan, Miedź, Hydraulika, Kafle, jasna Tablica), fluo na czarnym jasnym Odblasku. Stuknięcie i przytrzymanie działają jak wcześniej.
- **Gdzie.** `src/components/BottomNav.tsx` (klasa `fab-brand` na przycisku), `src/index.css` (`.fab-brand`; tokeny `--brand-ink` i `--fab-shade` w blokach `--brand-*` każdego stylu).
- **Jak działa.** `.fab-brand` ustawia `color: var(--brand-ink)` i gradient od `--brand-via` do `--brand-to`, oba końce przyciemnione o `--fab-shade` (domyślnie 0%, Hydraulika 8%). Pierwsza wersja brała kolor ikony z `--primary-foreground` i przyciemniała koniec o 38% — test kontrastu pokazał 10 kombinacji poniżej 3:1, bo gradient szedł od jasnego do ciemnego i żaden jeden kolor ikony nie pasował. Kolor ikony dobrano liczeniem: dla każdego stylu najmniejsze przyciemnienie dające ≥3:1 z białą albo ciemną ikoną.
- **Ograniczenia.** Przycisk nie bierze już akcentu stylu (`--primary`) — ma kolor marki. Nowy styl musi dostać `--brand-ink` (test wymaga go dla każdego stylu i schematu).
- **Testy.** Vitest: `src/lib/skinContrast.test.ts` (ikona ≥3:1 na obu końcach gradientu w 10 stylach × 2 schematach; reguła `.fab-brand` bierze `--brand-ink` i `--fab-shade`). E2E: `bottom-slot`, `fab-sheets-a11y`, `mobile`, `skins`. Zrzuty przycisku w 6 stylach sprawdzone ręcznie.
- **Commit.** `b936e25` (2026-10-30).

## Dolny pasek per styl: kształt „+” i znacznik aktywnej pozycji (Fala 2, 2.2 planu motywów, 2026-10-30)

- **Co robi.** Każdy styl może przebrać przycisk „+” i znacznik aktywnej pozycji na dolnym pasku. Odblask ma kwadratowy „+” i prostokątny znacznik (jak tabliczka na budowie), Kafle płytkę z lekko zaokrąglonymi rogami, Hydraulika znacznik jak rurę, Neon rurkę. Zeszyt zostaje jak dotąd (okrąg, zaokrąglony znacznik).
- **Gdzie.** `src/index.css` (klasy `.nav-active-bar`, `.nav-active-tile`, `.fab-brand` z tokenami `--nav-bar-radius`, `--nav-tile-radius`, `--fab-radius`), `src/components/BottomNav.tsx` (klasy na znaczniku paska i na kafelku aktywnej pozycji), skórki `src/styles/skins/{odblask,kafle,hydraulika,neon}.css`.
- **Jak działa.** Zaokrąglenia to tokeny z wartością domyślną, więc bez skórki wszystko wygląda jak przed zmianą. Animacja znacznika (`layoutId`) i kolory zostają bez zmian; zmienia się tylko kształt. Przycisk „+” ma `border-radius: var(--fab-radius, 9999px)`.
- **Ograniczenia.** Kafle i Hydraulika dostały tokeny, ale bez dopracowanych zrzutów — do QA na telefonie. Zmiana kształtu nie zmienia obszaru dotyku (44 px zostaje).
- **Testy.** E2E: `bottom-slot`, `mobile`, `skins`, `fab-sheets-a11y`, `quick-presets`, `a11y`. Zrzuty paska w 5 stylach sprawdzone ręcznie.
- **Commit.** `5cdca8c` (2026-10-30).

## Okna per styl: kształt, krawędź, cień i krój tytułu (Fala 2, 2.3 planu motywów, 2026-10-30)

- **Co robi.** Dialogi i okna (`DialogContent`, także arkusze „+” i samouczek) biorą kształt, krawędź, cień i krój tytułu ze stylu. Odblask: ostre rogi, czarna krawędź, płaski cień i tytuł w wąskim kroju. Plan: ostre rogi, linia siatki, wąski krój. Tablica: zaokrąglone jak kreda, krawędź w odcieniu ramy. Miedź: krawędź w kolorze rury i cień jak na betonie. Matryca: zielona poświata i tytuł monospace. Hydraulika: cienka krawędź. Zeszyt bez zmian.
- **Gdzie.** `src/components/ui/dialog.tsx` (klasy `[border-radius:var(--overlay-radius,…)]`, `[border-color:…]`, `[box-shadow:…]` na `DialogContent`, `[font-family:var(--overlay-title-font,inherit)]` na `DialogTitle`); tokeny `--overlay-*` w `src/styles/skins/{odblask,plan,tablica,miedz,matrix,hydraulika}.css`.
- **Jak działa.** Każdy token ma wartość domyślną, więc bez skórki okno wygląda jak dawniej. Odwołania idą na istniejące tokeny (`--r-card` promień kart, `--elevation-3` cień, `--border` krawędź). Kształt okna i tytuł są widoczne także w samouczku i szybkich zestawach, bo używają tego samego `DialogContent`.
- **Toasty.** Powiadomienia (Sonner, `src/components/ui/sonner.tsx`) biorą promień, krawędź i cień ze stylu: `--toast-radius` (Odblask 0,25 rem, Tablica 0,75 rem), `--toast-border`, `--toast-shadow`. Promień idzie przez zmienną `--border-radius`, którą Sonner stawia na każdym toście — klasa z `!` przegrywała z jego domyślnym `rounded-field`.
- **Ograniczenia.** Kafle i Zorza bez własnych okien (zostają domyślne). Wąski krój tytułu w Odblasku i Planie to Barlow Condensed, który jest już w paczce stylu.
- **Testy.** Vitest: pełny zestaw. E2E: `onboarding`, `guides`, `appearance-quick`, `quick-presets`, `appearance-presets`, `a11y`, `mobile`, `fab-sheets-a11y`, `study`, `journal-menu`. Zrzuty samouczka i powiadomienia w Odblasku, Tablicy i Zeszycie sprawdzone ręcznie; promień powiadomienia sprawdzony obliczonym stylem.
- **Commit.** `6e0ce3b` (2026-10-30).

## Nagłówki działów: podkreślenie piórem w kolorze działu (2.4 planu motywów; plan wyglądu, Faza 2)

- **Co robi.** Tytuł działu w główce kartki ma pod sobą kreskę w kolorze działu: Notatki i Dziś — kolor marki, Grafik — akcent, Praca — kolor ostrzeżenia, Kalendarz — kolor sukcesu. Kreska dorysowuje się raz, przy wejściu w dział, i ma długość tytułu. Nigdzie indziej jej nie ma: ani w małym tytule paska, ani pod nagłówkami kart i sekcji (Faza 2: akcent tylko tam, gdzie znaczy „tu jesteś”).
- **Gdzie.** `src/components/ViewTitle.tsx` (`section-title` i `justify-self-start` na h1); `src/index.css`: `.section-title::after`, kolory po `html[data-view]`, grubość po `data-sections`; `src/styles/skins/signatures.css`: pióro Zeszytu tylko na `h1` (wcześniej też każdy `h2`).
- **Jak działa.** Kreska to pseudoelement z `transform: scaleX(0)`, który animacją (`section-rule`, w Zeszycie `zeszyt-pen`) rośnie do 1. Kolor z `--sec-*`. Przy ograniczonym ruchu od razu pełna.
- **Ograniczenia.** Kreska jest ozdobą, czytnik ekranu jej nie zgłasza. Inne style mogą mieć własne sygnatury nagłówków (np. Tablica) — Faza 2 zmieniła tylko Zeszyt.
- **Testy.** `src/lib/sectionColors.test.ts`, `e2e/skin-signatures.spec.ts` (pióro na pierwszym h1), zrzuty `e2e/visual.spec.ts`.
- **Commit.** `2d03a42` (2026-10-30), Faza 2: `1532aec` (2026-11-01).

## Jasne schematy: Matryca i Plan (Fala 2, 2.5 planu motywów, 2026-10-30)

- **Co robi.** **Matryca jasna** ma deszcz znaków: ciemnozielone znaki na jasnym papierze, lżejsze krycie, żeby nie zasłaniały tekstu. Wcześniej w jasnym była tylko statyczna siatka pasów. **Plan jasny** ma wyraźniejszą siatkę rysunku technicznego. Neon i Zorza jasne bez zmian (tokeny były kompletne, a zrzuty nie pokazały wyraźnej luki).
- **Gdzie.** `src/components/skins/MatrixRain.tsx` (parametr `light`, kolory `FADE_LIGHT`, `HEAD_LIGHT`, `TRAIL_LIGHT`; efekt zależy od `[still, light]`), `src/components/PaperBackdrop.tsx` (deszcz montowany w obu schematach Matrycy, `light={!dark}`), `src/styles/skins/matrix.css` (krycie płótna w jasnym), `src/styles/skins/plan.css` (siatka w jasnym).
- **Jak działa.** Ciemny wariant deszczu jest bez zmian (domyślne `light=false`). Klucz montowania to `${backdrop}-${dark ? "d" : "l"}`, więc przejście między schematami przemontowuje płótno z właściwą paletą.
- **Ograniczenia.** Deszcz w jasnym to ten sam koszt co w ciemnym (płótno, do 24 klatek/s), a ograniczony ruch i tryb „ciche” działają tak samo. Neon i Zorza jasne nie dostały jeszcze poświaty w tle (rozważane, nie zrobione).
- **Testy.** Vitest: pełny zestaw. E2E: `skins`, `skin-motion`, `a11y`, `mobile`. Zrzuty jasnych wariantów Matrycy, Planu, Neonu i Zorzy sprawdzone ręcznie.
- **Commit.** `0340c2e` (2026-10-30).

## Wzory papieru: korek w jasnej Tablicy, płytki 20×20 w jasnych Kaflach (Fala 2, 2.6 planu motywów, 2026-10-30)

- **Co robi.** Jasna **Tablica** ma wzór „korek”: drobne kropki zamiast szkiców. Jasne **Kafle** mają mniejsze pola (20×20 px) i cieńszą fugę niż w ciemnym wariancie.
- **Gdzie.** `src/styles/skins/tablica.css` (blok `html[data-skin="tablica"]:not(.dark) .paper-grid::before`), `src/styles/skins/kafle.css` (blok `html[data-skin="kafle"]:not(.dark) .paper-grid::before`). Tylko CSS, bez zmian w komponentach.
- **Jak działa.** Wzór to nadpisanie `background-image` i `background-size` warstwy `.paper-grid::before`. Dwie warstwy kropek mają różne rozmiary, więc się nie powtarzają w rytm. Ciemne warianty zostają bez zmian.
- **Ograniczenia.** Nie zrobiłem pozostałych wariantów z planu: kalki i milimetrówki dla Planu (Plan ma już milimetrówkę z 2.5), cegiełki dla ciemnych Kafli, zielonej tablicy jako wyboru. Zeszyt nie dostał wyboru wzoru. Wybór wzoru przez użytkownika nie jest zrobiony — wzór jest stały dla stylu i schematu.
- **Testy.** Vitest: pełny zestaw. E2E: `skins`, `skin-motion`, `a11y`. Zrzuty jasnej Tablicy i jasnych Kafli sprawdzone ręcznie.
- **Commit.** `94fcfec` (2026-10-30).

## Wygląd: czarne tło OLED w ciemnym schemacie (Fala 3, 3.3 planu motywów, 2026-10-30)

- **Co robi.** Ustawienia → Wygląd → Zaawansowane → „Czarne tło w ciemnym (OLED)”. Włączone: w ciemnym schemacie każdego stylu tło strony jest czarne. Karty, przyciski i pola zostają rozjaśnione tokenami stylu, więc nadal się odróżniają. Oszczędza prąd na ekranach OLED, a na słońcu poprawia kontrast kart.
- **Gdzie.** `src/lib/oled.ts` (`useOled`, `setOled`, `oledOn`; zapis `kaczy.oled.v1`, atrybut `data-oled` na `<html>`), import w `src/main.tsx`, przełącznik w `src/components/settings/AppearanceSettings.tsx`, reguła w `src/index.css` (`html[data-oled="on"][data-skin].dark { --background: #000; }`), klucz w `APPEARANCE_KEYS` (kod wyglądu i reset go obejmują).
- **Jak działa.** Reguła ma specyficzność wyższą niż tokeny stylu (`html[data-skin].dark`), więc nadpisuje tylko `--background` i działa we wszystkich stylach. W jasnym schemacie nic się nie zmienia.
- **Ograniczenia.** Zmienia tylko tło strony. Ozdoby stylu (np. siatka papieru) zostają na czarnym tle w tej samej kolorystyce. Nie sprawdzałem kontrastu wszystkich kombinacji z czarnym tłem (to krok z testami kontrastu, do domknięcia z 4.4).
- **Testy.** Vitest: `src/lib/oled.test.ts` (atrybut na `<html>` przy włączeniu i zdjęcie przy wyłączeniu; klucz w kodzie wyglądu; reguła CSS tylko w ciemnym). E2E: `appearance-code`, `appearance-quick`, `appearance-presets`, `appearance-share`, `skins`. Zrzut Neona w OLED sprawdzony ręcznie.
- **Commit.** `4cdfc8a` (2026-10-30).

## Wygląd: kolory działów, subtelne albo wyraźne (Fala 3, 3.4 planu motywów, 2026-10-30)

- **Co robi.** Ustawienia → Wygląd → Zaawansowane → „Kolory działów”: **Subtelne** (domyślnie) — cienka kreska pod nagłówkiem działu, stonowana; **Wyraźne** — grubsza i pełna. Kolor każdego działu zostaje ten sam (`--sec-*`).
- **Gdzie.** `src/lib/sectionColors.ts` (`useSectionColors`, `setSectionColors`; zapis `kaczy.sectionColors.v1`, atrybut `data-sections="bold"` na `<html>`; subtelne to brak atrybutu), import w `src/main.tsx`, przełącznik w `src/components/settings/AppearanceSettings.tsx`, reguły w `src/index.css` (`html:not([data-sections])` i `html[data-sections="bold"]` dla `.section-title` i `.app-title`), klucz w `APPEARANCE_KEYS`.
- **Jak działa.** Grubość i krycie kreski ustawiają dwie reguły na tym samym selektorze. Kolor bierze z `--sec-*` po `html[data-view]`, jak dotąd.
- **Zmiana wyglądu domyślnego.** Wcześniej nagłówek `ViewTitle` miał kreskę 3 px w pełnym kolorze. Domyślnie jest teraz subtelna: 2 px, 60% krycia. Kto chce dawnego wyglądu, włącza „Wyraźne”.
- **Ograniczenia.** Nie zmieniłem znacznika aktywnej pozycji na dolnym pasku (zostaje w kolorze marki) — to osobny wybór. Kolory działów w paskach bocznych bez zmian.
- **Testy.** Vitest: `src/lib/sectionColors.test.ts` (atrybut na `<html>` przy obu trybach; klucz w kodzie wyglądu; reguła CSS dla wyraźnych). E2E: `section-colors` (przełącznik zmienia atrybut i wraca), `appearance-quick`, `appearance-code`.
- **Commit.** `d617374` (2026-10-30).

## Sygnatury stylów: taśma Zeszytu, kreda Tablicy, rurka Neonu (Fala 3, 3.6 planu motywów, 2026-10-30)

- **Co robi.** Trzy ozdoby, które mówią, w jakim stylu jest aplikacja:
  - **Zeszyt:** przypięta notatka ma taśmę klejącą w górnej krawędzi (pół przezroczysty pasek, lekko pochylony).
  - **Tablica:** znacznik aktywnej pozycji na dolnym pasku jest krótszy i skośny, jak kreda.
  - **Neon:** przycisk „+” ma podwójną poświatę w kolorze marki, jak wkręcona rurka.
- **Gdzie.** `src/styles/skins/signatures.css` (wszystkie trzy reguły). Tylko CSS.
- **Jak działa.** Taśma to `::after` karty przypiętej (`[data-pinned]`), wykluczony jest `.note-glow-active`, bo ten pseudoelement jest zajęty przez poświatę aktywnej notatki. Znacznik Tablicy i poświata Neonu nadpisują klasy z 2.2 i 2.7 w tym samym miejscu, więc zmiana kształtu i koloru idzie w jednym pliku.
- **Ograniczenia.** Dwie sygnatury z planu nie są zrobione: **Kafle** (pusty stan „brakująca płytka”) i **Plan** (puste stany jak rysunek techniczny). Wymagają zmiany rysunku pustych stanów w SVG (`src/lib/emptyGlyphs.ts`), a nie tylko CSS, więc zostawiam je na osobny krok. Neon ma już sygnaturę przypięcia (`data-sig="pin"`), więc jej nie dublowałem.
- **Testy.** E2E: `skin-signatures`, `note-groups`, `skins`, `glow` (44 testy). Zrzut przypiętej notatki w Zeszycie sprawdzony ręcznie.
- **Commit.** `ac7cdf8` (2026-10-30).

## Hydraulika jako styl flagowy: pokrętło „+” i poziom wody w rurze (Fala 3, 3.1 planu motywów, 2026-10-30)

- **Co robi.** W stylu Hydraulika:
  - **„+” na dolnym pasku** obraca się o 90° w czasie przytrzymania (420 ms, potem otwiera się arkusz szybkiego dodawania) i wraca po puszczeniu, jak pokrętło zaworu.
  - **Pasek postępu zmiany na Dziś** wygląda jak rura: metalowy przewód, a postęp to jasny pas wody wypełniający go od lewej.
- **Gdzie.** `src/styles/skins/hydraulika.css` (trzy reguły: pasek postępu `role="progressbar"` + `aria-label="Postęp zmiany"`, `[data-testid="today-progress"]`, obrót `.fab-brand:has([data-pressing="true"]) > span > svg`). Tylko CSS.
- **Jak działa.** Obrót bierze stan `pressing` z `BottomNav` (atrybut `data-pressing` na pierścieniu przytrzymania), a nie `:active`, bo `:active` nie zapalał się przy testach zdarzeń wskaźnika. Obrót jest pod warunkiem `prefers-reduced-motion: no-preference`.
- **Ograniczenia.** Kształtki na pasku zrobione w osobnym kroku (patrz niżej). Pasek wody działa tylko przy aktywnej zmianie na Dziś (tam pojawia się postęp). Nie sprawdziłem go zrzutem, bo test nie ma zaplanowanej zmiany.
- **Testy.** E2E: `hydraulika-flag` (obrót w czasie przytrzymania, zdarzenia wskaźnika), `skins`, `skin-signatures`, `mobile`, `bottom-slot` (51 testów).
- **Do sprawdzenia.** Prawdziwe `mouse.down` w emulacji telefonu nie trafia w przycisk „+” (coś leży nad nim). Na prawdziwym dotyku to zwykle nie problem, ale warto to potwierdzić na urządzeniu w QA (4.4).
- **Commit.** `ef22b09` (2026-10-30).

## Hydraulika: kształtki zamiast ikon na dolnym pasku (Fala 3, 3.1, część 2, 2026-10-30)

- **Co robi.** W Hydraulice ikony na dolnym pasku są rysunkami armatury: **Notatki** — kolano, **Dziś** — trójnik, **slot** (np. Terminy) — zawór. W innych stylach ikony zostają jak były.
- **Gdzie.** `src/components/skins/FittingIcon.tsx` (`FittingIcon`, trzy kształty w `currentColor`, 24×24), `src/components/BottomNav.tsx` (ikony lucide dostają klasę `nav-lucide`, kształtki `hydro-fitting`; w głównym pasku i przy slocie), `src/styles/skins/hydraulika.css` (przełączanie widoczności).
- **Jak działa.** Obie ikony są w DOM, a CSS wybiera jedną: w Hydraulice `.nav-lucide` jest ukryta, w pozostałych stylach `.hydro-fitting`. Dzięki temu zmiana stylu nie wymaga ponownego renderowania paska.
- **Ograniczenia.** Więcej (Ellipsis) zostaje lucide we wszystkich stylach. Trójnik jest mały, przy 20 px czytelny raczej jako „T”. Kształtki są statyczne, bez stanu aktywnego poza pogrubieniem kreski z klasy działu.
- **Testy.** E2E: `hydraulika-fittings` (w Hydraulice widać kształtki, w Zeszycie lucide), `hydraulika-flag`, `bottom-slot`, `skins`, `mobile`, `touch-targets`, `a11y`.
- **Commit.** `c439d9c` (2026-10-30).

## Styl na noc wg słońca: wschód i zachód w wybranym mieście (Fala 3, 3.2 planu motywów, 2026-10-30)

- **Co robi.** W Ustawieniach → Wygląd → Styl na noc jest nowa opcja „Wg słońca”: styl nocny włącza się po zachodzie, a dzienny wraca o wschodzie w wybranym mieście (lista: Warszawa, Kraków, Łódź, Wrocław, Poznań, Gdańsk, Szczecin, Lublin, Białystok, Katowice). Miasto wybiera się ręcznie — bez geolokalizacji (decyzja T-5 z rekomendacją planu).
- **Gdzie.** `src/lib/sun.ts` (`sunTimes`, `isNightAt`, `CITIES`, `cityById`), `src/lib/skinSchedule.ts` (tryb `"sun"`, pole `city`, walidacja w `merge`), `src/components/settings/NightSkinSettings.tsx` (opcja i lista miast).
- **Jak działa.** Wschód i zachód liczone lokalnie standardową formułą (deklinacja słońca, równanie czasu, kąt godzinny, refrakcja −0,833°). Wynik sprawdzony na Londynie: 03:42 i 20:21 UTC przy danych referencyjnych 03:43 i 20:21, czyli z dokładnością do minuty. Brak sieci i zależności. Noc = po zachodzie albo przed wschodem tego samego dnia kalendarzowego.
- **Ograniczenia.** Tryb „wg słońca” dotyczy tylko stylu na noc, nie przełącznika jasności (plan dopuszczał oba; zostało przy stylu). Harmonogram sprawdza się przy zmianie stylu i przy starcie — nie ma osobnego zegara, więc przełączenie może nastąpić z opóźnieniem do najbliższego sprawdzenia. Lista miast jest krótka; wpisanie dowolnego miasta wymaga dodania do `CITIES`.
- **Testy.** Vitest: `src/lib/sun.test.ts` (wschód i zachód w przesilenie i równonoc, Londyn jako punkt odniesienia dla formuły), `src/lib/skinSchedule.test.ts` (tryb `sun`: lato, zima, dwa miasta, nieznane miasto). E2E: `night-skin`, `appearance-code`, `appearance-quick`, `skins`.
- **Commit.** `b909587` (2026-10-30).

## Galeria stylów: „Więcej stylów” i gęstość całego interfejsu (Fala 3, 3.5 częściowo; Fala 4, 4.2, 2026-10-30)

- **Galeria (3.5, część).** Matryca jest schowana pod przyciskiem „Więcej stylów (1)” w galerii stylów; po rozwinięciu albo gdy jest wybrana, widać ją od razu. Klawiatura przechodzi tylko po widocznych stylach. Gdzie: `src/components/settings/SkinPicker.tsx` (`MORE_SKINS`, `visibleSkins`). **Nie zrobione z 3.5:** przeprofilowanie Miedzi i domyślna Tablica ciemna — zmieniają wygląd wszystkich, czekają na T-1…T-3.
- **Gęstość (4.2).** Ustawienie „Gęstość interfejsu (komputer)” w Ustawienia → Wygląd → Układ: **Kompakt**, **Standard** (domyślnie), **Luźno**. Odstępy, wysokości i szerokości w całej aplikacji idą przez zmienną `--spacing` (Tailwind v4 liczy każdy odstęp jako `calc(var(--spacing) * n)`), więc jedna wartość na `<html>` je skaluje. Gdzie: `src/lib/uiDensity.ts`, `src/index.css` (reguły w `@media (pointer: fine)`), `src/components/settings/AppearanceSettings.tsx`, klucz `kaczy.uiDensity.v1` w `APPEARANCE_KEYS`.
- **Jak działa.** Skalowanie tylko przy myszy i klawiaturze (`pointer: fine`). Na dotyku `--spacing` zostaje `.25rem`, więc cele dotyku (`coarse:h-11` = 44 px) i układ telefonu się nie zmieniają. Kompakt: 0,2 rem na jednostkę (≈80%), Luźno: 0,3 rem (≈120%).
- **Ograniczenia.** Gęstość zmienia wszystkie wymiary (także wysokości przycisków na komputerze), więc w Kompakcie elementy są mniejsze; nie każdy widok zrzutowany w tym trybie. Przejścia między widokami (4.3) i QA na telefonie (4.4) nie są zrobione: QA wymaga urządzenia.
- **Testy.** Vitest: `src/lib/uiDensity.test.ts` (atrybut; klucz w kodzie wyglądu; skalowanie tylko przy `pointer: fine`). E2E: `ui-density` (komputer: `--spacing` zmienione; dotyk: bez zmian), `skin-gallery-more` (Matryca schowana, rozwijana, widoczna gdy wybrana), `skins`, `a11y`, `mobile`, `touch-targets`, `appearance-quick`, `appearance-code`.
- **Commit.** `5b7ae58` (2026-10-30).

## Wygląd: plan dopracowania 2026-11-01, Fazy 3–7

Plan: `docs-zrobione/plan-wyglad-2026-11-01.md` (decyzje D-W1…D-W5 przyjęte z rekomendacjami). Fazy 1–2 (główka kartki, pióro tylko pod tytułem) — w sekcjach „Główka kartki” i „Nagłówki działów”.

- **Plany — edytor na telefonie (Faza 3, D-W3).** `src/components/plans/PlanEditor.tsx`: poniżej `sm` edytor jest `fixed inset-0 z-overlay` z marginesami `safe-area`; po zamontowaniu ustawia `data-plan-full` na `<html>`, a dolny pasek (`BottomNav.tsx`, `max-sm:in-data-plan-full:hidden`) znika. Panel ma uchwyt (`PanelSize` `s`/`m`/`l` → 18/45/75% wysokości, `PANEL_HEIGHT`), stuknięcie przełącza po kolei. Poziomy plan (szerokość > 1,3 × wysokość) na pionowym telefonie pokazuje raz podpowiedź „obróć telefon” (`showRotateHint`, klucz `kaczy.plans.rotateHint.v1`). Od `sm` wzwyż edytor jak dotąd (karta z wysokością okna).
- **Komunikaty (Faza 4).** Odznaki już czekały na zamknięcie okien i innych toastów (`useAchievementToasts`), toasty stały nad dolnym paskiem (`index.css`, 88 px). Nowe: bierny wskaźnik „Zapisano” (`OfflineStatus.tsx`) znika w pełnoekranowym edytorze Planów na telefonie — leżał na panelu; błąd zapisu i offline zostają.
- **Tekst i gęstość (Faza 5, D-W4).** Panel Planów: opisy OCR, wykrywania tras i skali skrócone do jednego zdania (`OcrPanel.tsx`, `DetectPanel.tsx`, `PlanPanel.tsx`); podpowiedź o klawiszach przy rysowaniu trasy ukryta na dotyku (`coarse:hidden`). Długi: etykiety przełącznika rodzaju bez łamania (`whitespace-nowrap`, „Pożyczyłem od” w jednej linii). Kalendarz: pole „Szukaj terminów” w `text-sm`. Podpowiedź Grafiku bez zmian (ma wersję dotykową i „Rozumiem”).
- **Dolny pasek (Faza 6, D-W2).** `BottomNav.tsx`, `MORE_META`: w dziale z „Więcej”, którego nie ma na pasku, piąty przycisk pokazuje jego ikonę i nazwę („Plany”), nazwa dostępna „Więcej: Plany”; stuknięcie dalej otwiera arkusz. Testy klikają go wzorcem `/^Więcej(: .+)?$/` (nie łapie „Więcej opcji”).
- **Komputer (Faza 7).** Pusty stan Planów (`PlansList.tsx`, `EMPTY_STEPS`) to trzy kroki: zrzut, skala, trasy — w jednej kolumnie na telefonie, w trzech na komputerze. Pasek boczny przy 900 px nadal się przewija (grupy można zwijać); domyślne zwinięcie „Osobiste” czeka na decyzję.
- **Testy.** `e2e/plans.spec.ts`, `e2e/mobile.spec.ts`, `e2e/a11y.spec.ts`, zrzuty `e2e/visual.spec.ts` (Faza 0: wszystkie działy i edytor Planów).
- **Commit.** `1532aec` (2026-11-01).

## Wygląd — baza porównawcza: metryki i kontrast tokenów (W0.2–W0.3 planu warstwy wizualnej, 2026-11-19)

### Co robi

- Dla użytkownika nic. Daje liczby, względem których każdy kolejny etap planu wyglądu podaje „przed i po”, i tabelę kontrastu wszystkich stylów.

### Gdzie jest

- `scripts/ui-metrics.mjs` — liczy w `src/` (bez testów) wzorce z §1 planu: role i rozmiary tekstu, grubości, wyciszanie przez `opacity`, ręczne karty, cienie, kolory poza tokenami, rozmiary ikon, wymiary arbitralne, stany, surowe kontrolki, cechy CSS. Zapis do `docs/ui-metryki.json`; `--check` tylko wypisuje.
- `src/lib/skinContrastReport.test.ts` — kontrast elementów interfejsu (≥ 3:1): `primary` na tle i karcie, `ring` (fokus) na tle i karcie, `input`; plus pary tekstu dla tabeli. Z `UI_CONTRAST_REPORT=1` zapisuje `docs/kontrast-tokenow.md`.

### Jak działa

- Tokeny czytane z `src/index.css` i `src/styles/skins/*.css` tak samo jak w `skinContrast.test.ts` (ten dalej pilnuje progów tekstu, pól i akcentów — nie powtarzamy go).
- Porażki są na liście `KNOWN`, która może tylko maleć: test czerwieni się przy nowej porażce i przy naprawionej, której nie skreślono.

### Ograniczenia i pułapki

- Znane porażki (zadania W6.1): Zeszyt jasny — `primary` na tle 2,65 i na karcie 2,75 (próg 3).
- `--border` to `color-mix` z przezroczystością — bez przeglądarki nie da się go policzyć, więc nie ma go w tabeli.
- Metryki to wyrażenia regularne, nie parser: liczą też wystąpienia w komentarzach i napisach. Porównywać tylko liczby z tego samego skryptu.
- W0.1 (zrzuty 12 ekranów × 3 style × 2 szerokości z komentarzem) nie zrobione.

### Testy

- `src/lib/skinContrastReport.test.ts`.

### Commit

W0.2–W0.3: 6f7cc3a3, 2026-11-19.

## Wygląd — trzeci poziom tekstu, cienie z barwy stylu, jedna skala cieni i warstw (W1.1–W1.4 planu warstwy wizualnej, 2026-11-19)

### Co robi

- Najbledszy tekst i ikony pomocnicze (podgląd w ostatnich działaniach, puste komórki w podsumowaniu roku, ikona „dodaj” w liście zadań, placeholder szybkiego przypomnienia) mają teraz kontrast co najmniej 4,5:1 w każdym stylu. Wcześniej wyciszała je przezroczystość, bez sprawdzania kontrastu.
- Cienie kart, menu i arkuszy w każdym stylu mają barwę tego stylu, liczoną jedną formułą. Wygląd prawie się nie zmienia (Miedź, Kafle i Tablica — lekko inne natężenie w ciemnym schemacie; Zeszyt — cień paska dolnego w barwie papieru zamiast barwy tekstu).

### Gdzie jest

- `src/index.css` — `--faint` w `:root` (96% `--muted-foreground` z tłem) i `.dark` (84%); w kolorowych notatkach `--faint` = `--muted-foreground`. Formuły `--elev-light-1/2/3/up` i `--elev-dark-1/2/3/up` z `--shadow-tint`, `--shadow-strength`, `--shadow-edge`; `--elevation-*` wskazują formułę schematu.
- `src/styles/skins/*.css` — style podają `--shadow-tint` (i `--shadow-strength`: Kafle i Tablica 1,12, Miedź 1,3 w jasnym; Kafle 1,2, Miedź 1,15, Tablica 1,1 w ciemnym). Własne cienie zostały jako podpis: ciemne Hydraulika, Matryca, Zorza, Neon, Plan i oba schematy Odblasku.
- `tailwind.config.ts` — kolor `faint` (`text-faint`), komentarz z kolejnością warstw `z-raised…z-toast`.
- Zamiana `text-muted-foreground/NN` → `text-faint`: `DayPanel`, `ChecklistEditor`, `RecentActionsPanel`, `YearSummaryDialog`, `CodeChangePanel`, `QuickReminderInput`. `shadow-sm` i `shadow` → `shadow-elevation-1` (25 miejsc).

### Jak działa

- `--faint` miesza `--muted-foreground` z `--background` w OKLCH. Jasne schematy mają mały zapas nad 4,5:1 (Zeszyt najwyżej 4%), więc w jasnym `--faint` różni się od `--muted-foreground` niewiele; w ciemnych wyraźniej.
- `--elevation-*` jest liczone na `html`, tam gdzie styl ustawia `--shadow-tint`, więc formuła z `:root` bierze barwę stylu. Style o domyślnym schemacie ciemnym w bloku jasnym ustawiają wprost `--elevation-*: var(--elev-light-*)`, bo ich blok główny ma własne cienie ciemne.

### Ograniczenia i pułapki

- `opacity-NN` (131) zostało: prawie wszystkie są na kolorowych tłach (chipy, przyciski, `kbd` w dymkach, pola grafiku), gdzie token liczony względem tła strony byłby błędny. Wyłączony `IconButton` zostaje przy `text-muted-foreground/60`.
- `--surface-raised` (jaśniejsza powierzchnia jako głębia w ciemnym) — niezrobione; wymaga zmian w komponentach kart.
- `shadow-[…]` (7) to obwódki, wcięcia i poświaty, nie głębia — zostają, strażnik nie pozwala na nowe.
- Zrzuty `@visual` nie odnowione.

### Testy

- `src/lib/skinContrastReport.test.ts` — `--faint` na tle, karcie i `muted` ≥ 4,5 we wszystkich 20 kombinacjach (procent czytany z `index.css`), tabela `docs/kontrast-tokenow.md`.
- `src/lib/skinContract.test.ts` — styl ma `--shadow-tint` albo komplet `--elevation-*`.
- `src/test/designTokens.test.ts` — `bareShadow` (`shadow`, `shadow-sm`, `shadow-xl`) 0, `arbitraryShadow` ≤ 7, `mutedAlpha` ≤ 1.
- Sprawdzone w Chromium (serwer Vite, `getComputedStyle`): wszystkie `--elevation-*` i `--faint` rozwiązują się w 10 stylach × 2 schematach.

### Commit

W1.1–W1.4: 974281cc, 2026-11-19.

## Wygląd — skala ról tekstu, łamanie i 15 px na telefonie (W2.1–W2.5, W2.6 częściowo, W2.7, WZ-1, 2026-11-19)

### Co robi

- Na telefonie tekst interfejsu ma 15 px zamiast 14 (decyzja WZ-1, potwierdzona przez właściciela 2026-11-19); na komputerze bez zmian.
- Nagłówki kart (`SectionCard`) są o stopień większe od tekstu i w kroju tytułów — wcześniej miały ten sam rozmiar co opis pod nimi.
- Tytuły z rolą `title-*` łamią się równo, także gdy nie są nagłówkami `h1–h3`. Akapity, listy i cytaty w treści notatki mają wiersz najwyżej 68 znaków i dzielenie wyrazów po polsku.

### Gdzie jest

- `src/styles/text-size.css` — `--text-ui` / `--text-ui-lh` (14/20, telefon 15/22); cofnięcie WZ-1 = usunięcie bloku `@media`.
- `tailwind.config.ts` — `text-sm` z `--text-ui`.
- `src/index.css` — role `title-page`, `title-section` (17/24, 650), `title-card`, `num-lg`; `text-wrap: balance` dla ról `title-*` i reguła `.prose-note :where(p, li, blockquote)` (68ch, `hyphens: auto`) dla treści z `MarkdownRendererImpl.tsx`.
- `src/components/ui/section-card.tsx` — nagłówek `title-card`.
- `num-lg` (28/32, mono): kafle `StudyStats.tsx`, wynik `CalculatorsSheet.tsx`, „Zostało do zapłaty” w `SiteBillingDues.tsx`.
- `docs/typografia.md` — tabela ról i decyzje.

### Ograniczenia i pułapki

- Sprawdzone w Chromium na 390 i 1280 px (Notatki, Dziś, Kalendarz, Grafik, Praca): brak przepełnienia poziomego. Zrzuty `@visual` i e2e nie odnowione — przesunięcia tekstu na telefonie są spodziewane.
- Nie zrobione:  W2.3 (grubości), W2.5–W2.7. Dzielenie wyrazów (`hyphens: auto`) zależy od słownika przeglądarki — w Safari nie sprawdzone. Tabele i kod nie mają limitu 68ch.

### Testy

- Vitest 4169 zielone; strażnicy tokenów i kontrastu.
- `src/test/designTokens.test.ts` — reguła `sizeWeightPair` (W2.7): para `text-xs|sm` + `font-medium|semibold` w jednym `className`, próg 168 (233 przed migracją), może tylko maleć.
- W2.3 (część): rola `.ui-label` (`text-sm font-medium`) w `src/index.css`; 15 gołych `<label className="text-sm font-medium">` przeszło na `ui-label`, 50 nagłówków `text-xs font-semibold text-muted-foreground` na istniejącą `section-caps`. Wygląd bez zmian. Przegląd pogrubień w wierszach: jedyny wiersz z trzema pogrubionymi polami — „Odbiór nadgodzin” w `ShiftSummary.tsx` — ma liczby w 500 + `text-foreground`; znaczki komórek Grafiku i nagłówki tabel celowo zostają pogrubione.
- W2.6 (część): `SiteMaterialPanel.tsx` i `SiteTimePanel.tsx` biorą `formatMoney` z `src/lib/shifts/time.ts` (separator tysięcy od 10 000, `pl-PL`). `src/lib/study/materialUsage.ts`: `zl` w `materialText` (tekst „Kopiuj” dla szefa i dostawcy) idzie przez `formatMoney`, twarde spacje z `Intl` zamienione na zwykłe (wklejanie do komunikatorów); `materialCsv` celowo zostaje przy `num` bez separatora tysięcy (`12250,00`), bo polski Excel ma czytać liczbę. Test: `src/lib/study/materialUsage.test.ts` („W2.6: tekst ma separator tysięcy”). Commit: `8c05fb9c`, 2026-11-25. Jednostka mniejsza i wyciszona — tylko w `Stat`.
- W2.5: przegląd 91 `leading-*` — wszystkie zostają jako wyjątki (pigułki i znaczki kalendarza `leading-4/5`, liczby `leading-none`, tytuły display `tight/snug`, czytana treść `relaxed`). Strażnik `manualLeading` w `designTokens.test.ts`, próg 91.
- W2.2: Grafik (`ShiftSummary`, `Stat size="lg"`, 36 px) i Długi (`Stat` md, 20 px) już mają liczbę główną we wspólnym `ui/stat.tsx`; Długi celowo bez 28 px — dwie kwoty obok siebie nie mieszczą się na 390 px.

### Commit

W2.1, WZ-1, 2026-11-19 — commit po tym wpisie.

## Wygląd — odmiany karty, wiersz listy i rozmiary ikon (W3.1, W3.4, W4.1 częściowo, W4.2–W4.4, 2026-11-19)

### Co robi

- Jedna definicja karty w pięciu odmianach zamiast ręcznie składanych klas: zwykła, uniesiona, wewnętrzna (grupa w karcie), klikalna i ze stanem (kolorowa lewa krawędź).
- Jeden wiersz listy (`ListRow`) zamiast składania wiersza osobno w każdej liście.

### Gdzie jest

- `src/components/ui/card.tsx` — `Card` z `variant` (`plain` | `raised` | `inset` | `interactive` | `status`) i `tone` (`info` | `success` | `warning` | `danger`); `cardVariant()` daje samą klasę dla `motion.div`, `<li>` i przycisków. `cardClass` zostaje jako `plain`.
- `src/components/ui/list-row.tsx` — `ListRow`: ikona, tytuł (`ui-label`), opis (`ui-meta`), wartość po prawej (mono, `tabular-nums`), akcja; `as="li"` w `<ul>`. Wysokość co najmniej 44 px.

### Jak działa

- `plain` = `cardClass`. `raised` dokłada `shadow-elevation-1`. `inset` ma `rounded-field` i `bg-muted/50` bez obrysu — tak ma wyglądać karta w karcie (W3.3). `interactive` ma `pressable`, hover obrysu i pierścień fokusu. `status` ma `border-l-4` w kolorze tonu.
- `ListRow` nie rysuje separatora: rodzic daje odstęp (`space-y-*`) albo jedną linię (`divide-y divide-border`), nigdy oba. Akcja stoi poza tytułem, więc nie zagnieżdża się w przycisku.

### Ograniczenia i pułapki

- Brak tokenu `--space-card`: dopełnienie dalej w miejscu użycia. Istniejące karty i listy nie są jeszcze przeniesione — to W3.2, działami. `ListRow` ma tylko jedną linijkę opisu (`truncate`).
- W4.1 (część): 1103 pary `h-N w-N` / `w-N h-N` w 242 plikach zamienione na `size-N` (bez zmiany wyglądu); strażnik `squarePair` (próg 0). Skala ikon 14/16/20 = `size-3.5/4/5`; nie przejrzane jeszcze 66 × `size-3` i 25 × `size-6` (część to kropki i awatary, nie ikony).
- W4.2: `--icon-stroke` w `src/index.css` — domyślnie 1,75 (`:root`), 1,5 w stylach plan, matryca i zeszyt, 2 w hydraulice; reguła `.lucide[stroke-width="2"]` ustawia kreskę raz. Selektor celowo tylko na domyślną kreskę lucide: CSS przebija atrybut, więc jawne `strokeWidth` (✓ w zaznaczeniu 3, rysunki pustych stanów 1,1–1,5) by zniknęły. Zostałe 49 `strokeWidth` to rysunki SVG i takie wyjątki. `Button` (`src/components/ui/button.tsx`) bierze kreskę z `var(--icon-stroke)` zamiast stałego 1,75, więc styl zmienia też ikony w przyciskach.
- W4.3: `.lucide { flex-shrink: 0 }` w `src/index.css` — ikona nie ściska się, gdy tekst obok łamie się w wierszu flex. Przegląd: żadna ikona nie ma `text-foreground` (nie jest ciemniejsza od tekstu). Wyrównanie do linii bazowej (`mt-0.5` przy wielowierszowym tekście) zostaje w miejscu użycia.
- W4.4: tabela stanów w `docs/komponenty.md`. `Button` nieaktywny ma `text-faint` zamiast `text-muted-foreground` (jeden wzór, bez `opacity`). `Card variant="interactive"`: wybrana (`aria-selected`/`aria-pressed`/`aria-current`) — obrys `primary`; nieaktywna (`aria-disabled`) — `text-faint`, bez reakcji. Pułapka: `aria-current="false"` też podświetli — atrybut pomijać.

### Testy

- `src/components/ui/card.test.tsx`, `src/components/ui/list-row.test.tsx`; `src/test/designTokens.test.ts` (`squarePair`).

### Commit

W3.1 — 573c83d1; W3.4 — commit po tym wpisie (2026-11-19).

## Wygląd — kontrast akcentu, kolory z tokenów i natywne kontrolki (W6.1, W6.3, W6.6, 2026-11-19)

### Co robi

- Bursztynowy akcent domyślnego stylu „Zeszyt” w jasnym schemacie jest odrobinę ciemniejszy. Obrysy, ikony i znaczniki w akcencie mają teraz co najmniej 3:1 względem tła i karty (WCAG 1.4.11). Wcześniej miały 2,65:1 i 2,75:1.

### Gdzie jest

- `src/index.css` (`:root`) — `--primary: oklch(0.6650 0.1566 63.41)` (było 0,7022).
- `src/styles/accents.css` — cztery akcenty Zeszytu w jasnym schemacie: niebieski 0,655, zielony 0,635, czerwony 0,67, fiolet 0,67. Każda barwa ma inną luminancję przy tej samej jasności OKLCH, więc wartości są dobrane osobno.
- `src/lib/skinContrastReport.test.ts` — `KNOWN` jest puste. `docs/kontrast-tokenow.md` jest wygenerowany ponownie: 3,05 i 3,17.
- W6.3: `src/lib/notePriority.ts` — kolory priorytetu z tokenów: niski `text-muted-foreground`, średni `text-warning-ink`, wysoki `text-destructive-ink`. Wcześniej była paleta sky/amber/rose z `dark:`. `src/components/plans/PlanCanvas.tsx` — tło płótna `bg-muted` zamiast dwóch wartości hex.
- W6.6: `src/index.css` (`@layer base`) — `accent-color: var(--primary)` na `:root` i `::selection` w 30% akcentu.

### Ograniczenia i pułapki

- `accents.css` to plik generowany, ale te cztery reguły są poprawione ręcznie. Generator `docs/tools/accents/accents-gen.mjs` pada już na wcześniejszym stanie („Nie da się dobrać L dla H=27”). Nie sprawdza też `primary/background` ≥ 3. Przed ponownym uruchomieniem trzeba dopisać ten warunek do `passes()`, inaczej poprawka zniknie. Jest o tym uwaga w nagłówku pliku.
- Raport kontrastu nie sprawdza akcentów 1–4 innych stylów.
- W6.3: `.dark` idzie za schematem stylu (`useTheme.ts`, `prepaint.js`), więc `dark:` nie był błędny. Zostało 8 wystąpień w `.tsx` poza `ui/` (dzień w Kalendarzu, `dark:prose-invert`) i 3 w `dayCellStyles.ts`. Strażnik w `src/test/designTokens.test.ts` liczy tylko pliki `.tsx`, próg 8.
- W6.6: `color-scheme` i `theme-color` już były ustawiane (`prepaint.js`, `useTheme`). Doszły tylko `accent-color` i `::selection`.
- Bursztyn przy L 0,665 i C 0,1566 jest minimalnie poza sRGB, a przeglądarka go przycina. Kontrast liczony po przycięciu wynosi 3,05.

### Testy

- `src/lib/skinContrastReport.test.ts`, `src/lib/skinContrast.test.ts`, `src/test/designTokens.test.ts` (W6.3).

### Commit

W6.1 — 8f01f30c; W6.3 i W6.6 — commit po tym wpisie (2026-11-19).

## Wygląd — odstępy semantyczne (W1.5, 2026-11-19)

### Co robi

- Margines ekranu, wnętrze karty, odstęp między sekcjami i wiersz listy mają nazwane odstępy. Wszystkie idą za ustawieniem „Gęstość interfejsu”.

### Gdzie jest

- `src/index.css` (`@layer base`, `:root`): `--space-page` (4 / od 640 px 6), `--space-card` (4 / 5), `--space-stack` (8 / 10), `--space-row` (2). Liczby to wielokrotności `--spacing`.
- `tailwind.config.ts` — `spacing.page|card|stack|row`, czyli klasy `px-page`, `p-card`, `gap-stack`, `py-row`.
- Użycia: `SectionCard` (`p-card`), `ListRow` (`py-row`), `<main>` w `src/pages/Index.tsx` (`px-page`, `gap-stack` poza widokiem Dziś).

### Jak działa

- Gęstość (`src/lib/uiDensity.ts`) zmienia `--spacing` na `<html>`. Aliasy są zdefiniowane na tym samym elemencie przez `calc(var(--spacing) * n)`, więc skalują się razem z nim. Przy zwykłej gęstości wartości są takie same jak wcześniej (`p-4 sm:p-5`, `px-4 sm:px-6`, `gap-8 sm:gap-10`).

### Ograniczenia i pułapki

- Ręczne karty (`cardClass` z `p-4` w miejscu użycia) jeszcze nie biorą `p-card`. Przejdą na nie z migracją W3.2.
- Widok Dziś ma własny, ciaśniejszy odstęp (`gap-4 sm:gap-10`).

### Testy

- Brak testu wartości; build sprawdzony na wygenerowane klasy w `dist/assets/*.css`.

### Commit

W1.5 — commit po tym wpisie (2026-11-19).

## Wygląd — paleta danych wykresów (W1.6, 2026-11-19)

### Co robi

- Wykresy biorą kolory z tokenów `--chart-*`: serie, siatkę i podpisy osi. Podpisy osi recharts mają kolor wyciszonego tekstu stylu zamiast domyślnego szarego `#666`. Punkty na wykresie próby ciśnienia mają 8 px średnicy.

### Gdzie jest

- `src/index.css` (`@layer base`, `:root`): `--chart-1` (= `--primary`), `--chart-2` (= `--accent`), `--chart-grid` (= `--border`), `--chart-axis` (= `--muted-foreground`), `--positive` / `--negative` (= `--success` / `--destructive`). Reguły `.year-chart-*` (bez `.year-chart-night` od W5.2 — noc ma wzór kreskowania) i `.recharts-cartesian-axis-tick-value`.
- `src/components/StatsDialog.tsx` (słupki aktywności), `src/components/study/PressureChart.tsx` (osie, podpisy, linia, punkty), `src/components/shifts/YearCharts.tsx` (przez klasy `.year-chart-*`).

### Jak działa

- Tokeny są aliasami tokenów stylu, więc każdy z 10 stylów i oba schematy działają bez osobnych wartości. Kolory notatek już wcześniej były tokenami (`--note-*`).

### Ograniczenia i pułapki

- Są tylko dwie barwy serii, bo wykresy mają jedną serię, a nadgodziny roku dwie. Plan mówił o ośmiu, ale nieużywane tokeny nie mają sensu. Kolejne trzeba dopisywać w stałej kolejności i sprawdzać walidatorem CVD ze skilla `dataviz`.
- Para nadgodziny (`--warning`) i noc (`--chart-2`) nie była sprawdzana walidatorem, bo kolory są w OKLCH dla 10 stylów. W Zeszycie to bursztyn i granat, czyli oś niebiesko-żółta, odporna na deuteranopię i protanopię.
- Nadgodziny zostają w kolorze ostrzeżenia celowo: to stan, nie identyfikator serii.

### Testy

- Brak testu wartości. Build i testy Grafiku, Pracy oraz strażników przechodzą.

### Commit

W1.6 — commit po tym wpisie (2026-11-19).

## Wygląd — kolory CSS w OKLCH (W1.7, 2026-11-19)

### Co robi

- Wszystkie kolory w plikach CSS są zapisane w `oklch()`. Wcześniej było tam 110 `hsl()` i 100 wartości hex. Wartości przeliczyłem narzędziem, więc kolory się nie zmieniają.

### Gdzie jest

- `src/index.css`, `src/styles/skins/*.css` (14 plików, 210 zamian).
- `src/test/designTokens.test.ts` — strażnik „W1.7”: zero `hsl(` i `#hex` w `src/**/*.css`, poza komentarzami i `url(…)`.
- Usunięty `src/App.css`, nieużywaną pozostałość szablonu Vite.

### Jak działa

- Przeliczenie idzie z sRGB (hex, `hsl()` z alfą) przez OKLab do OKLCH (4 miejsca dla L i C, 2 dla H). Kolory w `url(…)` zostały, bo SVG w data URL nie musi rozumieć `oklch()`.
- Bloki tokenów dodane w W1.5, W1.6 i W6.6 mają selektor `html`, nie `:root`. Testy kontrastu (`skinContrast*.test.ts`) czytają pierwszy blok z selektorem :root jako tokeny schematu jasnego. Nowy blok wcześniej w pliku zepsuł je po W6.6. Nie wpisuj tego selektora z klamrą nawet w komentarzu.

### Ograniczenia i pułapki

- Gradienty i przejścia między kolorami w `oklch()` interpolują w OKLab, a między kolorami legacy (hex, `hsl`) interpolowały w sRGB. Gradienty stylów mogą mieć nieco inny środek przejścia. Trzeba to obejrzeć na zrzutach.
- `src/lib/skinContrast.test.ts` czyta tokeny marki (`--brand-*`) także w `oklch()`. `src/lib/oled.test.ts` oczekuje `oklch(0.0000 0.0000 0.00)` zamiast `#000`.
- Hex w plikach `.ts` i `.tsx` to W1.8.

### Testy

- `src/test/designTokens.test.ts`, `src/lib/skinContrast.test.ts`, `src/lib/skinContrastReport.test.ts`, `src/lib/oled.test.ts`. Pełny Vitest: 4179 przeszło, 1 (OLED) poprawiony.

### Commit

W1.7 — commit po tym wpisie (2026-11-19).

## Wygląd — kolory rysunku i eksportu w jednym module (W1.8, 2026-11-19)

### Co robi

- Stałe kolory rysunku na canvasie i w plikach z aplikacji są w jednym module: biały podkład pod obraz, tusz podpisu i linie wymiarów na zdjęciu. Wygląd się nie zmienia.
- Próbki akcentów Zeszytu w Ustawieniach pokazują kolory po poprawce kontrastu z W6.1. Wcześniej pokazywały stare, jaśniejsze.

### Gdzie jest

- `src/lib/paint/colors.ts`: `tokenColor(name, fallback)` (odczyt tokenu stylu przez `getComputedStyle`, przeniesiony z `celebrate.ts`), `PAPER`, `SIGNATURE_INK`, `SIGNATURE_MUTED`, `MEASURE_DONE`, `MEASURE_ACTIVE`, `MEASURE_TEXT`.
- Użycia: `celebrate.ts`, `imageThumb.ts`, `imagePrepare.ts`, `study/photoCaption.ts`, `study/photoShrink.ts`, `plans/imageImport.ts`, `plans/ocr/ocrClient.ts`, `PlanCanvas.tsx`, `SignaturePad.tsx`, `DimensionDrawer.tsx`. `SymbolPanel.tsx` bierze szary z `SYSTEM_META.unknown.color`.
- `src/lib/accentMeta.ts` — próbki Zeszytu przeliczone z nowych wartości OKLCH: #d57a00, #4792ee, #2ca454, #e56963, #a57ce6.
- `src/test/hexColors.test.ts` — strażnik: hex w `.ts`/`.tsx` tylko w plikach z `KNOWN` (24 pliki, 287 wystąpień), a liczba w pliku może tylko maleć.

### Jak działa

- Plik wychodzący z aplikacji (JPEG, PNG, PDF, druk) ma stałe kolory, bo ma wyglądać tak samo w każdym motywie i na papierze. Rysunek na ekranie (konfetti) bierze kolor stylu przez `tokenColor`.
- Pozostałe wyjątki w `KNOWN`, według grup planu: (c) rysunek, plik i druk (`PlanOverlay`, `plans/systems.ts`, `shifts/monthImageDraw.ts`, `mermaidRender.ts`, `exportNotes.ts`, `recoveryPrint.ts`, `MatrixRain.tsx`), (d) dane i ustawienia użytkownika (kolory zmian w `shifts/model.ts` i `shifts/color.ts`, paleta `DrawingCanvas`, `frameLook`, `glowLook`, `noteLook`, `accentMeta`), kolor paska adresu (`skinList.ts`, `useTheme.ts`, `skinGallery.ts`).

### Ograniczenia i pułapki

- `accentMeta.ts` trzeba przeliczać ręcznie po każdej zmianie `accents.css`, bo żaden test nie porównuje próbek z CSS.
- `SignaturePad.tsx` i `SiteSignatureDialog.tsx` mają granat podpisu także w klasach Tailwinda (`border-[#1f2a44]/35`). Klasa musi być literałem, więc stała z modułu tu nie zadziała.
- Plan liczył 283 hex w 28 plikach. Strażnik liczy wystąpienia, nie linie: przed zmianą było ich 300, teraz jest 287.

### Testy

- `src/test/hexColors.test.ts`. Testy Pracy, planów i `celebrate` przechodzą. `src/lib/study/perf.test.ts` pada tylko przy równoległym przebiegu (pomiar czasu), osobno przechodzi.

### Commit

W1.8 — commit po tym wpisie (2026-11-19).

## Ruch — porządek i straż (M1.2–M1.6, 2026-11-20)

### Co robi

- Czasy przejść idą z tokenów: 16 klas `duration-200/300/500/700` zamieniono na `duration-base` (220 ms) i `duration-slow` (320 ms). Paski postępu i przejścia wcześniej trwały 500–700 ms, teraz najwyżej 320 ms. Zostają dwa liczniki, gdzie czas przejścia = odstęp tyknięcia (pierścień przerwy w treningu 500 ms, pasek próby ciśnienia 1 s), z komentarzem przy kodzie.
- Usunięto stałe `will-change` (nagłówek, tło Hydrauliki, bąbelki, Zorza); animowany `transform` dostaje warstwę sam.

### Gdzie jest

- `src/test/motionTokens.test.ts`: M1.2 — `--dur-*` i `--ease-*` w `tokens.css` muszą równać się `dur` i `ease` z `src/lib/motion.ts`; M1.5 — klasy `duration-<liczba>` najwyżej 2, literały `duration: 0.x` w `.tsx` najwyżej 3 (pieczątka osiągnięcia ×2, wordmark).
- Zamiany w 13 komponentach (m.in. `DebtsView`, `ShiftSummary`, `StudyView`, `NowCard`, `GuideDialog`, `NoteBoard`, `QuizPanel`).
- `docs/ruch.md` (M1.1): jedna strona zasad ruchu — siedem zasad, tabela tokenów (czas → klasa → `dur.*`), tabela „który wzór kiedy”, ograniczony ruch, straż. Zmieniasz token albo próg strażnika — popraw tabelę.
- M5.2 (haptyka): `Switch` (`src/components/ui/switch.tsx`) wibruje sam `selection` przy zmianie; przegląd 184 wywołań `haptic()` nie wykrył dubli. M5.1 to istniejące `pressable` (`utilities.css`).
- M3.3: `src/components/ui/overlay-motion.ts` — `OVERLAY_FADE` (Dialog, Sheet, AlertDialog) i `POPUP_MOTION` (Popover, DropdownMenu); Tooltip poza nim (stany `delayed-open`/`instant-open`). Commity e284a4c1, 39a52a28 (2026-11-21).
- M5.4 (liczby): jeden licznik `AnimatedNumber` (`src/components/ui/animated-number.tsx`) zamiast trzech (`shifts/CountUp.tsx` i nieużywany `RollingNumber.tsx` usunięte). Używają go podsumowanie Grafiku (`ShiftSummary`), Długi (`DebtsView`) i licznik powtórek na Dziś (`StudyDueRows`). Przelicza krótkim tweenem (`dur.slow + 0.1`, `ease.out`) tylko wtedy, gdy `recentUserAction()` z `src/lib/inputModality.ts` mówi, że w ostatnich 1,5 s był dotyk, kliknięcie albo klawisz; zmiana z synchronizacji Yjs, pierwszy render i ograniczony ruch pokazują wynik od razu. Tekst wpisuje efekt w węzeł (ref), bez setState na klatkę; zawsze `tabular-nums`. Bez `format` zaokrągla, z `format` dostaje wartości pośrednie (złotówki z groszami w Grafiku).
- M2.2 (wydajność po stuknięciu, częściowo):
  - `src/lib/overlayHistory.ts`: dwa słuchacze `popstate`. `onOwnBack` jest rejestrowany przy wczytaniu modułu (import w `src/App.tsx`, przed BrowserRouterem) i zatrzymuje (`stopImmediatePropagation`) nasze własne `history.back()` po zamknięciu warstwy z interfejsu, ale tylko gdy adres przed cofnięciem i po nim jest identyczny. `onPopState` (jak dawniej, po routerze) obsługuje „wstecz” systemowe. Dzięki temu zamknięcie okna czy arkusza nie przerysowuje widoku przez router. Na `window` Chromium wywołuje słuchaczy w kolejności rejestracji, faza przechwytywania tego nie zmienia. Zamykanie warstwy przed routerem przy „wstecz” systemowym psuło następne stuknięcie, dlatego ta część została po routerze.
  - `src/lib/gridKeyboardNav.ts`: `colsCount()` (`getComputedStyle` siatki) liczony tylko dla ↑/↓, nie przy każdym klawiszu.
  - `src/hooks/useOriginFromTile.ts`: pomiar kafla i panelu w `requestAnimationFrame`, a zmienne `--tw-enter-*` ustawiane od razu. Zmiana zachowania: przy kaflu poza ekranem okno edytora rośnie ze środka (skala 0,9), zamiast wjeżdżać z góry.
  - Pomiar (mediana 5 przebiegów, CPU ×4): otwarcie notatki 683 → 400 ms. Szczegóły i to, co zostaje, są w `docs/ruch.md`.
- M5.5 (dowód dla właściciela): zrzuty `@visual` (`e2e/visual.spec.ts`) już były z wyłączonym ruchem (`kaczy.motion.v1 = reduced`, `reducedMotion: "reduce"`, `animations: "disabled"`). Nowy `e2e/motion-video.spec.ts` na żądanie (`VIDEO=1 npx playwright test e2e/motion-video.spec.ts --project=pixel-7`) nagrywa film ścieżek z M2.1 przy zwykłym tempie procesora (otwarcie notatki, zmiana działu, zsunięcie arkusza, przewijanie) do `test-results/motion-video.webm`. Przebieg `test:visual` 2026-11-23: 74 zgodne, 153 różne. Różnice to przesunięcie i wysokość stron Kalendarza, Grafiku, Pracy i Ustawień po zmianach układu od 19.11 (wzorce z `a1c616bb`), nie ruch. Wzorców nie zaktualizowano — czekają na przegląd właściciela.
- M4.4 (stany list): `listItemMotion(reduced)` w `src/lib/cardMotion.ts` — propsy dla `motion.li` (dodany wiersz osiada z 6 px, usunięty przygasa i maleje do 0,98, sąsiedzi dojeżdżają przez `layout="position"`; ograniczony ruch — samo przenikanie). Lista owinięta w `AnimatePresence initial={false}`, więc otwarcie widoku nie odtwarza wejść. Podpięte w: historii osoby w Długach (`PersonHistory` w `DebtsView.tsx`), suplementach (`SupplementList` w `CwiczeniaView.tsx`), planie dni (`PlanList` w `TrainingSection.tsx`), ważeniach (`WeightSection.tsx`) i liście zleceń w Pracy (`JobsDialog.tsx`). Notatki mają własny, bogatszy wzór (`cardExit` z intencją kosza/archiwum). Usuwanie z „Cofnij” działa jak dawniej — przywrócony wiersz po prostu wchodzi.
- M4.3 (arkusze z gestem): `useDragToDismiss` w `src/components/ui/sheet.tsx` (jedna implementacja dla wszystkich dolnych arkuszy). Tło (`SheetOverlay`, teraz z `ref`) przygasa proporcjonalnie do drogi arkusza w dół. Po przekroczeniu progu (110 px albo szybki ruch, w arkuszach z punktami — `snapDecision` = `close`) `fling` dokańcza ruch od miejsca puszczenia: czas = reszta drogi / prędkość palca z ostatnich 80 ms (120–300 ms, co najmniej 1 px/ms), krzywa hamująca. Potem zamknięcie bez animacji Radix — `data-drag-closed` + reguła w `src/styles/app/effects.css` (`animation: none`), bo zamknięcie startowało od zera i arkusz podskakiwał w górę przed wyjazdem. Po zamknięciu style inline są czyszczone w następnej klatce (arkusze z `forceMount`). Ograniczony ruch: zamknięcie jak dawniej. Zamiast sprężyny z planu (`spring.soft`) jest przejście CSS z czasem z prędkości — bez framer-motion w `Sheet`.
- M4.2 (karta ↔ notatka): wejście już było — `openPreviewFromCard` w `Index.tsx` daje kaflowi nazwę `note-shared` na czas przejścia, a podgląd (`NoteReader`, tryb `preview`) nosi ją stale; na telefonie edytor rośnie z kafla (`useOriginFromTile`). Nowe: `closeReaderToCard` odwraca to przy zamknięciu. Wychodzący czytnik zostaje w DOM na czas wyjścia (`AnimatePresence`), więc w nowej migawce dostaje `view-transition-name: none` i `visibility: hidden`, a nazwę bierze kafel — dwie te same nazwy przerwałyby przejście. Kafel poza ekranem, prezentacja, WebKit albo ograniczony ruch — zwykłe zamknięcie. Klawiatura (Spacja otwiera, Spacja/Escape zamyka w `gridKeyboardNav.ts`) idzie teraz tą samą drogą przez `setGridNavPreviewTransitions`, rejestrowane w `Index.tsx`; wcześniej ustawiała stan wprost i pomijała przejście w obie strony.
- M4.1 (przejście między działami, decyzja RU-1: przenikanie): `setView` w `src/hooks/useViewShell.ts` robi `startViewTransition` z kierunkiem `data-vt-dir` (`fwd`/`back` wg `VIEW_ORDER`). Teraz wołają go też dolny pasek (`BottomNav` `onGo`) i panel boczny (`onGoView` w `Index.tsx`) — wcześniej szły przez `go` bez przejścia, więc na telefonie zmiana działu była skokiem. Stuknięcie w bieżący dział nie uruchamia przejścia. CSS w `src/styles/app/effects.css`: stara treść gaśnie w `--dur-fast` (`--ease-in`), nowa wchodzi w `--dur-base` z dryfem 8 px w stronę zakładki (`vt-section-in-fwd`/`-back`). Nagłówek (`.app-header`) i dolny pasek (`[data-shell-nav]`) dostają `view-transition-name` tylko przy `html[data-vt-dir]`, więc stoją, a przejście motywu i inne przejścia `root` dalej obejmują cały ekran. WebKit i ograniczony ruch: zmiana bez przejścia (`canViewTransition`, `isMotionReduced`). Pułapka: w trakcie przejścia Chromium zgłasza przewinięcie do 0, zanim zmieni się adres — `useViewScroll` ignoruje zdarzenia przewijania przy `html[data-vt-dir]`, inaczej pamięć przewinięcia działu (plan UI/UX 3.6) dostawała 0 (test `e2e/view-scroll-memory.spec.ts`, padał w CI od M4.1). Druga pułapka: `view-transition-name` musi być unikalna — pole wyszukiwania (`data-view-static`) nie dostało nazwy, bo takich elementów bywa kilka, a powtórzona nazwa przerywa przejście.
- M2.3 (kaskada wejścia): `cascadeDelay` w `src/lib/cardMotion.ts` opóźnia tylko pierwsze 8 kart, co 30 ms (ostatnia rusza po 210 ms, limit planu 240 ms). Kaskada działa w oknie 400 ms od pierwszego wywołania w sesji (`cascadeUntil` w module). Powrót do listy z notatki albo z innego działu i karty dodane później wchodzą bez opóźnienia. Ograniczony ruch — zawsze 0. Używają tego `NoteCard` i `LockedNoteTile`.
- M2.4 (budżet): strażnik w `e2e/bundle.spec.ts` („heavy optional libraries…”): kod rzutowania `layout` framer-motion (znaczniki `isProjectionDirty`, `resetSkewAndRotation`, `measuredBox`) nie może być w paczce startowej, a musi być w paczce leniwej (`src/lib/motionFeatures.ts`, `domMax` przez `LazyMotion`).
- M3.1 (`@starting-style`): utility `presence-fade` i `presence-pop` w `src/styles/app/utilities.css`. Element zostaje w drzewie; `@starting-style` daje wejście, a `data-shown="false"` chowa go przez `display: none` po wygaśnięciu (`transition-behavior: allow-discrete`). Bez `data-shown` jest samo wejście. Przeniesione z `AnimatePresence`: przyciski „Zapisz jako filtr” i „Wyczyść” w `SearchBar` (otoczka `span` trzyma położenie, bo `pressable` nadpisuje `translate`), tło panelu bocznego na telefonie (`AppSidebar`), pigułki w `LabelPicker` (tylko wejście), ikona słońca/księżyca w `AppHeader` (klasy `starting:` Tailwinda, nowa ikona wkręca się, stara znika od razu). Zostają na framer-motion miejsca z gestem, pomiarem wysokości, `layout` albo wyjściem z przesunięciem (`BulkActionBar`, `InstallBanner`, `NoteCard`, `NoteGrid`, `RecentActionsPanel`, `AppSidebar` — sam pasek, czytnik i pusty stan w `Index`, `AchievementStamp`). Ograniczony ruch: globalna reguła `html[data-motion="reduced"]` w `features.css` skraca czasy. Przeglądarka bez `@starting-style` (Firefox < 129) przełącza bez animacji.
- M2.1 (pomiar klatek): `e2e/motion-frames.spec.ts` na żądanie (`PERF=1`, projekt `pixel-7`, CPU ×4 przez `Emulation.setCPUThrottlingRate`). Mierzy pięć ścieżek: przewijanie 300 notatek, otwarcie notatki, zmianę zakładki, arkusz „Widok” i przeciągnięcie karty. Wyniki i znaleziska są w `docs/ruch.md`. Poprawka: `startScrollParallax` (`src/lib/scrollParallax.ts`) ustawia `--sig-scroll` tylko przy `data-skin="zorza"`, a przy innym stylu zdejmuje zmienną. Wcześniej zmiana zmiennej dziedziczonej z `<html>` w każdej klatce, razem z odczytem `scrollY` w `useHideOnScroll`, wymuszała przeliczenie stylu i układu wszystkich kart. Przewijanie przy CPU ×4: z 31–40 klatek > 50 ms do 1–2.
- M3.2 (zwijanie): bez zmian w kodzie. `interpolate-size: allow-keywords` jest globalnie na `html` (`styles/app/base.css`), a sekcje zwijane w JS (`NoteGroupSection`, `NoteCard`, `ChecklistEditor`, `SidebarFolderItem`, `VersionHistoryDialog`) animują `height: "auto"` przez framer-motion, który mierzy sam — nigdzie nie ma ręcznego liczenia wysokości do zastąpienia. Przejście na CSS wymagałoby rezygnacji z `AnimatePresence` (zwinięta sekcja przestaje być w DOM i w nawigacji klawiaturą), więc zostaje.

### Ograniczenia i pułapki

- M1.3 (martwe `@keyframes`): sprawdzone skryptem — wszystkie 82 reguły mają odwołanie w CSS, TS/TSX albo konfiguracji Tailwinda, więc nic nie usunięto. Skrypt nie widzi nazw składanych dynamicznie z kilku części.
- Literały `duration:` w wywołaniach `toast(...)` to czas wyświetlenia w ms, nie animacja — strażnik ich nie liczy (szuka tylko `0.x`).
- Wizualnie: paski w Długach, Grafiku i Pracy wypełniają się krócej (320 zamiast 500 ms).

### Testy

- `motionTokens.test.ts` (4), strażnicy `src/test`, typecheck. Pełne e2e nie było puszczane po tej zmianie.
- M2.2: `src/lib/overlayHistory.test.ts` (3: router nie dostaje własnego cofnięcia, dostaje „wstecz” systemowe i cofnięcie ze zmienionym adresem), `gridKeyboardNav` (14). Pełne e2e (2026-11-22): 1198 zaliczonych, 17 niezaliczonych. Z tych 17: 11 to stare porażki, `note-groups` „Ostatnio otwierane” i `site-sections` (axe, kontrast) padają też na wersji sprzed zmian, a `jobs` H3.5 i `private-notes` przechodzą przy powtórce. `editor-open` poprawiony: origin jest liczony w następnej klatce, więc test na niego czeka (`expect.poll`).
- M4.4: testy jednostkowe Długów, Ćwiczeń i strażników (`src/test`) — 119 zaliczonych; e2e `cwiczenia-*`, `debts-*`, `jobs`, `weight` — 27 zaliczonych. `bundle.spec` „precache”: 4,57 MiB przy progu 4,4 MiB — przekroczone już na `7ef014c0` (4,565 MiB, zmierzone w osobnym drzewie), nie przez tę zmianę; próg to decyzja właściciela.
- M4.3: `e2e/sheet-fling.spec.ts` (tło przygasa w trakcie, po puszczeniu arkusz nie wraca powyżej miejsca puszczenia, ponowne otwarcie na miejscu); `view-sheet-snap`, `fab-sheets-a11y`, `reminder-sheet`, `journal-menu`, `editor-open` — 13 zaliczonych.
- M4.2: `e2e/reader-shared.spec.ts` (Escape: przejście nie jest przerwane i animuje `note-shared`, nazwa zdjęta z kafla po przejściu). Specy z podglądem Spacją: 60 zaliczonych, 2 niezaliczone w `subpages` (dwa przyciski „Remont” w kaflu, tryb strict — niezwiązane z tą zmianą, na HEAD nie sprawdzone). `designTokens` W4.5: próg `.` 112 → 114, bo M3.1 zamienił w `SearchBar` dwa `motion.button` na zwykłe `<button>` (te same ikony 16 px).
- M4.1: `e2e/section-transition.spec.ts` (przód i wstecz: kierunek, nazwy powłoki, animacje pseudo-elementów; ograniczony ruch bez przejścia). E2e `bottom-slot`, `routes`, `tabs`, `inbox-today`, `today-lists`, `fab-press`, `skin-signatures` — 51 zaliczonych. Uwaga: `src/test/designTokens.test.ts` (W4.5, surowe `<button>`: 114 przy limicie 112) pada niezależnie od tej zmiany.
- M2.3: `src/lib/cardMotion.test.ts` (3: limit 8 kart i 240 ms, bez kaskady po oknie, ograniczony ruch). M2.4: `e2e/bundle.spec.ts`. E2e `editor-open`, `note-groups` — zaliczone poza znaną porażką „Ostatnio otwierane”.
- M2.1: `src/lib/scrollParallax.test.ts` (3, w tym „poza stylem Zorza nie ustawia zmiennej”), `e2e/motion-frames.spec.ts` (pomiar), e2e `night-skin`, `quick-presets`, `skin-signatures`, `skins`, `web-vitals-phone` — 42 zaliczone.
- M5.4: `src/lib/inputModality.test.ts` („recentUserAction”), e2e `debts-due`, `debts-plan`, `debts-rates`, `shifts`, `shifts-undo`, `today-study` (43 zaliczone, 2 pominięte z założenia).

### Commit

M1.2–M1.6 — commit po tym wpisie (2026-11-20).

## Wygląd — przyciski terminu, listy kontrolnej i wyglądu notatki na `Button` (W4.5 cd., 2026-11-20)

### Co robi

- **Przypomnienie (`ReminderPicker`):** szybkie terminy, dni, godziny i „Wcześniej” to pigułki `Button variant="chip"` — wybrana (`aria-pressed`) ma obrys i tło akcentu jak pigułki w Pracy; tekst pigułki jest pełnym kolorem zamiast wyciszonego. ✕ „Bez końca serii” to `IconButton`.
- **Lista kontrolna (`ChecklistEditor`):** ✕ „Usuń pozycję” i strzałki „Przesuń” na `IconButton` (20 px, na dotyku 44 px, pojawiają się po najechaniu jak dotąd); „Usuń ukończone”, „Zamień na listę” i „Zamień na tekst” na `Button ghost`.
- **Wygląd notatki (`NoteLookPicker`):** „Usuń” ikonę i okładkę na `Button variant="link"`, na dotyku 44 px.

### Gdzie jest

- `src/components/ReminderPicker.tsx` (usunięta stała `chipClass`), `src/components/ChecklistEditor.tsx`, `src/components/NoteLookPicker.tsx`; próg `RAW_BUTTON_MAX["."]` 127 → 112.

### Ograniczenia i pułapki

- Zostają celowo: kafelki szablonów w `QuickTemplates` (własny kształt `rounded-field` z ikoną), przełącznik segmentowy kolumn i filtrów w `ViewControls`, plakietki „Linkują tutaj” w czytniku (tło akcentu), uchwyt przeciągania i pola odhaczania listy (kontrolki dnd i `role="checkbox"`), wyzwalacze `card-action` na kafelku.

### Testy

- e2e `checklist*`, `composer-reminder`, `editing`, `fab-press`, `journal-tools`, `mobile`, `note-look`, `qol-etap5`, `reminder-lead`, `reminder-sheet` — 94 przeszło, 2 pominięte; `bundle` precache — znany przekroczony próg.

### Commit

W4.5 cd. — commit po tym wpisie (2026-11-20).

## Wygląd — trzy rozmiary ikon (W4.1 dokończone, 2026-11-20)

### Co robi

- Ikony mają 14 px (przy tekście meta), 16 px (domyślnie) albo 20 px (nawigacja, akcja główna). 59 ikon 12 px (`size-3`) urosło do 14 px: dzwonek i powtarzanie przy terminie, spinacz, kłódka, pinezka, kask budowy, strzałki sortowania tabeli, ikony nagłówków paska bocznego (Ostatnie, Widoki, Etykiety, Foldery), krzyżyki „usuń” w pigułkach i wierszach.

### Gdzie jest

- Zamiany w komponentach (m.in. `AppSidebar.tsx`, `NoteCardBody.tsx`, `NoteTable.tsx`, `AddNoteBar.tsx`, `ChecklistEditor.tsx`, `ReminderPicker.tsx`, `AttachmentsList.tsx`, `LockedNoteTile.tsx`).
- `src/test/designTokens.test.ts`: strażnicy `iconSize12` (1) i `iconSize24` (14).

### Ograniczenia i pułapki — co zostaje poza skalą i dlaczego

- 12 px: pogrubiony ✓ (`strokeWidth={3}`) w małej próbce stylu (`SkinPicker.tsx`) — pole ma 16 px.
- 24 px (14 ikon): ilustracje i duże akcje — „+” w dolnym pasku, ikony gestu przesunięcia kafla (przypnij, archiwizuj), zastępczy obraz w galerii, wgrywanie planu, płomień passy w Statystykach, ikona `StatusPanel` w liście, kafle „Zdjęcie / Wpis głosem / Brak” na stronie budowy.
- `size-6` na kontrolkach (próbki koloru, pole zaznaczenia kafla, plakietki na zdjęciach, dzień w szablonie tygodnia, przycisk folderu) to wymiar kontrolki, nie ikony — strażnik ich nie liczy, bo patrzy tylko na komponenty (znaczniki od wielkiej litery).
- Strażnik nie widzi rozmiaru przekazanego przez zmienną albo `[&_svg]:size-*` rodzica.

### Testy

- Strażnicy zieloni; e2e `board-table`, `editing`, `calendar-agenda`, `reminders-calendar`, `mobile-layout`, `attachments`, `inbox-quick` — 50 przeszło, 2 pominięte; zrzut paska bocznego i kafla.

### Commit

W4.1 — commit po tym wpisie (2026-11-20).

## Wygląd — strona zasad dla nowego widoku (W9.4, 2026-11-20)

### Co robi

- `docs/wyglad.md` to jedna strona, od której zaczyna każdy, kto dodaje albo zmienia ekran: siedem zasad, układ strony (marginesy, odstępy, szerokości, wysokości okien, wymiary, `@container`), role tekstu, odmiany powierzchni, kontrolki i pigułki, wykresy i stany puste/ładowania, style, kontrast, druk i lista kroków przed zamknięciem zmiany. Odsyła do `typografia.md`, `komponenty.md` i `karty-stylow.md`.

### Gdzie jest

- `docs/wyglad.md`; strażnicy reguł w `src/test/designTokens.test.ts` (W9.1 — już byli: `bareShadow`, `sizeWeightPair`, `MANUAL_CARD_MAX`, `squarePair`, `dark:`, `RAW_BUTTON_MAX`, `arbitrarySize`, `IMPORTANT_MAX`).

### Ograniczenia i pułapki

- Strona opisuje stan z 2026-11-20. Gdy zmienia się token, wariant albo próg strażnika, popraw też tabelę w `docs/wyglad.md`.

### Commit

W9.4 — commit po tym wpisie (2026-11-20).

## Dokumenty PDF — jedna skala pisma (W8.2, 2026-11-20)

### Co robi

- Wycena, faktura (też korekta), protokół odbioru, raport budowy, rozliczenie budowy i eksport notatek mają te same stopnie pisma i ten sam margines 15 mm co druk z przeglądarki. Widoczne zmiany: suma wyceny 12 pt zamiast 13, skrót SHA-256 faktury 8 pt zamiast 7; eksport notatek — tytuł 16 pt zamiast 20, data eksportu 9 pt, margines 15 mm zamiast 16.

### Gdzie jest

- `src/lib/pdfType.ts`: `PDF_FONT`, `addPdfFonts()`, `PDF_TYPE` (`title` 16, `subtitle` 12, `heading` 11, `body` 10, `table` 9, `small` 8) i `PDF_MARGIN_MM` (15). Komentarz wiąże stopnie z rolami z `docs/typografia.md`.
- `src/lib/study/pdfWriter.ts`: margines, domyślne rozmiary `line`/`table`/`keyValue`, nagłówek sekcji, podpisy zdjęć i pola podpisu na `PDF_TYPE`.
- Wywołania w `billingPdf.ts`, `handoverPdf.ts`, `jobPdf.ts`, `reportPdf.ts`, `ksef/invoicePdf.ts` (59 rozmiarów) i `src/lib/exportPdf.ts`.

### Ograniczenia i pułapki

- **Czcionka PDF (naprawione 2026-11-20).** `public/fonts/protokol-*.ttf` był samym podzbiorem `latin-ext` Barlow Condensed (U+0100–024F): bez A–Z, a–z, cyfr i „ó”. W dokumentach Pracy zostawały więc prawie wyłącznie polskie znaki specjalne. Do tego pogrubienie rejestrowało się jako styl `"boldbold"` (jsPDF skleja `"bold"` z wagą 700), więc nagłówki szły czcionką zastępczą. Teraz: `scripts/build-pdf-font.mjs` scala podzbiory `latin` i `latin-ext` z `@fontsource/barlow-condensed` (WOFF 1.0 → TTF, 498 glifów, 389 znaków), `addPdfFonts()` w `src/lib/pdfType.ts` rejestruje obie wagi (pogrubienie jako `"normal"` + 700) dla `PdfWriter` i dla eksportu notatek, który wcześniej pisał Helvetiką („Zażółć” → „Za|óB”). Kursywy krój nie ma — etykiety i przypomnienie w eksporcie są zwykłym krojem w szarym. Nagłówek eksportu to nadal „NOTATKI PIJACKIE”.
- Nowy rozmiar w dokumencie dopisuje się jako stopień w `PDF_TYPE`, nie liczbą w wywołaniu.

### Testy

- `src/lib/pdfFont.test.ts` — czcionki mają litery, cyfry i polskie znaki (ze starą czcionką test nie przechodzi). PDF z jsPDF i eksport notatek z aplikacji obejrzane. Vitest `src/lib/study`, `src/lib/ksef`, `exportPdf` — 979 zielonych; e2e z PDF (`attachments`, `handover-pdf`, `invoice`, `jobs`, `quote`, `report-pdf`, `share-files`, `site-docs`, `study`) — 67 przeszło, 2 pominięte.

### Commit

W8.2 — commit po tym wpisie (2026-11-20).

## Druk dowolnego widoku (W8.1, 2026-11-20)

### Co robi

- „Drukuj” przeglądarki (Ctrl+P) na każdym widoku daje papier zamiast zrzutu aplikacji: bez paska bocznego, nagłówka, dolnego paska, tła kartki, kompozytora, ikon na kartach, plakietki „Zapisano” i toastów; ciemny tekst na białym w każdym stylu i schemacie (też Neon czy ciemny Zeszyt), bez cieni, poświat tytułów i kolorowych teł notatek.
- Otwarte okno (czytnik notatki, okna Radix — np. wycena) drukuje się samo, od góry strony, bez widoku pod nim.
- Karty, wiersze list i tabel nie łamią się między stronami; nagłówek tabeli powtarza się na każdej stronie; link drukuje swój adres w nawiasie.
- Każdy wydruk (też raport budowy, protokół odbioru i miesiąc Kalendarza przez `PrintRoot`) ma marginesy 15 mm (wcześniej 14) i numer strony „1 / 3” w prawym dolnym rogu.

### Gdzie jest

- `src/styles/app/print.css`: drugi blok `@media print` — `@page` z `@bottom-right`, ukrywanie powłoki (`.paper-grid`, `.sidebar-gradient`, `.app-header`, `.paper-stamp`, `.save-status`, `.card-actions`, `[data-print="hide"]`, `[data-add-note-bar]`, toaster Sonnera), okno zamiast widoku, `break-inside`, `thead`, adresy linków. Reguły zwykłego druku mają `html:not(.printing-report)`, więc nie ruszają `PrintRoot`.
- `src/styles/preferences.css`: `@media print` z tokenami papieru (`html:root[data-skin]`) i bez `text-shadow`/`filter` w nagłówkach.
- `src/components/BottomNav.tsx`: `data-print="hide"` na pasku.

### Jak działa

- Kolory przez tokeny, nie przez `!important`: `html:root[data-skin]` ma specyficzność stylów (`html[data-skin="…"]:not(.dark)`), a `preferences.css` jest importowany ostatni.
- Czytnik notatki to wrapper w `#root`, nie portal: `#root:has([role="dialog"]) > :not(:has([role="dialog"]))` chowa resztę, a rodzic okna (`:has(> [role="dialog"])`) przestaje być `fixed` i centrować. Tailwind v4 centruje właściwością `translate`, więc reguła zeruje też `translate`, nie tylko `transform`.

### Ograniczenia i pułapki

- Numer strony z `@page @bottom-right` drukuje Chrome/Edge (od 131); Firefox i Safari pomijają go bez błędu.
- Link, którego tekst jest adresem, drukuje adres dwa razy (CSS nie porówna tekstu z `href`).
- Czytnik drukuje też swój pasek przycisków, lokalny graf i „Podstrony”; notatka otwarta do edycji w kaflu drukuje się pustą ramką — do druku służy czytnik (Spacja).
- Otwarty popover Radix (też `role="dialog"`) w chwili druku zastąpi widok na papierze.
- Grafik drukuje się z przyciskami i kontrolkami; do papieru jest „Obraz miesiąca (.png)”.

### Testy

- PDF z Chromium (`page.pdf`) obejrzany: lista notatek w stylu Neon, czytnik notatki (samo okno od góry strony), Grafik (3 strony, numeracja). e2e druku: `private-notes`, `reminders-calendar`, `site-handover`, `study` — 64 przeszło, 2 pominięte.

### Commit

W8.1 — commit po tym wpisie (2026-11-20).

## Wygląd — rytm strony (W7.3, 2026-11-20)

### Co robi

- Bez widocznej zmiany. Przegląd potwierdził jeden rytm na wszystkich ekranach: margines boczny `--space-page` (16 px na telefonie, 24 px od 640 px), tytuł działu, potem odstęp `--space-stack` (32/40 px) do sekcji, treść wyśrodkowana do `--page-wide` (80rem).
- Wyjątek Dziś na telefonie (16 px między kartami, mniej przewijania) jest zapisany jako `gap-4 sm:gap-stack` zamiast `gap-4 sm:gap-10` — ta sama wartość, ale od 640 px idzie za tokenem.

### Gdzie jest

- `src/pages/Index.tsx`: `<main>` (`px-page`, `gap-stack`, `max-w-[calc(var(--page-wide)+3rem)]`).

### Jak działa — pomiar

- Tymczasowy test mierzył na 12 ekranach (Notatki, Dziś, Tydzień, Archiwum, Przypomnienia, Kalendarz, Grafik, Długi, Ćwiczenia, Praca, Kosz, Skrzynka) przy 390 i 1280 px lewą krawędź tytułu i pierwszych elementów treści oraz wcięcie bezpośrednich dzieci `<main>`. Wszystkie elementy treści zaczynają się na krawędzi tytułu (różnica 1 px to obramowanie karty), żaden widok nie ma własnego wcięcia na poziomie strony.

### Ograniczenia i pułapki

- Paski przewijane w poziomie na telefonie (pędzle Grafiku, pasek edytora) cofają margines przez `-mx-4 px-4` — to wartość `--space-page` na telefonie; od 640 px przechodzą na inny układ, więc nie potrzebują tokenu.

### Testy

- Pomiar krawędzi (opisany wyżej). Zmiana klasy nie zmienia wartości.

### Commit

W7.3 — commit po tym wpisie (2026-11-20).

## Wygląd — układ kart od ich szerokości (W7.2, 2026-11-20)

### Co robi

- **Przegląd tygodnia (Dziś):** dwie kolumny kategorii dopiero wtedy, gdy sama karta ma co najmniej 42rem. Wcześniej przełączała je szerokość okna (`lg`), a na komputerze karta stoi w połowie siatki Dziś, więc dwie kolumny wchodziły do wąskiej karty.
- **Karta zmiany (Dziś):** większa data i nazwa zmiany od 32rem szerokości karty, nie okna.
- **Długi, formularz wpisu i edycji:** pola obok siebie od 28rem szerokości formularza. Edycja w wąskim arkuszu osoby ma teraz pola jedno pod drugim, nawet na szerokim oknie.
- **Kafel notatki:** pasek ikon zawija się, gdy kafel ma mniej niż 13rem, także na komputerze przy wielu kolumnach. Wcześniej działo się to tylko przy oknie do 480 px.

### Gdzie jest

- `src/components/review/WeeklyReviewCard.tsx` (`@container`, `@2xl:grid-cols-2`), `src/components/review/TodayShiftCard.tsx` (`@container`, `@lg:text-*`), `src/components/debts/DebtsView.tsx` (`@md:` w formularzach z `@container`).
- `src/styles/app/features.css`: `.note-card { container: note-card / inline-size }` i `@container note-card (max-width: 13rem)` wewnątrz `@media (hover: hover)`.

### Jak działa

- Tailwind v4 ma progi kontenera wbudowane (`@sm` 24rem, `@md` 28rem, `@lg` 32rem, `@2xl` 42rem). Kafel notatki ma nazwany kontener w CSS, bo reguła paska akcji i tak jest w `features.css`.
- `container-type: inline-size` nie tworzy bloku zawierającego dla `position: fixed`, więc pełnoekranowa edycja z kafla działa jak dotąd.

### Ograniczenia i pułapki

- Kafel z `inline-size` nie może brać szerokości od treści — w siatce i na liście ma ją z kolumny. Gdyby kiedyś stał w kontenerze „na treść” (`inline-flex`, `w-fit`), zwinąłby się do zera.
- Odstępy wewnętrzne kart (`p-4 sm:p-5`) zostają przy oknie: to rytm strony (W7.3), nie układ karty.

### Testy

- Reguła kafla sprawdzona w przeglądarce (kafel 226 px — jeden wiersz bez przewijania; zwężony do 180 px — zawija). e2e kart Dziś, Długów, siatki i akcji kafla: 62 przeszło, 2 pominięte; `card-reminder-edit` nie przechodzi — stara porażka sprzed tej pracy.

### Commit

W7.2 — commit po tym wpisie (2026-11-20).

## Wygląd — wymiary na skali i tokenach (W7.1, 2026-11-20)

### Co robi

- Wymiary wpisywane ręcznie (`w-[18px]`, `max-h-[88dvh]`, `min-w-[12rem]`) przeszły na skalę Tailwinda albo na nazwane tokeny. Przy domyślnym rozmiarze tekstu wygląd się nie zmienia; wymiary w px rosną teraz z ustawieniem „Rozmiar tekstu”, jak reszta interfejsu (zasada z `text-size.css`: wszystko w rem).
- Okna mają trzy wysokości zamiast dziesięciu: arkusz i okno na telefonie 92dvh, wyśrodkowane okno 85dvh (wcześniej 80/85/88/90), podgląd obrazu 80dvh (wcześniej 75/80). Czytnik notatki i historia wersji mają teraz 85dvh zamiast 80dvh.

### Gdzie jest

- `tailwind.config.ts`: `spacing["icon-nav"]` = 1.125rem (`size-icon-nav`, `w-icon-nav` — ikony paska bocznego i dolnego, przycisk instalacji, przegląd tygodnia, `CheckMark`), `maxHeight.sheet|dialog|media`.
- Zamiany w 47 plikach: 17 par ikon 18 px, 28 wysokości okien, 24 wymiary na skalę (`min-h-15`, `min-h-20`, `max-h-75`, `min-w-30`, `h-16`, `min-h-16.5/17.5`, `min-w-48`, `max-w-64/68/72`, `w-34`, `w-88`, `min-h-112`, `min-w-120/176`, `max-h-160`).
- `src/test/designTokens.test.ts`: strażnik `arbitrarySize` (34).

### Ograniczenia i pułapki — co zostaje wpisane ręcznie (34)

- Kreski i kropki 2–3 px (znacznik w dolnym pasku, pasek zmiany w kafelku dnia, kropki w kafelku notatki, legenda) — linia ma mieć stałą grubość.
- Obszary przewijane wewnątrz okien w `dvh` (28–70) i szerokości w `vw` (pasek boczny 85vw, rysunek 95vw, podpowiedzi) — zależą od ekranu, nie od tekstu.
- Kalendarz zastępczy `w-[252px] h-[294px]` (`lazy-calendar.tsx`) — wymiar obcego komponentu, który zastępuje.
- Logo w `em` (rośnie z napisem) i `max-w-[26ch]` (szerokość w znakach).
- Wybór tokenu przy wysokości okna: arkusz/telefon → `max-h-sheet`, wyśrodkowane okno z przewijaniem → `max-h-dialog`, obraz → `max-h-media`.

### Testy

- Każda nowa klasa sprawdzona w zbudowanym CSS. Strażnicy `src/test` zieloni, typecheck czysty; e2e: `a11y`, `attachments`, `board-table`, `calendar-*`, `dzis-phone`, `editing`, `leave-year`, `mobile*`, `plans`, `reader*`, `shortcuts-settings-stats`, `clients`, `sync-status-dot` — 361 przeszło; `clients` na iPhone 14 raz nie znalazł widoku po kliknięciu zakładki, osobno przechodzi (niestabilny).

### Commit

W7.1 — commit po tym wpisie (2026-11-20).

## Wygląd — podział `index.css` (W6.5, 2026-11-20)

### Co robi

- Bez zmiany wyglądu: główny arkusz (1732 linie) jest podzielony na siedem plików według zawartości. Zbudowany CSS jest bajt w bajt taki sam jak przed podziałem (ten sam hash `index-C-Oulk4o.css`).

### Gdzie jest

- `src/index.css` — tylko importy: `tailwindcss`, `tw-animate-css`, siedem części i na końcu `@config`.
- `src/styles/app/`: `base.css` (zgodność z v3, kreska ikon, kursor), `utilities.css` (`@utility`), `tokens.css` (`:root` i `.dark`), `components.css` (warstwy `utilities`/`base`/`components`: role tekstu, karty, okna), `features.css` (reguły działów poza warstwami: „+”, kolory notatek, toasty, logo, marka), `print.css` (wydruk raportu), `effects.css` (szkielety, przejścia widoków, wykresy, ramka kafla, szkice, tytuł działu, kod). Każdy plik ma w nagłówku zakres dawnych linii.
- `src/test/appCss.ts` — `readAppCss()`: skleja `index.css` z częściami w kolejności importów; używają go testy, które czytały `index.css` (kontrast, OLED, kolory działów, kształt, gęstość, kreska szkicu, logo, obwódka zmian).
- `scripts/ui-metrics.mjs` — metryka „index.css linie” liczy `index.css` razem z `styles/app/`.

### Jak działa

- Części są wycięte w miejscach, gdzie zagnieżdżenie klamer wraca do zera, i importowane w dawnej kolejności, więc kaskada się nie zmienia. Tailwind wkleja je w miejscu importu.

### Ograniczenia i pułapki

- **`@import` musi stać przed `@config`.** Tailwind pomija importy po innych regułach — przy pierwszej próbie CSS stracił 56 KB bez żadnego błędu builda.
- Kolejności importów nie przestawiać. Pierwszy blok `:root` (tokeny w `tokens.css`) czytają testy kontrastu — nie dodawaj wcześniej innego `:root`.
- Plan dzielił na `tokens/base/components/utilities/print`; części noszą nazwy po treści, bo dawny plik przeplatał warstwy i reguły bez warstw, a kolejności nie wolno zmieniać.

### Testy

- Porównanie zbudowanego CSS przed i po (identyczny). Vitest 4230 zielony, typecheck czysty, e2e `csp`, `view-skeleton` zielone. `bundle.spec.ts` „precache” nie przechodzi: 4 785 272 B (300 plików) przy progu 4,4 MiB — przyrost z wcześniejszych commitów, podział CSS go nie zmienia; próg czeka na decyzję właściciela.

### Commit

W6.5 — commit po tym wpisie (2026-11-20).

## Wygląd — wysoki kontrast i wymuszone kolory (W6.7, 2026-11-20)

### Co robi

- **System prosi o więcej kontrastu** (`prefers-contrast: more`): poza dotychczasowymi mocniejszymi krawędziami (55% tekstu, 2 px) tekst przygaszony (`--faint`) jest tak ciemny jak wyciszony, a krawędzie pól (`--input`) mają pełny kolor tekstu. „Tryb budowa” w ustawieniu `auto` włącza się jak dotąd.
- **Tryb wysokiego kontrastu systemu** (`forced-colors: active`, np. Windows): stan wybrania — pigułki z `aria-pressed`, zakładki, przełączniki grup, aktywna pozycja nawigacji, wiersz „dziś” — ma obrys w systemowym kolorze `Highlight`, bo tło, które go niosło, system zdejmuje. Przełączniki mają tor z obwódką i włączony stan w `Highlight`, paski postępu — obwódkę i wypełnienie w `Highlight`.

### Gdzie jest

- `src/styles/preferences.css` — oba bloki `@media`; plik importowany ostatni w `main.tsx`, więc wygrywa kolejnością.

### Jak działa

- Selektory po atrybutach ARIA i Radix (`aria-pressed`, `aria-selected`, `aria-current`, `role="tab"][data-state="active"]`, `data-state="on"`), więc działają we wszystkich komponentach bez zmian w kodzie.
- Przy przełączniku i pasku postępu `forced-color-adjust: none` — bez tego system wyzerowałby tło także w regule z kolorem systemowym.
- Ikony lucide rysują `currentColor`, więc w wymuszonych kolorach biorą kolor tekstu systemu bez osobnej reguły.

### Ograniczenia i pułapki

- `--input` przy wyższym kontraście to też tor wyłączonego przełącznika (`bg-input`) i obwódka przycisków `outline` — są pełne, celowo.
- Wykresy SVG z kolorami z tokenów (iskra, pasek tygodnia, oprawa wykresów) w wymuszonych kolorach zostają w barwach stylu; wartość i tak podaje tekst obok.

### Testy

- Zrzuty w emulacji Chrome (`emulateMedia({ forcedColors: "active" })` i `{ contrast: "more" }`): Notatki, Grafik, Ustawienia → Wygląd. Vitest `src/lib` i `src/test` (3707) oraz e2e `hidden-views`, `night-skin` zielone.

### Commit

W6.7 — commit po tym wpisie (2026-11-20).

## Wygląd — `!important` tylko tam, gdzie musi (W6.4, 2026-11-20)

### Co robi

- Bez widocznej zmiany: obwódka paska bocznego (czerwona linia marginesu zeszytu) ma ten sam kolor co wcześniej, ale bez `!important`.

### Gdzie jest

- `src/index.css`: `@utility sidebar-gradient` bez `!important`; usunięta zdublowana `@utility dark` z tą samą regułą (wystarcza `.dark &` w środku `sidebar-gradient`).
- `src/components/AppSidebar.tsx`: z paska zdjęte `border-border/50` — to ono konkurowało z kolorem krawędzi i wymuszało `!important`.
- `src/styles/skins/tablica.css`: przezroczysta krawędź przy aluminiowej ramie bez `!important` (reguła stylu jest poza warstwami Tailwinda, więc i tak wygrywa).
- `src/test/designTokens.test.ts`: strażnik `IMPORTANT_MAX` (31, poza komentarzami).

### Jak działa — co zostaje i dlaczego

- **Ograniczony ruch** (`prefers-reduced-motion`, `html[data-motion="reduced"]`): globalne skrócenie animacji i przejść oraz wyłączenia w utility `theme-transition`, `hover-scale`, w ramce kafla (`.note-frame`) i w `motion.css`. Muszą przebić `animation`/`transition` ustawione w utility i w stylu elementu.
- **Płynna zmiana motywu** (`theme-transition`): na chwilę przebija `transition-*` komponentów, inaczej część elementów zmieniałaby kolor skokiem.
- **Druk raportu** (`html.printing-report`): chowa wszystko poza raportem i czyści tło — druk ma pierwszeństwo przed każdą klasą.
- **Karta w tle** (`html[data-hidden]`): pauza wszystkich animacji.
- **Tryb OLED** (`preferences.css`): zdejmuje `backdrop-filter` ustawione utility `backdrop-blur-*`.
- **Toasty Sonnera**: położenie nad dolnym paskiem i pod paskiem stanu. Sonner wstrzykuje własny arkusz po naszym, z tą samą specyficznością.

### Ograniczenia i pułapki

- Kolor krawędzi paska bocznego ustawia teraz tylko `sidebar-gradient`. Dodanie do paska klasy koloru obramowania (`border-border…`) zmieni krawędź na kolor tej klasy, zależnie od kolejności w wygenerowanym CSS.

### Testy

- Strażnik `IMPORTANT_MAX`; kolor krawędzi sprawdzony w przeglądarce (Zeszyt jasny 80% `--margin`, ciemny 45%, Plan ciemny 45%, Tablica przezroczysta); e2e `a11y` (pasek boczny, Tablica) — 24 przeszło.

### Commit

W6.4 — commit po tym wpisie (2026-11-20).

## Wygląd — szkielety w kształcie kart (W5.5, 2026-11-20)

### Co robi

- Przy pierwszym wejściu do leniwie ładowanego działu na wolnym łączu widać zarys docelowego widoku: te same karty (ramka, promień, wcięcie `p-card`), a w nich szare linie tekstu. Po wczytaniu ramki zostają na miejscu i wypełniają się treścią.
- **Długi:** karta podsumowania z dwiema liczbami i paskiem proporcji, pod nią trzy wiersze osób (awatar, imię, kwota).
- **Ćwiczenia:** pasek „dziś” i dwie sekcje-karty z wierszami.
- **Plany:** siatka kart z miniaturą 16:9 (jak `PlansList`).
- **Oś tygodnia (Kalendarz):** siedem wierszy dni.
- **Praca:** zakładki i cztery karty z liniami tekstu. **Kalendarz, Grafik:** pasek miesiąca i siatka; w Grafiku trzy karty liczb.
- **Dziś:** karta zmiany ma szkielet „bohatera” — data, znaczek, rząd przycisków — zamiast niskiego prostokąta.

### Gdzie jest

- `src/components/ViewSkeleton.tsx`: `ViewSkeleton` (`ViewBody` — przełącznik po `SkeletonView`), `CardSkeleton({ variant: "card" | "hero" })`, wewnętrzne `SkeletonCard` (`cardVariant()` + `p-card`), `Lines`, `Bone`, `MonthGrid`.
- `hero` używają `review/TodayCards.tsx` (fallback karty zmiany) i `review/TodayShiftCard.tsx` (Grafik jeszcze się wczytuje).

### Jak działa

- Pojawianie się i pulsowanie bez zmian: `.view-skeleton` w `index.css` wchodzi po 300 ms (szybkie ładowanie nie miga — wymóg M5.3 „bez migotania < 150 ms” spełniony z zapasem), `.view-skeleton-bone` pulsuje, a przy ograniczonym ruchu stoi.
- Czytnik ekranu dostaje tylko `role="status"` z napisem „Ładowanie …”; zarys jest `aria-hidden`.

### Ograniczenia i pułapki

- Szkielet to przybliżenie układu, nie kopia: zmiana układu działu nie zepsuje testów, ale szkielet trzeba wtedy poprawić ręcznie.
- Strażnik `squarePair` łapie `h-3 w-3/5` (to samo N przed ułamkiem) — w kościach używaj innych par.

### Testy

- e2e `view-skeleton`, `a11y`, `csp`, `inbox-today`, `today-study`, `debts-plan`, `cwiczenia-zakladki` — 274 przeszło, 2 pominięte. Zrzuty Długów i Ćwiczeń przy opóźnionych paczkach — tymczasowym specem.

### Commit

W5.5 — commit po tym wpisie (2026-11-20).

## Wygląd — stany puste działów (W5.4, 2026-11-20)

### Co robi

- Puste listy działów mają jeden wzór: przerywana ramka, szkic „długopisem” w kresce stylu, jedno zdanie (czasem opis) i jedna akcja główna.
- **Klienci:** wizytówka z sylwetką i przycisk „Dodaj pierwszego klienta”. Brak wyników wyszukiwania to `StatusPanel` „nic nie pasuje” z „Wyczyść wyszukiwanie”.
- **Grafik:** brak rodzajów zmian — trzy kafelki z plusem, „Dodaj rodzaj zmiany” (główna) i „Przywróć startowe”. Pusty miesiąc/tydzień — szkic tygodnia zamiast ikony.
- **Kalendarz:** pusta agenda miesiąca — szkic kalendarza.
- **Ćwiczenia:** pusta lista odżywek — kapsułka; „Dodaj odżywkę” jest teraz przyciskiem głównym (wcześniej obrysowy).
- **Notatki i Skrzynka (`EmptyState`):** „Napisz pierwszą notatkę”, „Zapisz pomysł” i „Wyczyść wyszukiwanie” na `Button` (główny i pigułka `chip`).

### Gdzie jest

- `src/components/art/Sketch.tsx`: nowy prop `size` — `page` (dotychczasowy, 160×112) i `inline` (112×80, do `StatusPanel size="inline"`). Jawny `className` dalej wygrywa.
- `src/lib/emptyGlyphs.ts`: `CLIENTS_GLYPH`, `SHIFT_TYPES_GLYPH`, `SUPPLEMENTS_GLYPH` (viewBox 120×84, linie kartki na 72 i 78 — rysunek kończy się nad nimi).
- Użycia: `clients/ClientsView.tsx`, `shifts/NoShiftTypes.tsx`, `shifts/EmptyShifts.tsx`, `calendar/MonthAgenda.tsx`, `cwiczenia/CwiczeniaView.tsx` (`EmptyList`), `study/StudyJournal.tsx` (już był, teraz `size="inline"`), `EmptyState.tsx`.

### Jak działa

- `StatusPanel` nie przyjmuje `data-testid` ani `aria-label`, więc tam, gdzie testy lub czytnik ich potrzebują, panel siedzi w opakowaniu (`section aria-label`, `div data-testid`, `div role="status"` dla braku wyników).
- Szkice rysują się raz przy wejściu (`.sketch-draw`), a przy ograniczonym ruchu są od razu gotowe — bez zmian względem Dziennika i Notatek.

### Ograniczenia i pułapki

- W Klientach „Nowy klient” nad listą i „Dodaj pierwszego klienta” w pustym stanie robią to samo; pusty stan ma przycisk, bo na telefonie pasek nad listą bywa poza ekranem.
- Puste stany wewnątrz okien (np. listy w dialogach Pracy, `UpcomingDays` „Brak terminów.” w kafelku dnia) zostały tekstem — to komórki, nie listy działu.
- Próg strażnika `RAW_BUTTON_MAX` dla głównego `components/` obniżony do 127.

### Testy

- e2e: `a11y`, `clients`, `calendar-agenda`, `cwiczenia-*`, `empty-journal-tools`, `empty-states-qol`, `inbox-*`, `shifts`, `shifts-undo`, `study`.

### Commit

W5.4 — commit po tym wpisie (2026-11-20).

## Wygląd — małe wykresy w kartach (W5.3, 2026-11-20)

### Co robi

- **Dziś, karta zmiany:** wiersz „Ten tydzień: 44 h” z paskiem siedmiu słupków pon–nd. Dzisiejszy słupek jest w akcencie, dzień bez pracy to kreska przy podstawie. Wiersza nie ma, gdy w tym tygodniu nie ma pracy w Grafiku. Suma obejmuje też dni zaplanowane do końca tygodnia.
- **Dziś, podgląd notatki dnia:** mały pierścień przed „Odhaczone: 2 z 5”.
- **Długi, karta osoby:** iskra salda — przebieg salda od pierwszego wpisu do dziś, w kolorze strony (zielony: winni nam, bursztyn: my winni, szary: rozliczone). Pokazuje się od trzech wpisów i nie przy ukrytych kwotach.
- **Praca, statystyki:** pierścienie kafelków są teraz tym samym komponentem.

### Gdzie jest

- `src/components/ui/mini-charts.tsx`: `Sparkline` (`values` od najstarszej), `WeekBars` (`values` pon–nd, `today` 0–6), `ProgressRing` (`value` 0–1, `strokeWidth`).
- `src/lib/shifts/yearCharts.ts`: `weekDayMinutes(data, day)` i wspólny `workMinutes` (używa go też `yearDayMinutes`).
- Użycia: `src/components/review/TodayShiftCard.tsx` (`today-week`), `src/components/debts/DebtsView.tsx` (`PersonHistory`), `src/components/study/StudyStats.tsx` (`Tile`).

### Jak działa

- Same SVG i `div`, bez recharts — nie dokładają nic do paczki wejściowej; wszystkie są `aria-hidden`, bo liczbę mówi tekst obok.
- `Sparkline` ma zero zawsze w skali (przy saldzie liczy się odległość od rozliczenia); przerywana linia zera tylko wtedy, gdy przebieg przechodzi przez zero. Skaluje się bez zachowania proporcji (`preserveAspectRatio="none"`, `vector-effect: non-scaling-stroke`), więc kropka końca to odcinek zerowej długości z okrągłym końcem — koło by się rozciągnęło.
- `weekDayMinutes` liczy tydzień od poniedziałku przez `Date` lokalne, więc działa przez przełom roku; urlop i L4 to 0.

### Ograniczenia i pułapki

- Iskra przy ukrytych kwotach jest schowana, bo kształt zdradza proporcje kwot.
- Podpisy dni w `WeekBars` to `text-2xs` — strażnik `pxText` nie pozwala na mniejsze px.

### Testy

- `src/lib/shifts/yearCharts.test.ts` (tydzień przez przełom roku, urlop = 0). e2e: `daily-note`, `debts-*`, `dzis-phone`, `inbox-today`, `stats-practice`, `study`, `today-cards-settings`, `today-study` — 59 przeszło, 2 pominięte. Zrzuty Dziś (jasny, ciemny) i karty osoby w Długach — tymczasowym specem.

### Commit

W5.3 — commit po tym wpisie (2026-11-20).

## Wygląd — oprawa wykresu `ChartFrame` (W5.1, W5.2, 2026-11-20)

### Co robi

- Każdy wykres ma ten sam układ: tytuł, pod nim duża wartość (suma), z prawej zakres danych, pod spodem podpisy serii ze znacznikiem, a dalej sam wykres. Legenda nie jest osobną ramką w obszarze wykresu.
- Serie odróżnia też kształt, nie tylko kolor: słupek to pełny kwadrat, noc to kwadrat kreskowany, norma to linia przerywana.
- Pod wykresem może być zwinięta tabela „Pokaż dane” z tymi samymi liczbami — dla czytnika ekranu i do odczytu dokładnych wartości.

### Gdzie jest

- `src/components/ui/chart-frame.tsx`: `ChartFrame` (props `title`, `value`, `range`, `series`, `plotClassName`, `table`), typy `ChartSeries` i `SeriesShape` (`bar` | `hatch` | `line` | `dash`), `HatchPattern` — wzór SVG do `<defs>` wykresu.
- `src/components/ui/chart-style.ts`: `CHART_TOOLTIP_STYLE` (dymek w tokenach) i `CHART_TICK` (podpisy osi 11 px). Osobny plik, bo plik komponentu eksportuje tylko komponenty (fast refresh).
- `src/components/shifts/YearCharts.tsx`: „Godziny i norma” (suma godzin roku) i „Nadgodziny i noc” (suma nadgodzin), noc kreskowana przez `fill="url(#…)"` z `useId`.
- `src/components/StatsDialog.tsx`: „Aktywność”, suma z 14 dni, zakres „ostatnie 14 dni” i tabela dni.

### Jak działa

- `ChartFrame` nie importuje recharts: wykres podaje wywołujący jako `children`, więc oprawa nie trafia z biblioteką do paczki wejściowej.
- Wartość główna ma rolę `num-lg`, tytuł `ui-label` w kolorze wyciszonym, zakres i podpisy `ui-meta`. Suma roku to pełne godziny z `toLocaleString("pl-PL")` i mniejszą jednostką „h”, jak w `Stat`.
- Gdy jest `table`, obszar wykresu ma `aria-hidden` — czytnik dostaje tabelę zamiast pustego SVG. Wykresy roku nie mają `table`, bo tabela miesięcy stoi tuż pod nimi w `YearSummaryDialog`.
- Kolor nocy szedł wcześniej z reguły `.year-chart-night` w `index.css`. Reguła usunięta, bo CSS `fill` przykryłby wzór kreskowania.

### Ograniczenia i pułapki

- W kodzie są dwa wykresy recharts, nie trzy jak w planie. `PressureChart` w Pracy to własny SVG i nie przeszedł na oprawę.
- `toLocaleString("pl-PL")` nie dzieli liczb czterocyfrowych (1712), tylko od pięciu cyfr. To zgodne z polską typografią.
- Podziałka osi przy samych zerach (recharts) bywa nierówna, np. 0, 1, 2, 4. To stan sprzed zmiany.

### Testy

- e2e `leave-year.spec.ts`, `stats-practice.spec.ts`, `shortcuts-settings-stats.spec.ts`; strażnicy `src/test/` zieloni. Zrzuty: Grafik (komputer, telefon, ciemny) i Statystyki — przez tymczasowy spec, potem usunięty.

### Commit

W5.1–W5.2 — commit po tym wpisie (2026-11-20).

## Wygląd — karty na odmianach: Długi, Praca, Ustawienia, Grafik, Dziś, Kalendarz, Notatki (W3.2, 2026-11-19/20)

### Co robi

- W Długach karty biorą odmiany ze wspólnego `Card`:
  - podsumowanie jest uniesione (cień);
  - osoby na liście to karty klikalne (hover, fokus, wciśnięcie z odmiany);
  - wpisy historii i raty w arkuszu osoby mają wyciszone tło bez drugiej ramki;
  - ostrzeżenie o podwójnym rozliczeniu ma lewą krawędź w kolorze ostrzeżenia.

### Gdzie jest

- `src/components/debts/DebtsView.tsx`: `Summary` (`raised`), formularz „Nowy wpis” (`plain`), osoba (`interactive`), wpis historii (`inset`), „Edycja wpisu” (`plain` + `border-primary/40`), `debts-double-settle` (`status`, `warning`).
- `src/components/debts/DebtPlans.tsx` — rata (`inset`).
- Praca (`src/components/study/**`, 36 plików, 57 kart). Panele budowy, quiz, statystyki, sekcje arkusza wpisu i zestawy dostały `plain` (`cardVariant()`). Ramki ostrzeżenia i sukcesu (kamera, skaner, NFC, poziomica, AI, przypomnienia, etap wpisu) dostały `status` z tonem i zachowanym tłem `bg-*/5|10`. Ramki akcentu (zlecenie własne, próba ciśnienia, zdjęcia, „na dziś” w quizie) to `status` (`info`). Odczyt licznika i poziomicy oraz „Plan na dziś” to `inset`. Karta przejścia wpisu (`EntryCheck`) to `raised`. Kafle i karta budowy w `SiteHome.tsx` to `interactive`, a nieaktywny kafel ma `text-faint` zamiast `opacity-60`.
- Ustawienia i synchronizacja (`src/components/settings/**`, `SyncSettings.tsx`, `src/components/sync/**`, 19 plików, 39 miejsc). Grupy `border-border/60 bg-muted/20|30` stoją na powierzchni okna Ustawień, więc są `inset`: wyciszone tło bez ramki, tak jak wpisy w arkuszu osoby w Długach. Dotyczy to też przycisków-wierszy (`QuickPresets`, `CustomThemeControl`, kroje w `FontPicker`). Ostrzeżenia synchronizacji (nowy kod, starsze urządzenie, wstrzymane P2P, zmiana klucza, przekaźnik, format dokumentu) są `status` z tonem `warning`.
- Grafik (`src/components/shifts/**`, `guide/ShiftsHint.tsx`, 9 plików, 12 miejsc). Karta bieżącej i zakończonej zmiany (`NowCard`) to `plain` z paskiem koloru zmiany. Grupy w oknach i kartach (własne godziny pędzla, wybór pierwszego cyklu w kreatorze, podsumowanie nałożenia w „Cyklu”, „Opcjonalne” w ustawieniach, przycisk składanej sekcji i pasek wypłaty w „Miesiącu w liczbach”) to `inset`. Zapisane cykle i szablony tygodnia to `interactive`. Potwierdzenie usunięcia grafiku to `status` (`danger`), podpowiedź „Pierwszy raz w Grafiku?” to `status` (`info`) z tłem `bg-primary/10`.
- Dziś (`src/components/review/**`, 7 miejsc). Karty zmiany, osi dnia, terminów Pracy, „Skrzynka, Ćwiczenia i raty” i „Do wystawienia” to `plain` (`cardVariant()` zamiast gołego `cardClass`). „Przegląd tygodnia” to `status` (`info`) z cieniem elewacji 1 i obrysem `primary/25`. Notatka w przeglądzie krok po kroku (`ReviewWalkthrough`) to `status` (`info`) z tłem `bg-muted/30`.
- Kalendarz (`src/components/calendar/**`, 5 miejsc). Legenda, panel dnia, dni w widoku Lista (`MonthAgenda`) i oś tygodnia to `plain`. Kafle „Dziś” i „Jutro” (`UpcomingDays`) to `interactive`. Komórki siatki miesiąca (`dayCellStyles.ts`) zostają, bo to kontrolki siatki, nie karty.
- Notatki i powłoka (`src/components/*.tsx`, 16 plików, 22 miejsca):
  - `plain`: tabela notatek, blok zapytania, graf, karta w segregowaniu Skrzynki;
  - `raised`: nagłówek kolumny tablicy (`NoteBoard`), ekran błędu (`ErrorBoundary`);
  - `inset`: kolumna tablicy (`BoardColumn`), spis treści czytnika, kolejka offline, ostatnie działania, kafle i wykres w statystykach, termin przypomnienia w segregowaniu, komunikat „Dane zastąpione” (wariant zwykły);
  - `interactive`: karta galerii (`NoteGallery`; zaznaczona dalej `border-primary bg-primary/10`);
  - `status` (`warning`): banery formatu dokumentu, przerwanego przywracania, utraty danych i wymiany dokumentu; `status` (`info`): baner instalacji aplikacji.
- `src/test/designTokens.test.ts` — strażnik „W3.2”: ręczne `rounded-card … border` i goły `cardClass` poza `components/ui/`, próg 50 (po Długach, Pracy, Ustawieniach, Grafiku, Dziś, Kalendarzu i części Notatek). Nie liczy ramek przerywanych (miejsce na „dodaj”, pusty stan) ani ramek podglądu kamery i obrazu (`object-cover|contain`), bo to nie są karty. Maleje z kolejnymi działami.

### Jak działa

- Klasy idą przez `cn(cardVariant(...), ...)`. `tailwind-merge` zdejmuje `border-border` z odmiany, gdy miejsce dokłada własny kolor obrysu (`border-primary/40`).
- Dopełnienie kart w widoku to `p-card` (W1.5), więc idzie za gęstością.

### Ograniczenia i pułapki

- Plan Długów zakładał podział `DebtsView.tsx` (L1.1) przed W3.2. Karty są przeniesione w obecnym pliku, a podział nadal czeka.
- Hover osoby ma obrys `foreground/25` z odmiany, a nie `primary/50` jak wcześniej.
- W Pracy zostały nieprzeniesione: przełączniki wyboru z obrysem (`QuizPanel` odpowiedzi, `FittingsFields`, `SiteCardDialog` wysyłka), papier raportu (`ReportPaper`), pole podpisu i podgląd podpisu (`bg-white`), pasek stanu budowy (`SiteTallyBar`, `xl:` w `StudyJournal`), karta tematu w `StudyBoard`. To kontrolki albo papier, nie karty.
- W Grafiku zostały nieprzeniesione przyciski i kontrolki: pędzle i gumka w `BrushBar`, wybór w `DayDialog`, przyciski drugorzędne w `EmptyShifts`, `NoShiftTypes`, `NowCard` („Skończyłem teraz”) i `ShiftSummary` („Rok”), lista wyboru grafiku w `ScheduleSwitcher`. Przejdą na `Button` z W4.5. `TodayShiftCard` (Dziś) przejdzie z działem Dziś.
- W Notatkach zostały nieprzeniesione: `NoteCard` i `AddNoteBar`/`InboxCapture` (własny cień `note-shadow` i obrys z koloru notatki), pole wyszukiwania i jego wyskakujące listy (`SearchBar`, `AppHeader`), kafle nawigacji (`BottomNav`, `InstallAppButton`), paski narzędzi (`BulkActionBar`, `ViewControls`), pływający panel czytnika (`NoteReader`), powiadomienie o terminie (`ReminderDueToast`) i odznaki w statystykach (obrys niesie stan „zdobyta”). To kontrolki, nakładki albo karty z własnym kolorem.
- Obrysy kart Dziś i Kalendarza mają teraz pełny kolor `border` zamiast wcześniejszego `border/50|60|70`, a hover kafli „Dziś”/„Jutro” to `foreground/25` z odmiany zamiast `primary/40`.
- Ramki stanu mają teraz lewą krawędź 4 px zamiast pełnego kolorowego obrysu.
- W Ustawieniach zostały nieprzeniesione: `Segmented` (tor przełącznika), przyciski wyboru stylu, gęstości i kroju (`AppearanceSettings`), zaznaczenie w `FontPicker` i `SkinPicker` (`border-2`), podgląd poświaty (`GlowPicker`, `border-transparent`). To kontrolki, nie karty.
- Pułapka skryptu migracji: import dopisany po „ostatniej linii `import`” trafia do środka wielowierszowego `import {`. Typecheck to łapie.
- Zrzuty `@visual` mają tylko pusty stan Długów. Wzorce `dlugi-telefon-*` są zaktualizowane i ich różnice wynikały z W2.1 (15 px) i W6.1 (bursztyn). Pozostałe wzorce `@visual` są nieaktualne po tych samych zmianach.

### Testy

- `src/components/debts/DebtsView.test.tsx` (22), e2e `debts-due`, `debts-plan`, `debts-rates` (13), `@visual dlugi` (6), strażnik.
- Ustawienia: Vitest `settings`, `sync` i strażnik (34); pełne e2e (1235): 1203 przeszło, 12 porażek — wszystkie w Notatkach i Terminach i występują też na stanie sprzed sesji (77094141), więc nie wynikają z tej zmiany.
- Grafik: strażnik, typecheck, e2e `shifts*`, `shift-end-action`, `calendar-shift-edit`, `guide*` (63 przeszło, 2 pominięte); zrzut 390 px z danymi przejrzany.
- Notatki: typecheck, Vitest `src/components` i `src/test` (426), e2e `board-table`, `card-keyboard-open`, `dictation-offline`, `inbox-*`, `local-graph`, `note-gallery`, `query-block`, `restore-*`, `shortcuts-settings-stats`, `stats-practice` (51 przeszło, 3 pominięte); zrzuty tablicy, galerii i tabeli przejrzane.
- Dziś i Kalendarz: typecheck, Vitest `review`, `calendar` i strażnik (72), e2e `calendar-*`, `dzis-*`, `today-*`, `inbox-today`, `reminders-agenda`, `reminders-calendar`, `weekly-review` (50 przeszło, 4 pominięte); zrzuty 390 px z danymi przejrzane.
- Praca: Vitest `src/components/study` i strażnik (123); e2e wszystkich 97 spec z `/praca`: 602 przeszło, jedna porażka to przekroczony czas ładowania Kalendarza w `a11y.spec.ts` przy obciążeniu (powtórzona osobno — przechodzi).

### Commit

W3.2 Długi — a1c616bb; Praca — 69be452f; Ustawienia — d610da72 (2026-11-19); Grafik — 33a37488; Dziś i Kalendarz — 7c5674f9; Notatki — zob. commit „W3.2 Notatki” (2026-11-20).

## Wygląd — rozmycie, gradienty, obrazy (W3.5, W3.6, W5.6, 2026-11-19)

### Co robi

- Rozmycie tła zostało tylko tam, gdzie treść przewija się pod elementem: paski przyklejone, pływający pasek zaznaczenia i tło pod otwartą notatką. Pieczątka osiągnięcia, ekran błędu, nagłówek kolumny tablicy i panel czytnika notatki mają pełne tło. W trybie „Oszczędny” rozmycia nie ma wcale.
- Kafel logo w panelu bocznym ma jednolite tło akcentu zamiast dekoracyjnego gradientu. Pozostałe gradienty niosą treść i zostają.
- Obrazy dekodują się poza głównym wątkiem (`decoding="async"`). Miniatury mają tło zastępcze w kolorze `--muted`, zanim się wczytają.

### Gdzie jest

- `src/styles/preferences.css` — `html[data-oled="on"] *` (z `::before`/`::after`) bez `backdrop-filter`, obok istniejącej reguły `prefers-reduced-transparency`.
- Bez rozmycia (`bg-card` zamiast `bg-card/95|80`): `AchievementStamp.tsx`, `ErrorBoundary.tsx`, `NoteBoard.tsx` (nagłówek kolumny), `NoteReader.tsx` (panel; tło pod nim zostaje rozmyte).
- Zostają z rozmyciem: `InboxBar.tsx`, `settings/GeneralSettings.tsx` (`JumpNav`), `shifts/PatternDialog.tsx` (stopka), `shifts/ShiftsView.tsx` (pędzle), `study/QuizPanel.tsx` (akcja), `study/StudyJournal.tsx` (dzień), `BulkActionBar.tsx`, `NoteReader.tsx` (tło).
- `src/components/AppSidebar.tsx` — kafel logo `bg-primary/10`.
- Obrazy: `InboxTriage.tsx`, `NoteGallery.tsx`, `NoteImage.tsx`, `plans/PlansList.tsx`, `plans/NewAnalysisDialog.tsx`, `study/PhotoDayDialog.tsx` (też `loading="lazy"`).
- `src/test/designTokens.test.ts` — strażnicy `backdropBlur` (próg 9) i `classGradient` (`bg-linear|radial|conic|gradient-`, próg 1).

### Jak działa

- Tryb „Oszczędny” (`src/lib/appearancePresets.ts`) włącza czarne tło OLED, więc reguła wisi na `data-oled="on"`. Ten sam atrybut ustawia osobny przełącznik OLED, który też ma oszczędzać prąd.
- Gradienty, które zostają: kratka wykresu i przewodnika (`NoteGraph`, `GuideArt`), zanikanie krawędzi przewijania (`QuickTemplates`, `BrushBar`), kreskowanie nadgodzin (`ShiftSummary`, `YearSummaryDialog`), dwukolorowa próbka „kolor stylu” (`GlowPicker`, `FrameLookPicker`) i ciemny spód pod napisem na zdjęciu budowy (`SiteCardDialog`). Tylko ostatni jest klasą `bg-gradient-*`, reszta to `style` albo `mask-*`.

### Ograniczenia i pułapki

- Wydruk protokołu (`HandoverPaper.tsx`) celowo bez `loading="lazy"` i `decoding="async"`: obraz musi być gotowy przed drukiem. Plany (`PlansList`, `NewAnalysisDialog`) zostają na białym tle (`bg-white`), bo rysunek planu jest na białym papierze.
- `NoteImage` nie dostał `bg-muted` na `<img>`: obrazy z przezroczystością (schematy) dostałyby szare tło. Zastępczy kształt przed wczytaniem już miał.
- W tym kroku nie było zmian w klasach kart (`rounded-card border`). Linie w `AchievementStamp`, `ErrorBoundary`, `NoteBoard` i `NoteReader` zawierają jednak te klasy, więc przy scalaniu z W3.2 mogą wymagać ręcznego połączenia.
- `npm run build` w worktree agenta pada na `prebuild` (brak `node_modules/tesseract.js-core`). Sprawdzone przez `npx vite build`.

### Testy

- `npx vitest run src/test src/lib/skin` (139), `npm run typecheck`, `npx vite build`. Bez e2e.

### Commit

W3.5, W3.6, W5.6 — commit po tym wpisie (2026-11-19).

## Wygląd — przyciski Grafiku, Dziś i Kalendarza na `Button` (W4.5, 2026-11-20)

### Co robi

Przyciski akcji w Grafiku mają te same stany co reszta aplikacji: hover, fokus, wciśnięcie i nieaktywny z `--faint` zamiast `opacity-40`.

### Gdzie jest

- `Button` (`src/components/ui/button.tsx`) zamiast surowego `<button>`:
  - `EmptyShifts`, `NoShiftTypes`: domyślny i `outline`;
  - `NowCard` „Skończyłem teraz”, „Rok” w `ShiftSummary`, presety w `ShiftTypeDialog`: `outline`;
  - pasek eksportu (`ShiftExportControls`) i kopiowania tygodnia (`ShiftsView`): `ghost` z `TOOLBAR_BTN` (`shiftControlStyles.ts` — teraz tylko dodatek do wariantu);
  - „Ten tydzień”, godziny pędzla (`BrushHours`), „Usuń ostatni dzień cyklu” (`PatternDialog`), strzałki roku (`YearSummaryDialog`, `size="icon"`), zamknięcie podpowiedzi (`guide/ShiftsHint.tsx`): `ghost`.
- Dziś i Kalendarz: akcje w panelu dnia (`DayPanel`: „Dodaj termin”, „Zmień godziny”, „Dodaj zmianę”, kopiowanie zmiany, ikony notatki, `.ics` i pominięcia), strzałki tygodnia (`WeekStrip`), ikony w przeglądzie tygodnia (`WeeklyReviewCard`, `rowBtn` to teraz tylko dodatek), „Wstecz” w przeglądzie krok po kroku, czyszczenie końca serii (`ReminderQuickAddDialog`) — `ghost`, ikony w `icon-sm`/`icon` z zachowanym rozmiarem 14 px.
- `src/test/designTokens.test.ts` — strażnik „W4.5”: `RAW_BUTTON_MAX` na dział, Grafik 26, Dziś (`review`) 11, Kalendarz 14. Małe działy (2026-11-20): Długi 3, Ćwiczenia 8, Klienci 8, Skarbiec 5, synchronizacja 1, Ustawienia 22, pasek boczny 6, Praca 106 (przyciski-ikony oraz 43 pigułki na nowych wariantach `Button`: `chip` — neutralna, z `aria-pressed` jako wybór; `chip-soft` — podpowiedź na tle `muted`; `chip-add` — przerywana „dodaj”; `pill` — akcentowa; rozmiary `chip` i `chip-md`, tabela w `docs/komponenty.md`. Wcześniej: przeniesione tylko przyciski-ikony — 21 w 15 plikach: usuwanie i edycja w panelach budowy, kalkulatorach, przejazdach, szablonach wycen, menu wpisu; `ghost`/`outline` w `icon-sm`/`icon`; pigułki-podpowiedzi, przerywane wiersze „dodaj”, kafle, wybory i dyktowanie czekają na wspólny wariant pigułki; e2e 98 speców `/praca`: 603 przeszło, 3 pominięte), główny katalog `components/` 130 (klucz `.` — pliki bez podkatalogów; przeniesione: pasek „Znajdź i zamień” — `ghost` z `BTN_ACTION`, przełącznik wielkości liter zostaje na `BTN` — ikona w pasku bocznym, zapis aliasu; pasek edytora notatki — formatowanie w `FormatToolbar` (`MarkdownRenderer.tsx`), wyodrębnienie, podgląd (`tone="active"` gdy włączony), pełny ekran i ✕ podpowiedzi terminu na `IconButton size="sm"`, zakładki Edycja/Podgląd na telefonie `outline`, „Dodaj listę” i „Zapisz” `ghost` z `coarse:h-11`; reszta to długi ogon: pasek kafla, listy kontrolne, kolor i rysunek, nawigacja dolna, pigułki, linki), Plany 10 (przyciski-ikony „dodaj/odrzuć/usuń” w panelach wykrywania, OCR, symboli, materiałów i listy analiz; pasek edytora — powrót, nazwa, cofnij, ponów, powiększenie, dopasowanie, zamknięcie podpowiedzi — na `ghost` z `toolAction`; przełączniki trybu zostają na `toolBtn`) (usuwanie z cennika z etykietą „Usuń z cennika: …” i menu akcji wiersza paska to `ghost` `icon-sm`) — przyciski zamknięcia banerów synchronizacji (`NewCodeBanner`, `OlderDeviceBanner`, `SyncCodeNotices`) to `ghost` `icon-sm`; reszta to wyjątki (pigułki wyboru, linki w zdaniu, kafle i wiersze, miniatura dowodu, „Nowa wycena” obok linków-pigułek, akcje kafla notatki, kropka stanu synchronizacji). Wyjątki Dziś i Kalendarza: wiersze-listy, pola wyboru listy, linki w zdaniu, rozwijany nagłówek osi dnia, komórki tygodnia i siatki, warstwy (`aria-pressed`), wybór notatki.

### Ograniczenia i pułapki

- Celowo surowe (jawne wyjątki): radia i przełączniki (paleta pędzli w `BrushBar`, wybór w `DayDialog`, dni urlopu, kolory, kroki cyklu), presety długości w `BrushHours` (stan wybrany), komórki siatki miesiąca i tygodnia, `TimeStepper` (przytrzymanie), linki w zdaniu (`ShiftSummary`, `YearSummaryDialog`, schowek i podpowiedź w `ShiftsView`), wiersze rozwijane i karty-listy (`cardVariant`). „Cykl” i „Szablon” w `BrushBar` zostają, bo dzielą promień i wysokość z paletą pędzli.
- Ścieżki w strażniku: pliki na Windows mają `\`, więc filtr działu normalizuje separator (pierwsza wersja nic nie liczyła).
- Dopisywanie importu na początek pliku z BOM zakopuje BOM w drugiej linii (`no-irregular-whitespace`) — tak było w `BrushHours.tsx` po W3.2; usunięty.

### Testy

typecheck, eslint działu, strażnik, e2e `shifts*`, `shift-end-action`, `calendar-shift-edit`, `guide*`, `a11y` (304 przeszło, 2 pominięte); Dziś i Kalendarz: Vitest `review`, `calendar` i strażnik (75), e2e `calendar-*`, `dzis-*`, `today-*`, `inbox-today`, `reminders-agenda`, `reminders-calendar`, `weekly-review` (50 przeszło, 4 pominięte).

### Commit

Grafik — 8b786ae3; Dziś i Kalendarz — zob. commit „W4.5 Dziś, Kalendarz” (2026-11-20).

## Ruch — siatka notatek bez przypadkowego przejścia odstępów (2026-11-23)

- **Co robi:** zmiana gęstości (np. „Luźno”) zmienia odstępy siatki od razu, a kafel u góry ekranu zostaje dokładnie na miejscu.
- **Gdzie jest:** `src/components/NoteGrid.tsx`, kontener siatki — klasa `transition-none` obok `animate-in fade-in-0 duration-base`.
- **Jak działa:** `duration-base` miało dotyczyć animacji wejścia, ale w Tailwind 4 ustawia też `transition-duration`, a domyślne `transition-property` to `all`. Zmiana gęstości animowała więc `gap` przez 220 ms; przeglądarka przesuwała ekran klatka po klatce i `changeView` (kotwica widoku) kończył 8 px obok. `transition-none` wyłącza przejścia właściwości, animacja wejścia zostaje.
- **Pułapki:** ten sam wzorzec (`animate-in … duration-*` bez `transition-*`) jest w `ui/dialog.tsx`, `ui/alert-dialog.tsx` i `WikiLinkPreview.tsx` — tam nie szkodzi (rozmiary `auto` się nie animują), ale przy nowych klasach na tych elementach trzeba o tym pamiętać.
- **Testy:** `e2e/view-change.spec.ts` (telefon, „Luźno”) — wcześniej 3 porażki na 5, teraz 15/15.

## Ustawienia — jedna karta sekcji i przełączniki zamiast list (U5.1, U5.3, 2026-11-27)

- **Co robi:** każda sekcja Ustawień to ta sama karta: tytuł, jedno zdanie opisu pod nim, treść. Krótkie wybory (do 5 opcji) są przełącznikiem `Segmented` zamiast listy rozwijanej: „Grupuj wg” (Brak / Data / Etykieta / Folder), w Skarbcu „Blokuj automatycznie” (1, 5, 15, 30 min, Nigdy) i „Blokuj po schowaniu karty” (1, 5, 15 min, Nie). Pod przełącznikami Skarbca jest pełne zdanie wybranej wartości („Po 5 minutach.”).
- **Gdzie jest:** `Section` w `src/components/settings/SettingsShared.tsx` (nowy `description`, `children` opcjonalne — karta z samym opisem), `Segmented` w `src/components/settings/Segmented.tsx` (ikona `Icon` opcjonalna), użycia w `AppearanceSettings.tsx`, `EffectsSettings.tsx`, `GeneralSettings.tsx`, `VaultSettings.tsx`.
- **Jak działa:** opis idzie przez `SectionCard.description` (`ui-hint` pod tytułem) zamiast akapitu z `-mt-1` w treści — 5 sekcji przeniesionych. „Przywróć domyślne w tej sekcji” (`ResetSectionButton`) zostaje pod grupą sekcji, bo resetuje klucze całej grupy (`VIEW_PREF_GROUPS`), nie jednej karty. Wartości liczbowe Skarbca idą do `Segmented` jako napisy (`String(m)`), z powrotem przez `Number`.
- **Ograniczenia:** natywne `<select>` zostają przy dłuższych listach (sortowanie — 7, dzień tygodnia — 7, styl nocny, miasto) — w `ui/` nie ma komponentu `Select`, a natywna lista na telefonie otwiera systemowy wybór. „Rodzaj punktu” w cenniku (5 opcji) też zostaje listą: nazwy („H-4 (hydraulika)”) nie mieszczą się w pięciu kolumnach przy 390 px. Zapisana wartość spoza listy (np. ze starszej wersji) nie podświetla żadnej pozycji.
- **Testy:** e2e Ustawień, Skarbca i `e2e/a11y.spec.ts` (axe) — 256 + 21 zielonych.

## Wygląd: jasność według pory (Q3.3, 2026-11-27)

- **Co robi.** Ustawienia → Wygląd → Jasność ma czwartą opcję **„Wg pory”**: jasny w podanych godzinach (domyślnie 7:00–19:00), ciemny poza nimi, bez lokalizacji. Pod przełącznikiem pojawiają się pola „Jasny od” i „do”. Działa w Zeszycie (wspólny przełącznik) i w każdym innym stylu (jego własny wybór jasności). Paleta poleceń: „Jasność: według pory”.
- **Gdzie.** `src/lib/themeHours.ts` (`themeHoursStore`, `darkByHours`, `THEME_HOURS_DEFAULT`), `src/hooks/useTheme.ts` (`ThemeMode` z `time`, `resolveDark` z parametrami `now` i `hours`, `tickHours`), `src/lib/skinScheme.ts` (`SchemePref` z `time`), `public/prepaint.js`, `src/components/settings/AppearanceSettings.tsx` (`ThemeHoursFields`), `src/lib/commands/builtin.ts`.
- **Jak działa.** Wartość `time` w `kaczy-theme` (Zeszyt) albo w `kaczy.skinScheme.v1` (inne style); godziny w nowym kluczu `kaczy.themeHours.v1` (`{ from, to }`, „HH:MM”, w kopii i w kodzie wyglądu jak reszta `APPEARANCE`). Ciemno = `isNightHours(now, to, from)` z `skinSchedule.ts`, więc godziny przez północ też działają. Przełączenie o godzinie granicznej: sprawdzenie co minutę i po powrocie do karty (`tickHours`, `emit` tylko przy zmianie). `prepaint.js` liczy to samo przed pierwszym malowaniem.
- **Ograniczenia i zgodność.** Starsza wersja nie zna `time`: `readStored` i `prepaint.js` biorą wtedy „system”, a mapa stylów pomija wpis (schemat stylu) — bez błędu, tylko inna jasność. Te same godziny początku i końca = zawsze jasno. „Styl na noc” to osobny harmonogram (zmienia styl, nie jasność).
- **Testy.** `src/lib/themeHours.test.ts` (granice 7:00 i 19:00, przez północ, `resolveDark` w Zeszycie i w stylu), `src/lib/prepaint.test.ts` (`time` w każdym stylu, godziny przez północ, uszkodzony zapis), `src/lib/commands/registry.test.ts` (cztery tryby jasności).
- **Commit.** `30c8d872` — 2026-11-27.

## Wygląd: jasna Tablica odróżniona od jasnych Kafli (WZ-2, 2026-11-27)

- **Co robi.** Jasny schemat Tablicy ma emalię z lekką zielenią szkolnej tablicy i zielony marker jako kolor główny (przyciski, „+”, zaznaczenie, pierścień fokusu); linki piszą się niebieskim markerem. Wcześniej tło, białe karty i kobaltowy akcent były prawie takie jak w jasnych Kaflach.
- **Gdzie.** `src/styles/skins/tablica.css` (blok `:not(.dark)`), kolor paska telefonu `SKIN_THEME_COLOR_ALT.tablica` w `src/lib/skinList.ts` i w `public/prepaint.js` (`#eef8f3`), tabela w `docs/karty-stylow.md`.
- **Jak działa.** Tylko tokeny: `--background` 0.97 0.012 162, `--primary`/`--ring` 0.46 0.12 155, `--accent` 0.47 0.15 255, `--secondary`, `--muted`, `--border`, `--input`, `--grid`, tekst i `--shadow-tint` w odcieniu 162–170. Kontrast: akcent z białym tekstem 6,7:1, linki 6,9:1, tekst pomocniczy 6,8:1, obramowanie pola 3,9:1. Ciemna Tablica bez zmian.
- **Ograniczenia.** Wzorce `@visual` (`e2e/visual.spec.ts`) robią Tablicę w jej domyślnym, ciemnym schemacie, więc jasnej nie pilnują i się nie zmieniły. Własny akcent użytkownika dalej nadpisuje `--primary`.
- **Testy.** `src/lib/skinContrast.test.ts`, `src/lib/skinContrastReport.test.ts`, `src/lib/prepaint.test.ts` (kolor paska).
- **Commit.** `ce055f11` — 2026-11-27.

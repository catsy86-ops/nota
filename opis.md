# Opis techniczny Notatnika

Dokumentacja aktualnego stanu funkcji — co robią, gdzie są w kodzie i jak działają.
Plik opisuje stan bieżący, nie historię: przy zmianie funkcji poprawiaj jej opis.
Zasady prowadzenia: `CLAUDE.md`, sekcja „Dokumentacja techniczna”.

Działy opisane do tej pory: **Wspólne — style, krój tekstu, tryb budowa i mikrointerakcje**, **Wspólne — warstwa UI**, **Wspólne — biblioteki UI (Radix, lucide, sonner)**, **Wspólne — audyt dostępności i testy na telefonach**, **Wspólne — klawiatura ekranowa**, **Wspólne — cele dotyku**, **Praca** (nagłówek i tablica) i **Praca → Dziennik budowy**.
Pozostałe działy (Notatki, Grafik, Kalendarz, reszta Nauki) dopisuj, gdy zadanie ich dotyczy.

## Dokumenty usunięte (2026-10-21)

Z repozytorium usunięto dokumenty bez otwartych zadań: zrealizowane plany, przegląd kodu, archiwum i dziennik wdrażania. Zostały w historii git do commitu `cb8e4f8` (`git show cb8e4f8:<ścieżka>`). Żywe zadania są w `roadmap.md` (jedyne otwarte: 5.3, QA na telefonie). Zostają: `README.md`, `CLAUDE.md`, `AGENTS.md`, `opis.md`, `roadmap.md`, `docs/GOTCHAS.md`, `push-server/README.md`, `signaling-server/README.md` oraz pliki w `.claude/`.

| Plik | Był | Status |
| --- | --- | --- |
| `docs/plan-audyt-2026-10-18.md` | plan po audycie | zrealizowany |
| `docs/plan-wizualny-2026-10-18.md` | plan upiększenia | zrealizowany (B4 zrobione) |
| `docs/plan-mobile-rozbudowa-2026-10-18.md` | plan telefonu | zrealizowany |
| `docs/plan-synchronizacja-2026-10-18.md` | plan sync | zrealizowany |
| `docs/plan-praca-2026-10-18.md` | plan Pracy | zrealizowany |
| `docs/plan-notatki-2026-10-19.md` | plan Notatek | zrealizowany |
| `docs/plan-kalendarz-2026-10-19.md` | plan Kalendarza | zrealizowany |
| `docs/plan-kalendarz-przypomnienia-2026-10-19.md` | plan przypomnień w Kalendarzu | zrealizowany |
| `docs/plan-ustawienia-2026-10-19.md` | plan Ustawień | zrealizowany (fazy 1–3) |
| `docs/plan-przypomnienia-2026-10-20.md` | plan Terminów | zrealizowany |
| `docs/plan-cwiczenia-2026-10-20.md` | plan Ćwiczeń | zrealizowany; opis działu w sekcji „Ćwiczenia” |
| `docs/code-review-2026-10-20.md` | przegląd kodu | poprawki zrobione (b779947, 1b8bcf8, 1380f10) |
| `docs/archiwum/noti.md` | archiwum planu kont | nieaktualne (opisywało konta, których aplikacja nie ma) |
| `docs/FEATURES-LOG.md` | dziennik wdrażania | historia; najnowsze wpisy w `roadmap.md` |

---

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
- **„+” na pasku:** stuknięcie otwiera nową notatkę; przytrzymanie — arkusz „Nowa” (Notatka, Lista zadań, Dyktuj, Zdjęcie, Rysunek; „Dyktuj” tylko tam, gdzie jest rozpoznawanie mowy). Pierwsze stuknięcie pokazuje jednorazową podpowiedź o przytrzymaniu (`kaczy.fab.hint.v1`).
- **Klawiatura ekranowa** (`src/lib/keyboardInset.ts`, wołane w `main.tsx`): na `<html>` ustawiane są `--kb-inset`, `data-keyboard` i `data-typing`. `data-typing` = fokus w polu tekstowym i klawiatura otwarta (iOS: `--kb-inset` > 0; Android: okno niższe o >80 px od najwyższego widzianego). Pasek nawigacji zjeżdża `translate` i znika (`in-data-typing:`), bez `transform`, który należy do animacji wejścia. Pełny ekran kompozytora kończy się nad klawiaturą (`--kb-inset`).
- **Formularze jako arkusz.** `ResponsiveDialogContent` (= `DialogContent` z trybem `sheet`) na telefonie (`phone:`) wysuwa się od dołu także w poziomie; pasek `ResponsiveDialogFooter` (przycisk „Zapisz”) jest przyklejony do dołu arkusza. Na komputerze zwykłe okno na środku. Formularze: `CustomTemplateDialog`, `ImportExternalDialog`, `VaultDialogs`, `ReminderQuickAddDialog`, `DayDialog`, `ShiftTypeDialog`, `PatternDialog`, `ShiftSettingsDialog`, `JournalReport`, `SiteCardDialog`. Okna z `p-0` (raport, karta budowy) nie mają stopki.
- **Zwykłe okna na telefonie** są wyśrodkowane z marginesem 1 rem, zaokrąglone, przewijają się w środku (`max-h-[calc(100dvh-2rem)]`; `dvh`, nie `vh`, bo pasek adresu). Arkusz nadpisuje wymiary (`max-sm:max-w-none`, `max-h-[92dvh]`). Okna pełnoekranowe (`FocusMode`, ustawienia na telefonie, rysownik) ustawiają `max-sm:max-w-none max-h-none` same — inaczej dostają margines.
- **Pasek zbiorczy** (`BulkActionBar.tsx`) na telefonie zawija akcje w drugi rząd (`max-sm:flex-wrap`), zamiast chować je za przewijaniem w bok. Przy 320 i 390 px żadna z 9 tras nie przewija się w bok (`mobile-layout.spec.ts`).

### Cele dotyku (44 px)

- Na `pointer: coarse` małe przyciski mają pole co najmniej 44 × 44 px bez zmiany wyglądu: widoczny przycisk 36 px + niewidzialne `::after` (`coarse:after:-inset-1`). Wzorzec w `ui/icon-button.tsx` (`size="sm"`), również w pasku bocznym (ikony folderów, etykiet, filtra, „⋯”).
- Grafik: przyciski miesiąca i „Skopiuj ten tydzień” mają `coarse:h-11`. Zakładki działu Praca mają `coarse:min-h-11`.
- Ograniczenie: `::after` strzałki podfolderu zachodzi na wiersz folderu — stuknięcie tuż przy strzałce ją rozwija.

### Tryb budowa

- Ustawienia → Wygląd → „Tryb budowa” (Wyłączony / Włączony / Automatycznie; „Automatycznie” włącza się, gdy system prosi o większy kontrast). `src/lib/siteMode.ts`, klucz `kaczy.siteMode.v1` (w kopii).
- Skala 112,5% przez `font-size` na `html` (`src/styles/site.css`): tekst 18 px, przyciski ikonowe co najmniej 54 px (`--tap: 3rem`, niewidzialne `::after`), mocniejsze krawędzie i tekst pomocniczy, gładkie tło bez kratki, dymki „Cofnij” 8 s.
- Elementy w px (dolny pasek 64 px, kafle) nie rosną. Nowy przycisk ikonowy poza `IconButton`/`Button` potrzebuje klasy `.tap-target`.

### Wibracje

- `src/lib/haptics.ts`: `haptic(kind)` (`tap`, `success`, `warn`, `selection`). Krótkie drgnięcie na Androidzie (`navigator.vibrate`) przy zapisie, odhaczeniu, przejściu w pasku, odpowiedzi w quizie, zapisie wpisu.
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

- `src/lib/viewPreload.ts`: jedna zapamiętana obietnica importu na widok (`loadCalendarView`, `loadShiftsView`, `loadStudyView`). Najechanie kursorem lub dotknięcie pozycji nawigacji zaczyna pobieranie. Szkielet `ViewSkeleton` pojawia się po 180 ms (bez migania przy szybkim ładowaniu); pulsowanie wyłączone przy ograniczonym ruchu. Nowy widok leniwy: dopisać do `loaders` i `LABELS`.
- `src/lib/pageHidden.ts`: gdy karta jest w tle, `html[data-hidden]` wstrzymuje wszystkie zapętlone animacje (`animation-play-state: paused`). Przejścia nie są wstrzymywane.

### Ruch: framer-motion, przejścia, mikrointerakcje

- **LazyMotion.** `App.tsx` owija aplikację w `<LazyMotion features={loadMotionFeatures} strict>`; pełny zestaw funkcji (`src/lib/motionFeatures.ts`) jest w osobnej paczce tuż po starcie. Komponenty importują `m as motion` (pełne `motion` w trybie `strict` to błąd). Wejściowy JS po tej zmianie 372,4 KB gzip. Do załadowania funkcji animacje wejścia nie grają.
- **Czasy i sprężyny** z `src/lib/motion.ts` (`spring.snap`, `spring.soft`, `tween.enter`). Animowane są tylko `transform` i `opacity`. Ograniczony ruch obsługuje `MotionConfig` w `App.tsx`.
- **Przełączniki** (`settings/Segmented.tsx`, `SkinPicker`): podświetlenie przesuwa się sprężyną (`layoutId` w `LayoutGroup` z `useId`). `RollingNumber` (licznik notatek) przewija cyfrę. Ikona słońca/księżyca obraca się.
- **Listy:** zwijanie grupy w Notatkach opada wysokością; wiersz tabeli usunięty lub zarchiwizowany gaśnie, nowy wjeżdża (bez animacji przy pierwszym montażu); szkielet kart Dziś rezerwuje miejsce; pusty stan gaśnie.
- **Mikrointerakcje stanów:** pole z błędem (`aria-invalid`) ma czerwoną ramkę; przełączniki i checkboxy podświetlają się po najechaniu; suwak ma halo; tosty mają przycisk × (błąd 9 s można zamknąć); Enter i Spacja po dotyku nie włączają ramki fokusu (`src/lib/inputModality.ts`). Przycisk „ładuje” (wspólny prop `loading`) nie jest zrobiony.
- **Podpis wciśnięcia** przycisków to klasa `pressable`, nie skala framer-motion.
- **Przejście motywu** kołem (View Transitions, `clip-path: circle()` od ostatniego dotknięcia, ≤1,5 s). Wyłączone przy ograniczonym ruchu i efekcie „themeFade”.
- **Przejście widoku** przez `document.startViewTransition` z `flushSync` w `Index.tsx`; bez View Transitions zmiana natychmiastowa.

### Wygląd: style, kroje, tokeny, pieczątki

- **Style** (`src/lib/skins.ts`, `skinStore`, klucz `kaczy.skin.v1` w kopii; CSS w `src/styles/skins.css`): Zeszyt (domyślny, kratka, bursztyn, niebieski długopis; słucha przełącznika Jasność), Plan (ciemny, rysunek techniczny, granat, nagłówki Barlow Condensed, tabliczka rysunkowa tylko na komputerze), Neon (ciemny, nagłówki Unbounded, logo z mrugnięciem), Zorza (ciemny, dryfująca zorza tylko przez `transform`, szklane kafle na komputerze, Fraunces), Miedź (jasny, beton, miedziana rura przy pasku bocznym, Bricolage Grotesque), Matryca (ciemny, zielone znaki spadające na płótnie `src/components/skins/MatrixRain.tsx`, ~24 klatki/s, DPR ≤1,5, wstrzymany w ukrytej karcie; ograniczony ruch = statyczny obraz; parametry w `matrixParams.ts`, płótno ładowane leniwie przez `PaperBackdrop.tsx`; płótno przygaszone do 0,6 krycia, gaśnie pod nagłówkiem (górne ~260 px) i ma ciemną winietę za środkiem, żeby tekst pustego stanu był czytelny; `skins.css`) i Hydraulika (ciemny, woda animowana tylko przez `transform` (`hydro-flow`), bąbelki (`hydro-rise`) w CSS; rury z niższym kryciem niż na początku). Testy: `e2e/skin-motion.spec.ts` (płótno, winieta, bąbelki, ograniczony ruch). Każdy styl ma schemat jasny/ciemny (`SKIN_SCHEME`); `html[data-skin]` jest zawsze ustawiony. Nowy styl: dopisać do `SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR`, `SKIN_META`, `skins.css` i listy w `e2e/a11y.spec.ts`.
- **Motyw pory roku** (`src/lib/seasonTheme.ts`, `src/lib/season.ts`, klucz `kaczy.seasonTheme.v1`; wybór w Ustawienia → Wygląd: Auto, Wiosna, Lato, Jesień, Zima). `App.tsx` ustawia `html[data-season]`, gdy wybrano konkretną porę (działa od razu) albo „Auto” przy włączonym efekcie „Motyw sezonowy” (Efekty; domyślnie wyłączony). Efekt w `index.css`: tokeny `--season-*` i `--accent`; w Zeszycie `.paper-grid::after` maluje poświatę z górnych rogów i od dołu kolorami sezonu. W ciemnym motywie `--season-glow` 0,42 (przygaszona). Pozostałe style mają własne tła i akcenty — tam motyw nic nie zmienia (podpowiedź w Wygląd mówi to wprost). Test: `e2e/seasons.spec.ts`.
- **Motyw** (`src/hooks/useTheme.ts`): jeden wspólny stan (`useSyncExternalStore`); zmiana trafia do DOM w jednym miejscu (`applyCurrent`). Przełącznik jasny/ciemny w stylu z własnym schematem przechodzi do Zeszytu w przeciwnej jasności.
- **Kolor paska przeglądarki** (`theme-color`) to stała hex; po zmianie tła Zeszytu trzeba ją zaktualizować ręcznie.
- **Krój tekstu** (`src/lib/appFont.ts`, klucz `kaczy.font.v1`): Domyślny plus Inter, Nunito, Atkinson Hyperlegible Next, Literata, Manrope, Lexend. Atrybut `html[data-font]`; kroje zapisuje `src/styles/fonts.css` (zmienna `--app-font`). W Zeszycie krój idzie też za nagłówkami `h1–h4` i tytułem aplikacji (`.app-title`, Fraunces z `index.css`) — wcześniej bazowa reguła `--font-display` je przykrywała, stąd „krój się nie zmienia”. Reguły są w `:where()` (niska specyficzność), więc nagłówki stylów (`html[data-skin] h1`) zachowują swoje kroje. Logo i cyfry rachunku mają własne kroje. Test: `e2e/skins.spec.ts` (krój w Zeszycie i w Planie). Pliki krojów ładują się przy pierwszym użyciu (`skin-fonts`, CacheFirst). Offline przed pierwszym użyciem krój nie jest w pamięci.
- **Tokeny i tekst.** Ink to osobny token tekstu (`destructive-ink`, `primary-ink`, `success-ink`, `warning-ink`: `color-mix` z czernią). Tło przycisków zostaje `destructive`. Kolory folderów i notatek idą z tych samych zmiennych (`data-swatch`).
- **Rytm i promienie.** Gęstość siatki notatek w kroku 4 px; odstępy między sekcjami 32/40 px. Trzy nazwane promienie: `control` 8 px, `field` 12 px, `card` 16 px (`rounded-card`; 51 miejsc `rounded-2xl` zamienione na token, wygląd bez zmian).
- **Marka: logo i nazwa „G”.** Nazwa widoczna dla użytkownika to „G”: tytuły strony i manifestu (`index.html`, `public/manifest.webmanifest`), ekran offline (`public/offline.html`), ekran startowy (`#boot-splash` w `index.html`), pasek boczny i nagłówek (`NotkiLogo.tsx`: pojedyncza litera G, czytnik ekranu „G”), monogram animowany (`NMonogramLogo.tsx`: ścieżka G w `G_PATH`, ta sama ścieżka w `.n-mark-dot` w `index.css`), pusty ekran (`NotatnikWordmark.tsx`: odręczna litera G), ikony PWA i favicon (`scripts/generate-icons.mjs`, uruchamiać ponownie po zmianie litery). Logo używa pełnej czcionki Unbounded Variable (`tailwind.config.ts`, klasa `font-logo`), więc osobny podzbiór liter N-O-T-K-I został usunięty; `unbounded-latin` (wght) zostaje w precache, żeby logo działało offline. Nazwy plików/komponentów i klucze `localStorage` zostają bez zmian (`NotkiLogo`, `notki-logo`, `dash-notes-fired-reminders`).
- **Tabliczka i ołówek** (komputer): w rogu tła nazwa widoku („G · ARKUSZ 1/1”, `PaperBackdrop`); kreska ołówka rysuje się przy „Zapisano” (`.pencil-stroke`). Tabliczka na Grafiku przechodzi na lewy dolny róg. Czerwony margines Zeszytu nie jest rysowany (tło nie zna szerokości paska bocznego).
- **Efekty domyślnie.** Zostają tylko przywrócenie z kosza (konfetti) i zamknięty dzień; iskierki, deszcz emoji, fajerwerki, serduszka, bąbelki, tęcza, motyw sezonowy, cytat dnia i odznaka są wyłączone (migracja `kaczy.effectsSettings.defaults2`, późniejsze wybory zostają). Skutek: pinezka przy przypięciu jest częścią „Iskierek”, więc domyślnie jej nie ma.
- **Pieczątki.** Odznaki statusu i liczniki, które nie są przyciskami (zaległe na Dziś, przegląd tygodnia, „na dziś” przy temacie, status przypomnienia, liczba w nagłówku grupy), mają klasę `.stamp-tag`: obwódka i tekst w jednym kolorze, bez wypełnienia, mono. Przyciski zostają chipami z wypełnieniem.
- **Kolory** w callout Markdownu, ikonach kopii, sejfie, płomieniu serii i ostrzeżeniu synchronizacji idą z tokenów.
- **Kontrast Zeszytu.** Czerwony tekst w ciemnym motywie ≥4,5:1; etykiety sekcji (`section-label`) zdaniem zamiast wersalików; tytuł strony wagi 700.
- **Nagłówek.** Pasek nagłówka ma w Zeszycie tylko cienką kreskę; tytuł widoku w Fraunces.

### Dostępność

- **Test axe** (`e2e/a11y.spec.ts`): pięć widoków (Notatki, Przypomnienia, Kalendarz, Grafik, Nauka) w WCAG 2.2 AA, jasny i ciemny motyw, 390 i 1440 px — 20 skanów. Lista wyjątków `KNOWN` może tylko maleć; każdy wpis ma uzasadnienie. Jedyny wyjątek: `target-size` pasków opanowania Nauki na telefonie (równoważne kontrolki na tablicy).
- **Grupy „jedna z kilku”** (`ToggleGroup`, Radix, `type="single"`): Tab wchodzi do grupy na wybraną pozycję, strzałki przenoszą fokus (w kółko), Spacja/Enter wybiera, kliknięcie wybranej nie odznacza. Czytnik słyszy „grupa opcji, zaznaczony”. Pędzle Grafiku, galerie stylów i krojów oraz paski filtrów mają własną obsługę klawiatury.
- **Kontrast krawędzi.** `--input` daje ≥3:1 na białej karcie, `muted`, `secondary` i jasnych notatkach.
- **Dźwięk i ruch.** Ograniczony ruch zeruje animacje; wibracje działają mimo to.

### Powiadomienia przy zamkniętej aplikacji (Web Push)

- **Wymaga własnego serwera** z https (Caddy albo nginx przed portem 4455). Bez niego przypomnienia działają tylko przy otwartej aplikacji. Serwer: `push-server/` (Node; `core.js` — czysta logika, `server.js` — `GET /vapid`, `PUT /schedule`, `POST /test`, `POST /unsubscribe`, `GET /health`, obieg co 20 s; `Dockerfile`, `README.md`). Klucze VAPID tworzone przy pierwszym starcie (`DATA_DIR/vapid.json`).
- **Ustawienia → Ogólne → „Powiadomienia przy zamkniętej aplikacji”:** adres serwera, „Włącz”, „Wyślij próbne”, „Wyłącz”. Pod polem stan: liczba zaplanowanych terminów i czas ostatniej wysyłki albo błąd. iPhone obsługuje push tylko w aplikacji dodanej do ekranu początkowego.
- **Aplikacja liczy, serwer wysyła.** Notatki, Grafik i dziennik żyją w Yjs, więc serwer ich nie zna. Aplikacja liczy terminy na 14 dni (`src/lib/push/schedule.ts`, `buildPushSchedule`, limit 200 pozycji) tymi samymi funkcjami co timery strony i wysyła listę przez `PUT /schedule`; serwer zastępuje nią poprzednią listę urządzenia.
- **Kiedy lista idzie:** 3 s po zmianie notatek, Grafiku lub dziennika; co godzinę; przy schowaniu aplikacji (`keepalive`). Co 6 godzin wysyłana zawsze, nawet bez zmian (horyzont się przesuwa).
- **Bez podwójnych powiadomień.** Ten sam termin może przyjść z serwera i z timera strony. Obie drogi zapisują klucz (`pushKey`: `n:<id>:<termin>`, `rd:<dzień>`, `e:<jutro>`) w Cache Storage `notki-push`, który widzą strona i service worker. Push nie pokazuje nic, gdy aplikacja jest widoczna.
- **Prywatność.** Na serwer trafiają terminy, tytuły i krótkie opisy. Z notatek tylko tytuł; notatka prywatna ma stały tytuł „Przypomnienie z notatki prywatnej”. Ustawienie jest urządzenia, nie dokumentu.
- **Co przychodzi:** przypomnienia notatek (w tym kolejne terminy serii), Grafik na jutro (o godzinie wieczornego przypomnienia), „Raport dnia gotowy”, „Raport tygodnia gotowy”, zaległe zamówienie, serwis dziś. Nieudanej wysyłki serwer nie ponawia; termin spóźniony o ponad godzinę (serwer nie działał) przepada.
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

### Testy (ogólnie)

- Jednostkowe: `src/lib/keyboardInset.test.ts`, `haptics.test.ts`, `pageHidden.test.ts`, `viewPreload.test.ts`, `inputModality.test.ts`, `appFont.test.ts`, `siteMode.test.ts`, `skins.test.ts`, `useTheme.test.ts`, `contrastTokens.test.ts`, `push/schedule.test.ts`, `push-server/core.test.js`.
- E2E: `mobile.spec.ts`, `mobile-layout.spec.ts`, `touch-targets.spec.ts`, `desktop-columns.spec.ts`, `toggle-group.spec.ts`, `skins.spec.ts`, `site-mode.spec.ts`, `a11y.spec.ts`, `view-skeleton.spec.ts`, `pwa.spec.ts`, `push.spec.ts`, `view-change.spec.ts`.

### Commity

- `544773c`, `2f5ff5b`, `18e7808`, `12fe855` (2026-10-15) — React 19 i Tailwind 4; `ee3d51f` — kolory krawędzi i fokusu.
- `ee5a23f` (Radix, lucide), `4e96f34` (sonner 2).
- `b06445b` — cele dotyku; `9bfb12e` — dwie kolumny; `ec86276` — dolny pasek; `c62282f` — klawiatura; `07bbc03` — arkusze formularzy; `9ed219c` — okna na telefonie.
- `8a5b5da` — ładowanie widoków; `7c47e4b` (2026-10-15) i `59063d5` — stany (`StatusPanel`).
- `75ea68d` — animacje w tle; `d3c5c4b` — `ToggleGroup`; `6442da5` — wibracje; `21f2442` — krój tekstu; `d0e244b` — tryb budowa.
- `95ca98f` — style i motyw; `cba3989` — bez Lovable; `35ed5a3` — audyt axe i testy na telefonach; `e2c8b95` — układ telefonu i pasek zbiorczy.
- `fe01dcd` (2026-10-16) — Web Push.
- `c630cb4`, `30427f2` (2026-10-18) — ruch; `84490c6` — mikrointerakcje; `2cafa53` (2026-10-19) — podpowiedź „+”; `9b7f7b2` (2026-10-19) — promienie `rounded-card`.
- Plan wizualny (2026-10-18): fazy A–E, C, D, E4 i tabliczka — w historii commitów; kilka z nich nie ma osobnego hasha w dokumencie.
- Pasek boczny (aktywny wiersz): w historii commitów.

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

## Edytor CodeMirror 6 — krok 1a, bez podłączenia (plan rozbudowy, Faza 1, 2026-10-23)

### Co robi

- Na razie nic widocznego: komponent edytora Markdown na CodeMirror 6 gotowy do podłączenia za flagą `cmEditor` (Ustawienia → Ogólne → „Funkcje w przygotowaniu”). `NoteEditor` nadal używa zwykłego pola tekstowego.

### Gdzie jest

- `src/components/editor/cmExtensions.ts` — `buildCmExtensions(opts)`: czysta konfiguracja (historia, zaznaczenie, zawijanie, język Markdown, kolory składni, klawisze domyślne, placeholder, `spellcheck`, `aria-label`, motyw z tokenów `--foreground`/`--ring`/`--app-font`, tryb tylko do odczytu, `onChange`).
- `src/components/editor/CmEditor.tsx` — `CmEditor({ value, onChange, … })`: opakowanie o kształcie zwykłego pola.
- Zależności (wersje przypięte, starsze niż 2 tygodnie): `@codemirror/state` 6.7.6, `view` 6.43.13, `commands` 6.11.1, `language` 6.13.1, `lang-markdown` 6.5.2, `autocomplete` 6.20.3, `search` 6.7.2, `@lezer/markdown` 1.8.0.

### Jak działa i dlaczego

- **Widok tworzony raz.** Zmiana `value` z zewnątrz podmienia dokument; zmiana z klawiatury wraca przez `onChange` jako ta sama wartość, więc nie resetuje kursora.
- **Brak `indentWithTab`.** Tab zostaje w przeglądarce, żeby klawiatura nie utknęła w edytorze (dostępność).
- **`onChange` przez `useLatestRef`** — zmiana callbacku nie tworzy widoku od nowa.
- **Paczka.** Nic w aplikacji jeszcze nie importuje edytora, więc paczka startowa go nie zawiera. Podłączenie zrobi go leniwym (`lazy`).

### Ograniczenia i pułapki

- Nie ma jeszcze: podpowiedzi `[[`, menu `/`, `@`, skrótów z `editorKeys.ts`, przycisków formatowania, podglądu na żywo (dekoracje), synchronizacji z Yjs (`y-codemirror.next`). Każdy z tych punktów to osobny krok Fazy 1.
- Zewnętrzna zmiana `value` podmienia cały dokument i resetuje kursor. Dla notatek w Yjs (krok 1b) zastąpi to wiązanie `yCollab`.
- W jsdom CodeMirror zgłasza brak `getClientRects`; to szum testów, nie błąd logiki.

### Testy

- `src/components/editor/cmExtensions.test.ts` — stan i język, `onChange`, tryb tylko do odczytu, atrybuty `spellcheck`/`aria-label`.
- `src/components/editor/CmEditor.test.tsx` — render z wartością, zewnętrzna zmiana wartości.

### Commity

- Nie zacommitowane (2026-10-23): krok 1a, czeka na podłączenie za flagą.

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
- **Udostępnianie z innej aplikacji** (Share Target): „Udostępnij → G” tworzy notatkę. Tekst i link do treści (link bez dubla). Obrazy stają się zdjęciami, PDF załącznikiem; inne typy są pomijane z komunikatem. Maks. 30 plików na udostępnienie.
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

## Grafik — stan aktualny (zmiany, rachunek, eksporty, wiele grafików)

Dział opisany w jednym miejscu: rdzeń (dotąd nieopisany) i dodatki z 2026-10-09…20. Przegląd audytu z 2026-10-09 jest uwzględniony.

**Telefon w poziomie (844×390):** `ShiftsView.tsx` — wariant `short:` ustawia siatkę na trzy kolumny: przełącznik grafików, przełącznik Miesiąc/Tydzień i nawigacja miesiąca w jednym rzędzie; paleta zmian w jednym przewijanym rzędzie; podpowiedzi (`#shift-brush-hint`) schowane. Elementy pełnej szerokości mają `short:col-span-full`, bo liczba kolumn się zmieniła. Test: `e2e/shifts-landscape.spec.ts` (chromium, iphone-14, pixel-7).

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
- Strona offline: `public/offline.html` ładuje `public/offline.js` (`defer`) zamiast inline-skryptu, żeby CSP
  `script-src 'self'` nie zgłaszał naruszenia. `offline.js` trafia do precache przez `globPatterns`. Nagłówek CSP
  w `netlify.toml` nadal `Report-Only`. Testy: `e2e/pwa.spec.ts` (offline przeładowanie).
- Budowanie: Vite 8 (rolldown). `vite.config.ts` → `build.rolldownOptions.output.codeSplitting`: grupy `vendor-react`, `vendor-dnd`, `vendor-radix` dopasowane regexem po ścieżce w `node_modules` (obiekt `manualChunks` nie działa w rolldown). `workbox.globIgnores` dla PDF: nazwy chunków to `exportPdf-*`, `html2canvas-*` (bez `.esm`), `purify.es-*`, `index.es-*`, `StatsDialog-*`. Budżety w `e2e/bundle.spec.ts`: wejściowy JS 400 KB gzip, precache 3,2 MB. `tsconfig.app.json`: `node` w `types` (Vitest 4 nie ciągnie typów Node).
- `vite.config.ts` → `workbox.globIgnores`: `exportPdf`, `index.es` (jsPDF), `html2canvas.esm`, `purify.es`, `StatsDialog` są poza
  precache. Trafiają do cache `static-assets` (CacheFirst na `/assets/*.js`) dopiero przy pierwszym użyciu.

**Wynik.** Paczka startowa (gzip) 390 → 383 KB, potem (osobne pozycje list budowy, `395c311`) 384,0 KB, a po leniwym
czytniku 378,7 KB — zapas 5,3 KB do progu 384. Precache 4,37 → 4,03 MB (próg 4,3), 90 → 84 pliki.

**Stan 2026-10-17:** precache 4,09 → **3,00 MB, 88 plików** (próg 3,1 MB w `e2e/bundle.spec.ts`; od 2026-10-21 próg 3,2 MB po stylach Matryca i Hydraulika, 3,12 MB / 106 plików). Cel z roadmapy
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

## Budżet paczki startowej — próg 386 KB (decyzja właściciela, 2026-10-19)

- **Co zmieniono:** próg wejściowego JS (gzip) w `e2e/bundle.spec.ts` podniesiony z 385 do 386 KB.
- **Dlaczego:** po funkcjach Długów, pasku „+” i poprawkach pustych stanów paczka startowa ma 385,4 KB. Właściciel projektu zdecydował o podniesieniu progu zamiast przenoszenia arkusza „Nowa” do leniwego modułu.
- **Testy:** `e2e/bundle.spec.ts`: 6/6.
- **Commit:** edec40f, 2026-10-19.

## Dziś, Praca, Grafik — blok tytułowy widoku (B4, 2026-10-19)

- **Co robi:** na Dziś, Praca i Grafik nad treścią stoi tytuł h1 (font display, 3xl) i wiersz mono z dzisiejszą datą. Na Dziś dochodzi licznik notatek („2 notatki”). Pasek nagłówka na tych widokach nie pokazuje już nazwy widoku, żeby nie powielać tytułu.
- **Gdzie jest:** `src/components/ViewTitle.tsx` (`ViewTitle`, `isTitleBlockView`, lista `TITLE_BLOCK_VIEWS`), `src/pages/Index.tsx` (pierwsze dziecko `<main>`), `src/components/AppHeader.tsx` (h1 z klasą `hidden` na tych widokach).
- **Jak działa:** na tych trzech widokach jedyny widoczny h1 to blok tytułowy. Nagłówek go ukrywa (`hidden` usuwa też z drzewa dostępności), więc czytnik ekranu nie widzi dwóch nagłówków poziomu 1.
- **Decyzja:** B4 z planu wizualnego (plan `plan-wizualny-2026-10-18.md`, usunięty — patrz „Dokumenty usunięte”) zrobiony jako dom tytułu z datą. Nie dodano innych widoków.
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

**Przegląd P1 (2026-10-21):**
- **Globalny reset** (`AppearanceSettings.tsx`) kasuje też ustawienia kopii (`autoExportDays`, `backupReminderDays`) — opis w potwierdzeniu nie mówi już, że kopia zostaje. Reset jest pełny z potwierdzeniem (decyzja z 19.10).
- **Stan wyboru dla czytnika:** Układ, Gęstość i Liczba kolumn mają `aria-pressed`.
- **Kopia do jednego pliku** (`BackupSettings.tsx`): opis mówi, że każdy kolejny backup, także automatyczny, nadpisuje poprzedni.
- **Zakres kopii** (`exportNotes.ts` → `SETTINGS_KEYS`): dodane `kaczy:review.day`, `kaczy:badge.enabled`, `kaczy.vault.autolock.v1` oraz `kaczy.push.v1`. Przy przywracaniu push zostaje z adresem serwera, ale wyłączony, a `sentHash`/`last` są czyszczone (`pushPrefsForRestore`). Zgoda na dyktowanie (`kaczy.dictation.consent`) i parowanie sync są celowo poza kopią.
- **Destrukcyjny styl** potwierdzeń: „Odłącz to urządzenie”, „Przywróć backup”, reset globalny i reset sekcji używają `buttonVariants({ variant: "destructive" })`.
- **Serwery sync** (`SyncSettings.tsx`): ostrzeżenie w opisie — zmiana tylko na jednym urządzeniu może je odłączyć od grupy.
- Testy: `src/lib/fullBackup.test.ts` (blok „ustawienia w kopii — zakres i push”).

**Przegląd P2 (2026-10-21):**
- **„Ogólne” — kolejność i skoki:** `GeneralSettings.tsx`. Na górze pasek skoków (`JumpNav`, `sticky`) do grup: Powiadomienia, Przypomnienia, Edytor, Praca, Prywatne, Skróty. Kotwice `#ogolne-*` z `scroll-mt-14`. Każdy reset (`ResetSectionButton`) stoi na końcu swojej grupy; lista skrótów na dole.
- **Powiadomienia:** status przeglądarki, Push, odznaka. **Przypomnienia:** przegląd tygodnia, „Dziś”, „Ten tydzień”. Web clipper i dyktowanie przeniesione na dół.
- **Diagnostyka** przeniesiona z „Ogólne” do „Kopia i dane” (`BackupSettings.tsx`, `handleDownloadReport`).
- **„Przywracanie z kopii”:** nagłówek sekcji wokół przycisku przywracania w „Kopia i dane”.
- **Etykiety:** „Autozapis” (było „Autosave”), „Zakładka do zapisu stron w G” (było „Web clipper (zakładka w przeglądarce)”), „Tryb budowa: większy tekst i przyciski” (nazwa radiogrupy „Tryb budowa” zostaje — testy ją używają).
- **Cele dotykowe 44 px** (`coarse:`): godziny i dzień przypomnień, kolumny w Wyglądzie, wybór auto-blokady skarbca.
- **Skarbiec:** status w `role="status"`, żeby czytnik ogłaszał „Zablokuj teraz”.

**Przegląd P3 (2026-10-21):**
- **Odmiana:** `src/lib/plural.ts` → `dniPl` („1 dzień”, „2 dni”) i `godzinPl` (biernik: „1 godzinę”, „22 godziny”, „12 godzin”). Używają ich Kopia (auto-backup, przypomnienie, „N dni temu”) i Ogólne („Dziś”, 24 h+). Testy: `src/lib/plural.test.ts`.
- **Dni tygodnia** w „Ten tydzień” z `REVIEW_DAY_NAMES` (`weeklyReview.ts`), jak w przeglądzie.
- **Nazwa Grafiku** małą literą jak w oknie („Ustawienia grafiku”) — e2e szuka tej nazwy.
- **Sync:** podpowiedź mówi, że 8-znakowy kod już nie działa; nagłówki podsekcji to `h3`.
- **Push:** z opisu zniknęła nazwa folderu `push-server`.
- **Efekty:** przycisk „Test” → „Podgląd”.
- **Wygląd:** globalny reset „Przywróć domyślne” jest nieaktywny, gdy nie ma czego resetować.
- **Kopie:** w tekstach zamiast „Backupy” jest „Kopie” (spójnie z resztą zakładki).
- **Świadomie bez zmian:** etykiety „wyczyść”/„wyłącz” (różne znaczenie), przełącznik „Zgodność ze starszą wersją” jako checkbox (zmiana wyglądu bez zysku), `aria-pressed` w skórkach i krojach (zmiana semantyki wymaga osobnego przeglądu).

**QOL — top 5 (2026-10-21):**
- **Cofnij przy nadpisaniu w Grafiku** (`ShiftsView.tsx`, `toastReplaced`): malowanie zmianą innego rodzaju (albo zmianą godzin) pokazuje toast „Cofnij” z poprzednim wpisem (`restoreDays`). Test: `e2e/shifts-undo.spec.ts`.
- **Ctrl+Z w Grafiku** (`yShifts.ts`, `undoManager`; `store.ts`, `undoShifts`/`canUndoShifts`; `Index.tsx`, `onUndo`): `Y.UndoManager` na mapie dni, tylko zmiany z `SHIFTS_ORIGIN`. Sync z innego urządzenia, import, przywracanie i migracje idą z `SHIFTS_SYSTEM_ORIGIN` i nie trafiają na stos. Poza widokiem Grafiku Ctrl+Z działa jak dotąd. Testy: `src/lib/shifts/undo.test.ts`.
- **Kopia sprzed przywrócenia** (`BackupSettings.tsx`, `RestoreBackup.restore`): przed każdym przywróceniem pobiera się `kaczy-przed-przywroceniem-RRRR-MM-DD.json`. Gdy zapis się nie uda, przywracanie się zatrzymuje. Przywrócenie tego pliku cofa przywracanie.
- **Ostatnio użyte w palecie** (`CommandPalette.tsx`, `NAV_ITEMS`; `src/lib/recentCommands.ts`): grupa Nawigacja jest tablicą danych; ostatnie 3 użyte widoki pokazują się przy pustym polu wyszukiwania. Testy: `src/lib/recentCommands.test.ts`.
- **Budżet paczki startowej:** po Ctrl+Z w Grafiku 400,33 KB; próg podniesiony do 401 KB (decyzja użytkownika), `e2e/bundle.spec.ts` przechodzi.

**Wygląd telefonu (2026-10-21):**
- **Siatka miesiąca** (`ShiftMonthGrid.tsx`): nagłówki i komórki dni są w tej samej siatce `grid-cols-7` — pomiar na 390 px potwierdził równe kolumny. Test regresyjny: `e2e/shifts-grid.spec.ts`.
- **Zakładki Ustawień** (`SettingsDialog.tsx`): na telefonie `max-sm:text-xs`, „Kopia i dane” w jednej linii.
- **Style** (`SkinPicker.tsx`): nieparzysta liczba stylów — ostatni kafel na telefonie zajmuje cały wiersz, z niższą miniaturą (`max-sm:aspect-[16/6]`).
- **Kroje** (`FontPicker.tsx`): dwie kolumny od 340 px (wcześniej od 400 px).
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

- **U7 — co robi.** Karta budowy ma pole „Telefon hurtowni (WhatsApp zamówień)”. Przycisk „WhatsApp” w panelu zamówień otwiera rozmowę z tą hurtownią (`wa.me/<cyfry>`). Bez numeru zostaje zachowanie domyślne (WhatsApp pyta o odbiorcę). Decyzja właściciela: numer jest zapisywany w karcie, więc trafia do synchronizacji i kopii.
- **U7 — gdzie jest.** `src/lib/study/sites.ts` (pole `supplierPhone`, czyszczenie), `src/lib/study/store.ts` (`SiteCardInput`, zachowanie pola przy edycji), `src/components/study/SiteCardDialog.tsx` (pole), `src/lib/study/order.ts` (`whatsappOrderUrl(text, phone?)`), `src/components/study/SiteOrderPanel.tsx` (przekazanie numeru z karty).
- **D3 — co robi.** Ręczny „Pobierz pełny backup teraz” pokazuje okno „Kopia będzie niepełna”, gdy kopia pominie załączniki (budżet albo brak bajtów), zanim zapisze plik. „Zapisz mimo to” zapisuje; „Anuluj” nic nie zapisuje.
- **D3 — gdzie jest.** `src/lib/exportNotes.ts` (`exportFullBackup` z opcją `confirm`, wynik `cancelled`), `src/components/settings/BackupSettings.tsx` (okno `AlertDialog`, `exportNow` z potwierdzeniem). Automatyczne kopie (`useBackupReminders`) nie pytają — nie mają okna, a zapis idzie w tle.
- **Testy.** `src/lib/study/whatsappSupplier.test.ts` (3): link bez numeru, z numerem, zepsuty numer. `src/lib/backupConfirm.test.ts` (1): bez pominięć nie pyta. Ścieżki odmowy nie testuje żaden test — do sprawdzenia ręcznie albo w e2e.
- **Commit:** `f39af01` (2026-10-20, U7 i D3); hash dokumentacji `64cda55`.

## Przegląd kodu — niskie punkty L1–L20 (2026-10-20)

Poprawki z przeglądu kodu z 2026-10-20 (`code-review-2026-10-20.md`, usunięty — patrz „Dokumenty usunięte”). Opisy działów Ćwiczeń, Długów, Grafiku, Skrzynki i Ustawień zostały przepisane do stanu aktualnego (sekcje „stan aktualny”); poniżej lista zmian z tego przeglądu.

- **Kopia (L1).** `src/lib/exportNotes.ts`: `errName(err)` — komunikaty `logDiag` przy przywracaniu zawierają tylko nazwę błędu, bez treści kopii.
- **Ćwiczenia (L3, L4, L6, L7).** `src/components/cwiczenia/TrainingSection.tsx`: `EquipmentForm` zapisuje tylko wartość > 0, ma przycisk „Usuń limit”; formularze godziny przypomnienia i ciężaru synchronizują się z danymi z Yjs. `src/lib/diet/yDiet.ts`: `getGoals` zwraca zamrożony obiekt z cache, `restore` pilnuje `DIET_MAX_MEALS` i zwraca `boolean`. `nextReminderAt` przeniesiono do `src/lib/timeOfDay.ts` (dawniej `lib/supplements/model.ts`); importy w `CwiczeniaView.tsx`, `TrainingSection.tsx` i `model.test.ts` zmienione.
- **Długi (L9).** `src/lib/debts/yDebts.ts` `remove`: uszkodzony wpis (`cleanDebt` → `null`) jest usuwany z mapy, nie zajmuje miejsca w limicie.
- **Grafik (L12–L15).** `src/lib/shifts/store.ts`: `instanceFor(id)` z cache zamiast nowego `createYShifts` przy każdym odczycie. `src/lib/shifts/monthImage.ts`: kwota zarobku przez `formatMoney`. `src/lib/shifts/monthImageDraw.ts`: fallback `roundRect` na `rect`, `URL.revokeObjectURL` po 1 s, `canvasToPng` synchroniczny (`toDataURL`), żeby `navigator.share` ruszyło w tym samym kliknięciu; `ShiftsView.tsx` dociąga moduły obrazu przy wejściu w Grafik. `src/components/shifts/ShiftSummary.tsx` `BonusPanel`: `toast.error` przy nieudanym zapisie premii.
- **Notatki (L8).** `src/lib/noteSchema.ts`: usunięty BOM na początku pliku.
- **Testy.** Istniejące: `src/lib/debts/yDebts.edit.test.ts` (L11), `src/lib/shifts/reviewFixes.test.ts`, `src/lib/training/reminderRestore.test.ts`. Nowych testów tej serii nie dodano.
- **Ograniczenia.** L14: udostępnianie obrazu wymaga sprawdzenia na telefonie (kod jest synchroniczny do `navigator.share`). L17: asercje w `e2e/bundle.spec.ts` nie są uruchomione. Paczka startowa: 392,2 KB gzip (próg 393 KB).
- **Commit:** `1b8bcf8` (2026-10-20, L1–L20).
- **Commit (L14, udostępnianie):** `1380f10` (2026-10-20).


## Praca → Dziennik budowy — lista przed wejściem na budowę (2026-10-22)

Co robi: na górze Dziennika karta „Przed wejściem” dla dzisiejszej budowy. Lista stałych punktów (ochrona, narzędzia, materiał, zgłoszenie u kierownika, zawór, miejsce pracy, apteczka) plus punkty z karty budowy, które dziś mają znaczenie: dostęp do bramy, braki, dostawa na dziś, następny etap, otwarte problemy, zgłoszenia serwisowe. Odhaczasz punkty i „Wchodzę” zapisuje godzinę wejścia; karta pokazuje pieczątkę „Wejście 07:12”. Stałą listę można zmienić („Zmień listę”), wspólną dla wszystkich budów; „Przywróć domyślną” cofa do wzorca.

Gdzie:
- `src/lib/study/entryCheck.ts` — czysta logika: `DEFAULT_CHECK_ITEMS`, `siteContextItems` (punkty z karty), `checkStatus`, `toggleCheck`, `enterSite`, `reopenCheck`, `addCheckItem`, `cleanCheckItems`, `cleanRecord`, `keepFrom`, `checkLine`.
- `src/lib/study/yEntryCheck.ts` — warstwa Yjs: mapa `studyEntryCheck` (klucz `items` = własna lista, klucze `r␁budowa␁dzień` = odhaczenia). `setRecord` przy zapisie usuwa dni starsze niż 120.
- `src/lib/study/entryCheckStore.ts` — hook `useEntryCheck` i akcje dla widoków.
- `src/components/study/EntryCheck.tsx` — `EntryCheckCard` (karta nad Dziennikiem, wybór budowy, pieczątka), `EntryCheckDialog` (okno z dużymi polami), `ItemsEditor` (zmiana listy).
- `src/components/study/StudyJournal.tsx` — montaż karty przed przypomnieniami.
- `src/lib/exportNotes.ts`, `src/lib/noteSchema.ts` — pole `entryCheck` w kopii (sekcja `entryCheck` obok `debts`); przywracanie scala, nie kasuje.
- `src/index.css` — `.entry-stamp` i animacja `entry-stamp` (wyłączona przy `reduced motion`).
- `eslint.config.js` — `yEntryCheck.ts` i jego test na liście wyjątków od importu `yjs` (jak `yDebts`).

Jak działa: domyślna budowa to ta z dzisiejszym wpisem, potem bieżąca budowa arkusza, potem ostatnio używana. Odhaczenia są per budowa i dzień, więc nowy dzień zaczyna od zera. Id punktów z karty (`ctx-…`) są stałe dla rodzaju punktu, więc odhaczenie przeżywa zmianę treści (np. dojście kolejnego braku). Postęp liczy tylko punkty, które są dziś na liście — odhaczenie usuniętego punktu nie zawyża wyniku. Stałe punkty mają id `k-…` (własne) albo domyślne; zapis listy zastępuje całą listę (ostatni zapis wygrywa).

Ograniczenia i pułapki:
- Etap z karty pojawia się tylko, gdy budowa ma zapisaną listę etapów (nie z listy domyślnej).
- Dostawa „na dziś” to zamówienie z datą dostawy ≤ koniec dzisiejszego dnia.
- Starsza wersja aplikacji nie zna pola `entryCheck` i przy zapisie kopii je pomija; odhaczenia z nowszego telefonu nie wrócą ze starszej kopii.
- Budżet paczki startowej (401 KB) został zachowany: moduły listy są leniwe, a w `exportNotes.ts` ładowane tylko przy kopii. Wcześniej zmiana przekraczała próg o ~100 B; zwolniono to usunięciem nieczytanego pola `emoji` w `sidebarItems.ts`.

Testy:
- `src/lib/study/entryCheck.test.ts` — model (czyszczenie, odhaczanie, postęp, punkty z karty, granica 120 dni).
- `src/lib/study/yEntryCheck.test.ts` — dwa dokumenty Yjs (lista i odhaczenia scalają się, kopia nie nadpisuje).
- `src/lib/fullBackup.test.ts` — „lista przed wejściem wraca z kopii”.
- `e2e/entry-check.spec.ts` — punkt z karty, odhaczanie, własny punkt, „Wchodzę” z godziną, po przeładowaniu „Cofnij wejście”.

Commit: brak (zmiany niezacommitowane, na prośbę).

## Plan działów — Fala 1 (błędy i utrata danych, 2026-10-22)

Źródło: `docs/plan-dzialy-2026-10-22.md`. Zmiany niezacommitowane.

- **Grafik — noc zmiany czasu.** Komórka siatki, okno dnia i widok tygodnia liczą czas przez `entryMinutesOn(type, entry, dzień)` (`src/components/shifts/ShiftMonthGrid.tsx`, `DayDialog.tsx`, `ShiftWeekView.tsx`), więc 25.10 pokazuje 9 h jak rachunek. Test: `src/lib/shifts/shifts.test.ts`.
- **Grafik — start = koniec.** `ShiftTypeDialog.tsx` (`sameHours`) i `DayDialog.tsx` (`customOk`, `invalid`) odrzucają równe godziny zamiast zapisać 24 h.
- **Grafik — `.ics` wielu grafików.** `src/lib/shifts/ics.ts`: `icsScope(scheduleId)` daje klucz listy wysłanych dni i prefiks UID. Grafik główny zachowuje dawne wartości (`shift-…`, `kaczy:shifts.icsExported`), pozostałe mają własne. `ShiftsView.tsx` `exportIcs` używa zakresu aktywnego grafiku. Test: `shifts.test.ts`.
- **Grafik — „Skończyłem teraz” po końcu zmiany.** `summary.ts` `recentlyEndedShift` (okno `FINISH_GRACE_MS` = 4 h); `NowCard.tsx` `EndedCard` pokazuje zakończoną zmianę z przyciskiem. Test: `shifts.test.ts`.
- **Terminy — „Jutro” i „+1 h” na kaflu.** `NoteCardBody.tsx` używa `snoozeTarget` (odłożenie jednego wystąpienia), zamiast przesuwać całą serię.
- **Terminy — stary termin w pickerze.** `ReminderPicker.tsx` `openChange` odświeża stan z notatki przy każdym otwarciu.
- **Kalendarz — edycja odłożonego wystąpienia.** `ReminderCalendarView.tsx` `openEdit` przekazuje `base` (termin serii), `handleAttach` zapisuje go z powrotem; `ReminderQuickAddDialog.tsx` `handleSaveEdit` przekazuje `edit.base`. Seria nie przesuwa się.
- **Kalendarz — godzina z języka naturalnego.** `ReminderQuickAddDialog.tsx` (`parsed`): godzina zaraz po dacie („jutro 15:00”, „jutro o 15”) trafia do pola czasu, nie do tytułu. Samotna liczba („jutro 2 kupić”) nie jest godziną. Bez osobnego testu jednostkowego (logika w komponencie); sprawdzone ręcznie tylko w testach istniejących.
- **Skrzynka.** `InboxCapture.tsx` to wieloliniowe pole: Enter zapisuje, Shift+Enter nowa linia, widoczny fokus (`focus-within`). `inbox.ts` `captureParts`: za długa pierwsza linia nie ginie — początek to tytuł, reszta idzie do treści. `Index.tsx` `expandAddNote`: w Skrzynce „+” ustawia kursor w polu zamiast przechodzić do Notatek. Testy: `InboxCapture.test.tsx`.
- **Dziennik — dyktowanie.** `JournalEntrySheet.tsx`: braki bez budowy nie przerywają zapisu tekstu; błąd pokazywany po dopisaniu treści.
- **Dziennik — nagrania i podpis.** `StudyJournal.tsx`: nagrania wpisu widoczne na liście (`AudioPreview`, leniwie); podpis „Nagranie” / „Zdjęcie” / „Wpis” zamiast „Sprawdzone punkty listy” przy samym zdjęciu.
- **Dziennik — zamknięcie karty budowy.** `SiteCardDialog.tsx` `close`: zamknięcie z niezapisaną zmianą zapisuje kartę (toast potwierdza).
- **Dziennik — zdjęcia.** `JournalEntrySheet.tsx`: przyciski na zdjęciu mają 44 px pola dotyku na telefonie (`coarse:after:`), usunięcie zdjęcia ma „Cofnij” (zdjęcie wraca na swoje miejsce).
- **Dziennik i Nauka — „na dziś” po północy.** `useDayClock()` w `StudyView.tsx` (`DueTodayChip`), `QuizPanel.tsx`, `StudyBoard.tsx`, `StudyJournal.tsx` (przypomnienia).
- **Ćwiczenia — godzina przypomnienia.** `TrainingSection.tsx`: zapis przy wyjściu z pola (albo Enter), nie przy każdym znaku — wcześniej każdy znak przenosił notatkę do kosza.
- **Ćwiczenia — ciężar.** `parseKg`: wartość spoza kroku 0,5 kg jest odrzucana z komunikatem, zamiast zapisać zaokrągloną po cichu.
- **Długi — pasek spłaty.** `src/lib/debts/model.ts` `repaidShare(entries)`: liczy spłatę z obu stron salda, 100% tylko przy zerze, `floor` (maks. 99). Test: `model.test.ts`. Kolory historii (`DebtsView.tsx`) zgodne z listą.
- **Skarbiec — wykrycie rozjazdu.** `privateNotes.ts`: sesja pamięta odcisk metadanych (`sessionFingerprint`: epoch, sól, klucz opakowany, kod sprawdzający). Sam `epoch` nie wystarcza — dwa skarbce założone offline mają oba epoch 1. Test: `privateNotes.test.ts` („dwa skarbce założone offline…”).

Testy zielone: `npx vitest run` 1826/1826, `npx eslint .` bez błędów (16 ostrzeżeń jak przed zmianami), e2e działów: `entry-check`, `study`, `journal-*`, `entry-dictation`, `shifts*`, `calendar-shift-edit`, `reminders-calendar`, `inbox-today`, `site-*`, `today-study`, `private-notes`, `mobile-layout`.

**Budżet paczki startowej: przekroczony** (410 791 B wobec progu 410 624 B, +167 B). Zmiany w komponentach ładowanych od razu: `ReminderPicker.tsx` (~52 B), `Index.tsx` (~19 B), `NoteCardBody.tsx` (~20 B) i drobne pozostałe. Próg podnosi wyłącznie właściciel — decyzja otwarta.

## Dziś — karta „Trening mózgu” (Neuroklik, 2026-10-22)

Co robi: na stronie Dziś karta z podpowiedzią względem dzisiejszej zmiany z Grafiku: „Rozgrzewka przed pracą” (do 3 h przed startem), „Trening mózgu po zmianie” (w trakcie zmiany), „Trening po pracy” (do 2 h po końcu) albo „Codzienny trening mózgu” (dzień bez zmiany). Przycisk „Otwórz trening” otwiera https://neuroklik.vercel.app/ w nowej karcie. „Przypomnij” tworzy notatkę z przypomnieniem: 30 min przed startem, albo 10 min po końcu zmiany w trakcie pracy.

Gdzie:
- `src/lib/brainTraining.ts` — `NEUROKLIK_URL`, `brainPlan(data, now)` (tryby przed/w pracy/po/wolne i godzina przypomnienia).
- `src/components/review/BrainTrainingCard.tsx` — karta (leniwa).
- `src/pages/Index.tsx` — montaż pod kartą powtórek na Dziś; `onRemind` tworzy notatkę przez `addNote`.

Ograniczenia: Notatnik nie ma dostępu do danych Neuroklik (wynik, serie); karta tylko otwiera stronę. Osadzenie w ramce odrzucone przy wyborze — strona jest otwierana w nowej karcie. Przypomnienie to zwykła notatka z terminem (działa jak inne przypomnienia, także offline).

Testy: `src/lib/brainTraining.test.ts` (4 przypadki). Budżet paczki startowej: +124 B w `Index.tsx` (już wcześniej przekroczony, patrz sekcja Fala 1).

## Motywy i kroje — Fala 2 (2026-10-22)

Co zmieniono:
- **Kontrast stylów (WCAG AA).** Czerwień „Usuń” (`--destructive`) przyciemniona tak, żeby biały tekst miał ≥4.5:1 w Planie, Neonie, Zorzy, Matrycy i Hydraulice (`src/styles/skins.css`). Plan dostał własny `--destructive-ink` (tekst błędu na karcie, 4.33 → ≥4.9). Test: `src/lib/skinContrast.test.ts` sprawdza każdy styl i schemat (Zeszyt jasny i ciemny).
- **Hydraulika.** Tła podniesione (tło 8% → 12%, karta 11% → 16%, muted 14% → 19%, krawędź 20% → 27%), bo była wyraźnie ciemniejsza od reszty. Miniatura: warstwy rur i wody mają własny `background-size` (wcześniej jedna kreska i pusty pas).
- **Nagłówki stylów.** Krój stylu tylko na `h1` i `h2` (Plan, Zorza, Miedź, Matryca). `h3` (małe etykiety sekcji w Ustawieniach) idzie za krojem tekstu. Hydraulika: Barlow Condensed tylko na `h1`, `h2` w Plus Jakarta, plus awaryjny krój.
- **Galeria stylów** (`src/components/settings/SkinPicker.tsx`): Zeszyt na pełną szerokość, pod nim sześć stylów w siatce. Obwódka miniatur `ring-foreground/10` (działa w ciemnym motywie).
- **Kroje** (`src/components/settings/FontPicker.tsx`, `src/lib/appFont.ts`): próbka zawija się zamiast się ucinać, „Il1 O0” jest w osobnej linii. Opisy w jednym wzorze „do czego · cecha”; „Domyślny · Plus Jakarta Sans”.

Nie zmienione (świadomie): amber domyślnego Zeszytu na papierze ma 2.65:1 — to kolor marki, zmiana wymaga decyzji właściciela (test go nie egzekwuje, bo to kolor ikon/linków, nie tekst).

## Pasek boczny — „Trening mózgu” (2026-10-22)

Pozycja w stopce paska bocznego (`src/components/AppSidebar.tsx`, nad „Narzędzia”), otwiera https://neuroklik.vercel.app/ w nowej karcie. Adres w małym module `src/lib/neuroklik.ts` (pasek boczny jest w paczce startowej, więc nie ciągnie tam logiki zmian). Ta sama strona jest na karcie Dziś (`BrainTrainingCard`).

Budżet paczki startowej: po tej zmianie 411 696 B (próg 410 624 B). Przekroczenie rośnie razem z falą 3 (fokus i rola okna na pasku bocznym na telefonie, aria w notatkach).

## Plan działów — Fala 3 (dostępność, częściowo, 2026-10-22)

- **Karty notatek:** `ActionBtn` przekazuje `aria-pressed` do DOM i ma `type="button"`; ulubione mają stan (`NoteCardActions.tsx`).
- **Pigułka zapisu** (`OfflineStatus.tsx`): przycisk bez roli `status`; komunikat w osobnym `sr-only` z `role="status"` brzmi „Stan zapisu: …” (prefiks, żeby nie powielać widocznego napisu w DOM — testy szukają go dokładnie); w stanie biernym pigułka nie łapie fokusu.
- **Quiz — fokus po odpowiedzi** (`study/QuizPanel.tsx`): po wyborze odpowiedzi fokus przechodzi na „Dalej” (przyciski odpowiedzi stają się `disabled`); po „Dalej” na nagłówek pytania (`tabIndex=-1`). Testy: `e2e/study.spec.ts`, `e2e/today-study.spec.ts` (30/30 desktop, 3/3 iPhone 14).
- **Pasek boczny na telefonie** (`AppSidebar.tsx`): rola `dialog`, `aria-modal`, fokus wchodzi do środka, Tab zapętla się, Esc zamyka, fokus wraca na przycisk otwierający.
- **Płótno rysowania** (`DrawingCanvas.tsx`): przyciski narzędzi i kolory mają nazwy i `aria-pressed`.
- **Tryb skupienia** (`FocusMode.tsx`) i **przypomnienie** (`ReminderPicker.tsx`): nazwane przyciski zamknięcia i usunięcia.
- **Licznik przerwy** (`TrainingSection.tsx`): czytnik ogłasza tylko koniec przerwy.
- **Skarbiec** (`VaultDialogs.tsx`): miernik hasła ogłasza zmianę poziomu, nie każdy znak; natywne pola wyboru zamienione na `Checkbox` (większe na dotyku).
- **Synchronizacja** (`SyncSettings.tsx`): stan połączenia jako `role="status"`.

Zrobione w tej sesji: fokus po odpowiedzi w quizie (patrz wyżej). Sprawdzone bez zmian: Długi już mają `role="radio"` w grupie (`DebtsView.tsx`); Ustawienia używają `aria-pressed` przy przyciskach wyboru i `Segmented` (ToggleGroup, strzałki) — zostawione.

Kalendarz: `aria-live` zostaje — nagłówek miesiąca (`ReminderCalendarView.tsx`) i dnia (`DayPanel.tsx`) ogłaszają jedną zmianę każdy; bez nich czytnik nie powiedziałby, na który dzień przeszło.

- **Czytnik notatki — podgląd niemodalny** (`NoteReader.tsx`): `aria-modal` tylko w trybie `present` (prezentacja). Podgląd (Spacja na kaflu) ma `role="dialog"` bez `aria-modal`, bo siatka pod spodem pozostaje sterowalna (`gridKeyboardNav`). Klik w tło nadal zamyka podgląd. Testy: `e2e/reader.spec.ts`, `reader-step.spec.ts`, `note-links.spec.ts`, `a11y.spec.ts` (67/67).

**Fala 3 zamknięta.**

**Commit:** `2dea8e5` (2026-10-22), poprzedni krok `c36100b`.

## Wydajność — Fala 4: leniwe okna z „Więcej” (2026-10-22)

- **Udostępnij** (`ShareNote.tsx`, `ShareNoteDialog.tsx`): przycisk na kaflu zostaje eager, okno ładuje się przy pierwszym kliknięciu i zostaje zamontowane (animacja zamknięcia). Kopiuj tekst, Kopiuj link, Udostępnij…, Pobierz .md.
- **Historia wersji** (`VersionHistory.tsx`, `VersionHistoryDialog.tsx`): ten sam wzorzec; przycisk i licznik wersji eager, lista z Markdownem leniwie. Przywrócenie zamyka okno.
- **Zysk:** wejściowy JS 411 708 B → 411 136 B (401,50 KB; próg 402 KB w `e2e/bundle.spec.ts`). Mały, bo Radix i Markdown są też w paczce startowej. `NoteLookPicker` (ikona i okładka) zostaje eager — `NoteCoverStrip` z tego samego pliku jest potrzebny na kaflu.
- **Testy:** `e2e/share-files.spec.ts`, `search-backup.spec.ts`, `reader.spec.ts`, `a11y.spec.ts` (65/65), `bundle.spec.ts` (budżet wejściowego JS).

## Notatki — czytnik na telefonie: dolny pasek (Fala 4, 2026-10-22)

- **Co robi:** na telefonie (`phone:`) nagłówek czytnika zostaje z tytułem, Pełnym ekranem i Zamknij. Kopiuj, Edytuj, Poprzednia i Następna są w dolnym pasku 44 px (Poprzednia, Kopiuj, Edytuj, Następna). Podpowiedzi klawiszy na telefonie są ukryte.
- **Gdzie:** `src/components/NoteReader.tsx` (nagłówek: klasy `phone:hidden`; pasek: `hidden phone:flex` przed stopką z podpowiedziami).
- **Testy:** `e2e/reader.spec.ts` — "telefon: dolny pasek …" (@mobile, iphone-14). Wysokość mierzona przez `expect.poll`, bo czytnik wchodzi ze skalą 0,94. Regresja reader/reader-step/mobile: 36/36.

## Kalendarz — nagłówek na telefonie: menu „Więcej akcji” (Fala 4, 2026-10-22)

- **Co robi:** na telefonie nagłówek ma strzałki, miesiąc, „Dziś” i przycisk „⋯”. Menu zawiera „Pobierz .ics (nadchodzące terminy)” i „Drukuj terminy miesiąca”. Na szerszych ekranach przyciski „.ics” i „Drukuj” są jak dotąd.
- **Gdzie:** `src/components/calendar/ReminderCalendarView.tsx` (nagłówek `<header>`; `DropdownMenu` z `components/ui/dropdown-menu`; `exportAll`, `setPrinting`).
- **Testy:** `e2e/reminders-calendar.spec.ts` — "telefon: .ics i Drukuj są w menu …" (@mobile) oraz istniejący test .ics (desktop). Regresja kalendarza na desktopie: 15/15 z `calendar-shift-edit`.

## Grafik — eksporty na telefonie w menu „Udostępnij” (Fala 4, 2026-10-22)

- **Co robi:** na telefonie pod siatką zamiast trzech wrapujących się przycisków jest jeden „Udostępnij” z menu: Karta czasu (.csv), Do kalendarza (.ics), Obraz miesiąca (.png). Na szerszych ekranach bez zmian.
- **Gdzie:** `src/components/shifts/ShiftsView.tsx` (wiersz `order-9`: dwa warianty `sm:hidden` / `hidden sm:flex`; `DropdownMenu`).
- **Nie zrobione z pozycji „Mniej nad siatką”:** przełącznik „Grafik ▾” przy tytule (`ScheduleSwitcher`) zostaje bez zmian.
- **Testy:** `e2e/shifts.spec.ts` — "telefon: eksporty Grafiku …" (@mobile); pełny plik na desktopie 26/26.

## Dziennik — karta budowy zapisuje zmianę przy wyjściu (Fala 4, 2026-10-22)

- **Co robi:** „Pokaż wpisy” i „Raport” z karty budowy najpierw zapisują niezapisaną zmianę w karcie, potem przechodzą dalej. Wcześniej rodzic zamykał okno bez zapisu i wpisane dane przepadały. Zamknięcie krzyżykiem, Esc i „Archiwum” działają jak dotąd.
- **Gdzie:** `src/components/study/SiteCardDialog.tsx` — `persistDirty()` (wspólne dla `close`, `toggleArchive`), `leaveTo(go)` (przyciski z `onShowEntries` / `onReport`).
- **Testy:** `e2e/study.spec.ts` — "dziennik: karta budowy zapisuje niezapisaną zmianę przy „Pokaż wpisy”"; cały plik 30/30 na desktopie.

## Ćwiczenia — zakładki na telefonie (Fala 4, 2026-10-22)

- **Co robi:** na telefonie (<640 px) u góry są zakładki Odżywki / Trening / Dieta i widoczna jest tylko wybrana sekcja. Na komputerze wszystkie trzy sekcje są jedna pod drugą jak dotąd, bez zakładek.
- **Gdzie:** `src/components/cwiczenia/CwiczeniaView.tsx` — stan `tab`, pasek `role="group" aria-label="Dział Ćwiczeń"` (`sm:hidden`), klasa `max-sm:hidden` na sekcjach poza wybraną. Sekcje są w DOM zawsze, więc testy jednostkowe i zapis danych nie zależą od zakładki.
- **Testy:** `e2e/cwiczenia-zakladki.spec.ts` (telefon @mobile i komputer); jednostkowe `cwiczenia/*.test.tsx` 25/25.
- **Kroje latin + latin-ext (Fala 4, 2026-10-22):** bez cyrylicy, greki i wietnamskiego (decyzja właściciela). `scripts/latin-fonts.mjs` tworzy z pakietów @fontsource kopie CSS z samymi blokami `latin` i `latin-ext` w `src/styles/fonts-latin/` (nagłówek każdego pliku mówi, skąd pochodzi). `src/main.tsx` importuje te pliki zamiast pakietów. CSS startowy: 45 777 → 35 113 B gzip. Po zmianie wersji @fontsource uruchom skrypt ponownie. Tekst w innym alfabecie spada na czcionkę systemową.

## Dziś — ciaśniejsze odstępy na telefonie (Fala 4, 2026-10-22)

- **Co robi:** na telefonie karty Dziś mają odstęp 16 px (zamiast 32 px), mniej przewijania na 390 px. Na komputerze 40 px jak dotąd. Pozostałe widoki bez zmian.
- **Gdzie:** `src/pages/Index.tsx` — `<main>` (`gap-4 sm:gap-10` dla `view === "today"`).
- **Nie zrobione z pozycji „Mniej przewijania”:** „Praca+Powtórki w jednym rzędzie” — wymaga decyzji po zobaczeniu wypełnionego widoku.
- **Testy:** `e2e/dzis-phone.spec.ts` (telefon 16 px, komputer 40 px); `today-study.spec.ts` na desktopie OK.

## Przypomnienia — akcje na terminie w Dziś i Kalendarzu (Fala 5, pkt 1, 2026-10-22)

- **Co robi:** „Gotowe”, „Jutro rano” i „+1 h” przy terminie działają tak samo na kaflu notatki, na liście Dziś (zaległe i dziś) i w panelu wybranego dnia w Kalendarzu. Cofnięcie w toaście. W Kalendarzu akcje są tylko przy aktualnym terminie notatki, żeby nie odłożyć innego wystąpienia serii.
- **Gdzie:** `src/lib/reminderActions.ts` (czyste funkcje: `doneReminderUpdate`, `snoozeReminderUpdate`, `reminderFields`); `src/components/ReminderQuickActions.tsx` (przyciski, toast, fokus po usunięciu wiersza); użycie w `NoteCardBody.tsx`, `review/TodayDueList.tsx` (prop `onUpdate` z `Index.tsx`), `calendar/DayPanel.tsx` (`noteOf`, `onUpdateNote`; z `ReminderCalendarView.tsx`).
- **Testy:** `src/lib/reminderActions.test.ts`; `e2e/dzis-terminy.spec.ts` (Dziś: „Jutro rano” zdejmuje zaległy termin z listy; Kalendarz: „Za godzinę” w panelu). Regresja przypomnień: `reminders-phase2`, `weekly-review`, `reminders-calendar`, `reminder-toast` 25/25.
- **Uwaga:** `e2e/composer.spec.ts` „przypomnienie z paska” nie przechodzi także na czystym HEAD (zduplikowany przycisk „Usuń przypomnienie”) — problem sprzed tej zmiany.

## Skrzynka — tryb porządkowania (Fala 5, pkt 2, 2026-10-22)

- **Co robi:** przycisk „Porządkuj skrzynkę (N)” pod polem przechwytywania otwiera okno, które pokazuje notatki ze Skrzynki po jednej. Chipy folderów i etykiet przenoszą notatkę z Skrzynki (folder albo etykieta zdejmuje ją z reguły skrzynki). Archiwizuj i Kosz działają od razu. „Zostaw w skrzynce” przechodzi dalej bez zmian. „Cofnij” cofa ostatnią akcję (stos w oknie). Skróty 1–9 wybierają pierwsze dziewięć chipów (najpierw foldery, potem etykiety).
- **Gdzie:** `src/components/InboxTriage.tsx` (okno, kolejka zamrożona przy otwarciu w efekcie na `open`); `src/pages/Index.tsx` (leniwy import, przycisk i montowanie przy pierwszym otwarciu, `triageOpen`/`triageMounted`). Reguła skrzynki: `src/lib/inbox.ts` (`isInboxNote`).
- **Testy:** `e2e/inbox-triage.spec.ts` (archiwizacja, cofnięcie, kosz, zostawienie, stan „Gotowe”). Skrótów 1–9 jeszcze nie pokrywa test e2e (brak folderów w teście). Regresja: `inbox-today` 3/3, `InboxCapture` + `inbox` 13/13.

## Grafik — kotwica cyklu, „Przedłuż cykl”, dodatek nocny (Fala 5, pkt 3, 2026-10-22)

- **Kotwica cyklu:** pole „Kotwica: pierwszy dzień cyklu” w oknie Cykl (domyślnie dzień startu). Faza każdego dnia to krok `steps[(dzień − kotwica) mod długość]`, więc nakładanie od dowolnej daty trzyma rytm. Zapisany cykl pamięta kotwicę (`ShiftPattern.anchor`) i ostatni nałożony dzień (`appliedUntil`).
- **Przedłuż cykl:** przy wczytanym zapisanym cyklu przycisk „Przedłuż cykl od …” nakłada go od dnia po `appliedUntil`, z fazą od kotwicy, na wybrany zakres.
- **Dodatek nocny (art. 151⁸ KP):** 20% minimalnej stawki godzinowej roku (`src/lib/shifts/nightAllowance.ts`, tabela `MIN_HOURLY_WAGE`). Ustawienia → "Dodatek nocny" nadpisuje ją ręcznie (`ShiftData.nightRate`, 0 = z tabeli). Kwota pokazuje się jako podpowiedź przy kafelku „W nocy”.
- **Otwarte, do decyzji:** dodatku nocnego **nie dodaję do zarobku**, bo dodatek 100% za porę nocną już jest w rachunku (`summary.ts`). Trzeba sprawdzić z kadrami, czy 20% przysługuje dodatkowo do tego dodatku, czy wchodzi w jego miejsce. Stawka 2026 w tabeli (31,40 zł/h) wymaga sprawdzenia z obwieszczeniem.
- **Gdzie:** `src/lib/shifts/pattern.ts` (`applyPattern` z `anchorKey`, `addDaysKey`, `dayDiff`), `model.ts` (pola `anchor`, `appliedUntil`, `nightRate`), `PatternDialog.tsx`, `ShiftSettingsDialog.tsx` (`RateField` z etykietą i zapisem), `ShiftSummary.tsx`, `ShiftsView.tsx`.
- **Testy:** `src/lib/shifts/pattern.test.ts`, `nightAllowance.test.ts`; `e2e/shifts.spec.ts` — "cykl: „Przedłuż cykl” …" (27/27 z całym plikiem). Jednostkowe `lib/shifts` + `components/shifts` 151/151.

## Dziennik budowy — lista budów i „Nowa budowa” bez wpisu (Fala 5, pkt 4, 2026-10-22)

- **Co robi:** zapisana karta budowy bez wpisów pokazuje się na liście budów (pasek filtrów). „+ Nowa budowa” w pasku i „Nowa budowa” w pustym dzienniku otwierają okno z samą nazwą; po zapisie od razu otwiera się karta, żeby dopisać adres i resztę. Nazwa zajęta przez inną budowę (bez wielkości liter i ogonków) jest odrzucana.
- **Gdzie:** `src/components/study/NewSiteDialog.tsx` (okno, id = `siteKey(nazwa)`, zapis `saveSiteCard`); `src/components/study/StudyJournal.tsx` (filtr `used` = budowy z wpisami albo zapisane; pasek budów zawsze; przycisk; pusty stan z drugą akcją). Sprawdzanie nazw: `findSiteByName` w `src/lib/study/sites.ts`.
- **Ograniczenie:** pasek budów pojawia się dopiero przy pierwszym wpisie albo w tym samym miejscu co wcześniej; w pustym dzienniku nowa budowa jest dostępna i otwiera kartę, ale nie ma jeszcze paska. Lista w pustym dzienniku to świadomy wybór.
- **Testy:** `e2e/site-new.spec.ts` (utworzenie i otwarcie karty, odrzucenie zajętej nazwy). `e2e/study.spec.ts` 30/30; `lib/study` + `components/study` 376/376.

## Długi — termin zwrotu z przypomnieniem (Fala 5, pkt 5, 2026-10-22)

- **Co robi:** przy wpisie „Pożyczyłem” albo „Pożyczyłem od” można podać termin zwrotu (nieobowiązkowy, nie wcześniej niż dziś). Powstaje notatka „Zwrot od …” albo „Oddać …” z przypomnieniem o 9:00 tego dnia, więc trafia do Dziś, Terminów i powiadomień. Wpis pamięta id tej notatki (`dueNoteId`).
- **Gdzie:** `src/lib/debts/model.ts` (`DebtEntry.dueNoteId`, zachowywane przez `cleanDebt`); `src/components/debts/DebtsView.tsx` (`AddForm`: pole terminu, walidacja, tworzenie notatki przez prop `addReminderNote`); `src/pages/Index.tsx` (przekazuje `addNote`). Prop zamiast kontekstu, żeby widok dało się testować bez dostawcy notatek.
- **Ograniczenie:** termin ustawia się przy dodawaniu wpisu, nie przy edycji. Usunięcie wpisu nie kasuje notatki z przypomnieniem (notatka zostaje świadomie, żeby nie zgubić zobowiązania).
- **Testy:** `e2e/debts-due.spec.ts` (notatka w Przypomnieniach; odrzucenie terminu w przeszłości); `src/components/debts` + `src/lib/debts` 26/26.

## Ćwiczenia — własne ćwiczenia treningu (Fala 5, pkt 6, 2026-10-22)

- **Co robi:** w Treningu można dodać własne ćwiczenie (nazwa, partia mięśniowa, sprzęt ławka/hantle, nieobowiązkowa wskazówka). Pojawia się w liście wyboru wpisu i w planie dnia. Usunąć można tylko własne ćwiczenie bez wpisów i bez dnia planu; inaczej komunikat mówi, dlaczego.
- **Gdzie:** `src/lib/training/catalog.ts` (rejestr `setCustomExercises`, `allExercises`, `cleanCustomExercise`, prefiks `wlasne-`, limit 30); `src/lib/training/yTraining.ts` (mapa Yjs `trainingExercises`, `addCustom`, `removeCustom`, synchronizacja rejestru przy każdej zmianie); `src/lib/training/store.ts` (`useCustomExercises`, `addCustomExercise`, `removeCustomExercise`); `src/components/cwiczenia/TrainingSection.tsx` (`NewExerciseForm`, lista wyboru, usuwanie).
- **Pułapka (naprawiona):** formularz nowego ćwiczenia jest w formularzu wpisu treningu. Zagnieżdżony `<form>` przejmował wysłanie i przeładowywał stronę, więc nic się nie zapisywało. Dlatego to `div` z przyciskiem `type="button"` i Enterem w polu nazwy.
- **Uwaga na starsze wersje:** wpisy i plany z własnymi ćwiczeniami czyta tylko wersja z tą zmianą. Starsza wersja odrzuci obce id (`isKnownExercise`) i przy zapisie może zgubić ćwiczenie z planu. Nie używać starszej wersji na urządzeniu, które dodaje własne ćwiczenia.
- **Testy:** `src/lib/training/customExercises.test.ts`; `src/components/cwiczenia/TrainingSection.test.tsx` (mock rozszerzony o nowe funkcje); `e2e/cwiczenia-wlasne.spec.ts` (dodanie i usunięcie). Jednostkowe trening 60/60; e2e Ćwiczeń 3/3.

## Praca — braki materiału dyktowane głosem (2026-10-22)

- **Co robi:** w karcie budowy (Dziennik) przy „Braki materiału” jest przycisk Dyktuj. Powiedziana fraza, np. „dokupić trójnik fi 32”, staje się brakiem (pierwsza litera wielka, ilość pusta). Wpisanie ręczne działa jak dotąd.
- **Gdzie:** `src/components/study/SiteShortagesPanel.tsx` (`useDictation`, `listRef`, przycisk mikrofonu w formularzu). Logika dodawania bez zmian: `addShortage` w `src/lib/study/shortages.ts`.
- **Ograniczenie:** rozpoznawanie mowy zależy od przeglądarki (przycisk pojawia się tylko, gdy jest obsługiwane). Słowo „dokupić” zostaje w treści. Ilość trzeba wpisać ręcznie.
- **Testy:** `e2e/site-shortages.spec.ts`, `e2e/site-card-mobile.spec.ts` (ręczne dodawanie) 4/4; jednostkowe `study` 57/57. Dyktowania głosem nie ma w e2e (brak mowy w headless).

## Praca — „Do notatki” bez duplikatów (Faza 0.2, 2026-10-22)

- **Co robi:** notatka z tematu (Tablica → „Do notatki”) ma stałe id `study-topic-<temat>`. Drugie kliknięcie pokazuje „już istnieje” zamiast tworzyć kopię. Dwa telefony tworzą tę samą notatkę, a nie dwie.
- **Gdzie:** `src/lib/study/toNote.ts` (`topicNoteId`, domyślne id w `topicToNote`); `src/components/study/StudyBoard.tsx` (sprawdzenie `yjsStore.notesMap`).
- **Ograniczenie:** notatka w koszu też blokuje ponowne utworzenie; przywrócenie z kosza działa.
- **Testy:** `e2e/study-topic-note.spec.ts`.

## Praca — pełna lista braków w wpisie z dyktowania (Faza 0.3, 2026-10-22)

- **Co robi:** gdy wypowiedź dodaje braki do budowy, a lista ma już 40 pozycji, arkusz wpisu pokazuje błąd z liczbą nieodłożonych braków. Wcześniej nowe pozycje znikały po cichu, a komunikat mówił, że zostały dodane.
- **Gdzie:** `src/components/study/JournalEntrySheet.tsx` (pętla z licznikiem `rejected` przy `SHORTAGES_MAX`).
- **Ograniczenie:** komunikat sukcesu nadal wymienia wszystkie pozycje z wypowiedzi, także odrzucone. Pozycje dodane przez innego peera przy 40 limicie nadal mogą zniknąć z widoku — to osobna pozycja w planie (Faza 2).

## Praca — przypomnienie „bez protokołu próby” z akcją (Faza 0.4, 2026-10-22)

- **Co robi:** przypomnienie „montaż bez protokołu próby” ma przycisk „Dodaj próbę”. Otwiera arkusz wpisu z tą budową i tematem próby (`proba-wody`). Wcześniej przycisk tylko filtrował listę.
- **Gdzie:** `src/components/study/StudyJournal.tsx` (`openTestEntry`, gałąź `no-test` w `ReminderRow`); reguła przypomnienia w `src/lib/study/reminders.ts`.
- **Testy:** `e2e/study-test-reminder.spec.ts`; cały `study.spec.ts` 30/30.

## Praca — zapis wpisu nie kasuje pól z nowszej wersji (Faza 0.5, 2026-10-22)

- **Co robi:** zapis wpisu dziennika usuwa tylko pola, które ta wersja zna (`JOURNAL_ENTRY_KEYS`). Pole dodane w nowszej wersji zostaje, gdy starsza edycja zapisze wpis bez niego.
- **Gdzie:** `src/lib/study/yStudy.ts` (`JOURNAL_ENTRY_KEYS`, `writeEntry`).
- **Ograniczenie:** to chroni tylko przed nową wersją zapisującą pola starszej. Starsza wersja, która już działa na telefonie, dalej kasuje nieznane pola — to nie da się naprawić bez jej aktualizacji.
- **Testy:** `src/lib/study/yStudy.test.ts` (zachowanie pola nieznanego; usunięcie znanego pola nadal działa).

## Praca — braki: fokus i komunikat dla czytnika (Faza 1.1, 2026-10-22)

- **Co robi:** po zmianie statusu braku czytnik ogłasza nowy stan („Złączka 20: Zamówione”). Po usunięciu braku fokus wraca do pola „Czego brakuje”, zamiast ginąć na początku strony.
- **Gdzie:** `src/components/study/SiteShortagesPanel.tsx` (`announce` + `role="status"`, `addRef`, `remove`).
- **Testy:** `e2e/site-shortages.spec.ts` (3/3).

## Praca — tablica: fokus po przesunięciu tematu (Faza 1.2, 2026-10-22)

- **Co robi:** strzałka przesuwa temat do innej kolumny i fokus zostaje na tej samej karcie. Wcześniej karta była odmontowywana, a fokus ginął na początku strony.
- **Gdzie:** `src/components/study/StudyBoard.tsx` (`moveTo` + `tabIndex={-1}` na `li[data-topic]`).
- **Testy:** `e2e/study-board-focus.spec.ts`; `study.spec.ts` przechodzi.

## Praca — arkusz wpisu: fokus na tytule po otwarciu (Faza 1.3, 2026-10-22)

- **Co robi:** po otwarciu arkusza „Wpis z budowy” fokus idzie na tytuł. Na telefonie pole tekstu nie wywołuje klawiatury od razu, a czytnik zaczyna od nazwy arkusza.
- **Gdzie:** `src/components/study/JournalEntrySheet.tsx` (`titleRef`, `onOpenAutoFocus`).
- **Testy:** `e2e/entry-sheet-focus.spec.ts`; `e2e/journal-*.spec.ts` 8/8.

## Praca — przyciski usuwania na dotyku 44 px (Faza 1.4–1.5, 2026-10-22)

- **Co robi:** usuwanie dokumentu z karty budowy i usuwanie lokalizacji wpisu mają na ekranie dotykowym 44 px. Wcześniej 36 px i ok. 34 px.
- **Gdzie:** `src/components/study/SiteDocsPanel.tsx` (`coarse:h-11 coarse:w-11`); `src/components/study/JournalEntrySheet.tsx` (przycisk lokalizacji: `coarse:size-11`, ujemny margines, wysokość wiersza bez zmian).
- **Testy:** `e2e/site-docs.spec.ts` (@mobile: pomiar 44×44). Lokalizacja: `e2e/journal-geo.spec.ts` przechodzi, ale rozmiaru przycisku nie mierzy.

## Praca — dostępność: wybór budowy przy wejściu i ikony quizu (Faza 1.6–1.7, 2026-10-22)

- **Co robi:** wybór budowy w „Przed wejściem” to grupa przycisków z `aria-pressed` (zamiast niepełnego `radiogroup` bez strzałek). Ikony poprawnej i błędnej odpowiedzi w quizie mają rolę `img`, więc czytnik je zapowiada.
- **Gdzie:** `src/components/study/EntryCheck.tsx`; `src/components/study/QuizPanel.tsx`.
- **Testy:** `e2e/entry-check.spec.ts` (1/1); `study.spec.ts` i `today-study.spec.ts` przechodzą.

## Praca — alt zdjęć i cele dotyku na /praca (Faza 1.8–1.9, 2026-10-22)

- **Co robi:** zdjęcia we wpisie mają numerowany tekst alternatywny ("Zdjęcie 2 z 3 we wpisie"). Pusty stan dziennika ma przyciski „Dodaj wpis” i „Nowa budowa” o wysokości 44 px na dotyku.
- **Gdzie:** `src/components/study/JournalEntrySheet.tsx` (alt z indeksem); `src/components/study/StudyJournal.tsx` (`coarse:h-11` w pustym stanie).
- **Testy:** `e2e/touch-targets.spec.ts` — nowy test „praca: zakładki działu i „Dodaj wpis”” (@mobile), pełny plik 3/3; `e2e/journal-photos.spec.ts` przechodzi.

## Praca — limit braków: charakteryzacja i widoczność (Faza 2.1–2.2, 2026-10-22)

- **Co robi:** pełna lista braków (40) pokazuje komunikat, co zrobić, zamiast ukrywać formularz bez wyjaśnienia. `cleanShortagesCounted` zwraca listę i liczbę pozycji, które nie weszły przez limit.
- **Zachowanie utrwalone testami:** składanie list nie przycina (41 pozycji zostaje posortowanych po czasie); czyszczenie zostawia 40 pierwszych w kolejności wejścia (najstarsze), najnowsze się nie zapisują.
- **Ograniczenie:** licznik `dropped` jest liczony, ale nie jest jeszcze pokazywany w UI dla pozycji od innego urządzenia. Decyzja „zostawić najstarsze czy najnowsze” czeka na właściciela.
- **Testy:** `src/lib/study/shortages.test.ts`, `src/lib/study/siteItems.test.ts`, `src/components/study/SiteShortagesPanel.test.tsx` (pełna lista); `e2e/site-shortages.spec.ts` 3/3.

## Praca — porządki w stanie danych (Faza 2.3–2.5, 2026-10-22)

- **2.3 replaceAll:** zachowanie „zastępuje cały stan” było już pokryte testem w `yStudy.test.ts` ("replaceAll zastępuje wszystko…"). Bez zmian.
- **2.4 (częściowo):** z `JournalEntrySheet` wyciągnięto czystą funkcję `addShortagesFromDictation` (`lib/study/shortages.ts`): dopisuje braki z wypowiedzi i zwraca liczbę odrzuconych przy pełnej liście. Testy w `shortages.test.ts`. Reszta komponentu (906 linii) bez zmian — kolejne kroki to osobne funkcje z tego samego pliku.
- **2.5:** siedem powtórzeń `siteDirectory(...).find((x) => x.id === id)` w `store.ts` zastąpiono helperem `findSite(s, id)`. Zachowanie bez zmian.
- **Testy:** `src/lib/study` + `src/components/study` 387/387; `e2e/journal-*.spec.ts` i `e2e/site-shortages.spec.ts` 11/11.

## Praca — licznik braków ukrytych ponad limit (Faza 2.2, 2026-10-22)

- **Co robi:** gdy budowa ma więcej niż 40 braków (także od innego urządzenia), panel pokazuje ostrzeżenie z liczbą ukrytych pozycji i wyjaśnieniem, że nie widać najnowszych.
- **Gdzie:** `src/lib/study/store.ts` (`droppedShortages`, `getStudy` dokłada `shortagesDropped`); `src/lib/study/yStudy.ts` (pole pochodne w `StudyState`, nie zapisywane); `src/components/study/SiteShortagesPanel.tsx`.
- **Ograniczenie:** licznik policzony z dokumentu przed przycięciem; zostają najstarsze 40 (decyzja o najnowszych czeka na właściciela).
- **Testy:** `src/components/study/SiteShortagesPanel.test.tsx` (ostrzeżenie); `src/lib/study` 352/352 razem z panelem.

## Praca — reguły arkusza wpisu wydzielone (Faza 2.4, 2026-10-22)

- **Co robi:** komunikaty po zapisie (nowy wpis, poprawka), cofnięcie tematu do powtórki po edycji i propozycja lokalizacji budowy są liczone w czystych funkcjach. Zachowanie bez zmian.
- **Gdzie:** `src/lib/study/entrySheetRules.ts` (`newEntryMessage`, `editSavedMessage`, `editDemotesTopic`, `shouldOfferSiteGeo`); `src/components/study/JournalEntrySheet.tsx` (`submit`, `saveEdit` ich używają).
- **Testy:** `src/lib/study/entrySheetRules.test.ts` 6/6; `e2e/journal-*.spec.ts`, `entry-sheet-focus`, `journal-geo` 9/9.
- **Nie zrobione:** `JournalEntrySheet.tsx` nadal ma ok. 900 linii w jednym komponencie (funkcje dyktowania, zdjęć i szkiców). Kolejne wydzielenia to osobne kroki.

## Plan rozbudowy — stan Fazy 0 i 1a (2026-10-23)

- **Faza 0 zamknięta.** Flagi (`src/lib/featureFlags.ts`, karta w Ustawieniach), RPC dla Workerów (`src/workers/rpc.ts`), zestaw pomiarów (`src/test/fixtures/bigVault.ts`, `e2e/perf.spec.ts` z `PERF=1`), próg paczki startowej 500 KB (decyzja właściciela, `e2e/bundle.spec.ts`). Fala 3 zamknięta wcześniej (2dea8e5).
- **Faza 1a — komponent edytora (bez podłączenia):** `src/components/editor/cmExtensions.ts` (`buildCmExtensions`, czysta konfiguracja CM6 z Markdownem i historią; bez `indentWithTab`, żeby Tab nie zatrzymał klawiatury), `src/components/editor/CmEditor.tsx` (`value`/`onChange`, widok tworzony raz, zewnętrzna zmiana `value` nadpisuje dokument). Testy: `cmExtensions.test.ts`, `CmEditor.test.tsx`. `NoteEditor.tsx` bez zmian.
- **Nie zrobione (następny krok 1a):** podłączenie `CmEditor` za flagą `cmEditor` zamiast `<textarea>`. Wymaga przepięcia `textareaRef` (50 użyć w `useNoteEditSession`, `useWikiAutocomplete`, `useSlashMenu`, `FindReplaceBar`, `EditorStats`, `AddNoteBar`, `useLiveNoteText`) na interfejs selekcji/wstawiania obsługiwany przez CM. Dopiero potem e2e na obu ścieżkach.

## Edytor CodeMirror — podłączenie za flagą `cmEditor` (Faza 1a, 2026-10-23)

- **Co robi:** z włączoną flagą (Ustawienia → „Funkcje w przygotowaniu”) pole treści w edytorze otwartej notatki to CodeMirror 6 zamiast `textarea`. Zapis, autozapis, skróty (Ctrl+B/I/K/Enter/Tab/Alt+↑↓), lista `[[`, menu `/`, `Znajdź i zamień`, licznik i przywracanie zaznaczenia przy zmianie z innego urządzenia działają jak dotąd. Wyłączona flaga = dawny `textarea`, bez zmian.
- **Gdzie:** `src/lib/textControl.ts` (interfejs `TextControl` wspólny dla textarea i CM, `getCaretCoords`, `isTextControlFocused`); `src/components/editor/cmTextControl.ts` (adapter `createCmTextControl(view)`, zmiany przez transakcje, więc Ctrl+Z je cofa); `src/components/editor/CmEditor.tsx` (`textControlRef`, `onSelect`, przechwytywanie klawiszy i schowka w fazie capture); `src/components/NoteEditor.tsx` (`renderEditor`: wybór textarea/CM po fladze, CM leniwie); `src/hooks/useNoteEditSession.ts` (ref `TextControl`, klawisze biorą pole z ref).
- **Jak działa:** `CmEditor` przechwytuje `keydown` i `paste` w fazie capture. Jeśli obsługa wywoła `preventDefault`, zdarzenie zatrzymuje się przed CodeMirrorem (tak jak w textarea, gdzie własny handler wygrywa). Zewnętrzna zmiana `value` jest różnicowa (wspólny prefiks i sufiks), więc karetka zostaje przy tym samym znaku. Zmiany zewnętrzne oznaczone `External` nie wracają jako `onChange`.
- **`applyEdit`:** dla adaptera CM wstawia wynik jedną transakcją `setRangeText`. Ścieżka `execCommand` (natywne Ctrl+Z textarea) zostaje tylko dla prawdziwego `HTMLTextAreaElement`.
- **Ograniczenia i pułapki:**
  - Kompozytor nowej notatki (`AddNoteBar`) nadal jest textarea; flaga dotyczy tylko edycji istniejącej notatki.
  - Pasek boczny i kafel w siatce nie montują CM; CM tworzy się przy edycji.
  - `CmEditor` ma ok. 500 KB (chunk `CmEditor-*.js`), wykluczony z precache w `vite.config.ts` (`globIgnores`), żeby paczka precache mieściła się w progu 3,2 MB. Pierwsze użycie offline wymaga połączenia.
  - Wysokość: w trybie pełnym ekranu bez listy edytor wypełnia okno; autosize (`useNoteEditSession`) działa tylko dla textarea.
  - Nie sprawdzone jeszcze: IME i autokorekta Androida, pasek formatowania na telefonie, zdalna zmiana tekstu (`live-text`) przy włączonej fladze.
- **Testy:** `src/components/editor/cmTextControl.test.ts` (adapter, `setRangeText`, `applyEdit`); `src/components/editor/CmEditor.test.tsx`, `cmExtensions.test.ts`; `e2e/editor-cm.spec.ts` (4 przypadki z flagą: zapis, Ctrl+B/Ctrl+Z, lista, `[[`). Regresja z flagą wyłączoną: `editing`, `editor-keys`, `slash-menu`, `wikilinks`, `mentions`, `live-text` — 25/25. `bundle.spec.ts` 6/6 po wykluczeniu chunka CM z precache.
- **Commit:** `a5e5404` (2026-10-23).

## Edytor CodeMirror — domknięcie Fazy 1a (2026-10-23)

- **Projekt `chromium-cm`** (`playwright.config.ts`): te same testy edytora z zapisaną flagą `cmEditor` (`e2e/fixtures/cm-on.storage.json`). Uruchomienie: `npx playwright test --project=chromium-cm`. Stan 32/32.
- **Wspólny helper** `e2e/helpers/editor.ts`: `editorBody(scope)` znajduje pole treści w obu trybach (textarea albo textbox CM); `readEditorText` czyta tekst (dla CM z linii `.cm-line`, bez placeholdera); `expectEditorText` to asercja z ponawianiem. Testy `checklist`, `editing`, `editor-keys`, `live-text`, `live-text-focused`, `mentions`, `slash-menu`, `wikilinks` używają go zamiast `getByPlaceholder("Treść notatki...")` i `toHaveValue`. Pola inne niż treść (tytuł, pozycje listy) bez zmian.
- **Fokus po Enter w tytule:** CM ładuje się leniwie, więc Enter może przyjść przed montażem. `NoteEditor` zapamiętuje żądanie (`bodyFocusPending`), a `CmEditor` przyjmuje `autoFocus` i ustawia fokus przy montażu. Chunk CM ładuje się też od razu po otwarciu edytora (prefetch w `useEffect`).
- **Regresja bez flagi:** 33/33 (`--project=chromium`, pliki edytora razem z `editor-cm.spec.ts`).
- **Zostaje:** pełna przeglądarka mobilna (iPhone, Pixel) z flagą; IME i autokorekta Androida na prawdziwym telefonie.

## Notatki — edytor wiązany z dokumentem Yjs (Faza 1b, 2026-10-23)

- **Co robi:** z flagą `cmEditor` w edytorze otwartej notatki (nie prywatnej) każda zmiana tekstu trafia od razu do dokumentu Yjs i do IndexedDB. Zdalne zmiany pojawiają się w otwartym edytorze bez scalania szkicu. Ctrl+Z cofa przez historię Yjs (osobno pisanie, osobno formatowanie i podpowiedzi). „Zapisz” nie jest potrzebne, żeby tekst przetrwał przeładowanie.
- **Gdzie:**
  - `src/components/editor/CmEditor.tsx` — prop `yText`: tworzy stan z `Y.Text`, nie synchronizuje `value`, tworzy `Y.UndoManager` na sesję i czyści ref tylko własnego adaptera.
  - `src/components/editor/cmExtensions.ts` — `buildCmExtensions({ yText, yUndoManager })`: `yCollab` (y-codemirror.next 0.3.6, przypięty) i `yUndoManagerKeymap` zamiast `history()`.
  - `src/components/editor/cmTextControl.ts` — `setRangeText` zamyka grupę cofania przed i po operacji (`stopCapturing`).
  - `src/hooks/useNoteEditSession.ts` — `collab`/`collabText`, `writeContent` (wszystkie zapisy treści), `commitDraft` bez treści w trybie wiązania, `savedContentRef` i `openContentRef` (wersja z chwili otwarcia).
  - `src/lib/yjsStore.ts` — `getNoteText(id)`: `Y.Text` notatki, `null` dla zaszyfrowanej.
  - `src/hooks/useNotes.ts` — `getNoteYText`, `newNoteUndoManager`, typy `NoteYText`, `NoteUndoManager` (jedyne miejsce, gdzie wolno importować `yjs` w edytorze).
  - `src/components/NoteEditor.tsx` — `yText` i `key` zależny od trybu; wszystkie zapisy treści przez `writeContent`.
- **Jak działa:**
  - Tryb wiązania włącza się, gdy flaga jest włączona i `getNoteYText` zwraca `Y.Text` (czyli notatka nie jest prywatna). Inaczej działa stara ścieżka szkicu (`beginTextEdit`/`rebaseTextEdit`).
  - `commitDraft` w tym trybie zapisuje tylko tytuł i listę. Wersję historii robi raz na sesję z treścią z chwili otwarcia. Zapis treści ponawia się tylko wtedy, gdy zmieniła się od ostatniego zapisu (`savedContentRef`), żeby autozapis nie podbijał `updatedAt` co 5 s.
  - `writeContent` z adaptera CM (`applyEdit`) albo, gdy CM jeszcze się nie zamontował (chunk ładuje się leniwie), bezpośrednio do `Y.Text` w jednej transakcji. Edytor wchodzi potem z aktualnym tekstem.
  - Wybór podpowiedzi `[[`/`@` idzie przez `writeContent` (wcześniej przez szkic — w trybie wiązania tekst nie wchodził do dokumentu).
- **Ograniczenia i pułapki:**
  - `fill` w Playwright (i zastąpienie całej treści) to w CRDT usunięcie i ponowne wstawienie wszystkiego. Współbieżne dopiski drugiego urządzenia zostają przed nowym tekstem. W testach dopisuje się na początku (Ctrl+Home), a nie zastępuje całość.
  - Undo grupuje zmiany w oknie `captureTimeout` (500 ms). Bez `stopCapturing` przy operacjach dyskretnych Ctrl+Z cofał pisanie razem z pogrubieniem.
  - Ref adaptera: po zmianie `key` stara instancja nie może wyzerować nowej (sprawdzane po własnym adapterze).
  - Notatki prywatne (szyfrogram, `locked`) zostają przy ścieżce szkicu, bez `Y.Text`.
  - Każdy `UndoManager` żyje tyle, ile montaż edytora: po zamknięciu edycji historia cofania się zaczyna od nowa (jak w textarea).
  - Test „bez Zapisz” czeka 1,5 s na zapis IndexedDB przed przeładowaniem. To świadome, bo zapis jest asynchroniczny.
- **Testy:**
  - Jednostkowe: `src/components/editor/cmTextControl.test.ts`, `CmEditor.test.tsx`, `cmExtensions.test.ts`.
  - E2E z flagą (`chromium-cm`, 34/34): `e2e/editor-cm.spec.ts` (w tym Ctrl+Z osobno od pisania i zapis bez „Zapisz”), `live-text.spec.ts` (zdalna zmiana, dopisek na początku), `checklist`, `editing`, `editor-keys`, `mentions`, `slash-menu`, `wikilinks`.
  - E2E bez flagi (`chromium`, 41/41), w tym `bundle.spec.ts`.
- **Nie zrobione:** Faza 1b w planie „motywy” (animacje per styl) — osobny krok. Telefon (IME, pasek formatowania) nadal bez przeglądu na urządzeniu.
- **Commit:** `afa048e` (2026-10-23).

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

## Edytor CodeMirror — podgląd na żywo Markdown (Faza 1c, 2026-10-23)

- **Co robi:** w edytorze CM (flaga `cmEditor`) znaczniki Markdown znikają z linii, na której nie ma kursora: `#` nagłówka (wraz ze spacją), `**`, `*`, `` ` `` w kodzie, `~~`, nawiasy i adres linku `[tekst](adres)`, `>` cytatu. Treść dostaje styl: nagłówki H1–H6, pochylenie, pogrubienie, kod, przekreślenie, link, pionowa kreska cytatu. Kursor albo zaznaczenie na danej linii przywraca znaczniki do edycji.
  Widżety: **pole zadania** `- [ ]`/`- [x]` jest zawsze widoczne jako pole wyboru (klik odhacza w treści notatki); **linia pozioma** `---` poza kursorem jest kreską; **tabela GFM** poza kursorem jest prawdziwą tabelą (nagłówek i wiersze, komórki to zwykły tekst); **obraz** `![alt](adres)` poza kursorem to etykieta „obraz: alt” (nic nie ładuje się z sieci, jak w czytniku); **`[[link]]`** poza kursorem traci nawiasy, a tekst dostaje styl wikilinku (kropkowane podkreślenie). Klik w taki link otwiera notatkę (jak w czytniku); na linii z kursorem klik tylko ustawia kursor, żeby dało się edytować znaczniki.
- **Gdzie:**
  - `src/components/editor/livePreview.ts` — `buildLivePreview(state, from, to)` (czysta funkcja: dekoracje i zbiór ukrytych zakresów), `activeLineNumbers(state)`, `wikiTargetAt(state, pos)` (tytuł linku pod pozycją albo `null`; `null` na linii z kursorem i w kodzie), `livePreview({ onWikiClick })` (rozszerzenie: `ViewPlugin` + `EditorView.atomicRanges` + `baseTheme` z klasami `cm-lp-*` + `domEventHandlers` na `mousedown` dla kliku w link). Widżety: `TaskWidget` (pole zadania, klik przez `view.posAtDOM` zmienia znak w `[ ]`), `RuleWidget` (`<hr>`); stałe `WIKI_LINK`, `CODE_NODES`, funkcja `insideCode`.
  - `src/components/editor/livePreview.ts` (obrazy i tabele): `ImageWidget(alt)` (etykieta obrazu, klik ustawia kursor w `![…]`), `TableWidget(rows)` (`<table>`, klik w tabelę ustawia kursor na jej początku), `tableCells(line)` (dzieli wiersz po `|`, respektuje `\|`), `tableIsRendered(state, node, active)` (tabela jest blokiem tylko, gdy zajmuje całe linie i żadna z nich nie jest aktywna), `buildTables(state)`, `tableField` (StateField z dekoracjami blokowymi i `atomicRanges`).
  - `src/components/editor/cmExtensions.ts` — `livePreview({ onWikiClick })` dodane po `markdown(...)` w `buildCmExtensions`; opcja `onWikiClick` w `CmExtensionOptions`. Parser to `markdown({ base: markdownLanguage, extensions: [GFM] })` z `@lezer/markdown` (już w `package.json`), bo bez GFM tabele nie są rozpoznawane.
  - `src/components/editor/CmEditor.tsx` — prop `onWikiClick` idzie przez `useLatestRef`, więc widok (tworzony raz) zawsze woła aktualną funkcję.
  - `src/components/NoteEditor.tsx` — przekazuje `onWikiClick` do CM (ta sama funkcja co w czytniku: `handleWikiClick` z `pages/Index.tsx`, otwiera notatkę albo pokazuje „nie istnieje”).
  - `src/components/EditorStats.tsx` — poprawka typów (patrz niżej).
- **Jak działa:**
  - Drzewo składni z `@codemirror/lang-markdown` (Lezer). `ensureSyntaxTree` z limitem 200 ms, potem iteracja tylko po `view.viewport`.
  - Linia aktywna = linia każdego zaznaczenia (`activeLineNumbers`). Znacznik ukrywa się, gdy jego linia nie jest aktywna. Ukrycie to `Decoration.replace({})`, więc dokument się nie zmienia, a zapis, Yjs i kopie działają jak dotąd.
  - Przebudowa dekoracji tylko przy zmianie tekstu, widoku albo zestawu aktywnych linii (klucz tekstowy). Ruch kursora w tej samej linii nic nie kosztuje.
  - Ukryte zakresy są „atomowe” (`atomicRanges`): strzałka i Backspace przeskakują przez znacznik, zamiast wchodzić w środek.
  - Dekoracje blokowe (tabela zajmuje kilka linii) nie mogą pochodzić z ViewPlugin, więc tabele liczy StateField `tableField`. Przelicza się przy zmianie tekstu albo zaznaczenia, a parser jest cache'owany. Obraz jest inline i zostaje w pluginie.
  - Nagłówek to dekoracja linii (`Decoration.line`), więc wygląd zostaje, nawet gdy `#` jest ukryte.
  - Pole zadania i linia pozioma to `Decoration.replace({ widget })`, dodane też do zbioru `hidden`, więc są atomowe. Pole zadania nie zależy od kursora. Klik nie zmienia stanu widżetu: wysyła transakcję zmieniającą jeden znak (`[ ]`↔`[x]`), a widżet przerysowuje się z tekstu. Dzięki temu odhaczenie trafia do Yjs i do zapisu jak zwykła edycja.
  - Klik: `mousedown` (nie `click`), żeby kliknięcie w link poza kursorem otwierało notatkę zamiast przesuwać kursor. `wikiTargetAt` sprawdza, czy linia nie jest aktywna, i zwraca `null` w kodzie. Dopiero wtedy `preventDefault` i `onWikiClick(tytuł)`. Tytuł to część przed `#` (jak w `splitWikiTarget`); alias `[[cel|tekst]]` nie jest jeszcze obsługiwany ani w czytniku, ani tu.
  - `[[link]]` nie jest składnią GFM. Skan (`WIKI_LINK`, ten sam kształt co `lib/wikiLinks.ts`) działa na widocznych liniach i pomija fragmenty kodu (`insideCode`). Parser widzi `[[Tytuł]]` jako link `[Tytuł]` z zewnętrznym `[` w tekście, więc `enter` zwraca `false` dla takiego węzła `Link` (pomija dzieci). Bez tego nawiasy byłyby ukrywane podwójnie.
- **Ograniczenia i pułapki:**
  - Tekst w DOM nie jest dokumentem: poza linią kursora `textContent` nie zawiera `**`. Testy czytające `.cm-line` widzą wtedy treść bez znaczników. Źródłem prawdy jest zawsze `state.doc`.
  - `Setext` (podkreślenie `===`/`---`) nie ukrywa podkreślenia, tylko styluje linię tytułu.
  - Przekreślenie `~~` pojawia się tylko, jeśli parser je zwraca. Konfiguracja `markdown({ base: markdownLanguage })` nie włącza GFM; nie sprawdzono, czy `~~` jest wtedy rozpoznawane.
  - Viewport: dekoracje powstają tylko dla widocznego fragmentu. Przy bardzo długiej notatce parser może nie zdążyć w 200 ms; wtedy część stylu pojawia się dopiero po przewinięciu.
  - Komórki tabeli w CM to zwykły tekst: `**` i `[[link]]` w komórce pokazują się dosłownie, choć w czytniku są stylizowane. Tabela z kursorem w dowolnej linii wraca do tekstu.
  - Obraz nie pokazuje podglądu, nawet lokalnego: obrazy notatek są załącznikami poza treścią Markdown, a zdalne adresy celowo się nie ładują (piksel śledzący).
  - Tabele są liczone dla całego dokumentu przy każdej zmianie tekstu i zaznaczenia, więc bardzo długie notatki z wieloma tabelami mogą być wolniejsze niż widok na samą widoczną część. Parser ma limit 200 ms.
  - Z GFM rozpoznawane jest też przekreślenie `~~` (wcześniej nie było pewne, patrz wyżej), a gołe adresy są linkami w składni.
  - KaTeX (wzory) nie ma widżetu; to Faza 6 i wymaga nowej zależności.
  - Klik otwiera notatkę tylko na linii bez kursora. Żeby postawić kursor w środku wyrenderowanego linku, trzeba kliknąć inną część linii albo użyć strzałek. To kompromis.
  - `onWikiClick` jest brany przy montażu widoku: `CmEditor` podpina obsługę tylko wtedy, gdy funkcja istnieje w chwili montażu. Późniejsze dodanie funkcji nie zadziała do ponownego montażu (`key` w `NoteEditor`). Obecnie `Index.tsx` przekazuje stałą funkcję, więc to nie boli.
  - Pole zadania ma 1,1 em (ok. 18 px) i jest opakowane w `span.cm-lp-task-hit` 44 × 44 px (cel dotyku, ujemne marginesy nie przesuwają tekstu). Dotyk na prawdziwym telefonie nadal do sprawdzenia w QA.
  - Pole zadania i linia pozioma są widżetami, więc ich wpisy nie pojawiają się w `textContent`. Testy czytające tekst muszą to uwzględniać (`e2e/helpers/editor.ts` zamienia pole z powrotem na `[ ]`/`[x]`).
  - Zachowanie dla `[[a|b]]` (alias) jest takie samo jak dla zwykłego linku: nawiasy znikają, cały tekst z `|` zostaje widoczny.
- **Naprawy przy okazji (typecheck był czerwony od commitów 1a/1b):**
  - `EditorStats.tsx`: porównania `e.target` i `document.activeElement` z `TextControl` (typy się nie łączyły). Fokus sprawdza `isTextControlFocused`. Dla CM oznacza to, że licznik liczy zaznaczenie także w adapterze CM (wcześniej warunek zawsze kończył wczesnym `return`).
  - `cmExtensions.ts`: `undoManager` idzie do `yCollab` tylko, gdy istnieje, w przeciwnym razie `undefined` (domyślny menedżer biblioteki, jak wcześniej).
- **Testy:**
  - Jednostkowe: `src/components/editor/livePreview.test.ts` (18 testów: ukrywanie `**`/`*`, nagłówek z kursorem i bez, `` ` ``, link, cytat, dokument niezmieniony, klasa nagłówka; widżety: pole zadania zawsze, klik odhacza i cofa w DOM `EditorView`, linia pozioma, `[[link]]` z kursorem i bez, `[[...]]` w kodzie zostaje; `wikiTargetAt`: tytuł pod kliknięciem, `null` na linii z kursorem, poza linkiem i w kodzie). Reszta `cmExtensions.test.ts`.
  - Jednostkowe, dodane: `tableCells` (dzielenie wierszy, `\|`); DOM: tabela renderuje się poza kursorem i wraca do tekstu z kursorem, obraz to etykieta bez `<img>`, a dokument się nie zmienia.
  - E2E z flagą (`--project=chromium-cm`): 37/37, w tym `editor-keys`, `editor-cm` (pole zadania i `[[link]]` poza kursorem; klik w `[[link]]` otwiera notatkę; tabela i obraz w `editor-cm`), `checklist`, `mentions`, `slash-menu`, `wikilinks`.
  - E2E bez flagi: `bundle`, `editing`, `editor-keys`, `live-text`, `checklist` — 27/27.
  - Vitest pełny: 1920 testów; `e2e/bundle.spec.ts` (budżety) 6/6. Typecheck (`tsconfig.app.json`) i lint czyste.
  - Brak e2e w przeglądarce sprawdzającego samo znikanie znaczników; pokrywa to test DOM w jsdom.
- **Nie zrobione (kolejne kroki Fazy 1):** podgląd wzoru (KaTeX, Faza 6); pasek formatowania nad klawiaturą na telefonie, test IME i autokorekty Androida na prawdziwym urządzeniu, przegląd na Pixel 7 / iPhone; QA celu dotyku pola zadania na telefonie (44 px zrobione).
- **Commit:** `b9e2e11` (widżety), `a2c58f0` (klik w `[[link]]`), `075384b` (tabele i obrazy), 2026-10-23.

## Synchronizacja — przekaźnik E2E, serwer (Faza 2, 2026-10-23)

- **Co robi:** zmiany w notatkach docierają na drugie urządzenie także wtedy, gdy pierwsze jest wyłączone. Serwer przechowuje tylko zaszyfrowany log aktualizacji Yjs i nie zna treści ani kodu synchronizacji. Sam serwer nie ma jeszcze klienta w aplikacji (patrz „Ograniczenia”).
- **Gdzie jest:** `relay-server/` — `core.js` (czysta logika: tokeny, log, snapshot, limity, sprzątanie), `server.js` (HTTP i WebSocket), `Dockerfile`, `README.md` (model zagrożeń, protokół, limity).
- **Jak działa:**
  - Pokój ma identyfikator 64 znaki hex (klient wylicza go z kodu). Pierwszy zapis zakłada pokój i ustawia jego token; serwer przechowuje tylko `SHA-256(token)` (`hashToken`, porównanie `timingSafeEqual` w `tokenMatches`).
  - Wpisy mają rosnące numery `seq` (`appendEntry`). `GET updates?since=n` zwraca wpisy > n, najwyżej 500 na stronę (`entriesSince`, `hasMore`).
  - Snapshot (`applySnapshot`) zastępuje wpisy ≤ `upto` jednym wpisem o numerze `upto`; numeracja się nie cofa, więc klient na `upto` nie pobiera nic nowego.
  - Token idzie w nagłówku `Authorization: Bearer` albo w pierwszej wiadomości WS (`subscribe`), nigdy w adresie.
  - WS (`/ws`) tylko powiadamia `{type:"updated", last}` po zapisie; treść zawsze idzie przez GET.
  - Dane w `DATA_DIR/relay.json`, zapis atomowy (plik tymczasowy + `rename`), grupowany co 0,5 s.
- **Decyzje:** zamiast SQLite (`better-sqlite3`, natywna kompilacja) zwykły plik JSON jak w `push-server` — mniej zależności i prostszy Docker. Limity w `LIMITS` (`core.js`): wpis 700 000 znaków, pokój 50 MB i 5000 wpisów, 5000 pokoi, TTL pokoju 180 dni bez zapisu.
- **Ograniczenia i pułapki:**
  - Zapis całego pliku JSON skaluje się źle przy dużych danych; przy wielu aktywnych pokojach trzeba będzie przejść na bazę.
  - `TRUST_PROXY=1` (ustawione w obrazie Dockera) ufa `X-Forwarded-For`; bez reverse proxy nie wolno go ustawiać.
  - Klient (`src/lib/sync/relayProvider.ts`) jeszcze nie istnieje — serwer działa, ale aplikacja z niego nie korzysta.
- **Testy:** `relay-server/core.test.js` (19 testów logiki, `npm test`). Ręcznie sprawdzone na uruchomionym serwerze: rejestracja tokenem, 401/403/404, odczyt po `since`, snapshot, odrzucenie złego base64, WebSocket: `ready`, powiadomienie `updated` po zapisie, zamknięcie 4003 dla nieznanego pokoju.
- **Commit:** `adfb099` (2026-10-23).

## Synchronizacja — przekaźnik E2E, klient (Faza 2, 2026-10-23)

- **Co robi:** z włączonym przekaźnikiem zmiany w notatkach (cały `yjsStore.doc`: notatki, teksty, metadane) idą na serwer zaszyfrowane i wracają na inne urządzenia, nawet gdy nadawca jest już wyłączony. Działa równolegle z P2P. Bez adresu przekaźnika nic się nie zmienia. Obrazy i załączniki nadal idą tylko P2P.
- **Gdzie jest:**
  - `src/lib/sync/relayKeys.ts`: `deriveRelayKeys(code)` (PBKDF2 → `roomId`, `token`, klucz danych), `sealBytes` / `openBytes`, `relayAad(roomId)`.
  - `src/lib/sync/relayProvider.ts`: `RelayProvider` (kolejka wysyłania, pobieranie stronicowane, kursor, snapshot, WebSocket, ponawianie). Interfejs `RelayStore` (trwałość) i `RelayStatus`.
  - `src/lib/sync/relayRuntime.ts`: `startRelay(code)` / `stopRelay()` (wołane z `yjsSync.ts` w `connect()` i `disconnectProvider()`), `validRelayUrl`, `getRelayUrl` / `setRelayUrl` (klucz `localStorage` `kaczy.relay.v1`), `useRelayView()` (status dla UI), magazyn w IndexedDB (`kaczy-relay`).
  - `src/components/SyncSettings.tsx`: sekcja „Przekaźnik” (`RelayServer`, `relayStatusText`).
- **Jak działa:**
  - Klucze: `kod → PBKDF2-SHA-256 (sól stała, 200 000 iteracji) → master`. Z `master`: `roomId` = SHA-256(`notki-relay-room:` ‖ master) w hex, `token` = HKDF(`notki-relay-auth-v1`), klucz danych AES-GCM = HKDF(`notki-relay-data-v1`), niewyodrębnialny. PBKDF2 jest po to, że kod ma ok. 59 bitów i sam HKDF nie utrudniłby zgadywania operatorowi serwera.
  - Wysyłanie: `doc.on("update")` zbiera zmiany (poza własnym źródłem `origin`), co 1 s scala je (`Y.mergeUpdates`), szyfruje i `POST`. Zmiany są w `RelayStore` do chwili potwierdzenia, więc przeżywają zamknięcie karty. Przy schowaniu karty wysyłane od razu (`flushNow`), przy powrocie `sync()`.
  - Pobieranie: `GET since=kursor`, po 500 wpisach stronami, każdy wpis odszyfrowywany i stosowany `Y.applyUpdate` z własnym `origin`. Kursor zapisywany po każdej stronie.
  - Numer swojego wpisu: jeśli serwer przydzielił `kursor + 1`, dokument już go ma, więc kursor rośnie bez pobierania.
  - Snapshot: po 500 wpisach od poprzedniego snapshotu wysyłany jest `Y.encodeStateAsUpdate(doc)` z `upto = kursor`. Obejmuje też lokalne, jeszcze niewysłane zmiany; ich późniejsze wysłanie jest bez skutku.
  - WebSocket (`/ws`): po `subscribe` serwer wysyła `ready` (wtedy `sync()`) i `updated` (wtedy pobranie, gdy `last > kursor`). Po zamknięciu ponawianie 2 s, 4 s … do 60 s.
  - Wszystkie operacje sieciowe idą jedną kolejką (`run`), więc nie przeplatają się.
- **Decyzje i ograniczenia:**
  - Błędy: sieć/5xx/429 → status `offline`, ponawianie. 401/403 → `error` („Serwer nie przyjął kodu”), bez ponawiania. Wpis, którego nie da się odszyfrować → `error`, kursor nie idzie dalej. Nie nadpisujemy danych ani nie pomijamy wpisu po cichu.
  - Wpis większy niż limit serwera (512 KB) albo snapshot większy niż limit daje błąd; duży dokument tekstowy może tego dotknąć. Brak dzielenia wpisów.
  - Powiadomienie „Zmiana z innego urządzenia” (toast w `yjsSync.ts`) działa tylko dla P2P, bo sprawdza `origin` providera P2P.
  - Pierwsze połączenie wyprowadza klucze (PBKDF2, ok. 200 000 iteracji) — chwila na telefonie przy każdym starcie synchronizacji.
  - Adres przekaźnika tylko `https://` (albo `http://localhost` do testów); w `localStorage` ze względu na prostotę, nie jest sekretem.
- **Testy:**
  - `relayProvider.test.ts` (10 testów): dwa `Y.Doc` z atrapą serwera o tym samym protokole. Wymiana, nowe urządzenie z historią, zapis offline, kolejka po restarcie, zły klucz danych, zły token, kompaktowanie po 500 wpisach, `stop()`.
  - `relayServer.integration.test.ts` (3 testy): klient ↔ prawdziwy `relay-server/server.js` jako proces. Wymiana, izolacja pokoi, odrzucenie złego tokenu.
  - Klucze (`deriveRelayKeys`) — dwa testy w `relayProvider.test.ts`; `validRelayUrl` — `relayRuntime.test.ts`.
- **Testy przycisku i powiadomienia (dopisane później):** przycisk „Testuj” (`checkRelay` w `relayRuntime.ts`: `GET /health`, bez kodu i tokenu; zwraca liczbę pokoi albo powód błędu, nie wysyła zapytania pod niepoprawny adres) i powiadomienie „Zmiana z innego urządzenia” (`onRemoteChange` w `RelayProvider`: tylko gdy Yjs realnie zmienił dokument po pobraniu, nie przy echu własnego wpisu; w `relayRuntime.ts` co 30 s, tylko na widocznej karcie). Testy: `relayRuntime.test.ts` (`checkRelay`), `relayProvider.test.ts` (powiadomienie), `e2e/relay-settings.spec.ts` (3 testy: walidacja i zapis, wyczyszczenie, „Testuj” pod nieosiągalnym adresem).
- **Commit:** `1207987` (2026-10-23); dodatki w osobnym commicie.
- **Wdrożenie:** decyzja 2026-10-23 — przekaźnik zostaje lokalny (bez hostingu). Adres wpisuje się w Ustawieniach → Sync → Przekaźnik; kod nie zawiera adresu serwera.

## Synchronizacja — obrazy i załączniki przez przekaźnik (Faza 2, 2026-10-23)

- **Co robi:** obrazy i załączniki notatek docierają na inne urządzenie także wtedy, gdy nadawca jest wyłączony (przy włączonym przekaźniku). Działa obok P2P i nie zmienia tego, co już jest.
- **Gdzie jest:**
  - `src/lib/sync/relayBlobs.ts`: `RelayBlobs` (przebieg: wysyłanie brakujących blobów przez HEAD → PUT, pobieranie referencji bez lokalnego obrazu przez GET), `packBlob` / `unpackBlob` (nagłówek MIME + bajty).
  - `src/lib/sync/relayKeys.ts`: `blobIdOf` (HMAC z klucza `notki-relay-blobid-v1` nad SHA-256 treści), `sealRaw` / `openRaw`, `blobAad`.
  - `src/lib/sync/relayRuntime.ts`: `scheduleBlobs` / `runBlobs` — przebieg przy starcie, 3 s po zmianie notatek (`notesMap.observeDeep`) i po zmianie z przekaźnika; jeden przebieg naraz.
  - `relay-server/core.js` (`validBlobId`, `blobFits`, limity), `relay-server/server.js` (`handleBlob`, pliki w `DATA_DIR/blobs`).
- **Jak działa:**
  - Referencje: `yjsStore.syncableRefs()` (te same co w P2P). Lokalny obraz, którego serwer nie ma → PUT. Referencja bez lokalnego obrazu → GET, odszyfrowanie, `putBytes(bytes, type, hash)`: obraz o złym SHA-256 jest odrzucany przez `imageStore`.
  - Serwer widzi tylko identyfikator (HMAC — nie da się sprawdzić, czy ma znany obraz, bez kodu), rozmiar i zaszyfrowane bajty. Typ MIME jest w zaszyfrowanej treści.
  - Odczyt i zapis wymagają tokenu pokoju; GET obcego kodu daje 404 (inny pokój).
- **Ograniczenia:**
  - Bloby większe niż 24 MB (zaszyfrowane) są odrzucane; obraz lokalny nadal działa, tylko nie wyjdzie na serwer.
  - Pierwszy przebieg po starcie sprawdza każdą referencję HEAD-em; przy wielu obrazach to dużo małych zapytań. Cache `known` obowiązuje tylko w sesji.
  - Nieudane przebiegi są liczone i zapisywane jako ostrzeżenie w diagnostyce, bez ponawiania poza następnym wywołaniem.
- **Testy:**
  - `relayBlobs.integration.test.ts` (5 testów): pakowanie, niebezpieczny MIME, wysyłka A → B bajt w bajt bez ponownego wysłania, obcy kod nie czyta, brak bloba = brak błędu.
  - `relay-server/core.test.js` (+3 testy: identyfikator, limity pojedynczy i pokoju, czyszczenie magazynu).
  - Smoke na uruchomionym serwerze: PUT, ponowny PUT, HEAD, GET bajt w bajt, zły token 403, brak 404, zły identyfikator 400, brak tokenu 401.
- **Keepalive (dopisane po commicie blobów):** `RelayProvider.setHidden(hidden)` — karta schowana: `flushNow` i ping `{"type":"ping"}` co `KEEPALIVE_MS` (20 s) na otwartym gnieździe; karta wróciła: ping zatrzymany i `sync()`. Serwer ignoruje wiadomości po subskrypcji, więc ping nie wymaga zmian po stronie serwera. Test: `relayProvider.test.ts` (fałszywe timery tylko dla interwałów).
- **Zmiany przed startem i kolejny start (dopisane):** `RelayProvider.start()` dokłada do kolejki różnicę `Y.encodeStateAsUpdate(doc, sv)`, gdzie `sv` to wektor stanu z ostatniego udanego wysłania (`RelayState.sv`, w IndexedDB). Zmiany zrobione przed startem nie przechodzą przez nasłuch `update`, więc bez tego zostałyby lokalnie. Po każdym udanym `POST` zapisujemy `sv` z chwili przed zakodowaniem wysyłki. Testy: `relayProvider.test.ts` (sprzed startu; kolejny start wysyła tylko różnicę).
- **Błąd znaleziony w e2e:** `this.fetchFn = opts.fetch ?? fetch` — natywny `fetch` wołany jako metoda obiektu rzucał „Illegal invocation”, a błąd był łapany jako „offline” i ponawiany, więc nic nie było widać. Teraz `fetch.bind(globalThis)` w `relayProvider.ts` i `relayBlobs.ts`. Testy jednostkowe nie wykryły tego, bo wstrzykują własny `fetch`.
- **E2E z prawdziwym serwerem:** `playwright.config.ts` ma drugi `webServer` (`node server.js` w `relay-server/`, port 4466, `DATA_DIR` w katalogu tymczasowym; wymaga `npm install` w `relay-server/`). `e2e/relay-sync.spec.ts` (2 testy): A zapisuje notatkę i zamyka się, B z tym samym kodem ją dostaje; obcy kod nie dostaje. Czeka na POST wywołany po zapisie — pierwszy POST po starcie niesie stan początkowy.
- **Ograniczenie:** zamknięcie karty w ciągu sekundy od zmiany może przerwać wysyłkę. Zmiana zostaje w kolejce IndexedDB i wyśle się przy następnym uruchomieniu; drugie urządzenie jej nie zobaczy, dopóki pierwsze nie wróci online.
- **Commit:** `12dd69b` (bloby), `0f04d0a` (keepalive); poprawki z e2e w commicie poniżej.

## Sync — status przekaźnika z kropką (poprawka wizualna, 2026-10-23)

- **Co robi:** przy statusie przekaźnika w Ustawieniach → Sync jest kropka w kolorze stanu: zielona (połączono), szara pulsująca (łączenie, tylko przy dozwolonym ruchu), żółta (brak połączenia, ponowi samo), czerwona (błąd), szara (wyłączony). Tekst zostaje i mówi to samo, więc kolor nie jest jedyną informacją.
- **Gdzie jest:** `src/components/SyncSettings.tsx` — `relayDotClass` (obok `relayStatusText`), w komponencie `RelayServer`. Kolory z tokenów `success`, `warning`, `destructive` i `muted-foreground`.
- **Testy:** `e2e/relay-settings.spec.ts` (3 testy, bez zmian). Zrzut sprawdzony na komputerze i telefonie.
- **Naprawa testów e2e (nie kodu aplikacji):** `composer.spec.ts` — przycisk „Usuń przypomnienie” jest dwa razy, asercja na pierwszym widocznym; `resilience.spec.ts` — komunikat „Nie zapisano” jest dwa razy (widoczny i dla czytnika), asercja na pierwszym.

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

## Sieć wiedzy — aliasy notatek i `[[cel|tekst]]` (Faza 3.1, 2026-10-23)

- **Co robi:**
  - **Aliasy:** notatka może mieć inne nazwy (np. „łazienka”, „PL”). `[[alias]]` prowadzi do niej tak samo jak do tytułu. Ustawiane w „Więcej opcji” kafla (przycisk „Aliasy”, pole oddzielone przecinkami, Enter zapisuje). Tytuł zawsze wygrywa z aliasem, więc alias nie przesłania istniejącej notatki.
  - **`[[cel|tekst]]`:** cel prowadzi tak jak zwykły link, a w czytniku widać `tekst` zamiast celu.
  - Aliasy są w podpowiedziach `[[` po tytułach, bez duplikatów, i liczą się jako wsteczne linki do notatki.
- **Gdzie jest:**
  - `src/lib/wikiLinks.ts` — `splitWikiTarget` (zwraca `display`), `resolveWikiTarget` (tytuł, potem alias), `buildWikiIndex` (aliasy w `titles`), `backlinksOf` (po tytule i aliasach), `cleanAliases` (przycinanie, duplikaty, limity `ALIAS_MAX_COUNT` = 20, `ALIAS_MAX_LENGTH` = 200).
  - `src/hooks/useNotes.ts` — pole `aliases?: string[]` w `Note` (opcjonalne, starsze notatki go nie mają).
  - `src/lib/noteSchema.ts`, `src/lib/safeProjection.ts` (`REMOTE_LIMITS.aliases`), `src/lib/yjsStore.ts` — zapis do Yjs (`y.set("aliases")`, tylko niepuste), odczyt w projekcji (pole dołączane tylko gdy niepuste), `aliases` w `NOTE_SCALAR_FIELDS` (patch).
  - `src/components/AliasPicker.tsx` — popover z polem; `src/components/NoteCardActions.tsx` — przycisk w „Więcej opcji”, nie dla zaszyfrowanych i zarchiwizowanych.
  - `src/components/WikiLinkPreview.tsx` — prop `label` (tekst wyświetlany), `src/components/MarkdownRendererImpl.tsx` przekazuje `display`.
- **Ograniczenia:**
  - Podgląd w edytorze CodeMirror (Faza 1c) pokazuje `[[cel|tekst]]` jako `cel|tekst` bez nawiasów; czytnik pokazuje sam tekst. Ujednolicenie w CM to osobny krok.
  - Aliasy nie są jeszcze w eksporcie Markdown/ZIP ani w imporcie (plan Fazy 3.1 wymienia frontmatter); notatka wyeksportowana i zaimportowana gubi aliasy.
  - Pole w menu jest tylko na komputerze i w arkuszu „Więcej opcji”; brak osobnego widoku zarządzania aliasami.
- **Testy:**
  - `src/lib/wikiLinks.test.ts` — split z `|`, aliasy w resolve/indeksie/backlinkach, `cleanAliases` (wraz z dotychczasowymi).
  - `src/lib/yjsStore.test.ts` — aliasy przez zapis, patch i synchronizację, brak pola przy pustej liście.
  - `e2e/note-aliases.spec.ts` — alias z menu, link po aliasie, `[[cel|tekst]]`, klik otwiera cel.
  - Istniejące e2e linków (`note-links`, `wikilinks`, `wiki-heading`) przechodzą.

## Sieć wiedzy — etykiety zagnieżdżone (Faza 3.2, 2026-10-23)

- **Co robi:** etykieta `budowa/łazienka` to etykieta „łazienka” wewnątrz „budowa”. Pasek boczny pokazuje drzewo z wcięciem; klik w rodzica filtruje też jego dzieci; zmiana nazwy rodzica przepina całe poddrzewo (w notatkach i w zbiorze etykiet). Etykieta użyta w notatce zawsze jest w pasku bocznym, nawet gdy nie została dodana osobno (np. z importu).
- **Gdzie jest:**
  - `src/lib/labelTree.ts` — `cleanLabelPath` (przycina segmenty, usuwa puste, limit `LABEL_MAX_DEPTH` = 6), `isUnderLabel`, `noteMatchesLabel` (filtr po rodzicu), `renameLabelBranch`, `buildLabelRows` (spłaszczone drzewo: głębokość, nazwa, czy ma dzieci).
  - `src/lib/yjsStore.ts` — `renameLabelEverywhere` przepina poddrzewo; `projectLabels` = zbiór etykiet + etykiety używane w notatkach.
  - `src/hooks/useNotes.ts` — `addLabel` i `renameLabel` czyszczą ścieżkę; `src/hooks/useFilteredNotes.ts` — filtr po rodzicu.
  - `src/components/AppSidebar.tsx` (lista z `buildLabelRows`), `src/components/sidebar/SidebarLabelItem.tsx` (prop `displayName`, `depth` → wcięcie 12 px na poziom).
- **Ograniczenia:** brak składni `#budowa/łazienka` w treści (model etykiet to wybór z menu, nie parsowanie tekstu). Zwijania gałęzi w pasku bocznym jeszcze nie ma — drzewo jest zawsze rozwinięte.
- **Testy:** `src/lib/labelTree.test.ts` (9); `src/lib/yjsStore.test.ts` (przepinanie gałęzi); `e2e/label-tree.spec.ts` (wcięcie dziecka, filtr po rodzicu).
- **Commit:** w historii poniżej.

## Sieć wiedzy — osadzanie notatek `![[…]]` (Faza 3.3, 2026-10-23)

- **Co robi:** linia zawierająca tylko `![[Tytuł]]` albo `![[Tytuł#Nagłówek]]` pokazuje treść notatki (albo tylko sekcję od nagłówka do następnego nagłówka tego samego lub wyższego poziomu) w ramce, tylko do odczytu. Zagnieżdżenie idzie dalej, ale najwyżej 3 poziomy. Cykl (A osadza B, B osadza A) kończy się komunikatem. Notatka prywatna, brakujący tytuł lub nagłówek też dają komunikat zamiast treści.
- **Gdzie jest:**
  - `src/lib/embeds.ts` — `extractSection`, `splitEmbedTarget`, `isBlockEmbed` (nagłówek zaczynający się od `^` = blok, patrz 3.4), `MAX_EMBED_DEPTH` = 3, typ `EmbedContext` (poziom + łańcuch odwiedzonych notatek).
  - `src/components/WikiEmbed.tsx` — rozwiązuje cel (`lookupWikiTarget`), sprawdza cykl, głębokość, prywatność; renderuje treść przez `MarkdownRenderer` z `embed` o poziom wyżej.
  - `src/components/MarkdownRendererImpl.tsx` — `MarkdownRendererImpl` wycina linie będące wyłącznie osadzeniem (`EMBED_LINE_RX`) i renderuje je jako `WikiEmbed`; reszta idzie przez `MarkdownBlocks` (dawny renderer bez zmian).
  - `src/components/MarkdownRenderer.tsx` — prop `embed` (wewnętrzny).
- **Dlaczego bloki, a nie znaczniki w tekście:** próbowałem zastąpić `![[…]]` znacznikami Unicode przed parsowaniem, ale Markdown (`![` to początek obrazu) rozbijał tekst tak, że osadzenie znikało. Blok (cała linia) omija parser.
- **Ograniczenia:**
  - Osadzenie w środku zdania (`Zobacz ![[X]] tutaj`) zostaje surowym tekstem; obsługa wymagałaby parsera inline.
  - Edytor CodeMirror nie pokazuje podglądu osadzenia (plan wymienia widżet w CM — do zrobienia osobno).
  - Notatka, która osadza samą siebie, pokazuje się raz więcej niż należy: łańcuch zaczyna się od pustego, bo renderer nie zna id notatki-właściciela.
- **Testy:**
  - `src/lib/embeds.test.ts` (6): sekcje, poziomy, dopasowanie, cele, limit.
  - `e2e/note-embeds.spec.ts` (2): sekcja z nagłówkiem zamiast całej notatki; cykl A ↔ B kończy się komunikatem.
  - Istniejące `MarkdownRenderer*` i e2e linków wiki przechodzą.
- **Commit:** w historii (Sieć wiedzy 3.3, `1852153`).

## Sieć wiedzy — bloki `^id` i `![[…#^id]]` (Faza 3.4, 2026-10-24)

- **Co robi:** na końcu linii (po spacji) można oznaczyć blok znacznikiem `^id`, np. `Pomysł na szafkę ^szafka`. Znacznik nie jest widoczny w czytniku. `![[Notatka#^szafka]]` osadza tylko ten blok, a `[[Notatka#^szafka]]` otwiera notatkę i przewija do akapitu. Podczas pisania `[[Notatka#^` lista podpowiada id bloków tej notatki. Blok bez id nie ma adresu, więc nie da się do niego linkować.
- **Gdzie jest:**
  - `src/lib/blockRefs.ts` — `blockIdOfLine`, `stripBlockId`, `blockIdOfHeading`, `findBlock` (tekst bloku bez znacznika), `listBlockIds` (kolejność, bez duplikatów), `blockRefQuery` (rozbija `Tytuł#^pre`).
  - `src/components/MarkdownRendererImpl.tsx` — `splitParagraphId` chowa znacznik na końcu akapitu i ustawia `data-block-id`.
  - `src/components/MarkdownRenderer.tsx` — `needsMarkdown` zwraca `true` dla linii z `^id`, żeby taka notatka przeszła przez renderer, który go chowa (zwykły tekst by go pokazał).
  - `src/components/WikiEmbed.tsx` — osadzenie `^id` bierze `findBlock`; brak bloku → komunikat „Nie ma bloku ^id”.
  - `src/lib/wikiHeading.ts` — `findBlockElement` i `scrollToHeading` przewijają do `[data-block-id]`, gdy cel zaczyna się od `^`.
  - `src/hooks/useWikiAutocomplete.tsx` — po `#^` podpowiedzi to id bloków z `lookupWikiTarget`, wstawiane jako `[[Tytuł#^id]]`.
- **Jak działa:** blok to grupa linii między pustymi liniami. Punkt listy i nagłówek zaczynają nowy blok, a nagłówek jest zawsze jednolinijkowy, więc `![[…#^id]]` przy liście nie wciąga całej listy. Znacznik jest częścią tekstu w Yjs (nie osobną mapą), więc działa na każdym urządzeniu i w eksporcie bez zmian w modelu danych. Dopasowanie id bez względu na wielkość liter.
- **Dlaczego znacznik w tekście, a nie osobna mapa:** osobna mapa rozjechałaby się przy edycji tekstu (przesunięte akapity). Tekst jest źródłem prawdy, a id wyciągamy z niego przy każdym renderze.
- **Ograniczenia i pułapki:**
  - Brak generatora id: id wpisuje się ręcznie (`^szafka`). Nie ma przycisku „Kopiuj link do bloku”.
  - Linki zwrotne na poziomie bloku (plan 3.4) **nie są zrobione**: panel „Linki zwrotne” pokazuje tylko linki do całej notatki.
  - `^id` w środku linii nie jest znacznikiem (`2^3` zostaje tekstem); id musi być na końcu linii.
  - W edytorze CodeMirror znacznik widać surowo (podgląd bloku w CM to osobna praca, jak przy osadzeniach).
  - Dwa bloki z tym samym id: wygrywa pierwszy w kolejności tekstu.
  - Przewijanie do bloku działa tylko w czytniku (`NoteReader`, ta sama ścieżka co nagłówki `[[…#nagłówek]]`).
- **Testy:**
  - `src/lib/blockRefs.test.ts` (10): znacznik, polskie litery, granice bloków (akapit, lista, nagłówek), brak id, podpowiedzi.
  - `src/lib/embeds.test.ts`: nagłówek `^` to osadzenie bloku.
  - `src/components/MarkdownRenderer.plain.test.tsx`: `needsMarkdown` dla `^id` i dla `2^3`.
  - `e2e/note-block-refs.spec.ts` (2): osadzenie samego akapitu bez znacznika; brak bloku pokazuje komunikat.
- **Commit:** w historii (Sieć wiedzy 3.4).


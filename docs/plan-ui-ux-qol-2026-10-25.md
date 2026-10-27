# Plan: ulepszenie i upiększenie UI/UX oraz QoL (2026-10-25)

## Kontekst

Poprzednie plany UI (`roadmap.md`: „Plan dopracowania UI” 09.10, „Plan dopracowania UI: telefon i komputer” 15.10, plan mobile 11.10) są w większości zrobione. Ten plan nie powtarza ich punktów. Zbiera to, co w kodzie widać dziś: rozjechany system projektowy, nowe techniki przeglądarek, których aplikacja jeszcze nie używa, i drobne tarcia w codziennej pracy.

**Pomiar w kodzie (2026-10-25, `src/**/*.tsx`):**

| Obszar | Stan |
|---|---|
| Promienie | Tokeny `rounded-control/field/card` są (`index.css:340`), ale użyte 64 razy. Surowych `rounded-lg/xl/md/sm/3xl/[3px]` jest ok. 400. |
| Cienie | 8 wariantów (`shadow`, `-sm`, `-md`, `-lg`, `-2xl`, `-elevation`, `-glow`, `-none`) bez skali. |
| Warstwy | `z-10/20/25/30/40/50/70` wpisywane ręcznie, bez nazwanej skali. |
| Kolory | Tokeny w HSL (`--primary: 34 88% 47%`), 7 motywów (`skins.css`), `color-mix` w 11 plikach. |
| Toasty | 144 wywołania `toast.*`, tylko 4 z przyciskiem akcji (np. „Cofnij”). |
| Potwierdzenia | `window.confirm` w `StatsDialog.tsx:63` (reset odznak), poza wspólnym `ConfirmActionDialog`. |
| Ładowanie | Spinner (`Loader2`/`animate-spin`) w 6 plikach, szkielet w 3, bez wspólnej reguły. |
| Nowoczesny CSS | View Transitions tylko przy zmianie motywu i widoku (`useTheme.ts`, `viewChange.ts`). `@container` w 1 miejscu (Grafik). Brak `@starting-style`, animacji sterowanych przewijaniem, `field-sizing`, `text-wrap`, `interpolate-size`. |
| React | React 19.3, ale bez `useTransition`, `<Activity>` i React Compiler. |

**Ograniczenia:**
- **Paczka startowa:** próg 401 KB, zapas mały. Każdy punkt ma albo zmniejszać JS (CSS zamiast JS), albo trafiać do leniwych chunków. Pilnuje `e2e/bundle.spec.ts`.
- **7 motywów:** każda zmiana wyglądu musi działać we wszystkich (`data-skin`). Decyzje D1–D5 z planu 15.10 obowiązują.
- **Progresywne ulepszanie:** nowe API tylko za `@supports` lub sprawdzeniem funkcji. Bez nich aplikacja ma wyglądać jak dziś, nie gorzej.
- **Ruch:** wszystko nowe respektuje `prefers-reduced-motion` (`isMotionReduced()`, `useMotionPref`).
- **Zgodność danych:** bez zmian formatu Yjs. Nowe ustawienia UI w localStorage w `try/catch`.
- **Kolejność w każdym punkcie:** test → kod → `opis.md` → commit. Przed zmianą wyglądu: skill `frontend-design`.

Legenda: W = wartość dla użytkownika (1–3), N = nakład (S/M/L).

---

## Faza 0: bezpieczniki przed zmianami wyglądu (najpierw)

Faza 1 zmienia setki klas. Bez zrzutów referencyjnych nie da się sprawdzić, że nic się nie rozjechało.

| # | Co | Gdzie | N |
|---|----|-------|---|
| 0.1 | Zrzuty referencyjne Playwright (`toHaveScreenshot`): 5 głównych widoków × 7 motywów × (komputer, telefon). Animacje wyłączone, stała data (`page.clock`), maska na zmienne treści (cytat dnia, zegar). Tag `@visual`, poza codziennym `test:e2e`. **Zrobione (`d1fdab3`):** 70 zrzutów, `npm run test:visual`; progi różnic 1%. | nowy `e2e/visual.spec.ts` | M |
| 0.2 | axe we wszystkich motywach, nie tylko w domyślnym. Dziś znany wyjątek: „kalendarz — hydraulika”. **Zrobione (`d1fdab3`):** style na wszystkich widokach; wyjątek w `KNOWN` (kontrast „dziś”, do korekty w Fazie 1). | `e2e/a11y*.spec.ts` | S |
| 0.3 | Test strażnik w Vitest: liczy surowe `rounded-(lg\|xl\|md\|sm\|3xl)`, `z-[0-9]` i `shadow-(md\|lg\|2xl)` w `src/**/*.tsx`. Próg = stan po Fazie 1, test pada, gdy liczba rośnie. **Zrobione (`d1fdab3`):** próg ustawiony na stan dzisiejszy (404 / 24 / 46), a nie „po Fazie 1”, bo inaczej test byłby czerwony przez całą Fazę 1; każdy codemod obniża próg. Tani zamiennik reguły ESLint (wtyczki Tailwind słabo wspierają v4). | nowy `src/test/designTokens.test.ts` | S |
| 0.4 | Pomiar INP i CLS w trybie dev: `PerformanceObserver` (`event`, `layout-shift`) wypisuje w konsoli najgorsze interakcje. Bez nowej zależności, poza paczką produkcyjną. **Zrobione (`d1fdab3`).** | `src/lib/perfProbe.ts`, `main.tsx` za `import.meta.env.DEV` | S |

## Faza 1: system projektowy (fundament „ładnego” wyglądu)

Spójność daje więcej niż nowe ozdoby. Każdy punkt to głównie codemod plus przegląd zrzutów z 0.1.

| # | Co | W | N |
|---|----|---|---|
| 1.1 | **Promienie.** Codemod: `rounded-md` → `rounded-control`, `rounded-lg` → `rounded-field`, `rounded-xl`/`-3xl` → `rounded-card`. `rounded-full` zostaje (pigułki, awatary). Wyjątki opisać komentarzem. Motywy (np. Matryca, Plan) zmieniają wtedy charakter jednym tokenem. | 2 | M |
| 1.2 | **Cienie: 3 poziomy.** `--elevation-1` (kafel), `-2` (popover, menu), `-3` (okno, arkusz), definiowane per motyw. W ciemnych motywach głębię daje jaśniejsza powierzchnia (`color-mix` z `--foreground`), nie cień, bo cień na czarnym tle ginie. | 2 | M |
| 1.3 | **Skala warstw.** Tokeny `--z-sticky`, `--z-dropdown`, `--z-overlay`, `--z-modal`, `--z-toast` w `@theme` i klasy `z-sticky` itd. Usuwa `z-25` i `z-70`, wpisane, żeby „przebić” coś innego. | 1 | S |
| 1.4 | **Typografia.** `text-wrap: balance` w nagłówkach i tytułach kafli (koniec z jednym słowem w drugiej linii). `text-wrap: pretty` w akapitach czytnika. `font-variant-numeric: tabular-nums` w liczbach w kolumnach: godziny Grafiku, sumy, liczniki, zegary. 7 rozmiarów `text-[…]` zamienić na skalę albo opisać. | 2 | S |
| 1.5 | **Kolory w OKLCH (decyzja D-1).** Tokeny z HSL na OKLCH. Jednakowa jasność odczuwana w motywach, więc łatwiej utrzymać kontrast AA. Stany `hover`/`active` z względnej składni (`oklch(from var(--primary) calc(l - 0.05) c h)`) zamiast osobnych tokenów. Najpierw jeden motyw (Zeszyt), potem reszta. Fallback HSL za `@supports`. | 2 | L |
| 1.6 | **Ikony.** Jedna grubość kreski lucide jako token (`--icon-stroke`, np. 1.75), a w motywach technicznych (Matryca, Plan) cieńsza. Rozmiary ikon tylko 14/16/20/24. | 1 | S |
| 1.7 | **Pierścień fokusu.** Jeden token `--ring-focus` i jedna klasa narzędziowa dla `:focus-visible`. Sprawdzić we wszystkich motywach, że ma kontrast 3:1 do tła (WCAG 2.4.11/2.4.13). | 2 | S |

## Faza 2: ruch i nowoczesny CSS (więcej efektu, mniej JS)

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Wspólny element kafel → edytor.** `view-transition-name` na kaflu, tytule i okładce, ten sam na otwartym edytorze. Kafel „rozrasta się” w notatkę. `useOriginFromTile` już liczy punkt startu, więc ta technika go zastępuje tam, gdzie API jest. Bez API zostaje dzisiejsza animacja. | 3 | M |
| 2.2 | **Przejścia między działami.** Nawigacja Notatki ↔ Grafik ↔ Praca ↔ Kalendarz przez `startViewTransition` (`viewChange.ts` już to robi dla widoków). Kierunek przesunięcia zgodny z kolejnością w `BottomNav`. W react-router 6.x opcja `unstable_viewTransition` na `Link`/`navigate`; sprawdzić w dokumentacji przed użyciem. | 2 | S |
| 2.3 | **Wejście bez JS.** `@starting-style` + `transition-behavior: allow-discrete` dla popoverów, menu, toastów i pojawiających się wierszy listy. Tam, gdzie framer-motion robi tylko fade/scale na wejściu, zastąpić go CSS. Zysk: mniej pracy na głównym wątku, mniejsze chunki. | 2 | M |
| 2.4 | **Zwijanie do `height: auto`.** `interpolate-size: allow-keywords` na `:root`. Bloki zwijane, sekcje Ustawień i grupy notatek animują wysokość bez mierzenia w JS. W przeglądarkach bez wsparcia skaczą od razu, jak dziś. | 1 | S |
| 2.5 | **Animacje sterowane przewijaniem.** Pasek postępu czytania w `NoteReader` (`animation-timeline: scroll()`) i cień nagłówka po zjechaniu ze szczytu (`view()`/`scroll()`). `useHideOnScroll` zostaje, bo zależy od kierunku przewijania, czego CSS nie umie. | 2 | S |
| 2.6 | **Pola rosnące z treścią.** `field-sizing: content` dla tytułu, szybkiego dodawania i pól wpisu w Pracy; JS autosize tylko jako fallback. | 1 | S |
| 2.7 | **Mikrointerakcje (jeden zestaw).** Wciśnięcie przycisku (`scale(.97)` na `:active`), rysowanie ptaszka w checkboxie (`stroke-dashoffset`), krótki „pulse” licznika po zmianie (`RollingNumber` już jest), drgnięcie pola przy błędzie. Jeden plik `motion.css` z czasami i krzywymi jako tokeny (`--ease-out-quint`, `--dur-1..3`). | 2 | M |
| 2.8 | **Haptyka.** Helper `lib/haptics.ts` (`tap`/`success`/`warn`/`selection`, wyłączalny w efektach) już jest. Przejrzeć, gdzie go brakuje: zakończenie zmiany w Grafiku, odhaczenie w Terminach, zapis wpisu w Pracy. Działa tylko na Androidzie. | 1 | S |

Odrzucone: CSS Anchor Positioning i Popover API. Radix już pozycjonuje i obsługuje fokus, a przepisanie nie da nic widocznego.

## Faza 3: UX i QoL (codzienne tarcia)

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **„Cofnij” zamiast „Na pewno?”.** Przegląd 144 toastów. Każda akcja odwracalna (usunięcie, archiwizacja, przeniesienie, zmiana priorytetu, odhaczenie serii) dostaje w toaście `action: Cofnij`, opartą na istniejącym cofaniu zbiorczym. Okno potwierdzenia zostaje tylko dla rzeczy nieodwracalnych (reset, kosz na stałe). | 3 | M |
| 3.2 | `window.confirm` w `StatsDialog.tsx:63` → `ConfirmActionDialog` (spójny wygląd, działa w PWA na iOS, gdzie `confirm` bywa blokowany). | 1 | S |
| 3.3 | **Reguła ładowania.** Pokazać wskaźnik dopiero po 300 ms (bez mignięcia). Szkielet tam, gdzie znany jest kształt treści (listy, karty), spinner tylko w przycisku, który coś wysyła. Wspólny `useDelayedFlag(300)`. | 2 | S |
| 3.4 | **Płynność przy ciężkich zmianach.** `useTransition` przy przełączaniu widoku (siatka/tablica/tabela), filtrach i sortowaniu. Pole wyszukiwania reaguje od razu, lista nadrabia. Cel: INP < 200 ms przy 300 notatkach (pomiar z 0.4). | 2 | S |
| 3.5 | **Powrót bez przeładowania.** `<Activity mode="hidden">` (React 19.2+) dla ostatnio otwartego działu: powrót z Grafiku do Notatek zachowuje przewinięcie, rozwinięte grupy i stan filtrów bez ponownego renderu. Ograniczyć do 1–2 działów (pamięć na telefonie). | 3 | M |
| 3.6 | **Pamięć stanu widoku.** Przewinięcie per dział, ostatnia zakładka w Pracy i Ustawieniach, zwinięte sekcje. Jeden helper `useViewMemory(key)` na localStorage (`try/catch`, działa bez niego). | 2 | S |
| 3.7 | **Formularze na telefonie.** Przegląd wszystkich `<input>`: `inputmode` (liczby, godziny), `enterkeyhint` („Dalej”/„Zapisz”), `autocomplete="off"` tam, gdzie podpowiedzi przeglądarki przeszkadzają, `autocapitalize` w tytułach. Test jednostkowy przechodzi po polach formularzy. | 2 | S |
| 3.8 | **Skróty widoczne w podpowiedziach.** `HoverTip` pokazuje skrót (`<kbd>`) przy akcjach, które go mają. Źródło prawdy: ta sama tabela, z której korzysta `ShortcutsDialog`. | 1 | S |
| 3.9 | **Paleta poleceń zależna od kontekstu.** W otwartej notatce na górze palety akcje tej notatki (przypnij, przenieś, eksport, historia). W Grafiku: „Dodaj zmianę dziś”, „Skończyłem teraz”. | 2 | M |
| 3.10 | **Arkusze na telefonie.** Wszystkie arkusze na jednym `ViewSheet` z punktami zatrzymania (pół/pełny) i zamykaniem gestem w dół. Gest przesunięcia kafla czeka na decyzję 4.1 z planu mobile i tu się go nie ruszy. | 2 | M |
| 3.11 | **Cele dotyku 44 px** (otwarte z 23.10). Test e2e mierzy `getBoundingClientRect` interaktywnych elementów na `pixel-7` i zgłasza mniejsze niż 44×44 (albo 24×24 z odstępem, WCAG 2.5.8). | 2 | S |
| 3.12 | **Preferencje systemu.** Wariant `prefers-contrast: more` w każdym motywie (grubsze obramowania, mocniejszy tekst pomocniczy), `prefers-reduced-transparency` wyłącza rozmycia (`backdrop-blur`), sprawdzenie `forced-colors`. | 2 | M |

## Faza 4: wydajność odczuwalna

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Wczesne ładowanie chunków.** `import()` leniwego działu na `pointerenter`/`focus` przycisku w `BottomNav`/`AppSidebar` i w `requestIdleCallback` po starcie. Klik w dział nie pokazuje szkieletu. Nie zwiększa paczki startowej. | 2 | S |
| 4.2 | **Fonty bez skoku układu.** 12 rodzin `@fontsource`: sprawdzić, że ładuje się tylko aktywny krój. Dla fallbacku `size-adjust`/`ascent-override`, żeby podmiana fontu nie przesuwała tekstu (CLS). | 1 | S |
| 4.3 | **React Compiler (decyzja D-2).** Automatyczna memoizacja usuwa ręczne `useMemo`/`memo` i zbędne rendery (`NoteCard`, `NoteGrid`). Wymaga `babel-plugin-react-compiler`, więc zmiany `@vitejs/plugin-react-swc` na `@vitejs/plugin-react` z Babelem (wolniejszy build). Najpierw próba na gałęzi i pomiar z 0.4. | 2 | M |
| 4.4 | Wirtualizacja list tylko, jeśli pomiar 0.4 przy 300+ notatkach pokaże problem. Dziś `content-visibility` jest w 4 miejscach i może wystarczyć. | 1 | M |

## Faza 5: upiększenie (charakter, nie tylko porządek)

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Tożsamość działów.** Każdy dział ma swój odcień akcentu (np. Notatki bursztyn, Grafik niebieski, Praca miedź, Kalendarz zieleń) na ikonie w nawigacji, pasku nagłówka i w pustych stanach. Odcień pochodny z `--accent` motywu (`oklch(from …)` po 1.5), więc pasuje do każdego motywu. | 3 | M |
| 5.2 | **Ziarno papieru w Zeszycie** (decyzja otwarta od 25.10). Szum SVG `feTurbulence` jako `background-image` w data URI (< 1 KB), przezroczystość 3–4%, wyłączany w `prefers-reduced-transparency`. | 2 | S |
| 5.3 | **Wykresy w barwach motywu.** Recharts (Statystyki, raporty Pracy) bierze kolory z tokenów, nie z wpisanych wartości. Podpowiedzi i osie z `tabular-nums`. | 2 | S |
| 5.4 | **Puste stany i ilustracje.** Jedna grubość kreski i paleta z tokenów w `EmptyIllustration`. Każdy pusty stan ma jedno główne działanie (przycisk), nie tylko opis. | 2 | S |
| 5.5 | **Szczegóły kafla.** Delikatne podświetlenie krawędzi przy najechaniu (`box-shadow` z `color-mix` akcentu) zamiast podnoszenia o kilka pikseli, które na siatce masonry wygląda nerwowo. Na dotyku tylko stan `:active`. | 1 | S |

## Faza 6: QA i zamknięcie

- Zrzuty z 0.1 zaktualizowane i przejrzane motyw po motywie.
- axe bez błędów we wszystkich motywach (0.2), kontrast fokusu (1.7).
- INP < 200 ms i CLS < 0.1 na `pixel-7` przy 300 notatkach (0.4).
- Pełne `test:e2e` i `test:e2e:mobile`, próg paczki.
- Ręczne QA na telefonie: zaległe z poprzednich planów i nowe gesty z 3.10.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| D-1 | Przejść z HSL na OKLCH (1.5)? | Tak, ale po Fazie 0 i jednym motywie na próbę. Bez tego 5.1 jest trudniejsze. |
| D-2 | React Compiler kosztem zmiany wtyczki Vite (4.3)? | Próba na gałęzi. Wdrożyć, jeśli INP lub liczba renderów wyraźnie spadnie. |
| D-3 | Ile framer-motion zastąpić CSS-em (2.3)? | Tylko animacje wejścia i wyjścia. Gesty i układ (`layout`) zostają w framer-motion. |
| D-4 | Odcienie działów (5.1): stałe czy z motywu? | Z motywu, żeby Matryca i Neon nie dostały obcych kolorów. |

## Kolejność wdrażania

1. Faza 0 (bez niej reszta jest ryzykowna).
2. Szybkie wygrane o dużej wartości: 3.1, 3.2, 1.3, 1.4, 2.6, 3.3, 3.7.
3. Fundament: 1.1, 1.2, 1.7, 1.6, potem 1.5 (po D-1).
4. Ruch: 2.7, 2.3, 2.1, 2.2, 2.4, 2.5, 2.8.
5. UX: 3.4, 3.5, 3.6, 3.8–3.12, 4.1, 4.2.
6. Upiększenie: 5.1–5.5.
7. Eksperyment 4.3, ewentualnie 4.4.
8. Faza 6.

## Status D-1 do D-4 — 2026-10-26

- **D-1 (OKLCH):** nie zrobione. Tokeny są w kanałach HSL używanych w `hsl(var(--…))` (konfiguracja Tailwinda, ok. 77 miejsc w CSS, 51 w TSX). Zmiana wymaga przejścia po wszystkich motywach; plan zaleca najpierw jeden motyw.
- **D-2 (React Compiler):** nie zrobione. Wymaga nowej wtyczki Babel i pomiaru INP/renderów na gałęzi.
- **D-3 (animacje wejścia i wyjścia w CSS):** zrobione częściowo: cytat dnia (`DailyQuote.tsx`) i podpowiedzi skrótów w `EmptyState.tsx` używają klasy `fade-quiet` z `index.css` (samo przezroczystość, bez JS, wyłączone przy ograniczonym ruchu). Pozostałe ok. 50 plików z `framer-motion` do przeglądu; paczka nie zmieniła się w praktyce, bo `framer-motion` nadal jest w innych miejscach.
- **D-4 (odcienie działów z motywu):** nie zrobione. Zależy od tokenu `--accent` po 1.5 (OKLCH); dobór odcieni wymaga decyzji właściciela.

## D-1 — zrobione (2026-10-27)

- **Zastosowano:** `--apply` obu skryptów (296 definicji, 41 nazw, odchylenie 0,000; 21 plików, 80 przezroczystości przez `color-mix`, 140 zwykłych). Opis formatu i pułapek: `opis.md`, „Format kolorów (D-1)”.
- **Dodatkowe poprawki poza skryptami:** `celebrate.ts` i `glowTrail.ts` czytają już pełny kolor (bez `hsl()`), 8 odwołań z `calc()` i fallbackami zamienionych ręcznie, testy kontrastu i `shiftChipOutline` parsują OKLCH przez `src/test/oklch.ts`.
- **Weryfikacja:** typecheck i build OK; unit 300 plików / 2354 testy OK; wizualne 70/70 (drugi przebieg; w pierwszym jedna różnica w Kalendarzu i błąd `ERR_ABORTED`, oba niedeterministyczne, przechodzą przy powtórce); e2e 676 OK, 2 błędy przechodzą w izolacji (przeciążenie).
- **Odstępstwo od planu:** brak osobnego fallbacku HSL za `@supports` (zob. `opis.md`).

## D-1 — stan przed przerwą (2026-10-26, historyczne)

- **Zrobione:** odświeżone zrzuty bazowe testów wizualnych (commit `57537d6`), 70/70. Wcześniej 48 z 70 nie zgadzało się z kodem, także na ekranach niezmienianych.
- **Sprawdzone na sucho:** konwersja tokenów (`docs/tools/d1-oklch/oklch-convert.cjs`): 296 definicji, 41 nazw, odchylenie w przeliczeniu w obie strony 0,000. Konsumenci (`docs/tools/d1-oklch/oklch-consumers.cjs`, tryb sucho): 21 plików, 80 odwołań z przezroczystością, 140 zwykłych.
- **Decyzja techniczna:** przezroczystość przez `color-mix(in srgb, …)`, nie `in oklab`, żeby mieszanie wypadało tak samo jak dziś (zmiana wizualna ma być zerowa na etapie konwersji). Przestrzeń `oklab` i ponowne dostrojenie jasności to osobny krok, po przeglądzie wizualnym.
- **Jeszcze nie zrobione:** uruchomienie `--apply` obu skryptów, przebudowa, test wizualny (oczekiwane: brak różnic), pełny e2e, commit. Stan drzewa jest czysty; skrypty nie zmieniają kodu bez `--apply`.

## D-4 — zrobione (2026-10-27)

- **Decyzja:** odcienie działów z palety motywu, nie wpisane na sztywno. Notatki → `--primary`, Grafik → `--accent`, Praca → `--warning` (najbliżej miedzi), Kalendarz → `--success`. Odstępstwo od planu: plan mówił o pochodnej `--accent`, ale wtedy wszystkie działy wyszłyby z jednego odcienia.
- **Zrobione (5.1, część):** ikony działów w pasku bocznym i dolnym pasku (`src/lib/sections.ts`, `--sec-*` w `src/index.css`).
- **Kontrast:** ikony to grafika, więc 3:1 (1.4.11). Na jasnym tle kolor przyciemniony o 50% czerni; na ciemnym czysty kolor motywu. Test: `src/lib/skinContrast.test.ts`, wszystkie motywy.
- **Pozostałe z 5.1:** pasek nagłówka i puste stany nie są zrobione.
- **Testy wizualne:** nie wykrywają tej zmiany (próg 1% pikseli, cztery małe ikony), więc zrzuty bazowe nie zostały zaktualizowane. Zmianę sprawdzono w przeglądarce.

## D-2 — React Compiler: odrzucone (2026-10-27)

Eksperyment zostaje w gałęzi `wip/d2-react-compiler` (`55d3c6e`); do `wip/matryca-hydraulika` nie wszedł. Narzędzia pomiaru: `docs/tools/d2-react-compiler/`.

- **Tryb „wszystkie komponenty”:** INP mediana 688 ms wobec 1480 ms w bazie (CPU 4×, pierwszy pomiar A/B). Wdrożenie wymagało podniesienia progu precache do 3,8 MiB (build 3758,94 KiB) i psuło 7 testów e2e (przegląd tygodnia, powiadomienia, przekaźnik). Dyrektywy `"use no memo"` na trzech komponentach nie pomogły; przyczyny nie znaleziono.
- **Tryb `annotation` (tylko `NoteGrid` i `NoteCard`):** wszystkie 11 testów przechodzi, paczka +1 KB, precache 3475,55 KiB (w starym progu 3,4 MiB). Pomiary A/B były zaszumione (CPU 100% od przeglądarki i VS Code): INP mediana 2520 wobec 2696 ms w pierwszym przebiegu i 2896 wobec 2824 ms w drugim; blokowanie wątku ok. −11%. Nie spełnia kryterium planu (wyraźny spadek INP).
- **Decyzja:** odrzucone. Konfiguracja `@vitejs/plugin-react-swc` wraca bez zmian. Nie podnosimy progu precache.
- **Otwarte, gdyby kiedyś wracać:** przyczyna regresji w trybie „wszystkie” (nie zlokalizowana); audyt ok. 149 odczytów `Date.now()` w 48 plikach; pomiar A/B na czystym systemie.

## Stan planu zamknięty (2026-10-27)

Plan kończymy tutaj; pozostałe punkty to backlog z podanym zakresem, do zrobienia osobno, gdy będzie czas na przegląd wizualny.

- **Zrobione:** Faza 0 (0.1–0.4), D-1 (OKLCH), D-3 (tylko cytat i podpowiedzi), D-4 i 5.1 (ikony nawigacji, linia nagłówka, pusty stan), 1.3 (skala `z-*`: `raised`, `sticky`, `dropdown`, `overlay`, `modal`, `toast`).
- **Odrzucone:** D-2 (React Compiler); wyniki w sekcji D-2 wyżej.
- **Backlog, nie zrobione:**
  - 1.1 promienie: 404 surowych `rounded-md/lg/xl/3xl/sm` do zamiany na tokeny (`rounded-control/field/card`). Codemod z przeglądem zrzutów.
  - 1.2 cienie: 24 surowe `shadow-md/lg/2xl` do zamiany na `--elevation-*`.
  - 1.4 typografia: `text-wrap: balance` na nagłówkach, `pretty` na akapitach. Zmienia zawijanie tekstu, więc wymaga przeglądu zrzutów.
  - 1.6 ikony i 1.7 pierścień fokusu: tokeny `--icon-stroke` i `--ring-focus` jeszcze nie istnieją; kontrast 2.4.11 do sprawdzenia we wszystkich motywach.
  - D-3 reszta: 44 pliki z `framer-motion`. Zamieniać tylko wejście i wyjście, gesty i `layout` zostają.
  - Zrzuty D-4: nie zaktualizowane. Test kalendarza bez paska bocznego w jednym przebiegu był chybieniem (nie regresją); baseline w repo bez zmian.
  - Faza 2–5 i 6 (ruch, UX, wydajność, upiększenie, QA telefonu): nie zaczęte.

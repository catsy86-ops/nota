# Plan: upiększenie motywów i dostosowanie wyglądu (2026-10-30)

> **Status (2026-10-30):** Fala 0 zrobiona (0.1 Miedź, 0.2 tabliczka — margines i Fraunces okazały się już per styl, 0.3 poświata, 0.4 Odblask, 0.5 `public/prepaint.js`, 0.6 pomiar: precache 4 087 501 B, zapas ok. 1,9 KB — T-10 podjęta: próg 4,0 MiB). Źródła: audyt stanu (agent frontend-expert) i propozycje (agent general-purpose), oba tylko czytały kod. Plan uzupełnia `docs/plan-ui-motywy-2026-10-27.md` (Fazy 0–4 zrobione, Faza 5 QA otwarta) i nie powtarza zrobionych punktów.

## Skąd ten plan

Dziś jest 10 stylów (Zeszyt, Plan, Neon, Zorza, Miedź, Matryca, Hydraulika, Odblask, Kafle, Tablica), każdy w schemacie jasnym i ciemnym, oraz kilkanaście ustawień wyglądu w localStorage (akcent, kształt, ramki, wygląd ramek, poświata, tło, styl na noc, pora roku, krój, rozmiar tekstu, tryb budowa, ruch, efekty, układ). Audyt znalazł cztery główne problemy:

1. **Styl zmienia głównie kolory.** Tło, nagłówki, logo i kafel notatki mają tożsamość stylu. Dialogi, arkusze, dolny pasek, przycisk „+”, zakładki, toasty, Grafik i karta budowy wyglądają w każdym stylu tak samo. Ozdoby Zeszytu przeciekają do innych stylów: Fraunces w tytule arkusza „Nowa”, czerwony margines, tabliczka `.paper-stamp` ze starą literą „G”.
2. **Ekran Wygląd jest przeładowany i bez podglądu.** Około 27 sekcji i 14 przełączników efektów. „Jasność” jest na 7. miejscu. Okno Ustawień zasłania aplikację, więc nie widać skutku zmiany. Miniatury w galerii pokazują zawsze schemat domyślny.
3. **Drugie schematy są ubogie.** Plan jasny, Matryca jasna bez deszczu, Neon i Zorza jasne mają po 2–3 reguły.
4. **Budżet jest na granicy.** Precache wg audytu 3,895 z 3,9 MiB (zapas ok. 5 KB; drugi agent podał ok. 59 KiB — do zmierzenia na początku Fali 0). CSS to jeden plik ok. 48 KB gzip, blokujący start.

## Zasady

- **Jedna marka:** „notki” pisane długopisem w gradiencie bursztyn → koral → róż (ekran startowy, samouczek). Gradient jako tokeny `--brand-from/via/to`.
- **Kreska długopisem jako wspólny język** pustych stanów i ilustracji: technika CSS z `src/components/guide/GuideArt.tsx` (`.guide-draw`), bez framer-motion.
- **Animować tylko `transform` i `opacity`.** Bez ciągłego `box-shadow`, `conic-gradient` i rozmyć na telefonie.
- **Każdy nowy CSS liczony w precache.** SVG i cięższe moduły ładowane leniwie.
- **Kontrast WCAG 2.2 AA** sprawdzany testem, także dla gradientów i kombinacji (tryb budowa, wygląd ramek).

## Fala 0 — naprawy (S)

| # | Co | Pliki | Wartość |
|---|----|-------|---------|
| 0.1 | **Miedź: przycisk główny.** Gradient wpisany na sztywno w `button.bg-primary` daje w ciemnej Miedzi kontrast ok. 3,8:1 i pomija akcent. Gradient z tokenów `--primary`, test kontrastu dla gradientu. | `src/styles/skins/miedz.css` | W |
| 0.2 | **Ozdoby Zeszytu tylko w Zeszycie:** Fraunces w tytule arkusza, czerwony margines, `.paper-stamp` (z „G” na „notki” albo per styl). | `index.css`, `BottomNav.tsx:217`, `sidebar-gradient` | W |
| 0.3 | **Poświata zaznaczonej notatki w kolorze `--primary` stylu**, nie pory roku; tło pory roku tylko w Zeszycie (zgodnie z opisem w Ustawieniach). | `index.css:98`, `signatures.css:176` | Ś |
| 0.4 | **Odblask naprawdę bez ruchu:** wyłączyć `note-frame-spin`, `note-glow-breathe`, `today-breath`, `now-pulse`. Pasek nieprzezroczysty, fokus 3 px w czerni. | `odblask.css` | W |
| 0.5 | **Skrypt przed pierwszym malowaniem** w `index.html`: `data-skin` i schemat z localStorage, `theme-color` i tło ekranu startowego w barwach stylu. Bez mignięcia Zeszytu. | `index.html`, `useTheme.ts` | Ś |
| 0.6 | **Pomiar budżetu** (precache, CSS gzip) jako punkt odniesienia dla kolejnych fal. | `e2e/bundle.spec.ts` | — |

## Fala 1 — ekran Wygląd i szybkie zmiany (S–M)

| # | Co | Wartość / koszt |
|---|----|-----------------|
| 1.1 | **„Szybko” i „Zaawansowane”.** Szybko: galeria stylów, jasność, akcent, tryb budowa, rozmiar tekstu, zestawy. Zaawansowane (zwinięte): kształt, ramki, poświata, tło, pora roku, krój, efekty. „Kod wyglądu” przenieść do „Kopia i dane”. Ikony lucide zamiast emoji. | W / S |
| 1.2 | **Podgląd na żywo:** przyklejona makieta u góry Wyglądu (kafel notatki, przycisk, wycinek dolnego paska z „+”), dziedziczy tokeny z `<html>`. Galeria pokazuje wybrany schemat. | W / S |
| 1.3 | **Zestawy jednym stuknięciem:** „Budowa” (Odblask, tryb budowa, gładkie tło, wyraźne ramki, tekst 120%), „Noc” (ciemny, ciche tło, bez poświaty), 3 własne sloty (przez `encodeAppearance`). Szybki dostęp: przytrzymanie przełącznika jasności w nagłówku. | W / S–M |
| 1.4 | **„Przywróć domyślny wygląd”** (z potwierdzeniem i „Cofnij”). | Ś / S |
| 1.5 | **Kod wyglądu pełny i wygodny:** wszystkie klucze (ruch, tryb budowa, pora roku, efekty, gęstość), udostępnianie przez `navigator.share`, link `#wyglad=NOTKI1-…` z pytaniem o import, zastosowanie bez przeładowania. | Ś / S |
| 1.6 | **Logo w nagłówku jako „notki” długopisem** (ścieżki ze sceny `welcome`, rysowane raz na sesję) i przycisk „+” w gradiencie marki. | W / S |

## Fala 2 — tożsamość stylu w komponentach (M)

| # | Co | Wartość / koszt |
|---|----|-----------------|
| 2.1 | **Wspólny komponent szkicu** `src/components/art/Sketch.tsx` (technika `.guide-draw`), tokeny kreski per styl: `--sketch-w`, `--sketch-dash`, `--sketch-glow`, wymuszone w `skinContract.test.ts`. Nowe puste stany: Grafik bez zmian, Długi, Ćwiczenia, Skrzynka, brak wyników, offline. `EmptySketch` przejść na tę technikę. | W / M |
| 2.2 | **Dolny pasek i „+” per styl:** tokeny `--nav-indicator` (zakreślacz, wymiar, rurka, kropla, marker) i `--fab-shape` (np. kwadrat w Odblasku i Kaflach). | W / M |
| 2.3 | **Dialogi, arkusze, toasty, zakładki:** tokeny nagłówka i krawędzi per styl (`--font-display` w każdym stylu, dziś 126 użyć `.font-display` zostaje w Jakarta). | W / M |
| 2.4 | **Nagłówki działów:** podkreślenie piórem w odcieniu działu (`--sec-*`), dorysowywane raz przy wejściu, we wszystkich widokach. | Ś / S |
| 2.5 | **Drugie schematy:** dopracować Plan jasny, Matrycę jasną (deszcz w jasnym, `PaperBackdrop.tsx:43`), Neon i Zorzę jasne. | Ś / M |
| 2.6 | **Wzory papieru per styl (bez zdjęć):** Zeszyt — kratka, linie, kropki, milimetrówka; Plan — kalka, milimetrówka; Kafle — 10×10, 20×20, cegiełka; Tablica — biała, zielona, korek. Tylko CSS. | Ś / S |
| 2.7 | **Wydajność:** Zorza bez `filter: blur(36px)` i `backdrop-filter` na telefonie (gotowy gradient radialny); `note-frame-spin` i `note-glow-breathe` na `transform`/`opacity`; `MatrixRain` reaguje na zmianę ustawienia ruchu. | N / S, zysk baterii |

## Fala 3 — osobiste i style (S–M)

| # | Co | Wartość / koszt |
|---|----|-----------------|
| 3.1 | **Hydraulika jako styl flagowy:** ikony działów na pasku jako kształtki (kolano, trójnik, zawór; sprite SVG ok. 2 KB, z podpisami), „+” jako pokrętło zaworu obracające się przy przytrzymaniu, postęp Dziś jako poziom wody w rurze. | W / M |
| 3.2 | **Harmonogram według słońca:** wybór miasta z listy (bez geolokalizacji), wschód i zachód liczone lokalnie, tryb `sun` w `skinSchedule.ts`. Opcjonalnie tryb budowa włączany, gdy w Grafiku trwa zmiana „Budowa”. | W / M |
| 3.3 | **Czarny OLED** w ciemnych schematach (`data-oled`). | Ś / S |
| 3.4 | **Kolory działów: subtelne / wyraźne** (nagłówek i znacznik paska z `--sec-*`) zamiast stylu per dział. | Ś / S |
| 3.5 | **Porządek w galerii:** Miedź przeprofilowana na „Beton i patynę” (bez rury dublującej Hydraulikę), Matryca w „Więcej stylów”, Tablica domyślnie ciemna (kreda — koniec podobieństwa do Kafli), Kafle i Tablica z własnym odsłonięciem zamiast domyślnego koła. | Ś / S |
| 3.6 | **Sygnatury stylów:** Neon — „+” i znacznik paska jako rurka, pusty stan jako szyld zapalany raz; Kafle — pusty stan „brakująca płytka”; Tablica — znacznik paska markerem; Plan — puste stany jak rysunek techniczny; Zeszyt — taśma klejąca na przypiętej notatce. | Ś / S |

## Fala 4 — duże (L)

| # | Co | Wartość / koszt |
|---|----|-----------------|
| 4.1 | **Kreator własnego motywu, ograniczony:** styl bazowy i 2–3 suwaki odcienia OKLCH (papier, akcent, kafel); jasność ustala generator, kontrast sprawdzany na bieżąco tą samą funkcją co `skinContrast.test.ts`. Bez HEX. Wymaga decyzji (plan 27.10 go odrzucił). | Ś / L |
| 4.2 | **Gęstość całego interfejsu** (`--density` dla list, nagłówków, paska), nie tylko siatki notatek. | Ś / M |
| 4.3 | **Przejścia między widokami:** przesunięcie zgodne z kolejnością na pasku, potem kafel notatki płynnie przechodzący w edytor (`view-transition-name`). | Ś / M |
| 4.4 | **QA:** pomiar klatek 10 stylów, ręczne QA na telefonie (słońce, rękawice, noc), zrzuty `visual.spec.ts` także dla drugich schematów, Ustawień, arkusza „+” i karty budowy; a11y dla kombinacji z trybem budowa i wyglądem ramek. | W / M |

## Testy i narzędzia

- Każda fala: `npx vitest run`, `e2e/a11y.spec.ts`, `e2e/bundle.spec.ts`, `e2e/visual.spec.ts` (odświeżenie zrzutów świadomie), `skinContrast.test.ts`, `skinContract.test.ts`.
- Przed kodem wyglądu: skill `frontend-design`; przy przeglądzie `refactoring-ui` i `ux-heuristics`; `performance-engineer` przy wzroście CSS lub precache.

## Decyzje dla właściciela (z rekomendacją)

| # | Pytanie | Rekomendacja |
|---|---------|--------------|
| T-1 | Miedź: przeprofilować na „Beton i patynę” czy wycofać? | Przeprofilować. |
| T-2 | Matryca: przenieść do „Więcej stylów”? | Tak. |
| T-3 | Tablica domyślnie ciemna (kreda)? | Tak. |
| T-4 | Kreator własnego motywu (powrót odrzuconego punktu)? | Tylko suwaki odcienia, bez HEX, w Fali 4. |
| T-5 | Słońce: skąd miasto? | Wybór ręczny z listy, bez geolokalizacji. |
| T-6 | Tryb budowa włączany przez zmianę w Grafiku? | Tak, jako opcja domyślnie wyłączona. |
| T-7 | Styl per dział? | Nie; zamiast tego „wyraźne kolory działów” (3.4). |
| T-8 | Własne zdjęcie jako tapeta, kod QR? | Nie teraz (kontrast, budżet precache). |
| T-9 | Logo w nagłówku: „notki” długopisem zamiast „NOTKI”? | Tak, jedna marka wszędzie. |
| T-10 | Budżet precache: podnieść próg czy ładować style leniwie? | **Podjęta 2026-10-30: próg 3,9 → 4,0 MiB.** |

Kolejność: Fala 0 → 1 → 2 → 3 → 4. Fale 0 i 1 nie wymagają decyzji; 3.5 czeka na T-1–T-3, 3.2 na T-5–T-6, 4.1 na T-4, 1.6 na T-9.

# Plan: warstwa graficzna i wizualna (2026-11-15)

> **Status:** 2026-11-19 — W0.2 (`scripts/ui-metrics.mjs`, `docs/ui-metryki.json`) i W0.3 (`src/lib/skinContrastReport.test.ts`, `docs/kontrast-tokenow.md`; porażki: Zeszyt jasny `primary` < 3:1) zrobione; W0.1 (zrzuty) nie. W1.1–W1.4 zrobione (`--faint`, cienie z `--shadow-tint`, jedna skala cieni, opis warstw); bez `--surface-raised` i zrzutów `@visual`. W2.1 zrobione (`docs/typografia.md`), WZ-1 = 15 px na telefonie (potwierdzone 2026-11-19), W2.2 zrobione (nagłówki `SectionCard`, `num-lg` w Pracy; Grafik i Długi przez `ui/stat`); W2.7 zrobione (`sizeWeightPair`, próg 168); W2.3 zrobione (`ui-label`, `section-caps` — 65 miejsc, „Odbiór nadgodzin” 500); W2.6 częściowo (`formatMoney` w panelach budowy); W2.4 zrobione (balance w rolach `title-*`, `.prose-note`: 68ch i dzielenie wyrazów dla p/li/blockquote); W2.5 zrobione (przegląd 91 `leading-*`, wszystkie to wyjątki; strażnik `manualLeading`); dalej reszta W2.6 (`materialUsage.ts`), W3.1 zrobione (`Card` z `variant`/`tone`, `cardVariant()`); W3.4 zrobione (`ui/list-row.tsx`); W4.1 częściowo (`size-N` zamiast `h-N w-N`, strażnik `squarePair`; zostaje przegląd `size-3` i `size-6`); W4.2 zrobione (`--icon-stroke` 1,75 / 1,5 / 2, `.lucide[stroke-width="2"]`); W4.3 zrobione (`.lucide` bez ściskania, `Button` na `--icon-stroke`); W4.4 zrobione (`docs/komponenty.md`, nieaktywny `text-faint`, stany `Card interactive`); W6.1 zrobione (bursztyn Zeszytu L 0,665 i 4 akcenty ręcznie — generator akcentów zepsuty); W6.3 zrobione (priorytety i płótno planów na tokenach, strażnik `dark:` próg 8; `.dark` i tak idzie za stylem); W6.6 zrobione (`accent-color`, `::selection`; reszta już była); W1.5 zrobione (`--space-page|card|stack|row`, `SectionCard`, `ListRow`, `<main>`); W1.6 zrobione (`--chart-1|2|grid|axis`, `--positive|negative`; dwie barwy serii, bo więcej nie ma użycia); W1.7 zrobione (210 kolorów CSS w OKLCH, strażnik, bloki tokenów na `html`); W1.8 zrobione (`lib/paint/colors.ts`, strażnik `hexColors.test.ts` z `KNOWN` 24 plików, próbki akcentów Zeszytu po W6.1); W3.2: Długi, Praca, Ustawienia, Grafik, Dziś i Kalendarz zrobione (strażnik ręcznych kart, próg 72; dalej Notatki i pojedyncze komponenty); W3.5, W3.6, W5.6 zrobione (rozmycie tylko na paskach przyklejonych i tle arkusza, wyłączone w trybie OLED; jedyny dekoracyjny gradient usunięty; obrazy z `decoding="async"` i tłem zastępczym; strażnicy `backdropBlur` 9, `classGradient` 1); dalej W3.2 kolejne działy, W4.5, W5, a W3.2 działami po podziałach z planów działów. Wykonawca: Sonnet (W1, W3–W5, W7–W9), Opus (W2, W6). Przed każdym etapem skill `frontend-design`, przy przeglądzie `refactoring-ui` i `ux-heuristics`.
>
> **Czego tu nie ma, bo jest gdzie indziej:** ruch i animacje — `plan-ruch-2026-11-15.md`; nawigacja mobilna i migracja surowych kontrolek — Etapy 4–5 w `plan-ui-spojnosc-2026-11-06.md` (ten plan je porządkuje i daje im miarę, nie powtarza); dostępność klawiatury i tryb „duże cele” — Q5 w `plan-qol-platforma-2026-11-15.md`. Rozmiaru `Button` na dotyku nie zmieniać (cofnięte 15.11, decyzja właściciela).

## 1. Stan (policzone w `src/`, bez testów, 2026-11-15)

**Fundament jest:** tokeny OKLCH, 10 stylów × 2 schematy × akcent (ADR-5), `--shape` i `--r-control/field/card`, `--elevation-1/2/3/up`, `PageHead`, `SectionCard`, `StatusPanel`, strażnik `designTokens.test.ts`. `text-[Npx]` — 0, paleta Tailwinda — 10 trafień w 2 plikach, `z-[` — 1.

**Gdzie warstwa wizualna jest słaba:**

| Obszar | Liczby | Co to znaczy |
|---|---|---|
| Hierarchia tekstu | `text-xs` 709, `text-sm` 730, `text-base` 97, `text-lg` 45, `text-xl` 10, `text-2xl+` 23; `title-section` 5 użyć | Prawie cały interfejs to dwa sąsiednie rozmiary. Ekran nie ma punktu ciężkości — różnicę robi tylko grubość. |
| Grubość | `font-medium` 320, `font-semibold` 263, `font-bold` 41 | Trzy grubości bez przypisanych ról. |
| Interlinia i światło | `leading-` 93, `tracking-` 20, `text-balance/pretty` 0 | Interlinia ustawiana ręcznie; tytuły łamią się przypadkowo. |
| Trzeci poziom tekstu | `opacity-NN` 131 w 59 plikach, `text-muted-foreground/NN` 9 | Wyciszanie przez przezroczystość — kontrast zależy od tła i nie jest sprawdzany. |
| Karty | `rounded-card border` 181 w 108 plikach vs `<SectionCard` 10, `<Card` 7 | Karta składana ręcznie w 108 plikach; każda zmiana wyglądu karty to 181 miejsc. |
| Cienie | `shadow-elevation` 39, `shadow-sm..2xl` 23, `shadow-[` 7; `--elevation-*` w `hsl`, reszta w OKLCH | Dwa systemy głębi; cień nie barwi się stylem. |
| Kolor poza tokenami | hex w ts/tsx 283 w 28 plikach; w CSS `hsl(` 196, `#hex` 102; `dark:` 32 w 14 plikach | Wykresy, kolory notatek i kategorie żyją obok motywu; `dark:` omija schemat stylu. |
| Ikony | `h-3.5` 107, `h-4` 339, `h-5` 32, `h-3` 13, `h-6` 13, `size-N` 110; `strokeWidth` 55 w 23 plikach | Pięć rozmiarów w dwóch zapisach, grubość kreski ustawiana lokalnie. |
| Wymiary | `w/h-[N]` 132 w 63 plikach | Układ na liczbach, nie na siatce. |
| Stany | `hover:` 517, `focus-visible:` 403, `disabled:` 89, `active:` 35 | Stan wciśnięcia rzadki (to M5.1), wyłączony niespójny. |
| Kontrolki | surowe `<button` 487 w 169 plikach vs `<Button` 510; surowe pola 258 w 108 | Połowa przycisków nie dziedziczy wariantów. |
| CSS | `index.css` 1631 linii, `!important` 34, `@layer` 11, `@container` w CSS 0 (w klasach 14), `forced-colors` 2, `prefers-contrast` 1, `@media print` 1 | Jeden duży plik; druk i tryby kontrastu prawie nietknięte. |
| Dane | recharts 3 pliki, `<svg` 21 w 19, `<img` 10 | Wykresy i rysunki bez wspólnej palety i wzorca. |

## 2. Zasady

1. **Hierarchia przed dekoracją.** Każdy ekran ma jeden element najważniejszy (rozmiar), jeden poziom wtórny (grubość) i tło (kolor wyciszony). Jeśli po zmrużeniu oczu nie widać, co jest główne — ekran jest do poprawy.
2. **Rola, nie rozmiar.** W kodzie widoków używa się klas ról (`title-page`, `title-section`, `text-body`, `ui-meta`, `ui-hint`), nie `text-sm font-medium`.
3. **Jedno źródło dla powierzchni.** Karta, wiersz, arkusz i pasek to komponenty z wariantami; widok nie pisze `rounded-card border bg-card`.
4. **Kolor tylko z tokenu.** Także w wykresach, SVG i kolorach notatek. Wyjątki wypisane w strażniku z powodem.
5. **Głębia ma trzy poziomy:** płasko (obramowanie), uniesione (karta przeciągana, menu), nad wszystkim (arkusz, dialog). Obramowanie albo cień — nie oba naraz, chyba że styl tak definiuje.
6. **Styl zmienia tokeny, nie komponenty.** Żaden komponent nie pyta o `data-skin`; różnice idą przez zmienne i `signatures.css`.
7. **Bez zmiany zachowania i bez podnoszenia budżetów** z `e2e/bundle.spec.ts`. Każdy etap kończy się zrzutami `@visual` (tylko przez `playwright.visual.config.ts`).

## Etap W0: baza porównawcza (S)

| Nr | Punkt |
|---|---|
| W0.1 | **Arkusz przeglądu:** 12 ekranów (Dziś, lista notatek, edytor, Kalendarz, Grafik, Praca–Dziennik, wycena, Długi, Ćwiczenia, Skarbiec, Ustawienia–Wygląd, pusty stan) × 3 style (zeszyt, jeden ciemny, jeden „żywy”) × 390 px i 1280 px. Zrzuty do `docs/wyglad-przeglad/`, przy każdym trzy zdania: co jest główne, co przeszkadza, co niespójne. |
| W0.2 | **Skrypt metryk** z §1 jako `scripts/ui-metrics.mjs` (Node, bez PowerShella) z zapisem do `docs/ui-metryki.json`. Każdy etap podaje liczby przed i po. |
| W0.3 | **Test kontrastu tokenów:** Vitest liczy kontrast par (tekst/tło, wyciszony/tło, akcent/tło, tekst na akcencie, obramowanie pola/tło) dla 10 stylów × 2 schematów z plików CSS. Progi WCAG 2.2 AA: 4,5 tekst, 3,0 elementy interfejsu. Wynik jako tabela; porażki to lista zadań W6. Sprawdzić, czy część nie istnieje już w testach motywów. |

## Etap W1: tokeny, których brakuje (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W1.1 | **Trzeci poziom tekstu jako token** `--faint` (obok `--muted-foreground`), dobrany na kontrast ≥ 4,5 w każdym stylu; klasa `text-faint`. Zamienić 9 × `text-muted-foreground/NN` i te z 131 `opacity-NN`, które wyciszają tekst (reszta — ikony wyłączone, nakładki — zostaje). | M |
| W1.2 | **Elewacje w OKLCH z barwą stylu:** `--elevation-*` liczone z `color-mix(in oklch, var(--shadow-tint) …, transparent)`; `--shadow-tint` na styl (ciepły w zeszycie, chłodny w ciemnych). W ciemnych schematach głębię daje jaśniejsza powierzchnia (`--surface-raised`), cień tylko pomocniczo. | M |
| W1.3 | **Jedna skala cieni:** 23 × `shadow-sm..2xl` i 7 × `shadow-[` → `shadow-elevation-1/2/3`. Strażnik zabrania nowych. | S |
| W1.4 | **Skala warstw:** `--z-base/sticky/nav/overlay/sheet/toast` w `tailwind.config.ts` (`z-nav` itd.); zamienić `z-10…50`. Kolejność opisać w komentarzu — dziś wynika z przypadku. | S |
| W1.5 | **Odstępy semantyczne** (aliasy, nie nowa skala): `--space-page` (margines ekranu), `--space-card` (wnętrze karty), `--space-stack` (odstęp między sekcjami), `--space-row` (wiersz listy), zależne od `kaczy.uiDensity.v1`. Dziś gęstość zmienia część komponentów; po zmianie — wszystkie, które używają aliasów. | M |
| W1.6 | **Paleta danych:** `--chart-1…8` (rozróżnialne przy zaburzeniach widzenia barw, sprawdzone symulacją), `--chart-grid`, `--chart-axis`, `--positive`, `--negative`; osobno `--note-<kolor>` dla kolorów notatek w obu schematach. | M |
| W1.7 | **`hsl(` → OKLCH w CSS** (196 miejsc), `#hex` (102) → tokeny albo `oklch()`. Mechaniczne; po każdym pliku zrzuty. Wartości przeliczać narzędziem, nie na oko. | M |
| W1.8 | **Hex w ts/tsx** (283 w 28 plikach): podzielić na (a) wykresy → W1.6, (b) kolory notatek/etykiet → `--note-*`, (c) rysunek na canvasie i PDF — zostają, ale w jednym module `lib/paint/colors.ts` czytającym tokeny przez `getComputedStyle` z zapasem, (d) dane użytkownika (własny motyw) — zostają. Lista `KNOWN` w strażniku maleje do (c) i (d). | L |

## Etap W2: typografia (Opus — decyzje; Sonnet — zamiana)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W2.1 | **Skala ról** w `index.css` (`@layer components`) i `docs/typografia.md`: `title-page` (22/28, 700), `title-section` (17/24, 650), `title-card` (15/20, 600), `text-body` (15/22 w treści notatki, 14/20 w interfejsie), `ui-meta` (12/16, 500), `ui-hint` (12/16, 400, `--faint`), `num-lg` (liczba główna karty: 28/32, mono, `tabular-nums`). Rozmiary w `rem`, skalowane przez `kaczy.textSize.v1`. Liczby do potwierdzenia na zrzutach W0. | M |
| W2.2 | **Większy rozstaw skali:** dziś 12 i 14 px niosą 85% tekstu. Tytuł sekcji i liczba główna muszą odstawać o co najmniej dwa stopnie. Przegląd 12 ekranów z W0: na każdym wskazać element główny i dać mu `title-*` albo `num-lg`. | M |
| W2.3 | **Role grubości:** 400 treść, 500 etykiety i przyciski, 600–700 tytuły. `font-bold` (41) i `font-semibold` (263) w treści wierszy zamienić na 500 + kolor; pogrubienie nie może być jedynym nośnikiem hierarchii w wierszu z trzema pogrubionymi polami. | M |
| W2.4 | **Łamanie:** `text-wrap: balance` w `title-*`, `text-wrap: pretty` w akapitach treści i opisach pustych stanów; `hyphens: auto` z `lang="pl"` w treści notatki na wąskim ekranie (sprawdzić jakość dzielenia w Chrome i Safari); `max-width: 68ch` dla czytanej treści. | S |
| W2.5 | **Interlinia z roli:** 93 × `leading-*` przejrzeć — zostają tylko wyjątki (jednowierszowe pigułki, liczby). | S |
| W2.6 | **Liczby:** wszystkie kwoty, godziny, liczniki — `tabular-nums` (jest 303; dopisać brakujące w tabelach Grafiku i wycen), jednostka mniejsza i wyciszona (`12,5 <small>kWh</small>`), separator tysięcy z `Intl.NumberFormat("pl-PL")` w jednym pomocniku. | S |
| W2.7 | **Straż:** test źródeł zabrania pary `text-(xs|sm) font-(medium|semibold)` w nowych plikach widoków, gdy istnieje rola; lista wyjątków malejąca. | S |

## Etap W3: powierzchnie i karty (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W3.1 | **Warianty `Card`:** `plain` (obramowanie), `raised` (elewacja 1), `inset` (tło wyciszone, bez obramowania — dla grup w karcie), `interactive` (stany hover/press/focus), `status` (lewa krawędź w kolorze stanu). Dopełnienie z `--space-card`. Jedna definicja promienia i obramowania. | M |
| W3.2 | **Migracja 181 ręcznych kart** działami (Praca, Długi, Ćwiczenia, Grafik, Kalendarz, Ustawienia, Notatki); po dziale zrzuty i brak różnic poza zamierzonymi. Strażnik: nowe `rounded-card border` poza `components/ui/` zabronione. Robić po podziałach z planów działów (R2, L1.1, C1.2), żeby nie kolidować. | L |
| W3.3 | **Zagnieżdżenie:** karta w karcie tylko jako `inset`; nigdy dwa obramowania w odległości < 12 px. Przegląd Ustawień i Pracy, gdzie zagnieżdżeń jest najwięcej. | S |
| W3.4 | **Wiersz listy** jako komponent (`ListRow`: ikona, tytuł, opis, wartość po prawej, akcja): dziś każda lista składa wiersz sama. Separator przez odstęp albo jedną linię `--border` — nie oba. | M |
| W3.5 | **Rozmycie tła** (13 miejsc): zostaje tylko na pasku dolnym, nagłówku przyklejonym i tle arkusza; wyłączone w trybie „Oszczędny” i przy `prefers-reduced-transparency`. | S |
| W3.6 | **Gradienty** (21 w 12 plikach): przegląd — zostają te, które niosą znaczenie (postęp, zanikanie krawędzi przewijania); dekoracyjne tylko przez `signatures.css` stylu. | S |

## Etap W4: ikony, stany, kontrolki (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W4.1 | **Trzy rozmiary ikon:** 14 (w tekście meta), 16 (domyślna), 20 (nawigacja, akcja główna), przez `size-3.5/4/5`; `h-N w-N` zamienić mechanicznie na `size-N`. `h-3` i `h-6` — każde miejsce uzasadnić albo sprowadzić do skali. | M |
| W4.2 | **Grubość kreski z tokenu** `--icon-stroke` (domyślnie 1,75; styl może zmienić — np. 1,5 w „zeszycie”, 2 w „hydraulice”), ustawiona raz w CSS dla `svg.lucide`; usunąć 55 lokalnych `strokeWidth` poza rysunkami. | S |
| W4.3 | **Ikona i tekst:** wyrównanie do linii bazowej tekstu (`gap` z roli, ikona `shrink-0`), ikona nigdy ciemniejsza od tekstu, który opisuje. | S |
| W4.4 | **Komplet stanów w wariantach** (`Button`, `ListRow`, `Card interactive`, pigułka, zakładka): spoczynek, hover (tylko `@media (hover: hover)`), fokus, wciśnięty (M5.1), wybrany, wyłączony (jeden wzór: `--faint` + brak cienia, nie `opacity-50`), ładowanie. Tabela stanów w `docs/komponenty.md`. | M |
| W4.5 | **Etap 5 planu spójności** (surowe `<button>` 487, pola 258) wykonać po W4.4, działami, z miarą: po każdym dziale liczba surowych kontrolek w tym dziale = lista jawnych wyjątków (canvas, komórki siatki Grafiku, elementy Radix `asChild`). | L |
| W4.6 | **Pola formularzy:** jedna wysokość na gęstość, etykieta nad polem (`ui-meta`), podpowiedź pod (`ui-hint`), błąd w miejscu podpowiedzi z ikoną — nie tylko kolorem. Jednostka w polu jako przyrostek, nie w etykiecie. | M |

## Etap W5: dane, wykresy, stany puste (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W5.1 | **Wspólna oprawa wykresu** (`ChartFrame`): tytuł, wartość główna (`num-lg`), zakres, legenda jako podpisy przy seriach zamiast osobnej ramki, siatka `--chart-grid` tylko pozioma, osie bez linii, etykiety `ui-hint`. Trzy pliki recharts przechodzą na oprawę i `--chart-*`. | M |
| W5.2 | **Nie tylko kolor:** serie rozróżnione też kształtem znacznika albo wzorem linii; słupki dodatnie/ujemne mają znak przy wartości. Tabela danych jako alternatywa dla czytnika (`<details>` pod wykresem). | S |
| W5.3 | **Małe wykresy w kartach** (iskra salda, pasek tygodnia, pierścień postępu) jako trzy komponenty SVG bez recharts — żeby karty „Dziś” niosły liczby graficznie bez kosztu paczki. | M |
| W5.4 | **Stany puste:** `StatusPanel` (42 użycia w 11 plikach) w każdym dziale; jeden rysunek liniowy na dział w kresce stylu (`currentColor`, `--icon-stroke`), jedno zdanie i jedna akcja główna. Spis list bez pustego stanu z W0. | M |
| W5.5 | **Szkielety** zgodne z układem docelowym — wspólnie z M5.3 planu ruchu; tu tylko kształty (te same promienie i odstępy co karta). | S |
| W5.6 | **Obrazy** (`<img` 10): `aspect-ratio`, `loading="lazy"`, `decoding="async"`, tło zastępcze w kolorze `--muted`, zaokrąglenie z `--r-card`; miniatury w liście w jednej proporcji (4:3) z `object-fit: cover`. | S |

## Etap W6: style i schematy (Opus + `frontend-design`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W6.1 | **Naprawa porażek kontrastu** z W0.3 w tokenach stylów — nie w komponentach. | M |
| W6.2 | **Karta tożsamości stylu:** dla każdego z 10 stylów tabela — tło, powierzchnia, akcent, kreska ikon, promień, cień, sygnatura (`signatures.css`), krój. Dwa style, które różnią się tylko barwą, to kandydaci do połączenia (decyzja WZ-2). | M |
| W6.3 | **`dark:` → tokeny** (32 w 14 plikach): schemat wynika ze stylu, więc `dark:` bywa błędne przy stylu ciemnym w jasnym systemie. Strażnik zabrania `dark:` poza `components/ui/`. | S |
| W6.4 | **`!important`** (34): każde zastąpić kolejnością `@layer` (reset, tokens, base, components, skins, utilities, overrides) albo opisać, dlaczego zostaje (tryb wysokiego kontrastu, ograniczony ruch). | M |
| W6.5 | **Podział `index.css`** (1631 linii) na `tokens.css`, `base.css`, `components.css`, `utilities.css`, `print.css` w ustalonych warstwach. Bez zmiany reguł; dowód — identyczne zrzuty. Kolejność importów ma znaczenie dla `prepaint.js` — sprawdzić brak mignięcia przy starcie. | M |
| W6.6 | **`color-scheme`** ustawione zgodnie ze schematem stylu na `:root` (paski przewijania, kontrolki natywne, `<input type="date">`), `accent-color: var(--primary)`, `::selection` z tokenu, kolor paska adresu (`theme-color`) aktualizowany przy zmianie stylu. Sprawdzić, co z tego już jest. | S |
| W6.7 | **Wysoki kontrast:** `@media (prefers-contrast: more)` — obramowania pełnym `--foreground`, bez tekstu `--faint`; `@media (forced-colors: active)` — fokus i stany wybrania przez `Highlight`/`CanvasText`, ikony `currentColor`, obramowanie zamiast tła dla stanu wybranego. Przegląd w emulacji Chrome. | M |

## Etap W7: układ i dopasowanie (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W7.1 | **Wymiary arbitralne** (132 w 63 plikach): podzielić na stałe elementów (zostają jako tokeny `--size-*`: szerokość panelu, wysokość paska) i przypadkowe (na skalę Tailwinda albo `min-content`/`clamp()`). | M |
| W7.2 | **Zapytania kontenerowe** dla kart, które żyją w kolumnie i w siatce (karta notatki, karta budowy, karta „Dziś”, wiersz Długów): układ zależy od szerokości karty, nie okna. Dziś 14 użyć w 7 plikach. | M |
| W7.3 | **Rytm pionowy ekranu:** `PageHead` → `--space-stack` → sekcje; margines boczny `--space-page` (16 px telefon, 24 tablet, treść wyśrodkowana z maks. szerokością na desktopie). Przegląd 12 ekranów — żadnych własnych `px-3`/`px-5` na poziomie strony. | M |
| W7.4 | **Szeroki ekran:** od 1280 px lista + podgląd obok siebie tam, gdzie dziś jest pusta przestrzeń (Długi, Praca–Dziennik, Ćwiczenia); sprawdzić, co już daje boczny panel z Sieci wiedzy. Tylko jeśli W0 pokaże puste ekrany. | M |
| W7.5 | **Bezpieczne obszary i klawiatura** — tylko przegląd wyglądu (wycięcia, pasek gestów) na zrzutach; mechanika w Q3.2. | S |

## Etap W8: druk i eksport (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| W8.1 | **`print.css`:** notatka, wycena, raport dnia, protokół odbioru, grafik miesiąca — bez powłoki, czarny tekst na białym niezależnie od stylu, `break-inside: avoid` dla wierszy i kart, nagłówek tabeli powtarzany, adresy linków w nawiasie, marginesy `@page` 15 mm, numer strony. | M |
| W8.2 | **Zgodność PDF i ekranu:** dokumenty generowane (wycena, protokół) używają tej samej skali typograficznej co druk; jeden moduł stałych. | S |
| W8.3 | **Obraz do udostępnienia** (karta notatki, podsumowanie tygodnia jako PNG) — tylko jeśli właściciel chce (WZ-4). | S |

## Etap W9: straż i odbiór

| Nr | Punkt |
|---|---|
| W9.1 | Rozszerzyć `designTokens.test.ts` o reguły z W1.3, W2.7, W3.2, W4.1, W6.3; każda z listą `KNOWN`, która może tylko maleć (test porównuje długość z zapisanym progiem). |
| W9.2 | Macierz `@visual`: 12 ekranów × 3 style × 2 szerokości jako stałe zrzuty; pełna macierz 10 stylów tylko dla 3 ekranów. |
| W9.3 | `e2e/a11y.spec.ts` po W1.1, W4.4, W6; ręczne QA na telefonie (właściciel): czytelność w słońcu, jednoręczność, ciemny schemat nocą. |
| W9.4 | `docs/wyglad.md`: zasady z §2, tabele ról, wariantów i stanów — jedna strona, z której korzysta wykonawca każdego nowego widoku. |

## Decyzje właściciela

- **WZ-1:** rozstrzygnięte 2026-11-19 — 15 px na telefonie, 14 px na komputerze.
- **WZ-2:** czy łączyć style, które po W6.2 różnią się tylko barwą.
- **WZ-3:** grubość kreski ikon — jedna dla wszystkich stylów (1,75) czy zależna od stylu.
- **WZ-4:** eksport karty jako obraz (W8.3).
- **WZ-5:** układ dwukolumnowy na szerokim ekranie (W7.4).

## Kolejność

W0 → W1.1–W1.4 → W2.1–W2.4 → W3.1, W3.4 → W4.1–W4.4 → W6.1, W6.3, W6.6 → W1.5–W1.8 → W3.2 i W4.5 działami (po podziałach z planów działów) → W5 → W6.2, W6.4, W6.5, W6.7 → W7 → W8 → W9.

Największa zmiana odczuwalna przy najmniejszym koszcie: **W2.1–W2.2** (hierarchia), **W1.1** (wyciszenie z kontrastem), **W1.2** (głębia), **W4.2** (ikony), **W5.4** (puste stany).

## Weryfikacja

Liczby z `scripts/ui-metrics.mjs` przed i po; zrzuty `@visual`; `npm run typecheck`; Vitest strażników; `e2e/a11y.spec.ts`; `e2e/bundle.spec.ts` bez zmiany progów; wpis w `opis.md` (dział „Wygląd”) po każdym punkcie zmieniającym to, co widzi użytkownik.

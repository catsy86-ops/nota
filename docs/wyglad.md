# Wygląd — zasady dla nowego widoku

Jedna strona dla każdego, kto dodaje albo zmienia ekran w Notatniku. Szczegóły są w: `docs/typografia.md` (role tekstu), `docs/komponenty.md` (stany kontrolek), `docs/karty-stylow.md` (10 stylów × 2 schematy). Reguły pilnuje `src/test/designTokens.test.ts`. Progi strażników mogą tylko maleć.

## Siedem zasad

1. **Hierarchia przed dekoracją.** Ekran ma jeden element najważniejszy (rozmiar), jeden poziom wtórny (grubość) i tło (kolor wyciszony). Jeśli po zmrużeniu oczu nie widać, co jest główne, ekran jest do poprawy.
2. **Rola, nie rozmiar.** Tekst dostaje klasę roli (`title-section`, `ui-hint`, `ui-meta`, `num-lg`), nie parę `text-sm font-medium`.
3. **Jedno źródło dla powierzchni.** Karta to `<Card variant>` albo `cardVariant()`. Widok nie pisze `rounded-card border bg-card`.
4. **Kolor tylko z tokenu.** Dotyczy też wykresów, SVG i kolorów notatek. Wyjątki są wypisane w strażniku razem z powodem.
5. **Głębia ma trzy poziomy:** płasko (obramowanie), uniesione (menu, przeciągana karta) i nad wszystkim (arkusz, dialog). Element ma obramowanie albo cień, nie oba naraz.
6. **Styl zmienia tokeny, nie komponenty.** Komponent nie pyta o `data-skin`. Różnice idą przez zmienne CSS i `skins/signatures.css`.
7. **Bez zmiany zachowania i bez podnoszenia budżetów** z `e2e/bundle.spec.ts`.

## Układ strony

| Element | Jak | Uwagi |
|---|---|---|
| Margines boczny | `px-page` na `<main>` (16 px na telefonie, 24 px od 640 px) | Widok nie dokłada własnego `px-*`. |
| Tytuł → sekcje | `gap-stack` na `<main>` (32/40 px) | Wyjątek: Dziś na telefonie `gap-4`. |
| Wcięcie karty | `p-card` (16/20 px) | |
| Odstęp wiersza | `py-row` | `ListRow` ma go w sobie. |
| Szerokość treści | `--page-read` 42rem (tekst), `--page-form` 48rem (formularz), `--page-wide` 80rem (siatka) | `max-w-(--page-form)` |
| Wysokość okna | `max-h-sheet` 92dvh (arkusz, okno na telefonie), `max-h-dialog` 85dvh (okno wyśrodkowane), `max-h-media` 80dvh (obraz) | Nie wpisuj `max-h-[NNdvh]`. |
| Wymiar | skala Tailwinda (`w-34`, `min-h-20`) | Ręcznie tylko kreski 2–3 px, obszary w `dvh`/`vw`, logo w `em` (strażnik `arbitrarySize`). |
| Karta w kolumnie i w siatce | `@container` + `@md:`/`@lg:` | Układ karty zależy od jej szerokości, nie od szerokości okna. |

## Tekst

| Rola | Użycie |
|---|---|
| `ViewTitle` | Tytuł działu (h1). Komponent. |
| `title-page` | Tytuł ekranu poza `ViewTitle` (kreator, dialog pełnoekranowy). |
| `title-section` | Tytuł sekcji, która nie jest kartą. |
| `title-card` | Nagłówek karty (`SectionCard` ma go w sobie). |
| `text-sm` | Tekst interfejsu: 14 px na komputerze, 15 px na telefonie. |
| `ui-label` | Etykieta pola, przycisk tekstowy. |
| `ui-hint` | Opis pod kontrolką, czytany. 14 px, nie 12. |
| `ui-meta` | Data, licznik, jednostka. 12 px, cyfry tabelaryczne. |
| `num-lg` | Liczba główna karty. |
| `text-faint` | Trzeci poziom koloru. Zamiast `opacity` i `text-muted-foreground/60`. |

Rozmiary są w rem, więc rosną z ustawieniem „Rozmiar tekstu”. Nie wpisuj `text-[13px]`.

## Powierzchnie

| Odmiana | Kiedy |
|---|---|
| `Card` (`plain`) | Domyślna karta: obrys, bez cienia. |
| `raised` | Karta nad tłem, np. podsumowanie z liczbami. |
| `inset` | Grupa w karcie: tło wyciszone, bez obrysu. Karta w karcie tylko tak. |
| `interactive` | Cała karta klikalna. Stan wybrania przez `aria-selected`, `aria-pressed` albo `aria-current`. |
| `status` + `tone` | Ostrzeżenie, informacja: lewa krawędź w kolorze stanu. |
| `SectionCard` | Karta z nagłówkiem (`icon`, `title`, `meta`, `action`). |
| `ListRow` | Wiersz listy (`min-h-11`, `py-row`). |

## Kontrolki

- **Przycisk:** `Button` z wariantem `default`, `outline`, `ghost`, `secondary`, `destructive`, `link` albo `toolbar`. Przycisk z samą ikoną to `IconButton` (`size="sm"` w gęstych paskach, `md` w nagłówku) z `aria-label`.
- **Pigułka:** `Button variant="chip"` (filtr, wybór z `aria-pressed`), `chip-soft` (podpowiedź), `chip-add` („dodaj”), `pill` (akcentowa). Rozmiary `chip` i `chip-md`.
- **Surowy `<button>`** zostaje tylko w kanwie, komórce siatki i elemencie Radix z `asChild`. Strażnik `RAW_BUTTON_MAX` liczy je dla każdego działu.
- **Stany:** wszystkie są w tabeli w `docs/komponenty.md`. Nieaktywny to `text-faint` bez `opacity`. Wybrany to akcent razem z atrybutem ARIA.
- **Cel dotyku:** 44 px na `coarse` (`coarse:h-11` albo `tap-target`).

## Dane i stany

- **Wykres:** `ChartFrame` z tytułem, sumą, zakresem, podpisami serii (kształt `bar`, `hatch`, `line` albo `dash`) i tabelą „Pokaż dane”. Recharts tylko w `children`, ładowany leniwie.
- **Mały wykres w karcie:** `Sparkline`, `WeekBars` albo `ProgressRing` z `ui/mini-charts.tsx`, zawsze z liczbą w tekście obok.
- **Pusty stan:** `StatusPanel` ze szkicem `Sketch` (`size="inline"` w liście), jednym zdaniem i jedną akcją główną. Brak wyników wyszukiwania to `tone="no-results"` z przyciskiem „Wyczyść wyszukiwanie”.
- **Ładowanie:** `ViewSkeleton` i `CardSkeleton` w kształcie docelowej karty. Pojawiają się po 300 ms.

## Style, kontrast, druk

- **Nowy kolor** to token w `src/styles/app/tokens.css` (`:root` i `.dark`) i w każdym `skins/<styl>.css`. Komplet tokenów sprawdza `skinContract.test.ts`, a kontrast `skinContrast.test.ts` (WCAG 2.2 AA w 10 stylach × 2 schematach). Kolory zapisuj w OKLCH.
- **`dark:`** tylko w `components/ui/`. Kolor bierz z tokenu.
- **Wysoki kontrast** obsługuje `styles/preferences.css`. Stan wybrania musi mieć atrybut ARIA, żeby w trybie wymuszonych kolorów dostał obrys `Highlight`.
- **Druk:** powłoka znika sama. Element, którego nie chcesz na papierze, dostaje `data-print="hide"`. PDF bierze rozmiary z `src/lib/pdfType.ts`.
- **`!important`** tylko dla ograniczonego ruchu, druku, OLED i obcych arkuszy (strażnik `IMPORTANT_MAX`).

## Przed zamknięciem zmiany wyglądu

1. Skill `frontend-design` przed kodem, a przy przeglądzie `refactoring-ui` i `ux-heuristics`.
2. `npx vitest run src/test` (strażnicy) i `npm run typecheck`.
3. e2e działu i `e2e/a11y.spec.ts` (axe).
4. Zrzuty przy 390 i 1280 px, w jasnym i ciemnym schemacie. Tymczasowy spec usuń po obejrzeniu.
5. Wpis w `opis.md`.

# Stany komponentów

Jedna tabela stanów dla kontrolek z `src/components/ui/` (plan warstwy wizualnej, W4.4). Nowa kontrolka dostaje komplet stanów z tej tabeli albo wpisuje tu, czego nie ma i dlaczego.

## Wspólne zasady

- **Hover** działa tylko na urządzeniu z kursorem. Tailwind v4 owija `hover:` w `@media (hover: hover)`, więc na dotyku stan nie „przykleja się” po stuknięciu.
- **Fokus** pokazuje `focus-visible:ring-2 ring-ring` i nigdy nie zależy od samego koloru tła.
- **Wciśnięcie** robi `pressable` (`src/index.css`): przesunięcie o 1 px w dół i przyciemnienie. Przycisk dokłada też wewnętrzny cień.
- **Nieaktywny** ma jeden wzór: tekst `--faint` (`text-faint`) i brak cienia. Nie używa `opacity-*`, bo blady element wygląda na zepsuty. Wypełnione warianty przechodzą na tło `bg-muted`. Strażnik `disabledOpacity` w `src/test/designTokens.test.ts` liczy stare `disabled:opacity-*`.
- **Wybrany** oznacza obrys albo tło w akcencie (`primary`) razem z atrybutem ARIA (`aria-selected`, `aria-pressed`, `aria-current`, `data-state="on"`). Kolor bez atrybutu nie wystarcza.
- **Ładowanie** pokazuje kółko zamiast pierwszej ikony, `aria-busy` i blokadę kontrolki. Etykieta zostaje, więc szerokość nie skacze.

## Tabela

| Komponent | Spoczynek | Hover | Fokus | Wciśnięty | Wybrany | Nieaktywny | Ładowanie |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Button` (`ui/button.tsx`) | wariant | tło `/90` lub `bg-muted` | pierścień + offset | `pressable` + wewnętrzny cień | — (używaj `ToggleGroup`) | `text-faint`, wypełnione na `bg-muted`, bez cienia | `loading`: kółko, `aria-busy`, `disabled` |
| `Card variant="interactive"` (`ui/card.tsx`) | obrys `border` | obrys `foreground/25` | pierścień | `pressable` | obrys `primary` przy `aria-selected` / `aria-pressed` / `aria-current` | `aria-disabled`: `text-faint`, bez reakcji | — (treść karty pokazuje własny stan) |
| `ListRow` (`ui/list-row.tsx`) | statyczny | — | — | — | — | — | — |
| Pigułka (`Button variant="pill"`) | obrys `primary/40` | tło `primary/10` | pierścień | `pressable` | — | obrys `border`, `text-faint` | jak `Button` |
| Pigułka neutralna (`chip`) | obrys `border` | tło `muted` | pierścień | `pressable` | `aria-pressed`: obrys `primary`, tło `primary/10` | `text-faint` | jak `Button` |
| Pigułka-podpowiedź (`chip-soft`) | tło `muted`, bez obrysu | tło `primary/10` | pierścień | `pressable` | — | `text-faint` | jak `Button` |
| Pigułka „dodaj” (`chip-add`) | obrys przerywany, tekst wyciszony | obrys `primary`, tekst pełny | pierścień | `pressable` | — | `text-faint` | jak `Button` |
| Zakładka (`ui/tabs.tsx`, `ui/toggle-group.tsx`) | tekst wyciszony | tekst `foreground` | pierścień | `pressable` | `data-state="active"` / `"on"`: tło karty i tekst `foreground` | wzór Radix (`data-disabled`) | — |

## Czego jeszcze nie ma

- `ListRow` jest statyczny. Klikalny wiersz stawia w środku `<button>` albo ma akcję w slocie `action`. Stany wiersza dojdą razem z migracją list (W3.2).
- `aria-[current]` w `Card interactive` reaguje na sam atrybut. Nie ustawiaj `aria-current="false"`, tylko pomiń atrybut.
- Zakładki i przełączniki biorą stany z Radix i nie były przeglądane pod `text-faint`.

Rozmiary pigułek: `size="chip"` (w linii tekstu: 12 px tekstu, 14 px ikona, 44 px na dotyku) i `size="chip-md"` (w rzędzie akcji: 14 px tekstu). Tekst pigułki się łamie (`whitespace-normal`); `truncate` w `className` przywraca jedną linię.

## Wykres: `ChartFrame` (W5.1)

Każdy wykres stoi w `ChartFrame` (`ui/chart-frame.tsx`): `title`, `value` (suma, `num-lg`), `range`, `series` (podpis + kolor + kształt `bar`/`hatch`/`line`/`dash`), `plotClassName` (wysokość), `table` (zwinięta tabela „Pokaż dane”, wtedy wykres jest `aria-hidden`). Recharts tylko w `children`; dymek i podpisy osi z `ui/chart-style.ts`. Druga seria w tym samym kolorze rodziny dostaje inny kształt (`HatchPattern` w `<defs>`), nie tylko inną barwę.

## Małe wykresy (W5.3)

`ui/mini-charts.tsx`: `Sparkline` (przebieg, kolor z `currentColor`), `WeekBars` (pon–nd, dziś w akcencie), `ProgressRing` (0–1). Bez recharts, zawsze `aria-hidden` — wartość podaje tekst obok. Nowy pierścień postępu nie rysuje własnego SVG, tylko bierze `ProgressRing`.

## Pusty stan (W5.4)

`StatusPanel` + `Sketch` (`art/Sketch.tsx`): w liście działu `size="inline"` w obu. Rysunek to ścieżki z `lib/emptyGlyphs.ts` (viewBox 120×84, kończy się nad liniami kartki na y=72). Jedno zdanie w `title`, opcjonalny `description`, jedna akcja główna (`Button` domyślny), najwyżej jedna zapasowa (`outline`). Brak wyników wyszukiwania: `tone="no-results"` i „Wyczyść wyszukiwanie”.

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
| Zakładka (`ui/tabs.tsx`, `ui/toggle-group.tsx`) | tekst wyciszony | tekst `foreground` | pierścień | `pressable` | `data-state="active"` / `"on"`: tło karty i tekst `foreground` | wzór Radix (`data-disabled`) | — |

## Czego jeszcze nie ma

- `ListRow` jest statyczny. Klikalny wiersz stawia w środku `<button>` albo ma akcję w slocie `action`. Stany wiersza dojdą razem z migracją list (W3.2).
- `aria-[current]` w `Card interactive` reaguje na sam atrybut. Nie ustawiaj `aria-current="false"`, tylko pomiń atrybut.
- Zakładki i przełączniki biorą stany z Radix i nie były przeglądane pod `text-faint`.

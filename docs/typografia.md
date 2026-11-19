# Typografia — role tekstu

Skala ról z W2.1 (`docs/plan-warstwa-wizualna-2026-11-15.md`). Klasy w `src/index.css` (`@layer components`). Rozmiary są w `rem`, więc rosną razem z ustawieniem „Rozmiar tekstu” (`kaczy.textSize.v1`).

W widokach używaj roli, a nie pary `text-sm font-medium`. Kolor stanu dokładasz zwykłą klasą, na przykład `title-card text-destructive-ink`.

| Rola | Rozmiar / interlinia | Grubość | Gdzie |
|---|---|---|---|
| `ViewTitle` (h1) | 30 / 36 | 700 | Tytuł ekranu działu. Komponent, nie klasa. |
| `title-page` | 22 / 28 | 700 | Tytuł ekranu poza `ViewTitle`, na przykład w dialogu pełnoekranowym albo w kreatorze. |
| `title-section` | 17 / 24 | 650 | Tytuł sekcji w widoku (h2), gdy sekcja nie jest kartą. |
| `title-card` | tekst interfejsu + 1 px (15 / 20, a na telefonie 16 / 20) | 600 | Nagłówek `SectionCard`. |
| tekst interfejsu (`text-sm`) | `--text-ui`: 14 / 20, a na telefonie 15 / 22 | 400 | Treść wierszy, przyciski, pola. |
| `ui-hint` | jak tekst interfejsu | 400 | Opis pod kontrolką albo nad listą. Ten tekst się czyta, dlatego nie ma 12 px. |
| `ui-meta` | 12 / 16 | 400 | Data, licznik, jednostka. Cyfry tabelaryczne. |
| `num-lg` | 28 / 32, mono | 600 | Liczba główna karty, na przykład saldo, suma godzin albo wynik. |
| `text-faint` | — | — | Kolor trzeciego poziomu (W1.1). Kontrast ≥ 4,5:1 w każdym stylu. |

## Decyzje

- **WZ-1:** 15 px tekstu interfejsu na telefonie, czyli przy szerokości poniżej 768 px albo w poziomym ułożeniu przy niskim ekranie dotykowym. Na komputerze zostaje 14 px. Ustawia to zmienna `--text-ui` w `src/styles/text-size.css`. Żeby cofnąć decyzję, usuń blok `@media` w tym pliku.
- Tytuły odstają od tekstu o co najmniej dwa stopnie. Pogrubienie nie może być jedynym nośnikiem hierarchii (W2.3).
- Łamanie: `h1`–`h3` mają `text-wrap: balance`, a `p` i `li` mają `text-wrap: pretty` (`index.css`, warstwa bazowa).

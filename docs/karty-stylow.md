# Karty tożsamości stylów (W6.2)

Stan na 2026-11-20. Wartości kolorów to OKLCH w skrócie `L C H` (jasność 0–1, nasycenie, odcień w stopniach), czytane z `src/styles/skins/<styl>.css` i z `src/index.css` (Zeszyt: `:root` i `.dark`). Pierwszy wiersz stylu to schemat, w którym styl powstał (`SKIN_SCHEME` w `src/lib/skinList.ts`).

Wspólne dla wszystkich stylów, więc w tabeli ich nie ma:

- **Promienie** `--r-control`, `--r-field`, `--r-card` są jedne. Zmienia je tylko ustawienie „Kształt” (`data-shape`: ostry ×0,4, miękki ×1,6). Styl zmienia najwyżej kształt przycisku „+” (`--fab-radius`) i znacznika w dolnym pasku.
- **Krój treści** wybiera użytkownik (`--app-font`, 6 krojów). Styl ustawia tylko krój nagłówków `h2` i ozdób.
- **Skala cieni** jest jedna (`--elevation-1..3`). Styl zmienia barwę cienia (`--shadow-tint`) i w stylach świecących dokłada poświatę.

## Tabela

| Styl | Schemat | Tło | Karta | Akcent główny | Akcent 2 | Krój nagłówków | Kreska ikon | Kreska szkicu | Przycisk „+” |
|---|---|---|---|---|---|---|---|---|---|
| Zeszyt | jasny | 0.99 0.01 95 | 1.00 0 — | 0.67 0.16 63 (bursztyn) | 0.46 0.14 264 (granat) | krój użytkownika | 1,5 | 2 | koło |
| Zeszyt | ciemny | 0.18 0.01 60 | 0.22 0.01 60 | 0.77 0.15 67 | 0.75 0.13 264 | krój użytkownika | 1,5 | 2 | koło |
| Plan | ciemny | 0.29 0.07 252 | 0.33 0.07 252 | 0.82 0.11 226 (cyjan) | 0.91 0.15 98 | Barlow Condensed | 1,5 | 1,4, przerywana | koło |
| Plan | jasny | 0.96 0.01 240 | 0.99 0 240 | 0.47 0.13 255 | 0.48 0.11 65 | Barlow Condensed | 1,5 | 1,4, przerywana | koło |
| Neon | ciemny | 0.16 0.03 315 | 0.21 0.04 315 | 0.71 0.24 340 (róż) | 0.87 0.14 206 | Unbounded | 1,75 | 1,8 + poświata | koło z poświatą |
| Neon | jasny | 0.96 0.01 330 | 0.99 0.01 330 | 0.55 0.22 350 | 0.50 0.10 215 | Unbounded | 1,75 | 1,8 + poświata | koło z poświatą |
| Zorza | ciemny | 0.15 0.03 271 | 0.20 0.04 270 | 0.85 0.18 161 (zieleń) | 0.76 0.14 300 | Fraunces (szeryf) | 1,75 | 1,8 + poświata | koło |
| Zorza | jasny | 0.96 0.01 300 | 0.99 0.01 300 | 0.50 0.11 165 | 0.48 0.16 295 | Fraunces | 1,75 | 1,8 + poświata | koło |
| Miedź | jasny | 0.92 0 68 | 0.99 0 85 | 0.54 0.13 46 (miedź) | 0.47 0.07 205 (patyna) | Bricolage Grotesque | 1,75 | 2,2 | koło |
| Miedź | ciemny | 0.22 0.01 55 | 0.26 0.01 55 | 0.72 0.13 52 | 0.74 0.09 190 | Bricolage Grotesque | 1,75 | 2,2 | koło |
| Matryca | ciemny | 0.12 0.03 144 | 0.16 0.03 144 | 0.87 0.28 143 (zieleń) | 0.88 0.21 155 | JetBrains Mono | 1,5 | 1,6 + poświata | koło |
| Matryca | jasny | 0.97 0.01 140 | 0.99 0.01 140 | 0.47 0.13 150 | 0.45 0.10 165 | JetBrains Mono | 1,5 | 1,6 + poświata | koło |
| Hydraulika | ciemny | 0.24 0.03 241 | 0.28 0.03 241 | 0.70 0.13 52 (miedź) | 0.78 0.13 226 (woda) | Barlow Condensed | 2 | 2,6 | koło |
| Hydraulika | jasny | 0.97 0.01 230 | 0.99 0 230 | 0.52 0.12 50 | 0.48 0.11 235 | Barlow Condensed | 2 | 2,6 | koło |
| Odblask | jasny | 0.93 0.19 112 (żółć) | 1.00 0 — | 0.20 0 — (czerń) | 0.36 0.14 262 | Barlow Condensed | 1,75 | 3 | 0,25 rem |
| Odblask | ciemny | 0.15 0 — | 0.21 0 — | 0.93 0.19 112 | 0.82 0.12 230 | Barlow Condensed | 1,75 | 3 | 0,25 rem |
| Kafle | jasny | 0.97 0 240 | 1.00 0 — | 0.45 0.17 262 (kobalt) | 0.46 0.10 222 | Nunito | 1,75 | 2,4 | 0,5 rem |
| Kafle | ciemny | 0.23 0.01 250 | 0.28 0.01 250 | 0.74 0.12 258 | 0.78 0.09 210 | Nunito | 1,75 | 2,4 | 0,5 rem |
| Tablica | ciemny | 0.32 0.04 162 (zieleń tablicy) | 0.36 0.04 162 | 0.88 0.13 96 (kreda) | 0.86 0.08 350 | Lexend | 1,75 | 2,4 | koło |
| Tablica | jasny | 0.97 0.012 162 | 1.00 0 — | 0.46 0.12 155 (zielony marker) | 0.47 0.15 255 (niebieski marker, linki) | Lexend | 1,75 | 2,4 | koło |

## Sygnatury

Sygnatura to ruch albo ozdoba, po której styl poznać bez kolorów (`skins/signatures.css`, `skins/day-signature.css`).

| Styl | Zapis | Zmiana widoku | Stała ozdoba | Dziś |
|---|---|---|---|---|
| Zeszyt | pieczątka „zapisano” w rogu | kartka się przewraca | pióro podkreśla tytuł, taśma na przypiętej notatce, kratka | data dopisana długopisem |
| Plan | linia wymiarowa przez arkusz | linia skanu | siatka kreślarska wjeżdża, linia wymiarowa pod zaznaczonym kaflem | tabliczka rysunkowa |
| Neon | rurka „bzyka” | prąd na chwilę | poświata kafla przy fokusie, rozbłysk przypiętych, „+” z podwójną poświatą | szyld z dniem tygodnia |
| Zorza | fala barw w poprzek | — | paralaksa gwiazd | faza Księżyca |
| Miedź | obłoczek pary | odblask po betonie | patyna na notatkach nieruszanych 30 dni | tabliczka znamionowa na nitach |
| Matryca | linia skanu z góry | kaskada kolumn | deszcz znaków | wiersz terminala z kursorem |
| Hydraulika | fala napełnia rurę | woda płynie rurą | bąbelki | manometr doby |
| Odblask | — (styl bez ruchu) | — | pasy ostrzegawcze nad nagłówkiem, kafle z obwódką, ostre okna, gruby fokus | tabliczka budowy w pasach |
| Kafle | płytka „dosiada” w rogu | połysk przesuwa się po ścianie | płytki z fugą (jasny: 20×20), połysk szkliwa na kaflu notatki | data na płytce |
| Tablica | ptaszek markerem w rogu | przetarcie gąbką | ślady starego pisma (ciemny) albo korek (jasny), magnes na kaflu, aluminiowa rama, znacznik jak kreda | dzień tygodnia markerem |

## Pary podobne (decyzja WZ-2)

Kryterium z planu: dwa style różnią się **tylko barwą**, gdy mają ten sam krój nagłówków, tę samą kreskę, ten sam kształt i podobną jasność oraz nasycenie tła, karty i akcentu (różnica L i C poniżej 0,03).

- **Żadna para stylów jako całość nie spełnia kryterium.** Każdy styl ma inny krój nagłówków albo inną sygnaturę. Plan i Hydraulika mają ten sam krój (Barlow Condensed), ale inną kreskę (1,5 i 2), inny szkic (przerywany i 2,6) oraz inne sygnatury.
- **Najbliżej są jasne schematy Kafli i Tablicy.** Tło (0.97 0 240 i 0.97 0 250), karta (biała) i akcent główny (kobalt 0.45 0.17 262 i 0.47 0.17 262) są prawie takie same, kreska szkicu też (2,4). Różnią się krojem (Nunito i Lexend), przyciskiem „+” (0,5 rem i koło), drugim akcentem (222 i 152) i wzorem tła (płytki 20×20 i korek). Przy „gładkim” tle, które zdejmuje wzór, zostają prawie te same ekrany. Ciemne schematy różnią się wyraźnie.
- **Jasne schematy stylów ciemnych** (Plan, Neon, Zorza, Matryca, Hydraulika) mają ten sam układ: tło 0.96–0.97 z nasyceniem 0.01, karta 0.99 i akcent o jasności 0.47–0.55. Różni je odcień, krój i sygnatura. Przy „gładkim” tle i ograniczonym ruchu zostaje w nich prawie sam odcień akcentu.

Propozycje do decyzji właściciela:

1. **Kafle i Tablica (jasne):** nie łączyć stylów, tylko rozsunąć jasną Tablicę. **Zrobione 2026-11-27:** tło 0.97 0.012 162, akcent główny zielony marker 0.46 0.12 155, linki niebieskim markerem; obramowania, tekst i cień w odcieniu 162. Na przykład tło z lekką zielenią tablicy (H 162, C 0.01–0.02) i akcent główny w zieleni zamiast kobaltu. Ciemna Tablica już ma zieleń, więc jasna będzie bliżej swojego stylu.
2. **Jasne warianty stylów ciemnych:** zostawić. Mają być spokojną wersją dzienną, a tożsamość niesie krój i sygnatura.

## Jak odświeżyć tabelę

Kolory czyta skrypt jednorazowy: z każdego `skins/<styl>.css` bloki `html[data-skin="…"]`, `:not(.dark)` i `.dark` z `--background`, `--card`, `--primary`, `--accent`. Krój to pierwsze `font-family` w pliku stylu, kreska szkicu to `--sketch-w` z `index.css`, a kreska ikon to `--icon-stroke` z `index.css` (1,5 w Planie, Matrycy i Zeszycie, 2 w Hydraulice, reszta 1,75).

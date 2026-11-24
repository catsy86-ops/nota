# Licencje zależności produkcyjnych (S5.7, 2026-11-24)

Jednorazowy spis z planu bezpieczeństwa (`docs/plan-security-2026-11-15.md`, S5.7). Źródło: pole `license` w `package-lock.json` aplikacji, `push-server` i `relay-server`, bez pakietów `dev`. Braki w polu `license` sprawdzone w plikach licencji pakietów. Spis opisuje stan z 2026-11-24. Przy nowej zależności z licencją spoza listy „bez uwag” dopisz ją tutaj.

## Podsumowanie

| Licencja | Pakiety | Uwagi |
|---|---|---|
| MIT | 374 (+1 `MIT AND ISC`, +1 `MIT AND Zlib`) | bez uwag |
| ISC | 44 | bez uwag |
| Apache-2.0 | 12 (+ `class-variance-authority`, pole puste w locku) | bez uwag |
| BSD-3-Clause, BSD-2-Clause, 0BSD, Unlicense | 14 | bez uwag |
| OFL-1.1 | 12 krojów `@fontsource` | patrz niżej |
| `(MPL-2.0 OR Apache-2.0)` | `dompurify` 3.4.17 | korzystamy z Apache-2.0 |
| `EPL-2.0 OR GPL-3.0-or-later` | `elkjs` 0.12.1 (zależność `mermaid`) | patrz niżej |
| MPL-2.0 | `web-push` 3.6.7 (`push-server`) | patrz niżej |
| własna, zezwalająca | `rgbcolor` 1.0.1 (zależność `canvg`) | „Feel free to use the code…” — bez warunków |
| MIT (pole puste w locku) | `khroma` 2.1.0 | plik `license` w pakiecie |

Nie ma zależności, która wymagałaby otwarcia kodu aplikacji.

## Pakiety z warunkami

- **`elkjs` (EPL-2.0 albo GPL-3.0-or-later).** Przychodzi z Mermaid i jest serwowany bez zmian z `public/mermaid/<wersja>/`. Wybieramy EPL-2.0. To słaby copyleft na poziomie pliku: nie obejmuje kodu aplikacji, ale przy rozpowszechnianiu w postaci wykonywalnej trzeba wskazać, skąd wziąć źródło tego modułu. **Do zrobienia:** odnośnik do źródła `elkjs` (https://github.com/kieler/elkjs) w informacjach o licencjach aplikacji.
- **`web-push` (MPL-2.0).** Tylko na serwerze push, bez zmian. MPL-2.0 dotyczy zmienionych plików samego pakietu. Gdybyśmy go łatali, zmienione pliki trzeba udostępnić na MPL-2.0.
- **Kroje `@fontsource` (OFL-1.1).** Wolno je osadzać i rozpowszechniać z aplikacją, nie wolno sprzedawać samych krojów. `public/fonts/protokol-*.ttf` to podzbiór Barlow Condensed przetworzony skryptem `scripts/build-pdf-font.mjs`. Jako zmieniona wersja ma własną nazwę pliku i nadal jest na OFL-1.1.
- **`dompurify`.** Podwójna licencja. Korzystamy z Apache-2.0, więc warunki MPL nie mają zastosowania.

## Obowiązki ogólne

MIT, BSD, ISC i Apache-2.0 wymagają zachowania informacji o prawach autorskich i licencji w rozpowszechnianej kopii. Vite przy minifikacji usuwa większość komentarzy licencyjnych. **Do zrobienia:** plik z licencjami stron trzecich generowany przy buildzie (np. wtyczka zbierająca licencje z paczki) i odnośnik do niego w Ustawieniach → O aplikacji. Ten sam plik pokryje odnośnik do źródła `elkjs`.

## Jak odtworzyć spis

```sh
node -e "for (const d of ['.','push-server','relay-server']) for (const [k,v] of Object.entries(require('./'+d+'/package-lock.json').packages)) if (k && !v.dev && !v.devOptional) console.log(v.license ?? 'BRAK', k.replace(/^.*node_modules\//,''), v.version, d)" | sort
```

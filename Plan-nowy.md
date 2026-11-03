# Plan rozwoju i dopracowania NOTKI (2026-11-03)

> **Status (2026-11-03):** wersja 1. To jedno źródło prawdy o tym, co zostało. Plany działów w `docs/plan-*.md` zostają jako szczegóły punktów, a ich linia „Status” ma się zgadzać z tym planem. Raporty siedmiu agentów (dwa inwentarze planów, architektura, wydajność, bezpieczeństwo, testy, UX i dostępność) były w toku przy zapisie tej wersji. Ich ustalenia trzeba dopisać w sekcji „Ustalenia agentów” i według nich poprawić kolejność.

## 1. Zasady pracy

1. **Jedno źródło prawdy.** Otwarte punkty są tutaj, a szczegóły w planie działu. `opis.md` opisuje stan aplikacji, nie historię zmian.
2. **Cykle ze stałym czasem i zmiennym zakresem** (Shape Up). Cykl trwa 1–2 tygodnie i ma „apetyt” zamiast estymaty. Po cyklu jest krótki czas na porządki i QA. Czego nie zdążymy, wraca do puli, a cykl się nie wydłuża.
3. **Priorytet według W/N** (wartość 1–3, nakład S/M/L), tak jak w planach działów. Ryzyko utraty danych idzie przed wszystkim innym.
4. **Definicja „zrobione”.** Kolejność: test → kod → `opis.md` → commit. Do tego:
   - typecheck i lint bez nowych ostrzeżeń;
   - Vitest dla logiki w `src/lib`, e2e dla ścieżki użytkownika;
   - axe dla nowego UI;
   - zielone budżety w `e2e/bundle.spec.ts`;
   - `/code-review` przed commitem i push po każdym etapie.
5. **Local-first.** Aplikacja działa offline, dane zostają u właściciela, a sync niczego nie gubi. Starsza wersja na drugim urządzeniu musi czytać nowy dokument:
   - nowe pola idą w jednej wartości LWW (wzorzec `reminderSpec`);
   - dane od peera są zawsze niezaufane (`safeProjection`).
6. **Dostępność według WCAG 2.2 AA.** Cel dotyku 44 px na telefonie (2.5.8), fokus nie chowa się pod paskiem (2.4.11), redukcja ruchu jest respektowana, kontrast sprawdzamy we wszystkich 10 stylach × 2 schematach.
7. **Bezpieczeństwo według OWASP ASVS L1** jako lista kontrolna. Treść notatki prywatnej nigdy nie wychodzi jawnie (push, `.ics`, kopia, dymki). Zmiany w Yjs, sync, udostępnianiu, CSP i przekaźniku przechodzą przez `security-reviewer`.
8. **Budżety wydajności:**
   - wejściowy JS ≤ 500 KB gzip; dziś 482 688 B, zapas około 29 KB;
   - precache ≤ 4,0 MiB;
   - DOM przy 300 notatkach.

   Nowa zależność to świadoma decyzja z pomiarem.
9. **Małe commity, krótkie gałęzie.** Gałąź robocza `wip/*` idzie na `master` po zielonych testach etapu.
10. **Decyzje właściciela są spisane** w tabeli w punkcie 6. Punkt czekający na decyzję nie blokuje reszty cyklu.

## 2. Stan wyjściowy (2026-11-03)

- **Zrobione dziś:**
  - Terminy 3.2: wcześniejsze przypomnienie 15 min / 1 h / dzień przed, w dymku, push i `.ics`;
  - Skrzynka 2.1: frazy `#etykieta`, `@folder`, `!` i data w polu;
  - Skrzynka 2.4: wklejony sam adres;
  - Skrzynka 2.5: wklejony obraz albo upuszczony plik;
  - Ustawienia → Wygląd bez podglądu na żywo i bez sekcji „Zestawy” (decyzja właściciela).
- **Testy z tej sesji:**
  - e2e terminów i kompozytora 51/51;
  - Skrzynka 8/8, plus test 2.5;
  - Wygląd 9/9 i szybkie zestawy 4/4;
  - Vitest dotkniętych obszarów zielony.
- **Znane chwiejne testy** (przechodzą osobno, padają pod obciążeniem):
  - `site-faults`, `study-delivery`;
  - zrzut „praca — odblask”;
  - zrzuty „komputer › praca — *”: pasek boczny bywa zwinięty na 1440 px, możliwy wyścig przy starcie.
- **Plany:** około 25 plików w `docs/`. Bez linii Status są Notatki (około 38 punktów), Ustawienia (22) i Powłoka (część). Plan Kalendarza, Grafiku i Pracy ma status z 27.10.
- **Ręczne QA na telefonie** jest zebrane w punkcie 5 (Cykl 4).

## 3. Cykl 1 — porządek i bezpieczne zmiany (apetyt: 1 tydzień)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Inwentarz z dowodami:** linia Status w planach Notatek, Ustawień i Powłoki (każdy punkt sprawdzony w kodzie); aktualny status planu Kalendarza, Grafiku i Pracy z 27.10. Źródło: raporty inwentarza. | `docs/plan-*.md` | 3 | S |
| 1.2 | **Chwiejne testy:** wyścig zwijania paska bocznego przy starcie na 1440 px, `site-faults`, `study-delivery`, „praca — odblask”. Najpierw przyczyna (czekanie na stan zamiast `waitForTimeout`), potem poprawka. | `e2e/`, powłoka | 3 | M |
| 1.3 | **Bramka jakości lokalnie:** jedno polecenie `npm run check` (typecheck, lint, Vitest, e2e `@smoke`) poniżej 3 min, uruchamiane przed pushem. | `package.json` | 3 | S |
| 1.4 | **Test zgodności danych:** dokument z nowymi polami (`reminderLead`, `reminderRule`, mapy Pracy) czytany i zapisywany przez kod udający starszą wersję; nic nie ginie poza świadomie opisanymi wyjątkami. | `src/lib/*.test.ts` | 3 | M |
| 1.5 | **Zapas paczki:** przegląd chunka wejściowego i co najmniej 20 KB z powrotem (leniwe okna i rzadkie działy), bez szkody dla offline. | `vite.config.ts`, importy | 2 | M |
| 1.6 | **Gałęzie:** lokalny `master` zgodny z `origin/master`, jedna gałąź robocza, zrobione `worktree-agent-*` i stare gałęzie posprzątane (po sprawdzeniu, że są scalone). | git | 2 | S |
| 1.7 | **CLAUDE.md:** próg „394 KB” jest nieaktualny, obowiązuje `e2e/bundle.spec.ts` (500 KB). | `CLAUDE.md` | 1 | S |

## 4. Cykl 2 — dokończyć działy bez decyzji (apetyt: 1–2 tygodnie)

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Skrzynka 2.3:** skrót `Alt+K` i polecenie „Do skrzynki…” w palecie (małe okno bez zmiany widoku), skrót PWA `?skrzynka=1`. | 3 | M |
| 2.2 | **Skrzynka 3.1, 3.4:** filtr chipów folderu i etykiety w porządkowaniu (9 najczęstszych, „Nowy…”); „Przypomnij…” z porządkowania. | 3 | M |
| 2.3 | **Skrzynka 4.1–4.4, 4.6:** pole jak zwinięty kompozytor, pasek z licznikiem i „Porządkuj”, wiek notatki i sortowanie „najstarsze najpierw”, pieczątka „Posortowane”, karta porządkowania z postępem. | 2 | M |
| 2.4 | **Dziś:** 2.1 (reszta), 2.2, 2.4, 2.5, 4.2 i Etap 3 bez 3.4 (czeka na D-3). | 2 | M |
| 2.5 | **Terminy:** 4.5 (odhaczenie z ruchem, bez ruchu przy redukcji), 3.4 (termin z treści jako podpowiedź w edytorze). | 2 | M |
| 2.6 | **Kalendarz, Grafik, Praca (plan 27.10):** K3.6 (po QA, K-4), K4.1, K4.5, reszta G2–G4 i P2–P5, P6.2, P6.3 — tylko punkty, które inwentarz potwierdzi jako otwarte. | 2 | L |
| 2.7 | **Skarbiec:** 2.2, 3.3, Etap 4 (1.2 część 2 czeka na decyzję). | 2 | M |
| 2.8 | **Powłoka i QoL:** test e2e celów dotyku 44 px na `pixel-7` (3.11), paleta zależna od kontekstu otwartej notatki (QoL 3.9 / Notatki 2.5). | 3 | M |
| 2.9 | **Notatki, Ustawienia, Ćwiczenia:** punkty potwierdzone przez inwentarz, w kolejności W/N. | 2 | L |

## 5. Cykl 3 — architektura i wydajność (apetyt: 1–2 tygodnie)

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **`src/pages/Index.tsx` na mniejsze części:** hooki widoków (Skrzynka, Terminy, Dziś), hosty okien i akcje zapisu w osobnych modułach. Bez zmiany zachowania; siatką bezpieczeństwa są e2e. | 3 | L |
| 3.2 | **Wyszukiwanie w Workerze** i zrzut indeksu do IndexedDB (odłożone z planu rozbudowy 3.x). Najpierw przejście wywołań na asynchroniczne. | 2 | L |
| 3.3 | **Pomiar reakcji:** INP i LCP na `pixel-7` w Playwright (web-vitals w trybie debug) jako stały test z progiem. | 2 | M |
| 3.4 | **ADR:** krótko spisane decyzje — `reminderSpec` jako jedna wartość LWW, CSP `connect-src` szerokie, Web Push lokalnie, brak hostingu, model stylów i motywów. | 2 | S |
| 3.5 | **`<Activity>` dla ostatniego działu** (powrót bez przeładowania), tylko po pomiarze pamięci na telefonie. | 1 | M |

## 6. Cykl 4 — telefon i wdrożenie (gdy właściciel ma czas)

- **Jedna sesja QA na telefonie, wszystko naraz:**
  - plan hydraulika: H4.2, H6.1 i H6.2 (dyktowanie);
  - Długi: Etap 5; Wygląd: Faza 8; motywy: pomiar klatek;
  - udostępnianie 5.3;
  - prawdziwy rysunek DWG w Analizatorze;
  - Terminy 3.2: sygnał na ekranie blokady;
  - Skrzynka 2.5: wklejenie zdjęcia z galerii.
- **Wdrożenie serwera push i przekaźnika:** po decyzji o hostingu, z `security-reviewer` przed uruchomieniem.

## 7. Decyzje właściciela

| Kod | Pytanie | Rekomendacja / stan |
|---|---|---|
| H-1 | Materiał w aucie (H1.3) — zakres. | Z planu hydraulika. |
| H-6 | H5.3: godziny z autorem. | Odłożone. |
| D-3 | Dziś 3.4. | Z planu Dziś. |
| P0.2 | `shareOrCopy` na telefonie otwiera arkusz zamiast kopiować. | Do potwierdzenia. |
| Skarbiec 1.2 cz. 2 | Nowy projekt kryptografii. | Osobna decyzja i przegląd bezpieczeństwa. |
| C-1 | Ćwiczenia 2.7. | Z planu Ćwiczeń. |
| K-4 | Tydzień z osią godzin (K3.6). | Po QA. |
| — | „Gotowe” kończy serię? | Otwarte od 19.10. |
| — | Hosting serwera push i przekaźnika. | Odłożony. |
| — | Zapis nowego „Mój N” po usunięciu „Zestawów” z Ustawień. | Dodać „Zapisz bieżący” do okienka „Zestaw wyglądu” albo zostawić bez zapisu. |

## 8. Miary (sprawdzane po każdym cyklu)

- Paczka wejściowa (B gzip) i precache (MiB) z `e2e/bundle.spec.ts`.
- e2e: odsetek zielonych, liczba chwiejnych testów, czas pełnego przebiegu.
- axe: 0 naruszeń na ekranach z `e2e/a11y.spec.ts`.
- Liczba otwartych punktów w planach i liczba decyzji czekających.

## 9. Czego nie robimy

- Bez nowego frameworka i bez przepisywania działów od zera.
- Bez nowych zależności bez pomiaru paczki.
- Bez funkcji, które wymagają własnego serwera, dopóki nie ma decyzji o hostingu.
- Bez wirtualizacji list ani Workerów „na zapas”: najpierw pomiar.

## 10. Ustalenia agentów (do uzupełnienia)

Raporty z 2026-11-03, w toku przy zapisie tej wersji. Każdy dopisać tu w skrócie (3–8 punktów z dowodem `plik:linia`), a punkty przenieść do cykli 1–3:

- Inwentarz A (Notatki, Ustawienia, Powłoka, plany UI, motywy, mobile, dane Yjs) — w toku.
- Inwentarz B (Praca, Kalendarz, Grafik, Dziś, Skrzynka, Terminy, Ćwiczenia, Skarbiec, Długi, roadmap, TODO, dług techniczny) — w toku.
- Architektura (granice modułów, model danych Yjs, ADR) — w toku.
- Wydajność (paczka, render, start, precache) — w toku.
- Bezpieczeństwo (Yjs i sync, Skarbiec, XSS, service worker, CSP, push) — w toku.
- Testy (liczby, luki, chwiejność, bramki jakości) — w toku.
- UX i dostępność (cele dotyku, fokus, komunikaty, formularze, heurystyki) — w toku.

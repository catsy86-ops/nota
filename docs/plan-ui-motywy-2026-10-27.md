# Plan: rozbudowa i upiększenie UI, motywy i skórki (2026-10-27)

## Kontekst

Plan UI/UX z 25.10 (`docs/plan-ui-ux-qol-2026-10-25.md`) jest prawie zamknięty: tokeny są w OKLCH (D-1), promienie i cienie przeszły na tokeny, działy mają swoje odcienie (5.1), a skórki mają sygnatury ruchu (plan rozbudowy, Faza 1b). Ten plan nie powtarza tamtych punktów. Zaczyna tam, gdzie tamten się kończy: skórki są ładne, ale sztywne (jedna skórka = jeden wygląd), nierówne (każda ma inny zestaw efektów) i trudno dodać nową.

**Pomiar w kodzie (2026-10-27, `master` na `aac3c44`):**

| Obszar | Stan |
|---|---|
| Skórki | 7: Zeszyt (jasny/ciemny), Plan, Neon, Zorza, Matryca, Hydraulika (ciemne), Miedź (jasna). Tylko Zeszyt słucha przełącznika jasności (`SKIN_SCHEME` w `src/lib/skins.ts`). |
| Dodanie skórki | 6 miejsc: `SKINS`, `SKIN_SCHEME`, `SKIN_THEME_COLOR` (`skins.ts`), `SKIN_META` (`skinGallery.ts`), `src/styles/skins.css`, listy w `e2e/a11y.spec.ts` i `e2e/visual.spec.ts`. Nic nie sprawdza, że skórka definiuje wszystkie tokeny. |
| `skins.css` | 897 linii w jednym pliku: tokeny, tła, sygnatury, miniatury galerii. W całości w paczce startowej. |
| Personalizacja | Krój tekstu (7), rozmiar tekstu (5 kroków), gęstość siatki, pora roku, ruch, tryb budowa. Brak wyboru akcentu, kształtu i natężenia tła. |
| Strażnik tokenów | `src/test/designTokens.test.ts`: progi 404 (promienie) i 24 (cienie), a w kodzie zostało 11 `rounded-sm` i 1 surowy cień. Progi nie pilnują już osiągniętego stanu. |
| Przełączanie skórki | Tylko w Ustawieniach → Wygląd (`SkinPicker`). Brak w palecie poleceń, brak podglądu przed wyborem. |
| Ikona karty | Jedna, niezależnie od skórki. Kolor paska PWA już zależy od skórki (`SKIN_THEME_COLOR`). |

**Sygnatury skórek dziś (`skins.css`, sekcja „Ruch i sygnatury”):**

| Moment | Zeszyt | Plan | Neon | Zorza | Miedź | Matryca | Hydraulika |
|---|---|---|---|---|---|---|---|
| Tło | kratka, ziarno | kalka 12/60 px | cegła, dwie plamy | gwiazdy, wstęgi | beton szalunkowy | deszcz (płótno) | rury, woda, bąbelki |
| Kafel | ramka przy najechaniu | narożniki, wymiarowanie | poświata fokusu, błysk przypięcia | szyba | — | półprzezroczysty | — |
| Nagłówek | kreska pióra | — | mruganie rurki | — | — | — | — |
| Okno | — | siatka wjeżdża | — | — | — | — | — |
| Zapis | — | — | — | fala barw | para z rury | linia skanu | fala w rurze |
| Zmiana widoku | przewrócona kartka | — | — | paralaksa | — | kaskada kolumn | — |
| Wejście skórki | koło (wspólne) | koło | mrugnięcie logo | gwiazdy falą | koło | koło | koło |

Kreska „—” to luka. Skórka z czterema efektami obok skórki z jednym wygląda na niedokończoną.

**Ograniczenia (bez zmian względem planu 25.10):**
- Paczka startowa: próg `eagerJsGzip` 500 KB, precache 3,8 MiB (`e2e/bundle.spec.ts`). Nowe skórki i kroje tylko leniwie.
- Każda zmiana działa we wszystkich skórkach, z `prefers-reduced-motion`, `prefers-contrast` i `forced-colors` (`src/styles/preferences.css`).
- Ruch tylko przez `transform` i `opacity`. Na telefonie bez rozmyć w tle (jak Zorza dziś).
- Bez zmian formatu Yjs: wszystkie nowe ustawienia wyglądu są per urządzenie, w localStorage przez `createPersistedStore`.
- Kolejność w punkcie: test → kod → `opis.md` → commit. Przed zmianą wyglądu skill `frontend-design`. Pełne e2e tylko na prośbę; wystarcza typecheck, unit i celowany test.

Legenda: W = wartość dla użytkownika (1–3), N = nakład (S/M/L).

---

## Faza 0: fundament skórek (najpierw)

Bez tego każda nowa skórka i każde ustawienie wyglądu to sześć miejsc do pamiętania i ręczny przegląd.

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 0.1 | **Obniżyć progi strażnika** do stanu dzisiejszego: promienie 404 → 11, cienie 24 → 1. Zamienić ostatnie `rounded-sm` na token albo opisać jako wyjątek. Osiągnięty porządek przestaje móc się rozjechać. | `src/test/designTokens.test.ts` | 1 | S |
| 0.2 | **Kontrakt tokenów.** Lista wymaganych tokenów (`--background`, `--card`, `--primary`, `--elevation-1..3`, `--sig-ease`, `--sig-dur` i reszta) i test, który parsuje CSS i sprawdza, że każda skórka definiuje każdy token. Brakujący token dziś cicho dziedziczy wartość z Zeszytu. | nowy `src/lib/skinContract.ts`, `src/lib/skinContract.test.ts` | 2 | S |
| 0.3 | **Jedna lista skórek.** `SKINS` z `skins.ts` jako jedyne źródło: testy e2e (`a11y`, `visual`) importują listę zamiast ją przepisywać. `SKIN_META` zostaje w leniwym `skinGallery.ts` (rozmiar paczki), ale test sprawdza, że ma wpis dla każdej skórki. | `e2e/*.spec.ts`, `src/lib/skins.test.ts` | 1 | S |
| 0.4 | **Rozbić `skins.css`** na `src/styles/skins/<id>.css` plus `common.css` (przejście kołem, miniatury, sygnatury wspólne). Na tym etapie wszystkie pliki nadal w paczce: zmiana tylko porządkowa, zrzuty bez różnic. | `src/styles/skins/` | 1 | S |
| 0.5 | **Pomiar kosztu skórek.** Rozmiar CSS każdej skórki (gzip) i koszt tła na telefonie (czas klatki na `pixel-7` przez 10 s, sonda `perfProbe.ts`). Wynik decyduje o 0.6 i o 1.3. | notatka w tym planie | 1 | S |
| 0.6 | **Leniwy CSS skórek (tylko jeśli 0.5 pokaże > 15 KB gzip).** Tokeny wszystkich skórek zostają w paczce (są małe, a `data-skin` ustawia `useTheme.ts:62` przy starcie, więc leniwe tokeny dałyby mignięcie kolorów). Leniwie ładowane są tylko tła i sygnatury nieaktywnych skórek, przez `import()` przy wyborze. | `src/styles/skins/`, `src/hooks/useTheme.ts` | 1 | M |

### Status Fazy 0 (2026-10-27)

- **0.1 zrobione.** Progi strażnika: promienie 404 → 11, cienie 24 → 0, warstwy 46 → 0. Zostałe 11 `rounded-sm` to elementy wewnątrz kontrolek, liczone od `--radius`, więc pójdą za kształtem z 1.2; opisane w teście.
- **0.2 zrobione.** `src/lib/skinContract.test.ts`: 36 tokenów kolorów i głębi w każdej skórce (Zeszyt w obu schematach) plus `--sig-ease`/`--sig-dur`; selektory `data-skin` tylko z istniejącymi skórkami. Test znalazł dwie rzeczy: Miedź nie miała `--elevation-up` (brała cień Zeszytu; dopisany w jej brązie) i cieńsze ikony Matrycy (plan 1.6) nigdy nie działały, bo selektor w `index.css` miał `data-skin="matryca"` zamiast `matrix` (poprawione — ikony w Matrycy są teraz cieńsze, 1,5).
- **0.3 zrobione.** `src/lib/skinList.ts` (bez importów) — jedyna lista skórek, schematów i kolorów paska; `skins.ts` reeksportuje. Wczytują ją `e2e/a11y.spec.ts`, `e2e/visual.spec.ts` i `skinContrast.test.ts`. `SKIN_META` zostaje w leniwym `skinGallery.ts` (typ `Record<Skin, …>` wymusza wpis dla każdej skórki).
- **0.4 zrobione.** `skins.css` to plik zbiorczy z `@import` części `src/styles/skins/` w dawnej kolejności (plan, neon, zorza, miedz, common, matrix, hydraulika, signatures), więc kaskada bez zmian. Sygnatury zostały w jednym `signatures.css`, bo rozdzielenie ich po skórkach zmieniłoby kolejność reguł. Testy czytają CSS przez `src/test/skinCss.ts`.
- **0.5 zrobione.** CSS skórek: ok. 10,4 KB gzip razem (źródła z komentarzami; największe `signatures` 3,1 KB, `hydraulika` 2,1 KB), cały CSS aplikacji 38,4 KB gzip. Czas klatki na emulacji Pixel 7 (CPU ×4, 5 s, Notatki): wszystkie siedem skórek 60 kl./s, mediana i p95 16,7–16,8 ms, zero klatek > 33 ms. Emulator nie oddaje kosztu GPU ani baterii prawdziwego telefonu — ten pomiar zostaje do QA na telefonie (Faza 5).
- **0.6 pominięte.** Próg 15 KB gzip nieprzekroczony. Wrócić po Fazie 4 (sześć drugich schematów i trzy nowe skórki z dwoma schematami każda).

### Status szybkich wygranych (2026-10-27)

- **3.1 zrobione.** `src/lib/skinTry.ts` (`trySkin`): wybór w galerii działa od razu, dymek „Styl: … · Cofnij” wraca do stylu sprzed całej serii przymiarek; ręczny powrót do stylu wyjściowego zamyka dymek.
- **3.3 zrobione.** Paleta: „Następny styl” (z nazwą następnego) w Akcjach; grupa „Styl” z pozostałymi stylami pojawia się po wpisaniu tekstu (np. „styl”, „neon”), żeby nie zaśmiecać pustej palety.
- **1.1 i 1.5 zrobione.** Akcent: 4 odcienie + barwa stylu, pamiętany per styl (`src/lib/accent.ts`, `accentMeta.ts`, `AccentPicker.tsx`); CSS generowany (`docs/tools/accents/accents-gen.mjs` → `src/styles/accents.css`) z dopasowaniem jasności do progów; test kontrastu dla 28 odcieni (Zeszyt × 2 schematy). Po M-2 (drugie schematy) trzeba dopisać schematy w `SCHEMES` generatora i uruchomić go ponownie.
- **1.2 zrobione.** Ustawienia → Wygląd → „Kształt”: Ostry (×0,4) / Zwykły / Miękki (×1,6) jako `--shape` w `--radius` i `--r-*` (`src/lib/shape.ts`, `src/styles/shape.css`). Odstępstwo: Plan i Matryca nie są wyłączone z wyboru — żadna skórka nie nadpisywała promieni, więc „ostre z charakteru” byłoby nową zmianą projektu; kształt działa jednakowo we wszystkich.
- **3.2 zrobione.** Miniatura z pigułką przycisku w zapamiętanym akcencie stylu i znaczkami schematu oraz ruchomego tła; sekcja nazwana „Galeria stylów” (wcześniej dublowała nazwę grupy).
- **3.4 zrobione.** Wygląd w grupach Styl / Tekst / Układ / Ruch z przyklejonym paskiem skoku; nagłówki h3 → h4 w grupach; axe bez naruszeń w Zeszycie, Neonie, Miedzi i Matrycy (okno Ustawień, telefon); cele 44 px.
- **2.6 zrobione.** Ikona karty w barwach stylu (`src/lib/skinFavicon.ts`, kolory `SKIN_ICON` w `skinList.ts`); Zeszyt zostaje przy pliku marki.
- **1.3 zrobione.** Ustawienia → Wygląd → „Tło”: Pełne / Ciche / Gładkie (`src/lib/backdrop.ts`, `src/styles/backdrop.css`). M-4 zrealizowane częściowo: „auto” daje ciche tylko przy `saveData`; Battery API pominięte (brak w Safari i Firefoksie, wynik asynchroniczny, mała wartość).

### Status Fazy 2 (2026-10-27)

- **2.1 zrobione.** Zapis: pieczątka w Zeszycie, linia wymiarowa w Planie, mrugnięcie poświaty w Neonie (wszystko w `.sig-layer`, obecnej teraz w każdym stylu). Zamiast „tabliczki, która mruga datą” w Planie — linia wymiarowa, bo tabliczka jest tylko na komputerze.
- **2.2 zrobione.** Patyna na kaflach Miedzi nieruszanych od 30 dni (`data-aged`); w Hydraulice zamiast „złączki przy nagłówku grupy” dwie śrubki obejmy na każdym kaflu (nagłówki grup nie mają wspólnego elementu, a kafel jest wszędzie).
- **2.3 zrobione.** Zmiana widoku: skan w Planie, przygaśnięcie w Neonie, odblask w Miedzi, przepływ w Hydraulice.
- **2.4 zrobione.** Własny kształt odsłonięcia przy zmianie na Plan, Miedź, Matrycę i Hydraulikę (`revealClip`).
- **Przy okazji naprawione:** fala zapisu Zorzy była niewidoczna (zduplikowana nazwa `@keyframes`); nowy strażnik w `skinContract.test.ts`.
- **2.5 zrobione.** Sygnatura dnia na Dziś we wszystkich siedmiu stylach (`DaySignature.tsx`, `daySignature.ts`). Odstępstwo: Zorza bez godziny zachodu (bez lokalizacji byłaby zgadywana) — sama faza Księżyca.

## Faza 1: personalizacja w obrębie skórki

Dziś skórka to całość albo nic. Trzy pokrętła dają dużo różnorodności bez nowych skórek, a dzięki OKLCH i tokenom promieni są tanie.

| # | Co | Jak | W | N |
|---|----|-----|---|---|
| 1.1 | **Kolor akcentu.** W każdej skórce 4–5 przygotowanych odcieni (np. Zeszyt: bursztyn, niebieski długopis, zieleń, czerwony długopis; Neon: róż, błękit, żółć). Pierwszy = dzisiejszy. Zmienia tylko odcień (`h`) i ewentualnie nasycenie `--primary` przez względną składnię OKLCH; jasność zostaje, więc kontrast AA się nie psuje. Klucz `kaczy.accent.v1` jako mapa skórka → odcień (każda skórka pamięta swój). | `src/lib/accent.ts`, `data-accent` na `<html>`, `src/styles/accent.css` | 3 | M |
| 1.2 | **Kształt.** Trzy kroki: „Ostry” (×0,4), „Zwykły” (×1), „Miękki” (×1,6) jako mnożnik `--radius`. Plan i Matryca zostają ostre niezależnie od wyboru (charakter skórki), co opisuje podpowiedź przy ustawieniu. | `data-shape`, `src/lib/shape.ts` | 2 | S |
| 1.3 | **Tło: pełne / ciche / gładkie.** „Ciche” zatrzymuje ruch tła (deszcz, woda, zorza, bąbelki) i przyciemnia ornament o połowę; „gładkie” zostawia sam kolor. Niezależne od „Ruch i animacje”, bo ktoś chce animacji przycisków, ale nie ruchomego tła przy czytaniu. Domyślnie „pełne” na komputerze, „ciche” na telefonie przy włączonym oszczędzaniu danych (`saveData`). | `data-backdrop`, `PaperBackdrop.tsx`, `MatrixRain.tsx` | 3 | S |
| 1.4 | **Skórka na noc.** Para skórek: dzienna i nocna (np. Zeszyt jasny w dzień, Zorza wieczorem). Przełącza o stałej godzinie albo razem z systemowym trybem ciemnym. Zastępuje ręczne przełączanie i dopełnia punkt „jasność bez cichej zmiany stylu” z planu powłoki (`docs/plan-powloka-2026-10-25.md`): zmiana jest jawna, bo użytkownik sam ustawił parę. | `src/lib/skinSchedule.ts`, sekcja „Styl” w `AppearanceSettings.tsx` | 2 | M |
| 1.5 | **Kontrast w teście.** `skinContrast.test.ts` sprawdza każdą parę skórka × akcent × schemat: tekst na przycisku głównym 4,5:1, ikony działów i pierścień fokusu 3:1. Odcień, który nie przechodzi, nie trafia do listy. | `src/lib/skinContrast.test.ts` | 2 | S |

## Faza 2: równe sygnatury i jeden moment „wow” na skórkę

Celem nie jest więcej efektów, tylko wypełnienie luk z tabeli tak, żeby każda skórka miała ten sam zestaw momentów: tło, kafel, nagłówek, zapis, zmiana widoku, wejście skórki. Każdy efekt krótki, jednorazowy, z tym samym stanem końcowym przy ograniczonym ruchu.

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Zapis tam, gdzie go brak.** Zeszyt: odcisk pieczątki „zapisano” z lekkim obrotem, gaśnie. Plan: tabliczka rysunkowa w rogu kafla mruga nową datą. Neon: krótkie „bzyknięcie” jasności rurki. Wszystko przez istniejący `html[data-sig="save"]` (`src/lib/skinSignal.ts`). | 2 | S |
| 2.2 | **Kafel w Miedzi i Hydraulice.** Miedź: patyna (zielonkawy nalot) na krawędzi kafli starszych niż 30 dni, z tego samego pola daty co dziś. Hydraulika: złączka (mufa) na łączeniu kafla z nagłówkiem grupy. Statyczne, tylko CSS. | 2 | S |
| 2.3 | **Zmiana widoku w Planie, Neonie, Miedzi i Hydraulice.** Plan: kreska wymiarowa przebiega przez szerokość. Neon: przygaśnięcie i ponowne zapalenie. Miedź: odblask przesuwa się po nagłówku. Hydraulika: przepływ w jednej rurze. Przez istniejący `data-sig="view"`. | 1 | S |
| 2.4 | **Wejście skórki dla pięciu pozostałych.** Zamiast wspólnego koła: Plan rozwija się jak arkusz od lewej, Miedź „nagrzewa się” od rury, Matryca spływa deszczem, Hydraulika napełnia się od dołu, Zeszyt zostaje przy kole (jest neutralny). View Transitions z fallbackiem na dzisiejsze koło. | 2 | M |
| 2.5 | **Nagłówek Dziś w barwach skórki (sygnatura dnia).** Jeden element na skórkę, w miejscu daty na Dziś: Zeszyt — data pisana jak długopisem na marginesie; Plan — tabliczka rysunkowa (Arkusz, Data, Skala 1:1, numer tygodnia); Neon — szyld z nazwą dnia; Zorza — faza księżyca i godzina zachodu (liczone lokalnie, bez sieci); Miedź — tabliczka znamionowa wybita w metalu; Matryca — wiersz terminala z kursorem; Hydraulika — manometr, którego wskazówka pokazuje, ile dnia minęło. Komponent leniwy, jeden plik na skórkę, treść to te same dane co dziś (data, tydzień, zmiana z Grafiku). | 3 | M |
| 2.6 | **Logo i ikona karty w barwach skórki.** Monogram „N” w nagłówku już jest; do tego favicon podmieniany przy zmianie skórki (SVG w data URI z kolorami z `SKIN_META.preview`). Ikona PWA na ekranie głównym zostaje jedna (manifest jest statyczny). | 1 | S |

## Faza 3: galeria i przełączanie

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Przymierz.** Stuknięcie w miniaturę ustawia skórkę od razu, z dymkiem „Styl: Neon · Cofnij” (wzorzec cofania z planu 25.10, 3.1). Bez osobnego trybu podglądu: cała aplikacja jest podglądem. | 3 | S |
| 3.2 | **Miniatura jako scena.** Dziś miniatura to kolory i „Aa”. Zamiast tego mała makieta: tło skórki, jeden kafel, przycisk główny, w jej własnym kroju i promieniu, plus znaczki „jasny/ciemny”, „ruchome tło”. Wybrany akcent (1.1) widać na miniaturze. | 2 | M |
| 3.3 | **Styl z palety poleceń.** „Styl: …” dla każdej skórki i „Następny styl” w palecie; akcent i tło jako podpolecenia. | 2 | S |
| 3.4 | **Ustawienia wyglądu w jednym miejscu.** Sekcja „Wygląd” ma dziś 14 sekcji. Podział na „Styl” (skórka, akcent, kształt, tło, noc), „Tekst” (krój, rozmiar), „Układ” (siatka, gęstość, kolumny, pasek) i „Ruch” (animacje, efekty). Bez zmiany kluczy localStorage. | 2 | S |
| 3.5 | **Eksport i import wyglądu.** Skórka, akcent, kształt, tło, krój i rozmiar jako krótki kod (np. `N1-zorza-3-m-c-literata-110`) do skopiowania na drugie urządzenie albo do kopii zapasowej w sekcji „Ustawienia”. Dane wyglądu nie trafiają do Yjs. | 1 | S |

## Faza 4: nowe skórki i drugie schematy (po decyzjach M-1 i M-2)

Dziś pięć z siedmiu skórek jest ciemnych. Brakuje jasnych skórek i skórki do pracy w słońcu.

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Drugi schemat dla każdej skórki (M-2: wszystkie).** Plan jasny jako odbitka ozalidowa (granatowe linie na lekko niebieskawym papierze); Hydraulika jasna jako biała armatura z chromem; Miedź ciemna jako warsztat nocą (miedź w świetle lampy na grafitowym betonie); Neon jasny jako szyld za dnia (wyłączone rurki na jasnym tynku, kolor tylko w akcentach); Zorza jasna jako świt (blady róż i błękit, bez gwiazd); Matryca jasna jako wydruk z drukarki igłowej (zielony papier w pasy, czarny tusz). `SKIN_SCHEME` zmienia się z jednej wartości na `{ default }` + oba zestawy tokenów; przełącznik jasności działa w każdej skórce, a domyślny schemat zostaje dzisiejszy, więc nic się nie zmienia bez akcji użytkownika. Kontrakt tokenów (0.2) sprawdza oba schematy. | 3 | L |
| 4.2 | **Nowa skórka „Kafle”.** Łazienka po robocie: białe szkliwione płytki 15×15 z szarą fugą jako tło, akcent kobaltowy, kafel notatki jak płytka z połyskiem w rogu. Sygnatura zapisu: płytka „dosiada” z lekkim kliknięciem. Jasna, z wariantem ciemnym (grafitowy gres). Krój nagłówków do doboru przy realizacji, tylko leniwie. | 2 | M |
| 4.3 | **Nowa skórka „Odblask”.** Do pracy na budowie w słońcu: tło w kolorze kamizelki, tekst czarny, kontrast co najmniej 7:1 (AAA), żadnego ruchu ani przezroczystości, pasy ostrzegawcze tylko na górnej krawędzi. Łączy się z „Trybem budowa”: propozycja włączenia przy wyborze. | 3 | M |
| 4.5 | **Nowa skórka „Tablica”** (dodatkowa, M-1). Jasna: biała tablica suchościeralna, aluminiowa rama jako krawędź paska, tekst i akcenty w kolorach markerów (niebieski, czerwony, zielony), ślad niedokładnie startej treści jako ornament tła. Ciemna: zielona tablica szkolna z kredą, smugi po gąbce. Sygnatura zapisu: krótkie „dopisanie” podkreślenia markerem; zmiana widoku: przetarcie gąbką. Pasuje do Nauki w Pracy (quiz, tablica pytań). | 2 | M |
| 4.4 | **Dopracowanie ciemnego Zeszytu.** Kratka i długopis po ciemnej stronie dziś to odwrócone kolory. Zamiast tego zeszyt pod lampką: ciepła plama światła u góry, kratka ledwo widoczna, długopis w kolorze żelowym. | 2 | S |

Każda nowa skórka: kontrakt tokenów (0.2), kontrast (1.5), sygnatury z Fazy 2, zrzuty i axe (lista z 0.3 dodaje je sama).

## Faza 5: QA i zamknięcie

- Zrzuty `npm run test:visual` odnowione i przejrzane skórka po skórce (także nowe akcenty w wariancie domyślnym).
- axe bez błędów we wszystkich skórkach i schematach; `skinContrast.test.ts` dla wszystkich akcentów.
- Czas klatki tła na `pixel-7` (z 0.5) nie gorszy niż przed planem; „ciche tło” wyraźnie tańsze.
- Próg paczki bez podnoszenia: nowe skórki i sygnatury dnia w leniwych chunkach.
- Ręczne QA na telefonie: każda skórka w słońcu i w nocy (szczególnie „Odblask”), przełączanie nocne (1.4).

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| M-1 | Które nowe skórki (4.2 Kafle, 4.3 Odblask)? | **Zdecydowane (2026-10-27):** obie plus jedna dodatkowa — wybrana „Tablica” (4.5). |
| M-2 | Które skórki dostają drugi schemat (4.1)? | **Zdecydowane (2026-10-27):** wszystkie. |
| M-3 | Akcent (1.1): ile odcieni i czy pamiętany osobno w każdej skórce? | 4–5 odcieni na skórkę, pamiętane osobno. Wspólny akcent dla wszystkich skórek dałby obce kolory (np. bursztyn w Matrycy). |
| M-4 | Domyślne „ciche tło” na telefonie (1.3)? | Tylko przy `saveData` lub niskiej baterii (Battery API tam, gdzie jest). Poza tym „pełne”, żeby skórki nie straciły charakteru. |

## Odrzucone

- **Dźwięki skórek** (szum neonu, skrobanie długopisu): nowe pliki audio, ryzyko irytacji, mały zysk.
- **Własny edytor kolorów (dowolny HEX):** łatwo zepsuć kontrast; przygotowane odcienie (1.1) dają wybór bez tego ryzyka.
- **Skórka per dział** (np. Praca zawsze w Hydraulice): rozbija spójność i komplikuje przejścia między działami.
- **Skórki tylko ciemne** („Szkicownik nocą”): po M-2 każda skórka ma oba schematy, więc nowa skórka też musi mieć oba.

## Kolejność wdrażania

1. Faza 0: 0.1–0.5 (0.6 tylko po pomiarze).
2. Szybkie wygrane: 3.1, 3.3, 1.3, 1.2, 2.6.
3. Akcent: 1.5 (test), potem 1.1; dalej 3.2 i 3.4 (galeria pokazuje nowe pokrętła).
4. Sygnatury: 2.1–2.3, potem 2.4 i 2.5.
5. Faza 4: 4.4, 4.1 (skórka po skórce), 4.3, 4.2, 4.5.
6. 1.4 (skórka na noc), 3.5 (kod wyglądu).
7. Faza 5.

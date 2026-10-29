# Plan: Praca na co dzień dla hydraulika (2026-10-29)

> **Status (2026-10-29):** H0.3 zrobione (`a213bed`: test „dzień hydraulika”, kształtki 5 stuknięć zamiast ≤ 3). H0.1 zrobione (`399da86`), przy okazji naprawione dwa błędy usterek: zdjęcia po naprawie poza ochroną przed sprzątaniem i kasowanie pól usterki przy poprawce problemu. H0.2 zrobione (`5af8473`, `4bb5de5`, `5b6ef3f`: `journalEntry.ts`, `studyDump.ts`, `studyProjection.ts`, `learnActions.ts`, `journalActions.ts`, `siteActions.ts`; paczka +44 B). Zostaje H0.4 (tydzień obserwacji — po stronie właściciela). H1.1 zrobione (`8db0c66`, `9710e5d`, `7ff1491`, `4f3482b`) bez dyktowania rur. H4.1 zrobione. H1.5 zrobione (kształtki 4 stuknięcia). H1.2 zrobione (zestawy). H2.1 zrobione, H2.2 częściowo (licznik w karcie; bez wiersza na Dziś). H2.3 zrobione (zdjęcie punktu). H2.4 i H2.2 zrobione (punkty w protokole; linia w karcie „Przed wejściem”). H3.1 zrobione (panel „Rozliczenie”, mapa `studyBilling`; H-4 podjęta: stawka na typ z domyślną). Dalej: H3.2 (panel należności, zaliczki). Punkty z planu 27.10, które nadal są otwarte (P0.1, P2.4, P2.11, P3.3, P6.3), są tu wpięte w fale.

## Kontekst

Właściciel to instalator wod-kan i używa Pracy codziennie. Dział ma już dużo funkcji: dziennik z dyktowaniem i zdjęciami, karty budów (etapy, braki, zamówienia, usterki, dokumenty, serwis), protokół i raport w PDF, godziny i stawkę, Naukę z quizem. Ten plan nie powtarza tego, co jest. Dotyczy luk, które właściciel wskazał 2026-10-29:

| Pytanie | Odpowiedź |
|---|---|
| Jak jesteś rozliczany? | **Wszystko naraz:** godzinowo, od punktu, ryczałt za budowę lub etap, własne zlecenia (fuchy). |
| Co spowalnia albo czego brakuje? | **Metry rur**, **materiał w aucie**, **punkty w pomieszczeniach**, **zdjęcia z aparatu**. |
| Czy ktoś jeszcze powinien widzieć budowę? | **Tak, pomocnik lub brygada.** |

Co jest w kodzie dziś (sprawdzone na `8f96bb0`):

- **Kształtki** to `Fitting { name, qty }` (`src/lib/study/fittings.ts:7`). Starsza wersja przycina `qty` przez `Math.floor`, a wartości poniżej 1 odrzuca (`fittings.ts:36-37`). Gdyby „24,5 m” trafiło do `fittings`, starsza wersja zapisałaby je jako „24 szt.”, dlatego metry idą do nowego pola (1.1).
- **Rozliczenie** zna tylko godziny i stawkę (`SiteCard.rate`, `siteTime.ts`). Nie ma punktów, ryczałtu, zaliczek ani zleceń.
- **Udostępnione zdjęcia** z aparatu lub galerii zawsze tworzą notatkę (`src/hooks/useLaunchIntents.ts:55`). Do wpisu z budowy nie trafiają.
- **Synchronizacja** obejmuje cały dokument notatek z jednym kodem grupy (`yjsSync.ts`). Podanie kodu pomocnikowi dałoby mu wszystkie notatki. Przekaźnik działa tylko lokalnie (decyzja 2026-10-23), a WebRTC bez TURN zawodzi w części sieci komórkowych.
- **Ściąga wysokości** ma standard G-HEAT (`HeightsSheet.tsx`). Karta budowy nie ma listy punktów ani pomieszczeń.
- **Limity paczki:** startowa paczka ma ~1 KB zapasu do progu 394 KB, precache ma 3,9 MiB (na granicy). `yStudy.ts` (832 linie) jest w paczce startowej.

## Zasady

1. **Telefon, rękawice, słaby zasięg.** Codzienne czynności (zdjęcie do wpisu, metry, odhaczenie punktu, brak do zamówienia, raport) mieszczą się w 3 stuknięciach. Całość działa offline.
2. **Dane w Yjs, każda pozycja pod własnym kluczem.** Dwa telefony (albo Ty i pomocnik) scalają się bez strat. Każda nowa lista ma test scalania dwóch dokumentów i test kopii (`fullBackup.test.ts`).
3. **Nowe pola zamiast zmiany starych.** Starsza wersja pomija nieznane pole i nie psuje danych (ten sam wzór co próba i kształtki).
4. **Pieniądze zostają przy Tobie.** Stawki, rozliczenia i fuchy nie trafiają do pomocnika ani do wspólnej budowy.
5. **Nowy kod tylko w leniwych chunkach.** Nic nie dochodzi do paczki startowej. Rzadko używane chunki trafiają do `globIgnores`.
6. **Kolejność w punkcie:** test → kod → `opis.md` → `simplify` + `code-review` → commit.

Oznaczenia: **W** to wartość dla codziennej pracy (1–3), **N** to nakład (S, M, L). Numeracja ma przedrostek **H**.

---

## Fala 0: fundament (przed nowymi funkcjami)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| H0.1 | **Rysunek nie niszczy zdjęcia** (P0.1 z 27.10, otwarte). Oryginał zostaje w `imageStore`, a „Cofnij rysunek” go przywraca. Trzeba to zrobić przed importem zdjęć (Fala 4), bo potem zdjęć będzie dużo więcej. | `useJournalPhotoEdits.ts`, `yStudy.ts` | 3 | M |
| H0.2 | **Podział `yStudy.ts` i `store.ts`** (P6.3) na dziennik, karty i naukę, z jednym punktem wejścia. Nowe mapy (punkty, auto, zestawy, zlecenia) idą do osobnych modułów ładowanych leniwie, nie do paczki startowej. Najpierw agent `architect`. | `src/lib/study/` | 2 | M |
| H0.3 | **Test „dzień hydraulika”** (`e2e/workday.spec.ts`, `@mobile`): wejście na budowę, zdjęcie, kształtki, brak, odhaczony etap, godziny, raport do szefa. Test liczy stuknięcia w każdym kroku i pilnuje celu „≤ 3”. Chroni codzienną ścieżkę przy każdej fali. | `e2e/` | 3 | S |
| H0.4 | **Tydzień obserwacji na telefonie** (P3.3): przez tydzień pracy zapisujesz w Skrzynce z etykietą `#praca-uwagi` wszystko, co przeszkadza. Na koniec tygodnia z listy powstają poprawki w tej fali, przed Falą 1. | Skrzynka | 3 | S |

## Fala 1: materiał (metry rur, zestawy, auto)

| # | Co | W | N |
|---|----|---|---|
| H1.1 | **Rury w metrach.** Nowe pole wpisu `pipes: { name, cm }[]` (całe centymetry, czyli dokładność do 0,01 m bez ułamków w danych). W arkuszu „Dodaj rury”: pigułki średnic (16×2, 20×2, 26×3, 32×3, 50, 110), pole metrów z przecinkiem („24,5”). Dyktowanie: „rura szesnaście, dwadzieścia cztery i pół metra”. Rury są w raporcie, zamówieniu („Rura PEX 16×2: 50 m”), zużyciu materiału (cena zł/m) i CSV. Starsza wersja pomija pole i nie przekłamuje sztuk. | 3 | M |
| H1.2 | **Zestawy (kity).** Własne zestawy, np. „Podejście umywalki” = 2× kolanko ścienne 16×½, 1× trójnik 16, 1,5 m rury 16×2. Jedno stuknięcie dopisuje cały zestaw do wpisu, a ilości można poprawić. Zestawy są w Yjs, więc są na wszystkich telefonach. Start z kilkoma gotowymi zestawami do edycji. | 3 | M |
| H1.3 | **Materiał w aucie.** Lista pozycji z ilością, jednostką i minimum. Stan liczony z historii, bez ręcznego odejmowania: ostatnia inwentaryzacja + przyjęcia − zużycie z wpisów po dacie inwentaryzacji. Dwa telefony nie nadpisują sobie stanu, bo każde zdarzenie ma własny klucz. „Do dokupienia” to pozycje poniżej minimum. Wpis ma przełącznik „z auta / dostawa na budowę” (domyślny według decyzji H-1). | 3 | M |
| H1.4 | **Jedna lista do hurtowni.** Braki budowy, „Do zamówienia” i braki w aucie razem, w grupach (na budowę X, do auta). Jedna wiadomość WhatsApp na numer hurtowni (`supplierOrderText`). „Oznacz jako zamówione” działa dla wszystkich grup naraz, z „Cofnij”. | 2 | S |
| H1.5 | **Katalog systemów.** Pigułki według systemu: PEX/PE-RT zaprasowywany, PP zgrzewany, miedź, PVC/PP kanalizacja. Średnice tylko w obrębie wybranego systemu. Nazwy zawsze tak samo zapisane, więc sumy i ceny się zgadzają. Ostatnio używane są na początku. | 2 | S |

## Fala 2: punkty w pomieszczeniach

| # | Co | W | N |
|---|----|---|---|
| H2.1 | **Pomieszczenia i punkty w karcie budowy.** Pomieszczenie (Łazienka parter, Kuchnia, Kotłownia) zawiera punkty: typ (umywalka, WC podwieszane, WC kompakt, prysznic, odpływ liniowy, wanna, zlew, zmywarka, pralka, zawór ogrodowy, kocioł, inny), strona (woda zimna / ciepła / kanalizacja), wysokość (startowo ze standardu G-HEAT z `HeightsSheet`) i stan: *podejście → próba → biały montaż*. Szablon „Łazienka standard” dodaje typowe punkty jednym stuknięciem. Dane w nowych rodzajach listy karty (`room`, `point` w `siteItems.ts`). | 3 | L |
| H2.2 | **Licznik punktów** na pasku karty („Punkty 10/14”) i postęp każdego pomieszczenia. Odhaczenie punktu: jedno stuknięcie, z „Cofnij”. Na Dziś: „Lipowa: 4 punkty do podejścia”. | 3 | S |
| H2.3 | **Zdjęcie punktu.** Z punktu „Zdjęcie” otwiera aparat. Wpis dostaje odnośnik do punktu i podpis „Łazienka parter · umywalka · 55 cm” (podpis jako dane, wzór z P-1). Na punkcie miniatura ostatniego zdjęcia. Odpowiada na pytanie „gdzie idzie rura pod płytkami”. | 3 | M |
| H2.4 | **Punkty w protokole i PDF:** tabela pomieszczeń i punktów z wysokościami i datą próby, a przy punkcie zdjęcie „przed zakryciem”. Inwestor dostaje mapę instalacji. | 2 | S |
| H2.5 | **Lista materiału z punktów (szacunek).** Każdy typ punktu ma przypisany zestaw (H1.2), więc z listy punktów wychodzi szacunek kształtek na całą budowę, zanim zaczniesz. „Do zamówienia na start” trafia na listę do hurtowni (H1.4). | 2 | M |

## Fala 3: rozliczenia (godziny, punkty, ryczałt, fuchy)

| # | Co | W | N |
|---|----|---|---|
| H3.1 | **Sposób rozliczenia budowy** w karcie: godziny (jest), od punktu (jedna stawka albo stawka na typ punktu, decyzja H-4), ryczałt (kwota za całość albo za etap). Można łączyć sposoby, np. ryczałt i dopłata za godziny. Pole `billing` w karcie, tylko w Twoim dokumencie (zasada 4). | 3 | M |
| H3.2 | **Panel „Rozliczenie”:** naliczone (godziny × stawka, zrobione punkty × stawka, odhaczone etapy × kwota etapu), otrzymane (zaliczki i wypłaty z datą) i „Zostało do zapłaty”. Wysyłka szefowi jako tekst WhatsApp, PDF albo CSV. Liczenie w czystej funkcji (`lib/study/billing.ts`) z tabelą przypadków w Vitest. | 3 | M |
| H3.3 | **Miesiąc razem:** w podsumowaniu Grafiku osobna linia „Z budów (punkty, ryczałt)” obok zarobku z godzin, bez liczenia godzin dwa razy. | 2 | S |
| H3.4 | **Zlecenia własne (fuchy).** Lekka karta, `SiteCard.kind = "job"`, z tymi samymi wpisami, zdjęciami, materiałem i godzinami. Szybkie założenie: klient, telefon, adres, co zrobić. **Wycena:** pozycje robocizny i materiału (z marżą %), PDF „Wycena”. **Statusy:** wycena → umówione (termin w Kalendarzu) → zrobione → zapłacone. Lista „Zlecenia” z sumą „Niezapłacone: 1 250 zł”. Faktury są poza zakresem (decyzja H-3). | 3 | L |
| H3.5 | **Potwierdzenie wykonania z podpisem klienta** (P2.4 z 27.10). Podpis z `DrawingCanvas` na protokole i potwierdzeniu fuchy, z datą i imieniem. Przed zrobieniem przegląd `security-reviewer`, bo dane osobowe trafiają do kopii i ZIP. | 2 | S |
| H3.6 | **„Dla szefa” i „Moje”:** raporty, statystyki i CSV rozdzielają budowy pracodawcy od własnych zleceń. Raport do szefa nigdy nie pokazuje fuch. | 2 | S |

## Fala 4: zdjęcia z aparatu

| # | Co | W | N |
|---|----|---|---|
| H4.1 | **Udostępnij → „Wpis z budowy”.** Gdy udostępniasz zdjęcia z aparatu lub galerii do aplikacji, okno pyta: „Notatka” czy „Wpis z budowy”. Przy wpisie podpowiada budowę (najbliższą z lokalizacji, dzisiejsze wejście, ostatnią). Przy więcej niż 5 zdjęciach dzieli je na kolejne wpisy. Używa obecnej skrzynki service workera (`sw-share.js`, `useLaunchIntents.ts`). | 3 | S |
| H4.2 | **Najpierw próba na telefonie:** czy Chrome na Androidzie przekazuje EXIF (czas zrobienia i GPS) przy udostępnianiu i wyborze z galerii. Android potrafi usuwać GPS z plików. Od wyniku zależy H4.3. | 2 | S |
| H4.3 | **Zdjęcia z dnia (import).** Wybierasz zdjęcia z galerii. Aplikacja czyta czas zrobienia (EXIF `DateTimeOriginal`) i, jeśli jest, GPS. Grupuje zdjęcia w wpisy według przerw w czasie i budowy (GPS albo godziny na budowach z tego dnia). Podgląd „3 wpisy: Lipowa 7:40–9:10 (6 zdjęć) …” i zatwierdzenie. Wpis dostaje godzinę zdjęcia, nie godzinę importu. Odczyt EXIF w Workerze, własny parser albo mała biblioteka (decyzja H-8, przegląd `performance-engineer`). | 3 | M |
| H4.4 | **Przypisanie do punktu i etapu przy imporcie** (po Fali 2): przy grupie zdjęć pigułki punktów i etapów tej budowy. | 2 | S |

## Fala 5: brygada

| # | Co | W | N |
|---|----|---|---|
| H5.1 | **Autor przy wpisie i pozycji.** Pole `by` (nazwa osoby) przy wpisach, brakach, punktach i godzinach. Na osi „Marek, 9:40”. Bez tego przy wspólnej budowie nie wiadomo, kto co zrobił. | 2 | S |
| H5.2 | **Paczka budowy do wymiany, bez serwera.** „Wyślij budowę” tworzy plik (`.budowa`: dane budowy, wpisy, listy i opcjonalnie zdjęcia), który idzie przez WhatsApp. „Wczytaj budowę” scala go po kluczach pozycji, nowsza zmiana wygrywa. Pomocnik odsyła swój plik, a Ty go wczytujesz. Działa offline i bez hostingu. Plik od innej osoby to niezaufane dane: walidacja przez `clean*`, limity rozmiaru, przegląd `security-reviewer`. Ograniczenie: usunięcia nie przechodzą w pliku (albo przechodzą jako znaczniki usunięcia, decyzja przy projekcie). Pieniądze nie wchodzą do pliku. | 3 | M |
| H5.3 | **Wspólna budowa na żywo.** Osobny dokument Yjs dla jednej budowy, z własnym kodem pokoju. Pomocnik dostaje tylko tę budowę, nie Twoje notatki. Można mu odebrać dostęp (nowy klucz pokoju). Wymaga: agenta `architect` (granica dokument budowy / dokument główny, migracja danych budowy), `security-reviewer` (klucze per budowa, odebranie dostępu) i **decyzji H-6** (hosting przekaźnika). Bez hostingu działa tylko wtedy, gdy oba telefony złapią WebRTC. | 3 | L |
| H5.4 | **Widok pomocnika:** bez stawek, rozliczeń, fuch i kontaktów do inwestora (decyzja H-7). Ma etapy, punkty, braki, plan na dziś i wpisy. | 2 | S |

## Fala 6: drobne usprawnienia w terenie

| # | Co | W | N |
|---|----|---|---|
| H6.1 | **Dyktowanie bez internetu:** próba rozpoznawania mowy na urządzeniu w Chrome (`SpeechRecognition` z przetwarzaniem lokalnym, jeśli telefon je ma). Bez wsparcia zostaje obecne dyktowanie. Najpierw sprawdzenie na Twoim telefonie. | 2 | S |
| H6.2 | **Nagranie i dyktowanie naraz** (P2.11 z 27.10): zostaje próbą na telefonie. Jeśli mikrofon nie da się obu naraz, punkt odpada. | 1 | M |
| H6.3 | **Ściągi:** cale ↔ DN ↔ mm (gwinty), średnice wewnętrzne popularnych rur (do kalkulatora pojemności), jednostki ciśnienia (bar, MPa, m H₂O). Każda liczba z podanym źródłem. Liczby normowe tylko z materiału G-HEAT albo z normy podanej przez Ciebie. | 2 | S |
| H6.4 | **Kalkulator wydłużenia cieplnego** rur (PEX, PP, PP stabilizowany, miedź) dla odcinka i różnicy temperatur, z podpowiedzią o kompensacji. Współczynniki ze źródła producenta (do potwierdzenia przed wdrożeniem). | 1 | S |

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| H-1 | Materiał z wpisu schodzi domyślnie „z auta” czy „dostawa na budowę”? | **Z auta.** Przełącznik w wpisie, a karta budowy pamięta ostatni wybór, bo na dużej budowie materiał zwykle przychodzi z hurtowni. |
| H-2 | Dokładność metrów rury? | **0,1 m w polu, centymetry w danych.** Bez ułamków w danych. |
| H-3 | Jakie dokumenty dla fuch? | **Wycena i potwierdzenie wykonania (PDF).** Bez faktur: faktury idą przez KSeF i program księgowy. Zostaje CSV dla księgowej. |
| H-4 | Stawka od punktu: jedna czy na typ punktu? | **Podjęta 2026-10-29: na typ, z jedną stawką domyślną.** WC podwieszane i odpływ liniowy zwykle kosztują więcej. |
| H-5 | Podnieść limit 5 zdjęć na wpis? | **Nie.** Import i udostępnianie dzielą zdjęcia na wpisy. Wyższy limit to zmiana formatu dla starszych wersji. |
| H-6 | Hosting przekaźnika dla brygady (H5.3)? | **Najpierw H5.2 (plik), bez hostingu.** Do H-6 wracamy, gdy plik nie wystarczy. Przekaźnik jest E2E, więc serwer nie widzi treści. |
| H-7 | Co widzi pomocnik? | **Etapy, punkty, braki, plan na dziś, wpisy i zdjęcia.** Bez pieniędzy, fuch i telefonów inwestora. |
| H-8 | EXIF: własny parser czy biblioteka? | **Własny parser** (czas i GPS z JPEG, kilkadziesiąt linii, test na zdjęciach z Twojego telefonu). Bez nowej zależności. HEIC z iPhone'a dopiero, gdy będzie potrzebny. |

## Kolejność wdrażania

1. **Fala 0:** H0.3 (test dnia) → H0.1 → H0.2 (`architect`) → H0.4 (tydzień obserwacji równolegle z Falą 1).
2. **Szybkie korzyści:** H1.1 (metry) → H4.1 (udostępnianie do wpisu) → H1.5 → H1.2.
3. **Punkty:** H2.1 → H2.2 → H2.3 → H2.4 (`frontend-design` przed H2.1).
4. **Rozliczenia:** H3.1 → H3.2 → H3.3 → H3.6 → H3.4 (po H-3) → H3.5 (po przeglądzie bezpieczeństwa).
5. **Auto i zamówienia:** H1.3 (po H-1) → H1.4 → H2.5.
6. **Zdjęcia z dnia:** H4.2 (próba) → H4.3 → H4.4.
7. **Brygada:** H5.1 → H5.2 → H5.4 → H5.3 (po H-6).
8. **Fala 6:** gdy będzie luka między falami, a H6.1 i H6.2 po próbie na telefonie.

## Agenci i skille

- `frontend-design` przed każdym nowym widokiem (punkty, rozliczenie, zlecenia, import zdjęć), potem `refactoring-ui` i `ux-heuristics`.
- `architect`: H0.2 i H5.3.
- `security-reviewer`: H3.4 (dane klientów), H3.5 (podpis), H5.2 (plik z zewnątrz), H5.3 (klucze per budowa).
- `performance-engineer`: H4.3 (Worker, EXIF) i każdy punkt, który rusza budżet paczki.
- `testing-engineer`: H0.3 i zrzuty nowych widoków z danymi.
- `design:accessibility-review` i `e2e/a11y.spec.ts` przed zamknięciem każdej fali.
- `simplify` i `code-review` na diffie przed commitem.

## Weryfikacja

- **Każdy punkt:** `npm run typecheck`, Vitest dla `src/lib/study/**`, celowany spec e2e, `e2e/bundle.spec.ts` przy nowym kodzie.
- **Nowe dane w Yjs:** test scalania dwóch dokumentów, test kopii i przywracania (`fullBackup.test.ts`), test starszej wersji (nieznane pole pominięte, nie przekłamane).
- **Codzienna ścieżka:** `e2e/workday.spec.ts` po każdej fali.
- **Telefon:** na koniec fali próba w prawdziwym dniu pracy, w rękawicach i na słońcu. Wynik trafia do `opis.md`.
- Pełne `test:e2e` tylko na końcu fali i na prośbę.

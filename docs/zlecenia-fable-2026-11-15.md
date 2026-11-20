# Wyniki zadań z audytu Fable i zlecenia dla Opus/Sonnet (2026-11-15)

> **Status:** przegląd przez czytanie kodu na `3cc066d6` plus zmiany robocze tej sesji (niezacommitowane). Zadania 1 i 4 mają poprawki w kodzie; reszta to ustalenia i gotowe zlecenia.
> **Podział pracy (decyzja właściciela):** Fable — plan, diagnoza, trudne poprawki. Testy i prace mechaniczne — Opus albo Sonnet. W tej sesji nie pisano ani nie uruchamiano testów poza zadaniem 1 (zrobione przed tą decyzją).
> **Oznaczenia pewności:** **[kod]** — wynika wprost z przeczytanego kodu; **[XSD]** — sprawdzone w schemie `crd.gov.pl/wzor/2025/06/25/13775/schemat.xsd` pobranej 2026-11-15; **[pamięć]** — z wiedzy własnej, do potwierdzenia u źródła; **[hipoteza]** — nieodtworzone.
> Spis zadań: `audyt-fable-2026-11-15.md`.

## Kolejność dla następnej sesji

1. Z-2.1 (lista faktur wywraca się na złym rekordzie) i Z-2.2 (walidacja przy odczycie) — małe, a chronią numerację.
2. Z-5.1 (limit wpisu przekaźnika) — zrobione w `67d9758b` razem z Z-5.2–Z-5.4. Drugi przegląd z 2026-11-16 znalazł nowe błędy: Z-5.5–Z-5.9 w zadaniu 5, zacząć od Z-5.5 i Z-5.6.
3. Testy do poprawek już zrobionych: Z-1.T, Z-4.T.
4. Z-10 (kroje offline), Z-6 (test-strażnik odśmiecania), Z-12, Z-11.
5. Decyzje właściciela są podjęte — tabela na końcu.

---

## Zadanie 1 — Grafik względem Kodeksu pracy (zrobione w kodzie)

Trzy poprawki w `src/lib/shifts/`:

- **Dodatek nocny** (`nightAllowance.ts`): 20% × (minimalne wynagrodzenie miesięczne ÷ godziny wymiaru danego miesiąca), osobno dla każdego miesiąca; wcześniej 20% minimalnej stawki godzinowej dla zleceń. Potwierdzone u źródła 2026-11-16: sposób liczenia to § 4b rozporządzenia MPiPS z 29.05.1996 r. (minimalne wynagrodzenie ÷ godziny przypadające do przepracowania w danym miesiącu); 4806 zł na 2026 r. — Dz.U. 2025 poz. 1242; dopisano 2027 r. — 4950 zł (rozporządzenie z 14.09.2026, numer pozycji Dz.U. niesprawdzony).
- **Norma przy nieobecności nad zmianą z grafiku** (`summary.ts`, `monthCore`): odejmuje się `plannedMin`, czyli godziny, które przypadały do przepracowania (art. 130 § 3) **[pamięć]**.
- **Odpoczynek tygodniowy** (`summary.ts`, `weeklyRestShort`): tygodnie to siedmiodniowe bloki od pierwszego dnia okresu rozliczeniowego (art. 128 § 3 pkt 2), nie od poniedziałku; wolne sprzed tygodnia się nie liczy.

**Z-1.T (Sonnet):** testy do tych trzech zmian są już w `nightAllowance.test.ts`, `weeklyRest.test.ts`, `shifts.test.ts` (260 testów w `src/lib/shifts` zielone). Do dopisania: przypadki wzorcowe z całego miesiąca policzone ręcznie (grafik 12-godzinny, równoważny), miesiąc z niepełnym etatem, okres rozliczeniowy 4 miesiące.

**Rozstrzygnięte 2026-11-16 (niepełny etat):** `nightRateFor` celowo bierze wymiar pełnego etatu. Przy niepełnym etacie minimalne wynagrodzenie maleje proporcjonalnie (art. 8 ust. 1 ustawy o minimalnym wynagrodzeniu) i tak samo maleje liczba godzin do przepracowania, więc stawka godzinowa jest ta sama. Test dla Z-1.T: dla `fte` 0,5 i 0,75 stawka w podsumowaniu miesiąca równa się stawce pełnego etatu (luty 2026 — 6,01 zł, lipiec 2026 — 5,22 zł, styczeń 2027 — 6,51 zł), a kwota dodatku zależy tylko od minut nocnych. Dzielnik to wymiar nominalny miesiąca, nie godziny z grafiku — w miesiącu 12-godzinnym z 168 h w grafiku przy wymiarze 160 h stawka liczy się od 160 h.

**Decyzja D-G1:** `ShiftSummary.tsx:116–118` pokazuje dodatek nocny tylko informacyjnie i nie dolicza go do zarobku; komentarz mówi, że pokrywa go dodatek 100%. To wątpliwe — dodatek nocny należy się niezależnie od dodatku za nadgodziny **[pamięć]**. Doliczać?

---

## Zadania 2 i 13 — KSeF Etap 1 (`src/lib/ksef/**`)

### Zadanie 13 rozstrzygnięte

Dokument `ksef-integracja-2026-11-11.md` (§1 pkt 8) myli się: pola P_13_x i P_14_x **nie są obowiązkowe** **[XSD]**. Stawki 1–5 to opcjonalne grupy (`P_13_n` z `P_14_n` razem), `P_13_6_1` i dalsze mają `minOccurs="0"`, obowiązkowe jest tylko `P_15`. Kod (`fa3.ts`, `summaries`) emituje tylko użyte stawki, w kolejności schemy — poprawnie. Pozostałe elementy `Fa`, `FaWiersz`, `Podmiot2` (`JST`, `GV` na końcu), `Platnosc` i wartość `0 KR` też zgadzają się ze schemą **[XSD]**. **Z-13 (Sonnet):** poprawić zdanie w dokumencie.

### Ustalenia

| # | Waga | Ustalenie | Dowód |
|---|---|---|---|
| F-1 | wysoka | **Jeden zły rekord wywraca całą listę faktur.** `cleanRecord` woła `validateInvoice(inv)` na danych z Yjs albo kopii. Sprawdza, że `lines` jest tablicą, ale nie jej elementy, i nie sprawdza `inv.number`. Element `null` albo brak `number` daje `TypeError` w `.trim()`. Wyjątek wychodzi z `all()`, a to jest `getSnapshot` w `useInvoices` — pada każdy widok z fakturami i `issueInvoice`. W `mergeDump` wyjątek przerywa import w połowie (Yjs nie cofa transakcji). | `yInvoices.ts` `cleanRecord`, `all`, `mergeDump`; `invoice.ts` `checkLines`, `validateInvoice` **[kod]** |
| F-2 | wysoka | **Walidacja biznesowa przy odczycie ukrywa faktury i psuje numerację.** `cleanRecord` odrzuca rekord, który nie przechodzi dzisiejszego `validateInvoice`. Każde zaostrzenie reguł (np. poprawki F-5, F-6) sprawi, że starsze faktury znikną z listy, a `nextInvoiceNumber` liczony z `all()` nada numer już użyty. | `yInvoices.ts`, `invoicesStore.ts:29` **[kod]** |
| F-3 | średnia | **Wyścig numeru.** Numer liczony przed `await sha256Hex`, zapis po nim. W jednej karcie chroni `busy` w oknie, ale faktura i korekta mają osobne okna, a druga karta nie ma żadnej ochrony. | `invoicesStore.ts:25–37` **[kod]** |
| F-4 | średnia | **Numer z ogona po zniknięciu rekordu.** Licznik to „największy + 1”. Gdy ostatnia faktura zniknie (usunięcie przez peera, ukrycie z F-2), numer zostanie nadany drugi raz, choć pierwsza faktura mogła trafić do klienta. | `numbering.ts` `nextInvoiceNumber` **[kod]** |
| F-5 | średnia | **Data spoza kalendarza przechodzi walidację.** `validDate` sprawdza wzorzec i `Date`, ale V8 przyjmuje „2026-02-31” i przesuwa na marzec **[pamięć]**. XML z taką datą nie przejdzie XSD. Termin płatności (`payment.dueDate`) nie jest walidowany wcale, a trafia do `Termin`. | `invoice.ts` `validDate`, `validateInvoice`; `fa3.ts` `payment` **[kod]** |
| F-6 | niska | **Brak limitów długości zgodnych ze schemą.** Jednostka (`P_8A`, do 256), nazwy stron i adresy (do 512) nie mają limitu w `validateInvoice`; `isParty` dopuszcza 600. | **[kod]**, **[XSD]** |
| F-7 | niska | **Limity liczb powyżej bezpiecznego zakresu.** `qtyMilli ≤ 1e12`, `unitPrice ≤ 1e13`; iloczyn przekracza 2⁵³ i traci grosze. Samo zaokrąglanie jest poprawne: przy stawkach 23/8/5 nie ma remisów w dzieleniu, a mnożenie trafia w połówki dokładnie. | `invoice.ts` `checkLines`, `computeLines` **[kod]** |
| F-8 | średnia | **Rok w numerze z zegara, nie z daty wystawienia.** `year = new Date(now).getFullYear()`. Dziś okna ustawiają datę wystawienia na dziś, więc się zgadza; przestanie przy pierwszej edytowalnej dacie. | `invoicesStore.ts:28` **[kod]** |
| F-9 | średnia | **Seria „A” domyślna na każdym urządzeniu.** Seria nie wchodzi do kopii; drugi telefon też startuje z „A”. Duplikat wykryje dopiero `findDuplicateNumbers` w oknie, po fakcie. Rekord nie niesie identyfikatora urządzenia, tylko serię. | `sellerPrefs.ts`, `numbering.ts` **[kod]** |
| F-10 | do sprawdzenia | **Numeracja wierszy korekty.** Kod numeruje wiersze „przed” i „po” ciągiem (1…n, n+1…). W przykładach MF wiersz „przed” i „po” mają ten sam `NrWierszaFa` **[pamięć]**. Schema dopuszcza oba. | `fa3.ts` `buildFa3Xml` |
| F-11 | do sprawdzenia | **Korekta do korekty** wskazuje w `DaneFaKorygowanej` poprzednią korektę. Według wyjaśnień MF kolejna korekta odnosi się do faktury pierwotnej **[pamięć]**. | `invoicesStore.ts` `issueCorrection` |
| F-12 | niska | Korekta bez żadnej zmiany pozycji przechodzi; data korekty wcześniejsza niż data oryginału też. | **[kod]** |
| F-13 | przyjęte | Niezmienność rekordu jest tylko lokalna: peer z dostępem do dokumentu może podmienić XML razem ze skrótem albo usunąć rekord. `verifyRecord` jest wołane tylko na żądanie w oknie. Do opisania w `opis.md` jako ograniczenie; prawdziwą ochronę da dopiero numer KSeF i UPO (Etap 2). | `yInvoices.ts` **[kod]** |

### Zlecenia

- **Z-2.1 (Sonnet, S).** `cleanRecord` nie może rzucać: strażniki typów dla `inv.number`, dat, `priceMode`, każdej pozycji (`name`, `unit` napisy; `qtyMilli`, `unitPrice` liczby całkowite; `rate` z listy), `payment`, plus `try/catch` wokół całości zwracający `null`. Zwracać obiekt złożony z pól znanych, nie surowe `inv`. Testy: rekord z `lines: [null]`, bez `number`, z `payment: 5`; `all()` zwraca pozostałe; `mergeDump` z jednym złym rekordem importuje resztę.
- **Z-2.2 (Opus, S/M).** Rozdzielić walidację: `validateInvoice` tylko przed wystawieniem; przy odczycie wyłącznie kontrola struktury (Z-2.1) i `r.number === inv.number`. Rekord, który nie przechodzi struktury, nie znika po cichu: `all()` zwraca go w osobnej liście „uszkodzone” z numerem (jeśli jest), a `nextInvoiceNumber` bierze numery ze **wszystkich** kluczy mapy, także uszkodzonych. Test: po zaostrzeniu reguły stara faktura dalej jest na liście i jej numer nie zostaje nadany ponownie.
- **Z-2.3 (Opus, S).** Wystawianie w sekcji krytycznej: `navigator.locks.request("notatnik-faktura", …)` (z zapasem na kolejkę obietnic w module, gdy `locks` nie ma), numer liczony wewnątrz, po `await` skrótu ponowne sprawdzenie, że numeru nie ma w mapie; `add` odmawia istniejącego numeru. Test: dwa `issueInvoice` bez `await` między nimi dają dwa różne numery.
- **Z-2.4 (Sonnet, S).** `validDate` z kontrolą w obie strony (`toISOString().slice(0,10) === s`); walidacja `payment.dueDate`; limity 256/512 z F-6; limity liczb tak, by `qtyMilli × unitPrice ≤ Number.MAX_SAFE_INTEGER`; odmowa korekty bez zmian. Wykonać **po** Z-2.2, inaczej zadziała F-2.
- **Z-2.5 (Sonnet, S).** Rok numeru z `issueDate` faktury.
- **Z-2.6 (Sonnet; D-K1 = identyfikator urządzenia).** Seria: losowy identyfikator urządzenia w rekordzie (`deviceId`) i ostrzeżenie przed wystawieniem, gdy w serii są faktury z innym identyfikatorem; albo brak domyślnej serii i obowiązek jej wpisania przed pierwszą fakturą.
- **Z-2.7 (Opus, z broszurą MF FA(3)).** Sprawdzić F-10 i F-11 w przykładach MF i poprawić albo opisać.

---

## Zadanie 3 — KSeF Etap 2: uwagi do projektu serwera (plan)

Projektu `ksef-server/` jeszcze nie ma; `ksef-integracja-2026-11-11.md` §2 opisuje go w trzech zdaniach. Fakty o API pochodzą z tamtego dokumentu, nie sprawdzano ich ponownie. Zanim powstanie kod, projekt musi odpowiedzieć na poniższe:

1. **Podwójna wysyłka.** KSeF wykrywa duplikat po NIP + rodzaj + numer (P_2). Serwer musi mieć własny, trwały stan na fakturę: `nowa → wysyłana(ref sesji) → przyjęta(nr KSeF, UPO) | odrzucona(kod)`, z kluczem idempotencji = SHA-256 XML-a. Ponowienie po przerwaniu zaczyna od zapytania o status, nigdy od ponownej wysyłki. Stan „wysyłana” bez odpowiedzi rozstrzyga wyłącznie zapytanie do KSeF.
2. **Kto jest źródłem prawdy o statusie.** Status w Yjs to tylko podgląd; klient pobiera go z serwera, a serwer z KSeF. Rekord w `studyInvoices` jest niezmienny, więc numer KSeF i UPO idą do osobnej mapy (`studyInvoiceStatus`: id → wpis), z regułą „przyjęta wygrywa z każdym innym stanem”.
3. **Zależność od F-2/F-3/F-4.** Zanim cokolwiek zostanie wysłane, numeracja musi być odporna (Z-2.2, Z-2.3). Duplikat numeru po stronie aplikacji oznacza odrzucenie w KSeF po fakcie.
4. **Dwa urządzenia wysyłają tę samą fakturę.** Serwer serializuje po skrócie; drugie żądanie dostaje bieżący stan.
5. **Tryb offline24.** Wymaga kodu QR II i certyfikatu typu Offline, czyli podpisu po stronie serwera, którego offline nie ma. Wniosek: w Etapie 2 bez offline24 — faktura wystawiona bez sieci czeka w kolejce jako „nie wysłana” i dostaje datę wystawienia z chwili wysyłki albo jest wysyłana w terminie zwykłym. To decyzja **D-K2**, bo zmienia, co wolno wręczyć klientowi na budowie.
6. **Data wystawienia a data wysyłki.** KSeF odrzuca fakturę z P_1 późniejszym niż dzień przyjęcia **[pamięć]**; aplikacja powinna ostrzegać o dacie z przyszłości już w Etapie 1.
7. **Sesja szyfrowana.** Klucz AES i IV na sesję generuje serwer, nie przeglądarka; klucz publiczny MF pobierany i przypinany z terminem ważności; sesja zamykana zawsze (także po błędzie), UPO pobierane w osobnym kroku z ponawianiem.
8. **Uwierzytelnienie aplikacji wobec serwera.** Serwer trzyma token KSeF, więc kto ma dostęp do serwera, wystawia faktury w imieniu firmy. Kod synchronizacji przekaźnika do tego nie wystarcza (zna go każde sparowane urządzenie). Potrzebny osobny sekret wpisywany ręcznie, limit żądań, lista dozwolonych NIP sprzedawcy = jeden.
9. **Walidacja po stronie serwera.** Serwer nie ufa XML-owi z aplikacji: sprawdza XSD, NIP sprzedawcy równy skonfigurowanemu, rozmiar, brak `DOCTYPE`.
10. **Środowisko.** `test` domyślnie, osobne magazyny stanu na środowisko, numer KSeF z testu nigdy nie trafia do rekordu produkcyjnego.

**Z-3 — plan napisany 2026-11-16 (Fable):** `docs/plan-ksef-etap2.md`, z maszyną stanów, tabelą błędów i faktami o API sprawdzonymi w dokumentacji MF. Sprawdzenie zmieniło uwagi 1, 5, 6 i 9 powyżej — obowiązuje plan (§1 planu wylicza różnice). Najważniejsze: KSeF sam oznacza fakturę jako offline, gdy `P_1` jest wcześniejsze niż dzień wysyłki, więc „czeka na wysyłkę” z D-K2 działa bez zastrzeżeń tylko tego samego dnia (nowa decyzja D-K3). Dalej: decyzje D-K3…D-K5, zlecenia E2.0–E2.6 z §12 planu, przegląd `security-reviewer` przed kodem.

---

## Zadanie 4 — `writeContent` bez zamontowanego edytora (poprawione w kodzie)

**Błąd [kod]:** w trybie wiązania z `Y.Text`, gdy edytor CM nie był zamontowany (podgląd, wczytywanie paczki), `writeContent` kasował całą treść i wstawiał nową, liczoną ze stanu `editContent`. Ten stan w tym trybie nie nadążał za dokumentem (`useLiveNoteText` jest wtedy wyłączony). Skutek: tekst dopisany na drugim urządzeniu w czasie podglądu znikał przy „Zamień na listę” (`NoteEditor.tsx:230`) albo Znajdź/Zamień (`:153`); przy edycji offline po scaleniu dochodziło do zdublowania, bo wszystkie znaki dostawały nową tożsamość.

**Poprawka:**

- `src/lib/yTextEdit.ts` — nowa czysta funkcja `rebaseSplice(prev, next, current)`: zmiana jako jedno wycięcie ze wstawką, przeniesiona na bieżący tekst dokumentu; `null`, gdy peer zmienił ten sam zakres.
- `src/hooks/useNoteEditSession.ts` — `writeContent` zapisuje tylko zmieniony zakres; przy `null` odświeża treść i pokazuje „Treść zmieniła się na innym urządzeniu. Powtórz zmianę.”; nowy efekt trzyma `editContent` w zgodzie z `Y.Text` przez cały czas wiązania.

Typecheck czysty. Testów nie pisano ani nie uruchamiano.

**Z-4.T (Opus, M):**

- Vitest `rebaseSplice`: bez zmian peera; peer dopisał za zakresem; przed zakresem; w zakresie (→ `null`); wstawka w pusty tekst; usunięcie wszystkiego; `prev === next`.
- Test zbieżności na dwóch `Y.Doc`: A w podglądzie zamienia tekst na listę, B równolegle dopisuje zdanie; po wymianie aktualizacji oba dokumenty równe i zdanie B istnieje. To samo z B offline.
- e2e: podgląd → „Zamień na listę” → treść poprawna, Ctrl+Z działa po powrocie do edytora.
- Sprawdzić ręcznie albo testem, czy dodatkowy obserwator nie powoduje podwójnego renderu przy pisaniu w CM (wartość jest ta sama, React powinien pominąć).

**Przegląd Fable 2026-11-16 (pkt 4 kolejki).** Część Vitest z listy wyżej już jest w `src/lib/yTextEdit.test.ts`. Przegląd znalazł dwa błędy, oba poprawione w kodzie (typecheck czysty, `yTextEdit.test.ts` 16/16):

- **Pary zastępcze [uruchomione]:** wspólny początek/koniec liczony po jednostkach UTF-16 rozcinał emoji o tej samej pierwszej połówce (😀→😁); Yjs zamienia wtedy obie połówki na U+FFFD. Dotyczyło też `applyTextEdit`, czyli zwykłego pisania w textarea. Poprawka: `changedRange` w `yTextEdit.ts`, testy dopisane.
- **Odrzucony zapis a lista zadań [kod]:** przy `null` z `rebaseSplice` treść zostawała, ale `onConvert` (`NoteEditor.tsx`) i Ctrl+Shift+L mimo to ustawiały listę — linie były w treści i na liście, a ponowienie dublowało pozycje. Poprawka: `writeContent` zwraca `boolean`, wołający zmieniają listę tylko przy `true`.

**Z-4.T — zostaje (Opus, M):**

- Vitest `rebaseSplice`, przypadki brzegowe gałęzi tekstowych: dopisek na końcu (`start === prev.length`, pusty `tail`) przy całkiem innym `current` — dziś dokleja na koniec, test ma to utrwalić jako świadome; zmiana ostatniego znaku przy `current` kończącym się tym samym znakiem; peer wstawił dokładnie w punkcie czystej wstawki (oba teksty zostają); Znajdź/Zamień „wszystko” (kilka trafień = jedno wycięcie od pierwszego do ostatniego) z dopiskiem peera między trafieniami → `null`.
- Zbieżność z B offline: B wstawia zdanie **w środek** zakresu kasowanego przez A; po scaleniu zdanie B istnieje w obu dokumentach, nic się nie dubluje.
- Test hooka albo e2e: odrzucony zapis (peer zmienił zakres w podglądzie) → komunikat, treść odświeżona, lista zadań **bez zmian**; ponowienie daje listę bez duplikatów.
- e2e i podwójny render — bez zmian, jak w liście wyżej. Do pomiaru przy okazji: obserwator woła `collabText.toString()` przy każdym znaku (O(n)); sprawdzić na notatce ok. 200 KB, czy pisanie nie zwalnia.

**Do sprawdzenia przy okazji [kod]:** `textBases` zachowuje bazę z `begin()` przez całą sesję wiązania, choć CM pisze do `Y.Text` z pominięciem bazy. Dziś nikt w tym trybie nie woła `onUpdate` z `content`, więc stara baza nie szkodzi; każda przyszła ścieżka, która to zrobi, zdubluje tekst. Zlecenie: asercja albo zamknięcie bazy przy wejściu w wiązanie.

---

## Zadanie 5 — klient przekaźnika (`src/lib/sync/relayProvider.ts`)

| # | Waga | Ustalenie |
|---|---|---|
| R-1 | **wysoka** | **Wpis i migawka mają limit ok. 512 KB, a klient o nim nie wie.** Serwer odrzuca wpis albo migawkę powyżej 700 000 znaków (`relay-server/core.js` `MAX_ENTRY_CHARS`, `validEntry` w `appendEntry` i `applySnapshot`; treść żądania do 1 MB). Klient przy pierwszym połączeniu wysyła cały dokument jako jeden wpis (`start`: `encodeStateAsUpdate(doc, sv)` bez `sv`), a po dłuższej pracy offline — jedną scaloną paczkę. Powyżej limitu dostaje 413, traktuje to jak błąd sieci i ponawia w nieskończoność ze stanem „offline”. Migawka całego dokumentu ma ten sam limit, więc kompaktowanie też się nie uda, a po 5000 wpisów serwer odpowiada 409 i zapis staje. Notatnik większy niż ok. 0,5 MB nie zsynchronizuje się przez przekaźnik. **[kod]**; rozmiaru prawdziwego dokumentu nie mierzono. |
| R-2 | średnia | **Jeden zły wpis blokuje wszystkich.** Wpis, którego nie da się odszyfrować, daje błąd trwały przy każdym pobraniu, bo kursor stoi przed nim. Wpis odszyfrowany, ale odrzucony przez `Y.applyUpdate`, jest traktowany jak błąd sieci — ponawianie bez końca. **[kod]** |
| R-3 | średnia | **409 i 413 nie uruchamiają kompaktowania.** Serwer pisze „zrób snapshot”, klient tylko ponawia. Kompaktowanie rusza wyłącznie z lokalnego licznika `cursor − compactedAt ≥ 500`. **[kod]** |
| R-4 | średnia | **Koszt kolejki offline rośnie kwadratowo.** Każda lokalna zmiana woła `persistPending`, które scala wszystkie zaległe aktualizacje i zapisuje całość. Po dniu pisania bez sieci każdy znak przepisuje coraz większy blok. **[kod]** |
| R-5 | niska | **`start()` nie sprawdza `started` po `await`.** `stop()` w trakcie wczytywania stanu zostawia podpięty nasłuch `update`: kolejka rośnie w pamięci i zapisuje się bez końca. **[kod]** |
| R-6 | niska | Zapisy `savePending` nie są szeregowane (wołane z nasłuchu i z zadań). Gubienia danych nie ma — przy starcie różnica względem `sv` z ostatniej udanej wysyłki odtwarza wszystko — ale to `sv`, a nie kolejka, jest faktyczną gwarancją. Warto to zapisać w komentarzu modułu. **[kod]** |
| R-7 | niska | Odpowiedź serwera nie jest sprawdzana: `seq` niższy niż kursor cofa kursor; `hasMore` z wpisami o starych numerach daje do 1000 żądań na jedno pobranie. **[kod]** |
| R-8 | do planu F2 | AAD wiąże wpis tylko z pokojem. Serwer może wpis pominąć i klient tego nie wykryje (powtórzenie i zmiana kolejności są nieszkodliwe). Naprawia to dopiero migawka z innego urządzenia. |
| R-9 | do sprawdzenia | Dwie karty: każda ma własny `RelayProvider` i ten sam `RelayStore`. Kursor i kolejka nadpisują się nawzajem. Z analizy `sv` wynika, że danych to nie gubi; nie sprawdzono, czy karty wymieniają dokument między sobą. |

**Zlecenia:**

- **Z-5.1 (Opus, M; D-R1 = podnieść limit).** Wariant wybrany: serwer przyjmuje migawkę i wpis do 16 MB (osobny limit treści żądania dla tych dwóch tras, limit pokoju bez zmian), klient zna limit i przy przekroczeniu pokazuje stan „błąd” z komunikatem zamiast ponawiać. Wariant drugi: dzielenie wpisu po stronie klienta — trudniejsze, bo scalonej aktualizacji Yjs nie da się prosto pociąć. Test: dokument 2 MB synchronizuje się od zera między dwoma klientami na atrapie serwera z prawdziwymi limitami.
- **Z-5.2 (Sonnet, S).** 409 → jedna próba `compactTask` z pominięciem progu, potem ponowienie wysyłki; 413 → stan „błąd”. Błąd `applyUpdate` → błąd trwały z osobnym komunikatem.
- **Z-5.3 (Sonnet, S).** `persistPending` z opóźnieniem 500 ms i zwinięciem `pending` do jednego elementu; zapis natychmiast przy `flushNow` i schowaniu karty. Szeregowanie zapisów jedną kolejką.
- **Z-5.4 (Sonnet, S).** `if (!this.started) return;` po `await` w `start()`; kontrola `entry.seq > cursor` i typów w odpowiedzi.
- **Z-5.T (Opus, M).** Testy z atrapą `fetch` i `RelayStore`: zamknięcie karty w trakcie wysyłki (nic nie ginie po ponownym starcie), błąd w połowie strony pobierania, klient z kursorem sprzed migawki, dwa klienty kompaktujące naraz, serwer zwracający 409.
- **D-R2:** co robić z wpisem nie do odszyfrowania — blokować (dziś) czy pominąć z trwałym ostrzeżeniem. Pominięcie jest bezpieczne dla CRDT tylko wtedy, gdy brak naprawi późniejsza migawka.

### Drugi przegląd (2026-11-16, Fable) — stan po `67d9758b`

Przegląd przez czytanie `relayProvider.ts`, `relayRuntime.ts`, `relay-server/core.js` i `server.js` na `fb635b63`. Oznaczenie **[próba]** — sprawdzone na uruchomionym serwerze albo skryptem; testów do repozytorium nie dopisano.

**Stan poprzednich ustaleń:** R-2, R-4, R-5 naprawione. R-1 i R-3 naprawione częściowo (R-10, R-13 niżej). R-7: kontrola `seq` jest, pola `last` nikt nie sprawdza (R-11). R-9 bez zmian — z analizy wynika, że nieszkodliwe: każdy zapisany `sv` opisuje stan, który ta karta na pewno wysłała, więc nadpisanie cudzym `sv` powoduje najwyżej ponowne wysłanie.

| # | Waga | Ustalenie |
|---|---|---|
| R-10 | **wysoka** | **Dokument powyżej limitu nadal ponawia się bez końca.** Serwer zwraca 413 tylko dla treści między limitem wpisu a limitem żądania (4096 znaków zapasu). Większe żądanie zrywa połączenie (`req.destroy()` w `readJson`, zanim pójdzie odpowiedź), więc klient widzi błąd sieci, a nie 413. Pokazuje „offline” i wysyła całość od nowa co 2–60 s, także na danych komórkowych. Klient nie sprawdza rozmiaru przed wysyłką. **[próba]**: 22 400 100 znaków → 413; 30 000 000 → `ECONNRESET`. |
| R-11 | **wysoka** | **Pokój usunięty albo wygasły rozjeżdża urządzenia po cichu.** Pokój znika przez „usuń też z przekaźnika” na innym urządzeniu, po 180 dniach bez zapisu (`touched` zmienia tylko zapis) albo po utracie danych serwera. Klient zostaje ze starym kursorem i `sv`. Następny zapis zakłada pokój od numeru 1 i wysyła samą różnicę, więc nowe urządzenie dostaje aktualizację bez poprzedników, której Yjs nie zastosuje. Stary klient pyta `since=<stary kursor>` i nie widzi wpisów o niższych numerach. Stan pokazuje „online”. **[próba]**: po `DELETE` i jednym `POST` odpowiedź na `since=2` to `{"entries":[],"last":1}`. |
| R-12 | **wysoka** | **Po przerwie w sieci gniazdo nie wraca.** `onError` i `ws.onclose` dzielą jeden `retryTimer`. Gdy żądanie padnie przed zamknięciem gniazda (typowe: zapis lokalny przy martwej sieci), licznik ponowień jest już ustawiony, `onclose` wychodzi bez planowania połączenia, a licznik woła samo `sync()`. `connectSocket` wołają tylko `start()` i `onclose`; zdarzenie `online` i powrót do karty wołają `sync()`. Do przeładowania strony zmiany z innych urządzeń przychodzą tylko przy powrocie do karty, zdarzeniu `online` albo ponowieniu po kolejnym błędzie. **[kod]** |
| R-13 | średnia | **„Pokój pełny” ma ten sam kod co „wpis za duży”.** `appendEntry` zwraca 413 także wtedy, gdy suma pokoju przekroczy 50 mln znaków. Klient pokazuje wtedy trwały błąd „limit 16 MB na wpis” i nie próbuje migawki, choć serwer o nią prosi. **[kod]** |
| R-14 | średnia | **Żądania nie mają limitu czasu.** `http()` nie przekazuje `signal`. Żądanie, które zawisło, blokuje kolejkę `chain`, więc staje pobieranie i wysyłka, a stan zostaje „online”. `checkRelay` i `deleteRelayRoom` limit mają. **[kod]** |
| R-15 | niska | **Każdy start wysyła wpis, jeśli w dokumencie cokolwiek kiedyś usunięto.** `encodeStateAsUpdate(doc, sv)` zawsze dołącza pełny zbiór usunięć, więc warunek `initial.length > 2` jest prawie zawsze spełniony. Skutek: wpis na każde uruchomienie każdego urządzenia i pobudka pozostałych. **[próba]**: 3000 usunięć → 8966 bajtów różnicy względem własnego `sv`. |
| R-16 | niska | **Każde urządzenie kompaktuje osobno.** `compactedAt` jest lokalne, więc trzy urządzenia wysyłają trzy pełne migawki na te same 500 wpisów. Nieudana migawka po udanym pobraniu zgłasza błąd całego pobrania. **[kod]** |
| R-17 | niska | **Pierwszy start w pustym pokoju pokazuje „offline”.** `GET` nieistniejącego pokoju daje 404, traktowane jak błąd sieci. Z zaległymi zmianami naprawia to następna wysyłka; urządzenie bez zmian ponawia bez końca. **[kod]** |

**Zlecenia z drugiego przeglądu:**

- **Z-5.5 — ZROBIONE 2026-11-17 (Fable; niezacommitowane).** `relay-server/core.js` (`newEpoch`, `epochConflict`), `server.js`, `relayProvider.ts` (`resetRoom`, `roomReplaced`, `knowsRoom`). Ponad zlecenie: serwer odrzuca `412` zapis z nieaktualną epoką, a migawka nie zakłada pokoju. Trzy testy z prawdziwym serwerem w `relayServer.integration.test.ts`. **Zostaje dla Z-5.T (Sonnet, S):** testy `core.test.js` dla `epochConflict` i `cleanStore` (pokój bez epoki dostaje ją, poprawna zostaje), `server.test.js` dla `412` i `404` migawki, atrapa w `relayProvider.test.ts` z epoką oraz przypadki „stan sprzed epok” (reguły 2 i 3) i reset po wiadomości `updated` z gniazda. Reguła 5 (limit przy resecie) czeka na Z-5.6. Treść zlecenia: Serwer nadaje pokojowi losową `epoch` (16 bajtów, hex) przy założeniu, zapisuje ją w magazynie (`cleanStore` ją zachowuje; w F2 trafia do `meta.json`) i zwraca w odpowiedziach `GET updates`, `POST updates`, `PUT snapshot` oraz w wiadomości `ready`. Klient trzyma `epoch` w `RelayState`. Reguły klienta:
  1. Epoka z odpowiedzi różni się od zapisanej → **reset**: `cursor = 0`, `compactedAt = 0`, `sv = undefined`, `pending = [encodeStateAsUpdate(doc)]`, zapis stanu, potem pobranie od zera i wysyłka. Reset jest bezpieczny, bo ponowne wysłanie pełnego stanu jest w Yjs bez skutku.
  2. Zapisany stan bez epoki (aktualizacja aplikacji): przyjąć epokę, jeśli `last ≥ cursor`; inaczej reset.
  3. Serwer bez epoki (stary): reset, gdy `last < cursor` albo `seq` z `POST` jest ≤ kursor.
  4. `GET` z odpowiedzią 404: przy `cursor > 0` reset, przy `cursor = 0` pusta strona, nie błąd.
  5. Reset podlega limitowi wpisu z Z-5.6.
  Samo porównanie `last < cursor` nie wystarcza: odtworzony pokój może dogonić stary kursor, zanim klient wróci.
- **Z-5.6 (Sonnet, S) — limit po stronie klienta (R-10, R-13).** Stała limitu wspólna z serwerem (albo pole `maxEntryChars` w `/health`). `flushTask` i `compactTask` sprawdzają długość zaszyfrowanych danych przed wysyłką; przekroczenie to błąd trwały z komunikatem, bez żądania. Serwer: „Pokój pełny” jako 409 zamiast 413. Klient: drugie 409 po wymuszonej migawce to błąd trwały „pokój na przekaźniku jest pełny”, a nie ponawianie. **Stan (2026-11-20): ◐** — limit klienta w `ac4be100`; serwer odpowiada 409 dla „Pokój pełny” (`prepareAppend` w `relay-server/core.js`, test w `core.test.js`, niewdrożone). Zostaje klient: drugie 409 po migawce nadal idzie ścieżką ponowień w `onError`, nie jako błąd trwały.
- **Z-5.7 (Sonnet, S) — osobny licznik dla gniazda (R-12).** `socketRetryTimer` niezależny od `retryTimer`, czyszczony w `stop()`. `sync()` wołane przy `online` i powrocie do karty łączy gniazdo, gdy go nie ma i nie czeka ponowienie.
- **Z-5.8 (Sonnet, S) — limit czasu żądań (R-14).** `AbortSignal.timeout` w `http()`: 30 s dla `GET`, 120 s dla wysyłki wpisu i migawki. Przekroczenie idzie zwykłą ścieżką ponowień.
- **Z-5.9 (Sonnet, S) — porządki (R-15, R-16).** Start: nie wysyłać różnicy, gdy wektor stanu dokumentu równa się zapisanemu `sv` i skrót zbioru usunięć równa się zapisanemu przy ostatniej wysyłce (nowe pole stanu). Kompaktowanie: błąd migawki po udanym pobraniu tylko do dziennika diagnostycznego; `compactedAt` podnosić także po zobaczeniu wpisu z `snapshot: true`.
- **Z-5.T — ZROBIONE 2026-11-18** (`relayProvider.test.ts`, blok „Z-5.T”; przy okazji limit czasu żądania i kontrola rozmiaru wpisu w kliencie); bez testu zostało tylko gniazdo zamknięte przy oczekującym ponowieniu. Treść: **Z-5.T — dopisać:** pokój usunięty między sesjami (trzecie urządzenie dostaje pełny stan), pokój odtworzony z `last` powyżej starego kursora, żądanie zerwane bez odpowiedzi przy za dużym wpisie (jedna próba, stan „błąd”), gniazdo zamknięte przy oczekującym ponowieniu (łączy się ponownie), żądanie bez odpowiedzi (kolejka rusza po limicie czasu).

**Kolejność:** Z-5.5 i Z-5.6 (utrata zbieżności, zużycie danych) → Z-5.7 → Z-5.8 → Z-5.T → Z-5.9. Z-5.5 zmienia protokół, więc przed F2; F2 musi przenieść `epoch` do `meta.json`.

---

## Zadanie 6 — odśmiecanie obrazów

**Stan [kod]:** listę używanych kluczy składa `yjsStore.referencedImages()` (notatki: `imageHashes`, jawne załączniki; `journalRefsIn`; `planRefsIn`) oraz drugi raz `useNotes.ts:213–229` (`journalImageRefs` z `study/images`). Zapisujących do `imageStore` jest 16 plików: `AddNoteBar`, `useNoteImages`, `shareInbox`, `imageSync`, `relayBlobs`, `plans/imageImport`, oraz w Pracy `JournalEntrySheet`, `PhotoDayDialog`, `SiteDocsPanel`, `SiteFaultsPanel`, `SitePointsPanel`, `SiteSignatureDialog`, `useJournalPhotoEdits`, `photoEntry`, `photoShrink`, `siteDocsAdd`. Karencja 7 dni chroni tylko świeże pliki.

**Do sprawdzenia przez wykonawcę (nie czytano):**

- `SitePointsPanel` i `SiteSignatureDialog` — czy zdjęcia punktów i podpis są w mapach, które czyta `journalRefsIn` (ono czyta tylko `studyJournal` i dokumenty z `studySiteItems`).
- Notatki prywatne: pola `images` i `attachments` żyją w szyfrogramie (`PRIVATE_FIELDS`). Czy jawne `imageHashes` zostaje przy notatce prywatnej? Jeśli nie, zablokowany skarbiec oznacza, że po 7 dniach odśmiecanie kasuje jej obrazy. Drugi przegląd planu krypto potwierdza pokrewny przypadek (skarbiec nigdy nieodblokowany na urządzeniu).
- Wersje historii notatki, szkic w `AddNoteBar`, pliki w skrzynce udostępniania starsze niż 7 dni, protokoły odbioru.

**Z-6 (Opus, M) — test-strażnik:**

1. Test „każdy zapis ma czytelnika”: dla każdej ścieżki zapisu z listy wyżej test tworzy obiekt przez publiczne API działu, cofa zegar o 8 dni, uruchamia `collectGarbage(referencedImages())` i sprawdza, że bajty zostały. Osobny przypadek z zablokowanym skarbcem.
2. Test statyczny: lista plików importujących `putBlob`/`putBytes` porównana z listą zatwierdzoną w teście; nowy plik zapisujący obrazy wywala test, dopóki ktoś nie dopisze przypadku do punktu 1.
3. Jedno źródło listy: `useNotes.ts` ma wołać samo `yjsStore.referencedImages()`; jeśli `journalImageRefs` zwraca coś ponad `journalRefsIn`, przenieść to do `journalRefs.ts`.
4. Bezpiecznik w `collectGarbage`: gdy kandydatów jest więcej niż połowa magazynu i więcej niż 20, nic nie kasować i zapisać ostrzeżenie w diagnostyce. — **ZROBIONE 2026-11-16.**

### Przegląd Fable 2026-11-16 (zrobione w kodzie)

Sprawdzone punkty z „Do sprawdzenia”:

- **Notatki prywatne:** nie mogą mieć plików — `privateNotes.lockNote` odmawia z `has-files`. Zablokowany skarbiec nie ukrywa odwołań. Ryzyka nie ma.
- **Podpis:** odwołania zbiera `signatureRefsIn`. **Zdjęcia punktów i usterek** trafiają do wpisów dziennika (`images`, `after`), czyta je `journalRefsIn`.
- **Szkic w `AddNoteBar`:** obrazy są tylko w stanie Reacta (bez zapisu), chroni je karencja. Szkic i edycja wpisu dziennika: `journalImageRefs`.

Błędy znalezione i poprawione w `src/lib/imageStore.ts`:

- `putBytes` dla znanego klucza nie odnawiał `addedAt`. Stary osierocony plik dodany ponownie mógł zniknąć przy najbliższym odśmiecaniu, zanim notatka się zapisała. Teraz rekord starszy niż doba dostaje nową datę.
- Zbiór `known` jest osobny w każdej karcie. Po skasowaniu pliku w innej karcie `putBytes` uznawał go za obecny i nic nie zapisywał. Teraz czyta rekord i w razie braku zapisuje od nowa; karty wymieniają `add`/`del` kanałem `kaczy-images:<baza>`.
- Sprawdzenie daty i usunięcie były osobnymi operacjami, a wszystkie kandydaty czytano naraz z bajtami. Teraz jedna transakcja na plik (`deleteIfStale`).
- Odśmiecanie biegnie pod blokadą `notatnik-gc` (jedna karta naraz).

**Zostaje dla Opus/Sonnet:**

- **Z-6.T (Sonnet, S)** — testy nowych zachowań w `imageStore.test.ts`: (a) ponowne `putDataUrl` rekordu starszego niż karencja → `collectGarbage(new Set())` zwraca 0; (b) dwa magazyny na tej samej bazie: `add` z A widać w `b.has()` i w `onAdded`, po odśmieceniu w B `a.has()` jest fałszem, a ponowne `put` w A odtwarza bajty; (c) bezpiecznik: 30 plików, 5 używanych → 0 usuniętych; 20 używanych → 10 usuniętych. Wszystkie trzy przypadki Fable uruchomił jako test roboczy — przechodzą.
- **Z-6.1–Z-6.3 (Opus, M)** — punkty 1–3 wyżej bez zmian (test „każdy zapis ma czytelnika”, test statyczny, jedno źródło listy). — **Z-6.1 i Z-6.2 ZROBIONE 2026-11-18** (`src/lib/imageWriters.test.ts`); Z-6.3 świadomie nie: stan lokalny dziennika wymaga modułów spoza paczki startowej (opis w `opis.md`).
- **Z-6.5 (Opus, S)** — trwałe usunięcie notatki z „Cofnij” tuż przy starcie odśmiecania: jeśli plik jest starszy niż 7 dni, cofnięcie przywraca notatkę bez obrazu. Okno jest wąskie (odśmiecanie biega raz, po starcie). Propozycja: przy trwałym usunięciu odnowić `addedAt` plików notatki (`images.touch`), wtedy karencja liczy się od usunięcia.
- **Z-6.6 (decyzja właściciela)** — po zadziałaniu bezpiecznika śmieci zostają na stałe. Czy dodać w Ustawieniach → Kopia i dane przycisk „Usuń nieużywane pliki (N)” z potwierdzeniem?

---

## Zadanie 7 — wiele kart: co blokować (plan)

Q1.1 w `plan-qol-platforma-2026-11-15.md` obejmuje tylko migracje i import kopii. Lista pełniejsza, według ryzyka:

| Operacja | Ryzyko przy dwóch kartach | Co zrobić |
|---|---|---|
| Migracje i import kopii | podwójna migracja, zdublowane dane | blokada wyłączna `notatnik-migracja` (Q1.1) |
| Wystawienie faktury | ten sam numer dwa razy (F-3) | blokada `notatnik-faktura` (Z-2.3) |
| Zmiana hasła skarbca, reset kodem | dwa różne klucze danych | blokada wyłączna; plan krypto §3.5 opisuje to dla dwóch urządzeń, karty to ten sam przypadek |
| Odśmiecanie obrazów | karta A kasuje plik, który karta B właśnie wstawia do szkicu | odśmiecanie tylko w karcie trzymającej blokadę `notatnik-gc`; karencja zostaje |
| Przekaźnik | dwie karty, jeden magazyn kursora (R-9) | jedna karta „prowadząca” przez blokadę trzymaną do zamknięcia; pozostałe dostają zmiany od niej |
| Web Push, harmonogram przypomnień | dwa powiadomienia o tym samym | ta sama karta prowadząca |
| Automatyczna kopia do pliku | dwa zapisy naraz do jednego pliku | karta prowadząca |
| Ustawienia w `localStorage` | brak — `persistedStore` słucha zdarzenia `storage` | nic |
| Edycja tej samej notatki | brak, jeśli karty dzielą dokument; **nie sprawdzono**, czy tak jest | sprawdzić przed Q1.1 |

Zasady: blokada wyłączna tylko dla operacji krótkich i nieodwracalnych; dla długotrwałych — rola karty prowadzącej (`navigator.locks.request(nazwa, { mode: "exclusive" }, () => obietnica bez końca)`), przejmowana automatycznie po zamknięciu karty. Bez `navigator.locks` (starsze WebView) zachowanie jak dziś, bez komunikatu. Druga karta nie blokuje pisania — pokazuje tylko „trwa w innej karcie” przy operacji wyłącznej.

**Z-7 (Opus, M):** rozszerzyć Q1.1 o tę tabelę, zacząć od sprawdzenia, jak karty wymieniają dokument.

### Stan po przeglądzie Fable 2026-11-16

- **Edycja tej samej notatki — sprawdzone, bez ryzyka.** Karty dzielą dokument przez `tabSync.ts` (`BroadcastChannel`, start w `main.tsx`).
- **Migracje, import kopii, faktura** — były zrobione wcześniej (`withExclusiveLock`).
- **Odśmiecanie** — zrobione: `withLockIfFree(GC_LOCK)` w `useNotes.ts`, szczegóły w Zadaniu 6.
- **Przekaźnik** — zrobione: `holdTabRole(RELAY_ROLE)` w `relayRuntime.ts`. Karta czekająca pokazuje „Synchronizuje inna karta tej przeglądarki”. Jej zmiany idą przez `tabSync` do prowadzącej i stamtąd na serwer. Sprawdzone ręcznie na prawdziwym Web Locks (Node): kolejność przejęcia, zwolnienie czekającej, `withLockIfFree` przy zajętej roli.

**Zostaje dla Opus/Sonnet:**

- **Z-7.T (Sonnet, S)** — testy `holdTabRole` i `withLockIfFree` w `tabLock.test.ts`. Uwaga: jsdom w Vitest nie ma `navigator.locks`, więc bez atrapy test sprawdza tylko ścieżkę zapasową. Potrzebna prosta atrapa `locks.request` (kolejka, `ifAvailable`, `signal`) albo środowisko `node` dla tego pliku (Node 24 ma Web Locks). Przypadki: pierwsza karta dostaje rolę bez `onWait`; druga dostaje `onWait`, a rolę po zwolnieniu pierwszej; zwolnienie czekającej nie woła `onAcquire`; podwójne zwolnienie nie szkodzi; `withLockIfFree` zwraca `null`, gdy zajęte.
- **Z-7.1 (Opus, S)** — zmiana hasła skarbca i reset kodem pod `withExclusiveLock("notatnik-skarbiec")`; po wejściu w blokadę odczytać nagłówek skarbca od nowa (druga karta mogła już zmienić klucz).
- **Z-7.2 (Opus, M)** — harmonogram przypomnień i Web Push pod rolą `holdTabRole("notatnik-przypomnienia")`. Ryzyko jest małe, bo powiadomienia mają `tag` i system je scala; zrobić dopiero, gdy pojawi się zgłoszenie podwójnego dźwięku.
- **Z-7.3 (Opus, S)** — automatyczna kopia do pliku pod `withLockIfFree`: gdy inna karta właśnie zapisuje, ta pomija przebieg.
- **Z-7.4 (Sonnet, S)** — e2e na dwóch stronach jednego kontekstu z lokalnym przekaźnikiem: druga karta pokazuje „Synchronizuje inna karta”, po zamknięciu pierwszej przechodzi w „Połączono”, zmiana z drugiej karty dochodzi do drugiego kontekstu. Dotychczasowe testy przekaźnika używają osobnych kontekstów, więc rola ich nie dotyczy.
- **Znane ograniczenie (bez zlecenia):** prowadząca karta w tle ma dławione liczniki czasu, więc wysyłka zmian z widocznej karty czekającej może się opóźnić do około minuty. Naprawa wymagałaby oddawania roli przy ukryciu karty; warto dopiero po zgłoszeniu.

---

## Zadanie 8 — godzina ścienna przypomnień (przegląd zrobiony 2026-11-16)

Przeczytane: `reminderSpec.ts`, `reminderRepeat.ts`, `reminderTime.ts`, `reminderDue.ts`, `push/schedule.ts`, `useNotes.ts` (`updateNote`), `useCalendarMoves.ts`, zapis w `yjsStore.ts`.

**Odpowiedzi na pytania**

1. *Co jest zapisane.* `reminder` to chwila (ms). Termin jednorazowy składa `composeReminderTimestamp` z daty i godziny w strefie urządzenia, z przesunięciem obowiązującym **w dniu terminu** — „8:00 w grudniu” ustawione w lipcu wypada o 8:00. Obawa z pierwszej wersji tego punktu nie dotyczy jednej strefy. Serie mają godzinę ścienną od 2026-10-26: kotwica `reminderTime` (minuty od północy) i `reminderDay`, a każdy krok liczy się arytmetyką lokalnej daty (`getNextReminderTime`), więc zmiana czasu ich nie przesuwa.
2. *Zgodność wstecz.* `reminderTime` jest osobnym kluczem w `Y.Map` notatki, poza `reminderSpec`. Starsze wersje go nie znają i liczą godzinę z bieżącego terminu. Zapis i tak idzie w jednej transakcji z `reminderSpec`.
3. *Serwer push.* Już dostaje gotowe chwile: `buildPushSchedulePlan` liczy je w przeglądarce na 14 dni (do 60 wystąpień serii) i wysyła listę przy każdej zmianie danych. Serwer nie zna stref i nie musi. Ograniczenie: lista powstaje w strefie urządzenia, które ją wysłało, i wygasa po 14 dniach bez otwarcia aplikacji.
4. *Godzina nieistniejąca i podwójna.* Seria: nieistniejąca 2:30 daje tego dnia 3:30, następnego dnia wraca 2:30; podwójna 2:30 jesienią to pierwsze wystąpienie (tak `Date` rozstrzyga w V8 i tak działa `withAnchorTime`). Termin jednorazowy o nieistniejącej godzinie jest odrzucany w oknie („Tej godziny nie ma tego dnia”). Reguła z planu jest więc spełniona.
5. *Dwie strefy (D-P1).* Dziś termin jednorazowy jest stałą chwilą: na urządzeniu w innej strefie pokazuje się i dzwoni o innej godzinie ściennej (jak wydarzenie w Kalendarzu Google). Seria liczy następne wystąpienie w strefie urządzenia, które robi krok.

**Błędy znalezione i poprawione w kodzie (2026-11-16)**

- **Odłożenie przestawiało całą serię.** `updateNote` przy każdym zapisie terminu ustawiał kotwicę na godzinę nowego terminu, także przy odłożonym wystąpieniu. „Odłóż 10 min” na serii o 8:00 dawało kotwicę 8:10 i wszystkie następne wystąpienia o 8:10. Teraz zapis z `reminderBase` nie rusza kotwicy (`anchorAfterWrite` w `reminderRepeat.ts`). Serii już przestawionych nie da się naprawić automatycznie — trzeba ustawić godzinę ponownie.
- **Ręczna zmiana o godzinę w dniu zmiany czasu była ignorowana.** `isDstShiftedOccurrence` uznawał za przeskok każdą różnicę 60 minut w takim dniu, więc 8:00 → 9:00 ustawione 29.03 wracało następnego dnia na 8:00. Teraz funkcja składa kotwicę w dniu terminu i porównuje chwile.
- **`addNote` z terminem nie zapisywał kotwicy**, więc seria założona od razu przy tworzeniu notatki nie miała jej nigdy (krok serii jej nie zakłada). Teraz zapisuje.
- `PushNote` nie miał w typie `reminderRule`; w działającej aplikacji pole dochodziło (przekazywane są całe notatki), ale test na typie `PushNote` nie mógł wyrazić reguły. Dopisane.

Testy: `src/lib/reminderRepeat.dst.test.ts` (trzy nowe przypadki).

**Zalecenie do D-P1: odłożyć „lokalną godzinę na każdym urządzeniu”.** W jednej strefie wszystko, co plan chciał osiągnąć, już działa. Pełna godzina ścienna między strefami wymaga nowego pola i zmiany odczytu w całym dziale Terminy (zlecenie Z-8.4), a zysk pojawia się dopiero przy dwóch urządzeniach w różnych strefach albo wyjeździe. Nie blokuje F1.

**Wymaganie dla F1 (APK z alarmami):** natywne alarmy biorą tę samą listę chwil co serwer push. Trzeba ją przeliczyć po zmianie strefy lub zegara systemu (`ACTION_TIMEZONE_CHANGED`, `ACTION_TIME_CHANGED`), po restarcie telefonu i przy starcie aplikacji; alarm ustawiony na chwilę sam przechodzi przez zmianę czasu poprawnie.

**Zlecenia**

- **Z-8.1 (Sonnet, S):** test `updateNote` w `src/hooks/useNotes.test.ts`: seria dzienna 8:00 → zapis odłożenia (`reminder` 8:10, `reminderBase` 8:00, `reminderDay`) → `reminderTime` zostaje 480; potem krok serii → termin jutro 8:00. Drugi przypadek: cofnięcie odłożenia przywraca stan sprzed.
- **Z-8.2 (Sonnet, S):** `useCalendarMoves.ts` woła `nextInSeries` bez godziny serii (`moveToInstant`, zapasowa gałąź `handleSkip`). Dodać `seriesMinutes(note)` jako ostatni argument; test w dniu 29.03.2026 dla serii o 2:30.
- **Z-8.3 (Opus, S, opcjonalne):** przenieść `reminderTime` do `reminderSpec` (pole w `ReminderState`, `REMINDER_FIELDS`, `specOf`, `readSpec`), odczyt: najpierw ze `reminderSpec`, potem ze starego klucza; stary klucz dalej zapisywać. Zysk mały: dziś oba klucze idą w jednej transakcji, rozjazd grozi tylko przy równoczesnym odłożeniu na jednym urządzeniu i zmianie godziny na drugim.
- **Z-8.4 (Opus, M/L, tylko po decyzji D-P1 = tak):** godzina ścienna między strefami.
  - Nowe pole w `reminderSpec`: `reminderWall: { d: "RRRR-MM-DD", m: minuty }` dla bieżącego terminu. Piszący dalej liczy `reminder` (ms) w swojej strefie — dla starszych wersji i sortowania.
  - Odczyt (`plainFromYNote`): gdy jest `reminderWall`, `note.reminder` to chwila złożona z niego w strefie urządzenia. Reszta kodu dalej czyta `note.reminder`. **Odczyt nic nie zapisuje** — inaczej dwa urządzenia w różnych strefach przepisywałyby `reminder` w kółko.
  - Odłożenie względne („za 10 min”, „za godzinę”) to chwila: zapis bez `reminderWall`. „Jutro 9:00” i „wieczorem” to godzina ścienna.
  - `reminderBase` i `reminderRepeatUntil` też są chwilami: koniec serii potrzebuje postaci dziennej (`untilDay`), termin bazowy — własnego `reminderWall` albo wyliczenia z kotwicy.
  - Starsza wersja przy edycji gubi `reminderWall` (`specOf` przepisuje tylko znane pola) — to dobrze: termin wraca do stałej chwili, bez sprzeczności.
  - Rejestr „już odpalone”, `pushKey.note(id, at)` i lista push są per urządzenie, więc różne chwile na różnych urządzeniach nie kolidują; sprawdzić, czy serwer push trzyma harmonogram per subskrypcję.
  - Testy w dwóch strefach: osobne pliki z `process.env.TZ` na górze (jak `reminderRepeat.dst.test.ts`), bo `vitest.config.ts` ustawia Europe/Warsaw.

---

## Zadanie 9 — niestabilny `e2e/reminders-agenda.spec.ts` (diagnoza, bez uruchamiania)

Test nie był uruchamiany (polecenie: bez testów). Hipotezy z lektury pliku, od najbardziej prawdopodobnej **[hipoteza]**:

1. **Przycisk pokazywany po najechaniu.** `card.hover()` → klik „Przypomnienie”. Po zapisaniu poprzedniej notatki kafle zmieniają układ (nowa notatka na górze, animacja), więc kafel ucieka spod kursora między `hover` a `click`. Trzecie wywołanie `withReminder` ma najwięcej przesunięć.
2. **Dwa przyciski „Zapisz”.** `getByRole("button", { name: "Zapisz", exact: true })` w oknie przypomnienia trafia w przycisk okna tylko wtedy, gdy pasek dodawania jest już zwinięty. Jeśli zwinięcie się spóźni — błąd trybu ścisłego albo klik w zły przycisk.
3. **Zegar zatrzymany** (`page.clock.setFixedTime`): `Date.now()` stoi, więc trzy notatki mają ten sam `createdAt`/`updatedAt`, a każda logika typu „minęło X ms od ostatniej akcji” nigdy nie puszcza. Kolejność kafli przy remisie może zależeć od losowej końcówki identyfikatora — i to byłby prawdziwy błąd interfejsu (niestabilne sortowanie przy równych czasach), nie błąd testu.
4. Powiadomienie (toast) po zapisie zasłania kafel albo przechwytuje klik.

**Z-9 (Sonnet, S):** `npx playwright test e2e/reminders-agenda.spec.ts --repeat-each=30 --trace=retain-on-failure`; z zapisu ustalić krok. Jeśli 3 — dodać do sortowania kafli stabilny rozstrzygacz (identyfikator) i test jednostkowy; jeśli 1 lub 2 — zawęzić lokatory do okna dialogowego i użyć menu kafla zamiast najechania.

---

## Zadanie 10 — „kroje się nie zapisują” (diagnoza)

Zapis działa poprawnie **[kod]**: `setAppFont` → `persistedStore.set` → `localStorage["kaczy.font.v1"]`, odczyt z walidacją, atrybut `data-font` ustawiany przy starcie; klucz jest w kopii i w kodzie wyglądu. Trzy przyczyny, które dają ten sam objaw:

1. **Najbardziej prawdopodobna: plik kroju niedostępny offline [hipoteza z kodu].** Kroje do wyboru (Inter, Nunito, Atkinson, Literata, Manrope, Lexend) są celowo poza precache (`vite.config.ts`, `globIgnores`) i trafiają do pamięci `skin-fonts` dopiero, gdy pobierze je strona kontrolowana przez Service Workera. Krój wybrany w pierwszej sesji (zanim SW przejął stronę) albo bez sieci nie trafia do tej pamięci. Po ponownym otwarciu bez sieci `font-display: swap` zostawia krój zastępczy o dopasowanych wymiarach — wygląda jak domyślny, choć ustawienie jest zapisane. Na komputerze z siecią nie do odtworzenia, co zgadza się ze zgłoszeniem. Limit `maxEntries: 20` jest wspólny dla krojów stylów i tekstu, więc przy przeglądaniu wielu krojów może też wypchnąć plik.
2. **Zapis odrzucony przez przeglądarkę.** `persistedStore.set` łapie wyjątek `setItem` i tylko zapisuje ostrzeżenie w diagnostyce; w pamięci ustawienie działa do zamknięcia karty. Pełny dysk albo limit `localStorage` daje dokładnie „nie zapisuje się”. W pamięci projektu jest wpis o pełnym dysku C w tym okresie.
3. **Przywrócenie wyglądu.** `applyAppearanceValues(…, { replace: true })` (Cofnij po wczytaniu kodu, reset wyglądu, zestawy) usuwa klucz kroju, jeśli nie ma go w zestawie.

**Z-10 (Sonnet, S/M):**

- Odtworzenie przyczyny 1 w e2e: wybór kroju → `context.setOffline(true)` → przeładowanie → `document.fonts.check("16px 'Inter Variable'")`.
- Poprawka: przy wyborze kroju i przy starcie z krojem innym niż domyślny wywołać `document.fonts.load()` dla wag używanych w aplikacji, a gdy SW już kontroluje stronę — pobrać pliki `latin` i `latin-ext` jawnie; osobna pamięć `text-fonts` z własnym limitem. W wyborze kroju napis „niedostępny offline”, gdy `fonts.check` zwraca fałsz.
- Przyczyna 2 pokrywa się z Q1.5 planu QoL (stały baner przy błędzie zapisu) — nie robić osobno.
- Przyczyna 3: sprawdzić, czy gotowe zestawy zawierają klucz kroju.

---

## Zadanie 11 — Praca w Yjs: symulacja zamiast QA na dwóch telefonach (zlecenie testów)

Nie czytano `src/lib/study/**` poza `data.ts` i `journalRefs.ts`. **Z-11 (Opus, M):** zestaw testów na dwóch `Y.Doc` wymieniających aktualizacje w losowej kolejności (`fast-check` jest w zależnościach):

1. Dwa urządzenia dodają zdjęcie do tego samego wpisu dziennika offline → po scaleniu oba zdjęcia. Jeśli `images` to zwykła tablica w wartości mapy, wygra jedno urządzenie i drugie zdjęcie zniknie — wtedy to błąd modelu, nie testu; zgłosić przed poprawką.
2. Równoległe odhaczenie dwóch różnych punktów jednej listy; odhaczenie i zmiana nazwy tego samego punktu.
3. Usunięcie wpisu na A i dodanie do niego zdjęcia na B → wpis nie wraca w połowie (albo jest cały, albo go nie ma), a zdjęcie nie zostaje bez właściciela na zawsze (związek z Z-6).
4. Zmiana statusu zlecenia na A i wystawienie faktury na B.
5. Właściwość dla wszystkich: dowolna kolejność i powtórzenia dostarczania aktualizacji dają ten sam stan (`dump()` równe).

---

## Zadanie 12 — migracja `study/data.ts` (zlecenie testów)

Z lektury `data.ts` **[kod]** — przypadki, których dziś nikt nie sprawdza:

1. `studyDevice()`: gdy `setItem` się nie powiedzie, a `getItem` działa (pełny magazyn), identyfikator jest nowy przy każdym starcie, więc `isMerged` zawsze daje fałsz i stary zapis scala się ponownie. Test: trzy starty z odrzucanym `setItem` → brak zdublowanych wpisów (wymaga, żeby `mergeIn` było idempotentne — sprawdzić).
2. Uszkodzony JSON w starym kluczu: nie scala, zostawia klucz, zapisuje błąd; kolejny start robi to samo bez zapętlenia.
3. Znacznik w dokumencie: po przywróceniu kopii bez znacznika tego urządzenia migracja uruchamia się ponownie. Kopia zapisuje stan Nauki także pod `STUDY_STORAGE_KEY` w ustawieniach (`exportNotes.ts:198`), więc po przywróceniu na czystym urządzeniu stary klucz istnieje — test, że wynik nie zawiera dubli.
4. Dwa urządzenia z własnymi starymi zapisami: scalenie w obu kolejnościach daje ten sam stan.
5. `studyReady()` wołane wiele razy migruje raz; `resetStudyForTests()` pozwala powtórzyć.
6. Wyjątek z `yStudy.mergeIn` nie blokuje `ready` (widok nie zostaje na szkielecie).

**Z-12 (Sonnet, S).**

---

## Zadanie 13 — APK z alarmami telefonu (F1, kod zrobiony 2026-11-16, nie sprawdzony na telefonie)

Stan i decyzje: ADR-8 w `docs/adr.md`, opis w `opis.md` („Telefon — aplikacja Android”). Przyjęte N-1…N-3 według ustawień domyślnych planu: APK tak, plik z GitHub Actions poza sklepem, PWA zostaje.

### Zlecenia (Opus/Sonnet)

- **Z-13.1 (Sonnet) — testy `src/lib/reminders/nativePlan.ts`.** `alarmId`: stały dla klucza, w zakresie 1…2^31−2, nigdy `SENTINEL_ID`. `toAlarms`: dwa klucze o tym samym skrócie dostają różne id, wynik nie zależy od kolejności wejścia. `planNative`: niezmieniony alarm nie trafia ani do `cancel`, ani do `schedule`; zmiana treści albo godziny → anulowanie i ponowne zaplanowanie; alarm spoza planu → anulowanie; alarm obcy (bez `extra.h`) → anulowanie. `sentinelFor`: brak, gdy nic nie wypada w ostatnich 2 dniach horyzontu; godzina zaokrąglona w dół. `channelOf`: nieznana kategoria → `notki-inne`.
- **Z-13.2 (Sonnet) — test `scripts/cap-prepare.mjs`** obok `securityHeaders.test.ts`: `cspForMeta` usuwa tylko `frame-ancestors`, `report-uri`, `report-to`, `sandbox`; `withCspMeta` wstawia znacznik przed pierwszym `<script>`, odmawia przy drugim wstawieniu i przy braku `<meta charset>`; cudzysłów w polityce jest zamieniany na encję. To zamyka też Q2.2.
- **Z-13.3 (Sonnet) — test wyboru ujścia (`sink.ts`):** bez `window.Capacitor` → `webpush` według `pushPrefs`; z atrapą `isNativePlatform() === true` → `native` według `nativeAlarmPrefs`; wyłączone → `null`. `nativeSink.replace` z atrapą wtyczki: dwa wywołania naraz idą po kolei; błąd wtyczki zapisuje `last.ok === false` i nie zrywa kolejki.
- **Z-13.4 — ZROBIONE 2026-11-18** (`src/lib/native/fileShare.ts`, opis w `opis.md`; nie sprawdzone na telefonie). Treść: **Z-13.4 (Opus) — pliki w powłoce (F1.4).** `downloadBlob` w WebView nie zapisze pliku. Gałąź natywna: `@capacitor/filesystem` (katalog pamięci podręcznej) + `@capacitor/share`, ładowane dynamicznie jak `nativeSink`. Sprawdzić wszystkie wywołania `downloadBlob`, `shareOrCopy`, `showSaveFilePicker` i `navigator.share` z plikami; `SpeechRecognition.available()` w WebView (pułapka z pamięci: wywraca kartę). Bez wzrostu paczki startowej PWA.
- **Z-13.5 (`security-reviewer`) — przegląd powłoki:** manifest (uprawnienia, `allowBackup`, eksportowane komponenty), CSP w `<meta>` wobec mostu Capacitora, obsługa akcji powiadomień (`onAction` — czy dane z `extra` nie pozwalają otworzyć obcego adresu), workflow (sekrety, uprawnienia `contents: read`, usuwanie klucza).
- **Z-13.6 (Sonnet) — ikony aplikacji** z `public/` do `android/app/src/main/res/mipmap-*` (np. `@capacitor/assets` uruchomione w CI, nie lokalnie — dysk).

### Kroki właściciela

1. Utworzyć klucz podpisu (`keytool -genkeypair -v -keystore notki.jks -alias notki -keyalg RSA -keysize 4096 -validity 10000`), zachować kopię poza repozytorium, wpisać cztery sekrety w GitHub (nazwy w `.github/workflows/android.yml`). Utrata klucza = brak aktualizacji bez odinstalowania.
2. Wypchnąć gałąź i uruchomić workflow „Android APK” ręcznie; pobrać artefakt `notki-apk`.
3. Próba F1.0 na telefonie: instalacja; „Alarmy telefonu” włączone; „Próbny alarm za minutę” przy zamkniętej aplikacji; po restarcie telefonu; w trybie samolotowym; po nocy w trybie oszczędzania baterii; przyciski powiadomienia (odłóż, zrobione) przy zamkniętej aplikacji; czy aplikacja w ogóle startuje (most Capacitora pod CSP). Wynik wpisać do ADR-8 — od niego zależy „idziemy dalej / wracamy do Web Push”.

---

## Zadanie 14 — plan Pracy z 2026-11-15 (`docs/plan-praca-2026-11-15.md`)

Zrobione przez Fable: czysta funkcja należności `src/lib/study/receivables.ts` (R3.1 bez ekranu, dane pod R3.4). Etap 1 (R1.1–R1.4) to pomiary właściciela na telefonie — nie da się ich zrobić w kodzie. Reszta poniżej.

- **Z-14.1 (Sonnet) — testy `receivables.ts`.** Tabela przypadków: budowa z saldem i bez; nadpłata nie daje wiersza; czekanie od ostatniej wpłaty, a bez wpłat od `siteCreated`; zlecenie „zrobione” z zaliczką (`paidPct`); „zapłacone” znika razem z fakturą; faktura przed „zrobione” daje wiersz `invoice`, po „zrobione” — tylko wiersz `job` z numerem faktury; korekta do zera usuwa wiersz; faktura bez zlecenia; `overdueDays` po terminie i przed; sortowanie i suma; zmiana czasu między `since` a `now`.
- **Z-14.2 (Opus, po decyzji PR-2) — ekran „Należności” (R3.1, R3.4).** Skill `frontend-design` przed kodem. Zestawienia budów: `billingStatement` dla każdej niearchiwalnej karty z rozliczeniem (wejście jak w `SiteBillingDues.tsx`; godziny z `siteMinutesInRange`) — policzyć raz w hooku i podać jako `statements`. Wiersz: nazwa budowy, kwota „zostało”, dni, pasek `paidPct`, numer faktury i „po terminie N dni”; akcje: przypomnienie (`PaymentReminderButton`), otwarcie karty budowy albo zlecenia. `unpaidTotal` w `JobsDialog` i liczba na Dziś mają brać sumę z tej samej funkcji.
- **Z-14.3 — ZROBIONE 2026-11-18** (opis i odstępstwa w `opis.md`, „Praca — podział arkusza wpisu i karty budowy”). Treść: **Z-14.3 (Opus) — R2.1 podział `JournalEntrySheet.tsx` i R2.2 `SiteCardDialog.tsx`.** Mechaniczne, bez zmiany zachowania; przed i po `e2e` dziennika i karty budowy (na prośbę właściciela). Uwaga na CRLF i bajty zerowe przy skryptowych edycjach.
- **Z-14.4 (Sonnet) — R3.2 oś zlecenia, R3.5 paczka dla księgowej, R2.3–R2.6, Etap 4** według planu; każde osobno, z testem Vitest logiki.
- **Decyzje PR-1…PR-3** czekają na właściciela.

---

## Decyzje właściciela (podjęte 2026-11-15)

| # | Pytanie | Decyzja |
|---|---|---|
| D-G1 | Czy dodatek nocny doliczać do zarobku w podsumowaniu Grafiku? | **Nie** — zostaje informacją przy kafelku „W nocy”. |
| D-K1 | Seria faktur | **Identyfikator urządzenia** w rekordzie i ostrzeżenie, gdy w serii są faktury z innego urządzenia (Z-2.6). |
| D-K2 | Etap 2 bez trybu offline24? | **Tak** — faktura bez sieci czeka na wysyłkę. |
| D-R1 | Limit wpisu i migawki przekaźnika | **Podnieść do 16 MB** (Z-5.1, wariant zalecany). |
| D-R2 | Wpis nie do odszyfrowania | **Blokować** synchronizację (jak dziś), z jasnym komunikatem. |
| D-P1 | Godzina ścienna w różnych strefach | **Odłożyć** — w jednej strefie działa już poprawnie; pełna wersja to Z-8.4 (M/L). Zmienione po przeglądzie 2026-11-16, wcześniej „tak”. |

Decyzje z drugiego przeglądu planów (KR-5, KR-6, „plik bez opisu”, S1.5, D4.1, D1.3) są w samych planach.

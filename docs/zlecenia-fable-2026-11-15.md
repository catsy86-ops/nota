# Wyniki zadań z audytu Fable i zlecenia dla Opus/Sonnet (2026-11-15)

> **Status:** przegląd przez czytanie kodu na `3cc066d6` plus zmiany robocze tej sesji (niezacommitowane). Zadania 1 i 4 mają poprawki w kodzie; reszta to ustalenia i gotowe zlecenia.
> **Podział pracy (decyzja właściciela):** Fable — plan, diagnoza, trudne poprawki. Testy i prace mechaniczne — Opus albo Sonnet. W tej sesji nie pisano ani nie uruchamiano testów poza zadaniem 1 (zrobione przed tą decyzją).
> **Oznaczenia pewności:** **[kod]** — wynika wprost z przeczytanego kodu; **[XSD]** — sprawdzone w schemie `crd.gov.pl/wzor/2025/06/25/13775/schemat.xsd` pobranej 2026-11-15; **[pamięć]** — z wiedzy własnej, do potwierdzenia u źródła; **[hipoteza]** — nieodtworzone.
> Spis zadań: `audyt-fable-2026-11-15.md`.

## Kolejność dla następnej sesji

1. Z-2.1 (lista faktur wywraca się na złym rekordzie) i Z-2.2 (walidacja przy odczycie) — małe, a chronią numerację.
2. Z-5.1 (limit 512 KB wpisu przekaźnika) — bez tego większy notatnik nie zsynchronizuje się wcale.
3. Testy do poprawek już zrobionych: Z-1.T, Z-4.T.
4. Z-10 (kroje offline), Z-6 (test-strażnik odśmiecania), Z-12, Z-11.
5. Decyzje właściciela są podjęte — tabela na końcu.

---

## Zadanie 1 — Grafik względem Kodeksu pracy (zrobione w kodzie)

Trzy poprawki w `src/lib/shifts/`:

- **Dodatek nocny** (`nightAllowance.ts`): 20% × (minimalne wynagrodzenie miesięczne ÷ godziny wymiaru danego miesiąca), osobno dla każdego miesiąca; wcześniej 20% minimalnej stawki godzinowej dla zleceń. Kwota 4806 zł na 2026 r. i wykładnia art. 151⁸ **[pamięć]**.
- **Norma przy nieobecności nad zmianą z grafiku** (`summary.ts`, `monthCore`): odejmuje się `plannedMin`, czyli godziny, które przypadały do przepracowania (art. 130 § 3) **[pamięć]**.
- **Odpoczynek tygodniowy** (`summary.ts`, `weeklyRestShort`): tygodnie to siedmiodniowe bloki od pierwszego dnia okresu rozliczeniowego (art. 128 § 3 pkt 2), nie od poniedziałku; wolne sprzed tygodnia się nie liczy.

**Z-1.T (Sonnet):** testy do tych trzech zmian są już w `nightAllowance.test.ts`, `weeklyRest.test.ts`, `shifts.test.ts` (260 testów w `src/lib/shifts` zielone). Do dopisania: przypadki wzorcowe z całego miesiąca policzone ręcznie (grafik 12-godzinny, równoważny), miesiąc z niepełnym etatem (`nightRateFor` bierze wymiar pełnego etatu — sprawdzić, czy to zamierzone), okres rozliczeniowy 4 miesiące.

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

**Z-3 (Opus, M):** napisać `docs/plan-ksef-etap2.md` według tych punktów, z maszyną stanów i tabelą błędów API; przegląd `security-reviewer` przed kodem.

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
4. Bezpiecznik w `collectGarbage`: gdy kandydatów jest więcej niż połowa magazynu i więcej niż 20, nic nie kasować i zapisać ostrzeżenie w diagnostyce.

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

---

## Zadanie 8 — godzina ścienna przypomnień (plan, nieukończony)

Nie czytano `reminderSpec.ts`, `reminderRepeat.ts` ani `push/schedule.ts`; istnieje `reminderRepeat.dst.test.ts`, więc część przypadków zmiany czasu jest już pokryta. Pytania, na które plan musi odpowiedzieć, zanim ktoś zmieni model:

1. Co jest zapisane: chwila (ms) czy data i godzina lokalna? Przy chwili przypomnienie „8:00” ustawione w lipcu na grudzień wypada o 7:00 albo 9:00, zależnie od sposobu liczenia; powtarzalne przesuwa się po zmianie czasu.
2. Zgodność wstecz: starsze wersje czytają `reminder` i `reminderRepeat` (kod zapisuje je obok `reminderSpec` — `yjsStore.ts`, okolice wiersza 665). Godzina ścienna musi więc iść jako **dodatkowe** pole w `reminderSpec`, a `reminder` (ms) dalej jest wyliczane dla starszych klientów.
3. Serwer push liczy terminy sam (`push/schedule.ts`): musi dostać strefę urządzenia albo gotowe chwile na najbliższe N wystąpień; drugie jest prostsze i nie wymaga bazy stref na serwerze.
4. Godzina nieistniejąca (2:30 w noc zmiany na czas letni) i podwójna (2:30 jesienią): reguła „pierwsze wystąpienie; nieistniejąca przesuwa się do przodu”.
5. Dwa urządzenia w różnych strefach: przypomnienie w godzinie ściennej dzwoni o 8:00 lokalnie na każdym. Czy tak ma być — **D-P1**.

**Z-8 (Opus, M):** przeczytać trzy pliki, odpowiedzieć na pytania 1–4 dowodami z kodu i dopiero wtedy napisać plan zmian.

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

## Decyzje właściciela (podjęte 2026-11-15)

| # | Pytanie | Decyzja |
|---|---|---|
| D-G1 | Czy dodatek nocny doliczać do zarobku w podsumowaniu Grafiku? | **Nie** — zostaje informacją przy kafelku „W nocy”. |
| D-K1 | Seria faktur | **Identyfikator urządzenia** w rekordzie i ostrzeżenie, gdy w serii są faktury z innego urządzenia (Z-2.6). |
| D-K2 | Etap 2 bez trybu offline24? | **Tak** — faktura bez sieci czeka na wysyłkę. |
| D-R1 | Limit wpisu i migawki przekaźnika | **Podnieść do 16 MB** (Z-5.1, wariant zalecany). |
| D-R2 | Wpis nie do odszyfrowania | **Blokować** synchronizację (jak dziś), z jasnym komunikatem. |
| D-P1 | Godzina ścienna w różnych strefach | **Tak** — lokalna godzina na każdym urządzeniu. |

Decyzje z drugiego przeglądu planów (KR-5, KR-6, „plik bez opisu”, S1.5, D4.1, D1.3) są w samych planach.

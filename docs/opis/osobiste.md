# Osobiste: Ćwiczenia, Długi, Skarbiec

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Długi — zdjęcie dowodu przy wpisie (L4.3, Z-17.6, 2026-11-18)

### Co robi

- W edycji wpisu długu jest przycisk „Zdjęcie dowodu” (paragon, przelew, umowa): dodanie, zamiana i usunięcie z „Cofnij”. Zapis od razu, niezależnie od „Zapisz zmiany”.
- W historii osoby wpis z dowodem ma miniaturę; stuknięcie otwiera podgląd. Przy ukrytych kwotach miniatura i podgląd są rozmyte.
- Zdjęcie synchronizuje się jak obrazy notatek. W kopii JSON jest tylko przy widocznych kwotach.

### Gdzie jest

- `src/lib/debts/proofs.ts` — mapa `debtProofs` (`DEBT_PROOFS_MAP`, id wpisu → `{ ref, at }`), `cleanProof`, `debtProofRefsIn`.
- `src/lib/debts/yDebts.ts` — `proofs`, `setProof`, `dropProofOf` (usunięcie wpisu zdejmuje dowód, „Cofnij” go oddaje), `dumpProofs`, `mergeProofs`.
- `src/lib/debts/store.ts` — `useDebtProofs`, `attachDebtProof` (`prepareImage` → `imageStore.putBlob`), `setDebtProof`, `debtProofsDump`, `mergeDebtProofsDump`.
- `src/components/debts/DebtProof.tsx` — `DebtProofThumb`, `DebtProofField`; podpięte w `DebtsView.tsx` (`PersonHistory`, `EditDebtForm`).
- `src/lib/yjs/fileRefs.ts` (`referencedImages`, `syncableRefs`), `src/lib/plans/planRefs.ts` (`sizeCappedRefsIn`), `src/lib/exportNotes.ts` (sekcja `debtProofs`, bajty w `collectAttachmentBlobs`), `src/lib/noteSchema.ts` (`debtProofs`).

### Jak działa i dlaczego

- Osobna mapa zamiast pola wpisu: zmiana zdjęcia nie przepisuje wpisu z kwotą, a zdjęcie zmienione na jednym telefonie i kwota na drugim scalają się bez strat.
- Odwołanie czyta odśmiecanie i transport obrazów — tylko dowody wpisów, które istnieją. Sierota (wpis usunięty na innym telefonie albo id podrzucone przez obcego) nie trzyma pliku i nie jedzie dalej.
- Dowód jest w `sizeCappedRefsIn`: urządzenie z kodem mogłoby wpisać jako dowód skrót dowolnego dużego pliku z magazynu i wymusić jego wysłanie — wychodzi tylko plik do 2 MB prawdziwego rozmiaru (jak podpisy i plany).
- Kopia JSON nie jest szyfrowana, a przelew czy umowa pokazują kwoty: przy ukrytych kwotach bajty dowodów nie wchodzą (`proofsExcluded`), odwołania zostają. Pominięte z braku miejsca liczy osobny licznik (`proofs`).

### Ograniczenia i pułapki

- Rozmycie przy ukrytych kwotach jest tylko wizualne (przed wzrokiem osoby obok); plik jest na urządzeniu i w synchronizacji.
- „Cofnij” po zamianie albo usunięciu zdjęcia wskazuje stare bajty — po karencji odśmiecania (7 dni) mogłoby ich już nie być; dymek znika dużo wcześniej.
- Wyłączenie bajtów dowodów z kopii przy ukrytych kwotach nie ma testu jednostkowego.
- Nie sprawdzone na telefonie.

### Testy

- `src/lib/debts/proofs.test.ts` — czyszczenie, dowód tylko przy wpisie, zamiana i usunięcie, „Cofnij” po usunięciu wpisu, kopia, limit 2 MB, sierota.
- `src/lib/imageWriters.test.ts` — `src/lib/debts/store.ts` na liście zapisujących i przypadek „dowód długu” przeżywa odśmiecanie.
- `src/components/debts/DebtsView.test.tsx` (atrapa sklepu), `e2e/debts-*.spec.ts`.
- Przegląd `security-reviewer` 2026-11-18: M (kopia JSON) i L (sieroty, „Cofnij” bez komunikatu) naprawione.

### Commit

Z-17.6, 2026-11-18 — commit po tym wpisie.

## Długi — stan aktualny (pożyczki i spłaty)

Dział opisany w jednym miejscu; zmiany z 2026-10-20 (kopia, edycja, cofnięcie rozliczenia, poprawka L9) są uwzględnione.

### Co robi

- **Widok.** Góra: „Są nam winni” i „Jesteś winien” (D-1, 2026-10-26; dawniej „My jesteśmy winni”). Pod spodem formularz i lista osób z saldem i paskiem spłaty. Stuknięcie w osobę otwiera arkusz z historią.
  - **Podsumowanie (4.1):** kwoty przeliczają się płynnie (`AnimatedNumber` z `format`; przy ukrytych kwotach „•••” bez animacji), a pod nimi jeden pasek proporcji: lewa część „nam winni” (zielona), prawa „Ty winien” (bursztynowa), `aria-label` z procentami.
  - **Osoba na liście (4.2):** kółko z inicjałem w barwie z palety notatek (`avatarHue` — stała barwa dla tej samej nazwy, `[data-avatar]` korzysta z `--note-ink` dla jasnego i ciemnego schematu; inicjał `aria-hidden`), saldo w JetBrains Mono (`font-mono`).
  - **Pasek spłaty w Zeszycie (4.3):** kreska długopisu — tor jako linijka 1 px, wypełnienie 3 px, lekko pochylone i wyrysowywane od lewej krzywą stylu (`.debt-bar` w `styles/skins/signatures.css`); przy ograniczonym ruchu od razu w stanie końcowym. W innych stylach bez zmian.
  - **Miesiąc w liczbach (L4.2):** pod paskiem proporcji, zwinięte domyślnie (`<details>`, `debts-month`) „Ten miesiąc w liczbach”: „Pożyczone” (pożyczki w obie strony), „Oddane” (zwroty w obie strony) i „Zmiana salda” ze znakiem (plus — inni są nam winni więcej). Liczone po dniu wpisu (`monthNumbers` w `lib/debts/model.ts`); sekcji nie ma, gdy w bieżącym miesiącu nie ma wpisów. Przy otwartym widoku po północy na przełomie miesiąca przechodzi na nowy miesiąc (`useDayClock`). Przy ukrytych kwotach „•••”.
  - **Pusty stan (4.4):** szkic portfela z monetą rysowany kreską (`EmptySketch`, `.debt-sketch` w `index.css`, `pathLength=1`) i jedno wezwanie „Dodaj pierwszy wpis” — otwiera formularz z kursorem w „Kto”. Przy pustej liście telefon nie pokazuje drugiego przycisku „Nowy wpis”.
  - **Duży krój (4.5):** formularze są `@container`; gdy pole ma mniej niż 18rem (np. tekst 125% na 390 px), wybór rodzaju przechodzi z 2×2 na jedną kolumnę.
  - **Na telefonie formularz jest zwinięty (2.1):** przycisk „Nowy wpis” / „Zwiń formularz” (`aria-expanded`), stan zapamiętany na urządzeniu (`kaczy.debts.formOpen.v1`); lista osób jest od razu pod podsumowaniem. Na komputerze formularz zawsze widać. W arkuszu osoby „Wpis z {imię}” zamyka arkusz i otwiera formularz z tą osobą (kursor w kwocie).
  - **Rozliczeni (2.4)** są na dole w zwiniętej sekcji „Rozliczeni (N)”.
  - **Szukanie osoby (2.5)** przy więcej niż 8 osobach: pole nad listą, bez wielkości liter i polskich znaków (`foldName`: „lukasz” znajdzie „Łukasz”); przy szukaniu rozliczeni nie są zwinięci.
- **Cztery rodzaje wpisu** (siatka 2×2 w formularzu; `KindPicker` na `ToggleGroup` z `ui/` — jeden przystanek Tab, strzałki, 44 px na dotyku, plan Długów 1.4):
  - „Pożyczyłem” (`lent`) — ta osoba jest nam winna (+).
  - „Oddał mi” (`repaid`) — spłata od tej osoby (−).
  - „Pożyczyłem od” (`borrowed`) — my jesteśmy winni (−).
  - „Oddałem” (`returned`) — spłata z naszej strony (+).
  
  Jedna osoba może mieć długi w obie strony. Saldo to suma znaków; dodatnie = jest nam winna, ujemne = my jesteśmy winni.
- **Formularz dodawania:** rodzaj, osoba (z podpowiedziami z wcześniejszych wpisów), kwota, dzień, „za co”. Po zapisie zostaje osoba, czyszczona jest kwota i notatka, fokus wraca do kwoty. „Cofnij” w toście usuwa właśnie dodany wpis. Dzień idzie za zegarem (`useDayClock`): po północy domyślny dzień to nowe „dziś”, dopóki nie wybrano innego (1.7).
- **Termin zwrotu** (przy „Pożyczyłem” i „Pożyczyłem od”) tworzy notatkę z przypomnieniem o 9:00 z etykietą **`długi`** (`DEBT_NOTE_LABEL`), więc nie trafia do Skrzynki. Przy ukrytych kwotach tytuł notatki jest bez kwoty („Zwrot od Ania”), bo tytuł widać w powiadomieniu i na Dziś (1.2). Starsze notatki zostają bez zmian.
- **Pasek spłaty** przy osobie pokazuje stronę, która jest winna — także przy samym „Pożyczyłem od” (wtedy w kolorze ostrzeżenia). `aria-label` „Oddano 40% z 500,00 zł” podaje kwotę tej strony (`debtSide`, 1.3).
- **Oddał całość / Oddałem całość.** Dodaje wpis wyrównujący saldo do zera z polem `settle: true`. Toast ma „Cofnij”, które usuwa ten wpis.
- **Podwójne rozliczenie (1.6).** Gdy „Oddał całość” stuknięto na dwóch telefonach naraz, po synchronizacji arkusz osoby pokazuje baner „Rozliczono dwa razy — usunąć drugi wpis?” z przyciskiem „Usuń drugi wpis” (z „Cofnij”), a przycisk „całość” chowa się. Warunek (`doubleSettle`): dwa wpisy `settle` w ciągu minuty, ten sam rodzaj i kwota, saldo po drugiej stronie dokładnie o tę kwotę.
- **Historia osoby.** Wpisy od najnowszego, z nagłówkami miesięcy („listopad 2026”, 2.2) i saldem po każdym wpisie; usuwanie (z „Cofnij”, które przywraca wpis z tym samym id i datą) i edycja.
- **„Gotowe” w Terminach przy zwrocie (2.3).** Odhaczenie notatki terminu zwrotu (etykieta `długi`, a starszej — tytuł „Zwrot od…” / „Oddać…”) pokazuje dymek „Oznaczyć jako oddane?” z osobą i kwotą salda. „Oddane” dopisuje spłatę na całe saldo (`settle: true`) z „Cofnij”. Dymek nie pojawia się, gdy osoba jest już rozliczona albo saldo jest po drugiej stronie niż notatka. Kod Długów dochodzi leniwie (`import("@/lib/debts/settleFromNote")` w `ReminderQuickActions.tsx`), więc nie trafia do paczki startowej — stąd etykieta wpisana tam jako tekst.
- **Edycja wpisu (1.5 — jak dodawanie).** Ołówek przy wpisie otwiera `EditDebtForm` w miejscu: rodzaj, osoba (z podpowiedziami), kwota, dzień, notatka i termin zwrotu. Błąd oznacza pole (`aria-invalid` + `aria-describedby`). Termin zwrotu tworzy notatkę (z etykietą `długi`), zmienia jej termin albo go zdejmuje (puste pole). Zapis zachowuje id i datę dodania; toast „Wpis poprawiony” ma „Cofnij”, które oddaje poprzedni wpis i poprzedni termin.
- **Narzędzia osoby (3.1, 3.2)** pod nagłówkiem arkusza:
  - **„Wyślij”** — wiadomość z saldem i wpisami („Ania — rozliczenie”, „Do oddania: …”, wiersze „05.10.2026 · Oddał mi · 25,50 zł · za co”) przez `shareOrCopy`: na telefonie arkusz udostępniania, na komputerze schowek. Kwoty zawsze widoczne — to wyraźne stuknięcie, a ukrywanie kwot chroni tylko ekran.
  - **„Przypomnij” (L2.2)** — tylko gdy osoba jest nam winna: krótka wiadomość bez historii, „Cześć! Przypominam o zwrocie 74,50 zł do 20.10.2026. Dzięki!”. Termin bierze z notatek przypomnień wpisów „Pożyczyłem” od ostatniego rozliczenia (`openEntries`: wcześniejsze pożyczki są spłacone, więc ich termin nie dotyczy obecnego salda; `reminders.get(dueNoteId)`): najbliższy nadchodzący, a gdy wszystkie minęły — ostatni, wtedy „(termin był …)” (`reminderDue`, `personReminder`). Bez terminu — sama kwota.
  - **Dane do przelewu (L2.3, `0f124b58`, 2026-11-26)** — gdy osoba jest nam winna, a w „Dane do przelewu” jest poprawne konto albo BLIK, nad przyciskami jest pole „Dołącz dane do przelewu (Przelew: PL61 1090 … · BLIK: 600 123 456)” (`debt-payment-toggle`), domyślnie zaznaczone. Linia trafia w „Wyślij” tuż pod kwotą, a w „Przypomnij” na koniec. Przy saldzie zerowym albo ujemnym linii ani pola nie ma. Pole żyje tylko do zamknięcia arkusza, nie ma swojego klucza. Opis wpisu w „Wyślij” idzie teraz jedną linią (`safeLine`), żeby nowa linia w opisie nie udawała linii z numerem konta.
  - **„PDF” (L4.4)** — rozliczenie do wydruku: osoba, „Stan na”, saldo i wszystkie wpisy od najnowszego z saldem po każdym (`buildDebtStatementPdf` w `lib/debts/statementPdf.ts`, wspólny `PdfWriter` z polską czcionką). Generator i jsPDF ładowane dopiero po kliknięciu; `sharePdf` udostępnia albo pobiera plik „Rozliczenie - {osoba}.pdf”.
  - **„Zmień nazwę”** — nowa nazwa dla wszystkich wpisów osoby naraz. Nazwa innej istniejącej osoby łączy je („Połączono z …”).
  - **„Połącz z…”** — wybór innej osoby i potwierdzenie; jej wpisy przechodzą pod tę nazwę, saldo się sumuje.
  - Zmiana nazwy i łączenie to jedna transakcja Yjs (`renamePeople` → `replaceMany`) z „Cofnij” (`restoreDebts(prev, nowaNazwa)` przywraca **tylko** pole `person` i tylko we wpisach, które nadal noszą nową nazwę — kwota zmieniona w tym czasie na drugim telefonie zostaje, R-18). Arkusz zostaje otwarty na osobie po nowej nazwie.
- **Dane do przelewu (L2.3).** Zwijany blok „Dane do przelewu” na dole widoku (`PaymentSettings`, `debt-payment-settings`) ma dwa pola: numer konta i telefon do BLIK-a. Zapis następuje przy wyjściu z pola. Zły numer konta albo BLIK nie jest zapisywany i dostaje komunikat w `role="alert"`. Konto ze złą sumą kontrolną jest zapisywane (do poprawienia), z ostrzeżeniem, ale nie trafia do wiadomości, bo literówka w koncie jest gorsza niż brak konta. „Użyj konta z Pracy” kopiuje jednorazowo poprawne konto z Ustawień → Praca; nie ma wspólnego klucza.
- **Eksport CSV (3.4).** „Eksport CSV” pod listą zapisuje `notki-dlugi-RRRR-MM-DD.csv`: Data, Osoba, Rodzaj, Kwota [zł], Za co, Saldo osoby [zł] (+ nam winna), od najstarszego. Pod polski Excel: średnik, BOM, CRLF, przecinek dziesiętny; pola tekstowe zaczynające się od `=`, `+`, `-`, `@`, tabulatora albo CR dostają apostrof (bez wstrzykiwania formuł), liczby nie.
- **Kopia zapasowa.** Pożyczki są w pełnej kopii. Przywracanie tylko dodaje brakujące wpisy (po id), niczego nie kasuje i nie nadpisuje wpisu o tym samym id, który już jest na telefonie.

### Gdzie jest

- `src/lib/debts/model.ts` — czysty model: `DebtKind`, `DEBT_KINDS`, `KIND_SIGN`, `DebtEntry` (z `dueNoteId` i `settle`), `cleanDebt`, `normalizeName`, `personKey` (grupowanie bez wielkości liter), `parseAmount`, `formatAmount`, `byNewest`, `balances`, `totals`, `knownPeople`, `debtSide`, `repaidShare`, `doubleSettle` (`DOUBLE_SETTLE_MS`), `runningBalances`, `foldName`, `DEBT_NOTE_LABEL`, `DEBT_KIND_LABEL`, `personStatement`, `debtsCsv`.
- `src/lib/debts/settleFromNote.ts` — `offerSettleFromNote(noteId)` (2.3): wyszukanie odwrotne po `dueNoteId`, pytanie i spłata. `store.ts` ma do tego `getDebts()`, a `hideAmounts.ts` — `getHideAmounts()`. Stałe: `DEBT_MAX_ENTRIES` 2000, `DEBT_PERSON_MAX` 40, `DEBT_NOTE_MAX` 200, `DEBT_MAX_AMOUNT` 100 000 000 gr (1 000 000 zł).
- `src/lib/debts/yDebts.ts` — `createYDebts(doc)`: mapa Y `debts` (klucz = id wpisu), origin `DEBTS_ORIGIN`. `get`, `add`, `remove`, `restore`, `replace` (zmiana w miejscu), `replaceMany` (kilka zmian jedną transakcją, bez dodawania), `dump`, `mergeDump`.
- `src/lib/debts/store.ts` — `useDebts()`, `getDebts`, `addDebt`, `addDebtFromText`, `removeDebt`, `restoreDebt`, `updateDebt` (przez `cleanDebt`), `renamePeople`, `restoreDebts`, `debtsDump`, `mergeDebtsDump`. Działają na `yjsStore.doc`.
- `src/components/debts/` (podział L1.1, `c6353a85`, 2026-11-25; wcześniej jeden plik 851 linii; w tym samym commicie L2.2, L4.2, L4.4): `DebtsView.tsx` (widok, magazyn rozwinięcia formularza, eksport CSV), `Summary.tsx` (podsumowanie, proporcja, `MonthCell`), `KindPicker.tsx`, `AddForm.tsx`, `People.tsx` (`People`, `PersonList`, `EmptySketch`), `PersonSheet.tsx` (`PersonSheet`, `PersonHistory` — historia, „Oddał całość”, baner podwójnego rozliczenia, cofnięcie; `PersonTools` — Wyślij, Przypomnij, PDF, Zmień nazwę, Połącz), `EditDebtForm.tsx`, `debtTypes.ts` (`DebtReminderApi`, `AddReminderNote`, `dueTitle`, `dueAt`, `hasDue`; `DebtReminderApi` reeksportowany z `DebtsView.tsx` dla `Index.tsx`). `DebtReminderApi` (`clear`, `restore`, `get`) i `addReminderNote(title, content, at, labels)` przychodzą z `Index.tsx` — etykietę dokłada widok, żeby `Index` (paczka startowa) nie importował modelu Długów.
- **Podpięcie:** `src/hooks/useFilteredNotes.ts` (typ `View` = `"debts"`), `src/pages/Index.tsx` (leniwy widok, bez listy notatek i wyszukiwarki), `src/components/BottomNav.tsx` (kafel „Długi” w „Więcej”), `src/components/sidebar/sidebarItems.ts`, `src/components/CommandPalette.tsx`, `src/components/AppHeader.tsx` (tytuł), `src/lib/viewRoute.ts` (adres `/dlugi`).
- **Dane do przelewu (L2.3):** `src/lib/paymentDetails.ts` (`cleanAccount` → `{ value, status: empty|invalid|badChecksum|ok }`, `ibanChecksumOk`, `formatAccount`, `cleanBlik`, `formatBlik`, `paymentLine`); `src/lib/debts/payment.ts` (`DebtPayment`, `cleanDebtPayment`, `useDebtPayment`, `setDebtPayment`); `src/components/debts/PaymentSettings.tsx`; `personStatement(p, payment)` i `personReminder(p, due, now, payment)` w `model.ts`; przełącznik w `PersonTools` (`PersonSheet.tsx`).
- **Kopia:** `src/lib/noteSchema.ts` (pole `debts` w `fullBackupSchema`), `src/lib/exportNotes.ts` (zapis w `buildFullBackupWithReport`, scalanie w `restoreFullBackup`, przez dynamiczny import).

### Jak działa i dlaczego

- **Klucz na wpis.** Każdy wpis to osobny klucz mapy Yjs, więc dwa telefony dopisujące pożyczki scalają się bez strat. Ten sam wpis edytowany równocześnie wygrywa w całości.
- **Kwoty w groszach** (liczby całkowite). `parseAmount` przyjmuje „1 234,5”, „1234.50”, „80”; odrzuca zero, litery, więcej niż dwa miejsca po przecinku i ponad 1 000 000 zł.
- **Saldo i kolejność.** Saldo osoby = suma `KIND_SIGN × kwota`. Kolejność: nam winni, my winni, rozliczeni. Osoby grupowane bez względu na wielkość liter („Anna” = „anna”).
- **Nieprawidłowe wpisy od peera** są pomijane po cichu przy odczycie (`cleanDebt` zwraca `null`).
- **Nieznane pola (Z-17.3).** `cleanDebt` odkłada pola, których ta wersja nie zna, w `extra` (`src/lib/extraFields.ts`: `pickExtra`, `extraOf`), a każdy zapis w `yDebts.ts` (`put` → `toStored`) wraca je na wierzch wpisu. Pole z nowszej wersji przeżywa więc edycję, zmianę nazwy, „Cofnij”, kopię i scalenie. Limity: 8 kluczy `[a-z][A-Za-z0-9]{0,23}`, wartości proste (tekst do 200 znaków) albo płaskie tablice do 16, razem do 512 B JSON. Pole `v` to minimalna wersja czytelnika: wpis z `v` > `DEBT_ENTRY_V` (1) jest dla tej wersji niewidoczny, ale zostaje w mapie i da się go usunąć. `SCHEMA_VERSION` = 3 (tylko ostrzeżenie `olderDevices`).
- **Usuwanie uszkodzonego wpisu.** `remove` kasuje też wpis, którego `cleanDebt` nie przepuszcza. Inaczej zajmowałby miejsce w limicie 2000 (L9).
- **Waluta.** Zawsze złote (zł).
- **Dane do przelewu tylko na urządzeniu (L2.3, przegląd `security-reviewer` 2026-11-26).** Klucz `kaczy.debts.payment.v1` (`POWLOKA.debtsPayment`) = `{ account?, blik? }` jest w `keys.ts` oznaczony `sensitive`, tak jak konto Pracy. Nie idzie więc do kopii JSON, a przywracanie zapisuje tylko klucze z listy kopii, więc spreparowana kopia go nie podmieni. Nie trafia też do synchronizacji (ta przenosi dokument Yjs, nie `localStorage`) ani do raportu diagnostycznego. Numer nie jest zapisywany w notatce przypomnienia ani w PDF. Czyszczenie działa przez listę dozwolonych znaków, nie listę zakazanych: NFKC, wielkie litery, zdjęcie spacji, myślników i znaków formatu (`\p{Cf}`: zerowa szerokość, przełączniki kierunku, BOM). Potem zostać może tylko `^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$`, a polski IBAN musi mieć dokładnie 28 znaków. 26 cyfr to polskie konto i dostaje „PL”. Cyfry pełnej szerokości NFKC zamienia na zwykłe, a cyfry innych pism są odrzucane. BLIK to dokładnie 9 cyfr po zdjęciu +48 albo 0048. Konto zapisywane jest w postaci kanonicznej, a pokazywane w grupach po 4.
- **Scalanie kopii.** Przywrócona kopia nie kasuje długów. Wpis usunięty na jednym telefonie wróci, jeśli przywracamy kopię sprzed usunięcia — tak samo jak w pozostałych działach.

### Ograniczenia i pułapki

- Zmiana imienia w edycji przenosi jeden wpis do innej osoby (grupowanie po nazwie); wszystkie naraz — „Zmień nazwę” w arkuszu.
- Zmiana nazwy na dwóch telefonach naraz: każdy wpis wygrywa w całości, więc wpisy mogą skończyć pod dwiema nazwami — wtedy „Połącz z…”.
- Pułapka (złapana testem 3.4): `"=+-@".includes("")` to `true` — puste pole CSV dostawało apostrof; `textCell` sprawdza długość.
- Długi są w dokumencie notatek, więc idą z synchronizacją i z pełną kopią; nie ma ich w eksporcie tylko Nauki lub Grafiku, bo tam ich nie ma.
- Nie ma zapisu długu w innej walucie.
- Dane do przelewu nie przechodzą na nowy telefon ani z kopii — trzeba je wpisać na każdym urządzeniu (świadoma decyzja, jak konto Pracy). Konto Pracy (`kaczy.study.bankAccount.v1`) czyści się nadal samym `safeLine`, które nie usuwa znaków zerowej szerokości; przejście Pracy na `cleanAccount` to osobny krok, bo konto trafia też do faktury KSeF.
- **Reguła dla nowych pól (plan zgodności §1.4):** pole, które tylko podpowiada, może iść do wpisu. Pole, które wiąże wpisy (grupa, plan rat, dowód), idzie do osobnej mapy Yjs (`debtGroups`, `debtPlans`, `debtProofs`) z własnym polem w kopii. Pole, które zmienia znaczenie kwoty (waluta), idzie do osobnej mapy — wersje sprzed Z-17.3 gubią nieznane pola wpisu i źle liczą takie wpisy.

### Testy

- `src/lib/debts/model.test.ts` — kwoty, czyszczenie, znaki salda dla czterech rodzajów, sortowanie; L2.3: linia płatności tylko przy saldzie > 0, opis z nową linią jedną linią.
- `src/lib/paymentDetails.test.ts` — L2.3: RLO, U+200B, NBSP, BOM, cyfry pełnej szerokości i arabskie, 26 cyfr bez PL, zła długość, zła suma, BLIK z +48/0048, 8 i 10 cyfr, `paymentLine`.
- `src/lib/secretsLeak.test.ts` (klucz na liście wrażliwych, znacznik poza kopią i raportem), `src/lib/fullBackup.test.ts` (dane poza kopią; obcy klucz w ustawieniach kopii nie trafia do `localStorage`), `src/components/debts/DebtsView.test.tsx` (linia w „Wyślij” i „Przypomnij”, odznaczenie, brak przy długu w drugą stronę), `e2e/debts-payment.spec.ts` (walidacja, zapis po przeładowaniu, przełącznik, axe arkusza i formularza).
- `src/lib/debts/yDebts.test.ts` — scalanie dwóch dokumentów, usunięcie i przywrócenie, śmieci od peera, powiadomienia.
- `src/lib/debts/yDebts.edit.test.ts` — `replace` i scalanie z kopii bez nadpisania.
- `src/lib/debts/yDebts.extra.test.ts` — nieznane pole przeżywa każdą drogę zapisu, limity `pickExtra`, `v`, R-18.
- `src/components/debts/DebtsView.test.tsx` — podsumowanie, pusta lista, edycja kwoty (ten sam id i grosze), zła kwota (`aria-invalid`), zmiana rodzaju, „Oddał całość” (z `settle`), pasek przy „Pożyczyłem od”, baner podwójnego rozliczenia, termin w edycji (zdjęcie i nowa notatka z etykietą).
- Etap 4: `model.test.ts` (stała barwa i inicjał), `DebtsView.test.tsx` (pasek proporcji, pusty stan, kółko), `e2e/debts-plan.spec.ts` (pusty stan na 390 px — fokus w „Kto”), zrzuty `e2e/visual.spec.ts` (`dlugi-*`, odświeżone 2026-11-02).
- `model.test.ts` (Etap 3) — wiadomość osoby, CSV (BOM, kolejność, znak salda, apostrof przed formułą, cudzysłów przy średniku, puste pole); `yDebts.test.ts` — `replaceMany` jedną transakcją; `DebtsView.test.tsx` — „Wyślij”.
- `src/lib/debts/settleFromNote.test.ts` — pytanie i spłata dla „Zwrot od” i „Oddać”, brak pytania przy rozliczonej osobie i saldzie po drugiej stronie.
- `DebtsView.test.tsx` (Etap 2) — rozliczeni zwinięci, szukanie bez polskich znaków, nagłówki miesięcy, „Wpis z {imię}”.
- `e2e/debts-due.spec.ts`, `e2e/debts-plan.spec.ts` — termin zwrotu w Terminach, notatka poza Skrzynką, rodzaj strzałkami (axe formularza), termin dodany w edycji, „Gotowe” w Terminach → „Oddane” → osoba w „Rozliczeni”, zwinięty formularz na 390 px, łączenie i zmiana nazwy z „Cofnij”, plik CSV.
- `src/lib/fullBackup.test.ts` — długi w kopii, przywracanie scala.
- Ręcznie w przeglądarce na szerokości telefonu: zapis, saldo, „Cofnij”, cztery rodzaje, „Oddałem całość”.

### Lint

- `eslint.config.js`: `src/lib/debts/yDebts.ts` i testy Długów są na liście dozwolonych importów `yjs`.

### Commity

- `94434d5` (2026-10-19) — dział Długi.
- `dada7f1` (2026-10-19) — rodzaje „Pożyczyłem od” i „Oddałem”.
- `011be10` (2026-10-20) — kopia zapasowa, edycja wpisu, cofnięcie rozliczenia.
- `1b8bcf8` (2026-10-20) — poprawka L9 (usuwanie uszkodzonego wpisu).
- `0755b9a` (2026-11-02) — plan Długów, Etap 1 (1.2–1.7).
- `dd1cead` (2026-11-02) — plan Długów, Etap 2 (2.1–2.5).
- `892b4fd` (2026-11-02) — plan Długów, Etap 4 (4.1–4.5, wygląd).
- `6f6ccf4` (2026-11-02) — plan Długów, Etap 3 (3.1, 3.2, 3.4).

### Raty (L2.1, Z-17.4, DL-1: jedna seria, 2026-11-18)

- **Co robi:** przy „Pożyczyłem” i „Pożyczyłem od” pole „W ratach (co miesiąc)”: liczba rat (2–60) i termin pierwszej raty (dzień miesiąca kolejnych rat z tej daty), podgląd „Rata: 100,00 zł, ostatnia …”. Powstaje jedna notatka z etykietą `długi`, serią miesięczną do dnia ostatniej raty. W arkuszu osoby blok „Rata 2 z 6 · 100,00 zł · do 10.02.2026”, wpłacona część, „Zaległe raty: N” i przycisk „Rata wpłacona (…)” z „Cofnij”. „Gotowe” na notatce planu pyta „Rata wpłacona?” zamiast „Oznaczyć jako oddane?”.
- **Gdzie jest:** `src/lib/debts/plans.ts` (`DebtPlan`, `cleanPlan`, `rateDue`, `rateAmounts`, `allocate`, `planState`, `rateEntryId`, `syncPlanNote`), `src/lib/debts/yDebts.ts` (mapa `debtPlans`: `plans`, `addPlan`, `dumpPlans`, `mergePlans`, `transact`; usunięcie pożyczki usuwa plan, `restore` go oddaje), `src/lib/debts/store.ts` (`useDebtPlans`, `addDebtPlan`, `attachPlanNote`, `payDebtRate` z `undo`, `withPlans`/`syncPlanNotes`), `src/lib/debts/settleFromNote.ts`, `src/components/debts/DebtPlans.tsx`, formularz w `DebtsView.tsx`. Kopia: pole `debtPlans` (`noteSchema.ts`, `MERGE_SECTIONS` „Raty” po „Długi”).
- **Jak działa** (`docs/plan-zgodnosc-i-obieg.md` §2.2): plan nie trzyma kwoty ani notatki — kwota to `amount` pożyczki, notatka to jej `dueNoteId`. Stan jest wyprowadzany: `allocate` zalicza spłaty osoby „najstarszy dług pierwszy” (art. 451 § 3 KC, nadpłata pokrywa następny dług), z pokrycia pożyczki wychodzą `done`, `partial`, `next`, `overdue`. Spłata ręczna, częściowa, nadpłata i usunięcie spłaty działają bez dodatkowego kodu. „Rata wpłacona” to zwykły wpis spłaty z id `dr-<planId>-<k>` — dwa telefony naraz zapisują jeden wpis (zajęty klucz → id losowe). Każda zmiana wpisów idzie przez `withPlans`: w tej samej transakcji `syncPlanNote` przesuwa termin notatki na następną ratę (tylko do przodu, o godzinie serii, `reminderDay` = dzień planu) albo zdejmuje go po ostatniej. „Cofnij” raty oddaje termin notatki tylko wtedy, gdy od tamtej chwili nikt go nie zmienił. Przy dwóch planach jednej pożyczki (dwa telefony) wygrywa starszy.
- **Ograniczenia:** notatka prywatna, w koszu albo przestawiona na jednorazową — skutek pomijany (prawda zostaje w wpisach). Starsza wersja aplikacji nie zna planu: widzi zwykłą pożyczkę i notatkę serii, „Gotowe” pyta o całość. Grupa „Zapłaciłem za…” (L3.1) — po DL-2.
- **Zaległe raty na Dziś (L2.4):** w karcie „Skrzynka, Ćwiczenia i raty” (`src/components/review/TodayPersonalRows.tsx`) wiersz „Jan: rata 2 z 6 · 100,00 zł, 5 dni po terminie” z „Wpłacona” (z „Cofnij”); stuknięcie w tekst otwiera Długi. Tylko raty (`overdueRates` w `plans.ts`) — pojedynczy termin zwrotu jest już na Dziś jako zaległa notatka `długi`, więc go nie dublujemy. Ukryte kwoty działają jak w Długach. Test: „overdueRates (L2.4)” w `plans.test.ts`; e2e brak (formularz nie pozwala na pierwszą ratę w przeszłości).
- **Testy:** `src/lib/debts/plans.test.ts` (dzień 29/30/31 przez 12 miesięcy zgodny z `getNextReminderTime`, suma rat, niezmiennik zaliczenia — `fast-check`, jeden wpis z dwóch dokumentów, `syncPlanNote`, usunięcie i „Cofnij”), `settleFromNote.test.ts` („Rata wpłacona?”), `e2e/debts-rates.spec.ts`.
- **Commit:** `42f7502a` — 2026-11-18.

## Ćwiczenia — odhaczenie odżywki i „Gotowe” na przypomnieniu (C1.4, Z-17.7, 2026-11-18)

- **Co robi:** „Wziąłem” na liście odżywek przesuwa dzisiejsze przypomnienie odżywki na jutro. „Gotowe” na przypomnieniu (kafel terminu, powiadomienie systemowe, alarm natywny) odhacza odżywkę w dniu wystąpienia. „Gotowe” z powiadomienia o zwrocie długu pyta teraz o spłatę tak samo jak kafel (R-19). „Cofnij” cofa oba skutki.
- **Gdzie jest:** `src/lib/supplements/takeFlow.ts` — `setTaken`, `takenFromReminder`, typ `TakeDeps`; `supplementTakeDeps` w `src/lib/supplements/store.ts`; `src/lib/reminderDoneHooks.ts` — `afterReminderDone`, `isDebtNote` (przeniesione z `ReminderQuickActions.tsx`). Podpięcie: `ReminderQuickActions.tsx` („Gotowe”), `useReminderNotifications.ts` (`applyActionRef`; alarm natywny idzie tą samą drogą przez `nativeSink.ts`), `CwiczeniaView.tsx` (`takeSupplement`).
- **Jak działa:** prawda to klucz `dzień|id` w `supplementLog`, a termin w notatce jest skutkiem.
  - `setTaken(on)` w jednej transakcji `yjsStore.doc` zapisuje klucz (gdy go nie ma). Dla dzisiejszego dnia — gdy notatka-przypomnienie istnieje, nie jest w koszu, ma dzienną serię i bieżące wystąpienie najpóźniej dziś — zapisuje też łatkę `doneReminderUpdate`. `updateNote` z `useNotes` jest synchroniczny, więc mieści się w tej samej transakcji.
  - `setTaken(off)` zdejmuje tylko klucz.
  - `takenFromReminder` odhacza dzień wystąpienia, ale tylko dziś albo wczoraj (powiadomienie z 23:58 stuknięte po północy), i nie rusza notatki.
  - Każdy krok ma warunek, który po wykonaniu jest fałszywy, więc drugie wywołanie — z tego albo z drugiego telefonu — nic nie zmienia. Żadna funkcja nie woła drugiej, więc pętli nie ma.
  - `undo` cofa tylko to, co wywołanie faktycznie zmieniło.
  - `afterReminderDone` rozdziela po etykiecie (`długi` → `offerSettleFromNote`, `ćwiczenia` → `takenFromReminder`) i ładuje dział leniwie, więc paczka startowa nie rośnie.
- **Ograniczenia i pułapki:**
  - Notatka prywatna: pola terminu są jawne, więc łatka działa bez skarbca.
  - Gdy notatki nie ma, odhaczenie jest zapisane, ale skutek pominięty.
  - Starszego wystąpienia niż wczoraj „Gotowe” nie odhacza.
  - Pytanie o ratę przy planie spłat (L2.1) dojdzie z Z-17.4.
- **Testy:** `src/lib/supplements/takeFlow.test.ts` sprawdza:
  - jedną transakcję i idempotencję;
  - dwa dokumenty naraz — jeden klucz i ten sam termin;
  - brak notatki, kosz, regułę inną niż dzienna, notatkę prywatną;
  - wczorajsze wystąpienie po północy;
  - „Cofnij” tylko własnych zmian.

  Do tego `src/components/cwiczenia/CwiczeniaView.test.tsx` i `e2e/cwiczenia-tydzien.spec.ts`.
- **Commit:** zob. historię z 2026-11-18 („Z-17.7”).

## Ćwiczenia — stan aktualny (odżywki, dieta, trening)

Dział opisany w jednym miejscu; zmiany z przeglądu L1–L20 są już uwzględnione.

### Co robi

- **Wejście.** Osobna pozycja „Ćwiczenia” w menu, na pasku dolnym (w „Więcej”), w palecie poleceń i w pasku bocznym.
- **Odżywki** (karta na górze). Lista pogrupowana rano / w ciągu dnia / wieczorem; każdą pozycję odhacza się na dziś (licznik „dziś N z M”).
  Pusta lista ma przycisk „Dodaj kreatynę (rano, 1 łyżka)”, który od razu tworzy przypomnienie o 7:30.
  Formularz: nazwa, dawka, pora, „Przypominaj codziennie o” z godziną (domyślnie 7:30 / 12:00 / 20:00 wg pory).
  Usunięcie z „Cofnij”, które przywraca odżywkę i jej przypomnienie z kosza.
- **Trening** (karta, nad dietą):
  - **Plan dni:** lista dni z ćwiczeniami i celem (np. „Klatka · 3 × 10”). Dodawanie: nazwa, ćwiczenia z katalogu (do 12), cel serii i powtórek. Usuwanie z „Cofnij”.
  - **Zapis treningu:** wybór ćwiczenia z katalogu (pogrupowane: klatka, biceps, triceps), wskazówka wykonania, 3 serie na start (do 30).
    Każda seria: powtórki (całkowite, 1–100) i ciężar w kg (co 0,5, opcjonalny). Uwagi do 200 znaków. Zapis w bieżącej godzinie, dziś.
  - **Wybór dnia planu** nad formularzem: ustawia pierwsze ćwiczenie dnia i tyle serii, ile zaplanowano, z celem powtórek.
  - **Przerwa:** po zapisie serii licznik 1:30 („Pomiń” kończy wcześniej). Na końcu krótka wibracja (`haptic("success")`).
  - **Sprzęt:** największy ciężar hantli (kg). Ciężar powyżej tego limitu w ćwiczeniu z hantlami pokazuje ostrzeżenie (zapis nadal możliwy).
    „Usuń limit” czyści ustawienie. Zapis wymaga wartości > 0.
  - **Wykres progresu:** przy ćwiczeniu z co najmniej dwiema sesjami z ciężarem — sparklajn (SVG) rekordów kolejnych sesji.
  - **Przypomnienie o treningu:** pole wyboru i godzina (domyślnie 18:00, okno do 20:00). Tworzy notatkę z dziennym powtarzaniem.
  - **Podpowiedź:** „Ostatnio (DD.MM): 10×20 kg, 8×22 kg” i przycisk „Użyj ostatnich”, który wypełnia serie.
  - **Dziś:** dzisiejsze wpisy z sumą serii i objętością (suma powtórek × kg).
  - **Progres:** per ćwiczenie — rekord ciężaru (kg, dzień) i liczba sesji.
  - Katalog startowy: klatka (wyciskanie hantli na płaskiej i skosie, rozpiętki), biceps (uginanie ze sztangielkami, młotkowe, na ławce skośnej), triceps (wyprost nad głową, w opadzie, prostowanie leżąc). Treść wskazówek do sprawdzenia przez właściciela.
- **Dieta** (karta na dole):
  - **Dziś:** suma kcal i białka z dzisiejszych posiłków, z celem (jeśli ustawiony) i liczbą posiłków bez wartości.
  - **Lista posiłków dnia** wg godziny. Usuwanie z „Cofnij”.
  - **Dodawanie:** opis, godzina (domyślnie teraz), kalorie i białko (oba opcjonalne). Nie-liczba lub wartość poza zakresem blokuje przycisk i oznacza pole.
  - **Szybki posiłek (2.4, 2026-11-06):** pod opisem pigułki 5 ostatnich różnych posiłków (z kcal); stuknięcie wypełnia opis, kcal i białko, a zapis zostaje przyciskiem. „Powtórz wczoraj · N posiłków” (tylko gdy wczoraj coś było) kopiuje wczorajsze posiłki na dziś z tymi samymi godzinami; „Cofnij” usuwa wszystkie dodane.
  - **Cele dzienne:** kcal i białko, puste = bez celu.
  - **Ostatnie 7 dni:** dzień (DD.MM), suma kcal i białka; dni bez posiłków to „—”.

### Gdzie jest

- **Odżywki:**
  - `src/lib/supplements/model.ts` — `Supplement`, `SupplementWhen`, `cleanSupplement` (wejście z dokumentu, kopii i peera), `logKey` / `parseLogKey` (klucz `dzień|id`), `bySupplementOrder`.
  - `src/lib/timeOfDay.ts` — `nextReminderAt(hhmm, now)`: najbliższy moment „HH:MM” (dziś, a jeśli minął — jutro). Wspólne dla Odżywek i Treningu.
  - `src/lib/supplements/ySupplements.ts` — `createYSupplements(doc)`: mapy Y `supplements` (id → odżywka) i `supplementLog` (`dzień|id` → true), origin `SUPPLEMENTS_ORIGIN`, `dump()` / `mergeSupplementDump`.
  - `src/lib/supplements/store.ts` — `useSupplements()`, `useSupplementsTaken()`, `addSupplement`, `removeSupplement`, `restoreSupplement`, `setSupplementTaken`, `supplementDump`, `mergeSupplementDump`.
  - `src/components/cwiczenia/CwiczeniaView.tsx` — widok, `createSupplement` (odżywka + notatka-przypomnienie), `deleteSupplement`, `removeWithUndo`, `AddSupplementForm`.
- **Dieta:**
  - `src/lib/diet/model.ts` — `Meal`, `DietGoals`, `cleanMeal`, `cleanGoals`, `cleanAmount`, `byMealOrder`, `summarizeDay`, `summarizeRange(meals, endDay, days, addDays)` (funkcja dat wstrzykiwana, model czysty), `recentMeals(meals, limit)` (różne po opisie bez wielkości liter i nadmiarowych spacji, zostaje najnowszy wpis), `repeatDayInputs(meals, from, to)` (posiłki dnia jako nowe wpisy, w kolejności dnia).
  - `src/lib/diet/yDiet.ts` — `createYDiet(doc)`: mapa `dietMeals` (id → posiłek), `dietMeta` (`goals`), `dietFavorites` (ulubione, C4.1), origin `DIET_ORIGIN`. `getGoals()` zwraca zamrożony obiekt z cache (stabilny dla `useSyncExternalStore`). `restore` pilnuje limitu `DIET_MAX_MEALS` (ponad limit posiłek nie wchodzi, zwraca `false`).
  - `src/lib/diet/store.ts` — `useMeals()`, `useDietGoals()`, `addMeal`, `removeMeal`, `restoreMeal`, `setDietGoals`, `dietDump`, `mergeDietDump`.
  - `src/components/cwiczenia/DietSection.tsx` — sekcja (podsumowanie, lista, formularze, tydzień); `repeatYesterday` (dodaje przez `addMeal`, „Cofnij” przez `removeMeal`), pigułki w `AddMealForm` (`data-testid="diet-recent"`).
- **Trening:**
  - `src/lib/training/catalog.ts` — `EXERCISES`, `MUSCLE_GROUPS`, `exerciseById`, `isKnownExercise`.
  - `src/lib/training/model.ts` — `TrainingSet`, `TrainingEntry`, `PlanDay`, `TrainingReminder`, `TrainingEquipment`, `cleanKg`, `cleanSet`, `cleanEntry`, `cleanPlanDay`, `cleanTrainingReminder`, `cleanEquipment`, `overDumbbell`, `bestKg`, `bestKgSeries`, `volumeOf`, `byTrainingTime`, `progressByExercise`, `planLine`.
  - `src/lib/training/yTraining.ts` — `createYTraining(doc)`: mapy `trainingLog` (id → wpis) i `trainingPlans` (id → plan); meta `reminder` i `equipment` (typ `unknown`, odczyt przez `metaSnapshot` z cache). Origin `TRAINING_ORIGIN`. `setReminder` czyści przez `cleanTrainingReminder`. `mergeDump(raw, hasNote?)`.
  - `src/lib/training/store.ts` — `useTrainingEntries()`, `useTrainingPlans()`, `addTrainingEntry`, `removeTrainingEntry`, `restoreTrainingEntry`, `addPlanDay`, `removePlanDay`, `restorePlanDay`, `trainingDump`, `mergeTrainingDump(raw, hasNote?)`.
  - `src/components/cwiczenia/` (podział C1.2, `27fd0b5b`, 2026-11-25; wcześniej jeden plik 743 linie): `TrainingSection.tsx` (karta, `WeekSummary`, `EntryRow`, `TrainingReminderControl`), `LogForm.tsx` (`LogForm`, `NewExerciseForm`, `SessionBanner`), `RestTimer.tsx` (`RestTimer`, `RestControl`), `ProgressList.tsx` (`ProgressList`, `ExerciseHistory`, `Sparkline`), `PlanForms.tsx` (`PlanList`, `AddPlanForm`), `EquipmentForm.tsx`, `trainingFormat.ts` (`setsLine`, `parseNum`, `parseKg`, `emptyRow`, `SetRow`, `nowHHMM`, `shortDay`). Bez zmian zachowania.
- **Kopia:** `src/lib/noteSchema.ts` (pola `supplements`, `diet`, `training` w `fullBackupSchema`, zod z `.catch(undefined)`), `src/lib/exportNotes.ts` (zapis w `buildFullBackupWithReport`, scalanie w `restoreFullBackup`; oba przez dynamiczny import, żeby nie dokładać do paczki startowej).
- **Podłączenie działu:** `src/hooks/useFilteredNotes.ts` (typ `View`), `src/hooks/useSelectionGestures.ts`, `src/lib/viewRoute.ts` (`/cwiczenia`), `src/components/sidebar/sidebarItems.ts`, `src/components/BottomNav.tsx`, `src/components/CommandPalette.tsx`, `src/components/AppHeader.tsx`, `src/components/EmptyState.tsx`, `src/pages/Index.tsx` (leniwy import, render w `ViewErrorBoundary`).

### Jak działa i dlaczego

- **Dane w Yjs.** Wszystkie trzy części są w tym samym dokumencie co notatki: działają synchronizacja, kopia i plik. Każda odżywka, posiłek, wpis treningu i plan to osobny klucz mapy, więc dwa telefony dopisujące różne pozycje scalają się bez strat. Zapis i odczyt przechodzą przez `clean*`; zła wartość nie wejdzie do dokumentu.
- **Odhaczenia.** Odhaczenie to wpis `dzień|id`. Odznaczenie kasuje wpis; usunięcie odżywki kasuje wszystkie jej odhaczenia w tej samej transakcji.
- **Przypomnienie (odżywki i trening).** To zwykła notatka z `reminder` o najbliższej godzinie i `reminderRepeat: "daily"` — ten sam mechanizm co Przypomnienia (powiadomienia, „Dziś”, serie). Id notatki zapisane w odżywce (`reminderNoteId`), żeby usunięcie odżywki mogło przenieść przypomnienie do kosza. Zapis odrzucony (np. pełna lista) sprząta świeżo utworzoną notatkę. Zmiana godziny lub wyłączenie treningu sprząta poprzednią notatkę.
- **Rekord i progres.** Rekord ciężaru to najcięższa seria z całej historii, z dniem jej wykonania. Ostatnia sesja to ostatni wpis ćwiczenia w kolejności dzień → godzina → czas dodania.
- **Plany.** Nie zmieniają dziennika: usunięcie dnia planu zostawia wpisy treningu.
- **Dieta — sumy.** Liczą tylko podane wartości; posiłek bez kalorii jest na liście i w liczniku, ale nie zaniża sumy.
- **Cele diety.** Jeden klucz `goals`; zapis celów nadpisuje wartość na tym telefonie.
- **Kopia — scalanie.** Przywracanie tylko dodaje brakujące odżywki, odhaczenia, posiłki, wpisy i plany; niczego nie kasuje. Cele diety z kopii trafiają tylko, gdy na telefonie celów nie ma. Przypomnienie treningu wraca tylko, gdy istnieje jego notatka (`hasNote`). Odżywka dodana na telefonie po wykonaniu kopii zostaje.
- **Stabilny odczyt.** Hooki zwracają obiekty z cache, bo `useSyncExternalStore` przy każdym odczycie porównuje referencje. Brak tego cache powodował błąd `/cwiczenia` (commit `68ac7d9`).
- **Dzień.** Lokalny `localDayKey()`. Formularze wpisów (dieta, trening) zawsze używają dziś.

### Ograniczenia i pułapki

- Przypomnienie jest w dwóch miejscach: odżywka odhacza się w Ćwiczeniach, a „Gotowe” w Przypomnieniach przesuwa tylko serię tej notatki. Nie zamykają się nawzajem.
- Odhaczenia nie wracają przez „Cofnij” przy usunięciu odżywki (dzienny stan jest zbędny po usunięciu).
- Notatka-przypomnienie jest zwykłą notatką: widać ją na liście i w koszu.
- „Powtórz wczoraj” nie sprawdza, czy dziś już są te same posiłki — drugi raz doda drugie kopie (stąd „Cofnij”). Przy pełnej liście (`DIET_MAX_MEALS`) dodaje tyle, ile się zmieści, i podaje liczbę w dymku.
- Brak bazy produktów; kalorie i białko wpisujesz ręcznie. Limity: opis posiłku 200 znaków, kcal do 10 000, białko do 1 000 g; wartości zaokrąglane do całości.
- Limity danych: 5 000 posiłków, 5 000 wpisów treningu, 20 planów.
- Wpisy treningu: ciężar co 0,5 kg, powtórki całkowite. Wybór dnia planu tylko ustawia ćwiczenie i serie; ciężary wpisujesz ręcznie.
- Przerwa (licznik 1:30) startuje po zapisie serii, tylko na tym ekranie; nie zapisuje się w danych.
- Wibracja tylko tam, gdzie przeglądarka ma `navigator.vibrate` (Android). Respektuje „Wibracje na telefonie” w ustawieniach efektów.
- Wykres to sparklajn bez osi i dat — pokazuje kierunek; dokładne liczby są w „rekord … kg”.
- Przypomnienie o treningu: domyślnie 18:00, opis podaje okno do 20:00.
- Kopia: sekcje `supplements`, `diet`, `training` są opcjonalne; plik sprzed tych zmian przywraca się bez zmian.

### Testy

- `src/lib/supplements/model.test.ts` (czyszczenie, klucze, kolejność, przypomnienie; `nextReminderAt` z `lib/timeOfDay.ts`).
- `src/lib/supplements/ySupplements.test.ts` (dodawanie, duplikaty, odhaczenia, usuwanie z odhaczeniami, śmieci od peera, origin).
- `src/components/cwiczenia/CwiczeniaView.test.tsx` (pusty stan, grupy i postęp, odhaczenie, formularz, przypomnienie, sprzątanie po odrzuconym zapisie).
- `src/lib/diet/model.test.ts`, `src/lib/diet/yDiet.test.ts` (w tym regresja: dwa odczyty celów to ten sam obiekt), `src/components/cwiczenia/DietSection.test.tsx`.
- `src/lib/training/model.test.ts`, `yTraining.test.ts`, `reminder.test.ts` (domyślna godzina, czyszczenie, kopia, stabilny odczyt), `reminderRestore.test.ts` (H2, M2, M3), `equipment.test.ts` (limit, ostrzeżenie, rekordy dla wykresu).
- `src/components/cwiczenia/TrainingSection.test.tsx` (pusty plan, zapis serii, walidacja ułamków, „Użyj ostatnich”, dziś i progres).
- `src/lib/fullBackup.test.ts` (odżywki, posiłki, cele i trening w kopii; przywracanie scala).
- `src/test/setup.ts` — stub `ResizeObserver` dla Radix (Checkbox), którego jsdom nie ma.
- E2E tego działu nie uruchamiano (pełne e2e odłożone).

### Budżet paczki i lint

- Próg `eagerJsGzip` w `e2e/bundle.spec.ts`: 393 KB (datowany komentarz). Ostatni pomiar po przeglądzie: 392,3 KB.
- `eslint.config.js`: na liście dozwolonych importów `yjs` są `supplements/ySupplements.ts` i testy, `diet/yDiet.ts` i testy, `training/yTraining.ts` i testy.

### Commity

- `cd83ffc` — odżywki (krok 1 planu Ćwiczeń).
- `ccce384` — dieta (krok 3).
- `c7736f0`, `9d8e57e`, `22e2495` — trening: katalog i dziennik, przypomnienie i przerwa, wibracja, sprzęt, wykres.
- `68ac7d9` — poprawka błędu `/cwiczenia` (stabilny odczyt celów diety).
- `b779947` — poprawki z przeglądu (H2, M2, M3); `1b8bcf8` — niskie punkty L1–L20 (L3, L4, L6, L7, L9).

## Ćwiczenia — zakładki na telefonie (Fala 4, 2026-10-22)

- **Co robi:** na telefonie (<640 px) u góry są zakładki Odżywki / Trening / Dieta i widoczna jest tylko wybrana sekcja. Na komputerze wszystkie trzy sekcje są jedna pod drugą jak dotąd, bez zakładek.
- **Gdzie:** `src/components/cwiczenia/CwiczeniaView.tsx` — stan `tab`, pasek `role="group" aria-label="Dział Ćwiczeń"` (`sm:hidden`), klasa `max-sm:hidden` na sekcjach poza wybraną. Sekcje są w DOM zawsze, więc testy jednostkowe i zapis danych nie zależą od zakładki.
- **Testy:** `e2e/cwiczenia-zakladki.spec.ts` (telefon @mobile i komputer); jednostkowe `cwiczenia/*.test.tsx` 25/25.
- **Kroje latin + latin-ext (Fala 4, 2026-10-22):** bez cyrylicy, greki i wietnamskiego (decyzja właściciela). `scripts/latin-fonts.mjs` tworzy z pakietów @fontsource kopie CSS z samymi blokami `latin` i `latin-ext` w `src/styles/fonts-latin/` (nagłówek każdego pliku mówi, skąd pochodzi). `src/main.tsx` importuje te pliki zamiast pakietów. CSS startowy: 45 777 → 35 113 B gzip. Po zmianie wersji @fontsource uruchom skrypt ponownie. Tekst w innym alfabecie spada na czcionkę systemową.

## Długi — termin zwrotu z przypomnieniem (Fala 5, pkt 5, 2026-10-22)

- **Co robi:** przy wpisie „Pożyczyłem” albo „Pożyczyłem od” można podać termin zwrotu (nieobowiązkowy, nie wcześniej niż dziś). Powstaje notatka „Zwrot od …” albo „Oddać …” z przypomnieniem o 9:00 tego dnia, więc trafia do Dziś, Terminów i powiadomień. Wpis pamięta id tej notatki (`dueNoteId`).
- **Gdzie:** `src/lib/debts/model.ts` (`DebtEntry.dueNoteId`, zachowywane przez `cleanDebt`); `src/components/debts/DebtsView.tsx` (`AddForm`: pole terminu, walidacja, tworzenie notatki przez prop `addReminderNote`); `src/pages/Index.tsx` (przekazuje `addNote`). Prop zamiast kontekstu, żeby widok dało się testować bez dostawcy notatek.
- **Ograniczenie:** termin ustawia się przy dodawaniu wpisu, nie przy edycji.
- **Termin a rozliczenie i usuwanie (1.1 i D-4, 2026-10-26).** „Oddał całość” / „Oddałem całość” zdejmuje przypomnienie z notatek tej osoby, które mają `dueNoteId` (`reminder: null`, notatka zostaje). „Cofnij” w dymku oddaje poprzednie terminy (`DebtReminderApi` w `DebtsView.tsx`, podpięte w `Index.tsx` jako `debtReminders`). Usunięcie wpisu z terminem pyta: „Usunąć też przypomnienie o zwrocie?” — „Usuń też przypomnienie” zdejmuje termin, „Zostaw przypomnienie” zostawia go. Przy zdejmowaniu terminu notatka nie znika, tylko przestaje dzwonić. Ograniczenie: zmiana wpisu (kwota, osoba) nie przenosi terminu.
- **Testy:** `e2e/debts-due.spec.ts` (notatka w Przypomnieniach; odrzucenie terminu w przeszłości; rozliczenie zdejmuje termin; pytanie przy usuwaniu i „Zostaw”); `src/components/debts` + `src/lib/debts`.

## Ćwiczenia — własne ćwiczenia treningu (Fala 5, pkt 6, 2026-10-22)

- **Co robi:** w Treningu można dodać własne ćwiczenie (nazwa, partia mięśniowa, sprzęt ławka/hantle, nieobowiązkowa wskazówka). Pojawia się w liście wyboru wpisu i w planie dnia. Usunąć można tylko własne ćwiczenie bez wpisów i bez dnia planu; inaczej komunikat mówi, dlaczego.
- **Gdzie:** `src/lib/training/catalog.ts` (rejestr `setCustomExercises`, `allExercises`, `cleanCustomExercise`, prefiks `wlasne-`, limit 30); `src/lib/training/yTraining.ts` (mapa Yjs `trainingExercises`, `addCustom`, `removeCustom`, synchronizacja rejestru przy każdej zmianie); `src/lib/training/store.ts` (`useCustomExercises`, `addCustomExercise`, `removeCustomExercise`); `src/components/cwiczenia/TrainingSection.tsx` (`NewExerciseForm`, lista wyboru, usuwanie).
- **Pułapka (naprawiona):** formularz nowego ćwiczenia jest w formularzu wpisu treningu. Zagnieżdżony `<form>` przejmował wysłanie i przeładowywał stronę, więc nic się nie zapisywało. Dlatego to `div` z przyciskiem `type="button"` i Enterem w polu nazwy.
- **Uwaga na starsze wersje:** wpisy i plany z własnymi ćwiczeniami czyta tylko wersja z tą zmianą. Starsza wersja odrzuci obce id (`isKnownExercise`) i przy zapisie może zgubić ćwiczenie z planu. Nie używać starszej wersji na urządzeniu, które dodaje własne ćwiczenia.
- **Testy:** `src/lib/training/customExercises.test.ts`; `src/components/cwiczenia/TrainingSection.test.tsx` (mock rozszerzony o nowe funkcje); `e2e/cwiczenia-wlasne.spec.ts` (dodanie i usunięcie). Jednostkowe trening 60/60; e2e Ćwiczeń 3/3.

## Ćwiczenia — masa ciała (C-2), Powłoka — nazwy widoków (VIEW_META 1.3) (2026-10-26)

- **Masa ciała (C-2):** czwarta zakładka „Waga” w Ćwiczeniach (`CwiczeniaView.tsx`, komponent `WeightSection.tsx`). Zapis ważenia dnia (masa 20–300 kg, z przecinkiem albo kropką, zaokrąglenie do 0,1), jeden wpis na dzień, lista ostatnich 14, zmiana względem poprzedniego ważenia i średnia z 7. Usunięcie z „Cofnij”.
- **Dane:** dokument Yjs notatek, mapa `weightEntries` (klucz = dzień) w `src/lib/weight/yWeight.ts`; logika i walidacja w `model.ts` (`parseKg`, `cleanWeight`, `weightTrend`); API dla UI w `store.ts`. Kopia zapasowa: pole `weight` (JSON tablica), scalane przy przywracaniu (dla tego samego dnia wygrywa nowszy zapis); `noteSchema.ts` i `exportNotes.ts`. Moduł Yjs dopisany do listy dozwolonych w `eslint.config.js`.
- **Ograniczenia:** jedno ważenie na dzień; pełna historia ma limit 1000 dni (`WEIGHT_MAX_ENTRIES`). Wykres masy nie jest zrobiony (plan mówi o zakładce, nie o wykresie).
- **Testy:** `src/lib/weight/model.test.ts`, `src/lib/weight/yWeight.test.ts`, `e2e/weight.spec.ts` (komputer i telefon).

- **Nazwy widoków (Powłoka 1.3, decyzja PW-1):** jedna tabela `VIEW_LABEL` w `src/lib/viewMeta.ts` (`viewLabel`). Paleta, skróty „g” (`goChord.ts`), pasek boczny (`sidebarItems.ts`) i kopia (`BackupSettings.tsx`) biorą nazwę stąd: „Grafik” zamiast „Grafik zmian”, „Terminy” zamiast „Przypomnienia”. Dolny pasek ma już te same nazwy. Tytuł w nagłówku (`AppHeader.tsx`) też bierze nazwę z `VIEW_LABEL` (poza folderem i etykietą) — wcześniej osobne warunki pominęły Skrzynkę i tytuł w `/skrzynka` był pusty (`4a2412d`). Test: `src/lib/viewMeta.test.ts`. Rozmiar paczki startowej nie był mierzony.

- **Katalog ćwiczeń (1.1 z planu Ćwiczeń):** partie plecy, barki, nogi, pośladki, brzuch, przedramiona, całe ciało; sprzęt: masa ciała, drążek, sztanga, gumy, maszyna, kettlebell (`src/lib/training/catalog.ts`, etykiety w `MUSCLE_GROUP_LABELS`). Dodane 18 ćwiczeń startowych; wskazówki to szkic do akceptacji właściciela (C-4). Nowe partie i sprzęt wdrażać po aktualizacji wszystkich urządzeń (C-1), bo starsza wersja nie zna nowych identyfikatorów. Testy: `src/lib/training/model.test.ts`, `customExercises.test.ts`.
- **Stan pozycji z listy:** U-2 (skaner QR ładowany leniwie, `SyncSettings.tsx`) i U-4 („Co nowego”: najwyżej 5 punktów, bez dymka przy samych poprawkach, `useWhatsNew.ts`) były już zrobione; sprawdzone 2026-10-26.
- **Commit:** niezacommitowane (do commita po zielonym e2e).

## Ćwiczenia — 7 dni zgodności odżywki i tydzień treningowy (3.2, 3.5, 2026-11-02)

- **Co robi.**
  - **3.2:** przy każdej odżywce 7 kropek ostatnich dni (od najstarszego do dziś; zielona — wzięta) i „6/7”. Czytnik: „W ostatnich 7 dniach: 6 z 7”.
  - **3.5:** w Treningu wiersz „Ten tydzień”: liczba dni z treningiem (pn–nd) i serie na partię od najczęstszej („2 treningi · serie: Klatka 6, Biceps 3”). Partii, której brakuje, nie było w tym tygodniu. Wiersza nie ma, gdy w tygodniu nie było treningu. Pod spodem (C3.2, `2c72b39e`, 2026-11-25) „W tym tygodniu bez: plecy, nogi”: duże partie (`MAJOR_GROUPS` = klatka, plecy, barki, nogi) bez ani jednej serii; trening całego ciała je pokrywa (`missedMajorGroups`, test w `src/lib/training/model.test.ts`, `training-week-missed`). Małe partie nie są wymieniane, żeby nie robić listy z dziewięciu pozycji.
- **Gdzie.** `weekAdherence` w `src/lib/supplements/model.ts`, `WeekDots` w `CwiczeniaView.tsx`; `trainingWeek` w `src/lib/training/model.ts` (partia z `exerciseById` — katalog i własne ćwiczenia), `WeekSummary` w `TrainingSection.tsx`.
- **Jak działa.** Bez nowych danych: zgodność z istniejących odhaczeń (`logKey(dzień, id)`), tydzień z wpisów treningu (`weekKeys` z `lib/week.ts`). Nic nie zmienia formatu, więc bez wymogu C-1.
- **Stan planu Ćwiczeń.** 1.1 (więcej partii i sprzętu) jest już w katalogu (`catalog.ts`), 3.1 (masa ciała, C-2) zrobione wcześniej. Otwarte m.in. 1.2–1.4, 2.1–2.7, 3.3, 3.4, Etap 4 — do sprawdzenia w kodzie przed realizacją.
- **Testy.** `src/lib/supplements/model.test.ts` (`weekAdherence`), `src/lib/training/model.test.ts` (`trainingWeek`: tydzień pn–nd, nieznane ćwiczenia pominięte), `e2e/cwiczenia-tydzien.spec.ts`.
- **Commit.** `93026b6` (2026-11-02).

## Skarbiec — stan aktualny (notatki prywatne; plan Skarbca 1.1, 2026-11-02)

Jedno miejsce z obrazem całości. Szczegóły kolejnych kroków są w wpisach „Skarbiec — …” niżej.

- **Co robi.** Notatkę można zablokować hasłem skarbca: tytuł, treść, lista zadań, etykiety i (format v2) metadane notatki są szyfrowane w przeglądarce. W dokumencie Yjs, w kopiach i w synchronizacji są tylko szyfrogramy. Zablokowana notatka to kafel z kłódką (`LockedNoteTile`); po odblokowaniu treść widać do blokady.
- **Przed czym chroni.** Odczyt pliku kopii, dokumentu synchronizacji albo bazy przeglądarki przez kogoś bez hasła; cudze urządzenie bez hasła; podmianę szyfrogramu na inną notatkę (id w AAD) i na inną epokę skarbca (epoka w AAD, v2); osłabienie parametrów przez peera (`minIterations`, pin skarbca na urządzeniu, `comparePin`).
- **Przed czym nie chroni.** Otwarta, odblokowana sesja; złośliwe rozszerzenie, keylogger, XSS, zrzut pamięci; jawne pozostają przypięcie, daty, termin przypomnienia (bez tekstu), sam fakt istnienia i przybliżony rozmiar; obrazy i załączniki (notatki z plikami nie da się zablokować — 3.3 otwarte); słabe hasło przy kradzieży kopii (atak offline); zapomniane hasło bez kodu awaryjnego; starsze jawne kopie sprzed zablokowania. Ten sam opis widzi użytkownik w Ustawieniach („Jak to działa i czego nie robi”).
- **Kryptografia.** AES-256-GCM. Losowy klucz danych opakowany kluczem z hasła (PBKDF2-SHA-256, `KDF_ITERATIONS` 600 000, górna granica `MAX_KDF_ITERATIONS`), opcjonalnie drugi raz kodem awaryjnym (160 bitów, base32 w grupach po 4, HKDF) i passkeyem z rozszerzeniem PRF (V-4). Format notatki v1 (AAD: id) i v2 (AAD: id + epoka, metadane w szyfrogramie), zapis v2 za bramką wersji schematu (V-3). Minimum hasła 12 znaków (V-1), `current-password` przy odblokowaniu (V-2). Pliki: `src/lib/vault.ts`, `src/lib/privateNotes.ts` (sesja skarbca: klucz i jawna treść tylko w domknięciu `createPrivateNotes`), `src/lib/private/` (A3.3, `28259123`, 2026-11-25, bez zmiany formatu: `content.ts` — `PrivateContent`, `PrivateMeta`, `parseContent`, `cleanPrivateMeta`, `privateMetaOf`, `knownContent`, `futureFieldsJson`, `parseFutureFields`; `noteCipher.ts` — `NOTE_FORMAT_V2_SCHEMA`, `encryptNoteWrite` (v1/v2 za bramką wersji); `throttle.ts` — licznik prób hasła `SKARBIEC.attempts`, `throttleDelayMs`), `src/lib/vaultPin.ts`, `src/lib/passkey.ts`. Nowe moduły są bezstanowe (klucz dostają jako argument); `privateNotes.ts` reeksportuje `PrivateContent`, `PrivateMeta`, `NOTE_FORMAT_V2_SCHEMA`, `throttleDelayMs`. Przegląd `security-reviewer` podziału: bez ustaleń (logika co do znaku, brak nowych dróg do klucza, brak cykli importów).
- **Sesja.** Klucz tylko w pamięci karty. Blokada: ręczna (kłódka w nagłówku, paleta, Ustawienia), po bezczynności (`kaczy.vault.autolock.v1`) i po schowaniu karty (`kaczy.vault.hiddenLock.v1`) — oba ustawienia na tym urządzeniu i w kopii ustawień (1.6); ostrzeżenie 30 s przed blokadą. Limit prób hasła i kodu: rosnące opóźnienie (`throttleDelayMs`, `kaczy.vault.attempts.v1`), tylko w tej przeglądarce.
- **Kod awaryjny.** Pokazywany raz po założeniu i zmianie hasła (kopiuj, `.txt`, druk — 1.7). Pole kodu przyjmuje dowolne separatory. Sprawdzenie bez zmiany hasła („Sprawdź kod awaryjny”, 2.4) i przypomnienie co 90 dni po odblokowaniu (wyłączalne).
- **Nie do odszyfrowania.** Szyfrogram z innym kluczem (spóźniony zapis po zmianie hasła, dwa skarbce założone offline) zostaje w dokumencie; kafel ma „Pobierz szyfrogram” (1.2 część 1). Odzysk starym hasłem — nie zrobiony, wymagania z przeglądu bezpieczeństwa w planie Skarbca.
- **Zmiana hasła i reset kodem awaryjnym (C-1, K0 cz. 1 planu `plan-skarbiec-krypto-2026-11-15.md`, 2026-11-20).** `rekeyInner` w `src/lib/privateNotes.ts` odszyfrowuje notatki epoką z nagłówka skarbca (`m.epoch`), nie z sesji. Wcześniej reset kodem po świeżym otwarciu aplikacji (sesja nieodblokowana, `sessionEpoch` = 0) nie czytał żadnej notatki v2, a mimo to zapisywał nowy klucz — stary przepadał razem z notatkami. Teraz zmiana klucza jest przerywana przed zapisem, gdy nie da się odszyfrować jakiejkolwiek notatki v2 albo żetonu nieznanej wersji (C-28), albo wszystkich notatek; pominąć wolno tylko obcy szyfrogram v1 obok czytelnych. Nagłówek, z którego wyprowadzono stary klucz, jest porównywany (odcisk) z bieżącym po `flush()` — zmiana w trakcie daje „Skarbiec zmienił się w trakcie”. Oba okna (zmiana hasła, reset kodem w `VaultDialogs.tsx`) pokazują liczbę pominiętych. Przerwanie rzuca `VaultUnreadableError` z polem `skipped` (id nieczytelnych). **„Usuń nieczytelne i kontynuuj”:** `changePassword` i `resetPasswordWithRecovery` przyjmują `RekeyOptions` (`withRecovery`, `dropUnreadable`); z `dropUnreadable: true` nieczytelne notatki (wszystkie pominięte, też obce v1) trafiają do kosza (`trashed`, `trashedAt`) w tej samej transakcji `store.rekeyVault(meta, next, metaUnchanged, trash)` co nowy klucz — ze starym szyfrogramem, więc kafel nadal oferuje „Pobierz szyfrogram”; reszta jest przeszyfrowana. `rekeyVault` sprawdza też, czy szyfrogramy z `trash` się nie zmieniły. W oknach (`ChangeForm`, `RecoverForm`) `UnreadableNotice` pokazuje liczbę (tytuły są w szyfrogramie, więc bez listy tytułów), wyjaśnia skutek i daje przycisk `destructive` „Przenieś nieczytelne do kosza i zmień hasło” / „… i ustaw nowe hasło”, który ponawia operację z opcją. **Ograniczenie:** notatka w koszu podlega zwykłemu opróżnianiu kosza — wtedy szyfrogram przepada. **Testy:** `src/lib/privateNotes.test.ts` (C-1 na nowej instancji, przerwanie bez zapisu, C-28 `v9.`, obcy v1 obok v2, `skipped` w błędzie i `dropUnreadable` — kosz, stary szyfrogram, nowe metadane, reszta czytelna nowym hasłem), e2e `private-notes.spec.ts`; przegląd `security-reviewer` bez ustaleń krytycznych; `src/lib/privateNotes.k04.test.ts` (K0 cz. 4): własny zapis metadanych w `rekeyInner` (flaga `ownMetaWrite`) nie wyzwala już obserwatora — wcześniej skarbiec blokował się 40 ms po zmianie hasła; obcy szyfrogram z synchronizacji jest oznaczany jako nieczytelny leniwie, przy pierwszym `ensureDecrypted` (do tego czasu `stats().undecryptable` go nie liczy). K0 cz. 2 (C-14): `parseContent` przenosi nieznane pola najwyższego poziomu treści (do 64 KB JSON; więcej — odrzucone z wpisem `logDiag`), więc edycja, migracja v1→v2 i duplikat ich nie kasują; zdjęcie blokady (`removeLock`) zapisuje je jako JSON pod kluczem `futureContent` (`FUTURE_CONTENT_KEY` w `src/lib/yjs/codec.ts`, reeksport z `yjsStore.ts`; trzeci argument `store.unlockNote`, odczyt `store.getFutureContent`) jawnej notatki w `Y.Map` — `plainFromYNote` go nie czyta, więc nie ma go w `Note` (UI, wyszukiwarka, eksport Markdown); ponowne `lockNote` wmieszuje te pola z powrotem do treści (znane pola mają pierwszeństwo, bez `__proto__`, limit 64 KB) i usuwa klucz. Synchronizacja niesie klucz razem z dokumentem; kopia JSON i import, które idą przez projekcję `Note`, oraz `upsertNote` budujący notatkę od nowa — go nie zachowują. Test `src/lib/privateNotes.k02.test.ts`. **Commit:** zob. „Skarbiec: C-1”. `peek()` zwraca tylko znane pola treści (`knownContent`, ten sam obiekt dla tej samej treści), bo karta składa `{ ...note, ...content }` i pole z przyszłości (np. `id`, `images`) nadpisałoby notatkę; nieznane pola zostają w pamięci podręcznej i wracają przy zapisie (przegląd `security-reviewer` K0 cz. 2 i 4: bez krytycznych; drobne otwarte — limit 64 KB liczy jednostki UTF-16). `store.rekeyVault(meta, next, metaUnchanged?)` w `src/lib/yjs/vault.ts` przyjmuje predykat na bieżące metadane; `rekeyInner` przekazuje porównanie odcisku z `from`, więc nagłówek zapisany przez inne urządzenie podczas `createVault` i szyfrowania nie zostaje nadpisany — zmiana hasła kończy się błędem „Skarbiec lub notatki zmieniły się w trakcie”, nic nie jest zapisane (test C-1 w `src/lib/privateNotes.k04.test.ts`). **Otwarte (2026-11-20):** `futureContent` przy jawnej notatce gubią `upsertNote` i import kopii JSON (`replaceAll`), duplikat go nie kopiuje; zachowują go edycja, kopia dzienna i synchronizacja — `src/lib/futureContent.paths.test.ts`. Naprawa wymaga decyzji (pole w `Note` trafiłoby do UI i eksportu).
- **Testy charakteryzujące P1 i P2 (K0 cz. 3, 2026-11-20).** `src/lib/privateNotes.p1p2.test.ts` opisuje dzisiejsze zachowanie: P1 przy wygranej szyfrogramu telefonu (wyższy `clientID`) — notatka w `failed` na obu urządzeniach; przy wygranej laptopa — edycja telefonu ginie; P2 — notatki przegranego skarbca nieczytelne, jego hasło odrzucane. Po K3/K4 pierwszy i trzeci test mają się odwrócić (odzysk z `retired:*` / `pin.prev`), drugi zostaje. Bez zmian w kodzie.
- **Karta w Ustawieniach** (Ogólne → Prywatne notatki): stan, kod awaryjny i data sprawdzenia, liczba notatek prywatnych i nieodszyfrowywalnych, biometria, auto-blokada, opis ochrony. W wyszukiwarce `ma:prywatne` pokazuje same kafle prywatne (treść nadal poza indeksem).
- **Otwarte w planie.** 1.2 część 2, pozycja „Prywatne” w pasku bocznym (2.3 — zamiast niej filtr i karta stanu), 3.3 (szyfrowane pliki), Etap 4 (wygląd kafla w 4 stanach).

## Skarbiec — nowa notatka prywatna z kompozytora (2.2, 2026-11-06)

- **Co robi.** W kompozytorze nowej notatki jest przycisk z kłódką „Notatka prywatna”. Po włączeniu notatka zapisuje się zaszyfrowana od pierwszego znaku; jawny tekst nie trafia do dokumentu, do bazy przeglądarki ani do szkicu w `localStorage`. Bez skarbca przycisk otwiera zakładanie hasła, przy zablokowanym — odblokowanie, a po sukcesie tryb prywatny włącza się sam. Pod treścią widać „Zapisuje się zaszyfrowana hasłem skarbca…”.
- **Gdzie.** `src/components/AddNoteBar.tsx` (`isPrivate`, `privateId`, `enablePrivate`, `finishPrivate`, efekt synchronizacji ze skarbcem, gałąź prywatna w `commit`); `src/lib/privateNotes.ts` (`createNote`).
- **Jak działa.**
  - Pierwsza zmiana tekstu w trybie prywatnym woła `privateNotes.createNote({ title, content, checklist, labels })`: szyfrogram powstaje kluczem sesji (AAD: nowe id i epoka, jak `duplicate`), a w dokumencie ląduje pusta notatka `locked: true` z `vault`. Jawna treść jest tylko w pamięciowym `cache` skarbca.
  - Kolejne zmiany idą przez `yjsStore.patchNote(id, …)` z opóźnieniem 250 ms (jedna transakcja dokumentu na chwilę pisania, nie na każdy znak). Dla notatki zablokowanej `applyPatch` kieruje pola treści do sinka zapisu skarbca, który szyfruje je z własnym opóźnieniem (`writeDelayMs`). Kompozytor nie woła `onAdd`, więc notatka nie powstaje drugi raz.
  - W trybie prywatnym efekt `writeDraft` nic nie zapisuje, a włączenie trybu usuwa wcześniejszy szkic (`kaczy.draft.v1`). Lista robocza (`kaczy.drafts.v1`) jest ukryta w całości: i „Odłóż”, i wznawianie odłożonych szkiców (`resumeParked` odkładałby bieżący prywatny tekst jawnie).
  - Obrazy i pliki nie są szyfrowane (3.3), więc w trybie prywatnym `addImageFiles` odrzuca wklejony obraz z komunikatem, `AttachmentsPanel` (z upuszczaniem plików) nie jest renderowany, a rysunek nie otwiera się ani z paska, ani z akcji „Rysuj” długiego przytrzymania „+” (`pendingAction`; `onSave` płótna też odmawia) — bajty nie trafiają do IndexedDB. Chipy przechwytywania (`#etykieta`, daty, `@folder`) i „Trafi do: …” są ukryte, bo zapis prywatny ich nie stosuje. W wyborze etykiet nie ma pola „Nowa etykieta”, bo nazwa nowej etykiety zapisuje się jawnie na wspólnej liście.
  - Zamknięcie (Zapisz, Esc, klik poza edytorem) dopisuje ostatni tekst, woła `privateNotes.flush()` i czyści formularz (`finishPrivate`). Notatka, z której wszystko skasowano, jest usuwana, żeby nie została sama kłódka. „Odrzuć” i wybór szablonu (`discardDraft`) usuwają zaczętą notatkę prywatną. `reset` zawsze zeruje `isPrivate` i `privateId`, więc kolejna notatka nie dopisze się do poprzedniej. Zamknięcie w trakcie pierwszego szyfrowania czeka na nie (`closeAfterCreateRef`) i zapisuje najnowszy tekst z `latestPrivateRef`. Odrzucenie w trakcie szyfrowania zwiększa `privateGenRef`, więc utworzona chwilę później notatka jest usuwana zamiast zostać sierotą.
  - Blokada skarbca przy otwartej notatce prywatnej (auto-blokada, kłódka, zmiana hasła na innym urządzeniu): kompozytor śledzi fazę skarbca (`useSyncExternalStore`). W fazie „locking” dopisuje ostatni tekst (sink jeszcze ma klucz, a `lock()` zaraz zapisze kolejkę), a po blokadzie czyści edytor z komunikatem „Skarbiec zablokowany — notatka prywatna jest zapisana”. Jawny tekst nie zostaje na ekranie.
  - Notatka usunięta w trakcie pisania (tu albo na innym urządzeniu): efekt zeruje `privateId`, więc tekst z edytora trafia do nowej notatki prywatnej, zamiast przepaść.
  - Zapis musi dojść do skarbca, zanim formularz się wyczyści. Gdy skarbiec jest zablokowany (auto-blokada w trakcie pisania), zamknięcie nie czyści edytora: komunikat „Odblokuj skarbiec…”, okno odblokowania i ponowienie zapisu (`privateTick`). Gdy notatki nie ma jeszcze w pamięci skarbca (po ponownym odblokowaniu), efekt najpierw ją odszyfrowuje (`ensureDecrypted`); jeśli się nie da (hasło zmienione na innym urządzeniu), komunikat prosi o skopiowanie tekstu, a edytor zostaje otwarty.
  - Przełącznika nie da się wyłączyć w trakcie pierwszego szyfrowania ani po nim (powstałaby osierocona notatka prywatna i jawna kopia).
  - `createNote` nie tworzy notatki w trakcie zmiany hasła (flaga `rekeying` w `rekey`) ani gdy po szyfrowaniu zmieniły się klucz, epoka albo odcisk metadanych skarbca — token byłby pod klucz, którego nowa sesja nie ma.
  - Klik w okno skarbca (portal poza kompozytorem) nie zamyka edytora: `handleClickOutside` ignoruje kliknięcia, gdy `vaultUi.get()` jest ustawione.
- **Ograniczenia.** Notatka prywatna z kompozytora ma tylko tytuł, treść, listę zadań i etykiety. Obrazy, pliki, nagrania, rysunek, przypomnienie, priorytet, kolor i rodzic są ukryte. Gdy któreś z nich jest już ustawione, włączenie trybu kończy się komunikatem, żeby je najpierw usunąć. Po pierwszym zapisie trybu nie da się wyłączyć z kompozytora; blokadę zdejmuje menu notatki („Zdejmij blokadę”). Szkic prywatny nie przeżywa przeładowania strony jako szkic, ale treść jest już zapisana w notatce. Notatka powstaje poza folderem, nawet w widoku folderu; kolor i folder można zmienić po zapisie z menu notatki. Notatka z kompozytora składa swoje pola sama (`createNote`), obok fabryki `addNote` w `useNotes` — nowe pole domyślne trzeba dopisać w obu miejscach. Gdy z listy zdejmie się blokadę z notatki w trakcie pisania, kompozytor uzna ją za usuniętą i założy nową prywatną.
- **Przegląd bezpieczeństwa (2026-11-06, agent `security-reviewer`).** Znalazł dwa wycieki (wznawianie listy roboczej, wklejony obraz i upuszczony plik), utratę tekstu przy blokadzie, stan prywatny przeżywający `reset`, wyścig ze zmianą hasła i jawną nazwę nowej etykiety — wszystkie naprawione jak wyżej. Code-review (tego samego dnia) dołożył: odrzucenie w trakcie szyfrowania, jawny tekst na ekranie po blokadzie, notatkę usuniętą w trakcie pisania, rysunek z „+”, folder docelowy, chipy przechwytywania, zapis przy każdym znaku i słaby test blokady — naprawione. Zostaje znana luka spoza 2.2: `rekeyVault` nie wykrywa zapisu `writeNow` do istniejącej notatki w oknie zmiany hasła na innym urządzeniu.
- **Testy.** Vitest: `src/lib/privateNotes.test.ts` („nowa notatka prywatna (2.2)”: brak jawnego tekstu w dokumencie po `createNote` i po kolejnym zapisie przez sink; notatki tworzone w trakcie zmiany hasła dają się odczytać nowym hasłem albo nie powstają — test łapie wyścig bez poprawki; zablokowany skarbiec — po pełnym `await lock()` — nic nie tworzy). E2E: `e2e/private-notes.spec.ts` („kompozytor: blokada skarbca w trakcie pisania…”: blokada kłódką bez zamykania edytora czyści edytor, a treść jest w notatce po odblokowaniu; „kompozytor: notatka prywatna od pierwszego znaku…”: zakładanie skarbca z kompozytora, brak przycisków obrazu i pliku, brak sekretu w `localStorage` i IndexedDB przed i po zapisie, karta po odblokowaniu, brak treści w DOM po blokadzie).
- **Commit.** `eca55403` (kod), `9000cc63` (dokumentacja), 2026-11-06.

## Skarbiec — stany kafla, przejście przy blokadzie, miernik hasła i wygląd okien (Etap 4: 4.1–4.4, 2026-11-06)

- **Co robi.** Kafel prywatny ma 4 stany: zablokowany (linie, kłódka, „Odblokuj”), odszyfrowywanie (linie pulsują, „Odszyfrowuję…”; w trakcie blokady „Blokuję…”), nieodszyfrowywalny (obwódka błędu, „Pobierz szyfrogram”) i brak skarbca na urządzeniu (treść kafla w odcieniach szarości, przerywana obwódka; znacznik zaznaczenia zostaje w kolorze). Przy blokadzie otwarta notatka prywatna nie znika z siatki i nie wjeżdża od nowa jako kafel: kafel z kłódką pojawia się w tym samym miejscu, a jego linie krótko się „zamazują” (rozmycie i przenikanie, 280 ms). Okna skarbca mają w nagłówku tarczę w kółku (z ptaszkiem przy kodzie awaryjnym). Kod awaryjny to karta z grupami po 4 znaki w JetBrains Mono, po 4 w wierszu, rozdzielonymi przygaszonym myślnikiem. Miernik hasła: paski w kolorach stanu (`destructive`, `warning`, `success`) i poziom słowem w tym samym kolorze (`*-ink`) obok liczby znaków.
- **Gdzie.** `src/components/vault/PrivateNoteGate.tsx` (stan `sealed`), `src/components/vault/LockedNoteTile.tsx` (prop `sealed`, warianty `undecryptable`, `noVault`, `busy`), klasy `.vault-seal` i `.vault-decrypting` (puls z `view-skeleton-pulse`) w `src/index.css`; nagłówek, `StrengthMeter` i `RecoveryCodeStep` w `src/components/vault/VaultDialogs.tsx`.
- **Jak działa.**
  - Bramka pamięta, czy w poprzednim renderze pokazywała kartę z odszyfrowaną treścią (`shown`, wzorzec „stan z poprzedniego renderu”, bez refów w renderze). Gdy karta z treścią zamienia się w kafel, `sealed` = true: kafel dostaje `initial={false}` (bez wejścia z dołu i bez opóźnienia kaskady) i klasę `.vault-seal` na liniach. Kafle, które nigdy nie miały treści (nieodszyfrowywalne, jeszcze odszyfrowywane), nie dostają animacji, a krok „locking” → „locked” jej nie urywa. Ponowne pokazanie treści zeruje `sealed`.
  - „Odszyfrowuję…” i puls tylko wtedy, gdy jest szyfrogram (`note.vault`) — inaczej stan wisiałby bez końca.
  - Jawny tekst znika z DOM od razu, w pierwszym renderze blokady. Przenikanie dotyczy wyłącznie stałych linii kafla, więc nie przedłuża obecności treści na ekranie (zasada z `PrivateNoteGate`).
  - Redukcja ruchu: globalna reguła `html[data-motion="reduced"]` (ustawienie aplikacji albo systemu) wyłącza obie animacje; osobnych reguł dla skarbca nie ma.
  - Kod awaryjny: zwykły tekst w linii (nie siatka), więc ręczne zaznaczenie (`select-all`) i kopiowanie dają dokładnie `XXXX-XXXX-…` bez przełamań; grupy łamią się po 4 przez szerokość karty (`max-w-[26ch]`: 4 grupy z odstępami liter i wypełnieniem mieszczą się, 5 już nie).
- **Ograniczenia.** Plan 4.1 proponował napis „Ustaw skarbiec, żeby otworzyć” przy braku skarbca — celowo go nie ma: nowy skarbiec ma inny klucz i takiej notatki nie otworzy. Zostaje „Skarbiec nie jest ustawiony na tym urządzeniu.” i podpowiedź po stuknięciu (synchronizacja albo pełny backup). Wyszarzenie bez przezroczystości, żeby tekst trzymał kontrast WCAG AA, i tylko na treści kafla (filtr na całej karcie wyszarzyłby też zaznaczenie). Plan 4.4 mówił też o „krótkich zdaniach” w oknach — teksty okien zostały bez zmian (już krótkie po 1.4–1.7). Zrzuty `@visual` okien skarbca trzeba odświeżyć osobną konfiguracją (`playwright.visual.config.ts`).
- **Testy.** E2E: `e2e/private-notes.spec.ts` (kod awaryjny nadal ma tekst `XXXX-…` z myślnikami, druk zawiera grupy; blokada i odblokowanie kart).
- **Commit.** `9000cc63`, 2026-11-06.

## Skarbiec — karta stanu, sprawdzenie kodu awaryjnego, filtr ma:prywatne (1.6, 2.3 część, 2.4, 2.5, 2026-11-02)

- **Co robi.** W Ustawieniach → Ogólne → Prywatne notatki karta stanu (2.5): kod awaryjny „jest · sprawdzony: <data|nigdy>” albo „brak”, liczba notatek prywatnych (z podpowiedzią `ma:prywatne`) i — przy odblokowanym skarbcu — nieodszyfrowywalnych. Przycisk „Sprawdź kod awaryjny” (2.4) otwiera okno: wpisany kod jest sprawdzany bez zmiany hasła i sesji; sukces zapisuje datę. Po odblokowaniu, gdy od sprawdzenia albo przypomnienia minęło 90 dni, dymek „Masz zapisany kod awaryjny?” z „Sprawdź”; „Przypominaj co 90 dni” wyłącza go. Wyszukiwarka zna `ma:prywatne` (2.3). Ustawienia auto-blokady mają dopisek „na tym urządzeniu”, a „Blokuj po schowaniu karty” idzie teraz do kopii ustawień (1.6).
- **Gdzie.** `privateNotes.verifyRecoveryCode` i `privateNotes.stats` (`src/lib/privateNotes.ts`); `src/lib/vaultRecoveryCheck.ts` (klucz `kaczy.vault.recoveryCheck.v1`: `checkedAt`, `nudgedAt`, `off`; `recoveryCheckDue`); `CheckRecoveryForm` i przypomnienie w `finish` (`VaultDialogs.tsx`, rodzaj okna `checkRecovery` w `vaultUi.ts`); `VaultState` w `VaultSettings.tsx`; operator `private` w `searchQuery.ts` (`MatchNote.locked`) i podpowiedź w `searchSuggest.ts`; `SETTINGS_KEYS` w `exportNotes.ts`.
- **Jak działa.** Sprawdzenie działa tylko przy odblokowanym skarbcu (nie jest drugą drogą do odblokowania), rozpakowuje klucz kodem i go porzuca; zły kod liczy się do tego samego limitu prób co odblokowanie. Data sprawdzenia to zwykła preferencja urządzenia — bez kodu. Filtr: zapytanie z samym operatorem zawęża pełną listę, więc kafle prywatne zostają; tekst i tak omija notatki prywatne.
- **Ograniczenia.** Pozycji „Prywatne” w pasku bocznym nie ma — wyszukiwarka ma własny stan, którego nie da się ustawić z Ustawień bez przeładowania; zamiast linku karta podaje `ma:prywatne`. Data utworzenia skarbca nie jest zapisywana, więc karta jej nie pokazuje.
- **Testy.** `src/lib/privateNotes.test.ts` (sprawdzenie kodu, zły kod w limicie prób, brak sprawdzenia przy zablokowanym, statystyki), `src/lib/vaultRecoveryCheck.test.ts`, `src/lib/searchQuery.test.ts` (`ma:prywatne`, negacja), `e2e/private-notes.spec.ts` (filtr, karta stanu, zły i dobry kod z separatorami).
- **Commit.** `6666b29` (2026-11-02).

## Skarbiec — szyfrogram do pobrania i kod awaryjny: druk, wpisywanie (1.2 część 1, 1.7, 2026-11-02)

- **Co robi.**
  - **1.2 (część 1):** kafel notatki prywatnej, której nie da się odszyfrować bieżącym kluczem, ma przycisk **„Pobierz szyfrogram”**: plik `notki-szyfrogram-<id>.notki-vault` (JSON: `format: "notki-vault-note"`, `version`, `id`, `vault`, `exportedAt`) do ręcznego odzysku. „Usuń” (do kosza, z możliwością przywrócenia) był już na kaflu.
  - **1.7:** przy kodzie awaryjnym przycisk **„Drukuj”** — kartka z kodem w grupach po 4, datą i trzema zdaniami instrukcji. Pole kodu w „Mam kod awaryjny” samo zamienia litery na wielkie, wstawia myślniki co 4 znaki i przyjmuje wklejenie z dowolnymi separatorami (spacje, kropki, nowe linie). Plik `.txt` z kodem ma nazwę marki „notki” (dawniej „skarbca G”).
- **Gdzie.** `privateNotes.undecryptableToken(id)` (`src/lib/privateNotes.ts`) — szyfrogram tylko dla notatki z `failed`; `downloadCiphertext` w `src/components/vault/LockedNoteTile.tsx`; `formatRecoveryInput` w `src/lib/vault.ts`; `printRecoveryCode` w `src/lib/recoveryPrint.ts`; przycisk w `RecoveryCodeStep` (`VaultDialogs.tsx`).
- **Jak działa.** Szyfrogram to te same bajty, które są w dokumencie i w pełnej kopii — plik nie ujawnia niczego nowego. Id notatki przychodzi od peera, więc w nazwie pliku zostaje tylko `[A-Za-z0-9-]` (przegląd `security-reviewer` 2026-11-02). Kartka z kodem powstaje w niewidocznej ramce `iframe` (bez skryptów strony), więc kod nie trafia do DOM aplikacji; ramka znika po `afterprint` albo po minucie. `formatRecoveryInput` zostawia znaki spoza alfabetu (dekoder zgłosi błąd), żeby literówka nie znikała po cichu, i ucina do 32 znaków.
- **Ograniczenia.** Odzysk notatki innym (starym) hasłem albo kodem awaryjnym — **nie zrobiony**: aplikacja nie przechowuje starych nagłówków skarbca. Projekt z listą wycofanych nagłówków odrzucony w przeglądzie bezpieczeństwa (zderzenie zapisu z `meta`, możliwość podrzucenia klucza przez peera i „prania” treści, stare klucze pod wyciekłym hasłem); wymagania nowego projektu są w `docs/plan-skarbiec-2026-10-25.md` (1.2 część 2).
- **Testy.** `src/lib/privateNotes.test.ts` (szyfrogram tylko dla nieodszyfrowywalnej notatki), `src/lib/vault.test.ts` (`formatRecoveryInput`: grupy, wklejenie z separatorami dekoduje się do tych samych bajtów, długość), `e2e/private-notes.spec.ts` (kartka do druku zawiera kod w grupach, okno kodu zostaje otwarte).
- **Commit.** `0c41cf5` (2026-11-02).

## Skarbiec — ostrzeżenie przed blokadą i kłódka w nagłówku (1.3 i 2.1, 2026-10-26)

- **1.3 Ostrzeżenie przed auto-blokadą.** 30 s przed auto-blokadą po bezczynności pojawia się dymek „Zablokuję za 30 s” z przyciskiem „Jeszcze N min” (N = ustawiona blokada). Stuknięcie przedłuża blokadę i ostrzeżenie. Aktywność w oknie przesuwa ostrzeżenie o tyle, ile trwała bezczynność (`scheduleWarn` w `vaultAutoLock.ts`). Ostrzeżenie nie jest zależne od otwartej notatki (plan mówił „przy otwartej prywatnej notatce”; skarbiec odblokowany to dziś ten sam stan, więc nie dodawałem drugiego warunku). Szkic w edycji zapisuje się przed blokadą przez istniejącą kolejkę (bez zmian).
- **2.1 Kłódka w nagłówku.** Widoczna tylko, gdy skarbiec jest ustawiony (`phase !== "none"`). Odblokowany: ikona otwartej kłódki, podpowiedź z minutami do auto-blokady; stuknięcie blokuje (`lockEverywhere`). Zablokowany: zamknięta kłódka; stuknięcie otwiera odblokowanie (`vaultUi.open("unlock")`). Komponent `src/components/vault/VaultStatusButton.tsx`, wpięty w `AppHeader.tsx`.
- **Testy:** `src/lib/vaultAutoLock.warn.test.ts` (ostrzeżenie w 30 s i odsunięcie aktywnością); e2e `e2e/private-notes.spec.ts` (kłódka: blokada i odblokowanie); a11y (1440 px) zielone.
- **Nie zrobione w Skarbcu:** V-3 (format v2) i V-4 (biometria PRF) — patrz niżej.

## Skarbiec — format v2, krok 1 (V-3, 2026-10-26)

- **Co jest:** token `v2.iv.ciphertext` z AAD `notki:v2:<epoka>:<id>` (`noteAadV2`, `encryptNoteStringV2` w `vault.ts`). Odczyt `decryptNoteString` wybiera AAD po prefiksie wersji: `v1` jak dotąd, `v2` z epoką. Szyfrogram z innej epoki albo pod innym id nie odszyfruje się. `looksLikeVaultToken` przyjmuje v1 i v2.
- **Czego nie ma (zostaje z planu 3.1):**
  - **Zapis v2 jest wyłączony.** Notatki dalej zapisują się w v1 (`encryptString`). Plan każe przełączyć zapis dopiero po potwierdzeniu, że urządzenia mają nowszą wersję — ta bramka (ostrzeżenie „starsza wersja”, Ustawienia 2.1) nie istnieje.
  - **Metadane w szyfrogramie** (kolor, folder, `parentId`, ikona) nadal są jawne w dokumencie. Przeniesienie ich do szyfrogramu zmienia kształt dokumentu i listę folderów dla zablokowanych notatek, więc idzie razem z przełączeniem zapisu.
  - **Migracja** starych szyfrogramów v1 na v2 przy odblokowaniu — po bramce.
  - **Przegląd bezpieczeństwa** (CLAUDE.md: `security-reviewer` przy zmianach kryptografii) nie został uruchomiony.
- **Testy:** `src/lib/vault.v2.test.ts` (v1 przez nowy odczyt, v2 z epoką i id, brak zgodności z zwykłym odczytem, rozpoznawanie tokenów); `src/lib/vault.test.ts` (nieznana wersja to teraz `v9`).

## Skarbiec — zapis v2 za bramką wersji (V-3, krok 2, 2026-10-26)

- **Co robi:** nowe i edytowane notatki prywatne zapisują się w formacie v2 (epoka skarbca w AAD), gdy wszystkie widziane urządzenia mają `schema ≥ 2` (`writeFormatAllowed`, `NOTE_FORMAT_V2_SCHEMA`). Gdy w grupie jest urządzenie sprzed tej zmiany, zapis idzie w v1 — nie da się zapisać czegoś, czego starsze urządzenie nie odczyta. Bez grupy zapis idzie w v2. Stare notatki v1 przechodzą na v2 przy najbliższym zapisie; odczyt obu wersji działa.
- **Schemat:** `SCHEMA_VERSION = 2` (`src/lib/formatSchema.ts`). Ta wersja umie czytać i pisać v2, więc ogłasza schemat 2.
- **Gdzie:** `src/lib/privateNotes.ts` (`encryptNoteWrite`, odczyt przez `decryptNoteString`, zmiana hasła i duplikat); `src/lib/vault.ts` (v2); `src/lib/formatSchema.ts` (bramka, rejestr źródła urządzeń podpinany przez `yjsSync`); `src/lib/yjsStore.ts` (`isLockedPlain` przyjmuje v1 i v2 — bez tego notatka v2 nie byłaby traktowana jako prywatna).
- **Nie zrobione w V-3:** metadane w szyfrogramie (kolor, folder, `parentId`, ikona — krok 3 planu; zmienia kształt dokumentu i listę folderów dla zablokowanych notatek) oraz przegląd bezpieczeństwa kryptografii (CLAUDE.md wymaga `security-reviewer`; nie uruchomiony).
- **Testy:** `src/lib/vault.v2.test.ts`, `src/lib/formatSchema.test.ts` (bramka), `src/lib/privateNotes.test.ts` i `src/lib/yjsStore` (asercje akceptują v1 i v2); e2e `private-notes`, sync, relay, a11y 1440, budżet.

## Skarbiec — metadane notatki prywatnej w szyfrogramie (V-3, krok 3, 2026-10-26)

- **Co robi:** kolor, folder (`folderId`), rodzic (`parentId`) i ikona zablokowanej notatki są w szyfrogramie (pole `meta` treści), a nie jawnie w dokumencie. Po zablokowaniu znikają z dokumentu; po zdjęciu blokady wracają z szyfrogramu. Zmiana tych pól w odblokowanym skarbcu idzie do szyfrogramu (`PRIVATE_META` w `src/lib/yjs/codec.ts`, sink w `privateNotes.ts`).
- **Zasady:**
  - Metadane idą do szyfrogramu tylko, gdy format na to pozwala (`writeFormatAllowed(METADATA_IN_CIPHERTEXT_SCHEMA)`); inaczej zostają jak dawniej.
  - Zmiana przy zablokowanym skarbcu nie ginie: zostaje jawna w dokumencie do najbliższej blokady, wtedy wraca do szyfrogramu.
  - Przy zdejmowaniu blokady wartość jawna ma pierwszeństwo przed starszą z szyfrogramu.
- **Ograniczenia:** zablokowana notatka nie ma folderu ani koloru na liście (tylko kafelek zablokowany). Starsze urządzenia czytają treść, ale nie widzą metadanych w szyfrogramie; dlatego zapis tych metadanych idzie za bramką schematu 2.
- **Testy:** `src/lib/privateNotes.test.ts` (ukrycie w dokumencie, powrót po odblokowaniu, zmiana w odblokowanym skarbcu, fallback przy zablokowanym); e2e `private-notes.spec.ts` (asercja wersji v1 lub v2).

## Przegląd bezpieczeństwa V-3 (kroki 1–3, 2026-10-26)

Przegląd wykonany ręcznie na diffie (nie przez agenta `security-reviewer`; CLAUDE.md wymaga go przy kryptografii, więc to ustalenie do potwierdzenia).

**Sprawdzone, bez zastrzeżeń:**
- **Wiązanie AAD:** v2 to `notki:v2:<epoka>:<id>`, v1 to `notki:note:<id>`. Prefiksy się nie mieszają. Szyfrogram nie odszyfruje się pod innym id ani w innej epoce (testy `vault.v2.test.ts`, `privateNotes.test.ts`).
- **Obniżanie wersji:** atakujący, który zmieni prefiks v2 na v1, dostaje błąd AAD, bo AES-GCM weryfikuje dane uwierzytelniające. Bez klucza nie przerobi szyfrogramu.
- **Metadane:** odczyt z szyfrogramu jest uwierzytelniony, a kolor przechodzi przez listę `NOTE_COLORS` (poprawka z przeglądu). Folder, rodzic i ikona są przycinane do długości.
- **Brak wycieku przy zablokowanym skarbcu:** metadane idą do sinku tylko przy odblokowanym skarbcu. Przy zablokowanym zostają jawne, co jest świadomym wyjątkiem (patrz niżej).

**Ustalenia (otwarte):**
1. **Jawne metadane przy zablokowanym skarbcu (wyjątek świadomy).** Zmiana koloru, folderu lub rodzica przy zablokowanym skarbcu trafia jawnie do dokumentu do najbliższej blokady, więc widać ją w dokumentach synchronizacji. To ograniczony wyciek identyfikatorów folderów. Do decyzji: blokować zmianę metadanych przy zablokowanym skarbcu zamiast ją zapisywać jawnie.
2. **Gate schematu oparty na nieuwierzytelnionej awareness.** Peer może ogłosić `schema: 2`, żeby wymusić zapis v2, którego inne urządzenia nie odczytają (utrata dostępności), albo `schema: 0`, żeby zablokować nowe formaty. To nie wyciek danych, ale zaufanie do grupy synchronizacji. Ta sama zasada obowiązywała wcześniej dla kodu parowania.
3. **Migracja starych szyfrogramów niepełna.** Notatka v1, której nikt nie edytuje, zostaje w v1 bezterminowo. Plan zakładał migrację przy odblokowaniu, a zrobione jest tylko przy zapisie.
4. **Odrzucenie błędnego koloru nie ma bezpośredniego testu.** Logika jest, test sprawdza tylko poprawny przypadek.
5. **Rozpoznawanie zablokowanej notatki po prefiksie.** `isLockedPlain` przyjmuje każdy string zaczynający się od `v1.`/`v2.`. Zepsuty token nie daje wycieku (treść jest w szyfrogramie), ale może ukryć notatkę jako zablokowaną. Ten sam kształt istniał w v1.

**Rekomendacja:** punkt 1 przed V-4 (biometria jest tylko drugim opakowaniem klucza, nie zmienia tego). Punkt 2 i 3 do decyzji właściciela. Przegląd agentem `security-reviewer` nadal zalecany przed wydaniem.

## Przegląd V-3 — zamknięte punkty 1 i 2 (2026-10-26)

- **Punkt 1 (jawne metadane przy zablokowanym skarbcu) — zamknięty.** Zmiana koloru, folderu, rodzica lub ikony przy zablokowanym skarbcu jest **odrzucana**, a użytkownik dostaje komunikat „Odblokuj skarbiec, aby zmienić…”. Nic nie trafia jawnie do dokumentu. Wyjątek: gdy bramka schematu jest zamknięta (w grupie jest urządzenie sprzed zmiany), zostaje dotychczasowe zachowanie, bo tam metadane były jawne od zawsze (`yjsStore.ts`, `applyPatch`).
- **Punkt 2 (zaufanie do deklaracji schematu) — złagodzony, ryzyko zostaje.** Deklaracje z awareness są sprawdzane: numer schematu musi być całkowity i w zakresie 0–1000, wersja krótkim napisem. Błędna deklaracja traktowana jest jak brak deklaracji (urządzenie liczone jak sprzed zmiany), więc bramka pozostaje zachowawcza: śmieciowy peer może zablokować nowy format, ale nie wymusi go. **Pozostaje:** peer z poprawną deklaracją `schema: 2` może wymusić zapis v2, którego starsze urządzenie nie odczyta. Usunięcie tego wymagałoby uwierzytelnionych deklaracji (podpis kluczem urządzenia), co jest osobnym zadaniem. Ryzyko dotyczy dostępności, nie poufności: bez klucza skarbca peer nie odczyta treści.
- **Testy:** `src/lib/privateNotes.test.ts` (odrzucenie zmiany przy zablokowanym skarbcu), `src/lib/formatSchema.test.ts` (walidacja deklaracji).
- **Nadal otwarte z przeglądu:** punkt 3 (migracja v1 → v2 tylko przy zapisie), punkt 5 (rozpoznawanie zablokowanej notatki po prefiksie).

## Przegląd V-3 — punkty 3 i 5 zamknięte (2026-10-26)

- **Punkt 3 (migracja v1 → v2) — zamknięty.** Przy odblokowaniu skarbca stare szyfrogramy v1, których nikt nie edytował, przechodzą na v2 (`migrateToV2` w `privateNotes.ts`, wołane z `adoptKey`). Dzieje się to tylko przy otwartej bramce schematu. Notatka zapisana w v1 zostaje w v1, jeśli bramka jest zamknięta, a błąd szyfrowania nie psuje notatki (zostaje v1 i następne odblokowanie spróbuje ponownie). Migracja nie zmienia treści ani metadanych, tylko szyfrogram.
- **Punkt 5 (rozpoznawanie zablokowanej notatki) — zamknięty.** `isLockedPlain` sprawdza pełny kształt tokenu (`looksLikeVaultToken`: wersja, iv, szyfrogram), a nie sam prefiks. Zepsuty token nie czyni już zwykłej notatki zablokowaną, więc jej treść jest widoczna jak dotąd, a nie ukrywana.
- **Testy:** `src/lib/privateNotes.test.ts` (migracja przy otwartej i zamkniętej bramce), `src/lib/yjsStore.props.test.ts` (zepsuty token; fałszywy token w teście właściwości zastąpiony tokenem o prawidłowej długości).
- **Przegląd V-3 po punktach 1, 2, 3 i 5:** otwarty pozostaje punkt 2 w części dotyczącej fałszywej, ale poprawnej deklaracji schematu (wymaga uwierzytelnionych deklaracji) oraz formalny przegląd `security-reviewer`.

## Przegląd V-3 — raport `security-reviewer` i korekty (2026-10-26)

Agent `security-reviewer` (przegląd tylko do odczytu, diff 913baaf..HEAD) potwierdził brak krytycznych ustaleń. Poniżej korekty do wcześniejszego przeglądu ręcznego i stan poprawek.

**Korekty twierdzeń:**
1. **Punkt 1 („nic nie trafia jawnie”)** jest prawdziwy tylko przy otwartej bramce schematu. Insider może ją zamknąć (M-1), więc jawne metadane są możliwe także przy zablokowanym skarbcu.
2. **Punkt 2 („peer z deklaracją schema:2 może wymusić zapis v2”)** jest nieprawdziwy w obecnym kodzie: bramka to `every(...)`, więc dodanie urządzenia z wyższym numerem nie może jej otworzyć. Prawdziwe jest zamykanie bramki przez deklarację (M-1) oraz otwieranie jej przez usunięcie cudzych stanów awareness (M-3b).
3. **Punkt 3 („migracja nie zmienia treści”)** był nieprawdziwy w wyścigu z edycją (M-2). **Poprawione w tym commicie** (CAS: wpis w cache musi być ten sam i niebrudny, a dokument musi nadal mieć poprzedni szyfrogram). Migracja nie obejmuje metadanych (M-4).
4. **Punkt 5** jest prawdziwy dla ścieżki zapisu. Projekcja z dokumentu traktuje każdy napis przy `locked === true` jako zablokowany (I-4); to bezpieczne (ukrycie, bez wycieku), ale nie jest tym samym co kształt tokenu.

**Poprawione w tym commicie:**
- **M-2** (wyścig migracji v1→v2): CAS, patrz wyżej.
- **L-3** (długa nazwa peera): nazwa przycinana do 40 znaków przy odczycie awareness.

**Otwarte (do decyzji i kolejnych zmian):**
- **W-1 (wysokie):** wpis `meta` (w tym `epoch`) w dokumencie nie jest uwierzytelniony. Uczestnik grupy z kodem synchronizacji może podmienić epokę i uniemożliwić odczyt notatek v2. Poprawka wymaga zapamiętywania epoki lokalnie (TOFU) i jawnej akcji przy zmianie. To ważne przed V-4, bo V-4 dodaje kolejne opakowanie klucza w tym samym `meta`.
- **M-1, M-3, M-4 (średnie):** metadane zależne od bramki (zamknięta bramka = jawny zapis), brak czyszczenia resztek jawnych metadanych, bramka liczona tylko z widocznych urządzeń. Rekomendacja agenta: metadane zawsze w szyfrogramie, a bramka tylko dla formatu treści.
- **M-5 (średnie):** równoległe zakładanie skarbca offline na dwóch urządzeniach może zostawić notatki jednego z nich nieczytelne (LWW dla `meta`). Wymaga wykrywania konfliktu i pytania użytkownika.
- **L-1, L-2, L-4, L-5 (niskie):** kopia zablokowanej notatki traci kolor i folder; metadane zablokowanych notatek nie są widoczne na listach; możliwe samoczynne zablokowanie po zmianie hasła (do potwierdzenia w przeglądarce); błąd `flush` przy blokadzie porzuca edycje.
- **Higiena testów:** testy `setDeviceSource` nie czyszczą stanu w `afterEach`; po nieudanej asercji stan przecieka do kolejnych testów.

**Czego nie dało się ocenić statycznie:** zachowanie y-webrtc przy usuwaniu stanów awareness, wyścig migracji z locka w przeglądarce, zawartość IndexedDB i logu aktualizacji, stare urządzenia w terenie.

**Stan formalny:** przegląd agentem jest wykonany (bez uruchomienia testów). Wymaga potwierdzenia przez człowieka przed wydaniem, zwłaszcza W-1.

## Skarbiec — pin skarbca na urządzeniu (W-1 z przeglądu V-3, 2026-10-26)

- **Problem:** wpis `meta` skarbca (w tym `epoch`) jest w dokumencie Yjs i nie jest uwierzytelniony. Uczestnik grupy z kodem synchronizacji mógł zmienić epokę i uniemożliwić odczyt notatek v2.
- **Co robi:** każde urządzenie zapamiętuje lokalnie odcisk skarbca (`kaczy.vault.pin.v1`: epoka, sól, opakowanie klucza, kod sprawdzający oraz pole `extra`). Zapis następuje przy zakładaniu skarbca, przy zmianie hasła, przy dodaniu passkeya i przy każdym udanym odblokowaniu (`src/lib/vaultPin.ts`).
- **`extra`** (przegląd V-4, M-1): kanoniczny zapis listy passkeyów i kodu awaryjnego (`extraOf`). Podmiana wpisów passkeya albo kodu przy tym samym kluczu daje `changed`. Pin zapisany przed tym polem nie ma `extra`, więc przy pierwszym odblokowaniu hasłem zostaje odnowiony.
- **Reguły przy odblokowaniu** (`adoptVerifiedMeta(k, m, provedSecret)` w `privateNotes.ts`):
  - **Ten sam klucz, inna epoka** (`epoch-only`): odrzucane, bez odblokowania. Zmiana hasła zawsze zmienia opakowanie, więc taki stan nie może wyniknąć z legalnej operacji.
  - **Zmienione opakowanie, passkeye albo kod** (`changed`): przyjmowane tylko po dowodzie znajomości hasła lub kodu awaryjnego (`provedSecret = true`); użytkownik dostaje komunikat „Skarbiec został zmieniony na innym urządzeniu”. Odblokowanie biometrią (`provedSecret = false`) takiej zmiany nie przyjmuje: błąd `bad-format` z prośbą o hasło (przegląd V-4, M-2), bo biometria dowodzi tylko klucza, a nie zmiany w dokumencie.
  - **Brak pinu** (pierwsze użycie na tym urządzeniu): zaufanie do dokumentu, jak dotąd. To ograniczenie TOFU: nowe urządzenie nie ma punktu odniesienia.
- **Ograniczenia:** pin jest lokalny i nie chroni nowego urządzenia przed podmianą w chwili pierwszego użycia. Podmiana całego opakowania (nie tylko epoki) przy zamkniętym skarbcu zostanie zauważona dopiero przez brak poprawnego hasła. Wyczyszczenie danych przeglądarki kasuje pin.
- **Testy:** `src/lib/vaultPin.test.ts` (porównanie, uszkodzony pin, lista passkeyów i kod awaryjny w pinie, pin bez `extra`), `src/lib/privateNotes.test.ts` (odrzucenie zmienionej epoki, odblokowanie poprawnym hasłem), `src/lib/passkey.flow.test.ts` (M-2: biometria nie przyjmuje zmiany, hasło przyjmuje).
- **Otwarte z przeglądu:** M-1, M-3, M-4, M-5, L-1, L-2, L-4, L-5 (patrz sekcja „Przegląd V-3 — raport”).

## Skarbiec — odblokowanie biometrią, WebAuthn PRF (V-4, 2026-10-26)

**Status: kod i testy są gotowe, ale NIE sprawdzone na sprzęcie z PRF.** Autor nie ma urządzenia z obsługą PRF (Android Chrome, iOS 18+ Safari). Przed wydaniem trzeba przetestować ręcznie: dodanie passkeya, odblokowanie, zmianę hasła, odpowiedź na brak PRF. Przegląd `security-reviewer` (analiza statyczna, bez sprzętu) jest wykonany; wdrożone poprawki: H-1, M-1, M-2, M-3 (opisane niżej). Otwarte: M-4, L-1 do L-5 oraz czyszczenie passkeyów przy zmianie hasła.

**Przegląd V-4 — wdrożone poprawki:**
- **H-1 (wysokie): wyścig przy `addPasskey`.** Dwa prompty WebAuthn trwają długo, a zapis meta bez sprawdzenia cofnąłby skarbiec do starego klucza (notatki nie do odczytania żadnym hasłem). Teraz odcisk meta (`JSON.stringify`) jest zapamiętywany przed promptami i sprawdzany tuż przed `setVaultMeta`, bez `await` między nimi. Zmiana w trakcie kończy się błędem „Skarbiec zmienił się w trakcie…” i niczego nie zapisuje. Uwaga: credential utworzony w authenticatorze zostaje osierocony (L-5).
- **M-1 (średnie): pin nie obejmował passkeyów.** Dodane pole `extra` w pinie (sekcja wyżej).
- **M-2 (średnie): biometria przyjmowała zmienioną meta jak hasło.** Teraz `adoptVerifiedMeta` dostaje flagę `provedSecret`; biometria przy zmianie — odrzucenie z prośbą o hasło.
- **M-3 (średnie): `setup()` nadpisywał uszkodzoną meta.** Teraz `setup` sprawdza surową wartość pod kluczem `meta`; jeśli coś tam jest (nawet zły kształt), odmawia. Otwarte: w interfejsie uszkodzony skarbiec nadal pokazuje „Ustaw skarbiec”, a kliknięcie zwraca błąd (stan „uszkodzony” w UI nie zrobiony).
- **Poprawki po przeglądzie kodu (2026-10-26):**
- **`addPasskey` przy zmianie epoki:** przed promptami sprawdzany pin; zmiana samej epoki (`epoch-only`) przerywa dodawanie, więc zapis pinu nie przyjmuje jej po cichu.
- **Pole `extra` w pinie:** serializacja z posortowanymi kluczami obiektów, więc ta sama lista passkeyów z inną kolejnością pól z synchronizacji nie daje fałszywego „changed”.
- **Uszkodzony skarbiec w interfejsie:** `VaultSnapshot.corrupt` (liczone z surowej wartości pod kluczem `meta`, nie z walidowanej). Ustawienia pokazują komunikat zamiast przycisku „Ustaw hasło skarbca”. **Do zrobienia:** w aplikacji nadal nie ma ścieżki naprawy (komunikat odsyła do backupu lub synchronizacji).
- **Pin sprzed pola `extra`:** dostaje wartość nieporównywalną, więc biometria czeka na hasło. Komunikat przy odblokowaniu hasłem został zmieniony na neutralny ("różni się od zapisanego na tym urządzeniu"), bo sam pin bez `extra` nie oznacza ataku.
- **Testy poprawek:** `src/lib/passkey.flow.test.ts` (H-1 wyścig w trakcie `create`, M-2 podmiana listy passkeyów, M-3 uszkodzona meta), `src/lib/vaultPin.test.ts` (zmiana `extra`, pin bez pola).

- **Co robi:** w ustawieniach skarbca (gdy skarbiec jest ustawiony i przeglądarka ma passkeys) można dodać odblokowanie biometrią: podajesz hasło, przeglądarka tworzy passkey z rozszerzeniem PRF, a wynik PRF owija klucz danych skarbca. W oknie odblokowania pojawia się „Odblokuj biometrią”. Hasło i kod awaryjny działają dalej. Limit: 5 passkeyów.
- **Bez PRF** przycisku nie ma: `platformAuthenticatorAvailable` i rejestracja z `prf.enabled` sprawdzają wsparcie; brak PRF daje komunikat, nie cichą awarię.
- **Gdzie:** `src/lib/vault.ts` (typ `PasskeyMeta` w `VaultMeta.passkeys`, walidacja, `derivePasskeyKek` HKDF z wyniku PRF, `unwrapRawWithPassword`, `wrapDataKeyForPasskey`, `unlockWithPasskey`); `src/lib/passkey.ts` (WebAuthn: rejestracja i podpis z PRF, kody błędów); `src/lib/privateNotes.ts` (`addPasskey` — wymaga hasła, `unlockWithPasskey` — ten sam pin i migracja co hasło); `src/components/vault/VaultDialogs.tsx` (przycisk); `src/components/settings/VaultSettings.tsx` (dodawanie).
- **Model:** passkey nie jest tajemnicą; tajny jest wynik PRF, który urządzenie dostaje tylko z authenticatora po podpisie biometrycznym. Opakowanie jest w `meta`, a lista passkeyów i kod awaryjny są pod pinem przez pole `extra` (poprawka M-1). **Zmiana hasła czyści passkeye:** `rekey` zapisuje `meta` bez `passkeys` (`createVault`). Okno zmiany hasła (`ChangeForm` w `VaultDialogs.tsx`) przed zmianą ostrzega, gdy passkeye istnieją (`hadPasskeys`), a toast po sukcesie mówi, że biometrię trzeba dodać ponownie w Ustawieniach. Automatycznego czyszczenia listy nie ma: stare opakowania zostają w historii Yjs i kopiach zapasowych, ale wymagają authenticatora. Zachowanie (kasowanie) jest świadome: stare opakowania wiążą stary klucz.
- **Ograniczenia:** wszystkie urządzenia korzystają z tego samego skarbca. Hipoteza z przeglądu (M-4, do sprawdzenia na sprzęcie): passkey może synchronizować się przez konto (iCloud, Google), więc wtedy nie jest „tylko na urządzeniu” — dopóki nie zweryfikowano, tego zdania nie wolno traktować jako pewnego. PRF potrzebuje podpisu biometrycznego, więc każde odblokowanie = jeden prompt; w tej wersji brak usuwania passkeyów z interfejsu. Brak wiązania AAD opakowania z id (L-1) i niewalidowane id w `allowCredentials` (L-4) są otwarte.
- **Testy:** `src/lib/vault.passkey.test.ts` (opakowanie, zły PRF, zły hasło, walidacja); `src/lib/passkey.flow.test.ts` (przepływ przez atrapę `navigator.credentials`: dodanie wymaga hasła, odblokowanie passkeyem, brak PRF nie zmienia metadanych, zły PRF nie odblokowuje). Atrapa nie sprawdza prawdziwego PRF.

## Długi — ukrywanie kwot (plan mobile C1 / plan długów 3.3, 2026-10-28)

### Co robi
- Przycisk **„Ukryj kwoty” / „Pokaż kwoty”** w akcjach główki Długów (obok tytułu, na telefonie pod opisem; nowy plan 1.1). Chowa wszystkie kwoty („•••”): podsumowanie, saldo przy osobach, pasek „Oddał całość” w arkuszu i kwoty w historii. Pomaga, gdy ktoś patrzy w telefon.
- Stan jest tylko na tym urządzeniu. Nie idzie do Yjs ani do backupu.
- Zapisy wpisów dają wibrację: sukces (dodanie, rozliczenie) i ostrzeżenie (zła nazwa, zła kwota, nieudany zapis).

### Gdzie jest
- `src/lib/debts/hideAmounts.ts` — `useHideAmounts`, `setHideAmounts`, `amountText(grosze, hidden)`, stała `HIDDEN_AMOUNT`.
- `src/components/debts/DebtsView.tsx` — przycisk w nagłówku, prop `hidden` w `Summary`, `People`, `PersonSheet` i `PersonHistory`.

### Jak działa i dlaczego
- Klucz localStorage `kaczy.debtsHideAmounts.v1` (boolean, domyślnie `false`), przez `createPersistedStore`, tak jak `confirmPrefs.ts`.
- Maskowanie to wyłącznie widok. Dane i sumy zostają bez zmian, a etykiety dostępności (`aria-label` przycisków „Edytuj wpis…”) nadal pokazują kwoty, bo nie są widoczne na ekranie.
- Przycisk ma zmienną etykietę zamiast `aria-pressed`, żeby nie dublować stanu.
- **Saldo po tym wpisie (plan mobile C1 / plan długów 2.2, 2026-10-28):** pod datą każdego wpisu w historii osoby jest „Saldo po tym: …” — saldo osoby po tym wpisie i wszystkich starszych. Znak pokazany słowem minusa („− 50 zł” = jesteś winien), zero jako „0”. Przy ukrytych kwotach też maskowane. Liczenie: `src/lib/debts/model.ts` `runningBalances(entries)` (wejście najnowsze pierwsze, jak `balances`, wynik w tej samej kolejności); render w `PersonHistory` (`DebtsView.tsx`). Testy: `model.test.ts` (`runningBalances`).

### Ograniczenia i pułapki
- Zmiany nazwy osoby nadal nie ma (osobny punkt). Saldo narastające jest (patrz niżej, „Saldo po tym”).
- Pasek postępu spłat ma `aria-label` z kwotą. Świadomie zostawiony jako informacja dla czytnika.

### Testy
- `src/components/debts/DebtsView.test.tsx` — nowy przypadek „przełącznik chowa kwoty… i je przywraca”.

## Ćwiczenia — wykres masy ciała 30/90 dni (plan mobile D2, 2026-10-28)

### Co robi
- Nad listą ważeń jest wykres: linia i punkty z ostatnich 30 albo 90 dni, zakres kg w nagłówku, daty początku i końca pod wykresem. Dni bez ważenia zostawiają przerwę na osi. Stuknięcie punktu pokazuje datę i wagę.

### Gdzie jest
- `src/components/cwiczenia/WeightChart.tsx` — komponent (SVG, przełącznik zakresu z `aria-pressed`).
- `src/lib/weight/chart.ts` — `weightSeries(entries, range, today)`: okno dni, oś X wg dnia, skala Y z zapasem 0,5 kg.
- `src/components/cwiczenia/WeightSection.tsx` — wstawienie wykresu.

### Jak działa i dlaczego
- Bez Recharts: to jedna linia i punkty, a Recharts dołożyłby do paczki. Oś X liczona od dnia (UTC), nie od indeksu wpisu, więc przerwy są widoczne.
- Lista ważeń zostaje pod wykresem jako wersja dla czytnika (tabela).

### Testy
- `src/lib/weight/chart.test.ts` (okno, skala Y, brak danych).

## Ćwiczenia — białko z ułamkiem i etykieta przypomnień (2026-11-12)

- **Co robi:** białko w posiłkach i celach diety zachowuje jedno miejsce po przecinku (12,5 g), kcal nadal jest całkowite. Notatki-przypomnienia odżywek i treningu dostają etykietę `ćwiczenia`, więc nie lądują w Skrzynce.
- **Gdzie:** `src/lib/diet/model.ts` (`cleanDecimal`, `summarizeDay` zaokrągla sumę do 0,1), `DietSection.tsx` (`parseAmountField` z parametrem `decimals`), `src/lib/exerciseLabel.ts` (`EXERCISE_LABEL`), `CwiczeniaView.tsx`, `TrainingSection.tsx`.
- **Ograniczenia:** istniejące notatki-przypomnienia bez etykiety zmienią się dopiero przy następnej zmianie godziny.
- **Testy:** `src/lib/diet/model.test.ts`, `CwiczeniaView.test.tsx`, `TrainingSection.test.tsx`.

## Ćwiczenia — zapis z innym dniem (2.5, 2026-11-12)

- **Co robi:** formularze „Dodaj posiłek” i „Zapisz trening” mają przełącznik „Dziś / Wczoraj”. „Wczoraj” zapisuje wpis na wczorajszy dzień (przydatne, gdy zapomniałeś zapisać); po zapisie przełącznik wraca na „Dziś”, a dymek potwierdza dzień. Wpis treningu na wczoraj nie dostaje godziny.
- **Gdzie:** `DietSection.tsx` (`AddMealForm`), `TrainingSection.tsx` (formularz zapisu); magazyny (`addMeal`, `addTrainingEntry`) już przyjmowały pole `day`.
- **Ograniczenia:** tylko dziś i wczoraj, bez wyboru dowolnej daty; posiłek z wczoraj widać w podsumowaniu 7 dni, a nie na liście „Dziś”.
- **Testy:** `DietSection.test.tsx`, `TrainingSection.test.tsx`.

## Ćwiczenia — ustawienia treningu niżej i edycja odżywki (2.2, 2.6, 2026-11-12)

- **Co robi:** w karcie Trening przypomnienie i limit hantli są w zwijanym bloku „Ustawienia treningu” na dole, więc na górze zostają plan i zapis. Przy każdej odżywce jest ołówek „Edytuj”: zmiana nazwy, dawki, pory dnia i godziny przypomnienia w miejscu wiersza.
- **Gdzie:** `TrainingSection.tsx` (`<details data-testid="training-settings">`), `CwiczeniaView.tsx` (`EditSupplementForm`, `editSupplement`), `src/lib/supplements/store.ts` (`updateSupplement`), `ySupplements.ts` (`replace`).
- **Jak działa:** edycja zachowuje id, datę dodania i odhaczenia. Gdy zmienia się tylko nazwa lub dawka, notatka-przypomnienie dostaje nowy tytuł. Gdy zmienia się godzina albo przypomnienie jest włączane lub wyłączane, stara notatka idzie do kosza, a nowa powstaje (etykieta `ćwiczenia`, codzienne powtarzanie). Odrzucony zapis sprząta świeżo utworzoną notatkę.
- **Ograniczenia:** edycji nie da się cofnąć dymkiem „Cofnij”; stara notatka-przypomnienie zostaje w koszu.
- **Testy:** `CwiczeniaView.test.tsx`, `ySupplements.test.ts`.

## Ćwiczenia — „Wziąłem” zamyka przypomnienie (2.3, 2026-11-12)

- **Co robi:** odhaczenie odżywki na dziś przestawia jej notatkę-przypomnienie na następne wystąpienie (jak „Gotowe” w Terminach), więc po wzięciu przypomnienie nie dzwoni.
- **Gdzie:** `CwiczeniaView.tsx` (`takeSupplement`), logika zmiany z `doneReminderUpdate` (`reminderActions.ts`); powiązanie przez `Supplement.reminderNoteId`.
- **Ograniczenia:** działa tylko w jedną stronę — „Gotowe” w Terminach przy takiej notatce nie odhacza odżywki. Odznaczenie nie cofa przesunięcia terminu. Nic się nie dzieje, gdy termin notatki jest już na jutro albo notatki nie ma.
- **Testy:** `CwiczeniaView.test.tsx`.

## Ćwiczenia — czas przerwy do wyboru (1.2, 2026-11-12)

- **Co robi:** w „Ustawieniach treningu” można wybrać czas przerwy po zapisie serii: 1 min, 90 s, 2 min albo 3 min. Wybór jest zapamiętany; po „Zapisz serie” startuje licznik na ten czas.
- **Gdzie:** `src/lib/training/restPrefs.ts` (`restStore`, klucz `kaczy.training.restSeconds.v1`, na urządzeniu, poza kopią), `TrainingSection.tsx` (`RestControl`, `RestTimer`).
- **Ograniczenia:** przerwa startuje po zapisie całego wpisu, nie po każdej serii („✓ Zrobiona” przy serii nie powstało).
- **Testy:** `restPrefs.test.ts`, `TrainingSection.test.tsx`.

## Ćwiczenia — przerwa jako pierścień (4.4, 2026-11-12)

- **Co robi:** po zapisie serii przerwa to pierścień SVG z dużym licznikiem (JetBrains Mono, cyfry tabelaryczne), przyciskami „+30 s” (wydłuża o 30 s) i „Pomiń” (44 px). Przy redukcji ruchu pierścień nie płynie, tylko skacze co pół sekundy.
- **Gdzie:** `TrainingSection.tsx` (`RestTimer` z `until`, `total`, `onExtend`, `onStop`; stan `rest` w `TrainingSection`).
- **Ograniczenia:** czytnik ekranu ogłasza tylko koniec przerwy; „+30 s” można stukać wielokrotnie bez górnego limitu.
- **Testy:** `TrainingSection.test.tsx`.

## Ćwiczenia — paski postępu diety i nagłówki (4.2, 4.5, 2026-11-12)

- **Co robi:** pod kaflami „Kalorie” i „Białko” jest pasek postępu do celu dziennego (tylko gdy cel jest ustawiony; wypełnienie do 100%). „Ostatnie 7 dni” ma pod każdym dniem pasek względem celu kalorii albo, bez celu, względem najwyższego dnia tygodnia; dzisiejszy wyróżniony, pozostałe przygaszone. Podsekcje (Plan dni, Dziś, Progres, Ten tydzień, pory odżywek) mają wspólny styl `section-caps` zamiast `h3 text-xs`.
- **Gdzie:** `DietSection.tsx` (`Bar`, `Stat`, `WeekList`), `TrainingSection.tsx`, `CwiczeniaView.tsx`.
- **Ograniczenia:** paski są ozdobą (`aria-hidden`) — liczby są w tekście; przekroczenie celu nie zmienia koloru; puste stany bez rysunku kreską (czeka na N-3).
- **Testy:** `DietSection.test.tsx` (teksty bez zmian), `designTokens.test.ts`, `sentenceCase.test.ts`.

## Ćwiczenia — wykres progresu z rekordem (4.3, 2026-11-12)

- **Co robi:** wykres rekordów kolejnych sesji przy ćwiczeniu pokazuje ostatnią sesję jako pełną kropkę z podpisem („22 kg”, a gdy to rekord — „22 kg · rekord”). Gdy najlepszy wynik był wcześniej, jest zaznaczony pustym kółkiem.
- **Gdzie:** `TrainingSection.tsx` (`Sparkline`).
- **Ograniczenia:** nadal tylko ostatnie rekordy bez osi dat (pełny wykres z historią to 3.4); wykres nie jest już rozciągany (stały rozmiar 160×28), żeby kropki były okrągłe.
- **Testy:** `TrainingSection.test.tsx`.

## Ćwiczenia — pasek „dziś” (4.1, 2026-11-12)

- **Co robi:** nad zakładkami działu Ćwiczenia jest pasek z trzema kaflami: „Odżywki 2/5”, „Trening: 1 wpis” (albo „brak”), „Dieta: 1450 / 2200 kcal”. Stuknięcie kafla przełącza zakładkę (telefon) i przewija do tej sekcji (komputer).
- **Gdzie:** `CwiczeniaView.tsx` (`TodayStrip`, panele mają `id="cwiczenia-…"`); liczby z `useSupplementsTaken`, `useTrainingEntries`, `useMeals`/`useDietGoals`.
- **Ograniczenia:** bez nazwy zaplanowanego dnia treningowego i licznika „2/4” (to część 2.1); kalorie bez pasków postępu.
- **Testy:** `CwiczeniaView.test.tsx`.

## Ćwiczenia — historia ćwiczenia i szacowany 1RM (3.4, 2026-11-12)

- **Co robi:** stuknięcie w ćwiczenie w „Progres” rozwija jego historię: sesje od najnowszej (dzień, serie, objętość) i orientacyjne maksimum na 1 powtórzenie ze wzoru Epleya.
- **Gdzie:** `TrainingSection.tsx` (`ProgressList`, `ExerciseHistory`), `src/lib/training/model.ts` (`estimateOneRepMax`).
- **Jak działa:** 1RM = kg × (1 + powtórki / 30) z najlepszej serii, zaokrąglone do 0,5 kg; serie bez ciężaru i powyżej 12 powtórzeń są pomijane (wzór zawyża). Przy 1 powtórzeniu wynik to sam ciężar.
- **Ograniczenia:** historia to lista, bez wykresu z osią dat (zostaje mały wykres rekordów 4.3); rozwinięte jest jedno ćwiczenie naraz.
- **Testy:** `src/lib/training/model.test.ts`, `TrainingSection.test.tsx`.

## Ćwiczenia — prowadzony trening (2.1, 2026-11-12)

- **Co robi:** wybór dnia planu w „Zapisz trening” rozpoczyna prowadzony trening: pasek „Ramiona · ćwiczenie 2/4: Uginanie młotkowe” z przyciskami „Pomiń ćwiczenie” i „Zakończ plan”. Po „Zapisz serie” formularz przechodzi na następne ćwiczenie planu z zaplanowaną liczbą serii i powtórzeń (przerwa startuje, jeśli jest jeszcze ćwiczenie). Na końcu podsumowanie: ile ćwiczeń zapisano z ilu, objętość, minuty i liczba rekordów.
- **Gdzie:** `src/lib/training/session.ts` (`startSession`, `afterLogged`, `afterSkipped`, `sessionMinutes`), `TrainingSection.tsx` (`LogForm`, `SessionBanner`).
- **Jak działa:** stan sesji żyje tylko w widoku (nie jest zapisywany); wpisy powstają jak zwykle. Sesja przesuwa się tylko po zapisie bieżącego ćwiczenia z planu — ręczna zmiana ćwiczenia w liście nie zalicza kroku.
- **Ograniczenia:** odświeżenie strony kończy sesję; brak przycisku „wróć do poprzedniego ćwiczenia”.
- **Testy:** `src/lib/training/session.test.ts`, `TrainingSection.test.tsx`.

## Ćwiczenia — serie na czas i z obciążeniem przy masie ciała (2.7, 2026-11-12)

- **Co robi:** w „Zapisz trening” jest przełącznik „Powtórzenia / Na czas”. Seria na czas ma sekundy zamiast powtórzeń (deska, zwis); pole ciężaru to wtedy obciążenie dodatkowe („kg dodatkowo”). Deska otwiera się domyślnie w trybie „Na czas”, inne ćwiczenia w „Powtórzenia”. Na listach seria na czas wygląda jak „45 s” albo „45 s +5 kg”; „Użyj ostatnich” przełącza tryb zgodnie z poprzednim wpisem.
- **Gdzie:** `src/lib/training/model.ts` (`TrainingSet.seconds`, `cleanSeconds`, `cleanSet`, `TRAINING_SECONDS_MAX` = 3600), `catalog.ts` (`Exercise.timed`), `TrainingSection.tsx` (`LogForm`, `setsLine`).
- **Jak działa:** dane to dopisane pole `seconds`; seria na czas jest zapisywana jako `{reps: 1, seconds, kg?}`. Dzięki `reps: 1` starsza wersja aplikacji (zna tylko `reps`) widzi poprawną serię z 1 powtórzeniem i nie odrzuca wpisu. Objętość i szacowany 1RM pomijają serie na czas; obciążenie dodatkowe liczy się do rekordu ciężaru.
- **Ograniczenia:** starsza wersja pokaże taką serię jako „1” (bez sekund); własne ćwiczenia nie mają znacznika „na czas” (tryb wybiera się przełącznikiem); cały wpis jest albo na czas, albo na powtórzenia.
- **Testy:** `src/lib/training/model.test.ts`, `TrainingSection.test.tsx`.

## Skarbiec — zapis edycji notatki prywatnej przy schowaniu strony (2026-11-23)

- **Co robi:** edycja notatki prywatnej jest szyfrowana i zapisywana od razu, gdy strona przestaje być widoczna (przełączenie aplikacji na telefonie, zamknięcie karty), zamiast czekać na opóźniony zapis.
- **Gdzie jest:** `src/lib/privateNotes.ts`, na końcu pliku — słuchacze `visibilitychange` (stan `hidden`) i `pagehide` wołają `privateNotes.flush()`. Tylko dla instancji aplikacji, nie w `createPrivateNotes` (testy jednostkowe nie dostają globalnych słuchaczy).
- **Jak działa:** zwykłe notatki trafiają do dokumentu Yjs od razu. Prywatne czekają w pamięci `writeDelayMs` (400 ms), potem szyfrowanie (WebCrypto) i `setVault`. Schowanie w tym oknie mogło zgubić ostatnią edycję. `flush` przy zablokowanym skarbcu nic nie robi.
- **Pułapki:** przy zamknięciu karty przeglądarka nie czeka na obietnice — `pagehide` to próba, pewny jest dopiero `visibilitychange` przy przełączeniu aplikacji. Blokada (`lock`) pokazuje kafle z „Blokuję…”, zanim zapisze ostatnią edycję; koniec blokady to „Odblokuj” na kaflu — na to czeka pomocnik `lockNowFromPalette` w e2e (stary test „przeżywa blokadę” przeładowywał w tym oknie i padał 4 razy na 5).
- **Testy:** `e2e/private-notes.spec.ts` — „schowanie strony zapisuje edycję…” (zegar strony zatrzymany przy schowaniu, więc szyfrogram może pochodzić tylko z zapisu przy schowaniu; bez poprawki test pada) i „…przeżywa blokadę”.

## Ćwiczenia — podpowiedź progresji przy zapisie serii (C2.1, 2026-11-25)

- **Co robi:** pod linią „Ostatnio (…)” w formularzu treningu pojawia się jedno zdanie z przyciskiem „Wpisz”, które wypełnia serie podpowiedzią. Możliwe zdania:
  - „Dołóż: 41 kg × 10” — każda seria robocza z ostatniej sesji doszła do celu powtórek;
  - „Te same 40 kg, o powtórkę więcej: 9” — nie doszła;
  - „Hantle już na maksimum — zostań przy 20 kg, celuj w 13 powtórzeń” — dołożenie przekroczyłoby hantle z „Sprzętu”.
- **Gdzie jest:** `src/lib/training/progression.ts` (`suggestNext`, `targetRepsFor`, `progressionText`, typ `ProgressionHint`); `LogForm` w `src/components/cwiczenia/LogForm.tsx` (`progression-hint`).
- **Jak działa:** podwójna progresja liczona tylko z ostatniej sesji ćwiczenia (`byTrainingTime`). Serie robocze to te z największym ciężarem, więc lżejsze rozgrzewkowe nie zmieniają wyniku. Krok: 0,5 kg poniżej 10 kg, wyżej 1 kg; przy hantlach sprawdzany przez `overDumbbell`. Cel powtórek bierze się z prowadzonej sesji, a bez niej z pierwszego dnia planu, który zawiera ćwiczenie. Bez celu podpowiedzi nie ma, żeby nie zgadywać zakresu.
- **Rozgrzewka (C2.4, `a572f848`, 2026-11-25):** gdy dziś nie ma jeszcze żadnego wpisu treningu, pod „Ostatnio” jest zdanie „Rozgrzewka: 20,5 kg × 8, 30,5 kg × 5 — przed pierwszym ćwiczeniem dnia, bez zapisu” (`warmup-hint`). Liczy 50% i 75% ciężaru roboczego (z podpowiedzi progresji, a bez niej z najcięższej serii ostatniej sesji), w dół do 0,5 kg, 8 i 5 powtórzeń (`warmupSets`, `warmupText` w `progression.ts`). Nic nie zapisuje, więc nie wpływa na rekordy. Bez rozgrzewki: ciężar roboczy poniżej 10 kg, serie na czas, zapis „do wczoraj”.
- **Zapas po ostatniej serii (C2.3, 2026-11-26):** pod seriami jest rząd pigułek „Zapas po ostatniej serii: 0 1 2 3 4+” (`rir-picker`, `aria-pressed`). Jedno stuknięcie wybiera, drugie na tej samej pigułce czyści; wybór jest niewymagany i czyści się po zapisie i przy przejściu do kolejnego ćwiczenia sesji. Zapis trafia do pola `rir` (0–4, 4 = „4 i więcej”) **tylko ostatniej** wypełnionej serii — RIR podaje się zwykle po najcięższej, końcowej serii, a wpisanie tej samej liczby we wszystkie serie fałszowałoby dane. Przy seriach na czas pigułek nie ma. W „Ostatnio” seria pokazuje się jako „8×20 kg (zapas 3)” (`setsLine`, `rirLabel` w `trainingFormat.ts`). W `suggestNext` zapas 3+ po ostatniej serii daje „Dołóż”, nawet gdy powtórek zabrakło; limit hantli nadal wygrywa.
- **Model danych (C2.3):** `TrainingSet.rir?: number`, czyszczone przez `cleanRir` (całkowite 0–`TRAINING_RIR_MAX`; złe znika, seria zostaje) w `src/lib/training/model.ts`; `rir` jest w `SET_KNOWN`, więc nie ląduje w `extra`. Zgodność: klienci od 2026-11-18 (zasada 5 z `docs/dane-wersje.md`) przechowują `rir` jako nieznane pole i go nie gubią; liczba mieści się w limitach `pickExtra`, więc `SCHEMA_VERSION` bez zmian. Starsi klienci zgubią pole przy ponownym zapisie wpisu.
- **Ograniczenia i pułapki:** brak podpowiedzi dla serii na czas, ćwiczeń bez ciężaru i sesji mieszanej (część serii bez kg). „Wpisz” i „Użyj ostatnich” nie przenoszą zapasu. Eksport CSV treningu nie ma kolumny zapasu. „Wpisz” bierze liczbę serii z ostatniej sesji, nie z planu. Ćwiczeń nie ma w `e2e/a11y.spec.ts`.
- **Testy:** `src/lib/training/progression.test.ts` (dołożenie, powtórki, rozgrzewka, limit hantli, zapas 3+/0–2, przypadki `null`, cel z sesji/planu, teksty), `src/lib/training/model.test.ts` (`cleanSet` z `rir`), `src/lib/training/extra.test.ts` (`rir` znany obok nieznanego `tempo` przez scalenie, „Cofnij” i kopię), `src/components/cwiczenia/TrainingSection.test.tsx` (podpowiedź i „Wpisz”, brak bez celu), `e2e/cwiczenia-tydzien.spec.ts` (wybór zapasu, „Ostatnio”, czyszczenie po zapisie).
- **Commit:** `22550d6c`, 2026-11-25; zapas C2.3: `61cf9395`, 2026-11-26.

## Ćwiczenia — zapis serii jednym stuknięciem (C2.2, 2026-11-26)

- **Co robi:** nad wierszami serii w „Zapisz trening” jest blok z dużym przyciskiem „Zrobione: 10 × 20 kg” i krokami −/+ dla powtórzeń i ciężaru. Stuknięcie wpisuje serię do pierwszego pustego wiersza, a gdy wszystkie są pełne — do nowego (do 30). Pod przyciskiem: „Wpisanych serii: 2. Na koniec „Zapisz serie”.” (`role="status"`). Pola liczbowe zostają jako droga zapasowa; cały wpis dalej zapisuje „Zapisz serie”. Przy seriach na czas bloku nie ma.
- **Gdzie jest:** `src/components/cwiczenia/QuickSet.tsx` (`QuickSet`, `Stepper`), `kgStep` i `stepKg` w `src/components/cwiczenia/trainingFormat.ts`, podpięcie w `LogForm.tsx` (`quickStart`, `logQuick`; `key={exerciseId}` — zmiana ćwiczenia ustawia wartości od nowa).
- **Jak działa:** wartości startowe: podpowiedź progresji (C2.1), a bez niej pierwsza seria ostatniej sesji, a bez niej cel powtórzeń z planu (domyślnie 10) bez ciężaru. Krok ciężaru jak w podpowiedzi: 0,5 kg do 10 kg, wyżej 1 kg; w dół symetrycznie przez granicę; „−” przy 0,5 kg daje „bez kg”.
- **Ograniczenia:** blok nie zapisuje wpisu sam — to celowe, bo jeden wpis to całe ćwiczenie z wieloma seriami. Przerwa (minutnik) startuje po „Zapisz serie”, nie po każdej serii.
- **Testy:** `src/components/cwiczenia/trainingFormat.test.ts` (krok ciężaru), `src/components/cwiczenia/TrainingSection.test.tsx` (stuknięcia wypełniają kolejne wiersze, −/+), `e2e/cwiczenia-tydzien.spec.ts` (zapis dwóch serii i „Ostatnio”, axe bloku).
- **Commit:** zobacz `git log --grep "C2.2"`, 2026-11-26.

## Ćwiczenia — eksport CSV treningu, diety i masy; wspólny CSV z Długami (C3.5, 2026-11-25)

- **Co robi:** na dole widoku Ćwiczeń są przyciski „Trening CSV”, „Dieta CSV” i „Waga CSV”, każdy widoczny tylko wtedy, gdy są dane tego rodzaju. Każdy zapisuje plik `notki-<rodzaj>-<dzień>.csv` do otwarcia w polskim Excelu. Trening ma jedną serię na wiersz (data, godzina, ćwiczenie, seria, powtórzenia albo sekundy, ciężar, notatka przy pierwszej serii), dieta jeden posiłek na wiersz (kcal i białko), waga jedno ważenie na wiersz.
- **Gdzie jest:** `src/lib/csv.ts` (`csvText`, `csvNumber`, `csvDocument`) — wspólny format; `src/lib/fitnessCsv.ts` (`trainingCsv`, `mealsCsv`, `weightsCsv`); `ExportCsv` w `src/components/cwiczenia/CwiczeniaView.tsx` (`cwiczenia-export`). `debtsCsv` w `src/lib/debts/model.ts` korzysta teraz z `csv.ts` zamiast własnej kopii; wynik bez zmian.
- **Jak działa:** separator „;”, BOM UTF-8, CRLF, przecinek dziesiętny. Tekst z wpisu zaczynający się od `=`, `+`, `-`, `@`, tabulatora albo CR dostaje apostrof, żeby arkusz nie wykonał go jako formuły. Liczby idą osobno (`csvNumber`) i nie dostają apostrofu, bo minus w liczbie to znak, nie formuła. Generator ładuje się dopiero po kliknięciu (`import("@/lib/fitnessCsv")`).
- **Ograniczenia i pułapki:** inne eksporty CSV (Grafik, Plany, Praca) mają wciąż własne funkcje. `csvCell` w `src/lib/plans/csv.ts` dodaje apostrof także przed liczbą ujemną. Przejście ich na `csv.ts` to osobny krok, z porównaniem plików przed i po. Odżywki nie mają eksportu.
- **Testy:** `src/lib/csv.test.ts`, `src/lib/fitnessCsv.test.ts`, dotychczasowe testy CSV Długów w `src/lib/debts/model.test.ts`.
- **Commit:** `dfbc1e3f`, 2026-11-25.

## Ćwiczenia — dieta: średnia z 7 dni i cel białka z masy ciała (C4.3, C4.4, 2026-11-25)

- **Co robi:** nad listą „Ostatnie 7 dni” w Diecie jest jedno zdanie: „Średnio 2200 kcal, cel 2400 · 120 g białka, cel 150 g — z 2 dni z wpisami”. W formularzu celów, gdy w zakładce „Waga” jest ważenie, widać „Przy masie 80 kg: 128–176 g białka dziennie (1,6–2,2 g na kg)” i przycisk „Przyjmij 144 g”. Przycisk od razu zapisuje cel białka, liczony 1,8 g na kg. Gdy cel już jest równy tej liczbie, przycisku nie ma.
- **Gdzie jest:** `src/lib/diet/model.ts` (`rangeAverage`, `proteinRangeFor`); `src/components/cwiczenia/DietSection.tsx` (`WeekList` — `diet-average`, `GoalsForm` — `protein-from-weight`, ostatnie ważenie z `useWeights`).
- **Jak działa:** średnia liczy tylko dni, w których podano daną wartość, więc dzień bez posiłków nie zaniża wyniku. Kalorie i białko mają osobne liczniki dni, a zdanie podaje większy z nich. Zakres białka liczony jest z najnowszego ważenia (po dniu), zaokrąglony do całych gramów.
- **Ograniczenia i pułapki:** średnia obejmuje 7 dni widocznych na liście, razem z dzisiejszym, niepełnym dniem. Podpowiedź białka nie uwzględnia wieku, płci ani celu (redukcja czy masa): to ogólny zakres dla trenujących.
- **Testy:** `src/lib/diet/model.test.ts` (`rangeAverage`, `proteinRangeFor`), `src/components/cwiczenia/DietSection.test.tsx` (zdanie średniej, zakres i „Przyjmij”, brak bez ważenia).
- **Commit:** `b73a7a67`, 2026-11-25.

## Ćwiczenia — dieta: ulubione posiłki (C4.1, 2026-11-26)

- **Co robi:** przy każdym dzisiejszym posiłku jest gwiazdka „Ulubiony: …” (`aria-pressed`). Stuknięcie przypina posiłek z kaloriami i białkiem, a ponowne stuknięcie go odpina. Przypięte posiłki są pigułkami z gwiazdką nad „ostatnimi” (`diet-favorites`). Stuknięcie w pigułkę od razu zapisuje posiłek z godziną i dniem (Dziś/Wczoraj) z formularza, z toastem „Dodano posiłek” i „Cofnij”. Przycisk × obok pigułki odpina posiłek, też z „Cofnij”. Przypięte posiłki nie powtarzają się w „ostatnich”.
- **Gdzie jest:** `src/lib/diet/model.ts` (`MealFavorite`, `FAVORITE_KNOWN`, `favoriteId`, `cleanFavorite`, `mealKey`, `DIET_MAX_FAVORITES`, `recentMeals(meals, limit, skip)`); `src/lib/diet/yDiet.ts` (`getFavorites`, `pin`, `unpin`, `repin`, zrzut i scalenie); `src/lib/diet/store.ts` (`useMealFavorites`, `pinMeal`, `unpinMeal`, `repinMeal`); `src/components/cwiczenia/DietSection.tsx` (`MealRow` z gwiazdką, `togglePin`, `unpinWithUndo`, `logFavorite` w `AddMealForm`).
- **Jak działa:** nowa mapa Yjs `dietFavorites`, jeden klucz na posiłek: `{ id, text, kcal?, protein?, created }`. Id to `f-` plus FNV-1a 32 bit z opisu po `mealKey` (bez wielkości liter i nadmiarowych spacji). Ten sam posiłek przypięty na dwóch telefonach daje więc po scaleniu jeden wpis, a nie dwa. Ponowne przypięcie tego samego opisu niczego nie zmienia. Kolejność pigułek: według `created`, czyli w kolejności przypięcia. W kopii zapasowej ulubione są polem `favorites` w sekcji „Dieta” (`DietDump`). Pole jest dodawane tylko wtedy, gdy coś jest przypięte, więc kopia bez ulubionych wygląda tak jak dotąd (zrzut w `src/lib/backup/__snapshots__` bez zmian). Scalenie z kopii dodaje brakujące posiłki i nic nie kasuje. Mapa jest w `PRESERVES` spisu map (`docMapsInventory.test.ts`) i w `docs/dane-mapa.md`.
- **Ograniczenia i pułapki:** najwyżej 12 ulubionych (`DIET_MAX_FAVORITES`); nadmiar kończy się toastem z prośbą o odpięcie. Zmiana kalorii przypiętego posiłku wymaga odpięcia i przypięcia innego wpisu, bo edycji ulubionych nie ma. Starsza wersja aplikacji nie zna mapy: nie pokaże pigułek, ale ich nie skasuje, a z kopii przywróci tylko posiłki i cele. `SCHEMA_VERSION` bez zmian, bo nowa mapa nie zmienia znaczenia istniejących danych (`docs/dane-wersje.md`, lista kontrolna, punkt 1).
- **Testy:** `src/lib/diet/model.test.ts` (`favoriteId`, `cleanFavorite`, `recentMeals` z pominięciem), `src/lib/diet/yDiet.test.ts` (ponowne przypięcie, scalenie dwóch urządzeń, limit, „Cofnij”, kopia z polem i bez niego), `src/lib/exerciseExtra.test.ts` (nieznane pole ulubionego przez „Cofnij” i kopię), `src/components/cwiczenia/DietSection.test.tsx` (gwiazdka, pigułka zapisuje, ×, brak w „ostatnich”), `e2e/cwiczenia-tydzien.spec.ts` (przypięcie, zapis jednym stuknięciem, odpięcie).
- **Commit:** `24caffd2`, 2026-11-26.

## Ćwiczenia — podsumowanie miesiąca do udostępnienia (C3.3, 2026-11-25)

- **Co robi:** przycisk „Podsumowanie miesiąca” na dole widoku Ćwiczeń, obok przycisków CSV, wysyła krótki tekst o bieżącym miesiącu. Na telefonie otwiera arkusz udostępniania, na komputerze kopiuje do schowka. Przykładowy tekst:
  ```
  Ćwiczenia — listopad 2026
  Treningi: 3 dni
  Nowe rekordy: 2
  Średnio dziennie: 2200 kcal, 100 g białka (2 dni z wpisami)
  Masa: 80,6 → 79,8 kg (−0,8 kg)
  ```
  Puste części, np. bez diety albo bez ważenia, są pomijane.
- **Gdzie jest:** `src/lib/fitnessMonth.ts` (`monthFitness`, `monthFitnessText`, typ `MonthFitness`); przycisk w `ExportCsv` w `src/components/cwiczenia/CwiczeniaView.tsx`, wysyłka przez `shareOrCopy`. Moduł ładowany po kliknięciu.
- **Jak działa:** rekord liczony jest tak jak toast „Nowy rekord” przy zapisie: wpis, którego najcięższa seria przewyższa wszystkie wcześniejsze w tym ćwiczeniu, także sprzed miesiąca. Pierwszy zapis ćwiczenia rekordem nie jest. Średnie kcal i białka liczone są z dni z podaną wartością. Masa to pierwsze i ostatnie ważenie w miesiącu.
- **Ograniczenia i pułapki:** tylko bieżący miesiąc, bez wyboru innego. Odżywki nie wchodzą do podsumowania. Rekordy porównują tylko ciężar, nie powtórzenia ani 1RM.
- **Testy:** `src/lib/fitnessMonth.test.ts`.
- **Commit:** `6923d2f0`, 2026-11-25.

## Ćwiczenia — tydzień lżej po 6 tygodniach z rzędu (C2.5, 2026-11-25)

- **Co robi:** gdy przez 6 lub więcej pełnych tygodni z rzędu (pn–nd) był choć jeden trening, w Treningu pod „Ten tydzień” pojawia się podpowiedź: „6 tygodni treningu z rzędu. Ten tydzień lżej: mniej o ok. 40% serii albo ciężaru…”. „Nie teraz” chowa ją do końca bieżącego tygodnia. Jeśli seria trwa dalej, w następnym tygodniu podpowiedź wraca.
- **Gdzie jest:** `src/lib/training/model.ts` (`trainingStreakWeeks`, `DELOAD_AFTER_WEEKS` = 6); `src/lib/training/deload.ts` (`deloadDismissedStore`, `useDeloadDismissed`, `dismissDeload`); `TrainingSection.tsx` (`deload-hint`).
- **Jak działa:** seria liczona jest wstecz od tygodnia przed bieżącym, który jeszcze trwa. Pierwszy tydzień bez treningu ją przerywa. Odrzucenie zapisuje poniedziałek bieżącego tygodnia w `localStorage` pod kluczem `kaczy.training.deloadDismissed.v1` (`CWICZENIA.deloadDismissed`). Klucz jest per urządzenie i poza kopią. Zły zapis daje `null`, czyli podpowiedź widać.
- **Ograniczenia i pułapki:** to tylko podpowiedź. Nie zmienia planu ani formularza i nie mierzy objętości, więc nie wie, czy tydzień faktycznie był lżejszy. Odrzucenie na jednym telefonie nie działa na drugim.
- **Testy:** `src/lib/training/model.test.ts` (`trainingStreakWeeks`: seria, luka, bieżący tydzień), `src/components/cwiczenia/TrainingSection.test.tsx` (pokazanie po 6 tygodniach, „Nie teraz”, brak przy 5).
- **Commit:** `c2794583`, 2026-11-25.

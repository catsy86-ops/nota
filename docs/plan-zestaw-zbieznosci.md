# Zestaw zbieżności (Z-17.8): co porównywać, czego nie, jak generować operacje

> **Status:** specyfikacja z sesji J, 2026-11-17. Kodu nie ma. Wykonanie: **Z-17.9** (Sonnet; notatki — Opus). Poprzedza A4.5, L1.2, Z-11 i resztę Z-4.T.
> **Po co:** Yjs gwarantuje, że dwa dokumenty po wymianie aktualizacji mają ten sam stan surowy. Test, który porównuje surowe mapy, sprawdza więc bibliotekę, nie aplikację, i zawsze jest zielony. Błędy aplikacji leżą w czterech miejscach: w **projekcji** (to, co funkcje odczytu robią z dokumentu), w **zapisach przy odbiorze** (obserwator, który coś dopisuje), w **niezmiennikach, których scalanie nie pilnuje** (limity, kolejność, odwołania) i w **operacjach „odczytaj–zmień–zapisz”** (cicha utrata cudzej zmiany).
> **Stan dziś:** `src/lib/study/properties.prop.test.ts` ma dwa testy scalania Pracy (porównuje tylko posortowane identyfikatory wpisów), `yjsStore.test.ts` i testy działów mają przykłady na dwóch dokumentach. Nie ma wspólnego pomocnika ani losowych przeplotów z dostawą częściową.

## 1. Pięć własności

Każdy dział sprawdza te same pięć, w tej kolejności (pierwsza niespełniona kończy przebieg):

| Nr | Własność | Co łapie |
|---|---|---|
| **W1** | **Równość projekcji.** Po pełnej wymianie `project(replika i)` jest identyczne dla wszystkich replik — łącznie z **kolejnością** list | sortowanie bez rozstrzygnięcia remisu, czytanie z pamięci podręcznej, projekcja zależna od stanu lokalnego |
| **W2** | **Zimna = ciepła.** Nowy magazyn utworzony z `Y.encodeStateAsUpdate(doc)` repliki daje tę samą projekcję co replika, która przeszła przez operacje i odbiór | nieunieważniona pamięć podręczna (`noteCache` i `dirtyNotes` w `yjsStore.ts:565`, `snapshot` w `yDebts.ts`, `yShifts.ts`), stan trzymany poza dokumentem |
| **W3** | **Spokój po wymianie.** Po pełnej wymianie i ponownym odczycie każdej repliki żadna nie wytwarza nowej aktualizacji; ponowne dostarczenie wszystkich aktualizacji niczego nie zmienia | obserwator, który pisze przy odbiorze (naprawy, migracje, `ensure*`) — dwa urządzenia odbijałyby zmiany w nieskończoność |
| **W4** | **Niezmienniki działu** na projekcji (§3) | odwołanie do usuniętego obiektu, niespójna grupa pól, zdublowany identyfikator, wartość spoza zakresu po `clean*` |
| **W5** | **Nic nie ginie bez powodu.** Obiekt dodany z własnym identyfikatorem i przez nikogo nieusunięty istnieje; pole zapisane przez jedno urządzenie i przez nikogo innego nieruszone ma zapisaną wartość | operacja „odczytaj–zmień–zapisz” nadpisująca cudze pole, scalanie kopii kasujące wpis |

W1 **z kolejnością** jest celowe. `Y.Map` iteruje w kolejności, w jakiej klucze trafiły do repliki, a ta zależy od kolejności odbioru. Lista sortowana komparatorem z remisami (albo wcale) wygląda inaczej na dwóch telefonach przy identycznych danych. Projekcja ma zwracać kolejność taką, jaką widzi użytkownik; test jej nie sortuje.

## 2. Czego nie porównywać (legalnie niezbieżne)

**Poza projekcją — stan urządzenia:** stos cofania (`Y.UndoManager` Grafiku, „Cofnij” w dymkach), otwarte sesje edycji (`textBases`), wszystko w `localStorage` (ustawienia, odpalone przypomnienia, szkice, podsumowanie push), `imageStore` (bajty obrazów — obecność zależy od urządzenia; porównujemy tylko listy odwołań), odblokowany skarbiec i treść odszyfrowana (porównujemy szyfrogram `vault`), postęp Nauki trzymany lokalnie.

**W projekcji, ale z osłabioną asercją:**

| Pole albo sytuacja | Co wolno sprawdzać | Dlaczego |
|---|---|---|
| Kto wygrał przy równoległym zapisie tego samego klucza | wartość jest **jedną z zapisanych** i taka sama wszędzie; **nie** „późniejsza wygrywa” | Yjs rozstrzyga po identyfikatorze klienta, nie po zegarze |
| `updatedAt`, `at`, `created` | równe między replikami; nie porównywać z zegarem testu | wartość pochodzi z zegara urządzenia, które wygrało |
| Notatka złożona z pól dwóch urządzeń (tytuł od A, kolor od B) | każde pole z osobna spełnia regułę wyżej; do tego niezmienniki grup pól (§3.1) | notatka to `Y.Map` z polem na klucz — mieszanie jest zamierzone |
| Treść `Y.Text` po równoległych wstawkach | równa między replikami; każda wstawka, której nikt nie usunął, występuje w całości; nie sprawdzać kolejności wstawek w tym samym miejscu | przeplot zależy od identyfikatorów klientów |
| Usunięcie klucza równolegle z zapisem **wartości zwykłej** pod tym kluczem (długi, dni Grafiku, wpisy Pracy) | wynik równy między replikami; wpis albo jest (z nową wartością), albo go nie ma | zapis i usunięcie w `Y.Map` konkurują jak dwa zapisy — „wskrzeszenie” jest legalne |
| Usunięcie notatki równolegle ze zmianą jej pola | notatki nie ma | zmiana wewnątrz usuniętej mapy zagnieżdżonej ginie — W5 jej nie liczy |
| Tablica zapisana jako jedna wartość (`labels`, `imageHashes`, `checked`) zmieniona na dwóch urządzeniach | równa jednej z dwóch wersji | cała tablica wygrywa albo przegrywa; **strata jednej zmiany jest dziś zamierzona** — patrz §6, pkt 3 |
| Przekroczenie limitu po scaleniu (`DEBT_MAX_ENTRIES`, limity Pracy) | liczba ≤ limit + suma dodanych bez łączności; projekcja nie obcina po cichu różnie na replikach | każde urządzenie pilnuje limitu tylko u siebie |

Reguła dla wykonawcy: pole wolno dopisać do tej tabeli tylko z uzasadnieniem w komentarzu testu. „Test był czerwony” nie jest uzasadnieniem — to wynik do zgłoszenia.

## 3. Projekcje i niezmienniki działów

Projekcja to wynik **publicznej funkcji odczytu**, tej samej, której używa interfejs, przepuszczony przez `JSON.stringify` z kluczami obiektów w porządku alfabetycznym (kolejność list zostaje). Nigdy `doc.toJSON()`.

### 3.1 Notatki (`yjsStore.ts`) — Opus

- **Projekcja:** `projectNotes()` posortowane tak, jak sortuje lista notatek (funkcja sortująca z interfejsu, nie własna), `projectFolders()`, `projectLabels()`, `projectPropDefs()`, `getVaultMeta()`, dla notatek zablokowanych `getVault(id)`. Treść: `content` z projekcji **i** `getNoteText(id)?.toString()` — mają być równe sobie.
- **Niezmienniki:** identyfikatory niepowtarzalne; `folderId` i `parentId` wskazują istniejący obiekt albo interfejs traktuje je jak brak (sprawdzić, co robi — wynik zapisać); brak cyklu w `parentId`; grupa przypomnienia spójna (`reminder`, `reminderRepeat`, `reminderRule`, `reminderTime`: reguła bez terminu nie istnieje, `reminderRepeat` jest zapasem dla `reminderRule` według `fallbackRepeat`); notatka zablokowana nie ma jawnej treści ani tytułu obok `vault`; każda etykieta notatki jest w `projectLabels()`; wartości właściwości pasują do typu definicji albo są pomijane.
- **Operacje:** `upsertNote`, `patchNote` (jedno pole albo kilka), `patchNotes`, edycja treści przez sesję (`beginTextEdit` → zmiana → `endTextEdit`) oraz `writeContent` bez sesji (Z-4.T), `setNoteOrder`, `removeNote(s)`, kosz i przywrócenie, `upsertFolder`, `patchFolder`, `removeFolder`, `addLabel`, `removeLabelEverywhere`, `renameLabelEverywhere`, `upsertPropDef`, `deletePropDef`, `lockNote`, `setVault`, `unlockNote`, `rekeyVault`, `replaceAll` (rzadko — waga 1 na 50), `mergeSyncState`.
- **Uwagi:** `createYjsStore(dbName)` sam tworzy dokument i `IndexeddbPersistence` — replika to magazyn, wymiana przez `store.doc`; W2 przez nowy magazyn i `Y.applyUpdate`. Przebiegów mniej (50), bo magazyn jest ciężki.

### 3.2 Długi (`debts/yDebts.ts`) — Sonnet

- **Projekcja:** `get()` (po `cleanDebt`, w kolejności `byNewest`) oraz salda po osobach z `model.ts` — to z nich użytkownik czyta kwoty.
- **Niezmienniki:** identyfikatory niepowtarzalne; kwoty skończone i dodatnie; suma sald = suma wpisów; po Z-17.4 — spłaty rat nie przekraczają kwoty wpisu, a stan raty wynika ze spłat (reguły z `plan-zgodnosc-i-obieg.md`).
- **Operacje:** `add`, `replace`, `replaceMany` (zmiana nazwy osoby, łączenie osób), `remove`, `restore` (cofnięcie usunięcia), `mergeDump`. Generator ma często dawać **ten sam dzień** dla wielu wpisów i czasem ten sam `created` — to testuje remis w `byNewest` (`model.ts:125` nie ma rozstrzygnięcia po identyfikatorze).
- Po Z-17.3 dodatkowo: wpis z nieznanym polem przechodzi przez `replace` na „starej” replice bez utraty pola (stara replika = `cleanDebt` sprzed zmiany, wstrzyknięta do `createYDebts` w teście).

### 3.3 Grafik (`shifts/yShifts.ts`, `schedules.ts`) — Sonnet

- **Projekcja:** `get()` każdego grafiku (po `migrate`) i lista grafików z rejestru; do tego podsumowanie miesiąca (`summary.ts`) dla miesięcy z danymi — kwoty mają być równe, nie tylko dni.
- **Niezmienniki:** rodzaj dnia (`type`) istnieje wśród rodzajów albo dzień jest pomijany jednakowo wszędzie; `order` rodzajów i cykli daje tę samą kolejność na replikach (remis!); `typesInit` i `patternsInit` ustawione → listy niepuste albo świadomie puste; dane grafiku, którego nie ma w rejestrze, nie pojawiają się w interfejsie.
- **Operacje:** `setDayShift`, `setDayEntry`, `writeDays`, cofnięcie (`undoManager.undo()` i zwrot z `writeDays`), `saveShiftType` (ze zmianą godzin — dopisuje kopie godzin do dni wstecz), usunięcie rodzaju, zapis i usunięcie cyklu, wypełnienie cyklem, premie, ustawienia w `meta`, utworzenie i usunięcie grafiku, `replaceAll`.
- **Przypadki obowiązkowe (stałe, obok losowych):** dwa telefony bez łączności dodają po jednym rodzaju zmiany (oba dostają ten sam `order` z `nextOrder`) → kolejność na obu taka sama; telefon A usuwa rodzaj startowy, telefon B równolegle pierwszy raz zmienia rodzaje (`ensureTypes` zapisuje wszystkie startowe) → wynik równy, zachowanie zapisać; A zmienia notatkę dnia, B równolegle maluje ten dzień inną zmianą (`setDayShift` przepisuje notatkę ze swojego stanu) → równe, a która notatka została — zapisać jako wynik.

### 3.4 Praca (`study/yStudy.ts` i mapy sąsiednie) — Sonnet, po jednym PR na grupę

- **Projekcja:** `yStudy.dump()` (po `cleanDump`), osobno `yBilling`, `yPoints`, `yVan`, `yJobs`, `yKits`, `yPricing`, `yEntryCheck`, `yClients` — każdy swoim publicznym odczytem; do tego **wyniki pochodne z pieniędzmi i stanami**: `billingStatement`, `vanStock`.
- **Niezmienniki:** wpis dziennika wskazuje budowę, która istnieje, albo ma pustą budowę; wpłaty mają niepowtarzalne identyfikatory w obrębie budowy; stan auta skończony; odhaczenia (`yEntryCheck`) odnoszą się do istniejących wpisów albo są pomijane; punkty i etapy budowy usuniętej nie liczą się do rozliczeń.
- **Operacje:** dodanie, zmiana i usunięcie wpisu, karty budowy, punktu, etapu, wpłaty, zdarzenia auta, zlecenia; odhaczenie i jego zdjęcie; `replaceAll` i scalenie paczki budowy (`sitePackage`); archiwizacja budowy równolegle z dopisaniem wpisu do niej.

Pozostałe działy z mapami w dokumencie (`diet`, `supplements`, `training`, `weight`, `plans`, `ksef/yInvoices`) dostają zestaw tym samym pomocnikiem przy najbliższej zmianie w dziale — bez osobnej specyfikacji; faktury (`yInvoices`) przed Etapem 2 KSeF.

## 4. Generator przebiegów

Przebieg to lista kroków na 2 albo 3 replikach (3 w co trzecim przebiegu):

| Krok | Znaczenie |
|---|---|
| `op(d, operacja)` | operacja działu na replice `d` |
| `deliver(a→b, n)` | dostarcz `n` najstarszych aktualizacji z kolejki `a→b` |
| `deliverShuffled(a→b)` | dostarcz całą kolejkę w losowej kolejności, z jedną aktualizacją powtórzoną |
| `syncState(a→b)` | wymiana różnicowa: `Y.encodeStateAsUpdate(a, Y.encodeStateVector(b))` — tak dołącza urządzenie po długiej przerwie i tak działa przekaźnik po resecie |
| `tick(ms)` | przesunięcie zegara |
| `reopen(d)` | zastąp replikę nową z jej stanu (zamknięcie i otwarcie aplikacji) — po tym kroku stos cofania jest pusty |

Kolejki powstają z `doc.on("update")`: każda lokalna aktualizacja trafia do kolejek wszystkich pozostałych replik. **Praca bez łączności** to po prostu ciąg `op` bez `deliver` — generator ma to wymuszać: co najmniej jeden odcinek 3–10 operacji na jednej replice bez dostawy w każdym przebiegu. **Cofnięcia** są zwykłymi operacjami działu, ale generator umieszcza je także **po** dostawie cudzych zmian (cofnięcie nie może skasować tego, co przyszło w międzyczasie — W5).

Zakończenie każdego przebiegu: dostarczenie wszystkich kolejek, potem `syncState` każdy z każdym dwa razy, potem W1–W5.

**Operacje są generowane względem modelu, nie na ślepo.** Generator trzyma prosty model („jakie identyfikatory istnieją na replice `d`”) i losuje cele z istniejących obiektów z prawdopodobieństwem 0,8, a z nieistniejących albo już usuniętych z 0,2 (operacja na obiekcie usuniętym gdzie indziej to właśnie ciekawy przypadek). Przestrzeń identyfikatorów mała (8–12 na dział), teksty krótkie, daty z 10 dni, kwoty z 6 wartości — kolizje mają być częste. W `fast-check`: `fc.commands` albo własna lista kroków; kurczenie ma usuwać kroki, nie zmieniać identyfikatorów.

**Powtarzalność — trzy warunki, bez których kurczenie nie działa:**

1. `doc.clientID` ustawiany jawnie (`d + 1`) zaraz po utworzeniu repliki, przed pierwszą operacją; po `reopen` — nowy, kolejny numer. Losowy identyfikator klienta zmienia zwycięzcę przy każdym uruchomieniu.
2. Zegar: `vi.useFakeTimers()` z czasem ustawianym krokiem `tick`; replikom wolno dać **różne przesunięcia zegara** (telefon ze złą godziną) — osobny parametr przebiegu.
3. Identyfikatory obiektów z generatora, nie z `crypto.randomUUID()` w kodzie działu; gdzie kod losuje sam — podmiana przez `vi.spyOn(crypto, "randomUUID")` z licznikiem na replikę.

Liczba przebiegów: 200 na dział w zwykłym `npm test` (notatki 50), 2000 w osobnym skrypcie `test:convergence` uruchamianym przed wydaniem. Ziarno porażki zapisywane w komunikacie; każda znaleziona porażka staje się stałym przypadkiem w teście działu.

## 5. Pomocnik `src/test/convergence.ts`

```ts
export interface Replica<S> { doc: Y.Doc; store: S }

export interface ConvergenceDomain<S, Op> {
  name: string;
  /** Nowa replika; `from` — stan do wczytania (W2, `reopen`). Ustawienie `clientID` robi pomocnik. */
  create(index: number, from?: Uint8Array): Replica<S> | Promise<Replica<S>>;
  /** Operacje względem modelu identyfikatorów repliki. */
  ops(model: IdModel): fc.Arbitrary<Op>;
  /** Wykonuje operację i aktualizuje model. Nie rzuca przy celu, którego nie ma. */
  apply(replica: Replica<S>, op: Op, env: { device: number; model: IdModel }): void;
  /** Publiczny odczyt w kolejności interfejsu; wynik serializowalny. */
  project(store: S): unknown;
  /** Naruszenia niezmienników działu (W4); pusta lista = dobrze. */
  invariants?(projection: unknown): string[];
  /** Naruszenia W5 na podstawie historii operacji wszystkich replik. */
  losses?(history: readonly Applied<Op>[], projection: unknown): string[];
  /** Odczyt, który może pisać (start działu) — wołany przed W3. */
  settle?(store: S): void;
}

export function convergenceProperty<S, Op>(
  domain: ConvergenceDomain<S, Op>,
  opts?: { replicas?: 2 | 3; maxSteps?: number; clockSkewMs?: number },
): fc.IAsyncProperty<[Step<Op>[]]>;

/** Jeden stały przebieg — dla przypadków obowiązkowych i odtworzonych porażek. */
export function runScript<S, Op>(domain: ConvergenceDomain<S, Op>, steps: Step<Op>[]): Promise<ConvergenceReport>;
```

`ConvergenceReport` zawiera, która własność padła, różnicę projekcji (pierwsza różniąca się ścieżka, nie cały zrzut) i listę kroków po skurczeniu. Pomocnik sam: zakłada kolejki, pilnuje `clientID`, liczy aktualizacje wytworzone po wymianie (W3), buduje zimną replikę (W2). Dział dostarcza tylko to, co w interfejsie.

Pomocnik ma własny test: dział-atrapa z celowo zepsutą projekcją (sortowanie z remisem), z obserwatorem piszącym przy odbiorze i z pamięcią podręczną bez unieważniania — każdy ma zostać wykryty odpowiednio przez W1, W3, W2. Bez tego nie wiadomo, czy zielony zestaw cokolwiek sprawdza.

## 6. Czego się spodziewać przy pierwszym uruchomieniu

Z czytania kodu — do potwierdzenia testem, nie do poprawiania na ślepo:

1. **Kolejność rodzajów zmian i cykli w Grafiku.** `nextOrder` liczy z lokalnego stanu, więc dwa telefony bez łączności nadają ten sam `order`; `byOrder` (`yShifts.ts:46`) nie rozstrzyga remisu, a kolejność w `Y.Map` zależy od kolejności odbioru. Poprawka: remis po identyfikatorze.
2. **Kolejność długów z tego samego dnia** — `byNewest` przy równym `at` i `created`. W praktyce rzadkie (milisekundy), w generatorze częste. Poprawka jak wyżej.
3. **Etykiety notatki jako jedna tablica.** A dodaje etykietę „pilne”, B równolegle „budowa” — jedna znika. To samo `imageHashes` (obraz dodany na dwóch urządzeniach do tej samej notatki: jedno odwołanie ginie, a bajty po karencji sprzątnie odśmiecanie) i `checked` we wpisach Pracy. Zestaw ma to **pokazać i policzyć**, nie ukryć w tabeli z §2. Zmiana na zbiór w `Y.Map` to zmiana kształtu danych (`plan-migracje-yjs-2026-11-15.md`) — decyzja D-Z1.
4. **`setNoteOrder` na dwóch urządzeniach** — notatki z tym samym `order`; czy lista ma rozstrzygnięcie remisu, wyjdzie w W1.
5. **`ensureTypes` równolegle z usunięciem rodzaju startowego** — rodzaj wraca. Zapisać jako zachowanie; poprawka tylko jeśli właściciel uzna to za błąd.
6. **Notatka w usuniętym folderze** (A przenosi notatkę do folderu, B równolegle go usuwa) — W4 pokaże, czy notatka jest widoczna.

## 7. Zlecenie Z-17.9 (Sonnet, M; notatki — Opus)

Kolejność: pomocnik z testem na atrapie → Długi (najmniejszy dział, wzorzec dla reszty) → Grafik → Praca (trzy PR: dziennik i budowy; rozliczenia, punkty, etapy; auto, zlecenia, klienci) → Notatki (Opus, razem z resztą Z-4.T). Każdy PR: zestaw losowy, przypadki obowiązkowe z §3, lista znalezionych porażek z ziarnem. **Porażki zgłaszać, nie poprawiać w tym samym PR** i nie osłabiać asercji bez wpisu w tabeli §2 — poprawki przegląda Fable (sesja G+), bo część z nich zmienia kształt danych.

Skrypt `test:convergence` (2000 przebiegów) w `package.json`; nie wchodzi do zwykłego `npm test`.

## 8. Decyzja właściciela

| Decyzja | Blokuje | Zalecenie |
|---|---|---|
| **D-Z1** — etykiety, odwołania do obrazów i odhaczenia jako zbiory scalane element po elemencie zamiast jednej tablicy | poprawka do §6 pkt 3 | najpierw pomiar z zestawu (jak często i co ginie); zmienić `imageHashes` i `labels`, jeśli test potwierdzi stratę — to jedyne miejsca, gdzie użytkownik traci coś, co dodał |

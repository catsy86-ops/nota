# Zgodność w przód nowych pól i obieg „rata / odhaczenie / grupa” (Z-17.1, Z-17.2)

> **Status:** specyfikacja (sesja H z `plan-uzycia-fable-cz2-2026-11-17.md`), 2026-11-17. Kod bez zmian. Zlecenia dla Opusa i Sonneta w §4.
> **Sprawdzone w kodzie:** `src/lib/debts/{model,yDebts,store,settleFromNote}.ts`, `src/lib/supplements/{model,ySupplements,store}.ts`, `src/components/cwiczenia/CwiczeniaView.tsx` (wiersze 40–102), `src/components/ReminderQuickActions.tsx`, `src/components/useReminderNotifications.ts` (66–93), `src/lib/reminderRepeat.ts`, `src/lib/reminderActions.ts`, `src/lib/formatSchema.ts`, `src/lib/noteSchema.ts` (pola `debts`, `supplements`). Pozostałe `clean*` — tylko sygnatury i osiem ciał (lista w §1.6).
> **Zmiana względem zalecenia D-X1:** bramka wersji z `formatSchema` nie wystarcza (§1.2). Zamiast niej reguła „mapa boczna” i „wpis niewidoczny dla starszego czytelnika”. Do potwierdzenia przez właściciela.

## 1. Z-17.1 — nowe pola a starsze wersje

### 1.1 Co dokładnie się dzieje

Wpis w mapie Yjs (`debts`, `supplements`, `studyBilling`, …) to jedna wartość pod jednym kluczem. Zapis podmienia ją w całości, a przy dwóch równoczesnych zapisach wygrywa jeden — też w całości.

`cleanDebt` buduje wpis od zera ze znanych pól i stoi **na odczycie** (`yDebts.get`, wiersz 27), nie tylko na zapisie. Dlatego pole, którego wersja nie zna, ginie na każdej drodze, która zapisuje wpis wzięty z odczytu:

| Droga | Miejsce |
|---|---|
| edycja wpisu | `updateDebt` → `replace` |
| zmiana nazwy i łączenie osób | `renamePeople` → `replaceMany` (wszystkie wpisy osoby naraz) |
| „Cofnij” po zmianie nazwy | `restoreDebts` → `replaceMany` |
| „Cofnij” po usunięciu | `remove` zwraca oczyszczony wpis → `restore` |
| dopisanie terminu | `DebtsView.tsx:227`, `:637` (`updateDebt({ ...entry, dueNoteId })`) |
| kopia zapasowa | `dump` = `get`; `mergeDump` czyści przy scalaniu |

Tak samo działają pozostałe `clean*` (§1.6). Wyjątkiem są notatki: `YNote` to `Y.Map` z osobnym kluczem na pole, więc starsza wersja nie rusza pól, których nie zna.

Drugi skutek tej samej budowy, niezależny od wersji: dwa telefony w **tej samej** wersji, z których jeden zmienia kwotę, a drugi w tym czasie dopisuje do wpisu zdjęcie, też tracą jedną ze zmian.

### 1.2 Dlaczego bramka wersji nie wystarcza

`writeFormatAllowed` patrzy na urządzenia **widziane teraz** w awareness; bez grupy zwraca „tak”. Telefon, który jest wyłączony w chwili zapisu i wróci ze starszą wersją, bramki nie zatrzyma. Bramka nie chroni też kopii zapasowej zrobionej starszą wersją.

Jest też błąd wcześniejszy niż utrata pola: starsza wersja **źle czyta** wpis, zanim cokolwiek zapisze. Wpis z `currency: "EUR"` jest dla niej poprawnym wpisem w złotych i wchodzi do salda od razu po synchronizacji.

Samo „zachowuj nieznane pola” (§1.5) pomaga dopiero od wersji, która to umie. Wersje już zainstalowane nadal gubią.

### 1.3 Klasy pól

| Klasa | Skutek utraty albo złego odczytu | Reguła |
|---|---|---|
| **A — ozdoba** | nic poza brakiem podpowiedzi | pole we wpisie, bez dalszych warunków |
| **B — powiązanie** | kwoty dobre, ale rozpada się związek (grupa, dowód, plan rat) | **mapa boczna** (§1.4) |
| **C — znaczenie kwoty** | starsza wersja liczy inną kwotę | wpis **niewidoczny** dla starszego czytelnika (§1.4) |

Planowane pola:

| Pole | Plan | Klasa | Gdzie zapisać |
|---|---|---|---|
| RIR przy serii | C2.3 | A | pole w serii (`trainingLog`) |
| ulubione posiłki | Ćwiczenia | A | nowy klucz albo nowa mapa — nie pole istniejącego wpisu |
| obwody ciała | C3.4 | — | nowa mapa (plan już tak mówi) |
| grupa „zapłaciłem za…” | L3.1 | B | mapa `debtGroups` |
| plan rat | L2.1 | B | mapa `debtPlans` |
| zdjęcie dowodu | L4.3 | B | mapa `debtProofs` |
| waluta | L5.1 | C | osobna mapa `debtsFx`; zalecenie DL-3 = nie |

Pole `dueNoteId` jest znane wszystkim zainstalowanym wersjom i zostaje we wpisie — plan rat z niego korzysta (§2.2).

### 1.4 Dwie reguły, które działają także na wersjach już zainstalowanych

**Mapa boczna (klasa B).** Nowe dane o istniejącym wpisie idą do osobnej mapy Yjs, której starsza wersja nie zna, więc nigdy jej nie nadpisze. Klucz: identyfikator wpisu (`debtProofs`) albo własny identyfikator rekordu, który wskazuje wpisy (`debtGroups`, `debtPlans`). Zysk dodatkowy: zmiana kwoty i dopisanie dowodu z dwóch telefonów naraz już się nie wykluczają.

Zasady mapy bocznej:

1. Rekord powstaje w tej samej transakcji co wpis, którego dotyczy.
2. Usunięcie wpisu na nowej wersji usuwa rekord w tej samej transakcji; „Cofnij” przywraca oba (dane do cofnięcia niosą rekord).
3. Starsza wersja usunie wpis bez rekordu. Rekord-sierotę sprząta nowa wersja: tylko gdy wpisu nie ma **i** rekord ma `created` starsze niż 24 h (zapas na „Cofnij” i na częściową synchronizację). Sprzątanie w jednym miejscu, po wczytaniu dokumentu, pod blokadą karty prowadzącej (`holdTabRole`).
4. Rekord ma własne `clean*` i własny limit liczby.
5. Kopia zapasowa: **nowe pole** w `noteSchema.ts` na każdą mapę (`debtGroups`, `debtPlans`, `debtProofs`). Nie wolno zmieniać kształtu pola `debts` z tablicy na obiekt — starsza wersja czyta je przez `Array.isArray(raw) ? … : []` i przywróciłaby zero długów.
6. Czytelnik pokazuje dane z rekordu tylko dla wpisów, które istnieją i przechodzą `clean*`.

**Niewidoczność (klasa C).** Wpis, którego starsza wersja nie umie poprawnie policzyć, nie może przejść jej `clean*`. Dla wersji zainstalowanych znaczy to: inna mapa. Na przyszłość dochodzi pole `v` (§1.5).

### 1.5 Obrona w głąb w `clean*` (od tej wersji w przód)

Dwie zmiany, obie tanie. Nie zastępują §1.4.

**Zachowanie nieznanych pól.** Wspólny pomocnik `src/lib/extraFields.ts`:

```ts
/** Nieznane klucze surowego wpisu (do odłożenia w `extra`); `undefined`, gdy ich nie ma. */
export function pickExtra(raw: object, known: readonly string[]): Record<string, unknown> | undefined;
/** Kształt do zapisu w Yjs i w kopii: nieznane pola na wierzchu, znane je nadpisują; klucza `extra` nie ma. */
export function toStored<T extends { extra?: Record<string, unknown> }>(entry: T): Omit<T, "extra">;
```

- `pickExtra` przepuszcza najwyżej 8 kluczy pasujących do `/^[a-z][A-Za-z0-9]{0,23}$/` (odpada `__proto__`, `constructor`), bez klucza `extra` i `v`; wartość to `string` do 200 znaków, skończona liczba, `boolean`, albo płaska tablica do 16 takich wartości; całość do 512 bajtów JSON. Co się nie mieści, przepada — peer nie może w ten sposób rozdąć dokumentu.
- Wpis w pamięci ma zwykłe pole `extra?: Record<string, unknown>`. Zwykłe, nie symbol: przeżywa `{ ...entry, person }`, `structuredClone` i `JSON.stringify`, a istniejące „Cofnij” niesie je bez zmian w kodzie.
- **Każdy** zapis do mapy idzie przez `toStored`: w `yDebts.ts` to `add`, `replace`, `replaceMany`, `restore`, `mergeDump`; `dump` oddaje kształt zapisu. `updateDebt` po `cleanDebt` zachowuje `extra`, bo `cleanDebt` czyta je z surowego wpisu albo — gdy dostaje wpis z pamięci — z pola `extra` (jedno i drugie przez `pickExtra`).
- Test strażnik: wpis z nieznanym polem → odczyt → każda z dróg z §1.1 → pole jest w mapie. Osobno: śmieci ponad limit nie przechodzą.

**Minimalna wersja czytelnika.** Opcjonalne pole `v` (liczba całkowita 1–1000) we wpisie. `clean*` zwraca `null`, gdy `v` jest większe niż stała modułu (`DEBT_ENTRY_V = 1`). Wpis jest wtedy niewidoczny i nie do edycji, ale zostaje w mapie; `remove` uszkodzonego wpisu po id działa jak dziś. Od tej wersji klasa C może zostać w tej samej mapie, o ile wszystkie urządzenia mają już `v` — co i tak trzeba sprawdzić ręcznie, więc dla waluty zalecenie zostaje: osobna mapa.

`SCHEMA_VERSION` rośnie do 3 („`clean*` zachowuje nieznane pola i zna `v`”). Służy tylko ostrzeżeniu z `olderDevices` („na starszym urządzeniu część danych może być niewidoczna”), nie bramce zapisu.

### 1.6 Które `clean*` ruszyć

Nie wszystkie. Kolejność według tego, gdzie plany dopisują pola i gdzie są pieniądze:

| Kolejność | Funkcja | Mapa | Powód |
|---|---|---|---|
| 1 | `cleanDebt` | `debts` | plany L2–L4 |
| 2 | `cleanSupplement` | `supplements` | `updateSupplement` (`store.ts:67`) buduje wpis od zera — `extra` trzeba przenieść z `prev` |
| 3 | `cleanSet`, `cleanEntry` (trening) | `trainingLog` | RIR (C2.3) |
| 4 | `cleanPayment`, `cleanQuoteItem`, `cleanQuoteDoc`, `cleanJobMeta` | `studyBilling`, `studyJobs` | pieniądze; plan Pracy dopisuje pola |
| 5 | `cleanRecord` (`ksef/yInvoices.ts`) | `studyInvoices` | faktura; Etap 2 dopisze numer KSeF i stan wysyłki — **sprawdzić przed E2.1**, czy to pole wpisu, czy osobny klucz |
| później, przy okazji | `cleanClient`, `cleanMeal`, `cleanBonus`, `cleanKit`, `cleanVanItem`, `cleanSite`, `cleanEntry` (dziennik) | — | brak planowanych pól |

`cleanPayment` i `cleanQuoteItem` biorą `id` z klucza, nie z wartości — `known` musi to uwzględnić. `cleanWeight` zostaje (wpis to trzy liczby).

### 1.7 Znalezione przy okazji (ta sama klasa, istnieje dziś)

- **R-18.** „Cofnij” po zmianie nazwy (`restoreDebts`) zapisuje wpisy sprzed zmiany w całości. Jeśli drugi telefon w czasie trwania dymka zmienił kwotę któregoś z nich, zmiana jest cofana bez słowa. Naprawa: przywracać tylko pole `person` we wpisach, których `person` nadal równa się nowej nazwie (`{ ...current, person: prev.person }`). Zlecenie Z-17.3, punkt 4.
- **R-19.** „Gotowe” z powiadomienia systemowego (`useReminderNotifications.ts:77`) nie pyta o spłatę długu; pyta tylko „Gotowe” z kafla (`ReminderQuickActions.tsx:68`). Naprawia się samo przez wspólny punkt z §2.4.

## 2. Z-17.2 — obieg rat, grupy i odhaczenia

### 2.1 Zasady wspólne

1. **Prawda jest w jednym miejscu.** Dla długów — wpisy w `debts`. Dla odżywek — klucz `dzień|id` w `supplementLog`. Termin w notatce jest skutkiem, nie źródłem.
2. **Stan jest wyprowadzany, nie liczony.** Nie ma licznika „zapłacono rat”, „odhaczono razy”. Jest funkcja z danych.
3. **Zapis skutku jest wartością docelową, nie krokiem.** „Ustaw termin na 10 grudnia”, nigdy „przesuń o jedno wystąpienie”. Dwa telefony, które zrobią to naraz, zapiszą to samo.
4. **Skutek idzie tylko do przodu.** Cofnięcie spłaty albo odhaczenia nie cofa terminu samo; robi to wyłącznie „Cofnij” tej akcji, która termin przesunęła, i przywraca dokładnie to, co sama zmieniła.
5. **Brak drugiej strony to nie błąd.** Notatki nie ma, jest w koszu, jest prywatna albo nie jest serią miesięczną/dzienną — funkcja zapisuje prawdę, pomija skutek i zwraca powód. Nie rzuca, nie zgaduje, nie naprawia powiązania (naprawa to zapis całego wpisu — §1.1).
6. **Kolejność:** najpierw zapis prawdy i skutku w jednej transakcji dokumentu, potem dymek, wibracja i powiadomienia.

### 2.2 Raty (L2.1) — DL-1: jedna seria

**Dane.** Mapa `debtPlans`, klucz `planId` (`p-<uuid>`):

```ts
interface DebtPlan { id: string; entryId: string; count: number; /** 2–60 */ day: number; /** 1–31 */ first: string; /** YYYY-MM-DD, termin 1. raty */ created: number }
```

Plan **nie** przechowuje kwoty ani identyfikatora notatki. Kwota to `amount` wpisu pożyczki (zmiana kwoty przelicza raty). Notatka to `dueNoteId` wpisu — pole znane starszym wersjom, więc na starszym telefonie usunięcie wpisu sprząta notatkę, a „Gotowe” pyta o spłatę całości (dopuszczalne).

**Harmonogram** — czyste funkcje na dniach `YYYY-MM-DD`, bez znaczników czasu i bez strefy:

- `rateDue(plan, k)`: miesiąc `first` + (k − 1), dzień `min(plan.day, liczba dni miesiąca)`. Dzień 31.: 31.01 → 28/29.02 → 31.03. To ta sama reguła co `getNextReminderTime` dla `monthly` z `anchorDay`.
- `rateAmounts(total, count)`: `base = floor(total / count)`; raty 1…n−1 mają `base`, **ostatnia** `total − base·(n − 1)`. Suma równa się `total` co do grosza. Gdy `base = 0` (kwota w groszach mniejsza niż liczba rat) — formularz odrzuca.

**Stan** — `planState(plan, entries, today)`:

1. Zaliczenie spłat metodą „najstarszy dług pierwszy” w obrębie osoby (art. 451 § 3 KC: bez wskazania spłata idzie na dług najdawniej wymagalny). Funkcja `allocate(entriesOfPerson)`: wpisy w kolejności (`at`, `created`, `id`); dla planu na „Pożyczyłem” kolejkę tworzą wpisy zwiększające saldo (`KIND_SIGN > 0`), a zmniejszają ją wpisy z `KIND_SIGN < 0` — od najstarszego otwartego. Spłata przy pustej kolejce staje się nadpłatą i pokrywa następny dług. Dla planu na „Pożyczyłem od” lustrzanie. Zgodne z `debtSide`.
2. `paid` = ile z kwoty pożyczki zostało pokryte. `done` = największe k, dla którego suma rat 1…k ≤ `paid`. `partial` = `paid` − suma rat 1…`done`.
3. `next` = `done + 1` z terminem `rateDue` i kwotą do zapłaty `rata − partial`; `overdue` = liczba rat z terminem < `today` i numerem > `done`; `finished` = `done === count`.

Niezmiennik do testu własności: dla każdej osoby suma (kwota − pokrycie) po otwartych długach minus nadpłata równa się saldu z `balances`.

Wynika z tego bez dodatkowego kodu: spłata częściowa („rata 3 z 6 · wpłacono 50 z 200 zł”), nadpłata (przechodzi na następne raty), zwykłe „Oddał mi 500” wpisane ręcznie (liczy się tak samo jak przycisk), usunięcie spłaty (stan wraca).

**„Rata wpłacona”** dodaje zwykły wpis spłaty na kwotę `rata − partial` z **identyfikatorem wyliczonym**: `dr-<planId>-<next>`. Dwa telefony, które stukną naraz przy tym samym stanie, zapisują ten sam klucz mapy — powstaje jeden wpis, bez heurystyki `doubleSettle`. Gdy klucz jest zajęty (spłata raty k istnieje, ale wcześniejszą usunięto, więc `next` znów wynosi k) — identyfikator losowy; ten rzadki przypadek nie ma ochrony przed dublem i to wystarczy. Długość: `dr-` + 38 + `-` + 2 = 44 znaki, limit 64. Przycisk jest nieaktywny do zakończenia zapisu (podwójne stuknięcie na jednym telefonie to następna rata, nie dubel).

**Notatka.** Przy tworzeniu planu: jedna notatka z etykietą `długi`, termin `rateDue(1)` o 9:00, `reminderRepeat: "monthly"`, **jawnie** `reminderDay: plan.day` (inaczej dzień serii wziąłby się z pierwszego terminu: plan na 31. zaczęty w lutym trzymałby się 28.), `reminderRepeatUntil: endOfDay(rateDue(count))`. Kotwicę godziny zakłada `addNote` (poprawka Z-8).

`syncPlanNote(plan, state, note, now)` zwraca łatkę albo `null`:

- działa tylko, gdy notatka istnieje, nie jest w koszu i `ruleOf(note).kind === "monthly"`; inaczej `null` (starszy telefon mógł podmienić termin na jednorazowy — `DebtsView.tsx:637`);
- `finished` → `{ reminder: null }`;
- dzień bieżącego wystąpienia (`reminderBase ?? reminder`) < `rateDue(next)` → termin `rateDue(next)` o godzinie serii, `reminderDay: plan.day`, `reminderBase: undefined`;
- w pozostałych przypadkach `null` (nigdy wstecz).

Wołana po każdej zmianie wpisów osoby, która ma plan (dodanie, edycja, usunięcie spłaty), w tej samej transakcji co zmiana. Rata zapłacona przed terminem przesuwa więc przypomnienie na następny miesiąc.

**„Gotowe” na notatce planu** nie dopisuje spłaty. Seria przechodzi dalej jak dziś, a dymek pyta „Rata wpłacona?” (zamiast „Oznaczyć jako oddane?”); rozpoznanie: wpis z `dueNoteId === noteId` ma plan. Zaległość nie zależy od notatki — wynika z `overdue` i tak trafia na Dziś (L2.4).

**Strefa i zmiana czasu.** Terminy rat to dni, więc strefa ich nie rusza. `reminderRepeatUntil` to koniec dnia w strefie zapisu; ostatnie wystąpienie o 9:00 wypadłoby po nim dopiero przy przesunięciu o 15 godzin na zachód — pomijalne. Godzinę serii trzyma `reminderTime`.

**Brzegi:** usunięcie pożyczki → plan usuwany w tej samej transakcji (§1.4, zasada 2), notatka jak dziś (pytanie przy `dueNoteId`). Zmiana nazwy albo łączenie osób → plan wisi na `entryId`, zaliczenie liczy się po nowej osobie; po łączeniu dwóch osób stan rat może się zmienić (spłaty jednej pokrywają dług drugiej) — to poprawne i zgodne z saldem. Zmiana kwoty pożyczki → raty przeliczone; jeśli `paid` przekracza nową kwotę, plan jest `finished`.

### 2.3 Grupa „Zapłaciłem za…” (L3.1) — tylko przy DL-2 = tak

**Dane.** Mapa `debtGroups`, klucz `g-<uuid>`: `{ id, note, total, at, created, members: Array<{ entryId; person; amount }> }`. Rekord zapisywany raz, potem tylko skracany przy „Cofnij”. `members` to migawka z chwili utworzenia — służy do sprawdzenia, czy wpis się zmienił.

**Podział** — `splitShares(total, people, withMe)`:

- równy: `n` = liczba osób (+1, gdy `withMe`); `base = floor(total / n)`; każda osoba `base`, **pierwsza osoba z listy** `base + reszta`; mój udział to `base` i nie jest wpisem. Niezmiennik: suma wpisów + mój udział = `total`.
- ręczny: każda kwota > 0, suma ≤ `total`; różnica to mój udział. Suma > `total` — formularz odrzuca.
- `base = 0` — odrzuca.

**Zapis:** wszystkie wpisy „Pożyczyłem” i rekord grupy w jednej transakcji; przed nią sprawdzenie limitu (`entries.size + n ≤ DEBT_MAX_ENTRIES`). Albo wszystko, albo nic. Wymaga nowej funkcji `addMany` w `yDebts.ts` (dziś `add` to jedna transakcja na wpis).

**„Cofnij” i „Usuń grupę”** — jedna funkcja `removeGroup(groupId)`, zwraca `{ removed: string[]; kept: Array<{ person; reason: "changed" | "activity" }> }`. Wpis członka jest usuwany tylko, gdy:

- istnieje i jego `person` (klucz), `kind`, `amount`, `at` równają się migawce — inaczej `changed`;
- osoba nie ma wpisu z `created` późniejszym niż `created` grupy — inaczej `activity` (po wydatku była spłata albo nowa pożyczka; usunięcie udziału odwróciłoby saldo).

Dymek mówi wprost: „Usunięto 2 z 4. Ania, Marek — zostają (zmienione po dodaniu).” Rekord grupy znika, gdy nie został żaden członek; inaczej zostaje skrócony.

**Dwa telefony:** A cofa grupę, B w tym czasie zmienia udział. A nie widzi jeszcze zmiany i usuwa wpis; po scaleniu wygrywa usunięcie albo zmiana, zależnie od identyfikatorów klientów Yjs — wynik jest ten sam na obu telefonach, ale nie do przewidzenia. Przyjęte: okno to kilka sekund dymka.

### 2.4 Odhaczenie odżywki ↔ „Gotowe” (C1.4)

**Stan dziś.** `takeSupplement` (`CwiczeniaView.tsx:59`) siedzi w widoku, robi dwie osobne transakcje i działa w jedną stronę (odhaczenie → notatka). „Gotowe” na przypomnieniu nie odhacza odżywki.

**Funkcje** w `src/lib/supplements/takeFlow.ts` (bez React; zależności przez parametr, żeby test nie potrzebował widoku):

```ts
interface TakeDeps { getNote(id: string): Note | undefined; updateNote(id: string, patch: Partial<ReminderFields>): void; transact(fn: () => void): void; now(): number }
/** Odhaczenie z listy. Zwraca cofnięcie tego, co faktycznie zmieniła. */
export function setTaken(deps: TakeDeps, s: Supplement, day: string, on: boolean): { changed: boolean; undo(): void };
/** „Gotowe” na przypomnieniu; `occurrence` — termin wystąpienia sprzed łatki (`reminderBase ?? reminder`). */
export function takenFromReminder(deps: TakeDeps, noteId: string, occurrence: number): { changed: boolean; undo(): void };
```

**`setTaken(on = true)`**, w jednej `transact`:

1. klucz `day|id` — zapis tylko, gdy go nie ma (`changed`);
2. skutek: gdy `day` to dziś, `s.reminderNoteId` wskazuje istniejącą notatkę poza koszem z regułą `daily` i jej bieżące wystąpienie wypada nie później niż koniec dzisiejszego dnia → `doneReminderUpdate(note, now).patch`. Warunek po zapisie przestaje być prawdziwy (termin jest jutro), więc drugie wywołanie — z tego samego albo z drugiego telefonu po synchronizacji — nic nie robi. Dwa telefony naraz liczą tę samą wartość docelową z tego samego stanu.

**`setTaken(on = false)`** usuwa klucz i nie rusza notatki (zasada 4).

**`takenFromReminder`:** szuka odżywki po `reminderNoteId` (brak → `changed: false`); dzień = dzień `occurrence`; zapisuje klucz tylko, gdy to dziś albo wczoraj (powiadomienie z 23:58 stuknięte o 0:03) i klucza nie ma. Starszego wystąpienia nie odhacza — nie wiadomo, czy odżywka była wzięta. Notatki nie rusza: łatkę zapisał już ten, kto obsłużył „Gotowe”.

**Pętla nie powstaje**, bo żadna z dwóch funkcji nie woła drugiej, a każdy krok ma warunek, który po wykonaniu jest fałszywy.

**`undo`:** `setTaken` — usuwa klucz, jeśli go dodała, i przywraca pola terminu, jeśli je zmieniła (`reminderFields` sprzed łatki). `takenFromReminder` — usuwa klucz, jeśli go dodała. Istniejące „Cofnij” przy „Gotowe” woła oba cofnięcia.

**Notatka prywatna:** pola terminu są jawną projekcją (T 1.5), więc łatka działa bez odblokowania skarbca. Notatka, której nie ma: odhaczenie zapisane, skutek pominięty, wiszące `reminderNoteId` zostaje.

**Wspólny punkt „po Gotowe”.** Dziś trzy miejsca obsługują „Gotowe” osobno: `ReminderQuickActions.tsx:62`, `useReminderNotifications.ts:77` (i akcja odłożona z adresu, wiersz 95), ujście natywne (`reminders/nativeSink.ts`). Nowy moduł `src/lib/reminderDoneHooks.ts`:

```ts
/** Po zapisaniu łatki „Gotowe”. Rozdziela po etykiecie i ładuje dział leniwie; zwraca cofnięcie albo nic. */
export async function afterReminderDone(note: Note, occurrence: number, source: "tile" | "notification"): Promise<(() => void) | void>;
```

- etykieta `długi` (albo stary tytuł — przenieść tu `isDebtNote`) → `offerSettleFromNote`, a dla wpisu z planem pytanie o ratę;
- etykieta `EXERCISE_LABEL` → `takenFromReminder`;
- reszta — nic.

Wszystkie trzy miejsca wołają tę jedną funkcję. Zamyka R-19. Import leniwy zostaje, więc paczka startowa nie rośnie.

## 3. Czego ta specyfikacja nie rozstrzyga

- Czy `updateNote` z `useNotes` jest synchroniczny i czy da się go objąć `yjsStore.doc.transact` razem z zapisem odhaczenia — do sprawdzenia przy Z-17.7. Jeśli nie: dwie transakcje w kolejności „prawda, potem skutek”; przerwanie między nimi zostawia odhaczenie bez przesuniętego terminu, co naprawia następne odhaczenie albo „Gotowe”.
- Rozmycie miniatury i transport zdjęcia dowodu (L4.3) — po Z-6.3, przegląd w sesji G+. Tu tylko miejsce zapisu: `debtProofs[entryId] = { hash, created }`, a lista czytelników obrazów (Z-6.3) czyta tę mapę — także rekordy-sieroty, dopóki nie zostaną sprzątnięte.
- Waluta (L5.1) — tylko po DL-3 = tak.

## 4. Zlecenia

- ✅ **2026-11-18 zrobione** (pozycje 1–5; faktura niezmienna → stan KSeF w mapie bocznej). **Z-17.3 (Opus, S–M)** — `extraFields.ts` (`pickExtra`, `toStored`) z testami limitów; `cleanDebt` z `extra` i `v`; wszystkie zapisy w `yDebts.ts` przez `toStored`; test strażnik dróg z §1.1; `SCHEMA_VERSION = 3`; poprawka R-18 (`restoreDebts` przywraca tylko `person`). Potem pozycje 2–5 z §1.6, każda z testem „nieznane pole przeżywa edycję”. Przed E2.1 (KSeF) sprawdzić pozycję 5.
- **Z-17.4 (Opus, M)** ✅ `42f7502a` 2026-11-18 — L2.1 według §2.2: `src/lib/debts/plans.ts` (`rateDue`, `rateAmounts`, `allocate`, `planState`, `syncPlanNote`), mapa `debtPlans` z `cleanPlan`, sprzątaniem sierot i polem w kopii; identyfikator `dr-…`. Testy: dzień 29/30/31 przez 12 miesięcy zgodny z `getNextReminderTime`; suma rat; niezmiennik zaliczenia (własność, `fast-check`); ten sam klucz z dwóch dokumentów daje jeden wpis; `syncPlanNote` nie cofa terminu i nie rusza notatki jednorazowej. L3.1 według §2.3 — osobny PR, po DL-2.
- **Z-17.5 (Sonnet, S)** ✅ `2a2cf5d0` 2026-11-18 — L2.4: zaległe na Dziś z `planState().overdue` i z terminów jednorazowych; najpierw sprawdzić, co pokazuje notatka z etykietą `długi`, żeby nie było dwóch wierszy na jeden dług.
- ✅ **2026-11-18 zrobione** (mapa `debtProofs`, opis w `opis.md`). **Z-17.6 (Opus, M)** — L4.3 po Z-6.3: mapa `debtProofs`, czytelnik w liście odwołań do obrazów, test „każdy zapis ma czytelnika” rozszerzony o tę mapę; `security-reviewer`.
- ✅ **2026-11-18 zrobione** (`updateNote` synchroniczny — jedna transakcja). **Z-17.7 (Opus, M)** — C1.4 według §2.4: `takeFlow.ts`, `reminderDoneHooks.ts`, podpięcie w trzech miejscach, usunięcie `takeSupplement` z widoku. Testy: dwa dokumenty Yjs odhaczające naraz dają jeden klucz i ten sam termin; drugie wywołanie nic nie zmienia; brak notatki, kosz, notatka prywatna, reguła inna niż `daily`; „Gotowe” z wczorajszego wystąpienia po północy; `undo` cofa tylko własne zmiany.
- **Sonnet, przy okazji Z-17.3:** dopisać w `opis.md` (dział Długi, „Ograniczenia”) regułę z §1.4 jako obowiązującą dla nowych pól.

# Kod synchronizacji: dłuższy kod, koniec pokoi v2, wymiana kodu

Specyfikacja do punktów S2.2, S2.6 i S2.1 z `plan-security-2026-11-15.md` (sesja A z `plan-uzycia-fable-2026-11-17.md`). Data: 2026-11-17. Kodu jeszcze nie ma — to opis, według którego powstaną zlecenia Z-15.1–Z-15.4 i sesja D.

Decyzje właściciela, na które dokument czeka, mają przyjęte zalecenia domyślne i są oznaczone **(do potwierdzenia)**:

| Decyzja | Przyjęte | Gdzie w dokumencie |
|---|---|---|
| D-F1 — stary pokój usuwać od razu czy po 7 dniach | po 7 dniach, z przyciskiem „Usuń teraz” | §3.4 krok 5 |
| D-F2 — po oknie v2 nowy kod wymuszać czy proponować | proponować | §2.3 |
| D-W1 (nowa) — domyślnie długi kod przy nowym parowaniu | tak; krótki tylko po wybraniu „Kod do przepisania ręcznie” | §1.3 |

## 0. Stan dzisiejszy (sprawdzone w kodzie)

- Kod: 12 znaków z alfabetu 31 znaków (`CODE_ALPHABET`), około 59,4 bitu. `generateCode`, `normalizeCode`, `codeFromPaste`, `joinWithCode`, `readPrefs` w `src/lib/yjsSync.ts` mają długość 12 wpisaną na sztywno: `codeFromPaste` obcina do 12 znaków, `joinWithCode` odrzuca wszystko poza 12, `readPrefs` usuwa zapisany kod krótszy niż 12.
- Z kodu powstają: nazwy pokoi WebRTC (`roomNameV3For` — PBKDF2 200 000; `roomNameV2For` — jeden SHA-256; `roomNameFor` — FNV), hasło ruchu WebRTC (sam kod), pokoje obrazów (`<pokój>-img2`), klucze przekaźnika (`deriveRelayKeys`: identyfikator pokoju, token, klucz danych, klucz identyfikatorów blobów).
- Pokój v2 jest dołączany do `v2Until` (30 dni od aktualizacji albo od `joinWithCode`). Pokój najstarszy (FNV) tylko po włączeniu w ustawieniach; wyłącza się po 30 dniach ciszy (`legacyRoomIdle.ts`), bez daty końca.
- `joinWithCode` ustawia okno v2 zawsze — także gdy grupa powstała na obecnej wersji i pokoju v2 nigdy nie miała. Szybki skrót kodu trafia wtedy do serwerów sygnalizacyjnych bez potrzeby.
- Zmiana `kaczy.sync.v1` w jednej karcie nie dociera do pozostałych: `yjsSync.ts` nie słucha zdarzenia `storage`. Druga karta trzyma połączenia ze starym kodem do przeładowania.
- Przekaźnik: `DELETE /rooms/:id` usuwa pokój z blobami; pokój zakłada pierwszy zapis; epoka pokoju (Z-5.5) sprawia, że urządzenie po `404` albo `412` robi reset i wysyła pełny stan. `RelayProvider.start` najpierw pobiera, potem wysyła; **po resecie wywołanym przez `412` przy wysyłce w kolejce stoi sama wysyłka, bez pobrania przed nią**.
- Rejestru urządzeń w dokumencie (D4.1 z planu migracji) nie ma. Lista urządzeń to `syncSeen` (nazwa → czas, tylko lokalnie) i bieżące awareness.

## 1. S2.2 — kod 128-bitowy

### 1.1 Format

- **Kod długi: 28 znaków** z tego samego alfabetu. 26 znaków losowych (26 × log₂31 ≈ 128,8 bitu) i 2 znaki kontrolne. Pokazywany w siedmiu grupach po 4 (`formatCode` już tak dzieli).
- Znaki kontrolne, liczone synchronicznie (pole wpisywania sprawdza je bez `crypto.subtle`). Niech `a[i]` to pozycja znaku `i` (od 0) w `CODE_ALPHABET`:
  - `k1 = Σ (i+1) · a[i] mod 31`, `k2 = Σ (i+1)² · a[i] mod 31`, dla `i = 0…25`;
  - znak 27 to `CODE_ALPHABET[k1]`, znak 28 to `CODE_ALPHABET[k2]`.
  - 31 jest liczbą pierwszą, a wagi `1…26` są różne i niezerowe, więc `k1` wykrywa każdą pojedynczą pomyłkę i każdą zamianę dwóch znaków miejscami; `k2` obniża szansę przepuszczenia dwóch pomyłek do około 1/961.
  - Wektor testowy (policzony ręcznie — test ma go potwierdzić): `ABCDEFGHJKMNPQRSTUVWXYZ234` → `k1 = 22` (`Z`), `k2 = 6` (`G`), kod `ABCDEFGHJKMNPQRSTUVWXYZ234ZG`.
- **Kod krótki: 12 znaków**, bez zmian, bez znaków kontrolnych.
- Rozpoznanie po długości po `normalizeCode` i odfiltrowaniu znaków spoza alfabetu: **dokładnie 12 → krótki; dokładnie 28 z poprawnymi znakami kontrolnymi → długi; wszystko inne → błąd.** Żadnego obcinania: dziś wklejenie 25 znaków dałoby po cichu kod z pierwszych 12 i pustą, cudzą grupę.

### 1.2 Wyprowadzanie — bez zmian

Wejściem wszystkich funkcji jest **cały napis kodu** (dla długiego 28 znaków, razem z kontrolnymi): `roomNameV3For(code)`, `providerOptions(code).password`, `deriveRelayKeys(code)`. Stałe, sole i liczba iteracji zostają. Skutki:

- kod 12-znakowy daje te same pokoje i klucze co dziś — test zgodności na zapisanych wektorach (nazwa v3, `roomId`, token dla ustalonego kodu, policzone przed zmianą);
- kod długi **nigdy nie dołącza do pokoju v2 ani najstarszego**: żadna wersja, która zna tylko te pokoje, nie przyjmie 28 znaków. `roomNamesFor` dla kodu długiego zwraca sam pokój v3, niezależnie od `v2Until` i `legacyRoom`.

### 1.3 Zachowanie

| Miejsce | Zmiana |
|---|---|
| `generateCode(kind: "long" \| "short" = "long")` | długi domyślnie; próbkowanie z odrzucaniem jak dziś |
| nowa `parseCode(raw): { code, kind } \| { error: "length" \| "checksum" \| "chars" }` | jedyne miejsce rozpoznawania; `joinWithCode`, `codeFromPaste`, `readPrefs`, `pairCodeFromLocation`, skan QR i `settingsDeepLink` korzystają z niej |
| `codeFromPaste` | zwraca oczyszczony napis bez obcinania do 12; górna granica 28 |
| `readPrefs` | zapisany kod, który nie przechodzi `parseCode`, jest usuwany jak dziś za krótki (`shortCodeDropped`) |
| `startPairing(kind)` | „Sparuj urządzenia” tworzy kod długi; pod spodem „Kod do przepisania ręcznie” tworzy krótki z ostrzeżeniem |
| pole wpisywania kodu | 12 kratek jak dziś; wklejenie 28 znaków albo linku przełącza pole na długi kod; błąd znaków kontrolnych: „Sprawdź kod — jeden ze znaków się nie zgadza” |
| link i QR | `#pair=<kod>` bez zmian; dla grupy, która nie ma pokoju v2, dochodzi `&v=3` (patrz §2.2) |

Tekst ostrzeżenia przy kodzie krótkim: „Krótki kod łatwiej przepisać, ale słabiej chroni przed zgadywaniem przez operatora serwera pośredniczącego. Jeśli możesz, zeskanuj kod QR.”

### 1.4 Ograniczenia

- Urządzenie ze starszą wersją aplikacji nie dołączy po kodzie długim: link i skan odrzuci (zła długość), a **wklejenie w pole obetnie kod do 12 znaków i dołączy do pustej grupy bez komunikatu** — tego nie da się naprawić w wydanej wersji. Przy kodzie QR dopisać: „Oba urządzenia muszą mieć aktualną wersję aplikacji.” Wyciek przy takiej pomyłce jest pomijalny: serwer sygnalizacyjny widzi wolny skrót pierwszych 12 z 28 znaków, pozostałe 16 to nadal około 79 bitów.
- Istniejące grupy zostają przy kodzie krótkim, dopóki nie zrobią wymiany kodu (§3). Sama zmiana formatu nikogo nie przenosi.
- Kod długi nie zmienia tego, że znający kod ma pełny dostęp — zamyka tylko zgadywanie (luka 6).

## 2. S2.6 — koniec pokoi v2 i najstarszego

### 2.1 Co okno v2 naprawdę chroni

Nazwa pokoju v2 to jeden SHA-256 kodu i szła do serwerów sygnalizacyjnych przy każdym połączeniu. Operator, który zapisał ją choć raz, może zgadywać kod 12-znakowy bez wolnego KDF, także po zamknięciu okna. **Wcześniejsze zamknięcie okna nie cofa wycieku** — ogranicza tylko liczbę serwerów, które nazwę zobaczą. Dlatego nie budujemy „wcześniejszego końca po dowodzie, że wszyscy są w v3”: koszt (śledzenie obecności w dwóch pokojach) nie kupuje bezpieczeństwa. Naprawą jest nowy kod (§2.3), a warunek poniżej pilnuje czego innego: żeby koniec okna nie rozdzielił grupy po cichu.

### 2.2 Kiedy urządzenie dołącza do v2

`roomNamesFor(code)` dołącza pokój v2 wtedy i tylko wtedy, gdy:

1. kod jest krótki (12 znaków), **oraz**
2. `v2Until` jest liczbą i `teraz < v2Until`.

Zmiany względem dziś:

- **Dołączenie po linku z `v=3`** (grupa założona przez `startPairing` na wersji z pokojem v3, czyli `v2Until === null` u zapraszającego): `joinWithCode` ustawia `v2Until: null` zamiast 30 dni. Link bez `v=3` i kod wpisany ręcznie — jak dziś, 30 dni.
- **Przedłużenie zamiast cichego rozdzielenia.** Urządzenie zapisuje lokalnie `v2Only: { [nazwa]: czas }` — urządzenia widziane w pokoju v2, których po 60 s od połączenia nie ma w pokoju v3 (zaktualizowane urządzenie jest w obu, więc obecność tylko w v2 oznacza starą wersję). Gdy `v2Until` mija:
  - nie było takiego urządzenia w ostatnich 14 dniach → koniec okna, jak dziś;
  - było → `v2Until` przesuwa się o 30 dni, najwyżej do **90 dni od początku okna** (nowe pole `v2Start`; brak pola = `v2Until − 30 dni`). Po 90 dniach koniec bez wyjątków.
- Przez cały czas, gdy w `v2Only` jest wpis młodszy niż 14 dni, ustawienia synchronizacji pokazują: „«Tablet» ma starą wersję aplikacji. Zaktualizuj ją do 14.02 — potem przestanie się synchronizować z tym urządzeniem.” Po końcu okna wpis zostaje jako: „«Tablet» nie synchronizuje się od 14.02 (stara wersja). Zaktualizuj aplikację na tym urządzeniu.” — do ręcznego zamknięcia albo do chwili, gdy urządzenie o tej nazwie pojawi się w v3.
- `v2Only` ma najwyżej 20 wpisów, nazwy czyszczone przez `cleanDeviceName`; klucz lokalny `kaczy.sync.v2only.v1`, poza kopią.

Znane ograniczenie: kluczem jest nazwa urządzenia (jak w `syncSeen`), więc dwa urządzenia o tej samej nazwie się zlewają. Rejestr urządzeń (D4.1) to poprawi; nie jest warunkiem.

Uwaga do opisu: przekaźnik nie zależy od nazw pokoi WebRTC. Grupa z ustawionym przekaźnikiem po końcu okna v2 nadal wymienia dane ze starym urządzeniem, o ile tamta wersja zna przekaźnik — rozdzielenie dotyczy tylko drogi bezpośredniej.

### 2.3 Propozycja nowego kodu (D-F2: proponować — do potwierdzenia)

Nowe pola w `kaczy.sync.v1`: `v2Exposed: boolean` (ustawiane, gdy urządzenie kiedykolwiek dołączyło do pokoju v2 z obecnym kodem), `legacyExposed: boolean` (to samo dla pokoju najstarszego), `newCodeHint: "open" | "dismissed"`. Zmiana kodu zeruje wszystkie trzy.

Propozycja pojawia się, gdy kod jest krótki, okno v2 się skończyło i `v2Exposed || legacyExposed`:

- karta w Ustawienia → Synchronizacja, stała, dopóki kod się nie zmieni: **„Zalecamy nowy kod synchronizacji.”** „Ten kod był używany ze starszą wersją aplikacji, która słabiej ukrywała go przed serwerem pośredniczącym. Nowy, dłuższy kod zamyka tę lukę. Po zmianie trzeba będzie ponownie sparować pozostałe urządzenia.” Przyciski: „Zmień kod” (uruchamia §3), „Nie teraz”.
- jednorazowy baner na ekranie Dziś z tym samym pierwszym zdaniem i odnośnikiem do ustawień; „Nie teraz” chowa baner na stałe (`newCodeHint: "dismissed"`), karta w ustawieniach zostaje.
- dla `legacyExposed` drugie zdanie brzmi mocniej: „…z której operator serwera pośredniczącego mógł odczytać kod.” (FNV da się odwrócić).

Nic nie jest wymuszane: synchronizacja działa dalej na starym kodzie.

### 2.4 Data końca pokoju najstarszego

Do reguły 30 dni ciszy dochodzi twardy koniec: **90 dni od włączenia** (`LegacyIdleState.since`), niezależnie od tego, czy stare urządzenie się pojawia. Nowa `legacyEndsAt(state): number` = wcześniejsza z dat „`(seenAt ?? since)` + 30 dni” i „`since` + 90 dni”; `legacyIdleExpired` korzysta z niej. Ustawienia pokazują: „Zgodność wyłączy się 14.02 (wcześniej, jeśli stare urządzenie nie pojawi się przez 30 dni).” Ponowne włączenie przełącznika startuje licznik od nowa — to świadoma decyzja użytkownika.

## 3. S2.1 — wymiana kodu z wyrzuceniem urządzenia

### 3.1 Cel i granice

Po wymianie urządzenie znające tylko stary kod nie dostaje **nowych** zmian. Wymiana nie cofa tego, co już pobrało, i nie odbiera mu jego kopii danych. Urządzenia grupy, które mają zostać, trzeba sparować ponownie nowym kodem — nowy kod nie może iść starym kanałem, bo czyta go też urządzenie wyrzucane.

Role w opisie: **A** — urządzenie, które zmienia kod; **B** — urządzenie grupy online; **C** — urządzenie grupy offline w chwili wymiany; **X** — urządzenie wyrzucane (zna stary kod).

### 3.2 Znacznik „kod zmieniony”

- Mapa Yjs `syncControl`, klucz `rekey:<id>`, wartość `{ v: 1, tag: string, at: number }`. `id` — 16 losowych bajtów szesnastkowo.
- `tag` wskazuje, **którego kodu** znacznik dotyczy: pierwsze 16 bajtów SHA-256 z napisu `kaczy-rekey:<nazwa pokoju v3 starego kodu>`, szesnastkowo. Nazwa v3 pochodzi z PBKDF2, więc z samego znacznika nie da się szybko zgadywać kodu. Nowego kodu w znaczniku nie ma.
- Znacznik żyje w głównym dokumencie i przechodzi do nowego pokoju razem z resztą danych. Nie szkodzi: urządzenie porównuje `tag` z tagiem **swojego obecnego kodu**. Zgodny → „mój kod został wycofany”. Niezgodny → ignoruje.
- **Zapis znacznika nie może zależeć od wcześniejszych operacji A.** Aktualizacja Yjs od klienta o zegarze `n` czeka, aż odbiorca będzie miał jego operacje `0…n−1`; urządzenie C z nieaktualnym stanem trzymałoby znacznik jako strukturę oczekującą i nigdy go nie zobaczyło. Dlatego znacznik powstaje w **osobnym, pustym `Y.Doc`** (świeży identyfikator klienta, zegar 0): `tmp.getMap("syncControl").set(…)` → `Y.encodeStateAsUpdate(tmp)` → ta aktualizacja jest nakładana na główny dokument i wysyłana. Ustawienie klucza w mapie głównej nie ma poprzedników, więc aktualizacja wchodzi na dowolny stan.
- Znacznik jest **niezaufany**: każdy, kto zna kod, może go wpisać. Jedyny skutek to wstrzymanie synchronizacji i prośba o ponowne sparowanie. Odbiorca czyści wartość (`v === 1`, `tag` — 32 znaki szesnastkowe, `at` — liczba; czyta najwyżej 20 wpisów) i ma wyjście: „Synchronizuj dalej na starym kodzie” (lokalna lista `ignoredRekey: id[]`).
- `syncControl` nie wchodzi do kopii JSON ani do eksportu; import jej nie tworzy. Wpisy starsze niż 180 dni usuwa pierwsze urządzenie, które je zobaczy (jak rejestr urządzeń w D4.1).

### 3.3 Zachowanie urządzenia, które widzi znacznik

Dotyczy B, C i innych kart A. Sprawdzenie następuje w `connect(code)` po wyliczeniu nazw pokoi (tag liczy się z nazwy v3, która jest w pamięci podręcznej) oraz przy każdej zmianie mapy `syncControl`, gdy połączenie działa.

1. Karta czyta `kaczy.sync.v1` na nowo. Zapisany kod różni się od tego, z którym jest połączona → łączy się zapisanym kodem (to inna karta A po przełączeniu — zob. I-5). Koniec.
2. Na tym urządzeniu jest zapis wymiany z tym samym `id` (§3.4) → to A; steruje nim maszyna stanów. Koniec.
3. Znacznik jest na liście `ignoredRekey` → nic.
4. W pozostałych przypadkach: **pełne zatrzymanie** — rozłączenie WebRTC, obrazów i przekaźnika (jak `pauseSync`, ale `enabled` zostaje `true`), stan `status: "rekeyed"`. Kolejka `pending` przekaźnika zostaje nietknięta w IndexedDB; nic nie jest wysyłane. Dane lokalne i praca offline bez zmian.
5. Ekran w ustawieniach synchronizacji i baner: **„Kod synchronizacji został zmieniony na innym urządzeniu.”** „To urządzenie przestało wysyłać i odbierać zmiany. Twoje dane są bezpieczne na tym urządzeniu. Zeskanuj nowy kod z urządzenia, na którym go zmieniono — wszystkie zmiany połączą się same.” Przyciski: „Sparuj ponownie” (zwykłe dołączanie po kodzie), „Synchronizuj dalej na starym kodzie” (z potwierdzeniem: „Rób to tylko, jeśli nikt z Twojej grupy nie zmieniał kodu.”).
6. Po `joinWithCode(nowy)` tag obecnego kodu jest inny, więc znacznik przestaje dotyczyć urządzenia. Przekaźnik dla nowego pokoju zaczyna od zera (inny `roomId` → inne klucze `pending:`/`state:`) i wysyła pełny stan — **zmiany zrobione przez B i C po wymianie wchodzą wtedy przez zwykłe scalenie Yjs**. Stare wpisy `pending:<stary roomId>` i `state:<stary roomId>` są usuwane po udanym dołączeniu.

Zatrzymanie jest pełne, nie „tylko wysyłanie”: po wymianie w starym pokoju pisze już tylko X, więc odbieranie niczego nie daje.

### 3.4 Maszyna stanów na urządzeniu A

Zapis wymiany: `localStorage["kaczy.sync.rekey.v1"]`, poza kopią i raportem diagnostycznym (test z S1.5 obejmuje też ten klucz).

```ts
interface RekeyRecord {
  v: 1;
  id: string;                 // ten sam co w kluczu znacznika
  step: "prepared" | "seeded" | "marked" | "switched" | "done";
  oldCode: string | null;     // kasowany przy przejściu do "done"
  newCode: string;            // zawsze kod długi
  tag: string;                // tag starego kodu
  relay: string | null;       // adres przekaźnika z chwili startu; null = sama droga bezpośrednia
  startedAt: number;
  switchedAt?: number;
  markStarted?: boolean;      // znacznik mógł już wyjść z urządzenia — zapisywane PRZED jego nałożeniem
  markTries?: number;         // nieudane wysyłki znacznika; od 3 wolno pominąć
  retireAt?: number;          // switchedAt + 7 dni (D-F1)
  retireTries?: number;
  markerSkipped?: boolean;    // użytkownik pominął krok 3
  devices: { name: string; version?: string; done: boolean }[];  // do ponownego sparowania
  error?: { step: string; message: string; at: number };
}
```

Krok jest zapisywany **po** wykonaniu działania, a każde działanie jest powtarzalne — wznowienie zawsze powtarza działanie bieżącego kroku od początku.

**Wyjątek: ślad przed znacznikiem (ustalenie z sesji D).** Znacznik nałożony na główny dokument rozchodzi się natychmiast (WebRTC, karta prowadząca przekaźnik). Gdyby karta zginęła między nałożeniem a zapisem kroku `marked`, zapis mówiłby `seeded`, anulowanie byłoby dozwolone, a grupa stałaby zatrzymana znacznikiem, za którym nie idzie żadna zmiana kodu. Dlatego krok 3 **najpierw** zapisuje `markStarted: true`, dopiero potem nakłada znacznik; anulowanie jest dozwolone tylko w krokach `prepared` i `seeded` bez `markStarted` (`canCancelRekey`). Nieudany zapis śladu zatrzymuje krok przed nałożeniem.

| Krok | Działanie (prowadzące do następnego stanu) | Warunek przejścia | Wznowienie po zamknięciu karty | Anulowanie |
|---|---|---|---|---|
| — → `prepared` | Losuje `newCode` i `id`, liczy `tag`, zbiera `devices` (awareness + `syncSeen` z 90 dni, bez własnej nazwy; z rejestru D4.1, gdy będzie). Zapisuje zapis wymiany. Pokazuje ostrzeżenia z §3.7 i prosi o potwierdzenie. | zapis w `localStorage` udany | Ekran wraca do potwierdzenia. Nic jeszcze nie wyszło poza urządzenie. | Tak: usunięcie zapisu. |
| `prepared` → `seeded` | **Nowy pokój z pełnym stanem.** Z przekaźnikiem: wylicza klucze nowego kodu, wysyła pełny stan dokumentu do nowego pokoju tą samą drogą co zwykła synchronizacja (osobny `RelayProvider` z własnym magazynem `state:<nowy roomId>`), czeka na pustą kolejkę i potwierdzenie serwera, po czym **sprawdza**: pobiera nowy pokój od zera do pomocniczego `Y.Doc` i porównuje wektor stanu z wektorem zapamiętanym przed wysyłką (pobrany musi go zawierać). Bez przekaźnika: krok pusty. | potwierdzenie i zgodność wektorów | Powtarza całość; pokój już istnieje, więc dochodzą tylko brakujące wpisy. | Tak: usunięcie zapisu i `DELETE` nowego pokoju (bez gwarancji — nieudane zostawia pusty pokój do wygaśnięcia). |
| `seeded` → `marked` | **Znacznik w starym pokoju.** Tworzy aktualizację znacznika (§3.2), nakłada ją na główny dokument (rozchodzi się po WebRTC do urządzeń online i przez kartę prowadzącą przekaźnik) i **dodatkowo sama wysyła ją wprost** do starego pokoju przekaźnika (`POST …/updates`, szyfrowana starym kluczem) — nie czeka na kartę prowadzącą. | Z przekaźnikiem: odpowiedź `200` na wpis. Bez przekaźnika: 5 s po nałożeniu przy co najmniej jednym połączonym urządzeniu albo od razu, gdy nikogo nie ma. | Powtarza: znacznik o tym samym `id` jest ten sam (odtwarzany z zapisu: `id`, `tag`, `at = startedAt`), drugi wpis niczego nie zmienia. | **Nie.** Od tej chwili inne urządzenia mogły się zatrzymać; jedyny kierunek to naprzód. Gdy przekaźnik nie odpowiada: ponawianie; po 3 nieudanych próbach przycisk „Pomiń — urządzenia offline nie dostaną informacji” (`markerSkipped`). |
| `marked` → `switched` | **Przełączenie.** Jednym `writePrefs`: `code = newCode`, `v2Until = null`, `legacyRoom = false`, `v2Exposed = legacyExposed = false`; `clearLegacyIdle()`. Potem `connect(newCode)`. Ustawia `switchedAt`, `retireAt`. | zapis ustawień udany | Jeśli `prefs.code === newCode` — tylko dopisuje krok; inaczej powtarza zapis. | Nie. |
| `switched` → `done` | **Wycofanie starego pokoju**, gdy `teraz ≥ retireAt` albo użytkownik wybrał „Usuń teraz”. Z przekaźnikiem: `DELETE` starego pokoju (znikają wpisy i bloby), zaraz potem `POST` jednego wpisu — samej aktualizacji znacznika (**pokój-nagrobek**, nowa epoka). Następnie pobranie: jeśli w pokoju jest coś poza nagrobkiem (inne urządzenie zdążyło wysłać stan między `DELETE` a `POST`), powtórka; najwyżej 3 razy w jednym podejściu. Bez przekaźnika: krok pusty, wykonywany od razu. Na końcu kasuje `oldCode` i stare wpisy `pending:`/`state:` w IndexedDB. | nagrobek potwierdzony albo wyczerpane próby (30 dni od `retireAt` → `done` z `error`) | Powtarza przy każdym starcie aplikacji i przy powrocie sieci. `DELETE` na nieistniejącym pokoju (`404`) liczy się jak udane. | Nie dotyczy. |

Stan `done` zostaje jako lista „urządzenia do ponownego sparowania” (§3.6); zapis jest usuwany, gdy wszystkie pozycje są odhaczone albo użytkownik zamknie listę.

**Dlaczego ta kolejność.** Przerwanie przed `marked` nie zostawia śladu w grupie — nikt się nie zatrzymał. Gdyby znacznik szedł pierwszy, a telefon A zginął przed przełączeniem, cała grupa stałaby z prośbą o kod, którego nikt nie ma. Pełny stan w nowym pokoju przed znacznikiem gwarantuje, że B sparowane ponownie od razu ma skąd pobrać dane, nawet gdy A jest już offline.

### 3.5 Niezmienniki (do sprawdzenia testami Z-15.4)

- **I-1. Żadna zmiana nie ginie.** Zmiana zrobiona na B albo C po przełączeniu A zostaje w ich dokumencie i w kolejce; wchodzi do grupy po ponownym sparowaniu. Zmiana zrobiona na A między krokiem 2 a 4 jest w nowym pokoju, bo dostawca nowego pokoju działa do `connect(newCode)` albo pełny stan idzie przy pierwszym połączeniu z nowym kodem.
- **I-2. A po przełączeniu nie czyta ani nie pisze danych do starego pokoju.** Jedyne żądania do starego pokoju po kroku 4 to `DELETE`, wpis nagrobka i jedno pobranie kontrolne — żadne nie niesie danych użytkownika i żadne nie jest nakładane na dokument.
- **I-3. Stary pokój nie odradza się z pełnym stanem.** Wymaga dwóch zmian w `RelayProvider` (sesja D):
  - po każdym resecie epoki (`resetRoom`) w kolejce staje **najpierw pobranie, potem wysyłka** — dziś po `412` przy wysyłce idzie sama wysyłka;
  - zatrzymanie z §3.3 działa synchronicznie w obserwatorze mapy `syncControl` (wywoływanym w trakcie `applyUpdate`), a `flushTask` sprawdza flagę zatrzymania przed każdym żądaniem.
  Razem: urządzenie C, które wraca po wycofaniu pokoju, dostaje `404`/nową epokę → reset → pobiera nagrobek → zatrzymuje się, zanim cokolwiek wyśle.
- **I-4. Wymianę prowadzi jedna karta.** Blokada `withLockIfFree("notatnik-wymiana-kodu", …)` na czas każdego kroku; karta bez blokady pokazuje postęp z zapisu wymiany (zdarzenie `storage`) i nie ma przycisków działania. Rola przekaźnika (Z-7) jest od tego niezależna: krok 2 używa własnego dostawcy dla **nowego** pokoju (nikt go jeszcze nie prowadzi), krok 3 wysyła jeden wpis wprost.
- **I-5. Karty tego samego urządzenia idą za kodem z ustawień.** `yjsSync.ts` słucha zdarzenia `storage` dla `kaczy.sync.v1`: zmiana `code` albo `enabled` w innej karcie → `connect(nowy)` albo rozłączenie. To naprawia także dzisiejszy błąd przy „Opuść grupę” w drugiej karcie.
- **I-6. Start aplikacji najpierw kończy wymianę.** `initSync` czyta zapis wymiany przed `connect`: krok `marked` → dokańcza przełączenie i łączy się nowym kodem (inaczej A zobaczyłoby własny znacznik i się zatrzymało); `switched` → planuje krok 5.
- **I-7. Urządzenie nie wysyła niczego przed pierwszym pobraniem** po starcie i po resecie (start już tak działa; reset — I-3). Dzięki temu C, wracając w ciągu 7 dni, widzi znacznik, zanim wyśle zaległe zmiany do pokoju, który czyta już tylko X.

### 3.6 Droga bezpośrednia (WebRTC) i obrazy

- Do kroku 4 A jest w starych pokojach WebRTC jak zwykle; znacznik dociera do urządzeń online jako zwykła zmiana dokumentu. Potwierdzeń odbioru w `y-webrtc` nie ma — stąd 5 s i „najlepiej, jak się da”.
- `connect(newCode)` niszczy wszystkich dostawców starego kodu, także pokoje obrazów (`-img2`). **A nie zostaje w starym pokoju jako „latarnia” ze znacznikiem**: obecność tam oznaczałaby dalszą wymianę danych z X.
- Skutek dla grup bez przekaźnika: urządzenie C offline w chwili wymiany **nie dowie się o niej samo** — nie ma serwera, który przechowa znacznik. Zobaczy go tylko, gdy spotka online inne urządzenie, które znacznik ma i nie zostało jeszcze sparowane ponownie. Dlatego lista z kroku `done` jest dla takich grup jedyną ochroną i nie znika sama.
- Obrazy i załączniki: bloby na przekaźniku mają identyfikatory i szyfrowanie zależne od kodu, więc do nowego pokoju wchodzą od nowa zwykłym przebiegiem `RelayBlobs` po `connect(newCode)`. Krok 2 **nie czeka** na bloby: obraz, którego jeszcze nie ma w nowym pokoju, jest na A i dojdzie później albo drogą bezpośrednią. Znane ograniczenie: obraz, który istnieje wyłącznie w starym pokoju przekaźnika (A go nigdy nie pobrało), po wycofaniu pokoju jest dostępny tylko z urządzenia, które go ma.
- Lista do ponownego sparowania: pozycja odhacza się sama, gdy urządzenie o tej nazwie pojawi się w awareness nowego pokoju; ręcznie — zawsze. Przy samym przekaźniku (urządzenia nigdy online razem) nazw nie widać — zostaje odhaczanie ręczne, do czasu rejestru urządzeń (D4.1).

### 3.7 Co widzi użytkownik na A

Przed potwierdzeniem (krok `prepared`), jednym ekranem:

- „Po zmianie kodu każde urządzenie trzeba sparować ponownie. Urządzenie, którego nie sparujesz, przestanie dostawać nowe zmiany.”
- „Zmiana kodu nie usuwa danych, które tamto urządzenie już pobrało.”
- Lista urządzeń; przy tych z wersją aplikacji starszą niż wydanie ze znacznikiem albo o nieznanej wersji: „Stara wersja — nie pokaże prośby o ponowne sparowanie. Zaktualizuj ją przed zmianą kodu albo sparuj od razu po niej.”
- Bez przekaźnika: „Urządzenia, które są teraz wyłączone, nie dostaną informacji o zmianie. Pamiętaj, żeby je sparować.”

W trakcie: cztery kroki z postępem („Nowy pokój”, „Informacja dla urządzeń”, „Przełączenie”, „Sparuj urządzenia”), błąd kroku z przyciskiem „Spróbuj ponownie”. Po przełączeniu: nowy kod jako QR, lista do odhaczania, wiersz „Stary pokój zostanie usunięty 24.11” z przyciskiem „Usuń teraz”.

### 3.8 Czego wymiana nie załatwia

- X zachowuje kopię wszystkiego sprzed przełączenia i — przez 7 dni (D-F1) — może czytać stary pokój przekaźnika, w tym zaległe zmiany, które C wyśle tam przed zobaczeniem znacznika (I-7 to ogranicza, nie usuwa: wysyłka rusza po pierwszym pobraniu, a urządzenie na starej wersji znacznika nie rozumie). „Usuń teraz” skraca to do zera kosztem tego, że C zobaczy nagrobek zamiast pełnej historii — co dla C niczego nie zmienia. **Zalecenie przy potwierdzonym wycieku kodu: „Usuń teraz”.**
- X zna token starego pokoju, więc może usunąć nagrobek (`DELETE`) albo założyć stary pokój od nowa. Wtedy C nie zobaczy znacznika i będzie dalej pisać do pokoju, który czyta X. Serwer tego nie odróżni. Obroną jest lista urządzeń na A, nie protokół.
- Urządzenie na wersji sprzed znacznika pisze do starego pokoju bez ostrzeżenia, aż ktoś je sparuje.
- Pokój-nagrobek wygasa po 180 dniach bez zapisu jak każdy pokój; urządzenie wracające później założy stary pokój od nowa i zostanie w nim samo.
- Hasło skarbca się nie zmienia. Jeśli X znał kod, miał zaszyfrowany skarbiec i może łamać hasło offline — to osobna procedura („hasło wyciekło” w planie Skarbca, `docs/reagowanie.md` w S6.1).
- Powiadomienia (serwer push) nie zależą od kodu synchronizacji — bez zmian.

### 3.9 Zależności

- **Z-5.6** (wpis ponad limit rozmiaru przy pełnym stanie) musi być zrobione przed krokiem 2 — duży dokument inaczej nie wejdzie do nowego pokoju i wymiana stanie na pierwszym kroku.
- **S2.2** (kod długi) przed S2.1 — wymiana zawsze tworzy kod długi.
- **D4.1** (rejestr urządzeń) nie jest warunkiem; poprawia listę urządzeń i automatyczne odhaczanie.
- „Odłącz i usuń z przekaźnika” (`deleteRelayRoom`) ma dziś tę samą słabość co wycofanie pokoju bez nagrobka: inne połączone urządzenie odtwarza pokój pełnym stanem. Po wdrożeniu znacznika ta opcja powinna albo zostawiać nagrobek, albo mówić wprost, że pozostałe urządzenia odtworzą pokój. Osobna decyzja — poza zakresem.

## 4. Zlecenia

Kolejność: Z-15.1 → Z-15.2 → sesja D (Fable) → Z-15.3 i Z-15.4 równolegle.

### Z-15.1 (Opus, S) — kod długi (§1)

- `parseCode`, `generateCode(kind)`, znaki kontrolne; usunięcie obcinania w `codeFromPaste`; `joinWithCode`, `readPrefs`, `pairLink.ts`, `qrScan.ts`, `settingsDeepLink.ts`, `viewRoute.ts`, `useAppDialogs.ts`, `SyncSettings.tsx`, `SettingsDialog.tsx` przechodzą na `parseCode` (to wszystkie pliki używające dziś `CODE_LENGTH` albo `codeFromPaste`).
- `roomNamesFor`: kod długi → sam pokój v3.
- Interfejs: wybór „Kod do przepisania ręcznie” z ostrzeżeniem, pole przyjmujące 28 znaków po wklejeniu, komunikat o znakach kontrolnych.
- Testy (Vitest): wektor z §1.1; każda pojedyncza podmiana znaku i każda zamiana sąsiednich znaków odrzucona; długości 0–40 poza 12 i 28 odrzucone; **wektory zgodności** dla kodu 12-znakowego (nazwa v3, `roomId`, token) policzone na obecnym kodzie przed zmianą i wklejone jako stałe; kod długi nie daje pokoju v2 ani najstarszego mimo `v2Until` i `legacyRoom`.
- Poza zakresem: wymiana kodu, zmiana KDF.

### Z-15.2 (Opus, S) — koniec v2 i najstarszego (§2)

- `v=3` w linku i `joinWithCode`; `v2Start`, przedłużenie do 90 dni; `v2Only` z obserwacji dwóch dostawców; `v2Exposed`, `legacyExposed`, `newCodeHint`; `legacyEndsAt` z twardym końcem 90 dni; teksty z §2.2 i §2.4.
- Karta i baner propozycji (§2.3) powstają tu, ale przycisk „Zmień kod” jest nieaktywny albo ukryty, dopóki nie ma sesji D i Z-15.3 — nie proponować czegoś, czego nie da się zrobić.
- Testy: tabela przypadków `roomNamesFor` (kod krótki/długi × okno trwa/minęło × `legacyRoom`); przedłużenie raz, dwa razy, twardy koniec; link z `v=3` i bez; `legacyEndsAt` dla ciszy i dla aktywnego starego urządzenia.

### Sesja D (Fable) — trudny kod §3

**Stan 2026-11-17:** zrobione wszystko poza podpięciem w `yjsSync.ts` (czwarty punkt listy) — to czeka na Z-15.1 i Z-15.2, które zmieniają ten sam plik. Gotowe: `src/lib/sync/rekey.ts` (znacznik, zapis wymiany, sterownik `prepareRekey`/`runRekey`/`cancelRekey` z portami `RekeyPorts`), `src/lib/sync/rekeyRelay.ts` (`seedRekeyRoom`, `postRekeyMarker`, `retireRekeyRoom`, `dropRekeyRoom`), `RelayProvider.settle()`, `canSend`, pobranie przed wysyłką po resecie. Testy sprawdzające: `rekey.test.ts` (18) i blok „wymiana kodu” w `relayServer.integration.test.ts` (3); pełna lista Z-15.4 nadal dla Sonneta.

**Stan 2026-11-17 (później):** Z-15.1, Z-15.2 i podpięcie D2 zrobione przez Fable (niezacommitowane) — opis w `opis.md`, dział Synchronizacja. Po przeglądzie bezpieczeństwa dodano: bramkę dla blobów, zamkniętą bramkę do policzenia tagu, własny znacznik od `marked` zatrzymuje, zerowanie `legacyRoom` przy zmianie kodu, odczyt znaczników bez limitu wpisów (zamiast 20/200). Świadome ograniczenie: WebRTC startuje bez czekania na pierwsze pobranie z przekaźnika. Zostają Z-15.3 i Z-15.4.

**Podpięcie (sesja D2, po Z-15.1/Z-15.2) — zakres (zrobione):**
- Porty produkcyjne: `load`/`save` na `localStorage["kaczy.sync.rekey.v1"]` przez `parseRekeyRecord` (zapis ma rzucać przy błędzie), `newCode` = generator kodu długiego z Z-15.1, `tagFor` = `rekeyTag(await roomNameV3For(code))`, `seedRoom` = `seedRekeyRoom` z `idbRelayStore(<nowy roomId>)` (trzeba go wyeksportować z `relayRuntime.ts`), `forgetRoom` = usunięcie `pending:`/`state:` starego pokoju, `lock` = `withLockIfFree(REKEY_LOCK, …)`, `switchTo` = jeden `writePrefs` + `connect`.
- `relayRuntime.lead`: `canSend: () => !stoppingMarker(doc, tag, ignoredRekey, ownId)`; po zdjęciu blokady wołać `sync()`. Tag liczony raz przy `connect` (jest asynchroniczny), obserwator `syncControl` synchroniczny.
- `yjsSync.ts`: stan `rekeyed`, `ignoredRekey` w ustawieniach, zdarzenie `storage` (I-5), `initSync` woła `runRekey` przed `connect` (I-6), `pruneMarkers` raz na start.
- `runRekey` wołać: po potwierdzeniu, przy starcie, przy zdarzeniu `online`, z przycisków („Ponów”, „Pomiń”, „Usuń teraz”); wynik `wait: "retire"` nie wymaga zegara — wystarczy start aplikacji.

Pierwotny zakres:

- `src/lib/sync/rekey.ts`: czysta funkcja kroku (`RekeyRecord` + wynik działania → następny `RekeyRecord`) i sterownik z portami (ustawienia, przekaźnik, dokument, zegar, blokada).
- Znacznik: tworzenie w osobnym `Y.Doc`, odczyt z czyszczeniem, tag.
- `RelayProvider`: pobranie przed wysyłką po resecie, flaga zatrzymania sprawdzana w `flushTask` (I-3, I-7).
- `yjsSync.ts`: stan `rekeyed`, sprawdzenie w `connect`, obserwator `syncControl`, słuchanie `storage` (I-5), `initSync` (I-6).
- Nagrobek i pobranie kontrolne.

### Z-15.3 (Opus, M) — interfejs wymiany (§3.3, §3.7)

**Stan 2026-11-17:** zrobione (Fable) — `CodeChangePanel`, test `e2e/sync-rekey.spec.ts`; ekran i baner `rekeyed` z sesji D2.

- „Zmień kod” w ustawieniach synchronizacji: ekran potwierdzenia, postęp kroków z zapisu wymiany, błąd i ponowienie, „Pomiń”, QR nowego kodu, lista do odhaczania, „Usuń teraz”.
- Ekran i baner „Kod synchronizacji został zmieniony na innym urządzeniu” ze stanem `rekeyed`; „Synchronizuj dalej na starym kodzie” z potwierdzeniem.
- Druga karta: sam podgląd postępu.
- Przed kodem skill `frontend-design`; dostępność: postęp jako lista z `aria-current`, komunikaty kroków w obszarze `aria-live="polite"`.
- Włączenie przycisku z Z-15.2.

### Z-15.4 (Sonnet, M) — testy wymiany

**Stan 2026-11-17:** zrobione (Fable). Mapa: 1 — `rekey.test.ts` „przerwanie po każdym kroku”; 2, 9, 10 — `rekey.test.ts`; 3, 4a, 4b — `relayServer.integration.test.ts`; 5, 6 — `rekey.test.ts` i `yjsSync.test.ts`; 7, 8 — `rekey.test.ts` i `yjsSync.test.ts` (I-5, I-6); 11 — `fullBackup.test.ts`.

Vitest z atrapami portów i testy integracyjne z prawdziwym `relay-server` (wzór: `relayServer.integration.test.ts`):

1. Przerwanie po każdym kroku (`prepared`, `seeded`, `marked`, `switched`) i wznowienie — stan końcowy taki sam jak bez przerwania; znacznik nie dubluje się pod innym `id`.
2. Anulowanie przed `marked` nie zostawia znacznika ani zmiany kodu; po `marked` anulowanie niedostępne.
3. B online: po kroku 3 stan `rekeyed`, nic więcej nie wysyła; po `joinWithCode(nowy)` jego zmiany zrobione po wymianie są na A.
4. C offline z zaległymi zmianami wraca (a) przed wycofaniem pokoju, (b) po nim: w obu przypadkach kończy w `rekeyed`; w (b) stary pokój ma po jego wizycie **wyłącznie nagrobek** (I-3).
5. C ze stanem sprzed wielu zmian A widzi znacznik (aktualizacja bez poprzedników — §3.2).
6. Znacznik z innym tagiem jest ignorowany; znacznik o złym kształcie jest ignorowany; „Synchronizuj dalej” wznawia.
7. Dwie karty: druga nie wykonuje kroków; po przełączeniu łączy się nowym kodem (I-5).
8. Start aplikacji w kroku `marked` kończy przełączenie zamiast się zatrzymać (I-6).
9. Wyścig w kroku 5: urządzenie wysyła pełny stan między `DELETE` a wpisem nagrobka → powtórka zostawia sam nagrobek.
10. Bez przekaźnika: kroki 2 i 5 puste, wymiana dochodzi do `done`.
11. Zapis wymiany i `syncControl` nie trafiają do kopii JSON ani do raportu diagnostycznego.

# Plan: Skarbiec — wycofane klucze (1.2 cz. 2) i szyfrowane załączniki (3.3) (2026-11-15)

> **Status:** projekt przejrzany 2026-11-15 dwa razy (§0, drugie czytanie — §0.6) i poprawiony; realizacja: K0 cz. 1 (błąd C-1, z C-28 i pominiętymi w oknie resetu) zrobiona 2026-11-20; K0 cz. 3 (testy charakteryzujące P1 i P2, `src/lib/privateNotes.p1p2.test.ts`) zrobiona 2026-11-20; K0 cz. 4 (§0.5: blokada po własnej zmianie hasła — potwierdzony błąd, poprawiony flagą `ownMetaWrite` wokół `store.rekeyVault`; dosłany obcy szyfrogram oznaczany leniwie przy pierwszym `ensureDecrypted` — zamierzone; `src/lib/privateNotes.k04.test.ts`) zrobiona 2026-11-20; K0 cz. 2 (C-14: `parseContent` przenosi nieznane pola najwyższego poziomu, limit 64 KB JSON z wpisem w `logDiag`; zachowują je edycja, `migrateToV2`, `duplicate`, `rekeyInner`; `removeLock` je gubi, bo jawny model notatki nie ma na nie miejsca — zamierzone; `src/lib/privateNotes.k02.test.ts`) zrobiona 2026-11-20; reszta nie zaczęta. Wykonawca: Opus. K0 zatwierdzony; K1–K3, K5 i K6.1 zatwierdzone warunkowo; K4 i K6.2–K6.3 wymagają przeglądu diffu po wpisanych poprawkach. Poprzedni projekt 1.2 cz. 2 został odrzucony 2026-11-02; stan siedmiu wymagań z `plan-skarbiec-2026-10-25.md` — §0.2.
>
> Projekt powstał z czytania `vault.ts`, `vaultPin.ts` i `privateNotes.ts` z 2026-11-15. Założenia o kodzie są rozstrzygnięte w §0.4; to, czego nie potwierdzono, wymienia §0.5 — K0 zaczyna od tej listy.

## 0. Wynik przeglądu (2026-11-15, Fable + `security-reviewer`)

Przegląd przez czytanie kodu na `3cc066d6`; żadnego ustalenia nie potwierdzono uruchomieniem testu. Treść §3–§8 jest już poprawiona według tej sekcji. K0.1 jest tym samym wykonane; zostaje propozycja ADR-10.

### 0.1 Werdykt

| Etap | Werdykt | Warunek |
|---|---|---|
| K0 | zatwierdzony | Zaczyna się od testu i poprawki błędu C-1 (istniejący kod). |
| K1 | zatwierdzony warunkowo | C-9, C-10, C-13. |
| K2 | zatwierdzony warunkowo | C-3, C-5, C-8, C-12. |
| K3 + K5 | zatwierdzone warunkowo, **tylko razem** | K3 nie wychodzi przed K5; KR-4 rozstrzygnięte jak w C-2; C-4, C-6, C-7. |
| K4 | **odrzucony w brzmieniu sprzed przeglądu** | Reguła `epoch < bieżącej` i wypieranie według `epoch` uniemożliwiały P2 (C-3); brak ścieżki kodu awaryjnego (C-10). Po poprawkach wpisanych niżej — bez ponownego projektowania, ale z przeglądem diffu. |
| K6.1 | zatwierdzony warunkowo | Limit rozmiaru z C-15. |
| K6.2–K6.3 | **odrzucone do uzupełnienia** | C-11, C-14, C-15, C-16, C-17 — wpisane niżej; start dopiero po D1.1 i D4 z `plan-migracje-yjs-2026-11-15.md`. |

### 0.2 Siedem wymagań z `plan-skarbiec-2026-10-25.md`

| # | Wymaganie | Stan przed poprawkami | Po poprawkach |
|---|---|---|---|
| 1 | Osobny klucz mapy, bez zmiany odcisku, bez kasowania przez starsze wersje | spełnione | spełnione (wpisy pod osobnymi kluczami, C-12) |
| 2 | Łańcuch opakowany bieżącym DK; „wyciekłe stare hasło nic nie daje” | częściowo — stare hasło pozwalało podmienić notatkę | **nadal częściowo z założenia**: zachowany klucz zawsze daje to posiadaczowi starego hasła; dlatego wybór przy każdej zmianie hasła i oznaczanie odzyskanych notatek (C-2) |
| 3 | P2: `iter` w pinie, poprzedni pin, odzysk z lokalnego nagłówka hasłem lub kodem | nie | spełnione w projekcie (C-3, C-10) |
| 4 | Walidacja w czasie działania | częściowo | spełnione (C-5, C-13, C-19) |
| 5 | Przeszyfrowanie z CAS w `enqueue` | spełnione | + odcisk sesji i `touch = false` (C-7) |
| 6 | Dławienie, brak sekretów w logach, zerowanie | częściowo | spełnione w projekcie (C-6, C-12, C-21) |
| 7 | Opcja „hasło wyciekło” | formalnie | wybór obowiązkowy, K5 przed K3 (C-2) |

### 0.3 Ustalenia

**Krytyczne — błąd w istniejącym kodzie, niezależny od tego projektu**

- **C-1. Reset hasła kodem awaryjnym po świeżym otwarciu aplikacji traci wszystkie notatki prywatne w formacie v2.** `rekeyInner` odszyfrowuje z `sessionEpoch` (`privateNotes.ts:642`), a ta wynosi `0`, dopóki skarbiec nie został odblokowany w tej sesji (`:165`, ustawiana tylko w `adoptKey` i po `rekey`). Zapomniane hasło oznacza właśnie nieodblokowaną sesję: AAD `notki:v2:0:<id>` nie pasuje, wszystkie notatki v2 trafiają do `skipped`, `rekeyVault` z pustą mapą zwraca `true` i zapisuje nowe metadane, pin jest nadpisany — stary klucz danych przepada. Okno resetu nie pokazuje `skipped` (`VaultDialogs.tsx:368–370`). Test `privateNotes.test.ts:282–294` tego nie łapie, bo robi `setup` → `lock` w tej samej instancji. **Poprawka (pierwszy punkt K0):** w `rekeyInner` używać `m.epoch`; gdy `skipped` obejmuje wszystkie notatki albo jakąkolwiek notatkę v2 — przerwać przed zapisem; pokazać `skipped` w interfejsie. Test: nowa instancja `createPrivateNotes` na dokumencie z notatką v2 → `resetPasswordWithRecovery` → notatka czytelna.

**Wysokie**

- **C-2. Zachowany stary klucz jest regresem względem stanu dzisiejszego.** Dziś szyfrogram pod starym DK kończy w `failed` — widoczna odmowa. Po K3: (a) osoba z samym kodem synchronizacji wstawia dawny szyfrogram tej samej notatki z wycofanej epoki (AAD to tylko `epoka:id`) i aplikacja go „odzyskuje” — ciche cofnięcie treści; (b) osoba ze starym hasłem i starym stanem dokumentu ma stary DK i może **podmienić treść dowolnej notatki prywatnej**, nie tylko dopisać nową. Poprawki: §3.3 (wybór bez wartości domyślnej), §3.4 (oznaczenie odzyskanej notatki), §8 (K5 przed K3).
- **C-3. `cleanRetired` odrzucał wpis potrzebny w P2** (oba skarbce mają epokę 1), a wypieranie „najstarszy według `epoch`” usuwało go jako pierwszy. Poprawki: §3.1, §3.2.
- **C-4. P1 zakładał, że spóźniony zapis wygrywa.** Yjs rozstrzyga równoległy zapis tego samego klucza identyfikatorem klienta, nie czasem (`yjs/src/structs/Item.js:466–470`). Projekt odzyskuje tylko przypadek, w którym szyfrogram telefonu wygrał; w drugim edycja telefonu ginie bez śladu — jak dziś. Poprawki: §2, §3.7, test 6.1.
- **C-11. Jawne `vaultBlobs` steruje nieodwracalnym kasowaniem.** Odśmiecanie bierze odwołania tylko z jawnych pól (`yjsStore.ts:758–770`, `useNotes.ts:226–227`), a karencja 7 dni liczy się od dodania pliku, nie od utraty odwołania (`imageStore.ts:93, 244`). Pole gubi też bieżący kod: nie przenoszą go `plainFromYNote` ani `yNoteFromPlain` (`yjsStore.ts:257–358`), więc znika przy `upsertNote`, `replaceAll`, `duplicate` i przywracaniu kopii. Poprawka: §4.2.
- **C-14. `parseContent` gubi nieznane pola — skutkiem jest trwała utrata kluczy plików.** Przez sparsowaną treść idą `writeNow`, ujście zapisu, `migrateToV2`, `duplicate`, `removeLock`; zachowuje je tylko `rekeyInner`. Bramka `canWriteSchema(3)` widzi wyłącznie urządzenia obecne w awareness, a bez grupy zwraca „tak”. Poprawki: K0, §4.5.

**Średnie**

- **C-5.** `retiredAt` było poza AAD: osoba ze starym hasłem mogła je podbijać i wpis nigdy by nie wygasł; warunek „usuwany, jeśli `failed` puste” blokowała jedna śmieciowa notatka. Odrzucanie `retiredAt > now + 5 min` karało też urządzenie ze złym zegarem. Poprawki: §3.1, §3.2, §3.6.
- **C-6.** Limit „3 × liczba notatek” był równy maksimum, a liczbę notatek kontroluje osoba z kodem; `decryptAll` robi `Promise.all` po wszystkich, bez limitu długości żetonu. Poprawka: §3.4.
- **C-7.** CAS: dodać odcisk sesji i zapis bez zmiany `updatedAt` (`touch = false`). Poprawka: §3.4.
- **C-8.** `oldKey` jest nieeksportowalny; `unwrapRawWithPassword` nie sprawdza `check`, odpowiednika dla kodu awaryjnego nie ma, a wywołanie obu po kolei to dwa razy PBKDF2. Poprawka: §3.3.
- **C-9.** `iter` w pinie nie usuwa P4, dopóki do KDF idzie `iter` z dokumentu. Poprawka: §3.5.
- **C-10.** Nagłówek ze starego pinu nie ma `iter`; brak ścieżki „kod awaryjny”; dwa miejsca na poprzednie nagłówki wypierała zwykła zmiana (dopisany passkey też daje `changed`). Poprawka: §3.5.
- **C-12.** Jedna tablica `retired` zapisywana w całości przegrywa wyścig z równoległą zmianą na innym urządzeniu; brak czyszczenia kluczy wycofanych w `lock()`. Poprawki: §3.1, §3.4.
- **C-15.** Limity niespójne z kodem: blob = plik + 31 bajtów, a `MAX_PEER_BLOB_BYTES` to dokładnie 20 MiB; jawne załączniki mają 10 MB na plik, 100 MB łącznie i synchronizację do 2 MB (`attachments.ts:29–34`); `syncableRefs` nie zna `vaultBlobs`. Poprawka: §4.2, KR-3.
- **C-16.** Brak opisu `removeLock`, `lockNote` i `duplicate` dla notatki z plikami. Poprawka: §4.6.
- **C-17.** CSP nie ma `media-src` (`blob:` dla audio i wideo zablokowane), a `mime` pochodzi z manifestu, który przy C-2 można podrobić. Poprawka: §4.3.

**Niskie**

- **C-13.** `isValidMeta` sprawdza epokę tylko przez `Number.isFinite` (`vault.ts:230`) — przyjmie 1,5, −3 i 1e300. → K1.
- **C-18.** `fp` to pierwsze 16 bajtów SHA-256 (22 znaki), wejście identyczne z `fingerprint()` (`privateNotes.ts:183`). → §3.1.
- **C-19.** „> 3 wpisy → odrzucić całość” pozwalało wyłączyć łańcuch jednym dopisanym śmieciem. → §3.2.
- **C-20.** Dławienie przepływu 3.5 dzieli licznik z odblokowaniem (`kaczy.vault.attempts.v1`). → §3.5.
- **C-21.** Nowe rodzaje zdarzeń trzeba dodać do `SecurityEventKind`; `logDiag` dopisuje `message` błędu, więc nie rzucać błędów z treścią wpisu. → K2.

**Bez zastrzeżeń:** stały AAD pliku przy jednorazowym CEK i losowym IV; AAD wpisu bez bieżącej epoki (klucz opakowujący jest unikalny dla epoki); format `NV1` z identyfikatorem równym SHA-256 szyfrogramu zgadza się z `putBytes` (`imageStore.ts:128–133`); długości pól w §3.2.

### 0.4 Odpowiedzi na pytania K0

1. **Czy `oldKey` jest eksportowalny:** nie. `importDataKey` ma `extractable: false` (`vault.ts:146–148`); obie ścieżki kończą w `finishUnlock`. Surowe bajty daje tylko `unwrapRawWithPassword` (`:406–416`).
2. **`parseContent`:** gubi wszystkie nieznane pola, także w `meta` (`privateNotes.ts:109–136`).
3. **`rekeyVault` a inne klucze mapy skarbca:** zachowuje — pisze tylko `meta` i `vault` notatek (`yjsStore.ts:982–989`); `replaceAll` mapy skarbca nie rusza. Obserwator obejmuje całą mapę, więc zapis nowego klucza budzi starszego klienta, który robi tylko `emit()`.
4. **`extra` w pinie:** kanoniczny JSON `{ passkeys, recovery }` (`vaultPin.ts:33–39`); pin sprzed tego pola ma `""`. Nagłówek z pinu wystarcza do odzysku kodem awaryjnym; brakuje mu tylko `iter`.
5. **Skarbiec w kopii JSON:** samo `meta` (`exportNotes.ts:191`), przywracane tylko gdy `isValidMeta` (`:402`). Szyfrogramy jadą w `notes[].vault`. Pin i licznik prób nie wchodzą do kopii.

### 0.5 Nie sprawdzone

- C-1 i pozostałe ustalenia nie są potwierdzone uruchomieniem.
- Po własnej zmianie hasła obserwator woła `lock()` (`privateNotes.ts:218`), a `lock()` po 40 ms ustawia `key = null` mimo `locking = false` z `rekeyInner` — wygląda na blokadę skarbca tuż po zmianie hasła. Sprawdzić w K0, bo wpływa na testy wyścigów K3.
- Czy okno zmiany hasła da się otworzyć przy zablokowanym skarbcu (wtedy C-1 dotyczy też `changePassword`).
- Jak budżet kopii i `imageSync` potraktują bloby `NV1`.

### 0.6 Drugie czytanie (2026-11-15) — sprzeczności wewnątrz projektu, już poprawione w §3–§8

- **C-22.** „Wpisu z przepływu 3.5 nie wypiera się” nie dało się wykonać: wpis nie niósł informacji, skąd pochodzi. → pole `src` w AAD, osobny limit (§3.1, §3.2).
- **C-23.** Oznaczenie odzyskanej notatki jako „stan lokalny” widziało tylko urządzenie, które odzyskało — a odzysk dzieje się sam, na pierwszym odblokowanym urządzeniu. → znacznik w zaszyfrowanej treści (§3.4).
- **C-24.** Reguła „nie wypierać poprzedniego nagłówka, gdy `failed` niepuste” była nieobliczalna: nagłówek zapisuje się przed odblokowaniem, a `failed` jest znane dopiero po nim. → przycinanie po odblokowaniu (§3.5).
- **C-25.** Wpisy nieodpakowywalne po zmianie hasła starszym klientem „odpadały” tylko z odczytu — zostawały w dokumencie i po kilku zmianach przekraczały próg 16 surowych wpisów, wyłączając łańcuch. → sprzątanie przy odblokowaniu (§3.6).
- **C-26.** Kopia lokalna przywracała wpis, który inne urządzenie właśnie wygasiło. → przywracanie tylko wpisów przed terminem (§3.1).
- **C-27.** §4.2 („blob spoza manifestu kasowany”) przeczył §4.5 („zgłaszany jako plik bez opisu, nie kasowany”). → jedna reguła z karencją 30 dni (§4.2).
- **C-28.** Prefiks `v3.` chroni przed edycją przez starszego klienta, ale nie przed jego zmianą hasła: notatka `v3` trafia do `skipped`, zmiana przechodzi, stary klucz danych przepada. → K0 przerywa zmianę hasła przy żetonie nieznanej wersji (§4.5, K0).
- **C-29.** Wariant minimalny z KR-5 („K0, K1 i K4 bez łańcucha”) był niewykonalny — przepływ P2 używa formatu wpisu (K2) i ścieżki odczytu (K3). → KR-5 przepisana.
- **C-30.** Warunki startu K6.3 nie obejmowały D1.3 (`docFormat`, `docWritable`) ani 30 dni od D4.1, których wymaga plan migracji. → §4.5, §8.
- Dwie równoległe zmiany hasła na dwóch urządzeniach: to ten sam przypadek co P2 (przegrane urządzenie ma poprzedni nagłówek) — dopisane w §3.5 i w testach.

## 1. Stan

- Hasło → PBKDF2-SHA-256 (600 000) → klucz opakowujący → losowy klucz danych (DK, 32 bajty) w `meta.wrapped`; `check`; opcjonalnie `recovery` i `passkeys`; `epoch` rośnie przy zmianie hasła.
- Notatka: `v2.<iv>.<szyfrogram>`, AES-GCM, AAD `notki:v2:<epoka>:<id>`. Epoki nie ma w żetonie — odszyfrowanie dostaje ją z sesji.
- Zmiana hasła (`rekeyInner`): **nowy DK**, wszystkie notatki przeszyfrowane i zapisane z nowymi metadanymi w jednej transakcji (`store.rekeyVault`), nieodszyfrowywalne trafiają do `skipped`.
- Pin lokalny (`kaczy.vault.pin.v1`): `{epoch, salt, wrapped, check, extra}` — bez `iter`. Werdykty `none/same/epoch-only/changed`; przy `changed` pin jest nadpisywany (`writeVaultPin`), stary nagłówek przepada.
- Pliki w notatce prywatnej są odrzucane („files are not allowed in a private note — dropped”).

## 2. Problemy do rozwiązania

| # | Scenariusz | Dziś |
|---|---|---|
| P1 | **Spóźniony zapis.** Telefon offline edytuje notatkę prywatną starym DK; w tym czasie laptop zmienia hasło. Po synchronizacji szyfrogram telefonu **może** wygrać (o wyniku równoległego zapisu decyduje identyfikator klienta Yjs, nie czas) i jest wtedy pod starym kluczem. Gdy wygra laptop, edycja telefonu ginie — tego projekt nie naprawia. | Notatka w `failed` na zawsze — stary DK nie istnieje. |
| P2 | **Dwa skarbce offline.** Dwa urządzenia zakładają skarbiec bez kontaktu, oba z epoką 1. Po synchronizacji wygrywają jedne metadane. | Notatki przegranego skarbca są nieodszyfrowywalne; przegrane urządzenie po przyjęciu zmiany traci swój nagłówek. |
| P3 | **Pliki w notatce prywatnej.** | Niemożliwe. |
| P4 | **Pin bez `iter`.** | Podmiana `iter` w dokumencie → fałszywe „złe hasło” i dławienie. |

## 3. Projekt A: wycofane klucze

### 3.1 Dane

Nowe klucze w mapie skarbca — **osobne od `meta`** (wymaganie 1): każdy wpis pod własnym kluczem `retired:<epoch>:<fp>`. Nie jedna tablica: tablica zapisywana w całości przegrywa wyścig z równoległą zmianą na innym urządzeniu i łańcuch odpada cały (C-12).

```ts
interface RetiredKey {
  v: 1;
  epoch: number;      // epoka, w której klucz był bieżący
  fp: string;         // odcisk wycofanych metadanych: base64url pierwszych 16 bajtów SHA-256, 22 znaki; wejście identyczne z fingerprint() w privateNotes.ts:183 (epoch|salt|wrapped|check — bez iter, więc da się go policzyć także z nagłówka starego pinu)
  src: "rekey" | "foreign"; // "rekey" — klucz sprzed zmiany hasła (3.3); "foreign" — klucz innego skarbca dodany w przepływie 3.5
  iv: string;         // 12 bajtów, losowe przy każdym opakowaniu
  wrapped: string;    // AES-GCM(bieżący DK, surowy stary DK, AAD = "notki:vault:retired:<epoch>:<fp>:<src>:<retiredAt>")
  retiredAt: number;  // ms; w AAD, więc nie da się go podbić bez bieżącego DK; tylko do wygaszania
}
```

- **Opakowanie nowym kluczem** (wymaganie 2): stary DK szyfrowany bieżącym DK. Kto nie zna bieżącego hasła, nie odczyta wpisu ani nie podrobi nowego — wpis uwierzytelnia AES-GCM.
- **`fp` w AAD** wiąże wpis z konkretnym skarbcem, nie tylko z numerem epoki — to rozróżnia dwa skarbce z epoką 1 (P2).
- **Limit: 3 wpisy `rekey` i osobno 1 wpis `foreign`** (razem najwyżej 4). Przy czwartym wpisie `rekey` odpada najstarszy `rekey` według `retiredAt`; wpis `foreign` nie bierze udziału w tym wypieraniu i znika tylko przez wygaszenie (3.6) albo zastąpienie nowym wpisem `foreign`. `src` jest w AAD, więc osoba bez bieżącego DK nie przerobi wpisu `rekey` na niewypieralny.
- **Kopia lokalna** `kaczy.vault.retired.v1` (te same opakowane wpisy) — dokument jest niezaufany i wpis może z niego zniknąć; lokalna kopia pozwala go przywrócić po odblokowaniu (wymaganie 3: „odzysk tylko z lokalnego nagłówka”). Kopia jest opakowana DK z chwili zapisu, więc po zmianie hasła na innym urządzeniu jest bezużyteczna — chroni tylko w obrębie jednej epoki. Przywracany jest wyłącznie wpis, który odpakowuje się bieżącym DK i nie przekroczył terminu z 3.6 liczonego z własnego `retiredAt` — inaczej urządzenie z kopią odtwarzałoby wpis, który inne właśnie wygasiło. Wygaszenie i opcja „hasło mogło wyciec” czyszczą też kopię.

### 3.2 Walidacja (wymaganie 4)

`cleanRetired(wpisy, odciskBieżący)` w `vault.ts`: wpisy zebrane z kluczy `retired:*`; więcej niż 16 surowych wpisów → odrzucone w całości; limity z 3.1 (3 `rekey` + 1 `foreign`) liczone dopiero po wpisach, które **odpakowały się** bieżącym DK (jeden dopisany śmieć nie wyłącza łańcucha, C-19); nadmiar ponad limit — odpadają najstarsze według `retiredAt`. Każdy wpis ma dokładnie znane pola właściwych typów; `src` to `"rekey"` albo `"foreign"`; `epoch` to `Number.isSafeInteger` w zakresie 1…1 000 000, **bez porównania z bieżącą epoką** (w P2 oba skarbce mają epokę 1, C-3); `fp` 22 znaki base64url i **różne od odcisku bieżących metadanych**; `iv` 16 znaków; `wrapped` 64 znaki; `retiredAt` bezpieczna liczba całkowita ≥ 0, bez odrzucania po zegarze urządzenia; klucz mapy zgodny z `(epoch, fp)` wpisu. Zły wpis jest pomijany z `logSecurity("vault-retired-rejected", …)` — raz na sesję, bez treści wpisu. Wpis, którego nie da się odpakować bieżącym DK, jest pomijany tak samo (powtórzenie starego wpisu, wpis od klienta sprzed funkcji, podróbka).

### 3.3 Zmiana hasła

W `rekeyInner`, przed `store.rekeyVault`:

1. Pobrać surowe bajty starego DK. Klucz sesji zostaje nieeksportowalny (potwierdzone, §0.4). Jedna funkcja `unwrapForRekey(meta, sekret)` zwraca `{ key, raw }` z **jednego** wyprowadzenia klucza opakowującego, sprawdza `check` i ma wariant dla kodu awaryjnego; `raw` zerowane w `finally` wołającego; dławienie liczone raz. `rekey` dostaje sekret, nie gotowy `CryptoKey`. Odszyfrowanie notatek używa `m.epoch`, nie `sessionEpoch` (C-1).
2. Odpakować starym DK istniejące wpisy `retired`, opakować każdy nowym DK z nowym `iv` (**przepakowanie łańcucha**, wymaganie 2). Wpis nieodpakowywalny odpada. Notatki z `skipped` próbować też kluczami wycofanymi, zanim zostaną pominięte.
3. Dopisać wpis dla właśnie wycofanego DK.
4. `store.rekeyVault(meta, next, retired)` zapisuje metadane, notatki i klucze `retired:*` **w jednej transakcji**: ustawia każdy wpis z nowego zestawu pod jego kluczem i usuwa klucze `retired:*`, których w zestawie nie ma; warunek „nic się nie zmieniło w trakcie” obejmuje też te klucze. Przepakowany wpis zachowuje `epoch`, `fp`, `src` i `retiredAt` — zmienia się tylko `iv` i `wrapped`, więc klucz mapy zostaje ten sam.
5. Zapisać pin i kopię lokalną; wyzerować bufory z surowymi kluczami (`fill(0)`) w `finally` (wymaganie 6).

**Wybór „Dlaczego zmieniasz hasło?”** (wymaganie 7) — obowiązkowy w oknie zmiany hasła, **bez wartości domyślnej** (wyciek to główny powód zmiany hasła, więc opcja domyślnie wyłączona chroniłaby najsłabiej wtedy, gdy jest potrzebna): „Hasło mogło wyciec” → kroki 2–3 pominięte, wszystkie klucze `retired:*` usunięte, kopia lokalna wyczyszczona; „Porządkowo” → stary klucz zachowany. Reset kodem awaryjnym zawsze zachowuje. Co trzeba pokazać użytkownikowi wprost: przy zachowanym kluczu **ktoś znający stare hasło i kod synchronizacji może dopisać notatkę oraz podmienić treść każdej istniejącej notatki prywatnej, a ktoś z samym kodem — cofnąć notatkę do wersji z wycofanej epoki**; aplikacja takie notatki oznacza (3.4), ale je przyjmuje. Ceną wariantu „wyciekło” jest utrata spóźnionych zapisów z innych urządzeń, także online: po przyjściu nowych metadanych `lock()` zapisuje jeszcze niezapisane edycje starym kluczem (komunikat: „Zsynchronizuj i zablokuj skarbiec na pozostałych urządzeniach przed zmianą hasła”).

### 3.4 Odczyt spóźnionego zapisu (P1)

W `decryptOne`, gdy bieżący klucz zawiedzie:

1. Dla każdego poprawnego wpisu `retired` (od najnowszego): odpakować stary DK, zaimportować jako **nieeksportowalny** `CryptoKey`, surowe bajty wyzerować od razu; spróbować `decryptNoteString(staryDK, token, id, wpis.epoch)`. Najwyżej tyle prób na notatkę, ile jest poprawnych wpisów (≤ 4); wynik negatywny pamiętany pod SHA-256 żetonu. Klucze wycofane i wyniki negatywne żyją tylko w pamięci sesji i są czyszczone w `lock()`.
2. Sukces → treść do pamięci podręcznej, `logSecurity("vault-late-write-recovered", id bez treści)` **za każdym razem**, i **przeszyfrowanie z CAS** (wymaganie 5) w `enqueue`: zapis tylko gdy `store.getVault(id) === token`, notatka nadal `locked`, `key` ten sam, `sessionEpoch` i odcisk sesji te same, `!rekeying && !locking`; zapis z `touch = false` (odzysk nie jest edycją użytkownika). Po zapisie `failed.delete(id)`. Warunek niespełniony → nic nie pisać; następna obserwacja spróbuje ponownie.
3. **Notatka odzyskana jest oznaczona** „zapisana starym hasłem — sprawdź treść” do potwierdzenia przez użytkownika. Znacznik `recovered: { at, epoch }` jest polem **zaszyfrowanej treści** zapisywanym w tym samym przeszyfrowaniu z CAS — nie stanem lokalnym: odzysk wykonuje się sam na pierwszym odblokowanym urządzeniu, a użytkownik może czytać notatkę na innym. Bieżący DK uwierzytelnia znacznik, więc osoba ze starym kluczem go nie zdejmie; ponowna podmiana daje ponowny odzysk i nowy znacznik. Potwierdzenie przez użytkownika usuwa pole zwykłym zapisem. Wymaga K0 pkt 2 (pola nieznane starszemu klientowi przeżywają zapis); klient sprzed K0 znacznik zgubi przy edycji — ryzyko resztkowe do opisania. To jedyna obrona przed podmianą i cofnięciem treści z C-2, więc nie jest ozdobą interfejsu.
4. Porażka wszystkich → `failed` jak dziś.
5. Pojawienie się albo zmiana wpisu `retired:*` przy niezmienionych metadanych ponawia odszyfrowanie notatek z `failed` (dziś obserwator robi wtedy tylko `emit()`).

Dławienie (wymaganie 6): próby z wycofanymi kluczami nie dotykają licznika haseł (nie ma tu hasła), ale mają własny, **stały** limit: 200 prób na odblokowanie, po kolei, z oddaniem sterowania co 20; żeton dłuższy niż `LIM.vault` pomijany bez próby. Limit zależny od liczby notatek byłby pusty — liczbę notatek kontroluje każdy, kto zna kod synchronizacji.

### 3.5 Dwa skarbce offline (P2)

1. **Pin v2:** `{epoch, salt, wrapped, check, extra, iter}` (P4). `comparePin` porównuje też `iter`; pin bez `iter` (stary) traktowany jak zgodny przy pierwszym odczycie i uzupełniany po udanym odblokowaniu (bezpieczne: sukces odpakowania potwierdza `iter`). Nowy werdykt **`iter-only`** — `salt`, `wrapped`, `check` zgodne z pinem, `iter` nie: KDF liczony z `iter` **z pinu**, zdarzenie `vault-meta-rejected`, bez licznika prób. Bez tego P4 zostaje, bo do KDF nadal szłaby wartość z dokumentu.
2. **Przed nadpisaniem pinu przy werdykcie `changed`** — poprzedni nagłówek do `kaczy.vault.pin.prev.v1` (najwyżej 2 nagłówki, z datą). Zapisywać tylko, gdy różni się `salt`, `wrapped` albo `check` (dopisany passkey też daje `changed` i wyparłby potrzebny nagłówek); bez duplikatów po `fp`. Zapis następuje **przed** odblokowaniem, kiedy `failed` nie jest jeszcze znane, więc w tej chwili nic nie jest wypierane (twardy limit 4 nagłówki; piąty odrzucony z wpisem w dzienniku); przycięcie do 2 najnowszych dopiero po udanym odblokowaniu i tylko gdy `failed` jest puste. Nagłówek bez `iter` → stała `KDF_ITERATIONS`, nigdy wartość z dokumentu; nagłówek z `iter` walidowany jak w `isValidMeta`.
3. Po odblokowaniu, gdy są notatki w `failed` i istnieje poprzedni nagłówek: propozycja „Na tym urządzeniu był inny skarbiec. Podaj jego hasło albo kod awaryjny, żeby odzyskać N notatek”. Sekret → odpakowanie DK z **lokalnego** nagłówka (nigdy z dokumentu; opakowanie kodem awaryjnym jest w `extra`) → wpis `retired` z `src: "foreign"`, `epoch` i `fp` policzonymi z tego nagłówka, opakowany bieżącym DK → ścieżka 3.4 odzyskuje notatki, także na pozostałych urządzeniach. Dławienie na **osobnym** liczniku — wspólny z odblokowaniem sprawiłby, że pomyłki w haśle starego skarbca opóźniają zwykłe odblokowanie.
4. Zwykła zmiana hasła na innym urządzeniu też daje `changed`, ale wtedy `failed` jest puste albo pokrywa je `retired` z dokumentu — propozycja się nie pokazuje. Poprzedni nagłówek usuwany przy odblokowaniu, gdy ma ponad 30 dni (data zapisu nagłówka) i `failed` jest w tej chwili puste — bez osobnego licznika „od kiedy puste”.
5. **Dwie równoległe zmiany hasła** na dwóch urządzeniach to ten sam przypadek: wygrywają jedne metadane i szyfrogramy (o wyniku decyduje identyfikator klienta, dla wszystkich kluczy tak samo), przegrane urządzenie ma swój nagłówek w `pin.prev` i odzyskuje nim edycje zrobione po własnej zmianie hasła.

### 3.6 Wygaszanie i zgodność

- Wpis starszy niż 90 dni (decyzja KR-2) usuwany przy odblokowaniu; niepuste `failed` wydłuża to najwyżej do 180 dni (warunek bez górnej granicy blokowałaby jedna podrzucona notatka).
- **Sprzątanie:** wpis `retired:*`, który po odblokowaniu nie odpakowuje się bieżącym DK albo nie przechodzi walidacji, jest usuwany z dokumentu (najwyżej 16 na odblokowanie, jedna transakcja, `origin` inny niż edycja użytkownika). Jest bezużyteczny dla każdego urządzenia z bieżącymi metadanymi, a pozostawiony zbliża mapę do progu 16 surowych wpisów, po którym łańcuch jest odrzucany w całości.
- **Starszy klient** nie zna `retired`: nie przepakuje łańcucha przy swojej zmianie hasła — wpisy stają się nieodpakowywalne, są pomijane (3.2) i sprzątane jak wyżej. Skutek: powrót do stanu dzisiejszego, bez pogorszenia. Starszy klient nie czyta `retired`, więc dopisanie klucza nie wymaga podnoszenia `SCHEMA_VERSION`. Potwierdzone: starszy `rekeyVault` nie rusza innych kluczy mapy skarbca (§0.4).
- Kopia JSON: dziś sekcja skarbca to samo `meta`; wpisy `retired` trzeba do niej dodać (nowe pole obok `meta`, stara aplikacja je pominie); import waliduje tak samo jak dane z dokumentu.

### 3.7 Czego ten projekt nie daje

- Nie odzyskuje edycji, która przegrała równoległy zapis (C-4): przy telefonie offline o wyniku decyduje identyfikator klienta Yjs.
- Nie chroni przed podmianą ani cofnięciem treści przez osobę ze starym hasłem lub kodem synchronizacji, dopóki klucz jest zachowany — tylko je oznacza (C-2).
- Nie chroni przed usunięciem wpisu z dokumentu przez osobę znającą kod synchronizacji, jeśli żadne urządzenie nie ma kopii lokalnej.
- Wycofany DK istnieje, dopóki trwa wpis: przejęcie bieżącego hasła daje też stare klucze. Stare szyfrogramy i tak zostały przeszyfrowane, więc realnie dotyczy to tylko kopii zapasowych sprzed zmiany hasła — które atakujący z dawnym hasłem czytał i bez tego.

## 4. Projekt B: szyfrowane załączniki (3.3)

### 4.1 Zasada

**Klucz pliku żyje w szyfrogramie notatki, a zaszyfrowany plik jest zwykłym blobem adresowanym skrótem szyfrogramu.** Dzięki temu `imageStore`, `imageSync`, przekaźnik i kopia przenoszą go bez zmian i bez znajomości klucza, a zmiana hasła nie rusza plików — przeszyfrowuje tylko notatkę, w której są klucze.

### 4.2 Format

- Dla każdego pliku: losowy klucz zawartości (CEK, 32 bajty), losowe `iv` (12 bajtów). Blob = `"NV1" ‖ iv ‖ AES-GCM(CEK, bajty pliku, AAD = "notki:file:v1")`. Identyfikator = SHA-256 blobu (ten sam mechanizm co dla obrazów jawnych).
- Wiązanie z notatką daje manifest, nie AAD blobu (plik można przenieść między notatkami bez przeszyfrowania; CEK jest losowy i jednorazowy, więc AAD z identyfikatorem notatki nic by nie dodało).
- W `PrivateContent` (wewnątrz szyfrogramu notatki): `files: [{ blob, cek, name, mime, size, thumb?: { blob, cek } }]`. Nazwa, typ i rozmiar są więc zaszyfrowane.
- W jawnej części notatki: `vaultBlobs: string[]` — same identyfikatory blobów. **Konieczne**, bo odśmiecanie `imageStore`, synchronizacja obrazów i przekaźnik muszą wiedzieć, które bloby są w użyciu; bez tego zaszyfrowane pliki zostałyby usunięte jako osierocone. Ujawnia liczbę plików notatki — zapisać w modelu zagrożeń.
- **`vaultBlobs` jest jawne i niezaufane, a steruje kasowaniem** (C-11). Dlatego: blob z nagłówkiem `NV1` jest kasowany wyłącznie przy odblokowanym skarbcu, gdy nie występuje w żadnym odszyfrowanym manifeście (także notatek w koszu), `failed` jest puste i minęła zwykła karencja 7 dni. Skutek uboczny: na urządzeniu, na którym skarbiec nie jest odblokowywany, bloby `NV1` nie są odśmiecane — do opisania, nie do naprawy. Blob wymieniony w `vaultBlobs` istniejącej notatki, ale nieobecny w jej manifeście (starszy klient zgubił wpis, 4.5), jest pokazywany jako „plik bez opisu” i trzymany 30 dni od pierwszego wykrycia na tym urządzeniu, potem podlega regule wyżej — jawne pole nie może przypiąć blobu na zawsze. Po odszyfrowaniu notatki klient uzupełnia `vaultBlobs` z manifestu (zapis z CAS i `touch = false`, jak w 3.4) i loguje `vault-blobs-restored`. Pole musi przechodzić przez `plainFromYNote`, `yNoteFromPlain`, `syncableRefs`, kopię i `duplicate` — dziś żadna z tych dróg go nie zna.
- Limit pliku = `MAX_PEER_BLOB_BYTES` − 64 KB (blob to plik + 31 bajtów, a limit przyjęcia od innego urządzenia to dokładnie 20 MiB; przekaźnik przyjmuje 24 MB), 20 plików na notatkę; zaszyfrowane pliki liczą się do `MAX_ATTACHMENTS_TOTAL_BYTES`. Jawne załączniki synchronizują się dziś tylko do 2 MB — KR-3 musi powiedzieć, czy większe pliki skarbca zostają lokalne.
- Manifest walidowany w czasie działania: `blob` 64 znaki szesnastkowe, `cek` 43 znaki base64url, `name` ≤ 120 znaków bez znaków sterujących i separatorów ścieżki, `mime` ≤ 100 znaków, `size` całkowite od 0 do limitu pliku, `thumb` z tymi samymi regułami dla `blob` i `cek`, ≤ 20 wpisów, bez powtórzonego `blob`. Zły wpis jest pomijany, pozostałe działają.
- Miniatura powstaje przed szyfrowaniem i jest osobnym zaszyfrowanym blobem.

### 4.3 Odczyt

Odszyfrowanie do `Blob` w pamięci → `URL.createObjectURL`; adresy odwoływane przy blokadzie skarbca i zamknięciu notatki. Odszyfrowana treść nigdy nie trafia do IndexedDB, Cache Storage ani historii wersji. CSP: `img-src` i `frame-src` mają `blob:`, **`media-src` nie istnieje** (audio i wideo z `blob:` blokuje `default-src 'self'`), `connect-src` nie ma `blob:` (`fetch(blob:)` nie zadziała). Podgląd tylko dla listy dozwolonej (png, jpeg, webp, gif, pdf), `mime` przez `safeMime`; pozostałe typy wyłącznie do pobrania jako `application/octet-stream`; nigdy `text/html` ani `image/svg+xml` w `blob:` — typ pochodzi z manifestu, który przy zachowanym starym kluczu można podrobić (C-2). Pobranie pliku — przez istniejący pomocnik pobierania.

### 4.4 Co się ujawnia

Liczba i przybliżony rozmiar plików (dopełnianie — decyzja SE-5 z planu bezpieczeństwa), czas dodania. Ten sam plik dodany dwa razy daje dwa różne bloby (losowy CEK) — brak deduplikacji, ale też brak potwierdzenia „czy użytkownik ma plik X”.

### 4.5 Zgodność

Starszy klient: (a) przy zapisie notatki prywatnej **gubi** pole `files` z odszyfrowanej treści — `parseContent` odrzuca nieznane pola (potwierdzone, C-14), a wraz z nim przepadają klucze plików; (b) jego odśmiecanie nie zna `vaultBlobs`. Dlatego: zapis załączników tylko gdy `canWriteSchema(3)`; `SCHEMA_VERSION` → 3; baner „Zaktualizuj aplikację na urządzeniu X” już istnieje. **Sama bramka nie wystarcza:** widzi tylko urządzenia obecne w awareness, a bez grupy zwraca „tak”. Warunki startu K6.3: (1) wydanie, w którym `parseContent` i wszystkie ścieżki zapisu przenoszą nieznane pola (K0), jest na urządzeniach od co najmniej 30 dni; (2) D1.1, D1.3 i D4 z `plan-migracje-yjs-2026-11-15.md` są wdrożone (rejestr urządzeń w dokumencie), a od wdrożenia D4.1 minęło 30 dni; pierwsze dodanie pliku zapisuje cechę `docFormat["vault-files"] = 3`, a zapis manifestu sprawdza `docWritable("vault-files")`; (3) notatka z plikami dostaje prefiks żetonu `v3.` — starszy klient zgłasza wtedy `unsupported-version` (`vault.ts:94`) i nie może jej edytować, więc nie może też zniszczyć kluczy. **Prefiks nie chroni przed zmianą hasła na starszym kliencie:** notatka `v3` trafia tam do `skipped`, zmiana hasła przechodzi i stary klucz danych przepada. Dlatego K0 (wydawane co najmniej 30 dni wcześniej) przerywa zmianę hasła, gdy którykolwiek żeton ma nieznaną wersję. Ryzyko resztkowe — urządzenie offline z wersją sprzed K0 — opisać w modelu zagrożeń; blob na pozostałych urządzeniach przeżyje, zginąć może wpis w manifeście (wtedy CEK jest stracony, a blob staje się „plikiem bez opisu” z 4.2) — stąd w K6.2 test, który pilnuje, by do tego nie dochodziło w bieżącym kliencie.

### 4.6 Operacje na notatce z plikami

- **Zdjęcie blokady** (`removeLock`): odmowa `has-files` do czasu osobnego etapu (odszyfrowanie plików do jawnych załączników to osobny projekt).
- **`duplicate`:** kopiuje wpisy manifestu; bloby są wspólne, więc odśmiecanie liczy odwołania z obu notatek.
- **`lockNote` przy jawnych plikach:** nadal odmawia, jak dziś.
- **Usunięcie pliku albo notatki:** usuwa wpis z manifestu i z `vaultBlobs`; blob kasuje dopiero odśmiecanie według 4.2 (ten sam blob może być w duplikacie).
- **Zmiana hasła:** przeszyfrowuje manifest razem z treścią, blobów nie rusza; `rekeyInner` zachowuje prefiks `v3.` notatki z plikami.

## 5. Etapy

| Nr | Punkt | Rozmiar |
|---|---|---|
| K0 | **Naprawy i testy charakteryzujące.** (1) **Błąd C-1:** test resetu kodem awaryjnym na nowej instancji, poprawka `m.epoch`, przerwanie przed zapisem (także gdy którykolwiek żeton ma nieznaną wersję — C-28), `skipped` w interfejsie — do wydania od razu, niezależnie od reszty. (2) `parseContent` przenosi nieznane pola najwyższego poziomu bez zmian (limit 64 KB JSON) i zachowują je wszystkie ścieżki zapisu; test „pole z przyszłości przeżywa edycję, migrację, duplikat”. (3) Testy opisujące dzisiejsze zachowanie P1 (oba porządki identyfikatora klienta) i P2 — mają przejść teraz i zmienić wynik po K3/K4. (4) Sprawdzić blokadę skarbca tuż po własnej zmianie hasła (§0.5). Pytania rozpoznawcze są rozstrzygnięte w §0.4. | M |
| K0.1 | **Przegląd projektu** — zrobiony 2026-11-15 (§0). Zostaje propozycja **ADR-10** (wycofane klucze i załączniki skarbca). | S |
| K1 | **Pin v2** (`iter`, werdykt `iter-only`, poprzedni nagłówek przy `changed`), zgodność ze starym pinem; `isValidMeta`: epoka jako `Number.isSafeInteger` 1…1 000 000. Samodzielnie wdrażalne. | S |
| K2 | **Format i łańcuch:** `RetiredKey`, `cleanRetired`, opakowanie i przepakowanie w `vault.ts` (czyste funkcje + testy wektorów), `rekeyVault` z trzecim argumentem, `unwrapForRekey`, kopia lokalna, zerowanie buforów, nowe rodzaje w `SecurityEventKind` (szczegół = sam identyfikator notatki; nie rzucać błędów z treścią wpisu, bo `logDiag` dopisuje `message`). Bez ścieżki odczytu. | M |
| K3 | **Odzysk spóźnionego zapisu:** ścieżka 3.4 z CAS, limit prób, dziennik, znacznik `recovered` w treści i jego potwierdzanie, ponowienie po zmianie `retired:*`, komunikat „Odzyskano N notatek zapisanych starym hasłem”; wygaszanie i sprzątanie wpisów (3.6); `retired` w kopii JSON. | M |
| K4 | **Dwa skarbce:** przepływ 3.5 z interfejsem (hasło albo kod awaryjny, osobny licznik prób), wpis `foreign`, przycinanie `pin.prev` po odblokowaniu. Wymaga K1 (poprzedni nagłówek), K2 (format wpisu) i K3 (ścieżka odczytu). | M |
| K5 | **Wybór „Dlaczego zmieniasz hasło?”** (3.3) z opisem skutków obu odpowiedzi; test, że po „hasło mogło wyciec” stary szyfrogram jest odrzucany. Wychodzi w jednym wydaniu z K2. | S |
| K6.1 | **Załączniki — rdzeń:** `vaultFiles.ts` (szyfrowanie, odszyfrowanie, format `NV1`), testy wektorów, limity. | M |
| K6.2 | **Załączniki — przechowywanie:** `vaultBlobs` w modelu notatki, odśmiecanie według 4.2 (z „plikiem bez opisu”), `imageSync` i `syncableRefs`, przekaźnik, kopia i przywracanie; operacje z 4.6; test „manifest przeżywa każdą ścieżkę zapisu” (`writeNow`, ujście zapisu, `migrateToV2`, `duplicate`, zmiana hasła). Bez interfejsu dodawania — nic jeszcze nie tworzy plików. | M |
| K6.3 | **Załączniki — interfejs:** dodawanie (plik, aparat, wklejenie), miniatury, podgląd według 4.3, pobranie, usuwanie, stan przy zablokowanym skarbcu; prefiks `v3.`, `SCHEMA_VERSION` 3, cecha `docFormat["vault-files"]`, bramki `canWriteSchema(3)` i `docWritable`. Start po spełnieniu warunków z 4.5. | M |
| K7 | **Przegląd końcowy** `security-reviewer` na całym diffie, `opis.md` (dział Skarbiec), aktualizacja `docs/model-zagrozen.md` i statusów w `plan-skarbiec-2026-10-25.md`. | S |

## 6. Testy wymagane (lista z odrzuconego przeglądu, rozszerzona)

1. Spóźniony zapis po zmianie hasła — odzyskany i przeszyfrowany; na drugim urządzeniu też czytelny **i oznaczony** (znacznik `recovered` dochodzi synchronizacją); potwierdzenie zdejmuje znacznik na obu. Oba porządki identyfikatora klienta: gdy wygrywa szyfrogram laptopa, test stwierdza utratę edycji telefonu (zachowanie opisane w 3.7, nie błąd).
2. Łańcuch przez dwie i trzy epoki; czwarty wpis `rekey` wypiera najstarszy według `retiredAt`; wpis `foreign` nie jest wypierany przez zmiany hasła; przepakowanie zachowuje klucz mapy.
3. Dwa skarbce offline (oba z epoką 1) — odzysk z poprzedniego nagłówka hasłem i osobno kodem awaryjnym; nagłówek ze starego pinu bez `iter`; błędne hasło podlega dławieniu na osobnym liczniku i nie opóźnia zwykłego odblokowania; dopisany passkey nie wypiera nagłówka. Dwie równoległe zmiany hasła — przegrane urządzenie odzyskuje swoje edycje.
3a. Pin: werdykt `iter-only` liczy KDF z `iter` z pinu i nie nabija licznika prób; pin bez `iter` uzupełniany po udanym odblokowaniu; epoka 1,5, −3 i 1e300 w metadanych odrzucona.
4. Podrzucone wpisy: zły kształt, 17 wpisów, zmienione `retiredAt`, zmienione `src`, `fp` równe bieżącemu, wpis opakowany obcym kluczem, powtórzony stary wpis — wszystkie pominięte, jeden wpis w dzienniku, odblokowanie działa; jeden śmieć obok trzech dobrych wpisów nie wyłącza łańcucha.
4a. Powtórzony stary szyfrogram z wycofanej epoki i notatka podmieniona starym kluczem — odzyskane **z oznaczeniem** i wpisem w dzienniku za każdym razem.
4b. Reset kodem awaryjnym na świeżej instancji (C-1) — notatki v2 czytelne; gdy nie da się ich odszyfrować albo któryś żeton ma nieznaną wersję, nic nie jest zapisane, a interfejs pokazuje pominięte.
5. Wyścigi: edycja w trakcie odzysku (CAS odmawia, treść użytkownika wygrywa); blokada w trakcie; zmiana hasła w trakcie; dwie karty; odzysk nie zmienia `updatedAt`.
6. Starszy klient zmienia hasło — wpisy stają się nieodpakowywalne, nowy klient je sprząta przy odblokowaniu, nic się nie psuje; pięć takich zmian z rzędu nie przekracza progu 16 surowych wpisów. Starszy klient przy istniejących `retired:*` — odblokowuje normalnie.
6a. Wygaszanie: wpis po 90 dniach usunięty z dokumentu i z kopii lokalnej; urządzenie z kopią lokalną go nie odtwarza; niepuste `failed` trzyma go najwyżej do 180 dni.
7. Odpowiedź „hasło mogło wyciec” — brak kluczy `retired:*` w dokumencie, kopia lokalna pusta, szyfrogram pod starym kluczem trafia do `failed`. Okna zmiany hasła nie da się zatwierdzić bez wybrania odpowiedzi.
8. Sekrety: żaden log ani raport diagnostyczny nie zawiera klucza, hasła, kodu; bufory wyzerowane (test na atrapie).
9. Zalew śmieciowych szyfrogramów — limit prób działa, interfejs odpowiada.
10. Załączniki: obieg szyfruj–odszyfruj; zmieniony bajt blobu → błąd; zmiana hasła nie zmienia blobów; odśmiecanie nie kasuje używanych; kopia i przywrócenie; przekaźnik przenosi; blokada skarbca odwołuje adresy `blob:`; plik 20 MB na telefonie bez awarii karty.
10a. Załączniki a niezaufane pola: wyczyszczone albo podmienione `vaultBlobs` nie powoduje skasowania blobu i jest odtwarzane z manifestu; blob przypięty samym `vaultBlobs` znika po 30 dniach; przy zablokowanym skarbcu i przy niepustym `failed` żaden blob `NV1` nie jest kasowany; manifest z `mime` `text/html` albo `image/svg+xml` daje tylko pobranie; zły wpis manifestu nie blokuje pozostałych.
10b. Załączniki a operacje i zgodność: `removeLock` → `has-files`; duplikat dzieli bloby i usunięcie jednej notatki ich nie kasuje; klient bez obsługi `v3.` nie edytuje notatki i **nie przeprowadza zmiany hasła**; `vaultBlobs` przeżywa `upsertNote`, `replaceAll`, kopię i przywrócenie.
11. Kopia JSON z `retired` i załącznikami — import na czystym urządzeniu.

## 7. Decyzje właściciela

- **KR-1:** KDF — zostaje PBKDF2 600 000 (zalecane teraz: zgodne z zaleceniami OWASP, bez nowej zależności), czy dodać Argon2id przez WebAssembly (odporniejszy na łamanie na kartach graficznych; koszt: paczka ładowana przy odblokowaniu, nowe pole `kdf` i bramka formatu). Ma znaczenie, bo metadane skarbca widzi każdy, kto zna kod synchronizacji.
- **KR-2:** jak długo trzymać wycofany klucz (zalecane 90 dni).
- **KR-3:** limity załączników (ok. 20 MB, 20 plików) **oraz** próg synchronizacji: dziś jawne załączniki powyżej 2 MB zostają lokalne — czy pliki skarbca mają tak samo.
- **KR-4:** przegląd wymaga pytania przy każdej zmianie hasła, bez wartości domyślnej (C-2). Do decyzji zostaje tylko brzmienie. Opcja schowana w ustawieniach zaawansowanych nie przechodzi przeglądu.
- **KR-5 (nowa):** czy w ogóle wdrażać zachowywanie starego klucza (K2–K5). Zysk: odzysk spóźnionych zapisów i dwóch skarbców offline. Koszt: dopóki klucz jest zachowany, stare hasło pozwala podmieniać notatki — aplikacja to tylko oznacza. Wariant minimalny: K0, K1, K2 i K3 **bez kroku „dopisać wpis dla wycofanego DK” w 3.3** (zmiana hasła zawsze zachowuje się jak „hasło mogło wyciec”, K5 odpada), oraz K4. Format wpisu i ścieżka odczytu są wtedy nadal potrzebne, bo używa ich przepływ P2; zachowywany jest tylko klucz przegranego skarbca, o który użytkownik sam poprosił, podając jego hasło. Traci się odzysk spóźnionego zapisu (P1).
- **KR-6 (nowa):** reset kodem awaryjnym — projekt zakłada, że zawsze zachowuje stary klucz (zapomniane hasło to nie wyciek). Do potwierdzenia, czy także tam pokazywać wybór z 3.3.

## 8. Kolejność

K0 (C-1 od razu) → K1 → K2 + K5 → K3 → K4 → K6.1 → K6.2 → K6.3 → K7. K5 wychodzi razem z K2, **przed** K3 — odzysk bez wyboru „hasło wyciekło” byłby regresem. K1 i K6.1 można robić niezależnie od reszty. K4 wymaga K1, K2 i K3. K6.2 można zacząć po K0 (nie tworzy jeszcze plików); K6.3 dopiero po D1.1, D1.3 i D4 z planu migracji, 30 dniach od wdrożenia D4.1 i 30 dniach od wydania K0. Decyzja KR-5 zapada przed K2 — od niej zależy, czy K5 w ogóle powstaje. Każdy etap: Vitest (`vault.test.ts`, `privateNotes.test.ts`, nowe), `npm run typecheck`, przegląd `security-reviewer`.

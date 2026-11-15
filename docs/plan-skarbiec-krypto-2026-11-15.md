# Plan: Skarbiec — wycofane klucze (1.2 cz. 2) i szyfrowane załączniki (3.3) (2026-11-15)

> **Status:** projekt do przeglądu, realizacja nie zaczęta. Wykonawca: Opus. **Żaden etap K2–K6 nie zaczyna się przed przeglądem tego dokumentu agentem `security-reviewer`** — poprzedni projekt 1.2 cz. 2 został odrzucony 2026-11-02; ten spełnia siedem wymagań z `plan-skarbiec-2026-10-25.md` i mówi, gdzie.
>
> Projekt powstał z czytania `vault.ts`, `vaultPin.ts` i `privateNotes.ts` z 2026-11-15. Miejsca oznaczone „sprawdzić” są założeniami o kodzie, których nie potwierdziłem — K0 je rozstrzyga.

## 1. Stan

- Hasło → PBKDF2-SHA-256 (600 000) → klucz opakowujący → losowy klucz danych (DK, 32 bajty) w `meta.wrapped`; `check`; opcjonalnie `recovery` i `passkeys`; `epoch` rośnie przy zmianie hasła.
- Notatka: `v2.<iv>.<szyfrogram>`, AES-GCM, AAD `notki:v2:<epoka>:<id>`. Epoki nie ma w żetonie — odszyfrowanie dostaje ją z sesji.
- Zmiana hasła (`rekeyInner`): **nowy DK**, wszystkie notatki przeszyfrowane i zapisane z nowymi metadanymi w jednej transakcji (`store.rekeyVault`), nieodszyfrowywalne trafiają do `skipped`.
- Pin lokalny (`kaczy.vault.pin.v1`): `{epoch, salt, wrapped, check, extra}` — bez `iter`. Werdykty `none/same/epoch-only/changed`; przy `changed` pin jest nadpisywany (`writeVaultPin`), stary nagłówek przepada.
- Pliki w notatce prywatnej są odrzucane („files are not allowed in a private note — dropped”).

## 2. Problemy do rozwiązania

| # | Scenariusz | Dziś |
|---|---|---|
| P1 | **Spóźniony zapis.** Telefon offline edytuje notatkę prywatną starym DK; w tym czasie laptop zmienia hasło. Po synchronizacji szyfrogram telefonu wygrywa (nowszy) i jest pod starym kluczem. | Notatka w `failed` na zawsze — stary DK nie istnieje. |
| P2 | **Dwa skarbce offline.** Dwa urządzenia zakładają skarbiec bez kontaktu, oba z epoką 1. Po synchronizacji wygrywają jedne metadane. | Notatki przegranego skarbca są nieodszyfrowywalne; przegrane urządzenie po przyjęciu zmiany traci swój nagłówek. |
| P3 | **Pliki w notatce prywatnej.** | Niemożliwe. |
| P4 | **Pin bez `iter`.** | Podmiana `iter` w dokumencie → fałszywe „złe hasło” i dławienie. |

## 3. Projekt A: wycofane klucze

### 3.1 Dane

Nowy klucz w mapie skarbca — **osobny od `meta`** (wymaganie 1): `vaultMap.get("retired")`, zwykła tablica JSON zapisywana w całości.

```ts
interface RetiredKey {
  v: 1;
  epoch: number;      // epoka, w której klucz był bieżący
  fp: string;         // odcisk wycofanych metadanych: base64url(SHA-256(epoch|salt|wrapped|check)), 22 znaki
  iv: string;         // 12 bajtów, losowe przy każdym opakowaniu
  wrapped: string;    // AES-GCM(bieżący DK, surowy stary DK, AAD = "notki:vault:retired:<epoch>:<fp>")
  retiredAt: number;  // ms; tylko do wygaszania, nie do decyzji o zaufaniu
}
```

- **Opakowanie nowym kluczem** (wymaganie 2): stary DK szyfrowany bieżącym DK. Kto nie zna bieżącego hasła, nie odczyta wpisu ani nie podrobi nowego — wpis uwierzytelnia AES-GCM.
- **`fp` w AAD** wiąże wpis z konkretnym skarbcem, nie tylko z numerem epoki — to rozróżnia dwa skarbce z epoką 1 (P2).
- **Limit 3 wpisy**; przy czwartym odpada najstarszy według `epoch`.
- **Kopia lokalna** `kaczy.vault.retired.v1` (te same opakowane wpisy) — dokument jest niezaufany i wpis może z niego zniknąć; lokalna kopia pozwala go przywrócić po odblokowaniu (wymaganie 3: „odzysk tylko z lokalnego nagłówka”).

### 3.2 Walidacja (wymaganie 4)

`cleanRetired(raw, now)` w `vault.ts`: tablica; ≤ 3 wpisy (nadmiar odrzucony w całości jako podejrzany, nie przycinany po cichu); każdy wpis ma dokładnie znane pola właściwych typów; `epoch` całkowite ≥ 1 i < bieżącej epoki; `fp` 22 znaki base64url; `iv` 16 znaków; `wrapped` o długości odpowiadającej 32 bajtom + znacznik; `retiredAt ≤ now + 5 min`; brak duplikatów `(epoch, fp)`. Zły wpis jest pomijany z `logSecurity("vault-retired-rejected", …)` — raz na sesję, bez treści wpisu. Wpis, którego nie da się odpakować bieżącym DK, jest pomijany tak samo (powtórzenie starego wpisu, wpis od klienta sprzed funkcji, podróbka).

### 3.3 Zmiana hasła

W `rekeyInner`, przed `store.rekeyVault`:

1. Pobrać surowe bajty starego DK. Klucz sesji zostaje nieeksportowalny — bajty pochodzą z odpakowania hasłem (`unwrapRawWithPassword`) albo kodem awaryjnym (dopisać odpowiednik). To wymaga przekazania sekretu do `rekey`, nie gotowego `CryptoKey` — zmiana sygnatury wewnętrznej (sprawdzić w K0, czy `oldKey` jest gdzieś eksportowalny; jeśli tak — poprawić).
2. Odpakować starym DK istniejące wpisy `retired`, opakować każdy nowym DK z nowym `iv` (**przepakowanie łańcucha**, wymaganie 2). Wpis nieodpakowywalny odpada.
3. Dopisać wpis dla właśnie wycofanego DK.
4. `store.rekeyVault(meta, next, retired)` zapisuje metadane, notatki i `retired` **w jednej transakcji**; warunek „nic się nie zmieniło w trakcie” obejmuje też `retired`.
5. Zapisać pin i kopię lokalną; wyzerować bufory z surowymi kluczami (`fill(0)`) w `finally` (wymaganie 6).

**Opcja „Hasło mogło wyciec — nie zachowuj starego klucza”** (wymaganie 7), domyślnie wyłączona, w oknie zmiany hasła: kroki 2–3 pominięte, `retired` zapisane jako pusta tablica, kopia lokalna wyczyszczona. Powód, który trzeba pokazać użytkownikowi wprost: zachowany stary klucz oznacza, że **ktoś znający stare hasło i kod synchronizacji może dopisać notatkę, którą aplikacja przyjmie i przeszyfruje jako własną**. Przy wycieku hasła tego nie chcemy; ceną jest utrata spóźnionych zapisów z innych urządzeń (komunikat: „Zsynchronizuj pozostałe urządzenia przed zmianą hasła”).

### 3.4 Odczyt spóźnionego zapisu (P1)

W `decryptOne`, gdy bieżący klucz zawiedzie:

1. Dla każdego poprawnego wpisu `retired` (od najnowszego): odpakować stary DK (wynik w pamięci sesji, nie na dysku), spróbować `decryptNoteString(staryDK, token, id, wpis.epoch)`. Najwyżej 3 próby na notatkę; wynik negatywny zapamiętany dla żetonu, żeby nie powtarzać przy każdym renderze.
2. Sukces → treść do pamięci podręcznej, `logSecurity("vault-late-write-recovered", id bez treści)` i **przeszyfrowanie z CAS** (wymaganie 5) w `enqueue`: zapis tylko gdy `store.getVault(id) === token`, notatka nadal `locked`, `key` ten sam, `sessionEpoch` ten sam, `!rekeying && !locking`. Po zapisie `failed.delete(id)`. Warunek niespełniony → nic nie pisać; następna obserwacja spróbuje ponownie.
3. Porażka wszystkich → `failed` jak dziś.

Dławienie (wymaganie 6): próby z wycofanymi kluczami nie dotykają licznika haseł (nie ma tu hasła), ale mają własny limit — nie więcej niż 3 × liczba notatek prób na odblokowanie; ponad to — przerwać i zalogować (podrzucenie tysięcy śmieciowych szyfrogramów nie może zająć procesora).

### 3.5 Dwa skarbce offline (P2)

1. **Pin v2:** `{epoch, salt, wrapped, check, extra, iter}` (P4). `comparePin` porównuje też `iter`; pin bez `iter` (stary) traktowany jak zgodny przy pierwszym odczycie i uzupełniany po udanym odblokowaniu.
2. **Przed nadpisaniem pinu przy werdykcie `changed`** — poprzedni nagłówek do `kaczy.vault.pin.prev.v1` (najwyżej 2 nagłówki, z datą).
3. Po odblokowaniu, gdy są notatki w `failed` i istnieje poprzedni nagłówek: propozycja „Na tym urządzeniu był inny skarbiec. Podaj jego hasło, żeby odzyskać N notatek”. Hasło → odpakowanie DK z **lokalnego** nagłówka (nigdy z dokumentu), z dławieniem jak przy odblokowaniu → wpis `retired` dla tego DK opakowany bieżącym DK → ścieżka 3.4 odzyskuje notatki, także na pozostałych urządzeniach.
4. Zwykła zmiana hasła na innym urządzeniu też daje `changed`, ale wtedy `failed` jest puste albo pokrywa je `retired` z dokumentu — propozycja się nie pokazuje. Poprzedni nagłówek usuwany, gdy `failed` puste przez 30 dni.

### 3.6 Wygaszanie i zgodność

- Wpis starszy niż 90 dni (decyzja KR-2) usuwany przy odblokowaniu, jeśli `failed` jest puste.
- **Starszy klient** nie zna `retired`: nie przepakuje łańcucha przy swojej zmianie hasła — wpisy stają się nieodpakowywalne i odpadają (3.2). Skutek: powrót do stanu dzisiejszego, bez pogorszenia. Starszy klient nie czyta `retired`, więc dopisanie klucza nie wymaga podnoszenia `SCHEMA_VERSION`. Sprawdzić w K0, że starszy `rekeyVault` nie kasuje nieznanych kluczy mapy skarbca.
- Kopia JSON: `retired` wchodzi do sekcji skarbca; import waliduje tak samo jak dane z dokumentu.

### 3.7 Czego ten projekt nie daje

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
- Limit 20 MB na plik (WebCrypto szyfruje w pamięci, przekaźnik przyjmuje 24 MB), 20 plików na notatkę.
- Miniatura powstaje przed szyfrowaniem i jest osobnym zaszyfrowanym blobem.

### 4.3 Odczyt

Odszyfrowanie do `Blob` w pamięci → `URL.createObjectURL`; adresy odwoływane przy blokadzie skarbca i zamknięciu notatki. Odszyfrowana treść nigdy nie trafia do IndexedDB, Cache Storage ani historii wersji. Sprawdzić `img-src`/`media-src` w CSP dla `blob:` i znane pułapki z `fetch(blob:)`. Pobranie pliku — przez istniejący pomocnik pobierania.

### 4.4 Co się ujawnia

Liczba i przybliżony rozmiar plików (dopełnianie — decyzja SE-5 z planu bezpieczeństwa), czas dodania. Ten sam plik dodany dwa razy daje dwa różne bloby (losowy CEK) — brak deduplikacji, ale też brak potwierdzenia „czy użytkownik ma plik X”.

### 4.5 Zgodność

Starszy klient: (a) przy zapisie notatki prywatnej może zgubić pole `files` z odszyfrowanej treści, jeśli `parseContent` odrzuca nieznane pola — **sprawdzić w K0; jeśli tak, to ten projekt wymaga bramki**; (b) jego odśmiecanie nie zna `vaultBlobs`. Dlatego: zapis załączników tylko gdy `canWriteSchema(3)`; `SCHEMA_VERSION` → 3; baner „Zaktualizuj aplikację na urządzeniu X” już istnieje. Ryzyko resztkowe — urządzenie offline ze starą wersją — opisać; blob na pozostałych urządzeniach przeżyje, zginąć może tylko wpis w manifeście, więc dodać naprawę: blob z `vaultBlobs`, którego nie ma w manifeście, jest zgłaszany jako „plik bez opisu” zamiast kasowany (CEK jest wtedy stracony — stąd w K6.2 test, który pilnuje, by do tego nie dochodziło w bieżącym kliencie).

## 5. Etapy

| Nr | Punkt | Rozmiar |
|---|---|---|
| K0 | **Rozpoznanie i testy charakteryzujące** (bez zmian zachowania): czy `oldKey` w `rekey` jest eksportowalny; co `parseContent` robi z nieznanymi polami; czy `rekeyVault` zachowuje inne klucze mapy skarbca; co zawiera `extra` w pinie; jak sekcja skarbca wygląda w kopii. Testy opisujące dzisiejsze zachowanie P1 i P2 (mają przejść teraz i zmienić wynik po K3/K4). Wynik dopisać do tego pliku. | S |
| K0.1 | **Przegląd projektu** agentem `security-reviewer`; poprawki w tym dokumencie; propozycja **ADR-10** (wycofane klucze i załączniki skarbca). | S |
| K1 | **Pin v2** (`iter`, poprzedni nagłówek przy `changed`), zgodność ze starym pinem. Samodzielnie wdrażalne. | S |
| K2 | **Format i łańcuch:** `RetiredKey`, `cleanRetired`, opakowanie i przepakowanie w `vault.ts` (czyste funkcje + testy wektorów), `rekeyVault` z trzecim argumentem, kopia lokalna, zerowanie buforów. Bez ścieżki odczytu. | M |
| K3 | **Odzysk spóźnionego zapisu:** ścieżka 3.4 z CAS, limit prób, dziennik, komunikat „Odzyskano N notatek zapisanych starym hasłem”. | M |
| K4 | **Dwa skarbce:** przepływ 3.5 z interfejsem; wygaszanie 3.6. | M |
| K5 | **Opcja „hasło mogło wyciec”** z opisem skutków; test, że po niej stary szyfrogram jest odrzucany. | S |
| K6.1 | **Załączniki — rdzeń:** `vaultFiles.ts` (szyfrowanie, odszyfrowanie, format `NV1`), testy wektorów, limity. | M |
| K6.2 | **Załączniki — przechowywanie:** `vaultBlobs` w modelu notatki, odśmiecanie, `imageSync`, przekaźnik, kopia i przywracanie; test „pole z przyszłości przeżywa edycję”. | M |
| K6.3 | **Załączniki — interfejs:** dodawanie (plik, aparat, wklejenie), miniatury, podgląd, pobranie, usuwanie, stan przy zablokowanym skarbcu; `SCHEMA_VERSION` 3 i bramka. | M |
| K7 | **Przegląd końcowy** `security-reviewer` na całym diffie, `opis.md` (dział Skarbiec), aktualizacja `docs/model-zagrozen.md` i statusów w `plan-skarbiec-2026-10-25.md`. | S |

## 6. Testy wymagane (lista z odrzuconego przeglądu, rozszerzona)

1. Spóźniony zapis po zmianie hasła — odzyskany i przeszyfrowany; na drugim urządzeniu też czytelny.
2. Łańcuch przez dwie i trzy epoki; czwarty wpis wypiera najstarszy.
3. Dwa skarbce offline — odzysk z poprzedniego nagłówka; błędne hasło podlega dławieniu.
4. Podrzucone wpisy: zły kształt, 4 wpisy, `retiredAt` z przyszłości, epoka ≥ bieżącej, wpis opakowany obcym kluczem, powtórzony stary wpis — wszystkie pominięte, jeden wpis w dzienniku, odblokowanie działa.
5. Wyścigi: edycja w trakcie odzysku (CAS odmawia, treść użytkownika wygrywa); blokada w trakcie; zmiana hasła w trakcie; dwie karty.
6. Starszy klient zmienia hasło — wpisy odpadają, nic się nie psuje. Starszy klient przy istniejącym `retired` — odblokowuje normalnie.
7. Opcja „hasło wyciekło” — `retired` puste, szyfrogram pod starym kluczem trafia do `failed`.
8. Sekrety: żaden log ani raport diagnostyczny nie zawiera klucza, hasła, kodu; bufory wyzerowane (test na atrapie).
9. Zalew śmieciowych szyfrogramów — limit prób działa, interfejs odpowiada.
10. Załączniki: obieg szyfruj–odszyfruj; zmieniony bajt blobu → błąd; zmiana hasła nie zmienia blobów; odśmiecanie nie kasuje używanych; kopia i przywrócenie; przekaźnik przenosi; blokada skarbca odwołuje adresy `blob:`; plik 20 MB na telefonie bez awarii karty.
11. Kopia JSON z `retired` i załącznikami — import na czystym urządzeniu.

## 7. Decyzje właściciela

- **KR-1:** KDF — zostaje PBKDF2 600 000 (zalecane teraz: zgodne z zaleceniami OWASP, bez nowej zależności), czy dodać Argon2id przez WebAssembly (odporniejszy na łamanie na kartach graficznych; koszt: paczka ładowana przy odblokowaniu, nowe pole `kdf` i bramka formatu). Ma znaczenie, bo metadane skarbca widzi każdy, kto zna kod synchronizacji.
- **KR-2:** jak długo trzymać wycofany klucz (zalecane 90 dni).
- **KR-3:** limity załączników (20 MB, 20 plików).
- **KR-4:** czy „hasło mogło wyciec” ma być pytaniem przy każdej zmianie hasła, czy opcją w ustawieniach zaawansowanych.

## 8. Kolejność

K0 → K0.1 → K1 → K2 → K3 → K5 → K4 → K6.1 → K6.2 → K6.3 → K7. K1 i K6.1 można robić niezależnie od reszty. Każdy etap: Vitest (`vault.test.ts`, `privateNotes.test.ts`, nowe), `npm run typecheck`, przegląd `security-reviewer`.

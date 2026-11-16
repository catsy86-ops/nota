# KSeF Etap 2 — serwer wysyłkowy `ksef-server/` (plan, 2026-11-16)

> **Status:** projekt przed kodem (zlecenie Z-3 z `zlecenia-fable-2026-11-15.md`). Kodu nie ma. Przed pierwszą linią: przegląd agenta `security-reviewer` i decyzje D-K3…D-K5 z końca dokumentu.
> **Źródła:** fakty o API sprawdzone 2026-11-16 w `github.com/CIRFMF/ksef-docs` (gałąź `main`) i w `api.ksef.mf.gov.pl/docs/v2/openapi.json` — oznaczone **[DOK]**. **[TEST]** — nie ma tego w dokumentacji, trzeba sprawdzić na środowisku testowym (krok E2.0). **[projekt]** — decyzja tego planu.
> **Zakres:** wysyłka faktur już wystawionych w Etapie 1, status, UPO. Poza zakresem: offline24 i kod QR II (D-K2), pobieranie faktur zakupowych, sesje wsadowe, XAdES.

## 1. Co się zmienia względem uwag z Zadania 3

Sprawdzenie dokumentacji zmieniło cztery z dziesięciu wcześniejszych uwag:

| Uwaga | Było | Jest |
|---|---|---|
| 1 (podwójna wysyłka) | Ponowienie nigdy nie wysyła drugi raz. | Ponowna wysyłka jest bezpieczna jako **ostatni** krok odzyskiwania: KSeF odpowiada statusem 440 i podaje `originalKsefNumber` oraz `originalSessionReferenceNumber` **[DOK]**. Najpierw i tak pytamy o status. |
| 5–6 (data) | Faktura bez sieci „czeka na wysyłkę”. | Gdy dzień `P_1` jest wcześniejszy niż dzień wysyłki, KSeF **sam oznacza fakturę jako offline** **[DOK]**. Wysyłka dzień później nie jest więc zwykłą wysyłką online — patrz §6 i decyzja D-K3. |
| 9 (walidacja XSD na serwerze) | Serwer sprawdza XSD. | Serwer robi kontrolę strukturalną bez XSD (brak walidatora XSD w Node bez modułów natywnych); zgodność ze schemą pilnuje test w repo aplikacji, a ostatecznie KSeF (statusy 430/450). |
| 1 (klucz idempotencji) | Tylko SHA-256 XML-a. | Skrót **i** drugi indeks po numerze: KSeF rozpoznaje duplikat po `Podmiot1:NIP` + `RodzajFaktury` + `P_2`, globalnie, przez 10 lat **[DOK]**. |

## 2. Fakty o API, na których stoi projekt [DOK]

**Uwierzytelnienie tokenem KSeF**

1. `POST /auth/challenge` → `challenge`, `timestampMs`; wyzwanie ważne 10 minut.
2. `GET /security/public-key-certificates` → certyfikat z `usage` zawierającym `KsefTokenEncryption`, ważny, o najpóźniejszym `validFrom`.
3. `POST /auth/ksef-token` (202): `challenge`, `contextIdentifier {type: "Nip", value}`, `encryptedToken` = Base64(RSA-OAEP, SHA-256, MGF1-SHA-256 z napisu `{token}|{timestampMs}`), opcjonalnie `publicKeyId`. Odpowiedź: `referenceNumber`, `authenticationToken`.
4. `GET /auth/{referenceNumber}` z `Bearer authenticationToken`, aż `status.code` = 200 (100 — w toku, 400 — niepowodzenie).
5. `POST /auth/token/redeem` → `accessToken` i `refreshToken`, każdy z `validUntil`. Jednorazowe.
6. `POST /auth/token/refresh` z `Bearer refreshToken` → nowy `accessToken`. Token odświeżania ważny do 7 dni; czas życia `accessToken` — tylko z `validUntil`.

Kody 400: 21111 (złe wyzwanie), 21470 (nieznany albo wycofany klucz — pobrać certyfikaty ponownie), 21301 (brak autoryzacji, w tym „Token KSeF został unieważniony”), 21304, 21405.

**Sesja interaktywna**

- `POST /sessions/online` (201): `formCode {systemCode: "FA (3)", schemaVersion: "1-0E", value: "FA"}`, `encryption {encryptedSymmetricKey, initializationVector}`. Klucz AES-256 i IV 128 bitów; klucz szyfrowany RSA-OAEP (SHA-256, MGF1-SHA-256) certyfikatem `SymmetricKeyEncryption`. Odpowiedź: `referenceNumber`, `validUntil`. Sesja żyje 12 godzin; do 10 000 faktur.
- `POST /sessions/online/{ref}/invoices` (202): `invoiceHash` (SHA-256 w Base64), `invoiceSize`, `encryptedInvoiceHash`, `encryptedInvoiceSize`, `encryptedInvoiceContent` (AES-256-CBC, PKCS#7, Base64), `offlineMode` (domyślnie `false`). Odpowiedź: `referenceNumber` faktury. Przetwarzanie jest asynchroniczne.
- `POST /sessions/online/{ref}/close` (204) — uruchamia zbiorcze UPO.
- Kody 400 wysyłki: 21173 (brak sesji), 21180 (status sesji nie pozwala), 21184 (sesja chwilowo niedostępna), 21402 (zły rozmiar), 21403 (zły skrót), 21155 (limit faktur), 21405.

**Status faktury** — `GET /sessions/{ref}/invoices/{invRef}`: `status {code, description, details[], extensions{}}`, `invoiceHash`, `invoiceNumber`, `ksefNumber`, `acquisitionDate`, `invoicingDate`, `invoicingMode` (Online | Offline), `upoDownloadUrl`, `upoDownloadUrlExpirationDate`.

| Kod | Znaczenie | Klasa w projekcie |
|---|---|---|
| 100, 150 | przyjęta do przetwarzania, w toku | czekać |
| 200 | sukces | **przyjęta** |
| 440 | duplikat (`extensions.originalKsefNumber`, `originalSessionReferenceNumber`) | sprawdzić skrót oryginału (§5) |
| 430, 450 | błąd weryfikacji pliku, błąd semantyki | **odrzucona** (trwale) |
| 410, 415 | zły zakres uprawnień, załącznik | **odrzucona**, błąd konfiguracji |
| 435 | błąd odszyfrowania | ponowić w nowej sesji (błąd po naszej stronie) |
| 405, 550 | anulowane z powodu błędu sesji / przez system | ponowić w nowej sesji |
| 500 | nieznany błąd | ponowić z opóźnieniem, po 3 próbach stan „do wyjaśnienia” |

Statusy sesji: 100 otwarta, 170 zamknięta, 200 przetworzona, 415 błąd odszyfrowania klucza, 440 anulowana (bez faktur), 445 brak poprawnych faktur.

**UPO** — XML podpisany przez MF. Najprościej: `GET` na `upoDownloadUrl` ze statusu faktury (bez nagłówka `Authorization`, poza limitami, link wygasa). Zapasowo `GET /sessions/{ref}/invoices/ksef/{ksefNumber}/upo`. Nagłówek `x-ms-meta-hash` = SHA-256 UPO w Base64.

**Reguły weryfikacji** — XML 1.0, UTF-8 bez BOM, bez instrukcji przetwarzania; do 1 000 000 bajtów; `P_1` nie później niż dzień przyjęcia; suma kontrolna NIP sprawdzana tylko na produkcji.

**Numer KSeF** — 35 znaków `NIP-RRRRMMDD-12 znaków hex-2 znaki hex`; ostatnie dwa to CRC-8 (wielomian `0x07`, start `0x00`) z pierwszych 32 znaków.

**Kod QR I** — `{host}/invoice/{NIP}/{DD-MM-RRRR}/{SHA-256 pliku w Base64URL}`; hosty: `qr-test.ksef.mf.gov.pl`, `qr-demo.ksef.mf.gov.pl`, `qr.ksef.mf.gov.pl`.

**Limity** (na parę kontekst + IP; 429 z `Retry-After` w sekundach): otwarcie sesji 10/s, 30/min, 120/h; wysyłka 10/s, 30/min, 180/h; status faktury 30/s, 120/min, 1200/h; lista sesji 5/s, 10/min, 60/h; lista faktur sesji 10/s, 20/min, 200/h; zapytanie o metadane 8/s, 16/min, **20/h**. Środowisko testowe ma limity 10× wyższe, demo — jak produkcja.

**Błędy** — z nagłówkiem `X-Error-Format: problem-details` błędy 400 przychodzą jako `application/problem+json`; 401, 403 i 410 zawsze. Bez nagłówka: `exception.exceptionDetailList[].exceptionCode`.

**Token KSeF** — `POST /tokens` po uwierzytelnieniu XAdES; zwracany raz; zestaw uprawnień niezmienny; unieważnienie `DELETE /tokens/{ref}`. Wysyłka wymaga `InvoiceWrite`. Terminu ważności w schemie nie ma.

## 3. Architektura [projekt]

```
PWA (telefon)  ──HTTPS + sekret──►  ksef-server  ──HTTPS──►  API KSeF
  rekord w studyInvoices            stan na fakturę            sesja, status, UPO
  status w studyInvoiceStatus       token KSeF w sekretach
```

- Nowy katalog `ksef-server/`, układ jak `relay-server/`: `core.js` (czyste funkcje: walidacja, maszyna stanów, szyfrowanie), `ksefClient.js` (wywołania API z wstrzykiwanym `fetch`), `server.js` (HTTP, plik stanu, pętla robocza), testy `node --test`. Node ≥ 18.18, bez zależności — `node:crypto` ma RSA-OAEP i AES-256-CBC.
- Osobny proces i osobny katalog danych. Nie rozszerzamy `push-server` ani `relay-server`: tamte nie trzymają niczego, czym można działać w imieniu firmy.
- Uruchamianie lokalne, jak pozostałe serwery (ADR-4) — patrz D-K4.
- Serwer jest jedynym miejscem, które zna token KSeF i rozmawia z KSeF. Aplikacja zna tylko adres serwera i sekret dostępu.

### 3.1 API serwera

Wszystkie trasy wymagają `Authorization: Bearer <sekret>`; odpowiedzi z `Cache-Control: no-store`.

| Trasa | Działanie |
|---|---|
| `POST /v1/invoices` `{xml, hash}` | Walidacja (§7), zapis stanu `nowa`, odpowiedź 202 ze stanem. Ten sam skrót drugi raz → 200 z bieżącym stanem, bez nowej wysyłki. Inny skrót, ten sam numer i rodzaj → 409 `numer-zajety`. |
| `GET /v1/invoices/{hash}` | Bieżący stan (§4). Nieznany skrót → 404. |
| `GET /v1/invoices/{hash}/upo` | UPO jako XML; 404, dopóki go nie ma. |
| `GET /v1/health` | Środowisko, ostatnie cztery cyfry NIP, czy uwierzytelnienie w KSeF działa, liczba faktur w kolejce. Bez danych faktur. |

Stan zwracany aplikacji: `{state, env, number, ksefNumber?, acquisitionDate?, invoicingMode?, error?: {code, message}, updatedAt}`.

### 3.2 Dane serwera

- `DATA_DIR/ksef-{env}.json` — mapa skrót → wpis; osobny plik na środowisko, więc numer z testu nie może trafić do stanu produkcyjnego.
- `DATA_DIR/xml-{env}/{hash}.xml` — XML czekający na przyjęcie. **Kasowany po stanie `przyjęta` albo `odrzucona`** (minimalizacja danych osobowych); zostaje skrót, numer, numer KSeF i UPO.
- `DATA_DIR/upo-{env}/{hash}.xml`.
- Zapis **synchroniczny, przez plik tymczasowy i `rename`, przed każdym wywołaniem KSeF zmieniającym stan** — inaczej niż w przekaźniku, który zapisuje partiami. Tu utrata ostatniej pół sekundy oznacza zgubiony numer referencyjny.
- `accessToken` i `refreshToken` tylko w pamięci procesu. Po restarcie serwer uwierzytelnia się od nowa.

## 4. Maszyna stanów faktury [projekt]

```
nowa ──► wysylana ──► przyjeta          (końcowy; nr KSeF, UPO)
              │  └──► odrzucona         (końcowy; kod i opis z KSeF)
              └─────► do-wyjasnienia    (wymaga człowieka; nie ponawia się sam)
```

Wpis: `{hash, number, kind, p1, state, sessionRef?, invoiceRef?, attempt, ksefNumber?, acquisitionDate?, invoicingMode?, upoHash?, error?, createdAt, updatedAt}`.

Kroki pętli roboczej dla jednej faktury (jedna faktura naraz na cały serwer — wolumen to kilka faktur dziennie, a kolejka szeregowa usuwa wyścigi):

1. `nowa` → zapis `wysylana, attempt+1` (jeszcze bez `sessionRef`).
2. Otwarcie sesji → **zapis `sessionRef`**.
3. Wysyłka faktury → **zapis `invoiceRef`**.
4. Odpytywanie statusu: po 1, 2, 4, 8, 15, 30 s, potem co 60 s do 10 minut, potem co 15 minut. 429 → czekać `Retry-After`.
5. Kod 200 → zapis `przyjeta` z numerem KSeF (po kontroli wzorca, CRC-8 i zgodności NIP) → pobranie UPO (osobny, ponawiany krok; brak UPO nie cofa stanu) → zamknięcie sesji (zawsze, w `finally`; błąd zamknięcia tylko do dziennika — sesja wygaśnie sama po 12 h).
6. Kod trwały → `odrzucona`. Kod przejściowy → nowa sesja, najwyżej 3 próby, potem `do-wyjasnienia`.

Jedna sesja na fakturę. Limit 120 sesji na godzinę jest dwa rzędy wielkości ponad potrzebami, a sesja z jedną fakturą upraszcza odzyskiwanie.

### 4.1 Odzyskiwanie po przerwaniu

Przy starcie serwer przegląda wpisy `wysylana`:

| Co jest zapisane | Co robi |
|---|---|
| `sessionRef` i `invoiceRef` | Pyta o status faktury i idzie dalej od kroku 4. |
| tylko `sessionRef` (padł między wysyłką a zapisem) | `GET /sessions/{ref}/invoices`, szuka pozycji o naszym `invoiceHash`. Jest → uzupełnia `invoiceRef`. Nie ma → faktura nie doszła; zamyka sesję i zaczyna od kroku 2. |
| nic (padł w trakcie otwierania sesji) | Nic nie zostało wysłane; zaczyna od kroku 2. Osierocona sesja bez faktur skończy się statusem 440. |

Sieć padła w trakcie żądania wysyłki (nie wiadomo, czy doszło): to samo co wiersz drugi. Dopiero gdy lista faktur sesji jest niedostępna (sesja wygasła, błąd 21173), serwer wysyła ponownie w nowej sesji i polega na statusie 440.

## 5. Duplikaty [projekt]

Status 440 **nie oznacza** automatycznie „przyjęta”. Znaczy tylko, że w KSeF jest faktura o tym samym NIP, rodzaju i numerze. Dwa przypadki:

- **Ten sam plik** (nasza wcześniejsza wysyłka, której wynik zgubiliśmy). Serwer pobiera `GET /sessions/{originalSessionReferenceNumber}/invoices`, znajduje pozycję o `ksefNumber` = `originalKsefNumber` i porównuje jej `invoiceHash` z naszym. Zgodny → `przyjeta` z tym numerem.
- **Inny plik pod tym samym numerem** (seria użyta na dwóch telefonach, F-9; albo numer nadany drugi raz, F-4). Skrót niezgodny albo oryginalna sesja niedostępna → `odrzucona` z kodem `duplikat-inna-tresc`. Aplikacja pokazuje: „W KSeF jest już inna faktura o tym numerze. Wystaw fakturę ponownie z nowym numerem.” Rekord w `studyInvoices` zostaje — numer jest spalony.

Zanim cokolwiek pójdzie do KSeF, serwer sam odmawia drugiego pliku pod numerem, który ma w stanie `wysylana` albo `przyjeta` (indeks `kind + number`, odpowiedź 409). To łapie duplikat lokalnie i od razu.

**Wymaganie wobec aplikacji:** odporna numeracja (Z-2.2, Z-2.3 — zrobione) i reszta Z-2.4 przed pierwszą wysyłką produkcyjną.

## 6. Data wystawienia i wysyłka następnego dnia

Fakty **[DOK]**: datą wystawienia jest wyłącznie `P_1`. `P_1` późniejsze niż dzień przyjęcia → odrzucenie. `P_1` wcześniejsze niż dzień wysyłki przy `offlineMode: false` → KSeF sam oznacza fakturę jako offline (`invoicingMode: "Offline"`). Faktura offline ma termin dosłania do następnego dnia roboczego po dacie wystawienia, a przekazana nabywcy poza KSeF wymaga dwóch kodów QR, w tym kodu II podpisanego certyfikatem typu Offline, którego w Etapie 2 nie mamy.

Rekord faktury jest niezmienny i `P_1` jest w XML-u, więc daty nie da się „przestawić na dzień wysyłki”. Konsekwencje dla projektu:

1. **Wysyłka od razu po wystawieniu.** Aplikacja woła `POST /v1/invoices` w tym samym kroku co `issueInvoice`, gdy jest sieć i skonfigurowany serwer. Kolejka po stronie aplikacji istnieje tylko na brak sieci.
2. **Faktura niewysłana nie jest wręczana jako faktura.** PDF faktury w stanie innym niż `przyjeta` dostaje wyraźny napis „NIEWYSŁANA DO KSeF” zamiast „OFFLINE” pod kodem QR. Po przyjęciu PDF pokazuje numer KSeF.
3. **Wysyłka z datą wczorajszą lub starszą** — serwer zwraca 409 `data-wczesniejsza` i nie wysyła, dopóki aplikacja nie powtórzy żądania z `allowLate: true` po potwierdzeniu przez użytkownika. To decyzja **D-K3**.
4. **Data z przyszłości** — serwer odmawia (422 `data-z-przyszlosci`); aplikacja powinna to blokować już przy wystawianiu (uwaga 6 z Zadania 3, do zlecenia razem z resztą Z-2.4).
5. Dzień liczony w strefie `Europe/Warsaw` po stronie serwera. Czy KSeF liczy tak samo — **[TEST]**; do tego czasu serwer nie wysyła między 23:55 a 00:05.

## 7. Walidacja po stronie serwera [projekt]

Serwer nie ufa aplikacji. `POST /v1/invoices` odrzuca (422), gdy:

- treść żądania > 1,5 MB; XML > 1 000 000 bajtów UTF-8; BOM; znaki spoza XML 1.0;
- XML zawiera `<!DOCTYPE`, `<!ENTITY` albo instrukcję przetwarzania inną niż prolog `<?xml … encoding="UTF-8"?>`;
- SHA-256 bajtów XML-a ≠ `hash` z żądania;
- element główny i przestrzeń nazw nie są tymi z FA(3); `KodFormularza` i `WariantFormularza` inne niż oczekiwane;
- `Podmiot1/…/NIP` ≠ NIP z konfiguracji serwera (dokładnie jeden dozwolony sprzedawca);
- brak `P_1`, `P_2`, `RodzajFaktury`; `P_2` dłuższe niż 256 znaków; `RodzajFaktury` spoza `VAT`, `KOR`.

Pola wyciąga wąski, własny skaner znaczników (bez parsera DOM i bez rozwijania encji) — XML pochodzi z naszego generatora, więc ma znany kształt; wszystko, co od niego odbiega, jest odrzucane. Bajty wysyłane do KSeF to dokładnie bajty otrzymane: żadnej ponownej serializacji, bo skrót jest w kodzie QR i w rekordzie.

Zgodność ze schemą XSD: test Vitest w repo aplikacji (`xmllint-wasm` jako zależność deweloperska, schema w `src/lib/ksef/__fixtures__/`) na zestawie faktur wzorcowych — zwykła, korekta, zwolnienie, odwrotne obciążenie. Poza paczką produkcyjną.

Odpowiedzi KSeF też są niezaufane: numer KSeF sprawdzany wzorcem, CRC-8 i NIP-em; UPO do 256 KB, bez `DOCTYPE`, zapisywane jako bajty i nigdy nie parsowane do DOM; `upoDownloadUrl` tylko `https:` i pobierany z `redirect: "error"`, bez nagłówka `Authorization`.

## 8. Bezpieczeństwo [projekt]

**Sekrety serwera** — z pliku wskazanego przez `KSEF_TOKEN_FILE` (nie ze zmiennej z wartością, żeby token nie trafił do listy procesów ani dziennika powłoki). Konfiguracja: `KSEF_ENV` (`test` domyślnie; `prod` wymaga dodatkowo `KSEF_PROD_CONFIRM=<NIP>`), `KSEF_NIP`, `DATA_DIR`, `ALLOWED_ORIGINS`, `PORT`. Adresy API i hosty QR są stałymi w kodzie, wybieranymi przez `KSEF_ENV`; nie ma zmiennej z adresem.

**Token KSeF** — tylko uprawnienie `InvoiceWrite` (D-K5). Wystarcza do sesji, statusów i UPO; odzyskiwanie z §4.1 i §5 nie potrzebuje `InvoiceRead`. Osobny token na każde środowisko.

**Dostęp aplikacji do serwera** — sekret 32 losowych bajtów (Base64URL), generowany przy pierwszym starcie i zapisywany w `DATA_DIR/access.key` (jako SHA-256; jawna wartość wypisana raz na konsolę). Porównanie przez `timingSafeEqual` na skrótach. Kod synchronizacji przekaźnika nie daje dostępu. W aplikacji sekret leży w `localStorage` pod kluczem spoza `SETTINGS_KEYS` — nie wchodzi do kopii zapasowej, Yjs ani przekaźnika.

**Ograniczenia** — 30 żądań na minutę na adres; 10 nieudanych uwierzytelnień → blokada adresu na 15 minut; najwyżej 50 nowych faktur na dobę (konfigurowalne); kolejka do 200 wpisów. `Origin` sprawdzany z listą, ale traktowany jako filtr, nie uwierzytelnienie. Żądania bez TLS przyjmowane tylko z `localhost`.

**Dzienniki** — bez XML-a, tokenów, nazw i adresów stron; NIP skracany do czterech cyfr; z faktury tylko skrót (pierwsze 8 znaków), numer i kody statusów.

**Zagrożenia, które zostają** (do oceny przez `security-reviewer`):

- Kto przejmie telefon z sekretem, może wysłać do KSeF dowolną fakturę z NIP-em sprzedawcy. Ogranicza to limit dobowy i możliwość wymiany sekretu (`--rotate-key`), nie usuwa.
- Kto przejmie komputer z serwerem, ma token KSeF. Odpowiedź: unieważnienie tokenu w Aplikacji Podatnika; README musi opisać tę procedurę.
- Peer w Yjs może dopisać fałszywy status (§9) — dlatego status z Yjs jest tylko podglądem.

## 9. Zmiany w aplikacji [projekt]

- **`src/lib/ksef/ksefServer.ts`** — klient serwera: `submit(record)`, `status(hash)`, `upo(hash)`; adres i sekret z `localStorage` (`notatnik-ksef-server`, `notatnik-ksef-secret`), `redirect: "error"`, limit czasu 15 s.
- **Mapa Yjs `studyInvoiceStatus`** — klucze `{id}:przyjeta` i `{id}:odrzucona`, każdy zapisywany raz i nigdy nie kasowany; wartość `{ksefNumber, acquisitionDate, invoicingMode, upo?, checkedAt}` albo `{code, message, checkedAt}`. Widok liczy stan: jest `:przyjeta` → przyjęta, inaczej jest `:odrzucona` → odrzucona, inaczej niewysłana. Osobne klucze zamiast jednego wpisu, bo `Y.Map` rozstrzyga równoległe zapisy przez „ostatni wygrywa” i nie da się w nim wymusić reguły „przyjęta wygrywa”. UPO (do 64 KB) idzie do wpisu, żeby dowód przyjęcia był w kopii zapasowej, a nie tylko na serwerze.
- **Tylko środowisko produkcyjne trafia do Yjs.** Statusy z `test` i `demo` żyją w `localStorage` urządzenia. Aplikacja bierze środowisko z `GET /v1/health`, nie z własnego ustawienia, i pokazuje baner „ŚRODOWISKO TESTOWE”.
- **Stan `wysylana`** nie jest zapisywany w Yjs — to stan serwera, odpytywany na żądanie i po powrocie karty na pierwszy plan.
- **Zaufanie do statusu.** Status z Yjs jest oznaczany „niepotwierdzony”, dopóki to urządzenie nie dostanie go z serwera (`status(hash)`) albo nie sprawdzi numeru: wzorzec, CRC-8, NIP sprzedawcy. To nie dowodzi przyjęcia — dowodem jest UPO.
- **`qr.ts`** — host kodu QR zależny od środowiska (dziś na stałe produkcyjny); podpis pod kodem: numer KSeF albo „NIEWYSŁANA DO KSeF”.
- **Korekta** — `issueCorrection` wypełnia `ksefNumber` z mapy statusów. Korekta faktury w trakcie wysyłki jest blokowana; korekta faktury niewysłanej zostaje jak w Etapie 1 (bez numeru KSeF).
- **Ustawienia → Faktury** — adres serwera, sekret (pole typu hasło, wklejany ręcznie), przycisk „Sprawdź połączenie”.
- **Okno faktur** — stan przy każdej fakturze, „Wyślij do KSeF”, „Pobierz UPO”, komunikaty z tabeli §10.
- CSP bez zmian (`connect-src https:` już jest, ADR-2). Moduł ładowany leniwie; budżet paczki do sprawdzenia w `e2e/bundle.spec.ts`.

## 10. Tabela błędów

| Źródło | Sygnał | Stan | Co widzi użytkownik |
|---|---|---|---|
| aplikacja → serwer | brak sieci, limit czasu | bez zmian | „Brak połączenia z serwerem faktur. Faktura czeka na wysyłkę.” |
| serwer | 401 | bez zmian | „Zły sekret serwera faktur. Sprawdź Ustawienia.” |
| serwer | 409 `numer-zajety` | bez zmian | „Ten numer ma już inna faktura wysłana do KSeF.” |
| serwer | 409 `data-wczesniejsza` | bez zmian | Pytanie z D-K3. |
| serwer | 422 (walidacja §7) | bez zmian | „Faktura nie przeszła kontroli serwera: {powód}.” — błąd programu, do zgłoszenia. |
| serwer | 429 | bez zmian | „Za dużo żądań. Spróbuj za chwilę.” |
| KSeF, uwierzytelnienie | 21301, status 400 | faktury zostają `nowa` | „Token KSeF jest nieważny albo unieważniony. Wymień go na serwerze.” Serwer wstrzymuje pętlę do restartu. |
| KSeF | 21470 | — | Ponowne pobranie certyfikatów, jedna próba; bez komunikatu. |
| KSeF | 429 | — | Czekanie `Retry-After`; bez komunikatu. |
| KSeF | 5xx, błąd sieci | `wysylana` | „Wysyłanie…”; ponawianie po 5 s, 30 s, 2 min, 10 min, potem co 30 min. |
| KSeF, wysyłka | 21402, 21403 | `do-wyjasnienia` | „Błąd wysyłki (rozmiar albo skrót).” — błąd programu. |
| KSeF, wysyłka | 21173, 21180, 21184 | `wysylana` | Nowa sesja; bez komunikatu. |
| KSeF, status faktury | 200 | `przyjeta` | Numer KSeF, „Pobierz UPO”. |
| KSeF, status faktury | 440, skrót zgodny | `przyjeta` | Jak wyżej. |
| KSeF, status faktury | 440, skrót inny | `odrzucona` | „W KSeF jest już inna faktura o tym numerze. Wystaw ponownie z nowym numerem.” |
| KSeF, status faktury | 430, 450 | `odrzucona` | „KSeF odrzucił fakturę: {opis}.” Opis z `status.details`, skrócony do 300 znaków, jako tekst. |
| KSeF, status faktury | 410 | `odrzucona` | „Token KSeF nie ma uprawnienia do wystawiania faktur.” |
| KSeF, status faktury | 405, 435, 550 | `wysylana` → po 3 próbach `do-wyjasnienia` | „Wysyłanie…”, potem „Nie udało się wysłać. Sprawdź serwer.” |
| KSeF, status faktury | 500 | jak wyżej | jak wyżej |
| KSeF, UPO | 21178, link wygasł | `przyjeta` bez UPO | „UPO jeszcze niedostępne.”; ponawianie w tle. |

Faktura `odrzucona` z powodu treści (430, 450) nie trafiła do KSeF, więc jej numer nie jest tam zajęty. Rekord w aplikacji jest jednak niezmienny, a numer zużyty w lokalnej numeracji — poprawia się ją nową fakturą z nowym numerem. Lukę w numeracji trzeba opisać w `opis.md`.

## 11. Do sprawdzenia na środowisku testowym (E2.0)

Skrypt `ksef-server/scripts/smoke.mjs`, uruchamiany ręcznie z tokenem testowym, przed pisaniem serwera:

1. Pełne uwierzytelnienie tokenem; rzeczywisty czas życia `accessToken`.
2. Czy IV jest dołączany na początku szyfrogramu faktury, czy przekazywany tylko przy otwarciu sesji (przykład w OpenAPI: 6480 → 6496 bajtów, co pasuje do samego dopełnienia, ale dokumentacja tego nie mówi).
3. Czy UPO pojedynczej faktury jest dostępne przed zamknięciem sesji. Jeśli nie — krok 5 z §4 zmienia kolejność: zamknięcie, potem UPO.
4. Ta sama faktura wysłana drugi raz: kształt statusu 440 i czy lista faktur oryginalnej sesji jest dostępna po jej zamknięciu.
5. Faktura z `P_1` = wczoraj: `invoicingMode`, czy jest przyjmowana po terminie następnego dnia roboczego.
6. Faktura wysłana tuż przed i tuż po północy czasu polskiego: w której strefie KSeF liczy dzień.
7. Faktury wzorcowe z naszego generatora (zwykła, korekta, zwolnienie, odwrotne obciążenie) — czy przechodzą weryfikację semantyczną; przy okazji rozstrzyga F-10 i F-11 (Z-2.7).
8. Kształt `application/problem+json` dla błędu 400.

Wyniki dopisać do tego dokumentu w miejscu znaczników **[TEST]**.

## 12. Etapy i zlecenia

| # | Zlecenie | Dla | Rozmiar |
|---|---|---|---|
| E2.0 | Skrypt dymny z §11 i dopisanie wyników. Wymaga tokenu testowego od właściciela. | Opus | M |
| E2.1 | `ksef-server/core.js`: walidacja §7, maszyna stanów §4 jako czysta funkcja `(wpis, zdarzenie) → wpis`, szyfrowanie, CRC-8 numeru KSeF. Testy `node --test`, w tym wektory szyfrowania porównane z `openssl`. | Opus | M |
| E2.2 | `ksefClient.js` z wstrzykiwanym `fetch`; testy na atrapie: każdy wiersz tabeli §10, każdy wiersz odzyskiwania §4.1, oba przypadki duplikatu §5. | Opus | M |
| E2.3 | `server.js`: trasy §3.1, plik stanu, pętla robocza, limity, sekret. `security.test.js` jak w `push-server`: brak sekretów i XML-a w dziennikach, odmowa bez sekretu, blokada po 10 próbach. | Opus | M |
| E2.4 | Aplikacja: `ksefServer.ts`, `studyInvoiceStatus`, `qr.ts`, ustawienia, okno faktur. Vitest: zbieżność mapy statusów na dwóch `Y.Doc`; kopia zapasowa nie zawiera sekretu. | Opus (logika), Sonnet (UI) | M |
| E2.5 | Przegląd `security-reviewer` całości; poprawki. | — | S |
| E2.6 | Lista kontrolna przejścia na produkcję w `ksef-server/README.md`; ADR-8 w `docs/adr.md`; `opis.md`. | Sonnet | S |

Kolejność jest sztywna do E2.2 (E2.0 może zmienić §4). E2.3 i E2.4 mogą iść równolegle.

**Warunki wstępne w Etapie 1:** reszta Z-2.4 (limity 256/512, limit iloczynu, odmowa korekty bez zmian), blokada daty wystawienia z przyszłości, Z-2.7 (F-10, F-11).

## 13. Decyzje właściciela

| # | Pytanie | Rekomendacja |
|---|---|---|
| D-K3 | Faktura wystawiona wczoraj albo wcześniej i jeszcze niewysłana: wysyłać po potwierdzeniu (KSeF oznaczy ją jako offline), czy odmawiać i kazać wystawić nową z dzisiejszą datą? | **Wysyłać po potwierdzeniu**, z ostrzeżeniem o terminie następnego dnia roboczego. Odmowa zostawia spalony numer i fakturę, której nie da się już nigdy wysłać. Warunek: faktura niewysłana nie jest wręczana klientowi jako faktura (§6 pkt 2). Wymaga potwierdzenia u księgowej. |
| D-K4 | Gdzie działa serwer? ADR-4 mówi: lokalnie, bez hostingu. Wtedy wysyłka działa tylko, gdy komputer jest włączony i telefon ma do niego dostęp. | **Lokalnie na start** (zgodnie z ADR-4), z kolejką w aplikacji. Wysyłka „od razu” (§6 pkt 1) w praktyce oznacza wtedy „po powrocie do domu tego samego dnia” — jeśli to za mało, potrzebny jest hosting i zmiana ADR-4. |
| D-K5 | Token KSeF z samym `InvoiceWrite`? | **Tak.** `InvoiceRead` dodać dopiero z pobieraniem faktur zakupowych (Etap 3). |

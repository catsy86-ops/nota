# Przekaźnik synchronizacji (E2E)

Synchronizacja NOTKI działa peer-to-peer (`y-webrtc`), więc zmiany docierają tylko wtedy,
gdy oba urządzenia są online naraz. Przekaźnik trzyma **zaszyfrowany** log zmian, dzięki
czemu zmiana zrobiona na telefonie dociera na komputer, nawet gdy telefon jest już wyłączony.

## Co serwer wie, a czego nie wie

| Serwer widzi | Serwer NIE widzi |
|---|---|
| identyfikator pokoju (hash z kodu synchronizacji) | kod synchronizacji |
| hash tokenu dostępu (SHA-256, nie sam token) | klucz szyfrowania (wyprowadzany z kodu w przeglądarce) |
| zaszyfrowane bloby base64url, ich rozmiar i czas | treść notatek, tytuły, nazwy, obrazy w czytelnej postaci |
| numer kolejny wpisu | liczba notatek (poza przybliżeniem rozmiarem) |

Klucz szyfrowania i token dostępu wyprowadza przeglądarka z tego samego kodu (HKDF, różne
etykiety `info`). Przekaźnik nie może odszyfrować ani zapisu, ani odczytu.

## Model zagrożeń

- **Podsłuch sieci:** ruch idzie przez HTTPS/WSS; treść i tak jest zaszyfrowana AES-GCM.
- **Ciekawski z dostępem do serwera (admin, backup):** zobaczy identyfikatory pokojów, czasy
  i rozmiary zaszyfrowanych danych, ale nie treść. Hash tokenu nie pozwala zapisać do pokoju.
- **Ktoś, kto zna identyfikator pokoju:** bez tokenu nie odczyta ani nie zapisze (`401/403`).
  Identyfikator to 256 bitów, nie da się go zgadnąć. Pokój zakłada pierwszy zapis z tokenem;
  ktoś, kto zna identyfikator, mógłby zdążyć przed właścicielem, ale potrzebuje też kodu,
  żeby cokolwiek z tego zrozumieć, a sam pokój bez danych nie robi szkody.
- **Wyciek kodu synchronizacji:** kod daje dostęp do wszystkich danych pokoju. Trzeba go
  zmienić (nowy kod = nowy pokój); stary pokój wygasa po pół roku bez zapisu.
- **Przeciążenie / nadużycie:** limit zapytań na IP (`RATE_PER_MIN`), limit rozmiaru wpisu
  i pokoju, limit liczby pokoi, zamknięcie gniazd przy braku subskrypcji po 10 s.
- **Odpowiedzi serwera ujawniają istnienie pokoju:** nieznany pokój daje 404, zły token 403.
  Przy 256-bitowym identyfikatorze to nie jest realne ryzyko.

Stan do przeglądu: `security-review` przed wdrożeniem.

## Protokół

| Trasa | Co robi |
|---|---|
| `GET /health` | `{ok}` — bez żadnych danych (S4.6) |
| `GET /rooms/:id/updates?since=n` | wpisy o numerze > n (najwyżej 500), `last`, `hasMore`, `epoch` |
| `POST /rooms/:id/updates` | `{data, epoch?}` dopisuje wpis, zwraca `{seq, last, epoch}`; `412`, gdy podana `epoch` nie jest epoką pokoju (albo pokoju nie ma) |
| `PUT /rooms/:id/snapshot` | `{upto, data, epoch?}` zastępuje wpisy ≤ upto jednym (kompaktowanie); nie zakłada pokoju (`404`); `412` przy innej `epoch` |
| `DELETE /rooms/:id` | usuwa pokój razem z blobami (token pokoju); zamyka jego gniazda WebSocket. Wywołuje go „Odłącz i usuń z przekaźnika” w Ustawieniach → Sync |
| `PUT /rooms/:id/blobs/:bid` | surowe bajty zaszyfrowanego bloba (obraz/załącznik), `bid` = HMAC z hasha treści; ponowny zapis tego samego `bid` nic nie zmienia |
| `GET` / `HEAD /rooms/:id/blobs/:bid` | pobranie bloba (`404`, gdy go nie ma) albo samo sprawdzenie, czy jest |
| `WS /ws` | po połączeniu wysyłasz `{type:"subscribe", room, token}`; serwer odpowiada `{type:"ready", last, epoch}` albo zamyka z kodem 4003; po każdym zapisie przychodzi `{type:"updated", last, epoch}` |

**Epoka pokoju** (`epoch`, 32 znaki hex) jest losowana przy założeniu pokoju. Pokój usunięty (`DELETE`, 180 dni bez zapisu, utrata danych serwera) i założony od nowa ma inną epokę i numery wpisów od 1. Klient, który widzi inną epokę niż zapisana, zeruje kursor i wysyła pełny stan dokumentu — bez tego nowe urządzenia dostałyby samą różnicę bez poprzedników.

Token idzie w nagłówku `Authorization: Bearer …` (HTTP) lub w pierwszej wiadomości (WS),
nigdy w adresie, żeby nie trafiał do logów proxy.

Pierwszy zapis do pokoju ustawia jego token. Później wymagany jest ten sam token.

## Limity (`core.js`, `LIMITS`)

- wpis i migawka: 22 400 000 znaków base64 (ok. 16 MB);
- pokój: 50 MB zaszyfrowanych danych, 5000 wpisów (powyżej klient musi zrobić snapshot);
- serwer: 5000 pokoi (`MAX_ROOMS`); pokój nieruszany 180 dni znika; **młody pokój** (bez migawki, z jednym wpisem) znika po dobie bez zapisu — klient zakłada go wtedy od nowa z nową epoką i pełnym stanem;
- dysk: łącznie 20 GB dzienników i blobów (`MAX_TOTAL_BYTES`), zapis tylko przy co najmniej 512 MB wolnego miejsca (`MIN_FREE_BYTES`); powyżej — `507`, nie awaria;
- zapytania: 300/min na IP (`RATE_PER_MIN`); nowe pokoje: 20 na dobę na IP (`ROOMS_PER_IP_PER_DAY`), łącznie 5000 pokoi; ciało żądania do 1 MB;
- bloby: 24 MB na jeden (zaszyfrowany obraz do 20 MB), 300 MB (`MAX_ROOM_BLOB_BYTES`) i 5000 blobów na pokój;
- WebSocket: 20 gniazd na pokój, 4 KB na wiadomość.

## Uruchomienie

```bash
cd relay-server
npm install
npm start            # port 4466; PORT=xxxx, DATA_DIR=./data
npm test             # testy logiki (node:test)
```

Docker:

```bash
docker build -t notki-relay .
docker run -d -p 4466:4466 -v notki-relay:/data -e ALLOWED_ORIGINS=https://twoja-aplikacja.pl --restart unless-stopped notki-relay
```

Za reverse proxy (Caddy: `sync.twojadomena.pl { reverse_proxy localhost:4466 }`) ustaw
`TRUST_PROXY=1` **i** `TRUSTED_PROXY=<adres pośrednika>` (np. `172.18.0.2`, kilka po przecinku), żeby limit
działał na prawdziwych adresach klientów. `X-Forwarded-For` jest brany tylko z połączeń od tego adresu, więc
klient łączący się z pominięciem pośrednika nie poda sobie adresu. `TRUST_PROXY=1` bez `TRUSTED_PROXY` zatrzymuje
start. Przy `TRUST_PROXY=0` i żądaniach z `X-Forwarded-For` serwer raz ostrzega w logu.

Konfiguracja produkcyjna (`NODE_ENV=production`) wymaga `ALLOWED_ORIGINS` z adresami aplikacji — bez listy albo z
`*` serwer nie wystartuje. Liczbowe zmienne (`MAX_ROOMS`, `MAX_ROOM_BLOB_BYTES`, `MAX_TOTAL_BYTES`,
`MIN_FREE_BYTES`, `CACHE_BYTES`, `RATE_PER_MIN`, `ROOMS_PER_IP_PER_DAY`) muszą być dodatnimi liczbami całkowitymi;
zła wartość też zatrzymuje start (`config.js`).

**Po odtworzeniu danych z kopii zapasowej** uruchom serwer raz z `NEW_EPOCHS=1`. Każdy pokój dostaje wtedy nową epokę, a klienci przy kontakcie wysyłają pełny stan. Bez tego starsza kopia wyglądałaby u klientów jak cofnięcie stanu: dostaliby ostrzeżenie „Serwer pośredniczący cofnął się do starszego stanu” (S2.3). Przed kolejnym startem usuń zmienną.

## Dane na dysku (`storage.js`)

```
DATA_DIR/rooms/<id>/room.json   tożsamość: skrót tokenu, epoka, data założenia — zapisywana raz
DATA_DIR/rooms/<id>/meta.json   liczniki (last, count, bytes, touched, logSize) — z opóźnieniem 1 s
DATA_DIR/rooms/<id>/log.ndjson  dziennik: jeden zaszyfrowany wpis na linię, tylko dopisywany
DATA_DIR/blobs/<id>/<bid>       bloby
```

- **Dopisanie** to jedna linia w dzienniku, zapisana przed odpowiedzią — potwierdzony wpis jest na dysku.
  Koszt nie zależy od rozmiaru pokoju ani liczby pokoi. Migawka: nowy dziennik w pliku tymczasowym, zmiana nazwy.
- **Po awarii:** dziennik jest źródłem prawdy. Brak `meta.json` albo niezgodny `logSize` → liczniki odtwarzane
  z dziennika, urwana albo uszkodzona linia odrzucana (dziennik zapisywany od nowa z poprawnych wpisów). Pliki
  `*.tmp` po przerwanej migawce są usuwane przy starcie. Bloby liczone z katalogu.
- **Pamięć:** przy starcie tylko `room.json` i `meta.json`; wpisy w pamięci podręcznej LRU (`CACHE_BYTES`,
  domyślnie 256 MB), pokój większy niż jej ćwierć jest czytany strumieniem.
- **Kolejka na pokój:** zapisy i odczyty jednego pokoju po kolei; różne pokoje nie czekają na siebie.
- **Migracja:** stary `relay.json` jest przy pierwszym starcie rozbijany na katalogi i zostaje jako `relay.json.bak`.
- Bez `fsync`: wpis przeżywa zabicie procesu, ale awaria systemu operacyjnego może zgubić ostatnie wpisy
  (klienci wysyłają je ponownie — pełny stan przy nowej epoce albo zwykłe ponowienie).

## Pliki

- `core.js` — czysta logika (tokeny, liczniki, snapshot, limity), bez I/O; `core.test.js`;
- `storage.js` — dziennik na dysku, odtwarzanie po awarii, pamięć podręczna, limity łączne; `storage.test.js`
  (test obciążenia 200 pokoi × 2000 wpisów: `LOAD=1 node --expose-gc --test storage.test.js`);
- `config.js` — zmienne środowiska i kontrola konfiguracji; `config.test.js`;
- `server.js` — HTTP i WebSocket; `server.test.js` (prawdziwy proces: odporność, limity, odmowa startu).

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
| `GET /health` | `{ok, rooms}` |
| `GET /rooms/:id/updates?since=n` | wpisy o numerze > n (najwyżej 500), `last`, `hasMore` |
| `POST /rooms/:id/updates` | `{data}` dopisuje wpis, zwraca `{seq, last}` |
| `PUT /rooms/:id/snapshot` | `{upto, data}` zastępuje wpisy ≤ upto jednym (kompaktowanie) |
| `PUT /rooms/:id/blobs/:bid` | surowe bajty zaszyfrowanego bloba (obraz/załącznik), `bid` = HMAC z hasha treści; ponowny zapis tego samego `bid` nic nie zmienia |
| `GET` / `HEAD /rooms/:id/blobs/:bid` | pobranie bloba (`404`, gdy go nie ma) albo samo sprawdzenie, czy jest |
| `WS /ws` | po połączeniu wysyłasz `{type:"subscribe", room, token}`; serwer odpowiada `ready` albo zamyka z kodem 4003; po każdym zapisie przychodzi `{type:"updated", last}` |

Token idzie w nagłówku `Authorization: Bearer …` (HTTP) lub w pierwszej wiadomości (WS),
nigdy w adresie, żeby nie trafiał do logów proxy.

Pierwszy zapis do pokoju ustawia jego token. Później wymagany jest ten sam token.

## Limity (`core.js`, `LIMITS`)

- wpis: 700 000 znaków base64 (ok. 512 KB);
- pokój: 50 MB zaszyfrowanych danych, 5000 wpisów (powyżej klient musi zrobić snapshot);
- serwer: 5000 pokoi; pokój nieruszany 180 dni znika;
- zapytania: 300/min na IP (`RATE_PER_MIN`); ciało żądania do 1 MB;
- bloby: 24 MB na jeden (zaszyfrowany obraz do 20 MB), 300 MB i 5000 blobów na pokój;
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
docker run -d -p 4466:4466 -v notki-relay:/data --restart unless-stopped notki-relay
```

Za reverse proxy (Caddy: `sync.twojadomena.pl { reverse_proxy localhost:4466 }`) ustaw
`TRUST_PROXY=1`, żeby limit działał na prawdziwych adresach klientów (obraz Dockera ma to
ustawione). Bez proxy i z `TRUST_PROXY=1` każdy może podać własny `X-Forwarded-For`.

## Pliki

- `core.js` — czysta logika (tokeny, log, snapshot, limity), bez I/O;
- `core.test.js` — 19 testów logiki;
- `server.js` — HTTP, WebSocket, zapis do `DATA_DIR/relay.json` (atomowo, co 0,5 s po zmianie); bloby jako pliki w `DATA_DIR/blobs/<pokój>/<bid>`.

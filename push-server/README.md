# Serwer powiadomień (Web Push)

Bez serwera NOTKI przypominają tylko przy otwartej aplikacji, bo timery działają w stronie.
Ten serwer wysyła powiadomienia o czasie także wtedy, gdy aplikacja jest zamknięta.

Jak to działa:

1. W **Ustawienia → Ogólne → Powiadomienia przy zamkniętej aplikacji** wpisujesz adres
   serwera i **token** (ten sam, co `PUSH_TOKEN` na serwerze) i stukasz **Włącz**. Telefon tworzy subskrypcję Web Push z kluczem serwera.
2. Aplikacja liczy terminy na 14 dni i wysyła je na serwer (`PUT /schedule`). Wysyła je ponownie
   przy każdej zmianie danych, co godzinę i przy chowaniu aplikacji. Lista obejmuje: przypomnienia
   notatek (także kolejne terminy serii), Grafik na jutro, „Raport dnia gotowy”, „Raport tygodnia
   gotowy”, problem w dzienniku budowy otwarty od 3 dni, materiał zamówiony 3 dni temu i nie
   dojechał oraz serwis dziś lub zaległy (karta budowy).
3. Serwer co 20 s sprawdza terminy i wysyła należne przez usługę push przeglądarki
   (FCM, Mozilla, Apple).

**Co jest na serwerze:** adres subskrypcji oraz terminy z tytułami i krótkim opisem.
Treść notatek tam nie trafia, a z notatek prywatnych nie trafiają nawet tytuły.
Wszystko leży w `DATA_DIR/store.json`.

## Uruchomienie

```bash
cd push-server
npm install
export PUSH_TOKEN=$(openssl rand -hex 24)     # wymagany; zapisz go, wpiszesz go w aplikacji
export ALLOWED_ORIGINS=https://notki.example  # adres, z którego działa aplikacja
npm start            # port 4455; zmień przez PORT=xxxx
npm test             # testy logiki i serwera (node:test)
```

**Serwer nie wystartuje bez `PUSH_TOKEN`** (min. 24 znaki). Do prób na własnym komputerze jest
`ALLOW_NO_AUTH=1` (bez uwierzytelniania; serwer nasłuchuje wtedy tylko na `127.0.0.1`).

Docker:

```bash
docker build -t notki-push .
docker run -d -p 127.0.0.1:4455:4455 -v notki-push:/data --restart unless-stopped \
  -e PUSH_TOKEN=<twój-token> -e ALLOWED_ORIGINS=https://notki.example -e TRUST_PROXY=1 notki-push
```

Port wystaw tylko przez reverse proxy z https (`127.0.0.1:` w poleceniu wyżej to wymusza).

Telefon łączy się z serwerem tylko przez **https**. Postaw go za reverse proxy z certyfikatem,
np. Caddy: `powiadomienia.twojadomena.pl { reverse_proxy localhost:4455 }`.
Wyjątek to `http://localhost`, który działa przy testach na komputerze.

## Ustawienia (zmienne środowiskowe)

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `PORT` | `4455` | port HTTP |
| `DATA_DIR` | `./data` | katalog na `store.json` i `vapid.json` |
| `PUSH_TOKEN` | — (**wymagany**) | wspólny sekret: aplikacja wysyła go w `Authorization: Bearer …`. Min. 24 znaki, losowy (`openssl rand -hex 24`) |
| `ALLOW_NO_AUTH` | — | `1` = start bez tokenu, tylko do prób lokalnych: serwer słucha wtedy wyłącznie na `127.0.0.1`; przy `NODE_ENV=production` serwer odmawia startu |
| `ALLOWED_ORIGINS` | puste | adresy aplikacji po przecinku (np. `https://notki.netlify.app`). Puste = żadna strona z innej domeny nie może wywołać serwera z przeglądarki. `*` działa tylko, gdy wpiszesz go wprost |
| `TRUST_PROXY` | — | `1` TYLKO za reverse proxy, które nadpisuje `X-Forwarded-For` (Caddy i nginx domyślnie tak robią), przy porcie dostępnym wyłącznie z proxy (`127.0.0.1:`). Wtedy adres klienta do limitów to ostatni wpis `X-Forwarded-For`. **Nie włączaj, gdy port jest dostępny bezpośrednio z internetu** — klient sam ustawiłby nagłówek i obszedłby limity. Bez tej zmiennej wszyscy za proxy dzielą jeden limit adresu |
| `MAX_CONNECTIONS` | `200` | jednoczesnych połączeń |
| `RATE_IP_PER_MIN` | `120` | żądań na minutę z jednego adresu |
| `RATE_AUTH_FAILS` | `10` | błędnych tokenów z jednego adresu na 15 min; kolejne dostają `429`. Żądanie z DOBRYM tokenem zawsze przechodzi, więc nikt za wspólnym adresem nie odetnie właściciela |
| `RATE_SCHEDULE_PER_HOUR` | `240` | wysłań harmonogramu na godzinę dla jednej subskrypcji |
| `RATE_TEST_PER_HOUR` | `5` | próbnych powiadomień na godzinę dla jednej subskrypcji |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | kontakt dla usług push; wpisz swój e-mail |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | — | własne klucze; bez nich serwer tworzy je przy pierwszym starcie w `vapid.json`. Przy `NODE_ENV=production` są wymagane (`npx web-push generate-vapid-keys`) — bez nich serwer odmawia startu |

**Nie zmieniaj kluczy VAPID** po włączeniu powiadomień na telefonach. Bez `vapid.json`, np. po
skasowaniu wolumenu, wszystkie subskrypcje przestaną działać. Wtedy wyłącz i włącz
powiadomienia w aplikacji jeszcze raz.

## API

| Metoda i ścieżka | Treść | Odpowiedź |
|---|---|---|
| `GET /health` | — | `{ ok: true }` (jawny) |
| `GET /vapid` | — | `{ publicKey, enc: 1, reg: 1 }` (`enc: 1` — przyjmuje terminy zaszyfrowane, `reg: 1` — wydaje tokeny urządzeń). **Wymaga tokenu** (sam klucz jest publiczny, ale nie zdradzamy, że to serwer powiadomień) |
| `POST /register` | `{ subscription }` | `{ token }` — token urządzenia dla tej subskrypcji (S3.2). **Tylko z `PUSH_TOKEN`**; ponowna rejestracja unieważnia poprzedni token |
| `PUT /schedule` | `{ subscription, items: [{ key, at, title, body?, url? }] }` albo zaszyfrowane `items: [{ v: 1, key, at, enc }]` (S3.1: serwer nie widzi treści; formaty można mieszać) | zastępuje listę terminów urządzenia. **Wymaga tokenu** |
| `POST /test` | `{ subscription }` | wysyła od razu próbne powiadomienie. **Wymaga tokenu** |
| `POST /unsubscribe` | `{ endpoint }` | usuwa urządzenie. **Wymaga tokenu** |

Token urządzenia działa w `GET /vapid` i w `PUT /schedule`, `POST /test`, `POST /unsubscribe` — tylko dla własnej
subskrypcji (cudza: `403`). `PUT /schedule` z nowym adresem subskrypcji (przeglądarka ją wymieniła) przenosi token
na nowy adres i usuwa stary, o ile nowy nie należy już do innego urządzenia.

Kody błędów: `401` zły albo brak tokenu, `403` token urządzenia użyty dla cudzej subskrypcji albo do `/register`, `429` za dużo żądań (z nagłówkiem `Retry-After`), `413` za duże
ciało (limit 512 KB), `400` zła treść albo adres subskrypcji spoza serwisów push, `503` brak miejsca na urządzenia.

## Limity

- 100 urządzeń na serwer i 200 terminów na urządzenie.
- Terminy najwyżej 35 dni naprzód.
- Termin spóźniony o ponad godzinę (np. serwer nie działał) przepada, żeby nie budzić w nocy.
- Nieudanej wysyłki serwer nie ponawia. Odpowiedź 404/410 od usługi push usuwa urządzenie
  (subskrypcja odwołana).
## Bezpieczeństwo

- **Uwierzytelnianie:** wszystkie ścieżki poza `/health` wymagają `Authorization: Bearer <PUSH_TOKEN>`
  (porównanie w stałym czasie). Błędne tokeny z jednego adresu są limitowane (kolejne dostają `429`), a
  token musi mieć co najmniej 24 znaki — losowy (`openssl rand -hex 24` = 192 bity), więc zgadywanie nie ma
  sensu. Bez tokenu każdy mógłby zająć miejsca na subskrypcje, kasować cudze i wysyłać powiadomienia
  podpisane Twoim kluczem VAPID.
- **Token w aplikacji (S3.2):** `PUSH_TOKEN` wpisujesz przy włączaniu, a aplikacja wymienia go od razu na token
  urządzenia (`POST /register`) i zapisuje tylko ten (`localStorage`, osobny klucz, poza kopią zapasową i wspólnymi
  danymi). Serwer trzyma tylko skrót SHA-256 tokenu urządzenia. Kto ma dostęp do telefonu, może sterować tylko jego
  subskrypcją — nie założy nowej i nie ruszy cudzych. Odcięcie jednego urządzenia: wypisz je w aplikacji albo — przy
  **zatrzymanym** serwerze (działający nadpisze plik z pamięci) — usuń jego wpis z `store.json`.
  Gdy serwer usunie subskrypcję (serwis push odpowie 410, 60 dni bez `PUT /schedule`), znika też jej token;
  aplikacja pokaże wtedy prośbę o ponowne włączenie z `PUSH_TOKEN`. Zmiana `PUSH_TOKEN` nie unieważnia tokenów urządzeń. Starsza aplikacja (bez S3.2) dalej
  używa `PUSH_TOKEN` — serwer przyjmuje oba.
- **Brak otwartego przekaźnika (SSRF):** subskrypcja musi wskazywać serwis Web Push przeglądarki (Google FCM,
  Mozilla, Windows, Apple), `https`, port 443, bez danych logowania, spacji, znaków sterujących i `\` w
  adresie, a nazwa hosta musi składać się z poprawnych etykiet DNS (litery, cyfry, myślniki). Ostatnie ma
  znaczenie: biblioteka `web-push` rozbiera adres starszym parserem niż przeglądarka, który kończy nazwę hosta na
  `;`, `!`, `$` itp. — adres `https://127.0.0.1;x.notify.windows.com/` przeszedłby samą listę hostów, a żądanie
  poszłoby na `127.0.0.1`. Serwer dodatkowo sprawdza, że oba parsery widzą ten sam host i port, i do bazy oraz do
  `web-push` przekazuje tylko znormalizowany adres. Przekierowań (3xx) nie śledzi. Testy: `security.test.js`,
  `server.test.js`.
- **CORS:** domyślnie wyłączony. Tylko adresy z `ALLOWED_ORIGINS` mogą wywoływać serwer z przeglądarki.
- **Limity:** zob. tabelę zmiennych; do tego limit ciała 512 KB (dysk w najgorszym razie: 100 subskrypcji × 430 KB = 43 MB), limity czasu połączeń (10 s na nagłówki,
  20 s na żądanie) i ograniczona liczba liczników w pamięci.
- **Wysyłka z limitem czasu** (10 s na jedną wiadomość), obiegi się nie nakładają, a subskrypcje bez aktywności
  przez 60 dni są sprzątane (po ponownym włączeniu powiadomień na telefonie stary adres nie zajmuje miejsca na zawsze).
- **Błędne żądanie nie zabija procesu:** nietypowa ścieżka (np. `GET //[`) kończy się `400`, a nieprzewidziane
  błędy są łapane i logowane.
- **Pliki:** `DATA_DIR` ma uprawnienia 0700, a `store.json` i `vapid.json` (klucz prywatny) 0600.
- **Kopia zapasowa aplikacji** nie zawiera tokenu i przy przywracaniu zeruje adres serwera, żeby złośliwa kopia nie
  skierowała Twojego tokenu na obcy serwer.
- **Nie loguje** adresów subskrypcji (tylko skrót), a do klienta wysyła stałe kody błędów zamiast treści wyjątków.
- **Zostaje po Twojej stronie:** https przez reverse proxy (serwer sam nie szyfruje, a token idzie w nagłówku),
  firewall i rotacja tokenu. Plik `DATA_DIR/store.json` zawiera adresy subskrypcji i klucze — chroń wolumen.

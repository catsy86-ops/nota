# Serwer powiadomień (Web Push)

Bez serwera NOTKI przypominają tylko przy otwartej aplikacji, bo timery działają w stronie.
Ten serwer wysyła powiadomienia o czasie także wtedy, gdy aplikacja jest zamknięta.

Jak to działa:

1. W **Ustawienia → Ogólne → Powiadomienia przy zamkniętej aplikacji** wpisujesz adres
   serwera i stukasz **Włącz**. Telefon tworzy subskrypcję Web Push z kluczem serwera.
2. Aplikacja liczy terminy na 14 dni i wysyła je na serwer (`PUT /schedule`). Wysyła je ponownie
   przy każdej zmianie danych, co godzinę i przy chowaniu aplikacji. Lista obejmuje przypomnienia
   notatek, Grafik na jutro, raport dnia i tygodnia, problem otwarty od 3 dni i materiał
   zamówiony 3 dni temu.
3. Serwer co 20 s sprawdza terminy i wysyła należne przez usługę push przeglądarki
   (FCM, Mozilla, Apple).

**Co jest na serwerze:** adres subskrypcji oraz terminy z tytułami i krótkim opisem.
Treść notatek tam nie trafia, a z notatek prywatnych nie trafiają nawet tytuły.
Wszystko leży w `DATA_DIR/store.json`.

## Uruchomienie

```bash
cd push-server
npm install
npm start            # port 4455; zmień przez PORT=xxxx
npm test             # testy logiki (node:test)
```

Docker:

```bash
docker build -t notki-push .
docker run -d -p 4455:4455 -v notki-push:/data --restart unless-stopped notki-push
```

Telefon łączy się z serwerem tylko przez **https**. Postaw go za reverse proxy z certyfikatem,
np. Caddy: `powiadomienia.twojadomena.pl { reverse_proxy localhost:4455 }`.
Wyjątek to `http://localhost`, który działa przy testach na komputerze.

## Ustawienia (zmienne środowiskowe)

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `PORT` | `4455` | port HTTP |
| `DATA_DIR` | `./data` | katalog na `store.json` i `vapid.json` |
| `ALLOWED_ORIGINS` | `*` | adresy aplikacji po przecinku (np. `https://notki.netlify.app`) — ogranicza CORS |
| `VAPID_SUBJECT` | `mailto:admin@example.com` | kontakt dla usług push; wpisz swój e-mail |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | — | własne klucze; bez nich serwer tworzy je przy pierwszym starcie w `vapid.json` |

**Nie zmieniaj kluczy VAPID** po włączeniu powiadomień na telefonach. Bez `vapid.json`, np. po
skasowaniu wolumenu, wszystkie subskrypcje przestaną działać. Wtedy wyłącz i włącz
powiadomienia w aplikacji jeszcze raz.

## API

| Metoda i ścieżka | Treść | Odpowiedź |
|---|---|---|
| `GET /health` | — | `{ ok: true }` |
| `GET /vapid` | — | `{ publicKey }` |
| `PUT /schedule` | `{ subscription, items: [{ key, at, title, body?, url? }] }` | zastępuje listę terminów urządzenia |
| `POST /test` | `{ subscription }` | wysyła od razu próbne powiadomienie |
| `POST /unsubscribe` | `{ endpoint }` | usuwa urządzenie |

## Limity

- 100 urządzeń na serwer i 200 terminów na urządzenie.
- Terminy najwyżej 35 dni naprzód.
- Termin spóźniony o ponad godzinę (np. serwer nie działał) przepada, żeby nie budzić w nocy.
- Nieudanej wysyłki serwer nie ponawia. Odpowiedź 404/410 od usługi push usuwa urządzenie
  (subskrypcja odwołana).
- Serwer nie ma logowania. Kto zna adres, może dopisać własną subskrypcję, ale powiadomienia
  dojdą tylko do jego urządzeń. `ALLOWED_ORIGINS` ogranicza dostęp z innych stron.

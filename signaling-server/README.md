# Serwer sygnalizacyjny (self-hosted)

Notatnik synchronizuje notatki i obrazy między urządzeniami peer-to-peer
przez WebRTC (`y-webrtc`, patrz `src/lib/yjsSync.ts` i `src/lib/imageSync.ts`).
Do nawiązania połączenia P2P (WebRTC) potrzebny jest serwer sygnalizacyjny —
domyślnie apka używa publicznych serwerów udostępnianych przez projekt
`y-webrtc`. **Treść notatek nigdy przez ten serwer nie przechodzi** — służy
wyłącznie do wymiany danych potrzebnych do nawiązania bezpośredniego
połączenia (offer/answer/ICE), sam jest ślepy na to, co się synchronizuje.

Ten folder to gotowy do uruchomienia, samodzielny serwer sygnalizacyjny —
oficjalna implementacja z pakietu `y-webrtc` (`bin/server.js`), wydzielona
tutaj, żeby dało się ją wdrożyć własnym kosztem zamiast (lub obok) polegania
na publicznych serwerach.

**Nie jest to wpięte do apki jako domyślne** — to świadoma decyzja: wdrożenie
własnego serwera wymaga miejsca do hostowania, którego na razie nie ma.
Kod jest gotowy, gdy zajdzie taka potrzeba.

## Uruchomienie lokalnie

```bash
cd signaling-server
npm install
npm start          # nasłuchuje na porcie 4444 (zmień przez PORT=xxxx npm start)
```

## Uruchomienie przez Docker

```bash
cd signaling-server
docker build -t kaczy-signaling .
docker run -p 4444:4444 kaczy-signaling
```

Wdrożenie na dowolnym VPS z Dockerem: skopiuj ten folder, zbuduj obraz,
wystaw port za reverse proxy z TLS (np. Caddy/nginx + certyfikat) — WebRTC
signaling przez `wss://` (nie `ws://`) jest wymagany przez przeglądarki
poza `localhost`.

## Podpięcie własnego serwera do apki

Obecnie `src/lib/yjsSync.ts` i `src/lib/imageSync.ts` tworzą `WebrtcProvider`
bez opcji `signaling`, więc używane są domyślne publiczne serwery z pakietu
`y-webrtc`. Żeby użyć własnego serwera zamiast (lub obok) nich, dodaj opcję
`signaling` przy tworzeniu obu providerów:

```ts
new WebrtcProvider(roomNameFor(code), yjsStore.doc, {
  password: code,
  signaling: ["wss://twoj-serwer.example.com"],
});
```

To samo w `imageSync.ts` przy tworzeniu providera dla transportu obrazów.
Adres serwera warto trzymać w zmiennej środowiskowej Vite (`VITE_SIGNALING_URL`),
nie na sztywno w kodzie — to osobna, mała zmiana do zrobienia w momencie
wdrożenia własnego serwera.

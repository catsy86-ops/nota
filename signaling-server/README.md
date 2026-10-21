# Serwer sygnalizacyjny (self-hosted)

Notatnik synchronizuje notatki i obrazy między urządzeniami peer-to-peer
przez WebRTC (`y-webrtc`, patrz `src/lib/yjsSync.ts` i `src/lib/imageSync.ts`).
Do nawiązania połączenia P2P potrzebny jest serwer sygnalizacyjny, który tylko
wymienia dane połączenia (offer/answer/ICE). **Treść notatek nigdy przez ten
serwer nie przechodzi** — jest na nią ślepy.

Domyślnie aplikacja używa publicznych serwerów z pakietu `y-webrtc`. Ten folder
to gotowy, samodzielny serwer (`y-webrtc-signaling`, czyli oficjalna
implementacja z `y-webrtc`), który można postawić na własnym VPS i wskazać
w aplikacji zamiast albo obok publicznych.

## Wskazanie serwera w aplikacji

Ustawienia → Sync → **Własne serwery sygnalizacyjne**: po jednym adresie w linii,
w formacie `wss://…` (zalecane) albo `ws://…`. Adresy można oddzielić też spacją lub
przecinkiem. Wpis, który nie jest adresem `ws://`/`wss://`, nie zostaje zapisany —
aplikacja wymienia go pod polem. Pusta lista przywraca domyślne serwery.

Adresy są zapisane na urządzeniu (nie w dokumencie Yjs). Tekst notatek i obrazy
używają tej samej listy (`providerOptions` w `yjsSync.ts`), więc nie rozjeżdżają się
na różne serwery. Stan połączeń (ile serwerów odpowiada) widać w Sync i w diagnostyce.

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

## Wdrożenie

Na dowolnym VPS z Dockerem: skopiuj ten folder, zbuduj obraz i wystaw port za
reverse proxy z TLS (np. Caddy albo nginx z certyfikatem). Przeglądarki poza
`localhost` wymagają `wss://` (nie `ws://`), więc samo otwarte gniazdo nie wystarczy.
Potem wpisz adres `wss://…` w Ustawienia → Sync na każdym urządzeniu, które ma się
synchronizować.

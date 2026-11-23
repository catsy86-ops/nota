# Bezpieczeństwo

## Zgłaszanie błędu

Znalazłeś lukę? Nie otwieraj publicznego zgłoszenia. Napisz do właściciela repozytorium prywatnie (GitHub → *Security* → *Report a vulnerability*, a gdy ta opcja jest wyłączona — wiadomość na adres z profilu właściciela). Podaj: co zrobiłeś, czego oczekiwałeś, co się stało, wersję (skrót commita albo data) i przeglądarkę. Odpowiedź w ciągu 7 dni; poprawka lub decyzja w ciągu 30.

## Co jest w zakresie

- aplikacja webowa i PWA (`src/`, `public/`, nagłówki z `vercel.json` i `netlify.toml`);
- przekaźnik (`relay-server/`) i serwer powiadomień (`push-server/`);
- szyfrowanie skarbca i synchronizacji, import i eksport kopii.

Poza zakresem: złośliwe oprogramowanie na urządzeniu użytkownika, przymus wobec użytkownika, błędy samej przeglądarki i WebCrypto, ataki kanałem bocznym na sprzęt, publiczne serwery sygnalizacyjne WebRTC innych operatorów. Pełny model zagrożeń: [`docs/model-zagrozen.md`](docs/model-zagrozen.md).

## Obsługiwane wersje

Tylko bieżący `master`. Poprawki nie są przenoszone na starsze wydania.

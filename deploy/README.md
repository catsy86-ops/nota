# Wdrożenie serwerów: przekaźnik i powiadomienia

Procedury do punktów S4.5, S4.6 i S4.8 z `docs/plan-security-2026-11-15.md`. Opis serwerów i zmiennych środowiska jest w `relay-server/README.md` i `push-server/README.md`.

## Dzienniki (S4.5)

Serwery piszą tylko na standardowe wyjście. W dziennikach nie ma treści, tokenów, nagłówków ani adresów IP. Pilnują tego testy `dziennik … (S4.5)` w `relay-server/server.test.js` i `push-server/server.test.js`. Identyfikator pokoju jest skracany (`short()` w `storage.js`).

Retencję ustawia Docker, nie serwer. Trzymaj dzienniki 7 dni, np. w `docker run`:

```sh
--log-driver local --log-opt max-size=10m --log-opt max-file=7
```

Jeśli przed serwerem stoi reverse proxy, wyłącz w nim zapis adresów IP albo skracaj je (nginx: własny `log_format` bez `$remote_addr`). Ustaw tam też retencję 7 dni.

## Zdrowie i nadzór (S4.6)

- `GET /health` zwraca tylko `{"ok":true}`, bez liczby pokoi i subskrypcji. Obrazy mają `HEALTHCHECK` co 60 s.
- Podłącz zewnętrzny monitor dostępności, który co 5 minut odpytuje `https://<serwer>/health`.
- Ustaw alert o zajętości dysku powyżej 80% dla woluminu `/data`. Przekaźnik odmawia zapisu (507), gdy brakuje `MIN_FREE_BYTES`, ale alert ma przyjść wcześniej.

## Aktualizacje (S4.8)

Co miesiąc i po każdym alercie Dependabota dla `relay-server/` lub `push-server/` (S5.2):

1. Zaktualizuj zależności i obraz bazowy (`node:22-alpine`), przejdź `npm test` w katalogu serwera i przepuść zadanie CI `servers`.
2. Zbuduj obraz z datą w znaczniku, np. `notki-relay:2026-11-25`. Nie używaj samego `latest`.
3. Wdróż: zatrzymaj stary kontener i uruchom nowy na tym samym woluminie `/data`. Sprawdź `GET /health` i dziennik startu.
4. **Wycofanie:** uruchom poprzedni znacznik obrazu na tym samym woluminie. Format danych na dysku jest zgodny wstecz (`storage.js`), a klienci przy kontakcie dosyłają brakujące zmiany.

## Serwer powiadomień w produkcji

Ustaw `NODE_ENV=production`, `VAPID_PUBLIC_KEY` i `VAPID_PRIVATE_KEY` (S3.4). Bez kluczy serwer w produkcji odmawia startu, z `ALLOW_NO_AUTH=1` również (S3.3). Klucze z dotychczasowego `vapid.json` przepisz do zmiennych bez zmiany. Nowe klucze unieważniają subskrypcje, a aplikacja zapisuje się wtedy ponownie przy następnym włączeniu powiadomień.

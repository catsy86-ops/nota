# Decyzje architektoniczne (ADR)

Krótki zapis decyzji, które łatwo podważyć przy następnej zmianie (Plan-nowy 3.4). Każda ma powód, skutki i miejsce w kodzie. Szczegóły działania są w `opis.md`; tu jest tylko „dlaczego tak”.

## ADR-1. Przypomnienie notatki to jedna wartość LWW (`reminderSpec`)

- **Decyzja:** cały termin notatki (moment, powtarzanie, dzień serii, koniec, odłożenie, „cały dzień”) zapisujemy jako jedną wartość `reminderSpec` w `Y.Map` notatki, a nie jako osobne pola.
- **Powód:** przy dwóch urządzeniach osobne pola scalały się pole po polu. Konflikt mógł dać mieszankę, np. termin z jednego urządzenia i powtarzanie z drugiego. Jedna wartość wygrywa w całości (last-writer-wins).
- **Skutki:**
  - Stare pola (`reminder`, `reminderRepeat`, `reminderDay`, `reminderRepeatUntil`) zapisujemy dalej tą samą wartością dla starszych wersji.
  - Odczyt bierze najpierw `reminderSpec`, a gdy go nie ma — stare pola. Migracja nie jest potrzebna.
  - Dwie równoczesne zmiany tego samego terminu: zostaje jedna, cała. Notatki starszej wersji dostają `reminderSpec` dopiero przy zmianie.
- **Kod:** `src/lib/reminderSpec.ts`, test `src/lib/reminderSpec.test.ts`.
- **Ten sam wzorzec:** zapisane widoki (`src/lib/savedViews.ts`, jedna wartość na widok) i domyślny szablon folderu (`templateId`).

## ADR-2. CSP egzekwowane, ale `connect-src` szerokie (`https:`/`wss:`)

- **Decyzja:** `Content-Security-Policy` jest egzekwowane (nie `Report-Only`): `script-src 'self'`, `object-src 'none'`, obrazy tylko z `'self'`, `data:` i `blob:`. Natomiast `connect-src` zezwala na każde `https:` i `wss:`.
- **Powód:** adres przekaźnika synchronizacji, serwerów sygnalizacyjnych WebRTC i serwera push wpisuje użytkownik w Ustawieniach. Kod nie zna ich z góry, więc nie da się ich wypisać w nagłówku.
- **Skutki:**
  - Wstrzyknięty skrypt i tak nie ruszy (`script-src 'self'`), ale `connect-src` nie chroni przed wysłaniem danych pod obcy adres `https:`.
  - Nowy kod nie może robić `fetch` na `data:` ani `blob:` (konwersja przez `dataUrlToBlob`) ani mieć skryptów inline.
  - Załącznik otwierany w nowej karcie (`blob:`) dziedziczy tę politykę. Dlatego otwieramy tylko PDF i obrazy rastrowe (`openableType`).
- **Kod:** `vercel.json` (źródło) i `netlify.toml` (kopia; test pilnuje zgodności), `vite.config.ts` (`previewSecurityHeaders`, całe e2e biegnie pod CSP), `src/lib/securityHeaders.test.ts`, `e2e/csp.spec.ts`.
- **Do zmiany, gdy:** będzie stały hosting przekaźnika i push — wtedy `connect-src` można zawęzić do tych adresów.

## ADR-3. Web Push z własnego serwera, uruchamianego lokalnie

- **Decyzja:** powiadomienia przy zamkniętej aplikacji wysyła własny mały serwer (`push-server/`, Node, klucze VAPID przy pierwszym starcie), a nie usługa zewnętrzna. Aplikacja liczy terminy, serwer tylko wysyła.
- **Powód:** notatki, Grafik i dziennik są w Yjs na urządzeniu, więc serwer ich nie zna i nie powinien znać. Aplikacja liczy terminy na 14 dni tymi samymi funkcjami co timery strony i wysyła listę (`PUT /schedule`). Serwer widzi tylko terminy, tytuły i krótkie opisy; notatka prywatna ma stały tytuł.
- **Skutki:**
  - Bez uruchomionego serwera (https przed portem 4455) przypomnienia działają tylko przy otwartej aplikacji.
  - Lista na serwerze jest najwyżej tak świeża jak ostatnie otwarcie aplikacji.
  - Przyciski w powiadomieniu („Odłóż”, „Gotowe”) są tylko w powiadomieniach z timera strony.
  - Nie sprawdzone na prawdziwym telefonie (Cykl 4).
- **Kod:** `push-server/`, `src/lib/push/schedule.ts` (`buildPushSchedule`), Ustawienia → Ogólne → „Powiadomienia przy zamkniętej aplikacji”.

## ADR-4. Bez hostingu po stronie serwera (przekaźnik i push lokalnie)

- **Decyzja (2026-10-23):** przekaźnik synchronizacji i serwer push zostają do uruchomienia przez użytkownika. Aplikacja nie zawiera adresu żadnego serwera i nie ma TURN.
- **Powód:** brak decyzji o hostingu i jego kosztach. Synchronizacja i tak działa bezpośrednio między urządzeniami (WebRTC); przekaźnik i push są dodatkami.
- **Skutki:**
  - Przez część sieci komórkowych połączenie WebRTC się nie uda (brak TURN), a oba urządzenia muszą być online jednocześnie, chyba że jest przekaźnik.
  - Adres przekaźnika i serwera push wpisuje się w Ustawieniach.
  - Wdrożenie wymaga `security-reviewer` przed uruchomieniem (Plan-nowy, Cykl 4).
- **Kod:** `src/lib/sync/relayRuntime.ts`, `relay-server/`, `push-server/`; Ustawienia → Sync → Przekaźnik.

## ADR-5. Model stylów i motywów: styl × schemat × akcent, wszystko w CSS

- **Decyzja:** wygląd to trzy niezależne osie ustawiane atrybutami na `<html>`:
  - **styl** (`data-skin`: Zeszyt, Plan, Neon, Zorza, Beton i patyna, Matryca, Hydraulika, Odblask, Kafle, Tablica);
  - **schemat** (jasny albo ciemny; każdy styl ma oba);
  - **akcent** (`data-accent`, pięć odcieni na styl).

  Każdy styl jest jednym plikiem CSS z pełnym kompletem tokenów dla obu schematów. Nie ma logiki wyglądu w komponentach.
- **Powód:** nowy styl nie może wymagać zmian w komponentach, a kontrast musi dać się sprawdzić automatycznie. Tokeny w CSS sprawdzają testy (komplet i kontrast), a e2e biorą listę stylów z jednego miejsca.
- **Skutki:**
  - Nowy styl to wpis w `skinList.ts`, `SKIN_META` w `skinGallery.ts`, odcienie w generatorze akcentów i plik `src/styles/skins/<id>.css` z blokiem drugiego schematu.
  - Zeszyt słucha wspólnego przełącznika jasności, inne style pamiętają własny schemat (`kaczy.skinScheme.v1`).
  - Kolory zapisane w CSS stylu (ozdoby) nie zmieniają się z akcentem.
- **Kod:** `src/lib/skinList.ts`, `src/lib/skins.ts`, `src/hooks/useTheme.ts` (`resolveDark`), `src/styles/skins/*.css`, `src/styles/accents.css` (generowany), testy `src/lib/skinContract.test.ts`, `src/lib/skinContrast.test.ts`, `e2e/a11y.spec.ts`.

## ADR-6. Faktury w KSeF: moduł `src/lib/ksef/`, Etap 1 bez wysyłki (uchyla H-3)

- **Decyzja:** uchylamy H-3 („faktur w aplikacji nie ma”). Aplikacja wystawia faktury VAT w schemacie FA(3) z wyceny zlecenia własnego. **Etap 1 (ta decyzja):** generowanie XML FA(3) i wizualizacji PDF, eksport do ręcznego wgrania do KSeF lub programu księgowego — bez wysyłki z aplikacji. Wysyłka (Etap 2) wymaga własnego serwera-pośrednika (patrz niżej) i będzie osobną decyzją.
- **Zakres Etapu 1:** czynny podatnik VAT, zwykła faktura (`RodzajFaktury` = VAT) dla klienta krajowego (firma albo konsument), stawki 23 / 8 / 5 / 0 (krajowa), ceny netto albo brutto. Poza zakresem: odwrotne obciążenie, zaliczki, korekty, waluty obce, tryby offline24/awaryjny z kodami QR.
- **Powód wysyłki przez serwer:** API KSeF (prod/test/demo) nie zwraca nagłówków CORS i odrzuca preflight (405), więc przeglądarka nie może go wołać bezpośrednio (sprawdzone 2026-11-11). Poświadczenia KSeF (token, certyfikat) nie mogą trafić do Yjs, przekaźnika, kopii zapasowej ani logów.
- **Zasady:**
  - kwoty w groszach (liczby całkowite), VAT liczony raz na stawkę; wystawiona faktura jest niezmienna (korekta zamiast edycji, Etap 3);
  - XML składany z typowanych struktur z escapowaniem i usuwaniem znaków niedozwolonych w XML 1.0 (`src/lib/ksef/xml.ts`), kolejność elementów zgodna z XSD, kontrola `scripts/ksef/ValidateFa3.java`;
  - numeracja bez kolizji między urządzeniami (jedno urządzenie wystawiające albo serie per urządzenie) — licznik w Yjs odrzucony, bo offline daje duplikaty;
  - dane osobowe nabywców tylko na urządzeniu i w Yjs w obrębie grupy; faktury poza share inbox; eksport faktur szyfrowany.
- **Kod:** `src/lib/ksef/` (`nip.ts`, `xml.ts`, `invoice.ts`, `fa3.ts`), testy `src/lib/ksef/ksef.test.ts`, rozpoznanie w `docs/ksef-integracja-2026-11-11.md`.

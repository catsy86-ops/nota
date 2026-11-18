# Powiadomienia: treść niewidoczna dla serwera (S3.1) i alarmy natywne Pracy (R4.5)

> **Status (2026-11-17):** specyfikacja Fable, sesja E z `plan-uzycia-fable-2026-11-17.md`. Kod: Opus (Z-15.7, Z-14.6). Przegląd diffu Z-15.7 przed scaleniem: Fable + `security-reviewer`.
> **Zależności:** S3.1 ma sens tylko dla PWA i iOS — w APK alarmy są lokalne i serwer nie widzi niczego. Jeśli SE-1 = „serwera nie wdrażamy” i próba F1.0 przejdzie, Z-15.7 spada na koniec kolejki. Z-14.6 czeka na próbę F1.0 na telefonie.
> **Stan sprawdzony w kodzie:** `src/lib/push/schedule.ts`, `client.ts`, `shown.ts`, `public/sw-notifications.js`, `push-server/core.js` i `server.js`, `src/lib/reminders/*`, `PushScheduleSync.tsx`, `PressureRunWatcher.tsx`.

## 1. S3.1 — format i zachowanie

### 1.1 Co serwer widzi dziś, a co po zmianie

| | Dziś | Po zmianie |
|---|---|---|
| Tytuł, treść, adres notatki | jawne (`title`, `body`, `url`) | zaszyfrowane |
| Klucz terminu (`n:<id notatki>:<czas>`, `s:<dzień>` …) — zdradza kategorię, identyfikator notatki, dzień zmiany | jawny | zaszyfrowany; serwer dostaje losowy identyfikator |
| Chwila wysyłki `at` | jawna | jawna (serwer musi wiedzieć, kiedy wysłać) |
| Liczba terminów i ich rozkład w czasie | jawne | jawne |
| Długość treści | jawna | zaokrąglona do 256 bajtów |

Notatka prywatna nadal dostaje tytuł ogólny (`noteItems`) — szyfrowanie tego nie zmienia, bo powiadomienie pojawia się na zablokowanym ekranie.

### 1.2 Format

| Element | Wartość |
|---|---|
| Pozycja wysyłana serwerowi | `{ "v": 1, "key": <id>, "at": <ms>, "enc": <tekst> }` |
| `key` (zewnętrzny) | 16 losowych bajtów, base64url (22 znaki), losowane **przy każdej wysyłce**. Serwer używa go tylko do odsiania powtórzeń w jednej liście; nic nie zależy od jego stałości (lista jest zastępowana w całości). |
| `enc` | base64url z `iv (12 bajtów) ‖ szyfrogram ‖ znacznik GCM (16 bajtów)` |
| Algorytm | AES-256-GCM, `iv` losowy dla każdej pozycji i każdej wysyłki |
| AAD | bajty UTF-8 napisu `kaczy-push-v1:` + zewnętrzny `key`. Wiąże szyfrogram z pozycją (serwer nie podmieni treści między terminami) i z wersją formatu. Bez identyfikatora subskrypcji — ten zmienia się przy odnowieniu. |
| Tekst jawny | JSON w UTF-8: `{"k": <klucz pushKey>, "t": <tytuł>, "b": <treść>, "u": <adres>, "s": 1}` (`s` tylko gdy `snooze`), dopełniony **spacjami na końcu** do wielokrotności 256 bajtów |
| Limit tekstu jawnego | 1536 bajtów po dopełnieniu → `enc` ≤ 2086 znaków |
| Treść Web Push (serwer → przeglądarka) | `{"v":1,"key":<id>,"enc":<tekst>}` — ok. 2,2 KB, poniżej limitu ok. 4 KB |

**Przycięcie przed szyfrowaniem** (klient, czysta funkcja `sealItem`):
1. limity znaków jak dziś na serwerze: tytuł 120, treść 240, adres 300, klucz 120;
2. jeśli JSON ma ponad 1536 bajtów — skracać `b` po jednym **punkcie kodowym** (nie po jednostce UTF-16: połówka pary zastępczej to niepoprawny tekst), potem `t`; adresu i klucza nie skracać — pozycja z za długim adresem dostaje `u: "/"`;
3. dopełnić spacjami.

Serwer **odrzuca** pozycję z `enc` dłuższym niż limit — nie przycina (ucięty szyfrogram to śmieć).

### 1.3 Klucz

- AES-GCM 256, `extractable: false`, użycia `encrypt`/`decrypt`. Tworzy go strona; jeden na urządzenie (przeglądarkę).
- Miejsce: IndexedDB, baza `kaczy-push-keys`, wersja 1, magazyn `keys`, wpis `content-v1` (obiekt `CryptoKey`, klonowanie strukturalne). Service worker otwiera tę samą bazę gołym API `indexedDB` (bez `idb-keyval` — `sw-notifications.js` to zwykły skrypt z `importScripts`).
- **Pułapka:** worker może otworzyć bazę pierwszy (push po wyczyszczeniu samego klucza). Obie strony muszą mieć ten sam `onupgradeneeded` tworzący magazyn `keys`, inaczej powstanie baza bez magazynu i strona nie zapisze klucza.
- **Dwie karty naraz:** klucz generować przed transakcją (transakcja IndexedDB nie przeżyje `await generateKey`), potem w jednej transakcji `readwrite`: odczyt → jeśli pusto, zapis; używać tego, co jest w bazie po transakcji.
- Klucz nie wchodzi do kopii zapasowej ani raportu diagnostycznego. Nie wymaga dopisku w `storageManifest`, jeśli ten obejmuje tylko `localStorage` — sprawdzić, czy „Usuń wszystkie dane” kasuje też tę bazę.

### 1.4 Klient (`src/lib/push/`)

- Nowy plik `seal.ts`: `contentKey()` (pobierz albo utwórz), `sealItem(key, item)`, `sealItems`.
- `uploadNow`: **skrót `sentHash` liczyć z pozycji jawnych**, przed szyfrowaniem. Losowe `iv` i `key` dają inne bajty przy każdym przebiegu — skrót z postaci zaszyfrowanej wysyłałby listę przy każdej zmianie czegokolwiek i co 3 s debounce.
- **Zgodność z serwerem.** Stary serwer wymaga `title` i po cichu odrzuciłby wszystkie pozycje zaszyfrowane. Dlatego: `GET /vapid` zwraca `{ publicKey, enc: 1 }`; klient zapamiętuje to w `pushPrefs` przy włączeniu i odświeża przy okresowej wysyłce (co 6 h). Bez `enc: 1` klient wysyła po staremu. Dodatkowo po każdym `PUT /schedule` porównać `items` z odpowiedzi z liczbą wysłanych przyszłych pozycji; mniej → `last.ok = false` z komunikatem „Serwer nie przyjął części przypomnień”.
- **Brak możliwości szyfrowania** (wyjątek z IndexedDB albo `crypto.subtle`) przy serwerze z `enc: 1`: nie wysyłać jawnie; `last.ok = false`, komunikat w Ustawieniach. Kontekst bezpieczny jest wymagany także przez Web Push, więc to przypadek brzegowy.
- **Utrata klucza.** Wyczyszczenie danych strony zwykle usuwa też subskrypcję (istniejący komunikat „Subskrypcja wygasła”). Gdy zniknie sam klucz: `contentKey()` tworzy nowy i zeruje `sentHash` — następny przebieg wysyła listę od nowa. Pozycje zaszyfrowane starym kluczem, które serwer zdąży wysłać wcześniej, trafiają na ścieżkę z §1.5.
- Rozmiar żądania: 200 pozycji × ok. 440 bajtów (typowa pozycja mieści się w 256 bajtach) = ok. 90 KB; najgorszy przypadek ok. 430 KB. Dzisiejszy `MAX_BODY` serwera to **64 KB** — podnieść do 512 KB, a `pushErrorText(413)` zostaje.

### 1.5 Service worker (`public/sw-notifications.js`, zdarzenie `push`)

1. `d.v === 1` i `typeof d.enc === "string"` → odszyfrować; inaczej stara ścieżka bez zmian (zostaje dla okresu przejściowego i dla `POST /test`, którego treść tworzy serwer).
2. Po odszyfrowaniu: obciąć spacje, `JSON.parse`, przepisać `k/t/b/u/s` na `key/title/body/url/snooze` i wejść w **istniejący** kod — z tymi samymi kontrolami co dziś: `title` niepusty napis albo „NOTKI”, `url` przez `/^\/(?![/\\])/` albo `/`, `key` napis. Kontrola adresu działa na danych odszyfrowanych; druga kontrola w `notificationclick` zostaje.
3. **Nie da się odszyfrować** (brak klucza, zły znacznik, zły JSON, `enc` nie jest base64url): jeśli jest widoczne okno aplikacji — nic nie pokazywać, jak dziś dla znanych kluczy (strona przypomina sama); w przeciwnym razie powiadomienie ogólne: tytuł „NOTKI”, treść „Masz przypomnienie. Otwórz aplikację.”, adres `/`, `tag: "push"`, bez przycisków, bez wpisu do listy pokazanych (nie znamy klucza terminu). Każda gałąź kończy się wewnątrz `event.waitUntil`; wyjątek z odszyfrowania nie może wyjść poza `try`.
4. Po nieudanym odszyfrowaniu zapisać w bazie kluczy wpis `resend: <czas>`; strona przy starcie i w `uploadNow` czyta go, zeruje `sentHash` i kasuje wpis.
5. Powtórzenia: serwer mógłby wysłać ten sam szyfrogram drugi raz — lista pokazanych (ostatnie 200 kluczy terminów) już to odsiewa.

Stary worker z nowym klientem (worker czeka na aktywację): dostaje `{v, key, enc}`, nie zna formatu i pokaże „NOTKI” bez treści. Dopuszczalne — trwa do następnego uruchomienia aplikacji.

### 1.6 Serwer (`push-server/core.js`, `server.js`)

- `cleanItems`: pozycja jest poprawna, gdy ma `title` (stary format) **albo** `v === 1` i `enc` z alfabetu base64url o długości `ceil((28 + 256·n)·4/3)`, n = 1…6 (zmiana po przeglądzie 2026-11-18; było `{38,2086}`). Dla formatu 1 `key` musi pasować do `/^[A-Za-z0-9_-]{22}$/`; `title`, `body`, `url`, `snooze` są pomijane, nawet jeśli przyszły. Lista może mieszać formaty.
- `payloadOf`: format 1 → `{v:1, key, enc}`; stary bez zmian.
- `LIMITS.enc = 2086`; `MAX_BODY` 512 KB. Dysk w najgorszym razie: 100 subskrypcji × 430 KB = 43 MB — zapisać w README serwera.
- `GET /vapid` → `{ publicKey, enc: 1 }`.
- Serwer nie loguje `enc` ani `key` (S3.3).
- **Koniec starego formatu:** 60 dni po wydaniu (tyle wynosi `staleMs` — starsze subskrypcje i tak są sprzątane). Data do dziennika zmian; po niej `cleanItems` odrzuca pozycje bez `v`, a `POST /test` zostaje jawny.

### 1.7 Czego to nie załatwia

- Serwer nadal zna chwile i liczbę terminów oraz adres subskrypcji (czyli dostawcę push i urządzenie).
- Treść widzi system operacyjny i dostawca powiadomień dopiero po stronie urządzenia — Web Push szyfruje ją w drodze niezależnie od tej zmiany; S3.1 chroni przed **naszym** serwerem i jego dyskiem.
- Klucz nieeksportowalny chroni przed wyniesieniem pliku bazy przez skrypt strony, nie przed kodem, który działa w tym samym źródle i może klucza **użyć**.

### 1.8 Zlecenie Z-15.7 (Opus, M)

> **Stan (2026-11-18):** zrobione — `bd5a5b8a` serwer, `cc8c6e6e` klient, `7c9f4e67` worker; testy 1–8 w `seal.test.ts`, `swNotifications.test.ts`, `push-server/*.test.js`. Punkt 9 (iOS) w `docs/TESTING.md` jako niesprawdzony. Data końca starego formatu: 60 dni po wdrożeniu serwera.

Kolejność: serwer (oba formaty, `enc: 1`, limity) → klient (`seal.ts`, `uploadNow`) → worker. Każdy krok osobnym commitem; serwer musi być wdrożony przed klientem.

Testy (Vitest; serwer `node --test` jak dziś):
1. `sealItem` → odszyfrowanie daje te same pola; AAD z innym `key` nie przechodzi; zmieniony bajt `enc` nie przechodzi.
2. Przycięcie: tytuł i treść z emoji na granicy limitu — wynik to poprawny UTF-8, tekst jawny ≤ 1536 bajtów i wielokrotność 256.
3. Dwie pozycje o różnej długości tytułu (obie < 200 bajtów) dają `enc` tej samej długości.
4. `sentHash`: dwa przebiegi z tą samą listą wysyłają raz.
5. Serwer bez `enc: 1` → klient wysyła stary format; z `enc: 1` → żadna pozycja nie ma `title`.
6. `cleanItems`: format 1 z za długim `enc` odrzucony (nie przycięty); z `title` obok `enc` — `title` nie trafia do magazynu; lista mieszana.
7. Worker (test z atrapą `self`, wzorem istniejących testów SW, albo e2e): poprawna pozycja → powiadomienie z przyciskami notatki; zły klucz → powiadomienie ogólne i wpis `resend`; `u: "//zly.host"` → adres `/`.
8. Utrata klucza: usunięcie wpisu `content-v1` → następna wysyłka idzie mimo niezmienionej listy.
9. Ręcznie na iOS (aplikacja z ekranu początkowego): `CryptoKey` z IndexedDB czytany w workerze — **niesprawdzone**, wpisać wynik do `docs/TESTING.md`.

## 2. R4.5 — alarmy natywne próby szczelności i końca dnia

### 2.1 Stan: źródła już są

Plan zakładał dopisanie dwóch źródeł do `buildPushSchedule`. Oba istnieją i przez `activeSink()` trafiają do alarmów systemowych w APK bez dodatkowego kodu:

| Zdarzenie | Klucz | Kategoria → kanał | Głośny | Przyciski |
|---|---|---|---|---|
| Koniec próby szczelności | `t:<startedAt>` (`pushKey.pressure`) | `proby` → `notki-proby` | tak | brak |
| Koniec zmiany | `s:<dzień>` | `grafik` → `notki-grafik` | tak | „Skończyłem” |
| Brak wpisu / podziału godzin wieczorem | `z:<dzień>` | `grafik` | tak | brak |
| Raport dnia | `rd:<dzień>` | `raporty` | nie | brak |

Nowych prefiksów ani kanałów nie trzeba. Anulowanie też działa z konstrukcji: `planNative` kasuje alarm, którego nie ma na nowej liście, a zmieniony czas przy tym samym kluczu daje inny `hash` → kasowanie i nowe planowanie. Podwójnych powiadomień systemowych nie ma — w APK `showSystemNotification` nic nie robi, strona pokazuje tylko dymek.

„Koniec dnia” z planu Pracy to dziś koniec zmiany z Grafiku. Jeśli powstanie arkusz „Zakończ dzień” (R2.x), nie potrzebuje własnego alarmu — jego wyzwalaczem pozostaje `s:`/`z:`.

### 2.2 Luki znalezione w kodzie

1. **Lista nie reaguje na start i koniec próby.** `PushScheduleSync` czyta `getJournalDraft().test` w chwili wysyłki, ale szkic nie jest w zależnościach efektu. Alarm powstaje dopiero przy schowaniu aplikacji (`visibilitychange`), przy innej zmianie danych albo co godzinę. W APK schowanie to zła chwila: planowanie idzie przez most do wtyczki i WebView może zostać wstrzymany, zanim się skończy. Zakończenie próby przed czasem kasuje alarm z tym samym opóźnieniem.
2. **Próba w edycji zapisanego wpisu nie ma alarmu.** `PressureRunWatcher` bierze próbę ze szkicu **albo** z formularza edycji (`useJournalEditForm`), `PushScheduleSync` tylko ze szkicu. Dotyczy także Web Push.
3. **Alarm niedokładny.** Bez zgody na dokładne alarmy Android może opóźnić sygnał o kilka–kilkanaście minut; przy próbie 10–30 min to istotne. Stan jest w `nativeAlarmPrefs.last.exact`, ale ekran próby go nie pokazuje.
4. **Dymek i alarm naraz** przy otwartej aplikacji: zamierzone (alarm daje dźwięk), ale powiadomienie zostaje na pasku po obsłużeniu dymka.

### 2.3 Zlecenie Z-14.6 (Opus, S) — po próbie F1.0

1. Wspólna funkcja `currentPressureRun(draftTest, editTest): { startedAt, endsAt } | null` w `src/lib/study/pressureTest.ts` z regułą z `PressureRunWatcher` (edycja ma pierwszeństwo, gdy ma `startedAt`); używają jej oba komponenty.
2. `PushScheduleSync` subskrybuje szkic i formularz edycji, liczy `run` i trzyma w zależnościach efektu **wartości** `startedAt` i `endsAt` (nie obiekt). Zmiana `run` wysyła listę **od razu**, bez 3 s debounce; pozostałe zmiany jak dziś.
3. `PressureTestTimer`: w powłoce natywnej, gdy alarmy są włączone i `last.exact === false` — jedna linia „Alarm może się spóźnić. Włącz dokładne alarmy w ustawieniach telefonu.” z przejściem do Ustawień aplikacji. Gdy alarmy wyłączone — „Sygnał tylko przy otwartej aplikacji.”
4. Opcjonalnie: gdy strona pokazała dymek końca próby, usunąć dostarczone powiadomienie o tym kluczu (`LocalNotifications.removeDeliveredNotifications`, numer z `toAlarms`).
5. Testy (Vitest): `currentPressureRun` (szkic, edycja, oba, żaden); `planNative` — start próby dodaje alarm `t:`, koniec przed czasem go kasuje, zmiana czasu trwania kasuje i planuje ponownie, nowy start po zakończeniu daje inny numer.
6. Dopisać do listy próby F1.0 (`docs/TESTING.md`): próba 10 min z wygaszonym ekranem i aplikacją usuniętą z ostatnich; zakończenie przed czasem — alarm nie przychodzi; restart telefonu w trakcie próby.

Blokada wygaszania ekranu podczas próby zostaje bez zmian — to decyzja wygody, nie warunek alarmu.

# Plan Fable: trzy najtrudniejsze tematy (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Tu są tylko decyzje i specyfikacje, których nie warto zostawiać słabszemu modelowi. Kod według tych specyfikacji pisze inny model, punkt po punkcie.
>
> Poza tym plikiem (dla innego modelu, bez specyfikacji): audyt animacji i system ruchu, QoL, podział `Index.tsx` i `exportNotes.ts`, reguła ESLint warstw `lib ← hooks ← components`, plany działów (`plan-praca-2026-11-15.md`, `plan-dlugi-2026-11-15.md`, `plan-cwiczenia-2026-11-15.md`).

Zasada dla wykonawcy: przed każdym punktem sprawdź stan w kodzie, a nie w liście statusów. Nazwy wtyczek i uprawnień Androida potwierdź w aktualnej dokumentacji (context7), bo ten plan powstał bez budowania APK.

---

> **Stan 2026-11-16:** F1.1–F1.3 w kodzie (port, ujście natywne, Ustawienia, powłoka, workflow) — ADR-8 przyjęty z N-1…N-3 domyślnymi. Niezrobione: F1.0 (próba na telefonie — kroki właściciela), F1.4 (pliki w powłoce), testy. Zlecenia: zadanie 13 w `zlecenia-fable-2026-11-15.md`.

## F1. Powiadomienia przy zamkniętej aplikacji bez serwera (propozycja ADR-8)

### Stan dziś

- `buildPushSchedule` (`src/lib/push/schedule.ts`) liczy wszystkie terminy na 14 dni jako `PushItem[]` (`key`, `at`, `title`, `body`, `url`, `snooze`), najwyżej 200. Notatka prywatna ma stały tytuł.
- `PushScheduleSync.tsx` wysyła tę listę do `push-server/` (`uploadSchedule`). Serwer nie jest wdrożony (ADR-3, ADR-4), więc w praktyce działają tylko timery strony: `useReminderNotifications` (co 15 s), `DailyReportNudge`, `PressureRunWatcher`, `useShiftEveningNudge`. Wszystkie wołają `showSystemNotification`.
- Powtórki tłumi wspólny klucz `pushKey` (`src/lib/push/shown.ts`).

### Decyzja

Powłoka Android w **Capacitorze** z wtyczką lokalnych powiadomień. Alarmy ustawia system, więc działają offline, przy zamkniętej aplikacji i bez żadnego serwera. Lista z `buildPushSchedule` jest gotowym wejściem — logika terminów się nie zmienia.

Odrzucone:
- **Web Push jako jedyna droga** — wymaga stale działającego serwera z https, czyli łamie ADR-4. Zostaje jako ścieżka dla przeglądarki i iOS.
- **TWA (Bubblewrap)** — to nadal Web Push; samo opakowanie nie daje alarmów.
- **Periodic Background Sync** — system sam wybiera porę, nie nadaje się do przypomnień o godzinie.

### Architektura: jeden port, trzy ujścia

Nowy plik `src/lib/reminders/sink.ts`:

```ts
export interface ReminderSink {
  readonly id: "page" | "webpush" | "native";
  available(): boolean;
  /** Zastępuje cały harmonogram; idempotentne, wołane po każdej zmianie danych. */
  replace(items: readonly PushItem[]): Promise<{ ok: boolean; count: number; error?: string }>;
  clear(): Promise<void>;
}
```

- `webpush` — obecny `uploadSchedule` opakowany bez zmian zachowania.
- `native` — `src/lib/reminders/nativeSink.ts`, ładowany dynamicznie tylko w powłoce (`Capacitor.isNativePlatform()`), żeby nie dokładać nic do paczki PWA (budżet w `e2e/bundle.spec.ts`).
- `page` — timery strony zostają, jak są.
- `PushScheduleSync.tsx` wybiera ujście: `native`, gdy dostępne; inaczej `webpush`, gdy włączone.

**Jedno źródło powiadomień systemowych.** W powłoce timery strony nie wołają `showSystemNotification` (alarm systemowy odpala się też przy otwartej aplikacji). Zostają ich skutki w aplikacji: toast, licznik, „Dziś”. Bez tej reguły każde przypomnienie przyjdzie dwa razy.

**Identyfikatory.** Android wymaga liczby 32-bitowej. `id = FNV-1a(key) & 0x7fffffff`; kolizje w obrębie listy rozstrzygane deterministycznie (sortowanie po `key`, przesunięcie o 1). Test własności: 200 losowych kluczy daje 200 różnych id, a ta sama lista zawsze te same.

**`replace` jako różnica.** Pobierz oczekujące alarmy, porównaj po `id` i skrócie treści (w `extra`), anuluj zbędne, ustaw nowe i zmienione. Pełne „anuluj wszystko i ustaw od nowa” gubi alarm, który wypada akurat w trakcie.

**Horyzont.** Lista ma 14 dni. Jeśli nikt nie otworzy aplikacji przez 14 dni, serie się kończą. Ostatnim alarmem jest więc wartownik: „Otwórz G, żeby przypomnienia działały dalej” na dzień przed końcem horyzontu (tylko gdy są jakiekolwiek serie).

### Android — wymagania

| Temat | Wymaganie |
|---|---|
| Zgoda | `POST_NOTIFICATIONS` (Android 13+); prośba z kliknięcia w Ustawieniach, jak dziś `enablePush`. |
| Dokładna godzina | Dokładne alarmy z `allowWhileIdle`. Dystrybucja poza sklepem: `USE_EXACT_ALARM`. Gdyby kiedyś sklep Play: `SCHEDULE_EXACT_ALARM` i ekran prowadzący do ustawienia systemowego. Bez tego uprawnienia alarm w trybie Doze spóźnia się o minuty. |
| Kanały | Osobny kanał na każdą kategorię z `PUSH_CATEGORIES` (kategoria wynika z prefiksu klucza). Wyłączenie kategorii w Ustawieniach aplikacji nadal filtruje listę; kanał daje użytkownikowi dźwięk i ważność w systemie. |
| Ekran blokady | Widoczność „prywatna” na kanale notatek; stały tytuł notatki prywatnej już jest. |
| Restart telefonu | Sprawdzić, że wtyczka odtwarza alarmy po restarcie (`RECEIVE_BOOT_COMPLETED`). Jeśli nie — własny odbiornik. To punkt kontrolny próby, nie założenie. |
| Oszczędzanie baterii | Xiaomi, Huawei, Samsung potrafią ubić alarmy po „wymuś zatrzymanie”. W Ustawieniach wiersz „Powiadomienia mogą nie dojść” z przejściem do wyłączenia optymalizacji baterii i przyciskiem „Wyślij próbne za minutę”. |
| Limit | System pozwala na 500 alarmów na aplikację; `PUSH_MAX_ITEMS` = 200 mieści się z zapasem. |

**Przyciski „Odłóż 10 min” i „Gotowe”.**
- Etap 1: stuknięcie przycisku otwiera aplikację i idzie istniejącą ścieżką `notificationAction.ts`. Zmiana trafia do Yjs od razu.
- Etap 2 (osobna decyzja): własny odbiornik, który odkłada alarm natywnie i zapisuje akcję do kolejki; aplikacja stosuje kolejkę przy następnym starcie. Do tego czasu drugi telefon nie wie o „Gotowe” — dlatego nie w Etapie 1.

### Pułapki powłoki (lista kontrolna próby)

Każdy punkt trzeba sprawdzić na prawdziwym APK, zanim powstanie reszta:

1. **Inny origin** (`https://localhost`), więc pusta baza. Przeniesienie danych: pełna kopia albo grupa synchronizacji. Opisać w pierwszym uruchomieniu.
2. **Pobieranie plików** przez `<a download>` z `blob:` nie działa w WebView. Wspólny `downloadBlob` dostaje gałąź natywną (zapis do pliku i arkusz udostępniania). Dotyczy kopii, PDF-ów, CSV, ZIP-ów.
3. **`navigator.share`, `showSaveFilePicker`, `SpeechRecognition`** nie istnieją w WebView — ukryć albo zastąpić wtyczką. `SpeechRecognition.available()` już raz wywracało kartę.
4. **Service worker** nie jest potrzebny (pliki są w APK). Nie rejestrować go w powłoce (`registerSW.ts`); skrzynka udostępniania przez SW (4.4) nie zadziała — przyjmowanie udostępnień to osobny, późniejszy punkt.
5. **CSP** dziś przychodzi nagłówkami z `vercel.json`. W powłoce nagłówków nie ma: wygenerować `<meta http-equiv>` z tego samego źródła i dopisać test zgodności obok `securityHeaders.test.ts`.
6. **WebRTC, aparat, mikrofon, czujniki** wymagają uprawnień w manifeście Androida.
7. **Aktualizacje:** APK zawiera `dist/`, więc nowa wersja to nowy APK. Wariant „powłoka ładuje stronę z hostingu” odrzucony: zdalny kod dostałby dostęp do mostu natywnego.
8. **Budowanie:** GitHub Actions (JDK + Android SDK w runnerze), APK jako artefakt, klucz podpisu w sekretach repozytorium. Lokalnie nic nie instalować — dysk C ma ok. 2,5 GB.

### Etapy i kryteria odbioru

| Etap | Zakres | Odbiór |
|---|---|---|
| F1.0 Próba | Pusta powłoka z `dist/`, workflow budujący APK, jeden alarm „za 2 minuty”. | APK instaluje się; alarm przychodzi przy zamkniętej aplikacji, po restarcie telefonu i w trybie samolotowym. Lista pułapek 1–6 wypełniona wynikami. **Tu zapada decyzja „idziemy dalej / wracamy do Web Push”.** |
| F1.1 Port | `ReminderSink`, opakowanie `webpush`, wybór ujścia w `PushScheduleSync`. Bez zmian zachowania w PWA. | Vitest: istniejące testy `push/*` zielone bez zmian; nowy test wyboru ujścia. |
| F1.2 Ujście natywne | `nativeSink.ts`, id, różnica, wartownik, kanały. | Testy z atrapą wtyczki: różnica nie anuluje niezmienionych; kolizje id; wartownik. Paczka wejściowa PWA bez wzrostu. |
| F1.3 Jedno źródło | Timery strony w powłoce bez powiadomień systemowych. | Na telefonie: jedno powiadomienie na termin przy otwartej i zamkniętej aplikacji. |
| F1.4 Ustawienia i pliki | Ekran zgód, próbne powiadomienie, bateria; `downloadBlob` w powłoce; ukrycie funkcji z pułapki 3. | Kopia zapasowa zapisuje się i wczytuje w APK. |
| F1.5 Dokumenty | ADR-8 w `docs/adr.md`, opis w `opis.md`, `security-reviewer` na manifest i CSP. | — |

Decyzje właściciela: **N-1** czy w ogóle APK (tak → F1.0); **N-2** dystrybucja (plik z GitHub Actions czy sklep Play — zmienia uprawnienie alarmów); **N-3** czy PWA zostaje równolegle (zalecane: tak, to ten sam kod).

---

## F2. Hartowanie przekaźnika (`relay-server/`)

**Stan 2026-11-17 (Fable, Z-15.8): zrobione.** `relay-server/storage.js` według projektu niżej; odstępstwo: tożsamość (`authHash`, `epoch`, `created`) w osobnym `room.json` zapisywanym raz — brak `meta.json` nie gubi wtedy pokoju. Kryteria odbioru spełnione (testy awarii, obciążenie 200 × 2000 ze stałym czasem dopisania i stertą 9 MB po GC, testy integracyjne bez zmian protokołu). Przegląd `security-reviewer` — wynik w `opis.md`. `signaling-server/Dockerfile` czeka na SE-4 (S4.9).

### Problemy w obecnym kodzie

1. `saveNow()` (`server.js`) zapisuje **cały magazyn** jednym synchronicznym `JSON.stringify` + `writeFileSync` najpóźniej 500 ms po każdej zmianie. Koszt rośnie z sumą wszystkich pokoi, a zapis blokuje pętlę zdarzeń.
2. Wszystkie pokoje są w RAM. Limity pozwalają na 5 000 pokoi × 50 mln znaków — bez limitu łącznego jeden proces może próbować trzymać setki GB.
3. `roomBytes()` liczy sumę od zera przy każdym dopisaniu (do 5 000 wpisów).
4. Pokój powstaje przy pierwszym zapisie z dowolnym poprawnym tokenem. `creationLimited` ogranicza to per adres, ale pusty pokój żyje tyle samo co używany.
5. Awaria w trakcie zapisu jest bezpieczna (plik tymczasowy + zmiana nazwy), ale okno utraty to 500 ms potwierdzonych już wpisów.

### Projekt: pliki na pokój, dziennik tylko do dopisywania

```
data/rooms/<id>/meta.json   { authHash, last, touched, bytes, entries }
data/rooms/<id>/log.ndjson  jeden wpis na linię: {"seq":…,"at":…,"data":"…"}
data/blobs/…                bez zmian
```

- **Dopisanie** = `appendFile` jednej linii, dopiero potem odpowiedź i `notify`. Koszt nie zależy od rozmiaru pokoju ani liczby pokoi.
- **Snapshot** = nowy dziennik w pliku tymczasowym, zmiana nazwy, potem `meta.json`.
- **Kolejka na pokój** (łańcuch obietnic) pilnuje kolejności zapisów; różne pokoje nie czekają na siebie.
- **`meta.json`** zapisywany z opóźnieniem; po awarii `last`, `bytes` i `entries` odtwarza się z dziennika, a urwana ostatnia linia jest odrzucana. Dziennik jest źródłem prawdy.
- **Pamięć:** przy starcie wczytywane są tylko `meta.json`. Treść dzienników trzyma pamięć podręczna LRU z limitem bajtów (`CACHE_BYTES`, domyślnie 256 MB); odczyt spoza niej strumieniuje plik.
- **Limity łączne:** `MAX_TOTAL_BYTES` na dysku (odmowa 507 przy przekroczeniu) i licznik `bytes` prowadzony przyrostowo zamiast `roomBytes()`.
- **Młody pokój:** bez snapshotu i z mniej niż N wpisami wygasa po 24 h zamiast pełnego TTL.
- **Migracja:** jednorazowe rozbicie `relay.json` na katalogi przy starcie, stary plik zostaje jako `.bak`.

Odrzucone: **SQLite**. Dałoby transakcje, ale to zależność natywna albo `node:sqlite`, którego stabilność trzeba by śledzić; dane są nieprzezroczystymi ciągami w kolejności, więc dziennik plikowy wystarcza i zgadza się z tym, jak już leżą bloby.

### Kryteria odbioru

- `core.js` zostaje czysty (bez I/O); nowa warstwa `storage.js` ma własne testy na katalogu tymczasowym.
- Test awarii: urwana ostatnia linia, brak `meta.json`, plik tymczasowy po snapshocie — pokój wstaje bez utraty potwierdzonych wpisów.
- Test obciążenia: 200 pokoi × 2 000 wpisów, dopisanie w czasie stałym, pamięć procesu pod limitem.
- `relayServer.integration.test.ts` i `relayProvider.test.ts` zielone bez zmian protokołu.
- Przegląd `security-reviewer`; przy okazji `signaling-server/Dockerfile` (proces jako root, brak pliku blokady) i nagłówki COOP/HSTS z otwartych punktów audytu.

---

## F3. Podział `src/lib/yjsStore.ts` (1089 linii)

### Szwy

`createYjsStore` to jedno domknięcie nad `doc`, `notesMap`, `noteCache`, `dirtyNotes`, `textBases` i `persistence`. Publiczny kształt (`YjsStore`) ma zostać **identyczny**, żeby nie ruszać żadnego miejsca wywołania.

| Krok | Nowy plik | Co przechodzi | Ryzyko |
|---|---|---|---|
| 1 | `src/lib/yjs/codec.ts` | Wszystko sprzed `createYjsStore`: konwersje Y ↔ zwykły obiekt (lista zadań, właściwości, załączniki, notatka, folder). Czyste funkcje. | Brak — bez stanu. |
| 2 | `src/lib/yjs/context.ts` | Typ `StoreCtx` (`doc`, mapy, `noteCache`, `dirtyNotes`, `transact`, `touch`). | Brak — sam typ. |
| 3 | `src/lib/yjs/vault.ts` | `isLocked` … `rekeyVault`, `setLockedWriteSink` jako `createVaultApi(ctx)`. | Średnie — skarbiec; komplet testów skarbca musi przejść. |
| 4 | `src/lib/yjs/textEdit.ts` | `beginTextEdit` … `onRemoteTextChange` (`textBases`). | Średnie — współbieżna edycja. |
| 5 | `src/lib/yjs/migrations.ts` | `migrateImagesToStore`, `migrateFromLegacyIfNeeded`. | Niskie. |
| 6 | `src/lib/yjs/taxonomy.ts` | Foldery, etykiety, definicje właściwości. | Niskie. |
| — | `yjsStore.ts` | Zostaje: dokument, trwałość, pamięć podręczna i projekcje, operacje na notatkach, złożenie API. Cel: poniżej 400 linii. | — |

Przy kroku 3 usunąć `toast` z `sonner` (linia 647): komunikat „Odblokuj skarbiec…” wychodzi przez wstrzykiwane ujście, tak jak już działa `setLockedWriteSink`. Po tym `src/lib/yjsStore.ts` nie importuje nic z interfejsu.

### Zabezpieczenia

- **Przed krokiem 1:** test „kształtu API” — posortowana lista kluczy `yjsStore` jako migawka. Każdy krok musi ją zostawić bez zmian.
- **Każdy krok = osobny commit**, po którym przechodzą `npm run typecheck` (nie `tsc -p .`) i całe Vitest. Żadnych zmian zachowania w tych commitach.
- **Kolejność zdarzeń:** obserwatorzy Yjs muszą być rejestrowani w tej samej kolejności co dziś; test z dwoma dokumentami scalanymi w obie strony (jest `fast-check`) pilnuje wyniku.
- **Na końcu:** reguła ESLint zabraniająca w `src/lib/**` importów z `@/hooks`, `@/components` i `sonner`, z listą wyjątków malejącą do zera.

---

## Kolejność

1. **F1.0** — próba APK. Jedyny punkt, który może unieważnić resztę F1, więc pierwszy.
2. **F3** kroki 1–2 — bez ryzyka, odblokowują resztę podziału.
3. **F2** — niezależne od aplikacji; przed jakimkolwiek wdrożeniem przekaźnika.
4. **F1.1–F1.5**, potem **F3** kroki 3–6.

Przed F3 puścić pełne e2e na obecnym `master` (po `3a4ff293` nie przeszło w całości), żeby refaktor miał zieloną bazę.

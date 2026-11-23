# Stan planów z 15 i 17 listopada 2026

> **Data sprawdzenia:** 2026-11-20, gałąź `wip/mobile-fala1`, HEAD `9f6dcacd`.
> **Źródła, w tej kolejności:** linie „Status” w planach, `git log --all`, `opis.md`, obecność plików i funkcji w `src/` (Grep). Testów ani builda nie uruchamiano. Status „zrobione” bez hasha znaczy, że kod jest, ale żaden commit nie wymienia numeru punktu.
> **Statusy:** ✅ zrobione · ◐ częściowo · ✗ nie zrobione · ⏸ odłożone albo czeka na decyzję lub właściciela.

## Podsumowanie

| Plan | ✅ | ◐ | ✗ | ⏸ | Razem |
|---|---|---|---|---|---|
| `plan-fable-2026-11-15.md` (F1–F3) | 4 | 2 | 1 | 1 | 8 |
| `plan-architektura-2026-11-15.md` (A) | 4 | 1 | 19 | 3 | 27 |
| `plan-ruch-2026-11-15.md` (M) | 0 | 0 | 21 | 1 | 22 |
| `plan-qol-platforma-2026-11-15.md` (Q) | 5 | 4 | 15 | 3 | 27 |
| `plan-praca-2026-11-15.md` (R) | 3 | 2 | 10 | 7 | 22 |
| `plan-dlugi-2026-11-15.md` (L) | 3 | 1 | 6 | 6 | 16 |
| `plan-cwiczenia-2026-11-15.md` (C) | 1 | 0 | 17 | 6 | 24 |
| `plan-migracje-yjs-2026-11-15.md` (D) | 14 | 3 | 19 | 1 | 37 |
| `plan-security-2026-11-15.md` (S) | 6 | 3 | 29 | 7 | 45 |
| `plan-skarbiec-krypto-2026-11-15.md` (K) | 0 | 1 | 8 | 2 | 11 |
| `plan-warstwa-wizualna-2026-11-15.md` (W) | 26 | 5 | 22 | 2 | 55 |
| `zlecenia-fable-2026-11-15.md` + `audyt-fable-2026-11-15.md` (Z-1…Z-14) | 29 | 4 | 17 | 7 | 57 |
| `audyt-2-2026-11-17.md` (Z-18) | 5 | 0 | 4 | 0 | 9 |
| `plan-uzycia-fable-2026-11-17.md` (Z-15, Z-16, sesje) | 9 | 1 | 5 | 5 | 20 |
| `plan-uzycia-fable-cz2-2026-11-17.md` (Z-17, sesje) | 7 | 1 | 1 | 3 | 12 |
| **Razem** | **116** | **28** | **194** | **54** | **392** |

Specyfikacje z 17.11 bez daty w nazwie (`plan-wymiana-kodu.md`, `plan-wiadomosci-i-cofniecia.md`, `plan-dane-lokalne.md`, `plan-powiadomienia.md`, `plan-zgodnosc-i-obieg.md`, `plan-zestaw-zbieznosci.md`) opisują zlecenia Z-14.5, Z-14.6, Z-15.x, Z-16.x i Z-17.x — są policzone w tabelach planów użycia Fable, a w osobnej sekcji niżej jest tylko to, co z nich wynika ponad te zlecenia. `plan-ksef-etap2.md` powstał 16.11, więc go pominięto. `plany-2026-11-15.md` to spis bez własnych punktów.

### Decyzje właściciela z 2026-11-23 (zastępują tabelę niżej)

Podjęte w rozmowie 2026-11-23, wszystkie według rekomendacji. Tabela „Otwarte decyzje” niżej jest historyczna.

| Kod | Decyzja | Skutek dla planów |
|---|---|---|
| SE-1 | Serwerów **nie wdrażać teraz** — najpierw próba APK (F1.0) | S4.x, ADR-9, Q4.4, sesja F czekają; sesje E z kolejki mogą odpaść |
| SE-2 | Adresy serwerów **stałe**, wpisane w aplikację | CSP zawężone do własnych adresów przy wdrożeniu |
| SE-3 | **Bez** blokady całej aplikacji passkeyem — wystarczy skarbiec | S1.8 wypada |
| SE-4 | Sygnalizacja WebRTC — **publiczne serwery** na razie | `signaling-server` czeka na wdrożenie serwerów |
| SE-5 | Blobów **nie dopełniać**; opisać jako znane ograniczenie w modelu zagrożeń | S2.4 = wpis w dokumentacji |
| SE-6 | Z serwerów korzysta **tylko właściciel** | S3.2, S4.4, S4.11 w wersji dla jednej osoby |
| AR-1 | Usunąć `.claude/worktrees` (4 osierocone katalogi, 855 MB) | A5.1 |
| AR-2 | Podzielić `opis.md` na pliki działów, `opis.md` jako spis | A5.2; CLAUDE.md do aktualizacji |
| AR-3 | CI: pełne e2e tylko na `master`, na gałęziach `@smoke` | A4.2 |
| RU-1 | Przejścia między działami — przenikanie | M4.1 zrobione |
| RU-2 | Dekoracje **zostają jak są** we wszystkich stylach | — |
| QL-1, MG-4 | Migawki i kopia OPFS **bez** szyfrowania kluczem skarbca (notatki prywatne i tak są w nich zaszyfrowane) | D1.3 bez szyfrowania |
| QL-2 | Automatyczna kopia do pliku **raz dziennie** po jednorazowym wyborze folderu; bez API — przypomnienie | Q1.3, Z-16.3 |
| QL-3 | Powrót na „Dziś” po **4 godzinach** nieużywania | Q3.4 |
| PR-1 | Funkcje Pracy nieużywane 30 dni — **chować pod „Więcej”** (użycie przywraca) | R2.3 |
| PR-2 | „Należności” — **sekcja na Dziś** | R3.1, Z-14.2 |
| PR-3 | Tryb jednej ręki **domyślny na telefonie** | R4.1 |
| DL-2, DL-3, D-3 | **Bez** wspólnych wydatków i **bez** walut | Etap 3 Długów, L3.1, L3.2, L5.1, 3.5 starego planu wypadają; część „grupa” Z-17.2 też |
| CW-1 | Podpowiedź progresji **włączona domyślnie** | C2.1 |
| CW-2 | Dieta: **kcal i białko** (bez pełnego makro) | C4.2 wypada |
| CW-3 | **Bez** gotowych planów treningowych | C5.3 wypada |
| MG-1 | Kopie zapasowe — wczytywanie **bezterminowo**; migracje dokumentu — **12 miesięcy** | D7.3 |
| MG-2 | Dokument z nowszej wersji — **tylko odczyt** | D2.x |
| MG-3 | Niewidziane urządzenie przestaje blokować nowy format po **30 dniach** | D4.x |
| KR-1 | KDF — **zostaje PBKDF2 600 000** | K bez Argon2id |
| KR-2 | (domyślnie) wycofany klucz trzymany 90 dni | — |
| KR-3 | Załączniki prywatne: **20 MB / 20 plików**, powyżej 2 MB tylko lokalnie (jak jawne) | K6 |
| KR-5 | **Wariant minimalny**: K0, K1, K2, K3 bez dopisywania wpisu dla wycofanego DK, K4; K5 odpada | plan Skarbca — krypto |
| KR-6 | (domyślnie) reset kodem awaryjnym zawsze zachowuje stary klucz, bez wyboru z 3.3 | — |
| WZ-2, WZ-3 | Stylów **nie łączyć** (jasną Tablicę rozsunąć od jasnych Kafli); kreska ikon **jedna** (1,75) | W6.2, W4.2 bez tokenu na styl |
| WZ-4 | **Bez** eksportu karty jako obraz | W8.3 wypada |
| WZ-5 | **Dwie kolumny** (lista + podgląd) na szerokim ekranie | W7.4 |
| D-A4 | **Zamrażać** stawki we wpisach dziennika (po Z-17.3); do tego czasu ostrzeżenie przy zmianie stawki | B4 z audytu 2 |
| Z-6.6 | Przycisk „Usuń nieużywane pliki (N)” w Ustawieniach → Kopia i dane, z potwierdzeniem | Z-6.6 |
| D-K3 | KSeF: faktura z datą wcześniejszą — **wysyłać po potwierdzeniu** | E2.x |
| D-K4 | Serwer KSeF **lokalnie** z kolejką w aplikacji (ADR-4 bez zmian) | E2.x |
| D-K5 | Token KSeF **tylko `InvoiceWrite`** | E2.x |
| G-7 | **Bez** nakładania grafików kilku osób | G4.8 wypada |
| Precache | Próg **4,6 MiB** (zmierzone 4,57 MiB) | `e2e/bundle.spec.ts` |
| `@visual` | Wzorce: **przejrzeć różnice działami i odświeżyć**, podejrzane pokazać właścicielowi | `e2e/visual.spec.ts-snapshots` |

Nadal otwarte: KR-4 (brzmienie pytania przy zmianie hasła), C-4 (akceptacja treści 18 nowych ćwiczeń — wymaga przeczytania przez właściciela), D-Z1 (po pomiarze z Z-17.9), potwierdzenia D-F1…D-F3, D-W1, D-X1 (wdrożone domyślnie). F1.0 to próba na telefonie, nie decyzja.

### Otwarte decyzje właściciela

| Kod | Pytanie | Blokuje |
|---|---|---|
| N-1…N-3 | APK, dystrybucja, PWA równolegle — przyjęte domyślnie (ADR-8); rozstrzyga dopiero próba **F1.0** na telefonie | F1.0, R4.5, C2.6, C5.1, Z-14.6 |
| AR-1 / AR-2 / AR-3 | Usunięcie `.claude/worktrees`; podział `opis.md`; pełne e2e w CI tylko na `master` | A5.1, A5.2, A4.2 |
| RU-1 / RU-2 | Przejścia między działami; dekoracje tylko w stylach „żywych” | M4.1 |
| QL-1 | Szyfrowanie kopii OPFS — przyjęte „wcale”, do potwierdzenia | (Q1.4 zrobione według zalecenia) |
| QL-2 / QL-3 | Automatyczny zapis kopii do pliku; po ilu godzinach powrót na „Dziś” | Q1.3, Z-16.3, Q3.4 |
| PR-1 / PR-2 / PR-3 | Nieużywane funkcje; „Należności” jako zakładka czy na Dziś; tryb jednej ręki domyślnie | R2.3, R3.1 (ekran, Z-14.2), R4.1 |
| DL-2 / DL-3 | Wspólne wydatki; waluta (DL-1 przyjęte: jedna seria) | L3.1, L3.2, L5.1, część Z-17.4 |
| D-3 | Punkt 3.5 ze starego planu Długów | L5.3 |
| CW-1 / CW-2 / CW-3 | Progresja domyślnie; pełne makro; gotowe plany | C2.1 (domyślność), C4.2, C5.3 |
| C-4 | Akceptacja treści katalogu ćwiczeń | C1.5 |
| MG-1…MG-4 | Okres wsparcia starych formatów; tylko odczyt; 30 dni; szyfrowanie migawek | D7.3, D1.3 (blokada) |
| SE-1…SE-6 | Hosting serwerów; stałe adresy; blokada aplikacji passkey; własny serwer sygnalizacyjny; dopełnianie blobów; inni użytkownicy | S4.x, S1.2 wariant B, S1.8, S4.9, S2.4, S3.2, S4.11, Q4.4, sesja F |
| KR-1…KR-6 | KDF; czas wycofanego klucza; limity załączników; brzmienie pytania; czy wdrażać K2–K5; reset kodem | K2, K5, K6 |
| WZ-2…WZ-5 | Łączenie stylów; kreska ikon; eksport karty jako obraz; dwie kolumny | W6.2, W8.3, W7.4 |
| D-F1 / D-F2 / D-F3 / D-W1 | Stary pokój po 7 dniach; nowy kod proponować; przywracanie jako kopie notatek; długi kod domyślnie — przyjęte domyślnie, wdrożone, do potwierdzenia | — |
| D-X1 | Polityka nowych pól (zmieniona na „mapa boczna”) — wdrożona, do potwierdzenia | — |
| D-Z1 | Etykiety i `imageHashes` jako zbiory zamiast tablic | po pomiarze z Z-17.9 |
| D-A4 | Zamrażanie stawek we wpisach dziennika | B4 z audytu 2 |
| D-K3…D-K5 | KSeF Etap 2 (oraz token testowy) | E2.x, przegląd G+ |
| Z-6.6 | Przycisk „Usuń nieużywane pliki (N)” | Z-6.6 |

Rozstrzygnięte: D-G1, D-K1, D-K2, D-R1, D-R2, D-P1 (odłożyć), D-A1…D-A3, D-U1 (dzielenie wiadomości), WZ-1, DL-1.

### Rozbieżności między planami a kodem

- **Nieaktualne nagłówki „realizacja nie zaczęta”:** `plany-2026-11-15.md`, `plan-fable` (F2 zrobione), `plan-qol` (Q1.1, Q1.2, Q1.5 mają ✅ w tabeli), `plan-praca`, `plan-dlugi` (L2.1, L2.4, L4.3 zrobione), `plan-cwiczenia` (C1.4 zrobione), `plan-security` (S2.1, S2.2, S2.5, S2.6, S3.1 zrobione), `plan-uzycia-fable-2026-11-17` (nagłówek, a §6.1 pokazuje sesje 0, A–E jako zrobione).
- `plan-fable` „Stan 2026-11-16”: F1.4 „niezrobione”, a pliki w powłoce są w `eb3f2812` (Z-13.4).
- `plan-uzycia-fable-2026-11-17` §6.1: sesja D „podpięcie czeka” — zrobione w `89ae0a28`.
- `plan-wiadomosci-i-cofniecia.md`: Z-15.5 „wstrzymane do decyzji D-U1” — zrobione (`ee4e11ac`, `ccc5191c`).
- `audyt-2` §7: Z-18.3 i Z-18.7 bez ✅, a są w `4d5c9d59` i `bdd6552a`.
- `plan-zgodnosc-i-obieg.md` §4: Z-17.4 i Z-17.5 bez ✅, a są w `42f7502a` (L2.1) i `2a2cf5d0` (L2.4).
- `zlecenia-fable` Z-5.6 bez stanu: klient zna limit wpisu (`MAX_ENTRY_CHARS` w `relayProvider.ts`, `ac4be100`), ale serwer dalej zwraca 413 dla „Pokój pełny” (`relay-server/core.js:162`).
- `audyt-fable` kolumna „Stan” dla zadań 6 i 7 mówi „specyfikacja/plan”, a kod jest (`cfeace2c`, `29009b0d`, `61f1f203`).
- Duże pliki urosły zamiast zmaleć: `yjsStore.ts` 1089 → 1351 linii (F3: cel < 400), `exportNotes.ts` 609 → 744 (A3.1), `DebtsView.tsx` 792 → 837 (L1.1). `JournalEntrySheet.tsx` 1083 → 921 (R2.1: cel ≤ 400).

---

## 1. `plan-fable-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| F1.0 | Próba APK na telefonie | ⏸ | — | Kroki właściciela (klucz, sekrety, workflow, próba alarmów); od wyniku zależy reszta F1 |
| F1.1 | Port `ReminderSink`, wybór ujścia | ✅ | `0bbd8ca0` | `src/lib/reminders/sink.ts` |
| F1.2 | Ujście natywne, id, różnica, wartownik | ◐ | `0bbd8ca0` | Brak testów `nativePlan`/`sink` (Z-13.1, Z-13.3) |
| F1.3 | Jedno źródło powiadomień w powłoce | ✅ | `0bbd8ca0` | Niesprawdzone na telefonie |
| F1.4 | Ustawienia, pliki w powłoce | ✅ | `0bbd8ca0`, `eb3f2812` | `src/lib/native/fileShare.ts`; niesprawdzone na telefonie |
| F1.5 | ADR-8, opis, przegląd bezpieczeństwa | ◐ | `0bbd8ca0`, `ae1b2f3e` | ADR-8 jest; przegląd powłoki `security-reviewer` (Z-13.5) nie |
| F2 | Przekaźnik: dziennik na pokój, LRU, limity | ✅ | `1aa8810a` | `relay-server/storage.js`; `signaling-server/Dockerfile` czeka na SE-4 |
| F3 | Podział `yjsStore.ts` (kroki 1–6) | ✅ | `a6d17413`…`54ff28a6` + 3 | 2026-11-23: 1374 → 358 linii, `src/lib/yjs/` (9 modułów) |

## 2. `plan-architektura-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| A1.1 | Typy domeny do `lib/types/note.ts` | ✅ | `b7f25e8b` | |
| A1.2 | `View`, `motionPref`, `theme`, `dictationConsent` do `lib` | ✅ | `b7f25e8b` | |
| A1.3 | Importy komponentów z `lib` | ✅ | `b7f25e8b` | |
| A1.4 | `sonner` poza `lib` (port `notify`) | ◐ | `b7f25e8b` | `notify.ts` bez wstrzykiwanego ujścia |
| A1.5 | Hooki bez komponentów | ✗ | — | |
| A1.6 | Reguła ESLint warstw | ✅ | `b7f25e8b` | |
| A2.1–A2.5 | `Index.tsx`: mapa, efekty, kontroler, nakładki, pomiar renderów | ✗ (5) | — | Brak `docs/index-mapa.md`; `Index.tsx` 976 linii |
| A3.1 | `exportNotes.ts` → `lib/backup/` | ✗ | — | Brak `src/lib/backup/`; Z-18.1 zrobione bez podziału |
| A3.2 | `AddNoteBar.tsx` (reduktor szkicu) | ✗ | — | 974 linie |
| A3.3 | `privateNotes.ts` | ✗ | — | 793 linie |
| A3.4 | Rejestr poleceń palety | ✗ | — | |
| A4.1 | Zielona baza pełnego e2e | ✅ | 2026-11-23 | Wszystkie znane porażki naprawione (subpages, note-groups, private-notes, 6 plików przez nazwę kafla, site-sections, view-change — przejście `gap`, jobs H3.5 — animacja okna, 3 testy czasowe Vitest). `notification-action` stabilny przy 1 wątku (15/15); równolegle lokalnie `goto` przeciąża serwer podglądu — dlatego `workers: 1` w configu. Pełny przebieg CI na master do potwierdzenia |
| A4.2 | Podział CI na fragmenty | ✅ | 2026-11-23 | AR-3: pełne e2e tylko na master, gałęzie i PR na @smoke |
| A4.3 | Bez `waitForTimeout` | ✗ | — | |
| A4.4 | `PW_WORKERS` lokalnie | ✗ | — | |
| A4.5 | Testy własności scalania | ✗ | — | Specyfikacja Z-17.8 jest, pomocnik Z-17.9 nie |
| A4.6 | Wzorce starych kopii | ✗ | — | Brak `src/test/fixtures/backups/` (są tylko wzorce dokumentu z D3.1) |
| A4.7 | Stryker | ✗ | — | |
| A5.1 | Usunięcie porzuconych worktree | ✅ | `50e3d232` | 4 katalogi, 855 MB |
| A5.2 | `opis.md` na działy | ✅ | 2026-11-23 | `docs/opis/*.md` (11 działów), `opis.md` = spis; CLAUDE.md zaktualizowany |
| A5.3 | Stare plany do archiwum | ✗ | — | |
| A5.4 | Rejestr kluczy `localStorage` | ✗ | — | Brak `storageKeys.ts`; przegląd Fable czeka na szkic |
| A5.5 | `npm audit`, `knip` | ✗ | — | |

## 3. `plan-ruch-2026-11-15.md`

Żaden punkt nie ma commitu ani śladu w kodzie (brak `docs/ruch.md`, testu zgodności tokenów, testu `domMax` w `bundle.spec.ts`).

| Nr | Punkt | Status | Uwagi |
|---|---|---|---|
| M1.1–M1.6 | Zasady, test tokenów, spis `@keyframes`, `duration-*`, strażnik, `will-change` | ✗ (6) | |
| M2.1–M2.4 | Pomiar klatek, `layout`, kaskada, budżet `domMax` | ✗ (4) | |
| M3.1–M3.3 | `@starting-style`, `interpolate-size`, wspólne klasy Radix | ✗ (3) | |
| M4.1 | Przejścia między działami | ⏸ | RU-1 |
| M4.2–M4.4 | Karta → notatka, arkusze z gestem, stany list | ✗ (3) | |
| M5.1–M5.5 | Wciśnięcie, haptyka, szkielety, liczby, zrzuty i film | ✗ (5) | |

## 4. `plan-qol-platforma-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| Q1.1 | Blokada migracji między kartami | ✅ | `1ed2a2b6` | |
| Q1.2 | Zdrowie magazynu | ✅ | `1ed2a2b6` | |
| Q1.3 | Automatyczna kopia do pliku | ⏸ | `61f1f203` (tylko blokada) | QL-2; `tryWriteBackupToFile` istniało wcześniej |
| Q1.4 | Kopie dzienne w OPFS | ✅ | `69922bb8`, `5d86280a`…`18f66813` | Z-16.1 A i B; bez szyfrowania (QL-1 domyślnie) |
| Q1.5 | Widoczny błąd zapisu | ✅ | `1ed2a2b6` | |
| Q1.6 | Dziennik błędów na urządzeniu | ◐ | — | `diagnostics.ts` łapie `error`/`unhandledrejection`; nie sprawdzono pierścienia 50 i „Skopiuj” |
| Q2.1 | Trusted Types | ✗ | — | = S1.1 |
| Q2.2 | CSP z jednego źródła | ◐ | `0bbd8ca0` | `scripts/cap-prepare.mjs` robi `<meta>`; brak testu zgodności (Z-13.2) i `netlify.toml` |
| Q2.3 | COOP/HSTS, `Dockerfile` jako root | ✗ | — | Brak COOP w `vercel.json`; = S1.3, S4.9 |
| Q3.1 | `useWakeLock` | ◐ | — | Jest w `PressureTestTimer`, `NoteReader`, `FocusMode`; brak w treningu i zakupach |
| Q3.2 | Klawiatura ekranowa | ✗ | — | |
| Q3.3 | Motyw według pory | ✗ | — | |
| Q3.4 | Wznowienie po przerwie | ⏸ | — | QL-3 |
| Q3.5 | „Ostatnie” w palecie | ✗ | — | |
| Q3.6 | Schowek z sensem | ✗ | — | |
| Q3.7 | `protocol_handlers`, głębokie linki | ✗ | — | |
| Q3.8 | Oddawanie wątku przy imporcie | ✅ | `1b618ad8`, `5ee91bd7`, `c09c7e45` | Z-16.2 (`yieldToMain.ts`); eksport ZIP i indeks nie sprawdzone |
| Q3.9 | Skróty w manifeście wg użycia | ✗ | — | |
| Q4.1 | Jeden wskaźnik stanu synchronizacji | ✗ | — | |
| Q4.2 | „Co się zmieniło, gdy mnie nie było” | ✗ | — | |
| Q4.3 | Komunikat o starszej wersji urządzenia | ◐ | `75487586`, `851a4012` | Baner `docFormat` i lista urządzeń z ostrzeżeniem są; brak komunikatu z nazwą urządzenia przy blokadzie `canWriteSchema` (do sprawdzenia) |
| Q4.4 | Background Sync dla przekaźnika | ⏸ | — | SE-1 |
| Q5.1–Q5.5 | Klawiatura, ściąga skrótów, menu kontekstowe, „duże cele”, TalkBack | ✗ (5) | — | Q5.5 — właściciel |

## 5. `plan-praca-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| R1.1, R1.2 | QA na telefonie, tydzień obserwacji | ⏸ (2) | — | Właściciel; brak `docs/qa-praca-telefon.md` |
| R1.3, R1.4 | Przegląd licznika użycia, pomiar stuknięć | ✗ (2) | — | Po R1.2 |
| R2.1 | Podział `JournalEntrySheet.tsx` | ◐ | `29f6b634` | 921 linii, cel ≤ 400 |
| R2.2 | Podział `SiteCardDialog.tsx` | ✅ | `29f6b634` | 541 linii; odstępstwa w `opis.md` |
| R2.3 | Schować nieużywane | ⏸ | — | PR-1 |
| R2.4 | „Funkcje próbne” za flagą | ✗ | — | |
| R2.5 | „Zacznij dzień” | ✗ | — | |
| R2.6 | e2e Pracy bez `waitForTimeout` | ✗ | — | |
| R3.1 | „Należności” | ◐ | `ae1b2f3e` | Czysta funkcja `receivables.ts`; ekran czeka na PR-2 (Z-14.2); testy Z-14.1 brak |
| R3.2 | Oś zlecenia | ✗ | — | |
| R3.3 | „Do wystawienia” na Dziś | ✅ | `67d9758b` | `TodayInvoiceDue.tsx` |
| R3.4 | Pasek „zapłacono 40%” | ✗ | — | Dane w `receivables.ts`, brak interfejsu |
| R3.5 | Paczka dla księgowej | ✗ | — | |
| R3.6 | KSeF Etap 2 | ⏸ | — | Poza planem; plan `plan-ksef-etap2.md` czeka na D-K3…D-K5 |
| R4.1 | Tryb jednej ręki | ⏸ | — | PR-3 |
| R4.2 | Kolejka zdjęć w tle | ⏸ | — | Najpierw pomiar (Z-14.5) |
| R4.3 | Raport dnia głosem | ✅ | `67d9758b` | `speak.ts` |
| R4.4 | Wzorce budów | ✗ | — | |
| R4.5 | Alarmy natywne próby i końca dnia | ⏸ | — | Po F1.0 (Z-14.6) |
| R5.1 | Pytanie z „Jak rozwiązane?” do „Moich pytań” | ✗ | — | Niesprawdzone, czy istniało wcześniej |

## 6. `plan-dlugi-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| L1.1 | Podział `DebtsView.tsx` | ✗ | — | 837 linii (urosło); wydzielone tylko `DebtPlans.tsx`, `DebtProof.tsx` |
| L1.2 | Testy własności | ✗ | — | Czeka na pomocnik Z-17.9 |
| L1.3 | QA na telefonie | ⏸ | — | Właściciel |
| L2.1 | Raty | ✅ | `42f7502a` | Z-17.4, DL-1 |
| L2.2 | Grzeczne przypomnienie | ✗ | — | |
| L2.3 | Dane do przelewu | ✗ | — | |
| L2.4 | Zaległe na Dziś | ✅ | `2a2cf5d0` | Z-17.5 |
| L3.1, L3.2 | „Zapłaciłem za…”, grupa w historii | ⏸ (2) | — | DL-2 |
| L4.1 | Wykres salda osoby | ◐ | — | `runningBalances` używane w arkuszu osoby; nie potwierdzono wykresu SVG z planu |
| L4.2 | Miesiąc w liczbach | ✗ | — | |
| L4.3 | Zdjęcie dowodu | ✅ | `55881847` | Z-17.6, mapa `debtProofs` |
| L4.4 | PDF „Rozliczenie” | ✗ | — | |
| L5.1 | Inna waluta | ⏸ | — | DL-3 (zalecenie: nie) |
| L5.2 | Powiązanie z klientem | ⏸ | — | Zalecenie: nie robić |
| L5.3 | Punkt 3.5 starego planu | ⏸ | — | D-3 |

## 7. `plan-cwiczenia-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| C1.1 | Przegląd wizualny elementów z 12.11 | ✗ | — | |
| C1.2 | Podział `TrainingSection.tsx` | ✗ | — | Bez zmian: 717 linii |
| C1.3 | Wake Lock w sesji | ✗ | — | Brak `useWakeLock` w `cwiczenia/` |
| C1.4 | Odhaczenie = „Gotowe” | ✅ | `d2051d4c` | Z-17.7, `takeFlow.ts` |
| C1.5 | Akceptacja katalogu | ⏸ | — | Właściciel (C-4) |
| C2.1–C2.5 | Progresja, zapis jednym stuknięciem, RIR, rozgrzewka, tydzień lżej | ✗ (5) | — | Brak `suggestNext`; CW-1 dotyczy tylko domyślnego włączenia |
| C2.6 | Koniec przerwy przy zgaszonym ekranie | ⏸ | — | Po F1.0 |
| C3.1–C3.5 | Regularność, objętość, miesiąc, obwody, CSV | ✗ (5) | — | |
| C4.1 | Ulubione posiłki | ✗ | — | |
| C4.2 | Pełne makro | ⏸ | — | CW-2 |
| C4.3–C4.5 | Cel białka, średnia 7 dni, OCR etykiety | ✗ (3) | — | |
| C5.1 | Health Connect | ⏸ | — | Po F1 |
| C5.2 | Ćwiczenia na czas | ⏸ | — | Osobny projekt |
| C5.3 | Gotowe plany | ⏸ | — | CW-3 |

## 8. `plan-migracje-yjs-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| D0.1 | `docs/dane-mapa.md` | ✓ | 2026-11-23 | Generowany `scripts/dane-mapa.mjs` z testu `docMapsInventory.test.ts` |
| D0.2–D0.4 | `docs/dane-spisy.md` | ✓ | (ten commit) | Walidacja odczytu kluczy zostaje do D6.1 |
| D1.1 | Nieznane pola przeżywają edycję | ✅ | 2026-11-23 | Ostatnie: `plans`, `studySiteItems`; `vault` wyjęty z uzasadnieniem; `cleanDump` Pracy — D5 |
| D1.2 | Test dla każdej mapy | ✅ | `75487586` | Spis z zapadką |
| D1.3 | `docFormat`, baner, „Ignoruj i pisz” | ◐ | `75487586` | Bez blokady zapisu w magazynach (`docWritable`) — przyjdzie z pierwszą cechą |
| D1.4 | Granica obowiązywania | ✅ | `75487586` | |
| D2.1–D2.4 | Rejestr, wykonawca na kopii, przeniesienie, migawka | ✅ (4) | `70f3c5df` | |
| D2.5, D2.6 | Wzorce migracji, zasada znaczenia pola | ✅ (2) | `d8c73b69` | |
| D3.1 | Wzorce dokumentu 1–3 | ✅ | `963d900d` | Tylko notatki, foldery, etykiety |
| D3.2 | Test „każda wersja → bieżąca” przez rejestr | ✅ | 2026-11-23 | `src/test/fixtures/docs/registry.test.ts` |
| D3.3 | Test zbieżności migracji | ✅ | `70f3c5df` | `runner.test.ts` |
| D3.4–D3.6 | Spóźniony stary klient, wzorce kopii, rozmiar | ◐ | 2026-11-23 | D3.5 zrobione (wzorce v1–v3); D3.4 i D3.6 czekają na pierwszą migrację dokumentu |
| D4.1, D4.2 | Rejestr urządzeń, bramka | ✅ (2) | `069616d6` | |
| D4.3, D4.4 | Lista urządzeń, test przez przekaźnik | ✅ (2) | `851a4012` | |
| D5.1–D5.4 | Kopia i dokument jedną drogą | ◐ | 2026-11-23 | D5.1, D5.3, D5.4 zrobione; D5.2 razem z A3.1 |
| D6.1–D6.5 | Rejestr kluczy i pamięć lokalna | ✓ | 2026-11-23 | D6.1 (`src/lib/storage/keys.ts`), D6.3 (`migrateKey.ts`), D6.4 (zasada 11), D6.5 (`SETTINGS_KEYS` z rejestru) zrobione; D6.2 zrobione: nazwy w `src/lib/storage/names.ts`, strażnik `keyLiterals.test.ts` (wyjątek: opis migracji) |
| D7.1, D7.2, D7.4 | `dane-wersje.md`, ADR-11, wpis w `CLAUDE.md` | ✅ | 2026-11-23 | |
| D7.3 | Sprzątanie starych migracji | ⏸ | — | MG-1 |

## 9. `plan-security-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| S0.1–S0.3 | Model zagrożeń, strażnik ujść HTML, `SECURITY.md` | ✗ (3) | — | Plików brak (Z-15.0) |
| S1.1–S1.7, S1.9, S1.10 | Trusted Types, `connect-src`, nagłówki, `style-src`, sekrety, Mermaid, testy własności parserów, prywatność ekranu, SW | ✗ (9) | — | Brak COOP i `lib/net/` (Z-15.10) |
| S1.8 | Blokada aplikacji passkey | ⏸ | — | SE-3 |
| S2.1 | Wymiana kodu | ✅ | `5aadafc5`, `89ae0a28`, `d1de623c`, `c42a54c2` | Z-15.3, Z-15.4 |
| S2.2 | Kod 128-bitowy | ✅ | `dc54137a`, `89ae0a28` | Z-15.1 |
| S2.3 | Cofnięcie stanu na przekaźniku | ◐ | `91605ec5` | Punkty 1–3; zostaje część po F2 (test monotoniczności, nowe epoki po odtworzeniu) |
| S2.4 | Dopełnianie blobów | ⏸ | — | SE-5 |
| S2.5 | Limity wiadomości WebRTC | ✅ | `ee4e11ac`, `b7999ce5`, `ccc5191c` | Firefox i Safari niezmierzone |
| S2.6 | Koniec pokoi v2 | ✅ | `de0a0a08`, `89ae0a28` | Z-15.2 |
| S3.1 | Szyfrowana treść przypomnień | ✅ | `bd5a5b8a`, `cc8c6e6e`, `7c9f4e67`, `3e59ad20` | iOS niesprawdzony |
| S3.2–S3.4 | Token na urządzenie, minimalizacja, VAPID | ✗ (3) | — | |
| S4.1, S4.2 | Miejsce, `deploy/` | ⏸ (2) | — | SE-1 |
| S4.3 | Konfiguracja bez pułapek | ◐ | `1aa8810a` | Przekaźnik zrobiony, serwer powiadomień nie |
| S4.4 | Limity do warunków serwera | ✅ | `1aa8810a` | |
| S4.5, S4.6, S4.8 | Dzienniki, nadzór, aktualizacje | ✗ (3) | — | |
| S4.7 | Utrata danych przekaźnika nie gubi zmian | ◐ | `e7c64af0`, `ac4be100` | Przekaźnik przez epokę i Z-5.T; harmonogram powiadomień nie sprawdzony |
| S4.9 | `signaling-server` | ⏸ | — | SE-4 |
| S4.10 | Po wdrożeniu | ⏸ | — | SE-1 |
| S4.11 | RODO | ⏸ | — | SE-6 |
| S5.1–S5.7 | Audyt aplikacji, Dependabot, przypięte akcje, gitleaks, sumy zasobów, `--ignore-scripts`, licencje | ✗ (7) | — | `npm audit` w CI tylko w zadaniu serwerów |
| S6.1–S6.4 | Reagowanie, wyłącznik awaryjny, ekran „Bezpieczeństwo”, przegląd roczny | ✗ (4) | — | |

## 10. `plan-skarbiec-krypto-2026-11-15.md`

| Nr | Punkt | Status | Uwagi |
|---|---|---|---|
| K0 | Naprawa C-1, `parseContent` z nieznanymi polami, testy P1/P2 | ✗ | Brak commitu; `vault` na liście map bez D1.1 |
| K0.1 | Przegląd projektu, ADR-10 | ◐ | Przegląd zrobiony 15.11; ADR-10 nie |
| K1 | Pin v2 | ✗ | |
| K2, K5 | Wycofane klucze, „Dlaczego zmieniasz hasło?” | ⏸ (2) | KR-5 |
| K3, K4 | Odzysk spóźnionego zapisu, dwa skarbce | ✗ (2) | Po K2 |
| K6.1–K6.3 | Załączniki skarbca | ✗ (3) | K6.3 dodatkowo po D1.3 z blokadą i 30 dniach od D4.1 i K0 |
| K7 | Przegląd końcowy | ✗ | |

## 11. `plan-warstwa-wizualna-2026-11-15.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| W0.1 | Arkusz przeglądu ze zrzutami | ✗ | — | Brak `docs/wyglad-przeglad/` |
| W0.2, W0.3 | Skrypt metryk, test kontrastu | ✅ (2) | `6f7cc3a3` | |
| W1.1, W1.3, W1.4 | `--faint`, jedna skala cieni, warstwy | ✅ (3) | `974281cc` | |
| W1.2 | Elewacje z barwą stylu | ◐ | `974281cc` | Bez `--surface-raised` |
| W1.5 | Odstępy semantyczne | ✅ | `16a8fd10` | |
| W1.6 | Paleta danych | ✅ | `ccad9e2f` | Dwie barwy serii zamiast 8 (więcej nie ma użycia) |
| W1.7 | CSS w OKLCH | ✅ | `02b6bb65` | |
| W1.8 | Hex w TS/TSX | ✅ | `d2e63376` | |
| W2.1, W2.2 | Skala ról, rozstaw | ✅ (2) | `77094141`, `7b5300d1`, `629420d2` | |
| W2.3 | Role grubości | ✅ | `0f1035b8`, `999039f5` | |
| W2.4, W2.5 | Łamanie, interlinia | ✅ (2) | `60c04b60`, `973471e3` | |
| W2.6 | Liczby | ◐ | `999039f5` | Zostaje `materialUsage.ts`, `tabular-nums` w Grafiku i wycenach |
| W2.7 | Strażnik par rozmiar+grubość | ✅ | `629420d2` | |
| W3.1 | Warianty `Card` | ✅ | `573c83d1` | |
| W3.2 | Migracja ręcznych kart | ◐ | `a1c616bb`, `69be452f`, `d610da72` | Długi, Praca, Ustawienia; zostają Ćwiczenia, Grafik, Kalendarz, Notatki |
| W3.3 | Zagnieżdżenie kart | ✗ | — | |
| W3.4 | `ListRow` | ✅ | `2ed6a20b` | |
| W3.5, W3.6 | Rozmycie, gradienty | ✅ (2) | `9f6dcacd` | |
| W4.1 | Trzy rozmiary ikon | ◐ | `0b8a00a4` | Zostaje przegląd `size-3` i `size-6` |
| W4.2–W4.4 | Kreska ikon, ikona i tekst, stany | ✅ (3) | `13210ab6`, `52991817`, `cdbfe49a` | |
| W4.5, W4.6 | Surowe kontrolki działami, pola formularzy | ✗ (2) | — | |
| W5.1–W5.5 | Oprawa wykresu, nie tylko kolor, małe wykresy, stany puste, szkielety | ✗ (5) | — | |
| W5.6 | Obrazy | ✅ | `9f6dcacd` | |
| W6.1 | Naprawa kontrastu | ✅ | `8f01f30c` | |
| W6.2 | Karta tożsamości stylu | ✗ | — | Wynik zasila WZ-2 |
| W6.3 | `dark:` → tokeny | ✅ | `ad4dad3c` | |
| W6.4, W6.5 | `!important`, podział `index.css` | ✗ (2) | — | |
| W6.6 | `color-scheme`, `accent-color` | ✅ | `ad4dad3c` | |
| W6.7 | Wysoki kontrast | ✗ | — | |
| W7.1–W7.3, W7.5 | Wymiary, zapytania kontenerowe, rytm, bezpieczne obszary | ✗ (4) | — | |
| W7.4 | Dwie kolumny | ⏸ | — | WZ-5 |
| W8.1, W8.2 | `print.css`, zgodność PDF | ✗ (2) | — | |
| W8.3 | Obraz do udostępnienia | ⏸ | — | WZ-4 |
| W9.1 | Strażnicy w `designTokens.test.ts` | ◐ | kilka commitów W | Reguły dodawane przy punktach; brak zbiorczego zamknięcia |
| W9.2–W9.4 | Macierz `@visual`, a11y i QA, `docs/wyglad.md` | ✗ (3) | — | |

## 12. `zlecenia-fable-2026-11-15.md` i `audyt-fable-2026-11-15.md` (zadania 1–14)

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| Z-1 | Grafik wg KP (dodatek nocny, norma, odpoczynek) | ✅ | `67d9758b`, `c89b0eee` | D-G1 = nie doliczać |
| Z-1.T | Przypadki wzorcowe miesiąca, niepełny etat, okres 4 mies. | ◐ | — | Są testy `fte` w `shifts.test.ts`; brak pewności co do pełnych przypadków wzorcowych |
| Z-2.1 | `cleanRecord` nie rzuca | ✅ | `67d9758b` | |
| Z-2.2 | Walidacja tylko przed wystawieniem, „uszkodzone” | ✅ | `67d9758b` | `damaged()`, `numbers()` |
| Z-2.3 | Wystawianie w sekcji krytycznej | ✅ | `129fb3db` | |
| Z-2.4 | Daty, termin, limity, korekta bez zmian | ◐ | `129fb3db` | `validDate` w obie strony i `dueDate` są; brak limitu `qtyMilli × unitPrice ≤ MAX_SAFE_INTEGER` i limitów 512 dla stron (nie potwierdzono odmowy korekty bez zmian) |
| Z-2.5 | Rok numeru z daty wystawienia | ✅ | `129fb3db` | |
| Z-2.6 | Identyfikator urządzenia w rekordzie | ✅ | `36c7570f` | |
| Z-2.7 | F-10, F-11 z broszurą MF | ✗ | — | |
| Z-3 | Plan KSeF Etap 2 | ✅ | `7784ecc1` | `plan-ksef-etap2.md`; dalej D-K3…D-K5 |
| Z-4 | `writeContent` bez zamontowanego edytora | ✅ | `67d9758b`, `e23f4be9` | |
| Z-4.T | Testy `rebaseSplice`, zbieżność, e2e | ◐ | `e23f4be9` | Zostają przypadki brzegowe, zbieżność z B offline, test hooka/e2e, pomiar 200 KB |
| Z-5.1–Z-5.4 | Limit 16 MB, 409/413, zapis zaległości, kontrola odpowiedzi | ✅ (4) | `67d9758b` | |
| Z-5.5 | Epoka pokoju | ✅ | `e7c64af0` | |
| Z-5.6 | Limit po stronie klienta, „Pokój pełny” jako 409 | ◐ | `ac4be100` | Klient sprawdza `MAX_ENTRY_CHARS`; serwer dalej daje 413 dla „Pokój pełny” |
| Z-5.7 | Osobny licznik gniazda | ✗ | — | `onclose` dalej dzieli `retryTimer` |
| Z-5.8 | Limit czasu żądań | ✅ | `ac4be100` | 30 s dla wszystkich (plan: 120 s dla wysyłki) |
| Z-5.9 | Start bez zbędnej różnicy, kompaktowanie | ✗ | — | |
| Z-5.T | Testy klienta przekaźnika | ✅ | `ac4be100` | Bez testu gniazda przy oczekującym ponowieniu |
| Z-6 (pkt 4) | Bezpiecznik odśmiecania, poprawki `imageStore` | ✅ | `cfeace2c` | |
| Z-6.T | Testy nowych zachowań `imageStore` | ✅ | — | Przypadki są w `imageStore.test.ts` (`onAdded`); brak commitu z numerem |
| Z-6.1, Z-6.2 | „Każdy zapis ma czytelnika”, test statyczny | ✅ (2) | `29009b0d` | |
| Z-6.3 | Jedno źródło listy odwołań | ⏸ | — | Świadomie nie (opis w `opis.md`) |
| Z-6.5 | Karencja po trwałym usunięciu | ✅ | `20d4eb88` | |
| Z-6.6 | „Usuń nieużywane pliki” | ⏸ | — | Decyzja właściciela |
| Z-7 | Karta prowadząca przekaźnika, GC pod blokadą | ✅ | `cfeace2c` | |
| Z-7.T | Testy `holdTabRole`, `withLockIfFree` | ✗ | — | `tabLock.test.ts` nie zawiera `holdTabRole` |
| Z-7.1 | Hasło skarbca pod blokadą | ✅ | `61f1f203` | |
| Z-7.2 | Przypomnienia pod rolą karty | ⏸ | — | Dopiero po zgłoszeniu podwójnego dźwięku |
| Z-7.3 | Kopia do pliku pod `withLockIfFree` | ✅ | `61f1f203` | |
| Z-7.4 | e2e dwóch kart | ✗ | — | |
| Z-8 | Odłożenie, zmiana o godzinę, kotwica w `addNote` | ✅ | `b92510c5` | |
| Z-8.1 | Test `updateNote` z odłożeniem | ✗ | — | |
| Z-8.2 | `seriesMinutes` w `useCalendarMoves` | ✗ | — | |
| Z-8.3 | `reminderTime` w `reminderSpec` | ⏸ | — | Opcjonalne |
| Z-8.4 | Godzina ścienna między strefami | ⏸ | — | D-P1 = odłożyć |
| Z-9 | Niestabilny `reminders-agenda.spec.ts` | ✗ | — | |
| Z-10 | Kroje offline | ✗ | — | Brak `text-fonts` i `fonts.check` |
| Z-11 | Symulacja Pracy na dwóch dokumentach | ✗ | — | Czeka na pomocnik Z-17.9 |
| Z-12 | Testy migracji Nauki | ✅ | `5342db7c` | |
| Z-13 | Poprawka zdania o P_13/P_14 | ✅ | — | `ksef-integracja-2026-11-11.md` §1 pkt 8 poprawiony |
| Z-13.1 | Testy `nativePlan.ts` | ✗ | — | Brak pliku testu |
| Z-13.2 | Test `cap-prepare.mjs` | ✗ | — | |
| Z-13.3 | Test wyboru ujścia | ✗ | — | |
| Z-13.4 | Pliki w powłoce | ✅ | `eb3f2812` | Niesprawdzone na telefonie |
| Z-13.5 | Przegląd powłoki `security-reviewer` | ✗ | — | |
| Z-13.6 | Ikony aplikacji Android | ✗ | — | |
| F1.0 (kroki właściciela) | Klucz podpisu, workflow, próba alarmów | ⏸ | — | |
| Z-14 | Funkcja należności (R3.1) | ✅ | `ae1b2f3e` | |
| Z-14.1 | Testy `receivables.ts` | ✗ | — | Brak `receivables.test.ts` |
| Z-14.2 | Ekran „Należności” | ⏸ | — | PR-2 |
| Z-14.3 | Podział arkusza wpisu i karty budowy | ✅ | `29f6b634` | |
| Z-14.4 | R3.2, R3.5, R2.3–R2.6, Etap 4 | ✗ | — | Zbiorcze; szczegóły w §5 |

## 13. `audyt-2-2026-11-17.md`

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| Z-18.1 | Przywracanie: sprawdzanie przed zapisem, znacznik | ✅ | `5fee9907` | Bez podziału A3.1 |
| Z-18.2 | Nieznane i uszkodzone sekcje kopii, wersja | ✗ | — | |
| Z-18.3 | Kopia „przed przywróceniem” w OPFS, tekst okna | ✅ | `4d5c9d59` | W planie brak ✅ |
| Z-18.4 | Obcinanie harmonogramu po czasie, strażnik, 60 KB | ✅ | `2f312781`, `1f779158` | Część serwerowa według D-A2 |
| Z-18.5 | Przycinanie tytułów, podsumowanie | ✗ | — | |
| Z-18.6 | Rozliczenia w groszach | ✗ | — | |
| Z-18.7 | Ryczałt bez etapów | ✅ | `bdd6552a` | W planie brak ✅ |
| Z-18.8 | Import w jednej transakcji, „Cofnij ostatni import” | ✅ | `c09c7e45` | |
| Z-18.9 | Limity ZIP-a | ✗ | — | |

## 14. `plan-uzycia-fable-2026-11-17.md` (zadania 14–16, sesje)

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| Z-15.0 | S0.1–S0.3 | ✗ | — | |
| Z-15.1 | Kod długi | ✅ | `dc54137a`, `89ae0a28` | |
| Z-15.2 | Koniec v2 | ✅ | `de0a0a08`, `89ae0a28` | |
| Z-15.3 | Interfejs wymiany kodu | ✅ | `d1de623c` | |
| Z-15.4 | Testy wymiany | ✅ | `c42a54c2` | |
| Z-15.5 | Limity WebRTC | ✅ | `ccc5191c`, `ee4e11ac`, `68743e22` | |
| Z-15.6 | Cofnięcie przekaźnika | ◐ | `91605ec5` | Część po F2 |
| Z-15.7 | Szyfrowane przypomnienia | ✅ | `bd5a5b8a`, `cc8c6e6e`, `7c9f4e67`, `3e59ad20` | |
| Z-15.8 | F2 przekaźnika | ✅ | `1aa8810a` | |
| Z-15.9 | S5.1, S5.3, S5.4 i reszta S5/S6 | ✗ | — | |
| Z-15.10 | S1.3 → S1.1 → S1.6 | ✗ | — | |
| Z-16.1 | Kopie dzienne OPFS (A i B) | ✅ | `69922bb8`, `5d86280a`…`18f66813` | |
| Z-16.2 | Import porcjami | ✅ | `1b618ad8`, `5ee91bd7` | |
| Z-16.3 | Q1.3 | ⏸ | — | QL-2 |
| Z-16.4 | Q1.6 | ✗ | — | |
| Z-16.5 | Reszta Q3–Q5 | ✗ | — | |
| Z-14.5 | Zdjęcia w tle | ⏸ | — | Najpierw pomiar |
| Z-14.6 | Alarmy próby i końca dnia | ⏸ | — | Po F1.0 |
| Sesja F | Wdrożenie, ADR-9 | ⏸ | — | SE-1 |
| Sesja G | Przeglądy końcowe | ⏸ | — | Na kod z sesji C i D (gotowy) — do zaplanowania |

## 15. `plan-uzycia-fable-cz2-2026-11-17.md` (zadanie 17, sesje)

| Nr | Punkt | Status | Dowód | Uwagi |
|---|---|---|---|---|
| Z-17.1, Z-17.2 | Specyfikacje zgodności i obiegu | ✅ (2) | `59b02903` | |
| Z-17.3 | Nieznane pola w Długach i 4 mapach | ✅ | `ec8be170`, `5d290902`, `b6782ac1`, `1814f997`, `01ab4f35` | |
| Z-17.4 | Raty (L2.1) i grupa (L3.1) | ◐ | `42f7502a` | L3.1 czeka na DL-2 |
| Z-17.5 | Zaległe na Dziś | ✅ | `2a2cf5d0` | |
| Z-17.6 | Dowód przy długu | ✅ | `55881847` | |
| Z-17.7 | Odhaczenie ↔ „Gotowe” | ✅ | `d2051d4c` | |
| Z-17.8 | Specyfikacja zestawu zbieżności | ✅ | `bd7e0069` | |
| Z-17.9 | Pomocnik `convergence.ts` i testy działów | ✗ | — | Brak `src/test/convergence.ts` |
| Sesja G+ | Przeglądy diffów (L4.3, A3.3, F3, KSeF, Stryker, Z-18.1, Z-18.8) | ⏸ | — | Część diffów jest gotowa (L4.3, Z-18.1, Z-18.8) |
| Dodatek C2.6 | Krótki timer w `plan-powiadomienia.md` | ⏸ | — | Po F1.0 |
| Przegląd A5.4 | Klucze wrażliwe | ⏸ | — | Na szkic Sonneta |

## 16. Specyfikacje z 17.11 bez daty w nazwie

| Plik | Zlecenia | Stan | Co zostaje ponad zlecenia |
|---|---|---|---|
| `plan-wymiana-kodu.md` | Z-15.1–Z-15.4, sesja D | wszystko ✅ | Potwierdzić D-F1, D-F2, D-W1 |
| `plan-wiadomosci-i-cofniecia.md` | Z-15.5, Z-15.6 | ✅ / ◐ | U-2 (transport obrazów na żądanie skrótu); pomiar U-1 w Firefoksie i Safari |
| `plan-dane-lokalne.md` | Z-16.1, Z-16.2, Z-14.5 | ✅ / ✅ / ⏸ | Długie zadania przy liście po przywróceniu (koszt listy, opisany w §2.3); pomiar R4.2 |
| `plan-powiadomienia.md` | Z-15.7, Z-14.6 | ✅ / ⏸ | Punkt 9 (iOS) niesprawdzony; dodatek C2.6 |
| `plan-zgodnosc-i-obieg.md` | Z-17.3–Z-17.7 | jak w §15 | Reguła z §1.4 w `opis.md` (dział Długi) — nie sprawdzono; D-X1 do potwierdzenia |
| `plan-zestaw-zbieznosci.md` | Z-17.9 | ✗ | D-Z1 po pomiarze |

---

## Co zostało do zrobienia

**Fable (F):** F1.0 na telefonie (właściciel); testy F1.2 (Z-13.1, Z-13.3); przegląd powłoki (Z-13.5); F3 — podział `yjsStore.ts` (po A4.1).

**Architektura (A):** A4.1 zielone e2e (warunek F3, A2, A3); A1.5; A2.1–A2.5; A3.1–A3.4; A4.3–A4.7; A5.3–A5.5; po decyzjach: A4.2 (AR-3), A5.1 (AR-1), A5.2 (AR-2).

**Ruch (M):** cały plan — M1.1–M1.6, M2.1–M2.4, M3.1–M3.3, M4.2–M4.4, M5.1–M5.5; M4.1 po RU-1.

**QoL (Q):** dokończyć Q1.6, Q2.2 (test zgodności CSP), Q3.1 (trening, zakupy), Q4.3; zrobić Q2.1, Q2.3, Q3.2, Q3.3, Q3.5–Q3.7, Q3.9, Q4.1, Q4.2, Q5.1–Q5.5; po decyzjach: Q1.3 (QL-2), Q3.4 (QL-3), Q4.4 (SE-1).

**Praca (R):** R1.1–R1.4 (właściciel, potem przegląd); dokończyć R2.1 (≤ 400 linii) i R3.1 (testy Z-14.1, ekran po PR-2); R2.4–R2.6, R3.2, R3.4, R3.5, R4.4, R5.1; po decyzjach i pomiarach: R2.3, R4.1, R4.2, R4.5.

**Długi (L):** L1.1 (podział — plik urósł do 837 linii), L1.2 (po Z-17.9), L2.2, L2.3, L4.2, L4.4, potwierdzić L4.1; L1.3 (właściciel); L3.x po DL-2, L5.x po DL-3 i D-3.

**Ćwiczenia (C):** C1.1–C1.3, C2.1–C2.5, C3.1–C3.5, C4.1, C4.3–C4.5; C1.5 (właściciel); C2.6 i C5.1 po F1.0; C4.2, C5.3 po CW-2, CW-3.

**Migracje (D):** D1.1 dla `plans`, `vault`, `studySiteItems`; D1.3 blokada `docWritable` z pierwszą cechą; D3.2, D3.4–D3.6; D5.1–D5.4; D6.2 (zrobione 2026-11-23); D7.1, D7.2, D7.4; D7.3 po MG-1.

**Bezpieczeństwo (S):** S0.1–S0.3 (Z-15.0); S1.1–S1.7, S1.9, S1.10 (Z-15.10 najpierw S1.3 → S1.1 → S1.6); dokończyć S2.3 (po F2), S4.3 (serwer powiadomień), S4.7; S3.2–S3.4; S4.5, S4.6, S4.8; S5.1–S5.7 (S5.1, S5.3, S5.4 tanie, od razu); S6.1–S6.4; po decyzjach SE: S1.8, S2.4, S4.1, S4.2, S4.9–S4.11.

**Skarbiec (K):** K0 (najpierw błąd C-1 — „do wydania od razu”), ADR-10, K1, K3, K4, K6.1–K6.3, K7; K2 i K5 po KR-5.

**Warstwa wizualna (W):** dokończyć W1.2 (`--surface-raised`), W2.6, W3.2 (Ćwiczenia, Grafik, Kalendarz, Notatki), W4.1, W9.1; zrobić W0.1, W3.3, W4.5, W4.6, W5.1–W5.5, W6.2, W6.4, W6.5, W6.7, W7.1–W7.3, W7.5, W8.1, W8.2, W9.2–W9.4; W7.4 i W8.3 po WZ-5, WZ-4.

**Zlecenia Fable 15.11 (Z-1…Z-14):** dokończyć Z-1.T, Z-2.4, Z-4.T, Z-5.6 (serwer: „Pokój pełny” jako 409); zrobić Z-2.7, Z-5.7, Z-5.9, Z-7.T, Z-7.4, Z-8.1, Z-8.2, Z-9, Z-10, Z-11 (po Z-17.9), Z-13.1–Z-13.3, Z-13.5, Z-13.6, Z-14.1, Z-14.4; po decyzjach: Z-6.6, Z-14.2 (PR-2); odłożone: Z-6.3, Z-7.2, Z-8.3, Z-8.4.

**Audyt 2 (Z-18):** Z-18.2, Z-18.5, Z-18.6, Z-18.9; decyzja D-A4.

**Plany użycia Fable (Z-15, Z-16, Z-17, sesje):** Z-15.0, Z-15.9, Z-15.10, Z-16.4, Z-16.5, Z-17.9; dokończyć Z-15.6 i Z-17.4 (L3.1 po DL-2); sesja G i G+ (przeglądy diffów, część gotowa); po F1.0: Z-14.6, dodatek C2.6; po pomiarze: Z-14.5; po SE-1: sesja F; Z-16.3 po QL-2; przegląd A5.4 po szkicu.

**Do poprawy w dokumentach:** nieaktualne nagłówki i znaczniki stanu wymienione w „Rozbieżnościach” na górze.

2026-11-20: statusy w planach poprawione (`plany-2026-11-15.md`, `plan-fable-2026-11-15.md`, `plan-qol-platforma-2026-11-15.md`, `plan-praca-2026-11-15.md`, `plan-dlugi-2026-11-15.md`, `plan-cwiczenia-2026-11-15.md`, `plan-security-2026-11-15.md`, `plan-uzycia-fable-2026-11-17.md`, `plan-wiadomosci-i-cofniecia.md`, `audyt-2-2026-11-17.md`, `plan-zgodnosc-i-obieg.md`, `audyt-fable-2026-11-15.md`). Bez zmian: `zlecenia-fable` Z-5.6 (serwer nadal zwraca 413).

# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie „Ustawień i synchronizacji” (2026-10-25)

Jedenasty plan z serii „dział po dziale”, w tym samym układzie. Obejmuje okno Ustawień (karty Wygląd, Ogólne, Kopia i dane, Sync), synchronizację (WebRTC, przekaźnik E2E, plik) i kopię zapasową.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Plan Ustawień z 2026-10-19, fazy 1–3 (`cb2ecff`, `430379d`, `842db18`): potwierdzenia, struktura kart, „Kopia i dane”, reset per sekcja z listą zmian, linki `?settings=wyglad|ogolne|kopia|sync`, cofnięcie zgody na dyktowanie (`c2eeb7f`). Decyzje: reset pełny z potwierdzeniem, **bez wyszukiwania ustawień**.
- Przeglądy P1–P3 (2026-10-21): pasek skoków w Ogólne (`JumpNav`), `aria-pressed` w Układzie, Gęstości i Kolumnach, zakres kopii (push, skarbiec, odznaka), kopia przed przywróceniem, odmiana, 44 px na dotyku, diagnostyka w „Kopia i dane”.
- Synchronizacja: kod 12 znaków w `InputOTP`, link `?pair=` z QR, odrzucanie krótkich kodów, diagnoza jednym zdaniem, urządzenia w grupie z nazwami, „Odłącz”, toast z tytułem zmienionej notatki, synchronizacja przez plik, przekaźnik E2E (klient, serwer, obrazy), kropka stanu przekaźnika.
- `plan-dzialy-2026-10-22.md` §13 Poprawa 2 częściowo (stan połączenia jako `role="status"`, Fala 3), Poprawa 3 (`aria-pressed`, P1), Poprawa 4 częściowo („zakładka Efekty” usunięta).

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| §13 Popr. 1 | QR z drugiego telefonu na iPhonie otwiera link w Safari, nie w zainstalowanej aplikacji — parowanie trafia do złej przeglądarki. Brak skanera w aplikacji | brak `BarcodeDetector` w `src/` |
| §13 Popr. 2 | Surowy `lastError` na ekranie („Błąd połączenia: …” z tekstem wyjątku) | `SyncSettings.tsx:127-128` |
| §13 Popr. 4 | Teksty: „otwórz tu sam kod na nim” (niezrozumiałe), „skórka, czcionka” (w aplikacji: styl, krój), „backup” obok „kopia” | `SyncSettings.tsx:23`, `AppearanceSettings.tsx:241`, `BackupSettings.tsx:113` |
| §13 Popr. 5 | `deviceWord` w dwóch plikach zamiast `pluralPl` | `SyncSettings.tsx:34`, `OfflineQueuePanel.tsx:9` |
| §13 Dopr. | Karta Sync zaczyna od „Urządzenia w grupie”, a nowy użytkownik potrzebuje najpierw wyboru „Mam grupę / Nowa grupa”; brak paska skoków w Wyglądzie; style bez przełączania strzałkami | `SyncSettings.tsx:136,163,219` |
| §13 Rozb. | Brak „ostatnio widziane” per urządzenie (awareness niesie tylko nazwę); brak „O aplikacji” z wersją i „Co nowego” (wersja jest tylko w raporcie diagnostycznym `__APP_BUILD__`); brak kroku samouczka o kopii | `opis.md` (Synchronizacja — Ograniczenia), `diagnosticsReport.ts:42` |
| §13 Wygląd | Nagłówki sekcji jako 11-px wersaliki (`text-xs uppercase tracking-wider`) zamiast `section-label`; 5 natywnych `<select>`; karty bez wspólnego `SettingsCard` | `SyncSettings.tsx:136`, `AppearanceSettings.tsx:154,164`, `GeneralSettings.tsx:181`, `VaultSettings.tsx:57,68` |
| nowe | **Wersja aplikacji na innych urządzeniach nieznana** — starsza wersja po cichu nie widzi nowych pól (Praca, Ćwiczenia, Terminy, Skarbiec v2) | `yjsSync.ts:290` (awareness: tylko `name`) |
| nowe | Pliki kopii i eksportu mają starą nazwę: `kaczy-full-backup-…json`, `kaczy-przed-przywroceniem-…`, `kaczy-backup-…`, `kaczy-export.md` | `exportNotes.ts:60,198,408`, `BackupSettings.tsx:91,177` |
| nowe | Na telefonie automatyczna kopia nie nadpisuje jednego pliku (File System Access tylko na komputerze) — kopie zbierają się w „Pobranych” albo nie powstają; brak „Wyślij kopię” (Dysk, e-mail) | `BackupSettings.tsx:77-91` |
| opis.md | Przekaźnik: wpis > 512 KB daje błąd (brak dzielenia); zamknięcie karty w ciągu sekundy przerywa wysyłkę; hosting odłożony; brak TURN | `opis.md` (Synchronizacja — przekaźnik), pamięć 2026-10-23 |
| opis.md | E2E Ustawień i Sync nieuruchomione w całości od 2026-10-20; QA na telefonie nie zrobione | `opis.md` (Ustawienia — Testy) |

**Powiązania:** ostrzeżenie o starszej wersji (2.1 tutaj) jest warunkiem dla Praca 3.1, Ćwiczenia C-1, Terminy T-1 i Skarbiec 3.1 — w planie Pracy opisane jako 3.1, **wdrażane tutaj**. Skarbiec 1.6 (auto-blokada w kopii), 2.5 (karta stanu). Plan przekrojowy (komponenty, tokeny) przed Etapem 5.

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB): `yjsSync` jest w paczce startowej — zmiany w awareness minimalne; okno Ustawień i karty leniwe; skaner QR (`BarcodeDetector` / biblioteka zapasowa) tylko na żądanie.
- **Prywatność:** awareness i przekaźnik nie niosą treści; wersja aplikacji i nazwa urządzenia to jedyne nowe pola. Raport diagnostyczny bez kodu parowania (test istnieje).
- **Zgodność:** nazwy kluczy `kaczy.*` w localStorage i IndexedDB zostają (zmiana = utrata danych); zmieniają się tylko nazwy plików widoczne dla użytkownika.
- **WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Błędy po ludzku:** `lastError` mapowany na zdania („Serwery nie odpowiadają”, „Przeglądarka blokuje połączenie”, „Brak internetu”); surowy tekst tylko w raporcie diagnostycznym. | `SyncSettings.tsx:127`, `yjsSync.ts` (`errorKind`) | 2 | S |
| 1.2 | **Teksty:** „Drugie urządzenie jeszcze nie dołączyło — wpisz na nim ten kod albo zeskanuj QR”; „styl, krój” zamiast „skórka, czcionka”; „kopia” zamiast „backup” w całym oknie; test słownika (`grep` w teście na zakazane słowa w `components/settings`). | `SyncSettings.tsx:23`, `AppearanceSettings.tsx:241`, `BackupSettings.tsx:113` | 1 | S |
| 1.3 | **`deviceWord` → `pluralPl`** w obu miejscach. | `SyncSettings.tsx:34`, `OfflineQueuePanel.tsx:9` | 1 | S |
| 1.4 | **Nazwy plików:** `hydra-kopia-RRRR-MM-DD.json`, `hydra-przed-przywroceniem-…`, `hydra-eksport.md` (po decyzji U-1). Przywracanie przyjmuje stare i nowe nazwy (nazwa nie ma znaczenia przy odczycie — test). | `exportNotes.ts`, `BackupSettings.tsx` | 1 | S |
| 1.5 | **Pełne e2e Ustawień i Sync** (lista z `opis.md`) jako punkt odniesienia. | `e2e/` | 2 | S |

## Etap 2: synchronizacja

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Wersja na innych urządzeniach:** awareness niesie `device: { name, version, schema }` (`schema` = numer zmian formatu, rośnie przy zmianie pól w Pracy, Ćwiczeniach, Terminach, Skarbcu). Lista urządzeń pokazuje wersję; gdy któreś ma niższy `schema`, baner w aplikacji „„Telefon” ma starszą wersję — część danych może być na nim niewidoczna. Zaktualizuj go.” Nowe formaty zapisują się dopiero, gdy wszystkie widziane urządzenia mają wymagany `schema` (funkcja `canWriteSchema(n)`). | 3 | M |
| 2.2 | **Ostatnio widziane:** każde urządzenie zapamiętuje lokalnie (`localStorage`) czas ostatniego widzenia innych urządzeń po nazwie i `clientID`; lista: „Telefon — teraz”, „Komputer — 2 dni temu”. Bez nowych danych w Yjs. | 2 | S |
| 2.3 | **Skaner QR w aplikacji:** „Zeskanuj kod” w „Dołącz do grupy” — `BarcodeDetector` (Android Chrome) z podglądem kamery; bez API — zdjęcie kodu z galerii przez lekką bibliotekę ładowaną na żądanie albo komunikat „wpisz kod ręcznie”. Na iOS rozwiązuje problem QR → Safari. **Decyzja U-2** (biblioteka zapasowa czy sam komunikat). | 2 | M |
| 2.4 | **Kolejność w karcie Sync:** bez grupy — dwa duże wybory „Mam już grupę (wpisz albo zeskanuj kod)” / „Zacznij nową grupę”; z grupą — urządzenia, „Dodaj urządzenie”, przekaźnik, plik, „Odłącz” na dole. | 2 | S |
| 2.5 | **Przekaźnik — duże wpisy:** dzielenie aktualizacji > 512 KB na części (numerowane, składane po stronie odbiorcy), test na dokumencie z dużą notatką; wysyłka przy `visibilitychange: hidden` przez `fetch(..., { keepalive: true })`, żeby zamknięcie karty nie przerywało. | 2 | M |
| 2.6 | **„Zgodność ze starszą wersją” (stary pokój):** gdy przez 30 dni żadne urządzenie nie pojawiło się w starym pokoju, przełącznik wyłącza się sam z komunikatem; potem do usunięcia w kodzie. **Decyzja U-3.** | 1 | S |

## Etap 3: kopia i dane

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Wyślij kopię:** „Wyślij kopię…” (`navigator.share` z plikiem JSON) — Dysk Google, e-mail, komunikator; na telefonie główna droga zamiast pobierania. Przypomnienie o kopii proponuje „Wyślij” na telefonie, „Pobierz” na komputerze. | 3 | S |
| 3.2 | **Podgląd kopii przed przywróceniem:** data, urządzenie, liczby (notatki, wpisy Pracy, dni Grafiku, długi), wersja aplikacji, która ją zrobiła; ostrzeżenie, gdy kopia jest z nowszej wersji. | 2 | S |
| 3.3 | **Stan danych:** „Zajęte: 412 MB (zdjęcia 380 MB, notatki 12 MB…)” z podziałem (Praca 3.2 dla zdjęć budów), trwałość pamięci (`persist()`) z wyjaśnieniem i przyciskiem „Poproś o trwałe przechowywanie”. | 2 | S |
| 3.4 | **Krok samouczka o danych:** „Twoje notatki są tylko na tym urządzeniu — zrób kopię albo połącz drugie urządzenie” z dwoma przyciskami. | 2 | S |

## Etap 4: „O aplikacji”

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Sekcja „O aplikacji”** (na dole „Kopia i dane” albo jako piąta pozycja w menu „⋯” okna): nazwa, wersja i data builda (`__APP_BUILD__`), stan Service Workera („Aktualna” / „Nowa wersja gotowa — Odśwież”), link do diagnostyki, licencje bibliotek (generowane przy buildzie). | 2 | S |
| 4.2 | **„Co nowego”:** po aktualizacji jednorazowy dymek „Co nowego w wersji …” z 3–5 punktami; pełna lista w „O aplikacji”. Źródło: ręcznie pisany `src/content/changelog.ts` (krótkie zdania dla użytkownika, nie commity). **Decyzja U-4.** | 2 | M |

## Etap 5: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Jeden `SettingsCard`** (nagłówek, opis, treść, reset sekcji) we wszystkich kartach; tokeny promieni i cieni z planu przekrojowego. | 2 | M |
| 5.2 | **Nagłówki sekcji jako `section-label`** zamiast 11-px wersalików; `h3` z poziomami zgodnymi z dokumentem. | 1 | S |
| 5.3 | **`Segmented` zamiast natywnych `<select>`** tam, gdzie wyborów jest ≤ 5 (auto-blokada, dzień tygodnia, kolumny), `Select` z `ui/` dla dłuższych list. | 1 | M |
| 5.4 | **Pasek skoków w Wyglądzie** (jak `JumpNav` w Ogólne): Motyw, Styl, Krój, Układ, Efekty. Style i kroje przełączane strzałkami (grupa radiowa), podgląd bez przejścia widoku. | 1 | S |
| 5.5 | **Okno na telefonie:** pełny ekran z zakładkami przyklejonymi u góry (dziś zawijają się w kilka wierszy), przycisk zamknięcia w zasięgu kciuka. | 2 | S |

## Etap 6: QA

- Pełne e2e (1.5) i po każdym etapie; nowe: wersja w awareness i baner (2.1, dwa konteksty przeglądarki), „ostatnio widziane” (2.2), duży wpis przez przekaźnik (2.5, test integracyjny z serwerem), podgląd kopii (3.2).
- Ręcznie na telefonie: skaner QR (Android i iPhone), „Wyślij kopię” do Dysku, okno na pełnym ekranie, parowanie dwóch telefonów od zera.
- axe: wszystkie karty we wszystkich motywach.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| U-1 | Nazwa w plikach kopii (1.4)? Aplikacja nazywa się „hydra” (manifest, tytuł, logo — od 2026-10-25). | `hydra-kopia-RRRR-MM-DD.json`, `hydra-przed-przywroceniem-…`, `hydra-eksport.md`. Klucze `kaczy.*` w pamięci przeglądarki zostają. |
| U-2 | Skaner QR (2.3): lekka biblioteka zapasowa dla iOS czy tylko komunikat? | Biblioteka na żądanie (poza paczką startową) — iPhone to właśnie przypadek, który dziś nie działa. |
| U-3 | Usunąć „Zgodność ze starszą wersją” (2.6)? | Tak, po 30 dniach bez urządzeń w starym pokoju — automatycznie i z komunikatem. |
| U-4 | „Co nowego” (4.2): pisać przy każdym wydaniu? | Tak, 3–5 zdań; jeśli wydanie ma tylko poprawki — bez dymka. |

## Kolejność wdrażania

1. Etap 1: 1.5, 1.1, 1.2, 1.3, 1.4 (po U-1).
2. Etap 2: 2.1 (najważniejsze — odblokowuje zmiany formatu w innych planach), 2.2, 2.4, 2.3 (po U-2), 2.5, 2.6 (po U-3).
3. Etap 3: 3.1, 3.2, 3.3, 3.4.
4. Etap 4: 4.1, 4.2 (po U-4).
5. Fundament z planu przekrojowego, potem Etap 5.
6. Etap 6 na koniec.

Ostatni plan w serii: **powłoka** (pasek boczny, dolny pasek, nagłówek, paleta poleceń, nazwa aplikacji) — `plan-dzialy-2026-10-22.md` §0.

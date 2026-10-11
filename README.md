# Notatnik (NOTKI / kaczy)

Lokalna aplikacja notatkowa (PWA) — React + TypeScript + Vite + shadcn/ui, z wbudowanym **Grafikiem zmian pracy** (liczenie norm, nadgodzin i zarobku wg Kodeksu pracy).

Dane żyją w przeglądarce (IndexedDB, przez Yjs). Aplikacja nie ma backendu ani konta użytkownika, ale **ma prawdziwą synchronizację między urządzeniami**: CRDT (Yjs) + transport P2P przez WebRTC (`y-webrtc`) — opt-in, wyłączony domyślnie, włącza się parowaniem kodem/QR w Ustawienia → Sync.

Ten plik jest pełną dokumentacją projektu: funkcje, obsługa, architektura, bezpieczeństwo, uruchomienie i wdrożenie. Historia decyzji i audytów: [`roadmap.md`](./roadmap.md) oraz [`docs/FEATURES-LOG.md`](./docs/FEATURES-LOG.md).

## Spis treści

1. [Uruchomienie i skrypty](#uruchomienie-i-skrypty)
2. [Funkcje](#funkcje)
3. [Grafik zmian](#grafik-zmian)
4. [Przypomnienia i powiadomienia](#przypomnienia-i-powiadomienia)
5. [Prywatne notatki (skarbiec)](#prywatne-notatki-skarbiec)
6. [Synchronizacja, kopie zapasowe, import i eksport](#synchronizacja-kopie-zapasowe-import-i-eksport)
7. [Skróty klawiszowe i szybkie wprowadzanie](#skróty-klawiszowe-i-szybkie-wprowadzanie)
8. [Adresy (routing)](#adresy-routing)
9. [Architektura](#architektura)
10. [Bezpieczeństwo i prywatność](#bezpieczeństwo-i-prywatność)
11. [Dostępność i wydajność](#dostępność-i-wydajność)
12. [Testy](#testy)
13. [Wdrożenie](#wdrożenie)
14. [Znane ograniczenia i plan rozwoju](#znane-ograniczenia-i-plan-rozwoju)

## Uruchomienie i skrypty

```sh
npm install
npm run dev           # serwer deweloperski
npm run build         # build produkcyjny
npm run preview       # podgląd builda produkcyjnego
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit -p tsconfig.app.json
npm test              # testy jednostkowe (Vitest)
npm run test:watch    # testy jednostkowe w trybie watch
npm run test:coverage # pokrycie testami
npm run test:e2e      # testy e2e (Playwright) — buduje i odpala podgląd produkcyjny sam
```

`npm run test:e2e` wymaga pobranych przeglądarek Playwright — jednorazowo: `npx playwright install chromium`.

**Pakiety:** projekt używa **npm** (`package-lock.json`). Nie dodawać `bun.lock`/`bun.lockb` ani `yarn.lock`, żeby uniknąć rozjazdu wersji zależności. Wymagany Node ≥ 18.18.

## Funkcje

### Notatki

- **Treść:** tekst z Markdownem, listy zadań, rysowanie odręczne, obrazy (większe niż 2 MB są automatycznie zmniejszane; wklejanie ze schowka także w edycji istniejącej notatki) i załączniki plików, szablony szybkiego startu, notatka dzienna.
- **Organizacja:** kolory, etykiety, foldery (zagnieżdżone), przypinanie, priorytety, archiwum i kosz z odliczaniem, ręczna kolejność (przeciąganie), grupowanie wg daty/etykiety/folderu ze zwijanymi sekcjami, sortowanie (także „ostatnio otwierane”).
- **Wyszukiwanie:** pełnotekstowe (Fuse.js, indeks cache'owany per lista notatek), bez rozróżniania ogonków („zolta” znajduje „żółta”) i z wieloma słowami naraz (każde musi pasować, kolejność bez znaczenia); operatory (`etykieta:`/`label:`, `kolor:`, `ma:przypomnienie|obraz|lista|zalacznik`, `folder:`, `priorytet:wysoki|sredni|niski`, `brak:przypomnienia|etykiety|folderu`, `przypięte`, `lista:otwarte`, `starsze:`/`nowsze:`), negacja operatora przedrostkiem `-` (np. `-etykieta:praca`), zapisane filtry w pasku bocznym, „Ostatnio szukane” w palecie poleceń.
- **Powiązania:** linki wiki `[[tytuł]]` z podglądem po najechaniu, „Niepołączone wzmianki”, graf powiązań (do 150 węzłów); zmiana tytułu notatki przepina `[[linki]]` w pozostałych notatkach (z „Cofnij”).
- **Zaznaczanie wielu:** pole przy kafelku (po najechaniu; na dotyku zawsze widoczne) otwiera pasek zbiorczy. Na liście: kolor, archiwizacja, kosz; w Koszu: przywróć lub usuń trwale; w Archiwum: przywróć.
- **Szkic:** tytuł, treść i pozycje listy nowej notatki przeżywają przeładowanie strony (w `localStorage`, jawnie — poza skarbcem).
- **Listy zadań:** merge CRDT na poziomie pojedynczej pozycji, podzadania (Tab / Shift+Tab), Enter dodaje pozycję pod spodem, Backspace na pustej ją usuwa, „Usuń ukończone” (z „Cofnij”), wklejanie wielu linii jako pozycji, konwersja tekst ↔ lista, `Ctrl+Shift+L` zamienia zaznaczone linie na listę; w czytniku pozycje można odhaczać.
- **Edytor:** **menu „/”** (nagłówki, zadanie, listy, cytat, blok kodu, separator, data; strzałki + Enter/Tab, Esc chowa), `Ctrl+B/I/K`, **znajdź i zamień** (`Ctrl+F` / `Ctrl+H`), kontynuacja list, przenoszenie i duplikowanie linii, licznik słów/znaków/czasu czytania, wklejanie obrazu ze schowka, **dyktowanie głosowe** (Web Speech API, pl-PL — w Chrome nagranie trafia do usługi rozpoznawania mowy Google; wymaga zgody przy pierwszym użyciu).
- **Czytnik i prezentacja:** szybki podgląd (Spacja), tryb skupienia, tryb prezentacji z Wake Lock.
- **Historia:** wersje notatki i historia akcji z cofaniem (`Ctrl+Z`).
- **Przegląd tygodnia** w widoku „Dziś”: zaległe przypomnienia, listy do dokończenia, notatki nietknięte ≥ 30 dni, do posegregowania (tryb „po kolei”).
- **Gamifikacja:** osiągnięcia z pieczątką, statystyki, passy; motyw sezonowy; efekty (animacje, haptyka) wyłączalne w ustawieniach.

### Widoki

Notatki, Dziś, Ten tydzień, Przypomnienia (agenda: zaległe/dziś/…), **Kalendarz** (miesiąc + pasek tygodnia + „Dziś i jutro”, przeciąganie terminów, eksport `.ics`), **Grafik**, Archiwum, Kosz, widok folderu i etykiety. Telefon: dolna nawigacja i edytor na pełnym ekranie.

### PWA

Instalacja jako aplikacja, praca offline (service worker, `offline.html`), skrót „Nowa notatka”, **Web Share Target** (tekst i linki z innych aplikacji), znaczek z liczbą zaległych przypomnień „(N) NOTKI”, odświeżanie „dziś” po północy i po wznowieniu karty.

## Grafik zmian

Osobny dział (`/grafik`) do planowania i rozliczania pracy zmianowej. Dane Grafiku są częścią tego samego dokumentu Yjs co notatki, więc synchronizują się i wchodzą do kopii zapasowej.

**Planowanie**

- **Rodzaje zmian:** nazwa, skrót, kolor (8 kolorów), godziny, przerwa (opcjonalnie z godziną rozpoczęcia), stawka za godzinę, rodzaj (praca / nieobecność: urlop, L4, inne), **alarm w eksporcie `.ics`** (domyślny / bez alarmu / 15 min – 12 h przed). Startowe: Dzień, Popołudnie, Noc, Urlop, L4, Budowa, Dniówka.
- **Nanoszenie:** „pędzel” — wybierz rodzaj i stuknij w dni; ponowne stuknięcie zdejmuje; „Wolne” czyści; „Szczegóły” otwiera okno dnia.
- **Własne godziny pędzla:** pod paskiem pędzli ustaw Od / Do / Przerwa (albo długość 4–12 h) — stuknięcie nanosi zmianę z tymi godzinami.
- **Okno dnia:** rodzaj zmiany, odchylenie od planu (±15 min), ręczne godziny tego dnia, „poza grafikiem”, „w dzień wolny za niedzielę/święto”, notatka.
- **Cykle:** wzory powtarzane od daty (np. czterobrygadowy 2D 2N 4W, trzyzmianowy tydzień po tygodniu); własne cykle zapisywane.
- **Widoki:** miesiąc i tydzień (z terminami z Kalendarza); przenoszenie i kopiowanie zmian (mysz, `Alt`, dotyk, `Shift+strzałki`, `Ctrl+C/V`); „skopiuj tydzień na następny”; wszystkie operacje z „Cofnij”.
- **Karta „Teraz”:** bieżąca i następna zmiana z postępem; **„Skończyłem teraz”** liczy odchylenie od planu jednym kliknięciem (z „Cofnij”).
- **Wieczorne przypomnienie** o jutrzejszej zmianie (godzina w Ustawieniach grafiku, ustawienie na urządzeniu).

**Rozliczanie** (na podstawie art. 129–151¹⁰ KP)

- Norma miesiąca wg art. 130 KP, proporcjonalna do etatu, pomniejszona o nieobecności w dni robocze.
- System czasu pracy: podstawowy (8 h/dobę) lub równoważny (do 12 h wg grafiku). Okres rozliczeniowy 1/2/3/4/6/12 miesięcy; nadgodziny ponad normę wychodzą w ostatnim miesiącu okresu.
- Nadgodziny dobowe w dobie pracowniczej (24 h od początku zmiany); dodatek **100%**: pora nocna (21–7, 8 h wg ustawienia), niedziela i święto wolne wg grafiku, dzień wolny za niedzielę/święto, przekroczenie normy okresu; pozostałe **50%**.
- Niepełny etat: godziny ponadwymiarowe bez dodatku do granicy z umowy.
- Odpoczynek dobowy: ostrzeżenie przy mniej niż 11 h (art. 132 KP). Święta ustawowe wyliczane automatycznie.
- Zarobek brutto ze stawką domyślną i stawkami per rodzaj zmiany.
- **Urlop:** roczny wymiar (20/26 lub własny), licznik wykorzystany/planowany/pozostały, podsumowanie roku (`YearSummaryDialog`).

**Eksport**

- **`.ics`** — zmiany jako wydarzenia (zmiana nocna kończy się następnego dnia, nieobecności jako całodniowe, alarm per rodzaj), ponowny import aktualizuje wpisy, wyczyszczone dni są odwoływane.
- **Karta czasu `.csv`** — dni miesiąca z godzinami, nocą, odchyleniem i notatką + sumy (przepracowane, norma, nadgodziny, 100%, zarobek); separator `;` i BOM, otwiera się w polskim Excelu; wartości zaczynające się od `=`/`+`/`-`/`@` są neutralizowane.

## Przypomnienia i powiadomienia

- **Przypomnienia:** jednorazowe i cykliczne (serie z końcem), język naturalny w polu („jutro 9:00”, „za 2 godziny”), odkładanie (10 min / jutro 9:00), przesuwanie terminu w Kalendarzu.
- **Powiadomienia systemowe** (`lib/systemNotification.ts`): przez service worker, z przyciskami **„Odłóż 10 min”** i **„Gotowe”**, wibracją i pozostawaniem na ekranie do reakcji. Kliknięcie otwiera notatkę (`public/sw-notifications.js` → wiadomość do otwartej karty). Przy notatkach prywatnych treść nie jest pokazywana.
- **Ważne ograniczenie:** aplikacja nie ma serwera push, więc powiadomienia wystrzeliwują tylko przy otwartej aplikacji (sprawdzanie co 15 s). Przy zamkniętej karcie przypomni dopiero kalendarz systemowy po imporcie `.ics`. Prawdziwy Web Push wymagałby serwera z kluczami VAPID.
- Zgoda na powiadomienia jest proszona przy ustawianiu terminu, nie na starcie.

## Prywatne notatki (skarbiec)

- Jedno hasło (min. 8 znaków); PBKDF2-SHA-256 600 000 iteracji + sól 16 B → klucz opakowujący losowy klucz danych (AES-256-GCM, IV 12 B na zapis, AAD = id notatki, format `v1.<iv>.<ct>`). Opcjonalny kod awaryjny, pokazywany raz. Klucz tylko w pamięci (`extractable: false`).
- W dokumencie zostają kolor, przypięcie, folder, daty i termin; tytuł/treść/lista/etykiety są w szyfrogramie. Zablokowana notatka ma pustą projekcję, więc wyszukiwanie, graf, przegląd, eksport, backup i powiadomienia nie mają czego wyciec.
- Auto-blokada: 1/5/15/30 min lub nigdy, ukrycie karty > 1 min, ręczna (we wszystkich kartach). Limit prób odblokowania.
- Ograniczenia: notatki z obrazami/załącznikami nie da się zablokować (pliki nie są szyfrowane); prywatne notatki nie biorą udziału w wyszukiwaniu nawet po odblokowaniu; wersje wyłączone; skarbiec chroni od momentu blokady, nie wstecz (starsze backupy/urządzenia mogą mieć jawną treść).

## Synchronizacja, kopie zapasowe, import i eksport

- **Sync P2P:** Ustawienia → Sync, kod parowania lub QR (`?pair=` tylko wstępnie wypełnia pole). Domyślne publiczne serwery sygnalizacyjne `y-webrtc`; własny serwer: [`signaling-server/`](./signaling-server/README.md). Treść notatek nie przechodzi przez serwer sygnalizacyjny. Obrazy synchronizują się osobnym kanałem (limit 2 MB na plik w P2P).
- **Backup:** pełna kopia całej bazy (JSON v3, w tym Grafik i ustawienia), opcjonalnie do jednego, stale nadpisywanego pliku (File System Access API), przypomnienia o kopii.
- **Eksport:** notatki do PDF / Markdown / HTML / JSON oraz **ZIP z osobnymi plikami `.md`** (cała baza albo zaznaczone; frontmatter z tytułem, etykietami i datami, foldery jako katalogi, bez obrazów i załączników, notatki prywatne pomijane — da się je wczytać z powrotem przez import Markdown); terminy do `.ics`; Grafik do `.ics` i `.csv`.
- **Import:** Google Keep (JSON/HTML/ZIP) i Markdown/Obsidian — z podsumowaniem i „Cofnij”.

## Skróty klawiszowe i szybkie wprowadzanie

Pełna lista pod `?` w aplikacji. Najważniejsze:

| Skrót | Działanie |
| --- | --- |
| `Ctrl+N` / `Ctrl+K` / `Ctrl+Z` | nowa notatka / paleta poleceń / cofnij |
| `/` lub `Alt+S` | fokus na wyszukiwarkę |
| `g` + `n d w p c a k` | przejście do widoków (Notatki, Dziś, Tydzień, Przypomnienia, Kalendarz, Archiwum, Kosz) |
| `Ctrl+B` / `Ctrl+I` / `Ctrl+K` | pogrubienie / kursywa / link w treści |
| `Ctrl+F` / `Ctrl+H` | znajdź i zamień w treści notatki |
| `Ctrl+Shift+L` | zaznaczone linie na listę zadań |
| `Tab` / `Shift+Tab` | wcięcie / cofnięcie wcięcia (podzadanie na liście zadań) |
| `Alt+↑/↓`, `Shift+Alt+↓` | przenieś / duplikuj linię lub pozycję listy |
| `Ctrl+Enter` | zapisz i zamknij edytor |
| `Spacja` / `Enter` / `A` / `P` / `D` / `Delete` | na liście notatek: podgląd / otwórz / archiwizuj / przypnij / duplikuj / usuń |
| Kalendarz: strzałki, `PgUp/PgDn`, `Enter`, `Shift+←/→` | dni, miesiąc, dodaj termin, przesuń termin |

**Szybkie wprowadzanie** w polu nowej notatki: `#etykieta`, `@folder`, `!` / `!!` (priorytet średni/wysoki), fraza daty na końcu jako przypomnienie — rozpoznane elementy widać jako chipy z możliwością zignorowania.

## Adresy (routing)

| Ścieżka | Widok |
| --- | --- |
| `/` | Notatki |
| `/dzis`, `/tydzien` | Dziś, Ten tydzień |
| `/przypomnienia`, `/kalendarz`, `/grafik` | Przypomnienia, Kalendarz, Grafik |
| `/archiwum`, `/kosz`, `/widget` | Archiwum, Kosz, widok widżetu |
| `/folder/:id`, `/etykieta/:nazwa` | folder, etykieta |
| `/notatka/:id` | otwarcie konkretnej notatki |
| `?q=` | zapytanie wyszukiwarki (zachowuje `?pair=`, `?share=`, `?new=`) |

## Architektura

```
src/
  pages/Index.tsx        główny ekran: składa widoki, skróty, powiadomienia
  components/            UI (shadcn/ui + Radix); podkatalogi: calendar, shifts, settings, sidebar, vault, review
  hooks/                 useNotes, useFilteredNotes, useReminderNotifications, useViewRoute, useDictation, …
  lib/
    yjsStore.ts          dokument Yjs + projekcja inkrementalna notatek (źródło prawdy)
    yjsSync.ts           transport P2P (y-webrtc), kody parowania
    shifts/              model, store (Yjs), summary (KP), ics, timesheet, holidays, pattern, move
    vault.ts, privateNotes.ts   szyfrowanie notatek prywatnych
    import/              Keep, Markdown, ZIP
    searchNotes.ts, searchQuery.ts   wyszukiwanie i operatory
    systemNotification.ts    powiadomienia przez service worker
public/sw-notifications.js   obsługa kliknięć i przycisków powiadomień (importScripts w SW)
signaling-server/        opcjonalny, własny serwer sygnalizacyjny
e2e/                     testy Playwright
```

Zasady:

- **Jedno źródło prawdy:** dokument Yjs w IndexedDB. Notatki, Grafik i metadane skarbca są jego częściami; UI czyta projekcję i zmienia dane akcjami. Projekcja jest inkrementalna — nietknięte notatki zachowują tożsamość obiektu, więc `memo` i filtry mają co porównywać.
- **Merge na poziomie pól:** pozycje listy zadań i dni Grafiku są osobnymi wpisami Y.Map, więc równoległe edycje różnych elementów się scalają.
- **Obliczenia czyste:** reguły Grafiku (`lib/shifts/*`) to czyste funkcje testowane jednostkowo; komponenty tylko składają widok.
- **Dane z zewnątrz są nieufne:** wszystko, co przychodzi od peera, z backupu lub importu, przechodzi walidację schematem (zod / `safe*`), a pola nieznane (z nowszej wersji) są zachowywane.
- **Podział kodu:** rzadkie panele i widoki (Kalendarz, Grafik, Statystyki, paleta poleceń, renderer Markdown, eksport PDF) ładowane leniwie.
- **Stan lokalny urządzenia** (ustawienia widoku, godzina przypomnienia wieczornego, zgoda na dyktowanie) w `localStorage` przez `createPersistedStore`, nie w dokumencie Yjs.

## Bezpieczeństwo i prywatność

- Brak backendu i kont; dane zostają w przeglądarce, dopóki użytkownik nie włączy sync P2P.
- Markdown renderowany bez surowego HTML; linki filtrowane (`safeUrl`); brak automatycznych zdalnych obrazów; eksport HTML z CSP.
- Walidacja linku `?share=` i obrazów z zewnątrz (typ MIME, rozmiar); import ZIP z blokadą ścieżek (`..`, absolutnych) i limitami.
- Dziennik zdarzeń bezpieczeństwa w diagnostyce (np. nieudane odblokowania, naruszenia CSP).
- Adresy z powiadomień i wiadomości service workera są walidowane (tylko ścieżki wewnątrz aplikacji).
- Kod parowania generowany bez obciążenia statystycznego; stary pokój z FNV wyłączony domyślnie, ostrzeżenie przy krótkim kodzie.
- Nagłówki hostingu (`netlify.toml`): `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` oraz **CSP w trybie Report-Only** — po okresie bez zgłoszeń naruszeń zmień nazwę nagłówka na `Content-Security-Policy`. `public/offline.html` ma jeden inline-skrypt i do czasu przeniesienia go zgłosi naruszenie.
- Znane luki bezpieczeństwa i plan ich naprawy są w [`roadmap.md`](./roadmap.md) (sekcja „Audyt i rozszerzenia”).

## Dostępność i wydajność

- Roving tabindex w siatkach (Kalendarz, Grafik), pełna obsługa klawiaturą, etykiety `aria` komórek z dniem tygodnia i „dziś”, komunikaty `aria-live` po nanoszeniu zmian i zmianie dnia, widoczny fokus, cele dotykowe ≥ 44 px na urządzeniach z ekranem dotykowym (`coarse:`), respektowanie `prefers-reduced-motion`.
- Wydajność: projekcja inkrementalna, indeks wyszukiwania cache'owany, stabilne efekty tła (przypomnienia i nudge'e nie restartują się przy renderze), leniwe ładowanie rzadkich paneli, timeout oczekiwania na IndexedDB (8 s) z wpisem w diagnostyce.

## Testy

- **Jednostkowe (Vitest + Testing Library):** `src/**/*.test.ts(x)` — logika Grafiku (norma, nadgodziny, `.ics`, `.csv`), Yjs i merge, wyszukiwanie, skarbiec, import, powiadomienia, projekcje.
- **E2E (Playwright):** `e2e/*.spec.ts` — notatki, edycja, listy, przypomnienia i Kalendarz, Grafik (miesiąc/tydzień/urlop), prywatne notatki, import, backup, PWA, nawigacja i widok mobilny.
- Przed commitem: `npm run typecheck`, `npm run lint`, `npm test`; dla zmian w UI także `npm run test:e2e`.

## Wdrożenie

Appka jest w 100% statyczna (brak backendu), więc wystarczy dowolny hosting plików + poprawne nagłówki cache. W repo są gotowe configi pod dwa hostingi — **żaden nie jest jeszcze wdrożony**, trzeba tylko połączyć repo z kontem:

| Hosting | Plik konfiguracyjny | Co trzeba zrobić |
| --- | --- | --- |
| Vercel | [`vercel.json`](./vercel.json) | Zaimportować repo na vercel.com — build i katalog wyjściowy są już w configu. |
| Netlify | [`netlify.toml`](./netlify.toml) | „Add new site → Import an existing project" na netlify.com. |

Oba configi robią rzeczy, których statyczny hosting sam z siebie nie zrobi poprawnie:

1. **SPA fallback** — każda ścieżka, która nie jest realnym plikiem, dostaje `index.html` (bez tego odświeżenie na pod-ścieżce albo wejście z linku daje 404 zamiast aplikacji).
2. **Nagłówki cache** — `/assets/*` ma nazwy z hashem, więc jest cache'owane na rok jako `immutable`; natomiast `sw.js` i `sw-notifications.js` (dociągany przez `importScripts()`, **bez** hasha w nazwie) mają `no-cache`. To nie jest kosmetyka: cache'owany service worker oznacza, że użytkownik, który raz zainstalował PWA, nigdy więcej nie dostanie aktualizacji.
3. **Nagłówki bezpieczeństwa** — w `netlify.toml` (patrz sekcja „Bezpieczeństwo i prywatność”).

### GitHub Pages — dlaczego nie od razu

GitHub Pages serwuje projekt pod ścieżką `/<nazwa-repo>/`, a nie pod rootem. Ta appka ma dziś zaszyty root w kilku miejscach: `base` w Vite nie jest ustawione, więc zostaje na domyślnym `/`; `start_url`/`id`/`scope` i ścieżki ikon w `public/manifest.webmanifest` są absolutne (`/`, `/pwa-192.png`, …); `navigateFallback: "/index.html"` w konfiguracji service workera (`vite.config.ts`); absolutne `href`/`src` w `index.html` (favicon, manifest, apple-touch-icon). Wdrożenie na Pages wymaga przestawienia ich wszystkich (albo własnej domeny podpiętej do Pages, która daje root) — **to nie jest zrobione**. Vercel i Netlify serwują pod rootem, więc nie potrzebują żadnej z tych zmian.

## Znane ograniczenia i plan rozwoju

- **Brak prawdziwego Web Push** (zamknięta aplikacja nie powiadomi) — wymaga serwera VAPID.
- **Zależności:** pozostałe podatności runtime wymagają przejścia na react-router 7 (zmiana łamiąca).
- **Skarbiec:** hasło min. 8 znaków i metadane (sól, `wrapped`) dostępne dla każdego, kto ma kopię/dostęp do pokoju sync — atak offline możliwy; w planie dłuższe hasło i walidacja metadanych.
- **Grafik:** jeden grafik na dokument; brak wymiany zmian, premii w rachunku, udostępniania grafiku jako obrazu.
- **Notatki:** brak Share Target dla plików/obrazów, wyróżniania trafień w kaflach, OCR i notatek audio (świadomie odrzucone).
- **Nie przetestowane na żywo:** ścieżka dotykowa przenoszenia zmian, import na prawdziwym Takeout, dyktowanie w przeglądarkach innych niż Chrome.

Pełna lista zrobionych zadań, audytów i planów: [`roadmap.md`](./roadmap.md).

# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie powłoki aplikacji (2026-10-25)

Dwunasty i ostatni plan z serii „dział po dziale”, w tym samym układzie. Powłoka to to, co jest wokół działów: nagłówek (`AppHeader`), pasek boczny (`AppSidebar`, `sidebarItems.ts`), dolny pasek i arkusz „Więcej” (`BottomNav`), paleta poleceń (`CommandPalette`), samouczek (`OnboardingTour`), logo i nazwa, przełącznik jasności, skróty globalne.

**Granica z planem przekrojowym** (`docs/plan-ui-ux-qol-2026-10-25.md`): tokeny (promienie, cienie, warstwy, typografia, OKLCH, ikony, fokus), ruch i nowoczesny CSS, reguły ładowania, arkusze, cele dotyku, wydajność — są tam i tu się nie powtarzają. Tu tylko elementy powłoki i nazwa aplikacji.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- `plan-dzialy-2026-10-22.md` §0 Poprawa 1 (martwe selektory Zeszytu usunięte, `html:not([data-skin])` = 0), 2 (pigułka zapisu: `span role=status` + przycisk, Fala 3), 3 (pasek boczny na telefonie modalny z pułapką fokusu, Fala 3), 6 częściowo (martwe pole `emoji` usunięte z `sidebarItems.ts`).
- §0 Dopracowanie 3: tabliczka „ARKUSZ 1/1” znikła.
- Marka „hydra” (2026-10-25): wordmark, monogram „h”, tytuł, manifest, ikony PWA, napis na pustym ekranie, e2e `brand-hydra`. Celowo zostają: klucze `kaczy.*`, `author="G"`, cytat „✍️ G”, hasło.
- Kolor paska przeglądarki per styl w czasie działania (`SKIN_THEME_COLOR`, `useTheme.ts:65`); jednorazowa poświata logo na telefonie (`.logo-intro`).
- Paleta: ostatnio użyte widoki (`recentCommands.ts`), budowy i wpisy Pracy, skróty `g …`, Alt+S/T/W/N/I, Ctrl+,.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| §0 Wygląd 2 | **Monogram „h” animuje się bez końca** (`infinite`, cykl 4,8 s) w nagłówku i pasku bocznym — ruch dłuższy niż 5 s bez pauzy (WCAG 2.2.2); przy redukcji ruchu stoi (to jest) | `index.css:1003,1019`, `NMonogramLogo.tsx` |
| nowe | **Resztki dawnych nazw w tekstach dla użytkownika:** „Otwórz G i odblokuj skarbiec…”, „Przypomnienie z G”, „G — Przypomnienie”, „G — raport diagnostyczny”, „Zakładka do zapisu stron w G” / „Zapisz w G”, domyślny tytuł powiadomienia „NOTKI”, „To nie wygląda na przekaźnik NOTKI”, stopka „hydra v1.0” na sztywno, pliki `kaczy-…` (plan Ustawień 1.4) | `push/schedule.ts:119`, `useReminderNotifications.ts:172-173`, `diagnostics.ts:184`, `ClipperSettings.tsx:8-29`, `public/sw-notifications.js:35`, `relayRuntime.ts:75`, `AppSidebar.tsx:323` |
| §0 Dopr. 1 | **Brak jednej tabeli `VIEW_META`:** nazwy i ikony widoków w 5 miejscach i się rozjechały — „Grafik zmian” (paleta, kopia) vs „Grafik”; „Przypomnienia” (pasek boczny) vs „Terminy” (dolny pasek) | `CommandPalette.tsx:62`, `sidebarItems.ts`, `BottomNav.tsx:38-46`, `goChord.ts`, `BackupSettings.tsx:201` |
| §0 Popr. 4 | „Tryb ciemny” w Neonie/Matrycy po cichu przełącza styl na Zeszyt | `useTheme.ts:146` |
| §0 Popr. 5 | Wersaliki mimo decyzji „zdanie”: `uppercase tracking-wider` ×65, `.section-label` ×8 | `grep` w `src/**/*.tsx` |
| §0 Dopr. 2 | Samouczek: emoji zamiast rysunków, brak „Krok 1 z 3” dla czytnika i „Wstecz” | `OnboardingTour.tsx:11-21,74` |
| §0 Dopr. 4 | „Szukaj” z arkusza „Więcej” czeka `setTimeout(400)` na zamknięcie arkusza | `BottomNav.tsx:172` |
| §0 Dopr. 5 | Brak `safe-area-inset-left/right` (iPhone w poziomie: wycięcie zasłania nagłówek i dolny pasek) | `grep safe-area` — tylko `bottom` |
| §0 Rozb. 1–4 | Pasek boczny: 11 pozycji naraz, bez grup i bez ukrywania nieużywanych działów; dolny pasek: 4. pozycja na sztywno „Terminy”; paleta bez kart Ustawień, „Styl: …”, „Zrób kopię”, „Połącz urządzenie”; brak kropki stanu synchronizacji w nagłówku | `sidebarItems.ts`, `BottomNav.tsx:44`, `CommandPalette.tsx:259`, `AppHeader.tsx` |
| §0 Wygląd 1 | Nazwa — **rozstrzygnięta** („hydra”), ale nie wszędzie (wiersz wyżej) | — |
| §0 Wygląd 3–4 | Samouczek bez rysunków kreską; kolor paska przeglądarki przy starcie (`index.html`, manifest) zawsze bursztyn `#f0b429`, zanim JS ustawi kolor stylu | `index.html:8`, `manifest.webmanifest:39` |

**Powiązania:** Ustawienia 2.1 (wersja na innych urządzeniach → baner w powłoce), 4.1 (wersja w „O aplikacji” zamiast „v1.0” w stopce), Skarbiec 2.1 (kłódka w nagłówku), Skrzynka 2.3 (Alt+K z każdego miejsca), plan przekrojowy 2.2 (przejścia między działami), 3.9 (paleta w kontekście), 5.1 (odcień działu w nawigacji).

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB): powłoka jest w paczce startowej — każdy punkt mierzy przyrost; `VIEW_META` ma zastąpić 5 kopii, więc powinien paczkę zmniejszyć. Nowe polecenia palety leniwie.
- **Dane:** układ paska bocznego i dolnego paska to preferencje urządzenia (`viewPrefs`), nie Yjs — telefon i komputer mają inne potrzeby.
- **WCAG 2.2 AA**, 7 motywów, redukcja ruchu. Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Logo bez pętli:** jeden przebieg rysowania przy starcie, przy najechaniu i przy „Zapisano”; potem litera stoi. Test CSS: brak `infinite` w `.n-mark-*`. | `index.css:1003,1019`, `NMonogramLogo.tsx` | 2 | S |
| 1.2 | **Jedna nazwa w tekstach:** stała `APP_NAME = "hydra"` (`src/lib/brand.ts`) w powiadomieniach, raporcie diagnostycznym, zakładce do zapisu stron, przekaźniku i `sw-notifications.js` (przez build). Stopka paska bocznego z wersją z `__APP_BUILD__`. Test „zakazane nazwy”: brak „ G ”, „NOTKI”, „Notatnik” w tekstach UI (wyjątki z listy celowo zostawionych). | pliki z tabeli wyżej | 2 | S |
| 1.3 | **`VIEW_META`:** jedna tabela widok → nazwa, krótka nazwa (dolny pasek), ikona, adres, skrót `g`. Używają: pasek boczny, dolny pasek, paleta, `goChord`, nagłówek, kopia. Rozstrzyga „Grafik” (nie „Grafik zmian”) i „Przypomnienia” / „Terminy” (**Decyzja PW-1**). | nowy `src/lib/viewMeta.ts` | 3 | M |
| 1.4 | **Jasność nie zmienia stylu po cichu:** w stylu bez trybu ciemnego przełącznik jest wyłączony z podpowiedzią „Ten styl ma jeden tryb — zmień styl w Wyglądzie” albo przełącza z dymkiem „Zmieniono styl na Zeszyt — Cofnij”. **Decyzja PW-2.** | `useTheme.ts:146`, `AppHeader.tsx` | 2 | S |
| 1.5 | **„Szukaj” z arkusza** przez `onCloseAutoFocus` arkusza zamiast `setTimeout(400)`. | `BottomNav.tsx:172` | 1 | S |
| 1.6 | **Boczne wycięcie ekranu:** `padding-inline: max(…, env(safe-area-inset-left/right))` w nagłówku, dolnym pasku, pasku bocznym i oknach pełnoekranowych; e2e na iPhonie w poziomie. | `AppHeader.tsx`, `BottomNav.tsx`, `AppSidebar.tsx`, `index.css` | 1 | S |
| 1.7 | **Kolor paska przy starcie:** `theme-color` w `index.html` z `media="(prefers-color-scheme: dark)"` (dwa wpisy) i ustawiany z zapisanego stylu w skrypcie przed Reactem (jak motyw). | `index.html`, `useTheme.ts` | 1 | S |

## Etap 2: nawigacja

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Grupy w pasku bocznym:** „Codziennie” (Dziś, Skrzynka, Notatki, Przypomnienia, Kalendarz), „Praca” (Grafik, Praca), „Osobiste” (Długi, Ćwiczenia), na dole Archiwum i Kosz. Grupy zwijane, stan zapamiętany. | 2 | S |
| 2.2 | **Ukrywanie działów:** „Dostosuj” w pasku bocznym — przełączniki przy działach (Długi, Ćwiczenia, Praca, Grafik można ukryć; Notatki, Dziś nie). Ukryty dział znika z paska, dolnego paska i palety, dane zostają; link `/dlugi` dalej działa. | 3 | M |
| 2.3 | **4. pozycja dolnego paska do wyboru:** Przypomnienia (domyślnie), Grafik, Praca, Kalendarz, Skrzynka — długie przytrzymanie pozycji albo w „Dostosuj”. | 2 | S |
| 2.4 | **Kropka stanu w nagłówku** (tylko gdy urządzenie jest w grupie): zielona — połączono, szara — łączenie, żółta — offline z kolejką, czerwona — błąd; stuknięcie otwiera Ustawienia → Sync. Plus baner „starsza wersja” z Ustawień 2.1. | 2 | S |
| 2.5 | **Paleta: więcej poleceń** (leniwie): karty Ustawień („Ustawienia: Kopia”), „Styl: Matryca”, „Krój: …”, „Jasność”, „Zrób kopię teraz”, „Wyślij kopię”, „Połącz urządzenie”, „Zablokuj skarbiec”, „Do skrzynki…” (Alt+K). | 2 | S |
| 2.6 | **Okruszki w nagłówku** dla zagnieżdżeń (folder → podfolder, notatka → podnotatka, Praca → budowa) zamiast samej nazwy widoku; na telefonie skrócone do „‹ Rodzic”. | 1 | M |

## Etap 3: pierwsze uruchomienie

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Samouczek dostępny:** „Krok 1 z 3” (dla czytnika w `aria-live`), „Wstecz”, „Pomiń”, Esc; fokus na nagłówku kroku. | 2 | S |
| 3.2 | **Rysunki kreską zamiast emoji** w samouczku (ten sam styl co puste stany, plan przekrojowy 5.4), kolor z tokenów motywu. | 1 | M |
| 3.3 | **Wybór działów przy starcie:** ostatni krok „Czego używasz?” (Notatki zawsze; Grafik, Praca, Długi, Ćwiczenia do zaznaczenia) — ustawia 2.2 od razu. Krok o kopii i synchronizacji z Ustawień 3.4. | 2 | S |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Wersaliki → zdania:** 65 miejsc `uppercase tracking-wider` zamienione na `section-label` albo zwykły tekst; wyjątki (pieczątki `stamp-tag`, kod) zapisane w teście strażniku (plan przekrojowy 0.3). | 2 | M |
| 4.2 | **Aktywny dział** w pasku bocznym i dolnym pasku: wskaźnik (kreska / tło) w odcieniu działu (plan przekrojowy 5.1), przejście wskaźnika między pozycjami (`view-transition-name`), przy redukcji ruchu bez przesuwania. | 2 | S |
| 4.3 | **Nagłówek przy przewijaniu:** cień i zwężenie po zjechaniu ze szczytu (`animation-timeline: scroll()`), tytuł działu wjeżdża do nagłówka, gdy duży tytuł widoku (`ViewTitle`) zniknie. | 1 | S |
| 4.4 | **Arkusz „Więcej” jako siatka kafli działów** z licznikami i odcieniami działów; ukryte działy (2.2) na końcu, przygaszone. | 1 | S |

## Etap 5: QA

- E2E: `VIEW_META` (te same nazwy w pasku bocznym, dolnym pasku i palecie), ukrywanie działu (znika z trzech miejsc, adres działa), 4. pozycja dolnego paska, kropka stanu, samouczek klawiaturą.
- Test „zakazane nazwy” (1.2) i strażnik wersalików (4.1).
- Zrzuty `@visual`: nagłówek, pasek boczny (rozwinięty, zwinięty, z grupami), dolny pasek, arkusz „Więcej”, samouczek × 7 motywów × telefon (pion, poziom z wycięciem) i komputer.
- axe: powłoka we wszystkich motywach. Bundle: przyrost powłoki ≤ 0 po `VIEW_META`.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| PW-1 | Jedna nazwa działu terminów: „Przypomnienia” czy „Terminy”? | „Terminy” wszędzie — krócej, mieści się w dolnym pasku, a terminy z Pracy (serwis, dostawy) to nie tylko przypomnienia. Adres `/przypomnienia` zostaje jako alias. |
| PW-2 | Przełącznik jasności w stylu bez trybu ciemnego: wyłączyć czy przełączać na Zeszyt z „Cofnij”? | Przełączać z dymkiem i „Cofnij” — jedno stuknięcie dalej działa, a zmiana nie jest cicha. |
| PW-3 | Ukrywanie działów (2.2): też Kalendarz i Skrzynkę? | Tak, wszystko poza Notatkami, Dziś, Archiwum i Koszem. |
| PW-4 | Grupy w pasku bocznym (2.1): nazwy grup? | „Codziennie”, „Praca”, „Osobiste” — do potwierdzenia. |

## Kolejność wdrażania

1. Etap 1: 1.1, 1.2, 1.3 (po PW-1), 1.5, 1.4 (po PW-2), 1.6, 1.7.
2. Etap 2: 2.4, 2.5, 2.2 (po PW-3), 2.1 (po PW-4), 2.3, 2.6.
3. Etap 3: 3.1, 3.3, 3.2.
4. Fundament z planu przekrojowego, potem Etap 4.
5. Etap 5 na koniec.

**Seria „dział po dziale” zakończona.** Spis planów: Notatki, Skrzynka, Dziś, Kalendarz, Terminy, Grafik, Praca, Długi, Ćwiczenia, Skarbiec, Ustawienia i synchronizacja, powłoka (`docs/plan-*-2026-10-25.md`) oraz przekrojowy `docs/plan-ui-ux-qol-2026-10-25.md`.

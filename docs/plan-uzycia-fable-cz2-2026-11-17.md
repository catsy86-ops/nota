# Plan użycia Fable w planach Długi, Ćwiczenia, Architektura i w audycie (2026-11-17)

> **Status:** sesja H zrobiona 2026-11-17 (`plan-zgodnosc-i-obieg.md`; D-X1 zmienione — zamiast bramki wersji mapa boczna i wpis niewidoczny dla starszego czytelnika, do potwierdzenia). Dalej sesje I, J. Dotyczy `plan-dlugi-2026-11-15.md`, `plan-cwiczenia-2026-11-15.md`, `plan-architektura-2026-11-15.md` i `audyt-fable-2026-11-15.md`. Część pierwsza (Praca, Bezpieczeństwo, QoL): `plan-uzycia-fable-2026-11-17.md`.
> **Zasada (decyzja właściciela, jak w części pierwszej):** Fable robi plan, diagnozę, projekt i trudny kod; testy, interfejs i prace mechaniczne robią Opus i Sonnet. Fable wchodzi tam, gdzie błąd jest cichy i kosztuje dane albo pieniądze.
> **Sprawdzone w kodzie 2026-11-17:** `cleanDebt` (`src/lib/debts/model.ts:52`) buduje wpis od zera tylko ze znanych pól, a zapis edycji (`updateDebt`, `store.ts:72`) i ścieżki w `yDebts.ts` (wiersze 27, 46, 87) idą przez nią — pole, którego starsza wersja nie zna, ginie przy pierwszej edycji wpisu na starszym urządzeniu. `exportNotes.ts` ma 616 linii (plan: 609), `push/schedule.ts` 389, `study/billing.ts` 275, `src/lib/import/` ok. 1000 linii. Reszta pochodzi z czytania planów — do potwierdzenia przy wykonaniu.
> Numeracja zleceń: **zadanie 17** — specyfikacje wspólne dla Długów, Ćwiczeń i Architektury; **zadanie 18** — drugi audyt.

## 1. Skrót

| Plan | Udział Fable | Punkty z Fable | Bez Fable |
|---|---|---|---|
| Długi | mały | zgodność w przód nowych pól, obieg raty/spłaty (L2.1, L2.4, L3.1), przegląd rejestracji dowodu w odśmiecaniu obrazów (L4.3), L5.1 tylko po decyzji „tak” | Etap 1, L2.2, L2.3, L3.2, L4.1, L4.2, L4.4, L5.2 |
| Ćwiczenia | minimalny | C1.4 (obieg odhaczenie ↔ „Gotowe”, wspólna specyfikacja z Długami), C2.6 (krótkie timery natywne), C5.1 tylko jeśli powstanie | cała reszta |
| Architektura | średni | przegląd przywracania kopii przed podziałem `exportNotes.ts` (A3.1), właściwości zbieżności (A4.5), klasyfikacja kluczy (A5.4), przegląd diffu A3.3, triage Strykera (A4.7) | A1, A2, A3.2, A3.4, A4.1–A4.4, A4.6, A5.1–A5.3, A5.5 |
| Audyt | średni | drugi przebieg po obszarach, których pierwszy nie objął; przegląd kodu KSeF Etap 2 | zlecenia Z-… z pierwszego przebiegu (Opus, Sonnet) |

Razem: 3 sesje Fable (H, I, J) i przeglądy dołączane do sesji G z części pierwszej. Żadna sesja nie wymaga decyzji o hostingu.

## 2. Plan Długów

### 2.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **Nowe pola we wpisie** (`groupId` z L3.1, `proof` z L4.3, `currency` z L5.1, pola rat z L2.1) | Zgodność w przód. Sprawdzone: `cleanDebt` gubi nieznane pola, więc starsze urządzenie, które edytuje wpis, kasuje `groupId` (grupa się rozpada, „Cofnij” przestaje działać na całość), `proof` (zdjęcie traci odwołanie i odśmiecanie je usunie) albo `currency` (wpis w euro staje się wpisem w złotych — **kwota zostaje, saldo się zmienia po cichu**). Zasada z `formatSchema.ts` („nowy kształt zapisujemy, gdy wszystkie widziane urządzenia go znają”) chroni tylko tam, gdzie jest stosowana. | Specyfikacja zadania **Z-17.1**: tabela pól wg skutku utraty (nieszkodliwe / psuje spójność / zmienia kwoty); reguła dla `clean*` — zachowywać nieznane pola przy zapisie (`rest`), a pola o skutku „zmienia kwoty” zapisywać dopiero za bramką wersji z `formatSchema`; to samo dla innych map (`clean*` w Ćwiczeniach i Pracy — lista do sprawdzenia). | `cleanDebt` z zachowaniem nieznanych pól i testy w obie strony (stary zapis → nowy odczyt → stary zapis) — Opus (Z-17.3). |
| **Obieg „rata / spłata / termin”** (L2.1, L2.4, L3.1) | Ten sam wzorzec co C1.4: dwa źródła prawdy (seria przypomnień w notatce i wpisy spłat w mapie `debts`) zamykane z dwóch stron. Pytania, które trzeba rozstrzygnąć projektem, nie testem: czy „rata 2 z 6” jest liczona ze spłat, czy zapisana; co przy spłacie częściowej i nadpłacie; ostatnia rata z resztą groszy; dzień 31. w miesiącach krótszych; „Rata wpłacona” stuknięte naraz na dwóch telefonach (dwa wpisy — istnieje wykrywanie podwójnego rozliczenia, trzeba sprawdzić, czy obejmie ten przypadek); przesunięcie serii przy zmianie strefy (poprawki z Z-8: `anchorAfterWrite`). | Specyfikacja **Z-17.2** (patrz §3): stan raty **wyprowadzany** ze spłat i harmonogramu, nigdzie niezapisywany jako licznik; niezmienniki grupy z L3.1: suma udziałów = kwota co do grosza, „Cofnij” grupy nie usuwa udziału, który w międzyczasie został rozliczony albo zmieniony (pomija go i mówi o tym). | Kod i testy — Opus (Z-17.4: L2.1, L3.1; Z-17.5: L2.4). |
| **L4.3** zdjęcie dowodu | Utrata zdjęć już się zdarzyła (Z-6: listy odwołań utrzymywane ręcznie w kilku plikach). Wpis długu to nowe źródło odwołań do obrazu; jeśli nie trafi do wspólnej listy (Z-6.3), odśmiecanie usunie dowód po karencji. Do tego transport obrazów przez przekaźnik i P2P (U-2 w `plan-wiadomosci-i-cofniecia.md`). | Dopiero **po Z-6.3**: przegląd diffu rejestrującego dług jako czytelnika obrazów oraz test-strażnika „każdy zapis ma czytelnika” rozszerzonego o `debts`. Bez kodu. | Kod, rozmycie miniatury, testy — Opus (Z-17.6); `security-reviewer` (zdjęcie w synchronizacji). |
| **L5.1** waluta | Tylko jeśli DL-3 = „tak”: zmienia sumowanie, pasek proporcji i eksport, a błąd daje zły dług. | Specyfikacja (pół strony) po decyzji. **Zalecenie: DL-3 = nie** — plan sam mówi „tylko jeśli realnie potrzebne”. | — |

### 2.2 Punkty bez Fable

- **Sonnet:** L1.1 (podział `DebtsView.tsx`, bez zmiany zachowania), L2.2, L2.3 (z `security-reviewer`: numer konta w kopii zapasowej — patrz A5.4), L3.2, L4.1, L4.2, L4.4, testy L1.2 na wspólnym zestawie z §4.2.
- **Właściciel:** L1.3 (QA na telefonie), decyzje DL-1…DL-3.
- **L5.2** (powiązanie z klientem z Pracy): nie robić; **L5.3** czeka na D-3.

### 2.3 Kolejność

Z-17.1 → Etap 1 → L2.4, L2.2, L2.3 → Z-17.2 → L2.1 → L4.1, L4.2, L4.4 → L4.3 (po Z-6.3) → Etap 3 po DL-2.

## 3. Plan Ćwiczeń

### 3.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **C1.4** odhaczenie odżywki ↔ „Gotowe” | Znane ograniczenie z `opis.md`, ale poprawka to ta sama klasa błędu co raty: dwie strony zamykają jedną rzecz, a pętla zwrotna (odhaczenie przesuwa serię, przesunięcie odhacza) może się zapętlić albo odhaczyć dwa razy przy dwóch urządzeniach. Gdy `reminderNoteId` wskazuje usuniętą notatkę lub notatkę prywatną, funkcja nie może rzucić ani zgadywać. | **Z-17.2** (wspólna z Długami): jedna funkcja z jawną kolejnością „najpierw zapis w jednej transakcji, potem skutki uboczne”, idempotentna, z regułą, kto wygrywa przy dwóch urządzeniach (ostatnie odhaczenie dnia; nie odhaczać odhaczonego). | Kod w `src/lib/supplements/` i podpięcie w obu miejscach, testy — Opus (Z-17.7). |
| **C2.6** koniec przerwy przy zgaszonym ekranie | Model listy przypomnień (`buildPushSchedulePlan` → `uploadSchedule` / `planNative`) jest zaprojektowany na terminy w godzinach i dniach, z 3 s zwłoką, godzinową wysyłką i kolejką przez serwer. Przerwa trwa 60–180 s i jest zmieniana co serię. Przez serwer Web Push jest to nieużyteczne (opóźnienie sieci, nowa wysyłka listy co serię), więc tylko ujście natywne ma sens; w PWA zostaje dymek i dźwięk przy otwartej aplikacji — to trzeba powiedzieć użytkownikowi wprost. | Dodatek do `docs/plan-powiadomienia.md` (§2.4): „krótki timer” jako osobna ścieżka obok listy — wywołanie natychmiastowe z pominięciem zwłoki (to samo wywołanie, którego potrzebuje Z-14.6 dla próby szczelności), jeden stały numer alarmu `rest`, kasowanie przy następnej serii i przy zakończeniu sesji, kanał, zachowanie po restarcie telefonu. | Kod — Opus, razem z Z-14.6, po próbie F1.0. |
| **C5.1** kroki i tętno (Health Connect) | Tylko po F1 i tylko jeśli właściciel zechce. Dane zdrowotne nie mogą trafić do dokumentu Yjs, bo ten idzie przez przekaźnik i P2P do wszystkich urządzeń grupy. | Warunkowo: jedna strona — gdzie wolno zapisać (lokalnie, poza Yjs), czego nie ma w kopii zapasowej, uprawnienia. Bez prośby właściciela — nie ruszać. | — |

### 3.2 Punkty bez Fable

- **Opus:** C1.2 (podział `TrainingSection.tsx`), C1.3, C2.1 (czysta funkcja `suggestNext` — aplikacja tylko podpowiada, błąd jest widoczny od razu i do zignorowania), C2.2, C3.1, C3.4, C4.2.
- **Sonnet:** C1.1 (przegląd wizualny przez `playwright.visual.config.ts`), C2.3–C2.5, C3.2, C3.3, C3.5 (wspólny pomocnik CSV z Długami — najpierw przenieść istniejący z ochroną przed formułami, nie pisać drugiego), C4.1, C4.3, C4.4. C4.5 (OCR) tylko za flagą.
- **Właściciel:** C1.5 (akceptacja katalogu), CW-1…CW-3.
- Nowe pola (RIR, obwody ciała, `dietFavorites`) podlegają regule z Z-17.1.

## 4. Plan architektury

### 4.1 Punkty, które wymagają Fable

| Punkt | Dlaczego Fable | Fable robi sam | Oddaje |
|---|---|---|---|
| **A3.1** `exportNotes.ts` → `src/lib/backup/` — **przegląd przywracania przed podziałem** | Audyt z 15.11 sam zaznacza, że nie objął tego pliku („atomowość przywracania kopii”). Plan A3.1 zabezpiecza tylko budowanie kopii (bajt w bajt na danych wzorcowych); podział „bez zmiany zachowania” zachowa też błędy scalania. Dodatkowo trzy plany sięgają do tego samego kodu: Q3.8 (import w porcjach), Q1.4 (przywracanie z OPFS) i podział A3.1. | Sesja **I** (§6): audyt ścieżki przywracania — czy przerwanie w połowie zostawia stan pośredni, czy „Cofnij” po imporcie obejmuje wszystko, co import zmienia (w tym ustawienia w `localStorage`), czy wersje nowsze niż `MAX_BACKUP_VERSION` są odrzucane w całości. Wynik: lista poprawek i **kolejność**: A3.1 (podział) przed Z-16.1/Z-16.2, żeby oba trafiły na gotowe `merge.ts`, nie na stary plik. | Podział — Opus (A3.1); poprawki z audytu — Opus (Z-18.x). |
| **A4.5** testy własności scalania (razem z L1.2 w Długach, Z-11 i Z-4.T w audycie) | Test zbieżności jest wart tyle, ile „projekcja”, którą porównuje. Zła definicja (np. porównanie surowych map zamiast wartości po `clean*`, albo ignorowanie pól, które legalnie zależą od kolejności, jak „ostatnia zmiana wygrywa”) daje testy zielone i puste. | **Z-17.8**: specyfikacja jednego zestawu — definicja projekcji dla notatek, długów, zmian, Pracy; lista pól legalnie niezbieżnych; generator operacji (w tym operacje offline i cofnięcia); interfejs pomocnika `convergence.ts`. | Pomocnik i testy dla każdego działu — Sonnet (po jednym PR na dział); Opus przy notatkach. |
| **A5.4** rejestr 119 kluczy `localStorage` | Kolumna „w kopii / czyszczony przy resecie” to polityka danych. Pomyłka w jedną stronę gubi ustawienia, w drugą **przywraca stan, którego przywracać nie wolno**: zapis wymiany kodu (`REKEY_STORAGE_KEY`) wznowiłby po przywróceniu kopii przerwaną wymianę do pokoju już wycofanego; kody i tokeny przekaźnika, subskrypcja push, identyfikatory urządzeń i karty też nie powinny wracać z kopii. | Przegląd kolumny dla kluczy wrażliwych po szkicu Sonneta (pół godziny pracy): lista „nigdy w kopii”, lista „czyścić przy resecie”, test, że klucz z listy „nigdy” nie występuje w kopii. | Szkic tabeli i test literałów — Sonnet (A5.4). |
| **A3.3** `privateNotes.ts` | Kryptografia. Plan wymaga `security-reviewer` i „żadnej zmiany formatu”, ale nie ma sposobu, by to wykryć po podziale. | Przegląd diffu (S) i jedno wymaganie: **wektory znane** — zaszyfrowana stary kodem notatka z hasłem testowym zapisana w `src/test/fixtures/` i odszyfrowywana po podziale; ten sam plik jest częścią A4.6. | Podział — Opus (A3.3). |
| **A4.7** testy mutacyjne | Przeżywający mutant w `debts`, `shifts/summary.ts`, `ksef` to albo luka w testach, albo mutant równoważny; odróżnienie wymaga znajomości przepisów (KP, VAT). | Triage wyniku (S) — wybór mutantów wartych testu. | Uruchomienie Strykera i dopisanie testów — Sonnet. |

### 4.2 Punkty bez Fable

- **Sonnet (A1):** typy do `src/lib/types`, `View`, `motionPref`, `theme`, `dictationConsent`, port `notify`, reguły ESLint; zrobione A1.1–A1.3, A1.6, A1.4 częściowo. Zostaje A1.5.
- **Opus:** A2 (`Index.tsx` — mapa, efekty bez interfejsu, `useNotesScreen`, `IndexOverlays`), A3.2 (`AddNoteBar.tsx` — najpierw reduktor szkicu z testami, bo to chroni szkic przed utratą), A3.4.
- **Sonnet + `testing-engineer`:** A4.1 (zielona baza e2e — warunek startu A2, A3), A4.2 (CI, fragmenty), A4.3 (`waitForTimeout`), A4.4 (`PW_WORKERS`), A4.6 (kopie z każdej wersji formatu).
- **Sonnet:** A5.1 (**tylko po zgodzie AR-1** i po `git status` w każdym katalogu), A5.3, A5.5; **Opus:** A5.2 po AR-2.
- **F3** (podział `yjsStore.ts`): Opus wg `plan-fable-2026-11-15.md`. Fable przegląda wyłącznie diff, który dotyka `writeContent` i list odwołań do obrazów (Z-6.3) — w sesji G.

### 4.3 Kolejność

Bez zmian względem planu (A4.1 → A1 → F3 kroki 1–2 → A3.1 → A2 → A3.2, A3.3 → A4.2–A4.7 → A5), z dwoma uzupełnieniami: **przegląd przywracania z sesji I przed A3.1**, oraz **Z-17.8 przed A4.5**.

## 5. Audyt Fable z 15.11 — co zostaje

### 5.1 Zadania z listy, które nadal mają udział Fable

| # | Zadanie | Co zostaje po stronie Fable |
|---|---|---|
| 3 | KSeF Etap 2 | Przegląd kodu serwera wysyłkowego po zleceniach E2.x: podwójna wysyłka (status 440 jako bezpieczne ponowienie), tryb offline, tokeny. Z `security-reviewer`. Czeka na D-K3…D-K5 i token testowy od właściciela. |
| 8 | Godzina ścienna | Z-8.4 (pełna wersja) **tylko** gdy właściciel odrzuci zalecenie D-P1 („odłożyć”). |
| 1 | Grafik względem KP | Nic, dopóki D-G1 nie jest rozstrzygnięte; potem Opus. |
| 2, 4–7, 9–13 | — | Zlecenia dla Opus i Sonnet (Z-2.x, Z-4.T, Z-5.6–Z-5.9, Z-6.x, Z-7.x, Z-9…Z-12); Fable nie wraca do nich poza przeglądami z sesji G. |

### 5.2 Drugi przebieg — obszary, których audyt nie objął (zadanie 18)

Audyt wymienia cztery. Ocena, co z nich wymaga Fable, a co nie:

| Obszar | Rozmiar | Decyzja | Dlaczego |
|---|---|---|---|
| `exportNotes.ts` — atomowość przywracania | 616 linii | **Fable** (sesja I) | Utrata danych przy przerwanym imporcie; patrz A3.1. |
| `push/schedule.ts` | 389 linii | **Fable** (sesja I), wąsko | Serwer przyjmuje najwyżej 200 pozycji i horyzont 35 dni (`push-server/core.js`). **Do sprawdzenia:** czy klient przy większej liczbie przypomnień sortuje po czasie przed obcięciem — bliskie terminy muszą wygrywać z dalszymi; przy braku sortowania przypomnienie na jutro może zniknąć przez serię na przyszły miesiąc. Reszta (godzina ścienna) objęta przez Z-8. |
| `study/billing.ts` | 275 linii | **Fable** (sesja I) | Pieniądze: zaokrąglenia (po pozycji czy od sumy), stawki, powiązanie z fakturą z KSeF (Z-2.x). Przegląd z przypadkami wzorcowymi; jeśli kod okaże się prosty — oddać Sonnetowi. |
| `import/` (`zip.ts`, `commit.ts`, `limits.ts`; `keep.ts`, `markdown.ts`, `plan.ts`) | ok. 1000 linii | **Fable tylko `zip.ts`, `commit.ts`, `limits.ts`** | Plik od obcej osoby: bomba ZIP, ścieżki z `..`, ogromna liczba wpisów w jednej transakcji, import przerwany w połowie (**ta sama klasa co przywracanie kopii**). Parsery `keep.ts` i `markdown.ts` — Sonnet z testami własności (`fast-check`: dowolny napis nie rzuca, wynik mieści się w limitach). |
| `plans/` (parsery i geometria) | ok. 1800 linii | **bez Fable** | Błędy widać na ekranie i w CSV, są testy (`geometry.test`, `fittings.test`, `imageSniff.test`). Wyjątek: `plans/csv.ts` (39 linii) — ochrona przed formułami, razem z pomocnikiem CSV z C3.5; Sonnet. |

Wynik sesji I: `docs/audyt-2-2026-11-17.md` i zlecenia Z-18.1… (Opus, Sonnet).

## 6. Sesje Fable i kolejność

Zależności: Z-6.3 → przegląd L4.3 · A4.1 (zielona baza) → A3.x, A2 · sesja I → A3.1 → Z-16.1, Z-16.2 · F1.0 → C2.6 · token testowy KSeF → przegląd Etapu 2 · Z-17.1 przed każdym nowym polem w mapie z `clean*`.

| Sesja | Zakres | Wynik | Wymaga | Czas |
|---|---|---|---|---|
| **H** | Z-17.1 (zgodność w przód nowych pól), Z-17.2 (obieg raty/odhaczenia/grupy) | `docs/plan-zgodnosc-i-obieg.md`, zlecenia Z-17.3–Z-17.7 | nic (zalecenia domyślne z §7) | 0,5 |
| **I** | Audyt 2: przywracanie kopii i import ZIP-a (atomowość), `push/schedule.ts` (obcinanie do 200), `billing.ts` | `docs/audyt-2-2026-11-17.md`, zlecenia Z-18.x, kolejność A3.1 → Z-16.x | nic | 1 |
| **J** | Z-17.8 (zestaw zbieżności), dodatek C2.6 do `plan-powiadomienia.md`, przegląd tabeli kluczy A5.4 po szkicu Sonneta | specyfikacja, dodatek, uwagi | szkic A5.4 (Sonnet); dodatek C2.6 po F1.0 | 0,5 |
| **G+** (dołączone do G z części pierwszej) | Przeglądy diffów: rejestracja obrazów dla `debts` (L4.3), A3.3 (wektory znane), F3 w części `writeContent`, kod KSeF Etap 2, triage Strykera | uwagi do poprawek | Z-6.3, A3.3, F3, E2.x gotowe | 0,5–1 |

Kolejność: **H → I → J → G+**. H i I nie zależą od niczego i mogą iść od razu po sesji D2 z części pierwszej (wspólny kod synchronizacji; H przed Opusem piszącym L2.1/L3.1).

**Równolegle, bez czekania na Fable:** A4.1, A4.3, A4.4, A1.5, A5.5, L1.1, L2.2, L2.3, C1.1–C1.3, C2.1–C2.5, C3.x, C4.x (z wyjątkiem nowych pól przed Z-17.1), L1.3 i C1.5 po stronie właściciela.

## 7. Decyzje właściciela

| Decyzja | Blokuje | Zalecenie Fable |
|---|---|---|
| **D-X1** (nowa) — polityka nowych pól: zachowywać nieznane pola przy zapisie i chronić bramką wersji tylko pola zmieniające kwoty | Z-17.1, L2.1, L3.1, L4.3, C2.3, C3.4 | tak (opis w §2.1) |
| **D-X2** (nowa) — drugi audyt (zadanie 18) w podanym zakresie | sesja I | tak; bez `plans/` |
| **DL-1** — raty: jedna seria czy osobna notatka na ratę | L2.1 | jedna seria, stan raty wyprowadzany ze spłat (zgodnie z planem) |
| **DL-2** — wspólne wydatki | Etap 3 Długów | tak, jeśli właściciel dzieli rachunki; inaczej Etap 3 wypada razem z Z-17.2 część „grupa” |
| **DL-3** — waluta | L5.1 | nie |
| **AR-1…AR-3** | A5.1, A5.2, A4.2 | nie blokują Fable; AR-1 tylko po obejrzeniu listy kopii roboczych |
| **CW-1…CW-3** | C2.1, C4.2, C5.3 | nie blokują Fable |
| D-G1, D-K3…D-K5, D-P1, SE-1 | patrz część pierwsza i `audyt-fable` | bez zmian |

## 8. Zlecenia (zadanie 17 i 18)

- **Z-17.1 (Fable, S)** — zgodność w przód nowych pól (sesja H).
- **Z-17.2 (Fable, S)** — obieg raty, odhaczenia i grupy (sesja H).
- **Z-17.3 (Opus, S)** — `cleanDebt` zachowuje nieznane pola; testy „stary zapis → nowy odczyt → stary zapis”; ta sama reguła w pozostałych `clean*` według listy z Z-17.1.
- **Z-17.4 (Opus, M)** — L2.1 (raty) i L3.1 (zapłaciłem za…) według Z-17.2.
- **Z-17.5 (Sonnet, S)** — L2.4 (zaległe na Dziś); najpierw sprawdzić, co daje notatka z etykietą `długi`.
- **Z-17.6 (Opus, M)** — L4.3 (dowód) po Z-6.3, z `security-reviewer`.
- **Z-17.7 (Opus, M)** — C1.4 według Z-17.2.
- **Z-17.8 (Fable, S)** — zestaw zbieżności (sesja J); potem **Z-17.9 (Sonnet, M)** — pomocnik `convergence.ts` i testy dla notatek, długów, zmian, Pracy.
- **Z-18.1…** — powstają z sesji I (przywracanie, `push/schedule.ts`, `billing.ts`, `import/`).

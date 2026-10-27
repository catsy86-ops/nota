# Code review po działach — 2026-10-27

Tryb: tylko odczyt. Nie zmieniano kodu, nie robiono commitów. Stan roboczy zawiera niezacommitowane zmiany D-1 (tokeny kolorów HSL → OKLCH); uwzględnione.

**Zakres i uczciwość oceny.** Repozytorium `src/` ma ok. 70 000 linii. Przegląd jest **wybiórczy**: wzorce przeszukano w całym `src/` (grep: `innerHTML`, `JSON.parse`, `toISOString`, parsowanie liczb, `localStorage`, `aria-label`, adresy `href`, kryptografia, serwery), a kod odczytano w miejscach wysokiego ryzyka. Działy oznaczone „nie czytano szczegółowo” nie dostały pełnego przeglądu — brak wpisu w nich nie oznacza, że nie ma problemów. Testy Vitest uruchomiono tylko dla testów kolorów (`src/lib/skinContrast.test.ts`, `src/lib/shifts/shiftChipOutline.test.ts`, `src/components/skins`).

## Spis działów (kolejność z nawigacji)

1. Notatki
2. Dziś
3. Terminy (w tym serwer powiadomień `push-server/`)
4. Grafik
5. Praca
6. Kalendarz
7. Skrzynka
8. Długi
9. Ćwiczenia
10. Skarbiec
11. Ustawienia i Sync
12. Statystyki
13. Wspólne

Legenda wag: **krytyczne** — utrata danych, obejście zabezpieczeń lub błąd w ścieżce pieniędzy/terminów; **ważne** — realny błąd lub luka, której użytkownik może nie zauważyć; **drobne** — kosmetyka, nieścisłość lub brak testu bez bezpośredniego skutku.

---

## 1. Notatki

Przeczytano: wpisy `MarkdownRendererImpl.tsx`, `safeUrl.ts`, `NoteReader.tsx` (przyciski ikon — wszystkie mają `aria-label`), eksport/import plików w `exportNotes.ts`.

- **[drobne]** `src/components/MarkdownRendererImpl.tsx:155` — każdy link `<a>` dostaje `target="_blank"`, także kotwice w obrębie notatki (`#sekcja`, które `isSafeHref` przepuszcza jako względne). Skutek: kliknięcie spisu treści/kotwicy otwiera drugą kartę aplikacji zamiast przewinąć stronę. Poprawka: dla `href` zaczynającego się od `#` nie ustawiać `target` ani `rel`.
- Obrona przed `javascript:`/`data:` w linkach i obrazach działa (`isSafeHref` usuwa znaki sterujące przed sprawdzeniem schematu). Bez zastrzeżeń.
- Nazwa pliku eksportu ZIP z datą — patrz „Wspólne”, pozycja W2.

## 2. Dziś

Nie czytano szczegółowo (`src/components/review/*`). Brak potwierdzonych problemów. Do zrobienia: przegląd `TodayDueList`, `ReviewWalkthrough` i `WeeklyReviewCard` pod kątem stref czasu i aktualizacji po zmianie terminu.

## 3. Terminy (powiadomienia, powtarzanie, serwer push)

Przeczytano: `src/lib/reminderRepeat.ts` (krok `monthly`, `yearly`, `workdays`, `weekdays`, `isDstShiftedOccurrence`), `push-server/server.js`, `push-server/core.js`.

- **[ważne]** `push-server/server.js:122-141` (`PUT /schedule`), `:143-150` (`POST /test`), `push-server/core.js:28-35` (`cleanSubscription`) — serwer nie uwierzytelnia żadnego żądania, a `cleanSubscription` akceptuje dowolny adres `https://…` (nie sprawdza, czy to usługa push przeglądarki). Skutki:
  - każdy może wpisać 100 fałszywych subskrypcji (`LIMITS.subs`, `server.js:127` zwraca 503 `full`) i zablokować rejestrację prawdziwych telefonów;
  - serwer wykonuje wychodzące żądania HTTPS do dowolnego hosta, a `/test` pozwala wysłać treść powiadomienia na dowolny endpoint (otwarty przekaźnik);
  - brak limitu częstotliwości.
  Poprawka: allowlista hostów usług push (fcm.googleapis.com, updates.push.services.mozilla.com, web.push.apple.com, *.notify.windows.com), limit na IP, usunięcie lub ochrona `/test`.
- **[drobne]** `push-server/server.js:12` — gdy brak `ALLOWED_ORIGINS`, CORS jest `*`. Poprawka: domyślnie pusta lista (albo origin aplikacji).
- Logika powtarzania: `reminderRepeat.ts` poprawnie ogranicza dzień miesiąca (31 → 28/29 → 31), obsługuje 29 lutego w `yearly` przez `anchorDay` i pomija weekendy w `workdays`. Bez zastrzeżeń.

## 4. Grafik

Przeczytano: `src/lib/shifts/money.ts`, `nightAllowance.ts`, fragmenty `summary.ts`, `ShiftTypeDialog.tsx`, `lib/shifts/color.ts`.

- **[drobne]** `src/components/shifts/ShiftTypeDialog.tsx:58` — `parseFloat(rate.replace(",", "."))` przyjmuje końcowe śmieci (`"12abc"` → 12) bez sygnału dla użytkownika. Poprawka: `Number(...)` z kontrolą `Number.isFinite` albo regex jak w `parseAmount` (`lib/debts/model.ts`).
- Zaokrąglenia kwot (`Math.round(n*100)/100`) są spójne w `money.ts`, `summary.ts`, `nightAllowance.ts`. Bez zastrzeżeń.

## 5. Praca

Przeczytano: konstrukcję linków telefon/mapy (`study/contact.ts`, `QuickLink.tsx`, `SiteCardDialog.tsx`, `EntryCheck.tsx`). Adresy są normalizowane przez `telHref`/`mapsHref`, więc wstrzyknięcie schematu nie jest możliwe z pól budowy. Bez problemów w tym zakresie.

Nie czytano szczegółowo: `lib/study/store.ts`, `yStudy.ts`, `report.ts`, `shortages.ts`, `StudyJournal.tsx`, `JournalEntrySheet.tsx` (946 linii). Do zrobienia: sprawdzić usuwanie etapów/braków i przeliczanie raportu przy zmianie strefy czasu (`localDayKey`).

## 6. Kalendarz

- **[drobne]** `src/components/calendar/ReminderCalendarView.tsx` (496 linii) — brak pliku testów (`find` nie znalazł `ReminderCalendarView*.test.*`); logika przenoszenia terminów (`moveToDay`, `addDays` na `occ.at`) nie ma pokrycia. Poprawka: test przeniesienia terminu powtarzanego przez zmianę czasu.
- Kolory dni po D-1 (`calendar/DayCell.tsx`, `WeekStrip.tsx`) używają `color-mix(in srgb, …)` na tokenach OKLCH — poprawne w nowoczesnych przeglądarkach. Bez zastrzeżeń.

## 7. Skrzynka

Nie czytano szczegółowo (`InboxCapture.tsx`, `InboxTriage.tsx`, `lib/quickCapture.ts`). Brak potwierdzonych problemów. Do zrobienia: sprawdzić deduplikację przy udostępnianiu (`lib/shareTarget.ts`, klucz `DEDUP_KEY`).

## 8. Długi

Przeczytano: `src/lib/debts/model.ts`, `DebtsView.tsx` (fragmenty). Kwoty w groszach (liczby całkowite), `parseAmount` odrzuca więcej niż dwa miejsca po przecinku, znak salda spójny z opisem w komentarzu (`KIND_SIGN`), `cleanDebt` waliduje dane z peera i kopii. Termin przypomnienia liczony w czasie lokalnym (`DebtsView.tsx:93`). Bez problemów. Testy istnieją (`model.test.ts`, `yDebts*.test.ts`, `DebtsView.test.tsx`).

## 9. Ćwiczenia

- **[drobne]** `src/lib/weight/model.ts:19` — `parseKg` używa `Number(...)`, który przyjmuje `"0x50"` (→ 80) i `"1e2"` (→ 100). Zakres 20–300 kg chroni przed skrajnościami, ale wpisy typu `1e2` przechodzą bez ostrzeżenia. Poprawka: regex `^\d+([.,]\d{1,2})?$` przed `Number`.
- Pozostałe moduły (`lib/training/*`, `lib/diet/*`, `lib/supplements/*`) nie czytano szczegółowo; mają testy `model.test.ts` i `y*.test.ts`.

## 10. Skarbiec

Przeczytano: `src/lib/privateNotes.ts` (throttle, `parseContent`), `src/lib/vaultPin.ts`. Kryptografia: AES-GCM, PBKDF2 (600 000 iteracji wg opisu w `VaultSettings.tsx:92`), klucz tylko w pamięci — zgodnie z opisem.

- **[ważne]** `src/lib/privateNotes.ts:89-105` (`readThrottle`, `writeThrottle`) — licznik nieudanych prób hasła trzymany jest w `localStorage` (`THROTTLE_KEY`). Wyczyszczenie danych witryny albo edycja klucza zeruje blokadę, więc ochrona przed zgadywaniem hasła na tym urządzeniu opiera się tylko na PBKDF2. To ograniczenie modelu zagrożeń, ale nie jest opisane dla użytkownika. Poprawka: dopisać je do opisu w `VaultSettings.tsx`/`opis.md` albo przenieść licznik do miejsca trudniejszego do wyczyszczenia (np. do zaszyfrowanego blobu).
- Odblokowanie PIN-em (`vaultPin.ts`) — uszkodzony JSON zwraca `null` bez utraty danych. Bez zastrzeżeń.

## 11. Ustawienia i Sync

Przeczytano: `src/lib/yjsSync.ts` (`readPrefs`), `src/lib/sync/relayProvider.ts` (obsługa WebSocket, `connectSocket`), `src/lib/sync/relayBlobs.ts`.

- **[ważne]** `src/lib/sync/relayKeys.ts` — moduł wyprowadzania kluczy (PBKDF2 z kodu parowania, HKDF, AES-GCM) nie ma żadnego pliku testów (`find` po `relayKeys*.test.*`: 0). To najbardziej wrażliwy kod synchronizacji, a regresja w derywacji rozłączyłaby urządzenia bez sygnału. Poprawka: testy wektorów (ta sama frazy → ten sam klucz; zły kod → błąd deszyfrowania; AAD różny → odrzucenie).
- Połączenia WebSocket są ograniczone do `wss://`/`https://` przez `validRelayUrl` (test w `relayRuntime.test.ts:17` sprawdza odrzucenie `ws://`). Obsługa wiadomości (`relayProvider.ts`) parsuje JSON w `try`. Bez zastrzeżeń.
- Ustawienia z `localStorage` (`readPrefs`) walidowane pole po polu. Bez zastrzeżeń.

## 12. Statystyki

Nie czytano szczegółowo (`src/components/StatsDialog.tsx`). Plik nie ma testów. Brak potwierdzonych problemów.

## 13. Wspólne

- **[ważne]** `src/lib/skinContrast.test.ts:21-22` (funkcja `tokens`) oraz `src/lib/shifts/shiftChipOutline.test.ts:19` (parser HSL) oczekują tokenów w postaci `H S% L%`. Po D-1 `src/index.css` i `src/styles/skins.css` mają `oklch(...)`, więc parsery nic nie znajdują.
  Jak to wywołać: `npx vitest run src/lib/skinContrast.test.ts src/lib/shifts/shiftChipOutline.test.ts`. Wynik przy przeglądzie: **9 testów nie przechodzi** (8 w `skinContrast`, 1 w `shiftChipOutline`: „expected 0 to be greater than or equal to 5”).
  Skutek: testy kontrastu WCAG dla wszystkich stylów nie działają, więc zmiana kolorów D-1 nie jest sprawdzona. Poprawka: parsować `oklch(L C H)` (albo przeliczać w teście) i zaktualizować test w tym samym commicie co D-1.
- **[drobne]** `src/components/ImportExportMenu.tsx:42`, `src/components/settings/BackupSettings.tsx:92` i `:178`, `src/pages/Index.tsx:1168` — nazwy plików `new Date().toISOString().slice(0, 10)` dają datę UTC. Między 00:00 a 02:00 czasu polskiego plik dostaje wczorajszą datę. Poprawka: `format(new Date(), "yyyy-MM-dd")` (date-fns, już w projekcie).
- **[drobne]** `src/lib/shifts/color.ts` — `shiftInk` zwraca `#fff` dla wartości spoza hex, a `contrastRatio` zwraca `1` dla nieparsowalnych kolorów. Oba przypadki są ciche, więc walidacja palety może uznać zły kolor za „brak kontrastu” bez komunikatu. Poprawka: rzucać błąd lub zwracać `null` i obsłużyć to w wywołującym.
- **[drobne]** Brak testów dla `src/lib/celebrate.ts` i `src/lib/glowTrail.ts` — D-1 zmienił tam obsługę tokenów (`hslVar`, `tone`, `alpha`), a żaden test tego nie pokrywa. Poprawka: test, że `tone()`/`alpha()` zwracają poprawny ciąg `color-mix(...)` dla tokenu OKLCH i dla fallbacku.
- Przeszukanie wzorców: nie znaleziono `dangerouslySetInnerHTML`, `eval`, `new Function`, `Math.random` w kryptografii (losowość kryptograficzna idzie przez `crypto.getRandomValues`), ani wycieków sekretów przez `console.log`.

---

## Podsumowanie

| Waga | Liczba | Pozycje |
|---|---|---|
| krytyczne | 0 | — |
| ważne | 4 | Terminy: push-server bez uwierzytelnienia; Skarbiec: licznik prób w localStorage; Sync: brak testów relayKeys; Wspólne: 9 niedziałających testów kontrastu po D-1 |
| drobne | 8 | Notatki (kotwice `_blank`), Grafik (`parseFloat`), Kalendarz (brak testów), Ćwiczenia (`parseKg`), Terminy (CORS `*`), Wspólne (nazwy plików UTC, ciche fallbacki kolorów, brak testów celebrate/glowTrail) |

**Działy bez pełnego przeglądu:** Dziś, Praca, Skrzynka, Statystyki (patrz sekcje). Zalecana kolejność przeglądu uzupełniającego: Praca (`lib/study/*`), Skrzynka, Dziś.

### Trzy najważniejsze do poprawy

1. **Testy kontrastu po D-1 nie działają** (Wspólne) — przywrócić parsowanie OKLCH, żeby zmiana kolorów znów była sprawdzana w WCAG.
2. **Serwer push bez uwierzytelnienia i z dowolnymi adresami** (Terminy, `push-server/server.js`, `core.js`) — allowlista hostów push i limit na IP; inaczej każdy może zapchać 100 miejsc i użyć serwera jako przekaźnika.
3. **Test derywacji kluczy synchronizacji** (Ustawienia i Sync, `src/lib/sync/relayKeys.ts`) — brak jakichkolwiek testów przy najbardziej wrażliwym kodzie; dodać wektory testowe przed kolejnymi zmianami sync.

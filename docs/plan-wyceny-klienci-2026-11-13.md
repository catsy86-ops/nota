# Plan: wyceny i kartoteka klientów (2026-11-13)

> **Status (2026-11-13):** decyzje WK-1…WK-6 przyjęte wg rekomendacji. Etap 1: 1.1–1.6 zrobione; 1.7 przegląd bezpieczeństwa wykonany ręcznie (grep po paczce budowy, diagnostyce i raportach, skrót zamiast nazw w localStorage). Budżet precache podniesiony do 4,4 MiB (wariant 1, decyzja właściciela). Etap 2 zrobiony w całości (2.1–2.6). Etap 3 zrobiony w całości (3.1–3.6). **CAŁY PLAN ZROBIONY (Etapy 1–6, 2026-11-13).** Etap 4: cenniki w synchronizacji, materiał z cennika, szablony, pozycje z punktów i zużytego materiału (4.4 z odstępstwem: ilości z zużycia, nie z kalkulatorów), duplikat, nowa wycena od klienta. Etap 5: przypomnienie o wycenie bez odpowiedzi, wycena a wykonanie, zaliczka, przegląd wycen. Etap 6: e2e (`clients.spec.ts`, `quote.spec.ts`, 7/7), axe, budżety. Wszystko niezacommitowane, opis w `opis.md`. Zostaje: commit (przed nim `simplify` + `code-review`), ręczne QA na telefonie, decyzje o pozostałych czerwonych testach.

## 1. Diagnoza

Wycena już istnieje, kartoteki klientów nie ma.

| # | Stan dziś | Dowód w kodzie |
|---|---|---|
| D1 | **Klient to napis.** Karta budowy ma pola `investor` i `phone`. Ten sam klient na dwóch budowach to dwa niezależne napisy. | `src/lib/study/sites.ts` (`SiteCard`) |
| D2 | **Dane nabywcy wpisujesz przy każdej fakturze.** Okno faktury bierze nazwę i adres z karty, a NIP zawsze jest pusty. NIP zostaje tylko w wystawionej fakturze. | `InvoiceDialog.tsx:82` |
| D3 | **Długi znają osobę tylko z imienia.** Brak powiązania z budową i fakturą. | `src/lib/debts/model.ts` (`DebtEntry.person`) |
| D4 | **Wycena jest częścią fuchy.** Jedna wycena na zlecenie: robocizna, materiał, marża na materiał, PDF. Wymaga założonej karty budowy. | `src/lib/study/jobs.ts`, `SiteJobPanel.tsx` |
| D5 | **Wycena nie ma numeru, daty ważności, VAT, rabatu ani warunków.** PDF to lista wierszy, bez tabeli. VAT pojawia się dopiero w oknie faktury. | `jobPdf.ts`, `InvoiceDialog.tsx:83-86` |
| D6 | **Cenniki są na urządzeniu, nie w synchronizacji.** Cennik robocizny (do 100 pozycji) i ceny materiału leżą w localStorage. Do wyceny da się wstawić tylko robociznę z cennika. | `companyPrefs.ts` (`kaczy.study.pricing.v1`), `materialPrices.ts` |
| D7 | **Wycena nie zna wykonania.** Zużyty materiał i godziny są liczone osobno i nie są zestawiane z wyceną. | `materialUsage.ts`, `SiteCard.hours`, `billing.ts` |
| D8 | **Statusy to wycena → umówione → zrobione → zapłacone.** Nie ma „wysłana”, „odrzucona” ani przypomnienia o braku odpowiedzi. | `jobs.ts` (`JOB_STATUSES`) |

## 2. Zasady

Zostają zasady planu z 2026-11-10 (telefon w rękawicach, nowe pola zamiast zmiany starych, pieniądze poza kartą budowy, nowy kod tylko w leniwych chunkach, kolejność test → kod → `opis.md` → `simplify` + `code-review` → commit). Dochodzą:

1. **Klient to dane osobowe.** Kartoteka nie trafia do paczki `.budowa` dla pomocnika, do raportu diagnostyki ani do raportu dla szefa. Przegląd `security-reviewer` przed zamknięciem Etapu 1.
2. **Karta budowy zostaje czytelna dla starszej wersji.** `investor` i `phone` są dalej zapisywane jako kopia danych klienta. Powiązanie budowa → klient siedzi w osobnej mapie, tak jak zlecenia w `studyJobs`.
3. **Żadnych nowych wartości w `JOB_STATUSES`.** Starsza wersja odrzuca zlecenie z nieznanym statusem (`cleanJobMeta` zwraca `null`), więc fucha zniknęłaby z listy. Nowe stany wyceny to osobne pola z datą.
4. **Wystawiona faktura się nie zmienia.** Kartoteka tylko podpowiada nabywcę; rekord w `studyInvoices` zostaje niezmienny.
5. **Kwoty wyceny zostają w złotych, faktury w groszach.** Nie migrujemy `QuoteItem.price`; przeliczenie zostaje w jednym miejscu (dziś w `InvoiceDialog`).

Oznaczenia: **W** to wartość (1–3), **N** to nakład (S, M, L).

## 3. Miary sukcesu

| Miara | Dziś | Cel |
|---|---|---|
| Faktura dla stałego klienta: pola nabywcy do wpisania | 2–3 (NIP, adres, czasem nazwa) | **0** |
| Nowa budowa dla znanego klienta: pola kontaktu do wpisania | 2 (inwestor, telefon) | **0** (wybór z listy) |
| Wycena typowej łazienki z szablonu | każda pozycja ręcznie | **≤ 6 stuknięć** do PDF |
| „Ile zarobiłem na tym zleceniu” | liczone ręcznie | **1 wiersz** w panelu zlecenia |
| Paczka startowa / precache | progi w `e2e/bundle.spec.ts` (precache bez zapasu) | **bez wzrostu** |

## 4. Decyzje do podjęcia przed startem

| # | Pytanie | Moja rekomendacja |
|---|---|---|
| WK-1 | Gdzie wejście do kartoteki: zakładka w Pracy, czy osobny dział w pasku? | Zakładka „Klienci” w Pracy, obok „Zlecenia”. Osobny dział dopiero, gdy okaże się potrzebny. |
| WK-2 | Czy Długi łączyć z klientami? | Nie na stałe. Na karcie klienta pokazać saldo z Długów, gdy imię się zgadza, z przyciskiem przejścia. Długi są prywatne, klienci firmowi. |
| WK-3 | VAT na wycenie: zawsze, nigdy, czy przełącznik? | Przełącznik na wycenie (brutto bez rozbicia / netto + VAT), domyślny w Ustawieniach → Praca. Faktura przejmuje ustawienie. |
| WK-4 | Cenniki (robocizna, materiał) przenieść do synchronizacji? | Tak, do nowej mapy Yjs z jednorazowym przeniesieniem z localStorage. Inaczej wycena z telefonu i z komputera ma inne ceny. |
| WK-5 | Warianty wyceny (podstawowy / rozszerzony) w jednym zleceniu? | Odłożyć. Na start wystarczy „Duplikuj wycenę” do drugiego zlecenia. |
| WK-6 | Wycena bez karty budowy (klient dopiero pyta o cenę)? | Tak: „Nowa wycena” od klienta zakłada kartę budowy w tle ze statusem „Wycena”. Model zostaje jeden. |

---

## Etap 1: kartoteka klientów — model i ekran

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Model klienta.** `Client`: `id`, `name`, `kind` (osoba / firma), `nip`, `address1`, `address2`, `phone`, `email`, `note`, `created`, `archived`. Czyszczenie wejścia (`cleanClient`), limity długości, walidacja NIP istniejącym `isValidNip`. | nowy `src/lib/clients/model.ts` + test | 3 | S |
| 1.2 | **Zapis w Yjs.** Mapa `clients`: id → `Y.Map` z kluczem na pole, żeby edycja telefonu na jednym urządzeniu nie nadpisała adresu z drugiego. Druga mapa `clientSites`: id budowy → id klienta. Lista znanych kluczy jak `SITE_CARD_KEYS`. | nowy `src/lib/clients/yClients.ts`, `store.ts` + testy scalania | 3 | M |
| 1.3 | **Kopia zapasowa i zgodność.** Klienci w pełnej kopii JSON i w imporcie; starsza wersja ignoruje nowe mapy. Wpis w `dataCompat.test.ts` i `fullBackup.test.ts`. | `src/lib/fullBackup*`, `formatSchema.ts` | 3 | S |
| 1.4 | **Lista klientów.** Zakładka w Pracy (WK-1): szukanie po nazwie, telefonie i NIP, sortowanie po ostatniej aktywności, pusty stan, „Nowy klient”. | nowy `src/components/clients/ClientsList.tsx` (leniwy chunk) | 3 | M |
| 1.5 | **Karta klienta.** Dane z edycją w miejscu, przyciski „Zadzwoń”, „SMS”, „Nawiguj” (istniejące `telHref`, `smsHref`, `mapsHref`), wybór z kontaktów telefonu (`hasContactPicker`). | nowy `ClientCard.tsx` | 3 | M |
| 1.6 | **Import z istniejących budów.** Jednorazowa propozycja: „Znaleziono 12 inwestorów w kartach budów — utworzyć klientów?”. Te same nazwy (po `foldName`) łączone w jednego klienta; użytkownik zatwierdza listę. Nic nie dzieje się samo. | nowy `src/lib/clients/fromSites.ts` + test | 2 | M |
| 1.7 | **Przegląd bezpieczeństwa.** Agent `security-reviewer`: dane osobowe w synchronizacji, paczce `.budowa`, diagnostyce, raporcie kopii. | — | 3 | S |

## Etap 2: klient spięty z budową, fakturą i terminami

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 2.1 | **Wybór klienta na karcie budowy i w „Nowa budowa”.** Pole „Inwestor” podpowiada klientów; wybór zapisuje powiązanie i kopiuje nazwę i telefon do karty (zasada 2). Wpisanie nowej nazwy proponuje założenie klienta. | `NewSiteDialog.tsx`, `SiteCardDialog.tsx`, `siteActions.ts` | 3 | M |
| 2.2 | **Nabywca na fakturze z kartoteki.** Okno faktury wypełnia nazwę, NIP i adres z klienta. Zmiana danych w oknie pyta „Zapisać u klienta?”. | `InvoiceDialog.tsx`, `CorrectionDialog.tsx` | 3 | S |
| 2.3 | **Historia na karcie klienta.** Budowy i zlecenia ze statusem, faktury (przez `siteId`), niezapłacone (istniejące `unpaidTotal` i `SiteBillingDues`), zgłoszenia serwisowe i gwarancje. | `ClientCard.tsx`, nowy `src/lib/clients/history.ts` + test | 3 | M |
| 2.4 | **Saldo z Długów na karcie klienta** (WK-2), tylko do odczytu, z przejściem do Długów. | `ClientCard.tsx`, `src/lib/debts/model.ts` | 1 | S |
| 2.5 | **Klient w szukaniu i palecie poleceń.** „Przejdź do klienta…”, wynik w wyszukiwarce działów. | `CommandPalette.tsx`, `viewSearch.ts` | 2 | S |
| 2.6 | **Scalanie duplikatów.** Dwóch klientów → jeden; budowy przepinane, puste pola uzupełniane z drugiego. Z potwierdzeniem i cofnięciem. | `src/lib/clients/merge.ts` + test | 2 | M |

## Etap 3: wycena — dokument dla klienta

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 3.1 | **Numer i daty wyceny.** Numer „W/2026/11/003” (wzór z `numbering.ts`), data wystawienia, „ważna do” (domyślnie 14 dni). Nowe pola w `JobMeta`, bez zmiany starych. | `jobs.ts`, `yJobs.ts`, nowy `quoteNumbering.ts` + test | 3 | S |
| 3.2 | **VAT i rabat** (WK-3). Przełącznik brutto / netto + stawka; rabat procentowy na całość. Sumy liczone w jednym miejscu (`quoteTotals`), te same w panelu, PDF i fakturze. | `jobs.ts`, `SiteJobPanel.tsx`, `InvoiceDialog.tsx` | 3 | M |
| 3.3 | **Uwagi i warunki.** Pole na wycenie plus domyślny tekst w Ustawieniach → Praca (np. termin realizacji, zaliczka, gwarancja). | `jobs.ts`, `companyPrefs.ts`, `settings/` | 2 | S |
| 3.4 | **PDF z tabelą.** Kolumny: nazwa, ilość, j.m., cena, wartość; dane wykonawcy i klienta z kartoteki, numer, ważność, warunki, miejsce na podpis. Rozszerzenie `PdfWriter` o tabelę. | `pdfWriter.ts`, `jobPdf.ts` + test | 3 | M |
| 3.5 | **Stan wyceny bez nowych statusów** (zasada 3). Pola `sentAt`, `acceptedAt`, `rejectedAt`; pigułka „Wysłana 3 dni temu”. „PDF wyceny” ustawia `sentAt`. | `jobs.ts`, `SiteJobPanel.tsx`, `JobsDialog.tsx` | 2 | S |
| 3.6 | **Akceptacja podpisem.** Klient podpisuje wycenę na telefonie (istniejący `SiteSignatureDialog`, reguła `signatureValidFor`); podpis trafia do PDF. | `SiteJobPanel.tsx`, `jobPdf.ts` | 2 | S |

## Etap 4: szybsze składanie wyceny

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 4.1 | **Cenniki w synchronizacji** (WK-4). Robocizna i materiał w mapie Yjs, jednorazowe przeniesienie z localStorage, limit pozycji podniesiony. | `pricing.ts`, `materialPrices.ts`, nowy `yPricing.ts` + testy migracji | 3 | M |
| 4.2 | **Materiał z cennika do pozycji.** Dziś „Z cennika” działa tylko dla robocizny; dodać materiał z podpowiedzią ceny po nazwie (`priceOf`). | `SiteJobPanel.tsx` | 3 | S |
| 4.3 | **Szablony wycen.** Zestaw pozycji pod nazwą („Łazienka — biały montaż”); „Zapisz jako szablon” i „Wstaw szablon”. | nowy `src/lib/study/quoteTemplates.ts` + test, `SiteJobPanel.tsx` | 3 | M |
| 4.4 | **Pozycje z punktów i z kalkulatorów.** Punkty instalacyjne z karty × stawka typu (`pointRateFor`) → pozycje robocizny; wynik kalkulatora → pozycja materiału. | `billing.ts`, `calc.ts`, `SiteJobPanel.tsx` | 2 | M |
| 4.5 | **Duplikuj wycenę** do innego zlecenia albo klienta (WK-5). | `yJobs.ts`, `JobsDialog.tsx` | 2 | S |
| 4.6 | **Nowa wycena od klienta** (WK-6): z karty klienta jednym przyciskiem, karta budowy zakładana w tle. | `ClientCard.tsx`, `siteActions.ts` | 2 | S |

## Etap 5: po wycenie — pilnowanie i rozliczenie

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 5.1 | **Przypomnienie o wycenie bez odpowiedzi.** Wysłana i bez akceptacji po 7 dniach → pozycja w Terminach i na Dziś (jak terminy serwisu i zamówień). | `dueTerms.ts`, `reminderAgenda.ts` | 2 | S |
| 5.2 | **Wycena a wykonanie.** W panelu zlecenia: materiał wyceniony / zużyty (`materialUsage`), robocizna wyceniona / godziny × stawka, różnica w złotych. | nowy `src/lib/study/quoteVsActual.ts` + test, `SiteJobPanel.tsx` | 3 | M |
| 5.3 | **Zaliczka.** Kwota zaliczki na wycenie; wpłata zapisywana jako istniejąca `Payment`; „do zapłaty” pomniejszone w potwierdzeniu wykonania. | `jobs.ts`, `billing.ts`, `jobPdf.ts` | 2 | M |
| 5.4 | **Przegląd wycen.** W „Zlecenia”: filtr stanu, sumy miesiąca (wysłane, przyjęte, odrzucone), skuteczność w procentach. | `JobsDialog.tsx`, `jobs.ts` | 1 | S |

## Etap 6: jakość

| # | Co | W | N |
|---|----|---|---|
| 6.1 | e2e: klient → budowa → wycena z szablonu → PDF → akceptacja → faktura z danymi z kartoteki (`e2e/clients.spec.ts`, `e2e/quote.spec.ts`). | 3 | M |
| 6.2 | Dostępność: `e2e/a11y.spec.ts` dla listy i karty klienta oraz panelu wyceny; cele dotyku 44 px. | 3 | S |
| 6.3 | Budżet: `e2e/bundle.spec.ts` bez wzrostu paczki startowej; nowe ekrany w leniwych chunkach, sprawdzenie precache. | 3 | S |
| 6.4 | Synchronizacja: test dwóch urządzeń (edycja klienta i wyceny równocześnie), zgodność ze starszą wersją. | 3 | M |
| 6.5 | `opis.md`: nowy dział „Klienci”, poprawiony opis fuch i faktur. | 2 | S |

## 5. Kolejność i zależności

1. **Etap 1 → Etap 2.** Najszybszy zysk: po 2.2 znika wpisywanie NIP przy każdej fakturze.
2. **Etap 3** nie zależy od klientów poza 3.4 (dane klienta w PDF); można zacząć od 3.1–3.3 równolegle.
3. **Etap 4** wymaga decyzji WK-4; 4.2 i 4.3 dają najwięcej przy małym nakładzie.
4. **Etap 5** po Etapie 3 (potrzebuje `sentAt` i VAT).
5. **Etap 6** na bieżąco po każdym etapie, pełne e2e na końcu.

## 6. Ryzyka

- **Dane osobowe w synchronizacji i kopii.** Kopia JSON nie jest szyfrowana domyślnie; do rozważenia zaszyfrowany eksport klientów tym samym mechanizmem co eksport faktur (`invoiceExport.ts`).
- **Dwie prawdy o kliencie.** Nazwa w karcie budowy i w kartotece mogą się rozjechać po edycji na starszej wersji. Kartoteka wygrywa przy wyświetlaniu; karta budowy jest kopią odświeżaną przy zapisie.
- **Precache bez zapasu.** Tabela w `PdfWriter` i nowe ekrany muszą zostać w leniwych chunkach poza listą precache albo trzeba zwolnić miejsce.
- **VAT na wycenie a faktura.** Zaokrąglenia w złotych (wycena) i groszach (faktura) mogą dać różnicę 1 gr; test porównujący sumę wyceny z sumą faktury z tych samych pozycji.

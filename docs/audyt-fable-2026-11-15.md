# Audyt: do czego jeszcze przyda się Fable (2026-11-15)

> **Status:** lista zadań; wyniki i zlecenia dla Opus/Sonnet są w `zlecenia-fable-2026-11-15.md` (kolumna „Stan” odsyła do nich). Przegląd przez czytanie kodu na `3cc066d6`.
> **Co jest sprawdzone:** własnoręcznie potwierdzone są tylko dwa ustalenia — dodatek nocny (zad. 1) i wyścig numeru faktury wraz z blokadą `busy` w oknie (zad. 2). Reszta to wskazania agenta z numerami linii, do potwierdzenia przy wykonaniu. Schemę XSD FA(3) sprawdzono u źródła 2026-11-15 (zad. 2 i 13); przepisów Kodeksu pracy nie.

## 1. Zasada doboru

Fable opłaca się tam, gdzie błąd jest cichy i drogi: poprawność prawna albo rachunkowa, współbieżność i zbieżność danych, kasowanie nieodwracalne, diagnoza bez odtworzenia. Nie opłaca się tam, gdzie wynik widać od razu na ekranie albo w CI.

## 2. Zadania

| # | Zadanie | Gdzie | Rozmiar | Rodzaj | Stan |
|---|---|---|---|---|---|
| 1 | Grafik względem KP: dodatek nocny, norma przy nieobecności w weekend, tydzień odpoczynku; przypadki wzorcowe | `src/lib/shifts/**` | M | przegląd i poprawki | zrobione w kodzie; D-G1 |
| 2 | KSeF Etap 1: numeracja, niezmienność rekordu tylko lokalnie, walidacja przy odczycie ukrywająca stare faktury, limity kwot, seria „A” | `src/lib/ksef/**` | M | przegląd i poprawki | przegląd zrobiony; zlecenia Z-2.1–Z-2.7 |
| 3 | KSeF Etap 2: przegląd projektu serwera przed wykonaniem (podwójna wysyłka, tryb offline, sesja szyfrowana) | plan KSeF | M | plan | uwagi do projektu; Z-3 |
| 4 | Edycja tekstu: `writeContent` podmienia całą treść, gdy edytor się nie zamontował — przy edycji z drugiego urządzenia grozi utratą lub zdublowaniem | `useNoteEditSession.ts`, `yjsStore.ts:85–90, 655–658` | M | przegląd i testy zbieżności | poprawione w kodzie; testy Z-4.T |
| 5 | Klient przekaźnika: kursor, kolejka niewysłanych, migawka — plan F2 obejmuje tylko serwer | `relayProvider.ts:175–311` | M | przegląd i testy | Z-5.1–Z-5.4 w kodzie; drugi przegląd 2026-11-16: Z-5.5–Z-5.9, Z-5.T |
| 6 | Odśmiecanie obrazów: listy odwołań utrzymywane ręcznie w dwóch plikach; raz już skończyło się utratą zdjęć | `yjsStore.ts:758–771`, `journalRefs.ts`, `imageStore.ts`, `useNotes.ts:213–229` | S/M | test-strażnik | specyfikacja; Z-6 |
| 7 | Wiele kart: co dokładnie blokować, zanim ktoś zrobi Q1.1 | `plan-qol-platforma-2026-11-15.md` | S/M | plan | plan; Z-7 |
| 8 | Godzina ścienna przypomnień (zmiana czasu, zgodność wstecz) | przypomnienia, `push/schedule.ts` | M | plan | pytania do planu; Z-8 |
| 9 | Niestabilny `reminders-agenda.spec.ts` — może być prawdziwym wyścigiem w interfejsie | `e2e/` | S/M | diagnoza | hipotezy; Z-9 |
| 10 | „Kroje się nie zapisują” — trzy możliwe przyczyny | `persistedStore.ts:71–87`, `appFont.ts:34–42`, `appearanceCode.ts:14` | S | diagnoza | diagnoza; Z-10 |
| 11 | Praca w Yjs: symulacja równoległych zdjęć i odhaczeń zamiast ręcznego QA na dwóch telefonach | `src/lib/study/**` | S/M | testy | zlecenie testów; Z-11 |
| 12 | Migracja `study/data.ts` pokryta testami w 59% | `src/lib/study/data.ts` | S | testy | zlecenie testów; Z-12 |
| 13 | FA(3): dokument mówi, że pola P_13/P_14 są obowiązkowe, kod emituje tylko użyte stawki — rozstrzygnąć ze schemą | `src/lib/ksef/fa3.ts` | S | przegląd | rozstrzygnięte (kod zgodny z XSD) |

Ponad tą listą stoją zadania już zlecone: przegląd `plan-skarbiec-krypto` (zrobiony, w tym błąd C-1 w istniejącym kodzie) oraz weryfikacja `plan-security` i `plan-migracje-yjs` (zrobiona).

## 3. Szczegóły ustaleń potwierdzonych

- **Dodatek nocny (zad. 1).** `nightAllowance.ts` liczy 20% stałej `MIN_HOURLY_WAGE` (31,40 zł w 2026 r., czyli minimalna stawka godzinowa dla zleceń). Art. 151⁸ § 1 KP mówi o 20% stawki godzinowej **wynikającej z minimalnego wynagrodzenia za pracę**, czyli minimalne wynagrodzenie miesięczne podzielone przez liczbę godzin do przepracowania w danym miesiącu — stawka zmienia się co miesiąc. Do potwierdzenia u źródła przed poprawką.
- **Numer faktury (zad. 2).** `issueInvoice` (`ksef/invoicesStore.ts:25–37`) wylicza `nextInvoiceNumber` przed `await sha256Hex(xml)`, a zapisuje po nim — dwa wywołania w locie dostaną ten sam numer. Okno ma blokadę `busy` (`InvoiceDialog.tsx:100, 255`), więc podwójne stuknięcie tego nie wywoła; zostaje druga karta i drugie urządzenie.

## 4. Czego Fable nie warto dawać

Podziały dużych plików, CSS i motywy, widoki Długów i Ćwiczeń, konfiguracja CI, Q1.2/Q1.5/Q1.6 z planu QoL, progi paczki, `opis.md` i porządki w dokumentach, ręczne QA na telefonie.

## 5. Czego audyt nie objął

`exportNotes.ts` (atomowość przywracania kopii), `push/schedule.ts`, `study/billing.ts`, parsery w `import/` i `plans/`.

# Co zostało do zrobienia — stan 2026-11-25

> **Źródła:** linie „Status” w planach, numery punktów w `git log` od 14.11, pamięć sesji. Zastępuje sekcję „Co zostało do zrobienia” w `stan-planow-2026-11-15-i-17.md` (stan z 20.11).
> Plany z zrobionym kodem są w `docs-zrobione/` (spis: `docs-zrobione/README.md`).

## 1. Kod do zrobienia bez blokad (kolejność proponowana)

| Kolejność | Plan | Punkty | Uwagi |
|---|---|---|---|
| 1 | `plan-security-2026-11-15.md` | S3.2 | Zrobione 25.11: S1.1 (Trusted Types egzekwowane), S2.3, S3.3, S3.4, S4.5–S4.8, S6.1–S6.4; wcześniej S0, S1.2–S1.7, S1.9, S1.10, S2.1, S2.2, S2.5, S2.6, S3.1, S4.3, S4.4, S5 |
| 2 | `plan-architektura-2026-11-15.md` | A3.4, A4.5 (kopia `merge.ts`), A4.7, A5.5 (`knip`, decyzje w `docs/zaleznosci-2026-11-25.md`) | Zrobione: A1.1, A1.4–A1.6, A2, A3.1 (z zamianą importów), A3.2, A3.3, A4.3, A4.1, A4.2, A4.4, A4.6, A5.3, A5.4 |
| 3 | `plan-qol-platforma-2026-11-15.md` | Q1.4, Q3.2, Q3.3, Q3.6, Q3.8, Q3.9, Q4.1, Q4.2, Q5.1–Q5.3, Q5.5 | Zrobione: Q1.1–Q1.3, Q1.5, Q1.6, Q2.1–Q2.3, Q3.1, Q3.4, Q3.5, Q3.7, Q3.8, Q4.3, Q5.4 |
| 4 | `plan-cwiczenia-2026-11-15.md` | C1.1, C2.2, C2.3, C3.1, C3.4, C4.1, C4.5 | Zrobione: C1.2–C1.4, C2.1, C2.4, C2.5, C3.2, C3.3, C3.5, C4.3, C4.4 |
| 5 | `plan-dlugi-2026-11-15.md` | L1.2 (po Z-17.9), L2.3 | Zrobione: L1.1, L2.1, L2.2, L2.4, L4.1–L4.4 |
| 6 | `plan-skarbiec-krypto-2026-11-15.md` | ADR-10, K1, K6.1–K6.3, K7; dokończyć K3, K4 | Zrobione: K0 (błąd C-1) |
| 7 | `plan-migracje-yjs-2026-11-15.md` | D0.3, D1.3 | Reszta zrobiona (D6 zamknięte 23.11) |
| 8 | `plan-warstwa-wizualna-2026-11-15.md` | W0.1, W9.2 (nowe wzorce `@visual`) — W2.6 zrobione 25.11 | Etapy W1–W6 i W8.1–W8.2 zrobione |
| 9 | `zlecenia-fable-2026-11-15.md`, `audyt-2-2026-11-17.md`, plany użycia Fable | Z-1.T, Z-2.4, Z-4.T, Z-7.x, Z-8.1, Z-8.2, Z-9, Z-10, Z-11 (po Z-17.9), Z-13.x, Z-14.1, Z-14.4, Z-17.9, Z-18.2, Z-18.5, Z-18.6, Z-18.9 | Część mogła zostać zrobiona przy innych punktach — sprawdzić w kodzie przed startem |
| 10 | `plan-ustawienia-2026-10-25.md` | 1.2, 1.3, 2.4, 2.5 (wpisy > 512 KB), 3.2–3.4 (częściowe), 5.1–5.3 | |
| 11 | `plan-powloka-2026-10-25.md` | 2.5 (komendy w palecie), 4.1–4.4 | |
| 12 | `plan-skarbiec-2026-10-25.md` | 3.3 | 1.2 cz. 2 przeszło do planu krypto |
| 13 | `Plan-nowy.md` | 2.6, 2.7, 2.9, 3.1–3.3, 3.5 | |
| 14 | `plan-ksef-etap2.md` | cały Etap 2 (serwer wysyłkowy) | Przed kodem: `security-reviewer` i decyzje D-K3… |
| 15 | `plan-praca-budowa-2026-11-10.md` | Faza 5 i B6 po pomiarze B0.2/B0.3 | Fazy 1–4 zrobione |

## 2. Czeka na telefon (QA)

Jedna sesja na telefonie odblokowuje najwięcej:
- `qa-praca-telefon.md` (R1.1), B0.2/B0.3 — pomiar Pracy na budowie, R4.2 (p75 zapisu zdjęcia), R2.3 (licznik użycia, R1.3);
- F1.0 (APK z alarmami) — potem R4.5, C2.6, C5.1, Z-14.6;
- W7.5, W9.3, ręczne QA ze wszystkich planów w `docs-zrobione/` (dotyk, arkusze, obrót, skaner QR na iPhonie).

## 3. Czeka na decyzję właściciela

| Decyzja | Odblokowuje |
|---|---|
| SE-1, SE-3 i pozostałe SE | S1.8, S2.4, S4.1, S4.2, S4.9–S4.11, Q4.4, sesja F |
| AR-1, AR-2 | A5.1, A5.2 |
| QL-2 | Z-16.3 |
| DL-2, DL-3, D-3 | L3.x, L5.x, Dziś 3.4, Długi 3.5 |
| CW-2, CW-3 | C4.2, C5.3 |
| MG-1 | D7.3 (D3.4, D3.6, D5.2 czekają na warunki z planu) |
| WZ-4, WZ-5, WZ-2 | W8.3, W7.4, jasna Tablica |
| G-7 | Grafik G4.8 |
| Hosting (SE-2) | G4.1 alarm push, wdrożenie przekaźnika (409) i serwera powiadomień |
| D-A4 | audyt 2 |

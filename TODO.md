# TODO

Otwarte pytania i zadania odłożone na później. Źródło: plan Praca (`docs/plan-praca-2026-10-24.md`) i sesje z 2026-10-25.

## Do decyzji właściciela
- **4.5 Wyszukiwanie bez polskich znaków.** Zrobione w zakresie listy kontrolnej (`StudyChecklist.tsx`). Pytań quizu nie przeszukuje; to osobna decyzja, jeśli będzie potrzebna.
- **Widżet `/widget`.** Działa jako osobny skrót PWA „Na dziś”. Czy zostaje w tej formie?
- **Esc w kompozytorze.** Zapisuje i zamyka (wybrany wariant). Czy wrócić do wariantu „szkic zostaje”?

## Wymaga materiału od właściciela
- **4.6 Więcej pytań wbudowanych.** Dziś ok. 29 pytań na 18 tematów. Potrzebne źródła (poradnik, listy kontrolne).

## Do zrobienia później
- **4.3 Własne tematy.** Nieznany temat jest cicho odrzucany przy wczytaniu (`sanitizeStudy` w `src/lib/study/store.ts`). Obecny UI nie tworzy tematów, więc odrzucenie dotyczy tylko uszkodzonych danych. Pełne własne tematy to nowy model danych (tematy w `studyCustom`, UI tworzenia i kolumny), więc czeka na osobny projekt.
- **Etap 6 (model danych w Yjs).** Opcje A i B zrobione 2026-10-25 (karta i odhaczenia jako mapy, zdjęcia i kształtki jako `Y.Array`, dump wersja 2). Zob. `docs/plan-dane-yjs-2026-10-25.md`. Do zrobienia: ręczne QA z dwoma telefonami (zdjęcia i odhaczenia równocześnie).
- **Import własnych materiałów do Nauki** (`roadmap.md`).

## Techniczne
- **Miejsce na dysku C.** Zostało ok. 1,6 GB z 465 GB. Mogą padać testy (awaria workera vitest). Sprawdzić cache npm i `node_modules`.
- **`aria-live` w Grafiku.** Scalony w jeden region. Do sprawdzenia w czytniku ekranu.
- **Test wydajności wyszukiwania** (`searchNotes.test.ts`, 50 ms) bywa niestabilny pod obciążeniem zestawu.
- **Test `a11y` „kalendarz — hydraulika”** nie przechodzi (kontrast przy „dziś”, znany problem).

## Plan rozwoju i dopracowania (2026-11-03) — szczegóły w `Plan-nowy.md`

- [ ] Ustalenia 7 agentów (inwentarz ×2, architektura, wydajność, bezpieczeństwo, testy, UX/a11y) dopisać do `Plan-nowy.md` §10 i poprawić kolejność cykli
- [x] Cykl 1 — porządek (zrobiony 2026-11-03, z CSP egzekwowanym): Status w planach Notatek/Ustawień/Powłoki, chwiejne testy ✅, `npm run check` ✅ (3 min), test zgodności danych ze starszą wersją ✅, zapas paczki ≥ 20 KB, porządek gałęzi, próg w CLAUDE.md
- [x] Cykl 2 — działy bez decyzji (zweryfikowane w kodzie 2026-11-12: Skrzynka, Dziś, Terminy, Kalendarz/Grafik/Praca i Ćwiczenia bez otwartych punktów, które da się zrobić bez decyzji lub telefonu). Zostają: Dziś 3.4 (czeka na D-3), Skarbiec 3.3 (szyfrowane pliki, L, po przeglądzie bezpieczeństwa), G4.1 (push, hosting), P4.6 i P4.1/P4.4 (źródła od właściciela), cele dotyku 44 px i paleta w kontekście notatki (niesprawdzone)
- [ ] Cykl 3 — architektura i wydajność: podział `Index.tsx`, wyszukiwanie w Workerze, pomiar INP/LCP, ADR, `<Activity>` po pomiarze
- [ ] Cykl 4 — telefon: jedna sesja QA (H4.2, H6.1, H6.2, Długi Etap 5, Wygląd Faza 8, motywy, udostępnianie 5.3, DWG, Terminy 3.2, Skrzynka 2.5); wdrożenie push po decyzji o hostingu
- [ ] **KSeF Etap 2 (odłożone 2026-11-12 decyzją właściciela):** osobny `ksef-server/` (token KSeF tylko po stronie serwera, kolejka dosłania, status po hashu). Wymaga decyzji o hostingu i tokenu testowego KSeF; przed startem sprawdzić w Dz.U., czy kary KSeF odroczono do 2028. Szczegóły: `docs/ksef-integracja-2026-11-11.md`. Etap 1 (wystawianie, PDF z QR, korekty, zaszyfrowany eksport) zrobiony.
- [ ] Decyzje właściciela: H-1, H-6, D-3, P0.2, Skarbiec 1.2 cz. 2, C-1, K-4, „Gotowe kończy serię”, hosting, zapis „Mój N”

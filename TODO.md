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
- [ ] Cykl 1 — porządek: Status w planach Notatek/Ustawień/Powłoki, chwiejne testy (pasek boczny 1440 px, site-faults, study-delivery, „praca — odblask”), `npm run check`, test zgodności danych ze starszą wersją, zapas paczki ≥ 20 KB, porządek gałęzi, próg w CLAUDE.md
- [ ] Cykl 2 — działy bez decyzji: Skrzynka 2.3, 3.1, 3.4, 4.1–4.4, 4.6; Dziś 2.1–2.5, 4.2, Etap 3; Terminy 4.5, 3.4; Kalendarz/Grafik/Praca z planu 27.10; Skarbiec 2.2, 3.3, Etap 4; cele dotyku 44 px; paleta w kontekście notatki
- [ ] Cykl 3 — architektura i wydajność: podział `Index.tsx`, wyszukiwanie w Workerze, pomiar INP/LCP, ADR, `<Activity>` po pomiarze
- [ ] Cykl 4 — telefon: jedna sesja QA (H4.2, H6.1, H6.2, Długi Etap 5, Wygląd Faza 8, motywy, udostępnianie 5.3, DWG, Terminy 3.2, Skrzynka 2.5); wdrożenie push po decyzji o hostingu
- [ ] Decyzje właściciela: H-1, H-6, D-3, P0.2, Skarbiec 1.2 cz. 2, C-1, K-4, „Gotowe kończy serię”, hosting, zapis „Mój N”

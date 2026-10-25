# TODO

Otwarte pytania i zadania odłożone na później. Źródło: plan Praca (`docs/plan-praca-2026-10-24.md`) i sesje z 2026-10-25.

## Do decyzji właściciela
- **4.5 Wyszukiwanie bez polskich znaków.** Zrobione w zakresie listy kontrolnej (`StudyChecklist.tsx`). Pytań quizu nie przeszukuje; to osobna decyzja, jeśli będzie potrzebna.
- **Ziarno papieru w Zeszycie.** Kod ma martwą regułę `html:not([data-skin])` (usunięta). Czy ziarno ma wrócić i w którym stylu?
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

# Zadanie: moduł „Analizator planów hydraulicznych” (zlecone 2026-10-29)

> **Status:** na liście do zrobienia (`TODO.md`), realizacja nie zaczęta. Treść zlecenia właściciela poniżej, skrócona do wymagań; na końcu uwagi o dopasowaniu do tego repozytorium.

## Cel

Nowy, odrębny dział „Analizator planów” w istniejącej aplikacji (nie nowa aplikacja, bez przepisywania). Źródło: zrzuty ekranu z DWG FastView (PNG, JPG/JPEG, WebP), nie pliki DWG. Ręczne wyznaczanie tras i liczenie długości jest najważniejsze; automatyka (OCR, wykrywanie linii) tylko wspomaga i zawsze wymaga zatwierdzenia.

## Zasady pracy (z zlecenia)

- Przeanalizować repozytorium, `CLAUDE.md`, dokumentację; użyć istniejących komponentów, bibliotek i konwencji; nie ruszać niezwiązanych funkcji.
- Nowe biblioteki tylko po sprawdzeniu potrzeby i zgodności. Rozwiązania darmowe, open source, bez płatnych API. Obrazy klientów nie wychodzą do zewnętrznych usług.
- Bez atrap: funkcja działa i jest przetestowana albo jest jasno oznaczona jako niegotowa.
- Niezgodność architektoniczna → rozwiązanie pasujące do projektu, udokumentowane.

## Widoki

Lista analiz, nowa analiza, import obrazu, edytor planu, kalibracja skali, rozpoznawanie opisów i symboli, ręczna korekta tras, zestawienie materiałów, eksport wyników. Pozycja w istniejącej nawigacji i wyglądzie.

## Wymagania

1. **Import:** wybór pliku i przeciąganie, podgląd, nazwa analizy, limit rozmiaru, walidacja typu, czytelne błędy, usunięcie i ponowny import. Proporcje zachowane; duże obrazy skalowane roboczo, pomiary w układzie oryginału.
2. **Edytor:** zoom, przesuwanie, dopasowanie do ekranu, widok początkowy; nakładki opisów, tras i symboli; zaznaczanie i usuwanie tras; rysowanie trasy punkt po punkcie; edycja właściwości; ręczne symbole; podświetlenie elementu z zestawienia. Wygodny dotyk na Androidzie. Canvas/SVG bez ciężkiej biblioteki bez uzasadnienia.
3. **Kalibracja:** dwa punkty + znana długość → `metersPerPixel = knownDistanceMeters / pixelDistance`; długość trasy = suma odcinków polilinii × `metersPerPixel`. Współrzędne w układzie obrazu (zoom, przesunięcie, skalowanie). Bez skali: długości w pikselach, metry „nieustalone”, komunikat o potrzebie kalibracji. Nie wymyślać wymiarów.
4. **OCR:** Tesseract.js (lokalnie, Web Worker). Średnice Ø16 / ø16 / ⌀16 / DN16, oznaczenia WC, WZ, ZW, CWU, CO, opisy rur. Normalizacja i typowe błędy OCR. Wynik: id, tekst, prostokąt, pewność, status weryfikacji; poprawianie tekstu. Średnica do rury tylko z odległości, geometrii i ręcznego zatwierdzenia.
5. **Wykrywanie tras:** OpenCV.js albo odpowiednik — kontrast, szum, kolory, linie, segmenty, propozycje tras, przypisanie opisów. Nie każda linia to rura (ściany, wymiary, osie, meble, symbole, tekst, nakładanie). Ręczne rysowanie zawsze dostępne.
6. **Modele (dopasować do istniejącego zapisu):** `AnalysisProject` (id, nazwa, obraz, szerokość, wysokość, kalibracja, daty, status), `PipeRoute` (systemType, diameterMm, points, lengthPixels, lengthMeters, measurementStatus, confidence, verifiedByUser), `DetectedText` (text, boundingBox, confidence, verifiedByUser), `DetectedSymbol` (symbolType, position, confidence, verifiedByUser), `MaterialItem` (category, description, systemType, diameterMm, quantity, unit, verificationStatus). Bez drugiej bazy.
7. **Instalacje:** zimna woda, CWU, CO, kanalizacja, inne, nierozpoznane; zmiana klasyfikacji; mapowanie kolorów na typy per projekt.
8. **Symbole:** architektura wzorców; w v1 tylko wiarygodne reguły + ręczne dodanie, klasyfikacja, korekta, usunięcie, pewność, oznaczenie „dodany ręcznie”. Typy: punkt poboru, zawór, rozdzielacz, kolano, trójnik, podejście, inne.
9. **Zestawienie:** grupowanie zatwierdzonych tras po instalacji, średnicy, długości i statusie pomiaru; osobno potwierdzone, szacunkowe, bez skali, symbole zatwierdzone, do weryfikacji. Niepotwierdzone symbole poza pewnym zestawieniem. Edycja, usuwanie, ręczne pozycje, CSV, podświetlenie trasy z wiersza. Kolana i trójniki nie z przypadkowych przecięć.
10. **Wydajność i bezpieczeństwo:** OCR poza głównym wątkiem, anulowanie i ponowienie, postęp, limity plików, walidacja, bez wykonywania zawartości plików, plany nie w publicznych katalogach, bez sekretów w kliencie, bez płatnych i obowiązkowych usług chmurowych.
11. **Testy:** jednostkowe — kalibracja, długość odcinka i polilinii, przeliczenie współrzędnych po zoomie, parsowanie średnic, normalizacja OCR, grupowanie i sumowanie, oznaczanie wyników bez skali; interfejsu — import, rysowanie trasy, kalibracja, edycja średnicy, ręczny symbol, zestawienie, CSV. Testy, lint, typecheck i build zielone (bez usuwania testów).

## Kolejność (z zlecenia)

1. Analiza repozytorium i plan zmian.
2. Nowy dział, routing, import i edytor obrazu.
3. Kalibracja i ręczne wyznaczanie tras.
4. OCR i rozpoznawanie średnic.
5. Propozycje tras z obrazu.
6. Symbole i ręczna korekta.
7. Zestawienie materiałów i CSV.
8. Testy, poprawki, dokumentacja. Po każdej fazie sprawdzić, że aplikacja działa.

## Kryteria ukończenia

Dział dostępny; import zrzutu; zoom i przesuwanie; ręczna trasa; kalibracja; długość polilinii; OCR odczytuje i pozwala poprawić średnice; symbole dodawane i korygowane; zestawienie; wyniki bez skali nie jako metry; CSV; testy i build przechodzą albo problemy są opisane. Raport końcowy: co dodane, pliki, biblioteki i powód, uruchomienie, test na zrzucie z DWG FastView, co automatyczne a co wymaga zatwierdzenia, wyniki testów, ograniczenia i dalsze kroki.

## Uwagi o dopasowaniu do repozytorium (2026-10-29, przed realizacją)

- **Dane:** aplikacja nie ma serwera ani bazy SQL ani kont — wszystko w Yjs (IndexedDB, synchronizacja między urządzeniami, kopia zapasowa), bajty obrazów w `imageStore`. Modele z pkt 6 → osobne mapy Yjs w leniwej warstwie (wzór `yEntryCheck.ts` + `entryCheckStore.ts`), klucze obrazów dopisane do `journalRefs.ts`/`referencedImages`, inaczej sprzątanie je skasuje. „Kontrola dostępu” = prywatność urządzenia i grupy synchronizacji; do przeglądu `security-reviewer` (nowe mapy Yjs, obrazy klientów w kopii i synchronizacji).
- **Paczka:** cały moduł jako leniwy widok (`indexViews.ts`). Tesseract.js (silnik WASM + dane języka `pol`/`eng`, kilka MB) i OpenCV.js (~8 MB) poza precache (`globIgnores`), ładowane na żądanie — nie zmieszczą się w budżecie precache 3,9 MiB. Dane języka OCR lokalnie z `public/` albo z cache po pierwszym pobraniu (offline po pierwszym użyciu). Przegląd `performance-engineer` przed dodaniem zależności (zasada `CLAUDE.md`).
- **Edytor:** jest `DrawingCanvas` (rysunek na zdjęciu) i SVG — edytor tras na SVG z Pointer Events (zoom szczypaniem, przesuwanie), bez nowej biblioteki.
- **Powiązanie z Pracą:** analiza może należeć do budowy (`siteId`) — zestawienie rur trafi wtedy do „Do zamówienia” (rury w metrach z H1.1: `pipes.ts`).
- **Agenci przed startem:** `architect` (granice modułu i model danych), `frontend-design` przed widokami, `security-reviewer`, `performance-engineer`.

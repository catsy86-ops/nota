# Dane lokalne: kopie dzienne (Q1.4), import porcjami (Q3.8), zdjęcia w tle (R4.2)

Specyfikacja do sesji C z `plan-uzycia-fable-2026-11-17.md`. Data: 2026-11-17. Kodu nie ma. Decyzje z przyjętymi zaleceniami domyślnymi, **do potwierdzenia przez właściciela**:

| Decyzja | Przyjęte |
|---|---|
| QL-1 — szyfrowanie migawek w OPFS | wcale (§1.2) |
| D-F3 — „Przywróć z dnia…” | domyślnie jako kopie notatek; wymiana całego dokumentu tylko jako ścieżka awaryjna (§1.5, §1.6) |

## 1. Q1.4 — dzienne migawki w OPFS

### 1.1 Co to daje i czego nie

Migawka to pełny stan głównego dokumentu Yjs (wszystkie mapy: notatki, foldery, Grafik, Praca, Nauka, skarbiec…) zapisany w Origin Private File System — poza IndexedDB, więc przeżywa uszkodzenie bazy dokumentu. Nie przeżywa „Wyczyść dane witryny” ani odinstalowania aplikacji: to **nie zastępuje** kopii do pliku (Q1.3).

W migawce **nie ma obrazów ani załączników** (żyją w osobnej bazie `imageStore`; w dokumencie są tylko ich skróty) ani historii wersji notatek. Po utracie bazy obrazów migawka przywróci notatki z pustymi miejscami po zdjęciach. Zapisać to w opisie funkcji w Ustawieniach.

### 1.2 QL-1: bez dodatkowego szyfrowania

- Notatki prywatne są w dokumencie już zaszyfrowane — w migawce też.
- Notatki zwykłe leżą jawnie w IndexedDB tego samego źródła; OPFS ma tę samą granicę dostępu (to samo źródło, ten sam profil przeglądarki). Szyfrowanie migawki nie chroni przed niczym, przed czym nie chroni dziś baza.
- Klucz skarbca istnieje tylko przy odblokowanym skarbcu. Migawka szyfrowana tym kluczem nie mogłaby powstawać w tle ani dać się przywrócić po utracie bazy bez hasła — czyli zawodziłaby dokładnie w scenariuszu, dla którego jest.

### 1.3 Format i miejsce

- Katalog OPFS `kopie-dzienne/`, pliki `RRRR-MM-DD.nkopia` (data lokalna utworzenia), plik pomocniczy `indeks.json`.
- Plik: nagłówek + treść.
  - Nagłówek: 4 bajty `NKD1`, potem 4 bajty długości (big-endian) i tyle bajtów JSON UTF-8:
    `{ v: 1, createdAt, app: APP_VERSION, schema: SCHEMA_VERSION, notes: <liczba notatek>, bytes: <długość treści>, sha256: <skrót treści, szesnastkowo>, sv: <skrót SHA-256 wektora stanu, szesnastkowo> }`.
  - Treść: `Y.encodeStateAsUpdateV2(doc)` (to samo, co `yjsStore.encodeSyncState()`).
- `indeks.json`: lista `{ file, createdAt, notes, bytes, pinned? }` — tylko pamięć podręczna do ekranu; źródłem prawdy są nagłówki plików. Brak albo uszkodzenie indeksu → odbudowa z katalogu.
- Czytanie: plik bez poprawnego nagłówka, z inną długością albo skrótem jest pokazywany jako „uszkodzona” i nie da się go przywrócić. `v` większe niż znane → „zapisana przez nowszą wersję aplikacji”. Górna granica rozmiaru treści przy czytaniu: 256 MiB.

### 1.4 Kiedy powstaje i jak rotuje

- **Raz na dzień lokalny**, przy pierwszej okazji: 30 s po `yjsStore.ready()` (w `requestIdleCallback`, zapas `setTimeout`) oraz przy `visibilitychange → hidden`, jeśli dzisiejszego pliku jeszcze nie ma. Migawka łapie więc stan **z początku dnia** — to jest stan, do którego użytkownik chce wrócić po dniu, w którym coś zepsuł.
- Pomijana, gdy skrót wektora stanu (`sv`) jest taki sam jak w najnowszej migawce — dzień bez zmian nie zajmuje miejsca w rotacji.
- **Jedna karta:** `withLockIfFree("notatnik-kopia-dzienna", …)`; karta, która nie dostała blokady, nic nie robi. Kodowanie stanu jest synchroniczne (dla dokumentu kilku MB rzędu dziesiątek ms — **do pomiaru**; jeśli ponad 50 ms, kodować z kopii dokumentu w Workerze), skrót i zapis asynchroniczne.
- **Zapis bezpieczny:** `createWritable()` do pliku docelowego (przeglądarka pisze do pliku tymczasowego i podmienia przy `close()`), potem odczyt i sprawdzenie skrótu, dopiero potem rotacja. Do sprawdzenia przed kodem: dostępność `createWritable` w Safari na iOS; zapas — Worker z `createSyncAccessHandle` i zapis do `*.tmp` + `move`.
- **Rotacja:** zostaje 7 najnowszych poprawnych plików. Starsze są usuwane **po** udanym zapisie i weryfikacji nowego.
- **Ochrona przed „siedmioma kopiami pustki”:** jeśli nowa migawka ma mniej niż połowę notatek poprzedniej, a poprzednia miała ich co najmniej 20, poprzednia dostaje `pinned` i nie podlega rotacji (najwyżej jedna przypięta — nowsza przypięta zastępuje starszą). Masowe usunięcie albo uszkodzenie sprzed ponad tygodnia nie wypchnie wtedy ostatniego dobrego stanu. Przypiętą usuwa tylko użytkownik.
- **Brak miejsca** (`QuotaExceededError`): usunąć najstarszą nieprzypiętą i spróbować raz jeszcze; druga porażka → migawki dziś nie ma, stare zostają, w „Zdrowiu magazynu” (Q1.2) wiersz „Kopia dzienna nie zapisana — brak miejsca” (bez baneru; baner Q1.5 jest dla utraty danych, nie kopii).
- **Brak OPFS** (`navigator.storage.getDirectory` niedostępne albo rzuca — tryb prywatny, stara przeglądarka): funkcja ukryta, jeden wpis diagnostyczny.

### 1.5 Przywracanie — ścieżka domyślna: jako kopie notatek

Wczytanie starej migawki do działającego dokumentu **niczego nie cofa** — Yjs scala, a nowszy stan (w tym usunięcia) wygrywa. Dlatego przywracanie nie nakłada migawki na dokument.

1. Migawka jest wczytywana do **osobnego `Y.Doc`** w pamięci (nigdy niepodłączonego do bazy, synchronizacji ani kart).
2. Ekran „Przywróć z dnia 12.11”: lista notatek z migawki w trzech grupach — **usunięte od tamtej pory**, **zmienione od tamtej pory** (inna treść albo tytuł), bez zmian (zwinięte, bez akcji). Podgląd treści z migawki. Zaznaczanie pojedynczo i „wszystkie usunięte”.
3. Wybrane notatki wchodzą do bieżącego dokumentu jako **nowe notatki z nowymi identyfikatorami**, w folderze „Przywrócone 12.11”, z tą samą treścią, kolorem, etykietami i właściwościami; odwołania do obrazów zostają (obraz jest, jeśli `imageStore` go ma). Oryginały, jeśli istnieją, są nietknięte.
4. Notatki prywatne: kopiowane jako szyfrogram tylko wtedy, gdy metadane skarbca w migawce są takie same jak bieżące (ten sam klucz). Po zmianie hasła — pozycja wyszarzona: „Zaszyfrowana poprzednim hasłem — przywróć cały dokument albo użyj kopii do pliku.”
5. Całość w jednej transakcji, pod `MIGRATION_LOCK` (jak import kopii).

Skutki przy synchronizacji: przywrócone notatki są zwykłymi nowymi notatkami — rozchodzą się na wszystkie urządzenia, nic nie wraca „z zaświatów”, nic nie trzeba parować. **Ta ścieżka jest zawsze bezpieczna.**

Ograniczenie pierwszej wersji: obejmuje **tylko notatki**. Grafik, Praca, Nauka i pozostałe działy da się odzyskać ścieżką awaryjną albo z kopii do pliku. Powód: działy mają własne magazyny przywiązane do głównego dokumentu; czytanie ich z dokumentu pomocniczego to osobna praca na każdy dział (do rozważenia później, zaczynając od Grafiku).

### 1.6 Przywracanie — ścieżka awaryjna: wymiana całego dokumentu

Dla dwóch sytuacji: baza dokumentu jest uszkodzona albo pusta, albo użytkownik chce cofnąć **wszystko** do stanu z danego dnia.

Dokumentu w pamięci nie da się cofnąć, a inne karty i urządzenia dosłałyby nowszy stan z powrotem. Stąd kolejność:

1. Potwierdzenie z opisem skutków (teksty niżej). Przed wymianą aplikacja robi **migawkę bieżącego stanu** (`przed-przywroceniem-<czas>.nkopia`, poza rotacją, usuwana po 30 dniach) — wymianę da się cofnąć tą samą ścieżką.
2. Jeśli synchronizacja jest włączona: urządzenie **opuszcza grupę** (`forgetPairing`), kolejki przekaźnika (`pending:`, `state:`) są usuwane. Bez tego pierwsze połączenie scaliłoby stan grupy i cofnęło przywrócenie.
3. Zapis zamiaru: `localStorage["kaczy.restore.pending.v1"] = { file, startedAt }`.
4. Rozgłoszenie do pozostałych kart (`BroadcastChannel`): przeładuj się. Karta z nowszym stanem w pamięci dosłałaby go przez `tabSync.ts`.
5. Przeładowanie. Przy starcie, **zanim powstanie `IndexeddbPersistence`**, pod `withExclusiveLock(MIGRATION_LOCK)`: jeśli jest zapis zamiaru — sprawdzić plik (nagłówek, skrót), usunąć bazę dokumentu (`indexedDB.deleteDatabase`), założyć ją od nowa, nałożyć migawkę, poczekać na zapis, **dopiero wtedy** usunąć zapis zamiaru. Przerwanie w dowolnym miejscu powtarza krok od początku przy następnym starcie; plik uszkodzony → zamiar usuwany, baza nietknięta, komunikat.
6. Po starcie komunikat z wynikiem i — jeśli urządzenie było w grupie — instrukcja z pkt. poniżej.

Identyfikator klienta Yjs jest losowany przy każdym uruchomieniu (aplikacja go nie przypina — sprawdzone), więc cofnięty dokument nie użyje ponownie zegarów, które inne urządzenia już widziały.

**Grupa po wymianie dokumentu.** Pozostałe urządzenia mają nowszy stan. Gdyby dołączyły do nowej grupy ze swoimi danymi, scalenie cofnęłoby przywrócenie. Dlatego:

- przywracające urządzenie zakłada **nową grupę** (nowy kod długi);
- każde pozostałe urządzenie musi **najpierw wyczyścić swoje dane**, potem dołączyć nowym kodem. Dołączanie dostaje do tego opcję „Zastąp dane na tym urządzeniu danymi grupy” (czyści dokument tą samą ścieżką zamiaru co wyżej, z pustą treścią, i dołącza). Bez niej ścieżka awaryjna w grupie jest pułapką — nie wydawać jej osobno.
- Znacznik „kod zmieniony” z wymiany kodu (`plan-wymiana-kodu.md` §3.2) **nie wystarcza**: po ponownym sparowaniu urządzenie scala swój stan, a tu ma go porzucić. Wspólny z wymianą kodu jest tylko nowy kod i lista urządzeń do obejścia.

Teksty potwierdzenia: „Wszystkie dane w aplikacji wrócą do stanu z 12.11, godz. 7:40. Zmiany zrobione później znikną z tego urządzenia (zostanie ich kopia na 30 dni). Zdjęcia i załączniki nie są częścią kopii dziennej.” Przy włączonej synchronizacji dodatkowo: „To urządzenie opuści grupę synchronizacji. Pozostałe urządzenia zachowają obecne dane, dopóki nie zastąpisz ich danymi z tego urządzenia.”

**Start z pustą bazą.** Po każdej udanej migawce aplikacja zapisuje `localStorage["kaczy.snapshot.last.v1"] = { date, notes }`. Jeśli po `ready()` dokument ma zero notatek, a ostatnia migawka miała ich więcej niż zero i nie ma zapisu świadomego wyczyszczenia danych — baner: „Wygląda na to, że dane zniknęły. Jest kopia z 12.11 (148 notatek).” z przyciskiem prowadzącym do ścieżki awaryjnej.

### 1.7 Zlecenie Z-16.1 (Opus, M; w dwóch częściach)

**Stan 2026-11-17 (Fable):** część A zrobiona — `src/lib/dailySnapshot.ts`, zapas `src/workers/snapshotWrite.worker.ts`, sekcja i wiersz w Ustawieniach → Kopia i dane, testy `src/lib/dailySnapshot.test.ts` i `e2e/daily-snapshot.spec.ts`. Odstępstwa od §1.3–1.4:

- „Dzień bez zmian” rozpoznaje skrót **treści**, nie `sv`. Samo usunięcie nie przesuwa wektora stanu, więc dzień z samymi usunięciami zostałby pominięty.
- Brak pliku tymczasowego i `move` w zapasie przez Worker. Dzisiejszego pliku przed zapisem nie ma albo jest uszkodzony, a przerwany zapis zostawia plik „uszkodzona”, który następna próba zastępuje.

Pomiar kodowania (§1.4): 2000 notatek, 1,4 MB — mediana 15 ms na komputerze, czyli ok. 60 ms przy 4× spowolnieniu, raz dziennie w bezczynności. Worker nie pomoże, bo kopia dokumentu do Workera to to samo kodowanie. Decyzja: zostaje w wątku strony, do sprawdzenia na telefonie. Zostaje część B.

**Stan 2026-11-18:** część B zrobiona — ścieżka domyślna (§1.5), awaryjna (§1.6), „Zastąp danymi grupy” i baner pustej bazy; opis w `opis.md` („Kopia zapasowa — przywracanie z kopii dziennej”). Odstępstwa: każda porażka wymiany przy starcie (także zajęta blokada i zamiar starszy niż 1 h) zdejmuje zamiar i daje wynik „nie”, bez ponawiania; notatka jawna w kopii, a prywatna teraz, wraca zaszyfrowana (`sealCopy`).

Część A (bez decyzji D-F3 — obie ścieżki jej potrzebują): `src/lib/dailySnapshot.ts` — format, zapis, weryfikacja, rotacja, przypinanie, brak miejsca, brak OPFS; wiersz w „Zdrowiu magazynu”; lista migawek w Ustawienia → Kopia i dane (data, liczba notatek, rozmiar, „uszkodzona”). Testy (Vitest z atrapą katalogu OPFS): nagłówek i skrót; plik obcięty i z podmienionym bajtem odrzucony; rotacja 7; przypięcie przy spadku liczby notatek; dzień bez zmian pomijany; `QuotaExceededError` nie usuwa niczego poza najstarszą; dwie karty — jedna migawka.

Część B: ścieżka domyślna (§1.5) z ekranem; potem ścieżka awaryjna (§1.6) razem z opcją „Zastąp dane na tym urządzeniu danymi grupy”. Testy: usunięta notatka wraca jako kopia z nowym identyfikatorem i nie zmienia oryginałów; notatka prywatna po zmianie hasła jest wyszarzona; wymiana dokumentu przerwana po usunięciu bazy kończy się poprawnie przy następnym starcie; uszkodzona migawka nie rusza bazy; po wymianie urządzenie nie jest w grupie i nie ma kolejek przekaźnika; e2e „baza usunięta ręcznie → baner → przywrócenie”.

Diff części B (ścieżka awaryjna i start aplikacji) przegląda Fable przed scaleniem (sesja G).

## 2. Q3.8 — import kopii bez blokowania wątku

### 2.1 Problem

`restoreFullBackupLocked` woła `yjsStore.replaceAll` — jedna transakcja: usunięcie wszystkich notatek, folderów, etykiet i właściwości, potem wstawienie wszystkich z kopii. Przy 2000 notatek to jedno długie zadanie. Transakcji Yjs nie da się przerwać, więc oddawanie wątku oznacza wiele transakcji — a wtedy stany pośrednie są widoczne, wysyłane do innych urządzeń i zostają po zamknięciu karty. Naiwne pocięcie dzisiejszej kolejności (najpierw usuń, potem wstawiaj) dałoby przy zamknięciu karty **utratę danych**.

### 2.2 Kolejność, w której każdy stan pośredni jest bezpieczny

1. **Zapamiętać** zbiór identyfikatorów notatek istniejących na starcie importu (`przed`).
2. **Wstawianie porcjami.** Notatki z kopii są wstawiane albo nadpisywane (ten sam identyfikator → nowa wartość, jak dziś). Porcja nie ma stałego rozmiaru: wstawiamy, aż minie 30 ms, zamykamy transakcję, `await yieldToMain()`. Stan pośredni to **nadzbiór**: stare dane plus część nowych. Nic nie zniknęło.
3. **Jedna transakcja końcowa:** usunięcie notatek z `przed`, których nie ma w kopii, oraz wymiana folderów, etykiet i definicji właściwości. Usunięcia są tanie (bez tworzenia `Y.Text`); jeśli pomiar pokaże ponad 50 ms przy 2000 usunięć — też porcjami, to nadal bezpieczne (każdy stan pośredni jest nadzbiorem stanu końcowego).
4. Sekcje działów (`MERGE_SECTIONS`), Grafik, Nauka — jak dziś, z `await yieldToMain()` między sekcjami.

Usuwane są tylko notatki z `przed`: notatka utworzona przez użytkownika (albo dosłana przez synchronizację) **w trakcie** importu zostaje.

- **Przerwanie** (zamknięta karta, błąd, „Anuluj”): zostaje nadzbiór. Komunikat przy anulowaniu: „Przerwano. Notatki dodane z kopii zostają, nic nie zostało usunięte.” Wznowienia automatycznego nie ma (plik kopii nie jest przechowywany); ponowny import tej samej kopii daje ten sam wynik końcowy — nadpisuje te same identyfikatory.
- **Blokada:** bez zmian — cały import pod `MIGRATION_LOCK` (Q1.1), także między porcjami.
- **Synchronizacja: wysyłka porcjami, bez wstrzymywania.** Każda porcja to poprawna aktualizacja, a inne urządzenia przechodzą przez te same bezpieczne stany pośrednie. Wstrzymanie wymagałoby rozłączenia i ponownego połączenia wszystkich dróg (WebRTC nie ma pauzy) i nie daje nic przy tej kolejności.
- **Obserwatorzy.** Po każdej transakcji uruchamiają się obserwatorzy dokumentu (rzut notatek, indeks wyszukiwania, lista). 40 porcji to 40 uruchomień — jeśli któryś przelicza całość, suma będzie gorsza niż dziś. Dlatego pomiar jest pierwszym krokiem zlecenia, a nie ostatnim: jeśli długie zadania siedzą w obserwatorach, lekarstwem jest ich odroczenie na czas importu (flaga „import w toku” + jedno przeliczenie na końcu), nie mniejsze porcje.

`yieldToMain()` w `src/lib/yieldToMain.ts`: `scheduler.yield()` tam, gdzie jest, inaczej `setTimeout(0)` (Safari).

### 2.3 Zlecenie Z-16.2 (Opus, M)

**Stan 2026-11-17 (Fable):** Z-16.2 zrobione w całości (punkty 0–4). Najpierw punkty 1, 2 i 4 — `yjsStore.replaceAllChunked` (porcje, nadzbiór, transakcja końcowa z `final` = metadane skarbca), podpięte w `restoreFullBackupLocked` (`RestoreRun`: `onProgress`, `signal`), w oknie przywracania „Przywracanie notatek: N z M” i „Przerwij”; `src/lib/yieldToMain.ts`; testy `src/lib/yjsStore.chunked.test.ts`. Pomiar (punkt 0, `PERF=1 npx playwright test e2e/restore-perf.spec.ts`, Chromium, 4× spowolnienie, 2000 notatek po ok. 500 znaków): całość 3,8 s, **10 długich zadań: 869, 562, 477, 366, 258, 161, 154, 59, 57, 50 ms**. 

**Profil (2026-11-17, Fable; punkt 3 zrobiony).** Profil procesora przez CDP na buildzie bez minifikacji, długie zadania przypisane do próbek przez kalibrację zegara. Wyniki:

- Długie zadania siedziały **w porcjach**, nie w kopii „przed przywróceniem” ani w `parseFullBackup`. Na porcję składały się dwie rzeczy. Pierwsza: zamknięcie transakcji Yjs — kodowanie aktualizacji (`writeUpdateMessageFromTransaction`, dla IndexedDB i kart) kosztowało ok. dwa razy więcej niż samo wstawianie, a obserwatorzy (`useNotes` → `projectNotes`) dokładali swoje, więc porcja „30 ms” trwała ok. 100 ms. Druga: React renderował listę **synchronicznie** po każdej porcji, w mikrozadaniu tego samego zadania. To 200–900 ms, głównie pomiary układu framer-motion (`measureScroll` przy montowaniu), `NoteCard`, `ReminderPicker`, `buildWikiIndex`.
- Poprawki: (1) `budgetMs` liczy całą porcję razem z zamknięciem transakcji, a czas wstawiania jest dobierany po każdej porcji (domyślnie 20 ms); (2) `yjsStore.isBulkWriting()` / `onBulkWriteEnd` — `useNotes` odkłada rzuty do końca wymiany i liczy je raz.
- Po zmianie (ten sam skrypt, 4×): w fazie porcji **żadnego** zadania ponad 50 ms. Długich zadań było 12 (suma ok. 3,3 s), jest 8 (suma ok. 2,1 s). `PERF=1 npx playwright test e2e/restore-perf.spec.ts` na buildzie produkcyjnym, licząc też 3 s po komunikacie: 722, 632, 180, 137, 76, 60, 58, 55 ms (w innym przebiegu 1250 i 829 ms — rozrzut maszyny).
- **Zostaje (poza Z-16.2, to koszt listy, nie importu):**
  - jednorazowe przerenderowanie listy po końcu wymiany, ok. 730 ms przy 4×, w tym framer-motion `measureScroll` 130–150 ms;
  - dorysowanie kart wymuszone przez `flushSync` w sonner przy pokazaniu komunikatu, ok. 690 ms. Każdy `ReminderPicker` w karcie liczy przy tym `useShiftPresets` / `currentShiftPresets`, a montowanie komponentów motion znów mierzy przewinięcie (`measureScroll` ok. 180 ms);
  - `buildFullBackup` kopii „przed przywróceniem”, 60–77 ms przy pustym dokumencie — przy dużym dokumencie urośnie;
  - zadania natywne (styl i układ) 150–200 ms po renderze, w tym `clipObserver` (`ResizeObserver` z odczytem `scrollHeight`).

  Kandydaci na osobne zlecenie: liczenie presetów zmian w `ReminderPicker` dopiero po otwarciu, sprawdzenie, skąd w siatce montowanie z `measureScroll` (`layoutScroll` albo `layout` na kartach). Po udanym przywróceniu strona i tak przeładowuje się po 1,2 s, więc te koszty widać tylko przez chwilę.

0. Pomiar na 2000 notatek (profil wydajności, 4× spowolnienie procesora): gdzie są zadania ponad 50 ms — `withStoredImages`, transakcja, obserwatorzy, sekcje działów. Wynik do tego pliku.
1. `yjsStore.replaceAllChunked(notes, folders, labels, propDefs, { onProgress, signal })` według §2.2; `replaceAll` zostaje dla testów i małych kopii albo staje się wywołaniem nowej funkcji.
2. Pasek postępu i „Anuluj” w oknie przywracania.
3. Odroczenie obserwatorów — tylko jeśli pomiar je wskaże.
4. Testy: wynik końcowy identyczny z `replaceAll` (ten sam rzut notatek); przerwanie po k porcjach daje nadzbiór i nie usuwa niczego; notatka dodana w trakcie zostaje; drugi import po przerwanym daje stan końcowy; miara z planu (żadne zadanie ponad 50 ms przy 2000 notatek) jako test wydajnościowy poza zwykłym przebiegiem.
5. Indeks poza Workerem i eksport ZIP: sam `yieldToMain()` w pętlach, bez specyfikacji — nie zmieniają danych.

## 3. R4.2 — zdjęcia przetwarzane w tle (projekt warunkowy)

### 3.1 Najpierw pomiar

Dziś `prepareImage` (`src/lib/imagePrepare.ts`) działa przed dodaniem zdjęcia: `createImageBitmap` (dekodowanie poza wątkiem), rysowanie na `canvas`, `toBlob`. Wątek interfejsu blokuje głównie rysowanie; reszta to **czekanie**, nie zawieszenie. Pomiar (`performance-engineer`), telefon średniej klasy, 5 zdjęć 12 Mpx z aparatu w dzienniku budowy:

- czas od zamknięcia aparatu do pojawienia się zdjęcia we wpisie;
- najdłuższe zadanie wątku interfejsu.

**Budować tylko, gdy** mediana czekania na zdjęcie przekracza 500 ms albo jest zadanie ponad 100 ms. Inaczej punkt zamknąć z wynikiem pomiaru.

### 3.2 Projekt: bez kolejki — stan wynika z danych

Trwała kolejka to drugi magazyn prawdy, który może się rozjechać z dokumentem i z odśmiecaniem obrazów. Zamiast niej:

1. Zdjęcie jest zapisywane **od razu, w oryginale**: `imageStore.putBytes(oryginał)` → skrót `H0`. Wpis od razu dostaje odwołanie do `H0` i jest widoczny.
2. **„Do przetworzenia” to cecha wyliczana:** obraz, do którego odwołuje się dokument, który jest na tym urządzeniu, ma typ dający się zmniejszyć i rozmiar ponad `MAX_IMAGE_BYTES`. Licznik „przetwarzam 3” to liczba takich obrazów. Nic więcej nie trzeba zapisywać.
3. Przetwarzanie w Workerze (`createImageBitmap` z `imageOrientation: "from-image"` + `OffscreenCanvas.convertToBlob`) → bajty zmniejszone → `putBytes` → skrót `H1` → **podmiana odwołania `H0 → H1` w dokumencie** (`yjsStore.remapImageRefs`). Bez `OffscreenCanvas` (starszy Safari) — dzisiejsza ścieżka w wątku interfejsu.
4. `H0` po podmianie nie ma odwołań i znika zwykłym odśmiecaniem po 7 dniach (`GC_GRACE_MS`). **Nikt nie usuwa `H0` wprost.**

Dlaczego to nie gubi zdjęć:

| Zdarzenie | Skutek |
|---|---|
| Karta zamknięta przed przetworzeniem | Wpis odwołuje się do `H0`, który jest w magazynie. Po starcie obraz znów spełnia warunek z pkt. 2 i jest przetwarzany. |
| Karta zamknięta między `putBytes(H1)` a podmianą | `H1` bez odwołań (zniknie po 7 dniach albo zostanie użyty ponownie — ten sam wynik daje ten sam skrót tylko przy deterministycznym kodowaniu; nie zakładać). Po starcie przetwarzanie od nowa. |
| Odśmiecanie w trakcie | `H0` ma odwołanie w dokumencie, więc nie jest kandydatem; `H1` jest świeży (`addedAt`), chroni go okres karencji. |
| Dwie karty | Przetwarzanie pod `withLockIfFree("notatnik-zdjecia", …)`; podmiana jest powtarzalna (brak odwołań do `H0` → nic nie robi). |
| Użytkownik usunął zdjęcie w trakcie | Podmiana nie znajduje `H0` → nic; `H1` znika odśmiecaniem. |
| Przetwarzanie się nie udaje (uszkodzony plik) | Po 3 próbach w tej sesji obraz zostaje w oryginale, licznik go pomija; wpis diagnostyczny. Zdjęcie nadal jest. |

### 3.3 Pułapki do rozstrzygnięcia w kodzie

- **Oryginał nie może wyjść z urządzenia.** Odwołanie `H0` synchronizuje się razem z wpisem; bajty ponad `MAX_IMAGE_BYTES` nie mogą iść ani drogą bezpośrednią (`imageSync.ts`), ani jako blob przekaźnika. Sprawdzić, czy dzisiejsze ograniczenie rozmiaru (`mayLeaveDevice`) obejmuje zwykłe obrazy, nie tylko załączniki i plany; jeśli nie — dodać. Inne urządzenia widzą przez kilka sekund puste miejsce, potem odwołanie zmienia się na `H1`.
- **Urządzenie zniszczone przed przetworzeniem:** pozostałe mają odwołanie do obrazu, którego bajty nigdy nie wyszły. Dziś taki stan nie istnieje (zdjęcie jest zmniejszane przed dodaniem). Okno to sekundy; uznane za akceptowalne, ale zapisać w `opis.md`.
- **Historia wersji:** jeśli wersja notatki zapamiętała `H0`, po 7 dniach wskaże obraz, którego nie ma. Sprawdzić, czy zbiór odwołań dla odśmiecania obejmuje wersje; jeśli tak — `H0` żyje, dopóki żyje wersja (zajmuje miejsce); jeśli nie — podmienić odwołanie także w wersjach.
- **Miniatury** (`acquireThumbUrl`) dla oryginału 12 Mpx: liczyć z `H0` w Workerze tym samym przebiegiem, żeby lista nie dekodowała pełnego obrazu.
- Notatki prywatne nie mają plików (ustalone w Z-6) — poza zakresem.

### 3.4 Zlecenie Z-14.5 (Opus, M) — tylko po pomiarze z §3.1

Worker, wyliczany stan i licznik, podmiana odwołań, blokada kart, ograniczenie wysyłki oryginału. Testy: każdy wiersz tabeli z §3.2 (zamknięcie karty symulowane przerwaniem między krokami), odśmiecanie uruchomione w każdym punkcie nie usuwa obrazu z odwołaniem, oryginał nie trafia do `blobs` ani do przekaźnika, dwie karty nie przetwarzają tego samego obrazu dwa razy.

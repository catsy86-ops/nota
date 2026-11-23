# Notatki

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Notatki — zapisane widoki, porównanie wersji, opis na zdjęciu (nowy plan 2026-11-05, Etap 6)

Commit: d09405a1 (2026-11-05), na wip/mobile-fala1.

Plan: `nowyplan.md`, Etap 6 (6.1–6.3; źródła: Notatki 6.2, 5.1, 5.2). W tym samym commicie są poprawki z przeglądu bezpieczeństwa Etapu 5 (opis na końcu sekcji).

### Co robi, gdzie jest i jak działa

- **6.1 Zapisane widoki.**
  - Pasek boczny ma grupę „Widoki” pod Filtrami. Przycisk „Zapisz bieżący widok” (aktywny tylko na liście notatek: Notatki, folder, etykieta) zapisuje pod nazwą:
    - źródło (`ViewSource`: wszystkie, folder albo etykieta);
    - zapytanie wyszukiwarki;
    - układ, sortowanie i grupowanie;
    - filtry koloru, etykiety, przypomnienia i priorytetu.
  - Klik w widok ustawia te preferencje widoku (`setViewPref`) i przechodzi do źródła z zapytaniem (`openSavedView` w `Index.tsx`). Widok z folderem, którego już nie ma, pokazuje komunikat. Wiersz widoku świeci jako aktywny, gdy źródło, zapytanie, układ, sortowanie i grupowanie są takie same jak na ekranie. Zmiana nazwy i usuwanie (z „Cofnij”) są w menu wiersza.
  - Dane: mapa `views` w dokumencie Yjs (`src/lib/savedViews.ts`). Każdy widok to jedna wartość LWW (cały obiekt), synchronizowana między urządzeniami. Limit: 30 widoków, nazwa do 40 znaków. Wpis od peera przechodzi przez `sanitizeView`: nieznany układ, sortowanie czy grupowanie wracają do domyślnych, a wpis bez nazwy jest pomijany. Moduł jest na liście plików z dostępem do Yjs w `eslint.config.js`, jak `yPlans`.
  - Wiersz w pasku to uogólniony `SidebarFilterItem` (`kind="view"`, bez licznika), a przycisk to uogólniony `SidebarAddFolderButton` (`kind="view"`).
- **6.2 Porównanie wersji słowami.**
  - `src/lib/wordDiff.ts`: `diffWords` (LCS na tokenach słowo/odstęp, bez biblioteki; wspólny początek i koniec obcinane przed tablicą). Powyżej 2 mln komórek przechodzi na diff linii, żeby nie zamrozić karty.
  - `paragraphHunks` dzieli treść na akapity (pusta linia), układa wspólne i zmienione bloki. `restoreHunk` składa treść z jednym blokiem wziętym z wersji.
  - `VersionHistoryDialog.tsx`: przy rozwiniętej wersji przełącznik „Treść”, „Zmiany w tekście” i „Obok”:
    - „Zmiany w tekście” pokazuje usunięte słowa przekreślone na czerwonym tle, a dopisane podkreślone na zielonym. Kolor nie jest jedyną wskazówką.
    - „Obok” to bloki „Ta wersja” i „Teraz”, a przy każdej zmianie „Przywróć tylko ten akapit” (`onRestoreContent` z `NoteCardActions.tsx`, z „Cofnij”).
- **6.3 Opis na zdjęciu.** Galeria obrazów notatki w czytniku (`PhotoGalleryDialog`, właściwość `onAnnotate`) ma „Opisz na zdjęciu”. Przycisk otwiera `DrawingCanvas` z obrazem jako tłem. Zapis dodaje opisaną kopię tuż za oryginałem (`saveAnnotate` w `NoteReader.tsx`, `imageStore.putDataUrl`), a oryginał zostaje. Toast ma „Cofnij”. Przycisku nie ma w koszu ani w notatce prywatnej.

### Poprawki z przeglądu bezpieczeństwa Etapu 5 (agent `security-reviewer`)

- Przegląd nie znalazł nic krytycznego, wysokiego ani średniego. Poprawione drobne uwagi:
  - `openAttachment`: przy błędzie odczytu karta `about:blank` się zamyka.
  - Nazwy urządzeń od peera są bez znaków sterujących i formatujących (`cleanDeviceName` w `syncSeen.ts`, także w dymku „Połączono z” w `yjsSync.ts`).
  - `mergeSeen` nie zapisuje ponownie tych samych urządzeń częściej niż raz na minutę (awareness zmienia się często).
  - Limit `templateId` przy odczycie z Yjs jest ujednolicony z kopią (100 znaków).
- Do sprawdzenia ręcznie: czy CSP `object-src 'none'`, dziedziczona przez dokument `blob:`, nie blokuje wbudowanego podglądu PDF w Chromium na wdrożeniu. Polityki nie luzować.

### Ograniczenia i pułapki

- **Widoki są w pełnej kopii JSON** (sekcja `views`, `exportFullBackup` i `restoreFullBackup` w `exportNotes.ts`; scalanie przez `mergeViewsDump`, który waliduje każdy wpis). Przy resecie danych nie są kasowane osobno.
- **Otwarcie widoku zmienia globalne preferencje widoku** (układ, sortowanie, filtry) — tak jak ręczna zmiana w pasku narzędzi. Po wyjściu z widoku zostają.
- **Widoczne kolumny tabeli:** menu „Kolumny” nad tabelą (`NoteTable.tsx`, preferencja `tableHidden` w `viewPrefs.ts`, lista kluczy kolumn). Tytuł i „Zmieniono” nie chowają się. Zapisany widok zapamiętuje ukryte kolumny (`SavedView.tableHidden`). Test: `e2e/board-table.spec.ts`.
- **Dwie zmiany tego samego widoku naraz** (dwa urządzenia): zostaje jedna, cała.
- **Diff akapitów** porównuje całe akapity. Zmiana jednego słowa daje blok „zmieniony”, a przywrócenie bierze cały akapit z wersji.
- **Opisana kopia zdjęcia** to nowy obraz w `imageStore` (więcej miejsca). Usunięcie kopii nie rusza oryginału.

### Testy

- Vitest: `src/lib/wordDiff.test.ts` (składanie tekstu, wstawienia, długie teksty, akapity, przywrócenie jednego bloku), `savedViews.test.ts` (widok z bieżącego stanu, wpis od peera, projekcja mapy), `syncSeen.test.ts` (ograniczenie zapisów, znaki sterujące, `__proto__`).
- e2e: `e2e/etap6.spec.ts` (zmiany w tekście i „Obok” z przywróceniem akapitu, opis na zdjęciu, zapis i otwarcie widoku).

## Edytor CodeMirror 6 — krok 1a, bez podłączenia (plan rozbudowy, Faza 1, 2026-10-23)

### Co robi

- Na razie nic widocznego: komponent edytora Markdown na CodeMirror 6 gotowy do podłączenia za flagą `cmEditor` (Ustawienia → Ogólne → „Funkcje w przygotowaniu”). `NoteEditor` nadal używa zwykłego pola tekstowego.

### Gdzie jest

- `src/components/editor/cmExtensions.ts` — `buildCmExtensions(opts)`: czysta konfiguracja (historia, zaznaczenie, zawijanie, język Markdown, kolory składni, klawisze domyślne, placeholder, `spellcheck`, `aria-label`, motyw z tokenów `--foreground`/`--ring`/`--app-font`, tryb tylko do odczytu, `onChange`).
- `src/components/editor/CmEditor.tsx` — `CmEditor({ value, onChange, … })`: opakowanie o kształcie zwykłego pola.
- Zależności (wersje przypięte, starsze niż 2 tygodnie): `@codemirror/state` 6.7.6, `view` 6.43.13, `commands` 6.11.1, `language` 6.13.1, `lang-markdown` 6.5.2, `autocomplete` 6.20.3, `search` 6.7.2, `@lezer/markdown` 1.8.0.

### Jak działa i dlaczego

- **Widok tworzony raz.** Zmiana `value` z zewnątrz podmienia dokument; zmiana z klawiatury wraca przez `onChange` jako ta sama wartość, więc nie resetuje kursora.
- **Brak `indentWithTab`.** Tab zostaje w przeglądarce, żeby klawiatura nie utknęła w edytorze (dostępność).
- **`onChange` przez `useLatestRef`** — zmiana callbacku nie tworzy widoku od nowa.
- **Paczka.** Nic w aplikacji jeszcze nie importuje edytora, więc paczka startowa go nie zawiera. Podłączenie zrobi go leniwym (`lazy`).

### Ograniczenia i pułapki

- Nie ma jeszcze: podpowiedzi `[[`, menu `/`, `@`, skrótów z `editorKeys.ts`, przycisków formatowania, podglądu na żywo (dekoracje), synchronizacji z Yjs (`y-codemirror.next`). Każdy z tych punktów to osobny krok Fazy 1.
- Zewnętrzna zmiana `value` podmienia cały dokument i resetuje kursor. Dla notatek w Yjs (krok 1b) zastąpi to wiązanie `yCollab`.
- W jsdom CodeMirror zgłasza brak `getClientRects`; to szum testów, nie błąd logiki.

### Testy

- `src/components/editor/cmExtensions.test.ts` — stan i język, `onChange`, tryb tylko do odczytu, atrybuty `spellcheck`/`aria-label`.
- `src/components/editor/CmEditor.test.tsx` — render z wartością, zewnętrzna zmiana wartości.

### Commity

- Nie zacommitowane (2026-10-23): krok 1a, czeka na podłączenie za flagą.

## Notatki — stan aktualny (kafel, edytor, czytnik, kompozytor, lista, wyszukiwanie, właściwości)

Dział opisany w jednym miejscu. Refaktor `Index.tsx` i `NoteCard.tsx` (etapy 4 planu) jest uwzględniony jako struktura kodu, nie jako historia.

### Co robi

- **Kafel notatki** (`NoteCard`): tryb podglądu (okładka, tytuł z ikoną i kłódką, treść albo fragment trafienia, lista zadań, etykiety, przypomnienie, priorytet, załączniki, „Gotowe”/„Jutro” przy zaległym terminie, link zwrotny, podstrony, odliczanie kosza z „Przywróć”, czas czytania) oraz tryb edycji w kaflu. Przypięcie, kolor, przypomnienie, priorytet, archiwizacja i usuwanie są na stopce (mysz) albo w arkuszu „⋯” (dotyk). „Więcej opcji” zawiera resztę: ikona, ulubione, szerokość, większy tekst, blokada, podstrona, obraz, rysunek, etykiety, folder, prywatna, udostępnij, wersje, prezentacja, duplikat, kopiuj jako Markdown (nie dla notatek prywatnych).
- **Edycja w kaflu:** tytuł, treść, lista zadań, autozapis, „Zapisz”, zapis przy zamknięciu, skróty w polu treści (Ctrl+F/H, lista, Tab, Alt+↑/↓), podpowiedzi `[[` i `/`, pasek formatowania, podgląd Markdown.
- **Pełny edytor** (na telefonie każde otwarcie notatki, na komputerze „Pełny ekran”): okno rośnie z kafla, który stuknięto, i przy zamknięciu wraca do niego. U góry pasek koloru notatki; nagłówek dostaje cień po przewinięciu treści.
- **Gesty na dotyku:** przesunięcie w prawo przypina (albo odpina), w lewo archiwizuje (w Archiwum przywraca). Po przypięciu dymek „Przypięto”/„Odpięto” z „Cofnij”. Przytrzymanie 450 ms zaznacza kafel. Kosz nie ma gestu. Przy myszy: przechył 3D, gdy włączony w ustawieniach i bez redukcji ruchu.
- **Efekty:** animacja wyjścia (kosz, archiwum), iskra „klik pinezki” przy przypięciu, pieczątka „gotowe” po odhaczeniu ostatniego zadania. Przy redukcji ruchu bez przechyłu, animacji i iskier.
- **Obrazy kafla:** „Dodaj obrazek” (w „Więcej opcji”), wklejony zrzut do pola treści, rysunek z płótna, usuwanie z „Cofnij”.
- **Czytnik** (`NoteReader`): podgląd i pełny ekran. ←/→ i przyciski „Poprzednia/Następna notatka” przechodzą po widocznej liście (bez notatek prywatnych); ←/→ są ignorowane w polach tekstowych i przy modyfikatorach.
- **Kompozytor nowej notatki** (`AddNoteBar`): zwinięty pasek to kafelek z bursztynowym plusem; rozwinięty ma pole tytułu (`TitleField`, zawija się), treść, rozpoznawanie fraz (`#etykieta`, `@folder`, `!`/`!!`, daty „jutro 9:00”, „za 2h”), „Odłóż” na listę roboczą szkiców, wklejanie HTML jako Markdown.
- **Lista robocza szkiców:** „Odłóż” zapisuje szkic na listę (rząd „Odłożone” nad tytułem); kliknięcie wznawia, „×” usuwa z „Cofnij”. Limit 20, najstarszy odpada. Lokalna dla przeglądarki.
- **Lista (checklista):** każda nieodhaczona pozycja ma „Przesuń w górę/w dół” (wyłączane na krawędzi, na komputerze po najechaniu, na dotyku zawsze). Alt+↑/↓ działa jak dotąd. Przeciąganie pozycji odłożone.
- **Scalanie zaznaczonych notatek:** przycisk „Scal zaznaczone w jedną notatkę” na pasku zbiorczym (tylko lista). Pierwsza notatka dostaje treść pozostałych (pogrubiony tytuł, oddzielone `---`), etykiety, obrazy, załączniki, listy, najwyższy priorytet; termin pierwszej, a gdy go nie ma — najwcześniejszy z pozostałych. Pozostałe idą do kosza. „Cofnij” przywraca wszystko. Odmowa: mniej niż 2 notatki, prywatna, tylko do odczytu, archiwum, kosz, podstrony, otwarty edytor celu.
- **Udostępnianie z innej aplikacji** (Share Target): „Udostępnij → G” tworzy notatkę. Tekst i link do treści (link bez dubla). Obrazy stają się zdjęciami, PDF załącznikiem; inne typy są pomijane z komunikatem. Service worker (`public/sw-share.js`) przyjmuje do 30 plików, każdy do 10 MB, razem do 50 MB. Resztę pomija, a aplikacja mówi o tym w dymku (`skipped` w meta, `SharedInbox.skipped`). **Ochrona przed obcą stroną (Plan-nowy 1.8, 2026-11-03):** (1) POST `/share` z nagłówkiem `Origin` innej domeny SW przekierowuje na `/` i nic nie zapisuje. `Sec-Fetch-Site` nie dochodzi do SW, a `Origin` tak. Przepuszczane są: nasz origin, `null` i brak nagłówka, bo tak wygląda „Udostępnij” z systemu. Zostaje luka: strona z nieprzezroczystym originem (piaskownica, `data:`) też wysyła `null`. (2) GET `/share?title=&text=&url=` (zakładka-clipper, stare instalacje, dowolny link) nie zapisuje od razu. Pokazuje dymek „Zapisać w NOTKACH?” z „Zapisz” i „Pomiń” na 30 s (`useLaunchIntents.ts`). Clipper ma przez to jedno stuknięcie więcej. **Sprzątanie (Plan-nowy 1.10):** każdy wpis w `share-inbox-v1` ma nagłówek `x-at`. Po 10 s od startu `sweepShareInbox` (`src/lib/shareInbox.ts`) kasuje wpisy starsze niż godzina albo bez `x-at`. Testy: `shareInbox.test.ts` („sweepShareInbox”), e2e `share-files.spec.ts` („POST na /share z obcej strony nie zapisuje niczego”, strona `obca.test` z `page.route`), `routes.spec.ts` („Zapisać?” i „Pomiń”), `pwa.spec.ts`.
- **Skróty PWA** (przytrzymanie ikony): Nowa notatka, Wpis z budowy, Wpis głosowy, Grafik, Szukaj, Nowa lista, Dziś, Przypomnienia. Kolejność celowa: Android pokazuje kilka pierwszych.
- **Wyszukiwanie:** trafienia zaznaczone w tytule kafla; przy trafieniu tylko w treści kafel pokazuje fragment z zaznaczeniem. Dopasowanie bez ogonków i wielkości liter („zolw” zaznacza „żółw”). Słowa muszą wystąpić wszystkie (AND), kolejność bez znaczenia; prefiksy i literówki działają („zakup” znajduje „zakupy”). Trafność liczy się z wagami pól: tytuł 4, aliasy 3, etykiety 2, pozycje listy 1,5, treść 1. Pole „Szukaj notatek...” ma stałą etykietę; podpowiedzi operatorów (`etykieta:`, `ma:`, `starsze:`, `pole:`) pokazują się w zdaniu pustego wyniku. Operatory `alias:x` (notatka ma alias), `link:x` (notatka linkuje `[[x]]`) i `zadanie:otwarte` (= `lista:otwarte`) zawężają pulę. `ścieżka:Praca/Budowa` (`path:`, `sciezka:`) dopasowuje folder o dokładnie tej ścieżce od korzenia, bez podfolderów (w odróżnieniu od `folder:`, który je obejmuje); spacje wokół `/` są ignorowane, wartość ze spacją w cudzysłowie. Porównania pól: `pole:Cena>5`, `<`, `>=`, `<=` — liczby numerycznie (przecinek i kropka), daty ISO i tekst leksykalnie po `fold`; notatka bez wartości w polu nie pasuje. **Nagłówki i bloki w palecie poleceń** (`Ctrl+K`): przy wpisanym tekście grupa „Nagłówki i bloki” pokazuje nagłówki (`#`) i bloki z `^id`, które zawierają wszystkie słowa (AND, bez ogonków, bez wielkości liter), z nazwą notatki po prawej. Wybór otwiera notatkę i przewija do sekcji (`requestHeading` z tekstem nagłówka albo `^id`). Grupa respektuje operatory (`etykieta:`, `folder:` itd.), ale nie używa indeksu MiniSearch — to zwykłe dopasowanie linia po linii, limit 20 trafień. Logika w `src/lib/sectionHits.ts` (`sectionHits`), wpis w `src/components/CommandPalette.tsx`. Zablokowane notatki są pomijane. Testy: `src/lib/sectionHits.test.ts` (8).
- **Widok:** trzy ikony po prawej w nagłówku (układ, sortowanie, filtry) na jasnej kartce. W stylu Zeszyt tytuł widoku jest w Fraunces, pasek nagłówka ma tylko cienką kreskę. Liczba notatek przy nagłówku grupy jest pieczątką (obwódka). Kafel ma promień `rounded-card` (16 px); uniesienie przy najechaniu tylko dla myszy.
- **Puste stany:** każdy pusty widok (Notatki, Archiwum, Kosz, Przypomnienia, Kalendarz, Grafik, Dziś, Tydzień, etykieta, folder, Skrzynka) ma nagłówek i zdanie z następnym krokiem. Jeden główny przycisk (N-3, 2026-10-26): w Notatkach „Napisz pierwszą notatkę” (inna nazwa, żeby nie dublować „Nowa notatka” z kompozytora), w pozostałych „Nowa notatka” (`EmptyState.tsx`, `onNew`). Dawniej w Notatkach bez przycisku.
- **Właściwości notatek** (pola własne): tekst, liczba, data, wybór z listy. Okno „Pola notatek” nad tabelą; wartości wpisuje się w komórki tabeli (kolumna na każde pole). Sortowanie po polu (nagłówek kolumny, menu „Sortuj wg”), filtr `pole:Nazwa=wartość`, wiersz „Nazwa: wartość” pod tytułem na telefonie, sekcja „Pola” w czytniku, eksport (Markdown wiersz `*Pole: …*`, ZIP klucz `props`), import z ZIP-a (dopasowanie po nazwie, typ z wartości).
- **Podział widoku w Index:** `Index.tsx` (ok. 960 linii) zostawia stan okien (paleta, ustawienia, statystyki) i widoki.

### Gdzie jest

**Kafel (`NoteCard` i hooki):**
- `src/components/NoteCard.tsx` — otoczka kafla: przechył, `motion.div`, stany okien, `renderEditor(full)`, `useLatch` dla leniwego montowania.
- `src/components/NoteCardBody.tsx` — tryb podglądu (`BACKLINKS_SHOWN`, `subpage`, `trashCountdown`, „Gotowe”/„Jutro”).
- **Data i czas w formularzu nowej notatki.** `AddNoteBar.tsx` pokazuje nad narzędziami „Data i czas: 14 paź 2026, 12:00” (`<time dateTime>`). Wartość `openedAt` ustawia się przy każdym otwarciu formularza (`useEffect` na `expanded`). Zapis nie zmienia `createdAt` — w modelu danych nie ma pola na datę wpisaną ręcznie. Test: `e2e/composer-datetime.spec.ts`.
- **Godzina zawsze przy terminie.** `formatReminderShort` (`src/lib/reminderTime.ts`) pokazuje godzinę także przy „Cały dzień” (stoi na 9:00): „dziś, 09:00”, „jutro, 09:00”, „25 paź, 09:00”. Parametr `allDay` usunięty. Testy: `src/lib/reminderTime.test.ts`; e2e `calendar-phase2`, `entry-check`, `report-nudge`, `site-service`, `card-reminder-edit`.
- **QoL partia 3 (plan z audytu).** Paleta: „Utwórz notatkę „X”” przekazuje wpisany tekst jako tytuł (`CommandPalette.tsx` → `Index.tsx` `expandAddNote(action, prefill)` → `AddNoteBar` `expand`). Test: `e2e/palette-new-note-title.spec.ts`.
- **Skróty do Ustawień i Statystyk:** Ctrl+, i Alt+I (`useGlobalShortcuts.ts`, dialog skrótów). Test: `e2e/shortcuts-settings-stats.spec.ts`.
- **Dziennik budowy, pusty wpis:** komunikat przy polu (`role=alert`, `aria-invalid`, `aria-describedby`), znika przy pisaniu; blokada podwójnego zapisu (`JournalEntrySheet.tsx`). Test: `e2e/journal-empty-entry.spec.ts`.
- **Kompozytor, podwójny zapis** (`commit` w `AddNoteBar.tsx`): dwa Ctrl+Enter oddalone o kilka ms tworzyły dwie notatki (w około połowie przebiegów e2e). Blokada zwalniana `setTimeout(0)` nie wystarczała. Teraz `draftKey` (JSON tytułu, treści, obrazów, załączników, listy, `useMemo`) jest zapamiętywany w `committedRef` po zapisie, a powtórne wywołanie z tą samą migawką jest pomijane. Migawkę kasuje efekt, gdy pojawi się niepusty szkic (pisanie, prefill z palety, wznowienie, dyktowanie), a nie samo `reset` po zapisie. Pusty szkic to stała `EMPTY_DRAFT_KEY` na poziomie modułu. Przy okazji dopisane brakujące zależności `reminderAllDay` i `images`/`attachments`/`checklist` w `commit`. Test: `e2e/composer-double-save.spec.ts` (8/8 powtórzeń po poprawce).
- **Esc w kompozytorze zapisuje i zamyka** (jak Ctrl+Enter i klik poza edytorem); puste szkice nic nie tworzą (`AddNoteBar.tsx`, `handleClose`). Test: `e2e/composer-escape-saves.spec.ts`. Test „podpowiadają” w `composer.spec.ts` bywa niestabilny pod obciążeniem zestawu, przechodzi osobno.
- **Widżet jako osobny skrót PWA:** wpis „Na dziś” (`/widget`) na końcu listy skrótów w `public/manifest.webmanifest` (na końcu, bo Android pokazuje tylko kilka pierwszych). Test: `src/lib/manifest.test.ts`, `e2e/grid-reminder-key.spec.ts`.
- **Klawisz R na kaflu** otwiera okno przypomnienia tego kafla: klika ten sam przycisk dzwonka (`NoteGrid.tsx`, `onOpenReminder`; `gridKeyboardNav.ts`). Test: `e2e/grid-reminder-key.spec.ts`.
- **Nauka: pytania liczbowe z kalkulatorów (Etap 4 § 4.4).** `lib/study/calcQuestions.ts`: trzy pytania liczone tymi samymi funkcjami co kalkulatory (próba 1,5×, spadek 2% na 10 m, pojemność rury 20×2), dołączone do puli quizu w `store.ts` (`studyLists`). Testy: `src/lib/study/calcQuestions.test.ts`; przy zmianie liczby pytań zaktualizowane `customStore.test.ts` i `e2e/study.spec.ts` (runda na temat "Spadki" ma dwa pytania, kolejność losowa).
- **Nauka: rozwiązany problem → własne pytanie (Etap 4 § 4.2).** Przycisk "Zamień w pytanie" przy rozwiązanym problemie z opisem i sposobem naprawy (`JournalItem.tsx`) wysyła zdarzenie `kaczy:study-custom-prefill` (`lib/study/customPrefill.ts`). Jedyny dialog "Moje pytania" w `StudyView.tsx` otwiera się z wypełnionym pytaniem i poprawną odpowiedzią; trzy błędne odpowiedzi trzeba dopisać. Test: `e2e/problem-to-question.spec.ts`.
- **Etap 5, testy (§5.6), dalej.** Dodane testy dla `lib/study/draft.ts` (odporność szkicu na zepsute dane) i `lib/study/sites.ts` (`cleanSite`, katalog budów bez duplikatów): `src/lib/study/draftSites.test.ts`.
- **Etap 5, testy (§5.6).** Dodane testy dla `lib/study/reportLink.ts` (parametr raportu) i `lib/study/siteKey.ts` (klucz budowy niezależny od ogonków). Pozostałe moduły bez testów: `sites`, `draft`, `entrySheet`, `toNote`, `entryCheckStore`, `images`.
- **Nauka: podpowiedź "Umiem" (Etap 4 § 4.1).** Temat z trafnością co najmniej 90% przy co najmniej 10 odpowiedziach (`suggestsDone` w `lib/study/stats.ts`) dostaje na karcie tablicy propozycję "Oznacz jako Umiem". Nie przenosi sam — tylko klik. Testy: `src/lib/study/suggestDone.test.ts`, `e2e/study-board-focus.spec.ts`.
- **Nauka: zapamiętana kolumna tablicy na telefonie (Etap 4 § D4).** Wybór kolumny (`phoneCol` w `StudyBoard.tsx`) zapisuje się w `localStorage` pod `kaczy.study.boardColumn.v1` i wraca po przejściu do innego widoku. Odczyt i zapis chronione przed błędem pamięci.
- **Region aria-live w Grafiku (audyt UI, pkt 9).** Jeden region `role="status"` (`announce`) ogłasza akcje na dniach i zmianę tygodnia lub miesiąca (efekt na `periodLabel` w `ShiftsView.tsx`), niezależnie od przycisku, gestu czy skrótu. Drugi region usunięty. Do potwierdzenia w czytniku ekranu. Test `shifts.spec.ts` "paleta poleceń znajduje dzień" czekał za krótko na zamontowanie aplikacji przed Ctrl+K; poprawione (czeka na przycisk "Zapisz notatkę...").
- **UI, partia 3 (pkt 6 i 7).** Promienie: przyciski i ikony przycisków używają tokenów `rounded-control`, pasek Grafiku `rounded-field`, a przyciski tematów na tablicy `rounded-control` (`ui/button.tsx`, `ui/icon-button.tsx`, `StudyBoard.tsx`, `ShiftsView.tsx`); wartości tokenów są takie same jak klasy Tailwinda, więc wygląd bez zmian. Chipy: wspólne tony w `src/components/ui/chip.ts` (`CHIP_NEUTRAL`, `CHIP_ACCENT`); linki na kafelku używają neutralnego (zamiast `bg-foreground/5`), etap w dzienniku akcentowego. Testy: `e2e/card*.spec.ts`, `e2e/journal-*.spec.ts`, `e2e/shifts-grid.spec.ts`, `e2e/mobile-layout.spec.ts`.
- **UI, partia 4 (wg audytu, pkt 8).** Treść kafla notatki dostaje fokus (`tabIndex`) i otwiera się Enterem lub Spacją przez ten sam klik (`NoteCard.tsx`); widoczny obrys fokusa. Test: `e2e/card-keyboard-open.spec.ts`. Region `aria-live` (pkt 9) nie zmieniony: wymaga sprawdzenia w czytniku ekranu.
- **UI, partia 3 (wg audytu, pkt 5).** Pasek narzędzi Grafiku ma jedną stałą `TOOLBAR_BTN` (`src/components/shifts/shiftControlStyles.ts`, od G3.2 wspólna dla widoku i menu eksportu) zamiast sześciu kopii; wszystkie przyciski mają wysokość h-10 (wcześniej jeden h-9). Testy: `e2e/shifts*.spec.ts`, `e2e/touch-targets.spec.ts`. Chipy kafla (pkt 6) i promienie (pkt 7) czekają na przegląd wizualny.
- **UI, partia 2 (wg audytu).** Wersalikowe nagłówki grup mają jedną klasę `.section-caps` (`index.css`) zamiast czterech przepisów; pola tekstowe mają pełny fokus `ring-ring` zamiast `ring-primary/30`; rozmiary poza skalą (`text-[11px]`, `text-[0.65rem]`, `text-[0.875rem]`) zmapowane na `text-2xs`/`text-sm`. Testy: `e2e/study.spec.ts`, `e2e/touch-targets.spec.ts`, `e2e/mobile-layout.spec.ts`, `e2e/card*.spec.ts`.
- **Dostępność i dotyk (audyt UI, pierwsza partia).** Przyciski tylko z `title` dostały `aria-label` (`LabelPicker`, `PriorityPicker`, `ReminderPicker`; `title` zostaje, bo skrót R na kaflu go używa). Przycisk dodawania etykiety ma 44 px na dotyku. Pola checklisty mają widoczny fokus, a na dotyku min. 16 px (brak zoomu na iOS, `index.css`).
- **Nauka: edycja własnego pytania (Etap 4 § P6).** W "Moje pytania" przycisk "Edytuj" wypełnia formularz; zapis (`updateCustomQuestion`, `yStudy.updateCustom`) podmienia treść pod tym samym id, więc powtórki i błędy zostają. Testy: `e2e/study-custom-edit.spec.ts`, `e2e/study-custom.spec.ts`.
- **Nauka: Ćwicz ze statystyk (Etap 4 § D1).** W oknie statystyk (`StudyStats.tsx`) przycisk "Ćwicz" zamyka okno i otwiera quiz (`StudyView.tsx`, `onPractice`). Wynik quizu ma już "Na dziś" i "Jeszcze raz". Test: `e2e/stats-practice.spec.ts`.
- **Nauka: szkielet przy wczytywaniu (Etap 4 § D3).** Zamiast pustego ekranu przy wczytywaniu Yjs `StudyView` pokazuje dwie karty-szkielety (`StudySkeleton`, `CardSkeleton`). Testy: `e2e/study.spec.ts`, `e2e/study-delivery.spec.ts`.
- **Nauka: podpowiedź "Dodaj własne" przy słabym temacie (Etap 4 § D2).** Karta tematu na tablicy (`StudyBoard.tsx`, `TopicCard`) pokazuje podpowiedź, gdy temat ma co najwyżej dwa pytania (wbudowane z `QUESTIONS` plus własne z `study.custom`), i otwiera dialog "Moje pytania". Testy: `e2e/study-custom.spec.ts`, `e2e/study-board-focus.spec.ts`.
- **Etap 5, podział plików (§5.5), 2/3.** Wiersz przypomnienia (`ReminderRow` i mapa ikon) wydzielony z `StudyJournal.tsx` do `src/components/study/ReminderRow.tsx`. Test `e2e/study-delivery.spec.ts` czeka na sekcję Dziś do 30 s (wolne wczytywanie na obciążonym dysku).
- **Dane Nauki w Yjs (Etap 6 planu, opcje A i B).** Analiza i opcje: `docs/plan-dane-yjs-2026-10-25.md`.
  - *Potwierdzenie przy przywracaniu.* Okno „Przywrócić ten backup?” (`src/components/settings/BackupSettings.tsx`) pokazuje ostrzeżenie, gdy zaznaczona jest „Praca i dziennik z budowy”: zastąpi dane także na sparowanych urządzeniach.
  - *Karta budowy jako mapa pól.* `studySites` przechowuje kartę jako `Y.Map` pól (`src/lib/study/yStudy.ts`, `readCard`, `writeCard(id, card)`). Zapis zmienia tylko pola, które się różnią. Dwa telefony zmieniające różne pola karty nie nadpisują się. Stary zapis (zwykły obiekt) nadal się czyta i przechodzi na mapę przy pierwszym zapisie.
  - *Odhaczenia wpisu jako mapa.* `checked` wpisu dziennika to `Y.Map` `id → true` (`setEntryField`). Kolejność nie ma znaczenia.
  - *Zdjęcia i kształtki jako uporządkowane listy (wersja 2).* `images` i `fittings` wpisu to `Y.Array` (`setOrderedList`): zapis usuwa pozycje, których nie ma, i wstawia brakujące na właściwe miejsca, więc zdjęcia dodane na dwóch telefonach zostają obie, a kolejność się zachowuje. Stare zapisy (zwykła tablica) czyta się bez zmian i zamieniają się na `Y.Array` przy pierwszej zmianie wpisu (migracja leniwa).
  - *Odczyt.* `journalFields` (`src/lib/study/journalFields.ts`) zwraca zwykłe obiekty i tablice, więc `cleanEntry`, raporty, kopie i `journalRefsIn` (odśmiecanie zdjęć) nie wiedzą o `yjs`.
  - *Wersja dumpa.* `StudyDump.version` to teraz `1 | 2`; zapis daje `2`. Kształt kopii się nie zmienił (tablice i mapy jak dotąd), więc kopie wersji 1 wczytują się bez zmian.
  - Testy: `src/lib/study/yStudy.test.ts` (karty budów, odhaczenia, zdjęcia: dwa telefony, kolejność, usuwanie, stary zapis).

- **Etap 4, szukanie na liście kontrolnej (4.5).** Pole „Szukaj na liście kontrolnej” nad modułami w zakładce „Lista kontrolna” (`src/components/study/StudyChecklist.tsx`). Szuka w punkcie, ryzyku i temacie; porównuje przez `fold` z `src/lib/study/siteKey.ts`, więc „szczelnosc” znajduje „szczelność”. Filtr łączy się z „Tylko punkty krytyczne”. Bez trafień pokazuje komunikat ze słowem wyszukiwanym. Licznik postępu nadal liczy wszystkie punkty. Zakres: tylko lista kontrolna; pytań quizu nie przeszukuje. Test: `e2e/study-checklist-search.spec.ts`.
- **Etap 3, nazwy i liczniki (3.5, 3.6).** Nagłówek działu na zakładkach innych niż Dziennik to „Nauka” (było „Nauka: instalacje wod-kan”), w `StudyView.tsx`; Dziennik nie ma własnego nagłówka od planu wyglądu 2026-11-01 (tytuł „Praca” w główce kartki, „Dziennik” w zakładce). Liczniki kolumn tablicy (`StudyBoard.tsx`, `count-*`) są w pełnym kontraście, na tle `bg-background`, zamiast przytłumionych 70 %. Pozostałe punkty Etapu 3 były już w kodzie: pieczątka OTWARTY, pigułki arkusza, kratki quizu, obwódka kratek dni, galeria, `Wpis z budowy`, jedno „Otwarte”. Testy: `e2e/study.spec.ts` (31/31), `src/components/study` (48/48).
- **Etap 5, podział plików (§5.5), 3/3.** Pasek zdjęć wpisu i formularz podpisu wydzielone z `JournalEntrySheet.tsx` do `src/components/study/PhotoStrip.tsx` (propsy: zdjęcia, przetwarzanie, stan podpisu, akcje). Stan wpisu i cofanie usuwania zostają w arkuszu. Testy: `e2e/journal-*.spec.ts`, `e2e/attachments.spec.ts`, `e2e/study.spec.ts`.
- **Etap 5, testy (§5.6), domknięte.** Dodane testy: `lib/study/images.ts` (referencje zdjęć dziennika, także ze starego zapisu), `toNote.ts` i arkusz edycji `entrySheet.ts` (`src/lib/study/toNoteEntrySheet.test.ts`), `entryCheckStore.ts` (wejście, wyjście, zrzut). Testy wymagające Yjs używają `yjsStore.resetForTests()`.
- **Etap 5, podział plików (§5.5), 1/3.** Kartka raportu (`ReportPaper`, `DaysTable`, `ReportPrint`) wydzielona z `JournalReport.tsx` do `src/components/study/ReportPaper.tsx`; okno raportu zostaje z logiką. Testy: `e2e/report-whatsapp.spec.ts`, `e2e/journal-*.spec.ts`.
- **Etap 5, udostępnianie (§5.4).** Wzorzec "udostępnij, a bez tego kopia do schowka" jest w jednym miejscu: `lib/shareOrCopy.ts` (zwraca wynik, komunikaty zostają u wywołującego). Używają go protokół odbioru (`SiteCardDialog.tsx`) i wysyłka raportu do grupy (`JournalReport.tsx`). Test: `src/lib/shareOrCopy.test.ts`. Martwej gałęzi w `ReminderRow` nie ma (łańcuch obejmuje wszystkie rodzaje).
- **Etap 5, sprzątanie (§5.4).** Komunikat o błędzie zapisu zdjęcia (pamięć pełna) jest w jednej funkcji `photoSaveFailed` w `src/components/study/useJournalPhotoEdits.ts` (wyciągniętej z arkusza wpisu w P6.1) zamiast trzech kopii.
- **Nauka: jedna ściąga wysokości (Etap 4 § P7).** Zostawiony arkusz `HeightsSheet.tsx` (przycisk "Wysokości" w nagłówku działu). Usunięty zduplikowany blok `<details>` z `StudyChecklist.tsx`. Test: `e2e/study.spec.ts` (lista kontrolna).
- **Nauka, quiz: objaśnienie pod przyklejonym „Dalej” (Etap 4 § P4).** Na telefonie za objaśnieniem jest przerwa `phone:h-16` (`QuizPanel.tsx`), więc cały tekst da się przewinąć ponad przycisk. Test: `e2e/study.spec.ts` ("Dalej" w quizie, mobile).
- **Nauka, quiz: „Przerwij rundę” (Etap 4 § P3).** Przycisk w `QuizPanel.tsx` wraca do startu rundy; odpowiedzi już zapisane w powtórkach zostają. Test: `e2e/quiz-abort-round.spec.ts`.
- **Etap 3, dokończenie (plan Praca 2026-10-24).** Szukanie w dzienniku obejmuje kształtki i próbę (`lib/study/journalView.ts`, \`filterJournal\`). Oś czasu: każdy rodzaj przypomnienia ma swoją ikonę (\`REMINDER_ICON\` w \`StudyJournal.tsx\`), a świeżo dodany wpis jest podświetlony przy montażu (\`freshEntry\` w \`entrySheet.ts\`, klasa \`journal-fresh\` w \`index.css\`). Miniatury zdjęć mają numer i opis "zdjęcie 1 z 3" (\`JournalItem.tsx\`). Quiz: postęp kratkami (\`QuizPanel.tsx\`), tekst "X z N na dziś", komunikat dla nowego użytkownika. Dni nauki z obwódką (\`StudyStats.tsx\`). "Ćwicz" pierwsze i wyróżnione na karcie tematu (\`StudyBoard.tsx\`). Testy: \`journalView.test.ts\`, \`e2e/journal-fresh-entry.spec.ts\`, \`e2e/study.spec.ts\`, \`e2e/journal-photos.spec.ts\`.
- **Arkusz wpisu pigułkami (Etap 3, § D5).** W `JournalEntrySheet.tsx` zamiast jednego długiego bloku są pigułki "+ Próba", "+ Kształtki", "+ Temat" (ten ostatni pokazuje temat i licznik odhaczonych). Sekcja otwiera się pigułką, a sekcje z danymi (próba, kształtki, temat) są widoczne od razu. Komunikat przy pustym wpisie wymienia nagranie, próbę, kształtki i etap. Pigułki etapu nie dodano (etapy są już w kafelkach "Skończony etap?"). Testy: `e2e/journal-*.spec.ts`, `e2e/study.spec.ts`.
- **Galeria zdjęć z budowy (Etap 3, § D3).** `src/components/study/PhotoGallery.tsx` (`PhotoGalleryDialog`): czarne tło na cały ekran, przesuwanie palcem między zdjęciami (próg 50 px), szczypanie do 4×, przesuwanie powiększonego zdjęcia, dwukrotne stuknięcie = 2,5×, zmiana zdjęcia zeruje powiększenie. Strzałki, licznik i klawiatura zostają. Używa jej `StudyJournal.tsx`. Testy: `e2e/journal-photos.spec.ts`, `e2e/study.spec.ts` (gesty dotykowe nie mają osobnego testu).
- **Logo na telefonie.** `AppHeader.tsx`: animowany monogram „h” (`NMonogramLogo`) jest w nagłówku telefonu w każdym widoku, nie tylko w Notatkach. Pełny napis „hydra” (`NotkiLogo`) zostaje w Notatkach (na telefonie chowa się w innych widokach). Poniżej 360 px monogram w innych widokach się chowa, żeby nagłówek nie wypychał przełącznika widoków poza ekran. Tytuł ma obcinanie (`truncate`). Przy starcie aplikacji za monogramem rozchodzi się jednorazowa poświata (`.logo-intro` i `logo-ring` w `index.css`, tylko poniżej 640 px; przy ograniczonym ruchu wyłączona). Testy: `e2e/mobile-logo.spec.ts`, `e2e/mobile-logo-intro.spec.ts`, `e2e/mobile-layout.spec.ts`.
- **Porządki motywów (audyt).** Usunięte martwe reguły `html:not([data-skin])` (`.section-label`, ziarno `.paper-grid`; nigdy nie działały, wygląd bez zmian) i nieużywany `--season-wash` (`src/index.css`). Tekst i placeholdery z przezroczystością (`/40`, `/50`) zamienione na `text-muted-foreground` w `ChecklistEditor.tsx`, `AddNoteBar.tsx`, `FocusMode.tsx` (kontrast). Do decyzji: czy ziarno papieru ma wrócić w Zeszycie.
- **Akcent sezonów:** wiosna, lato i zima nie nadpisują już `--accent` (długopis w Zeszycie), tylko `--season-accent` i dekoracje (`src/index.css`). Regresja: `src/lib/skinContrast.test.ts`.
- **Widżet „Na dziś” (widok `widget`, adres `/widget`).** `src/components/WidgetPanel.tsx`: terminy na dziś (`TodayDueList`), „Nowa notatka”, „Cały dzień”. Widok nie pokazuje siatki (`useFilteredNotes.ts`, `Index.tsx`). Test: `e2e/widget-panel.spec.ts`.
- **Cofnij (Ctrl+Z) dla zbiorczych zmian.** `useBulkNoteOps.ts`: każdy toast „Cofnij” idzie przez `undoToast`, który dodatkowo zapisuje wpis `kind: "bulk"` w `actionHistory.ts` (tylko w sesji). Ctrl+Z cofa też przypięcie, etykiety, folder, scalanie i priorytet.
- **Zbiorcze ulubione i priorytet** w pasku zaznaczenia (`BulkActionBar.tsx`): `favoriteSelected`, `prioritySelected` z „Cofnij”.
- **Eksport zaznaczonych do HTML i PDF** (`Index.tsx`, `exportSelectedAs`; biblioteki leniwie). Prywatne pomijane.
- **Klawisz F na kaflu** przełącza ulubione (`gridKeyboardNav.ts`, `NoteGrid.tsx`). Test: `e2e/grid-favorite-key.spec.ts`.
- **Licznik ulubionych w pasku bocznym:** „i N więcej w Notatkach” zamiast cichego obcięcia (`AppSidebar.tsx`).
- **QoL: partia 1 (plan z audytu, 2026-10-25).** Parser dat (`src/lib/parseNaturalDate.ts`): „jutro 15” to 15:00 (nie 9:00), „dziś” bez godziny to najbliższa pełna godzina w przyszłości, „za tydzień” działa. Testy: `src/lib/parseNaturalDate.test.ts`.
- **Import przypomnień .ics.** `src/lib/icsImport.ts`: VEVENT z DTSTART (lokalny, UTC `Z`, cały dzień = 9:00), RRULE daily/weekly/monthly jako powtarzanie, pomija terminy w przeszłości i duplikaty. Podpięte w `useImportExport.ts` (`pickFiles`): gdy wybrano same `.ics`, zapis od razu bez podglądu. Test: `src/lib/icsImport.test.ts`, `e2e/ics-import.spec.ts`.
- **Skróty wyszukiwania.** `useGlobalShortcuts.ts`: „/” i Alt+S biorą pierwsze *widoczne* pole (`offsetParent`), a gdy go nie ma, pokazują informację zamiast nic nie robić.
- **Skróty „g” do Skrzynki, Grafiku, Pracy, Długów, Ćwiczeń** (`src/lib/goChord.ts`); lista i dialog zgodne (`ShortcutsDialog.tsx`, Alt+N dopisany, Ctrl+Z opisany uczciwie).
- **Szybkie przypomnienie.** Enter w polu „jutro 15” zapisuje termin od razu, gdy jest poprawny (`ReminderPicker.tsx`, `handleTypedParsed`). Przyciski szybkich terminów nadal tylko wypełniają pola. Test: `e2e/quick-reminder-enter.spec.ts`.
- **Puste stany.** Pusty wynik wyszukiwania ma „Wyczyść wyszukiwanie” (`data-testid=empty-clear-search`); pusty widok poza Notatkami ma „Nowa notatka” (`EmptyState.tsx`). Test: `e2e/empty-states-qol.spec.ts`.
- **Do zrobienia / pytania:** widok `widget` nie ma żadnego ekranu (tylko typy, paleta i adres) — do decyzji: usunąć czy zbudować.
- **Kontrast ostrzeżeń w stylach (plan motywów).** `warning-ink` używa `--warning-ink-base` (domyślnie `--warning`) i `--warning-ink-mix` (domyślnie `--ink-mix`), patrz `tailwind.config.ts`. Miedź: mieszanie 55% (`skins.css`, blok miedz). Plan: baza 38 92% 60% (ciemne ostrzeżenie dawało 4,3:1 na karcie). Test `src/lib/skinContrast.test.ts` sprawdza `warning-ink` na karcie i tle dla każdego stylu (≥4,5:1).
- **Mikrointerakcje.** `AnimatedNumber` (`src/components/ui/animated-number.tsx`) przelicza liczbę zamiast przeskakiwać; licznik „Terminy z Praca” na Dziś ją używa. Wiersze Dziś wchodzą kolejno (`StudyDueRows.tsx`, `motion.li`, opóźnienie 50 ms). Przy `prefers-reduced-motion` bez animacji. Testy: `e2e/study-delivery.spec.ts`, `e2e/today-site-card.spec.ts`.
- **Nazwa i logo: „hydra”.** Wordmark `NotkiLogo.tsx` (litery `h y d r a`, `aria-label="hydra"`), monogram `NMonogramLogo.tsx` (litera „h”, `H_PATH` i `offset-path` w `index.css` muszą być zgodne), pasek boczny (`AppSidebar.tsx`: aria-label, stopka „hydra v1.0”), tytuł karty i `BASE_TITLE` (`src/lib/overdueBadge.ts`), `index.html` (title, og:title, apple-title), `public/manifest.webmanifest`, `package.json` (`name`). Zostawione celowo: klucze localStorage `kaczy.*` i `kaczy-yjs-v1` (zmiana kasowałaby dane), `author="G"`, cytat „✍️ G” w `dailyQuote.ts`, tagline „Notuj, zanim zapomnisz”, Ikony PWA (`public/pwa-*.png`, `apple-touch-icon.png`, `favicon.png`) narysowane od nowa z literą „h” w gradiencie marki (render Playwright, skrypt poza repo). Ręcznie rysowany napis na pustym ekranie (`NotatnikWordmark.tsx`) pisze teraz „hydra” pociągnięciami (`LETTERS`, `UNDERLINE`, pozycja kursora). Zostawione celowo: klucze localStorage `kaczy.*` i `kaczy-yjs-v1` (zmiana kasowałaby dane), `author="G"`, cytat „✍️ G” w `dailyQuote.ts`, tagline „Notuj, zanim zapomnisz”. Testy: `src/hooks/useOverdueBadge.test.ts`, `e2e/brand-hydra.spec.ts`.
- **Edycja terminu z odznaki na karcie.** Odznaka przypomnienia na kaflu (`ReminderBadge` w `ReminderPicker.tsx`, prop `interactive`) jest przyciskiem, który otwiera `ReminderPicker` przez `trigger` — z godziną i pozostałymi polami, bez menu. Klik nie otwiera notatki w edytorze (`stopPropagation`). Tylko przy edytowalnym kaflu (nie w koszu, archiwum, zaszyfrowanej); w innych miejscach zwykły `div`. Test: `e2e/card-reminder-edit.spec.ts`.
- **Godzina w stopce kafla.** Stopka pokazuje datę ostatniej zmiany z godziną (`d MMM, HH:mm`, `updatedAt`). Przypomnienia już pokazują godzinę na odznace (`formatReminderShort`); okna dodawania mają pole „Godzina”. Testy: `src/lib/reminderTime.test.ts`, `e2e/card*.spec.ts`, `e2e/reminder*.spec.ts`, `e2e/composer*.spec.ts`.
- `src/components/NoteCardActions.tsx` — `ActionBtn`, `PrimaryActions` (stopka i arkusz), `MoreActions` (rozwinięcie i arkusz), kopiuj Markdown.
- `src/components/NoteCardDialogs.tsx` — `ActionSheet`, `ImagePreviewDialog`, `DeleteNoteDialog`.
- `src/components/NoteEditor.tsx` — edytor w kaflu i w oknie (`NoteEditSession` z `useNoteEditSession`).
- `src/hooks/useNoteEditSession.ts` — sesja edycji: stan, `handleEditKeyDown`, `handleFormatInsert`, autozapis, `commitDraft`, `begin`.
- `src/hooks/useLiveNoteText.ts` — tekst peera w otwartym polu: zdalna zmiana → `rebaseNoteTextEdit` → wstawienie do szkicu z zachowaniem zaznaczenia.
- `src/hooks/useNoteImages.ts` — `handleImageUpload`, `handleEditPaste`, `addDrawing`, `removeImage` (przez `prepareImage` i `imageStore`; usuwanie zapisuje poprzednią listę dla „Cofnij”).
- `src/hooks/useCardMotion.ts` — przechył, `cardVariants`, `pinFx`, `stampKey`.
- `src/hooks/useCardGestures.ts` — gesty dotykowe (`useDragControls`, `touch-action: pan-y`, próg 110 px albo 60 px przy szybkim ruchu), długie przytrzymanie, przechył myszą.
- `src/hooks/useOriginFromTile.ts` — origin animacji okna z kafla; wspólny z czytnikiem.
- `src/lib/swipeHint.ts` — `showSwipeLabels`, `countSwipe`, klucz `kaczy.swipeHints.v1` (maks. 3 podpisy).
- `src/components/AddNoteBar.tsx` — kompozytor (zwinięty pasek, pole treści, „Odłóż”, `handleContentPaste`).
- `src/components/TitleField.tsx` — pole tytułu jako `textarea` z automatyczną wysokością.

**Index i hooki widoku:**
- `src/hooks/useReaderNav.ts` — czytnik: `previewId`, `readerId`, `readerNote`, `readerSteps`, `closeReader`, `stepReader`, `editFromReader`.
- `src/hooks/useSelection.ts` — `selectedIds`, `selectionMode`, `clearSelection`; zmiana widoku, etykiety lub folderu zdejmuje zaznaczenie.
- `src/hooks/useSelectionGestures.ts` — klik, Shift-zakres, Ctrl/Cmd+A (nie działa przy otwartym oknie, czytniku, prezentacji ani w kalendarzu, grafiku i nauce).
- `src/hooks/useAchievementToasts.ts` — pieczątka odznaki albo paczkowany cichy toast „Nowe odznaki: N” (stałe `id`); „Zobacz” otwiera Statystyki.
- `src/hooks/useLaunchIntents.ts` — raz przy starcie: udostępnianie (`/share`, `?inbox=`), skróty PWA (`?new=1`, `?new=list`, `?szukaj=1`); parametr znika z adresu.
- `src/hooks/useBulkNoteOps.ts` — `restoreSelected`, `pinSelected`, `moveSelectedToFolder`, `labelSelected`, `moveToColumn`, `mergeSelected`.
- `src/hooks/useWikiLinkIndex.ts` — `allNotesForLinks`, `knownTitles`, `wikiIndex` (stabilne przez `useStableByKey` z `src/hooks/useLatestRef.ts`).
- `src/hooks/useNoteActions.ts` — kosz, archiwum, kolor.
- `src/hooks/useFilteredNotes.ts` — typ `View`, `sortNotes`, filtry, `filterNotes`.
- `src/components/TrashConfirmDialogs.tsx` — `DeleteForeverDialog`, `EmptyTrashDialog`.
- `src/components/sidebar/sidebarItems.ts` — pozycje paska bocznego.
- `src/components/BulkActionBar.tsx` — pasek zbiorczy z „Scal”.
- `src/lib/mergeNotes.ts` — `planMerge` (czysta funkcja scalania).
- `src/lib/readerStep.ts` — `readerNeighbors(ids, current)`.
- `src/components/NoteReader.tsx` — czytnik (`onStep`, `canPrev`, `canNext`, sekcja „Pola”, kopiuj Markdown/tekst).
- `src/lib/noteMarkdown.ts` — `copyNoteToClipboard(note, "markdown" | "text")`, eksport Markdown i ZIP.

**Lista, widok, wyszukiwanie:**
- `src/components/ChecklistEditor.tsx` — `canMove(id, dir)`, przyciski przesuwania; przesuwanie przez `moveItem`.
- `src/components/NoteGrid.tsx` — `DENSITY_GAPS` (gęstość w jednej tabeli).
- `src/components/ViewControls.tsx` — grupa trzech ikon w nagłówku.
- `src/components/AppHeader.tsx` — nagłówek (`app-header`, `app-title`).
- `src/components/NoteGroupSection.tsx` — nagłówek grupy, licznik jako `stamp-tag`.
- `src/components/EmptyState.tsx` — `HEADINGS` (krótkie etykiety) i `DESCRIPTIONS` (zdania z następnym krokiem).
- `src/lib/htmlToMarkdown.ts` — `htmlToMarkdown(html)` (DOMParser, wybrane znaczniki).
- `src/lib/quickCapture.ts` — `scanField`, `applyCapture`, `PREPOSITION_BEFORE_RE`.
- `src/lib/parkedDrafts.ts` — `addParked`, `removeParked`, `parkedLabel`, `PARKED_MAX` = 20; klucz `kaczy.drafts.v1`.
- `src/lib/shareInbox.ts`, `src/lib/shareTarget.ts`, `public/sw-share.js` (przechwytuje `POST /share`, cache `share-inbox-v1`), `public/manifest.webmanifest` (`shortcuts`, `share_target`).
- `src/lib/searchHighlight.ts`, `src/lib/searchTerms.ts`, `src/components/SearchMarks.tsx`, `src/components/SearchBar.tsx`, `src/lib/searchQuery.ts` (`fold`, `parseSearchQuery`, `matchesProp`, `matchesPropCompare`, `folderPathOf`, `matchesClauses`; typy `propCompare` i `path`). Podpowiedzi operatorów w `src/lib/searchSuggest.ts` (`OPERATORS`).
- `src/lib/searchNotes.ts` — `searchNotes(notes, query, ctx, source)`, `loadSearchIndex`, `useSearchReady`. Silnik MiniSearch ładowany leniwie (`import("minisearch")`); jeden indeks dla wszystkich notatek, `syncIndex(source)` dokłada i przebudowuje tylko zmienione dokumenty (porównanie z `docs`, dokument cache'owany w `WeakMap` po obiekcie notatki). Pola: `title`, `aliases`, `labels`, `checklist`, `content`; tokenizacja przez `fold`. Notatki zablokowane są z indeksu usuwane. Ograniczenia: indeks działa na wątku głównym (wyszukiwanie jest synchroniczne w kilku miejscach), nie jest zrzucany do IndexedDB — po odświeżeniu budowany jest przy pierwszym wyszukiwaniu. Notatki usunięte na stałe zostają w indeksie do końca sesji, ale wyniki są zawężane do tablicy wywołania, więc się nie pokazują.
- `src/lib/skins.ts` — `data-skin` na `<html>` (domyślnie `zeszyt`).

**Właściwości (pola własne):**
- `src/lib/noteProps.ts` — `PropDef`, `PropType` (`text | number | date | select`), `cleanPropDef(s)`, `cleanNoteProps`, `parsePropInput`, `propDisplayText`, `comparePropsForSort`, `filledPropEntries`, `PROP_LIMITS`.
- `src/lib/yjsStore.ts` — mapa `propDefs` w korzeniu dokumentu; `src/lib/yjs/codec.ts` — pole `props` na notatce, `applyPropsDiff`; `src/lib/yjs/taxonomy.ts` — `upsertPropDef`, `deletePropDef`.
- `src/hooks/useNotes.ts` — `Note.props`, `propDefs`, `addPropDef`, `updatePropDef`, `deletePropDef`.
- `src/components/NoteTable.tsx` — kolumny pól, `PropCell`.
- `src/components/PropDefsDialog.tsx` — okno „Pola notatek” (leniwe).
- `src/lib/sortOptions.ts` — jedna lista opcji sortowania dla menu i arkusza telefonu.
- `src/lib/import/markdown.ts` (`parsePropsFrontmatter`), `src/lib/import/commit.ts` (`inferPropType`, `resolvePropDefs`, `undoImport`).

### Jak działa i dlaczego

- **Stan w kafelku przez hooki, nie props.** Logika kafla jest podzielona na hooki (`useNoteEditSession`, `useCardMotion`, `useCardGestures`, `useNoteImages`), a komponenty (`NoteCardBody`, `NoteCardActions`, `NoteCardDialogs`, `NoteEditor`) dostają wartości przez props. Jedna sesja edycji obsługuje kafel i pełne okno, więc rozwinięcie nie zmienia ścieżki zapisu.
- **Hook sesji trzyma szkic** (`draftRef`, `versionSavedRef`), bo `commitDraft` jest wołane z cleanupu przy odmontowaniu. `begin()` bierze treść z `beginNoteTextEdit`, a nie z `note`, żeby pokazać to, co widzi peer.
- **Obrazy:** skalowanie do 2 MB (`prepareImage`), bajty w `imageStore`, do notatki trafia klucz SHA-256. Obrazy, których nie da się przeskalować, są liczone w jednym komunikacie.
- **Gest startuje ręcznie** (`useDragControls`) poza uchwytem przeciągania należącym do dnd-kit. Kosz bez gestu, żeby przypadkowy ruch nie usuwał. Archiwizacja gestem idzie przez `runWithoutConfirm` — jest odwracalna „Cofnij”.
- **Origin animacji okna** to środek kafla. Element okna trzymany w stanie, nie w `useRef`: treść `Dialog` montuje się w portalu po otwarciu. Bez `layoutId`, bo kolidowałoby z dnd-kit.
- **Czytnik i zaznaczenie** korzystają z widocznej listy (`visibleNotes`), nie z wszystkich notatek; notatka spoza listy nie ma sąsiadów.
- **Share Target** działa w dwóch etapach, bo POST nie ma gdzie wylądować: SW odkłada pliki w cache i przekierowuje na `/share?inbox=<id>`, aplikacja odbiera je po starcie. Meta zapisywana ostatnia — przerwany zapis nie daje notatki bez plików.
- **Scalanie** jest funkcją czystą (`planMerge`), więc odmowa i wynik są testowane bez UI.
- **Właściwości:** definicja w `propDefs` (klucz = id), wartość w `props` notatki (klucz = id definicji). Zmiana nazwy pola nie rusza wartości. Zapis tylko różnic. Walidacja tym samym `clean*` przy odczycie, przywracaniu kopii i wejściu z komórki; zły wpis jest pomijany.
- **Notatka prywatna** nie dostaje właściwości: nie ma ich w szyfrogramie, zapis jest pomijany w `applyPatch`.
- **Lista robocza szkiców** ma osobny klucz, nie rozszerza `kaczy.draft.v1`, więc starsze wersje i przywracanie szkicu działają jak dawniej.

### Ograniczenia i pułapki

- Kafel: przeciąganie kolejności tablicy jest w `useNoteDnd` (nie w kaflu); na telefonie kolumny tablicy są poza ekranem przy 390 px.
- Przechył 3D i `isTouch` liczone przy renderze przez `matchMedia`; zmiana urządzenia w trakcie sesji nie jest wykrywana.
- Edytor: `NoteEditor` czyta `session` przez destrukturyzację — nowe pole sesji trzeba dopisać w tym pliku.
- Dodanie akcji kafla wymaga zmiany w `NoteCardActions.tsx` (w obu miejscach: stopka/arkusz i „Więcej”).
- Wklejanie zrzutu do pola treści nie ma e2e; „Dodaj obrazek” jest w menu „Więcej”, nie na pasku kafla.
- Kompozytor: `htmlToMarkdown` nie obsługuje tabel, zagnieżdżonych list i obrazów; działa tylko w kompozytorze nowej notatki, nie w edytorze.
- Kompozytor: „Spotkanie w piątek” w tytule nie ustawi przypomnienia (przyimek przed datą); „Zadzwonić jutro 9:00” w tytule nadal ustawia.
- Lista robocza i licznik szkiców są lokalne dla przeglądarki; nie synchronizują się.
- Czytnik: notatka otwarta z linku spoza bieżącej listy nie ma sąsiadów — krok nic nie robi.
- Udostępnianie z plikiem wymaga aktywnego SW; po aktualizacji SW pierwsze udostępnienie z plikiem może trafić na 405.
- Do sprawdzenia na telefonie: jaki `Origin` wysyła Chrome na Androidzie przy „Udostępnij” z plikiem. Zakładamy `null` albo brak nagłówka. Gdyby przychodził inny origin, SW odrzuci udostępnienie i trzeba poprawić warunek w `sw-share.js`.
- Wyszukiwanie: na telefonie są dwa pola `input[type=search][aria-label="Szukaj w notatkach"]` (jedno ukryte). Testy muszą brać widoczne (`offsetParent !== null`).
- Właściwości: edycja tylko w tabeli (od `md`) i w czytniku; typ pola jest stały po utworzeniu; usunięcie opcji nie kasuje wartości, które jej używały.
- Właściwości: z `props` w imporcie nie idzie pojedynczy wiersz `*Pole: …*` — tylko frontmatter ZIP-a.
- Scalanie nie przenosi właściwości ani kolorów; wikilinki do scalonych tytułów po wyrzuceniu do kosza przestają wskazywać na żywą notatkę.
- Eager bundle: właściwości podniosły próg; ostatni pomiar 392,4 KB przy progu 393 KB.

### Testy

- Jednostkowe: `src/lib/searchHighlight.test.ts`, `src/lib/readerStep.test.ts`, `src/lib/mergeNotes.test.ts` (14), `src/lib/quickCapture.test.ts` (38), `src/lib/parkedDrafts.test.ts`, `src/lib/htmlToMarkdown.test.ts`, `src/lib/swipeHint.test.ts`, `src/lib/shareInbox.test.ts`, `src/lib/shareTarget.test.ts`, `src/lib/manifest.test.ts`, `src/lib/noteProps.test.ts`, `src/lib/yjsStore.props.test.ts`, `src/lib/noteSchema.props.test.ts`, `src/lib/searchQuery.test.ts` (operatory `pole:` z porównaniem i `ścieżka:`), `src/lib/searchNotes.test.ts` (indeks, operatory `alias:`/`link:`/`zadanie:`, 5000 notatek < 50 ms), `src/lib/import/markdown.test.ts`, `src/lib/import/commit.test.ts`, `src/lib/achievements.test.ts`, `src/lib/achievementStamp.test.ts`, `src/components/EmptyState.copy.test.ts` (12), `src/lib/exportZip.test.ts`.
- E2E (chromium, z zapisanych przebiegów): `notes`, `editing`, `editor-keys`, `editor-open`, `reader`, `reader-step`, `wikilinks`, `live-text`, `live-text-focused`, `checklist`, `checklist-move`, `composer`, `quick-capture`, `paste-html`, `parked-drafts`, `card-images`, `card-motion`, `card-copy`, `merge-notes`, `note-props`, `note-props-view`, `search-highlight`, `search-backup`, `share-files`, `board-table`, `mobile`, `mobile-layout`, `touch-targets`, `editor-open`, `note-groups`, `subpages`, `private-notes`, `read-only-note`, `reminder-toast`, `routes`, `pwa`. Ostatnie pełne przebiegi: 365/365 (2026-10-16), później punktowe; przy zmianach z 2026-10-19/20 e2e nie uruchamiano w całości.

### Commity

- Skróty PWA: `c1a431f` (2026-10-15). Kafel, hooki i gesty (etap 4): `1ccb86d`, `3342c00`, `ff09430`, `bea4f33`, `c513247`, `39231e6`, `6ab66bf`, `2141f60`, `a8ae0a5`, `3596e41`, `c55f50e`, `ad2df94`, `7437879`, `53e7886`, `1ca6108`, `b091505`, `1d1811c` (gesty na telefonie, 2026-10-15).
- Wyszukiwanie: `8f01351` (2026-10-16). Kompozytor i listy: `682f69f`, `4b02b6f`, `86479bf`, `0aa1c77`.
- Właściwości: `a5976a1`, `fd377a5`, `5bb3966`, `f64dd9d` (2026-10-16).
- Scalanie: `5f003ca` (2026-10-18). Kopiuj Markdown: `d0c6eed` (2026-10-18).
- Kompozytor i wygląd (2026-10-19): `6e95430`, `280f294`, `2745eaf`, `d3f446f`, `707e7a0`, `bb48640`, `f5e418c`, `0284db6`.
- Dopracowanie (2026-10-20): `02c1560`.

## Notatki — import: sprawdzanie przed zapisem, porcje, „Cofnij ostatni import” (Z-18.8 audytu 2, 2026-11-17)

- **Co robi:** import z Google Keep / Markdown / ZIP najpierw składa i sprawdza wszystkie notatki, a dopiero potem zapisuje. Uszkodzony wpis (np. tytuł, który nie jest tekstem, albo odrzucenie przez schemat) jest pomijany i liczony — dymek po imporcie mówi „Pominięto uszkodzone notatki: N”. Zapis idzie porcjami po 500 notatek, każda w jednej transakcji, z oddaniem wątku przeglądarce między porcjami. W Ustawieniach → Kopia i dane przez dobę od importu jest sekcja „Ostatni import” z „Cofnij import” (z potwierdzeniem); dymek mówi, że tam jest.
- **Gdzie jest:** `src/lib/import/commit.ts` — `commitImportPlan` (obrazy → składanie w pamięci: `buildNote`, nowe foldery i pola bez zapisu → lista do cofnięcia → porcje `IMPORT_BATCH`), `readLastImport`, `clearLastImport`, `LAST_IMPORT_KEY` (`kaczy.import.last.v1`, lokalnie, poza kopią), `LAST_IMPORT_TTL_MS`, `ImportResult.failed`; `undoImport` przyjmuje też zapis z Ustawień i czyści go. `src/lib/yjsStore.ts` — `importBatch({ notes, folders, labels, propDefs })` w jednej transakcji. `src/components/settings/LastImportUndo.tsx` (w `BackupSettings.tsx`), `src/hooks/useImportExport.ts` (opis dymka).
- **Jak działa i dlaczego:** dawniej każda notatka, etykieta i folder to była osobna transakcja Yjs (tysiące zapisów i aktualizacji synchronizacji), a wyjątek przy notatce N zostawiał N−1 zapisanych bez możliwości cofnięcia. Lista identyfikatorów trafia do `localStorage` **przed** pierwszym zapisem, więc przerwanie (zamknięta karta, błąd) zostawia ją do „Cofnij import” — cofnięcie usuwa tylko to, co istnieje. Import tylko dodaje, więc każdy stan pośredni jest bezpieczny. Pierwsza porcja niesie foldery, etykiety i pola; folder, którego żadna zapisana notatka nie używa, nie powstaje.
- **Ograniczenia:** cofnięcie usuwa notatki z importu także wtedy, gdy je potem zmieniono (mówi o tym potwierdzenie). Zapamiętany jest tylko ostatni import. Bajty obrazów sprząta odśmiecanie magazynu.
- **Testy:** `src/lib/import/commit.batch.test.ts` (notatka nr 300 uszkodzona → 0 wyjątków i `failed`; transakcji nie więcej niż porcji; przerwanie po pierwszej porcji → cofnięcie z Ustawień usuwa dokładnie zapisane; wygaśnięcie po dobie), `src/lib/import/commit.test.ts`; e2e `import-external`, `file-launch`, `settings-links`.

## Limit rozmiaru plików tekstowych przy imporcie (Plan-nowy 1.10, 2026-11-03)

- **Co robi:** plik `.ics`, `.csv` albo `.md` większy niż 5 MB jest odrzucany z komunikatem „Plik „…” jest za duży (limit 5 MB).”. Wcześniej `file.text()` na ogromnym pliku zawieszało kartę.
- **Gdzie:** `src/lib/readTextFile.ts` (`readTextFile`, `MAX_TEXT_IMPORT_BYTES`). Używają go `src/lib/icsImport.ts` (`importIcsFiles`, błąd trafia do okna importu), `src/components/shifts/ShiftsIcsImport.tsx` (dymek) i `src/components/study/CustomQuestionsDialog.tsx` (dymek).
- **Testy:** `src/lib/readTextFile.test.ts`.

## Notatki — czytnik na telefonie: dolny pasek (Fala 4, 2026-10-22)

- **Co robi:** na telefonie (`phone:`) nagłówek czytnika zostaje z tytułem, Pełnym ekranem i Zamknij. Kopiuj, Edytuj, Poprzednia i Następna są w dolnym pasku 44 px (Poprzednia, Kopiuj, Edytuj, Następna). Podpowiedzi klawiszy na telefonie są ukryte.
- **Gdzie:** `src/components/NoteReader.tsx` (nagłówek: klasy `phone:hidden`; pasek: `hidden phone:flex` przed stopką z podpowiedziami).
- **Testy:** `e2e/reader.spec.ts` — "telefon: dolny pasek …" (@mobile, iphone-14). Wysokość mierzona przez `expect.poll`, bo czytnik wchodzi ze skalą 0,94. Regresja reader/reader-step/mobile: 36/36.

## Edytor CodeMirror — podłączenie za flagą `cmEditor` (Faza 1a, 2026-10-23)

- **Co robi:** z włączoną flagą (Ustawienia → „Funkcje w przygotowaniu”) pole treści w edytorze otwartej notatki to CodeMirror 6 zamiast `textarea`. Zapis, autozapis, skróty (Ctrl+B/I/K/Enter/Tab/Alt+↑↓), lista `[[`, menu `/`, `Znajdź i zamień`, licznik i przywracanie zaznaczenia przy zmianie z innego urządzenia działają jak dotąd. Wyłączona flaga = dawny `textarea`, bez zmian.
- **Gdzie:** `src/lib/textControl.ts` (interfejs `TextControl` wspólny dla textarea i CM, `getCaretCoords`, `isTextControlFocused`); `src/components/editor/cmTextControl.ts` (adapter `createCmTextControl(view)`, zmiany przez transakcje, więc Ctrl+Z je cofa); `src/components/editor/CmEditor.tsx` (`textControlRef`, `onSelect`, przechwytywanie klawiszy i schowka w fazie capture); `src/components/NoteEditor.tsx` (`renderEditor`: wybór textarea/CM po fladze, CM leniwie); `src/hooks/useNoteEditSession.ts` (ref `TextControl`, klawisze biorą pole z ref).
- **Jak działa:** `CmEditor` przechwytuje `keydown` i `paste` w fazie capture. Jeśli obsługa wywoła `preventDefault`, zdarzenie zatrzymuje się przed CodeMirrorem (tak jak w textarea, gdzie własny handler wygrywa). Zewnętrzna zmiana `value` jest różnicowa (wspólny prefiks i sufiks), więc karetka zostaje przy tym samym znaku. Zmiany zewnętrzne oznaczone `External` nie wracają jako `onChange`.
- **`applyEdit`:** dla adaptera CM wstawia wynik jedną transakcją `setRangeText`. Ścieżka `execCommand` (natywne Ctrl+Z textarea) zostaje tylko dla prawdziwego `HTMLTextAreaElement`.
- **Ograniczenia i pułapki:**
  - Kompozytor nowej notatki (`AddNoteBar`) nadal jest textarea; flaga dotyczy tylko edycji istniejącej notatki.
  - Pasek boczny i kafel w siatce nie montują CM; CM tworzy się przy edycji.
  - `CmEditor` ma ok. 500 KB (chunk `CmEditor-*.js`), wykluczony z precache w `vite.config.ts` (`globIgnores`), żeby paczka precache mieściła się w progu 3,2 MB. Pierwsze użycie offline wymaga połączenia.
  - Wysokość: w trybie pełnym ekranu bez listy edytor wypełnia okno; autosize (`useNoteEditSession`) działa tylko dla textarea.
  - Nie sprawdzone jeszcze: IME i autokorekta Androida, pasek formatowania na telefonie, zdalna zmiana tekstu (`live-text`) przy włączonej fladze.
- **Testy:** `src/components/editor/cmTextControl.test.ts` (adapter, `setRangeText`, `applyEdit`); `src/components/editor/CmEditor.test.tsx`, `cmExtensions.test.ts`; `e2e/editor-cm.spec.ts` (4 przypadki z flagą: zapis, Ctrl+B/Ctrl+Z, lista, `[[`). Regresja z flagą wyłączoną: `editing`, `editor-keys`, `slash-menu`, `wikilinks`, `mentions`, `live-text` — 25/25. `bundle.spec.ts` 6/6 po wykluczeniu chunka CM z precache.
- **Commit:** `a5e5404` (2026-10-23).

## Edytor CodeMirror — domknięcie Fazy 1a (2026-10-23)

- **Projekt `chromium-cm`** (`playwright.config.ts`): te same testy edytora z zapisaną flagą `cmEditor` (`e2e/fixtures/cm-on.storage.json`). Uruchomienie: `npx playwright test --project=chromium-cm`. Stan 32/32.
- **Wspólny helper** `e2e/helpers/editor.ts`: `editorBody(scope)` znajduje pole treści w obu trybach (textarea albo textbox CM); `readEditorText` czyta tekst (dla CM z linii `.cm-line`, bez placeholdera); `expectEditorText` to asercja z ponawianiem. Testy `checklist`, `editing`, `editor-keys`, `live-text`, `live-text-focused`, `mentions`, `slash-menu`, `wikilinks` używają go zamiast `getByPlaceholder("Treść notatki...")` i `toHaveValue`. Pola inne niż treść (tytuł, pozycje listy) bez zmian.
- **Fokus po Enter w tytule:** CM ładuje się leniwie, więc Enter może przyjść przed montażem. `NoteEditor` zapamiętuje żądanie (`bodyFocusPending`), a `CmEditor` przyjmuje `autoFocus` i ustawia fokus przy montażu. Chunk CM ładuje się też od razu po otwarciu edytora (prefetch w `useEffect`).
- **Regresja bez flagi:** 33/33 (`--project=chromium`, pliki edytora razem z `editor-cm.spec.ts`).
- **Zostaje:** pełna przeglądarka mobilna (iPhone, Pixel) z flagą; IME i autokorekta Androida na prawdziwym telefonie.

## Notatki — edytor wiązany z dokumentem Yjs (Faza 1b, 2026-10-23)

- **Co robi:** z flagą `cmEditor` w edytorze otwartej notatki (nie prywatnej) każda zmiana tekstu trafia od razu do dokumentu Yjs i do IndexedDB. Zdalne zmiany pojawiają się w otwartym edytorze bez scalania szkicu. Ctrl+Z cofa przez historię Yjs (osobno pisanie, osobno formatowanie i podpowiedzi). „Zapisz” nie jest potrzebne, żeby tekst przetrwał przeładowanie.
- **Gdzie:**
  - `src/components/editor/CmEditor.tsx` — prop `yText`: tworzy stan z `Y.Text`, nie synchronizuje `value`, tworzy `Y.UndoManager` na sesję i czyści ref tylko własnego adaptera.
  - `src/components/editor/cmExtensions.ts` — `buildCmExtensions({ yText, yUndoManager })`: `yCollab` (y-codemirror.next 0.3.6, przypięty) i `yUndoManagerKeymap` zamiast `history()`.
  - `src/components/editor/cmTextControl.ts` — `setRangeText` zamyka grupę cofania przed i po operacji (`stopCapturing`).
  - `src/hooks/useNoteEditSession.ts` — `collab`/`collabText`, `writeContent` (wszystkie zapisy treści), `commitDraft` bez treści w trybie wiązania, `savedContentRef` i `openContentRef` (wersja z chwili otwarcia).
  - `src/lib/yjs/textEdit.ts` — `getNoteText(id)`: `Y.Text` notatki, `null` dla zaszyfrowanej.
  - `src/hooks/useNotes.ts` — `getNoteYText`, `newNoteUndoManager`, typy `NoteYText`, `NoteUndoManager` (jedyne miejsce, gdzie wolno importować `yjs` w edytorze).
  - `src/components/NoteEditor.tsx` — `yText` i `key` zależny od trybu; wszystkie zapisy treści przez `writeContent`.
- **Jak działa:**
  - Tryb wiązania włącza się, gdy flaga jest włączona i `getNoteYText` zwraca `Y.Text` (czyli notatka nie jest prywatna). Inaczej działa stara ścieżka szkicu (`beginTextEdit`/`rebaseTextEdit`).
  - `commitDraft` w tym trybie zapisuje tylko tytuł i listę. Wersję historii robi raz na sesję z treścią z chwili otwarcia. Zapis treści ponawia się tylko wtedy, gdy zmieniła się od ostatniego zapisu (`savedContentRef`), żeby autozapis nie podbijał `updatedAt` co 5 s.
  - `writeContent` z adaptera CM (`applyEdit`) albo, gdy CM jeszcze się nie zamontował (chunk ładuje się leniwie), bezpośrednio do `Y.Text` w jednej transakcji — jako jedno wycięcie ze wstawką, nie podmiana całej treści. Zakres liczy `rebaseSplice(prev, next, current)` w `src/lib/yTextEdit.ts`: zmianę `prev → next` przenosi na bieżący tekst dokumentu, więc dopisek z innego urządzenia poza zmienianym zakresem zostaje. Gdy drugie urządzenie zmieniło ten sam zakres, funkcja zwraca `null`: nic się nie zapisuje, treść się odświeża i pojawia się komunikat „Treść zmieniła się na innym urządzeniu. Powtórz zmianę.”. Osobny efekt trzyma `editContent` w zgodzie z `Y.Text` przez cały czas wiązania (wcześniej stan nie nadążał za dokumentem w podglądzie). Dotyczy Znajdź/Zamień i „Zamień na listę” w podglądzie. `writeContent` zwraca `false`, gdy zapis odrzucono — „Zamień na listę” i Ctrl+Shift+L nie ruszają wtedy listy zadań (inaczej linie zostałyby w treści i jednocześnie trafiły na listę). Granice zmienianego zakresu liczy wspólna `changedRange` (także dla `applyTextEdit`) i nie stawia ich w środku pary zastępczej UTF-16: Yjs przy rozcięciu pary zamienia obie połówki na U+FFFD, więc zamiana jednego emoji na inne o tej samej pierwszej połówce psuła znak. Testy: `src/lib/yTextEdit.test.ts`; e2e tej ścieżki jeszcze nie ma — zlecenie Z-4.T w `docs/zlecenia-fable-2026-11-15.md`. Edytor wchodzi potem z aktualnym tekstem.
  - Wybór podpowiedzi `[[`/`@` idzie przez `writeContent` (wcześniej przez szkic — w trybie wiązania tekst nie wchodził do dokumentu).
- **Ograniczenia i pułapki:**
  - `fill` w Playwright (i zastąpienie całej treści) to w CRDT usunięcie i ponowne wstawienie wszystkiego. Współbieżne dopiski drugiego urządzenia zostają przed nowym tekstem. W testach dopisuje się na początku (Ctrl+Home), a nie zastępuje całość.
  - Undo grupuje zmiany w oknie `captureTimeout` (500 ms). Bez `stopCapturing` przy operacjach dyskretnych Ctrl+Z cofał pisanie razem z pogrubieniem.
  - Ref adaptera: po zmianie `key` stara instancja nie może wyzerować nowej (sprawdzane po własnym adapterze).
  - Notatki prywatne (szyfrogram, `locked`) zostają przy ścieżce szkicu, bez `Y.Text`.
  - Każdy `UndoManager` żyje tyle, ile montaż edytora: po zamknięciu edycji historia cofania się zaczyna od nowa (jak w textarea).
  - Test „bez Zapisz” czeka 1,5 s na zapis IndexedDB przed przeładowaniem. To świadome, bo zapis jest asynchroniczny.
- **Testy:**
  - Jednostkowe: `src/components/editor/cmTextControl.test.ts`, `CmEditor.test.tsx`, `cmExtensions.test.ts`.
  - E2E z flagą (`chromium-cm`, 34/34): `e2e/editor-cm.spec.ts` (w tym Ctrl+Z osobno od pisania i zapis bez „Zapisz”), `live-text.spec.ts` (zdalna zmiana, dopisek na początku), `checklist`, `editing`, `editor-keys`, `mentions`, `slash-menu`, `wikilinks`.
  - E2E bez flagi (`chromium`, 41/41), w tym `bundle.spec.ts`.
- **Nie zrobione:** Faza 1b w planie „motywy” (animacje per styl) — osobny krok. Telefon (IME, pasek formatowania) nadal bez przeglądu na urządzeniu.
- **Commit:** `afa048e` (2026-10-23).

## Edytor CodeMirror — podgląd na żywo Markdown (Faza 1c, 2026-10-23)

- **Co robi:** w edytorze CM (flaga `cmEditor`) znaczniki Markdown znikają z linii, na której nie ma kursora: `#` nagłówka (wraz ze spacją), `**`, `*`, `` ` `` w kodzie, `~~`, nawiasy i adres linku `[tekst](adres)`, `>` cytatu. Treść dostaje styl: nagłówki H1–H6, pochylenie, pogrubienie, kod, przekreślenie, link, pionowa kreska cytatu. Kursor albo zaznaczenie na danej linii przywraca znaczniki do edycji.
  Widżety: **pole zadania** `- [ ]`/`- [x]` jest zawsze widoczne jako pole wyboru (klik odhacza w treści notatki); **linia pozioma** `---` poza kursorem jest kreską; **tabela GFM** poza kursorem jest prawdziwą tabelą (nagłówek i wiersze, komórki to zwykły tekst); **obraz** `![alt](adres)` poza kursorem to etykieta „obraz: alt” (nic nie ładuje się z sieci, jak w czytniku); **`[[link]]`** poza kursorem traci nawiasy, a tekst dostaje styl wikilinku (kropkowane podkreślenie). Klik w taki link otwiera notatkę (jak w czytniku); na linii z kursorem klik tylko ustawia kursor, żeby dało się edytować znaczniki.
- **Gdzie:**
  - `src/components/editor/livePreview.ts` — `buildLivePreview(state, from, to)` (czysta funkcja: dekoracje i zbiór ukrytych zakresów), `activeLineNumbers(state)`, `wikiTargetAt(state, pos)` (tytuł linku pod pozycją albo `null`; `null` na linii z kursorem i w kodzie), `livePreview({ onWikiClick })` (rozszerzenie: `ViewPlugin` + `EditorView.atomicRanges` + `baseTheme` z klasami `cm-lp-*` + `domEventHandlers` na `mousedown` dla kliku w link). Widżety: `TaskWidget` (pole zadania, klik przez `view.posAtDOM` zmienia znak w `[ ]`), `RuleWidget` (`<hr>`); stałe `WIKI_LINK`, `CODE_NODES`, funkcja `insideCode`.
  - `src/components/editor/livePreview.ts` (obrazy i tabele): `ImageWidget(alt)` (etykieta obrazu, klik ustawia kursor w `![…]`), `TableWidget(rows)` (`<table>`, klik w tabelę ustawia kursor na jej początku), `tableCells(line)` (dzieli wiersz po `|`, respektuje `\|`), `tableIsRendered(state, node, active)` (tabela jest blokiem tylko, gdy zajmuje całe linie i żadna z nich nie jest aktywna), `buildTables(state)`, `tableField` (StateField z dekoracjami blokowymi i `atomicRanges`).
  - `src/components/editor/cmExtensions.ts` — `livePreview({ onWikiClick })` dodane po `markdown(...)` w `buildCmExtensions`; opcja `onWikiClick` w `CmExtensionOptions`. Parser to `markdown({ base: markdownLanguage, extensions: [GFM] })` z `@lezer/markdown` (już w `package.json`), bo bez GFM tabele nie są rozpoznawane.
  - `src/components/editor/CmEditor.tsx` — prop `onWikiClick` idzie przez `useLatestRef`, więc widok (tworzony raz) zawsze woła aktualną funkcję.
  - `src/components/NoteEditor.tsx` — przekazuje `onWikiClick` do CM (ta sama funkcja co w czytniku: `handleWikiClick` z `pages/Index.tsx`, otwiera notatkę albo pokazuje „nie istnieje”).
  - `src/components/EditorStats.tsx` — poprawka typów (patrz niżej).
- **Jak działa:**
  - Drzewo składni z `@codemirror/lang-markdown` (Lezer). `ensureSyntaxTree` z limitem 200 ms, potem iteracja tylko po `view.viewport`.
  - Linia aktywna = linia każdego zaznaczenia (`activeLineNumbers`). Znacznik ukrywa się, gdy jego linia nie jest aktywna. Ukrycie to `Decoration.replace({})`, więc dokument się nie zmienia, a zapis, Yjs i kopie działają jak dotąd.
  - Przebudowa dekoracji tylko przy zmianie tekstu, widoku albo zestawu aktywnych linii (klucz tekstowy). Ruch kursora w tej samej linii nic nie kosztuje.
  - Ukryte zakresy są „atomowe” (`atomicRanges`): strzałka i Backspace przeskakują przez znacznik, zamiast wchodzić w środek.
  - Dekoracje blokowe (tabela zajmuje kilka linii) nie mogą pochodzić z ViewPlugin, więc tabele liczy StateField `tableField`. Przelicza się przy zmianie tekstu albo zaznaczenia, a parser jest cache'owany. Obraz jest inline i zostaje w pluginie.
  - Nagłówek to dekoracja linii (`Decoration.line`), więc wygląd zostaje, nawet gdy `#` jest ukryte.
  - Pole zadania i linia pozioma to `Decoration.replace({ widget })`, dodane też do zbioru `hidden`, więc są atomowe. Pole zadania nie zależy od kursora. Klik nie zmienia stanu widżetu: wysyła transakcję zmieniającą jeden znak (`[ ]`↔`[x]`), a widżet przerysowuje się z tekstu. Dzięki temu odhaczenie trafia do Yjs i do zapisu jak zwykła edycja.
  - Klik: `mousedown` (nie `click`), żeby kliknięcie w link poza kursorem otwierało notatkę zamiast przesuwać kursor. `wikiTargetAt` sprawdza, czy linia nie jest aktywna, i zwraca `null` w kodzie. Dopiero wtedy `preventDefault` i `onWikiClick(tytuł)`. Tytuł to część przed `#` (jak w `splitWikiTarget`); alias `[[cel|tekst]]` nie jest jeszcze obsługiwany ani w czytniku, ani tu.
  - `[[link]]` nie jest składnią GFM. Skan (`WIKI_LINK`, ten sam kształt co `lib/wikiLinks.ts`) działa na widocznych liniach i pomija fragmenty kodu (`insideCode`). Parser widzi `[[Tytuł]]` jako link `[Tytuł]` z zewnętrznym `[` w tekście, więc `enter` zwraca `false` dla takiego węzła `Link` (pomija dzieci). Bez tego nawiasy byłyby ukrywane podwójnie.
- **Ograniczenia i pułapki:**
  - Tekst w DOM nie jest dokumentem: poza linią kursora `textContent` nie zawiera `**`. Testy czytające `.cm-line` widzą wtedy treść bez znaczników. Źródłem prawdy jest zawsze `state.doc`.
  - `Setext` (podkreślenie `===`/`---`) nie ukrywa podkreślenia, tylko styluje linię tytułu.
  - Przekreślenie `~~` pojawia się tylko, jeśli parser je zwraca. Konfiguracja `markdown({ base: markdownLanguage })` nie włącza GFM; nie sprawdzono, czy `~~` jest wtedy rozpoznawane.
  - Viewport: dekoracje powstają tylko dla widocznego fragmentu. Przy bardzo długiej notatce parser może nie zdążyć w 200 ms; wtedy część stylu pojawia się dopiero po przewinięciu.
  - Komórki tabeli w CM to zwykły tekst: `**` i `[[link]]` w komórce pokazują się dosłownie, choć w czytniku są stylizowane. Tabela z kursorem w dowolnej linii wraca do tekstu.
  - Obraz nie pokazuje podglądu, nawet lokalnego: obrazy notatek są załącznikami poza treścią Markdown, a zdalne adresy celowo się nie ładują (piksel śledzący).
  - Tabele są liczone dla całego dokumentu przy każdej zmianie tekstu i zaznaczenia, więc bardzo długie notatki z wieloma tabelami mogą być wolniejsze niż widok na samą widoczną część. Parser ma limit 200 ms.
  - Z GFM rozpoznawane jest też przekreślenie `~~` (wcześniej nie było pewne, patrz wyżej), a gołe adresy są linkami w składni.
  - KaTeX (wzory) nie ma widżetu; to Faza 6 i wymaga nowej zależności.
  - Klik otwiera notatkę tylko na linii bez kursora. Żeby postawić kursor w środku wyrenderowanego linku, trzeba kliknąć inną część linii albo użyć strzałek. To kompromis.
  - `onWikiClick` jest brany przy montażu widoku: `CmEditor` podpina obsługę tylko wtedy, gdy funkcja istnieje w chwili montażu. Późniejsze dodanie funkcji nie zadziała do ponownego montażu (`key` w `NoteEditor`). Obecnie `Index.tsx` przekazuje stałą funkcję, więc to nie boli.
  - Pole zadania ma 1,1 em (ok. 18 px) i jest opakowane w `span.cm-lp-task-hit` 44 × 44 px (cel dotyku, ujemne marginesy nie przesuwają tekstu). Dotyk na prawdziwym telefonie nadal do sprawdzenia w QA.
  - Pole zadania i linia pozioma są widżetami, więc ich wpisy nie pojawiają się w `textContent`. Testy czytające tekst muszą to uwzględniać (`e2e/helpers/editor.ts` zamienia pole z powrotem na `[ ]`/`[x]`).
  - Zachowanie dla `[[a|b]]` (alias) jest takie samo jak dla zwykłego linku: nawiasy znikają, cały tekst z `|` zostaje widoczny.
- **Naprawy przy okazji (typecheck był czerwony od commitów 1a/1b):**
  - `EditorStats.tsx`: porównania `e.target` i `document.activeElement` z `TextControl` (typy się nie łączyły). Fokus sprawdza `isTextControlFocused`. Dla CM oznacza to, że licznik liczy zaznaczenie także w adapterze CM (wcześniej warunek zawsze kończył wczesnym `return`).
  - `cmExtensions.ts`: `undoManager` idzie do `yCollab` tylko, gdy istnieje, w przeciwnym razie `undefined` (domyślny menedżer biblioteki, jak wcześniej).
- **Testy:**
  - Jednostkowe: `src/components/editor/livePreview.test.ts` (18 testów: ukrywanie `**`/`*`, nagłówek z kursorem i bez, `` ` ``, link, cytat, dokument niezmieniony, klasa nagłówka; widżety: pole zadania zawsze, klik odhacza i cofa w DOM `EditorView`, linia pozioma, `[[link]]` z kursorem i bez, `[[...]]` w kodzie zostaje; `wikiTargetAt`: tytuł pod kliknięciem, `null` na linii z kursorem, poza linkiem i w kodzie). Reszta `cmExtensions.test.ts`.
  - Jednostkowe, dodane: `tableCells` (dzielenie wierszy, `\|`); DOM: tabela renderuje się poza kursorem i wraca do tekstu z kursorem, obraz to etykieta bez `<img>`, a dokument się nie zmienia.
  - E2E z flagą (`--project=chromium-cm`): 37/37, w tym `editor-keys`, `editor-cm` (pole zadania i `[[link]]` poza kursorem; klik w `[[link]]` otwiera notatkę; tabela i obraz w `editor-cm`), `checklist`, `mentions`, `slash-menu`, `wikilinks`.
  - E2E bez flagi: `bundle`, `editing`, `editor-keys`, `live-text`, `checklist` — 27/27.
  - Vitest pełny: 1920 testów; `e2e/bundle.spec.ts` (budżety) 6/6. Typecheck (`tsconfig.app.json`) i lint czyste.
  - Brak e2e w przeglądarce sprawdzającego samo znikanie znaczników; pokrywa to test DOM w jsdom.
- **Nie zrobione (kolejne kroki Fazy 1):** podgląd wzoru (KaTeX, Faza 6); pasek formatowania nad klawiaturą na telefonie, test IME i autokorekty Androida na prawdziwym urządzeniu, przegląd na Pixel 7 / iPhone; QA celu dotyku pola zadania na telefonie (44 px zrobione).
- **Commit:** `b9e2e11` (widżety), `a2c58f0` (klik w `[[link]]`), `075384b` (tabele i obrazy), 2026-10-23.

## Sieć wiedzy — aliasy notatek i `[[cel|tekst]]` (Faza 3.1, 2026-10-23)

- **Co robi:**
  - **Aliasy:** notatka może mieć inne nazwy (np. „łazienka”, „PL”). `[[alias]]` prowadzi do niej tak samo jak do tytułu. Ustawiane w „Więcej opcji” kafla (przycisk „Aliasy”, pole oddzielone przecinkami, Enter zapisuje). Tytuł zawsze wygrywa z aliasem, więc alias nie przesłania istniejącej notatki.
  - **`[[cel|tekst]]`:** cel prowadzi tak jak zwykły link, a w czytniku widać `tekst` zamiast celu.
  - Aliasy są w podpowiedziach `[[` po tytułach, bez duplikatów, i liczą się jako wsteczne linki do notatki.
- **Gdzie jest:**
  - `src/lib/wikiLinks.ts` — `splitWikiTarget` (zwraca `display`), `resolveWikiTarget` (tytuł, potem alias), `buildWikiIndex` (aliasy w `titles`), `backlinksOf` (po tytule i aliasach), `cleanAliases` (przycinanie, duplikaty, limity `ALIAS_MAX_COUNT` = 20, `ALIAS_MAX_LENGTH` = 200).
  - `src/hooks/useNotes.ts` — pole `aliases?: string[]` w `Note` (opcjonalne, starsze notatki go nie mają).
  - `src/lib/noteSchema.ts`, `src/lib/safeProjection.ts` (`REMOTE_LIMITS.aliases`), `src/lib/yjs/codec.ts` — zapis do Yjs (`y.set("aliases")`, tylko niepuste), odczyt w projekcji (pole dołączane tylko gdy niepuste), `aliases` w `NOTE_SCALAR_FIELDS` (patch).
  - `src/components/AliasPicker.tsx` — popover z polem; `src/components/NoteCardActions.tsx` — przycisk w „Więcej opcji”, nie dla zaszyfrowanych i zarchiwizowanych.
  - `src/components/WikiLinkPreview.tsx` — prop `label` (tekst wyświetlany), `src/components/MarkdownRendererImpl.tsx` przekazuje `display`.
- **Ograniczenia:**
  - Podgląd w edytorze CodeMirror (Faza 1c) pokazuje `[[cel|tekst]]` jako `cel|tekst` bez nawiasów; czytnik pokazuje sam tekst. Ujednolicenie w CM to osobny krok.
  - Aliasy nie są jeszcze w eksporcie Markdown/ZIP ani w imporcie (plan Fazy 3.1 wymienia frontmatter); notatka wyeksportowana i zaimportowana gubi aliasy.
  - Pole w menu jest tylko na komputerze i w arkuszu „Więcej opcji”; brak osobnego widoku zarządzania aliasami.
- **Testy:**
  - `src/lib/wikiLinks.test.ts` — split z `|`, aliasy w resolve/indeksie/backlinkach, `cleanAliases` (wraz z dotychczasowymi).
  - `src/lib/yjsStore.test.ts` — aliasy przez zapis, patch i synchronizację, brak pola przy pustej liście.
  - `e2e/note-aliases.spec.ts` — alias z menu, link po aliasie, `[[cel|tekst]]`, klik otwiera cel.
  - Istniejące e2e linków (`note-links`, `wikilinks`, `wiki-heading`) przechodzą.

## Sieć wiedzy — etykiety zagnieżdżone (Faza 3.2, 2026-10-23)

- **Co robi:** etykieta `budowa/łazienka` to etykieta „łazienka” wewnątrz „budowa”. Pasek boczny pokazuje drzewo z wcięciem; klik w rodzica filtruje też jego dzieci; zmiana nazwy rodzica przepina całe poddrzewo (w notatkach i w zbiorze etykiet). Etykieta użyta w notatce zawsze jest w pasku bocznym, nawet gdy nie została dodana osobno (np. z importu).
- **Gdzie jest:**
  - `src/lib/labelTree.ts` — `cleanLabelPath` (przycina segmenty, usuwa puste, limit `LABEL_MAX_DEPTH` = 6), `isUnderLabel`, `noteMatchesLabel` (filtr po rodzicu), `renameLabelBranch`, `buildLabelRows` (spłaszczone drzewo: głębokość, nazwa, czy ma dzieci).
  - `src/lib/yjs/taxonomy.ts` — `renameLabelEverywhere` przepina poddrzewo; `projectLabels` = zbiór etykiet + etykiety używane w notatkach.
  - `src/hooks/useNotes.ts` — `addLabel` i `renameLabel` czyszczą ścieżkę; `src/hooks/useFilteredNotes.ts` — filtr po rodzicu.
  - `src/components/AppSidebar.tsx` (lista z `buildLabelRows`), `src/components/sidebar/SidebarLabelItem.tsx` (prop `displayName`, `depth` → wcięcie 12 px na poziom).
- **Ograniczenia:** brak składni `#budowa/łazienka` w treści (model etykiet to wybór z menu, nie parsowanie tekstu). Zwijania gałęzi w pasku bocznym jeszcze nie ma — drzewo jest zawsze rozwinięte.
- **Testy:** `src/lib/labelTree.test.ts` (9); `src/lib/yjsStore.test.ts` (przepinanie gałęzi); `e2e/label-tree.spec.ts` (wcięcie dziecka, filtr po rodzicu).
- **Commit:** w historii poniżej.

## Sieć wiedzy — osadzanie notatek `![[…]]` (Faza 3.3, 2026-10-23)

- **Co robi:** linia zawierająca tylko `![[Tytuł]]` albo `![[Tytuł#Nagłówek]]` pokazuje treść notatki (albo tylko sekcję od nagłówka do następnego nagłówka tego samego lub wyższego poziomu) w ramce, tylko do odczytu. Zagnieżdżenie idzie dalej, ale najwyżej 3 poziomy. Cykl (A osadza B, B osadza A) kończy się komunikatem. Notatka prywatna, brakujący tytuł lub nagłówek też dają komunikat zamiast treści.
- **Gdzie jest:**
  - `src/lib/embeds.ts` — `extractSection`, `splitEmbedTarget`, `isBlockEmbed` (nagłówek zaczynający się od `^` = blok, patrz 3.4), `MAX_EMBED_DEPTH` = 3, typ `EmbedContext` (poziom + łańcuch odwiedzonych notatek).
  - `src/components/WikiEmbed.tsx` — rozwiązuje cel (`lookupWikiTarget`), sprawdza cykl, głębokość, prywatność; renderuje treść przez `MarkdownRenderer` z `embed` o poziom wyżej.
  - `src/components/MarkdownRendererImpl.tsx` — `MarkdownRendererImpl` wycina linie będące wyłącznie osadzeniem (`EMBED_LINE_RX`) i renderuje je jako `WikiEmbed`; reszta idzie przez `MarkdownBlocks` (dawny renderer bez zmian).
  - `src/components/MarkdownRenderer.tsx` — prop `embed` (wewnętrzny).
- **Dlaczego bloki, a nie znaczniki w tekście:** próbowałem zastąpić `![[…]]` znacznikami Unicode przed parsowaniem, ale Markdown (`![` to początek obrazu) rozbijał tekst tak, że osadzenie znikało. Blok (cała linia) omija parser.
- **Ograniczenia:**
  - Osadzenie w środku zdania (`Zobacz ![[X]] tutaj`) zostaje surowym tekstem; obsługa wymagałaby parsera inline.
  - Edytor CodeMirror nie pokazuje podglądu osadzenia (plan wymienia widżet w CM — do zrobienia osobno).
  - Notatka, która osadza samą siebie, pokazuje się raz więcej niż należy: łańcuch zaczyna się od pustego, bo renderer nie zna id notatki-właściciela.
- **Testy:**
  - `src/lib/embeds.test.ts` (6): sekcje, poziomy, dopasowanie, cele, limit.
  - `e2e/note-embeds.spec.ts` (2): sekcja z nagłówkiem zamiast całej notatki; cykl A ↔ B kończy się komunikatem.
  - Istniejące `MarkdownRenderer*` i e2e linków wiki przechodzą.
- **Commit:** w historii (Sieć wiedzy 3.3, `1852153`).

## Sieć wiedzy — bloki `^id` i `![[…#^id]]` (Faza 3.4, 2026-10-24)

- **Co robi:** na końcu linii (po spacji) można oznaczyć blok znacznikiem `^id`, np. `Pomysł na szafkę ^szafka`. Znacznik nie jest widoczny w czytniku. `![[Notatka#^szafka]]` osadza tylko ten blok, a `[[Notatka#^szafka]]` otwiera notatkę i przewija do akapitu. Podczas pisania `[[Notatka#^` lista podpowiada id bloków tej notatki. Blok bez id nie ma adresu, więc nie da się do niego linkować.
- **Gdzie jest:**
  - `src/lib/blockRefs.ts` — `blockIdOfLine`, `stripBlockId`, `blockIdOfHeading`, `findBlock` (tekst bloku bez znacznika), `listBlockIds` (kolejność, bez duplikatów), `blockRefQuery` (rozbija `Tytuł#^pre`).
  - `src/components/MarkdownRendererImpl.tsx` — `splitParagraphId` chowa znacznik na końcu akapitu i ustawia `data-block-id`.
  - `src/components/MarkdownRenderer.tsx` — `needsMarkdown` zwraca `true` dla linii z `^id`, żeby taka notatka przeszła przez renderer, który go chowa (zwykły tekst by go pokazał).
  - `src/components/WikiEmbed.tsx` — osadzenie `^id` bierze `findBlock`; brak bloku → komunikat „Nie ma bloku ^id”.
  - `src/lib/wikiHeading.ts` — `findBlockElement` i `scrollToHeading` przewijają do `[data-block-id]`, gdy cel zaczyna się od `^`.
  - `src/hooks/useWikiAutocomplete.tsx` — po `#^` podpowiedzi to id bloków z `lookupWikiTarget`, wstawiane jako `[[Tytuł#^id]]`.
- **Jak działa:** blok to grupa linii między pustymi liniami. Punkt listy i nagłówek zaczynają nowy blok, a nagłówek jest zawsze jednolinijkowy, więc `![[…#^id]]` przy liście nie wciąga całej listy. Znacznik jest częścią tekstu w Yjs (nie osobną mapą), więc działa na każdym urządzeniu i w eksporcie bez zmian w modelu danych. Dopasowanie id bez względu na wielkość liter.
- **Dlaczego znacznik w tekście, a nie osobna mapa:** osobna mapa rozjechałaby się przy edycji tekstu (przesunięte akapity). Tekst jest źródłem prawdy, a id wyciągamy z niego przy każdym renderze.
- **Ograniczenia i pułapki:**
  - Brak generatora id: id wpisuje się ręcznie (`^szafka`). Nie ma przycisku „Kopiuj link do bloku”.
  - Linki zwrotne na poziomie bloku (plan 3.4) **nie są zrobione**: panel „Linki zwrotne” pokazuje tylko linki do całej notatki.
  - `^id` w środku linii nie jest znacznikiem (`2^3` zostaje tekstem); id musi być na końcu linii.
  - W edytorze CodeMirror znacznik widać surowo (podgląd bloku w CM to osobna praca, jak przy osadzeniach).
  - Dwa bloki z tym samym id: wygrywa pierwszy w kolejności tekstu.
  - Przewijanie do bloku działa tylko w czytniku (`NoteReader`, ta sama ścieżka co nagłówki `[[…#nagłówek]]`).
- **Testy:**
  - `src/lib/blockRefs.test.ts` (10): znacznik, polskie litery, granice bloków (akapit, lista, nagłówek), brak id, podpowiedzi.
  - `src/lib/embeds.test.ts`: nagłówek `^` to osadzenie bloku.
  - `src/components/MarkdownRenderer.plain.test.tsx`: `needsMarkdown` dla `^id` i dla `2^3`.
  - `e2e/note-block-refs.spec.ts` (2): osadzenie samego akapitu bez znacznika; brak bloku pokazuje komunikat.
- **Commit:** `c197808`, 2026-10-24.

## Sieć wiedzy — lokalny graf w czytniku (Faza 3.5, 2026-10-24)

- **Co robi:** w czytniku (nie w trybie prezentacji, nie w koszu i nie przy notatce prywatnej) jest „Lokalny graf” — od xl w zakładce „Graf” bocznego panelu, poniżej xl jako sekcja pod treścią (`useMediaQuery`, zob. Sieć wiedzy — boczny panel czytnika): notatka otwarta i jej sąsiedzi do dwóch kroków po linkach w obu kierunkach. Notatka otwarta jest w środku i ma pogrubiony obrys. Filtry nad rysunkiem: **Etykieta** (notatki z tą etykietą i z jej dziećmi, np. „praca” łapie „praca/projekt”) i **Folder** (notatki z tego folderu i podfolderów). Filtr dotyczy sąsiadów, nie notatki otwartej, która zawsze zostaje. Klik w węzeł otwiera tę notatkę w czytniku. Bez połączeń albo bez pasujących sąsiadów pokazuje się komunikat zamiast rysunku.
- **Gdzie jest:**
  - `src/lib/noteGraph.ts` — `localGraph(notes, centerId, { depth, label, folderIds }, limit)` (BFS wszerz od środka, sortowanie: najbliżej, potem najwięcej linków, potem tytuł); `collectEdges` wspólne dla grafu lokalnego i globalnego (`buildGraph`).
  - `src/components/NoteGraph.tsx` — prop `centerId` (+ `folders`) przełącza na tryb lokalny; filtry etykiety i folderu (`data-testid="graph-filter-label"`, `graph-filter-folder`). Układ przychodzi asynchronicznie, rysowanie jak wcześniej (rozkładanie z okręgu).
  - `src/components/NoteReader.tsx` — sekcja `[data-local-graph]` z leniwym `NoteGraph` (osobny kawałek bundla); dane z `treeNotes` (żywe i zarchiwizowane), folder z `useNotesContext`. Od 3.6 blok jest w `sideSlot("graph", …)`.
  - `src/workers/graphLayout.ts` — klient: `layoutGraph(nodes, edges, w, h)` wysyła do Workera przez RPC; bez `Worker` (jsdom) albo przy błędzie liczy `forceLayout` w wątku. Bezczynny Worker zamyka się po 30 s.
  - `src/workers/graphLayout.worker.ts` — punkt wejścia Workera (`serveRpc` na `workerScopeTransport(self)`).
  - `src/workers/graphLayoutHandlers.ts` — metoda `layout`; zwraca pary `[id, punkt]`, bo `Map` nie jest potrzebny po drugiej stronie.
  - `src/workers/rpc.ts` — dodany `workerScopeTransport` (transport po stronie Workera) i typ `WorkerScope` (bez typów `WebWorker` w tsconfig).
- **Jak działa i dlaczego:**
  - Sąsiedzi liczą się po krawędziach całej bazy (bez notatek w koszu i prywatnych), więc prywatna notatka nie przecieka do grafu jawnej.
  - Filtr działa na sąsiadach, a nie na środku: inaczej otwarta notatka mogłaby zniknąć z własnego grafu.
  - Układ siłowy idzie do Workera, bo przy setkach węzłów liczy się dziesiątki-setki milisekund w wątku UI. Wynik jest deterministyczny, więc Worker i wątek dają ten sam rysunek (test to sprawdza).
  - Przy zmianie notatek graf przelicza się i układ też (jak wcześniej w globalnym). Poprzednie pozycje zostają na ekranie do czasu nowego układu, więc nie ma migotania.
  - Aliasy (3.1) liczą się też w grafie globalnym: cel linku to tytuł, a dopiero potem alias — tak jak `resolveWikiTarget`.
- **Ograniczenia i pułapki:**
  - Limit `GRAPH_NODE_LIMIT` (150) obowiązuje też lokalnie; przy obcięciu zostają najbliżsi, potem najbardziej połączeni.
  - Brak filtra głębokości w UI — zawsze dwa kroki (`depth` jest w funkcji, nie w interfejsie).
  - Jeśli Worker zawiesi się bez błędu (nie zgłosi `error`), układ nie przyjdzie: transport RPC nie podpina `onerror`. Dotąd nie zaobserwowane; do rozważenia timeout.
  - Filtry nie są zapamiętane między notatkami (stan komponentu, nie `viewPrefs`).
  - Folder w filtrze to `Note.folderId` (foldery), a nie podstrony (`parentId`) — podstrony są w sekcji „Podstrony”.
- **Testy:**
  - `src/lib/localGraph.test.ts` (8): dwa kroki, depth 1, notatka bez połączeń, kosz i prywatne, etykieta z dziećmi, folder z podfolderami, limit, alias.
  - `src/workers/graphLayout.test.ts` (2): metoda Workera równa się `forceLayout`; `layoutGraph` bez Workera daje ten sam wynik.
  - `src/lib/noteGraph.test.ts` (dotychczasowe, bez zmian): globalny graf i układ.
  - `e2e/local-graph.spec.ts` (2): sąsiedzi i filtr etykiety w czytniku; klik w węzeł otwiera notatkę.
  - `e2e/bundle.spec.ts`: budżet wejściowego JS bez zmian (graf jest leniwy).
- **Commit:** `6c05814`, 2026-10-24.

## Sieć wiedzy — boczny panel czytnika (Faza 3.6, 2026-10-24)

- **Co robi:** od szerokości xl (1280 px) czytnik notatki (nie w trybie prezentacji) jest szerszy (`max-w-5xl`) i ma z prawej panel z trzema zakładkami: **Linki** (Linkują tutaj i Niepołączone wzmianki; bez obu — komunikat), **Pola** (pola notatki albo „Ta notatka nie ma pól”), **Graf** (lokalny graf, zob. wyżej). Zakładki to `role="tablist"`, domyślnie „Linki”. Poniżej xl panel znika, a te same sekcje stoją pod treścią jak dotąd.
- **Gdzie jest:**
  - `src/hooks/useMediaQuery.ts` — `useMediaQuery(query)`: `matchMedia` z reakcją na zmianę; bez `matchMedia` (jsdom) zwraca `false`.
  - `src/components/NoteReader.tsx` — `wide` (xl i nie prezentacja), `sideTab`, `sideEl` (kontener panelu), `sideSlot(tab, node)`: w wąskim układzie zwraca węzeł w miejscu, w szerokim — `createPortal` do panelu, jeśli zakładka jest aktywna. Typ `SideTab` i `SIDE_TABS`. Blok `<aside data-reader-side>` z zakładkami; wewnętrzny układ czytnika to teraz `flex` z kolumną treści i panelem.
  - `src/components/NoteGraph.tsx` — prop `compact`: w panelu etykiety 34 jednostki zamiast 15 i krótsze tytuły (rysunek jest skalowany w dół, bez tego były nieczytelne).
- **Jak działa i dlaczego:**
  - Bloki (Linki, Pola, Graf) są napisane raz, w tym samym miejscu JSX. Portal przenosi je do panelu tylko w szerokim układzie, więc nie ma podwójnego DOM-u ani zduplikowanych `data-testid`.
  - Graf jest montowany tylko, gdy jego zakładka jest aktywna — obliczenia układu nie idą bez potrzeby.
  - Prezentacja (`present`) zawsze ma układ bez panelu.
  - Kolejność sekcji pod treścią (wąski ekran) zostaje jak w 3.5.
- **Ograniczenia i pułapki:**
  - Konspekt (spis treści `ReaderToc`) został **w treści**, nie w panelu, jak było w planie 3.6: spis jest zbudowany z DOM-u treści i wymagałby osobnego przeniesienia. Do decyzji.
  - Zakładki zamiast jednej listy: „Linki” łączy dwie sekcje; na wąskim ekranie są one nadal osobno.
  - Szerokość panelu stała (`w-80`, 320 px); na 1280 px treść czytnika ma ~640 px.
  - Klasy `mt-8 pt-4 border-t` z sekcji zostają także w panelu (lekki odstęp u góry zakładki).
  - Zakładka nie zapamiętuje wyboru między notatkami (stan komponentu, nie `viewPrefs`).
- **Testy:**
  - `e2e/reader-side-panel.spec.ts` (2): na 1440 px panel z zakładkami, „Linki” pokazuje linkującą notatkę, „Graf” rysuje 3 węzły; na 900 px panelu nie ma, a linki i graf są pod treścią.
  - `e2e/local-graph.spec.ts` (2): teraz klika zakładkę „Graf” (na desktopie graf jest w panelu).
  - `e2e/note-links.spec.ts`, `e2e/wikilinks.spec.ts`: bez zmian, przechodzą (linki zwrotne i wzmianki na xl są w panelu).
- **Commit:** `40b25bb`, 2026-10-24.

## Sieć wiedzy — podział czytnika: Ctrl+klik otwiera notatkę „Obok” (Faza 3.7, 2026-10-24)

- **Co robi:** na szerokim ekranie (od xl, nie w prezentacji) Ctrl+klik (Cmd na Macu) na `[[link]]` w treści czytanej notatki nie przenosi czytnika, tylko otwiera tę notatkę w zakładce **Obok** bocznego panelu. Czytana notatka zostaje na miejscu, a zakładka przełącza się sama. Zakładka pokazuje tytuł (klik otwiera notatkę w czytniku), treść renderowaną jak w czytniku i przycisk zamknięcia. Zwykły klik nadal przechodzi do notatki.
- **Gdzie jest:**
  - `src/lib/viewPrefs.ts` — pole `readerSplitId: string | null` (stan w viewPrefs, zgodnie z planem); wpis w `VIEW_PREF_LABELS` („panel obok w czytniku”).
  - `src/hooks/useReaderNav.ts` — `splitNote` (notatka z `readerSplitId`, bez prywatnych i bez tej, którą już czytasz) i `setSplit`.
  - `src/pages/Index.tsx` — przekazuje `splitNote` i `onSplit` do `NoteReader`.
  - `src/components/NoteReader.tsx` — `splitClickRef` (ostatni klik miał Ctrl/Cmd; zapisywany przez `onClickCapture` na treści i na panelu), w `handleWiki` gałąź Ctrl+klik, zakładka `split` w `SIDE_TABS`, panel z `data-split-note`.
- **Jak działa i dlaczego:**
  - Podział to panel, nie drugi czytnik. Czytnik jest nakładką z własnym tłem, historią (`useOverlayHistory`) i klawiaturą; dwie nakładki obok siebie wymagałyby przebudowy tego wszystkiego. Panel daje „dwie notatki obok siebie” bez ryzyka dla klawiatury i historii.
  - Ctrl wykrywa się w fazie capture (`onClickCapture`), bo `WikiLink` przekazuje do `onWikiClick` tylko tekst, bez zdarzenia.
  - Stan w viewPrefs przeżywa przeładowanie. Odczyt sprawdza `typeof`, więc uszkodzony zapis to brak notatki, a nie błąd.
- **Ograniczenia i pułapki:**
  - Tylko jedna notatka obok (nie lista kart). Karty (kilka notatek w pasku) to osobny krok, jeśli będzie potrzebny.
  - Na węższym ekranie Ctrl+klik działa jak zwykły klik (brak panelu).
  - Klik w link w panelu „Obok” przenosi czytaną notatkę (nie zmienia panelu) — zwykły klik, bez Ctrl.
  - Konspekt nadal w treści, nie w panelu (jak w 3.6).
- **Testy:**
  - `e2e/reader-side-panel.spec.ts`: Ctrl+klik na `[[Plan]]` przełącza na „Obok”, pokazuje „Cel”, a „Zakupy” zostaje czytana.
  - `src/hooks/useFilteredNotes.test.ts` i `viewPrefs` (typy): dopisane pole `readerSplitId`.
- **Poprawka (2026-10-26):** czytnik w trybie podglądu zamykał się po Ctrl+kliku. Przyczyna: efekt rejestracji sekcji siatki (`NoteGrid.tsx`) zależał od `notes` i callbacków; każda ich zmiana wyrejestrowywała sekcję, a `registerGridNavSection` przy wyrejestrowaniu czyści `previewId`, gdy notatka nie należy do pozostałych sekcji. Teraz handlery są w ref, a sekcja rejestruje się tylko przy zmianie `navOrder` lub listy kafli (`noteIdsKey`); odczyt przez `Proxy`, więc semantyka opcjonalnych handlerów się nie zmienia. Ta sama poprawka dotyczy każdej zmiany `notes` w trakcie podglądu, nie tylko Ctrl+kliku.
- **Dalsza korekta (2026-10-26):** czyszczenie podglądu po odrejestrowaniu sekcji (`gridKeyboardNav.ts`) odbywa się w mikrozadaniu, więc ponowna rejestracja tej samej listy (także przy zmianie listy kafli, nie tylko `notes`) nie zdejmuje podglądu. Test: `gridKeyboardNav.test.ts` (ponowna rejestracja zachowuje podgląd). Handlery w ref aktualizuje `useLayoutEffect`, nie render.
- **Commit:** `47c93fe`, 2026-10-24. Poprawka z 2026-10-26 jest niezacommitowana (do commita po zielonym e2e).

## Sieć wiedzy — notatki tygodnia i miesiąca (Faza 3.8, 2026-10-24)

- **Co robi:** obok notatki dnia są teraz notatka tygodnia (np. „Tydzień 43 · 2026”) i notatka miesiąca („Październik 2026”). Klik w chip w composerze („Notatka tygodnia”, „Notatka miesiąca”) albo pozycja w palecie poleceń otwiera notatkę okresu, a jeśli jej nie ma, tworzy ją z szablonem (cele, co wyszło, wnioski). Jedna notatka na okres: kolejne kliknięcie otwiera tę samą.
- **Gdzie jest:**
  - `src/lib/periodNote.ts` — logika: `isoWeek` (tydzień ISO 8601, poniedziałek na początku), `periodKey(kind, now)` (`YYYY-Www` / `YYYY-MM`), `periodTitle`, `findPeriodNote`, stałe `PERIOD_LABEL` (etykiety „tydzień”, „miesiąc”) i `PERIOD_TEMPLATE`. Typ `PeriodKind = "week" | "month"`.
  - `src/lib/safeProjection.ts` — `safePeriodKey` (walidacja wartości z Yjs).
  - `src/lib/yjs/codec.ts` — pole `periodKey` w `NOTE_SCALAR_FIELDS`, zapis i odczyt.
  - `src/lib/noteSchema.ts` — `periodKey` w schemacie notatki (zod, `catch(undefined)`).
  - `src/hooks/useNotes.ts` — typ `Note.periodKey`; kopia notatki go pomija.
  - `src/lib/privateNotes.ts` — kopia notatki prywatnej też go pomija.
  - `src/pages/Index.tsx` — `openPeriodNote(kind)`, przekazywane do `CommandPalette` i `QuickTemplates`.
  - `src/components/QuickTemplates.tsx` — dwa chipy obok „Notatka dnia”.
  - `src/components/CommandPalette.tsx` — dwie pozycje w grupie „Akcje”.
- **Jak działa i dlaczego:**
  - Notatka okresu rozpoznawana jest po polu `periodKey`, nie po tytule — tak jak notatka dnia po `dailyDate`. Tytuł można zmienić, a wikilinki i tak wskazują po tytule, więc duplikaty tytułów by psuły oba mechanizmy.
  - Osobne pole zamiast rozszerzenia `dailyDate`: nie zmienia się format danych notatki dnia, a starsze wersje aplikacji ignorują nieznane pole (zod `catch`, `safe*` zwracają `undefined`).
  - Klucz tygodnia to rok ISO, nie rok kalendarzowy: 2026-01-01 należy do `2026-W01`, a 2025-12-29 też do `2026-W01`.
  - Liczenie tygodnia idzie na dacie UTC zbudowanej z lokalnych składowych, więc strefa czasowa nie przesuwa dnia.
  - Duplikaty (dwa urządzenia offline) — wygrywa starsza notatka, jak przy notatce dnia.
- **Ograniczenia i pułapki:**
  - Brak szablonów zmiennych (`templateVars`) — szablon jest stały; plan przewidywał ewentualne zmienne, na razie nie są potrzebne.
  - Brak wpisu w „Dziś” i w przypomnieniach. Notatka okresu nie dopisuje znacznika godziny (w przeciwieństwie do dziennej).
  - Kosz się nie liczy (przy ponownym kliknięciu powstaje nowa notatka), Archiwum tak.
  - Stare wersje aplikacji nie pokazują pola `periodKey`, ale nie gubią notatki — pole jest po prostu nieznane.
- **Testy:**
  - `src/lib/periodNote.test.ts` — tydzień ISO na granicy roku (2025-12-29, 2026-12-31 → W53), klucze, tytuły, wybór po kluczu, kosz, duplikaty, `safePeriodKey`.
  - `e2e/period-note.spec.ts` — chip „Notatka tygodnia” tworzy raz i kolejne kliknięcie nie dubluje; „Notatka miesiąca” ma osobny klucz.
  - `e2e/daily-note.spec.ts` i `e2e/bundle.spec.ts` — bez zmian w zachowaniu, zielone.
- **Commit:** `19f3eb3`, 2026-10-24.

## Sieć wiedzy — wyodrębnij zaznaczenie do nowej notatki (Faza 3.9, 2026-10-24)

- **Co robi:** w pasku narzędzi edytora notatki jest przycisk z nożyczkami („Wyodrębnij zaznaczenie do nowej notatki”). Zaznaczony fragment treści trafia do nowej notatki, a w bieżącej w tym samym miejscu zostaje `[[tytuł]]`. Tytuł nowej notatki to pierwsza niepusta linia zaznaczenia (bez znaczników Markdown, do 60 znaków). Jeśli tytuł jest już zajęty przez inną żywą notatkę, dostaje sufiks „(2)”, żeby link nie wskazał na starą notatkę. Bez zaznaczenia pojawia się podpowiedź i nic się nie zmienia.
- **Gdzie jest:**
  - `src/lib/extractNote.ts` — `titleFromSelection`, `uniqueNoteTitle`, `replaceSelectionWithLink`, stałe `EXTRACT_TITLE_MAX` i `EXTRACT_TITLE_FALLBACK`.
  - `src/lib/wikiNoteActions.ts` — `createNoteFromSelection(selected)` tworzy notatkę; `createNoteWithTitle` dostało drugi parametr `content` (domyślnie pusty).
  - `src/hooks/useNoteEditSession.ts` — `handleExtractSelection`: czyta zaznaczenie z `textareaRef`, podmienia treść przez `writeContent`, pokazuje toast i ustawia kursor za linkiem.
  - `src/components/NoteEditor.tsx` — przycisk (ikona `Scissors`) tuż za paskiem formatowania.
- **Jak działa i dlaczego:**
  - Zaznaczenie bierze się z `TextControl` (`selectionStart`/`selectionEnd`), tak jak „Pogrubienie”, więc działa w obu silnikach edytora (textarea i CodeMirror).
  - Kolejność: najpierw powstaje nowa notatka, potem podmiana w bieżącej. Zmiana bieżącej idzie szkicem, więc zapisze ją autozapis, „Zapisz” albo odmontowanie.
  - Nowa notatka idzie przez `yjsStore.upsertNote` tą samą ścieżką co notatka z wikilinka — bez osobnej logiki zapisu.
  - Tytuł musi być unikalny, bo `resolveWikiTarget` bierze pierwszą notatkę o danym tytule. Sprawdzane są tylko żywe notatki, tak jak przy rozwiązywaniu linków (kosz się nie liczy).
  - Znaki `[ ] | #` są usuwane z tytułu, bo złamałyby składnię `[[cel|tekst#nagłówek]]`.
- **Ograniczenia i pułapki:**
  - Brak przycisku „Cofnij” — toast jest informacyjny. Nową notatkę usuwa się ręcznie.
  - Zaznaczenie obejmujące część istniejącego `[[linku]]` nie jest pilnowane; wynik może być zepsutym linkiem, jak przy każdej ręcznej edycji.
  - Nowa notatka nie otwiera się sama — użytkownik zostaje w bieżącej.
  - Przycisk jest zawsze widoczny, także bez zaznaczenia. Nie śledzimy stanu zaznaczenia po każdym ruchu kursora.
  - Tytuł przycinany do granicy słowa przy 60 znakach.
- **Testy:**
  - `src/lib/extractNote.test.ts` — tytuł z Markdown i znaków składni, przycinanie, tytuł zastępczy, unikalność bez względu na wielkość liter, podmiana i rozpoznanie nowego linku.
  - `e2e/extract-note.spec.ts` — zaznaczenie wyodrębnia się, a w bieżącej zapisuje się `[[link]]`; bez zaznaczenia tylko podpowiedź. Spec działa w `chromium` i w `chromium-cm` (dopisany do `testMatch` w `playwright.config.ts`).
- **Commit:** `ec05e34`, 2026-10-24.

## Kompozytor — „Cały dzień” i termin z pustych Terminów (2.5, 2026-10-26)

- **Co robi:** w wyborze terminu paska nowej notatki działa „Cały dzień (o 9:00)” i zapisuje się jako przypomnienie całodzienne (`reminderAllDay`). Przycisk „Nowa notatka” w pustych Terminach otwiera kompozytor z otwartym oknem terminu (akcja `"reminder"` w `ComposerAction`).
- **Gdzie:** `src/components/AddNoteBar.tsx` (stan `reminderAllDay`, `reminderOpenSignal`, `ComposerExtras.reminderAllDay`, akcja `reminder` w `expand` i w efekcie); `src/components/ReminderPicker.tsx` (`openSignal`, otwarcie po zmianie sygnału); `src/pages/Index.tsx` (zapis `reminderAllDay` w `handleComposerAdd`, `onNew` w pustym widoku Terminów).
- **Ograniczenie:** flaga „Cały dzień” nie jest zapisywana w szkicu (`Draft`), więc po przywróceniu szkicu trzeba ją zaznaczyć ponownie.
- **Testy:** `e2e/composer-reminder.spec.ts` (okno terminu po „Nowa notatka”, zapis z „Cały dzień”).

## Notatki — arkusz „⋯” w grupach (plan mobile A4, 2026-10-28)

### Co robi
- Arkusz „⋯” na telefonie (i rozwinięcie „Więcej opcji” na komputerze) grupuje akcje notatki pod nagłówkami: **Wygląd** (ikona i okładka, ulubione, rozciągnięcie, większy tekst), **Porządek** (blokada edycji, podstrona, obrazek, rysunek, etykiety, folder, duplikat), **Udostępnij** (udostępnianie, prezentacja, kopia jako Markdown), **Zaawansowane** (alias, notatka prywatna, historia wersji).
- Pusta grupa (np. w archiwum) nie pokazuje nagłówka.

### Gdzie jest
- `src/components/NoteCardActions.tsx` — `MoreGroup` (nagłówek `h3`, `display: contents`) i `MoreActions`, który zwraca cztery grupy. Elementy nie zmieniły treści, tylko kolejność i opakowanie.
- `src/components/NoteCardDialogs.tsx` — `ActionSheet`: usunięty dawny nagłówek „Więcej”, reszta arkusza bez zmian (Kolor, Szybkie).

### Jak działa i dlaczego
- `contents` wkłada przyciski grupy wprost do rodzica. Dzięki temu ta sama struktura działa w siatce arkusza (`note-sheet-grid`, nagłówek `col-span-full`) i w rzędzie `flex-wrap` na komputerze (nagłówek `w-full`).
- Etykiety przycisków (`title`) zostały bez zmian, więc testy i czytniki ekranu widzą te same nazwy.

### Ograniczenia i pułapki
- Grupy są dla skanowania, nie hierarchią: „Wygląd” zawiera ulubione i obrazek. Nazwy zgodne z planem, przyporządkowanie to decyzja, którą można zmienić przez przestawienie elementu.
- Etykieta „Przypomnienie” w rzędzie Szybkie zawija się w środku słowa („Przypomnieni / e”) na 390 px. To problem sprzed tej zmiany, nie zrobione.

### Testy
- Vitest: grupa „Note” — 221 testów zielonych; jeden test wydajności wyszukiwania (`searchNotes.test.ts`, 50 ms) przegrywa pod obciążeniem, a w izolacji przechodzi.
- `tsc` i eslint czysto.
- Przeglądarka (Pixel 7, poza repo): arkusz pokazuje nagłówki Kolor, Szybkie, Wygląd, Porządek, Udostępnij, Zaawansowane; brak przewijania w bok; brak błędów na stronie.
- E2e nie uruchamiane.

## Graf notatek — telefon: pionowe płótno i przybliżanie (plan mobile D1 + E5, 2026-10-28)

### Co robi
- Na telefonie graf ma pionowe płótno (600×760), węzły i etykiety są czytelniejsze. Przyciski **przybliż / oddal / cały graf** (skala 1–3). Na komputerze bez zmian.

### Gdzie jest
- `src/components/NoteGraph.tsx` — `PHONE` / `DESKTOP` (wymiary płótna), stan `view`, pasek przybliżania (tylko gdy `phone`), `viewBox` z `graphViewBox`.
- `src/lib/noteGraph.ts` — `GraphView`, `zoomView`, `graphViewBox`, `GRAPH_VIEW_RESET`, `GRAPH_MAX_SCALE`.

### Ograniczenia i pułapki
- **Nie zrobione:** szczypanie i przesuwanie widoku palcem oraz arkusz z podglądem węzła (plan D1). Przybliżanie działa przyciskami, a przesuwanie tylko przez zmianę środka widoku (`cx`, `cy`), które jeszcze nie są ustawiane gestem.
- Układ liczy Worker z wymiarami `W`/`H`, więc zmiana z telefonu na komputer przelicza układ.

### Testy
- `src/lib/noteGraph.view.test.ts` (skala, granice płótna, reset).

## Wyszukiwanie na telefonie (A1, plan mobile 2026-10-28)

- **Co robi.** Na telefonie każdy widok ma wejście do wyszukiwania. W widokach bez własnego pola szukania (Grafik, Kalendarz, Nauka, Długi, Ćwiczenia) jest lupa „Szukaj i polecenia” w nagłówku i slot „Szukaj” w dolnym pasku; oba otwierają paletę poleceń. W widokach z polem szukania (Notatki, Dziś, Archiwum itd.) pole jest w treści, a lupy w nagłówku nie ma.
- **Gdzie.** `src/components/AppHeader.tsx` (przycisk lupy, warunek `!viewSearches && onOpenPalette`), `src/components/BottomNav.tsx` (`showPaletteSlot`), `src/lib/viewSearch.ts` (`viewHasSearch`, zbiór `VIEWS_WITHOUT_SEARCH`).
- **Decyzja (2026-10-28).** Lupa zostaje w nagłówku i w dolnym pasku — oba miejsca, bo na telefonie nagłówek bywa daleko od kciuka, a pasek jest pod ręką. Slot w pasku pojawia się tylko tam, gdzie nie ma pola szukania, więc pasek nie puchnie w widokach z polem.
- **Pole szukania na komputerze.** Ten sam `viewSearches` steruje polem `SearchBar` w nagłówku (`hidden sm:block`): pole jest tam, gdzie `viewHasSearch(view)` zwraca `true`. Pułapka: w `c4e3fe3` warunek pola został odwrócony razem z lupą (`!viewSearches`) — pole znikło z Notatek, a pojawiło się w Grafiku i Kalendarzu. Naprawione 2026-10-29; wyłapuje to `e2e/search-backup.spec.ts`.
- **Testy.** `e2e/search-phone.spec.ts` (Grafik na 390 px: lupa i slot otwierają paletę; Notatki: lupy w nagłówku nie ma). 2/2 zielone. `e2e/search-backup.spec.ts` (pole w nagłówku na komputerze).

## Wyszukiwanie notatek w Workerze (Cykl 3, punkt 3.2, 2026-11-12)

- **Co robi:** indeks MiniSearch notatek żyje w Workerze, więc budowa indeksu (ok. 0,5 s przy 5000 notatek na komputerze, kilka razy więcej na telefonie) i zapytania nie blokują pisania. Widoki działają jak dotąd; do czasu odpowiedzi Workera pokazują dokładne trafienia (bez ogonków), potem wynik rozmyty.
- **Gdzie:** `src/lib/noteSearchCore.ts` (wspólny rdzeń: `IndexDoc`, pola, wagi, `tokenize`, `createNoteIndex`), `src/lib/noteSearchEngine.ts` (strona: różnicowa synchronizacja, pamięć podręczna wyników, `lookup`, `subscribe`), `src/workers/noteSearchHandlers.ts` (`noteSync`, `noteSearch`), `src/workers/search.worker.ts` (jeden Worker dla notatek i Pracy), `src/lib/searchNotes.ts` (`searchNotes` bez zmiany sygnatury, `useSearchVersion`, `setNoteSearchEngine` do testów), `src/lib/fold.ts` (`fold` wydzielony, żeby Worker nie ciągnął `searchQuery.ts`).
- **Jak działa:** do Workera idą tylko dokumenty, które zmieniły się od ostatniej wysyłki (dokument liczony raz na obiekt notatki). Wynik zapytania to uszeregowane id w pamięci podręcznej ważnej do następnej zmiany indeksu; `searchNotes` mapuje je na notatki z tablicy wywołania, więc kosz i archiwum nie wypływają w innych widokach. Notatki zablokowane są usuwane z indeksu. Worker zwalniany po 120 s bezczynności wstaje z pustym indeksem — strona poznaje to po znaczniku życia (`epoch`) w odpowiedzi i wysyła wszystko jeszcze raz. Bez Workerów (jsdom) albo po błędzie działa dotychczasowy indeks w głównym wątku. Widoki, które wołają `searchNotes` (lista, pasek boczny, paleta, Kalendarz, szybkie dodawanie, archiwum w Terminach), mają `useSearchVersion` w zależnościach `useMemo`.
- **Ograniczenia:** zysk widać dopiero razem z renderem siatki przy przewijaniu (ADR-7, `docs/PERFORMANCE.md`): najdłuższe zadanie przy 3000 notatkach 0,3–0,7 s zamiast ok. 2 s bez Workera. Do odpowiedzi Workera wynik to poprzednia lista (gdy zapytanie jest jej rozwinięciem lub skróceniem) albo dokładne trafienia; indeks w Workerze nie usuwa notatek, które zniknęły z każdej tablicy (jak dotąd w głównym wątku); zrzut indeksu do IndexedDB nie jest zrobiony (wstawanie Workera po bezczynności buduje indeks od nowa).
- **Testy:** `src/lib/noteSearchEngine.test.ts` (kanał w pamięci: wynik z pamięci podręcznej, edycja, blokada, zawężanie do tablicy, restart Workera, błąd Workera, integracja z `searchNotes`), dotychczasowe `searchNotes.test.ts`, `workSearch.test.ts`.

## Siatka notatek: karty montowane przy przewijaniu (Cykl 3, 2026-11-12)

- **Co robi:** lista notatek pokazuje od razu pierwszą paczkę kart (24), a kolejne (po 48) dorysowuje, gdy przewijanie zbliża się do końca zamontowanej części. Wcześniej reszta dociągała się w tle, aż w DOM były wszystkie karty — przy tysiącach notatek wpisanie zapytania blokowało telefon na kilka sekund.
- **Gdzie:** `src/components/NoteGrid.tsx` (`useRenderedCount`, strażnik `data-grid-sentinel`, `renderUpTo`, `whenRendered`), `src/lib/gridReveal.ts` (`requestNoteRender`, `onNoteRenderRequest`), `src/hooks/useNoteNavigation.ts` (`revealNote` prosi o dorysowanie karty).
- **Jak działa:** pod listą stoi strażnik obserwowany przez `IntersectionObserver` z zapasem 1200 px; po każdej paczce powstaje nowy obserwator, którego pierwsze wywołanie dociąga kolejną paczkę, jeśli strażnik wciąż jest blisko (krótka lista na wysokim ekranie wypełnia się bez przewijania). „Pokaż tę notatkę”, strzałki, Enter i skróty klawiatury proszą siatkę o zamontowanie zakresu do wskazanej karty i czekają na nią do kilkunastu klatek. Przeciąganie i mozaika działają na zamontowanych kartach. Bez `IntersectionObserver` (jsdom, stare przeglądarki) — dociąganie w wolnych chwilach jak dawniej.
- **Ograniczenia:** „Znajdź na stronie” przeglądarki nie widzi kart, do których jeszcze nie przewinięto; przeciągnięcie karty na miejsce poniżej zamontowanej części wymaga najpierw przewinięcia; karty raz zamontowane zostają w DOM (to nie pełna wirtualizacja — przy przewinięciu przez tysiące notatek DOM rośnie jak dawniej).
- **Testy:** `src/components/NoteGrid.test.tsx` (paczki przy strażniku, prośba o dorysowanie, krótka lista bez strażnika); pomiar `scripts/measure-notatki.mjs` w `docs/PERFORMANCE.md`.

## Notatki — podzadania: rodzic odhacza dzieci (plan 2.2, 2026-11-12)

- **Co robi:** odhaczenie pozycji głównej listy odhacza też jej nieukończone podzadania (wcięte pozycje zaraz pod nią); w edytorze dymek „Odhaczono też podzadania: N” z „Cofnij”. Cofnięcie odhaczenia rodzica zostawia podzadania bez zmian. Tak samo na kaflu i w czytniku.
- **Gdzie:** `src/lib/checklistTree.ts` (`childIds`, `toggleChecklistItem`), `ChecklistEditor.tsx`, `NoteCard.tsx` (`handleChecklistToggle`), `Index.tsx` (odhaczanie w czytniku).
- **Ograniczenia:** bez zwijania podzadań i bez przeciągania rodzica razem z dziećmi (reszta punktu 2.2); dymek z „Cofnij” tylko w edytorze.
- **Testy:** `src/lib/checklistTree.test.ts`.

## Notatki — link [[…]] z palety (plan 2.5, część, 2026-11-12)

- **Co robi:** przy otwartej notatce z tytułem paleta poleceń ma w „Ta notatka” pozycję „Kopiuj link [[tytuł]]” — kopiuje link do wklejenia w innej notatce.
- **Gdzie:** `src/lib/noteMarkdown.ts` (`wikiLinkOf`, `copyWikiLink`), `CommandPalette.tsx`.
- **Przenieś i eksportuj:** w „Ta notatka” doszły „Przenieś do folderu…” (drugi ekran palety z listą folderów ze ścieżką „A / B”, „Bez folderu” i „Wróć”; ta sama funkcja co na kaflu, z błyskiem) oraz „Eksportuj jako HTML / PDF / Markdown” (biblioteki ładowane leniwie; bez notatek prywatnych). Stan ekranu: `pickFolder` w `CommandPalette.tsx`, prop `onMoveToFolder` z `Index.tsx`.
- **Ograniczenia:** z punktu 2.5 nadal brak w palecie: historii wersji i wyodrębnienia (działają na sesji edytora i zaznaczeniu, nie na samej notatce); trafienia w nagłówkach i blokach już są jako osobna sekcja (`sectionHits.ts`). Notatki prywatne (zablokowane) nie mają „Kopiuj link” ani eksportu. Bez testu e2e (pełne e2e na końcu).
- **Testy:** `src/lib/noteMarkdown.test.ts`.

## Notatki — pliki przeciągnięte na edytor (plan 2.6, 2026-11-12)

- **Co robi:** obraz albo PDF przeciągnięty na otwartą notatkę trafia do niej — obraz do zdjęć notatki, PDF do załączników — z dymkiem „Dodano plik do notatki”. Wklejony PDF też idzie do załączników (wklejony obraz jak dotąd do zdjęć). Przeciągany tekst działa jak wcześniej.
- **Gdzie:** `src/hooks/useNoteImages.ts` (`handleEditDragOver`, `handleEditDrop`, `addFiles`), `NoteEditor.tsx` (`onDragOverCapture`/`onDropCapture` na całym edytorze, poza notatkami zablokowanymi), `NoteCard.tsx`.
- **Jak działa:** pliki idą przez `importNoteFiles` (ta sama droga co udostępnianie i Skrzynka: zmniejszanie obrazów do 2 MB, limit łączny załączników, komunikaty o odrzuconych). Zdarzenie jest łapane w fazie przechwytywania, zanim CodeMirror wstawiłby zawartość pliku jako tekst.
- **Ograniczenia:** obraz nie jest wstawiany w treść jako `![[…]]` — trafia do galerii zdjęć notatki, jak przy „Dodaj obraz”; brak paska postępu przy dużych plikach.
- **Testy:** `src/hooks/useNoteImages.test.ts`.

## Notatki — zmiana nazwy i scalanie etykiet z „Cofnij” (plan 3.4, 2026-11-12)

- **Co robi:** po zmianie nazwy etykiety w pasku bocznym dymek mówi, ile notatek się zmieniło („Zmieniono #dom na #mieszkanie · 5 notatek”), a gdy nowa nazwa już istnieje — że to scalenie („Scalono #a z #b · 3 notatki”). „Cofnij” przywraca dokładne etykiety każdej zmienionej notatki (także w archiwum i koszu) i dawną gałąź etykiet; nowa etykieta bez notatek znika.
- **Gdzie:** `src/lib/labelTree.ts` (`planLabelRename`), `AppSidebar.tsx` (`renameLabelWithUndo`); sama zmiana jak dotąd w `yjsStore.renameLabelEverywhere`.
- **Ograniczenia:** liczba notatek jest w dymku po zmianie, nie w podglądzie przed nią; notatki prywatne (zablokowane) mogą nie dać się przywrócić przez „Cofnij”.
- **Testy:** `src/lib/labelTree.test.ts`; e2e `label-tree.spec.ts`, `saved-filters.spec.ts`.

## Notatki — podpowiedź duplikatu przy tworzeniu (plan 3.5, 2026-11-12)

- **Co robi:** gdy tytuł nowej notatki w pasku dodawania pokrywa się z tytułem istniejącej (bez ogonków, wielkości liter i interpunkcji), pod polem tytułu pojawia się „Masz już notatkę „X”.” z przyciskiem „Otwórz istniejącą”. Zapis działa dalej normalnie — to tylko podpowiedź.
- **Gdzie:** `src/lib/noteDuplicate.ts` (`titleKey`, `findTitleDuplicate`), `AddNoteBar.tsx` (propsy `findDuplicate`, `onOpenDuplicate`, liczone odroczonym tytułem), `Index.tsx` (notatki aktywne i z archiwum).
- **Ograniczenia:** dopasowanie dokładne po normalizacji, bez literówek (MiniSearch z planu pominięty, żeby nie było fałszywych podpowiedzi); tytuły krótsze niż 3 znaki i kosz się nie liczą.
- **Testy:** `src/lib/noteDuplicate.test.ts`; e2e `notes.spec.ts`, `quick-capture.spec.ts`, `editing.spec.ts` bez zmian.

## Notatki — fragment treści na kaflu gaśnie zamiast urywać się (plan 4.2, 2026-11-12)

- **Co robi:** fragment treści na kaflu (4 linie, na telefonie 3) przy dłuższej notatce kończy się wygaszoną ostatnią linią, jak tekst schodzący pod krawędź kartki, zamiast wielokropka w pół zdania. Treść, która się mieści, zostaje w pełni czytelna.
- **Gdzie:** `src/index.css` (`.tile-fade`, `.tile-fade[data-clipped]`), `src/lib/clipObserver.ts` (`observeClip` — jeden wspólny `ResizeObserver` ustawia `data-clipped`), `NoteCardBody.tsx`.
- **Jak działa:** pole ma wysokość 6em (telefon 4,5em) przy interlinii 1,5; maska `linear-gradient` działa tylko z `data-clipped`, ustawianym, gdy `scrollHeight` > `clientHeight`. Zastępuje `line-clamp`, który przy kilku akapitach Markdownu ucinał w pół linii.
- **Ograniczenia:** atrybut odświeża się przy zmianie rozmiaru pola — gdy treść skróci się z długiej do dokładnie mieszczącej się, ostatnia linia może zostać wygaszona do najbliższej zmiany rozmiaru; bez `ResizeObserver` brak wygaszenia. Obwódka akcentu przy najechaniu (reszta punktu 4.2) — bez zmian.
- **Testy:** sprawdzone zrzutem (komputer 1280 px, telefon 390 px: kafle ucięte gasną, mieszczące się nie); `designTokens.test.ts`.

## Notatki — oś czasu wersji (plan 4.8, 2026-11-12)

- **Co robi:** okno „Historia wersji” pokazuje wersje na pionowej osi (kropka przy każdej, najnowsza w kolorze akcentu) z datą względną („około 2 godziny temu”, pełna data w podpowiedzi) i liczbą słów, które potem dopisano i usunięto („+4 −1 sł.” względem wersji nowszej albo bieżącej treści).
- **Gdzie:** `VersionHistoryDialog.tsx` (`data-testid="version-timeline"`), `src/lib/wordDiff.ts` (`wordChanges` na bazie `diffWords`).
- **Ograniczenia:** bez autora urządzenia — wersje go nie zapisują (wymagałoby zmiany modelu `versionsStore`); bardzo długie teksty liczone diffem linii (jak porównanie wersji), więc liczba słów jest wtedy przybliżona.
- **Testy:** `src/lib/wordDiff.test.ts`; sprawdzone zrzutem okna z trzema wersjami.

## Notatki — płótno w stylu zeszytu (plan 4.4, 2026-11-13)

- **Co robi:** płótno rysowania ma długopis, ołówek, zakreślacz i gumkę, przełącznik „Kratka” oraz jeden przewijany poziomo pasek narzędzi (bez zawijania w kilka rzędów). Rysik reaguje na nacisk, a szybki ruch jest gładszy.
- **Gdzie:** `src/components/DrawingCanvas.tsx` (`paintStrokes`, `paintGrid`, `compose`, `toPoint`, `startDrawing`/`draw`/`stopDrawing`).
- **Jak działa:** zamiast zdarzeń myszy i dotyku są Pointer Events z `setPointerCapture` (kreska nie urywa się na krawędzi) i tylko głównym wskaźnikiem (druga ręka nie zaczyna drugiej kreski). Punkt niesie `p` (nacisk); tylko dla `pointerType === "pen"` długopis rysuje odcinkami o grubości 0,35–1,65 × ustawiona, dla myszy i palca grubość jest stała. `getCoalescedEvents()` dokłada pośrednie próbki. Ołówek to 0,7 × grubość i 75 % krycia, zakreślacz 4 × grubość, 35 % krycia i zakończenie proste; oba rysowane jedną ścieżką, żeby kreska nie ciemniała na przecięciach. Kreska w toku jest też w `liveRef`, więc kilka zdarzeń w klatce nie gubi punktów. Kratka (24 px, jasnoniebieska) jest rysowana w `compose`, także w eksporcie.
- **Ograniczenia:** paleta kolorów nadal stała (8 kolorów, białe tło), bez kolorów z motywu i bez kratki dla ciemnego motywu — rysunek jest zapisywany jako obraz na białym tle. Kratka jest niedostępna przy rysowaniu po zdjęciu. Nazwa narzędzia „Ołówek” dotyczy teraz nowego, cieńszego narzędzia; dawny „Ołówek” nazywa się „Długopis”.
- **Testy:** brak nowych; istniejące e2e płótna to `photo-drawing`, `card-images`, `qol-etap5`, `etap6`, `site-plan-mark` (niepuszczane po tej zmianie).

## Notatki — wzory matematyczne (plan 5.4, 2026-11-13)

- **Co robi:** w notatce `$x^2$` (w linii) i `$$ … $$` (blok) są wyświetlane jako wzory KaTeX w czytniku i na kaflu. Błędny wzór pokazuje się czerwonym źródłem, reszta notatki działa.
- **Gdzie:** `src/lib/mathHint.ts` (`hasMath`), `src/lib/markdownMath.ts` (wtyczki `remark-math` i `rehype-katex` plus arkusz KaTeX), `MarkdownRendererImpl.tsx` (`useMathPlugins`), `MarkdownRenderer.tsx` (`needsMarkdown` zna `hasMath`), `vite.config.ts` (`globIgnores`).
- **Jak działa:** `hasMath` stosuje regułę Pandoc: bez spacji po otwierającym i przed zamykającym `$` i bez cyfry po zamykającym, więc „kosztuje $5 i $10” nie jest wzorem. Dopiero wtedy renderer pobiera dynamicznie moduł z KaTeX (do czasu pobrania wzór jest tekstem). KaTeX nie jest w głównej paczce ani w precache (`markdownMath`, `KaTeX_*` w `globIgnores`); po pierwszym użyciu trafia do `static-assets`. `trust` wyłączone, `throwOnError: false`.
- **Ograniczenia:** offline przed pierwszym użyciem wzór zostaje tekstem. Wzory nie są w edytorze CodeMirror (podgląd tylko w czytniku i na kaflu), nie ma ich w eksporcie HTML/PDF. Notatka z prawdziwym wzorem i ceną w formie `$5 i $10` w jednej linii może zinterpretować cenę jako wzór.
- **Testy:** `src/lib/mathHint.test.ts`, `src/components/MarkdownRenderer.math.test.tsx`; `e2e/bundle.spec.ts` (budżety) przechodzi.

## Notatki — zrzut indeksu wyszukiwania w IndexedDB (plan 3.2, 2026-11-13)

- **Co robi:** wyszukiwanie notatek nie buduje indeksu od zera przy każdym starcie. Worker zapisuje indeks i po starcie go wczytuje, więc przy tysiącach notatek indeksowane są tylko te zmienione.
- **Gdzie:** `src/workers/noteSearchHandlers.ts` (`noteSync` z parametrem `full`, `flushNoteIndexSnapshot`, `INDEX_DB`), `src/lib/noteSearchCore.ts` (`loadNoteIndex`, `docFingerprint`, `INDEX_FORMAT`), `src/lib/noteSearchEngine.ts` (pierwsza wysyłka i wysyłka po restarcie Workera są `full`), `ErrorBoundary.tsx` (twardy reset usuwa też bazę).
- **Jak działa:** osobna baza `kaczy-note-index-v1` (`idb-keyval`, klucz `snapshot`) trzyma `MiniSearch#toJSON` i odciski dokumentów (cyrb53 z pól). Zapis idzie 3 s po ostatniej zmianie. Po starcie Worker wczytuje zrzut, a pierwsza synchronizacja `full` pomija notatki o tym samym odcisku, podmienia zmienione i usuwa te, których strona już nie ma. Do czasu pierwszej synchronizacji `noteSearch` zwraca pustą listę, żeby nie pokazać notatek ze starego zrzutu (np. usuniętych albo zablokowanych w międzyczasie). Zrzut z innym `INDEX_FORMAT` (pola, wagi) albo uszkodzony jest odrzucany.
- **Ograniczenia:** zrzut zawiera tekst notatek jawnych (prywatne są z indeksu usuwane, jak wcześniej) i leży obok danych w IndexedDB. Po zmianie samego `tokenize` trzeba ręcznie podnieść numer w `INDEX_FORMAT`. Zmiany z ostatnich 3 s przed zamknięciem karty nie trafiają do zrzutu, ale następny start je nadrabia po odcisku. Przy `full` notatki spoza pierwszego źródła są dopisywane później, gdy widok ich użyje.
- **Testy:** `src/workers/noteSearchHandlers.test.ts`, `src/lib/noteSearchEngine.test.ts` (restart Workera).

## Notatki — podgląd PDF w czytniku (plan 5.6, 2026-11-13)

- **Co robi:** przy załączniku PDF w czytniku jest „Pokaż podgląd”, który rozwija plik w ramce pod wierszem załącznika („Ukryj podgląd” zwija). Na iPhonie i iPadzie podglądu nie ma — zostaje „Otwórz w nowej karcie”.
- **Gdzie:** `src/components/AttachmentsList.tsx` (`PdfPreview`, użyty w `AttachmentsReadOnlyList`), `netlify.toml` i `vercel.json` (CSP `frame-src 'self' blob:`).
- **Jak działa:** bajty z `readAttachment` trafiają do `Blob` o stałym typie `application/pdf`, a ramka dostaje `URL.createObjectURL`. Adres jest zwalniany przy zwinięciu i zamknięciu czytnika. Typ jest narzucony, więc plik nigdy nie jest renderowany jako HTML. Nie używamy `<object>` ani `<embed>` (`object-src 'none'`).
- **Ograniczenia:** podgląd wymaga wbudowanej przeglądarki PDF (na części telefonów z Androidem ramka pokaże tylko przycisk pobrania — wtedy działa „Otwórz”). Tylko w czytniku, nie w edytorze i na kaflu. Nie ma podglądu pliku, którego nie ma jeszcze na tym urządzeniu (pokazuje błąd wczytania).
- **Testy:** `e2e/attachments.spec.ts`, `src/lib/securityHeaders.test.ts`.

## Notatki — kolorowanie bloków kodu (plan 5.3, 2026-11-13)

- **Co robi:** bloki kodu z językiem (` ```ts `, ` ```json `, ` ```sql ` …) mają kolory składni w czytniku, na kaflu i w edytorze. Obsługiwane: JavaScript, JSX, TypeScript, TSX, JSON, CSS, HTML, XML/SVG, SQL, Python, YAML (z aliasami jak `js`, `py`, `yml`). Blok bez języka albo z nieznanym zostaje zwykłym tekstem.
- **Gdzie:** `src/lib/codeLanguages.ts` (lista `CODE_LANGUAGES`), `src/lib/codeHighlight.ts` (`highlightCode`, `knownCodeLanguage`), `src/components/HighlightedCode.tsx`, `MarkdownRendererImpl.tsx` (komponent `code`), `src/components/editor/cmExtensions.ts` (`codeLanguages`), `src/index.css` (klasy `.code-hl .tok-*`), `vite.config.ts` (grupa `codelang`).
- **Jak działa:** jedna lista języków dla edytora i czytnika. Czytnik używa tej samej gramatyki Lezer przez `highlightTree` z `classHighlighter`, więc nie ma drugiej biblioteki. Każdy język to osobny `import()`, pobierany przy pierwszym bloku. Gramatyki są w grupie `codelang` poza precache (`globIgnores`), a komponent ładuje je dynamicznie, więc nie wchodzą do startu. Do czasu pobrania blok jest zwykłym tekstem w tym samym `<pre>`. Kolory to tokeny motywu (`accent`, `success`, `warning`) zmieszane z kolorem tekstu.
- **Ograniczenia:** zamiast pełnego `@codemirror/language-data` jest krótka lista 11 języków (powód: budżet precache 4,3 MiB, który jest prawie wyczerpany — 4,28 MiB). Bloki powyżej 20 000 znaków nie są kolorowane. Offline przed pierwszym użyciem danego języka blok jest zwykłym tekstem. Kontrast kolorów nie był sprawdzany axe osobno dla bloków kodu.
- **Testy:** `src/lib/codeHighlight.test.ts`, `e2e/code-highlight.spec.ts`, `e2e/bundle.spec.ts` (budżety).

## Notatki — nowe typy pól (plan 6.1, 2026-11-13)

- **Co robi:** własne pola notatek (Pola w tabeli i czytniku) mają pięć nowych typów: **Tak/nie** (pole wyboru), **Odnośnik** (klikalny adres), **Wiele wyborów** (kilka opcji z listy, menu z polami zaznaczenia) oraz **Utworzono** i **Zmieniono** (tylko do odczytu, z dat notatki). Wszystkie działają w sortowaniu kolumn i w wyszukiwarce (`pole:Zapłacone`, `pole:Tagi=praca`, `pole:Utworzono>2026-01-01`).
- **Gdzie:** `src/lib/noteProps.ts` (`PROP_TYPES`, `coerce`, `parsePropInput`, `cleanPropDef`, `isReadOnlyPropType`, `hasPropOptions`, `NoteTimes`), `src/components/NoteTable.tsx` (`PropCell`), `src/components/PropDefsDialog.tsx`, `src/lib/searchQuery.ts` (`matchesProp`, `matchesPropCompare`), `src/lib/import/commit.ts` (`inferPropType`), `src/lib/yjsStore.ts` i `src/hooks/useNotes.ts` (opcje także dla wielu wyborów), `src/hooks/useFilteredNotes.ts`.
- **Jak działa:** model danych bez zmiany kształtu (`PropValue` to nadal tekst lub liczba, więc Yjs, kopia i schemat nie potrzebują migracji). Tak/nie to `1` (odznaczone = brak klucza); wiele wyborów to opcje złączone znakiem nowej linii w kolejności opcji pola (opcje tracą przecinki i nowe linie); odnośnik przyjmuje tylko `http(s)://` albo gołą domenę (dostaje `https://`) — `javascript:` i `data:` są odrzucane także przy odczycie z dokumentu. „Utworzono” i „Zmieniono” nie trafiają do `props`: `propValueFor` bierze je z `createdAt`/`updatedAt` notatki (trzeci argument `NoteTimes`). Limit zapisanego tekstu `PROP_LIMITS.stored` (1000) pozwala na 20 opcji po 40 znaków.
- **Eksport i import:** pola tylko do odczytu nie trafiają do eksportu `.md`/ZIP (są w metadanych notatki). Tak/nie jest eksportowane jako „Tak”, a import rozpoznaje pole, w którym wszystkie wartości to „Tak” (tak/nie) albo adresy `http(s)://` (odnośnik); wiele wyborów wraca jako tekst, chyba że istnieje pole o tej samej nazwie (wartości po przecinku są wtedy dopasowywane do opcji).
- **Ograniczenia:** zmiana typu istniejącego pola nadal niemożliwa (typ jest stały). Wartość wielu wyborów z opcją usuniętą z pola pokazuje tylko pozostałe opcje. Wpis wielu wyborów z jedną nieznaną opcją jest odrzucany w całości (nie zapisuje się po cichu bez literówki).
- **Testy:** `src/lib/noteProps.types6.test.ts`, `src/lib/noteProps.test.ts`, `e2e/note-props.spec.ts`.

## Notatki — układ „Galeria” (plan 6.3, 2026-11-13)

- **Co robi:** nowy układ widoku obok Mozaiki, Siatki, Listy, Tablicy i Tabeli: kafle z okładką (pierwszy obraz notatki), tytułem i do trzech wypełnionych pól pod nim. Wybór w menu „Widok i kolumny” albo w arkuszu widoku na telefonie, w Ustawieniach (domyślny układ) i w zapisanych widokach.
- **Gdzie:** `src/components/NoteGallery.tsx`, `src/lib/viewPrefs.ts` (`Layout`), `src/lib/savedViews.ts`, `ViewControls.tsx`, `ViewSheet.tsx`, `settings/AppearanceSettings.tsx`, `NoteGrid.tsx`, `src/pages/Index.tsx` (`galleryMode`).
- **Jak działa:** CSS grid `auto-fill` z kolumnami od 11 rem (telefon: dwie kolumny). Okładka to miniatura z `useImageUrl(images[0], true)`; bez obrazu jest pole z ikoną notatki albo ikoną zastępczą. Pola to `formatPropValue` pierwszych trzech definicji z wartością (w tym „Utworzono”/„Zmieniono”). Przypięte idą na początku (jak w tabeli), grupowanie jest wyłączone. Jak tabela: kliknięcie albo Enter/Spacja otwiera czytnik, bez edycji pól na karcie. Zapisany układ `gallery` w kopii zapasowej wczytuje się w starszych wersjach jako Mozaika (nieznany układ wraca do domyślnego).
- **Ograniczenia:** brak wyboru, które pola i jaka okładka (zawsze pierwszy obraz i pierwsze trzy pola z wartością); brak przeciągania, zaznaczania zbiorczego myszą ani klawiszy siatki (A, P, M, L) w tym układzie — tak samo jak w tabeli. Notatki prywatne nie pokazują okładki ani pól.
- **Testy:** `e2e/note-gallery.spec.ts`.

## Notatki — osadzony widok zapytania w notatce (plan 6.4, 2026-11-13)

- **Co robi:** blok ` ```zapytanie ` (albo ` ```query `) w notatce pokazuje tabelę innych notatek pasujących do zapytania, np. `etykieta:budowa pole:Status=Nowe sortuj:-termin kolumny:Status,Klient limit:20`. W czytniku i na kaflu wartości pól można zmieniać w miejscu (te same komórki co w tabeli notatek); tytuł otwiera notatkę. W edytorze blok poza kursorem jest podglądem tylko do odczytu, a z kursorem zwykłym tekstem.
- **Gdzie:** `src/lib/queryBlock.ts` (`parseQueryBlock`, `runQueryBlock`, magazyn `setQueryBlockData`/`getQueryBlockData`), `src/components/QueryBlock.tsx`, `MarkdownRendererImpl.tsx` (komponent `code`), `src/components/editor/livePreview.ts` (`QueryWidget`, `queryBlockSource`, `buildTables`), `src/hooks/NotesProvider.tsx` (`useNotesContextOptional`, odświeżanie magazynu).
- **Jak działa:** zapytanie to ta sama składnia co w wyszukiwarce (`parseSearchQuery`, `searchNotes`), więc działają `etykieta:`, `folder:`, `pole:`, `ma:` i wolny tekst. Trzy operatory bloku są wycinane przed wyszukiwaniem: `sortuj:` (tytul, zmiana, utworzono, termin albo nazwa pola; `-` przed nazwą = malejąco; puste na końcu), `kolumny:` (nazwy pól po przecinku; domyślnie pierwsze trzy pola) i `limit:` (domyślnie 25, najwyżej 100). Bez `sortuj:` wyniki są od najnowszej zmiany, a przy wolnym tekście wg trafności. Wynik nigdy nie zawiera notatek prywatnych, z kosza ani z archiwum. Nieznane kolumny i sortowanie są zgłaszane nad tabelą. Widżet CodeMirror czyta dane z magazynu odświeżanego przez `NotesProvider` (CodeMirror nie ma Reacta).
- **Ograniczenia:** widżet w edytorze odświeża się dopiero przy następnej zmianie tekstu albo ruchu kursora, nie w chwili zmiany innej notatki, i nie ma edycji komórek ani otwierania notatki. Blok pokazuje tylko notatki aktywne (bez archiwum). Poza `NotesProvider` (izolowane testy) czytnik pokazuje samo zapytanie. Blok nie ma osobnych kolumn „Utworzono”/„Zmieniono”, chyba że istnieją jako pola typu tylko do odczytu. **Budżet:** precache po tej zmianie to 4,292 z 4,3 MiB — następna zmiana dokładająca kod do startu wymaga przeniesienia czegoś poza precache albo decyzji o nowym progu.
- **Testy:** `src/lib/queryBlock.test.ts`, `src/components/QueryBlock.test.tsx`, `src/components/editor/queryWidget.test.ts`, `e2e/query-block.spec.ts`.

## Notatki — diagramy Mermaid (plan 5.5, 2026-11-13)

- **Co robi:** blok ` ```mermaid ` w notatce rysuje diagram (schemat blokowy, sekwencja, Gantt itd.) w czytniku i na kaflu, w kolorach aktualnego motywu. Błąd składni pokazuje komunikat z pierwszą linią błędu, a pod nim źródło. W edytorze blok zostaje tekstem.
- **Gdzie:** `src/components/MermaidBlock.tsx`, `src/lib/mermaidRender.ts` (`renderMermaid`, `resolveTokenColor`, `MERMAID_VERSION`), `scripts/copy-mermaid.mjs`, `MarkdownRendererImpl.tsx` (komponent `code`), `vite.config.ts` (`globIgnores` i reguła `mermaid-engine`), `package.json` (`predev`/`prebuild`), `.gitignore` (`public/mermaid/`).
- **Jak działa:** biblioteka NIE jest w paczce Vite. `copy-mermaid.mjs` (jak `copy-ocr.mjs` dla OCR) kopiuje `mermaid.esm.min.mjs` i jego chunki (ok. 24 MB) do `public/mermaid/<wersja>/`, a `renderMermaid` ładuje ją przez `import(/* @vite-ignore */ "/mermaid/<wersja>/…")` dopiero przy pierwszym diagramie. Bundlowanie przez Vite wciągało ok. 5 MiB do precache (diagramy, elk, cytoscape), więc odpadło. Service worker ma CacheFirst dla `/mermaid/` (po pierwszym diagramie działa offline) i nie trzyma tych plików w precache. Motyw: kolory z tokenów (`--foreground`, `--card`, `--primary` …) są zamieniane na `#rrggbb` przez płótno (Mermaid nie rozumie `oklch`), a zmiana jasny/ciemny albo stylu przemalowuje diagram. `securityLevel: "strict"` (Mermaid czyści etykiety DOMPurify, wyłącza `click`), bo treść notatki bywa od peera; SVG idzie do `dangerouslySetInnerHTML` dopiero po tym czyszczeniu. Diagramy są rysowane po jednym naraz (Mermaid ma globalny stan).
- **Ograniczenia:** `MERMAID_VERSION` musi być równa wersji w `package.json` (pilnuje `mermaidRender.test.ts`); przy aktualizacji Mermaida zmienić obie. Pierwszy diagram pobiera moduł (kilkaset KB do kilku MB zależnie od typu), offline przed pierwszym użyciem pokazuje komunikat o błędzie. Nie sprawdzałem Mermaida pod produkcyjnym CSP (`script-src 'self'`) — w testach działa serwer bez nagłówków Netlify; biblioteka nie używa `eval`, ale to do potwierdzenia po wdrożeniu. Wymaga `npm run build` z `node_modules/mermaid` (dzieje się w `prebuild`). Precache po tej zmianie: 4 508 471 B z limitu 4 508 877 B (zapas ok. 400 B).
- **Testy:** `src/lib/mermaidRender.test.ts`, `src/components/MermaidBlock.test.tsx`, `e2e/mermaid.spec.ts`, `e2e/bundle.spec.ts` (Mermaid poza precache i paczką startową).

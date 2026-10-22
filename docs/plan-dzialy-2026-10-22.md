# Plan poprawy, dopracowania, rozbudowy i wyglądu — dział po dziale (2026-10-22)

Źródło: 6 agentów analizujących kod (tylko odczyt), punkty sprawdzone z `opis.md` i `roadmap.md` (pominięto zrobione).
Oznaczenia: priorytet **W/Ś/N**, nakład **S/M/L**, **[paczka]** = dotyka paczki startowej (próg 401 KB, zapas ~0,7 KB).

---

## 0. Części wspólne (powłoka, nawigacja)

### Poprawa
1. **Martwe selektory Zeszytu** (W/S) — `html:not([data-skin])` nigdy nie pasuje (`useTheme.ts:61` zawsze ustawia), więc kreska pod `.section-label` (`index.css:579`) i ziarno papieru (`:660`) nie rysują się. Zamienić na `[data-skin="zeszyt"]`.
2. **Pigułka stanu zapisu** (W/S) — `<button role="status" aria-live aria-label>` (`OfflineStatus.tsx:91-97`): rola nadpisuje przycisk, etykieta zagłusza komunikat; bierna łapie fokus. Rozdzielić `span role=status` i przycisk.
3. **Pasek boczny na telefonie nie jest modalny** (Ś/M) — brak `role=dialog`, pułapki i zwrotu fokusu (`AppSidebar.tsx:101-122`). `FocusScope` z Radix.
4. **„Tryb ciemny” po cichu zmienia styl** (Ś/S) — w Neon/Matryca przełącza na Zeszyt (`useTheme.ts:142-146`), a Ustawienia w tej sytuacji blokują Jasność. Ujednolicić, etykieta lub „Cofnij”.
5. **Wersaliki mimo decyzji „zdanie”** (Ś/M) — `uppercase tracking-wider` ×64 (sidebar, BottomNav, `Section`, Sync); `.section-label` tylko ×6.
6. **Martwe pole `emoji` w `sidebarItems.ts`, stała „NOTKI v1.0”** (N/S).

### Dopracowanie
1. **Jedna tabela `VIEW_META`** (Ś/M) — nazwy/ikony widoków powielone w 5 miejscach, już się rozjechały („Grafik zmian” vs „Grafik”).
2. **Samouczek** (Ś/S) — „Krok 1 z 3” dla czytnika, „Wstecz”, tekst „⋯” zamiast „Więcej”.
3. **Tabliczka w rogu** (N/S) — Skrzynka, Długi, Ćwiczenia, folder, etykieta mają domyślne „ARKUSZ 1/1”.
4. **„Szukaj” z arkusza** (N/S) — `setTimeout(400)` → `onCloseAutoFocus`.
5. **`safe-area-inset-left/right`** w nagłówku i dolnym pasku (N/S).

### Rozbudowa
1. **Grupy w pasku bocznym + ukrywanie działów** (Ś/M) — 11 pozycji naraz.
2. **Wybór 4. pozycji dolnego paska** (Ś/M) — dziś na sztywno „Terminy”.
3. **Więcej poleceń w palecie** (Ś/S) — karty Ustawień, „Styl: …”, „Zrób kopię”, „Połącz urządzenie” (leniwe).
4. **Kropka stanu sync w nagłówku** dla sparowanych (N/S).

### Wygląd
1. **Nazwa: NOTKI czy Notatnik?** (W/S, **decyzja**) — manifest/tytuł/sidebar „NOTKI”, pusty stan „Notatnik”.
2. **Monogram N animuje się bez końca** (Ś/S) — pętla 4,8 s w nagłówku i sidebarze (`index.css:980,996`); jeden przebieg na starcie / hover / „Zapisano” (WCAG 2.2.2).
3. **Samouczek: rysunki kreską zamiast emoji** (Ś/M).
4. **Kolor paska przeglądarki** (N/S) — bursztyn `#f0b429` przy papierowym nagłówku.

---

## 1. Motywy i kroje (otwarte od 2026-10-21)

### Poprawa
1. **Kontrast tokenów poniżej AA** (W/S) — biały na `destructive`: Neon 4,00, Zorza 4,09, Matryca 3,78, Hydraulika 3,82, Plan 4,35; Plan `success-ink` 3,41, `warning-ink` 4,26, `destructive-ink` 4,33; Miedź `success-ink` 3,61, `warning-ink` 3,05. Nadpisać tokeny per styl i rozszerzyć `contrastTokens.test.ts` na wszystkie `html[data-skin]`.
2. **Krój nagłówków stylu trafia w małe etykiety** (W/S) — `html[data-skin] h1,h2,h3` (`skins.css:72,473,578`) łapie 11-px `h3` w Ustawieniach (Barlow Condensed 11 px, mono z poświatą). Zawęzić do `.app-title`, tytułu widoku, `[role=dialog] h2`.
3. **Hydraulika bez Jakarty jako fallbacku** (Ś/S) — `skins.css:581`.
4. **Nieaktualne komentarze** o liczbie stylów (`skins.css:4`, `appFont.ts:7`, `fonts.css:4`) (N/S).

### Dopracowanie
1. **Hydraulika jaśniej i szerzej** (W/M) — tło 8% jasności (Plan 18%), maska gasi rury do zera. Propozycja: background ~13%, card ~17%, muted ~20%, border ~27%, maska do 0,35; Barlow Condensed tylko `h1`. Sprawdzić 4,5:1 i 3:1.
2. **Miniatury stylów na telefonie** (W/S) — Hydraulika = jedna kreska (brak `background-size`, `skins.css:601`), Matryca = „kod kreskowy”; `ring-black/5` → `ring-foreground/10`.
3. **Układ galerii** (Ś/S) — Zeszyt na pełną szerokość, pod nim 6 stylów w 2×3.
4. **Podpisy krojów** (Ś/S) — próbka ucina „Il1 O0” (`FontPicker.tsx:52`); krótsza próbka / 2 linie; jeden wzór opisu; „Domyślny · Plus Jakarta Sans”.
5. **Wyróżniki Matrycy i Hydrauliki** (Ś/S) — kolor logo, akcent sidebaru, krój tabliczki; tabela wyróżników w `opis.md`.

### Rozbudowa
1. **Rozmiar tekstu 90/100/112/125%** (Ś/S) — niezależnie od trybu budowa.
2. **Styl na noc** (N/M) — para stylów + godzina / „System”.

### Wygląd
1. **Kroje tylko latin + latin-ext** (Ś/M) — dziś 55 `@font-face` z cyrylicą/greką/wietnamskim (`main.tsx:5-21`), CSS startowy ~45 KB gzip. Do tego budżet CSS w `e2e/bundle.spec.ts`.
2. **Tabela tokenów wymaganych od stylu + test kompletności** (Ś/S).

---

## 2. Notatki

### Poprawa
1. **`aria-pressed` nie trafia do DOM** (W/S) — `ActionBtn` go nie przekazuje (`NoteCardActions.tsx:24` vs `:169,178,187`); brak `type="button"`, „Ulubione” bez stanu.
2. **Czytnik udaje modal** (W/M) — `role=dialog aria-modal` bez pułapki/zwrotu fokusu w podglądzie (`NoteReader.tsx:245`). Podgląd niemodalny, prezentacja z pułapką.
3. **Tryb skupienia** (Ś/S) — ✕ bez `aria-label`, licznik `setInterval` dryfuje w tle, efekty w updaterze `setSeconds` (podwójnie w StrictMode), brak szkicu tekstu.
4. **Płótno traci rysunek bez pytania** (Ś/S) — Esc/tło zamyka, „Wyczyść” bez cofnięcia, kolory 24 px bez etykiet, `ToolBtn` bez `aria-*` (`DrawingCanvas.tsx`).
5. **Pasek formatowania** (Ś/S) — kompozytor gubi zaznaczenie; „## ”, „- ”, „> ” wstawiane w miejscu karetki zamiast na początku linii (`abc## def`). Wspólna funkcja dla `AddNoteBar` i `useNoteEditSession`.
6. **Miniatura obrazu to `div onClick`** (Ś/S) — brak klawiatury, w trybie zaznaczania otwiera podgląd (`NoteCard.tsx:266`, CRLF+NUL).
7. **Cele dotyku i drobiazgi** (Ś/S) — czytnik `h-8`, edytor „Podgląd/Pełny ekran” ~22 px, `EmptyState` liczy `matchMedia` raz przy imporcie, „1 powiązań” w grafie.

### Dopracowanie
1. **Historia wersji** (Ś/S) — przywrócenie bez „Cofnij”, brak `aria-expanded`, przycisk znika gdy brak wersji, własny Tooltip zamiast `HoverTip`.
2. **Podgląd Markdown na telefonie** (Ś/S) [paczka] — `grid-cols-2` przy 390 px → zakładki Edycja/Podgląd.
3. **Spójne dymki** (Ś/S) — tryb skupienia bez „Otwórz/Cofnij” i z pominięciem folderu widoku.
4. **Podgląd obrazów** (Ś/S) — następny/poprzedni, „2/5”, „Pobierz”.
5. **Data na kaflu bez roku** (Ś/S) [paczka] — rok gdy inny + `<time title>`.
6. **Placeholdery** (N/S) — „...” → „…”, kontrast `/40` `/50`, `aria-label` zamiast samego placeholdera.
7. **Wspólny `<mark>` trafień** (N/S) — `NoteCardBody.tsx:114` powiela `SearchMarks`.
8. **Odzyskanie miejsca w paczce** (Ś/M) [paczka, odciąża] — okna z „Więcej” (`VersionHistory`, `ShareNote`, `NoteLookPicker`) leniwie. **Zrobić przed punktami [paczka].**

### Rozbudowa
1. **Wyodrębnij zaznaczenie do nowej notatki** + `[[tytuł]]` (Ś/S) [paczka, mało] — otwarty punkt roadmapy z 2026-10-11.
2. **Rysowanie na zdjęciu** (Ś/S) — `DrawingCanvas` ma `initialImage`, używa go tylko Dziennik.
3. **Porównanie wersji** (Ś/M) — diff słów (własny LCS), wersje list zadań (`NoteVersion` ma tylko tytuł+treść).
4. **„Otwórz” załącznik** (N/S) — PDF/obraz w nowej karcie zamiast tylko „Pobierz”.
5. **Nowe typy pól: tak/nie, link** (N/M) [paczka].
6. **Domyślny szablon folderu** (N/M).
7. **Pointer Events i nacisk rysika** (N/S).

### Wygląd
1. **Nagłówek czytnika na 390 px** (W/M) — 6–9 przycisków po 32 px ściska tytuł; „⋯” + dolny pasek Poprzednia/Edytuj/Następna, 44 px.
2. **Lista w czytniku** (Ś/S) — ☑/☐ z Unicode → ten sam styl co bursztynowe pola na kaflu.
3. **Arkusz „⋯” w grupach** (Ś/S) — ~17 równorzędnych kafli; grupy Wygląd/Porządek/Udostępnij/Zaawansowane; „Usuń” czerwony także na dotyku.
4. **Płótno w stylu zeszytu** (Ś/M) — długopis/ołówek/zakreślacz z tokenów, kratka w ciemnym motywie, jeden przewijany pasek narzędzi.
5. **Tryb skupienia** (N/M) — bez pulsowania co sekundę, JetBrains Mono, cienki pierścień postępu, bez emoji.
6. **Promienie** (N/S) — `rounded-xl` zamiast `rounded-card` (tło gestu przesunięcia rozjeżdża się z kaflem o 16 px).
7. **Oś czasu wersji** (N/S) i **przegląd ciemnego motywu/skórek** dla pieczątek i trafień (N/M).

---

## 3. Skrzynka

### Poprawa
1. **Skrzynka gubi tekst** (W/S) — jednoliniowy `<input>`, tytuł obcinany do 120 znaków, reszta przepada (`InboxCapture.tsx:24-29`, `inbox.ts:24`). Autorosnące `textarea`, Enter zapisuje, nadmiar do treści.
2. **Brak widocznego fokusu** (W/S) — `focus-visible:ring-0` bez `focus-within` (WCAG 2.4.7).
3. **„+” w Skrzynce przenosi do Notatek** (W/S) — `canCompose` bez `inbox` (`Index.tsx:248,254`).

### Dopracowanie
1. **Informacja zwrotna na telefonie** (W/S) [paczka, mało] — `enterKeyHint="send"`, widoczny „Zapisz”, błysk nowego kafla (`handleAddNoteGlow` szuka nieistniejącego `[data-add-note-bar]`).
2. **Pieczątka „posortowane”** przy zejściu do 0 (N/S).

### Rozbudowa
1. **Tryb porządkowania** (W/M) — notatka po notatce, chipy folderów/etykiet, skróty 1–9, Archiwizuj/Kosz, Cofnij (leniwy `InboxTriage.tsx`).
2. **Dyktowanie i frazy `#etykieta @folder data`** (Ś/M) [paczka] — dymek mówi, dokąd trafiła notatka.

### Wygląd
1. **Własny charakter** (Ś/S) [paczka, mało] — pole jak zwinięty kompozytor, licznik „N do posortowania” jako `stamp-tag`.

---

## 4. Dziś

### Poprawa
1. **Karta zmiany ignoruje godziny dnia** (W/S) — `TodayShiftCard.tsx:102` bierze `type.start–end`, pomija `entry.hours`; urlop dostaje godziny. Użyć `dayType`/`shiftLabel`.
2. **Termin całodniowy zaległy o 9:01, „Przegapione” po 10:00** (W/M) [paczka, mało] — `termStatus` i `groupReminders` nie znają `reminderAllDay`; zaległość od `endOfDay`.
3. **Całodniowy jako „dziś, 09:00”** (Ś/S) — `TodayDueList.tsx:64` bez argumentu `allDay`.
4. **Prywatna notatka jako „Bez tytułu”** (Ś/S) — reszta pisze „Notatka prywatna”.
5. **Licznik przypomnień w kolorze marki przy zaległych** (N/S).

### Dopracowanie
1. **„Nic nie czeka” + najbliższy termin** (Ś/S).
2. **„· kilka minut” na sztywno** w powtórkach (N/S).
3. **Szkielet zamiast „Grafik się wczytuje…”** (N/S).

### Rozbudowa
1. **Akcje Gotowe / +1 h / Jutro przy terminie** (W/M) — wspólny `lib/reminderActions.ts` (naprawia też Terminy P1).
2. **Stan zmiany na teraz** (Ś/M) — „Zaczynasz za 2 h 10 min”, „Do końca 3 h”, nocka trwająca po północy.
3. **Wieczorem podgląd jutra** (Ś/S) — po 18:00 „Jutro: R 6–14 · 2 terminy”.
4. **Mini plan dnia** (N/M) — zwijana oś godzin.

### Wygląd
1. **Karta zmiany jako bohater** (Ś/S) — duży znaczek w kolorze zmiany, godziny w JetBrains Mono.
2. **Mniej przewijania na 390 px** (Ś/M) — ciaśniejsze odstępy, Praca+Powtórki w jednym rzędzie.
3. **Odstępy grup listy** (N/S) — `section-label`, `mt-3`.

---

## 5. Kalendarz

### Poprawa
1. **Edycja odłożonego wystąpienia przesuwa całą serię** (W/M) — godzina z `occ.at`, `base=undefined` (`ReminderQuickAddDialog.tsx:68`, `ReminderCalendarView.tsx:158,228`); to samo przeciąganie i Shift+←/→.
2. **Godzina z języka naturalnego ginie** (W/S) — „jutro 15:00 dentysta” → tytuł „15:00 dentysta” (`ReminderQuickAddDialog.tsx:92-102`).
3. **Całodniowy wyświetlany jako „09:00”** (Ś/S) — chip, panel dnia, oś, toast (wydruk działa dobrze).
4. **Zaległy w siatce wygląda jak załatwiony** (Ś/S) — szary `bg-muted` (`ReminderChip.tsx:295`), kropki bez odróżnienia.
5. **`.ics`** (Ś/S) — całodniowy jako 9:00–9:15 zamiast `VALUE=DATE`, odłożona seria z odłożonym `DTSTART`, eksport zakończonych serii.
6. **Etykieta „Dziś”, pole „Cały dzień” < 44 px** (N/S).

### Dopracowanie
1. **Zapamiętać Miesiąc/Tydzień na telefonie** (Ś/S).
2. **Panel dnia poza ekranem po stuknięciu** (Ś/S) — `scrollIntoView` na `coarse`.
3. **Przeszłość: ostrzeżenie vs blokada** — ujednolicić z `ReminderPicker` (Ś/S).
4. **Za dużo `aria-live`** (N/S), **pusty dzień na osi** (N/S), **widok po północy** (N/S).

### Rozbudowa
1. **„Otwórz notatkę” z panelu dnia i dialogu** (W/S) — dziś z kalendarza nie da się wejść w notatkę.
2. **„Gotowe” w panelu dnia** (Ś/S) — przez wspólny moduł akcji.
3. **Znaczniki Pracy w `WeekStrip` i `UpcomingDays`** (Ś/S).
4. **Filtr warstw Terminy/Grafik/Praca** (N/M).
5. **Tydzień z osią godzin na xl** (N/L).

### Wygląd
1. **Nagłówek na 390 px** (Ś/S) — 6 celów po 44 px ucina tytuł; Drukuj i `.ics` do „⋯”.
2. **Stany kształtem, nie tylko kolorem** (Ś/S) — całodniowy jako pasek, zaległy z czerwoną krawędzią, kwadratowa kropka.
3. **Kontrast chipów w skórkach** (Ś/S) — `bg-primary/12`, `primary/40` w neon/matrix/zorza/ciemnym.
4. **Linia „teraz” na osi godzin** (N/S) — bursztynowa kreska, godziny w mono.
5. **Komórka na telefonie** (N/M) — numer `text-sm`, kropki wyśrodkowane.

---

## 6. Terminy / Przypomnienia

### Poprawa
1. **„Jutro” i „+1 h” na kaflu przesuwają całą serię** (W/S) [paczka, mało] — `NoteCardBody.tsx:160,175` bez `reminderBase`; codzienna 7:00 staje się 14:37. Użyć `snoozeTarget`.
2. **`ReminderPicker` pokazuje nieaktualny termin** (W/S) [paczka] — stan tylko z pierwszego renderu (`:43-48`); po przeskoku serii zapis zablokowany. Odświeżać w `onOpenChange(true)`.
3. **Grupy Terminów nie przeliczają się z czasem** (Ś/S) — `Index.tsx:312` zależy tylko od `[view, others]`; potrzebny timer.
4. **Seria w godzinie przeskoku DST przesuwa się na stałe** (Ś/M) — `reminderRepeat.ts:17-37` i `push/schedule.ts:123`; liczyć od godziny bazy.
5. **`seriesDay` przy odłożeniu** (Ś/S) — bierze dzień odłożenia zamiast `reminderBase` (stare notatki).
6. **Parser dat** (Ś/S) — „dziś” bez godziny = minione teraz, „12.11” → 12:11, „o 15” nierozpoznane, „jutro o 9” tuż po północy.

### Dopracowanie
1. **Jedno menu „Odłóż” wszędzie** (Ś/S) — 10 min, +1 h, wieczorem 18:00, jutro rano.
2. **Akcja z powiadomienia na prywatnej notatce znika bez śladu** (Ś/S).
3. **Dymek zbiorczy: „Odłóż wszystkie o 1 h”** (N/S).
4. **Dymek: 44 px, ikona zamiast ⏰, całodniowy bez 09:00** (N/S); **picker: „X” bez `aria-label`** (N/S); **„W archiwum” bez sortowania** (N/S).

### Rozbudowa
1. **Powtarzanie: dni robocze, co 2 tygodnie, co rok, wybrane dni** (W/M) [paczka] — **decyzja o zgodności starszych wersji**.
2. **Wcześniejsze przypomnienie** 15 min / 1 h / dzień (Ś/M).
3. **„Po zmianie / przed zmianą”** z Grafiku (Ś/M, leniwie).
4. **„Odłóż do…” z datą** (N/S).

### Wygląd
1. **Picker na telefonie** (Ś/M) — 44 px, Toggle Group zamiast natywnego `select`.
2. **Odznaka terminu na kaflu** (Ś/S) [paczka] — mono, stempel „dziś/jutro”, ikona `BellRing` dla zaległych.
3. **Kolejność grup** (N/S) — „Praca” przed „Zaległe”; ikony grup.
4. **Dymek przypomnienia w skórkach** (N/S) — `bg-card`, `rounded-card`, bursztynowy pasek.

---

## 7. Grafik

**Budżet:** `lib/shifts/index.ts` (barrel) jest w paczce startowej — nowe moduły importować bezpośrednio z leniwych komponentów.

### Poprawa
1. **`.ics` miesza grafiki** (W/S) — UID bez id grafiku, wspólna lista wysłanych dni → eksport B odwołuje dni A (`ics.ts:14,62,88`).
2. **„Skończyłem teraz” znika po końcu zmiany** (W/S–M) — `now < occ.end`; okno łaski ~4 h dla nadgodzin.
3. **Start = koniec daje cichą zmianę 24 h** (W/S) — `shiftSpan` (`time.ts:24`), walidacja tylko `!== null`.
4. **Cykl nadpisuje urlop, L4, notatki bez ostrzeżenia** (Ś/S–M) — podgląd „zastąpi: 3 dni urlopu”, „pomiń nieobecności”.
5. **Noc zmiany czasu (25.10 — ten weekend!)** (Ś/S) — siatka/okno 8 h, rachunek 9 h, CSV godziny nocne bez DST.
6. **Dodatek za nadgodziny jako różnica zaokrągleń** (Ś/S) — może dać „0,01 zł”; `premiumAmount` z `monthSummary`.
7. **Stan schowka Ctrl+C niewidoczny po „Rozumiem”** (Ś/S).
8. **Pędzel gubi `extraMin`/`offSchedule`/`inLieu`** (N/S); **CSV „Do” = plan, nie faktyczny koniec** (N/S); **licznik urlopu po północy** (N/S).

### Dopracowanie
1. **Widoczne Cofnij/Ponów na telefonie** (Ś/S).
2. **Krótki odpoczynek: dni jako przyciski + ⚠ w komórce** (Ś/S).
3. **Cykl startuje od dziś / ostatniego dnia; `toastWithUndo`** (Ś/S).
4. **`autoFocus` otwiera klawiaturę na telefonie** (Ś/S).
5. **„22:00–06:00 (+1 dzień)” i ostrzeżenie > 16 h** (Ś/S).
6. **Pusty miesiąc z CTA** „Nałóż cykl” / „Skopiuj poprzedni miesiąc” (Ś/S).
7. **Kwoty „1 000” / „abc” po cichu ignorowane** (N/S); **odchylenie w oknie dnia** (N/S); **dodatek 50%/100% w osobnych liniach** (N/S); **„—” dla zera** (N/S).

### Rozbudowa
1. **Kotwica cyklu i „Przedłuż cykl”** (W/M) — `ShiftPattern.anchor`, faza liczona automatycznie.
2. **Dodatek nocny w zł (art. 151⁸)** (W/M) — 20% stawki z płacy minimalnej roku, nadpisywalne.
3. **Odbiór nadgodzin i saldo** (Ś/M).
4. **„Przepracowane do dziś” i prognoza** na koniec miesiąca (Ś/S).
5. **Urlop w godzinach dla systemu równoważnego** (Ś/M) — dziś 12-h zmiana zawyża saldo.
6. **Odpoczynek tygodniowy 35 h** (Ś/S).
7. **Nakładka drugiego grafiku** (N/M), **zamiana zmian ⇄** (N/S), **kopiuj miesiąc/zakres** (N/S), **szacunek urlopu/L4 w rachunku** (N/M).

### Wygląd
1. **Mniej nad siatką na 390 px** (Ś/M) — „Grafik ▾” przy tytule, eksporty w menu „Udostępnij”.
2. **Znaczniki w komórce** (Ś/S) — ☾ noc, ⚠ odpoczynek, kropka offSchedule/inLieu.
3. **Ciemny motyw: chipy `color-mix`** zamiast pełnych nasyconych (Ś/S).
4. **„Razem brutto” wyżej** (Ś/M) — obok „Przepracowane”, premie zwinięte.
5. **Paleta domyślna koliduje z bursztynem marki i czerwienią święta** (N/S).
6. **Tabela roku na 390 px** (N/S), **numer tygodnia ISO** (N/S), **fala pieczątek przy nałożeniu cyklu (CSS)** (N/S), **zrzuty w Matrycy/Hydraulice** (N/S), **znacznik normy na pasku** (N/S).

---

## 8. Praca → Nauka

**Budżet:** do paczki startowej trafia tylko `yStudy.ts` (+ `data.ts`, `journalRefs.ts`) — nowy model w `store.ts`/`sites.ts`/`siteItems.ts`.

### Poprawa
1. **„Na dziś” nie zmienia się po północy** (W/S) — brak `useDayClock()` (`QuizPanel.tsx:46`, `StudyView.tsx:108,137`, `StudyBoard.tsx:170`).
2. **Fokus znika po odpowiedzi** (Ś/S) — `disabled` na wybranym przycisku.
3. **Nie da się przerwać rundy** (Ś/S).
4. **Objaśnienie pod przyklejonym „Dalej”** (Ś/S).
5. **`revokeObjectURL` od razu po `click()`** (Ś/S) — `StudyStats.tsx:212`, `siteZip.ts:78`.
6. **Brak edycji własnego pytania** (Ś/M) — usunięcie kasuje historię powtórek.
7. **Dwie ściągi wysokości** (N/S).

### Dopracowanie
1. **Wynik i statystyki prowadzą do „Ćwicz”** (W/S).
2. **Temat z 2 pytaniami → „Dodaj własne”** (Ś/S).
3. **Szkielet podczas wczytywania Yjs** (Ś/S).
4. **„Do notatki” nie dubluje** (Ś/S); **pamiętanie kolumny tablicy** (N/S); **`useMemo` w tablicy** (N/S).

### Rozbudowa
1. **Problem z budowy → pytanie** (W/M).
2. **Szukaj w materiale** bez polskich znaków (Ś/M).
3. **Quiz przed następnym etapem budowy** (Ś/M).
4. **Przypomnienie o powtórkach** (Ś/S–M).
5. **Punkty krytyczne jako fiszki** (N/M).

### Wygląd
1. **Pasek postępu z kratek** (Ś/S) — zielona/czerwona/pusta.
2. **Kratki dni nauki w ciemnym i Hydraulice** (Ś/S) — obwódka.
3. **Karta tematu na 390 px** (Ś/S) — „Ćwicz” jako główna akcja.
4. **Zrzuty wszystkich skórek** (Ś/M); **pieczątka „Dobrze/Bezbłędnie”** (N/S); **większe pola listy** (N/S).

---

## 9. Praca → Dziennik budowy

### Poprawa
1. **Dyktowanie gubi tekst** (W/S) — `return` przed `append` przy brakach bez budowy (`JournalEntrySheet.tsx:239-250`).
2. **Nagrań i etapu nie widać na liście; mylący podpis** (W/S) — `StudyJournal.tsx:463-571`.
3. **Karta budowy gubi zmiany przy zamknięciu** (W/S) — `dirty` liczone, nieużywane (`SiteCardDialog.tsx:81,160`).
4. **Przyciski na zdjęciach 24–32 px, usunięcie bez Cofnij** (W/S) — rękawice.
5. **Przypomnienia „> 3 dni” nie odświeżają się** (Ś/S) — `useDayClock()`.
6. **Tryb budowa nie powiększa przycisków działu** (Ś/S) — brak `tap-target`/`IconButton` w `components/study`.
7. **`text-warning` zamiast `-ink`, link „Mapa” bez 44 px, stare komentarze** (N/S).

### Dopracowanie
1. **Szukanie po kształtkach i próbie** (Ś/S).
2. **Pigułka etapu na liście** (Ś/S).
3. **Galeria: przesuwanie, powiększanie, numer w `aria-label`** (Ś/M).
4. **„Pokaż starsze” porcjami + `memo`** (Ś/M).
5. **Podpisy zdjęć z historii budowy** (N/S); **komunikat pustego wpisu** (N/S); **dyktowanie „Jak rozwiązane?”** (N/S).

### Rozbudowa
1. **Lista budów i „Nowa budowa” bez wpisu** (W/M).
2. **Szybkie szablony wpisu** (Ś/M).
3. **Zestawienie godzin budów za miesiąc (CSV)** (Ś/M).
4. **Przypomnienie o pustym dniu po zmianie** (Ś/S).
5. **Lista „przed zakryciem” w protokole** (Ś/M).

### Wygląd
1. **Porządek w karcie budowy** (W/M) — formularz zwinięty, panele z licznikami, akcje przyklejone.
2. **Kolejność w arkuszu wpisu** (Ś/M) — pigułki „+ Próba / + Kształtki / + Temat / Etap”.
3. **Otwarty problem widoczny na osi** (Ś/S) — pasek/pieczątka „OTWARTY”.
4. **Czytelność w słońcu** (Ś/S) — min. 12 px, `font-medium`.
5. **Różne ikony przypomnień** (Ś/S); **galeria na czarnym tle** (N/S); **podświetlenie nowego wpisu** (N/S).

---

## 10. Długi

### Poprawa
1. **Pasek spłaty liczy tylko 2 z 4 rodzajów** (W/S) — `DebtsView.tsx:177`; brak przy „pożyczyłem od”, błędny przy obu stronach, `Math.round` daje 100% przy 99,6%. Funkcja `repaidShare` + test.
2. **Kolory historii odwrotne niż na liście** (Ś/S) — kolor wg wpływu na saldo.
3. **Grupa rodzaju bez strzałek, w edycji < 44 px** (Ś/S) — `ui/toggle-group.tsx`.
4. **Edycja słabsza niż dodawanie** (Ś/S) — `aria-invalid`, datalist osób, „Cofnij”.
5. **Podwójne rozliczenie z dwóch telefonów** (Ś/M) — wykrycie + baner.
6. **Copy i data po północy** (N/S).

### Dopracowanie
Glif pustego stanu (Ś/S), `RollingNumber` w sumach (N/S), rozliczeni zwinięci na dole (Ś/S), saldo narastające i miesiące w historii (Ś/S), formularz zwijany na telefonie (N/S).

### Rozbudowa
1. **Termin zwrotu z przypomnieniem** (W/M) — przez notatkę z `reminder`, trafia do Dziś/Terminów/Push.
2. **Zmiana nazwy i łączenie osób** (Ś/M).
3. **Wyślij stan osobie** (Ś/S) — `navigator.share`.
4. **Ukrywanie kwot** (Ś/S); **eksport CSV** (N/S).

### Wygląd
Pasek „nam winni / my winni” (Ś/S), inicjał w kółku z palety skórek (N/S), pasek spłaty kreską długopisu (N/S), siatka 2×2 przy dużym kroju na 390 px (Ś/S).

---

## 11. Ćwiczenia

### Poprawa
1. **Zmiana godziny przypomnienia zaśmieca kosz** (W/S) — `apply` przy każdym `onChange` (`TrainingSection.tsx:398`).
2. **Ciężar po cichu zaokrąglany** (W/S) — 22,3 → 22,5 kg; białko do całości.
3. **Licznik przerwy ogłasza każdą sekundę** (Ś/S).
4. **Przerwa nie pasuje do modelu zapisu** (Ś/S).
5. **Pola celu planu bez etykiet** (Ś/S).
6. **Cele diety nie nadążają za sync, brak potwierdzeń, przycisk bez powodu blokady** (Ś/S).

### Dopracowanie
Ustawienia treningu niżej (W/S), plan dnia prowadzi przez trening „2/4” (Ś/M), glif pustego stanu (N/S), `useMemo` progresu (N/S), zapis „wczoraj” (Ś/S).

### Rozbudowa
1. **Własne ćwiczenia** (W/M) — mapa `trainingExercises`; uwaga na starsze wersje.
2. **Szybki posiłek z ostatnich + „Powtórz wczoraj”** (W/S).
3. **Masa ciała z wykresem** (Ś/M).
4. **Odżywki: 7 kropek zgodności + edycja** (Ś/S).
5. **„Wziąłem” zamyka przypomnienie** (Ś/M); **pieczątka „Nowy rekord”** (N/S).

### Wygląd
1. **Zakładki Odżywki / Trening / Dieta + pasek „dziś”** (W/M).
2. **Postęp do celu diety + mini słupki 7 dni** (Ś/S).
3. **Lepszy sparkline z rekordem** (Ś/S); **licznik przerwy jako pierścień** (N/S); **hierarchia nagłówków** (N/S).

---

## 12. Skarbiec

### Poprawa
1. **Utrata notatek przy równoległym założeniu/zmianie hasła na dwóch urządzeniach** (W/S wykrycie, M naprawa) — blokada tylko przy zmianie `epoch`, oba urządzenia mogą mieć ten sam. Wykrywać zmianę `check`/`wrapped`; naprawa przez przeszyfrowanie; test dwóch dokumentów.
2. **Hasło 8 znaków, „Słabe” przechodzi** (Ś/S) — otwarty punkt „≥ 12” (roadmap.md:671).
3. **Format v2: `epoch` w AAD, metadane w szyfrogramie** (Ś/L).
4. **Nieodszyfrowana notatka to ślepy zaułek** (Ś/S) — kod awaryjny / pobierz szyfrogram / usuń.
5. **Natywne checkboxy < 44 px, brak ostrzeżeń i odliczania** (Ś/S).
6. **Zły kod zdarzenia, `hiddenLock` poza kopią, `revokeObjectURL` w Safari** (N/S).

### Dopracowanie
Menedżer haseł `current-password` (Ś/S, **decyzja**), mniej ogłoszeń miernika (N/S), kod awaryjny w grupach + „Drukuj” (N/S), auto-myślniki w polu kodu (N/S), przejście przy blokadzie (N/S).

### Rozbudowa
1. **Filtr `ma:prywatne`** (Ś/S) [paczka].
2. **Odblokowanie odciskiem/twarzą (WebAuthn PRF)** (Ś/L).
3. **Kwartalny test hasła i stan kodu awaryjnego** (N/S).
4. **Nowa notatka od razu prywatna** (Ś/M); **szyfrowane obrazy** (N/L).

### Wygląd
Kafel prywatny z zamazanymi liniami i 4 stanami (Ś/S), karta stanu w Ustawieniach (N/S), **ikona otwartej kłódki w nagłówku** (Ś/S) [paczka, mało], miernik hasła z tokenów (N/S).

---

## 13. Ustawienia i Synchronizacja

### Poprawa
1. **QR na iPhonie paruje Safari, nie PWA** (W/M) — skaner w aplikacji (`BarcodeDetector`), na iOS komunikat „wpisz kod ręcznie”.
2. **Stan sync nie jest ogłaszany, surowe `lastError`** (Ś/S).
3. **Pora roku/układ/gęstość/kolumny jako `aria-pressed`** (Ś/S) — `ToggleGroup`/`Segmented`, 44 px.
4. **Błędy w tekstach** (Ś/S) — „zakładka Efekty” (nie istnieje), „skórka, czcionka”, „backup”, „otwórz tu sam kod na nim”.
5. **`deviceWord` powiela `pluralPl`** (N/S).

### Dopracowanie
Pasek skoków w Wyglądzie (Ś/S), „Zapisz” nazwy tylko po zmianie (N/S), kolejność kroków w Sync: najpierw „Mam grupę / Nowa grupa” (Ś/S), przełączanie stylów strzałkami bez przejścia (N/S).

### Rozbudowa
„Ostatnio widziane” urządzenia (Ś/S), sekcja „O aplikacji” z wersją i „Co nowego” (Ś/M), krok Samouczka o danych i kopii (Ś/S).

### Wygląd
Jeden `SettingsCard` i tokeny promieni (Ś/M), `Section` jako `.section-label` zamiast 11-px wersalików (Ś/S), `Segmented` zamiast natywnych `select` (N/M).

---

## Proponowana kolejność (fale)

**Fala 1 — błędy i utrata danych (wszystko S, ~1 dzień)**
- Grafik P5 (DST 25.10 — przed weekendem!), P1 (`.ics`), P3 (24 h), P2 („Skończyłem teraz”)
- Terminy P1 (snooze na kaflu), P2 (picker), Kalendarz P1–P2
- Skrzynka P1–P3, Dziennik P1–P4, Ćwiczenia P1–P2, Długi P1–P2
- Skarbiec P1 (wykrycie), Dziś P1, Nauka P1 + Dziennik P5 (`useDayClock`)

**Fala 2 — motywy i kroje (otwarte od wczoraj, tylko CSS)**
- Kontrast tokenów + test wszystkich stylów, zawężenie krojów nagłówków, Hydraulika, miniatury, galeria, podpisy krojów, martwe selektory Zeszytu.

**Fala 3 — dostępność i spójność**
- `aria-pressed` w kafelku, czytnik, pasek boczny, pigułka zapisu, wersaliki → zdanie, terminy całodniowe w jednym przejściu, `VIEW_META`.

**Fala 4 — zapas w paczce i wygląd na telefonie**
- Leniwe okna z „Więcej”, potem: nagłówek czytnika, nagłówek kalendarza, nad siatką Grafiku, karta budowy, zakładki Ćwiczeń, Dziś na 390 px, kroje latin-ext.

**Fala 5 — rozbudowa (wybrać)**
- Akcje terminu na Dziś/Kalendarzu, tryb porządkowania Skrzynki, kotwica cyklu + dodatek nocny, lista budów, termin zwrotu długu, własne ćwiczenia, powtarzanie rozszerzone.

**Decyzje właściciela potrzebne:** nazwa NOTKI/Notatnik; zgodność rozszerzonego powtarzania ze starszymi wersjami; minimum hasła 12; `current-password` w skarbcu; „Gotowe kończy serię” (z wcześniej).

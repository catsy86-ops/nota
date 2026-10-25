# Etap 6: model danych Nauki w Yjs (plan, bez zmian w kodzie)

Status: **analiza i opcje, bez implementacji.** Każda zmiana formatu w Yjs wymaga migracji
i decyzji o zakresie (decyzja 24.10). Ten dokument przygotowuje tę decyzję.

## Stan obecny, punkt po punkcie

| Problem z planu | Stan w kodzie | Ryzyko dziś |
|---|---|---|
| Karta budowy zapisywana jako cały obiekt (`yStudy.ts` `saveSite`, `store.ts` `saveSiteCard`) | Częściowo: listy karty (etapy, braki, zamówienia, historia) są w osobnej mapie `siteItems`, zmieniane różnicą `setSiteList` (`base` → `next`). Pola formularza (nazwa, adres, telefony) nadal idą jako cały obiekt. | Niskie. Dwa telefony edytujące różne pola tej samej karty w tej samej chwili: wygrywa ostatni zapis całej karty, czyli pola drugiego telefonu mogą wrócić do starej wartości. |
| Pola-tablice wpisu (`checked`, `images`, `fittings`) są atomowe | Częściowo: wpis to mapa pól (`writeEntry`, D5), więc zmiana `text` nie kasuje `images` z drugiego telefonu. Samo pole-tablica zapisuje się jako całość. | Niskie–średnie. Dwa telefony odhaczające różne punkty tego samego wpisu w tej samej chwili: jedna tablica `checked` nadpisze drugą. |
| `replaceAll` kasuje dane u drugiego urządzenia (`yStudy.ts:625`) | Obecnie `replaceAll` wywołuje tylko przywracanie kopii (`exportNotes.ts:359`). Czyści wszystkie mapy Nauki i wpisuje kopię. | Średnie, ale rzadkie. Przywrócenie starej kopii na jednym telefonie usuwa Naukę na wszystkich połączonych urządzeniach. |
| `StudyDump` ma na sztywno `version: 1` (`yStudy.ts:123`, `:235`) | Nie ma ścieżki migracji. Kopia z przyszłą wersją zostanie odrzucona albo źle wczytana. | Niskie dziś, rośnie przy pierwszej zmianie formatu. |

## Dlaczego nie ruszać tego w ciemno

- Dane żyją w Yjs na wszystkich urządzeniach. Zmiana kształtu map to migracja, która musi
  przejść na każdym telefonie bez utraty danych, również przy starszej wersji aplikacji.
- Kopie zapasowe (`StudyDump`) są w plikach użytkownika. Stare kopie muszą dalej się wczytywać.
- Część ryzyka da się usunąć małymi zmianami, bez nowego formatu (patrz opcja A).

## Opcje

**A. Małe poprawki w obecnym formacie (rekomendowane na start).**
- Pola formularza karty zapisywać jako różnicę (jak `setSiteList`), a nie cały obiekt.
- Tablice `checked`/`fittings` w wpisie zapisywać jako mapy `id → true` (jak `checked` w karcie
  tematu), więc dwa telefony odhaczające różne punkty nie nadpisują się. To zmiana kształtu pola
  w wpisie, więc wymaga czytania starego formatu tablicy (migracja przy odczycie, bez zapisu).
- `replaceAll` przy przywracaniu: pytanie w UI przed nadpisaniem Nauki na innych urządzeniach
  („Przywrócenie usunie Naukę również na połączonych telefonach”). Bez zmiany formatu.
- Szacunek: S–M. Dane istniejące czytane tak samo, zapis nowy.

**B. Pełna wersja 2 `StudyDump` i mapy (version 2).**
- Ścieżka migracji z version 1 do 2 przy starcie i przy wczytywaniu kopii.
- Szacunek: M–L. Wymaga testów migracji na prawdziwych danych (kopie z kilku wersji).

**C. Nic nie zmieniać.** Ryzyko opisane wyżej zostaje; akceptowalne, jeśli używasz jednego telefonu
naraz.

## Rekomendacja

Opcja A, w trzech krokach, każdy osobnym commitem z testem:
1. `replaceAll` z potwierdzeniem w UI (zero zmian formatu, najszybsza ochrona przed utratą).
2. Pola formularza karty jako różnica.
3. Tablice wpisu jako mapy `id → true` z migracją przy odczycie i testem starego formatu.
Opcja B dopiero, gdy będzie potrzeba nowego pola w dumpie.

## Decyzje potrzebne od właściciela

1. Czy używasz Nauki na dwóch telefonach/komputerach jednocześnie? (Od tego zależy, czy krok 2–3 są pilne.)
2. Czy zgadzasz się na opcję A i kolejność 1–3?
3. Czy w kroku 1 ma być potwierdzenie przy przywracaniu kopii?

## Testy do dopisania (dla opcji A)

- `src/lib/study/yStudy.test.ts`: dwa dokumenty Yjs (symulacja dwóch telefonów) edytują różne
  pola karty / różne punkty wpisu; po wymianie stanów oba zmiany są widoczne.
- Test migracji: stary format tablicy `checked` w wpisie czyta się jako ten sam zbiór.

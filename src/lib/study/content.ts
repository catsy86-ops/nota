/**
 * Materiał działu „Nauka” — zebrany z materiałów G-HEAT: poradnika „Woda użytkowa”
 * (KAN-therm UltraLine, PERTAL²) oraz list kontrolnych instalacji wodnej i kanalizacji.
 * Treść jest statyczna; w localStorage ląduje tylko postęp (patrz `store.ts`).
 */

export type ModuleId = "woda" | "kan" | "wspolne";

export const MODULES: { id: ModuleId; label: string; source: string }[] = [
  { id: "woda", label: "Woda użytkowa", source: "Poradnik „Woda użytkowa” + lista kontrolna instalacji wodnej" },
  { id: "kan", label: "Kanalizacja", source: "Lista kontrolna instalacji kanalizacyjnej" },
  { id: "wspolne", label: "Wspólne", source: "Dokumentacja i zakończenie prac" },
];

export interface StudyTopic {
  id: string;
  module: ModuleId;
  title: string;
  /** Jedno zdanie: o co chodzi w temacie. */
  summary: string;
}

export const TOPICS: StudyTopic[] = [
  { id: "system", module: "woda", title: "System UltraLine i rura PERTAL²", summary: "Wielowarstwowa PE-RT/Al/PE-RT, 14–32 mm; kształtki bezoringowe, tuleje PVDF." },
  { id: "narzedzia", module: "woda", title: "Narzędzia KAN-therm", summary: "Nożyce do tworzyw, kielichownica z głowicami, praska z widelcami — tylko oryginalne." },
  { id: "laczenie", module: "woda", title: "Łączenie nasuwaną tuleją", summary: "Przytnij, nasuń tuleję, kielichuj, wsuń kształtkę, zaciśnij do kołnierza." },
  { id: "kielichowanie", module: "woda", title: "Kielichowanie i jego kontrola", summary: "Dwie fazy z obrotem o ok. 30°; pęknięcie lub niepełny obwód = odciąć i powtórzyć." },
  { id: "chlod", module: "woda", title: "Montaż w niskich temperaturach", summary: "Standardowo powyżej 0 °C; końcówkę ogrzewamy, ścianka maks. 90 °C, bez ognia." },
  { id: "mocowanie", module: "woda", title: "Haki i prowadzenie rur w posadzce", summary: "Zimna: haki 6 cm do podłoża; ciepła i cyrkulacja: haki 10 cm na styropianie." },
  { id: "trojniki", module: "woda", title: "Trójniki przy krzyżowaniu rur", summary: "Rozsunięte min. 30 cm, leżą na podłożu, rura krzyżująca idzie nad nimi." },
  { id: "wydluzanie", module: "woda", title: "Wydłużanie przy nagrzewaniu", summary: "PERTAL² pracuje minimalnie, ale na długich odcinkach zostaw rurze luz." },
  { id: "otulina", module: "woda", title: "Otulina i cyrkulacja c.w.u.", summary: "Otulina szczelna: docisnąć na styku i okleić taśmą, żeby piana nie weszła do środka." },
  { id: "proba-wody", module: "woda", title: "Płukanie i próba szczelności", summary: "Po montażu płukanie, potem próba przed zakryciem: 6 bar robocza, 9 bar odbiorowa." },
  { id: "punkty", module: "woda", title: "Punkty wodne i wysokości", summary: "Standard G-HEAT: umywalka 58, zlew 48, pralka 58, wanna 75, prysznic 110, WC 130 cm." },
  { id: "podtynk", module: "woda", title: "Elementy podtynkowe", summary: "Pytamy przed wyznaczaniem punktów; przy zestawie podtynkowym punktu nie robimy." },
  { id: "piony", module: "kan", title: "Piony, rewizje i mocowania", summary: "Piony 110, rewizje w dostępnych miejscach, obejmy w rozstawach z kompensacją." },
  { id: "spadki", module: "kan", title: "Spadki kanalizacji", summary: "Ok. 2–3% zależnie od średnicy — inaczej zaleganie albo odrywanie wody." },
  { id: "uszczelki", module: "kan", title: "Kielichy, uszczelki i fazowanie", summary: "Rura cięta prostopadle i sfazowana, uszczelka ze smarem — inaczej się podwija." },
  { id: "napowietrzanie", module: "kan", title: "Napowietrzenie pionu", summary: "Wywiewka dachowa albo napowietrzacz; bez niego wyssane syfony i smród." },
  { id: "proba-kan", module: "kan", title: "Próba kanalizacji na zalanie", summary: "Napełnij wodą i sprawdź wszystkie złącza przed zakryciem; spisz protokół." },
  { id: "dokumentacja", module: "wspolne", title: "Zdjęcia i dokumentacja przed zakryciem", summary: "Trasy i punkty z miarą lub opisem — chroni przed przewierceniem rury." },
];

/** Nazwa tematu po id; `null` = temat spoza materiału (albo brak tematu). */
export const topicTitle = (id: string | null): string | null => TOPICS.find((t) => t.id === id)?.title ?? null;

export interface ChecklistItem {
  id: string;
  topic: string;
  text: string;
  /** Punkt krytyczny (⚠ w materiałach): tu najłatwiej o kosztowny błąd. */
  critical?: boolean;
  /** Skutek pominięcia, jeśli materiał go podaje. */
  risk?: string;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: "system-1", topic: "system", text: "Nasza rura to PERTAL² (PE-RT / Al / PE-RT) z wkładką aluminiową, zakres 14–32 mm — grupa UltraLine AL." },
  { id: "system-2", topic: "system", text: "Kształtki są bezoringowe: uszczelnia zaciśnięcie rury na króćcu, a tuleje PVDF są symetryczne." },
  { id: "narzedzia-1", topic: "narzedzia", text: "Tylko oryginalne narzędzia KAN-therm: nożyce do tworzyw, kielichownica z głowicami, praska z widelcami." },
  { id: "narzedzia-2", topic: "narzedzia", text: "Widelce zaciskowe mają osobny komplet na każdą średnicę; głowice dobieramy do rodzaju rury (AL/PE) i średnicy." },
  { id: "laczenie-1", topic: "laczenie", critical: true, text: "Tuleja nasunięta DO OPORU na każdym złączu — sprawdź wzrokowo z obu stron.", risk: "Pominięta lub niedosunięta tuleja = przeciek pod ciśnieniem i zalanie." },
  { id: "laczenie-2", topic: "laczenie", text: "Gdy tuleja z jednej strony nie dolega, powtórz zacisk z zaciskarką obróconą o 180°." },
  { id: "laczenie-3", topic: "laczenie", text: "Rur UltraLine się nie fazuje; tnij prostopadle nożycami do tworzyw." },
  { id: "laczenie-4", topic: "laczenie", text: "Rurę ze zwoju obetnij o ok. 5 cm od końcówki (nie dotyczy sztang)." },
  { id: "kielich-1", topic: "kielichowanie", critical: true, text: "Kielichuj w dwóch fazach: pełny zakres, obrót o ok. 30°, ponownie pełny zakres.", risk: "Wadliwe kielichowanie = nieszczelne połączenie." },
  { id: "kielich-2", topic: "kielichowanie", critical: true, text: "Pęknięcia lub rura nierozkielichowana na pełnym obwodzie: odetnij fragment i kielichuj od nowa." },
  { id: "kielich-3", topic: "kielichowanie", text: "Zaraz po kielichowaniu wsuń kształtkę do ostatniego zgrubienia na króćcu — nie do kołnierza. Bez smarów." },
  { id: "chlod-1", topic: "chlod", text: "Montaż standardowo powyżej 0 °C; końcówkę ogrzej ciepłą wodą lub powietrzem (ścianka maks. 90 °C, bez otwartego ognia)." },
  { id: "mocowanie-1", topic: "mocowanie", critical: true, text: "Woda zimna: haki 6 cm do podłoża, na folii PE na chudziaku lub płycie fundamentowej." },
  { id: "mocowanie-2", topic: "mocowanie", critical: true, text: "Woda ciepła i cyrkulacja: haki 10 cm na pierwszej warstwie styropianu.", risk: "Źle zamocowana rura = brak podparcia, kolizja z warstwami, ryzyko uszkodzenia." },
  { id: "mocowanie-3", topic: "mocowanie", text: "Przejścia przez ściany i stropy prowadź w rurze lub tulei ochronnej." },
  { id: "trojniki-1", topic: "trojniki", critical: true, text: "Przy krzyżowaniu rozsuń trójniki min. 30 cm; trójnik leży na podłożu, rura krzyżująca idzie nad nim.", risk: "Trójnik bez podparcia = pęknięcie złącza pod wylewką = przeciek." },
  { id: "wydluz-1", topic: "wydluzanie", text: "Na długich prostych odcinkach nie mocuj rury na sztywno — kolana i zmiany kierunku przejmują pracę rury." },
  { id: "otulina-1", topic: "otulina", critical: true, text: "Otulina szczelna: dociśnięta na styku i oklejona taśmą.", risk: "Nieszczelna otulina = piana w środku, brak izolacji i swobody ruchu rury." },
  { id: "otulina-2", topic: "otulina", text: "Otulina na rurach ciepłej i cyrkulacji (straty, kondensacja); na zimnej według potrzeb." },
  { id: "otulina-3", topic: "otulina", text: "Nie pomyl ciepłej wody z cyrkulacją przy rozprowadzaniu." },
  { id: "proba-1", topic: "proba-wody", critical: true, text: "Po montażu przepłukaj, potem próba ciśnieniowa — przed zalaniem szlichtą i zakryciem.", risk: "Zakrycie bez próby = ukryty przeciek wykryty dopiero po zalaniu." },
  { id: "proba-2", topic: "proba-wody", text: "Robocza próba na budowie: powietrze, 6 bar; obejdź wszystkie złącza, manometr nie może spadać." },
  { id: "proba-3", topic: "proba-wody", text: "Protokół odbiorowy: 9 bar, zgodnie z wymogami prawa." },
  { id: "proba-4", topic: "proba-wody", text: "Próba wodna: ciśnienie próbne = 1,5 × robocze; przed próbą odłącz armaturę i odpowietrz." },
  { id: "punkty-1", topic: "punkty", text: "Wysokości punktów trzymaj według tabeli G-HEAT (patrz „Ściąga” poniżej)." },
  { id: "punkty-2", topic: "punkty", text: "Średnice według projektu; bez oznaczeń dobierz do przepływów, a w razie wątpliwości zapytaj Grzegorza." },
  { id: "podtynk-1", topic: "podtynk", critical: true, text: "Zapytaj o elementy podtynkowe PRZED wyznaczaniem punktów; jeśli będą — nie rób punktu, czekaj na zestaw od inwestora.", risk: "Punkt pod zestaw podtynkowy = kucie i przeróbki." },
  { id: "piony-1", topic: "piony", text: "Piony 110 z rewizjami w dostępnych miejscach; pion stabilny, z kompensacją wydłużeń." },
  { id: "piony-2", topic: "piony", text: "Podejścia (WC, umywalka, wanna, brodzik, pralka, zmywarka, zlew) we właściwych średnicach i ze spadkami." },
  { id: "spadki-1", topic: "spadki", critical: true, text: "Zachowaj wymagany spadek dla średnicy (typowo ok. 2–3%) i skontroluj go przy trasowaniu.", risk: "Zły spadek = zaleganie i zapychanie albo odrywanie wody." },
  { id: "uszczelki-1", topic: "uszczelki", critical: true, text: "Rura cięta prostopadle i sfazowana; uszczelka w kielichu ze smarem.", risk: "Podwinięta lub sucha uszczelka = przeciek ścieków w ścianie." },
  { id: "napow-1", topic: "napowietrzanie", critical: true, text: "Zapewnij napowietrzenie pionu: wywiewka dachowa lub napowietrzacz (zawór).", risk: "Brak napowietrzenia = wyssanie syfonów i smród z kanalizacji w domu." },
  { id: "proba-kan-1", topic: "proba-kan", critical: true, text: "Próba szczelności na zalanie wodą przed zakryciem; napełnij i sprawdź wszystkie połączenia; protokół.", risk: "Nieszczelne złącze w bruździe = zawilgocenie i zagrzybienie ściany." },
  { id: "dok-1", topic: "dokumentacja", critical: true, text: "Zdjęcia tras i punktów PRZED zakryciem — z miarą lub opisem.", risk: "Brak zdjęć = ryzyko przewiercenia rury przy montażu mebli i AGD." },
  { id: "dok-2", topic: "dokumentacja", text: "Opisz wyjścia i uprzątnij stanowisko; wywóz odpadów jest po stronie inwestora." },
];

/** Tabela wysokości podejść [cm] — standard G-HEAT. `null` = brak wartości w materiale. */
export const HEIGHTS: { point: string; water: number; spacing: number | null; sewer: string | null }[] = [
  { point: "Umywalka", water: 58, spacing: 8, sewer: "50" },
  { point: "Zlewozmywak / kuchnia", water: 48, spacing: 8, sewer: "40" },
  { point: "Pralka", water: 58, spacing: null, sewer: "50" },
  { point: "Wanna", water: 75, spacing: 15, sewer: null },
  { point: "Prysznic", water: 110, spacing: 15, sewer: null },
  { point: "WC (spłuczka)", water: 130, spacing: null, sewer: "wg stelaża" },
];

export interface Question {
  id: string;
  topic: string;
  question: string;
  /** Pierwsza opcja jest poprawna — kolejność miesza `quiz.ts`. */
  options: [string, string, string, string];
  explanation: string;
}

export const QUESTIONS: Question[] = [
  { id: "q-system", topic: "system", question: "Z czego zbudowana jest rura PERTAL², którą stosujemy?", options: ["PE-RT / aluminium / PE-RT", "Jednorodne PE-X bez wkładki", "Miedź w osłonie z PE", "PP-R ze szklanym włóknem"], explanation: "PERTAL² to rura wielowarstwowa z wkładką aluminiową (grupa UltraLine AL). Jednorodne PE-X/PERT² to grupa UltraLine PE — inna rura, te same kształtki." },
  { id: "q-oring", topic: "system", question: "Czym uszczelnia się kształtki UltraLine?", options: ["Zaciśnięciem rury na króćcu — bez o-ringów", "Pierścieniami o-ring z EPDM", "Taśmą teflonową", "Pastą uszczelniającą na gwint"], explanation: "Kształtki są bezoringowe, więc nic się nie starzeje; szczelność daje zaciśnięta rura i tuleja." },
  { id: "q-narzedzia", topic: "narzedzia", question: "Jakich narzędzi używamy do cięcia i łączenia rur UltraLine?", options: ["Tylko oryginalnych narzędzi KAN-therm", "Dowolnych, jeśli są ostre", "Obcinaka do rur miedzianych i zwykłej praski", "Piły do metalu i kielichownicy ogólnej"], explanation: "Nożyce do tworzyw, kielichownica z głowicami i praska z widelcami — tylko oryginalne, osobny komplet widelców na każdą średnicę." },
  { id: "q-tuleja", topic: "laczenie", question: "Jak powinna wyglądać tuleja po zaciśnięciu?", options: ["Dosunięta do oporu, dolega z obu stron", "Zostawiona 2 mm przed kołnierzem", "Zabezpieczona dodatkowo taśmą", "Przesunięta na samą rurę"], explanation: "Pominięta lub niedosunięta tuleja to przeciek pod ciśnieniem i zalanie. Sprawdzaj wzrokowo z obu stron." },
  { id: "q-180", topic: "laczenie", question: "Tuleja z jednej strony nie dolega idealnie. Co robisz?", options: ["Powtarzasz zacisk z zaciskarką obróconą o 180°", "Dobijasz tuleję młotkiem", "Wymieniasz całą rurę", "Dociągasz kluczem nastawnym"], explanation: "Obrót zaciskarki o 180° pozwala dociągnąć przeciwną stronę tulei." },
  { id: "q-faza", topic: "laczenie", question: "Co robimy z końcem rury UltraLine przed złączeniem?", options: ["Tniemy prostopadle i nie fazujemy", "Fazujemy pod kątem 15°", "Gratujemy papierem ściernym i smarujemy", "Podgrzewamy palnikiem"], explanation: "Rur UltraLine się nie fazuje. Fazowanie dotyczy rur kanalizacyjnych z uszczelką w kielichu." },
  { id: "q-zwoj", topic: "laczenie", question: "Rura ze zwoju — ile końcówki obcinamy przed łączeniem?", options: ["Ok. 5 cm", "Ok. 1 cm", "Ok. 20 cm", "Nic, jeśli rura jest czysta"], explanation: "Obcinamy ok. 5 cm końcówki; nie dotyczy sztang." },
  { id: "q-kielich", topic: "kielichowanie", question: "Jak kielichujemy rurę UltraLine?", options: ["W dwóch fazach, z obrotem kielichownicy o ok. 30° między nimi", "Jednym ruchem, pod kątem 45°", "W trzech fazach z obrotem o 90°", "Po podgrzaniu do 150 °C"], explanation: "Faza I — pełny zakres, po rozkielichowaniu obrót o ok. 30°, faza II — ponownie pełny zakres. Głowicę wkładamy do oporu, osiowo." },
  { id: "q-pekniecie", topic: "kielichowanie", question: "Po kielichowaniu widać pęknięcia na brzegu rury. Co dalej?", options: ["Odcinam fragment i kielichuję od nowa", "Zaciskam tuleję mocniej", "Smaruję i montuję", "Oklejam taśmą"], explanation: "Wadliwe kielichowanie to nieszczelne połączenie — wadliwy koniec odcinamy i robimy od nowa." },
  { id: "q-chlod", topic: "chlod", question: "Do jakiej temperatury ścianki wolno ogrzewać końcówkę rury przed kielichowaniem w chłodzie?", options: ["90 °C, bez otwartego ognia", "150 °C palnikiem", "50 °C opalarką", "Nie wolno ogrzewać"], explanation: "Standardowo montujemy powyżej 0 °C; zimną końcówkę ogrzewamy ciepłą wodą lub powietrzem do maks. 90 °C ścianki." },
  { id: "q-haki-zimna", topic: "mocowanie", question: "Jakimi hakami mocujemy rurę wody ZIMNEJ i na jakim podłożu?", options: ["Hakami 6 cm do podłoża, na folii PE na chudziaku", "Hakami 10 cm na styropianie", "Opaskami do ściany", "Bez mocowania, rura leży luzem"], explanation: "Zimna: haki 6 cm KAN-therm do podłoża, na folii PE na chudziaku lub płycie fundamentowej." },
  { id: "q-haki-ciepla", topic: "mocowanie", question: "Jakimi hakami mocujemy wodę CIEPŁĄ i cyrkulację?", options: ["Hakami 10 cm na pierwszej warstwie styropianu", "Hakami 6 cm do podłoża", "Plastikowymi opaskami do zbrojenia", "Klejem montażowym"], explanation: "Ciepła i cyrkulacja: haki 10 cm na pierwszej warstwie styropianu." },
  { id: "q-sciana", topic: "mocowanie", question: "Jak prowadzimy rurę przez ścianę lub strop?", options: ["W rurze lub tulei ochronnej", "Bezpośrednio, obsypując zaprawą", "Zawsze przez otulinę z folii", "Przez kształtkę kątową"], explanation: "Rura w tulei ochronnej nie ulega uszkodzeniu i ma luz do pracy." },
  { id: "q-trojnik", topic: "trojniki", question: "Rury się krzyżują. Jak ustawiasz trójniki?", options: ["Rozsunięte min. 30 cm, leżą na podłożu, rura krzyżująca nad nimi", "Obok siebie, żeby oszczędzić miejsce", "Jeden nad drugim, połączone opaską", "Zawieszone na hakach nad rurą"], explanation: "Żaden trójnik nie może wisieć w powietrzu — bez podparcia złącze pęka pod ciężarem wylewki." },
  { id: "q-wydluzanie", topic: "wydluzanie", question: "Co robisz z długim, prostym odcinkiem rury ciepłej wody?", options: ["Nie mocuję na sztywno na całej długości — zostawiam luz", "Mocuję hakami co 20 cm", "Zalewam betonem bez otuliny", "Skracam odcinek do 1 m"], explanation: "PERTAL² pracuje minimalnie, ale lekki luz pozwala rurze pracować; wydłużenia przejmują kolana i zmiany kierunku." },
  { id: "q-otulina", topic: "otulina", question: "Jak ma wyglądać otulina rur według standardu G-HEAT?", options: ["Szczelna: dociśnięta na styku i oklejona taśmą", "Luźno naciągnięta, bez klejenia", "Tylko na rurze zimnej", "Pomijana na cyrkulacji"], explanation: "Nieszczelna otulina wpuszcza pianę do środka — brak izolacji i swobody ruchu rury." },
  { id: "q-kolejnosc", topic: "proba-wody", question: "W jakiej kolejności przeprowadzasz prace końcowe na instalacji wody?", options: ["Płukanie, próba ciśnieniowa, dopiero potem zakrycie szlichtą", "Zalanie szlichtą, potem próba", "Próba, potem płukanie", "Płukanie po zakryciu"], explanation: "Próba zawsze przed zalaniem szlichtą lub zakryciem — inaczej przeciek wyjdzie po zalaniu." },
  { id: "q-6bar", topic: "proba-wody", question: "Jakie ciśnienie ma robocza próba na budowie, a jakie protokół odbiorowy?", options: ["6 bar powietrzem, protokół 9 bar", "9 bar powietrzem, protokół 6 bar", "3 bar wodą, protokół 6 bar", "6 bar wodą, protokół 12 bar"], explanation: "Na budowie szybka kontrola powietrzem 6 bar; do protokołu próby wpisujemy 9 bar zgodnie z wymogami prawa." },
  { id: "q-15", topic: "proba-wody", question: "Ile wynosi ciśnienie próbne przy próbie wodą według KAN-therm?", options: ["1,5 × ciśnienie robocze", "1,0 × ciśnienie robocze", "2,5 × ciśnienie robocze", "Dokładnie 10 bar"], explanation: "Ppr = 1,5 × ciśnienie robocze. Manometr: zakres +50% od ciśnienia próbnego, podziałka 0,1 bar, w najniższym punkcie." },
  { id: "q-wysokosc", topic: "punkty", question: "Na jakiej wysokości (cm) wyprowadzamy wodę do umywalki?", options: ["58", "48", "75", "110"], explanation: "Umywalka 58 (rozstaw c/z 8, kanalizacja 50). Zlewozmywak 48, wanna 75, prysznic 110, WC 130." },
  { id: "q-prysznic", topic: "punkty", question: "Na jakiej wysokości (cm) jest woda do prysznica i jaki jest rozstaw c/z?", options: ["110 cm, rozstaw 15 cm", "75 cm, rozstaw 8 cm", "130 cm, rozstaw 15 cm", "58 cm, rozstaw 15 cm"], explanation: "Prysznic 110 cm, rozstaw 15 cm. Wanna ma ten sam rozstaw, ale 75 cm." },
  { id: "q-srednice", topic: "punkty", question: "Na projekcie nie ma średnicy na jednym odcinku. Co robisz?", options: ["Dobieram według przepływów, a przy wątpliwości pytam Grzegorza", "Daję najcieńszą rurę", "Wszędzie stosuję 32 mm", "Czekam, aż inwestor dorysuje"], explanation: "Średnice według projektu; gdy ich brakuje — zgodnie z przepływami i fizyką, a w razie wątpliwości pytamy Grzegorza." },
  { id: "q-podtynk", topic: "podtynk", question: "Inwestor planuje baterie podtynkowe. Co z punktem wody?", options: ["Nie robię punktu i czekam na zestaw podtynkowy od inwestora", "Robię punkt na wysokości standardowej", "Robię punkt wyżej o 20 cm", "Zaślepiam i kuję po montażu"], explanation: "Punkt wykonany pod zestaw podtynkowy to kucie i przeróbki. Pytamy o podtynkowe, zanim wyznaczymy wysokości." },
  { id: "q-pion", topic: "piony", question: "Jaką średnicę mają piony kanalizacyjne i co jest w nich w dostępnych miejscach?", options: ["Piony 110, w dostępnych miejscach rewizje (czyszczaki)", "Piony 50, w dostępnych miejscach trójniki", "Piony 160, w dostępnych miejscach zawory", "Piony 75, bez rewizji"], explanation: "Piony 110 z rewizjami w dostępnych miejscach; mocowane obejmami w rozstawach, z kompensacją wydłużeń." },
  { id: "q-spadek", topic: "spadki", question: "Jaki typowy spadek zachowujemy na przewodach kanalizacji?", options: ["Ok. 2–3%", "Ok. 0,2%", "Ok. 10%", "Brak spadku, poziomo"], explanation: "Zły spadek = zaleganie i zapychanie albo odrywanie wody (brak samooczyszczania)." },
  { id: "q-uszczelka", topic: "uszczelki", question: "Dlaczego rurę kanalizacyjną fazujemy przed wsunięciem w kielich?", options: ["Bez sfazowania uszczelka się podwija i przecieka", "Żeby rura była krótsza", "Żeby smar lepiej schnął", "To wymóg estetyczny"], explanation: "Podwinięta lub sucha uszczelka to przeciek ścieków w ścianie. Rura cięta prostopadle, sfazowana, uszczelka ze smarem." },
  { id: "q-napow", topic: "napowietrzanie", question: "Co się dzieje, gdy pion kanalizacyjny nie ma napowietrzenia?", options: ["Wyssanie syfonów i smród z kanalizacji w domu", "Przeciek w kielichach", "Zamarzanie pionu", "Nic, napowietrzenie jest opcjonalne"], explanation: "Zapewniamy wywiewkę dachową lub napowietrzacz (zawór)." },
  { id: "q-proba-kan", topic: "proba-kan", question: "Jak sprawdzamy szczelność kanalizacji przed zakryciem?", options: ["Zalaniem wodą i kontrolą wszystkich połączeń, z protokołem", "Powietrzem 6 bar", "Wzrokowo, bez wody", "Dymem z wytwornicy"], explanation: "Nieszczelne złącze w bruździe to zawilgocenie i zagrzybienie ściany — próba na zalanie przed zakryciem." },
  { id: "q-zdjecia", topic: "dokumentacja", question: "Po co robimy zdjęcia tras i punktów przed zakryciem?", options: ["Żeby nie przewiercić rury przy montażu mebli i AGD", "Do portfolio firmy", "Wymaga tego producent rur", "Żeby inwestor mógł je zwrócić"], explanation: "Zdjęcia z miarą lub opisem ułatwiają późniejsze wiercenie bez przebicia rury." },
];

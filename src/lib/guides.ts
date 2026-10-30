/**
 * Samouczek (2026-10-30): przewodnik na start z wyborem „co Cię interesuje”, osobny przewodnik
 * Pracy (przy pierwszym wejściu) i jednorazowe podpowiedzi w działach. Czyste dane i stan „widziane”;
 * widok w `components/guide/`.
 */

export type GuideArtId =
  | "welcome" | "capture" | "search" | "safe" | "today" | "terms" | "shifts" | "work" | "sync"
  | "journal" | "site" | "points" | "material" | "billing";

export interface GuideStep {
  id: string;
  art: GuideArtId;
  title: string;
  desc: string;
  /** Tekst na telefonie (inne przyciski i gesty); brak = ten sam. */
  phone?: string;
  /** Krótki znacznik na ilustracji, np. „30 dni”. */
  chip?: string;
}

/** Działy do wyboru na pierwszej karcie. Notatki są zawsze. */
export const INTERESTS = [
  { id: "today", label: "Dziś i Terminy" },
  { id: "shifts", label: "Grafik" },
  { id: "work", label: "Praca na budowie" },
] as const;
export type Interest = (typeof INTERESTS)[number]["id"];

const NOTES_STEPS: GuideStep[] = [
  {
    id: "capture", art: "capture", chip: "+", title: "Zapisz myśl w sekundę",
    desc: "Kliknij pole „Zapisz notatkę…” na górze (albo duży + na dole) i po prostu pisz. Zapisuje się samo.",
    phone: "Stuknij duży + na dole i po prostu pisz. Przytrzymaj go, a od razu dodasz listę, zdjęcie albo rysunek. Zapisuje się samo.",
  },
  {
    id: "search", art: "search", chip: "#etykieta", title: "Znajdź wszystko",
    desc: "Wyszukiwarka u góry przeszukuje tytuły i treść. Etykiety i foldery w panelu po lewej porządkują notatki.",
    phone: "Wyszukiwarka u góry przeszukuje tytuły i treść. Foldery i etykiety są w panelu pod ikoną w lewym górnym rogu.",
  },
  {
    id: "safe", art: "safe", chip: "30 dni", title: "Nic nie ginie",
    desc: "Notatkę możesz przypiąć, przenieść do archiwum albo do kosza. Z kosza wraca jednym kliknięciem przez 30 dni.",
    phone: "Przesuń kafel w prawo, żeby go przypiąć, albo w lewo, żeby zarchiwizować. Kosz jest w menu „Więcej”; notatki wracają z niego przez 30 dni.",
  },
];

const INTEREST_STEPS: Record<Interest, GuideStep[]> = {
  today: [
    {
      id: "today", art: "today", chip: "Dziś", title: "Dziś: wszystko na jednym ekranie",
      desc: "Przypomnienia, terminy, zmiana z Grafiku i powtórki z Nauki na ten dzień. Odhaczasz i masz z głowy.",
    },
    {
      id: "terms", art: "terms", chip: "8:00", title: "Terminy i Kalendarz",
      desc: "Dodaj notatce przypomnienie, a trafi do Terminów i do Kalendarza. Powiadomienie przyjdzie o czasie, także offline.",
    },
  ],
  shifts: [
    {
      id: "shifts", art: "shifts", chip: "8–16", title: "Grafik zmian",
      desc: "Wybierz zmianę na palecie i klikaj dni w kalendarzu, tak nanosisz cały miesiąc. Podsumowanie liczy godziny, nadgodziny i zarobek.",
      phone: "Wybierz zmianę na palecie i stukaj dni w kalendarzu, tak nanosisz cały miesiąc. Podsumowanie liczy godziny, nadgodziny i zarobek. Grafik jest w menu „Więcej”.",
    },
  ],
  work: [
    {
      id: "work", art: "work", chip: "budowa", title: "Praca: dziennik budowy",
      desc: "Wpisy z budowy ze zdjęciami, kształtkami i godzinami, karta każdej budowy i raport dla szefa. Przy pierwszym wejściu do Pracy pokażę krótki przewodnik.",
      phone: "Wpisy z budowy ze zdjęciami, kształtkami i godzinami, karta każdej budowy i raport dla szefa. Praca jest w menu „Więcej”; przy pierwszym wejściu pokażę krótki przewodnik.",
    },
  ],
};

const SYNC_STEP: GuideStep = {
  id: "sync", art: "sync", chip: "offline", title: "Twoje dane, Twoje urządzenia",
  desc: "Wszystko działa bez internetu i zostaje na tym urządzeniu. Kopię zrobisz w Ustawienia → Kopia i dane, a drugi telefon połączysz w synchronizacji.",
};

export const WELCOME_STEP: GuideStep = {
  id: "welcome", art: "welcome", title: "Witaj w notkach",
  desc: "Notatki, terminy, grafik i dziennik budowy w jednym zeszycie. Zaznacz, co Cię interesuje, a pokażę tylko to.",
};

/** Karty przewodnika po wyborze działów (kolejność stała, niezależna od kolejności zaznaczania). */
export function tourSteps(interests: ReadonlySet<Interest>): GuideStep[] {
  return [
    ...NOTES_STEPS,
    ...INTERESTS.flatMap((i) => (interests.has(i.id) ? INTEREST_STEPS[i.id] : [])),
    SYNC_STEP,
  ];
}

/** Przewodnik Pracy: od wpisu do rozliczenia, w kolejności dnia na budowie. */
export const WORK_STEPS: GuideStep[] = [
  {
    id: "journal", art: "journal", chip: "+ Wpis", title: "Wpis z budowy",
    desc: "„+ Wpis” otwiera arkusz: rodzaj (zrobione, problem, notatka), tekst albo dyktowanie, zdjęcia, kształtki i rury. Zestawy dodają typowy materiał jednym stuknięciem.",
    phone: "Stuknij + na dole: rodzaj (zrobione, problem, notatka), tekst albo dyktowanie, zdjęcia, kształtki i rury. Zestawy dodają typowy materiał jednym stuknięciem.",
  },
  {
    id: "site", art: "site", chip: "Wchodzę", title: "Karta budowy",
    desc: "Kliknij nazwę budowy w dzienniku. Na górze liczniki: etapy, punkty, braki i to, co trzeba zamówić. „Wchodzę” i „Wychodzę” liczą czas na budowie.",
    phone: "Stuknij nazwę budowy w dzienniku. Na górze liczniki: etapy, punkty, braki i to, co trzeba zamówić. „Wchodzę” i „Wychodzę” liczą czas na budowie.",
  },
  {
    id: "points", art: "points", chip: "Z C K", title: "Punkty w pomieszczeniach",
    desc: "W panelu „Punkty” dodaj łazienkę albo kuchnię z gotowego szablonu. Każdy punkt ma trzy kroki: podejście, próba, biały montaż. Zdjęcie punktu trafia do protokołu odbioru.",
  },
  {
    id: "material", art: "material", chip: "braki", title: "Materiał i zamówienia",
    desc: "Braki zapisane we wpisach zbierają się w karcie budowy. Z nich zrobisz zamówienie do hurtowni, wysłane jako tekst.",
  },
  {
    id: "billing", art: "billing", chip: "zł", title: "Rozliczenie i raport",
    desc: "Panel „Rozliczenie”: godziny, od punktu albo ryczałt, zaliczki i „Zostało do zapłaty”. „Raport” wysyła szefowi podsumowanie dnia albo tygodnia.",
  },
];

// ── Stan „widziane” ───────────────────────────────────────────────────────────────────────────

/** Przewodnik na start (wartość „1” jak dawniej, starsze dane i testy dalej działają). */
export const TOUR_SEEN_KEY = "kaczy.tour.seen.v1";
/** Przewodniki działów i podpowiedzi: `{ "work": 1, "shifts-hint": 1 }`. */
export const GUIDES_SEEN_KEY = "kaczy.guides.seen.v1";
/** Ustawione w testach, które sprawdzają samo pokazywanie się podpowiedzi. */
export const GUIDES_FORCE_KEY = "kaczy.guides.force";

export type GuideId = "work" | "shifts-hint";

function readSeen(): Record<string, unknown> {
  try {
    const v = JSON.parse(localStorage.getItem(GUIDES_SEEN_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function guideSeen(id: GuideId): boolean {
  return readSeen()[id] === 1;
}

export function markGuideSeen(id: GuideId): void {
  try { localStorage.setItem(GUIDES_SEEN_KEY, JSON.stringify({ ...readSeen(), [id]: 1 })); } catch { /* prywatne okno */ }
}

/**
 * Czy pokazać przewodnik działu sam z siebie. Nie w automatycznych testach (`navigator.webdriver`),
 * bo okno zasłoniłoby ekran w setkach testów e2e; testy samouczka ustawiają `GUIDES_FORCE_KEY`.
 */
export function shouldAutoShow(id: GuideId, env: { webdriver: boolean; forced: boolean } = autoEnv()): boolean {
  if (env.webdriver && !env.forced) return false;
  return !guideSeen(id);
}

function autoEnv() {
  let forced = false;
  try { forced = localStorage.getItem(GUIDES_FORCE_KEY) === "1"; } catch { /* brak dostępu */ }
  return { webdriver: typeof navigator !== "undefined" && navigator.webdriver === true, forced };
}

/** Otwiera przewodnik z dowolnego miejsca (menu, karta przewodnika na start). */
export const GUIDE_EVENT = "kaczy:guide";
export const openGuide = (id: GuideId) => window.dispatchEvent(new CustomEvent(GUIDE_EVENT, { detail: id }));

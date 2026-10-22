import type { ShiftData } from "@/lib/shifts/model";
import { currentAndNextShift, recentlyEndedShift } from "@/lib/shifts/summary";
import { NEUROKLIK_URL } from "@/lib/neuroklik";

export { NEUROKLIK_URL };

/**
 * Neuroklik (codzienny trening mózgu, osobna aplikacja www) na stronie „Dziś”. Notatnik nie ma
 * dostępu do jej danych — karta tylko otwiera stronę i pozwala ustawić przypomnienie na właściwą porę.
 */

/** Przed zmianą — rozgrzewka w tym oknie; po zmianie — odpoczynek w tym oknie. */
export const BEFORE_SHIFT_MS = 3 * 60 * 60 * 1000;
export const AFTER_SHIFT_MS = 2 * 60 * 60 * 1000;

export interface BrainPlan {
  /** Co widać na karcie: przed pracą, w pracy, po pracy albo dzień wolny. */
  mode: "before" | "working" | "after" | "free";
  title: string;
  body: string;
  /** Kiedy przypomnieć (ms), albo `null` — bez przypomnienia. */
  remindAt: number | null;
  remindLabel: string | null;
}

const HM = (d: Date) => d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

/** Plan treningu względem dzisiejszej zmiany z Grafiku; `now` z zewnątrz, żeby test był deterministyczny. */
export function brainPlan(data: ShiftData, now: Date): BrainPlan {
  const { current, next } = currentAndNextShift(data, now);
  if (current) {
    return {
      mode: "working",
      title: "Trening mózgu po zmianie",
      body: `Zmiana trwa do ${HM(current.end)}. Krótka sesja zostaje na po pracy.`,
      remindAt: current.end.getTime() + 10 * 60_000,
      remindLabel: `Trening mózgu po zmianie (${HM(current.end)})`,
    };
  }
  if (next && next.start.getTime() - now.getTime() <= BEFORE_SHIFT_MS && next.start.toDateString() === now.toDateString()) {
    return {
      mode: "before",
      title: "Rozgrzewka przed pracą",
      body: `Zmiana o ${HM(next.start)}. Kilka minut treningu rozgrzeje głowę przed pracą.`,
      remindAt: next.start.getTime() - 30 * 60_000,
      remindLabel: `Rozgrzewka przed pracą (${HM(next.start)})`,
    };
  }
  const ended = recentlyEndedShift(data, now, AFTER_SHIFT_MS);
  if (ended) {
    return {
      mode: "after",
      title: "Trening po pracy",
      body: `Zmiana skończyła się o ${HM(ended.end)}. Lekki trening na wyciszenie po pracy.`,
      remindAt: null,
      remindLabel: null,
    };
  }
  return {
    mode: "free",
    title: "Codzienny trening mózgu",
    body: "Dziś bez zmiany w grafiku — dobra pora na codzienny trening.",
    remindAt: null,
    remindLabel: null,
  };
}

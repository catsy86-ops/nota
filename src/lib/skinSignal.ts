/**
 * Jednorazowy sygnał stylu (plan rozbudowy, Faza 1b): „zapisano”. Ustawia
 * `html[data-sig]` na chwilę, a CSS w `styles/skins/signatures.css` odpala sygnał właściwego stylu
 * (Miedź — para, Hydraulika — fala). Po czasie atrybut znika, więc kolejny zapis
 * odpala animację od nowa (wymuszony przerysunek między usunięciem a dodaniem).
 */
/** „save” — zapis notatki; „view” — zmiana widoku (przewrót kartki, kaskada); „dawn” — pierwsze uruchomienie dnia. */
export type SkinSignal = "save" | "view" | "dawn" | "pin" | "skin";

/** Dłużej niż najdłuższa sygnatura (`--sig-dur` + opóźnienie), krócej niż kolejny zapis. */
export const SKIN_SIGNAL_MS = 1400;

let timer: ReturnType<typeof setTimeout> | undefined;

export function pulseSkinSignal(signal: SkinSignal, root: HTMLElement = document.documentElement): void {
  root.removeAttribute("data-sig");
  void root.offsetWidth; // przerysunek: bez tego przeglądarka nie wznowi animacji
  root.dataset.sig = signal;
  clearTimeout(timer);
  timer = setTimeout(() => root.removeAttribute("data-sig"), SKIN_SIGNAL_MS);
}

export const DAWN_KEY = "kaczy.sig.dawn.v1";

/** Pierwsze uruchomienie aplikacji danego dnia — Neon rozbłyskuje nagłówek. Zwraca `true`, gdy odpalono. */
export function pulseDawnIfNewDay(today: Date = new Date(), root?: HTMLElement): boolean {
  const day = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  try {
    if (localStorage.getItem(DAWN_KEY) === day) return false;
    localStorage.setItem(DAWN_KEY, day);
  } catch {
    return false; // bez pamięci nie ma „pierwszego” uruchomienia — cicho pomijamy
  }
  pulseSkinSignal("dawn", root);
  return true;
}

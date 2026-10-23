/**
 * Jednorazowy sygnał stylu (plan rozbudowy, Faza 1b): „zapisano”. Ustawia
 * `html[data-sig]` na chwilę, a CSS w `skins.css` odpala sygnał właściwego stylu
 * (Miedź — para, Hydraulika — fala). Po czasie atrybut znika, więc kolejny zapis
 * odpala animację od nowa (wymuszony przerysunek między usunięciem a dodaniem).
 */
export type SkinSignal = "save";

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

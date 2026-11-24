import { createPersistedStore } from "@/lib/persistedStore";
import { PRACA } from "@/lib/storage/names";
import type { UsageMap } from "@/lib/study/usage";

/**
 * R4.1 (decyzja PR-3): tryb jednej ręki na zakładce Budowa. Domyślnie wyłączony; po kilku wpisach
 * zrobionych na tym urządzeniu aplikacja raz proponuje jego włączenie. Tylko to urządzenie.
 */
export const ONE_HAND_KEY = PRACA.oneHand;
export const ONE_HAND_OFFERED_KEY = PRACA.oneHandOffered;
/** Tyle wpisów (licznik `wpis`) musi być na tym telefonie, zanim padnie propozycja. */
export const ONE_HAND_OFFER_AFTER = 5;

export const oneHandStore = createPersistedStore<boolean>(ONE_HAND_KEY, false, {
  merge: (def, stored) => (typeof stored === "boolean" ? stored : def),
});
/** `true` po tym, jak właściciel odpowiedział na propozycję (tak albo nie) — pytamy tylko raz. */
export const oneHandOfferedStore = createPersistedStore<boolean>(ONE_HAND_OFFERED_KEY, false, {
  merge: (def, stored) => (typeof stored === "boolean" ? stored : def),
});

export const setOneHand = (on: boolean) => {
  oneHandStore.set(on);
  oneHandOfferedStore.set(true);
};
export const dismissOneHandOffer = () => oneHandOfferedStore.set(true);
export const useOneHand = () => oneHandStore.use();
export const useOneHandOffered = () => oneHandOfferedStore.use();

/** Czy pokazać propozycję: dotyk, jeszcze nie pytane, tryb wyłączony i dość wpisów w liczniku. */
export function shouldOfferOneHand(opts: { usage: UsageMap; enabled: boolean; offered: boolean; touch: boolean }): boolean {
  if (!opts.touch || opts.enabled || opts.offered) return false;
  return (opts.usage.wpis?.n ?? 0) >= ONE_HAND_OFFER_AFTER;
}

import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Czarne tło w ciemnym schemacie (plan motywów 3.3, „OLED”): na ekranach OLED czerń to zgaszony piksel,
 * więc to oszczędność baterii, a na słońcu lepszy kontrast kart. Per urządzenie.
 * CSS: `html[data-oled="on"]` w `src/index.css` — nadpisuje tło tylko w ciemnym schemacie.
 */
const KEY = "kaczy.oled.v1";

function applyToDom(on: boolean) {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.oled = "on";
  else delete document.documentElement.dataset.oled;
}

const store = createPersistedStore<boolean>(KEY, false, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

export const useOled = () => store.use();
export const setOled = (on: boolean) => store.set(on);
export const oledOn = () => store.get();

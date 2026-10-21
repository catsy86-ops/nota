/**
 * Jedyne miejsce rejestracji service workera aplikacji.
 * Nigdy nie rejestruje w dev ani w iframe (`?sw=off` też wyłącza).
 */
import { hasUnsavedWork } from "@/lib/saveStatus";

const SW_URL = "/sw.js";

/** Co tyle sprawdzamy, czy jest nowa wersja, gdy karta stoi otwarta. */
export const UPDATE_CHECK_MS = 60 * 60_000;

/**
 * Czy oczekującą wersję można już podmienić bez straty: karta jest schowana (użytkownik wyszedł)
 * i nic nie czeka na zapis. Wtedy reload nie zabierze żadnej pracy.
 */
export function canApplyWaitingUpdate(state: { hidden: boolean; unsaved: boolean; waiting: boolean }): boolean {
  return state.waiting && state.hidden && !state.unsaved;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* noop */
  }
}

/**
 * Dispatched on window when a new service worker is installed and waiting
 * to activate. The app should ask the user before reloading, since an
 * unsaved edit could be sitting in memory (data itself is safe in
 * IndexedDB regardless).
 */
export const SW_UPDATE_EVENT = "kaczy:sw-update-available";

let reloadingAfterUpdate = false;

/** Tell the waiting worker to take over. Reloads once it does. */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration) {
  const waiting = registration.waiting;
  if (!waiting) return;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

function watchForUpdates(registration: ServiceWorkerRegistration, hadControllerAtLoad: boolean) {
  const notifyIfWaiting = () => {
    if (registration.waiting) {
      window.dispatchEvent(new CustomEvent(SW_UPDATE_EVENT, { detail: registration }));
    }
  };
  notifyIfWaiting();

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      // Pierwsza instalacja (gotowość offline) przechodzi po cichu — to był
      // kolejny dymek w chwili, gdy ktoś dopiero poznaje aplikację.
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        notifyIfWaiting();
      }
    });
  });

  // Oczekująca wersja podmienia się sama, gdy użytkownik wychodzi z aplikacji i nie ma
  // niezapisanych zmian. Przy otwartej karcie zostaje dymek „Dostępna nowa wersja”.
  document.addEventListener("visibilitychange", () => {
    const hidden = document.visibilityState === "hidden";
    if (canApplyWaitingUpdate({ hidden, unsaved: hasUnsavedWork(), waiting: !!registration.waiting })) {
      applyServiceWorkerUpdate(registration);
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Pierwsze wejście: strona startuje bez kontrolera, a `clientsClaim: true`
    // sprawia, że świeżo aktywowany worker ją przejmuje — `controllerchange`
    // leci więc także wtedy, gdy NIC się nie zaktualizowało. Przeładowanie
    // w tym momencie wyrzucałoby użytkownika z aplikacji sekundę po wejściu.
    // Reload ma sens wyłącznie przy podmianie workera, który już nas
    // kontrolował, czyli przy prawdziwej aktualizacji.
    if (!hadControllerAtLoad) return;
    if (reloadingAfterUpdate) return;
    reloadingAfterUpdate = true;
    window.location.reload();
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const swOff = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || swOff) {
    void unregisterAppSW();
    return;
  }

  // Zapamiętane przed rejestracją: po niej kontroler może się już pojawić.
  const hadControllerAtLoad = !!navigator.serviceWorker.controller;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((registration) => {
        watchForUpdates(registration, hadControllerAtLoad);
        // Zainstalowana PWA bywa tygodniami „w tle”: po powrocie do aplikacji sprawdź nową wersję (co ≥30 min),
        // a gdy karta stoi otwarta, co godzinę. `update()` offline się nie udaje — to nic nie szkodzi.
        const checkForUpdate = () => { registration.update().catch(() => { /* offline */ }); };
        let lastCheck = Date.now();
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState !== "visible" || Date.now() - lastCheck < 30 * 60_000) return;
          lastCheck = Date.now();
          checkForUpdate();
        });
        setInterval(checkForUpdate, UPDATE_CHECK_MS);
      })
      .catch(() => {
        /* noop */
      });
  });
}

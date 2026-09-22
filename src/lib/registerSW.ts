/**
 * Jedyne miejsce rejestracji service workera aplikacji.
 * Nigdy nie rejestruje w dev, w iframe ani w podglądzie Lovable.
 */
const SW_URL = "/sw.js";

function isBlockedHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
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

function watchForUpdates(registration: ServiceWorkerRegistration) {
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
      if (installing.state === "installed" && navigator.serviceWorker.controller) {
        notifyIfWaiting();
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingAfterUpdate) return;
    reloadingAfterUpdate = true;
    window.location.reload();
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const inIframe = window.self !== window.top;
  const swOff = new URLSearchParams(window.location.search).get("sw") === "off";

  if (!import.meta.env.PROD || inIframe || swOff || isBlockedHost(window.location.hostname)) {
    void unregisterAppSW();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((registration) => watchForUpdates(registration))
      .catch(() => {
        /* noop */
      });
  });
}

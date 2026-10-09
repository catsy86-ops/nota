import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "./index.css";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT, SW_OFFLINE_READY_EVENT } from "./lib/registerSW";
import { requestPersistentStorage } from "./lib/storagePersistence";
import { installGlobalDiagHandlers } from "./lib/diagnostics";

installGlobalDiagHandlers();

// TYMCZASOWE: pomiar kosztu rozmycia tła na telefonie. `?noblur` wyłącza, `?noblur=0` przywraca;
// wybór trwa do zamknięcia karty, bo nawigacja w aplikacji gubi parametr.
try {
  const param = new URLSearchParams(location.search).get("noblur");
  if (param !== null) sessionStorage.setItem("kaczy:noblur", param === "0" ? "0" : "1");
  if (sessionStorage.getItem("kaczy:noblur") === "1") document.documentElement.classList.add("noblur");
} catch { /* bez sessionStorage — zostaje rozmycie */ }

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();
void requestPersistentStorage();

window.addEventListener(SW_UPDATE_EVENT, (e) => {
  const registration = (e as CustomEvent<ServiceWorkerRegistration>).detail;
  toast("Dostępna nowa wersja aplikacji", {
    description: "Twoje notatki są bezpieczne — zapisane dane nie zostaną utracone.",
    duration: Infinity,
    action: {
      label: "Odśwież",
      onClick: () => applyServiceWorkerUpdate(registration),
    },
  });
});

window.addEventListener(SW_OFFLINE_READY_EVENT, () => {
  toast.success("NOTKI działają teraz offline", {
    description: "Aplikacja jest zapisana na urządzeniu — otworzysz ją także bez internetu.",
  });
});

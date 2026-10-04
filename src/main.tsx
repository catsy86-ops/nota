import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/inter";
import "@fontsource-variable/unbounded/wght.css";
import "./index.css";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT, SW_OFFLINE_READY_EVENT } from "./lib/registerSW";
import { requestPersistentStorage } from "./lib/storagePersistence";
import { installGlobalDiagHandlers } from "./lib/diagnostics";

installGlobalDiagHandlers();

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

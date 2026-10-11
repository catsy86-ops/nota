import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@/lib/inputModality";
import "@fontsource-variable/plus-jakarta-sans";
// Cyfry o stałej szerokości (rachunek w Grafiku); `wght.css` bez kursywy.
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT } from "./lib/registerSW";
import { requestPersistentStorage } from "./lib/storagePersistence";
import { installGlobalDiagHandlers } from "./lib/diagnostics";
import { startTabSync } from "./lib/tabSync";
import { yjsStore } from "./lib/yjsStore";
import { hideBootSplash } from "./lib/bootSplash";
import { installKeyboardInset } from "./lib/keyboardInset";

installGlobalDiagHandlers();
installKeyboardInset();

// Zmiany notatek i Grafiku od razu w innych kartach tej przeglądarki, także bez P2P.
startTabSync(yjsStore.doc, "kaczy-yjs-v1", yjsStore.ready(), yjsStore.isPersistenceOrigin);

createRoot(document.getElementById("root")!).render(<App />);
hideBootSplash(yjsStore.ready());

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


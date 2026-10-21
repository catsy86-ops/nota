import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@/lib/inputModality";
import "@fontsource-variable/plus-jakarta-sans";
// Cyfry o stałej szerokości (rachunek w Grafiku); `wght.css` bez kursywy.
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";
// Kroje stylów (Ustawienia → Wygląd). @font-face pobiera plik dopiero, gdy styl go użyje.
import "@fontsource/barlow-condensed/600.css";
import "@fontsource-variable/unbounded/wght.css";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "./styles/skins.css";
// Kroje tekstu do wyboru (Wygląd → „Krój tekstu”) — plik pobiera się dopiero po wyborze.
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/nunito/wght.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "@fontsource-variable/literata/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/lexend/wght.css";
import "./styles/fonts.css";
import "./styles/site.css";
// Tryb budowa ustawia `html[data-site]` przy imporcie — przed pierwszym malowaniem.
import "./lib/siteMode";
import "./lib/appFont";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT } from "./lib/registerSW";
import { hasUnsavedWork } from "./lib/saveStatus";
import { setupFileLaunch } from "./lib/fileLaunch";
import { requestPersistentStorage } from "./lib/storagePersistence";
import { installGlobalDiagHandlers } from "./lib/diagnostics";
import { startTabSync } from "./lib/tabSync";
import { yjsStore } from "./lib/yjsStore";
import { hideBootSplash } from "./lib/bootSplash";
import { installKeyboardInset } from "./lib/keyboardInset";
import { installPageHidden } from "./lib/pageHidden";

installGlobalDiagHandlers();
installKeyboardInset();
installPageHidden();

// Zmiany notatek i Grafiku od razu w innych kartach tej przeglądarki, także bez P2P.
startTabSync(yjsStore.doc, "kaczy-yjs-v1", yjsStore.ready(), yjsStore.isPersistenceOrigin);

createRoot(document.getElementById("root")!).render(<App />);
hideBootSplash(yjsStore.ready());

registerServiceWorker();
setupFileLaunch();
void requestPersistentStorage();

window.addEventListener(SW_UPDATE_EVENT, (e) => {
  const registration = (e as CustomEvent<ServiceWorkerRegistration>).detail;
  toast("Dostępna nowa wersja aplikacji", {
    description: "Twoje notatki są bezpieczne — zapisane dane nie zostaną utracone.",
    duration: Infinity,
    action: {
      label: "Odśwież",
      // Z niezapisaną pracą przeładowanie zgubiłoby ją: najpierw zapis, potem wersja.
      onClick: () => {
        if (hasUnsavedWork()) {
          toast("Poczekaj, aż zapisze się ostatnia zmiana", { description: "Wtedy wersja podmieni się bez utraty tekstu." });
          return;
        }
        applyServiceWorkerUpdate(registration);
      },
    },
  });
});


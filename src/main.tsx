import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "@/lib/inputModality";
import "./styles/fonts-latin/@fontsource-variable-plus-jakarta-sans-index.css";
// Cyfry o stałej szerokości (rachunek w Grafiku); `wght.css` bez kursywy.
import "./styles/fonts-latin/@fontsource-variable-jetbrains-mono-wght.css";
import "./index.css";
// Kroje stylów (Ustawienia → Wygląd). @font-face pobiera plik dopiero, gdy styl go użyje.
import "./styles/fonts-latin/@fontsource-barlow-condensed-600.css";
import "./styles/fonts-latin/@fontsource-variable-unbounded-wght.css";
import "./styles/fonts-latin/@fontsource-variable-fraunces-soft.css";
import "./styles/fonts-latin/@fontsource-variable-bricolage-grotesque-wght.css";
import "./styles/skins.css";
import "./styles/accents.css";
import "./styles/backdrop.css";
import "./styles/shape.css";
// Kroje tekstu do wyboru (Wygląd → „Krój tekstu”) — plik pobiera się dopiero po wyborze.
import "./styles/fonts-latin/@fontsource-variable-inter-wght.css";
import "./styles/fonts-latin/@fontsource-variable-nunito-wght.css";
import "./styles/fonts-latin/@fontsource-variable-atkinson-hyperlegible-next-wght.css";
import "./styles/fonts-latin/@fontsource-variable-literata-wght.css";
import "./styles/fonts-latin/@fontsource-variable-manrope-wght.css";
import "./styles/fonts-latin/@fontsource-variable-lexend-wght.css";
import "./styles/fonts.css";
import "./styles/site.css";
// Rozmiar tekstu wybrany w Ustawieniach (`--text-scale`); przed preferencjami systemu.
import "./styles/text-size.css";
// Preferencje systemu (3.12): ostatni, bo nadpisuje tokeny motywów i rozmycia.
import "./styles/preferences.css";
// Tryb budowa ustawia `html[data-site]` przy imporcie — przed pierwszym malowaniem.
import "./lib/siteMode";
import "./lib/appFont";
import "./lib/textSize";
// Tło, kształt i akcent (plan motywów 1.3, 1.2, 1.1) — atrybuty na <html> przed pierwszym malowaniem.
import "./lib/backdrop";
import "./lib/shape";
import "./lib/accent";
// Ramki i poświaty (Wygląd) nakładane już przy starcie, nie dopiero po otwarciu Ustawień.
import "./lib/frameLook";
import "./lib/glowLook";
// Styl na noc (plan motywów 1.4): przełącza styl o zadanej porze, także zaraz po starcie.
import "./lib/skinSchedule";
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
// Pomiar INP/CLS tylko w dev (plan UI/UX 0.4): w produkcji blok znika z paczki.
if (import.meta.env.DEV) void import("./lib/perfProbe").then((m) => m.installPerfProbe());

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


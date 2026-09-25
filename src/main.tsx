import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT } from "./lib/registerSW";

createRoot(document.getElementById("root")!).render(<App />);

registerServiceWorker();

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

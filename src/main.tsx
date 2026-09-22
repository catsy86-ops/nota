import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker, applyServiceWorkerUpdate, SW_UPDATE_EVENT } from "./lib/registerSW";
import { QUEUE_DATA_LOST_EVENT } from "./lib/offlineQueue";

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

window.addEventListener(QUEUE_DATA_LOST_EVENT, () => {
  toast.error("Nie udało się zapisać części zmian", {
    description: "Pamięć przeglądarki była pełna (m.in. duże obrazy). Sprawdź swoje notatki i rozważ usunięcie nieużywanych zdjęć.",
    duration: 15000,
  });
});

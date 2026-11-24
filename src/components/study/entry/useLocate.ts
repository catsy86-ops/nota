import { useState } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { cleanGeo, type GeoPoint } from "@/lib/study/geo";

/** „Tu jestem”: pozycja tylko po stuknięciu, nigdy w tle; widać ją w aplikacji, raport jej nie zawiera. */
export function useLocate(onGeo: (g: GeoPoint) => void) {
  const [locating, setLocating] = useState(false);

  function locate() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("Ta przeglądarka nie udostępnia lokalizacji");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const g = cleanGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        if (!g) return;
        onGeo(g);
        haptic("success");
      },
      (err) => {
        setLocating(false);
        haptic("warn");
        toast.error(err.code === err.PERMISSION_DENIED
          ? "Brak zgody na lokalizację — włącz ją w ustawieniach przeglądarki"
          : "Nie udało się ustalić lokalizacji — spróbuj bliżej okna albo na zewnątrz");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return { locating, locate };
}

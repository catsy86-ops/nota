import { useEffect, useState } from "react";
import { imageStore } from "@/lib/imageStore";
import { checkStoredPlanImage } from "@/lib/plans/imageSniff";
import type { PlanImage } from "@/lib/plans/model";

/**
 * Adres obrazu planu do `<image>`/`<img>` — dopiero po sprawdzeniu bajtów (`checkStoredPlanImage`):
 * typ, limity i wymiary zgodne z analizą. `undefined` — wczytywanie, `null` — bajtów nie ma na
 * urządzeniu, `"bad"` — bajty niezgodne z analizą (nie dekodujemy ich).
 */
export function usePlanImageUrl(image: PlanImage | undefined): string | null | undefined | "bad" {
  const [url, setUrl] = useState<string | null | undefined | "bad">(undefined);
  const ref = image?.ref ?? "";
  const w = image?.w ?? 0, h = image?.h ?? 0;
  useEffect(() => {
    if (!ref) { setUrl(null); return; }
    let cancelled = false;
    let acquired = false;
    setUrl(undefined);
    const load = async () => {
      const rec = await imageStore.get(ref);
      if (cancelled) return;
      if (!rec) { setUrl(null); return; }
      if (!checkStoredPlanImage(rec.bytes, { w, h })) { setUrl("bad"); return; }
      const u = await imageStore.acquireUrl(ref);
      if (cancelled) { if (u) imageStore.releaseUrl(ref); return; }
      acquired = !!u;
      setUrl(u);
    };
    void load();
    const off = imageStore.onAdded((hash) => { if (hash === ref && !acquired && !cancelled) void load(); });
    return () => { cancelled = true; off(); if (acquired) imageStore.releaseUrl(ref); };
  }, [ref, w, h]);
  return url;
}

import { useEffect, useState } from "react";
import { imageStore, isDataUrl } from "@/lib/imageStore";

/**
 * Adres do `<img src>` dla klucza z `imageStore` (współdzielony object URL,
 * zwalniany przy odmontowaniu). `null` — obrazu jeszcze nie ma na tym
 * urządzeniu; hook sam podmieni adres, gdy dotrze (P2P, plik sync).
 * `undefined` — trwa wczytywanie. `thumb`: miniatura (siatki, paski, listy) zamiast pełnego obrazu.
 */
export function useImageUrl(imageRef: string, thumb = false): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(() => (isDataUrl(imageRef) ? imageRef : undefined));

  useEffect(() => {
    if (isDataUrl(imageRef)) { setUrl(imageRef); return; }
    let cancelled = false;
    let acquired = false;
    setUrl(undefined);

    const acquire = () => {
      (thumb ? imageStore.acquireThumbUrl(imageRef) : imageStore.acquireUrl(imageRef)).then((u) => {
        if (!u) { if (!cancelled) setUrl(null); return; }
        if (cancelled) { (thumb ? imageStore.releaseThumbUrl : imageStore.releaseUrl)(imageRef); return; }
        acquired = true;
        setUrl(u);
      });
    };
    acquire();
    const off = imageStore.onAdded((hash) => { if (hash === imageRef && !acquired && !cancelled) acquire(); });

    return () => {
      cancelled = true;
      off();
      if (acquired) (thumb ? imageStore.releaseThumbUrl : imageStore.releaseUrl)(imageRef);
    };
  }, [imageRef, thumb]);

  return url;
}

import { useEffect, useState } from "react";
import { imageStore } from "@/lib/imageStore";

export type AttachmentBlobState = "loading" | "present" | "missing";

/**
 * Czy bajty załącznika są na tym urządzeniu. Manifest synchronizuje się z
 * notatką od razu, bajty mogą dotrzeć później (P2P, plik sync) albo wcale
 * (plik większy niż limit synchronizacji) — hook sam przełącza stan.
 */
export function useAttachmentBlob(hash: string): AttachmentBlobState {
  const [state, setState] = useState<AttachmentBlobState>(() => (imageStore.has(hash) ? "present" : "loading"));

  useEffect(() => {
    let cancelled = false;
    if (imageStore.has(hash)) setState("present");
    else {
      setState("loading");
      void imageStore.load().then(() => { if (!cancelled) setState(imageStore.has(hash) ? "present" : "missing"); });
    }
    const off = imageStore.onAdded((h) => { if (h === hash && !cancelled) setState("present"); });
    return () => { cancelled = true; off(); };
  }, [hash]);

  return state;
}

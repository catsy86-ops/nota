import { useEffect, useState } from "react";
import { formatFileSize } from "@/lib/attachments";
import { imageSize, measure, siteStorageRefs } from "@/lib/study/siteStorage";
import type { SiteInfo } from "@/lib/study/sites";
import type { JournalEntry } from "@/lib/study/yStudy";

/**
 * P3.1: „Zdjęcia i nagrania: 120 MB” w karcie budowy. Liczone po otwarciu karty, w tle —
 * zdjęcia trzeba odczytać z magazynu, więc nie przy każdym renderze.
 */
export function SiteStorageLine({ site, journal }: { site: SiteInfo; journal: JournalEntry[] }) {
  const [bytes, setBytes] = useState<number | null>(null);
  const refs = siteStorageRefs(journal, site);
  const key = [...refs.keys()].sort().join(",");
  useEffect(() => {
    let alive = true;
    setBytes(null);
    void measure(siteStorageRefs(journal, site), imageSize).then((n) => { if (alive) setBytes(n); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (refs.size === 0) return null;
  return (
    <p className="col-span-2 text-center text-xs text-muted-foreground tabular-nums" data-testid="site-storage">
      Zdjęcia, nagrania i dokumenty: {bytes === null ? "liczę…" : formatFileSize(bytes)}
    </p>
  );
}

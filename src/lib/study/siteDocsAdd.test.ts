import { describe, it, expect } from "vitest";
import { addSiteDocFiles } from "./siteDocsAdd";
import { SITE_DOCS_MAX, type SiteDoc } from "./siteDocs";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("addSiteDocFiles: odrzucenia i limity", () => {
  it("pliki innych typów są pominięte z wyjaśnieniem, nic nie trafia do listy", async () => {
    const res = await addSiteDocFiles([file("notatki.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")], []);
    expect(res.added).toEqual([]);
    expect(res.message).toContain("notatki.docx (tylko zdjęcia i PDF)");
  });

  it("przy pełnej liście obrazy są pominięte z podaniem limitu, bez wywołania magazynu", async () => {
    const full: SiteDoc[] = Array.from({ length: SITE_DOCS_MAX }, (_, i) => ({ id: `d${i}`.padEnd(64, "0"), name: `p${i}.pdf`, size: 1, type: "application/pdf", at: i }));
    const res = await addSiteDocFiles([file("plan.jpg", "image/jpeg")], full);
    expect(res.added).toEqual([]);
    expect(res.message).toContain(`plan.jpg (limit ${SITE_DOCS_MAX} plików)`);
  });

  it("brak plików to brak wyniku i brak komunikatu", async () => {
    expect(await addSiteDocFiles([], [])).toEqual({ added: [], message: null });
  });
});

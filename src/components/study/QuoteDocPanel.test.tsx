import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { QuoteDocPanel } from "./QuoteDocPanel";
import { SiteJobPanel } from "./SiteJobPanel";
import { getJobs, saveQuoteItem, setJobMeta, setQuoteDoc, useJob } from "@/lib/study/jobsStore";
import { setQuoteTerms } from "@/lib/study/companyPrefs";
import { getTemplates, saveTemplate, setFittingPrice, setPricing } from "@/lib/study/pricingStore";
import { yjsStore } from "@/lib/yjsStore";
import type { SiteInfo } from "@/lib/study/sites";

const SITE = "s1";
const doc = () => getJobs().get(SITE)?.doc;

function Host({ signed = false, onSign = () => {} }: { signed?: boolean; onSign?: () => void }) {
  const job = useJob(SITE);
  return job ? <QuoteDocPanel siteId={SITE} job={job} signed={signed} onSign={onSign} /> : null;
}

const site = { id: SITE, name: "Lipowa 5", address: "", investor: "Jan", created: 1, stored: true, count: 0, open: 0, first: null, last: null } as SiteInfo;
function Panel() {
  const job = useJob(SITE);
  return job ? <SiteJobPanel site={site} job={job} onSign={() => {}} /> : null;
}

beforeEach(async () => {
  localStorage.clear();
  toastMock.mockClear();
  toastMock.error.mockClear();
  toastMock.success.mockClear();
  await yjsStore.resetForTests();
  setJobMeta(SITE, { status: "quote" });
  saveQuoteItem(SITE, { id: "q1", kind: "labor", name: "Montaż", qty: 2, unit: "usł.", price: 500, order: 0 });
});
afterEach(() => cleanup());

describe("QuoteDocPanel: numer i stan (3.1, 3.5)", () => {
  it("nowa wycena to szkic bez numeru; „Nadaj numer” daje W/A/rok/001 i datę, ważność liczy się sama", () => {
    render(<Host />);
    expect(screen.getByTestId("quote-state")).toHaveTextContent("Szkic");
    expect(screen.queryByLabelText("Wycena ważna do")).toBeNull();
    fireEvent.click(screen.getByTestId("quote-give-number"));
    expect(screen.getByTestId("quote-number")).toHaveTextContent(/^W\/A\/\d{4}\/001 · \d{2}\.\d{2}\.\d{4}$/);
    expect(screen.queryByTestId("quote-give-number")).toBeNull();
    // Ważność domyślna (+14 dni) nie jest zapisywana — nadanie numeru nie zmienia treści dla klienta.
    expect(doc()?.validUntil).toBeUndefined();
    expect((screen.getByLabelText("Wycena ważna do") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("zmiana „ważna do” zapisuje datę", () => {
    render(<Host />);
    fireEvent.click(screen.getByTestId("quote-give-number"));
    fireEvent.change(screen.getByLabelText("Wycena ważna do"), { target: { value: "2099-01-31" } });
    expect(doc()?.validUntil).toBe("2099-01-31");
  });

  it("„Klient przyjął” nadaje numer i ustawia stan; „odrzucił” pojawia się dopiero po wysłaniu albo rozstrzygnięciu", () => {
    render(<Host />);
    expect(screen.queryByTestId("quote-reject")).toBeNull();
    fireEvent.click(screen.getByTestId("quote-accept"));
    expect(screen.getByTestId("quote-state")).toHaveTextContent("Przyjęta dziś");
    expect(doc()?.number).toMatch(/^W\/A\/\d{4}\/001$/);
    expect(screen.queryByTestId("quote-accept")).toBeNull();
    fireEvent.click(screen.getByTestId("quote-reject"));
    expect(screen.getByTestId("quote-state")).toHaveTextContent("Odrzucona dziś");
  });

  it("kolejna wycena dostaje następny numer serii", () => {
    setJobMeta("s2", { status: "quote" });
    saveQuoteItem("s2", { id: "q2", kind: "labor", name: "X", qty: 1, unit: "usł.", price: 1, order: 0 });
    render(<Host />);
    fireEvent.click(screen.getByTestId("quote-give-number"));
    expect(getJobs().get("s2")?.doc).toBeUndefined();
    cleanup();
    function Second() { const job = useJob("s2"); return job ? <QuoteDocPanel siteId="s2" job={job} signed={false} onSign={() => {}} /> : null; }
    render(<Second />);
    fireEvent.click(screen.getByTestId("quote-give-number"));
    expect(screen.getByTestId("quote-number")).toHaveTextContent(/\/002 ·/);
  });
});

describe("QuoteDocPanel: rabat, VAT, uwagi (3.2, 3.3)", () => {
  it("rabat zapisuje się przy wyjściu z pola; zły wpis daje komunikat i nic nie zmienia; 0 zdejmuje", () => {
    render(<Host />);
    const field = screen.getByLabelText("Rabat na całość (%)");
    fireEvent.change(field, { target: { value: "12,5" } });
    fireEvent.blur(field);
    expect(doc()?.discount).toBe(12.5);

    fireEvent.change(screen.getByLabelText("Rabat na całość (%)"), { target: { value: "abc" } });
    fireEvent.blur(screen.getByLabelText("Rabat na całość (%)"));
    expect(toastMock.error).toHaveBeenCalledWith("Rabat: wpisz procent od 0 do 100, np. 10");
    expect(doc()?.discount).toBe(12.5);

    fireEvent.change(screen.getByLabelText("Rabat na całość (%)"), { target: { value: "150" } });
    fireEvent.blur(screen.getByLabelText("Rabat na całość (%)"));
    expect(doc()?.discount).toBe(12.5);

    fireEvent.change(screen.getByLabelText("Rabat na całość (%)"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("Rabat na całość (%)"));
    expect(doc()?.discount).toBeUndefined();
  });

  it("VAT: tryb netto z domyślną stawką 23, zmiana stawki, wyłączenie zdejmuje oba pola", () => {
    render(<Host />);
    expect(screen.queryByLabelText("Stawka VAT")).toBeNull();
    fireEvent.click(within(screen.getByRole("group", { name: "VAT na wycenie" })).getByRole("button", { name: "Netto + VAT" }));
    expect(doc()).toMatchObject({ vatMode: "net", vatRate: 23 });
    fireEvent.change(screen.getByLabelText("Stawka VAT"), { target: { value: "8" } });
    expect(doc()?.vatRate).toBe(8);
    fireEvent.click(within(screen.getByRole("group", { name: "VAT na wycenie" })).getByRole("button", { name: "Brutto" }));
    expect(doc()).toMatchObject({ vatMode: "gross", vatRate: 8 });
    fireEvent.click(within(screen.getByRole("group", { name: "VAT na wycenie" })).getByRole("button", { name: "Bez VAT" }));
    expect(doc()?.vatMode).toBeUndefined();
    expect(doc()?.vatRate).toBeUndefined();
  });

  it("uwagi zapisują się przy wyjściu, a „Wstaw domyślne warunki” działa tylko przy pustych uwagach", () => {
    setQuoteTerms("Zaliczka 30%.");
    render(<Host />);
    fireEvent.click(screen.getByTestId("quote-terms-insert"));
    expect(doc()?.notes).toBe("Zaliczka 30%.");
    expect(screen.queryByTestId("quote-terms-insert")).toBeNull();
    const notes = screen.getByLabelText("Uwagi i warunki");
    fireEvent.change(notes, { target: { value: "Termin: 5 dni." } });
    fireEvent.blur(notes);
    expect(doc()?.notes).toBe("Termin: 5 dni.");
    fireEvent.change(screen.getByLabelText("Uwagi i warunki"), { target: { value: "  " } });
    fireEvent.blur(screen.getByLabelText("Uwagi i warunki"));
    expect(doc()?.notes).toBeUndefined();
  });
});

describe("QuoteDocPanel: akceptacja podpisem (3.6)", () => {
  it("bez podpisu: „Podpis klienta” nadaje numer i otwiera okno podpisu", () => {
    const onSign = vi.fn();
    render(<Host onSign={onSign} />);
    fireEvent.click(screen.getByTestId("quote-sign"));
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(doc()?.number).toMatch(/^W\/A\/\d{4}\/001$/);
  });

  it("z ważnym podpisem: etykieta „Podpisana”, a przyjęcie to „Oznacz jako przyjętą”", () => {
    render(<Host signed />);
    expect(screen.getByTestId("quote-sign")).toHaveTextContent("Podpisana przez klienta");
    fireEvent.click(screen.getByTestId("quote-accept"));
    expect(screen.getByTestId("quote-state")).toHaveTextContent("Przyjęta");
  });

  it("wycena bez pozycji nie ma akcji klienta", () => {
    setJobMeta("pusta", { status: "quote" });
    function Empty() { const job = useJob("pusta"); return job ? <QuoteDocPanel siteId="pusta" job={job} signed={false} onSign={() => {}} /> : null; }
    render(<Empty />);
    expect(screen.queryByTestId("quote-actions")).toBeNull();
  });
});

describe("SiteJobPanel: sumy z rabatem i VAT", () => {
  it("pokazuje rabat, netto, VAT i brutto do zapłaty, a nagłówek kwotę do zapłaty", () => {
    render(<Panel />);
    // 2 × 500 = 1000 zł; bez dokumentu razem 1000.
    expect(screen.getByTestId("job-total")).toHaveTextContent(/^1\D?000 zł$/);
    expect(screen.queryByTestId("job-discount")).toBeNull();

    act(() => { fireEvent.change(screen.getByLabelText("Rabat na całość (%)"), { target: { value: "10" } }); fireEvent.blur(screen.getByLabelText("Rabat na całość (%)")); });
    fireEvent.click(screen.getByRole("button", { name: "Netto + VAT" }));
    expect(screen.getByTestId("job-discount")).toHaveTextContent("Rabat 10%");
    expect(screen.getByTestId("job-net")).toHaveTextContent("900 zł");
    expect(screen.getByTestId("job-vat")).toHaveTextContent("207 zł");
    expect(screen.getByTestId("job-total")).toHaveTextContent(/^1\D?107 zł$/);
    expect(screen.getByTestId("site-job-summary")).toHaveTextContent(/1\D?107 zł/);
  });
});

describe("SiteJobPanel: ceny z cenników (4.2)", () => {
  const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

  it("materiał: chipy z cennika kształtek wypełniają nazwę i cenę, bez cen jest podpowiedź", () => {
    render(<Panel />);
    fireEvent.click(screen.getByRole("button", { name: "Materiał" }));
    expect(screen.queryByTestId("job-material-pricing")).toBeNull();
    expect(screen.getByText(/Ceny kształtek wpiszesz w „Zużycie materiału”/)).toBeInTheDocument();
    act(() => { setFittingPrice("Trójnik 16", 6); setFittingPrice("Kolano 16", 4.5); setFittingPrice("Coś własnego", 9); });
    const chips = within(screen.getByTestId("job-material-pricing")).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["Kolano 16 · 4,50 zł", "Trójnik 16 · 6 zł"]);
    fireEvent.click(chips[1]);
    expect(field("Nazwa pozycji").value).toBe("Trójnik 16");
    expect(field("Cena za jednostkę (zł)").value).toBe("6");
  });

  it("wpisanie znanej nazwy podstawia cenę (materiał i robocizna), ale tylko do pustego pola ceny", () => {
    act(() => { setFittingPrice("Kolano 16", 4.5); setPricing({ items: [{ id: "p1", name: "WC podwieszane", price: 350, pointType: "H-4", createdAt: 1 }] }); });
    render(<Panel />);
    // Robocizna (domyślny rodzaj): nazwa z cennika robocizny.
    fireEvent.change(field("Nazwa pozycji"), { target: { value: "wc Podwieszane" } });
    expect(field("Cena za jednostkę (zł)").value).toBe("350");
    // Cena wpisana ręcznie nie jest nadpisywana kolejną nazwą.
    fireEvent.change(field("Cena za jednostkę (zł)"), { target: { value: "400" } });
    fireEvent.change(field("Nazwa pozycji"), { target: { value: "WC podwieszane XL" } });
    expect(field("Cena za jednostkę (zł)").value).toBe("400");
    // Materiał: nazwa z cennika kształtek, bez ogonków i wielkości liter.
    fireEvent.click(screen.getByRole("button", { name: "Materiał" }));
    fireEvent.change(field("Cena za jednostkę (zł)"), { target: { value: "" } });
    fireEvent.change(field("Nazwa pozycji"), { target: { value: "KOLANO  16" } });
    expect(field("Cena za jednostkę (zł)").value).toBe("4,5");
    // Robocizna nie bierze ceny z cennika materiału.
    fireEvent.click(screen.getByRole("button", { name: "Robocizna" }));
    fireEvent.change(field("Cena za jednostkę (zł)"), { target: { value: "" } });
    fireEvent.change(field("Nazwa pozycji"), { target: { value: "kolano 16" } });
    expect(field("Cena za jednostkę (zł)").value).toBe("");
  });
});

describe("SiteJobPanel: szablony wycen (4.3)", () => {
  const items = () => getJobs().get(SITE)?.items ?? [];
  const undo = () => (toastMock.mock.calls.at(-1)![1] as { action: { onClick: () => void } }).action.onClick();

  it("„Zapisz jako szablon” robi migawkę pozycji i marży pod nazwą", () => {
    setJobMeta(SITE, { margin: 15 });
    render(<Panel />);
    expect(screen.queryByLabelText("Szablon wyceny")).toBeNull();
    fireEvent.click(screen.getByTestId("template-save-open"));
    expect(screen.getByTestId("template-save")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nazwa szablonu"), { target: { value: "Łazienka — biały montaż" } });
    fireEvent.click(screen.getByTestId("template-save"));
    expect(getTemplates()).toHaveLength(1);
    expect(getTemplates()[0]).toMatchObject({ name: "Łazienka — biały montaż", margin: 15, items: [{ name: "Montaż", qty: 2, price: 500 }] });
    expect(screen.queryByLabelText("Nazwa szablonu")).toBeNull();
    expect(screen.getByLabelText("Szablon wyceny")).toBeInTheDocument();
  });

  it("„Wstaw” dopisuje pozycje i marżę (gdy wycena jej nie ma), a „Cofnij” je usuwa", () => {
    saveTemplate({ id: "t1", name: "Kuchnia", margin: 20, createdAt: 1, items: [{ kind: "material", name: "Bateria", qty: 1, unit: "szt.", price: 250 }, { kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 100 }] });
    render(<Panel />);
    expect(screen.getByTestId("template-insert")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Szablon wyceny"), { target: { value: "t1" } });
    fireEvent.click(screen.getByTestId("template-insert"));
    expect(items().map((i) => i.name)).toEqual(["Montaż", "Bateria", "Montaż"]);
    expect(getJobs().get(SITE)?.margin).toBe(20);
    expect(toastMock.mock.calls.at(-1)![0]).toBe("Wstawiono szablon „Kuchnia”: 2 pozycje");

    act(() => undo());
    expect(items().map((i) => i.name)).toEqual(["Montaż"]);
    expect(getJobs().get(SITE)?.margin).toBeUndefined();
  });

  it("własna marża wyceny nie jest nadpisywana marżą szablonu", () => {
    setJobMeta(SITE, { margin: 5 });
    saveTemplate({ id: "t1", name: "X", margin: 30, createdAt: 1, items: [{ kind: "labor", name: "A", qty: 1, unit: "usł.", price: 1 }] });
    render(<Panel />);
    fireEvent.change(screen.getByLabelText("Szablon wyceny"), { target: { value: "t1" } });
    fireEvent.click(screen.getByTestId("template-insert"));
    expect(getJobs().get(SITE)?.margin).toBe(5);
  });

  it("usunięcie szablonu ma „Cofnij”", () => {
    saveTemplate({ id: "t1", name: "Kuchnia", createdAt: 1, items: [{ kind: "labor", name: "A", qty: 1, unit: "usł.", price: 1 }] });
    render(<Panel />);
    fireEvent.change(screen.getByLabelText("Szablon wyceny"), { target: { value: "t1" } });
    fireEvent.click(screen.getByTestId("template-remove"));
    expect(getTemplates()).toEqual([]);
    act(() => undo());
    expect(getTemplates().map((t) => t.name)).toEqual(["Kuchnia"]);
  });
});

describe("SiteJobPanel: duplikowanie wyceny (4.5)", () => {
  it("„Duplikuj” zakłada nowe zlecenie z pozycjami i informuje, gdzie je znaleźć", () => {
    render(<Panel />);
    fireEvent.click(screen.getByTestId("job-duplicate"));
    expect(toastMock.success).toHaveBeenCalledWith("Utworzono zlecenie „Lipowa 5 (kopia)”", expect.objectContaining({ description: expect.stringContaining("Zlecenia") }));
    const copies = [...getJobs()].filter(([id]) => id !== SITE);
    expect(copies).toHaveLength(1);
    expect(copies[0][1].items.map((i) => i.name)).toEqual(["Montaż"]);
  });
});

describe("QuoteDocPanel: zaliczka (5.3)", () => {
  const paymentsOf = async () => (await import("@/lib/study/billingStore")).getSiteBilling(SITE).payments;

  it("kwota zaliczki zapisuje się przy wyjściu; zła i większa od kwoty do zapłaty są odrzucane z komunikatem", () => {
    render(<Host />);
    expect(screen.queryByTestId("deposit-receive")).toBeNull();
    const field = () => screen.getByLabelText("Zaliczka (zł)");
    fireEvent.change(field(), { target: { value: "300,50" } });
    fireEvent.blur(field());
    expect(doc()?.deposit).toBe(300.5);

    fireEvent.change(field(), { target: { value: "abc" } });
    fireEvent.blur(field());
    expect(toastMock.error).toHaveBeenCalledWith("Zaliczka: wpisz kwotę, np. 500 albo 250,50");
    // Wycena ma 1000 zł (2 × 500): zaliczka 5000 jest za duża.
    fireEvent.change(field(), { target: { value: "5000" } });
    fireEvent.blur(field());
    expect(toastMock.error.mock.calls.at(-1)![0]).toMatch(/nie może być większa niż kwota do zapłaty/);
    expect(doc()?.deposit).toBe(300.5);

    fireEvent.change(field(), { target: { value: "" } });
    fireEvent.blur(field());
    expect(doc()?.deposit).toBeUndefined();
  });

  it("„Wpłynęła zaliczka” zapisuje wpłatę w rozliczeniach i pokazuje stan; „Cofnij wpłatę” ją usuwa", async () => {
    setQuoteDoc("s1", { deposit: 300 });
    render(<Host />);
    fireEvent.click(screen.getByTestId("deposit-receive"));
    expect(screen.getByTestId("deposit-paid")).toHaveTextContent("300 zł");
    expect(doc()).toMatchObject({ deposit: 300, depositPaid: 300 });
    expect(await paymentsOf()).toEqual([expect.objectContaining({ id: "quote-deposit", amount: 300 })]);
    expect(doc()?.number).toMatch(/^W\/A\/\d{4}\/001$/);

    fireEvent.click(screen.getByTestId("deposit-revert"));
    expect(screen.queryByTestId("deposit-paid")).toBeNull();
    expect(doc()?.depositPaid).toBeUndefined();
    expect(await paymentsOf()).toEqual([]);
  });

  it("po wyczyszczeniu kwoty zaliczki wpłacona zaliczka zostaje widoczna i da się ją cofnąć", async () => {
    setQuoteDoc("s1", { deposit: 300 });
    render(<Host />);
    fireEvent.click(screen.getByTestId("deposit-receive"));
    const field = screen.getByLabelText("Zaliczka (zł)");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(doc()?.deposit).toBeUndefined();
    expect(doc()?.depositPaid).toBe(300);
    expect(screen.getByTestId("deposit-paid")).toHaveTextContent("300 zł");
    expect(screen.queryByTestId("deposit-receive")).toBeNull();
    fireEvent.click(screen.getByTestId("deposit-revert"));
    expect(doc()?.depositPaid).toBeUndefined();
    expect(await paymentsOf()).toEqual([]);
  });

  it("w panelu zlecenia wpłacona zaliczka daje „Wpłacono” i „Do zapłaty”", () => {
    setQuoteDoc("s1", { deposit: 300, depositPaid: 300 });
    render(<Panel />);
    expect(screen.getByTestId("job-total")).toHaveTextContent(/^1\D?000 zł$/);
    expect(screen.getByTestId("job-paid")).toHaveTextContent("−300 zł");
    expect(screen.getByTestId("job-due")).toHaveTextContent("700 zł");
  });
});

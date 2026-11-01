import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePlan, usePlans } from "@/lib/plans/plansStore";
import { yjsStore } from "@/lib/yjsStore";
import { NewAnalysisDialog } from "./NewAnalysisDialog";
import { PlanEditor } from "./PlanEditor";
import { PlansList } from "./PlansList";

/** Otwarta analiza w adresie (`/plany?analiza=<id>`): odświeżenie zostaje w edytorze, „wstecz” wraca do listy. */
export const PLAN_PARAM = "analiza";

/**
 * Dział „Plany” — Analizator planów hydraulicznych (`docs/plan-analizator-planow-2026-11-01.md`):
 * lista analiz albo edytor jednej. Ładowany leniwie, poza precache (D2). Otwarta analiza wynika z adresu
 * routera, więc systemowe „wstecz” i odświeżenie działają bez własnego stanu.
 */
export default function PlansView() {
  const plans = usePlans();
  const location = useLocation();
  const navigate = useNavigate();
  const openId = new URLSearchParams(location.search).get(PLAN_PARAM);
  const [creating, setCreating] = useState(false);
  const plan = usePlan(openId);

  const open = useCallback((pid: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(PLAN_PARAM, pid);
    navigate({ pathname: window.location.pathname, search: `?${params.toString()}` }, { state: { fromList: true } });
  }, [navigate]);

  const close = useCallback(() => {
    // Wejście z listy cofamy historią (jak systemowe „wstecz”); z linku tylko zdejmujemy parametr.
    if ((location.state as { fromList?: boolean } | null)?.fromList) { navigate(-1); return; }
    const params = new URLSearchParams(window.location.search);
    params.delete(PLAN_PARAM);
    const rest = params.toString();
    navigate({ pathname: window.location.pathname, search: rest ? `?${rest}` : "" }, { replace: true });
  }, [navigate, location.state]);

  // Dokument wczytuje się z dysku po starcie — do tego czasu „brak analizy” nie znaczy, że jej nie ma.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let on = true; void yjsStore.ready().finally(() => { if (on) setLoaded(true); }); return () => { on = false; }; }, []);

  // Analiza usunięta (np. na drugim urządzeniu) albo zły link — wracamy do listy.
  const missing = loaded && openId !== null && plan === null;
  useEffect(() => { if (missing) navigate({ pathname: window.location.pathname, search: "" }, { replace: true }); }, [missing, navigate]);

  return (
    <div className="mx-auto w-full max-w-6xl" data-testid="plans-view">
      {plan ? <PlanEditor plan={plan} onBack={close} /> : <PlansList plans={plans} onOpen={open} onNew={() => setCreating(true)} />}
      <NewAnalysisDialog open={creating} onOpenChange={setCreating} onCreated={open} />
    </div>
  );
}

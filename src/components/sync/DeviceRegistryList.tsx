import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACTIVE_MS, forgetDevice, getLocalDeviceId, useRegistryDevices } from "@/lib/deviceRegistry";
import { SCHEMA_VERSION } from "@/lib/formatSchema";
import { yjsStore } from "@/lib/yjsStore";

/**
 * Urządzenia zapisane w dokumencie grupy (D4.3): wersja, kiedy ostatnio widziane i „Zapomnij”.
 * Zapomniane urządzenie wpisze się ponownie, gdy znów się uruchomi.
 */
export function DeviceRegistryList() {
  const devices = useRegistryDevices(yjsStore.doc as never);
  const selfId = getLocalDeviceId();
  const others = devices.filter((d) => d.id !== selfId);
  if (others.length === 0) return null;
  const now = Date.now();
  return (
    <div data-testid="sync-registry">
      <p className="ui-hint">Zapisane w grupie</p>
      <ul className="mt-1 space-y-1 text-sm" aria-label="Urządzenia zapisane w grupie">
        {others.map((d) => {
          const dormant = now - d.at > ACTIVE_MS;
          const older = (d.schema ?? 0) < SCHEMA_VERSION;
          return (
            <li key={d.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">
                {d.name}
                <span className="text-xs text-muted-foreground">
                  {d.version ? ` · wersja ${d.version}` : ""} · {formatDistanceToNow(d.at, { addSuffix: true, locale: pl })}
                </span>
                {dormant && older && (
                  <span className="block text-xs text-warning-ink">Może stracić dane — zaktualizuj aplikację, zanim go użyjesz.</span>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0"
                aria-label={`Zapomnij urządzenie ${d.name}`}
                onClick={() => { forgetDevice(yjsStore.doc as never, d.id); toast.success(`Zapomniano: ${d.name}`); }}
              >
                Zapomnij
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

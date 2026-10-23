import { FEATURE_IDS, setFeature, useFeatureFlags, type FeatureId } from "@/lib/featureFlags";
import { Section, ToggleRow } from "./SettingsShared";

/** Opisy po polsku, prostym językiem: co się zmieni, nie jak to jest zbudowane. */
const FEATURE_COPY: Record<FeatureId, { label: string; desc: string }> = {
  cmEditor: { label: "Nowy edytor z podglądem", desc: "Formatowanie widać od razu, gdy piszesz. Treść zostaje ta sama." },
  relaySync: { label: "Synchronizacja przez serwer", desc: "Zmiany docierają, nawet gdy drugie urządzenie jest wyłączone. Serwer nie czyta treści." },
  graphLocal: { label: "Graf i panel boczny", desc: "Powiązania wokół otwartej notatki i szczegóły przy niej na komputerze." },
  searchIndex: { label: "Szybkie wyszukiwanie", desc: "Trafia też przy literówkach i odmianach słów. Liczy się w tle." },
  bases: { label: "Bazy i formuły", desc: "Zapisane widoki notatek, nowe typy pól i wyliczenia." },
  richContent: { label: "Wzory, diagramy i kolory kodu", desc: "Ładowane tylko wtedy, gdy notatka ich używa." },
  folderSync: { label: "Folder .md na dysku", desc: "Notatki jako pliki w wybranym folderze. Chrome i Edge na komputerze." },
  canvas: { label: "Kanwa", desc: "Tablica, na której układasz notatki i łączysz je strzałkami." },
  localAi: { label: "Lokalne AI", desc: "Podobne notatki liczone w przeglądarce. Nic nie wychodzi z urządzenia." },
};

export function FeatureFlagsSettings() {
  const flags = useFeatureFlags();
  return (
    <Section title="Funkcje w przygotowaniu">
      <p className="text-xs text-muted-foreground">
        Przełączniki zapisują się już teraz. Funkcje podłączamy po kolei, więc część z nich jeszcze niczego nie zmienia.
      </p>
      <div className="space-y-2">
        {FEATURE_IDS.map((id) => (
          <ToggleRow
            key={id}
            label={FEATURE_COPY[id].label}
            desc={FEATURE_COPY[id].desc}
            checked={flags[id]}
            onCheck={(on) => setFeature(id, on)}
          />
        ))}
      </div>
    </Section>
  );
}

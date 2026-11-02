import { BatteryLow, BookOpen, HardHat, Moon, type LucideIcon } from "lucide-react";
import type { AppearancePreset } from "@/lib/appearancePresets";

/** Ikony gotowych zestawów wyglądu — wspólne dla Ustawień → Wygląd i okienka szybkich zestawów. */
export const PRESET_ICON: Record<AppearancePreset["id"], LucideIcon> = { site: HardHat, night: Moon, read: BookOpen, battery: BatteryLow };

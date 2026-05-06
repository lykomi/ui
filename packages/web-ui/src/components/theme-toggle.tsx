import { type FC } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { useThemeStore, type ThemeMode } from "../lib/theme-store.ts";

const icons: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const labels: Record<ThemeMode, string> = {
  light: "Light mode",
  dark: "Dark mode",
  system: "System theme",
};

export const ThemeToggle: FC = () => {
  const { mode, cycle } = useThemeStore();
  const Icon = icons[mode];

  return (
    <TooltipIconButton tooltip={labels[mode]} size="icon" onClick={cycle}>
      <Icon className="size-4 text-primary" />
    </TooltipIconButton>
  );
};

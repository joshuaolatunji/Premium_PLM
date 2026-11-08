import { Moon, Sun } from "lucide-react";

import { useTheme } from "../../utils/theme";

interface ThemeToggleProps {
  className?: string;
}

// Light / dark mode as a switch: the knob sits right with a moon in dark
// mode, left with a sun in light mode, and slides across when clicked.
function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      data-tooltip={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`theme-toggle ${className}`.trim()}
      data-mode={theme}
      onClick={toggleTheme}
    >
      <span className="theme-toggle_knob" aria-hidden="true">
        <Sun className="theme-toggle_sun" size={14} strokeWidth={2.2} />
        <Moon className="theme-toggle_moon" size={13} strokeWidth={2.2} />
      </span>
    </button>
  );
}

export default ThemeToggle;

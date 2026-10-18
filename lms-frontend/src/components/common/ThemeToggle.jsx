// lms-frontend/src/components/common/ThemeToggle.jsx
// Compact theme control. `variant="segmented"` shows Light / Dark /
// System; the default icon button cycles light ↔ dark.
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const OPTIONS = [
  { key: "light", label: "Light", Icon: Sun },
  { key: "dark", label: "Dark", Icon: Moon },
  { key: "system", label: "System", Icon: Monitor },
];

const ThemeToggle = ({ variant = "icon", className = "" }) => {
  const { theme, preference, setTheme, toggleTheme } = useTheme();
  if (variant === "segmented") {
    return (
      <div role="radiogroup" aria-label="Theme" className={`inline-flex rounded border border-line bg-surface p-0.5 ${className}`}>
        {OPTIONS.map(({ key, label, Icon }) => {
          const on = preference === key;
          return (
            <button key={key} type="button" role="radio" aria-checked={on} onClick={() => setTheme(key)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-sm text-[13px] font-medium transition-colors ${on ? "bg-brand-soft text-brand" : "text-fg-secondary hover:text-fg"}`}>
              <Icon size={14} aria-hidden="true" /> {label}
            </button>
          );
        })}
      </div>
    );
  }
  const isDark = theme === "dark";
  return (
    <button type="button" onClick={toggleTheme} aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"} className={`btn-icon ${className}`}>
      {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
};

export default ThemeToggle;

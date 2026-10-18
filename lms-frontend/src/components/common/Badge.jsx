// lms-frontend/src/components/common/Badge.jsx
// Status label: 4px radius, tinted surface, optional dot. Legacy colour
// names map onto the five semantic tones of the palette.
const TONE = {
  blue: "brand", primary: "brand", indigo: "brand", violet: "brand", purple: "brand", pink: "brand",
  emerald: "success", green: "success",
  amber: "warning", orange: "warning", yellow: "warning",
  rose: "error", red: "error",
  cyan: "info", sky: "info", teal: "info",
  slate: "neutral", gray: "neutral",
  brass: "accent", accent: "accent",
};

const SIZE = { sm: "h-5 px-1.5 text-[11px]", md: "", lg: "h-7 px-2.5 text-[13px]" };

const Badge = ({ children, color = "slate", size = "md", dot = false, className = "" }) => {
  const tone = TONE[color] || color || "neutral";
  return (
    <span className={`badge badge-${tone} ${SIZE[size] || ""} ${className}`}>
      {dot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
};

export default Badge;

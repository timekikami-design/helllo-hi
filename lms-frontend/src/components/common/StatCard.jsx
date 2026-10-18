// lms-frontend/src/components/common/StatCard.jsx
// A quiet metric: label, tabular value, optional context line.
// No gradient tiles or glows — a hairline panel with a small muted icon.
// `color` maps to a thin semantic edge so status-bearing metrics are
// still distinguishable (paired with the label text, never colour alone).
import * as Icons from "lucide-react";

const EDGE = {
  emerald: "rgb(var(--success))", green: "rgb(var(--success))",
  amber: "rgb(var(--warning))", orange: "rgb(var(--warning))",
  rose: "rgb(var(--error))", red: "rgb(var(--error))",
};

const StatCard = ({ title, value, icon = "Activity", trend, color, subtitle, onClick }) => {
  const Icon = Icons[icon] || Icons.Activity;
  const Tag = onClick ? "button" : "div";
  const edge = EDGE[color];
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative w-full text-left bg-surface border border-line rounded-lg px-5 py-4 min-w-0 ${onClick ? "transition-colors hover:border-line-strong focus-visible:outline-2 cursor-pointer" : ""}`}
      style={edge ? { boxShadow: `inset 3px 0 0 ${edge}` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps truncate">{title}</p>
        <Icon size={16} strokeWidth={1.75} className="text-fg-muted shrink-0" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[28px] leading-[34px] font-semibold text-fg tabular-nums tracking-[-0.02em] truncate">{value}</p>
      {(subtitle || trend) && (
        <div className="mt-1 flex items-center gap-2 text-[13px] leading-5 text-fg-muted min-w-0">
          {trend && (
            <span className={`inline-flex items-center gap-1 font-medium ${String(trend).startsWith("+") ? "text-ok" : "text-bad"}`}>
              {String(trend).startsWith("+") ? <Icons.TrendingUp size={13} aria-hidden="true" /> : <Icons.TrendingDown size={13} aria-hidden="true" />}
              {trend}
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </Tag>
  );
};

export default StatCard;

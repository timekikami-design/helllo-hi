// lms-frontend/src/components/enterprise/RoleBanner.jsx
// Quiet page header for role dashboards: date + context eyebrow, serif
// greeting, one-line purpose, and up to two actions on the right.
// Props are unchanged ({ icon, eyebrow, title, subtitle, actions, variant });
// `icon` and `variant` are accepted for compatibility but no longer paint a
// coloured hero — role identity comes from the content, not the colour.
import { useAuth } from "../../context/AuthContext";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const firstName = (u) => {
  const n = u?.name || u?.fullName || u?.profile?.fullName || "";
  return n.trim().split(/\s+/)[0] || "";
};

// eslint-disable-next-line no-unused-vars
const RoleBanner = ({ icon, eyebrow, title, subtitle, actions, variant }) => {
  const { user } = useAuth();
  const name = firstName(user);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  return (
    <header className="pb-6 mb-2 border-b border-line flex flex-col lg:flex-row lg:items-end justify-between gap-5">
      <div className="min-w-0">
        <p className="eyebrow">{today}{eyebrow ? <> · {eyebrow}</> : null}</p>
        <p className="font-serif text-[30px] sm:text-[34px] leading-tight text-fg mt-1">
          {greeting()}{name ? `, ${name}` : ""}.
        </p>
        <h1 className="text-[15px] font-semibold text-fg mt-2">{title}</h1>
        {subtitle && <p className="text-[14px] text-fg-muted mt-0.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
    </header>
  );
};

export default RoleBanner;

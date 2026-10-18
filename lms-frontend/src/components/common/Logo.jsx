// lms-frontend/src/components/common/Logo.jsx
// AUST emblem + wordmark. `light` renders on the navy brand panel.
import { Link } from "react-router-dom";
import logoUrl from "../../assets/aust-logo.png";

const SIZES = {
  sm: { img: 32, name: "text-[15px] leading-5", sub: "text-[11px] leading-4" },
  md: { img: 40, name: "text-[16px] leading-6", sub: "text-[12px] leading-4" },
  lg: { img: 56, name: "text-[20px] leading-7", sub: "text-[12px] leading-4" },
};

const Logo = ({ size = "md", showText = true, light = false, to = "/" }) => {
  const s = SIZES[size] || SIZES.md;
  return (
    <Link to={to} className="flex items-center gap-3 min-w-0 rounded" aria-label="AUST Open & Distance Learning — home">
      <img src={logoUrl} alt="" width={s.img} height={s.img} className="shrink-0 object-contain" draggable={false} />
      {showText && (
        <span className="flex flex-col min-w-0">
          <span className={`${s.name} font-semibold tracking-[-0.01em] truncate ${light ? "text-white" : "text-fg"}`}>AUST <span className={light ? "text-brass-300" : "text-brass"}>ODL</span></span>
          <span className={`${s.sub} font-medium truncate ${light ? "text-white/70" : "text-fg-muted"}`}>Open &amp; Distance Learning</span>
        </span>
      )}
    </Link>
  );
};

export default Logo;

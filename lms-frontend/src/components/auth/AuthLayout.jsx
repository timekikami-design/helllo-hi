// lms-frontend/src/components/auth/AuthLayout.jsx
// Split authentication layout (E1–E3).
//  • ≥1024px: navy brand panel (campus photograph, serif statement) | form.
//  • <1024px: compact logo header + form, filling 100dvh; only the form
//    region scrolls if the content genuinely exceeds the viewport.
import { Link } from "react-router-dom";
import logoUrl from "../../assets/aust-logo.png";
import ThemeToggle from "../common/ThemeToggle";

const CAMPUS = "/brand/aust-campus-day.jpg";

export function AuthLayout({ children, statement = "A university that reaches you, wherever you study." }) {
  return (
    <div className="h-dvh w-full overflow-hidden grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-canvas text-fg">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-primary-600 dark:bg-surface-muted text-white dark:text-fg p-10 xl:p-12" aria-label="Abbottabad University of Science & Technology">
        <img src={CAMPUS} alt="" aria-hidden="true" decoding="async"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.22] dark:opacity-[0.16] mix-blend-luminosity" />
        <div className="absolute inset-0 bg-primary-600/70 dark:bg-surface-muted/80" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <img src={logoUrl} alt="" width={44} height={44} className="h-11 w-11 object-contain" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">Abbottabad University of Science &amp; Technology</p>
            <p className="text-[12px] tracking-[0.06em] uppercase text-white/70 dark:text-fg-muted">Open &amp; Distance Learning</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <span className="block h-px w-12 bg-accent-500 mb-6" aria-hidden="true" />
          <p className="font-serif text-[40px] leading-[44px] tracking-[-0.01em]">{statement}</p>
          <p className="mt-5 text-[15px] leading-6 text-white/75 dark:text-fg-secondary">Courses, live classes, results and your academic record — in one place.</p>
        </div>
        <p className="relative text-[12px] text-white/60 dark:text-fg-muted">Havelian, Abbottabad · Khyber Pakhtunkhwa</p>
      </aside>

      <main className="relative flex min-h-0 flex-col">
        <div className="flex items-center justify-between px-5 sm:px-8 h-16 shrink-0">
          <Link to="/login" className="flex items-center gap-2.5 lg:invisible rounded" aria-label="AUST ODL — sign in">
            <img src={logoUrl} alt="" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-[15px] font-semibold">AUST <span className="text-brass">ODL</span></span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="min-h-full flex items-center justify-center px-5 sm:px-8 pb-8">
            <div className="w-full max-w-[400px] animate-auth">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthHeading({ eyebrow, title, children }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="label-caps mb-3">{eyebrow}</p>}
      <h1 className="text-title font-semibold tracking-[-0.015em]">{title}</h1>
      {children && <p className="mt-2 text-[15px] leading-6 text-fg-muted">{children}</p>}
    </div>
  );
}

export default AuthLayout;

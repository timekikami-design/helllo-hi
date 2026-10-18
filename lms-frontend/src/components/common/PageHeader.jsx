// lms-frontend/src/components/common/PageHeader.jsx
// Page title block: breadcrumb → title → one-line subtitle → actions.
// Hierarchy comes from type and spacing, not from icon tiles or gradients.
// The `icon` prop is accepted for compatibility and rendered as a small
// muted glyph beside the breadcrumb only.
import * as Icons from "lucide-react";

const PageHeader = ({ title, subtitle, icon, actions, breadcrumb }) => {
  const Icon = icon ? Icons[icon] : null;
  return (
    <header className="mb-8 pb-6 border-b border-line">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
            {Icon && <li aria-hidden="true" className="mr-1 text-fg-muted"><Icon size={14} strokeWidth={1.75} /></li>}
            {breadcrumb.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <Icons.ChevronRight size={12} aria-hidden="true" className="opacity-60" />}
                <span aria-current={i === breadcrumb.length - 1 ? "page" : undefined} className={i === breadcrumb.length - 1 ? "text-fg-secondary font-medium" : ""}>{b}</span>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[30px] md:text-title font-semibold text-fg tracking-[-0.015em]">{title}</h1>
          {subtitle && <p className="mt-2 max-w-3xl text-[15px] leading-6 text-fg-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  );
};

export default PageHeader;

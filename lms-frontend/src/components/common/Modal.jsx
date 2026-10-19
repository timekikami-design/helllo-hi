// lms-frontend/src/components/common/Modal.jsx
// Accessible dialog: role="dialog", aria-modal, labelled title, Escape to
// close, focus trapped inside, focus returned to the trigger, background
// scroll locked. 12px radius, Level-2 elevation, sensible widths.
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

const Modal = ({ open, onClose, title, subtitle, children, maxWidth = "max-w-2xl", icon: Icon }) => {
  const panelRef = useRef(null);
  const lastFocus = useRef(null);
  const titleId = useId();
  // Keep the latest onClose in a ref. Callers usually pass an inline arrow
  // (a new function every render); depending on it re-ran this effect on
  // every keystroke, which restored focus to the trigger and then re-focused
  // the first field — so typing in any modal input lost focus after a word.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = panelRef.current;
      if (!el) return;
      const first = el.querySelector("[autofocus]") || el.querySelector(FOCUSABLE);
      (first || el).focus();
    }, 0);
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      if (lastFocus.current && typeof lastFocus.current.focus === "function") lastFocus.current.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ animation: "aust-fade-only 150ms ease-out both" }}>
      <div className="absolute inset-0 bg-[rgb(11_15_20/0.5)]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} max-h-[92dvh] sm:max-h-[88dvh] flex flex-col bg-surface-elevated text-fg border border-line rounded-t-3xl sm:rounded-3xl shadow-pop overflow-hidden`}
        style={{ animation: "aust-fade 200ms ease-out both" }}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && <Icon size={18} strokeWidth={1.75} className="mt-1 text-fg-muted shrink-0" aria-hidden="true" />}
            <div className="min-w-0">
              <h2 id={titleId} className="text-heading font-semibold text-fg">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="btn-icon -mr-2 -mt-1">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto text-fg">{children}</div>
      </div>
    </div>,
    document.body,
  );
};

export default Modal;

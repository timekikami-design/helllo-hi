// lms-frontend/src/context/ToastContext.jsx
// Centralised toasts: success / error / warning / info, announced via
// aria-live, capped at three visible, bottom-right (top on mobile).
// Raw technical errors (status codes, "Request failed …") are replaced
// by plain language — the original message stays in the console.
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext({ toast: () => {} });
const MAX_VISIBLE = 3;

const TONES = {
  success: { Icon: CheckCircle2, cls: "text-ok", edge: "rgb(var(--success))" },
  error: { Icon: XCircle, cls: "text-bad", edge: "rgb(var(--error))" },
  warning: { Icon: AlertTriangle, cls: "text-warn", edge: "rgb(var(--warning))" },
  info: { Icon: Info, cls: "text-note", edge: "rgb(var(--info))" },
};

const TECHNICAL = /^(request failed \(\d+\)|failed to fetch|networkerror|load failed|unexpected token)/i;
const humanise = (msg, type) => {
  const s = typeof msg === "string" ? msg : (msg && msg.message) || "";
  if (type === "error" && (!s || TECHNICAL.test(s))) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "You’re offline. Check your internet connection and try again.";
    if (s) console.warn("[toast]", s);
    return "Something went wrong. Please try again.";
  }
  return s;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const remove = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((message, opts = {}) => {
    const id = Date.now() + Math.random();
    const type = opts.type || "success";
    const item = { id, message: humanise(message, type), type, title: opts.title };
    setToasts((t) => [...t, item].slice(-MAX_VISIBLE));
    timers.current[id] = setTimeout(() => remove(id), opts.duration || (type === "error" ? 6000 : 4000));
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="fixed z-[100] inset-x-3 top-3 sm:inset-x-auto sm:top-auto sm:bottom-6 sm:right-6 flex flex-col gap-2 sm:w-[380px] pointer-events-none"
      >
        {toasts.map((t) => {
          const { Icon, cls, edge } = TONES[t.type] || TONES.info;
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-3 rounded-lg border border-line bg-surface-elevated px-4 py-3 shadow-pop"
              style={{ boxShadow: `inset 3px 0 0 ${edge}, var(--elev-2)`, animation: "aust-fade 200ms ease-out both" }}
            >
              <Icon size={18} strokeWidth={2} className={`${cls} shrink-0 mt-0.5`} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                {t.title && <p className="text-[14px] leading-5 font-semibold text-fg">{t.title}</p>}
                <p className="text-[14px] leading-5 text-fg-secondary break-words">{t.message}</p>
              </div>
              <button type="button" onClick={() => remove(t.id)} aria-label="Dismiss notification" className="-mr-1 -mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-surface-muted">
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

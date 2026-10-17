import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lock, Wallet, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

/* =============================================================
   S7 / S8 — Student fee gate.
   * Blocked by the Provost → every student page (except the Accounts
     Book) is replaced by the fee-block screen with the exact message
     "Your fee has not been submitted. Please submit your fee first."
     The server enforces the same rule (403 FEE_BLOCKED on all student
     APIs except the Fee module); this component is only the UI.
   * Not blocked but a fee is due → a slim banner with the
     "You must submit PKR X before …" notice on every page.
   State refreshes on login, on navigation, on any FEE_BLOCKED API
   response and live over SSE (fee:block / fee:updated).
   ============================================================= */
export const BLOCK_MESSAGE = "Your fee has not been submitted. Please submit your fee first.";

export default function FeeBlockGate({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  const load = useCallback(async () => {
    try { setStatus(await api.student.feeStatus()); } catch (_) { /* keep last known */ }
  }, []);

  useEffect(() => { load(); }, [load, location.pathname]);
  useEffect(() => {
    const onBlocked = (e) => setStatus((s) => ({ ...(s || {}), blocked: true, message: e.detail?.message || BLOCK_MESSAGE }));
    window.addEventListener("lms:fee-blocked", onBlocked);
    return () => window.removeEventListener("lms:fee-blocked", onBlocked);
  }, []);
  useRealtime(api.student.eventsUrl, { "fee:block": () => load(), "fee:updated": () => load() });

  const onFeePage = location.pathname.startsWith("/student/account");

  if (status?.blocked && !onFeePage) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" data-testid="fee-block-screen">
        <div className="max-w-lg w-full card-base p-8 text-center border-rose-200 dark:border-rose-900/50">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center mb-4">
            <Lock size={28} className="text-rose-600" />
          </div>
          <h2 className="font-display text-xl font-bold text-app mb-2">Access restricted</h2>
          <p className="text-sm text-app mb-1" data-testid="fee-block-message">{status.message || BLOCK_MESSAGE}</p>
          {status.notice && <p className="text-xs text-muted-app mb-4">{status.notice}</p>}
          <button onClick={() => navigate("/student/account")} className="btn-primary text-sm py-2 px-5 inline-flex items-center gap-2 mt-3">
            <Wallet size={15} /> Go to Accounts Book
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status?.blocked && onFeePage && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900/50 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2" data-testid="fee-block-banner">
          <Lock size={16} /> {status.message || BLOCK_MESSAGE}
        </div>
      )}
      {!status?.blocked && status?.notice && !onFeePage && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-2" data-testid="fee-due-banner">
          <AlertTriangle size={16} />
          <span className="flex-1">{status.notice}</span>
          <button onClick={() => navigate("/student/account")} className="text-xs font-semibold underline">Pay now</button>
        </div>
      )}
      {children}
    </>
  );
}

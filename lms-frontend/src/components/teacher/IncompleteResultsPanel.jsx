import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight } from "lucide-react";
import api from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

/* =============================================================
   S6 — Teacher view of incomplete results.
   Lists the teacher's own current-term courses whose results are
   not yet published (same rule as the Exam Controller report) with
   a direct link to the course marks tab. Refreshes live when the
   Exam Controller sends a reminder (SSE `notification`).
   ============================================================= */
export default function IncompleteResultsPanel() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.teacher.incompleteResults();
      setItems(res?.items || []);
    } catch (_) {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtime(api.teacher.eventsUrl, { notification: () => load() });

  if (!loaded || items.length === 0) return null;

  return (
    <div className="card-base p-5 mb-6 border-amber-200 dark:border-amber-900/50" data-testid="incomplete-results-panel">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-amber-600" />
        <h3 className="font-display font-bold text-lg text-app">Incomplete Results</h3>
        <span className="text-xs text-muted-app">{items.length} course{items.length !== 1 ? "s" : ""} pending</span>
      </div>
      <div className="divide-y divide-app">
        {items.map((it) => (
          <button
            key={it.offeringId}
            onClick={() => navigate(it.link)}
            className="w-full flex flex-wrap items-center gap-3 py-2.5 text-left hover:surface rounded-lg px-2"
          >
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-app">{it.course}</p>
              <p className="text-[11px] text-muted-app">
                {it.program || "—"} · Semester {it.semester || "—"}{it.department ? ` · ${it.department}` : ""}
              </p>
            </div>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              {it.pending} of {it.enrolled} student{it.enrolled !== 1 ? "s" : ""} pending
            </span>
            <span className="text-xs text-primary-600 inline-flex items-center gap-1">Open marks <ArrowRight size={12} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

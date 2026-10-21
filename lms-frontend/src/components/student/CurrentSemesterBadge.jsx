import { GraduationCap } from "lucide-react";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";

/* Student - current semester label, e.g. "Current Semester: 2nd Semester (Spring 2027)".
   Always read from the database; refreshes live when the student is promoted
   or enrolled (existing SSE events), and whenever the tab regains focus. */
export function useCurrentSemester() {
  const { data, reload } = useApi(() => api.student.currentSemester(), []);
  useRealtime(api.student.eventsUrl, { promotion: () => reload(), enrollment: () => reload(), result: () => reload() });
  return data?.currentSemester || null;
}

export default function CurrentSemesterBadge({ variant = "card", label = "Current Semester" }) {
  const cs = useCurrentSemester();
  const text = cs ? cs.display : "—";
  if (variant === "field") {
    return (
      <div data-testid="current-semester-field">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" data-testid="current-semester-value">{text}</p>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/70 dark:bg-primary-500/10 px-4 py-2" data-testid="current-semester-card">
      <GraduationCap size={18} className="text-primary-600 shrink-0" aria-hidden="true" />
      <p className="text-[14px] text-fg">
        <span className="font-semibold">{label}:</span> <span data-testid="current-semester-value">{text}</span>
      </p>
    </div>
  );
}

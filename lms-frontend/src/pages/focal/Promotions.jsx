// Sections 10 + 11 — Focal Person semester promotion (AUST rules).
// Lists: Eligible · Failed courses · Dropped · Results pending.
// One-click single or bulk promotion auto-enrols into the next
// semester's Scheme of Study courses; failed courses stay visible as
// "Failed" and are marked for the Special Exam.
import { useMemo, useState } from "react";
import { Search, TrendingUp, Settings2, CheckSquare, Square } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useIsFocalPerson } from "../../utils/focalDept";

const TABS = [
  { key: "eligible", label: "Eligible" },
  { key: "failed", label: "Failed courses" },
  { key: "dropped", label: "Dropped" },
  { key: "pending", label: "Results pending" },
  { key: "special", label: "Special Exam" },
  { key: "history", label: "History" },
];

const BADGE = {
  ELIGIBLE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  PROBATION: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  LAST_PROBATION: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  FAILED_COURSES: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  REPEAT: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/40 dark:text-fuchsia-300",
  DROPPED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  REMOVED: "bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  PENDING: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
};

const Badge = ({ status, label }) => (
  <span data-testid="promo-label" className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ${BADGE[status] || BADGE.PENDING}`}>{label}</span>
);

const fmt = (v) => (v == null ? "—" : Number(v).toFixed(2));

const Promotions = () => {
  const { toast } = useToast();
  const isFocal = useIsFocalPerson();
  const [tab, setTab] = useState("eligible");
  const [f, setF] = useState({ department: "", program: "", semester: "", q: "" });
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState(null);

  const { data, loading, error, reload } = useApi(() => api.focal.promotions(), []);
  const special = useApi(() => api.focal.specialExams(), []);
  const history = useApi(() => api.focal.promotionHistory(), []);
  const reloadAll = () => { reload(); special.reload(); history.reload(); };
  useRealtime(api.focal.eventsUrl, { "promotions:changed": reloadAll, "result:declared": reload, "results:changed": reload });

  const filters = data?.filters || { departments: [], programs: [], semesters: [] };
  const rowsFor = (k) => {
    const all = data?.lists?.[k] || [];
    const q = f.q.trim().toLowerCase();
    return all.filter((r) => (!f.department || r.department === f.department)
      && (!f.program || r.program === f.program)
      && (!f.semester || String(r.semester) === f.semester)
      && (!q || [r.name, r.roll].some((v) => String(v || "").toLowerCase().includes(q))));
  };
  const rows = useMemo(() => (["eligible", "failed", "dropped", "pending"].includes(tab) ? rowsFor(tab) : []), [data, tab, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const actionable = rows.filter((r) => !r.decided && r.list !== "pending");

  const apply = async (ids) => {
    if (!ids.length) return;
    setBusy(true);
    try {
      const r = await api.focal.applyPromotions(ids);
      const enrolled = (r.results || []).reduce((a, x) => a + (x.enrolled || 0), 0);
      toast(`${r.applied} decision(s) applied${enrolled ? ` — ${enrolled} course enrolment(s)` : ""}${r.skipped ? `, ${r.skipped} skipped` : ""}`, { type: "success" });
      setSel(new Set());
      reloadAll();
    } catch (e) { toast(e.message || "Failed", { type: "error" }); } finally { setBusy(false); }
  };

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSel = actionable.length > 0 && actionable.every((r) => sel.has(r.studentId));

  const actionLabel = (r) => (r.list === "dropped" ? "Finalise" : r.status === "REPEAT" ? "Record repeat" : "Promote");

  const openSettings = () => {
    const s = data?.settings || {};
    setDraft({ professionalException: !!s.professionalException, codes: (s.professionalCourseCodes || []).join(", ") });
    setShowSettings(true);
  };
  const saveSettings = async () => {
    try {
      await api.focal.savePromotionSettings({ professionalException: draft.professionalException, professionalCourseCodes: draft.codes.split(/[,\s]+/).filter(Boolean) });
      toast("Promotion settings saved", { type: "success" });
      setShowSettings(false); reload();
    } catch (e) { toast(e.message || "Failed", { type: "error" }); }
  };
  const enrollSpecial = async (id) => {
    try { await api.focal.enrollSpecialExam(id); toast("Enrolled for the Special Exam", { type: "success" }); special.reload(); } catch (e) { toast(e.message || "Failed", { type: "error" }); }
  };

  const stats = data?.stats || {};
  const sel2 = (k, opts, ph) => (
    <select data-testid={`promo-f-${k}`} className="input-base text-sm" value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))}>
      <option value="">{ph}</option>
      {opts.map((o) => <option key={o} value={String(o)}>{k === "semester" ? `Semester ${o}` : o}</option>)}
    </select>
  );

  return (
    <div>
      <PageHeader title="Semester Promotions" subtitle="AUST promotion rules applied to declared results. Promote one student or many in one click — next-semester courses are enrolled automatically." icon="TrendingUp" breadcrumb={["Focal Person", "Promotions"]} />

      {error ? <ErrorState title="Couldn't load promotions" description={error} onRetry={reload} /> : loading ? (
        <div className="grid sm:grid-cols-4 gap-3 mb-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <StatCard title="Eligible" value={stats.eligible || 0} icon="CheckCircle2" color="emerald" />
            <StatCard title="Failed courses / Repeat" value={stats.failed || 0} icon="AlertTriangle" color="amber" delay={0.05} />
            <StatCard title="Dropped / Removed" value={stats.dropped || 0} icon="UserX" color="rose" delay={0.1} />
            <StatCard title="Results pending" value={stats.pending || 0} icon="Clock" color="blue" delay={0.15} />
          </div>

          <div className="card-base p-3 mb-3 flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-app" />
              <input data-testid="promo-search" className="input-base pl-8 text-sm w-full" placeholder="Search name or roll no." value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} />
            </div>
            {!isFocal && sel2("department", filters.departments, "All departments")}
            {sel2("program", filters.programs, "All programs")}
            {sel2("semester", filters.semesters, "All semesters")}
            {isFocal && <button data-testid="promo-settings" className="btn-secondary text-sm flex items-center gap-1" onClick={openSettings}><Settings2 size={14} /> Rules settings</button>}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {TABS.map((t) => (
              <button key={t.key} data-testid={`promo-tab-${t.key}`} onClick={() => { setTab(t.key); setSel(new Set()); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === t.key ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-app"}`}>
                {t.label}{stats[t.key] != null ? ` (${stats[t.key]})` : ""}
              </button>
            ))}
          </div>

          {["eligible", "failed", "dropped", "pending"].includes(tab) && (
            <>
              {isFocal && tab !== "pending" && actionable.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                  <button data-testid="promo-select-all" className="btn-secondary text-xs flex items-center gap-1" onClick={() => setSel(allSel ? new Set() : new Set(actionable.map((r) => r.studentId)))}>
                    {allSel ? <CheckSquare size={14} /> : <Square size={14} />} Select all ({actionable.length})
                  </button>
                  <button data-testid="promo-bulk" disabled={!sel.size || busy} className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50" onClick={() => apply([...sel])}>
                    <TrendingUp size={14} /> Apply to selected ({sel.size})
                  </button>
                </div>
              )}
              {rows.length === 0 ? <EmptyState icon="TrendingUp" title="No students" description="No students in this list for the selected filters." /> : (
                <div className="card-base overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-[11px] uppercase text-muted-app border-b border-app">
                      {isFocal && tab !== "pending" && <th className="p-2 w-8" />}
                      <th className="p-2">Student</th><th className="p-2">Program</th><th className="p-2">Semester</th>
                      <th className="p-2">GPA</th><th className="p-2">CGPA</th><th className="p-2">Credit hours</th>
                      <th className="p-2">Courses</th><th className="p-2">Outcome</th>{isFocal && tab !== "pending" && <th className="p-2" />}
                    </tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.studentId} data-testid="promo-row" data-roll={r.roll} className="border-b border-app align-top">
                          {isFocal && tab !== "pending" && <td className="p-2">{!r.decided && <input type="checkbox" data-testid="promo-check" checked={sel.has(r.studentId)} onChange={() => toggle(r.studentId)} />}</td>}
                          <td className="p-2"><p className="font-bold text-app">{r.name}</p><p className="text-[10px] font-mono text-muted-app">{r.roll}</p></td>
                          <td className="p-2">{r.program || "—"}</td>
                          <td className="p-2 font-mono">{r.semester}</td>
                          <td className="p-2 font-mono">{fmt(r.gpa)}</td>
                          <td className="p-2 font-mono">{fmt(r.cgpa)}</td>
                          <td className="p-2 font-mono">{r.passedCh != null ? `${r.passedCh} / ${r.minCh} min` : r.list === "pending" ? `${r.declared || 0}/${r.expected || 0} declared` : "—"}</td>
                          <td className="p-2">
                            {(r.failedCourses || []).length === 0 ? <span className="text-muted-app text-xs">All passed</span> : r.failedCourses.map((c) => (
                              <div key={c.courseId} data-testid="promo-failed" className="text-xs">
                                <span className="font-mono">{c.code}</span> <span className="text-rose-600 font-bold">Failed</span> ({Math.round(c.percent)}%)
                                {c.specialExam && <span className="ml-1 text-[10px] text-blue-600">Special Exam: {c.specialExam.toLowerCase()}</span>}
                              </div>
                            ))}
                          </td>
                          <td className="p-2"><Badge status={r.status} label={r.label} />
                            {r.reasons?.length > 0 && <p className="text-[10px] text-muted-app mt-1 max-w-[220px]">{r.reasons.join("; ")}</p>}
                            {r.decided && <p className="text-[10px] text-emerald-600 mt-1">Decision recorded</p>}
                          </td>
                          {isFocal && tab !== "pending" && <td className="p-2">{!r.decided && (
                            <button data-testid="promo-apply" disabled={busy} className="btn-primary text-xs whitespace-nowrap" onClick={() => apply([r.studentId])}>{actionLabel(r)}</button>
                          )}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === "special" && ((special.data?.items || []).length === 0 ? <EmptyState icon="BookOpen" title="No Special Exam candidates" description="Failed courses are marked here when a student is promoted." /> : (
            <div className="card-base overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-muted-app border-b border-app"><th className="p-2">Student</th><th className="p-2">Course</th><th className="p-2">Semester</th><th className="p-2">Marks</th><th className="p-2">Status</th><th className="p-2" /></tr></thead>
              <tbody>{special.data.items.map((x) => (
                <tr key={x.id} data-testid="special-row" className="border-b border-app">
                  <td className="p-2">{x.student}</td><td className="p-2"><span className="font-mono">{x.course?.code}</span> {x.course?.title} <span className="text-rose-600 font-bold text-xs">Failed</span></td>
                  <td className="p-2 font-mono">{x.semester}</td><td className="p-2 font-mono">{Math.round(x.percent)}%</td>
                  <td className="p-2 text-xs font-bold">{x.status}</td>
                  <td className="p-2">{isFocal && x.status === "MARKED" && <button data-testid="special-enroll" className="btn-primary text-xs" disabled={!x.availableOfferingId} title={x.availableOfferingId ? "" : "No current-term offering"} onClick={() => enrollSpecial(x.id)}>Enrol</button>}</td>
                </tr>))}</tbody>
            </table></div>
          ))}

          {tab === "history" && ((history.data?.items || []).length === 0 ? <EmptyState icon="History" title="No decisions yet" description="Applied promotions appear here." /> : (
            <div className="card-base overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-muted-app border-b border-app"><th className="p-2">Date</th><th className="p-2">Student</th><th className="p-2">From → To</th><th className="p-2">Outcome</th><th className="p-2">GPA / CGPA</th><th className="p-2">Enrolled</th><th className="p-2">By</th></tr></thead>
              <tbody>{history.data.items.map((h) => (
                <tr key={h.id} data-testid="history-row" className="border-b border-app">
                  <td className="p-2 text-xs">{new Date(h.createdAt).toLocaleString()}</td><td className="p-2">{h.student}</td>
                  <td className="p-2 font-mono">{h.fromSemester} → {h.toSemester ?? "—"}</td><td className="p-2"><Badge status={h.outcome} label={h.outcome.replace("_", " ")} /></td>
                  <td className="p-2 font-mono">{fmt(h.gpa)} / {fmt(h.cgpa)}</td><td className="p-2 font-mono">{h.enrolled}</td><td className="p-2 text-xs">{h.decidedBy}</td>
                </tr>))}</tbody>
            </table></div>
          ))}
        </>
      )}

      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Promotion rules settings">
        {draft && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" data-testid="prof-toggle" checked={draft.professionalException} onChange={(e) => setDraft((d) => ({ ...d, professionalException: e.target.checked }))} />
              Professional-subject exception — a failed professional subject does not count against the semester's passed credit hours (it is still carried as Failed for the Special Exam).
            </label>
            <div>
              <label className="text-xs font-semibold text-muted-app">Professional course codes (comma separated)</label>
              <input data-testid="prof-codes" className="input-base w-full text-sm" value={draft.codes} onChange={(e) => setDraft((d) => ({ ...d, codes: e.target.value }))} placeholder="e.g. CS-101, EN-101" />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary text-sm" onClick={() => setShowSettings(false)}>Cancel</button>
              <button data-testid="prof-save" className="btn-primary text-sm" onClick={saveSettings}>Save</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Promotions;

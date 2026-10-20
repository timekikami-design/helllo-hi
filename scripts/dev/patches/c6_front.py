import os
os.chdir('/home/user/webapp/lms-frontend/src')
def patch(path, reps):
    s=open(path).read()
    for a,b in reps:
        assert s.count(a)==1, (path, a[:60]); s=s.replace(a,b)
    open(path,'w').write(s)
patch('services/api.js', [(
"""  exportGazette: (batch, format, program) => download(`/lms/academic/exam/workflow/gazette/export/${format}${qs({ batch, program })}`, `gazette-${batch}.${format === 'excel' ? 'xlsx' : 'pdf'}`),""",
"""  exportGazette: (batch, format, program, layout) => download(`/lms/academic/exam/workflow/gazette/export/${format}${qs({ batch, program, layout })}`, `gazette-${batch}${layout ? `-${layout}` : ''}.${format === 'excel' ? 'xlsx' : 'pdf'}`),""")])
P='pages/exam/BatchGazette.jsx'
patch(P, [
("""import { useMemo, useState } from "react";
import { Users, FileSpreadsheet, FileDown, Loader2, Search, CalendarClock, GraduationCap, RefreshCw } from "lucide-react";""",
"""import { useMemo, useState } from "react";
import { Users, FileSpreadsheet, FileDown, Loader2, Search, CalendarClock, GraduationCap, RefreshCw, Rows3, Columns3, LayoutList } from "lucide-react";"""),
("""import useApi from "../../hooks/useApi";""","""import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import Modal from "../../components/common/Modal";"""),
("""function GazetteView({ batch }) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi(() => api.workflow.gazette(batch), [batch]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);""",
"""// Change 6 — same pass mark as the backend export (lmsGrading.PASS_PERCENT = 50).
const PASS_PERCENT = 50;
const remarksOf = (subjects) => {
  const failed = subjects.filter((x) => !(Number(x.totalPercent) >= PASS_PERCENT)).map((x) => x.courseCode);
  return failed.length ? `Fail: ${failed.join(", ")}` : "Pass";
};
function bySemester(students) {
  const m = new Map();
  for (const s of students) for (const sem of s.semesters) {
    const k = sem.semester || 0;
    if (!m.has(k)) m.set(k, { semester: sem.semester, term: sem.term, courses: new Map(), rows: [] });
    const g = m.get(k);
    sem.subjects.forEach((x) => { if (!g.courses.has(x.courseCode)) g.courses.set(x.courseCode, x.courseTitle); });
    g.rows.push({ s, sem });
  }
  return [...m.values()].sort((a, b) => (a.semester || 0) - (b.semester || 0)).map((g) => ({ ...g, courses: [...g.courses.entries()].map(([code, title]) => ({ code, title })) }));
}

/* Change 6 — Horizontal layout: one row per student, one column per course,
   then GPA, CGPA, Remarks (one table per semester). */
function HorizontalLayout({ batch, students }) {
  const groups = useMemo(() => bySemester(students), [students]);
  return (
    <div className="space-y-4" data-testid="gazette-horizontal">
      {groups.map((g) => (
        <div key={g.semester ?? 0} className="card-base overflow-hidden">
          <p className="px-4 py-2 bg-primary-50/60 dark:bg-primary-500/5 text-xs font-bold text-primary-800 dark:text-primary-200">Batch: {batch} · Semester {g.semester ?? "—"}{g.term ? ` · ${g.term}` : ""}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Student Name</th>
                  {g.courses.map((c) => <th key={c.code} className="px-3 py-2 text-center whitespace-nowrap" title={c.title}>{c.code}</th>)}
                  <th className="px-3 py-2 text-center">GPA</th><th className="px-3 py-2 text-center">CGPA</th><th className="px-3 py-2 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map(({ s, sem }) => (
                  <tr key={s.studentId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-1.5 whitespace-nowrap"><span className="font-semibold text-app">{s.student}</span> <span className="font-mono text-[11px] text-muted-app">{s.rollNumber}</span></td>
                    {g.courses.map((c) => { const x = sem.subjects.find((y) => y.courseCode === c.code); return <td key={c.code} className="px-3 py-1.5 text-center whitespace-nowrap">{x ? <><b>{x.letterGrade}</b> <span className="text-[11px] text-muted-app">{fmt(x.totalPercent, 1)}%</span></> : "—"}</td>; })}
                    <td className="px-3 py-1.5 text-center font-semibold">{fmt(sem.gpa)}</td>
                    <td className="px-3 py-1.5 text-center font-semibold text-emerald-700 dark:text-emerald-300">{fmt(sem.cgpa ?? s.cgpa)}</td>
                    <td className="px-3 py-1.5 text-xs">{remarksOf(sem.subjects)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Change 6 — Vertical layout: Batch › Semester sections; each student block
   reads top to bottom (name, courses, semester GPA, CGPA, remarks). */
function VerticalLayout({ batch, students }) {
  const groups = useMemo(() => bySemester(students), [students]);
  return (
    <div className="space-y-6" data-testid="gazette-vertical">
      {groups.map((g) => (
        <section key={g.semester ?? 0}>
          <h3 className="font-display font-bold text-app mb-2">Batch: {batch} — Semester {g.semester ?? "—"}{g.term ? ` · ${g.term}` : ""}</h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {g.rows.map(({ s, sem }) => (
              <div key={s.studentId} className="card-base p-4">
                <p className="font-bold text-app">{s.student}</p>
                <p className="text-[11px] text-muted-app font-mono mb-2">{s.rollNumber}{s.program ? ` · ${s.program}` : ""}</p>
                <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {sem.subjects.map((x) => (
                    <li key={x.courseCode} className="py-1 flex justify-between gap-2"><span className="text-app">{x.courseTitle} <span className="font-mono text-[11px] text-muted-app">{x.courseCode}</span></span><span className="whitespace-nowrap"><b>{x.letterGrade}</b> <span className="text-[11px] text-muted-app">{fmt(x.totalPercent, 1)}%</span></span></li>
                  ))}
                </ul>
                <p className="mt-2 text-sm flex justify-between"><span>Semester {sem.semester ?? "—"} GPA</span><b>{fmt(sem.gpa)}</b></p>
                <p className="text-sm flex justify-between text-emerald-700 dark:text-emerald-300"><span>CGPA</span><b>{fmt(sem.cgpa ?? s.cgpa)}</b></p>
                <p className="text-xs mt-1 text-muted-app">Remarks: {remarksOf(sem.subjects)}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const LAYOUTS = [
  { key: "current", label: "Current View", icon: LayoutList },
  { key: "horizontal", label: "Horizontal View", icon: Columns3 },
  { key: "vertical", label: "Vertical View", icon: Rows3 },
];

function GazetteView({ batch }) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi(() => api.workflow.gazette(batch), [batch]);
  // Live: compiled / declared results update the gazette without a refresh.
  useRealtime(api.exam.eventsUrl, { result: () => reload() });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  // Change 6 — layout toggle (default = the existing view) + export dialog.
  const [layout, setLayout] = useState("current");
  const [dl, setDl] = useState(null); // { format }
  const [dlLayout, setDlLayout] = useState("standard");"""),
("""  const exp = async (format) => {
    setBusy(format);
    try { await api.workflow.exportGazette(batch, format); } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(null); }
  };""",
"""  const exp = async (format, chosen) => {
    setBusy(format);
    try { await api.workflow.exportGazette(batch, format, undefined, chosen && chosen !== "standard" ? chosen : undefined); } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(null); }
  };
  const openDl = (format) => { setDl({ format }); setDlLayout(layout === "current" ? "standard" : layout); };"""),
("""        <button onClick={() => exp("excel")} disabled={!!busy} className="btn-secondary text-sm">""",
"""        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" role="group" aria-label="Gazette layout" data-testid="gazette-layout-toggle">
          {LAYOUTS.map((l) => (
            <button key={l.key} type="button" onClick={() => setLayout(l.key)} aria-pressed={layout === l.key}
              className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ${layout === l.key ? "bg-primary-600 text-white" : "text-muted-app hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
              <l.icon size={13} /> {l.label}
            </button>
          ))}
        </div>
        <button onClick={() => openDl("excel")} disabled={!!busy} className="btn-secondary text-sm">"""),
("""        <button onClick={() => exp("pdf")} disabled={!!busy} className="btn-secondary text-sm">""",
"""        <button onClick={() => openDl("pdf")} disabled={!!busy} className="btn-secondary text-sm">"""),
("""      {students.map((s) => (
        <div key={s.studentId} className="card-base overflow-hidden">""",
"""      {layout === "horizontal" && <HorizontalLayout batch={data.batch} students={students} />}
      {layout === "vertical" && <VerticalLayout batch={data.batch} students={students} />}
      {layout === "current" && students.map((s) => (
        <div key={s.studentId} className="card-base overflow-hidden">"""),
("""      {!students.length && <EmptyState icon="Users" title="No matching students" description="Try a different search." />}
    </div>""",
"""      {!students.length && <EmptyState icon="Users" title="No matching students" description="Try a different search." />}

      <Modal open={!!dl} onClose={() => setDl(null)} title={`Download gazette (${dl?.format === "excel" ? "Excel" : "PDF"})`} icon={FileDown} maxWidth="max-w-md">
        <div className="space-y-3" data-testid="gazette-download-dialog">
          <p className="text-xs text-muted-app">Choose the layout of the downloaded file. It does not depend on the layout shown on screen.</p>
          {[
            { k: "standard", t: "Standard (existing)", d: "Exactly the current gazette download." },
            { k: "horizontal", t: "Horizontal", d: "One row per student, a column per course, then GPA, CGPA, Remarks. PDF is landscape." },
            { k: "vertical", t: "Vertical", d: "Grouped by batch and semester; each student reads top to bottom. PDF is portrait." },
          ].map((o) => (
            <label key={o.k} className={`flex gap-2 items-start p-2 rounded-lg border cursor-pointer ${dlLayout === o.k ? "border-primary-500 bg-primary-50/50 dark:bg-primary-500/5" : "border-slate-200 dark:border-slate-700"}`}>
              <input type="radio" name="gz-layout" value={o.k} checked={dlLayout === o.k} onChange={() => setDlLayout(o.k)} className="mt-1" />
              <span><span className="text-sm font-semibold text-app">{o.t}</span><br /><span className="text-[11px] text-muted-app">{o.d}</span></span>
            </label>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setDl(null)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={() => { const f = dl.format; setDl(null); exp(f, dlLayout); }} className="btn-primary text-sm" data-testid="gazette-download-go"><FileDown size={14} /> Download</button>
          </div>
        </div>
      </Modal>
    </div>"""),
])
print('c6 front done')

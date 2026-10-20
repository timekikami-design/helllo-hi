import { useMemo, useState } from "react";
import { Users, FileSpreadsheet, FileDown, Loader2, Search, CalendarClock, GraduationCap, RefreshCw, Rows3, Columns3, LayoutList } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import Modal from "../../components/common/Modal";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

/* =============================================================
   Gazette (A11) — organised by BATCH.
   Batch = the admission session a cohort enrolled under (fixed for
   life, e.g. "Batch: Fall 2026"); the current Session is shown
   separately. Every student block lists Semester 1, 2, … with
   subjects, marks and GPA, and CGPA at the end. Builds progressively
   as results move Compilation → Unofficial → Official.
   ============================================================= */
const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d));
const STAGE_CLS = {
  OFFICIAL: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  UNOFFICIAL: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  COMPILED: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
};

// Change 6 — same pass mark as the backend export (lmsGrading.PASS_PERCENT = 50).
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
  // Live: declared results update the gazette without a refresh. (The shared
  // per-user SSE bus is reached through the existing coordinator events URL,
  // which authenticates any LMS user; no new endpoint is needed.)
  useRealtime(api.coordinator.eventsUrl, { result: () => reload() });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  // Change 6 — layout toggle (default = the existing view) + export dialog.
  const [layout, setLayout] = useState("current");
  const [dl, setDl] = useState(null); // { format }
  const [dlLayout, setDlLayout] = useState("standard");
  const students = useMemo(() => {
    const list = data?.students || [];
    if (!q.trim()) return list;
    const t = q.toLowerCase();
    return list.filter((s) => [s.student, s.rollNumber, s.registrationNumber].filter(Boolean).some((v) => String(v).toLowerCase().includes(t)));
  }, [data, q]);
  const exp = async (format, chosen) => {
    setBusy(format);
    try { await api.workflow.exportGazette(batch, format, undefined, chosen && chosen !== "standard" ? chosen : undefined); } catch (e) { toast(e.message, { type: "error" }); } finally { setBusy(null); }
  };
  const openDl = (format) => { setDl({ format }); setDlLayout(layout === "current" ? "standard" : layout); };

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error) return <ErrorState description={error} onRetry={reload} />;
  return (
    <div className="space-y-4">
      <div className="card-base p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="font-display font-bold text-lg text-app">Batch: {data.batch}</p>
          <p className="text-xs text-muted-app flex items-center gap-1"><CalendarClock size={12} /> Current Session: {data.currentSession || "—"} · {data.students.length} student(s)</p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / roll no" className="input-base pl-9 text-sm w-56" />
        </div>
        <button onClick={reload} className="btn-secondary text-sm"><RefreshCw size={14} /></button>
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" role="group" aria-label="Gazette layout" data-testid="gazette-layout-toggle">
          {LAYOUTS.map((l) => (
            <button key={l.key} type="button" onClick={() => setLayout(l.key)} aria-pressed={layout === l.key}
              className={`px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1 ${layout === l.key ? "bg-primary-600 text-white" : "text-muted-app hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
              <l.icon size={13} /> {l.label}
            </button>
          ))}
        </div>
        <button onClick={() => openDl("excel")} disabled={!!busy} className="btn-secondary text-sm">{busy === "excel" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} className="text-emerald-600" />} Excel</button>
        <button onClick={() => openDl("pdf")} disabled={!!busy} className="btn-secondary text-sm">{busy === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} className="text-rose-600" />} PDF</button>
      </div>

      {layout === "horizontal" && <HorizontalLayout batch={data.batch} students={students} />}
      {layout === "vertical" && <VerticalLayout batch={data.batch} students={students} />}
      {layout === "current" && students.map((s) => (
        <div key={s.studentId} className="card-base overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center gap-2 justify-between">
            <div>
              <p className="font-bold text-app"><span className="font-mono text-primary-700 dark:text-primary-300">{s.rollNumber}</span> — {s.student}{s.fatherName ? <span className="font-normal text-muted-app"> s/o {s.fatherName}</span> : null}</p>
              <p className="text-xs text-muted-app">{s.program} · {s.department}{s.registrationNumber ? ` · Reg# ${s.registrationNumber}` : ""}</p>
            </div>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-300">CGPA {fmt(s.cgpa)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase text-slate-500">
                <tr>{["Code", "Course Title", "Cr.", "Mid (Obt/Total)", "Final (Obt/Total)", "%", "Grade", "GP"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {s.semesters.map((sem) => [
                  <tr key={`h${sem.semester}`} className="bg-primary-50/60 dark:bg-primary-500/5">
                    <td colSpan={8} className="px-3 py-1.5 text-xs font-bold text-primary-800 dark:text-primary-200">
                      Semester {sem.semester ?? "—"}{sem.term ? ` · ${sem.term}` : ""}
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full ${STAGE_CLS[sem.stage]}`}>{sem.stage}</span>
                    </td>
                  </tr>,
                  ...sem.subjects.map((x) => (
                    <tr key={`${sem.semester}-${x.courseCode}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-1.5 font-mono text-xs">{x.courseCode}</td>
                      <td className="px-3 py-1.5">{x.courseTitle}</td>
                      <td className="px-3 py-1.5">{x.creditHours}</td>
                      <td className="px-3 py-1.5">{fmt(x.midMarks, 1)} / {fmt(x.midMax, 0)}</td>
                      <td className="px-3 py-1.5">{fmt(x.finalMarks, 1)} / {fmt(x.finalMax, 0)}</td>
                      <td className="px-3 py-1.5">{fmt(x.totalPercent)}</td>
                      <td className="px-3 py-1.5 font-bold">{x.letterGrade}</td>
                      <td className="px-3 py-1.5">{fmt(x.gradePoints)}</td>
                    </tr>
                  )),
                  <tr key={`g${sem.semester}`} className="border-t border-slate-200 dark:border-slate-700 font-semibold">
                    <td colSpan={2} className="px-3 py-1.5 text-right text-xs">Semester {sem.semester} GPA</td>
                    <td className="px-3 py-1.5">{sem.credits}</td>
                    <td colSpan={4} />
                    <td className="px-3 py-1.5 text-primary-700 dark:text-primary-300">{fmt(sem.gpa)}</td>
                  </tr>,
                ])}
                <tr className="bg-emerald-50/70 dark:bg-emerald-500/5 font-bold">
                  <td colSpan={7} className="px-3 py-2 text-right">CGPA</td>
                  <td className="px-3 py-2 text-emerald-700 dark:text-emerald-300">{fmt(s.cgpa)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!students.length && <EmptyState icon="Users" title="No matching students" description="Try a different search." />}

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
    </div>
  );
}

export default function BatchGazette() {
  const { data, loading, error, reload } = useApi(() => api.workflow.gazetteBatches(), []);
  const [batch, setBatch] = useState(null);
  const batches = data?.batches || [];
  return (
    <div>
      <PageHeader title="Gazette" subtitle="Batch-wise result gazette — builds automatically as results are compiled and declared" icon="BookCheck" breadcrumb={["Exam Controller", "Gazette"]} />
      {loading ? <Skeleton className="h-40 w-full rounded-2xl" /> : error ? <ErrorState description={error} onRetry={reload} /> : !batches.length ? (
        <EmptyState icon="BookCheck" title="No gazette yet" description="The gazette becomes available once teachers submit results for a batch." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            {batches.map((b) => (
              <button key={b.batch} onClick={() => setBatch(b.batch)} className={`card-base p-4 text-left transition ${batch === b.batch ? "border-primary-500 ring-2 ring-primary-200 dark:ring-primary-900" : "hover:border-primary-300"}`}>
                <p className="text-[11px] font-bold uppercase text-muted-app">Batch</p>
                <p className="font-display font-bold text-lg text-app">{b.batch}</p>
                <p className="text-xs text-muted-app mt-1 flex items-center gap-1"><Users size={12} /> {b.students} students · <GraduationCap size={12} /> {b.programs.join(", ") || "—"}</p>
                <p className="text-[11px] text-muted-app mt-1">Current session: {b.currentSession || "—"}</p>
              </button>
            ))}
          </div>
          {batch ? <GazetteView key={batch} batch={batch} /> : <p className="text-sm text-muted-app">Select a batch to view its gazette.</p>}
        </>
      )}
    </div>
  );
}

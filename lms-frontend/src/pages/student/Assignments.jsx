// lms-frontend/src/pages/student/Assignments.jsx
// Assignments grouped by status — Overdue, Due, Submitted, Graded — across
// all enrolled courses, with a course filter (?course=CODE deep link) and
// search. Submit / replace / view uses the same API and modal flow.
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Search, CheckCircle2, AlertCircle, Upload, Award, Hourglass, Paperclip, Loader2, Download, RefreshCw, Clock, X, ChevronRight } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import { useToast } from "../../context/ToastContext";
import useApi from "../../hooks/useApi";
import api, { fileUrl } from "../../services/api";

/* Backend submission status → display meta. PENDING = no submission yet. */
const STATUS_META = {
  PENDING: { label: "Not submitted", icon: AlertCircle, cls: "text-warn" },
  SUBMITTED: { label: "Submitted", icon: Hourglass, cls: "text-note" },
  LATE: { label: "Submitted late", icon: Hourglass, cls: "text-warn" },
  GRADED: { label: "Graded", icon: Award, cls: "text-ok" },
};

const categoryOf = (a) => {
  const s = a.submission ? a.submission.status : "PENDING";
  if (s === "GRADED") return "GRADED";
  if (s === "SUBMITTED" || s === "LATE") return "SUBMITTED";
  return "PENDING";
};
const statusOf = (a) => (a.submission ? a.submission.status : "PENDING");
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—");
const isOverdue = (a) => {
  if (a.submission) return false;
  try { return new Date(a.dueDate) < new Date(); } catch { return false; }
};
const dueIn = (d) => {
  const ms = new Date(d) - new Date();
  if (Number.isNaN(ms)) return "";
  const days = Math.ceil(ms / 86400000);
  if (ms < 0) { const ago = Math.max(1, Math.floor(-ms / 86400000)); return `${ago} day${ago === 1 ? "" : "s"} overdue`; }
  if (days <= 1) return "Due within a day";
  return `Due in ${days} days`;
};

const GROUPS = [
  { key: "OVERDUE", title: "Overdue", Icon: AlertCircle, cls: "text-bad" },
  { key: "DUE", title: "To submit", Icon: Clock, cls: "text-warn" },
  { key: "SUBMITTED", title: "Submitted · awaiting grade", Icon: Hourglass, cls: "text-note" },
  { key: "GRADED", title: "Graded", Icon: CheckCircle2, cls: "text-ok" },
];
const groupOf = (a) => {
  const c = categoryOf(a);
  if (c === "PENDING") return isOverdue(a) ? "OVERDUE" : "DUE";
  return c;
};

const Assignments = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.student.assignments(), []);

  const [course, setCourse] = useState(searchParams.get("course") || "ALL");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(null); // assignment in modal
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const assignments = useMemo(() => data?.assignments || [], [data]);

  // Deep-link from a dashboard/course card: ?course=<code>.
  useEffect(() => {
    const c = searchParams.get("course");
    if (c) setCourse(c);
  }, [searchParams]);

  const changeCourse = (c) => {
    setCourse(c);
    const next = new URLSearchParams(searchParams);
    if (c === "ALL") next.delete("course"); else next.set("course", c);
    setSearchParams(next, { replace: true });
  };

  const courses = useMemo(() => {
    const m = new Map();
    assignments.forEach((a) => { if (!m.has(a.courseCode)) m.set(a.courseCode, a.courseTitle); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [assignments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments
      .filter((a) => course === "ALL" || a.courseCode === course)
      .filter((a) => !q || `${a.title} ${a.description || ""} ${a.courseCode} ${a.courseTitle}`.toLowerCase().includes(q));
  }, [assignments, course, search]);

  const groups = useMemo(() => {
    const by = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    filtered.forEach((a) => by[groupOf(a)].push(a));
    by.OVERDUE.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    by.DUE.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    by.SUBMITTED.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    by.GRADED.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
    return GROUPS.map((g) => ({ ...g, items: by[g.key] })).filter((g) => g.items.length);
  }, [filtered]);

  const handleSubmit = async () => {
    if (!active) return;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast("Please choose a file to upload", { type: "error" });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      await api.student.submitAssignment(active.id, fd);
      toast(active.submission ? "Submission replaced successfully" : "Assignment submitted successfully", { type: "success" });
      setActive(null);
      await reload();
    } catch (e) {
      toast(e.message || "Submission failed", { type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const Row = ({ a }) => {
    const g = groupOf(a);
    const meta = STATUS_META[statusOf(a)] || STATUS_META.PENDING;
    const obtained = a.submission?.marks;
    const pending = g === "OVERDUE" || g === "DUE";
    return (
      <li className="py-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 items-center">
        <div className="min-w-0">
          <p className="text-[12px] text-fg-muted"><span className="font-semibold text-fg-secondary">{a.courseCode}</span> · {a.courseTitle}</p>
          <p className="text-[15px] font-medium text-fg">{a.title}</p>
          <p className="text-[12px] text-fg-muted mt-0.5 flex flex-wrap gap-x-3 tabular-nums">
            <span>Due {fmtDate(a.dueDate)}</span>
            {pending && <span className={g === "OVERDUE" ? "text-bad font-medium" : ""}>{dueIn(a.dueDate)}</span>}
            <span>{a.totalMarks} marks</span>
            {a.attachmentUrl && <span className="inline-flex items-center gap-1"><Paperclip size={12} aria-hidden="true" /> Attachment</span>}
            {!pending && <span className={`inline-flex items-center gap-1 font-medium ${meta.cls}`}><meta.icon size={12} aria-hidden="true" /> {meta.label}</span>}
            {obtained != null && <span className="font-semibold text-fg">{obtained} / {a.totalMarks}</span>}
          </p>
        </div>
        {pending ? (
          <button type="button" onClick={() => setActive(a)} className="btn btn-primary btn-compact"><Upload size={14} aria-hidden="true" /> Submit<span className="sr-only"> {a.title}</span></button>
        ) : (
          <button type="button" onClick={() => setActive(a)} className="btn btn-ghost btn-compact">Details<span className="sr-only"> for {a.title}</span> <ChevronRight size={14} aria-hidden="true" /></button>
        )}
      </li>
    );
  };

  const counts = useMemo(() => {
    const c = { OVERDUE: 0, DUE: 0, SUBMITTED: 0, GRADED: 0 };
    filtered.forEach((a) => { c[groupOf(a)]++; });
    return c;
  }, [filtered]);

  return (
    <div>
      <PageHeader
        title="Assignments"
        subtitle={assignments.length ? `${counts.OVERDUE + counts.DUE} to submit · ${counts.SUBMITTED} awaiting grade · ${counts.GRADED} graded` : "Coursework from all your enrolled courses."}
        icon="FileText"
        breadcrumb={["Dashboard", "Assignments"]}
      />

      {loading ? (
        <div aria-busy="true">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />)}</div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : assignments.length === 0 ? (
        <EmptyState icon="FileText" title="No assignments yet" description="Assignments appear here when your instructors post them." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div className="relative w-full sm:w-80">
              <label htmlFor="asg-q" className="sr-only">Search assignments</label>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" aria-hidden="true" />
              <input id="asg-q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assignments" className="input-base w-full !pl-9 !pr-9" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded text-fg-muted hover:text-fg"><X size={14} aria-hidden="true" /></button>}
            </div>
            {courses.length > 1 && (
              <label className="inline-flex items-center gap-2 text-[13px] text-fg-secondary">
                Course
                <select value={course} onChange={(e) => changeCourse(e.target.value)} className="input-base !w-auto pr-8">
                  <option value="ALL">All courses</option>
                  {courses.map(([code, title]) => <option key={code} value={code}>{code} · {title}</option>)}
                </select>
              </label>
            )}
          </div>

          {groups.length === 0 ? (
            <EmptyState icon="Search" title="No matching assignments" description="Try another search or course." action={
              <button type="button" className="btn btn-secondary" onClick={() => { setSearch(""); changeCourse("ALL"); }}>Clear filters</button>
            } />
          ) : groups.map((g) => (
            <section key={g.key} aria-labelledby={`grp-${g.key}`} className="mb-10 last:mb-0">
              <h2 id={`grp-${g.key}`} className={`flex items-center gap-2 text-[14px] font-semibold pb-2 border-b border-line ${g.cls}`}>
                <g.Icon size={16} aria-hidden="true" /> {g.title}
                <span className="text-fg-muted font-normal tabular-nums">({g.items.length})</span>
              </h2>
              <ul className="divide-y divide-line">{g.items.map((a) => <Row key={a.id} a={a} />)}</ul>
            </section>
          ))}
        </>
      )}

      {/* ---- Submit / Replace / View detail modal ---- */}
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.title} subtitle={active ? `${active.courseCode} — ${active.courseTitle}` : ""} icon={FileText}>
        {active && (
          <div className="space-y-4">
            {/* Details */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden text-[14px]">
              {[
                ["Due", fmtDate(active.dueDate)],
                ["Total marks", active.totalMarks],
                ["Teacher", active.teacher || "TBA"],
                ["Status", STATUS_META[statusOf(active)]?.label],
                ["Obtained", active.submission?.marks != null ? `${active.submission.marks} / ${active.totalMarks}` : "—"],
                ["Late submission", active.allowLate ? "Allowed" : "Not allowed"],
              ].map(([k, v]) => (
                <div key={k} className="bg-surface p-3">
                  <dt className="text-[12px] text-fg-muted">{k}</dt>
                  <dd className="font-medium text-fg tabular-nums mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>

            {active.description && (
              <div ><p className="field-label">Instructions</p><p className="text-[14px] text-fg-secondary whitespace-pre-wrap">{active.description}</p></div>
            )}

            {/* Teacher attachment */}
            {active.attachmentUrl && (
              <div className="rounded border border-line p-3">
                <p className="field-label">Assignment attachment</p>
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-fg-muted" />
                  <span className="text-[14px] font-medium text-fg truncate">{active.attachmentName || "Attachment"}</span>
                  <a href={/^https?:\/\//.test(active.attachmentUrl) ? active.attachmentUrl : fileUrl(active.attachmentUrl)} target="_blank" rel="noreferrer" className="ml-auto link inline-flex items-center gap-1 text-[13px]"><Download size={12} /> Download</a>
                </div>
              </div>
            )}

            {/* Existing submission (View / Download / Replace) */}
            {active.submission && (
              <div className="rounded border border-line p-4">
                <p className="field-label">Your submission</p>
                <div className="flex items-center gap-2 mt-2">
                  <Paperclip size={14} className="text-fg-muted" />
                  <span className="text-[14px] font-medium text-fg">{active.submission.fileName || (active.submission.filePath ? "Submitted file" : "Text submission")}</span>
                  {active.submission.filePath && (
                    <a href={fileUrl(active.submission.filePath)} target="_blank" rel="noreferrer" className="ml-auto link inline-flex items-center gap-1 text-[13px]"><Download size={12} /> Download</a>
                  )}
                </div>
                {active.submission.marks != null && (
                  <div className="mt-3 flex items-center justify-between p-3 rounded bg-ok-soft text-ok">
                    <span className="font-semibold flex items-center gap-2"><CheckCircle2 size={16} /> Graded</span>
                    <span className="font-bold">{active.submission.marks}/{active.totalMarks}</span>
                  </div>
                )}
                {active.submission.feedback && (
                  <div className="mt-2 p-3 rounded bg-surface-muted text-[14px]">
                    <p className="text-[12px] text-fg-muted mb-0.5">Teacher feedback</p>
                    <p className="text-fg">{active.submission.feedback}</p>
                  </div>
                )}
              </div>
            )}

            {/* Upload / Replace zone — graded assignments cannot be re-submitted */}
            {statusOf(active) !== "GRADED" && (
              <div className="border border-dashed border-line-strong rounded p-6 text-center">
                {active.submission ? <RefreshCw size={28} className="mx-auto text-fg-muted mb-2" /> : <Upload size={28} className="mx-auto text-fg-muted mb-2" />}
                <p className="text-[14px] font-medium text-fg mb-2">{active.submission ? "Replace your submission" : "Upload your submission"}</p>
                <label htmlFor="assignment-file" className="sr-only">Choose file</label>
                <input id="assignment-file" ref={fileRef} type="file" className="block mx-auto text-[14px] text-fg-secondary" />
                <p className="field-help mt-2">PDF, DOC or ZIP, up to 25 MB.</p>
                <button onClick={handleSubmit} disabled={uploading} className="btn btn-primary mt-4">
                  {uploading ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Uploading…</> : active.submission ? <><RefreshCw size={15} aria-hidden="true" /> Replace submission</> : <><Upload size={15} aria-hidden="true" /> Upload and submit</>}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Assignments;

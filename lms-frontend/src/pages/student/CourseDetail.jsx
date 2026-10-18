// lms-frontend/src/pages/student/CourseDetail.jsx
// Subject space: course header, sticky section tabs, and quiet sections for
// overview (attendance + assessment weights + latest), materials,
// announcements and — when the course has one — the lab section.
// Data sources are unchanged: student.course, student.courseGradebook,
// student.labTasks.
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Megaphone, Download, FlaskConical, ChevronRight, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api, { fileUrl } from "../../services/api";

const teacherName = (o) => o?.teacher?.profile?.fullName || o?.teacher?.username || "TBA";
const teacherPhoto = (o) => {
  const url = o?.teacher?.profile?.photoUrl;
  return url ? fileUrl(url) : null;
};
const initials = (n = "") => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

const Avatar = ({ offering }) => {
  const [broken, setBroken] = useState(false);
  const src = teacherPhoto(offering);
  const name = teacherName(offering);
  if (src && !broken) {
    return <img src={src} onError={() => setBroken(true)} alt="" className="h-10 w-10 rounded-full object-cover border border-line" />;
  }
  return (
    <span aria-hidden="true" className="h-10 w-10 rounded-full bg-surface-muted text-fg-secondary text-[13px] font-semibold flex items-center justify-center border border-line">
      {initials(name)}
    </span>
  );
};

const Section = ({ title, action, children }) => (
  <section className="py-6 border-b border-line last:border-b-0">
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const Rail = ({ value, tone = "brand", label }) => (
  <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} className={tone === "bad" ? "!bg-bad" : tone === "warn" ? "!bg-warn" : ""} />
  </div>
);

const submissionState = (t) => {
  if (t.submission?.marks != null) return { Icon: CheckCircle2, cls: "text-ok", text: `Graded · ${t.submission.marks} / ${t.totalMarks}` };
  if (t.submission) return { Icon: Clock, cls: "text-note", text: "Submitted" };
  const overdue = t.dueDate && new Date(t.dueDate) < new Date();
  return overdue
    ? { Icon: AlertCircle, cls: "text-bad", text: "Overdue" }
    : { Icon: Clock, cls: "text-warn", text: "Not submitted" };
};

const CourseDetail = () => {
  const { offeringId } = useParams();
  const { data, loading, error, reload } = useApi(() => api.student.course(offeringId), [offeringId]);

  const offering = data?.offering;
  const course = offering?.course;
  const att = data?.attendance;
  const materials = data?.materials || [];
  const announcements = data?.announcements || [];
  // B1.d — Theory and Lab are two separate sections of ONE course.
  const hasLab = !!course?.hasLab;
  const [section, setSection] = useState("overview");
  const labApi = useApi(() => (hasLab ? api.student.labTasks() : Promise.resolve({ courses: [] })), [hasLab, offeringId]);
  const gb = useApi(() => api.student.courseGradebook(offeringId), [offeringId]);
  const labCourse = (labApi.data?.courses || []).find((c) => String(c.offeringId) === String(offeringId));
  const labTasks = labCourse?.labTasks || [];
  const cats = gb.data?.breakdown?.categories || [];
  const theoryCats = cats.filter((c) => c.key !== "lab");
  const labCat = cats.find((c) => c.key === "lab");

  const tabs = [
    ["overview", "Overview"],
    ["materials", `Materials${materials.length ? ` (${materials.length})` : ""}`],
    ["announcements", `Announcements${announcements.length ? ` (${announcements.length})` : ""}`],
    ...(hasLab ? [["lab", "Lab"]] : []),
  ];

  const weights = theoryCats.length
    ? theoryCats.map((c) => ({ key: c.key, label: c.label, weight: c.weight }))
    : offering
      ? [
          { key: "a", label: "Assignments", weight: offering.assignmentWeight },
          { key: "q", label: "Quizzes", weight: offering.quizWeight },
          { key: "m", label: "Midterm", weight: offering.midWeight },
          { key: "f", label: "Final", weight: offering.finalWeight },
        ].filter((w) => w.weight != null)
      : [];

  const pct = Number(att?.percentage ?? 0);
  const attTone = att && att.totalSessions > 0 ? (pct < 75 ? "bad" : pct < 80 ? "warn" : "brand") : "brand";

  return (
    <div>
      <Link to="/student/courses" className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg mb-4">
        <ArrowLeft size={14} aria-hidden="true" /> My courses
      </Link>

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : (
        <>
          {/* ===== Header ===== */}
          <header className="pb-6">
            <p className="text-[13px] text-fg-muted tabular-nums">
              <span className="font-semibold text-fg-secondary">{course?.code}</span>
              {course?.creditHours != null && <> · {course.creditHours} credit hours</>}
              {hasLab && <> · Theory + Lab</>}
            </p>
            <h1 className="font-serif text-[30px] sm:text-[36px] leading-tight text-fg mt-1">{course?.title || "Course"}</h1>
            {offering?.teacher && (
              <div className="mt-4 flex items-center gap-3">
                <Avatar offering={offering} />
                <div className="min-w-0">
                  <p className="text-[14px] font-medium text-fg truncate">{teacherName(offering)}</p>
                  <p className="text-[12px] text-fg-muted truncate">{offering.teacher.profile?.designation || "Course instructor"}</p>
                </div>
              </div>
            )}
          </header>

          {/* ===== Sticky tabs ===== */}
          <div className="sticky top-14 lg:top-16 z-10 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 bg-canvas border-b border-line">
            <div role="tablist" aria-label="Course sections" className="flex gap-1 overflow-x-auto">
              {tabs.map(([k, l]) => (
                <button key={k} role="tab" id={`tab-${k}`} aria-selected={section === k} aria-controls={`panel-${k}`}
                  onClick={() => setSection(k)}
                  className={`relative h-11 px-3 text-[14px] whitespace-nowrap font-medium transition-colors ${section === k ? "text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand" : "text-fg-muted hover:text-fg"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div role="tabpanel" id={`panel-${section}`} aria-labelledby={`tab-${section}`}>
            {section === "overview" && (
              <>
                <Section title="Attendance" action={<Link to="/student/attendance" className="link text-[13px]">Details</Link>}>
                  {att && att.totalSessions > 0 ? (
                    <div className="max-w-xl">
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-[28px] font-semibold text-fg tabular-nums">{pct}%</span>
                        <span className="text-[13px] text-fg-muted tabular-nums">
                          {att.present} present · {att.absent} absent · {att.late} late · {att.totalSessions} sessions
                        </span>
                      </div>
                      <div className="relative">
                        <Rail value={pct} tone={attTone} label="Attendance" />
                        <span aria-hidden="true" className="absolute top-[-4px] bottom-[-4px] w-px bg-fg-muted" style={{ left: "75%" }} />
                      </div>
                      <p className={`mt-2 text-[12px] flex items-center gap-1.5 ${pct < 75 ? "text-bad" : "text-fg-muted"}`}>
                        {pct < 75 && <AlertCircle size={13} aria-hidden="true" />}
                        {pct < 75 ? "Below the 75% requirement" : "Minimum requirement is 75%"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[14px] text-fg-muted">No sessions have been recorded for this course yet.</p>
                  )}
                </Section>

                {weights.length > 0 && (
                  <Section title="Assessment weights">
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden max-w-2xl">
                      {weights.map((w) => (
                        <div key={w.key} className="bg-surface p-4">
                          <dt className="label-caps">{w.label}</dt>
                          <dd className="text-[20px] font-semibold text-fg tabular-nums mt-1">{w.weight}%</dd>
                        </div>
                      ))}
                    </dl>
                  </Section>
                )}

                <Section title="Latest from your instructor" action={announcements.length > 1 && (
                  <button type="button" onClick={() => setSection("announcements")} className="link text-[13px]">All announcements</button>
                )}>
                  {announcements[0] ? (
                    <article className="max-w-2xl">
                      <p className="text-[12px] text-fg-muted">{fmtDate(announcements[0].createdAt)}</p>
                      <h3 className="text-[15px] font-semibold text-fg mt-0.5">{announcements[0].title}</h3>
                      <p className="text-[14px] text-fg-secondary mt-1 whitespace-pre-wrap line-clamp-4">{announcements[0].body || announcements[0].content}</p>
                    </article>
                  ) : (
                    <p className="text-[14px] text-fg-muted">No announcements yet.</p>
                  )}
                </Section>
              </>
            )}

            {section === "materials" && (
              <Section title="Course materials">
                {materials.length === 0 ? (
                  <EmptyState icon="FileText" title="No materials yet" description="Materials will appear here when your instructor uploads them." />
                ) : (
                  <ul className="divide-y divide-line border-y border-line">
                    {materials.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 py-3">
                        <FileText size={18} className="text-fg-muted shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-fg truncate">{m.title}</p>
                          <p className="text-[12px] text-fg-muted">{fmtDate(m.createdAt)}</p>
                        </div>
                        {m.fileUrl && (
                          <a href={fileUrl(m.fileUrl)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-compact">
                            <Download size={14} aria-hidden="true" /> Download<span className="sr-only"> {m.title}</span>
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {section === "announcements" && (
              <Section title="Announcements">
                {announcements.length === 0 ? (
                  <EmptyState icon="Megaphone" title="No announcements" description="Announcements for this course will appear here." />
                ) : (
                  <ol className="divide-y divide-line border-y border-line max-w-3xl">
                    {announcements.map((a) => (
                      <li key={a.id} className="py-4">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-[15px] font-semibold text-fg">{a.title}</h3>
                          <time className="text-[12px] text-fg-muted whitespace-nowrap">{fmtDate(a.createdAt)}</time>
                        </div>
                        <p className="text-[14px] text-fg-secondary mt-1 whitespace-pre-wrap">{a.body || a.content}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>
            )}

            {section === "lab" && hasLab && (
              <>
                <Section title="Lab tasks" action={
                  <Link to="/student/lab-tasks" className="link text-[13px] inline-flex items-center gap-0.5">Submit lab work <ChevronRight size={13} aria-hidden="true" /></Link>
                }>
                  {labApi.loading ? <Skeleton className="h-20 w-full" /> : labTasks.length === 0 ? (
                    <EmptyState icon="FlaskConical" title="No lab tasks yet" description="Lab tasks posted by your instructor will appear here." />
                  ) : (
                    <ul className="divide-y divide-line border-y border-line">
                      {labTasks.map((t) => {
                        const st = submissionState(t);
                        return (
                          <li key={t.id} className="flex items-center gap-3 py-3">
                            <FlaskConical size={18} className="text-fg-muted shrink-0" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-medium text-fg truncate">{t.title}</p>
                              <p className="text-[12px] text-fg-muted tabular-nums">Due {fmtDate(t.dueDate)} · {t.totalMarks} marks</p>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${st.cls}`}>
                              <st.Icon size={14} aria-hidden="true" /> {st.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>
                {labCat && (
                  <Section title="Lab weightage">
                    <p className="text-[14px] text-fg-secondary">
                      Lab counts for <b className="text-fg tabular-nums">{labCat.weight}%</b> of this course. Earned so far:{" "}
                      <b className="text-fg tabular-nums">{Number(labCat.obtained || 0).toFixed(2)}</b>
                    </p>
                  </Section>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CourseDetail;

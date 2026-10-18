// lms-frontend/src/pages/student/Attendance.jsx
// Course-wise attendance. Overview = summary strip + one row per course with
// a rail showing the 75% requirement line; status always carries icon + text.
// Detail = live (date-wise) and recorded lecture attendance for one course.
// Data: student.attendance, student.courseAttendance (unchanged).
import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowLeft, Video, User, PlayCircle, ChevronRight, Clock, MinusCircle, XCircle } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api from "../../services/api";

const THRESHOLD = 75;

const statusInfo = (status) => {
  switch (status) {
    case "Excellent": return { Icon: CheckCircle2, cls: "text-ok", tone: "ok" };
    case "Good": return { Icon: CheckCircle2, cls: "text-ok", tone: "brand" };
    case "Warning": return { Icon: AlertTriangle, cls: "text-warn", tone: "warn" };
    default: return { Icon: AlertTriangle, cls: "text-bad", tone: "bad" };
  }
};

const sessionInfo = (st) => {
  switch (st) {
    case "PRESENT": return { Icon: CheckCircle2, cls: "text-ok", label: "Present" };
    case "LATE": return { Icon: Clock, cls: "text-warn", label: "Late" };
    case "LEAVE": return { Icon: MinusCircle, cls: "text-note", label: "Leave" };
    case "ABSENT": return { Icon: XCircle, cls: "text-bad", label: "Absent" };
    default: return { Icon: MinusCircle, cls: "text-fg-muted", label: "Not marked" };
  }
};

const toneCls = { ok: "!bg-ok", brand: "", warn: "!bg-warn", bad: "!bg-bad" };

// Progress rail with the 75% requirement marker.
const AttendanceRail = ({ value = 0, tone = "brand", label, threshold = true }) => {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="relative">
      <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
        <span style={{ width: `${v}%` }} className={toneCls[tone]} />
      </div>
      {threshold && (
        <span aria-hidden="true" title={`${THRESHOLD}% requirement`} className="absolute -top-1 -bottom-1 w-px bg-fg-muted" style={{ left: `${THRESHOLD}%` }} />
      )}
    </div>
  );
};

const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };
const dayName = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString(undefined, { weekday: "long" }); } catch { return "—"; } };

// ---- Course detail (semester attendance for one course) ----
const CourseDetail = ({ course, onBack }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError("");
    api.student.courseAttendance(course.offeringId)
      .then((r) => setData(r))
      .catch((e) => setError(e.message || "Failed to load attendance"))
      .finally(() => setLoading(false));
  }, [course.offeringId]);

  useEffect(() => { load(); }, [load]);

  // Recorded-lecture attendance is granted automatically from real watch
  // progress in the Recorded Lectures player; this view is read-only.
  const si = statusInfo(data?.status);

  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg mb-4">
        <ArrowLeft size={14} aria-hidden="true" /> All courses
      </button>
      <PageHeader title={course.courseTitle} subtitle={`${course.courseCode} · attendance this semester`} icon="CalendarCheck" breadcrumb={["Dashboard", "Attendance", course.courseCode]} />

      {loading ? (
        <div className="space-y-4" aria-busy="true"><Skeleton className="h-32 w-full" /><Skeleton className="h-64 w-full" /></div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : data ? (
        <>
          {/* Summary */}
          <section className="rounded-lg border border-line bg-surface p-5 sm:p-6 mb-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
              <div>
                <p className="label-caps">Overall</p>
                <p className="text-[36px] leading-none font-semibold text-fg tabular-nums mt-1">{data.overallPercentage}%</p>
              </div>
              <p className={`inline-flex items-center gap-1.5 text-[14px] font-medium ${si.cls}`}>
                <si.Icon size={16} aria-hidden="true" /> {data.status}
                {Number(data.overallPercentage) < THRESHOLD && <span className="text-fg-muted font-normal"> · below the {THRESHOLD}% requirement</span>}
              </p>
            </div>
            <AttendanceRail value={data.overallPercentage} tone={si.tone} label="Overall attendance" />
            <p className="text-[12px] text-fg-muted mt-2">Line marks the {THRESHOLD}% requirement. Overall = live × {data.liveWeight}% + recorded × {data.recordedWeight}%.</p>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6 pt-6 border-t border-line">
              <div>
                <dt className="label-caps">Live classes · {data.liveWeight}%</dt>
                <dd className="mt-1">
                  <span className="text-[20px] font-semibold text-fg tabular-nums">{data.livePercentage}%</span>
                  <span className="text-[13px] text-fg-muted tabular-nums"> · {data.attendedLiveClasses} of {data.totalLiveClasses} attended</span>
                  <div className="mt-2"><AttendanceRail value={data.livePercentage} label="Live class attendance" threshold={false} /></div>
                </dd>
              </div>
              <div>
                <dt className="label-caps">Recorded lectures · {data.recordedWeight}%</dt>
                <dd className="mt-1">
                  <span className="text-[20px] font-semibold text-fg tabular-nums">{data.recordedPercentage}%</span>
                  <span className="text-[13px] text-fg-muted tabular-nums"> · {data.watchedRecordedLectures} of {data.totalRecordedLectures} watched</span>
                  <div className="mt-2"><AttendanceRail value={data.recordedPercentage} label="Recorded lecture attendance" threshold={false} /></div>
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-[13px] text-fg-secondary flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
              <span className="inline-flex items-center gap-1 text-fg-muted"><User size={13} aria-hidden="true" /> {data.teacherName}</span>
              <span>Present {data.present}</span><span>Absent {data.absent}</span><span>Late {data.late}</span><span>Leave {data.leave}</span>
            </p>
          </section>

          {/* Date-wise live class attendance */}
          <section className="mb-8">
            <h2 className="text-[16px] font-semibold text-fg mb-3">Live class sessions</h2>
            {(!data.byDate || data.byDate.length === 0) ? (
              <p className="text-[14px] text-fg-muted">No live class sessions recorded yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                <table className="w-full text-[14px]">
                  <thead>
                    <tr className="text-left">
                      <th scope="col" className="px-4 py-3">Date</th>
                      <th scope="col" className="px-4 py-3">Day</th>
                      <th scope="col" className="px-4 py-3">Topic</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDate.map((s, i) => {
                      const x = sessionInfo(s.status);
                      return (
                        <tr key={i}>
                          <td className="px-4 py-3 font-medium text-fg tabular-nums whitespace-nowrap">{fmtDate(s.date)}</td>
                          <td className="px-4 py-3 text-fg-secondary">{dayName(s.date)}</td>
                          <td className="px-4 py-3 text-fg-secondary">{s.topic || "—"}</td>
                          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 font-medium ${x.cls}`}><x.Icon size={14} aria-hidden="true" /> {x.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recorded lectures */}
          <section>
            <h2 className="text-[16px] font-semibold text-fg mb-3">Recorded lectures</h2>
            {(!data.lectures || data.lectures.length === 0) ? (
              <p className="text-[14px] text-fg-muted">No recorded lectures available for this course yet.</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {data.lectures.map((l) => (
                  <li key={l.key} className="py-3 flex items-center gap-3">
                    {l.watched
                      ? <CheckCircle2 size={18} className="text-ok shrink-0" aria-hidden="true" />
                      : <Video size={18} className="text-fg-muted shrink-0" aria-hidden="true" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-fg truncate">{l.title}</p>
                      <p className="text-[12px] text-fg-muted">{l.week != null ? `Week ${l.week} · ` : ""}{fmtDate(l.date)}</p>
                      {!l.watched && (
                        <div className="mt-1.5 max-w-[240px]">
                          <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Number(l.progressPercent) || 0)} aria-label={`${l.title} watched`}>
                            <span style={{ width: `${Math.min(100, Number(l.progressPercent) || 0)}%` }} />
                          </div>
                          <p className="text-[12px] text-fg-muted mt-1 tabular-nums">{Math.round(Number(l.progressPercent) || 0)}% watched · {data.watchThreshold || 70}% marks you present</p>
                        </div>
                      )}
                    </div>
                    {l.watched ? (
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ok"><CheckCircle2 size={14} aria-hidden="true" /> Attended</span>
                    ) : (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[13px] text-fg-muted"><PlayCircle size={14} aria-hidden="true" /> Watch in Recorded Lectures</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
};

// ---- Main: course-wise attendance overview ----
const Attendance = () => {
  const { data, loading, error, reload } = useApi(() => api.student.attendance(), []);
  const [searchParams] = useSearchParams();
  const [active, setActive] = useState(null);

  const rows = useMemo(() => data?.courses || [], [data]);

  // Deep-link from a course card (?course=CODE).
  useEffect(() => {
    const code = searchParams.get("course");
    if (code && rows.length && !active) {
      const found = rows.find((r) => r.courseCode === code);
      if (found) setActive(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const totals = useMemo(() => {
    const n = rows.length || 1;
    const avg = Math.round((rows.reduce((a, b) => a + (b.overallPercentage || 0), 0) / n) * 100) / 100;
    const totalLive = rows.reduce((a, b) => a + (b.totalLiveClasses || 0), 0);
    const totalRecorded = rows.reduce((a, b) => a + (b.totalRecordedLectures || 0), 0);
    const shortCount = rows.filter((b) => (b.overallPercentage || 0) < THRESHOLD).length;
    return { avg, totalLive, totalRecorded, shortCount };
  }, [rows]);

  if (active) {
    return <CourseDetail course={active} onBack={() => { setActive(null); reload(); }} />;
  }

  const header = <PageHeader title="Attendance" subtitle={`Live classes and recorded lectures combined. ${THRESHOLD}% is required in every course.`} icon="CalendarCheck" breadcrumb={["Dashboard", "Attendance"]} />;

  if (loading) {
    return (
      <div>
        {header}
        <div aria-busy="true"><Skeleton className="h-24 w-full mb-6" />{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />)}</div>
      </div>
    );
  }

  return (
    <div>
      {header}

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon="CalendarCheck" title="No enrolled courses" description="Your attendance appears here once you are enrolled in courses." />
      ) : (
        <>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-lg overflow-hidden mb-8">
            {[
              { label: "Average", value: `${totals.avg}%` },
              { label: "Live classes", value: totals.totalLive },
              { label: "Recorded lectures", value: totals.totalRecorded },
              { label: `Below ${THRESHOLD}%`, value: totals.shortCount, bad: totals.shortCount > 0 },
            ].map((s) => (
              <div key={s.label} className="bg-surface p-4 sm:p-5">
                <dt className="label-caps">{s.label}</dt>
                <dd className={`mt-1 text-[24px] font-semibold tabular-nums inline-flex items-center gap-2 ${s.bad ? "text-bad" : "text-fg"}`}>
                  {s.bad && <AlertTriangle size={18} aria-hidden="true" />}{s.value}
                  {s.bad && <span className="sr-only"> courses need attention</span>}
                </dd>
              </div>
            ))}
          </dl>

          <h2 className="text-[16px] font-semibold text-fg mb-1">By course</h2>
          <p className="text-[13px] text-fg-muted mb-3">The line on each bar marks the {THRESHOLD}% requirement.</p>
          <ul className="divide-y divide-line border-y border-line">
            {rows.map((c) => {
              const si = statusInfo(c.status);
              return (
                <li key={c.offeringId}>
                  <button type="button" onClick={() => setActive(c)}
                    className="w-full text-left py-4 grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_160px] gap-x-6 gap-y-3 items-center hover:bg-surface-muted/60 -mx-2 px-2 rounded transition-colors">
                    <div className="min-w-0">
                      <p className="text-[12px] text-fg-muted"><span className="font-semibold text-fg-secondary">{c.courseCode}</span> · {c.teacherName}</p>
                      <p className="text-[15px] font-medium text-fg truncate">{c.courseTitle}</p>
                    </div>
                    <div className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto">
                      <div className="flex items-baseline justify-between text-[13px] mb-1.5 tabular-nums">
                        <span className="font-semibold text-fg">{c.overallPercentage}%</span>
                        <span className="text-fg-muted">Live {c.attendedLiveClasses}/{c.totalLiveClasses} · Recorded {c.watchedRecordedLectures}/{c.totalRecordedLectures}</span>
                      </div>
                      <AttendanceRail value={c.overallPercentage} tone={si.tone} label={`${c.courseCode} attendance`} />
                    </div>
                    <span className={`inline-flex items-center justify-end gap-1.5 text-[13px] font-medium whitespace-nowrap ${si.cls}`}>
                      <si.Icon size={14} aria-hidden="true" /> {c.status}
                      <ChevronRight size={16} className="text-fg-muted ml-1" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default Attendance;

// lms-frontend/src/pages/student/Dashboard.jsx
// Student "Academic Command Center" (G1). Answers, in order: what's today,
// what am I learning, what needs attention, how am I doing, what happened.
// Data: api.student.dashboard() · fees() · activity() — unchanged calls.
import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight, Radio, Clock, CalendarDays, AlertTriangle, CheckCircle2, Wallet,
  FileText, FileQuestion, Award, Megaphone, CalendarCheck, BookOpen, FlaskConical, Bell,
} from "lucide-react";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import useApi from "../../hooks/useApi";
import api, { fileUrl } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const fmtTime = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? "" : t.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); };
const fmtDay = (d) => { const t = new Date(d); return Number.isNaN(t.getTime()) ? "" : t.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); };
const isToday = (d) => { const t = new Date(d); const n = new Date(); return t.toDateString() === n.toDateString(); };
const timeAgo = (d) => {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
};
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const initials = (s = "") => s.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const pkr = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

const ACTIVITY_ICONS = { REGISTRATION: BookOpen, ASSIGNMENT: FileText, QUIZ: FileQuestion, RESULT: Award, ANNOUNCEMENT: Megaphone, ATTENDANCE: CalendarCheck };

function Section({ title, action, children, className = "" }) {
  return (
    <section className={`min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h2 className="text-heading font-semibold text-fg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Rail = ({ value, tone = "brand", label }) => (
  <div className="rail" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
    <span style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone === "brand" ? undefined : `rgb(var(--${tone}))` }} />
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api.student.dashboard(), []);
  const { data: feeData } = useApi(() => api.student.fees(), []);
  const { data: actData } = useApi(() => api.student.activity(), []);

  const stats = data?.stats || {};
  const courses = useMemo(() => data?.courses || [], [data]);

  // Continue learning: a live class first, else the in-progress course with most progress.
  const continueCourse = useMemo(() => {
    if (!courses.length) return null;
    return courses.find((c) => c.liveNow)
      || [...courses].filter((c) => (c.progress ?? 0) < 100).sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))[0]
      || courses[0];
  }, [courses]);

  // Today / upcoming timeline from each course's next live class.
  const timeline = useMemo(() => courses
    .filter((c) => c.liveClass && c.liveClass.scheduledAt)
    .map((c) => ({ id: c.liveClass.id, at: c.liveClass.scheduledAt, live: !!c.liveNow, code: c.courseCode, title: c.courseTitle, teacher: c.teacher }))
    .sort((a, b) => (b.live - a.live) || new Date(a.at) - new Date(b.at)), [courses]);
  const today = timeline.filter((t) => t.live || isToday(t.at));
  const upcoming = timeline.filter((t) => !t.live && !isToday(t.at) && new Date(t.at) > new Date()).slice(0, 3);

  const fee = useMemo(() => {
    const challans = feeData?.challans || [];
    if (!challans.length) return null;
    const unpaid = challans.filter((c) => (c.status || "").toUpperCase() !== "PAID");
    return { allPaid: unpaid.length === 0, unpaidCount: unpaid.length, totalDue: unpaid.reduce((s, c) => s + (c.amountDue ?? c.totalAmount ?? 0), 0), notice: feeData?.challans?.find((c) => c.notice)?.notice };
  }, [feeData]);

  const attention = useMemo(() => {
    const items = [];
    if ((stats.pendingAssignments ?? 0) > 0) items.push({ tone: "warning", Icon: FileText, label: `${stats.pendingAssignments} assignment${stats.pendingAssignments === 1 ? "" : "s"} to submit`, to: "/student/assignments", status: "Due" });
    if (fee && !fee.allPaid) items.push({ tone: "error", Icon: Wallet, label: `${pkr(fee.totalDue)} fee outstanding`, sub: fee.notice, to: "/student/account", status: "Unpaid" });
    if ((stats.overallAttendance ?? 100) < 75 && (stats.enrolledCourses ?? 0) > 0) items.push({ tone: "warning", Icon: CalendarCheck, label: `Attendance is ${stats.overallAttendance}% — below the 75% requirement`, to: "/student/attendance", status: "At risk" });
    return items;
  }, [stats, fee]);

  const activity = useMemo(() => (actData?.timeline || []).slice(0, 6), [actData]);
  const cgpa = Number(stats.cgpa ?? 0);
  const firstName = (user?.name || user?.username || "").split(/\s+/)[0];

  const summary = [
    today.some((t) => t.live) ? "a class is live now" : today.length ? `${today.length} class${today.length === 1 ? "" : "es"} today` : null,
    (stats.pendingAssignments ?? 0) > 0 ? `${stats.pendingAssignments} pending assignment${stats.pendingAssignments === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="space-y-8" aria-busy="true" aria-label="Loading your dashboard">
        <div className="space-y-3"><Skeleton className="h-4 w-40" /><Skeleton className="h-10 w-80 max-w-full" /><Skeleton className="h-4 w-64" /></div>
        <div className="grid lg:grid-cols-12 gap-8">
          <Skeleton className="h-56 lg:col-span-7 rounded-lg" />
          <div className="lg:col-span-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
        </div>
      </div>
    );
  }
  if (error) return <ErrorState description={error} onRetry={reload} />;

  return (
    <div className="space-y-12">
      {/* ===== Top strip ===== */}
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-line pb-8">
        <div className="min-w-0">
          <p className="label-caps">
            <time dateTime={new Date().toISOString().slice(0, 10)}>{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</time>
            {stats.currentSemester ? <> · {stats.currentSemester}</> : null}
          </p>
          <h1 className="mt-2 font-serif text-[32px] leading-9 sm:text-display font-normal tracking-[-0.01em] text-fg">
            {greeting()}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-fg-muted">
            {summary.length ? `You have ${summary.join(" and ")}.` : "Nothing urgent today."}
            {user?.program ? <span className="hidden sm:inline"> · {user.program}</span> : null}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-px bg-line border border-line rounded-lg overflow-hidden shrink-0 w-full sm:w-auto">
          {[
            ["CGPA", cgpa.toFixed(2), "/student/results"],
            ["Attendance", `${stats.overallAttendance ?? 0}%`, "/student/attendance"],
            ["Credits", stats.creditsEarned ?? 0, "/student/scheme"],
          ].map(([k, v, to]) => (
            <Link key={k} to={to} className="bg-surface px-5 py-3 hover:bg-surface-muted transition-colors min-w-[104px]">
              <dt className="label-caps">{k}</dt>
              <dd className="mt-1 text-[22px] leading-7 font-semibold tabular-nums text-fg">{v}</dd>
            </Link>
          ))}
        </dl>
      </header>

      <div className="grid lg:grid-cols-12 gap-x-10 gap-y-12">
        {/* ===== Continue learning ===== */}
        <Section title="Continue learning" className="lg:col-span-7"
          action={<Link to="/student/courses" className="link text-[14px]">All courses</Link>}>
          {!continueCourse ? (
            <div className="border border-dashed border-line rounded-lg px-6 py-10 text-center">
              <p className="text-sub font-semibold">No courses yet</p>
              <p className="mt-1 text-[14px] text-fg-muted">Your enrolled courses will appear here once your enrolment is confirmed.</p>
            </div>
          ) : (
            <article className="relative bg-surface border border-line rounded-lg overflow-hidden">
              <div className="h-1 bg-primary-600" aria-hidden="true" />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
                  <span className="font-medium text-fg-secondary tabular-nums">{continueCourse.courseCode}</span>
                  {continueCourse.creditHours != null && <><span aria-hidden="true">·</span><span>{continueCourse.creditHours} credit hours</span></>}
                  {continueCourse.semester && <><span aria-hidden="true">·</span><span>{continueCourse.semester}</span></>}
                  {continueCourse.liveNow && <span className="badge badge-accent ml-auto"><span className="live-dot" aria-hidden="true" /> Live now</span>}
                </div>
                <h3 className="mt-3 font-serif text-[28px] leading-[34px] font-normal text-fg">{continueCourse.courseTitle}</h3>
                <div className="mt-3 flex items-center gap-2.5 text-[14px] text-fg-secondary">
                  {continueCourse.teacherPhotoUrl
                    ? <img src={fileUrl(continueCourse.teacherPhotoUrl)} alt="" className="h-7 w-7 rounded-full object-cover" loading="lazy" />
                    : <span className="h-7 w-7 rounded-full bg-surface-muted text-fg-secondary text-[11px] font-semibold inline-flex items-center justify-center" aria-hidden="true">{initials(continueCourse.teacher)}</span>}
                  <span>{continueCourse.teacher || "Instructor to be assigned"}</span>
                </div>
                <div className="mt-6">
                  <div className="flex items-baseline justify-between text-[13px] mb-2">
                    <span className="text-fg-muted">
                      {(continueCourse.totalLectures ?? 0) > 0
                        ? `${continueCourse.completedLectures ?? 0} of ${continueCourse.totalLectures} lectures completed`
                        : "Course progress"}
                    </span>
                    <span className="font-semibold tabular-nums text-fg">{Math.round(continueCourse.progress ?? 0)}%</span>
                  </div>
                  <Rail value={continueCourse.progress ?? 0} label={`${continueCourse.courseTitle} progress`} />
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  {continueCourse.liveNow && continueCourse.liveClass ? (
                    <button type="button" onClick={() => navigate(`/student/live-classes?join=${continueCourse.liveClass.id}`)} className="btn-primary">
                      <Radio size={16} aria-hidden="true" /> Join live class
                    </button>
                  ) : (
                    <button type="button" onClick={() => navigate(`/student/courses/${continueCourse.offeringId}`)} className="btn-primary">
                      Continue <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )}
                  {continueCourse.hasLab && (
                    <button type="button" onClick={() => navigate("/student/lab-tasks")} className="btn-secondary"><FlaskConical size={16} aria-hidden="true" /> Lab tasks</button>
                  )}
                </div>
              </div>
            </article>
          )}
        </Section>

        {/* ===== Today ===== */}
        <Section title="Today" className="lg:col-span-5"
          action={<Link to="/student/schedule" className="link text-[14px]">Timetable</Link>}>
          {today.length === 0 && upcoming.length === 0 ? (
            <p className="flex items-center gap-2 text-[14px] text-fg-muted border-y border-line py-4"><CalendarDays size={16} aria-hidden="true" /> No classes scheduled.</p>
          ) : (
            <ol className="border-y border-line divide-y divide-[rgb(var(--border))]">
              {[...today, ...upcoming].map((t) => (
                <li key={`${t.id}-${t.at}`} className={`grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 py-3 ${t.live ? "bg-brass-soft -mx-3 px-3" : ""}`}>
                  <span className="text-[13px] leading-5 tabular-nums text-fg-secondary">
                    {t.live ? <span className="inline-flex items-center gap-1.5 font-semibold text-bad"><span className="live-dot" aria-hidden="true" />Live</span> : isToday(t.at) ? fmtTime(t.at) : <>{fmtDay(t.at).split(",")[0]}<br /><span className="text-fg-muted">{fmtTime(t.at)}</span></>}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] leading-5 font-medium text-fg truncate">{t.title}</span>
                    <span className="block text-[13px] leading-5 text-fg-muted truncate">{t.code}{t.teacher ? ` · ${t.teacher}` : ""}</span>
                  </span>
                  {t.live
                    ? <button type="button" onClick={() => navigate(`/student/live-classes?join=${t.id}`)} className="btn-primary btn-compact">Join</button>
                    : <Clock size={15} className="text-fg-muted" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          )}
        </Section>

        {/* ===== Needs attention ===== */}
        <Section title="Needs attention" className="lg:col-span-7">
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-[14px] text-fg-muted border-y border-line py-4"><CheckCircle2 size={16} className="text-ok" aria-hidden="true" /> You’re all caught up.</p>
          ) : (
            <ul className="border-y border-line divide-y divide-[rgb(var(--border))]">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link to={a.to} className="group flex items-center gap-4 py-3 hover:bg-surface -mx-3 px-3 rounded transition-colors">
                    <a.Icon size={17} className="text-fg-muted shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] leading-5 font-medium text-fg">{a.label}</span>
                      {a.sub && <span className="block text-[13px] leading-5 text-fg-muted truncate">{a.sub}</span>}
                    </span>
                    <span className={`badge badge-${a.tone}`}><AlertTriangle size={12} aria-hidden="true" />{a.status}</span>
                    <ArrowRight size={15} className="text-fg-muted group-hover:text-fg shrink-0" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ===== Recent activity ===== */}
        <Section title="Recent activity" className="lg:col-span-5"
          action={<Link to="/student/activity" className="link text-[14px]">View all</Link>}>
          {activity.length === 0 ? (
            <p className="text-[14px] text-fg-muted border-y border-line py-4">No recent activity.</p>
          ) : (
            <ol className="relative border-l border-line ml-2 space-y-5">
              {activity.map((a, i) => {
                const Icon = ACTIVITY_ICONS[a.type] || Bell;
                return (
                  <li key={i} className="pl-6 relative">
                    <span className="absolute -left-[9px] top-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-canvas border border-line text-fg-muted" aria-hidden="true"><Icon size={10} /></span>
                    <p className="text-[14px] leading-5 text-fg">{a.title}</p>
                    <time className="text-[12px] leading-4 text-fg-muted">{timeAgo(a.at)}</time>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>

        {/* ===== Academic progress ===== */}
        <Section title="Academic progress" className="lg:col-span-12"
          action={<Link to="/student/results" className="link text-[14px]">Results</Link>}>
          {courses.length === 0 ? (
            <p className="text-[14px] text-fg-muted border-y border-line py-4">Progress appears once you are enrolled in courses.</p>
          ) : (
            <ul className="grid md:grid-cols-2 gap-x-10 border-t border-line">
              {courses.map((c) => (
                <li key={c.registrationId} className="border-b border-line">
                  <Link to={`/student/courses/${c.offeringId}`} className="group grid grid-cols-[minmax(0,1fr)_56px] items-center gap-x-4 gap-y-2 py-4">
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-5 font-medium text-fg truncate group-hover:text-brand">{c.courseTitle}</span>
                      <span className="block text-[12px] leading-4 text-fg-muted truncate">{c.courseCode}{c.teacher ? ` · ${c.teacher}` : ""}</span>
                    </span>
                    <span className="text-right text-[14px] font-semibold tabular-nums text-fg">{Math.round(c.progress ?? 0)}%</span>
                    <span className="col-span-2"><Rail value={c.progress ?? 0} label={`${c.courseTitle} progress`} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
};

export default Dashboard;

// lms-frontend/src/pages/student/Courses.jsx
// My Courses (G2): compact academic list by default (code, title,
// instructor, credits, attendance rail, status, open), optional shelf
// view. Search and view preference persist across navigation.
// Data: api.student.courses() — unchanged.
import { Search, LayoutList, LayoutGrid, FlaskConical, ArrowRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api, { fileUrl } from "../../services/api";
import { formatCredits, courseHasLab } from "../../utils/credit";

const PREF = "aust_courses_view";
const SEARCH = "aust_courses_q";
const read = (k, d) => { try { return window.sessionStorage.getItem(k) ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { window.sessionStorage.setItem(k, v); } catch (_) { /* ignore */ } };

const teacherName = (o) => o?.teacher?.profile?.fullName || o?.teacher?.username || null;
const teacherPhoto = (o) => (o?.teacher?.profile?.photoUrl ? fileUrl(o.teacher.profile.photoUrl) : null);
const initials = (s = "") => s.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

const Avatar = ({ src, name }) => (src
  ? <img src={src} alt="" loading="lazy" className="h-8 w-8 rounded-full object-cover shrink-0" />
  : <span className="h-8 w-8 rounded-full bg-surface-muted text-fg-secondary text-[11px] font-semibold inline-flex items-center justify-center shrink-0" aria-hidden="true">{initials(name || "TBA")}</span>);

function AttendanceRail({ value }) {
  if (value == null) return <span className="text-[13px] text-fg-muted">No sessions yet</span>;
  const tone = value >= 75 ? "success" : value >= 65 ? "warning" : "error";
  return (
    <span className="flex items-center gap-3 min-w-0">
      <span className="rail flex-1 min-w-[64px]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Attendance">
        <span style={{ width: `${value}%`, background: `rgb(var(--${tone}))` }} />
      </span>
      <span className="text-[13px] font-medium tabular-nums text-fg w-10 text-right">{value}%</span>
    </span>
  );
}

const StatusText = ({ status }) => {
  const s = String(status || "").toUpperCase();
  const map = { ENROLLED: ["badge-success", "Enrolled"], COMPLETED: ["badge-neutral", "Completed"], DROPPED: ["badge-error", "Dropped"], WITHDRAWN: ["badge-warning", "Withdrawn"] };
  const [cls, label] = map[s] || ["badge-neutral", s ? s[0] + s.slice(1).toLowerCase() : "—"];
  return <span className={`badge ${cls}`}><span className="status-dot" aria-hidden="true" />{label}</span>;
};

const Courses = () => {
  const navigate = useNavigate();
  const [view, setView] = useState(() => read(PREF, "list"));
  const [search, setSearch] = useState(() => read(SEARCH, ""));
  const { data, loading, error, reload } = useApi(() => api.student.courses(), []);

  useEffect(() => write(PREF, view), [view]);
  useEffect(() => write(SEARCH, search), [search]);

  const courses = useMemo(() => (data?.courses || []).map((r) => {
    const o = r.offering || {};
    const c = o.course || {};
    const att = r.attendance || o.attendance || null;
    return {
      key: `course-${r.id}`,
      offeringId: r.offeringId,
      code: c.code || "—",
      title: c.title || "Untitled course",
      credits: c.creditHours != null ? formatCredits(c) : "—",
      program: c.program?.shortForm || c.program?.name || "",
      semester: c.semester?.number ? `Semester ${c.semester.number}` : "",
      instructor: teacherName(o),
      instructorPhoto: teacherPhoto(o),
      students: o._count?.registrations ?? null,
      status: r.status,
      attendance: att?.percentage ?? null,
      hasLab: courseHasLab(c),
    };
  }), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => [c.title, c.code, c.instructor].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [courses, search]);

  const open = (c) => navigate(`/student/courses/${c.offeringId}`);

  return (
    <div>
      <PageHeader
        title="My courses"
        subtitle={loading ? "Loading your enrolled courses…" : `${courses.length} course${courses.length === 1 ? "" : "s"} this term`}
        breadcrumb={["Overview", "My courses"]}
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-6">
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <label htmlFor="course-search" className="sr-only">Search courses</label>
          <input id="course-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, code or instructor"
            className="input-base w-full pl-9 pr-9" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded text-fg-muted hover:text-fg">
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Layout" className="inline-flex rounded border border-line bg-surface p-0.5 self-start">
          {[["list", "List", LayoutList], ["grid", "Shelf", LayoutGrid]].map(([k, label, Icon]) => (
            <button key={k} type="button" role="radio" aria-checked={view === k} onClick={() => setView(k)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-sm text-[13px] font-medium ${view === k ? "bg-brand-soft text-brand" : "text-fg-secondary hover:text-fg"}`}>
              <Icon size={15} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="border-y border-line divide-y divide-[rgb(var(--border))]" aria-busy="true" aria-label="Loading courses">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-4"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-32 hidden md:block" /><Skeleton className="h-2 w-28 hidden md:block" /></div>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Couldn’t load your courses" description={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        search
          ? <EmptyState icon="SearchX" title={`No results for “${search}”`} description="Check the spelling, try fewer words, or search by course code." action={() => setSearch("")} actionLabel="Clear search" />
          : <EmptyState icon="BookOpen" title="No courses yet" description="Your enrolled courses will appear here once your enrolment is confirmed." />
      ) : view === "list" ? (
        <div className="border-t border-line">
          {/* Column headings (desktop) */}
          <div className="hidden md:grid grid-cols-[96px_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_112px_40px] gap-6 px-1 py-2 label-caps border-b border-line">
            <span>Code</span><span>Course</span><span>Instructor</span><span>Attendance</span><span>Status</span><span className="sr-only">Open</span>
          </div>
          <ul className="divide-y divide-[rgb(var(--border))] border-b border-line">
            {filtered.map((c) => (
              <li key={c.key}>
                <button type="button" onClick={() => open(c)}
                  className="group w-full text-left grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[96px_minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_112px_40px] items-center gap-x-6 gap-y-3 px-1 py-4 hover:bg-surface transition-colors">
                  <span className="hidden md:block text-[13px] font-medium tabular-nums text-fg-secondary">{c.code}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] leading-6 font-semibold text-fg group-hover:text-brand truncate">{c.title}</span>
                    <span className="block text-[13px] leading-5 text-fg-muted truncate">
                      <span className="md:hidden tabular-nums">{c.code} · </span>{c.credits} credit hours{c.semester ? ` · ${c.semester}` : ""}
                      {c.hasLab && <span className="inline-flex items-center gap-1 ml-2 text-fg-secondary"><FlaskConical size={12} aria-hidden="true" />Theory + Lab</span>}
                    </span>
                  </span>
                  <span className="md:hidden"><StatusText status={c.status} /></span>
                  <span className="hidden md:flex items-center gap-2.5 min-w-0 text-[14px] text-fg-secondary">
                    <Avatar src={c.instructorPhoto} name={c.instructor} /><span className="truncate">{c.instructor || "To be assigned"}</span>
                  </span>
                  <span className="col-span-2 md:col-span-1"><AttendanceRail value={c.attendance} /></span>
                  <span className="hidden md:block"><StatusText status={c.status} /></span>
                  <ArrowRight size={16} className="hidden md:block text-fg-muted group-hover:text-brand justify-self-end" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.key}>
              <button type="button" onClick={() => open(c)} className="group w-full h-full text-left flex flex-col bg-surface border border-line rounded-lg hover:border-line-strong transition-colors overflow-hidden">
                <span className="block h-1 bg-primary-600" aria-hidden="true" />
                <span className="flex-1 p-5">
                  <span className="flex items-center justify-between gap-2 text-[13px] text-fg-muted">
                    <span className="font-medium tabular-nums text-fg-secondary">{c.code}</span>
                    <StatusText status={c.status} />
                  </span>
                  <span className="mt-3 block font-serif text-[22px] leading-7 text-fg group-hover:text-brand">{c.title}</span>
                  <span className="mt-1 block text-[13px] text-fg-muted">{c.credits} credit hours{c.hasLab ? " · Theory + Lab" : ""}</span>
                  <span className="mt-4 flex items-center gap-2.5 text-[14px] text-fg-secondary"><Avatar src={c.instructorPhoto} name={c.instructor} />{c.instructor || "To be assigned"}</span>
                </span>
                <span className="px-5 py-4 border-t border-line"><AttendanceRail value={c.attendance} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Courses;

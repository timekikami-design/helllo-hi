// lms-frontend/src/pages/student/Library.jsx
// Course library: a catalogue list of enrolled courses (code, title,
// instructor, resource count) and, per course, a searchable resource list
// with type icon + label. Data: student.library, student.libraryCourse.
import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, Video, Link2, Download, Search, File, Eye, ArrowLeft, ChevronRight, X } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import ResourceViewer from "../../components/common/ResourceViewer";
import useApi from "../../hooks/useApi";
import api from "../../services/api";
import { fileUrl } from "../../services/api";

const typeMeta = (t) => {
  const v = (t || "").toUpperCase();
  if (v === "VIDEO") return { icon: Video, label: "Video" };
  if (v === "LINK" || v === "URL") return { icon: Link2, label: "Link" };
  if (v === "FILE" || v === "DOCUMENT" || v === "PDF") return { icon: FileText, label: v === "PDF" ? "PDF" : "Document" };
  return { icon: File, label: "File" };
};

const resolveUrl = (it) => {
  if (it.url && /^https?:\/\//i.test(it.url)) return it.url;
  if (it.filePath && /^https?:\/\//i.test(it.filePath)) return it.filePath;
  if (it.filePath) return fileUrl(it.filePath);
  if (it.url) return fileUrl(it.url);
  if (it.fileName) return fileUrl(it.fileName);
  return null;
};

const fmtDate = (d) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};

const Library = () => {
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.student.library(), []);

  // Selected course → opens its resource list.
  const [active, setActive] = useState(null); // { offeringId, ... }
  const [resData, setResData] = useState(null);
  const [resLoading, setResLoading] = useState(false);
  const [resError, setResError] = useState("");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState(null);

  const courses = useMemo(() => data?.courses || [], [data]);

  // Deep-link: ?course=<code> opens that course directly.
  useEffect(() => {
    const code = searchParams.get("course");
    if (code && courses.length) {
      const found = courses.find((c) => c.courseCode === code);
      if (found) openCourse(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  const openCourse = (course) => {
    setActive(course);
    setResLoading(true);
    setResError("");
    setQ("");
    api.student.libraryCourse(course.offeringId)
      .then((r) => setResData(r))
      .catch((e) => setResError(e.message || "Failed to load resources"))
      .finally(() => setResLoading(false));
  };

  const closeCourse = () => { setActive(null); setResData(null); };

  const filteredResources = useMemo(() => {
    const items = resData?.resources || [];
    const ql = q.trim().toLowerCase();
    if (!ql) return items;
    return items.filter((it) => (it.title || "").toLowerCase().includes(ql) || (it.fileName || "").toLowerCase().includes(ql));
  }, [resData, q]);

  const header = (sub, crumbs) => <PageHeader title="Course library" subtitle={sub} icon="BookOpen" breadcrumb={crumbs} />;

  if (loading) {
    return (
      <div>
        {header("Resources for the courses you are enrolled in.", ["Dashboard", "Course library"])}
        <div aria-busy="true">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />)}</div>
      </div>
    );
  }

  // ---- Course detail view ----
  if (active) {
    const total = resData?.total ?? active.resourceCount;
    return (
      <div>
        <button type="button" onClick={closeCourse} className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg mb-4"><ArrowLeft size={14} aria-hidden="true" /> All courses</button>
        {header(`${active.courseCode} · ${active.teacherName} · ${active.semester} · ${total} resource${total === 1 ? "" : "s"}`, ["Dashboard", "Course library", active.courseCode])}

        <div className="relative mb-5 max-w-md">
          <label htmlFor="lib-q" className="sr-only">Search resources</label>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" aria-hidden="true" />
          <input id="lib-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search resources" className="input-base !pl-9 !pr-9" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded text-fg-muted hover:text-fg"><X size={14} aria-hidden="true" /></button>}
        </div>

        {resLoading ? (
          <div aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2" />)}</div>
        ) : resError ? (
          <ErrorState description={resError} onRetry={() => openCourse(active)} />
        ) : filteredResources.length === 0 ? (
          q ? (
            <EmptyState icon="Search" title="No matching resources" description={`Nothing matches “${q}”.`} action={<button type="button" className="btn btn-secondary" onClick={() => setQ("")}>Clear search</button>} />
          ) : (
            <EmptyState icon="BookOpen" title="No resources yet" description="Resources appear here when your instructor uploads them." />
          )
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {filteredResources.map((it, ii) => {
              const m = typeMeta(it.type);
              const Icon = m.icon;
              const url = resolveUrl(it);
              return (
                <li key={it.id || ii} className="py-3 flex items-center gap-3">
                  <Icon size={18} className="text-fg-muted shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-fg truncate">{it.title}</p>
                    <p className="text-[12px] text-fg-muted">{m.label}{it.week != null ? ` · Week ${it.week}` : ""}{it.createdAt ? ` · ${fmtDate(it.createdAt)}` : ""}</p>
                  </div>
                  {url ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => setViewing({ url, title: it.title, fileName: it.fileName })} className="btn btn-secondary btn-compact"><Eye size={14} aria-hidden="true" /> View<span className="sr-only"> {it.title}</span></button>
                      <a href={url} target="_blank" rel="noreferrer" download aria-label={`Download ${it.title}`} className="btn-icon"><Download size={16} aria-hidden="true" /></a>
                    </div>
                  ) : (
                    <span className="text-[13px] text-fg-muted">Unavailable</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <ResourceViewer open={!!viewing} onClose={() => setViewing(null)} resource={viewing} />
      </div>
    );
  }

  // ---- Course catalogue ----
  return (
    <div>
      {header("Resources for the courses you are enrolled in.", ["Dashboard", "Course library"])}

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : courses.length === 0 ? (
        <EmptyState icon="BookOpen" title="No enrolled courses" description="Once you are enrolled in courses, their libraries will appear here." />
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {courses.map((c) => (
            <li key={c.offeringId}>
              <button type="button" onClick={() => openCourse(c)}
                className="w-full text-left py-4 -mx-2 px-2 rounded grid grid-cols-[72px_1fr_auto] sm:grid-cols-[96px_1fr_160px_auto] gap-x-4 items-center hover:bg-surface-muted/60 transition-colors">
                <span className="text-[13px] font-semibold text-fg-secondary tabular-nums">{c.courseCode}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-fg truncate">{c.courseTitle}</span>
                  <span className="block text-[12px] text-fg-muted truncate">{c.teacherName} · {c.semester}</span>
                </span>
                <span className="hidden sm:block text-[13px] text-fg-secondary tabular-nums">{c.resourceCount} resource{c.resourceCount === 1 ? "" : "s"}</span>
                <ChevronRight size={16} className="text-fg-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Library;

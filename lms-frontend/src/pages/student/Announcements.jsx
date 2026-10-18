import { AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api from "../../services/api";

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const Announcements = () => {
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.student.announcements(), []);
  const [filter, setFilter] = useState(searchParams.get("course") || "All");

  // Deep-link from a course card: preset the course filter via ?course=<code>
  useEffect(() => {
    const c = searchParams.get("course");
    if (c) setFilter(c);
  }, [searchParams]);

  const announcements = useMemo(() => data?.announcements || [], [data]);
  const categories = useMemo(() => {
    const cats = new Set();
    announcements.forEach((a) => cats.add(a.courseCode || "General"));
    return ["All", ...cats];
  }, [announcements]);
  const filtered = filter === "All" ? announcements : announcements.filter((a) => (a.courseCode || "General") === filter);

  if (loading) {
    return (
      <div>
        <PageHeader title="Announcements" subtitle="News from the university and your instructors." icon="Megaphone" breadcrumb={["Dashboard", "Announcements"]} />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Announcements" subtitle="News from the university and your instructors." icon="Megaphone" breadcrumb={["Dashboard", "Announcements"]} />

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : announcements.length === 0 ? (
        <EmptyState icon="Megaphone" title="No announcements" description="There are no announcements for your courses yet." />
      ) : (
        <>
          {categories.length > 2 && (
            <label className="inline-flex items-center gap-2 text-[13px] text-fg-secondary mb-6">
              Show
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input-base !w-auto pr-8">
                {categories.map((c) => <option key={c} value={c}>{c === "All" ? "All announcements" : c}</option>)}
              </select>
            </label>
          )}

          {filtered.length === 0 ? (
            <EmptyState icon="Megaphone" title="Nothing for this course" description="No announcements match this filter." action={
              <button type="button" className="btn btn-secondary" onClick={() => setFilter("All")}>Show all</button>
            } />
          ) : (
            <ol className="divide-y divide-line border-y border-line max-w-3xl">
              {filtered.map((a) => (
                <li key={a.id} className={`py-5 ${a.important ? "pl-4 border-l-2 border-l-bad -ml-4" : ""}`}>
                  <p className="text-[12px] text-fg-muted flex flex-wrap items-center gap-x-2">
                    {a.important && <span className="inline-flex items-center gap-1 font-semibold text-bad"><AlertTriangle size={12} aria-hidden="true" /> University-wide</span>}
                    <span className="font-semibold text-fg-secondary">{a.courseCode || "General"}</span>
                    <span aria-hidden="true">·</span>
                    <time dateTime={a.createdAt}>{fmtDate(a.createdAt)}</time>
                  </p>
                  <h2 className="text-[16px] font-semibold text-fg mt-1">{a.title}</h2>
                  <p className="text-[14px] leading-6 text-fg-secondary mt-1 whitespace-pre-line">{a.message}</p>
                  <p className="text-[12px] text-fg-muted mt-2">{a.author}{a.authorRole ? ` · ${a.authorRole}` : ""}</p>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
};

export default Announcements;

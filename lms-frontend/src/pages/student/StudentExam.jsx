// lms-frontend/src/pages/student/StudentExam.jsx
// Mid-term / Final-term overview for students. Built only on real data:
// the mid/final components from student.resultsAll for every enrolled
// course. There is no student online-paper API — papers are conducted per
// the date sheet issued by the Exam Controller — so this page does not
// pretend to host an exam. (Previously it rendered mock exams and a
// simulated submission; that has been removed.)
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, Info, Lock } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api from "../../services/api";

const KIND = {
  Mid: { title: "Mid-term exams", key: "mid", short: "Mid-term" },
  Final: { title: "Final-term exams", key: "final", short: "Final-term" },
};

const StudentExam = ({ kind = "Mid" }) => {
  const k = KIND[kind] || KIND.Mid;
  const { data, loading, error, reload } = useApi(() => api.student.resultsAll(), []);

  const rows = useMemo(() => {
    const out = [];
    (data?.terms || []).forEach((t) => {
      (t.rows || []).forEach((r) => {
        const comps = r.breakdown?.components || r.breakdown?.categories || [];
        const c = comps.find((x) => x.key === k.key || x.category === k.key);
        out.push({
          id: `${t.termCode}-${r.offeringId}`,
          term: t.termTitle,
          code: r.courseCode,
          title: r.courseTitle,
          weight: c?.weight,
          obtained: c?.obtained,
          total: c?.total,
          graded: c && c.obtained != null,
          published: !!r.published,
        });
      });
    });
    return out;
  }, [data, k.key]);

  const terms = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { if (!m.has(r.term)) m.set(r.term, []); m.get(r.term).push(r); });
    return [...m.entries()];
  }, [rows]);

  const graded = rows.filter((r) => r.graded).length;

  return (
    <div>
      <PageHeader
        title={k.title}
        subtitle={rows.length ? `${graded} of ${rows.length} courses have ${k.short.toLowerCase()} marks uploaded.` : `${k.short} marks for your enrolled courses.`}
        icon="FileText"
        breadcrumb={["Dashboard", k.title]}
      />

      <p className="flex items-start gap-2 text-[14px] text-fg-secondary rounded border border-line bg-surface p-4 mb-8 max-w-3xl">
        <Info size={16} className="text-note mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          {k.short} papers are held on the date sheet issued by the Exam Controller. Marks appear here as soon as your teacher uploads them;
          your final grade is shown in <Link to="/student/results" className="link">Results</Link> after the result is declared.
        </span>
      </p>

      {loading ? (
        <div aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full mb-2" />)}</div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState icon="FileText" title="No courses yet" description={`${k.short} marks appear here once you are enrolled in courses.`} />
      ) : terms.map(([term, list]) => (
        <section key={term} aria-labelledby={`t-${term}`} className="mb-10 last:mb-0">
          <h2 id={`t-${term}`} className="text-[16px] font-semibold text-fg mb-3">{term}</h2>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="px-4 py-3 w-28">Code</th>
                  <th scope="col" className="px-4 py-3">Course</th>
                  <th scope="col" className="px-4 py-3 text-right">Weight</th>
                  <th scope="col" className="px-4 py-3 text-right">Marks</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-semibold text-fg-secondary tabular-nums">{r.code}</td>
                    <td className="px-4 py-3 text-fg">{r.title}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-fg-secondary">{r.weight != null ? `${r.weight}%` : "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-fg">{r.graded ? `${r.obtained} / ${r.total ?? "—"}` : "—"}</td>
                    <td className="px-4 py-3">
                      {r.graded ? (
                        <span className="inline-flex items-center gap-1.5 text-ok font-medium"><CheckCircle2 size={14} aria-hidden="true" /> Marks uploaded</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-fg-muted"><Clock size={14} aria-hidden="true" /> Awaiting marks</span>
                      )}
                      {!r.published && r.graded && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[12px] text-fg-muted"><Lock size={12} aria-hidden="true" /> Result not declared</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};

export default StudentExam;

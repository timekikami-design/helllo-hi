// lms-frontend/src/pages/student/Quizzes.jsx
// Quizzes list (status-grouped rows) and a focused quiz runner: question
// navigator, answered/flagged state, countdown from the server start time
// (warning at 5 min, error at 1 min, auto-submit at 0) and a submit
// confirmation. API calls and the answers payload are unchanged.
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Clock, Award, CheckCircle2, AlertCircle, Play, Loader2, ChevronLeft, ChevronRight, Flag, X, Hourglass } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import { useToast } from "../../context/ToastContext";
import useApi from "../../hooks/useApi";
import api from "../../services/api";

/* Backend attempt status: none → Available, IN_PROGRESS → In progress,
   SUBMITTED → Under review (manual), GRADED → Completed. */
const stateOf = (q) => {
  if (!q.attempt) return "AVAILABLE";
  return q.attempt.status; // IN_PROGRESS | SUBMITTED | GRADED
};
const STATE_META = {
  AVAILABLE: { label: "Not started", icon: AlertCircle, cls: "text-warn" },
  IN_PROGRESS: { label: "In progress", icon: Clock, cls: "text-note" },
  SUBMITTED: { label: "Under review", icon: Hourglass, cls: "text-note" },
  GRADED: { label: "Completed", icon: CheckCircle2, cls: "text-ok" },
};

const fmtClock = (s) => {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

const Quizzes = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.student.quizzes(), []);
  const [search, setSearch] = useState(searchParams.get("course") || "");
  const [filter, setFilter] = useState("All");

  // Deep-link from a course card: preset the course filter via ?course=<code>
  useEffect(() => {
    const c = searchParams.get("course");
    if (c) setSearch(c);
  }, [searchParams]);

  // Quiz-taking session state
  const [session, setSession] = useState(null); // { quiz, questions, attempt }
  const [answers, setAnswers] = useState({});
  const [starting, setStarting] = useState(null); // quiz id being started
  const [submitting, setSubmitting] = useState(false);
  const [resultView, setResultView] = useState(null); // completed quiz to view

  const quizzes = useMemo(() => data?.quizzes || [], [data]);

  const totals = useMemo(() => {
    const t = { total: quizzes.length, available: 0, completed: 0 };
    quizzes.forEach((q) => {
      const s = stateOf(q);
      if (s === "AVAILABLE" || s === "IN_PROGRESS") t.available++;
      else if (s === "GRADED" || s === "SUBMITTED") t.completed++;
    });
    return t;
  }, [quizzes]);

  const filtered = useMemo(() => {
    return quizzes
      .filter((q) => {
        if (filter === "All") return true;
        const s = stateOf(q);
        if (filter === "Available") return s === "AVAILABLE" || s === "IN_PROGRESS";
        if (filter === "Completed") return s === "GRADED" || s === "SUBMITTED";
        return true;
      })
      .filter((q) => `${q.title} ${q.courseCode}`.toLowerCase().includes(search.toLowerCase()));
  }, [quizzes, filter, search]);

  const startQuiz = async (quiz) => {
    setStarting(quiz.id);
    try {
      const res = await api.student.startQuiz(quiz.id);
      setSession({ quiz: res.quiz, questions: res.questions || [], attempt: res.attempt, startedAt: res.attempt?.startedAt || new Date().toISOString() });
      setAnswers({});
    } catch (e) {
      toast(e.message || "Could not start quiz", { type: "error" });
    } finally {
      setStarting(null);
    }
  };

  const submitQuiz = async () => {
    if (!session) return;
    // Backend expects an object keyed by questionId. For MCQ/TRUEFALSE the
    // value is the selected option index (as string); for SHORT it is text.
    const payload = {};
    session.questions.forEach((q) => {
      const v = answers[q.id];
      if (v != null && v !== "") payload[String(q.id)] = String(v);
    });
    setSubmitting(true);
    try {
      const res = await api.student.submitQuiz(session.quiz.id, payload);
      if (res.autoGraded || res.attempt?.status === "GRADED") {
        toast(`Quiz submitted — scored ${res.attempt?.score ?? res.score}/${res.attempt?.maxScore ?? res.maxScore}`, { type: "success" });
      } else {
        toast("Quiz submitted — pending review for short answers", { type: "success" });
      }
      setSession(null);
      await reload();
    } catch (e) {
      toast(e.message || "Submission failed", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const segBtn = (on) => `h-9 px-3 rounded-sm text-[13px] font-medium transition-colors ${on ? "bg-brand-soft text-brand" : "text-fg-secondary hover:text-fg"}`;

  return (
    <div>
      <PageHeader
        title="Quizzes"
        subtitle={quizzes.length ? `${totals.available} to take · ${totals.completed} completed · average ${avgScore(quizzes)}` : "Quizzes from your registered courses."}
        icon="FileQuestion"
        breadcrumb={["Dashboard", "Quizzes"]}
      />

      {loading ? (
        <div aria-busy="true">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />)}</div>
      ) : error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : quizzes.length === 0 ? (
        <EmptyState icon="FileQuestion" title="No quizzes yet" description="Quizzes appear here when your instructors publish them." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="relative w-full sm:w-72">
              <label htmlFor="quiz-q" className="sr-only">Search quizzes</label>
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted pointer-events-none" aria-hidden="true" />
              <input id="quiz-q" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or course" className="input-base !pl-9 !pr-9" />
              {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded text-fg-muted hover:text-fg"><X size={14} aria-hidden="true" /></button>}
            </div>
            <div role="radiogroup" aria-label="Show" className="inline-flex rounded border border-line bg-surface p-0.5">
              {[["All", "All"], ["Available", "To take"], ["Completed", "Completed"]].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={segBtn(filter === k)}>{l}</button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="Search" title="No matching quizzes" description="Try another search or filter." action={
              <button type="button" className="btn btn-secondary" onClick={() => { setSearch(""); setFilter("All"); }}>Clear filters</button>
            } />
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {filtered.map((q) => {
                const s = stateOf(q);
                const meta = STATE_META[s] || STATE_META.AVAILABLE;
                const obtained = q.attempt?.score;
                return (
                  <li key={q.id} className="py-4 grid grid-cols-[1fr_auto] gap-x-4 items-center">
                    <div className="min-w-0">
                      <p className="text-[12px] text-fg-muted"><span className="font-semibold text-fg-secondary">{q.courseCode}</span> · {q.courseTitle}</p>
                      <p className="text-[15px] font-medium text-fg">{q.title}</p>
                      <p className="text-[12px] text-fg-muted mt-0.5 flex flex-wrap gap-x-3 tabular-nums">
                        <span>{q.durationMin} min</span><span>{q.questionCount} questions</span><span>{q.totalMarks} marks</span>
                        <span className={`inline-flex items-center gap-1 font-medium ${meta.cls}`}><meta.icon size={12} aria-hidden="true" /> {meta.label}</span>
                        {obtained != null && <span className="font-semibold text-fg">{obtained} / {q.attempt.maxScore}</span>}
                      </p>
                    </div>
                    {(s === "AVAILABLE" || s === "IN_PROGRESS") ? (
                      <button type="button" onClick={() => startQuiz(q)} disabled={starting === q.id} className="btn btn-primary btn-compact">
                        {starting === q.id ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Opening…</> : <><Play size={14} aria-hidden="true" /> {s === "IN_PROGRESS" ? "Resume" : "Start"}</>}
                        <span className="sr-only"> {q.title}</span>
                      </button>
                    ) : (
                      <button type="button" onClick={() => setResultView(q)} className="btn btn-ghost btn-compact">Result<span className="sr-only"> for {q.title}</span> <ChevronRight size={14} aria-hidden="true" /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {session && (
        <QuizRunner
          session={session}
          answers={answers}
          setAnswers={setAnswers}
          submitting={submitting}
          onSubmit={submitQuiz}
          onExit={() => !submitting && setSession(null)}
        />
      )}

      {/* Completed result */}
      <Modal open={!!resultView} onClose={() => setResultView(null)} title={resultView?.title} subtitle={resultView ? `${resultView.courseCode} · ${resultView.courseTitle}` : ""}>
        {resultView && (
          <div className="space-y-4 text-[14px]">
            {resultView.attempt?.score != null ? (
              <div>
                <p className="label-caps">Your score</p>
                <p className="text-[32px] font-semibold text-fg tabular-nums mt-1">{resultView.attempt.score} <span className="text-[18px] text-fg-muted font-normal">/ {resultView.attempt.maxScore}</span></p>
              </div>
            ) : (
              <p className="inline-flex items-center gap-2 text-note font-medium"><Hourglass size={16} aria-hidden="true" /> Submitted — your instructor is reviewing the short answers.</p>
            )}
            <dl className="grid grid-cols-2 gap-px bg-line border border-line rounded overflow-hidden">
              <div className="bg-surface p-3"><dt className="text-[12px] text-fg-muted">Questions</dt><dd className="font-medium text-fg tabular-nums">{resultView.questionCount}</dd></div>
              <div className="bg-surface p-3"><dt className="text-[12px] text-fg-muted">Total marks</dt><dd className="font-medium text-fg tabular-nums">{resultView.totalMarks}</dd></div>
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
};

/* ---------- Focused quiz runner ---------- */
const QuizRunner = ({ session, answers, setAnswers, submitting, onSubmit, onExit }) => {
  const { quiz, questions } = session;
  const [current, setCurrent] = useState(0);
  const [flagged, setFlagged] = useState({});
  const [confirm, setConfirm] = useState(false);
  const endsAt = useMemo(() => {
    const start = new Date(session.startedAt).getTime();
    return quiz.durationMin ? start + quiz.durationMin * 60000 : null;
  }, [session.startedAt, quiz.durationMin]);
  const [left, setLeft] = useState(() => (endsAt ? Math.round((endsAt - Date.now()) / 1000) : null));
  const autoSent = useRef(false);
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;
  const headingRef = useRef(null);

  useEffect(() => {
    if (!endsAt) return undefined;
    const t = setInterval(() => setLeft(Math.round((endsAt - Date.now()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  useEffect(() => {
    if (left != null && left <= 0 && !autoSent.current) {
      autoSent.current = true;
      submitRef.current();
    }
  }, [left]);

  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = o; };
  }, []);

  useEffect(() => { headingRef.current?.focus(); }, [current]);

  const q = questions[current];
  const isAnswered = useCallback((qq) => answers[qq.id] != null && answers[qq.id] !== "", [answers]);
  const answeredCount = questions.filter(isAnswered).length;
  const unanswered = questions.length - answeredCount;
  const timeTone = left == null ? "text-fg" : left <= 60 ? "text-bad" : left <= 300 ? "text-warn" : "text-fg";
  const announce = left != null && (left === 300 || left === 60) ? `${left === 300 ? "5 minutes" : "1 minute"} remaining` : "";

  return (
    <div role="dialog" aria-modal="true" aria-label={`Quiz: ${quiz.title}`} className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b border-line bg-surface flex items-center gap-3 px-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-fg truncate">{quiz.title}</p>
          <p className="text-[12px] text-fg-muted tabular-nums">{answeredCount} of {questions.length} answered · {quiz.totalMarks} marks</p>
        </div>
        {left != null && (
          <p className={`inline-flex items-center gap-1.5 text-[16px] font-semibold tabular-nums ${timeTone}`} aria-label={`Time remaining ${fmtClock(left)}`}>
            {left <= 300 ? <AlertCircle size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
            {fmtClock(left)}
          </p>
        )}
        <span className="sr-only" aria-live="assertive">{announce}</span>
        <button type="button" onClick={onExit} disabled={submitting} className="btn btn-ghost btn-compact">Save and exit</button>
      </header>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Navigator */}
        <nav aria-label="Questions" className="lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-surface p-4 overflow-x-auto lg:overflow-y-auto">
          <p className="label-caps mb-3 hidden lg:block">Questions</p>
          <ol className="flex lg:grid lg:grid-cols-5 gap-2">
            {questions.map((qq, i) => {
              const a = isAnswered(qq);
              const f = flagged[qq.id];
              const on = i === current;
              return (
                <li key={qq.id}>
                  <button type="button" onClick={() => setCurrent(i)} aria-current={on ? "step" : undefined}
                    aria-label={`Question ${i + 1}${a ? ", answered" : ", not answered"}${f ? ", flagged" : ""}`}
                    className={`relative h-9 w-9 rounded text-[13px] font-semibold tabular-nums border transition-colors ${on ? "border-brand ring-1 ring-brand" : "border-line"} ${a ? "bg-brand text-brand-on" : "bg-surface text-fg-secondary hover:border-line-strong"}`}>
                    {i + 1}
                    {f && <Flag size={10} aria-hidden="true" className="absolute -top-1 -right-1 text-warn fill-current" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="hidden lg:block mt-6 space-y-1.5 text-[12px] text-fg-muted">
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-brand" aria-hidden="true" /> Answered</p>
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-line" aria-hidden="true" /> Not answered</p>
            <p className="flex items-center gap-2"><Flag size={12} className="text-warn" aria-hidden="true" /> Flagged for review</p>
          </div>
        </nav>

        {/* Question */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {q ? (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[13px] text-fg-muted tabular-nums">Question {current + 1} of {questions.length} · {q.marks} mark{q.marks === 1 ? "" : "s"}</p>
                <button type="button" onClick={() => setFlagged((f) => ({ ...f, [q.id]: !f[q.id] }))} aria-pressed={!!flagged[q.id]}
                  className={`btn btn-ghost btn-compact ${flagged[q.id] ? "text-warn" : ""}`}>
                  <Flag size={14} aria-hidden="true" /> {flagged[q.id] ? "Flagged" : "Flag for review"}
                </button>
              </div>
              <h2 ref={headingRef} tabIndex={-1} id={`q-${q.id}-text`} className="text-[18px] leading-7 font-medium text-fg focus:outline-none">{q.text}</h2>

              <div className="mt-6">
                {(q.type === "MCQ" || q.type === "TRUEFALSE") ? (
                  <div role="radiogroup" aria-labelledby={`q-${q.id}-text`} className="space-y-2">
                    {(q.options || []).map((opt, oi) => {
                      const on = String(answers[q.id]) === String(oi);
                      return (
                        <label key={oi} className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded border cursor-pointer transition-colors ${on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-line-strong"}`}>
                          <input type="radio" name={`q-${q.id}`} value={oi} checked={on} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} className="h-4 w-4 accent-[rgb(var(--primary))]" />
                          <span className="text-[15px] text-fg">{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <label htmlFor={`ans-${q.id}`} className="field-label">Your answer</label>
                    <textarea id={`ans-${q.id}`} value={answers[q.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} rows={6} className="input-base !h-auto py-3" />
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="p-8 text-fg-muted">This quiz has no questions.</p>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="h-16 shrink-0 border-t border-line bg-surface flex items-center gap-2 px-4 sm:px-6">
        <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} className="btn btn-secondary"><ChevronLeft size={16} aria-hidden="true" /> Previous</button>
        <button type="button" onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} disabled={current >= questions.length - 1} className="btn btn-secondary">Next <ChevronRight size={16} aria-hidden="true" /></button>
        <button type="button" onClick={() => setConfirm(true)} disabled={submitting} className="btn btn-primary ml-auto">
          {submitting ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Submitting…</> : "Submit quiz"}
        </button>
      </footer>

      <Modal open={confirm && !submitting} onClose={() => setConfirm(false)} title="Submit this quiz?" maxWidth="max-w-md">
        <div className="space-y-4 text-[14px]">
          <p className="text-fg-secondary tabular-nums">
            You answered <b className="text-fg">{answeredCount}</b> of {questions.length} questions.
            {unanswered > 0 && <span className="block mt-1 text-warn inline-flex items-center gap-1.5"><AlertCircle size={14} aria-hidden="true" /> {unanswered} unanswered question{unanswered === 1 ? "" : "s"} will receive no marks.</span>}
          </p>
          <p className="text-fg-muted">You can't change your answers after submitting.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>Keep working</button>
            <button type="button" className="btn btn-primary" onClick={() => { setConfirm(false); onSubmit(); }}>Submit quiz</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

function avgScore(quizzes) {
  const graded = quizzes.filter((q) => q.attempt?.score != null && q.attempt?.maxScore);
  if (graded.length === 0) return "—";
  const pct = graded.reduce((a, q) => a + (q.attempt.score / q.attempt.maxScore) * 100, 0) / graded.length;
  return `${Math.round(pct)}%`;
}

export default Quizzes;

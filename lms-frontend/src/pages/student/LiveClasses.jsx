// lms-frontend/src/pages/student/LiveClasses.jsx
// Live classes in three zones: Live now (prominent band), Next class, and a
// day-grouped timeline (upcoming, then past with recordings). Join / leave /
// beacon / ?join= deep-link logic is unchanged.
import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, User, X, Maximize2, Play, Loader2, ExternalLink, RefreshCw, CalendarDays } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api from "../../services/api";
import { fileUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const ST = (c) => (c.status || "").toUpperCase();
const isEnded = (c) => ["ENDED", "COMPLETED", "CANCELLED"].includes(ST(c));
const hm = (x) => x.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const dayKey = (d) => d.toDateString();
const dayLabel = (d) => {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((x - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
};
const relStart = (d) => {
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 0) return "starting now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `in ${h} h ${mins % 60 ? `${mins % 60} min` : ""}`.trim();
  const days = Math.round(h / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
};

const resolveRecording = (lc) => {
  if (!lc.recordingUrl) return null;
  return /^https?:\/\//i.test(lc.recordingUrl) ? lc.recordingUrl : fileUrl(lc.recordingUrl);
};

const LiveClasses = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi(() => api.student.liveClasses(), []);
  const [filter, setFilter] = useState("ALL");
  const [joining, setJoining] = useState(null); // id currently being joined
  const [room, setRoom] = useState(null); // active BBB classroom session
  const [autoJoined, setAutoJoined] = useState(false);

  // Open the in-app BigBlueButton classroom for a scheduled/live class.
  const joinClass = async (lc) => {
    setJoining(lc.id);
    try {
      const res = await api.student.joinLiveClass(lc.id);
      setRoom(res.join);
    } catch (e) {
      toast(e.message || "Unable to join the live class", { type: "error" });
    } finally {
      setJoining(null);
    }
  };

  // Leave the classroom — records leave time + duration for attendance.
  const leaveClass = async () => {
    const r = room;
    setRoom(null);
    if (r && r.id) {
      try { await api.student.leaveLiveClass(r.id, r.attendanceId); } catch { /* non-blocking */ }
    }
  };

  // Ensure leave is posted if the tab/window is closed while in a class.
  useEffect(() => {
    if (!room) return;
    const handler = () => {
      try {
        const url = `${api.base}/lms/academic/student/live-classes/${room.id}/leave`;
        const blob = new Blob([JSON.stringify({ attendanceId: room.attendanceId })], { type: "application/json" });
        if (navigator.sendBeacon) navigator.sendBeacon(url, blob);
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [room]);

  const classes = useMemo(() => {
    const all = data?.liveClasses || [];
    return [...all].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));
  }, [data]);

  // Auto-open the classroom when deep-linked from a course card (?join=<id>).
  useEffect(() => {
    if (autoJoined || room) return;
    const joinId = searchParams.get("join");
    if (!joinId || classes.length === 0) return;
    const target = classes.find((c) => String(c.id) === String(joinId));
    if (target) {
      setAutoJoined(true);
      joinClass(target);
      const next = new URLSearchParams(searchParams);
      next.delete("join");
      setSearchParams(next, { replace: true });
    }
  }, [classes, searchParams, autoJoined, room]); // eslint-disable-line react-hooks/exhaustive-deps

  // Course filter — classes are identified by course code + title in text,
  // never by colour alone.
  const courses = useMemo(() => {
    const m = new Map();
    classes.forEach((c) => { if (c.courseCode && !m.has(c.courseCode)) m.set(c.courseCode, { code: c.courseCode, title: c.courseTitle, teacher: c.teacher }); });
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [classes]);
  const [courseFilter, setCourseFilter] = useState("ALL");

  const shown = useMemo(() => {
    let list = classes;
    if (courseFilter !== "ALL") list = list.filter((c) => c.courseCode === courseFilter);
    const st = (c) => (c.status || "").toUpperCase();
    if (filter === "UPCOMING") list = list.filter((c) => ["SCHEDULED", "UPCOMING", "LIVE"].includes(st(c)));
    if (filter === "RECORDED") list = list.filter((c) => ["ENDED", "COMPLETED"].includes(st(c)));
    return list;
  }, [classes, filter, courseFilter]);

  const recordingOf = resolveRecording;

  // Zone split over the filtered list.
  const zones = useMemo(() => {
    const now = Date.now();
    const asc = (a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt);
    const live = [], upcoming = [], past = [];
    shown.forEach((c) => {
      const d = new Date(c.scheduledAt);
      if (ST(c) === "LIVE") live.push(c);
      else if (isEnded(c) || d.getTime() + (c.durationMin || 60) * 60000 < now) past.push(c);
      else upcoming.push(c);
    });
    live.sort(asc); upcoming.sort(asc); past.sort((a, b) => -asc(a, b));
    const group = (list) => {
      const g = [];
      list.forEach((c) => {
        const d = new Date(c.scheduledAt);
        const k = dayKey(d);
        let last = g[g.length - 1];
        if (!last || last.key !== k) { last = { key: k, label: dayLabel(d), items: [] }; g.push(last); }
        last.items.push(c);
      });
      return g;
    };
    const next = upcoming[0] || null;
    return { live, next, upcomingDays: group(upcoming.slice(next ? 1 : 0)), pastDays: group(past), pastCount: past.length };
  }, [shown]);

  const JoinButton = ({ lc, large = false }) => {
    const busy = joining === lc.id;
    const recording = recordingOf(lc);
    const live = ST(lc) === "LIVE";
    const ended = isEnded(lc);
    const size = large ? "btn-lg" : "btn-compact";
    if (!ended && lc.joinUrl) {
      return (
        <button type="button" onClick={() => joinClass(lc)} disabled={busy} className={`btn btn-primary ${size}`}>
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={15} aria-hidden="true" />}
          {busy ? "Joining…" : live ? "Join class" : "Join classroom"}
          <span className="sr-only"> {lc.courseCode} {lc.title}</span>
        </button>
      );
    }
    if (ended && recording) {
      return (
        <a href={recording} target="_blank" rel="noreferrer" className={`btn btn-secondary ${size}`}>
          <Play size={15} aria-hidden="true" /> Watch recording<span className="sr-only"> {lc.courseCode} {lc.title}</span>
        </a>
      );
    }
    if (!ended) {
      return <span className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted"><Clock size={14} aria-hidden="true" /> Opens when the teacher starts</span>;
    }
    return <span className="text-[13px] text-fg-muted">No recording</span>;
  };

  const Row = ({ lc }) => {
    const d = new Date(lc.scheduledAt);
    const end = new Date(d.getTime() + (lc.durationMin || 60) * 60000);
    const ended = isEnded(lc) || end < new Date();
    return (
      <li className="grid grid-cols-[72px_1fr] sm:grid-cols-[96px_1fr_auto] gap-x-4 gap-y-2 py-4 items-start sm:items-center">
        <div className={`text-[13px] tabular-nums ${ended ? "text-fg-muted" : "text-fg"}`}>
          <p className="font-semibold">{hm(d)}</p>
          <p className="text-fg-muted">{hm(end)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[12px] text-fg-muted">
            <span className="font-semibold text-fg-secondary">{lc.courseCode}</span> · {lc.courseTitle}
            {lc.fromSchedule && <> · Weekly schedule</>}
          </p>
          <p className={`text-[15px] font-medium truncate ${ended ? "text-fg-secondary" : "text-fg"}`}>{lc.title}</p>
          <p className="text-[12px] text-fg-muted mt-0.5 flex flex-wrap gap-x-3">
            {lc.teacher && <span className="inline-flex items-center gap-1"><User size={12} aria-hidden="true" /> {lc.teacher}</span>}
            <span className="tabular-nums">{lc.durationMin} min</span>
            {lc.description && <span className="truncate">{lc.description}</span>}
          </p>
        </div>
        <div className="col-start-2 sm:col-start-auto"><JoinButton lc={lc} /></div>
      </li>
    );
  };

  const DayGroup = ({ day }) => (
    <section aria-label={day.label} className="mt-6 first:mt-0">
      <h3 className="label-caps pb-2 border-b border-line">{day.label}</h3>
      <ul className="divide-y divide-line">{day.items.map((lc) => <Row key={lc.id} lc={lc} />)}</ul>
    </section>
  );

  const header = (
    <PageHeader title="Live classes" subtitle="Times follow your weekly schedule." icon="Radio" breadcrumb={["Dashboard", "Live classes"]}
      actions={<button type="button" onClick={reload} className="btn btn-secondary"><RefreshCw size={15} aria-hidden="true" /> Refresh</button>} />
  );

  if (loading) {
    return (
      <div>
        {header}
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-32 w-full" />
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      </div>
    );
  }

  const segBtn = (on) => `h-9 px-3 rounded-sm text-[13px] font-medium whitespace-nowrap transition-colors ${on ? "bg-brand-soft text-brand" : "text-fg-secondary hover:text-fg"}`;

  return (
    <div>
      {header}

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : classes.length === 0 ? (
        <EmptyState icon="Radio" title="No live classes scheduled" description="Classes appear here automatically once your course's weekly schedule is set." />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <div role="radiogroup" aria-label="Show" className="inline-flex rounded border border-line bg-surface p-0.5">
              {[["ALL", "All"], ["UPCOMING", "Upcoming & live"], ["RECORDED", "Past"]].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={segBtn(filter === k)}>{l}</button>
              ))}
            </div>
            {courses.length > 1 && (
              <label className="inline-flex items-center gap-2 text-[13px] text-fg-secondary">
                Course
                <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="input-base !h-9 !w-auto pr-8">
                  <option value="ALL">All courses</option>
                  {courses.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.title}</option>)}
                </select>
              </label>
            )}
          </div>

          {!shown.length ? (
            <EmptyState icon="Radio" title="No classes match" description="Try a different filter." action={
              <button type="button" className="btn btn-secondary" onClick={() => { setFilter("ALL"); setCourseFilter("ALL"); }}>Clear filters</button>
            } />
          ) : (
            <>
              {/* Zone 1 — Live now */}
              {zones.live.length > 0 && (
                <section aria-labelledby="live-now" className="mb-8 space-y-3">
                  <h2 id="live-now" className="flex items-center gap-2 text-[13px] font-semibold text-bad">
                    <span className="live-dot" aria-hidden="true" /> Live now
                  </h2>
                  {zones.live.map((lc) => (
                    <div key={lc.id} className="rounded-lg border border-bad/40 bg-bad-soft p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-fg-secondary"><span className="font-semibold">{lc.courseCode}</span> · {lc.courseTitle}</p>
                        <p className="text-[20px] font-semibold text-fg mt-0.5">{lc.title}</p>
                        <p className="text-[13px] text-fg-secondary mt-1 tabular-nums">
                          Started {hm(new Date(lc.scheduledAt))}{lc.teacher && <> · {lc.teacher}</>} · {lc.durationMin} min
                        </p>
                      </div>
                      <JoinButton lc={lc} large />
                    </div>
                  ))}
                </section>
              )}

              {/* Zone 2 — Next class */}
              {zones.next && (
                <section aria-labelledby="next-class" className="mb-10">
                  <h2 id="next-class" className="label-caps mb-3">Next class</h2>
                  <div className="rounded-lg border border-line bg-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="sm:w-40 shrink-0">
                      <p className="text-[13px] text-fg-muted">{dayLabel(new Date(zones.next.scheduledAt))}</p>
                      <p className="text-[24px] font-semibold text-fg tabular-nums">{hm(new Date(zones.next.scheduledAt))}</p>
                      <p className="text-[12px] text-fg-muted">{relStart(new Date(zones.next.scheduledAt))}</p>
                    </div>
                    <div className="min-w-0 flex-1 sm:border-l sm:border-line sm:pl-6">
                      <p className="text-[13px] text-fg-secondary"><span className="font-semibold">{zones.next.courseCode}</span> · {zones.next.courseTitle}</p>
                      <p className="text-[17px] font-semibold text-fg mt-0.5">{zones.next.title}</p>
                      <p className="text-[13px] text-fg-muted mt-1">
                        {zones.next.teacher && <>{zones.next.teacher} · </>}{zones.next.durationMin} min
                        {zones.next.description && <> · {zones.next.description}</>}
                      </p>
                    </div>
                    <JoinButton lc={zones.next} />
                  </div>
                </section>
              )}

              {/* Zone 3 — Timeline */}
              {zones.upcomingDays.length > 0 && (
                <section aria-labelledby="later" className="mb-10">
                  <h2 id="later" className="text-[16px] font-semibold text-fg mb-4 flex items-center gap-2">
                    <CalendarDays size={16} className="text-fg-muted" aria-hidden="true" /> Later
                  </h2>
                  {zones.upcomingDays.map((day) => <DayGroup key={day.key} day={day} />)}
                </section>
              )}

              {zones.pastDays.length > 0 && (
                <section aria-labelledby="past">
                  <h2 id="past" className="text-[16px] font-semibold text-fg mb-4">
                    Past sessions <span className="text-fg-muted font-normal tabular-nums">({zones.pastCount})</span>
                  </h2>
                  {zones.pastDays.map((day) => <DayGroup key={day.key} day={day} />)}
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ---- BigBlueButton in-app classroom ---- */}
      {room && <Classroom room={room} onLeave={leaveClass} />}
    </div>
  );
};

// Full-screen classroom dialog. Escape leaves (same as the Leave button).
const Classroom = ({ room, onLeave }) => {
  const leaveRef = useRef(null);
  const leaveFn = useRef(onLeave);
  leaveFn.current = onLeave;
  useEffect(() => {
    const prev = document.activeElement;
    leaveRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") leaveFn.current(); };
    document.addEventListener("keydown", onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = o; prev?.focus?.(); };
  }, []);
  const live = (room.status || "").toUpperCase() === "LIVE";
  return (
    <div role="dialog" aria-modal="true" aria-label={`Classroom: ${room.title}`} className="fixed inset-0 z-50 bg-neutral-950 flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 h-14 bg-neutral-900 border-b border-neutral-800 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold">
            {live ? <><span className="live-dot" aria-hidden="true" /> Live</> : "Classroom"}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold truncate">{room.title}</p>
            <p className="text-[12px] text-neutral-400 truncate">{room.courseCode} · {room.courseTitle}{room.teacher && <> · {room.teacher}</>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-[12px] text-neutral-400 tabular-nums">
            <User size={12} aria-hidden="true" /> {room.attendeeName} · {room.durationMin} min
          </span>
          <a href={room.joinUrl} target="_blank" rel="noreferrer" aria-label="Open classroom in a new tab" className="h-9 w-9 inline-flex items-center justify-center rounded text-neutral-300 hover:bg-neutral-800">
            <Maximize2 size={16} aria-hidden="true" />
          </a>
          <button ref={leaveRef} type="button" onClick={onLeave} className="btn btn-danger btn-compact"><X size={15} aria-hidden="true" /> Leave</button>
        </div>
      </div>
      <div className="flex-1 bg-black min-h-0">
        <iframe
          title="BigBlueButton Classroom"
          src={room.joinUrl}
          className="w-full h-full border-0"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          allowFullScreen
        />
      </div>
      <p className="px-4 py-2 text-[12px] text-neutral-400 bg-neutral-900 border-t border-neutral-800">
        Allow camera and microphone access when your browser asks, to use audio, webcam and screen sharing.
      </p>
    </div>
  );
};

export default LiveClasses;

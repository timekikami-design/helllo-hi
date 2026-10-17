import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Download, Send, BellRing, Users } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import Modal from "../../components/common/Modal";
import useApi from "../../hooks/useApi";
import api from "../../services/api";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import { useToast } from "../../context/ToastContext";
import CascadeFilters, { emptyCascade, applyCascade } from "../../components/common/CascadeFilters";

/* =============================================================
   Exam Controller — Incomplete Results (S6)
   Pending results (enrolled students without a PUBLISHED result)
   grouped by Department › Program › Semester and aggregated per
   teacher + course. Each row can notify that teacher with a
   pre-filled, editable message; each group can notify everyone in
   it. Teachers receive the reminder in real time (SSE) with a link
   straight to the course marks.
   ============================================================= */

const reminderSubject = (r) => `Incomplete result: ${r.course}`;

const pendingDetail = (r) => {
  const parts = [];
  if (r.draft) parts.push(`${r.draft} in draft`);
  if (r.noResult) parts.push(`${r.noResult} not entered`);
  return parts.length ? ` (${parts.join(", ")})` : "";
};

const reminderBody = (r, term) =>
  `Dear ${r.teacher || "Teacher"},\n\n` +
  `This is a reminder from the Office of the Controller of Examinations that the result for ` +
  `${r.course} (${r.program || "—"}, Semester ${r.semester || "—"}${term ? `, ${term}` : ""}) is still incomplete: ` +
  `${r.pending} student result(s) have not been finalised${pendingDetail(r)}.\n\n` +
  `Kindly complete and submit the marks at your earliest convenience so that results can be compiled on schedule.\n\n` +
  `Regards,\nController of Examinations`;

const ExamIncomplete = () => {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi(() => api.exam.report("incomplete"), []);
  const rows = useMemo(() => data?.rows || [], [data]);
  const term = data?.term || null;
  const [search, setSearch] = useState("");
  const [cascade, setCascade] = useState(emptyCascade());

  // compose = { mode:'one', row } | { mode:'group', group }
  const [compose, setCompose] = useState(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    let list = applyCascade(rows, cascade, (r) => ({
      department: r.department, program: r.program, semester: r.semester, session: r.session, batch: r.batch,
    }));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => [r.student, r.course, r.teacher].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [rows, search, cascade]);

  // Department › Program › Semester groups, each with teacher+course rows.
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const gk = `${r.department || "—"}|${r.program || "—"}|${r.semester || "—"}`;
      if (!map.has(gk)) map.set(gk, { key: gk, department: r.department, program: r.program, semester: r.semester, rows: new Map() });
      const g = map.get(gk);
      const rk = `${r.teacherId || "none"}|${r.offeringId}`;
      if (!g.rows.has(rk)) {
        g.rows.set(rk, {
          key: rk, offeringId: r.offeringId, course: r.course, teacherId: r.teacherId, teacher: r.teacher,
          department: r.department, program: r.program, semester: r.semester,
          pending: 0, draft: 0, noResult: 0, students: [],
        });
      }
      const row = g.rows.get(rk);
      row.pending += 1;
      if (r.status === "DRAFT") row.draft += 1; else row.noResult += 1;
      row.students.push(r.student);
    }
    return [...map.values()]
      .map((g) => ({ ...g, rows: [...g.rows.values()].sort((a, b) => b.pending - a.pending) }))
      .sort((a, b) => String(a.department).localeCompare(String(b.department))
        || String(a.program).localeCompare(String(b.program))
        || Number(a.semester || 0) - Number(b.semester || 0));
  }, [filtered]);

  const teacherCount = new Set(filtered.map((r) => r.teacherId).filter(Boolean)).size;
  const courseCount = new Set(filtered.map((r) => r.offeringId)).size;

  const openOne = (row) => {
    setCompose({ mode: "one", row });
    setSubject(reminderSubject(row));
    setText(reminderBody(row, term));
  };

  const openGroup = (group) => {
    setCompose({ mode: "group", group });
    setSubject("");
    setText(
      `Dear {teacher},\n\nThis is a reminder from the Office of the Controller of Examinations that the result for ` +
      `{course} (${group.program || "—"}, Semester ${group.semester || "—"}${term ? `, ${term}` : ""}) is still incomplete: ` +
      `{pending} student result(s) have not been finalised.\n\n` +
      `Kindly complete and submit the marks at your earliest convenience so that results can be compiled on schedule.\n\n` +
      `Regards,\nController of Examinations`
    );
  };

  const fill = (tpl, row) => tpl
    .replaceAll("{teacher}", row.teacher || "Teacher")
    .replaceAll("{course}", row.course || "your course")
    .replaceAll("{pending}", String(row.pending));

  const send = async () => {
    if (!text.trim()) { toast?.("Message cannot be empty", { type: "warning" }); return; }
    setSending(true);
    try {
      if (compose.mode === "one") {
        const r = compose.row;
        if (!r.teacherId) { toast?.("No teacher is assigned to this course", { type: "warning" }); return; }
        await api.exam.sendQuickMessage({ recipientId: r.teacherId, offeringId: r.offeringId, subject: subject.trim() || undefined, body: text.trim() });
        toast?.(`Reminder sent to ${r.teacher}`, { type: "success" });
      } else {
        const targets = compose.group.rows.filter((r) => r.teacherId);
        if (!targets.length) { toast?.("No assigned teachers in this group", { type: "warning" }); return; }
        const res = await api.exam.sendQuickMessagesBulk(targets.map((r) => ({
          recipientId: r.teacherId, offeringId: r.offeringId, subject: reminderSubject(r), body: fill(text.trim(), r),
        })));
        toast?.(`Reminder sent for ${res.sent} course(s)${res.failed ? `, ${res.failed} failed` : ""}`, { type: res.failed ? "warning" : "success" });
      }
      setCompose(null);
    } catch (e) {
      toast?.(e?.message || "Failed to send", { type: "error" });
    } finally {
      setSending(false);
    }
  };

  const exportCsv = () => {
    if (!filtered.length) { toast?.("Nothing to export", { type: "info" }); return; }
    const headers = ["Department", "Program", "Semester", "Teacher", "Course", "Student", "Session", "Status"];
    const keys = ["department", "program", "semester", "teacher", "course", "student", "session", "status"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...filtered.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "incomplete-results.csv"; a.click();
    URL.revokeObjectURL(url); toast?.("Incomplete list exported", { type: "success" });
  };

  return (
    <div>
      <PageHeader
        title="Incomplete Results"
        subtitle="Course results not yet finalised, grouped by department, program and semester."
        icon="FileWarning"
        breadcrumb={["Exam Controller", "Incomplete"]}
        actions={
          <button onClick={exportCsv} className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"><Download size={14} /> Export CSV</button>
        }
      />

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : loading ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            <StatCard title="Pending results" value={filtered.length} icon="FileWarning" color="amber" delay={0.05} />
            <StatCard title="Courses" value={courseCount} icon="BookOpen" color="blue" delay={0.1} />
            <StatCard title="Teachers" value={teacherCount} icon="Users" color="emerald" delay={0.12} />
            <StatCard title="Term" value={term || "—"} icon="Calendar" color="purple" delay={0.15} />
          </div>

          <CascadeFilters
            className="mb-4"
            value={cascade}
            onChange={setCascade}
            fields={["department", "program", "semester", "session", "batch"]}
            extraRows={rows}
            rowMap={(r) => ({ department: r.department, session: r.session, batch: r.batch })}
          />

          <div className="card-base p-3 mb-5">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-app" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student / course / teacher…" className="input-base w-full pl-10 text-sm" />
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="card-base"><EmptyState icon="CheckCircle2" title="No incomplete results" description="All results matching the current filters are finalised." /></div>
          ) : (
            <div className="space-y-4">
              {groups.map((g, gi) => (
                <motion.div key={g.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(gi * 0.04, 0.3) }} className="card-base overflow-hidden" data-testid="incomplete-group">
                  <div className="px-4 py-3 border-b border-app surface flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-bold text-app text-sm">{g.program || "—"} · Semester {g.semester || "—"}</p>
                      <p className="text-[11px] text-muted-app">{g.department || "—"} · {g.rows.length} course{g.rows.length !== 1 ? "s" : ""} · {g.rows.reduce((n, r) => n + r.pending, 0)} pending result(s)</p>
                    </div>
                    <button onClick={() => openGroup(g)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"><Users size={13} /> Notify all in group</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-app">
                        <tr>
                          {["Teacher", "Course", "Program", "Semester", "Pending", "Status", ""].map((h) => (
                            <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-app">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app">
                        {g.rows.map((r) => (
                          <tr key={r.key} className="hover:surface">
                            <td className="px-4 py-2 text-xs font-semibold text-app">{r.teacher || <span className="text-rose-600">Not assigned</span>}</td>
                            <td className="px-4 py-2 text-xs text-app">{r.course}</td>
                            <td className="px-4 py-2 text-xs text-app">{r.program || "—"}</td>
                            <td className="px-4 py-2 text-xs text-app">{r.semester || "—"}</td>
                            <td className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300" title={r.students.join(", ")}>{r.pending} student{r.pending !== 1 ? "s" : ""}</td>
                            <td className="px-4 py-2 text-[11px] text-muted-app">
                              {r.draft ? <span className="mr-2">{r.draft} draft</span> : null}
                              {r.noResult ? <span>{r.noResult} not entered</span> : null}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => openOne(r)} disabled={!r.teacherId} className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50" data-testid="notify-row"><BellRing size={13} /> Notify</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        open={!!compose}
        onClose={() => setCompose(null)}
        title={compose?.mode === "group" ? "Notify all teachers in group" : "Notify teacher"}
        subtitle={compose?.mode === "group"
          ? `${compose.group.program || "—"} · Semester ${compose.group.semester || "—"} — the teacher is notified in real time with a link to the course marks.`
          : compose ? `${compose.row.teacher} · ${compose.row.course} — delivered in real time with a link to the course marks.` : ""}
        icon={BellRing}
        maxWidth="max-w-lg"
      >
        {compose && (
          <div className="space-y-3">
            {compose.mode === "group" ? (
              <div className="card-base p-2.5 text-[11px] space-y-1 max-h-40 overflow-y-auto">
                {compose.group.rows.map((r) => (
                  <div key={r.key} className="flex justify-between gap-2">
                    <span className="text-app">{r.teacher || "Not assigned"} — {r.course}</span>
                    <span className="font-semibold text-amber-600 shrink-0">{r.teacherId ? `${r.pending} pending` : "skipped"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input-base w-full text-sm" />
              </div>
            )}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Message</label>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={9} className="input-base w-full text-sm" data-testid="notify-text" />
              {compose.mode === "group" && (
                <p className="text-[10px] text-muted-app mt-1">{"{teacher}"}, {"{course}"} and {"{pending}"} are filled in for each teacher.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCompose(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
              <button onClick={send} disabled={sending} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50" data-testid="notify-send"><Send size={14} /> {sending ? "Sending…" : "Send"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExamIncomplete;

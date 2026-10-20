import { useMemo, useState } from "react";
import { Loader2, Lock, Save, Info, CheckCircle2 } from "lucide-react";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { Skeleton } from "../common/Skeleton";
import ErrorState from "../common/ErrorState";
import EmptyState from "../common/EmptyState";

/* =============================================================
   GradebookPanel (A3 / A5 / B2.b) — teacher gradebook for one subject.
   • Columns = exactly the Course Coordinator's categories for this
     subject (no Lab / Project column when the subject has none).
   • Each cell: Obtained / Total, and the auto-converted weightage value
     (e.g. 25/50 on a 5% item → 2.5).
   • Every cell is editable while the subject is open; saves instantly
     and the student view updates in real time.
   • Mid / Final: Total Marks entered once per course, Obtained per
     student — both shown side by side.
   ============================================================= */
const fmt = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d).replace(/\.00$/, ""));

// Section 4 — live (display-only) preview of the weightage conversion while the
// teacher types, using the SAME formula as the server (lmsGrading.convertToWeight):
// min(max(obtained / total × weight, 0), weight), rounded to 2 dp. The server
// remains the source of truth once the cell is saved.
const round2 = (n) => Math.round(n * 100) / 100;
function liveConvert(obtained, total, weight) {
  if (obtained == null || obtained === "" || total == null || Number(total) <= 0) return null;
  const n = Number(obtained);
  if (!Number.isFinite(n)) return null;
  const cap = Number(weight) || 0;
  return round2(Math.min(Math.max((n / Number(total)) * cap, 0), cap));
}

function Cell({ cell, item, editable, onSave, onDraft, total: totalOverride, pendingSlot }) {
  const [val, setVal] = useState(null);
  const [saving, setSaving] = useState(false);
  // Change 1 — an allowed-but-not-yet-created item is still enterable here
  // (pendingSlot); it is created automatically when its first mark is saved.
  const noItem = !item.created && !item.editable && !pendingSlot;
  const total = totalOverride ?? cell?.total ?? item.totalMarks;
  // While a value is being typed, show its converted weight immediately.
  const typing = val !== null;
  const shownConverted = typing ? liveConvert(val, total, item.itemWeight) : cell?.converted;
  const overTotal = typing && val !== "" && total != null && Number(val) > Number(total);
  const commit = async () => {
    if (val === null) return;
    const v = val.trim();
    if (v === (cell?.obtained == null ? "" : String(cell.obtained))) { setVal(null); return; }
    setSaving(true);
    try { await onSave(v === "" ? null : Number(v)); setVal(null); onDraft && onDraft(null); }
    catch (_) { /* keep the typed value visible so the teacher can correct it */ }
    finally { setSaving(false); }
  };
  if (noItem) return <td className="px-2 py-2 text-center text-[11px] text-slate-400 italic">not created</td>;
  return (
    <td className="px-2 py-1.5 text-center align-middle">
      <div className="flex items-center justify-center gap-1">
        {editable ? (
          <input
            value={val ?? (cell?.obtained ?? "")}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setVal(v);
              onDraft && onDraft(liveConvert(v, total, item.itemWeight));
            }}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setVal(null); onDraft && onDraft(null); } }}
            placeholder="—"
            className={`w-14 input-base text-center text-sm py-1 px-1 ${overTotal ? "!border-rose-500" : ""}`}
            title={overTotal ? `Cannot exceed ${total}` : undefined}
            aria-label={`${item.label} obtained`}
          />
        ) : (
          <span className="font-semibold text-app">{cell?.obtained ?? "—"}</span>
        )}
        <span className="text-[11px] text-muted-app">/ {total ?? "?"}</span>
        {saving && <Loader2 size={11} className="animate-spin text-primary-600" />}
      </div>
      <div data-testid="cell-converted" className={`text-[10px] mt-0.5 font-semibold ${overTotal ? "text-rose-600" : shownConverted != null ? "text-primary-700 dark:text-primary-300" : "text-slate-400"}`}>
        {overTotal ? `Max ${total}` : shownConverted != null ? `${fmt(shownConverted)} / ${fmt(item.itemWeight)}` : (typing && val !== "" && total == null ? "Set total" : "Pending")}
      </div>
    </td>
  );
}

export default function GradebookPanel({ offeringId }) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi(() => api.marks.gradebook(offeringId), [offeringId]);
  const [totals, setTotals] = useState({});
  // Section 4 — converted value of cells currently being typed: { "studentId|itemKey": number }
  const [drafts, setDrafts] = useState({});
  const setDraft = (studentId, key, v) => setDrafts((d) => {
    const k = `${studentId}|${key}`;
    if (v === null || v === undefined) { if (!(k in d)) return d; const n = { ...d }; delete n[k]; return n; }
    return { ...d, [k]: v };
  });
  const [savingTotals, setSavingTotals] = useState(false);
  // Change 1 — Total Marks typed once per not-yet-created item: { itemKey: "20" }
  const [slotTotals, setSlotTotals] = useState({});

  // Real-time: student quiz submissions / other edits refresh the grid.
  useRealtime(api.teacher.eventsUrl, {
    result: (d) => { if (!d || !d.offeringId || String(d.offeringId) === String(offeringId)) reload(); },
  }, [offeringId]);

  const columns = useMemo(() => (data?.categories || []).flatMap((c) => c.items.map((it) => ({ ...it, category: c }))), [data]);
  const open = data && !data.locked && !data.submitted;

  if (loading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error) return <ErrorState description={error} onRetry={reload} />;
  if (!data) return null;
  if (!data.rows.length) return <EmptyState icon="ClipboardList" title="No students" description="No students are enrolled in this course yet." />;

  const off = data.offering;
  // Running row total = saved weightedTotal with any in-progress cells swapped
  // for their live converted value (display only).
  const liveRowTotal = (row) => {
    let total = row.weightedTotal || 0;
    for (const it of columns) {
      const k = `${row.studentId}|${it.key}`;
      if (!(k in drafts)) continue;
      total += (drafts[k] || 0) - (row.cells[it.key]?.converted || 0);
    }
    return round2(total);
  };
  const isSlot = (it) => !it.created && !it.editable && !it.legacy && !it.category?.exam;
  const saveCell = async (row, item, marks) => {
    try {
      const slot = isSlot(item) ? { slot: Number(String(item.key).split("-slot-")[1]), totalMarks: slotTotals[item.key] } : {};
      await api.marks.saveCell(offeringId, { kind: item.kind, itemId: item.id, studentId: row.studentId, marks, ...slot });
      await reload();
    } catch (e) { toast(e.message, { type: "error" }); throw e; }
  };
  const saveTotals = async () => {
    setSavingTotals(true);
    try {
      await api.marks.setExamTotals(offeringId, { midTotalMarks: totals.mid ?? off.midTotalMarks, finalTotalMarks: totals.final ?? off.finalTotalMarks });
      toast("Total marks saved", { type: "success" });
      setTotals({});
      reload();
    } catch (e) { toast(e.message, { type: "error" }); }
    finally { setSavingTotals(false); }
  };
  const hasMid = data.categories.some((c) => c.key === "mid");
  const hasFinal = data.categories.some((c) => c.key === "final");

  return (
    <div className="space-y-4">
      {!open && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <Lock size={15} /> {data.submitted ? "Submitted to the Exam Controller — permanently locked." : "Published and locked — marks can no longer be edited."}
        </div>
      )}

      {/* Weightage summary + completion */}
      <div className="card-base p-4 flex flex-wrap items-center gap-2">
        {data.categories.map((c) => (
          <span key={c.key} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            {c.label} {fmt(c.weight)}%{c.limit != null && !c.exam ? ` · ${c.created}/${c.limit} created` : ""}
          </span>
        ))}
        {!off.configured && <span className="text-xs text-amber-600">Weightage not configured by the Course Coordinator — using course defaults.</span>}
        <span className="ml-auto text-xs text-muted-app flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-600" /> {data.completion.cellsGraded}/{data.completion.cellsTotal} marks entered ({data.completion.percentComplete}%)</span>
      </div>

      {/* Mid / Final totals (B2.b) */}
      {(hasMid || hasFinal) && (
        <div className="card-base p-4 flex flex-wrap items-end gap-4">
          {hasMid && (
            <label className="text-xs font-semibold text-secondary-app">Mid Total Marks
              <input disabled={!open} value={totals.mid ?? off.midTotalMarks ?? ""} onChange={(e) => setTotals((t) => ({ ...t, mid: e.target.value }))} className="input-base mt-1 w-28 block" placeholder="e.g. 30" />
            </label>
          )}
          {hasFinal && (
            <label className="text-xs font-semibold text-secondary-app">Final Total Marks
              <input disabled={!open} value={totals.final ?? off.finalTotalMarks ?? ""} onChange={(e) => setTotals((t) => ({ ...t, final: e.target.value }))} className="input-base mt-1 w-28 block" placeholder="e.g. 50" />
            </label>
          )}
          {open && <button onClick={saveTotals} disabled={savingTotals || !Object.keys(totals).length} className="btn-primary text-sm disabled:opacity-50">{savingTotals ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save totals</button>}
          <p className="text-[11px] text-muted-app flex items-center gap-1"><Info size={12} /> Obtained marks for Mid/Final are entered per student below, out of these totals.</p>
        </div>
      )}

      <div className="card-base overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900 text-[11px] uppercase text-slate-500">
              <th className="px-3 py-2 text-left sticky left-0 bg-slate-50 dark:bg-slate-900" rowSpan={2}>Student</th>
              {data.categories.map((c) => (
                <th key={c.key} colSpan={c.items.length} className="px-2 py-1.5 text-center border-l border-slate-200 dark:border-slate-800">{c.label} · {fmt(c.weight)}%</th>
              ))}
              <th className="px-2 py-1.5 text-center border-l border-slate-200 dark:border-slate-800" rowSpan={2}>Total<br />/ {fmt(data.rows[0]?.totalWeight)}</th>
            </tr>
            <tr className="bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-500">
              {columns.map((it) => (
                <th key={it.key} className="px-2 py-1 text-center font-medium border-l border-slate-100 dark:border-slate-800 whitespace-nowrap">{it.label}<br /><span className="text-slate-400">{fmt(it.itemWeight)}%</span>
                  {open && isSlot(it) && (
                    <input value={slotTotals[it.key] ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ""); setSlotTotals((t) => ({ ...t, [it.key]: v })); }}
                      placeholder="Total" aria-label={`${it.label} total marks`} className="mt-1 block mx-auto w-14 input-base text-center text-[11px] py-0.5 px-1" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.studentId} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-950">
                  <p className="font-semibold text-app whitespace-nowrap">{row.name}</p>
                  <p className="text-[11px] text-muted-app font-mono">{row.rollNumber}</p>
                </td>
                {columns.map((it) => (
                  <Cell key={it.key} cell={row.cells[it.key]} item={it}
                    total={it.category?.key === "mid" ? (totals.mid !== undefined && totals.mid !== "" ? Number(totals.mid) : undefined)
                      : it.category?.key === "final" ? (totals.final !== undefined && totals.final !== "" ? Number(totals.final) : undefined)
                      : isSlot(it) ? (slotTotals[it.key] ? Number(slotTotals[it.key]) : undefined) : undefined}
                    pendingSlot={open && isSlot(it)}
                    editable={open && row.editable && (it.created || it.editable || isSlot(it)) && !it.legacy}
                    onDraft={(v) => setDraft(row.studentId, it.key, v === null ? undefined : v)}
                    onSave={(m) => saveCell(row, it, m)} />
                ))}
                <td data-testid="row-total" className="px-2 py-2 text-center font-bold text-primary-700 dark:text-primary-300 border-l border-slate-100 dark:border-slate-800">{fmt(liveRowTotal(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-app">Converted value = (obtained ÷ total) × item weight. For an item you have not created yet, enter its Total once (under the column name) and then type marks — the item is created automatically with the first saved mark (fill items in order).</p>
    </div>
  );
}

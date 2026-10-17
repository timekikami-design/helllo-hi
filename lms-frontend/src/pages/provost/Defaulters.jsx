import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Lock, Unlock, Mail } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

/* =============================================================
   Provost — Fee Defaulters (S8)
   Students with overdue dues (and/or blocked), filterable by
   department / program / semester and searchable by username, name,
   CNIC, phone, roll number or email (combined with the filters).
   Single and bulk block / unblock reuse the existing block APIs; the
   block is enforced server-side on every student API except the Fee
   module. Approving a payment in Fee Approvals also unblocks.
   ============================================================= */
const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };

const ProvostDefaulters = () => {
  const { toast } = useToast();
  const [include, setInclude] = useState("defaulters");
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ include });
    if (department) p.set("department", department);
    if (program) p.set("program", program);
    if (semester) p.set("semester", semester);
    if (debounced) p.set("q", debounced);
    return `?${p.toString()}`;
  }, [include, department, program, semester, debounced]);
  const { data, loading, error, reload } = useApi(() => api.provost.feeMgmt.defaulters(params), [params]);
  const { data: opts } = useApi(() => api.provost.feeMgmt.filterOptions(), []);
  const items = useMemo(() => data?.items || [], [data]);
  const stats = data?.stats || {};

  const [selected, setSelected] = useState(new Set());
  useEffect(() => { setSelected(new Set()); }, [params]);
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allChecked = items.length > 0 && items.every((r) => selected.has(r.studentId));

  const [blockFor, setBlockFor] = useState(null); // { ids: [], label }
  const [reason, setReason] = useState("Fee not submitted by the deadline.");
  const [busy, setBusy] = useState(false);

  const doBlock = async () => {
    if (reason.trim().length < 3) { toast("Enter a reason", { type: "error" }); return; }
    setBusy(true);
    try {
      if (blockFor.ids.length === 1) await api.provost.feeMgmt.block(blockFor.ids[0], { reason: reason.trim() });
      else await api.provost.feeMgmt.bulkBlock({ studentIds: blockFor.ids, reason: reason.trim() });
      toast(`Blocked ${blockFor.ids.length} student(s)`, { type: "success" });
      setBlockFor(null); setSelected(new Set()); reload();
    } catch (e) { toast(e.message || "Block failed", { type: "error" }); } finally { setBusy(false); }
  };
  const doUnblock = async (ids) => {
    setBusy(true);
    try {
      if (ids.length === 1) await api.provost.feeMgmt.unblock(ids[0], {});
      else await api.provost.feeMgmt.bulkUnblock({ studentIds: ids });
      toast(`Unblocked ${ids.length} student(s)`, { type: "success" });
      setSelected(new Set()); reload();
    } catch (e) { toast(e.message || "Unblock failed", { type: "error" }); } finally { setBusy(false); }
  };

  const sel = items.filter((r) => selected.has(r.studentId));
  const selUnblocked = sel.filter((r) => !r.blocked).map((r) => r.studentId);
  const selBlocked = sel.filter((r) => r.blocked).map((r) => r.studentId);

  return (
    <div>
      <PageHeader title="Fee Defaulters" subtitle="Overdue fees — filter, search, block / unblock (single or bulk)" icon="UserMinus" breadcrumb={["Provost", "Defaulters"]} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard title="Students listed" value={stats.total ?? 0} icon="UserMinus" color="rose" delay={0.05} />
        <StatCard title="Blocked" value={stats.blocked ?? 0} icon="Lock" color="orange" delay={0.1} />
        <StatCard title="Overdue" value={fmtMoney(stats.overdue)} icon="AlertTriangle" color="amber" delay={0.15} />
        <StatCard title="Outstanding" value={fmtMoney(stats.outstanding)} icon="Wallet" color="blue" delay={0.2} />
      </div>

      <div className="card-base p-3 mb-3 grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-app" />
          <input data-testid="def-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username, name, CNIC, phone, roll no. or email" className="input-base w-full pl-10 text-sm" />
        </div>
        <select value={include} onChange={(e) => setInclude(e.target.value)} className="input-base text-sm" data-testid="def-include">
          <option value="defaulters">Defaulters (overdue or blocked)</option>
          <option value="blocked">Blocked only</option>
          <option value="all">All students</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input-base text-sm" data-testid="def-dept">
          <option value="">All Departments</option>{(opts?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className="input-base text-sm" data-testid="def-prog">
          <option value="">All Programs</option>{(opts?.programs || []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input-base text-sm" data-testid="def-sem">
          <option value="">All Semesters</option>{(opts?.semesters || []).map((s) => <option key={s} value={String(s)}>Semester {s}</option>)}
        </select>
      </div>

      {sel.length > 0 && (
        <div className="card-base p-3 mb-3 flex flex-wrap items-center gap-2 text-sm" data-testid="def-bulkbar">
          <span className="font-semibold text-app">{sel.length} selected</span>
          <button disabled={!selUnblocked.length || busy} onClick={() => setBlockFor({ ids: selUnblocked, label: `${selUnblocked.length} student(s)` })} className="btn-primary text-xs py-1.5 px-3 inline-flex items-center gap-1 disabled:opacity-50" data-testid="def-bulk-block"><Lock size={12} /> Block {selUnblocked.length}</button>
          <button disabled={!selBlocked.length || busy} onClick={() => doUnblock(selBlocked)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1 disabled:opacity-50" data-testid="def-bulk-unblock"><Unlock size={12} /> Unblock {selBlocked.length}</button>
        </div>
      )}

      {error ? <ErrorState description={error} onRetry={reload} /> : loading ? <Skeleton className="h-96 w-full rounded-2xl" /> : items.length === 0 ? (
        <div className="card-base"><EmptyState icon="CheckCircle2" title="No students found" description="No student matches the current filters." /></div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-app">
                  <th className="p-3 w-8"><input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(items.map((r) => r.studentId)))} data-testid="def-all" /></th>
                  {["Student", "Contact", "Program / Sem", "Department", "Overdue", "Next due", "Status", ""].map((h) => <th key={h} className="text-left p-3 text-xs font-bold text-app uppercase">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {items.map((r, i) => (
                  <motion.tr key={r.studentId} data-testid="def-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="border-b border-app hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3"><input type="checkbox" checked={selected.has(r.studentId)} onChange={() => toggle(r.studentId)} /></td>
                    <td className="p-3"><p className="font-semibold text-app">{r.name}</p><p className="text-[11px] text-muted-app font-mono">{r.roll}{r.username && r.username !== r.roll ? ` · ${r.username}` : ""}</p></td>
                    <td className="p-3 text-[11px] text-muted-app"><p>{r.cnic || "—"}</p><p>{r.phone || "—"}</p><p className="truncate max-w-[180px]">{r.email || "—"}</p></td>
                    <td className="p-3 text-xs text-app">{r.program || "—"} · {r.semester || "—"}</td>
                    <td className="p-3 text-xs text-app">{r.department || "—"}</td>
                    <td className="p-3 font-bold text-rose-600">{fmtMoney(r.overdue)}</td>
                    <td className="p-3 text-xs text-app">{r.nextDue ? <>{fmtMoney(r.nextDue.amount)}<p className="text-[10px] text-muted-app">by {fmtDate(r.nextDue.dueDate)}</p></> : "—"}</td>
                    <td className="p-3">{r.blocked
                      ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" title={r.blockReason || ""}>Blocked</span>
                      : r.isDefaulter ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Overdue</span>
                        : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Clear</span>}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {r.blocked
                        ? <button disabled={busy} onClick={() => doUnblock([r.studentId])} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-semibold inline-flex items-center gap-1" data-testid="def-unblock"><Unlock size={11} /> Unblock</button>
                        : <button disabled={busy} onClick={() => setBlockFor({ ids: [r.studentId], label: r.name })} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1" data-testid="def-block"><Lock size={11} /> Block</button>}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!blockFor} onClose={() => setBlockFor(null)} title="Block for unpaid fee" subtitle={blockFor ? blockFor.label : ""} icon={Lock} maxWidth="max-w-md">
        {blockFor && (
          <div className="space-y-3">
            <p className="text-xs text-muted-app">The student will see "Your fee has not been submitted. Please submit your fee first." on login and on every page, and all student APIs except the Fee module will be refused until the block is lifted (or a payment is approved).</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="input-base w-full text-sm" data-testid="def-reason" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setBlockFor(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
              <button onClick={doBlock} disabled={busy} className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-1 disabled:opacity-50" data-testid="def-confirm"><Mail size={13} /> Block & notify</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProvostDefaulters;

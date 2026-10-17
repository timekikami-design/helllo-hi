import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, CheckCircle2, XCircle, Eye, BadgeCheck } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";
import { useToast } from "../../context/ToastContext";

/* =============================================================
   Provost — Fee Approvals (S7.2)
   Student payment submissions (method, amount, transaction ID,
   screenshot, payment date). Approve → the fee (or the next monthly
   instalment) is marked PAID and, if the student was fee-blocked and
   has no other overdue dues, the block is lifted in the same action.
   Reject → a reason is mandatory and is shown to the student, who can
   resubmit.
   ============================================================= */
const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
const CHIP = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};
const LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" };

const ProvostFeeApprovals = () => {
  const { toast } = useToast();
  const [status, setStatus] = useState("PENDING");
  const { data, loading, error, reload } = useApi(() => api.provost.feeMgmt.submissions(`?status=${status}`), [status]);
  const { data: opts } = useApi(() => api.provost.feeMgmt.filterOptions(), []);
  useRealtime(api.provost.eventsUrl, { "fee:submission": () => reload() });
  const items = useMemo(() => data?.items || [], [data]);
  const stats = data?.stats || {};

  const [search, setSearch] = useState("");
  const [program, setProgram] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [detail, setDetail] = useState(null);
  const [shot, setShot] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url = null; let cancelled = false;
    setShot(null); setReason("");
    if (detail) {
      api.blobUrl(api.provost.feeMgmt.submissionScreenshotUrl(detail.id))
        .then((u) => { url = u; if (!cancelled) setShot(u); })
        .catch(() => { if (!cancelled) setShot("error"); });
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [detail]);

  const filtered = useMemo(() => items.filter((a) => {
    if (program && a.program !== program) return false;
    if (department && a.department !== department) return false;
    if (semester && String(a.semester) !== semester) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![a.student, a.roll, a.transactionId, a.challanNo].some((v) => String(v || "").toLowerCase().includes(q))) return false;
    }
    return true;
  }), [items, search, program, department, semester]);

  const decide = async (action) => {
    if (action === "reject" && reason.trim().length < 5) { toast("Enter a rejection reason (at least 5 characters)", { type: "error" }); return; }
    setBusy(true);
    try {
      const r = await api.provost.feeMgmt.decideSubmission(detail.id, { action, reason: reason.trim() || undefined });
      toast(action === "approve"
        ? `Payment approved${r.block?.unblocked ? " — student unblocked" : ""}`
        : "Payment rejected — the student can see the reason and resubmit", { type: action === "approve" ? "success" : "info" });
      setDetail(null);
      reload();
    } catch (e) {
      toast(e.message || "Action failed", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Fee Approvals" subtitle="Review student payment proofs — approve, or reject with a reason" icon="BadgeCheck" breadcrumb={["Provost", "Fee Approvals"]} />

      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard title="Pending Review" value={stats.pending ?? 0} icon="Clock" color="amber" delay={0.05} onClick={() => setStatus("PENDING")} />
        <StatCard title="Approved" value={stats.approved ?? 0} icon="CheckCircle2" color="emerald" delay={0.1} onClick={() => setStatus("APPROVED")} />
        <StatCard title="Rejected" value={stats.rejected ?? 0} icon="XCircle" color="rose" delay={0.15} onClick={() => setStatus("REJECTED")} />
      </div>

      <div className="card-base p-3 mb-5 grid grid-cols-1 md:grid-cols-6 gap-2">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-app" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, roll, transaction ID…" className="input-base w-full pl-10 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-base text-sm" data-testid="sub-status">
          <option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="input-base text-sm">
          <option value="">All Departments</option>{(opts?.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={program} onChange={(e) => setProgram(e.target.value)} className="input-base text-sm">
          <option value="">All Programs</option>{(opts?.programs || []).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="input-base text-sm">
          <option value="">All Semesters</option>{(opts?.semesters || []).map((s) => <option key={s} value={String(s)}>Semester {s}</option>)}
        </select>
      </div>

      {error ? <ErrorState description={error} onRetry={reload} /> : loading ? <Skeleton className="h-96 w-full rounded-2xl" /> : filtered.length === 0 ? (
        <div className="card-base"><EmptyState icon="BadgeCheck" title="No payment submissions" description="Payment proofs submitted by students will appear here." /></div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-app">
                  {["Student", "Fee", "Program / Sem", "Amount", "Method", "Transaction ID", "Paid on", "Status", ""].map((h) => (
                    <th key={h} className="text-left p-3 text-xs font-bold text-app uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a, i) => (
                  <motion.tr key={a.id} data-testid="sub-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="border-b border-app hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="p-3"><p className="font-semibold text-app">{a.student}</p><p className="text-[11px] text-muted-app font-mono">{a.roll}</p></td>
                    <td className="p-3 text-xs text-app">{a.title}<p className="text-[10px] text-muted-app font-mono">{a.challanNo}</p></td>
                    <td className="p-3 text-xs text-app">{a.program || "—"} · {a.semester || "—"}</td>
                    <td className="p-3 font-bold text-app">{fmtMoney(a.amount)}</td>
                    <td className="p-3 text-xs text-app">{a.methodLabel}</td>
                    <td className="p-3 font-mono text-xs text-app">{a.transactionId}</td>
                    <td className="p-3 text-xs text-muted-app">{fmtDate(a.paidOn)}</td>
                    <td className="p-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CHIP[a.status]}`}>{LABEL[a.status]}</span>{a.blocked && <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white">BLOCKED</span>}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => setDetail(a)} data-testid="sub-review" className="px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 text-[11px] font-semibold inline-flex items-center gap-1"><Eye size={11} /> Review</button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Review Payment" subtitle={detail ? `${detail.student} · ${detail.title}` : ""} icon={BadgeCheck} maxWidth="max-w-2xl">
        {detail && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2 text-sm">
              {[
                ["Student", `${detail.student} (${detail.roll})`],
                ["Program / Department", `${detail.program || "—"} · ${detail.department || "—"}`],
                ["Semester", detail.semester || "—"],
                ["Amount", fmtMoney(detail.amount)],
                ["Method", detail.methodLabel],
                ["Transaction ID", detail.transactionId],
                ["Payment date", fmtDate(detail.paidOn)],
                ["Submitted", fmtDate(detail.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-app pb-1"><span className="text-muted-app text-xs">{k}</span><span className="font-semibold text-app text-right">{v}</span></div>
              ))}
              {detail.status === "REJECTED" && <p className="text-xs text-rose-600">Rejected: {detail.rejectionReason}</p>}
              {detail.status !== "PENDING" && detail.reviewedBy && <p className="text-xs text-muted-app">Reviewed by {detail.reviewedBy} on {fmtDate(detail.reviewedAt)}</p>}
            </div>
            <div className="rounded-xl border border-app overflow-hidden min-h-[200px] flex items-center justify-center bg-app-subtle">
              {shot === null ? <Skeleton className="h-48 w-full" /> : shot === "error" ? <p className="text-xs text-rose-600">Screenshot could not be loaded</p> : (
                <a href={shot} target="_blank" rel="noreferrer"><img src={shot} alt="Payment screenshot" className="max-h-72 object-contain" data-testid="sub-shot" /></a>
              )}
            </div>
            {detail.status === "PENDING" && (
              <div className="md:col-span-2 space-y-2">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="input-base w-full text-sm" placeholder="Rejection reason (required to reject; shown to the student)" data-testid="sub-reason" />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={() => decide("reject")} data-testid="sub-reject" className="flex-1 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-sm font-semibold"><XCircle size={14} className="inline mr-1.5" /> Reject</button>
                  <button disabled={busy} onClick={() => decide("approve")} data-testid="sub-approve" className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold"><CheckCircle2 size={14} className="inline mr-1.5" /> Approve{detail.blocked ? " & Unblock" : ""}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProvostFeeApprovals;

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Wallet, CheckCircle2, AlertTriangle, Download, Receipt, Upload, Clock, XCircle, Image as ImageIcon } from "lucide-react";
import PageHeader from "../../components/common/PageHeader";
import Modal from "../../components/common/Modal";
import { Skeleton } from "../../components/common/Skeleton";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";
import { fileUrl } from "../../services/api";
import { useToast } from "../../context/ToastContext";

/* =============================================================
   Student — Accounts Book (S7)
   * Each semester fee comes from the student's Admission fee record;
     the payable amount reflects concessions / scholarships and, with an
     instalment plan, the next monthly instalment.
   * "You must submit PKR X before [deadline]" notice per open fee.
   * Payment proof: method (Bank / JazzCash / EasyPaisa), amount,
     transaction ID, screenshot (PNG/JPG/WEBP ≤ 2 MB) and payment date.
   * Status per fee: Pending / Approved / Rejected (with the Provost's
     reason); a rejected fee can be resubmitted. Updates live (SSE).
   ============================================================= */
const MAX_MB = 2;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];

const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
};
const todayIso = () => new Date().toISOString().slice(0, 10);

const statusChip = (s) => {
  const v = (s || "").toUpperCase();
  if (v === "PAID") return "bg-emerald-100 text-emerald-700";
  if (v === "OVERDUE") return "bg-rose-100 text-rose-700";
  if (v === "WAIVED") return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-600";
};

const SUB_STYLE = {
  PENDING: { cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50", icon: Clock, label: "Pending Provost review" },
  APPROVED: { cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50", icon: CheckCircle2, label: "Approved" },
  REJECTED: { cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50", icon: XCircle, label: "Rejected" },
};

const safeItems = (li) => {
  if (Array.isArray(li)) return li;
  if (typeof li === "string") { try { const p = JSON.parse(li); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
};

const EMPTY_FORM = { method: "", transactionId: "", paidOn: "", file: null };

const AccountBook = () => {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi(() => api.student.fees(), []);
  useRealtime(api.student.eventsUrl, { "fee:updated": () => reload(), "fee:block": () => reload() });

  const challans = useMemo(() => data?.challans || [], [data]);
  const summary = data?.summary || { total: 0, paid: 0, outstanding: 0 };
  const methods = data?.methods || [];

  const [payFor, setPayFor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErr, setFormErr] = useState("");
  const [sending, setSending] = useState(false);

  const openPay = (ch) => { setPayFor(ch); setForm({ ...EMPTY_FORM, paidOn: todayIso() }); setFormErr(""); };

  const onFile = (f) => {
    setFormErr("");
    if (!f) { setForm((x) => ({ ...x, file: null })); return; }
    if (!OK_TYPES.includes(f.type)) { setFormErr("Screenshot must be a PNG, JPG or WEBP image."); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setFormErr(`Screenshot must be ${MAX_MB} MB or smaller.`); return; }
    setForm((x) => ({ ...x, file: f }));
  };

  const submit = async () => {
    if (!form.method) return setFormErr("Select a payment method.");
    if (!/^[A-Za-z0-9\-_/]{4,40}$/.test(form.transactionId.trim())) return setFormErr("Enter a valid transaction ID (4–40 letters/digits).");
    if (!form.paidOn) return setFormErr("Enter the payment date.");
    if (!form.file) return setFormErr("Attach a screenshot of the payment.");
    const fd = new FormData();
    fd.append("method", form.method);
    fd.append("amount", String(payFor.amountDue));
    fd.append("transactionId", form.transactionId.trim());
    fd.append("paidOn", form.paidOn);
    fd.append("screenshot", form.file);
    setSending(true);
    try {
      await api.student.submitFeeProof(payFor.id, fd);
      toast("Payment proof submitted — awaiting Provost approval", { type: "success" });
      setPayFor(null);
      reload();
    } catch (e) {
      setFormErr(e.message || "Submission failed");
    } finally {
      setSending(false);
    }
  };

  const viewProof = async (sid) => {
    try { window.open(await api.blobUrl(api.student.feeProofUrl(sid)), "_blank", "noopener"); }
    catch (e) { toast(e.message, { type: "error" }); }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Accounts Book" subtitle="Fee challans, payments, and dues" icon="Wallet" breadcrumb={["Dashboard", "Accounts Book"]} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Accounts Book" subtitle="Fee challans, payments, and dues" icon="Wallet" breadcrumb={["Dashboard", "Accounts Book"]} />

      {error ? (
        <ErrorState description={error} onRetry={reload} />
      ) : challans.length === 0 ? (
        <EmptyState icon="Wallet" title="No fee records" description="Your fee challans and payment history will appear here once generated by the finance office." />
      ) : (
        <>
          {data?.dues?.notice && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2" data-testid="fee-notice">
              <AlertTriangle size={16} /> {data.dues.notice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total Billed", value: fmtMoney(summary.total), color: "from-blue-500 to-indigo-600", icon: Wallet },
              { label: "Total Paid", value: fmtMoney(summary.paid), color: "from-emerald-500 to-teal-600", icon: CheckCircle2 },
              { label: "Outstanding", value: fmtMoney(summary.outstanding), color: "from-rose-500 to-pink-600", icon: AlertTriangle },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`relative bg-gradient-to-br ${s.color} rounded-2xl p-5 text-white overflow-hidden`}>
                <div className="absolute -right-2 -top-2 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                <s.icon size={22} className="mb-2" />
                <p className="font-display text-2xl font-extrabold">{s.value}</p>
                <p className="text-xs opacity-90">{s.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4">
            {challans.map((ch, i) => {
              const items = safeItems(ch.lineItems);
              const sub = ch.submission;
              const st = sub ? SUB_STYLE[sub.status] : null;
              return (
                <motion.div key={ch.id} data-testid="fee-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30"><Receipt size={20} className="text-primary-600" /></div>
                      <div>
                        <p className="font-display font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {ch.title}
                          {ch.source === "admission" && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">ADMISSION</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Challan #{ch.challanNo}{ch.source === "admission" ? "" : ` · Due ${fmtDate(ch.dueDate)}`}{ch.semester ? ` · Semester ${ch.semester}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusChip(ch.status)}`}>{ch.status}</span>
                  </div>
                  {ch.description && <p className="px-5 pt-3 text-xs text-muted-app">{ch.description}</p>}
                  {items.length > 0 && (
                    <div className="px-5 py-3">
                      <table className="w-full text-sm">
                        <tbody>
                          {items.map((it, j) => (
                            <tr key={j} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                              <td className="py-1.5 text-slate-700 dark:text-slate-300">{it.label || it.name || it.description}</td>
                              <td className={`py-1.5 text-right font-semibold ${Number(it.amount) < 0 ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"}`}>{fmtMoney(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {ch.installments?.length > 0 && (
                    <div className="px-5 pb-3">
                      <p className="text-[10px] uppercase font-bold text-muted-app mb-1">Monthly instalments</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {ch.installments.map((it) => (
                          <div key={it.id} className={`rounded-lg border px-3 py-2 text-xs ${it.status === "PAID" ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900/50" : "border-app"}`}>
                            <p className="font-semibold text-app">#{it.seq} · {fmtMoney(it.amount)}</p>
                            <p className="text-muted-app">{it.status === "PAID" ? `Paid ${fmtDate(it.paidAt)}` : `Due ${fmtDate(it.dueDate)}`}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {ch.notice && (
                    <p className="mx-5 mb-3 text-sm font-semibold text-amber-700 dark:text-amber-300" data-testid="fee-card-notice">{ch.notice}</p>
                  )}
                  {sub && st && (
                    <div className={`mx-5 mb-3 rounded-lg border px-3 py-2 text-xs flex flex-wrap items-center gap-2 ${st.cls}`} data-testid="submission-status">
                      <st.icon size={14} />
                      <span className="font-bold">{st.label}</span>
                      <span>· {fmtMoney(sub.amount)} · Txn {sub.transactionId} · paid {fmtDate(sub.paidOn)}</span>
                      {sub.status === "REJECTED" && sub.rejectionReason && <span className="w-full">Reason: {sub.rejectionReason}</span>}
                      <button onClick={() => viewProof(sub.id)} className="ml-auto underline inline-flex items-center gap-1"><ImageIcon size={12} /> Screenshot</button>
                    </div>
                  )}
                  <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Total: </span>
                      <span className="font-display font-extrabold text-lg text-slate-900 dark:text-slate-100">{fmtMoney(ch.totalAmount)}</span>
                      {ch.status === "PAID" && ch.paidAt && (
                        <span className="ml-3 text-xs text-emerald-600 font-semibold">Paid {fmtDate(ch.paidAt)}{ch.paymentRef ? ` · Ref ${ch.paymentRef}` : ""}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {ch.fileName && (
                        <a href={fileUrl(ch.fileName)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                          <Download size={14} /> Download Challan
                        </a>
                      )}
                      {ch.source !== "admission" && ch.canSubmit && (
                        <button onClick={() => openPay(ch)} data-testid="submit-proof"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                          <Upload size={14} /> {sub?.status === "REJECTED" ? "Resubmit Payment" : "Submit Payment"}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Submit Payment Proof" subtitle={payFor ? `${payFor.title} — ${fmtMoney(payFor.amountDue)}` : ""} icon={Upload} maxWidth="max-w-lg">
        {payFor && (
          <div className="space-y-3">
            <div className="rounded-lg bg-app-subtle p-3 text-xs text-app">{payFor.notice}</div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Payment method</label>
              <select data-testid="pay-method" value={form.method} onChange={(e) => setForm((x) => ({ ...x, method: e.target.value }))} className="input-base w-full text-sm">
                <option value="">Select method…</option>
                {methods.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Amount (PKR)</label>
                <input value={Number(payFor.amountDue).toLocaleString("en-PK")} readOnly className="input-base w-full text-sm bg-app-subtle" />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Payment date</label>
                <input data-testid="pay-date" type="date" max={todayIso()} value={form.paidOn} onChange={(e) => setForm((x) => ({ ...x, paidOn: e.target.value }))} className="input-base w-full text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Transaction ID</label>
              <input data-testid="pay-txn" value={form.transactionId} onChange={(e) => setForm((x) => ({ ...x, transactionId: e.target.value }))} className="input-base w-full text-sm" placeholder="e.g. 83920471" />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Screenshot (PNG / JPG / WEBP, max {MAX_MB} MB)</label>
              <input data-testid="pay-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] || null)} className="block w-full text-xs" />
            </div>
            {formErr && <p className="text-xs text-rose-600" data-testid="pay-error">{formErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setPayFor(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
              <button data-testid="pay-send" onClick={submit} disabled={sending} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">{sending ? "Submitting…" : "Submit for approval"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AccountBook;

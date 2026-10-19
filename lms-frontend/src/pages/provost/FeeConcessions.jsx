import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Search, Ban, Percent } from "lucide-react";
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
   Provost — Fee Concessions, Instalments & Scholarships (S9)
   The Admission base fee is never changed. A concession or scholarship
   (percentage or fixed amount) reduces the payable amount; an
   instalment plan splits it into monthly instalments. Every grant /
   revoke is kept as history (who, what, when, why) and immediately
   re-prices the student's open semester fee, notice and defaulter
   status (pushed to the student in real time).
   ============================================================= */
const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString("en-PK")}`;
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; } };
const KIND_LABEL = { CONCESSION: "Concession", SCHOLARSHIP: "Scholarship", INSTALLMENT: "Instalment plan" };
const KIND_CHIP = {
  CONCESSION: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SCHOLARSHIP: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  INSTALLMENT: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};
// Universal search (same rules as the backend list endpoint): name / roll /
// ID card / email / phone / CNIC / title — case-insensitive, partial, trimmed;
// CNIC with or without dashes; phone with or without spaces, dashes, +92 / 0.
const phoneCore = (d) => d.replace(/^(0092|92|0)/, "");
const digitsOf = (v) => String(v || "").replace(/\D/g, "");
function matchesSearch(r, raw) {
  const t = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return true;
  if ([r.student, r.roll, r.title, r.registrationNumber, r.username, r.email, r.cnic, r.phone].some((v) => String(v || "").toLowerCase().includes(t))) return true;
  if (!/^[\d\s\-+()]+$/.test(t)) return false;
  const qd = digitsOf(t);
  if (!qd) return false;
  if ([r.cnic, r.roll, r.registrationNumber].some((v) => digitsOf(v).includes(qd))) return true;
  const qp = phoneCore(qd);
  const pd = phoneCore(digitsOf(r.phone));
  return !!qp && !!pd && pd.includes(qp);
}

const EMPTY = { studentId: "", kind: "CONCESSION", title: "", mode: "percent", percent: "", amount: "", installments: "3", firstDueDate: "", semester: "", note: "" };

export default function FeeConcessions() {
  const { toast } = useToast();
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  // ~300ms debounce; the input itself stays controlled so focus is never lost.
  const [query, setQuery] = useState("");
  useEffect(() => { const t = setTimeout(() => setQuery(search), 300); return () => clearTimeout(t); }, [search]);
  const { data, loading, error, reload } = useApi(() => api.provost.feeMgmt.concessions(kind ? `?kind=${kind}` : ""), [kind]);
  const { data: students } = useApi(() => api.provost.feeMgmt.students(""), []);
  useRealtime(api.provost.eventsUrl, { "fee:concession": () => reload() });
  const items = useMemo(() => (data?.items || []).filter((r) => matchesSearch(r, query)), [data, query]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [revoke, setRevoke] = useState(null);
  const [revokeReason, setRevokeReason] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    setPreview(null);
    if (!form.studentId) return;
    api.provost.feeMgmt.feePreview(form.studentId).then(setPreview).catch(() => setPreview(null));
  }, [form.studentId]);

  const base = preview?.baseFee?.amount || 0;
  const currentNet = preview?.calc?.net ?? base;
  const off = form.kind === "INSTALLMENT" ? 0 : form.mode === "percent" ? Math.round((base * Number(form.percent || 0)) / 100) : Math.round(Number(form.amount || 0));
  const newNet = Math.max(0, currentNet - off);

  const save = async () => {
    if (!form.studentId) return toast("Select a student", { type: "error" });
    if (form.title.trim().length < 3) return toast("Enter a title", { type: "error" });
    const body = { studentId: form.studentId, kind: form.kind, title: form.title.trim(), note: form.note || undefined, semester: form.semester || undefined };
    if (form.kind === "INSTALLMENT") { body.installments = Number(form.installments); body.firstDueDate = form.firstDueDate; }
    else if (form.mode === "percent") body.percent = Number(form.percent);
    else body.amount = Number(form.amount);
    setSaving(true);
    try {
      const r = await api.provost.feeMgmt.grantConcession(body);
      toast(`${KIND_LABEL[form.kind]} granted${r.repriced ? ` — ${r.repriced} open fee(s) updated` : ""}`, { type: "success" });
      setOpen(false); setForm(EMPTY); reload();
    } catch (e) { toast(e.message || "Failed", { type: "error" }); } finally { setSaving(false); }
  };

  const doRevoke = async () => {
    if (revokeReason.trim().length < 5) return toast("Enter a reason (at least 5 characters)", { type: "error" });
    try {
      await api.provost.feeMgmt.revokeConcession(revoke.id, { reason: revokeReason.trim() });
      toast("Revoked — recorded in history", { type: "success" });
      setRevoke(null); setRevokeReason(""); reload();
    } catch (e) { toast(e.message || "Failed", { type: "error" }); }
  };

  const all = data?.items || [];
  return (
    <div>
      <PageHeader title="Concessions & Instalments" subtitle="Fee concessions, monthly instalment plans and scholarships — the Admission base fee never changes" icon="Percent" breadcrumb={["Provost", "Concessions"]}
        actions={<button onClick={() => { setForm(EMPTY); setOpen(true); }} className="btn-primary text-sm py-2 px-4 flex items-center gap-2" data-testid="conc-new"><Plus size={14} /> Grant</button>} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <StatCard title="Active concessions" value={all.filter((r) => r.isActive && r.kind === "CONCESSION").length} icon="Percent" color="blue" delay={0.05} />
        <StatCard title="Active scholarships" value={all.filter((r) => r.isActive && r.kind === "SCHOLARSHIP").length} icon="Award" color="purple" delay={0.1} />
        <StatCard title="Instalment plans" value={all.filter((r) => r.isActive && r.kind === "INSTALLMENT").length} icon="CalendarClock" color="amber" delay={0.15} />
        <StatCard title="History entries" value={all.length} icon="History" color="emerald" delay={0.2} />
      </div>

      <div className="card-base p-3 mb-5 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-app" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, roll no., ID card, email, phone or CNIC…" data-testid="conc-search" className="input-base w-full pl-10 text-sm" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="input-base text-sm md:w-48">
          <option value="">All types</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error ? <ErrorState description={error} onRetry={reload} /> : loading ? <Skeleton className="h-80 w-full rounded-2xl" /> : items.length === 0 ? (
        <div className="card-base">{query.trim() && (data?.items || []).length > 0
          ? <EmptyState icon="SearchX" title="No records found" description="No concession, scholarship or instalment plan matches your search. Clear the search to see the full list." />
          : <EmptyState icon="Percent" title="No concessions yet" description="Grant a concession, scholarship or instalment plan to a student." />}</div>
      ) : (
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-app">
                {["Student", "Type", "Title", "Value", "Semester", "Granted", "Status", ""].map((h) => <th key={h} className="text-left p-3 text-xs font-bold text-app uppercase">{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map((r, i) => (
                  <motion.tr key={r.id} data-testid="conc-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="border-b border-app">
                    <td className="p-3"><p className="font-semibold text-app">{r.student}</p><p className="text-[11px] text-muted-app font-mono">{r.roll} · {r.program || "—"}</p></td>
                    <td className="p-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${KIND_CHIP[r.kind]}`}>{KIND_LABEL[r.kind]}</span></td>
                    <td className="p-3 text-xs text-app">{r.title}{r.note && <p className="text-[10px] text-muted-app">{r.note}</p>}</td>
                    <td className="p-3 text-xs font-semibold text-app">{r.kind === "INSTALLMENT" ? `${r.installments} monthly · from ${fmtDate(r.firstDueDate)}` : r.percent != null ? `${r.percent}%` : fmtMoney(r.amount)}</td>
                    <td className="p-3 text-xs text-app">{r.semester ? `Semester ${r.semester}` : "Every semester"}</td>
                    <td className="p-3 text-[11px] text-muted-app">{r.grantedBy}<br />{fmtDate(r.grantedAt)}</td>
                    <td className="p-3 text-[11px]">{r.isActive ? <span className="font-bold text-emerald-600">Active</span> : <span className="text-rose-600" title={r.revokeReason || ""}>Revoked by {r.revokedBy} · {fmtDate(r.revokedAt)}<br />{r.revokeReason}</span>}</td>
                    <td className="p-3 text-right">{r.isActive && <button onClick={() => { setRevoke(r); setRevokeReason(""); }} className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1"><Ban size={11} /> Revoke</button>}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Grant concession / instalments / scholarship" icon={Percent} maxWidth="max-w-xl">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Student</label>
            <select value={form.studentId} onChange={(e) => set("studentId", e.target.value)} className="input-base w-full text-sm" data-testid="conc-student">
              <option value="">Select student…</option>
              {(students?.items || []).map((s) => <option key={s.studentId} value={s.studentId}>{s.roll} — {s.name} ({s.program || "—"} · Sem {s.semester || "—"})</option>)}
            </select>
          </div>
          {preview && (
            <div className="rounded-lg bg-app-subtle p-3 text-xs text-app" data-testid="conc-preview">
              {preview.baseFee ? <>Admission base fee: <b>{fmtMoney(base)}</b> (unchanged) · currently payable: <b>{fmtMoney(currentNet)}</b>{form.kind !== "INSTALLMENT" && off > 0 && <> · after this: <b className="text-emerald-600">{fmtMoney(newNet)}</b></>}</> : <span className="text-rose-600">No Admission fee record found for this student's program.</span>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Type</label>
              <select value={form.kind} onChange={(e) => set("kind", e.target.value)} className="input-base w-full text-sm" data-testid="conc-kind">
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Semester</label>
              <select value={form.semester} onChange={(e) => set("semester", e.target.value)} className="input-base w-full text-sm">
                <option value="">Every semester</option>{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>Semester {n}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Title</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className="input-base w-full text-sm" placeholder={form.kind === "SCHOLARSHIP" ? "e.g. Merit scholarship" : form.kind === "INSTALLMENT" ? "e.g. 3-month plan" : "e.g. Need-based concession"} data-testid="conc-title" />
          </div>
          {form.kind === "INSTALLMENT" ? (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Monthly instalments</label>
                <select value={form.installments} onChange={(e) => set("installments", e.target.value)} className="input-base w-full text-sm">{[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">First due date</label>
                <input type="date" value={form.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} className="input-base w-full text-sm" data-testid="conc-first" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">By</label>
                <select value={form.mode} onChange={(e) => set("mode", e.target.value)} className="input-base w-full text-sm"><option value="percent">Percentage</option><option value="amount">Fixed amount</option></select></div>
              <div><label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">{form.mode === "percent" ? "Percent (%)" : "Amount (PKR)"}</label>
                <input type="number" value={form.mode === "percent" ? form.percent : form.amount} onChange={(e) => set(form.mode === "percent" ? "percent" : "amount", e.target.value)} className="input-base w-full text-sm" data-testid="conc-value" /></div>
            </div>
          )}
          <div><label className="text-[10px] uppercase font-bold text-muted-app mb-1 block">Note (optional)</label>
            <input value={form.note} onChange={(e) => set("note", e.target.value)} className="input-base w-full text-sm" /></div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setOpen(false)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary text-sm py-2 px-4 disabled:opacity-50" data-testid="conc-save">{saving ? "Saving…" : "Grant"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!revoke} onClose={() => setRevoke(null)} title="Revoke" subtitle={revoke ? `${revoke.student} — ${revoke.title}` : ""} icon={Ban} maxWidth="max-w-md">
        <div className="space-y-3">
          <textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={2} className="input-base w-full text-sm" placeholder="Reason (recorded in history)" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setRevoke(null)} className="btn-secondary text-sm py-2 px-4">Cancel</button>
            <button onClick={doRevoke} className="btn-primary text-sm py-2 px-4">Revoke</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

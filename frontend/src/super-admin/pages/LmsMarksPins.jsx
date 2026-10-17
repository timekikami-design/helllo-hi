// ============================================================
//  SUPER ADMIN — TEACHER MARKS PIN RESET (Section 2)
//  Lists every LMS teacher with their Marks-PIN state. "Reset PIN"
//  (with confirmation) generates a temporary PIN that is shown ONCE
//  with a copy button; the teacher enters it in the Marks module and
//  is then forced to set their own new PIN.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import DataTable from '../components/DataTable';
import { PageHeader, Breadcrumb, Badge, useToast, ConfirmationModal } from '../components/ui';

const STATUS = {
  ACTIVE: { label: 'Active', color: 'green' },
  NOT_SET: { label: 'Not set', color: 'gray' },
  LOCKED: { label: 'Locked', color: 'red' },
  RESET_PENDING: { label: 'Reset pending', color: 'amber' },
};

export const MarksPins = () => {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null); // { teacher, temporaryPin }
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/super-admin/lms/marks-pins');
      setRows(data.teachers || []);
    } catch (e) {
      toast.push(e.response?.data?.error || 'Failed to load teachers', 'error');
    } finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const doReset = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/super-admin/lms/marks-pins/${target.id}/reset`);
      setIssued({ teacher: target, temporaryPin: data.temporaryPin });
      setCopied(false);
      setTarget(null);
      toast.push(`Marks PIN reset for ${target.username}`, 'success');
      load();
    } catch (e) {
      toast.push(e.response?.data?.error || 'Reset failed', 'error');
    } finally { setBusy(false); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.temporaryPin);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (e.g. insecure context): select the text for manual copy.
      const el = document.getElementById('sa-temp-pin');
      if (el) { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
      toast.push('Press Ctrl+C to copy the selected PIN', 'info');
    }
  };

  const columns = [
    { key: 'fullName', header: 'Teacher', render: (r) => (<div><div style={{ fontWeight: 600 }}>{r.fullName}</div><div style={{ fontSize: 11.5, color: 'var(--sa-text-muted)' }}>{r.username}{r.email ? ` · ${r.email}` : ''}</div></div>), exportValue: (r) => r.fullName },
    { key: 'role', header: 'Role', render: (r) => (r.role === 'CourseCoordinator' ? 'Course Coordinator' : 'Teacher'), exportValue: (r) => r.role },
    { key: 'department', header: 'Department', render: (r) => r.department || '—', exportValue: (r) => r.department || '' },
    { key: 'pinStatus', header: 'PIN status', render: (r) => <Badge color={STATUS[r.pinStatus].color}>{STATUS[r.pinStatus].label}</Badge>, exportValue: (r) => STATUS[r.pinStatus].label },
    { key: 'failedAttempts', header: 'Failed attempts', render: (r) => r.failedAttempts || 0, exportValue: (r) => r.failedAttempts || 0 },
    { key: 'resetAt', header: 'Last reset', render: (r) => (r.resetAt ? new Date(r.resetAt).toLocaleString() : '—'), exportValue: (r) => r.resetAt || '' },
    { key: 'actions', header: '', exportable: false, tdStyle: { textAlign: 'right' }, render: (r) => (
      <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setTarget(r)} data-testid={`reset-pin-${r.username}`}>
        <i className="fas fa-key" /> Reset PIN
      </button>
    ) },
  ];

  return (
    <>
      <Breadcrumb items={[{ label: 'LMS Oversight' }, { label: 'Teacher Marks PINs' }]} />
      <PageHeader title="Teacher Marks PINs"
        subtitle="Reset a teacher's exam-marks PIN when they forget it. A temporary PIN is generated for you to send to the teacher; they must set their own new PIN on first use." />

      {issued && (
        <div className="sa-card sa-card-pad" style={{ marginBottom: 16, borderLeft: '4px solid var(--sa-success,#16a34a)' }} data-testid="temp-pin-card">
          <div style={{ fontWeight: 700, marginBottom: 6 }}><i className="fas fa-circle-check" style={{ color: 'var(--sa-success,#16a34a)', marginRight: 6 }} />Temporary PIN for {issued.teacher.fullName} ({issued.teacher.username})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span id="sa-temp-pin" data-testid="temp-pin" style={{ fontFamily: 'monospace', fontSize: 28, letterSpacing: 6, fontWeight: 700, padding: '4px 14px', borderRadius: 8, background: 'var(--sa-surface-2,#f1f5f9)' }}>{issued.temporaryPin}</span>
            <button className="sa-btn sa-btn-primary sa-btn-sm" onClick={copy}><i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copied' : 'Copy PIN'}</button>
            <button className="sa-btn sa-btn-ghost sa-btn-sm" onClick={() => setIssued(null)}>Done</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--sa-text-muted)', marginTop: 8 }}>
            This PIN is shown only once and is stored encrypted. Send it to the teacher privately. When they open Marks they will enter it and immediately set their own new PIN; the temporary PIN then stops working.
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={rows} loading={loading} searchKeys={['fullName', 'username', 'email', 'department']}
        exportName="teacher-marks-pins" exportTitle="Teacher Marks PINs" emptyText="No LMS teachers found." />

      <ConfirmationModal open={!!target} danger title="Reset Marks PIN?"
        message={`This will invalidate ${target?.fullName} (${target?.username})'s current Marks PIN, clear any lockout and sign out open Marks sessions. A temporary PIN will be generated for you to send them.`}
        confirmLabel="Reset PIN" loading={busy} onClose={() => setTarget(null)} onConfirm={doReset} />
    </>
  );
};

export default MarksPins;

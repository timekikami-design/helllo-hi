// ============================================================
//  SUPER ADMIN — LMS Course Coordinator assignment (Section 12)
//  Lets the Super Admin pick an EXISTING LMS teacher / coordinator
//  account as this department's Course Coordinator. Writes LMS-side
//  records only (LmsUser role + department binding + assignment row).
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import api from '../../utils/api';
import { useToast, ConfirmationModal } from './ui';

const LmsCoordinatorPanel = ({ department }) => {
  const toast = useToast();
  const [data, setData] = useState({ candidates: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/super-admin/lms/course-coordinators', { params: { departmentId: department.id } });
      setData(res.data || { candidates: [], assignments: [] });
    } catch (e) {
      toast.push(e.response?.data?.error || 'Failed to load LMS coordinators', 'error');
    } finally { setLoading(false); }
  }, [department.id, toast]);
  useEffect(() => { load(); }, [load]);

  const assigned = new Set(data.assignments.map((a) => a.lmsUserId));
  const options = data.candidates.filter((c) => !assigned.has(c.id) && c.isActive !== false);

  const assign = async () => {
    if (!pick) { toast.push('Select an LMS teacher or coordinator first', 'error'); return; }
    setBusy(true);
    try {
      await api.post('/super-admin/lms/course-coordinators', { departmentId: department.id, lmsUserId: pick });
      toast.push('Course Coordinator assigned in the LMS', 'success');
      setPick(''); load();
    } catch (e) {
      toast.push(e.response?.data?.error || 'Assignment failed', 'error');
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/super-admin/lms/course-coordinators/${removeTarget.id}`);
      toast.push('Assignment removed', 'success');
      setRemoveTarget(null); load();
    } catch (e) {
      toast.push(e.response?.data?.error || 'Remove failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, borderTop: '1px dashed var(--sa-border,#e2e8f0)', paddingTop: 10 }} data-testid="lms-coordinator-panel">
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
        <i className="fas fa-chalkboard-user" style={{ marginRight: 6 }} />
        LMS Course Coordinator(s) — assign from existing LMS teachers / coordinators
      </div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--sa-text-muted)' }}>Loading…</div> : (
        <>
          {data.assignments.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--sa-text-muted)', marginBottom: 6 }}>No LMS account assigned from the existing list yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {data.assignments.map((a) => (
                <span key={a.id} className="sa-badge blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {a.fullName && a.fullName !== a.username ? `${a.fullName} · ` : ''}{a.username}
                  <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" style={{ padding: '0 4px' }}
                    title="Remove assignment" onClick={() => setRemoveTarget(a)}><i className="fas fa-xmark" /></button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="sa-select" value={pick} onChange={(e) => setPick(e.target.value)} style={{ maxWidth: 420 }} data-testid="lms-coordinator-select">
              <option value="">— Select existing LMS user ({options.length} available) —</option>
              {options.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName && c.fullName !== c.username ? `${c.fullName} — ` : ''}{c.username}{c.email ? ` (${c.email})` : ''} · {c.role === 'CourseCoordinator' ? 'Course Coordinator' : 'Teacher'}{c.department ? ` · ${c.department}` : ''}
                </option>
              ))}
            </select>
            <button type="button" className="sa-btn sa-btn-primary sa-btn-sm" disabled={busy || !pick} onClick={assign}>
              <i className="fas fa-user-plus" /> Assign
            </button>
          </div>
        </>
      )}
      <ConfirmationModal open={!!removeTarget} danger title="Remove Course Coordinator?"
        message={`${removeTarget?.username} will no longer be Course Coordinator of ${department.name}. Their previous LMS role is restored.`}
        confirmLabel="Remove" loading={busy} onClose={() => setRemoveTarget(null)} onConfirm={remove} />
    </div>
  );
};

export default LmsCoordinatorPanel;

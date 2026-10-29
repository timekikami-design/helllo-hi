// ============================================================
//  SUPER ADMIN — PORTAL / MODULE CATALOG (redesign of Portals.jsx)
//  Same data as the existing registry. There is no install /
//  update / uninstall API in this project, so no such actions are
//  offered — reserved modules are clearly marked instead.
//  Filters live in component state (the project does not sync
//  filters to the URL elsewhere).
// ============================================================
import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Breadcrumb, Badge } from '../components/ui';

const MODULES = [
  {
    key: 'admissions', name: 'Admissions Portal', icon: 'fa-file-signature', status: 'active', category: 'Academic',
    publisher: 'AUST ODL', roles: ['Director Admissions', 'Coordinator'],
    powers: 'Applications, decisions and overrides, document verification, merit lists, cycle configuration, statistics and reports.',
    access: ['Read and update every application and its documents', 'Publish initial and final merit lists', 'Configure admission cycles and fees'],
    to: '/super-admin/admissions/applications',
  },
  {
    key: 'lms', name: 'Learning Management System', icon: 'fa-graduation-cap', status: 'active', category: 'Academic',
    publisher: 'AUST ODL', roles: ['Student', 'Teacher', 'Course Coordinator', 'Focal Person', 'Exam Controller', 'QEC Coordinator', 'Provost'],
    powers: 'Marks, attendance, assignments, materials, sections, teacher assignment, fees and fines, drops and restores, exams and rechecks, surveys.',
    access: ['Read and change marks, attendance and results', 'Manage enrollments, sections and teacher assignments', 'Manage LMS fees, fines and rechecks'],
    to: '/super-admin/lms/students',
  },
  {
    key: 'governance', name: 'Institution & Security', icon: 'fa-building-shield', status: 'active', category: 'Platform',
    publisher: 'AUST ODL', roles: ['Super Admin (exclusive)'],
    powers: 'Institution management, user management, audit and override logs, announcements, system configuration, maintenance mode, branding.',
    access: ['Create, suspend and reset any user account', 'Read the audit trail and override log', 'Turn maintenance mode on and off'],
    to: '/super-admin/institution/profile',
  },
  { key: 'finance', name: 'Finance & Accounts', icon: 'fa-coins', status: 'reserved', category: 'Operations', publisher: 'Not yet built', roles: [], powers: 'Ledger, vouchers, payroll.', access: [] },
  { key: 'hr', name: 'HR & Faculty', icon: 'fa-id-badge', status: 'reserved', category: 'Operations', publisher: 'Not yet built', roles: [], powers: 'Recruitment, leave, appraisals.', access: [] },
  { key: 'library', name: 'Library', icon: 'fa-book-open-reader', status: 'reserved', category: 'Academic', publisher: 'Not yet built', roles: [], powers: 'Catalogue, circulation, fines.', access: [] },
  { key: 'hostel', name: 'Hostel & Transport', icon: 'fa-bus', status: 'reserved', category: 'Operations', publisher: 'Not yet built', roles: [], powers: 'Rooms, routes, allocations.', access: [] },
];

const STATUS = {
  active: { label: 'Active', color: 'green' },
  reserved: { label: 'Reserved', color: 'gray' },
};
const STATUSES = ['all', 'active', 'reserved'];
const CATEGORIES = ['all', ...Array.from(new Set(MODULES.map((m) => m.category)))];

export const PortalCatalog = () => {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const searchRef = useRef(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return MODULES.filter((m) => (status === 'all' || m.status === status)
      && (category === 'all' || m.category === category)
      && (!needle || `${m.name} ${m.powers} ${m.roles.join(' ')}`.toLowerCase().includes(needle)));
  }, [q, status, category]);

  const clearAll = () => { setQ(''); setStatus('all'); setCategory('all'); searchRef.current?.focus(); };

  return (
    <>
      <Breadcrumb items={[{ label: 'Future Portals' }, { label: 'Portal Registry' }]} />
      <PageHeader
        title="Portal registry"
        subtitle="Every portal the Super Admin Console governs today, and the modules reserved for later. New portals inherit Super Admin access when they launch."
      />

      <div className="sa-card sa-card-pad" role="search" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <label htmlFor="cat-q" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Search</label>
          <div style={{ position: 'relative' }}>
            <input
              ref={searchRef} id="cat-q" className="sa-input" type="search" value={q}
              onChange={(e) => setQ(e.target.value)} placeholder="Name, role or capability"
              style={{ width: '100%', paddingRight: 40 }}
            />
            {q && (
              <button type="button" className="sa-icon-btn" onClick={() => { setQ(''); searchRef.current?.focus(); }}
                aria-label="Clear search" style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', minHeight: 36, minWidth: 36 }}>
                <i className="fas fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="cat-status" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Status</label>
          <select id="cat-status" className="sa-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : STATUS[s].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="cat-cat" style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Category</label>
          <select id="cat-cat" className="sa-filter-select" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
          </select>
        </div>
      </div>

      <p role="status" aria-live="polite" style={{ fontSize: 13, color: 'var(--sa-text-soft)', margin: '0 0 10px' }}>
        {list.length} of {MODULES.length} modules shown
      </p>

      {list.length === 0 ? (
        <div className="sa-card sa-card-pad" style={{ textAlign: 'center' }}>
          <strong style={{ display: 'block', marginBottom: 6 }}>No modules match these filters</strong>
          <p style={{ color: 'var(--sa-text-soft)', margin: '0 0 12px' }}>Try a different search word, or show every status and category.</p>
          <button type="button" className="sa-btn sa-btn-ghost" onClick={clearAll}>Clear filters</button>
        </div>
      ) : (
        <div className="sa-card" style={{ overflow: 'hidden' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {list.map((m) => {
              const open = openKey === m.key;
              const st = STATUS[m.status];
              return (
                <li key={m.key} style={{ borderBottom: '1px solid var(--sa-border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 14, alignItems: 'center', padding: '16px 18px' }}>
                    <div className={`sa-gov-ic ${m.status === 'active' ? 'blue' : 'gray'}`} aria-hidden="true"><i className={`fas ${m.icon}`} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 15 }}>{m.name}</strong>
                        <Badge color={st.color}>{st.label}</Badge>
                        <span style={{ fontSize: 12, color: 'var(--sa-text-muted)' }}>{m.category} · {m.publisher}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--sa-text-soft)', marginTop: 4, overflowWrap: 'anywhere' }}>{m.powers}</div>
                    </div>
                    <button
                      type="button" className="sa-btn sa-btn-ghost sa-btn-sm"
                      aria-expanded={open} aria-controls={`mod-${m.key}`}
                      onClick={() => setOpenKey(open ? null : m.key)}
                    >
                      {open ? 'Hide details' : 'Details'}<span className="ds-sr-only"> for {m.name}</span>
                    </button>
                  </div>
                  {open && (
                    <div id={`mod-${m.key}`} style={{ padding: '0 18px 18px', display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))' }}>
                      {m.status === 'active' ? (
                        <>
                          <div>
                            <div className="sa-nav-group-label" style={{ color: 'var(--sa-text-muted)', marginBottom: 6 }}>What Super Admin can do here</div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--sa-text-soft)', lineHeight: 1.7 }}>
                              {m.access.map((a) => <li key={a}>{a}</li>)}
                            </ul>
                          </div>
                          <div>
                            <div className="sa-nav-group-label" style={{ color: 'var(--sa-text-muted)', marginBottom: 6 }}>Roles inside this portal</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{m.roles.map((r) => <span key={r} className="sa-chip">{r}</span>)}</div>
                            <Link to={m.to} className="sa-btn sa-btn-primary sa-btn-sm" style={{ marginTop: 14, display: 'inline-flex' }}>Open command center</Link>
                          </div>
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--sa-text-soft)' }}>
                          This module isn't built yet. When it launches it will inherit Super Admin access automatically, with no changes to existing portals.
                          Nothing can be installed or configured here until then.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="sa-card sa-card-pad" style={{ marginTop: 20 }}>
        <strong>How new portals inherit access</strong>
        <p style={{ fontSize: 13, color: 'var(--sa-text-soft)', margin: '6px 0 0' }}>
          A new portal exposes its service layer. The console mounts a governance module that calls those services and records
          every action to the shared audit trail, the portal's own audit log and the permanent override log.
        </p>
      </div>
    </>
  );
};

export default PortalCatalog;

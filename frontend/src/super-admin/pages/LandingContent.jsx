// ============================================================
//  SUPER ADMIN — LANDING PAGE CONTENT (Change 7)
//  Edit every text, link and image on the public landing page,
//  organised by section. Each field shows the built-in default (the
//  original text); clearing a field restores that default. Saving
//  updates the live landing page without a code change or redeploy
//  (open landing tabs in this browser refresh instantly; other visitors
//  pick it up within seconds).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/api';
import { PageHeader, Breadcrumb, Badge, useToast } from '../components/ui';
import { LANDING_SECTIONS, LANDING_DEFAULTS } from '../../data/landingContent';

export const LandingContent = () => {
  const toast = useToast();
  const [saved, setSaved] = useState({});      // stored overrides from the server
  const [draft, setDraft] = useState({});      // key → value currently in the editor
  const [active, setActive] = useState(LANDING_SECTIONS[0].id);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/super-admin/landing-content');
      const v = data.values || {};
      setSaved(v);
      setDraft(Object.fromEntries(Object.keys(LANDING_DEFAULTS).map((k) => [k, v[k] != null ? v[k] : LANDING_DEFAULTS[k]])));
      setUpdatedAt(data.updatedAt || null);
    } catch (e) { toast.push(e.response?.data?.error || 'Failed to load landing content', 'error'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const current = (k) => (saved[k] != null ? saved[k] : LANDING_DEFAULTS[k]);
  const dirtyKeys = useMemo(() => Object.keys(draft).filter((k) => String(draft[k] ?? '') !== String(current(k) ?? '')), [draft, saved]); // eslint-disable-line react-hooks/exhaustive-deps

  const section = LANDING_SECTIONS.find((s) => s.id === active) || LANDING_SECTIONS[0];
  const term = q.trim().toLowerCase();
  const fields = term
    ? LANDING_SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, sectionTitle: s.title })))
      .filter((f) => f.label.toLowerCase().includes(term) || String(draft[f.key] ?? '').toLowerCase().includes(term))
    : section.fields;

  const save = async (keys) => {
    const list = keys || dirtyKeys;
    if (!list.length) { toast.push('No changes to save', 'info'); return; }
    setBusy(true);
    try {
      // A value equal to the default (or empty) is stored as "reset to default".
      const values = Object.fromEntries(list.map((k) => {
        const v = draft[k] ?? '';
        return [k, v === '' || v === LANDING_DEFAULTS[k] ? '' : v];
      }));
      const { data } = await api.put('/super-admin/landing-content', { values });
      setSaved(data.values || {});
      setUpdatedAt(data.updatedAt || null);
      try { const bc = new BroadcastChannel('aust-landing-content'); bc.postMessage('updated'); bc.close(); } catch (_) { /* unsupported */ }
      toast.push(`Landing page updated (${list.length} item${list.length > 1 ? 's' : ''})`, 'success');
    } catch (e) { toast.push(e.response?.data?.error || 'Save failed', 'error'); }
    finally { setBusy(false); }
  };

  const resetField = (k) => setDraft((d) => ({ ...d, [k]: LANDING_DEFAULTS[k] }));
  const sectionDirty = (s) => s.fields.some((f) => dirtyKeys.includes(f.key));

  return (
    <>
      <Breadcrumb items={[{ label: 'System' }, { label: 'Landing Page Content' }]} />
      <PageHeader
        title="Landing Page Content"
        subtitle="Edit every heading, paragraph, button, statistic, link and image on the public landing page. Changes go live as soon as you save."
        actions={(
          <div style={{ display: 'flex', gap: 8 }}>
            <a className="sa-btn sa-btn-ghost" href="/" target="_blank" rel="noreferrer"><i className="fas fa-arrow-up-right-from-square" /> View landing page</a>
            <button className="sa-btn sa-btn-primary" onClick={() => save()} disabled={busy || !dirtyKeys.length} data-testid="landing-save-all">
              <i className="fas fa-floppy-disk" /> {busy ? 'Saving…' : `Save all changes${dirtyKeys.length ? ` (${dirtyKeys.length})` : ''}`}
            </button>
          </div>
        )}
      />

      <div className="sa-lc-grid" style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 16, alignItems: 'start' }}>
        <aside className="sa-card sa-card-pad" style={{ position: 'sticky', top: 12 }}>
          <input className="sa-input" placeholder="Search any text…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} data-testid="landing-search" />
          {LANDING_SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => { setActive(s.id); setQ(''); }}
              className={`sa-btn sa-btn-sm ${active === s.id && !term ? 'sa-btn-primary' : 'sa-btn-ghost'}`}
              style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>{s.title}</span>{sectionDirty(s) && <span title="Unsaved changes">●</span>}
            </button>
          ))}
          <div style={{ fontSize: 11.5, color: 'var(--sa-text-muted)', marginTop: 10 }}>
            {Object.keys(saved).length} customised item(s){updatedAt ? ` · last saved ${new Date(updatedAt).toLocaleString()}` : ''}
          </div>
        </aside>

        <section className="sa-card sa-card-pad">
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{term ? `Search results (${fields.length})` : section.title}</h3>
            {!term && (
              <button className="sa-btn sa-btn-sm sa-btn-primary" disabled={busy || !sectionDirty(section)}
                onClick={() => save(section.fields.map((f) => f.key).filter((k) => dirtyKeys.includes(k)))}>
                <i className="fas fa-floppy-disk" /> Save this section
              </button>
            )}
          </header>
          {loading ? <p style={{ color: 'var(--sa-text-muted)' }}>Loading…</p> : fields.map((f) => {
            const changed = dirtyKeys.includes(f.key);
            const custom = saved[f.key] != null;
            return (
              <div key={f.key} className="sa-field" data-testid={`landing-field-${f.key}`}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {f.sectionTitle ? <span style={{ color: 'var(--sa-text-muted)' }}>{f.sectionTitle} ›</span> : null}
                  {f.label}
                  {custom && !changed && <Badge color="blue">Customised</Badge>}
                  {changed && <Badge color="amber">Unsaved</Badge>}
                  {(custom || draft[f.key] !== LANDING_DEFAULTS[f.key]) && (
                    <button type="button" className="sa-btn sa-btn-ghost sa-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => resetField(f.key)} title="Restore the original text">
                      <i className="fas fa-rotate-left" /> Default
                    </button>
                  )}
                </label>
                {f.type === 'textarea' ? (
                  <textarea className="sa-textarea" rows={3} value={draft[f.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                ) : (
                  <input className="sa-input" type={f.type === 'number' ? 'number' : 'text'} value={draft[f.key] ?? ''}
                    placeholder={f.type === 'image' ? 'https://… (image URL)' : undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                )}
                {f.type === 'image' && draft[f.key] && <img src={draft[f.key]} alt="" style={{ marginTop: 6, maxHeight: 90, borderRadius: 8 }} />}
              </div>
            );
          })}
        </section>
      </div>
    </>
  );
};

export default LandingContent;

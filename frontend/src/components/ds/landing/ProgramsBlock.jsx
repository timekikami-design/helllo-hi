import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../../utils/api';
import { CONTACT } from '../../../data/siteFacts';
import Icon from '../Icon';

/** Programs grouped by department, ARIA tabs with arrow-key navigation. Data from existing public APIs. */
const ProgramsBlock = ({ cycleId }) => {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const [active, setActive] = useState(0);
  const tabRefs = useRef([]);

  const load = () => {
    setState({ status: 'loading', items: [] });
    const fromCycle = cycleId
      ? api.get(`/admission-cycle/${cycleId}/programs`).then((r) => (r.data.programs || []).map((p) => ({
        id: p.programId || p.id, name: p.programName, code: p.programShortForm, department: p.department,
        minMarks: p.minMarksPercent, seats: p.totalSeats,
      }))).catch(() => [])
      : Promise.resolve([]);
    Promise.all([fromCycle, api.get('/programs').then((r) => r.data.programs || [])])
      .then(([cyclePrograms, all]) => {
        const byId = Object.fromEntries(all.map((p) => [p.id, p]));
        const base = cyclePrograms.length
          ? cyclePrograms
          : all.map((p) => ({ id: p.id, name: p.name, code: p.shortForm || p.code, department: '', minMarks: p.minMarksPercent }));
        const items = base.map((p) => ({ ...p, duration: byId[p.id]?.duration, semesters: byId[p.id]?.semesters }));
        setState({ status: items.length ? 'ready' : 'empty', items });
      })
      .catch(() => setState({ status: 'error', items: [] }));
  };
  useEffect(load, [cycleId]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map();
    state.items.forEach((p) => {
      const key = p.department || 'All programs';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return [...map.entries()];
  }, [state.items]);

  const onKeyDown = (e) => {
    const last = groups.length - 1;
    const map = { ArrowRight: active === last ? 0 : active + 1, ArrowLeft: active === 0 ? last : active - 1, Home: 0, End: last };
    if (!(e.key in map)) return;
    e.preventDefault();
    setActive(map[e.key]);
    tabRefs.current[map[e.key]]?.focus();
  };

  if (state.status === 'loading') {
    return (
      <div aria-busy="true">
        <span className="ds-sr-only" role="status">Loading programs</span>
        {[0, 1].map((i) => (
          <div className="lp-skel-row" key={i} aria-hidden="true"><span className="ds-skel" /><span className="ds-skel" /><span className="ds-skel" /></div>
        ))}
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="ds-alert ds-alert--error" role="alert">
        <Icon name="alert" size={18} />
        <div>
          We couldn't load the program list. Check your connection and try again, or write to{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
          <div style={{ marginTop: 8 }}>
            <button type="button" className="ds-btn ds-btn--ghost" onClick={load}><Icon name="refresh" size={16} /> Try again</button>
          </div>
        </div>
      </div>
    );
  }
  if (state.status === 'empty') {
    return (
      <div className="ds-empty">
        <h3>No programs are open for applications right now</h3>
        <p>New programs are announced with each admissions cycle. Create an account and you'll be notified when the next one opens.</p>
        <Link to="/register" className="ds-btn ds-btn--brand">Create an account</Link>
      </div>
    );
  }

  const tabbed = groups.length > 1;
  return (
    <>
      {tabbed && (
        <div className="ds-tabs" role="tablist" aria-label="Programs by department">
          {groups.map(([dept], i) => (
            <button
              key={dept}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button" role="tab" id={`prog-tab-${i}`}
              aria-selected={active === i} aria-controls={`prog-panel-${i}`}
              tabIndex={active === i ? 0 : -1}
              className="ds-tab"
              onClick={() => setActive(i)} onKeyDown={onKeyDown}
            >{dept}</button>
          ))}
        </div>
      )}
      {groups.map(([dept, items], i) => (
        <div
          key={dept}
          role={tabbed ? 'tabpanel' : undefined}
          id={`prog-panel-${i}`}
          aria-labelledby={tabbed ? `prog-tab-${i}` : undefined}
          hidden={active !== i}
          tabIndex={tabbed ? 0 : undefined}
        >
          {!tabbed && dept !== 'All programs' && <p className="ds-eyebrow">{dept}</p>}
          <ul className="lp-programs">
            {items.map((p) => (
              <li key={p.id} className="lp-program">
                <h3 className="lp-program__name">
                  {p.name}
                  {p.code && <span className="lp-program__code">{p.code}</span>}
                </h3>
                <span className="lp-program__dur">{p.duration || '[Add duration]'}{p.semesters ? `, ${p.semesters} semesters` : ''}</span>
                <p className="lp-program__desc">
                  {p.minMarks ? `Open to intermediate graduates with at least ${p.minMarks}% marks.` : 'Eligibility is listed on the program page.'}
                  {p.seats ? ` ${p.seats} seats this cycle.` : ''}
                </p>
                <Link to="/programs" className="ds-link">Details <Icon name="arrowRight" size={16} /><span className="ds-sr-only"> about {p.name}</span></Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
};

export default ProgramsBlock;

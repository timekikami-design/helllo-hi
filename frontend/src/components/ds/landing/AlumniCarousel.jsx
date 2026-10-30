import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon';

/**
 * Alumni & graduate stories — horizontal scroll-snap row.
 * No auto-play. Prev/next buttons, keyboard (arrow keys on the focused
 * track), touch swipe (native scroll). Only fields that exist are shown;
 * no photographs exist in the project, so a neutral initials avatar is used.
 */
const AlumniCarousel = ({ items, eyebrow, title, sub }) => {
  const trackRef = useRef(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update]);

  const step = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector('.lx-card');
    const w = card ? card.getBoundingClientRect().width + 24 : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * w, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  };

  if (!items.length) return null;

  return (
    <div className="lx-car">
      <div className="lx-car__head">
        <div>
          <p className="ds-eyebrow">{eyebrow}</p>
          <h2 className="ds-h2" id="alumni-title" style={{ marginBottom: sub ? 'var(--s-3)' : 0 }}>{title}</h2>
          {sub && <p className="ds-lede">{sub}</p>}
        </div>
        <div className="lx-car__ctrl">
          <button type="button" className="lx-car__btn" onClick={() => step(-1)} disabled={edge.start} aria-controls="alumni-track">
            <Icon name="arrowLeft" size={18} /><span className="ds-sr-only">Previous stories</span>
          </button>
          <button type="button" className="lx-car__btn" onClick={() => step(1)} disabled={edge.end} aria-controls="alumni-track">
            <Icon name="arrowRight" size={18} /><span className="ds-sr-only">Next stories</span>
          </button>
        </div>
      </div>
      <div role="region" aria-roledescription="carousel" aria-labelledby="alumni-title">
      <ul
        id="alumni-track"
        ref={trackRef}
        className="lx-car__track"
        tabIndex={0}
        aria-label="Graduate stories. Use the arrow keys or the buttons to scroll."
        onKeyDown={onKey}
      >
        {items.map((a, i) => (
          <li key={`${a.name}-${i}`} className="lx-card" aria-label={`${i + 1} of ${items.length}: ${a.name}`}>
            <div className="lx-card__who">
              <span className="lx-card__av" aria-hidden="true">{a.initials || a.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</span>
              <span><strong>{a.name}</strong>{a.role && <small>{a.role}</small>}</span>
            </div>
            <blockquote>{a.quote}</blockquote>
          </li>
        ))}
      </ul>
      </div>
      <p style={{ marginTop: 'var(--s-4)' }}><Link to="/alumni" className="ds-link">All alumni stories <Icon name="arrowRight" size={16} /></Link></p>
    </div>
  );
};

export default AlumniCarousel;

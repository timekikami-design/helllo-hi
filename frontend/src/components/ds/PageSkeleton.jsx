import React from 'react';
import '../../styles/ds/skeleton.css';

/**
 * Presentation-only loading placeholder shown while a lazy route chunk (or the
 * initial auth check) loads. Mirrors the real page layout so the switch to
 * content does not jump: header bar, page hero band, then content blocks.
 *
 *  variant="landing"  — full-bleed hero (home page)
 *  variant="page"     — public content page (About, Programs, FAQ, ...)
 *  variant="app"      — signed-in portals / dashboards
 *  variant="auth"     — login / register card
 *
 * Shimmer is disabled under prefers-reduced-motion (see base.css `.ds-skel`).
 */
const Line = ({ w = '100%', h = '1rem', className = '' }) => (
  <span className={`ds-skel ${className}`} style={{ width: w, height: h }} />
);

const Header = () => (
  <div className="psk-header">
    <div className="ds-container psk-header__row">
      <span className="psk-brand"><span className="ds-skel psk-logo" /><Line w="9rem" h="1.1rem" className="psk-hide-sm" /></span>
      <span className="psk-nav psk-hide-md">{[0, 1, 2, 3, 4].map((i) => <Line key={i} w="4.5rem" h=".8rem" />)}</span>
      <span className="ds-skel psk-cta" />
    </div>
  </div>
);

const PageSkeleton = ({ variant = 'page' }) => (
  <div className={`psk psk--${variant}`} role="status" aria-busy="true" aria-live="polite">
    <span className="ds-sr-only">Loading…</span>

    {variant === 'app' ? (
      <div className="psk-app" aria-hidden="true">
        <aside className="psk-app__side psk-hide-md">
          <Line w="70%" h="1.4rem" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Line key={i} w={`${60 + (i % 3) * 12}%`} h=".9rem" />)}
        </aside>
        <main className="psk-app__main">
          <Line w="14rem" h="1.75rem" />
          <Line w="22rem" h=".9rem" />
          <div className="psk-cards">{[0, 1, 2, 3].map((i) => <span key={i} className="ds-skel psk-card" />)}</div>
          <span className="ds-skel psk-table" />
        </main>
      </div>
    ) : variant === 'auth' ? (
      <div className="psk-auth" aria-hidden="true">
        <div className="psk-auth__card">
          <span className="ds-skel psk-logo psk-logo--lg" />
          <Line w="60%" h="1.6rem" />
          <Line w="80%" h=".9rem" />
          <Line h="2.75rem" />
          <Line h="2.75rem" />
          <Line h="2.75rem" className="psk-btn" />
        </div>
      </div>
    ) : (
      <div aria-hidden="true">
        <Header />
        {variant === 'landing' ? (
          <div className="psk-hero">
            <div className="ds-container psk-hero__inner">
              <Line w="18rem" h="2rem" className="psk-dark" />
              <Line w="min(34rem, 90%)" h="3.25rem" className="psk-dark" />
              <Line w="min(26rem, 75%)" h="3.25rem" className="psk-dark" />
              <Line w="min(30rem, 85%)" h="1rem" className="psk-dark" />
              <span className="psk-row"><Line w="10rem" h="3rem" className="psk-dark" /><Line w="10rem" h="3rem" className="psk-dark" /></span>
            </div>
          </div>
        ) : (
          <div className="psk-band">
            <div className="ds-container">
              <Line w="8rem" h=".8rem" className="psk-dark" />
              <Line w="min(28rem, 85%)" h="2.25rem" className="psk-dark" />
              <Line w="min(36rem, 95%)" h="1rem" className="psk-dark" />
            </div>
          </div>
        )}
        <div className="ds-container psk-body">
          <div className="psk-text">
            <Line w="40%" h="1.6rem" />
            <Line /><Line /><Line w="92%" /><Line w="70%" />
          </div>
          <div className="psk-grid">{[0, 1, 2].map((i) => <span key={i} className="ds-skel psk-tile" />)}</div>
        </div>
      </div>
    )}
  </div>
);

/** Pick the skeleton that matches the route being loaded. */
export const skeletonVariantFor = (pathname = '/') => {
  if (pathname === '/') return 'landing';
  if (/^\/(login|register|forgot-password|reset-password)/.test(pathname)) return 'auth';
  if (/^\/(dashboard|admin|super-admin|coordinator|lms)/.test(pathname)) return 'app';
  return 'page';
};

export default PageSkeleton;

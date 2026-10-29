import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import Icon from './Icon';

const dashHref = (user) => {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'director_admissions' || user.role === 'admin') return '/admin';
  if (user.role === 'coordinator') return '/coordinator';
  return '/dashboard';
};

export const SITE_NAV = [
  { label: 'Programs', to: '/programs' },
  { label: 'Admissions', to: '/admissions' },
  { label: 'Fees', to: '/fee-structure' },
  { label: 'Online learning', to: '/odl' },
  { label: 'About', to: '/about' },
  { label: 'News', to: '/news' },
  { label: 'Contact', to: '/contact' },
];

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Moves focus to the page's main region (#main, or the element after the header). */
const skipToMain = (e) => {
  const target = document.getElementById('main') || document.querySelector('.ds-site-header + *');
  if (!target) return;
  e.preventDefault();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
  target.scrollIntoView({ block: 'start' });
};

const SiteHeader = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Close on route change (link click) without stealing focus.
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash]);

  // Escape closes, Tab is trapped inside the open drawer, page scroll locked.
  useEffect(() => {
    if (!open) return undefined;
    const drawer = drawerRef.current;
    const first = drawer?.querySelector(FOCUSABLE);
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !drawer) return;
      const items = [...drawer.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    const onResize = () => { if (window.innerWidth > 1080) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  const cta = user
    ? <Link to={dashHref(user)} className="ds-btn ds-btn--primary">Open your portal</Link>
    : <Link to="/register" className="ds-btn ds-btn--primary">Apply online</Link>;

  return (
    <>
      <a className="ds-skip" href="#main" onClick={skipToMain}>Skip to content</a>
      <header className={`ds-site-header${scrolled ? ' is-scrolled' : ''}`}>
        <div className="ds-container ds-site-header__row">
          <Link to="/" className="ds-brand" aria-label="Abbottabad University of Science and Technology, home">
            <img src="/assets/aust-logo.png" alt="" width="40" height="42" decoding="async" />
            <span className="ds-brand__text">
              <span className="ds-brand__name">Abbottabad University</span>
              <span className="ds-brand__sub">of Science &amp; Technology · Open &amp; Distance Learning</span>
            </span>
          </Link>

          <nav className="ds-site-nav" aria-label="Primary">
            <ul>
              {SITE_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} className={({ isActive }) => `ds-site-nav__link${isActive ? ' is-active' : ''}`}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ds-site-header__actions">
            {!user && <Link to="/login" className="ds-site-header__signin">Sign in</Link>}
            <span className="ds-site-header__cta">{cta}</span>
            <button
              ref={triggerRef}
              type="button"
              className="ds-menu-btn"
              aria-expanded={open}
              aria-controls="ds-mobile-nav"
              onClick={() => (open ? close() : setOpen(true))}
            >
              <Icon name={open ? 'close' : 'menu'} size={22} />
              <span className="ds-sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <>
          <div className="ds-drawer-scrim" onClick={() => close()} aria-hidden="true" />
          <div
            id="ds-mobile-nav"
            ref={drawerRef}
            className="ds-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="ds-drawer__head">
              <span className="ds-eyebrow" style={{ margin: 0 }}>Menu</span>
              <button type="button" className="ds-menu-btn ds-menu-btn--plain" onClick={() => close()}>
                <Icon name="close" size={22} />
                <span className="ds-sr-only">Close menu</span>
              </button>
            </div>
            <nav aria-label="Mobile">
              <ul className="ds-drawer__list">
                <li><NavLink to="/" end onClick={() => close(false)}>Home</NavLink></li>
                {SITE_NAV.map((item) => (
                  <li key={item.to}><NavLink to={item.to} onClick={() => close(false)}>{item.label}</NavLink></li>
                ))}
                <li><NavLink to="/faq" onClick={() => close(false)}>Questions</NavLink></li>
                <li><NavLink to="/downloads" onClick={() => close(false)}>Downloads</NavLink></li>
              </ul>
            </nav>
            <div className="ds-drawer__foot">
              {user ? (
                <Link to={dashHref(user)} className="ds-btn ds-btn--primary ds-btn--block" onClick={() => close(false)}>Open your portal</Link>
              ) : (
                <>
                  <Link to="/register" className="ds-btn ds-btn--primary ds-btn--block" onClick={() => close(false)}>Apply online</Link>
                  <Link to="/login" className="ds-btn ds-btn--ghost ds-btn--block" onClick={() => close(false)}>Sign in</Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SiteHeader;

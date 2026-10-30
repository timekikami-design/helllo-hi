import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import Icon from './Icon';
import '../../styles/ds/site.css';
import '../../styles/ds/site-nav.css';
import { NAV, LOGIN_LINKS, APPLY_TO } from './navConfig';

const dashHref = (user) => {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'director_admissions' || user.role === 'admin') return '/admin';
  if (user.role === 'coordinator') return '/coordinator';
  return '/dashboard';
};

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CLOSE_DELAY = 140;

/** Moves focus to <main id="main"> (or the first region after the header). */
const skipToMain = (e) => {
  const target = document.getElementById('main') || document.querySelector('.ds-site-header ~ *');
  if (!target) return;
  e.preventDefault();
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus();
  target.scrollIntoView({ block: 'start' });
};

/* ---------------- Desktop dropdown ---------------- */
const Dropdown = ({ menu, open, onOpen, onClose, onToggle, align = 'left' }) => {
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const timer = useRef(null);
  const panelId = `nav-panel-${menu.id}`;

  // Hover opens the menu. A click that follows a hover must NOT toggle it
  // closed again (that made "Login" look like it did nothing).
  const hoverOpened = useRef(false);
  const enter = () => {
    clearTimeout(timer.current);
    if (!open) hoverOpened.current = true;
    onOpen();
  };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { hoverOpened.current = false; onClose(); }, CLOSE_DELAY); };
  const click = () => {
    if (open && hoverOpened.current) { hoverOpened.current = false; return; }
    hoverOpened.current = false;
    onToggle();
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const items = () => [...(panelRef.current?.querySelectorAll('a') || [])];

  const onBtnKey = (e) => {
    if (e.key === 'ArrowDown' || ((e.key === 'Enter' || e.key === ' ') && !open)) {
      e.preventDefault();
      onOpen();
      requestAnimationFrame(() => items()[0]?.focus());
    } else if (e.key === 'Escape' && open) {
      e.preventDefault(); onClose(); btnRef.current?.focus();
    }
  };
  const onPanelKey = (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); btnRef.current?.focus(); }
  };
  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onClose();
  };

  return (
    <li className={`ds-mega${open ? ' is-open' : ''}`} onMouseEnter={enter} onMouseLeave={leave} onBlur={onBlur}>
      <button
        ref={btnRef}
        type="button"
        className="ds-site-nav__link ds-mega__btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={panelId}
        onClick={click}
        onKeyDown={onBtnKey}
      >
        {menu.label}
        <Icon name="chevronDown" size={14} className="ds-mega__caret" />
      </button>
      <div id={panelId} ref={panelRef} className={`ds-mega__panel ds-mega__panel--${align}`} hidden={!open} onKeyDown={onPanelKey}>
        <ul>
          {menu.items.map((it) => (
            <li key={it.to}>
              <Link to={it.to} className="ds-mega__item" onClick={onClose}>
                <span className="ds-mega__ic"><Icon name={it.icon} size={18} /></span>
                <span className="ds-mega__txt"><strong>{it.label}</strong>{it.desc && <small>{it.desc}</small>}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
};

/* ---------------- Header ---------------- */
const SiteHeader = ({ overlay = false }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [acc, setAcc] = useState(null);
  const triggerRef = useRef(null);
  const drawerRef = useRef(null);
  const navRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close everything on route change.
  useEffect(() => { setOpenMenu(null); setDrawer(false); setAcc(null); }, [location.pathname, location.hash]);

  // Close desktop dropdowns on outside click.
  useEffect(() => {
    if (!openMenu) return undefined;
    const onDown = (e) => { if (!navRef.current?.contains(e.target)) setOpenMenu(null); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openMenu]);

  const closeDrawer = useCallback((returnFocus = true) => {
    setDrawer(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // Drawer: focus trap, Escape, body scroll lock.
  useEffect(() => {
    if (!drawer) return undefined;
    const el = drawerRef.current;
    el?.querySelector(FOCUSABLE)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
      if (e.key !== 'Tab' || !el) return;
      const list = [...el.querySelectorAll(FOCUSABLE)];
      if (!list.length) return;
      const first = list[0]; const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    const onResize = () => { if (window.innerWidth > 1180) setDrawer(false); };
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [drawer, closeDrawer]);

  const loginMenu = { id: 'login', label: user ? 'Portal' : 'Login', items: user
    ? [{ label: 'Open your portal', to: dashHref(user), desc: 'Continue where you left off', icon: 'arrowRight' }, LOGIN_LINKS[1]]
    : LOGIN_LINKS };
  const transparent = overlay && !scrolled && !drawer;
  const dd = (m) => ({
    open: openMenu === m.id,
    onOpen: () => setOpenMenu(m.id),
    onClose: () => setOpenMenu((cur) => (cur === m.id ? null : cur)),
    onToggle: () => setOpenMenu((cur) => (cur === m.id ? null : m.id)),
  });

  return (
    <>
      <a className="ds-skip" href="#main" onClick={skipToMain}>Skip to main content</a>
      <header className={`ds-site-header${scrolled ? ' is-scrolled' : ''}${overlay ? ' is-overlay' : ''}${transparent ? ' is-transparent' : ''}`}>
        <div className="ds-container ds-site-header__row">
          <Link to="/" className="ds-brand" aria-label="Abbottabad University of Science and Technology, home">
            <img src="/assets/aust-logo.png" alt="" width="40" height="42" decoding="async" />
            <span className="ds-brand__text">
              <span className="ds-brand__name"><span className="ds-brand__long">Abbottabad University</span><span className="ds-brand__short" aria-hidden="true">AUST</span></span>
              <span className="ds-brand__sub">of Science &amp; Technology · Open &amp; Distance Learning</span>
            </span>
          </Link>

          <nav className="ds-site-nav" aria-label="Primary" ref={navRef}>
            <ul>
              {NAV.map((m) => (m.items
                ? <Dropdown key={m.id} menu={m} {...dd(m)} />
                : (
                  <li key={m.to}>
                    <NavLink to={m.to} end={m.to === '/'} className={({ isActive }) => `ds-site-nav__link${isActive ? ' is-active' : ''}`}>{m.label}</NavLink>
                  </li>
                )))}
            </ul>
          </nav>

          <div className="ds-site-header__actions">
            <ul className="ds-site-header__login">
              <Dropdown menu={loginMenu} align="right" {...dd(loginMenu)} />
            </ul>
            <Link to={user ? dashHref(user) : APPLY_TO} className="ds-btn ds-btn--primary ds-site-header__cta">
              {user ? 'My portal' : 'Apply Now'}
            </Link>
            <button
              ref={triggerRef}
              type="button"
              className="ds-menu-btn"
              aria-expanded={drawer}
              aria-controls="ds-mobile-nav"
              onClick={() => (drawer ? closeDrawer() : setDrawer(true))}
            >
              <Icon name={drawer ? 'close' : 'menu'} size={22} />
              <span className="ds-sr-only">{drawer ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {drawer && (
        <>
          <div className="ds-drawer-scrim" onClick={() => closeDrawer()} aria-hidden="true" />
          <div id="ds-mobile-nav" ref={drawerRef} className="ds-drawer" role="dialog" aria-modal="true" aria-label="Site menu">
            <div className="ds-drawer__head">
              <span className="ds-eyebrow" style={{ margin: 0 }}>Menu</span>
              <button type="button" className="ds-menu-btn ds-menu-btn--plain" onClick={() => closeDrawer()}>
                <Icon name="close" size={22} /><span className="ds-sr-only">Close menu</span>
              </button>
            </div>
            <nav aria-label="Mobile">
              <ul className="ds-drawer__list">
                {[...NAV, loginMenu].map((m) => (m.items ? (
                  <li key={m.id} className={`ds-acc${acc === m.id ? ' is-open' : ''}`}>
                    <button type="button" className="ds-acc__btn" aria-expanded={acc === m.id} aria-controls={`acc-${m.id}`}
                      onClick={() => setAcc((cur) => (cur === m.id ? null : m.id))}>
                      {m.label}<Icon name="chevronDown" size={18} />
                    </button>
                    <ul id={`acc-${m.id}`} className="ds-acc__panel" hidden={acc !== m.id}>
                      {m.items.map((it) => (
                        <li key={it.to}><Link to={it.to} onClick={() => closeDrawer(false)}>{it.label}{it.desc && <small>{it.desc}</small>}</Link></li>
                      ))}
                    </ul>
                  </li>
                ) : (
                  <li key={m.to}><NavLink to={m.to} end={m.to === '/'} className="ds-acc__link" onClick={() => closeDrawer(false)}>{m.label}</NavLink></li>
                )))}
              </ul>
            </nav>
            <div className="ds-drawer__foot">
              <Link to={user ? dashHref(user) : APPLY_TO} className="ds-btn ds-btn--primary ds-btn--block" onClick={() => closeDrawer(false)}>
                {user ? 'Open your portal' : 'Apply Now'}
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default SiteHeader;

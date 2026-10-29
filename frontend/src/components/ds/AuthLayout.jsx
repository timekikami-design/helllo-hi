import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import '../../styles/ds/auth2.css';

/**
 * Shared shell for sign-in, registration and password recovery.
 * Presentation only: pages keep their own state, validation and API calls.
 */
const AuthLayout = ({ title, eyebrow, heading, text, facts, wide = false, children }) => {
  useEffect(() => {
    if (title) document.title = `${title} · AUST Admissions`;
    // Applicant/staff auth screens are not useful in search results.
    let meta = document.querySelector('meta[name="robots"]');
    const created = !meta;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    const prev = meta.content;
    meta.content = 'noindex';
    return () => { if (created) meta.remove(); else meta.content = prev; };
  }, [title]);

  return (
    <div className="auth2">
      <a className="ds-skip" href="#main">Skip to content</a>
      <aside className="auth2__visual" aria-hidden="true">
        <picture>
          <source type="image/webp" srcSet="/assets/campus-tall-560.webp 560w, /assets/campus-hero-1024.webp 1024w" sizes="45vw" />
          <img src="/assets/campus-hero-1024.jpg" alt="" width="1024" height="560" decoding="async" fetchpriority="high" />
        </picture>
        <div className="auth2__caption">
          {eyebrow && <p className="ds-eyebrow">{eyebrow}</p>}
          {heading && <h2>{heading}</h2>}
          {text && <p>{text}</p>}
          {facts && facts.length > 0 && (
            <ul className="auth2__facts">
              {facts.map((f) => <li key={f.label}><strong>{f.value}</strong>{f.label}</li>)}
            </ul>
          )}
        </div>
      </aside>

      <main id="main" className="auth2__main" tabIndex={-1}>
        <header className="auth2__top">
          <Link to="/" className="auth2__brand">
            <img src="/assets/aust-logo.png" alt="" width="36" height="38" decoding="async" />
            <span>Abbottabad University<small>Admissions portal</small></span>
          </Link>
          <Link to="/" className="auth2__back"><Icon name="arrowLeft" size={16} /> Main site</Link>
        </header>

        <div className="auth2__body">
          <div className={`auth2__inner${wide ? ' auth2__inner--wide' : ''}`}>{children}</div>
        </div>

        <footer className="auth2__foot">
          <span>© {new Date().getFullYear()} Abbottabad University of Science &amp; Technology</span>
          <nav aria-label="Legal">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/contact">Help</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
};

/** Password input with an accessible show/hide toggle (keyboard reachable). */
export const PasswordInput = ({ id, value, onChange, show, onToggle, describedBy, invalid, ...rest }) => (
  <div className="auth2__pw">
    <input
      id={id}
      type={show ? 'text' : 'password'}
      className="ds-input"
      value={value}
      onChange={onChange}
      aria-describedby={describedBy}
      aria-invalid={invalid ? 'true' : undefined}
      {...rest}
    />
    <button type="button" className="auth2__pw-toggle" onClick={onToggle} aria-pressed={show} aria-controls={id}>
      <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      <span className="ds-sr-only">{show ? 'Hide password' : 'Show password'}</span>
    </button>
  </div>
);

/** Inline alert announced to assistive tech. */
export const AuthAlert = ({ type, children }) => {
  if (!children) return null;
  const icon = type === 'success' ? 'check' : type === 'info' ? 'info' : 'alert';
  return (
    <div className={`ds-alert ds-alert--${type}`} role={type === 'error' ? 'alert' : 'status'} aria-live={type === 'error' ? 'assertive' : 'polite'}>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  );
};

export default AuthLayout;

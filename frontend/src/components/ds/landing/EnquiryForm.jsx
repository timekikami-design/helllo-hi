import React, { useRef, useState } from 'react';
import { CONTACT } from '../../../data/siteFacts';
import Icon from '../Icon';

const EMPTY = { name: '', email: '', phone: '', program: '', message: '' };
const ORDER = ['name', 'email', 'phone', 'message'];

/**
 * Enquiry form. No enquiry API exists, so (exactly like the existing Contact
 * page) it composes an email in the visitor's mail app. Nothing is stored,
 * sent to a server or logged.
 */
const EnquiryForm = ({ programs = [] }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | sent
  const refs = { name: useRef(null), email: useRef(null), phone: useRef(null), message: useRef(null) };
  const busy = status === 'submitting';

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
    if (status === 'sent') setStatus('idle');
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Please tell us your name.';
    if (!form.email.trim()) next.email = 'We need an email address to reply to you.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'This email address looks incomplete. Check for a missing @ or domain.';
    if (form.phone && !/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) next.phone = 'Use digits only, for example 0300 1234567.';
    if (form.message.trim().length < 10) next.message = 'Please write a little more so we can help (at least 10 characters).';
    return next;
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (busy) return;
    const next = validate();
    setErrors(next);
    const firstBad = ORDER.find((k) => next[k]);
    if (firstBad) { refs[firstBad].current?.focus(); return; }
    setStatus('submitting');
    const body = [
      `Name: ${form.name}`, `Email: ${form.email}`,
      form.phone ? `Phone: ${form.phone}` : null,
      form.program ? `Program of interest: ${form.program}` : null,
      '', form.message,
    ].filter((l) => l !== null).join('\n');
    window.location.href = `mailto:${CONTACT.email}?subject=${encodeURIComponent('Admissions enquiry')}&body=${encodeURIComponent(body)}`;
    setTimeout(() => { setStatus('sent'); setForm(EMPTY); }, 400);
  };

  const describedBy = (k, help) => [help && `enq-${k}-help`, errors[k] && `enq-${k}-err`].filter(Boolean).join(' ') || undefined;

  const input = (k, label, props, required, help) => (
    <div className="ds-field">
      <label className="ds-label" htmlFor={`enq-${k}`}>
        {label}<span className="ds-req">{required ? '(required)' : '(optional)'}</span>
      </label>
      <input
        ref={refs[k]} id={`enq-${k}`} name={k} className="ds-input"
        value={form[k]} onChange={set(k)} disabled={busy} required={required}
        aria-invalid={errors[k] ? 'true' : undefined}
        aria-describedby={describedBy(k, help)}
        {...props}
      />
      {help && <p className="ds-help" id={`enq-${k}-help`}>{help}</p>}
      {errors[k] && <p className="ds-error" id={`enq-${k}-err`}><Icon name="alert" size={14} />{errors[k]}</p>}
    </div>
  );

  return (
    <form className="lp-form" onSubmit={onSubmit} noValidate aria-labelledby="enquiry-title">
      <div className="lp-form__row">
        {input('name', 'Full name', { type: 'text', autoComplete: 'name' }, true)}
        {input('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email' }, true)}
      </div>
      <div className="lp-form__row">
        {input('phone', 'Phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel' }, false, 'We only call if email is not enough.')}
        <div className="ds-field">
          <label className="ds-label" htmlFor="enq-program">Program of interest<span className="ds-req">(optional)</span></label>
          <select id="enq-program" name="program" className="ds-select" value={form.program} onChange={set('program')} disabled={busy}>
            <option value="">Not sure yet</option>
            {programs.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="ds-field">
        <label className="ds-label" htmlFor="enq-message">Your question<span className="ds-req">(required)</span></label>
        <textarea
          ref={refs.message} id="enq-message" name="message" className="ds-textarea"
          value={form.message} onChange={set('message')} disabled={busy} required
          aria-invalid={errors.message ? 'true' : undefined}
          aria-describedby={errors.message ? 'enq-message-err' : undefined}
        />
        {errors.message && <p className="ds-error" id="enq-message-err"><Icon name="alert" size={14} />{errors.message}</p>}
      </div>
      <div className="lp-form__foot">
        <button type="submit" className="ds-btn ds-btn--primary" disabled={busy}>
          {busy ? <><span className="ds-spinner" aria-hidden="true" /> Opening your email app…</> : 'Send enquiry'}
        </button>
        <span className="ds-help">Opens your email app with the message ready to send to {CONTACT.email}.</span>
      </div>
      <div role="status" aria-live="polite">
        {status === 'sent' && (
          <div className="ds-alert ds-alert--success">
            <Icon name="check" size={18} />
            <span>
              Your message is ready in your email app. Press send there and the admissions office will reply.
              If nothing opened, write to <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
            </span>
          </div>
        )}
      </div>
    </form>
  );
};

export default EnquiryForm;

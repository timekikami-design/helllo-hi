import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { CONTACT } from '../../data/siteFacts';
import AuthLayout, { AuthAlert } from '../../components/ds/AuthLayout';

// Presentation redesign of pages/ForgotPassword.jsx — same request.
const ForgotPasswordV2 = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setMessage('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.message || 'If an account uses this email, a reset link is on its way. Check your inbox and spam folder.');
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.error || 'We couldn\u2019t send the reset link just now. Please try again in a few minutes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      eyebrow="Account recovery"
      heading="Locked out? It happens."
      text="We'll email a one-time link that lets you choose a new password. The link expires after 15 minutes."
    >
      <h1 className="auth2__title">Reset your password</h1>
      <p className="auth2__lede">Enter the email you registered with and we'll send a reset link.</p>

      <div style={{ display: 'grid', gap: 'var(--s-3)', marginBottom: error || message ? 'var(--s-4)' : 0 }}>
        <AuthAlert type="error">{error}</AuthAlert>
        <AuthAlert type="success">{message}</AuthAlert>
      </div>

      <form className="auth2__form" onSubmit={handleSubmit} noValidate>
        <div className="ds-field">
          <label className="ds-label" htmlFor="fp-email">Registered email</label>
          <input
            id="fp-email" type="email" className="ds-input" name="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required disabled={loading} aria-describedby="fp-email-help"
          />
          <p id="fp-email-help" className="ds-help">The link works once and expires after 15 minutes.</p>
        </div>
        <button type="submit" className="ds-btn ds-btn--brand ds-btn--block" disabled={loading || !email}>
          {loading ? <><span className="ds-spinner" aria-hidden="true" /> Sending link…</> : 'Send reset link'}
        </button>
      </form>

      <p className="auth2__alt">
        Remembered it? <Link to="/login" className="ds-link">Back to sign in</Link>
        <br />No email after 10 minutes? Write to <a className="ds-link" href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
      </p>
    </AuthLayout>
  );
};

export default ForgotPasswordV2;

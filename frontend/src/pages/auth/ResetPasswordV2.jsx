import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import AuthLayout, { PasswordInput, AuthAlert } from '../../components/ds/AuthLayout';
import Icon from '../../components/ds/Icon';

// Presentation redesign of pages/ResetPassword.jsx — same token flow and request.
const ResetPasswordV2 = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const emailFromUrl = params.get('email') || '';

  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !emailFromUrl) {
      setError('This reset link is incomplete or has expired. Request a new one and use the latest email.');
    }
  }, [token, emailFromUrl]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setMessage('');
    if (password !== confirmPassword) return setError('The two passwords don\u2019t match.');
    if (password.length < 6) return setError('Your new password needs at least 6 characters.');
    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { email, token, password });
      setMessage(res.data.message || 'Password updated. Taking you to sign in…');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'We couldn\u2019t update your password. The link may have expired; request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <AuthLayout
      title="Choose a new password"
      eyebrow="Account recovery"
      heading="Choose something you'll remember."
      text="Once it's saved, every other session on your account is asked to sign in again."
    >
      <h1 className="auth2__title">Choose a new password</h1>
      <p className="auth2__lede">Use at least 6 characters. A mix of letters, numbers and a symbol is stronger.</p>

      <div style={{ display: 'grid', gap: 'var(--s-3)', marginBottom: error || message ? 'var(--s-4)' : 0 }}>
        <AuthAlert type="error">{error}</AuthAlert>
        <AuthAlert type="success">{message}</AuthAlert>
      </div>

      <form className="auth2__form" onSubmit={handleSubmit} noValidate>
        <div className="ds-field">
          <label className="ds-label" htmlFor="rp-email">Email</label>
          <input
            id="rp-email" type="email" className="ds-input" name="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required readOnly={!!emailFromUrl} disabled={loading}
          />
        </div>
        <div className="ds-field">
          <label className="ds-label" htmlFor="rp-pw">New password</label>
          <PasswordInput
            id="rp-pw" name="password" value={password} onChange={(e) => setPassword(e.target.value)}
            show={showPw} onToggle={() => setShowPw((v) => !v)}
            autoComplete="new-password" required disabled={loading || !token}
          />
        </div>
        <div className="ds-field">
          <label className="ds-label" htmlFor="rp-cpw">Confirm new password</label>
          <PasswordInput
            id="rp-cpw" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            show={showCpw} onToggle={() => setShowCpw((v) => !v)}
            autoComplete="new-password" required disabled={loading || !token}
            describedBy={mismatch ? 'rp-cpw-err' : undefined} invalid={mismatch}
          />
          {mismatch && <p id="rp-cpw-err" className="ds-error"><Icon name="alert" size={14} />Passwords don't match yet.</p>}
        </div>
        <button type="submit" className="ds-btn ds-btn--brand ds-btn--block" disabled={loading || !token}>
          {loading ? <><span className="ds-spinner" aria-hidden="true" /> Saving…</> : 'Save new password'}
        </button>
      </form>

      <p className="auth2__alt">
        <Link to="/login" className="ds-link">Back to sign in</Link>
        {!token && <> · <Link to="/forgot-password" className="ds-link">Request a new link</Link></>}
      </p>
    </AuthLayout>
  );
};

export default ResetPasswordV2;

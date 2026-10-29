import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import api from '../../utils/api';
import AuthCaptcha from '../../components/AuthCaptcha';
import AuthLayout, { PasswordInput, AuthAlert } from '../../components/ds/AuthLayout';
import Icon from '../../components/ds/Icon';

// Presentation redesign of pages/Register.jsx. Validation rules, username
// availability check, captcha and the register() payload are unchanged.
const RegisterV2 = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [captcha, setCaptcha] = useState({ captchaId: '', captchaAnswer: '' });
  const captchaRef = useRef(null);
  const onCaptchaChange = useCallback((next) => setCaptcha(next), []);

  const passwordsMatch = useMemo(() => password.length > 0 && password === confirmPassword, [password, confirmPassword]);
  const passwordValid = password.length >= 6;
  const usernameValid = /^[a-zA-Z0-9_.-]{3,30}$/.test(username);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const captchaFilled = !!captcha.captchaId && String(captcha.captchaAnswer).trim().length > 0;
  const formReady = agreeTerms && usernameValid && emailValid && passwordValid && passwordsMatch && captchaFilled && (usernameAvailable !== false);

  useEffect(() => {
    if (!usernameValid) { setUsernameAvailable(null); setUsernameMsg(''); return undefined; }
    setUsernameMsg('Checking availability…');
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
        setUsernameAvailable(!!res.data.available);
        setUsernameMsg(res.data.available ? 'This username is available.' : 'This username is already taken. Try another.');
      } catch {
        setUsernameAvailable(null); setUsernameMsg('');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, usernameValid]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setSuccess('');
    if (!usernameValid) return setError('Usernames are 3 to 30 characters: letters, numbers, underscore, dot or hyphen.');
    if (!emailValid) return setError('Enter a complete email address, for example name@example.com.');
    if (!passwordValid) return setError('Your password needs at least 6 characters.');
    if (!passwordsMatch) return setError('The two passwords don\u2019t match.');
    if (!agreeTerms) return setError('Please accept the Terms and Privacy Policy to continue.');
    if (!captcha.captchaId) {
      captchaRef.current?.refresh();
      return setError('The security check didn\u2019t load. We\u2019ve issued a new question; please answer it.');
    }
    if (!String(captcha.captchaAnswer).trim()) return setError('Please answer the security check to continue.');

    setLoading(true);
    try {
      await register({ username, email, password, confirmPassword, acceptTerms: true, acceptPrivacy: true, captcha });
      setSuccess('Your account is ready. Opening your applicant portal…');
      setTimeout(() => navigate('/dashboard'), 400);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'We couldn\u2019t create your account. Please try again.');
      setCaptcha({ captchaId: '', captchaAnswer: '' });
      captchaRef.current?.refresh();
    } finally {
      setLoading(false);
    }
  };

  const unameState = usernameAvailable === false ? 'err' : usernameAvailable === true ? 'ok' : '';

  return (
    <AuthLayout
      title="Create your account"
      wide
      eyebrow="Apply online"
      heading="Start your application in a few minutes."
      text="Create an account, complete your profile and education record, upload documents, and follow every decision from your portal."
      facts={[{ value: '4 steps', label: 'Register, apply, upload, confirm' }, { value: '4 semesters', label: 'Associate Degree in Computer Science' }]}
    >
      <h1 className="auth2__title">Create your account</h1>
      <p className="auth2__lede">You'll use this account for your whole application, from submission to enrollment.</p>

      <div style={{ display: 'grid', gap: 'var(--s-3)', marginBottom: error || success ? 'var(--s-4)' : 0 }}>
        <AuthAlert type="error">{error}</AuthAlert>
        <AuthAlert type="success">{success}</AuthAlert>
      </div>

      <form className="auth2__form" onSubmit={handleSubmit} autoComplete="off" noValidate>
        <div className="ds-field">
          <label className="ds-label" htmlFor="reg-username">Username<span className="ds-req">(required)</span></label>
          <input
            id="reg-username" type="text" className="ds-input" name="username"
            value={username} onChange={(e) => setUsername(e.target.value.trim())}
            autoComplete="username" autoCapitalize="none" spellCheck="false"
            required minLength={3} maxLength={30} disabled={loading}
            aria-describedby="reg-username-help"
            aria-invalid={unameState === 'err' || (username.length > 0 && !usernameValid) ? 'true' : undefined}
          />
          <p id="reg-username-help" className={unameState === 'err' ? 'ds-error' : unameState === 'ok' ? 'ds-ok' : 'ds-help'} aria-live="polite">
            {unameState === 'err' && <Icon name="alert" size={14} />}
            {unameState === 'ok' && <Icon name="check" size={14} />}
            {username.length > 0 && !usernameValid ? '3 to 30 characters: letters, numbers, _, . or -' : (usernameMsg || '3 to 30 characters: letters, numbers, _, . or -')}
          </p>
        </div>

        <div className="ds-field">
          <label className="ds-label" htmlFor="reg-email">Email<span className="ds-req">(required)</span></label>
          <input
            id="reg-email" type="email" className="ds-input" name="email" inputMode="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            autoComplete="email" required disabled={loading}
            aria-describedby="reg-email-help"
          />
          <p id="reg-email-help" className="ds-help">Decisions and interview dates are sent here.</p>
        </div>

        <div className="auth2__row">
          <div className="ds-field">
            <label className="ds-label" htmlFor="reg-pw">Password<span className="ds-req">(required)</span></label>
            <PasswordInput
              id="reg-pw" name="password" value={password} onChange={(e) => setPassword(e.target.value)}
              show={showPw} onToggle={() => setShowPw((v) => !v)}
              autoComplete="new-password" required disabled={loading} describedBy="reg-pw-help"
            />
            <p id="reg-pw-help" className="ds-help">At least 6 characters.</p>
          </div>
          <div className="ds-field">
            <label className="ds-label" htmlFor="reg-cpw">Confirm password<span className="ds-req">(required)</span></label>
            <PasswordInput
              id="reg-cpw" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              show={showCpw} onToggle={() => setShowCpw((v) => !v)}
              autoComplete="new-password" required disabled={loading}
              describedBy={confirmPassword ? 'reg-cpw-msg' : undefined}
              invalid={confirmPassword.length > 0 && !passwordsMatch}
            />
            {confirmPassword.length > 0 && (
              <p id="reg-cpw-msg" className={passwordsMatch ? 'ds-ok' : 'ds-error'} aria-live="polite">
                <Icon name={passwordsMatch ? 'check' : 'alert'} size={14} />
                {passwordsMatch ? 'Passwords match.' : 'Passwords don\u2019t match yet.'}
              </p>
            )}
          </div>
        </div>

        <AuthCaptcha ref={captchaRef} value={captcha} onChange={onCaptchaChange} disabled={loading} />

        <label className="auth2__check">
          <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} disabled={loading} />
          <span>
            I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link> and
            the <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
          </span>
        </label>

        <button type="submit" className="ds-btn ds-btn--primary ds-btn--block" disabled={loading || !formReady} aria-describedby={!formReady ? 'reg-ready-hint' : undefined}>
          {loading ? <><span className="ds-spinner" aria-hidden="true" /> Creating your account…</> : 'Create account'}
        </button>
        {!formReady && !loading && <p id="reg-ready-hint" className="ds-help" style={{ textAlign: 'center' }}>Complete every field and accept the terms to continue.</p>}
      </form>

      <p className="auth2__alt">Already registered? <Link to="/login" className="ds-link">Sign in</Link></p>
    </AuthLayout>
  );
};

export default RegisterV2;

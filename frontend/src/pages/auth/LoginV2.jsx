import React, { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import AuthCaptcha from '../../components/AuthCaptcha';
import api from '../../utils/api';
import { LMS_FRONTEND_URL } from '../../utils/lmsConfig';
import AuthLayout, { PasswordInput, AuthAlert } from '../../components/ds/AuthLayout';

// Presentation redesign of pages/Login.jsx. Authentication flow, captcha,
// role routing and the LMS fallback are copied unchanged.
const LoginV2 = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState({ captchaId: '', captchaAnswer: '' });
  const captchaRef = useRef(null);
  const onCaptchaChange = useCallback((next) => setCaptcha(next), []);

  const tryLmsLogin = async (username, pw) => {
    try {
      const res = await api.post('/lms/auth/login', { username, password: pw });
      const data = res.data || {};
      if (data.requiresPasswordChange && data.tempToken) {
        sessionStorage.setItem('lms_temp_token', data.tempToken);
        setSuccess('LMS account found. Taking you to set a new password…');
        setTimeout(() => { window.location.href = `${LMS_FRONTEND_URL}/force-change-password`; }, 400);
        return true;
      }
      if (data.token) {
        localStorage.setItem('lms_token', data.token);
        localStorage.setItem('lms_role', data.role);
        setSuccess('Signed in. Opening the learning portal…');
        setTimeout(() => { window.location.href = `${LMS_FRONTEND_URL}/`; }, 400);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(''); setSuccess('');
    if (!identifier.trim() || !password) {
      return setError('Enter your username or registered email, and your password.');
    }
    if (!captcha.captchaId) {
      captchaRef.current?.refresh();
      return setError('The security check didn\u2019t load. We\u2019ve issued a new question; please answer it.');
    }
    if (!String(captcha.captchaAnswer).trim()) {
      return setError('Please answer the security check to continue.');
    }
    setLoading(true);
    try {
      const user = await login(identifier.trim(), password, captcha);
      setSuccess('Signed in. Opening your portal…');
      setTimeout(() => {
        const ROLE_DASHBOARD = {
          super_admin: '/super-admin',
          director_admissions: '/admin',
          admin: '/admin',
          coordinator: '/coordinator',
          lms_admin: '/lms/admin',
          teacher: '/lms/teacher',
        };
        navigate(ROLE_DASHBOARD[user.role] || '/dashboard');
      }, 350);
    } catch (err) {
      const serverError = err.response?.data?.error || '';
      if (/captcha/i.test(serverError)) {
        setCaptcha({ captchaId: '', captchaAnswer: '' });
        captchaRef.current?.refresh();
        setError(serverError || 'That answer to the security check wasn\u2019t right. Here\u2019s a new question.');
      } else {
        const handledByLms = await tryLmsLogin(identifier.trim(), password);
        if (!handledByLms) {
          setError(serverError || 'The username or password is incorrect. Check both and try again.');
          setCaptcha({ captchaId: '', captchaAnswer: '' });
          captchaRef.current?.refresh();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      eyebrow="Admissions portal"
      heading="Your application, one place."
      text="Applicants, admissions staff and coordinators all sign in here. You'll be taken to the right portal for your role."
      facts={[{ value: 'Havelian', label: 'Abbottabad, Khyber Pakhtunkhwa' }, { value: 'ADCS', label: '2-year associate degree, online' }]}
    >
      <h1 className="auth2__title">Sign in</h1>
      <p className="auth2__lede">Use the username or email you registered with.</p>

      <div style={{ display: 'grid', gap: 'var(--s-3)', marginBottom: error || success ? 'var(--s-4)' : 0 }}>
        <AuthAlert type="error">{error}</AuthAlert>
        <AuthAlert type="success">{success}</AuthAlert>
      </div>

      <form className="auth2__form" onSubmit={handleSubmit} autoComplete="on" noValidate>
        <div className="ds-field">
          <label className="ds-label" htmlFor="login-id">Username or email</label>
          <input
            id="login-id" type="text" className="ds-input" name="username"
            value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username" autoCapitalize="none" spellCheck="false"
            required disabled={loading}
          />
        </div>

        <div className="ds-field">
          <label className="ds-label" htmlFor="login-pw">Password</label>
          <PasswordInput
            id="login-pw" name="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            show={showPw} onToggle={() => setShowPw((v) => !v)}
            autoComplete="current-password" required disabled={loading}
          />
        </div>
        <div className="auth2__between"><Link to="/forgot-password" className="ds-link">Forgot your password?</Link></div>

        <AuthCaptcha ref={captchaRef} value={captcha} onChange={onCaptchaChange} disabled={loading} />

        <button type="submit" className="ds-btn ds-btn--brand ds-btn--block" disabled={loading}>
          {loading ? <><span className="ds-spinner" aria-hidden="true" /> Signing in…</> : 'Sign in'}
        </button>
      </form>

      <p className="auth2__alt">New applicant? <Link to="/register" className="ds-link">Create your account</Link></p>
    </AuthLayout>
  );
};

export default LoginV2;

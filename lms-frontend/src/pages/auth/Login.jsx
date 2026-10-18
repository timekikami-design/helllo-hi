import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RotateCw, ShieldCheck } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";
import { Field, PasswordInput, SubmitButton, inputCls } from "../../components/auth/Field";
import { useAuth, BACKEND_ROLE_TO_FRONTEND } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import authService from "../../services/authService";

/* Frontend role key → dashboard base path. */
const ROLE_BASE = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
  focal_person: "/focal",
  exam_coordinator: "/exam",
  director_qec: "/qec",
  provost: "/provost",
};

/* ------------------------------------------------------------------
 * UNIFIED LOGIN — resolve the Admissions app base URL so a Super Admin
 * signing in through the LMS UI can be handed off to the Admissions-hosted
 * Super Admin command center (/super-admin) on port 3000.
 * ---------------------------------------------------------------- */
function resolveAdmissionsUrl() {
  if (import.meta.env && import.meta.env.VITE_ADMISSIONS_URL) {
    return import.meta.env.VITE_ADMISSIONS_URL;
  }
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (hostname.includes(".sandbox.") && /^\d+-/.test(hostname)) {
      return `${protocol}//${hostname.replace(/^\d+-/, "3000-")}`;
    }
  }
  return "http://localhost:3000";
}

/* ------------------------------------------------------------------
 * AUST ODL — Premium Login Page (frontend-only redesign)
 * ------------------------------------------------------------------
 * • Fixed viewport — 100vh, no page scroll on desktop/laptop/tablet
 * • Perfectly symmetric 50/50 split with balanced spacing
 * • Mobile: stacks the form (image hidden) — still no scroll on
 *   typical mobile heights for the compact form
 * • Preserves all existing logic: useAuth, useToast, routing
 * ----------------------------------------------------------------*/
const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Section 1 — server-generated, single-use LMS login captcha.
  const [captcha, setCaptcha] = useState({ captchaId: "", question: "" });
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(true);
  const [captchaError, setCaptchaError] = useState("");
  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer("");
    try {
      const c = await authService.getCaptcha();
      setCaptcha({ captchaId: c.captchaId, question: c.question });
    } catch (e) {
      setCaptcha({ captchaId: "", question: "" });
      setCaptchaError("Could not load the security check. Click refresh to try again.");
    } finally {
      setCaptchaLoading(false);
    }
  }, []);
  useEffect(() => { refreshCaptcha(); }, [refreshCaptcha]);
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fieldErr, setFieldErr] = useState({});
  const [sessionNote] = useState(() => {
    try { const v = sessionStorage.getItem("aust_session_notice"); sessionStorage.removeItem("aust_session_notice"); return v; } catch (_) { return null; }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErr({ username: username.trim() ? "" : "Username is required", password: password ? "" : "Password is required" });
    if (!username.trim() || !password) {
      toast("Please enter your username and password.", { type: "error" });
      return;
    }
    if (!captcha.captchaId || !captchaAnswer.trim()) {
      setCaptchaError("Please solve the security check to continue.");
      toast("Please solve the security check (captcha) to continue.", { type: "error" });
      if (!captcha.captchaId) refreshCaptcha();
      return;
    }
    setCaptchaError("");
    setLoading(true);
    try {
      const data = await authService.login(username.trim(), password, { captchaId: captcha.captchaId, captchaAnswer: captchaAnswer.trim() });

      // Forced first-login password change.
      if (data && data.requiresPasswordChange) {
        authService.setTempToken(data.tempToken);
        toast("Please set a new password to continue.", { type: "info", title: "Password Change Required" });
        navigate("/force-change-password");
        return;
      }

      // UNIFIED LOGIN — Super Admin handoff. When the same credentials map to
      // the platform's Super Admin, the backend returns an Admissions token.
      // We hand off to the Admissions-hosted Super Admin command center.
      if (data && data.superAdmin && data.adminToken) {
        const base = resolveAdmissionsUrl();
        toast("Opening Super Admin Command Center…", { type: "success", title: "Welcome, Super Admin" });
        const payload = encodeURIComponent(
          JSON.stringify({ token: data.adminToken, user: data.adminUser })
        );
        // Hand off via URL hash; the Admissions app consumes & clears it.
        window.location.href = `${base}/super-admin#sa_session=${payload}`;
        return;
      }

      // Full session — backend determines the authoritative role.
      // Smart role detection: the role comes ONLY from the server response;
      // the user never selects a role on the login screen.
      const frontendRole = BACKEND_ROLE_TO_FRONTEND[data.role] || "student";
      // Await so the REAL DB identity (student name etc.) is hydrated from
      // /api/lms/auth/me BEFORE we navigate — guarantees the sidebar/dashboard
      // render the correct name on first paint (no placeholder flash).
      await login(frontendRole, {
        username: data.username,
        backendRole: data.role,
        mustChangePassword: false,
      });
      toast("Welcome back to AUST ODL", { type: "success", title: "Login Successful" });
      navigate(ROLE_BASE[frontendRole] || `/${frontendRole}`, { replace: true });
    } catch (err) {
      // Surface the backend error message through the existing toast UI.
      toast(err.message || "Invalid credentials.", { type: "error", title: "Login Failed" });
      if (err.data && err.data.code === "CAPTCHA_INVALID") setCaptchaError(err.message);
      // The challenge is single-use (consumed server-side on every attempt) —
      // always issue a fresh one after a failed login.
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthHeading eyebrow="Student & staff portal" title="Sign in">
        Use the username and password issued by the university.
      </AuthHeading>

      {sessionNote && (
        <div role="status" className="mb-6 flex gap-3 rounded border border-line bg-note-soft px-4 py-3 text-[14px] leading-5 text-fg">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-note" aria-hidden="true" />
          <span>{sessionNote === "expired" ? "Your session has expired. Please sign in again to continue." : "You have been signed out."}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-1">
        <Field id="username" label="Username" error={fieldErr.username}>
          {(a) => (
            <input {...a} type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
              value={username}
              onChange={(e) => { setUsername(e.target.value); if (fieldErr.username) setFieldErr((f) => ({ ...f, username: "" })); }}
              onBlur={() => setFieldErr((f) => ({ ...f, username: username.trim() ? "" : f.username }))}
              placeholder="e.g. ADCS-001" className={inputCls()} />
          )}
        </Field>

        <Field id="password" label="Password" error={fieldErr.password}
          right={<Link to="/forgot-password" className="link text-[13px]">Forgot password?</Link>}>
          {(a) => (
            <PasswordInput inputProps={a} autoComplete="current-password" value={password}
              onChange={(e) => { setPassword(e.target.value); if (fieldErr.password) setFieldErr((f) => ({ ...f, password: "" })); }} />
          )}
        </Field>

        {/* Security check (captcha) — server-generated, single use */}
        <div>
          <label htmlFor="captchaAnswer" className="field-label">Security check</label>
          <div className="flex items-stretch gap-2">
            <div data-testid="captcha-question" aria-live="polite"
              className="flex-1 min-w-0 flex items-center min-h-[48px] rounded border border-line bg-surface-muted px-3 text-[15px] font-medium text-fg tabular-nums select-none">
              {captchaLoading ? <span className="skeleton h-4 w-28" aria-label="Loading question" /> : (captcha.question || "Unavailable — refresh")}
            </div>
            <button type="button" onClick={refreshCaptcha} disabled={captchaLoading || loading}
              aria-label="Get a new security question" className="btn-secondary !min-h-[48px] !w-12 !px-0 shrink-0">
              <RotateCw size={16} className={captchaLoading ? "animate-spin" : ""} aria-hidden="true" />
            </button>
            <input id="captchaAnswer" type="text" inputMode="numeric" autoComplete="off"
              value={captchaAnswer}
              onChange={(e) => { setCaptchaAnswer(e.target.value.replace(/[^\d-]/g, "")); setCaptchaError(""); }}
              placeholder="Answer" aria-invalid={!!captchaError} aria-describedby={captchaError ? "captcha-error" : undefined}
              className={`${inputCls()} !w-24 text-center tabular-nums shrink-0`} />
          </div>
          <p id="captcha-error" className="field-error">
            {captchaError && <span role="alert" data-testid="captcha-error">{captchaError}</span>}
          </p>
        </div>

        <label className="flex items-center gap-2.5 pb-4 text-[14px] text-fg-secondary cursor-pointer select-none w-fit">
          <input type="checkbox" defaultChecked />
          Keep me signed in on this device
        </label>

        <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
      </form>

      <p className="mt-8 text-[13px] leading-5 text-fg-muted">
        New to AUST ODL? Your account is created after admission. <Link to="/register" className="link">Learn how to get access</Link>.
      </p>
    </AuthLayout>
  );
};

export default Login;

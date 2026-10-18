import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";
import { Field, PasswordInput, SubmitButton } from "../../components/auth/Field";
import { useToast } from "../../context/ToastContext";
import { useAuth, BACKEND_ROLE_TO_FRONTEND } from "../../context/AuthContext";
import authService from "../../services/authService";

/* =========================================================================
 * ForceChangePassword (Section 5.6)
 * --------------------------------------------------------------------------
 * The forced first-login password change. Reads the temp token from
 * sessionStorage, validates the new password client-side, then calls
 * authService.changePassword(tempToken, newPassword). On success the full
 * session token + role are stored and the user is routed to their dashboard.
 *
 * Errors are surfaced through the existing toast mechanism + an inline
 * error area on this page (no new global UI components).
 * ======================================================================= */
const ROLE_BASE = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
  focal_person: "/focal",
  exam_coordinator: "/exam",
  director_qec: "/qec",
  provost: "/provost",
};

// Mirror of the server-side password policy.
const POLICY = {
  length: (s) => s.length >= 8,
  upper: (s) => /[A-Z]/.test(s),
  number: (s) => /\d/.test(s),
  special: (s) => /[^A-Za-z0-9]/.test(s),
};

function validatePassword(pw) {
  if (!POLICY.length(pw)) return "Password must be at least 8 characters.";
  if (!POLICY.upper(pw)) return "Password must include at least one uppercase letter.";
  if (!POLICY.number(pw)) return "Password must include at least one number.";
  if (!POLICY.special(pw)) return "Password must include at least one special character.";
  return null;
}

const ForceChangePassword = () => {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const tempToken = authService.getTempToken();
    if (!tempToken) {
      setError("Your session has expired. Please log in again.");
      toast("Session expired — please log in again.", { type: "error" });
      setTimeout(() => navigate("/login"), 1200);
      return;
    }

    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const policyError = validatePassword(pw);
    if (policyError) {
      setError(policyError);
      return;
    }

    setLoading(true);
    try {
      const data = await authService.changePassword(tempToken, pw);
      authService.clearTempToken();
      const frontendRole = BACKEND_ROLE_TO_FRONTEND[data.role] || "student";
      // Establish the session in the auth context (mustChangePassword now false).
      // Await so the real DB identity is hydrated before navigating.
      await login(frontendRole, {
        username: data.username,
        backendRole: data.role,
        mustChangePassword: false,
      });
      toast("Password updated successfully.", { type: "success", title: "Welcome to AUST LMS" });
      navigate(ROLE_BASE[frontendRole] || "/login", { replace: true });
    } catch (err) {
      setError(err.message || "Failed to change password.");
      toast(err.message || "Failed to change password.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const checks = [
    { ok: POLICY.length(pw), label: "At least 8 characters" },
    { ok: POLICY.upper(pw), label: "One uppercase letter" },
    { ok: POLICY.number(pw), label: "One number" },
    { ok: POLICY.special(pw), label: "One special character" },
  ];

  const rules = [
    ["At least 8 characters", POLICY.length(pw)],
    ["One uppercase letter", POLICY.upper(pw)],
    ["One number", POLICY.number(pw)],
    ["One special character", POLICY.special(pw)],
  ];
  const mismatch = confirm.length > 0 && pw !== confirm;

  return (
    <AuthLayout statement="One last step before you begin.">
      <AuthHeading eyebrow="First sign-in" title="Choose your password">
        For your security, replace the temporary password issued by the university.
      </AuthHeading>

      {error && (
        <div role="alert" className="mb-6 flex gap-3 rounded border border-[rgb(var(--error)/0.35)] bg-bad-soft px-4 py-3 text-[14px] leading-5 text-bad">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-1">
        <Field id="new-password" label="New password" reserve={false} hint={null}>
          {(a) => <PasswordInput inputProps={a} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
        </Field>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 pb-4" aria-label="Password requirements">
          {rules.map(([label, ok]) => (
            <li key={label} className={`flex items-center gap-1.5 text-[13px] leading-5 ${ok ? "text-ok" : "text-fg-muted"}`}>
              {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
              <span>{label}<span className="sr-only">{ok ? " — met" : " — not met"}</span></span>
            </li>
          ))}
        </ul>
        <Field id="confirm-password" label="Confirm new password" error={mismatch ? "Passwords do not match" : ""}>
          {(a) => <PasswordInput inputProps={a} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        <div className="pt-3">
          <SubmitButton loading={loading} loadingText="Saving password…">Save password and continue</SubmitButton>
        </div>
      </form>
    </AuthLayout>
  );
};

export default ForceChangePassword;

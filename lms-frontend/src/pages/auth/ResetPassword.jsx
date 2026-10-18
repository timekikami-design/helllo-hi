// lms-frontend/src/pages/auth/ResetPassword.jsx
// There is no reset-token endpoint in the LMS, so this route cannot
// change a password and must never claim success. Signed-in users change
// their password in Settings; first-login changes use /force-change-password.
import { Link } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";

const ResetPassword = () => (
  <AuthLayout>
    <AuthHeading eyebrow="Account recovery" title="Set a new password">
      Password resets are completed by the ODL office. After they issue a temporary password, sign in and you’ll be asked to choose a new one.
    </AuthHeading>
    <div className="flex gap-3 rounded border border-line bg-surface px-4 py-3 text-[14px] leading-5 text-fg-secondary">
      <KeyRound size={16} className="mt-0.5 shrink-0 text-fg-muted" aria-hidden="true" />
      Already signed in? Change your password from <span className="font-medium text-fg">Settings → Security</span>.
    </div>
    <div className="mt-8 grid gap-2">
      <Link to="/login" className="btn-primary btn-lg w-full">Go to sign in</Link>
      <Link to="/forgot-password" className="btn-ghost btn-lg w-full"><ArrowLeft size={16} aria-hidden="true" /> How resets work</Link>
    </div>
  </AuthLayout>
);

export default ResetPassword;

// lms-frontend/src/pages/auth/ForgotPassword.jsx
// The LMS has no self-service reset endpoint (accounts and passwords are
// issued by the university). Instead of simulating "code sent", this page
// explains the real recovery path honestly.
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Mail, IdCard } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";

const ForgotPassword = () => (
  <AuthLayout statement="Locked out? The ODL office will get you back in.">
    <AuthHeading eyebrow="Account recovery" title="Reset your password">
      Passwords for AUST ODL accounts are issued and reset by the university. Self-service reset isn’t available yet.
    </AuthHeading>

    <ol className="divide-y divide-[rgb(var(--border))] border-y border-line">
      {[
        { Icon: Building2, title: "Contact the ODL office", body: "Ask the Open & Distance Learning office or your department coordinator to reset your LMS password." },
        { Icon: IdCard, title: "Keep your details ready", body: "Your username (roll number for students) and CNIC are used to verify you." },
        { Icon: Mail, title: "Sign in with the temporary password", body: "You’ll be asked to choose a new password the first time you sign in." },
      ].map(({ Icon, title, body }, i) => (
        <li key={i} className="flex gap-4 py-4">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-secondary text-[13px] font-semibold tabular-nums" aria-hidden="true">{i + 1}</span>
          <div>
            <p className="flex items-center gap-2 text-[15px] font-semibold text-fg"><Icon size={15} className="text-fg-muted" aria-hidden="true" />{title}</p>
            <p className="mt-1 text-[14px] leading-5 text-fg-muted">{body}</p>
          </div>
        </li>
      ))}
    </ol>

    <Link to="/login" className="btn-secondary btn-lg w-full mt-8">
      <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
    </Link>
  </AuthLayout>
);

export default ForgotPassword;

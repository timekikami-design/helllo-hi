// lms-frontend/src/pages/auth/VerifyOTP.jsx
// No OTP is issued by the LMS backend, so this route never pretends to
// verify a code. It points users to the real recovery path.
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";

const VerifyOTP = () => (
  <AuthLayout>
    <AuthHeading eyebrow="Verification" title="Verification codes aren’t used">
      AUST ODL doesn’t send one-time codes. Password resets are handled by the ODL office.
    </AuthHeading>
    <div className="flex gap-3 rounded border border-line bg-surface px-4 py-3 text-[14px] leading-5 text-fg-secondary">
      <ShieldCheck size={16} className="mt-0.5 shrink-0 text-note" aria-hidden="true" />
      If you received a message asking for a code to access the LMS, don’t share it — contact the ODL office.
    </div>
    <div className="mt-8 grid gap-2">
      <Link to="/forgot-password" className="btn-primary btn-lg w-full">How to reset my password</Link>
      <Link to="/login" className="btn-ghost btn-lg w-full"><ArrowLeft size={16} aria-hidden="true" /> Back to sign in</Link>
    </div>
  </AuthLayout>
);

export default VerifyOTP;

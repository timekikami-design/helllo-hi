// lms-frontend/src/pages/auth/Register.jsx
// LMS accounts are provisioned automatically after admission (there is no
// public sign-up endpoint). This page explains access honestly instead of
// simulating account creation.
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { AuthLayout, AuthHeading } from "../../components/auth/AuthLayout";

function admissionsUrl() {
  if (import.meta.env && import.meta.env.VITE_ADMISSIONS_URL) return import.meta.env.VITE_ADMISSIONS_URL;
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (/^\d+-/.test(hostname)) return `${protocol}//${hostname.replace(/^\d+-/, "3000-")}`;
  }
  return "http://localhost:3000";
}

const Register = () => (
  <AuthLayout statement="Your place at AUST begins with admission.">
    <AuthHeading eyebrow="Getting access" title="How LMS accounts are created">
      You don’t need to sign up. Your LMS account is created by the university once your admission is confirmed.
    </AuthHeading>
    <dl className="divide-y divide-[rgb(var(--border))] border-y border-line">
      {[
        ["Students", "Apply through AUST Admissions. After your admission and enrolment are confirmed, your username (roll number) and a temporary password are issued."],
        ["Faculty & staff", "Accounts are created by the ODL office or your department coordinator."],
        ["First sign-in", "You’ll be asked to set your own password before continuing."],
      ].map(([t, d]) => (
        <div key={t} className="py-4">
          <dt className="text-[15px] font-semibold text-fg">{t}</dt>
          <dd className="mt-1 text-[14px] leading-5 text-fg-muted">{d}</dd>
        </div>
      ))}
    </dl>
    <div className="mt-8 grid gap-2">
      <a href={admissionsUrl()} className="btn-primary btn-lg w-full">Go to Admissions <ArrowUpRight size={16} aria-hidden="true" /></a>
      <Link to="/login" className="btn-ghost btn-lg w-full"><ArrowLeft size={16} aria-hidden="true" /> Back to sign in</Link>
    </div>
  </AuthLayout>
);

export default Register;

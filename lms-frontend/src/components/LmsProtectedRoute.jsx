import { Navigate, Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/* =========================================================================
 * LmsProtectedRoute (Section 5.3)
 * --------------------------------------------------------------------------
 * Props:
 *   allowedRoles : string[]  (FRONTEND role keys, e.g. ["student"])
 *   children     : the route element to render when access is granted
 *
 * Behavior:
 *   - Not authenticated                 → redirect to /login
 *   - mustChangePassword === true        → redirect to /force-change-password
 *   - authenticated but role not allowed → 403 / unauthorized message
 *   - authenticated and role allowed     → render children
 *
 * This wrapper does NOT alter any page UI — it only gates access.
 * ======================================================================= */
const ROLE_HOME = {
  student: "/student", teacher: "/teacher", admin: "/admin", focal_person: "/focal",
  exam_coordinator: "/exam", director_qec: "/qec", provost: "/provost",
};

const LmsProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  // While verifying the session token, render a neutral placeholder.
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-canvas" role="status" aria-label="Checking your session">
        <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Forced first-login password change takes precedence over everything.
  if (user.mustChangePassword === true) {
    return <Navigate to="/force-change-password" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-canvas px-6">
        <div className="max-w-md w-full">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-fg-muted mb-5" aria-hidden="true">
            <Lock size={18} />
          </span>
          <p className="label-caps">Error 403</p>
          <h1 className="text-[24px] font-semibold text-fg mt-1">You don't have access to this page</h1>
          <p className="text-[14px] text-fg-secondary mt-2">
            You are signed in as <strong className="text-fg">{user.username || user.role}</strong>. This page belongs to a different role.
            If you think this is a mistake, contact the ODL office.
          </p>
          <div className="mt-6 flex gap-2">
            <Link to={ROLE_HOME[user.role] || "/login"} className="btn btn-primary">Go to my dashboard</Link>
            <button type="button" onClick={() => window.history.back()} className="btn btn-secondary">Go back</button>
          </div>
        </div>
      </main>
    );
  }

  return children;
};

export default LmsProtectedRoute;

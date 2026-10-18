// lms-frontend/src/components/layout/DashboardLayout.jsx
// App shell: skip link → sidebar / rail → top bar → offline banner → main.
// The page area is contained (min-w-0, no page-level horizontal scroll),
// guarded by an error boundary per route, and fades in subtly.
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { useAuth } from "../../context/AuthContext";
import FeeBlockGate from "../student/FeeBlockGate";
import ErrorBoundary from "../common/ErrorBoundary";
import NetworkStatus from "../common/NetworkStatus";

const COLLAPSE_KEY = "aust_sidebar_collapsed";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_KEY) === "true"; } catch (_) { return false; }
  });
  const location = useLocation();
  const { user } = useAuth();
  const isStudent = user?.role === "student";

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, String(collapsed)); } catch (_) { /* storage unavailable */ }
  }, [collapsed]);

  // Close the mobile drawer on navigation and move focus to the new page.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const closeDrawer = useCallback(() => setSidebarOpen(false), []);
  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  return (
    <div className="min-h-dvh flex bg-canvas text-fg">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar isOpen={sidebarOpen} onClose={closeDrawer} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <NetworkStatus />
        <main id="main-content" tabIndex={-1} key={location.pathname} className="page-enter flex-1 min-w-0 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10 focus:outline-none">
          <ErrorBoundary resetKey={location.pathname}>
            {isStudent ? <FeeBlockGate><Outlet /></FeeBlockGate> : <Outlet />}
          </ErrorBoundary>
        </main>
        <footer className="px-4 sm:px-6 lg:px-10 py-6 border-t border-line text-[12px] leading-4 text-fg-muted">
          <div className="mx-auto max-w-[1440px] flex flex-wrap justify-between gap-2">
            <span>Abbottabad University of Science &amp; Technology · Open &amp; Distance Learning</span>
            <span className="tabular-nums">© {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;

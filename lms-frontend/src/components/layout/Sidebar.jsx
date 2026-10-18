import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import Logo from "../common/Logo";
import { useAuth } from "../../context/AuthContext";
import { ROLE_META } from "../../context/AuthContext";
import api from "../../services/api";

/* =========================================================================
 * STUDENT MENU (existing)
 *   - "Academic Progress" label removed/renamed as per spec
 * ======================================================================= */
const studentMenu = [
  { section: "MAIN" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/student" },
  { label: "My Courses", icon: "BookOpen", to: "/student/courses" },
  { label: "Live Classes", icon: "Video", to: "/student/live-classes", badge: "Live", badgeColor: "rose" },
  { label: "Recorded Lectures", icon: "PlayCircle", to: "/student/recorded" },
  { label: "Course Library", icon: "Library", to: "/student/library" },
  { label: "AI Tutor", icon: "Bot", to: "/student/ai-tutor", badge: "AI", badgeColor: "violet" },
  { section: "ACADEMICS" },
  { label: "Assignments", icon: "FileText", to: "/student/assignments" },
  { label: "Lab Tasks", icon: "FlaskConical", to: "/student/lab-tasks" },
  { label: "Quizzes", icon: "FileQuestion", to: "/student/quizzes" },
  /* Removed: Academic Progress module (per restructuring spec) */
  { label: "Mid Term Exam", icon: "FileEdit", to: "/student/midterm" },
  { label: "Final Term Exam", icon: "FileCheck2", to: "/student/finalterm" },
  { label: "Attendance", icon: "CalendarCheck", to: "/student/attendance" },
  { label: "Results", icon: "Award", to: "/student/results" },
  { label: "CGPA Calculator", icon: "Calculator", to: "/student/cgpa" },
  { label: "Study Scheme", icon: "GraduationCap", to: "/student/scheme" },
  { label: "Course Withdrawal", icon: "LogOut", to: "/student/withdrawal" },
  { section: "ACHIEVEMENTS" },
  { label: "AI Insights", icon: "Sparkles", to: "/student/ai-insights", badge: "AI", badgeColor: "violet" },
  { label: "Badges", icon: "Trophy", to: "/student/badges" },
  { label: "Activity", icon: "Activity", to: "/student/activity" },
  { section: "COMMUNICATION" },
  { label: "Messages", icon: "MessageSquare", to: "/student/messages" },
  { label: "Announcements", icon: "Megaphone", to: "/student/announcements" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/student/appeals" },
  { label: "QEC Surveys", icon: "ClipboardList", to: "/student/surveys", badge: "QEC", badgeColor: "violet" },
  { section: "OTHER" },
  { label: "Accounts Book", icon: "Wallet", to: "/student/account" },
  { label: "Sticky Notes", icon: "StickyNote", to: "/student/notes" },
  { label: "Schedule", icon: "Calendar", to: "/student/schedule" },
  { label: "Settings", icon: "Settings", to: "/student/settings" },
];

/* =========================================================================
 * TEACHER MENU
 *   - "Lecture Uploads" remains; new "Course Material" entry added
 *   - "Course History" added (historical data section)
 * ======================================================================= */
const teacherMenu = [
  { section: "MAIN" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/teacher" },
  { label: "My Courses", icon: "BookOpen", to: "/teacher/subjects" },
  { label: "Live Classes", icon: "Video", to: "/teacher/live-classes" },
  { label: "Recorded Lectures", icon: "Video", to: "/teacher/lectures" },
  { label: "Course Library", icon: "Library", to: "/teacher/library" },
  { section: "ACADEMICS" },
  { label: "Assignments", icon: "FileText", to: "/teacher/assignments" },
  { label: "Lab Tasks", icon: "FlaskConical", to: "/teacher/lab-tasks" },
  { label: "Quizzes", icon: "FileQuestion", to: "/teacher/quizzes" },
  { label: "Mid Term Exam", icon: "FileEdit", to: "/teacher/midterm" },
  { label: "Final Term Exam", icon: "FileCheck2", to: "/teacher/finalterm" },
  { label: "Marks", icon: "Award", to: "/teacher/marks" },
  { label: "Results Submission", icon: "Send", to: "/teacher/results-submission", badge: "PIN", badgeColor: "violet" },
  { label: "Attendance", icon: "CalendarCheck", to: "/teacher/attendance" },
  { label: "Students", icon: "Users", to: "/teacher/students" },
  { label: "Course History", icon: "History", to: "/teacher/history" },
  { section: "COMMUNICATION" },
  { label: "Announcements", icon: "Megaphone", to: "/teacher/announcements" },
  { label: "Messages", icon: "MessageSquare", to: "/teacher/messages" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/teacher/appeals" },
  { section: "OTHER" },
  { label: "Settings", icon: "Settings", to: "/teacher/settings" },
];

/* =========================================================================
 * COURSE COORDINATOR (admin) MENU
 *   - "Faculty Management" → "Course Instructor"
 *   - "Teacher Assignment" → "Course Distribution"
 *   - "Fee Approvals" REMOVED (moved to Finance Coordinator / Provost)
 *   - "Class Monitoring" added (view-only live class oversight)
 * ======================================================================= */
const adminMenu = [
  { section: "OVERVIEW" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/admin" },
  { label: "Reports & Analytics", icon: "BarChart3", to: "/admin/reports" },
  { section: "ACADEMIC MANAGEMENT" },
  { label: "Programs", icon: "GraduationCap", to: "/admin/degrees" },
  { label: "Courses & Schemes", icon: "BookOpen", to: "/admin/courses" },
  { label: "Weekly Schedule", icon: "CalendarRange", to: "/admin/schedule" },
  { label: "Weightage", icon: "Scale", to: "/admin/weightage" },
  { label: "Class Monitoring", icon: "Radio", to: "/admin/class-monitoring", badge: "Live", badgeColor: "rose" },
  { label: "Live Class Schedule", icon: "Video", to: "/admin/live-classes" },
  { section: "PEOPLE & ASSIGNMENTS" },
  { label: "Course Instructor", icon: "UserCog", to: "/admin/teachers" },
  { label: "Course Distribution", icon: "UserCheck", to: "/admin/teacher-assignment" },
  { label: "Teacher Replacement", icon: "Replace", to: "/admin/teacher-replacement" },
  { label: "Students", icon: "Users", to: "/admin/students" },
  { label: "Student Allocation", icon: "UsersRound", to: "/admin/student-allocation" },
  { label: "Enrollments", icon: "ClipboardCheck", to: "/admin/enrollments" },
  { section: "COMMUNICATION" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/admin/appeals" },
  { label: "Announcements", icon: "Megaphone", to: "/admin/announcements" },
  { label: "Quick Messages", icon: "Send", to: "/admin/quick-messages", badge: "New", badgeColor: "violet" },
  { label: "Settings", icon: "Settings", to: "/admin/settings" },
];

/* =========================================================================
 * FOCAL PERSON MENU — Department-level academic oversight
 *   - REMOVED: Quizzes / Assignments / Mid / Final monitoring (per spec)
 *   - REMOVED: Transcripts module (merged into Student Search)
 *   - NEW: Discipline & Fines
 *   - NEW: Enrollment Analytics (within Reports)
 * ======================================================================= */
const focalMenu = [
  { section: "MAIN" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/focal" },
  { label: "Department Overview", icon: "Building2", to: "/focal/overview" },
  { section: "ENROLLMENT MANAGEMENT" },
  { label: "Manage Enrollments", icon: "ClipboardCheck", to: "/focal/enrollments", badge: "12", badgeColor: "amber" },
  { label: "Semester Promotions", icon: "TrendingUp", to: "/focal/promotions" },
  { label: "Retake & Improvement", icon: "RotateCcw", to: "/focal/retakes" },
  { label: "Withdraw Cases", icon: "LogOut", to: "/focal/withdraws" },
  { label: "Scheme of Study", icon: "GraduationCap", to: "/focal/scheme" },
  { section: "STUDENT MANAGEMENT" },
  { label: "Student Search", icon: "Search", to: "/focal/student-search" },
  { label: "Student Block", icon: "UserX", to: "/focal/student-drop" },
  { label: "Discipline & Fines", icon: "AlertOctagon", to: "/focal/discipline", badge: "New", badgeColor: "violet" },
  { label: "Fine Management", icon: "DollarSign", to: "/focal/fines", badge: "New", badgeColor: "emerald" },
  { section: "MONITORING (VIEW ONLY)" },
  { label: "Lab Tasks Monitor", icon: "FlaskConical", to: "/focal/lab-tasks" },
  { label: "Attendance Analytics", icon: "CalendarCheck", to: "/focal/attendance" },
  { label: "Results Analytics", icon: "Award", to: "/focal/results" },
  { section: "COMMUNICATION & QEC" },
  { label: "Messages", icon: "MessageSquare", to: "/focal/quick-messages" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/focal/grievances" },
  { label: "Surveys & QEC", icon: "ClipboardList", to: "/focal/surveys" },
  { label: "Teacher Deactivation", icon: "UserMinus", to: "/focal/deactivations", badge: "1", badgeColor: "amber" },
  { section: "REPORTING" },
  { label: "Reports & Analytics", icon: "BarChart3", to: "/focal/reports" },
  { label: "Activity Logs", icon: "ScrollText", to: "/focal/activity-logs" },
  { label: "Settings", icon: "Settings", to: "/focal/settings" },
];

/* =========================================================================
 * EXAM CONTROLLER MENU (renamed from Exam Coordinator)
 *   - NEW: UFM Cases, Absentee Verification, Rechecking, Marks Correction,
 *          Result Hold/Release, Gazette Review, Probation Flagging
 * ======================================================================= */
const examMenu = [
  { section: "OVERVIEW" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/exam" },
  { section: "EXAM OPERATIONS" },
  { label: "Online Exam Management", icon: "Monitor", to: "/exam/schedule", badge: "Online", badgeColor: "blue" },
  { label: "Date Sheets", icon: "FileText", to: "/exam/datesheets" },
  { label: "Attendance", icon: "CalendarCheck", to: "/exam/attendance" },
  { section: "CASES & VERIFICATION" },
  { label: "UFM Cases", icon: "AlertTriangle", to: "/exam/ufm", badgeKey: "ufm", badgeColor: "rose" },
  { label: "Absentee Verification", icon: "UserX", to: "/exam/absentees" },
  { label: "Incomplete Results", icon: "FileWarning", to: "/exam/incomplete" },
  { section: "RESULT AND MANAGEMENT" },
  { label: "Result Compilation", icon: "Layers", to: "/exam/result-compilation", badgeKey: "wfCompilation", badgeColor: "violet" },
  { label: "Results Collection", icon: "ClipboardList", to: "/exam/results-collection", badgeKey: "wfCollection", badgeColor: "amber" },
  { label: "Result Finalizing & Official", icon: "BadgeCheck", to: "/exam/result-finalizing", badgeKey: "wfFinalizing", badgeColor: "rose" },
  { label: "Results Archive", icon: "Archive", to: "/exam/results-archive" },
  { label: "Gazette", icon: "BookCheck", to: "/exam/gazette" },
  { label: "Probation Flagging", icon: "Flag", to: "/exam/probation" },
  { section: "MONITORING" },
  { label: "Mid Term Monitoring", icon: "FileEdit", to: "/exam/midterm" },
  { label: "Final Term Monitoring", icon: "FileCheck2", to: "/exam/finalterm" },
  { label: "Exam Tracking", icon: "Activity", to: "/exam/tracking" },
  { section: "STUDENT SUPPORT" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/exam/grievances" },
  { section: "REPORTS" },
  { label: "Exam Reports", icon: "BarChart3", to: "/exam/reports" },
  { label: "Result Analytics", icon: "TrendingUp", to: "/exam/analytics" },
  { label: "Activity Logs", icon: "ScrollText", to: "/exam/activity-logs" },
  { label: "Settings", icon: "Settings", to: "/exam/settings" },
];

/* =========================================================================
 * QEC COORDINATOR MENU (renamed from Director QEC)
 *   - NEW: Survey announcement system w/ lock/unlock
 *   - NEW: Faculty / Course / Program Evaluation
 *   - NEW: Self-Assessment & Corrective Action
 *   - NEW: Anonymous Feedback
 * ======================================================================= */
const qecMenu = [
  { section: "OVERVIEW" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/qec" },
  { label: "Quality Analytics", icon: "BarChart3", to: "/qec/analytics" },
  { section: "SURVEYS" },
  { label: "Survey Management", icon: "ClipboardList", to: "/qec/surveys", badge: "New", badgeColor: "violet" },
  { label: "Anonymous Feedback", icon: "MessageCircle", to: "/qec/feedback" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/qec/grievances" },
  { section: "EVALUATION" },
  { label: "Faculty Evaluation", icon: "Star", to: "/qec/faculty-eval" },
  { label: "Course Evaluation", icon: "BookCheck", to: "/qec/course-evaluation" },
  { label: "Program Evaluation", icon: "GraduationCap", to: "/qec/program-eval" },
  { label: "Self-Assessment", icon: "ListChecks", to: "/qec/self-assessment" },
  { section: "REPORTS" },
  { label: "Department Performance", icon: "Building2", to: "/qec/departments" },
  { label: "QA Reports", icon: "FileBarChart", to: "/qec/reports" },
  { label: "Compliance", icon: "ShieldCheck", to: "/qec/compliance" },
  { label: "Activity Logs", icon: "ScrollText", to: "/qec/activity-logs" },
  { label: "Settings", icon: "Settings", to: "/qec/settings" },
];

/* =========================================================================
 * PROVOST MENU — University-wide executive oversight + Finance Coordination
 *   - MERGED in former Finance Coordinator responsibilities:
 *     Fee Announcements, Fee Approvals, Fee Monitoring, Defaulters, Fines
 * ======================================================================= */
const provostMenu = [
  { section: "EXECUTIVE OVERVIEW" },
  { label: "Dashboard", icon: "LayoutDashboard", to: "/provost" },
  { label: "Executive Analytics", icon: "BarChart3", to: "/provost/analytics" },
  { section: "GOVERNANCE" },
  { label: "Departments", icon: "Building2", to: "/provost/departments" },
  { label: "Programs", icon: "GraduationCap", to: "/provost/programs" },
  { label: "Faculty Overview", icon: "UserCog", to: "/provost/faculty" },
  { label: "Student Overview", icon: "Users", to: "/provost/students" },
  { section: "FEE MANAGEMENT" },
  { label: "Fee Management", icon: "Wallet", to: "/provost/fee-management" },
  { label: "Announce Fees", icon: "Megaphone", to: "/provost/fee-announce" },
  { label: "Student Fee Records", icon: "Users", to: "/provost/fee-records" },
  { label: "Fee Reports", icon: "FileBarChart", to: "/provost/fee-reports" },
  { section: "FINANCE COORDINATION" },
  { label: "Financial Overview", icon: "Wallet", to: "/provost/finance" },
  { label: "Fee Announcements", icon: "Megaphone", to: "/provost/fee-announcements" },
  { label: "Exam Fee Announcements", icon: "FileText", to: "/provost/exam-fee-announcements", badge: "New", badgeColor: "rose" },
  { label: "Fee Approvals", icon: "BadgeCheck", to: "/provost/fee-approvals" },
  { label: "Concessions & Instalments", icon: "Percent", to: "/provost/fee-concessions" },
  { label: "Fines Management", icon: "AlertCircle", to: "/provost/fines" },
  { label: "Defaulters", icon: "UserMinus", to: "/provost/defaulters" },
  { section: "STUDENT SUPPORT" },
  { label: "Support & Grievances", icon: "ShieldAlert", to: "/provost/grievances" },
  { section: "REPORTING" },
  { label: "Strategic Reports", icon: "FileBarChart", to: "/provost/reports" },
  { label: "Activity Logs", icon: "ScrollText", to: "/provost/activity-logs" },
  { label: "Settings", icon: "Settings", to: "/provost/settings" },
];

const MENUS = {
  student: studentMenu,
  teacher: teacherMenu,
  admin: adminMenu,
  focal_person: focalMenu,
  exam_coordinator: examMenu,
  director_qec: qecMenu,
  provost: provostMenu,
};

/* Per-role base path used by the user card link + active matcher. */
const ROLE_BASE = {
  student: "/student",
  teacher: "/teacher",
  admin: "/admin",
  focal_person: "/focal",
  exam_coordinator: "/exam",
  director_qec: "/qec",
  provost: "/provost",
};

/* Group consecutive items under their section heading. */
function groupMenu(menu) {
  const groups = [];
  let cur = { section: null, items: [] };
  for (const item of menu) {
    if (item.section) { if (cur.items.length || cur.section) groups.push(cur); cur = { section: item.section, items: [] }; }
    else cur.items.push(item);
  }
  if (cur.items.length || cur.section) groups.push(cur);
  return groups;
}
const titleCase = (s) => String(s || "").toLowerCase().replace(/(^|[\s&/(])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bQec\b/, "QEC").replace(/\bAi\b/, "AI");

const initialsOf = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "U";
const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Navigation surface.
 *  • ≥1024px: sticky sidebar, 240px expanded or 64px icon rail (persisted).
 *  • <1024px: slide-over drawer (focus trap, Escape, scroll lock, focus return).
 * Active route: primary-soft background + 2px primary edge + aria-current.
 */
const Sidebar = ({ isOpen, onClose, collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth();
  const menu = MENUS[user?.role] || studentMenu;
  const base = ROLE_BASE[user?.role] || "/student";
  const meta = ROLE_META[user?.role] || ROLE_META.student;
  const drawerRef = useRef(null);

  // Live sidebar badge counts for the Exam Controller (replaces hardcoded badges).
  const [counts, setCounts] = useState({});
  useEffect(() => {
    if (user?.role !== "exam_coordinator") return undefined;
    let live = true;
    const fetchCounts = () => {
      Promise.all([api.exam.counts().catch(() => ({})), api.workflow.summary().catch(() => null)])
        .then(([res, wf]) => {
          if (!live) return;
          const st = (wf && wf.stages) || {};
          setCounts({ ...(res || {}), wfCompilation: st.compilation, wfCollection: st.collection, wfFinalizing: st.finalizing });
        });
    };
    fetchCounts();
    const t = setInterval(fetchCounts, 60000);
    return () => { live = false; clearInterval(t); };
  }, [user?.role]);

  // Mobile drawer: focus trap, Escape, scroll lock, focus return.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = drawerRef.current;
    setTimeout(() => el?.querySelector(FOCUSABLE)?.focus(), 0);
    const onKey = (e) => {
      if (e.key === "Escape") { onClose?.(); return; }
      if (e.key !== "Tab" || !el) return;
      const items = [...el.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, [isOpen, onClose]);

  const resolveBadge = (item) => {
    if (item.badgeKey) {
      const n = counts[item.badgeKey];
      return n && n > 0 ? String(n) : null;
    }
    // Static marketing badges ("AI", "Live", "QEC" …) are not status: shown only
    // when meaningful (e.g. "Online"), never animated.
    return item.badge && !["Live", "AI", "QEC"].includes(item.badge) ? item.badge : null;
  };

  const groups = groupMenu(menu);
  const rail = collapsed; // desktop icon rail

  const renderNav = (isRail) => (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
      {groups.map((g, gi) => (
        <div key={gi} className={gi > 0 ? "mt-4" : ""}>
          {g.section && (isRail
            ? <div className="mx-3 mb-2 border-t border-line" aria-hidden="true" />
            : <p className="px-3 mb-1 text-[11px] leading-4 font-medium tracking-[0.06em] uppercase text-fg-muted">{titleCase(g.section)}</p>)}
          <ul className="space-y-px">
            {g.items.map((item) => {
              const Icon = Icons[item.icon] || Icons.Circle;
              const badge = resolveBadge(item);
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === base}
                    onClick={onClose}
                    aria-label={isRail ? item.label : undefined}
                    data-tip={isRail ? item.label : undefined}
                    className={({ isActive }) => `rail-tip group relative flex items-center ${isRail ? "justify-center h-10 w-10 mx-auto" : "gap-3 h-9 px-3"} rounded text-[14px] leading-5 transition-colors duration-150 ${
                      isActive
                        ? "bg-brand-soft text-brand font-semibold before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[2px] before:rounded-full before:bg-brand"
                        : "text-fg-secondary hover:bg-surface hover:text-fg"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.75} className="shrink-0" aria-hidden="true" />
                    {!isRail && <span className="flex-1 truncate">{item.label}</span>}
                    {!isRail && badge && <span className="badge badge-neutral h-5 px-1.5 text-[11px] tabular-nums">{badge}</span>}
                    {isRail && badge && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brass-decor" aria-hidden="true" />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const identity = (isRail) => (
    <div className="border-t border-line px-2 py-3">
      <NavLink to={`${base}/settings`} onClick={onClose} aria-label={isRail ? `${user?.name || "Account"} — settings` : undefined} data-tip={isRail ? user?.name : undefined}
        className={`rail-tip flex items-center ${isRail ? "justify-center h-10 w-10 mx-auto" : "gap-3 px-2 py-1.5"} rounded hover:bg-surface transition-colors`}>
        {user?.avatar
          ? <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
          : <span className="h-8 w-8 rounded-full bg-brand text-brand-on inline-flex items-center justify-center text-[12px] font-semibold shrink-0" aria-hidden="true">{initialsOf(user?.name)}</span>}
        {!isRail && (
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] leading-5 font-medium text-fg truncate">{user?.name || "Account"}</span>
            <span className="block text-[12px] leading-4 text-fg-muted truncate">{meta.label}</span>
          </span>
        )}
      </NavLink>
      <button type="button" onClick={logout} aria-label={isRail ? "Sign out" : undefined} data-tip={isRail ? "Sign out" : undefined}
        className={`rail-tip mt-1 flex items-center ${isRail ? "justify-center h-10 w-10 mx-auto" : "gap-3 h-9 px-3 w-full"} rounded text-[14px] text-fg-secondary hover:bg-surface hover:text-bad transition-colors`}>
        <Icons.LogOut size={17} strokeWidth={1.75} aria-hidden="true" />
        {!isRail && <span>Sign out</span>}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop / laptop: persistent sidebar or icon rail */}
      <aside
        aria-label="Sidebar"
        className="hidden lg:flex sticky top-0 h-dvh shrink-0 flex-col bg-surface-muted border-r border-line transition-[width] duration-200 ease-out"
        style={{ width: rail ? "var(--rail-w)" : "var(--sidebar-w)" }}
      >
        <div className={`flex items-center h-16 border-b border-line ${rail ? "justify-center" : "justify-between px-4"}`}>
          {rail ? <Logo size="sm" showText={false} to={base} /> : <Logo size="sm" to={base} />}
          {!rail && (
            <button type="button" onClick={onToggleCollapse} aria-label="Collapse sidebar" aria-expanded="true" className="btn-icon h-8 w-8 min-h-0">
              <Icons.PanelLeftClose size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        {rail && (
          <button type="button" onClick={onToggleCollapse} aria-label="Expand sidebar" aria-expanded="false" data-tip="Expand" className="rail-tip btn-icon mx-auto mt-2 h-8 w-8 min-h-0">
            <Icons.PanelLeftOpen size={17} aria-hidden="true" />
          </button>
        )}
        {renderNav(rail)}
        {identity(rail)}
      </aside>

      {/* Mobile / tablet: slide-over drawer */}
      <div className={`lg:hidden fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} aria-hidden={!isOpen}>
        <div onClick={onClose} className={`absolute inset-0 bg-[rgb(11_15_20/0.5)] transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`} />
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col bg-surface-muted border-r border-line shadow-pop transition-transform duration-[250ms] ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-line">
            <Logo size="sm" to={base} />
            <button type="button" onClick={onClose} aria-label="Close navigation" className="btn-icon -mr-2">
              <Icons.X size={18} aria-hidden="true" />
            </button>
          </div>
          {isOpen && renderNav(false)}
          {isOpen && identity(false)}
        </aside>
      </div>
    </>
  );
};

export default Sidebar;

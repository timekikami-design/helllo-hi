import { useState, useRef, useEffect } from "react";
import { Bell, Search, Menu, MessageSquare, ChevronRight, LogOut, Settings, CornerDownLeft, BellOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import ThemeToggle from "../common/ThemeToggle";
import api from "../../services/api";
import useRealtime from "../../hooks/useRealtime";

// Map the frontend role key → the api.<role> namespace that exposes
// notifications(). Roles without their own feed simply show none.
const NOTIF_API = {
  student: () => api.student,
  teacher: () => api.teacher,
  admin: () => api.coordinator,
  focal_person: () => api.focal,
  exam_coordinator: () => api.exam,
  director_qec: () => api.qec,
  provost: () => api.provost,
};

// Roles whose notifications are also pushed live over SSE.
const REALTIME_ROLES = ["teacher"];

const timeAgo = (d) => {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* Initials fallback so we never show a broken image when a user (e.g. a
 * student without an uploaded admission photo) has no real avatar. */
const initialsOf = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "U";

const Avatar = ({ src, name, className }) =>
  src ? (
    <img src={src} alt="" className={className} />
  ) : (
    <span className={`${className} inline-flex items-center justify-center bg-brand text-brand-on font-semibold text-[12px]`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );

/* Page title for the compact mobile bar, derived from the route. */
const titleFromPath = (path) => {
  const seg = path.split("/").filter(Boolean);
  const last = seg.length > 1 ? seg[seg.length - 1] : "dashboard";
  if (/^\d+$/.test(last) || last.length > 24) return seg.length > 2 ? seg[seg.length - 2].replace(/-/g, " ") : "Overview";
  return last.replace(/-/g, " ");
};

const Navbar = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const [openProfile, setOpenProfile] = useState(false);
  const [openNotif, setOpenNotif] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setOpenProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setOpenNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpenSearch(true);
      }
      if (e.key === "Escape") setOpenSearch(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const role = user?.role || "student";

  // Real, system-generated notifications for the authenticated user only.
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    let cancelled = false;
    const ns = NOTIF_API[role]?.();
    if (!ns || typeof ns.notifications !== "function") { setNotifications([]); return; }
    ns.notifications()
      .then((res) => { if (!cancelled) setNotifications(Array.isArray(res) ? res : (res?.notifications || [])); })
      .catch(() => { if (!cancelled) setNotifications([]); });
    return () => { cancelled = true; };
  }, [role]);

  // Live delivery: teachers receive Exam Controller reminders (incomplete
  // results) over their SSE stream and the bell updates without a refresh.
  useRealtime(REALTIME_ROLES.includes(role) ? NOTIF_API[role]?.()?.eventsUrl : undefined, {
    notification: (n) => {
      if (!n || !n.title) return;
      setNotifications((prev) => (n.id != null && prev.some((p) => p.id === n.id) ? prev : [n, ...prev]));
    },
  }, [role]);

  const openNotification = async (n) => {
    if (!n.isRead) {
      setNotifications((prev) => prev.map((p) => (p.id === n.id ? { ...p, isRead: true } : p)));
      if (n.id != null) { try { await NOTIF_API[role]?.()?.readNotification?.(n.id); } catch (_) { /* ignore */ } }
    }
    if (n.link) { setOpenNotif(false); navigate(n.link); }
  };

  const markAllRead = async () => {
    const ns = NOTIF_API[role]?.();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try { await ns?.readAllNotifications?.(); } catch (_) { /* ignore */ }
  };

  const location = useLocation();
  const pageTitle = titleFromPath(location.pathname);
  const [query, setQuery] = useState("");
  const quick = [
    { label: "Overview", to: `/${role === "focal_person" ? "focal" : role === "exam_coordinator" ? "exam" : role === "director_qec" ? "qec" : role}` },
    { label: "Messages", to: `/${role}/messages` },
    { label: "Settings", to: `/${role}/settings` },
  ];
  const results = query.trim()
    ? quick.filter((q) => q.label.toLowerCase().includes(query.trim().toLowerCase()))
    : quick;

  // Esc closes popovers; focus returns to their trigger.
  useEffect(() => {
    if (!openNotif && !openProfile) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpenNotif(false); setOpenProfile(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openNotif, openProfile]);

  return (
    <>
      <header role="banner" className="sticky top-0 z-30 h-14 lg:h-16 bg-canvas/95 border-b border-line">
        <div className="flex h-full items-center gap-2 px-3 sm:px-4 lg:px-8">
          <button type="button" onClick={onMenuClick} aria-label="Open navigation" className="btn-icon lg:hidden -ml-1">
            <Menu size={20} aria-hidden="true" />
          </button>
          <p className="lg:hidden flex-1 min-w-0 truncate text-[15px] font-semibold text-fg capitalize">{pageTitle}</p>

          <button type="button" onClick={() => setOpenSearch(true)}
            className="hidden lg:flex items-center gap-2 h-10 w-full max-w-[420px] px-3 rounded border border-line bg-surface text-[14px] text-fg-muted hover:border-line-strong transition-colors">
            <Search size={16} aria-hidden="true" />
            <span className="flex-1 text-left">Go to…</span>
            <kbd className="text-[11px] font-medium text-fg-muted border border-line rounded-sm px-1.5 leading-5">Ctrl K</kbd>
          </button>
          <div className="hidden lg:block flex-1" />

          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setOpenSearch(true)} aria-label="Search" className="btn-icon lg:hidden"><Search size={18} aria-hidden="true" /></button>
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link to={`/${role}/messages`} aria-label="Messages" className="btn-icon hidden sm:inline-flex">
              <MessageSquare size={18} aria-hidden="true" />
            </Link>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button type="button"
                onClick={() => { setOpenNotif(!openNotif); setOpenProfile(false); }}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
                aria-expanded={openNotif} aria-haspopup="dialog"
                className="btn-icon relative">
                <Bell size={18} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-brand text-brand-on text-[10px] leading-4 font-semibold text-center tabular-nums" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
                )}
              </button>
              {openNotif && (
                <div role="dialog" aria-label="Notifications"
                  className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-auto sm:right-0 sm:mt-2 sm:w-[380px] max-h-[min(560px,80dvh)] flex flex-col bg-surface-elevated border border-line rounded-lg shadow-pop overflow-hidden z-50"
                  style={{ animation: "aust-fade 150ms ease-out both" }}>
                  <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-line">
                    <p className="text-[14px] font-semibold text-fg">Notifications <span className="font-normal text-fg-muted tabular-nums">· {unreadCount} unread</span></p>
                    {unreadCount > 0 && (
                      <button type="button" onClick={markAllRead} className="text-[13px] font-medium text-brand hover:underline underline-offset-2">Mark all as read</button>
                    )}
                  </div>
                  <ul className="flex-1 overflow-y-auto divide-y divide-[rgb(var(--border))]">
                    {notifications.length === 0 ? (
                      <li className="px-4 py-10 text-center">
                        <BellOff size={18} className="mx-auto text-fg-muted mb-2" aria-hidden="true" />
                        <p className="text-[14px] font-medium text-fg">You’re up to date.</p>
                        <p className="text-[13px] text-fg-muted">No new notifications.</p>
                      </li>
                    ) : notifications.map((n) => (
                      <li key={n.id ?? `${n.title}-${n.createdAt}`}>
                        <button type="button" onClick={() => openNotification(n)} data-notif-link={n.link || undefined}
                          className="w-full text-left flex gap-3 px-4 py-3 hover:bg-surface-muted transition-colors">
                          <span className={`mt-2 h-2 w-2 rounded-full shrink-0 ${n.isRead ? "bg-transparent" : "bg-brand"}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[14px] leading-5 ${n.isRead ? "text-fg-secondary" : "text-fg font-semibold"}`}>{n.title}{!n.isRead && <span className="sr-only"> (unread)</span>}</span>
                            {n.message && <span className="mt-0.5 block text-[13px] leading-5 text-fg-muted line-clamp-2">{n.message}</span>}
                            <time className="mt-1 block text-[12px] leading-4 text-fg-muted">{timeAgo(n.createdAt)}</time>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Account */}
            <div className="relative" ref={profileRef}>
              <button type="button"
                onClick={() => { setOpenProfile(!openProfile); setOpenNotif(false); }}
                aria-label="Account menu" aria-expanded={openProfile} aria-haspopup="menu"
                className="ml-1 inline-flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-2 rounded hover:bg-surface-muted transition-colors">
                <Avatar src={user?.avatar} name={user?.name} className="w-8 h-8 rounded-full object-cover" />
                <span className="hidden md:block text-left max-w-[160px]">
                  <span className="block text-[13px] leading-4 font-medium text-fg truncate">{user?.name}</span>
                  <span className="block text-[12px] leading-4 text-fg-muted truncate capitalize">{user?.role === "admin" ? "Course Coordinator" : String(user?.role || "").replace(/_/g, " ")}</span>
                </span>
              </button>
              {openProfile && (
                <div role="menu" aria-label="Account"
                  className="absolute right-0 mt-2 w-64 bg-surface-elevated border border-line rounded-lg shadow-pop overflow-hidden z-50"
                  style={{ animation: "aust-fade 150ms ease-out both" }}>
                  <div className="px-4 py-3 border-b border-line">
                    <p className="text-[14px] font-semibold text-fg truncate">{user?.name}</p>
                    {user?.email && <p className="text-[13px] text-fg-muted truncate">{user.email}</p>}
                  </div>
                  <div className="p-1">
                    <Link role="menuitem" to={`/${role}/settings`} onClick={() => setOpenProfile(false)} className="flex items-center gap-2.5 h-10 px-3 rounded text-[14px] text-fg hover:bg-surface-muted">
                      <Settings size={15} aria-hidden="true" /> Profile &amp; settings
                    </Link>
                    <div className="sm:hidden flex items-center justify-between h-10 px-3 text-[14px] text-fg">
                      <span>Theme</span><ThemeToggle />
                    </div>
                    <button role="menuitem" type="button"
                      onClick={() => { logout(); navigate("/login"); }}
                      className="w-full flex items-center gap-2.5 h-10 px-3 rounded text-[14px] text-bad hover:bg-bad-soft">
                      <LogOut size={15} aria-hidden="true" /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Go-to palette (client-side navigation only; no backend search exists) */}
      {openSearch && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[12dvh]" style={{ animation: "aust-fade-only 150ms ease-out both" }}>
          <div className="absolute inset-0 bg-[rgb(11_15_20/0.5)]" onClick={() => setOpenSearch(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Go to" className="relative w-full max-w-xl bg-surface-elevated border border-line rounded-3xl shadow-pop overflow-hidden">
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
              <Search size={18} className="text-fg-muted" aria-hidden="true" />
              <input autoFocus type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { navigate(results[0].to); setOpenSearch(false); setQuery(""); } }}
                placeholder="Jump to a page" aria-label="Jump to a page"
                className="flex-1 bg-transparent outline-none text-[15px] text-fg placeholder:text-fg-muted" />
              <kbd className="text-[11px] font-medium text-fg-muted border border-line rounded-sm px-1.5 leading-5">Esc</kbd>
            </div>
            <ul className="p-2">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-[14px] text-fg-muted">No pages match “{query}”.</li>
              ) : results.map((q, i) => (
                <li key={q.to}>
                  <Link to={q.to} onClick={() => { setOpenSearch(false); setQuery(""); }} className="flex items-center justify-between h-10 px-3 rounded text-[14px] text-fg hover:bg-surface-muted">
                    <span>{q.label}</span>
                    {i === 0 ? <CornerDownLeft size={14} className="text-fg-muted" aria-hidden="true" /> : <ChevronRight size={14} className="text-fg-muted" aria-hidden="true" />}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;

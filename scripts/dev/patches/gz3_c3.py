# Change 3: student current semester (dashboard + settings), live.
import sys
# ---- backend
p='backend/src/routes/lms/academic/student.js'
s=open(p).read()
if "router.get('/current-semester'" not in s:
    old="router.get('/profile', asyncHandler(async (req, res) => {"
    assert old in s
    s=s.replace(old,"""// Current semester (read from the database on every call; reflects
// promotions immediately). Shape: { number, label, term, display, status }.
router.get('/current-semester', asyncHandler(async (req, res) => {
  const { currentSemesterOf } = require('../../../services/studentSemesterService');
  res.json({ currentSemester: await currentSemesterOf(req.lmsUser.id) });
}));

"""+old,1)
    open(p,'w').write(s)
# ---- api.js
p='lms-frontend/src/services/api.js'
s=open(p).read()
if 'currentSemester: () =>' not in s:
    old="  scheme: () => get('/lms/academic/student/scheme'),"
    assert old in s
    s=s.replace(old, old+"\n  currentSemester: () => get('/lms/academic/student/current-semester'),",1)
    open(p,'w').write(s)
# ---- shared component
comp='''import { GraduationCap } from "lucide-react";
import useApi from "../../hooks/useApi";
import useRealtime from "../../hooks/useRealtime";
import api from "../../services/api";

/* Student - current semester label, e.g. "Current Semester: 2nd Semester (Spring 2027)".
   Always read from the database; refreshes live when the student is promoted
   or enrolled (existing SSE events), and whenever the tab regains focus. */
export function useCurrentSemester() {
  const { data, reload } = useApi(() => api.student.currentSemester(), []);
  useRealtime(api.student.eventsUrl, { promotion: () => reload(), enrollment: () => reload(), result: () => reload() });
  return data?.currentSemester || null;
}

export default function CurrentSemesterBadge({ variant = "card", label = "Current Semester" }) {
  const cs = useCurrentSemester();
  const text = cs ? cs.display : "—";
  if (variant === "field") {
    return (
      <div data-testid="current-semester-field">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" data-testid="current-semester-value">{text}</p>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2.5 rounded-lg border border-primary-200 dark:border-primary-900 bg-primary-50/70 dark:bg-primary-500/10 px-4 py-2" data-testid="current-semester-card">
      <GraduationCap size={18} className="text-primary-600 shrink-0" aria-hidden="true" />
      <p className="text-[14px] text-fg">
        <span className="font-semibold">{label}:</span> <span data-testid="current-semester-value">{text}</span>
      </p>
    </div>
  );
}
'''
open('lms-frontend/src/components/student/CurrentSemesterBadge.jsx','w').write(comp)
# ---- dashboard
p='lms-frontend/src/pages/student/Dashboard.jsx'
s=open(p).read()
if 'CurrentSemesterBadge' not in s:
    s=s.replace('import { useAuth } from "../../context/AuthContext";','import { useAuth } from "../../context/AuthContext";\nimport CurrentSemesterBadge from "../../components/student/CurrentSemesterBadge";',1)
    old='''            {user?.program ? <span className="hidden sm:inline"> · {user.program}</span> : null}
          </p>'''
    assert old in s
    s=s.replace(old, old+'''
          <div className="mt-4"><CurrentSemesterBadge /></div>''',1)
    open(p,'w').write(s)
# ---- settings
p='lms-frontend/src/pages/student/Settings.jsx'
s=open(p).read()
if 'CurrentSemesterBadge' not in s:
    s=s.replace('import ThemeToggle from "../../components/common/ThemeToggle";','import ThemeToggle from "../../components/common/ThemeToggle";\nimport CurrentSemesterBadge from "../../components/student/CurrentSemesterBadge";',1)
    old='''                    [\"Domicile\", profile?.domicile],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">{label}</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{val || "—"}</p>
                    </div>
                  ))}'''.replace('\\"','"')
    assert old in s, 'settings anchor'
    s=s.replace(old, old+'''
                  <CurrentSemesterBadge variant="field" label="Currently Enrolled Semester" />''',1)
    open(p,'w').write(s)
print('applied')

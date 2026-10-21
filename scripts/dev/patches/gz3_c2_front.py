# Change 2 (results status): Exam Controller Incomplete page gets Incomplete/Complete tabs, live.
import sys
p='lms-frontend/src/pages/exam/Incomplete.jsx'
s=open(p).read()
if 'results-status-tabs' in s: print('already applied'); sys.exit(0)
s=s.replace('import useApi from "../../hooks/useApi";','import useApi from "../../hooks/useApi";\nimport useRealtime from "../../hooks/useRealtime";',1)
old='''  const { data, loading, error, reload } = useApi(() => api.exam.report("incomplete"), []);'''
new='''  const { data, loading, error, reload } = useApi(() => api.exam.report("incomplete"), []);
  // Complete Results - courses whose teacher has submitted (per-course rule).
  const { data: doneData, reload: reloadDone } = useApi(() => api.exam.report("complete"), []);
  const [view, setView] = useState("incomplete");
  // Live: a teacher's submission moves the course from Incomplete to Complete.
  useRealtime(api.coordinator.eventsUrl, { result: () => { reload(); reloadDone(); } });
  const doneRows = useMemo(() => doneData?.rows || [], [doneData]);'''
assert old in s; s=s.replace(old,new)
old2='''  // Department › Program › Semester groups, each with teacher+course rows.'''
new2='''  const doneFiltered = useMemo(() => {
    let list = applyCascade(doneRows, cascade, (r) => ({
      department: r.department, program: r.program, semester: r.semester, session: r.session, batch: r.batch,
    }));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => [r.course, r.teacher].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
    }
    return list;
  }, [doneRows, search, cascade]);

  // Department › Program › Semester groups, each with teacher+course rows.'''
assert old2 in s; s=s.replace(old2,new2)
old3='''          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">'''
new3='''          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mb-2" role="tablist" aria-label="Result status" data-testid="results-status-tabs">
            {[
              ["incomplete", "Incomplete Results", data?.counts?.incomplete ?? courseCount],
              ["complete", "Complete Results", doneData?.counts?.complete ?? doneRows.length],
            ].map(([k, label, n]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} data-testid={`tab-${k}`}
                className={`px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 ${view === k ? "bg-primary-600 text-white" : "text-muted-app hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                {label} <span className={`text-[11px] px-1.5 rounded-full ${view === k ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>{n}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-app mb-4">A course is <b>Complete</b> as soon as its teacher submits the result (even if some students have no marks) and <b>Incomplete</b> until then. A course never appears in both lists.</p>

          {view === "complete" ? (
            <div className="card-base overflow-hidden mb-5" data-testid="complete-results">
              {doneFiltered.length === 0 ? (
                <EmptyState icon="FileWarning" title="No submitted courses yet" description="Courses appear here as soon as their teacher submits the result." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-app">
                      <tr>{["Course", "Teacher", "Program", "Semester", "Students", "Without marks", "Submitted"].map((h) => <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-app">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-app">
                      {doneFiltered.map((r) => (
                        <tr key={r.offeringId} data-testid="complete-row">
                          <td className="px-4 py-2 text-xs font-semibold text-app">{r.course}</td>
                          <td className="px-4 py-2 text-xs text-app">{r.teacher || "—"}</td>
                          <td className="px-4 py-2 text-xs text-app">{r.program || "—"}</td>
                          <td className="px-4 py-2 text-xs text-app">{r.semester || "—"}</td>
                          <td className="px-4 py-2 text-xs text-app">{r.enrolled}</td>
                          <td className="px-4 py-2 text-xs text-muted-app">{r.withoutMarks || 0}</td>
                          <td className="px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          <div className={view === "complete" ? "hidden" : ""}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">'''
assert old3 in s; s=s.replace(old3,new3)
old4='''            </div>
          )}
        </>
      )}

      <Modal'''
assert old4 in s
s=s.replace(old4,'''            </div>
          )}
          </div>
        </>
      )}

      <Modal''')
open(p,'w').write(s); print('applied')

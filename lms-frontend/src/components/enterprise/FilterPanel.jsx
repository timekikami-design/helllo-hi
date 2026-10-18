import { Filter, RotateCcw } from "lucide-react";

/* =========================================================================
 * <FilterPanel /> — universal filter bar used across enterprise pages.
 *
 * Props:
 *   filters: { key, label, options:[{value,label}], value }[]
 *   onChange: (key, value) => void
 *   onReset: () => void
 *   extra?: react-node     (right-side actions like ExportButtons)
 * ======================================================================= */
const FilterPanel = ({ filters = [], onChange, onReset, extra }) => {
  return (
    <div className="card-base p-4 mb-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-end justify-between">
        <div className="flex flex-wrap gap-3 flex-1">
          <div className="flex items-center gap-2 text-fg font-semibold text-[14px]">
            <Filter size={16} className="text-fg-muted" aria-hidden="true" />
            Filters
          </div>
          {filters.filter((f) => f.key !== "section").map((f) => (
            <div key={f.key} className="min-w-[150px] flex-1 sm:flex-initial">
              <label htmlFor={`filter-${f.key}`} className="field-label">
                {f.label}
              </label>
              <select
                id={`filter-${f.key}`}
                value={f.value ?? "all"}
                onChange={(e) => onChange?.(f.key, e.target.value)}
                className="input-base w-full"
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="btn btn-secondary"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
          {extra}
        </div>
      </div>
    </div>
  );
};

/* Helper: build a standard set of LMS filter definitions with sane defaults.
   Pass current values; returned array is ready to feed <FilterPanel />. */
export const buildLmsFilters = (values = {}) => ([
  { key: "semester", label: "Semester", value: values.semester, options: [
    { value: "all", label: "All Semesters" },
    { value: "1", label: "Semester 1" },
    { value: "2", label: "Semester 2" },
    { value: "3", label: "Semester 3" },
    { value: "4", label: "Semester 4" },
  ]},
  { key: "course", label: "Course", value: values.course, options: [
    { value: "all", label: "All Courses" },
    { value: "CS101", label: "CS101 — Introduction to Computing" },
    { value: "CS102", label: "CS102 — Programming Fundamentals" },
    { value: "CS201", label: "CS201 — Object Oriented Programming" },
    { value: "CS202", label: "CS202 — Data Structures" },
    { value: "CS301", label: "CS301 — Database Systems" },
    { value: "CS302", label: "CS302 — Operating Systems" },
    { value: "CS401", label: "CS401 — Web Engineering" },
    { value: "CS402", label: "CS402 — Software Engineering" },
  ]},
  { key: "session", label: "Session", value: values.session, options: [
    { value: "all", label: "All Sessions" },
    { value: "fall-2023", label: "Fall 2023" },
    { value: "spring-2024", label: "Spring 2024" },
    { value: "fall-2024", label: "Fall 2024" },
    { value: "spring-2025", label: "Spring 2025" },
  ]},
  { key: "program", label: "Program", value: values.program, options: [
    { value: "all", label: "All Programs" },
    { value: "ADCS", label: "ADCS — Associate Degree CS" },
    { value: "BSCS", label: "BSCS" },
    { value: "BSSE", label: "BSSE" },
  ]},
]);

export default FilterPanel;

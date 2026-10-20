// Change 9 — one consistent "Passed" / "Failed" label for a course result,
// fed by the backend's shared course-status service (courseStatus field).
// Renders nothing when the course has no declared result yet.
const CourseStatusBadge = ({ status, className = "" }) => {
  if (status !== "PASS" && status !== "FAIL") return null;
  const pass = status === "PASS";
  return (
    <span data-testid="course-status" className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${pass ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"} ${className}`}>
      {pass ? "Passed" : "Failed"}
    </span>
  );
};

export default CourseStatusBadge;

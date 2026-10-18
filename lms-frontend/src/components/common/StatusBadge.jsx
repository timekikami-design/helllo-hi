// lms-frontend/src/components/common/StatusBadge.jsx
// Status is never colour alone: every status gets an icon and its label.
import { Clock, Eye, CheckCircle2, XCircle, Circle, Radio, CalendarClock, Send, AlertTriangle } from "lucide-react";
import Badge from "./Badge";

const STATUS_MAP = {
  Pending: { color: "amber", Icon: Clock },
  "Under Review": { color: "blue", Icon: Eye },
  Approved: { color: "emerald", Icon: CheckCircle2 },
  Rejected: { color: "rose", Icon: XCircle },
  Resolved: { color: "emerald", Icon: CheckCircle2 },
  Active: { color: "emerald", Icon: CheckCircle2 },
  Inactive: { color: "slate", Icon: Circle },
  Live: { color: "rose", Icon: Radio },
  Upcoming: { color: "blue", Icon: CalendarClock },
  Completed: { color: "slate", Icon: CheckCircle2 },
  Submitted: { color: "blue", Icon: Send },
  Graded: { color: "emerald", Icon: CheckCircle2 },
  Late: { color: "rose", Icon: AlertTriangle },
  Overdue: { color: "rose", Icon: AlertTriangle },
};

const StatusBadge = ({ status, size = "md", className = "" }) => {
  const cfg = STATUS_MAP[status] || { color: "slate", Icon: Circle };
  const { Icon } = cfg;
  return (
    <Badge color={cfg.color} size={size} className={className}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      {status}
    </Badge>
  );
};

export default StatusBadge;

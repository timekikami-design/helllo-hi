// lms-frontend/src/components/common/EmptyState.jsx
// Specific, calm empty state with at most one suggested action.
import * as Icons from "lucide-react";

const EmptyState = ({
  icon = "Inbox",
  title = "Nothing here yet",
  description,
  message,
  action,
  actionLabel,
  className = "",
}) => {
  const Icon = Icons[icon] || Icons.Inbox;
  const text = description ?? message ?? "Items will appear here as soon as they are available.";
  return (
    <div role="status" className={`flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-line rounded-lg bg-surface ${className}`}>
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-fg-muted" aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <h3 className="text-sub font-semibold text-fg">{title}</h3>
      {text && <p className="mt-1 max-w-md text-[14px] leading-5 text-fg-muted">{text}</p>}
      {action && (
        <button type="button" onClick={action} className="btn-secondary mt-5">
          {actionLabel || "Continue"}
        </button>
      )}
    </div>
  );
};

export default EmptyState;

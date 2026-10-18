// lms-frontend/src/components/common/ErrorState.jsx
// Recoverable error. Never exposes raw API messages, codes or stacks:
// a technical-looking description is replaced by the standard copy.
import { AlertCircle, RotateCcw, WifiOff } from "lucide-react";

const TECHNICAL = /(request failed|\b[45]\d\d\b|status|stack|undefined|null|TypeError|SyntaxError|fetch|network|JSON|ECONN|prisma|sql)/i;

const ErrorState = ({ title, description, onRetry, className = "" }) => {
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const heading = offline ? "You’re offline" : (title && !TECHNICAL.test(title) ? title : "Something went wrong");
  const body = offline
    ? "Check your internet connection and try again."
    : (description && !TECHNICAL.test(String(description)) ? description : "We couldn’t load this content.");
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <div role="alert" className={`flex flex-col items-center justify-center text-center py-12 px-6 border border-line rounded-lg bg-surface ${className}`}>
      <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bad-soft text-bad" aria-hidden="true">
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <h3 className="text-sub font-semibold text-fg">{heading}</h3>
      <p className="mt-1 max-w-md text-[14px] leading-5 text-fg-muted">{body}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          <RotateCcw size={15} aria-hidden="true" /> Try again
        </button>
      )}
    </div>
  );
};

export default ErrorState;

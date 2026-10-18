// lms-frontend/src/components/common/ErrorBoundary.jsx
// Contains a crash to the region that failed. Shows a calm recovery UI with
// a retry; details go to the console only. `resetKey` (e.g. the route path)
// clears the error when the user navigates elsewhere.
import { Component } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-12 max-w-lg text-center px-6 py-12 border border-line rounded-lg bg-surface">
        <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-bad-soft text-bad" aria-hidden="true">
          <AlertCircle size={18} />
        </span>
        <h2 className="text-sub font-semibold text-fg">This part of the page couldn’t be shown</h2>
        <p className="mt-1 text-[14px] leading-5 text-fg-muted">The rest of the portal is still available. Try again, or go back and reopen this page.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" className="btn-primary" onClick={() => this.setState({ error: null })}>
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
          <button type="button" className="btn-secondary" onClick={() => window.history.back()}>Go back</button>
        </div>
      </div>
    );
  }
}

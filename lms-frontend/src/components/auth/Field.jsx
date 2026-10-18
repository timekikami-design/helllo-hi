// lms-frontend/src/components/auth/Field.jsx
// Form field primitives: visible label, 48px auth inputs, reserved error
// slot (no layout jump), aria-invalid / aria-describedby wiring.
import { useId, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export function Field({ id, label, hint, error, reserve = true, children, right }) {
  const auto = useId();
  const fid = id || auto;
  const errId = `${fid}-error`;
  const hintId = `${fid}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fid} className="field-label">{label}</label>
        {right}
      </div>
      {children({ id: fid, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && <p id={hintId} className="field-help">{hint}</p>}
      {(error || reserve) && (
        <p id={errId} className="field-error" role={error ? "alert" : undefined}>
          {error && <><AlertCircle size={14} className="mt-[3px] shrink-0" aria-hidden="true" />{error}</>}
        </p>
      )}
    </div>
  );
}

export const inputCls = (size = "lg") => `input-base w-full ${size === "lg" ? "!min-h-[48px] !text-[15px]" : ""}`;

/** Password input with a fixed-width show/hide control (E5). */
export function PasswordInput({ inputProps = {}, value, onChange, autoComplete = "current-password", placeholder, size = "lg", ...rest }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        {...inputProps}
        {...rest}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${inputCls(size)} pr-12`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded text-fg-muted hover:text-fg hover:bg-surface-muted"
      >
        <span className="relative h-[18px] w-[18px]" aria-hidden="true">
          <Eye size={18} className={`absolute inset-0 transition-opacity duration-150 ${shown ? "opacity-0" : "opacity-100"}`} />
          <EyeOff size={18} className={`absolute inset-0 transition-opacity duration-150 ${shown ? "opacity-100" : "opacity-0"}`} />
        </span>
      </button>
    </div>
  );
}

/** Primary submit with fixed width, spinner and loading verb (E6). */
export function SubmitButton({ loading, loadingText, children, disabled, className = "" }) {
  return (
    <button type="submit" disabled={loading || disabled} aria-busy={loading || undefined}
      className={`btn-primary btn-lg w-full ${loading ? "!bg-brand !text-brand-on cursor-progress" : ""} ${className}`}>
      {loading ? (
        <>
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
          {loadingText}
        </>
      ) : children}
    </button>
  );
}

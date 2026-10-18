// lms-frontend/src/components/common/NetworkStatus.jsx
// Offline banner: appears when the browser goes offline, keeps the
// already-loaded page intact, and clears itself on reconnection.
import { useEffect, useState } from "react";
import { WifiOff, RotateCcw } from "lucide-react";

export default function NetworkStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="border-b border-line bg-warn-soft text-warn">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 lg:px-8 py-2 text-[14px] leading-5">
        <WifiOff size={16} aria-hidden="true" />
        <span className="font-medium">You’re offline.</span>
        <span className="text-fg-secondary">Check your internet connection and try again. Changes made now are not saved.</span>
        <button type="button" onClick={() => window.location.reload()} className="ml-auto inline-flex items-center gap-1.5 font-medium underline underline-offset-2">
          <RotateCcw size={14} aria-hidden="true" /> Retry
        </button>
      </div>
    </div>
  );
}

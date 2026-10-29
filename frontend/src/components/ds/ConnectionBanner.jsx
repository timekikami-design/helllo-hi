import React, { useEffect, useState } from 'react';
import Icon from './Icon';

/** Small, polite banner shown while the browser reports it is offline. Form input is untouched. */
const ConnectionBanner = () => {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return (
    <div role="status" aria-live="polite">
      {offline && (
        <div className="ds-offline">
          <Icon name="wifiOff" size={18} />
          <span>You're offline. Anything you've typed is kept; we'll reconnect when your connection returns.</span>
        </div>
      )}
    </div>
  );
};

export default ConnectionBanner;

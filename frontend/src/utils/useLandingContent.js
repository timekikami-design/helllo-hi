import { useEffect, useState } from 'react';
import api from './api';
import { LANDING_DEFAULTS } from '../data/landingContent';

/**
 * Same contract as the hook inside pages/Landing.jsx (Change 7): text comes
 * from GET /landing-content, falling back to LANDING_DEFAULTS. Re-fetched on
 * focus, every 20s, and instantly via BroadcastChannel after a Super Admin save.
 */
const useLandingContent = () => {
  const [values, setValues] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/landing-content')
      .then((r) => { if (alive) setValues((r.data && r.data.values) || {}); })
      .catch(() => {});
    load();
    const t = setInterval(load, 20000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    let bc = null;
    try { bc = new BroadcastChannel('aust-landing-content'); bc.onmessage = load; } catch (_) { /* unsupported */ }
    return () => {
      alive = false; clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      if (bc) bc.close();
    };
  }, []);
  return (key) => (values[key] != null && values[key] !== '' ? values[key] : (LANDING_DEFAULTS[key] ?? ''));
};

export default useLandingContent;

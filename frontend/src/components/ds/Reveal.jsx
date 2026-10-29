import React, { useEffect, useRef, useState } from 'react';

/**
 * Fades and lifts its content into view once (IntersectionObserver).
 * CSS disables the effect under prefers-reduced-motion.
 */
const Reveal = ({ as: Tag = 'div', className = '', children, ...rest }) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setInView(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return <Tag ref={ref} className={`ds-reveal${inView ? ' is-in' : ''} ${className}`} {...rest}>{children}</Tag>;
};

export default Reveal;

import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { formatDate } from '../../../data/siteFacts';

/**
 * Full-bleed hero on the REAL AUST campus photograph (no stock/AI images).
 * Copy comes from the Super Admin landing-content store (`c`), and the
 * admissions announcement stays API-driven (`cycle` from /admission-cycle/active).
 * The image is never altered — only cropped/positioned with CSS per breakpoint.
 */
const Hero = ({ c, cycle, cycleState, user, dashHref }) => {
  const customBg = c('hero.backgroundImage');
  return (
    <section className="hx" aria-labelledby="hero-title">
      <div className="hx__media" aria-hidden={customBg ? undefined : 'true'}>
        {customBg ? (
          <img src={customBg} alt="" className="hx__img" width="1280" height="578" fetchpriority="high" decoding="async" />
        ) : (
          <picture>
            <source type="image/webp" srcSet="/assets/hero/aust-dusk-480.webp 480w, /assets/hero/aust-dusk-824.webp 824w, /assets/hero/aust-dusk-1280.webp 1280w, /assets/hero/aust-dusk-1920.webp 1920w, /assets/hero/aust-dusk-2560.webp 2560w" sizes="100vw" />
            <img
              className="hx__img"
              src="/assets/hero/aust-dusk-1920.jpg"
              srcSet="/assets/hero/aust-dusk-480.jpg 480w, /assets/hero/aust-dusk-824.jpg 824w, /assets/hero/aust-dusk-1280.jpg 1280w, /assets/hero/aust-dusk-1920.jpg 1920w, /assets/hero/aust-dusk-2560.jpg 2560w"
              sizes="100vw"
              alt=""
              width="2560" height="1156"
              fetchpriority="high" decoding="async"
            />
          </picture>
        )}
        <div className="hx__shade" />
      </div>

      <div className="ds-container hx__inner">
        <div className="hx__copy">
          <p className="hx__status" aria-live="polite">
            {cycleState === 'ready' && cycle && (
              <>
                <span className={`hx__dot${cycle.isOpen ? '' : ' is-closed'}`} aria-hidden="true" />
                <strong>{cycle.isOpen ? c('hero.badgeOpen') : c('hero.badgeClosed')}</strong>
                <span className="hx__sep" aria-hidden="true">·</span>
                <span>{cycle.title}{cycle.isOpen && cycle.endDate ? `, closing ${formatDate(cycle.endDate)}` : ''}</span>
              </>
            )}
          </p>
          <h1 id="hero-title" className="hx__title">
            {c('hero.titleLine1')}<br />
            <em>{c('hero.titleAccent')}</em>{c('hero.titleEnd')}
          </h1>
          <p className="hx__sub">{c('hero.sub')}</p>
          <div className="hx__cta">
            {user ? (
              <Link to={dashHref(user)} className="ds-btn ds-btn--primary">{c('hero.btnDashboard')} <Icon name="arrowRight" size={18} /></Link>
            ) : (
              <Link to={c('hero.btnApplyLink')} className="ds-btn ds-btn--primary">{c('hero.btnApply')} <Icon name="arrowRight" size={18} /></Link>
            )}
            <Link to="/programs" className="ds-btn hx__ghost">Explore Programs</Link>
          </div>
        </div>
      </div>
      <p className="hx__credit ds-container" aria-hidden="true">Academic block · Havelian campus</p>
    </section>
  );
};

export default Hero;

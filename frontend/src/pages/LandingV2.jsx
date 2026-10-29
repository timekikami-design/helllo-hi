import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import useLandingContent from '../utils/useLandingContent';
import { courseScheme, alumni, stats } from '../data/courseScheme';
import { CONTACT, formatDate, formatPKR } from '../data/siteFacts';
import SiteHeader from '../components/ds/SiteHeader';
import SiteFooterV2 from '../components/ds/SiteFooterV2';
import Reveal from '../components/ds/Reveal';
import Icon from '../components/ds/Icon';
import ProgramsBlock from '../components/ds/landing/ProgramsBlock';
import EnquiryForm from '../components/ds/landing/EnquiryForm';
import '../styles/ds/site.css';

// Surface A — public landing page. Copy comes from the Super Admin
// landing-content store (same keys as the previous page), so the Change 7
// editor keeps working. Missing facts are visible placeholders.

const dashHref = (user) => {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'director_admissions' || user.role === 'admin') return '/admin';
  if (user.role === 'coordinator') return '/coordinator';
  return '/dashboard';
};

const FEATURE_ICONS = ['video', 'library', 'file', 'chart'];

// Already stated on the existing About page.
const RECOGNITION = [
  { title: 'HEC chartered', text: 'Public-sector university under the Higher Education Commission of Pakistan.' },
  { title: 'Quality assured', text: 'An internal quality assurance cell monitors course delivery and assessment.' },
  { title: 'Recognised credentials', text: 'Degrees, diplomas and certificates are accepted nationally.' },
  { title: 'Curriculum mapped to HEC standards', text: 'Courses are reviewed against HEC standards and employer expectations.' },
];

const decode = (s) => String(s || '').replace(/&amp;/g, '&');

const LandingV2 = () => {
  const { user } = useAuth();
  const c = useLandingContent();
  const [cycle, setCycle] = useState(null);
  const [cycleState, setCycleState] = useState('loading');
  const [programNames, setProgramNames] = useState([]);

  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    document.title = 'Abbottabad University of Science & Technology — Open & Distance Learning';
    api.get('/admission-cycle/active')
      .then((r) => { setCycle(r.data.cycle || null); setCycleState(r.data.cycle ? 'ready' : 'none'); })
      .catch(() => setCycleState('error'));
    api.get('/programs').then((r) => setProgramNames((r.data.programs || []).map((p) => p.name))).catch(() => {});
  }, []);

  const heroBg = c('hero.backgroundImage');
  const voices = alumni
    .map((a, i) => ({ name: c(`alumni.${i}.name`), role: c(`alumni.${i}.role`), quote: c(`alumni.${i}.quote`) }))
    .filter((v) => v.quote);

  return (
    <div className="lp">
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {/* Hero */}
        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="ds-container lp-hero__grid">
            <div>
              <p className="lp-hero__status" aria-live="polite">
                {cycleState === 'ready' && cycle && (
                  <>
                    <span className={`lp-hero__dot${cycle.isOpen ? '' : ' is-closed'}`} aria-hidden="true" />
                    <strong>{cycle.isOpen ? c('hero.badgeOpen') : c('hero.badgeClosed')}</strong>
                    <span>{cycle.title}{cycle.isOpen && cycle.endDate ? `, closing ${formatDate(cycle.endDate)}` : ''}</span>
                  </>
                )}
                {cycleState === 'loading' && <span className="ds-skel" style={{ width: '16rem', height: '1rem' }} aria-hidden="true" />}
              </p>
              <h1 id="hero-title">
                {c('hero.titleLine1')}<br />
                <em>{c('hero.titleAccent')}</em>{c('hero.titleEnd')}
              </h1>
              <p className="lp-hero__sub">{c('hero.sub')}</p>
              <div className="lp-hero__cta">
                {user ? (
                  <Link to={dashHref(user)} className="ds-btn ds-btn--primary">{c('hero.btnDashboard')}</Link>
                ) : (
                  <>
                    <Link to={c('hero.btnApplyLink')} className="ds-btn ds-btn--primary">{c('hero.btnApply')} <Icon name="arrowRight" size={18} /></Link>
                    <Link to={c('hero.btnExploreLink')} className="ds-btn ds-btn--ghost">{c('hero.btnExplore')}</Link>
                  </>
                )}
              </div>
            </div>
            <figure className="lp-hero__figure">
              {heroBg ? (
                <img src={heroBg} alt="Abbottabad University of Science and Technology campus" width="1024" height="560" fetchpriority="high" decoding="async" />
              ) : (
                <picture>
                  <source type="image/webp" srcSet="/assets/campus-hero-640.webp 640w, /assets/campus-hero-1024.webp 1024w" sizes="(max-width: 900px) 100vw, 55vw" />
                  <img
                    src="/assets/campus-hero-1024.jpg"
                    srcSet="/assets/campus-hero-640.jpg 640w, /assets/campus-hero-1024.jpg 1024w"
                    sizes="(max-width: 900px) 100vw, 55vw"
                    alt="The red-brick academic block at AUST, Havelian, with its three domes"
                    width="1024" height="560" fetchpriority="high" decoding="async"
                  />
                </picture>
              )}
              <figcaption><span>Academic block, Havelian campus</span><span>{CONTACT.address}</span></figcaption>
            </figure>
          </div>
        </section>

        {/* Quick facts */}
        <section className="lp-facts" aria-label={c('stats.title')}>
          <div className="ds-container">
            <dl>
              {stats.map((s, i) => (
                <div className="lp-facts__item" key={s.label}>
                  <dt>{c(`stats.${i}.label`)}</dt>
                  <dd>{(Number(c(`stats.${i}.num`)) || 0).toLocaleString('en-PK')}{c(`stats.${i}.suffix`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* About */}
        <section className="ds-section" aria-labelledby="about-title">
          <Reveal className="ds-container lp-about">
            <figure className="lp-about__img">
              <picture>
                <source type="image/webp" srcSet="/assets/campus-tall-560.webp" />
                <img src="/assets/campus-tall-560.jpg" alt="Arched entrance and balconies of the AUST academic block" width="560" height="684" loading="lazy" decoding="async" />
              </picture>
            </figure>
            <div>
              <p className="ds-eyebrow">{c('intro.eyebrow')}</p>
              <h2 id="about-title">{c('intro.title')}</h2>
              <p>{c('intro.text')}</p>
              <Link to="/about" className="ds-link">About the university <Icon name="arrowRight" size={16} /></Link>
            </div>
          </Reveal>
        </section>

        {/* Programs + scheme */}
        <section className="ds-section" id="programs" aria-labelledby="programs-title">
          <div className="ds-container">
            <div className="lp-head">
              <div>
                <p className="ds-eyebrow">Programs</p>
                <h2 className="ds-h2" id="programs-title">What you can study this cycle</h2>
              </div>
              <p className="ds-lede">Every program is taught online through the AUST learning portal, with the same assessment standards as on campus.</p>
            </div>
            <ProgramsBlock cycleId={cycle?.id} />
            <Reveal className="lp-scheme" role="group" aria-label={c('scheme.title')}>
              {courseScheme.map((s, si) => (
                <div className="lp-scheme__col" key={s.sem}>
                  <div className="lp-scheme__num" aria-hidden="true">0{s.sem}</div>
                  <h3 className="lp-scheme__title">{c(`scheme.${si}.title`)}</h3>
                  <p className="lp-scheme__hint">{decode(c(`scheme.${si}.hint`))}</p>
                  <ul>
                    {s.courses.map((course, ci) => (
                      <li key={course.name}><span>{c(`scheme.${si}.${ci}.name`)}</span><span>{c(`scheme.${si}.${ci}.credits`)}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </Reveal>
            <p style={{ marginTop: 'var(--s-6)' }}>
              <Link to={c('scheme.buttonLink')} className="ds-link">{c('scheme.button')} <Icon name="arrowRight" size={16} /></Link>
            </p>
          </div>
        </section>

        {/* Admissions */}
        <section className="ds-section" id="admissions" aria-labelledby="adm-title">
          <div className="ds-container">
            <div className="lp-head">
              <div>
                <p className="ds-eyebrow">{c('admission.eyebrow')}</p>
                <h2 className="ds-h2" id="adm-title">{c('admission.title')}</h2>
              </div>
              <p className="ds-lede">{c('admission.sub')}</p>
            </div>
            <div className="lp-adm">
              <ol className="lp-steps">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i}>
                    <span className="lp-steps__n" aria-hidden="true">0{i + 1}</span>
                    <div><h3>{c(`admission.${i}.title`)}</h3><p>{c(`admission.${i}.text`)}</p></div>
                  </li>
                ))}
              </ol>
              <aside className="lp-dates" aria-labelledby="dates-title">
                <h3 id="dates-title">Key dates and fees</h3>
                {cycleState === 'loading' && (
                  <div aria-busy="true">{[0, 1, 2, 3].map((i) => <span key={i} className="ds-skel" style={{ height: '1.1rem', margin: '14px 0' }} />)}</div>
                )}
                {cycleState === 'error' && <p className="ds-help">Dates couldn't be loaded. Please refresh, or call {CONTACT.phone}.</p>}
                {cycleState === 'none' && <p className="ds-help">No admissions cycle is announced yet. Dates appear here as soon as the office publishes them.</p>}
                {cycleState === 'ready' && cycle && (
                  <div className="ds-scroll-x">
                    <table className="ds-table">
                      <caption>{cycle.title}. Dates in Pakistan Standard Time.</caption>
                      <tbody>
                        <tr><th scope="row">Applications open</th><td>{formatDate(cycle.startDate)}</td></tr>
                        <tr><th scope="row">Applications close</th><td>{formatDate(cycle.endDate)}</td></tr>
                        {cycle.applicationFee != null && <tr><th scope="row">Processing fee</th><td>{formatPKR(cycle.applicationFee)}</td></tr>}
                        {cycle.minMarksPercent != null && <tr><th scope="row">Minimum marks</th><td>{cycle.minMarksPercent}% in intermediate</td></tr>}
                        {cycle.matricWeight != null && (
                          <tr><th scope="row">Merit formula</th><td>{cycle.matricWeight}% matric, {cycle.fscWeight}% intermediate, {cycle.interviewWeight}% interview</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <p style={{ marginTop: 'var(--s-4)' }}>
                  <Link to={c('admission.buttonLink')} className="ds-link">{c('admission.button')} <Icon name="arrowRight" size={16} /></Link>
                </p>
              </aside>
            </div>
          </div>
        </section>

        {/* Online learning / campus life */}
        <section className="ds-section lp-deep on-deep" aria-labelledby="odl-title">
          <div className="ds-container lp-deep__grid">
            <div className="lp-deep__intro">
              <p className="ds-eyebrow">{c('lms.eyebrow')}</p>
              <h2 className="ds-h2" id="odl-title">{c('lms.title')}</h2>
              <p>{c('lms.text')}</p>
              <Link to={c('lms.buttonLink')} className="ds-btn ds-btn--ghost">{c('lms.button')}</Link>
            </div>
            <div>
              <figure className="lp-deep__img">
                <picture>
                  <source type="image/webp" srcSet="/assets/campus-wide-824.webp" />
                  <img src="/assets/campus-wide-824.jpg" alt="" width="824" height="330" loading="lazy" decoding="async" />
                </picture>
              </figure>
              <ul className="lp-feat">
                {FEATURE_ICONS.map((icon, i) => (
                  <li key={icon}><Icon name={icon} size={22} /><div><strong>{c(`lms.${i}.title`)}</strong><span>{c(`lms.${i}.text`)}</span></div></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Recognition */}
        <section className="ds-section" aria-labelledby="recog-title">
          <div className="ds-container">
            <div className="lp-head">
              <div>
                <p className="ds-eyebrow">Recognition</p>
                <h2 className="ds-h2" id="recog-title">How the degree is recognised</h2>
              </div>
              <p className="ds-lede">What your qualification carries with it once you graduate.</p>
            </div>
            <ul className="lp-recog">
              {RECOGNITION.map((r) => (
                <li key={r.title}>
                  <span className="lp-recog__meta ds-placeholder">[Add date and source]</span>
                  <div><strong>{r.title}</strong><p>{r.text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Testimonials — only from existing alumni content */}
        {voices.length > 0 && (
          <section className="ds-section" aria-labelledby="voices-title">
            <div className="ds-container">
              <p className="ds-eyebrow">{c('alumni.eyebrow')}</p>
              <h2 className="ds-h2" id="voices-title">{c('alumni.title')}</h2>
              <div className="lp-voices" style={{ marginTop: 'var(--s-6)' }}>
                <blockquote className="lp-voices__lead">
                  <p>{voices[0].quote}</p>
                  <footer><strong>{voices[0].name}</strong>{voices[0].role}</footer>
                </blockquote>
                <div className="lp-voices__side">
                  {voices.slice(1, 3).map((v) => (
                    <blockquote key={v.name}><p>{v.quote}</p><footer><strong>{v.name}</strong>{v.role}</footer></blockquote>
                  ))}
                  <Link to="/alumni" className="ds-link">More graduate stories <Icon name="arrowRight" size={16} /></Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* News + events */}
        <section className="ds-section" aria-labelledby="news-title">
          <div className="ds-container">
            <div className="lp-head">
              <div>
                <p className="ds-eyebrow">{c('news.eyebrow')}</p>
                <h2 className="ds-h2" id="news-title">{c('news.title')}</h2>
              </div>
              <p className="ds-lede">{c('news.sub')}</p>
            </div>
            <div className="lp-news-grid">
              <div>
                <ul className="lp-news">
                  {[0, 1, 2].map((i) => (
                    <li key={i}>
                      <time>{c(`news.${i}.date`)}</time>
                      <div>
                        <span className="lp-news__tag">{c(`news.${i}.tag`)}</span>
                        <h3>{c(`news.${i}.title`)}</h3>
                        <p>{c(`news.${i}.text`)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 'var(--s-4)' }}><Link to={c('news.buttonLink')} className="ds-link">{c('news.button')} <Icon name="arrowRight" size={16} /></Link></p>
              </div>
              <div>
                <h3 style={{ fontSize: 'var(--fs-h4)', margin: '0 0 var(--s-4)' }}>Upcoming events</h3>
                <div className="ds-empty">
                  <p style={{ fontWeight: 600, color: 'var(--c-ink)', marginBottom: 'var(--s-2)' }}>No events are scheduled right now</p>
                  <p>Orientation sessions and open days are listed here with date, time (PKT) and venue as soon as they're announced.</p>
                  <Link to="/news" className="ds-btn ds-btn--ghost">See notices</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="ds-section" aria-labelledby="faq-title">
          <div className="ds-container">
            <p className="ds-eyebrow">{c('faq.eyebrow')}</p>
            <h2 className="ds-h2" id="faq-title">{c('faq.title')}</h2>
            <div className="lp-faq" style={{ marginTop: 'var(--s-6)' }}>
              {[0, 1, 2].map((i) => (
                <details key={i} open={i === 0}>
                  <summary>{c(`faq.${i}.q`)}<Icon name="chevronDown" size={20} /></summary>
                  <p>{c(`faq.${i}.a`)}</p>
                </details>
              ))}
            </div>
            <p style={{ marginTop: 'var(--s-5)' }}><Link to={c('faq.buttonLink')} className="ds-link">{c('faq.button')} <Icon name="arrowRight" size={16} /></Link></p>
          </div>
        </section>

        {/* Enquiry + contact */}
        <section className="ds-section" id="contact" aria-labelledby="enquiry-title">
          <div className="ds-container lp-contact">
            <div>
              <p className="ds-eyebrow">Ask the admissions office</p>
              <h2 className="ds-h2" id="enquiry-title">Questions before you apply?</h2>
              <p className="ds-lede" style={{ marginBottom: 'var(--s-6)' }}>Tell us what you'd like to know. A member of the admissions team reads every message.</p>
              <EnquiryForm programs={programNames} />
            </div>
            <div>
              <ul className="lp-contact__list">
                <li><Icon name="pin" size={20} /><div><span className="k">Address</span>{CONTACT.address}</div></li>
                <li><Icon name="phone" size={20} /><div><span className="k">Phone</span><a href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phone}</a></div></li>
                <li><Icon name="mail" size={20} /><div><span className="k">Email</span><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div></li>
                <li><Icon name="clock" size={20} /><div><span className="k">Office hours</span>{CONTACT.hours}</div></li>
                <li><Icon name="globe" size={20} /><div><span className="k">Social</span><span className="ds-placeholder">[Add official social media links]</span></div></li>
              </ul>
              <a className="lp-map" href={CONTACT.mapUrl} target="_blank" rel="noopener noreferrer">
                <img src="/assets/campus-wide-824.jpg" alt="" width="824" height="330" loading="lazy" decoding="async" />
                <span>Open directions in Google Maps <Icon name="external" size={16} /><span className="ds-sr-only"> (opens in a new tab)</span></span>
              </a>
            </div>
          </div>
        </section>

        {!user && (
          <section className="ds-section lp-deep on-deep" aria-labelledby="cta-title">
            <div className="ds-container lp-head" style={{ marginBottom: 0 }}>
              <h2 className="ds-h2" id="cta-title">{c('cta.title')}</h2>
              <div>
                <p className="ds-lede" style={{ color: 'var(--c-deep-soft)', marginBottom: 'var(--s-5)' }}>{c('cta.text')}</p>
                <div className="lp-hero__cta">
                  <Link to={c('cta.btnPrimaryLink')} className="ds-btn ds-btn--primary">{c('cta.btnPrimary')}</Link>
                  <Link to={c('cta.btnSecondaryLink')} className="ds-btn ds-btn--ghost">{c('cta.btnSecondary')}</Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooterV2 />
    </div>
  );
};

export default LandingV2;

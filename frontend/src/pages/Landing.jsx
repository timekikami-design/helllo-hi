import React, { useEffect, useState, useLayoutEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import SiteNav from '../components/landing/SiteNav';
import SiteFooter from '../components/landing/SiteFooter';
import ParticleField from '../components/landing/ParticleField';
import CountUp from '../components/landing/CountUp';
import { courseScheme, whyChooseUs, alumni, stats } from '../data/courseScheme';
import { LANDING_DEFAULTS } from '../data/landingContent';
import '../styles/landing.css';

// Change 7 — landing text comes from the Super Admin's stored content; any key
// not stored falls back to LANDING_DEFAULTS (the original text), so the page
// is identical until edited. Re-fetched on focus, every 20s, and instantly in
// other tabs of the same browser after a save (BroadcastChannel).
const useLandingContent = () => {
  const [values, setValues] = useState({});
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/landing-content').then((r) => { if (alive) setValues((r.data && r.data.values) || {}); }).catch(() => {});
    load();
    const t = setInterval(load, 20000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    let bc = null;
    try { bc = new BroadcastChannel('aust-landing-content'); bc.onmessage = load; } catch (_) { /* unsupported */ }
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); if (bc) bc.close(); };
  }, []);
  return (key) => (values[key] != null && values[key] !== '' ? values[key] : (LANDING_DEFAULTS[key] ?? ''));
};

const dashHref = (user) => {
  if (!user) return '/login';
  if (user.role === 'director_admissions' || user.role === 'admin') return '/admin';
  if (user.role === 'coordinator') return '/coordinator';
  return '/dashboard';
};

const SemesterRing = () => (
  <>
    <svg viewBox="0 0 100 100" fill="none">
      <circle cx="50" cy="50" r="46" stroke="rgba(29,93,209,0.18)" strokeWidth="1.6" strokeDasharray="3 6" />
    </svg>
    <svg viewBox="0 0 100 100" fill="none" className="rev">
      <circle cx="50" cy="50" r="38" stroke="rgba(56,189,248,0.30)" strokeWidth="1.4" strokeDasharray="2 8" />
    </svg>
  </>
);

const lmsFeatures = [
  ['Live & recorded classes', 'Attend sessions or revisit lectures on demand.', 'fa-video'],
  ['Digital library',         'Access reading material, references and academic resources.', 'fa-book-open-reader'],
  ['Assessment portal',       'Submit assignments, quizzes and examination tasks online.', 'fa-file-pen'],
  ['Progress dashboard',      'Track grades, attendance, deadlines and course milestones.', 'fa-chart-line'],
];

const admissionSteps = [
  ['Create Account',    'Register through the online admission portal.', 'fa-user-plus'],
  ['Select Program',    'Choose your Associate Degree in Computer Science (ADCS) pathway.', 'fa-graduation-cap'],
  ['Upload Documents',  'Submit academic records and identification.',   'fa-file-arrow-up'],
  ['Confirm Admission', 'Receive review updates and complete enrollment.', 'fa-circle-check'],
];

const newsPreview = [
  { date: '2026-05-11', display: 'May 11, 2026', title: 'Spring online orientation released', text: 'Orientation sessions, portal setup and faculty introductions are now live.', tag: 'Orientation' },
  { date: '2026-05-04', display: 'May 4, 2026',  title: 'Digital library access expanded',     text: 'New journals, course packs and research databases for enrolled students.', tag: 'Library' },
  { date: '2026-04-28', display: 'Apr 28, 2026', title: 'Admissions open for ODL pathways',    text: 'Applications are being accepted for the Associate Degree in Computer Science (ADCS).', tag: 'Admissions' },
];

const faqPreview = [
  { q: 'Who is eligible to apply?', a: 'Intermediate (FA/FSc/ICS/I.Com/DAE) with at least 45% aggregate marks. Students from all provinces are welcome.' },
  { q: 'Can I apply if my FSc result is not yet declared?', a: 'Yes. Apply as "Result Awaited" using your Part-I marks and update your full FSc result later from your dashboard.' },
  { q: 'How is merit calculated?', a: 'A transparent weighted score combining academic record, interview marks and admission-cycle weights. The breakdown is shown in your dashboard.' },
];

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(0);
  const c = useLandingContent();
  const heroBg = c('hero.backgroundImage');

  useEffect(() => {
    api.get('/admission-cycle/active')
      .then((r) => setCycle(r.data.cycle))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Defense-in-depth: ensure landing page ALWAYS opens from the top, even if
  // the global ScrollToTop wrapper doesn't fire (e.g. on hard reload).
  useLayoutEffect(() => {
    // Disable browser's automatic scroll restoration on this page
    if ('scrollRestoration' in window.history) {
      const prev = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
      return () => { window.history.scrollRestoration = prev; };
    }
    window.scrollTo(0, 0);
  }, []);



  return (
    <div className="aust-page">
      <SiteNav />

      {/* ===================== HERO (PRESERVED) ===================== */}
      <section className="aust-hero" style={heroBg ? { backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        <ParticleField count={36} />
        <div className="aust-hero__inner aust-fade-in">
            {!loading && cycle && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              marginTop: '1.6rem',
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.20)',
              padding: '8px 18px', borderRadius: 999,
              fontSize: '0.86rem', color: '#fff',
              backdropFilter: 'blur(8px)',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: cycle.isOpen ? '#22c55e' : '#ef4444',
                boxShadow: cycle.isOpen
                  ? '0 0 0 3px rgba(34,197,94,0.25)'
                  : '0 0 0 3px rgba(239,68,68,0.25)',
              }} />
              <strong>{cycle.isOpen ? c('hero.badgeOpen') : c('hero.badgeClosed')}</strong>
              <span style={{ opacity: .7 }}>·</span>
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{cycle.title}</span>
            </div>
          )}
          <h1>
            {c('hero.titleLine1')}<br />
            <span className="accent">{c('hero.titleAccent')}</span>{c('hero.titleEnd')}
          </h1>
          <p className="aust-hero__sub">
            {c('hero.sub')}
          </p>
          <div className="aust-hero__cta">
            {user ? (
              <Link to={dashHref(user)} className="aust-btn-hero primary">
                <i className="fas fa-gauge-high" /> {c('hero.btnDashboard')}
              </Link>
            ) : (
              <>
                <Link to={c('hero.btnApplyLink')} className="aust-btn-hero primary">
                  <i className="fas fa-rocket" /> {c('hero.btnApply')}
                </Link>
                <Link to={c('hero.btnExploreLink')} className="aust-btn-hero outline">
                  <i className="fas fa-book-open" /> {c('hero.btnExplore')}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===================== INTRO STRIP (NEW — merged from AUST RJ) ===================== */}
      <section className="aust-intro-strip">
        <div className="aust-intro-strip__grid">
          <div>
            <div className="aust-section__eyebrow">{c('intro.eyebrow')}</div>
            <h2>{c('intro.title')}</h2>
          </div>
          <p>
            {c('intro.text')}
          </p>
        </div>
      </section>

      {/* ===================== STATS (PRESERVED) ===================== */}
      <section className="aust-section" id="stats">
        <div className="aust-section__eyebrow">{c('stats.eyebrow')}</div>
        <h2 className="aust-section__title">{c('stats.title')}</h2>
        <p className="aust-section__sub">
          {c('stats.sub')}
        </p>
        <div className="aust-stats aust-stagger">
          {stats.map((s, i) => (
            <div key={i} className="aust-stat-card aust-slide-up">
              <div className="ic"><i className={`fas ${s.icon}`} /></div>
              <div className="num">
                <CountUp value={Number(c(`stats.${i}.num`)) || 0} suffix={c(`stats.${i}.suffix`)} duration={1800} />
              </div>
              <div className="lbl">{c(`stats.${i}.label`)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== QUICK LINKS (PRESERVED) ===================== */}
      <section className="aust-section" id="explore">
        <div className="aust-section__eyebrow">{c('explore.eyebrow')}</div>
        <h2 className="aust-section__title">{c('explore.title')}</h2>
        <p className="aust-section__sub">
          {c('explore.sub')}
        </p>
        <div className="aust-quicklinks aust-stagger">
          {['fa-graduation-cap', 'fa-stars', 'fa-user-tie'].map((icon, i) => (
            <Link key={i} to={c(`explore.${i}.to`)} className="aust-quick-card aust-slide-up">
              <div className="ic"><i className={`fas ${icon}`} /></div>
              <h5>{c(`explore.${i}.title`)}</h5>
              <p>{c(`explore.${i}.text`)}</p>
              <span className="arrow">{c(`explore.${i}.link`)} <i className="fas fa-arrow-right" /></span>
            </Link>
          ))}
          <Link to={user ? dashHref(user) : '/register'} className="aust-quick-card aust-slide-up">
            <div className="ic"><i className="fas fa-rocket" /></div>
            <h5>{user ? c('explore.3.titleUser') : c('explore.3.titleGuest')}</h5>
            <p>{user ? c('explore.3.textUser') : c('explore.3.textGuest')}</p>
            <span className="arrow">{user ? c('explore.3.linkUser') : c('explore.3.linkGuest')} <i className="fas fa-arrow-right" /></span>
          </Link>
        </div>
      </section>

      {/* ===================== COURSE SCHEME (PRESERVED) ===================== */}
      <section className="aust-section" id="scheme">
        <div className="aust-section__eyebrow">{c('scheme.eyebrow')}</div>
        <h2 className="aust-section__title">{c('scheme.title')}</h2>
        <p className="aust-section__sub">
          {c('scheme.sub')}
        </p>
        <div className="aust-scheme-wrap aust-stagger">
          {courseScheme.map((s, si) => (
            <article key={s.sem} className="aust-sem-card aust-slide-up">
              <div className="aust-sem-card__ring">
                <SemesterRing />
                <div className="aust-sem-card__num">{s.sem}</div>
              </div>
              <h3 className="aust-sem-card__title">{c(`scheme.${si}.title`)}</h3>
              <div className="aust-sem-card__hint">{c(`scheme.${si}.hint`)}</div>
              <ul className="aust-sem-card__list">
                {s.courses.map((course, ci) => (
                  <li key={course.name}>
                    <span className="ic"><i className={`fas ${course.icon}`} /></span>
                    <span>{c(`scheme.${si}.${ci}.name`)}</span>
                    <span className="credits">{c(`scheme.${si}.${ci}.credits`)}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to={c('scheme.buttonLink')} className="aust-btn-hero primary" style={{ background: 'linear-gradient(135deg, #0b3c8c, #1d5dd1)' }}>
            {c('scheme.button')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </section>

      {/* ===================== WHY CHOOSE US (PRESERVED) ===================== */}
      <section className="aust-section" id="why">
        <div className="aust-section__eyebrow">{c('why.eyebrow')}</div>
        <h2 className="aust-section__title">{c('why.title')}</h2>
        <p className="aust-section__sub">
          {c('why.sub')}
        </p>
        <div className="aust-why-grid aust-stagger">
          {whyChooseUs.map((w, i) => (
            <div key={i} className="aust-why-card aust-slide-up">
              <div className="ic"><i className={`fas ${w.icon}`} /></div>
              <h4>{c(`why.${i}.title`)}</h4>
              <p>{c(`why.${i}.desc`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== ODL / LMS FEATURES (NEW — merged) ===================== */}
      <section className="aust-section--deep" id="odl-preview">
        <div className="aust-info-split aust-info-split--deep">
          <div>
            <div className="aust-section__eyebrow" style={{ textAlign: 'left', color: '#f6b31a' }}>{c('lms.eyebrow')}</div>
            <h2 className="aust-section__title" style={{ textAlign: 'left', color: '#fff', maxWidth: 'none' }}>
              {c('lms.title')}
            </h2>
            <p className="aust-info-paragraph" style={{ color: 'rgba(255,255,255,0.82)' }}>
              {c('lms.text')}
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link to={c('lms.buttonLink')} className="aust-btn-hero outline" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <i className="fas fa-arrow-right" /> {c('lms.button')}
              </Link>
            </div>
          </div>
          <div className="aust-lms-grid">
            {lmsFeatures.map(([title, , icon], i) => (
              <div key={title} className="aust-lms-feature">
                <span className="ic"><i className={`fas ${icon}`} /></span>
                <strong>{c(`lms.${i}.title`)}</strong>
                <small>{c(`lms.${i}.text`)}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== ADMISSION PROCESS (NEW — merged) ===================== */}
      <section className="aust-section" id="admission-preview">
        <div className="aust-section__eyebrow">{c('admission.eyebrow')}</div>
        <h2 className="aust-section__title">{c('admission.title')}</h2>
        <p className="aust-section__sub">
          {c('admission.sub')}
        </p>
        <div className="aust-process-grid aust-stagger">
          {admissionSteps.map(([title, , icon], i) => (
            <article key={title} className="aust-process-card aust-slide-up">
              <div className="aust-process-card__num">0{i + 1}</div>
              <div className="aust-process-card__ic"><i className={`fas ${icon}`} /></div>
              <h3>{c(`admission.${i}.title`)}</h3>
              <p>{c(`admission.${i}.text`)}</p>
            </article>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={c('admission.buttonLink')} className="aust-btn-hero primary">
            {c('admission.button')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </section>

      {/* ===================== ALUMNI / TESTIMONIALS (PRESERVED) ===================== */}
      <section className="aust-section" id="alumni">
        <div className="aust-section__eyebrow">{c('alumni.eyebrow')}</div>
        <h2 className="aust-section__title">{c('alumni.title')}</h2>
        <p className="aust-section__sub">
          {c('alumni.sub')}
        </p>
        <div className="aust-alumni-track-wrap">
          <div className="aust-alumni-track">
            {[...alumni, ...alumni].map((a, i) => {
              const k = i % alumni.length;
              const rating = Math.max(0, Math.min(5, Math.round(Number(c(`alumni.${k}.rating`)) || 0)));
              return (
              <article key={`${a.name}-${i}`} className="aust-alumni-card">
                <header className="aust-alumni-card__head">
                  <div className="aust-alumni-card__avatar">{c(`alumni.${k}.initials`)}</div>
                  <div>
                    <div className="aust-alumni-card__name">{c(`alumni.${k}.name`)}</div>
                    <div className="aust-alumni-card__role">{c(`alumni.${k}.role`)}</div>
                  </div>
                </header>
                <p className="aust-alumni-card__quote">“{c(`alumni.${k}.quote`)}”</p>
                <div className="aust-alumni-card__stars">
                  {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== NEWS PREVIEW (NEW — merged) ===================== */}
      <section className="aust-section" id="news-preview">
        <div className="aust-section__eyebrow">{c('news.eyebrow')}</div>
        <h2 className="aust-section__title">{c('news.title')}</h2>
        <p className="aust-section__sub">
          {c('news.sub')}
        </p>
        <div className="aust-news-preview aust-stagger">
          {newsPreview.map((n, i) => (
            <article key={n.title} className="aust-news-card aust-slide-up">
              <div className="aust-news-card__head">
                <time dateTime={n.date}>{c(`news.${i}.date`)}</time>
                <span className="aust-news-card__tag">{c(`news.${i}.tag`)}</span>
              </div>
              <h3>{c(`news.${i}.title`)}</h3>
              <p>{c(`news.${i}.text`)}</p>
              <Link to={c('news.buttonLink')} className="aust-news-card__read">{c('news.readMore')} <i className="fas fa-arrow-right" /></Link>
            </article>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={c('news.buttonLink')} className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            {c('news.button')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </section>

      {/* ===================== FAQ PREVIEW (NEW — merged) ===================== */}
      <section className="aust-section" id="faq-preview">
        <div className="aust-section__eyebrow">{c('faq.eyebrow')}</div>
        <h2 className="aust-section__title">{c('faq.title')}</h2>
        <p className="aust-section__sub">
          {c('faq.sub')}
        </p>
        <div className="aust-faq-preview">
          {faqPreview.map((f, i) => (
            <button
              type="button"
              key={f.q}
              className={`aust-faq-item${openFaq === i ? ' is-open' : ''}`}
              onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
              aria-expanded={openFaq === i}
            >
              <span className="aust-faq-item__q">
                <i className="fas fa-circle-question" /> {c(`faq.${i}.q`)}
                <i className={`fas fa-chevron-${openFaq === i ? 'up' : 'down'} aust-faq-item__caret`} />
              </span>
              {openFaq === i && <span className="aust-faq-item__a">{c(`faq.${i}.a`)}</span>}
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to={c('faq.buttonLink')} className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            {c('faq.button')} <i className="fas fa-arrow-right" />
          </Link>
        </div>
      </section>

      {/* ===================== CTA BANNER (PRESERVED) ===================== */}
      {!user && (
        <section className="aust-section">
          <div className="aust-cta-banner">
            <h2>{c('cta.title')}</h2>
            <p>
              {c('cta.text')}
            </p>
            <div className="aust-hero__cta">
              <Link to={c('cta.btnPrimaryLink')} className="aust-btn-hero primary">
                <i className="fas fa-user-plus" /> {c('cta.btnPrimary')}
              </Link>
              <Link to={c('cta.btnSecondaryLink')} className="aust-btn-hero outline">
                <i className="fas fa-arrow-right-to-bracket" /> {c('cta.btnSecondary')}
              </Link>
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
};

export default Landing;

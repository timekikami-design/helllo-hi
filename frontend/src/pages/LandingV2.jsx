import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import api from '../utils/api';
import useLandingContent from '../utils/useLandingContent';
import { courseScheme, whyChooseUs, alumni, stats } from '../data/courseScheme';
import {
  feeItems, scholarships, newsItems, notices, downloadFiles, faculties, odlFeatures,
  visionMission, accreditation, aboutText,
} from '../data/publicContent';
import { CONTACT, formatDate, formatPKR } from '../data/siteFacts';
import SiteHeader from '../components/ds/SiteHeader';
import SiteFooterV2 from '../components/ds/SiteFooterV2';
import Reveal from '../components/ds/Reveal';
import Icon from '../components/ds/Icon';
import Hero from '../components/ds/landing/Hero';
import ProgramsBlock from '../components/ds/landing/ProgramsBlock';
import AlumniCarousel from '../components/ds/landing/AlumniCarousel';
import '../styles/ds/site.css';
import '../styles/ds/site-nav.css';
import '../styles/ds/landing2.css';

// ------------------------------------------------------------------
// Surface A — public landing page. Every word and figure below comes
// from content that already exists in the project: the Super Admin
// landing-content store (`c`), the existing public pages (moved to
// data/publicContent.js verbatim) or the live admissions API.
// ------------------------------------------------------------------

const dashHref = (user) => {
  if (!user) return '/login';
  if (user.role === 'super_admin') return '/super-admin';
  if (user.role === 'director_admissions' || user.role === 'admin') return '/admin';
  if (user.role === 'coordinator') return '/coordinator';
  return '/dashboard';
};
const decode = (s) => String(s || '').replace(/&amp;/g, '&');
const ODL_ICONS = { 'fa-video': 'video', 'fa-book-open-reader': 'library', 'fa-file-pen': 'file', 'fa-chart-line': 'chart', 'fa-comments': 'mail', 'fa-headset': 'phone' };

const SectionHead = ({ eyebrow, title, id, lede }) => (
  <div className="lp-head">
    <div>
      <p className="ds-eyebrow">{eyebrow}</p>
      <h2 className="ds-h2" id={id}>{title}</h2>
    </div>
    {lede && <p className="ds-lede">{lede}</p>}
  </div>
);

const LandingV2 = () => {
  const { user } = useAuth();
  const c = useLandingContent();
  const [cycle, setCycle] = useState(null);
  const [cycleState, setCycleState] = useState('loading');

  useLayoutEffect(() => { window.scrollTo(0, 0); }, []);

  // Landing-page-only head tags (restored on unmount, root head untouched).
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'AUST Open & Distance Learning — Abbottabad University of Science & Technology';
    const set = (sel, attr, key, val) => {
      let el = document.head.querySelector(sel);
      const created = !el;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      const prev = el.getAttribute('content');
      el.setAttribute('content', val);
      return () => { if (created) el.remove(); else el.setAttribute('content', prev); };
    };
    const undo = [
      set('meta[name="description"]', 'name', 'description', 'Apply online to Open & Distance Learning programs at Abbottabad University of Science & Technology, Havelian. Admissions, programs, fees, scholarships and the AUST learning portal.'),
      set('meta[property="og:title"]', 'property', 'og:title', 'AUST Open & Distance Learning'),
      set('meta[property="og:image"]', 'property', 'og:image', '/assets/hero/aust-dusk-1280.jpg'),
    ];
    return () => { document.title = prevTitle; undo.forEach((u) => u()); };
  }, []);

  useEffect(() => {
    api.get('/admission-cycle/active')
      .then((r) => { setCycle(r.data.cycle || null); setCycleState(r.data.cycle ? 'ready' : 'none'); })
      .catch(() => setCycleState('error'));
  }, []);

  const voices = alumni
    .map((a, i) => ({ name: c(`alumni.${i}.name`), role: c(`alumni.${i}.role`), quote: c(`alumni.${i}.quote`), initials: c(`alumni.${i}.initials`) }))
    .filter((v) => v.name && v.quote);
  const statItems = stats.map((s, i) => ({ n: Number(c(`stats.${i}.num`)) || 0, suffix: c(`stats.${i}.suffix`), label: c(`stats.${i}.label`) })).filter((s) => s.n > 0 && s.label);

  return (
    <div className="lp lp--hero">
      <SiteHeader overlay />
      <main id="main" tabIndex={-1}>
        {/* 1 Hero */}
        <Hero c={c} cycle={cycle} cycleState={cycleState} user={user} dashHref={dashHref} />

        {/* 2 About AUST */}
        <section className="ds-section" id="about" aria-labelledby="about-title">
          <Reveal className="ds-container lp-about">
            <figure className="lp-about__img">
              <picture>
                <source type="image/webp" srcSet="/assets/campus-about-640.webp 640w, /assets/campus-about-960.webp 960w" sizes="(max-width: 900px) 100vw, 40vw" />
                <img src="/assets/campus-about-960.jpg" srcSet="/assets/campus-about-640.jpg 640w, /assets/campus-about-960.jpg 960w" sizes="(max-width: 900px) 100vw, 40vw" alt="The domed red-brick academic block of AUST in Havelian" width="960" height="768" loading="lazy" decoding="async" />
              </picture>
            </figure>
            <div>
              <p className="ds-eyebrow">{c('intro.eyebrow')}</p>
              <h2 id="about-title">{c('intro.title')}</h2>
              <p>{aboutText[0]}</p>
              <p>{aboutText[1]}</p>
              <Link to="/about" className="ds-link">About the university <Icon name="arrowRight" size={16} /></Link>
            </div>
          </Reveal>
        </section>

        {/* 3 Vision & Mission */}
        <section className="ds-section lx-white" id="vision" aria-labelledby="vision-title">
          <div className="ds-container">
            <SectionHead eyebrow="Direction" title="Vision & Mission" id="vision-title" />
            <Reveal className="lx-vm">
              {visionMission.map((v) => (
                <article key={v.key}>
                  <span className="lx-vm__k">{v.key}</span>
                  <h3>{v.title}</h3>
                  <p>{v.text}</p>
                </article>
              ))}
            </Reveal>
          </div>
        </section>

        {/* 4 Why Choose AUST */}
        <section className="ds-section" id="why" aria-labelledby="why-title">
          <div className="ds-container lx-split">
            <div>
              <p className="ds-eyebrow">{c('why.eyebrow')}</p>
              <h2 className="ds-h2" id="why-title">{c('why.title')}</h2>
              <p className="ds-lede" style={{ marginBottom: 'var(--s-5)' }}>{c('why.sub')}</p>
              <Link to="/why-choose-us" className="ds-link">More reasons <Icon name="arrowRight" size={16} /></Link>
            </div>
            <ul className="lx-why">
              {whyChooseUs.map((w, i) => (
                <li key={w.title}><div><strong>{c(`why.${i}.title`)}</strong><p>{c(`why.${i}.desc`)}</p></div></li>
              ))}
            </ul>
          </div>
        </section>

        {/* 5 Accreditation & Recognition */}
        <section className="ds-section lx-band" id="accreditation" aria-labelledby="recog-title">
          <div className="ds-container">
            <SectionHead eyebrow="Recognition" title="Accreditation & Standards" id="recog-title"
              lede="AUST programs are designed around university standards, guided course plans, and measurable academic outcomes." />
            <ul className="lp-recog">
              {accreditation.map((r) => (
                <li key={r.title}>
                  <span className="lp-recog__meta"><Icon name="shield" size={20} /></span>
                  <div><strong>{r.title}</strong><p>{r.text}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 6 Academic Programs (API) + scheme of study */}
        <section className="ds-section" id="programs" aria-labelledby="programs-title">
          <div className="ds-container">
            <SectionHead eyebrow="Academic Programs" title="What you can study this cycle" id="programs-title" lede={c('scheme.sub')} />
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
            <p style={{ marginTop: 'var(--s-6)' }}><Link to={c('scheme.buttonLink')} className="ds-link">{c('scheme.button')} <Icon name="arrowRight" size={16} /></Link></p>
          </div>
        </section>

        {/* 7 Departments & Facilities */}
        <section className="ds-section lx-white" id="departments" aria-labelledby="dept-title">
          <div className="ds-container">
            <SectionHead eyebrow="Faculties" title="Departments" id="dept-title" lede="Academic units offering programs through Open & Distance Learning." />
            <ul className="lx-fac">
              {faculties.map((f) => (
                <li key={f.name}>
                  <h3>{f.name}</h3>
                  <div>
                    <p>{f.desc}</p>
                    <ul className="lx-fac__deps">{f.departments.map((d) => <li key={d}>{d}</li>)}</ul>
                  </div>
                  <span className={`lx-tag ${f.badge === 'Active' ? 'lx-tag--on' : 'lx-tag--soon'}`}>{f.badge}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 8 Admission Process (+ live dates from the API) */}
        <section className="ds-section" id="admissions" aria-labelledby="adm-title">
          <div className="ds-container">
            <SectionHead eyebrow={c('admission.eyebrow')} title={c('admission.title')} id="adm-title" lede={c('admission.sub')} />
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
                <h3 id="dates-title">Current admissions cycle</h3>
                {cycleState === 'loading' && <div aria-busy="true">{[0, 1, 2].map((i) => <span key={i} className="ds-skel" style={{ height: '1.1rem', margin: '14px 0' }} />)}</div>}
                {cycleState === 'error' && <p className="ds-help">Dates couldn't be loaded right now. Please refresh the page.</p>}
                {cycleState === 'none' && <p className="ds-help">Details will be announced.</p>}
                {cycleState === 'ready' && cycle && (
                  <div className="ds-scroll-x">
                    <table className="ds-table">
                      <caption>{cycle.title}</caption>
                      <tbody>
                        <tr><th scope="row">Applications open</th><td>{formatDate(cycle.startDate)}</td></tr>
                        <tr><th scope="row">Applications close</th><td>{formatDate(cycle.endDate)}</td></tr>
                        {cycle.applicationFee != null && <tr><th scope="row">Processing fee</th><td>{formatPKR(cycle.applicationFee)}</td></tr>}
                        {cycle.matricWeight != null && <tr><th scope="row">Merit formula</th><td>{cycle.matricWeight}% matric, {cycle.fscWeight}% intermediate, {cycle.interviewWeight}% interview</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
                <p style={{ marginTop: 'var(--s-4)' }}><Link to={c('admission.buttonLink')} className="ds-link">{c('admission.button')} <Icon name="arrowRight" size={16} /></Link></p>
              </aside>
            </div>
          </div>
        </section>

        {/* 9 Fee Structure & Scholarships */}
        <section className="ds-section lx-band" id="fees" aria-labelledby="fees-title">
          <div className="ds-container">
            <SectionHead eyebrow="Fees & Financial Support" title="Fee Structure and Scholarships" id="fees-title"
              lede="Final fee amounts for any cycle are announced by the Director Admissions and visible inside your dashboard once admissions open." />
            <div className="lx-split">
              <div className="ds-scroll-x">
                <table className="lx-fees">
                  <caption>Fee structure</caption>
                  <thead><tr><th scope="col">Fee</th><th scope="col">Amount</th><th scope="col">Note</th></tr></thead>
                  <tbody>
                    {feeItems.map((f) => (
                      <tr key={f.label}><th scope="row">{f.label}</th><td className="amt">{f.amount}</td><td className="note">{f.note}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p style={{ marginTop: 'var(--s-4)' }}><Link to="/fee-structure" className="ds-link">Fee structure <Icon name="arrowRight" size={16} /></Link></p>
              </div>
              <div>
                <h3 style={{ fontSize: 'var(--fs-h4)', margin: '0 0 var(--s-2)' }}>Scholarships</h3>
                <ul className="lx-sch">
                  {scholarships.map((s) => (
                    <li key={s.name}><strong>{s.name}</strong><span>{s.amount}</span><p>{s.desc}</p></li>
                  ))}
                </ul>
                <p style={{ marginTop: 'var(--s-4)' }}><Link to="/scholarships" className="ds-link">Scholarships &amp; financial aid <Icon name="arrowRight" size={16} /></Link></p>
              </div>
            </div>
          </div>
        </section>

        {/* 10 ODL Learning Experience + 11 Virtual Classroom */}
        <section className="ds-section lp-deep on-deep" id="odl" aria-labelledby="odl-title">
          <div className="ds-container lp-deep__grid">
            <div className="lp-deep__intro">
              <p className="ds-eyebrow">{c('lms.eyebrow')}</p>
              <h2 className="ds-h2" id="odl-title">{c('lms.title')}</h2>
              <p>{c('lms.text')}</p>
              <div className="lp-hero__cta">
                <Link to={c('lms.buttonLink')} className="ds-btn ds-btn--ghost">{c('lms.button')}</Link>
                <Link to="/odl#virtual" className="ds-btn ds-btn--ghost">Virtual Classroom</Link>
              </div>
            </div>
            <div id="virtual">
              <figure className="lp-deep__img">
                <picture>
                  <source type="image/webp" srcSet="/assets/campus-wide-824.webp" />
                  <img src="/assets/campus-wide-824.jpg" alt="" width="824" height="330" loading="lazy" decoding="async" />
                </picture>
              </figure>
              <ul className="lp-feat">
                {odlFeatures.map((f) => (
                  <li key={f.title}><Icon name={ODL_ICONS[f.icon] || 'check'} size={22} /><div><strong>{f.title}</strong><span>{f.text}</span></div></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 12 Student Success Statistics (existing figures only) */}
        {statItems.length > 0 && (
          <section className="lx-stats on-deep" aria-label={c('stats.title')}>
            <div className="ds-container">
              <dl>
                {statItems.map((s) => (
                  <div key={s.label}><dt>{s.label}</dt><dd>{s.n.toLocaleString('en-PK')}{s.suffix}</dd></div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* 13 Alumni & Graduate Stories */}
        {voices.length > 0 && (
          <section className="ds-section" id="alumni" aria-labelledby="alumni-title">
            <div className="ds-container">
              <AlumniCarousel items={voices} eyebrow={c('alumni.eyebrow')} title={c('alumni.title')} sub={c('alumni.sub').replace(/Hover the track to pause it\.\s*/, '')} />
            </div>
          </section>
        )}

        {/* 14 Graduate Testimonial — pull quote */}
        {voices.length > 1 && (
          <section className="ds-section lx-white" aria-label="Graduate testimonial">
            <div className="ds-container">
              <blockquote className="lx-pull">
                <p>&ldquo;{voices[1].quote}&rdquo;</p>
                <footer><strong>{voices[1].name}</strong> · {voices[1].role}</footer>
              </blockquote>
            </div>
          </section>
        )}

        {/* 15 News & Events + 16 Latest Notices */}
        <section className="ds-section" id="news" aria-labelledby="news-title">
          <div className="ds-container">
            <SectionHead eyebrow={c('news.eyebrow')} title={c('news.title')} id="news-title" lede={c('news.sub')} />
            <div className="lp-news-grid">
              <div>
                <ul className="lp-news">
                  {newsItems.slice(0, 4).map((n) => (
                    <li key={n.title}>
                      <time dateTime={n.date}>{n.display}</time>
                      <div><span className="lp-news__tag">{n.tag}</span><h3>{n.title}</h3><p>{n.text}</p></div>
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 'var(--s-4)' }}><Link to="/news" className="ds-link">{c('news.button')} <Icon name="arrowRight" size={16} /></Link></p>
              </div>
              <div id="notices">
                <h3 style={{ fontSize: 'var(--fs-h4)', margin: '0 0 var(--s-4)' }}>Latest notices</h3>
                <ul className="lx-notice">
                  {notices.map((n) => (
                    <li key={n.title}><time>{n.date}</time><strong>{n.title}</strong><p>{n.text}</p></li>
                  ))}
                </ul>
                <Link to="/news#notices" className="ds-link">All notices <Icon name="arrowRight" size={16} /></Link>
              </div>
            </div>
          </div>
        </section>

        {/* 17 Downloads & Student Resources */}
        <section className="ds-section lx-band" id="downloads" aria-labelledby="dl-title">
          <div className="ds-container">
            <SectionHead eyebrow="Student Resources" title="Downloads" id="dl-title" lede="Prospectus, forms and guides." />
            <ul className="lx-dl">
              {downloadFiles.map((f) => (
                <li key={f.file}>
                  <a href={f.file} download>
                    <Icon name="file" size={22} />
                    <span><strong>{f.name}</strong><small>{f.desc}</small></span>
                    <em>{f.type} · {f.size}</em>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 18 FAQs */}
        <section className="ds-section" id="faq" aria-labelledby="faq-title">
          <div className="ds-container lx-split">
            <div>
              <p className="ds-eyebrow">{c('faq.eyebrow')}</p>
              <h2 className="ds-h2" id="faq-title">{c('faq.title')}</h2>
              <p className="ds-lede" style={{ marginBottom: 'var(--s-5)' }}>{c('faq.sub')}</p>
              <Link to={c('faq.buttonLink')} className="ds-link">{c('faq.button')} <Icon name="arrowRight" size={16} /></Link>
            </div>
            <div className="lp-faq">
              {[0, 1, 2].map((i) => (
                <details key={i} open={i === 0}>
                  <summary>{c(`faq.${i}.q`)}<Icon name="chevronDown" size={20} /></summary>
                  <p>{c(`faq.${i}.a`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 19 Contact (existing details; existing form lives on /contact) */}
        <section className="ds-section lx-white" id="contact" aria-labelledby="contact-title">
          <div className="ds-container lp-contact">
            <div>
              <p className="ds-eyebrow">Contact</p>
              <h2 className="ds-h2" id="contact-title">Get in touch with the admissions office</h2>
              <ul className="lp-contact__list">
                <li><Icon name="pin" size={20} /><div><span className="k">Address</span>{CONTACT.address}</div></li>
                <li><Icon name="phone" size={20} /><div><span className="k">Phone</span><a href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phone}</a></div></li>
                <li><Icon name="mail" size={20} /><div><span className="k">Director Admissions</span><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div></li>
                <li><Icon name="mail" size={20} /><div><span className="k">Coordinator</span><a href={`mailto:${CONTACT.admissionsEmail}`}>{CONTACT.admissionsEmail}</a></div></li>
                <li><Icon name="clock" size={20} /><div><span className="k">Office hours</span>{CONTACT.hours}</div></li>
              </ul>
              <Link to="/contact" className="ds-btn ds-btn--brand">Send a message</Link>
            </div>
            <a className="lp-map" href={CONTACT.mapUrl} target="_blank" rel="noopener noreferrer">
              <img src="/assets/hero/aust-dusk-824.jpg" alt="" width="824" height="372" loading="lazy" decoding="async" />
              <span>Open directions in Google Maps <Icon name="external" size={16} /><span className="ds-sr-only"> (opens in a new tab)</span></span>
            </a>
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
      {/* 20 Footer */}
      <SiteFooterV2 />
    </div>
  );
};

export default LandingV2;

import os
os.chdir('/home/user/webapp/frontend/src/pages')
p='Landing.jsx'; s=open(p).read()
reps=[
("""import { courseScheme, whyChooseUs, alumni, stats } from '../data/courseScheme';
import '../styles/landing.css';""",
"""import { courseScheme, whyChooseUs, alumni, stats } from '../data/courseScheme';
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
};"""),
("""  const [openFaq, setOpenFaq] = useState(0);
""","""  const [openFaq, setOpenFaq] = useState(0);
  const c = useLandingContent();
  const heroBg = c('hero.backgroundImage');
"""),
("""      <section className="aust-hero">""",
"""      <section className="aust-hero" style={heroBg ? { backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>"""),
("""              <strong>{cycle.isOpen ? 'Admissions Open' : 'Admissions Closed'}</strong>""",
"""              <strong>{cycle.isOpen ? c('hero.badgeOpen') : c('hero.badgeClosed')}</strong>"""),
("""            Education is your right,<br />
            <span className="accent">Any Time </span>, <em></em> Anywhere.""",
"""            {c('hero.titleLine1')}<br />
            <span className="accent">{c('hero.titleAccent')}</span>{c('hero.titleEnd')}"""),
("""            Experience a connected digital learning environment designed to support students through every stage of their academic journey.""",
"""            {c('hero.sub')}"""),
("""                <i className="fas fa-gauge-high" /> Open Dashboard""",
"""                <i className="fas fa-gauge-high" /> {c('hero.btnDashboard')}"""),
("""                <Link to="/register" className="aust-btn-hero primary">
                  <i className="fas fa-rocket" /> Apply Now
                </Link>
                <Link to="/course-scheme" className="aust-btn-hero outline">
                  <i className="fas fa-book-open" /> Explore Courses
                </Link>""",
"""                <Link to={c('hero.btnApplyLink')} className="aust-btn-hero primary">
                  <i className="fas fa-rocket" /> {c('hero.btnApply')}
                </Link>
                <Link to={c('hero.btnExploreLink')} className="aust-btn-hero outline">
                  <i className="fas fa-book-open" /> {c('hero.btnExplore')}
                </Link>"""),
("""            <div className="aust-section__eyebrow">Modern ODL Education</div>
            <h2>Flexible diploma, certification and associate degree learning backed by AUST.</h2>
          </div>
          <p>
            AUST ODL connects motivated learners with guided digital classrooms,
            academic mentoring, structured assessments and practical short-cycle
            programs designed for students who need quality education beyond the
            campus boundary.
          </p>""",
"""            <div className="aust-section__eyebrow">{c('intro.eyebrow')}</div>
            <h2>{c('intro.title')}</h2>
          </div>
          <p>
            {c('intro.text')}
          </p>"""),
("""        <div className="aust-section__eyebrow">By the Numbers</div>
        <h2 className="aust-section__title">A growing community of online learners</h2>
        <p className="aust-section__sub">
          Real students from every corner of Pakistan, learning together from home.
        </p>""",
"""        <div className="aust-section__eyebrow">{c('stats.eyebrow')}</div>
        <h2 className="aust-section__title">{c('stats.title')}</h2>
        <p className="aust-section__sub">
          {c('stats.sub')}
        </p>"""),
("""          {stats.map((s) => (
            <div key={s.label} className="aust-stat-card aust-slide-up">
              <div className="ic"><i className={`fas ${s.icon}`} /></div>
              <div className="num">
                <CountUp value={s.num} suffix={s.suffix} duration={1800} />
              </div>
              <div className="lbl">{s.label}</div>""",
"""          {stats.map((s, i) => (
            <div key={i} className="aust-stat-card aust-slide-up">
              <div className="ic"><i className={`fas ${s.icon}`} /></div>
              <div className="num">
                <CountUp value={Number(c(`stats.${i}.num`)) || 0} suffix={c(`stats.${i}.suffix`)} duration={1800} />
              </div>
              <div className="lbl">{c(`stats.${i}.label`)}</div>"""),
("""        <div className="aust-section__eyebrow">Explore the Portal</div>
        <h2 className="aust-section__title">Everything in one calm place</h2>
        <p className="aust-section__sub">
          Apply for admission, browse the scheme of study, hear from alumni and step
          into the learning portal — all from a single, friendly home.
        </p>""",
"""        <div className="aust-section__eyebrow">{c('explore.eyebrow')}</div>
        <h2 className="aust-section__title">{c('explore.title')}</h2>
        <p className="aust-section__sub">
          {c('explore.sub')}
        </p>"""),
("""          <Link to="/course-scheme" className="aust-quick-card aust-slide-up">
            <div className="ic"><i className="fas fa-graduation-cap" /></div>
            <h5>Scheme of Study</h5>
            <p>Four semesters of Associate Degree in Computer Science, mapped out course by course.</p>
            <span className="arrow">View scheme <i className="fas fa-arrow-right" /></span>
          </Link>
          <Link to="/why-choose-us" className="aust-quick-card aust-slide-up">
            <div className="ic"><i className="fas fa-stars" /></div>
            <h5>Why Choose AUST</h5>
            <p>Six reasons learners pick AUST for their online journey, in plain words.</p>
            <span className="arrow">See reasons <i className="fas fa-arrow-right" /></span>
          </Link>
          <Link to="/alumni" className="aust-quick-card aust-slide-up">
            <div className="ic"><i className="fas fa-user-tie" /></div>
            <h5>Alumni Stories</h5>
            <p>Voices from graduates already working as devs, analysts and IT officers.</p>
            <span className="arrow">Read stories <i className="fas fa-arrow-right" /></span>
          </Link>
          <Link to={user ? dashHref(user) : '/register'} className="aust-quick-card aust-slide-up">
            <div className="ic"><i className="fas fa-rocket" /></div>
            <h5>{user ? 'Your Dashboard' : 'Apply Now'}</h5>
            <p>{user ? 'Pick up where you left off and continue your application.' : 'Set up an account in under a minute and submit your application.'}</p>
            <span className="arrow">{user ? 'Open dashboard' : 'Get started'} <i className="fas fa-arrow-right" /></span>
          </Link>""",
"""          {['fa-graduation-cap', 'fa-stars', 'fa-user-tie'].map((icon, i) => (
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
          </Link>"""),
("""        <div className="aust-section__eyebrow">Scheme of Study</div>
        <h2 className="aust-section__title">Four semesters, gently paced</h2>
        <p className="aust-section__sub">
          The Associate Degree in Computer Science program is split across two academic years.
          Hover any card to see it lift, breathe and bring its courses forward.
        </p>""",
"""        <div className="aust-section__eyebrow">{c('scheme.eyebrow')}</div>
        <h2 className="aust-section__title">{c('scheme.title')}</h2>
        <p className="aust-section__sub">
          {c('scheme.sub')}
        </p>"""),
("""          {courseScheme.map((s) => (
            <article key={s.sem} className="aust-sem-card aust-slide-up">""",
"""          {courseScheme.map((s, si) => (
            <article key={s.sem} className="aust-sem-card aust-slide-up">"""),
("""              <h3 className="aust-sem-card__title">{s.title}</h3>
              <div
                className="aust-sem-card__hint"
                dangerouslySetInnerHTML={{ __html: s.hint }}
              />
              <ul className="aust-sem-card__list">
                {s.courses.map((c) => (
                  <li key={c.name}>
                    <span className="ic"><i className={`fas ${c.icon}`} /></span>
                    <span>{c.name}</span>
                    <span className="credits">{c.credits}</span>
                  </li>
                ))}""",
"""              <h3 className="aust-sem-card__title">{c(`scheme.${si}.title`)}</h3>
              <div className="aust-sem-card__hint">{c(`scheme.${si}.hint`)}</div>
              <ul className="aust-sem-card__list">
                {s.courses.map((course, ci) => (
                  <li key={course.name}>
                    <span className="ic"><i className={`fas ${course.icon}`} /></span>
                    <span>{c(`scheme.${si}.${ci}.name`)}</span>
                    <span className="credits">{c(`scheme.${si}.${ci}.credits`)}</span>
                  </li>
                ))}"""),
("""          <Link to="/course-scheme" className="aust-btn-hero primary" style={{ background: 'linear-gradient(135deg, #0b3c8c, #1d5dd1)' }}>
            View full scheme of study <i className="fas fa-arrow-right" />""",
"""          <Link to={c('scheme.buttonLink')} className="aust-btn-hero primary" style={{ background: 'linear-gradient(135deg, #0b3c8c, #1d5dd1)' }}>
            {c('scheme.button')} <i className="fas fa-arrow-right" />"""),
("""        <div className="aust-section__eyebrow">Why Choose AUST</div>
        <h2 className="aust-section__title">Built around how you actually study</h2>
        <p className="aust-section__sub">
          Honest, practical reasons our students keep choosing us — no buzzwords.
        </p>
        <div className="aust-why-grid aust-stagger">
          {whyChooseUs.map((w) => (
            <div key={w.title} className="aust-why-card aust-slide-up">
              <div className="ic"><i className={`fas ${w.icon}`} /></div>
              <h4>{w.title}</h4>
              <p>{w.desc}</p>""",
"""        <div className="aust-section__eyebrow">{c('why.eyebrow')}</div>
        <h2 className="aust-section__title">{c('why.title')}</h2>
        <p className="aust-section__sub">
          {c('why.sub')}
        </p>
        <div className="aust-why-grid aust-stagger">
          {whyChooseUs.map((w, i) => (
            <div key={i} className="aust-why-card aust-slide-up">
              <div className="ic"><i className={`fas ${w.icon}`} /></div>
              <h4>{c(`why.${i}.title`)}</h4>
              <p>{c(`why.${i}.desc`)}</p>"""),
("""            <div className="aust-section__eyebrow" style={{ textAlign: 'left', color: '#f6b31a' }}>Learning Management System</div>
            <h2 className="aust-section__title" style={{ textAlign: 'left', color: '#fff', maxWidth: 'none' }}>
              A complete digital campus in one platform
            </h2>
            <p className="aust-info-paragraph" style={{ color: 'rgba(255,255,255,0.82)' }}>
              The AUST ODL learning environment brings course content, lectures,
              academic communication, assessments and results into a single connected
              experience.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link to="/odl" className="aust-btn-hero outline" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <i className="fas fa-arrow-right" /> Explore ODL""",
"""            <div className="aust-section__eyebrow" style={{ textAlign: 'left', color: '#f6b31a' }}>{c('lms.eyebrow')}</div>
            <h2 className="aust-section__title" style={{ textAlign: 'left', color: '#fff', maxWidth: 'none' }}>
              {c('lms.title')}
            </h2>
            <p className="aust-info-paragraph" style={{ color: 'rgba(255,255,255,0.82)' }}>
              {c('lms.text')}
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Link to={c('lms.buttonLink')} className="aust-btn-hero outline" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <i className="fas fa-arrow-right" /> {c('lms.button')}"""),
("""            {lmsFeatures.map(([title, text, icon]) => (
              <div key={title} className="aust-lms-feature">
                <span className="ic"><i className={`fas ${icon}`} /></span>
                <strong>{title}</strong>
                <small>{text}</small>""",
"""            {lmsFeatures.map(([title, , icon], i) => (
              <div key={title} className="aust-lms-feature">
                <span className="ic"><i className={`fas ${icon}`} /></span>
                <strong>{c(`lms.${i}.title`)}</strong>
                <small>{c(`lms.${i}.text`)}</small>"""),
("""        <div className="aust-section__eyebrow">Admission Process</div>
        <h2 className="aust-section__title">Apply online in four clear steps</h2>
        <p className="aust-section__sub">
          From registration to enrollment — your full admission journey on one screen.
        </p>
        <div className="aust-process-grid aust-stagger">
          {admissionSteps.map(([title, text, icon], i) => (
            <article key={title} className="aust-process-card aust-slide-up">
              <div className="aust-process-card__num">0{i + 1}</div>
              <div className="aust-process-card__ic"><i className={`fas ${icon}`} /></div>
              <h3>{title}</h3>
              <p>{text}</p>""",
"""        <div className="aust-section__eyebrow">{c('admission.eyebrow')}</div>
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
              <p>{c(`admission.${i}.text`)}</p>"""),
("""          <Link to="/admissions" className="aust-btn-hero primary">
            See full admission process <i className="fas fa-arrow-right" />""",
"""          <Link to={c('admission.buttonLink')} className="aust-btn-hero primary">
            {c('admission.button')} <i className="fas fa-arrow-right" />"""),
("""        <div className="aust-section__eyebrow">Alumni Voices</div>
        <h2 className="aust-section__title">Real stories from real graduates</h2>
        <p className="aust-section__sub">
          Hover the track to pause it. These are the students who walked the
          same path you are about to start.
        </p>""",
"""        <div className="aust-section__eyebrow">{c('alumni.eyebrow')}</div>
        <h2 className="aust-section__title">{c('alumni.title')}</h2>
        <p className="aust-section__sub">
          {c('alumni.sub')}
        </p>"""),
("""            {[...alumni, ...alumni].map((a, i) => (
              <article key={`${a.name}-${i}`} className="aust-alumni-card">
                <header className="aust-alumni-card__head">
                  <div className="aust-alumni-card__avatar">{a.initials}</div>
                  <div>
                    <div className="aust-alumni-card__name">{a.name}</div>
                    <div className="aust-alumni-card__role">{a.role}</div>
                  </div>
                </header>
                <p className="aust-alumni-card__quote">“{a.quote}”</p>
                <div className="aust-alumni-card__stars">
                  {'★'.repeat(a.rating)}{'☆'.repeat(5 - a.rating)}""",
"""            {[...alumni, ...alumni].map((a, i) => {
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
                  {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}"""),
("""                </div>
              </article>
            ))}
          </div>
        </div>
      </section>""",
"""                </div>
              </article>
              );
            })}
          </div>
        </div>
      </section>"""),
("""        <div className="aust-section__eyebrow">Latest News &amp; Announcements</div>
        <h2 className="aust-section__title">Stay connected with AUST ODL</h2>
        <p className="aust-section__sub">
          Quick updates from the admissions office, academic departments and the LMS team.
        </p>
        <div className="aust-news-preview aust-stagger">
          {newsPreview.map((n) => (
            <article key={n.title} className="aust-news-card aust-slide-up">
              <div className="aust-news-card__head">
                <time dateTime={n.date}>{n.display}</time>
                <span className="aust-news-card__tag">{n.tag}</span>
              </div>
              <h3>{n.title}</h3>
              <p>{n.text}</p>
              <Link to="/news" className="aust-news-card__read">Read more <i className="fas fa-arrow-right" /></Link>""",
"""        <div className="aust-section__eyebrow">{c('news.eyebrow')}</div>
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
              <Link to={c('news.buttonLink')} className="aust-news-card__read">{c('news.readMore')} <i className="fas fa-arrow-right" /></Link>"""),
("""          <Link to="/news" className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            All news &amp; events <i className="fas fa-arrow-right" />""",
"""          <Link to={c('news.buttonLink')} className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            {c('news.button')} <i className="fas fa-arrow-right" />"""),
("""        <div className="aust-section__eyebrow">Frequently Asked</div>
        <h2 className="aust-section__title">Quick answers, before you apply</h2>
        <p className="aust-section__sub">
          A short list of the questions students ask most often — full list on our FAQ page.
        </p>""",
"""        <div className="aust-section__eyebrow">{c('faq.eyebrow')}</div>
        <h2 className="aust-section__title">{c('faq.title')}</h2>
        <p className="aust-section__sub">
          {c('faq.sub')}
        </p>"""),
("""                <i className="fas fa-circle-question" /> {f.q}""",
"""                <i className="fas fa-circle-question" /> {c(`faq.${i}.q`)}"""),
("""              {openFaq === i && <span className="aust-faq-item__a">{f.a}</span>}""",
"""              {openFaq === i && <span className="aust-faq-item__a">{c(`faq.${i}.a`)}</span>}"""),
("""          <Link to="/faq" className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            View all FAQs <i className="fas fa-arrow-right" />""",
"""          <Link to={c('faq.buttonLink')} className="aust-btn-hero outline" style={{ color: '#0b3c8c', borderColor: '#0b3c8c', background: '#fff' }}>
            {c('faq.button')} <i className="fas fa-arrow-right" />"""),
("""            <h2>Ready to start your AUST journey?</h2>
            <p>
              Create your student account in under a minute. Submit your
              application, track its progress, and get your roll number when you
              are accepted. We will be here every step.
            </p>
            <div className="aust-hero__cta">
              <Link to="/register" className="aust-btn-hero primary">
                <i className="fas fa-user-plus" /> Create Account
              </Link>
              <Link to="/login" className="aust-btn-hero outline">
                <i className="fas fa-arrow-right-to-bracket" /> Sign In""",
"""            <h2>{c('cta.title')}</h2>
            <p>
              {c('cta.text')}
            </p>
            <div className="aust-hero__cta">
              <Link to={c('cta.btnPrimaryLink')} className="aust-btn-hero primary">
                <i className="fas fa-user-plus" /> {c('cta.btnPrimary')}
              </Link>
              <Link to={c('cta.btnSecondaryLink')} className="aust-btn-hero outline">
                <i className="fas fa-arrow-right-to-bracket" /> {c('cta.btnSecondary')}"""),
]
for a,b in reps:
    assert s.count(a)==1, a[:70]; s=s.replace(a,b)
open(p,'w').write(s)
print('landing done')

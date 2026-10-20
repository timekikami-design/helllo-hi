// ============================================================
//  Change 7 — LANDING PAGE CONTENT: defaults + editor structure.
//  Every default below is the text the landing page showed before this
//  change, so the page looks identical until the Super Admin edits it.
//  The live page reads overrides from GET /api/landing-content.
// ============================================================
import { courseScheme, whyChooseUs, alumni, stats } from './courseScheme';

const decode = (s) => String(s).replace(/&amp;/g, '&');
const F = (key, label, def, type = 'text') => ({ key, label, def, type });

const lmsFeatures = [
  ['Live & recorded classes', 'Attend sessions or revisit lectures on demand.'],
  ['Digital library', 'Access reading material, references and academic resources.'],
  ['Assessment portal', 'Submit assignments, quizzes and examination tasks online.'],
  ['Progress dashboard', 'Track grades, attendance, deadlines and course milestones.'],
];
const admissionSteps = [
  ['Create Account', 'Register through the online admission portal.'],
  ['Select Program', 'Choose your Associate Degree in Computer Science (ADCS) pathway.'],
  ['Upload Documents', 'Submit academic records and identification.'],
  ['Confirm Admission', 'Receive review updates and complete enrollment.'],
];
const newsPreview = [
  { display: 'May 11, 2026', title: 'Spring online orientation released', text: 'Orientation sessions, portal setup and faculty introductions are now live.', tag: 'Orientation' },
  { display: 'May 4, 2026', title: 'Digital library access expanded', text: 'New journals, course packs and research databases for enrolled students.', tag: 'Library' },
  { display: 'Apr 28, 2026', title: 'Admissions open for ODL pathways', text: 'Applications are being accepted for the Associate Degree in Computer Science (ADCS).', tag: 'Admissions' },
];
const faqPreview = [
  { q: 'Who is eligible to apply?', a: 'Intermediate (FA/FSc/ICS/I.Com/DAE) with at least 45% aggregate marks. Students from all provinces are welcome.' },
  { q: 'Can I apply if my FSc result is not yet declared?', a: 'Yes. Apply as "Result Awaited" using your Part-I marks and update your full FSc result later from your dashboard.' },
  { q: 'How is merit calculated?', a: 'A transparent weighted score combining academic record, interview marks and admission-cycle weights. The breakdown is shown in your dashboard.' },
];
const quickLinks = [
  { title: 'Scheme of Study', text: 'Four semesters of Associate Degree in Computer Science, mapped out course by course.', link: 'View scheme', to: '/course-scheme' },
  { title: 'Why Choose AUST', text: 'Six reasons learners pick AUST for their online journey, in plain words.', link: 'See reasons', to: '/why-choose-us' },
  { title: 'Alumni Stories', text: 'Voices from graduates already working as devs, analysts and IT officers.', link: 'Read stories', to: '/alumni' },
];

export const LANDING_SECTIONS = [
  { id: 'hero', title: 'Hero banner', fields: [
    F('hero.badgeOpen', 'Admissions badge (open)', 'Admissions Open'),
    F('hero.badgeClosed', 'Admissions badge (closed)', 'Admissions Closed'),
    F('hero.titleLine1', 'Heading — line 1', 'Education is your right,'),
    F('hero.titleAccent', 'Heading — highlighted words', 'Any Time '),
    F('hero.titleEnd', 'Heading — ending', ', Anywhere.'),
    F('hero.sub', 'Sub-heading', 'Experience a connected digital learning environment designed to support students through every stage of their academic journey.', 'textarea'),
    F('hero.btnDashboard', 'Button — signed in', 'Open Dashboard'),
    F('hero.btnApply', 'Button — Apply', 'Apply Now'),
    F('hero.btnApplyLink', 'Button — Apply link', '/register', 'url'),
    F('hero.btnExplore', 'Button — Explore', 'Explore Courses'),
    F('hero.btnExploreLink', 'Button — Explore link', '/course-scheme', 'url'),
    F('hero.backgroundImage', 'Background image URL (optional — empty keeps the current design)', '', 'image'),
  ] },
  { id: 'intro', title: 'Intro strip', fields: [
    F('intro.eyebrow', 'Eyebrow', 'Modern ODL Education'),
    F('intro.title', 'Heading', 'Flexible diploma, certification and associate degree learning backed by AUST.', 'textarea'),
    F('intro.text', 'Paragraph', 'AUST ODL connects motivated learners with guided digital classrooms, academic mentoring, structured assessments and practical short-cycle programs designed for students who need quality education beyond the campus boundary.', 'textarea'),
  ] },
  { id: 'stats', title: 'Statistics', fields: [
    F('stats.eyebrow', 'Eyebrow', 'By the Numbers'),
    F('stats.title', 'Heading', 'A growing community of online learners'),
    F('stats.sub', 'Sub-heading', 'Real students from every corner of Pakistan, learning together from home.', 'textarea'),
    ...stats.flatMap((s, i) => [
      F(`stats.${i}.num`, `Statistic ${i + 1} — number`, String(s.num), 'number'),
      F(`stats.${i}.suffix`, `Statistic ${i + 1} — suffix`, s.suffix),
      F(`stats.${i}.label`, `Statistic ${i + 1} — label`, s.label),
    ]),
  ] },
  { id: 'explore', title: 'Explore the portal (quick links)', fields: [
    F('explore.eyebrow', 'Eyebrow', 'Explore the Portal'),
    F('explore.title', 'Heading', 'Everything in one calm place'),
    F('explore.sub', 'Sub-heading', 'Apply for admission, browse the scheme of study, hear from alumni and step into the learning portal — all from a single, friendly home.', 'textarea'),
    ...quickLinks.flatMap((q, i) => [
      F(`explore.${i}.title`, `Card ${i + 1} — title`, q.title),
      F(`explore.${i}.text`, `Card ${i + 1} — text`, q.text, 'textarea'),
      F(`explore.${i}.link`, `Card ${i + 1} — link label`, q.link),
      F(`explore.${i}.to`, `Card ${i + 1} — link URL`, q.to, 'url'),
    ]),
    F('explore.3.titleGuest', 'Card 4 — title (visitor)', 'Apply Now'),
    F('explore.3.textGuest', 'Card 4 — text (visitor)', 'Set up an account in under a minute and submit your application.', 'textarea'),
    F('explore.3.linkGuest', 'Card 4 — link label (visitor)', 'Get started'),
    F('explore.3.titleUser', 'Card 4 — title (signed in)', 'Your Dashboard'),
    F('explore.3.textUser', 'Card 4 — text (signed in)', 'Pick up where you left off and continue your application.', 'textarea'),
    F('explore.3.linkUser', 'Card 4 — link label (signed in)', 'Open dashboard'),
  ] },
  { id: 'scheme', title: 'Scheme of study', fields: [
    F('scheme.eyebrow', 'Eyebrow', 'Scheme of Study'),
    F('scheme.title', 'Heading', 'Four semesters, gently paced'),
    F('scheme.sub', 'Sub-heading', 'The Associate Degree in Computer Science program is split across two academic years. Hover any card to see it lift, breathe and bring its courses forward.', 'textarea'),
    ...courseScheme.flatMap((s, i) => [
      F(`scheme.${i}.title`, `Semester ${s.sem} — title`, s.title),
      F(`scheme.${i}.hint`, `Semester ${s.sem} — hint`, decode(s.hint)),
      ...s.courses.flatMap((c, j) => [
        F(`scheme.${i}.${j}.name`, `Semester ${s.sem} · course ${j + 1} — name`, c.name),
        F(`scheme.${i}.${j}.credits`, `Semester ${s.sem} · course ${j + 1} — credits`, c.credits),
      ]),
    ]),
    F('scheme.button', 'Button label', 'View full scheme of study'),
    F('scheme.buttonLink', 'Button link', '/course-scheme', 'url'),
  ] },
  { id: 'why', title: 'Why choose AUST', fields: [
    F('why.eyebrow', 'Eyebrow', 'Why Choose AUST'),
    F('why.title', 'Heading', 'Built around how you actually study'),
    F('why.sub', 'Sub-heading', 'Honest, practical reasons our students keep choosing us — no buzzwords.', 'textarea'),
    ...whyChooseUs.flatMap((w, i) => [
      F(`why.${i}.title`, `Reason ${i + 1} — title`, w.title),
      F(`why.${i}.desc`, `Reason ${i + 1} — text`, w.desc, 'textarea'),
    ]),
  ] },
  { id: 'lms', title: 'Learning Management System', fields: [
    F('lms.eyebrow', 'Eyebrow', 'Learning Management System'),
    F('lms.title', 'Heading', 'A complete digital campus in one platform'),
    F('lms.text', 'Paragraph', 'The AUST ODL learning environment brings course content, lectures, academic communication, assessments and results into a single connected experience.', 'textarea'),
    F('lms.button', 'Button label', 'Explore ODL'),
    F('lms.buttonLink', 'Button link', '/odl', 'url'),
    ...lmsFeatures.flatMap(([t, d], i) => [
      F(`lms.${i}.title`, `Feature ${i + 1} — title`, t),
      F(`lms.${i}.text`, `Feature ${i + 1} — text`, d, 'textarea'),
    ]),
  ] },
  { id: 'admission', title: 'Admission process', fields: [
    F('admission.eyebrow', 'Eyebrow', 'Admission Process'),
    F('admission.title', 'Heading', 'Apply online in four clear steps'),
    F('admission.sub', 'Sub-heading', 'From registration to enrollment — your full admission journey on one screen.', 'textarea'),
    ...admissionSteps.flatMap(([t, d], i) => [
      F(`admission.${i}.title`, `Step ${i + 1} — title`, t),
      F(`admission.${i}.text`, `Step ${i + 1} — text`, d, 'textarea'),
    ]),
    F('admission.button', 'Button label', 'See full admission process'),
    F('admission.buttonLink', 'Button link', '/admissions', 'url'),
  ] },
  { id: 'alumni', title: 'Alumni voices', fields: [
    F('alumni.eyebrow', 'Eyebrow', 'Alumni Voices'),
    F('alumni.title', 'Heading', 'Real stories from real graduates'),
    F('alumni.sub', 'Sub-heading', 'Hover the track to pause it. These are the students who walked the same path you are about to start.', 'textarea'),
    ...alumni.flatMap((a, i) => [
      F(`alumni.${i}.name`, `Alumnus ${i + 1} — name`, a.name),
      F(`alumni.${i}.initials`, `Alumnus ${i + 1} — initials`, a.initials),
      F(`alumni.${i}.role`, `Alumnus ${i + 1} — role`, a.role),
      F(`alumni.${i}.quote`, `Alumnus ${i + 1} — quote`, a.quote, 'textarea'),
      F(`alumni.${i}.rating`, `Alumnus ${i + 1} — rating (1–5)`, String(a.rating), 'number'),
    ]),
  ] },
  { id: 'news', title: 'News & announcements', fields: [
    F('news.eyebrow', 'Eyebrow', 'Latest News & Announcements'),
    F('news.title', 'Heading', 'Stay connected with AUST ODL'),
    F('news.sub', 'Sub-heading', 'Quick updates from the admissions office, academic departments and the LMS team.', 'textarea'),
    ...newsPreview.flatMap((n, i) => [
      F(`news.${i}.date`, `News ${i + 1} — date`, n.display),
      F(`news.${i}.tag`, `News ${i + 1} — tag`, n.tag),
      F(`news.${i}.title`, `News ${i + 1} — title`, n.title),
      F(`news.${i}.text`, `News ${i + 1} — text`, n.text, 'textarea'),
    ]),
    F('news.readMore', 'Card link label', 'Read more'),
    F('news.button', 'Button label', 'All news & events'),
    F('news.buttonLink', 'Button link', '/news', 'url'),
  ] },
  { id: 'faq', title: 'FAQ preview', fields: [
    F('faq.eyebrow', 'Eyebrow', 'Frequently Asked'),
    F('faq.title', 'Heading', 'Quick answers, before you apply'),
    F('faq.sub', 'Sub-heading', 'A short list of the questions students ask most often — full list on our FAQ page.', 'textarea'),
    ...faqPreview.flatMap((f, i) => [
      F(`faq.${i}.q`, `Question ${i + 1}`, f.q),
      F(`faq.${i}.a`, `Answer ${i + 1}`, f.a, 'textarea'),
    ]),
    F('faq.button', 'Button label', 'View all FAQs'),
    F('faq.buttonLink', 'Button link', '/faq', 'url'),
  ] },
  { id: 'cta', title: 'Call-to-action banner', fields: [
    F('cta.title', 'Heading', 'Ready to start your AUST journey?'),
    F('cta.text', 'Paragraph', 'Create your student account in under a minute. Submit your application, track its progress, and get your roll number when you are accepted. We will be here every step.', 'textarea'),
    F('cta.btnPrimary', 'Primary button', 'Create Account'),
    F('cta.btnPrimaryLink', 'Primary button link', '/register', 'url'),
    F('cta.btnSecondary', 'Secondary button', 'Sign In'),
    F('cta.btnSecondaryLink', 'Secondary button link', '/login', 'url'),
  ] },
];

export const LANDING_DEFAULTS = Object.fromEntries(LANDING_SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f.def])));

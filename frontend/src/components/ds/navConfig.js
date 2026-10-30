// ============================================================
//  Public navigation map. Every `to` is an EXISTING route or an
//  existing on-page anchor (verified in the Phase 0 audit).
//  "Facilities" (Programs menu) has no destination in the project
//  and is intentionally omitted — see the final report.
// ============================================================
export const NAV = [
  { label: 'Home', to: '/' },
  {
    label: 'About', id: 'about',
    items: [
      { label: 'About AUST', to: '/about', desc: 'The university, its campus and its story', icon: 'home' },
      { label: 'Vision & Mission', to: '/about#vision', desc: 'What guides our academic direction', icon: 'globe' },
      { label: 'Accreditation', to: '/about#accred', desc: 'Charter, quality assurance and recognition', icon: 'shield' },
      { label: 'Why Choose AUST', to: '/why-choose-us', desc: 'Practical reasons students choose us', icon: 'check' },
    ],
  },
  {
    label: 'Admissions', id: 'admissions',
    items: [
      { label: 'Apply Online', to: '/register', desc: 'Create your applicant account', icon: 'user' },
      { label: 'Admission Process', to: '/admissions', desc: 'Every step from account to roll number', icon: 'file' },
      { label: 'Fee Structure', to: '/fee-structure', desc: 'Processing and admission fees', icon: 'chart' },
      { label: 'Scholarships', to: '/scholarships', desc: 'Merit and need-based support', icon: 'cap' },
      { label: 'Merit Lists', to: '/admissions#merit', desc: 'How merit is calculated', icon: 'chart' },
    ],
  },
  {
    label: 'Programs', id: 'programs',
    items: [
      { label: 'Academic Programs', to: '/programs', desc: 'Degrees, diplomas and certificates', icon: 'cap' },
      { label: 'Departments', to: '/faculties', desc: 'Faculties and their departments', icon: 'library' },
      { label: 'Scheme of Study', to: '/course-scheme', desc: 'Semester-by-semester course plan', icon: 'book' },
      { label: 'Student Eligibility', to: '/programs#eligibility', desc: 'Who can apply', icon: 'check' },
    ],
  },
  {
    label: 'Online Learning', id: 'odl',
    items: [
      { label: 'ODL Overview', to: '/odl', desc: 'How Open & Distance Learning works', icon: 'globe' },
      { label: 'Virtual Classroom', to: '/odl#virtual', desc: 'Lectures, library and assessments online', icon: 'video' },
    ],
  },
  {
    label: 'Student Life', id: 'student',
    items: [
      { label: 'Alumni', to: '/alumni', desc: 'Where our graduates are now', icon: 'user' },
      { label: 'Graduate Stories', to: '/#alumni', desc: 'In their own words', icon: 'book' },
      { label: 'News & Events', to: '/news', desc: 'Announcements and updates', icon: 'calendar' },
      { label: 'Notices', to: '/news#notices', desc: 'Deadlines and important notices', icon: 'info' },
      { label: 'Downloads', to: '/downloads', desc: 'Prospectus, forms and guides', icon: 'upload' },
      { label: 'FAQs', to: '/faq', desc: 'Answers to common questions', icon: 'info' },
    ],
  },
  { label: 'Contact', to: '/contact' },
];

// Login choices: both are the EXISTING destinations. /lms is the existing
// route that forwards to the separate LMS app (not modified).
export const LOGIN_LINKS = [
  { label: 'Admissions Portal', to: '/login', desc: 'Applicants, admissions staff and coordinators', icon: 'user' },
  { label: 'Learning Management System', to: '/lms', desc: 'Enrolled students and teaching staff', icon: 'book' },
];

export const APPLY_TO = '/register';

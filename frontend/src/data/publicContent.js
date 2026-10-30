// ============================================================
//  Public-site content (moved verbatim from the public pages so the
//  landing page and the sub-pages share ONE source; no text changed).
// ============================================================

// from pages/FeeStructure.jsx
export const feeItems = [
  { label: 'Application Processing Fee', amount: 'PKR 1,200', note: 'One-time, non-refundable. Paid before submitting the application.' },
  { label: 'Admission Fee (Per Semester)', amount: 'PKR 25,000', note: 'Indicative — finalized per admission cycle by Director Admissions.' },
  { label: 'Examination Fee', amount: 'Included', note: 'Included in semester fee for ODL programs.' },
  { label: 'Library / LMS Fee', amount: 'Included', note: 'Digital library & LMS access included with enrollment.' },
];

// from pages/Scholarships.jsx
export const scholarships = [
  { name: 'Merit Scholarship', amount: 'Up to 50% Tuition', desc: 'Awarded to top-ranked students on the finalized merit list each cycle.', icon: 'fa-trophy', tag: 'Merit' },
  { name: 'Need-Based Aid', amount: 'Up to 40% Tuition', desc: 'For students from low-income families demonstrating genuine financial need.', icon: 'fa-hand-holding-heart', tag: 'Need' },
  { name: 'Women in Tech', amount: 'Up to 30% Tuition', desc: 'Encouraging female learners in computing through targeted fee waivers.', icon: 'fa-venus', tag: 'Inclusion' },
  { name: 'Rural Scholar', amount: 'Up to 35% Tuition', desc: 'For students from underserved rural areas of Khyber Pakhtunkhwa and beyond.', icon: 'fa-tractor', tag: 'Access' },
  { name: 'Working Professionals', amount: 'Up to 20% Tuition', desc: 'A modest discount for working students balancing employment with study.', icon: 'fa-briefcase', tag: 'Career' },
  { name: 'Special Needs Support', amount: 'Up to 50% Tuition', desc: 'For applicants with documented special needs or disabilities.', icon: 'fa-wheelchair', tag: 'Inclusion' },
];

// from pages/News.jsx
export const newsItems = [
  { date: '2026-05-11', display: 'May 11, 2026', title: 'Spring online orientation schedule released', text: 'New students can now view orientation sessions, portal setup guidance, and faculty introduction timings.', tag: 'Orientation' },
  { date: '2026-05-04', display: 'May 4, 2026',  title: 'Digital library access expanded',           text: 'Additional journals, course packs and research databases are available for enrolled ODL students.', tag: 'Library' },
  { date: '2026-04-28', display: 'Apr 28, 2026', title: 'Admissions open for ODL pathways',          text: 'Applications are being accepted for the Associate Degree in Computer Science (ADCS) program.', tag: 'Admissions' },
  { date: '2026-04-15', display: 'Apr 15, 2026', title: 'New LMS dashboard preview rolls out',       text: 'Updated student dashboard with live application status and faster notifications.', tag: 'Platform' },
  { date: '2026-04-02', display: 'Apr 2, 2026',  title: 'Online Bank Payment Gateway now live',      text: 'Students can pay processing and admission fees securely online through the bank payment gateway.', tag: 'Payments' },
  { date: '2026-03-20', display: 'Mar 20, 2026', title: 'Faculty office hours updated',              text: 'Revised weekly office hours posted in the LMS for every ADCS instructor.', tag: 'Academics' },
];

// from pages/News.jsx
export const notices = [
  { date: 'May 10, 2026', title: 'Mid-term examination schedule', text: 'Mid-term dates for Spring 2026 published. Check your LMS for paper-wise slots.' },
  { date: 'May 5, 2026',  title: 'Fee deadline reminder',         text: 'Last date to deposit admission fee for newly selected candidates is May 28, 2026.' },
  { date: 'Apr 25, 2026', title: 'Result Awaited submissions',    text: 'Students applying with Part-I result can update full FSc result from their dashboard.' },
];

// from pages/Downloads.jsx
export const downloadFiles = [
  {
    name: 'AUST ODL Prospectus 2026',
    size: '4.2 MB',
    type: 'PDF',
    desc: 'Complete program details, fees and admission criteria.',
    icon: 'fa-file-pdf',
    file: '/downloads/aust-odl-prospectus-2026.pdf',
  },
  {
    name: 'Admission Application Form',
    size: '120 KB',
    type: 'PDF',
    desc: 'Printable application form for offline reference.',
    icon: 'fa-file-pdf',
    file: '/downloads/admission-application-form.pdf',
  },
  {
    name: 'Fee Deposit Slip Template',
    size: '90 KB',
    type: 'PDF',
    desc: 'Bank deposit slip you can print and use at any branch.',
    icon: 'fa-file-pdf',
    file: '/downloads/fee-deposit-slip-template.pdf',
  },
  {
    name: 'ADCS Scheme of Study',
    size: '210 KB',
    type: 'PDF',
    desc: 'Semester-wise course plan with credit hours.',
    icon: 'fa-file-pdf',
    file: '/downloads/adp-cs-scheme-of-study.pdf',
  },
  {
    name: 'Student Handbook',
    size: '1.8 MB',
    type: 'PDF',
    desc: 'Academic regulations, conduct and student services.',
    icon: 'fa-book',
    file: '/downloads/student-handbook.pdf',
  },
  {
    name: 'LMS Quick-Start Guide',
    size: '780 KB',
    type: 'PDF',
    desc: 'How to access lectures, library and submit assignments.',
    icon: 'fa-file-pdf',
    file: '/downloads/lms-quick-start-guide.pdf',
  },
  {
    name: 'Online Examination Guidelines',
    size: '560 KB',
    type: 'PDF',
    desc: 'Rules and best practices for proctored online exams.',
    icon: 'fa-file-pdf',
    file: '/downloads/online-examination-guidelines.pdf',
  },
  {
    name: 'Online Payment Guide',
    size: '320 KB',
    type: 'PDF',
    desc: 'Step-by-step online fee payment instructions (Bank Payment Gateway).',
    icon: 'fa-file-pdf',
    file: '/downloads/online-payment-guide.pdf',
  },
];

// from pages/Faculties.jsx
export const faculties = [
  {
    name: 'Faculty of Computing & Information Sciences',
    desc: 'Software engineering, computer science, IT and data foundations for the next generation of Pakistani technologists.',
    icon: 'fa-laptop-code',
    departments: ['Computer Science', 'Software Engineering', 'Information Technology', 'Data Science'],
    badge: 'Active',
  },
  {
    name: 'Faculty of Business & Management',
    desc: 'Business administration and management programs designed for working professionals and aspiring entrepreneurs.',
    icon: 'fa-briefcase',
    departments: ['Business Administration', 'Management Sciences', 'Commerce'],
    badge: 'Coming Soon',
  },
  {
    name: 'Faculty of Basic & Applied Sciences',
    desc: 'Mathematics, physics and applied sciences that ground every technical career in a strong analytical foundation.',
    icon: 'fa-atom',
    departments: ['Mathematics', 'Physics', 'Statistics'],
    badge: 'Coming Soon',
  },
  {
    name: 'Faculty of Arts & Social Sciences',
    desc: 'Languages, education and social sciences for learners who want a broader academic and professional perspective.',
    icon: 'fa-book-open',
    departments: ['English', 'Education', 'Islamic Studies', 'Pakistan Studies'],
    badge: 'Coming Soon',
  },
];

// from pages/Programs.jsx
export const programCatalog = [
  {
    type: 'Associate Degree',
    title: 'Associate Degree in Computer Science (ADCS)',
    duration: '2 Years · 4 Semesters',
    text: 'Programming fundamentals, databases, software engineering, networks, AI and information security — all paced gently across four semesters.',
    icon: 'fa-laptop-code',
    badge: 'Open',
  },
  {
    type: 'Diploma',
    title: 'Professional Diploma Programs',
    duration: '1 Year',
    text: 'Focused academic and applied learning for students and working professionals. Multiple specializations coming online soon.',
    icon: 'fa-certificate',
    badge: 'Coming Soon',
  },
  {
    type: 'Certification',
    title: 'Short Certificate Courses',
    duration: '8–16 Weeks',
    text: 'Short-cycle skill development in practical, career-relevant subjects. Add a credential to your resume in a single semester.',
    icon: 'fa-award',
    badge: 'Coming Soon',
  },
];

// from pages/ODL.jsx
export const odlFeatures = [
  { title: 'Live & Recorded Classes', text: 'Attend live sessions or revisit recorded lectures on demand.', icon: 'fa-video' },
  { title: 'Digital Library',          text: 'Access reading material, references and academic resources online.', icon: 'fa-book-open-reader' },
  { title: 'Assessment Portal',        text: 'Submit assignments, quizzes and examination tasks online.', icon: 'fa-file-pen' },
  { title: 'Progress Dashboard',       text: 'Track grades, attendance, deadlines and course milestones.', icon: 'fa-chart-line' },
  { title: 'Discussion Forums',        text: 'Talk to classmates and faculty in moderated subject forums.', icon: 'fa-comments' },
  { title: 'Faculty Support',          text: 'Office-hour links, email and ticketed help from your instructors.', icon: 'fa-headset' },
];

// from pages/Admissions.jsx
export const admissionSteps = [
  { n: '01', title: 'Create Account', text: 'Register on the online admission portal with your email and a math captcha.', icon: 'fa-user-plus' },
  { n: '02', title: 'Complete Profile', text: 'Fill in your personal, contact and academic details. Upload your photo and CNIC.', icon: 'fa-id-card' },
  { n: '03', title: 'Add Education Records', text: 'Enter Matric, FSc Part-I, and FSc Full results. Result-awaited applications are also accepted.', icon: 'fa-graduation-cap' },
  { n: '04', title: 'Submit Application', text: 'Choose your program, pay the processing fee (Bank Deposit or online Bank Payment Gateway) and submit.', icon: 'fa-paper-plane' },
  { n: '05', title: 'Interview & Merit', text: 'Coordinator schedules your interview, records marks and merit is auto-calculated.', icon: 'fa-clipboard-list' },
  { n: '06', title: 'Pay Fee & Enroll', text: 'After merit selection, pay the admission fee. You will receive your auto-generated roll number.', icon: 'fa-id-badge' },
];

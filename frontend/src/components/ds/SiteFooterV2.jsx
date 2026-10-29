import React from 'react';
import { Link } from 'react-router-dom';
import { CONTACT } from '../../data/siteFacts';

const COLS = [
  { title: 'Study', links: [['Programs', '/programs'], ['Scheme of study', '/course-scheme'], ['Faculties', '/faculties'], ['Online learning', '/odl'], ['Learning portal (LMS)', '/lms']] },
  { title: 'Admissions', links: [['How to apply', '/admissions'], ['Apply online', '/register'], ['Fee structure', '/fee-structure'], ['Scholarships', '/scholarships'], ['Downloads', '/downloads']] },
  { title: 'University', links: [['About AUST', '/about'], ['Why students choose AUST', '/why-choose-us'], ['Alumni', '/alumni'], ['News', '/news'], ['Questions', '/faq']] },
];

const SiteFooterV2 = () => (
  <footer className="ds-footer on-deep">
    <div className="ds-container">
      <div className="ds-footer__grid">
        <div className="ds-footer__brand">
          <div className="ds-footer__name">Abbottabad University of Science &amp; Technology</div>
          <p>Open &amp; Distance Learning programmes, applied for and studied online.</p>
          <address className="ds-footer__contact">
            <span>{CONTACT.address}</span>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <a href={`tel:${CONTACT.phoneHref}`}>{CONTACT.phone}</a>
            <span>{CONTACT.hours}</span>
          </address>
        </div>
        {COLS.map((col) => (
          <nav key={col.title} className="ds-footer__col" aria-label={col.title}>
            <h2 className="ds-footer__title">{col.title}</h2>
            <ul>
              {col.links.map(([label, to]) => <li key={to}><Link to={to}>{label}</Link></li>)}
            </ul>
          </nav>
        ))}
      </div>
      <div className="ds-footer__bottom">
        <span>© {new Date().getFullYear()} Abbottabad University of Science &amp; Technology</span>
        <span className="ds-footer__legal">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/contact">Contact</Link>
        </span>
      </div>
    </div>
  </footer>
);

export default SiteFooterV2;

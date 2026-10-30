import React from 'react';
import { Link } from 'react-router-dom';
import SiteNav from '../components/landing/SiteNav';
import SiteFooter from '../components/landing/SiteFooter';
import '../styles/landing.css';
import { newsItems as news, notices } from '../data/publicContent';



const News = () => (
  <div className="aust-page">
    <SiteNav />

    <section className="aust-subhero">
      <span className="aust-subhero__crumb"><Link to="/">Home</Link> <i className="fas fa-chevron-right" style={{ fontSize: '0.6rem' }} /> News &amp; Events</span>
      <h1>News, Events &amp; Notices</h1>
      <p>Stay connected with AUST ODL — announcements, deadlines and academic updates.</p>
    </section>

    <section className="aust-section">
      <div className="aust-section__eyebrow">Latest News</div>
      <h2 className="aust-section__title">Recent announcements</h2>
      <p className="aust-section__sub">News from the admissions office, academic departments and the ODL platform.</p>
      <div className="aust-news-grid aust-stagger">
        {news.map((n) => (
          <article key={n.title} className="aust-news-card aust-slide-up">
            <div className="aust-news-card__head">
              <time dateTime={n.date}>{n.display}</time>
              <span className="aust-news-card__tag">{n.tag}</span>
            </div>
            <h3>{n.title}</h3>
            <p>{n.text}</p>
            <span className="aust-news-card__read">Read more <i className="fas fa-arrow-right" /></span>
          </article>
        ))}
      </div>
    </section>

    <section className="aust-section" id="notices">
      <div className="aust-section__eyebrow">Notices</div>
      <h2 className="aust-section__title">Important notifications</h2>
      <p className="aust-section__sub">Time-sensitive academic and admissions notifications.</p>
      <div className="aust-notice-list">
        {notices.map((n) => (
          <div key={n.title} className="aust-notice-row">
            <div className="aust-notice-row__date">
              <i className="fas fa-bullhorn" />
              <span>{n.date}</span>
            </div>
            <div className="aust-notice-row__body">
              <strong>{n.title}</strong>
              <p>{n.text}</p>
            </div>
            <Link to="#" className="aust-notice-row__link" aria-label="Read full notice"><i className="fas fa-arrow-right" /></Link>
          </div>
        ))}
      </div>
    </section>

    <SiteFooter />
  </div>
);

export default News;

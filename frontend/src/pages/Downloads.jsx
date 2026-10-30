import React from 'react';
import { Link } from 'react-router-dom';
import SiteNav from '../components/landing/SiteNav';
import SiteFooter from '../components/landing/SiteFooter';
import '../styles/landing.css';
import { downloadFiles as files } from '../data/publicContent';


const Downloads = () => (
  <div className="aust-page">
    <SiteNav />

    <section className="aust-subhero">
      <span className="aust-subhero__crumb">
        <Link to="/">Home</Link> <i className="fas fa-chevron-right" style={{ fontSize: '0.6rem' }} /> Downloads
      </span>
      <h1>Downloads</h1>
      <p>Prospectus, forms, guides and reference documents for AUST ODL students and applicants.</p>
    </section>

    <section className="aust-section">
      <div className="aust-section__eyebrow">Resource Library</div>
      <h2 className="aust-section__title">Forms, guides &amp; prospectus</h2>
      <p className="aust-section__sub">All the documents you need before, during and after admission — in one place.</p>
      <div className="aust-download-grid aust-stagger">
        {files.map((f) => {
          // Suggest a clean filename based on the document title
          const downloadName = f.file.split('/').pop();
          return (
            <article key={f.name} className="aust-download-card aust-slide-up">
              <div className="aust-download-card__ic"><i className={`fas ${f.icon}`} /></div>
              <div className="aust-download-card__body">
                <h3>{f.name}</h3>
                <p>{f.desc}</p>
                <div className="aust-download-card__meta">
                  <span><i className="fas fa-file" /> {f.type}</span>
                  <span><i className="fas fa-database" /> {f.size}</span>
                </div>
              </div>
              <a
                href={f.file}
                download={downloadName}
                target="_blank"
                rel="noopener noreferrer"
                className="aust-download-card__btn"
                aria-label={`Download ${f.name}`}
              >
                <i className="fas fa-download" /> Download
              </a>
            </article>
          );
        })}
      </div>

      <p className="aust-section__sub" style={{ marginTop: '2rem', fontSize: '0.85rem', opacity: 0.7 }}>
        <i className="fas fa-info-circle" /> These are placeholder documents. Official versions will be published as they become available.
      </p>
    </section>

    <SiteFooter />
  </div>
);

export default Downloads;

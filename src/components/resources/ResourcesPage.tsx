import { ArrowUpRight } from 'lucide-react';
import { STUDY_SYSTEM } from '../../data/content';
import { RESOURCES } from '../../data/resources';
import styles from './ResourcesPage.module.css';

/** The 10 reference links and the weekly study schedule. */
export default function ResourcesPage() {
  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Focused resources</h3>
          <p>Prefer official docs + implementation + interview explanation over endless playlists.</p>
        </div>
      </div>

      <div className={styles.resourceGrid}>
        {RESOURCES.map((resource) => (
          <a
            className={`panel ${styles.resource}`}
            key={resource.url}
            href={resource.url}
            target="_blank"
            // noreferrer as well as noopener: the old app had only noopener,
            // which leaves the referring URL on outbound requests.
            rel="noopener noreferrer"
          >
            <div>
              <b>{resource.label}</b>
              <span>{resource.description}</span>
            </div>
            <ArrowUpRight />
          </a>
        ))}
      </div>

      <div className="section-head">
        <div>
          <h3>Study operating system</h3>
          <p>A schedule that is aggressive but sustainable with a full-time job.</p>
        </div>
      </div>
      <div className="grid-3">
        {STUDY_SYSTEM.map((card) => (
          <div className="panel project" key={card.title}>
            <h4>{card.title}</h4>
            <p>{card.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

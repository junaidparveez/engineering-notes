import { READINESS_GATES, STAR_STORIES } from '../../data/content';
import { METRICS } from '../../data/metrics';
import { useAppState } from '../../state/useAppState';
import MetricCard from './MetricCard';
import styles from './MetricCard.module.css';

/** Counters, the two readiness gates, and the STAR story bank. */
export default function InterviewPage() {
  const { state, setMetric } = useAppState();

  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Interview conversion tracker</h3>
          <p>High-paying offers come from passing loops, not collecting course completion badges.</p>
        </div>
      </div>

      <div className={styles.metricGrid}>
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            value={state.metrics[metric.id] ?? 0}
            onChange={(value) => setMetric(metric.id, value)}
          />
        ))}
      </div>

      <div className="section-head">
        <div>
          <h3>Readiness gates</h3>
          <p>Use these as “I can prove it” checks.</p>
        </div>
      </div>
      <div className="grid-2">
        {READINESS_GATES.map((gate) => (
          <div className="panel project" key={gate.title}>
            <h4>{gate.title}</h4>
            <div className="deliverables">
              {gate.items.map((item) => (
                <div key={item}>
                  <i>✓</i> {item}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <div>
          <h3>Resume-derived STAR story bank</h3>
          <p>Turn your actual work into interview stories.</p>
        </div>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Story</th>
              <th>Use your real experience</th>
              <th>What interviewer should hear</th>
            </tr>
          </thead>
          <tbody>
            {STAR_STORIES.map((row) => (
              <tr key={row.story}>
                <td>{row.story}</td>
                <td>{row.experience}</td>
                <td>{row.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

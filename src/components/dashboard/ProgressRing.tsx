import type { CSSProperties } from 'react';
import { RING_CAPTION } from '../../data/content';
import { readinessLabel } from '../../state/progress';
import styles from './ProgressRing.module.css';

/**
 * The completion ring. The percentage is handed to CSS as a custom property
 * and the conic-gradient does the drawing.
 *
 * TypeScript's CSSProperties has no room for custom properties, so the cast is
 * the standard way to pass one. It is confined to this line rather than
 * loosening the component's props.
 */
function ringStyle(percent: number): CSSProperties {
  return { '--p': percent } as CSSProperties;
}

export default function ProgressRing({ percent }: { percent: number }) {
  return (
    <div className={`panel ${styles.progressCard}`}>
      <div className={styles.ring} style={ringStyle(percent)}>
        <div className={styles.inside}>
          <b>{percent}%</b>
          <span>roadmap complete</span>
        </div>
      </div>
      <h4>{readinessLabel(percent)}</h4>
      <p>{RING_CAPTION}</p>
    </div>
  );
}

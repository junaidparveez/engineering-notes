import type { ReactNode } from 'react';
import { HERO } from '../../data/content';
import styles from './Hero.module.css';

/**
 * The positioning banner and, beside it, whatever is passed as `aside` — the
 * progress ring. Taking it as a prop keeps this component about layout and
 * copy, with no knowledge of progress state.
 */
export default function Hero({ aside }: { aside: ReactNode }) {
  return (
    <div className={styles.hero}>
      <div className={`panel ${styles.heroCopy}`}>
        <div className="eyebrow">{HERO.eyebrow}</div>
        <h3>{HERO.headline}</h3>
        <p>
          {HERO.bodyLead}
          <strong>{HERO.bodyEmphasis}</strong>
          {HERO.bodyTail}
        </p>
        <div className={styles.heroChips}>
          {HERO.chips.map((chip) => (
            // key tells React which item is which across re-renders, so it can
            // update in place instead of rebuilding the list. The label is
            // unique here and stable, which is what makes it a safe key.
            <span className="chip" key={chip.label}>
              <strong>{chip.label}</strong> {chip.value}
            </span>
          ))}
        </div>
      </div>
      {aside}
    </div>
  );
}

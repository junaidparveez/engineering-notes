import type { Skill } from '../../types';
import styles from './SkillRow.module.css';

const LEVELS = [1, 2, 3, 4, 5];

interface SkillRowProps {
  skill: Skill;
  /** Current level, 1–5. */
  level: number;
  onSetLevel: (level: number) => void;
}

/** One skill: name, evidence, five clickable level bars, and the gap to close. */
export default function SkillRow({ skill, level, onSetLevel }: SkillRowProps) {
  return (
    <div className={`panel ${styles.skillRow}`}>
      <div className={styles.skillName}>
        <b>{skill.name}</b>
        <small>{skill.evidence}</small>
      </div>

      <div className={styles.levels}>
        <div className={styles.levelDots}>
          {LEVELS.map((n) => (
            <button
              type="button"
              key={n}
              className={`${styles.dot} ${level >= n ? styles.on : ''}`}
              title={`Set ${skill.name} to level ${n}`}
              aria-label={`Set ${skill.name} to level ${n} of 5`}
              aria-pressed={level === n}
              onClick={() => onSetLevel(n)}
            />
          ))}
        </div>
        <span className={styles.targetLabel}>
          Now {level}/5 → Target {skill.target}/5
        </span>
      </div>

      <div className={styles.gapNote}>
        <strong className={styles.gapLabel}>Close next:</strong> {skill.gap}
      </div>
    </div>
  );
}

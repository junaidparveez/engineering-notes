import { SKILL_SCORING_GUIDE } from '../../data/content';
import { SKILLS } from '../../data/skills';
import { useAppState } from '../../state/useAppState';
import SkillRow from './SkillRow';
import styles from './SkillRow.module.css';

/** Current versus target level for the 11 tracked skills. */
export default function SkillsPage() {
  const { state, setSkillLevel } = useAppState();

  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Current → target skill map</h3>
          <p>
            Baseline is estimated from your resume. Click the bars whenever your real capability changes.
          </p>
        </div>
      </div>

      <div className="notice" style={{ marginBottom: 12 }}>
        <strong>How to score yourself:</strong> {SKILL_SCORING_GUIDE}
      </div>

      <div className={styles.skillGrid}>
        {SKILLS.map((skill) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            // Falls back to the resume baseline if a saved state predates this
            // skill, which is what an old backup looks like.
            level={state.skills[skill.id] ?? skill.now}
            onSetLevel={(level) => setSkillLevel(skill.id, level)}
          />
        ))}
      </div>
    </section>
  );
}

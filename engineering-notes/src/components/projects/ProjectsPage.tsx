import { PROJECTS, RESUME_RULE } from '../../data/content';

/**
 * The two portfolio cards and the resume rule. Static copy, so this page reads
 * from data/content.ts and holds no state.
 */
export default function ProjectsPage() {
  return (
    <section>
      <div className="section-head">
        <div>
          <h3>Proof that gets interviews</h3>
          <p>Build fewer things, but make each one production-grade and measurable.</p>
        </div>
      </div>

      <div className="grid-2">
        {PROJECTS.map((project) => (
          <div className="panel project" key={project.title}>
            <div className="phase-badge">{project.badge}</div>
            <h4 style={{ marginTop: 12 }}>{project.title}</h4>
            <p>{project.summary}</p>
            <div className="stack">
              {project.stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="deliverables">
              {project.deliverables.map((d) => (
                <div key={d.n}>
                  <i>{d.n}</i> {d.text}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="section-head">
        <div>
          <h3>Resume rule</h3>
          <p>Every major bullet should answer: what did you build, why was it hard, and what changed?</p>
        </div>
      </div>
      <div className="notice good">
        <strong>{RESUME_RULE.label}</strong> {RESUME_RULE.body}
      </div>
    </section>
  );
}

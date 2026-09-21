import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STRATEGY,
  DEPLOY_STEPS,
  HERO,
  PLAN_CHANGE_NOTICES,
  PROJECTS,
  READINESS_GATES,
  RESUME_RULE,
  STAR_STORIES,
  STUDY_SYSTEM,
} from './content';
import { METRICS } from './metrics';
import { RESOURCES } from './resources';
import { SKILLS } from './skills';

/**
 * The copy was extracted from the old app by script, not retyped. These are
 * the counts that prove nothing was dropped on the way — the cheapest possible
 * guard against a regex quietly matching one item too few.
 */
describe('ported content is complete', () => {
  it('keeps all four hero chips', () => {
    expect(HERO.chips).toHaveLength(4);
  });

  it('keeps the bolded word in the hero paragraph', () => {
    expect(HERO.bodyEmphasis).toBe('depth');
    expect(HERO.bodyLead.endsWith('It is proving ')).toBe(true);
  });

  it('keeps the three "what I changed from your old plan" notices', () => {
    expect(PLAN_CHANGE_NOTICES).toHaveLength(3);
    expect(PLAN_CHANGE_NOTICES.map((n) => n.label)).toEqual([
      'Kept & elevated:',
      'Moved earlier:',
      'Deprioritized:',
    ]);
  });

  it('keeps the three application-strategy lines', () => {
    expect(APPLICATION_STRATEGY).toHaveLength(3);
  });

  it('keeps both readiness gates with five checks each', () => {
    expect(READINESS_GATES).toHaveLength(2);
    for (const gate of READINESS_GATES) expect(gate.items).toHaveLength(5);
  });

  it('keeps all six STAR stories with all three columns filled', () => {
    expect(STAR_STORIES).toHaveLength(6);
    for (const row of STAR_STORIES) {
      expect(row.story.length).toBeGreaterThan(0);
      expect(row.experience.length).toBeGreaterThan(0);
      expect(row.signal.length).toBeGreaterThan(0);
    }
  });

  it('keeps both project cards with five deliverables each', () => {
    expect(PROJECTS).toHaveLength(2);
    for (const project of PROJECTS) {
      expect(project.deliverables).toHaveLength(5);
      expect(project.stack.length).toBeGreaterThan(0);
    }
  });

  it('keeps the resume rule, study system and deployment steps', () => {
    expect(RESUME_RULE.label).toContain('Quantify');
    expect(STUDY_SYSTEM).toHaveLength(3);
    expect(DEPLOY_STEPS).toHaveLength(4);
  });

  it('keeps the 11 skills, 10 resources and 6 metrics', () => {
    expect(SKILLS).toHaveLength(11);
    expect(RESOURCES).toHaveLength(10);
    expect(METRICS).toHaveLength(6);
  });

  it('gives every skill and metric a unique id', () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    expect(new Set(METRICS.map((m) => m.id)).size).toBe(METRICS.length);
  });
});

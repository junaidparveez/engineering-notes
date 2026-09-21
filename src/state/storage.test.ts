import { describe, expect, it } from 'vitest';
import { SKILLS } from '../data/skills';
import { METRICS } from '../data/metrics';
import { currentWeek, overallPct } from './progress';
import { defaultState, mergeIntoState, parseImported, serializeForExport, toDateKey } from './storage';

/**
 * The important promise in here: a JSON backup exported by the old single-file
 * app imports into this one and restores exactly. There is real progress in the
 * old deployment, so these are the tests that protect it.
 */

/** A fixed "today" so nothing in this file depends on the day it runs. */
const TODAY = new Date('2026-09-20T10:00:00');

/**
 * A backup in the exact shape the old app wrote: the five state fields plus the
 * `exportedAt` stamp it appended on the way out.
 */
const OLD_APP_BACKUP = {
  completed: {
    w1t0: true,
    w1t1: true,
    w1t3: true,
    w2t0: true,
    w7t4: true,
  },
  skills: {
    java: 4,
    spring: 4,
    data: 3,
    kafka: 3,
    redis: 2,
    cloud: 2,
    k8s: 2,
    quality: 3,
    design: 2,
    dsa: 3,
    ai: 4,
  },
  metrics: { dsa: 37, hld: 2, lld: 1, backend: 0, apps: 14, referrals: 6 },
  startDate: '2026-03-02',
  roadFilter: 'Distributed Backend',
  exportedAt: '2026-09-19T18:22:41.101Z',
};

describe('defaultState', () => {
  it('seeds every skill at its resume baseline', () => {
    const state = defaultState(TODAY);
    for (const skill of SKILLS) expect(state.skills[skill.id]).toBe(skill.now);
  });

  it('starts every interview counter at zero', () => {
    const state = defaultState(TODAY);
    for (const metric of METRICS) expect(state.metrics[metric.id]).toBe(0);
  });

  it('starts today, with nothing completed and no filter', () => {
    const state = defaultState(TODAY);
    expect(state.startDate).toBe('2026-09-20');
    expect(state.completed).toEqual({});
    expect(state.roadFilter).toBe('All');
  });

  it('formats the start date in local time, not UTC', () => {
    // 00:30 local on the 20th is still the 19th in UTC. Using toISOString here
    // would silently set the roadmap start to the wrong day.
    expect(toDateKey(new Date('2026-09-20T00:30:00'))).toBe('2026-09-20');
  });
});

describe('importing a backup from the old app', () => {
  const imported = mergeIntoState(OLD_APP_BACKUP, TODAY);

  it('restores every completed task and nothing extra', () => {
    expect(imported.completed).toEqual(OLD_APP_BACKUP.completed);
  });

  it('restores skill levels', () => {
    expect(imported.skills).toEqual(OLD_APP_BACKUP.skills);
  });

  it('restores interview counters', () => {
    expect(imported.metrics).toEqual(OLD_APP_BACKUP.metrics);
  });

  it('restores the start date and the roadmap filter', () => {
    expect(imported.startDate).toBe('2026-03-02');
    expect(imported.roadFilter).toBe('Distributed Backend');
  });

  it('moves the numbers the UI reads, not just the stored fields', () => {
    // What the user actually checks after an import: the sidebar meter and the
    // current-week badge. Both are derived, so this asserts the whole path from
    // an imported file to the values on screen.
    const fresh = defaultState(TODAY);
    expect(overallPct(fresh)).toBe(0);
    expect(currentWeek(fresh.startDate, TODAY)).toBe(1);

    expect(overallPct(imported)).toBe(4); // 5 of 120 tasks
    // Started 2026-03-02, so ~202 days in: past week 24 and clamped to it.
    expect(currentWeek(imported.startDate, TODAY)).toBe(24);
  });

  it('drops exportedAt rather than carrying it into state', () => {
    expect(imported).not.toHaveProperty('exportedAt');
    expect(Object.keys(imported).sort()).toEqual([
      'completed',
      'metrics',
      'roadFilter',
      'skills',
      'startDate',
    ]);
  });
});

describe('merging over defaults', () => {
  it('fills in a field the backup does not have', () => {
    const { roadFilter, ...withoutFilter } = OLD_APP_BACKUP;
    void roadFilter;
    expect(mergeIntoState(withoutFilter, TODAY).roadFilter).toBe('All');
  });

  it('keeps a skill the backup predates, at its baseline', () => {
    // A backup taken before the k8s skill existed. The old app's shallow
    // `{...defaults, ...data}` spread would have replaced the whole skills
    // object and lost k8s entirely; merging per field keeps it at baseline.
    const { k8s, ...olderSkills } = OLD_APP_BACKUP.skills;
    void k8s;
    const merged = mergeIntoState({ ...OLD_APP_BACKUP, skills: olderSkills }, TODAY);
    const baseline = SKILLS.find((s) => s.id === 'k8s')!.now;
    expect(merged.skills.k8s).toBe(baseline);
    expect(merged.skills.java).toBe(4);
  });

  it('falls back to a clean state for junk input', () => {
    expect(mergeIntoState(null, TODAY)).toEqual(defaultState(TODAY));
    expect(mergeIntoState('not a backup', TODAY)).toEqual(defaultState(TODAY));
  });
});

describe('rejecting malformed values', () => {
  it('keeps only tasks explicitly marked true', () => {
    const merged = mergeIntoState(
      { completed: { w1t0: true, w1t1: false, w1t2: 'yes', w1t3: null } },
      TODAY,
    );
    expect(merged.completed).toEqual({ w1t0: true });
  });

  it('clamps skill levels into 1..5', () => {
    const merged = mergeIntoState({ skills: { java: 99, spring: -3 } }, TODAY);
    expect(merged.skills.java).toBe(5);
    expect(merged.skills.spring).toBe(1);
  });

  it('clamps counters at zero and ignores non-numbers', () => {
    const merged = mergeIntoState({ metrics: { dsa: -10, hld: 'lots' } }, TODAY);
    expect(merged.metrics.dsa).toBe(0);
    expect(merged.metrics.hld).toBe(0); // untouched default, not NaN
  });

  it('ignores a start date that is not YYYY-MM-DD', () => {
    expect(mergeIntoState({ startDate: '02/03/2026' }, TODAY).startDate).toBe('2026-09-20');
    expect(mergeIntoState({ startDate: 42 }, TODAY).startDate).toBe('2026-09-20');
  });
});

describe('export', () => {
  it('round-trips: export then import gives back the same state', () => {
    const state = mergeIntoState(OLD_APP_BACKUP, TODAY);
    expect(parseImported(serializeForExport(state, TODAY), TODAY)).toEqual(state);
  });

  it('stamps the file with an export time for whoever opens it later', () => {
    const json = JSON.parse(serializeForExport(defaultState(TODAY), TODAY));
    expect(json.exportedAt).toBe(TODAY.toISOString());
  });

  it('writes a file the old app could also read back', () => {
    const json = JSON.parse(serializeForExport(mergeIntoState(OLD_APP_BACKUP, TODAY), TODAY));
    // The old app did `{...defaultState(), ...data}` on these five keys.
    for (const key of ['completed', 'skills', 'metrics', 'startDate', 'roadFilter']) {
      expect(json).toHaveProperty(key);
    }
  });
});

describe('parseImported', () => {
  it('refuses anything that is not a JSON object', () => {
    expect(() => parseImported('[]', TODAY)).toThrow(/does not look like/);
    expect(() => parseImported('"hello"', TODAY)).toThrow(/does not look like/);
  });

  it('refuses a JSON object with none of the expected fields', () => {
    // Without this guard, importing an empty object or an unrelated JSON file
    // would merge into a clean default state and wipe real progress while
    // reporting success. Import is the only destructive action in the app.
    expect(() => parseImported('{}', TODAY)).toThrow(/does not look like/);
    expect(() => parseImported('{"name":"sde-career-os","version":"2.0.0"}', TODAY)).toThrow(
      /does not look like/,
    );
  });

  it('accepts a partial backup that has at least one known field', () => {
    expect(parseImported('{"completed":{"w1t0":true}}', TODAY).completed).toEqual({ w1t0: true });
  });

  it('propagates a parse error for a file that is not JSON at all', () => {
    expect(() => parseImported('<html>', TODAY)).toThrow();
  });
});

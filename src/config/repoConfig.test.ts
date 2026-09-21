import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPO_CONFIG,
  canPublish,
  isValid,
  normaliseRepoConfig,
  readmePath,
  repoLabel,
  validateRepoConfig,
} from './repoConfig';
import type { RepoConfig } from './repoConfig';

function config(overrides: Partial<RepoConfig> = {}): RepoConfig {
  return {
    owner: 'junaidparveez',
    name: 'sde-career-os',
    branch: 'main',
    notesDir: 'notes',
    clientId: 'Iv23liExampleClientId',
    ...overrides,
  };
}

describe('validateRepoConfig', () => {
  it('accepts a well-formed target', () => {
    expect(validateRepoConfig(config())).toEqual({});
    expect(canPublish(config())).toBe(true);
  });

  it('requires every field', () => {
    const errors = validateRepoConfig(config({ owner: '', name: '', branch: '', notesDir: '', clientId: '' }));
    expect(Object.keys(errors).sort()).toEqual(['branch', 'clientId', 'name', 'notesDir', 'owner']);
  });

  it('rejects a URL pasted into the owner field', () => {
    // The likeliest paste: the whole repo URL into the first box.
    expect(validateRepoConfig(config({ owner: 'https://github.com/junaidparveez' })).owner).toBeTruthy();
    expect(validateRepoConfig(config({ owner: 'junaidparveez/sde-career-os' })).owner).toBeTruthy();
  });

  it('rejects an owner with a leading or trailing hyphen, as GitHub does', () => {
    expect(validateRepoConfig(config({ owner: '-nope' })).owner).toBeTruthy();
    expect(validateRepoConfig(config({ owner: 'nope-' })).owner).toBeTruthy();
    expect(validateRepoConfig(config({ owner: 'a-b-c' })).owner).toBeUndefined();
  });

  it('allows dots and underscores in a repository name', () => {
    expect(validateRepoConfig(config({ name: 'my.notes_repo-2' })).name).toBeUndefined();
    expect(validateRepoConfig(config({ name: 'owner/repo' })).name).toBeTruthy();
  });

  it('rejects a branch with spaces', () => {
    expect(validateRepoConfig(config({ branch: 'my branch' })).branch).toBeTruthy();
    expect(validateRepoConfig(config({ branch: 'feature/notes' })).branch).toBeUndefined();
  });

  it('rejects a notes folder with stray slashes', () => {
    expect(validateRepoConfig(config({ notesDir: '/notes' })).notesDir).toBeTruthy();
    expect(validateRepoConfig(config({ notesDir: 'notes/' })).notesDir).toBeTruthy();
    expect(validateRepoConfig(config({ notesDir: 'docs/notes' })).notesDir).toBeUndefined();
  });

  it('rejects the placeholder client ID', () => {
    expect(validateRepoConfig(config({ clientId: 'Iv23li...' })).clientId).toBeTruthy();
    expect(canPublish(config({ clientId: 'Iv23li...' }))).toBe(false);
  });

  it('rejects a client SECRET pasted into the client ID box', () => {
    // A secret is 40 hex characters. Storing one in the browser would be
    // exactly the mistake this project is built to avoid, so it is refused.
    const secret = 'a'.repeat(40);
    const error = validateRepoConfig(config({ clientId: secret })).clientId;
    expect(error).toContain('not the client secret');
  });
});

describe('normaliseRepoConfig', () => {
  it('trims every field, so a pasted value with a space still works', () => {
    const cleaned = normaliseRepoConfig(config({ owner: '  junaidparveez  ', branch: ' main ' }));
    expect(cleaned.owner).toBe('junaidparveez');
    expect(cleaned.branch).toBe('main');
  });

  it('strips slashes from the notes folder', () => {
    expect(normaliseRepoConfig(config({ notesDir: '/notes/' })).notesDir).toBe('notes');
  });
});

describe('derived values', () => {
  it('builds the repo label and the index path from the target', () => {
    expect(repoLabel(config())).toBe('junaidparveez/sde-career-os');
    expect(readmePath(config())).toBe('notes/README.md');
    expect(readmePath(config({ notesDir: 'docs/notes' }))).toBe('docs/notes/README.md');
  });

  it('falls back to the defaults compiled in', () => {
    // No localStorage in the test environment, so this exercises the fallback
    // path a fresh browser takes before anything is saved.
    expect(isValid(validateRepoConfig(DEFAULT_REPO_CONFIG))).toBe(false); // placeholder client id
    expect(DEFAULT_REPO_CONFIG.owner).toBe('junaidparveez');
    expect(DEFAULT_REPO_CONFIG.name).toBe('sde-career-os');
  });
});

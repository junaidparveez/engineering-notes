import { GITHUB_APP_CLIENT_ID, REPO } from './app.config';

/**
 * Where notes get published, editable from Settings.
 *
 * app.config.ts still holds the defaults, so a fresh browser works with no
 * setup; anything entered in Settings is stored per browser and overrides them.
 *
 * The trade-off versus keeping this in code: you can retarget without a
 * redeploy, at the cost of the values being able to be wrong at runtime. That
 * is why everything here is validated before it is saved, and why the error
 * messages name the field rather than letting GitHub answer with a bare 404.
 *
 * Nothing here is a secret. The client ID is public by design - the device flow
 * exists for clients that cannot keep a secret - and owner/repo/branch are
 * visible in every published commit.
 */

const STORAGE_KEY = 'junaid_publish_target';

export interface RepoConfig {
  owner: string;
  name: string;
  branch: string;
  /** Folder inside the repo that notes live in. */
  notesDir: string;
  /** GitHub App client ID, e.g. Iv23li… */
  clientId: string;
}

export const DEFAULT_REPO_CONFIG: RepoConfig = {
  owner: REPO.owner,
  name: REPO.name,
  branch: REPO.branch,
  notesDir: REPO.notesDir,
  clientId: GITHUB_APP_CLIENT_ID,
};

// --- validation -------------------------------------------------------------

/** GitHub's own rule: letters, digits, hyphen; no leading or trailing hyphen. */
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
/** Repository names also allow dots and underscores. */
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
/** A placeholder, not a real id. */
const PLACEHOLDER = '...';

export type RepoConfigErrors = Partial<Record<keyof RepoConfig, string>>;

export function validateRepoConfig(config: RepoConfig): RepoConfigErrors {
  const errors: RepoConfigErrors = {};

  if (!config.owner.trim()) errors.owner = 'Required.';
  else if (!OWNER_PATTERN.test(config.owner.trim())) {
    errors.owner = 'Letters, numbers and hyphens only — the account name, not a URL.';
  }

  if (!config.name.trim()) errors.name = 'Required.';
  else if (!REPO_PATTERN.test(config.name.trim())) {
    errors.name = 'Just the repository name, without the owner or a URL.';
  }

  if (!config.branch.trim()) errors.branch = 'Required.';
  else if (/\s/.test(config.branch.trim())) errors.branch = 'Branch names cannot contain spaces.';

  const dir = config.notesDir.trim();
  if (!dir) errors.notesDir = 'Required.';
  else if (dir.startsWith('/') || dir.endsWith('/')) {
    errors.notesDir = 'No leading or trailing slash — e.g. "notes".';
  }

  const id = config.clientId.trim();
  if (!id) errors.clientId = 'Required to publish.';
  else if (id.includes(PLACEHOLDER)) errors.clientId = 'Still the placeholder value.';
  else if (!/^Iv[0-9a-zA-Z]{2,}$/.test(id)) {
    // GitHub App client ids look like Iv23li… (older ones Iv1…). A client
    // SECRET pasted here would be a 40-char hex string, which this rejects.
    errors.clientId = 'A GitHub App client ID starts with "Iv" — not the client secret.';
  }

  return errors;
}

export function isValid(errors: RepoConfigErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Trims every field, so a pasted value with a stray space still works. */
export function normaliseRepoConfig(config: RepoConfig): RepoConfig {
  return {
    owner: config.owner.trim(),
    name: config.name.trim(),
    branch: config.branch.trim(),
    notesDir: config.notesDir.trim().replace(/^\/+|\/+$/g, ''),
    clientId: config.clientId.trim(),
  };
}

// --- storage ----------------------------------------------------------------

/**
 * The active target: what was saved in Settings, over the defaults in code.
 *
 * Read at call time rather than cached, so saving new values takes effect
 * without a reload.
 */
export function getRepoConfig(): RepoConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REPO_CONFIG;
    const stored = JSON.parse(raw) as Partial<RepoConfig>;
    // Merged over the defaults so a field added later cannot break an older
    // saved value.
    return normaliseRepoConfig({ ...DEFAULT_REPO_CONFIG, ...stored });
  } catch {
    return DEFAULT_REPO_CONFIG;
  }
}

export function saveRepoConfig(config: RepoConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normaliseRepoConfig(config)));
  } catch {
    /* private mode: the defaults from code still apply this session */
  }
}

/** Back to whatever app.config.ts says. */
export function resetRepoConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing stored */
  }
}

/** True when there is a usable client ID, i.e. publishing can be attempted. */
export function canPublish(config: RepoConfig = getRepoConfig()): boolean {
  return isValid(validateRepoConfig(config));
}

// --- derived paths ----------------------------------------------------------

export function notesDirOf(config: RepoConfig = getRepoConfig()): string {
  return config.notesDir;
}

/** The generated index, inside the notes folder. */
export function readmePath(config: RepoConfig = getRepoConfig()): string {
  return `${config.notesDir}/README.md`;
}

export function repoLabel(config: RepoConfig = getRepoConfig()): string {
  return `${config.owner}/${config.name}`;
}

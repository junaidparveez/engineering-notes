import { useState } from 'react';
import { Check, RotateCcw, Save } from 'lucide-react';
import {
  DEFAULT_REPO_CONFIG,
  getRepoConfig,
  isValid,
  resetRepoConfig,
  saveRepoConfig,
  validateRepoConfig,
} from '../../config/repoConfig';
import type { RepoConfig, RepoConfigErrors } from '../../config/repoConfig';
import styles from './SettingsPage.module.css';

interface Field {
  key: keyof RepoConfig;
  label: string;
  placeholder: string;
  hint?: string;
}

const FIELDS: Field[] = [
  { key: 'owner', label: 'Owner', placeholder: 'junaidparveez', hint: 'The account, not a URL.' },
  { key: 'name', label: 'Repository', placeholder: 'sde-career-os' },
  { key: 'branch', label: 'Branch', placeholder: 'main' },
  { key: 'notesDir', label: 'Notes folder', placeholder: 'notes', hint: 'Path inside the repo.' },
  {
    key: 'clientId',
    label: 'GitHub App client ID',
    placeholder: 'Iv23li…',
    hint: 'Public by design. Not the client secret — this app never uses one.',
  },
];

/**
 * Where notes publish to, entered here rather than compiled in.
 *
 * Saved per browser, over the defaults in app.config.ts, so a fresh device
 * works without setup and this only has to be touched to change target.
 *
 * Validated before saving: a wrong owner or branch otherwise surfaces much
 * later as a bare 404 from GitHub in the middle of a publish.
 */
export default function PublishTargetCard() {
  const [draft, setDraft] = useState<RepoConfig>(() => getRepoConfig());
  const [errors, setErrors] = useState<RepoConfigErrors>({});
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  function set<K extends keyof RepoConfig>(key: K, value: RepoConfig[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setCheckResult(null);
  }

  function save() {
    const found = validateRepoConfig(draft);
    setErrors(found);
    if (!isValid(found)) return;
    saveRepoConfig(draft);
    setDraft(getRepoConfig());
    setSaved(true);
  }

  /**
   * Confirms the repository exists, without needing a token.
   *
   * Unauthenticated, so a private repository answers 404 the same as a
   * non-existent one - which the message says rather than pretending to know.
   */
  async function check() {
    setChecking(true);
    setCheckResult(null);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${draft.owner.trim()}/${draft.name.trim()}`,
        { headers: { accept: 'application/vnd.github+json' } },
      );
      if (response.ok) {
        const repo = (await response.json()) as { default_branch?: string; private?: boolean };
        const branchNote =
          repo.default_branch && repo.default_branch !== draft.branch.trim()
            ? ` Its default branch is "${repo.default_branch}".`
            : '';
        setCheckResult(`Found${repo.private ? ' (private)' : ''}.${branchNote}`);
      } else if (response.status === 404) {
        setCheckResult('Not found — either the name is wrong, or it is private (which is fine).');
      } else {
        setCheckResult(`GitHub answered ${response.status}.`);
      }
    } catch {
      setCheckResult('Could not reach GitHub.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={`panel ${styles.setting}`}>
      <label>Publishing target</label>

      <div className={styles.targetFields}>
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={`repo-${field.key}`} className={styles.fieldLabel}>
              {field.label}
            </label>
            <input
              id={`repo-${field.key}`}
              className="field"
              value={draft[field.key]}
              placeholder={field.placeholder}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => set(field.key, e.target.value)}
              aria-invalid={Boolean(errors[field.key])}
            />
            {errors[field.key] ? (
              <p className={styles.fieldError}>{errors[field.key]}</p>
            ) : field.hint ? (
              <p className={styles.hint}>{field.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className={styles.buttonRow}>
        <button type="button" className="btn primary" onClick={save}>
          {saved ? <Check /> : <Save />}
          {saved ? 'Saved' : 'Save target'}
        </button>
        <button type="button" className="btn" onClick={() => void check()} disabled={checking}>
          {checking ? 'Checking…' : 'Check repository'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetRepoConfig();
            setDraft(DEFAULT_REPO_CONFIG);
            setErrors({});
            setSaved(false);
            setCheckResult(null);
          }}
        >
          <RotateCcw />
          Reset to defaults
        </button>
      </div>

      {checkResult && <p className={styles.hint}>{checkResult}</p>}

      <p className={styles.hint}>
        Stored in this browser, over the defaults in <code>app.config.ts</code>. Changing the target
        does not move notes already published elsewhere — pull from the new repository to pick those up.
      </p>
    </div>
  );
}

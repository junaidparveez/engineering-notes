/**
 * Every fixed value in the app. No settings UI, no env vars for anything
 * public — if one of these needs to change, it is a one-line code edit and a
 * deploy, which is the right amount of ceremony for values that change twice a
 * year.
 */

export const REPO = {
  owner: 'junaidparveez',
  // This repo, not the old single-file one: notes publish alongside the code
  // that renders them. The GitHub App must be installed on this repository.
  name: 'sde-career-os',
  branch: 'main',
  notesDir: 'notes',
} as const;

/**
 * GitHub App client ID. Public by design — the device flow is built for
 * clients that cannot keep a secret, which is why there is no client_secret
 * anywhere in this project.
 */
export const GITHUB_APP_CLIENT_ID = 'Iv23li...'; // TODO(junaid): paste the Client ID from the GitHub App

export const PUBLISH = {
  commitMessagePrefix: 'notes:',
  skipCiTag: '[skip ci]', // notes do not change the site; skip the build

  /**
   * How long this app will keep a GitHub token before discarding it.
   *
   * Publishing takes seconds, so there is no reason to hold a repo-write
   * credential for the eight hours GitHub allows - especially on a shared or
   * work machine. After this many minutes the app deletes the token and asks
   * you to authorise again, which costs about twenty seconds.
   *
   * What this does NOT do: end the token's life at GitHub. Revoking a GitHub
   * App user token early requires the app's client secret, which this project
   * deliberately does not have anywhere. Until GitHub's own expiry passes, the
   * only way to kill it server-side is Settings -> Applications -> Authorized
   * GitHub Apps -> Revoke, which the UI links to.
   */
  tokenLifetimeMinutes: 15,

  /** Discard the token the moment a publish finishes, rather than waiting. */
  forgetTokenAfterPublish: true,
} as const;

/** Where to revoke the authorisation at GitHub, not just locally. */
export const GITHUB_REVOKE_URL = 'https://github.com/settings/apps/authorizations';

/** localStorage key for roadmap progress. Unchanged from the old app so existing saves load. */
export const STORAGE_KEY = 'junaid_sde_career_os_v2';

/** Filename used by Settings → Export. */
export const EXPORT_FILENAME = 'junaid-career-os-progress.json';

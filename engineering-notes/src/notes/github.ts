import { getRepoConfig, repoLabel } from '../config/repoConfig';

/**
 * GitHub REST calls, made straight from the browser.
 *
 * api.github.com sends CORS headers, so these need no proxy and the token never
 * leaves the tab it was issued in. Only github.com's OAuth endpoints need
 * api/github-auth.ts, and only because they send no CORS headers at all.
 *
 * Publishing uses the Git Data API rather than the Contents API. The Contents
 * API writes one file per request and produces one commit per file, so
 * publishing six notes made six commits. Here, however many notes changed
 * become one tree and one commit.
 */

const API = 'https://api.github.com';

function base(path: string): string {
  const { owner, name } = getRepoConfig();
  return `${API}/repos/${owner}/${name}${path}`;
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base(path), {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new GitHubError(response.status, detail?.message ?? response.statusText, path);
  }
  return (await response.json()) as T;
}

export class GitHubError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly path: string,
  ) {
    super(describe(status, message));
    this.name = 'GitHubError';
  }
}

/** Turns GitHub's terser failures into something actionable. */
function describe(status: number, message: string): string {
  if (status === 401) return 'GitHub rejected the token. Authorise again.';
  if (status === 403) {
    return `GitHub refused the request (403). Check the app has Contents: Read and write, and is installed on ${repoLabel()}. (${message})`;
  }
  if (status === 404) {
    return `Not found: check the owner, repository and branch in Settings, and that the GitHub App is installed on ${repoLabel()}. (${message})`;
  }
  return `${message} (HTTP ${status})`;
}

// --- reading ---------------------------------------------------------------

export interface RefInfo {
  commitSha: string;
  treeSha: string;
}

/** Step 1 and 2: where the branch points, and the tree it holds. */
export async function readBranch(token: string): Promise<RefInfo> {
  const ref = await call<{ object: { sha: string } }>(token, `/git/ref/heads/${getRepoConfig().branch}`);
  const commit = await call<{ tree: { sha: string } }>(token, `/git/commits/${ref.object.sha}`);
  return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
}

export interface TreeEntry {
  path: string;
  type: string;
  sha: string;
}

/** Every file under notesDir, with the blob SHA GitHub holds for each. */
export async function readNotesTree(token: string): Promise<TreeEntry[]> {
  const { commitSha } = await readBranch(token);
  const tree = await call<{ tree: TreeEntry[]; truncated: boolean }>(
    token,
    `/git/trees/${commitSha}?recursive=1`,
  );
  if (tree.truncated) {
    // Only at tens of thousands of files, but silently pulling half the notes
    // would look like data loss rather than a limit.
    throw new Error('The repository tree was truncated by GitHub; too many files to list at once.');
  }
  const { notesDir } = getRepoConfig();
  return tree.tree.filter((e) => e.type === 'blob' && e.path.startsWith(`${notesDir}/`));
}

/** The content of one blob, decoded from base64. */
export async function readBlob(token: string, sha: string): Promise<string> {
  const blob = await call<{ content: string; encoding: string }>(token, `/git/blobs/${sha}`);
  if (blob.encoding !== 'base64') throw new Error(`Unexpected blob encoding: ${blob.encoding}`);
  return decodeBase64(blob.content);
}

// --- writing ---------------------------------------------------------------

/** Step 3: upload one file's content and get back its blob SHA. */
export async function createBlob(token: string, content: string): Promise<string> {
  const blob = await call<{ sha: string }>(token, '/git/blobs', {
    method: 'POST',
    body: JSON.stringify({ content: encodeBase64(content), encoding: 'base64' }),
  });
  return blob.sha;
}

export interface TreeChange {
  path: string;
  /** null deletes the path in the new tree. */
  sha: string | null;
}

/** Step 4: one tree holding every change, on top of the current one. */
export async function createTree(
  token: string,
  baseTreeSha: string,
  changes: TreeChange[],
): Promise<string> {
  const tree = await call<{ sha: string }>(token, '/git/trees', {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: changes.map((change) => ({
        path: change.path,
        mode: '100644',
        type: 'blob',
        sha: change.sha,
      })),
    }),
  });
  return tree.sha;
}

/** Step 5: the commit itself. */
export async function createCommit(
  token: string,
  message: string,
  treeSha: string,
  parentSha: string,
): Promise<string> {
  // No author or committer is sent on purpose: GitHub attributes the commit to
  // the account that authorised the token. Sending the local git identity would
  // stamp these commits with whatever this machine is configured with, which on
  // a work laptop is the wrong person entirely.
  const commit = await call<{ sha: string }>(token, '/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  return commit.sha;
}

/** Step 6: move the branch. Never forced. */
export async function updateBranch(token: string, commitSha: string): Promise<void> {
  await call(token, `/git/refs/heads/${getRepoConfig().branch}`, {
    method: 'PATCH',
    // force: false means GitHub refuses a non-fast-forward with a 422 rather
    // than discarding whatever landed on the branch in the meantime.
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
}

/** Link to a commit, for showing after a publish. */
export function commitUrl(sha: string): string {
  return `https://github.com/${repoLabel()}/commit/${sha}`;
}

// --- base64 over UTF-8 ------------------------------------------------------

/**
 * btoa works on bytes, not characters, so text has to be encoded first -
 * otherwise any note containing "→" throws. The chunking keeps the argument
 * list small enough for String.fromCharCode on large notes.
 */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(encoded: string): string {
  const binary = atob(String(encoded || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

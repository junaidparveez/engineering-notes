import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GitHubError,
  createBlob,
  createCommit,
  createTree,
  decodeBase64,
  encodeBase64,
  readBranch,
  readNotesTree,
  updateBranch,
} from './github';

const TOKEN = 'ghu_example';

let fetchMock: ReturnType<typeof vi.fn>;

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** The parsed JSON body of the most recent request. */
function sent(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(reply({ sha: 'new-sha' }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('base64 over UTF-8', () => {
  it('round-trips multi-byte text', () => {
    // btoa works on bytes, not characters: without encoding first, any note
    // containing an arrow throws outright.
    const text = '# Java · Collections →深入\n\n- item\n';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('round-trips an empty file and a large one', () => {
    expect(decodeBase64(encodeBase64(''))).toBe('');
    const big = 'x'.repeat(200_000);
    expect(decodeBase64(encodeBase64(big))).toBe(big);
  });
});

describe('createTree', () => {
  it('builds on the base tree with blob mode 100644', async () => {
    await createTree(TOKEN, 'base-tree', [{ path: 'notes/a.md', sha: 'blob-a' }]);
    expect(sent()).toEqual({
      base_tree: 'base-tree',
      tree: [{ path: 'notes/a.md', mode: '100644', type: 'blob', sha: 'blob-a' }],
    });
  });

  it('passes a null sha through, which is how a file is deleted', async () => {
    await createTree(TOKEN, 'base-tree', [{ path: 'notes/gone.md', sha: null }]);
    const tree = sent().tree as { path: string; sha: string | null }[];
    expect(tree[0]).toMatchObject({ path: 'notes/gone.md', sha: null });
  });

  it('puts every change in a single tree', async () => {
    const changes = Array.from({ length: 4 }, (_, i) => ({ path: `notes/n${i}.md`, sha: `s${i}` }));
    await createTree(TOKEN, 'base-tree', changes);
    expect((sent().tree as unknown[]).length).toBe(4);
    // One request, therefore one tree, therefore one commit for four notes.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('createCommit', () => {
  it('sends the message, tree and a single parent', async () => {
    await createCommit(TOKEN, 'notes: publish 2 notes [skip ci]', 'tree-sha', 'parent-sha');
    expect(sent()).toEqual({
      message: 'notes: publish 2 notes [skip ci]',
      tree: 'tree-sha',
      parents: ['parent-sha'],
    });
  });

  it('sends no author or committer', async () => {
    // GitHub then attributes the commit to whoever authorised the token.
    // Sending the local git identity would stamp these commits with whatever
    // this machine is configured with - the wrong account on a work laptop.
    await createCommit(TOKEN, 'msg', 'tree', 'parent');
    expect(sent()).not.toHaveProperty('author');
    expect(sent()).not.toHaveProperty('committer');
  });
});

describe('updateBranch', () => {
  it('never force-pushes', async () => {
    await updateBranch(TOKEN, 'commit-sha');
    expect(sent()).toEqual({ sha: 'commit-sha', force: false });
  });

  it('uses PATCH on the branch ref', async () => {
    await updateBranch(TOKEN, 'commit-sha');
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(url).toContain('/git/refs/heads/main');
  });
});

describe('authentication and errors', () => {
  it('sends the token as a bearer with the pinned API version', async () => {
    await createBlob(TOKEN, 'content');
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['x-github-api-version']).toBe('2022-11-28');
  });

  it('turns a 401 into "authorise again"', async () => {
    fetchMock.mockResolvedValueOnce(reply({ message: 'Bad credentials' }, 401));
    await expect(createBlob(TOKEN, 'x')).rejects.toThrow(/Authorise again/);
  });

  it('points a 404 at the two things that actually cause it', async () => {
    // Now that owner/repo/branch are entered in Settings, a 404 is as likely
    // to be a typo there as a missing app installation, so it names both.
    fetchMock.mockResolvedValueOnce(reply({ message: 'Not Found' }, 404));
    await expect(createBlob(TOKEN, 'x')).rejects.toThrow(/check the owner, repository and branch/);
    fetchMock.mockResolvedValueOnce(reply({ message: 'Not Found' }, 404));
    await expect(createBlob(TOKEN, 'x')).rejects.toThrow(/installed on/);
  });

  it('points a 403 at the Contents permission', async () => {
    fetchMock.mockResolvedValueOnce(reply({ message: 'Resource not accessible' }, 403));
    await expect(createBlob(TOKEN, 'x')).rejects.toThrow(/Contents: Read and write/);
  });

  it('keeps the status on the error so callers can branch on it', async () => {
    fetchMock.mockResolvedValueOnce(reply({ message: 'stale' }, 422));
    // 422 from updateBranch is how a moved branch is detected, so the status
    // has to survive the wrapping.
    await expect(updateBranch(TOKEN, 'sha')).rejects.toMatchObject({
      name: 'GitHubError',
      status: 422,
    });
    expect(new GitHubError(422, 'x', '/p').status).toBe(422);
  });
});

describe('readBranch and readNotesTree', () => {
  it('reads the ref then that commit, for the base SHAs', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ object: { sha: 'commit-1' } }))
      .mockResolvedValueOnce(reply({ tree: { sha: 'tree-1' } }));
    await expect(readBranch(TOKEN)).resolves.toEqual({ commitSha: 'commit-1', treeSha: 'tree-1' });
  });

  it('returns only blobs under the notes folder', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ object: { sha: 'c1' } }))
      .mockResolvedValueOnce(reply({ tree: { sha: 't1' } }))
      .mockResolvedValueOnce(
        reply({
          truncated: false,
          tree: [
            { path: 'notes/java/a.md', type: 'blob', sha: 'a' },
            { path: 'notes/java', type: 'tree', sha: 'dir' },
            { path: 'src/main.tsx', type: 'blob', sha: 'src' },
          ],
        }),
      );
    const entries = await readNotesTree(TOKEN);
    expect(entries.map((e) => e.path)).toEqual(['notes/java/a.md']);
  });

  it('refuses a truncated tree rather than pretending notes are missing', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ object: { sha: 'c1' } }))
      .mockResolvedValueOnce(reply({ tree: { sha: 't1' } }))
      .mockResolvedValueOnce(reply({ truncated: true, tree: [] }));
    await expect(readNotesTree(TOKEN)).rejects.toThrow(/truncated/);
  });
});

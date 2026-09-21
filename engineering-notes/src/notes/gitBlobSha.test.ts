import { describe, expect, it } from 'vitest';
import { gitBlobSha } from './gitBlobSha';

/**
 * The expected values are not hand-computed: each one came from running
 * `git hash-object` on a file with exactly this content. If this function ever
 * disagrees with git, every note's published/modified status is wrong, so the
 * oracle here is git itself rather than a second implementation of the same
 * idea.
 */
describe('gitBlobSha', () => {
  it('matches git for an empty file', async () => {
    // The famous empty-blob SHA; git uses it for every empty file in history.
    await expect(gitBlobSha('')).resolves.toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('matches git for a simple file', async () => {
    await expect(gitBlobSha('hello\n')).resolves.toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });

  it('matches git for a file with no trailing newline', async () => {
    await expect(gitBlobSha('no trailing newline')).resolves.toBe(
      '69db55d99f68896760e56c209fbd5823dae98e66',
    );
  });

  it('matches git for multi-byte characters', async () => {
    // 44 characters but 51 bytes. Hashing the character count instead of the
    // byte count passes every ASCII test and fails silently on any note
    // containing an arrow, a middle dot or a non-Latin script - which these
    // notes are full of.
    const content = '# HashMap internals\n\nJava · Collections →深入\n';
    expect(content.length).toBe(44);
    expect(new TextEncoder().encode(content).length).toBe(51);
    await expect(gitBlobSha(content)).resolves.toBe('254259984eeda3a50eaaddd44126b60171872e87');
  });

  it('returns 40 lowercase hex characters', async () => {
    expect(await gitBlobSha('anything')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('gives different hashes for content differing by one character', async () => {
    const [a, b] = await Promise.all([gitBlobSha('note a'), gitBlobSha('note b')]);
    expect(a).not.toBe(b);
  });

  it('is stable across calls', async () => {
    const content = '---\ntitle: X\n---\n\nbody\n';
    const [first, second] = await Promise.all([gitBlobSha(content), gitBlobSha(content)]);
    expect(first).toBe(second);
  });
});

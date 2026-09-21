/**
 * Computes the SHA a git blob would have, locally.
 *
 * This is what makes a note's status exact without keeping a second copy of its
 * content: hash the file we would publish and compare with the SHA GitHub
 * returned last time we published it. Equal means published, different means
 * modified. It is git's own identity for a file, so there is nothing to keep in
 * sync.
 *
 *   sha1("blob " + byteLength + "\0" + content)
 *
 * Two details that are easy to get wrong:
 *  - the length is the length in BYTES, not characters, so anything non-ASCII
 *    (the "→" and "·" all over these notes) would produce a wrong hash if you
 *    used content.length;
 *  - the separator is a real NUL byte, not the two characters "\" and "0".
 */

const encoder = new TextEncoder();

export async function gitBlobSha(content: string): Promise<string> {
  const body = encoder.encode(content);
  const header = encoder.encode(`blob ${body.length}\0`);

  const bytes = new Uint8Array(header.length + body.length);
  bytes.set(header, 0);
  bytes.set(body, header.length);

  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return toHex(digest);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

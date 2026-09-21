import { WEEKS } from '../data/weeks';
import type { Note } from '../types';

/**
 * The frontmatter block at the top of every note file, and the helpers that
 * turn a Note into the exact bytes we would publish.
 *
 * The format is unchanged from the old app, because notes already in the repo
 * have to keep parsing:
 *
 *   ---
 *   title: HashMap internals
 *   category: java
 *   week: 1
 *   topic: Java internals + collections
 *   tags: [java, collections]
 *   created: 2026-09-20
 *   updated: 2026-09-27
 *   ---
 *
 * Deliberately not a YAML parser: this is a flat list of `key: value` lines
 * with one array field, and a real YAML dependency would be several hundred
 * times the size of the twenty lines below.
 */

export interface Frontmatter {
  title: string;
  category: string;
  week: number | null;
  topic: string;
  tags: string[];
  created: string;
  updated: string;
}

/** 'YYYY-MM-DD' in local time. */
export function today(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Lowercase, hyphenated, safe as a filename. Ported unchanged. */
export function slug(value: string): string {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'note';
}

/** 'hashmap-internals.md' -> 'Hashmap Internals', for the file tree. */
export function pretty(name: string): string {
  return name
    .replace(/\.md$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Splits a file into its frontmatter fields and the Markdown below it. */
export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const source = String(text || '');
  const match = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: source };

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const at = line.indexOf(':');
    // `< 1` rather than `< 0`: a line starting with ':' has no key.
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .join(', ');
    }
    meta[key] = value;
  }
  return { meta, body: source.slice(match[0].length) };
}

/** Splits a 'a, b' tag string into a clean list. */
export function parseTags(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * The full file content for a note: frontmatter followed by the body.
 *
 * This is the single definition of "what we would publish", which matters
 * because its git blob SHA is what decides whether a note counts as published
 * or modified. If this function's output changes, every note looks modified.
 */
export function renderNoteFile(note: Note, now: Date = new Date()): string {
  const created = today(new Date(note.createdAt));
  const lines = ['---'];
  lines.push(`title: ${note.title || 'Untitled'}`);
  lines.push(`category: ${note.folder || 'misc'}`);
  if (note.week) {
    lines.push(`week: ${note.week}`);
    // `topic` is part of the frontmatter format but not of the Note model:
    // the old app filled it from the week's focus, so it is derived here for
    // the same reason - one less field to keep correct by hand.
    const focus = WEEKS.find((w) => w.week === note.week)?.focus;
    if (focus) lines.push(`topic: ${focus}`);
  }
  lines.push(`tags: [${note.tags.join(', ')}]`);
  lines.push(`created: ${created}`);
  lines.push(`updated: ${today(now)}`);
  lines.push('---');
  return lines.join('\n') + '\n\n' + String(note.body || '').replace(/^\n+/, '');
}

/** The skeleton a new note starts from. Ported unchanged. */
export function noteTemplate(): string {
  return [
    '## Why this matters',
    '',
    '',
    '## Key points',
    '',
    '- ',
    '',
    '## Example',
    '',
    '```java',
    '',
    '```',
    '',
    '## How I would say it in an interview',
    '',
    '',
    '## Gotchas and failure modes',
    '',
    '- ',
    '',
    '## Sources',
    '',
    '- ',
  ].join('\n');
}

import { describe, expect, it } from 'vitest';
import {
  parseFrontmatter,
  parseTags,
  pretty,
  renderNoteFile,
  slug,
  today,
} from './frontmatter';
import type { Note } from '../types';

const NOW = new Date('2026-09-27T10:00:00');
const CREATED = new Date('2026-09-20T08:30:00');

function note(overrides: Partial<Note> = {}): Note {
  return {
    path: 'notes/java/hashmap-internals.md',
    title: 'HashMap internals',
    folder: 'java',
    week: 1,
    tags: ['java', 'collections'],
    body: 'Body text.\n',
    createdAt: CREATED.getTime(),
    updatedAt: NOW.getTime(),
    status: 'draft',
    publishedSha: null,
    ...overrides,
  };
}

describe('slug', () => {
  it('lowercases and hyphenates', () => {
    expect(slug('HashMap internals')).toBe('hashmap-internals');
  });

  it('collapses punctuation and trims the edges', () => {
    expect(slug('  Kafka: retries, DLQ & idempotency!  ')).toBe('kafka-retries-dlq-idempotency');
  });

  it('falls back to "note" when nothing usable is left', () => {
    expect(slug('')).toBe('note');
    expect(slug('!!!')).toBe('note');
  });

  it('caps the length so a long title cannot produce a silly filename', () => {
    expect(slug('a'.repeat(200)).length).toBe(60);
  });
});

describe('pretty', () => {
  it('turns a filename back into a readable title', () => {
    expect(pretty('hashmap-internals.md')).toBe('Hashmap Internals');
  });
});

describe('today', () => {
  it('formats in local time, not UTC', () => {
    // 00:30 local on the 20th is the 19th in UTC; toISOString would be wrong.
    expect(today(new Date('2026-09-20T00:30:00'))).toBe('2026-09-20');
  });
});

describe('parseTags', () => {
  it('splits, trims and drops empties', () => {
    expect(parseTags(' java , collections ,, ')).toEqual(['java', 'collections']);
  });
});

describe('renderNoteFile', () => {
  it('writes the frontmatter format the old app used', () => {
    expect(renderNoteFile(note(), NOW)).toBe(
      [
        '---',
        'title: HashMap internals',
        'category: java',
        'week: 1',
        'topic: Java internals + collections',
        'tags: [java, collections]',
        'created: 2026-09-20',
        'updated: 2026-09-27',
        '---',
        '',
        'Body text.',
        '',
      ].join('\n'),
    );
  });

  it('derives topic from the week, and omits both when there is no week', () => {
    const file = renderNoteFile(note({ week: null }), NOW);
    expect(file).not.toContain('week:');
    expect(file).not.toContain('topic:');
  });

  it('is byte-for-byte stable for the same input', () => {
    // The git blob SHA of this output decides published vs modified, so any
    // instability here would make every note look permanently modified.
    expect(renderNoteFile(note(), NOW)).toBe(renderNoteFile(note(), NOW));
  });

  it('round-trips through the parser', () => {
    const { meta, body } = parseFrontmatter(renderNoteFile(note(), NOW));
    expect(meta.title).toBe('HashMap internals');
    expect(meta.category).toBe('java');
    expect(meta.week).toBe('1');
    expect(meta.tags).toBe('java, collections');
    expect(body.trim()).toBe('Body text.');
  });

  it('handles an empty tag list and a missing title', () => {
    const file = renderNoteFile(note({ tags: [], title: '' }), NOW);
    expect(file).toContain('tags: []');
    expect(file).toContain('title: Untitled');
  });
});

describe('parseFrontmatter', () => {
  it('returns the whole text as body when there is no frontmatter', () => {
    const { meta, body } = parseFrontmatter('# Just markdown\n');
    expect(meta).toEqual({});
    expect(body).toBe('# Just markdown\n');
  });

  it('ignores a line with no key', () => {
    const { meta } = parseFrontmatter('---\n: stray\ntitle: Real\n---\nbody');
    expect(meta).toEqual({ title: 'Real' });
  });

  it('keeps colons inside a value', () => {
    const { meta } = parseFrontmatter('---\ntopic: Kafka: retries and DLQ\n---\n');
    expect(meta.topic).toBe('Kafka: retries and DLQ');
  });
});

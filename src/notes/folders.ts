import { WEEKS } from '../data/weeks';
import type { Week } from '../types';

/**
 * Guesses which folder a new note belongs in from the current week's focus.
 *
 * Only a convenience - the folder field is editable and the guess is often
 * wrong for a note that is not about the week's main topic. Ported from the old
 * app, including the order of the list: the first keyword found wins, so
 * 'design' sits after 'hld' and 'lld' deliberately.
 */
const KEYWORD_TO_FOLDER: [string, string][] = [
  ['java', 'java'],
  ['concurrency', 'java'],
  ['spring', 'spring-boot'],
  ['postgres', 'database'],
  ['hibernate', 'database'],
  ['kafka', 'kafka'],
  ['redis', 'redis-caching'],
  ['networking', 'networking-apis'],
  ['api', 'networking-apis'],
  ['outbox', 'distributed-systems'],
  ['saga', 'distributed-systems'],
  ['observability', 'observability'],
  ['docker', 'docker-kubernetes'],
  ['kubernetes', 'docker-kubernetes'],
  ['aws', 'aws-cloud'],
  ['ci/cd', 'ci-cd'],
  ['hld', 'system-design'],
  ['lld', 'low-level-design'],
  ['design', 'system-design'],
  ['rag', 'ai-rag'],
  ['agent', 'ai-rag'],
  ['interview', 'interview'],
  ['resume', 'career'],
  ['offer', 'career'],
];

export function guessFolder(week: Week | undefined): string {
  if (!week) return 'java';
  const haystack = `${week.focus} ${week.dsa}`.toLowerCase();
  for (const [keyword, folder] of KEYWORD_TO_FOLDER) {
    if (haystack.includes(keyword)) return folder;
  }
  return 'java';
}

/** The folder suggested for a given week number. */
export function folderForWeek(weekNumber: number | null): string {
  return guessFolder(WEEKS.find((w) => w.week === weekNumber));
}

/** Folders already in use, for the datalist on the folder field. */
export function existingFolders(paths: string[]): string[] {
  const folders = new Set<string>();
  for (const path of paths) {
    const parts = path.split('/');
    if (parts.length >= 3) folders.add(parts[1]!);
  }
  return [...folders].sort();
}

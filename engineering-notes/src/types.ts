/**
 * The domain model for the whole app. Think of this file the way you would
 * think of a package of records/DTOs in Java: every other file imports its
 * vocabulary from here so there is exactly one definition of "a Week".
 */

/** The seven kinds of work a week can contain. Drives the coloured label. */
export type TaskKind = 'learn' | 'build' | 'dsa' | 'proof' | 'career' | 'design' | 'interview';

/** The six phases, in the order they appear in the roadmap. */
export type Phase =
  | 'Foundation'
  | 'Distributed Backend'
  | 'Cloud Native'
  | 'System Design'
  | 'AI + Differentiation'
  | 'Proof + Interviews';

export interface Task {
  kind: TaskKind;
  text: string;
}

export interface Week {
  /** Week number, 1–24. Named `w` in the old app's saved data; kept as `week` here. */
  week: number;
  phase: Phase;
  focus: string;
  /** One line on why this week exists at all. */
  why: string;
  /** The DSA topic paired with this week. */
  dsa: string;
  tasks: Task[];
}

export interface Skill {
  id: string;
  name: string;
  /** Baseline level estimated from the resume, 1–5. */
  now: number;
  /** Target level, 1–5. */
  target: number;
  evidence: string;
  gap: string;
}

export interface Resource {
  label: string;
  description: string;
  url: string;
}

export interface Metric {
  id: string;
  label: string;
  target: number;
  /** lucide-react icon name, e.g. 'code-2'. */
  icon: string;
  note: string;
}

/**
 * Persisted roadmap progress. The shape is frozen: backups exported by the old
 * single-file app must still import, so no field may be renamed or removed.
 * `completed` keys are `w${week}t${index}` — index is the task's position in
 * its week, which is why data/weeks.ts must never be reordered.
 */
export interface AppState {
  completed: Record<string, boolean>;
  /** skill id -> level 1..5 */
  skills: Record<string, number>;
  /** metric id -> count */
  metrics: Record<string, number>;
  /** 'YYYY-MM-DD' */
  startDate: string;
  /** Active phase filter on the roadmap page, or 'All'. */
  roadFilter: string;
}

// --- notes -----------------------------------------------------------------

/**
 * Status is derived, never set by hand: compare the git blob SHA of the file we
 * would publish with the SHA GitHub returned at the last publish.
 * See notes/gitBlobSha.ts.
 */
export type NoteStatus = 'draft' | 'published' | 'modified' | 'deleted';

export interface Note {
  /** 'notes/java/collections.md' — the primary key. */
  path: string;
  title: string;
  folder: string;
  week: number | null;
  tags: string[];
  /** Markdown without the frontmatter block. */
  body: string;
  createdAt: number;
  updatedAt: number;
  status: NoteStatus;
  /** git blob SHA at the last publish, or null if never published. */
  publishedSha: string | null;
}

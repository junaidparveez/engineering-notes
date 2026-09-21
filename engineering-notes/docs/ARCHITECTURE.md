# Architecture

Written for one reader: you, in six months, wanting to change one thing without
reading the whole codebase first.

---

## The shape of it

A Vite + React + TypeScript app with two serverless functions. No state library,
no CSS framework, no Markdown library, no GitHub SDK. Three storage layers, each
with one job:

| Layer | Holds | Read | Written |
|---|---|---|---|
| `localStorage` | roadmap progress | on start, synchronously | every change |
| IndexedDB | every note | on start, instantly, offline | every save |
| Upstash Redis | both, for cross-device | on demand | ~2s after changes stop |
| GitHub | published notes | only on explicit **Pull** | only on explicit **Publish** |

The direction is always the same: **local is the source of truth, everything
else is a copy fed from it.** Opening the app makes no network request. Opening a
note makes none either. That is the whole reason the app feels instant and works
on a train.

---

## How a checkbox works, end to end

The path worth tracing once, because everything else follows the same shape.

1. **`src/data/weeks.ts`** holds the 24 weeks. It was generated from the old
   app's HTML by script, never retyped. Task order is load-bearing: progress
   keys are `w{week}t{index}`, so reordering a week's tasks would silently
   re-point every tick in an existing backup.

2. **`RoadmapPage`** renders `WeekCard`s. No arithmetic happens in the markup —
   `weekProgress(week, state)` comes from `state/progress.ts`.

3. Clicking a task calls **`toggleTask(id)`** from `useAppState()`.

4. **`AppStateContext`** holds the one copy of `AppState` and replaces it
   immutably. Every component using `useAppState()` re-renders. At this size
   that is microseconds, and the alternative — several contexts, or a state
   library — costs far more in indirection than it saves.

5. An effect writes the new state to `localStorage`. It runs *after* the render
   commits, so the UI never waits on storage.

6. A second effect (in `useProgressSync`) pushes to `/api/progress` about two
   seconds later, if a passcode is set. If not, nothing happens and the app
   works exactly as before.

**To change what a checkbox does, you need `data/weeks.ts`, `state/progress.ts`
and `AppStateContext.tsx`. Nothing else.**

---

## Where the logic lives

Everything testable is a pure function taking inputs and returning values. No
dates, no percentages, no comparisons inside JSX. These are the files worth
knowing:

| File | Answers |
|---|---|
| `state/progress.ts` | current week, week/phase/overall percentages, readiness label |
| `state/storage.ts` | load, save, merge, export, import |
| `notes/gitBlobSha.ts` | the SHA git itself would give a file |
| `notes/noteStatus.ts` | draft / published / modified |
| `notes/frontmatter.ts` | the note file format, slugs, the template |
| `notes/markdown.ts` | the ~120-line renderer, ported from the old app |
| `notes/publishPlan.ts` | what a publish will change, the commit message, the index |
| `notes/syncDecisions.ts` | which side wins in a sync conflict |
| `config/repoConfig.ts` | the publishing target and its validation |

They have 199 tests between them, and those are the tests worth keeping honest.

---

## Note status is derived, never stored

The one idea in the notes system worth understanding properly.

A note's status is not a flag someone sets. It is computed:

```
git blob SHA = sha1("blob " + byteLength + "\0" + content)
```

Render the file we would publish, hash it the way git does, compare with the SHA
GitHub returned at the last publish:

- no `publishedSha` → **draft**
- SHAs equal → **published**
- SHAs differ → **modified**

This is exact, needs no second copy of the content, and reuses GitHub's own
identity for a file. It also gets right the case a dirty flag gets wrong: type a
character, delete it, and the note is byte-identical again, so it goes back to
*published* rather than staying *modified*.

Two traps, both with tests guarding them:

- The length is in **bytes**, not characters. Hashing `content.length` passes
  every ASCII test and fails on any note containing `→` or `·`.
- The frontmatter has an `updated:` line, so the file must be rendered from the
  note's **own last-edit time**, not today's date — in `usePublish` *and* in
  `noteStatus`. Render one with today's date and every note reads as modified the
  moment it is published.

---

## Save versus publish

Deliberately different things:

**Save** (`Ctrl/Cmd+S`) writes to IndexedDB and schedules a sync. It does not
commit. It works offline and with no passcode.

**Publish** is explicit, and is the only thing that writes to GitHub. It needs a
token from the device flow, and it makes exactly **one commit** however many
notes changed:

1. read the branch ref → base commit SHA
2. read that commit → base tree SHA
3. upload each changed note → blob SHAs
4. one tree over the base tree (deletions are an entry with `sha: null`)
5. one commit with that tree
6. `PATCH` the ref with `force: false`

If step 6 returns 422 the branch moved: the tree is rebuilt on the new base and
retried **once**, then it fails with a clear message. Nothing is ever
force-pushed.

`notes/README.md` is generated from the notes that will exist *after* the commit
and goes in the same commit, so the index can never describe a state the
repository was never in.

---

## Security decisions, and their limits

**There is no GitHub token in any environment variable or committed file.**
Writing to the repo requires authorising from the UI each time.

- A **GitHub App**, not an OAuth App: an OAuth App's `repo` scope grants write
  access to *every* repository you own. A GitHub App's user token only reaches
  repositories where the app is installed, with only the permissions it declares.
- The token lives in **`sessionStorage`**, for `PUBLISH.tokenLifetimeMinutes`
  (15) rather than GitHub's 8 hours, and is discarded the moment a publish
  finishes.
- The refresh token is **discarded**. Refreshing needs the app's client secret,
  which would put a secret back on the server to save a 20-second
  re-authorisation. If that trade ever looks wrong, it is an isolated change in
  `deviceAuth.ts`.

Two honest limits:

1. **The token does pass through the server.** `api/github-auth.ts` proxies
   GitHub's two OAuth endpoints because `github.com` sends no CORS headers, and
   the poll response carries the token. It is forwarded, never stored or logged.
   Everything after authorisation goes straight to `api.github.com`.
2. **Forgetting the token locally does not revoke it at GitHub.** That needs the
   client secret this project deliberately does not have. Until GitHub's own
   expiry passes, revocation means Settings → Applications → Revoke, which the UI
   links to.

The notes passcode is separate and weaker: it gates `/api/*` and lives in
`localStorage`. It is compared in constant time on hashes of both sides, and it
**fails closed** — an unset `NOTES_PASSCODE` rejects everything rather than
opening the store to the internet.

---

## Which file to open

| To change | Open |
|---|---|
| roadmap content, tasks, weeks | `src/data/weeks.ts` |
| skills, resources, metrics | `src/data/{skills,resources,metrics}.ts` |
| any fixed prose on any page | `src/data/content.ts` |
| a number that looks wrong | `src/state/progress.ts` |
| what gets saved or imported | `src/state/storage.ts` |
| colours, fonts, shared styles | `src/styles/tokens.css`, `global.css` |
| one component's styling | the `*.module.css` beside it |
| the note file format | `src/notes/frontmatter.ts` |
| how publishing works | `src/notes/usePublish.ts`, `github.ts` |
| where notes publish to | Settings → Publishing target (defaults in `app.config.ts`) |
| a new page | `src/App.tsx` + `components/layout/navItems.ts` |

---

## Decisions you might want to reverse

Each of these was a real fork in the road.

**Collapsed week cards render nothing.** The old app kept all 120 tasks in the
DOM and hid them with CSS. This renders only what is open — but browser Ctrl+F
will not find text inside a collapsed week. One-line change in `WeekCard.tsx`.

**The publishing target is editable in Settings.** The spec originally said
configuration lives in code, with no UI. It moved into the UI on request: you can
retarget without a redeploy, at the cost of the values being wrong at runtime,
which is why `repoConfig.ts` validates every field. `app.config.ts` still holds
the defaults.

**Progress syncs through Redis.** Not in the original plan — progress was
localStorage only. Conflict handling is blunter than the notes': last write wins,
no prompt, because the worst case is one checkbox rather than a paragraph.

**The `/api/github-auth` proxy sits behind the notes passcode.** Not required by
the device flow. It stops a stranger who finds the URL minting device codes
against the app, at the cost of needing the passcode set before authorising.

**No author or committer is sent with publish commits.** GitHub attributes them
to whoever authorised the token. Sending the local git identity would stamp them
with whatever this machine is configured with — the wrong account on a work
laptop.

**The week picker was removed from the note editor.** A new note still records
the current week in its frontmatter automatically; there is just no control for
it. To drop the field entirely, remove it from `renderNoteFile`.

---

## Testing

`npm test` — 199 tests, all pure functions and API handlers, no DOM.

The ones that matter most, and why:

- **`gitBlobSha.test.ts`** asserts against values from real `git hash-object`
  runs, not a second implementation. If this drifts, every note's status is wrong.
- **`storage.test.ts`** imports a fixture in the old app's exact export shape.
  Real progress depends on that continuing to work.
- **`deviceAuthRules.test.ts`** covers every documented device-flow response. A
  missing case shows up as a spinner that never resolves.
- **`github.test.ts`** pins `force: false`, mode `100644`, `sha: null` deletion
  and base64-over-UTF-8.

**What is not tested:** IndexedDB itself (no `fake-indexeddb`, so the `upgrade`
callback and the two-store transactions are unproven), and anything against a
live Upstash or GitHub. The endpoint tests drive an in-memory fake.

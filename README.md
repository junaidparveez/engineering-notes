# SDE Career OS

A personal tracker for a 24-week backend/SDE-II preparation plan: the roadmap and
its 120 tasks, a skill-gap map, an interview-conversion tracker, and a notes
editor that publishes to GitHub.

A React rewrite of a single-file HTML app. Same content, same design, same saved
data — a progress backup exported from the old version imports here unchanged.

---

## Running it

Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 199 tests
npm run build    # type-check + production build
```

Everything except notes sync and publishing works with no setup at all:
progress is saved in the browser, notes are saved in IndexedDB.

---

## Deploying to Vercel

1. Import the repository in Vercel. The framework preset is detected as Vite;
   the `api/` folder becomes serverless functions automatically.
2. Add the Upstash integration — `vercel install upstash`, or the Marketplace in
   the dashboard. It injects `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
3. Set `NOTES_PASSCODE` to a long random string. This is the only thing
   protecting your notes; nothing else guards `/api/*`.
4. **Settings → Git → Ignored Build Step:**

   ```bash
   git log -1 --pretty=%s | grep -w "\[skip ci\]" && exit 0 || exit 1
   ```

   Publishing notes commits to this same repository. Without this, every
   published note spends a deployment rebuilding a site whose code did not
   change.

### Environment variables

Three. Note what is *not* here: no GitHub token.

| Name | Where from |
|---|---|
| `NOTES_PASSCODE` | you invent a long random string |
| `UPSTASH_REDIS_REST_URL` | injected by the Upstash integration |
| `UPSTASH_REDIS_REST_TOKEN` | injected by the Upstash integration |

---

## Turning on sync

Open **Settings → Device sync** and enter the same value you set as
`NOTES_PASSCODE`. Notes and roadmap progress then follow you between devices.

The passcode is stored in that browser only. On a shared or work machine, know
that anything with access to the browser profile can read it — it is not a
GitHub credential and grants nothing but the notes. **Forget passcode** clears it.

---

## Publishing notes to GitHub

### 1. Create a GitHub App

GitHub → Settings → Developer settings → **GitHub Apps** → New GitHub App.

- **Homepage URL**: your Vercel deployment URL. **Callback URL**: the same
  (unused, but the field is required).
- **Enable Device Flow: checked.** It is off by default, and the flow fails with
  `unsupported_grant_type` without it. This is the single most common mistake.
- **Webhook → Active: unchecked.**
- **Repository permissions → Contents: Read and write.** Nothing else.
- **Where can this be installed**: only on this account.

Create it, then **Install App** and select only the repository you want notes
published to.

A GitHub App rather than an OAuth App is deliberate: an OAuth App's `repo` scope
grants write access to *every* repository you own. A GitHub App's user token only
reaches repositories where the app is installed, with only the permissions it
declares.

### 2. Point the app at your repository

**Settings → Publishing target**: owner, repository, branch, notes folder, and
the Client ID (`Iv23li…`) from the app you just created. These are stored in your
browser, over the defaults in `src/config/app.config.ts`.

The Client ID is public by design — the device flow exists for clients that
cannot keep a secret, which is why there is no client secret anywhere in this
project. **Do not paste the client secret here**; the field rejects it.

**Check repository** confirms the target exists without needing a token.

### 3. Authorise, then publish

**Settings → GitHub publishing → Start authorisation** shows a code to enter at
`github.com/login/device`.

> Open that link in the browser profile signed in as the account that owns the
> repository. The card copies the link rather than opening it, because your
> default browser may be signed in as someone else.

Then, on the Notes page, **Publish** shows exactly what will change — grouped as
New / Updated / Removed — before anything is sent. Confirming makes **one commit**
however many notes changed, and shows the commit link.

**Pull from GitHub** is the reverse, for a new device or for recovery. It is
never automatic.

### About the token

- Held in `sessionStorage` for 15 minutes (`PUBLISH.tokenLifetimeMinutes`), and
  discarded as soon as a publish finishes.
- **Forgetting it in the app does not revoke it at GitHub.** That needs the
  client secret this project deliberately does not have. To end it server-side:
  GitHub → Settings → Applications → Authorized GitHub Apps → Revoke. The UI
  links there.

---

## Backing up progress

**Settings → Manual backup** exports `junaid-career-os-progress.json` and imports
it back, including backups from the old single-file app. Optional once sync is
on — it is a snapshot you can keep, and the way old progress gets in.

Import replaces everything, so it refuses any file that does not look like a
progress backup rather than silently resetting you to zero.

---

## Layout

```
src/
  data/        the roadmap, skills, resources, metrics and every fixed string
  state/       progress: context, persistence, pure calculations
  notes/       IndexedDB, sync, device flow, Git Data API, publishing
  components/  one folder per view, CSS Module beside each component
  config/      defaults and the publishing target
  styles/      design tokens and shared primitives
api/
  drafts.ts        notes in Upstash, passcode-gated
  progress.ts      roadmap progress in Upstash, same gate
  github-auth.ts   device-flow proxy (CORS workaround only)
```

`docs/ARCHITECTURE.md` covers how data flows through those, what save does versus
publish, which file to open for which change, and the decisions worth reversing.

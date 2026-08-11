# Getting the data shared across devices

Parked on 11 Aug 2026. Nothing here is built. The app still keeps everything in
`localStorage` on whichever device you are sitting at, and that is deliberate for now.

## Where things stand today

The app is a static single-page build with no server behind it. The whole portfolio is one
JSON object, written to `localStorage` every time anything changes
(`src/store/portfolio.tsx`, the effect at `useEffect(... [portfolio])`) and read back once
on boot (`load()`). There is no deploy configuration in the repo, so the site only runs
where it is built.

That means "see the same data from any device" is really two jobs:

1. put the app itself on a URL, and
2. put the data somewhere both devices can reach.

The single-document shape makes the second job cheaper than it sounds. One object in, one
object out, and `normalise()` already backfills every field added since a saved blob was
written — so a document fetched from a server loads through exactly the same path a
document from `localStorage` does. No migration work is needed to start.

## The shape I would build, whichever backend is chosen

Keep the single document. A row of `portfolios (id, doc jsonb, version int, updated_at,
updated_by)`. The client holds the `version` it last read, and a save is
`update … where id = ? and version = ?`.

If that statement touches zero rows, somebody else saved in the meantime. The app fetches
their version and offers a choice — reload theirs, or overwrite with mine — rather than
guessing. **This part is not optional.** Every save sends the entire portfolio, so without
a version check two people editing at once means the second save silently erases the
first one's work.

Writes to the network debounce by about 1.5 seconds, so typing in the Gantt grid does not
fire a request per keystroke, while `localStorage` still takes every change and becomes the
offline cache. A small status line in the sidebar says which state you are in: *Saved
14:02*, *Offline — changes kept on this device*, or *Someone else saved*.

## Option 1 — Supabase (the recommendation)

Postgres, authentication and row-level security in one free-tier project.

1. Create the project, add the table above, and set RLS so only signed-in members can read
   or write it.
2. Add `@supabase/supabase-js`. The project URL and anon key live in `.env` and ship inside
   the bundle — that is fine and expected, because RLS is what protects the data, not the
   key.
3. New `src/lib/remote.ts` exposing `fetchDoc()`, `saveDoc(doc, version)` and
   `subscribe(cb)`.
4. Rework `PortfolioProvider`: paint immediately from `localStorage`, then fetch the remote
   document and adopt it if it is newer. Saving writes `localStorage` always and debounces
   to the network.
5. Magic-link sign-in by email. Nothing renders until you are signed in.
6. Settings gains "Push this device's data up" and "Pull server data down" for the one-time
   migration, alongside the export it already forces before anything destructive.
7. Deploy from the repo so the URL is the same everywhere.

Strengths: real per-person logins, a record of who saved last, access removable one person
at a time, and live sync between open tabs if wanted. Cost: a second vendor account.

## Option 2 — Cloudflare Worker over KV (the lighter one)

Roughly sixty lines of Worker in front of a KV namespace holding the same JSON, with the
site on Cloudflare Pages. One vendor, very little to reason about.

The trade is the security story: a single shared passphrase rather than accounts, so there
is no record of who changed what and rotating it disrupts everybody at once. No live sync.

## Option 3 — Firebase Firestore

Comparable effort to Supabase with stronger realtime. Heavier lock-in, and the document
model fits a single large blob slightly less naturally.

## Option 4 — no backend, sync the file

Keep `localStorage` and move the existing JSON or CSV export through OneDrive or Dropbox by
hand. No build work at all, but it produces copies that people carry around, not shared
data — two people will diverge the first week. **This is effectively where we are now.**

## Rejected: commit the JSON to this repo from the browser

Free and versioned, but it needs a GitHub token in the browser and offers no concurrency
control whatsoever. Not worth it.

## Two things to decide with open eyes

**The data is commercial.** Clients, budgets, invoice dates, named people and their
workload. Once it is on a public URL, anyone holding that URL has all of it. Sign-in
belongs in the same change as the shared store, not in a follow-up.

**Shared storage makes concurrent editing possible for the first time.** The version check
described above is the minimum that keeps that honest.

## Effort

Backend setup is about half an hour of clicking, or scriptable given a token. The client
side is roughly 250–350 lines across the store, the remote layer, sign-in and the status
line, plus browser verification. One working session.

## Open questions, for when this is picked up

- Which backend (Supabase / Cloudflare + KV / Firestore / stay local).
- Sign-in: per-person email links, one shared passphrase, or a secret URL.
- Where the site itself is hosted: Cloudflare Pages, Vercel, Netlify, or somewhere internal.

# Testing dashboard → Brick Breaker asset flow locally

> ## Your machine, as found on 2026-08-27
>
> You already run your own stack from `C:\Users\BITPATNA\Game-Dev`:
>
> | Piece | Where | State |
> |---|---|---|
> | Backend | port **3000**, DB `game_backend` on Postgres 18 (:5432) | up, but **every collections query fails** |
> | Dashboard | port **5173**, `.env` → `http://localhost:3000/api` | up, logs in, shows "No collections found" |
>
> **Root cause:** the DB was created with `npm run migrate` (applies
> `schema.sql` — 7 tables, *no* collections) and the backend runs with
> `AUTO_MIGRATE=false`, so migrations 002–009 never executed. Every
> collections call dies with `relation "asset_collections" does not exist`.
>
> **One-time fix:** run `fix-collections-db.ps1` (next to this file). It
> backs up the DB, applies 002–009 (additive only), and records bookkeeping
> so `AUTO_MIGRATE=true` won't collide later. No server restart needed.
> (Ignore/delete the same-named copy inside `Game-Dev\gamebackend` — it has
> a syntax bug; this folder's copy is the good one.)
>
> After that, your own dashboard at http://localhost:5173 can create
> collections and upload assets, and the game patch targets it with
> `--api http://localhost:3000`.
>
> The generic from-scratch guide below is for a clean machine or a teammate.



The full loop on one machine: upload a sprite in the **dashboard UI**, mark its
collection live, reload the game, see the sprite in play. No AWS, no phone
needed (phone optional at the end).

Everything referenced here lives in the `Game-Dev` repo, branch
`feature/brickbreaker-asset-integration`.

```
git clone https://github.com/PanScienceInnovation/Game-Dev.git
cd Game-Dev
git checkout feature/brickbreaker-asset-integration
```

---

## 1. Database (PostgreSQL)

Any Postgres 14+ works. Create an empty database:

```bash
createdb game_analytics
```

> **Do not run `npm run migrate` on a fresh DB.** It applies `schema.sql`,
> and the server then applies the numbered migrations on boot — both create
> the same triggers, and the second one dies with
> `trigger "update_users_updated_at" ... already exists`.
> On a clean database, just start the server (step 2); it runs all nine
> migrations itself.

## 2. Backend (port 5000)

```bash
cd gamebackend
npm install
```

> **Known bug on `main`:** `.env` is silently ignored by the scripts —
> `database.js` reads `DB_*` before dotenv runs (PR #1 fixes this). Until
> that merges, put the variables in the environment itself:

PowerShell:

```powershell
$env:DB_HOST="localhost"; $env:DB_PORT="5432"; $env:DB_NAME="game_analytics"
$env:DB_USER="postgres";  $env:DB_PASSWORD="<your postgres password>"
$env:USE_LOCAL_STORAGE="true"; $env:API_BASE_URL="http://localhost:5000"
$env:JWT_SECRET="dev_secret"; $env:JWT_REFRESH_SECRET="dev_refresh_secret"
$env:AUTO_MIGRATE="true"; $env:RATE_LIMIT_MAX_REQUESTS="10000"
node src/server.js
```

Wait for `🚀 Server running on port 5000` (it logs each migration first).

Then seed the admin login (same env vars, second terminal):

```powershell
node scripts/seed.js
```

Credentials: **admin@gameanalytics.com / admin123**

`USE_LOCAL_STORAGE=true` stores uploads in `gamebackend/uploads/` and serves
them from `http://localhost:5000/uploads/...` — no S3 or AWS keys needed.

## 3. Dashboard (port 5173)

```bash
cd gamedashboarrd
npm install
npm run dev
```

Open **http://localhost:5173** — it points at `localhost:5000/api` by default
and already proxies `/uploads` for image previews. Log in with the admin
credentials above.

## 4. Upload assets in the UI

On the **Assets** page, upload PNGs named after Brick Breaker's texture keys —
the name is the whole contract:

| Upload as | Replaces |
|---|---|
| `brick0` … `brick5` | the six brick colours (all on level 1) |
| `rdBall0` | the ball you actually play with (CLASSIC equipped) |
| `ball` | fallback ball only — upload both to be safe |
| `padWood` | the default paddle |

`brick0.png` / `Brick0` also match — extension and case are ignored.

Put them in a collection and mark that collection **active for game**
(collections UI → set active).

> Prefer scripted over clicking? `brickbreaker-integration/demo/seed-demo-assets.js`
> does upload + activate in one run, generating throwaway striped sprites:
> `node seed-demo-assets.js` (and `--revert` to undo).

## 5. The game

The game is **not in the repo**. Patch your local copy (one-time per build):

```bash
cd brickbreaker-integration/demo
node patch-index-html.js "<path to brickbreaker>/www/index.html" game.html
cd .. && npx serve .        # or: python -m http.server 8100
```

Open `game.html` via that server (not file://). On boot the console prints:

```
[remote-assets] collection "…": N sprite(s) replaced -> brick0, …
```

and level 1 shows the uploaded art. If the backend is down, the game boots
normally on its built-in art — the integration fails open by design.

## 6. From a phone (optional)

Same network, use your machine's LAN IP (e.g. `192.168.1.39`):

```bash
node patch-index-html.js <path>/index.html game.html --api http://192.168.1.39:5000
```

and open `http://192.168.1.39:<port>/game.html` on the phone. Windows
Firewall must allow inbound 5000 + the static port (first run usually
prompts).

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `SASL: client password must be a string` | `.env` not read (the dotenv-order bug) — export `DB_*` in the environment |
| `GET /api/collections` returns 500 | Known `main` bug: missing `order` param → `order.toLowerCase()` TypeError. The dashboard sends it; bare curl must too |
| `trigger … already exists` on boot | You ran `npm run migrate` first — drop/recreate the DB and let the server migrate |
| Game shows old art after upload | Re-uploading a name **adds** a row; the loader picks the newest by `uploaded_at`, so hard-reload (Ctrl+F5). Check the collection is the **active** one |
| Sprites fine in dashboard, game unchanged | Asset names don't match texture keys — check the table above; also confirm the ball went to `rdBall0`, not just `ball` |
| Game boots on built-in art, console shows a timeout | Backend unreachable from the game's origin — wrong `--api` host, or firewall |

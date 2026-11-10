## Changes

**Integration (new — `brickbreaker-integration/`)**
- `remote-assets.js` — loader that reads `GET /api/collections/active/assets?game=brickbreaker` at boot and swaps uploaded assets into the game by texture-key name; fails open if the backend is unreachable.
- `demo/` — sprite generator, upload/activate script, and a patch tool (no game binary or image assets committed).
- README — asset naming table + setup steps.

**Backend fixes**
- `DELETE /api/assets/:id` — was public + hard-delete; now admin-only + soft-delete (recoverable).
- `GET /api/collections` — no longer 500s when `order` is missing (defaults to `DESC`).
- `gameResolver` — added a 60s cache TTL so a deactivated game's slug stops resolving without a restart.

**Docs**
- `gamebackend/README.md` — added a Brick Breaker Integration section (name → texture-key table).

Built on PR #2 (games registry). 9 files, merges cleanly onto it.

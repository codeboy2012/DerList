# DerList — Recovery Audit & Private Wishlist Simplification

**Date:** 2026-11-18
**Recovered from:** `sleepy@homelab:/home/sleepy/DerList` (GitHub remote `codeboy2012/DerList`)
**Working copy:** `C:\Users\sleepy\Documents\DerList`
**Live reference:** https://derlist.dpdns.org/ (served by `derlist-staging` containers on the homelab)

---

## 1. How this copy was produced

- Connected to the homelab over SSH. The host alias `homelab` was **not** present in `~/.ssh/config`; authentication succeeded with the existing `~/.ssh/lcfeed_ed25519` key using `IdentitiesOnly=yes`.
- The path in the brief, `~/Derlist`, does not exist — the real directory is `~/DerList` (capital L). That is the repository with the GitHub remote; it was used as the source.
- Copied with a streamed `tar`, excluding `node_modules/`, `.next/`, `*.tsbuildinfo`, `*.log` and `.env` (secrets were never copied).
- The live site runs a separate tree, `~/derlist-staging`, which is **three commits ahead** of `DerList` (dependency/security upgrades and import/security fixes). To keep the copy identical to what is deployed, those commits were fast-forwarded in with `git fetch ssh://homelab/home/sleepy/derlist-staging` + `git merge --ff-only`. Local `HEAD` is now `a981670`.
- Destination size after copy: **11 MB** (438 tracked files) plus a local `node_modules` that was rebuilt on Windows.
- The Linux source was never modified. `.git` history and the original remote are intact.

> Backup rule: nothing existed at `C:\Users\sleepy\Documents\DerList` beforehand, so no backup was required. The workspace folder `Documents\DerList-remake` was left untouched (it only contained `.freebuff`).

---

## 2. Actual architecture (as found)

| Area       | Implementation                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework  | Next.js **16.4.5** (App Router, Turbopack), React 19.2, TypeScript 5                                                                                         |
| Styling    | Tailwind CSS 4 (`@import 'tailwindcss'`, `@theme inline` tokens), Geist fonts                                                                                |
| Database   | PostgreSQL 16+ via Prisma 7.10 with the `@prisma/adapter-pg` driver adapter                                                                                  |
| Auth       | Custom session auth: Argon2id hashes, SHA-256 session tokens in `sessions`, HttpOnly `derlist_session` cookie, GitHub/Google OAuth, invite-only registration |
| Backend    | Server Actions + Route Handlers under `src/app/api/**`                                                                                                       |
| Jobs       | In-process scheduler/worker (`src/lib/jobs/*`) for product refresh & price history                                                                           |
| Media      | Local uploads under `UPLOAD_DIR`, served by `/uploads/[...path]`                                                                                             |
| Deployment | Docker Compose (app + worker + Postgres + rembg), Caddy reverse proxy, `output: 'standalone'`                                                                |

Key directories:

```
src/app/(marketing)   public site: home, features, roadmap, changelog, security, status…
src/app/(app)         authenticated shell: dashboard, wishlists, assistant, settings
src/app/admin         owner/admin: users, invitations, providers, waitlist, audit
src/app/api           product identify/research/enrich/search, wishlist import/copy, AI, uploads
src/lib/importers     Amazon, Best Buy, Newegg, PCPartPicker, generic URL, text, multi-URL
src/lib/products      metadata extraction, pipeline, identification providers, price parsing
src/lib/providers     AI (OpenAI/Anthropic/Gemini/Vertex/OpenRouter/Ollama), search, Keepa
src/lib/services      wishlist/product/enrichment/research/assistant services
prisma/               schema + 24 migrations (applied) + seed
tests/                Vitest suites for importers, identification, validation, security
```

Data model highlights (27 tables): `User`, `Session`, `OAuthAccount`, `Invitation`, `Waitlist`,
`AuditLog`, `Wishlist` → `WishlistItem` → `Product` (shared product record), `WishlistCategory`,
`WishlistMember`, `Media`, provider tables (`ProviderConfiguration`, usage, price alerts),
`PriceHistory`, `ProductChange`, `ProductFetchJob`, `ShoppingConversation`.

---

## 3. Feature inventory found

**Wishlists** — multiple lists, icon/colour/description, sort order, archive, duplicate (with options),
delete, categories/folders with metadata, Top Picks, "Most Wanted", star priority (1–4) plus
LOW/MEDIUM/HIGH/CRITICAL, quantity, purchased state, notes, per-list stats, search (list index),
sort (position/price/name/priority/newest), filter (all/wanted/purchased), list & category views.

**Products** — rich editor drawer (imported metadata, gallery, sellers, specs), price display with
discount badges, retailer tagging, product detail page with price history + refresh, image upload.

**Importing** — universal input (URL, product name, multi-line lists, PCPartPicker), retailer-specific
importers/parsers, generic metadata extraction (JSON-LD → OpenGraph → Twitter → heuristics),
AI identification with confidence/completeness scoring, enrichment streaming, image resolution and
SSRF-safe fetching, JSON/CSV-ish wishlist import endpoint, manual entry.

**AI** — provider registry with encrypted API keys, feature routing, shopping assistant chat,
AI organiser (categories), folder suggestions.

**Account** — profile edit, password change (invalidates other sessions), OAuth linking/unlinking,
active session list.

**Admin** — users, invitations, waitlist review/export, provider management, audit log.

**Marketing** — full public site with hero/features/roadmap/security/status/changelog pages,
waitlist ("beta access") form.

**Public sharing (removed — see §5)** — `/u/[username]/wishlist/[slug]`, visibility selector
(PRIVATE/UNLISTED/PUBLIC), share URL and share button.

---

## 4. Local development on this Windows machine

No Node.js, Postgres or Docker existed on the machine. Nothing system-wide was installed:

| Need           | Solution                                                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node/npm       | Portable Node (LTS) unpacked into `.tools/node` (git-ignored)                                                                                                                             |
| Postgres       | PostgreSQL 18 installed inside the existing **WSL Ubuntu** distro (`apt`), database `derlist`, user `derlist`, port 5432 on `127.0.0.1`                                                   |
| WSL keep-alive | WSL2 shuts the VM down when idle, taking Postgres with it. A background `wsl … sleep infinity` process keeps it reachable. Restart it (and `pg_ctlcluster 18 main start`) after a reboot. |

Local `.env` (git-ignored, **local only** — the production `.env` was deliberately not copied):

```env
DATABASE_URL="postgresql://derlist:<local dev password>@127.0.0.1:5432/derlist"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PROVIDER_ENCRYPTION_KEY="<generated>"
UPLOAD_DIR="./uploads"
ADMIN_EMAIL="admin@derlist.local"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="<local password>"
ADMIN_DISPLAY_NAME="Admin"
```

Commands (prefix `PATH="$PWD/.tools/node:$PATH"` in Git Bash):

```bash
npm ci                     # deps (npm may need `npm install-scripts approve --all` + `npm rebuild`
                           # so Prisma engines and argon2 build)
npx prisma migrate deploy  # apply migrations
npx prisma db seed         # create owner account from ADMIN_* vars
npm run dev                # http://localhost:3000
npm run build              # production build (passes)
npm test                   # Vitest suites
```

Local sign-in used for testing: `admin@derlist.local`. Test collections were deleted afterwards.

---

## 5. Changes made in this pass

### Preserved identity

Dark-first DerList palette, Geist typography, blue accent, sidebar/header shell, card and badge
language, marketing site, import pipeline and AI provider stack are all untouched.

### Local settings (new — device-scoped, no database)

- `src/lib/preferences/local-settings.ts` — defaults, validation, DOM applier, pre-paint boot script,
  and a tiny external store consumed through `useSyncExternalStore`.
- `src/components/preferences/PreferencesProvider.tsx` — provider; follows OS theme in "System" mode.
- `/settings/appearance` — theme (system/light/dark), 6 accent colours, Liquid Glass
  (off/subtle/full), reduce motion, reduce transparency, always-show focus, blur product images,
  blur prices. Persisted in `localStorage` under `derlist.preferences.v1`.
- Light theme tokens and `data-glass`/`data-motion`/`data-transparency`/`data-focus`/privacy rules
  added to `globals.css`; header uses the glass surface.

### Wishlist / product work

- New `WishlistItem` columns: `model`, `condition`, `targetPrice`, `availability`
  (migration `20261118040807_wishlist_item_personal_fields`, additive and nullable — no data loss).
- Manual add form on the add-item panel (name, brand, model, category, condition, current/target price,
  currency, quantity, URL, notes) — unknown values stay empty, never invented.
- "Edit product" dialog per item: name, brand, model, category, condition, prices, currency,
  availability, quantity, priority, description, notes, **collection** — plus a shortcut to the full
  imported-product editor.
- Moving an item between collections re-parents only that entry; product records and other
  collections keep working.
- Search inside a collection (`?q=`), with an explicit "No matches" state.
- Item rows now surface model, condition, availability and target price ("reached" when current ≤ target).

### Account

- `GET /api/account/export` — full JSON export (account, collections, categories, items) with no
  provider secrets.
- `/settings/account` — "Your data" card with export and permanent account deletion (password +
  typing DELETE required; cascades collections/items/sessions, clears the session cookie).

### Marketplace functionality removed

- Public wishlist pages: deleted `src/app/u/**` (and with it every public wishlist URL).
- Visibility selector removed from create/edit forms; actions force `PRIVATE`
  (the enum column stays for existing rows — no data deleted).
- Share URL block, visibility badges and "Public/Unlisted" copy removed from the wishlist UI.
- Admin product catalogue: deleted `src/app/admin/products/**`, its nav entry and command-palette item.
- Public beta funnel: deleted `(marketing)/BetaAccessForm.tsx` + `beta-action.ts`, removed the
  "Request Beta Access" section/anchor, replaced the hero CTA with "Open DerList", updated FAQ copy.
- Admin waitlist pages were **kept** (admin-only view of existing rows; no public signup remains).

---

## 6. Problems found and fixed

1. **Prisma CLI could not see the database** — `prisma.config.ts` loads `.env` only, while Next loads
   `.env.local`. Consolidated local config into `.env` (documented above).
2. **npm blocked native install scripts** (npm ≥ 11 allow-scripts) so Prisma engines/argon2 were
   missing. Fixed locally with `npm install-scripts approve --all` + `npm rebuild`.
3. **WSL Postgres died when the VM idled**, breaking `migrate deploy`. Needs a keep-alive process
   (documented in §4); `nohup sleep infinity &` inside WSL is not sufficient.
4. **`addItemAction` rejected forms with omitted optional fields** — missing inputs read as `null`,
   which Zod's `.optional()` rejects. Omitted fields are now treated as unknown.
5. **Horizontal overflow at 390 px** on the wishlist page: unwrappable sort/filter pill groups and a
   non-shrinking title/price row forced a 434 px layout. Both now wrap; `scrollWidth` ≤ viewport.
6. Pre-existing repo lint debt remains (≈33 errors across older files, mostly
   `react-hooks/set-state-in-effect` in existing components). **No new lint errors** were introduced;
   all changed files lint clean.

---

## 7. Verification performed

| Check                                      | Result                                                            |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `npx tsc --noEmit`                         | pass                                                              |
| `npm run build`                            | pass (all routes compiled; `next dev` + `next start` compatible)  |
| `npx eslint` on changed files              | 0 errors (only pre-existing `<img>` warnings)                     |
| Migrations + seed against local Postgres   | 24 migrations applied, owner created                              |
| Sign-in flow (browser)                     | pass → `/dashboard`                                               |
| Create collection (browser)                | pass, stored `PRIVATE`                                            |
| Add product manually (browser)             | pass — brand, model, prices, target persisted                     |
| Edit product dialog (browser)              | pass — condition, availability, notes, category updated           |
| Move product between collections (browser) | pass — only `wishlistId` changed                                  |
| Search within collection (`?q=`)           | pass                                                              |
| Theme/accent change + reload persistence   | pass (`data-theme=light`, accent `#8b5cf6`)                       |
| Privacy "blur prices"                      | pass (`filter: blur(7px)` on `[data-price]`)                      |
| `/api/account/export`                      | pass — 200, JSON, correct collections/items                       |
| Responsive at 390×844                      | sidebar hidden, hamburger shown, no horizontal overflow           |
| Removed routes                             | `/u/*` and `/admin/products` no longer exist; no nav links remain |

**Not tested:** account deletion (destructive — implemented and type-checked but not executed),
OAuth sign-in (no provider credentials locally), real product URL imports (no AI/search keys —
the code path is exercised only up to provider selection), account export download as a file,
cross-user data isolation (single local user; every query is scoped by `ownerId`/session user).

---

## 8. Still simulated / not real

- **Price tracking & price-drop history** depend on a background worker and external price providers;
  the UI reads `PriceChange` rows, but nothing refreshes prices locally.
- **AI features** (identification enrichment, organiser, folder suggestions, shopping assistant,
  image parsing) need configured provider keys; without them DerList falls back to manual entry and
  metadata extraction only.
- **Availability** on products is only what an import/AI/provider supplied or the user typed — there is
  no live stock feed.
- **Shopping Assistant** remains in navigation; it is a real chat surface but only functional with a
  configured AI provider.
- Marketing pages still describe a broader roadmap (public sharing historically, price tracking, PC
  builder). They are static copy, not implemented features.

---

## 9. Suggested next milestone

1. **Collections polish**: drag-to-reorder, per-collection sort persistence, bulk move, archive rules.
2. **Import hardening with a real key**: rerun URL/AI import end-to-end, enforce "never fabricate"
   with an explicit unknown-field indicator in the editor.
3. **Price tracking opt-in**: wire the existing worker + one price provider, show a "last checked"
   timestamp and honest "unknown" states.
4. **Account completeness**: automated export test, deletion test on a throwaway account, and a
   "download before delete" nudge.
5. **Design pass on light theme**: audit contrast on marketing pages and admin screens (the dark
   identity is unchanged; light mode is new and only smoke-tested).

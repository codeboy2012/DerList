# DerList — Full Application Audit

**Date:** 2026-11-18 · **Scope:** `C:\Users\sleepy\Documents\DerList` (HEAD `a981670`) · **Mode:** read-only

> No source, config, schema, dependency or production state was changed. One temporary test collection
> was created through the UI to exercise the real flows and deleted afterwards; the local database is
> back to zero collections/items. No migrations, installs, commits or deployments were performed.

---

## A. Overall assessment

DerList is a mature, well-structured Next.js 16 application: Prisma 7/Postgres, session auth with
Argon2, server actions, admin tooling, a real import/enrichment pipeline and 211 passing unit tests.
The core private-wishlist experience (collections, manual products, per-item details, local appearance
settings, export) works end-to-end in a browser and the dark identity is intact.

It is **not yet consistently private or finished as a personal organizer**. Three areas need attention:
(a) the authorization boundary on item server actions is wrong (an item can be mutated through a
_different_ owned collection), (b) marketplace-era surfaces remain — a global product search API, global
"tracked by N users" stats, legacy `PUBLIC/UNLISTED` read paths, and marketing/docs that still sell
sharing and a PC builder, and (c) hygiene gaps: CI lint is red, uploads are public, the uploads route
is broken on Windows, and the schema carries dead sharing models that duplicate newer columns.

---

## B. Findings

| Category    | Finding                                                                                                                                                                                                                                                                                                                                                                                                                             | Priority     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Fix         | **IDOR in item server actions.** `updateItemAction`, `deleteItemAction`, `togglePurchasedAction` and `quickEditItemAction` (`wishlists/[id]/item-actions.ts`) check only that the submitted `wishlistId` belongs to the user, then update/delete the submitted `itemId` without confirming the item is in that collection. A user can edit/delete another account's item by pairing their own collection id with a foreign item id. | **Critical** |
| Fix         | `GET /api/wishlists/[id]/top-picks` returns another user's picks whenever the row is `PUBLIC`/`UNLISTED`, with no auth at all — a leftover of public sharing.                                                                                                                                                                                                                                                                       | High         |
| Fix         | `POST /api/wishlists/copy` allows copying any other user's `PUBLIC`/`UNLISTED` wishlist (only `PRIVATE` is blocked). Any legacy non-private list is still copyable by id.                                                                                                                                                                                                                                                           | High         |
| Fix         | `/api/products/search` searches the **global** product table (title, brand, image, price, canonical URL, SKU/GTIN) for any signed-in user, and no UI calls it. It exposes other accounts' imported products and contradicts the private-only direction.                                                                                                                                                                             | High         |
| Fix         | `/uploads/[...path]` compares a Windows path against `resolvedDir + '/'`, so every upload returns **403 on Windows** (verified with existing and missing files). Images stored locally never render for Windows self-hosters.                                                                                                                                                                                                       | High         |
| Fix         | `npm run lint` fails with **35 errors / 65 warnings** (mostly `react-hooks/set-state-in-effect` and immutability rules in `wishlist-live.ts`, `Modal.tsx`, `AppNav.tsx`). CI runs `npm run lint`, so the pipeline is red on `main`.                                                                                                                                                                                                 | High         |
| Fix         | Product detail page is reachable by id for **any** authenticated user and displays cross-account analytics ("tracked in N wishlists by M users"), price history and change log for products they do not own.                                                                                                                                                                                                                        | Medium       |
| Fix         | Uploaded files are served **without authentication** (`/uploads` documents this) and account deletion removes DB rows but leaves the files on disk. Product images from a private collection are permanently retrievable by anyone who learns the URL.                                                                                                                                                                              | Medium       |
| Fix         | `/settings/ai`, `/settings/providers` and `/assistant` redirect to `/auth/login`, a route that does not exist (login is `/login`); users who reach them with an invalid cookie hit a 404 instead of signing in.                                                                                                                                                                                                                     | Low          |
| Fix         | Delete uses native `window.confirm`, unlike the rest of the app's dialog system; it blocks automation and is easy to mis-click (it also stalled a real browser session here).                                                                                                                                                                                                                                                       | Low          |
| Improve     | Target price renders as `150.00 USD` beside `$199.99`, without a label or currency symbol — ambiguous at a glance and inconsistent with `ProductPrice`.                                                                                                                                                                                                                                                                             | Medium       |
| Improve     | Wishlist wording is inconsistent: pages say "Wishlist", the editor says "Collection", and folders are "Categories". Pick one vocabulary for the personal-organizer model.                                                                                                                                                                                                                                                           | Medium       |
| Improve     | The product editor drawer is a ~1,800-line component carrying its own copy of prices, sellers, notes and need-by dates inside `WishlistItem.metadata`, duplicating the new typed columns. Two sources of truth will drift.                                                                                                                                                                                                          | Medium       |
| Improve     | Rate limiting is missing on `/api/upload` and the import endpoints (AI endpoints are limited). Any authenticated user can push large uploads/imports; the limiter is in-memory, so it resets on restart and does not span replicas.                                                                                                                                                                                                 | Medium       |
| Improve     | API routes return raw `error.message` to clients in 16 places (provider/assistant/research errors). Keep generic messages client-side and log details.                                                                                                                                                                                                                                                                              | Low          |
| Improve     | CSP uses `'unsafe-inline'` for scripts without a nonce, and `allowedDevOrigins` includes the production host. Reasonable to tighten.                                                                                                                                                                                                                                                                                                | Low          |
| Improve     | Every image is a raw `<img>` (19) and `next/image` is unused; no optimisation, no width/height on several thumbnails.                                                                                                                                                                                                                                                                                                               | Low          |
| Improve     | One global `loading.tsx`; detail pages stream a bare "Loading…" shell. Per-route skeletons for wishlist/product would remove layout jumps.                                                                                                                                                                                                                                                                                          | Low          |
| Improve     | Two high-severity advisories in the installed tree (`fast-uri`, `source-map-js`), both reported fixable by `npm audit fix` (not run).                                                                                                                                                                                                                                                                                               | Medium       |
| Remove      | Marketing still advertises **public wishlist sharing**, a **free PC builder**, "live component pricing" and cross-device "closed beta" while the product is login-only and sharing was deleted. `README.md` and `docs/` repeat the same claims (public/unlisted, need-by dates, subfolders).                                                                                                                                        | High         |
| Remove      | Dead schema and code from the marketplace era: `WishlistMember` (unused), `visibility` enum/column/indexes and `notice`, the dashboard's `VisibilityDot`, and `visibility` reads in create/edit actions. Keep the columns until data is migrated, but stop reading/writing them.                                                                                                                                                    | Medium       |
| Remove      | Unused `src/components/coming-soon/WaitlistSection.tsx` (placeholder submission, not imported anywhere).                                                                                                                                                                                                                                                                                                                            | Low          |
| Add         | Authorization tests for every mutating server action/route (own vs foreign `wishlistId`/`itemId`), plus export/deletion tests. Current 211 tests cover importers, validators and security helpers only.                                                                                                                                                                                                                             | Medium       |
| Add         | A real collections model: reorder, per-collection sort memory, bulk move, and a "remove collection, keep products" path (today the only way is moving items first).                                                                                                                                                                                                                                                                 | Medium       |
| Add         | Honest "unknown" states in the editor (price/availability/condition) and a visible "last checked" timestamp where price data is absent.                                                                                                                                                                                                                                                                                             | Low          |
| Investigate | URL/AI import was not end-to-end verifiable here (no provider keys, no search provider); `after()` enrichment depends on a configured provider. The pipeline code and its tests look sound but the real flow is unproven.                                                                                                                                                                                                           | High         |
| Investigate | Price tracking, price history and refresh jobs require the separate `worker` service (Docker). Without it the product page shows empty history; confirm production actually runs the worker and schedules refreshes.                                                                                                                                                                                                                | High         |
| Investigate | `FolderSuggestionService` accepts `subfolders` but `WishlistCategory` has no parent relation, so "subfolders" are flattened. Decide: model nesting or drop the claim.                                                                                                                                                                                                                                                               | Medium       |
| Investigate | Account export claims to contain everything stored, but omits AI conversations, price history, media and provider metadata (deliberately or not).                                                                                                                                                                                                                                                                                   | Medium       |
| Investigate | CSRF relies on `SameSite=Lax` cookies plus Next server-action origin checks; there is no per-request token on API routes. Acceptable for same-origin JSON, worth a deliberate decision.                                                                                                                                                                                                                                             | Low          |

---

## C. What already works

- **Auth & sessions:** Argon2id hashes, SHA-256-hashed session tokens, HttpOnly/Lax/Secure-in-production cookies, sliding expiry, disabled-account checks, login rate limits (IP + account), invite-only registration, OAuth with state validation, password change invalidating other sessions.
- **Authorization:** every wishlist page and most actions/routes scope by `ownerId`/`userId`; admin areas are double-gated by proxy + `requireAdmin` (23 usages); export returns only the caller's data.
- **Core wishlist flow (browser-verified):** create collection, manual add with brand/model/condition/prices, per-item edit dialog, save condition/availability/notes, move between collections, in-collection search with a real empty state, priority, purchased, archive, duplicate.
- **Settings:** profile, password, active sessions, OAuth linking; local appearance (theme/accent/glass/motion/privacy) persists in `localStorage`, applies pre-paint and survives reload; export returns a correct JSON document.
- **UI quality:** consistent dark/blue identity, native `<dialog>` modals with focus trap/restore, skip link, labelled inputs, headings and alt text on audited pages, no horizontal overflow at 390 px (scrollWidth 384), mobile menu present.
- **Platform:** clean `tsc`, clean production build, 24 migrations + seed, Docker Compose with a dedicated worker, CI workflow (lint/test/typecheck/build), SSRF-safe fetch and upload validation with tests.

---

## D. What is simulated or unfinished

- **Shopping Assistant / AI Organizer / folder suggestions / AI identification:** real code paths, but inert without a configured provider. The assistant shows a correct "Configure an AI Provider" empty state.
- **URL, multi-URL, Amazon/Best Buy/Newegg/PCPartPicker imports:** parsers and tests exist; not exercised end-to-end in this audit (no search/AI keys). Manual entry is the only import path verified here.
- **Price tracking & history:** implemented, but needs the separate worker and external providers; no data appears without them. "Availability" is whatever an import or the user supplied.
- **Marketing claims** of public sharing, PC builder, live component pricing, need-by dates as a first-class field, and subfolders are not backed by the current application.
- **Product editor extras** (sellers, need-by date, specs) live in a JSON `metadata` blob rather than the schema, so they are only as reliable as that component.

---

## E. Recommended development order

1. **Close the item-action IDOR** (scope `itemId` by `wishlistId`, or query by item and compare `item.wishlist.ownerId`), and add regression tests for all four actions.
2. **Retire marketplace read paths:** delete `/api/products/search`, make top-picks and copy owner-only, drop global "tracked by" stats and unscoped product reads.
3. **Fix private media:** correct the Windows path check, require auth (or signed URLs) for uploads, delete files on account deletion, and bound uploads with rate limits.
4. **Get CI green:** resolve or consciously downgrade the 35 hook-rule errors so `npm run lint` passes; keep build/tests in the pipeline.
5. **Tell the truth on the surface:** rewrite marketing/README/docs to the private-organizer scope, remove the beta badge and sharing/PC-builder sections.
6. **Consolidate the data model:** stop reading `visibility`, delete `WishlistMember`, unify the metadata blob with the typed columns, and settle "wishlist vs collection vs category" naming.
7. **Prove the import + price paths with one provider and the worker**, then add the "unknown / last checked" states.
8. **Polish:** target-price label, app dialog instead of `confirm()`, per-route loading skeletons, `next/image`, dependency audit fixes.

---

## F. Verification results

| Check                    | Command / method                                    | Result                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type check               | `npx tsc --noEmit`                                  | **Pass** (exit 0)                                                                                                                                                                                    |
| Unit tests               | `npm test`                                          | **Pass** — 15 files, 211 tests                                                                                                                                                                       |
| Lint                     | `npm run lint`                                      | **Fail** — 100 problems (35 errors, 65 warnings), exit 1                                                                                                                                             |
| Production build         | `npm run build`                                     | **Pass** (exit 0)                                                                                                                                                                                    |
| Dependency audit         | `npm audit --omit=dev`                              | 2 high (`fast-uri`, `source-map-js`), fix suggested by npm                                                                                                                                           |
| Auth boundary (anon)     | curl                                                | `/dashboard`, `/wishlists`, `/settings/account`, `/admin` → 307 to `/login`; `/api/account/export`, `/api/wishlist-events`, `/api/products/search` → 401; `/api/health` → 200                        |
| Route map (signed in)    | in-browser fetch                                    | All app/settings/admin routes 200; `/u/test/wishlist/x` and `/admin/products` → 404; `/products/nonexistent` renders the 404 page                                                                    |
| Wishlist workflow        | real browser                                        | Created collection → added product (brand/model/199.99 → target 150) → edited condition/availability/notes → saved and re-rendered correctly → search `zzzz` shows "No matches" → collection removed |
| Responsive               | 390×844 viewport                                    | `scrollWidth` 384, no horizontal overflow; mobile menu present                                                                                                                                       |
| Accessibility spot-check | DOM scan of wishlist page                           | No unnamed buttons/links, no unlabelled inputs, no missing `alt`, single H1                                                                                                                          |
| Console/network          | preview logs                                        | No application errors; only dev HMR reconnect noise. No failed asset requests                                                                                                                        |
| Export                   | `GET /api/account/export`                           | 200, `application/json`, contains account + collections                                                                                                                                              |
| Uploads                  | curl `/uploads/products/test.png`, traversal probes | **403 for everything on Windows** (path-separator bug); traversal probes blocked                                                                                                                     |
| Data restored            | DB query                                            | 1 temporary collection created and deleted; 0 collections / 0 items remain                                                                                                                           |

**Not tested (deliberately or blocked):** account deletion (destructive), OAuth sign-in (no provider
credentials), real URL/AI imports and assistant replies (no API keys), price-refresh worker, email
delivery for invitations, multi-account isolation (single local user — findings above are from code
review), screen-reader and full keyboard traversal, production/Docker deployment, and the marketing
pages' visual review.

## G. v0.12.0 — Privacy, Security & Reliability implementation

**Date:** 2026-11-18 · **Scope:** the highest-priority findings above only. No deployment, DNS,
hosting or production configuration was changed; nothing was committed or pushed; all work was
done in the Windows development copy. The Linux source repository was not touched.

### Vulnerabilities fixed

| Issue                                                                                 | Fix                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IDOR in item mutations** (edit, delete, purchased toggle, quick edit, full details) | `item-actions.ts` now builds every write from `ownedItemWhere(itemId, wishlistId, userId)`: `{ id, wishlistId, wishlist: { ownerId } }`. Reads use the same filter and return `null` for missing, foreign and mismatched pairs alike; writes use scoped `updateMany` / `deleteMany` and only touch the row when the pair is valid.    |
| Same IDOR pattern in star-priority action and the wishlist service layer              | `priority-action.ts` uses one scoped `updateMany`. `lib/services/wishlist.ts` `updateItem` / `deleteItem` / `togglePurchased` verify the item belongs to the submitted collection before writing, even though these methods currently have no route callers.                                                                          |
| Cross-account product search                                                          | `/api/products/search` deleted. No UI called it.                                                                                                                                                                                                                                                                                      |
| Foreign top-picks read/apply                                                          | GET and POST require the owner of the collection; foreign ids return **404**, including legacy `PUBLIC` rows.                                                                                                                                                                                                                         |
| Copying another account's collection                                                  | `/api/wishlists/copy` POST is owner-only and returns 404 without creating anything.                                                                                                                                                                                                                                                   |
| Product page exposed other accounts' products and global tracking counts              | Page now 404s unless the caller has an item referencing that product; save/tracking counts and their query were removed; `generateMetadata` is scoped the same way.                                                                                                                                                                   |
| Uploads unreadable on Windows and unauthenticated                                     | `resolveUploadPath()` normalises separators and uses `path.relative` containment (rejects `..`, absolute paths, drive letters, encoded traversal). The route requires a session and a `Media` row owned by the caller; admins may read any. Responses are `Cache-Control: private, max-age=3600`; foreign/anonymous requests get 404. |
| Orphaned files on account deletion                                                    | `deleteAccountUploads()` runs before the user delete and removes only files not referenced by another account's avatars, collections, items or products.                                                                                                                                                                              |
| Upload/import abuse                                                                   | Both endpoints have per-user in-memory limits (30 requests/minute).                                                                                                                                                                                                                                                                   |
| Weak claims in public copy                                                            | README, marketing home/features/about/roadmap/status/FAQ, site metadata and `docs/` no longer claim public sharing, a marketplace, a PC builder or live price monitoring. Unused `WaitlistSection.tsx` removed.                                                                                                                       |
| Mobile horizontal overflow                                                            | Global mobile rule forced `repeat(2, 1fr)` (unshrinkable) on stat grids; changed to `minmax(0, 1fr)`. The collection header now wraps its action bar and title instead of forcing a 442 px layout at 390 px.                                                                                                                          |

### Files changed (main groups)

- **Item security:** `src/app/(app)/wishlists/[id]/item-actions.ts`, `priority-action.ts`,
  `src/lib/services/wishlist.ts`.
- **Marketplace removal:** `src/app/api/products/search/route.ts` (deleted),
  `src/app/api/wishlists/[id]/top-picks/route.ts`, `src/app/api/wishlists/copy/route.ts`,
  `src/app/(app)/products/[id]/page.tsx` and affected product components.
- **Uploads/privacy:** `src/lib/uploads/path.ts` (new), `src/lib/uploads/cleanup.ts` (new),
  `src/app/uploads/[...path]/route.ts`, `src/app/api/upload/route.ts`,
  `src/app/(app)/settings/account/account-actions.ts`, `src/lib/security/rate-limit.ts` usage in
  upload and import routes.
- **Lint/typing:** item/product parsers, AI identification pipeline and providers, Meta/Modal/
  Dropdown, wishlist store, assistant interface, account/settings/marketing pages, `scripts/e2e-*.ts`.
- **Claims/docs:** `README.md`, `src/app/(marketing)/**`, `src/components/coming-soon/**` (and
  deleted `WaitlistSection.tsx`), `src/lib/site-config.ts`, `src/app/layout.tsx`, `docs/*.html`.
- **UI regression fix:** `src/app/globals.css`, `src/app/(app)/wishlists/[id]/page.tsx`.
- **CI/tests:** `.github/workflows/ci.yml` (migrations now run before tests), `vitest.config.ts`,
  `tests/setup.ts`, `tests/security/*`.

### New regression tests (27)

- `tests/security/item-ownership.test.ts` — **13 tests**, two real accounts and a real PostgreSQL
  database: owner edit/delete/toggle/quick-edit/star-priority; foreign item through the attacker's
  own collection; item from another of the same user's collections; unchanged rows after every
  rejected attempt.
- `tests/security/route-authorization.test.ts` — **9 tests**: top-picks owner/foreign/anonymous,
  copy owner/foreign, upload owner/foreign/anonymous/traversal.
- `tests/security/upload-path.test.ts` — **5 tests**: normal paths, flat files, traversal/absolute
  rejection, encoded traversal, dot-containing names.

### Verification (actual results)

| Check                     | Command                              | Result                                                                                                                                                    |
| ------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                | `npx tsc --noEmit`                   | **Pass** (exit 0)                                                                                                                                         |
| ESLint                    | `npm run lint`                       | **Pass** — 0 errors, 19 warnings (all `@next/next/no-img-element`, intentionally kept for remote retailer images)                                         |
| Tests                     | `npm test`                           | **Pass** — 18 files, **238 tests**                                                                                                                        |
| Security tests            | `npx vitest run tests/security`      | **Pass** — 44 tests (27 new)                                                                                                                              |
| Production build          | `npm run build`                      | **Pass** (exit 0)                                                                                                                                         |
| Dependency audit          | `npm audit` / `npm audit --omit=dev` | **0 vulnerabilities** (was 2 high production, 14 total)                                                                                                   |
| Upload access             | browser + curl                       | own upload `200` `image/png` + `private` cache; anonymous `404`; traversal `404`; encoded traversal `400`                                                 |
| Removed/restricted routes | curl                                 | `/api/products/search` `404`; `/api/wishlists/copy` POST anonymous `401`; foreign/nonexistent top-picks `404`                                             |
| Wishlist CRUD             | real browser (390 px and desktop)    | created collection → manually added item → quick-edited price/notes → marked purchased → stats updated; layout wraps with no page overflow; console clean |
| Cleanup                   | DB query                             | temporary collection, item, media row/file removed after verification; no smoke data left                                                                 |

**CI:** the workflow was corrected so migrations run before tests; the local CI-equivalent sequence
(lint → typecheck → tests → build) passes. Remote CI was not observed because nothing was pushed.

### Dependency advisories

`npm audit fix` updated transitive packages (1 added, 36 changed) and resolved both production
advisories (`fast-uri` via commitlint/Prisma tooling, `source-map-js` via postcss/Next) plus the
dev-only Vite/launch-editor advisories. `package-lock.json` changed; `package.json` was not changed
by the audit. Tests and production build were re-run afterwards and pass.

### Remaining security concerns

- Account deletion (and therefore file cleanup) was **not executed** against an account; it is
  covered by code review and the helper is unit-tested, but not end-to-end destructive-tested.
- Uploads are stored on local disk; multi-instance deployments need shared storage and a shared
  rate-limit store. Uploads are type-checked but not malware-scanned.
- Rate limits are per process and reset on restart.
- Automated price refresh/history still requires the separate worker and a provider; it is not
  claimed as operational.
- Duplicated product fields (native columns + `metadata` JSON) remain by design; no schema redesign
  was attempted.
- OAuth, AI imports, assistant replies, email delivery and the production/Docker environment were
  not exercised (no credentials / out of scope).
- `next/image` migration for remote product images remains an intentional follow-up (19 warnings).

### Features intentionally left unchanged

Wishlist UI/CRUD, collections and categories, priority/stars, search/sort/filter, top picks,
assistant, admin panel, settings and appearance, account export, Prisma schema (apart from the
pre-existing personal-fields migration), branding and visual identity.

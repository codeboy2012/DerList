<p align="center">
  <img src="public/icons/icon-192.png" width="88" height="88" alt="DerList app icon">
</p>

<h1 align="center">DerList</h1>

<p align="center">
  <strong>Your wants, organized. Your data, private.</strong><br>
  A self-hosted wishlist and product research workspace for the things you actually want.
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#self-hosting-with-docker">Docker</a> ·
  <a href="#development">Development</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="#project-links">Links</a>
</p>

DerList is a private, open-source home for the products you are considering. Save a product
from a retailer, keep the details that matter, organize it into collections, and decide what is
actually worth buying — without turning your wants into a public profile or somebody else's
marketplace.

It is built for people who want a useful list, not another shopping feed: collections stay
private to their owner, product links go back to the original retailer, and the database can
live on your own server.

> [!IMPORTANT]
> **Open Beta.** Public registration is implemented in v0.14.0+ and is enabled on current
> self-hosted v0.14.1 installations. Anyone can create an account with a username, an email
> address, GitHub, or Google — no invite code or approval is involved. OAuth buttons appear only
> when that provider is configured. Beta software changes between releases, so export your data
> before upgrading.

## Project Statistics

<div align="center">

<a href="https://github.com/codeboy2012/DerList"><img src="https://img.shields.io/github/stars/codeboy2012/DerList?style=for-the-badge&amp;label=Stars" alt="GitHub stars for DerList"></a>
<a href="https://github.com/codeboy2012/DerList/forks"><img src="https://img.shields.io/github/forks/codeboy2012/DerList?style=for-the-badge&amp;label=Forks" alt="GitHub forks of DerList"></a>
<a href="https://github.com/codeboy2012/DerList"><img src="https://img.shields.io/github/watchers/codeboy2012/DerList?style=for-the-badge&amp;label=Watchers" alt="GitHub watchers of DerList"></a>
<a href="https://github.com/codeboy2012/DerList/releases"><img src="https://img.shields.io/github/downloads/codeboy2012/DerList/total?style=for-the-badge&amp;label=Release%20downloads" alt="GitHub release downloads for DerList"></a>
<br>
<a href="https://github.com/codeboy2012/DerList/releases/latest"><img src="https://img.shields.io/github/v/release/codeboy2012/DerList?style=for-the-badge&amp;label=Latest%20release" alt="Latest DerList release"></a>
<a href="LICENSE.md"><img src="https://img.shields.io/github/license/codeboy2012/DerList?style=for-the-badge&amp;label=License" alt="DerList license"></a>
<a href="https://github.com/codeboy2012/DerList/actions/workflows/publish-image.yml"><img src="https://img.shields.io/github/actions/workflow/status/codeboy2012/DerList/publish-image.yml?branch=main&amp;style=for-the-badge&amp;label=Quality%20gate" alt="DerList quality gate status"></a>
<a href="https://github.com/codeboy2012/DerList/pkgs/container/derlist"><img src="https://img.shields.io/badge/GHCR-ghcr.io%2Fcodeboy2012%2Fderlist-2496ED?style=for-the-badge&amp;logo=docker&amp;logoColor=white" alt="DerList container image on GHCR"></a>

</div>

## Star History

<a href="https://www.star-history.com/?repos=codeboy2012%2FDerList&amp;type=date&amp;legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=codeboy2012/DerList&amp;type=Date&amp;theme=dark&amp;legend=top-left">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=codeboy2012/DerList&amp;type=Date&amp;legend=top-left">
    <img alt="Star history chart for DerList" src="https://api.star-history.com/svg?repos=codeboy2012/DerList&amp;type=Date&amp;legend=top-left">
  </picture>
</a>

## Current Release

<p align="center">
  <strong>v0.14.1</strong> · Open Beta · released 19 November 2026
</p>

|                          |                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Version**              | `0.14.1`                                                                         |
| **Release status**       | Open Beta release, published on GitHub                                           |
| **Application baseline** | v0.14.0 Open Beta registration, with the v0.13.0 organization work               |
| **Container image**      | `ghcr.io/codeboy2012/derlist:v0.14.1`                                            |
| **Platforms**            | `linux/amd64`, `linux/arm64`                                                     |
| **Distribution**         | Published container image; build from source is also supported                   |
| **License**              | MIT                                                                              |
| **Release notes**        | [v0.14.1 on GitHub](https://github.com/codeboy2012/DerList/releases/tag/v0.14.1) |

v0.14.1 is the container and quality-gate release. It publishes the application as a
multi-platform GHCR image and adds the automated gate that builds, tests, scans, and verifies
the image before promoting release tags. The application behaviour is the v0.14.0 Open Beta
release: public username/email registration, first-time GitHub and Google registration, optional
email verification and password recovery, and the wishlist organization tools from v0.13.0.

### What changed

- Multi-platform images at `ghcr.io/codeboy2012/derlist`, with `linux/amd64` and `linux/arm64`.
- Immutable `vX.Y.Z` release tags, digest-first verification, SBOM and provenance attestations.
- `latest` is promoted only for non-prerelease releases after the full quality gate passes.
- The main quality gate covers unit/integration tests, Playwright E2E, Prisma validation and
  migration status, TypeScript, ESLint, production builds, security checks, and Docker runtime
  verification; a separate CodeQL workflow scans the code.
- A published-image Compose example with PostgreSQL, the app, the worker, persistent volumes,
  healthchecks, restart policies, and an optional Caddy HTTPS profile.
- Documentation for upgrading, backups, restore, logs, reverse proxies, OAuth callbacks and SMTP.
- The worker deliberately keeps `healthcheck: disable: true`; it serves no HTTP and is verified
  by its running state, restart count, and structured startup log instead.

There are no standalone binary installers. Use the container image or run from source.

> **Hosted instance status:** [derlist.dpdns.org](https://derlist.dpdns.org) is live, but it is
> still serving an older invite-only build. `/register` currently returns 404 there. The hosted
> instance has not been updated to v0.14.1, so use a self-hosted v0.14.1 installation for the
> current Open Beta registration flow.

[All releases](https://github.com/codeboy2012/DerList/releases) ·
[Changelog](CHANGELOG.md) ·
[Release notes](https://github.com/codeboy2012/DerList/releases/tag/v0.14.1)

## Features

### Collections and wishlists

Wishlists are the collections in DerList. Each one belongs to exactly one account.

- Create, rename, duplicate, archive, and delete collections.
- Add a description, an emoji icon, and a custom colour.
- Keep collections in a manual order with keyboard-accessible move controls.
- Create categories inside a collection, with an optional description, notes, icon, and external
  link — useful for a build list, a room, or any group with its own reference page.
- Search within a collection by title, brand, model, category, notes, or retailer.
- Sort by price, name, newest, or priority; filter by purchased state.
- Switch between a flat list and the category view.
- Curate **Top Picks** for a collection, or let DerList surface the highest-priority unpurchased
  products as **Most Wanted**.

Every collection is private. There are no public wishlist pages, share links, profiles, or
cross-account product search.

### Product records

A product can be as detailed as you need it to be:

- Name, description, brand, and model.
- Product URL, image, retailer, condition, and availability notes.
- Current price, target price, original price, currency, and deal notes.
- Quantity, purchase status, personal notes, and a category.
- A four-level priority scale, from “Want” to “Must have”.
- Extended specifications, identifiers, and other details through the product editor.
- SKU, MPN, and GTIN where the import or your own edit supplies them.

Unknown values stay unknown. DerList does not invent a brand, price, or specification to fill a
blank field.

### Import and research

The import workflow is designed to save typing, not to pretend every retailer exposes perfect
data.

- Paste one product URL or several URLs at once.
- Dedicated URL handlers exist for Amazon, Best Buy, Newegg, and PCPartPicker; generic product
  pages use standard page metadata.
- Paste copied product text or a shopping list, review the detected products, and save the ones
  you want.
- Add a product manually when a page cannot be read or you already know the details.
- Search a configured shopping provider and review a matching product.
- Optionally use an AI provider for research and enrichment; AI-generated information is kept
  separate from data you entered or imported.
- Optional image discovery and validation help avoid broken or unsafe image URLs.

Importing is best-effort. Retailer markup changes, blocked requests, and missing metadata can
require manual correction. The website-data and file-import tabs are placeholders in this build;
CSV and DerList-backup import are not implemented.

### Organization, archive, and bulk actions

- Select products in the current collection and move them to another collection.
- Set a category or priority for a selection in one action.
- Archive selected products, or restore and permanently delete them from the archived view.
- Open an archived product's read-only detail page before deciding whether to restore it.
- Duplicate a collection with its items and category relationships.
- Copy a compact plain-text list of products to the clipboard when you need to share it manually.
- Mark products as purchased and filter them out of the active view.

Archived products stay in your account but are excluded from normal collection views,
dashboard statistics, global search, and AI organizer input until restored.

### Accounts and authentication

- Public registration with a username or an email address.
- Sign in with either your email address or your username.
- Optional GitHub and Google OAuth; a first-time OAuth sign-in creates an account only when the
  provider returns a verified email address.
- Link or disconnect OAuth providers from account settings.
- Optional email verification and password recovery over SMTP. These flows are hidden when SMTP
  is not configured rather than pretending a message was sent.
- Database-backed sessions, password changes, and a list of active sessions.
- Account deletion with typed confirmation and password confirmation when the account has one.
- Instance administration for users, invitations, audit logs, and provider configuration.

### Data ownership and export

- **Settings → Account → Export my data** downloads a JSON account export.
- The export includes account details, collections, categories, items, archive state, ordering,
  notes, prices, and extended metadata.
- Provider API keys and other encrypted secrets are deliberately excluded.
- The export is a download, not a restore format. File import, CSV export, and bulk export are
  planned but not implemented in v0.14.1.

### Privacy and security

- Private-by-default collections and owner-scoped data access.
- Authorization checks on collection, product, category, upload, and top-pick operations.
- Argon2id password hashing and hashed session tokens.
- HttpOnly, SameSite session cookies and security headers.
- Rate-limited registration and password-recovery endpoints.
- Encrypted provider credentials using `PROVIDER_ENCRYPTION_KEY`.
- SSRF protections and URL validation around product importing and image fetching.
- Uploads served through an authenticated route rather than a public directory.
- No public catalogue, public wishlist pages, or social graph.

Operational note: the shipped Compose stack runs one application process. Registration and
password-recovery limits are in-process, and the rate limiter trusts the first forwarded hop.
Keep DerList behind the provided Caddy proxy or another trusted reverse proxy, and do not scale
the app horizontally without a shared rate-limit store. The worker must not be scaled above one
replica; it uses a PostgreSQL advisory lock.

### Appearance and accessibility

- System, light, and dark themes.
- Six accent colours.
- Three Liquid Glass levels: off, subtle, and full.
- Reduce motion and reduce transparency options.
- Always-show focus rings.
- Blur product images and prices for screen sharing.
- Device-local preferences that do not leave the browser.

### What DerList is not

| Not in this build                           | What happens instead                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shopping cart or checkout                   | Product actions open the original retailer page in a new tab. DerList does not process purchases.                                                                          |
| Public wishlists, sharing, or a marketplace | Collections are private. There are no public pages, share links, or cross-account discovery.                                                                               |
| Separate Watchlists or Market Finds feeds   | Wishlists, categories, product lookup, Top Picks, and importing are the current organization model. There is no separate watchlist or Market Finds module in the codebase. |
| CSV/JSON re-import                          | The account JSON export is download-only. File import is not implemented.                                                                                                  |
| Automatic price alerts                      | Price history appears only when a configured provider has recorded data. Automated monitoring and alerts are not enabled by default.                                       |

## Screenshots

> **Screenshots are coming.** DerList does not currently ship checked-in UI screenshots. This
> section is reserved for real captures of collections, product details, and the import flow once
> the Open Beta interface stabilizes. No mockups or unrelated images are used here.

## Getting Started

### Use a current instance

The Open Beta registration flow is available on a v0.14.1 instance. If you need one, use the
[Docker quick start](#quick-start-with-the-published-image).

1. Open `/register`.
2. Choose a username and email address, or register with an email address and let DerList generate
   a username. GitHub and Google appear only when those providers are configured.
3. Sign in with either your username or email address.

No invitation, approval, allowlist, or waitlist is involved on a current instance.

### Create your first collection

From the dashboard, create a collection, give it a name and optional description, and choose an
icon and colour. Collections can be archived rather than deleted, and the order can be adjusted
later.

### Add and organize products

Open a collection and add a product by URL, copied text, product lookup, or manual entry. Review the
import before saving it. Once a product is saved, you can set its target price, priority, quantity,
condition, category, notes, and purchase status.

Use categories for larger collections, bulk actions for repetitive changes, and Top Picks for the
short list you want to see first.

### Open the original listing

DerList is not a store. Product rows provide **Visit Store**, and the product detail page provides
a **View on …** link to the original source URL. Category metadata can also carry an external link,
such as a build list. These links open in a new tab; there is no cart or checkout inside DerList.

### Take your data with you

Go to **Settings → Account** and choose **Export my data**. Keep the JSON file somewhere safe. It
is the supported way to take a copy of your collections and products in v0.14.1.

## Self-Hosting with Docker

DerList is designed to run as a small Docker Compose stack:

- the Next.js application;
- a background worker;
- PostgreSQL 16;
- persistent database and upload volumes;
- an optional Caddy reverse proxy for HTTPS.

### Image and tags

The official image is published to the GitHub Container Registry:

```bash
docker pull ghcr.io/codeboy2012/derlist:latest
```

The GHCR package is public, so the pull command works without registry credentials.

| Tag          | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `latest`     | Newest non-prerelease release. Never moved by a main-branch build or a prerelease. |
| `vX.Y.Z`     | Exact release version. Immutable once published. Use this for production.          |
| `X.Y`        | Release minor line.                                                                |
| `X`          | Release major line.                                                                |
| `main`       | Latest successful build from the `main` branch. Not a release.                     |
| `<full-SHA>` | The exact commit that produced the image.                                          |

Supported platforms are **`linux/amd64`** and **`linux/arm64`**. Prerelease tags such as
`v0.15.0-beta.1` never update `latest`, `X.Y`, or `X`.

Pin a release instead of tracking `latest`:

```bash
export DERLIST_IMAGE=ghcr.io/codeboy2012/derlist:v0.14.1
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

### Quick start with the published image

The repository includes [`docker-compose.ghcr.yml`](docker-compose.ghcr.yml), which runs the
published image, PostgreSQL, the worker, persistent volumes, and the optional Caddy profile.

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList
cp .env.example .env
```

Edit `.env` before starting:

- Change `POSTGRES_PASSWORD`. It is required and has no default.
- Set `NEXT_PUBLIC_APP_URL` to the public origin users will visit.
- Replace or remove the example `ADMIN_*` values before the first start. The example password is
  a placeholder, not a secure setup.

Then start the stack:

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

The app container waits for PostgreSQL, applies pending Prisma migrations with
`prisma migrate deploy`, optionally creates the first owner account when all required `ADMIN_*`
values are set, and then starts the server.

```bash
docker compose -f docker-compose.ghcr.yml ps
curl -fsS http://127.0.0.1:3000/api/health
```

Open `http://localhost:3000` on the server, or the public URL you configured. Registration is at
`/register`.

The published-image Compose file binds the app to `127.0.0.1:${APP_PORT:-3000}` by default. That is
intentional: use the Caddy profile or another trusted reverse proxy for internet access rather than
exposing the app port directly.

### Configuration

The Compose stack reads `.env` and constructs `DATABASE_URL` for the app and worker. The Docker
image does not contain `.env` files.

| Variable                                    | Required        | Purpose                                                                                                            |
| ------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `POSTGRES_PASSWORD`                         | **Yes**         | PostgreSQL password. No default. Avoid special characters such as `$`, `#`, `%`, `@`, and `!`, or URL-encode them. |
| `POSTGRES_USER`                             | No              | Database user. Defaults to `derlist`.                                                                              |
| `POSTGRES_DB`                               | No              | Database name. Defaults to `derlist`.                                                                              |
| `NEXT_PUBLIC_APP_URL`                       | Recommended     | Public origin used for OAuth callbacks, emailed links, and absolute URLs. Defaults to `http://localhost:3000`.     |
| `APP_PORT`                                  | No              | Host port. Defaults to `3000`; the GHCR Compose file binds it to loopback.                                         |
| `ADMIN_EMAIL`                               | No              | First-run owner email. Seed runs only when email, password, and username are all set.                              |
| `ADMIN_PASSWORD`                            | No              | First-run owner password. Change the example value before starting.                                                |
| `ADMIN_USERNAME`                            | No              | First-run owner username.                                                                                          |
| `ADMIN_DISPLAY_NAME`                        | No              | Owner display name. Defaults to `Admin`.                                                                           |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | No              | Enables GitHub OAuth when both are set.                                                                            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No              | Enables Google OAuth when both are set.                                                                            |
| `SMTP_HOST`                                 | No              | SMTP server. Email verification and password recovery stay hidden without it.                                      |
| `SMTP_PORT`                                 | No              | SMTP port. Defaults to `587`.                                                                                      |
| `SMTP_SECURE`                               | No              | `true` for implicit TLS, usually port 465. Defaults to `false` for STARTTLS.                                       |
| `SMTP_USER` / `SMTP_PASSWORD`               | No              | SMTP credentials when your server requires them.                                                                   |
| `SMTP_FROM`                                 | No              | Sender address, for example `DerList <no-reply@example.com>`.                                                      |
| `PROVIDER_ENCRYPTION_KEY`                   | No              | AES-256-GCM key for stored provider credentials. Required only if you configure providers.                         |
| `WORKER_POLL_INTERVAL_MS`                   | No              | Worker queue poll interval. Defaults to `5000`.                                                                    |
| `WORKER_SCHEDULE_INTERVAL_MS`               | No              | Worker refresh schedule. Defaults to `900000`.                                                                     |
| `WORKER_BATCH_SIZE`                         | No              | Worker batch size. Defaults to `10`.                                                                               |
| `DERLIST_IMAGE`                             | No              | Image used by `docker-compose.ghcr.yml`. Defaults to `latest`; pin a release for production.                       |
| `DOMAIN`                                    | Only with Caddy | Public hostname for the optional HTTPS profile.                                                                    |

Advanced runtime detail: uploads are written under `UPLOAD_DIR` (default
`process.cwd()/uploads`, which is `/app/uploads` in the image). The Compose stack mounts that
path as the `uploads` volume.

Generate a provider encryption key from a checkout with:

```bash
npm run generate-encryption-key
```

Keep the key somewhere safe. Existing encrypted provider credentials cannot be decrypted without
it.

OAuth callback URLs:

| Provider | Console                                             | Callback URL                                 |
| -------- | --------------------------------------------------- | -------------------------------------------- |
| GitHub   | <https://github.com/settings/developers>            | `{NEXT_PUBLIC_APP_URL}/auth/github/callback` |
| Google   | <https://console.cloud.google.com/apis/credentials> | `{NEXT_PUBLIC_APP_URL}/auth/google/callback` |

### Data, volumes, and persistence

| Volume         | Mount                     | Contents                                    |
| -------------- | ------------------------- | ------------------------------------------- |
| `pgdata`       | PostgreSQL data directory | Database files.                             |
| `uploads`      | `/app/uploads`            | Uploaded images and other persistent files. |
| `caddy_data`   | `/data` in Caddy          | TLS certificates and Caddy state.           |
| `caddy_config` | `/config` in Caddy        | Caddy configuration state.                  |

Back up the database with `pg_dump` and the uploads volume separately. Do not copy a live
PostgreSQL data directory as your only backup.

### Healthchecks, restarts, and processes

- **App:** the image and Compose healthcheck probe `http://127.0.0.1:3000/api/health`.
- **Database:** `pg_isready` checks the configured user and database.
- **Worker:** the worker has no HTTP server, so its healthcheck is intentionally disabled. Check
  that it is running with zero unexpected restarts and that `worker.started` appears in its logs.
- **Restarts:** services use `restart: unless-stopped`; the GHCR app and worker also use an init
  process and a 30-second stop grace period.
- **Worker concurrency:** run exactly one worker. A PostgreSQL advisory lock prevents multiple
  workers from processing the queue, but the service is not designed to scale horizontally.

### Upgrades and migrations

> [!WARNING]
> Back up the database and uploads before changing images. The app container applies pending
> migrations on startup, and an image rollback does **not** reverse a migration that has already
> run.

For a database created before v0.13.0, run the category-integrity preflight before upgrading. For a
database created before v0.14.0, also run the public-registration identity preflight. Both scripts
are read-only and must report `blocking_violations_total = 0`.

```bash
# Back up first. See "Backups and restore" below.

docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' \
  < scripts/preflight-wishlist-category-integrity.sql

docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' \
  < scripts/preflight-public-registration.sql
```

If either report shows a blocking violation, stop and fix the data before starting the new image.
The migrations fail closed rather than guessing how to merge invalid records.

Then pin the intended release, pull it, and start it:

```bash
export DERLIST_IMAGE=ghcr.io/codeboy2012/derlist:v0.14.1
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

The entrypoint applies migrations before the app serves traffic. To roll back the application,
pin the previous image and restore the database backup as well if a migration already ran.

### Backups and restore

```bash
# Database — custom format, restorable with pg_restore.
docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "derlist-$(date +%Y%m%d-%H%M%S).dump"

# Uploads.
docker compose -f docker-compose.ghcr.yml exec -T app \
  tar czf - -C /app/uploads . > "derlist-uploads-$(date +%Y%m%d-%H%M%S).tgz"
```

Restore into a stopped stack and test the result before serving traffic:

```bash
docker compose -f docker-compose.ghcr.yml stop app worker

docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < derlist-YYYYMMDD-HHMMSS.dump

# The app container is stopped, so restore uploads through a one-off container
# that still mounts the uploads volume.
docker compose -f docker-compose.ghcr.yml run --rm --no-deps -T \
  --entrypoint sh app -c 'tar xzf - -C /app/uploads' \
  < derlist-uploads-YYYYMMDD-HHMMSS.tgz

docker compose -f docker-compose.ghcr.yml up -d
```

A backup is only proven when you have restored it successfully on a disposable copy.

### Logs and troubleshooting

```bash
docker compose -f docker-compose.ghcr.yml logs -f app worker
docker compose -f docker-compose.ghcr.yml ps
docker inspect --format '{{.State.Health.Status}}' \
  "$(docker compose -f docker-compose.ghcr.yml ps -q app)"
```

| Symptom                                  | Check                                                                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| App exits during startup                 | `POSTGRES_PASSWORD` is set, the database is healthy, and migrations are not blocked.                                  |
| App is healthy but the public site fails | Caddy is running, DNS points at the host, ports 80/443 are open, and `NEXT_PUBLIC_APP_URL` matches the public origin. |
| OAuth login redirects with an error      | The provider callback URL matches `{NEXT_PUBLIC_APP_URL}/auth/{provider}/callback` exactly.                           |
| No verification or reset emails          | SMTP is configured. Without SMTP, these flows are intentionally hidden.                                               |
| Uploads fail or disappear                | The `uploads` volume is mounted at `/app/uploads` and writable by the non-root image user.                            |
| Worker appears unhealthy                 | Expected: it has no HTTP healthcheck. Check `worker.started`, its running state, and restart count.                   |
| Migrations fail after an upgrade         | Stop, inspect the preflight reports and logs, and restore the backup if needed. Do not retry blindly.                 |

### Reverse proxy and HTTPS

The GHCR Compose file includes a Caddy profile. Point the domain's DNS at the host, allow inbound
ports 80 and 443, and set `NEXT_PUBLIC_APP_URL` to the HTTPS origin.

```bash
DOMAIN=derlist.example.com \
  docker compose -f docker-compose.ghcr.yml --profile with-caddy up -d
```

Caddy obtains and renews certificates automatically. If you use another reverse proxy, proxy to
the app on the Compose network (or `127.0.0.1:3000`), set `X-Forwarded-For`/`X-Real-IP`, and do not
expose the app port directly to the internet. The rate limiter trusts the first forwarded hop, so
direct access would make IP-based limits bypassable.

### Build from source

The source-build Compose file builds the same production image locally:

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList
cp .env.example .env
# Edit .env and configure at least POSTGRES_PASSWORD.
docker compose up -d --build
```

Use `docker-compose.yml` when developing the image itself. For a published release, prefer
`docker-compose.ghcr.yml` so you run the verified image rather than a local rebuild. The source
Compose file publishes `APP_PORT` on the host; put it behind a firewall or trusted proxy.

## Development

### Requirements

- Node.js 22 LTS recommended (the production image uses Node 22).
- npm.
- PostgreSQL 16, local or reachable.
- Docker and Docker Compose v2 for the container workflow.
- Chromium for Playwright: `npx playwright install chromium`.

### Local setup

Install dependencies and start a local PostgreSQL instance:

```bash
npm ci

docker run --name derlist-dev-db -d \
  -e POSTGRES_USER=derlist \
  -e POSTGRES_PASSWORD=derlist \
  -e POSTGRES_DB=derlist \
  -p 127.0.0.1:5432:5432 \
  postgres:16-alpine
```

Create a local `.env` with the database URL and the development origin:

```env
DATABASE_URL=postgresql://derlist:derlist@127.0.0.1:5432/derlist
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then generate the Prisma client, apply the existing migrations, and start the dev server:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open `http://localhost:3000` and register at `/register`. The `ADMIN_*` seed account is optional
for local work; if you set it, do not use the example password from `.env.example`.

For schema changes, use `npm run db:migrate` instead of `migrate deploy` so Prisma creates a new
development migration.

### Commands

| Command                           | What it does                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `npm run dev`                     | Start the Next.js development server.                                               |
| `npm run build`                   | Create the production build.                                                        |
| `npm start`                       | Start the production server.                                                        |
| `npm run lint`                    | Run ESLint.                                                                         |
| `npm run format`                  | Format the repository with Prettier.                                                |
| `npm run format:check`            | Check formatting without writing.                                                   |
| `npm test`                        | Run the database-backed Vitest suite.                                               |
| `npm run test:watch`              | Run Vitest in watch mode.                                                           |
| `npm run test:e2e`                | Run Playwright; it starts the dev server on port 3100 unless `E2E_BASE_URL` is set. |
| `npm run db:generate`             | Generate the Prisma client.                                                         |
| `npm run db:migrate`              | Create and apply a development migration.                                           |
| `npm run db:seed`                 | Seed the optional owner account from `ADMIN_*`.                                     |
| `npm run db:studio`               | Open Prisma Studio.                                                                 |
| `npm run generate-encryption-key` | Generate a provider encryption key.                                                 |
| `npx tsc --noEmit`                | Typecheck without emitting files.                                                   |

### Testing

Both Vitest and Playwright need a reachable PostgreSQL database configured through
`DATABASE_URL`. Install Chromium once before the first E2E run. The E2E configuration starts the
development server automatically and uses port 3100 by default.

```bash
npm test
npm run test:e2e
```

The release gate also runs ESLint, TypeScript, Prisma validation/migration status, the production
build, security tests, and the Docker Compose runtime verification. CodeQL runs as a separate
workflow. See the [CI workflow](.github/workflows/ci.yml) and
[publish workflow](.github/workflows/publish-image.yml) for the exact commands.

### Docker development

To exercise the production image and Compose stack locally:

```bash
cp .env.example .env
# Set POSTGRES_PASSWORD and any optional configuration.
docker compose up -d --build
```

The source build uses the same multi-stage Dockerfile as the published image. The worker runs from
the same image with a different entrypoint.

## Contributing

DerList is maintained in public and contributions are welcome.

### Bugs and feature requests

- Open a bug report through the [issue chooser](https://github.com/codeboy2012/DerList/issues/new/choose).
- Use the feature-request template for ideas and improvements.
- Include the version or commit, deployment method, steps to reproduce, and any relevant logs.
- For security-sensitive reports, avoid posting exploit details publicly; contact the maintainer
  through GitHub first.

### Pull requests

1. Fork the repository and create a focused branch.
2. Make the change, including tests and documentation where appropriate.
3. Run the relevant checks:

   ```bash
   npm test
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

4. Open a pull request against `main` with a clear explanation and a linked issue when one exists.

Keep unrelated refactors out of a fix. If you change the Docker configuration, database schema, or
authentication flow, include the verification steps you used.

## Roadmap

DerList is built in phases, not dates. The canonical feature inventory and status details live in
[ROADMAP.md](ROADMAP.md); this is a concise summary.

| Phase   | Scope                                                                                         | Status         |
| ------- | --------------------------------------------------------------------------------------------- | -------------- |
| v0.13.0 | Wishlist organization, bulk actions, archive/restore, duplication                             | Shipped        |
| v0.14.0 | Open Beta, public registration, OAuth registration, email flows, onboarding                   | Shipped        |
| v0.14.1 | Multi-platform container images, CI quality gate, security checks, Docker docs                | Shipped        |
| v0.15.0 | Importing improvements: extraction, progress, retries, history, duplicates, re-identification | In development |
| v0.16.0 | Advanced private search, saved searches, product comparison                                   | Planned        |
| v0.17.0 | AI product identification, organization, and assistant improvements                           | Planned        |
| v0.18.0 | Price refresh, history, retailer comparisons, target-price monitoring                         | Planned        |
| v0.19.0 | Research workspace, availability research, reminders, notifications                           | Planned        |
| v0.20.0 | Portability, broader exports, personalization, dashboard layouts                              | Planned        |
| v1.0.0  | A mature, polished personal product organizer with reliable self-hosting                      | Long-term      |

Current Open Beta priorities are reliability, import quality, search and comparison, clearer
documentation, and the self-hosting experience. Planned work is not a promise of a release date,
and features may change as the project learns from real use.

[Read the full roadmap](ROADMAP.md) ·
[Changelog](CHANGELOG.md) ·
[All releases](https://github.com/codeboy2012/DerList/releases)

## Architecture and Stack

```text
Browser
   │  HTTPS
   ▼
Caddy (optional) ──► Next.js app ──► Prisma ──► PostgreSQL 16
                          │
                          ├── /app/uploads volume
                          └── background worker ──► optional providers
```

| Layer           | Technology                                                         |
| --------------- | ------------------------------------------------------------------ |
| Application     | Next.js 16 App Router, React 19, Server Actions and route handlers |
| Language        | TypeScript 5                                                       |
| Styling         | Tailwind CSS 4                                                     |
| Database        | PostgreSQL 16                                                      |
| ORM             | Prisma 7                                                           |
| Authentication  | Custom database-backed sessions, Arctic OAuth, Argon2id            |
| Background jobs | Node worker using the same application image                       |
| Container       | Docker, Node 22 Alpine, non-root user, healthcheck                 |
| Reverse proxy   | Caddy 2 (optional profile)                                         |
| Tests           | Vitest and Playwright                                              |
| Delivery        | GitHub Actions, GHCR, CodeQL, Dependabot                           |

DerList stores user data in PostgreSQL and persistent files in the uploads volume. AI, shopping,
price, and vision providers are optional integrations; the core collection and product workflows
do not require an external AI service.

## Credits

DerList is maintained by [CodeBoy2012](https://github.com/codeboy2012) and contributors.

It stands on a lot of open-source work, including:

- [Next.js](https://nextjs.org/) and [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Prisma](https://www.prisma.io/) and [PostgreSQL](https://www.postgresql.org/)
- [Node.js](https://nodejs.org/), [Docker](https://www.docker.com/), and [Caddy](https://caddyserver.com/)
- [Arctic](https://arcticjs.dev/), [Argon2](https://github.com/ranisalt/node-argon2), and
  [Zod](https://zod.dev/)
- [Nodemailer](https://nodemailer.com/) and [Lucide](https://lucide.dev/)
- [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/)
- [GitHub Actions](https://github.com/features/actions) and
  [GitHub Container Registry](https://ghcr.io/)

Each dependency retains its own license and copyright. Product names, retailer names, and marks
belong to their respective owners; DerList does not claim third-party work as its own.

## Built with Freebuff

[Freebuff](https://freebuff.com) is an AI coding agent that assisted DerList's development:
exploring the codebase, implementing changes, debugging, testing, and supporting development
workflows. Its source is available in the
[Freebuff GitHub project](https://github.com/CodebuffAI/freebuff).

Freebuff assisted the maintainers; it does not replace them, does not create or maintain DerList,
and does not own the project. Changes are reviewed and tested as part of the normal development
process.

## License

DerList is open source under the [MIT License](LICENSE.md). Copyright © 2026 CodeBoy2012.

The MIT license covers DerList's source code. Third-party libraries, services, product names,
retailer names, and trademarks remain subject to their own licenses and ownership. DerList is not
affiliated with the retailers whose pages you save, and it is not a shopping or payment service.

## Project Links

| Resource             | Link                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| Repository           | <https://github.com/codeboy2012/DerList>                                  |
| Releases             | <https://github.com/codeboy2012/DerList/releases>                         |
| Latest release       | <https://github.com/codeboy2012/DerList/releases/tag/v0.14.1>             |
| Issues               | <https://github.com/codeboy2012/DerList/issues>                           |
| New issue            | <https://github.com/codeboy2012/DerList/issues/new/choose>                |
| Pull requests        | <https://github.com/codeboy2012/DerList/pulls>                            |
| Container package    | <https://github.com/codeboy2012/DerList/pkgs/container/derlist>           |
| Changelog            | [CHANGELOG.md](CHANGELOG.md)                                              |
| Roadmap              | [ROADMAP.md](ROADMAP.md)                                                  |
| License              | [LICENSE.md](LICENSE.md)                                                  |
| Documentation source | <https://github.com/codeboy2012/DerList/tree/main/docs>                   |
| Hosted instance      | <https://derlist.dpdns.org> — older invite-only build; no `/register` yet |
| Freebuff             | <https://freebuff.com>                                                    |
| Freebuff on GitHub   | <https://github.com/CodebuffAI/freebuff>                                  |
| Maintainer           | <https://github.com/codeboy2012>                                          |

---

<p align="center">
  <sub>DerList is built in public. If it is useful to you, try it, star the repository, or open an issue.</sub>
</p>

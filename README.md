# DerList

**A private, open-source wishlist and personal product organizer.**

DerList is a self-hosted web application for keeping private collections of the products you want. Record current and target prices, condition, availability and notes, import product details, and organize everything your way — without public sharing, a marketplace, subscriptions, ads, or vendor lock-in.

> **DerList is now in Open Beta.**
>
> Anyone can create an account with a username, an email address, GitHub or Google — no
> invitation, approval, allowlist or waitlist is involved. Beta software still changes between
> releases, so keep your own export of anything you cannot afford to lose.

- **Current release:** `0.14.1` — Container images and automated quality gate
- **Release status:** Published
- **Container image:** `ghcr.io/codeboy2012/derlist`
- **In development:** `0.15.0` — Importing improvements

📋 **[View the full Changelog](https://github.com/codeboy2012/DerList/blob/main/CHANGELOG.md)**

---

## ✨ Features

### 🛒 Wishlists & collections

- Unlimited private collections
- Create, rename, duplicate, archive, and delete collections
- Manual collection ordering
- Categories/folders within a collection
- Bulk select, move, categorize, prioritize, archive, and delete products
- Product archive with read-only details, restore, and permanent deletion
- Priority levels and star ratings
- Quantity tracking
- Current price and per-item target price
- Condition and availability notes
- Purchase status
- Private notes per product
- Top Picks
- Product images
- Search, sorting and filtering

Every collection is private to its owner. There are no public wishlist pages, share links or
catalogues, and no cross-account product search.

### 📦 Product Management

Products can store detailed information including:

- Product name, brand and model
- Category
- Condition and availability (as supplied by you or the import)
- SKU, UPC, ASIN and MPN where an import provides them
- Product URL and description
- Private notes
- Specifications and images
- Current price and target price
- Retailer and seller information
- Purchase status and quantity

Optional extended fields live in the product editor and its metadata JSON; they are only as
complete as the import or your own edits. DerList never invents a value — unknown stays unknown.

### 🔗 Product Importing

Paste a product URL and DerList attempts to identify the product automatically.

Current importing supports:

- Amazon
- Best Buy
- Newegg
- PCPartPicker
- Generic product URLs
- Multiple URLs
- ASIN extraction
- URL normalization
- Product validation
- Search-provider fallback
- AI enrichment

DerList is designed to **avoid inventing product information** when reliable data cannot be found.

If an AI provider is unavailable or a product cannot be reliably identified, DerList falls back to manual product entry.

### 🤖 AI Product Research

DerList supports AI-powered product research using configured AI providers.

AI can help identify and enrich:

- Product names
- Brands
- Models
- Categories
- Subcategories
- Product identifiers
- Descriptions
- Specifications
- Tags
- Pricing information
- Sellers
- Product metadata

The research pipeline includes:

- AI provider selection
- Search-provider fallback
- AI enrichment
- Product validation
- Confidence scoring
- Completeness scoring
- Per-field source tracking
- Import status tracking
- Structured AI responses
- Product identity verification

More AI research improvements are actively being developed.

### 🖼️ Product Images

DerList supports product image discovery and validation.

The image system includes:

- Search image candidates
- Image validation
- HTTP verification
- SSRF protection
- Google thumbnail rejection
- Trusted image sources
- Keepa image-provider architecture
- Image source tracking
- Image fallback handling

### 💰 Pricing

Pricing features that exist today:

- Current price and currency per item
- A per-item target price you set yourself
- Original/MSRP and discount fields when an import supplies them
- Manual price editing
- Price history storage and charts, rendered when data exists

Automated price monitoring is **not** active by default. It requires the separate worker service
and a configured price provider; without them the history is simply empty. Price alerts are not
implemented yet.

### 👥 Authentication

- **Public registration** with a username or an email address
- Sign in with either your email address or your username
- GitHub OAuth (when configured)
- Google OAuth (when configured)
- First-time OAuth registration for provider-verified emails
- Email verification (when SMTP is configured)
- Password recovery by email (when SMTP is configured)
- Case-insensitive, normalised email and username uniqueness
- Secure, database-backed session management
- User roles and an admin panel
- Optional administrator invitations for pre-provisioned accounts

### 🛠️ Administration

The administration system provides:

- User management
- Invitation management
- System oversight
- Provider configuration
- AI provider configuration
- Application administration

### 📱 Responsive Interface

DerList works across:

- Desktop
- Laptop
- Tablet
- Mobile browsers

The interface supports:

- Dark mode
- Responsive layouts
- Modern product cards
- Product editor
- Wishlist organization
- AI research progress
- Live import status

---

# 🚀 Quick Start

## Docker

DerList is published as a multi-platform container image to the GitHub Container Registry.

### Pull the published image

```bash
docker pull ghcr.io/codeboy2012/derlist:latest
```

| Tag          | Meaning                                                            |
| ------------ | ------------------------------------------------------------------ |
| `latest`     | Newest non-prerelease release. Never moved by a main-branch build. |
| `vX.Y.Z`     | Exact release version. Immutable once published.                   |
| `X.Y`        | Release minor line.                                                |
| `X`          | Release major line.                                                |
| `main`       | Latest build from a successful `main` run. Not a release.          |
| `<full-SHA>` | Exact commit that produced the image.                              |

Supported platforms are **`linux/amd64`** and **`linux/arm64`**. Pre-release tags such as
`v0.15.0-beta.1` never update `latest`, `X.Y` or `X`.

Pin a release for a reproducible deployment instead of tracking `latest`:

```bash
DERLIST_IMAGE=ghcr.io/codeboy2012/derlist:v0.14.1 \
  docker compose -f docker-compose.ghcr.yml pull
```

### Run the published image with Compose

The [`docker-compose.ghcr.yml`](./docker-compose.ghcr.yml) example runs the published image,
PostgreSQL, the background worker, persistent database and upload volumes, healthchecks, restart
policies, and an optional Caddy HTTPS profile.

```bash
cp .env.example .env
# Edit .env before starting. POSTGRES_PASSWORD is required and has no default.
docker compose -f docker-compose.ghcr.yml up -d
```

For production, set at minimum:

```env
POSTGRES_PASSWORD=your-secure-password
NEXT_PUBLIC_APP_URL=https://your-domain.example

# Optional instance owner. Normal public registration does not need this.
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Required only if you store third-party provider credentials.
PROVIDER_ENCRYPTION_KEY=replace-with-a-generated-key
```

Generate the encryption key with `npm run generate-encryption-key`. Keep `.env` untracked; the
repository and Compose files contain no credentials. The app port is bound to
`127.0.0.1:${APP_PORT:-3000}` in the GHCR Compose example so it is not exposed directly to the
internet. Use the Caddy profile or another trusted reverse proxy for public access.

Once the containers are healthy, open **[http://localhost:3000](http://localhost:3000)** or your
configured public URL. Create an account at **`/register`**. The optional `ADMIN_*` seed account is
the instance owner and is not required for normal registration.

### Build from source

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList
cp .env.example .env
# Edit .env and configure at minimum POSTGRES_PASSWORD.
docker compose up -d --build
```

The source-build Compose file (`docker-compose.yml`) builds the same production image locally and
is intended for development of the image itself. Published releases should use
`docker-compose.ghcr.yml`.

### Verify the installation

```bash
docker compose -f docker-compose.ghcr.yml ps
curl -fsS http://localhost:3000/api/health
```

### View logs

```bash
docker compose -f docker-compose.ghcr.yml logs -f app worker
```

Use `docker inspect --format '{{.State.Health.Status}}' <container>` to check a service health
status. The worker intentionally has no HTTP healthcheck because it does not serve HTTP; its
liveness is its running state and its structured `worker.started` log line.

### Back up and restore

Back up the database and uploads before any upgrade, migration or image change. Keep the backup
outside the Docker volumes.

```bash
# Database (custom format, restorable with pg_restore)
docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "derlist-$(date +%Y%m%d-%H%M%S).dump"

# Uploaded files
docker compose -f docker-compose.ghcr.yml exec -T app \
  tar czf - -C /app/uploads . > "derlist-uploads-$(date +%Y%m%d-%H%M%S).tgz"
```

Restore into a stopped stack and verify the result before serving traffic:

```bash
# Stop writers first.
docker compose -f docker-compose.ghcr.yml stop app worker

# Restore the database.
docker compose -f docker-compose.ghcr.yml exec -T db \
  sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < derlist-YYYYMMDD-HHMMSS.dump

# Restore uploads.
docker compose -f docker-compose.ghcr.yml exec -T app \
  tar xzf - -C /app/uploads < derlist-uploads-YYYYMMDD-HHMMSS.tgz

docker compose -f docker-compose.ghcr.yml up -d
```

Test a restore on a disposable copy before relying on it. Backups are only useful if they have
been restored successfully at least once.

### Reverse proxy and HTTPS

The GHCR Compose example binds the app to loopback. The optional Caddy profile terminates TLS and
proxies to `app:3000`:

```bash
DOMAIN=derlist.example.com \
  docker compose -f docker-compose.ghcr.yml --profile with-caddy up -d
```

Point the domain's DNS at the host, allow inbound ports 80 and 443, and set
`NEXT_PUBLIC_APP_URL=https://derlist.example.com`. Caddy obtains and renews certificates
automatically. If you use another reverse proxy, proxy to `127.0.0.1:3000` (or the app service on
the Compose network), set `X-Forwarded-For`/`X-Real-IP`, and do not expose the app port directly.
The registration rate limiter trusts the first forwarded hop, so direct internet access to the app
port would make IP-based limits bypassable.

### Upgrading an existing installation

**Changing the image does not make a production database safe to migrate.** The app container
applies pending Prisma migrations on startup (`prisma migrate deploy`), so back up the database
and uploads, identify the actual production database, and run the preflights below before
replacing a running image.

```bash
# 1. Back up first (see "Back up and restore").
# 2. Pull the intended release, not latest, for a controlled upgrade.
DERLIST_IMAGE=ghcr.io/codeboy2012/derlist:v0.14.1 \
  docker compose -f docker-compose.ghcr.yml pull
# 3. Start it; the entrypoint applies migrations before serving traffic.
DERLIST_IMAGE=ghcr.io/codeboy2012/derlist:v0.14.1 \
  docker compose -f docker-compose.ghcr.yml up -d
```

Pin the previous version to roll back the application image. If a migration already ran, restore
the database backup as well; image rollback alone does not reverse a schema migration.

Databases created before v0.13.0 must pass the category-integrity preflight
before the new image starts. Databases created before v0.14.0 must also pass the
public-registration identity preflight. Both scripts are read-only:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/preflight-wishlist-category-integrity.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/preflight-public-registration.sql
```

`blocking_violations_total` must be `0` in both reports. A nonzero value in the
category preflight means at least one product references a category in another
collection. A nonzero value in the registration preflight means two accounts
already share an email address or username case-insensitively. In either case
the migration aborts without modifying or deleting any data. The script headers
document every check and the expected pre-migration values.

Deployment order: back up the database, run both preflights, then start the new
image and let the entrypoint apply migrations before the app serves traffic.
The v0.14.0 migration `20261119180000_public_registration` lowercases existing
emails and usernames, adds CHECK constraints that keep them lowercase, and adds
`email_tokens` for verification and reset links. It fails closed rather than
guessing how to merge duplicate identities.

### Email delivery (optional)

Email verification and password recovery need SMTP. Configure `SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM`, and
set `NEXT_PUBLIC_APP_URL` to the public origin users visit because emailed links
are built from it.

When SMTP is not configured, DerList does not offer either flow. The login and
registration pages still work, and `/forgot-password` explains that recovery is
unavailable instead of claiming an email was sent. No email credentials are
included in the repository or the Docker image.

### Account registration and OAuth setup

Registration lives at `/register` and offers two methods:

- **Username** — choose a username, add an email address and password.
- **Email** — add an email address and password; a username is generated and can be changed in
  Settings → Profile.

Both methods create the same account. Sign in at `/login` with either the email address or the
username. OAuth buttons only appear for providers whose client ID and secret are set:

| Provider | Console                                           | Callback URL                                 |
| -------- | ------------------------------------------------- | -------------------------------------------- |
| GitHub   | https://github.com/settings/developers            | `{NEXT_PUBLIC_APP_URL}/auth/github/callback` |
| Google   | https://console.cloud.google.com/apis/credentials | `{NEXT_PUBLIC_APP_URL}/auth/google/callback` |

A first-time OAuth sign-in creates an account only when the provider returns a **verified** email
address. An unverified provider email never creates or links an account. If the provider account
is already linked, it signs in normally; an existing account with the same verified email is
linked once, and an account already linked to a different user is rejected.

### Runtime configuration

Environment variables are read from the container environment at runtime. The
image does not contain `.env` files: `.dockerignore` keeps them out of the
build context and `npm run build` removes Next.js's intentional `.env` and
`.env.production` copies from `.next/standalone`. This also applies when the
standalone output is deployed without Docker.

Uploads are written under `UPLOAD_DIR` (default `process.cwd()/uploads`, which
is `/app/uploads` in the image). `docker-compose.yml` mounts that path as the
`uploads` volume, and PostgreSQL data as the `pgdata` volume.

### Background worker

Background refreshes and price history are processed by the `worker` service.
`docker compose up -d` starts it alongside the app, and it must not be scaled
to more than one replica — it holds a PostgreSQL advisory lock so only one
worker processes jobs at a time.

```bash
docker compose logs -f worker
```

If the worker stops unexpectedly, jobs left in a running state are recovered
on the next startup instead of blocking the queue.

### Health check

```text
http://localhost:3000/api/health
```

---

# 📋 Requirements

### Recommended

- Docker
- Docker Compose v2+
- Linux server
- 2 GB+ RAM
- PostgreSQL 16+

DerList is primarily developed and tested on Linux with Docker.

Windows and macOS Docker deployments may work but are not currently the primary supported self-hosting environments.

---

# 🧠 AI Providers

AI functionality is optional.

DerList is designed to support multiple AI providers so users can choose which services they want to connect.

AI providers can be configured through the DerList provider system.

When an AI provider is available, DerList can use it for product identification and research.

When no AI provider is configured, DerList will not fabricate product information and will instead allow the user to enter product details manually.

---

# 🏗️ Architecture

```text
┌───────────────────────────────────────────────┐
│                 DerList                      │
├───────────────────────────────────────────────┤
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │           Next.js Application           │  │
│  │                                         │  │
│  │  React 19                              │  │
│  │  Next.js App Router                    │  │
│  │  API Routes                             │  │
│  │  Server Actions                         │  │
│  └───────────────────┬─────────────────────┘  │
│                      │                        │
│                      ▼                        │
│  ┌─────────────────────────────────────────┐  │
│  │              Prisma ORM                 │  │
│  └───────────────────┬─────────────────────┘  │
│                      │                        │
│                      ▼                        │
│  ┌─────────────────────────────────────────┐  │
│  │             PostgreSQL 16               │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  External Providers                           │
│  ├── AI Providers                             │
│  ├── Search Providers                         │
│  ├── Product Data Providers                   │
│  └── Image Providers                          │
│                                               │
└───────────────────────────────────────────────┘
```

### Technology Stack

| Component      | Technology                          |
| -------------- | ----------------------------------- |
| Frontend       | Next.js 16                          |
| UI             | React 19                            |
| Styling        | Tailwind CSS 4                      |
| Language       | TypeScript                          |
| Backend        | Next.js API Routes + Server Actions |
| Database       | PostgreSQL 16                       |
| ORM            | Prisma 7                            |
| Authentication | Custom session-based authentication |
| Deployment     | Docker                              |
| Reverse Proxy  | Caddy (optional)                    |

---

# 🔐 Security

DerList includes multiple security protections for self-hosted deployments.

- Argon2id password hashing
- SHA-256 hashed session tokens
- HttpOnly cookies
- Secure cookies
- SameSite protection
- Server-side authorization
- Zod input validation
- Rate-limited public registration and password recovery
- Optional email verification and password recovery over SMTP
- Encrypted provider API keys
- SSRF protection
- Private network blocking
- Internal hostname blocking
- Image URL validation
- HTTP image verification
- No API secrets exposed to clients

DerList's product import system is specifically designed to prevent malicious URLs from being used to access internal services.

---

# 🧪 Development

Clone the repository:

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList
```

Install dependencies:

```bash
npm ci
```

Start PostgreSQL:

```bash
docker compose up db -d
```

Configure `.env.local` with your database connection.

Run migrations:

```bash
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

---

## Development Commands

| Command                  | Description              |
| ------------------------ | ------------------------ |
| `npm run dev`            | Start development server |
| `npm run build`          | Create production build  |
| `npm run lint`           | Run ESLint               |
| `npm run format`         | Format code              |
| `npx prisma studio`      | Open Prisma Studio       |
| `npx prisma migrate dev` | Create/apply migrations  |

---

# 🧪 Testing

DerList includes automated tests for core functionality. Database-backed Vitest tests cover the
service and authorization layer, and a Playwright suite covers critical browser workflows
(`npm run test:e2e`). Install the browser once with `npx playwright install chromium` before the
first browser-test run.

Current test coverage includes:

- Product validation
- ASIN extraction
- URL normalization
- Search providers
- AI providers
- Image validation
- Image HTTP verification
- SSRF protection
- Completeness scoring
- Product identification
- Import behavior

Run the unit/service suite with `npm test` (Vitest, database-backed) and the browser suite with
`npm run test:e2e` (Playwright). Both need a reachable PostgreSQL database configured through
`DATABASE_URL`.

### Known limitations

- DerList is in Open Beta; the roadmap in [ROADMAP.md](./ROADMAP.md) records what is
  implemented and what is not.
- Registration and password-recovery rate limits are per application process. A multi-replica
  deployment must put a shared store behind `src/lib/security/rate-limit.ts`. The shipped Docker
  Compose stack runs one app process.
- The rate limiter trusts the first `X-Forwarded-For` hop. Expose DerList behind the provided
  Caddy reverse proxy (or another proxy that sets the header) rather than directly to the
  internet.
- Email verification and password recovery require SMTP. The sender is unit-tested with a mocked
  transport; no live mailbox delivery was verified for this release.
- A production database preflight and migration were not executed because no production target
  or credentials were available in the release environment. The scripts are provided for the
  operator.
- Automated price monitoring and alerts are not implemented. Price history appears only when data
  exists.
- Accessibility work is keyboard- and focus-based; no screen-reader audit has been performed.
- The Docker image and compose stack are verified in CI (build, runtime, health, persistence,
  non-root user, image contents). Runtime verification on the operator's own host is still
  recommended before exposing an instance publicly.
- Browsers and screen readers vary; the Playwright suite runs Chromium on Linux.

---

# 🗺️ Roadmap

DerList follows a long-term, private-first release roadmap. The canonical feature inventory,
release scope, and status details live in **[ROADMAP.md](./ROADMAP.md)**. This section is a
concise summary only.

### Current release

**v0.14.1 — Container images and automated quality gate** (published 2026-11-19)

Multi-platform images at `ghcr.io/codeboy2012/derlist` with immutable release tags, digest-first
verification, SBOM and provenance, plus a CI gate covering E2E, security, CodeQL, dependency
review, and real Docker Compose runtime verification. The application behaviour is the v0.14.0
Open Beta release.

### Previous release

**v0.14.0 — Open Beta and public registration**

Public registration with a username or email address, first-time GitHub and Google registration,
sign-in with either identifier, optional email verification and password recovery over SMTP,
rate-limited authentication endpoints, case-insensitive identity constraints, and first-run
dashboard onboarding without sample data. Accounts created through OAuth can set a password later.

**v0.13.0 — Wishlist and organization**

Bulk product actions, product archive/restore, wishlist duplication, manual collection ordering,
and the v0.13.0 release-hardening pass.

### In development

**v0.15.0 — Importing improvements**

Better extraction, import progress, retries, history, duplicate detection and re-identification
are planned; nothing from that scope is part of v0.14.1.

### Later proposed releases

- **v0.15.0 — Importing improvements**
- **v0.16.0 — Search and comparison**
- **v0.17.0 — AI intelligence**
- **v0.18.0 — Price intelligence**
- **v0.19.0 — Research and notifications**
- **v0.20.0 — Portability and personalization**
- **v1.0.0 — Complete personal product organizer**

These are proposed groupings, not promises or fixed release dates. Detailed scope for every
release is maintained in **[ROADMAP.md](./ROADMAP.md)**.

There is no public sharing, marketplace, or PC builder in the current application; those are
not committed roadmap items.

📋 **[View the complete DerList Changelog](https://github.com/codeboy2012/DerList/blob/main/CHANGELOG.md)**

---

# 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Run `npm run lint`
6. Run `npm run build`
7. Submit a pull request

Please make sure new features include appropriate tests and documentation where applicable.

---

# 📄 License

DerList is open source software licensed under the MIT License.

See [LICENSE.md](./LICENSE.md) for the full license.

---

# ❤️ DerList

DerList is being built as an open-source alternative to traditional shopping and wishlist platforms.

The goal is simple:

> **One place to save, research, organize, compare, and eventually buy the things you want.**

No subscriptions.
No advertisements.
No vendor lock-in.

Built by [CodeBoy2012](https://github.com/codeboy2012) and contributors.

---

## 📚 Documentation

- **[Master feature inventory & roadmap](./ROADMAP.md)**
- **[Changelog](https://github.com/codeboy2012/DerList/blob/main/CHANGELOG.md)**
- **[GitHub Repository](https://github.com/codeboy2012/DerList)**
- **[Issues](https://github.com/codeboy2012/DerList/issues)**
- **[Releases](https://github.com/codeboy2012/DerList/releases)**

---

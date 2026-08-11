# DerList

**The open-source universal wishlist and shopping planner.**

A self-hosted web application for organizing products you want to buy. Track wishlists, import products from URLs, manage prices, and share lists — all without subscriptions, ads, or vendor lock-in.

---

## Quick Start (Docker)

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, ADMIN_PASSWORD, and optionally OAuth credentials
docker compose up -d
```

Once healthy, visit **http://localhost:3000** and log in with your admin credentials.

```bash
# Verify services are running
docker compose ps

# View logs
docker compose logs -f app
```

### Requirements

- Docker and Docker Compose v2+
- Linux host (recommended for self-hosting)

---

## Features

### Available Now

- **Unlimited wishlists** — Create, rename, delete, duplicate, archive
- **Product management** — Add, edit, delete items with images, prices, brands, retailers, URLs
- **URL product import** — Paste a product URL, metadata is automatically extracted (Amazon, Best Buy, Newegg, PCPartPicker, and generic sites)
- **Organization** — Categories, folders, sorting (price, name, priority, newest), filtering (purchased/unpurchased)
- **Star priority** — Rate items 1-4 stars, sort by priority
- **Top Picks** — Curate your most-wanted items per wishlist
- **Public/private/unlisted lists** — Share wishlists via URL
- **Search** — Full-text search across wishlists and items
- **Authentication** — Email/password, GitHub OAuth, Google OAuth
- **Invite-only access** — Admin-controlled user registration
- **Admin panel** — User management, invitations, system oversight
- **AI product enrichment** — Auto-fill product details using configured AI providers (optional)
- **AI organizer** — Bulk categorize and clean up wishlist items (optional)
- **Shopping assistant** — AI-powered product Q&A (optional)
- **Dark mode** — Default dark theme with modern UI
- **Mobile responsive** — Works on phones, tablets, and desktops
- **Docker deployment** — Single-command production deployment
- **Health checks** — `/api/health` endpoint for monitoring
- **Automatic migrations** — Database schema applied on container startup

### In Development

- Price history tracking and charts
- Price drop alerts
- Browser extension for one-click product saving
- Additional OAuth providers (Discord, Microsoft)
- Public user profiles

### Planned (Future)

- PC Builder with compatibility checking
- Native mobile applications (iOS/Android)
- Offline mode / PWA improvements
- Community marketplace for shared builds
- Deal detection and price predictions

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Docker Compose                 │
├─────────────────────────────────────────┤
│  ┌───────────┐    ┌──────────────────┐  │
│  │PostgreSQL │◀───│  DerList App     │  │
│  │  :5432    │    │  (Next.js)       │  │
│  └───────────┘    │  :3000           │  │
│                   └──────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Caddy (optional, --profile       │  │
│  │   with-caddy) :80/:443           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **Backend**: Next.js API routes and Server Actions
- **Database**: PostgreSQL 16 with Prisma 7 ORM
- **Authentication**: Custom session-based auth with OAuth (GitHub, Google)
- **Deployment**: Docker with automatic migrations

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_PASSWORD` | Yes | Database password |
| `ADMIN_EMAIL` | Recommended | Owner account email (first run only) |
| `ADMIN_PASSWORD` | Recommended | Owner account password (first run only) |
| `ADMIN_USERNAME` | Recommended | Owner account username (first run only) |
| `AUTH_SECRET` | Yes | Session signing key (`openssl rand -base64 32`) |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app secret |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | No | Public URL (default: `http://localhost:3000`) |

See `.env.example` for the full list with descriptions.

---

## Development

```bash
# Install dependencies
npm ci

# Start PostgreSQL (or use your own)
docker compose up db -d

# Set DATABASE_URL in .env.local
# Run migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npx prisma studio` | Visual database browser |
| `npx prisma migrate dev` | Create/apply migrations |

---

## Platform Support

DerList is a **web application** accessible from any modern browser:

- Desktop: Windows, macOS, Linux, ChromeOS
- Mobile: Android, iOS, iPadOS (via browser)

**Self-hosting** is currently supported on **Linux** with Docker. Windows and macOS Docker support is untested but may work.

Native desktop and mobile applications do not exist at this time.

---

## Security

- Passwords hashed with Argon2id
- Sessions use SHA-256 hashed tokens (raw tokens never stored)
- HttpOnly, Secure, SameSite=Lax cookies
- SSRF protection on URL product imports (blocks private/internal addresses)
- Server-side authorization on all API routes
- Input validation with Zod
- Invite-only registration (no open signup)
- Provider API keys encrypted with AES-256-GCM

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch
3. Ensure `npm run lint` and `npm run build` pass
4. Submit a pull request

---

## License

MIT — see [LICENSE.md](./LICENSE.md)

---

Built by [CodeBoy2012](https://github.com/codeboy2012) and contributors.

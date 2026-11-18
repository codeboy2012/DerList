# DerList

**A private, open-source wishlist and personal product organizer.**

DerList is a self-hosted web application for keeping private collections of the products you want. Record current and target prices, condition, availability and notes, import product details, and organize everything your way — without public sharing, a marketplace, subscriptions, ads, or vendor lock-in.

> 🚧 **DerList is currently in active alpha development.**
>
> Features are being actively developed and may change between releases.

**Current version:** `0.11.5`  
**Latest stable release:** `0.11.0`

📋 **[View the full Changelog](https://github.com/codeboy2012/DerList/blob/main/CHANGELOG.md)**

---

## ✨ Features

### 🛒 Wishlists & collections

- Unlimited private collections
- Create, rename, duplicate, archive, and delete collections
- Categories/folders within a collection
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

- Email/password authentication
- GitHub OAuth
- Google OAuth
- Invite-only registration
- Admin-controlled invitations
- Secure session management
- User roles
- Admin panel

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

```bash
git clone https://github.com/codeboy2012/DerList.git
cd DerList

cp .env.example .env
```

Edit `.env` and configure at minimum:

```env
POSTGRES_PASSWORD=your-secure-password
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

Then start DerList:

```bash
docker compose up -d
```

Once the containers are healthy, open:

**[http://localhost:3000](http://localhost:3000)**

### Verify the installation

```bash
docker compose ps
```

### View logs

```bash
docker compose logs -f app
```

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
- Invite-only registration
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

DerList includes automated tests for core functionality.

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

Run the test suite with the project's configured test command.

---

# 🗺️ Roadmap

DerList is being developed through a long-term release roadmap.

### Current

**v0.11.x — Product Importer & AI Research**

Focused on improving product identification, AI research, validation, image handling, and importer reliability.

### Upcoming

**v0.12.0 — AI Intelligence Improvements**

- Better AI product research
- Better product identity verification
- Improved AI prompts
- Structured AI JSON output
- Better source tracking
- Improved research accuracy
- Better handling of incorrect search results
- Improved manual fallback

### Long-Term

The roadmap continues through the `1.x` releases, with major milestones including:

- Product intelligence
- Advanced pricing
- Wishlist intelligence
- Universal importing
- AI Shopping Assistant
- Browser extension
- Notifications
- Offline/PWA
- Mobile applications
- Advanced AI
- Automation
- Production readiness

There is no public sharing, marketplace or PC builder in the current application; those are not
committed roadmap items.

The current major roadmap target is **v1.20.0**.

DerList will continue beyond v1.20 with additional features and platform improvements.

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

- **[Changelog](https://github.com/codeboy2012/DerList/blob/main/CHANGELOG.md)**
- **[GitHub Repository](https://github.com/codeboy2012/DerList)**
- **[Issues](https://github.com/codeboy2012/DerList/issues)**
- **[Releases](https://github.com/codeboy2012/DerList/releases)**

---

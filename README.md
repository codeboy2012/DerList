# DerList

**The open-source universal wishlist and shopping planner.**

DerList is a self-hosted web application for organizing products you want to buy, researching products with AI, tracking prices, and managing wishlists — without subscriptions, ads, or vendor lock-in.

> 🚧 **DerList is currently in active alpha development.**
>
> Features are being actively developed and may change between releases.

**Current version:** `0.11.5`  
**Latest stable release:** `0.11.0`

📋 **[View the full Changelog](https://github.com/codeboy2012/DerList/blob/main/CHNAGELOG.md)**

---

## ✨ Features

### 🛒 Wishlists

- Unlimited wishlists
- Create, rename, duplicate, archive, and delete wishlists
- Product organization
- Categories and folders
- Subfolders
- Custom labels
- Priority levels
- Quantity tracking
- Desired price
- Purchase status
- Need-by dates
- Wishlist notes
- Top Picks
- Product images
- Search and filtering
- Public, private, and unlisted wishlists

### 📦 Product Management

Products can store detailed information including:

- Product name
- Brand
- Manufacturer
- Model
- Category
- Subcategory
- SKU
- UPC
- ASIN
- MPN
- Product URL
- Store URL
- Description
- Notes
- Tags
- Specifications
- Images
- Pricing
- Sellers
- Shipping
- Tax
- Coupons
- Promo codes
- AI metadata

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

Current product pricing functionality includes:

- Current price
- Currency
- Price validation
- Multiple sellers
- Original/MSRP pricing support
- Discount information
- Shipping
- Tax
- Coupons
- Promo codes
- Manual pricing controls

Advanced price tracking and historical pricing are currently in development.

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
````

Edit `.env` and configure at minimum:

```env
POSTGRES_PASSWORD=your-secure-password
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
AUTH_SECRET=your-generated-secret
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

### Health check

```text
http://localhost:3000/api/health
```

---

# 📋 Requirements

### Recommended

* Docker
* Docker Compose v2+
* Linux server
* 2 GB+ RAM
* PostgreSQL 16+

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

* Argon2id password hashing
* SHA-256 hashed session tokens
* HttpOnly cookies
* Secure cookies
* SameSite protection
* Server-side authorization
* Zod input validation
* Invite-only registration
* Encrypted provider API keys
* SSRF protection
* Private network blocking
* Internal hostname blocking
* Image URL validation
* HTTP image verification
* No API secrets exposed to clients

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

* Product validation
* ASIN extraction
* URL normalization
* Search providers
* AI providers
* Image validation
* Image HTTP verification
* SSRF protection
* Completeness scoring
* Product identification
* Import behavior

Run the test suite with the project's configured test command.

---

# 🗺️ Roadmap

DerList is being developed through a long-term release roadmap.

### Current

**v0.11.x — Product Importer & AI Research**

Focused on improving product identification, AI research, validation, image handling, and importer reliability.

### Upcoming

**v0.12.0 — AI Intelligence Improvements**

* Better AI product research
* Better product identity verification
* Improved AI prompts
* Structured AI JSON output
* Better source tracking
* Improved research accuracy
* Better handling of incorrect search results
* Improved manual fallback

### Long-Term

The roadmap continues through the `1.x` releases, with major milestones including:

* Product intelligence
* Advanced pricing
* Wishlist intelligence
* Price tracking
* Universal importing
* AI Shopping Assistant
* Sharing
* Gift registries
* Browser extension
* Notifications
* Offline/PWA
* PC Builder
* Advanced PC Builder
* Mobile applications
* Advanced AI
* Social and collaboration
* Automation
* Production readiness

The current major roadmap target is **v1.20.0**.

DerList will continue beyond v1.20 with additional features and platform improvements.

📋 **[View the complete DerList Changelog](https://github.com/codeboy2012/DerList/blob/main/CHNAGELOG.md)**

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

* **[Changelog](https://github.com/codeboy2012/DerList/blob/main/CHNAGELOG.md)**
* **[GitHub Repository](https://github.com/codeboy2012/DerList)**
* **[Issues](https://github.com/codeboy2012/DerList/issues)**
* **[Releases](https://github.com/codeboy2012/DerList/releases)**

---

# 🛒 DerList

## The Modern Open-Source Universal Wishlist, Shopping Planner & PC Builder

_A beautiful, intelligent, and completely free platform for organizing everything you want to buy—whether it's your next gaming PC, dream setup, gifts, home projects, or everyday shopping._

<p align="center">

**Free Forever • Open Source • Self-Hostable • Community Driven**

</p>

---

## 🌐 Website

**Visit DerList**

https://derlist.dpdns.org

---

## 📖 Documentation

Everything you need to know about installing, configuring, developing, and using DerList.

https://docs.derlist.dpdns.org

---

## 🚀 Installation Guide

> [!IMPORTANT]
>
> ### Current Platform Support
>
> At this time, **DerList officially supports Linux only** for self-hosting.
>
> Support for **Windows** and **macOS** is planned for a future release.

### Quick Start (Docker)

**Prerequisites:** Docker and Docker Compose installed on a Linux server.

```bash
# 1. Clone the repository
git clone https://github.com/codeboy2012/DerList
cd DerList

# 2. Configure your environment
cp .env.example .env
# Edit .env — fill in at minimum:
#   DOMAIN, POSTGRES_PASSWORD, AUTH_SECRET, PROVIDER_ENCRYPTION_KEY
#   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME

# 3. Start everything
docker compose up -d
```

That's it. DerList will:

- Start PostgreSQL and wait until it's healthy
- Run all database migrations automatically
- Create the admin account on first run (never duplicated)
- Provision HTTPS certificates via Caddy + Let's Encrypt
- Serve your app at `https://your-domain.com`

**No manual `prisma` commands. No `docker exec`. No `npm` commands.**

#### Generating secrets

```bash
# AUTH_SECRET
openssl rand -base64 32

# PROVIDER_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### Checking status

```bash
docker compose ps          # container states
docker compose logs app    # application logs
curl https://your-domain.com/api/health  # health check JSON
```

#### Updating DerList

```bash
git pull
docker compose up -d --build
```

#### Full documentation

Complete setup guides, reverse proxy configuration, backups, and troubleshooting:

👉 **https://docs.derlist.dpdns.org/guides/getting-started.html**

---

## 📦 GitHub Repository

View the source code, report issues, contribute features, or submit pull requests.

https://github.com/codeboy2012/DerList

---

# 🚀 What is DerList?

DerList is a next-generation wishlist platform designed to replace dozens of separate shopping applications with one modern, fast, and intelligent experience.

Instead of juggling:

- Wishlists
- Shopping lists
- Price trackers
- Browser bookmarks
- Notes apps
- PC builders
- Gift lists
- Product comparison sites

...DerList brings everything together into a single application.

Whether you're saving products for later, planning a gaming setup, tracking price drops, organizing Christmas gifts, or building your next PC, DerList keeps everything organized in one place.

---

# ❤️ Why DerList Exists

Most wishlist applications suffer from the same problems.

They lock features behind expensive subscriptions.

They display intrusive advertisements.

They collect unnecessary user data.

They only support a few retailers.

They're slow.

They're outdated.

They're closed source.

They're impossible to customize.

DerList was created to solve those problems.

Our philosophy is simple:

> **Great software should be free, beautiful, privacy-respecting, and available to everyone.**

No subscriptions.

No advertisements.

No feature paywalls.

No vendor lock-in.

Just an application built for users—not investors.

---

# ✨ Core Features

## 🛍 Universal Wishlists

Create unlimited wishlists for literally anything.

Perfect for:

- Gaming setups
- Dream PCs
- Birthday lists
- Christmas gifts
- College supplies
- Home renovations
- Smart home devices
- Photography gear
- Cars
- Furniture
- Electronics
- Collectibles
- Future purchases

Features include:

- Unlimited wishlists
- Unlimited folders
- Unlimited products
- Categories
- Smart organization
- Rich product cards
- Product images
- Notes
- Tags
- Favorites
- Archive support
- Public lists
- Private lists
- Shared lists

---

## 🤖 AI-Powered Organization

DerList includes intelligent AI tools that help keep your wishlist organized automatically.

Current capabilities include:

- AI Product Autofill
- AI Product Identification
- Automatic Category Detection
- Brand Recognition
- Product Cleanup
- Duplicate Detection
- Metadata Enrichment

Future AI features include:

- Shopping recommendations
- Price prediction
- Automatic deal detection
- Alternative product suggestions
- Missing accessory detection
- Complete PC recommendations

---

## 🔗 Smart Product Import

Simply paste a product URL.

DerList automatically imports information from supported retailers.

Imported information includes:

- Product title
- Images
- Price
- Currency
- Brand
- Retailer
- Description
- Categories
- Product specifications
- Availability
- Metadata
- Product identifiers
- Variants

No manual setup.

Paste.

Save.

Done.

---

## 📈 Live Price Tracking

Never miss another deal.

DerList tracks product prices across supported stores.

Features:

- Current price
- Sale price
- Price comparison
- Multiple retailers
- Lowest available price

Upcoming:

- Historical pricing
- Interactive price charts
- Price alerts
- Restock notifications
- Price prediction

---

## 💻 Free PC Builder

One of DerList's biggest upcoming features.

Unlike many existing PC builders, DerList's PC Builder will be completely free.

Planned features include:

- Compatibility checking
- Live component pricing
- Estimated power consumption
- Performance estimates
- Bottleneck analysis
- Upgrade recommendations
- Saved builds
- Public builds
- Build sharing
- AI-assisted recommendations

---

## 👥 User Accounts

Secure authentication with modern OAuth providers.

Supported today:

- Google
- GitHub

Future providers:

- Discord
- Microsoft
- Apple
- Passkeys

Account features include:

- Secure login
- Multiple devices
- User profiles
- Session management
- Account settings

---

## 📤 Sharing

Share almost everything.

Including:

- Wishlists
- Shopping lists
- PC builds
- Individual products
- Public profiles

Generate shareable links in seconds.

---

## ⚡ Performance First

Performance is a core part of DerList.

Goals include:

- Lightning-fast navigation
- Excellent Lighthouse scores
- Excellent Core Web Vitals
- Fast API responses
- Optimized images
- Lazy loading
- Minimal JavaScript
- Responsive UI
- Smooth animations

---

# 🎨 Design Philosophy

DerList follows a modern design language inspired by clean, minimal interfaces.

The interface focuses on:

- Beautiful dark mode
- Rounded components
- Smooth animations
- Consistent spacing
- Accessibility
- Mobile-first layouts
- Fast interactions
- Minimal distractions

The goal is to create software that feels polished while staying incredibly fast.

---

# 🔒 Privacy

Your wishlist belongs to you.

DerList respects your privacy.

We believe users should own their own data.

That's why DerList is:

- Open source
- Self-hostable
- Privacy focused
- Transparent

No hidden tracking.

No selling your information.

No unnecessary analytics.

---

# 🌐 Self Hosting

DerList is designed to be easy to deploy while remaining powerful enough for advanced users.

Whether you're hosting it for yourself, your family, a school, or an organization, DerList gives you complete control over your data.

See the [Installation Guide](#-installation-guide) above for the three-command quick start.

### 📚 Full Documentation

Complete installation and deployment guides, reverse proxy setup, Cloudflare, backups, and troubleshooting:

## 👉 [https://docs.derlist.dpdns.org](https://docs.derlist.dpdns.org)

The documentation includes:

- Installation Guide
- Quick Start
- Docker Deployment
- Environment Variables
- Database Setup
- Authentication
- Reverse Proxy Configuration
- Cloudflare Setup
- Updating DerList
- Backups
- Production Deployments
- Security Recommendations
- Troubleshooting
- Frequently Asked Questions
- API Documentation
- Development Guides

---

# 🛠 Technology Stack

DerList is built using modern technologies.

Current stack:

- TypeScript
- Next.js
- React
- Prisma ORM
- PostgreSQL
- Tailwind CSS
- OAuth Authentication
- OpenRouter AI
- Cloudflare
- GitHub Actions

Additional technologies will continue to be added as the project evolves.

---

# 📱 Cross Platform

DerList works everywhere.

Supported today:

- Windows
- macOS
- Linux
- ChromeOS
- Android
- iPhone
- iPad
- Android Tablets

Future plans:

- Native Windows App
- Native macOS App
- Native Linux App
- Android App
- iOS App
- Progressive Web App Improvements
- Offline Mode

---

# 📅 Roadmap

## Current Focus

- AI Improvements
- Better Product Importing
- Additional Retailers
- Wishlist Improvements
- Documentation

## Coming Soon

- Price History
- Price Alerts
- Browser Extension
- Public User Profiles
- More OAuth Providers

## Future

- Complete PC Builder
- Mobile Applications
- AI Shopping Assistant
- Community Marketplace
- Build Sharing
- Automatic Deal Detection
- Universal Product Search

---

# ❤️ Contributing

DerList is community-driven.

Whether you:

- Report bugs
- Improve documentation
- Submit pull requests
- Suggest features
- Improve translations
- Design interfaces
- Write tests

...your contribution helps make DerList better for everyone.

Please read the documentation before contributing:

📖 [https://docs.derlist.dpdns.org](https://docs.derlist.dpdns.org)

---

# 📜 License

DerList is licensed under the **MIT License**.

You are free to:

- Use
- Modify
- Fork
- Self-host
- Learn from
- Improve
- Redistribute

Forever.

---

# ⭐ Support the Project

If you enjoy DerList, consider:

- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- 🤝 Contributing code
- 📖 Improving documentation
- ❤️ Sharing the project with others

Every contribution helps make DerList better.

---

<div align="center">

## Built by **CodeBoy2012** and the open-source community.

### **Powered by humans. Accelerated by AI. Built for everyone.**

</div>

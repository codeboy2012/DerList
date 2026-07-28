/**
 * DerList — Database Seed
 *
 * Creates the initial OWNER account.
 *
 * This script is idempotent — it will not create a duplicate account
 * if a user with the same email or username already exists.
 *
 * Required environment variables:
 *   ADMIN_EMAIL        — login email for the owner account
 *   ADMIN_PASSWORD     — plain-text password (hashed with Argon2 before storing)
 *   ADMIN_USERNAME     — URL-safe username (lowercase, no spaces)
 *   ADMIN_DISPLAY_NAME — human-readable display name (optional, defaults to username)
 *
 * Run manually:
 *   npx prisma db seed
 *
 * In Docker this is called automatically by docker-entrypoint.sh
 * when the users table is empty.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import argon2 from 'argon2';
import { Pool } from 'pg';

// ── Validate required seed variables ─────────────────────────────────────────

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const username = process.env.ADMIN_USERNAME;
const displayName = process.env.ADMIN_DISPLAY_NAME || username;

if (!email || !password || !username) {
  console.error('');
  console.error('  Seed failed: missing required variables.');
  console.error('  Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_USERNAME in .env');
  console.error('');
  process.exit(1);
}

// ── Prisma client (mirrors src/lib/prisma.ts setup) ──────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ── Seed logic ────────────────────────────────────────────────────────────────

async function main() {
  // Guard: never create a duplicate account
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
    select: { id: true, email: true, username: true },
  });

  if (existing) {
    console.log(`  ✓ Owner account already exists (${existing.email}) — nothing to do.`);
    return;
  }

  const passwordHash = await argon2.hash(password!);

  const user = await prisma.user.create({
    data: {
      email: email!,
      username: username!,
      displayName: displayName!,
      passwordHash,
      role: Role.OWNER,
      emailVerified: true,
    },
    select: { id: true, email: true, username: true, role: true },
  });

  console.log('');
  console.log('  ✓ Owner account created successfully.');
  console.log(`    Email:    ${user.email}`);
  console.log(`    Username: ${user.username}`);
  console.log(`    Role:     ${user.role}`);
  console.log('');
}

main()
  .catch((err) => {
    console.error('  Seed error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

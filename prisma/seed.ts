import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const username = process.env.ADMIN_USERNAME;
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Admin";

  // Skip seeding if required env vars are not set
  if (!email || !password || !username) {
    console.log("⏭️  Seed skipped: ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_USERNAME are required.");
    return;
  }

  // Check if any user with this email or username already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existing) {
    console.log("✅ Owner account already exists — skipping seed.");
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash,
      role: Role.OWNER,
      emailVerified: true,
    },
  });

  console.log(`✅ Owner account created (${email}).`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

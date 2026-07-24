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
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const username = process.env.ADMIN_USERNAME!;
  const displayName = process.env.ADMIN_DISPLAY_NAME!;

  console.log({
  email,
  username,
  displayName,
  hasPassword: !!password,
});
  const passwordHash = await argon2.hash(password);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        { username },
      ],
    },
  });

  if (existing) {
    console.log("Account already exists.");
    return;
  }

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

  console.log("✅ Owner account created.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
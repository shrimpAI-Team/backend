import "dotenv/config";
import * as bcrypt from "bcrypt";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = process.env.ADMIN_DEFAULT_EMAIL || "admin@shrimp.ai";
  const password = process.env.ADMIN_DEFAULT_PASSWORD || "Admin@123456";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: "ADMIN",
      isActive: true,
      password: passwordHash,
    },
    create: {
      email,
      password: passwordHash,
      name: "Quản Trị Viên Hệ Thống",
      role: "ADMIN",
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`[SEED] Tài khoản Admin: ${admin.email} | Vai trò: ${admin.role}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

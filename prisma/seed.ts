import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env");

  await db.admin.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 12) },
    create: { email, name: "Super Admin", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Super Admin ready: ${email}`);

  if ((await db.project.count()) === 0) {
    await db.project.create({
      data: { name: "TGT Exam 2026 · Shift 1", examName: "UPESSC TGT Exam 2026", examDate: "12 Oct 2026", shift: "Shift 1" },
    });
    console.log("Created an empty first project. Add signatories from the dashboard.");
  }
}

main().finally(() => db.$disconnect());

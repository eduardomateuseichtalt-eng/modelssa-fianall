import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { getPasswordPolicyError } from "./lib/password-policy";

const seedModelEmails = [
  "ayla@models-sa.com",
  "isis@models-sa.com",
  "lina@models-sa.com",
  "vitoria@models-sa.com",
  "maya@models-sa.com",
  "sabrina@models-sa.com",
  "helena@models-sa.com",
  "bianca@models-sa.com",
];

async function main() {
  const seedUserPassword = String(process.env.SEED_USER_PASSWORD || "");
  const seedAdminPassword = String(process.env.SEED_ADMIN_PASSWORD || "");
  const seedUserPasswordError = getPasswordPolicyError(seedUserPassword);
  const seedAdminPasswordError = getPasswordPolicyError(seedAdminPassword);

  if (seedUserPasswordError || seedAdminPasswordError) {
    throw new Error(
      "Configure SEED_USER_PASSWORD e SEED_ADMIN_PASSWORD com senhas fortes antes de executar o seed."
    );
  }

  const passwordHash = await bcrypt.hash(seedUserPassword, 10);

  if (seedModelEmails.length > 0) {
    const seededModels = await prisma.model.findMany({
      where: { email: { in: seedModelEmails } },
      select: { id: true },
    });

    const seededIds = seededModels.map((model) => model.id);
    if (seededIds.length > 0) {
      const shots = await prisma.shot.findMany({
        where: { modelId: { in: seededIds } },
        select: { id: true },
      });
      const shotIds = shots.map((shot) => shot.id);

      const operations = [
        prisma.cityStat.deleteMany({ where: { modelId: { in: seededIds } } }),
        prisma.media.deleteMany({ where: { modelId: { in: seededIds } } }),
        prisma.shot.deleteMany({ where: { modelId: { in: seededIds } } }),
        prisma.model.deleteMany({ where: { id: { in: seededIds } } }),
      ];

      if (shotIds.length > 0) {
        operations.unshift(
          prisma.shotLike.deleteMany({ where: { shotId: { in: shotIds } } })
        );
      }

      await prisma.$transaction(operations);
    }
  }

  await prisma.user.upsert({
    where: { email: "cliente@models-sa.com" },
    update: {
      displayName: "Cliente Demo",
      passwordHash,
      role: "USER",
    },
    create: {
      email: "cliente@models-sa.com",
      displayName: "Cliente Demo",
      passwordHash,
      role: "USER",
    },
  });

  const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 10);
  await prisma.user.upsert({
    where: { email: "eduardomateuseichtalt@gmail.com" },
    update: {
      displayName: "Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
    create: {
      email: "eduardomateuseichtalt@gmail.com",
      displayName: "Admin",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
    },
  });

}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed concluido.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";

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

  const adminPasswordHash = await bcrypt.hash("vamosmengao10", 10);
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

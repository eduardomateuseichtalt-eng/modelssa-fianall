import bcrypt from "bcryptjs";
import { ShotType } from "@prisma/client";
import { prisma } from "./lib/prisma";

const models = [
  {
    name: "Ayla Monteiro",
    email: "ayla@models-sa.com",
    age: 23,
    city: "Sao Paulo",
    bio: "Perfil premium com foco em campanhas fashion e editoriais.",
    instagram: "@aylamonteiro",
    whatsapp: "+55 11 99999-1111",
    height: 172,
    weight: 56,
    bust: 88,
    waist: 62,
    hips: 90,
    priceHour: 450,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Isis Mar",
    email: "isis@models-sa.com",
    age: 26,
    city: "Rio de Janeiro",
    bio: "Atendimento elegante com agenda reduzida e alto padrao.",
    instagram: "@isismar",
    whatsapp: "+55 21 99999-2222",
    height: 170,
    weight: 54,
    bust: 90,
    waist: 60,
    hips: 92,
    priceHour: 520,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Lina Duarte",
    email: "lina@models-sa.com",
    age: 24,
    city: "Belo Horizonte",
    bio: "Experiencia premium para eventos privados e campanhas.",
    instagram: "@linaduarte",
    whatsapp: "+55 31 99999-3333",
    height: 168,
    weight: 52,
    bust: 86,
    waist: 60,
    hips: 90,
    priceHour: 380,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Vitoria Capri",
    email: "vitoria@models-sa.com",
    age: 27,
    city: "Curitiba",
    bio: "Imagem sofisticada, castings e encontros exclusivos.",
    instagram: "@vitoriacapri",
    whatsapp: "+55 41 99999-4444",
    height: 175,
    weight: 58,
    bust: 92,
    waist: 64,
    hips: 94,
    priceHour: 600,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Maya Luz",
    email: "maya@models-sa.com",
    age: 22,
    city: "Brasilia",
    bio: "Presenca discreta com estilo editorial e glamour.",
    instagram: "@mayaluz",
    whatsapp: "+55 61 99999-5555",
    height: 169,
    weight: 53,
    bust: 87,
    waist: 61,
    hips: 89,
    priceHour: 420,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Sabrina Fleur",
    email: "sabrina@models-sa.com",
    age: 25,
    city: "Recife",
    bio: "Perfil premium com foco em ensaios e campanhas.",
    instagram: "@sabrinafleur",
    whatsapp: "+55 81 99999-6666",
    height: 173,
    weight: 57,
    bust: 91,
    waist: 63,
    hips: 93,
    priceHour: 470,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Helena Noir",
    email: "helena@models-sa.com",
    age: 28,
    city: "Porto Alegre",
    bio: "Alto padrao e foco em publico premium.",
    instagram: "@helenanoir",
    whatsapp: "+55 51 99999-7777",
    height: 176,
    weight: 59,
    bust: 93,
    waist: 65,
    hips: 95,
    priceHour: 650,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
  {
    name: "Bianca Vale",
    email: "bianca@models-sa.com",
    age: 24,
    city: "Florianopolis",
    bio: "Vibe sofisticada e atendimento reservado.",
    instagram: "@biancavale",
    whatsapp: "+55 48 99999-8888",
    height: 171,
    weight: 55,
    bust: 89,
    waist: 61,
    hips: 92,
    priceHour: 480,
    coverUrl: "/model-placeholder.svg",
    avatarUrl: "/model-placeholder.svg",
  },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo123", 10);

  for (const model of models) {
    await prisma.model.upsert({
      where: { email: model.email },
      update: {
        ...model,
        password: passwordHash,
        isVerified: true,
      },
      create: {
        ...model,
        password: passwordHash,
        isVerified: true,
      },
    });
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

  const seededModels = await prisma.model.findMany({
    where: { email: { in: models.map((model) => model.email) } },
    select: { id: true, email: true },
  });

  const modelByEmail = new Map(
    seededModels.map((model) => [model.email, model.id])
  );

  const shots = [
    {
      modelEmail: "ayla@models-sa.com",
      type: ShotType.IMAGE,
      imageUrl: "/model-placeholder.svg",
      videoUrl: null,
      posterUrl: null,
    },
    {
      modelEmail: "isis@models-sa.com",
      type: ShotType.IMAGE,
      imageUrl: "/model-placeholder.svg",
      videoUrl: null,
      posterUrl: null,
    },
    {
      modelEmail: "lina@models-sa.com",
      type: ShotType.IMAGE,
      imageUrl: "/model-placeholder.svg",
      videoUrl: null,
      posterUrl: null,
    },
  ];

  for (const shot of shots) {
    const modelId = modelByEmail.get(shot.modelEmail);

    if (!modelId) {
      continue;
    }

    const safeVideoUrl = shot.videoUrl ?? "";
    const safePosterUrl = shot.posterUrl ?? "";

    const existingShot = await prisma.shot.findFirst({
      where: {
        modelId,
        imageUrl: shot.imageUrl,
        videoUrl: safeVideoUrl,
      },
    });

    if (existingShot) {
      await prisma.shot.update({
        where: { id: existingShot.id },
        data: {
          type: shot.type,
          posterUrl: safePosterUrl,
          isActive: true,
        },
      });
    } else {
      await prisma.shot.create({
        data: {
          modelId,
          type: shot.type,
          imageUrl: shot.imageUrl,
          videoUrl: safeVideoUrl,
          posterUrl: safePosterUrl,
          isActive: true,
        },
      });
    }
  }

  const cityStats = [
    {
      modelEmail: "ayla@models-sa.com",
      city: "Sao Paulo - SP",
      color: "BLACK",
      count: 42,
      days: 14,
    },
    {
      modelEmail: "ayla@models-sa.com",
      city: "Sao Paulo - SP",
      color: "BROWN",
      count: 36,
      days: 14,
    },
    {
      modelEmail: "ayla@models-sa.com",
      city: "Sao Paulo - SP",
      color: "WHITE",
      count: 22,
      days: 14,
    },
    {
      modelEmail: "isis@models-sa.com",
      city: "Rio de Janeiro - RJ",
      color: "BLACK",
      count: 28,
      days: 10,
    },
    {
      modelEmail: "isis@models-sa.com",
      city: "Rio de Janeiro - RJ",
      color: "BROWN",
      count: 31,
      days: 10,
    },
    {
      modelEmail: "isis@models-sa.com",
      city: "Rio de Janeiro - RJ",
      color: "WHITE",
      count: 19,
      days: 10,
    },
    {
      modelEmail: "lina@models-sa.com",
      city: "Belo Horizonte - MG",
      color: "BLACK",
      count: 18,
      days: 7,
    },
    {
      modelEmail: "lina@models-sa.com",
      city: "Belo Horizonte - MG",
      color: "BROWN",
      count: 24,
      days: 7,
    },
    {
      modelEmail: "lina@models-sa.com",
      city: "Belo Horizonte - MG",
      color: "WHITE",
      count: 12,
      days: 7,
    },
  ];

  for (const stat of cityStats) {
    const modelId = modelByEmail.get(stat.modelEmail);
    if (!modelId) {
      continue;
    }
    await prisma.cityStat.create({
      data: {
        modelId,
        city: stat.city,
        cityKey: stat.city.toLowerCase(),
        color: stat.color,
        count: stat.count,
        days: stat.days,
      },
    });
  }
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

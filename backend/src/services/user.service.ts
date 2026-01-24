import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export async function createUser(
  email: string,
  password: string,
  displayName?: string
) {
  const exists = await prisma.user.findUnique({
    where: { email }
  });

  if (exists) {
    throw new Error("Usuário já existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName
    }
  });

  return user;
}

export async function authenticateUser(
  email: string,
  password: string
) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    throw new Error("Credenciais inválidas");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    throw new Error("Credenciais inválidas");
  }

  return user;
}

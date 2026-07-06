export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  "123456789012",
  "123456789123",
  "admin12345678",
  "modelsclub123",
  "password1234",
  "qwerty123456",
  "senha12345678",
  "senha@123456",
  "welcome123456",
]);

export function getPasswordPolicyError(password: unknown): string | null {
  if (typeof password !== "string") {
    return "Senha invalida.";
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no maximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no maximo ${PASSWORD_MAX_LENGTH} bytes.`;
  }
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase())) {
    return "Esta senha e muito comum. Escolha uma senha diferente.";
  }
  return null;
}

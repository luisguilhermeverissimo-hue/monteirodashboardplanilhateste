import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// scrypt (node:crypto nativo) em vez de bcrypt para evitar dependência com
// binding nativo no scaffold inicial. Reavaliar para Argon2id se o volume
// de usuários justificar o custo de tuning adicional.
const KEY_LEN = 64;

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verificarSenha(senha: string, senhaHash: string): boolean {
  const [salt, hash] = senhaHash.split(":");
  if (!salt || !hash) return false;
  const hashCalculado = scryptSync(senha, salt, KEY_LEN);
  const hashArmazenado = Buffer.from(hash, "hex");
  if (hashCalculado.length !== hashArmazenado.length) return false;
  return timingSafeEqual(hashCalculado, hashArmazenado);
}

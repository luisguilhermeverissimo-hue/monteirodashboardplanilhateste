import "dotenv/config";
import { z } from "zod";

// Falha rápido e alto na subida do processo se uma variável obrigatória
// estiver ausente, em vez de falhar tarde (ex.: no meio de uma chamada à Loy).
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3333),
  WEB_ORIGIN: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve ter ao menos 16 caracteres"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  LOY_API_BASE_URL: z.string().url(),
  LOY_API_TOKEN: z.string().min(1),
  STORAGE_DIR: z.string().default("./storage/documentos"),
  COLLECTOR_CRON: z.string().default("*/30 * * * *"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Configuração de ambiente inválida:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

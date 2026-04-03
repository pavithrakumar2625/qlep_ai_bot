import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env"), override: false });

const envSchema = z.object({
  API_PORT: z.coerce.number().default(4000),
  AI_PROVIDER: z.enum(["auto", "openai", "groq", "fallback"]).default("auto"),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini"),
  GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
  AI_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).default("low"),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
  MYSQL_HOST: z.string().default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_DATABASE: z.string().default("qelp"),
  MYSQL_USER: z.string().default("root"),
  MYSQL_PASSWORD: z.string().default(""),
  AUTH_SECRET: z.string().min(8).default("change-me-in-local-dev")
});

export const env = envSchema.parse(process.env);

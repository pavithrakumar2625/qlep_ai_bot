import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../../.env"), override: false });

const NODE_ENV = (process.env.NODE_ENV ?? "development") as "development" | "production" | "test";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    API_PORT: z.coerce.number().default(4000),
    AI_PROVIDER: z.enum(["auto", "openai", "groq", "fallback"]).default("auto"),
    OPENAI_MODEL: z.string().default("gpt-4o-mini"),
    GROQ_MODEL: z.string().default("openai/gpt-oss-20b"),
    AI_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).default("low"),
    AI_TIMEOUT_MS: z.coerce.number().default(20000),
    OPENAI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    STT_PROVIDER: z.enum(["openai", "groq", "none"]).default("none"),
    STT_MODEL: z.string().default("whisper-1"),
    PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:4000"),
    ADMIN_ORIGIN: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgres://qelp:qelp@localhost:5432/qelp"),
    AUTH_SECRET: z.string().min(8).default("change-me-in-local-dev"),
    STORAGE_PROVIDER: z.enum(["local"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().default("./storage"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    RATE_LIMIT_FEEDBACK_PER_MIN: z.coerce.number().default(30),
    RATE_LIMIT_LOGIN_PER_MIN: z.coerce.number().default(10),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production") {
      if (value.AUTH_SECRET === "change-me-in-local-dev") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET must be set to a non-default value outside development",
        });
      }
      if (value.AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["AUTH_SECRET"],
          message: "AUTH_SECRET must be at least 32 characters in production",
        });
      }
    }
  });

const parsed = envSchema.safeParse({ ...process.env, NODE_ENV });
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";

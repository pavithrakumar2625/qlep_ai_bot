import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";
import { env } from "../config/env.js";

function buildLimiter(overrides: Partial<Options>) {
  return rateLimit({
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "Too many requests. Slow down and try again shortly." });
    },
    ...overrides,
  });
}

export const feedbackPublicLimiter = buildLimiter({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_FEEDBACK_PER_MIN,
  keyGenerator: (request: Request) => {
    const projectKey = request.header("x-qelp-project-key") ?? "no-key";
    const ip = request.ip ?? "unknown";
    return `${ip}:${projectKey}`;
  },
});

export const loginLimiter = buildLimiter({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_LOGIN_PER_MIN,
  keyGenerator: (request: Request) => {
    const email = typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "no-email";
    const ip = request.ip ?? "unknown";
    return `${ip}:${email}`;
  },
});

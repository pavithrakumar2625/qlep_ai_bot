import { Router } from "express";
import { z } from "zod";
import { repository } from "../repositories/postgresRepository.js";
import { createAuthToken, AUTH_TOKEN_TTL_SECONDS } from "../services/authTokens.js";
import { verifyPassword } from "../services/passwords.js";
import { requireAuth } from "../auth/middleware.js";
import { loginLimiter } from "../middleware/rateLimit.js";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Invalid login payload", issues: parsed.error.flatten() });
    return;
  }

  const record = await repository.getUserAuthByEmail(parsed.data.email);
  if (!record) {
    response.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, record.passwordHash);
  if (!valid) {
    response.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = createAuthToken(record.user);
  response.json({ token, user: record.user, expiresInSeconds: AUTH_TOKEN_TTL_SECONDS });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  response.json({ user: request.authUser });
});

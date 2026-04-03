import { Router } from "express";
import { z } from "zod";
import { repository } from "../repositories/mysqlRepository.js";
import { createAuthToken } from "../services/authTokens.js";
import { verifyPassword } from "../services/passwords.js";
import { requireAuth } from "../auth/middleware.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const authRouter = Router();

authRouter.post("/login", async (request, response) => {
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
  response.json({ token, user: record.user });
});

authRouter.get("/me", requireAuth, async (request, response) => {
  response.json({ user: request.authUser });
});

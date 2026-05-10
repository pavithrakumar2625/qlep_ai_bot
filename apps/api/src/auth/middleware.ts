import type { NextFunction, Request, Response } from "express";
import type { User } from "@qelp/shared/contracts";
import { verifyAuthToken } from "../services/authTokens.js";
import { repository } from "../repositories/postgresRepository.js";
import { extractBearerToken } from "./requestAuth.js";

declare module "express-serve-static-core" {
  interface Request {
    authUser?: User;
  }
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const token = extractBearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Authentication required" });
    return;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    response.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const user = await repository.getUserById(payload.userId);
  if (!user) {
    response.status(401).json({ error: "User not found" });
    return;
  }

  request.authUser = user;
  next();
}

export function requireRole(allowed: User["role"][]) {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.authUser) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!allowed.includes(request.authUser.role)) {
      response.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

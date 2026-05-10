import { Router } from "express";
import { sql as pg } from "../db/postgres.js";
import { logger } from "../logger.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  const startedAt = Date.now();
  try {
    await Promise.race([
      pg`SELECT 1`,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error("db ping timeout")), 1500),
      ),
    ]);
    response.json({
      status: "ok",
      service: "qelp-api",
      checks: { database: "ok", durationMs: Date.now() - startedAt },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.warn({ err: error }, "health: db ping failed");
    response.status(503).json({
      status: "degraded",
      service: "qelp-api",
      checks: { database: "unreachable", durationMs: Date.now() - startedAt },
      timestamp: new Date().toISOString(),
    });
  }
});

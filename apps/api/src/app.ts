import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./logger.js";
import { authRouter } from "./routes/auth.js";
import { analyticsRouter } from "./routes/analytics.js";
import { feedbackRouter } from "./routes/feedback.js";
import { healthRouter } from "./routes/health.js";
import { uploadsRouter } from "./routes/uploads.js";
import { workspaceRouter } from "./routes/workspaces.js";

const adminCors = cors({
  origin: env.ADMIN_ORIGIN,
  credentials: true,
});

const widgetCors = cors({ origin: "*" });

const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  request.log?.error({ err: error }, "unhandled error");
  if (response.headersSent) return;
  response.status(500).json({ error: "Internal error" });
};

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req(req) {
          return { method: req.method, url: req.url };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  app.use(express.json({ limit: "4mb" }));

  app.get("/", adminCors, (_request, response) => {
    response.json({
      name: "qelp-api",
      description: "Agency-focused AI feedback intake and triage API",
      routes: ["/health", "/auth", "/workspaces", "/feedback"],
    });
  });

  app.use("/health", healthRouter);

  // Admin-origin (browser BFF or curl) — credentials allowed.
  app.use("/auth", adminCors, authRouter);
  app.use("/workspaces", adminCors, workspaceRouter);
  app.use("/workspaces", adminCors, analyticsRouter);

  // Feedback router has both authenticated (admin) and public (widget) endpoints.
  // We allow widget CORS on the whole router; the public POST is rate-limited and
  // the authenticated GET/PATCH require Bearer tokens which are not browser-cookie.
  app.use("/feedback", widgetCors, feedbackRouter);
  app.use("/uploads", widgetCors, uploadsRouter);

  app.use(errorHandler);

  return app;
}

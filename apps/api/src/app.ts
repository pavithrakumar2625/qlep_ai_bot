import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { feedbackRouter } from "./routes/feedback.js";
import { healthRouter } from "./routes/health.js";
import { workspaceRouter } from "./routes/workspaces.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "4mb" }));

  app.get("/", (_request, response) => {
    response.json({
      name: "qelp-api",
      description: "Agency-focused AI feedback intake and triage API",
      routes: ["/health", "/auth", "/workspaces", "/feedback"]
    });
  });

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/workspaces", workspaceRouter);
  app.use("/feedback", feedbackRouter);

  return app;
}

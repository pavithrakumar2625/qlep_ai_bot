import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { repository } from "../repositories/mysqlRepository.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

workspaceRouter.get("/", async (request, response) => {
  response.json({ items: await repository.listWorkspaces().then((items) => items.filter((item) => item.id === request.authUser?.workspaceId)) });
});

workspaceRouter.get("/:workspaceId/projects", async (request, response) => {
  if (request.authUser?.workspaceId !== request.params.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ items: await repository.listProjects(request.params.workspaceId) });
});

workspaceRouter.get("/:workspaceId/feedback", async (request, response) => {
  if (request.authUser?.workspaceId !== request.params.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ items: await repository.listFeedback({ workspaceId: request.params.workspaceId }) });
});

workspaceRouter.get("/:workspaceId/users", async (request, response) => {
  if (request.authUser?.workspaceId !== request.params.workspaceId) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ items: await repository.listUsers(request.params.workspaceId) });
});

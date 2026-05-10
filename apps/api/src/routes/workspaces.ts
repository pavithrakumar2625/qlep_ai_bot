import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { repository } from "../repositories/postgresRepository.js";

export const workspaceRouter = Router();

workspaceRouter.use(requireAuth);

const projectInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  clientName: z.string().trim().min(1).max(255),
  description: z.string().max(2000).optional().default(""),
});

const projectPatchSchema = projectInputSchema.partial();

const roleSchema = z.enum(["owner", "manager", "contributor", "client_viewer"]);
const userInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(255),
  role: roleSchema,
  password: z.string().min(8).max(200),
});
const userPatchSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().optional(),
    name: z.string().trim().min(1).max(255).optional(),
    role: roleSchema.optional(),
    password: z.string().min(8).max(200).optional(),
  })
  .strict();

function ensureWorkspaceAccess(
  request: Parameters<Parameters<typeof workspaceRouter.get>[1]>[0],
  workspaceId: string,
) {
  return request.authUser?.workspaceId === workspaceId;
}

workspaceRouter.get("/", async (request, response) => {
  const items = await repository.listWorkspaces();
  response.json({ items: items.filter((item) => item.id === request.authUser?.workspaceId) });
});

// Projects
workspaceRouter.get("/:workspaceId/projects", async (request, response) => {
  const workspaceId = String(request.params.workspaceId);
  if (!ensureWorkspaceAccess(request, workspaceId)) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ items: await repository.listProjects(workspaceId) });
});

workspaceRouter.post(
  "/:workspaceId/projects",
  requireRole(["owner", "manager"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const parsed = projectInputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid project payload", issues: parsed.error.flatten() });
      return;
    }
    const project = await repository.createProject(workspaceId, parsed.data);
    response.status(201).json({ item: project });
  },
);

workspaceRouter.patch(
  "/:workspaceId/projects/:projectId",
  requireRole(["owner", "manager"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const projectId = String(request.params.projectId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const existing = await repository.getProjectById(projectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      response.status(404).json({ error: "Project not found" });
      return;
    }
    const parsed = projectPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid project patch", issues: parsed.error.flatten() });
      return;
    }
    const updated = await repository.updateProject(projectId, parsed.data);
    response.json({ item: updated });
  },
);

workspaceRouter.delete(
  "/:workspaceId/projects/:projectId",
  requireRole(["owner"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const projectId = String(request.params.projectId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const existing = await repository.getProjectById(projectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      response.status(404).json({ error: "Project not found" });
      return;
    }
    await repository.deleteProject(projectId);
    response.json({ ok: true });
  },
);

workspaceRouter.post(
  "/:workspaceId/projects/:projectId/rotate-token",
  requireRole(["owner", "manager"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const projectId = String(request.params.projectId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const existing = await repository.getProjectById(projectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      response.status(404).json({ error: "Project not found" });
      return;
    }
    const updated = await repository.rotateProjectToken(projectId);
    response.json({ item: updated });
  },
);

// Feedback list (workspace-scoped)
workspaceRouter.get("/:workspaceId/feedback", async (request, response) => {
  const workspaceId = String(request.params.workspaceId);
  if (!ensureWorkspaceAccess(request, workspaceId)) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  const result = await repository.listFeedback({ workspaceId });
  response.json(result);
});

// Users
workspaceRouter.get("/:workspaceId/users", async (request, response) => {
  const workspaceId = String(request.params.workspaceId);
  if (!ensureWorkspaceAccess(request, workspaceId)) {
    response.status(403).json({ error: "Workspace access denied" });
    return;
  }
  response.json({ items: await repository.listUsers(workspaceId) });
});

workspaceRouter.post(
  "/:workspaceId/users",
  requireRole(["owner"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const parsed = userInputSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid user payload", issues: parsed.error.flatten() });
      return;
    }
    try {
      const user = await repository.createUser(workspaceId, parsed.data);
      response.status(201).json({ item: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (/duplicate key|unique constraint|users_email_unique/.test(message)) {
        response.status(409).json({ error: "Email already in use" });
        return;
      }
      throw error;
    }
  },
);

workspaceRouter.patch(
  "/:workspaceId/users/:userId",
  requireRole(["owner"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const userId = String(request.params.userId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const existing = await repository.getUserById(userId);
    if (!existing || existing.workspaceId !== workspaceId) {
      response.status(404).json({ error: "User not found" });
      return;
    }
    const parsed = userPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid user patch", issues: parsed.error.flatten() });
      return;
    }
    if (existing.role === "owner" && parsed.data.role && parsed.data.role !== "owner") {
      const owners = await repository.countOwners(workspaceId);
      if (owners <= 1) {
        response.status(400).json({ error: "Cannot demote the last owner" });
        return;
      }
    }
    const updated = await repository.updateUser(userId, parsed.data);
    response.json({ item: updated });
  },
);

workspaceRouter.delete(
  "/:workspaceId/users/:userId",
  requireRole(["owner"]),
  async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const userId = String(request.params.userId);
    if (!ensureWorkspaceAccess(request, workspaceId)) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }
    const existing = await repository.getUserById(userId);
    if (!existing || existing.workspaceId !== workspaceId) {
      response.status(404).json({ error: "User not found" });
      return;
    }
    if (existing.role === "owner") {
      const owners = await repository.countOwners(workspaceId);
      if (owners <= 1) {
        response.status(400).json({ error: "Cannot delete the last owner" });
        return;
      }
    }
    await repository.deleteUser(userId);
    response.json({ ok: true });
  },
);

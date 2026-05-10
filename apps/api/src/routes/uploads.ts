import { Router } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { createId, type AttachmentType } from "@qelp/shared/contracts";
import { requireAuth } from "../auth/middleware.js";
import { extractBearerToken } from "../auth/requestAuth.js";
import { db } from "../db/postgres.js";
import { attachments, clientProjects } from "../db/schema.js";
import { logger } from "../logger.js";
import { feedbackPublicLimiter } from "../middleware/rateLimit.js";
import { repository } from "../repositories/postgresRepository.js";
import { storage } from "../services/storage/index.js";
import { verifyAuthToken } from "../services/authTokens.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const MAX_FILE_BYTES = 30 * 1024 * 1024;

const ALLOWED_MIME: Record<string, AttachmentType> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/wav": "audio",
};

function classify(mime: string): AttachmentType | null {
  return ALLOWED_MIME[mime] ?? null;
}

function maxBytesFor(type: AttachmentType): number {
  if (type === "image") return MAX_IMAGE_BYTES;
  if (type === "audio") return MAX_AUDIO_BYTES;
  return MAX_FILE_BYTES;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, MAX_FILE_BYTES) },
  fileFilter: (_req, file, cb) => {
    if (classify(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported MIME type"));
  },
});

export const uploadsRouter = Router();

async function authorizeAdminUpload(
  bearer: string,
  workspaceId: string,
): Promise<boolean> {
  const payload = verifyAuthToken(bearer);
  if (!payload) return false;
  if (payload.workspaceId !== workspaceId) return false;
  // Confirm the user still exists and belongs to that workspace.
  const user = await repository.getUserById(payload.userId);
  return Boolean(user && user.workspaceId === workspaceId);
}

// POST /uploads — accepts multipart/form-data with file + workspaceId + projectId.
// Auth: x-qelp-project-key matching project.widgetToken (widget) OR a verified
// Bearer token whose payload.workspaceId matches the requested workspace (admin).
// Rate-limited per (IP, project key) — admin uploads share the per-IP bucket.
uploadsRouter.post(
  "/",
  feedbackPublicLimiter,
  upload.single("file"),
  async (request, response, next) => {
    try {
      const file = request.file;
      if (!file) {
        response.status(400).json({ error: "Missing file" });
        return;
      }

      const workspaceId = typeof request.body.workspaceId === "string" ? request.body.workspaceId : "";
      const projectId = typeof request.body.projectId === "string" ? request.body.projectId : "";
      if (!workspaceId || !projectId) {
        response.status(400).json({ error: "workspaceId and projectId are required" });
        return;
      }

      const project = await db.query.clientProjects.findFirst({
        where: eq(clientProjects.id, projectId),
      });
      if (!project || project.workspaceId !== workspaceId) {
        response.status(400).json({ error: "Invalid workspace or project" });
        return;
      }

      const projectKey = request.header("x-qelp-project-key");
      const widgetAuthorized = Boolean(projectKey) && projectKey === project.widgetToken;

      let adminAuthorized = false;
      if (!widgetAuthorized) {
        const bearer = extractBearerToken(request);
        if (bearer) {
          adminAuthorized = await authorizeAdminUpload(bearer, workspaceId);
        }
      }

      if (!widgetAuthorized && !adminAuthorized) {
        response.status(401).json({ error: "Unauthorized" });
        return;
      }

      const type = classify(file.mimetype);
      if (!type) {
        response.status(415).json({ error: "Unsupported MIME type" });
        return;
      }
      if (file.size > maxBytesFor(type)) {
        response.status(413).json({ error: "File too large" });
        return;
      }

      const attachmentId = createId("att");
      const ext = (file.originalname.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const storageKey = `${workspaceId}/${projectId}/${attachmentId}${ext ? `.${ext}` : ""}`;

      await storage.put({
        key: storageKey,
        body: file.buffer,
        mimeType: file.mimetype,
        size: file.size,
      });

      await db.insert(attachments).values({
        id: attachmentId,
        workspaceId,
        projectId,
        feedbackId: null,
        storageKey,
        type,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      });

      response.status(201).json({
        id: attachmentId,
        type,
        url: `/uploads/${attachmentId}`,
        mimeType: file.mimetype,
        size: file.size,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof multer.MulterError) {
        response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: error.message });
        return;
      }
      next(error);
    }
  },
);

// GET /uploads/:id — admin-only; streams the file with workspace check.
uploadsRouter.get("/:attachmentId", requireAuth, async (request, response, next) => {
  try {
    const attachmentId = Array.isArray(request.params.attachmentId)
      ? request.params.attachmentId[0]
      : request.params.attachmentId;
    const attachment = await db.query.attachments.findFirst({
      where: eq(attachments.id, attachmentId),
    });
    if (!attachment) {
      response.status(404).json({ error: "Attachment not found" });
      return;
    }
    if (attachment.workspaceId !== request.authUser?.workspaceId) {
      response.status(403).json({ error: "Workspace access denied" });
      return;
    }

    const stream = await storage.get(attachment.storageKey);
    response.setHeader("Content-Type", attachment.mimeType);
    response.setHeader("Content-Length", String(attachment.sizeBytes));
    stream.pipe(response);
  } catch (error) {
    logger.warn({ err: error, attachmentId: request.params.attachmentId }, "uploads: download failed");
    next(error);
  }
});

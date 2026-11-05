import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errors";
import * as chat from "./chat.service";

export const chatRouter = Router();
export const conversationsRouter = Router();
chatRouter.use(requireAuth);
conversationsRouter.use(requireAuth);

// protects your LLM bill: 30 questions / minute / IP
const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  collectionId: z.uuid(),
  conversationId: z.uuid().optional(),
});

chatRouter.post("/", limiter, asyncHandler(async (req, res) => {
  const b = askSchema.parse(req.body);
  res.json(await chat.ask({ userId: req.user!.id, ...b }));
}));

conversationsRouter.get("/", asyncHandler(async (req, res) => {
  res.json({ conversations: await chat.listConversations(req.user!.id) });
}));
conversationsRouter.get("/:id", asyncHandler(async (req, res) => {
  res.json({ conversation: await chat.getConversation(req.user!.id, z.uuid().parse(req.params.id)) });
}));
conversationsRouter.delete("/:id", asyncHandler(async (req, res) => {
  await chat.deleteConversation(req.user!.id, z.uuid().parse(req.params.id));
  res.status(204).end();
}));

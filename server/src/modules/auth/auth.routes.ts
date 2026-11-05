import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/errors";
import * as auth from "./auth.service";

export const authRouter = Router();

// 20 attempts / 15 min / IP on register + login (brute-force protection)
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  password: z.string().min(8).max(100),
});
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(100) });

authRouter.post("/register", limiter, asyncHandler(async (req, res) => {
  const b = registerSchema.parse(req.body);
  res.status(201).json(await auth.register(b.name, b.email, b.password));
}));

authRouter.post("/login", limiter, asyncHandler(async (req, res) => {
  const b = loginSchema.parse(req.body);
  res.json(await auth.login(b.email, b.password));
}));

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: await auth.getMe(req.user!.id) });
}));

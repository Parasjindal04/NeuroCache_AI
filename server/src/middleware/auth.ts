import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errors";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new AppError(401, "Missing token"));
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as { sub: string };
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token"));
  }
}

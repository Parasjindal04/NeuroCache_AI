import { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Wraps async handlers so a thrown error reaches errorHandler.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message });
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File too large" });
  if (err?.code === "23505") return res.status(409).json({ error: "Already exists" }); // pg unique violation

  (req as any).log?.error({ err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" }); // never leak internals to the client
}

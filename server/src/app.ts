import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middleware/errors";
import { authRouter } from "./modules/auth/auth.routes";
import { chatRouter, conversationsRouter } from "./modules/chat/chat.routes";
import { collectionsRouter } from "./modules/collections/collections.routes";
import { documentsRouter } from "./modules/documents/documents.routes";
import { healthRouter } from "./routes/health.routes";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ autoLogging: { ignore: (req) => req.url === "/api/health" } }));

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);

app.use(notFound);
app.use(errorHandler); // must be last

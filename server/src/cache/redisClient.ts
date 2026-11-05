import Redis from "ioredis";
import { env } from "../config/env";

// General-purpose client (health checks now, semantic cache in package 2).
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
redis.on("error", () => {}); // avoid crash on connection loss; callers handle failures

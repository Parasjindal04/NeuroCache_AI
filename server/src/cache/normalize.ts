import crypto from "crypto";

// Normalization for EXACT-match caching: "What is overfitting?" and "what is   overfitting" must collide.
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ") // drop punctuation, keep letters/digits in any language
    .replace(/\s+/g, " ")
    .trim();
}

export const hashQuestion = (q: string): string =>
  crypto.createHash("sha256").update(normalizeQuestion(q)).digest("hex");

// RediSearch TAG filters treat '-' and other punctuation as separators, so UUIDs must be escaped.
export const escapeTag = (v: string): string => v.replace(/[^A-Za-z0-9_]/g, (c) => `\\${c}`);

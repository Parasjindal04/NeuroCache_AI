// Three cache modes, selectable per request so the benchmark can compare them fairly.
export type CacheMode = "none" | "exact" | "semantic";

export interface CachedCitation {
  index: number;
  documentId: string;
  filename: string;
  page: number | null;
  excerpt: string;
  score: number;
}

// What we store for one cached answer (one Redis hash per entry).
export interface CacheEntry {
  id: string;                         // sha256 of the normalized question (also the exact-match key)
  userId: string;                     // isolation: never serve across users
  collectionId: string;               // isolation: never serve across knowledge bases
  question: string;                   // original (standalone) question text
  answer: string;
  citations: CachedCitation[];
  docVersions: Record<string, number>; // documentId -> version at the time the answer was generated
  kbVersion: number;                  // collections.kb_version at generation time
  model: string;
  promptVersion: string;
  createdAt: number;                  // epoch ms
  expiresAt: number;                  // epoch ms (Redis TTL enforces it too)
  status: "active" | "invalid";
}

export type CacheDecision =
  | { hit: true; kind: "exact" | "semantic"; entry: CacheEntry; similarity: number }
  | { hit: false; reason: string; similarity?: number };

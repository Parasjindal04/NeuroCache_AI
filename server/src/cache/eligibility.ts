// Decides whether a question is SAFE to cache or serve from cache.
// High embedding similarity alone is never enough; these checks run first (and again before serving).

export interface Eligibility {
  ok: boolean;
  reason?: string;
}

const TIME_SENSITIVE =
  /\b(today|tonight|tomorrow|yesterday|now|currently|current|latest|recent|recently|nowadays|right now|as of|up to date|this (morning|week|month|year))\b/i;
const USER_SPECIFIC = /\b(my|mine|myself|our|ours)\b|\bi (am|have|was|will|need|want|should)\b|\bi'(m|ve|ll|d)\b/i;
const DANGLING_REFERENCE = /^(it|its|this|that|these|those|they|them|their|he|she|his|her)\b/i;

export function isCacheable(question: string): Eligibility {
  const q = question.trim();
  if (q.split(/\s+/).length < 3) return { ok: false, reason: "too_short_ambiguous" };
  if (DANGLING_REFERENCE.test(q)) return { ok: false, reason: "unresolved_reference" };
  if (TIME_SENSITIVE.test(q)) return { ok: false, reason: "time_sensitive" };
  if (USER_SPECIFIC.test(q)) return { ok: false, reason: "user_specific" };
  return { ok: true };
}

// ---- Intent guard: cheap checks that catch "very similar embedding, different meaning" ----
const NEGATIONS = new Set(["not", "no", "never", "without", "cannot", "cant", "dont", "doesnt", "isnt", "arent", "wont", "none", "neither", "nor"]);

function tokens(q: string): string[] {
  return q.toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{M}\p{N}\s.]/gu, " ").split(/\s+/).filter(Boolean);
}

export function intentCompatible(a: string, b: string): { ok: boolean; reason?: string } {
  const ta = tokens(a), tb = tokens(b);

  // Different numbers => different question ("top 3 methods" vs "top 5 methods", "2019" vs "2023").
  const nums = (t: string[]) => new Set(t.filter((x) => /^\d+(\.\d+)?$/.test(x)));
  const na = nums(ta), nb = nums(tb);
  if (na.size !== nb.size || [...na].some((n) => !nb.has(n))) return { ok: false, reason: "number_mismatch" };

  // Negation present in only one => opposite meaning ("when to use X" vs "when not to use X").
  const hasNeg = (t: string[]) => t.some((x) => NEGATIONS.has(x));
  if (hasNeg(ta) !== hasNeg(tb)) return { ok: false, reason: "negation_mismatch" };

  return { ok: true };
}

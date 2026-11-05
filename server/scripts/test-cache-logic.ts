import assert from "node:assert/strict";
import { escapeTag, hashQuestion, normalizeQuestion } from "../src/cache/normalize";
import { intentCompatible, isCacheable } from "../src/cache/eligibility";

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log("  ok -", name); };

t("normalize: case, punctuation, spacing collapse", () =>
  assert.equal(normalizeQuestion("  What is   Overfitting?? "), "what is overfitting"));
t("hash: equal for formatting variants", () =>
  assert.equal(hashQuestion("What is overfitting?"), hashQuestion("what is  OVERFITTING")));
t("hash: different for different questions", () =>
  assert.notEqual(hashQuestion("what is overfitting"), hashQuestion("what is underfitting")));
t("normalize: keeps non-latin letters", () =>
  assert.equal(normalizeQuestion("ओवरफिटिंग क्या है?"), "ओवरफिटिंग क्या है"));
t("escapeTag: escapes uuid hyphens", () =>
  assert.equal(escapeTag("a1b2-c3d4"), "a1b2\\-c3d4"));

t("cacheable: normal question", () => assert.equal(isCacheable("What is overfitting in machine learning?").ok, true));
t("cacheable: time-sensitive rejected", () => assert.equal(isCacheable("What is the latest policy update?").reason, "time_sensitive"));
t("cacheable: user-specific rejected", () => assert.equal(isCacheable("Summarize my salary details").reason, "user_specific"));
t("cacheable: 'tell me' is NOT user-specific", () => assert.equal(isCacheable("Tell me about regularization techniques").ok, true));
t("cacheable: too short rejected", () => assert.equal(isCacheable("overfitting?").reason, "too_short_ambiguous"));
t("cacheable: dangling pronoun rejected", () => assert.equal(isCacheable("It can be prevented how").reason, "unresolved_reference"));

t("intent: paraphrase compatible", () =>
  assert.equal(intentCompatible("What is overfitting in ML?", "Explain overfitting in machine learning").ok, true));
t("intent: number mismatch", () =>
  assert.equal(intentCompatible("List 3 ways to prevent overfitting", "List 5 ways to prevent overfitting").reason, "number_mismatch"));
t("intent: negation mismatch", () =>
  assert.equal(intentCompatible("When should I use dropout", "When should I not use dropout").reason, "negation_mismatch"));
t("intent: contraction negation caught", () =>
  assert.equal(intentCompatible("Does dropout help training", "Doesn't dropout help training").reason, "negation_mismatch"));

console.log(`\n${n} tests passed`);

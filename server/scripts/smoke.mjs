// End-to-end check of package 1. Run with the API + worker running:  npm run smoke
import fs from "fs";

const API = process.env.API ?? "http://localhost:4000/api";
const call = async (path, opts = {}, token) => {
  const res = await fetch(API + path, { ...opts, headers: { ...(opts.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body;
};
const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const step = (n, msg) => console.log(`\n[${n}] ${msg}`);

const email = `test${Date.now()}@example.com`;
step(1, "Register");
const { token } = await call("/auth/register", json("POST", { name: "Smoke Test", email, password: "password123" }));
console.log("ok, got token");

step(2, "Create collection");
const { collection } = await call("/collections", json("POST", { name: "ML Notes" }), token);
console.log(collection);

step(3, "Upload docs/sample-ml-notes.txt");
const form = new FormData();
form.append("collectionId", collection.id);
form.append("file", new Blob([fs.readFileSync(new URL("../../docs/sample-ml-notes.txt", import.meta.url))]), "sample-ml-notes.txt");
const { document: doc } = await call("/documents/upload", { method: "POST", body: form }, token);
console.log("status:", doc.status, "(processing continues in the worker)");

step(4, "Wait for ingestion");
let d = doc;
for (let i = 0; i < 40 && !["ready", "failed"].includes(d.status); i++) {
  await new Promise((r) => setTimeout(r, 1500));
  d = (await call(`/documents/${doc.id}`, {}, token)).document;
  process.stdout.write(`  ${d.status}\n`);
}
if (d.status !== "ready") throw new Error(`Ingestion ended as '${d.status}': ${d.error_message ?? "worker not running?"}`);
console.log(`ready: ${d.chunk_count} chunks`);

step(5, "Ask a question");
const a1 = await call("/chat", json("POST", { question: "What is overfitting?", collectionId: collection.id }), token);
console.log("ANSWER:", a1.answer, "\nCITATIONS:", a1.citations.map((c) => `${c.filename} p.${c.page ?? "n/a"} (${c.score})`), `\nlatency: ${a1.latencyMs}ms`);

step(6, "Follow-up question (tests reference resolution)");
const a2 = await call("/chat", json("POST", { question: "How can it be prevented?", collectionId: collection.id, conversationId: a1.conversationId }), token);
console.log("REWRITTEN AS:", a2.standaloneQuestion, "\nANSWER:", a2.answer);

step(7, "Question with no answer in the documents");
const a3 = await call("/chat", json("POST", { question: "What is the capital of Australia?", collectionId: collection.id }), token);
console.log("ANSWER:", a3.answer);

console.log("\nAll checks passed.");

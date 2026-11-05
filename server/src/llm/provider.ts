import { env } from "../config/env";
import { AppError } from "../middleware/errors";

// Plain fetch against any OpenAI-compatible API: no SDK, so you can see exactly what is sent.

async function post(path: string, body: unknown, attempt = 1): Promise<any> {
  const res = await fetch(`${env.LLM_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.LLM_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); // exponential backoff
    return post(path, body, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`LLM provider error ${res.status}: ${text.slice(0, 300)}`);
    throw new AppError(502, "The AI provider failed. Please try again.");
  }
  return res.json();
}

// Convert texts to vectors. Input order = output order.
export async function embed(texts: string[]): Promise<number[][]> {
  const data = await post("/embeddings", { model: env.EMBEDDING_MODEL, input: texts });
  const vectors: number[][] = data.data.sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  if (vectors[0]?.length !== env.EMBEDDING_DIM) {
    throw new Error(`Embedding dimension ${vectors[0]?.length} != EMBEDDING_DIM ${env.EMBEDDING_DIM}`);
  }
  return vectors;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function complete(messages: ChatMessage[], opts: { temperature?: number; maxTokens?: number } = {}) {
  const data = await post("/chat/completions", {
    model: env.LLM_MODEL,
    messages,
    temperature: opts.temperature ?? 0.1,
    max_tokens: opts.maxTokens ?? 700,
  });
  return {
    content: (data.choices?.[0]?.message?.content ?? "").trim() as string,
    promptTokens: (data.usage?.prompt_tokens ?? 0) as number,
    completionTokens: (data.usage?.completion_tokens ?? 0) as number,
  };
}

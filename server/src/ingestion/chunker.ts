// Fixed-size character chunking with overlap, preferring to cut at a paragraph/sentence boundary.
// Overlap means a sentence split across two chunks still appears whole in at least one of them.
export function chunkText(text: string, size: number, overlap: number): string[] {
  const safeOverlap = Math.min(overlap, Math.floor(size / 2));
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (cut > size * 0.5) end = start + cut + 1; // only cut early if it keeps the chunk reasonably full
    }
    const piece = text.slice(start, end).trim();
    if (piece.length > 0) chunks.push(piece);
    if (end >= text.length) break;
    start = Math.max(end - safeOverlap, start + 1); // always advance
  }
  return chunks;
}

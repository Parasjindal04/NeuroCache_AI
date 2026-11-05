// Normalize extracted text so chunking and embedding see consistent input.
export function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")            // Postgres text rejects NUL bytes
    .replace(/\r\n?/g, "\n")           // unify line endings
    .replace(/[ \t\f\v]+/g, " ")       // collapse runs of spaces/tabs
    .replace(/ ?\n ?/g, "\n")          // trim spaces around newlines
    .replace(/\n{3,}/g, "\n\n")        // at most one blank line
    .trim();
}

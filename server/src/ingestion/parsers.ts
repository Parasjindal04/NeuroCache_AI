import fs from "fs/promises";
import mammoth from "mammoth";

export interface ParsedPage {
  pageNumber: number | null; // null when the format has no page concept (DOCX, TXT)
  text: string;
}

// pdfjs-dist is an ES module and this project compiles to CommonJS, so we load it with a real
// dynamic import() (wrapped so TypeScript doesn't rewrite it into require()).
const dynamicImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;
let pdfjs: any;
async function loadPdfjs() {
  pdfjs ??= await dynamicImport("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

export async function parseFile(filePath: string, fileType: "pdf" | "docx" | "txt"): Promise<ParsedPage[]> {
  const buffer = await fs.readFile(filePath);

  if (fileType === "txt") return [{ pageNumber: null, text: buffer.toString("utf8") }];

  if (fileType === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ pageNumber: null, text: value }];
  }

  // PDF: read page by page so every chunk keeps its page number for citations.
  const { getDocument } = await loadPdfjs();
  const task = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false, // hardening: don't let a malicious PDF run eval()
  });
  const pdf = await task.promise;

  const pages: ParsedPage[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
      pages.push({ pageNumber: i, text });
      page.cleanup();
    }
  } finally {
    await task.destroy(); // free pdf.js memory/workers
  }
  return pages;
}

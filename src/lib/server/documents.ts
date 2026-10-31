import "server-only";

import mammoth from "mammoth";
import { extractText } from "unpdf";

// Seller documents (pitch decks, brochures, case studies) give the strategy and outreach steps real facts.
export const DOCUMENT_LIMITS = {
  maxFiles: 5,
  maxTotalBytes: 4 * 1024 * 1024, // stays under the Vercel 4.5 MB request body limit
  maxCharsPerFile: 12_000,
  maxTotalChars: 20_000,
};

export type SellerDocument = { name: string; text: string; truncated: boolean };

const normalize = (text: string) => text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

async function extract(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return (await extractText(bytes, { mergePages: true })).text;
  }
  if (name.endsWith(".docx")) {
    return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  }
  if (/\.(txt|md|markdown|csv)$/.test(name) || file.type.startsWith("text/")) {
    return new TextDecoder().decode(bytes);
  }
  throw new Error(`Unsupported file type: ${file.name}. Upload PDF, DOCX, TXT or MD.`);
}

// Extracts and bounds document text. Empty or unreadable files are reported, not fatal.
export async function readSellerDocuments(files: File[]): Promise<{ documents: SellerDocument[]; warnings: string[] }> {
  const usable = files.filter((f) => f.size > 0);
  if (usable.length > DOCUMENT_LIMITS.maxFiles) throw new Error(`Upload at most ${DOCUMENT_LIMITS.maxFiles} files.`);
  const totalBytes = usable.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > DOCUMENT_LIMITS.maxTotalBytes) throw new Error("Uploaded files exceed 4 MB in total.");

  const documents: SellerDocument[] = [];
  const warnings: string[] = [];
  let remaining = DOCUMENT_LIMITS.maxTotalChars;
  for (const file of usable) {
    let text: string;
    try {
      text = normalize(await extract(file));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unsupported")) throw error;
      warnings.push(`Could not read ${file.name}.`);
      continue;
    }
    if (!text) {
      warnings.push(`${file.name} contains no extractable text (scanned images are not supported).`);
      continue;
    }
    const limit = Math.min(DOCUMENT_LIMITS.maxCharsPerFile, remaining);
    if (limit <= 0) {
      warnings.push(`${file.name} skipped: document text limit reached.`);
      continue;
    }
    documents.push({ name: file.name, text: text.slice(0, limit), truncated: text.length > limit });
    remaining -= Math.min(text.length, limit);
  }
  return { documents, warnings };
}

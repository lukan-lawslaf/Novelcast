import JSZip from "jszip";
import pdf from "pdf-parse";

export function cleanText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoParagraphs(text: string) {
  return cleanText(text)
    .split(/\n\s*\n|(?<=\.)\s{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function batchParagraphs(paragraphs: string[], size = 40) {
  const batches: string[][] = [];
  for (let index = 0; index < paragraphs.length; index += size) {
    batches.push(paragraphs.slice(index, index + size));
  }
  return batches;
}

export async function extractTextFromBuffer(fileName: string, buffer: Buffer) {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".txt")) {
    return cleanText(buffer.toString("utf8"));
  }
  if (lowerName.endsWith(".pdf")) {
    const result = await pdf(buffer);
    return cleanText(result.text);
  }
  if (lowerName.endsWith(".epub")) {
    return extractEpubText(buffer);
  }
  throw new Error("NovelCast accepts TXT, PDF, and EPUB files.");
}

async function extractEpubText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const htmlFiles = Object.values(zip.files)
    .filter((file) => !file.dir && /\.(xhtml|html|htm)$/i.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const chunks: string[] = [];
  for (const file of htmlFiles) {
    const html = await file.async("string");
    chunks.push(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
  }
  return cleanText(chunks.join("\n\n"));
}

import { NextRequest, NextResponse } from "next/server";
import { extractTextFromBuffer, splitIntoParagraphs } from "@/lib/parser";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a TXT, PDF, or EPUB file." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromBuffer(file.name, buffer);
    const paragraphs = splitIntoParagraphs(text);
    if (paragraphs.length === 0) {
      return NextResponse.json({ error: "No readable paragraphs were found in the file." }, { status: 400 });
    }
    return NextResponse.json({ paragraphs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "File extraction failed." }, { status: 500 });
  }
}

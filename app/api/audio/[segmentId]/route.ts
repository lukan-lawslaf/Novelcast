import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { audioDir } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { segmentId: string } }) {
  const segmentId = params.segmentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  try {
    const audio = await readFile(path.join(audioDir, `${segmentId}.mp3`));
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Audio chunk was not found." }, { status: 404 });
  }
}

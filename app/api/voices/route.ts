import { NextResponse } from "next/server";
import { fetchElevenLabsVoices } from "@/lib/elevenlabs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const voices = await fetchElevenLabsVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Voice lookup failed." }, { status: 500 });
  }
}

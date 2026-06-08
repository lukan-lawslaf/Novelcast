import { NextRequest, NextResponse } from "next/server";
import { parseWithGroq, mergeCharacters } from "@/lib/groq";
import { createSessionId, readSession, writeSession } from "@/lib/session";
import type { NovelCharacter, NovelSegment, ParsedSession } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      paragraphs?: string[];
      existingCharacters?: string[];
      sessionId?: string;
      batchOffset?: number;
    };
    const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs.filter((p) => typeof p === "string" && p.trim()) : [];
    if (paragraphs.length === 0) {
      return NextResponse.json({ error: "No paragraphs were supplied." }, { status: 400 });
    }

    const parsed = await parseWithGroq(paragraphs, body.existingCharacters || []);
    const withParagraphs = parsed.segments
      .filter((segment) => segment.text)
      .map((segment, index) => ({
        ...segment,
        id: stableSegmentId(segment, body.batchOffset || 0, index),
        paragraphIndex: (body.batchOffset || 0) + paragraphForSegment(segment, paragraphs)
      }));

    const prior = body.sessionId ? await readSession(body.sessionId).catch(() => null) : null;
    const sessionId = prior?.sessionId || body.sessionId || createSessionId();
    const existingCharacterObjects = prior?.characters || namesToCharacters(body.existingCharacters || []);
    const characters = mergeCharacters(existingCharacterObjects, parsed.characters);
    const session: ParsedSession = {
      sessionId,
      segments: [...(prior?.segments || []), ...withParagraphs],
      characters,
      voiceAssignments: prior?.voiceAssignments || {},
      audioUrls: prior?.audioUrls || [],
      createdAt: prior?.createdAt || new Date().toISOString()
    };
    await writeSession(session);
    return NextResponse.json({
      sessionId,
      segments: withParagraphs,
      characters,
      totalSegments: session.segments.length
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Parsing failed." }, { status: 500 });
  }
}

function stableSegmentId(segment: NovelSegment, offset: number, index: number) {
  const safe = segment.id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return `${offset}_${index}_${safe || "segment"}`;
}

function paragraphForSegment(segment: NovelSegment, paragraphs: string[]) {
  const text = segment.text.slice(0, 60).toLowerCase();
  const found = paragraphs.findIndex((paragraph) => paragraph.toLowerCase().includes(text));
  return found >= 0 ? found : 0;
}

function namesToCharacters(names: string[]): NovelCharacter[] {
  return names.map((name) => ({
    name,
    description: "A previously identified character voice.",
    gender: "neutral"
  }));
}

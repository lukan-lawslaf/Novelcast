import { writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { synthesizeSpeech } from "@/lib/elevenlabs";
import { audioDir, ensureTmpDirs, readSession, writeSession } from "@/lib/session";
import type { SegmentEmotion } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const emotions = new Set(["calm", "tense", "angry", "sad", "joyful", "fearful", "neutral"]);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      text?: string;
      voiceId?: string;
      emotion?: SegmentEmotion;
      segmentId?: string;
      sessionId?: string;
    };
    if (!body.text || !body.voiceId) {
      return NextResponse.json({ error: "Text and voiceId are required." }, { status: 400 });
    }
    const emotion = emotions.has(body.emotion || "") ? body.emotion! : "neutral";
    const segmentId = (body.segmentId || `segment_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const audio = await retryTts(body.text, body.voiceId, emotion);
    await ensureTmpDirs();
    const filePath = path.join(audioDir, `${segmentId}.mp3`);
    await writeFile(filePath, audio);
    const audioUrl = `/api/audio/${segmentId}`;

    if (body.sessionId) {
      const session = await readSession(body.sessionId).catch(() => null);
      if (session && !session.audioUrls.includes(audioUrl)) {
        await writeSession({ ...session, audioUrls: [...session.audioUrls, audioUrl] });
      }
    }

    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Audio-Url": audioUrl
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "TTS failed." }, { status: 500 });
  }
}

async function retryTts(text: string, voiceId: string, emotion: SegmentEmotion) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await synthesizeSpeech(text, voiceId, emotion);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("429") || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

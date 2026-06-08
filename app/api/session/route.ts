import { NextRequest, NextResponse } from "next/server";
import { readLatestSession, readSession, writeSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const session = sessionId ? await readSession(sessionId) : await readLatestSession();
    return NextResponse.json(session);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Session not found." }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }
    const session = await readSession(body.sessionId);
    const updated = {
      ...session,
      voiceAssignments: body.voiceAssignments || session.voiceAssignments,
      audioUrls: body.audioUrls || session.audioUrls
    };
    await writeSession(updated);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Session update failed." }, { status: 500 });
  }
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { colorForCharacter } from "@/lib/characterColors";
import { stitchAudioBuffers } from "@/lib/audioStitcher";
import { useNovelCastStore } from "@/lib/store";
import type { ParsedSession } from "@/lib/types";

export default function GeneratePage() {
  const router = useRouter();
  const state = useNovelCastStore();
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState(0);
  const [stitchProgress, setStitchProgress] = useState(0);
  const names = useMemo(() => state.characters.map((character) => character.name), [state.characters]);

  useEffect(() => {
    async function hydrate() {
      if (state.sessionId) return;
      const response = await fetch("/api/session");
      if (response.ok) {
        const session = (await response.json()) as ParsedSession;
        state.setParsedSession(session);
        state.setVoiceAssignments(session.voiceAssignments || {});
        state.setAudioUrls(session.audioUrls || []);
      }
    }
    void hydrate();
  }, [state]);

  async function generate() {
    if (running) return;
    const missing = state.characters.filter((character) => !state.voiceAssignments[character.name]);
    if (missing.length) {
      state.toast("Return to Cast and assign every character a voice.", "error");
      return;
    }
    setRunning(true);
    const urls: string[] = [];
    for (let index = 0; index < state.segments.length; index += 1) {
      setCurrent(index);
      const segment = state.segments[index];
      const voiceId = state.voiceAssignments[segment.speaker] || state.voiceAssignments.Narrator;
      if (!voiceId) {
        state.toast(`Skipped ${segment.speaker}: no assigned voice.`, "error");
        continue;
      }
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.sessionId,
            segmentId: segment.id,
            text: segment.text,
            voiceId,
            emotion: segment.emotion
          })
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "TTS failed.");
        }
        urls.push(response.headers.get("X-Audio-Url") || `/api/audio/${segment.id}`);
      } catch (error) {
        state.toast(`Skipped segment ${index + 1}: ${error instanceof Error ? error.message : "TTS failed."}`, "error");
      }
    }
    state.setAudioUrls(urls);
    await fetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, audioUrls: urls })
    }).catch(() => undefined);

    if (urls.length === 0) {
      state.toast("No audio chunks were generated.", "error");
      setRunning(false);
      return;
    }

    const usableSegments = state.segments.filter((segment) => urls.some((url) => url.endsWith(segment.id)));
    const stitched = await stitchAudioBuffers(urls, usableSegments.length ? usableSegments : state.segments, setStitchProgress);
    state.setStitchedAudioUrl(URL.createObjectURL(stitched.blob));
    state.setSegmentTimings(stitched.timings);
    state.toast("Audiobook generated.", "success");
    router.push("/player");
  }

  const segment = state.segments[current];
  const color = segment ? colorForCharacter(segment.speaker, names) : colorForCharacter("Narrator", names);
  const progress = state.segments.length ? Math.round((current / state.segments.length) * 100) : 0;

  return (
    <Shell>
      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-5xl flex-col justify-center px-5 py-12">
        <div className="mb-8">
          <p className="mb-2 text-sm uppercase tracking-[0.24em] text-accent">Generate</p>
          <h1 className="font-novel text-4xl">Render the cast, one line at a time.</h1>
        </div>
        <div className="rounded-md border border-paper/20 bg-paper/[0.03] p-8">
          <div className="mb-7 flex items-center gap-4">
            <span className="h-4 w-4 rounded-full" style={{ background: color.dot }} />
            <div>
              <p className="text-sm text-paper/60">Currently voicing</p>
              <p className="font-novel text-3xl">{segment?.speaker || "Ready"}</p>
            </div>
          </div>
          <p className="min-h-20 font-novel text-xl leading-8 text-paper/80">{segment?.text || "Start generation when your cast is ready."}</p>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-paper/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${running ? progress : stitchProgress * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-paper/55">
            {running
              ? stitchProgress > 0
                ? `Stitching audiobook... ${Math.round(stitchProgress * 100)}%`
                : `Generating voice for ${segment?.speaker || "Narrator"}... segment ${Math.min(current + 1, state.segments.length)}/${state.segments.length}`
              : `${state.segments.length} parsed segments ready.`}
          </p>
          <button
            onClick={() => void generate()}
            disabled={running || state.segments.length === 0}
            className="mt-7 rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Audiobook
          </button>
        </div>
      </section>
    </Shell>
  );
}

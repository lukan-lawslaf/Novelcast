"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { colorForCharacter, initialsForName } from "@/lib/characterColors";
import { stitchAudioBuffers } from "@/lib/audioStitcher";
import { useNovelCastStore } from "@/lib/store";
import type { ParsedSession } from "@/lib/types";

export default function PlayerPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const state = useNovelCastStore();
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const names = useMemo(() => state.characters.map((character) => character.name), [state.characters]);
  const active = state.segments[state.activeSegmentIndex] || state.segments[0];
  const color = active ? colorForCharacter(active.speaker, names) : colorForCharacter("Narrator", names);

  useEffect(() => {
    async function hydrate() {
      if (state.segments.length) return;
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

  useEffect(() => {
    async function rebuild() {
      if (state.stitchedAudioUrl || state.audioUrls.length === 0 || state.segments.length === 0) return;
      const result = await stitchAudioBuffers(state.audioUrls, state.segments);
      state.setStitchedAudioUrl(URL.createObjectURL(result.blob));
      state.setSegmentTimings(result.timings);
    }
    void rebuild();
  }, [state]);

  useEffect(() => {
    const index = state.segmentTimings.findIndex((timing) => time >= timing.start && time <= timing.end);
    if (index >= 0 && index !== state.activeSegmentIndex) state.setActiveSegmentIndex(index);
  }, [time, state]);

  function seek(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  return (
    <Shell>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[360px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="rounded-md border border-paper/20 bg-paper/[0.03] p-6">
            <div className="mb-6 flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full text-lg font-bold text-ink" style={{ background: color.dot }}>
                {initialsForName(active?.speaker || "Narrator")}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${playing ? "animate-pulse" : ""}`} style={{ background: color.dot }} />
                  <p className="text-sm text-paper/60">Speaking now</p>
                </div>
                <h1 className="font-novel text-3xl">{active?.speaker || "NovelCast"}</h1>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={state.stitchedAudioUrl}
              onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
              onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
              onEnded={() => setPlaying(false)}
            />

            <div className="mb-5">
              <div className="relative h-2 overflow-hidden rounded-full bg-paper/10">
                <div className="h-full bg-accent" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
                {state.segmentTimings.filter((_, index) => index % 20 === 0).map((timing) => (
                  <span
                    key={timing.start}
                    className="absolute top-0 h-2 w-px bg-paper/50"
                    style={{ left: `${duration ? (timing.start / duration) * 100 : 0}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-xs text-paper/50">
                <span>{formatTime(time)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => seek(-15)} className="rounded-md border border-paper/20 py-3 text-sm">
                -15s
              </button>
              <button onClick={toggle} className="rounded-md bg-accent py-3 text-sm font-semibold text-white">
                {playing ? "Pause" : "Play"}
              </button>
              <button onClick={() => seek(15)} className="rounded-md border border-paper/20 py-3 text-sm">
                +15s
              </button>
            </div>
            <div className="mt-3 flex gap-3">
              <select
                onChange={(event) => {
                  if (audioRef.current) audioRef.current.playbackRate = Number(event.target.value);
                }}
                className="flex-1 rounded-md border border-paper/20 bg-ink px-3 py-3 text-sm"
                defaultValue="1"
              >
                <option value="0.75">0.75x</option>
                <option value="1">1x</option>
                <option value="1.25">1.25x</option>
                <option value="1.5">1.5x</option>
              </select>
              <a
                href={state.stitchedAudioUrl || undefined}
                download="novelcast-audiobook.mp3"
                className="rounded-md border border-paper/20 px-4 py-3 text-sm"
              >
                Download
              </a>
            </div>
          </div>
        </aside>

        <div className="thin-scrollbar max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          {state.segments.map((segment, index) => {
            const isActive = index === state.activeSegmentIndex;
            const lineColor = colorForCharacter(segment.speaker, names);
            return (
              <article
                key={segment.id}
                className={`mb-3 rounded-md border p-4 transition ${
                  isActive ? "border-accent bg-accent/10" : index < state.activeSegmentIndex ? "border-paper/10 opacity-45" : "border-paper/15"
                }`}
              >
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: lineColor.dot }} />
                  <span className="text-paper/70">{segment.speaker}</span>
                  <span className="text-paper/35">{segment.emotion}</span>
                </div>
                <p className={`font-novel text-lg leading-8 ${segment.type === "dialogue" ? "italic" : ""}`}>{segment.text}</p>
              </article>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

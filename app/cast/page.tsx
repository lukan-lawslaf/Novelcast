"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { colorForCharacter, initialsForName } from "@/lib/characterColors";
import { useNovelCastStore } from "@/lib/store";
import type { NovelCharacter, Voice, VoiceAssignment } from "@/lib/types";

export default function CastPage() {
  const router = useRouter();
  const sessionId = useNovelCastStore((state) => state.sessionId);
  const characters = useNovelCastStore((state) => state.characters);
  const assignments = useNovelCastStore((state) => state.voiceAssignments);
  const setParsedSession = useNovelCastStore((state) => state.setParsedSession);
  const setVoiceAssignments = useNovelCastStore((state) => state.setVoiceAssignments);
  const setVoiceAssignment = useNovelCastStore((state) => state.setVoiceAssignment);
  const toast = useNovelCastStore((state) => state.toast);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const names = useMemo(() => characters.map((character) => character.name), [characters]);

  useEffect(() => {
    async function hydrate() {
      if (!sessionId) {
        const response = await fetch("/api/session");
        if (response.ok) {
          const session = await response.json();
          setParsedSession(session);
          setVoiceAssignments(session.voiceAssignments || {});
        }
      }
    }
    void hydrate();
  }, [sessionId, setParsedSession, setVoiceAssignments]);

  useEffect(() => {
    async function loadVoices() {
      setLoading(true);
      setVoiceError("");
      try {
        const response = await fetch("/api/voices");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Voice lookup failed.");
        setVoices(Array.isArray(data.voices) ? data.voices : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load ElevenLabs voices.";
        setVoiceError(message);
        toast(message, "error");
      } finally {
        setLoading(false);
      }
    }
    void loadVoices();
  }, [toast]);

  useEffect(() => {
    if (voices.length === 0 || characters.length === 0) return;
    
    let hasChanges = false;
    const next: VoiceAssignment = { ...assignments };
    
    characters.forEach((character) => {
      if (!next[character.name]) {
        next[character.name] = suggestVoice(character, voices);
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setVoiceAssignments(next);
    }
  }, [voices, characters, assignments, setVoiceAssignments]);

  async function preview(character: NovelCharacter) {
    const voiceId = assignments[character.name];
    if (!voiceId) {
      toast("Choose a voice before previewing.", "error");
      return;
    }
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${character.name}. ${character.description}`.slice(0, 220),
          voiceId,
          emotion: "calm",
          segmentId: `preview_${character.name}`
        })
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Preview failed.");
      }
      const blob = await response.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.currentTime = 0;
      void audio.play();
      window.setTimeout(() => {
        audio.pause();
        URL.revokeObjectURL(audio.src);
      }, 2000);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Preview failed.", "error");
    }
  }

  async function continueToGenerate() {
    const missing = characters.filter((character) => !assignments[character.name]);
    if (missing.length) {
      toast("Assign a voice to every character before generating.", "error");
      return;
    }
    if (sessionId) {
      await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, voiceAssignments: assignments })
      });
    }
    router.push("/generate");
  }

  return (
    <Shell>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-sm uppercase tracking-[0.24em] text-accent">Cast</p>
            <h1 className="font-novel text-4xl">Choose a voice for every role.</h1>
          </div>
          <button onClick={continueToGenerate} className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white">
            Generate Audiobook
          </button>
        </div>

        {voiceError ? (
          <div className="mb-5 rounded-md border border-red-400/40 bg-red-950/50 p-4 text-sm leading-6 text-red-100">
            {voiceError}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {characters.map((character) => {
            const color = colorForCharacter(character.name, names);
            return (
              <article key={character.name} className="rounded-md border p-5" style={{ borderColor: color.border, background: color.bg }}>
                <div className="mb-4 flex items-center gap-4">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-full font-semibold text-ink"
                    style={{ background: color.dot }}
                  >
                    {initialsForName(character.name)}
                  </div>
                  <div>
                    <h2 className="font-novel text-2xl">{character.name}</h2>
                    <p className="text-sm capitalize text-paper/60">{character.gender}</p>
                  </div>
                </div>
                <p className="min-h-16 text-sm leading-6 text-paper/75">{character.description}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <select
                    value={assignments[character.name] || ""}
                    onChange={(event) => setVoiceAssignment(character.name, event.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-paper/20 bg-ink px-3 py-3 text-sm text-paper"
                    disabled={loading}
                  >
                    <option value="">
                      {loading ? "Loading voices..." : voiceError ? "Voice list unavailable" : "Select voice"}
                    </option>
                    {voices.map((voice) => (
                      <option key={voice.voice_id} value={voice.voice_id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => void preview(character)} className="rounded-md border border-paper/20 px-4 py-3 text-sm">
                    Preview Voice
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </Shell>
  );
}

function suggestVoice(character: NovelCharacter, voices: Voice[]) {
  const words = `${character.gender} ${character.description}`.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 4);
  const scored = voices.map((voice) => {
    const haystack = `${voice.name} ${voice.category || ""} ${Object.values(voice.labels || {}).join(" ")}`.toLowerCase();
    return { voice, score: words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice.voice_id || voices[0]?.voice_id || "";
}

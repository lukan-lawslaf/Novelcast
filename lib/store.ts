"use client";

import { create } from "zustand";
import type { NovelCharacter, NovelSegment, ParsedSession, VoiceAssignment } from "./types";

type Toast = { id: string; message: string; tone: "error" | "info" | "success" };

type NovelCastState = {
  sessionId: string;
  segments: NovelSegment[];
  characters: NovelCharacter[];
  voiceAssignments: VoiceAssignment;
  audioUrls: string[];
  stitchedAudioUrl: string;
  segmentTimings: { start: number; end: number }[];
  activeSegmentIndex: number;
  toasts: Toast[];
  setParsedSession: (session: Pick<ParsedSession, "sessionId" | "segments" | "characters">) => void;
  setVoiceAssignment: (character: string, voiceId: string) => void;
  setVoiceAssignments: (assignments: VoiceAssignment) => void;
  setAudioUrls: (urls: string[]) => void;
  setStitchedAudioUrl: (url: string) => void;
  setSegmentTimings: (timings: { start: number; end: number }[]) => void;
  setActiveSegmentIndex: (index: number) => void;
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: string) => void;
};

export const useNovelCastStore = create<NovelCastState>((set) => ({
  sessionId: "",
  segments: [],
  characters: [],
  voiceAssignments: {},
  audioUrls: [],
  stitchedAudioUrl: "",
  segmentTimings: [],
  activeSegmentIndex: 0,
  toasts: [],
  setParsedSession: (session) =>
    set({
      sessionId: session.sessionId,
      segments: session.segments,
      characters: session.characters,
      audioUrls: [],
      stitchedAudioUrl: "",
      segmentTimings: []
    }),
  setVoiceAssignment: (character, voiceId) =>
    set((state) => ({ voiceAssignments: { ...state.voiceAssignments, [character]: voiceId } })),
  setVoiceAssignments: (assignments) => set({ voiceAssignments: assignments }),
  setAudioUrls: (urls) => set({ audioUrls: urls }),
  setStitchedAudioUrl: (url) => set({ stitchedAudioUrl: url }),
  setSegmentTimings: (timings) => set({ segmentTimings: timings }),
  setActiveSegmentIndex: (index) => set({ activeSegmentIndex: index }),
  toast: (message, tone = "info") =>
    set((state) => ({ toasts: [...state.toasts, { id: crypto.randomUUID(), message, tone }] })),
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
}));

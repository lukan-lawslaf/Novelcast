export type SegmentEmotion = "calm" | "tense" | "angry" | "sad" | "joyful" | "fearful" | "neutral";

export type SegmentType = "narration" | "dialogue";

export type CharacterGender = "male" | "female" | "neutral";

export type NovelSegment = {
  id: string;
  type: SegmentType;
  speaker: string;
  text: string;
  emotion: SegmentEmotion;
  paragraphIndex?: number;
  audioUrl?: string;
  failed?: boolean;
};

export type NovelCharacter = {
  name: string;
  description: string;
  gender: CharacterGender;
};

export type Voice = {
  voice_id: string;
  name: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string | null;
};

export type VoiceAssignment = Record<string, string>;

export type ParsedSession = {
  sessionId: string;
  segments: NovelSegment[];
  characters: NovelCharacter[];
  voiceAssignments: VoiceAssignment;
  audioUrls: string[];
  createdAt: string;
};

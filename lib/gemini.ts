import { GoogleGenerativeAI } from "@google/generative-ai";
import type { NovelCharacter, NovelSegment } from "./types";

const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";

export const literaryParserSystemPrompt = `You are a literary parser. Given paragraphs from a novel, return ONLY valid JSON (no markdown, no backticks) in this exact shape:
{
  "segments": [
    {
      "id": "unique_string",
      "type": "narration" | "dialogue",
      "speaker": "CharacterName" | "Narrator",
      "text": "the actual text",
      "emotion": "calm" | "tense" | "angry" | "sad" | "joyful" | "fearful" | "neutral"
    }
  ],
  "characters": [
    {
      "name": "CharacterName",
      "description": "Brief personality and voice description (age, tone, accent hints)",
      "gender": "male" | "female" | "neutral"
    }
  ]
}`;

export function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenerativeAI(key).getGenerativeModel({
    model: modelName,
    systemInstruction: literaryParserSystemPrompt
  });
}

export function stripJsonFences(value: string) {
  const trimmed = value.trim();
  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function parseGeminiJson(raw: string): { segments: NovelSegment[]; characters: NovelCharacter[] } {
  const parsed = JSON.parse(stripJsonFences(raw));
  if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.characters)) {
    throw new Error("Gemini response did not include segments and characters arrays.");
  }
  return {
    segments: parsed.segments.map(normalizeSegment),
    characters: parsed.characters.map(normalizeCharacter)
  };
}

function normalizeSegment(segment: Partial<NovelSegment>, index: number): NovelSegment {
  const speaker = typeof segment.speaker === "string" && segment.speaker.trim() ? segment.speaker.trim() : "Narrator";
  return {
    id: typeof segment.id === "string" && segment.id.trim() ? segment.id.trim() : `segment_${Date.now()}_${index}`,
    type: segment.type === "dialogue" ? "dialogue" : "narration",
    speaker,
    text: typeof segment.text === "string" ? segment.text.trim() : "",
    emotion: ["calm", "tense", "angry", "sad", "joyful", "fearful", "neutral"].includes(segment.emotion || "")
      ? segment.emotion!
      : "neutral"
  };
}

function normalizeCharacter(character: Partial<NovelCharacter>): NovelCharacter {
  const name = typeof character.name === "string" && character.name.trim() ? character.name.trim() : "Unknown";
  const gender = character.gender === "male" || character.gender === "female" ? character.gender : "neutral";
  return {
    name,
    description:
      typeof character.description === "string" && character.description.trim()
        ? character.description.trim()
        : "A distinct literary voice with measured pacing.",
    gender
  };
}

export function mergeCharacters(existing: NovelCharacter[], incoming: NovelCharacter[]) {
  const byName = new Map<string, NovelCharacter>();
  [...existing, ...incoming].forEach((character) => {
    const key = character.name.toLowerCase();
    const prior = byName.get(key);
    byName.set(key, {
      name: prior?.name || character.name,
      description: character.description || prior?.description || "",
      gender: character.gender || prior?.gender || "neutral"
    });
  });
  if (![...byName.keys()].includes("narrator")) {
    byName.set("narrator", {
      name: "Narrator",
      description: "A clear, steady narrative voice with warm literary pacing.",
      gender: "neutral"
    });
  }
  return [...byName.values()];
}

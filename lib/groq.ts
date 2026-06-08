import type { NovelCharacter, NovelSegment } from "./types";

const modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export const literaryParserSystemPrompt = `You are a literary parser. Given paragraphs from a novel, return ONLY valid JSON (no markdown, no backticks, no prose) in this exact shape:
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

export function stripJsonFences(value: string) {
  const trimmed = value.trim();
  return trimmed
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function parseGroqJson(raw: string): { segments: NovelSegment[]; characters: NovelCharacter[] } {
  const parsed = JSON.parse(stripJsonFences(raw));
  if (!Array.isArray(parsed.segments) || !Array.isArray(parsed.characters)) {
    throw new Error("Groq response did not include segments and characters arrays.");
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

export async function parseWithGroq(paragraphs: string[], existingCharacters: string[]): Promise<{ segments: NovelSegment[]; characters: NovelCharacter[] }> {
  const apiKey = process.env.Groq_api || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Groq API key (Groq_api) is not configured in environment variables.");
  }

  const prompt = `USER: Here are the paragraphs: ${JSON.stringify(paragraphs)}
Existing characters already identified: ${JSON.stringify(existingCharacters)}
Maintain consistency with existing character names.`;

  const makeRequest = async (retryMessage?: string) => {
    const messages = [
      { role: "system", content: literaryParserSystemPrompt },
      { role: "user", content: prompt }
    ];
    if (retryMessage) {
      messages.push({ role: "assistant", content: retryMessage });
      messages.push({ role: "user", content: "Your previous response was malformed. Return a single JSON object only. Do not include markdown, backticks, prose, or trailing commas." });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Groq API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq response choice message content is empty.");
    }
    return content;
  };

  let responseText = await makeRequest();
  try {
    return parseGroqJson(responseText);
  } catch (err) {
    console.warn("Groq first attempt failed to parse JSON, retrying...", err);
    responseText = await makeRequest(responseText);
    return parseGroqJson(responseText);
  }
}

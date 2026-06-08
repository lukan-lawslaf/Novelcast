import type { SegmentEmotion, Voice, NovelCharacter } from "./types";

const stability: Record<SegmentEmotion, number> = {
  calm: 0.8,
  tense: 0.4,
  angry: 0.2,
  sad: 0.6,
  joyful: 0.5,
  fearful: 0.35,
  neutral: 0.75
};

const style: Record<SegmentEmotion, number> = {
  calm: 0.1,
  tense: 0.6,
  angry: 0.9,
  sad: 0.4,
  joyful: 0.7,
  fearful: 0.7,
  neutral: 0.2
};

const fallbackVoices: Voice[] = [
  { voice_id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "default", labels: { gender: "female" } },
  { voice_id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "default", labels: { gender: "female" } },
  { voice_id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "default", labels: { gender: "female" } },
  { voice_id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "default", labels: { gender: "male" } },
  { voice_id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "default", labels: { gender: "female" } },
  { voice_id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "default", labels: { gender: "male" } },
  { voice_id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "default", labels: { gender: "male" } },
  { voice_id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "default", labels: { gender: "male" } },
  { voice_id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "default", labels: { gender: "male" } }
];

export function emotionVoiceSettings(emotion: SegmentEmotion) {
  return {
    stability: stability[emotion] ?? stability.neutral,
    similarity_boost: 0.75,
    style: style[emotion] ?? style.neutral,
    use_speaker_boost: true
  };
}

export async function fetchElevenLabsVoices(): Promise<Voice[]> {
  try {
    const response = await fetch("http://localhost:8880/voices");
    if (!response.ok) {
      throw new Error(`Local TTS voice list failed with ${response.status}.`);
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Could not connect to local Kokoro server, using fallback voices.", error);
    return fallbackVoices;
  }
}

export function suggestVoice(character: NovelCharacter, voices: Voice[]) {
  if (voices.length === 0) return "";
  const haystackFor = (voice: Voice) =>
    `${voice.name} ${voice.category || ""} ${Object.values(voice.labels || {}).join(" ")}`.toLowerCase();
  const genderMatches = voices.filter((voice) => haystackFor(voice).includes(character.gender));
  const descriptionWords = character.description.toLowerCase().split(/[^a-z]+/).filter((word) => word.length > 4);
  const scored = (genderMatches.length ? genderMatches : voices).map((voice) => {
    const haystack = haystackFor(voice);
    const score = descriptionWords.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    return { voice, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.voice.voice_id || voices[0].voice_id;
}

export async function synthesizeSpeech(text: string, voiceId: string, emotion: SegmentEmotion) {
  const response = await fetch("http://localhost:8880/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      voiceId
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Local Kokoro TTS failed with ${response.status}. ${detail}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

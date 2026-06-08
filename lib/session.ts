import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import path from "path";
import type { ParsedSession } from "./types";

export const tmpDir = path.join(process.cwd(), "tmp");
export const audioDir = path.join(tmpDir, "audio");

export async function ensureTmpDirs() {
  await mkdir(audioDir, { recursive: true });
}

export function createSessionId() {
  return `session_${Date.now()}`;
}

export function sessionPath(sessionId: string) {
  return path.join(tmpDir, `${sessionId}.json`);
}

export async function writeSession(session: ParsedSession) {
  await ensureTmpDirs();
  await writeFile(sessionPath(session.sessionId), JSON.stringify(session, null, 2), "utf8");
}

export async function readSession(sessionId: string) {
  const raw = await readFile(sessionPath(sessionId), "utf8");
  return JSON.parse(raw) as ParsedSession;
}

export async function readLatestSession() {
  await ensureTmpDirs();
  const files = (await readdir(tmpDir)).filter((file) => /^session_\d+\.json$/.test(file)).sort();
  if (files.length === 0) {
    throw new Error("No parsed NovelCast session was found.");
  }
  const raw = await readFile(path.join(tmpDir, files[files.length - 1]), "utf8");
  return JSON.parse(raw) as ParsedSession;
}

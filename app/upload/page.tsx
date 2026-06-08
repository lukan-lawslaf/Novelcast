"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useNovelCastStore } from "@/lib/store";
import type { NovelCharacter, NovelSegment } from "@/lib/types";

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const setParsedSession = useNovelCastStore((state) => state.setParsedSession);
  const toast = useNovelCastStore((state) => state.toast);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Drop a novel file to begin.");

  async function handleFile(file?: File) {
    if (!file || busy) return;
    if (!/\.(txt|pdf|epub)$/i.test(file.name)) {
      toast("NovelCast accepts .txt, .pdf, and .epub files.", "error");
      return;
    }
    setBusy(true);
    setProgress(4);
    setStatus("Extracting paragraphs...");
    try {
      const form = new FormData();
      form.append("file", file);
      const extraction = await fetch("/api/extract", { method: "POST", body: form });
      const extracted = await extraction.json();
      if (!extraction.ok) throw new Error(extracted.error || "Extraction failed.");
      const paragraphs = extracted.paragraphs as string[];
      const batches = batch(paragraphs, 40);
      const segments: NovelSegment[] = [];
      let characters: NovelCharacter[] = [];
      let sessionId = "";

      for (let index = 0; index < batches.length; index += 1) {
        setStatus(`Parsing batch ${index + 1}/${batches.length}...`);
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paragraphs: batches[index],
            existingCharacters: characters.map((character) => character.name),
            sessionId,
            batchOffset: index * 40
          })
        });
        const parsed = await response.json();
        if (!response.ok) throw new Error(parsed.error || "Parsing failed.");
        sessionId = parsed.sessionId;
        segments.push(...parsed.segments);
        characters = parsed.characters;
        setProgress(Math.round(((index + 1) / batches.length) * 100));
      }

      setParsedSession({ sessionId, segments, characters });
      toast("Novel parsed. Time to cast the voices.", "success");
      router.push("/cast");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Upload failed.", "error");
      setStatus("Upload failed. Try another file or check your API keys.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-5xl flex-col justify-center px-5 py-12">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-accent">NovelCast</p>
          <h1 className="font-novel text-5xl leading-tight md:text-7xl">Cast your novel as a living audiobook.</h1>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFile(event.dataTransfer.files[0]);
          }}
          className={`rounded-md border border-dashed p-10 transition ${
            dragging ? "border-accent bg-accent/10" : "border-paper/25 bg-paper/[0.03]"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.pdf,.epub"
            className="hidden"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-novel text-2xl">TXT, PDF, or EPUB</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-paper/65">{status}</p>
            </div>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Choose File
            </button>
          </div>
          <div className="mt-8 h-2 overflow-hidden rounded-full bg-paper/10">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>
    </Shell>
  );
}

function batch<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

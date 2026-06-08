import type { NovelSegment } from "./types";

export async function stitchAudioBuffers(
  urls: string[],
  segments: NovelSegment[],
  onProgress?: (progress: number) => void
) {
  const context = new AudioContext();
  const decoded: AudioBuffer[] = [];
  for (let index = 0; index < urls.length; index += 1) {
    const response = await fetch(urls[index]);
    const arrayBuffer = await response.arrayBuffer();
    decoded.push(await context.decodeAudioData(arrayBuffer));
    onProgress?.((index + 1) / urls.length);
  }

  const sampleRate = context.sampleRate;
  const channels = Math.max(1, ...decoded.map((buffer) => buffer.numberOfChannels));
  const totalLength = decoded.reduce((total, buffer, index) => {
    const gapSeconds = gapAfter(segments[index], segments[index + 1]);
    return total + buffer.length + Math.floor(gapSeconds * sampleRate);
  }, 0);

  const output = context.createBuffer(channels, totalLength, sampleRate);
  let cursor = 0;
  const timings: { start: number; end: number }[] = [];
  decoded.forEach((buffer, index) => {
    const start = cursor / sampleRate;
    for (let channel = 0; channel < channels; channel += 1) {
      const source = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
      output.getChannelData(channel).set(source, cursor);
    }
    timings.push({ start, end: (cursor + buffer.length) / sampleRate });
    cursor += buffer.length + Math.floor(gapAfter(segments[index], segments[index + 1]) * sampleRate);
  });

  const mp3 = await audioBufferToMp3(output);
  return { blob: new Blob([mp3], { type: "audio/mpeg" }), timings };
}

function gapAfter(current?: NovelSegment, next?: NovelSegment) {
  if (!current || !next) return 0;
  if ((current.paragraphIndex ?? 0) !== (next.paragraphIndex ?? 0)) return 0.8;
  return 0.3;
}

async function audioBufferToMp3(buffer: AudioBuffer) {
  const lame = await import("@breezystack/lamejs");
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new lame.Mp3Encoder(channels, buffer.sampleRate, 128);
  const left = floatTo16Bit(buffer.getChannelData(0));
  const right = channels > 1 ? floatTo16Bit(buffer.getChannelData(1)) : left;
  const chunks: ArrayBuffer[] = [];
  const blockSize = 1152;
  for (let index = 0; index < left.length; index += blockSize) {
    const leftChunk = left.subarray(index, index + blockSize);
    const rightChunk = right.subarray(index, index + blockSize);
    const encoded = channels > 1 ? encoder.encodeBuffer(leftChunk, rightChunk) : encoder.encodeBuffer(leftChunk);
    if (encoded.length) chunks.push(copyToArrayBuffer(encoded));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(copyToArrayBuffer(end));
  return new Blob(chunks, { type: "audio/mpeg" }).arrayBuffer();
}

function copyToArrayBuffer(chunk: Int8Array | Uint8Array) {
  const copy = new Uint8Array(chunk.length);
  copy.set(chunk as any);
  return copy.buffer;
}

function floatTo16Bit(samples: Float32Array) {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

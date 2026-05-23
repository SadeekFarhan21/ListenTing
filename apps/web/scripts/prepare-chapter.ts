/**
 * Offline pipeline: turns Chapter 1 of 孙子兵法 into a synced audiobook.
 *
 *   1. Slices the original (not the translation) of chapter 1 out of the corpus.
 *   2. Sentence-splits on Chinese terminal punctuation.
 *   3. Calls Claude once for pinyin + English gloss per sentence AND idiom flags.
 *   4. Calls ElevenLabs convertWithTimestamps for the whole chapter in one call.
 *   5. Maps the per-character alignment back to sentence start/end seconds.
 *   6. Writes public/audiobook/ch1.mp3 and public/audiobook/ch1.json.
 *
 * Re-runnable. Skips TTS if cached alignment JSON exists and --reuse-tts is passed.
 *
 * Run with:  pnpm prepare:chapter
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import type { Chapter, Idiom } from "../src/lib/chapter.ts";

// ─── paths ──────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const CORPUS = resolve(REPO_ROOT, "chinese/孙子兵法_原文与译文.txt");
const OUT_DIR = resolve(__dirname, "../public/audiobook");
const OUT_MP3 = resolve(OUT_DIR, "ch1.mp3");
const OUT_JSON = resolve(OUT_DIR, "ch1.json");
const CACHE_ALIGN = resolve(OUT_DIR, "ch1.alignment.json");

const REUSE_TTS = process.argv.includes("--reuse-tts");

// ─── 1. Extract chapter 1 original text ─────────────────────────────────────
function loadChapter1Original(): string {
  const raw = readFileSync(CORPUS, "utf8");
  const lines = raw.split(/\r?\n/);
  let inChapter = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith("始计第一")) {
      inChapter = true;
      continue;
    }
    if (inChapter) {
      if (line.startsWith("始计篇 译文") || line.startsWith("作战第二")) break;
      if (line.trim()) collected.push(line.trim());
    }
  }
  if (!collected.length) throw new Error("Could not locate Chapter 1 in corpus");
  return collected.join("");
}

// ─── 2. Sentence split ──────────────────────────────────────────────────────
function splitSentences(text: string): string[] {
  const matches = text.match(/[^。！？]+[。！？]/g) ?? [];
  return matches.map((s) => s.trim()).filter(Boolean);
}

// ─── 3. Claude — pinyin + English + idioms ──────────────────────────────────
interface ClaudeAnnotations {
  sentences: Array<{ idx: number; pinyin: string; en: string }>;
  idioms: Idiom[];
}

async function annotateWithClaude(sentences: string[]): Promise<ClaudeAnnotations> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing in .env");
  const client = new Anthropic({ apiKey });

  const numbered = sentences.map((zh, i) => `${i}: ${zh}`).join("\n");

  const system = `You annotate classical Chinese (Sun Tzu's Art of War) for a language-learning audiobook app.

Return ONLY a JSON object — no prose, no markdown fences — with this exact shape:
{
  "sentences": [
    { "idx": <number>, "pinyin": "<Hanyu Pinyin with tone marks for the WHOLE sentence>", "en": "<natural English translation>" }
  ],
  "idioms": [
    { "sentenceIdx": <number>, "term": "<exact chéngyǔ or cultural reference as it appears>", "literal": "<character-by-character literal gloss>", "meaning": "<what it actually means culturally>", "origin": "<one-sentence background>" }
  ]
}

Rules:
- One entry per input sentence, idx matching the input index.
- Pinyin must use tone marks (e.g. bīng zhě), not numbers.
- Flag idioms sparingly: only true chéngyǔ, military maxims, or culturally loaded references a Western listener would miss. Skip ordinary phrasing.
- If a sentence contains no idiom, just omit it from the idioms array.`;

  const userMsg = `Annotate these ${sentences.length} sentences of 始计第一:\n\n${numbered}`;

  console.log(`[claude] requesting annotations for ${sentences.length} sentences…`);
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text in Claude response");
  const txt = textBlock.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: ClaudeAnnotations;
  try {
    parsed = JSON.parse(txt);
  } catch (e) {
    console.error("[claude] failed to parse JSON. Raw text:\n", txt);
    throw e;
  }

  if (parsed.sentences.length !== sentences.length) {
    console.warn(
      `[claude] expected ${sentences.length} annotations, got ${parsed.sentences.length} — continuing anyway`,
    );
  }
  return parsed;
}

// ─── 4. ElevenLabs — TTS with alignment ─────────────────────────────────────
interface Alignment {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

interface AudioResult {
  audioBase64: string;
  alignment: Alignment;
}

async function synthesize(zhText: string): Promise<AudioResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing in .env");
  const voiceId =
    process.env.ELEVENLABS_VOICE_NARRATOR_ZH ?? "XB0fDUnXU5powFXDhCwa"; // Charlotte (multilingual)

  const client = new ElevenLabsClient({ apiKey });
  console.log(`[eleven] synthesizing ${zhText.length} chars with voice ${voiceId}…`);
  const res = await client.textToSpeech.convertWithTimestamps(voiceId, {
    text: zhText,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });

  if (!res.alignment) throw new Error("ElevenLabs returned no alignment");
  return {
    audioBase64: res.audioBase64,
    alignment: res.alignment as Alignment,
  };
}

// ─── 5. Map alignment → sentence timestamps ─────────────────────────────────
function deriveSentenceTimings(
  sentences: string[],
  fullText: string,
  alignment: Alignment,
): Array<{ start: number; end: number }> {
  // alignment.characters is the character stream the model actually spoke.
  // Walk the input fullText and align cursor positions to sentence boundaries.
  const out: Array<{ start: number; end: number }> = [];
  let cursor = 0; // index into alignment.characters
  let textCursor = 0; // index into fullText

  for (const sentence of sentences) {
    const sentenceStartTextIdx = fullText.indexOf(sentence, textCursor);
    if (sentenceStartTextIdx === -1) throw new Error(`Sentence not found in text: ${sentence}`);
    const sentenceEndTextIdx = sentenceStartTextIdx + sentence.length;

    // Advance alignment cursor until we've covered sentenceStartTextIdx chars of fullText
    // (most punctuation/whitespace makes it into alignment.characters too).
    let consumedFromText = 0;
    let sentenceStartAlignIdx = cursor;
    while (cursor < alignment.characters.length && consumedFromText < sentenceStartTextIdx - textCursor) {
      cursor++;
      consumedFromText++;
    }
    sentenceStartAlignIdx = cursor;

    while (cursor < alignment.characters.length && consumedFromText < sentenceEndTextIdx - textCursor) {
      cursor++;
      consumedFromText++;
    }
    const sentenceEndAlignIdx = Math.min(cursor - 1, alignment.characters.length - 1);

    const start = alignment.characterStartTimesSeconds[sentenceStartAlignIdx] ?? 0;
    const end =
      alignment.characterEndTimesSeconds[sentenceEndAlignIdx] ??
      alignment.characterEndTimesSeconds[alignment.characterEndTimesSeconds.length - 1] ??
      start;

    out.push({ start, end });
    textCursor = sentenceEndTextIdx;
  }
  return out;
}

// ─── orchestrate ────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const original = loadChapter1Original();
  const sentences = splitSentences(original);
  console.log(`[corpus] chapter 1: ${original.length} chars, ${sentences.length} sentences`);

  const annotations = await annotateWithClaude(sentences);

  let audioResult: AudioResult;
  if (REUSE_TTS && existsSync(CACHE_ALIGN) && existsSync(OUT_MP3)) {
    console.log("[eleven] --reuse-tts: loading cached alignment");
    const cached = JSON.parse(readFileSync(CACHE_ALIGN, "utf8"));
    audioResult = { audioBase64: "", alignment: cached };
  } else {
    audioResult = await synthesize(original);
    writeFileSync(OUT_MP3, Buffer.from(audioResult.audioBase64, "base64"));
    writeFileSync(CACHE_ALIGN, JSON.stringify(audioResult.alignment));
    console.log(`[eleven] wrote ${OUT_MP3}`);
  }

  const timings = deriveSentenceTimings(sentences, original, audioResult.alignment);

  const chapter: Chapter = {
    chapterId: "ch1",
    title: "始计第一",
    audioSrc: "/audiobook/ch1.mp3",
    durationSeconds:
      audioResult.alignment.characterEndTimesSeconds[
        audioResult.alignment.characterEndTimesSeconds.length - 1
      ] ?? 0,
    sentences: sentences.map((zh, idx) => {
      const ann = annotations.sentences.find((a) => a.idx === idx);
      return {
        idx,
        zh,
        pinyin: ann?.pinyin ?? "",
        en: ann?.en ?? "",
        start: timings[idx]!.start,
        end: timings[idx]!.end,
      };
    }),
    idioms: annotations.idioms,
  };

  writeFileSync(OUT_JSON, JSON.stringify(chapter, null, 2));
  console.log(`[done] wrote ${OUT_JSON}`);
  console.log(
    `[done] ${chapter.sentences.length} sentences, ${chapter.idioms.length} idioms, ${chapter.durationSeconds.toFixed(1)}s audio`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

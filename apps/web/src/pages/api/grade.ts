import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { anthropic, MODEL_SONNET } from "../../lib/anthropic";
import type { Chapter } from "../../lib/chapter";

export const prerender = false;

interface Body {
  chapterId?: string;
  uptoSentenceIdx?: number;
  question?: string;
  answer?: string;
  answerLang?: "en" | "zh";
}

function loadChapter(chapterId: string): Chapter {
  const path = resolve(process.cwd(), `public/audiobook/${chapterId}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.question || !body.answer) {
    return Response.json({ error: "question and answer required" }, { status: 400 });
  }

  const chapterId = body.chapterId ?? "ch1";
  const uptoIdx = body.uptoSentenceIdx ?? 0;
  const answerLang = body.answerLang ?? "en";

  let chapter: Chapter;
  try {
    chapter = loadChapter(chapterId);
  } catch {
    return Response.json({ error: `chapter ${chapterId} not found` }, { status: 404 });
  }

  const context = chapter.sentences
    .slice(0, uptoIdx + 1)
    .map((s) => `[${s.idx}] ${s.zh} — ${s.en}`)
    .join("\n");

  const system = `You are grading a learner's spoken answer to a comprehension question about Sun Tzu's 始计第一.

Return ONLY a JSON object with this exact shape, no prose, no markdown fences:
{ "score": "great" | "close" | "missed", "feedback": "<1-2 sentence encouraging response in ${answerLang === "zh" ? "Mandarin Chinese" : "English"}>" }

Rules:
- "great" = captured the core idea, even if phrased differently
- "close" = partially right, missing a key piece
- "missed" = off-topic or unrelated
- The feedback must be warm and constructive — never harsh. Even for "missed", point them gently to the right idea.
- Be tolerant of speech-to-text errors (homophones, dropped particles).`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 400,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Passage they heard:\n${context}\n\nQuestion asked:\n${body.question}\n\nLearner's spoken answer (via STT):\n${body.answer}\n\nGrade now.`,
        },
      ],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const raw = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return Response.json(parsed);
  } catch (e: any) {
    console.error("[grade] error:", e);
    return Response.json({ error: e?.message ?? "claude failed" }, { status: 500 });
  }
};

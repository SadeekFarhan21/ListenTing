import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { anthropic, MODEL_SONNET } from "../../lib/anthropic";
import type { Chapter } from "../../lib/chapter";

export const prerender = false;

interface Body {
  chapterId?: string;
  uptoSentenceIdx?: number;
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

  const chapterId = body.chapterId ?? "ch1";
  const uptoIdx = body.uptoSentenceIdx ?? 0;
  const answerLang = body.answerLang ?? "en";

  let chapter: Chapter;
  try {
    chapter = loadChapter(chapterId);
  } catch (e) {
    return Response.json({ error: `chapter ${chapterId} not found` }, { status: 404 });
  }

  const heard = chapter.sentences.slice(0, uptoIdx + 1);
  const context = heard
    .map((s) => `[${s.idx}] ${s.zh}\n     EN: ${s.en}`)
    .join("\n");

  const system = `You are a friendly Chinese language tutor inside an audiobook learning app. The learner has just listened to part of Sun Tzu's 始计第一 (Chapter 1 of The Art of War).

Generate ONE short comprehension question that checks the learner understood what they just heard. The question should:
- Focus on plot, motivation, or core concept — not character recall or rote translation.
- Be answerable in 1-2 spoken sentences.
- Be phrased warmly, like a friendly tutor, not a quiz proctor.
- Be written in ${answerLang === "zh" ? "natural Mandarin Chinese (simplified, with a brief English gloss in parentheses)" : "natural English"}.

Return ONLY the question text — no preface, no JSON wrapper, no markdown.`;

  try {
    const res = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 300,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Recent passage the learner just heard:\n\n${context}\n\nWrite the question now.`,
        },
      ],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const question = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
    if (!question) throw new Error("empty response from claude");

    return Response.json({ question, language: answerLang });
  } catch (e: any) {
    console.error("[checkin] claude error:", e);
    return Response.json({ error: e?.message ?? "claude failed" }, { status: 500 });
  }
};

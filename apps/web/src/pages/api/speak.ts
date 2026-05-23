import type { APIRoute } from "astro";

import { eleven, VOICE_TUTOR_EN, VOICE_TUTOR_ZH, MODEL_MULTILINGUAL } from "../../lib/elevenlabs";

export const prerender = false;

interface Body {
  text?: string;
  lang?: "en" | "zh";
}

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const text = (body.text ?? "").trim();
  if (!text) return new Response("text required", { status: 400 });

  const lang = body.lang ?? "en";
  const voiceId = lang === "zh" ? VOICE_TUTOR_ZH : VOICE_TUTOR_EN;

  try {
    const stream = await eleven.textToSpeech.stream(voiceId, {
      text,
      modelId: MODEL_MULTILINGUAL,
      outputFormat: "mp3_44100_128",
    });
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    console.error("[speak] elevenlabs error:", e);
    return new Response(e?.message ?? "tts failed", { status: 500 });
  }
};

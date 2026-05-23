import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const apiKey = import.meta.env.ELEVENLABS_API_KEY ?? process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.warn("[elevenlabs] ELEVENLABS_API_KEY is not set — TTS calls will fail at runtime.");
}

export const eleven = new ElevenLabsClient({ apiKey: apiKey ?? "" });

export const VOICE_NARRATOR_ZH =
  import.meta.env.ELEVENLABS_VOICE_NARRATOR_ZH ??
  process.env.ELEVENLABS_VOICE_NARRATOR_ZH ??
  "XrExE9yKIg1WjnnlVkGX";

export const VOICE_TUTOR_ZH =
  import.meta.env.ELEVENLABS_VOICE_TUTOR_ZH ??
  process.env.ELEVENLABS_VOICE_TUTOR_ZH ??
  "21m00Tcm4TlvDq8ikWAM";

export const VOICE_TUTOR_EN =
  import.meta.env.ELEVENLABS_VOICE_TUTOR_EN ??
  process.env.ELEVENLABS_VOICE_TUTOR_EN ??
  "21m00Tcm4TlvDq8ikWAM";

export const MODEL_MULTILINGUAL = "eleven_multilingual_v2";

"use client";
import { useEffect, useState } from "react";
import type { Idiom, Sentence } from "@/lib/types";
import { saveEntry } from "@/lib/vault";
import { Close } from "./Icons";

interface Props {
  idiom: Idiom | null;
  sentence: Sentence | null;
  chapterId: string;
  timestamp: number;
  onClose: () => void;
}

const KIND_LABEL: Record<Idiom["kind"], string> = {
  chengyu: "Chéngyǔ · 成语",
  reference: "Cultural reference",
  concept: "Key concept",
};

export function IdiomCard({ idiom, sentence, chapterId, timestamp, onClose }: Props) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [idiom]);

  useEffect(() => {
    if (!idiom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idiom, onClose]);

  async function handleSave() {
    if (!idiom || !sentence) return;
    await saveEntry({
      word: idiom.term,
      pinyin: idiom.pinyin,
      meaning: idiom.meaning,
      sentenceZh: sentence.zh,
      sentenceEn: sentence.en ?? "",
      chapterId,
      sentenceId: sentence.id,
      timestamp,
    });
    setSaved(true);
  }

  if (!idiom) return null;
  return (
    <div className="fixed inset-x-0 bottom-56 sm:bottom-60 z-30 px-3 pointer-events-none">
      <div className="mx-auto max-w-sm pointer-events-auto">
        <div className="bg-ink/40 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 animate-slide-up shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="chip border-white/15 bg-white/10 text-ink-100/90 text-[11px]">{KIND_LABEL[idiom.kind]}</span>
            <button
              onClick={onClose}
              className="text-ink-200 hover:text-white p-1 -m-1 transition"
              aria-label="Close"
            >
              <Close width={18} height={18} />
            </button>
          </div>
          <div className="flex items-baseline gap-3 mb-2">
            <div className="font-zh text-3xl font-medium tracking-wide text-white">{idiom.term}</div>
            <div className="text-sm text-gold">{idiom.pinyin}</div>
          </div>
          <div className="space-y-1.5 text-sm leading-snug mb-3">
            <div className="text-ink-100/80 italic">{idiom.literal}</div>
            <div className="text-ink-50">{idiom.meaning}</div>
          </div>
          <button
            onClick={handleSave}
            disabled={saved || !sentence}
            className="w-full bg-sun text-white rounded-xl py-1.5 text-sm font-medium disabled:opacity-50 transition hover:bg-sun/90 active:scale-95"
          >
            {saved ? "Saved to Vault ✓" : "Add to Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}

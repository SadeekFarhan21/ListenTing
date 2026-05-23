"use client";
import { useState } from "react";
import { Close } from "./Icons";
import type { Sentence } from "@/lib/types";
import { saveEntry } from "@/lib/vault";

interface Props {
  word: string;
  sentence: Sentence;
  chapterId: string;
  timestamp: number;
  onClose: () => void;
  onSaved: () => void;
}

export function WordCard({ word, sentence, chapterId, timestamp, onClose, onSaved }: Props) {
  const [meaning, setMeaning] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!meaning.trim()) return;
    setSaving(true);
    await saveEntry({
      word,
      meaning: meaning.trim(),
      sentenceZh: sentence.zh,
      sentenceEn: sentence.en ?? "",
      chapterId,
      sentenceId: sentence.id,
      timestamp,
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-x-0 bottom-56 sm:bottom-60 z-30 px-3 pointer-events-none">
      <div className="mx-auto max-w-sm pointer-events-auto">
        <div className="bg-ink/40 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 animate-slide-up shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-baseline gap-3">
              <span className="font-zh text-3xl font-medium tracking-wide text-white">{word}</span>
              <span className="text-xs text-ink-300">tap chars to extend</span>
            </div>
            <button
              onClick={onClose}
              className="text-ink-200 hover:text-white p-1 -m-1 transition"
              aria-label="Close"
            >
              <Close width={18} height={18} />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Enter meaning…"
              className="flex-1 bg-white/10 text-white placeholder-ink-400 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-sun/50"
            />
            <button
              onClick={handleSave}
              disabled={!meaning.trim() || saving}
              className="bg-sun text-white rounded-xl px-4 py-1.5 text-sm font-medium disabled:opacity-40 transition hover:bg-sun/90 active:scale-95 shrink-0"
            >
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

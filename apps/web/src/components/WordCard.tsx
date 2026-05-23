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
    <div className="fixed right-4 bottom-24 z-30 pointer-events-none">
      <div className="w-80 pointer-events-auto">
        <div className="bg-ink/40 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 animate-slide-up shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="chip border-white/15 bg-white/10 text-ink-100/90">Save to Vault</span>
            <button
              onClick={onClose}
              className="text-ink-200 hover:text-white p-1 -m-1 transition"
              aria-label="Close"
            >
              <Close width={20} height={20} />
            </button>
          </div>

          <div className="font-zh text-4xl font-medium tracking-wide text-white mb-1">{word}</div>
          <div className="text-xs text-ink-300 mb-4">
            Tap more characters to extend selection
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-300 mb-1 block">
                Meaning
              </label>
              <input
                autoFocus
                value={meaning}
                onChange={(e) => setMeaning(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="Enter meaning…"
                className="w-full bg-white/10 text-white placeholder-ink-400 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sun/50"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!meaning.trim() || saving}
              className="w-full bg-sun text-white rounded py-2 text-sm font-medium disabled:opacity-40 transition hover:bg-sun/90 active:scale-95"
            >
              {saving ? "Saving…" : "Add to Vault"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

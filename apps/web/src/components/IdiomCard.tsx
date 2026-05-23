"use client";
import { useEffect } from "react";
import type { Idiom } from "@/lib/types";
import { Close } from "./Icons";

interface Props {
  idiom: Idiom | null;
  onClose: () => void;
}

const KIND_LABEL: Record<Idiom["kind"], string> = {
  chengyu: "Chéngyǔ · 成语",
  reference: "Cultural reference",
  concept: "Key concept",
};

export function IdiomCard({ idiom, onClose }: Props) {
  useEffect(() => {
    if (!idiom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idiom, onClose]);

  if (!idiom) return null;
  return (
    <div className="fixed right-4 bottom-24 z-30 pointer-events-none">
      <div className="w-80 pointer-events-auto">
        <div className="bg-ink/40 backdrop-blur-2xl border border-white/15 rounded-2xl p-5 animate-slide-up shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="chip border-white/15 bg-white/10 text-ink-100/90">{KIND_LABEL[idiom.kind]}</span>
            <button
              onClick={onClose}
              className="text-ink-200 hover:text-white p-1 -m-1 transition"
              aria-label="Close"
            >
              <Close width={20} height={20} />
            </button>
          </div>
          <div className="space-y-1.5 mb-4">
            <div className="font-zh text-4xl font-medium tracking-wide text-white">{idiom.term}</div>
            <div className="text-sm text-gold">{idiom.pinyin}</div>
          </div>
          <div className="space-y-3 text-sm leading-relaxed">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-300 mb-1">Literal</div>
              <div className="text-ink-100/90 italic">{idiom.literal}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-300 mb-1">Cultural meaning</div>
              <div className="text-ink-50">{idiom.meaning}</div>
            </div>
            {idiom.origin && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-300 mb-1">Origin</div>
                <div className="text-ink-100/80">{idiom.origin}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

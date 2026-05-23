"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Chapter, Idiom, Sentence } from "@/lib/types";
import { fmtTime, cn } from "@/lib/cn";
import { useSettings } from "@/lib/settings";
import { usePlayer } from "@/lib/usePlayer";
import { ArrowLeft, Back15, Bookmark, Close, Eye, Fwd30, Mic, Pause, Play, Sparkle, Volume } from "./Icons";
import { Waveform } from "./Waveform";
import { IdiomCard } from "./IdiomCard";
import { WordCard } from "./WordCard";
import { VaultSheet } from "./VaultSheet";
import { CheckinModal } from "./CheckinModal";

interface Props {
  chapter: Chapter;
}

export function Player({ chapter }: Props) {
  const [settings, updateSettings] = useSettings();
  const [openIdiom, setOpenIdiom] = useState<Idiom | null>(null);
  const [openVault, setOpenVault] = useState(false);
  const [openCheckin, setOpenCheckin] = useState(false);
  const [translatedEnglish, setTranslatedEnglish] = useState<Record<number, string>>({});
  const [visualizeState, setVisualizeState] = useState<"idle" | "loading" | "shown">("idle");
  const lastCheckinAtRef = useRef<number>(0);

  const chapterImageSrc = Number(chapter.id) <= 3 ? `/images/chapter-${chapter.id}.png` : null;

  function handleVisualize() {
    if (state.isPlaying) pause();
    setVisualizeState("loading");
    setTimeout(() => setVisualizeState("shown"), 1800);
  }

  // Word selection for vocab vault
  const [charSelection, setCharSelection] = useState<{
    sentenceId: number;
    start: number;
    end: number;
    anchor: number;
    sentence: Sentence;
  } | null>(null);

  const handleCharClick = useCallback((s: Sentence, charIdx: number) => {
    setOpenIdiom(null);
    setCharSelection((prev) => {
      if (!prev || prev.sentenceId !== s.id) {
        return { sentenceId: s.id, start: charIdx, end: charIdx + 1, anchor: charIdx, sentence: s };
      }
      // Tap same single char → deselect
      if (prev.anchor === charIdx && prev.end - prev.start === 1) return null;
      // Extend range from anchor to this char
      const start = Math.min(prev.anchor, charIdx);
      const end = Math.max(prev.anchor, charIdx) + 1;
      return { ...prev, start, end };
    });
  }, []);

  // Track which idioms were already shown this play session to avoid repeating
  const shownIdiomsRef = useRef<Set<string>>(new Set());

  const onSentenceEnter = useCallback(
    (s: Sentence) => {
      // Fire the FIRST unseen idiom in this sentence
      const fresh = s.idioms?.find((i) => !shownIdiomsRef.current.has(i.term));
      if (fresh) {
        shownIdiomsRef.current.add(fresh.term);
        setCharSelection(null);
        setOpenIdiom(fresh);
      }
    },
    [],
  );

  const player = usePlayer(chapter, { onSentenceEnter });
  const { state, activeSentence, play, pause, seek, setRate } = player;

  // Sync rate
  useEffect(() => {
    setRate(settings.playbackRate);
  }, [settings.playbackRate, setRate]);

  // Pause when a blocking overlay opens; resume on close (decided by overlay)
  useEffect(() => {
    if (openVault || openCheckin) {
      if (state.isPlaying) pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openVault, openCheckin]);

  // Scheduled voice check-in
  useEffect(() => {
    if (!state.isPlaying) return;
    if (settings.checkinIntervalMin <= 0) return;
    const intervalSec = settings.checkinIntervalMin * 60;
    if (state.currentTime - lastCheckinAtRef.current >= intervalSec) {
      lastCheckinAtRef.current = state.currentTime;
      pause();
      setOpenCheckin(true);
    }
  }, [state.currentTime, state.isPlaying, settings.checkinIntervalMin, pause]);

  // Lazy-translate visible window to English for the transcript
  const visibleSentences = useMemo(() => {
    if (!activeSentence) return chapter.sentences.slice(0, 5);
    const idx = chapter.sentences.findIndex((s) => s.id === activeSentence.id);
    const start = Math.max(0, idx - 2);
    const end = Math.min(chapter.sentences.length, idx + 6);
    return chapter.sentences.slice(start, end);
  }, [activeSentence, chapter.sentences]);

  useEffect(() => {
    if (!settings.showEnglish) return;
    const needs = visibleSentences.filter((s) => !s.en && translatedEnglish[s.id] === undefined);
    if (needs.length === 0) return;
    let cancelled = false;
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapter: { id: chapter.id, titleEn: chapter.titleEn },
        sentences: needs.map((s) => ({ id: s.id, zh: s.zh })),
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { translations: Array<{ id: number; en: string }> }) => {
        if (cancelled) return;
        setTranslatedEnglish((prev) => {
          const next = { ...prev };
          for (const t of data.translations) next[t.id] = t.en;
          return next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setTranslatedEnglish((prev) => {
          const next = { ...prev };
          for (const s of needs) next[s.id] = ""; // mark attempted
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [visibleSentences, settings.showEnglish, chapter.id, chapter.titleEn, translatedEnglish]);

  const englishFor = useCallback(
    (s: Sentence): string | undefined => s.en || translatedEnglish[s.id] || undefined,
    [translatedEnglish],
  );

  // Sentences heard so far (for check-in context)
  const contextSoFar = useMemo(() => {
    if (!activeSentence) return chapter.sentences.slice(0, 1);
    const idx = chapter.sentences.findIndex((s) => s.id === activeSentence.id);
    return chapter.sentences.slice(0, idx + 1).map((s) => ({ ...s, en: englishFor(s) }));
  }, [activeSentence, chapter.sentences, englishFor]);

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  return (
    <div className="relative min-h-dvh paper">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-50/70 border-b border-ink-200/50">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-3">
          <Link href="/app" className="btn-ghost px-2 py-2" aria-label="Back">
            <ArrowLeft width={20} height={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-ink-400 uppercase tracking-wider">
              Chapter {chapter.id} · {chapter.titlePinyin}
            </div>
            <div className="font-serif-display text-base text-ink truncate">
              <span className="font-zh">{chapter.titleZh}</span> · {chapter.titleEn}
            </div>
          </div>
          <button
            onClick={() => updateSettings({ playbackRate: cycleRate(settings.playbackRate) })}
            className="chip"
            aria-label="Playback speed"
          >
            <Volume width={14} height={14} />
            {settings.playbackRate}×
          </button>
          {chapterImageSrc && (
            <button
              onClick={handleVisualize}
              className="chip text-gold border-gold/30 hover:bg-gold/10"
              aria-label="Visualize scene"
            >
              <Eye width={14} height={14} />
              Scene
            </button>
          )}
        </div>
        <div className="h-1 bg-ink-200/40">
          <div
            className="h-full bg-sun transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Transcript */}
      <section className="mx-auto max-w-xl px-5 pt-6">
        {state.source === "tts" && (
          <div className="chip mb-4 text-ink-400">
            <Sparkle className="text-gold" width={12} height={12} />
            Demo voice — using your device's narrator until ch{chapter.id}.mp3 is added
          </div>
        )}

        <div className="space-y-5">
          {visibleSentences.map((s) => {
            const isActive = s.id === activeSentence?.id;
            const en = englishFor(s);
            return (
              <div
                key={s.id}
                data-active={isActive}
                className="transcript-line cursor-pointer group"
                onClick={() => seek(s.start + 0.05)}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-ink-300">
                    {fmtTime(s.start)}
                  </span>
                  {s.idioms?.length ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenIdiom(s.idioms![0]);
                      }}
                      className="text-[10px] uppercase tracking-wider text-gold hover:underline"
                    >
                      {s.idioms.length} idiom{s.idioms.length > 1 ? "s" : ""}
                    </button>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "font-zh leading-[1.55] tracking-wide",
                    isActive ? "text-2xl text-ink" : "text-lg text-ink-400",
                  )}
                >
                  {renderInteractiveText(
                    s.zh,
                    s.idioms,
                    charSelection?.sentenceId === s.id
                      ? { start: charSelection.start, end: charSelection.end }
                      : null,
                    (i) => { setCharSelection(null); setOpenIdiom(i); },
                    (idx) => handleCharClick(s, idx),
                  )}
                </p>
                {settings.showGloss && s.gloss && (
                  <p className={cn("font-zh text-sm mt-1.5", isActive ? "text-ink-500" : "text-ink-300")}>
                    {s.gloss}
                  </p>
                )}
                {settings.showEnglish && (
                  <p className={cn("text-sm mt-1.5 italic", isActive ? "text-ink-500" : "text-ink-300")}>
                    {en || (isActive ? "…" : "")}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-44" />
      </section>

      {/* Player dock */}
      <div className="fixed bottom-24 sm:bottom-28 inset-x-0 z-20 px-3 pointer-events-none">
        <div className="mx-auto max-w-xl pointer-events-auto">
          <div className="ink-card-dark px-4 py-3">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs text-ink-200 tabular-nums">
                {fmtTime(state.currentTime)} <span className="text-ink-300">/ {fmtTime(state.duration)}</span>
              </div>
              <div className="flex items-center gap-2 text-ink-200">
                <Waveform active={state.isPlaying} className="text-gold" />
                <span className="text-xs uppercase tracking-wider">
                  {state.isPlaying ? "Playing" : "Paused"}
                </span>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={state.duration || 1}
              step={0.1}
              value={state.currentTime}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="w-full accent-sun"
            />

            <div className="flex items-center justify-around mt-2">
              <button
                onClick={() => seek(state.currentTime - 15)}
                className="text-ink-100 hover:text-white p-2"
                aria-label="Back 15s"
              >
                <Back15 width={26} height={26} />
              </button>
              <button
                onClick={() => setOpenVault(true)}
                disabled={!activeSentence}
                className="text-ink-100 hover:text-white p-2 disabled:opacity-30"
                aria-label="Save to vault"
              >
                <Bookmark width={24} height={24} />
              </button>
              <button
                onClick={() => (state.isPlaying ? pause() : play())}
                className="bg-sun text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-sun/30 active:scale-95 transition"
                aria-label={state.isPlaying ? "Pause" : "Play"}
              >
                {state.isPlaying ? <Pause width={28} height={28} /> : <Play width={28} height={28} />}
              </button>
              <button
                onClick={() => {
                  pause();
                  setOpenCheckin(true);
                }}
                className="text-ink-100 hover:text-white p-2"
                aria-label="Check-in now"
              >
                <Mic width={24} height={24} />
              </button>
              <button
                onClick={() => seek(state.currentTime + 30)}
                className="text-ink-100 hover:text-white p-2"
                aria-label="Forward 30s"
              >
                <Fwd30 width={26} height={26} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Visualize Scene overlay */}
      {visualizeState !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="relative w-full max-w-sm bg-ink-900 rounded-2xl overflow-hidden shadow-2xl">
            <button
              onClick={() => setVisualizeState("idle")}
              className="absolute top-3 right-3 z-10 text-ink-300 hover:text-white p-1"
              aria-label="Close"
            >
              <Close width={20} height={20} />
            </button>
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Sparkle width={14} height={14} className="text-gold" />
              <span className="text-xs uppercase tracking-widest text-ink-300">
                Chapter {chapter.id} · Scene
              </span>
            </div>
            {visualizeState === "loading" ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold animate-spin" />
                </div>
                <p className="text-sm text-ink-300 text-center animate-pulse">
                  Generating scene visualization…
                </p>
              </div>
            ) : (
              <div className="p-3 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={chapterImageSrc!}
                  alt={`Chapter ${chapter.id} scene`}
                  className="w-full rounded-xl object-cover"
                />
                <p className="text-center text-xs text-ink-400 mt-2 mb-1">
                  {chapter.titleEn}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <IdiomCard
        idiom={openIdiom}
        sentence={activeSentence ?? null}
        chapterId={chapter.id}
        timestamp={state.currentTime}
        onClose={() => setOpenIdiom(null)}
      />
      {charSelection && (
        <WordCard
          word={charSelection.sentence.zh.slice(charSelection.start, charSelection.end)}
          sentence={charSelection.sentence}
          chapterId={chapter.id}
          timestamp={state.currentTime}
          onClose={() => setCharSelection(null)}
          onSaved={() => setCharSelection(null)}
        />
      )}
      <VaultSheet
        open={openVault}
        sentence={activeSentence ?? null}
        chapterId={chapter.id}
        timestamp={state.currentTime}
        onClose={() => setOpenVault(false)}
      />
      {openCheckin && (
        <CheckinModal
          open={openCheckin}
          chapter={chapter}
          contextSentences={contextSoFar}
          language={settings.questionLanguage}
          onClose={(resume) => {
            setOpenCheckin(false);
            if (resume) play();
          }}
        />
      )}
    </div>
  );
}

function cycleRate(r: number): number {
  const ladder = [0.75, 1, 1.15, 1.3, 1.5];
  const i = ladder.indexOf(r);
  return ladder[(i + 1) % ladder.length] ?? 1;
}

function renderInteractiveText(
  zh: string,
  idioms: Sentence["idioms"],
  selection: { start: number; end: number } | null,
  onIdiomClick: (i: Idiom) => void,
  onCharClick: (idx: number) => void,
): React.ReactNode {
  // Build non-overlapping idiom spans
  const idiomSpans: Array<{ start: number; end: number; idiom: Idiom }> = [];
  if (idioms) {
    for (const idi of idioms) {
      let from = 0;
      while (true) {
        const idx = zh.indexOf(idi.term, from);
        if (idx === -1) break;
        idiomSpans.push({ start: idx, end: idx + idi.term.length, idiom: idi });
        from = idx + idi.term.length;
      }
    }
    idiomSpans.sort((a, b) => a.start - b.start || b.end - a.end);
  }
  const taken: typeof idiomSpans = [];
  let cursor = 0;
  for (const m of idiomSpans) {
    if (m.start >= cursor) { taken.push(m); cursor = m.end; }
  }

  const renderChars = (from: number, to: number) =>
    Array.from({ length: to - from }, (_, k) => {
      const j = from + k;
      const sel = selection && j >= selection.start && j < selection.end;
      return (
        <span
          key={`c${j}`}
          onClick={(e) => { e.stopPropagation(); onCharClick(j); }}
          className={cn(
            "cursor-pointer transition-colors",
            sel ? "text-sun bg-sun/20 rounded-sm" : "hover:text-sun",
          )}
        >
          {zh[j]}
        </span>
      );
    });

  const out: React.ReactNode[] = [];
  let i = 0;
  for (const m of taken) {
    if (m.start > i) out.push(...renderChars(i, m.start));
    out.push(
      <button
        key={`id${m.start}`}
        onClick={(e) => { e.stopPropagation(); onIdiomClick(m.idiom); }}
        className="text-sun underline decoration-sun/40 decoration-2 underline-offset-4 hover:decoration-sun"
      >
        {zh.slice(m.start, m.end)}
      </button>,
    );
    i = m.end;
  }
  if (i < zh.length) out.push(...renderChars(i, zh.length));
  return out;
}

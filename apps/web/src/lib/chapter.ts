export interface Sentence {
  idx: number;
  zh: string;
  pinyin: string;
  en: string;
  start: number;
  end: number;
}

export interface Idiom {
  sentenceIdx: number;
  term: string;
  literal: string;
  meaning: string;
  origin: string;
}

export interface Chapter {
  chapterId: string;
  title: string;
  audioSrc: string;
  durationSeconds: number;
  sentences: Sentence[];
  idioms: Idiom[];
}

export function findSentenceAt(sentences: Sentence[], t: number): Sentence | null {
  let lo = 0;
  let hi = sentences.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = sentences[mid];
    if (t < s.start) hi = mid - 1;
    else if (t >= s.end) lo = mid + 1;
    else return s;
  }
  return null;
}

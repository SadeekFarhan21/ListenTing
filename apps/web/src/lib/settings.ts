export type AnswerLang = "en" | "zh";

const KEY = "app:answerLang";

export function getAnswerLang(): AnswerLang {
  if (typeof localStorage === "undefined") return "en";
  const v = localStorage.getItem(KEY);
  return v === "zh" ? "zh" : "en";
}

export function setAnswerLang(v: AnswerLang) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, v);
}

const CADENCE_KEY = "app:checkinEverySentences";
export function getCheckinCadence(): number {
  if (typeof localStorage === "undefined") return 5;
  const n = Number(localStorage.getItem(CADENCE_KEY));
  return Number.isFinite(n) && n > 0 ? n : 5;
}
export function setCheckinCadence(n: number) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CADENCE_KEY, String(n));
}

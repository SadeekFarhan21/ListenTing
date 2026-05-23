import { get, set, del, keys } from "idb-keyval";

export interface VaultCard {
  id: string;
  chapterId: string;
  sentenceIdx: number;
  zh: string;
  pinyin: string;
  en: string;
  audioSrc: string;
  start: number;
  end: number;
  savedAt: number;
}

function cardId(chapterId: string, sentenceIdx: number) {
  return `card:${chapterId}:${sentenceIdx}`;
}

export async function saveCard(
  input: Omit<VaultCard, "id" | "savedAt">,
): Promise<VaultCard> {
  const card: VaultCard = {
    ...input,
    id: cardId(input.chapterId, input.sentenceIdx),
    savedAt: Date.now(),
  };
  await set(card.id, card);
  return card;
}

export async function listCards(): Promise<VaultCard[]> {
  const allKeys = await keys();
  const cardKeys = allKeys.filter(
    (k): k is string => typeof k === "string" && k.startsWith("card:"),
  );
  const cards = await Promise.all(cardKeys.map((k) => get<VaultCard>(k)));
  return cards
    .filter((c): c is VaultCard => !!c)
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteCard(id: string): Promise<void> {
  await del(id);
}

import { RoomSettings } from "../types.js";

/**
 * Normalizes a string for comparison: lowercase, trimmed, collapses internal
 * whitespace, and strips accents so "café" / "cafe" both match.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/\s+/g, " ");
}

export type GuessMatch = "exact" | "close" | "none";

/**
 * Compares a guess against the target word.
 * - "exact": normalized strings are identical
 * - "close": small edit distance (1 char off for words >=4 chars) - used for
 *   "close guess!" feedback without awarding points
 * - "none": no meaningful match
 */
export function matchGuess(guess: string, word: string): GuessMatch {
  const g = normalize(guess);
  const w = normalize(word);

  if (g.length === 0) return "none";
  if (g === w) return "exact";

  // Allow matching even if guesser added/omitted punctuation-like chars
  const gAlnum = g.replace(/[^a-z0-9 ]/g, "");
  const wAlnum = w.replace(/[^a-z0-9 ]/g, "");
  if (gAlnum === wAlnum && gAlnum.length > 0) return "exact";

  if (w.length >= 4 && Math.abs(g.length - w.length) <= 1) {
    const dist = levenshtein(g, w);
    if (dist === 1) return "close";
  }

  return "none";
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Builds the "blank" display string for a word, e.g. "elephant" -> "_ _ _ _ _ _ _ _"
 * with `revealedIndices` shown as their real letters. Spaces in multi-word
 * phrases are preserved as visible gaps (rendered as " / " separators).
 */
export function buildBlank(word: string, revealedIndices: Set<number>): string {
  return word
    .split("")
    .map((ch, i) => {
      if (ch === " ") return "  "; // visual gap between words
      return revealedIndices.has(i) ? ch : "_";
    })
    .join(" ");
}

/**
 * Picks `count` random letter indices (excluding spaces) to reveal as hints,
 * spread across the word, never revealing the first letter.
 */
export function pickHintIndices(word: string, maxHints: number): number[] {
  const letterIndices = word
    .split("")
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch, i }) => ch !== " " && i !== 0)
    .map(({ i }) => i);

  const shuffled = [...letterIndices].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(maxHints, letterIndices.length));
}

export function clampSettings(settings: Partial<RoomSettings>, base: RoomSettings): RoomSettings {
  const merged: RoomSettings = { ...base, ...settings };

  merged.maxPlayers = clamp(merged.maxPlayers, 2, 20);
  merged.rounds = clamp(merged.rounds, 2, 10);
  merged.drawTimeSec = clamp(merged.drawTimeSec, 15, 240);
  merged.wordCount = clamp(merged.wordCount, 1, 5);
  merged.hints = clamp(merged.hints, 0, 5);

  if (!["normal", "hidden", "combination"].includes(merged.wordMode)) {
    merged.wordMode = "normal";
  }

  if (merged.customWords) {
    merged.customWords = merged.customWords
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && w.length <= 30)
      .slice(0, 200);
  }

  return merged;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function sanitizeName(name: string): string {
  const trimmed = (name || "").trim().slice(0, 20);
  return trimmed.length > 0 ? trimmed : "Player";
}

export function sanitizeChatText(text: string): string {
  return (text || "").trim().slice(0, 200);
}

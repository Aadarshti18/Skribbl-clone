import { Player } from "./Player.js";
import { buildBlank, matchGuess, pickHintIndices } from "../utils/wordUtils.js";
import { GamePhase, RoomSettings, WordMode } from "../types.js";
import { getRandomWords } from "../data/words.js";

export interface GuessOutcome {
  matchType: "exact" | "close" | "none";
  points: number;
  allGuessed: boolean;
}

/**
 * Encapsulates the turn-based round/scoring state machine for a single
 * room's game session. A Room owns exactly one Game instance per active
 * game (recreated each time `start_game` is called).
 */
export class Game {
  public phase: GamePhase = "lobby";
  public round = 0;
  public readonly totalRounds: number;
  public drawerOrder: string[] = []; // player ids, rotation order
  public drawerIndex = -1;
  public currentDrawerId: string | null = null;
  public currentWord: string | null = null;
  public wordOptions: string[] = [];
  public revealedIndices: Set<number> = new Set();
  public usedWords: Set<string> = new Set();
  public timeLeft = 0;
  public readonly drawTimeSec: number;
  public readonly maxHints: number;
  public readonly wordMode: WordMode;
  public readonly wordCountChoices: number;
  public readonly customWords?: string[];
  private correctGuesserCount = 0;
  private totalGuessersThisRound = 0;

  constructor(settings: RoomSettings) {
    this.totalRounds = settings.rounds;
    this.drawTimeSec = settings.drawTimeSec;
    this.maxHints = settings.hints;
    this.wordMode = settings.wordMode;
    this.wordCountChoices = settings.wordCount;
    this.customWords = settings.customWords;
  }

  public initOrder(playerIds: string[]): void {
    this.drawerOrder = [...playerIds];
  }

  public get isLastRound(): boolean {
    return this.round >= this.totalRounds;
  }

  /** Advances to the next drawer; returns null if the game should end. */
  public advanceTurn(): string | null {
    this.drawerIndex += 1;
    if (this.drawerIndex >= this.drawerOrder.length) {
      this.drawerIndex = 0;
      this.round += 1;
    }
    if (this.round === 0) this.round = 1;

    if (this.round > this.totalRounds) {
      this.phase = "game_over";
      return null;
    }

    this.currentDrawerId = this.drawerOrder[this.drawerIndex] ?? null;
    return this.currentDrawerId;
  }

  public removePlayerFromOrder(playerId: string): void {
    const idx = this.drawerOrder.indexOf(playerId);
    if (idx === -1) return;
    this.drawerOrder.splice(idx, 1);
    if (idx <= this.drawerIndex) {
      this.drawerIndex -= 1;
    }
  }

  public addPlayerToOrder(playerId: string): void {
    if (!this.drawerOrder.includes(playerId)) {
      this.drawerOrder.push(playerId);
    }
  }

  public startWordSelection(): string[] {
    this.phase = "choosing_word";
    this.wordOptions = getRandomWords(this.wordCountChoices, this.usedWords, this.customWords);
    this.currentWord = null;
    this.revealedIndices = new Set();
    return this.wordOptions;
  }

  public chooseWord(word: string): boolean {
    if (!this.wordOptions.includes(word)) return false;
    this.currentWord = word;
    this.usedWords.add(word);
    this.phase = "drawing";
    this.timeLeft = this.drawTimeSec;
    this.correctGuesserCount = 0;
    return true;
  }

  /** Auto-pick a word if the drawer doesn't choose in time */
  public autoChooseWord(): string {
    const word = this.wordOptions[0];
    this.chooseWord(word);
    return word;
  }

  public setTotalGuessers(count: number): void {
    this.totalGuessersThisRound = count;
  }

  public tick(): boolean {
    if (this.timeLeft > 0) {
      this.timeLeft -= 1;
    }
    return this.timeLeft <= 0;
  }

  /**
   * Returns hint reveal info if a new hint should be revealed at the current
   * time-left mark, otherwise null.
   */
  public maybeRevealHint(): { blank: string; hintsRevealed: number } | null {
    if (this.maxHints <= 0 || !this.currentWord || this.wordMode === "hidden") return null;

    const elapsed = this.drawTimeSec - this.timeLeft;
    const interval = Math.floor(this.drawTimeSec / (this.maxHints + 1));
    if (interval <= 0) return null;

    const targetHintCount = Math.min(this.maxHints, Math.floor(elapsed / interval));
    if (targetHintCount > this.revealedIndices.size) {
      const needed = targetHintCount - this.revealedIndices.size;
      const newIndices = pickHintIndices(
        this.currentWord,
        needed + this.revealedIndices.size
      ).filter((i) => !this.revealedIndices.has(i));

      for (const idx of newIndices.slice(0, needed)) {
        this.revealedIndices.add(idx);
      }
      return {
        blank: this.getBlank(),
        hintsRevealed: this.revealedIndices.size,
      };
    }
    return null;
  }

  public getBlank(): string {
    if (!this.currentWord) return "";
    if (this.wordMode === "hidden") {
      return this.currentWord
        .split("")
        .map((ch) => (ch === " " ? "  " : "?"))
        .join(" ");
    }
    return buildBlank(this.currentWord, this.revealedIndices);
  }

  /**
   * Processes a guess from a player. Returns the outcome including whether
   * all eligible guessers have now guessed correctly (round should end).
   */
  public submitGuess(guess: string, alreadyGuessed: boolean): GuessOutcome {
    if (!this.currentWord || alreadyGuessed || this.phase !== "drawing") {
      return { matchType: "none", points: 0, allGuessed: false };
    }

    const matchType = matchGuess(guess, this.currentWord);
    if (matchType !== "exact") {
      return { matchType, points: 0, allGuessed: false };
    }

    this.correctGuesserCount += 1;

    // Scoring: faster guesses worth more. Base 100, decays with time used,
    // floor 10. First-guesser bonus baked into the time-based formula.
    const timeRatio = this.drawTimeSec > 0 ? this.timeLeft / this.drawTimeSec : 0;
    const points = Math.max(10, Math.round(50 + timeRatio * 100));

    const allGuessed = this.correctGuesserCount >= this.totalGuessersThisRound;

    return { matchType: "exact", points, allGuessed };
  }

  public endRound(): void {
    this.phase = "round_end";
  }

  public isGameOver(): boolean {
    return this.phase === "game_over";
  }
}

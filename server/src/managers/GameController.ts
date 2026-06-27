import { Room } from "../models/Room.js";
import { Game } from "../models/Game.js";
import { Player } from "../models/Player.js";
import {
  GameOverPayload,
  GameStatePayload,
  RoundEndPayload,
  RoundStartPayload,
} from "../types.js";
import { nanoid } from "nanoid";

const WORD_SELECT_TIME_SEC = 15;
const ROUND_END_DELAY_MS = 4000;

/**
 * Drives the turn-by-turn flow of a single game: starting rounds, ticking
 * the clock, revealing hints, ending rounds, and ending the game. Kept
 * separate from socket wiring (MessageHandler) and from pure game-state
 * (Game) so each class has one job.
 */
export class GameController {
  constructor(private room: Room) {}

  public startGame(): void {
    const playerIds = [...this.room.players.keys()];
    if (playerIds.length < 2) return;

    const game = new Game(this.room.settings);
    game.initOrder(playerIds);
    this.room.game = game;

    for (const p of this.room.players.values()) p.resetForNewGame();

    this.advanceToNextDrawer();
  }

  private advanceToNextDrawer(): void {
    const game = this.room.game;
    if (!game) return;

    this.room.clearTimers();

    // Skip disconnected players in rotation
    let attempts = 0;
    let drawerId: string | null = null;
    while (attempts < game.drawerOrder.length + 1) {
      drawerId = game.advanceTurn();
      attempts += 1;
      if (drawerId === null) break; // game over
      const drawer = this.room.players.get(drawerId);
      if (drawer && drawer.connected) break;
    }

    if (drawerId === null || game.isGameOver()) {
      this.endGame();
      return;
    }

    for (const p of this.room.players.values()) p.resetForNewRound();
    const drawer = this.room.players.get(drawerId);
    if (drawer) drawer.isDrawing = true;

    const wordOptions = game.startWordSelection();

    const startPayload: RoundStartPayload = {
      drawerId,
      drawerName: drawer?.name ?? "Unknown",
      wordOptions: null,
      drawTime: this.room.settings.drawTimeSec,
      round: game.round,
      totalRounds: game.totalRounds,
    };

    // Broadcast round_start to everyone (without word options)
    this.room.broadcast("round_start", startPayload);
    // Privately give the drawer their word choices
    if (drawer) {
      this.room.emitTo(drawer.socketId, "round_start", { ...startPayload, wordOptions });
    }

    this.broadcastGameState();

    // Auto-pick a word if drawer doesn't choose within time limit
    const timer = setTimeout(() => {
      if (game.phase === "choosing_word") {
        const word = game.autoChooseWord();
        this.onWordChosen(word);
      }
    }, WORD_SELECT_TIME_SEC * 1000);
    this.room.setWordSelectTimer(timer);
  }

  public chooseWord(playerId: string, word: string): boolean {
    const game = this.room.game;
    if (!game || game.currentDrawerId !== playerId || game.phase !== "choosing_word") {
      return false;
    }
    const ok = game.chooseWord(word);
    if (ok) {
      this.room.clearWordSelectTimer();
      this.onWordChosen(word);
    }
    return ok;
  }

  private onWordChosen(word: string): void {
    const game = this.room.game;
    if (!game) return;

    const guessersCount = this.room.getConnectedPlayers().filter((p) => p.id !== game.currentDrawerId).length;
    game.setTotalGuessers(guessersCount);

    this.broadcastGameState();
    this.startTicking();
  }

  private startTicking(): void {
    const game = this.room.game;
    if (!game) return;

    const interval = setInterval(() => {
      const timeUp = game.tick();

      const hintUpdate = game.maybeRevealHint();
      if (hintUpdate) {
        this.room.broadcast("hint_update", hintUpdate);
      }

      this.room.broadcast("time_tick", { timeLeft: game.timeLeft });

      if (timeUp) {
        this.finishRound("time_up");
      }
    }, 1000);

    this.room.setRoundTimer(interval);
  }

  /** Called by MessageHandler when a guess resolves correctly for everyone */
  public checkAllGuessed(allGuessed: boolean): void {
    if (allGuessed) {
      this.finishRound("all_guessed");
    }
  }

  public finishRound(reason: "time_up" | "all_guessed" | "drawer_left"): void {
    const game = this.room.game;
    if (!game || game.phase !== "drawing") return;

    this.room.clearTimers();
    game.endRound();

    const word = game.currentWord ?? "";
    const scores = this.room.playersPublic();

    // Peek at next drawer without mutating state yet. The game ends once
    // we've just finished the last drawer's turn (by rotation order) in
    // the final round.
    const isLastDrawerInOrder = game.drawerIndex >= game.drawerOrder.length - 1;
    const isFinalRound = game.round >= game.totalRounds;
    const gameWillEnd = isFinalRound && isLastDrawerInOrder;

    const nextIndex = isLastDrawerInOrder ? 0 : game.drawerIndex + 1;
    const nextDrawerId = gameWillEnd ? null : game.drawerOrder[nextIndex] ?? null;

    const payload: RoundEndPayload = {
      word,
      scores,
      nextDrawerId,
      reason,
    };
    this.room.broadcast("round_end", payload);

    const timer = setTimeout(() => {
      this.advanceToNextDrawer();
    }, ROUND_END_DELAY_MS);
    this.room.setWordSelectTimer(timer);
  }

  private endGame(): void {
    const game = this.room.game;
    if (!game) return;

    this.room.clearTimers();
    const leaderboard = this.room.playersPublic().sort((a, b) => b.score - a.score);
    const winner = leaderboard[0];

    const payload: GameOverPayload = { winner, leaderboard };
    this.room.broadcast("game_over", payload);

    this.broadcastGameState();
  }

  public broadcastGameState(): void {
    const game = this.room.game;
    const isOver = game?.phase === "game_over";
    const payload: GameStatePayload = game
      ? {
          phase: game.phase,
          round: isOver ? game.totalRounds : game.round,
          totalRounds: game.totalRounds,
          drawerId: isOver ? null : game.currentDrawerId,
          word: null,
          blank: isOver ? null : game.getBlank(),
          timeLeft: isOver ? 0 : game.timeLeft,
          hintsRevealed: isOver ? 0 : game.revealedIndices.size,
        }
      : {
          phase: "lobby",
          round: 0,
          totalRounds: this.room.settings.rounds,
          drawerId: null,
          word: null,
          blank: null,
          timeLeft: 0,
          hintsRevealed: 0,
        };

    this.room.broadcast("game_state", payload);

    // Send the drawer their actual word privately (never after game over)
    if (!isOver && game?.currentDrawerId && game.currentWord) {
      const drawer = this.room.players.get(game.currentDrawerId);
      if (drawer) {
        this.room.emitTo(drawer.socketId, "game_state", { ...payload, word: game.currentWord });
      }
    }
  }

  /** Handles a drawer disconnecting mid-round: skip to next drawer */
  public handleDrawerLeft(): void {
    const game = this.room.game;
    if (!game) return;
    if (game.phase === "drawing" || game.phase === "choosing_word") {
      this.finishRound("drawer_left");
    }
  }

  public static newChatId(): string {
    return nanoid(8);
  }
}

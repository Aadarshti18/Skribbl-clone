import { PlayerPublic } from "../types.js";

export class Player {
  public readonly id: string;
  public name: string;
  public score = 0;
  public isHost: boolean;
  public isDrawing = false;
  public hasGuessedCorrectly = false;
  public connected = true;
  public readonly avatarSeed: string;
  /** Socket.IO socket id currently associated with this player (changes on reconnect) */
  public socketId: string;

  constructor(id: string, name: string, socketId: string, isHost = false) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.isHost = isHost;
    this.avatarSeed = id;
  }

  public addPoints(points: number): void {
    this.score += points;
  }

  public resetForNewRound(): void {
    this.isDrawing = false;
    this.hasGuessedCorrectly = false;
  }

  public resetForNewGame(): void {
    this.score = 0;
    this.isDrawing = false;
    this.hasGuessedCorrectly = false;
  }

  public toPublic(): PlayerPublic {
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      isHost: this.isHost,
      isDrawing: this.isDrawing,
      hasGuessedCorrectly: this.hasGuessedCorrectly,
      connected: this.connected,
      avatarSeed: this.avatarSeed,
    };
  }
}

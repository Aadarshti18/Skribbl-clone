import { Server as SocketIOServer } from "socket.io";
import { Player } from "./Player.js";
import { Game } from "./Game.js";
import { DEFAULT_SETTINGS, RoomSettings } from "../types.js";
import { clampSettings } from "../utils/wordUtils.js";

const ROOM_IDLE_TIMEOUT_MS = 1000 * 60 * 30; // 30 min with no connected players

export class Room {
  public readonly id: string;
  public players: Map<string, Player> = new Map();
  public settings: RoomSettings;
  public hostId: string;
  public game: Game | null = null;
  public chatLog: { id: string; playerId: string; playerName: string; text: string; type: string }[] = [];
  private io: SocketIOServer;
  private roundTimer: NodeJS.Timeout | null = null;
  private wordSelectTimer: NodeJS.Timeout | null = null;
  private emptyRoomTimer: NodeJS.Timeout | null = null;
  public lastActivity = Date.now();

  constructor(id: string, io: SocketIOServer, hostId: string, settings: Partial<RoomSettings> = {}) {
    this.id = id;
    this.io = io;
    this.hostId = hostId;
    this.settings = clampSettings(settings, DEFAULT_SETTINGS);
  }

  public get socketRoomName(): string {
    return `room:${this.id}`;
  }

  public broadcast(event: string, payload: unknown): void {
    this.io.to(this.socketRoomName).emit(event, payload);
  }

  public emitTo(socketId: string, event: string, payload: unknown): void {
    this.io.to(socketId).emit(event, payload);
  }

  public touch(): void {
    this.lastActivity = Date.now();
  }

  // --- Player management -----------------------------------------------

  public addPlayer(player: Player): void {
    this.players.set(player.id, player);
    if (this.game && this.game.phase !== "lobby") {
      this.game.addPlayerToOrder(player.id);
    }
    this.clearEmptyRoomTimer();
    this.touch();
  }

  public removePlayer(playerId: string): Player | undefined {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    this.players.delete(playerId);
    if (this.game) {
      this.game.removePlayerFromOrder(playerId);
    }
    this.touch();
    return player;
  }

  public markDisconnected(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      this.touch();
    }
  }

  public getConnectedPlayers(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  public isEmpty(): boolean {
    return this.getConnectedPlayers().length === 0;
  }

  public reassignHostIfNeeded(): string | null {
    const current = this.players.get(this.hostId);
    if (current && current.connected) return null;

    const next = this.getConnectedPlayers()[0];
    if (next) {
      if (current) current.isHost = false;
      next.isHost = true;
      this.hostId = next.id;
      return next.id;
    }
    return null;
  }

  public playersPublic() {
    return [...this.players.values()].map((p) => p.toPublic());
  }

  // --- Settings -----------------------------------------------------------

  public updateSettings(partial: Partial<RoomSettings>): void {
    this.settings = clampSettings(partial, this.settings);
    this.touch();
  }

  // --- Lifecycle / cleanup ------------------------------------------------

  public clearTimers(): void {
    if (this.roundTimer) clearInterval(this.roundTimer);
    if (this.wordSelectTimer) clearTimeout(this.wordSelectTimer);
    this.roundTimer = null;
    this.wordSelectTimer = null;
  }

  public setRoundTimer(timer: NodeJS.Timeout): void {
    if (this.roundTimer) clearInterval(this.roundTimer);
    this.roundTimer = timer;
  }

  public setWordSelectTimer(timer: NodeJS.Timeout): void {
    if (this.wordSelectTimer) clearTimeout(this.wordSelectTimer);
    this.wordSelectTimer = timer;
  }

  public clearWordSelectTimer(): void {
    if (this.wordSelectTimer) {
      clearTimeout(this.wordSelectTimer);
      this.wordSelectTimer = null;
    }
  }

  public scheduleEmptyRoomCheck(onExpire: () => void): void {
    this.clearEmptyRoomTimer();
    this.emptyRoomTimer = setTimeout(() => {
      if (this.isEmpty()) onExpire();
    }, ROOM_IDLE_TIMEOUT_MS);
  }

  public clearEmptyRoomTimer(): void {
    if (this.emptyRoomTimer) {
      clearTimeout(this.emptyRoomTimer);
      this.emptyRoomTimer = null;
    }
  }

  public destroy(): void {
    this.clearTimers();
    this.clearEmptyRoomTimer();
  }
}

import { Server as SocketIOServer } from "socket.io";
import { customAlphabet } from "nanoid";
import { Room } from "../models/Room.js";
import { RoomSettings } from "../types.js";

const generateRoomCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  public createRoom(hostId: string, settings: Partial<RoomSettings>): Room {
    let id = generateRoomCode();
    while (this.rooms.has(id)) {
      id = generateRoomCode();
    }
    const room = new Room(id, this.io, hostId, settings);
    this.rooms.set(id, room);
    return room;
  }

  public getRoom(id: string): Room | undefined {
    return this.rooms.get(id.toUpperCase());
  }

  public removeRoom(id: string): void {
    const room = this.rooms.get(id);
    if (room) {
      room.destroy();
      this.rooms.delete(id);
    }
  }

  public getPublicRooms(): { id: string; playerCount: number; maxPlayers: number; phase: string }[] {
    return [...this.rooms.values()]
      .filter((r) => !r.settings.isPrivate && r.getConnectedPlayers().length < r.settings.maxPlayers)
      .filter((r) => !r.game || r.game.phase === "lobby")
      .map((r) => ({
        id: r.id,
        playerCount: r.getConnectedPlayers().length,
        maxPlayers: r.settings.maxPlayers,
        phase: r.game?.phase ?? "lobby",
      }));
  }

  public findRoomByPlayerSocket(socketId: string): { room: Room; playerId: string } | null {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) {
          return { room, playerId: player.id };
        }
      }
    }
    return null;
  }

  public get roomCount(): number {
    return this.rooms.size;
  }
}

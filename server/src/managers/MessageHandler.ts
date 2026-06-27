import { Server as SocketIOServer, Socket } from "socket.io";
import { nanoid } from "nanoid";
import { RoomManager } from "./RoomManager.js";
import { GameController } from "./GameController.js";
import { Player } from "../models/Player.js";
import { sanitizeChatText, sanitizeName } from "../utils/wordUtils.js";
import {
  ChatMessagePayload,
  ChatPayload,
  CreateRoomPayload,
  DrawDataPayload,
  DrawEndPayload,
  DrawMovePayload,
  DrawStartPayload,
  ErrorPayload,
  GuessPayload,
  GuessResultPayload,
  JoinRoomPayload,
  JoinedRoomPayload,
  KickPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  RoomCreatedPayload,
  UpdateSettingsPayload,
  WordChosenPayload,
} from "../types.js";

const controllers: Map<string, GameController> = new Map();

function getController(roomId: string, room: import("../models/Room.js").Room): GameController {
  let c = controllers.get(roomId);
  if (!c) {
    c = new GameController(room);
    controllers.set(roomId, c);
  }
  return c;
}

export class MessageHandler {
  constructor(private io: SocketIOServer, private rooms: RoomManager) {}

  public register(socket: Socket): void {
    socket.on("create_room", (payload: CreateRoomPayload) => this.onCreateRoom(socket, payload));
    socket.on("join_room", (payload: JoinRoomPayload) => this.onJoinRoom(socket, payload));
    socket.on("start_game", () => this.onStartGame(socket));
    socket.on("word_chosen", (payload: WordChosenPayload) => this.onWordChosen(socket, payload));

    socket.on("draw_start", (payload: DrawStartPayload) => this.onDrawStart(socket, payload));
    socket.on("draw_move", (payload: DrawMovePayload) => this.onDrawMove(socket, payload));
    socket.on("draw_end", (payload: DrawEndPayload) => this.onDrawEnd(socket, payload));
    socket.on("canvas_clear", () => this.onCanvasClear(socket));
    socket.on("draw_undo", () => this.onDrawUndo(socket));

    socket.on("guess", (payload: GuessPayload) => this.onGuess(socket, payload));
    socket.on("chat", (payload: ChatPayload) => this.onChat(socket, payload));

    socket.on("update_settings", (payload: UpdateSettingsPayload) => this.onUpdateSettings(socket, payload));
    socket.on("kick_player", (payload: KickPayload) => this.onKickPlayer(socket, payload));
    socket.on("leave_room", () => this.onDisconnect(socket));

    socket.on("disconnect", () => this.onDisconnect(socket));
  }

  private emitError(socket: Socket, code: string, message: string): void {
    const payload: ErrorPayload = { code, message };
    socket.emit("error_message", payload);
  }

  // --- Room & Lobby --------------------------------------------------------

  private onCreateRoom(socket: Socket, payload: CreateRoomPayload): void {
    const hostName = sanitizeName(payload?.hostName);
    const playerId = nanoid(10);
    const room = this.rooms.createRoom(playerId, payload?.settings ?? {});

    const host = new Player(playerId, hostName, socket.id, true);
    room.addPlayer(host);

    socket.join(room.socketRoomName);
    socket.data.roomId = room.id;
    socket.data.playerId = playerId;

    const responsePayload: RoomCreatedPayload = {
      roomId: room.id,
      playerId,
      settings: room.settings,
    };
    socket.emit("room_created", responsePayload);

    const joinedPayload: JoinedRoomPayload = {
      roomId: room.id,
      playerId,
      players: room.playersPublic(),
      settings: room.settings,
      hostId: room.hostId,
    };
    socket.emit("joined_room", joinedPayload);
  }

  private onJoinRoom(socket: Socket, payload: JoinRoomPayload): void {
    const room = this.rooms.getRoom(payload?.roomId ?? "");
    if (!room) {
      this.emitError(socket, "ROOM_NOT_FOUND", "That room code doesn't exist.");
      return;
    }

    const connectedCount = room.getConnectedPlayers().length;
    if (connectedCount >= room.settings.maxPlayers) {
      this.emitError(socket, "ROOM_FULL", "This room is full.");
      return;
    }

    const playerName = sanitizeName(payload?.playerName);
    const playerId = nanoid(10);
    const player = new Player(playerId, playerName, socket.id, false);
    room.addPlayer(player);

    socket.join(room.socketRoomName);
    socket.data.roomId = room.id;
    socket.data.playerId = playerId;

    const joinedPayload: JoinedRoomPayload = {
      roomId: room.id,
      playerId,
      players: room.playersPublic(),
      settings: room.settings,
      hostId: room.hostId,
    };
    socket.emit("joined_room", joinedPayload);

    const broadcastPayload: PlayerJoinedPayload = {
      player: player.toPublic(),
      players: room.playersPublic(),
    };
    socket.to(room.socketRoomName).emit("player_joined", broadcastPayload);

    // If joining mid-game, immediately sync them with current state
    if (room.game && room.game.phase !== "lobby") {
      const controller = getController(room.id, room);
      controller.broadcastGameState();
    }
  }

  private onStartGame(socket: Socket): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player) return;

    if (room.hostId !== player.id) {
      this.emitError(socket, "NOT_HOST", "Only the host can start the game.");
      return;
    }
    if (room.getConnectedPlayers().length < 2) {
      this.emitError(socket, "NOT_ENOUGH_PLAYERS", "Need at least 2 players to start.");
      return;
    }
    if (room.game && room.game.phase !== "lobby" && room.game.phase !== "game_over") {
      this.emitError(socket, "GAME_IN_PROGRESS", "A game is already in progress.");
      return;
    }

    const controller = getController(room.id, room);
    controller.startGame();
  }

  private onWordChosen(socket: Socket, payload: WordChosenPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player) return;

    const controller = getController(room.id, room);
    const ok = controller.chooseWord(player.id, payload?.word ?? "");
    if (!ok) {
      this.emitError(socket, "INVALID_WORD_CHOICE", "Could not select that word.");
    }
  }

  // --- Drawing --------------------------------------------------------------

  private isCurrentDrawer(room: import("../models/Room.js").Room, playerId: string): boolean {
    return !!room.game && room.game.currentDrawerId === playerId && room.game.phase === "drawing";
  }

  private onDrawStart(socket: Socket, payload: DrawStartPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !this.isCurrentDrawer(room, player.id)) return;

    const broadcastPayload: DrawDataPayload = { type: "start", stroke: payload };
    room.broadcast("draw_data", broadcastPayload);
  }

  private onDrawMove(socket: Socket, payload: DrawMovePayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !this.isCurrentDrawer(room, player.id)) return;

    const broadcastPayload: DrawDataPayload = { type: "move", stroke: payload };
    room.broadcast("draw_data", broadcastPayload);
  }

  private onDrawEnd(socket: Socket, payload: DrawEndPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !this.isCurrentDrawer(room, player.id)) return;

    const broadcastPayload: DrawDataPayload = { type: "end", stroke: payload };
    room.broadcast("draw_data", broadcastPayload);
  }

  private onCanvasClear(socket: Socket): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !this.isCurrentDrawer(room, player.id)) return;
    room.broadcast("canvas_clear", {});
  }

  private onDrawUndo(socket: Socket): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !this.isCurrentDrawer(room, player.id)) return;
    room.broadcast("draw_undo", {});
  }

  // --- Chat & Guessing --------------------------------------------------------

  private onGuess(socket: Socket, payload: GuessPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player || !room.game) return;

    const text = sanitizeChatText(payload?.text);
    if (!text) return;

    const game = room.game;

    // Drawer can't guess; already-correct guessers' messages become chat-only
    if (game.currentDrawerId === player.id) return;

    if (player.hasGuessedCorrectly || game.phase !== "drawing") {
      // Treat as regular chat so people can talk after guessing
      this.broadcastChat(room, player, text, "chat");
      return;
    }

    const outcome = game.submitGuess(text, player.hasGuessedCorrectly);

    if (outcome.matchType === "exact") {
      player.hasGuessedCorrectly = true;
      player.addPoints(outcome.points);
      // Drawer also gets a smaller reward per correct guesser
      const drawer = room.players.get(game.currentDrawerId!);
      if (drawer) drawer.addPoints(10);

      const resultPayload: GuessResultPayload = {
        correct: true,
        playerId: player.id,
        playerName: player.name,
        points: outcome.points,
      };
      room.broadcast("guess_result", resultPayload);

      const chatPayload: ChatMessagePayload = {
        id: nanoid(8),
        playerId: player.id,
        playerName: player.name,
        text: `${player.name} guessed the word!`,
        type: "correct_guess",
      };
      room.broadcast("chat_message", chatPayload);

      const controller = getController(room.id, room);
      controller.broadcastGameState();
      controller.checkAllGuessed(outcome.allGuessed);
    } else if (outcome.matchType === "close") {
      socket.emit("guess_result", {
        correct: false,
        playerId: player.id,
        playerName: player.name,
        points: 0,
        isClose: true,
      } as GuessResultPayload);
      // Close guesses are shown only to the guesser, not broadcast as chat
    } else {
      this.broadcastChat(room, player, text, "chat");
    }
  }

  private onChat(socket: Socket, payload: ChatPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player) return;

    const text = sanitizeChatText(payload?.text);
    if (!text) return;

    // If a game is active and this player is still guessing, route through
    // guess logic instead so typing the word in "chat" still counts.
    if (room.game && room.game.phase === "drawing" && room.game.currentDrawerId !== player.id && !player.hasGuessedCorrectly) {
      this.onGuess(socket, payload);
      return;
    }

    this.broadcastChat(room, player, text, "chat");
  }

  private broadcastChat(
    room: import("../models/Room.js").Room,
    player: Player,
    text: string,
    type: "chat" | "system" | "correct_guess"
  ): void {
    const payload: ChatMessagePayload = {
      id: nanoid(8),
      playerId: player.id,
      playerName: player.name,
      text,
      type,
    };
    room.chatLog.push(payload);
    if (room.chatLog.length > 200) room.chatLog.shift();
    room.broadcast("chat_message", payload);
  }

  // --- Settings & moderation --------------------------------------------------

  private onUpdateSettings(socket: Socket, payload: UpdateSettingsPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player) return;

    if (room.hostId !== player.id) {
      this.emitError(socket, "NOT_HOST", "Only the host can change settings.");
      return;
    }
    if (room.game && room.game.phase !== "lobby") {
      this.emitError(socket, "GAME_IN_PROGRESS", "Cannot change settings mid-game.");
      return;
    }

    room.updateSettings(payload?.settings ?? {});
    room.broadcast("settings_updated", { settings: room.settings });
  }

  private onKickPlayer(socket: Socket, payload: KickPayload): void {
    const { room, player } = this.requireRoomAndPlayer(socket);
    if (!room || !player) return;

    if (room.hostId !== player.id) {
      this.emitError(socket, "NOT_HOST", "Only the host can kick players.");
      return;
    }

    const target = room.players.get(payload?.playerId ?? "");
    if (!target || target.id === player.id) return;

    const targetSocket = this.io.sockets.sockets.get(target.socketId);
    room.removePlayer(target.id);

    if (targetSocket) {
      targetSocket.emit("kicked", { reason: "Removed by host" });
      targetSocket.leave(room.socketRoomName);
    }

    const leftPayload: PlayerLeftPayload = {
      playerId: target.id,
      players: room.playersPublic(),
    };
    room.broadcast("player_left", leftPayload);

    if (this.isCurrentDrawer(room, target.id)) {
      getController(room.id, room).handleDrawerLeft();
    }
  }

  // --- Disconnect handling ----------------------------------------------------

  private onDisconnect(socket: Socket): void {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return;

    const room = this.rooms.getRoom(roomId);
    if (!room) return;

    const player = room.players.get(playerId);
    if (!player) return;

    room.markDisconnected(playerId);

    const wasDrawer = this.isCurrentDrawer(room, playerId);

    // Fully remove from lobby; in active game keep them (for potential
    // reconnect / score retention) but mark disconnected and remove from
    // the drawer rotation going forward.
    if (!room.game || room.game.phase === "lobby" || room.game.phase === "game_over") {
      room.removePlayer(playerId);
    } else {
      room.game.removePlayerFromOrder(playerId);
    }

    const newHostId = room.reassignHostIfNeeded();

    const leftPayload: PlayerLeftPayload = {
      playerId,
      players: room.playersPublic(),
      newHostId: newHostId ?? undefined,
    };
    room.broadcast("player_left", leftPayload);

    if (wasDrawer) {
      getController(room.id, room).handleDrawerLeft();
    }

    if (room.isEmpty()) {
      room.scheduleEmptyRoomCheck(() => {
        controllers.delete(room.id);
        this.rooms.removeRoom(room.id);
      });
    }
  }

  // --- Helpers ----------------------------------------------------------------

  private requireRoomAndPlayer(
    socket: Socket
  ): { room: import("../models/Room.js").Room | null; player: Player | null } {
    const roomId = socket.data.roomId as string | undefined;
    const playerId = socket.data.playerId as string | undefined;
    if (!roomId || !playerId) return { room: null, player: null };

    const room = this.rooms.getRoom(roomId);
    if (!room) return { room: null, player: null };

    const player = room.players.get(playerId);
    if (!player) return { room: null, player: null };

    room.touch();
    return { room, player };
  }
}

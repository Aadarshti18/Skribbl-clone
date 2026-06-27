import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";
import {
  ChatMessagePayload,
  ErrorPayload,
  GameOverPayload,
  GameStatePayload,
  HintUpdatePayload,
  JoinedRoomPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerPublic,
  RoomCreatedPayload,
  RoomSettings,
  RoundEndPayload,
  RoundStartPayload,
} from "../types/socketTypes";

export type DrawEventPayload =
  | { type: "start"; stroke: { strokeId: string; x: number; y: number; color: string; size: number; tool: "brush" | "eraser" } }
  | { type: "move"; stroke: { strokeId: string; x: number; y: number } }
  | { type: "end"; stroke: { strokeId: string } };

interface GameState {
  roomId: string | null;
  playerId: string | null;
  hostId: string | null;
  players: PlayerPublic[];
  settings: RoomSettings | null;

  phase: GameStatePayload["phase"];
  round: number;
  totalRounds: number;
  drawerId: string | null;
  myWord: string | null; // populated only when I am the drawer
  blank: string | null;
  timeLeft: number;
  drawTime: number;
  hintsRevealed: number;
  wordOptions: string[] | null; // populated only when I am choosing

  chat: ChatMessagePayload[];
  lastGuessResult: { correct: boolean; playerName: string; points: number; isClose?: boolean } | null;
  roundEndInfo: RoundEndPayload | null;
  gameOverInfo: GameOverPayload | null;
  errorMessage: string | null;
  kicked: boolean;
}

interface GameContextValue extends GameState {
  createRoom: (hostName: string, settings: Partial<RoomSettings>) => void;
  joinRoom: (roomId: string, playerName: string) => void;
  startGame: () => void;
  chooseWord: (word: string) => void;
  sendGuess: (text: string) => void;
  sendChat: (text: string) => void;
  updateSettings: (settings: Partial<RoomSettings>) => void;
  kickPlayer: (playerId: string) => void;
  leaveRoom: () => void;
  clearError: () => void;
  onDrawData: (cb: (payload: DrawEventPayload) => void) => () => void;
  onCanvasClear: (cb: () => void) => () => void;
  onDrawUndo: (cb: () => void) => () => void;
  emitDrawStart: (p: { strokeId: string; x: number; y: number; color: string; size: number; tool: "brush" | "eraser" }) => void;
  emitDrawMove: (p: { strokeId: string; x: number; y: number }) => void;
  emitDrawEnd: (p: { strokeId: string }) => void;
  emitCanvasClear: () => void;
  emitDrawUndo: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const initialState: GameState = {
  roomId: null,
  playerId: null,
  hostId: null,
  players: [],
  settings: null,
  phase: "lobby",
  round: 0,
  totalRounds: 0,
  drawerId: null,
  myWord: null,
  blank: null,
  timeLeft: 0,
  drawTime: 0,
  hintsRevealed: 0,
  wordOptions: null,
  chat: [],
  lastGuessResult: null,
  roundEndInfo: null,
  gameOverInfo: null,
  errorMessage: null,
  kicked: false,
};

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [state, setState] = useState<GameState>(initialState);

  // Draw-data listeners are high-frequency; route them through refs/callbacks
  // rather than React state to avoid re-rendering on every mouse-move.
  const drawListeners = useRef(new Set<(p: DrawEventPayload) => void>());
  const clearListeners = useRef(new Set<() => void>());
  const undoListeners = useRef(new Set<() => void>());

  useEffect(() => {
    function onRoomCreated(p: RoomCreatedPayload) {
      setState((s) => ({ ...s, roomId: p.roomId, playerId: p.playerId, settings: p.settings }));
    }

    function onJoinedRoom(p: JoinedRoomPayload) {
      setState((s) => ({
        ...s,
        roomId: p.roomId,
        playerId: p.playerId,
        players: p.players,
        settings: p.settings,
        hostId: p.hostId,
      }));
    }

    function onPlayerJoined(p: PlayerJoinedPayload) {
      setState((s) => ({ ...s, players: p.players }));
    }

    function onPlayerLeft(p: PlayerLeftPayload) {
      setState((s) => ({ ...s, players: p.players, hostId: p.newHostId ?? s.hostId }));
    }

    function onSettingsUpdated(p: { settings: RoomSettings }) {
      setState((s) => ({ ...s, settings: p.settings }));
    }

    function onRoundStart(p: RoundStartPayload) {
      setState((s) => ({
        ...s,
        drawerId: p.drawerId,
        round: p.round,
        totalRounds: p.totalRounds,
        drawTime: p.drawTime,
        timeLeft: p.drawTime,
        wordOptions: p.wordOptions,
        myWord: null,
        roundEndInfo: null,
        lastGuessResult: null,
        hintsRevealed: 0,
      }));
    }

    function onGameState(p: GameStatePayload) {
      setState((s) => ({
        ...s,
        phase: p.phase,
        round: p.round,
        totalRounds: p.totalRounds,
        drawerId: p.drawerId,
        myWord: p.word ?? (p.drawerId === s.playerId ? s.myWord : null),
        blank: p.blank,
        timeLeft: p.timeLeft,
        hintsRevealed: p.hintsRevealed,
        // wordOptions only relevant during choosing_word; cleared once drawing starts
        wordOptions: p.phase === "choosing_word" ? s.wordOptions : null,
      }));
    }

    function onTimeTick(p: { timeLeft: number }) {
      setState((s) => ({ ...s, timeLeft: p.timeLeft }));
    }

    function onHintUpdate(p: HintUpdatePayload) {
      setState((s) => ({ ...s, blank: p.blank, hintsRevealed: p.hintsRevealed }));
    }

    function onGuessResult(p: { correct: boolean; playerId: string; playerName: string; points: number; isClose?: boolean }) {
      setState((s) => ({
        ...s,
        lastGuessResult: { correct: p.correct, playerName: p.playerName, points: p.points, isClose: p.isClose },
        players: s.players.map((pl) =>
          pl.id === p.playerId && p.correct ? { ...pl, hasGuessedCorrectly: true, score: pl.score + p.points } : pl
        ),
      }));
    }

    function onChatMessage(p: ChatMessagePayload) {
      setState((s) => ({ ...s, chat: [...s.chat.slice(-199), p] }));
    }

    function onRoundEnd(p: RoundEndPayload) {
      setState((s) => ({
        ...s,
        roundEndInfo: p,
        players: p.scores,
        wordOptions: null,
      }));
    }

    function onGameOver(p: GameOverPayload) {
      setState((s) => ({ ...s, gameOverInfo: p, phase: "game_over" }));
    }

    function onErrorMessage(p: ErrorPayload) {
      setState((s) => ({ ...s, errorMessage: p.message }));
    }

    function onKicked() {
      setState((s) => ({ ...s, kicked: true }));
    }

    function onDrawData(p: DrawEventPayload) {
      drawListeners.current.forEach((cb) => cb(p));
    }
    function onCanvasClear() {
      clearListeners.current.forEach((cb) => cb());
    }
    function onDrawUndo() {
      undoListeners.current.forEach((cb) => cb());
    }

    socket.on("room_created", onRoomCreated);
    socket.on("joined_room", onJoinedRoom);
    socket.on("player_joined", onPlayerJoined);
    socket.on("player_left", onPlayerLeft);
    socket.on("settings_updated", onSettingsUpdated);
    socket.on("round_start", onRoundStart);
    socket.on("game_state", onGameState);
    socket.on("time_tick", onTimeTick);
    socket.on("hint_update", onHintUpdate);
    socket.on("guess_result", onGuessResult);
    socket.on("chat_message", onChatMessage);
    socket.on("round_end", onRoundEnd);
    socket.on("game_over", onGameOver);
    socket.on("error_message", onErrorMessage);
    socket.on("kicked", onKicked);
    socket.on("draw_data", onDrawData);
    socket.on("canvas_clear", onCanvasClear);
    socket.on("draw_undo", onDrawUndo);

    return () => {
      socket.off("room_created", onRoomCreated);
      socket.off("joined_room", onJoinedRoom);
      socket.off("player_joined", onPlayerJoined);
      socket.off("player_left", onPlayerLeft);
      socket.off("settings_updated", onSettingsUpdated);
      socket.off("round_start", onRoundStart);
      socket.off("game_state", onGameState);
      socket.off("time_tick", onTimeTick);
      socket.off("hint_update", onHintUpdate);
      socket.off("guess_result", onGuessResult);
      socket.off("chat_message", onChatMessage);
      socket.off("round_end", onRoundEnd);
      socket.off("game_over", onGameOver);
      socket.off("error_message", onErrorMessage);
      socket.off("kicked", onKicked);
      socket.off("draw_data", onDrawData);
      socket.off("canvas_clear", onCanvasClear);
      socket.off("draw_undo", onDrawUndo);
    };
  }, [socket]);

  const createRoom = useCallback(
    (hostName: string, settings: Partial<RoomSettings>) => socket.emit("create_room", { hostName, settings }),
    [socket]
  );
  const joinRoom = useCallback(
    (roomId: string, playerName: string) => socket.emit("join_room", { roomId, playerName }),
    [socket]
  );
  const startGame = useCallback(() => socket.emit("start_game"), [socket]);
  const chooseWord = useCallback((word: string) => socket.emit("word_chosen", { word }), [socket]);
  const sendGuess = useCallback((text: string) => socket.emit("guess", { text }), [socket]);
  const sendChat = useCallback((text: string) => socket.emit("chat", { text }), [socket]);
  const updateSettings = useCallback(
    (settings: Partial<RoomSettings>) => socket.emit("update_settings", { settings }),
    [socket]
  );
  const kickPlayer = useCallback((playerId: string) => socket.emit("kick_player", { playerId }), [socket]);
  const leaveRoom = useCallback(() => {
    socket.emit("leave_room");
    setState(initialState);
  }, [socket]);
  const clearError = useCallback(() => setState((s) => ({ ...s, errorMessage: null })), []);

  const onDrawData = useCallback((cb: (p: DrawEventPayload) => void) => {
    drawListeners.current.add(cb);
    return () => drawListeners.current.delete(cb);
  }, []);
  const onCanvasClear = useCallback((cb: () => void) => {
    clearListeners.current.add(cb);
    return () => clearListeners.current.delete(cb);
  }, []);
  const onDrawUndo = useCallback((cb: () => void) => {
    undoListeners.current.add(cb);
    return () => undoListeners.current.delete(cb);
  }, []);

  const emitDrawStart = useCallback(
    (p: { strokeId: string; x: number; y: number; color: string; size: number; tool: "brush" | "eraser" }) =>
      socket.emit("draw_start", p),
    [socket]
  );
  const emitDrawMove = useCallback(
    (p: { strokeId: string; x: number; y: number }) => socket.emit("draw_move", p),
    [socket]
  );
  const emitDrawEnd = useCallback((p: { strokeId: string }) => socket.emit("draw_end", p), [socket]);
  const emitCanvasClear = useCallback(() => socket.emit("canvas_clear"), [socket]);
  const emitDrawUndo = useCallback(() => socket.emit("draw_undo"), [socket]);

  const value: GameContextValue = {
    ...state,
    createRoom,
    joinRoom,
    startGame,
    chooseWord,
    sendGuess,
    sendChat,
    updateSettings,
    kickPlayer,
    leaveRoom,
    clearError,
    onDrawData,
    onCanvasClear,
    onDrawUndo,
    emitDrawStart,
    emitDrawMove,
    emitDrawEnd,
    emitCanvasClear,
    emitDrawUndo,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within a GameProvider");
  return ctx;
}

import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGame } from "../context/GameContext";
import { DrawingCanvas } from "../components/DrawingCanvas";
import { ChatPanel } from "../components/ChatPanel";
import { PlayersList } from "../components/PlayersList";
import { GameHeader } from "../components/GameHeader";
import { WordPicker } from "../components/WordPicker";
import { RoundEndOverlay, GameOverOverlay } from "../components/EndOverlays";

export function GamePage() {
  const navigate = useNavigate();
  const { roomId: urlRoomId } = useParams();
  const { roomId, drawerId, playerId, phase, leaveRoom, startGame, hostId, kicked } = useGame();

  React.useEffect(() => {
    if (!roomId && urlRoomId) {
      navigate("/");
    }
  }, [roomId, urlRoomId, navigate]);

  if (kicked) {
    return (
      <div className="lobby-kicked card">
        <h2>You were removed from the room</h2>
        <button className="btn btn-primary" onClick={() => navigate("/")}>
          Back home
        </button>
      </div>
    );
  }

  const isDrawer = drawerId === playerId;

  function handleLeave() {
    leaveRoom();
    navigate("/");
  }

  function handlePlayAgain() {
    navigate(`/room/${roomId}`);
  }

  return (
    <div className="game-page">
      <GameHeader />

      <div className="game-body">
        <div className="game-canvas-col">
          <RoundEndOverlay />
          <DrawingCanvas isDrawer={isDrawer} />
        </div>

        <div className="game-sidebar-col">
          <PlayersList />
          <ChatPanel />
        </div>
      </div>

      <div className="game-footer">
        <button className="btn btn-sm" onClick={handleLeave}>
          Leave room
        </button>
      </div>

      <WordPicker />
      {phase === "game_over" && <GameOverOverlay onPlayAgain={handlePlayAgain} onLeave={handleLeave} />}
    </div>
  );
}

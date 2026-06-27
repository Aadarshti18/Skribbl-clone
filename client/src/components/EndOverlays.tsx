import React from "react";
import { useGame } from "../context/GameContext";

export function RoundEndOverlay() {
  const { roundEndInfo, phase } = useGame();
  if (!roundEndInfo || phase === "game_over") return null;

  const reasonText =
    roundEndInfo.reason === "all_guessed"
      ? "Everyone guessed it!"
      : roundEndInfo.reason === "drawer_left"
      ? "The drawer left the round."
      : "Time's up!";

  return (
    <div className="overlay-banner">
      <p className="overlay-banner-reason">{reasonText}</p>
      <p className="overlay-banner-word">
        The word was: <strong>{roundEndInfo.word}</strong>
      </p>
    </div>
  );
}

export function GameOverOverlay({ onPlayAgain, onLeave }: { onPlayAgain: () => void; onLeave: () => void }) {
  const { gameOverInfo, hostId, playerId } = useGame();
  if (!gameOverInfo) return null;

  const amHost = hostId === playerId;
  const sorted = [...gameOverInfo.leaderboard].sort((a, b) => b.score - a.score);

  return (
    <div className="word-picker-overlay">
      <div className="card game-over-card">
        <h2 className="font-display">🏆 {gameOverInfo.winner.name} wins!</h2>
        <ol className="leaderboard-list">
          {sorted.map((p, i) => (
            <li key={p.id} className={`leaderboard-row ${i === 0 ? "leaderboard-row--winner" : ""}`}>
              <span>{i + 1}.</span>
              <span className="leaderboard-name">{p.name}</span>
              <span className="leaderboard-score">{p.score} pts</span>
            </li>
          ))}
        </ol>
        <div className="game-over-actions">
          {amHost ? (
            <button className="btn btn-primary" onClick={onPlayAgain}>
              Back to lobby
            </button>
          ) : (
            <p className="game-over-waiting">Waiting for the host…</p>
          )}
          <button className="btn" onClick={onLeave}>
            Leave room
          </button>
        </div>
      </div>
    </div>
  );
}

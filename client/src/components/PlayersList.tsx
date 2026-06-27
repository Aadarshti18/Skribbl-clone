import React from "react";
import { useGame } from "../context/GameContext";

function Avatar({ seed }: { seed: string }) {
  // Deterministic color from seed for a simple, consistent avatar without external assets
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return (
    <div
      className="avatar"
      style={{ background: `hsl(${hash}, 70%, 60%)` }}
      aria-hidden="true"
    />
  );
}

export function PlayersList({ showKick = false }: { showKick?: boolean }) {
  const { players, hostId, playerId, drawerId, kickPlayer } = useGame();

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const amHost = hostId === playerId;

  return (
    <div className="players-list card">
      <h3 className="players-list-title">Players ({players.length})</h3>
      <ul className="players-ul">
        {sorted.map((p, i) => (
          <li key={p.id} className={`player-row ${p.id === drawerId ? "player-row--drawing" : ""} ${!p.connected ? "player-row--disconnected" : ""}`}>
            <span className="player-rank">{i + 1}</span>
            <Avatar seed={p.avatarSeed} />
            <span className="player-name">
              {p.name}
              {p.id === playerId && <span className="player-you"> (you)</span>}
            </span>
            <span className="player-badges">
              {p.id === hostId && <span title="Host">👑</span>}
              {p.id === drawerId && <span title="Drawing now">✏️</span>}
              {p.hasGuessedCorrectly && <span title="Guessed correctly">✅</span>}
              {!p.connected && <span title="Disconnected">📡</span>}
            </span>
            <span className="player-score">{p.score}</span>
            {showKick && amHost && p.id !== playerId && (
              <button className="btn btn-sm btn-danger kick-btn" onClick={() => kickPlayer(p.id)} title="Kick player">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

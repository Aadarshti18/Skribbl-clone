import React from "react";
import { useGame } from "../context/GameContext";

export function GameHeader() {
  const { round, totalRounds, timeLeft, drawTime, blank, myWord, drawerId, playerId, players, phase } = useGame();

  const drawer = players.find((p) => p.id === drawerId);
  const isMyTurn = drawerId === playerId;
  const pct = drawTime > 0 ? Math.max(0, Math.min(100, (timeLeft / drawTime) * 100)) : 0;
  const urgent = drawTime > 0 && timeLeft <= Math.max(10, drawTime * 0.2);

  return (
    <div className="game-header card">
      <div className="game-header-round">
        Round <strong>{round}</strong> / {totalRounds}
      </div>

      <div className="game-header-center">
        {phase === "drawing" || phase === "choosing_word" ? (
          <div className="word-blank" aria-live="polite">
            {isMyTurn ? myWord ?? blank : blank}
          </div>
        ) : (
          <div className="word-blank word-blank--muted">Waiting…</div>
        )}
        <div className="drawer-tag">
          {drawer ? (isMyTurn ? "You are drawing" : `${drawer.name} is drawing`) : ""}
        </div>
      </div>

      <div className={`timer ${urgent ? "timer--urgent" : ""}`}>
        <svg viewBox="0 0 36 36" className="timer-ring">
          <circle cx="18" cy="18" r="15.5" className="timer-ring-bg" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            className="timer-ring-fg"
            strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
          />
        </svg>
        <span className="timer-number">{timeLeft}</span>
      </div>
    </div>
  );
}

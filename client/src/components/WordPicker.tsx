import React from "react";
import { useGame } from "../context/GameContext";

export function WordPicker() {
  const { wordOptions, drawerId, playerId, chooseWord, phase } = useGame();

  const isMyTurn = drawerId === playerId;
  if (phase !== "choosing_word" || !isMyTurn || !wordOptions) return null;

  return (
    <div className="word-picker-overlay">
      <div className="word-picker card">
        <h2 className="font-display">Pick a word to draw</h2>
        <div className="word-picker-options">
          {wordOptions.map((w) => (
            <button key={w} className="btn btn-accent word-option" onClick={() => chooseWord(w)}>
              {w}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
